# -*- coding: utf-8 -*-
"""Handler-table Laravel worker: dispatch, inflight dedup, lease keep-alive.

A concrete worker registers one handler per contract task type. Each pulled
task runs on a local TaskManager row (visible in the UI); the handler returns
the result dict, and a raised exception reports the task ``failed``. Terminal
results travel through the durable result channel (outbox).

Handler contract: ``handler(payload, task) -> Dict[str, Any]``.
"""

import time
from typing import Any, Callable, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import serialized_method, start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyctl.desktop.task_manager import task_manager as shared_task_manager
from pycore.pyctl.laravel.worker_base import BaseLaravelWorkerService
from pycore.pyutils.common.queue_center_contract import task_execution_type, task_local_label

TaskHandler = Callable[[Dict[str, Any], Dict[str, Any]], Dict[str, Any]]
LEASE_KEEPALIVE_SIGNAL = "laravel.worker.lease_keepalive"
LEASE_KEEPALIVE_MIN_SECONDS = 15.0
LEASE_KEEPALIVE_MAX_SECONDS = 120.0
CONTENT_PREVIEW_CHARS = 120


class LaravelHandlerWorker(BaseLaravelWorkerService):
    """Composer base for workers that process tasks through a handler table."""

    def _init_handler_worker(self) -> None:
        """Called by the concrete ``__init__`` right after ``_init_base_laravel``."""
        self._handlers: Dict[str, TaskHandler] = {}

    def register_handler(self, task_type: str, handler: TaskHandler) -> None:
        """Bind one contract task type; the worker pulls only bound types."""
        self._handlers[str(task_type)] = handler

    def _pull_task_types(self) -> List[str]:
        return list(self._handlers)

    def _effective_processor_types(self) -> List[str]:
        return list(dict.fromkeys(task_execution_type(task_type) for task_type in self._handlers))

    # -------------------- intake --------------------

    def accept_task(self, task: Dict[str, Any], base_url: str = "", allow_backlog: bool = False) -> Dict[str, Any]:
        """Record the task type and dispatching endpoint, then dispatch."""
        if not isinstance(task, dict) or task.get("task_id") in (None, ""):
            return {"success": False, "error": "task with task_id is required"}
        self._remember_task_types([task], (base_url or "").strip() or self.active_base_url())
        self._dispatch(task)
        return {"success": True, "task_id": task.get("task_id")}

    def _local_input(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """TaskManager row input shown in the UI (workers add domain previews)."""
        payload = task.get("payload") or {}
        content = payload.get("content") or payload.get("text") or payload.get("word")
        return {
            "remote_task_id": task.get("task_id"),
            "app_name": task.get("app_name"),
            "task_type": task.get("task_type"),
            "execution_type": task.get("execution_type"),
            "capability": task.get("capability"),
            "content": content,
            "content_preview": str(content)[:CONTENT_PREVIEW_CHARS] if content else None,
            "language": payload.get("language"),
            "target_language": payload.get("target_language"),
            "priority": task.get("priority"),
        }

    @staticmethod
    def _local_task_label(task: Dict[str, Any]) -> str:
        return task_local_label(task.get("task_type"), task.get("capability"))

    def _purge_inflight_locked(self, now: float) -> None:
        """Drop inflight entries past their deadline so a hung executor never
        blacklists a re-dispatched task until restart."""
        for task_id in [task_id for task_id, deadline in self._inflight.items() if deadline <= now]:
            self._inflight.pop(task_id, None)

    @serialized_method
    def _release_inflight(self, task_id: Any) -> None:
        self._inflight.pop(task_id, None)

    @serialized_method
    def _dispatch(self, task: Dict[str, Any]) -> None:
        """Run one task on a TaskManager background row; the duplicate check
        and the inflight update are one state-owner operation."""
        task_id = task.get("task_id")
        now = time.monotonic()
        self._purge_inflight_locked(now)
        ttl = max(int(task.get("timeout_seconds") or self.INFLIGHT_DEFAULT_TTL), self.INFLIGHT_DEFAULT_TTL)
        if self._inflight.get(task_id, 0.0) > now:
            return
        self._inflight[task_id] = now + ttl
        task["_lease_stop"] = False
        self._start_lease_keepalive(task, ttl)
        local_task_id = shared_task_manager.create_task(
            task_type=self._local_task_label(task),
            input_data=self._local_input(task),
            estimated_time=None,
        )
        task["_local_task_id"] = local_task_id
        shared_task_manager.execute_task(local_task_id, lambda _local_task: self._execute(task))

    def _execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        task_id = task.get("task_id")
        self._process_task(task)
        local_id = task.get("_local_task_id")
        live = shared_task_manager.get_task(local_id) if local_id else None
        if live is None:
            return {"remote_task_id": task_id, "dispatched": True}
        if live.status == "failed":
            error = live.error or "failed"
            shared_task_manager.fail_task(local_id, error)
            return live.result if isinstance(live.result, dict) else {"remote_task_id": task_id, "error": error}
        if isinstance(live.result, dict) and live.result:
            return dict(live.result)
        return {"remote_task_id": task_id, "dispatched": True}

    def _start_lease_keepalive(self, task: Dict[str, Any], lease_seconds: int) -> None:
        """Ping 'processing' (no progress field) while a task runs so the
        Laravel lease tracks real work instead of expiring into a 409."""
        task_id = task.get("task_id")
        interval = max(LEASE_KEEPALIVE_MIN_SECONDS, min(LEASE_KEEPALIVE_MAX_SECONDS, float(lease_seconds) / 3.0))

        def keepalive() -> None:
            while not task.get("_lease_stop"):
                # A never-signalled name: a cancellable timer, no sleep-poll.
                THREAD_BUS.wait_signal(LEASE_KEEPALIVE_SIGNAL, timeout=interval)
                if task.get("_lease_stop"):
                    return
                self._post_result(task_id, "processing")

        start_bus_task(keepalive, thread_name=f"TaskLeaseKeepAlive{str(task_id)[:8]}Thread")

    # -------------------- processing --------------------

    def _process_task(self, task: Dict[str, Any]) -> None:
        """Run the bound handler and submit its terminal result."""
        task_id = task.get("task_id")
        task_type = str(task.get("task_type") or "")
        handler = self._handlers.get(task_type)
        try:
            if handler is None:
                self._submit_result(task_id, "failed", error=f"pycore has no handler for task_type={task_type!r}")
                return
            result = handler(dict(task.get("payload") or {}), task)
            self._submit_result(task_id, "completed", result=result, progress=100)
        except Exception as exc:  # noqa: BLE001 - handler boundary: engines are third-party
            ColorPrint.red(f"{self._log_prefix} {task_type} task {self._display_task_id(task_id)} failed: {exc}")
            self._submit_result(task_id, "failed", error=str(exc))
        finally:
            task["_lease_stop"] = True
            self._release_inflight(task_id)

    def get_status(self) -> Dict[str, Any]:
        return {
            "worker_id": self.worker_id,
            "task_types": self._pull_task_types(),
            "processor_types": self._effective_processor_types(),
            "inflight_tasks": self.inflight_count(),
            "compute": dict(self.compute_identity),
            "result_backlog": self._result_backlog(),
            "circuit_open": self.results_blocked(),
            **self.intake_status(),
        }
