"""
Service for computing and retrieving coherence scores.
"""
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, Any

from ..config import settings
from ..models import (
    CoherenceScore,
    CoherenceResponse,
    DriftEvent,
    DriftType,
    DriftSeverity,
    DriftStatus,
    LayerHealth,
    HealthStatus
)
from .narrative import NarrativeService


class CoherenceService:
    """Service for coherence scoring and drift event management."""

    def __init__(self, narrative_service: Optional[NarrativeService] = None):
        self.narrative = narrative_service or NarrativeService()

    def get_coherence(self) -> CoherenceResponse:
        """Get current coherence state from stored data."""
        coherence_path = self.narrative.base_path / 'coherence' / 'current.json'

        if not coherence_path.exists():
            # Return default state if no coherence file
            return self._default_coherence_response()

        try:
            data = json.loads(coherence_path.read_text(encoding='utf-8'))
            return self._parse_coherence_data(data)
        except Exception as e:
            print(f"Error reading coherence data: {e}")
            return self._default_coherence_response()

    def _parse_coherence_data(self, data: dict[str, Any]) -> CoherenceResponse:
        """Parse coherence data from JSON."""
        # Parse score
        score_data = data.get('score', {})
        score = CoherenceScore(
            overall=score_data.get('overall', 0.0) or 0.0,
            dimensions=score_data.get('dimensions', {}),
            trend=score_data.get('trend'),
            timestamp=datetime.fromisoformat(
                score_data.get('timestamp', datetime.now().isoformat()).replace('Z', '+00:00')
            ) if score_data.get('timestamp') else datetime.now()
        )

        # Parse drift events
        drift_events = []
        for event_data in data.get('drift_events', []):
            try:
                drift_events.append(DriftEvent(
                    id=event_data.get('id', ''),
                    type=DriftType(event_data.get('type', 'semantic')),
                    severity=DriftSeverity(event_data.get('severity', 'low')),
                    detected_at=datetime.fromisoformat(
                        event_data.get('detected_at', datetime.now().isoformat()).replace('Z', '+00:00')
                    ),
                    source_unit=event_data.get('source_unit', ''),
                    target_unit=event_data.get('target_unit'),
                    description=event_data.get('description', ''),
                    suggested_resolution=event_data.get('suggested_resolution'),
                    status=DriftStatus(event_data.get('status', 'open'))
                ))
            except Exception as e:
                print(f"Error parsing drift event: {e}")
                continue

        # Parse health summary
        health_summary = {}
        for layer, health_data in data.get('health_summary', {}).items():
            try:
                health_summary[layer] = LayerHealth(
                    status=HealthStatus(health_data.get('status', 'uninitialized')),
                    last_updated=health_data.get('last_updated'),
                    drift_count=health_data.get('drift_count', 0)
                )
            except Exception:
                health_summary[layer] = LayerHealth(
                    status=HealthStatus.UNINITIALIZED,
                    drift_count=0
                )

        # Parse alerts
        alerts = data.get('alerts', {}).get('active', [])

        return CoherenceResponse(
            score=score,
            drift_events=drift_events,
            health_summary=health_summary,
            alerts=alerts
        )

    def _default_coherence_response(self) -> CoherenceResponse:
        """Return a default coherence response."""
        return CoherenceResponse(
            score=CoherenceScore(
                overall=0.0,
                dimensions={},
                trend=None,
                timestamp=datetime.now()
            ),
            drift_events=[],
            health_summary={},
            alerts=[]
        )

    def get_drift_events(
        self,
        status: Optional[DriftStatus] = None,
        drift_type: Optional[DriftType] = None,
        severity: Optional[DriftSeverity] = None
    ) -> list[DriftEvent]:
        """Get drift events with optional filters."""
        coherence = self.get_coherence()
        events = coherence.drift_events

        if status:
            events = [e for e in events if e.status == status]

        if drift_type:
            events = [e for e in events if e.type == drift_type]

        if severity:
            events = [e for e in events if e.severity == severity]

        return events

    def get_open_drift_count(self) -> int:
        """Get count of open drift events."""
        events = self.get_drift_events(status=DriftStatus.OPEN)
        return len(events)

    def compute_coherence(self) -> CoherenceScore:
        """
        Compute coherence score by analyzing all narrative layers.

        This is a simplified implementation. A full implementation would:
        - Use embeddings to measure semantic similarity
        - Cross-reference all claims with proof
        - Check all naming against terminology
        - Validate all feature claims against registry
        """
        dimensions = {
            'semantic': self._compute_semantic_score(),
            'strategic': self._compute_strategic_score(),
            'messaging': self._compute_messaging_score(),
            'naming': self._compute_naming_score(),
            'proof': self._compute_proof_score()
        }

        # Weighted average
        weights = {
            'semantic': 0.25,
            'strategic': 0.20,
            'messaging': 0.20,
            'naming': 0.15,
            'proof': 0.20
        }

        overall = sum(
            dimensions[k] * weights[k]
            for k in dimensions
        )

        return CoherenceScore(
            overall=overall,
            dimensions=dimensions,
            trend='stable',
            timestamp=datetime.now()
        )

    def _compute_semantic_score(self) -> float:
        """Compute semantic coherence score."""
        # Simplified: Check that all units have valid structure
        units = self.narrative.get_all_units()
        if not units:
            return 0.0

        valid_count = sum(
            1 for u in units
            if u.type and u.content and len(u.content) > 50
        )

        return valid_count / len(units)

    def _compute_strategic_score(self) -> float:
        """Compute strategic alignment score."""
        # Check that strategy layer is populated
        strategy_units = self.narrative.query(
            type_filter=None  # We'll filter manually
        )
        strategy_units = [u for u in self.narrative.get_all_units() if u.type.value == 'strategy']

        if not strategy_units:
            return 0.0

        # Check for key strategy documents
        has_vision = any('vision' in (u.subtype or '').lower() for u in strategy_units)
        has_priorities = any('priorities' in (u.subtype or '').lower() for u in strategy_units)
        has_principles = any('principles' in (u.subtype or '').lower() for u in strategy_units)

        score = (
            (0.4 if has_vision else 0) +
            (0.35 if has_priorities else 0) +
            (0.25 if has_principles else 0)
        )

        return score

    def _compute_messaging_score(self) -> float:
        """Compute messaging coherence score."""
        messaging_units = [u for u in self.narrative.get_all_units() if u.type.value == 'messaging']

        if not messaging_units:
            return 0.0

        has_pillars = any('pillars' in (u.subtype or '').lower() for u in messaging_units)
        has_voice = any('voice' in (u.subtype or '').lower() for u in messaging_units)
        has_value_props = any('value' in (u.subtype or '').lower() for u in messaging_units)

        score = (
            (0.4 if has_pillars else 0) +
            (0.3 if has_voice else 0) +
            (0.3 if has_value_props else 0)
        )

        return score

    def _compute_naming_score(self) -> float:
        """Compute naming consistency score."""
        forbidden_terms = self.narrative.get_forbidden_terms()

        if not forbidden_terms:
            return 0.5  # Neutral if no forbidden terms defined

        # Check all content for forbidden terms
        all_units = self.narrative.get_all_units()
        violations = 0
        total_checks = 0

        for unit in all_units:
            if not unit.content:
                continue

            content_lower = unit.content.lower()
            total_checks += 1

            for term_info in forbidden_terms:
                term = term_info.get('term', '').lower()
                if term and term in content_lower:
                    violations += 1
                    break  # Count max one violation per unit

        if total_checks == 0:
            return 1.0

        return 1.0 - (violations / total_checks)

    def _compute_proof_score(self) -> float:
        """Compute proof layer health score."""
        metrics = self.narrative.get_proof_metrics()

        if not metrics:
            return 0.0

        verified_count = sum(1 for m in metrics if m.get('verified', False))

        return verified_count / len(metrics)

    def save_coherence(self, coherence: CoherenceScore, drift_events: list[DriftEvent]) -> bool:
        """Save coherence data to file."""
        coherence_path = self.narrative.base_path / 'coherence' / 'current.json'

        try:
            # Read existing data to preserve structure
            if coherence_path.exists():
                data = json.loads(coherence_path.read_text(encoding='utf-8'))
            else:
                data = {}

            # Update score
            data['score'] = {
                'overall': coherence.overall,
                'dimensions': coherence.dimensions,
                'trend': coherence.trend,
                'timestamp': coherence.timestamp.isoformat()
            }

            # Update drift events
            data['drift_events'] = [
                {
                    'id': e.id,
                    'type': e.type.value,
                    'severity': e.severity.value,
                    'detected_at': e.detected_at.isoformat(),
                    'source_unit': e.source_unit,
                    'target_unit': e.target_unit,
                    'description': e.description,
                    'suggested_resolution': e.suggested_resolution,
                    'status': e.status.value
                }
                for e in drift_events
            ]

            data['updated'] = datetime.now().isoformat()

            coherence_path.write_text(
                json.dumps(data, indent=2),
                encoding='utf-8'
            )

            return True
        except Exception as e:
            print(f"Error saving coherence: {e}")
            return False
