"""
Website Analysis API Routes

Endpoints for analyzing website narrative structure
"""

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, HttpUrl
from pathlib import Path
from typing import Optional, Dict
import tempfile
import subprocess

from src.services.website_analyzer import WebsiteAnalyzer
from src.services.report_generator import ReportGenerator
from src.services.url_fetcher import URLFetcher
from src.services.js_fetcher import JSFetcher
from src.services.ai_narrative_analyzer import AINavrativeAnalyzer, to_dict
from src.services.competitive_analyzer import CompetitiveAnalyzer, to_dict as comp_to_dict
from src.services.pdf_generator import PDFGenerator
from src.services.cache_service import get_cache_service
from src.services.history_service import get_history_service
from src.services.batch_analyzer import get_batch_analyzer, BatchJobStatus, BatchResult
import asyncio

router = APIRouter(prefix="/website", tags=["Website Analysis"])


class WebsiteAnalysisRequest(BaseModel):
    """Request to analyze a website"""
    path: str  # Local file path or URL
    generate_report: bool = True
    max_pages: int = 20  # Max pages to download for URLs
    render_js: bool = False  # Use JavaScript rendering (Playwright)
    force_refresh: bool = False  # Bypass cache and run fresh analysis


class WebsiteAnalysisResponse(BaseModel):
    """Response from website analysis"""
    summary: Dict
    claims: list
    proof: list
    personas: list
    stats: Dict
    narrative_units: list
    markdown_report: Optional[str] = None
    cache_metadata: Optional[Dict] = None  # Cache info (if from cache)


class AIAnalysisResponse(BaseModel):
    """Response from AI-enhanced narrative analysis"""
    ai_claims: list
    narrative_gaps: list
    tone_analysis: Dict
    value_prop_scores: list
    recommendations: list
    overall_narrative_score: float
    summary: Dict
    # Also include base analysis
    base_analysis: Optional[WebsiteAnalysisResponse] = None
    cache_metadata: Optional[Dict] = None  # Cache info (if from cache)


class CompetitiveSiteRequest(BaseModel):
    """Single site for competitive analysis"""
    name: str
    url: str  # URL or local path


class CompetitiveAnalysisRequest(BaseModel):
    """Request for competitive analysis"""
    sites: list  # List of {name, url} dicts
    max_pages: int = 20
    render_js: bool = False


class CompetitiveAnalysisResponse(BaseModel):
    """Response from competitive analysis"""
    sites: list
    gaps: list
    strengths: list
    opportunities: list
    summary: Dict


class BatchAnalysisRequest(BaseModel):
    """Request for batch URL analysis"""
    urls: list  # List of URLs to analyze
    analysis_type: str = 'standard'  # 'standard' or 'ai'
    max_pages: int = 20
    render_js: bool = False


class BatchJobStatusResponse(BaseModel):
    """Response with batch job status"""
    job_id: str
    status: str
    total_urls: int
    completed_urls: int
    failed_urls: int
    progress_percent: float
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None


class BatchResultsResponse(BaseModel):
    """Response with batch analysis results"""
    job_id: str
    results: list  # List of BatchResult dicts
    summary: Dict


@router.post("/analyze", response_model=WebsiteAnalysisResponse)
async def analyze_website(request: WebsiteAnalysisRequest):
    """
    Analyze a website's narrative structure

    Accepts either:
    - Local file path (e.g., /path/to/website)
    - URL (e.g., https://example.com)

    Extracts:
    - Value propositions and claims
    - Proof points (stats, testimonials)
    - Customer personas
    - Narrative units (problem → solution → proof)
    - Messaging consistency

    Results are cached for 24 hours. Use force_refresh=true to bypass cache.
    """

    cache_service = get_cache_service()
    history_service = get_history_service()
    is_url = request.path.startswith(('http://', 'https://'))

    # Check cache first (unless force_refresh)
    if not request.force_refresh:
        cached_result = cache_service.get_cached_result(
            request.path,
            'standard',
            max_pages=request.max_pages,
            render_js=request.render_js
        )

        if cached_result:
            print(f"💾 Cache hit for {request.path}")
            markdown_report = None
            if request.generate_report:
                generator = ReportGenerator(cached_result)
                markdown_report = generator.generate_markdown()

            return WebsiteAnalysisResponse(
                summary=cached_result['summary'],
                claims=cached_result['claims'],
                proof=cached_result['proof'],
                personas=cached_result['personas'],
                stats=cached_result['stats'],
                narrative_units=cached_result['narrative_units'],
                markdown_report=markdown_report,
                cache_metadata=cached_result.get('_cache_metadata')
            )

    # Not in cache or force refresh - run analysis
    fetcher = None
    website_path = None

    try:
        if is_url:
            # Fetch website from URL
            print(f"🌐 Analyzing URL: {request.path}")

            if request.render_js:
                # Use JavaScript rendering for SPAs
                print(f"  🎭 Using Playwright for JavaScript rendering")
                js_fetcher = JSFetcher(max_pages=request.max_pages, headless=True)
                website_path = js_fetcher.fetch_website_sync(request.path)
                fetcher = js_fetcher  # For cleanup
            else:
                # Standard HTTP fetch
                fetcher = URLFetcher(max_pages=request.max_pages)
                website_path = fetcher.fetch_website(request.path)
        else:
            # Use local path
            website_path = Path(request.path)
            if not website_path.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Website path not found: {request.path}"
                )

        # Run analysis
        analyzer = WebsiteAnalyzer(website_path)
        analysis = analyzer.analyze()

        # Save to cache
        cache_service.save_result(
            request.path,
            'standard',
            analysis,
            max_pages=request.max_pages,
            render_js=request.render_js
        )

        # Save to history
        history_service.save_snapshot(
            request.path,
            'standard',
            analysis,
            max_pages=request.max_pages,
            render_js=request.render_js
        )

        # Generate markdown report if requested
        markdown_report = None
        if request.generate_report:
            generator = ReportGenerator(analysis)
            markdown_report = generator.generate_markdown()

        return WebsiteAnalysisResponse(
            summary=analysis['summary'],
            claims=analysis['claims'],
            proof=analysis['proof'],
            personas=analysis['personas'],
            stats=analysis['stats'],
            narrative_units=analysis['narrative_units'],
            markdown_report=markdown_report,
            cache_metadata=None  # Fresh analysis, no cache metadata
        )

    finally:
        # Clean up temp directory if URL was fetched
        if fetcher:
            fetcher.cleanup()


@router.post("/analyze-ai", response_model=AIAnalysisResponse)
async def analyze_website_ai(request: WebsiteAnalysisRequest):
    """
    AI-Enhanced website narrative analysis

    Uses Claude API to provide deep narrative intelligence:
    - Smart claim extraction with strength scoring
    - Narrative gap identification
    - Tone and voice analysis
    - Value proposition scoring
    - Automated recommendations

    Requires ANTHROPIC_API_KEY environment variable.

    Accepts either:
    - Local file path (e.g., /path/to/website)
    - URL (e.g., https://example.com)

    Results are cached for 24 hours. Use force_refresh=true to bypass cache.
    """

    cache_service = get_cache_service()
    history_service = get_history_service()
    is_url = request.path.startswith(('http://', 'https://'))

    # Check cache first (unless force_refresh)
    if not request.force_refresh:
        cached_result = cache_service.get_cached_result(
            request.path,
            'ai',
            max_pages=request.max_pages,
            render_js=request.render_js
        )

        if cached_result:
            print(f"💾 Cache hit for AI analysis: {request.path}")
            return AIAnalysisResponse(
                ai_claims=cached_result['ai_claims'],
                narrative_gaps=cached_result['narrative_gaps'],
                tone_analysis=cached_result['tone_analysis'],
                value_prop_scores=cached_result['value_prop_scores'],
                recommendations=cached_result['recommendations'],
                overall_narrative_score=cached_result['overall_narrative_score'],
                summary=cached_result['summary'],
                base_analysis=None,
                cache_metadata=cached_result.get('_cache_metadata')
            )

    # Not in cache or force refresh - run analysis
    fetcher = None
    website_path = None

    try:
        if is_url:
            # Fetch website from URL
            print(f"🌐 Analyzing URL: {request.path}")

            if request.render_js:
                # Use JavaScript rendering for SPAs
                print(f"  🎭 Using Playwright for JavaScript rendering")
                js_fetcher = JSFetcher(max_pages=request.max_pages, headless=True)
                website_path = js_fetcher.fetch_website_sync(request.path)
                fetcher = js_fetcher
            else:
                # Standard HTTP fetch
                fetcher = URLFetcher(max_pages=request.max_pages)
                website_path = fetcher.fetch_website(request.path)
        else:
            # Use local path
            website_path = Path(request.path)
            if not website_path.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Website path not found: {request.path}"
                )

        # Run AI-enhanced analysis
        print("🤖 Running AI-enhanced analysis...")
        ai_analyzer = AINavrativeAnalyzer(website_path)
        ai_result = ai_analyzer.analyze()

        # Convert dataclasses to dicts
        result_dict = to_dict(ai_result)

        # Save to cache
        cache_service.save_result(
            request.path,
            'ai',
            result_dict,
            max_pages=request.max_pages,
            render_js=request.render_js
        )

        # Save to history
        history_service.save_snapshot(
            request.path,
            'ai',
            result_dict,
            max_pages=request.max_pages,
            render_js=request.render_js,
            pages_analyzed=result_dict['summary'].get('total_pages', 0)
        )

        # Optionally include base analysis
        base_analysis = None
        if request.generate_report:
            base_analysis = WebsiteAnalysisResponse(
                summary=ai_analyzer.base_analysis['summary'],
                claims=ai_analyzer.base_analysis['claims'],
                proof=ai_analyzer.base_analysis['proof'],
                personas=ai_analyzer.base_analysis['personas'],
                stats=ai_analyzer.base_analysis['stats'],
                narrative_units=ai_analyzer.base_analysis['narrative_units'],
                markdown_report=None
            )

        return AIAnalysisResponse(
            ai_claims=result_dict['ai_claims'],
            narrative_gaps=result_dict['narrative_gaps'],
            tone_analysis=result_dict['tone_analysis'],
            value_prop_scores=result_dict['value_prop_scores'],
            recommendations=result_dict['recommendations'],
            overall_narrative_score=result_dict['overall_narrative_score'],
            summary=result_dict['summary'],
            base_analysis=base_analysis,
            cache_metadata=None  # Fresh analysis
        )

    except RuntimeError as e:
        # Handle missing API key
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )
    finally:
        # Clean up temp directory if URL was fetched
        if fetcher:
            fetcher.cleanup()


@router.post("/compare", response_model=CompetitiveAnalysisResponse)
async def compare_websites(request: CompetitiveAnalysisRequest):
    """
    Competitive Analysis - Compare multiple websites side-by-side

    Analyzes 2-5 websites and compares:
    - Claims and value propositions
    - Proof points and evidence
    - Customer testimonials
    - Messaging consistency

    Returns:
    - Side-by-side comparison data
    - Competitive gaps (what you're missing)
    - Your strengths vs competitors
    - Opportunities for improvement

    Accepts either local paths or URLs for each site.
    First site in list is considered "your site" for gap analysis.
    """

    if not request.sites or len(request.sites) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please provide at least 2 sites to compare"
        )

    if len(request.sites) > 5:
        raise HTTPException(
            status_code=400,
            detail="Maximum 5 sites allowed for comparison"
        )

    print(f"🔍 Starting competitive analysis of {len(request.sites)} sites...")

    try:
        # Run competitive analysis
        analyzer = CompetitiveAnalyzer(
            max_pages=request.max_pages,
            render_js=request.render_js
        )

        result = analyzer.analyze_sites(request.sites)

        # Convert to dict
        result_dict = comp_to_dict(result)

        return CompetitiveAnalysisResponse(
            sites=result_dict['sites'],
            gaps=result_dict['gaps'],
            strengths=result_dict['strengths'],
            opportunities=result_dict['opportunities'],
            summary=result_dict['summary']
        )

    except Exception as e:
        print(f"❌ Competitive analysis error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Competitive analysis failed: {str(e)}"
        )


@router.post("/export-pdf")
async def export_standard_pdf(request: WebsiteAnalysisRequest):
    """
    Export standard website analysis as PDF

    Generates a professional PDF report with:
    - Executive summary
    - Claims and proof points
    - Customer testimonials
    - Visual charts

    Returns PDF file for download.
    """
    # Run analysis (same logic as /analyze)
    is_url = request.path.startswith(('http://', 'https://'))
    fetcher = None
    website_path = None

    try:
        if is_url:
            print(f"🌐 Analyzing URL for PDF export: {request.path}")
            if request.render_js:
                js_fetcher = JSFetcher(max_pages=request.max_pages, headless=True)
                website_path = js_fetcher.fetch_website_sync(request.path)
                fetcher = js_fetcher
            else:
                fetcher = URLFetcher(max_pages=request.max_pages)
                website_path = fetcher.fetch_website(request.path)
        else:
            website_path = Path(request.path)
            if not website_path.exists():
                raise HTTPException(status_code=404, detail=f"Path not found: {request.path}")

        # Run analysis
        analyzer = WebsiteAnalyzer(website_path)
        analysis = analyzer.analyze()

        # Generate PDF
        print("📄 Generating PDF report...")
        pdf_generator = PDFGenerator()
        website_name = request.path if not is_url else request.path.split('//')[-1].split('/')[0]
        pdf_bytes = pdf_generator.generate_standard_report(analysis, website_name)

        # Return PDF as downloadable file
        filename = f"narrative_analysis_{website_name.replace('/', '_').replace(':', '')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    finally:
        if fetcher:
            fetcher.cleanup()


@router.post("/export-ai-pdf")
async def export_ai_pdf(request: WebsiteAnalysisRequest):
    """
    Export AI-enhanced analysis as PDF

    Generates a comprehensive PDF report with:
    - Overall narrative score
    - AI-extracted claims with strength ratings
    - Narrative gaps and recommendations
    - Tone and voice analysis
    - Value proposition scoring

    Requires ANTHROPIC_API_KEY environment variable.
    Returns PDF file for download.
    """
    is_url = request.path.startswith(('http://', 'https://'))
    fetcher = None
    website_path = None

    try:
        if is_url:
            print(f"🌐 Analyzing URL for AI PDF export: {request.path}")
            if request.render_js:
                js_fetcher = JSFetcher(max_pages=request.max_pages, headless=True)
                website_path = js_fetcher.fetch_website_sync(request.path)
                fetcher = js_fetcher
            else:
                fetcher = URLFetcher(max_pages=request.max_pages)
                website_path = fetcher.fetch_website(request.path)
        else:
            website_path = Path(request.path)
            if not website_path.exists():
                raise HTTPException(status_code=404, detail=f"Path not found: {request.path}")

        # Run AI analysis
        print("🤖 Running AI-enhanced analysis...")
        ai_analyzer = AINavrativeAnalyzer(website_path)
        ai_result = ai_analyzer.analyze()

        # Convert to dict
        result_dict = to_dict(ai_result)

        # Generate PDF
        print("📄 Generating AI PDF report...")
        pdf_generator = PDFGenerator()
        website_name = request.path if not is_url else request.path.split('//')[-1].split('/')[0]
        pdf_bytes = pdf_generator.generate_ai_report(result_dict, website_name)

        filename = f"ai_analysis_{website_name.replace('/', '_').replace(':', '')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    finally:
        if fetcher:
            fetcher.cleanup()


@router.post("/export-competitive-pdf")
async def export_competitive_pdf(request: CompetitiveAnalysisRequest):
    """
    Export competitive analysis as PDF

    Generates a landscape-oriented PDF report with:
    - Side-by-side comparison table
    - Visual comparison charts
    - Competitive gaps with priorities
    - Your strengths
    - Actionable opportunities

    Returns PDF file for download.
    """
    if not request.sites or len(request.sites) < 2:
        raise HTTPException(status_code=400, detail="At least 2 sites required")

    if len(request.sites) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 sites allowed")

    try:
        print(f"🔍 Running competitive analysis for PDF export...")

        # Run analysis
        analyzer = CompetitiveAnalyzer(max_pages=request.max_pages, render_js=request.render_js)
        result = analyzer.analyze_sites(request.sites)

        # Convert to dict
        result_dict = comp_to_dict(result)

        # Generate PDF
        print("📄 Generating competitive PDF report...")
        pdf_generator = PDFGenerator()
        pdf_bytes = pdf_generator.generate_competitive_report(result_dict)

        filename = f"competitive_analysis_{len(request.sites)}_sites.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except Exception as e:
        print(f"❌ PDF export error: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


@router.post("/batch/analyze", response_model=BatchJobStatusResponse)
async def start_batch_analysis(request: BatchAnalysisRequest):
    """
    Start batch analysis of multiple URLs

    Accepts 2-100 URLs and analyzes them in parallel.
    Returns job_id for tracking progress.

    Results are cached and saved to historical tracking.
    Use GET /website/batch/status/{job_id} to check progress.
    """
    if not request.urls or len(request.urls) < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 URLs required")

    if len(request.urls) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 URLs allowed")

    batch_analyzer = get_batch_analyzer()

    # Create job
    job_id = batch_analyzer.create_job(request.urls, request.analysis_type)

    # Start analysis in background
    asyncio.create_task(
        batch_analyzer.run_batch_analysis(
            job_id,
            request.urls,
            request.analysis_type,
            request.max_pages,
            request.render_js
        )
    )

    # Return initial status
    status = batch_analyzer.get_job_status(job_id)

    return BatchJobStatusResponse(
        job_id=status.job_id,
        status=status.status,
        total_urls=status.total_urls,
        completed_urls=status.completed_urls,
        failed_urls=status.failed_urls,
        progress_percent=status.progress_percent,
        created_at=status.created_at.isoformat(),
        started_at=status.started_at.isoformat() if status.started_at else None,
        completed_at=status.completed_at.isoformat() if status.completed_at else None,
        error_message=status.error_message
    )


@router.get("/batch/status/{job_id}", response_model=BatchJobStatusResponse)
async def get_batch_status(job_id: str):
    """Get status of a batch analysis job"""
    batch_analyzer = get_batch_analyzer()
    status = batch_analyzer.get_job_status(job_id)

    if not status:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    return BatchJobStatusResponse(
        job_id=status.job_id,
        status=status.status,
        total_urls=status.total_urls,
        completed_urls=status.completed_urls,
        failed_urls=status.failed_urls,
        progress_percent=status.progress_percent,
        created_at=status.created_at.isoformat(),
        started_at=status.started_at.isoformat() if status.started_at else None,
        completed_at=status.completed_at.isoformat() if status.completed_at else None,
        error_message=status.error_message
    )


@router.get("/batch/results/{job_id}", response_model=BatchResultsResponse)
async def get_batch_results(job_id: str):
    """Get results from a completed batch analysis"""
    batch_analyzer = get_batch_analyzer()

    # Check if job exists
    status = batch_analyzer.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    # Get results
    results = batch_analyzer.get_batch_results(job_id)

    # Convert BatchResult objects to dicts
    results_dicts = []
    for r in results:
        results_dicts.append({
            'url': r.url,
            'status': r.status,
            'total_claims': r.total_claims,
            'total_proof': r.total_proof,
            'total_personas': r.total_personas,
            'proof_ratio': r.proof_ratio,
            'overall_score': r.overall_score,
            'cached': r.cached,
            'analyzed_at': r.analyzed_at.isoformat(),
            'error_message': r.error_message
        })

    # Calculate summary
    successful = [r for r in results if r.status == 'success']
    summary = {
        'total_urls': len(results),
        'successful': len(successful),
        'failed': len([r for r in results if r.status == 'failed']),
        'from_cache': len([r for r in results if r.cached]),
        'avg_claims': sum(r.total_claims for r in successful) / len(successful) if successful else 0,
        'avg_proof': sum(r.total_proof for r in successful) / len(successful) if successful else 0,
        'avg_score': sum(r.overall_score for r in successful) / len(successful) if successful else 0
    }

    return BatchResultsResponse(
        job_id=job_id,
        results=results_dicts,
        summary=summary
    )


@router.get("/batch/export-csv/{job_id}")
async def export_batch_csv(job_id: str):
    """Export batch results as CSV"""
    batch_analyzer = get_batch_analyzer()

    # Check if job exists
    status = batch_analyzer.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    # Generate CSV
    csv_content = batch_analyzer.export_results_csv(job_id)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="batch_results_{job_id}.csv"'}
    )


@router.get("/history/recent")
async def get_recent_analyses(limit: int = 20):
    """Get list of recently analyzed websites"""
    history_service = get_history_service()
    recent = history_service.get_recent_analyses(limit)
    return {"recent_analyses": recent}


@router.get("/history/snapshots/{url:path}")
async def get_url_snapshots(url: str, analysis_type: str = 'standard', limit: int = 30):
    """Get historical snapshots for a URL"""
    history_service = get_history_service()
    snapshots = history_service.get_snapshots(url, analysis_type, limit)

    # Convert to dicts
    snapshots_dicts = []
    for snap in snapshots:
        snapshots_dicts.append({
            'id': snap.id,
            'url': snap.url,
            'snapshot_date': snap.snapshot_date.isoformat(),
            'total_claims': snap.total_claims,
            'total_proof': snap.total_proof,
            'total_personas': snap.total_personas,
            'proof_ratio': snap.proof_ratio,
            'consistency_score': snap.consistency_score,
            'overall_score': snap.overall_score
        })

    return {"snapshots": snapshots_dicts}


@router.get("/history/trends/{url:path}")
async def get_url_trends(url: str, analysis_type: str = 'standard', days: int = 30):
    """Get trend analysis for a URL"""
    history_service = get_history_service()
    trends = history_service.analyze_trends(url, analysis_type, days)

    if not trends:
        raise HTTPException(
            status_code=404,
            detail=f"Not enough historical data for {url}. Need at least 2 snapshots."
        )

    # Convert snapshots to dicts
    snapshots_dicts = []
    for snap in trends.snapshots:
        snapshots_dicts.append({
            'id': snap.id,
            'url': snap.url,
            'snapshot_date': snap.snapshot_date.isoformat(),
            'total_claims': snap.total_claims,
            'total_proof': snap.total_proof,
            'total_personas': snap.total_personas,
            'proof_ratio': snap.proof_ratio,
            'consistency_score': snap.consistency_score,
            'overall_score': snap.overall_score
        })

    return {
        "url": trends.url,
        "snapshots": snapshots_dicts,
        "total_snapshots": trends.total_snapshots,
        "date_range_days": trends.date_range_days,
        "claims_trend": trends.claims_trend,
        "proof_trend": trends.proof_trend,
        "score_trend": trends.score_trend,
        "claims_change": trends.claims_change,
        "proof_change": trends.proof_change,
        "score_change": trends.score_change,
        "insights": trends.insights
    }


@router.get("/health")
async def health_check():
    """Health check for website analysis service"""
    cache_service = get_cache_service()
    cache_stats = cache_service.get_cache_stats()

    return {
        "status": "healthy",
        "service": "website_analysis",
        "capabilities": [
            "narrative_extraction",
            "claim_detection",
            "proof_validation",
            "persona_identification",
            "report_generation",
            "ai_enhanced_analysis",
            "competitive_analysis",
            "pdf_export",
            "batch_analysis",
            "result_caching",
            "historical_tracking",
            "trend_analysis"
        ],
        "cache": cache_stats
    }
