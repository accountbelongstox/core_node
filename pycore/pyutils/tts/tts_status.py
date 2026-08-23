# -*- coding: utf-8 -*-
"""TTS engine capability and cached runtime status queries."""

from __future__ import annotations

import importlib.metadata
from typing import Any, Dict, List, Optional

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
from pycore.pyutils.tts.tts_engine_probe import (
    engine_installed,
    engine_unavailable_reason,
)
from pycore.pyutils.tts.tts_service_manager import (
    is_server_engine,
    server_runtime_status,
)
import pycore.pyutils.tts.qwen.engine as qwen_engine
import pycore.pyutils.tts.streamelements_engine as streamelements_engine


TTS_ENGINE_STATUS_TTL_SECONDS = 300.0


def _dist_version(distribution: str) -> Optional[str]:
    try:
        return importlib.metadata.version(distribution)
    except Exception:
        return None


def engine_available(name: str) -> bool:
    adapter = tts_engine_registry.get(name)
    return bool(adapter and adapter.available())


def engine_concurrency(name: str) -> str:
    adapter = tts_engine_registry.get(name)
    return adapter.concurrency if adapter else "serial"


def engine_model_id(engine: str) -> str:
    name = str(engine or "").strip().lower()
    adapter = tts_engine_registry.get(name)
    if adapter is None or not adapter.tiered:
        return ""
    if name == "qwen3tts":
        return qwen_engine.active_model_id()
    return runtime_engine_model(name)


def engine_chunked(engine: str) -> bool:
    return str(engine or "").strip().lower() == "qwen3tts"


def _engine_disabled_reason(
    name: str,
    available: Optional[bool] = None,
) -> Optional[str]:
    is_available = engine_available(name) if available is None else available
    if is_available:
        return None
    return engine_unavailable_reason(name)


def best_engine() -> Optional[str]:
    for name in configured_tts_priority():
        if engine_available(name):
            return name
    return None


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
    installed = engine_installed(name)
    managed = is_server_engine(name)
    runtime = server_runtime_status(name, refresh=refresh) if managed else {}
    if refresh:
        available = engine_available(name)
    elif managed:
        available = bool(
            (installed and adapter.config_ready())
            or runtime.get("server_running")
            or runtime.get("model_loaded")
        )
    elif name == "edge":
        available = installed
    else:
        available = engine_available(name)
    entry: Dict[str, Any] = {
        "name": name,
        "available": available,
        "installed": installed,
        "note": adapter.note,
        "concurrency": adapter.concurrency,
        **runtime,
    }
    if adapter.distribution and available:
        entry["version"] = _dist_version(adapter.distribution)
    if adapter.tiered:
        tier_model = runtime_engine_model(name)
        if tier_model:
            entry["model"] = tier_model
    if refresh:
        reason = _engine_disabled_reason(name, available)
        if reason:
            entry["disabled_reason"] = reason
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
    engines: List[Dict[str, Any]] = []
    for index, name in enumerate(configured_tts_priority()):
        entry = _engine_status(name, refresh)
        entry["priority"] = index + 1
        if name == "edge":
            entry["cooldown_remaining"] = edge_cooldown
        if name == "streamelements":
            entry["cooldown_remaining"] = stream_cooldown
        engines.append(entry)
    available = [entry for entry in engines if entry["available"]]
    best = next(
        (entry["name"] for entry in engines if entry["available"]),
        None,
    )
    active = None
    for entry in engines:
        if not entry["available"]:
            continue
        if entry["name"] == "edge" and edge_cooldown > 0:
            continue
        if entry["name"] == "streamelements" and stream_cooldown > 0:
            continue
        active = entry["name"]
        break
    return {
        "success": True,
        "best": best,
        "active": active,
        "edge_cooldown_remaining": edge_cooldown,
        "streamelements_cooldown_remaining": stream_cooldown,
        "available_count": len(available),
        "sentence_priority": list(configured_tts_priority("sentence")),
        "word_priority": list(configured_tts_priority("word")),
        "engines": engines,
    }


__all__ = [
    "best_engine",
    "engine_available",
    "engine_chunked",
    "engine_concurrency",
    "engine_model_id",
    "invalidate_tts_status_cache",
    "tts_status",
]
