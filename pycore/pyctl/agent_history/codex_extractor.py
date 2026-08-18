# -*- coding: utf-8 -*-
"""OpenAI Codex CLI extractor — mirrors Laravel CodexExtractor."""

from __future__ import annotations

import json
import os
from glob import glob
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.base_extractor import BaseExtractor, MAX_TURNS


class CodexExtractor(BaseExtractor):
    def tool(self) -> str:
        return "codex"

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        root = os.path.join(home, ".codex")
        if not os.path.isdir(root):
            return []
        out: List[Dict[str, Any]] = []
        sessions_dir = os.path.join(root, "sessions")
        if os.path.isdir(sessions_dir):
            for file in self._find_rollouts(sessions_dir):
                out.append(self.descriptor(file))
        history = os.path.join(root, "history.jsonl")
        if os.path.isfile(history):
            out.append(self.descriptor(history))
        return out

    def _find_rollouts(self, directory: str, depth: int = 0) -> List[str]:
        if depth > 6:
            return []
        found: List[str] = []
        for path in glob(os.path.join(directory, "*")):
            if os.path.isdir(path):
                if os.path.islink(path):
                    continue
                found.extend(self._find_rollouts(path, depth + 1))
            elif path.endswith(".jsonl") and "rollout" in os.path.basename(path):
                found.append(path)
        return found

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        if os.path.basename(path) == "history.jsonl":
            sess = self._parse_global_prompts(path, user)
            return [sess] if sess else []
        sess = self._parse_rollout(path, user)
        return [sess] if sess else []

    def _parse_rollout(self, file: str, user: str) -> Optional[Dict[str, Any]]:
        entries = self.load_jsonl(file)
        if not entries:
            return None
        turns: List[Dict[str, Any]] = []
        prompts: List[Dict[str, Any]] = []
        session_id = ""
        project = ""
        first = 0
        last = 0

        for e in entries:
            ts = self.ts_to_epoch(e.get("timestamp"))
            if ts > 0:
                last = ts
                if first == 0:
                    first = ts
            etype = e.get("type") or e.get("record_type") or ""
            payload = e.get("payload") or e
            ptype = payload.get("type", "")

            if etype == "session_meta" or ptype == "session_meta":
                session_id = session_id or str(payload.get("id") or "")
                project = project or str(payload.get("cwd") or "")
                continue
            if not project and payload.get("cwd"):
                project = str(payload["cwd"])

            if ptype == "message":
                role = str(payload.get("role") or "assistant")
                text = self._extract_response_text(payload.get("content") or [])
                if not text.strip():
                    continue
                if role == "user":
                    prompts.append({"ts": ts, "text": self.truncate(text)})
                    turns.append(self.turn(ts, "user", text))
                else:
                    turns.append(self.turn(ts, "assistant", text))
            elif ptype == "function_call":
                args = json.dumps(payload.get("arguments"), ensure_ascii=False)
                turns.append(self.turn(ts, "tool_use", args, False, None, str(payload.get("name") or "?")))
            elif ptype == "function_call_output":
                turns.append(self.turn(ts, "tool_result", str(payload.get("output") or "")))

            if len(turns) > MAX_TURNS:
                break

        if not session_id:
            session_id = os.path.splitext(os.path.basename(file))[0]
        if not turns:
            return None

        return self.session("codex", user, session_id, {
            "project": project,
            "firstTs": first,
            "lastTs": last,
            "source": file,
            "prompts": prompts,
            "turns": turns,
        })

    def _extract_response_text(self, content: Any) -> str:
        if isinstance(content, str):
            return content
        if not isinstance(content, list):
            return ""
        parts: List[str] = []
        for b in content:
            if isinstance(b, dict) and "text" in b:
                parts.append(str(b["text"]))
            elif isinstance(b, str):
                parts.append(b)
        return "\n".join(parts)

    def _parse_global_prompts(self, src: str, user: str) -> Optional[Dict[str, Any]]:
        rows = self.load_jsonl(src)
        if not rows:
            return None
        prompts: List[Dict[str, Any]] = []
        turns: List[Dict[str, Any]] = []
        first = 0
        last = 0
        for d in rows:
            text = str(d.get("text") or d.get("display") or "").strip()
            if not text:
                continue
            ts = self.ts_to_epoch(d.get("ts") or d.get("timestamp"))
            if ts > 0:
                last = ts
                if first == 0:
                    first = ts
            prompts.append({"ts": ts, "text": self.truncate(text)})
            turns.append(self.turn(ts, "user", text))
        if not prompts:
            return None
        return self.session("codex", user, "global-typed-prompts", {
            "project": "(all projects)",
            "title": "Typed prompts (global history.jsonl)",
            "firstTs": first,
            "lastTs": last,
            "source": src,
            "prompts": prompts,
            "turns": turns,
        })
