# -*- coding: utf-8 -*-
"""Cursor IDE extractor — mirrors Laravel CursorExtractor (SQLite ItemTable)."""

from __future__ import annotations

import json
import os
import sqlite3
from glob import glob
from typing import Any, Dict, List, Optional

from .base_extractor import BaseExtractor, MAX_TURNS


class CursorExtractor(BaseExtractor):
    def tool(self) -> str:
        return "cursor"

    def _cursor_user_base(self, home: str) -> str:
        """Windows: AppData/Roaming/Cursor/User; Linux/macOS: .config/Cursor/User."""
        roaming = os.path.join(home, "AppData", "Roaming", "Cursor", "User")
        if os.path.isdir(roaming):
            return roaming
        return os.path.join(home, ".config", "Cursor", "User")

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        base = self._cursor_user_base(home)
        if not os.path.isdir(base):
            return []
        out: List[Dict[str, Any]] = []
        global_db = os.path.join(base, "globalStorage", "state.vscdb")
        if os.path.isfile(global_db):
            out.append(self.descriptor(global_db))
        for db in glob(os.path.join(base, "workspaceStorage", "*", "state.vscdb")):
            out.append(self.descriptor(db))
        return out

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        rows = self._read_item_table(path)
        if not rows:
            return []
        try:
            mtime = int(os.stat(path).st_mtime)
        except OSError:
            mtime = 0

        out: List[Dict[str, Any]] = []
        for key, value in rows.items():
            try:
                decoded = json.loads(value)
            except json.JSONDecodeError:
                continue
            if not isinstance(decoded, dict):
                continue
            for idx, conv in enumerate(self._find_conversations(decoded)):
                turns = self._bubbles_to_turns(conv, mtime)
                if not turns:
                    continue
                prompts = [{"ts": t["ts"], "text": t["text"]} for t in turns if t["role"] == "user"]
                raw_id = str(conv.get("composerId") or conv.get("id") or f"{key}-{idx}")
                out.append(self.session("cursor", user, raw_id, {
                    "project": os.path.basename(os.path.dirname(path)),
                    "title": str(conv.get("name") or conv.get("title") or ""),
                    "firstTs": mtime,
                    "lastTs": mtime,
                    "source": path,
                    "prompts": prompts,
                    "turns": turns,
                }))
        return out

    def _read_item_table(self, db_path: str) -> Dict[str, str]:
        rows: Dict[str, str] = {}
        try:
            conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            conn.execute("PRAGMA query_only = 1")
            cur = conn.execute(
                "SELECT key, value FROM ItemTable WHERE key LIKE '%chat%' "
                "OR key LIKE '%composer%' OR key LIKE '%aiService%'"
            )
            for key, value in cur.fetchall():
                rows[str(key)] = str(value)
            conn.close()
        except sqlite3.Error:
            return {}
        return rows

    def _find_conversations(self, blob: Dict[str, Any]) -> List[Dict[str, Any]]:
        for field in ("tabs", "conversations", "allComposers", "composers"):
            val = blob.get(field)
            if isinstance(val, list):
                return [x for x in val if isinstance(x, dict)]
        if any(k in blob for k in ("bubbles", "messages", "conversation")):
            return [blob]
        return []

    def _bubbles_to_turns(self, conv: Dict[str, Any], ts: int) -> List[Dict[str, Any]]:
        lst = None
        for field in ("bubbles", "messages", "conversation"):
            val = conv.get(field)
            if isinstance(val, list):
                lst = val
                break
        if lst is None:
            return []
        turns: List[Dict[str, Any]] = []
        for b in lst:
            if not isinstance(b, dict):
                continue
            text = str(b.get("text") or b.get("content") or "").strip()
            if not text:
                continue
            btype = b.get("type") or b.get("role") or ""
            is_user = btype in (1, "1", "user")
            turns.append(self.turn(ts, "user" if is_user else "assistant", text))
            if len(turns) > MAX_TURNS:
                break
        return turns
