# -*- coding: utf-8 -*-
"""
PyHeartbeat registration for the agent-history extraction callback.

Shared by callmodule_main (native_ui path) and event_handlers
(pycore_module_caller path) — mirrors heartbeat_tts_workers.py.
"""

import os

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyheartbeat import get_heartbeat_system
from pycore.callmodule.services import get_agent_history_tick_service


def register_agent_history_extraction() -> None:
    """
    Register the local AI agent history extractor to PyHeartbeat (idempotent).

    Architecture:
    - Callback name: 'agent_history_extraction'
    - Interval: PYCORE_AGENT_HISTORY_INTERVAL env (default 10s)
    - Initial state: ENABLED by default
    - Store: <cache>/pycore/.ai_state/agent_history/*.txt
    - Control: POST /api/heartbeat/enable|disable/agent_history_extraction
    """
    heartbeat = get_heartbeat_system()
    service = get_agent_history_tick_service()
    interval = int(os.environ.get("PYCORE_AGENT_HISTORY_INTERVAL", "10"))
    enabled = os.environ.get("PYCORE_AGENT_HISTORY_ENABLED", "1").strip().lower() not in ("0", "false", "no")

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
