"""
Principal Narrative API - FastAPI Application

Provides the Shared Context API for autonomous agents to:
- Query narrative units
- Validate claims against proof and constraints
- Get coherence scores and drift events
"""
import logging
import time
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional
from pathlib import Path

from .config import settings
from .logging_config import setup_logging, get_logger
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
from .webhooks import router as webhooks_router
from .auth.routes import router as auth_router
from .websocket import ws_router
from .routes.website_routes import router as website_router


# Initialize logging
setup_logging(log_level="INFO", log_file="logs/narrative-api.log")
logger = get_logger("main")

# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="""
    The Principal Narrative Shared Context API enables autonomous agents to:

    - **Query** narrative units (strategy, messaging, naming, proof, etc.)
    - **Validate** claims against proof metrics and constraints
    - **Monitor** coherence scores and drift events

    This API ensures all agents operate from a single source of narrative truth.
    """,
    docs_url="/docs",
    redoc_url="/redoc",
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests and their response times."""
    start_time = time.time()

    # Log request
    logger.info(f"Request: {request.method} {request.url.path}")

    try:
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Log response
        logger.info(
            f"Response: {request.method} {request.url.path} - "
            f"Status: {response.status_code} - Duration: {duration:.3f}s"
        )

        return response
    except Exception as e:
        duration = time.time() - start_time
        logger.error(
            f"Request failed: {request.method} {request.url.path} - "
            f"Error: {str(e)} - Duration: {duration:.3f}s",
            exc_info=True
        )
        raise


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(webhooks_router)
app.include_router(auth_router)
app.include_router(ws_router)
app.include_router(website_router)

# Initialize services
narrative_service = NarrativeService()
validator_service = ValidatorService(narrative_service)
coherence_service = CoherenceService(narrative_service)


# Application lifecycle events
@app.on_event("startup")
async def startup_event():
    """Log application startup."""
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Narrative base path: {settings.narrative_base_path}")
    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Log application shutdown."""
    logger.info("Shutting down Principal Narrative API")


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
            "/ws",
            "/ws/status",
            "/auth/login",
            "/auth/me",
            "/auth/keys",
            "/context/query",
            "/context/validate",
            "/coherence",
            "/coherence/scan",
            "/proof/metrics",
            "/search",
            "/synthesize",
            "/ingest/text",
            "/agents/register",
            "/agents/context",
            "/git/status",
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


@app.get("/dashboard")
async def dashboard():
    """Serve the website narrative analysis dashboard."""
    from pathlib import Path
    dashboard_path = Path(__file__).parent.parent / "static" / "website-dashboard.html"
    if not dashboard_path.exists():
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return FileResponse(dashboard_path)


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
    """Serve the Principal Narrative dashboard."""
    dashboard_path = static_path / "dashboard.html"
    if dashboard_path.exists():
        return FileResponse(dashboard_path)
    raise HTTPException(status_code=404, detail="Dashboard not found")


# ============================================================================
# Synthesis Endpoints
# ============================================================================

from .services import (
    get_llm_service, ContextSynthesizer,
    get_vector_store, get_ingestion_service,
    get_git_manager, get_agent_coordinator
)
from .services.agent_coordinator import AgentType
from .services.synthesizer import SynthesisRequest


@app.post("/synthesize")
async def synthesize_context(
    text: str = Query(..., description="Raw text to synthesize"),
    source: str = Query("manual", description="Source of text (slack, github, manual)"),
    target_layer: Optional[str] = Query(None, description="Target layer (strategy, messaging, etc.)"),
    save: bool = Query(False, description="Save generated documents")
):
    """
    Synthesize narrative documents from raw text.

    Uses LLM to extract context and generate properly formatted narrative documents.
    """
    synthesizer = ContextSynthesizer()
    request = SynthesisRequest(
        raw_text=text,
        source=source,
        target_layer=target_layer
    )

    if save:
        outputs = synthesizer.process(request)
        saved_paths = []
        for output in outputs:
            path = synthesizer.save_document(output)
            saved_paths.append(str(path))
        return {
            "generated": len(outputs),
            "saved_paths": saved_paths
        }
    else:
        preview = synthesizer.preview(request)
        return preview


@app.get("/synthesize/status")
async def synthesize_status():
    """Check if LLM synthesis is available."""
    llm = get_llm_service()
    return {
        "llm_available": llm.is_available,
        "model": llm.model if llm.is_available else None
    }


# ============================================================================
# Vector Search Endpoints
# ============================================================================

@app.get("/search")
async def semantic_search(
    q: str = Query(..., description="Search query"),
    layer: Optional[str] = Query(None, description="Filter by layer"),
    limit: int = Query(5, description="Max results")
):
    """
    Semantic search across narrative documents.

    Returns documents ranked by relevance to the query.
    """
    store = get_vector_store()

    if not store.is_available:
        raise HTTPException(status_code=503, detail="Vector store not available")

    results = store.search(query=q, n_results=limit, layer=layer)

    return {
        "query": q,
        "results": [
            {
                "path": r.path,
                "score": r.score,
                "content": r.content[:500] + "..." if len(r.content) > 500 else r.content,
                "metadata": r.metadata
            }
            for r in results
        ],
        "total": len(results)
    }


@app.post("/search/index")
async def index_documents():
    """
    Index all narrative documents for semantic search.

    Run this after adding new documents to enable search.
    """
    store = get_vector_store()

    if not store.is_available:
        raise HTTPException(status_code=503, detail="Vector store not available")

    count = store.index_narrative_layer()

    return {
        "indexed": count,
        "message": f"Indexed {count} documents"
    }


@app.get("/search/stats")
async def search_stats():
    """Get vector store statistics."""
    store = get_vector_store()
    return store.get_stats()


# ============================================================================
# Ingestion Endpoints
# ============================================================================

@app.post("/ingest/text")
async def ingest_text(
    text: str = Query(..., description="Text to ingest"),
    source: str = Query("manual", description="Source description"),
    process: bool = Query(True, description="Process through synthesizer"),
    save: bool = Query(False, description="Save generated documents")
):
    """
    Ingest raw text and optionally synthesize documents.

    Use this to manually add context from meetings, notes, etc.
    """
    service = get_ingestion_service()
    item = service.ingest_text(text, source)

    if process:
        result = service.process_items([item], auto_save=save)
        return {
            "ingested": 1,
            "processed": result.items_processed,
            "documents_generated": result.documents_generated,
            "errors": result.errors
        }

    return {"ingested": 1, "processed": False}


@app.post("/ingest/slack/channel")
async def ingest_slack_channel(
    channel_id: str = Query(..., description="Slack channel ID"),
    limit: int = Query(50, description="Max messages to fetch"),
    process: bool = Query(True, description="Process through synthesizer")
):
    """
    Ingest context-relevant messages from a Slack channel.

    Requires SLACK_BOT_TOKEN environment variable.
    """
    service = get_ingestion_service()

    if not service.slack_client:
        raise HTTPException(status_code=503, detail="Slack not configured. Set SLACK_BOT_TOKEN.")

    items = service.fetch_slack_channel(channel_id, limit)

    if process and items:
        result = service.process_items(items)
        return {
            "messages_found": len(items),
            "documents_generated": result.documents_generated,
            "errors": result.errors
        }

    return {
        "messages_found": len(items),
        "items": [
            {"content": item.content[:200], "timestamp": item.timestamp.isoformat()}
            for item in items
        ]
    }


@app.post("/ingest/github/issue")
async def ingest_github_issue(
    repo: str = Query(..., description="Repository (owner/repo)"),
    issue_number: int = Query(..., description="Issue number"),
    process: bool = Query(True, description="Process through synthesizer")
):
    """
    Ingest a GitHub issue with comments.

    Requires GITHUB_TOKEN environment variable.
    """
    service = get_ingestion_service()

    if not service.github_client:
        raise HTTPException(status_code=503, detail="GitHub not configured. Set GITHUB_TOKEN.")

    item = service.fetch_github_issue(repo, issue_number)

    if not item:
        raise HTTPException(status_code=404, detail="Issue not found")

    if process:
        result = service.process_items([item])
        return {
            "issue": f"{repo}#{issue_number}",
            "documents_generated": result.documents_generated
        }

    return {
        "issue": f"{repo}#{issue_number}",
        "content_preview": item.content[:500],
        "metadata": item.metadata
    }


# ============================================================================
# Agent Coordination Endpoints
# ============================================================================

@app.post("/agents/register")
async def register_agent(
    agent_type: str = Query(..., description="Agent type (coding, comms, planning, etc.)"),
    name: str = Query(..., description="Agent name"),
    capabilities: str = Query("", description="Comma-separated capabilities")
):
    """
    Register an agent with the coordinator.

    Returns an agent_id for subsequent requests.
    """
    coordinator = get_agent_coordinator()

    try:
        agent_type_enum = AgentType(agent_type)
    except ValueError:
        agent_type_enum = AgentType.CUSTOM

    caps = [c.strip() for c in capabilities.split(",") if c.strip()]

    registration = coordinator.register_agent(
        agent_type=agent_type_enum,
        name=name,
        capabilities=caps
    )

    return {
        "agent_id": registration.agent_id,
        "name": registration.name,
        "type": registration.agent_type.value,
        "registered_at": registration.registered_at.isoformat()
    }


@app.get("/agents/context")
async def get_agent_context(
    agent_id: str = Query(..., description="Registered agent ID"),
    query: str = Query(..., description="Context query"),
    layers: str = Query("strategy,messaging", description="Comma-separated layers")
):
    """
    Get context for an agent task.

    Returns relevant documents, constraints, and guidance.
    """
    coordinator = get_agent_coordinator()

    from .services.agent_coordinator import ContextRequest
    request = ContextRequest(
        agent_id=agent_id,
        query=query,
        layers=[l.strip() for l in layers.split(",")],
        include_proof=True,
        semantic_search=True
    )

    response = coordinator.request_context(request)

    return {
        "request_id": response.request_id,
        "documents": len(response.documents),
        "semantic_matches": len(response.semantic_matches),
        "coherence_score": response.coherence_score,
        "voice_guidance": response.voice_guidance[:500] if response.voice_guidance else None,
        "warnings": response.warnings
    }


@app.post("/agents/validate")
async def validate_agent_output(
    agent_id: str = Query(..., description="Agent ID"),
    output_type: str = Query(..., description="Output type (code, copy, design)"),
    content: str = Query(..., description="Content to validate")
):
    """
    Validate agent output against narrative context.

    Checks for forbidden terms, proof backing, coherence.
    """
    coordinator = get_agent_coordinator()

    from .services.agent_coordinator import ValidationRequest
    request = ValidationRequest(
        agent_id=agent_id,
        output_type=output_type,
        content=content,
        context_used=[]
    )

    response = coordinator.validate_output(request)

    return {
        "valid": response.valid,
        "approved": response.approved,
        "coherence_score": response.coherence_score,
        "issues": response.issues,
        "suggestions": response.suggestions
    }


@app.get("/agents/list")
async def list_agents():
    """List all registered agents."""
    coordinator = get_agent_coordinator()
    active = coordinator.get_active_agents(timeout_minutes=60)

    return {
        "total_registered": len(coordinator.registered_agents),
        "active": len(active),
        "agents": [
            {
                "agent_id": a.agent_id,
                "name": a.name,
                "type": a.agent_type.value,
                "capabilities": a.capabilities,
                "last_seen": a.last_seen.isoformat()
            }
            for a in active
        ]
    }


# ============================================================================
# Git Management Endpoints
# ============================================================================

@app.get("/git/status")
async def git_status():
    """Get git repository status."""
    manager = get_git_manager()

    if not manager.is_git_repo():
        return {"is_repo": False}

    return {
        "is_repo": True,
        "branch": manager.get_current_branch(),
        "has_changes": manager.has_changes(),
        "changed_files": manager.get_changed_files(),
        "pending_queue": manager.get_queue_summary()
    }


@app.get("/git/history")
async def git_history(limit: int = Query(10, description="Number of commits")):
    """Get recent commit history."""
    manager = get_git_manager()
    return {
        "commits": manager.get_recent_commits(limit)
    }


@app.post("/git/commit")
async def git_commit(
    message: Optional[str] = Query(None, description="Custom commit message")
):
    """
    Commit pending changes to the narrative layer.

    Auto-generates commit message if not provided.
    """
    manager = get_git_manager()

    if not manager.pending_changes and not manager.has_changes():
        return {"success": False, "message": "No changes to commit"}

    # If there are unstaged changes, stage them
    if manager.has_changes():
        for file in manager.get_changed_files():
            from .services.git_manager import ChangeType
            manager.queue_change(
                path=manager.repo_path / file,
                change_type=ChangeType.UPDATE,
                description="Manual commit"
            )

    result = manager.commit_pending(message)

    return {
        "success": result.success,
        "commit_hash": result.commit_hash,
        "message": result.message,
        "files_changed": result.files_changed
    }


# ============================================================================
# Evolution Tracking Endpoints
# ============================================================================

from .services import get_evolution_tracker


@app.get("/evolution/timeline/{unit_path:path}")
async def get_evolution_timeline(unit_path: str):
    """
    Get evolution timeline for a narrative unit.

    Shows version history and all changes.
    """
    tracker = get_evolution_tracker()
    timeline = tracker.get_timeline(unit_path)

    if not timeline:
        return {"unit_path": unit_path, "exists": False, "events": []}

    return {
        "unit_path": timeline.unit_path,
        "first_created": timeline.first_created.isoformat(),
        "last_modified": timeline.last_modified.isoformat(),
        "total_revisions": timeline.total_revisions,
        "authors": timeline.primary_authors,
        "events": [
            {
                "id": e.id,
                "change_type": e.change_type.value,
                "trigger": e.trigger.value,
                "timestamp": e.timestamp.isoformat(),
                "description": e.description,
                "author": e.author
            }
            for e in timeline.events
        ]
    }


@app.get("/evolution/recent")
async def get_recent_evolution(
    limit: int = Query(50, description="Max events to return"),
    days: int = Query(None, description="Only events from last N days"),
    trigger: Optional[str] = Query(None, description="Filter by trigger type")
):
    """
    Get recent evolution events across all units.
    """
    tracker = get_evolution_tracker()

    since = None
    if days:
        from datetime import timedelta
        since = datetime.utcnow() - timedelta(days=days)

    from .services.evolution import EvolutionTrigger
    trigger_enum = None
    if trigger:
        try:
            trigger_enum = EvolutionTrigger(trigger)
        except ValueError:
            pass

    events = tracker.get_recent_events(
        limit=limit,
        since=since,
        trigger=trigger_enum
    )

    return {
        "events": [
            {
                "id": e.id,
                "unit_path": e.unit_path,
                "change_type": e.change_type.value,
                "trigger": e.trigger.value,
                "timestamp": e.timestamp.isoformat(),
                "description": e.description,
                "author": e.author
            }
            for e in events
        ],
        "total": len(events)
    }


@app.get("/evolution/lineage/{unit_path:path}")
async def get_unit_lineage(unit_path: str):
    """
    Get lineage/provenance for a narrative unit.

    Shows the chain of changes and related units.
    """
    tracker = get_evolution_tracker()
    return tracker.get_lineage(unit_path)


@app.get("/evolution/shifts/{unit_path:path}")
async def get_semantic_shifts(
    unit_path: str,
    threshold: float = Query(0.3, description="Minimum shift magnitude")
):
    """
    Detect semantic shifts in a unit's history.
    """
    tracker = get_evolution_tracker()
    shifts = tracker.detect_semantic_shifts(unit_path, threshold)

    return {
        "unit_path": unit_path,
        "shifts": [
            {
                "before_summary": s.before_summary,
                "after_summary": s.after_summary,
                "shift_magnitude": s.shift_magnitude,
                "shift_type": s.shift_type,
                "detected_at": s.detected_at.isoformat()
            }
            for s in shifts
        ],
        "total": len(shifts)
    }


@app.get("/evolution/activity")
async def get_evolution_activity(
    days: int = Query(7, description="Number of days to summarize")
):
    """
    Get summary of evolution activity.
    """
    tracker = get_evolution_tracker()
    return tracker.get_activity_summary(days)


# ============================================================================
# Run with: uvicorn src.main:app --reload
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
