# -*- coding: utf-8 -*-
"""PyHeartbeat tick service — continuously extracts local AI agent history."""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyctl.agent_history.agent_history_service import get_agent_history_service
from pycore.callmodule.services.agent_history_article_service import get_agent_history_article_service

DEFAULT_INTERVAL = int(os.environ.get("PYCORE_AGENT_HISTORY_INTERVAL", "10"))


class AgentHistoryTickService:
    """Singleton: one incremental extraction pass per heartbeat tick."""

    def __init__(self) -> None:
        self._tick_count = 0
        self._last_summary: Dict[str, Any] = {}
        init_serialized_owner(
            self,
            "agent_history_tick.state",
            "AgentHistoryTickState",
            timeout=300.0,
        )

    @serialized_method
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
            try:
                published = get_agent_history_article_service().tick_pipeline()
                if published:
                    mode = "live" if published.get("live") else "backfill"
                    THREAD_BUS.trigger_event("article.published", published)
                    ColorPrint.gray(
                        f"[AgentHistoryArticle] {mode} article published: "
                        f"{published.get('title_en') or published.get('article_id')}"
                    )
            except Exception as art_err:  # noqa: BLE001
                ColorPrint.yellow(f"[AgentHistoryArticle] pipeline tick error: {art_err}")
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(f"[AgentHistory] tick error: {e}")

    @serialized_method
    def get_status(self) -> Dict[str, Any]:
        return {"tick_count": self._tick_count, "last": self._last_summary, "interval": DEFAULT_INTERVAL}


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
