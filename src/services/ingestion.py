"""
Ingestion Service - Captures context from external sources.

Supports:
- Slack messages and threads
- GitHub issues, PRs, and discussions
- Manual text input
- Document uploads
"""
import os
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

try:
    from slack_sdk import WebClient
    from slack_sdk.errors import SlackApiError
    SLACK_AVAILABLE = True
except ImportError:
    SLACK_AVAILABLE = False

try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False

from .synthesizer import ContextSynthesizer, SynthesisRequest


class SourceType(str, Enum):
    """Types of input sources."""
    SLACK = "slack"
    GITHUB = "github"
    MANUAL = "manual"
    DOCUMENT = "document"


@dataclass
class IngestionItem:
    """An item to be ingested."""
    source: SourceType
    content: str
    metadata: Dict[str, Any]
    timestamp: datetime
    url: Optional[str] = None


@dataclass
class IngestionResult:
    """Result from ingestion processing."""
    items_processed: int
    documents_generated: int
    errors: List[str]


class IngestionService:
    """
    Service for ingesting context from external sources.

    Pipeline:
    1. Fetch content from source (Slack, GitHub, etc.)
    2. Filter for context-relevant messages
    3. Pass to synthesizer for document generation
    """

    # Patterns that indicate decision-making context
    CONTEXT_PATTERNS = [
        r"(?:we (?:decided|agreed|should|will|need to))",
        r"(?:decision|priority|important|must|requirement)",
        r"(?:let's|going forward|the plan is)",
        r"(?:ADR|RFC|proposal|spec)",
        r"(?:customer|user|feedback|pain point)",
        r"(?:brand|voice|tone|messaging)",
        r"(?:architecture|design|pattern)",
    ]

    def __init__(self):
        """Initialize ingestion service."""
        self.synthesizer = ContextSynthesizer()
        self.slack_client = None
        self.github_client = None

        self._init_slack()
        self._init_github()

    def _init_slack(self):
        """Initialize Slack client if token available."""
        if SLACK_AVAILABLE:
            token = os.getenv("SLACK_BOT_TOKEN")
            if token:
                self.slack_client = WebClient(token=token)

    def _init_github(self):
        """Initialize GitHub client if token available."""
        if GITHUB_AVAILABLE:
            token = os.getenv("GITHUB_TOKEN")
            if token:
                self.github_client = Github(token)

    # =========================================================================
    # Slack Integration
    # =========================================================================

    def fetch_slack_channel(
        self,
        channel_id: str,
        limit: int = 100,
        oldest: Optional[str] = None
    ) -> List[IngestionItem]:
        """
        Fetch messages from a Slack channel.

        Args:
            channel_id: Slack channel ID
            limit: Maximum messages to fetch
            oldest: Unix timestamp for oldest message

        Returns:
            List of ingestion items
        """
        if not self.slack_client:
            return []

        items = []

        try:
            result = self.slack_client.conversations_history(
                channel=channel_id,
                limit=limit,
                oldest=oldest
            )

            for msg in result.get("messages", []):
                # Skip bot messages and system messages
                if msg.get("subtype"):
                    continue

                text = msg.get("text", "")

                # Check if message contains context-relevant content
                if self._is_context_relevant(text):
                    items.append(IngestionItem(
                        source=SourceType.SLACK,
                        content=text,
                        metadata={
                            "channel": channel_id,
                            "user": msg.get("user"),
                            "ts": msg.get("ts"),
                            "thread_ts": msg.get("thread_ts"),
                            "reactions": [r["name"] for r in msg.get("reactions", [])]
                        },
                        timestamp=datetime.fromtimestamp(float(msg.get("ts", 0))),
                        url=f"https://slack.com/archives/{channel_id}/p{msg.get('ts', '').replace('.', '')}"
                    ))

        except SlackApiError as e:
            print(f"Slack API error: {e}")

        return items

    def fetch_slack_thread(
        self,
        channel_id: str,
        thread_ts: str
    ) -> List[IngestionItem]:
        """Fetch all messages in a Slack thread."""
        if not self.slack_client:
            return []

        items = []

        try:
            result = self.slack_client.conversations_replies(
                channel=channel_id,
                ts=thread_ts
            )

            # Combine all thread messages into one item
            messages = result.get("messages", [])
            if messages:
                combined_text = "\n\n---\n\n".join(
                    msg.get("text", "") for msg in messages
                    if not msg.get("subtype")
                )

                items.append(IngestionItem(
                    source=SourceType.SLACK,
                    content=combined_text,
                    metadata={
                        "channel": channel_id,
                        "thread_ts": thread_ts,
                        "message_count": len(messages),
                        "participants": list(set(m.get("user") for m in messages if m.get("user")))
                    },
                    timestamp=datetime.fromtimestamp(float(thread_ts)),
                    url=f"https://slack.com/archives/{channel_id}/p{thread_ts.replace('.', '')}"
                ))

        except SlackApiError as e:
            print(f"Slack API error: {e}")

        return items

    # =========================================================================
    # GitHub Integration
    # =========================================================================

    def fetch_github_issue(
        self,
        repo: str,
        issue_number: int
    ) -> Optional[IngestionItem]:
        """
        Fetch a GitHub issue with comments.

        Args:
            repo: Repository in format "owner/repo"
            issue_number: Issue number

        Returns:
            Ingestion item with issue content
        """
        if not self.github_client:
            return None

        try:
            repository = self.github_client.get_repo(repo)
            issue = repository.get_issue(issue_number)

            # Combine issue body with comments
            content = f"# {issue.title}\n\n{issue.body or ''}\n\n"

            comments = list(issue.get_comments())
            if comments:
                content += "## Discussion\n\n"
                for comment in comments:
                    content += f"**{comment.user.login}** ({comment.created_at.strftime('%Y-%m-%d')}):\n{comment.body}\n\n---\n\n"

            return IngestionItem(
                source=SourceType.GITHUB,
                content=content,
                metadata={
                    "repo": repo,
                    "issue_number": issue_number,
                    "title": issue.title,
                    "labels": [l.name for l in issue.labels],
                    "state": issue.state,
                    "author": issue.user.login,
                    "comment_count": len(comments)
                },
                timestamp=issue.created_at,
                url=issue.html_url
            )

        except Exception as e:
            print(f"GitHub API error: {e}")
            return None

    def fetch_github_pr(
        self,
        repo: str,
        pr_number: int
    ) -> Optional[IngestionItem]:
        """Fetch a GitHub pull request with review comments."""
        if not self.github_client:
            return None

        try:
            repository = self.github_client.get_repo(repo)
            pr = repository.get_pull(pr_number)

            content = f"# PR: {pr.title}\n\n{pr.body or ''}\n\n"

            # Add review comments
            reviews = list(pr.get_reviews())
            if reviews:
                content += "## Reviews\n\n"
                for review in reviews:
                    if review.body:
                        content += f"**{review.user.login}** ({review.state}):\n{review.body}\n\n---\n\n"

            return IngestionItem(
                source=SourceType.GITHUB,
                content=content,
                metadata={
                    "repo": repo,
                    "pr_number": pr_number,
                    "title": pr.title,
                    "state": pr.state,
                    "author": pr.user.login,
                    "merged": pr.merged,
                    "labels": [l.name for l in pr.labels]
                },
                timestamp=pr.created_at,
                url=pr.html_url
            )

        except Exception as e:
            print(f"GitHub API error: {e}")
            return None

    def fetch_github_discussion(
        self,
        repo: str,
        discussion_number: int
    ) -> Optional[IngestionItem]:
        """Fetch a GitHub discussion (requires GraphQL API)."""
        # GitHub discussions require GraphQL API
        # Simplified implementation - would need proper GraphQL client
        return None

    # =========================================================================
    # Manual Input
    # =========================================================================

    def ingest_text(
        self,
        text: str,
        source_description: str = "manual input"
    ) -> IngestionItem:
        """Create an ingestion item from manual text input."""
        return IngestionItem(
            source=SourceType.MANUAL,
            content=text,
            metadata={
                "source_description": source_description
            },
            timestamp=datetime.now()
        )

    def ingest_document(
        self,
        content: str,
        filename: str,
        document_type: str = "unknown"
    ) -> IngestionItem:
        """Create an ingestion item from a document."""
        return IngestionItem(
            source=SourceType.DOCUMENT,
            content=content,
            metadata={
                "filename": filename,
                "document_type": document_type
            },
            timestamp=datetime.now()
        )

    # =========================================================================
    # Processing
    # =========================================================================

    def process_items(
        self,
        items: List[IngestionItem],
        auto_save: bool = False
    ) -> IngestionResult:
        """
        Process ingestion items through the synthesizer.

        Args:
            items: Items to process
            auto_save: Whether to automatically save generated documents

        Returns:
            Result with counts and any errors
        """
        documents_generated = 0
        errors = []

        for item in items:
            try:
                request = SynthesisRequest(
                    raw_text=item.content,
                    source=item.source.value
                )

                outputs = self.synthesizer.process(request)

                for output in outputs:
                    if auto_save:
                        self.synthesizer.save_document(output)
                    documents_generated += 1

            except Exception as e:
                errors.append(f"Error processing item: {e}")

        return IngestionResult(
            items_processed=len(items),
            documents_generated=documents_generated,
            errors=errors
        )

    def _is_context_relevant(self, text: str) -> bool:
        """Check if text contains context-relevant content."""
        text_lower = text.lower()

        for pattern in self.CONTEXT_PATTERNS:
            if re.search(pattern, text_lower):
                return True

        # Also check for certain keywords
        keywords = ["decided", "decision", "priority", "important",
                    "architecture", "design", "customer", "feedback"]
        return any(kw in text_lower for kw in keywords)

    # =========================================================================
    # Webhook Handlers
    # =========================================================================

    def handle_slack_event(self, event: Dict[str, Any]) -> Optional[IngestionItem]:
        """
        Handle a Slack event webhook.

        Args:
            event: Slack event payload

        Returns:
            Ingestion item if relevant, None otherwise
        """
        event_type = event.get("type")

        if event_type == "message":
            text = event.get("text", "")

            if self._is_context_relevant(text):
                return IngestionItem(
                    source=SourceType.SLACK,
                    content=text,
                    metadata={
                        "channel": event.get("channel"),
                        "user": event.get("user"),
                        "ts": event.get("ts"),
                        "event_type": event_type
                    },
                    timestamp=datetime.now()
                )

        return None

    def handle_github_webhook(self, event: Dict[str, Any], event_type: str) -> Optional[IngestionItem]:
        """
        Handle a GitHub webhook event.

        Args:
            event: GitHub webhook payload
            event_type: Type of event (issues, pull_request, etc.)

        Returns:
            Ingestion item if relevant, None otherwise
        """
        if event_type == "issues":
            action = event.get("action")
            if action in ["opened", "closed"]:
                issue = event.get("issue", {})
                content = f"# {issue.get('title')}\n\n{issue.get('body', '')}"

                return IngestionItem(
                    source=SourceType.GITHUB,
                    content=content,
                    metadata={
                        "repo": event.get("repository", {}).get("full_name"),
                        "issue_number": issue.get("number"),
                        "action": action,
                        "labels": [l.get("name") for l in issue.get("labels", [])]
                    },
                    timestamp=datetime.now(),
                    url=issue.get("html_url")
                )

        elif event_type == "pull_request":
            action = event.get("action")
            if action in ["opened", "closed", "merged"]:
                pr = event.get("pull_request", {})
                content = f"# PR: {pr.get('title')}\n\n{pr.get('body', '')}"

                return IngestionItem(
                    source=SourceType.GITHUB,
                    content=content,
                    metadata={
                        "repo": event.get("repository", {}).get("full_name"),
                        "pr_number": pr.get("number"),
                        "action": action,
                        "merged": pr.get("merged", False)
                    },
                    timestamp=datetime.now(),
                    url=pr.get("html_url")
                )

        return None


# Singleton instance
_ingestion_service: Optional[IngestionService] = None


def get_ingestion_service() -> IngestionService:
    """Get or create the ingestion service singleton."""
    global _ingestion_service
    if _ingestion_service is None:
        _ingestion_service = IngestionService()
    return _ingestion_service
