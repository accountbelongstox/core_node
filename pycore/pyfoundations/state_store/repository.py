# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

from pycore.pyfoundations.state_store.models import (
    ConsumerOffset,
    Operation,
    OperationEvent,
    OperationItem,
    RemoteCursor,
    SystemEvent,
    UiSnapshot,
)
from pycore.pyfoundations.state_store.schema import init_schema
from pycore.pyfoundations.system_paths import get_local_data_dir


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
                isolation_level=None,  # We manage transactions manually
                check_same_thread=False,
            )
            # Enable WAL mode for better concurrency
            self._local.conn.execute("PRAGMA journal_mode=WAL")
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
    ) -> None:
        with self.transaction() as cursor:
            cursor.execute(
                """
                INSERT INTO operations (
                    id, kind, scope, status, stage, revision,
                    totals, timestamps, error_json, summary_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                self._insert_event(cursor, initial_event)

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
                self._insert_event(cursor, event)
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
                self._insert_event(cursor, event)

    # --- Events ---

    def _insert_event(self, cursor: sqlite3.Cursor, event: OperationEvent) -> None:
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
