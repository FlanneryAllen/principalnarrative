"""
Git Manager - Automated version control for narrative documents.

Handles:
- Automated commits for synthesized documents
- Branch management for draft changes
- PR creation for significant updates
- Change tracking and history
"""
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from ..config import settings


class ChangeType(str, Enum):
    """Types of changes to narrative documents."""
    ADD = "add"
    UPDATE = "update"
    DELETE = "delete"
    DRIFT_FIX = "drift_fix"


@dataclass
class PendingChange:
    """A change pending commit."""
    path: Path
    change_type: ChangeType
    description: str
    source: str  # Where the change came from
    metadata: Dict[str, Any]


@dataclass
class CommitResult:
    """Result from a commit operation."""
    success: bool
    commit_hash: Optional[str]
    message: str
    files_changed: int


@dataclass
class PRResult:
    """Result from PR creation."""
    success: bool
    pr_url: Optional[str]
    pr_number: Optional[int]
    message: str


class GitManager:
    """
    Manages Git operations for the narrative layer.

    Features:
    - Queue changes and batch commit
    - Create branches for draft changes
    - Generate meaningful commit messages
    - Create PRs for review
    """

    def __init__(self, repo_path: Optional[Path] = None):
        """Initialize with repository path."""
        self.repo_path = repo_path or settings.narrative_base_path.parent
        self.pending_changes: List[PendingChange] = []

    def _run_git(self, *args, check: bool = True) -> subprocess.CompletedProcess:
        """Run a git command in the repository."""
        return subprocess.run(
            ["git", *args],
            cwd=self.repo_path,
            capture_output=True,
            text=True,
            check=check
        )

    def is_git_repo(self) -> bool:
        """Check if the path is a git repository."""
        try:
            self._run_git("rev-parse", "--git-dir")
            return True
        except subprocess.CalledProcessError:
            return False

    def get_current_branch(self) -> str:
        """Get the current branch name."""
        result = self._run_git("branch", "--show-current")
        return result.stdout.strip()

    def has_changes(self) -> bool:
        """Check if there are uncommitted changes."""
        result = self._run_git("status", "--porcelain")
        return bool(result.stdout.strip())

    def get_changed_files(self) -> List[str]:
        """Get list of changed files."""
        result = self._run_git("status", "--porcelain")
        files = []
        for line in result.stdout.strip().split("\n"):
            if line:
                # Format is "XY filename" where XY is status
                files.append(line[3:])
        return files

    # =========================================================================
    # Change Queue Management
    # =========================================================================

    def queue_change(
        self,
        path: Path,
        change_type: ChangeType,
        description: str,
        source: str = "synthesizer",
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Add a change to the pending queue."""
        self.pending_changes.append(PendingChange(
            path=path,
            change_type=change_type,
            description=description,
            source=source,
            metadata=metadata or {}
        ))

    def clear_queue(self):
        """Clear pending changes."""
        self.pending_changes = []

    def get_queue_summary(self) -> Dict[str, Any]:
        """Get summary of pending changes."""
        by_type = {}
        for change in self.pending_changes:
            by_type[change.change_type.value] = by_type.get(change.change_type.value, 0) + 1

        return {
            "total": len(self.pending_changes),
            "by_type": by_type,
            "changes": [
                {
                    "path": str(change.path),
                    "type": change.change_type.value,
                    "description": change.description
                }
                for change in self.pending_changes
            ]
        }

    # =========================================================================
    # Commit Operations
    # =========================================================================

    def commit_pending(
        self,
        message: Optional[str] = None,
        author: str = "Principal Narrative <narrative@principal.ai>"
    ) -> CommitResult:
        """
        Commit all pending changes.

        Args:
            message: Custom commit message (auto-generated if not provided)
            author: Git author string

        Returns:
            CommitResult with details
        """
        if not self.pending_changes:
            return CommitResult(
                success=False,
                commit_hash=None,
                message="No pending changes to commit",
                files_changed=0
            )

        try:
            # Stage files
            for change in self.pending_changes:
                if change.change_type == ChangeType.DELETE:
                    self._run_git("rm", str(change.path), check=False)
                else:
                    self._run_git("add", str(change.path))

            # Generate commit message if not provided
            if not message:
                message = self._generate_commit_message()

            # Commit
            result = self._run_git(
                "commit",
                "-m", message,
                f"--author={author}"
            )

            # Get commit hash
            hash_result = self._run_git("rev-parse", "HEAD")
            commit_hash = hash_result.stdout.strip()

            files_changed = len(self.pending_changes)
            self.clear_queue()

            return CommitResult(
                success=True,
                commit_hash=commit_hash,
                message=message,
                files_changed=files_changed
            )

        except subprocess.CalledProcessError as e:
            return CommitResult(
                success=False,
                commit_hash=None,
                message=f"Git error: {e.stderr}",
                files_changed=0
            )

    def _generate_commit_message(self) -> str:
        """Generate a commit message from pending changes."""
        if not self.pending_changes:
            return "Update narrative documents"

        # Group by type
        by_type = {}
        for change in self.pending_changes:
            if change.change_type not in by_type:
                by_type[change.change_type] = []
            by_type[change.change_type].append(change)

        # Build message
        lines = []

        # Title based on primary action
        if ChangeType.ADD in by_type:
            count = len(by_type[ChangeType.ADD])
            lines.append(f"Add {count} narrative document{'s' if count > 1 else ''}")
        elif ChangeType.UPDATE in by_type:
            count = len(by_type[ChangeType.UPDATE])
            lines.append(f"Update {count} narrative document{'s' if count > 1 else ''}")
        elif ChangeType.DRIFT_FIX in by_type:
            count = len(by_type[ChangeType.DRIFT_FIX])
            lines.append(f"Fix drift in {count} document{'s' if count > 1 else ''}")
        else:
            lines.append("Update narrative layer")

        lines.append("")

        # Details
        for change in self.pending_changes[:10]:  # Limit to 10
            emoji = {
                ChangeType.ADD: "+",
                ChangeType.UPDATE: "~",
                ChangeType.DELETE: "-",
                ChangeType.DRIFT_FIX: "!"
            }.get(change.change_type, "*")

            lines.append(f"{emoji} {change.path.name}: {change.description}")

        if len(self.pending_changes) > 10:
            lines.append(f"... and {len(self.pending_changes) - 10} more")

        lines.append("")
        lines.append("Generated by Principal Narrative")

        return "\n".join(lines)

    # =========================================================================
    # Branch Management
    # =========================================================================

    def create_branch(self, name: str, checkout: bool = True) -> bool:
        """Create a new branch."""
        try:
            self._run_git("branch", name)
            if checkout:
                self._run_git("checkout", name)
            return True
        except subprocess.CalledProcessError:
            return False

    def create_draft_branch(self) -> str:
        """Create a branch for draft changes."""
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        branch_name = f"narrative/draft-{timestamp}"
        self.create_branch(branch_name)
        return branch_name

    def checkout(self, branch: str) -> bool:
        """Checkout a branch."""
        try:
            self._run_git("checkout", branch)
            return True
        except subprocess.CalledProcessError:
            return False

    def merge(self, branch: str, message: Optional[str] = None) -> bool:
        """Merge a branch into current branch."""
        try:
            args = ["merge", branch]
            if message:
                args.extend(["-m", message])
            self._run_git(*args)
            return True
        except subprocess.CalledProcessError:
            return False

    # =========================================================================
    # PR Operations (requires gh CLI)
    # =========================================================================

    def create_pr(
        self,
        title: str,
        body: str,
        base: str = "main",
        draft: bool = True
    ) -> PRResult:
        """
        Create a pull request using gh CLI.

        Args:
            title: PR title
            body: PR body/description
            base: Base branch
            draft: Create as draft PR

        Returns:
            PRResult with details
        """
        try:
            args = ["gh", "pr", "create",
                    "--title", title,
                    "--body", body,
                    "--base", base]

            if draft:
                args.append("--draft")

            result = subprocess.run(
                args,
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=True
            )

            # Parse PR URL from output
            pr_url = result.stdout.strip()

            # Extract PR number from URL
            pr_number = None
            if "/pull/" in pr_url:
                pr_number = int(pr_url.split("/pull/")[-1])

            return PRResult(
                success=True,
                pr_url=pr_url,
                pr_number=pr_number,
                message="PR created successfully"
            )

        except subprocess.CalledProcessError as e:
            return PRResult(
                success=False,
                pr_url=None,
                pr_number=None,
                message=f"Failed to create PR: {e.stderr}"
            )

        except FileNotFoundError:
            return PRResult(
                success=False,
                pr_url=None,
                pr_number=None,
                message="gh CLI not found. Install with: brew install gh"
            )

    def push(self, branch: Optional[str] = None, set_upstream: bool = True) -> bool:
        """Push to remote."""
        try:
            args = ["push"]
            if set_upstream:
                args.extend(["-u", "origin"])
            if branch:
                args.append(branch)

            self._run_git(*args)
            return True
        except subprocess.CalledProcessError:
            return False

    # =========================================================================
    # History & Tracking
    # =========================================================================

    def get_file_history(self, path: Path, limit: int = 10) -> List[Dict[str, Any]]:
        """Get commit history for a specific file."""
        try:
            result = self._run_git(
                "log",
                f"-{limit}",
                "--pretty=format:%H|%an|%ae|%ai|%s",
                "--",
                str(path)
            )

            history = []
            for line in result.stdout.strip().split("\n"):
                if line:
                    parts = line.split("|")
                    if len(parts) >= 5:
                        history.append({
                            "hash": parts[0],
                            "author_name": parts[1],
                            "author_email": parts[2],
                            "date": parts[3],
                            "message": parts[4]
                        })

            return history

        except subprocess.CalledProcessError:
            return []

    def get_recent_commits(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent commits."""
        try:
            result = self._run_git(
                "log",
                f"-{limit}",
                "--pretty=format:%H|%an|%ai|%s"
            )

            commits = []
            for line in result.stdout.strip().split("\n"):
                if line:
                    parts = line.split("|")
                    if len(parts) >= 4:
                        commits.append({
                            "hash": parts[0],
                            "author": parts[1],
                            "date": parts[2],
                            "message": parts[3]
                        })

            return commits

        except subprocess.CalledProcessError:
            return []

    def get_diff(self, path: Optional[Path] = None) -> str:
        """Get diff for staged changes."""
        try:
            args = ["diff", "--staged"]
            if path:
                args.extend(["--", str(path)])

            result = self._run_git(*args)
            return result.stdout

        except subprocess.CalledProcessError:
            return ""


# Singleton instance
_git_manager: Optional[GitManager] = None


def get_git_manager() -> GitManager:
    """Get or create the git manager singleton."""
    global _git_manager
    if _git_manager is None:
        _git_manager = GitManager()
    return _git_manager
