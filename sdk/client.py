"""
Principal Narrative API Client.

The main client for interacting with the Principal Narrative Shared Context API.
"""
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime

from .models import (
    NarrativeUnit,
    NarrativeType,
    ValidationResult,
    ValidationIssue,
    IssueSeverity,
    CoherenceScore,
    DriftEvent,
    DriftType,
    DriftSeverity,
    AgentRegistration,
    ContextResponse,
    SearchResult,
    SynthesisResult,
    IngestionResult,
)


class PrincipalNarrativeError(Exception):
    """Base exception for Principal Narrative SDK."""
    pass


class APIError(PrincipalNarrativeError):
    """Error from the API."""
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"API Error {status_code}: {message}")


class PrincipalNarrative:
    """
    Client for the Principal Narrative Shared Context API.

    Example:
        pn = PrincipalNarrative("http://localhost:8000")

        # Query narrative units
        units = pn.query(type="messaging")

        # Validate a claim
        result = pn.validate("Our platform is 10x faster")

        # Search semantically
        results = pn.search("customer pain points")
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        timeout: float = 30.0
    ):
        """
        Initialize the client.

        Args:
            base_url: Base URL of the Principal Narrative API
            api_key: Optional API key for authentication
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._agent_id: Optional[str] = None

        # Set up headers
        self.headers = {"Content-Type": "application/json"}
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        json: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make an HTTP request to the API."""
        url = f"{self.base_url}{path}"

        with httpx.Client(timeout=self.timeout) as client:
            response = client.request(
                method,
                url,
                params=params,
                json=json,
                headers=self.headers
            )

            if response.status_code >= 400:
                try:
                    detail = response.json().get("detail", response.text)
                except Exception:
                    detail = response.text
                raise APIError(response.status_code, detail)

            return response.json()

    # =========================================================================
    # Health & Info
    # =========================================================================

    def health(self) -> Dict[str, Any]:
        """Check API health status."""
        return self._request("GET", "/health")

    def info(self) -> Dict[str, Any]:
        """Get API information and available endpoints."""
        return self._request("GET", "/")

    # =========================================================================
    # Context Query
    # =========================================================================

    def query(
        self,
        type: Optional[str] = None,
        subtype: Optional[str] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None,
        status: Optional[str] = None,
        include_content: bool = True
    ) -> List[NarrativeUnit]:
        """
        Query narrative units.

        Args:
            type: Filter by narrative type (strategy, messaging, etc.)
            subtype: Filter by subtype
            tags: Filter by tags
            search: Full-text search in content
            status: Filter by status (active, draft, etc.)
            include_content: Include full content in response

        Returns:
            List of matching narrative units
        """
        params = {"include_content": include_content}
        if type:
            params["type"] = type
        if subtype:
            params["subtype"] = subtype
        if tags:
            params["tags"] = ",".join(tags)
        if search:
            params["search"] = search
        if status:
            params["status"] = status

        data = self._request("GET", "/context/query", params=params)

        return [
            NarrativeUnit(
                path=u.get("path", ""),
                type=NarrativeType(u.get("type", "strategy")),
                title=u.get("title", ""),
                content=u.get("content"),
                subtype=u.get("subtype"),
                tags=u.get("tags", []),
                status=u.get("status", "active"),
                version=u.get("version", "1.0.0"),
                last_updated=u.get("last_updated"),
                metadata=u.get("metadata", {})
            )
            for u in data.get("units", [])
        ]

    def get_unit(self, path: str) -> Optional[NarrativeUnit]:
        """Get a specific narrative unit by path."""
        try:
            data = self._request("GET", f"/context/unit/{path}")
            return NarrativeUnit(
                path=data.get("path", path),
                type=NarrativeType(data.get("type", "strategy")),
                title=data.get("title", ""),
                content=data.get("content"),
                subtype=data.get("subtype"),
                tags=data.get("tags", []),
                status=data.get("status", "active")
            )
        except APIError as e:
            if e.status_code == 404:
                return None
            raise

    # =========================================================================
    # Validation
    # =========================================================================

    def validate(
        self,
        claim: str,
        require_proof: bool = True
    ) -> ValidationResult:
        """
        Validate a claim against the narrative layer.

        Args:
            claim: The claim/text to validate
            require_proof: Require proof backing for numeric claims

        Returns:
            ValidationResult with issues and suggestions
        """
        data = self._request(
            "POST",
            "/context/validate",
            json={"claim": claim, "require_proof": require_proof}
        )

        issues = [
            ValidationIssue(
                type=i.get("type", "unknown"),
                severity=IssueSeverity(i.get("severity", "warning")),
                message=i.get("message", ""),
                source=i.get("source"),
                suggestion=i.get("suggestion")
            )
            for i in data.get("issues", [])
        ]

        return ValidationResult(
            valid=data.get("valid", False),
            confidence=data.get("confidence", 0.0),
            issues=issues,
            suggestions=data.get("suggestions", []),
            proof_used=data.get("proof_used", [])
        )

    def check_naming(self, text: str) -> Dict[str, Any]:
        """Check text for naming violations."""
        return self._request("GET", "/naming/check", params={"text": text})

    # =========================================================================
    # Coherence
    # =========================================================================

    def get_coherence(self) -> CoherenceScore:
        """Get current coherence state."""
        data = self._request("GET", "/coherence")
        score = data.get("score", {})

        return CoherenceScore(
            overall=score.get("overall", 0.0),
            strategic=score.get("strategic", 0.0),
            semantic=score.get("semantic", 0.0),
            messaging=score.get("messaging", 0.0),
            naming=score.get("naming", 0.0),
            proof=score.get("proof", 0.0)
        )

    def get_drift_events(
        self,
        status: Optional[str] = None,
        drift_type: Optional[str] = None,
        severity: Optional[str] = None
    ) -> List[DriftEvent]:
        """Get drift events with optional filters."""
        params = {}
        if status:
            params["status"] = status
        if drift_type:
            params["type"] = drift_type
        if severity:
            params["severity"] = severity

        data = self._request("GET", "/coherence/drift", params=params)

        return [
            DriftEvent(
                id=e.get("id", ""),
                type=DriftType(e.get("type", "semantic")),
                severity=DriftSeverity(e.get("severity", "low")),
                source_unit=e.get("source_unit", ""),
                target_unit=e.get("target_unit"),
                description=e.get("description", ""),
                suggested_resolution=e.get("suggested_resolution", ""),
                status=e.get("status", "open")
            )
            for e in data.get("drift_events", [])
        ]

    def run_drift_scan(self, save: bool = False) -> Dict[str, Any]:
        """Run a full drift detection scan."""
        return self._request("POST", "/coherence/scan", params={"save": save})

    # =========================================================================
    # Search
    # =========================================================================

    def search(
        self,
        query: str,
        layer: Optional[str] = None,
        limit: int = 5
    ) -> List[SearchResult]:
        """
        Semantic search across narrative documents.

        Args:
            query: Search query
            layer: Filter by layer (strategy, messaging, etc.)
            limit: Max results

        Returns:
            List of search results ranked by relevance
        """
        params = {"q": query, "limit": limit}
        if layer:
            params["layer"] = layer

        data = self._request("GET", "/search", params=params)

        return [
            SearchResult(
                path=r.get("path", ""),
                score=r.get("score", 0.0),
                content=r.get("content", ""),
                metadata=r.get("metadata", {})
            )
            for r in data.get("results", [])
        ]

    def index_documents(self) -> Dict[str, Any]:
        """Index all narrative documents for semantic search."""
        return self._request("POST", "/search/index")

    # =========================================================================
    # Agent Coordination
    # =========================================================================

    def register_agent(
        self,
        agent_type: str,
        name: str,
        capabilities: Optional[List[str]] = None
    ) -> AgentRegistration:
        """
        Register as an agent with the coordinator.

        Args:
            agent_type: Type of agent (coding, comms, planning, etc.)
            name: Agent name
            capabilities: List of capabilities

        Returns:
            AgentRegistration with agent_id
        """
        params = {
            "agent_type": agent_type,
            "name": name,
            "capabilities": ",".join(capabilities or [])
        }

        data = self._request("POST", "/agents/register", params=params)

        self._agent_id = data.get("agent_id")

        return AgentRegistration(
            agent_id=data.get("agent_id", ""),
            name=data.get("name", name),
            agent_type=data.get("type", agent_type),
            capabilities=capabilities or [],
            registered_at=datetime.fromisoformat(data.get("registered_at", datetime.now().isoformat()))
        )

    def get_context(
        self,
        query: str,
        layers: Optional[List[str]] = None,
        agent_id: Optional[str] = None
    ) -> ContextResponse:
        """
        Get context for a task.

        Args:
            query: What context is needed for
            layers: Which layers to query
            agent_id: Agent ID (uses registered ID if not provided)

        Returns:
            ContextResponse with relevant documents and guidance
        """
        aid = agent_id or self._agent_id
        if not aid:
            raise PrincipalNarrativeError("Must register as agent first or provide agent_id")

        params = {
            "agent_id": aid,
            "query": query,
            "layers": ",".join(layers or ["strategy", "messaging"])
        }

        data = self._request("GET", "/agents/context", params=params)

        return ContextResponse(
            request_id=data.get("request_id", ""),
            documents=data.get("documents", []),
            semantic_matches=[],
            proof_metrics=[],
            constraints=[],
            voice_guidance=data.get("voice_guidance"),
            coherence_score=data.get("coherence_score", 0.0),
            warnings=data.get("warnings", [])
        )

    def validate_output(
        self,
        content: str,
        output_type: str = "copy",
        agent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate agent output against narrative context.

        Args:
            content: Content to validate
            output_type: Type of output (code, copy, design)
            agent_id: Agent ID

        Returns:
            Validation result
        """
        aid = agent_id or self._agent_id
        if not aid:
            raise PrincipalNarrativeError("Must register as agent first or provide agent_id")

        params = {
            "agent_id": aid,
            "output_type": output_type,
            "content": content
        }

        return self._request("POST", "/agents/validate", params=params)

    # =========================================================================
    # Synthesis & Ingestion
    # =========================================================================

    def synthesize(
        self,
        text: str,
        source: str = "manual",
        target_layer: Optional[str] = None,
        save: bool = False
    ) -> SynthesisResult:
        """
        Synthesize narrative documents from raw text.

        Args:
            text: Raw text to synthesize
            source: Source of text (slack, github, manual)
            target_layer: Target layer for generated docs
            save: Save generated documents

        Returns:
            SynthesisResult with generated documents
        """
        params = {"text": text, "source": source, "save": save}
        if target_layer:
            params["target_layer"] = target_layer

        data = self._request("POST", "/synthesize", params=params)

        return SynthesisResult(
            generated=data.get("generated", data.get("would_generate", 0)),
            saved_paths=data.get("saved_paths", []),
            preview=data.get("documents")
        )

    def ingest_text(
        self,
        text: str,
        source: str = "manual",
        process: bool = True,
        save: bool = False
    ) -> IngestionResult:
        """
        Ingest raw text and optionally synthesize documents.

        Args:
            text: Text to ingest
            source: Source description
            process: Process through synthesizer
            save: Save generated documents

        Returns:
            IngestionResult with processing details
        """
        params = {
            "text": text,
            "source": source,
            "process": process,
            "save": save
        }

        data = self._request("POST", "/ingest/text", params=params)

        return IngestionResult(
            ingested=data.get("ingested", 1),
            processed=data.get("processed", 0),
            documents_generated=data.get("documents_generated", 0),
            errors=data.get("errors", [])
        )

    # =========================================================================
    # Proof
    # =========================================================================

    def get_proof_metrics(
        self,
        verified_only: bool = False,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get proof metrics."""
        params = {"verified_only": verified_only}
        if category:
            params["category"] = category

        data = self._request("GET", "/proof/metrics", params=params)
        return data.get("metrics", [])

    # =========================================================================
    # Git
    # =========================================================================

    def git_status(self) -> Dict[str, Any]:
        """Get git repository status."""
        return self._request("GET", "/git/status")

    def git_commit(self, message: Optional[str] = None) -> Dict[str, Any]:
        """Commit pending changes."""
        params = {}
        if message:
            params["message"] = message
        return self._request("POST", "/git/commit", params=params)
