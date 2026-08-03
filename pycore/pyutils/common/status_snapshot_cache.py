# -*- coding: utf-8 -*-
"""Shared bounded-TTL cache for local status snapshots."""

from __future__ import annotations

import copy
import time
from typing import Any, Callable, Dict, Optional, Set, Tuple

from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS


STATUS_SNAPSHOT_TTL_SECONDS = 30.0
STATUS_SNAPSHOT_RESOURCES_TTL_SECONDS = 1.0
STATUS_SNAPSHOT_STT_KEY = "stt"
STATUS_SNAPSHOT_OCR_KEY = "ocr"
STATUS_SNAPSHOT_TTS_KEY = "tts"
STATUS_SNAPSHOT_TTS_ENGINE_PREFIX = "tts.engine."
STATUS_SNAPSHOT_QWEN_CAPABILITIES_KEY = "tts.qwen3tts.capabilities"
STATUS_SNAPSHOT_AI_KEY = "ai"
STATUS_SNAPSHOT_LLM_KEY = "llm"
STATUS_SNAPSHOT_CAPABILITIES_KEY = "capabilities"
STATUS_SNAPSHOT_CAPABILITY_SETTINGS_KEY = "capability_settings"
STATUS_SNAPSHOT_SYSTEM_INFO_KEY = "system_info"
STATUS_SNAPSHOT_SYSTEM_RESOURCES_KEY = "system_resources"


class StatusSnapshotCache:
    """Cache immutable status responses without running probes on the state owner."""

    def __init__(self, ttl_seconds: float = STATUS_SNAPSHOT_TTL_SECONDS) -> None:
        self._ttl_seconds = max(0.0, float(ttl_seconds))
        self._entries: Dict[str, Tuple[float, Dict[str, Any]]] = {}
        self._loading: Set[str] = set()
        init_serialized_owner(
            self,
            f"status_snapshot_cache.state.{id(self)}",
            "StatusSnapshotCacheStateThread",
        )

    @serialized_method
    def _claim(
        self,
        key: str,
        now: float,
        ttl_seconds: float,
    ) -> Dict[str, Any]:
        entry = self._entries.get(key)
        if entry is not None and now - entry[0] < ttl_seconds:
            return {"state": "cached", "value": copy.deepcopy(entry[1])}
        signal_name = f"status_snapshot_cache.load.{key}"
        if key in self._loading:
            return {"state": "waiting", "signal": signal_name}
        self._loading.add(key)
        THREAD_BUS.clear_signal(signal_name)
        return {"state": "loading", "signal": signal_name}

    @serialized_method
    def _finish(
        self,
        key: str,
        signal_name: str,
        value: Optional[Dict[str, Any]],
        error: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        snapshot = copy.deepcopy(value) if isinstance(value, dict) else None
        if snapshot is not None:
            self._entries[key] = (time.monotonic(), snapshot)
        self._loading.discard(key)
        THREAD_BUS.signal(signal_name, {
            "success": snapshot is not None,
            "value": snapshot,
            "error": error,
        })
        return copy.deepcopy(snapshot)

    def get(
        self,
        key: str,
        loader: Callable[[], Dict[str, Any]],
        refresh: bool = False,
        ttl_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        effective_ttl = (
            self._ttl_seconds
            if ttl_seconds is None
            else max(0.0, float(ttl_seconds))
        )
        claim = self._claim(
            key,
            time.monotonic(),
            0.0 if refresh else effective_ttl,
        )
        if claim["state"] == "cached":
            return claim["value"]
        signal_name = str(claim["signal"])
        if claim["state"] == "waiting":
            response = THREAD_BUS.wait_signal(signal_name, timeout=120.0)
            if not isinstance(response, dict):
                raise TimeoutError(f"Status snapshot load timed out: {key}")
            if not response.get("success"):
                raise RuntimeError(response.get("error") or f"Status snapshot failed: {key}")
            return copy.deepcopy(response.get("value") or {})
        try:
            value = loader()
        except Exception as exc:
            self._finish(key, signal_name, None, str(exc))
            raise
        return self._finish(key, signal_name, value) or {}

    @serialized_method
    def invalidate(self, key: str) -> None:
        self._entries.pop(key, None)

    @serialized_method
    def invalidate_prefix(self, prefix: str) -> None:
        keys = [key for key in self._entries if key.startswith(prefix)]
        for key in keys:
            self._entries.pop(key, None)


status_snapshot_cache = StatusSnapshotCache()


__all__ = [
    "STATUS_SNAPSHOT_AI_KEY",
    "STATUS_SNAPSHOT_CAPABILITIES_KEY",
    "STATUS_SNAPSHOT_CAPABILITY_SETTINGS_KEY",
    "STATUS_SNAPSHOT_LLM_KEY",
    "STATUS_SNAPSHOT_OCR_KEY",
    "STATUS_SNAPSHOT_QWEN_CAPABILITIES_KEY",
    "STATUS_SNAPSHOT_RESOURCES_TTL_SECONDS",
    "STATUS_SNAPSHOT_STT_KEY",
    "STATUS_SNAPSHOT_TTL_SECONDS",
    "STATUS_SNAPSHOT_TTS_ENGINE_PREFIX",
    "STATUS_SNAPSHOT_TTS_KEY",
    "STATUS_SNAPSHOT_SYSTEM_INFO_KEY",
    "STATUS_SNAPSHOT_SYSTEM_RESOURCES_KEY",
    "StatusSnapshotCache",
    "status_snapshot_cache",
]
