# -*- coding: utf-8 -*-
"""
PyHeartbeat registration for the agent-history extraction callback.

Shared by callmodule_main (native_ui path) and event_handlers
(pycore_module_caller path) — mirrors heartbeat_tts_workers.py.
"""

import os

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.user_data_store import get_user_data_store
from pycore.pyheartbeat import get_heartbeat_system
from pycore.callmodule.services.agent_history_tick_service import (
    get_agent_history_tick_service,
)


def register_agent_history_extraction() -> None:
    """
    Register the local AI agent history extractor to PyHeartbeat (idempotent).

    Architecture:
    - Callback name: 'agent_history_extraction'
    - Interval: PYCORE_AGENT_HISTORY_INTERVAL env (default 10s)
    - Initial state: persisted Agent History Auto setting
    - Store: <cache>/pycore/.ai_state/agent_history/*.txt
    - Control: POST /api/heartbeat/enable|disable/agent_history_extraction
    """
    heartbeat = get_heartbeat_system()
    service = get_agent_history_tick_service()
    interval = int(os.environ.get("PYCORE_AGENT_HISTORY_INTERVAL", "10"))
    config = get_user_data_store().get_section("agent_history_article") or {}
    env_enabled = os.environ.get("PYCORE_AGENT_HISTORY_ENABLED")
    enabled = bool(config.get("enabled", False)) if env_enabled is None else (
        env_enabled.strip().lower() not in ("0", "false", "no")
    )

    heartbeat.register_callback(
        name='agent_history_extraction',
        callback=service.tick,
        interval=interval,
        enabled=enabled,
    )

    ColorPrint.green("[Callmodule] Registered agent history extraction callback")
    ColorPrint.blue("  - Callback name: agent_history_extraction")
    ColorPrint.blue(f"  - Interval: {interval} seconds")
    ColorPrint.blue(f"  - Initial state: {'enabled' if enabled else 'disabled'}")
    ColorPrint.blue("  - Control: POST /api/heartbeat/disable/agent_history_extraction")
