# -*- coding: utf-8 -*-
"""
Local AI agent history extractor - pycore twin of Laravel DeveloperHistoryService.

Incrementally parses the prompt sources declared in ``sources.tool_specs``
(discovered by ``source_scan``); a pass writes only the changed sessions:
their transcripts to ``sessions/<id>.txt`` and their index rows, prompts and
source state to the SQLite store (``agent_history_index``) in one commit
(reads live in ``agent_history_store``). Every scanned prompt is archived in the prompt
record store; genuinely new prompts are announced by ``prompt_events``.
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Optional, Tuple

import pycore.pyctl.agent_history.agent_history_txt as txt
import pycore.pyctl.agent_history.root_spool as root_spool
import pycore.pyctl.agent_history.source_scan as source_scan
from pycore.pyctl.agent_history.agent_history_index import (
    META_GENERATED_AT,
    META_SCHEMA_REVISION,
    META_SIGNATURE,
    agent_history_index,
)
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
from pycore.pyutils.common.status_snapshot_cache import status_snapshot_cache

# Bumped whenever parsed output may change; a bump re-parses every source as
# a new baseline (no prompt-new events).
EXTRACTOR_SCHEMA_REVISION = "2026-10-01.3"
EXTRACT_TIMEOUT_S = 3600.0
LIVE_SCAN_TIMEOUT_S = 600.0
HOME_COVERAGE_TTL_S = 30.0
HOME_COVERAGE_CACHE_KEY = "agent_history.home_coverage"
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
    """Working set of one extract pass: only the changed sessions and sources."""

    def __init__(self, prev_sources: Dict[str, Any]) -> None:
        self.edits = txt.read_edits()
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.new_sources = dict(prev_sources)
        self.removed_paths: List[str] = []
        self.changed_ids: List[str] = []
        self.removed_ids: List[str] = []
        self.append_prompts: List[Dict[str, Any]] = []
        self.new_prompts: List[Dict[str, Any]] = []
        self.archive_prompts: List[Dict[str, Any]] = []

    def drop_sessions(self, session_ids: List[str]) -> None:
        for sid in session_ids:
            _remove_session_file(sid)
            self.sessions.pop(sid, None)
            self.removed_ids.append(sid)

    def drop_source(self, path: str, session_ids: List[str]) -> None:
        self.drop_sessions(session_ids)
        self.new_sources.pop(path, None)
        self.removed_paths.append(path)

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
            self.sessions[sid] = session_summary(detail)
            self.append_prompts.extend(prompt_entry(p, sess, sid) for p in detail["prompts"])
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

    def _collect_new_prompts(self) -> None:
        """New = ids the store has never held (checked before this commit), once per pass."""
        known = agent_history_index.existing_prompt_ids(
            [str(p.get("id") or "") for p in self.append_prompts if p.get("id")]
        )
        for entry in self.append_prompts:
            pid = str(entry.get("id") or "")
            if not pid or pid in known or not str(entry.get("text") or "").strip():
                continue
            known.add(pid)
            self.new_prompts.append(entry)

    def write(self, generated_at: str, signature: str, changed_paths: List[str]) -> Dict[str, Any]:
        self._collect_new_prompts()
        return agent_history_index.commit_pass(
            self.changed_ids + self.removed_ids,
            list(self.sessions.values()),
            self.append_prompts,
            self.removed_paths,
            {path: self.new_sources[path] for path in changed_paths if path in self.new_sources},
            {
                META_GENERATED_AT: generated_at,
                META_SIGNATURE: signature,
                META_SCHEMA_REVISION: EXTRACTOR_SCHEMA_REVISION,
            },
        )


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
        state = agent_history_index.state()
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
            work.drop_source(path, list(prev_sources.get(path, {}).get("session_ids") or []))
        for path in changed_paths:
            work.ingest(path, current[path], list(prev_sources.get(path, {}).get("session_ids") or []))
        counts = work.write(generated_at, signature, changed_paths)

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

    @staticmethod
    def home_coverage() -> Dict[str, Any]:
        """Unreadable homes and root-spool state, refreshed at most every HOME_COVERAGE_TTL_S."""
        return status_snapshot_cache.get(
            HOME_COVERAGE_CACHE_KEY,
            lambda: {
                "unreadable_homes": root_spool.uncovered_unreadable_homes(),
                "root_spool": root_spool.spool_status(),
            },
            ttl_seconds=HOME_COVERAGE_TTL_S,
        )

    def status(self) -> Dict[str, Any]:
        return {
            "last": THREAD_BUS.get_signal(_SUMMARY_SIGNAL, {}) or {},
            **self.home_coverage(),
            "supported_tools": list(source_registry.tools),
        }


agent_history_service = AgentHistoryService()
