"""
Historical Tracking Service

Saves analysis snapshots over time and enables trend analysis.
"""

import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

from ..database import get_database


@dataclass
class HistoricalSnapshot:
    """Single historical snapshot"""
    id: int
    url: str
    snapshot_date: datetime
    total_claims: int
    total_proof: int
    total_personas: int
    proof_ratio: float
    consistency_score: int
    overall_score: float


@dataclass
class TrendAnalysis:
    """Trend analysis over time"""
    url: str
    snapshots: List[HistoricalSnapshot]
    total_snapshots: int
    date_range_days: int

    # Trends
    claims_trend: str  # "increasing", "decreasing", "stable"
    proof_trend: str
    score_trend: str

    # Changes
    claims_change: int
    proof_change: int
    score_change: float

    # Insights
    insights: List[str]


class HistoryService:
    """Manages historical snapshots and trend analysis"""

    def __init__(self):
        """Initialize history service"""
        self.db = get_database()

    def _generate_url_hash(self, url: str) -> str:
        """Generate hash for URL"""
        return hashlib.sha256(url.encode()).hexdigest()

    def save_snapshot(
        self,
        url: str,
        analysis_type: str,
        result: Dict[str, Any],
        **kwargs
    ):
        """
        Save analysis snapshot to history

        Args:
            url: Website URL or path
            analysis_type: 'standard', 'ai', or 'competitive'
            result: Analysis result dictionary
            **kwargs: Additional metadata
        """
        url_hash = self._generate_url_hash(url)
        snapshot_date = datetime.now()

        # Extract key metrics based on analysis type
        if analysis_type == 'standard':
            total_claims = result.get('summary', {}).get('total_claims', 0)
            total_proof = result.get('summary', {}).get('total_proof', 0)
            total_personas = result.get('summary', {}).get('total_personas', 0)
            proof_ratio = (total_proof / total_claims * 100) if total_claims > 0 else 0
            consistency_score = 95  # Placeholder
            overall_score = proof_ratio
            pages_analyzed = result.get('stats', {}).get('total_pages', 0)

        elif analysis_type == 'ai':
            total_claims = result.get('summary', {}).get('total_ai_claims', 0)
            total_proof = result.get('summary', {}).get('high_strength_claims', 0)
            total_personas = result.get('summary', {}).get('total_gaps', 0)
            proof_ratio = result.get('tone_analysis', {}).get('consistency_score', 0)
            consistency_score = int(proof_ratio)
            overall_score = result.get('overall_narrative_score', 0)
            pages_analyzed = kwargs.get('pages_analyzed', 0)

        else:
            # Competitive analysis handled separately
            return

        cursor = self.db.conn.cursor()
        cursor.execute("""
            INSERT INTO analysis_history
            (url_hash, url, analysis_type, result_json, snapshot_date,
             total_claims, total_proof, total_personas, proof_ratio,
             consistency_score, overall_score, pages_analyzed,
             max_pages, render_js)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            url_hash,
            url,
            analysis_type,
            json.dumps(result),
            snapshot_date.isoformat(),
            total_claims,
            total_proof,
            total_personas,
            proof_ratio,
            consistency_score,
            overall_score,
            pages_analyzed,
            kwargs.get('max_pages', 20),
            kwargs.get('render_js', False)
        ))

        self.db.conn.commit()
        print(f"📸 Saved historical snapshot for {url}")

    def get_snapshots(
        self,
        url: str,
        analysis_type: str = 'standard',
        limit: int = 30
    ) -> List[HistoricalSnapshot]:
        """Get historical snapshots for a URL"""
        url_hash = self._generate_url_hash(url)

        cursor = self.db.conn.cursor()
        cursor.execute("""
            SELECT id, url, snapshot_date, total_claims, total_proof,
                   total_personas, proof_ratio, consistency_score, overall_score
            FROM analysis_history
            WHERE url_hash = ? AND analysis_type = ?
            ORDER BY snapshot_date DESC
            LIMIT ?
        """, (url_hash, analysis_type, limit))

        snapshots = []
        for row in cursor.fetchall():
            snapshots.append(HistoricalSnapshot(
                id=row['id'],
                url=row['url'],
                snapshot_date=datetime.fromisoformat(row['snapshot_date']),
                total_claims=row['total_claims'],
                total_proof=row['total_proof'],
                total_personas=row['total_personas'],
                proof_ratio=row['proof_ratio'],
                consistency_score=row['consistency_score'],
                overall_score=row['overall_score']
            ))

        return list(reversed(snapshots))  # Oldest first for trends

    def analyze_trends(
        self,
        url: str,
        analysis_type: str = 'standard',
        days: int = 30
    ) -> Optional[TrendAnalysis]:
        """
        Analyze trends for a URL over time

        Args:
            url: Website URL
            analysis_type: Type of analysis
            days: Number of days to analyze

        Returns:
            TrendAnalysis or None if insufficient data
        """
        snapshots = self.get_snapshots(url, analysis_type, limit=100)

        if len(snapshots) < 2:
            return None

        # Filter to date range
        cutoff_date = datetime.now() - timedelta(days=days)
        snapshots = [s for s in snapshots if s.snapshot_date >= cutoff_date]

        if len(snapshots) < 2:
            return None

        # Calculate trends
        first = snapshots[0]
        last = snapshots[-1]

        claims_change = last.total_claims - first.total_claims
        proof_change = last.total_proof - first.total_proof
        score_change = last.overall_score - first.overall_score

        # Determine trend direction
        def get_trend(change: float, threshold: float = 0.1) -> str:
            if abs(change) < threshold:
                return "stable"
            return "increasing" if change > 0 else "decreasing"

        claims_trend = get_trend(claims_change, 2)
        proof_trend = get_trend(proof_change, 2)
        score_trend = get_trend(score_change, 5)

        # Generate insights
        insights = []

        if claims_change > 5:
            insights.append(f"✅ Claims increased by {claims_change} ({first.total_claims} → {last.total_claims})")
        elif claims_change < -5:
            insights.append(f"⚠️ Claims decreased by {abs(claims_change)} ({first.total_claims} → {last.total_claims})")

        if proof_change > 5:
            insights.append(f"✅ Proof points increased by {proof_change}")
        elif proof_change < -5:
            insights.append(f"⚠️ Proof points decreased by {abs(proof_change)}")

        if score_change > 10:
            insights.append(f"🎉 Overall score improved by {score_change:.1f} points!")
        elif score_change < -10:
            insights.append(f"🚨 Overall score dropped by {abs(score_change):.1f} points")

        if last.proof_ratio > first.proof_ratio:
            insights.append(f"✅ Proof ratio improved to {last.proof_ratio:.1f}%")

        # Check for drift/staleness
        days_since_last = (datetime.now() - last.snapshot_date).days
        if days_since_last > 7:
            insights.append(f"📅 Last analyzed {days_since_last} days ago - consider re-analyzing")

        date_range_days = (last.snapshot_date - first.snapshot_date).days

        return TrendAnalysis(
            url=url,
            snapshots=snapshots,
            total_snapshots=len(snapshots),
            date_range_days=date_range_days,
            claims_trend=claims_trend,
            proof_trend=proof_trend,
            score_trend=score_trend,
            claims_change=claims_change,
            proof_change=proof_change,
            score_change=score_change,
            insights=insights
        )

    def get_recent_analyses(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recently analyzed websites"""
        cursor = self.db.conn.cursor()
        cursor.execute("""
            SELECT DISTINCT url, analysis_type, MAX(snapshot_date) as last_analyzed
            FROM analysis_history
            GROUP BY url, analysis_type
            ORDER BY last_analyzed DESC
            LIMIT ?
        """, (limit,))

        results = []
        for row in cursor.fetchall():
            results.append({
                'url': row['url'],
                'analysis_type': row['analysis_type'],
                'last_analyzed': row['last_analyzed']
            })

        return results


# Singleton instance
_history_service: Optional[HistoryService] = None


def get_history_service() -> HistoryService:
    """Get or create history service instance"""
    global _history_service
    if _history_service is None:
        _history_service = HistoryService()
    return _history_service


if __name__ == "__main__":
    # Test history service
    print("🧪 Testing History Service\n")

    history = HistoryService()

    # Simulate snapshots over time
    test_url = "https://example.com"

    # Snapshot 1 (30 days ago)
    result1 = {
        "summary": {"total_claims": 10, "total_proof": 15, "total_personas": 3},
        "stats": {"total_pages": 12}
    }
    history.save_snapshot(test_url, "standard", result1)

    # Snapshot 2 (today)
    result2 = {
        "summary": {"total_claims": 15, "total_proof": 20, "total_personas": 5},
        "stats": {"total_pages": 12}
    }
    history.save_snapshot(test_url, "standard", result2)

    # Get snapshots
    snapshots = history.get_snapshots(test_url)
    print(f"📊 Snapshots: {len(snapshots)}")
    for snap in snapshots:
        print(f"   {snap.snapshot_date}: Claims={snap.total_claims}, Proof={snap.total_proof}")

    # Analyze trends
    trends = history.analyze_trends(test_url)
    if trends:
        print(f"\n📈 Trends:")
        print(f"   Claims: {trends.claims_trend} ({trends.claims_change:+d})")
        print(f"   Proof: {trends.proof_trend} ({trends.proof_change:+d})")
        print(f"   Score: {trends.score_trend} ({trends.score_change:+.1f})")
        print(f"\n💡 Insights:")
        for insight in trends.insights:
            print(f"   {insight}")

    print("\n✅ Test complete")
