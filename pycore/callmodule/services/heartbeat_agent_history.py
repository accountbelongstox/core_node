# -*- coding: utf-8 -*-
"""
PyHeartbeat registration for agent-history extract + article pipeline.

Two callbacks on separate serialized locks so a long extract never blocks
article_logs / pipeline / UI polls.
"""

import os

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.user_data_store import get_user_data_store
from pycore.pyheartbeat import get_heartbeat_system
from pycore.callmodule.services.agent_history_tick_service import (
    CALLBACK_EXTRACT,
    CALLBACK_PIPELINE,
    EXTRACT_INTERVAL,
    PIPELINE_INTERVAL,
    get_agent_history_tick_service,
)


def _config_enabled() -> bool:
    config = get_user_data_store().get_section("agent_history_article") or {}
    env_enabled = os.environ.get("PYCORE_AGENT_HISTORY_ENABLED")
    if env_enabled is None:
        return bool(config.get("enabled", False))
    return env_enabled.strip().lower() not in ("0", "false", "no")


def set_agent_history_callbacks_enabled(enabled: bool) -> None:
    """Enable or disable both extract and pipeline heartbeats together."""
    heartbeat = get_heartbeat_system()
    if enabled:
        heartbeat.enable_callback(CALLBACK_EXTRACT)
        heartbeat.enable_callback(CALLBACK_PIPELINE)
    else:
        heartbeat.disable_callback(CALLBACK_EXTRACT)
        heartbeat.disable_callback(CALLBACK_PIPELINE)


def register_agent_history_extraction() -> None:
    """
    Register extract + pipeline callbacks (idempotent).

    - agent_history_extraction: scan/update txt store (default 60s)
    - agent_history_pipeline: OpenRouter CN/EN + local TTS one batch (default 10s)
    """
    heartbeat = get_heartbeat_system()
    service = get_agent_history_tick_service()
    enabled = _config_enabled()

    heartbeat.register_callback(
        name=CALLBACK_EXTRACT,
        callback=service.tick_extract,
        interval=EXTRACT_INTERVAL,
        enabled=enabled,
    )
    heartbeat.register_callback(
        name=CALLBACK_PIPELINE,
        callback=service.tick_pipeline,
        interval=PIPELINE_INTERVAL,
        enabled=enabled,
    )

    ColorPrint.green("[Callmodule] Registered agent history extract + pipeline callbacks")
    ColorPrint.blue(f"  - {CALLBACK_EXTRACT}: every {EXTRACT_INTERVAL}s")
    ColorPrint.blue(f"  - {CALLBACK_PIPELINE}: every {PIPELINE_INTERVAL}s")
    ColorPrint.blue(f"  - Initial state: {'enabled' if enabled else 'disabled'}")
