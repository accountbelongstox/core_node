# -*- coding: utf-8 -*-
"""Read-only prompt store: key-value SQLite databases of IDE/agent apps.

VS Code-family editors persist extension and workbench state in
``state.vscdb`` SQLite files whose ``ItemTable(key, value)`` rows hold JSON
documents; AI chat panels keep their conversations there. This backup source
recovers prompts from those stores when an app keeps no transcript files.

The database is opened read-only (``mode=ro`` + ``query_only``) through
``database.adapters.sqlite_readonly``; the app may hold it open meanwhile.
What to read is declared per app as a ``KvStoreLayout``: the tables with
their key filters (SQL LIKE patterns) and referenced-row key templates, and
the ``ChatLayout`` of the stored JSON conversations (``chat_conversations``).
Tables the database does not have are skipped. Records without their own time carry
the database mtime and are marked estimated.
"""

from __future__ import annotations

import json
import os
import sqlite3
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from pycore.database.adapters.sqlite_readonly import query_rows
from pycore.pyctl.agent_history.sources.formats.chat_conversations import ChatLayout, RefResolver, document_sessions
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

KV_STORE_FILE = "state.vscdb"
KV_STORE_TABLE = "ItemTable"


@dataclass(frozen=True)
class KvTable:
    """One key-value table: the rows to read (SQL LIKE key patterns) and the
    key template of rows referenced by message headers (``{conversation}``,
    ``{ref}``)."""

    name: str
    key_patterns: Tuple[str, ...]
    ref_key_template: str = ""


@dataclass(frozen=True)
class KvStoreLayout:
    tables: Tuple[KvTable, ...]
    chat: ChatLayout


class SqlitePromptStore:
    """Parses conversations out of read-only key-value SQLite stores."""

    @staticmethod
    def _query(db_path: str, sql: str, params: Tuple[Any, ...]) -> Tuple[Tuple, ...]:
        try:
            return query_rows(db_path, sql, params)
        except sqlite3.Error as exc:
            ColorPrint.yellow(f"[AgentHistory] Prompt store read failed path={db_path}: {exc}")
            return ()

    def _tables(self, db_path: str) -> set:
        rows = self._query(db_path, "SELECT name FROM sqlite_master WHERE type = 'table'", ())
        return {str(row[0]) for row in rows}

    def read_items(self, db_path: str, table: KvTable, patterns: Tuple[str, ...]) -> Dict[str, str]:
        """``key -> value`` rows of one table matching ``patterns``."""
        if not table.name.isidentifier():
            raise ValueError(f"invalid key-value table name: {table.name}")
        where = " OR ".join("key LIKE ?" for _ in patterns)
        sql = f"SELECT key, value FROM {table.name}" + (f" WHERE {where}" if where else "")
        return {
            str(key): value.decode("utf-8", "replace") if isinstance(value, bytes) else str(value)
            for key, value in self._query(db_path, sql, patterns)
        }

    def _resolver(self, db_path: str, table: KvTable) -> Optional[RefResolver]:
        """Per-conversation lazy lookup of referenced rows (one query per conversation)."""
        if not table.ref_key_template:
            return None
        loaded: Dict[str, Dict[str, Any]] = {}

        def resolve(conversation_id: str, ref: str) -> Optional[Dict[str, Any]]:
            if conversation_id not in loaded:
                prefix = table.ref_key_template.format(conversation=conversation_id, ref="")
                loaded[conversation_id] = {
                    key: doc for key, doc in (
                        (key, _decode(value)) for key, value in self.read_items(db_path, table, (prefix + "%",)).items()
                    ) if isinstance(doc, dict)
                }
            return loaded[conversation_id].get(table.ref_key_template.format(conversation=conversation_id, ref=ref))

        return resolve

    def parse(self, path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
        layout: KvStoreLayout = spec.options["layout"]
        project = os.path.basename(os.path.dirname(path))
        present = self._tables(path)
        out: List[Dict[str, Any]] = []
        for table in layout.tables:
            if table.name not in present:
                continue
            resolve = self._resolver(path, table)
            for key, value in self.read_items(path, table, table.key_patterns).items():
                document = _decode(value)
                if document is not None:
                    out.extend(document_sessions(document, layout.chat, path, user, tool, key, project, resolve))
        return out


def _decode(value: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


sqlite_prompt_store = SqlitePromptStore()


__all__ = ["KV_STORE_FILE", "KvStoreLayout", "KvTable", "SqlitePromptStore", "sqlite_prompt_store"]
