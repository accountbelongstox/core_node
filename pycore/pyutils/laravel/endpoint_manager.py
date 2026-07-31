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

Persistence lives in the backend data directory as
``laravel_endpoint_cache.json`` under the ``laravel_api`` section:

    "laravel_api": {
        "backend_endpoints": ["http://127.0.0.1:9000", ...],
        "frontend_endpoints": ["https://frontend-default.example", ...],
        "endpoints": ["http://127.0.0.1:9000", ...],
        "current": "http://127.0.0.1:9000"        # or null
    }

The pycore-manager frontend owns the prepared endpoint catalog and supplies it
to ``laravel_api.list``. Backend endpoints and the backend-selected ``current``
value are merged first and therefore override frontend defaults. The merged
catalog is cached here so backend workflows continue to resolve endpoints when
the UI is disconnected. The legacy ``user_data.json`` section is read once as
a migration source when the data-directory cache does not exist yet.

Health probe: GET {base}/api/health — laravel_main's liveness-only route
(routes/api.php; no DB, no auth, heavy middleware stripped). The parallel sweep
uses a 6.0s cap (remote tailscale/cloud candidates exceed 3s on a cold hit); the
stored-first probe of the single known-good endpoint uses a more forgiving 12.0s
+ one retry so a cold-start first hit (Octane worker warm-up ~4-5s) does not
needlessly fail the happy path and trigger a sweep. Per the dashboard rule
("reachable counts as healthy") any HTTP status < 500 is healthy.

Architecture / layering (pycore rules):
  * Shared Laravel domain, consumed by application workflows and RPC adapters.
    All imports stay at file top.
  * Logging only via ColorPrint; networking via the lazily-loaded third-party
    ``requests`` (pycore.pyfoundations.third_party), never a bare import.
"""

import re
import time
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    map_bus_tasks,
    start_bus_task,
    serialized_method,
)
from pycore.pyfoundations.system_paths import APP_DATA_DIR
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyutils.common.service_config import LARAVEL_WORKER_API_URL
from pycore.pyutils.common.user_data_store import UserDataStore, user_data_store
from pycore.pyutils.laravel.http_recorder import laravel_http_recorder
from pycore.pyutils.laravel.identity import (
    LARAVEL_HEALTH_SERVICE,
    build_pycore_identity_headers,
)


# --------------------------------------------------------------------------- #
# Constants                                                                    #
# --------------------------------------------------------------------------- #
# Cache section this manager owns.
ENDPOINT_CACHE_SECTION = "laravel_api"
ENDPOINT_CACHE_FILE_NAME = "laravel_endpoint_cache.json"
FALLBACK_ENDPOINT = "http://127.0.0.1:9000"
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
# THREAD_BUS single-flight guard for background health sweeps kicked by
# list_endpoints/probe_route (never run on the state-owner thread).
_SWEEPING_SIGNAL = "laravel_endpoint_manager.sweeping"

endpoint_cache_store = UserDataStore(
    base_dir=APP_DATA_DIR,
    file_name=ENDPOINT_CACHE_FILE_NAME,
)


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


def _normalize_candidates(values: Any) -> List[str]:
    """Normalize and de-duplicate a JSON endpoint array in source order."""
    ordered: List[str] = []
    if not isinstance(values, list):
        return ordered
    for value in values:
        normalized = _normalize(value if isinstance(value, str) else None)
        if normalized and normalized not in ordered:
            ordered.append(normalized)
    return ordered


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
        resp = requests.get(
            url + HEALTH_PATH,
            headers=build_pycore_identity_headers(),
            timeout=timeout,
        )
        result["latency_ms"] = int((time.monotonic() - started) * 1000)
        result["status"] = resp.status_code
        content_type = (resp.headers.get("Content-Type") or "").lower()
        body = resp.json() if "application/json" in content_type else {}
        result["healthy"] = (
            200 <= resp.status_code < 300
            and isinstance(body, dict)
            and body.get("service") == LARAVEL_HEALTH_SERVICE
        )
        if resp.status_code < 200 or resp.status_code >= 300:
            result["error"] = f"HTTP {resp.status_code}"
        elif not result["healthy"]:
            result["error"] = "Unrecognized Laravel endpoint"
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
    laravel_http_recorder.notify({
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
    # Catalog / persistence                                              #
    # ----------------------------------------------------------------- #
    @staticmethod
    def _configured_candidates() -> List[str]:
        """Return the backend runtime override, independent of UI defaults."""
        return _normalize_candidates([LARAVEL_WORKER_API_URL])

    @staticmethod
    def _merge_candidates(*groups: List[str]) -> List[str]:
        """Merge endpoint groups in priority order without duplicates."""
        merged: List[str] = []
        for group in groups:
            for url in group:
                if url and url not in merged:
                    merged.append(url)
        return merged

    def _load(self, frontend_endpoints: Optional[List[str]] = None) -> Dict[str, Any]:
        """Load backend state and optionally synchronize the frontend catalog.

        Backend-owned endpoints are ordered before frontend defaults. A supplied
        frontend catalog replaces the previous frontend snapshot, while custom
        backend entries and the backend-selected current URL are preserved.
        """
        cache_file_exists = endpoint_cache_store.path.is_file()
        section = endpoint_cache_store.get_section(ENDPOINT_CACHE_SECTION) or {}
        migrated = False
        if not section and not cache_file_exists:
            section = user_data_store.get_section(ENDPOINT_CACHE_SECTION) or {}
            migrated = bool(section)

        stored_endpoints = _normalize_candidates(section.get("endpoints"))
        cached_frontend = _normalize_candidates(section.get("frontend_endpoints"))
        incoming_frontend = _normalize_candidates(frontend_endpoints)
        frontend_supplied = isinstance(frontend_endpoints, list)
        active_frontend = incoming_frontend if frontend_supplied else cached_frontend
        raw_backend = section.get("backend_endpoints")
        if isinstance(raw_backend, list):
            backend_endpoints = _normalize_candidates(raw_backend)
            if frontend_supplied and not cached_frontend:
                backend_endpoints = [
                    url for url in backend_endpoints if url not in active_frontend
                ]
        else:
            backend_endpoints = [
                url for url in stored_endpoints if url not in active_frontend
            ]

        configured = self._configured_candidates()
        backend_endpoints = self._merge_candidates(configured, backend_endpoints)
        current = _normalize(section.get("current")) or None
        if current and current not in backend_endpoints and current not in active_frontend:
            backend_endpoints.insert(0, current)
        if not backend_endpoints and not active_frontend:
            backend_endpoints = [FALLBACK_ENDPOINT]
        endpoints = self._merge_candidates(backend_endpoints, active_frontend)

        cached_state_changed = (
            migrated
            or section.get("backend_endpoints") != backend_endpoints
            or section.get("frontend_endpoints") != active_frontend
            or section.get("endpoints") != endpoints
            or section.get("current") != current
        )
        if cached_state_changed:
            self._save(backend_endpoints, active_frontend, current)
            if migrated:
                ColorPrint.blue(
                    "[LaravelEndpoints] Migrated endpoint cache to backend data directory"
                )
        return {
            "backend_endpoints": backend_endpoints,
            "frontend_endpoints": active_frontend,
            "endpoints": endpoints,
            "current": current,
        }

    @staticmethod
    def _save(
        backend_endpoints: List[str],
        frontend_endpoints: List[str],
        current: Optional[str],
    ) -> None:
        """Persist backend overrides and the frontend catalog snapshot."""
        endpoints = LaravelEndpointManager._merge_candidates(
            backend_endpoints,
            frontend_endpoints,
        )
        endpoint_cache_store.set_section(
            ENDPOINT_CACHE_SECTION,
            {
                "backend_endpoints": list(backend_endpoints),
                "frontend_endpoints": list(frontend_endpoints),
                "endpoints": endpoints,
                "current": current,
            },
        )

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
            self._record_probe_results({normalized_url: result})
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
        self._record_probe_results(results)
        return results

    @serialized_method
    def _record_probe_results(self, results: Dict[str, Dict[str, Any]]) -> None:
        """Record probe outcomes on the state-owner thread. Probing itself runs
        on calling/bus threads (never the owner); this network-free hop is the
        ONLY mutation path for _probe_results, keeping the owner instant."""
        for url, result in (results or {}).items():
            if url and isinstance(result, dict):
                self._probe_results[url] = dict(result)


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
        fallback = current or (endpoints[0] if endpoints else FALLBACK_ENDPOINT)

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

    def peek_stored_base_url(self) -> str:
        """Return the stored URL from the in-process user-data snapshot."""
        state = self._load()
        current: Optional[str] = state["current"]
        endpoints: List[str] = state["endpoints"]
        return current or (endpoints[0] if endpoints else FALLBACK_ENDPOINT)

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
        invoked from _finish_select on a background bus task (NEVER the
        state-owner thread); they must still be fast and exception-safe.
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
    def _endpoint_rows(
        self,
        endpoints: List[str],
        frontend_endpoints: List[str],
    ) -> List[Dict[str, Any]]:
        """Rows for the RPC contract, using the LAST KNOWN probe results.

        ``custom`` marks backend-added URLs as removable. Frontend catalog URLs,
        the configured backend override, and the technical fallback are protected.
        """
        protected = set(frontend_endpoints)
        protected.update(self._configured_candidates())
        protected.add(FALLBACK_ENDPOINT)
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
                "custom": u not in protected,
            })
        return rows

    @serialized_method
    def list_endpoints(
        self,
        probe: bool = True,
        frontend_endpoints: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Full endpoint listing for the UI - ALWAYS instant.

        NEVER performs network I/O on this state-owner thread: a parallel
        sweep can hold for seconds against dead endpoints, and every other
        manager caller (get_active_base_url / peek_stored_base_url - used by
        the queue monitor, assist overview, workers and the Queue Center
        snapshot) queued behind it, which is what made one laravel_api.list
        stall the whole backend data plane. ``probe=True`` kicks the sweep
        onto a background bus task and returns LAST KNOWN health immediately;
        fresh results land via _record_probe_results and surface on the next
        list/probe. ``probe=False`` skips the sweep entirely.
        """
        state = self._load(frontend_endpoints)
        if probe:
            self._kick_probe_sweep(state["endpoints"])
        return {
            "success": True,
            "endpoints": self._endpoint_rows(
                state["endpoints"],
                state["frontend_endpoints"],
            ),
            "current": state["current"],
            "resolved": self._resolved,
        }

    def _kick_probe_sweep(self, urls: List[str]) -> None:
        """Fire-and-forget parallel sweep on a bus task (single-flight via a
        THREAD_BUS guard); results are recorded through _record_probe_results.
        Safe to call from the state-owner thread - returns immediately."""
        urls = [u for u in dict.fromkeys(_normalize(u) for u in urls) if u]
        if not urls:
            return
        if THREAD_BUS.get_signal(_SWEEPING_SIGNAL, False):
            return
        THREAD_BUS.signal(_SWEEPING_SIGNAL, True)

        def _run() -> None:
            try:
                self._probe_many(urls)
            except Exception as exc:  # noqa: BLE001
                ColorPrint.yellow(f"[LaravelEndpoints] background sweep failed: {exc}")
            finally:
                THREAD_BUS.clear_signal(_SWEEPING_SIGNAL)

        start_bus_task(_run, thread_name="laravel-endpoint-sweep")

    @serialized_method
    def add(self, url: str) -> Dict[str, Any]:
        """Add a candidate endpoint (idempotent); invalidates the cache."""
        u = _normalize(url)
        if not u:
            return {"success": False, "error": "url is required"}
        state = self._load()
        endpoints: List[str] = state["endpoints"]
        if u not in endpoints:
            backend_endpoints = list(state["backend_endpoints"])
            backend_endpoints.append(u)
            self._save(
                backend_endpoints,
                state["frontend_endpoints"],
                state["current"],
            )
            endpoints = self._merge_candidates(
                backend_endpoints,
                state["frontend_endpoints"],
            )
            ColorPrint.blue(f"[LaravelEndpoints] Added endpoint {u}")
        self.invalidate()
        return {"success": True,
                "endpoints": self._endpoint_rows(endpoints, state["frontend_endpoints"]),
                "current": state["current"]}

    @serialized_method
    def remove(self, url: str) -> Dict[str, Any]:
        """Remove a candidate; clears ``current`` if it pointed at it.

        The frontend catalog and configured backend override are protected.
        A technical loopback fallback is retained when no candidates remain.
        """
        u = _normalize(url)
        if not u:
            return {"success": False, "error": "url is required"}
        state = self._load()
        if u in state["frontend_endpoints"] or u in self._configured_candidates():
            return {"success": False, "error": "protected endpoint cannot be removed"}
        backend_endpoints = [e for e in state["backend_endpoints"] if e != u]
        current = state["current"]
        if current == u:
            current = None
        if not backend_endpoints and not state["frontend_endpoints"]:
            backend_endpoints = [FALLBACK_ENDPOINT]
        endpoints = self._merge_candidates(
            backend_endpoints,
            state["frontend_endpoints"],
        )
        self._save(backend_endpoints, state["frontend_endpoints"], current)
        self.invalidate()
        ColorPrint.blue(f"[LaravelEndpoints] Removed endpoint {u}")
        return {"success": True,
                "endpoints": self._endpoint_rows(endpoints, state["frontend_endpoints"]),
                "current": current}

    @serialized_method
    def select(self, url: str) -> Dict[str, Any]:
        """Persist ``url`` as the user's stored choice (adds it when missing).

        State mutation (persist + invalidate) happens here on the owner
        thread - instant. The health probe and the endpoint-change listener
        fan-out run on a background bus task (_finish_select): network I/O
        on the state-owner thread stalled every other manager caller behind
        it. The response therefore carries LAST KNOWN health in ``selected``;
        the FE re-lists after mutating (PycoreLaravelApi contract) and picks
        up the fresh probe on that pass.
        """
        u = _normalize(url)
        if not u:
            return {"success": False, "error": "url is required"}
        state = self._load()
        endpoints: List[str] = state["endpoints"]
        if u not in endpoints:
            backend_endpoints = list(state["backend_endpoints"])
            backend_endpoints.append(u)
            endpoints = self._merge_candidates(
                backend_endpoints,
                state["frontend_endpoints"],
            )
        else:
            backend_endpoints = state["backend_endpoints"]
        self._save(backend_endpoints, state["frontend_endpoints"], u)
        self.invalidate()
        start_bus_task(lambda: self._finish_select(u), thread_name="laravel-endpoint-select")
        ColorPrint.green(f"[LaravelEndpoints] Selected {u} (probe in background)")
        return {"success": True,
                "endpoints": self._endpoint_rows(endpoints, state["frontend_endpoints"]),
                "current": u,
                "selected": dict(self._probe_results.get(u) or {"url": u})}

    def _finish_select(self, u: str) -> None:
        """Off-owner select completion: probe the choice; when healthy, cache
        it as the resolver winner and notify endpoint-change listeners so
        singleton workers re-register without waiting for their next tick."""
        probe_res = self.probe(u)
        if probe_res.get("healthy"):
            self._mark_resolved(u)
            self._notify_endpoint_changed(u)
        else:
            ColorPrint.yellow(
                f"[LaravelEndpoints] Selected endpoint {u} UNHEALTHY: {probe_res.get('error')}")

    @serialized_method
    def _mark_resolved(self, u: str) -> None:
        """Cache the healthy selection on the state-owner thread."""
        self._resolved = u

    @serialized_method
    def probe_route(self, url: Optional[str] = None) -> Dict[str, Any]:
        """RPC-facing probe: ONE url when given, else ALL candidates.

        Refreshes run in the BACKGROUND (never on the state-owner thread);
        the response carries last-known health immediately and callers
        re-list to pick up fresh results (see laravel_api_routes).
        """
        if url and str(url).strip():
            target = str(url)
            start_bus_task(lambda: self.probe(target), thread_name="laravel-endpoint-probe")
            normalized = _normalize(target)
            return {"success": True,
                    "endpoint": dict(self._probe_results.get(normalized) or {"url": normalized})}
        state = self._load()
        self._kick_probe_sweep(state["endpoints"])
        return {"success": True,
                "endpoints": self._endpoint_rows(
                    state["endpoints"],
                    state["frontend_endpoints"],
                ),
                "current": state["current"]}


# --- module-level shared instance ------------------------------------------ #
laravel_endpoint_manager = LaravelEndpointManager()


