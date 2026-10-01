# -*- coding: utf-8 -*-
from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from pycore.database.models.state_models import OperationEvent
from pycore.database.repositories.state_repository import StateRepository
from pycore.pyfoundations.event_journal import event_journal
from pycore.pyfoundations.event_records import BROADCAST_AUDIENCE, client_audience
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyfoundations.time_utils import utc_now_iso


def operation_audience(owner_client_id: Optional[str]) -> str:
    return client_audience(owner_client_id) if owner_client_id else BROADCAST_AUDIENCE


def _event_payload(
    event: OperationEvent,
    scope: Optional[str] = None,
) -> Dict[str, Any]:
    status = str(event.event_type)
    detail = dict(event.payload_json or {})
    if status.startswith("item."):
        status = status.split(".", 1)[1]
    stage = None
    message = str(event.message or "")
    if "(" in message and ")" in message:
        stage = message[message.index("(") + 1 : message.rindex(")")]
    return {
        "schema_version": 1,
        "topic": BusSignals.OPERATION_CHANGED,
        "event_id": event.event_id,
        "operation_id": event.operation_id,
        "operation_scope": scope,
        "operation_revision": event.revision,
        "operation_item_id": event.item_id,
        "operation_event_seq": event.seq,
        "event_type": event.event_type,
        "status": status,
        "stage": detail.get("stage") or stage,
        "progress": detail.get("progress"),
        "item_status": detail.get("status"),
        "totals": detail.get("totals"),
        "level": event.level,
        "message": event.message,
        "created_at": event.created_at,
    }


def _outbox_spec(
    event: OperationEvent,
    scope: Optional[str] = None,
    owner_client_id: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "topic": BusSignals.OPERATION_CHANGED,
        "payload": _event_payload(event, scope),
        "entity_type": "operation",
        "entity_id": event.operation_id,
        "revision": event.revision,
        "audience": operation_audience(owner_client_id),
    }


def publish_operation_event(
    event: OperationEvent,
    scope: Optional[str] = None,
    owner_client_id: Optional[str] = None,
) -> None:
    """After commit: notify in-process listeners and the event journal."""
    payload = _event_payload(event, scope)
    THREAD_BUS.trigger_event(BusSignals.OPERATION_CHANGED, payload, async_mode=True)
    event_journal.publish_topic(
        BusSignals.OPERATION_CHANGED,
        payload,
        audience=operation_audience(owner_client_id),
        event_id=event.event_id,
    )


def _make_event(
    operation_id: str,
    revision: int,
    event_type: str,
    message: str,
    item_id: Optional[str] = None,
    payload_json: Optional[Dict[str, Any]] = None,
    level: str = "info",
) -> OperationEvent:
    return OperationEvent(
        seq=0,
        event_id=uuid.uuid4().hex,
        operation_id=operation_id,
        item_id=item_id,
        revision=revision,
        level=level,
        event_type=event_type,
        message=message,
        payload_json=payload_json,
        created_at=utc_now_iso(),
    )


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
            created_at=utc_now_iso(),
        )

        outbox = _outbox_spec(event, op.scope, op.owner_client_id)
        with self.repo.transaction() as cursor:
            self.repo._insert_event(cursor, event, outbox)

        publish_operation_event(event, op.scope, op.owner_client_id)
        return event

    def get_events(
        self, operation_id: str, since_seq: int = 0, limit: int = 100
    ) -> List[OperationEvent]:
        """Get events for an operation since a given sequence number."""
        return self.repo.get_events(operation_id, since_seq, limit)


operation_event_service = OperationEventService()
