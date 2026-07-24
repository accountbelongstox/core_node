# -*- coding: utf-8 -*-
"""Ark CLI JSON/JSONL conversation-history extractor."""

from __future__ import annotations

import glob
import os
from typing import Any, Dict, List

from pycore.pyctl.agent_history.base_extractor import BaseExtractor


class ArkCliExtractor(BaseExtractor):
    """Read common Ark CLI history layouts when the tool is installed."""

    def tool(self) -> str:
        return "ark-cli"

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        patterns = (
            os.path.join(home, ".ark", "**", "*.jsonl"),
            os.path.join(home, ".ark-cli", "**", "*.jsonl"),
            os.path.join(home, ".config", "ark", "**", "*.jsonl"),
        )
        found: Dict[str, Dict[str, Any]] = {}
        for pattern in patterns:
            for path in glob.glob(pattern, recursive=True):
                real = os.path.realpath(path)
                found[real] = self.descriptor(real)
        return list(found.values())

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        rows = self.load_jsonl(path)
        turns: List[Dict[str, Any]] = []
        prompts: List[Dict[str, Any]] = []
        first_ts = 0
        last_ts = 0
        for index, row in enumerate(rows):
            message = row.get("message") if isinstance(row.get("message"), dict) else row
            role = str(message.get("role") or row.get("role") or row.get("type") or "assistant").lower()
            role = "user" if role in ("user", "human", "prompt") else "assistant"
            text = self.stringify_content(
                message.get("content") or message.get("text") or row.get("content") or row.get("text") or ""
            ).strip()
            if not text:
                continue
            ts = self.ts_to_epoch(row.get("timestamp") or row.get("ts") or row.get("created_at"))
            if ts <= 0:
                ts = int(os.path.getmtime(path)) + index
            first_ts = ts if first_ts <= 0 else min(first_ts, ts)
            last_ts = max(last_ts, ts)
            turns.append(self.turn(ts, role, text, model=message.get("model") or row.get("model")))
            if role == "user":
                prompts.append({"ts": ts, "text": self.truncate(text)})
        if not turns:
            return []
        raw_id = os.path.splitext(os.path.basename(path))[0]
        return [self.session("ark-cli", user, raw_id, {
            "project": os.path.basename(os.path.dirname(path)),
            "title": prompts[0]["text"][:120] if prompts else raw_id,
            "firstTs": first_ts,
            "lastTs": last_ts,
            "prompts": prompts,
            "turns": turns,
            "source": path,
        })]
