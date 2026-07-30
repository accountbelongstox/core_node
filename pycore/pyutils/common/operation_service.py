# -*- coding: utf-8 -*-
"""
Operation Service — full V5 contract.

Manages the lifecycle of operations and their items with:
- create_or_get (idempotency)
- declare_items (fix total after discovery)
- per-item transitions: start_item, update_item_progress, complete_item, fail_item, skip_item
- operation-level transitions: start, complete, fail, cancel, request_cancel
- snapshot, list_operations, list_events
- All state mutations write a domain event in the same transaction (broadcast via THREAD_BUS)
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from pycore.database.models.state_models import Operation, OperationEvent, OperationItem
from pycore.database.repositories.state_repository import StateRepository
from pycore.database.repositories.state_repository import RevisionConflictError
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals


OperationEventPublisher = Callable[
    [str, Dict[str, Any], str, Optional[str]],
    None,
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _event_payload(event: OperationEvent, scope: Optional[str] = None) -> Dict[str, Any]:
    status: str = str(event.event_type)
    if status.startswith("item."):
        status = status.split(".", 1)[1]

    stage = None
    msg = str(event.message or "")
    if "(" in msg and ")" in msg:
        try:
            stage = msg[msg.index("(") + 1: msg.rindex(")")]
        except Exception:
            stage = None

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
        "stage": stage,
        "level": event.level,
        "message": event.message,
        "created_at": event.created_at,
    }


def _outbox_spec(
    event: OperationEvent,
    scope: Optional[str] = None,
    owner_client_id: Optional[str] = None,
) -> Dict[str, Any]:
    payload = _event_payload(event, scope)
    audience = f"client:{owner_client_id}" if owner_client_id else "*"
    return {
        "topic": BusSignals.OPERATION_CHANGED,
        "payload": payload,
        "entity_type": "operation",
        "entity_id": event.operation_id,
        "revision": event.revision,
        "audience": audience,
    }


def _notify_after_commit(
    event: OperationEvent,
    scope: Optional[str] = None,
    owner_client_id: Optional[str] = None,
    event_publisher: Optional[OperationEventPublisher] = None,
) -> None:
    payload = _event_payload(event, scope)
    THREAD_BUS.trigger_event(BusSignals.OPERATION_CHANGED, payload, async_mode=True)
    audience = f"client:{owner_client_id}" if owner_client_id else "*"
    if event_publisher is not None:
        event_publisher(BusSignals.OPERATION_CHANGED, payload, audience, event.event_id)


def _broadcast(
    event: OperationEvent,
    scope: Optional[str] = None,
    owner_client_id: Optional[str] = None,
    event_publisher: Optional[OperationEventPublisher] = None,
) -> None:
    """Backward-compatible alias after outbox is written in the same DB transaction."""
    _notify_after_commit(event, scope, owner_client_id, event_publisher)


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
        created_at=_now_iso(),
    )


# ---------------------------------------------------------------------------
# OperationService
# ---------------------------------------------------------------------------

class OperationService:
    """
    Full V5 operation service.

    One instance per feature that needs operation tracking (Qwen, Agent History,
    Laravel mirror, etc.). Pass a shared ``StateRepository`` for multi-service
    use, or let the default constructor create one.
    """

    def __init__(
        self,
        repo: Optional[StateRepository] = None,
        event_publisher: Optional[OperationEventPublisher] = None,
    ) -> None:
        self.repo = repo or StateRepository()
        self.event_publisher = event_publisher

    def set_event_publisher(
        self,
        event_publisher: Optional[OperationEventPublisher],
    ) -> None:
        """Inject the application transport adapter."""
        self.event_publisher = event_publisher

    def _broadcast(
        self,
        event: OperationEvent,
        scope: Optional[str] = None,
        owner_client_id: Optional[str] = None,
    ) -> None:
        _broadcast(event, scope, owner_client_id, self.event_publisher)

    # ------------------------------------------------------------------
    # Create / idempotent lookup
    # ------------------------------------------------------------------

    def create_or_get(
        self,
        kind: str,
        scope: str,
        idempotency_key: Optional[str] = None,
        initial_message: str = "Operation created",
        client_id: Optional[str] = None,
    ) -> Operation:
        """
        Create a new pending operation or return an existing non-terminal one
        with the same scope (and optionally idempotency_key).
        """
        route = f"operation.create.{kind}"
        owner = client_id or scope
        if idempotency_key:
            existing_id = self.repo.get_idempotent_operation_id(owner, idempotency_key, route)
            if existing_id:
                existing = self.repo.get_operation(existing_id)
                if existing:
                    return existing

        existing = self.repo.get_latest_operation_by_scope(scope)
        if existing and existing.status not in ("completed", "failed", "cancelled"):
            return existing

        op_id = f"op_{uuid.uuid4().hex}"
        now = _now_iso()
        op = Operation(
            id=op_id,
            kind=kind,
            scope=scope,
            status="pending",
            stage="pending",
            revision=1,
            totals={"total": 0, "queued": 0, "running": 0, "succeeded": 0, "failed": 0, "skipped": 0, "cancelled": 0},
            timestamps={"created_at": now, "updated_at": now},
            owner_client_id=client_id,
        )
        event = _make_event(op_id, 1, "operation.created", initial_message)
        outbox = _outbox_spec(event, scope, client_id)
        self.repo.create_operation(op, [], initial_event=event, outbox=outbox)
        if idempotency_key:
            self.repo.save_idempotency_record(
                owner,
                idempotency_key,
                route,
                op_id,
                status="accepted",
            )
        self._broadcast(event, scope, client_id)
        return op

    def create_operation(
        self,
        kind: str,
        scope: str,
        items_data: List[Dict[str, Any]],
        initial_message: str = "Operation started",
    ) -> Operation:
        """Backward-compatible: create + declare items in one call."""
        op = self.create_or_get(kind, scope, initial_message=initial_message)
        if items_data:
            op = self.start(op.id)
            op = self.declare_items(op.id, items_data)
        return op

    # ------------------------------------------------------------------
    # Lifecycle transitions
    # ------------------------------------------------------------------

    def start(self, op_id: str, stage: str = "initializing", message: str = "Operation started", expected_revision: Optional[int] = None) -> Operation:
        """pending → running."""
        op = self._require_op(op_id)
        if expected_revision is not None and op.revision != expected_revision:
            raise RevisionConflictError(f"expected revision {expected_revision}, found {op.revision}")
        if op.status != "pending":
            return op
        now = _now_iso()
        ts = dict(op.timestamps or {})
        ts.update({"updated_at": now, "started_at": now})
        event = _make_event(op_id, op.revision + 1, "operation.started", message)
        outbox = _outbox_spec(event, op.scope, op.owner_client_id)
        if not self.repo.update_operation(op_id, "running", stage, op.revision + 1, timestamps=ts, event=event, outbox=outbox):
            raise RevisionConflictError(f"revision conflict updating operation {op_id}")
        self._broadcast(event, op.scope, op.owner_client_id)
        return self.repo.get_operation(op_id)

    def declare_items(self, op_id: str, items_data: List[Dict[str, Any]]) -> Operation:
        """
        Fix the total after discovery. Creates items with status=queued.
        May be called once; ``total`` becomes fixed after this call.
        """
        op = self._require_op(op_id)
        existing_items = self.repo.get_operation_items(op_id)
        existing_keys = {i.item_key for i in existing_items}
        items: List[OperationItem] = []
        for i, data in enumerate(items_data):
            ordinal = len(existing_items) + i
            item_key = data.get("item_key") or f"item_{ordinal}"
            if item_key in existing_keys:
                # Collision with a previously declared item: fall back to the
                # ordinal-based key, then suffix until free.
                base = f"item_{ordinal}"
                item_key = base
                suffix = 0
                while item_key in existing_keys:
                    suffix += 1
                    item_key = f"{base}_{suffix}"
            existing_keys.add(item_key)
            items.append(OperationItem(
                id=f"item_{uuid.uuid4().hex}",
                operation_id=op_id,
                item_key=item_key,
                ordinal=ordinal,
                status="queued",
                stage="queued",
                progress=0.0,
                attempts=0,
                input_json=data,
            ))

        n_existing = len(existing_items)
        n_new = len(items)
        totals = dict(op.totals or {})
        totals["total"] = n_existing + n_new
        totals["queued"] = totals.get("queued", 0) + n_new

        event = _make_event(
            op_id, op.revision + 1, "operation.items_declared",
            f"Declared {n_new} items (total={totals['total']})",
            payload_json={"item_count": n_new},
        )
        outbox = _outbox_spec(event, op.scope, op.owner_client_id)
        self.repo.commit_declare_items(
            op_id,
            op.revision,
            op.revision + 1,
            items,
            totals,
            op.status,
            op.stage,
            event,
            outbox,
        )
        self._broadcast(event, op.scope, op.owner_client_id)
        return self.repo.get_operation(op_id)

    def complete(self, op_id: str, message: str = "Operation completed", summary: Optional[Dict[str, Any]] = None) -> Operation:
        """running → completed."""
        op = self._require_op(op_id)
        if op.status in ("completed", "failed", "cancelled"):
            return op
        now = _now_iso()
        ts = dict(op.timestamps or {})
        ts.update({"updated_at": now, "completed_at": now})
        event = _make_event(op_id, op.revision + 1, "operation.completed", message)
        outbox = _outbox_spec(event, op.scope, op.owner_client_id)
        self.repo.update_operation(op_id, "completed", "completed", op.revision + 1, timestamps=ts, summary_json=summary, event=event, outbox=outbox)
        self._broadcast(event, op.scope, op.owner_client_id)
        return self.repo.get_operation(op_id)

    def fail(self, op_id: str, error: Dict[str, Any], message: str = "Operation failed") -> Operation:
        """running → failed."""
        op = self._require_op(op_id)
        if op.status in ("completed", "failed", "cancelled"):
            return op
        now = _now_iso()
        ts = dict(op.timestamps or {})
        ts.update({"updated_at": now, "failed_at": now})
        event = _make_event(op_id, op.revision + 1, "operation.failed", message, level="error")
        outbox = _outbox_spec(event, op.scope, op.owner_client_id)
        self.repo.update_operation(op_id, "failed", "failed", op.revision + 1, timestamps=ts, error_json=error, event=event, outbox=outbox)
        self._broadcast(event, op.scope, op.owner_client_id)
        return self.repo.get_operation(op_id)

    def request_cancel(self, op_id: str, reason: str = "Cancelled by user") -> Operation:
        """running → cancel_requested."""
        op = self._require_op(op_id)
        if op.status in ("completed", "failed", "cancelled", "cancel_requested"):
            return op
        now = _now_iso()
        ts = dict(op.timestamps or {})
        ts["updated_at"] = now
        event = _make_event(op_id, op.revision + 1, "operation.cancel_requested", reason, level="warn")
        outbox = _outbox_spec(event, op.scope, op.owner_client_id)
        self.repo.update_operation(op_id, "cancel_requested", op.stage, op.revision + 1, timestamps=ts, event=event, outbox=outbox)
        self._broadcast(event, op.scope, op.owner_client_id)
        return self.repo.get_operation(op_id)

    def cancel(self, op_id: str, reason: str = "Cancelled") -> Operation:
        """cancel_requested → cancelled (or running → cancelled directly)."""
        op = self._require_op(op_id)
        if op.status in ("completed", "failed", "cancelled"):
            return op
        now = _now_iso()
        ts = dict(op.timestamps or {})
        ts.update({"updated_at": now, "cancelled_at": now})
        event = _make_event(op_id, op.revision + 1, "operation.cancelled", reason, level="warn")
        outbox = _outbox_spec(event, op.scope, op.owner_client_id)
        self.repo.update_operation(op_id, "cancelled", "cancelled", op.revision + 1, timestamps=ts, event=event, outbox=outbox)
        self._broadcast(event, op.scope, op.owner_client_id)
        return self.repo.get_operation(op_id)

    # ------------------------------------------------------------------
    # Item transitions
    # ------------------------------------------------------------------

    @staticmethod
    def _totals_from_items(items: List[OperationItem]) -> Dict[str, int]:
        return {
            "total": len(items),
            "queued": sum(1 for i in items if i.status == "queued"),
            "running": sum(1 for i in items if i.status == "running"),
            "succeeded": sum(1 for i in items if i.status in ("completed", "succeeded")),
            "failed": sum(1 for i in items if i.status == "failed"),
            "skipped": sum(1 for i in items if i.status == "skipped"),
            "cancelled": sum(1 for i in items if i.status == "cancelled"),
        }

    def _commit_item_transition(
        self,
        op: Operation,
        item: OperationItem,
        event: OperationEvent,
        item_status: str,
        item_stage: str,
        progress: float,
        attempts: int,
        checkpoint_json: Optional[Dict[str, Any]] = None,
        result_json: Optional[Dict[str, Any]] = None,
        error_json: Optional[Dict[str, Any]] = None,
    ) -> None:
        items = self.repo.get_operation_items(op.id)
        totals = self._totals_from_items([
            OperationItem(
                id=row.id,
                operation_id=row.operation_id,
                item_key=row.item_key,
                ordinal=row.ordinal,
                status=item_status if row.id == item.id else row.status,
                stage=item_stage if row.id == item.id else row.stage,
                progress=progress if row.id == item.id else row.progress,
                attempts=attempts if row.id == item.id else row.attempts,
                input_json=row.input_json,
                checkpoint_json=checkpoint_json if row.id == item.id else row.checkpoint_json,
                result_json=result_json if row.id == item.id else row.result_json,
                error_json=error_json if row.id == item.id else row.error_json,
            )
            for row in items
        ])
        now = _now_iso()
        ts = dict(op.timestamps or {})
        ts["updated_at"] = now
        new_revision = op.revision + 1
        event.revision = new_revision
        outbox = _outbox_spec(event, op.scope, op.owner_client_id)
        self.repo.commit_item_transition(
            op.id,
            op.revision,
            new_revision,
            item.id,
            item_status,
            item_stage,
            progress,
            attempts,
            totals,
            op.status,
            op.stage,
            ts,
            event,
            outbox,
            checkpoint_json=checkpoint_json,
            result_json=result_json,
            error_json=error_json,
        )
        self._broadcast(event, op.scope, op.owner_client_id)

    def start_item(self, item_id: str, stage: str = "running", message: Optional[str] = None) -> OperationItem:
        """queued → running."""
        item = self._require_item(item_id)
        op = self._require_op(item.operation_id)
        attempts = item.attempts + 1
        event = _make_event(
            op.id,
            op.revision + 1,
            "item.started",
            message or f"Item {item.item_key} started ({stage})",
            item_id=item_id,
        )
        self._commit_item_transition(op, item, event, "running", stage, item.progress, attempts)
        return self.repo.get_operation_item(item_id)

    def update_item_progress(self, item_id: str, progress: float, stage: str, message: Optional[str] = None) -> None:
        """Update progress without changing status."""
        item = self._require_item(item_id)
        op = self._require_op(item.operation_id)
        event = _make_event(
            op.id,
            op.revision + 1,
            "item.progress",
            message or f"Item {item.item_key} progress {progress:.0%} ({stage})",
            item_id=item_id,
        )
        self._commit_item_transition(
            op, item, event, item.status, stage, progress, item.attempts
        )

    def complete_item(
        self,
        item_id: str,
        result_json: Optional[Dict[str, Any]] = None,
        message: Optional[str] = None,
    ) -> OperationItem:
        """running → completed."""
        item = self._require_item(item_id)
        op = self._require_op(item.operation_id)
        event = _make_event(
            op.id,
            op.revision + 1,
            "item.completed",
            message or f"Item {item.item_key} completed",
            item_id=item_id,
        )
        self._commit_item_transition(
            op, item, event, "completed", "completed", 1.0, item.attempts, result_json=result_json
        )
        return self.repo.get_operation_item(item_id)

    def fail_item(
        self,
        item_id: str,
        error_json: Optional[Dict[str, Any]] = None,
        message: Optional[str] = None,
    ) -> OperationItem:
        """running → failed (partial success: other items continue)."""
        item = self._require_item(item_id)
        op = self._require_op(item.operation_id)
        event = _make_event(
            op.id,
            op.revision + 1,
            "item.failed",
            message or f"Item {item.item_key} failed",
            item_id=item_id,
            level="error",
        )
        self._commit_item_transition(
            op,
            item,
            event,
            "failed",
            "failed",
            item.progress,
            item.attempts,
            error_json=error_json,
        )
        return self.repo.get_operation_item(item_id)

    def skip_item(self, item_id: str, reason: Optional[str] = None) -> OperationItem:
        """queued → skipped (e.g. cache hit)."""
        item = self._require_item(item_id)
        op = self._require_op(item.operation_id)
        event = _make_event(
            op.id,
            op.revision + 1,
            "item.skipped",
            reason or f"Item {item.item_key} skipped",
            item_id=item_id,
        )
        self._commit_item_transition(
            op, item, event, "skipped", "skipped", 1.0, item.attempts
        )
        return self.repo.get_operation_item(item_id)

    def cancel_item(self, item_id: str, reason: Optional[str] = None) -> OperationItem:
        """queued/running → cancelled."""
        item = self._require_item(item_id)
        op = self._require_op(item.operation_id)
        event = _make_event(
            op.id,
            op.revision + 1,
            "item.cancelled",
            reason or f"Item {item.item_key} cancelled",
            item_id=item_id,
            level="warn",
        )
        self._commit_item_transition(
            op, item, event, "cancelled", "cancelled", item.progress, item.attempts
        )
        return self.repo.get_operation_item(item_id)

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get_operation(self, op_id: str) -> Optional[Operation]:
        return self.repo.get_operation(op_id)

    def get_latest_operation_by_scope(self, scope: str) -> Optional[Operation]:
        return self.repo.get_latest_operation_by_scope(scope)

    def get_operation_items(self, op_id: str) -> List[OperationItem]:
        return self.repo.get_operation_items(op_id)

    def get_snapshot(
        self,
        op_id: Optional[str] = None,
        scope: Optional[str] = None,
        include_items: bool = True,
        include_results: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """Get bounded operation metadata; large item results are opt-in."""
        if op_id:
            op = self.repo.get_operation(op_id)
        elif scope:
            op = self.repo.get_latest_operation_by_scope(scope)
        else:
            return None
        if not op:
            return None

        items = (
            self.repo.get_operation_items(
                op.id,
                include_results=include_results,
                include_payloads=False,
            )
            if include_items
            else []
        )
        events = self.repo.get_events(op.id, limit=60)
        events.sort(key=lambda e: e.seq, reverse=True)

        terminal = ("completed", "failed", "cancelled")
        available_actions: List[str] = []
        if op.status not in terminal:
            available_actions.append("cancel")
        if op.status == "failed":
            available_actions.append("retry")

        return {
            "operation": {
                "id": op.id,
                "kind": op.kind,
                "scope": op.scope,
                "status": op.status,
                "stage": op.stage,
                "revision": op.revision,
                "totals": op.totals,
                "timestamps": op.timestamps,
                "error": op.error_json,
                "summary": op.summary_json,
            },
            "items": [
                {
                    "id": i.id,
                    "item_key": i.item_key,
                    "ordinal": i.ordinal,
                    "status": i.status,
                    "stage": i.stage,
                    "progress": i.progress,
                    "attempts": i.attempts,
                    **({"result": i.result_json} if include_results else {}),
                    "error": i.error_json,
                }
                for i in sorted(items, key=lambda x: x.ordinal)
            ],
            "recent_events": [
                {
                    "seq": e.seq,
                    "event_id": e.event_id,
                    "level": e.level,
                    "type": e.event_type,
                    "message": e.message,
                    "item_id": e.item_id,
                    "revision": e.revision,
                    "created_at": e.created_at,
                }
                for e in events
            ],
            "event_seq": events[0].seq if events else 0,
            "available_actions": available_actions,
        }

    def list_operations(self, scope: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """List recent operations, optionally filtered by scope."""
        operations = self.repo.list_operations(scope=scope, limit=limit)
        return [
            {
                "id": op.id,
                "kind": op.kind,
                "scope": op.scope,
                "status": op.status,
                "stage": op.stage,
                "revision": op.revision,
                "totals": op.totals,
                "timestamps": op.timestamps,
            }
            for op in operations
        ]

    def list_events(self, op_id: str, since_seq: int = 0, limit: int = 100) -> List[OperationEvent]:
        """List events for an operation since a given sequence."""
        return self.repo.get_events(op_id, since_seq, limit)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _require_op(self, op_id: str) -> Operation:
        op = self.repo.get_operation(op_id)
        if not op:
            raise ValueError(f"Operation {op_id} not found")
        return op

    def _require_item(self, item_id: str) -> OperationItem:
        item = self.repo.get_operation_item(item_id)
        if not item:
            raise ValueError(f"OperationItem {item_id} not found")
        return item

    def transition_item(
        self,
        item_id: str,
        status: str,
        stage: str,
        progress: float = 0.0,
        checkpoint_json: Optional[Dict[str, Any]] = None,
        result_json: Optional[Dict[str, Any]] = None,
        error_json: Optional[Dict[str, Any]] = None,
        message: Optional[str] = None,
    ) -> None:
        """Backward-compatible item transition (used by existing callers)."""
        item = self._require_item(item_id)
        op = self._require_op(item.operation_id)
        attempts = item.attempts
        if status == "running" and item.status != "running":
            attempts += 1
        event = _make_event(
            op.id,
            op.revision + 1,
            f"item.{status}",
            message or f"Item transitioned to {status} ({stage})",
            item_id=item_id,
            level="error" if status == "failed" else "info",
        )
        self._commit_item_transition(
            op,
            item,
            event,
            status,
            stage,
            progress,
            attempts,
            checkpoint_json=checkpoint_json,
            result_json=result_json,
            error_json=error_json,
        )

    def cancel_operation(self, op_id: str, reason: str = "Cancelled by user") -> None:
        """Backward-compatible alias for request_cancel."""
        self.request_cancel(op_id, reason)


operation_service = OperationService()


__all__ = [
    "OperationEventPublisher",
    "OperationService",
    "RevisionConflictError",
    "operation_service",
]
