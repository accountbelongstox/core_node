# -*- coding: utf-8 -*-
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.database import (
    OperationEvent,
    StateRepository,
)
from pycore.callmodule.services.operation_service import (
    _notify_after_commit,
    _outbox_spec,
)


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

        outbox = _outbox_spec(event, op.scope, op.owner_client_id)
        with self.repo.transaction() as cursor:
            self.repo._insert_event(cursor, event, outbox)

        _notify_after_commit(event, op.scope)
        return event

    def get_events(
        self, operation_id: str, since_seq: int = 0, limit: int = 100
    ) -> List[OperationEvent]:
        """Get events for an operation since a given sequence number."""
        return self.repo.get_events(operation_id, since_seq, limit)
