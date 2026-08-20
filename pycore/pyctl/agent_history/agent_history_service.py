# -*- coding: utf-8 -*-
"""
Local AI agent history extractor — pycore twin of Laravel DeveloperHistoryService.

Incrementally scans Agent/Claude/Codex/Cursor/Gemini/Kimi/Antigravity/Cline source files
from user home dirs, parses prompts + AI returns, and persists to txt files under
``<cache>/pycore/.ai_state/agent_history/`` (no database).
"""

from __future__ import annotations

import calendar
import hashlib
import os
import platform
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pycore.pyctl.agent_history.agent_history_txt as txt
from pycore.pyctl.agent_history.agent_history_fragments import summarize_tool_fragments_many
from pycore.pyctl.agent_history.snapshot_cache import (
    file_revision,
    read_index_catalog,
    read_prompt_catalog,
    read_prompt_catalog_snapshot,
    session_summary,
)
from pycore.pyctl.agent_history.antigravity_extractor import AntigravityExtractor
from pycore.pyctl.agent_history.claude_extractor import ClaudeCodeExtractor
from pycore.pyctl.agent_history.cline_extractor import ClineExtractor
from pycore.pyctl.agent_history.codex_extractor import CodexExtractor
from pycore.pyctl.agent_history.cursor_extractor import CursorExtractor
from pycore.pyctl.agent_history.gemini_extractor import GeminiExtractor
from pycore.pyctl.agent_history.generic_agent_extractor import GenericAgentExtractor
from pycore.pyctl.agent_history.kimi_extractor import KimiExtractor
from pycore.pyctl.agent_history.pi_extractor import PiExtractor
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)
from pycore.pyutils.common.status_snapshot_cache import status_snapshot_cache

PROMPTS_CAP = 8000
MATERIALIZE_CAP = 100
ID_PAGE_SIZE_CAP = 1000
EXTRACT_PROBE_SOURCE_CAP = 25
EXTRACTOR_SCHEMA_REVISION = "2026-08-20.2"
TOOL_SOURCE_REVISIONS_CACHE_KEY = "agent_history.tool_source_revisions"
TOOL_STATISTICS_CACHE_PREFIX = "agent_history.tool_statistics."
TOOL_EXTRACT_PROBE_CACHE_PREFIX = "agent_history.extract_probe."
SESSION_ID_FIELDS = (
    "id",
    "tool",
    "os_user",
    "started_ts",
    "ended_ts",
    "prompt_count",
    "has_subagent",
)
TOOL_MARKERS = (
    ".claude", ".codex", ".gemini", ".cursor", ".kimi-code", ".kimi",
    ".agent", ".openclaw", ".cline", ".antigravity", ".pi",
)
STORE_TIMESTAMP_RE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$"
)

_EXTRACT_QUEUE = 'pyctl.agent_history.extract'
_SUMMARY_SIGNAL = 'pyctl.agent_history.summary'
_EXTRACT_WORKER = SerializedWorkerThread(
    _EXTRACT_QUEUE,
    'AgentHistoryExtractThread',
)
_EXTRACT_WORKER.start()


def _valid_generated_at(value: Any) -> str:
    timestamp = str(value or "").strip()
    match = STORE_TIMESTAMP_RE.fullmatch(timestamp)
    if match is None:
        return ""
    year, month, day, hour, minute, second = [int(part) for part in match.groups()]
    if year < 2000 or year > 2100 or month < 1 or month > 12:
        return ""
    if day < 1 or day > calendar.monthrange(year, month)[1]:
        return ""
    if hour > 23 or minute > 59 or second > 59:
        return ""
    return timestamp


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
            PiExtractor(),
            GeminiExtractor(),
            CursorExtractor(),
            KimiExtractor(),
            AntigravityExtractor(),
            ClineExtractor(),
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
                        "source_id": self._source_id(d["path"]),
                        "mtime": d["mtime"],
                        "bytes": d["bytes"],
                        "extractor": idx,
                        "tool": extractor.tool(),
                        "user": user,
                    }
        return out

    @staticmethod
    def _source_id(path: str) -> str:
        return hashlib.md5(str(path or "").encode("utf-8")).hexdigest()

    @staticmethod
    def _signature(sources: Dict[str, Dict[str, Any]]) -> str:
        parts = [
            f"{i.get('source_id') or AgentHistoryService._source_id(p)}:{i['mtime']}:{i['bytes']}"
            for p, i in sources.items()
        ]
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
            extractor_schema_changed = state.get("extractor_schema_revision") != EXTRACTOR_SCHEMA_REVISION
            prev_sources = state.get("sources") if isinstance(state.get("sources"), dict) else {}
            prev_sources_by_id = {
                str(info.get("source_id") or self._source_id(path)): {"path": path, **info}
                for path, info in prev_sources.items()
                if isinstance(info, dict)
            }

            if (
                not force
                and not extractor_schema_changed
                and state.get("signature") == signature
                and _valid_generated_at(state.get("generated_at"))
            ):
                summary = {"unchanged": True, "is_dev_machine": is_dev}
                summary.update(state.get("counts") or {})
                THREAD_BUS.signal(_SUMMARY_SIGNAL, summary)
                return summary

            index = txt.read_index()
            edits = txt.read_edits()
            summaries: Dict[str, Dict[str, Any]] = {}
            for s in index.get("sessions") or []:
                sid = s.get("id")
                if sid:
                    summaries[sid] = s

            if force or extractor_schema_changed:
                changed_paths = list(current.keys())
            else:
                changed_paths = []
                for path, info in current.items():
                    prev = prev_sources_by_id.get(str(info.get("source_id") or ""))
                    if not prev or prev.get("mtime") != info["mtime"] or prev.get("bytes") != info["bytes"]:
                        changed_paths.append(path)

            current_source_ids = {
                str(info.get("source_id") or self._source_id(path))
                for path, info in current.items()
            }
            removed_paths = {
                str(info.get("path") or "")
                for source_id, info in prev_sources_by_id.items()
                if source_id not in current_source_ids and info.get("path")
            }
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

                    summary = session_summary(detail)
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
                    "source_id": info["source_id"],
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
                "extractor_schema_revision": EXTRACTOR_SCHEMA_REVISION,
                "sources": new_sources,
                "counts": counts,
            })

            summary = {"is_dev_machine": is_dev, "changed": len(changed_paths), "removed": len(removed_paths)}
            summary.update(counts)
            THREAD_BUS.signal(_SUMMARY_SIGNAL, summary)
            THREAD_BUS.trigger_event(
                BusSignals.AGENT_HISTORY_SESSIONS_CHANGED,
                {"generated_at": generated_at, **summary},
                async_mode=True,
            )
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
        index = self._index_catalog()
        state = txt.read_state()
        counts = state.get("counts") or {}
        if not isinstance(counts, dict):
            counts = {}
        if not counts.get("sessions"):
            counts["sessions"] = index.get("sessions_count") or len(index.get("sessions") or [])
        sessions = [
            session_summary(session)
            for session in (index.get("sessions") or [])
            if isinstance(session, dict)
        ]
        return {
            "is_dev_machine": index.get("is_dev_machine", self.is_dev_machine()),
            "generated_at": _valid_generated_at(index.get("generated_at")) or _valid_generated_at(state.get("generated_at")),
            "tools": index.get("tools") or [],
            "users": index.get("users") or [],
            "langs": index.get("langs") or [],
            "sessions": sessions,
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
        tools: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        all_prompts = self._prompt_catalog()
        needle = (q or "").strip().lower()
        allowed_tools = {
            str(item).strip().lower()
            for item in (tools or [])
            if str(item).strip()
        }
        filtered = []
        for p in all_prompts:
            if tool and p.get("tool") != tool:
                continue
            if not tool and allowed_tools and str(p.get("tool") or "").lower() not in allowed_tools:
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

    # --- DIFF read surface (ID page tables + lazy per-page materialization) -- #
    # Mirrors the queue-center contract: ID pages carry IDs + status metadata
    # only and are aligned by a revision marker; full rows are materialized
    # lazily for the requested page. No full loads cross the wire.

    @staticmethod
    def _file_revision(path: Path) -> str:
        return file_revision(path)

    @staticmethod
    def _paginate(items: List[Dict[str, Any]], page: int, page_size: int) -> Dict[str, Any]:
        page_size = max(1, min(int(page_size or 50), ID_PAGE_SIZE_CAP))
        total = len(items)
        page_count = max(1, -(-total // page_size))
        page = max(1, min(int(page or 1), page_count))
        start = (page - 1) * page_size
        return {
            "total": total,
            "page": page,
            "page_count": page_count,
            "items": items[start:start + page_size],
        }

    def _store_header(self, index: Dict[str, Any]) -> Dict[str, Any]:
        state = txt.read_state()
        counts = state.get("counts") or {}
        if not isinstance(counts, dict):
            counts = {}
        if not counts.get("sessions"):
            counts["sessions"] = index.get("sessions_count") or len(index.get("sessions") or [])
        return {
            "is_dev_machine": index.get("is_dev_machine", self.is_dev_machine()),
            "generated_at": _valid_generated_at(index.get("generated_at")) or _valid_generated_at(state.get("generated_at")),
            "tools": index.get("tools") or [],
            "users": index.get("users") or [],
            "langs": index.get("langs") or [],
            "counts": counts,
        }

    def _prompt_catalog(self) -> List[Dict[str, Any]]:
        """Prompts parsed once per store revision; text stays backend-side."""
        return read_prompt_catalog()

    def _index_catalog(self) -> Dict[str, Any]:
        """Session summaries parsed once per persistent index revision."""
        snapshot = self._index_catalog_snapshot()
        data = snapshot.get("data") or {}
        return data if isinstance(data, dict) else {}

    def _index_catalog_snapshot(self) -> Dict[str, Any]:
        return read_index_catalog()

    @staticmethod
    def _filter_prompts(
        prompts: List[Dict[str, Any]],
        tool: Optional[str] = None,
        user: Optional[str] = None,
        q: Optional[str] = None,
        tools: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        needle = (q or "").strip().lower()
        allowed_tools = {
            str(item).strip().lower()
            for item in (tools or [])
            if str(item).strip()
        }
        filtered = []
        for p in prompts:
            if tool and p.get("tool") != tool:
                continue
            if not tool and allowed_tools and str(p.get("tool") or "").lower() not in allowed_tools:
                continue
            if user and p.get("os_user") != user:
                continue
            if needle and needle not in (p.get("text") or "").lower():
                continue
            filtered.append(p)
        return filtered

    def read_session_id_pages(
        self,
        tool: Optional[str] = None,
        user: Optional[str] = None,
        q: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        since_revision: str = "",
    ) -> Dict[str, Any]:
        snapshot = self._index_catalog_snapshot()
        revision = str(snapshot.get("revision") or "missing")
        if since_revision and since_revision == revision:
            return {"revision": revision, "unchanged": True}
        index = snapshot.get("data") or {}
        needle = (q or "").strip().lower()
        filtered = []
        for s in index.get("sessions") or []:
            if not isinstance(s, dict):
                continue
            if tool and s.get("tool") != tool:
                continue
            if user and s.get("os_user") != user:
                continue
            if needle:
                hay = f"{s.get('title') or ''} {s.get('project') or ''} {s.get('tool') or ''} {s.get('os_user') or ''}".lower()
                if needle not in hay:
                    continue
            filtered.append(s)
        result = self._store_header(index)
        result["revision"] = revision
        result.update(self._paginate(filtered, page, page_size))
        result["items"] = [
            {field: s.get(field) for field in SESSION_ID_FIELDS}
            for s in result["items"]
        ]
        return result

    def read_session_page(self, ids: List[str]) -> Dict[str, Any]:
        wanted = [str(value) for value in (ids or []) if str(value or "")][:MATERIALIZE_CAP]
        snapshot = self._index_catalog_snapshot()
        by_id = snapshot.get("by_id") or {}
        items = [by_id[sid] for sid in wanted if sid in by_id]
        return {"items": items, "total": len(items)}

    def read_prompt_id_pages(
        self,
        tool: Optional[str] = None,
        user: Optional[str] = None,
        q: Optional[str] = None,
        tools: Optional[List[str]] = None,
        page: int = 1,
        page_size: int = 50,
        since_revision: str = "",
    ) -> Dict[str, Any]:
        prompt_snapshot = read_prompt_catalog_snapshot()
        revision = str(prompt_snapshot.get("revision") or "missing")
        if since_revision and since_revision == revision:
            return {"revision": revision, "unchanged": True}
        prompts = prompt_snapshot.get("items") or []
        filtered = self._filter_prompts(prompts, tool, user, q, tools)
        result = self._store_header(self._index_catalog())
        result["revision"] = revision
        result.update(self._paginate(filtered, page, page_size))
        result["items"] = [
            {key: value for key, value in p.items() if key != "text"}
            for p in result["items"]
        ]
        return result

    def read_prompt_page(self, ids: List[str]) -> Dict[str, Any]:
        """Materialize prompt text for one page from the per-session txt files."""
        wanted = [str(value) for value in (ids or []) if str(value or "")][:MATERIALIZE_CAP]
        edits = txt.read_edits()
        session_ids = []
        for pid in wanted:
            sid = pid.rsplit("#", 1)[0] if "#" in pid else pid
            if sid not in session_ids:
                session_ids.append(sid)
        blocks: Dict[str, Dict[str, Any]] = {}
        metas: Dict[str, Dict[str, Any]] = {}
        for sid in session_ids:
            detail = txt.read_session(sid)
            if not detail:
                continue
            metas[sid] = detail
            for p in detail.get("prompts") or []:
                if p.get("id"):
                    blocks[str(p["id"])] = p
        items: List[Dict[str, Any]] = []
        for pid in wanted:
            block = blocks.get(pid)
            if block is None:
                continue
            sid = pid.rsplit("#", 1)[0] if "#" in pid else pid
            meta = metas.get(sid) or {}
            text = str(block.get("text") or "")
            edited = bool(block.get("edited"))
            edit = edits.get(pid)
            if edit and edit.get("text") is not None:
                text = edit["text"]
                edited = True
            ts = int(block.get("ts") or 0)
            items.append({
                "id": pid,
                "tool": meta.get("tool") or "",
                "os_user": meta.get("os_user") or "",
                "project": meta.get("project") or "",
                "session_id": sid,
                "ts": ts,
                "time": datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S") if ts else "",
                "text": text,
                "lang": _detect_lang(text),
                "edited": edited,
            })
        return {"items": items, "total": len(items)}

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

    def read_tool_statistics(
        self,
        tool: str,
        after_ts: int = 0,
        after_fragment_id: str = "",
    ) -> Dict[str, Any]:
        """Lazily count one tool without materializing history in the browser."""
        key = str(tool or "").strip().lower()
        items = self.read_tool_statistics_many({
            key: {
                "after_ts": int(after_ts or 0),
                "after_fragment_id": str(after_fragment_id or ""),
            },
        })
        return items[0] if items else {
            "tool": key,
            "sessions": 0,
            "history_records": 0,
            "processed": 0,
            "pending": 0,
            "prompts": 0,
            "replies": 0,
            "generated_at": "",
            "source_modified_ts": 0,
        }

    def read_tool_statistics_many(
        self,
        cursors: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Read tool counts from a source-revision-aware shared snapshot."""
        keys = [str(tool or "").strip().lower() for tool in cursors]
        keys = [tool for tool in keys if tool]
        normalized_cursors: Dict[str, Dict[str, Any]] = {}
        source_revisions = self._tool_source_revisions()
        versions: Dict[str, str] = {}
        for tool in keys:
            cursor = cursors.get(tool) or {}
            normalized = {
                "after_ts": int(cursor.get("after_ts") or 0),
                "after_fragment_id": str(cursor.get("after_fragment_id") or ""),
                "backfill_target_ts": int(cursor.get("backfill_target_ts") or 0),
                "backfill_target_fragment_id": str(
                    cursor.get("backfill_target_fragment_id") or ""
                ),
                "live_after_ts": int(cursor.get("live_after_ts") or 0),
                "live_after_fragment_id": str(
                    cursor.get("live_after_fragment_id") or ""
                ),
                "lane_aware": bool(cursor.get("lane_aware")),
            }
            normalized_cursors[tool] = normalized
            source_revision = source_revisions.get(tool) or {}
            version_source = (
                f"{tool}|{source_revision.get('revision') or 'empty'}|"
                f"{normalized['after_ts']}|{normalized['after_fragment_id']}|"
                f"{normalized['backfill_target_ts']}|"
                f"{normalized['backfill_target_fragment_id']}|"
                f"{normalized['live_after_ts']}|"
                f"{normalized['live_after_fragment_id']}|"
                f"{int(normalized['lane_aware'])}"
            )
            version = hashlib.md5(version_source.encode()).hexdigest()
            versions[tool] = version
        cache_keys = {
            tool: TOOL_STATISTICS_CACHE_PREFIX + tool
            for tool in keys
        }
        tools_by_cache_key = {
            cache_key: tool
            for tool, cache_key in cache_keys.items()
        }
        cache_versions = {
            cache_keys[tool]: versions[tool]
            for tool in keys
        }

        def load_missing(
            missing_cache_keys: List[str],
        ) -> Dict[str, Dict[str, Any]]:
            missing_tools = [
                tools_by_cache_key[cache_key]
                for cache_key in missing_cache_keys
            ]
            missing_cursors = {
                tool: normalized_cursors[tool]
                for tool in missing_tools
            }
            computed = self._compute_tool_statistics_many(
                missing_cursors,
                source_revisions,
            )
            computed_by_tool = {
                str(item.get("tool") or ""): item
                for item in computed
            }
            return {
                cache_keys[tool]: computed_by_tool[tool]
                for tool in missing_tools
                if tool in computed_by_tool
            }

        cached_by_key = status_snapshot_cache.get_many(
            cache_versions,
            load_missing,
            ttl_seconds=float("inf"),
        )
        return [
            dict(cached_by_key[cache_keys[tool]])
            for tool in keys
            if cache_keys[tool] in cached_by_key
        ]

    def _tool_source_revisions(self) -> Dict[str, Dict[str, Any]]:
        state_path = txt.store_dir() / "state.txt"
        file_revision = self._file_revision(state_path)
        snapshot = status_snapshot_cache.get(
            TOOL_SOURCE_REVISIONS_CACHE_KEY,
            self._build_tool_source_revisions,
            ttl_seconds=float("inf"),
            version=file_revision,
        )
        tools = snapshot.get("tools") or {}
        return tools if isinstance(tools, dict) else {}

    @staticmethod
    def _build_tool_source_revisions() -> Dict[str, Any]:
        state = txt.read_state()
        sources = state.get("sources") or {}
        schema_revision = str(state.get("extractor_schema_revision") or "")
        parts_by_tool: Dict[str, List[str]] = {}
        modified_by_tool: Dict[str, int] = {}
        for source_path, raw_source in sources.items():
            if not isinstance(raw_source, dict):
                continue
            tool = str(raw_source.get("tool") or "").strip().lower()
            if not tool:
                continue
            modified = int(raw_source.get("mtime") or 0)
            session_ids = sorted(
                str(item) for item in raw_source.get("session_ids") or []
            )
            source_id = str(raw_source.get("source_id") or source_path)
            parts_by_tool.setdefault(tool, []).append(
                f"{source_id}|{modified}|{int(raw_source.get('bytes') or 0)}|"
                f"{','.join(session_ids)}|{schema_revision}"
            )
            modified_by_tool[tool] = max(modified_by_tool.get(tool, 0), modified)
        tools: Dict[str, Dict[str, Any]] = {}
        for tool, parts in parts_by_tool.items():
            parts.sort()
            tools[tool] = {
                "revision": hashlib.md5("\n".join(parts).encode()).hexdigest(),
                "last_modified_ts": modified_by_tool.get(tool, 0),
                "source_count": len(parts),
            }
        return {"tools": tools}

    def _compute_tool_statistics_many(
        self,
        cursors: Dict[str, Dict[str, Any]],
        source_revisions: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        keys = list(cursors)
        index = self._index_catalog()
        session_counts = {tool: 0 for tool in keys}
        for session in index.get("sessions") or []:
            if not isinstance(session, dict):
                continue
            session_tool = str(session.get("tool") or "").lower()
            if session_tool in session_counts:
                session_counts[session_tool] += 1
        counts_by_tool = summarize_tool_fragments_many(cursors)
        generated_at = _valid_generated_at(index.get("generated_at"))
        results: List[Dict[str, Any]] = []
        for tool, counts in counts_by_tool.items():
            source_revision = source_revisions.get(tool) or {}
            result: Dict[str, Any] = {
                "tool": tool,
                "sessions": session_counts.get(tool, 0),
                "history_records": counts["total"],
                "processed": counts["processed"],
                "pending": counts["pending"],
                "prompts": counts["prompts"],
                "replies": counts["replies"],
                "generated_at": generated_at,
                "source_modified_ts": int(
                    source_revision.get("last_modified_ts") or 0
                ),
            }
            results.append(result)
        return results

    def test_extract(self, tool: str) -> Dict[str, Any]:
        """Parse the newest source of one tool and return its latest prompt.

        Read-only probe for the UI checkbox flow — never writes the txt
        store, never touches extract state.
        """
        key = str(tool or "").strip().lower()
        source_revision = self._tool_source_revisions().get(key) or {}
        return status_snapshot_cache.get(
            TOOL_EXTRACT_PROBE_CACHE_PREFIX + key,
            lambda: self._test_extract_uncached(key),
            ttl_seconds=float("inf"),
            version=str(source_revision.get("revision") or "empty"),
        )

    def _test_extract_uncached(self, key: str) -> Dict[str, Any]:
        extractor = next(
            (e for e in self._extractors if str(e.tool()).lower() == key),
            None,
        )
        if extractor is None:
            return {"ok": False, "tool": key, "error": "unknown tool", "sources": 0}

        sources: List[Dict[str, Any]] = []
        for home, user in user_homes().items():
            for d in extractor.discover(home, user):
                sources.append({**d, "user": user})
        if not sources:
            return {"ok": False, "tool": key, "error": "no history source found", "sources": 0}

        sources.sort(key=lambda d: float(d.get("mtime") or 0), reverse=True)
        inline_sources = [
            source
            for source in sources
            if int(source.get("bytes") or 0) <= 16 * 1024 * 1024
        ]
        if not inline_sources:
            return {
                "ok": False,
                "tool": key,
                "error": "history sources exceed the 16 MiB inline probe limit",
                "sources": len(sources),
            }
        last_error = ""
        for src in inline_sources[:EXTRACT_PROBE_SOURCE_CAP]:
            try:
                sessions = extractor.parse_source(src["path"], src["user"])
            except Exception as exc:  # noqa: BLE001 — try the next source
                last_error = str(exc)
                continue
            prompts: List[Dict[str, Any]] = []
            for sess in sessions or []:
                for p in sess.get("prompts") or []:
                    if p.get("text"):
                        prompts.append(p)
            if prompts:
                prompts.sort(key=lambda p: p.get("ts") or 0, reverse=True)
                latest = prompts[0]
                return {
                    "ok": True,
                    "tool": key,
                    "sources": len(sources),
                    "prompt": {
                        "ts": int(latest.get("ts") or 0),
                        "text": str(latest.get("text") or "")[:500],
                    },
                }
        if last_error:
            return {
                "ok": False,
                "tool": key,
                "error": last_error,
                "sources": len(sources),
            }
        return {
            "ok": True,
            "empty": True,
            "tool": key,
            "sources": len(sources),
        }

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


agent_history_service = AgentHistoryService()
