# -*- coding: utf-8 -*-
"""
Local AI agent history extractor — pycore twin of Laravel DeveloperHistoryService.

Incrementally scans Agent/Claude/Codex/Cursor/Gemini/Kimi/Antigravity/Cline/Ark source files
from user home dirs, parses prompts + AI returns, and persists to txt files under
``<cache>/pycore/.ai_state/agent_history/`` (no database).
"""

from __future__ import annotations

import hashlib
import os
import platform
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pycore.pyctl.agent_history.agent_history_txt as txt
from pycore.pyctl.agent_history.ark_cli_extractor import ArkCliExtractor
from pycore.pyctl.agent_history.antigravity_extractor import AntigravityExtractor
from pycore.pyctl.agent_history.claude_extractor import ClaudeCodeExtractor
from pycore.pyctl.agent_history.cline_extractor import ClineExtractor
from pycore.pyctl.agent_history.codex_extractor import CodexExtractor
from pycore.pyctl.agent_history.cursor_extractor import CursorExtractor
from pycore.pyctl.agent_history.gemini_extractor import GeminiExtractor
from pycore.pyctl.agent_history.generic_agent_extractor import GenericAgentExtractor
from pycore.pyctl.agent_history.kimi_extractor import KimiExtractor
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    SerializedWorkerThread,
    call_serialized,
)

PROMPTS_CAP = 8000
TOOL_MARKERS = (
    ".claude", ".codex", ".gemini", ".cursor", ".kimi-code", ".kimi",
    ".ark", ".ark-cli", ".agent", ".cline", ".antigravity",
)

_EXTRACT_QUEUE = 'pyctl.agent_history.extract'
_SUMMARY_SIGNAL = 'pyctl.agent_history.summary'
_EXTRACT_WORKER = SerializedWorkerThread(
    _EXTRACT_QUEUE,
    'AgentHistoryExtractThread',
)
_EXTRACT_WORKER.start()


def _detect_lang(text: str) -> str:
    if not text:
        return ""
    if re.search(r"[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]", text):
        return "zh"
    return "en"


def user_homes() -> Dict[str, str]:
    homes: Dict[str, str] = {}
    home = Path.home()
    user = os.environ.get("USERNAME") or os.environ.get("USER") or home.name
    homes[str(home)] = user
    if platform.system() == "Windows":
        users_root = Path("C:/Users")
        if users_root.is_dir():
            for p in users_root.iterdir():
                if p.is_dir() and not p.name.startswith("."):
                    homes[str(p)] = p.name
    else:
        if Path("/root").is_dir():
            homes["/root"] = "root"
        for p in Path("/home").glob("*"):
            if p.is_dir():
                homes[str(p)] = p.name
    return homes


class AgentHistoryService:
    """Incremental extractor + txt store reader."""

    def __init__(self) -> None:
        self._extractors = [
            ClaudeCodeExtractor(),
            CodexExtractor(),
            GeminiExtractor(),
            CursorExtractor(),
            KimiExtractor(),
            AntigravityExtractor(),
            ClineExtractor(),
            ArkCliExtractor(),
            GenericAgentExtractor(),
        ]

    def is_dev_machine(self) -> bool:
        for home in user_homes():
            for marker in TOOL_MARKERS:
                if os.path.exists(os.path.join(home, marker)):
                    return True
            cursor_roaming = os.path.join(home, "AppData", "Roaming", "Cursor")
            if os.path.isdir(cursor_roaming):
                return True
            cursor_cfg = os.path.join(home, ".config", "Cursor")
            if os.path.isdir(cursor_cfg):
                return True
        return True

    def _discover_all(self) -> Dict[str, Dict[str, Any]]:
        out: Dict[str, Dict[str, Any]] = {}
        for home, user in user_homes().items():
            for idx, extractor in enumerate(self._extractors):
                for d in extractor.discover(home, user):
                    out[d["path"]] = {
                        "mtime": d["mtime"],
                        "bytes": d["bytes"],
                        "extractor": idx,
                        "tool": extractor.tool(),
                        "user": user,
                    }
        return out

    @staticmethod
    def _signature(sources: Dict[str, Dict[str, Any]]) -> str:
        parts = [f"{p}:{i['mtime']}:{i['bytes']}" for p, i in sources.items()]
        parts.sort()
        return hashlib.md5("|".join(parts).encode()).hexdigest()

    @staticmethod
    def _safe_session_id(tool: str, user: str, raw_id: str, src_path: str) -> str:
        base = txt.safe_id(f"{tool}__{user}__{raw_id}")
        suffix = hashlib.md5(f"{src_path}|{raw_id}".encode()).hexdigest()[:8]
        return f"{base}-{suffix}"

    def extract(self, force: bool = False) -> Dict[str, Any]:
        return call_serialized(
            _EXTRACT_QUEUE,
            self._extract_inner,
            force,
            timeout=3600.0,
        )

    def _extract_inner(self, force: bool = False) -> Dict[str, Any]:
        generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        is_dev = self.is_dev_machine()
        try:
            current = self._discover_all()
            signature = self._signature(current)

            state = txt.read_state()
            index = txt.read_index()
            prev_sources = state.get("sources") if isinstance(state.get("sources"), dict) else {}

            if not force and state.get("signature") == signature and state.get("generated_at"):
                summary = {"unchanged": True, "is_dev_machine": is_dev}
                summary.update(state.get("counts") or {})
                THREAD_BUS.signal(_SUMMARY_SIGNAL, summary)
                return summary

            edits = txt.read_edits()
            summaries: Dict[str, Dict[str, Any]] = {}
            for s in index.get("sessions") or []:
                sid = s.get("id")
                if sid:
                    summaries[sid] = s

            if force:
                changed_paths = list(current.keys())
            else:
                changed_paths = []
                for path, info in current.items():
                    prev = prev_sources.get(path)
                    if not prev or prev.get("mtime") != info["mtime"] or prev.get("bytes") != info["bytes"]:
                        changed_paths.append(path)

            removed_paths = set(prev_sources.keys()) - set(current.keys())
            changed_ids: List[str] = []
            removed_ids: List[str] = []
            append_prompts: List[Dict[str, Any]] = []
            new_sources = dict(prev_sources)

            for path in removed_paths:
                for sid in prev_sources.get(path, {}).get("session_ids") or []:
                    try:
                        (txt.sessions_dir() / f"{txt.safe_id(sid)}.txt").unlink(missing_ok=True)
                    except OSError:
                        pass
                    summaries.pop(sid, None)
                    removed_ids.append(sid)
                new_sources.pop(path, None)

            for path in changed_paths:
                info = current[path]
                old_ids = list(prev_sources.get(path, {}).get("session_ids") or [])
                sessions = self._extractors[info["extractor"]].parse_source(path, info["user"])
                ids: List[str] = []

                for sess in sessions:
                    src_path = sess.get("source_path") or path
                    sid = self._safe_session_id(sess["tool"], sess["os_user"], sess["raw_id"], src_path)
                    detail = dict(sess)
                    detail["id"] = sid
                    detail["file"] = f"{txt.safe_id(sid)}.txt"
                    self._assign_prompt_ids(detail, sid)
                    self._apply_edits(detail.get("prompts") or [], edits)
                    txt.write_session(sid, detail)

                    summary = {k: v for k, v in detail.items() if k not in ("prompts", "turns")}
                    summaries[sid] = summary

                    for p in detail.get("prompts") or []:
                        append_prompts.append({
                            "id": p["id"],
                            "tool": sess["tool"],
                            "os_user": sess["os_user"],
                            "project": sess.get("project") or "",
                            "session_id": sid,
                            "ts": p.get("ts") or 0,
                            "time": datetime.fromtimestamp(p["ts"]).strftime("%Y-%m-%d %H:%M:%S") if p.get("ts") else "",
                            "text": p.get("text") or "",
                            "lang": _detect_lang(p.get("text") or ""),
                            "edited": bool(p.get("edited")),
                        })
                    ids.append(sid)
                    changed_ids.append(sid)

                for gone in set(old_ids) - set(ids):
                    try:
                        (txt.sessions_dir() / f"{txt.safe_id(gone)}.txt").unlink(missing_ok=True)
                    except OSError:
                        pass
                    summaries.pop(gone, None)
                    removed_ids.append(gone)

                new_sources[path] = {
                    "mtime": info["mtime"],
                    "bytes": info["bytes"],
                    "extractor": info["extractor"],
                    "tool": info["tool"],
                    "user": info["user"],
                    "session_ids": ids,
                }

            drop = set(changed_ids + removed_ids)
            prompts = txt.read_prompts()
            prompts = [p for p in prompts if p.get("session_id") not in drop]
            prompts.extend(append_prompts)
            prompts.sort(key=lambda p: p.get("ts") or 0, reverse=True)
            if len(prompts) > PROMPTS_CAP:
                prompts = prompts[:PROMPTS_CAP]

            sessions = list(summaries.values())
            sessions.sort(key=lambda s: s.get("started_ts") or 0, reverse=True)
            tools = sorted({s.get("tool") for s in sessions if s.get("tool")})
            users = sorted({s.get("os_user") for s in sessions if s.get("os_user")})
            langs = sorted({p.get("lang") for p in prompts if p.get("lang")})

            counts = {
                "sessions": len(sessions),
                "prompts": len(prompts),
                "tools": len(tools),
                "users": len(users),
            }

            txt.write_index({
                "is_dev_machine": is_dev,
                "generated_at": generated_at,
                "tools": tools,
                "users": users,
                "langs": langs,
                "sessions": sessions,
            })
            txt.write_prompts(prompts)
            txt.write_state({
                "is_dev_machine": is_dev,
                "generated_at": generated_at,
                "signature": signature,
                "sources": new_sources,
                "counts": counts,
            })

            summary = {"is_dev_machine": is_dev, "changed": len(changed_paths), "removed": len(removed_paths)}
            summary.update(counts)
            THREAD_BUS.signal(_SUMMARY_SIGNAL, summary)
            return summary
        except Exception as e:
            summary = {"error": str(e)}
            THREAD_BUS.signal(_SUMMARY_SIGNAL, summary)
            return summary

    def _cached_summary(self) -> Dict[str, Any]:
        state = txt.read_state()
        out = {"busy": True}
        if isinstance(state.get("counts"), dict):
            out.update(state["counts"])
        return out

    def read_index(self) -> Dict[str, Any]:
        index = txt.read_index()
        if not index.get("sessions"):
            self.extract(False)
            index = txt.read_index()
        counts = txt.read_state().get("counts") or {}
        if not isinstance(counts, dict):
            counts = {}
        if not counts.get("sessions"):
            counts["sessions"] = index.get("sessions_count") or len(index.get("sessions") or [])
        return {
            "is_dev_machine": index.get("is_dev_machine", self.is_dev_machine()),
            "generated_at": index.get("generated_at", ""),
            "tools": index.get("tools") or [],
            "users": index.get("users") or [],
            "langs": index.get("langs") or [],
            "sessions": index.get("sessions") or [],
            "counts": counts,
        }

    def read_prompts(
        self,
        tool: Optional[str] = None,
        user: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        q: Optional[str] = None,
        lang: Optional[str] = None,
    ) -> Dict[str, Any]:
        all_prompts = txt.read_prompts()
        needle = (q or "").strip().lower()
        filtered = []
        for p in all_prompts:
            if tool and p.get("tool") != tool:
                continue
            if user and p.get("os_user") != user:
                continue
            if lang and p.get("lang") != lang:
                continue
            if needle and needle not in (p.get("text") or "").lower():
                continue
            filtered.append(p)
        total = len(filtered)
        limit = max(1, limit) if limit > 0 else 50
        offset = max(0, offset)
        return {
            "items": filtered[offset: offset + limit],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def read_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return txt.read_session(session_id)

    def update_prompt(self, prompt_id: str, text: str) -> Optional[Dict[str, Any]]:
        m = re.match(r"^(.+)#(\d+)$", prompt_id)
        if not m:
            return None
        session_id = m.group(1)
        edits = txt.read_edits()
        edits[prompt_id] = {"text": text, "edited_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
        txt.write_edits(edits)

        prompts = txt.read_prompts()
        for p in prompts:
            if p.get("id") == prompt_id:
                p["text"] = text
                p["edited"] = True
        txt.write_prompts(prompts)

        detail = txt.read_session(session_id)
        if detail:
            for p in detail.get("prompts") or []:
                if p.get("id") == prompt_id:
                    p["text"] = text
                    p["edited"] = True
            txt.write_session(session_id, detail)
        return {"id": prompt_id, "text": text, "edited": True}

    def get_status(self) -> Dict[str, Any]:
        return {"last": THREAD_BUS.get_signal(_SUMMARY_SIGNAL, {}) or {}}

    @staticmethod
    def _assign_prompt_ids(detail: Dict[str, Any], session_id: str) -> None:
        for i, p in enumerate(detail.get("prompts") or []):
            p["id"] = f"{session_id}#{i}"

    @staticmethod
    def _apply_edits(prompts: List[Dict[str, Any]], edits: Dict[str, Dict[str, str]]) -> None:
        for p in prompts:
            pid = p.get("id") or ""
            if pid and pid in edits and edits[pid].get("text") is not None:
                p["text"] = edits[pid]["text"]
                p["edited"] = True


_AGENT_HISTORY_PROVIDER = SerializedSingletonProvider(
    AgentHistoryService,
    "agent_history.service.provider",
    "AgentHistoryServiceProvider",
)


def get_agent_history_service() -> AgentHistoryService:
    return _AGENT_HISTORY_PROVIDER.get()
