# -*- coding: utf-8 -*-
"""
PyHeartbeat registration for agent-history extract + article pipeline.

Two callbacks on separate serialized locks so a long extract never blocks
article_logs / pipeline / UI polls.
"""

import os
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.database.repositories.user_data_store import get_user_data_store
from pycore.pyheartbeat.heartbeat import get_heartbeat_system
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


def _extract_enabled() -> bool:
    """History extraction runs whenever the pipeline is enabled OR at least
    one tool checkbox is on — checked tools must keep showing fresh prompt
    history even when auto-processing is off."""
    if _config_enabled():
        return True
    config = get_user_data_store().get_section("agent_history_article") or {}
    tools = config.get("enabled_tools")
    return isinstance(tools, list) and len(tools) > 0


def set_agent_history_callbacks_enabled(pipeline_enabled: bool, extract_enabled: Optional[bool] = None) -> None:
    """Toggle heartbeats. Extract and pipeline are decoupled: prompt history
    keeps updating for checked tools even when auto-processing is off."""
    heartbeat = get_heartbeat_system()
    if extract_enabled is None:
        extract_enabled = pipeline_enabled or _extract_enabled()
    if extract_enabled:
        heartbeat.enable_callback(CALLBACK_EXTRACT)
    else:
        heartbeat.disable_callback(CALLBACK_EXTRACT)
    if pipeline_enabled:
        heartbeat.enable_callback(CALLBACK_PIPELINE)
    else:
        heartbeat.disable_callback(CALLBACK_PIPELINE)


def register_agent_history_extraction() -> None:
    """
    Register extract + pipeline callbacks (idempotent).

    - agent_history_extraction: scan/update txt store (default 60s)
    - agent_history_pipeline: OpenRouter CN/EN + local TTS one batch (default 10s)
    """
    heartbeat = get_heartbeat_system()
    service = get_agent_history_tick_service()
    pipeline_on = _config_enabled()
    extract_on = pipeline_on or _extract_enabled()

    heartbeat.register_callback(
        name=CALLBACK_EXTRACT,
        callback=service.tick_extract,
        interval=EXTRACT_INTERVAL,
        enabled=extract_on,
    )
    heartbeat.register_callback(
        name=CALLBACK_PIPELINE,
        callback=service.tick_pipeline,
        interval=PIPELINE_INTERVAL,
        enabled=pipeline_on,
    )

    ColorPrint.green("[Callmodule] Registered agent history extract + pipeline callbacks")
    ColorPrint.blue(f"  - {CALLBACK_EXTRACT}: every {EXTRACT_INTERVAL}s ({'on' if extract_on else 'off'})")
    ColorPrint.blue(f"  - {CALLBACK_PIPELINE}: every {PIPELINE_INTERVAL}s ({'on' if pipeline_on else 'off'})")
