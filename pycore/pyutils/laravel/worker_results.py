# -*- coding: utf-8 -*-
"""Typed Laravel worker result channel.

One result transition (``processing`` / ``completed`` / ``failed``) is a
``WorkerResult``. ``post`` sends it once and classifies the answer;
``submit`` makes it durable: the row is persisted in ``laravel_delivery_outbox``
and its immediate drain is the first attempt, so the outbox is the only retry
mechanism. Each worker registers one settle listener that runs when its result
was accepted or terminally rejected.
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, replace
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.http_client import redacted_http_error
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_STATUSES_BY_ROLE,
    GLOBAL_TASK_TERMINAL_STATUSES,
    GLOBAL_TASK_WORKER_RESULT_STATUSES,
    QUEUE_CENTER_DIFF_DELIVERY,
    queue_center_endpoint,
)
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.delivery_outbox import laravel_delivery_outbox
from pycore.pyutils.laravel.delivery.model import (
    DeliveryKind,
    OUTCOME_DEAD_LETTER,
    OUTCOME_DONE,
    OUTCOME_RETRY,
    OUTCOME_SOURCE_GONE,
    make_delivery_id,
)

WORKER_RESULT_KIND = "worker_result"
WORKER_RESULT_PARALLEL = 4
WORKER_RESULT_RETRY_INITIAL_SECONDS = max(
    1.0, float(QUEUE_CENTER_DIFF_DELIVERY["consumer_upload_retry"]["initial_seconds"]),
)
WORKER_RESULT_RETRY_MAX_SECONDS = max(
    WORKER_RESULT_RETRY_INITIAL_SECONDS,
    float(QUEUE_CENTER_DIFF_DELIVERY["consumer_upload_retry"]["maximum_seconds"]),
)
HTTP_STATUS_TASK_GONE = 404
HTTP_STATUS_TASK_REASSIGNED = 409
# Backend breaker: after this many consecutive HTTP 5xx answers to one
# worker's results (e.g. a broken table after a half-finished migration) the
# worker stops claiming new work for the cooldown; any accepted result closes it.
RESULT_CIRCUIT_FAIL_THRESHOLD = 3
RESULT_CIRCUIT_COOLDOWN_SECONDS = 120.0


@dataclass(frozen=True)
class WorkerResult:
    task_id: str
    task_type: str
    worker_id: str
    status: str
    base_url: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: Optional[int] = None
    attempt: Optional[int] = None

    @classmethod
    def for_role(cls, status_role: str, **fields: Any) -> "WorkerResult":
        status = GLOBAL_TASK_STATUSES_BY_ROLE.get(status_role, status_role)
        if status not in GLOBAL_TASK_WORKER_RESULT_STATUSES:
            raise ValueError(f"Unsupported Laravel worker result status: {status_role}")
        return cls(status=status, **fields)

    @property
    def terminal(self) -> bool:
        return self.status in GLOBAL_TASK_TERMINAL_STATUSES

    def body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {"task_id": self.task_id, "worker_id": self.worker_id, "status": self.status}
        if self.attempt is not None:
            body["attempt"] = max(0, int(self.attempt))
        if self.progress is not None:
            body["progress"] = self.progress
        if self.result is not None:
            body["result"] = self.result
        if self.error is not None:
            body["error"] = self.error
        return body


@dataclass(frozen=True)
class ResultPostOutcome:
    accepted: bool
    http_status: int = 0
    error: str = ""

    @property
    def retryable(self) -> bool:
        """Transport failure or a backend 5xx: the same result may land later."""
        return not self.accepted and (self.http_status == 0 or self.http_status >= 500)

    @property
    def rejected(self) -> bool:
        """4xx: the server will never accept this result (409 reassigned, 404 row gone)."""
        return not self.accepted and not self.retryable


SettleListener = Callable[[WorkerResult, ResultPostOutcome], None]


class WorkerResultChannel:
    """Single-attempt posts plus outbox-backed durable submission."""

    def __init__(self) -> None:
        self._listeners: Dict[str, SettleListener] = {}
        self._server_errors: Dict[str, Dict[str, float]] = {}
        self._registered = False
        init_serialized_owner(self, "laravel.worker_results", "LaravelWorkerResultsState")

    @serialized_method
    def register_worker(self, worker_id: str, on_settled: SettleListener) -> None:
        self._listeners[str(worker_id)] = on_settled
        if not self._registered:
            self._registered = True
            laravel_delivery_outbox.register(DeliveryKind(
                name=WORKER_RESULT_KIND,
                deliver=self._deliver,
                parallel=WORKER_RESULT_PARALLEL,
                retry_initial_seconds=WORKER_RESULT_RETRY_INITIAL_SECONDS,
                retry_max_seconds=WORKER_RESULT_RETRY_MAX_SECONDS,
            ))

    @serialized_method
    def _listener(self, worker_id: str) -> Optional[SettleListener]:
        return self._listeners.get(str(worker_id))

    @serialized_method
    def _note_outcome(self, worker_id: str, outcome: "ResultPostOutcome") -> None:
        if outcome.accepted:
            if self._server_errors.pop(worker_id, None):
                ColorPrint.green(f"[LaravelWorkerResult] {worker_id}: backend accepted a result - circuit reset")
            return
        if outcome.http_status < 500:
            return
        entry = self._server_errors.setdefault(worker_id, {"streak": 0.0, "open_until": 0.0})
        entry["streak"] += 1
        if entry["streak"] >= RESULT_CIRCUIT_FAIL_THRESHOLD:
            if entry["open_until"] <= time.monotonic():
                ColorPrint.red(
                    f"[LaravelWorkerResult] {worker_id}: backend rejecting results ({int(entry['streak'])}x HTTP 5xx) "
                    f"- pausing new claims for {RESULT_CIRCUIT_COOLDOWN_SECONDS:.0f}s"
                )
            entry["open_until"] = time.monotonic() + RESULT_CIRCUIT_COOLDOWN_SECONDS

    @serialized_method
    def circuit_open(self, worker_id: str) -> bool:
        """True while the worker's backend breaker cools down."""
        return time.monotonic() < float((self._server_errors.get(worker_id) or {}).get("open_until") or 0.0)

    def post(self, result: WorkerResult) -> ResultPostOutcome:
        """Send one result transition once; never raises for transport failures."""
        outcome = self._send(result)
        if result.terminal:
            # Only result posts feed the breaker; single-shot progress pings do not.
            self._note_outcome(result.worker_id, outcome)
        return outcome

    @staticmethod
    def _send(result: WorkerResult) -> ResultPostOutcome:
        try:
            response = laravel_client.post(
                queue_center_endpoint("worker_task_result", task_type=result.task_type),
                base_url=result.base_url,
                json=result.body(),
            )
        except OSError as exc:
            return ResultPostOutcome(False, 0, redacted_http_error(exc))
        if response.status_code in (200, 201):
            return ResultPostOutcome(True, response.status_code)
        return ResultPostOutcome(False, response.status_code, f"HTTP {response.status_code}")

    def submit(self, result: WorkerResult) -> Dict[str, Any]:
        """Persist one terminal result for the dispatching server and start
        its first delivery attempt at once."""
        return laravel_delivery_outbox.enqueue(WORKER_RESULT_KIND, {
            "delivery_id": make_delivery_id(
                WORKER_RESULT_KIND, result.worker_id, result.task_id, result.attempt, result.status,
            ),
            "task_id": result.task_id,
            "group_key": self._group_key(result.worker_id, result.task_id),
            "base_url": result.base_url,
            "pin_base_url": True,
            "worker_result": asdict(result),
        })

    @staticmethod
    def _group_key(worker_id: str, task_id: Any) -> str:
        return f"{worker_id}:{task_id}"

    def pending_task_ids(self, worker_id: str, task_ids: List[str]) -> List[str]:
        """Task ids of this worker whose terminal result still waits in the
        outbox (survives restarts): such a task must not run again."""
        keys = {self._group_key(worker_id, task_id): str(task_id) for task_id in task_ids}
        return [keys[key] for key in laravel_delivery_outbox.pending_group_keys(WORKER_RESULT_KIND, list(keys))]

    def has_pending_results(self, worker_id: str) -> bool:
        """True while any terminal result of ``worker_id`` still waits in the outbox."""
        return laravel_delivery_outbox.has_pending_group_prefix(WORKER_RESULT_KIND, self._group_key(worker_id, ""))

    def _deliver(self, row: Dict[str, Any], owner: str) -> Dict[str, Any]:
        result = WorkerResult(**dict(row.get("worker_result") or {}))
        # The outbox may route the row through another endpoint of the same
        # server; the listener still sees the dispatching endpoint.
        outcome = self.post(replace(result, base_url=str(row.get("base_url") or result.base_url)))
        if outcome.retryable:
            return {"status": OUTCOME_RETRY, "error": outcome.error, "server_error": outcome.http_status >= 500}
        listener = self._listener(result.worker_id)
        if listener is not None:
            listener(result, outcome)
        if outcome.accepted:
            return {"status": OUTCOME_DONE}
        if outcome.http_status in (HTTP_STATUS_TASK_GONE, HTTP_STATUS_TASK_REASSIGNED):
            ColorPrint.yellow(
                f"[LaravelWorkerResult] task {result.task_id} {result.status} result dropped: "
                f"HTTP {outcome.http_status} (task gone or reassigned)"
            )
            return {"status": OUTCOME_SOURCE_GONE, "error": outcome.error}
        return {"status": OUTCOME_DEAD_LETTER, "error": outcome.error}


worker_result_channel = WorkerResultChannel()


__all__ = [
    "HTTP_STATUS_TASK_GONE",
    "HTTP_STATUS_TASK_REASSIGNED",
    "RESULT_CIRCUIT_COOLDOWN_SECONDS",
    "RESULT_CIRCUIT_FAIL_THRESHOLD",
    "ResultPostOutcome",
    "WORKER_RESULT_KIND",
    "WorkerResult",
    "worker_result_channel",
]
