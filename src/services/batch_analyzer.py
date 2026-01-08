"""
Batch URL Analyzer Service

Analyzes multiple websites in parallel with:
- Job tracking and progress monitoring
- Result caching integration
- Historical snapshot saving
- CSV import/export
- Parallel processing (5-10 URLs at once)
"""

import asyncio
import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from io import StringIO

from ..database import get_database
from .cache_service import get_cache_service
from .history_service import get_history_service
from .website_analyzer import WebsiteAnalyzer


@dataclass
class BatchJobStatus:
    """Status of a batch analysis job"""
    job_id: str
    status: str  # pending, running, completed, failed
    total_urls: int
    completed_urls: int
    failed_urls: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    progress_percent: float


@dataclass
class BatchResult:
    """Single URL result from batch analysis"""
    url: str
    status: str  # success, failed, cached
    total_claims: int
    total_proof: int
    total_personas: int
    proof_ratio: float
    overall_score: float
    error_message: Optional[str]
    cached: bool
    analyzed_at: datetime


class BatchAnalyzer:
    """Manages batch analysis of multiple URLs"""

    def __init__(self, max_concurrent: int = 5):
        """
        Initialize batch analyzer

        Args:
            max_concurrent: Maximum number of URLs to analyze in parallel
        """
        self.db = get_database()
        self.cache = get_cache_service()
        self.history = get_history_service()
        self.max_concurrent = max_concurrent

    def _generate_job_id(self, urls: List[str]) -> str:
        """Generate unique job ID"""
        url_string = "|".join(sorted(urls))
        timestamp = datetime.now().isoformat()
        job_input = f"{url_string}|{timestamp}"
        return hashlib.sha256(job_input.encode()).hexdigest()[:16]

    def create_job(self, urls: List[str], analysis_type: str = 'standard') -> str:
        """
        Create a new batch analysis job

        Args:
            urls: List of URLs to analyze
            analysis_type: Type of analysis ('standard', 'ai')

        Returns:
            job_id for tracking
        """
        job_id = self._generate_job_id(urls)

        cursor = self.db.conn.cursor()
        cursor.execute("""
            INSERT INTO batch_jobs
            (job_id, status, total_urls, completed_urls, failed_urls, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            job_id,
            'pending',
            len(urls),
            0,
            0,
            datetime.now().isoformat()
        ))

        self.db.conn.commit()

        print(f"📦 Created batch job {job_id} with {len(urls)} URLs")
        return job_id

    def get_job_status(self, job_id: str) -> Optional[BatchJobStatus]:
        """Get status of a batch job"""
        cursor = self.db.conn.cursor()
        cursor.execute("""
            SELECT * FROM batch_jobs WHERE job_id = ?
        """, (job_id,))

        row = cursor.fetchone()
        if not row:
            return None

        progress_percent = (row['completed_urls'] / row['total_urls'] * 100) if row['total_urls'] > 0 else 0

        return BatchJobStatus(
            job_id=row['job_id'],
            status=row['status'],
            total_urls=row['total_urls'],
            completed_urls=row['completed_urls'],
            failed_urls=row['failed_urls'],
            created_at=datetime.fromisoformat(row['created_at']),
            started_at=datetime.fromisoformat(row['started_at']) if row['started_at'] else None,
            completed_at=datetime.fromisoformat(row['completed_at']) if row['completed_at'] else None,
            error_message=row['error_message'],
            progress_percent=progress_percent
        )

    def _update_job_status(
        self,
        job_id: str,
        status: Optional[str] = None,
        completed_urls: Optional[int] = None,
        failed_urls: Optional[int] = None,
        error_message: Optional[str] = None
    ):
        """Update job status"""
        updates = []
        values = []

        if status:
            updates.append("status = ?")
            values.append(status)

            if status == 'running' and not self._get_job_field(job_id, 'started_at'):
                updates.append("started_at = ?")
                values.append(datetime.now().isoformat())
            elif status in ('completed', 'failed'):
                updates.append("completed_at = ?")
                values.append(datetime.now().isoformat())

        if completed_urls is not None:
            updates.append("completed_urls = completed_urls + ?")
            values.append(completed_urls)

        if failed_urls is not None:
            updates.append("failed_urls = failed_urls + ?")
            values.append(failed_urls)

        if error_message:
            updates.append("error_message = ?")
            values.append(error_message)

        if updates:
            values.append(job_id)
            cursor = self.db.conn.cursor()
            cursor.execute(f"""
                UPDATE batch_jobs
                SET {', '.join(updates)}
                WHERE job_id = ?
            """, values)
            self.db.conn.commit()

    def _get_job_field(self, job_id: str, field: str) -> Any:
        """Get a specific field from job"""
        cursor = self.db.conn.cursor()
        cursor.execute(f"SELECT {field} FROM batch_jobs WHERE job_id = ?", (job_id,))
        row = cursor.fetchone()
        return row[field] if row else None

    async def _analyze_single_url(
        self,
        job_id: str,
        url: str,
        analysis_type: str,
        max_pages: int = 20,
        render_js: bool = False
    ) -> BatchResult:
        """
        Analyze a single URL with caching

        Args:
            job_id: Batch job ID
            url: URL to analyze
            analysis_type: Type of analysis
            max_pages: Maximum pages to crawl
            render_js: Whether to render JavaScript

        Returns:
            BatchResult with analysis data
        """
        try:
            # Check cache first
            cached_result = self.cache.get_cached_result(
                url,
                analysis_type,
                max_pages=max_pages,
                render_js=render_js
            )

            if cached_result:
                print(f"  ✅ Cache hit: {url}")

                # Extract metrics from cached result
                result = BatchResult(
                    url=url,
                    status='success',
                    total_claims=cached_result.get('summary', {}).get('total_claims', 0),
                    total_proof=cached_result.get('summary', {}).get('total_proof', 0),
                    total_personas=cached_result.get('summary', {}).get('total_personas', 0),
                    proof_ratio=(cached_result.get('summary', {}).get('total_proof', 0) /
                               cached_result.get('summary', {}).get('total_claims', 1) * 100),
                    overall_score=cached_result.get('overall_score', 0),
                    error_message=None,
                    cached=True,
                    analyzed_at=datetime.fromisoformat(cached_result['_cache_metadata']['cached_at'])
                )

                # Save to batch results
                self._save_batch_result(job_id, result, cached_result)
                return result

            # Not cached - perform analysis
            print(f"  🔍 Analyzing: {url}")
            analyzer = WebsiteAnalyzer(url, max_pages=max_pages, render_js=render_js)
            analysis_result = analyzer.analyze()

            # Calculate metrics
            total_claims = analysis_result.get('summary', {}).get('total_claims', 0)
            total_proof = analysis_result.get('summary', {}).get('total_proof', 0)
            total_personas = analysis_result.get('summary', {}).get('total_personas', 0)
            proof_ratio = (total_proof / total_claims * 100) if total_claims > 0 else 0
            overall_score = proof_ratio  # Simple score for now

            result = BatchResult(
                url=url,
                status='success',
                total_claims=total_claims,
                total_proof=total_proof,
                total_personas=total_personas,
                proof_ratio=proof_ratio,
                overall_score=overall_score,
                error_message=None,
                cached=False,
                analyzed_at=datetime.now()
            )

            # Save to cache
            self.cache.save_result(url, analysis_type, analysis_result, max_pages=max_pages, render_js=render_js)

            # Save to history
            self.history.save_snapshot(url, analysis_type, analysis_result, max_pages=max_pages, render_js=render_js)

            # Save to batch results
            self._save_batch_result(job_id, result, analysis_result)

            return result

        except Exception as e:
            print(f"  ❌ Error analyzing {url}: {str(e)}")

            result = BatchResult(
                url=url,
                status='failed',
                total_claims=0,
                total_proof=0,
                total_personas=0,
                proof_ratio=0.0,
                overall_score=0.0,
                error_message=str(e),
                cached=False,
                analyzed_at=datetime.now()
            )

            # Save failed result
            self._save_batch_result(job_id, result, None)

            return result

    def _save_batch_result(self, job_id: str, result: BatchResult, full_result: Optional[Dict]):
        """Save batch result to database"""
        cursor = self.db.conn.cursor()
        cursor.execute("""
            INSERT INTO batch_results
            (job_id, url, status, result_json, error_message, analyzed_at,
             total_claims, total_proof, total_personas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            job_id,
            result.url,
            result.status,
            json.dumps(full_result) if full_result else None,
            result.error_message,
            result.analyzed_at.isoformat(),
            result.total_claims,
            result.total_proof,
            result.total_personas
        ))
        self.db.conn.commit()

    async def run_batch_analysis(
        self,
        job_id: str,
        urls: List[str],
        analysis_type: str = 'standard',
        max_pages: int = 20,
        render_js: bool = False
    ) -> List[BatchResult]:
        """
        Run batch analysis with parallel processing

        Args:
            job_id: Job ID from create_job()
            urls: List of URLs to analyze
            analysis_type: Type of analysis
            max_pages: Maximum pages per site
            render_js: Whether to render JavaScript

        Returns:
            List of BatchResult objects
        """
        print(f"\n🚀 Starting batch analysis of {len(urls)} URLs")
        print(f"   Max concurrent: {self.max_concurrent}")
        print(f"   Analysis type: {analysis_type}")

        # Update job status to running
        self._update_job_status(job_id, status='running')

        results = []
        semaphore = asyncio.Semaphore(self.max_concurrent)

        async def analyze_with_semaphore(url: str) -> BatchResult:
            async with semaphore:
                result = await self._analyze_single_url(
                    job_id,
                    url,
                    analysis_type,
                    max_pages,
                    render_js
                )

                # Update progress
                if result.status == 'success':
                    self._update_job_status(job_id, completed_urls=1)
                else:
                    self._update_job_status(job_id, failed_urls=1)

                # Print progress
                status = self.get_job_status(job_id)
                print(f"   Progress: {status.completed_urls}/{status.total_urls} "
                      f"({status.progress_percent:.1f}%) - "
                      f"{status.failed_urls} failed")

                return result

        # Run all analyses in parallel with semaphore limit
        tasks = [analyze_with_semaphore(url) for url in urls]
        results = await asyncio.gather(*tasks)

        # Update job status to completed
        self._update_job_status(job_id, status='completed')

        print(f"\n✅ Batch analysis complete!")
        print(f"   Total: {len(results)}")
        print(f"   Successful: {len([r for r in results if r.status == 'success'])}")
        print(f"   Failed: {len([r for r in results if r.status == 'failed'])}")
        print(f"   From cache: {len([r for r in results if r.cached])}")

        return results

    def get_batch_results(self, job_id: str) -> List[BatchResult]:
        """Get all results for a batch job"""
        cursor = self.db.conn.cursor()
        cursor.execute("""
            SELECT * FROM batch_results WHERE job_id = ? ORDER BY analyzed_at
        """, (job_id,))

        results = []
        for row in cursor.fetchall():
            results.append(BatchResult(
                url=row['url'],
                status=row['status'],
                total_claims=row['total_claims'] or 0,
                total_proof=row['total_proof'] or 0,
                total_personas=row['total_personas'] or 0,
                proof_ratio=(row['total_proof'] / row['total_claims'] * 100)
                           if row['total_claims'] and row['total_claims'] > 0 else 0.0,
                overall_score=(row['total_proof'] / row['total_claims'] * 100)
                             if row['total_claims'] and row['total_claims'] > 0 else 0.0,
                error_message=row['error_message'],
                cached=json.loads(row['result_json']).get('_cache_metadata', {}).get('cached', False)
                       if row['result_json'] else False,
                analyzed_at=datetime.fromisoformat(row['analyzed_at']) if row['analyzed_at'] else datetime.now()
            ))

        return results

    def export_results_csv(self, job_id: str) -> str:
        """
        Export batch results to CSV

        Args:
            job_id: Batch job ID

        Returns:
            CSV string
        """
        results = self.get_batch_results(job_id)

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            'url', 'status', 'total_claims', 'total_proof', 'total_personas',
            'proof_ratio', 'overall_score', 'cached', 'analyzed_at', 'error_message'
        ])

        writer.writeheader()
        for result in results:
            writer.writerow({
                'url': result.url,
                'status': result.status,
                'total_claims': result.total_claims,
                'total_proof': result.total_proof,
                'total_personas': result.total_personas,
                'proof_ratio': f"{result.proof_ratio:.1f}",
                'overall_score': f"{result.overall_score:.1f}",
                'cached': 'Yes' if result.cached else 'No',
                'analyzed_at': result.analyzed_at.strftime('%Y-%m-%d %H:%M:%S'),
                'error_message': result.error_message or ''
            })

        return output.getvalue()

    @staticmethod
    def parse_csv_urls(csv_content: str) -> List[str]:
        """
        Parse URLs from CSV content

        Expects CSV with 'url' column or first column as URLs

        Args:
            csv_content: CSV file content

        Returns:
            List of URLs
        """
        reader = csv.DictReader(StringIO(csv_content))
        urls = []

        # Try 'url' column first
        if 'url' in reader.fieldnames:
            for row in reader:
                if row['url'].strip():
                    urls.append(row['url'].strip())
        else:
            # Use first column
            first_col = reader.fieldnames[0]
            for row in reader:
                if row[first_col].strip():
                    urls.append(row[first_col].strip())

        return urls


# Singleton instance
_batch_analyzer: Optional[BatchAnalyzer] = None


def get_batch_analyzer() -> BatchAnalyzer:
    """Get or create batch analyzer instance"""
    global _batch_analyzer
    if _batch_analyzer is None:
        _batch_analyzer = BatchAnalyzer()
    return _batch_analyzer


if __name__ == "__main__":
    # Test batch analyzer
    print("🧪 Testing Batch Analyzer\n")

    async def test():
        analyzer = BatchAnalyzer(max_concurrent=3)

        # Test URLs
        test_urls = [
            "https://example.com",
            "https://httpbin.org",
            "https://jsonplaceholder.typicode.com"
        ]

        # Create job
        job_id = analyzer.create_job(test_urls)

        # Run analysis
        results = await analyzer.run_batch_analysis(
            job_id,
            test_urls,
            analysis_type='standard'
        )

        # Get job status
        status = analyzer.get_job_status(job_id)
        print(f"\n📊 Job Status:")
        print(f"   Job ID: {status.job_id}")
        print(f"   Status: {status.status}")
        print(f"   Progress: {status.progress_percent:.1f}%")

        # Export CSV
        csv_output = analyzer.export_results_csv(job_id)
        print(f"\n📄 CSV Export:\n{csv_output}")

    # Run test
    asyncio.run(test())

    print("✅ Test complete")
