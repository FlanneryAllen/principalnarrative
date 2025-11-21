"""
Narrative Agent API - FastAPI Application

Provides the Shared Context API for autonomous agents to:
- Query narrative units
- Validate claims against proof and constraints
- Get coherence scores and drift events
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional
from pathlib import Path

from .config import settings
from .models import (
    APIInfo,
    QueryRequest,
    QueryResponse,
    ValidateRequest,
    ValidationResult,
    CoherenceResponse,
    UpdateRequest,
    UpdateResponse,
    NarrativeType,
    DriftType,
    DriftSeverity,
    DriftStatus,
)
from .services import NarrativeService, ValidatorService, CoherenceService, DriftDetector


# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="""
    The Narrative Agent Shared Context API enables autonomous agents to:

    - **Query** narrative units (strategy, messaging, naming, proof, etc.)
    - **Validate** claims against proof metrics and constraints
    - **Monitor** coherence scores and drift events

    This API ensures all agents operate from a single source of narrative truth.
    """,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
narrative_service = NarrativeService()
validator_service = ValidatorService(narrative_service)
coherence_service = CoherenceService(narrative_service)


# ============================================================================
# Root & Info Endpoints
# ============================================================================

@app.get("/", response_model=APIInfo)
async def root():
    """Get API information and available endpoints."""
    return APIInfo(
        name=settings.app_name,
        version=settings.app_version,
        description="Shared Context API for narrative intelligence",
        endpoints=[
            "/context/query",
            "/context/validate",
            "/context/unit/{file_path}",
            "/coherence",
            "/coherence/drift",
            "/proof/metrics",
        ]
    )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "narrative_path": str(settings.narrative_base_path),
        "narrative_exists": settings.narrative_base_path.exists()
    }


# ============================================================================
# Context Query Endpoints
# ============================================================================

@app.get("/context/query", response_model=QueryResponse)
async def query_context(
    type: Optional[NarrativeType] = Query(None, description="Filter by narrative type"),
    subtype: Optional[str] = Query(None, description="Filter by subtype"),
    tags: Optional[str] = Query(None, description="Comma-separated tags to filter by"),
    search: Optional[str] = Query(None, description="Full-text search in content"),
    status: Optional[str] = Query(None, description="Filter by status (active, draft, etc.)"),
    include_content: bool = Query(True, description="Include full content in response")
):
    """
    Query narrative units from the Applied Narrative layer.

    Returns narrative units matching the specified filters. Use this to:
    - Get all messaging pillars: `?type=messaging&subtype=pillars`
    - Search for terms: `?search=security`
    - Get active strategy: `?type=strategy&status=active`
    """
    # Parse tags from comma-separated string
    tag_list = [t.strip() for t in tags.split(",")] if tags else None

    request = QueryRequest(
        type=type,
        subtype=subtype,
        tags=tag_list,
        search=search,
        status=status
    )

    units = narrative_service.query(request)

    # Optionally strip content for lighter response
    if not include_content:
        for unit in units:
            unit.content = None

    return QueryResponse(
        units=units,
        total=len(units),
        query=request
    )


@app.post("/context/query", response_model=QueryResponse)
async def query_context_post(request: QueryRequest):
    """
    Query narrative units (POST version for complex queries).

    Same as GET but allows more complex query structures.
    """
    units = narrative_service.query(request)

    return QueryResponse(
        units=units,
        total=len(units),
        query=request
    )


@app.get("/context/unit/{file_path:path}")
async def get_unit(file_path: str):
    """
    Get a specific narrative unit by file path.

    Example: `/context/unit/messaging/pillars.md`
    """
    unit = narrative_service.get_unit_by_path(file_path)

    if not unit:
        raise HTTPException(status_code=404, detail=f"Narrative unit not found: {file_path}")

    return unit


# ============================================================================
# Validation Endpoint
# ============================================================================

@app.post("/context/validate", response_model=ValidationResult)
async def validate_claim(request: ValidateRequest):
    """
    Validate a claim against the narrative layer.

    Checks the claim for:
    - **Forbidden terms**: Words/phrases that violate naming conventions
    - **Proof backing**: Numeric claims that need verified metrics
    - **Feature accuracy**: Claims about features that don't match registry
    - **Messaging alignment**: Violations of voice/tone guidelines

    Returns validation result with issues, suggestions, and confidence score.

    Example request:
    ```json
    {
        "claim": "CodePilot delivers 3x faster reviews",
        "require_proof": true
    }
    ```
    """
    result = validator_service.validate(request)
    return result


@app.get("/context/validate")
async def validate_claim_quick(
    claim: str = Query(..., description="The claim to validate"),
    require_proof: bool = Query(True, description="Require proof backing for numeric claims")
):
    """
    Quick claim validation via GET request.

    Simpler interface for quick validation checks.
    """
    request = ValidateRequest(claim=claim, require_proof=require_proof)
    return validator_service.validate(request)


# ============================================================================
# Coherence Endpoints
# ============================================================================

@app.get("/coherence", response_model=CoherenceResponse)
async def get_coherence():
    """
    Get current coherence state.

    Returns:
    - **score**: Overall coherence (0-1) with dimensional breakdown
    - **drift_events**: All detected drift events
    - **health_summary**: Per-layer health status
    - **alerts**: Active alerts and warnings
    """
    return coherence_service.get_coherence()


@app.get("/coherence/score")
async def get_coherence_score():
    """Get just the coherence score (lightweight endpoint)."""
    coherence = coherence_service.get_coherence()
    return coherence.score


@app.get("/coherence/drift")
async def get_drift_events(
    status: Optional[DriftStatus] = Query(None, description="Filter by status"),
    type: Optional[DriftType] = Query(None, description="Filter by drift type"),
    severity: Optional[DriftSeverity] = Query(None, description="Filter by severity")
):
    """
    Get drift events with optional filters.

    Examples:
    - Get open drifts: `?status=open`
    - Get high severity: `?severity=high`
    - Get proof drifts: `?type=proof`
    """
    events = coherence_service.get_drift_events(
        status=status,
        drift_type=type,
        severity=severity
    )
    return {
        "drift_events": events,
        "total": len(events),
        "open_count": coherence_service.get_open_drift_count()
    }


@app.post("/coherence/compute")
async def compute_coherence():
    """
    Compute fresh coherence score by analyzing all layers.

    This performs a full analysis of the narrative layer and returns
    updated coherence scores. Use sparingly as it's computationally intensive.
    """
    score = coherence_service.compute_coherence()
    return {
        "score": score,
        "computed_at": score.timestamp.isoformat(),
        "message": "Coherence computed successfully"
    }


@app.post("/coherence/scan")
async def run_drift_scan(
    save: bool = Query(False, description="Save results to coherence/current.json"),
    min_severity: Optional[DriftSeverity] = Query(None, description="Filter by minimum severity")
):
    """
    Run a full drift detection scan across all narrative layers.

    Detects 7 types of drift:
    - **Naming**: Forbidden terminology usage
    - **Proof**: Claims without verified metrics
    - **Promise-Delivery**: Marketing claims for unshipped features
    - **Opportunity-Silence**: Shipped features not being marketed
    - **Messaging**: Voice/tone guideline violations
    - **Semantic**: Stale or contradictory content
    - **Strategic**: Misalignment with strategy

    Returns all detected drift events with suggested resolutions.
    """
    detector = DriftDetector(narrative_service)
    events = detector.run_full_scan()

    # Filter by severity if specified
    if min_severity:
        severity_order = [DriftSeverity.LOW, DriftSeverity.MEDIUM, DriftSeverity.HIGH, DriftSeverity.CRITICAL]
        min_index = severity_order.index(min_severity)
        events = [e for e in events if severity_order.index(e.severity) >= min_index]

    # Save if requested
    if save:
        detector.detected_drifts = events
        detector.save_results()

    # Group by severity for summary
    by_severity = {}
    for e in events:
        by_severity[e.severity.value] = by_severity.get(e.severity.value, 0) + 1

    # Group by type
    by_type = {}
    for e in events:
        by_type[e.type.value] = by_type.get(e.type.value, 0) + 1

    return {
        "total": len(events),
        "by_severity": by_severity,
        "by_type": by_type,
        "events": [
            {
                "id": e.id,
                "type": e.type.value,
                "severity": e.severity.value,
                "source": e.source_unit,
                "target": e.target_unit,
                "description": e.description,
                "resolution": e.suggested_resolution
            }
            for e in events
        ],
        "saved": save
    }


# ============================================================================
# Proof Endpoints
# ============================================================================

@app.get("/proof/metrics")
async def get_proof_metrics(
    verified_only: bool = Query(False, description="Only return verified metrics"),
    category: Optional[str] = Query(None, description="Filter by category")
):
    """
    Get all proof metrics from the proof layer.

    Use this to find metrics for backing claims.
    """
    metrics = narrative_service.get_proof_metrics()

    if verified_only:
        metrics = [m for m in metrics if m.get('verified', False)]

    if category:
        metrics = [m for m in metrics if m.get('category', '').lower() == category.lower()]

    return {
        "metrics": metrics,
        "total": len(metrics),
        "verified_count": sum(1 for m in metrics if m.get('verified', False))
    }


@app.get("/proof/metrics/{metric_id}")
async def get_proof_metric(metric_id: str):
    """Get a specific proof metric by ID."""
    metrics = narrative_service.get_proof_metrics()

    for metric in metrics:
        if metric.get('id') == metric_id:
            return metric

    raise HTTPException(status_code=404, detail=f"Metric not found: {metric_id}")


# ============================================================================
# Feature Registry Endpoints
# ============================================================================

@app.get("/features")
async def get_features(
    status: Optional[str] = Query(None, description="Filter by status (Shipped, Beta, Planned)")
):
    """Get feature registry with optional status filter."""
    features = narrative_service.get_feature_registry()

    if status:
        features = [f for f in features if f.get('status', '').lower() == status.lower()]

    return {
        "features": features,
        "total": len(features)
    }


# ============================================================================
# Naming Endpoints
# ============================================================================

@app.get("/naming/forbidden")
async def get_forbidden_terms():
    """Get list of forbidden terms from naming layer."""
    terms = narrative_service.get_forbidden_terms()
    return {
        "forbidden_terms": terms,
        "total": len(terms)
    }


@app.get("/naming/check")
async def check_naming(text: str = Query(..., description="Text to check for naming violations")):
    """Quick check for naming violations in text."""
    forbidden = narrative_service.get_forbidden_terms()
    violations = []

    text_lower = text.lower()
    for term_info in forbidden:
        term = term_info.get('term', '').lower()
        if term and term in text_lower:
            violations.append({
                "term": term_info.get('term'),
                "reason": term_info.get('reason'),
                "alternative": term_info.get('alternative')
            })

    return {
        "text": text,
        "valid": len(violations) == 0,
        "violations": violations
    }


# ============================================================================
# Static Files & Dashboard
# ============================================================================

# Mount static files
static_path = Path(__file__).parent.parent / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


@app.get("/dashboard")
async def dashboard():
    """Serve the Narrative Agent dashboard."""
    dashboard_path = static_path / "dashboard.html"
    if dashboard_path.exists():
        return FileResponse(dashboard_path)
    raise HTTPException(status_code=404, detail="Dashboard not found")


# ============================================================================
# Run with: uvicorn src.main:app --reload
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
