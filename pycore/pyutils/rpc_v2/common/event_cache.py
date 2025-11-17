#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared in-memory event cache for RPC v2.
"""

import threading
import time
from collections import OrderedDict
from typing import Any, Dict, Optional

from pycore import ColorPrint


class EventCache:
    """Thread-safe cache with TTL + LRU eviction semantics."""

    def __init__(
        self,
        namespace: str = "rpc",
        max_size: int = 10000,
        default_ttl: float = 1800.0,
        cleanup_interval: float = 60.0,
    ):
        self.namespace = namespace
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cleanup_interval = cleanup_interval
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._lock = threading.RLock()
        self._cleanup_timer: Optional[threading.Timer] = None
        self._running = False

    def _namespaced(self, key: str) -> str:
        return f"{self.namespace}:{key}"

    def set(self, key: str, value: Any, ttl: Optional[float] = None, update_access: bool = True) -> bool:
        with self._lock:
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

    def get(self, key: str, remove: bool = False) -> Optional[Any]:
        with self._lock:
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

    def has(self, key: str) -> bool:
        with self._lock:
            full_key = self._namespaced(key)
            cached = self._cache.get(full_key)
            if not cached:
                return False
            if time.time() > cached["expires_at"]:
                self._cache.pop(full_key, None)
                return False
            return True

    def delete(self, key: str) -> bool:
        with self._lock:
            return self._cache.pop(self._namespaced(key), None) is not None

    def clear(self) -> bool:
        with self._lock:
            self._cache.clear()
            return True

    def size(self) -> int:
        with self._lock:
            return len(self._cache)

    def cleanup(self):
        with self._lock:
            expired = [key for key, entry in self._cache.items() if time.time() > entry["expires_at"]]
            for key in expired:
                self._cache.pop(key, None)
            if expired and ColorPrint:
                ColorPrint.yellow(f"[EventCache] Cleaned {len(expired)} expired entries")

    def start_cleanup(self):
        if self._running:
            return

        def _run():
            self.cleanup()
            self._cleanup_timer = threading.Timer(self.cleanup_interval, _run)
            self._cleanup_timer.daemon = True
            self._cleanup_timer.start()

        self._running = True
        _run()

    def stop_cleanup(self):
        self._running = False
        if self._cleanup_timer:
            self._cleanup_timer.cancel()
            self._cleanup_timer = None

    def _evict_oldest(self):
        if self._cache:
            self._cache.popitem(last=False)


default_event_cache = EventCache()

__all__ = ["EventCache", "default_event_cache"]
