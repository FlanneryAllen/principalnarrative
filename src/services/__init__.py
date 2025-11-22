"""
Services for the Principal Narrative API.
"""
from .narrative import NarrativeService
from .validator import ValidatorService
from .coherence import CoherenceService
from .drift_detector import DriftDetector
from .llm import LLMService, get_llm_service
from .synthesizer import ContextSynthesizer
from .vector_store import VectorStore, get_vector_store
from .ingestion import IngestionService, get_ingestion_service
from .git_manager import GitManager, get_git_manager
from .agent_coordinator import AgentCoordinator, get_agent_coordinator

__all__ = [
    # Core services
    "NarrativeService",
    "ValidatorService",
    "CoherenceService",
    "DriftDetector",
    # LLM & Synthesis
    "LLMService",
    "get_llm_service",
    "ContextSynthesizer",
    # Vector store
    "VectorStore",
    "get_vector_store",
    # Ingestion
    "IngestionService",
    "get_ingestion_service",
    # Git
    "GitManager",
    "get_git_manager",
    # Agent coordination
    "AgentCoordinator",
    "get_agent_coordinator",
]
