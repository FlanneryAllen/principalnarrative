"""
Type definitions for Intent Engineering SDK
"""

from typing import TypedDict, List, Optional, Dict, Any, Literal

# Intent Types (matching TypeScript enum)
IntentType = Literal[
    "core_story",
    "positioning",
    "product_narrative",
    "operational",
    "evidence",
    "communication"
]

# Validation States
ValidationState = Literal["ALIGNED", "DRIFTED", "BROKEN", "UNKNOWN"]


class ValidationRule(TypedDict, total=False):
    """Validation rule for code/content checking"""
    type: str  # 'ast_pattern', 'regex', 'semantic'
    check: str
    error_message: str
    suggestion: Optional[str]


class CodeConstraints(TypedDict, total=False):
    """Code-specific constraints"""
    required_patterns: List[str]
    forbidden_patterns: List[str]
    required_libraries: List[str]
    validation_rules: List[ValidationRule]


class ContentConstraints(TypedDict, total=False):
    """Content-specific constraints"""
    required_themes: List[str]
    forbidden_themes: List[str]
    tone: str
    target_audience: Optional[str]
    validation_rules: List[ValidationRule]


class Constraints(TypedDict, total=False):
    """Combined constraints"""
    code: CodeConstraints
    content: ContentConstraints
    validation_rules: List[ValidationRule]


class Intent(TypedDict, total=False):
    """Intent specification"""
    objective: str
    constraints: Constraints
    evidence_required: List[str]


class Metadata(TypedDict, total=False):
    """Unit metadata"""
    created_at: str
    created_by: str
    tags: List[str]
    source: Optional[str]


class IntentUnit(TypedDict):
    """Intent Unit structure (matches database schema)"""
    id: str
    type: IntentType
    assertion: str
    intent: Intent
    dependencies: List[str]
    validationState: ValidationState
    confidence: float
    metadata: Metadata


class QueryParams(TypedDict, total=False):
    """Parameters for querying intent"""
    operation: str
    context: Optional[Dict[str, Any]]


class IntentChainItem(TypedDict):
    """Single item in intent chain"""
    type: IntentType
    assertion: str
    source: str  # unit ID


class QueryResult(TypedDict):
    """Result from intent query"""
    intentChain: List[IntentChainItem]
    constraints: Constraints
    validationRules: List[ValidationRule]
    evidenceRequired: List[str]


class GraphStats(TypedDict):
    """Statistics about the intent graph"""
    total: int
    byType: Dict[str, int]
    byValidation: Dict[str, int]
