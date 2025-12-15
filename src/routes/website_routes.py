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

router = APIRouter(prefix="/website", tags=["Website Analysis"])


class WebsiteAnalysisRequest(BaseModel):
    """Request to analyze a website"""
    path: str  # Local file path or URL
    generate_report: bool = True
    max_pages: int = 20  # Max pages to download for URLs
    render_js: bool = False  # Use JavaScript rendering (Playwright)


class WebsiteAnalysisResponse(BaseModel):
    """Response from website analysis"""
    summary: Dict
    claims: list
    proof: list
    personas: list
    stats: Dict
    narrative_units: list
    markdown_report: Optional[str] = None


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
    """

    # Check if path is a URL or local path
    is_url = request.path.startswith(('http://', 'https://'))
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
            markdown_report=markdown_report
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
    """

    # Check if path is a URL or local path
    is_url = request.path.startswith(('http://', 'https://'))
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
            base_analysis=base_analysis
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


@router.get("/health")
async def health_check():
    """Health check for website analysis service"""
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
            "pdf_export"
        ]
    }
