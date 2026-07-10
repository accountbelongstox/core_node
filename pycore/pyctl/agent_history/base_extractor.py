# -*- coding: utf-8 -*-
"""Shared parsing helpers for local AI-tool history extractors."""

from __future__ import annotations

import json
import os
import re
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

MAX_TURNS = 5000
MAX_TEXT = 20000
MAX_LINES = 300000


class BaseExtractor(ABC):
    """Never raises — bad input yields empty data."""

    @abstractmethod
    def tool(self) -> str:
        ...

    @abstractmethod
    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        ...

    def load_jsonl(self, path: str, max_lines: int = 0) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        cap = max_lines if max_lines > 0 else MAX_LINES
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(obj, dict):
                        out.append(obj)
                    if len(out) >= cap:
                        break
        except OSError:
            return []
        return out

    def load_json(self, path: str) -> Any:
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                return json.load(fh)
        except (OSError, json.JSONDecodeError):
            return None

    def descriptor(self, path: str) -> Dict[str, Any]:
        try:
            st = os.stat(path)
            return {"path": path, "mtime": int(st.st_mtime), "bytes": int(st.st_size)}
        except OSError:
            return {"path": path, "mtime": 0, "bytes": 0}

    def ts_to_epoch(self, ts: Any) -> int:
        if ts is None or ts == "":
            return 0
        if isinstance(ts, (int, float)):
            num = float(ts)
            return int(num / 1000.0 if num > 1e12 else num)
        if isinstance(ts, str) and ts.isdigit():
            num = float(ts)
            return int(num / 1000.0 if num > 1e12 else num)
        try:
            s = str(ts).replace("Z", "+00:00")
            dt = datetime.fromisoformat(s)
            return int(dt.timestamp())
        except (ValueError, TypeError):
            return 0

    def stringify_content(self, content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: List[str] = []
            for block in content:
                if isinstance(block, dict):
                    btype = block.get("type", "")
                    if btype == "text":
                        parts.append(str(block.get("text", "")))
                    elif btype == "image":
                        parts.append("[image]")
                    else:
                        parts.append(str(block.get("text", "")))
                else:
                    parts.append(str(block))
            return "\n".join(p for p in parts if p)
        return ""

    def truncate(self, text: str) -> str:
        if len(text) <= MAX_TEXT:
            return text
        return text[:MAX_TEXT] + "\n... [truncated]"

    def session(self, tool: str, user: str, raw_id: str, parts: Dict[str, Any]) -> Dict[str, Any]:
        first = int(parts.get("firstTs") or 0)
        last = int(parts.get("lastTs") or 0)
        source = str(parts.get("source") or "")
        try:
            st = os.stat(source)
            src_mtime = int(st.st_mtime)
            nbytes = int(st.st_size)
        except OSError:
            src_mtime = 0
            nbytes = 0
        return {
            "tool": tool,
            "os_user": user,
            "raw_id": raw_id,
            "project": parts.get("project") or "",
            "title": parts.get("title") or "",
            "started_ts": first,
            "started_at": datetime.fromtimestamp(first).strftime("%Y-%m-%d %H:%M:%S") if first > 0 else "",
            "ended_at": datetime.fromtimestamp(last).strftime("%Y-%m-%d %H:%M:%S") if last > 0 else "",
            "prompt_count": len(parts.get("prompts") or []),
            "message_count": len(parts.get("turns") or []),
            "has_subagent": bool(parts.get("hasSubagent")),
            "models": parts.get("models") or [],
            "source_path": source,
            "source_mtime": src_mtime,
            "bytes": nbytes,
            "prompts": parts.get("prompts") or [],
            "turns": parts.get("turns") or [],
        }

    def turn(
        self,
        ts: int,
        role: str,
        text: str,
        is_subagent: bool = False,
        model: Optional[str] = None,
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        return {
            "ts": ts,
            "time": datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S") if ts > 0 else "",
            "role": role,
            "is_subagent": is_subagent,
            "model": model,
            "name": name,
            "text": self.truncate(text),
        }

    def classify_user_claude(self, entry: Dict[str, Any]) -> Tuple[str, str]:
        content = (entry.get("message") or {}).get("content")
        if isinstance(content, list):
            chunks: List[str] = []
            is_tool_result = False
            for block in content:
                if not isinstance(block, dict):
                    chunks.append(str(block))
                    continue
                btype = block.get("type", "")
                if btype == "tool_result":
                    is_tool_result = True
                    chunks.append(self.stringify_content(block.get("content", "")))
                elif btype == "text":
                    chunks.append(str(block.get("text", "")))
                elif btype == "image":
                    chunks.append("[image]")
            kind = "tool_result" if is_tool_result else "prompt"
            return kind, "\n".join(c for c in chunks if c)
        text = content if isinstance(content, str) else self.stringify_content(content)
        if re.match(r"^\s*<(command-name|command-message|local-command|bash-input)", text or ""):
            return "meta", text or ""
        return "prompt", text or ""
