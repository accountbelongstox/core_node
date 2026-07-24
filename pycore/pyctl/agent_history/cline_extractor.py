# -*- coding: utf-8 -*-
"""Cline VS Code task-history extractor."""

from __future__ import annotations

import glob
import os
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.base_extractor import BaseExtractor


class ClineExtractor(BaseExtractor):
    """Read Cline's persisted API conversation histories when installed."""

    def tool(self) -> str:
        return "cline"

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        roots = [
            os.path.join(home, "AppData", "Roaming", "Code", "User", "globalStorage"),
            os.path.join(home, ".config", "Code", "User", "globalStorage"),
            os.path.join(home, ".vscode-server", "data", "User", "globalStorage"),
        ]
        patterns = (
            "saoudrizwan.claude-dev/tasks/*/api_conversation_history.json",
            "cline.cline/tasks/*/api_conversation_history.json",
        )
        found: Dict[str, Dict[str, Any]] = {}
        for root in roots:
            for pattern in patterns:
                for path in glob.glob(os.path.join(root, pattern)):
                    real = os.path.realpath(path)
                    found[real] = self.descriptor(real)
        return list(found.values())

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        rows = self.load_json(path)
        if not isinstance(rows, list):
            return []
        turns: List[Dict[str, Any]] = []
        prompts: List[Dict[str, Any]] = []
        first_ts = 0
        last_ts = 0
        for index, row in enumerate(rows):
            if not isinstance(row, dict):
                continue
            role = str(row.get("role") or row.get("type") or "assistant").lower()
            role = "user" if role in ("user", "human") else "assistant"
            text = self.stringify_content(row.get("content") or row.get("text") or "").strip()
            if not text:
                continue
            ts = self.ts_to_epoch(row.get("ts") or row.get("timestamp") or row.get("created_at"))
            if ts <= 0:
                ts = int(os.path.getmtime(path)) + index
            first_ts = ts if first_ts <= 0 else min(first_ts, ts)
            last_ts = max(last_ts, ts)
            turns.append(self.turn(ts, role, text, model=row.get("model")))
            if role == "user":
                prompts.append({"ts": ts, "text": self.truncate(text)})
        if not turns:
            return []
        task_id = os.path.basename(os.path.dirname(path))
        return [self.session("cline", user, task_id, {
            "project": "cline",
            "title": prompts[0]["text"][:120] if prompts else task_id,
            "firstTs": first_ts,
            "lastTs": last_ts,
            "prompts": prompts,
            "turns": turns,
            "source": path,
        })]
