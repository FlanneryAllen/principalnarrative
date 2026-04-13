"""
Repository Registry Service - Track repositories using the narrative system.

Manages:
- Repository registration and metadata
- Central narrative references
- Cross-repo drift tracking
- Organization-wide analytics aggregation
"""
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

from ..logging_config import get_logger

logger = get_logger("services.repository_registry")


class RepositoryType(str, Enum):
    """Type of repository."""
    SERVICE = "service"
    LIBRARY = "library"
    FRONTEND = "frontend"
    MOBILE = "mobile"
    DOCS = "docs"
    MONOREPO = "monorepo"
    OTHER = "other"


class NarrativeMode(str, Enum):
    """How repository uses narrative."""
    STANDALONE = "standalone"  # Local narrative only
    CENTRAL = "central"  # References central narrative
    HYBRID = "hybrid"  # Both local and central


@dataclass
class RepositoryConfig:
    """Repository configuration."""
    name: str
    type: RepositoryType
    mode: NarrativeMode
    description: Optional[str] = None
    owner_team: Optional[str] = None
    owner_contact: Optional[str] = None
    central_repo_url: Optional[str] = None
    central_repo_branch: str = "main"
    local_narrative_path: str = ".principalnarrative/applied-narrative"
    drift_detection_enabled: bool = True
    check_against_central: bool = True
    report_to_org: bool = True
    tags: List[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


@dataclass
class RepositoryMetrics:
    """Repository drift and coherence metrics."""
    repository_name: str
    total_drift: int
    drift_by_severity: Dict[str, int]
    drift_by_type: Dict[str, int]
    coherence_score: float
    last_scan: datetime
    drift_trend_7d: str  # "increasing", "decreasing", "stable"
    resolution_rate: float


@dataclass
class RepositoryRegistration:
    """Complete repository registration record."""
    config: RepositoryConfig
    metrics: Optional[RepositoryMetrics] = None
    registered_at: datetime = None
    last_updated: datetime = None
    last_heartbeat: datetime = None
    status: str = "active"  # "active", "inactive", "archived"

    def __post_init__(self):
        if self.registered_at is None:
            self.registered_at = datetime.now()
        if self.last_updated is None:
            self.last_updated = datetime.now()


class RepositoryRegistry:
    """
    Service for managing repository registrations.

    Features:
    - Register repositories using the narrative system
    - Track central narrative references
    - Store repository metadata and configuration
    - Aggregate drift metrics across repositories
    - Provide org-level visibility
    """

    def __init__(self, data_dir: Optional[Path] = None):
        """Initialize registry with data directory."""
        self.data_dir = data_dir or Path("data/repository_registry")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.registry_file = self.data_dir / "registry.json"
        self.repositories: Dict[str, RepositoryRegistration] = {}
        self._load_registry()

    def _load_registry(self):
        """Load registry from disk."""
        if not self.registry_file.exists():
            logger.info("No existing registry found, starting fresh")
            return

        try:
            data = json.loads(self.registry_file.read_text(encoding='utf-8'))

            for repo_data in data.get('repositories', []):
                config_data = repo_data['config']
                config = RepositoryConfig(
                    name=config_data['name'],
                    type=RepositoryType(config_data['type']),
                    mode=NarrativeMode(config_data['mode']),
                    description=config_data.get('description'),
                    owner_team=config_data.get('owner_team'),
                    owner_contact=config_data.get('owner_contact'),
                    central_repo_url=config_data.get('central_repo_url'),
                    central_repo_branch=config_data.get('central_repo_branch', 'main'),
                    local_narrative_path=config_data.get('local_narrative_path', '.principalnarrative/applied-narrative'),
                    drift_detection_enabled=config_data.get('drift_detection_enabled', True),
                    check_against_central=config_data.get('check_against_central', True),
                    report_to_org=config_data.get('report_to_org', True),
                    tags=config_data.get('tags', [])
                )

                metrics = None
                if 'metrics' in repo_data and repo_data['metrics']:
                    metrics_data = repo_data['metrics']
                    metrics = RepositoryMetrics(
                        repository_name=metrics_data['repository_name'],
                        total_drift=metrics_data['total_drift'],
                        drift_by_severity=metrics_data['drift_by_severity'],
                        drift_by_type=metrics_data['drift_by_type'],
                        coherence_score=metrics_data['coherence_score'],
                        last_scan=datetime.fromisoformat(metrics_data['last_scan']),
                        drift_trend_7d=metrics_data['drift_trend_7d'],
                        resolution_rate=metrics_data['resolution_rate']
                    )

                registration = RepositoryRegistration(
                    config=config,
                    metrics=metrics,
                    registered_at=datetime.fromisoformat(repo_data['registered_at']),
                    last_updated=datetime.fromisoformat(repo_data['last_updated']),
                    last_heartbeat=datetime.fromisoformat(repo_data['last_heartbeat']) if repo_data.get('last_heartbeat') else None,
                    status=repo_data.get('status', 'active')
                )

                self.repositories[config.name] = registration

            logger.info(f"Loaded {len(self.repositories)} repositories from registry")

        except Exception as e:
            logger.error(f"Failed to load registry: {e}", exc_info=True)

    def _save_registry(self):
        """Save registry to disk."""
        try:
            data = {
                "version": "1.0.0",
                "last_updated": datetime.now().isoformat(),
                "total_repositories": len(self.repositories),
                "repositories": []
            }

            for registration in self.repositories.values():
                repo_data = {
                    "config": {
                        "name": registration.config.name,
                        "type": registration.config.type.value,
                        "mode": registration.config.mode.value,
                        "description": registration.config.description,
                        "owner_team": registration.config.owner_team,
                        "owner_contact": registration.config.owner_contact,
                        "central_repo_url": registration.config.central_repo_url,
                        "central_repo_branch": registration.config.central_repo_branch,
                        "local_narrative_path": registration.config.local_narrative_path,
                        "drift_detection_enabled": registration.config.drift_detection_enabled,
                        "check_against_central": registration.config.check_against_central,
                        "report_to_org": registration.config.report_to_org,
                        "tags": registration.config.tags
                    },
                    "metrics": None,
                    "registered_at": registration.registered_at.isoformat(),
                    "last_updated": registration.last_updated.isoformat(),
                    "last_heartbeat": registration.last_heartbeat.isoformat() if registration.last_heartbeat else None,
                    "status": registration.status
                }

                if registration.metrics:
                    repo_data["metrics"] = {
                        "repository_name": registration.metrics.repository_name,
                        "total_drift": registration.metrics.total_drift,
                        "drift_by_severity": registration.metrics.drift_by_severity,
                        "drift_by_type": registration.metrics.drift_by_type,
                        "coherence_score": registration.metrics.coherence_score,
                        "last_scan": registration.metrics.last_scan.isoformat(),
                        "drift_trend_7d": registration.metrics.drift_trend_7d,
                        "resolution_rate": registration.metrics.resolution_rate
                    }

                data["repositories"].append(repo_data)

            self.registry_file.write_text(json.dumps(data, indent=2), encoding='utf-8')
            logger.debug("Registry saved successfully")

        except Exception as e:
            logger.error(f"Failed to save registry: {e}", exc_info=True)

    def register_repository(self, config: RepositoryConfig) -> bool:
        """
        Register a new repository.

        Args:
            config: Repository configuration

        Returns:
            True if registered, False if already exists
        """
        if config.name in self.repositories:
            logger.warning(f"Repository {config.name} already registered")
            return False

        registration = RepositoryRegistration(config=config)
        self.repositories[config.name] = registration
        self._save_registry()

        logger.info(f"Registered repository: {config.name} (type={config.type.value}, mode={config.mode.value})")
        return True

    def update_repository(self, name: str, updates: Dict[str, Any]) -> bool:
        """
        Update repository configuration.

        Args:
            name: Repository name
            updates: Fields to update

        Returns:
            True if updated, False if not found
        """
        if name not in self.repositories:
            logger.warning(f"Repository {name} not found")
            return False

        registration = self.repositories[name]

        # Update config fields
        for field, value in updates.items():
            if hasattr(registration.config, field):
                setattr(registration.config, field, value)

        registration.last_updated = datetime.now()
        self._save_registry()

        logger.info(f"Updated repository: {name}")
        return True

    def unregister_repository(self, name: str) -> bool:
        """
        Unregister a repository.

        Args:
            name: Repository name

        Returns:
            True if unregistered, False if not found
        """
        if name not in self.repositories:
            return False

        del self.repositories[name]
        self._save_registry()

        logger.info(f"Unregistered repository: {name}")
        return True

    def update_metrics(self, name: str, metrics: RepositoryMetrics):
        """
        Update repository metrics.

        Args:
            name: Repository name
            metrics: Latest metrics
        """
        if name not in self.repositories:
            logger.warning(f"Cannot update metrics for unknown repository: {name}")
            return

        self.repositories[name].metrics = metrics
        self.repositories[name].last_updated = datetime.now()
        self._save_registry()

        logger.debug(f"Updated metrics for {name}: {metrics.total_drift} drift events")

    def heartbeat(self, name: str):
        """
        Record heartbeat from repository.

        Args:
            name: Repository name
        """
        if name not in self.repositories:
            logger.warning(f"Heartbeat from unknown repository: {name}")
            return

        self.repositories[name].last_heartbeat = datetime.now()
        self._save_registry()

    def get_repository(self, name: str) -> Optional[RepositoryRegistration]:
        """Get repository registration by name."""
        return self.repositories.get(name)

    def list_repositories(
        self,
        repo_type: Optional[RepositoryType] = None,
        mode: Optional[NarrativeMode] = None,
        tags: Optional[List[str]] = None,
        status: Optional[str] = None
    ) -> List[RepositoryRegistration]:
        """
        List repositories with optional filters.

        Args:
            repo_type: Filter by repository type
            mode: Filter by narrative mode
            tags: Filter by tags (must have all specified tags)
            status: Filter by status

        Returns:
            List of matching repositories
        """
        results = list(self.repositories.values())

        if repo_type:
            results = [r for r in results if r.config.type == repo_type]

        if mode:
            results = [r for r in results if r.config.mode == mode]

        if tags:
            results = [r for r in results if all(tag in r.config.tags for tag in tags)]

        if status:
            results = [r for r in results if r.status == status]

        return results

    def get_organization_summary(self) -> Dict[str, Any]:
        """
        Get organization-wide summary.

        Returns:
            Aggregated metrics and statistics
        """
        active_repos = [r for r in self.repositories.values() if r.status == "active"]
        repos_with_metrics = [r for r in active_repos if r.metrics]

        # Aggregate drift
        total_drift = sum(r.metrics.total_drift for r in repos_with_metrics)

        # Aggregate by severity
        all_severities = {}
        for repo in repos_with_metrics:
            for severity, count in repo.metrics.drift_by_severity.items():
                all_severities[severity] = all_severities.get(severity, 0) + count

        # Aggregate by type
        all_types = {}
        for repo in repos_with_metrics:
            for drift_type, count in repo.metrics.drift_by_type.items():
                all_types[drift_type] = all_types.get(drift_type, 0) + count

        # Average coherence
        avg_coherence = sum(r.metrics.coherence_score for r in repos_with_metrics) / len(repos_with_metrics) if repos_with_metrics else 0

        # Count by mode
        by_mode = {}
        for repo in active_repos:
            mode = repo.config.mode.value
            by_mode[mode] = by_mode.get(mode, 0) + 1

        # Count by type
        by_type = {}
        for repo in active_repos:
            repo_type = repo.config.type.value
            by_type[repo_type] = by_type.get(repo_type, 0) + 1

        return {
            "total_repositories": len(self.repositories),
            "active_repositories": len(active_repos),
            "repositories_with_metrics": len(repos_with_metrics),
            "total_drift_events": total_drift,
            "drift_by_severity": all_severities,
            "drift_by_type": all_types,
            "average_coherence_score": round(avg_coherence, 2),
            "repositories_by_mode": by_mode,
            "repositories_by_type": by_type,
            "last_updated": datetime.now().isoformat()
        }

    def get_top_drift_repositories(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get repositories with most drift.

        Args:
            limit: Maximum number of results

        Returns:
            List of repositories sorted by drift count
        """
        repos_with_metrics = [r for r in self.repositories.values() if r.metrics]
        sorted_repos = sorted(repos_with_metrics, key=lambda r: r.metrics.total_drift, reverse=True)

        return [
            {
                "name": r.config.name,
                "type": r.config.type.value,
                "owner_team": r.config.owner_team,
                "total_drift": r.metrics.total_drift,
                "drift_by_severity": r.metrics.drift_by_severity,
                "coherence_score": r.metrics.coherence_score,
                "trend_7d": r.metrics.drift_trend_7d,
                "last_scan": r.metrics.last_scan.isoformat()
            }
            for r in sorted_repos[:limit]
        ]
