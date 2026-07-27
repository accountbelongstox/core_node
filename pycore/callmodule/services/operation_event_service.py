# -*- coding: utf-8 -*-
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.state_store import (
    OperationEvent,
    StateRepository,
)
from pycore.pyfoundations.thread_bus import THREAD_BUS


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class OperationEventService:
    """
    Service for logging and retrieving operation events.
    """

    def __init__(self, repo: Optional[StateRepository] = None) -> None:
        self.repo = repo or StateRepository()

    def log_event(
        self,
        operation_id: str,
        level: str,
        event_type: str,
        message: str,
        item_id: Optional[str] = None,
        payload_json: Optional[Dict[str, Any]] = None,
    ) -> OperationEvent:
        """Log a new event for an operation."""
        op = self.repo.get_operation(operation_id)
        if not op:
            raise ValueError(f"Operation {operation_id} not found")

        event = OperationEvent(
            seq=0,
            event_id=uuid.uuid4().hex,
            operation_id=operation_id,
            item_id=item_id,
            revision=op.revision,
            level=level,
            event_type=event_type,
            message=message,
            payload_json=payload_json,
            created_at=_now_iso(),
        )

        with self.repo.transaction() as cursor:
            self.repo._insert_event(cursor, event)

        # Broadcast operation changes so SSE clients can resume via ?since=
        # without relying on UI-side polling.
        status: str = str(event.event_type)
        if status.startswith("item."):
            status = status.split(".", 1)[1]

        stage = None
        msg = str(event.message or "")
        # OperationService transition message often includes: "... (stage)"
        if "(" in msg and ")" in msg:
            try:
                stage = msg[msg.index("(") + 1: msg.rindex(")")]
            except Exception:
                stage = None

        payload: Dict[str, Any] = {
            "schema_version": 1,
            "topic": "operation.changed",
            "event_id": event.event_id,
            "operation_id": event.operation_id,
            "operation_scope": op.scope,
            "operation_revision": event.revision,
            "operation_item_id": event.item_id,
            "operation_event_seq": event.seq,
            "event_type": event.event_type,
            "status": status,
            "stage": stage,
            "level": event.level,
            "message": event.message,
            "created_at": event.created_at,
        }
        THREAD_BUS.trigger_event("operation.changed", payload, async_mode=True)
        
        return event

    def get_events(
        self, operation_id: str, since_seq: int = 0, limit: int = 100
    ) -> List[OperationEvent]:
        """Get events for an operation since a given sequence number."""
        return self.repo.get_events(operation_id, since_seq, limit)
