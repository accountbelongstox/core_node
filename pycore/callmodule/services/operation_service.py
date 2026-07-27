# -*- coding: utf-8 -*-
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.state_store import (
    Operation,
    OperationEvent,
    OperationItem,
    StateRepository,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class OperationService:
    """
    Service for managing the lifecycle of operations and their items.
    """

    def __init__(self, repo: Optional[StateRepository] = None) -> None:
        self.repo = repo or StateRepository()

    def create_operation(
        self,
        kind: str,
        scope: str,
        items_data: List[Dict[str, Any]],
        initial_message: str = "Operation started",
    ) -> Operation:
        """Create a new operation with its items."""
        op_id = f"op_{uuid.uuid4().hex}"
        now = _now_iso()
        
        op = Operation(
            id=op_id,
            kind=kind,
            scope=scope,
            status="running",
            stage="initializing",
            revision=1,
            totals={
                "total": len(items_data),
                "queued": len(items_data),
                "running": 0,
                "succeeded": 0,
                "failed": 0,
            },
            timestamps={"created_at": now, "updated_at": now},
        )

        items = []
        for i, data in enumerate(items_data):
            item_key = data.get("item_key", f"item_{i}")
            item = OperationItem(
                id=f"item_{uuid.uuid4().hex}",
                operation_id=op_id,
                item_key=item_key,
                ordinal=i,
                status="queued",
                stage="queued",
                progress=0.0,
                attempts=0,
                input_json=data,
            )
            items.append(item)

        event = OperationEvent(
            seq=0,  # Assigned by repo
            event_id=uuid.uuid4().hex,
            operation_id=op_id,
            item_id=None,
            revision=1,
            level="info",
            event_type="operation.started",
            message=initial_message,
            created_at=now,
        )

        self.repo.create_operation(op, items, event)
        return op

    def get_operation(self, op_id: str) -> Optional[Operation]:
        return self.repo.get_operation(op_id)

    def get_latest_operation_by_scope(self, scope: str) -> Optional[Operation]:
        return self.repo.get_latest_operation_by_scope(scope)

    def get_operation_items(self, op_id: str) -> List[OperationItem]:
        return self.repo.get_operation_items(op_id)

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
        """Update an item's state and log an event."""
        item = self.repo.get_operation_item(item_id)
        if not item:
            raise ValueError(f"Item {item_id} not found")

        op = self.repo.get_operation(item.operation_id)
        if not op:
            raise ValueError(f"Operation {item.operation_id} not found")

        # Update item
        attempts = item.attempts
        if status == "running" and item.status != "running":
            attempts += 1

        now = _now_iso()
        event = OperationEvent(
            seq=0,
            event_id=uuid.uuid4().hex,
            operation_id=op.id,
            item_id=item.id,
            revision=op.revision + 1,
            level="error" if status == "failed" else "info",
            event_type=f"item.{status}",
            message=message or f"Item transitioned to {status} ({stage})",
            created_at=now,
        )

        self.repo.update_operation_item(
            item_id=item.id,
            status=status,
            stage=stage,
            progress=progress,
            attempts=attempts,
            checkpoint_json=checkpoint_json,
            result_json=result_json,
            error_json=error_json,
            event=event,
        )

        # Update operation totals
        self._recalculate_totals(op.id)

    def _recalculate_totals(self, op_id: str) -> None:
        """Recalculate operation totals based on items and update operation."""
        items = self.repo.get_operation_items(op_id)
        op = self.repo.get_operation(op_id)
        if not op:
            return

        totals = {
            "total": len(items),
            "queued": sum(1 for i in items if i.status == "queued"),
            "running": sum(1 for i in items if i.status == "running"),
            "succeeded": sum(1 for i in items if i.status == "succeeded"),
            "failed": sum(1 for i in items if i.status == "failed"),
        }

        # Determine overall status
        status = op.status
        stage = op.stage
        if totals["succeeded"] + totals["failed"] == totals["total"]:
            status = "completed"
            stage = "completed"
        elif totals["running"] > 0:
            status = "running"
            stage = "processing"

        now = _now_iso()
        timestamps = op.timestamps
        timestamps["updated_at"] = now
        if status == "completed" and "completed_at" not in timestamps:
            timestamps["completed_at"] = now

        self.repo.update_operation(
            op_id=op.id,
            status=status,
            stage=stage,
            revision=op.revision + 1,
            totals=totals,
            timestamps=timestamps,
        )

    def cancel_operation(self, op_id: str, reason: str = "Cancelled by user") -> None:
        """Mark an operation as cancel_requested."""
        op = self.repo.get_operation(op_id)
        if not op or op.status in ("completed", "cancelled"):
            return

        now = _now_iso()
        event = OperationEvent(
            seq=0,
            event_id=uuid.uuid4().hex,
            operation_id=op.id,
            item_id=None,
            revision=op.revision + 1,
            level="warn",
            event_type="operation.cancel_requested",
            message=reason,
            created_at=now,
        )

        self.repo.update_operation(
            op_id=op.id,
            status="cancel_requested",
            stage=op.stage,
            revision=op.revision + 1,
            event=event,
        )

    def get_snapshot(self, op_id: Optional[str] = None, scope: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get a full snapshot of the operation, items, and recent events."""
        if op_id:
            op = self.repo.get_operation(op_id)
        elif scope:
            op = self.repo.get_latest_operation_by_scope(scope)
        else:
            return None
            
        if not op:
            return None

        items = self.repo.get_operation_items(op.id)
        events = self.repo.get_events(op.id, limit=60)
        
        # Sort events descending for UI
        events.sort(key=lambda e: e.seq, reverse=True)

        return {
            "operation": {
                "id": op.id,
                "status": op.status,
                "stage": op.stage,
                "revision": op.revision,
                "totals": op.totals,
                "timestamps": op.timestamps,
                "error": op.error_json,
            },
            "items": [
                {
                    "id": i.id,
                    "item_key": i.item_key,
                    "status": i.status,
                    "stage": i.stage,
                    "progress": i.progress,
                    "attempts": i.attempts,
                    "result": i.result_json,
                    "error": i.error_json,
                }
                for i in items
            ],
            "recent_events": [
                {
                    "seq": e.seq,
                    "level": e.level,
                    "type": e.event_type,
                    "message": e.message,
                    "created_at": e.created_at,
                }
                for e in events
            ],
            "event_seq": events[0].seq if events else 0,
        }
