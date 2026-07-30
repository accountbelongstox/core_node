# -*- coding: utf-8 -*-
"""Gemini CLI extractor — mirrors Laravel GeminiExtractor."""

from __future__ import annotations

import json
import os
from glob import glob
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.base_extractor import BaseExtractor, MAX_TURNS


class GeminiExtractor(BaseExtractor):
    def tool(self) -> str:
        return "gemini"

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        tmp = os.path.join(home, ".gemini", "tmp")
        if not os.path.isdir(tmp):
            return []
        out: List[Dict[str, Any]] = []
        for project_dir in glob(os.path.join(tmp, "*")):
            if not os.path.isdir(project_dir):
                continue
            logs = os.path.join(project_dir, "logs.json")
            if os.path.isfile(logs):
                out.append(self.descriptor(logs))
            for cp in glob(os.path.join(project_dir, "checkpoints", "*.json")):
                out.append(self.descriptor(cp))
            for tag in glob(os.path.join(project_dir, "*.json")):
                if os.path.basename(tag) != "logs.json":
                    out.append(self.descriptor(tag))
        return out

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        data = self.load_json(path)
        if not isinstance(data, list):
            return []
        if os.path.basename(path) == "logs.json":
            return self._parse_logs(data, user, path)
        sess = self._parse_checkpoint(data, user, path)
        return [sess] if sess else []

    def _parse_logs(self, rows: List[Any], user: str, source: str) -> List[Dict[str, Any]]:
        by_session: Dict[str, List[Dict[str, Any]]] = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            sid = str(row.get("sessionId") or "default")
            by_session.setdefault(sid, []).append(row)

        out: List[Dict[str, Any]] = []
        for sid, items in by_session.items():
            turns: List[Dict[str, Any]] = []
            prompts: List[Dict[str, Any]] = []
            first = 0
            last = 0
            for row in items:
                ts = self.ts_to_epoch(row.get("timestamp"))
                if ts > 0:
                    last = ts
                    if first == 0:
                        first = ts
                rtype = str(row.get("type") or "")
                text = str(row.get("message") or "").strip()
                if not text:
                    continue
                if rtype == "user":
                    prompts.append({"ts": ts, "text": self.truncate(text)})
                    turns.append(self.turn(ts, "user", text))
                else:
                    turns.append(self.turn(ts, "assistant", text))
                if len(turns) > MAX_TURNS:
                    break
            if not turns:
                continue
            out.append(self.session("gemini", user, f"log-{os.path.basename(os.path.dirname(source))}-{sid}", {
                "project": os.path.basename(os.path.dirname(source)),
                "firstTs": first,
                "lastTs": last,
                "source": source,
                "prompts": prompts,
                "turns": turns,
            }))
        return out

    def _parse_checkpoint(self, contents: List[Any], user: str, source: str) -> Optional[Dict[str, Any]]:
        turns: List[Dict[str, Any]] = []
        prompts: List[Dict[str, Any]] = []
        try:
            mtime = int(os.stat(source).st_mtime)
        except OSError:
            mtime = 0

        for c in contents:
            if not isinstance(c, dict):
                continue
            role = str(c.get("role") or "")
            parts = c.get("parts") or []
            if not isinstance(parts, list):
                continue
            text = ""
            is_call = False
            is_resp = False
            call_name: Optional[str] = None
            for p in parts:
                if not isinstance(p, dict):
                    continue
                if "text" in p:
                    text += (("\n" if text else "") + str(p["text"]))
                elif "functionCall" in p:
                    is_call = True
                    call_name = str((p["functionCall"] or {}).get("name") or "?")
                    text += json.dumps((p["functionCall"] or {}).get("args"), ensure_ascii=False)
                elif "functionResponse" in p:
                    is_resp = True
                    text += json.dumps((p["functionResponse"] or {}).get("response"), ensure_ascii=False)
            text = text.strip()
            if not text:
                continue
            if is_call:
                turns.append(self.turn(mtime, "tool_use", text, False, None, call_name))
            elif is_resp:
                turns.append(self.turn(mtime, "tool_result", text))
            elif role == "user":
                prompts.append({"ts": mtime, "text": self.truncate(text)})
                turns.append(self.turn(mtime, "user", text))
            else:
                turns.append(self.turn(mtime, "assistant", text))
            if len(turns) > self.MAX_TURNS:
                break

        if not turns:
            return None
        raw_id = f"{os.path.basename(os.path.dirname(source))}-{os.path.splitext(os.path.basename(source))[0]}"
        return self.session("gemini", user, raw_id, {
            "project": os.path.basename(os.path.dirname(source)),
            "title": os.path.splitext(os.path.basename(source))[0],
            "firstTs": mtime,
            "lastTs": mtime,
            "source": source,
            "prompts": prompts,
            "turns": turns,
        })
