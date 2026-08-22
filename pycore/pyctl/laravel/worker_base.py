# -*- coding: utf-8 -*-
"""
BaseLaravelWorkerService

Shared scaffold for all persistent Pycore workers using Laravel's typed
pull/accept/result task API. The UI only persists worker switches and the
selected Laravel endpoint; enabled workers keep processing while the UI is
closed.

Holds the parts that are IDENTICAL across the result-uploading workers:

  - THREAD_BUS-backed mutable worker state.
  - Stable hostname-based worker_id + candidate Laravel base-URL discovery.
  - Lazy third-party ``requests`` accessor + noisy-exception condenser.
  - task_id -> task_type / endpoint registry (fed by the RPC accept entry,
    needed by the typed result route).
  - _post_result retry and circuit breaker.

The concrete subclass (TranslationWorkerService) supplies:
  - worker_name, _log_prefix (set in __init__ before any base HTTP method runs)
  - _effective_processor_types() / _effective_capabilities() (lane gating)
  - the lane-specific task processing

The word/sentence audio workers (pyctl/tts/laravel_audio_worker.py) also build
on this base: audio bytes uploaded via domain report endpoints before results.
Shared Laravel transport still goes through LaravelClient; every generic
/api/worker/* result consumer belongs in this base.
"""

import platform
import socket
import time
from typing import Any, Dict, List, Optional

# ColorPrint is the only allowed logger in pycore processors/services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.diff_task_segments import diff_task_segment_store
from pycore.pyfoundations.serialized_worker import (
    SerializedValue,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyutils.laravel.endpoint_manager import (
    laravel_endpoint_manager,
)
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_LIMITS,
    GLOBAL_TASK_STATUSES_BY_ROLE,
    GLOBAL_TASK_TERMINAL_STATUSES,
    GLOBAL_TASK_WORKER_RESULT_STATUSES,
    QUEUE_CENTER_DIFF_DELIVERY,
    http_transfer_contract,
    queue_center_endpoint,
)
from pycore.pyutils.common.service_config import (
    LARAVEL_WORKER_API_URL,
    PYCORE_WORKER_INSTANCE,
)


class BaseLaravelWorkerService:
    """
    Base class for persistent Pycore typed pull/accept/result workers.

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
    # a half-finished DB migration. After N consecutive server-side give-ups the
    # breaker OPENS for a cooldown; ANY accepted result resets it. 4xx/409 never
    # trip it (those are per-task, not backend-wide).
    CIRCUIT_FAIL_THRESHOLD = 3
    CIRCUIT_COOLDOWN_SECONDS = 120

    # THREAD_BUS serialized state-owner identity. Every concrete singleton with
    # mutable state overrides both values to own a distinct state queue.
    STATE_OWNER_KEY = "laravel.worker.state"
    RESULT_HTTP_TIMEOUT = 60
    PULL_LIMIT = GLOBAL_TASK_LIMITS["worker_pull_default"]
    PULL_HTTP_TIMEOUT_SECONDS = 15
    STATE_OWNER_NAME = "LaravelWorkerState"
    WORKER_ID_PREFIX = "pycore-worker"
    LOG_ACCEPTED_RESULTS = True
    # Serialized state-owner timeout (seconds). The audio workers override with
    # 180s: their on-owner engine probe (tts_status) can outlive 60s on a cold box.
    STATE_OWNER_TIMEOUT = 60.0

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
        # user's selection; the full candidate list is the sweep order.
        self._candidates: List[str] = []
        self.api_url = self._sync_laravel_endpoint(laravel_api_url)
        self.worker_id = self._build_worker_id()
        self.hostname = socket.gethostname()
        self.platform = platform.platform()

        self._registered = False
        self._pull_task_type_cursor = 0
        # Explicit lane lifecycle state (request_start / request_stop). A stop
        # is graceful when the claimed-but-unstarted heap may finish; an
        # immediate stop halts the drain between tasks and actively releases
        # the unstarted claims back to Laravel's pending queue.
        self._lane_stop_requested = False
        self._lane_stop_graceful = True
        # Backend circuit breaker state (see CIRCUIT_* constants). Streak counts
        # CONSECUTIVE server-side (HTTP 5xx) result-POST give-ups; the circuit is
        # open while monotonic time() < _circuit_open_until.
        self._result_5xx_streak = 0
        self._circuit_open_until = 0.0
        self._circuit_warned = False
        # Guards against dispatching the same task to two background threads while
        # an earlier dispatch is still in flight.
        # task_id -> monotonic deadline. Each entry carries a deadline (now +
        # task.timeout_seconds, default INFLIGHT_DEFAULT_TTL) and expired entries
        # are purged before the skip check, so a re-dispatched task can be
        # accepted again even if an earlier executor hung.
        self._inflight: Dict[str, float] = {}
        # task_id -> task_type, recorded on every accepted dispatch. The typed
        # result route (/api/worker/tasks/{taskType}/result) needs the type at
        # result time; keeping it here spares every handler call site from
        # passing it through. Bounded in _remember_task_types.
        self._task_type_by_id: Dict[str, str] = {}
        self._task_endpoint_by_id: Dict[str, str] = {}
        self._queue_diff_cursors: Dict[str, int] = {}
        self._queue_progress: Dict[str, Dict[str, int]] = {}
        self._pull_guard = SerializedValue(
            False,
            name=f"{self.STATE_OWNER_NAME}PullGuard",
        )
        # The serialized worker owns every mutation of this store.

        # Log prefix - subclass overrides (e.g. "[TranslationWorker]"). Default
        # keeps base-only usage legible.
        self._log_prefix = "[LaravelWorker]"
        init_serialized_owner(
            self,
            self.STATE_OWNER_KEY,
            self.STATE_OWNER_NAME,
            timeout=self.STATE_OWNER_TIMEOUT,
        )
        # Register for immediate notification when the user switches endpoint in
        # the UI so the next result upload targets it.
        laravel_endpoint_manager.register_endpoint_change_listener(
            self.on_endpoint_changed
        )

    def on_endpoint_changed(self, new_url: str) -> None:
        """Immediately reset endpoint state when the Laravel endpoint changes.

        Called synchronously by LaravelEndpointManager.select() the moment the user
        confirms a new endpoint. Subsequent result uploads resolve against
        ``new_url``.
        """
        prev = self.api_url
        self.api_url = new_url.rstrip("/")
        self._registered = False
        ColorPrint.blue(
            f"{self._log_prefix} Endpoint changed {prev!r} -> {new_url!r}"
        )

    # -------------------- identity --------------------

    @classmethod
    def _build_worker_id(cls) -> str:
        """
        Stable, hostname-based worker id (same across restarts on a host).

        MULTI-INSTANCE NOTE: Laravel keys results by worker_id, so two pycore
        processes on the SAME host must not share one. For multiple pycore
        processes on one host, configure PYCORE_WORKER_INSTANCE with a stable
        per-instance tag; it is appended to the id. Single-instance hosts keep
        the original stable id.

        Concrete workers set WORKER_ID_PREFIX; the normalization and optional
        instance suffix remain centralized here.
        """
        host = socket.gethostname() or "host"
        safe = "".join(c if (c.isalnum() or c in "-_") else "-" for c in host).lower()
        prefix = str(cls.WORKER_ID_PREFIX or "pycore-worker").strip().rstrip("-")
        instance = PYCORE_WORKER_INSTANCE.strip()
        if instance:
            safe_instance = "".join(
                c if (c.isalnum() or c in "-_") else "-" for c in instance
            ).lower()
            return f"{prefix}-{safe}-{safe_instance}"
        return f"{prefix}-{safe}"

    @staticmethod
    def _display_task_id(task_id: Any) -> str:
        """Return a compact task identifier for human-facing logs only."""
        value = str(task_id or "")
        return f"{value[:8]}..." if len(value) > 8 else value

    def _sync_laravel_endpoint(self, fallback: str = "") -> str:
        """Refresh candidate list + resolved base from LaravelEndpointManager.

        Pure local resolution (no network): reads the stored endpoint catalog.
        Returns the resolved base URL (no trailing slash).
        """
        mgr = laravel_endpoint_manager
        base = (mgr.get_active_base_url() or "").rstrip("/")
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
            ordered.append(LARAVEL_WORKER_API_URL)
        self._candidates = ordered
        if not getattr(self, "_registered", False):
            self.api_url = ordered[0]
        return ordered[0]

    # -------------------- HTTP helpers --------------------

    @staticmethod
    def _short_err(exc: Exception) -> str:
        """
        Condense a noisy requests/urllib3 exception into a one-line reason, so we
        never dump a multi-line HTTPConnectionPool stack into the log.
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

    # -------------------- Laravel typed pull / accept API --------------------

    def _pull_task_types(self) -> List[str]:
        """Contract task types owned by this concrete worker."""
        return []

    def _ordered_pull_task_types(self) -> List[str]:
        """Rotate multi-type pulls without mutating the declared type set."""
        if self._lane_halt_requested():
            return []
        task_types = self._pull_task_types()
        if len(task_types) < 2:
            return task_types
        offset = self._pull_task_type_cursor % len(task_types)
        self._pull_task_type_cursor = (offset + 1) % len(task_types)
        return task_types[offset:] + task_types[:offset]

    def _pull_capacity(self) -> int:
        """Maximum tasks that may be claimed in the next cycle."""
        reserve = max(0, int(QUEUE_CENTER_DIFF_DELIVERY.get("head_reserve") or 0))
        target = max(1, int(self.PULL_LIMIT) - reserve)
        return max(0, target - len(self._inflight))

    def _diff_pull_capacity(self) -> int:
        """Claim capacity including the slot reserved for a changed queue head."""
        return max(0, int(self.PULL_LIMIT) - len(self._inflight))

    def _pull_params(self, limit: int) -> Dict[str, Any]:
        capabilities = self._effective_capabilities()
        processor_types = self._effective_processor_types()
        params: Dict[str, Any] = {
            "worker_id": self.worker_id,
            "worker_name": self.worker_name,
            "capabilities_present": 1,
            "hostname": self.hostname,
            "platform": self.platform,
            "limit": max(1, min(int(limit), GLOBAL_TASK_LIMITS["worker_pull"])),
            "lease_capacity": max(
                1,
                min(int(self._lease_capacity()), GLOBAL_TASK_LIMITS["worker_pull"]),
            ),
        }
        for index, processor_type in enumerate(processor_types):
            params[f"processor_types[{index}]"] = processor_type
        for index, capability in enumerate(capabilities):
            params[f"capabilities[{index}]"] = capability
        return params

    def _lease_capacity(self) -> int:
        """Maximum live Laravel leases owned by this worker instance."""
        return max(1, int(self.PULL_LIMIT))

    def poll_diff_once(self) -> Dict[str, Any]:
        """Poll compact queue revisions and pull only when the front slice changed."""
        if self._lane_halt_requested():
            return {"ok": True, "changed": False, "processed": 0}
        task_types = self._pull_task_types()
        if not task_types:
            return {"ok": True, "changed": False, "processed": 0}
        base_url = self._sync_laravel_endpoint(self.api_url)
        scope = self._diff_segment_scope(base_url)
        changed = False
        for task_type in task_types:
            cursor = max(
                int(self._queue_diff_cursors.get(task_type, 0)),
                diff_task_segment_store.remote_cursor(scope, task_type),
            )
            response = laravel_client.get(
                queue_center_endpoint("queue_center_queue_diff", queue=task_type),
                base_url=base_url,
                params={"cursor": cursor},
                timeout=self.PULL_HTTP_TIMEOUT_SECONDS,
                log_line=False,
            )
            if response.status_code != 200:
                raise RuntimeError(
                    f"Laravel queue diff failed for {task_type}: HTTP {response.status_code}"
                )
            data = self._response_data(response)
            lane_changed = bool(data.get("changed"))
            # Compact poll line: diff[200]->true means the remote head moved and
            # a bounded re-pull follows; false means keep the local segment.
            ColorPrint.gray(
                f"{self._log_prefix} diff[{response.status_code}]->"
                f"{'true' if lane_changed else 'false'}"
            )
            progress = data.get("progress")
            if isinstance(progress, dict):
                self._queue_progress[task_type] = {
                    str(key): int(value or 0)
                    for key, value in progress.items()
                    if isinstance(value, (int, float))
                }
            if not lane_changed:
                continue
            changed = True
            if self._diff_pull_capacity() <= 0:
                continue
        if changed and self._diff_pull_capacity() > 0:
            result = self.pull_once(prefer_remote=True)
            result["changed"] = True
            return result
        if (
            not changed
            and self._pull_capacity() > 0
            and diff_task_segment_store.has_pending(scope)
        ):
            result = self.pull_once()
            result["changed"] = False
            result["recovered_local"] = True
            return result
        return {"ok": True, "changed": changed, "processed": 0}

    @staticmethod
    def _response_data(response: Any) -> Dict[str, Any]:
        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("Laravel worker API returned a non-object response")
        data = payload.get("data")
        return data if isinstance(data, dict) else payload

    def _validate_recovered_claim(
        self,
        task_type: str,
        task_id: str,
        base_url: str,
    ) -> bool:
        response = laravel_client.post(
            queue_center_endpoint("worker_task_accept", task_type=task_type),
            base_url=base_url,
            json={"task_id": task_id, "worker_id": self.worker_id},
            timeout=self.RESULT_HTTP_TIMEOUT,
        )
        if response.status_code in (200, 201):
            return True
        if response.status_code in (404, 409):
            return False
        raise RuntimeError(
            f"Laravel worker accept failed for {self._display_task_id(task_id)}: "
            f"HTTP {response.status_code}"
        )

    def _dispatch_staged_tasks(
        self,
        tasks: List[Dict[str, Any]],
        base_url: str,
        scope: str,
        validate_claim: bool = False,
    ) -> int:
        if self._lane_halt_requested():
            # A stop landed while this pull was in flight: hand the staged
            # claims straight back to Laravel instead of accepting new work.
            releasable = [
                task for task in tasks if str(task.get("task_id") or "").strip()
            ]
            if releasable:
                self._release_claimed_tasks(releasable)
            return 0
        dispatched = 0
        for task in tasks:
            task_id = str(task.get("task_id") or "")
            task_type = str(task.get("task_type") or "")
            if not task_id or not task_type:
                continue
            if validate_claim and not self._validate_recovered_claim(
                task_type,
                task_id,
                base_url,
            ):
                diff_task_segment_store.consume(scope, task_id)
                continue
            accepted = self.accept_task(task, base_url)
            if accepted.get("success"):
                dispatched += 1
                continue
            self._release_claimed_tasks([task])
            diff_task_segment_store.consume(scope, task_id)
            ColorPrint.yellow(
                f"{self._log_prefix} Local dispatch rejected task "
                f"{self._display_task_id(task_id)}: "
                f"{accepted.get('error') or 'worker busy'}"
            )
        return dispatched

    def request_pull(self, prefer_remote: bool = False) -> None:
        """Coalesce one event-driven immediate pull on the shared bus."""
        if not self._pull_guard.compare_and_set(False, True):
            return
        try:
            start_bus_task(
                self._run_claimed_pull,
                bool(prefer_remote),
                thread_name=f"{self.STATE_OWNER_NAME}Pull",
            )
        except Exception:
            self._pull_guard.set(False)
            raise

    def pull_once(self, prefer_remote: bool = False) -> Dict[str, Any]:
        """Serialize one immediate pull cycle across timer and realtime wakes."""
        if not self._pull_guard.compare_and_set(False, True):
            return {"ok": True, "processed": 0, "reason": "pull_inflight"}
        try:
            return self._pull_once(prefer_remote=prefer_remote)
        finally:
            self._pull_guard.set(False)

    def _run_claimed_pull(self, prefer_remote: bool = False) -> Dict[str, Any]:
        try:
            return self._pull_once(prefer_remote=prefer_remote)
        finally:
            self._pull_guard.set(False)

    # -------------------- lane lifecycle --------------------

    def _lane_halt_requested(self) -> bool:
        """True while an immediate stop is in effect (halt drains and pulls)."""
        return bool(self._lane_stop_requested and not self._lane_stop_graceful)

    def request_start(self) -> None:
        """Clear any lane stop and wake one immediate remote-first pull."""
        stopped = self._lane_stop_requested
        self._lane_stop_requested = False
        self._lane_stop_graceful = True
        if stopped:
            ColorPrint.green(f"{self._log_prefix} lane start requested")
        self.request_pull(prefer_remote=True)

    def request_stop(self, graceful: bool = True) -> None:
        """Stop the lane: close pull/accept gates and halt background drains.

        graceful=True finishes the already-claimed heap without pulling new
        work; graceful=False halts between tasks and returns the
        claimed-but-unstarted tasks to Laravel via the release endpoint (the
        lease-timeout maintenance is the documented fallback when that POST
        cannot reach the backend). In-flight tasks are never killed - they
        finish and report their results through the normal route.
        """
        was_stopped = self._lane_stop_requested
        was_graceful = self._lane_stop_graceful
        self._lane_stop_requested = True
        self._lane_stop_graceful = bool(graceful)
        if not was_stopped or was_graceful != bool(graceful):
            ColorPrint.yellow(
                f"{self._log_prefix} lane stop requested (graceful={bool(graceful)})"
            )
        if not graceful:
            dropped = self._drop_queued_tasks()
            if dropped:
                self._release_claimed_tasks(dropped)

    def _drop_queued_tasks(self) -> List[Dict[str, Any]]:
        """Pop every queued-but-unstarted task; overridden by heap lanes."""
        return []

    def _release_claimed_tasks(self, tasks: List[Dict[str, Any]]) -> None:
        """Return claimed-but-unstarted tasks to Laravel (best-effort, async)."""
        try:
            start_bus_task(
                self._post_task_release,
                tasks,
                thread_name=f"{self.STATE_OWNER_NAME}Release",
            )
        except Exception as exc:  # noqa: BLE001 - release is best-effort
            ColorPrint.yellow(
                f"{self._log_prefix} task release spawn failed: {exc}"
            )

    def _post_task_release(self, tasks: List[Dict[str, Any]]) -> None:
        grouped: Dict[str, List[str]] = {}
        for task in tasks:
            task_id = str(task.get("task_id") or "")
            if not task_id:
                continue
            task_type = str(
                task.get("task_type")
                or self._task_type_by_id.get(task_id)
                or ""
            )
            if not task_type:
                continue
            grouped.setdefault(task_type, []).append(task_id)
        for task_type, task_ids in grouped.items():
            try:
                response = laravel_client.post(
                    queue_center_endpoint(
                        "worker_task_release", task_type=task_type
                    ),
                    base_url=self._task_base_url(task_ids[0]),
                    json={
                        "worker_id": self.worker_id,
                        "task_ids": task_ids[: GLOBAL_TASK_LIMITS["worker_pull"]],
                    },
                    timeout=self.RESULT_HTTP_TIMEOUT,
                )
                if response.status_code == 200:
                    ColorPrint.blue(
                        f"{self._log_prefix} released {len(task_ids)} "
                        f"unstarted {task_type} task(s) back to pending"
                    )
                else:
                    ColorPrint.yellow(
                        f"{self._log_prefix} task release for {task_type} "
                        f"failed: HTTP {response.status_code} - lease timeout "
                        f"will re-queue them"
                    )
            except Exception as exc:  # noqa: BLE001 - lease timeout is the fallback
                ColorPrint.yellow(
                    f"{self._log_prefix} task release for {task_type} "
                    f"failed ({exc}) - lease timeout will re-queue them"
                )

    def _pull_once(self, prefer_remote: bool = False) -> Dict[str, Any]:
        """Pull and recover one bounded segment, preferring a changed remote head."""
        if self._circuit_is_open():
            return {"ok": False, "processed": 0, "reason": "result_circuit_open"}
        task_types = self._ordered_pull_task_types()
        capacity = (
            self._diff_pull_capacity()
            if prefer_remote
            else self._pull_capacity()
        )
        if not task_types or capacity <= 0:
            return {"ok": True, "processed": 0}

        base_url = self._sync_laravel_endpoint(self.api_url)
        scope = self._diff_segment_scope(base_url)
        recovered_count = 0
        processed = 0
        if not prefer_remote:
            recovered = diff_task_segment_store.pending(scope, capacity)
        else:
            recovered = []
        if recovered:
            self._remember_task_types(recovered, base_url)
            recovered_count = len(recovered)
            processed += self._dispatch_staged_tasks(
                recovered,
                base_url,
                scope,
                validate_claim=True,
            )
            capacity = max(0, capacity - recovered_count)

        remote_capacity = min(
            capacity,
            diff_task_segment_store.available_capacity(scope),
        )
        remaining = remote_capacity
        pulled = 0
        for task_type in task_types:
            if remaining <= 0:
                break
            response = laravel_client.post(
                queue_center_endpoint("worker_task_pull", task_type=task_type),
                base_url=base_url,
                json=self._pull_params(remaining),
                timeout=self.PULL_HTTP_TIMEOUT_SECONDS,
            )
            if response.status_code != 200:
                raise RuntimeError(
                    f"Laravel worker pull failed for {task_type}: HTTP {response.status_code}"
                )
            data = self._response_data(response)
            progress = data.get("progress")
            if isinstance(progress, dict):
                self._queue_progress[task_type] = {
                    str(key): int(value or 0)
                    for key, value in progress.items()
                    if isinstance(value, (int, float))
                }
            raw_tasks = data.get("tasks")
            tasks = (
                [dict(task) for task in raw_tasks if isinstance(task, dict)]
                if isinstance(raw_tasks, list)
                else []
            )
            staged = diff_task_segment_store.stage(scope, tasks) if tasks else []
            if staged:
                self._remember_task_types(staged, base_url)
                pulled += len(staged)
            queue_cursor = int(
                data.get("queue_cursor")
                or self._queue_diff_cursors.get(task_type, 0)
                or diff_task_segment_store.remote_cursor(scope, task_type)
            )
            self._queue_diff_cursors[task_type] = queue_cursor
            diff_task_segment_store.set_remote_cursor(scope, task_type, queue_cursor)
            if not staged:
                continue
            processed += self._dispatch_staged_tasks(staged, base_url, scope)
            remaining = max(0, remote_capacity - pulled)
        if prefer_remote:
            recovery_capacity = max(0, capacity - pulled)
            recovered = diff_task_segment_store.pending(scope, recovery_capacity)
            if recovered:
                self._remember_task_types(recovered, base_url)
                recovered_count += len(recovered)
                processed += self._dispatch_staged_tasks(
                    recovered,
                    base_url,
                    scope,
                    validate_claim=True,
                )
        if pulled:
            progress = self._queue_progress.get(task_types[0], {}) if task_types else {}
            progress_label = (
                f" progress={int(progress.get('completed') or 0)}/"
                f"{int(progress.get('total') or 0)}"
                if progress
                else ""
            )
            ColorPrint.blue(
                f"{self._log_prefix} Pulled {pulled} task(s), dispatched {processed}"
                f"{progress_label}"
            )
        return {
            "ok": True,
            "processed": processed,
            "pulled": pulled,
            "recovered": recovered_count,
        }

    # -------------------- dispatched-task registry --------------------

    def _remember_task_types(
        self,
        tasks: List[Dict[str, Any]],
        base_url: str,
    ) -> None:
        """Record task_id -> task_type from a dispatched batch for the typed result
        route (bounded: oldest entries dropped past 1000)."""
        for task in tasks:
            task_id = str(task.get("task_id") or "")
            task_type = str(task.get("task_type") or "")
            if task_id and task_type:
                # Refresh insertion order so an accepted task that is about to
                # run cannot be evicted behind already completed backlog rows.
                self._task_type_by_id.pop(task_id, None)
                self._task_endpoint_by_id.pop(task_id, None)
                self._task_type_by_id[task_id] = task_type
                self._task_endpoint_by_id[task_id] = base_url.rstrip("/")
        while len(self._task_type_by_id) > 1000:
            oldest_task_id = next(iter(self._task_type_by_id))
            self._task_type_by_id.pop(oldest_task_id)
            self._task_endpoint_by_id.pop(oldest_task_id, None)

    def _task_base_url(self, task_id: Any) -> str:
        return self._task_endpoint_by_id.get(str(task_id), self.api_url)

    def _forget_task_endpoint(self, task_id: Any) -> None:
        key = str(task_id)
        self._task_type_by_id.pop(key, None)
        self._task_endpoint_by_id.pop(key, None)

    # -------------------- Laravel worker result API --------------------

    def _post_result(
        self,
        task_id: Any,
        status_role: str,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        progress: Optional[int] = None,
        attempts: Optional[int] = None,
        attempt: Optional[int] = None,
    ) -> bool:
        """
        POST a task result (processing/completed/failed) back to Laravel.

        NOT a @serialized_method: the retry loop below can hold for
        RESULT_POST_ATTEMPTS x RESULT_HTTP_TIMEOUT + backoff against a dead endpoint.
        On the serialized state-owner thread that blocked every status
        read ('Serialized operation timed out'). The breaker
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
        task_display_id = self._display_task_id(task_id)
        if status not in GLOBAL_TASK_WORKER_RESULT_STATUSES:
            raise ValueError(f"Unsupported Laravel worker result status: {status_role}")
        body: Dict[str, Any] = {
            "task_id": task_id,
            "worker_id": self.worker_id,
            "status": status,
        }
        if attempt is not None:
            body["attempt"] = max(0, int(attempt))
        if progress is not None:
            body["progress"] = progress
        if result is not None:
            body["result"] = result
        if error is not None:
            body["error"] = error

        # Typed result route (/api/worker/tasks/{taskType}/result): the type
        # normally comes from the dispatch-time registry. A dedicated worker
        # may declare RESULT_TASK_TYPE as a safe fallback for legacy queued
        # items; shared multi-type workers still reject unknown routing.
        task_key = str(task_id)
        task_type = self._task_type_by_id.get(task_key)
        if not task_type:
            task_type = str(getattr(self, "RESULT_TASK_TYPE", "") or "").strip()
            if task_type:
                self._task_type_by_id[task_key] = task_type
                self._task_endpoint_by_id.setdefault(task_key, self.api_url.rstrip("/"))
                ColorPrint.yellow(
                    f"{self._log_prefix} Restored missing task_type for task "
                    f"{task_display_id} as {task_type}"
                )
        if not task_type:
            ColorPrint.red(
                f"{self._log_prefix} Result for task {task_display_id} has no recorded "
                "task_type - dropping (Laravel re-queues at lease timeout)"
            )
            return False
        result_url = queue_center_endpoint("worker_task_result", task_type=task_type)
        result_base_url = self._task_base_url(task_id)
        terminal_result = status in GLOBAL_TASK_TERMINAL_STATUSES

        last_note = ""
        last_was_5xx = False
        max_attempts = self.RESULT_POST_ATTEMPTS if attempts is None else max(1, int(attempts))
        activity_contract = http_transfer_contract()
        for attempt in range(1, max_attempts + 1):
            if THREAD_BUS.is_shutdown_requested() and not terminal_result:
                ColorPrint.yellow(
                    f"{self._log_prefix} Result POST for task {task_display_id} "
                    "cancelled during shutdown"
                )
                return False
            try:
                resp = laravel_client.post(
                    result_url,
                    base_url=result_base_url,
                    json=body,
                    activity_timeout=activity_contract,
                )
                if resp.status_code in (200, 201):
                    if self.LOG_ACCEPTED_RESULTS:
                        ColorPrint.green(
                            f"{self._log_prefix} Posted '{status}' for task "
                            f"{task_display_id}"
                        )
                    self._note_result_accepted()
                    if status in GLOBAL_TASK_TERMINAL_STATUSES:
                        diff_task_segment_store.consume(
                            self._diff_segment_scope(result_base_url),
                            task_id,
                        )
                        self._forget_task_endpoint(task_id)
                    return True
                if resp.status_code == 409:
                    # Task reassigned (we lost the claim, e.g. after a timeout
                    # release) - the new owner reports it; do not retry.
                    ColorPrint.yellow(
                        f"{self._log_prefix} Result for task {task_display_id} rejected (409: "
                        f"task reassigned / not ours) - dropping"
                    )
                    diff_task_segment_store.consume(
                        self._diff_segment_scope(result_base_url),
                        task_id,
                    )
                    self._forget_task_endpoint(task_id)
                    return False
                if 400 <= resp.status_code < 500:
                    ColorPrint.yellow(
                        f"{self._log_prefix} Result POST for task {task_display_id} -> "
                        f"HTTP {resp.status_code} (not retryable)"
                    )
                    if terminal_result:
                        diff_task_segment_store.consume(
                            self._diff_segment_scope(result_base_url),
                            task_id,
                        )
                        self._forget_task_endpoint(task_id)
                    return False
                last_note = f"HTTP {resp.status_code}"
                last_was_5xx = 500 <= resp.status_code < 600
            except Exception as e:
                last_note = self._short_err(e)
                last_was_5xx = False  # transport error, not a backend 5xx

            if attempt < max_attempts:
                if THREAD_BUS.is_shutdown_requested() and not terminal_result:
                    ColorPrint.yellow(
                        f"{self._log_prefix} Result retry for task {task_display_id} "
                        "cancelled during shutdown"
                    )
                    return False
                delay = self.RESULT_POST_BACKOFF_SECONDS[
                    min(attempt - 1, len(self.RESULT_POST_BACKOFF_SECONDS) - 1)
                ]
                ColorPrint.yellow(
                    f"{self._log_prefix} Result POST for task {task_display_id} failed "
                    f"({last_note}); retry {attempt}/{max_attempts - 1} "
                    f"in {delay}s"
                )
                time.sleep(delay)

        if max_attempts > 1:
            ColorPrint.red(
                f"{self._log_prefix} Result POST for task {task_display_id} gave up after "
                f"{max_attempts} attempts ({last_note}); Laravel's timeout "
                f"release will re-queue the task"
            )
        # Only a real budgeted attempt that ended on a backend 5xx counts toward
        # the breaker. Best-effort single-shot pings (attempts=1) and transport
        # errors do not.
        if max_attempts > 1 and last_was_5xx:
            self._note_result_server_error()
        if terminal_result:
            diff_task_segment_store.defer(
                self._diff_segment_scope(result_base_url),
                [task_id],
                self.CIRCUIT_COOLDOWN_SECONDS,
            )
            ColorPrint.yellow(
                f"{self._log_prefix} Deferred task {task_display_id} for persistent retry"
            )
        return False

    def _diff_segment_scope(self, base: str) -> str:
        return f"{self.worker_name}:{self.worker_id}:{base}"

    def set_cached_task_priority(
        self,
        task_id: Any,
        priority: int,
        move_to_head: bool,
    ) -> None:
        """Apply one Laravel priority event to Pycore's bounded local caches."""
        base_url = self._sync_laravel_endpoint(self.api_url)
        diff_task_segment_store.set_priority(
            self._diff_segment_scope(base_url),
            task_id,
            priority,
            move_to_head,
        )

    def set_cached_task_head(self, task_id: Any, queue_position: int) -> None:
        """Apply one Laravel queue-head event to the bounded local cache."""
        base_url = self._sync_laravel_endpoint(self.api_url)
        diff_task_segment_store.move_to_head(
            self._diff_segment_scope(base_url),
            task_id,
            queue_position,
        )

    def promote_cached_task(self, task_id: Any, priority: int) -> None:
        self.set_cached_task_priority(task_id, priority, True)

    def reprioritize_cached_task(self, task_id: Any, priority: int) -> None:
        self.set_cached_task_priority(task_id, priority, False)

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
                    f"({self._result_5xx_streak}x HTTP 5xx) - opening circuit for "
                    f"{self.CIRCUIT_COOLDOWN_SECONDS}s. Will probe again after cooldown."
                )
                self._circuit_warned = True

    @serialized_method
    def _circuit_is_open(self) -> bool:
        """True while the cooldown is active."""
        return time.monotonic() < self._circuit_open_until
