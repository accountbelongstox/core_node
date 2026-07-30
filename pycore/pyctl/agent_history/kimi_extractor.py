# -*- coding: utf-8 -*-
"""
Kimi CLI / Kimi Code extractor — wire.jsonl sessions + raw user history.

Layout per user home (check both ``~/.kimi-code`` and legacy ``~/.kimi``,
deduped by realpath; ``.kimi-code.migrate_pending_*`` dirs are ignored):
  session_index.jsonl                     {"sessionId","sessionDir","workDir"}
  sessions/<workdir-dir>/<session-id>/wire.jsonl
  sessions/<workdir-dir>/<session-id>/agents/main|agent-*/wire.jsonl
  sessions/<workdir-dir>/<session-id>/state.json   {"title","workDir","lastPrompt","createdAt"}
  user-history/<md5>.jsonl                {"content":"..."} (prompt-only)

wire.jsonl: first line is {"type":"metadata"}; conversation events are
{"type":"context.append_message","message":{"role","content":[{type,text}]}}.
"""

from __future__ import annotations

import os
from glob import glob
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.base_extractor import BaseExtractor, MAX_TURNS


class KimiExtractor(BaseExtractor):
    def tool(self) -> str:
        return "kimi"

    def _roots(self, home: str) -> List[str]:
        roots: List[str] = []
        seen: set[str] = set()
        for name in (".kimi-code", ".kimi"):
            root = os.path.join(home, name)
            if not os.path.isdir(root):
                continue
            real = os.path.realpath(root)
            if real in seen:
                continue
            seen.add(real)
            roots.append(root)
        return roots

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for root in self._roots(home):
            sessions_root = os.path.join(root, "sessions")
            if os.path.isdir(sessions_root):
                for pattern in (
                    os.path.join(sessions_root, "*", "*", "wire.jsonl"),
                    os.path.join(sessions_root, "*", "*", "agents", "*", "wire.jsonl"),
                ):
                    for file in glob(pattern):
                        real = os.path.realpath(file)
                        if real in seen:
                            continue
                        seen.add(real)
                        out.append(self.descriptor(file))
            history = os.path.join(root, "user-history")
            if os.path.isdir(history):
                for file in glob(os.path.join(history, "*.jsonl")):
                    real = os.path.realpath(file)
                    if real in seen:
                        continue
                    seen.add(real)
                    out.append(self.descriptor(file))
        return out

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        if os.path.basename(path) == "wire.jsonl":
            sess = self._parse_wire(path, user)
            return [sess] if sess else []
        sess = self._parse_user_history(path, user)
        return [sess] if sess else []

    @staticmethod
    def _session_dir(file: str) -> str:
        d = os.path.dirname(file)
        if os.path.basename(os.path.dirname(d)) == "agents":
            return os.path.dirname(os.path.dirname(d))
        return d

    @staticmethod
    def _is_subagent_wire(file: str) -> bool:
        parts = file.replace("\\", "/").split("/")
        return "agents" in parts and "main" not in parts

    def _parse_wire(self, file: str, user: str) -> Optional[Dict[str, Any]]:
        entries = self.load_jsonl(file)
        if not entries:
            return None
        try:
            mtime = int(os.stat(file).st_mtime)
        except OSError:
            mtime = 0

        session_dir = self._session_dir(file)
        state = self.load_json(os.path.join(session_dir, "state.json"))
        state = state if isinstance(state, dict) else {}
        session_id = os.path.basename(session_dir)
        project = str(state.get("workDir") or "")
        title = str(state.get("title") or "")
        created = self.ts_to_epoch(state.get("createdAt"))
        if not project:
            parts = file.replace("\\", "/").split("/")
            if "sessions" in parts:
                idx = parts.index("sessions")
                if idx + 1 < len(parts):
                    project = parts[idx + 1]
        is_sub = self._is_subagent_wire(file)

        turns: List[Dict[str, Any]] = []
        prompts: List[Dict[str, Any]] = []
        first_ts = 0
        last_ts = 0
        for e in entries:
            if e.get("type") != "context.append_message":
                continue
            msg = e.get("message") or {}
            role = str(msg.get("role") or "")
            if role not in ("user", "assistant"):
                continue
            text = self.stringify_content(msg.get("content")).strip()
            if not text:
                continue
            ts = self.ts_to_epoch(e.get("timestamp") or e.get("ts") or msg.get("timestamp")) or mtime
            if ts > 0:
                last_ts = ts
                if first_ts == 0:
                    first_ts = ts
            if role == "user":
                prompts.append({"ts": ts, "text": self.truncate(text)})
            turns.append(self.turn(ts, role, text, is_sub))
            if len(turns) > MAX_TURNS:
                break

        if not turns:
            return None
        return self.session("kimi", user, session_id, {
            "project": project,
            "title": title or session_id,
            "firstTs": first_ts or created or mtime,
            "lastTs": last_ts or created or mtime,
            "hasSubagent": is_sub,
            "source": file,
            "prompts": prompts,
            "turns": turns,
        })

    def _parse_user_history(self, src: str, user: str) -> Optional[Dict[str, Any]]:
        rows = self.load_jsonl(src)
        if not rows:
            return None
        try:
            mtime = int(os.stat(src).st_mtime)
        except OSError:
            mtime = 0
        prompts: List[Dict[str, Any]] = []
        turns: List[Dict[str, Any]] = []
        for d in rows:
            text = str(d.get("content") or "").strip()
            if not text or text.startswith("/"):
                continue
            ts = self.ts_to_epoch(d.get("timestamp")) or mtime
            prompts.append({"ts": ts, "text": self.truncate(text)})
            turns.append(self.turn(ts, "user", text))
            if len(turns) > MAX_TURNS:
                break
        if not prompts:
            return None
        name = os.path.splitext(os.path.basename(src))[0]
        return self.session("kimi", user, f"user-history-{name}", {
            "project": "(all projects)",
            "title": "Typed prompts (kimi user-history)",
            "firstTs": mtime,
            "lastTs": mtime,
            "source": src,
            "prompts": prompts,
            "turns": turns,
        })
