# -*- coding: utf-8 -*-
"""
Local AI agent history extractor — pycore twin of Laravel DeveloperHistoryService.

Incrementally scans Agent/Claude/Codex/Cursor/Gemini/Kimi/Antigravity/Cline source files
from user home dirs, parses prompts + AI returns, and persists to txt files under
``<cache>/pycore/.ai_state/agent_history/`` (no database). Reads of the store live
in ``agent_history_store``.
"""

from __future__ import annotations

import hashlib
import os
import re
from typing import Any, Dict, List, Optional

import pycore.pyctl.agent_history.agent_history_txt as txt
import pycore.pyctl.agent_history.prompt_archive as prompt_archive
import pycore.pyctl.agent_history.prompt_new_cache as prompt_new_cache
import pycore.pyctl.agent_history.root_spool as root_spool
from pycore.pyctl.agent_history.agent_history_records import (
    IS_DEV_MACHINE,
    apply_edits,
    assign_prompt_ids,
    local_time_text,
    newest_prompts_first,
    prompt_entry,
    source_id,
)
from pycore.pyctl.agent_history.agent_history_statistics import (
    agent_history_statistics,
    valid_generated_at,
)
from pycore.pyctl.agent_history.base_extractor import BaseExtractor
from pycore.pyctl.agent_history.extractor_registry import EXTRACTOR_TOOLS, build_extractors
from pycore.pyctl.agent_history.snapshot_cache import session_summary
from pycore.pyfoundations.agent_home_scanner import scan_user_homes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import AGENT_HISTORY_OFFICIAL_HOME_MARKERS
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)
from pycore.pyutils.common.status_snapshot_cache import status_snapshot_cache

EXTRACT_PROBE_SOURCE_CAP = 25
EXTRACT_PROBE_MAX_BYTES = 16 * 1024 * 1024
EXTRACT_PROBE_TEXT_CAP = 500
EXTRACTOR_SCHEMA_REVISION = "2026-09-30.1"
TOOL_EXTRACT_PROBE_CACHE_PREFIX = "agent_history.extract_probe."
PROMPT_NEW_EVENT_CAP = 20
PROMPT_NEW_TEXT_SNIPPET = 200
EXTRACT_TIMEOUT_S = 3600.0
LIVE_SCAN_TIMEOUT_S = 600.0
_EXTRACT_QUEUE = 'pyctl.agent_history.extract'
_SUMMARY_SIGNAL = 'pyctl.agent_history.summary'
_EXTRACT_WORKER = SerializedWorkerThread(
    _EXTRACT_QUEUE,
    'AgentHistoryExtractThread',
)
_EXTRACT_WORKER.start()


def _signature(sources: Dict[str, Dict[str, Any]]) -> str:
    parts = sorted(
        f"{i.get('source_id') or source_id(p)}:{i['mtime']}:{i['bytes']}"
        for p, i in sources.items()
    )
    return hashlib.md5("|".join(parts).encode()).hexdigest()


def _safe_session_id(tool: str, user: str, raw_id: str, src_path: str) -> str:
    base = txt.safe_id(f"{tool}__{user}__{raw_id}")
    suffix = hashlib.md5(f"{src_path}|{raw_id}".encode()).hexdigest()[:8]
    return f"{base}-{suffix}"


def _descriptor_key(mtime: Any, nbytes: Any) -> str:
    return f"{int(mtime or 0)}:{int(nbytes or 0)}"


def _remove_session_file(session_id: str) -> None:
    path = txt.sessions_dir() / f"{txt.safe_id(session_id)}.txt"
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistory] Session file remove failed path={path}: {exc}")


def _emit_prompt_new(new_prompts: List[Dict[str, Any]], generated_at: str) -> None:
    """Broadcast genuinely new prompts (id never seen in the store), newest first, capped."""
    if not new_prompts:
        return
    newest = newest_prompts_first(new_prompts)[:PROMPT_NEW_EVENT_CAP]
    for p in newest:
        text = re.sub(r"\s+", " ", str(p.get("text") or "")).strip()
        snippet = f"{text[:10]}...{text[-10:]}" if len(text) > 20 else text
        ColorPrint.green(
            f"[AgentHistory] New prompt detected agent={p.get('tool') or '?'} "
            f"user={p.get('os_user') or '?'} prompt=\"{snippet}\""
        )
    tools = sorted({str(p.get("tool") or "") for p in new_prompts if p.get("tool")})
    THREAD_BUS.trigger_event(
        BusSignals.AGENT_HISTORY_PROMPT_NEW,
        {
            "generated_at": generated_at,
            "tools": tools,
            "prompt_count": len(new_prompts),
            "prompts": [
                {
                    "id": p.get("id"),
                    "tool": p.get("tool"),
                    "os_user": p.get("os_user"),
                    "session_id": p.get("session_id"),
                    "ts": int(p.get("ts") or 0),
                    "time": p.get("time") or "",
                    "text": str(p.get("text") or "")[:PROMPT_NEW_TEXT_SNIPPET],
                }
                for p in newest
            ],
        },
        async_mode=True,
    )
    # Read-only side mirror for the UI paginated cache view. It runs after
    # the log lines and the event, so a cache failure never hides them.
    prompt_new_cache.append_new_prompts(new_prompts)


def _archive_prompts(prompts: List[Dict[str, Any]]) -> None:
    """Write-only backup of every scanned prompt; never read back, never fatal."""
    try:
        prompt_archive.archive_prompts(prompts)
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistory] Prompt archive write skipped count={len(prompts)}: {exc}")


def _live_scan_homes(tools: List[str]) -> Dict[str, str]:
    """Scan-center homes plus official env-override roots per tool."""
    homes = scan_user_homes()
    for tool in tools:
        spec = AGENT_HISTORY_OFFICIAL_HOME_MARKERS.get(tool) or {}
        env_key = str(spec.get("env") or "")
        env_value = os.environ.get(env_key, "").strip() if env_key else ""
        if env_value and os.path.isabs(env_value):
            parent = os.path.dirname(env_value.rstrip("/\\"))
            if parent and os.path.isdir(parent) and parent not in homes:
                homes[parent] = os.path.basename(parent)
    return homes


def _state_tool_descriptors(tool: str) -> Dict[str, str]:
    """Rebuild one tool's source descriptors from the persisted extract state."""
    state = txt.read_state()
    sources = state.get("sources") if isinstance(state.get("sources"), dict) else {}
    return {
        str(path): _descriptor_key(info.get("mtime"), info.get("bytes"))
        for path, info in sources.items()
        if isinstance(info, dict) and str(info.get("tool") or "") == tool
    }


class AgentHistoryService:
    """Incremental extractor writing the agent-history txt store."""

    def __init__(self) -> None:
        self._extractors = build_extractors()
        # Per-tool source descriptor maps for the live-scan skip cache;
        # mutated only inside the serialized extract queue.
        self._live_scan_descriptors: Dict[str, Dict[str, str]] = {}

    def _discover_all(self) -> Dict[str, Dict[str, Any]]:
        out: Dict[str, Dict[str, Any]] = {}
        for home, user in scan_user_homes().items():
            for idx, extractor in enumerate(self._extractors):
                for d in extractor.discover(home, user):
                    out[d["path"]] = {
                        "source_id": source_id(d["path"]),
                        "mtime": d["mtime"],
                        "bytes": d["bytes"],
                        "extractor": idx,
                        "tool": extractor.tool(),
                        "user": user,
                    }
        index_by_tool = {extractor.tool(): idx for idx, extractor in enumerate(self._extractors)}
        for path, rec in root_spool.read_sources().items():
            idx = index_by_tool.get(str(rec.get("tool") or ""))
            if idx is None:
                continue
            out[path] = {
                "source_id": source_id(path),
                "mtime": int(rec.get("mtime") or 0),
                "bytes": int(rec.get("bytes") or 0),
                "extractor": idx,
                "tool": rec["tool"],
                "user": str(rec.get("user") or ""),
                "spool": str(rec.get("file") or ""),
            }
        return out

    def _parse_source(self, path: str, info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Own parse, or the root spool's parse for sources this process cannot read."""
        if info.get("spool"):
            return root_spool.read_sessions(info["spool"])
        return self._extractors[info["extractor"]].parse_source(path, info["user"])

    def extract(self, force: bool = False) -> Dict[str, Any]:
        return call_serialized(
            _EXTRACT_QUEUE,
            self._extract_inner,
            force,
            timeout=EXTRACT_TIMEOUT_S,
        )

    def live_scan(self, tools: Optional[List[str]] = None) -> Dict[str, Any]:
        """UI-driven realtime scan (shares the extract serialization queue)."""
        return call_serialized(
            _EXTRACT_QUEUE,
            self._live_scan_inner,
            tools,
            timeout=LIVE_SCAN_TIMEOUT_S,
        )

    def _live_scan_baseline(self, tool: str) -> Dict[str, str]:
        """Skip-cache baseline for one tool, seeded from persisted state on first use."""
        baseline = self._live_scan_descriptors.get(tool)
        if baseline is None:
            baseline = _state_tool_descriptors(tool)
            self._live_scan_descriptors[tool] = baseline
        return baseline

    def _live_scan_inner(self, tools: Optional[List[str]]) -> Dict[str, Any]:
        supported_set = set(EXTRACTOR_TOOLS)
        requested = [
            str(tool).strip().lower()
            for tool in (tools or sorted(supported_set))
            if str(tool).strip()
        ]
        supported = [tool for tool in requested if tool in supported_set]
        unsupported = [tool for tool in requested if tool not in supported_set]
        extractor_by_tool = {
            extractor.tool(): extractor for extractor in self._extractors
        }
        homes = _live_scan_homes(supported)
        spooled = root_spool.read_sources()
        changed_tools: List[str] = []
        skipped_tools: List[str] = []
        pending_descriptors: Dict[str, Dict[str, str]] = {}
        for tool in supported:
            extractor = extractor_by_tool.get(tool)
            if extractor is None:
                skipped_tools.append(tool)
                continue
            descriptors: Dict[str, str] = {}
            for home, user in homes.items():
                for d in extractor.discover(home, user):
                    descriptors[str(d.get("path") or "")] = _descriptor_key(d.get("mtime"), d.get("bytes"))
            for path, rec in spooled.items():
                if rec.get("tool") == tool:
                    descriptors[path] = _descriptor_key(rec.get("mtime"), rec.get("bytes"))
            if descriptors == self._live_scan_baseline(tool):
                skipped_tools.append(tool)
                continue
            pending_descriptors[tool] = descriptors
            changed_tools.append(tool)

        summary: Dict[str, Any] = {}
        if changed_tools:
            summary = self._extract_inner(force=False)
            if not summary.get("error"):
                self._live_scan_descriptors.update(pending_descriptors)
        extract_error = str(summary.get("error") or "")
        result: Dict[str, Any] = {
            "tools": requested,
            "unsupported_tools": unsupported,
            "changed_tools": changed_tools,
            "skipped_tools": skipped_tools,
            "changed": bool(changed_tools) and not summary.get("unchanged") and not extract_error,
            "scanned_at": local_time_text(),
        }
        if extract_error:
            result["error"] = extract_error
        return result

    def _extract_inner(self, force: bool = False) -> Dict[str, Any]:
        generated_at = local_time_text()
        try:
            return self._extract_store(force, generated_at)
        except (OSError, ValueError) as exc:
            ColorPrint.yellow(f"[AgentHistory] Extract failed force={force}: {type(exc).__name__}: {exc}")
            summary = {"error": str(exc)}
            THREAD_BUS.signal(_SUMMARY_SIGNAL, summary)
            return summary

    def _extract_store(self, force: bool, generated_at: str) -> Dict[str, Any]:
        current = self._discover_all()
        signature = _signature(current)

        state = txt.read_state()
        extractor_schema_changed = state.get("extractor_schema_revision") != EXTRACTOR_SCHEMA_REVISION
        prev_sources = state.get("sources") if isinstance(state.get("sources"), dict) else {}
        prev_sources_by_id = {
            str(info.get("source_id") or source_id(path)): {"path": path, **info}
            for path, info in prev_sources.items()
            if isinstance(info, dict)
        }

        if (
            not force
            and not extractor_schema_changed
            and state.get("signature") == signature
            and valid_generated_at(state.get("generated_at"))
        ):
            summary = {"unchanged": True, "is_dev_machine": IS_DEV_MACHINE}
            summary.update(state.get("counts") or {})
            THREAD_BUS.signal(_SUMMARY_SIGNAL, summary)
            return summary

        index = txt.read_index()
        edits = txt.read_edits()
        summaries: Dict[str, Dict[str, Any]] = {
            s["id"]: s for s in index.get("sessions") or [] if s.get("id")
        }

        if force or extractor_schema_changed:
            changed_paths = list(current.keys())
        else:
            changed_paths = []
            for path, info in current.items():
                prev = prev_sources_by_id.get(str(info.get("source_id") or ""))
                if not prev or prev.get("mtime") != info["mtime"] or prev.get("bytes") != info["bytes"]:
                    changed_paths.append(path)

        current_source_ids = {
            str(info.get("source_id") or source_id(path))
            for path, info in current.items()
        }
        removed_paths = {
            str(info.get("path") or "")
            for sid, info in prev_sources_by_id.items()
            if sid not in current_source_ids and info.get("path")
        }
        changed_ids: List[str] = []
        removed_ids: List[str] = []
        append_prompts: List[Dict[str, Any]] = []
        new_sources = dict(prev_sources)
        prompts = txt.read_prompts()
        known_prompt_ids = {
            str(p.get("id") or "") for p in prompts if p.get("id")
        }
        new_prompts: List[Dict[str, Any]] = []
        archive_prompts: List[Dict[str, Any]] = []

        for path in removed_paths:
            for sid in prev_sources.get(path, {}).get("session_ids") or []:
                _remove_session_file(sid)
                summaries.pop(sid, None)
                removed_ids.append(sid)
            new_sources.pop(path, None)

        for path in changed_paths:
            info = current[path]
            old_ids = list(prev_sources.get(path, {}).get("session_ids") or [])
            ids: List[str] = []

            for sess in self._parse_source(path, info):
                src_path = sess.get("source_path") or path
                sid = _safe_session_id(sess["tool"], sess["os_user"], sess["raw_id"], src_path)
                detail = dict(sess)
                detail["id"] = sid
                detail["file"] = f"{txt.safe_id(sid)}.txt"
                detail["prompts"] = [
                    p for p in (detail.get("prompts") or [])
                    if not BaseExtractor.is_injected_prompt(p.get("text") or "")
                ]
                detail["prompt_count"] = len(detail["prompts"])
                assign_prompt_ids(detail, sid)
                archive_prompts.extend(
                    {
                        "tool": sess["tool"],
                        "os_user": sess["os_user"],
                        "project": sess.get("project") or "",
                        "session_id": sid,
                        "source": src_path,
                        "ts": p.get("ts") or 0,
                        "text": p.get("text") or "",
                        prompt_archive.ARCHIVE_ROOT_ONLY_FIELD: bool(info.get("spool")),
                    }
                    for p in detail["prompts"]
                )
                apply_edits(detail["prompts"], edits)
                txt.write_session(sid, detail)
                summaries[sid] = session_summary(detail)

                for p in detail["prompts"]:
                    entry = prompt_entry(p, sess, sid)
                    append_prompts.append(entry)
                    if entry["id"] not in known_prompt_ids:
                        known_prompt_ids.add(entry["id"])
                        new_prompts.append(entry)
                ids.append(sid)
                changed_ids.append(sid)

            for gone in set(old_ids) - set(ids):
                _remove_session_file(gone)
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
        prompts = [p for p in prompts if p.get("session_id") not in drop]
        prompts.extend(append_prompts)
        prompts.sort(key=lambda p: p.get("ts") or 0, reverse=True)
        sessions = sorted(summaries.values(), key=lambda s: s.get("started_ts") or 0, reverse=True)
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
            "is_dev_machine": IS_DEV_MACHINE,
            "generated_at": generated_at,
            "tools": tools,
            "users": users,
            "langs": langs,
            "sessions": sessions,
        })
        txt.write_prompts(prompts)
        txt.write_state({
            "is_dev_machine": IS_DEV_MACHINE,
            "generated_at": generated_at,
            "signature": signature,
            "extractor_schema_revision": EXTRACTOR_SCHEMA_REVISION,
            "sources": new_sources,
            "counts": counts,
        })

        summary = {"is_dev_machine": IS_DEV_MACHINE, "changed": len(changed_paths), "removed": len(removed_paths)}
        summary.update(counts)
        THREAD_BUS.signal(_SUMMARY_SIGNAL, summary)
        THREAD_BUS.trigger_event(
            BusSignals.AGENT_HISTORY_SESSIONS_CHANGED,
            {"generated_at": generated_at, **summary},
            async_mode=True,
        )
        _archive_prompts(archive_prompts)
        # A schema rebuild re-derives every id: it is a new baseline, not news.
        if not extractor_schema_changed:
            _emit_prompt_new(new_prompts, generated_at)
        return summary

    def status(self) -> Dict[str, Any]:
        return {
            "last": THREAD_BUS.get_signal(_SUMMARY_SIGNAL, {}) or {},
            "unreadable_homes": root_spool.uncovered_unreadable_homes(),
            "root_spool": root_spool.spool_status(),
            "supported_tools": list(EXTRACTOR_TOOLS),
        }

    def test_extract(self, tool: str) -> Dict[str, Any]:
        """Parse the newest source of one tool and return its latest prompt.

        Read-only probe for the UI checkbox flow — never writes the txt
        store, never touches extract state.
        """
        key = str(tool or "").strip().lower()
        source_revision = agent_history_statistics.source_revisions().get(key) or {}
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

        sources_by_path: Dict[str, Dict[str, Any]] = {}
        for home, user in scan_user_homes().items():
            for d in extractor.discover(home, user):
                sources_by_path[str(d.get("path") or "")] = {**d, "user": user}
        sources = list(sources_by_path.values())
        if not sources:
            return {"ok": False, "tool": key, "error": "no history source found", "sources": 0}

        sources.sort(key=lambda d: float(d.get("mtime") or 0), reverse=True)
        inline_sources = [
            source
            for source in sources
            if int(source.get("bytes") or 0) <= EXTRACT_PROBE_MAX_BYTES
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
            except (OSError, ValueError) as exc:
                ColorPrint.yellow(f"[AgentHistory] Probe parse failed tool={key} path={src['path']}: {exc}")
                last_error = str(exc)
                continue
            prompts = [
                p
                for sess in sessions or []
                for p in sess.get("prompts") or []
                if p.get("text")
            ]
            if prompts:
                latest = newest_prompts_first(prompts)[0]
                return {
                    "ok": True,
                    "tool": key,
                    "sources": len(sources),
                    "prompt": {
                        "ts": int(latest.get("ts") or 0),
                        "text": str(latest.get("text") or "")[:EXTRACT_PROBE_TEXT_CAP],
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


agent_history_service = AgentHistoryService()
