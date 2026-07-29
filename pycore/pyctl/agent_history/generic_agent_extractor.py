from __future__ import annotations

import glob
import os
from typing import Any, Dict, List

from pycore.pyctl.agent_history.base_extractor import BaseExtractor


class GenericAgentExtractor(BaseExtractor):
    def tool(self) -> str:
        # Lowercase like every other extractor — config enabled_tools,
        # planner filtering, and UI checkboxes all key on lowercase ids.
        return "agent"

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        patterns = (
            os.path.join(home, ".agent", "**", "*.jsonl"),
            os.path.join(home, ".agent", "**", "*.json"),
        )
        found: Dict[str, Dict[str, Any]] = {}
        for pattern in patterns:
            for path in glob.glob(pattern, recursive=True):
                if not os.path.isfile(path):
                    continue
                real = os.path.realpath(path)
                found[real] = self.descriptor(real)
        return list(found.values())

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        loaded = self.load_jsonl(path) if path.lower().endswith(".jsonl") else self.load_json(path)
        records = loaded if isinstance(loaded, list) else []
        if isinstance(loaded, dict):
            for key in ("messages", "conversation", "history", "turns"):
                candidate = loaded.get(key)
                if isinstance(candidate, list):
                    records = candidate
                    break
            if not records:
                records = [loaded]
        turns: List[Dict[str, Any]] = []
        prompts: List[Dict[str, Any]] = []
        first_ts = 0
        last_ts = 0
        for index, row in enumerate(records):
            if not isinstance(row, dict):
                continue
            message = row.get("message") if isinstance(row.get("message"), dict) else row
            role_value = str(message.get("role") or row.get("role") or row.get("type") or "assistant").lower()
            role = "user" if role_value in ("user", "human", "prompt") else "assistant"
            content = message.get("content") or message.get("text") or row.get("content") or row.get("text") or ""
            body = self.stringify_content(content).strip()
            if not body:
                continue
            timestamp = self.ts_to_epoch(row.get("timestamp") or row.get("ts") or row.get("created_at"))
            if timestamp <= 0:
                timestamp = int(os.path.getmtime(path)) + index
            first_ts = timestamp if first_ts <= 0 else min(first_ts, timestamp)
            last_ts = max(last_ts, timestamp)
            turns.append(self.turn(timestamp, role, body, model=message.get("model") or row.get("model")))
            if role == "user":
                prompts.append({"ts": timestamp, "text": self.truncate(body)})
        if not turns:
            return []
        raw_id = os.path.splitext(os.path.basename(path))[0]
        return [self.session(self.tool(), user, raw_id, {
            "project": os.path.basename(os.path.dirname(path)),
            "title": prompts[0]["text"][:120] if prompts else raw_id,
            "firstTs": first_ts,
            "lastTs": last_ts,
            "prompts": prompts,
            "turns": turns,
            "source": path,
        })]
