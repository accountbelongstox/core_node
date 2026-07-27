# -*- coding: utf-8 -*-
"""PyHeartbeat tick service — extract and article pipeline on separate locks."""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyctl.agent_history.agent_history_service import get_agent_history_service
from pycore.callmodule.services.agent_history_pipeline.worker import tick_pipeline as pipeline_tick

DEFAULT_INTERVAL = int(os.environ.get("PYCORE_AGENT_HISTORY_INTERVAL", "10"))
EXTRACT_INTERVAL = int(os.environ.get("PYCORE_AGENT_HISTORY_EXTRACT_INTERVAL", "60"))
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
    def run(self) -> None:
        self._owner._run_extract()


class _PipelineGate:
    """Serialized article pipeline pass — independent of extract."""

    def __init__(self, owner: "AgentHistoryTickService") -> None:
        self._owner = owner
        init_serialized_owner(
            self,
            "agent_history.pipeline",
            "AgentHistoryPipeline",
            timeout=300.0,
        )

    @serialized_method
    def run(self) -> None:
        self._owner._run_pipeline()


class AgentHistoryTickService:
    """Singleton: extract and pipeline heartbeats with a lock-free status snapshot."""

    def __init__(self) -> None:
        self._extract_count = 0
        self._pipeline_count = 0
        self._last_summary: Dict[str, Any] = {}
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
        self._pipeline_gate = _PipelineGate(self)

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

    def get_status(self) -> Dict[str, Any]:
        """Public status — same as snapshot (no serialized wait)."""
        return self.get_status_snapshot()

    def tick_extract(self) -> None:
        """Heartbeat: incremental history extract only."""
        self._extract_gate.run()

    def tick_pipeline(self) -> None:
        """Heartbeat: at most one article batch."""
        self._pipeline_gate.run()

    def tick(self) -> None:
        """Compatibility: run extract then pipeline (each on its own lock)."""
        self.tick_extract()
        self.tick_pipeline()

    def _run_extract(self) -> None:
        self._extract_count += 1
        try:
            result = get_agent_history_service().extract(force=False)
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


class _AgentHistoryTickProvider:
    """Create and retain the service on one THREAD_BUS state owner."""

    def __init__(self) -> None:
        self._service: Optional[AgentHistoryTickService] = None
        init_serialized_owner(
            self,
            "agent_history_tick.provider",
            "AgentHistoryTickProvider",
        )

    @serialized_method
    def get(self) -> AgentHistoryTickService:
        if self._service is None:
            self._service = AgentHistoryTickService()
        return self._service


_provider = _AgentHistoryTickProvider()


def get_agent_history_tick_service() -> AgentHistoryTickService:
    return _provider.get()
