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
        "endpoints": ["http://127.0.0.1:9000", "http://100.101.149.39:9000", ...],
        "current": "http://127.0.0.1:9000",       # or null
        "seed_version": 3                          # default-set migration marker
    }

The candidate list is seeded from the defaults below — the loopback
(http://127.0.0.1:9000; localhost is merged into it) plus the named
cross-machine hosts (_NAMED_DEFAULTS, all :9000), with an explicitly configured
LARAVEL_WORKER_API_URL honored first — and is user-editable afterwards via the
``laravel_api.*`` RPC routes (registered in callmodule/config.py). A SEED_VERSION
bump migrates an already-persisted list once (prune 192.168.* + merge new
defaults; see _load).

Health probe: GET {base}/api/health — laravel_main's liveness-only route
(routes/api.php; no DB, no auth, heavy middleware stripped). The parallel sweep
uses a 6.0s cap (remote tailscale/cloud candidates exceed 3s on a cold hit); the
stored-first probe of the single known-good endpoint uses a more forgiving 12.0s
+ one retry so a cold-start first hit (Octane worker warm-up ~4-5s) does not
needlessly fail the happy path and trigger a sweep. Per the dashboard rule
("reachable counts as healthy") any HTTP status < 500 is healthy.

Architecture / layering (pycore rules):
  * App layer (callmodule.services.sync), beside the media-sync client that
    consumes it. All imports at file top (no function-level imports).
  * Logging only via ColorPrint; networking via the lazily-loaded third-party
    ``requests`` (pycore.pyfoundations.third_party), never a bare import.
"""

import os
import re
import time
from typing import Any, Callable, Dict, List, Optional

from pycore import ColorPrint, get_user_data_store
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    map_bus_tasks,
    serialized_method,
)
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.callmodule.callmodule_config.config import Config as CallmoduleConfig
from pycore.callmodule.services.sync.laravel_http_recorder import notify_laravel_http


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
# user_data.json section this manager owns.
USER_DATA_SECTION = "laravel_api"
# laravel_main's cheap liveness route (no DB, no auth — see routes/api.php).
HEALTH_PATH = "/api/health"
# Probe timeout (seconds) — load-bearing, mirrors the dashboard's probe cap.
# Used for the PARALLEL sweep, where many candidates must stay fast together.
# Cross-machine tailscale/cloud candidates routinely exceed 3s on a cold hit,
# so 6s keeps slow-but-alive endpoints from being falsely swept as down.
PROBE_TIMEOUT = 6.0
# Stored-first probe is a SINGLE call to the known-good endpoint, so it can afford
# a more forgiving budget: a cold Octane worker's first /api/health hit after idle
# can take ~4-5s (worker warm-up) even though the backend is healthy, and remote
# tailscale candidates need even more headroom. A short cap here would needlessly
# fail the happy path and trigger a full LAN sweep.
STORED_PROBE_TIMEOUT = 12.0
# Retry the stored-first probe once on failure — the cold first hit warms the
# worker, so the immediate second hit succeeds.
STORED_PROBE_RETRIES = 1
# After a fully-failed sweep, don't re-sweep for this long (avoid hammering a
# down backend from periodic callers like backend_status).
FAILED_SWEEP_TTL = 10.0
# Hot HTTP paths (assist status, queue overview) — one stored probe, no sweep.
UI_PROBE_TIMEOUT = 3.0
UI_NEGATIVE_TTL = 30.0
# THREAD_BUS single-flight guard for resolve(): only one thread runs the
# probe cycle; concurrent callers degrade to the stored fallback (see resolve).
_RESOLVING_SIGNAL = "laravel_endpoint_manager.resolving"
# Baseline local default — the loopback (local-first so a laravel on the same
# box as pycore is the fast happy path). `localhost` is merged into 127.0.0.1
# by _normalize, so only this single loopback entry ever appears.
_BASE_DEFAULTS = ["http://127.0.0.1:9000"]
# Named cross-machine defaults (mesh / cloud), all on the laravel port 9000.
# These replace the old LAN-only fallbacks (192.168.50.x). Edit here to change
# the seeded list; the browser's current origin (:9000) is added FE-side
# (PcLaravelEndpointProvider) since the backend has no window.
_NAMED_DEFAULTS = [
    "http://100.101.149.39:9000",  # Dev Machine
    "http://43.163.112.77:9000",   # Tencent Cloud SG
    "http://100.106.85.16:9000",   # tailscale (Ace)
]
# Bump when the default candidate set changes — triggers a ONE-TIME migration on
# load (see _load): prune unwanted 192.168.* endpoints + merge new defaults in,
# without re-adding ones the user has since removed.
SEED_VERSION = 3


def _normalize(url: Optional[str]) -> str:
    """Normalized endpoint URL: stripped, scheme-prefixed, no trailing slash.

    Also merges ``localhost`` into ``127.0.0.1`` (the same loopback host) so the
    two never show up as separate endpoints.
    """
    u = (url or "").strip()
    if not u:
        return ""
    if not (u.startswith("http://") or u.startswith("https://")):
        u = "http://" + u
    u = u.rstrip("/")
    u = re.sub(r"^(https?://)localhost(?=[:/]|$)", r"\g<1>127.0.0.1", u)
    return u


def _probe_endpoint(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Probe one endpoint; payload and result cross the thread via THREAD_BUS."""
    url = _normalize(payload.get("url"))
    timeout = payload.get("timeout") or PROBE_TIMEOUT
    result: Dict[str, Any] = {
        "url": url,
        "healthy": False,
        "latency_ms": None,
        "last_checked": int(time.time() * 1000),
        "status": None,
        "error": None,
    }
    if not url:
        result["error"] = "empty url"
        return result
    requests = get_third_package_requests()
    started = time.monotonic()
    try:
        resp = requests.get(url + HEALTH_PATH, timeout=timeout)
        result["latency_ms"] = int((time.monotonic() - started) * 1000)
        result["status"] = resp.status_code
        result["healthy"] = resp.status_code < 500
        if not result["healthy"]:
            result["error"] = f"HTTP {resp.status_code}"
    except Exception as exc:  # noqa: BLE001
        result["latency_ms"] = int((time.monotonic() - started) * 1000)
        result["error"] = str(exc).splitlines()[0][:200]
    latency = result.get("latency_ms") or 0
    status = result.get("status") or 0
    error = result.get("error")
    if error:
        ColorPrint.red(f"[laravel] GET {HEALTH_PATH} -> ERR ({latency}ms) {error}")
    else:
        line = f"[laravel] GET {HEALTH_PATH} -> {status} ({latency}ms)"
        ColorPrint.yellow(line) if status >= 400 else ColorPrint.cyan(line)
    notify_laravel_http({
        "ts": time.time(),
        "method": "GET",
        "url": url + HEALTH_PATH,
        "path": HEALTH_PATH,
        "params_summary": "",
        "status": status,
        "ms": float(latency),
        "error": error,
        "base_url": url,
    })
    return result


class LaravelEndpointManager:
    """Stored-first multi-endpoint manager for the laravel_main base URL."""

    def __init__(self):
        self._resolved: Optional[str] = None       # in-process resolve() cache
        self._failed_sweep_at: float = 0.0          # monotonic ts of last all-down sweep
        self._ui_failed_at: float = 0.0             # monotonic ts of last UI-path probe miss
        # Last probe result per url: {url, healthy, latency_ms, last_checked, ...}
        self._probe_results: Dict[str, Dict[str, Any]] = {}
        # Callbacks invoked (best-effort) when select() confirms a healthy new endpoint.
        self._endpoint_change_listeners: List[Callable[[str], None]] = []
        init_serialized_owner(
            self,
            "laravel_endpoint_manager.state",
            "LaravelEndpointManagerState",
            timeout=90.0,
        )

    # ----------------------------------------------------------------- #
    # Defaults / persistence                                             #
    # ----------------------------------------------------------------- #
    @staticmethod
    def _default_candidates() -> List[str]:
        """Default candidates: optional configured primary, the loopback
        (127.0.0.1; localhost merged in), then the named cross-machine hosts
        (all :9000).

        An explicitly configured LARAVEL_WORKER_API_URL (env or callmodule
        Config) is honored first so a deployment override still wins; otherwise
        the seed is purely the local + named defaults below. The browser's
        current origin (:9000) is added FE-side, not here.
        """
        configured = (getattr(CallmoduleConfig, "LARAVEL_WORKER_API_URL", None)
                      or os.getenv("LARAVEL_WORKER_API_URL"))
        ordered: List[str] = []
        seed: List[str] = []
        if configured:
            seed.append(configured)
        seed.extend(_BASE_DEFAULTS)
        seed.extend(_NAMED_DEFAULTS)
        for url in seed:
            u = _normalize(url)
            if u and u not in ordered:
                ordered.append(u)
        return ordered

    def _load(self) -> Dict[str, Any]:
        """Load {endpoints, current} from the store, seeding defaults once.

        On a SEED_VERSION bump, the current defaults are merged ONCE into an
        already-persisted list (new endpoints appended, existing order kept),
        so existing installs pick up new defaults without re-adding any the user
        has since removed. Endpoints that used to be defaults but no longer are
        (e.g. the old 192.168.50.x) simply become removable ``custom`` rows.
        """
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
        stored_seed_version = int(section.get("seed_version") or 0)
        if not endpoints:
            endpoints = self._default_candidates()
            self._save(endpoints, current)
            ColorPrint.blue(
                f"[LaravelEndpoints] Seeded {len(endpoints)} default endpoint(s)")
        elif stored_seed_version < SEED_VERSION:
            # One-time migration: drop unwanted 192.168.* endpoints (localhost is
            # already merged into 127.0.0.1 by _normalize), then append any new
            # defaults missing from the list.
            pruned = [u for u in endpoints if "//192.168." in u]
            if pruned:
                endpoints = [u for u in endpoints if u not in pruned]
                if current in pruned:
                    current = None  # stored choice was pruned -> let resolve re-pick
            added = [u for u in self._default_candidates() if u not in endpoints]
            if added:
                endpoints = endpoints + added
            self._save(endpoints, current)
            ColorPrint.blue(
                f"[LaravelEndpoints] Migrated to seed v{SEED_VERSION} "
                f"(-{len(pruned)} legacy, +{len(added)} default endpoint(s))")
        if current and current not in endpoints:
            endpoints = [current] + endpoints
        return {"endpoints": endpoints, "current": current}

    @staticmethod
    def _save(endpoints: List[str], current: Optional[str]) -> None:
        """Persist {endpoints, current, seed_version} to user_data.json."""
        get_user_data_store().set_section(
            USER_DATA_SECTION,
            {"endpoints": list(endpoints), "current": current,
             "seed_version": SEED_VERSION})

    # ----------------------------------------------------------------- #
    # Probing                                                            #
    # ----------------------------------------------------------------- #
    def probe(self, url: str, timeout: Optional[float] = None) -> Dict[str, Any]:
        """Probe ONE endpoint via GET {url}/api/health.

        ``timeout`` defaults to PROBE_TIMEOUT (sweep budget); callers probing the
        single known-good endpoint may pass a longer one (STORED_PROBE_TIMEOUT).
        Returns {url, healthy, latency_ms, last_checked, status, error} and
        records the result for lazy reuse by list/add/remove/select. Healthy =
        any HTTP status < 500 (the dashboard's "reachable counts as healthy").
        Never raises.
        """
        result = _probe_endpoint({"url": url, "timeout": timeout or PROBE_TIMEOUT})
        normalized_url = result.get("url") or ""
        if normalized_url:
            self._probe_results[normalized_url] = dict(result)
        return result

    def _probe_many(self, urls: List[str]) -> Dict[str, Dict[str, Any]]:
        """Probe several endpoints in PARALLEL (each capped at PROBE_TIMEOUT).

        Total wall time stays ~PROBE_TIMEOUT, keeping laravel_api.list fast.
        """
        urls = [u for u in dict.fromkeys(_normalize(u) for u in urls) if u]
        if not urls:
            return {}
        payloads = [{"url": url, "timeout": PROBE_TIMEOUT} for url in urls]
        probed = map_bus_tasks(
            _probe_endpoint,
            payloads,
            max_workers=len(payloads),
            thread_prefix="LaravelEndpointProbe",
            timeout=PROBE_TIMEOUT + 2.0,
        )
        results = {
            result["url"]: result
            for result in probed
            if isinstance(result, dict) and result.get("url")
        }
        self._probe_results.update({url: dict(result) for url, result in results.items()})
        return results

    # ----------------------------------------------------------------- #
    # Resolution (stored-first -> sweep -> cache)                        #
    # ----------------------------------------------------------------- #
    def resolve(self) -> str:
        """Resolve the Laravel base URL. STORED-FIRST, then sweep, then cache.

        1. Return the in-process cached winner when present.
        2. Probe ONLY the stored ``current`` endpoint; healthy -> cache+return.
        3. Full parallel sweep of every candidate; first healthy in candidate
           order wins and is cached in-process only (only select() may persist
           ``current``, so a transient outage never overwrites the user's choice).
        4. All down: return the stored current (or first candidate) WITHOUT
           caching, so the next call retries (a short negative TTL prevents
           re-sweeping in a tight loop).

        Deliberately NOT a @serialized_method: the probes below can hold for
        ~30s (stored-first retry + full sweep) against dead endpoints. On the
        serialized state-owner thread that queued every RPC-facing call
        (select/list_endpoints/get_active_base_url) behind the sweep, so the
        pycore-manager endpoint switch timed out and looked stuck. Probes now
        run on the CALLING thread, single-flight via a THREAD_BUS guard; a
        concurrent caller degrades to the stored fallback for that round.
        """
        if self._resolved:
            return self._resolved
        state = self._load()
        endpoints: List[str] = state["endpoints"]
        current: Optional[str] = state["current"]
        fallback = current or (endpoints[0] if endpoints else "http://127.0.0.1:9000")

        # Negative cache: a recent sweep found nothing — don't re-probe yet.
        if time.monotonic() - self._failed_sweep_at < FAILED_SWEEP_TTL:
            return fallback

        # Single-flight guard: only one thread runs the probe cycle; any
        # concurrent caller uses the fallback for this round.
        if THREAD_BUS.get_signal(_RESOLVING_SIGNAL, False):
            return fallback
        THREAD_BUS.signal(_RESOLVING_SIGNAL, True)
        try:
            # 1) stored-first: try ONLY the persisted choice, with a forgiving
            #    budget and one retry so a cold-start first hit (worker warm-up
            #    ~4-5s) does not needlessly fail the happy path and trigger a
            #    full LAN sweep.
            if current:
                res = {}
                for attempt in range(STORED_PROBE_RETRIES + 1):
                    res = self.probe(current, timeout=STORED_PROBE_TIMEOUT)
                    if res.get("healthy"):
                        self._resolved = current
                        return current
                    if attempt < STORED_PROBE_RETRIES:
                        ColorPrint.yellow(
                            f"[LaravelEndpoints] Stored endpoint {current} probe "
                            f"failed ({res.get('error')}); retrying once (warm-up)")
                ColorPrint.yellow(
                    f"[LaravelEndpoints] Stored endpoint {current} unhealthy "
                    f"({res.get('error')}) — sweeping {len(endpoints)} candidate(s)")

            # 2) full sweep (parallel, ~PROBE_TIMEOUT wall time); first healthy in order wins.
            sweep = self._probe_many(endpoints)
            winner = next((u for u in endpoints if sweep.get(u, {}).get("healthy")), None)
            if winner:
                self._resolved = winner
                if winner != current:
                    # Cache in-process only; only select() may persist ``current``.
                    ColorPrint.green(f"[LaravelEndpoints] Switched to {winner} (cached)")
                return winner

            # 3) nothing healthy — degrade to the stored/first candidate, uncached.
            self._failed_sweep_at = time.monotonic()
            ColorPrint.yellow(
                f"[LaravelEndpoints] No healthy Laravel endpoint among "
                f"{len(endpoints)} candidate(s); falling back to {fallback}")
            return fallback
        finally:
            THREAD_BUS.clear_signal(_RESOLVING_SIGNAL)

    @serialized_method
    def peek_stored_base_url(self) -> str:
        """Return the stored/current Laravel base URL — zero network I/O."""
        state = self._load()
        current: Optional[str] = state["current"]
        endpoints: List[str] = state["endpoints"]
        return current or (endpoints[0] if endpoints else "http://127.0.0.1:9000")

    @serialized_method
    def get_active_base_url(self) -> str:
        """Last-known healthy Laravel base URL — zero network I/O.

        Prefer the in-process resolve() winner (set by heartbeat / worker polls);
        fall back to the stored UI selection when nothing is cached yet.
        """
        if self._resolved:
            return self._resolved
        return self.peek_stored_base_url()

    def resolve_for_ui(self, *, skip_probe: bool = False) -> str:
        """Fast resolve for hot HTTP paths — no parallel sweep, no warm-up retry.

        When ``skip_probe`` is True (monitor already knows Laravel is down),
        returns the stored URL immediately. Otherwise probes ONLY the stored
        endpoint once with a short timeout.

        Deliberately NOT a @serialized_method (same rationale as resolve): its
        single bounded probe must never queue behind other work on the state
        owner. peek_stored_base_url() stays serialized and is network-free.
        """
        if self._resolved:
            return self._resolved
        fallback = self.peek_stored_base_url()
        if skip_probe:
            return fallback
        state = self._load()
        current: Optional[str] = state["current"]
        if time.monotonic() - self._failed_sweep_at < FAILED_SWEEP_TTL:
            return fallback
        if time.monotonic() - self._ui_failed_at < UI_NEGATIVE_TTL:
            return fallback
        if current:
            res = self.probe(current, timeout=UI_PROBE_TIMEOUT)
            if res.get("healthy"):
                self._resolved = current
                return current
        if self._resolved:
            return self._resolved
        for url in state.get("endpoints") or []:
            last = self._probe_results.get(url) or {}
            if last.get("healthy"):
                self._resolved = url
                return url
        self._ui_failed_at = time.monotonic()
        return fallback

    @serialized_method
    def invalidate(self) -> None:
        """Drop the in-process resolve cache (after select/add/remove)."""
        self._resolved = None
        self._failed_sweep_at = 0.0
        self._ui_failed_at = 0.0

    def register_endpoint_change_listener(self, callback: Callable[[str], None]) -> None:
        """Register a callback invoked when select() confirms a healthy new endpoint.

        The callback receives the new base URL (no trailing slash). Callbacks are
        called synchronously in select() on the state-owner thread; they must be
        fast and exception-safe.
        """
        if callback not in self._endpoint_change_listeners:
            self._endpoint_change_listeners.append(callback)

    def _notify_endpoint_changed(self, new_url: str) -> None:
        """Invoke all registered listeners (best-effort, never raises)."""
        for cb in list(self._endpoint_change_listeners):
            try:
                cb(new_url)
            except Exception as exc:  # noqa: BLE001
                ColorPrint.yellow(
                    f"[LaravelEndpoints] endpoint-change listener {cb!r} raised: {exc}"
                )

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

    @serialized_method
    def list_endpoints(self, probe: bool = True) -> Dict[str, Any]:
        """Full endpoint listing for the UI; probes all in parallel by default.

        Returns {success, endpoints:[{url, healthy, latency_ms, last_checked,
        status, error}], current, resolved}. With ``probe=False`` it reuses the
        last known probe results instead (fast, no network).
        """
        state = self._load()
        if probe:
            self._probe_many(state["endpoints"])
        resolved = self._resolved
        return {
            "success": True,
            "endpoints": self._endpoint_rows(state["endpoints"]),
            "current": state["current"],
            "resolved": resolved,
        }

    @serialized_method
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

    @serialized_method
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

    @serialized_method
    def select(self, url: str) -> Dict[str, Any]:
        """Persist ``url`` as the user's stored choice (adds it when missing).

        Invalidates the resolve cache so the NEXT resolve() re-probes
        stored-first against the new choice. Also probes the selection once so
        the response carries fresh health info for the UI. When the new endpoint
        is healthy, all registered endpoint-change listeners are notified
        immediately so singleton workers re-register without waiting for their
        next heartbeat tick.
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
            # Selection is live — pre-warm the resolve cache and notify workers.
            self._resolved = u
            self._notify_endpoint_changed(u)
        ColorPrint.green(
            f"[LaravelEndpoints] Selected {u} "
            f"({'healthy' if probe_res.get('healthy') else 'UNHEALTHY'})")
        return {"success": True,
                "endpoints": self._endpoint_rows(endpoints),
                "current": u,
                "selected": probe_res}

    @serialized_method
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
class _LaravelEndpointManagerProvider:
    """Create and retain the manager on one THREAD_BUS state owner."""

    def __init__(self) -> None:
        self._manager: Optional[LaravelEndpointManager] = None
        init_serialized_owner(
            self,
            "laravel_endpoint_manager.provider",
            "LaravelEndpointManagerProvider",
        )

    @serialized_method
    def get(self) -> LaravelEndpointManager:
        if self._manager is None:
            self._manager = LaravelEndpointManager()
        return self._manager


_manager_provider = _LaravelEndpointManagerProvider()


def get_laravel_endpoint_manager() -> LaravelEndpointManager:
    """Return the process-wide LaravelEndpointManager singleton."""
    return _manager_provider.get()


def resolve_laravel_base_url() -> str:
    """Shared Laravel base URL for all pycore services (UI-selected, stored-first)."""
    return get_laravel_endpoint_manager().resolve()


def register_endpoint_change_listener(callback: Callable[[str], None]) -> None:
    """Register a callback on the process-wide endpoint manager (module-level helper)."""
    get_laravel_endpoint_manager().register_endpoint_change_listener(callback)
