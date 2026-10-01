# -*- coding: utf-8 -*-
"""
Local AI agent history extractor - pycore twin of Laravel DeveloperHistoryService.

Incrementally parses the prompt sources declared in ``sources.tool_specs``
(discovered by ``source_scan``) and persists sessions and prompts to the txt
store under ``<cache>/pycore/.ai_state/agent_history/`` (reads live in
``agent_history_store``). Every scanned prompt is archived in the prompt
record store; genuinely new prompts are announced by ``prompt_events``.
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Optional, Tuple

import pycore.pyctl.agent_history.agent_history_txt as txt
import pycore.pyctl.agent_history.root_spool as root_spool
import pycore.pyctl.agent_history.source_scan as source_scan
from pycore.pyctl.agent_history.agent_history_records import (
    IS_DEV_MACHINE,
    apply_edits,
    assign_prompt_ids,
    local_time_text,
    prompt_entry,
    source_id,
)
from pycore.pyctl.agent_history.agent_history_statistics import valid_generated_at
from pycore.pyctl.agent_history.prompt_events import emit_prompt_new
from pycore.pyctl.agent_history.prompt_records import prompt_records
from pycore.pyctl.agent_history.snapshot_cache import session_summary
from pycore.pyctl.agent_history.sources.source_kit import is_injected_prompt
from pycore.pyctl.agent_history.sources.source_registry import source_registry
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, call_serialized
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals

# Bumped whenever parsed output may change; a bump re-parses every source as
# a new baseline (no prompt-new events).
EXTRACTOR_SCHEMA_REVISION = "2026-10-01.3"
EXTRACT_TIMEOUT_S = 3600.0
LIVE_SCAN_TIMEOUT_S = 600.0
_EXTRACT_QUEUE = 'pyctl.agent_history.extract'
_SUMMARY_SIGNAL = 'pyctl.agent_history.summary'
_EXTRACT_WORKER = SerializedWorkerThread(_EXTRACT_QUEUE, 'AgentHistoryExtractThread')
_EXTRACT_WORKER.start()


def _safe_session_id(tool: str, user: str, raw_id: str, src_path: str) -> str:
    base = txt.safe_id(f"{tool}__{user}__{raw_id}")
    suffix = hashlib.md5(f"{src_path}|{raw_id}".encode()).hexdigest()[:8]
    return f"{base}-{suffix}"


def _remove_session_file(session_id: str) -> None:
    path = txt.sessions_dir() / f"{txt.safe_id(session_id)}.txt"
    try:
        path.unlink(missing_ok=True)
    except OSError as exc:
        ColorPrint.yellow(f"[AgentHistory] Session file remove failed path={path}: {exc}")


class _ExtractPass:
    """Mutable working set of one extract pass over the txt store."""

    def __init__(self, prev_sources: Dict[str, Any]) -> None:
        index = txt.read_index()
        self.edits = txt.read_edits()
        self.summaries: Dict[str, Dict[str, Any]] = {
            s["id"]: s for s in index.get("sessions") or [] if s.get("id")
        }
        self.prompts = txt.read_prompts()
        self.known_prompt_ids = {str(p.get("id") or "") for p in self.prompts if p.get("id")}
        self.new_sources = dict(prev_sources)
        self.changed_ids: List[str] = []
        self.removed_ids: List[str] = []
        self.append_prompts: List[Dict[str, Any]] = []
        self.new_prompts: List[Dict[str, Any]] = []
        self.archive_prompts: List[Dict[str, Any]] = []

    def drop_sessions(self, session_ids: List[str]) -> None:
        for sid in session_ids:
            _remove_session_file(sid)
            self.summaries.pop(sid, None)
            self.removed_ids.append(sid)

    def ingest(self, path: str, info: Dict[str, Any], old_ids: List[str]) -> None:
        ids: List[str] = []
        for sess in source_scan.parse_source(path, info):
            src_path = sess.get("source_path") or path
            sid = _safe_session_id(sess["tool"], sess["os_user"], sess["raw_id"], src_path)
            detail = dict(sess)
            detail["id"] = sid
            detail["file"] = f"{txt.safe_id(sid)}.txt"
            detail["prompts"] = [
                p for p in (detail.get("prompts") or [])
                if not is_injected_prompt(p.get("text") or "")
            ]
            detail["prompt_count"] = len(detail["prompts"])
            assign_prompt_ids(detail, sid)
            self.archive_prompts.extend(
                {
                    "tool": sess["tool"],
                    "os_user": sess["os_user"],
                    "project": sess.get("project") or "",
                    "session_id": sid,
                    "source": src_path,
                    "ts": p.get("ts") or 0,
                    "text": p.get("text") or "",
                }
                for p in detail["prompts"]
            )
            apply_edits(detail["prompts"], self.edits)
            txt.write_session(sid, detail)
            self.summaries[sid] = session_summary(detail)
            for p in detail["prompts"]:
                entry = prompt_entry(p, sess, sid)
                self.append_prompts.append(entry)
                if entry["id"] not in self.known_prompt_ids:
                    self.known_prompt_ids.add(entry["id"])
                    self.new_prompts.append(entry)
            ids.append(sid)
            self.changed_ids.append(sid)
        self.drop_sessions(sorted(set(old_ids) - set(ids)))
        self.new_sources[path] = {
            "source_id": info["source_id"],
            "mtime": info["mtime"],
            "bytes": info["bytes"],
            "tool": info["tool"],
            "source": info["source"],
            "format": info["format"],
            "user": info["user"],
            "session_ids": ids,
        }

    def write(self, generated_at: str, signature: str) -> Dict[str, Any]:
        drop = set(self.changed_ids + self.removed_ids)
        prompts = [p for p in self.prompts if p.get("session_id") not in drop]
        prompts.extend(self.append_prompts)
        prompts.sort(key=lambda p: p.get("ts") or 0, reverse=True)
        sessions = sorted(self.summaries.values(), key=lambda s: s.get("started_ts") or 0, reverse=True)
        tools = sorted({s.get("tool") for s in sessions if s.get("tool")})
        users = sorted({s.get("os_user") for s in sessions if s.get("os_user")})
        counts = {"sessions": len(sessions), "prompts": len(prompts), "tools": len(tools), "users": len(users)}
        txt.write_index({
            "is_dev_machine": IS_DEV_MACHINE,
            "generated_at": generated_at,
            "tools": tools,
            "users": users,
            "langs": sorted({p.get("lang") for p in prompts if p.get("lang")}),
            "sessions": sessions,
        })
        txt.write_prompts(prompts)
        txt.write_state({
            "is_dev_machine": IS_DEV_MACHINE,
            "generated_at": generated_at,
            "signature": signature,
            "extractor_schema_revision": EXTRACTOR_SCHEMA_REVISION,
            "sources": self.new_sources,
            "counts": counts,
        })
        return counts


def _source_changes(
    current: Dict[str, Dict[str, Any]],
    prev_sources: Dict[str, Any],
    full: bool,
) -> Tuple[List[str], set]:
    """(changed current paths, removed previous paths), matched by source id."""
    prev_by_id = {
        str(info.get("source_id") or source_id(path)): {"path": path, **info}
        for path, info in prev_sources.items()
        if isinstance(info, dict)
    }
    if full:
        changed = list(current.keys())
    else:
        changed = []
        for path, info in current.items():
            prev = prev_by_id.get(str(info.get("source_id") or ""))
            if not prev or prev.get("mtime") != info["mtime"] or prev.get("bytes") != info["bytes"]:
                changed.append(path)
    current_ids = {str(info.get("source_id") or source_id(path)) for path, info in current.items()}
    removed = {
        str(info.get("path") or "")
        for sid, info in prev_by_id.items()
        if sid not in current_ids and info.get("path")
    }
    return changed, removed


class AgentHistoryService:
    """Incremental extractor writing the agent-history txt store."""

    def __init__(self) -> None:
        # Per-tool source descriptor maps for the live-scan skip cache;
        # mutated only inside the serialized extract queue.
        self._live_scan_descriptors: Dict[str, Dict[str, str]] = {}

    def extract(self, force: bool = False) -> Dict[str, Any]:
        return call_serialized(_EXTRACT_QUEUE, self._extract_inner, force, timeout=EXTRACT_TIMEOUT_S)

    def live_scan(self, tools: Optional[List[str]] = None) -> Dict[str, Any]:
        """UI-driven realtime scan (shares the extract serialization queue)."""
        return call_serialized(_EXTRACT_QUEUE, self._live_scan_inner, tools, timeout=LIVE_SCAN_TIMEOUT_S)

    def _live_scan_baseline(self, tool: str) -> Dict[str, str]:
        """Skip-cache baseline for one tool, seeded from persisted state on first use."""
        baseline = self._live_scan_descriptors.get(tool)
        if baseline is None:
            baseline = source_scan.state_tool_descriptors(tool)
            self._live_scan_descriptors[tool] = baseline
        return baseline

    def _live_scan_inner(self, tools: Optional[List[str]]) -> Dict[str, Any]:
        supported_set = set(source_registry.tools)
        requested = [
            str(tool).strip().lower()
            for tool in (tools or sorted(supported_set))
            if str(tool).strip()
        ]
        supported = [tool for tool in requested if tool in supported_set]
        unsupported = [tool for tool in requested if tool not in supported_set]
        homes = source_scan.live_scan_homes(supported)
        spooled = root_spool.read_sources()
        changed_tools: List[str] = []
        skipped_tools: List[str] = []
        pending_descriptors: Dict[str, Dict[str, str]] = {}
        for tool in supported:
            descriptors = source_scan.tool_descriptors(tool, homes, spooled)
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
        current = source_scan.scan_sources()
        signature = source_scan.signature(current)
        state = txt.read_state()
        schema_changed = state.get("extractor_schema_revision") != EXTRACTOR_SCHEMA_REVISION
        prev_sources = state.get("sources") if isinstance(state.get("sources"), dict) else {}

        if (
            not force
            and not schema_changed
            and state.get("signature") == signature
            and valid_generated_at(state.get("generated_at"))
        ):
            summary = {"unchanged": True, "is_dev_machine": IS_DEV_MACHINE}
            summary.update(state.get("counts") or {})
            THREAD_BUS.signal(_SUMMARY_SIGNAL, summary)
            return summary

        changed_paths, removed_paths = _source_changes(current, prev_sources, force or schema_changed)
        work = _ExtractPass(prev_sources)
        for path in removed_paths:
            work.drop_sessions(list(prev_sources.get(path, {}).get("session_ids") or []))
            work.new_sources.pop(path, None)
        for path in changed_paths:
            work.ingest(path, current[path], list(prev_sources.get(path, {}).get("session_ids") or []))
        counts = work.write(generated_at, signature)

        summary = {"is_dev_machine": IS_DEV_MACHINE, "changed": len(changed_paths), "removed": len(removed_paths)}
        summary.update(counts)
        THREAD_BUS.signal(_SUMMARY_SIGNAL, summary)
        THREAD_BUS.trigger_event(
            BusSignals.AGENT_HISTORY_SESSIONS_CHANGED,
            {"generated_at": generated_at, **summary},
            async_mode=True,
        )
        prompt_records.archive(work.archive_prompts)
        # A schema rebuild re-derives every id: it is a new baseline, not news.
        if not schema_changed:
            emit_prompt_new(work.new_prompts, generated_at)
        return summary

    def status(self) -> Dict[str, Any]:
        return {
            "last": THREAD_BUS.get_signal(_SUMMARY_SIGNAL, {}) or {},
            "unreadable_homes": root_spool.uncovered_unreadable_homes(),
            "root_spool": root_spool.spool_status(),
            "supported_tools": list(source_registry.tools),
        }


agent_history_service = AgentHistoryService()
