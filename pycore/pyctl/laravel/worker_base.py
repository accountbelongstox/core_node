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
from typing import Any, Dict, List, Optional, Set

# ColorPrint is the only allowed logger in pycore processors/services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.diff_task_segments import (
    DATA_LIMIT,
    STAGED_TASK_LIMIT,
    diff_task_segment_store,
)
from pycore.pyfoundations.serialized_worker import (
    SerializedValue,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyutils.laravel.endpoint_manager import (
    LARAVEL_ONLINE_SIGNAL,
    laravel_endpoint_manager,
)
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_LIMITS,
    QUEUE_CENTER_DIFF_DELIVERY,
    QUEUE_CENTER_DIFF_SYNC_LOG_KEYS,
    http_transfer_contract,
    queue_center_endpoint,
)
from pycore.pyutils.laravel.worker_result_delivery import (
    short_http_error,
    worker_result_delivery,
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
    RESULT_OFFLINE_BACKOFF_SECONDS = 30.0
    PULL_LIMIT = GLOBAL_TASK_LIMITS["worker_pull_default"]
    STATE_OWNER_NAME = "LaravelWorkerState"
    WORKER_ID_PREFIX = "pycore-worker"
    # Worker identity cadence: the register route doubles as the server-side
    # heartbeat (it marks the row online and stamps last_heartbeat_at), so the
    # refresh stays below the server HEARTBEAT_TIMEOUT (120s) and the row never
    # ages offline. The FORCED re-register on an accept-404 self-heal is
    # rate-limited so a draining mirror cannot flood the register route.
    WORKER_REGISTER_REFRESH_SECONDS = 45.0
    WORKER_REGISTER_RETRY_SECONDS = 10.0
    LOG_ACCEPTED_RESULTS = True
    # Full-sync lanes mirror the entire pending claim order from one diff
    # (sync=1 -> ordered_task_ids), keep the backlog in the persistent
    # segment store plus the local heap for offline processing, claim
    # just-in-time at task start, and apply later diffs incrementally
    # instead of re-pulling bounded claimed batches.
    FULL_SYNC_ENABLED = False
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
        # Monotonic ts of the last worker_register POST (success or attempt);
        # throttles both the periodic refresh and the accept-404 self-heal.
        self._worker_register_at = 0.0
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
        self._result_retry_after = 0.0
        self._claim_retry_after = 0.0
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
        # Flipped on the first diff response carrying ordered_task_ids: until
        # the backend proves sync support the lane keeps the legacy bounded
        # claim-pull so a deploy window never starves it. _sync_backend_legacy
        # is flipped by a CHANGED diff without ordered_task_ids (the backend
        # proved it has NO sync support): only then may a full-sync lane fall
        # back to the bounded claim-pull compat path.
        self._sync_backend_capable = False
        self._sync_backend_legacy = False
        # Task types whose mirror was bootstrapped in THIS process. A stored
        # cursor is only trustworthy after the mirror was materialized from
        # an ordered diff; a lane that never synced (or inherited a cursor
        # written by a legacy claim-pull) must re-sync from cursor=0 once.
        self._sync_mirror_bootstrapped: Set[str] = set()
        self._full_sync_reconciled_scopes: Set[str] = set()
        self._diff_probe_count = 0
        self._diff_state_by_type: Dict[str, bool] = {}
        self._diff_checks_since_state: Dict[str, int] = {}
        self._diff_sync_log_state: Dict[str, Dict[str, int]] = {}
        self._diff_recovery_state = SerializedValue(
            {},
            name=f"{self.STATE_OWNER_NAME}DiffRecovery",
        )
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
        self._worker_register_at = 0.0
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
    def _short_err(error: Exception) -> str:
        return short_http_error(error)

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

    def _identity_params(self) -> Dict[str, Any]:
        """Worker identity payload shared by the register and pull routes.

        Real JSON arrays: the body is sent as application/json, where PHP only
        expands bracket keys for form-encoded transport. Flat keys made
        `processor_types`/`capabilities` vanish server-side, so the pull's
        inline worker register never fired and the claim path failed with
        "Worker not found" (HTTP 500).
        """
        return {
            "worker_id": self.worker_id,
            "worker_name": self.worker_name,
            "processor_types": list(self._effective_processor_types()),
            "capabilities": list(self._effective_capabilities()),
            "hostname": self.hostname,
            "platform": self.platform,
            "lease_capacity": max(
                1,
                min(int(self._lease_capacity()), GLOBAL_TASK_LIMITS["worker_pull"]),
            ),
        }

    def _pull_params(self, limit: int) -> Dict[str, Any]:
        params = self._identity_params()
        params["capabilities_present"] = 1
        params["limit"] = max(1, min(int(limit), GLOBAL_TASK_LIMITS["worker_pull"]))
        return params

    def _ensure_worker_registered(self, base_url: str, force: bool = False) -> bool:
        """Establish/refresh the server-side worker row (register = heartbeat).

        Full-sync lanes never run the bounded claim-pull, whose inline register
        is the only other identity refresh: without this call their worker row
        is never created (or ages out through the offline reaper/purge) and
        EVERY just-in-time accept fails 404 "Task or worker not found" -- the
        server message conflates a missing task with a missing worker. The
        refresh cadence stays below the server HEARTBEAT_TIMEOUT (120s); a
        forced call (accept-404 self-heal) is still rate-limited so a draining
        mirror cannot flood the register route.
        """
        elapsed = time.monotonic() - self._worker_register_at
        if (
            not force
            and self._registered
            and elapsed < self.WORKER_REGISTER_REFRESH_SECONDS
        ):
            return True
        if force and elapsed < self.WORKER_REGISTER_RETRY_SECONDS:
            return self._registered
        try:
            response = laravel_client.post(
                queue_center_endpoint("worker_register"),
                base_url=base_url,
                json=self._identity_params(),
                activity_timeout=http_transfer_contract(),
            )
        except Exception:
            return self._registered
        self._worker_register_at = time.monotonic()
        if response.status_code in (200, 201):
            if not self._registered:
                ColorPrint.green(
                    f"{self._log_prefix} Worker identity registered with Laravel "
                    f"({self.worker_id})"
                )
            self._registered = True
            return True
        self._registered = False
        ColorPrint.yellow(
            f"{self._log_prefix} Worker register failed: HTTP {response.status_code}"
        )
        return False

    def _lease_capacity(self) -> int:
        """Maximum live Laravel leases owned by this worker instance."""
        return max(1, int(self.PULL_LIMIT))

    def _full_sync_enabled(self) -> bool:
        """True when this lane mirrors the full pending queue via diff sync."""
        return bool(self.FULL_SYNC_ENABLED)

    def _sync_active(self) -> bool:
        """True once the backend proved diff-sync support (ordered_task_ids)."""
        return bool(self._full_sync_enabled() and self._sync_backend_capable)

    def poll_diff_once(self) -> Dict[str, Any]:
        """Poll compact queue revisions and sync/pull only what changed."""
        if self._lane_halt_requested():
            return {"ok": True, "changed": False, "processed": 0}
        task_types = self._pull_task_types()
        if not task_types:
            return {"ok": True, "changed": False, "processed": 0}
        outcome = self._sync_mirror_from_diffs(task_types)
        changed = outcome["changed"]
        synced = outcome["synced"]
        scope = outcome["scope"]
        if synced:
            result = self.pull_once()
            result["changed"] = True
            result["synced"] = True
            return result
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

    def _sync_mirror_from_diffs(self, task_types: List[str]) -> Dict[str, Any]:
        base_url = self._sync_laravel_endpoint(self.api_url)
        # Identity first: diff/accept/result all need the worker row, and
        # full-sync lanes have no other registration path (see
        # _ensure_worker_registered).
        self._ensure_worker_registered(base_url)
        recovery = self._diff_recovery_state.get() or {}
        outcome = {
            "ok": False,
            "changed": False,
            "synced": False,
            "scope": self._diff_segment_scope(base_url),
            "error": str(recovery.get("error") or ""),
        }
        error = ""
        if recovery.get("base_url") == base_url and time.monotonic() < float(
            recovery.get("retry_after") or 0.0
        ):
            return outcome
        try:
            outcome = self._fetch_mirror_from_diffs(task_types)
        except Exception as exc:
            error = self._short_err(exc)
            self._diff_recovery_state.set({
                "base_url": base_url,
                "retry_after": time.monotonic() + self.RESULT_OFFLINE_BACKOFF_SECONDS,
                "error": error,
            })
            if recovery.get("base_url") != base_url or recovery.get("error") != error:
                ColorPrint.yellow(
                    f"{self._log_prefix} diff sync unavailable ({error}); processing the local mirror"
                )
            outcome["error"] = error
            return outcome
        self._diff_recovery_state.set({})
        if recovery:
            # Offline -> online edge: durable-backlog consumers (audio delivery
            # outbox, queue-head promotion replay) flush on this signal.
            THREAD_BUS.signal(LARAVEL_ONLINE_SIGNAL, {"at": time.time(), "base_url": base_url})
        outcome["ok"] = True
        return outcome

    def _fetch_mirror_from_diffs(self, task_types: List[str]) -> Dict[str, Any]:
        """Run ONE diff round over the lane's task types (no pull follow-up).

        Shared by the heartbeat poll and the full-sync pull intake. This is
        the ONLY cursor writer for full-sync lanes: the bounded claim-pull
        never moves their cursors, so a pre-sync claim cannot skip the
        revisions whose tasks the mirror has not materialized yet.
        """
        base_url = self._sync_laravel_endpoint(self.api_url)
        scope = self._diff_segment_scope(base_url)
        full_sync = self._full_sync_enabled()
        changed = False
        synced = False
        for task_type in task_types:
            bootstrap_sync = full_sync and task_type not in self._sync_mirror_bootstrapped
            cursor = (
                0
                if bootstrap_sync
                else max(
                    int(self._queue_diff_cursors.get(task_type, 0)),
                    diff_task_segment_store.remote_cursor(scope, task_type),
                )
            )
            params: Dict[str, Any] = {"cursor": cursor}
            if full_sync:
                # sync=1 asks the backend for the full pending claim order
                # (ordered_task_ids) whenever the revision moved.
                params["sync"] = 1
            response = laravel_client.get(
                queue_center_endpoint("queue_center_queue_diff", queue=task_type),
                base_url=base_url,
                params=params,
                activity_timeout=http_transfer_contract(),
                log_line=False,
            )
            if response.status_code != 200:
                raise RuntimeError(
                    f"Laravel queue diff failed for {task_type}: HTTP {response.status_code}"
                )
            self._on_laravel_online(base_url)
            data = self._response_data(response)
            if full_sync:
                self._sync_mirror_bootstrapped.add(task_type)
            lane_changed = bool(data.get("changed"))
            # Compact poll line: diff[200]->true means the remote head moved;
            # full-sync lanes apply the ordered diff incrementally, legacy
            # lanes follow with a bounded re-pull; false keeps the segment.
            self._diff_probe_count += 1
            self._diff_checks_since_state[task_type] = (
                self._diff_checks_since_state.get(task_type, 0) + 1
            )
            previous_state = self._diff_state_by_type.get(task_type)
            state_changed = previous_state is None or previous_state != lane_changed
            if state_changed:
                ColorPrint.gray(
                    f"{self._log_prefix} diff[{response.status_code}]->"
                    f"{'true' if lane_changed else 'false'} "
                    f"checks_since_change={self._diff_checks_since_state[task_type]} "
                    f"total_checks={self._diff_probe_count}"
                )
                self._diff_state_by_type[task_type] = lane_changed
                self._diff_checks_since_state[task_type] = 0
            self._record_queue_progress(task_type, data.get("progress"))
            if not lane_changed:
                continue
            changed = True
            ordered_ids = data.get("ordered_task_ids")
            if isinstance(ordered_ids, list):
                self._sync_backend_capable = True
                self._sync_backend_legacy = False
            elif full_sync:
                # A changed diff without ordered_task_ids proves the backend
                # has no sync support: the bounded claim-pull compat path
                # may run for this deploy window.
                self._sync_backend_legacy = True
            if full_sync and isinstance(ordered_ids, list):
                self._apply_ordered_diff(scope, task_type, ordered_ids, base_url)
                new_cursor = int(data.get("cursor") or 0)
                if new_cursor > 0:
                    self._queue_diff_cursors[task_type] = new_cursor
                    diff_task_segment_store.set_remote_cursor(
                        scope, task_type, new_cursor
                    )
                synced = True
                continue
            if self._diff_pull_capacity() <= 0:
                continue
        return {
            "changed": changed,
            "synced": synced,
            "base_url": base_url,
            "scope": scope,
        }

    def _on_laravel_online(self, base_url: str) -> None:
        """Reconnect hook for workers with a durable local delivery outbox."""

    def _record_queue_progress(self, task_type: str, progress: Any) -> None:
        """Store scalar metrics AND nested dictionaries (language_tiers) so
        tier progress survives into worker-facing reports. Shared by the
        diff-sync path and the legacy pull path."""
        if not isinstance(progress, dict):
            return
        self._queue_progress[task_type] = {
            str(key): int(value or 0)
            for key, value in progress.items()
            if isinstance(value, (int, float))
        }
        for key, value in progress.items():
            if isinstance(value, dict):
                self._queue_progress[task_type][str(key)] = {
                    str(tier_key): {
                        str(metric): int(metric_value or 0)
                        for metric, metric_value in tier_value.items()
                        if isinstance(metric_value, (int, float))
                    }
                    for tier_key, tier_value in value.items()
                    if isinstance(tier_value, dict)
                }

    @staticmethod
    def _response_data(response: Any) -> Dict[str, Any]:
        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("Laravel worker API returned a non-object response")
        data = payload.get("data")
        return data if isinstance(data, dict) else payload

    def _apply_ordered_diff(
        self,
        scope: str,
        task_type: str,
        ordered_ids: List[Any],
        base_url: str,
    ) -> None:
        """Apply one changed diff incrementally against the mirrored backlog.

        The backend reports the full pending claim order; the worker only
        materializes IDs it does not hold yet (page-data segments), drops
        staged rows that vanished from the pending set, and re-aligns the
        local order - never a bounded claim-pull, never a full re-fetch.
        """
        seen: Set[str] = set()
        ordered: List[str] = []
        for raw_id in ordered_ids:
            task_id = str(raw_id or "").strip()
            if task_id and task_id not in seen:
                seen.add(task_id)
                ordered.append(task_id)
        known = diff_task_segment_store.held_task_ids(scope, task_type)
        missing = [task_id for task_id in ordered if task_id not in known]
        vanished = [task_id for task_id in known if task_id not in seen]
        staged_total = 0
        for offset in range(0, len(missing), DATA_LIMIT):
            chunk = missing[offset:offset + DATA_LIMIT]
            response = laravel_client.get(
                queue_center_endpoint("queue_center_queue_page_data", queue=task_type),
                base_url=base_url,
                params=[("ids[]", task_id) for task_id in chunk],
                activity_timeout=http_transfer_contract(),
                log_line=False,
            )
            if response.status_code != 200:
                raise RuntimeError(
                    f"Laravel queue page-data failed for {task_type}: "
                    f"HTTP {response.status_code}"
                )
            data = self._response_data(response)
            # Queue page-data contract names the materialized rows `items`;
            # accept the legacy `tasks` alias for older Laravel deployments.
            raw_tasks = data.get("items")
            if not isinstance(raw_tasks, list):
                raw_tasks = data.get("tasks")
            tasks = (
                [dict(task) for task in raw_tasks if isinstance(task, dict)]
                if isinstance(raw_tasks, list)
                else []
            )
            for task in tasks:
                if not str(task.get("task_type") or "").strip():
                    task["task_type"] = task_type
            # The mirror stages rows for a LATER dispatch sweep (pending()
            # inside _pull_once_full_sync), so they must NOT be born
            # delivered-marked - otherwise the mirrored backlog could never
            # reach the local queue within this process.
            staged = (
                diff_task_segment_store.stage(scope, tasks, mark_delivered=False)
                if tasks
                else []
            )
            if staged:
                self._remember_task_types(staged, base_url)
                staged_total += len(staged)
        if vanished:
            diff_task_segment_store.consume_many(scope, vanished)
        reordered = diff_task_segment_store.apply_order(scope, task_type, ordered)
        self._apply_local_queue_order(task_type, ordered)
        keys = QUEUE_CENTER_DIFF_SYNC_LOG_KEYS
        sync_values = dict(zip(keys, (staged_total, len(vanished), len(ordered), reordered)))
        if self._diff_sync_log_state.get(task_type) != sync_values:
            self._diff_sync_log_state[task_type] = sync_values
            ColorPrint.blue(
                f"{self._log_prefix} sync[{task_type}] +{sync_values[keys[0]]} "
                f"-{sync_values[keys[1]]} order={sync_values[keys[2]]} "
                f"reorder={sync_values[keys[3]]}"
            )

    def _apply_local_queue_order(self, task_type: str, ordered_ids: List[str]) -> None:
        """Re-align the in-process queue with the synced claim order (heap lanes)."""

    def _ensure_laravel_claim(self, task: Dict[str, Any]) -> bool:
        """Just-in-time claim for full-sync lanes at task start.

        Owned or still-pending rows accept fine (the claim lease then covers
        the short processing window); 404/409 means the row vanished or
        belongs to another worker - drop it locally. Transport failures keep
        the task: offline processing continues from the local snapshot and
        the durable outbox plus the backend pending-claim-on-result settle
        the bookkeeping when the network returns.
        """
        if not self._sync_active():
            return True
        task_id = str(task.get("task_id") or "").strip()
        task_type = str(task.get("task_type") or "").strip()
        if not task_id or not task_type:
            return True
        if self._claim_retry_after > time.monotonic():
            return True
        base_url = (
            str(task.get("_laravel_base_url") or self._task_base_url(task_id)).strip()
            or self.api_url
        )
        try:
            claimed = self._validate_recovered_claim(task_type, task_id, base_url)
        except Exception as exc:  # noqa: BLE001 - offline processing must go on
            self._claim_retry_after = time.monotonic() + 30.0
            ColorPrint.yellow(
                f"{self._log_prefix} Claim check for task "
                f"{self._display_task_id(task_id)} unreachable ({exc}); "
                "processing from the local snapshot"
            )
            return True
        if claimed:
            self._claim_retry_after = 0.0
            return True
        diff_task_segment_store.consume(self._diff_segment_scope(base_url), task_id)
        ColorPrint.gray(
            f"{self._log_prefix} Task {self._display_task_id(task_id)} is gone "
            "or owned elsewhere - dropped from the local queue"
        )
        return False

    def _post_task_accept(
        self,
        task_type: str,
        task_id: str,
        base_url: str,
    ) -> Any:
        return laravel_client.post(
            queue_center_endpoint("worker_task_accept", task_type=task_type),
            base_url=base_url,
            json={"task_id": task_id, "worker_id": self.worker_id},
            activity_timeout=http_transfer_contract(),
        )

    def _validate_recovered_claim(
        self,
        task_type: str,
        task_id: str,
        base_url: str,
    ) -> bool:
        response = self._post_task_accept(task_type, task_id, base_url)
        if response.status_code in (200, 201):
            return True
        if response.status_code == 404 and self._ensure_worker_registered(
            base_url, force=True
        ):
            # "Task or worker not found" conflates a missing task with a
            # missing WORKER row (first contact / offline reaper / purge): a
            # fresh registration can make the very same claim succeed, so
            # retry once before dropping the task from the local mirror.
            response = self._post_task_accept(task_type, task_id, base_url)
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
        allow_backlog: bool = False,
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
            accepted = (
                self.accept_task(task, base_url, allow_backlog=True)
                if allow_backlog
                else self.accept_task(task, base_url)
            )
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
                # Dropped rows return to the backend pending set; consume the
                # staged copies so the next diff sync re-fetches them fresh.
                scope = self._diff_segment_scope(
                    self._sync_laravel_endpoint(self.api_url)
                )
                diff_task_segment_store.consume_many(
                    scope,
                    [
                        task_id
                        for task_id in (
                            str(task.get("task_id") or "").strip() for task in dropped
                        )
                        if task_id
                    ],
                )
                self._release_claimed_tasks(dropped)

    def _drop_queued_tasks(self) -> List[Dict[str, Any]]:
        """Pop every queued-but-unstarted task; overridden by heap lanes."""
        return []

    def _release_claimed_tasks(self, tasks: List[Dict[str, Any]]) -> None:
        """Return claimed-but-unstarted tasks to Laravel (best-effort, async)."""
        remote_tasks = [task for task in tasks if not task.get("_local_source")]
        if not remote_tasks:
            return
        try:
            start_bus_task(
                self._post_task_release,
                remote_tasks,
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
                    activity_timeout=http_transfer_contract(),
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
        """Pull and recover one bounded segment, preferring a changed remote head.

        Full-sync lanes NEVER run the bounded claim-pull here: their intake
        is the diff mirror (sync -> stage -> dispatch staged rows, claim
        just-in-time at task start). A pre-sync claim-pull would advance the
        diff cursor to the head revision without materializing the mirrored
        backlog, so every later diff would report changed=false and the lane
        would stall after the first claimed task.
        """
        if self._circuit_is_open():
            return {"ok": False, "processed": 0, "reason": "result_circuit_open"}
        if self._full_sync_enabled() and not self._sync_backend_legacy:
            return self._pull_once_full_sync()
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
                activity_timeout=http_transfer_contract(),
            )
            if response.status_code != 200:
                raise RuntimeError(
                    f"Laravel worker pull failed for {task_type}: HTTP {response.status_code}"
                )
            data = self._response_data(response)
            self._record_queue_progress(task_type, data.get("progress"))
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
            if not self._full_sync_enabled():
                # Cursor writes are the diff round's job on full-sync lanes;
                # a claim-pull must never move them (see _pull_once docstring).
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

    def _pull_once_full_sync(self) -> Dict[str, Any]:
        """Full-sync lane intake: mirror first, then dispatch staged rows.

        Intake order: establish/refresh the mirror through one diff round
        while sync support is not proven yet (skipped when the backend is
        unreachable - the persisted mirror plus the local heap keep offline
        processing alive), then sweep every dispatchable staged row into the
        local queue. Remote bookkeeping happens just-in-time at task start
        (_ensure_laravel_claim), so this path never claims and never touches
        diff cursors.
        """
        task_types = self._pull_task_types()
        if not task_types:
            return {"ok": True, "processed": 0}
        base_url = self._sync_laravel_endpoint(self.api_url)
        scope = self._diff_segment_scope(base_url)
        # Refresh the authoritative ordered mirror on every intake cycle. The
        # first successful response proves sync capability; subsequent cycles
        # must still poll revisions or the local heap will never see new work.
        self._sync_mirror_from_diffs(task_types)
        # Clear stale in-process delivery marks once after startup, then mark
        # rows delivered when this sweep admits them. This prevents a finished
        # task from being re-enqueued every heartbeat while its outbox result
        # is still being finalized.
        if scope not in self._full_sync_reconciled_scopes:
            diff_task_segment_store.requeue_all(scope)
            self._full_sync_reconciled_scopes.add(scope)
        recovered = diff_task_segment_store.pending(
            scope,
            STAGED_TASK_LIMIT,
        )
        if not recovered:
            ColorPrint.gray(
                f"{self._log_prefix} full-sync mirror ready but no dispatchable "
                f"tasks (scope={scope})"
            )
            return {"ok": True, "processed": 0}
        self._remember_task_types(recovered, base_url)
        processed = self._dispatch_staged_tasks(
            recovered,
            base_url,
            scope,
            allow_backlog=True,
        )
        ColorPrint.blue(
            f"{self._log_prefix} full-sync dispatch recovered={len(recovered)} "
            f"processed={processed} local_capacity={self._pull_capacity()}"
        )
        return {
            "ok": True,
            "processed": processed,
            "recovered": len(recovered),
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
        return worker_result_delivery.post(
            self,
            task_id,
            status_role,
            result,
            error,
            progress,
            attempts,
            attempt,
        )

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
