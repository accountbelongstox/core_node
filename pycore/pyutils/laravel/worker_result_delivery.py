# -*- coding: utf-8 -*-
"""Durable typed Laravel worker result delivery."""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.diff_task_segments import diff_task_segment_store
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_STATUSES_BY_ROLE,
    GLOBAL_TASK_TERMINAL_STATUSES,
    GLOBAL_TASK_WORKER_RESULT_STATUSES,
    http_transfer_contract,
    queue_center_endpoint,
)
from pycore.pyutils.laravel.client import laravel_client


def short_http_error(error: Exception) -> str:
    name = type(error).__name__
    message = str(error)
    normalized = message.lower()
    if "actively refused" in normalized or "refused" in normalized:
        return "connection refused (Laravel not listening)"
    if "connectionrefused" in name.lower():
        return "connection refused (Laravel not listening)"
    if "timed out" in normalized or "timeout" in normalized.replace("connecttimeout", ""):
        return "timed out"
    if "max retries" in normalized or "newconnectionerror" in normalized:
        return "host unreachable"
    if "failed to establish" in normalized:
        return "host unreachable"
    if "name or service not known" in normalized or "getaddrinfo" in normalized:
        return "host not resolvable"
    return message.splitlines()[0][:120] if message else name


class WorkerResultDelivery:
    """Submit independently retryable worker result transitions."""

    @staticmethod
    def post(
        worker: Any,
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
        task_display_id = worker._display_task_id(task_id)
        if status not in GLOBAL_TASK_WORKER_RESULT_STATUSES:
            raise ValueError(f"Unsupported Laravel worker result status: {status_role}")
        body: Dict[str, Any] = {
            "task_id": task_id,
            "worker_id": worker.worker_id,
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
        task_type = worker._task_type_by_id.get(task_key)
        if not task_type:
            task_type = str(
                getattr(worker, "RESULT_TASK_TYPE", "") or ""
            ).strip()
            if task_type:
                worker._task_type_by_id[task_key] = task_type
                worker._task_endpoint_by_id.setdefault(task_key, worker.api_url.rstrip("/"))
                ColorPrint.yellow(
                    f"{worker._log_prefix} Restored missing task_type for task "
                    f"{task_display_id} as {task_type}"
                )
        if not task_type:
            ColorPrint.red(
                f"{worker._log_prefix} Result for task {task_display_id} has no recorded "
                "task_type - dropping (Laravel re-queues at lease timeout)"
            )
            return False
        result_url = queue_center_endpoint("worker_task_result", task_type=task_type)
        result_base_url = worker._task_base_url(task_id)
        terminal_result = status in GLOBAL_TASK_TERMINAL_STATUSES

        last_note = ""
        last_was_5xx = False
        max_attempts = worker.RESULT_POST_ATTEMPTS if attempts is None else max(1, int(attempts))
        activity_contract = http_transfer_contract()
        for attempt in range(1, max_attempts + 1):
            if THREAD_BUS.is_shutdown_requested() and not terminal_result:
                ColorPrint.yellow(
                    f"{worker._log_prefix} Result POST for task {task_display_id} "
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
                    if worker.LOG_ACCEPTED_RESULTS:
                        ColorPrint.green(
                            f"{worker._log_prefix} Posted '{status}' for task "
                            f"{task_display_id}"
                        )
                    worker._note_result_accepted()
                    if status in GLOBAL_TASK_TERMINAL_STATUSES:
                        diff_task_segment_store.consume(
                            worker._diff_segment_scope(result_base_url),
                            task_id,
                        )
                        worker._forget_task_endpoint(task_id)
                    return True
                if resp.status_code == 409:
                    # Task reassigned (we lost the claim, e.g. after a timeout
                    # release) - the new owner reports it; do not retry.
                    ColorPrint.yellow(
                        f"{worker._log_prefix} Result for task {task_display_id} rejected (409: "
                        f"task reassigned / not ours) - dropping"
                    )
                    diff_task_segment_store.consume(
                        worker._diff_segment_scope(result_base_url),
                        task_id,
                    )
                    worker._forget_task_endpoint(task_id)
                    return False
                if 400 <= resp.status_code < 500:
                    ColorPrint.yellow(
                        f"{worker._log_prefix} Result POST for task {task_display_id} -> "
                        f"HTTP {resp.status_code} (not retryable)"
                    )
                    if terminal_result:
                        diff_task_segment_store.consume(
                            worker._diff_segment_scope(result_base_url),
                            task_id,
                        )
                        worker._forget_task_endpoint(task_id)
                    return False
                last_note = f"HTTP {resp.status_code}"
                last_was_5xx = 500 <= resp.status_code < 600
            except Exception as e:
                last_note = short_http_error(e)
                last_was_5xx = False  # transport error, not a backend 5xx

            if attempt < max_attempts:
                if THREAD_BUS.is_shutdown_requested() and not terminal_result:
                    ColorPrint.yellow(
                        f"{worker._log_prefix} Result retry for task {task_display_id} "
                        "cancelled during shutdown"
                    )
                    return False
                delay = worker.RESULT_POST_BACKOFF_SECONDS[
                    min(attempt - 1, len(worker.RESULT_POST_BACKOFF_SECONDS) - 1)
                ]
                ColorPrint.yellow(
                    f"{worker._log_prefix} Result POST for task {task_display_id} failed "
                    f"({last_note}); retry {attempt}/{max_attempts - 1} "
                    f"in {delay}s"
                )
                time.sleep(delay)

        if max_attempts > 1:
            ColorPrint.red(
                f"{worker._log_prefix} Result POST for task {task_display_id} gave up after "
                f"{max_attempts} attempts ({last_note}); Laravel's timeout "
                f"release will re-queue the task"
            )
        # Only a real budgeted attempt that ended on a backend 5xx counts toward
        # the breaker. Best-effort single-shot pings (attempts=1) and transport
        # errors do not.
        if max_attempts > 1 and last_was_5xx:
            worker._note_result_server_error()
        if terminal_result:
            diff_task_segment_store.defer(
                worker._diff_segment_scope(result_base_url),
                [task_id],
                worker.CIRCUIT_COOLDOWN_SECONDS,
            )
            ColorPrint.yellow(
                f"{worker._log_prefix} Deferred task {task_display_id} for persistent retry"
            )
        return False


worker_result_delivery = WorkerResultDelivery()


__all__ = ["short_http_error", "worker_result_delivery"]
