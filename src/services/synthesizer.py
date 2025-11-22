"""
Context Synthesizer - Generates narrative documents from extracted context.

This service takes raw context (from Slack, meetings, etc.) and transforms it
into properly formatted narrative documents for the Applied Narrative layer.
"""
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from .llm import get_llm_service, ExtractionType, ExtractionResult, SynthesisResult
from ..config import settings


@dataclass
class SynthesisRequest:
    """Request to synthesize a narrative document."""
    raw_text: str
    source: str  # slack, meeting, doc, manual
    target_layer: Optional[str] = None  # strategy, messaging, naming, etc.
    document_type: Optional[str] = None
    merge_with: Optional[str] = None  # Path to existing doc to merge


@dataclass
class DocumentOutput:
    """Output from document synthesis."""
    path: Path
    content: str
    frontmatter: Dict[str, Any]
    layer: str
    is_new: bool
    extraction_confidence: float


class ContextSynthesizer:
    """
    Synthesizes narrative documents from unstructured context.

    Pipeline:
    1. Extract structured context using LLM
    2. Classify into appropriate layer
    3. Generate or update narrative document
    4. Save to appropriate location in applied-narrative/
    """

    LAYER_PATHS = {
        "strategy": "strategy",
        "messaging": "messaging",
        "naming": "naming",
        "marketing": "marketing",
        "proof": "proof",
        "story": "story",
        "constraints": "constraints",
        "definitions": "definitions",
    }

    EXTRACTION_TO_LAYER = {
        ExtractionType.DECISION: "constraints",
        ExtractionType.PRIORITY: "strategy",
        ExtractionType.VISION: "strategy",
        ExtractionType.VOICE: "messaging",
        ExtractionType.TERMINOLOGY: "naming",
        ExtractionType.FEATURE: "marketing",
        ExtractionType.CONSTRAINT: "constraints",
        ExtractionType.CUSTOMER_INSIGHT: "definitions",
    }

    def __init__(self, base_path: Optional[Path] = None):
        """Initialize with optional custom base path."""
        self.base_path = base_path or settings.narrative_base_path
        self.llm = get_llm_service()

    def process(self, request: SynthesisRequest) -> List[DocumentOutput]:
        """
        Process a synthesis request and generate document(s).

        Args:
            request: The synthesis request with raw text and options

        Returns:
            List of generated documents
        """
        outputs = []

        # Step 1: Extract context using LLM
        extractions = self.llm.extract_context(
            text=request.raw_text,
            source=request.source
        )

        if not extractions:
            # If LLM not available or no extractions, try rule-based
            extractions = self._rule_based_extraction(request.raw_text)

        # Step 2: Process each extraction
        for extraction in extractions:
            # Determine target layer
            layer = request.target_layer or self.EXTRACTION_TO_LAYER.get(
                extraction.type, "definitions"
            )

            # Step 3: Generate document
            output = self._generate_document(extraction, layer, request.merge_with)
            if output:
                outputs.append(output)

        return outputs

    def _generate_document(
        self,
        extraction: ExtractionResult,
        layer: str,
        merge_with: Optional[str] = None
    ) -> Optional[DocumentOutput]:
        """Generate a narrative document from an extraction."""

        # Check if merging with existing
        existing_content = None
        if merge_with:
            merge_path = self.base_path / merge_with
            if merge_path.exists():
                existing_content = merge_path.read_text()

        # Use LLM to synthesize if available
        if self.llm.is_available:
            result = self.llm.synthesize_narrative(
                context=extraction.content,
                target_layer=layer,
                document_type=extraction.type.value,
                existing_content=existing_content
            )

            if result:
                path = self.base_path / self.LAYER_PATHS.get(layer, layer) / result.suggested_filename
                return DocumentOutput(
                    path=path,
                    content=result.markdown,
                    frontmatter=result.frontmatter,
                    layer=layer,
                    is_new=not (merge_with and existing_content),
                    extraction_confidence=extraction.confidence
                )

        # Fallback: Generate with template
        return self._template_based_generation(extraction, layer)

    def _template_based_generation(
        self,
        extraction: ExtractionResult,
        layer: str
    ) -> DocumentOutput:
        """Generate document using templates (no LLM fallback)."""

        filename = self._slugify(extraction.title) + ".md"
        path = self.base_path / self.LAYER_PATHS.get(layer, layer) / filename

        frontmatter = {
            "documentType": extraction.type.value,
            "title": extraction.title,
            "version": "1.0.0",
            "lastUpdated": datetime.now().strftime("%Y-%m-%d"),
            "status": "draft",
            "tags": [layer, extraction.type.value],
            "source": extraction.metadata.get("source", "synthesized"),
            "confidence": extraction.confidence,
        }

        # Format frontmatter as YAML
        frontmatter_yaml = "---\n"
        for key, value in frontmatter.items():
            if isinstance(value, list):
                frontmatter_yaml += f"{key}:\n"
                for item in value:
                    frontmatter_yaml += f"  - {item}\n"
            else:
                frontmatter_yaml += f"{key}: {value}\n"
        frontmatter_yaml += "---\n\n"

        # Generate content
        content = frontmatter_yaml
        content += f"# {extraction.title}\n\n"
        content += f"## Overview\n\n{extraction.content}\n\n"

        if extraction.metadata:
            content += "## Metadata\n\n"
            for key, value in extraction.metadata.items():
                content += f"- **{key}**: {value}\n"
            content += "\n"

        content += f"---\n*Synthesized on {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n"

        return DocumentOutput(
            path=path,
            content=content,
            frontmatter=frontmatter,
            layer=layer,
            is_new=True,
            extraction_confidence=extraction.confidence
        )

    def _rule_based_extraction(self, text: str) -> List[ExtractionResult]:
        """
        Simple rule-based extraction when LLM is not available.

        Looks for common patterns that indicate context.
        """
        extractions = []

        # Decision patterns
        decision_patterns = [
            r"(?:we (?:decided|agreed|chose)|decision:|let's go with)\s*(.+?)(?:\.|$)",
            r"(?:the plan is to|going forward,?)\s*(.+?)(?:\.|$)",
        ]

        for pattern in decision_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                extractions.append(ExtractionResult(
                    type=ExtractionType.DECISION,
                    title=match[:50] + "..." if len(match) > 50 else match,
                    content=match,
                    confidence=0.5,
                    metadata={"extraction_method": "rule_based"},
                    suggested_path="applied-narrative/constraints/decisions.md"
                ))

        # Priority patterns
        priority_patterns = [
            r"(?:priority|focus|important|must have)[:\s]+(.+?)(?:\.|$)",
            r"(?:P[0-1]|critical|urgent)[:\s]+(.+?)(?:\.|$)",
        ]

        for pattern in priority_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                extractions.append(ExtractionResult(
                    type=ExtractionType.PRIORITY,
                    title=match[:50] + "..." if len(match) > 50 else match,
                    content=match,
                    confidence=0.4,
                    metadata={"extraction_method": "rule_based"},
                    suggested_path="applied-narrative/strategy/priorities.md"
                ))

        return extractions

    def _slugify(self, text: str) -> str:
        """Convert text to a URL-friendly slug."""
        # Lowercase
        slug = text.lower()
        # Replace spaces and special chars with hyphens
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        # Remove leading/trailing hyphens
        slug = slug.strip('-')
        # Limit length
        return slug[:50]

    def save_document(self, output: DocumentOutput, dry_run: bool = False) -> Path:
        """
        Save a generated document to disk.

        Args:
            output: The document to save
            dry_run: If True, don't actually write to disk

        Returns:
            Path where document was (or would be) saved
        """
        if not dry_run:
            # Ensure directory exists
            output.path.parent.mkdir(parents=True, exist_ok=True)

            # Write content
            output.path.write_text(output.content)

        return output.path

    def preview(self, request: SynthesisRequest) -> Dict[str, Any]:
        """
        Preview what would be generated without saving.

        Returns a summary of the planned outputs.
        """
        outputs = self.process(request)

        return {
            "would_generate": len(outputs),
            "documents": [
                {
                    "path": str(output.path),
                    "layer": output.layer,
                    "is_new": output.is_new,
                    "confidence": output.extraction_confidence,
                    "preview": output.content[:500] + "..." if len(output.content) > 500 else output.content
                }
                for output in outputs
            ]
        }
