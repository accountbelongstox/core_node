# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

from pycore.database.models.state_models import (
    ConsumerOffset,
    Operation,
    OperationEvent,
    OperationItem,
    RemoteCursor,
    SystemEvent,
    UiSnapshot,
)
from pycore.database.schema.state_schema import init_schema
from pycore.pyfoundations.system_paths import get_local_data_dir


class RevisionConflictError(ValueError):
    """Raised when an operation mutation uses a stale expected revision."""


class StateRepository:
    """
    Thread-safe SQLite repository for operations and state.
    Uses a single connection per thread.
    """

    def __init__(self, db_path: Optional[Path] = None) -> None:
        if db_path is None:
            db_path = get_local_data_dir() / "pycore_state.sqlite3"
        self._db_path = db_path
        self._local = threading.local()
        # Initialize schema on first connection
        with self._get_conn() as conn:
            init_schema(conn)

    def _get_conn(self) -> sqlite3.Connection:
        if not hasattr(self._local, "conn"):
            self._local.conn = sqlite3.connect(
                str(self._db_path),
                timeout=30.0,  # Survive transient cross-instance lock contention
                isolation_level=None,  # We manage transactions manually
                check_same_thread=False,
            )
            # Enable WAL mode for better concurrency
            self._local.conn.execute("PRAGMA journal_mode=WAL")
            self._local.conn.execute("PRAGMA busy_timeout=30000")
            self._local.conn.execute("PRAGMA foreign_keys=ON")
        return self._local.conn

    @contextmanager
    def transaction(self) -> Generator[sqlite3.Cursor, None, None]:
        """Context manager for a database transaction."""
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    # --- Operations ---

    def create_operation(
        self,
        op: Operation,
        items: List[OperationItem],
        initial_event: Optional[OperationEvent] = None,
        outbox: Optional[Dict[str, Any]] = None,
    ) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO operations (
                    id, kind, scope, status, stage, revision,
                    totals, timestamps, error_json, summary_json, owner_client_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    op.id,
                    op.kind,
                    op.scope,
                    op.status,
                    op.stage,
                    op.revision,
                    json.dumps(op.totals) if op.totals else None,
                    json.dumps(op.timestamps) if op.timestamps else None,
                    json.dumps(op.error_json) if op.error_json else None,
                    json.dumps(op.summary_json) if op.summary_json else None,
                    op.owner_client_id,
                ),
            )
            for item in items:
                cursor.execute(
                    """
                    INSERT INTO operation_items (
                        id, operation_id, item_key, ordinal, status, stage,
                        progress, attempts, input_json, checkpoint_json,
                        result_json, error_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.id,
                        item.operation_id,
                        item.item_key,
                        item.ordinal,
                        item.status,
                        item.stage,
                        item.progress,
                        item.attempts,
                        json.dumps(item.input_json) if item.input_json else None,
                        json.dumps(item.checkpoint_json) if item.checkpoint_json else None,
                        json.dumps(item.result_json) if item.result_json else None,
                        json.dumps(item.error_json) if item.error_json else None,
                    ),
                )
            if initial_event:
                self._insert_event(cursor, initial_event, outbox)

    def insert_operation_items(
        self,
        op_id: str,
        items: List[OperationItem],
        event: Optional[OperationEvent] = None,
        outbox: Optional[Dict[str, Any]] = None,
    ) -> None:
        with self.transaction() as cursor:
            for item in items:
                cursor.execute(
                    """
                    INSERT INTO operation_items (
                        id, operation_id, item_key, ordinal, status, stage,
                        progress, attempts, input_json, checkpoint_json,
                        result_json, error_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.id,
                        op_id,
                        item.item_key,
                        item.ordinal,
                        item.status,
                        item.stage,
                        item.progress,
                        item.attempts,
                        json.dumps(item.input_json) if item.input_json else None,
                        json.dumps(item.checkpoint_json) if item.checkpoint_json else None,
                        json.dumps(item.result_json) if item.result_json else None,
                        json.dumps(item.error_json) if item.error_json else None,
                    ),
                )
            if event:
                self._insert_event(cursor, event, outbox)

    def commit_declare_items(
        self,
        op_id: str,
        expected_revision: int,
        new_revision: int,
        items: List[OperationItem],
        totals: Dict[str, Any],
        status: str,
        stage: str,
        event: OperationEvent,
        outbox: Dict[str, Any],
    ) -> None:
        with self.transaction() as cursor:
            cursor.execute("SELECT revision FROM operations WHERE id = ?", (op_id,))
            row = cursor.fetchone()
            if not row or int(row[0]) != int(expected_revision):
                raise RevisionConflictError(
                    f"revision conflict declaring items on {op_id}: expected {expected_revision}"
                )
            for item in items:
                cursor.execute(
                    """
                    INSERT INTO operation_items (
                        id, operation_id, item_key, ordinal, status, stage,
                        progress, attempts, input_json, checkpoint_json,
                        result_json, error_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.id,
                        op_id,
                        item.item_key,
                        item.ordinal,
                        item.status,
                        item.stage,
                        item.progress,
                        item.attempts,
                        json.dumps(item.input_json) if item.input_json else None,
                        json.dumps(item.checkpoint_json) if item.checkpoint_json else None,
                        json.dumps(item.result_json) if item.result_json else None,
                        json.dumps(item.error_json) if item.error_json else None,
                    ),
                )
            cursor.execute(
                """
                UPDATE operations
                SET status = ?, stage = ?, revision = ?, totals = ?
                WHERE id = ?
                """,
                (status, stage, new_revision, json.dumps(totals), op_id),
            )
            self._insert_event(cursor, event, outbox)

    def commit_item_transition(
        self,
        op_id: str,
        expected_revision: int,
        new_revision: int,
        item_id: str,
        item_status: str,
        item_stage: str,
        progress: float,
        attempts: int,
        totals: Dict[str, Any],
        op_status: str,
        op_stage: str,
        timestamps: Dict[str, Any],
        event: OperationEvent,
        outbox: Dict[str, Any],
        checkpoint_json: Optional[Dict[str, Any]] = None,
        result_json: Optional[Dict[str, Any]] = None,
        error_json: Optional[Dict[str, Any]] = None,
    ) -> None:
        with self.transaction() as cursor:
            cursor.execute("SELECT revision FROM operations WHERE id = ?", (op_id,))
            row = cursor.fetchone()
            if not row or int(row[0]) != int(expected_revision):
                raise RevisionConflictError(
                    f"revision conflict on item {item_id}: expected {expected_revision}"
                )
            updates = ["status = ?", "stage = ?", "progress = ?", "attempts = ?"]
            params: List[Any] = [item_status, item_stage, progress, attempts]
            if checkpoint_json is not None:
                updates.append("checkpoint_json = ?")
                params.append(json.dumps(checkpoint_json))
            if result_json is not None:
                updates.append("result_json = ?")
                params.append(json.dumps(result_json))
            if error_json is not None:
                updates.append("error_json = ?")
                params.append(json.dumps(error_json))
            params.append(item_id)
            cursor.execute(
                f"UPDATE operation_items SET {', '.join(updates)} WHERE id = ?",
                tuple(params),
            )
            cursor.execute(
                """
                UPDATE operations
                SET status = ?, stage = ?, revision = ?, totals = ?, timestamps = ?
                WHERE id = ?
                """,
                (
                    op_status,
                    op_stage,
                    new_revision,
                    json.dumps(totals),
                    json.dumps(timestamps),
                    op_id,
                ),
            )
            self._insert_event(cursor, event, outbox)

    def get_operation(self, op_id: str) -> Optional[Operation]:
        with self.transaction() as cursor:
            cursor.execute("SELECT * FROM operations WHERE id = ?", (op_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return Operation.from_row(row)

    def get_latest_operation_by_scope(self, scope: str) -> Optional[Operation]:
        with self.transaction() as cursor:
            cursor.execute(
                "SELECT * FROM operations WHERE scope = ? ORDER BY rowid DESC LIMIT 1",
                (scope,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return Operation.from_row(row)

    def list_operations(
        self,
        scope: Optional[str] = None,
        limit: int = 20,
    ) -> List[Operation]:
        with self.transaction() as cursor:
            if scope:
                cursor.execute(
                    "SELECT * FROM operations WHERE scope = ? ORDER BY rowid DESC LIMIT ?",
                    (scope, limit),
                )
            else:
                cursor.execute(
                    "SELECT * FROM operations ORDER BY rowid DESC LIMIT ?",
                    (limit,),
                )
            return [Operation.from_row(row) for row in cursor.fetchall()]

    def update_operation(
        self,
        op_id: str,
        status: str,
        stage: str,
        revision: int,
        totals: Optional[Dict[str, Any]] = None,
        timestamps: Optional[Dict[str, Any]] = None,
        error_json: Optional[Dict[str, Any]] = None,
        summary_json: Optional[Dict[str, Any]] = None,
        event: Optional[OperationEvent] = None,
        outbox: Optional[Dict[str, Any]] = None,
    ) -> bool:
        with self.transaction() as cursor:
            # Optimistic concurrency control
            cursor.execute("SELECT revision FROM operations WHERE id = ?", (op_id,))
            row = cursor.fetchone()
            if not row or row[0] != revision - 1:
                return False

            updates = ["status = ?", "stage = ?", "revision = ?"]
            params: List[Any] = [status, stage, revision]

            if totals is not None:
                updates.append("totals = ?")
                params.append(json.dumps(totals))
            if timestamps is not None:
                updates.append("timestamps = ?")
                params.append(json.dumps(timestamps))
            if error_json is not None:
                updates.append("error_json = ?")
                params.append(json.dumps(error_json))
            if summary_json is not None:
                updates.append("summary_json = ?")
                params.append(json.dumps(summary_json))

            params.append(op_id)
            cursor.execute(
                f"UPDATE operations SET {', '.join(updates)} WHERE id = ?",
                tuple(params),
            )
            if event:
                self._insert_event(cursor, event, outbox)
            return True

    # --- Operation Items ---

    def get_operation_items(self, op_id: str) -> List[OperationItem]:
        with self.transaction() as cursor:
            cursor.execute(
                "SELECT * FROM operation_items WHERE operation_id = ? ORDER BY ordinal",
                (op_id,),
            )
            return [OperationItem.from_row(row) for row in cursor.fetchall()]

    def get_operation_item(self, item_id: str) -> Optional[OperationItem]:
        with self.transaction() as cursor:
            cursor.execute("SELECT * FROM operation_items WHERE id = ?", (item_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return OperationItem.from_row(row)

    def update_operation_item(
        self,
        item_id: str,
        status: str,
        stage: str,
        progress: float,
        attempts: int,
        checkpoint_json: Optional[Dict[str, Any]] = None,
        result_json: Optional[Dict[str, Any]] = None,
        error_json: Optional[Dict[str, Any]] = None,
        event: Optional[OperationEvent] = None,
        outbox: Optional[Dict[str, Any]] = None,
    ) -> None:
        with self.transaction() as cursor:
            updates = ["status = ?", "stage = ?", "progress = ?", "attempts = ?"]
            params: List[Any] = [status, stage, progress, attempts]

            if checkpoint_json is not None:
                updates.append("checkpoint_json = ?")
                params.append(json.dumps(checkpoint_json))
            if result_json is not None:
                updates.append("result_json = ?")
                params.append(json.dumps(result_json))
            if error_json is not None:
                updates.append("error_json = ?")
                params.append(json.dumps(error_json))

            params.append(item_id)
            cursor.execute(
                f"UPDATE operation_items SET {', '.join(updates)} WHERE id = ?",
                tuple(params),
            )
            if event:
                self._insert_event(cursor, event, outbox)

    # --- Events ---

    def _insert_outbox(
        self,
        cursor: sqlite3.Cursor,
        event_id: str,
        outbox: Dict[str, Any],
    ) -> None:
        payload = outbox.get("payload") or {}
        cursor.execute(
            """
            INSERT OR IGNORE INTO rpc_event_outbox (
                event_id, topic, entity_type, entity_id, revision,
                causation_id, payload_json, audience, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                str(outbox.get("topic") or "operation.changed"),
                outbox.get("entity_type"),
                outbox.get("entity_id"),
                int(outbox.get("revision") or 0),
                outbox.get("causation_id"),
                json.dumps(payload),
                str(outbox.get("audience") or "*"),
                self._now_iso(),
            ),
        )

    def _insert_event(
        self,
        cursor: sqlite3.Cursor,
        event: OperationEvent,
        outbox: Optional[Dict[str, Any]] = None,
    ) -> None:
        cursor.execute(
            """
            INSERT INTO operation_events (
                event_id, operation_id, item_id, revision, level,
                event_type, message, payload_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.event_id,
                event.operation_id,
                event.item_id,
                event.revision,
                event.level,
                event.event_type,
                event.message,
                json.dumps(event.payload_json) if event.payload_json else None,
                event.created_at,
            ),
        )
        event.seq = cursor.lastrowid
        if outbox:
            self._insert_outbox(cursor, event.event_id, outbox)

    def get_outbox_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT topic, entity_type, entity_id, revision, payload_json, audience
                FROM rpc_event_outbox WHERE event_id = ?
                """,
                (event_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            payload_json = row[4]
            return {
                "event_id": event_id,
                "topic": row[0],
                "entity_type": row[1],
                "entity_id": row[2],
                "revision": int(row[3] or 0),
                "payload": json.loads(payload_json) if payload_json else {},
                "audience": row[5] or "*",
            }

    def _delivery_envelope(
        self,
        client_id: str,
        event_id: str,
        seq: int,
        topic: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "type": "server_event",
            "client_id": client_id,
            "event_id": event_id,
            "seq": seq,
            "topic": topic,
            "entity_id": payload.get("operation_id"),
            "revision": int(payload.get("operation_revision") or 0),
            "requires_ack": True,
            "payload": payload,
        }

    def _get_existing_delivery(
        self,
        cursor: sqlite3.Cursor,
        client_id: str,
        event_id: str,
    ) -> Optional[Dict[str, Any]]:
        cursor.execute(
            """
            SELECT seq, topic, payload_json
            FROM rpc_client_delivery
            WHERE client_id = ? AND event_id = ?
            """,
            (client_id, event_id),
        )
        row = cursor.fetchone()
        if not row:
            return None
        payload = json.loads(row[2]) if row[2] else {}
        return self._delivery_envelope(client_id, event_id, int(row[0]), row[1], payload)

    def _advance_contiguous_offset(self, cursor: sqlite3.Cursor, client_id: str) -> int:
        cursor.execute(
            "SELECT highest_contiguous_acked_seq FROM rpc_client_offset WHERE client_id = ?",
            (client_id,),
        )
        row = cursor.fetchone()
        offset = int(row[0]) if row and row[0] is not None else 0
        cursor.execute(
            """
            SELECT seq FROM rpc_client_delivery
            WHERE client_id = ? AND status = 'acked' AND seq > ?
            ORDER BY seq ASC
            """,
            (client_id, offset),
        )
        expected = offset + 1
        for (seq_value,) in cursor.fetchall():
            if int(seq_value) != expected:
                break
            offset = expected
            expected += 1
        cursor.execute(
            """
            INSERT INTO rpc_client_offset (client_id, highest_contiguous_acked_seq, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(client_id) DO UPDATE SET
                highest_contiguous_acked_seq = excluded.highest_contiguous_acked_seq,
                updated_at = excluded.updated_at
            """,
            (client_id, offset, self._now_iso()),
        )
        return offset

    def append_client_delivery(
        self,
        client_id: str,
        event_id: str,
        topic: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        payload_json = json.dumps(payload)
        with self.transaction() as cursor:
            existing = self._get_existing_delivery(cursor, client_id, event_id)
            if existing is not None:
                return existing
            seq = self._next_client_seq(cursor, client_id)
            cursor.execute(
                """
                INSERT INTO rpc_client_delivery (
                    client_id, event_id, seq, topic, payload_json,
                    status, attempt, error_json, sent_at, acked_at
                ) VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, NULL)
                """,
                (client_id, event_id, seq, topic, payload_json),
            )
        return self._delivery_envelope(client_id, event_id, seq, topic, payload)

    def get_events(
        self, op_id: str, since_seq: int = 0, limit: int = 100
    ) -> List[OperationEvent]:
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT * FROM operation_events
                WHERE operation_id = ? AND seq > ?
                ORDER BY seq ASC LIMIT ?
                """,
                (op_id, since_seq, limit),
            )
            return [OperationEvent.from_row(row) for row in cursor.fetchall()]

    # --- System Events ---

    def insert_system_event(self, event: SystemEvent) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO system_events (
                    event_id, topic, entity_type, entity_id,
                    revision, trace_id, payload_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event.event_id,
                    event.topic,
                    event.entity_type,
                    event.entity_id,
                    event.revision,
                    event.trace_id,
                    json.dumps(event.payload_json) if event.payload_json else None,
                    event.created_at,
                ),
            )
            event.seq = cursor.lastrowid

    def get_system_events(self, since_seq: int = 0, limit: int = 500) -> List[SystemEvent]:
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT * FROM system_events
                WHERE seq > ?
                ORDER BY seq ASC LIMIT ?
                """,
                (since_seq, limit),
            )
            return [SystemEvent.from_row(row) for row in cursor.fetchall()]

    def get_latest_system_event_seq(self) -> int:
        with self.transaction() as cursor:
            cursor.execute("SELECT MAX(seq) FROM system_events")
            row = cursor.fetchone()
            return row[0] if row and row[0] is not None else 0

    # --- UI Snapshots ---

    def get_ui_snapshot(self, profile_id: str, scope: str) -> Optional[UiSnapshot]:
        with self.transaction() as cursor:
            cursor.execute(
                "SELECT * FROM ui_snapshots WHERE profile_id = ? AND scope = ?",
                (profile_id, scope),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return UiSnapshot.from_row(row)

    def save_ui_snapshot(self, snapshot: UiSnapshot) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO ui_snapshots (
                    profile_id, scope, schema_version, revision, state_json, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(profile_id, scope) DO UPDATE SET
                    schema_version = excluded.schema_version,
                    revision = excluded.revision,
                    state_json = excluded.state_json,
                    updated_at = excluded.updated_at
                """,
                (
                    snapshot.profile_id,
                    snapshot.scope,
                    snapshot.schema_version,
                    snapshot.revision,
                    json.dumps(snapshot.state_json) if snapshot.state_json else None,
                    snapshot.updated_at,
                ),
            )

    # --- Remote Cursors ---

    def get_remote_cursor(
        self, source_type: str, source_id: str
    ) -> Optional[RemoteCursor]:
        with self.transaction() as cursor:
            cursor.execute(
                "SELECT * FROM remote_cursors WHERE source_type = ? AND source_id = ?",
                (source_type, source_id),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return RemoteCursor.from_row(row)

    def save_remote_cursor(self, cursor_obj: RemoteCursor) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO remote_cursors (
                    source_type, source_id, cursor_json, snapshot_json,
                    revision, timestamps, error_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(source_type, source_id) DO UPDATE SET
                    cursor_json = excluded.cursor_json,
                    snapshot_json = excluded.snapshot_json,
                    revision = excluded.revision,
                    timestamps = excluded.timestamps,
                    error_json = excluded.error_json
                """,
                (
                    cursor_obj.source_type,
                    cursor_obj.source_id,
                    json.dumps(cursor_obj.cursor_json) if cursor_obj.cursor_json else None,
                    json.dumps(cursor_obj.snapshot_json) if cursor_obj.snapshot_json else None,
                    cursor_obj.revision,
                    json.dumps(cursor_obj.timestamps) if cursor_obj.timestamps else None,
                    json.dumps(cursor_obj.error_json) if cursor_obj.error_json else None,
                ),
            )

    # --- RPC durable delivery (V4/V7) ---

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def get_idempotent_operation_id(
        self,
        client_id: str,
        idempotency_key: str,
        route: str,
    ) -> Optional[str]:
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT operation_id FROM rpc_command_idempotency
                WHERE client_id = ? AND idempotency_key = ? AND route = ?
                """,
                (client_id, idempotency_key, route),
            )
            row = cursor.fetchone()
            if not row or not row[0]:
                return None
            return str(row[0])

    def get_command_idempotency(
        self,
        client_id: str,
        route: str,
        idempotency_key: str,
    ) -> Optional[Dict[str, Any]]:
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT status, response_json, error_json, operation_id
                FROM rpc_command_idempotency
                WHERE client_id = ? AND idempotency_key = ? AND route = ?
                """,
                (client_id, idempotency_key, route),
            )
            row = cursor.fetchone()
            if not row:
                return None
            response_json = json.loads(row[1]) if row[1] else None
            error_json = json.loads(row[2]) if row[2] else None
            return {
                "status": row[0],
                "response_json": response_json,
                "error_json": error_json,
                "operation_id": row[3],
            }

    def save_idempotency_record(
        self,
        client_id: str,
        idempotency_key: str,
        route: str,
        operation_id: str,
        status: str = "accepted",
        response_json: Optional[Dict[str, Any]] = None,
        error_json: Optional[Dict[str, Any]] = None,
        request_hash: Optional[str] = None,
    ) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO rpc_command_idempotency (
                    client_id, idempotency_key, route, operation_id,
                    request_hash, status, response_json, error_json,
                    expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(client_id, idempotency_key, route) DO UPDATE SET
                    operation_id = excluded.operation_id,
                    status = excluded.status,
                    response_json = excluded.response_json,
                    error_json = excluded.error_json
                """,
                (
                    client_id,
                    idempotency_key,
                    route,
                    operation_id,
                    request_hash,
                    status,
                    json.dumps(response_json) if response_json else None,
                    json.dumps(error_json) if error_json else None,
                    None,
                    self._now_iso(),
                ),
            )

    def save_command_idempotency_pending(
        self,
        client_id: str,
        route: str,
        idempotency_key: str,
        request_id: Optional[str] = None,
    ) -> bool:
        """Insert pending idempotency row; returns False if already completed."""
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT status FROM rpc_command_idempotency
                WHERE client_id = ? AND idempotency_key = ? AND route = ?
                """,
                (client_id, idempotency_key, route),
            )
            row = cursor.fetchone()
            if row and str(row[0]) == "completed":
                return False
            cursor.execute(
                """
                INSERT INTO rpc_command_idempotency (
                    client_id, idempotency_key, route, operation_id,
                    request_hash, status, response_json, error_json,
                    expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)
                ON CONFLICT(client_id, idempotency_key, route) DO UPDATE SET
                    status = CASE
                        WHEN rpc_command_idempotency.status = 'completed'
                        THEN rpc_command_idempotency.status
                        ELSE 'pending'
                    END
                """,
                (
                    client_id,
                    idempotency_key,
                    route,
                    request_id,
                    request_id,
                    self._now_iso(),
                ),
            )
            return True

    def save_command_idempotency_response(
        self,
        client_id: str,
        route: str,
        idempotency_key: str,
        response_json: Dict[str, Any],
        status: str = "completed",
        error_json: Optional[Dict[str, Any]] = None,
    ) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO rpc_command_idempotency (
                    client_id, idempotency_key, route, operation_id,
                    request_hash, status, response_json, error_json,
                    expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
                ON CONFLICT(client_id, idempotency_key, route) DO UPDATE SET
                    status = excluded.status,
                    response_json = excluded.response_json,
                    error_json = excluded.error_json
                """,
                (
                    client_id,
                    idempotency_key,
                    route,
                    response_json.get("request_id"),
                    response_json.get("request_id"),
                    status,
                    json.dumps(response_json),
                    json.dumps(error_json) if error_json else None,
                    self._now_iso(),
                ),
            )

    def authenticate_client_session(
        self,
        client_id: str,
        resume_token: Optional[str],
    ) -> Tuple[bool, str]:
        """
        Validate or create a durable client session.

        Returns (authenticated, resume_token). When authentication fails the token is empty.
        """
        with self.transaction() as cursor:
            cursor.execute(
                "SELECT resume_token FROM rpc_client_sessions WHERE client_id = ?",
                (client_id,),
            )
            row = cursor.fetchone()
            now = self._now_iso()
            if row:
                stored = str(row[0])
                if resume_token and resume_token == stored:
                    cursor.execute(
                        "UPDATE rpc_client_sessions SET updated_at = ? WHERE client_id = ?",
                        (now, client_id),
                    )
                    return True, stored
                return False, ""
            new_token = uuid.uuid4().hex
            cursor.execute(
                """
                INSERT INTO rpc_client_sessions (client_id, resume_token, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (client_id, new_token, now, now),
            )
            return True, new_token

    def _next_client_seq(self, cursor: sqlite3.Cursor, client_id: str) -> int:
        cursor.execute(
            "SELECT MAX(seq) FROM rpc_client_delivery WHERE client_id = ?",
            (client_id,),
        )
        row = cursor.fetchone()
        current = int(row[0]) if row and row[0] is not None else 0
        return current + 1

    def enqueue_client_event(
        self,
        client_id: str,
        topic: str,
        payload: Dict[str, Any],
        event_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        revision: int = 0,
        causation_id: Optional[str] = None,
        audience: str = "client",
    ) -> Dict[str, Any]:
        event_id = event_id or uuid.uuid4().hex
        created_at = self._now_iso()
        payload_json = json.dumps(payload)
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT OR IGNORE INTO rpc_event_outbox (
                    event_id, topic, entity_type, entity_id, revision,
                    causation_id, payload_json, audience, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    topic,
                    entity_type,
                    entity_id,
                    revision,
                    causation_id,
                    payload_json,
                    audience,
                    created_at,
                ),
            )
            existing = self._get_existing_delivery(cursor, client_id, event_id)
            if existing is not None:
                return existing
            seq = self._next_client_seq(cursor, client_id)
            cursor.execute(
                """
                INSERT INTO rpc_client_delivery (
                    client_id, event_id, seq, topic, payload_json,
                    status, attempt, error_json, sent_at, acked_at
                ) VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, NULL)
                """,
                (client_id, event_id, seq, topic, payload_json),
            )
        return self._delivery_envelope(
            client_id,
            event_id,
            seq,
            topic,
            payload,
        )

    def mark_delivery_sent(self, client_id: str, event_id: str) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                UPDATE rpc_client_delivery
                SET status = 'sent', sent_at = ?
                WHERE client_id = ? AND event_id = ?
                """,
                (self._now_iso(), client_id, event_id),
            )

    def ack_client_delivery(self, client_id: str, event_id: str, seq: int) -> bool:
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT seq, status FROM rpc_client_delivery
                WHERE client_id = ? AND event_id = ?
                """,
                (client_id, event_id),
            )
            row = cursor.fetchone()
            if not row or int(row[0]) != int(seq):
                return False
            cursor.execute(
                """
                UPDATE rpc_client_delivery
                SET status = 'acked', acked_at = ?
                WHERE client_id = ? AND event_id = ?
                """,
                (self._now_iso(), client_id, event_id),
            )
            self._advance_contiguous_offset(cursor, client_id)
            return True

    def get_client_offset(self, client_id: str) -> int:
        with self.transaction() as cursor:
            cursor.execute(
                "SELECT highest_contiguous_acked_seq FROM rpc_client_offset WHERE client_id = ?",
                (client_id,),
            )
            row = cursor.fetchone()
            return int(row[0]) if row and row[0] is not None else 0

    def list_durable_client_ids(self) -> List[str]:
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT client_id FROM rpc_client_offset
                UNION
                SELECT DISTINCT client_id FROM rpc_client_delivery
                """
            )
            return [str(row[0]) for row in cursor.fetchall() if row and row[0]]

    def replay_unacked_deliveries(
        self,
        client_id: str,
        after_seq: int = 0,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        with self.transaction() as cursor:
            cursor.execute(
                """
                SELECT event_id, seq, topic, payload_json
                FROM rpc_client_delivery
                WHERE client_id = ? AND seq > ? AND status != 'acked'
                ORDER BY seq ASC LIMIT ?
                """,
                (client_id, after_seq, limit),
            )
            rows = cursor.fetchall()
        deliveries: List[Dict[str, Any]] = []
        for event_id, seq, topic, payload_json in rows:
            payload = json.loads(payload_json) if payload_json else {}
            deliveries.append(
                {
                    "type": "server_event",
                    "client_id": client_id,
                    "event_id": event_id,
                    "seq": int(seq),
                    "topic": topic,
                    "requires_ack": True,
                    "payload": payload,
                }
            )
        return deliveries

    def list_nonterminal_operations(self, limit: int = 20) -> List[Operation]:
        terminal = ("completed", "failed", "cancelled")
        placeholders = ",".join("?" for _ in terminal)
        with self.transaction() as cursor:
            cursor.execute(
                f"""
                SELECT * FROM operations
                WHERE status NOT IN ({placeholders})
                ORDER BY rowid DESC LIMIT ?
                """,
                (*terminal, limit),
            )
            return [Operation.from_row(row) for row in cursor.fetchall()]
