# -*- coding: utf-8 -*-
"""SQLite repository of the agent-history extract store.

Sessions (summary JSON keyed by session id), the flat prompt list (indexed
by ts, tool and session), the per-source extract state and the store meta
(signature, schema revision, counts, generated_at). One extract pass is one
transaction that only touches the sessions and sources it changed; every
commit bumps the ``revision`` meta counter.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from pycore.database.adapters.sqlite_local import open_wal_connection
from pycore.database.schema.agent_history_store_schema import (
    AGENT_HISTORY_PROMPT_TABLE,
    AGENT_HISTORY_SESSION_TABLE,
    AGENT_HISTORY_SOURCE_TABLE,
    AGENT_HISTORY_STORE_META_TABLE,
    init_agent_history_store_schema,
)

META_REVISION = "revision"
PROMPT_FIELDS = ("id", "tool", "os_user", "project", "session_id", "ts", "time", "lang", "edited", "text")
_PROMPT_ORDER = "ORDER BY ts DESC, rowid ASC"
_SESSION_ORDER = "ORDER BY started_ts DESC, rowid ASC"
_SQLITE_VARIABLE_CHUNK = 500
_CONTAINS_FUNCTION = "agent_history_contains"


def _contains(haystack: Any, needle: Any) -> int:
    return int(str(needle or "") in str(haystack or "").lower())


def _chunks(values: Sequence[str]) -> Iterable[Sequence[str]]:
    for start in range(0, len(values), _SQLITE_VARIABLE_CHUNK):
        yield values[start:start + _SQLITE_VARIABLE_CHUNK]


def _placeholders(values: Sequence[Any]) -> str:
    return ", ".join("?" for _ in values)


class AgentHistoryStoreRepository:
    def __init__(self, database_path: Path) -> None:
        self.path = Path(database_path)
        self._connection = open_wal_connection(database_path, synchronous="NORMAL")
        self._connection.create_function(_CONTAINS_FUNCTION, 2, _contains, deterministic=True)
        init_agent_history_store_schema(self._connection)
        self._connection.commit()

    # ------------------------------------------------------------------ #
    # meta                                                                #
    # ------------------------------------------------------------------ #
    def meta(self, key: str) -> str:
        values = self._connection.execute(
            f"SELECT meta_value FROM {AGENT_HISTORY_STORE_META_TABLE} WHERE meta_key = ?", (key,),
        ).fetchone()
        return str(values[0]) if values is not None else ""

    def meta_all(self) -> Dict[str, str]:
        rows = self._connection.execute(
            f"SELECT meta_key, meta_value FROM {AGENT_HISTORY_STORE_META_TABLE}"
        ).fetchall()
        return {str(key): str(value) for key, value in rows}

    def set_meta(self, key: str, value: str) -> None:
        with self._connection:
            self._set_meta(key, value)

    def _set_meta(self, key: str, value: str) -> None:
        self._connection.execute(
            f"INSERT OR REPLACE INTO {AGENT_HISTORY_STORE_META_TABLE} (meta_key, meta_value) VALUES (?, ?)",
            (key, str(value)),
        )

    def revision(self) -> int:
        return int(self.meta(META_REVISION) or 0)

    # ------------------------------------------------------------------ #
    # extract pass                                                        #
    # ------------------------------------------------------------------ #
    def sources(self) -> Dict[str, Dict[str, Any]]:
        rows = self._connection.execute(f"SELECT path, info FROM {AGENT_HISTORY_SOURCE_TABLE}").fetchall()
        return {str(path): json.loads(info) for path, info in rows}

    def existing_prompt_ids(self, prompt_ids: Sequence[str]) -> set:
        found: set = set()
        for chunk in _chunks(list(prompt_ids)):
            rows = self._connection.execute(
                f"SELECT id FROM {AGENT_HISTORY_PROMPT_TABLE} WHERE id IN ({_placeholders(chunk)})", tuple(chunk),
            ).fetchall()
            found.update(str(row[0]) for row in rows)
        return found

    def commit_pass(
        self,
        replaced_session_ids: Sequence[str],
        sessions: Sequence[Dict[str, Any]],
        prompts: Sequence[Dict[str, Any]],
        removed_source_paths: Sequence[str],
        sources: Dict[str, Dict[str, Any]],
        meta: Dict[str, str],
    ) -> Tuple[int, Dict[str, int]]:
        """Replace the given sessions (rows and prompts) and sources in one
        transaction; returns ``(revision, counts)``."""
        revision = self.revision() + 1
        replaced = list(dict.fromkeys(str(sid) for sid in replaced_session_ids))
        with self._connection:
            for chunk in _chunks(replaced):
                self._connection.execute(
                    f"DELETE FROM {AGENT_HISTORY_PROMPT_TABLE} WHERE session_id IN ({_placeholders(chunk)})", tuple(chunk),
                )
                self._connection.execute(
                    f"DELETE FROM {AGENT_HISTORY_SESSION_TABLE} WHERE id IN ({_placeholders(chunk)})", tuple(chunk),
                )
            self._connection.executemany(
                f"INSERT OR REPLACE INTO {AGENT_HISTORY_SESSION_TABLE} (id, tool, os_user, started_ts, summary) "
                f"VALUES (?, ?, ?, ?, ?)",
                [
                    (
                        str(session["id"]),
                        str(session.get("tool") or ""),
                        str(session.get("os_user") or ""),
                        int(session.get("started_ts") or 0),
                        json.dumps(session, ensure_ascii=False),
                    )
                    for session in sessions
                ],
            )
            self._connection.executemany(
                f"INSERT OR REPLACE INTO {AGENT_HISTORY_PROMPT_TABLE} ({', '.join(PROMPT_FIELDS)}) "
                f"VALUES ({_placeholders(PROMPT_FIELDS)})",
                [
                    (
                        str(prompt.get("id") or ""),
                        str(prompt.get("tool") or ""),
                        str(prompt.get("os_user") or ""),
                        str(prompt.get("project") or ""),
                        str(prompt.get("session_id") or ""),
                        int(prompt.get("ts") or 0),
                        str(prompt.get("time") or ""),
                        str(prompt.get("lang") or ""),
                        int(bool(prompt.get("edited"))),
                        str(prompt.get("text") or ""),
                    )
                    for prompt in prompts
                    if prompt.get("id") and str(prompt.get("text") or "").strip()
                ],
            )
            removed = list(removed_source_paths)
            for chunk in _chunks(removed):
                self._connection.execute(
                    f"DELETE FROM {AGENT_HISTORY_SOURCE_TABLE} WHERE path IN ({_placeholders(chunk)})", tuple(chunk),
                )
            self._connection.executemany(
                f"INSERT OR REPLACE INTO {AGENT_HISTORY_SOURCE_TABLE} (path, tool, info) VALUES (?, ?, ?)",
                [
                    (str(path), str(info.get("tool") or ""), json.dumps(info, ensure_ascii=False))
                    for path, info in sources.items()
                ],
            )
            counts = self._counts()
            for key, value in meta.items():
                self._set_meta(key, value)
            self._set_meta("counts", json.dumps(counts))
            self._set_meta(META_REVISION, str(revision))
        return revision, counts

    def _counts(self) -> Dict[str, int]:
        sessions, tools, users = self._connection.execute(
            f"SELECT COUNT(*), COUNT(DISTINCT NULLIF(tool, '')), COUNT(DISTINCT NULLIF(os_user, '')) "
            f"FROM {AGENT_HISTORY_SESSION_TABLE}"
        ).fetchone()
        prompts = self._connection.execute(f"SELECT COUNT(*) FROM {AGENT_HISTORY_PROMPT_TABLE}").fetchone()[0]
        return {"sessions": int(sessions), "prompts": int(prompts), "tools": int(tools), "users": int(users)}

    # ------------------------------------------------------------------ #
    # reads                                                               #
    # ------------------------------------------------------------------ #
    def sessions(self) -> List[Dict[str, Any]]:
        rows = self._connection.execute(
            f"SELECT summary FROM {AGENT_HISTORY_SESSION_TABLE} {_SESSION_ORDER}"
        ).fetchall()
        return [json.loads(row[0]) for row in rows]

    def distinct_values(self) -> Dict[str, List[str]]:
        def distinct(table: str, column: str) -> List[str]:
            rows = self._connection.execute(
                f"SELECT DISTINCT {column} FROM {table} WHERE {column} != '' ORDER BY {column}"
            ).fetchall()
            return [str(row[0]) for row in rows]

        return {
            "tools": distinct(AGENT_HISTORY_SESSION_TABLE, "tool"),
            "users": distinct(AGENT_HISTORY_SESSION_TABLE, "os_user"),
            "langs": distinct(AGENT_HISTORY_PROMPT_TABLE, "lang"),
        }

    def prompt_query(
        self,
        tool: Optional[str],
        user: Optional[str],
        lang: Optional[str],
        needle: str,
        tools: Sequence[str],
        offset: int,
        limit: Optional[int],
        with_text: bool,
    ) -> Tuple[int, List[Dict[str, Any]]]:
        """Filtered prompts newest first: ``(total, page rows)``; ``limit``
        None returns every match."""
        clauses: List[str] = []
        params: List[Any] = []
        if tool:
            clauses.append("tool = ?")
            params.append(tool)
        elif tools:
            clauses.append(f"lower(tool) IN ({_placeholders(tools)})")
            params.extend(tools)
        if user:
            clauses.append("os_user = ?")
            params.append(user)
        if lang:
            clauses.append("lang = ?")
            params.append(lang)
        if needle:
            clauses.append("instr(lower(text), ?) > 0" if needle.isascii() else f"{_CONTAINS_FUNCTION}(text, ?)")
            params.append(needle)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        ordered = [
            int(row[0])
            for row in self._connection.execute(
                f"SELECT rowid FROM {AGENT_HISTORY_PROMPT_TABLE} {where} {_PROMPT_ORDER}", tuple(params),
            ).fetchall()
        ]
        wanted = ordered if limit is None else ordered[int(offset):int(offset) + int(limit)]
        fields = PROMPT_FIELDS if with_text else tuple(field for field in PROMPT_FIELDS if field != "text")
        by_rowid: Dict[int, Dict[str, Any]] = {}
        for chunk in _chunks(wanted):
            for row in self._connection.execute(
                f"SELECT rowid, {', '.join(fields)} FROM {AGENT_HISTORY_PROMPT_TABLE} "
                f"WHERE rowid IN ({_placeholders(chunk)})",
                tuple(chunk),
            ).fetchall():
                item = dict(zip(fields, row[1:]))
                item["edited"] = bool(item["edited"])
                by_rowid[int(row[0])] = item
        return len(ordered), [by_rowid[rowid] for rowid in wanted if rowid in by_rowid]

    def set_prompt_text(self, prompt_id: str, text: str) -> int:
        """Overlay one user edit; returns the new revision (unchanged when no row matched)."""
        with self._connection:
            cursor = self._connection.execute(
                f"UPDATE {AGENT_HISTORY_PROMPT_TABLE} SET text = ?, edited = 1 WHERE id = ?", (text, prompt_id),
            )
            if cursor.rowcount <= 0:
                return self.revision()
            revision = self.revision() + 1
            self._set_meta(META_REVISION, str(revision))
        return revision


__all__ = ["AgentHistoryStoreRepository", "META_REVISION", "PROMPT_FIELDS"]
