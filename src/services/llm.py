"""
LLM Service - Claude API integration for intelligent extraction and synthesis.

Provides:
- Context extraction from unstructured text
- Narrative document generation
- Semantic analysis and classification
- Coherence checking with LLM reasoning
"""
import os
import json
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from ..logging_config import get_logger

logger = get_logger("services.llm")

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("Anthropic library not available - LLM features will be disabled")


class ExtractionType(str, Enum):
    """Types of context that can be extracted."""
    DECISION = "decision"
    PRIORITY = "priority"
    VISION = "vision"
    VOICE = "voice"
    TERMINOLOGY = "terminology"
    FEATURE = "feature"
    CONSTRAINT = "constraint"
    CUSTOMER_INSIGHT = "customer_insight"


@dataclass
class ExtractionResult:
    """Result from LLM extraction."""
    type: ExtractionType
    title: str
    content: str
    confidence: float
    metadata: Dict[str, Any]
    suggested_path: str


@dataclass
class SynthesisResult:
    """Result from narrative synthesis."""
    markdown: str
    frontmatter: Dict[str, Any]
    suggested_filename: str
    layer: str  # strategy, messaging, naming, etc.


class LLMService:
    """
    Claude-powered service for intelligent context processing.

    Uses Claude API to:
    - Extract structured context from unstructured sources
    - Generate narrative documents in the correct format
    - Analyze semantic coherence
    - Classify incoming content
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize with optional API key (falls back to env var)."""
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.client = None
        self.model = "claude-sonnet-4-20250514"

        if ANTHROPIC_AVAILABLE and self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)

    @property
    def is_available(self) -> bool:
        """Check if LLM service is available."""
        return self.client is not None

    def extract_context(
        self,
        text: str,
        source: str = "unknown",
        hint: Optional[ExtractionType] = None
    ) -> List[ExtractionResult]:
        """
        Extract structured context from unstructured text.

        Args:
            text: Raw text from Slack, meeting notes, docs, etc.
            source: Source identifier (e.g., "slack", "meeting", "doc")
            hint: Optional hint about expected content type

        Returns:
            List of extracted context items
        """
        if not self.is_available:
            return []

        system_prompt = """You are a context extraction agent for the Principal Narrative system.
Your job is to identify and extract organizational context from unstructured text.

Look for:
- DECISIONS: Choices made about architecture, product, process
- PRIORITIES: What's important, what comes first
- VISION: Long-term goals, mission statements, aspirations
- VOICE: Brand voice, tone guidelines, communication style
- TERMINOLOGY: Canonical terms, naming conventions, forbidden words
- FEATURES: Product capabilities, roadmap items
- CONSTRAINTS: Limitations, requirements, dependencies
- CUSTOMER_INSIGHTS: Pain points, quotes, feedback

For each piece of context found, provide:
1. Type (one of the above categories)
2. Title (short, descriptive)
3. Content (the actual context, cleaned up)
4. Confidence (0-1, how confident you are this is real context)
5. Suggested path in the narrative structure

Respond in JSON format:
{
  "extractions": [
    {
      "type": "decision",
      "title": "Use PostgreSQL for persistence",
      "content": "Team decided to use PostgreSQL instead of MongoDB because...",
      "confidence": 0.9,
      "metadata": {"participants": ["alice", "bob"], "date": "2024-01-15"},
      "suggested_path": "applied-narrative/constraints/architectural.md"
    }
  ]
}

If no meaningful context is found, return {"extractions": []}"""

        user_prompt = f"""Extract organizational context from this text:

Source: {source}
{f'Expected type hint: {hint.value}' if hint else ''}

---
{text}
---

Return JSON with all context items found."""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )

            # Parse response
            content = response.content[0].text

            # Extract JSON from response
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            data = json.loads(content)

            results = []
            for item in data.get("extractions", []):
                results.append(ExtractionResult(
                    type=ExtractionType(item["type"]),
                    title=item["title"],
                    content=item["content"],
                    confidence=item.get("confidence", 0.5),
                    metadata=item.get("metadata", {}),
                    suggested_path=item.get("suggested_path", "")
                ))

            return results

        except Exception as e:
            logger.error(f"LLM extraction error: {e}", exc_info=True)
            return []

    def synthesize_narrative(
        self,
        context: str,
        target_layer: str,
        document_type: str,
        existing_content: Optional[str] = None
    ) -> Optional[SynthesisResult]:
        """
        Generate a narrative document from context.

        Args:
            context: The extracted context to turn into a document
            target_layer: Which layer (strategy, messaging, naming, etc.)
            document_type: Type of document to generate
            existing_content: Optional existing document to update

        Returns:
            SynthesisResult with markdown content and metadata
        """
        if not self.is_available:
            return None

        system_prompt = """You are a narrative document generator for the Principal Narrative system.
Your job is to create well-structured markdown documents that capture organizational context.

Documents should follow this format:
1. YAML frontmatter with metadata (documentType, title, version, status, tags)
2. Clear hierarchical structure with headers
3. Actionable, specific content
4. Examples where helpful
5. Cross-references to related documents

Output format:
{
  "markdown": "---\ndocumentType: ...\n---\n\n# Title\n\n...",
  "frontmatter": {"documentType": "...", "title": "...", ...},
  "suggested_filename": "document-name.md",
  "layer": "strategy"
}"""

        update_instruction = ""
        if existing_content:
            update_instruction = f"""

Existing document to update/merge with:
---
{existing_content}
---

Merge the new context with the existing document, preserving structure and adding new information."""

        user_prompt = f"""Generate a {document_type} document for the {target_layer} layer.

Context to incorporate:
{context}
{update_instruction}

Return JSON with the complete document."""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )

            content = response.content[0].text

            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            data = json.loads(content)

            return SynthesisResult(
                markdown=data["markdown"],
                frontmatter=data.get("frontmatter", {}),
                suggested_filename=data.get("suggested_filename", "untitled.md"),
                layer=data.get("layer", target_layer)
            )

        except Exception as e:
            logger.error(f"LLM synthesis error: {e}", exc_info=True)
            return None

    def classify_content(self, text: str) -> Dict[str, float]:
        """
        Classify text into narrative categories.

        Returns confidence scores for each category.
        """
        if not self.is_available:
            return {}

        system_prompt = """Classify this text into narrative categories.
Return JSON with confidence scores (0-1) for each category:
{
  "strategy": 0.0,
  "messaging": 0.0,
  "naming": 0.0,
  "proof": 0.0,
  "constraint": 0.0,
  "decision": 0.0,
  "customer": 0.0,
  "technical": 0.0,
  "irrelevant": 0.0
}

Only include categories with scores > 0.1"""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": text}]
            )

            content = response.content[0].text

            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            return json.loads(content)

        except Exception as e:
            logger.error(f"LLM classification error: {e}", exc_info=True)
            return {}

    def check_coherence(
        self,
        claim: str,
        context_docs: List[str]
    ) -> Dict[str, Any]:
        """
        Use LLM to check if a claim is coherent with context.

        Returns analysis with:
        - is_coherent: bool
        - confidence: float
        - issues: list of potential problems
        - suggestions: list of improvements
        """
        if not self.is_available:
            return {"is_coherent": True, "confidence": 0.0, "issues": [], "suggestions": []}

        system_prompt = """You are a coherence checker for the Principal Narrative system.
Analyze if a claim/statement is consistent with the provided context documents.

Check for:
- Factual consistency with documented information
- Alignment with stated voice/tone
- Use of canonical terminology
- Consistency with priorities and constraints

Return JSON:
{
  "is_coherent": true/false,
  "confidence": 0.0-1.0,
  "issues": ["list of specific problems found"],
  "suggestions": ["list of improvements"]
}"""

        context_text = "\n\n---\n\n".join(context_docs)

        user_prompt = f"""Check this claim for coherence with the context:

CLAIM:
{claim}

CONTEXT DOCUMENTS:
{context_text}

Analyze and return JSON."""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )

            content = response.content[0].text

            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            return json.loads(content)

        except Exception as e:
            logger.error(f"LLM coherence check error: {e}", exc_info=True)
            return {"is_coherent": True, "confidence": 0.0, "issues": [], "suggestions": []}

    def generate_drift_analysis(
        self,
        source_content: str,
        target_content: str,
        drift_type: str
    ) -> Dict[str, Any]:
        """
        Analyze drift between two pieces of content.

        Returns detailed analysis of the drift.
        """
        if not self.is_available:
            return {"analysis": "LLM not available", "severity": "unknown"}

        system_prompt = f"""You are analyzing {drift_type} drift in organizational narrative.

Compare the source and target content to identify:
- Specific inconsistencies
- Root cause of drift
- Impact assessment
- Recommended resolution

Return JSON:
{{
  "analysis": "detailed description of the drift",
  "severity": "low/medium/high/critical",
  "inconsistencies": ["list of specific issues"],
  "root_cause": "likely reason for drift",
  "impact": "potential consequences",
  "resolution": "recommended fix"
}}"""

        user_prompt = f"""Analyze drift between:

SOURCE (authoritative):
{source_content}

TARGET (potentially drifted):
{target_content}

Return JSON analysis."""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}]
            )

            content = response.content[0].text

            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            return json.loads(content)

        except Exception as e:
            logger.error(f"LLM drift analysis error: {e}", exc_info=True)
            return {"analysis": str(e), "severity": "unknown"}


# Singleton instance
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """Get or create the LLM service singleton."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
