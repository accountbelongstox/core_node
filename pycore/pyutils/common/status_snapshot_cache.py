# -*- coding: utf-8 -*-
"""Shared versioned single-flight cache plus the local status singleton."""

from __future__ import annotations

import copy
import time
from typing import Any, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
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
STATUS_SNAPSHOT_AI_PROBE_KEY = "ai.probe"
STATUS_SNAPSHOT_LLM_KEY = "llm"
STATUS_SNAPSHOT_CAPABILITIES_KEY = "capabilities"
STATUS_SNAPSHOT_CAPABILITY_SETTINGS_KEY = "capability_settings"
STATUS_SNAPSHOT_QUEUE_CENTER_KEY = "queue_center"
STATUS_SNAPSHOT_SYSTEM_INFO_KEY = "system_info"
STATUS_SNAPSHOT_SYSTEM_RESOURCES_KEY = "system_resources"
STATUS_SNAPSHOT_MAX_ENTRIES = 256
STATUS_SNAPSHOT_LOAD_LEASE_SECONDS = 120.0


class VersionedSnapshotCache:
    """Bounded single-flight snapshots with version, lease, and stale recovery."""

    def __init__(
        self,
        ttl_seconds: float = STATUS_SNAPSHOT_TTL_SECONDS,
        max_entries: int = STATUS_SNAPSHOT_MAX_ENTRIES,
        load_lease_seconds: float = STATUS_SNAPSHOT_LOAD_LEASE_SECONDS,
        copy_values: bool = True,
    ) -> None:
        self._ttl_seconds = max(0.0, float(ttl_seconds))
        self._max_entries = max(1, int(max_entries))
        self._load_lease_seconds = max(0.1, float(load_lease_seconds))
        self._copy_values = bool(copy_values)
        self._entries: Dict[
            str,
            Tuple[float, Optional[str], Dict[str, Any]],
        ] = {}
        self._active_loads: Dict[str, str] = {}
        self._loads: Dict[str, Dict[str, Any]] = {}
        self._load_generation = 0
        init_serialized_owner(
            self,
            f"versioned_snapshot_cache.state.{id(self)}",
            "VersionedSnapshotCacheStateThread",
        )

    def _copy_snapshot(self, value: Dict[str, Any]) -> Dict[str, Any]:
        return copy.deepcopy(value) if self._copy_values else value

    @serialized_method
    def _claim(
        self,
        key: str,
        now: float,
        ttl_seconds: float,
        version: Optional[str],
        lease_seconds: float,
        stale_while_refresh: bool,
    ) -> Dict[str, Any]:
        entry = self._entries.get(key)
        version_matches = entry is not None and (
            version is None or entry[1] == version
        )
        if version_matches and entry is not None and now - entry[0] < ttl_seconds:
            return {"state": "cached", "value": self._copy_snapshot(entry[2])}
        active_signal = self._active_loads.get(key)
        active_load = self._loads.get(active_signal or "")
        if active_load is not None:
            lease_deadline = float(active_load["started_at"]) + float(
                active_load["lease_seconds"]
            )
            if now < lease_deadline and stale_while_refresh and entry is not None:
                return {"state": "stale", "value": self._copy_snapshot(entry[2])}
            if now < lease_deadline:
                active_load["waiters"] = int(active_load["waiters"]) + 1
                return {
                    "state": "waiting",
                    "generation": int(active_load["generation"]),
                    "signal": active_signal,
                    "timeout": max(0.05, lease_deadline - now),
                }
            if int(active_load["waiters"]) == 0:
                self._loads.pop(str(active_signal), None)
                THREAD_BUS.clear_signal(str(active_signal))

        self._load_generation += 1
        generation = self._load_generation
        signal_name = f"versioned_snapshot_cache.load.{id(self)}.{generation}"
        self._active_loads[key] = signal_name
        self._loads[signal_name] = {
            "key": key,
            "generation": generation,
            "started_at": now,
            "lease_seconds": lease_seconds,
            "waiters": 0,
            "completed": False,
        }
        THREAD_BUS.clear_signal(signal_name)
        return {
            "state": "loading",
            "generation": generation,
            "signal": signal_name,
            "has_stale": stale_while_refresh and entry is not None,
            "stale": (
                self._copy_snapshot(entry[2])
                if stale_while_refresh and entry is not None
                else None
            ),
        }

    @serialized_method
    def _finish(
        self,
        key: str,
        generation: int,
        signal_name: str,
        value: Optional[Dict[str, Any]],
        version: Optional[str],
        error: Optional[str] = None,
    ) -> Dict[str, Any]:
        snapshot = self._copy_snapshot(value) if isinstance(value, dict) else None
        load = self._loads.get(signal_name)
        owns_generation = (
            load is not None
            and int(load["generation"]) == generation
            and self._active_loads.get(key) == signal_name
        )
        if snapshot is not None and owns_generation:
            self._store_entry(key, snapshot, version)
        if owns_generation:
            self._active_loads.pop(key, None)
        if load is not None:
            load["completed"] = True
            response = {
                "success": snapshot is not None and owns_generation,
                "superseded": not owns_generation,
                "generation": generation,
                "value": snapshot if owns_generation else None,
                "version": version,
                "error": error,
            }
            if int(load["waiters"]) > 0:
                THREAD_BUS.signal(signal_name, response)
            else:
                self._loads.pop(signal_name, None)
                THREAD_BUS.clear_signal(signal_name)
        return {
            "accepted": owns_generation,
            "value": self._copy_snapshot(snapshot) if owns_generation else None,
        }

    @serialized_method
    def _release_waiter(self, signal_name: str, generation: int) -> None:
        load = self._loads.get(signal_name)
        if load is None or int(load["generation"]) != generation:
            return
        load["waiters"] = max(0, int(load["waiters"]) - 1)
        is_active = self._active_loads.get(str(load["key"])) == signal_name
        if int(load["waiters"]) == 0 and (
            bool(load["completed"]) or not is_active
        ):
            self._loads.pop(signal_name, None)
            THREAD_BUS.clear_signal(signal_name)

    def _effective_limits(
        self,
        ttl_seconds: Optional[float],
        lease_seconds: Optional[float],
    ) -> Tuple[float, float]:
        effective_ttl = (
            self._ttl_seconds
            if ttl_seconds is None
            else max(0.0, float(ttl_seconds))
        )
        effective_lease = (
            self._load_lease_seconds
            if lease_seconds is None
            else max(0.1, float(lease_seconds))
        )
        return effective_ttl, effective_lease

    def _wait_response_value(
        self,
        response: Any,
        generation: int,
        version: Optional[str],
        key: str,
    ) -> Optional[Dict[str, Any]]:
        if not isinstance(response, dict):
            return None
        response_is_current = (
            not response.get("superseded")
            and int(response.get("generation") or 0) == generation
        )
        if not response_is_current:
            return None
        if not response.get("success"):
            raise RuntimeError(
                response.get("error") or f"Snapshot load failed: {key}"
            )
        if version is not None and response.get("version") != version:
            return None
        value = response.get("value")
        return self._copy_snapshot(value) if isinstance(value, dict) else None

    def _start_background_load(
        self,
        callback: Callable[..., Any],
        args: Tuple[Any, ...],
        claims: Dict[str, Dict[str, Any]],
        versions: Dict[str, Optional[str]],
        thread_name: str,
    ) -> None:
        try:
            start_bus_task(callback, *args, thread_name=thread_name)
        except Exception as exc:
            for key, claim in claims.items():
                self._finish(
                    key,
                    int(claim["generation"]),
                    str(claim["signal"]),
                    None,
                    versions.get(key),
                    str(exc),
                )

    def _store_entry(
        self,
        key: str,
        snapshot: Dict[str, Any],
        version: Optional[str],
    ) -> None:
        if key not in self._entries and len(self._entries) >= self._max_entries:
            oldest_key = min(
                self._entries,
                key=lambda entry_key: self._entries[entry_key][0],
            )
            self._entries.pop(oldest_key, None)
        self._entries[key] = (
            time.monotonic(),
            version,
            self._copy_snapshot(snapshot),
        )

    @serialized_method
    def peek(self, key: str) -> Optional[Dict[str, Any]]:
        """Return the latest snapshot without loading or applying TTL rules."""
        entry = self._entries.get(key)
        return self._copy_snapshot(entry[2]) if entry is not None else None

    @serialized_method
    def put(
        self,
        key: str,
        value: Dict[str, Any],
        version: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Store a caller-produced snapshot for instant subsequent reads."""
        if not isinstance(value, dict):
            raise TypeError("Snapshot value must be a dictionary")
        self._store_entry(key, value, version)
        return self._copy_snapshot(value)

    @serialized_method
    def update(
        self,
        key: str,
        updater: Callable[[Dict[str, Any]], Dict[str, Any]],
        version: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Atomically replace one snapshot from its current cached value."""
        entry = self._entries.get(key)
        current = self._copy_snapshot(entry[2]) if entry is not None else {}
        updated = updater(current)
        if not isinstance(updated, dict):
            raise TypeError("Snapshot updater must return a dictionary")
        self._store_entry(key, updated, version)
        return self._copy_snapshot(updated)

    def _load_and_finish(
        self,
        key: str,
        generation: int,
        signal_name: str,
        loader: Callable[[], Dict[str, Any]],
        version: Optional[str],
    ) -> None:
        try:
            value = loader()
            if not isinstance(value, dict):
                raise TypeError("Snapshot loader must return a dictionary")
        except Exception as exc:
            self._finish(
                key,
                generation,
                signal_name,
                None,
                version,
                str(exc),
            )
            return
        self._finish(
            key,
            generation,
            signal_name,
            value,
            version,
        )

    def _load_many_and_finish(
        self,
        claims: Dict[str, Dict[str, Any]],
        versions: Dict[str, Optional[str]],
        loader: Callable[[list[str]], Dict[str, Dict[str, Any]]],
    ) -> Dict[str, Any]:
        keys = list(claims)
        try:
            loaded = loader(keys)
            if not isinstance(loaded, dict):
                raise TypeError("Snapshot batch loader must return a dictionary")
        except Exception as exc:
            for key, claim in claims.items():
                self._finish(
                    key,
                    int(claim["generation"]),
                    str(claim["signal"]),
                    None,
                    versions.get(key),
                    str(exc),
                )
            return {"success": False, "error": str(exc), "values": {}}
        values: Dict[str, Dict[str, Any]] = {}
        missing_keys: list[str] = []
        for key, claim in claims.items():
            value = loaded.get(key)
            normalized = value if isinstance(value, dict) else None
            if normalized is None:
                missing_keys.append(key)
            finished = self._finish(
                key,
                int(claim["generation"]),
                str(claim["signal"]),
                normalized,
                versions.get(key),
                None if normalized is not None else "Snapshot loader omitted key",
            )
            if finished["accepted"] and isinstance(finished["value"], dict):
                values[key] = finished["value"]
        error = (
            f"Snapshot loader omitted keys: {', '.join(missing_keys)}"
            if missing_keys
            else None
        )
        return {"success": not missing_keys, "error": error, "values": values}

    def get_many(
        self,
        versions: Dict[str, Optional[str]],
        loader: Callable[[list[str]], Dict[str, Dict[str, Any]]],
        refresh: bool = False,
        ttl_seconds: Optional[float] = None,
        lease_seconds: Optional[float] = None,
        stale_while_refresh: bool = True,
    ) -> Dict[str, Dict[str, Any]]:
        effective_ttl, effective_lease = self._effective_limits(
            ttl_seconds,
            lease_seconds,
        )
        values: Dict[str, Dict[str, Any]] = {}
        unresolved = list(versions)
        while unresolved:
            loading: Dict[str, Dict[str, Any]] = {}
            waiting: Dict[str, Dict[str, Any]] = {}
            next_unresolved: list[str] = []
            for key in unresolved:
                claim = self._claim(
                    key,
                    time.monotonic(),
                    0.0 if refresh else effective_ttl,
                    versions.get(key),
                    effective_lease,
                    stale_while_refresh,
                )
                if claim["state"] in ("cached", "stale"):
                    values[key] = claim["value"]
                elif claim["state"] == "loading":
                    loading[key] = claim
                else:
                    waiting[key] = claim
                    next_unresolved.append(key)

            if loading:
                has_cold_load = any(
                    not bool(claim.get("has_stale"))
                    for claim in loading.values()
                )
                if has_cold_load:
                    outcome = self._load_many_and_finish(
                        loading,
                        versions,
                        loader,
                    )
                    values.update(outcome.get("values") or {})
                    for key, claim in loading.items():
                        if key in values:
                            continue
                        if claim.get("has_stale"):
                            values[key] = self._copy_snapshot(claim["stale"])
                            continue
                        next_unresolved.append(key)
                    cold_failures = [
                        key
                        for key, claim in loading.items()
                        if key not in values
                        and not bool(claim.get("has_stale"))
                    ]
                    if not outcome["success"] and cold_failures:
                        raise RuntimeError(
                            outcome.get("error") or "Snapshot batch load failed"
                        )
                else:
                    self._start_background_load(
                        self._load_many_and_finish,
                        (loading, versions, loader),
                        loading,
                        versions,
                        "SnapshotBatchRefreshThread",
                    )
                    for key, claim in loading.items():
                        values[key] = self._copy_snapshot(claim["stale"])

            if waiting:
                wait_key = next(iter(waiting))
                wait_claim = waiting[wait_key]
                for key, claim in waiting.items():
                    if key == wait_key:
                        continue
                    self._release_waiter(
                        str(claim["signal"]),
                        int(claim["generation"]),
                    )
                response = THREAD_BUS.wait_signal(
                    str(wait_claim["signal"]),
                    timeout=float(wait_claim["timeout"]),
                )
                self._release_waiter(
                    str(wait_claim["signal"]),
                    int(wait_claim["generation"]),
                )
                response_value = self._wait_response_value(
                    response,
                    int(wait_claim["generation"]),
                    versions.get(wait_key),
                    wait_key,
                )
                if response_value is not None:
                    values[wait_key] = response_value
                next_unresolved = [
                    key for key in next_unresolved if key not in values
                ]

            unresolved = list(dict.fromkeys(next_unresolved))
        return values

    def get(
        self,
        key: str,
        loader: Callable[[], Dict[str, Any]],
        refresh: bool = False,
        ttl_seconds: Optional[float] = None,
        version: Optional[str] = None,
        lease_seconds: Optional[float] = None,
        stale_while_refresh: bool = True,
    ) -> Dict[str, Any]:
        effective_ttl, effective_lease = self._effective_limits(
            ttl_seconds,
            lease_seconds,
        )
        while True:
            claim = self._claim(
                key,
                time.monotonic(),
                0.0 if refresh else effective_ttl,
                version,
                effective_lease,
                stale_while_refresh,
            )
            if claim["state"] in ("cached", "stale"):
                return claim["value"]

            generation = int(claim["generation"])
            signal_name = str(claim["signal"])
            if claim["state"] == "waiting":
                response = THREAD_BUS.wait_signal(
                    signal_name,
                    timeout=float(claim["timeout"]),
                )
                self._release_waiter(signal_name, generation)
                response_value = self._wait_response_value(
                    response,
                    generation,
                    version,
                    key,
                )
                if response_value is None:
                    refresh = False
                    continue
                return response_value

            stale = claim.get("stale")
            if claim.get("has_stale"):
                self._start_background_load(
                    self._load_and_finish,
                    (key, generation, signal_name, loader, version),
                    {key: claim},
                    {key: version},
                    "SnapshotRefreshThread",
                )
                return self._copy_snapshot(stale)
            try:
                value = loader()
                if not isinstance(value, dict):
                    raise TypeError(
                        "Snapshot loader must return a dictionary"
                    )
            except Exception as exc:
                finished = self._finish(
                    key,
                    generation,
                    signal_name,
                    None,
                    version,
                    str(exc),
                )
                if claim.get("has_stale"):
                    return self._copy_snapshot(stale)
                if not finished["accepted"]:
                    refresh = False
                    continue
                raise
            finished = self._finish(
                key,
                generation,
                signal_name,
                value,
                version,
            )
            if not finished["accepted"]:
                refresh = False
                continue
            finished_value = finished.get("value")
            return (
                self._copy_snapshot(finished_value)
                if isinstance(finished_value, dict)
                else {}
            )

    @serialized_method
    def invalidate(self, key: str) -> None:
        self._entries.pop(key, None)

    @serialized_method
    def invalidate_prefix(self, prefix: str) -> None:
        keys = [key for key in self._entries if key.startswith(prefix)]
        for key in keys:
            self._entries.pop(key, None)


class StatusSnapshotCache(VersionedSnapshotCache):
    """Versioned snapshot cache for local status dictionaries."""


status_snapshot_cache = StatusSnapshotCache()


__all__ = [
    "STATUS_SNAPSHOT_AI_KEY",
    "STATUS_SNAPSHOT_AI_PROBE_KEY",
    "STATUS_SNAPSHOT_CAPABILITIES_KEY",
    "STATUS_SNAPSHOT_CAPABILITY_SETTINGS_KEY",
    "STATUS_SNAPSHOT_QUEUE_CENTER_KEY",
    "STATUS_SNAPSHOT_LLM_KEY",
    "STATUS_SNAPSHOT_LOAD_LEASE_SECONDS",
    "STATUS_SNAPSHOT_MAX_ENTRIES",
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
    "VersionedSnapshotCache",
    "status_snapshot_cache",
]
