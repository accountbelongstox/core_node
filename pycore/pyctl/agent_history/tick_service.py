# -*- coding: utf-8 -*-
"""PyHeartbeat tick service for serialized extraction and single-flight articles."""

from __future__ import annotations

import os
import threading
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method, start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyctl.agent_history.agent_history_service import agent_history_service
from pycore.pyctl.agent_history.pipeline.worker import tick_pipeline as pipeline_tick

DEFAULT_INTERVAL = int(os.environ.get("PYCORE_AGENT_HISTORY_INTERVAL", "10"))
EXTRACT_INTERVAL = int(os.environ.get("PYCORE_AGENT_HISTORY_EXTRACT_INTERVAL", str(DEFAULT_INTERVAL)))
PIPELINE_INTERVAL = int(os.environ.get("PYCORE_AGENT_HISTORY_PIPELINE_INTERVAL", str(DEFAULT_INTERVAL)))

CALLBACK_EXTRACT = "agent_history_extraction"
CALLBACK_PIPELINE = "agent_history_pipeline"


class _ExtractGate:
    """Serialized extract pass — must not share a lock with the article pipeline."""

    def __init__(self, owner: "AgentHistoryTickService") -> None:
        self._owner = owner
        init_serialized_owner(
            self,
            "agent_history.extract",
            "AgentHistoryExtract",
            timeout=300.0,
        )

    @serialized_method
    def run(self, force: bool = False) -> None:
        self._owner._run_extract(force)


class AgentHistoryTickService:
    """Singleton: extract and pipeline heartbeats with a lock-free status snapshot."""

    def __init__(self) -> None:
        self._extract_count = 0
        self._pipeline_count = 0
        self._last_summary: Dict[str, Any] = {}
        # Coordinates heartbeat extraction with UI-requested extraction.
        self._extract_busy = threading.Event()
        # Snapshot for UI polls — plain attribute reads, never waits on extract/pipeline.
        self._snapshot: Dict[str, Any] = {
            "tick_count": 0,
            "extract_count": 0,
            "pipeline_count": 0,
            "last": {},
            "interval": DEFAULT_INTERVAL,
            "extract_interval": EXTRACT_INTERVAL,
            "pipeline_interval": PIPELINE_INTERVAL,
        }
        self._extract_gate = _ExtractGate(self)

    def _publish_snapshot(self) -> None:
        self._snapshot = {
            "tick_count": int(self._extract_count) + int(self._pipeline_count),
            "extract_count": int(self._extract_count),
            "pipeline_count": int(self._pipeline_count),
            "last": dict(self._last_summary) if isinstance(self._last_summary, dict) else {},
            "interval": DEFAULT_INTERVAL,
            "extract_interval": EXTRACT_INTERVAL,
            "pipeline_interval": PIPELINE_INTERVAL,
        }

    def get_status_snapshot(self) -> Dict[str, Any]:
        """Lock-free status for article_logs / UI (never blocks on extract/pipeline)."""
        snap = self._snapshot
        return dict(snap) if isinstance(snap, dict) else {
            "tick_count": 0,
            "extract_count": 0,
            "pipeline_count": 0,
            "last": {},
            "interval": DEFAULT_INTERVAL,
        }

    def tick_extract(self) -> None:
        """Heartbeat: incremental history extract only (skipped while busy)."""
        if self._extract_busy.is_set():
            return
        self._extract_busy.set()
        try:
            self._extract_gate.run()
        finally:
            self._extract_busy.clear()

    def request_extract(self, force: bool = True) -> Dict[str, Any]:
        """Queue a UI-requested extraction without blocking the HTTP request."""
        if self._extract_busy.is_set():
            return {"queued": False, "busy": True}
        self._extract_busy.set()
        start_bus_task(
            self._run_requested_extract,
            force,
            thread_name="AgentHistoryRefreshThread",
        )
        return {"queued": True, "busy": False}

    def _run_requested_extract(self, force: bool) -> None:
        try:
            self._extract_gate.run(force)
        finally:
            self._extract_busy.clear()

    def tick_pipeline(self) -> None:
        """Heartbeat: run one article stage on the callback's single-flight thread."""
        self._run_pipeline()

    def tick(self) -> None:
        """Compatibility: run serialized extraction then the article pipeline."""
        self.tick_extract()
        self.tick_pipeline()

    def _run_extract(self, force: bool = False) -> None:
        self._extract_count += 1
        try:
            result = agent_history_service.extract(force=force)
            self._last_summary = result if isinstance(result, dict) else {}
            if result.get("changed"):
                ColorPrint.gray(
                    f"[AgentHistory] updated: {result.get('changed')} sources, "
                    f"{result.get('sessions', '?')} sessions, {result.get('prompts', '?')} prompts"
                )
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[AgentHistory] extract tick error: {e}")
        finally:
            self._publish_snapshot()

    def _run_pipeline(self) -> None:
        self._pipeline_count += 1
        try:
            pipeline_tick()
        except Exception as art_err:  # noqa: BLE001
            ColorPrint.yellow(f"[AgentHistoryArticle] pipeline tick error: {art_err}")
        finally:
            self._publish_snapshot()


agent_history_tick_service = AgentHistoryTickService()
