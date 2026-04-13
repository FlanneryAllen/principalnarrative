"""
Semantic Drift Detector - Uses embeddings to detect when documentation contradicts reality.

Detects:
1. Documentation-to-documentation contradictions (conflicting claims)
2. Documentation-to-codebase drift (docs say X, code does Y)
3. Semantic inconsistencies across narrative layers
4. Technology/architecture misalignment
"""
import re
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass

from ..logging_config import get_logger
from ..config import settings
from ..models import DriftEvent, DriftType, DriftSeverity, DriftStatus
from .vector_store import VectorStore, SearchResult
from .narrative import NarrativeService

logger = get_logger("services.semantic_drift_detector")


@dataclass
class SemanticConflict:
    """A semantic contradiction between two documents."""
    doc1_path: str
    doc2_path: str
    doc1_snippet: str
    doc2_snippet: str
    conflict_type: str  # "contradiction", "inconsistency", "outdated"
    similarity_score: float
    description: str
    severity: DriftSeverity


@dataclass
class CodebaseEntity:
    """An entity extracted from the codebase."""
    entity_type: str  # "technology", "framework", "pattern", "dependency"
    name: str
    file_path: str
    confidence: float
    context: str  # Snippet showing usage


class SemanticDriftDetector:
    """
    Advanced drift detector using semantic embeddings.

    Compares:
    - Narrative documents against each other
    - Technical documentation against actual codebase
    - Claims against evidence
    """

    def __init__(
        self,
        narrative_service: Optional[NarrativeService] = None,
        vector_store: Optional[VectorStore] = None
    ):
        self.narrative = narrative_service or NarrativeService()
        self.vector_store = vector_store or VectorStore()
        self.conflicts: List[SemanticConflict] = []
        self.codebase_entities: List[CodebaseEntity] = []

    def run_semantic_scan(self) -> List[DriftEvent]:
        """Run a complete semantic drift scan."""
        logger.info("Starting semantic drift detection scan...")
        logger.info("-" * 60)

        drift_events = []

        # Ensure vector store is indexed
        if not self._ensure_indexed():
            logger.warning("Vector store not available or failed to index. Skipping semantic scan.")
            return drift_events

        # 1. Detect cross-document contradictions
        logger.info("Scanning for cross-document contradictions...")
        contradictions = self._detect_document_contradictions()
        drift_events.extend(self._conflicts_to_drift_events(contradictions))
        logger.info(f"  Found {len(contradictions)} semantic contradictions")

        # 2. Detect codebase drift
        logger.info("Scanning for documentation-to-code drift...")
        code_drift = self._detect_codebase_drift()
        drift_events.extend(code_drift)
        logger.info(f"  Found {len(code_drift)} code drift events")

        # 3. Detect technology misalignment
        logger.info("Scanning for technology stack misalignment...")
        tech_drift = self._detect_technology_drift()
        drift_events.extend(tech_drift)
        logger.info(f"  Found {len(tech_drift)} technology drift events")

        logger.info("-" * 60)
        logger.info(f"Semantic scan complete. Found {len(drift_events)} drift events.")

        return drift_events

    def _ensure_indexed(self) -> bool:
        """Ensure the vector store has documents indexed."""
        if not self.vector_store.is_available:
            return False

        stats = self.vector_store.get_stats()
        if stats.get("total_documents", 0) == 0:
            logger.info("Vector store empty. Indexing narrative documents...")
            count = self.vector_store.index_narrative_layer()
            logger.info(f"Indexed {count} documents")
            return count > 0

        return True

    # =========================================================================
    # CROSS-DOCUMENT CONTRADICTION DETECTION
    # =========================================================================

    def _detect_document_contradictions(self) -> List[SemanticConflict]:
        """
        Detect contradictions between narrative documents using semantic similarity.

        Strategy:
        1. For key claims in one doc, find semantically similar passages in others
        2. If similar but opposite (contradiction indicators), flag as conflict
        3. Use embedding similarity + keyword analysis
        """
        conflicts = []

        # Get all narrative units with claims
        units = self.narrative.get_all_units()
        claim_units = [u for u in units if u.type.value in ['strategy', 'messaging', 'marketing']]

        # Contradiction indicator patterns
        contradiction_patterns = [
            (r'\bnot\b', r'\bis\b'),
            (r'\bdoes not\b', r'\bdoes\b'),
            (r'\bno\b', r'\byes\b'),
            (r'\bavoid\b', r'\buse\b'),
            (r'\bnever\b', r'\balways\b'),
        ]

        for unit in claim_units[:20]:  # Limit to avoid too many comparisons
            if not unit.content or len(unit.content) < 100:
                continue

            # Extract key claims (sentences with strong assertions)
            claims = self._extract_claims(unit.content)

            for claim in claims[:5]:  # Top 5 claims per doc
                # Find semantically similar passages in other docs
                similar = self.vector_store.search(
                    query=claim,
                    n_results=10,
                    min_score=0.6  # Reasonably similar
                )

                for result in similar:
                    # Skip same document
                    if result.path == unit.file_path:
                        continue

                    # Check for contradiction indicators
                    is_contradiction, conflict_type = self._check_contradiction(
                        claim, result.content, contradiction_patterns
                    )

                    if is_contradiction:
                        severity = self._assess_conflict_severity(
                            unit.file_path, result.path, result.score
                        )

                        conflicts.append(SemanticConflict(
                            doc1_path=unit.file_path,
                            doc2_path=result.path,
                            doc1_snippet=claim[:200],
                            doc2_snippet=result.content[:200],
                            conflict_type=conflict_type,
                            similarity_score=result.score,
                            description=f"Potential contradiction: documents discuss similar topics but with opposing statements",
                            severity=severity
                        ))

        return conflicts

    def _extract_claims(self, content: str) -> List[str]:
        """Extract claim sentences from content."""
        # Strong assertion keywords
        assertion_keywords = [
            r'\bwe\s+(are|provide|offer|support|enable|deliver)\b',
            r'\bour\s+\w+\s+(is|are|provides|enables)\b',
            r'\b(never|always|only|exclusively|specifically)\b',
            r'\bunlike\s+\w+',
            r'\bguarantee\b',
            r'\b(must|should|will)\s+\w+\b',
        ]

        claims = []
        sentences = re.split(r'[.!?]\s+', content)

        for sentence in sentences:
            # Check if sentence contains assertion keywords
            if any(re.search(pattern, sentence, re.IGNORECASE) for pattern in assertion_keywords):
                if len(sentence) > 20:  # Substantive claim
                    claims.append(sentence.strip())

        return claims

    def _check_contradiction(
        self,
        claim1: str,
        claim2: str,
        patterns: List[Tuple[str, str]]
    ) -> Tuple[bool, str]:
        """
        Check if two similar claims contradict each other.

        Returns:
            (is_contradiction, conflict_type)
        """
        claim1_lower = claim1.lower()
        claim2_lower = claim2.lower()

        # Check for negation patterns
        for neg_pattern, pos_pattern in patterns:
            # Claim1 has negation, claim2 has positive
            if re.search(neg_pattern, claim1_lower) and re.search(pos_pattern, claim2_lower):
                return True, "contradiction"
            # Claim1 has positive, claim2 has negation
            if re.search(pos_pattern, claim1_lower) and re.search(neg_pattern, claim2_lower):
                return True, "contradiction"

        # Check for conflicting technology/approach mentions
        tech_keywords = ['postgresql', 'mongodb', 'redis', 'mysql', 'dynamodb',
                        'react', 'vue', 'angular', 'fastapi', 'django', 'flask']

        claim1_techs = [tech for tech in tech_keywords if tech in claim1_lower]
        claim2_techs = [tech for tech in tech_keywords if tech in claim2_lower]

        # If discussing similar context but mentioning different technologies
        if claim1_techs and claim2_techs and set(claim1_techs) != set(claim2_techs):
            return True, "inconsistency"

        return False, ""

    def _assess_conflict_severity(
        self,
        doc1_path: str,
        doc2_path: str,
        similarity: float
    ) -> DriftSeverity:
        """Assess the severity of a semantic conflict."""
        # High severity if both are in critical layers
        critical_layers = ['strategy', 'vision', 'priorities']
        doc1_layer = self._extract_layer(doc1_path)
        doc2_layer = self._extract_layer(doc2_path)

        if doc1_layer in critical_layers and doc2_layer in critical_layers:
            return DriftSeverity.HIGH

        # Medium if high similarity (very similar but contradictory)
        if similarity > 0.8:
            return DriftSeverity.MEDIUM

        return DriftSeverity.LOW

    # =========================================================================
    # CODEBASE DRIFT DETECTION
    # =========================================================================

    def _detect_codebase_drift(self) -> List[DriftEvent]:
        """
        Detect when technical documentation doesn't match actual code.

        Compares:
        - Architecture docs vs actual imports/dependencies
        - README vs actual file structure
        - Tech stack docs vs requirements.txt/package.json
        """
        drift_events = []

        # Extract entities from codebase
        self.codebase_entities = self._analyze_codebase()

        if not self.codebase_entities:
            logger.debug("No codebase entities extracted, skipping code drift detection")
            return drift_events

        # Get technical documentation
        tech_docs = [
            u for u in self.narrative.get_all_units()
            if 'technical' in u.file_path.lower() or 'architecture' in u.file_path.lower()
        ]

        # Check for undocumented technologies
        for entity in self.codebase_entities:
            if entity.confidence < 0.7:  # Only high-confidence entities
                continue

            # Search for mentions in tech docs
            mentioned = False
            for doc in tech_docs:
                if doc.content and entity.name.lower() in doc.content.lower():
                    mentioned = True
                    break

            if not mentioned and entity.entity_type in ['technology', 'framework']:
                drift_events.append(self._create_drift_event(
                    drift_type=DriftType.SEMANTIC,
                    severity=DriftSeverity.MEDIUM,
                    source_unit=entity.file_path,
                    target_unit="technical-context/architecture.md",
                    description=f"Code uses {entity.entity_type} '{entity.name}' but it's not documented in architecture",
                    suggested_resolution=f"Add '{entity.name}' to technical documentation or remove from codebase"
                ))

        return drift_events

    def _analyze_codebase(self) -> List[CodebaseEntity]:
        """
        Analyze the codebase to extract technologies, frameworks, patterns.

        Looks at:
        - Python imports (src/**/*.py)
        - Requirements files
        - Configuration files
        - Package.json dependencies
        """
        entities = []
        base_path = settings.narrative_base_path.parent

        # Analyze Python imports
        python_files = list(base_path.glob("src/**/*.py"))[:50]  # Limit to avoid slowdown

        for py_file in python_files:
            try:
                content = py_file.read_text(encoding='utf-8')
                entities.extend(self._extract_python_imports(content, str(py_file)))
            except Exception as e:
                logger.debug(f"Error reading {py_file}: {e}")

        # Analyze requirements.txt
        req_file = base_path / "requirements.txt"
        if req_file.exists():
            try:
                content = req_file.read_text(encoding='utf-8')
                entities.extend(self._extract_requirements(content, str(req_file)))
            except Exception as e:
                logger.debug(f"Error reading requirements.txt: {e}")

        # Deduplicate
        seen = set()
        unique_entities = []
        for entity in entities:
            key = (entity.entity_type, entity.name.lower())
            if key not in seen:
                seen.add(key)
                unique_entities.append(entity)

        return unique_entities

    def _extract_python_imports(self, content: str, file_path: str) -> List[CodebaseEntity]:
        """Extract technologies from Python import statements."""
        entities = []

        # Common technology keywords to track
        tech_mapping = {
            'fastapi': 'framework',
            'flask': 'framework',
            'django': 'framework',
            'anthropic': 'ai-service',
            'openai': 'ai-service',
            'chromadb': 'database',
            'sqlalchemy': 'orm',
            'redis': 'cache',
            'playwright': 'browser-automation',
            'selenium': 'browser-automation',
            'beautifulsoup': 'html-parser',
            'pandas': 'data-processing',
            'numpy': 'data-processing',
        }

        # Find import statements
        import_pattern = r'^(?:from|import)\s+(\w+)'
        for match in re.finditer(import_pattern, content, re.MULTILINE):
            module = match.group(1).lower()

            if module in tech_mapping:
                # Get context (line with import)
                start = max(0, match.start() - 50)
                end = min(len(content), match.end() + 50)
                context = content[start:end].strip()

                entities.append(CodebaseEntity(
                    entity_type=tech_mapping[module],
                    name=module,
                    file_path=file_path,
                    confidence=0.9,
                    context=context
                ))

        return entities

    def _extract_requirements(self, content: str, file_path: str) -> List[CodebaseEntity]:
        """Extract dependencies from requirements.txt."""
        entities = []

        for line in content.split('\n'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            # Parse package name
            package = re.split(r'[=<>!]', line)[0].strip()

            if package:
                entities.append(CodebaseEntity(
                    entity_type='dependency',
                    name=package.lower(),
                    file_path=file_path,
                    confidence=1.0,
                    context=line
                ))

        return entities

    # =========================================================================
    # TECHNOLOGY DRIFT DETECTION
    # =========================================================================

    def _detect_technology_drift(self) -> List[DriftEvent]:
        """
        Detect misalignment in documented vs actual technology stack.

        Example: Docs say "We use PostgreSQL" but code imports mongodb
        """
        drift_events = []

        if not self.codebase_entities:
            return drift_events

        # Technology mapping (documented vs actual)
        tech_categories = {
            'database': ['postgresql', 'postgres', 'mysql', 'mongodb', 'sqlite', 'dynamodb', 'redis'],
            'framework': ['fastapi', 'flask', 'django', 'express', 'react', 'vue', 'angular'],
            'ai-service': ['anthropic', 'openai', 'claude', 'gpt'],
        }

        # Get technology mentions in docs
        tech_docs = [
            u for u in self.narrative.get_all_units()
            if any(keyword in u.file_path.lower() for keyword in ['technical', 'architecture', 'readme'])
        ]

        for category, tech_list in tech_categories.items():
            # Find what's documented
            documented_techs = set()
            for doc in tech_docs:
                if not doc.content:
                    continue
                content_lower = doc.content.lower()
                for tech in tech_list:
                    if tech in content_lower:
                        documented_techs.add(tech)

            # Find what's in code
            actual_techs = {
                entity.name for entity in self.codebase_entities
                if entity.entity_type == category or entity.name in tech_list
            }

            # Check for mismatches
            if documented_techs and actual_techs:
                # Technologies documented but not used
                unused = documented_techs - actual_techs
                for tech in unused:
                    drift_events.append(self._create_drift_event(
                        drift_type=DriftType.SEMANTIC,
                        severity=DriftSeverity.MEDIUM,
                        source_unit="technical-context/architecture.md",
                        description=f"Documentation mentions {category} '{tech}' but it's not found in codebase",
                        suggested_resolution=f"Remove '{tech}' from documentation or implement it in code"
                    ))

                # Technologies used but not documented
                undocumented = actual_techs - documented_techs
                for tech in undocumented:
                    drift_events.append(self._create_drift_event(
                        drift_type=DriftType.SEMANTIC,
                        severity=DriftSeverity.LOW,
                        source_unit="src/",
                        target_unit="technical-context/architecture.md",
                        description=f"Code uses {category} '{tech}' but it's not documented",
                        suggested_resolution=f"Add '{tech}' to architecture documentation"
                    ))

        return drift_events

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def _conflicts_to_drift_events(self, conflicts: List[SemanticConflict]) -> List[DriftEvent]:
        """Convert semantic conflicts to drift events."""
        events = []

        for conflict in conflicts:
            events.append(self._create_drift_event(
                drift_type=DriftType.SEMANTIC,
                severity=conflict.severity,
                source_unit=conflict.doc1_path,
                target_unit=conflict.doc2_path,
                description=f"{conflict.description}\nDoc1: {conflict.doc1_snippet}...\nDoc2: {conflict.doc2_snippet}...",
                suggested_resolution="Review both documents and resolve the contradiction"
            ))

        return events

    def _create_drift_event(
        self,
        drift_type: DriftType,
        severity: DriftSeverity,
        source_unit: str,
        description: str,
        target_unit: Optional[str] = None,
        suggested_resolution: Optional[str] = None
    ) -> DriftEvent:
        """Create a drift event."""
        import uuid
        return DriftEvent(
            id=f"semantic-drift-{uuid.uuid4().hex[:8]}",
            type=drift_type,
            severity=severity,
            detected_at=datetime.now(),
            source_unit=source_unit,
            target_unit=target_unit,
            description=description,
            suggested_resolution=suggested_resolution,
            status=DriftStatus.OPEN
        )

    def _extract_layer(self, path: str) -> str:
        """Extract the narrative layer from a path."""
        layers = ["strategy", "messaging", "naming", "marketing",
                  "proof", "story", "constraints", "definitions", "coherence", "vision", "priorities"]

        path_lower = path.lower()
        for layer in layers:
            if layer in path_lower:
                return layer

        return "unknown"

    def get_summary(self) -> Dict[str, Any]:
        """Get summary statistics of semantic drift detection."""
        return {
            "total_conflicts": len(self.conflicts),
            "codebase_entities_found": len(self.codebase_entities),
            "entities_by_type": self._group_by_type(self.codebase_entities),
            "conflicts_by_severity": self._group_conflicts_by_severity()
        }

    def _group_by_type(self, entities: List[CodebaseEntity]) -> Dict[str, int]:
        """Group entities by type."""
        result = {}
        for entity in entities:
            result[entity.entity_type] = result.get(entity.entity_type, 0) + 1
        return result

    def _group_conflicts_by_severity(self) -> Dict[str, int]:
        """Group conflicts by severity."""
        result = {}
        for conflict in self.conflicts:
            sev = conflict.severity.value
            result[sev] = result.get(sev, 0) + 1
        return result
