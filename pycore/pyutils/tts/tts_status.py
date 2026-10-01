# -*- coding: utf-8 -*-
"""TTS engine capability and cached runtime status queries."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pycore.pyutils.common.coded_message import message_fields
from pycore.pyutils.common.engine_registry import build_engine_panel
from pycore.pyutils.common.model_manifest import CATEGORY_TTS, model_manifest
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_CAPABILITIES_KEY,
    STATUS_SNAPSHOT_TTS_ENGINE_PREFIX,
    STATUS_SNAPSHOT_TTS_KEY,
    status_snapshot_cache,
)
from pycore.pyutils.tts.engine_policy import (
    configured_tts_priority,
    edge_cooldown_remaining,
)
from pycore.pyutils.tts.engine_registry import tts_engine_registry
from pycore.pyutils.tts.qwen.engine import qwen_engine
from pycore.pyutils.tts.streamelements_engine import streamelements_engine
from pycore.pyutils.tts.tts_service_manager import (
    is_server_engine,
    server_runtime_status,
)


TTS_ENGINE_STATUS_TTL_SECONDS = 300.0
DISABLED_REASON_FIELD = "disabled_reason"


def engine_concurrency(name: str) -> str:
    adapter = tts_engine_registry.get(name)
    return adapter.concurrency if adapter else "serial"


def engine_model_id(engine: str) -> str:
    adapter = tts_engine_registry.get(engine)
    if adapter is None or not adapter.tiered:
        return ""
    if adapter is qwen_engine:
        return qwen_engine.active_model_id()
    return runtime_engine_model(adapter.name)


def engine_chunked(engine: str) -> bool:
    entry = model_manifest.get(engine, CATEGORY_TTS)
    return bool(entry and entry.chunk_capable)


def _build_engine_status(name: str, refresh: bool) -> Dict[str, Any]:
    adapter = tts_engine_registry.get(name)
    if adapter is None:
        return {
            "name": name,
            "available": False,
            "installed": False,
            "note": "",
            "concurrency": "serial",
        }
    installed = adapter.installed()
    managed = is_server_engine(name)
    runtime = server_runtime_status(name, refresh=refresh) if managed else {}
    if refresh:
        available = adapter.available()
    elif managed:
        available = bool(
            (installed and adapter.config_ready())
            or runtime.get("server_running")
            or runtime.get("model_loaded")
        )
    elif name == "edge":
        available = installed
    else:
        available = adapter.available()
    entry = adapter.status_row(available)
    entry.update({"installed": installed, "concurrency": adapter.concurrency, **runtime})
    if adapter.tiered:
        tier_model = runtime_engine_model(name)
        if tier_model:
            entry["model"] = tier_model
    if refresh:
        # disabled_reason (English) + disabled_reason_code/_params (localized
        # by the UI) of a coded reason (tts_reason_codes).
        reason = None if available else adapter.unavailable_reason()
        entry.update(message_fields(reason, DISABLED_REASON_FIELD))
    return entry


def _engine_status(name: str, refresh: bool) -> Dict[str, Any]:
    cache_key = f"{STATUS_SNAPSHOT_TTS_ENGINE_PREFIX}{name}"
    return status_snapshot_cache.get(
        cache_key,
        lambda: _build_engine_status(name, refresh),
        refresh=refresh,
        ttl_seconds=TTS_ENGINE_STATUS_TTL_SECONDS,
    )


def invalidate_tts_status_cache(engine: Optional[str] = None) -> None:
    status_snapshot_cache.invalidate(STATUS_SNAPSHOT_TTS_KEY)
    status_snapshot_cache.invalidate(STATUS_SNAPSHOT_CAPABILITIES_KEY)
    if engine:
        status_snapshot_cache.invalidate(
            f"{STATUS_SNAPSHOT_TTS_ENGINE_PREFIX}{engine}"
        )
        return
    status_snapshot_cache.invalidate_prefix(STATUS_SNAPSHOT_TTS_ENGINE_PREFIX)


def tts_status(refresh: bool = False) -> Dict[str, Any]:
    edge_cooldown = edge_cooldown_remaining()
    stream_cooldown = streamelements_engine.cooldown_remaining()
    cooldowns = {"edge": edge_cooldown, "streamelements": stream_cooldown}
    rows: List[Dict[str, Any]] = []
    for name in configured_tts_priority():
        entry = _engine_status(name, refresh)
        if name in cooldowns:
            entry["cooldown_remaining"] = cooldowns[name]
        rows.append(entry)
    active = next(
        (row["name"] for row in rows if row["available"] and not cooldowns.get(row["name"], 0) > 0),
        None,
    )
    panel = build_engine_panel(
        rows,
        edge_cooldown_remaining=edge_cooldown,
        streamelements_cooldown_remaining=stream_cooldown,
        sentence_priority=list(configured_tts_priority("sentence")),
        word_priority=list(configured_tts_priority("word")),
    )
    panel["active"] = active
    return panel


__all__ = [
    "engine_chunked",
    "engine_concurrency",
    "engine_model_id",
    "invalidate_tts_status_cache",
    "tts_status",
]
