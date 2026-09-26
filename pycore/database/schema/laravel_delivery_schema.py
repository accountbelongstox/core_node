# -*- coding: utf-8 -*-
from __future__ import annotations

import sqlite3

from pycore.database.models.table_keys import TableKeys


LARAVEL_DELIVERIES_TABLE = TableKeys.get_full_table_name(TableKeys.LARAVEL_DELIVERIES)
LARAVEL_DELIVERY_RECEIPTS_TABLE = TableKeys.get_full_table_name(TableKeys.LARAVEL_DELIVERY_RECEIPTS)
LARAVEL_DELIVERY_STATE_TABLE = TableKeys.get_full_table_name(TableKeys.LARAVEL_DELIVERY_STATE)
LARAVEL_DELIVERY_METRICS_TABLE = TableKeys.get_full_table_name(TableKeys.LARAVEL_DELIVERY_METRICS)
LARAVEL_DELIVERY_META_TABLE = TableKeys.get_full_table_name(TableKeys.LARAVEL_DELIVERY_META)
# v1: un-namespaced rows/receipts/metrics; v2: every row, delivered-state
# entry and metric belongs to one Laravel server namespace.
LARAVEL_DELIVERY_SCHEMA_VERSION = 2


def _columns(connection: sqlite3.Connection, table: str) -> set:
    return {str(row[1]) for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}


def _table_exists(connection: sqlite3.Connection, table: str) -> bool:
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,),
    ).fetchone() is not None


def _create_deliveries(connection: sqlite3.Connection) -> None:
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {LARAVEL_DELIVERIES_TABLE} (
            delivery_id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            namespace TEXT NOT NULL DEFAULT '',
            item_key TEXT NOT NULL DEFAULT '',
            identity TEXT NOT NULL DEFAULT '',
            group_key TEXT NOT NULL DEFAULT '',
            state TEXT NOT NULL DEFAULT 'pending',
            stage TEXT NOT NULL DEFAULT '',
            next_attempt_at REAL NOT NULL DEFAULT 0,
            lease_owner TEXT NOT NULL DEFAULT '',
            lease_process TEXT NOT NULL DEFAULT '',
            lease_until REAL NOT NULL DEFAULT 0,
            identity_delivered INTEGER NOT NULL DEFAULT 0,
            payload_sha256 TEXT NOT NULL DEFAULT '',
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT NOT NULL DEFAULT '',
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL,
            body TEXT NOT NULL
        )
        """
    )


def _create_indexes(connection: sqlite3.Connection) -> None:
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{LARAVEL_DELIVERIES_TABLE}_ready "
        f"ON {LARAVEL_DELIVERIES_TABLE}(kind, state, next_attempt_at, created_at)"
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{LARAVEL_DELIVERIES_TABLE}_identity "
        f"ON {LARAVEL_DELIVERIES_TABLE}(kind, namespace, identity)"
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{LARAVEL_DELIVERIES_TABLE}_group "
        f"ON {LARAVEL_DELIVERIES_TABLE}(kind, namespace, group_key, state)"
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{LARAVEL_DELIVERIES_TABLE}_namespace "
        f"ON {LARAVEL_DELIVERIES_TABLE}(namespace, kind, state)"
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{LARAVEL_DELIVERIES_TABLE}_item "
        f"ON {LARAVEL_DELIVERIES_TABLE}(namespace, kind, item_key)"
    )


def _create_state(connection: sqlite3.Connection) -> None:
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {LARAVEL_DELIVERY_STATE_TABLE} (
            namespace TEXT NOT NULL,
            kind TEXT NOT NULL,
            item_key TEXT NOT NULL,
            content_hash TEXT NOT NULL DEFAULT '',
            receipt TEXT NOT NULL DEFAULT '{{}}',
            delivered_at REAL NOT NULL,
            PRIMARY KEY (namespace, kind, item_key)
        ) WITHOUT ROWID
        """
    )
    connection.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{LARAVEL_DELIVERY_STATE_TABLE}_age "
        f"ON {LARAVEL_DELIVERY_STATE_TABLE}(kind, delivered_at)"
    )


def _create_metrics(connection: sqlite3.Connection) -> None:
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {LARAVEL_DELIVERY_METRICS_TABLE} (
            namespace TEXT NOT NULL,
            kind TEXT NOT NULL,
            delivered INTEGER NOT NULL DEFAULT 0,
            failures INTEGER NOT NULL DEFAULT 0,
            dead_lettered INTEGER NOT NULL DEFAULT 0,
            last_delivered_at REAL,
            last_error TEXT NOT NULL DEFAULT '',
            last_error_at REAL,
            PRIMARY KEY (namespace, kind)
        )
        """
    )


def _create_meta(connection: sqlite3.Connection) -> None:
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {LARAVEL_DELIVERY_META_TABLE} (
            meta_key TEXT PRIMARY KEY,
            meta_value TEXT NOT NULL DEFAULT ''
        ) WITHOUT ROWID
        """
    )


def _migrate_v1(connection: sqlite3.Connection) -> None:
    """v1 -> v2: rows gain ``namespace`` / ``item_key`` (filled by the outbox
    from each row's recorded endpoint); v1 receipts carry no server, so they
    are dropped (the diff or the kind's own policy decides again); v1 metrics
    move to the unassigned namespace ``''``."""
    if _table_exists(connection, LARAVEL_DELIVERIES_TABLE):
        columns = _columns(connection, LARAVEL_DELIVERIES_TABLE)
        if "namespace" not in columns:
            connection.execute(f"ALTER TABLE {LARAVEL_DELIVERIES_TABLE} ADD COLUMN namespace TEXT NOT NULL DEFAULT ''")
        if "item_key" not in columns:
            connection.execute(f"ALTER TABLE {LARAVEL_DELIVERIES_TABLE} ADD COLUMN item_key TEXT NOT NULL DEFAULT ''")
        connection.execute(f"DROP INDEX IF EXISTS idx_{LARAVEL_DELIVERIES_TABLE}_identity")
        connection.execute(f"DROP INDEX IF EXISTS idx_{LARAVEL_DELIVERIES_TABLE}_group")
    if _table_exists(connection, LARAVEL_DELIVERY_RECEIPTS_TABLE):
        connection.execute(f"DROP TABLE {LARAVEL_DELIVERY_RECEIPTS_TABLE}")
    if _table_exists(connection, LARAVEL_DELIVERY_METRICS_TABLE) and "namespace" not in _columns(connection, LARAVEL_DELIVERY_METRICS_TABLE):
        legacy = f"{LARAVEL_DELIVERY_METRICS_TABLE}_v1"
        connection.execute(f"ALTER TABLE {LARAVEL_DELIVERY_METRICS_TABLE} RENAME TO {legacy}")
        _create_metrics(connection)
        connection.execute(
            f"INSERT INTO {LARAVEL_DELIVERY_METRICS_TABLE} "
            "(namespace, kind, delivered, failures, dead_lettered, last_delivered_at, last_error, last_error_at) "
            "SELECT '', kind, delivered, failures, dead_lettered, last_delivered_at, last_error, last_error_at "
            f"FROM {legacy}"
        )
        connection.execute(f"DROP TABLE {legacy}")


def init_laravel_delivery_schema(connection: sqlite3.Connection) -> int:
    """Create or upgrade the schema; returns the version found before."""
    previous = int(connection.execute("PRAGMA user_version").fetchone()[0])
    if previous < LARAVEL_DELIVERY_SCHEMA_VERSION:
        _migrate_v1(connection)
    _create_deliveries(connection)
    _create_indexes(connection)
    _create_state(connection)
    _create_metrics(connection)
    _create_meta(connection)
    if previous < LARAVEL_DELIVERY_SCHEMA_VERSION:
        connection.execute(f"PRAGMA user_version={LARAVEL_DELIVERY_SCHEMA_VERSION}")
    return previous


__all__ = [
    "LARAVEL_DELIVERIES_TABLE",
    "LARAVEL_DELIVERY_META_TABLE",
    "LARAVEL_DELIVERY_METRICS_TABLE",
    "LARAVEL_DELIVERY_SCHEMA_VERSION",
    "LARAVEL_DELIVERY_STATE_TABLE",
    "init_laravel_delivery_schema",
]
