# -*- coding: utf-8 -*-
"""
PyHeartbeat registration for agent-history extraction, generation, and upload.

Extraction uses its state owner; the article callback uses heartbeat single-flight
so long local synthesis never queues duplicate runs or blocks UI status reads.
"""

import os

from pycore.pyfoundations.agent_home_scanner import unreadable_user_homes
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.user_data_store import user_data_store
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.agent_history.tick_service import (
    CALLBACK_EXTRACT,
    CALLBACK_LIVE_MONITOR,
    CALLBACK_PIPELINE,
    CALLBACK_UPLOAD,
    EXTRACT_INTERVAL,
    LIVE_SCAN_MIN_INTERVAL,
    PIPELINE_INTERVAL,
    UPLOAD_INTERVAL,
    agent_history_tick_service,
)
from pycore.pyctl.agent_history.video_pipeline import tick_video
from pycore.pyctl.agent_history.pipeline.worker import recover_nonterminal_operations
from pycore.pyfoundations.serialized_worker import start_bus_task

VIDEO_INTERVAL = int(os.environ.get("PYCORE_AGENT_HISTORY_VIDEO_INTERVAL", "2"))
CALLBACK_VIDEO = "agent_history_video"


ENV_PIPELINE_ENABLED = "PYCORE_AGENT_HISTORY_ENABLED"


def pipeline_env_override() -> bool | None:
    """Env override of the pipeline switch (None when not set)."""
    env_enabled = os.environ.get(ENV_PIPELINE_ENABLED)
    if env_enabled is None:
        return None
    return env_enabled.strip().lower() not in ("0", "false", "no")


def _config_enabled() -> bool:
    override = pipeline_env_override()
    if override is not None:
        return override
    config = user_data_store.get_section("agent_history_article") or {}
    return bool(config.get("enabled", False))


def set_agent_history_callbacks_enabled(pipeline_enabled: bool) -> None:
    """Apply independent pipeline and video lanes from persisted config."""
    heartbeat = shared_heartbeat_system
    config = user_data_store.get_section("agent_history_article") or {}
    override = pipeline_env_override()
    if override is not None:
        pipeline_enabled = override
    video_enabled = bool(config.get("video_enabled", False))
    heartbeat.enable_callback(CALLBACK_EXTRACT)
    if pipeline_enabled:
        heartbeat.enable_callback(CALLBACK_PIPELINE)
        heartbeat.enable_callback(CALLBACK_UPLOAD)
    else:
        heartbeat.disable_callback(CALLBACK_PIPELINE)
        heartbeat.disable_callback(CALLBACK_UPLOAD)
    if video_enabled:
        heartbeat.enable_callback(CALLBACK_VIDEO)
    else:
        heartbeat.disable_callback(CALLBACK_VIDEO)


def register_agent_history_extraction() -> None:
    """
    Register extract, pipeline, and upload callbacks (idempotent).

    - agent_history_extraction: scan/update txt store (default 10s)
    - agent_history_pipeline: OpenRouter CN/EN + local TTS one batch (default 10s)
    - agent_history_upload: retry deferred Laravel delivery (default 10s)
    """
    heartbeat = shared_heartbeat_system
    service = agent_history_tick_service
    # Operation recovery scans the state DB (10s+): background, never on the
    # route-registration / server-bind path.
    start_bus_task(recover_nonterminal_operations, thread_name="AgentHistoryOperationRecoveryThread")
    pipeline_on = _config_enabled()
    video_on = bool((user_data_store.get_section("agent_history_article") or {}).get("video_enabled", False))
    extract_on = True

    heartbeat.register_callback(
        name=CALLBACK_EXTRACT,
        callback=service.tick_extract,
        interval=EXTRACT_INTERVAL,
        enabled=extract_on,
    )
    # Realtime monitor lane: self-gates on the persisted live_prompt_monitor
    # switch + UI presence lease; always registered, idle without a UI.
    heartbeat.register_callback(
        name=CALLBACK_LIVE_MONITOR,
        callback=service.tick_live_monitor,
        interval=max(1, int(LIVE_SCAN_MIN_INTERVAL)),
        enabled=True,
    )
    heartbeat.register_callback(
        name=CALLBACK_PIPELINE,
        callback=service.tick_pipeline,
        interval=PIPELINE_INTERVAL,
        enabled=pipeline_on,
    )
    heartbeat.register_callback(
        name=CALLBACK_VIDEO,
        callback=tick_video,
        interval=VIDEO_INTERVAL,
        enabled=video_on,
    )
    heartbeat.register_callback(
        name=CALLBACK_UPLOAD,
        callback=service.tick_upload,
        interval=UPLOAD_INTERVAL,
        enabled=pipeline_on,
    )

    ColorPrint.green("[Callmodule] Registered agent history extract + pipeline + upload + video callbacks")
    ColorPrint.blue(f"  - {CALLBACK_EXTRACT}: every {EXTRACT_INTERVAL}s ({'on' if extract_on else 'off'})")
    ColorPrint.blue(f"  - {CALLBACK_LIVE_MONITOR}: every {int(LIVE_SCAN_MIN_INTERVAL)}s (lease-gated)")
    ColorPrint.blue(f"  - {CALLBACK_PIPELINE}: every {PIPELINE_INTERVAL}s ({'on' if pipeline_on else 'off'})")
    ColorPrint.blue(f"  - {CALLBACK_UPLOAD}: every {UPLOAD_INTERVAL}s ({'on' if pipeline_on else 'off'})")
    ColorPrint.blue(f"  - {CALLBACK_VIDEO}: every {VIDEO_INTERVAL}s ({'on' if video_on else 'off'})")
    unreadable = unreadable_user_homes()
    if unreadable:
        ColorPrint.yellow(
            f"[AgentHistory] homes not readable by this process (prompts there are not scanned): {unreadable}"
        )
