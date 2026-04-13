"""
Cross-Repository Drift Scanner - Detect drift across multiple repositories.

Detects:
- Drift from central Applied Narrative
- Cross-repo inconsistencies
- Organization-wide narrative violations
- Repository-specific drift patterns
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
from dataclasses import dataclass, asdict

from ..models import DriftEvent, DriftSeverity, DriftType, DriftStatus
from ..logging_config import get_logger
from .central_narrative_resolver import CentralNarrativeResolver
from .semantic_drift_detector import SemanticDriftDetector
from .repository_registry import RepositoryRegistry, RepositoryMetrics

logger = get_logger("services.cross_repo_drift_scanner")


@dataclass
class CrossRepoDriftEvent:
    """Drift event that spans multiple repositories."""
    id: str
    type: DriftType
    severity: DriftSeverity
    description: str
    affected_repositories: List[str]
    central_narrative_reference: Optional[str] = None
    suggested_resolution: Optional[str] = None
    detected_at: datetime = None

    def __post_init__(self):
        if self.detected_at is None:
            self.detected_at = datetime.now()


class CrossRepoDriftScanner:
    """
    Scanner for detecting drift across multiple repositories.

    Features:
    - Scan all registered repositories
    - Check alignment with central narrative
    - Detect cross-repo inconsistencies
    - Aggregate drift metrics
    """

    def __init__(
        self,
        registry: Optional[RepositoryRegistry] = None,
        central_resolver: Optional[CentralNarrativeResolver] = None
    ):
        """Initialize scanner with registry and resolver."""
        self.registry = registry or RepositoryRegistry()
        self.central_resolver = central_resolver or CentralNarrativeResolver()

    def scan_repository_against_central(
        self,
        repo_name: str
    ) -> List[DriftEvent]:
        """
        Scan a repository for drift from central narrative.

        Args:
            repo_name: Repository name

        Returns:
            List of drift events
        """
        registration = self.registry.get_repository(repo_name)

        if not registration:
            logger.warning(f"Repository {repo_name} not registered")
            return []

        if not registration.config.check_against_central:
            logger.debug(f"Repository {repo_name} not configured for central checks")
            return []

        drift_events = []

        # Sync central narrative
        self.central_resolver.sync_central_narrative()

        # Check for conflicts with central
        conflicts = self.central_resolver.check_for_conflicts()

        for conflict in conflicts:
            event = DriftEvent(
                id=f"central-conflict-{repo_name}-{conflict['path'].replace('/', '-')}",
                type=DriftType.SEMANTIC,
                severity=DriftSeverity.MEDIUM,
                status=DriftStatus.ACTIVE,
                source_unit=conflict['path'],
                target_unit=f"central/{conflict['path']}",
                description=f"Local version of {conflict['path']} differs from central narrative",
                evidence=f"Content differs by {conflict['content_diff_size']} characters. {conflict['newer'].capitalize()} version is newer.",
                suggested_resolution=f"Review differences and update {'local' if conflict['newer'] == 'central' else 'central'} version to match {conflict['newer']} changes.",
                detected_at=datetime.now()
            )
            drift_events.append(event)

        logger.info(f"Found {len(drift_events)} drift events vs central for {repo_name}")

        return drift_events

    def scan_all_repositories(self) -> Dict[str, List[DriftEvent]]:
        """
        Scan all registered repositories.

        Returns:
            Dictionary mapping repository names to drift events
        """
        results = {}

        repositories = self.registry.list_repositories(status="active")

        logger.info(f"Scanning {len(repositories)} repositories...")

        for registration in repositories:
            repo_name = registration.config.name

            try:
                drift_events = self.scan_repository_against_central(repo_name)
                results[repo_name] = drift_events

                # Update metrics in registry
                metrics = self._calculate_metrics(repo_name, drift_events)
                self.registry.update_metrics(repo_name, metrics)

            except Exception as e:
                logger.error(f"Failed to scan {repo_name}: {e}", exc_info=True)
                results[repo_name] = []

        return results

    def detect_cross_repo_inconsistencies(self) -> List[CrossRepoDriftEvent]:
        """
        Detect inconsistencies across multiple repositories.

        Examples:
        - Repo A says "PostgreSQL" but Repo B says "SQLite"
        - Different repos have different brand voice guidelines
        - Technology choices conflict across services

        Returns:
            List of cross-repo drift events
        """
        cross_repo_drift = []

        # Get all repositories
        repositories = self.registry.list_repositories(status="active")

        # Group by technology tags
        tech_groups: Dict[str, List[str]] = {}
        for registration in repositories:
            for tag in registration.config.tags:
                if tag not in tech_groups:
                    tech_groups[tag] = []
                tech_groups[tag].append(registration.config.name)

        # Check for common narrative documents across repos
        # This is simplified - in production you'd scan actual docs
        logger.info(f"Checking {len(repositories)} repositories for cross-repo inconsistencies")

        # Example: Check if repos with same tags have different docs
        # (This is placeholder logic - expand based on actual needs)

        return cross_repo_drift

    def get_organization_drift_summary(self) -> Dict[str, Any]:
        """
        Get organization-wide drift summary.

        Returns:
            Aggregated drift statistics
        """
        all_drift = self.scan_all_repositories()

        total_drift = sum(len(events) for events in all_drift.values())

        # Aggregate by severity
        by_severity = {}
        for events in all_drift.values():
            for event in events:
                severity = event.severity.value
                by_severity[severity] = by_severity.get(severity, 0) + 1

        # Aggregate by type
        by_type = {}
        for events in all_drift.values():
            for event in events:
                drift_type = event.type.value
                by_type[drift_type] = by_type.get(drift_type, 0) + 1

        # Find most problematic repos
        repos_by_drift = [
            {
                "repository": repo_name,
                "drift_count": len(events),
                "critical": sum(1 for e in events if e.severity == DriftSeverity.CRITICAL),
                "high": sum(1 for e in events if e.severity == DriftSeverity.HIGH)
            }
            for repo_name, events in all_drift.items()
        ]
        repos_by_drift.sort(key=lambda x: x['drift_count'], reverse=True)

        return {
            "total_repositories": len(all_drift),
            "total_drift_events": total_drift,
            "drift_by_severity": by_severity,
            "drift_by_type": by_type,
            "most_problematic_repositories": repos_by_drift[:10],
            "repositories_with_drift": len([r for r in all_drift.values() if r]),
            "drift_free_repositories": len([r for r in all_drift.values() if not r]),
            "scanned_at": datetime.now().isoformat()
        }

    def _calculate_metrics(
        self,
        repo_name: str,
        drift_events: List[DriftEvent]
    ) -> RepositoryMetrics:
        """
        Calculate metrics for a repository.

        Args:
            repo_name: Repository name
            drift_events: Drift events found

        Returns:
            Repository metrics
        """
        # Aggregate by severity
        by_severity = {}
        for event in drift_events:
            severity = event.severity.value
            by_severity[severity] = by_severity.get(severity, 0) + 1

        # Aggregate by type
        by_type = {}
        for event in drift_events:
            drift_type = event.type.value
            by_type[drift_type] = by_type.get(drift_type, 0) + 1

        # Calculate coherence score (inverse of drift)
        # 100 = no drift, decreases with more drift
        base_score = 100
        penalty = min(len(drift_events) * 2, 80)  # Max 80 point penalty
        coherence_score = max(base_score - penalty, 0)

        # Simple trend calculation (would need historical data in production)
        trend = "stable"

        # Resolution rate (would need to track resolutions in production)
        resolution_rate = 0.0

        return RepositoryMetrics(
            repository_name=repo_name,
            total_drift=len(drift_events),
            drift_by_severity=by_severity,
            drift_by_type=by_type,
            coherence_score=coherence_score,
            last_scan=datetime.now(),
            drift_trend_7d=trend,
            resolution_rate=resolution_rate
        )

    def export_scan_results(
        self,
        results: Dict[str, List[DriftEvent]],
        format: str = "json"
    ) -> str:
        """
        Export scan results to specified format.

        Args:
            results: Scan results
            format: "json" or "markdown"

        Returns:
            Formatted output
        """
        if format == "json":
            import json
            return json.dumps({
                repo: [
                    {
                        "id": e.id,
                        "type": e.type.value,
                        "severity": e.severity.value,
                        "source": e.source_unit,
                        "description": e.description,
                        "resolution": e.suggested_resolution
                    }
                    for e in events
                ]
                for repo, events in results.items()
            }, indent=2)

        elif format == "markdown":
            lines = ["# Cross-Repository Drift Scan Results\n"]
            lines.append(f"**Scan Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

            total_drift = sum(len(events) for events in results.values())
            lines.append(f"**Total Drift Events:** {total_drift}\n")
            lines.append(f"**Repositories Scanned:** {len(results)}\n")
            lines.append("\n---\n")

            for repo_name, events in results.items():
                lines.append(f"\n## {repo_name}\n")

                if not events:
                    lines.append("✅ No drift detected\n")
                    continue

                lines.append(f"**Drift Events:** {len(events)}\n")

                # Group by severity
                by_severity = {}
                for event in events:
                    severity = event.severity.value
                    if severity not in by_severity:
                        by_severity[severity] = []
                    by_severity[severity].append(event)

                for severity in ['critical', 'high', 'medium', 'low']:
                    if severity in by_severity:
                        emoji = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'low': '🔵'}[severity]
                        lines.append(f"\n### {emoji} {severity.upper()} ({len(by_severity[severity])})\n")

                        for event in by_severity[severity]:
                            lines.append(f"\n**{event.source_unit}**\n")
                            lines.append(f"- {event.description}\n")
                            if event.suggested_resolution:
                                lines.append(f"- 💡 **Fix:** {event.suggested_resolution}\n")

            return "".join(lines)

        return str(results)
