# -*- coding: utf-8 -*-
"""Shared endpoint-partitioned cache for Laravel-backed Queue Center slices."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional, Set

from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)


class EndpointScopedCache:
    """Store immutable response copies by normalized Laravel endpoint."""

    def __init__(self, ttl_s: float, stale_max_s: float) -> None:
        self._ttl_s = max(0.0, float(ttl_s))
        self._stale_max_s = max(self._ttl_s, float(stale_max_s))
        self._entries: Dict[str, Dict[str, Any]] = {}
        self._refreshing: Set[str] = set()
        self._refresh_started_at: Dict[str, float] = {}
        init_serialized_owner(
            self,
            f"endpoint_scoped_cache.state.{id(self)}",
            "EndpointScopedCacheStateThread",
        )

    @staticmethod
    def normalize_endpoint(endpoint: Optional[str]) -> str:
        return str(endpoint or "").strip().rstrip("/")

    @serialized_method
    def _read(self, endpoint: Optional[str], max_age_s: float) -> Optional[Dict[str, Any]]:
        key = self.normalize_endpoint(endpoint)
        if not key:
            return None
        now = time.monotonic()
        entry = self._entries.get(key)
        if not isinstance(entry, dict):
            return None
        stored_at = entry.get("stored_at")
        data = entry.get("data")
        if not isinstance(stored_at, (int, float)) or not isinstance(data, dict):
            return None
        age_s = max(0.0, now - float(stored_at))
        if age_s > max_age_s:
            return None
        result = dict(data)
        result["age_s"] = round(age_s, 3)
        result["stale"] = age_s > self._ttl_s
        result.setdefault("observed_at", entry.get("observed_at"))
        return result

    def get_fresh(self, endpoint: Optional[str]) -> Optional[Dict[str, Any]]:
        return self._read(endpoint, self._ttl_s)

    def get_stale(self, endpoint: Optional[str]) -> Optional[Dict[str, Any]]:
        return self._read(endpoint, self._stale_max_s)

    @serialized_method
    def store(self, endpoint: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        key = self.normalize_endpoint(endpoint)
        if not key:
            return dict(data)
        observed_at = str(
            data.get("observed_at")
            or data.get("generated_at")
            or datetime.now(timezone.utc).isoformat()
        )
        stored = dict(data)
        stored.setdefault("observed_at", observed_at)
        self._entries[key] = {
            "stored_at": time.monotonic(),
            "observed_at": observed_at,
            "data": stored,
        }
        result = dict(stored)
        result["age_s"] = 0.0
        result["stale"] = False
        return result

    def get_or_fetch(
        self,
        endpoint: Optional[str],
        fetcher: Callable[[], Dict[str, Any]],
    ) -> Dict[str, Any]:
        fresh = self.get_fresh(endpoint)
        if fresh is not None:
            return fresh
        fetched: Dict[str, Any] = {}
        try:
            candidate = fetcher()
            fetched = dict(candidate) if isinstance(candidate, dict) else {}
        except Exception:  # noqa: BLE001
            fetched = {}
        if fetched:
            return self.store(endpoint, fetched)
        return self.get_stale(endpoint) or {}

    def get_or_refresh(
        self,
        endpoint: Optional[str],
        fetcher: Callable[[], Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Return a snapshot immediately and refresh one endpoint in background."""
        key = self.normalize_endpoint(endpoint)
        fresh = self.get_fresh(key)
        if fresh is not None:
            return fresh
        stale = self.get_stale(key) or {}
        now = time.monotonic()
        if key and self._claim_refresh(key, now):
            start_bus_task(
                self._fetch_and_store,
                key,
                fetcher,
                thread_name="EndpointCacheRefreshThread",
            )
        return stale

    @serialized_method
    def _claim_refresh(self, endpoint: str, now: float) -> bool:
        last_started = self._refresh_started_at.get(endpoint, 0.0)
        if endpoint in self._refreshing or now - last_started < self._ttl_s:
            return False
        self._refreshing.add(endpoint)
        self._refresh_started_at[endpoint] = now
        return True

    @serialized_method
    def _finish_refresh(self, endpoint: str) -> None:
        self._refreshing.discard(endpoint)

    def _fetch_and_store(
        self,
        endpoint: str,
        fetcher: Callable[[], Dict[str, Any]],
    ) -> None:
        try:
            candidate = fetcher()
            if isinstance(candidate, dict) and candidate:
                self.store(endpoint, candidate)
        except Exception:  # noqa: BLE001
            pass
        finally:
            self._finish_refresh(endpoint)


__all__ = ["EndpointScopedCache"]
