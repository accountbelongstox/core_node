# -*- coding: utf-8 -*-
"""PyHeartbeat tick service — continuously extracts local AI agent history."""

from __future__ import annotations

import os
import threading
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.agent_history import get_agent_history_service

DEFAULT_INTERVAL = int(os.environ.get("PYCORE_AGENT_HISTORY_INTERVAL", "10"))


class AgentHistoryTickService:
    """Singleton: one incremental extraction pass per heartbeat tick."""

    def __init__(self) -> None:
        self._tick_count = 0
        self._last_summary: Dict[str, Any] = {}

    def tick(self) -> None:
        self._tick_count += 1
        try:
            result = get_agent_history_service().extract(force=False)
            self._last_summary = result
            if result.get("changed"):
                ColorPrint.gray(
                    f"[AgentHistory] updated: {result.get('changed')} sources, "
                    f"{result.get('sessions', '?')} sessions, {result.get('prompts', '?')} prompts"
                )
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[AgentHistory] tick error: {e}")

    def get_status(self) -> Dict[str, Any]:
        return {"tick_count": self._tick_count, "last": self._last_summary, "interval": DEFAULT_INTERVAL}


_service: Optional[AgentHistoryTickService] = None
_lock = threading.Lock()


def get_agent_history_tick_service() -> AgentHistoryTickService:
    global _service
    if _service is None:
        with _lock:
            if _service is None:
                _service = AgentHistoryTickService()
    return _service
