# -*- coding: utf-8 -*-
"""
BaseLaravelWorkerService

Shared scaffold for pycore workers that integrate with the Laravel backend's
generic "worker task" API (/api/worker/register|heartbeat|tasks/pull|tasks/result).

Extracted verbatim (behavior-preserving) from the former translation_worker_service.py
monolith. Holds the parts that are IDENTICAL across the Laravel-pulled workers:

  - THREAD_BUS-backed mutable worker state.
  - Stable hostname-based worker_id + candidate Laravel base-URL discovery.
  - Lazy third-party ``requests`` accessor + noisy-exception condenser.
  - One-shot "no reachable Laravel" connection-failure hint.
  - register / heartbeat / pull / _post_result HTTP with retry + circuit breaker.

The concrete subclass (TranslationWorkerService) supplies:
  - worker_name, _log_prefix (set in __init__ before any base HTTP method runs)
  - _effective_processor_types() / _effective_capabilities() (lane gating)
  - the lane-specific task processing

The word/sentence source-queue workers are intentionally outside this base:
they claim domain rows through dedicated claim/report contracts rather than the
GlobalTask worker wire model. Shared Laravel transport still goes through
LaravelClient; every generic /api/worker/* consumer belongs in this base.
"""

import os
import platform
import socket
import time
from typing import Any, Dict, List, Optional

# ColorPrint is the only allowed logger in pycore processors/services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
# requests is a third-party dep - always obtained through the lazy accessor.
from pycore.pyfoundations.third_party.api import get_third_package_requests
from pycore.pyutils.laravel.endpoint_manager import (
    laravel_endpoint_manager,
)
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_STATUSES_BY_ROLE,
    GLOBAL_TASK_WORKER_RESULT_STATUSES,
)


class BaseLaravelWorkerService:
    """
    Base class for Laravel-pulled pycore workers (register/heartbeat/pull/result).

    Concrete singleton construction is handled by a THREAD_BUS-backed provider.
    """

    # Default inflight TTL when a task carries no timeout_seconds: a re-offered
    # task becomes claimable again after this long even if its executor hung.
    INFLIGHT_DEFAULT_TTL = 300

    # Result-POST retry plan: a lost result leaves the task "assigned" on the
    # Laravel side until its timeout release, so transient failures (SQLite
    # "database is locked" -> HTTP 500, brief network blips) are worth retrying
    # here. 4xx responses are NOT retried: 409 means the task was reassigned /
    # not ours (another worker owns it now), other 4xx are contract errors a
    # retry cannot fix.
    RESULT_POST_ATTEMPTS = 3
    RESULT_POST_BACKOFF_SECONDS = (0.5, 1.5)

    # ---- Backend circuit breaker ----
    # A persistent SERVER-SIDE result-POST failure (HTTP 5xx every attempt) means
    # the backend cannot accept results AT ALL - e.g. a missing/broken table after
    # a half-finished DB migration. Without a breaker the worker keeps pulling and
    # re-translating every tick, burning LLM calls and flooding the broken backend
    # for results it can never store (the words never get marked done, so the
    # Laravel scanner re-enqueues them forever - an unbounded spiral that exhausted
    # the box once). After N consecutive server-side give-ups the breaker OPENS:
    # poll_once stops PULLING (still heartbeats to stay registered) for a cooldown,
    # then probes again. ANY accepted result resets it. 4xx/409 never trip it
    # (those are per-task, not backend-wide).
    CIRCUIT_FAIL_THRESHOLD = 3
    CIRCUIT_COOLDOWN_SECONDS = 120

    # -------------------- base init (called by subclass __init__) --------------------

    def _init_base_laravel(self, laravel_api_url: str) -> None:
        """Initialize the shared Laravel-worker scaffold.

        The concrete subclass __init__ calls this FIRST, then sets its own
        worker_name / _log_prefix / lane-specific state. Idempotent guard
        (_initialized) is the subclass's responsibility (it owns the full
        __init__ contract).
        """
        # Candidate Laravel base URLs from LaravelEndpointManager (same source as
        # the pycore-manager Laravel endpoint UI). Stored-first resolve() picks the
        # user's selection; the full candidate list is the registration sweep.
        self._candidates: List[str] = []
        self.api_url = self._sync_laravel_endpoint(laravel_api_url)
        self.worker_id = self._build_worker_id()
        self.hostname = socket.gethostname()
        self.platform = platform.platform()

        self._registered = False
        # Connection-failure bookkeeping so we emit ONE clear "no reachable
        # Laravel" hint instead of a stack trace on every heartbeat tick.
        self._conn_fail_streak = 0
        self._conn_unreachable_warned = False
        # Backend circuit breaker state (see CIRCUIT_* constants). Streak counts
        # CONSECUTIVE server-side (HTTP 5xx) result-POST give-ups; the circuit is
        # open while monotonic time() < _circuit_open_until.
        self._result_5xx_streak = 0
        self._circuit_open_until = 0.0
        self._circuit_warned = False
        # Guards against dispatching the same task to two background threads while
        # an earlier dispatch is still in flight.
        # task_id -> monotonic deadline. A hung executor (semaphore block or a
        # stalled engine) used to leak the entry forever, so after Laravel's lease
        # timeout re-offered the task THIS worker skipped it until restart. Now
        # each entry carries a deadline (now + task.timeout_seconds, default
        # INFLIGHT_DEFAULT_TTL) and expired entries are purged before the skip
        # check, so a re-offered task can be claimed again.
        self._inflight: Dict[str, float] = {}
        # The serialized worker owns every mutation of this store.
        self._http_timeout = 8  # seconds for register/heartbeat/pull/result calls

        # Log prefix - subclass overrides (e.g. "[TranslationWorker]"). Default
        # keeps base-only usage legible.
        self._log_prefix = "[LaravelWorker]"
        init_serialized_owner(
            self,
            "translation.worker.state",
            "TranslationWorkerState",
            timeout=60.0,
        )
        # Register for immediate notification when the user switches endpoint in
        # the UI so we re-register on the NEXT heartbeat tick instead of waiting
        # for the worker to naturally detect the URL change.
        laravel_endpoint_manager.register_endpoint_change_listener(
            self.on_endpoint_changed
        )

    def on_endpoint_changed(self, new_url: str) -> None:
        """Immediately reset registration state when the Laravel endpoint changes.

        Called synchronously by LaravelEndpointManager.select() the moment the user
        confirms a new endpoint. On the next poll_once() tick _register() will use
        ``new_url`` instead of the stale one, so the worker re-appears on Laravel
        within one heartbeat interval rather than waiting out the old endpoint.
        """
        prev = self.api_url
        self.api_url = new_url.rstrip("/")
        self._registered = False
        self._conn_fail_streak = 0
        self._conn_unreachable_warned = False
        ColorPrint.blue(
            f"{self._log_prefix} Endpoint changed {prev!r} → {new_url!r}; "
            "will re-register on next tick"
        )

    # -------------------- identity --------------------

    @staticmethod
    def _build_worker_id() -> str:
        """
        Stable, hostname-based worker id (same across restarts on a host).

        MULTI-INSTANCE NOTE: Laravel keys claims/heartbeats by worker_id, so two
        pycore processes on the SAME host must not share one. Atomic task claim
        still prevents double work either way, but a shared id corrupts per-worker
        accounting (current_task_id, completed/failed counters) and offline
        detection. When running more than one pycore per host, set
        PYCORE_WORKER_INSTANCE to a stable per-instance tag (e.g. its rpc port);
        it is appended to the id. Single-instance hosts need no env and keep the
        old stable id.

        NOTE: the concrete TranslationWorkerService overrides this to prefix the
        id with "pycore-translate-"; the base form here is the generic fallback
        for future sibling retrofit.
        """
        host = socket.gethostname() or "host"
        safe = "".join(c if (c.isalnum() or c in "-_") else "-" for c in host).lower()
        instance = (os.getenv("PYCORE_WORKER_INSTANCE") or "").strip()
        if instance:
            safe_instance = "".join(
                c if (c.isalnum() or c in "-_") else "-" for c in instance
            ).lower()
            return f"pycore-worker-{safe}-{safe_instance}"
        return f"pycore-worker-{safe}"

    @staticmethod
    def _local_ipv4s() -> List[str]:
        """Best-effort list of this machine's non-loopback IPv4 addresses, used to
        decide whether a hardcoded LAN fallback is reachable (same subnet) before
        adding it as a candidate. Never raises."""
        ips = set()
        try:
            for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
                addr = (info[4] or [None])[0]
                if addr and not addr.startswith("127."):
                    ips.add(addr)
        except Exception:
            pass
        return sorted(ips)

    @staticmethod
    def _host_of(url: str) -> str:
        """Bare host (no scheme / port / path) from a URL."""
        host = (url or "").split("://", 1)[-1].split("/", 1)[0]
        return host.rsplit(":", 1)[0] if ":" in host else host

    @classmethod
    def _on_local_subnet(cls, url: str, local_ips: List[str]) -> bool:
        """True when the URL's IPv4 host shares a /24 with one of this machine's
        local addresses - i.e. the LAN fallback's environment actually exists."""
        parts = cls._host_of(url).split(".")
        if len(parts) != 4 or not all(p.isdigit() for p in parts):
            return False
        prefix = ".".join(parts[:3]) + "."
        return any(ip.startswith(prefix) for ip in local_ips)

    def _sync_laravel_endpoint(self, fallback: str = "") -> str:
        """Refresh candidate list + resolved base from LaravelEndpointManager.

        Returns the resolved base URL (no trailing slash). When not yet
        registered, ``api_url`` is primed to this value so monitors that read
        the worker see the UI-selected endpoint immediately.
        """
        mgr = laravel_endpoint_manager
        base = (mgr.resolve() or "").rstrip("/")
        state = mgr._load()
        endpoints = [
            (u or "").rstrip("/")
            for u in (state.get("endpoints") or [])
            if (u or "").strip()
        ]
        ordered: List[str] = []
        if base:
            ordered.append(base)
        for u in endpoints:
            if u and u not in ordered:
                ordered.append(u)
        fb = (fallback or "").rstrip("/")
        if not ordered and fb:
            ordered.append(fb)
        if not ordered:
            ordered.append("http://127.0.0.1:9000")
        self._candidates = ordered
        if not getattr(self, "_registered", False):
            self.api_url = ordered[0]
        return ordered[0]

    @classmethod
    def _build_candidates(cls, primary: str) -> List[str]:
        """Deprecated: use LaravelEndpointManager via _sync_laravel_endpoint()."""
        mgr = laravel_endpoint_manager
        base = (mgr.resolve() or primary or "").rstrip("/")
        state = mgr._load()
        ordered: List[str] = []
        if base:
            ordered.append(base)
        for u in state.get("endpoints") or []:
            u = (u or "").rstrip("/")
            if u and u not in ordered:
                ordered.append(u)
        return ordered or ["http://127.0.0.1:9000"]

    # -------------------- HTTP helpers --------------------

    def _requests(self):
        """Lazily obtain the third-party requests module (pycore rule)."""
        return get_third_package_requests()

    @staticmethod
    def _short_err(exc: Exception) -> str:
        """
        Condense a noisy requests/urllib3 exception into a one-line reason, so we
        never dump a multi-line HTTPConnectionPool stack into the heartbeat log.
        """
        name = type(exc).__name__
        text = str(exc)
        low = text.lower()
        if "actively refused" in low or "refused" in low or "ConnectionRefused" in name:
            return "connection refused (Laravel not listening)"
        if "timed out" in low or "timeout" in low.replace("connecttimeout", ""):
            return "timed out"
        if "max retries" in low or "newconnectionerror" in low or "failed to establish" in low:
            return "host unreachable"
        if "name or service not known" in low or "getaddrinfo" in low:
            return "host not resolvable"
        return text.splitlines()[0][:120] if text else name

    # -------------------- Laravel worker API --------------------

    def _register(self) -> bool:
        """
        Register this worker with Laravel, discovering a reachable backend across
        the candidate URLs. The first candidate that answers is pinned as
        ``self.api_url`` for subsequent heartbeat/pull/result calls.

        Messaging: on success (or recovery) we log once. When NONE of the
        candidates are reachable we emit a single concise hint - "no reachable
        Laravel backend" with the tried list - and then stay quiet until the
        situation changes, instead of dumping a connection stack every tick.
        """
        resolved = self._sync_laravel_endpoint()
        if self._registered:
            if self.api_url.rstrip("/") == resolved.rstrip("/"):
                return True
            ColorPrint.blue(
                f"{self._log_prefix} Laravel endpoint changed "
                f"({self.api_url} -> {resolved}); re-registering")
            self._registered = False

        last_reason = ""
        processor_types = self._effective_processor_types()
        capabilities = self._effective_capabilities()
        for base in self._candidates:
            try:
                resp = laravel_client.post(
                    "/api/worker/register",
                    base_url=base,
                    json={
                        "worker_id": self.worker_id,
                        "worker_name": self.worker_name,
                        "processor_types": processor_types,
                        "capabilities": capabilities,
                        "hostname": self.hostname,
                        "platform": self.platform,
                    },
                    timeout=self._http_timeout,
                )
                if resp.status_code in (200, 201):
                    self.api_url = base
                    self._registered = True
                    self._advertised_processor_types = list(processor_types)
                    self._advertised_capabilities = list(capabilities)
                    if self._conn_unreachable_warned or self._conn_fail_streak:
                        ColorPrint.green(
                            f"{self._log_prefix} Reconnected to Laravel at {base} "
                            f"(after {self._conn_fail_streak} failed attempt(s))"
                        )
                    else:
                        ColorPrint.green(f"{self._log_prefix} Registered with Laravel at {base}")
                    self._conn_fail_streak = 0
                    self._conn_unreachable_warned = False
                    return True
                # Reachable but refused registration - report once, keep trying others.
                last_reason = f"HTTP {resp.status_code} from {base}"
            except Exception as e:
                last_reason = f"{base}: {self._short_err(e)}"
                continue

        # No candidate accepted us.
        self._conn_fail_streak += 1
        if not self._conn_unreachable_warned:
            self._conn_unreachable_warned = True
            ColorPrint.yellow(
                f"{self._log_prefix} No reachable Laravel backend - could not connect to any of "
                f"{self._candidates}. Last: {last_reason}. Will keep retrying quietly "
                "(select the Laravel endpoint in pycore-manager Settings)."
            )
        return False

    def _note_fast_signals(self, body: Optional[Dict[str, Any]]) -> None:
        """Record pending_fast / pending_urgent counters from a pull/heartbeat body.

        These steer the jittered fast-drain burst (pending_fast>0) and surface in
        get_queue_status() for routers/local. The concrete subclass initializes
        _pending_fast / _pending_urgent (the fast lane is translation-specific).
        """
        if not isinstance(body, dict):
            return
        try:
            self._pending_fast = int(body.get("pending_fast") or 0)
        except (TypeError, ValueError):
            self._pending_fast = 0
        try:
            self._pending_urgent = int(body.get("pending_urgent") or 0)
        except (TypeError, ValueError):
            self._pending_urgent = 0

    def _heartbeat(self) -> None:
        """Send a worker heartbeat (best-effort; a dropped connection forces
        re-discovery on the next tick rather than spamming the log).

        The heartbeat also carries the live capabilities (so Laravel keeps the
        worker's advertised set fresh) and its response carries pending_fast /
        pending_urgent which we fold into the fast-drain signal.
        """
        try:
            resp = laravel_client.post(
                "/api/worker/heartbeat",
                base_url=self.api_url,
                json={
                    "worker_id": self.worker_id,
                    "capabilities": self._effective_capabilities(),
                },
                timeout=self._http_timeout,
            )
            if resp is not None and getattr(resp, "status_code", 0) == 200:
                data = resp.json() or {}
                body = data.get("data") if isinstance(data.get("data"), dict) else data
                self._note_fast_signals(body)
        except Exception as e:
            # Laravel likely went away - drop registration so _register re-discovers
            # (and emits the single "no reachable Laravel" hint) next tick.
            self._registered = False
            ColorPrint.yellow(
                f"{self._log_prefix} Heartbeat failed ({self._short_err(e)}); will re-discover"
            )

    def _pull_tasks(self, base: Optional[str] = None, wait: int = 0) -> List[Dict[str, Any]]:
        """GET pending tasks for this worker. Returns [] on any error.

        NOT a @serialized_method: this performs network I/O (up to
        ``_http_timeout`` seconds against a dead endpoint). Running it on the
        serialized state-owner thread used to occupy the owner for the whole
        HTTP window, so every concurrent status read / heartbeat tick raised
        'Serialized operation timed out: translation.worker.state.*'. It only
        mutates plain scalars (_registered, _pending_fast/_pending_urgent via
        _note_fast_signals), which is safe from the single-flight poll/drain
        threads.

        ``wait`` MUST be sent (0 = immediate return; if omitted Laravel long-polls
        ~20s while the client's 8s HTTP timeout fires first). The fast-drain burst and
        the heartbeat tick both call this with wait=0 so a pull never blocks the loop.

        PRIORITY-SYNC NOTE: Laravel returns tasks in ``priority desc`` order, but the
        unified client ALSO folds every claimed task into a per-backend priority heap
        (so a bumped task drains first even if it arrived in an earlier pull). The pull
        response's pending_fast / pending_urgent counters are recorded to arm the
        jittered fast-drain burst, and the QueueMonitorService still surfaces bumps to
        the UI (`recently_bumped`). No task-processing logic is duplicated.

        Hardening (2026-06-22): only a real ConnectionError de-registers (forces
        re-discovery). A transient Timeout / other error just logs and stays
        registered - the next tick retries against the same pinned backend.
        """
        base = base or self.api_url
        try:
            resp = laravel_client.get(
                "/api/worker/tasks/pull",
                base_url=base,
                params={"worker_id": self.worker_id, "wait": wait},
                timeout=self._http_timeout,
            )
            if resp.status_code == 200:
                data = resp.json() or {}
                # Worker API wraps the payload: { success, data:{ count, tasks }, ... }.
                # Accept both the wrapped and a bare { tasks } shape.
                body = data.get("data") if isinstance(data.get("data"), dict) else data
                self._note_fast_signals(body)
                tasks = (body or {}).get("tasks", []) or []
                return tasks
            ColorPrint.yellow(f"{self._log_prefix} Pull returned HTTP {resp.status_code}")
        except Exception as e:
            # Distinguish a hard connection failure (backend gone -> re-discover)
            # from a transient blip (timeout / read error -> keep registration).
            conn_error_cls = None
            try:
                conn_error_cls = self._requests().exceptions.ConnectionError
            except Exception:
                conn_error_cls = None
            if conn_error_cls is not None and isinstance(e, conn_error_cls):
                self._registered = False
                ColorPrint.yellow(
                    f"{self._log_prefix} Pull connection failed "
                    f"({self._short_err(e)}); will re-discover"
                )
            else:
                ColorPrint.yellow(
                    f"{self._log_prefix} Pull transient error "
                    f"({self._short_err(e)}); will retry next tick"
                )
        return []

    def _post_result(
        self,
        task_id: Any,
        status_role: str,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        progress: Optional[int] = None,
        attempts: Optional[int] = None,
    ) -> bool:
        """
        POST a task result (processing/completed/failed) back to Laravel.

        NOT a @serialized_method: the retry loop below can hold for
        RESULT_POST_ATTEMPTS x _http_timeout + backoff against a dead endpoint
        (~27s). On the serialized state-owner thread that blocked every status
        read and heartbeat tick ('Serialized operation timed out'). The breaker
        bookkeeping it touches is plain scalars, safe from executor threads.

        Retries transient failures (connection errors / HTTP 5xx) a few times
        with a short backoff; gives up on 4xx. Returns True when Laravel
        accepted the result. On final failure the task is NOT lost: Laravel's
        maintenance timer releases it back to pending at timeout_at and another
        worker re-claims it.

        ``attempts`` overrides the retry budget - best-effort progress pings
        pass 1 (a lost ping costs nothing; the next report or the final result
        carries the same information).
        """
        status = GLOBAL_TASK_STATUSES_BY_ROLE.get(status_role, status_role)
        if status not in GLOBAL_TASK_WORKER_RESULT_STATUSES:
            raise ValueError(f"Unsupported Laravel worker result status: {status_role}")
        body: Dict[str, Any] = {
            "task_id": task_id,
            "worker_id": self.worker_id,
            "status": status,
        }
        if progress is not None:
            body["progress"] = progress
        if result is not None:
            body["result"] = result
        if error is not None:
            body["error"] = error

        last_note = ""
        last_was_5xx = False
        max_attempts = self.RESULT_POST_ATTEMPTS if attempts is None else max(1, int(attempts))
        for attempt in range(1, max_attempts + 1):
            try:
                resp = laravel_client.post(
                    "/api/worker/tasks/result",
                    base_url=self.api_url,
                    json=body,
                    timeout=self._http_timeout,
                )
                if resp.status_code in (200, 201):
                    ColorPrint.green(f"{self._log_prefix} Posted '{status}' for task {task_id}")
                    self._note_result_accepted()
                    return True
                if resp.status_code == 409:
                    # Task reassigned (we lost the claim, e.g. after a timeout
                    # release) - the new owner reports it; do not retry.
                    ColorPrint.yellow(
                        f"{self._log_prefix} Result for task {task_id} rejected (409: "
                        f"task reassigned / not ours) - dropping"
                    )
                    return False
                if 400 <= resp.status_code < 500:
                    ColorPrint.yellow(
                        f"{self._log_prefix} Result POST for task {task_id} -> "
                        f"HTTP {resp.status_code} (not retryable)"
                    )
                    return False
                last_note = f"HTTP {resp.status_code}"
                last_was_5xx = 500 <= resp.status_code < 600
            except Exception as e:
                last_note = self._short_err(e)
                last_was_5xx = False  # transport error, not a backend 5xx

            if attempt < max_attempts:
                delay = self.RESULT_POST_BACKOFF_SECONDS[
                    min(attempt - 1, len(self.RESULT_POST_BACKOFF_SECONDS) - 1)
                ]
                ColorPrint.yellow(
                    f"{self._log_prefix} Result POST for task {task_id} failed "
                    f"({last_note}); retry {attempt}/{max_attempts - 1} "
                    f"in {delay}s"
                )
                time.sleep(delay)

        if max_attempts > 1:
            ColorPrint.red(
                f"{self._log_prefix} Result POST for task {task_id} gave up after "
                f"{max_attempts} attempts ({last_note}); Laravel's timeout "
                f"release will re-queue the task"
            )
        # Only a real budgeted attempt that ended on a backend 5xx counts toward
        # the breaker. Best-effort single-shot pings (attempts=1) and transport
        # errors do not - the latter are already handled by the conn-fail hint.
        if max_attempts > 1 and last_was_5xx:
            self._note_result_server_error()
        return False

    # -------------------- backend circuit breaker --------------------

    def _note_result_accepted(self) -> None:
        """Laravel accepted a result - the backend write path works; reset breaker."""
        if self._result_5xx_streak or self._circuit_open_until:
            ColorPrint.green(f"{self._log_prefix} Backend accepted a result - circuit reset")
        self._result_5xx_streak = 0
        self._circuit_open_until = 0.0
        self._circuit_warned = False

    def _note_result_server_error(self) -> None:
        """A result POST exhausted its retries on HTTP 5xx; open the breaker at threshold."""
        self._result_5xx_streak += 1
        if self._result_5xx_streak >= self.CIRCUIT_FAIL_THRESHOLD:
            self._circuit_open_until = time.monotonic() + self.CIRCUIT_COOLDOWN_SECONDS
            if not self._circuit_warned:
                ColorPrint.red(
                    f"{self._log_prefix} Backend rejecting results "
                    f"({self._result_5xx_streak}x HTTP 5xx) - opening circuit: pausing "
                    f"task pulls for {self.CIRCUIT_COOLDOWN_SECONDS}s to stop burning "
                    f"translations the backend cannot store. Will probe again after cooldown."
                )
                self._circuit_warned = True

    @serialized_method
    def _circuit_is_open(self) -> bool:
        """True while the cooldown is active (skip pulling new work)."""
        return time.monotonic() < self._circuit_open_until
