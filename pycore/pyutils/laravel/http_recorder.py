# -*- coding: utf-8 -*-
"""Observer registry for every pycore-to-Laravel HTTP request record.

``laravel_client`` and the endpoint health probe notify it; rpc registers the
callback that publishes each record as a ``laravel_http`` event to the
dashboard HTTP debugger. Depends only on ``pyfoundations`` so the client and
the endpoint manager both import it without a cycle.
"""
import time
from typing import Any, Callable, Dict, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method

RecordCallback = Callable[[Dict[str, Any]], None]


class LaravelHttpRecorder:
    """Fans Laravel HTTP records out to registered callbacks on one owner thread."""

    def __init__(self) -> None:
        self._callbacks: List[RecordCallback] = []
        init_serialized_owner(self, "laravel_http_recorder.state", "LaravelHttpRecorderState")

    @serialized_method
    def register_callback(self, callback: RecordCallback) -> None:
        if callback not in self._callbacks:
            self._callbacks.append(callback)

    @serialized_method
    def notify(self, record: Dict[str, Any]) -> None:
        stored = dict(record)
        stored.setdefault("ts", time.time())
        for callback in list(self._callbacks):
            try:
                callback(dict(stored))
            except Exception as exc:  # noqa: BLE001 - listener boundary; the request path must go on
                ColorPrint.yellow(
                    f"[laravel] HTTP record listener {getattr(callback, '__qualname__', callback)!r} "
                    f"failed for {stored.get('method')} {stored.get('path')}: {type(exc).__name__}: {exc}"
                )


laravel_http_recorder = LaravelHttpRecorder()
