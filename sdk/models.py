"""
Data models for the Principal Narrative SDK.
"""
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class NarrativeType(str, Enum):
    """Types of narrative documents."""
    STRATEGY = "strategy"
    MESSAGING = "messaging"
    NAMING = "naming"
    MARKETING = "marketing"
    PROOF = "proof"
    STORY = "story"
    CONSTRAINTS = "constraints"
    DEFINITIONS = "definitions"


class DriftType(str, Enum):
    """Types of drift that can be detected."""
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


class IssueSeverity(str, Enum):
    """Severity levels for validation issues."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass
class NarrativeUnit:
    """A single narrative document."""
    path: str
    type: NarrativeType
    title: str
    content: Optional[str] = None
    subtype: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    status: str = "active"
    version: str = "1.0.0"
    last_updated: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationIssue:
    """An issue found during validation."""
    type: str
    severity: IssueSeverity
    message: str
    source: Optional[str] = None
    suggestion: Optional[str] = None


@dataclass
class ValidationResult:
    """Result from validating a claim."""
    valid: bool
    confidence: float
    issues: List[ValidationIssue] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    proof_used: List[str] = field(default_factory=list)


@dataclass
class CoherenceScore:
    """Coherence score with dimensional breakdown."""
    overall: float
    strategic: float = 0.0
    semantic: float = 0.0
    messaging: float = 0.0
    naming: float = 0.0
    proof: float = 0.0
    timestamp: Optional[datetime] = None

    @property
    def is_healthy(self) -> bool:
        """Check if coherence is above threshold."""
        return self.overall >= 0.75


@dataclass
class DriftEvent:
    """A detected drift event."""
    id: str
    type: DriftType
    severity: DriftSeverity
    source_unit: str
    target_unit: Optional[str]
    description: str
    suggested_resolution: str
    status: str = "open"
    detected_at: Optional[datetime] = None


@dataclass
class AgentRegistration:
    """Registration info for an agent."""
    agent_id: str
    name: str
    agent_type: str
    capabilities: List[str]
    registered_at: datetime


@dataclass
class SearchResult:
    """A search result."""
    path: str
    score: float
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ContextResponse:
    """Response containing context for an agent."""
    request_id: str
    documents: List[Dict[str, Any]]
    semantic_matches: List[SearchResult]
    proof_metrics: List[Dict[str, Any]]
    constraints: List[str]
    voice_guidance: Optional[str]
    coherence_score: float
    warnings: List[str]


@dataclass
class SynthesisResult:
    """Result from context synthesis."""
    generated: int
    saved_paths: List[str] = field(default_factory=list)
    preview: Optional[Dict[str, Any]] = None


@dataclass
class IngestionResult:
    """Result from content ingestion."""
    ingested: int
    processed: int
    documents_generated: int
    errors: List[str] = field(default_factory=list)
