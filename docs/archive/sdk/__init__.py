"""
Principal Narrative Python SDK

A Python client for the Principal Narrative Shared Context API.

Usage:
    from sdk import PrincipalNarrative

    # Initialize client
    pn = PrincipalNarrative(base_url="http://localhost:8000")

    # Query context
    context = pn.query(type="messaging", subtype="pillars")

    # Validate a claim
    result = pn.validate("Our platform delivers 10x faster results")

    # Search semantically
    results = pn.search("customer pain points")

    # Register as an agent
    agent = pn.register_agent("coding", "MyCodeAgent", ["python", "typescript"])

    # Get context for a task
    context = pn.get_context("building a new dashboard feature")
"""

from .client import PrincipalNarrative
from .models import (
    NarrativeUnit,
    ValidationResult,
    CoherenceScore,
    DriftEvent,
    AgentRegistration,
    ContextResponse,
)

__version__ = "0.1.0"
__all__ = [
    "PrincipalNarrative",
    "NarrativeUnit",
    "ValidationResult",
    "CoherenceScore",
    "DriftEvent",
    "AgentRegistration",
    "ContextResponse",
]
