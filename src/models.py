"""
Pydantic models for the Narrative Agent API.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field


# ============================================================================
# Enums
# ============================================================================

class NarrativeType(str, Enum):
    """Types of narrative layers."""
    STRATEGY = "strategy"
    MESSAGING = "messaging"
    NAMING = "naming"
    MARKETING = "marketing"
    PROOF = "proof"
    STORY = "story"
    CONSTRAINTS = "constraints"
    DEFINITIONS = "definitions"
    COHERENCE = "coherence"


class DriftType(str, Enum):
    """Types of narrative drift."""
    SEMANTIC = "semantic"
    STRATEGIC = "strategic"
    MESSAGING = "messaging"
    NAMING = "naming"
    PROOF = "proof"
    PROMISE_DELIVERY = "promise-delivery"
    OPPORTUNITY_SILENCE = "opportunity-silence"


class DriftSeverity(str, Enum):
    """Severity levels for drift events."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DriftStatus(str, Enum):
    """Status of a drift event."""
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    IGNORED = "ignored"


class HealthStatus(str, Enum):
    """Health status for a narrative layer."""
    HEALTHY = "healthy"
    WARNING = "warning"
    STALE = "stale"
    CRITICAL = "critical"
    UNINITIALIZED = "uninitialized"


# ============================================================================
# Request Models
# ============================================================================

class QueryRequest(BaseModel):
    """Request model for querying narrative units."""
    type: Optional[NarrativeType] = Field(None, description="Filter by narrative type")
    subtype: Optional[str] = Field(None, description="Filter by subtype")
    tags: Optional[list[str]] = Field(None, description="Filter by tags (any match)")
    search: Optional[str] = Field(None, description="Full-text search in content")
    status: Optional[str] = Field(None, description="Filter by status (active, draft, etc.)")


class ValidateRequest(BaseModel):
    """Request model for validating a claim."""
    claim: str = Field(..., description="The claim to validate")
    claim_type: Optional[str] = Field(None, description="Type of claim (performance, roi, feature, etc.)")
    require_proof: bool = Field(True, description="Whether proof is required for validation")
    context: Optional[dict[str, Any]] = Field(None, description="Additional context for validation")


class UpdateRequest(BaseModel):
    """Request model for updating a narrative unit."""
    file_path: str = Field(..., description="Path to the narrative file to update")
    updates: dict[str, Any] = Field(..., description="Fields to update")
    reason: Optional[str] = Field(None, description="Reason for the update")


# ============================================================================
# Response Models
# ============================================================================

class NarrativeUnit(BaseModel):
    """A single narrative unit."""
    file_path: str
    type: NarrativeType
    subtype: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None
    updated: Optional[str] = None
    tags: list[str] = []
    content: Optional[str] = None
    frontmatter: dict[str, Any] = {}


class QueryResponse(BaseModel):
    """Response model for query endpoint."""
    units: list[NarrativeUnit]
    total: int
    query: QueryRequest


class ProofReference(BaseModel):
    """A reference to a proof metric."""
    id: str
    name: str
    value: Any
    unit: str
    verified: bool
    verified_date: Optional[str] = None
    measurement_date: Optional[str] = None


class ValidationResult(BaseModel):
    """Result of a claim validation."""
    valid: bool
    confidence: float = Field(..., ge=0, le=1, description="Confidence score 0-1")
    claim: str
    issues: list[str] = []
    suggestions: list[str] = []
    proof_references: list[ProofReference] = []
    drift_risks: list[str] = []


class DriftEvent(BaseModel):
    """A detected drift event."""
    id: str
    type: DriftType
    severity: DriftSeverity
    detected_at: datetime
    source_unit: str
    target_unit: Optional[str] = None
    description: str
    suggested_resolution: Optional[str] = None
    status: DriftStatus


class LayerHealth(BaseModel):
    """Health status of a single layer."""
    status: HealthStatus
    last_updated: Optional[str] = None
    drift_count: int = 0


class CoherenceScore(BaseModel):
    """Coherence scoring across dimensions."""
    overall: float = Field(..., ge=0, le=1)
    dimensions: dict[str, float] = {}
    trend: Optional[str] = None
    timestamp: datetime


class CoherenceResponse(BaseModel):
    """Response model for coherence endpoint."""
    score: CoherenceScore
    drift_events: list[DriftEvent]
    health_summary: dict[str, LayerHealth]
    alerts: list[dict[str, Any]] = []


class UpdateResponse(BaseModel):
    """Response model for update endpoint."""
    success: bool
    file_path: str
    message: str
    previous_version: Optional[str] = None
    new_version: Optional[str] = None


# ============================================================================
# API Info Models
# ============================================================================

class APIInfo(BaseModel):
    """API information."""
    name: str
    version: str
    description: str
    endpoints: list[str]
