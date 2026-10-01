# -*- coding: utf-8 -*-
"""Claim accept / just-in-time claim / release of Laravel worker tasks."""

import time
from typing import Any, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyutils.common.diff_task_segments import diff_task_segment_store
from pycore.pyutils.common.http_client import redacted_http_error
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_LIMITS,
    queue_center_endpoint,
)
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyctl.laravel.worker.claim_ledger import ClaimLedger
from pycore.pyctl.laravel.worker.host import LaravelWorkerHost
from pycore.pyctl.laravel.worker.registration import WorkerRegistration

# After an unreachable claim check, tasks run from the local snapshot without
# re-checking for this long (the outbox settles the bookkeeping later).
CLAIM_CHECK_RETRY_SECONDS = 30.0


def display_task_id(task_id: Any) -> str:
    """Compact task identifier for human-facing logs only."""
    value = str(task_id or "")
    return f"{value[:8]}..." if len(value) > 8 else value


def segment_scope(host: LaravelWorkerHost, base_url: str) -> str:
    return f"{host.worker_name}:{host.worker_id}:{base_url}"


class TaskClaims:
    """Laravel claim bookkeeping for one worker."""

    def __init__(self, host: LaravelWorkerHost, ledger: ClaimLedger, registration: WorkerRegistration) -> None:
        self._host = host
        self._ledger = ledger
        self._registration = registration
        self._claim_retry_after = 0.0

    def _post_accept(self, task_type: str, task_id: str, base_url: str) -> Any:
        return laravel_client.post(
            queue_center_endpoint("worker_task_accept", task_type=task_type),
            base_url=base_url,
            json={"task_id": task_id, "worker_id": self._host.worker_id},
        )

    def validate(self, task_type: str, task_id: str, base_url: str) -> bool:
        """True when this worker owns (or just claimed) the task; False when
        it is gone or owned elsewhere. Raises on other answers."""
        response = self._post_accept(task_type, task_id, base_url)
        if response.status_code in (200, 201):
            return True
        if response.status_code == 404 and self._registration.ensure(base_url, force=True):
            # "Task or worker not found" also means a missing WORKER row: a
            # fresh registration can make the same claim succeed.
            response = self._post_accept(task_type, task_id, base_url)
            if response.status_code in (200, 201):
                return True
        if response.status_code in (404, 409):
            return False
        raise RuntimeError(
            f"Laravel worker accept failed for {display_task_id(task_id)}: HTTP {response.status_code}"
        )

    def ensure(self, task: Dict[str, Any], sync_active: bool) -> bool:
        """Just-in-time claim for full-sync lanes at task start. Transport
        failures keep the task (offline processing from the local snapshot)."""
        if not sync_active:
            return True
        task_id = str(task.get("task_id") or "").strip()
        task_type = str(task.get("task_type") or "").strip()
        if not task_id or not task_type or self._claim_retry_after > time.monotonic():
            return True
        base_url = (
            str(task.get("_laravel_base_url") or self._ledger.base_url(task_id, "")).strip()
            or self._host.active_base_url()
        )
        if not laravel_endpoint_manager.serves_selected(base_url):
            ColorPrint.gray(
                f"{self._host.log_prefix} Task {display_task_id(task_id)} belongs to "
                f"{base_url}, not the selected Laravel server - dropped from the local queue"
            )
            return False
        try:
            claimed = self.validate(task_type, task_id, base_url)
        except OSError as exc:
            self._claim_retry_after = time.monotonic() + CLAIM_CHECK_RETRY_SECONDS
            ColorPrint.yellow(
                f"{self._host.log_prefix} Claim check for task {display_task_id(task_id)} "
                f"unreachable ({redacted_http_error(exc)}); processing from the local snapshot"
            )
            return True
        if claimed:
            self._claim_retry_after = 0.0
            return True
        diff_task_segment_store.consume(segment_scope(self._host, base_url), task_id)
        ColorPrint.gray(
            f"{self._host.log_prefix} Task {display_task_id(task_id)} is gone "
            "or owned elsewhere - dropped from the local queue"
        )
        return False

    def release(self, tasks: List[Dict[str, Any]]) -> None:
        """Return claimed-but-unstarted tasks to Laravel (asynchronous; the
        lease timeout re-queues them when this POST cannot land)."""
        remote_tasks = [task for task in tasks if not task.get("_local_source")]
        if remote_tasks:
            start_bus_task(self._post_release, remote_tasks, thread_name="LaravelWorkerReleaseThread")

    def _post_release(self, tasks: List[Dict[str, Any]]) -> None:
        grouped: Dict[str, List[str]] = {}
        for task in tasks:
            task_id = str(task.get("task_id") or "")
            task_type = str(task.get("task_type") or self._ledger.task_type(task_id) or "")
            if task_id and task_type:
                grouped.setdefault(task_type, []).append(task_id)
        for task_type, task_ids in grouped.items():
            try:
                response = laravel_client.post(
                    queue_center_endpoint("worker_task_release", task_type=task_type),
                    base_url=self._ledger.base_url(task_ids[0], self._host.active_base_url()),
                    json={"worker_id": self._host.worker_id, "task_ids": task_ids[: GLOBAL_TASK_LIMITS["worker_pull"]]},
                )
            except OSError as exc:
                ColorPrint.yellow(
                    f"{self._host.log_prefix} task release for {task_type} failed "
                    f"({redacted_http_error(exc)}) - lease timeout will re-queue them"
                )
                continue
            if response.status_code == 200:
                ColorPrint.blue(
                    f"{self._host.log_prefix} released {len(task_ids)} unstarted {task_type} task(s) back to pending"
                )
            else:
                ColorPrint.yellow(
                    f"{self._host.log_prefix} task release for {task_type} failed: "
                    f"HTTP {response.status_code} - lease timeout will re-queue them"
                )
