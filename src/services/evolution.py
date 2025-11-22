"""
Context Evolution Tracking Service.

Tracks how narrative context evolves over time, including:
- Version history of narrative units
- Semantic drift over time
- Decision audit trails
- Context lineage tracking
"""
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path
from dataclasses import dataclass, field, asdict
from enum import Enum


class ChangeType(str, Enum):
    """Types of changes to narrative units."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    MERGE = "merge"
    SPLIT = "split"
    MOVE = "move"


class EvolutionTrigger(str, Enum):
    """What triggered the evolution."""
    MANUAL = "manual"           # Direct human edit
    SYNTHESIS = "synthesis"     # LLM synthesis
    INGESTION = "ingestion"     # External source ingestion
    RESOLUTION = "resolution"   # Drift resolution
    MERGE = "merge"             # Conflict merge
    AUTOMATION = "automation"   # Automated process


@dataclass
class ContentSnapshot:
    """A snapshot of content at a point in time."""
    content_hash: str
    content_preview: str  # First 500 chars
    word_count: int
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvolutionEvent:
    """A single evolution event in the narrative history."""
    id: str
    unit_path: str
    change_type: ChangeType
    trigger: EvolutionTrigger
    timestamp: datetime
    before: Optional[ContentSnapshot]
    after: Optional[ContentSnapshot]
    description: str
    author: str = "system"
    related_events: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvolutionTimeline:
    """Timeline of evolution for a narrative unit."""
    unit_path: str
    events: List[EvolutionEvent]
    first_created: datetime
    last_modified: datetime
    total_revisions: int
    primary_authors: List[str]


@dataclass
class SemanticShift:
    """A detected semantic shift in meaning over time."""
    unit_path: str
    before_summary: str
    after_summary: str
    shift_magnitude: float  # 0-1, how much meaning changed
    shift_type: str  # "expansion", "contraction", "pivot", "refinement"
    detected_at: datetime
    event_ids: List[str]


class EvolutionTracker:
    """
    Tracks the evolution of narrative context over time.

    Provides:
    - Version history with diffs
    - Semantic drift detection
    - Decision audit trails
    - Lineage tracking
    """

    def __init__(self, storage_path: Optional[Path] = None):
        """
        Initialize the evolution tracker.

        Args:
            storage_path: Path to store evolution data
        """
        self.storage_path = storage_path or Path(".principalnarrative/evolution")
        self.storage_path.mkdir(parents=True, exist_ok=True)

        self._event_counter = 0
        self._events: Dict[str, EvolutionEvent] = {}
        self._unit_events: Dict[str, List[str]] = {}  # unit_path -> [event_ids]
        self._load_history()

    def _load_history(self):
        """Load evolution history from storage."""
        history_file = self.storage_path / "history.json"
        if history_file.exists():
            try:
                with open(history_file, "r") as f:
                    data = json.load(f)

                self._event_counter = data.get("event_counter", 0)

                for event_data in data.get("events", []):
                    event = self._deserialize_event(event_data)
                    self._events[event.id] = event
                    if event.unit_path not in self._unit_events:
                        self._unit_events[event.unit_path] = []
                    self._unit_events[event.unit_path].append(event.id)

            except Exception:
                pass

    def _save_history(self):
        """Save evolution history to storage."""
        history_file = self.storage_path / "history.json"

        data = {
            "event_counter": self._event_counter,
            "events": [self._serialize_event(e) for e in self._events.values()],
            "last_saved": datetime.utcnow().isoformat()
        }

        with open(history_file, "w") as f:
            json.dump(data, f, indent=2)

    def _serialize_event(self, event: EvolutionEvent) -> dict:
        """Serialize an event to dict."""
        return {
            "id": event.id,
            "unit_path": event.unit_path,
            "change_type": event.change_type.value,
            "trigger": event.trigger.value,
            "timestamp": event.timestamp.isoformat(),
            "before": asdict(event.before) if event.before else None,
            "after": asdict(event.after) if event.after else None,
            "description": event.description,
            "author": event.author,
            "related_events": event.related_events,
            "metadata": event.metadata
        }

    def _deserialize_event(self, data: dict) -> EvolutionEvent:
        """Deserialize an event from dict."""
        before = None
        if data.get("before"):
            before = ContentSnapshot(**data["before"])

        after = None
        if data.get("after"):
            after = ContentSnapshot(**data["after"])

        return EvolutionEvent(
            id=data["id"],
            unit_path=data["unit_path"],
            change_type=ChangeType(data["change_type"]),
            trigger=EvolutionTrigger(data["trigger"]),
            timestamp=datetime.fromisoformat(data["timestamp"]),
            before=before,
            after=after,
            description=data["description"],
            author=data.get("author", "system"),
            related_events=data.get("related_events", []),
            metadata=data.get("metadata", {})
        )

    def _create_snapshot(self, content: str, metadata: Optional[dict] = None) -> ContentSnapshot:
        """Create a content snapshot."""
        return ContentSnapshot(
            content_hash=hashlib.sha256(content.encode()).hexdigest()[:12],
            content_preview=content[:500],
            word_count=len(content.split()),
            metadata=metadata or {}
        )

    def record_change(
        self,
        unit_path: str,
        change_type: ChangeType,
        trigger: EvolutionTrigger,
        description: str,
        before_content: Optional[str] = None,
        after_content: Optional[str] = None,
        author: str = "system",
        metadata: Optional[dict] = None
    ) -> EvolutionEvent:
        """
        Record a change to a narrative unit.

        Args:
            unit_path: Path of the narrative unit
            change_type: Type of change
            trigger: What triggered the change
            description: Human-readable description
            before_content: Content before change
            after_content: Content after change
            author: Who made the change
            metadata: Additional metadata

        Returns:
            The created evolution event
        """
        self._event_counter += 1
        event_id = f"evo_{self._event_counter:06d}"

        event = EvolutionEvent(
            id=event_id,
            unit_path=unit_path,
            change_type=change_type,
            trigger=trigger,
            timestamp=datetime.utcnow(),
            before=self._create_snapshot(before_content) if before_content else None,
            after=self._create_snapshot(after_content) if after_content else None,
            description=description,
            author=author,
            metadata=metadata or {}
        )

        self._events[event_id] = event
        if unit_path not in self._unit_events:
            self._unit_events[unit_path] = []
        self._unit_events[unit_path].append(event_id)

        self._save_history()

        return event

    def get_timeline(self, unit_path: str) -> Optional[EvolutionTimeline]:
        """
        Get the evolution timeline for a narrative unit.

        Args:
            unit_path: Path of the narrative unit

        Returns:
            Timeline with all events, or None if no history
        """
        event_ids = self._unit_events.get(unit_path, [])
        if not event_ids:
            return None

        events = [self._events[eid] for eid in event_ids]
        events.sort(key=lambda e: e.timestamp)

        # Collect unique authors
        authors = list(set(e.author for e in events))

        return EvolutionTimeline(
            unit_path=unit_path,
            events=events,
            first_created=events[0].timestamp,
            last_modified=events[-1].timestamp,
            total_revisions=len(events),
            primary_authors=authors
        )

    def get_recent_events(
        self,
        limit: int = 50,
        since: Optional[datetime] = None,
        unit_path: Optional[str] = None,
        trigger: Optional[EvolutionTrigger] = None
    ) -> List[EvolutionEvent]:
        """
        Get recent evolution events.

        Args:
            limit: Maximum events to return
            since: Only events after this time
            unit_path: Filter by unit path
            trigger: Filter by trigger type

        Returns:
            List of events, newest first
        """
        events = list(self._events.values())

        # Apply filters
        if since:
            events = [e for e in events if e.timestamp > since]
        if unit_path:
            events = [e for e in events if e.unit_path == unit_path]
        if trigger:
            events = [e for e in events if e.trigger == trigger]

        # Sort by timestamp descending
        events.sort(key=lambda e: e.timestamp, reverse=True)

        return events[:limit]

    def detect_semantic_shifts(
        self,
        unit_path: str,
        threshold: float = 0.3
    ) -> List[SemanticShift]:
        """
        Detect significant semantic shifts in a unit's history.

        This is a simplified version - a full implementation would use
        embeddings to measure semantic similarity.

        Args:
            unit_path: Path to analyze
            threshold: Minimum shift magnitude to report

        Returns:
            List of detected semantic shifts
        """
        timeline = self.get_timeline(unit_path)
        if not timeline or len(timeline.events) < 2:
            return []

        shifts = []
        prev_event = None

        for event in timeline.events:
            if prev_event and prev_event.after and event.after:
                # Simple heuristic: word count change as proxy for semantic shift
                prev_words = prev_event.after.word_count
                curr_words = event.after.word_count

                if prev_words > 0:
                    change_ratio = abs(curr_words - prev_words) / prev_words
                else:
                    change_ratio = 1.0 if curr_words > 0 else 0.0

                if change_ratio >= threshold:
                    # Determine shift type based on word count change
                    if curr_words > prev_words * 1.5:
                        shift_type = "expansion"
                    elif curr_words < prev_words * 0.5:
                        shift_type = "contraction"
                    elif change_ratio > 0.5:
                        shift_type = "pivot"
                    else:
                        shift_type = "refinement"

                    shifts.append(SemanticShift(
                        unit_path=unit_path,
                        before_summary=prev_event.after.content_preview[:100],
                        after_summary=event.after.content_preview[:100],
                        shift_magnitude=min(change_ratio, 1.0),
                        shift_type=shift_type,
                        detected_at=event.timestamp,
                        event_ids=[prev_event.id, event.id]
                    ))

            prev_event = event

        return shifts

    def get_lineage(
        self,
        unit_path: str,
        include_related: bool = True
    ) -> Dict[str, Any]:
        """
        Get the lineage/provenance of a narrative unit.

        Shows the chain of changes that led to the current state.

        Args:
            unit_path: Path to trace
            include_related: Include related units

        Returns:
            Lineage information
        """
        timeline = self.get_timeline(unit_path)
        if not timeline:
            return {"unit_path": unit_path, "exists": False}

        # Build lineage chain
        chain = []
        for event in timeline.events:
            chain.append({
                "event_id": event.id,
                "timestamp": event.timestamp.isoformat(),
                "change_type": event.change_type.value,
                "trigger": event.trigger.value,
                "author": event.author,
                "description": event.description
            })

        # Find related units (units mentioned in related_events)
        related_units = set()
        if include_related:
            for event in timeline.events:
                for related_id in event.related_events:
                    related_event = self._events.get(related_id)
                    if related_event:
                        related_units.add(related_event.unit_path)

        return {
            "unit_path": unit_path,
            "exists": True,
            "first_created": timeline.first_created.isoformat(),
            "last_modified": timeline.last_modified.isoformat(),
            "total_revisions": timeline.total_revisions,
            "authors": timeline.primary_authors,
            "lineage_chain": chain,
            "related_units": list(related_units)
        }

    def get_activity_summary(
        self,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Get summary of evolution activity.

        Args:
            days: Number of days to summarize

        Returns:
            Activity summary with stats
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        recent = self.get_recent_events(limit=1000, since=cutoff)

        # Count by trigger
        by_trigger = {}
        for event in recent:
            key = event.trigger.value
            by_trigger[key] = by_trigger.get(key, 0) + 1

        # Count by change type
        by_change = {}
        for event in recent:
            key = event.change_type.value
            by_change[key] = by_change.get(key, 0) + 1

        # Count by unit
        by_unit = {}
        for event in recent:
            by_unit[event.unit_path] = by_unit.get(event.unit_path, 0) + 1

        # Most active units
        most_active = sorted(by_unit.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "period_days": days,
            "total_events": len(recent),
            "by_trigger": by_trigger,
            "by_change_type": by_change,
            "most_active_units": most_active,
            "unique_units_modified": len(by_unit),
            "unique_authors": len(set(e.author for e in recent))
        }


# Global instance
_evolution_tracker: Optional[EvolutionTracker] = None


def get_evolution_tracker() -> EvolutionTracker:
    """Get the global evolution tracker instance."""
    global _evolution_tracker
    if _evolution_tracker is None:
        _evolution_tracker = EvolutionTracker()
    return _evolution_tracker
