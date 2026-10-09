# -*- coding: utf-8 -*-
"""Background uvicorn lifecycle for HttpServer."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Callable, Optional

from pycore.pyfoundations.network_constants import (
    WS_MAX_FRAME_BYTES,
    WS_PING_INTERVAL_SECONDS,
    WS_PING_TIMEOUT_SECONDS,
    WS_PROTOCOL_IMPLEMENTATION,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_uvicorn
from pycore.pyutils.common.port_utils import retire_older_port_owners
from pycore.pyutils.rpc.server import HttpServer


uvicorn = get_third_package_uvicorn()

HTTP_START_ATTEMPTS = 2
HTTP_START_WAIT_SECONDS = 15.0
HTTP_START_POLL_SECONDS = 0.1
STALE_PORT_OWNER_GRACE_SECONDS = 5.0


def http_event_loop() -> asyncio.AbstractEventLoop:
    """Selector loop on every platform: the Windows proactor closes the
    listening socket for good when one AcceptEx fails (e.g. WinError 64, a
    client reset mid-accept), while the selector accept path logs and keeps
    listening."""
    return asyncio.SelectorEventLoop()


HTTP_EVENT_LOOP_FACTORY = f"{__name__}:{http_event_loop.__name__}"


class _CancelledErrorFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if "CancelledError" in str(record.msg):
            return False
        exc_info = getattr(record, "exc_info", None)
        exc_type = exc_info[0] if exc_info else None
        return not (exc_type and exc_type.__name__ == "CancelledError")


class HttpServerRunner:
    """Run one HttpServer in a THREAD_BUS-owned background task."""

    def __init__(self, listen: bool = True, **server_options: Any) -> None:
        self.listen = bool(listen)
        self.server = HttpServer(options=server_options)
        self._thread: Optional[Any] = None
        self._uvicorn_server: Optional[Any] = None
        self._cancel_filter = _CancelledErrorFilter()

    def start(self) -> None:
        if not self.listen:
            ColorPrint.blue("[HttpServerRunner] Local HTTP listener disabled; routes serve in-process only")
            return
        if self._thread and self._thread.is_alive():
            ColorPrint.yellow("[HttpServerRunner] Server already running")
            return
        logging.getLogger("uvicorn.error").addFilter(self._cancel_filter)
        for attempt in range(1, HTTP_START_ATTEMPTS + 1):
            retire_older_port_owners(self.server.port, STALE_PORT_OWNER_GRACE_SECONDS)
            if self._serve():
                return
            ColorPrint.yellow(
                f"[HttpServerRunner] Listening on port {self.server.port} failed "
                f"(attempt {attempt}/{HTTP_START_ATTEMPTS})"
            )
        ColorPrint.red(
            f"[HttpServerRunner] Port {self.server.port} unavailable; "
            "shutting down instead of running without the RPC listener"
        )
        THREAD_BUS.request_shutdown(
            reason=f"RPC port {self.server.port} unavailable",
            execute_handlers=True,
        )

    def _serve(self) -> bool:
        """Start uvicorn; True once it listens (or is still starting at the deadline).
        uvicorn runs lifespan startup before binding, so only ``started`` proves the bind."""
        config = uvicorn.Config(
            app=self.server.app,
            host=self.server.host,
            port=self.server.port,
            loop=HTTP_EVENT_LOOP_FACTORY,
            log_level="debug" if self.server.debug else "info",
            access_log=False,
            timeout_keep_alive=self.server.http_keep_alive_timeout,
            ws=WS_PROTOCOL_IMPLEMENTATION,
            ws_max_size=WS_MAX_FRAME_BYTES,
            ws_ping_interval=WS_PING_INTERVAL_SECONDS,
            ws_ping_timeout=WS_PING_TIMEOUT_SECONDS,
            ws_per_message_deflate=True,
        )
        self._uvicorn_server = uvicorn.Server(config=config)
        self._thread = start_bus_task(
            self._uvicorn_server.run,
            thread_name="HttpServerThread",
        )
        deadline = time.monotonic() + HTTP_START_WAIT_SECONDS
        while time.monotonic() < deadline:
            if self._uvicorn_server.started:
                return True
            if not self._thread.is_alive():
                return False
            time.sleep(HTTP_START_POLL_SECONDS)
        return self._thread.is_alive()

    def stop(self) -> None:
        if self._uvicorn_server is None:
            return
        self._uvicorn_server.should_exit = True
        if self._thread is not None:
            self._thread.join(timeout=5)
        logging.getLogger("uvicorn.error").removeFilter(self._cancel_filter)
        ColorPrint.blue("[HttpServerRunner] Server stopped")

    def get(self, path: str, handler: Callable, **options: Any) -> Any:
        return self.server.get(path, handler, **options)

    def post(self, path: str, handler: Callable, **options: Any) -> Any:
        return self.server.post(path, handler, **options)

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
            "listening": self.listen,
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


__all__ = ["HTTP_EVENT_LOOP_FACTORY", "HttpServerRunner", "http_event_loop"]
