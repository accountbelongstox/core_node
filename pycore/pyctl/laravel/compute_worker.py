# -*- coding: utf-8 -*-
"""Compute worker: Laravel's former pycore calls as pulled global tasks.

Laravel never calls pycore; it enqueues compute task types (contract types
claimed by pycore on the remote_compute / remote_ocr / remote_phrase_extract
execution types) that this worker pulls through the shared pull/accept/result
cycle. The handlers live in ``compute_handlers``; only bound and available
types are declared and pulled.
"""

from typing import Any, Callable, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.laravel.compute_handlers import COMPUTE_AVAILABILITY, COMPUTE_HANDLERS
from pycore.pyctl.laravel.phrase_extract_handler import PHRASE_EXTRACT_EXECUTION_TYPE
from pycore.pyctl.laravel.worker.handler_worker import LaravelHandlerWorker, TaskHandler
from pycore.pyutils.common.queue_center_contract import GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE, GLOBAL_TASK_TYPES_BY_KEY

COMPUTE_EXECUTION_TYPES = (
    GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE["remote_compute"],
    GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE["remote_ocr"],
    PHRASE_EXTRACT_EXECUTION_TYPE,
)
COMPUTE_TASK_TYPE_KEYS = tuple(
    key for key, entry in GLOBAL_TASK_TYPES_BY_KEY.items()
    if entry.get("execution_type") in COMPUTE_EXECUTION_TYPES and "pycore" in (entry.get("claimants") or ())
)


class LaravelComputeWorker(LaravelHandlerWorker):
    STATE_OWNER_KEY = "laravel.compute_worker.state"
    STATE_OWNER_NAME = "LaravelComputeWorkerState"
    WORKER_ID_PREFIX = "pycore-compute"

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return
        self._init_base_laravel()
        self._init_handler_worker()
        self.worker_name = f"pycore-compute-{self.worker_id}"
        self._log_prefix = "[ComputeWorker]"
        for task_type, handler in COMPUTE_HANDLERS.items():
            self.register_handler(task_type, handler, COMPUTE_AVAILABILITY.get(task_type))
        self._initialized = True

    def register_handler(
        self, task_type: str, handler: TaskHandler, available: Optional[Callable[[], bool]] = None,
    ) -> None:
        if task_type not in COMPUTE_TASK_TYPE_KEYS:
            raise ValueError(f"Not a compute task type in the queue center contract: {task_type}")
        super().register_handler(task_type, handler, available)
        ColorPrint.blue(f"{self._log_prefix} handler bound for {task_type}")

    def get_status(self) -> Dict[str, Any]:
        return {"service": "Compute Worker", **super().get_status()}


laravel_compute_worker = LaravelComputeWorker()


__all__ = ["COMPUTE_TASK_TYPE_KEYS", "LaravelComputeWorker", "laravel_compute_worker"]
