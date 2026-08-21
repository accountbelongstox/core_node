# -*- coding: utf-8 -*-
"""Pi coding-agent session extractor."""

from __future__ import annotations

import os
from glob import glob
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.base_extractor import BaseExtractor
from pycore.pyfoundations.text_parsing import split_by_word_count


ASSISTANT_ARTICLE_WORDS = 600
DEFAULT_SESSION_DIRECTORY = "sessions"
PI_AGENT_DIRECTORY = os.path.join(".pi", "agent")
PI_SESSION_ENV = "PI_CODING_AGENT_SESSION_DIR"
PI_SETTINGS_FILE = "settings.json"


class PiExtractor(BaseExtractor):
    """Extract persisted Pi user prompts and visible assistant text."""

    def tool(self) -> str:
        return "pi"

    def discover(self, home: str, user: str) -> List[Dict[str, Any]]:
        agent_root = self._canonical_agent_root(home, user)
        session_home = os.path.dirname(os.path.dirname(agent_root))
        roots = self._session_roots(agent_root, session_home)
        found: Dict[str, Dict[str, Any]] = {}
        pattern = "**/*.jsonl"
        for root in roots:
            if not os.path.isdir(root):
                continue
            for path in glob(os.path.join(root, pattern), recursive=True):
                if not os.path.isfile(path):
                    continue
                real = os.path.realpath(path)
                found[real] = self.descriptor(real)
        return list(found.values())

    @staticmethod
    def _canonical_agent_root(home: str, user: str) -> str:
        if os.name != "nt":
            return os.path.join(home, PI_AGENT_DIRECTORY)
        system_drive = str(os.environ.get("SystemDrive") or "C:").rstrip("\\/")
        windows_home = os.path.join(system_drive + os.sep, "Users", user)
        windows_agent_root = os.path.join(windows_home, PI_AGENT_DIRECTORY)
        if os.path.isdir(windows_agent_root):
            return windows_agent_root
        return os.path.join(home, PI_AGENT_DIRECTORY)

    def parse_source(self, path: str, user: str) -> List[Dict[str, Any]]:
        entries = self.load_jsonl(path)
        if not entries:
            return []

        header: Dict[str, Any] = {}
        prompts: List[Dict[str, Any]] = []
        turns: List[Dict[str, Any]] = []
        assistant_parts: List[str] = []
        assistant_model: Optional[str] = None
        assistant_ts = 0
        first_ts = 0
        last_ts = 0

        for entry in entries:
            entry_type = str(entry.get("type") or "")
            if entry_type == "session":
                header = entry
                timestamp = self.ts_to_epoch(entry.get("timestamp"))
                first_ts = timestamp if timestamp > 0 and first_ts <= 0 else first_ts
                last_ts = max(last_ts, timestamp)
                continue
            if entry_type != "message" or not isinstance(entry.get("message"), dict):
                continue

            message = entry["message"]
            role = str(message.get("role") or "").lower()
            timestamp = self.ts_to_epoch(
                entry.get("timestamp") or message.get("timestamp")
            )
            if timestamp <= 0:
                timestamp = int(os.path.getmtime(path))
            first_ts = timestamp if first_ts <= 0 else min(first_ts, timestamp)
            last_ts = max(last_ts, timestamp)

            if role == "user":
                self._flush_assistant(
                    turns,
                    assistant_parts,
                    assistant_ts,
                    assistant_model,
                )
                assistant_parts = []
                assistant_model = None
                assistant_ts = 0
                text = self._message_text(message.get("content"))
                if not text:
                    continue
                prompt = {
                    "ts": timestamp,
                    "text": self.truncate(text),
                    "article_boundary": True,
                    "direct_text": True,
                }
                prompts.append(prompt)
                turn = self.turn(timestamp, "user", text)
                turn["article_boundary"] = True
                turn["direct_text"] = True
                turns.append(turn)
                continue

            if role != "assistant":
                continue
            text = self._assistant_text(message.get("content"))
            if not text:
                continue
            assistant_parts.append(text)
            assistant_ts = timestamp
            assistant_model = str(message.get("model") or assistant_model or "") or None

        self._flush_assistant(
            turns,
            assistant_parts,
            assistant_ts,
            assistant_model,
        )
        if not turns:
            return []

        raw_id = str(header.get("id") or os.path.splitext(os.path.basename(path))[0])
        project = str(header.get("cwd") or "")
        title = prompts[0]["text"][:120] if prompts else raw_id
        return [self.session("pi", user, raw_id, {
            "project": project,
            "title": title,
            "firstTs": first_ts,
            "lastTs": last_ts,
            "source": path,
            "prompts": prompts,
            "turns": turns,
        })]

    def _session_roots(self, agent_root: str, home: str) -> List[str]:
        settings = self.load_json(os.path.join(agent_root, PI_SETTINGS_FILE))
        configured = os.environ.get(PI_SESSION_ENV) or (
            settings.get("sessionDir")
            if isinstance(settings, dict)
            else ""
        )
        roots: List[str] = []
        if configured:
            roots.append(self._resolve_session_root(str(configured), agent_root, home))
        roots.append(os.path.join(agent_root, DEFAULT_SESSION_DIRECTORY))
        return list(dict.fromkeys(os.path.realpath(root) for root in roots if root))

    @staticmethod
    def _resolve_session_root(value: str, agent_root: str, home: str) -> str:
        path = value.strip()
        if path == "~":
            return home
        if path.startswith("~/") or path.startswith("~\\"):
            return os.path.join(home, path[2:])
        if os.path.isabs(path):
            return path
        return os.path.join(agent_root, path)

    def _flush_assistant(
        self,
        turns: List[Dict[str, Any]],
        parts: List[str],
        timestamp: int,
        model: Optional[str],
    ) -> None:
        text = "\n\n".join(part.strip() for part in parts if part.strip()).strip()
        if not text:
            return
        for chunk in split_by_word_count(text, ASSISTANT_ARTICLE_WORDS):
            turn = self.turn(timestamp, "assistant", chunk, model=model)
            turn["article_boundary"] = True
            turn["direct_text"] = True
            turns.append(turn)

    def _message_text(self, content: Any) -> str:
        return self.stringify_content(content).strip()

    @staticmethod
    def _assistant_text(content: Any) -> str:
        if isinstance(content, str):
            return content.strip()
        if not isinstance(content, list):
            return ""
        parts = [
            str(block.get("text") or "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        ]
        return "\n".join(part for part in parts if part).strip()

__all__ = ["ASSISTANT_ARTICLE_WORDS", "PiExtractor"]
