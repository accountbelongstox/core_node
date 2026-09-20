import copy
from typing import Any, Callable, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method, start_bus_task


class BackgroundJobs:
    def __init__(self, name: str) -> None:
        self._name = name
        self._jobs: Dict[str, Any] = {}
        self._cancelled: set[str] = set()
        init_serialized_owner(self, f"background_jobs.{name}", "BackgroundJobsStateThread")

    @serialized_method
    def start(self, key: str, callback: Callable[..., Any], *args: Any) -> bool:
        if key in self._jobs:
            return False
        self._cancelled.discard(key)
        self._jobs[key] = start_bus_task(
            self._run, key, callback, copy.deepcopy(args),
            thread_name=f"{self._name}-{key[:24]}Thread",
        )
        return True

    def _run(self, key: str, callback: Callable[..., Any], args: tuple) -> None:
        try:
            callback(*args)
        except Exception as error:
            ColorPrint.red(f"[BackgroundJobs] job={self._name}:{key} failed: {error}")
            raise
        finally:
            self._finish(key)

    @serialized_method
    def _finish(self, key: str) -> None:
        self._jobs.pop(key, None)
        self._cancelled.discard(key)

    @serialized_method
    def running(self, key: str) -> bool:
        return key in self._jobs

    @serialized_method
    def cancel(self, key: str) -> bool:
        if key not in self._jobs:
            return False
        self._cancelled.add(key)
        return True

    @serialized_method
    def cancelled(self, key: str) -> bool:
        return key in self._cancelled
