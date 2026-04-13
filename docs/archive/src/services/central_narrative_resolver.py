"""
Central Narrative Resolver - Resolve and merge central + local narratives.

Manages:
- Loading central Applied Narrative from Git
- Merging central with local narrative
- Handling override policies
- Syncing updates from central
"""
import os
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass

from ..logging_config import get_logger

logger = get_logger("services.central_narrative_resolver")


@dataclass
class NarrativeDocument:
    """A narrative document with metadata."""
    path: str
    content: str
    source: str  # "central" or "local"
    last_updated: datetime


class CentralNarrativeResolver:
    """
    Service for resolving central and local narratives.

    Features:
    - Clone/sync central narrative repository
    - Merge central with local narrative
    - Handle override policies (local_wins, central_wins, merge, error)
    - Track sync status
    """

    def __init__(
        self,
        config_path: Optional[Path] = None,
        cache_dir: Optional[Path] = None
    ):
        """
        Initialize resolver.

        Args:
            config_path: Path to .narrative-config.json
            cache_dir: Directory for caching central narrative
        """
        self.config_path = config_path or Path(".narrative-config.json")
        self.cache_dir = cache_dir or Path("data/central_narrative_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self.config = self._load_config()
        self.central_repo_path: Optional[Path] = None
        self.last_sync: Optional[datetime] = None

    def _load_config(self) -> Dict[str, Any]:
        """Load repository configuration."""
        if not self.config_path.exists():
            logger.warning(f"Configuration not found at {self.config_path}")
            return {}

        try:
            return json.loads(self.config_path.read_text(encoding='utf-8'))
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return {}

    def is_central_mode(self) -> bool:
        """Check if repository uses central narrative."""
        narrative_config = self.config.get('narrative', {})
        mode = narrative_config.get('mode', 'standalone')
        return mode in ['central', 'hybrid']

    def needs_sync(self) -> bool:
        """Check if central narrative needs syncing."""
        if not self.is_central_mode():
            return False

        if not self.last_sync:
            return True

        narrative_config = self.config.get('narrative', {})
        central_config = narrative_config.get('central_repository', {})
        sync_interval = central_config.get('sync_interval', 'daily')

        intervals = {
            'manual': timedelta(days=365),  # Effectively never
            'hourly': timedelta(hours=1),
            'daily': timedelta(days=1),
            'weekly': timedelta(weeks=1)
        }

        interval = intervals.get(sync_interval, timedelta(days=1))
        return datetime.now() - self.last_sync > interval

    def sync_central_narrative(self, force: bool = False) -> bool:
        """
        Sync central narrative from Git.

        Args:
            force: Force sync even if not needed

        Returns:
            True if synced successfully
        """
        if not self.is_central_mode():
            logger.info("Not in central mode, skipping sync")
            return False

        if not force and not self.needs_sync():
            logger.debug("Sync not needed yet")
            return True

        narrative_config = self.config.get('narrative', {})
        central_config = narrative_config.get('central_repository', {})

        repo_url = central_config.get('url')
        branch = central_config.get('branch', 'main')
        repo_path = central_config.get('path', '.principalnarrative/applied-narrative')

        if not repo_url:
            logger.error("No central repository URL configured")
            return False

        # Determine cache directory for this repo
        repo_name = repo_url.rstrip('/').split('/')[-1].replace('.git', '')
        self.central_repo_path = self.cache_dir / repo_name

        try:
            # Clone or pull
            if not self.central_repo_path.exists():
                logger.info(f"Cloning central narrative from {repo_url}...")
                result = subprocess.run(
                    ['git', 'clone', '--depth', '1', '--branch', branch, repo_url, str(self.central_repo_path)],
                    capture_output=True,
                    text=True,
                    timeout=60
                )

                if result.returncode != 0:
                    logger.error(f"Git clone failed: {result.stderr}")
                    return False

                logger.info("Central narrative cloned successfully")
            else:
                logger.info(f"Pulling updates for central narrative...")
                result = subprocess.run(
                    ['git', 'pull', 'origin', branch],
                    cwd=self.central_repo_path,
                    capture_output=True,
                    text=True,
                    timeout=30
                )

                if result.returncode != 0:
                    logger.error(f"Git pull failed: {result.stderr}")
                    return False

                logger.info("Central narrative updated successfully")

            self.last_sync = datetime.now()
            return True

        except subprocess.TimeoutExpired:
            logger.error("Git operation timed out")
            return False
        except Exception as e:
            logger.error(f"Failed to sync central narrative: {e}", exc_info=True)
            return False

    def get_central_document(self, relative_path: str) -> Optional[NarrativeDocument]:
        """
        Get document from central narrative.

        Args:
            relative_path: Path relative to narrative root (e.g., "vision.md")

        Returns:
            Document or None if not found
        """
        if not self.central_repo_path:
            self.sync_central_narrative()

        if not self.central_repo_path:
            return None

        narrative_config = self.config.get('narrative', {})
        central_config = narrative_config.get('central_repository', {})
        narrative_path = central_config.get('path', '.principalnarrative/applied-narrative')

        full_path = self.central_repo_path / narrative_path / relative_path

        if not full_path.exists():
            logger.debug(f"Central document not found: {relative_path}")
            return None

        try:
            content = full_path.read_text(encoding='utf-8')

            # Get last modified time from git
            result = subprocess.run(
                ['git', 'log', '-1', '--format=%cI', '--', str(full_path.relative_to(self.central_repo_path))],
                cwd=self.central_repo_path,
                capture_output=True,
                text=True
            )

            if result.returncode == 0 and result.stdout.strip():
                last_updated = datetime.fromisoformat(result.stdout.strip().replace('Z', '+00:00'))
            else:
                last_updated = datetime.fromtimestamp(full_path.stat().st_mtime)

            return NarrativeDocument(
                path=relative_path,
                content=content,
                source="central",
                last_updated=last_updated
            )

        except Exception as e:
            logger.error(f"Failed to read central document {relative_path}: {e}")
            return None

    def get_local_document(self, relative_path: str) -> Optional[NarrativeDocument]:
        """
        Get document from local narrative.

        Args:
            relative_path: Path relative to narrative root

        Returns:
            Document or None if not found
        """
        narrative_config = self.config.get('narrative', {})
        local_config = narrative_config.get('local_narrative', {})
        narrative_path = local_config.get('path', '.principalnarrative/applied-narrative')

        full_path = Path(narrative_path) / relative_path

        if not full_path.exists():
            logger.debug(f"Local document not found: {relative_path}")
            return None

        try:
            content = full_path.read_text(encoding='utf-8')
            last_updated = datetime.fromtimestamp(full_path.stat().st_mtime)

            return NarrativeDocument(
                path=relative_path,
                content=content,
                source="local",
                last_updated=last_updated
            )

        except Exception as e:
            logger.error(f"Failed to read local document {relative_path}: {e}")
            return None

    def resolve_document(self, relative_path: str) -> Optional[NarrativeDocument]:
        """
        Resolve document using override policy.

        Args:
            relative_path: Path relative to narrative root

        Returns:
            Resolved document (merged or chosen based on policy)
        """
        narrative_config = self.config.get('narrative', {})
        override_policy = narrative_config.get('override_policy', 'local_wins')

        central_doc = self.get_central_document(relative_path)
        local_doc = self.get_local_document(relative_path)

        # Only one exists
        if central_doc and not local_doc:
            return central_doc
        if local_doc and not central_doc:
            return local_doc

        # Neither exists
        if not central_doc and not local_doc:
            return None

        # Both exist - apply policy
        if override_policy == "local_wins":
            logger.debug(f"Using local version of {relative_path} (policy=local_wins)")
            return local_doc

        elif override_policy == "central_wins":
            logger.debug(f"Using central version of {relative_path} (policy=central_wins)")
            return central_doc

        elif override_policy == "merge":
            # Simple merge: concatenate with separator
            logger.debug(f"Merging {relative_path} (policy=merge)")
            merged_content = f"""# Merged from Central and Local

## From Central Narrative
{central_doc.content}

---

## From Local Narrative
{local_doc.content}
"""
            return NarrativeDocument(
                path=relative_path,
                content=merged_content,
                source="merged",
                last_updated=max(central_doc.last_updated, local_doc.last_updated)
            )

        elif override_policy == "error":
            logger.error(f"Conflict for {relative_path}: both central and local exist (policy=error)")
            raise ValueError(f"Document conflict: {relative_path} exists in both central and local")

        return local_doc  # Default fallback

    def list_all_documents(self) -> List[str]:
        """
        List all available narrative documents (central + local).

        Returns:
            List of relative paths
        """
        documents = set()

        # List central documents
        if self.is_central_mode() and self.central_repo_path:
            narrative_config = self.config.get('narrative', {})
            central_config = narrative_config.get('central_repository', {})
            narrative_path = central_config.get('path', '.principalnarrative/applied-narrative')

            central_narrative_dir = self.central_repo_path / narrative_path

            if central_narrative_dir.exists():
                for file in central_narrative_dir.rglob('*.md'):
                    if not file.name.startswith('.') and '.meta' not in file.parts:
                        rel_path = str(file.relative_to(central_narrative_dir))
                        documents.add(rel_path)

        # List local documents
        narrative_config = self.config.get('narrative', {})
        local_config = narrative_config.get('local_narrative', {})
        local_narrative_path = Path(local_config.get('path', '.principalnarrative/applied-narrative'))

        if local_narrative_path.exists():
            for file in local_narrative_path.rglob('*.md'):
                if not file.name.startswith('.') and '.meta' not in file.parts:
                    rel_path = str(file.relative_to(local_narrative_path))
                    documents.add(rel_path)

        return sorted(list(documents))

    def get_all_documents(self) -> Dict[str, NarrativeDocument]:
        """
        Get all resolved narrative documents.

        Returns:
            Dictionary mapping paths to resolved documents
        """
        all_docs = {}

        for path in self.list_all_documents():
            try:
                doc = self.resolve_document(path)
                if doc:
                    all_docs[path] = doc
            except Exception as e:
                logger.error(f"Failed to resolve {path}: {e}")

        return all_docs

    def check_for_conflicts(self) -> List[Dict[str, Any]]:
        """
        Check for conflicts between central and local narratives.

        Returns:
            List of conflicts with details
        """
        conflicts = []

        for path in self.list_all_documents():
            central_doc = self.get_central_document(path)
            local_doc = self.get_local_document(path)

            # Both exist and content differs
            if central_doc and local_doc and central_doc.content != local_doc.content:
                conflicts.append({
                    "path": path,
                    "central_last_updated": central_doc.last_updated.isoformat(),
                    "local_last_updated": local_doc.last_updated.isoformat(),
                    "newer": "local" if local_doc.last_updated > central_doc.last_updated else "central",
                    "content_diff_size": abs(len(central_doc.content) - len(local_doc.content))
                })

        return conflicts

    def get_sync_status(self) -> Dict[str, Any]:
        """
        Get current sync status.

        Returns:
            Status information
        """
        return {
            "is_central_mode": self.is_central_mode(),
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
            "needs_sync": self.needs_sync(),
            "central_repo_cached": self.central_repo_path.exists() if self.central_repo_path else False,
            "total_documents": len(self.list_all_documents()),
            "conflicts": len(self.check_for_conflicts())
        }
