"""
Drift Analytics Service - Track drift over time and generate visualizations.

Provides:
- Historical drift tracking
- Trend analysis
- Drift heatmaps by document
- Resolution progress tracking
- Time-series data for charts
"""
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from collections import defaultdict
from dataclasses import dataclass, asdict

from ..logging_config import get_logger
from ..models import DriftEvent, DriftSeverity, DriftType, DriftStatus

logger = get_logger("services.drift_analytics")


@dataclass
class DriftSnapshot:
    """A snapshot of drift at a point in time."""
    timestamp: datetime
    total_drifts: int
    by_severity: Dict[str, int]
    by_type: Dict[str, int]
    by_document: Dict[str, int]
    events: List[Dict[str, Any]]


@dataclass
class DriftTrend:
    """Trend analysis for a time period."""
    period: str  # "7d", "30d", "90d"
    start_date: datetime
    end_date: datetime
    total_change: int  # Positive = more drift
    trend_direction: str  # "increasing", "decreasing", "stable"
    severity_trends: Dict[str, str]  # per-severity trends
    most_problematic_docs: List[str]
    resolution_rate: float  # Percentage of drifts resolved


class DriftAnalytics:
    """
    Service for tracking and analyzing drift over time.

    Features:
    - Save periodic drift snapshots
    - Calculate trends (increasing/decreasing/stable)
    - Generate heatmaps of problem areas
    - Track resolution progress
    - Provide data for visualizations
    """

    def __init__(self, data_dir: Optional[Path] = None):
        """Initialize analytics service with data directory."""
        self.data_dir = data_dir or Path("data/drift_analytics")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.snapshots_file = self.data_dir / "snapshots.json"
        self.snapshots: List[DriftSnapshot] = []
        self._load_snapshots()

    def _load_snapshots(self):
        """Load historical snapshots from disk."""
        if not self.snapshots_file.exists():
            return

        try:
            data = json.loads(self.snapshots_file.read_text(encoding='utf-8'))
            self.snapshots = [
                DriftSnapshot(
                    timestamp=datetime.fromisoformat(s['timestamp']),
                    total_drifts=s['total_drifts'],
                    by_severity=s['by_severity'],
                    by_type=s['by_type'],
                    by_document=s['by_document'],
                    events=s['events']
                )
                for s in data.get('snapshots', [])
            ]
            logger.info(f"Loaded {len(self.snapshots)} drift snapshots")
        except Exception as e:
            logger.error(f"Failed to load snapshots: {e}", exc_info=True)

    def _save_snapshots(self):
        """Save snapshots to disk."""
        try:
            data = {
                "snapshots": [
                    {
                        "timestamp": s.timestamp.isoformat(),
                        "total_drifts": s.total_drifts,
                        "by_severity": s.by_severity,
                        "by_type": s.by_type,
                        "by_document": s.by_document,
                        "events": s.events
                    }
                    for s in self.snapshots
                ],
                "last_updated": datetime.now().isoformat()
            }
            self.snapshots_file.write_text(json.dumps(data, indent=2), encoding='utf-8')
        except Exception as e:
            logger.error(f"Failed to save snapshots: {e}", exc_info=True)

    def record_snapshot(self, drift_events: List[DriftEvent]):
        """
        Record a snapshot of current drift state.

        Call this after each drift scan to build historical data.
        """
        # Group by severity
        by_severity = defaultdict(int)
        for event in drift_events:
            by_severity[event.severity.value] += 1

        # Group by type
        by_type = defaultdict(int)
        for event in drift_events:
            by_type[event.type.value] += 1

        # Group by document
        by_document = defaultdict(int)
        for event in drift_events:
            by_document[event.source_unit] += 1

        # Create snapshot
        snapshot = DriftSnapshot(
            timestamp=datetime.now(),
            total_drifts=len(drift_events),
            by_severity=dict(by_severity),
            by_type=dict(by_type),
            by_document=dict(by_document),
            events=[
                {
                    "id": e.id,
                    "type": e.type.value,
                    "severity": e.severity.value,
                    "source": e.source_unit,
                    "status": e.status.value
                }
                for e in drift_events
            ]
        )

        self.snapshots.append(snapshot)
        self._save_snapshots()

        logger.info(f"Recorded drift snapshot: {len(drift_events)} events")

    def get_trend(self, period: str = "30d") -> DriftTrend:
        """
        Calculate drift trend for a time period.

        Args:
            period: "7d", "30d", or "90d"

        Returns:
            Trend analysis with direction and metrics
        """
        # Parse period
        days = int(period.replace('d', ''))
        start_date = datetime.now() - timedelta(days=days)
        end_date = datetime.now()

        # Filter snapshots to period
        period_snapshots = [
            s for s in self.snapshots
            if start_date <= s.timestamp <= end_date
        ]

        if not period_snapshots:
            return DriftTrend(
                period=period,
                start_date=start_date,
                end_date=end_date,
                total_change=0,
                trend_direction="stable",
                severity_trends={},
                most_problematic_docs=[],
                resolution_rate=0.0
            )

        # Calculate total change
        first_snapshot = period_snapshots[0]
        last_snapshot = period_snapshots[-1]
        total_change = last_snapshot.total_drifts - first_snapshot.total_drifts

        # Determine trend direction
        if abs(total_change) < 3:
            trend_direction = "stable"
        elif total_change > 0:
            trend_direction = "increasing"
        else:
            trend_direction = "decreasing"

        # Severity trends
        severity_trends = {}
        for severity in ["critical", "high", "medium", "low"]:
            first_count = first_snapshot.by_severity.get(severity, 0)
            last_count = last_snapshot.by_severity.get(severity, 0)
            change = last_count - first_count

            if abs(change) < 2:
                severity_trends[severity] = "stable"
            elif change > 0:
                severity_trends[severity] = "increasing"
            else:
                severity_trends[severity] = "decreasing"

        # Find most problematic documents
        doc_totals = defaultdict(int)
        for snapshot in period_snapshots:
            for doc, count in snapshot.by_document.items():
                doc_totals[doc] += count

        most_problematic = sorted(doc_totals.items(), key=lambda x: x[1], reverse=True)[:5]
        most_problematic_docs = [doc for doc, _ in most_problematic]

        # Calculate resolution rate
        total_events = sum(len(s.events) for s in period_snapshots)
        resolved_events = sum(
            1 for s in period_snapshots
            for e in s.events
            if e.get('status') == 'resolved'
        )
        resolution_rate = (resolved_events / total_events * 100) if total_events > 0 else 0

        return DriftTrend(
            period=period,
            start_date=start_date,
            end_date=end_date,
            total_change=total_change,
            trend_direction=trend_direction,
            severity_trends=severity_trends,
            most_problematic_docs=most_problematic_docs,
            resolution_rate=resolution_rate
        )

    def get_time_series(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get time-series data for charts.

        Args:
            days: Number of days of history to include

        Returns:
            List of data points with timestamps and drift counts
        """
        cutoff = datetime.now() - timedelta(days=days)
        recent_snapshots = [s for s in self.snapshots if s.timestamp >= cutoff]

        return [
            {
                "timestamp": s.timestamp.isoformat(),
                "date": s.timestamp.strftime("%Y-%m-%d"),
                "total": s.total_drifts,
                "critical": s.by_severity.get("critical", 0),
                "high": s.by_severity.get("high", 0),
                "medium": s.by_severity.get("medium", 0),
                "low": s.by_severity.get("low", 0)
            }
            for s in sorted(recent_snapshots, key=lambda x: x.timestamp)
        ]

    def get_heatmap(self) -> Dict[str, Any]:
        """
        Generate heatmap data showing which documents have most drift.

        Returns:
            Heatmap data with documents and drift counts
        """
        if not self.snapshots:
            return {"documents": [], "max_drift": 0}

        # Use latest snapshot
        latest = self.snapshots[-1]

        # Sort documents by drift count
        sorted_docs = sorted(
            latest.by_document.items(),
            key=lambda x: x[1],
            reverse=True
        )

        max_drift = max(latest.by_document.values()) if latest.by_document else 0

        return {
            "documents": [
                {
                    "path": doc,
                    "drift_count": count,
                    "percentage": (count / latest.total_drifts * 100) if latest.total_drifts > 0 else 0
                }
                for doc, count in sorted_docs[:20]  # Top 20 documents
            ],
            "max_drift": max_drift,
            "total_documents": len(latest.by_document)
        }

    def get_severity_breakdown(self) -> Dict[str, Any]:
        """Get current severity breakdown with historical comparison."""
        if not self.snapshots:
            return {
                "current": {},
                "previous": {},
                "changes": {}
            }

        current = self.snapshots[-1]
        previous = self.snapshots[-2] if len(self.snapshots) > 1 else None

        current_severity = current.by_severity
        previous_severity = previous.by_severity if previous else {}

        changes = {}
        for severity in ["critical", "high", "medium", "low"]:
            curr = current_severity.get(severity, 0)
            prev = previous_severity.get(severity, 0)
            changes[severity] = curr - prev

        return {
            "current": current_severity,
            "previous": previous_severity,
            "changes": changes
        }

    def get_type_breakdown(self) -> Dict[str, Any]:
        """Get current drift type breakdown."""
        if not self.snapshots:
            return {"current": {}, "total": 0}

        latest = self.snapshots[-1]

        return {
            "current": latest.by_type,
            "total": latest.total_drifts,
            "types": [
                {
                    "type": drift_type,
                    "count": count,
                    "percentage": (count / latest.total_drifts * 100) if latest.total_drifts > 0 else 0
                }
                for drift_type, count in sorted(latest.by_type.items(), key=lambda x: x[1], reverse=True)
            ]
        }

    def get_dashboard_summary(self) -> Dict[str, Any]:
        """
        Get summary data for dashboard overview.

        Returns:
            Complete summary with current state, trends, and key metrics
        """
        if not self.snapshots:
            return {
                "current_drift": 0,
                "trend_7d": "stable",
                "trend_30d": "stable",
                "most_problematic_docs": [],
                "severity_breakdown": {},
                "resolution_rate": 0
            }

        latest = self.snapshots[-1]
        trend_7d = self.get_trend("7d")
        trend_30d = self.get_trend("30d")

        return {
            "current_drift": latest.total_drifts,
            "last_scan": latest.timestamp.isoformat(),
            "trend_7d": {
                "direction": trend_7d.trend_direction,
                "change": trend_7d.total_change
            },
            "trend_30d": {
                "direction": trend_30d.trend_direction,
                "change": trend_30d.total_change
            },
            "most_problematic_docs": trend_30d.most_problematic_docs,
            "severity_breakdown": latest.by_severity,
            "type_breakdown": latest.by_type,
            "resolution_rate": trend_30d.resolution_rate,
            "total_snapshots": len(self.snapshots)
        }

    def clear_old_snapshots(self, days: int = 90):
        """Remove snapshots older than specified days."""
        cutoff = datetime.now() - timedelta(days=days)
        original_count = len(self.snapshots)

        self.snapshots = [s for s in self.snapshots if s.timestamp >= cutoff]

        if len(self.snapshots) < original_count:
            self._save_snapshots()
            logger.info(f"Cleared {original_count - len(self.snapshots)} old snapshots")
