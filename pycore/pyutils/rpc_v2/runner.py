# -*- coding: utf-8 -*-
"""Background uvicorn lifecycle for HttpServer."""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_uvicorn
from pycore.pyutils.rpc_v2.server import HttpServer


uvicorn = get_third_package_uvicorn()


class _CancelledErrorFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if "CancelledError" in str(record.msg):
            return False
        exc_info = getattr(record, "exc_info", None)
        exc_type = exc_info[0] if exc_info else None
        return not (exc_type and exc_type.__name__ == "CancelledError")


class HttpServerRunner:
    """Run one HttpServer in a THREAD_BUS-owned background task."""

    def __init__(self, **server_options: Any) -> None:
        self.server = HttpServer(options=server_options)
        self._thread: Optional[Any] = None
        self._uvicorn_server: Optional[Any] = None
        self._cancel_filter = _CancelledErrorFilter()
        self._start_signal = f"rpc.server.started.{id(self)}"

        @self.server.app.on_event("startup")
        async def mark_started() -> None:
            THREAD_BUS.signal(self._start_signal, True)

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            ColorPrint.yellow("[HttpServerRunner] Server already running")
            return
        logging.getLogger("uvicorn.error").addFilter(self._cancel_filter)
        THREAD_BUS.clear_signal(self._start_signal)
        config = uvicorn.Config(
            app=self.server.app,
            host=self.server.host,
            port=self.server.port,
            loop="asyncio",
            log_level="debug" if self.server.debug else "info",
            access_log=False,
            timeout_keep_alive=self.server.http_keep_alive_timeout,
        )
        self._uvicorn_server = uvicorn.Server(config=config)
        self._thread = start_bus_task(
            self._uvicorn_server.run,
            thread_name="HttpServerThread",
        )
        THREAD_BUS.wait_signal(self._start_signal, timeout=5)

    def stop(self) -> None:
        if self._uvicorn_server is None:
            return
        self._uvicorn_server.should_exit = True
        if self._thread is not None:
            self._thread.join(timeout=5)
        logging.getLogger("uvicorn.error").removeFilter(self._cancel_filter)
        ColorPrint.blue("[HttpServerRunner] Server stopped")

    def get(self, name: str, handler: Callable, **options: Any) -> Any:
        return self.server.get(name, handler, **options)

    def post(self, name: str, handler: Callable, **options: Any) -> Any:
        return self.server.post(name, handler, **options)

    def register_routes(
        self,
        routes: Any,
        group: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> Any:
        return self.server.register_routes(routes, group=group, timeout=timeout)

    def add_static_dir(self, url_prefix: str, directory: str) -> None:
        self.server.add_static_dir(url_prefix, directory)

    def get_status(self) -> dict[str, Any]:
        return {
            "host": self.host,
            "port": self.port,
            "running": bool(self._thread and self._thread.is_alive()),
            "routes": len(self.server.list_routes()),
        }

    @property
    def host(self) -> str:
        return self.server.host

    @property
    def port(self) -> int:
        return self.server.port

    @property
    def app(self) -> Any:
        return self.server.app


__all__ = ["HttpServerRunner"]
