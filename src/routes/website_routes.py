"""
Website Analysis API Routes

Endpoints for analyzing website narrative structure
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from pathlib import Path
from typing import Optional, Dict
import tempfile
import subprocess

from src.services.website_analyzer import WebsiteAnalyzer
from src.services.report_generator import ReportGenerator

router = APIRouter(prefix="/website", tags=["Website Analysis"])


class WebsiteAnalysisRequest(BaseModel):
    """Request to analyze a website"""
    path: str  # Local file path or URL
    generate_report: bool = True


class WebsiteAnalysisResponse(BaseModel):
    """Response from website analysis"""
    summary: Dict
    claims: list
    proof: list
    personas: list
    stats: Dict
    narrative_units: list
    markdown_report: Optional[str] = None


@router.post("/analyze", response_model=WebsiteAnalysisResponse)
async def analyze_website(request: WebsiteAnalysisRequest):
    """
    Analyze a website's narrative structure

    Extracts:
    - Value propositions and claims
    - Proof points (stats, testimonials)
    - Customer personas
    - Narrative units (problem → solution → proof)
    - Messaging consistency
    """

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
            "report_generation"
        ]
    }
