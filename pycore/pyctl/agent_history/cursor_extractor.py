# -*- coding: utf-8 -*-
"""
Cursor IDE extractor — agent-transcripts JSONL (primary) + state.vscdb (fallback).

Official Cursor agent chat transcripts live under:
  <home>/.cursor/projects/<slug>/agent-transcripts/<id>/<id>.jsonl

Each line: {"role":"user|assistant","message":{"content":[{type,text|tool_use},...]}}
"""

from __future__ import annotations

import json
import os
import re
from glob import glob
from typing import Any, Dict, List, Optional

from .base_extractor import BaseExtractor, MAX_TURNS


class CursorExtractor(BaseExtractor):
    def tool(self) -> str:
        return "cursor"

    def _cursor_roots(self, home: str) -> List[str]:
        roots = [os.path.join(home, ".cursor")]
        roaming = os.path.join(home, "AppData", "Roaming", "Cursor", "User")
        if os.path.isdir(roaming):
            roots.append(roaming)
        cfg = os.path.join(home, ".config", "Cursor", "User")
        if os.path.isdir(cfg):
            roots.append(cfg)
        return roots

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        seen: set[str] = set()

        cursor_projects = os.path.join(home, ".cursor", "projects")
        if os.path.isdir(cursor_projects):
            for pattern in (
                os.path.join(cursor_projects, "*", "agent-transcripts", "*", "*.jsonl"),
                os.path.join(cursor_projects, "*", "agent-transcripts", "*.jsonl"),
            ):
                for file in glob(pattern):
                    if file not in seen:
                        seen.add(file)
                        out.append(self.descriptor(file))

        for base in (
            os.path.join(home, "AppData", "Roaming", "Cursor", "User"),
            os.path.join(home, ".config", "Cursor", "User"),
        ):
            if not os.path.isdir(base):
                continue
            for db in glob(os.path.join(base, "workspaceStorage", "*", "state.vscdb")):
                if db in seen:
                    continue
                try:
                    if os.path.getsize(db) > 50 * 1024 * 1024:
                        continue
                except OSError:
                    continue
                seen.add(db)
                out.append(self.descriptor(db))

        return out

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        if path.endswith(".jsonl"):
            sess = self._parse_agent_transcript(path, user)
            return [sess] if sess else []
        return self._parse_vscdb(path, user)

    def _parse_agent_transcript(self, file: str, user: str) -> Optional[Dict[str, Any]]:
        entries = self.load_jsonl(file)
        if not entries:
            return None

        turns: List[Dict[str, Any]] = []
        prompts: List[Dict[str, Any]] = []
        models: Dict[str, bool] = {}
        first_ts = 0
        last_ts = 0
        try:
            mtime = int(os.stat(file).st_mtime)
        except OSError:
            mtime = 0

        project = ""
        parts = file.replace("\\", "/").split("/")
        if "projects" in parts:
            idx = parts.index("projects")
            if idx + 1 < len(parts):
                project = parts[idx + 1]

        session_id = os.path.splitext(os.path.basename(file))[0]
        if os.path.basename(os.path.dirname(file)) != "agent-transcripts":
            session_id = os.path.basename(os.path.dirname(file))

        for e in entries:
            ts = self.ts_to_epoch(e.get("timestamp")) or mtime
            if ts > 0:
                last_ts = ts
                if first_ts == 0:
                    first_ts = ts

            role = str(e.get("role") or "")
            msg = e.get("message") or {}
            model = msg.get("model")
            if isinstance(model, str) and model:
                models[model] = True

            content = msg.get("content")
            if isinstance(content, str):
                content = [{"type": "text", "text": content}]
            if not isinstance(content, list):
                continue

            for block in content:
                if not isinstance(block, dict):
                    continue
                btype = block.get("type", "")
                if btype == "text":
                    text = str(block.get("text") or "").strip()
                    if not text:
                        continue
                    text = self._strip_cursor_metadata(text)
                    if not text:
                        continue
                    if role == "user":
                        prompts.append({"ts": ts, "text": self.truncate(text)})
                        turns.append(self.turn(ts, "user", text))
                    else:
                        turns.append(self.turn(ts, "assistant", text, False, model))
                elif btype == "tool_use":
                    name = str(block.get("name") or "?")
                    inp = json.dumps(block.get("input") or {}, ensure_ascii=False)
                    turns.append(self.turn(ts, "tool_use", inp, False, model, name))
                elif btype == "tool_result":
                    text = self.stringify_content(block.get("content") or block.get("output") or "")
                    if text.strip():
                        turns.append(self.turn(ts, "tool_result", text, False, model))

            if len(turns) > MAX_TURNS:
                break

        if not turns:
            return None

        return self.session("cursor", user, session_id, {
            "project": project,
            "title": session_id,
            "firstTs": first_ts or mtime,
            "lastTs": last_ts or mtime,
            "source": file,
            "models": list(models.keys()),
            "prompts": prompts,
            "turns": turns,
        })

    @staticmethod
    def _strip_cursor_metadata(text: str) -> str:
        """Keep the user_query body; drop timestamp/XML wrappers when present."""
        m = re.search(r"<user_query>\s*(.*?)\s*</user_query>", text, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1).strip()
        text = re.sub(r"<timestamp>.*?</timestamp>\s*", "", text, flags=re.DOTALL | re.IGNORECASE)
        return text.strip()

    def _parse_vscdb(self, path: str, user: str) -> List[Dict[str, Any]]:
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
            from pycore.database.adapters.sqlite_readonly import open_readonly_db

            with open_readonly_db(db_path) as conn:
                cur = conn.execute(
                    "SELECT key, value FROM ItemTable WHERE key LIKE '%chat%' "
                    "OR key LIKE '%composer%' OR key LIKE '%aiService%' OR key LIKE '%cursor%'"
                )
                for key, value in cur.fetchall():
                    rows[str(key)] = str(value)
        except Exception:
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
