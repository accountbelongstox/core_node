#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Runner for the FastAPI RPC server.

Constructs a FastAPIRPCServer and runs uvicorn inside a background daemon
thread, with a logging filter that suppresses benign asyncio CancelledError
tracebacks during shutdown. Imports FastAPIRPCServer from fastapi_server only
(one-way); the runner is re-exported via server.__init__ / rpc_v2.__init__.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_uvicorn
from pycore.pyfoundations.serialized_worker import start_bus_task

from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer


uvicorn = get_third_package_uvicorn()


class SuppressCancelledErrorFilter(logging.Filter):
    """Filter to suppress asyncio.CancelledError logs during shutdown."""

    def filter(self, record):
        # Suppress CancelledError from starlette/uvicorn during shutdown
        if "CancelledError" in str(record.msg):
            return False
        if hasattr(record, "exc_info") and record.exc_info:
            exc_type = record.exc_info[0]
            if exc_type and exc_type.__name__ == "CancelledError":
                return False
        return True


class FastAPIRPCServerRunner:
    """Run FastAPIRPCServer inside a background thread."""

    def __init__(self, **server_options):
        self.server = FastAPIRPCServer(options=server_options)
        self._thread: Optional[Any] = None
        self._uvicorn_server: Optional[uvicorn.Server] = None
        self._start_signal = f"rpc.server.started.{id(self)}"

    def start(self):
        if self._thread and self._thread.is_alive():
            ColorPrint.yellow("[FastAPIRPCRunner] Server already running")
            return

        # Add filter to uvicorn's error logger to suppress CancelledError logs.
        uvicorn_error_logger = logging.getLogger("uvicorn.error")
        cancel_filter = SuppressCancelledErrorFilter()
        uvicorn_error_logger.addFilter(cancel_filter)

        THREAD_BUS.clear_signal(self._start_signal)
        config = uvicorn.Config(
            app=self.server.app,
            host=self.server.host,
            port=self.server.port,
            loop="asyncio",
            log_level="debug" if self.server.debug else "info",
            access_log=False,  # Disable access log to prevent WebSocket binary spam
        )
        self._uvicorn_server = uvicorn.Server(config=config)

        def runner():
            ColorPrint.green(
                f"[FastAPIRPCRunner] Starting FastAPI RPC server on {self.server.host}:{self.server.port}"
            )
            THREAD_BUS.signal(self._start_signal, True)
            try:
                self._uvicorn_server.run()
            except Exception:
                # Suppress expected errors during shutdown (CancelledError, etc.)
                pass

        self._thread = start_bus_task(
            runner,
            thread_name="FastAPIRPCServerThread",
        )
        THREAD_BUS.wait_signal(self._start_signal, timeout=5)

    def stop(self):
        if not self._uvicorn_server:
            return
        self._uvicorn_server.should_exit = True
        if self._thread:
            self._thread.join(timeout=5)
        ColorPrint.blue("[FastAPIRPCRunner] Server stopped")

    # Compatibility helpers -------------------------------------------------
    def route(self, name: str, handler: Callable):
        """Register RPC route (proxy to underlying server)."""
        self.server.route(name, handler)

    def add_static_dir(self, url_prefix: str, directory: str):
        """Expose static directory on the FastAPI app."""
        self.server.add_static_dir(url_prefix, directory)

    @property
    def host(self) -> str:
        return self.server.host

    @property
    def port(self) -> int:
        return self.server.port

    @property
    def app(self) -> Any:
        return self.server.app


__all__ = ["FastAPIRPCServerRunner", "SuppressCancelledErrorFilter"]
