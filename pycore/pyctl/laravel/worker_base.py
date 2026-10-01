# -*- coding: utf-8 -*-
"""
BaseLaravelWorkerService - thin composer of a persistent pycore worker on
Laravel's typed pull/accept/result task API.

Components (pyctl/laravel/worker/):
  - WorkerRegistration: worker row register/heartbeat.
  - ClaimLedger: task_id -> task_type / dispatching endpoint.
  - TaskClaims: accept, just-in-time claim, release.
  - TaskPuller: diff mirror, full sync, bounded pull, staged dispatch.
Results travel through ``worker_result_channel`` (pyutils/laravel): a
single-attempt ``_post_result`` or the outbox-backed ``_submit_result``.

Concrete workers provide ``worker_name`` and ``_log_prefix`` after
``_init_base_laravel()`` plus the hooks ``_pull_task_types``,
``_effective_processor_types``, ``_effective_capabilities`` and ``accept_task``.
The Laravel base URL is always ``laravel_endpoint_manager``'s active endpoint.
"""

import platform
import socket
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.diff_task_segments import diff_task_segment_store
from pycore.pyutils.common.queue_center_contract import GLOBAL_TASK_LIMITS
from pycore.pyutils.laravel.delivery_outbox import laravel_delivery_outbox
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.worker_results import (
    HTTP_STATUS_TASK_REASSIGNED,
    WORKER_RESULT_KIND,
    ResultPostOutcome,
    WorkerResult,
    worker_result_channel,
)
from pycore.pyctl.laravel.worker.claim_ledger import ClaimLedger
from pycore.pyctl.laravel.worker.registration import WorkerRegistration, build_worker_id, detect_compute_identity
from pycore.pyctl.laravel.worker.task_claims import TaskClaims, display_task_id, segment_scope
from pycore.pyctl.laravel.worker.task_puller import TaskPuller


class BaseLaravelWorkerService:
    """Composer base for persistent pycore typed pull/accept/result workers."""

    # Inflight TTL when a task carries no timeout_seconds.
    INFLIGHT_DEFAULT_TTL = 300
    # THREAD_BUS state-owner identity; every concrete worker overrides both.
    STATE_OWNER_KEY = "laravel.worker.state"
    STATE_OWNER_NAME = "LaravelWorkerState"
    STATE_OWNER_TIMEOUT = 60.0
    PULL_LIMIT = GLOBAL_TASK_LIMITS["worker_pull_default"]
    WORKER_ID_PREFIX = "pycore-worker"
    LOG_ACCEPTED_RESULTS = True
    FULL_SYNC_ENABLED = False
    # Dedicated single-type workers name their result route type for tasks
    # whose type was not recorded at dispatch.
    RESULT_TASK_TYPE = ""

    def _init_base_laravel(self) -> None:
        """Called FIRST by the concrete ``__init__`` (which owns idempotency)."""
        self.worker_id = build_worker_id(self.WORKER_ID_PREFIX)
        self.worker_name = self.worker_id
        self.hostname = socket.gethostname()
        self.platform = platform.platform()
        self.compute_identity = detect_compute_identity()
        self._log_prefix = "[LaravelWorker]"
        self._lane_stop_requested = False
        self._lane_stop_graceful = True
        # task_id -> monotonic deadline of an in-flight dispatch.
        self._inflight: Dict[str, float] = {}
        self._ledger = ClaimLedger()
        self._registration = WorkerRegistration(self)
        self._claims = TaskClaims(self, self._ledger, self._registration)
        self._puller = TaskPuller(self, self._ledger, self._claims, self._registration, self.STATE_OWNER_NAME)
        init_serialized_owner(self, self.STATE_OWNER_KEY, self.STATE_OWNER_NAME, timeout=self.STATE_OWNER_TIMEOUT)
        worker_result_channel.register_worker(self.worker_id, self._result_settled)
        laravel_endpoint_manager.register_endpoint_change_listener(self.on_endpoint_changed)

    # -------------------- host interface (LaravelWorkerHost) --------------------

    @property
    def log_prefix(self) -> str:
        return self._log_prefix

    @property
    def api_url(self) -> str:
        return self.active_base_url()

    def active_base_url(self) -> str:
        """The selected server's active route (network-free)."""
        return laravel_endpoint_manager.get_active_base_url().rstrip("/")

    def identity_params(self) -> Dict[str, Any]:
        """Worker identity of the register and pull routes, as real JSON arrays
        (flat keys made processor_types/capabilities vanish server-side)."""
        return {
            "worker_id": self.worker_id,
            "worker_name": self.worker_name,
            "processor_types": list(self._effective_processor_types()),
            "capabilities": list(self._effective_capabilities()),
            "hostname": self.hostname,
            "platform": self.platform,
            "lease_capacity": max(1, min(int(self._lease_capacity()), GLOBAL_TASK_LIMITS["worker_pull"])),
            **self.compute_identity,
        }

    def offer_params(self) -> Dict[str, Any]:
        """Query identity of diff/page-data reads: Laravel lists only the
        tasks it offers to this pycore (its compute class)."""
        return {"worker_id": self.worker_id, "compute_class": self.compute_identity["compute_class"]}

    def pull_task_types(self) -> List[str]:
        return self._pull_task_types()

    def full_sync_enabled(self) -> bool:
        return bool(self.FULL_SYNC_ENABLED)

    def lane_halt_requested(self) -> bool:
        return self._lane_halt_requested()

    def inflight_count(self) -> int:
        return len(self._inflight)

    def results_blocked(self) -> bool:
        return worker_result_channel.circuit_open(self.worker_id)

    def pending_result_task_ids(self, task_ids: List[str]) -> List[str]:
        return worker_result_channel.pending_task_ids(self.worker_id, task_ids)

    def run_pull_cycle(self, prefer_remote: bool = False) -> Dict[str, Any]:
        """One intake cycle; lanes extend it (e.g. refresh metadata first)."""
        return self._puller.pull_cycle(prefer_remote=prefer_remote)

    def laravel_online(self, base_url: str) -> None:
        self._on_laravel_online(base_url)

    def registration_renewed(self) -> None:
        """A fresh registration may face a newly deployed Laravel."""
        self._puller.reset_unsupported_task_types()

    def apply_local_queue_order(self, task_type: str, ordered_ids: List[str]) -> None:
        self._apply_local_queue_order(task_type, ordered_ids)

    # -------------------- hooks --------------------

    def _pull_task_types(self) -> List[str]:
        return []

    def _effective_processor_types(self) -> List[str]:
        return []

    def _effective_capabilities(self) -> List[str]:
        return []

    def _lease_capacity(self) -> int:
        return max(1, int(self.PULL_LIMIT))

    def _on_laravel_online(self, base_url: str) -> None:
        """Reconnect hook for workers with a durable local delivery outbox."""

    def _apply_local_queue_order(self, task_type: str, ordered_ids: List[str]) -> None:
        """Re-align the in-process queue with the synced claim order (heap lanes)."""

    def _drop_queued_tasks(self) -> List[Dict[str, Any]]:
        """Pop every queued-but-unstarted task; overridden by heap lanes."""
        return []

    def accept_task(self, task: Dict[str, Any], base_url: str = "", allow_backlog: bool = False) -> Dict[str, Any]:
        raise NotImplementedError

    # -------------------- intake --------------------

    def on_endpoint_changed(self, new_url: str) -> None:
        self._registration.reset()
        self._puller.reset_unsupported_task_types()
        ColorPrint.blue(f"{self._log_prefix} Endpoint changed -> {new_url!r}")

    def poll_diff_once(self) -> Dict[str, Any]:
        return self._puller.poll_diff_once()

    def request_pull(self, prefer_remote: bool = False) -> None:
        self._puller.request_pull(prefer_remote)

    def pull_once(self, prefer_remote: bool = False) -> Dict[str, Any]:
        return self._puller.pull_once(prefer_remote)

    def _fetch_mirror_from_diffs(self, task_types: List[str]) -> Dict[str, Any]:
        return self._puller.fetch_mirror(task_types)

    def _ensure_laravel_claim(self, task: Dict[str, Any]) -> bool:
        return self._claims.ensure(task, self._puller.sync_active())

    def _pull_capacity(self) -> int:
        return self._puller.pull_capacity()

    def _diff_pull_capacity(self) -> int:
        return self._puller.diff_pull_capacity()

    @property
    def _queue_progress(self) -> Dict[str, Dict[str, Any]]:
        return self._puller.queue_progress

    def _diff_segment_scope(self, base_url: str) -> str:
        return segment_scope(self, base_url)

    def _remember_task_types(self, tasks: List[Dict[str, Any]], base_url: str) -> None:
        self._ledger.remember(tasks, base_url)

    def _task_base_url(self, task_id: Any) -> str:
        return self._ledger.base_url(task_id, self.active_base_url())

    @staticmethod
    def _display_task_id(task_id: Any) -> str:
        return display_task_id(task_id)

    def set_cached_task_priority(self, task_id: Any, priority: int, move_to_head: bool) -> None:
        """Apply one Laravel priority event to the bounded local cache."""
        diff_task_segment_store.set_priority(
            segment_scope(self, self.active_base_url()), task_id, priority, move_to_head,
        )

    def set_cached_task_head(self, task_id: Any, queue_position: int) -> None:
        """Apply one Laravel queue-head event to the bounded local cache."""
        diff_task_segment_store.move_to_head(segment_scope(self, self.active_base_url()), task_id, queue_position)

    # -------------------- lane lifecycle --------------------

    def _lane_halt_requested(self) -> bool:
        """True while an immediate stop is in effect (halts drains and pulls)."""
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
        """graceful finishes the claimed queue without pulling; immediate halts
        between tasks and releases the unstarted claims back to Laravel.
        In-flight tasks always finish and report normally."""
        changed = not self._lane_stop_requested or self._lane_stop_graceful != bool(graceful)
        self._lane_stop_requested = True
        self._lane_stop_graceful = bool(graceful)
        if changed:
            ColorPrint.yellow(f"{self._log_prefix} lane stop requested (graceful={bool(graceful)})")
        if graceful:
            return
        dropped = self._drop_queued_tasks()
        if dropped:
            # Released rows return to the backend pending set; the next diff
            # sync re-fetches them fresh.
            diff_task_segment_store.consume_many(
                segment_scope(self, self.active_base_url()),
                [task_id for task_id in (str(task.get("task_id") or "").strip() for task in dropped) if task_id],
            )
            self._claims.release(dropped)

    # -------------------- results --------------------

    def _worker_result(
        self, task_id: Any, status_role: str, result: Optional[Dict[str, Any]],
        error: Optional[str], progress: Optional[int], attempt: Optional[int],
    ) -> Optional[WorkerResult]:
        task_type = self._ledger.task_type(task_id)
        if not task_type and str(self.RESULT_TASK_TYPE or "").strip():
            task_type = str(self.RESULT_TASK_TYPE).strip()
            self._ledger.remember([{"task_id": task_id, "task_type": task_type}], self.active_base_url())
            ColorPrint.yellow(
                f"{self._log_prefix} Restored missing task_type for task {display_task_id(task_id)} as {task_type}"
            )
        if not task_type:
            ColorPrint.red(
                f"{self._log_prefix} Result for task {display_task_id(task_id)} has no recorded "
                "task_type - dropping (Laravel re-queues at lease timeout)"
            )
            return None
        return WorkerResult.for_role(
            status_role,
            task_id=str(task_id),
            task_type=task_type,
            worker_id=self.worker_id,
            base_url=self._task_base_url(task_id),
            result=result,
            error=error,
            progress=progress,
            attempt=attempt,
        )

    def _post_result(
        self,
        task_id: Any,
        status_role: str,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        progress: Optional[int] = None,
        attempt: Optional[int] = None,
    ) -> ResultPostOutcome:
        """One immediate result POST (progress pings, outbox delivery steps).
        A non-terminal ping is skipped while its server is known offline or
        during shutdown."""
        worker_result = self._worker_result(task_id, status_role, result, error, progress, attempt)
        if worker_result is None:
            return ResultPostOutcome(False, 0, "task_type_unknown")
        if not worker_result.terminal and (
            THREAD_BUS.is_shutdown_requested()
            or laravel_endpoint_manager.is_reachable(worker_result.base_url) is False
        ):
            return ResultPostOutcome(False, 0, "skipped")
        outcome = worker_result_channel.post(worker_result)
        if (worker_result.terminal and not outcome.retryable) or outcome.http_status == HTTP_STATUS_TASK_REASSIGNED:
            self._result_settled(worker_result, outcome)
        elif outcome.rejected:
            ColorPrint.yellow(
                f"{self._log_prefix} {worker_result.status} for task {display_task_id(task_id)} -> {outcome.error}"
            )
        return outcome

    def _submit_result(
        self,
        task_id: Any,
        status_role: str,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        progress: Optional[int] = None,
        attempt: Optional[int] = None,
    ) -> bool:
        """Durable terminal result: the outbox delivers it (first attempt at
        once) and retries until the server accepts or rejects it."""
        worker_result = self._worker_result(task_id, status_role, result, error, progress, attempt)
        if worker_result is None:
            return False
        worker_result_channel.submit(worker_result)
        return True

    def _result_settled(self, worker_result: WorkerResult, outcome: ResultPostOutcome) -> None:
        """A terminal result was accepted or permanently rejected: release its
        staged segment row and its ledger entry. A 409 settles any transition:
        the task was reassigned and the new owner reports it."""
        if not worker_result.terminal and outcome.http_status != HTTP_STATUS_TASK_REASSIGNED:
            return
        if outcome.accepted and self.LOG_ACCEPTED_RESULTS:
            ColorPrint.green(
                f"{self._log_prefix} Posted '{worker_result.status}' for task {display_task_id(worker_result.task_id)}"
            )
        elif not outcome.accepted:
            ColorPrint.yellow(
                f"{self._log_prefix} Result for task {display_task_id(worker_result.task_id)} rejected "
                f"({outcome.error}) - not retryable"
            )
        diff_task_segment_store.consume(segment_scope(self, worker_result.base_url), worker_result.task_id)
        self._ledger.forget(worker_result.task_id)

    def unsupported_task_types(self) -> List[str]:
        """Contract task types the active Laravel server does not know yet."""
        return self._puller.unsupported_task_types()

    def _result_backlog(self) -> int:
        """Terminal results waiting in the outbox for the selected server."""
        stats = laravel_delivery_outbox.stats(WORKER_RESULT_KIND)
        return int(stats.get("pending") or 0)
