"""
Agent Coordinator - Multi-agent coordination protocol.

Provides:
- Context provisioning for external agents
- Coherence checking before agent actions
- Task handoff and coordination
- Agent registration and capability tracking
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass, field
from enum import Enum

from .narrative import NarrativeService
from .validator import ValidatorService
from .vector_store import get_vector_store
from .llm import get_llm_service


class AgentType(str, Enum):
    """Types of agents that can coordinate."""
    CODING = "coding"
    COMMS = "comms"
    PLANNING = "planning"
    RESEARCH = "research"
    MARKETING = "marketing"
    SUPPORT = "support"
    CUSTOM = "custom"


class TaskStatus(str, Enum):
    """Status of a coordinated task."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


@dataclass
class AgentRegistration:
    """Registration for an external agent."""
    agent_id: str
    agent_type: AgentType
    name: str
    capabilities: List[str]
    registered_at: datetime
    last_seen: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ContextRequest:
    """Request for context from an agent."""
    agent_id: str
    query: str
    layers: List[str]  # Which layers to query
    include_proof: bool = True
    semantic_search: bool = True
    max_results: int = 10


@dataclass
class ContextResponse:
    """Response with context for an agent."""
    request_id: str
    documents: List[Dict[str, Any]]
    semantic_matches: List[Dict[str, Any]]
    proof_metrics: List[Dict[str, Any]]
    constraints: List[str]
    voice_guidance: Optional[str]
    coherence_score: float
    warnings: List[str]


@dataclass
class CoordinatedTask:
    """A task being coordinated between agents."""
    task_id: str
    title: str
    description: str
    requesting_agent: str
    assigned_agent: Optional[str]
    status: TaskStatus
    context_provided: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    result: Optional[Any] = None


@dataclass
class ValidationRequest:
    """Request to validate agent output."""
    agent_id: str
    output_type: str  # code, copy, design, etc.
    content: str
    context_used: List[str]  # Document paths used


@dataclass
class ValidationResponse:
    """Response from output validation."""
    valid: bool
    coherence_score: float
    issues: List[Dict[str, Any]]
    suggestions: List[str]
    approved: bool


class AgentCoordinator:
    """
    Coordinates multiple agents around shared narrative context.

    Protocol:
    1. Agents register with coordinator
    2. Before acting, agents request relevant context
    3. Coordinator provides context + constraints
    4. After acting, agents submit output for validation
    5. Coordinator checks coherence and approves/rejects
    """

    def __init__(self):
        """Initialize coordinator."""
        self.narrative_service = NarrativeService()
        self.validator_service = ValidatorService(self.narrative_service)
        self.vector_store = get_vector_store()
        self.llm_service = get_llm_service()

        self.registered_agents: Dict[str, AgentRegistration] = {}
        self.active_tasks: Dict[str, CoordinatedTask] = {}
        self.context_cache: Dict[str, ContextResponse] = {}

    # =========================================================================
    # Agent Registration
    # =========================================================================

    def register_agent(
        self,
        agent_type: AgentType,
        name: str,
        capabilities: List[str],
        metadata: Optional[Dict[str, Any]] = None
    ) -> AgentRegistration:
        """
        Register an agent with the coordinator.

        Returns:
            Agent registration with unique ID
        """
        agent_id = f"{agent_type.value}-{uuid.uuid4().hex[:8]}"
        now = datetime.now()

        registration = AgentRegistration(
            agent_id=agent_id,
            agent_type=agent_type,
            name=name,
            capabilities=capabilities,
            registered_at=now,
            last_seen=now,
            metadata=metadata or {}
        )

        self.registered_agents[agent_id] = registration
        return registration

    def heartbeat(self, agent_id: str) -> bool:
        """Update agent's last seen timestamp."""
        if agent_id in self.registered_agents:
            self.registered_agents[agent_id].last_seen = datetime.now()
            return True
        return False

    def get_active_agents(self, timeout_minutes: int = 5) -> List[AgentRegistration]:
        """Get agents that have been seen recently."""
        cutoff = datetime.now() - timedelta(minutes=timeout_minutes)
        return [
            agent for agent in self.registered_agents.values()
            if agent.last_seen > cutoff
        ]

    def unregister_agent(self, agent_id: str) -> bool:
        """Unregister an agent."""
        if agent_id in self.registered_agents:
            del self.registered_agents[agent_id]
            return True
        return False

    # =========================================================================
    # Context Provisioning
    # =========================================================================

    def request_context(self, request: ContextRequest) -> ContextResponse:
        """
        Provide context to an agent for a task.

        This is the primary interface for agents to get narrative context.
        """
        # Update heartbeat
        self.heartbeat(request.agent_id)

        request_id = uuid.uuid4().hex[:12]
        documents = []
        semantic_matches = []
        proof_metrics = []
        constraints = []
        warnings = []
        voice_guidance = None

        # Query requested layers
        for layer in request.layers:
            layer_docs = self.narrative_service.get_layer_documents(layer)
            for doc in layer_docs:
                documents.append({
                    "path": doc.get("path"),
                    "type": doc.get("type"),
                    "content": doc.get("content"),
                    "layer": layer
                })

        # Semantic search if enabled
        if request.semantic_search and self.vector_store.is_available:
            results = self.vector_store.search(
                query=request.query,
                n_results=request.max_results
            )
            for result in results:
                semantic_matches.append({
                    "path": result.path,
                    "content": result.content,
                    "score": result.score,
                    "metadata": result.metadata
                })

        # Include proof metrics
        if request.include_proof:
            proof_metrics = self.narrative_service.get_proof_metrics()

        # Get constraints
        constraint_docs = self.narrative_service.get_layer_documents("constraints")
        for doc in constraint_docs:
            if doc.get("content"):
                constraints.append(doc["content"])

        # Get voice guidance for comms/marketing agents
        agent = self.registered_agents.get(request.agent_id)
        if agent and agent.agent_type in [AgentType.COMMS, AgentType.MARKETING]:
            voice_doc = self.narrative_service.get_unit_by_path("messaging/voice.md")
            if voice_doc:
                voice_guidance = voice_doc.get("content")

        # Check for potential issues
        forbidden_terms = self.narrative_service.get_forbidden_terms()
        if forbidden_terms:
            warnings.append(f"Avoid {len(forbidden_terms)} forbidden terms - check naming layer")

        # Get coherence score
        coherence = self.narrative_service.get_coherence_state()
        coherence_score = coherence.get("score", {}).get("overall", 0.0) if coherence else 0.0

        response = ContextResponse(
            request_id=request_id,
            documents=documents,
            semantic_matches=semantic_matches,
            proof_metrics=proof_metrics,
            constraints=constraints,
            voice_guidance=voice_guidance,
            coherence_score=coherence_score,
            warnings=warnings
        )

        # Cache response
        self.context_cache[request_id] = response

        return response

    def get_context_for_task(
        self,
        task_type: str,
        query: str,
        agent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Simplified context request for common task types.

        Returns a task-appropriate context package.
        """
        # Map task types to relevant layers
        task_layers = {
            "coding": ["strategy", "constraints", "naming"],
            "copywriting": ["messaging", "naming", "proof"],
            "design": ["messaging", "naming", "definitions"],
            "planning": ["strategy", "constraints"],
            "research": ["definitions", "proof"],
            "support": ["messaging", "definitions", "proof"]
        }

        layers = task_layers.get(task_type, ["strategy", "messaging"])

        # Create temporary agent if not registered
        temp_agent_id = agent_id or f"temp-{uuid.uuid4().hex[:8]}"

        request = ContextRequest(
            agent_id=temp_agent_id,
            query=query,
            layers=layers,
            include_proof=task_type in ["copywriting", "research", "support"],
            semantic_search=True,
            max_results=5
        )

        response = self.request_context(request)

        # Return simplified format
        return {
            "documents": response.documents,
            "relevant_matches": response.semantic_matches[:3],
            "proof": response.proof_metrics if response.proof_metrics else [],
            "constraints": response.constraints,
            "voice": response.voice_guidance,
            "coherence": response.coherence_score,
            "warnings": response.warnings
        }

    # =========================================================================
    # Output Validation
    # =========================================================================

    def validate_output(self, request: ValidationRequest) -> ValidationResponse:
        """
        Validate agent output against narrative context.

        Checks:
        - Forbidden terminology
        - Proof backing for claims
        - Voice/tone alignment
        - Strategic coherence
        """
        issues = []
        suggestions = []

        # Check forbidden terms
        forbidden = self.narrative_service.get_forbidden_terms()
        content_lower = request.content.lower()
        for term_info in forbidden:
            term = term_info.get("term", "").lower()
            if term and term in content_lower:
                issues.append({
                    "type": "forbidden_term",
                    "term": term_info.get("term"),
                    "reason": term_info.get("reason"),
                    "alternative": term_info.get("alternative")
                })

        # Validate claims if output is copy
        if request.output_type in ["copy", "marketing", "docs"]:
            from ..models import ValidateRequest
            validation = self.validator_service.validate(
                ValidateRequest(claim=request.content, require_proof=True)
            )

            for issue in validation.issues:
                issues.append({
                    "type": "validation",
                    "severity": issue.severity.value if hasattr(issue.severity, 'value') else str(issue.severity),
                    "message": issue.message
                })

            suggestions.extend(validation.suggestions)

        # LLM coherence check if available
        coherence_score = 0.8  # Default
        if self.llm_service.is_available and request.context_used:
            # Get context documents
            context_docs = []
            for path in request.context_used[:3]:  # Limit to 3
                doc = self.narrative_service.get_unit_by_path(path)
                if doc and doc.get("content"):
                    context_docs.append(doc["content"])

            if context_docs:
                check = self.llm_service.check_coherence(
                    claim=request.content,
                    context_docs=context_docs
                )
                coherence_score = check.get("confidence", 0.8)

                for issue in check.get("issues", []):
                    issues.append({
                        "type": "coherence",
                        "message": issue
                    })
                suggestions.extend(check.get("suggestions", []))

        # Determine if approved
        critical_issues = [i for i in issues if i.get("type") == "forbidden_term"]
        approved = len(critical_issues) == 0 and coherence_score >= 0.6

        return ValidationResponse(
            valid=len(issues) == 0,
            coherence_score=coherence_score,
            issues=issues,
            suggestions=suggestions,
            approved=approved
        )

    # =========================================================================
    # Task Coordination
    # =========================================================================

    def create_task(
        self,
        title: str,
        description: str,
        requesting_agent: str,
        assign_to: Optional[str] = None
    ) -> CoordinatedTask:
        """Create a coordinated task."""
        task_id = uuid.uuid4().hex[:12]
        now = datetime.now()

        # Get relevant context
        context = self.get_context_for_task(
            task_type="planning",
            query=f"{title} {description}"
        )

        task = CoordinatedTask(
            task_id=task_id,
            title=title,
            description=description,
            requesting_agent=requesting_agent,
            assigned_agent=assign_to,
            status=TaskStatus.PENDING,
            context_provided=context,
            created_at=now,
            updated_at=now
        )

        self.active_tasks[task_id] = task
        return task

    def update_task_status(
        self,
        task_id: str,
        status: TaskStatus,
        result: Optional[Any] = None
    ) -> bool:
        """Update task status."""
        if task_id not in self.active_tasks:
            return False

        self.active_tasks[task_id].status = status
        self.active_tasks[task_id].updated_at = datetime.now()

        if result is not None:
            self.active_tasks[task_id].result = result

        return True

    def assign_task(self, task_id: str, agent_id: str) -> bool:
        """Assign a task to an agent."""
        if task_id not in self.active_tasks:
            return False
        if agent_id not in self.registered_agents:
            return False

        self.active_tasks[task_id].assigned_agent = agent_id
        self.active_tasks[task_id].status = TaskStatus.IN_PROGRESS
        self.active_tasks[task_id].updated_at = datetime.now()

        return True

    def get_task(self, task_id: str) -> Optional[CoordinatedTask]:
        """Get a task by ID."""
        return self.active_tasks.get(task_id)

    def get_agent_tasks(self, agent_id: str) -> List[CoordinatedTask]:
        """Get all tasks assigned to an agent."""
        return [
            task for task in self.active_tasks.values()
            if task.assigned_agent == agent_id
        ]

    # =========================================================================
    # Agent Communication
    # =========================================================================

    def broadcast(
        self,
        message: str,
        message_type: str = "info",
        target_types: Optional[List[AgentType]] = None
    ) -> Dict[str, bool]:
        """
        Broadcast a message to agents.

        In a real implementation, this would use webhooks or message queues.
        """
        results = {}

        for agent_id, agent in self.registered_agents.items():
            if target_types is None or agent.agent_type in target_types:
                # In reality, this would send via webhook/queue
                results[agent_id] = True

        return results

    def request_handoff(
        self,
        from_agent: str,
        to_agent_type: AgentType,
        task_context: Dict[str, Any]
    ) -> Optional[str]:
        """
        Request task handoff to another agent type.

        Returns task_id if handoff initiated, None if no suitable agent found.
        """
        # Find available agent of requested type
        available = [
            agent for agent in self.get_active_agents()
            if agent.agent_type == to_agent_type
        ]

        if not available:
            return None

        # Create task for handoff
        task = self.create_task(
            title=f"Handoff from {from_agent}",
            description=task_context.get("description", "Task handoff"),
            requesting_agent=from_agent,
            assign_to=available[0].agent_id
        )

        return task.task_id


# Singleton instance
_coordinator: Optional[AgentCoordinator] = None


def get_agent_coordinator() -> AgentCoordinator:
    """Get or create the agent coordinator singleton."""
    global _coordinator
    if _coordinator is None:
        _coordinator = AgentCoordinator()
    return _coordinator
