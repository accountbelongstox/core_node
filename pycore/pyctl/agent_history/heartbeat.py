# -*- coding: utf-8 -*-
"""
PyHeartbeat registration for agent-history extract + article pipeline.

Two callbacks on separate serialized locks so a long extract never blocks
article_logs / pipeline / UI polls.
"""

import os

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.agent_history.tick_service import (
    CALLBACK_EXTRACT,
    CALLBACK_PIPELINE,
    EXTRACT_INTERVAL,
    PIPELINE_INTERVAL,
    agent_history_tick_service,
)


def _config_enabled() -> bool:
    config = user_data_store.get_section("agent_history_article") or {}
    env_enabled = os.environ.get("PYCORE_AGENT_HISTORY_ENABLED")
    if env_enabled is None:
        return bool(config.get("enabled", False))
    return env_enabled.strip().lower() not in ("0", "false", "no")


def set_agent_history_callbacks_enabled(pipeline_enabled: bool) -> None:
    """Toggle article processing without stopping continuous TXT extraction."""
    heartbeat = shared_heartbeat_system
    heartbeat.enable_callback(CALLBACK_EXTRACT)
    if pipeline_enabled:
        heartbeat.enable_callback(CALLBACK_PIPELINE)
    else:
        heartbeat.disable_callback(CALLBACK_PIPELINE)


def register_agent_history_extraction() -> None:
    """
    Register extract + pipeline callbacks (idempotent).

    - agent_history_extraction: scan/update txt store (default 10s)
    - agent_history_pipeline: OpenRouter CN/EN + local TTS one batch (default 10s)
    """
    heartbeat = shared_heartbeat_system
    service = agent_history_tick_service
    pipeline_on = _config_enabled()
    extract_on = True

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
