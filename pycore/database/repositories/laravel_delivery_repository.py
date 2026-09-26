# -*- coding: utf-8 -*-
"""Indexed SQLite repository of the shared Laravel delivery outbox.

Every row, delivered-state entry and metric belongs to one Laravel server
``namespace``. Every query is keyed or indexed (kind/state/next_attempt_at,
kind/namespace/identity, kind/namespace/group_key, namespace/kind/item_key,
state primary key) and bounded; no query loads a whole table. Row
dictionaries carry the indexed columns plus the free-form ``body`` fields.
"""
from __future__ import annotations

import json
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional

from pycore.database.adapters.sqlite_local import connect_writable
from pycore.database.schema.laravel_delivery_schema import (
    LARAVEL_DELIVERIES_TABLE,
    LARAVEL_DELIVERY_META_TABLE,
    LARAVEL_DELIVERY_METRICS_TABLE,
    LARAVEL_DELIVERY_STATE_TABLE,
    init_laravel_delivery_schema,
)


SQLITE_BUSY_TIMEOUT_MS = 30000
SQLITE_IN_LIMIT = 500
STATE_PENDING = "pending"
STATE_DEAD_LETTER = "dead_letter"
# ``delivery_id`` = ``<namespace>|<logical id>``: the namespace prefix keeps
# one logical delivery unique per Laravel server.
NAMESPACE_SEPARATOR = "|"
# Row key -> column. ``delivery_attempts`` / ``state`` are the dictionary
# names used by the outbox and its handlers.
_COLUMNS = {
    "delivery_id": "delivery_id",
    "kind": "kind",
    "namespace": "namespace",
    "item_key": "item_key",
    "identity": "identity",
    "group_key": "group_key",
    "state": "state",
    "stage": "stage",
    "next_attempt_at": "next_attempt_at",
    "lease_owner": "lease_owner",
    "lease_process": "lease_process",
    "lease_until": "lease_until",
    "identity_delivered": "identity_delivered",
    "payload_sha256": "payload_sha256",
    "delivery_attempts": "attempts",
    "last_error": "last_error",
    "created_at": "created_at",
    "updated_at": "updated_at",
}
_SELECT = ", ".join([*_COLUMNS.values(), "body"])
_COLUMN_DEFAULTS = {
    "namespace": "",
    "item_key": "",
    "identity": "",
    "group_key": "",
    "state": STATE_PENDING,
    "stage": "",
    "next_attempt_at": 0.0,
    "lease_owner": "",
    "lease_process": "",
    "lease_until": 0.0,
    "payload_sha256": "",
    "delivery_attempts": 0,
    "last_error": "",
}


def _chunks(values: List[str]) -> Iterator[List[str]]:
    for start in range(0, len(values), SQLITE_IN_LIMIT):
        yield values[start:start + SQLITE_IN_LIMIT]


class LaravelDeliveryRepository:
    def __init__(self, database_path: Path) -> None:
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = connect_writable(
            database_path.resolve(),
            timeout=SQLITE_BUSY_TIMEOUT_MS / 1000,
            check_same_thread=False,
        )
        self._connection.execute(f"PRAGMA busy_timeout={SQLITE_BUSY_TIMEOUT_MS}")
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA synchronous=FULL")
        self.previous_schema_version = init_laravel_delivery_schema(self._connection)
        self._connection.commit()

    @contextmanager
    def transaction(self) -> Iterator[None]:
        if self._connection.in_transaction:
            yield
            return
        with self._connection:
            self._connection.execute("BEGIN IMMEDIATE")
            yield

    # ------------------------------------------------------------------ #
    # meta                                                                #
    # ------------------------------------------------------------------ #
    def meta(self, key: str) -> str:
        values = self._connection.execute(
            f"SELECT meta_value FROM {LARAVEL_DELIVERY_META_TABLE} WHERE meta_key = ?", (key,),
        ).fetchone()
        return str(values[0]) if values is not None else ""

    def set_meta(self, key: str, value: str) -> None:
        with self.transaction():
            self._connection.execute(
                f"INSERT OR REPLACE INTO {LARAVEL_DELIVERY_META_TABLE} (meta_key, meta_value) VALUES (?, ?)",
                (key, str(value)),
            )

    # ------------------------------------------------------------------ #
    # deliveries                                                          #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _row(values: Any) -> Dict[str, Any]:
        row = json.loads(values[-1])
        for (key, _column), value in zip(_COLUMNS.items(), values[:-1]):
            row[key] = value
        row["identity_delivered"] = bool(row["identity_delivered"])
        return row

    def _write(self, row: Dict[str, Any], verb: str = "INSERT OR REPLACE") -> None:
        body = {key: value for key, value in row.items() if key not in _COLUMNS}
        values = [
            _COLUMN_DEFAULTS.get(key) if row.get(key) is None else row.get(key)
            for key in _COLUMNS
        ]
        values[list(_COLUMNS).index("identity_delivered")] = 1 if row.get("identity_delivered") else 0
        placeholders = ", ".join("?" for _ in range(len(_COLUMNS) + 1))
        self._connection.execute(
            f"{verb} INTO {LARAVEL_DELIVERIES_TABLE} ({_SELECT}) VALUES ({placeholders})",
            (*values, json.dumps(body, ensure_ascii=True, separators=(",", ":"), default=str)),
        )

    def put(self, row: Dict[str, Any]) -> None:
        with self.transaction():
            self._write(row)

    def get(self, delivery_id: str) -> Optional[Dict[str, Any]]:
        values = self._connection.execute(
            f"SELECT {_SELECT} FROM {LARAVEL_DELIVERIES_TABLE} WHERE delivery_id = ?", (delivery_id,),
        ).fetchone()
        return self._row(values) if values is not None else None

    def delete(self, delivery_id: str) -> None:
        with self.transaction():
            self._connection.execute(f"DELETE FROM {LARAVEL_DELIVERIES_TABLE} WHERE delivery_id = ?", (delivery_id,))

    def ready(self, kind: str, now: float, process_id: str, limit: int) -> List[Dict[str, Any]]:
        """Pending, due rows whose lease expired or belongs to another
        (previous) process, oldest first."""
        rows = self._connection.execute(
            f"SELECT {_SELECT} FROM {LARAVEL_DELIVERIES_TABLE} "
            "WHERE kind = ? AND state = ? AND next_attempt_at <= ? "
            "AND (lease_until <= ? OR lease_process <> ?) "
            "ORDER BY created_at LIMIT ?",
            (kind, STATE_PENDING, now, now, process_id, max(1, int(limit))),
        ).fetchall()
        return [self._row(values) for values in rows]

    def identity_rows(
        self, kind: str, namespace: str, identity: str, exclude_id: str, payload_sha256: str, limit: int,
    ) -> List[Dict[str, Any]]:
        rows = self._connection.execute(
            f"SELECT {_SELECT} FROM {LARAVEL_DELIVERIES_TABLE} "
            "WHERE kind = ? AND namespace = ? AND identity = ? AND delivery_id <> ? AND state <> ? "
            "AND (? = '' OR payload_sha256 = ?) LIMIT ?",
            (kind, namespace, identity, exclude_id, STATE_DEAD_LETTER, payload_sha256, payload_sha256, max(1, int(limit))),
        ).fetchall()
        return [self._row(values) for values in rows]

    def unassigned(self, limit: int) -> List[Dict[str, Any]]:
        rows = self._connection.execute(
            f"SELECT {_SELECT} FROM {LARAVEL_DELIVERIES_TABLE} WHERE namespace = '' LIMIT ?",
            (max(1, int(limit)),),
        ).fetchall()
        return [self._row(values) for values in rows]

    def pending_item_keys(self, namespace: str, kind: str, keys: List[str]) -> Dict[str, str]:
        """item_key -> state of existing rows among ``keys`` (indexed IN)."""
        found: Dict[str, str] = {}
        for chunk in _chunks([key for key in keys if key]):
            placeholders = ", ".join("?" for _ in chunk)
            for item_key, state in self._connection.execute(
                f"SELECT item_key, state FROM {LARAVEL_DELIVERIES_TABLE} "
                f"WHERE namespace = ? AND kind = ? AND item_key IN ({placeholders})",
                (namespace, kind, *chunk),
            ).fetchall():
                if found.get(str(item_key)) != STATE_PENDING:
                    found[str(item_key)] = str(state)
        return found

    def has_pending(self, kind: str) -> bool:
        return self._connection.execute(
            f"SELECT 1 FROM {LARAVEL_DELIVERIES_TABLE} WHERE kind = ? AND state = ? LIMIT 1",
            (kind, STATE_PENDING),
        ).fetchone() is not None

    def next_attempt_at(self, kind: str) -> Optional[float]:
        value = self._connection.execute(
            f"SELECT MIN(next_attempt_at) FROM {LARAVEL_DELIVERIES_TABLE} WHERE kind = ? AND state = ?",
            (kind, STATE_PENDING),
        ).fetchone()[0]
        return float(value) if value is not None else None

    def stage_counts(self, kind: str, now: float) -> List[Dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT namespace, state, stage, COUNT(*), MIN(created_at), MIN(next_attempt_at), "
            "SUM(CASE WHEN lease_until > ? THEN 1 ELSE 0 END) "
            f"FROM {LARAVEL_DELIVERIES_TABLE} WHERE kind = ? GROUP BY namespace, state, stage",
            (now, kind),
        ).fetchall()
        return [
            {
                "namespace": namespace, "state": state, "stage": stage, "count": int(count),
                "oldest": oldest, "next_attempt_at": due, "leased": int(leased or 0),
            }
            for namespace, state, stage, count, oldest, due, leased in rows
        ]

    def last_error(self, kind: str, namespace: str) -> str:
        values = self._connection.execute(
            f"SELECT last_error FROM {LARAVEL_DELIVERIES_TABLE} "
            "WHERE kind = ? AND namespace = ? AND state = ? AND last_error <> '' ORDER BY updated_at DESC LIMIT 1",
            (kind, namespace, STATE_PENDING),
        ).fetchone()
        return str(values[0]) if values is not None else ""

    def group_counts(self, kind: str, namespace: str) -> Dict[str, Dict[str, int]]:
        counts: Dict[str, Dict[str, int]] = {}
        for group_key, state, count in self._connection.execute(
            f"SELECT group_key, state, COUNT(*) FROM {LARAVEL_DELIVERIES_TABLE} "
            "WHERE kind = ? AND namespace = ? AND group_key <> '' GROUP BY group_key, state",
            (kind, namespace),
        ).fetchall():
            counts.setdefault(str(group_key), {STATE_PENDING: 0, STATE_DEAD_LETTER: 0})[str(state)] = int(count)
        return counts

    def retry_dead_letters(self, kind: str, now: float) -> int:
        with self.transaction():
            return self._connection.execute(
                f"UPDATE {LARAVEL_DELIVERIES_TABLE} SET state = ?, next_attempt_at = 0, last_error = '', updated_at = ? "
                "WHERE kind = ? AND state = ?",
                (STATE_PENDING, now, kind, STATE_DEAD_LETTER),
            ).rowcount

    def hurry(self, kind: str, now: float, namespace: Optional[str] = None) -> int:
        with self.transaction():
            return self._connection.execute(
                f"UPDATE {LARAVEL_DELIVERIES_TABLE} SET next_attempt_at = 0, updated_at = ? "
                "WHERE kind = ? AND state = ? AND next_attempt_at > ? AND (? IS NULL OR namespace = ?)",
                (now, kind, STATE_PENDING, now, namespace, namespace),
            ).rowcount

    def adopt_namespace(self, source: str, target: str) -> int:
        """Move every row / state entry / metric of ``source`` (an endpoint
        URL namespace) into ``target`` (its server namespace). Collisions
        keep the target's entry."""
        moved = 0
        with self.transaction():
            prefix = f"{source}{NAMESPACE_SEPARATOR}"
            moved += self._connection.execute(
                f"UPDATE OR IGNORE {LARAVEL_DELIVERIES_TABLE} SET namespace = ?, "
                "delivery_id = ? || substr(delivery_id, ?) WHERE namespace = ? AND substr(delivery_id, 1, ?) = ?",
                (target, f"{target}{NAMESPACE_SEPARATOR}", len(prefix) + 1, source, len(prefix), prefix),
            ).rowcount
            self._connection.execute(f"DELETE FROM {LARAVEL_DELIVERIES_TABLE} WHERE namespace = ?", (source,))
            moved += self._connection.execute(
                f"UPDATE OR IGNORE {LARAVEL_DELIVERY_STATE_TABLE} SET namespace = ? WHERE namespace = ?",
                (target, source),
            ).rowcount
            self._connection.execute(f"DELETE FROM {LARAVEL_DELIVERY_STATE_TABLE} WHERE namespace = ?", (source,))
            self._connection.execute(
                f"UPDATE OR IGNORE {LARAVEL_DELIVERY_METRICS_TABLE} SET namespace = ? WHERE namespace = ?",
                (target, source),
            )
            self._connection.execute(f"DELETE FROM {LARAVEL_DELIVERY_METRICS_TABLE} WHERE namespace = ?", (source,))
        return moved

    def namespaces(self) -> List[str]:
        names = set()
        for table in (LARAVEL_DELIVERIES_TABLE, LARAVEL_DELIVERY_METRICS_TABLE):
            names.update(
                str(value[0]) for value in self._connection.execute(f"SELECT DISTINCT namespace FROM {table}").fetchall()
            )
        return sorted(names)

    # ------------------------------------------------------------------ #
    # delivered state (per server; an optimization, never the authority)  #
    # ------------------------------------------------------------------ #
    def get_state(self, namespace: str, kind: str, item_key: str) -> Optional[Dict[str, Any]]:
        values = self._connection.execute(
            f"SELECT content_hash, receipt, delivered_at FROM {LARAVEL_DELIVERY_STATE_TABLE} "
            "WHERE namespace = ? AND kind = ? AND item_key = ?",
            (namespace, kind, item_key),
        ).fetchone()
        if values is None:
            return None
        return {"content_hash": values[0], "receipt": json.loads(values[1]), "delivered_at": values[2]}

    def state_hashes(self, namespace: str, kind: str, keys: List[str]) -> Dict[str, str]:
        found: Dict[str, str] = {}
        for chunk in _chunks([key for key in keys if key]):
            placeholders = ", ".join("?" for _ in chunk)
            for item_key, content_hash in self._connection.execute(
                f"SELECT item_key, content_hash FROM {LARAVEL_DELIVERY_STATE_TABLE} "
                f"WHERE namespace = ? AND kind = ? AND item_key IN ({placeholders})",
                (namespace, kind, *chunk),
            ).fetchall():
                found[str(item_key)] = str(content_hash)
        return found

    def put_state(
        self, namespace: str, kind: str, item_key: str, content_hash: str,
        receipt: Dict[str, Any], delivered_at: float,
    ) -> None:
        self._connection.execute(
            f"INSERT OR REPLACE INTO {LARAVEL_DELIVERY_STATE_TABLE} "
            "(namespace, kind, item_key, content_hash, receipt, delivered_at) VALUES (?, ?, ?, ?, ?, ?)",
            (namespace, kind, item_key, content_hash, json.dumps(receipt or {}, ensure_ascii=True), delivered_at),
        )

    def seed_state(self, namespace: str, kind: str, entries: Iterable[Dict[str, str]], delivered_at: float) -> int:
        seeded = 0
        with self.transaction():
            for entry in entries:
                seeded += self._connection.execute(
                    f"INSERT OR IGNORE INTO {LARAVEL_DELIVERY_STATE_TABLE} "
                    "(namespace, kind, item_key, content_hash, receipt, delivered_at) VALUES (?, ?, ?, ?, '{}', ?)",
                    (namespace, kind, str(entry["key"]), str(entry.get("hash") or ""), delivered_at),
                ).rowcount
        return seeded

    def forget_state(self, namespace: str, kind: str, keys: List[str]) -> int:
        removed = 0
        with self.transaction():
            for chunk in _chunks([key for key in keys if key]):
                placeholders = ", ".join("?" for _ in chunk)
                removed += self._connection.execute(
                    f"DELETE FROM {LARAVEL_DELIVERY_STATE_TABLE} "
                    f"WHERE namespace = ? AND kind = ? AND item_key IN ({placeholders})",
                    (namespace, kind, *chunk),
                ).rowcount
        return removed

    def state_count(self, namespace: str, kind: str) -> int:
        return int(self._connection.execute(
            f"SELECT COUNT(*) FROM {LARAVEL_DELIVERY_STATE_TABLE} WHERE namespace = ? AND kind = ?",
            (namespace, kind),
        ).fetchone()[0])

    def prune_state(self, kinds: List[str], delivered_before: float) -> int:
        removed = 0
        with self.transaction():
            for kind in kinds:
                removed += self._connection.execute(
                    f"DELETE FROM {LARAVEL_DELIVERY_STATE_TABLE} WHERE kind = ? AND delivered_at < ?",
                    (kind, delivered_before),
                ).rowcount
        return removed

    # ------------------------------------------------------------------ #
    # metrics                                                             #
    # ------------------------------------------------------------------ #
    def note_metrics(self, namespace: str, kind: str, now: float, delivered: bool, error: str, dead_letter: bool) -> None:
        self._connection.execute(
            f"INSERT INTO {LARAVEL_DELIVERY_METRICS_TABLE} (namespace, kind) VALUES (?, ?) "
            "ON CONFLICT(namespace, kind) DO NOTHING",
            (namespace, kind),
        )
        self._connection.execute(
            f"UPDATE {LARAVEL_DELIVERY_METRICS_TABLE} SET "
            "delivered = delivered + ?, "
            "last_delivered_at = CASE WHEN ? THEN ? ELSE last_delivered_at END, "
            "failures = failures + ?, "
            "last_error = CASE WHEN ? <> '' THEN ? ELSE last_error END, "
            "last_error_at = CASE WHEN ? <> '' THEN ? ELSE last_error_at END, "
            "dead_lettered = dead_lettered + ? "
            "WHERE namespace = ? AND kind = ?",
            (
                1 if delivered else 0, 1 if delivered else 0, now,
                1 if error else 0,
                error, error[:300],
                error, now,
                1 if dead_letter else 0,
                namespace, kind,
            ),
        )

    def metrics(self, namespace: str, kind: str) -> Dict[str, Any]:
        values = self._connection.execute(
            f"SELECT delivered, failures, dead_lettered, last_delivered_at, last_error, last_error_at "
            f"FROM {LARAVEL_DELIVERY_METRICS_TABLE} WHERE namespace = ? AND kind = ?",
            (namespace, kind),
        ).fetchone()
        if values is None:
            return {}
        keys = ("delivered", "failures", "dead_lettered", "last_delivered_at", "last_error", "last_error_at")
        return dict(zip(keys, values))


__all__ = ["LaravelDeliveryRepository", "NAMESPACE_SEPARATOR", "STATE_DEAD_LETTER", "STATE_PENDING"]
