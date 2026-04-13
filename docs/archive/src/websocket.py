"""
WebSocket support for real-time narrative updates.

Provides real-time notifications for:
- Drift events
- Coherence changes
- Document updates
- Agent activity
"""
import asyncio
import json
from datetime import datetime
from typing import Dict, Set, Optional, Any
from enum import Enum
from dataclasses import dataclass, field, asdict

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel


class EventType(str, Enum):
    """Types of real-time events."""
    # Coherence events
    COHERENCE_UPDATE = "coherence.update"
    DRIFT_DETECTED = "drift.detected"
    DRIFT_RESOLVED = "drift.resolved"

    # Document events
    DOCUMENT_CREATED = "document.created"
    DOCUMENT_UPDATED = "document.updated"
    DOCUMENT_DELETED = "document.deleted"

    # Agent events
    AGENT_REGISTERED = "agent.registered"
    AGENT_CONTEXT_REQUEST = "agent.context_request"
    AGENT_VALIDATION = "agent.validation"

    # System events
    SCAN_STARTED = "scan.started"
    SCAN_COMPLETED = "scan.completed"
    INDEX_UPDATED = "index.updated"

    # Git events
    GIT_COMMIT = "git.commit"
    GIT_SYNC = "git.sync"


@dataclass
class WebSocketEvent:
    """A WebSocket event to broadcast."""
    type: EventType
    payload: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.utcnow)
    source: str = "system"

    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps({
            "type": self.type.value,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source
        })


class SubscriptionFilter(BaseModel):
    """Filter for subscription topics."""
    event_types: Optional[list[str]] = None
    layers: Optional[list[str]] = None
    agent_id: Optional[str] = None


class ConnectionManager:
    """
    Manages WebSocket connections and message broadcasting.

    Supports:
    - Multiple concurrent connections
    - Topic-based subscriptions
    - Filtered event delivery
    - Connection health monitoring
    """

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.subscriptions: Dict[str, SubscriptionFilter] = {}
        self._connection_counter = 0
        self._lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        client_id: Optional[str] = None,
        filters: Optional[SubscriptionFilter] = None
    ) -> str:
        """
        Accept a new WebSocket connection.

        Args:
            websocket: The WebSocket connection
            client_id: Optional client identifier
            filters: Optional subscription filters

        Returns:
            Connection ID
        """
        await websocket.accept()

        async with self._lock:
            self._connection_counter += 1
            conn_id = client_id or f"conn_{self._connection_counter}"
            self.active_connections[conn_id] = websocket
            self.subscriptions[conn_id] = filters or SubscriptionFilter()

        # Send welcome message
        await websocket.send_json({
            "type": "connection.established",
            "connection_id": conn_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        return conn_id

    async def disconnect(self, connection_id: str):
        """Disconnect a WebSocket connection."""
        async with self._lock:
            if connection_id in self.active_connections:
                del self.active_connections[connection_id]
            if connection_id in self.subscriptions:
                del self.subscriptions[connection_id]

    async def update_subscription(
        self,
        connection_id: str,
        filters: SubscriptionFilter
    ):
        """Update subscription filters for a connection."""
        async with self._lock:
            if connection_id in self.subscriptions:
                self.subscriptions[connection_id] = filters

    def _should_send(
        self,
        event: WebSocketEvent,
        filters: SubscriptionFilter
    ) -> bool:
        """Check if an event matches subscription filters."""
        # If no filters, send everything
        if not filters.event_types and not filters.layers:
            return True

        # Check event type filter
        if filters.event_types:
            if event.type.value not in filters.event_types:
                return False

        # Check layer filter (if applicable)
        if filters.layers:
            event_layer = event.payload.get("layer")
            if event_layer and event_layer not in filters.layers:
                return False

        return True

    async def broadcast(self, event: WebSocketEvent):
        """
        Broadcast an event to all matching connections.

        Args:
            event: The event to broadcast
        """
        disconnected = []

        for conn_id, websocket in self.active_connections.items():
            filters = self.subscriptions.get(conn_id, SubscriptionFilter())

            if not self._should_send(event, filters):
                continue

            try:
                await websocket.send_text(event.to_json())
            except Exception:
                disconnected.append(conn_id)

        # Clean up disconnected clients
        for conn_id in disconnected:
            await self.disconnect(conn_id)

    async def send_to(self, connection_id: str, event: WebSocketEvent):
        """Send an event to a specific connection."""
        websocket = self.active_connections.get(connection_id)
        if websocket:
            try:
                await websocket.send_text(event.to_json())
            except Exception:
                await self.disconnect(connection_id)

    def get_connection_count(self) -> int:
        """Get the number of active connections."""
        return len(self.active_connections)

    def get_connection_info(self) -> list[dict]:
        """Get info about all active connections."""
        return [
            {
                "connection_id": conn_id,
                "filters": self.subscriptions.get(conn_id, SubscriptionFilter()).model_dump()
            }
            for conn_id in self.active_connections.keys()
        ]


# Global connection manager instance
manager = ConnectionManager()


def get_connection_manager() -> ConnectionManager:
    """Get the global connection manager."""
    return manager


# ============================================================================
# Event Emitters - Call these from other parts of the application
# ============================================================================

async def emit_coherence_update(score: dict, source: str = "system"):
    """Emit a coherence score update event."""
    event = WebSocketEvent(
        type=EventType.COHERENCE_UPDATE,
        payload={"score": score},
        source=source
    )
    await manager.broadcast(event)


async def emit_drift_detected(drift_event: dict, source: str = "system"):
    """Emit a drift detected event."""
    event = WebSocketEvent(
        type=EventType.DRIFT_DETECTED,
        payload=drift_event,
        source=source
    )
    await manager.broadcast(event)


async def emit_drift_resolved(drift_id: str, resolution: str, source: str = "system"):
    """Emit a drift resolved event."""
    event = WebSocketEvent(
        type=EventType.DRIFT_RESOLVED,
        payload={"drift_id": drift_id, "resolution": resolution},
        source=source
    )
    await manager.broadcast(event)


async def emit_document_event(
    event_type: EventType,
    path: str,
    layer: str,
    metadata: Optional[dict] = None,
    source: str = "system"
):
    """Emit a document lifecycle event."""
    event = WebSocketEvent(
        type=event_type,
        payload={
            "path": path,
            "layer": layer,
            "metadata": metadata or {}
        },
        source=source
    )
    await manager.broadcast(event)


async def emit_agent_event(
    event_type: EventType,
    agent_id: str,
    details: dict,
    source: str = "system"
):
    """Emit an agent activity event."""
    event = WebSocketEvent(
        type=event_type,
        payload={"agent_id": agent_id, **details},
        source=source
    )
    await manager.broadcast(event)


async def emit_scan_event(
    event_type: EventType,
    results: Optional[dict] = None,
    source: str = "system"
):
    """Emit a scan lifecycle event."""
    event = WebSocketEvent(
        type=event_type,
        payload=results or {},
        source=source
    )
    await manager.broadcast(event)


async def emit_git_event(
    event_type: EventType,
    commit_info: dict,
    source: str = "system"
):
    """Emit a git event."""
    event = WebSocketEvent(
        type=event_type,
        payload=commit_info,
        source=source
    )
    await manager.broadcast(event)


# ============================================================================
# WebSocket Routes
# ============================================================================

from fastapi import APIRouter, Query

ws_router = APIRouter(tags=["WebSocket"])


@ws_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: Optional[str] = Query(None),
    events: Optional[str] = Query(None),  # Comma-separated event types
    layers: Optional[str] = Query(None)   # Comma-separated layers
):
    """
    WebSocket endpoint for real-time updates.

    Query params:
    - client_id: Optional client identifier
    - events: Comma-separated event types to subscribe to
    - layers: Comma-separated layers to filter by

    Example: ws://localhost:8000/ws?events=drift.detected,coherence.update&layers=messaging
    """
    # Parse filters from query params
    filters = SubscriptionFilter(
        event_types=events.split(",") if events else None,
        layers=layers.split(",") if layers else None
    )

    conn_id = await manager.connect(websocket, client_id, filters)

    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_json()

            # Handle subscription updates
            if data.get("type") == "subscribe":
                new_filters = SubscriptionFilter(
                    event_types=data.get("event_types"),
                    layers=data.get("layers"),
                    agent_id=data.get("agent_id")
                )
                await manager.update_subscription(conn_id, new_filters)
                await websocket.send_json({
                    "type": "subscription.updated",
                    "filters": new_filters.model_dump()
                })

            # Handle ping/pong for connection health
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        await manager.disconnect(conn_id)


@ws_router.get("/ws/status")
async def websocket_status():
    """Get WebSocket connection status."""
    return {
        "active_connections": manager.get_connection_count(),
        "connections": manager.get_connection_info()
    }


@ws_router.post("/ws/broadcast")
async def broadcast_event(
    event_type: str = Query(..., description="Event type"),
    payload: str = Query("{}", description="JSON payload")
):
    """
    Manually broadcast an event (admin only).

    Useful for testing and manual notifications.
    """
    try:
        event_enum = EventType(event_type)
    except ValueError:
        return {"error": f"Unknown event type: {event_type}"}

    try:
        payload_dict = json.loads(payload)
    except json.JSONDecodeError:
        return {"error": "Invalid JSON payload"}

    event = WebSocketEvent(
        type=event_enum,
        payload=payload_dict,
        source="admin"
    )

    await manager.broadcast(event)

    return {
        "broadcasted": True,
        "event_type": event_type,
        "connections_reached": manager.get_connection_count()
    }
