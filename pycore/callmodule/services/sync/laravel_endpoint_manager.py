# -*- coding: utf-8 -*-
"""
Laravel Endpoint Manager — multi-endpoint resolution for the laravel_main API.

Mirrors the dashboard's multi-API-URL system (development-guides/
MULTI_API_URL_SYSTEM.md) on the pycore side, with the STORED-FIRST policy:

  1. resolve() first probes ONLY the stored/current endpoint (cheap happy path);
  2. if that fails, it sweeps EVERY candidate in parallel (3s probe cap) and
     picks the first healthy one in candidate order;
  3. the winner is persisted as the user's choice and cached in-process;
  4. the cache is invalidated whenever the list changes (add/remove/select).

Persistence lives in the unified user-data store (user_data.json) under the
``laravel_api`` section:

    "laravel_api": {
        "endpoints": ["http://127.0.0.1:9000", "http://localhost:9000", ...],
        "current": "http://127.0.0.1:9000"        # or null
    }

The candidate list is seeded once from today's defaults — the configured
LARAVEL_WORKER_API_URL plus the translation worker's local/LAN fallbacks
(TranslationWorkerService._build_candidates) plus http://localhost:9000 and
http://127.0.0.1:9000 — and is user-editable afterwards via the
``laravel_api.*`` RPC routes (registered in callmodule/config.py).

Health probe: GET {base}/api/health — laravel_main's liveness-only route
(routes/api.php; no DB, no auth, heavy middleware stripped) — with a 3.0s
timeout. Per the dashboard rule ("reachable counts as healthy") any HTTP
status < 500 is healthy.

Architecture / layering (pycore rules):
  * App layer (callmodule.services.sync), beside the media-sync client that
    consumes it. All imports at file top (no function-level imports).
  * Logging only via ColorPrint; networking via the lazily-loaded third-party
    ``requests`` (pycore.pyfoundations.third_party), never a bare import.
"""

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

from pycore import ColorPrint, get_user_data_store
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.callmodule.callmodule_config.config import Config as CallmoduleConfig
from pycore.callmodule.services.translation_worker_service import TranslationWorkerService


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
# user_data.json section this manager owns.
USER_DATA_SECTION = "laravel_api"
# laravel_main's cheap liveness route (no DB, no auth — see routes/api.php).
HEALTH_PATH = "/api/health"
# Probe timeout (seconds) — load-bearing, mirrors the dashboard's ~3000ms cap.
PROBE_TIMEOUT = 3.0
# After a fully-failed sweep, don't re-sweep for this long (avoid hammering a
# down backend from periodic callers like backend_status).
FAILED_SWEEP_TTL = 10.0
# Baseline local defaults that must always be part of the seed.
_BASE_DEFAULTS = ["http://localhost:9000", "http://127.0.0.1:9000"]


def _normalize(url: Optional[str]) -> str:
    """Normalized endpoint URL: stripped, scheme-prefixed, no trailing slash."""
    u = (url or "").strip()
    if not u:
        return ""
    if not (u.startswith("http://") or u.startswith("https://")):
        u = "http://" + u
    return u.rstrip("/")


class LaravelEndpointManager:
    """Stored-first multi-endpoint manager for the laravel_main base URL."""

    def __init__(self):
        self._lock = threading.RLock()
        self._resolved: Optional[str] = None       # in-process resolve() cache
        self._failed_sweep_at: float = 0.0          # monotonic ts of last all-down sweep
        # Last probe result per url: {url, healthy, latency_ms, last_checked, ...}
        self._probe_results: Dict[str, Dict[str, Any]] = {}

    # ----------------------------------------------------------------- #
    # Defaults / persistence                                             #
    # ----------------------------------------------------------------- #
    @staticmethod
    def _default_candidates() -> List[str]:
        """Today's default candidates: configured primary + worker fallbacks."""
        primary = (getattr(CallmoduleConfig, "LARAVEL_WORKER_API_URL", None)
                   or os.getenv("LARAVEL_WORKER_API_URL")
                   or "http://127.0.0.1:9000")
        try:
            candidates = TranslationWorkerService._build_candidates(primary)
        except Exception:
            candidates = [primary]
        ordered: List[str] = []
        for url in list(candidates) + _BASE_DEFAULTS:
            u = _normalize(url)
            if u and u not in ordered:
                ordered.append(u)
        return ordered

    def _load(self) -> Dict[str, Any]:
        """Load {endpoints, current} from the store, seeding defaults once."""
        section = get_user_data_store().get_section(USER_DATA_SECTION) or {}
        endpoints = [
            _normalize(u) for u in (section.get("endpoints") or []) if _normalize(u)
        ]
        # de-dup while preserving order
        seen: List[str] = []
        for u in endpoints:
            if u not in seen:
                seen.append(u)
        endpoints = seen
        current = _normalize(section.get("current")) or None
        if not endpoints:
            endpoints = self._default_candidates()
            self._save(endpoints, current)
            ColorPrint.blue(
                f"[LaravelEndpoints] Seeded {len(endpoints)} default endpoint(s)")
        if current and current not in endpoints:
            endpoints = [current] + endpoints
        return {"endpoints": endpoints, "current": current}

    @staticmethod
    def _save(endpoints: List[str], current: Optional[str]) -> None:
        """Persist {endpoints, current} to user_data.json (atomic store save)."""
        get_user_data_store().set_section(
            USER_DATA_SECTION, {"endpoints": list(endpoints), "current": current})

    # ----------------------------------------------------------------- #
    # Probing                                                            #
    # ----------------------------------------------------------------- #
    def probe(self, url: str) -> Dict[str, Any]:
        """Probe ONE endpoint via GET {url}/api/health (3.0s timeout).

        Returns {url, healthy, latency_ms, last_checked, status, error} and
        records the result for lazy reuse by list/add/remove/select. Healthy =
        any HTTP status < 500 (the dashboard's "reachable counts as healthy").
        Never raises.
        """
        u = _normalize(url)
        result: Dict[str, Any] = {
            "url": u, "healthy": False, "latency_ms": None,
            "last_checked": int(time.time() * 1000), "status": None, "error": None,
        }
        if not u:
            result["error"] = "empty url"
            return result
        requests = get_third_package_requests()
        started = time.monotonic()
        try:
            resp = requests.get(u + HEALTH_PATH, timeout=PROBE_TIMEOUT)
            result["latency_ms"] = int((time.monotonic() - started) * 1000)
            result["status"] = resp.status_code
            result["healthy"] = resp.status_code < 500
            if not result["healthy"]:
                result["error"] = f"HTTP {resp.status_code}"
        except Exception as e:
            result["latency_ms"] = int((time.monotonic() - started) * 1000)
            result["error"] = str(e).splitlines()[0][:200]
        with self._lock:
            self._probe_results[u] = dict(result)
        return result

    def _probe_many(self, urls: List[str]) -> Dict[str, Dict[str, Any]]:
        """Probe several endpoints in PARALLEL (each capped at PROBE_TIMEOUT).

        Total wall time stays ~PROBE_TIMEOUT, keeping laravel_api.list fast.
        """
        urls = [u for u in dict.fromkeys(_normalize(u) for u in urls) if u]
        if not urls:
            return {}
        results: Dict[str, Dict[str, Any]] = {}
        with ThreadPoolExecutor(max_workers=min(8, len(urls))) as pool:
            for url, res in zip(urls, pool.map(self.probe, urls)):
                results[url] = res
        return results

    # ----------------------------------------------------------------- #
    # Resolution (stored-first -> sweep -> cache)                        #
    # ----------------------------------------------------------------- #
    def resolve(self) -> str:
        """Resolve the Laravel base URL. STORED-FIRST, then sweep, then cache.

        1. Return the in-process cached winner when present.
        2. Probe ONLY the stored ``current`` endpoint; healthy -> cache+return.
        3. Full parallel sweep of every candidate; first healthy in candidate
           order wins, is PERSISTED as ``current`` and cached.
        4. All down: return the stored current (or first candidate) WITHOUT
           caching, so the next call retries (a short negative TTL prevents
           re-sweeping in a tight loop).
        """
        with self._lock:
            if self._resolved:
                return self._resolved
        state = self._load()
        endpoints: List[str] = state["endpoints"]
        current: Optional[str] = state["current"]
        fallback = current or (endpoints[0] if endpoints else "http://127.0.0.1:9000")

        # Negative cache: a recent sweep found nothing — don't re-probe yet.
        with self._lock:
            if time.monotonic() - self._failed_sweep_at < FAILED_SWEEP_TTL:
                return fallback

        # 1) stored-first: try ONLY the persisted choice.
        if current:
            res = self.probe(current)
            if res.get("healthy"):
                with self._lock:
                    self._resolved = current
                return current
            ColorPrint.yellow(
                f"[LaravelEndpoints] Stored endpoint {current} unhealthy "
                f"({res.get('error')}) — sweeping {len(endpoints)} candidate(s)")

        # 2) full sweep (parallel, ~3s wall time); first healthy in order wins.
        sweep = self._probe_many(endpoints)
        winner = next((u for u in endpoints if sweep.get(u, {}).get("healthy")), None)
        if winner:
            with self._lock:
                self._resolved = winner
            if winner != current:
                self._save(endpoints, winner)
                ColorPrint.green(f"[LaravelEndpoints] Switched to {winner} (persisted)")
            return winner

        # 3) nothing healthy — degrade to the stored/first candidate, uncached.
        with self._lock:
            self._failed_sweep_at = time.monotonic()
        ColorPrint.yellow(
            f"[LaravelEndpoints] No healthy Laravel endpoint among "
            f"{len(endpoints)} candidate(s); falling back to {fallback}")
        return fallback

    def invalidate(self) -> None:
        """Drop the in-process resolve cache (after select/add/remove)."""
        with self._lock:
            self._resolved = None
            self._failed_sweep_at = 0.0

    # ----------------------------------------------------------------- #
    # List management (RPC-facing)                                       #
    # ----------------------------------------------------------------- #
    def _endpoint_rows(self, endpoints: List[str]) -> List[Dict[str, Any]]:
        """Rows for the RPC contract, using the LAST KNOWN probe results.

        ``custom`` marks user-added URLs (removable in the UI) vs built-in
        defaults (``custom: False`` — the FE hides Remove for those, matching
        PcLaravelEndpointSwitcher's ``ep.custom !== false`` check).
        """
        defaults = set(self._default_candidates())
        rows: List[Dict[str, Any]] = []
        with self._lock:
            for u in endpoints:
                last = self._probe_results.get(u) or {}
                rows.append({
                    "url": u,
                    "healthy": last.get("healthy") if last else None,
                    "latency_ms": last.get("latency_ms"),
                    "last_checked": last.get("last_checked"),
                    "status": last.get("status"),
                    "error": last.get("error"),
                    "custom": u not in defaults,
                })
        return rows

    def list_endpoints(self, probe: bool = True) -> Dict[str, Any]:
        """Full endpoint listing for the UI; probes all in parallel by default.

        Returns {success, endpoints:[{url, healthy, latency_ms, last_checked,
        status, error}], current, resolved}. With ``probe=False`` it reuses the
        last known probe results instead (fast, no network).
        """
        state = self._load()
        if probe:
            self._probe_many(state["endpoints"])
        with self._lock:
            resolved = self._resolved
        return {
            "success": True,
            "endpoints": self._endpoint_rows(state["endpoints"]),
            "current": state["current"],
            "resolved": resolved,
        }

    def add(self, url: str) -> Dict[str, Any]:
        """Add a candidate endpoint (idempotent); invalidates the cache."""
        u = _normalize(url)
        if not u:
            return {"success": False, "error": "url is required"}
        state = self._load()
        endpoints: List[str] = state["endpoints"]
        if u not in endpoints:
            endpoints.append(u)
            self._save(endpoints, state["current"])
            ColorPrint.blue(f"[LaravelEndpoints] Added endpoint {u}")
        self.invalidate()
        return {"success": True,
                "endpoints": self._endpoint_rows(endpoints),
                "current": state["current"]}

    def remove(self, url: str) -> Dict[str, Any]:
        """Remove a candidate; clears ``current`` if it pointed at it.

        Removing the last endpoint re-seeds the defaults (the manager must
        always have at least one candidate to resolve against).
        """
        u = _normalize(url)
        if not u:
            return {"success": False, "error": "url is required"}
        state = self._load()
        endpoints = [e for e in state["endpoints"] if e != u]
        current = state["current"]
        if current == u:
            current = None
        if not endpoints:
            endpoints = self._default_candidates()
        self._save(endpoints, current)
        self.invalidate()
        ColorPrint.blue(f"[LaravelEndpoints] Removed endpoint {u}")
        return {"success": True,
                "endpoints": self._endpoint_rows(endpoints),
                "current": current}

    def select(self, url: str) -> Dict[str, Any]:
        """Persist ``url`` as the user's stored choice (adds it when missing).

        Invalidates the resolve cache so the NEXT resolve() re-probes
        stored-first against the new choice. Also probes the selection once so
        the response carries fresh health info for the UI.
        """
        u = _normalize(url)
        if not u:
            return {"success": False, "error": "url is required"}
        state = self._load()
        endpoints: List[str] = state["endpoints"]
        if u not in endpoints:
            endpoints.append(u)
        self._save(endpoints, u)
        self.invalidate()
        probe_res = self.probe(u)
        if probe_res.get("healthy"):
            # Selection is live — pre-warm the resolve cache with it.
            with self._lock:
                self._resolved = u
        ColorPrint.green(
            f"[LaravelEndpoints] Selected {u} "
            f"({'healthy' if probe_res.get('healthy') else 'UNHEALTHY'})")
        return {"success": True,
                "endpoints": self._endpoint_rows(endpoints),
                "current": u,
                "selected": probe_res}

    def probe_route(self, url: Optional[str] = None) -> Dict[str, Any]:
        """RPC-facing probe: ONE url when given, else ALL candidates (parallel)."""
        if url and str(url).strip():
            return {"success": True, "endpoint": self.probe(str(url))}
        state = self._load()
        self._probe_many(state["endpoints"])
        return {"success": True,
                "endpoints": self._endpoint_rows(state["endpoints"]),
                "current": state["current"]}


# --- module-level singleton ------------------------------------------------- #
_manager_lock = threading.Lock()
_manager_singleton: Optional[LaravelEndpointManager] = None


def get_laravel_endpoint_manager() -> LaravelEndpointManager:
    """Return the process-wide LaravelEndpointManager singleton."""
    global _manager_singleton
    if _manager_singleton is None:
        with _manager_lock:
            if _manager_singleton is None:
                _manager_singleton = LaravelEndpointManager()
    return _manager_singleton
