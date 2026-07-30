# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

SCHEMA_VERSION = 3

def _create_operations_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS operations (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            scope TEXT NOT NULL,
            status TEXT NOT NULL,
            stage TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 0,
            totals TEXT,
            timestamps TEXT,
            error_json TEXT,
            summary_json TEXT,
            owner_client_id TEXT
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_operations_kind_scope ON operations(kind, scope)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_operations_scope ON operations(scope)")

def _create_operation_items_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS operation_items (
            id TEXT PRIMARY KEY,
            operation_id TEXT NOT NULL,
            item_key TEXT NOT NULL,
            ordinal INTEGER NOT NULL,
            status TEXT NOT NULL,
            stage TEXT NOT NULL,
            progress REAL NOT NULL DEFAULT 0.0,
            attempts INTEGER NOT NULL DEFAULT 0,
            input_json TEXT,
            checkpoint_json TEXT,
            result_json TEXT,
            error_json TEXT,
            FOREIGN KEY(operation_id) REFERENCES operations(id) ON DELETE CASCADE
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_operation_items_op_id ON operation_items(operation_id)")
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_items_op_key ON operation_items(operation_id, item_key)")

def _create_operation_events_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS operation_events (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT UNIQUE NOT NULL,
            operation_id TEXT NOT NULL,
            item_id TEXT,
            revision INTEGER NOT NULL,
            level TEXT NOT NULL,
            event_type TEXT NOT NULL,
            message TEXT NOT NULL,
            payload_json TEXT,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_operation_events_op_id ON operation_events(operation_id)")

def _create_ui_snapshots_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ui_snapshots (
            profile_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            schema_version INTEGER NOT NULL,
            revision INTEGER NOT NULL DEFAULT 0,
            state_json TEXT,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(profile_id, scope)
        )
    """)

def _create_consumer_offsets_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS consumer_offsets (
            consumer_id TEXT NOT NULL,
            stream TEXT NOT NULL,
            last_acked_seq INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(consumer_id, stream)
        )
    """)

def _create_remote_cursors_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS remote_cursors (
            source_type TEXT NOT NULL,
            source_id TEXT NOT NULL,
            cursor_json TEXT,
            snapshot_json TEXT,
            revision INTEGER NOT NULL DEFAULT 0,
            timestamps TEXT,
            error_json TEXT,
            PRIMARY KEY(source_type, source_id)
        )
    """)

def _create_system_events_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_events (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT UNIQUE NOT NULL,
            topic TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            revision INTEGER NOT NULL DEFAULT 0,
            trace_id TEXT,
            payload_json TEXT,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_system_events_topic ON system_events(topic)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_system_events_entity ON system_events(entity_type, entity_id)")

def _create_rpc_event_outbox_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rpc_event_outbox (
            event_id TEXT PRIMARY KEY,
            topic TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            revision INTEGER NOT NULL DEFAULT 0,
            causation_id TEXT,
            payload_json TEXT,
            audience TEXT,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rpc_outbox_topic ON rpc_event_outbox(topic)")


def _create_rpc_client_delivery_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rpc_client_delivery (
            client_id TEXT NOT NULL,
            event_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            topic TEXT NOT NULL,
            payload_json TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            attempt INTEGER NOT NULL DEFAULT 0,
            error_json TEXT,
            sent_at TEXT,
            acked_at TEXT,
            PRIMARY KEY (client_id, event_id)
        )
    """)
    cursor.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_rpc_delivery_client_seq "
        "ON rpc_client_delivery(client_id, seq)"
    )


def _create_rpc_client_offset_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rpc_client_offset (
            client_id TEXT PRIMARY KEY,
            highest_contiguous_acked_seq INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        )
    """)


def _create_rpc_command_idempotency_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rpc_command_idempotency (
            client_id TEXT NOT NULL,
            idempotency_key TEXT NOT NULL,
            route TEXT NOT NULL,
            operation_id TEXT,
            request_hash TEXT,
            status TEXT NOT NULL,
            response_json TEXT,
            error_json TEXT,
            expires_at TEXT,
            created_at TEXT NOT NULL,
            PRIMARY KEY (client_id, idempotency_key, route)
        )
    """)


def _create_rpc_client_sessions_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rpc_client_sessions (
            client_id TEXT PRIMARY KEY,
            resume_token TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)


def _migrate_schema(cursor: sqlite3.Cursor) -> None:
    cursor.execute("PRAGMA user_version")
    row = cursor.fetchone()
    version = int(row[0]) if row and row[0] is not None else 0
    if version >= SCHEMA_VERSION:
        return
    cursor.execute("PRAGMA table_info(operations)")
    op_cols = {str(r[1]) for r in cursor.fetchall()}
    if "owner_client_id" not in op_cols:
        cursor.execute("ALTER TABLE operations ADD COLUMN owner_client_id TEXT")
    _create_rpc_client_sessions_table(cursor)
    cursor.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")


def init_schema(conn: sqlite3.Connection) -> None:
    """Initialize the SQLite schema."""
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    cursor = conn.cursor()
    _create_operations_table(cursor)
    _create_operation_items_table(cursor)
    _create_operation_events_table(cursor)
    _create_ui_snapshots_table(cursor)
    _create_consumer_offsets_table(cursor)
    _create_remote_cursors_table(cursor)
    _create_system_events_table(cursor)
    _create_rpc_event_outbox_table(cursor)
    _create_rpc_client_delivery_table(cursor)
    _create_rpc_client_offset_table(cursor)
    _create_rpc_command_idempotency_table(cursor)
    _create_rpc_client_sessions_table(cursor)
    _migrate_schema(cursor)
    conn.commit()
