# -*- coding: utf-8 -*-
"""HTTP request log lines written off the event loop.

The loop posts one THREAD_BUS message per line and never waits; a writer
thread formats and prints each burst, so a slow console cannot stall requests.
"""

from __future__ import annotations

import traceback
import uuid
from typing import Any, List

from pycore.pyfoundations.batch_owner_thread import BatchOwnerThread
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

HTTP_ACCESS_LOG_QUEUE = "pyutils.rpc.http.access_log"
HTTP_ACCESS_LOG_THREAD = "HttpAccessLogThread"
HTTP_ACCESS_LOG_BATCH_MAX = 256

_RECEIVED = "received"
_COMPLETED = "completed"


class HttpAccessLog:
    def __init__(self) -> None:
        self._writer = BatchOwnerThread(
            f"{HTTP_ACCESS_LOG_QUEUE}.{uuid.uuid4().hex}",
            HTTP_ACCESS_LOG_THREAD,
            self._write,
            self._report_failure,
            HTTP_ACCESS_LOG_BATCH_MAX,
        )
        self._writer.start()

    def received(self, method: str, route: str) -> None:
        self._writer.post((_RECEIVED, method, route))

    def completed(self, method: str, route: str, status_code: int, duration_ms: float) -> None:
        self._writer.post((_COMPLETED, method, route, status_code, duration_ms))

    @staticmethod
    def _write(batch: List[Any]) -> None:
        for message in batch:
            if message[0] == _RECEIVED:
                ColorPrint.green(f"[HttpServer] Received {message[1]} {message[2]}")
            else:
                ColorPrint.gray(f"[HttpServer] {message[1]} {message[2]} -> {message[3]} ({message[4]:.1f} ms)")

    @staticmethod
    def _report_failure(exc: BaseException) -> None:
        trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)).rstrip()
        ColorPrint.red(f"[HttpServer] access log batch failed: {exc!r}\n{trace}")


http_access_log = HttpAccessLog()


__all__ = ["http_access_log"]
