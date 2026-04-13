"""
Intent Engineering SDK for Python

Provides AI agents with structured access to organizational intent.
"""

from .client import IntentClient
from .types import (
    IntentUnit,
    IntentType,
    ValidationState,
    QueryParams,
    QueryResult,
    IntentChainItem,
    Constraints,
    CodeConstraints,
    ContentConstraints,
    ValidationRule,
)

__version__ = "0.1.0"

__all__ = [
    "IntentClient",
    "IntentUnit",
    "IntentType",
    "ValidationState",
    "QueryParams",
    "QueryResult",
    "IntentChainItem",
    "Constraints",
    "CodeConstraints",
    "ContentConstraints",
    "ValidationRule",
]
