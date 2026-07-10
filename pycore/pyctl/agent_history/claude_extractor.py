# -*- coding: utf-8 -*-
"""Claude Code extractor — mirrors Laravel ClaudeCodeExtractor."""

from __future__ import annotations

import json
import os
from glob import glob
from typing import Any, Dict, List, Optional

from .base_extractor import BaseExtractor, MAX_TURNS


class ClaudeCodeExtractor(BaseExtractor):
    def tool(self) -> str:
        return "claude"

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        root = os.path.join(home, ".claude")
        out: List[Dict[str, Any]] = []
        projects = os.path.join(root, "projects")
        if os.path.isdir(projects):
            for pdir in glob(os.path.join(projects, "*")):
                if not os.path.isdir(pdir):
                    continue
                for file in glob(os.path.join(pdir, "*.jsonl")):
                    out.append(self.descriptor(file))
        history = os.path.join(root, "history.jsonl")
        if os.path.isfile(history):
            out.append(self.descriptor(history))
        return out

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        if os.path.basename(path) == "history.jsonl":
            sess = self._parse_global_prompts(path, user)
            return [sess] if sess else []
        sess = self._parse_session(path, user)
        return [sess] if sess else []

    def _parse_session(self, file: str, user: str) -> Optional[Dict[str, Any]]:
        entries = self.load_jsonl(file)
        if not entries:
            return None

        turns: List[Dict[str, Any]] = []
        prompts: List[Dict[str, Any]] = []
        has_subagent = False
        session_id = ""
        project = ""
        branch = ""
        title = ""
        models: Dict[str, bool] = {}
        first_ts = 0
        last_ts = 0

        for e in entries:
            etype = e.get("type", "")
            ts = self.ts_to_epoch(e.get("timestamp"))
            if ts > 0:
                last_ts = ts
                if first_ts == 0:
                    first_ts = ts
            session_id = session_id or str(e.get("sessionId") or "")
            project = project or str(e.get("cwd") or "")
            branch = branch or str(e.get("gitBranch") or "")
            is_side = e.get("isSidechain") is True
            if is_side:
                has_subagent = True

            if etype == "ai-title":
                title = str(e.get("title") or e.get("message") or title)
                continue

            if etype == "user":
                kind, text = self.classify_user_claude(e)
                text = text.strip()
                if not text:
                    continue
                if kind == "prompt":
                    prompts.append({"ts": ts, "text": self.truncate(text)})
                    turns.append(self.turn(ts, "user", text, is_side))
                elif kind == "tool_result":
                    turns.append(self.turn(ts, "tool_result", text, is_side))
            elif etype == "assistant":
                msg = e.get("message") or {}
                model = msg.get("model")
                if isinstance(model, str) and model:
                    models[model] = True
                content = msg.get("content", [])
                if isinstance(content, str):
                    content = [{"type": "text", "text": content}]
                if isinstance(content, list):
                    for b in content:
                        if not isinstance(b, dict):
                            continue
                        bt = b.get("type", "")
                        if bt == "text" and str(b.get("text", "")).strip():
                            turns.append(self.turn(ts, "assistant", str(b["text"]), is_side, model))
                        elif bt == "thinking" and str(b.get("thinking", "")).strip():
                            turns.append(self.turn(ts, "thinking", str(b["thinking"]), is_side, model))
                        elif bt == "tool_use":
                            inp = json.dumps(b.get("input") or {}, ensure_ascii=False)
                            turns.append(self.turn(ts, "tool_use", inp, is_side, model, str(b.get("name") or "?")))

            if len(turns) > MAX_TURNS:
                break

        if not session_id:
            session_id = os.path.splitext(os.path.basename(file))[0]

        return self.session("claude", user, session_id, {
            "project": project,
            "title": title,
            "firstTs": first_ts,
            "lastTs": last_ts,
            "hasSubagent": has_subagent,
            "models": list(models.keys()),
            "source": file,
            "prompts": prompts,
            "turns": turns,
        })

    def _parse_global_prompts(self, src: str, user: str) -> Optional[Dict[str, Any]]:
        rows = self.load_jsonl(src)
        if not rows:
            return None
        prompts: List[Dict[str, Any]] = []
        turns: List[Dict[str, Any]] = []
        first = 0
        last = 0
        for d in rows:
            text = str(d.get("display") or "").strip()
            if not text:
                continue
            ts = self.ts_to_epoch(d.get("timestamp"))
            if ts > 0:
                last = ts
                if first == 0:
                    first = ts
            prompts.append({"ts": ts, "text": self.truncate(text)})
            turns.append(self.turn(ts, "user", text, False, None, str(d.get("project") or "")))
        if not prompts:
            return None
        return self.session("claude", user, "global-typed-prompts", {
            "project": "(all projects)",
            "title": "Typed prompts (global history.jsonl)",
            "firstTs": first,
            "lastTs": last,
            "hasSubagent": False,
            "models": [],
            "source": src,
            "prompts": prompts,
            "turns": turns,
        })
