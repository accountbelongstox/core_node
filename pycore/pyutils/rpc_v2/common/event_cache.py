#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared in-memory event cache for RPC v2.
"""

import time
from collections import OrderedDict
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.rpc_v2.constants import (
    EVENT_CACHE_TTL,
    EVENT_CACHE_MAX_SIZE,
    DEFAULT_CLEANUP_INTERVAL,
)
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)


class EventCache:
    """Thread-safe cache with TTL + LRU eviction semantics."""

    def __init__(
        self,
        namespace: str = "rpc",
        max_size: int = EVENT_CACHE_MAX_SIZE,
        default_ttl: float = EVENT_CACHE_TTL,
        cleanup_interval: float = DEFAULT_CLEANUP_INTERVAL,
    ):
        self.namespace = namespace
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cleanup_interval = cleanup_interval
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._running = False
        self._cleanup_generation = 0
        init_serialized_owner(
            self,
            'pyutils.rpc_v2.event_cache',
            'RPCEventCacheThread',
        )

    def _namespaced(self, key: str) -> str:
        return f"{self.namespace}:{key}"

    @serialized_method
    def set(self, key: str, value: Any, ttl: Optional[float] = None, update_access: bool = True) -> bool:
        if len(self._cache) >= self.max_size and self._namespaced(key) not in self._cache:
            self._evict_oldest()
        full_key = self._namespaced(key)
        expires_at = time.time() + (ttl or self.default_ttl)
        self._cache[full_key] = {
            "value": value,
            "created_at": time.time(),
            "expires_at": expires_at,
            "accessed_at": time.time() if update_access else 0,
            "access_count": 0,
        }
        self._cache.move_to_end(full_key)
        return True

    @serialized_method
    def get(self, key: str, remove: bool = False) -> Optional[Any]:
        full_key = self._namespaced(key)
        cached = self._cache.get(full_key)
        if not cached:
            return None
        if time.time() > cached["expires_at"]:
            self._cache.pop(full_key, None)
            return None
        cached["accessed_at"] = time.time()
        cached["access_count"] += 1
        self._cache.move_to_end(full_key)
        value = cached["value"]
        if remove:
            self._cache.pop(full_key, None)
        return value

    @serialized_method
    def has(self, key: str) -> bool:
        full_key = self._namespaced(key)
        cached = self._cache.get(full_key)
        if not cached:
            return False
        if time.time() > cached["expires_at"]:
            self._cache.pop(full_key, None)
            return False
        return True

    @serialized_method
    def delete(self, key: str) -> bool:
        return self._cache.pop(self._namespaced(key), None) is not None

    @serialized_method
    def clear(self) -> bool:
        self._cache.clear()
        return True

    @serialized_method
    def size(self) -> int:
        return len(self._cache)

    @serialized_method
    def cleanup(self):
        expired = [key for key, entry in self._cache.items() if time.time() > entry["expires_at"]]
        for key in expired:
            self._cache.pop(key, None)
        if expired and ColorPrint:
            ColorPrint.yellow(f"[EventCache] Cleaned {len(expired)} expired entries")

    @serialized_method
    def start_cleanup(self):
        if self._running:
            return
        self._running = True
        self._cleanup_generation += 1
        start_bus_task(
            self._cleanup_loop,
            self._cleanup_generation,
            thread_name='RPCEventCacheCleanupThread',
        )

    @serialized_method
    def stop_cleanup(self):
        self._running = False
        THREAD_BUS.signal(self._stop_signal(self._cleanup_generation), True)

    @serialized_method
    def _cleanup_active(self, generation: int) -> bool:
        """Check cleanup generation on the cache-owner thread."""
        return self._running and self._cleanup_generation == generation

    def _cleanup_loop(self, generation: int) -> None:
        """Run periodic cleanup with bus-backed stop control."""
        stop_signal = self._stop_signal(generation)
        while self._cleanup_active(generation):
            self.cleanup()
            if THREAD_BUS.wait_signal(stop_signal, timeout=self.cleanup_interval):
                break
        THREAD_BUS.clear_signal(stop_signal)

    def _stop_signal(self, generation: int) -> str:
        """Return the stop signal for one cleanup generation."""
        return f'{self._serialized_queue_name}.cleanup.stop.{generation}'

    def _evict_oldest(self):
        if self._cache:
            self._cache.popitem(last=False)


default_event_cache = EventCache()

__all__ = ["EventCache", "default_event_cache"]
