"""
Intent Client SDK

Provides agent-friendly interface for querying organizational intent.
This is what autonomous AI agents use to ask "what does the org want?"
"""

import sqlite3
import json
import re
from typing import List, Dict, Set, Optional, Any
from pathlib import Path

from .types import (
    IntentUnit,
    IntentType,
    QueryParams,
    QueryResult,
    IntentChainItem,
    Constraints,
    CodeConstraints,
    ContentConstraints,
    ValidationRule,
    GraphStats,
)


class IntentClient:
    """
    Client for querying organizational intent.

    Usage:
        client = IntentClient('.narrative/intent.db')

        # Query intent before acting
        result = client.query_intent(
            operation='writing authentication code',
            context={'tags': ['security', 'authentication']}
        )

        # Use constraints to guide actions
        if 'localStorage' in result['constraints'].get('code', {}).get('forbidden_patterns', []):
            # Don't use localStorage
            pass
    """

    def __init__(self, db_path: str = '.narrative/intent.db'):
        """
        Initialize Intent Client

        Args:
            db_path: Path to SQLite database (default: .narrative/intent.db)
        """
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    def query_intent(
        self,
        operation: str,
        context: Optional[Dict[str, Any]] = None
    ) -> QueryResult:
        """
        Query organizational intent for a given operation.

        This is the main method agents call before acting.
        Returns the full intent chain with merged constraints.

        Args:
            operation: Description of what you're doing (e.g., "writing authentication code")
            context: Optional context dict with tags, file paths, etc.

        Returns:
            QueryResult with intent chain, constraints, validation rules, and evidence

        Example:
            >>> result = client.query_intent(
            ...     operation='writing authentication code',
            ...     context={'tags': ['security']}
            ... )
            >>> print(result['constraints']['code']['required_patterns'])
            ['audit_logging', 'oauth2', 'mfa_support']
        """
        params: QueryParams = {
            'operation': operation,
            'context': context or {}
        }

        # 1. Find relevant intent units
        relevant_units = self._match_intent(params)

        if not relevant_units:
            # No matching intent - return empty response
            return {
                'intentChain': [],
                'constraints': {},
                'validationRules': [],
                'evidenceRequired': []
            }

        # 2. Build complete dependency chains for all matches
        all_chains = [self._get_dependency_chain(unit['id']) for unit in relevant_units]

        # 3. Merge all chains (deduplicate by ID)
        chain_map: Dict[str, IntentUnit] = {}
        for chain in all_chains:
            for unit in chain:
                chain_map[unit['id']] = unit

        full_chain = list(chain_map.values())

        # 4. Build intent chain summary (for agent context)
        intent_chain: List[IntentChainItem] = [
            {
                'type': unit['type'],
                'assertion': unit['assertion'],
                'source': unit['id']
            }
            for unit in full_chain
        ]

        # 5. Extract and merge constraints
        constraints = self._extract_constraints(full_chain)

        # 6. Collect validation rules
        validation_rules = self._extract_validation_rules(full_chain)

        # 7. Collect evidence requirements
        evidence_required = self._extract_evidence_requirements(full_chain)

        return {
            'intentChain': intent_chain,
            'constraints': constraints,
            'validationRules': validation_rules,
            'evidenceRequired': evidence_required
        }

    def _match_intent(self, params: QueryParams) -> List[IntentUnit]:
        """
        Find intent units relevant to the operation.

        For MVP: simple keyword matching
        Future: semantic search with embeddings
        """
        # Get all units
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM intent_units')
        rows = cursor.fetchall()

        units: List[IntentUnit] = []
        for row in rows:
            unit = self._row_to_unit(row)
            units.append(unit)

        # Extract keywords from operation
        keywords = self._extract_keywords(params['operation'])

        # Filter by keyword matching
        matched_units: List[IntentUnit] = []
        for unit in units:
            # Match against assertion
            assertion_match = any(
                keyword in unit['assertion'].lower()
                for keyword in keywords
            )

            # Match against intent objective
            objective_match = any(
                keyword in unit['intent']['objective'].lower()
                for keyword in keywords
            )

            # Match against metadata tags
            tags = unit.get('metadata', {}).get('tags', [])
            tag_match = any(
                keyword in tag.lower()
                for keyword in keywords
                for tag in tags
            )

            if assertion_match or objective_match or tag_match:
                matched_units.append(unit)

        # If we have context tags, prioritize units with matching tags
        context_tags = params.get('context', {}).get('tags', [])
        if context_tags:
            matched_units.sort(
                key=lambda u: sum(
                    1 for tag in u.get('metadata', {}).get('tags', [])
                    if tag.lower() in [t.lower() for t in context_tags]
                ),
                reverse=True
            )

        return matched_units

    def _extract_keywords(self, text: str) -> List[str]:
        """Extract keywords from text (simple word splitting)"""
        # Convert to lowercase and split
        words = re.findall(r'\b\w+\b', text.lower())

        # Remove common stop words
        stop_words = {
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'should', 'could', 'may', 'might', 'must', 'can',
            'to', 'of', 'in', 'for', 'on', 'at', 'by', 'with', 'from'
        }

        keywords = [w for w in words if w not in stop_words and len(w) > 2]
        return keywords

    def _get_dependency_chain(self, unit_id: str) -> List[IntentUnit]:
        """
        Get complete dependency chain for a unit (BFS traversal).

        Returns units in dependency order (dependencies first).
        """
        visited: Set[str] = set()
        chain: List[IntentUnit] = []

        def traverse(uid: str):
            if uid in visited:
                return
            visited.add(uid)

            unit = self._get_unit(uid)
            if unit:
                # Traverse dependencies first
                for dep_id in unit['dependencies']:
                    traverse(dep_id)
                chain.append(unit)

        traverse(unit_id)
        return chain

    def _get_unit(self, unit_id: str) -> Optional[IntentUnit]:
        """Get a single unit by ID"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM intent_units WHERE id = ?', (unit_id,))
        row = cursor.fetchone()

        if row:
            return self._row_to_unit(row)
        return None

    def _row_to_unit(self, row: sqlite3.Row) -> IntentUnit:
        """Convert database row to IntentUnit"""
        return {
            'id': row['id'],
            'type': row['type'],
            'assertion': row['assertion'],
            'intent': json.loads(row['intent']),
            'dependencies': json.loads(row['dependencies']),
            'validationState': row['validation_state'],
            'confidence': row['confidence'],
            'metadata': json.loads(row['metadata']) if row['metadata'] else {}
        }

    def _extract_constraints(self, chain: List[IntentUnit]) -> Constraints:
        """Extract and merge constraints from intent chain"""
        merged: Constraints = {}

        # Collect all code constraints
        code_required: Set[str] = set()
        code_forbidden: Set[str] = set()
        code_libraries: Set[str] = set()

        # Collect all content constraints
        content_required_themes: Set[str] = set()
        content_forbidden_themes: Set[str] = set()
        tone: Optional[str] = None
        target_audience: Optional[str] = None

        for unit in chain:
            constraints = unit['intent'].get('constraints', {})

            # Code constraints
            if 'code' in constraints:
                code = constraints['code']
                code_required.update(code.get('required_patterns', []))
                code_forbidden.update(code.get('forbidden_patterns', []))
                code_libraries.update(code.get('required_libraries', []))

            # Content constraints
            if 'content' in constraints:
                content = constraints['content']
                content_required_themes.update(content.get('required_themes', []))
                content_forbidden_themes.update(content.get('forbidden_themes', []))

                if not tone and 'tone' in content:
                    tone = content['tone']
                if not target_audience and 'target_audience' in content:
                    target_audience = content['target_audience']

        # Build merged code constraints
        if code_required or code_forbidden or code_libraries:
            code_constraints: CodeConstraints = {}
            if code_required:
                code_constraints['required_patterns'] = sorted(code_required)
            if code_forbidden:
                code_constraints['forbidden_patterns'] = sorted(code_forbidden)
            if code_libraries:
                code_constraints['required_libraries'] = sorted(code_libraries)
            merged['code'] = code_constraints

        # Build merged content constraints
        if content_required_themes or content_forbidden_themes or tone or target_audience:
            content_constraints: ContentConstraints = {}
            if content_required_themes:
                content_constraints['required_themes'] = sorted(content_required_themes)
            if content_forbidden_themes:
                content_constraints['forbidden_themes'] = sorted(content_forbidden_themes)
            if tone:
                content_constraints['tone'] = tone
            if target_audience:
                content_constraints['target_audience'] = target_audience
            merged['content'] = content_constraints

        return merged

    def _extract_validation_rules(self, chain: List[IntentUnit]) -> List[ValidationRule]:
        """Extract validation rules from intent chain"""
        rules: List[ValidationRule] = []

        for unit in chain:
            constraints = unit['intent'].get('constraints', {})

            # Get validation rules from constraints
            if 'validation_rules' in constraints:
                rules.extend(constraints['validation_rules'])

            # Get validation rules from code constraints
            if 'code' in constraints and 'validation_rules' in constraints['code']:
                rules.extend(constraints['code']['validation_rules'])

            # Get validation rules from content constraints
            if 'content' in constraints and 'validation_rules' in constraints['content']:
                rules.extend(constraints['content']['validation_rules'])

        return rules

    def _extract_evidence_requirements(self, chain: List[IntentUnit]) -> List[str]:
        """Extract evidence requirements from intent chain"""
        requirements: Set[str] = set()

        for unit in chain:
            evidence = unit['intent'].get('evidence_required', [])
            requirements.update(evidence)

        return sorted(requirements)

    def get_stats(self) -> GraphStats:
        """Get statistics about the intent graph"""
        cursor = self.conn.cursor()

        # Total count
        cursor.execute('SELECT COUNT(*) as count FROM intent_units')
        total = cursor.fetchone()['count']

        # By type
        cursor.execute('SELECT type, COUNT(*) as count FROM intent_units GROUP BY type')
        by_type = {row['type']: row['count'] for row in cursor.fetchall()}

        # By validation state
        cursor.execute('SELECT validation_state, COUNT(*) as count FROM intent_units GROUP BY validation_state')
        by_validation = {row['validation_state']: row['count'] for row in cursor.fetchall()}

        return {
            'total': total,
            'byType': by_type,
            'byValidation': by_validation
        }

    def get_all_units(self) -> List[IntentUnit]:
        """Get all intent units"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM intent_units')
        return [self._row_to_unit(row) for row in cursor.fetchall()]

    def close(self):
        """Close database connection"""
        self.conn.close()

    def __enter__(self):
        """Context manager support"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager cleanup"""
        self.close()
