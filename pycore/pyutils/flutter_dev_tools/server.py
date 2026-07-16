#!/usr/bin/env python3
"""
Flutter Design Docs Dev Tools served via rpc_v2.

This module reuses the existing flutter_dev_tools implementation under
poly_apps/flutter_bloom/scripts/flutter_dev_tools and exposes its HTTP
API and static UI through the shared FastAPI RPC server.
"""

from __future__ import annotations

import io
import json
import threading
import time
from http import HTTPStatus
from pathlib import Path
from typing import Dict, Optional

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_fastapi
from pycore.pyutils.rpc_v2.server.server_runner import FastAPIRPCServerRunner

fastapi = get_third_package_fastapi()
Request = fastapi.Request
Response = fastapi.responses.Response

PACKAGE_ROOT = Path(__file__).resolve().parent
STATIC_DIR = PACKAGE_ROOT / "static"

from pycore.pyutils.flutter_dev_tools.api import app_checker
from pycore.pyutils.flutter_dev_tools.utils import (
    design_structure_auto_expand,
    path_utils,
    port_manager,
)
from pycore.pyutils.flutter_dev_tools.config import get_app_config
from pycore.pyutils.flutter_dev_tools.routes.router import Router


class FastAPIRequestAdapter:
    """
    Minimal adapter that emulates BaseHTTPRequestHandler for legacy route handlers.
    """

    def __init__(self, request: Request, body: bytes):
        self.headers = request.headers
        path = request.url.path
        if request.url.query:
            path = f"{path}?{request.url.query}"
        self.path = path
        self.rfile = io.BytesIO(body)

        class _Writer:
            def __init__(self):
                self.buffer = io.BytesIO()

            def write(self, data: bytes) -> None:
                self.buffer.write(data)

        self.wfile = _Writer()
        self._status = HTTPStatus.OK
        self._response_headers: Dict[str, str] = {}

    def send_response(self, status_code: int | HTTPStatus) -> None:
        if isinstance(status_code, HTTPStatus):
            self._status = status_code
        else:
            self._status = HTTPStatus(status_code)

    def send_header(self, key: str, value: str) -> None:
        self._response_headers[key] = value

    def end_headers(self) -> None:
        return

    def send_error(self, code: int, message: str = "") -> None:
        self.send_response(code)
        payload = json.dumps({
            "success": False,
            "error": message or HTTPStatus(code).phrase,
        }).encode("utf-8")
        self.wfile.write(payload)
        self._response_headers["Content-Type"] = "application/json; charset=utf-8"

    def make_response(self) -> Response:
        status_code = int(self._status)
        headers = dict(self._response_headers)
        # Default content-type for plain JSON if not already set
        headers.setdefault("Content-Type", "application/json; charset=utf-8")
        return Response(content=self.wfile.buffer.getvalue(), status_code=status_code, headers=headers)


class FlutterDevToolsServer:
    """
    rpc_v2 hosted wrapper around the legacy flutter_dev_tools app.
    """

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        debug: bool = False,
    ):
        self.app_config = get_app_config()
        self.host = host or self.app_config.get("server.host", "127.0.0.1")
        self.port = port or int(self.app_config.get("server.port", 5757))
        self.debug = debug
        self.color_print = ColorPrint()
        self.runner = FastAPIRPCServerRunner(host=self.host, port=self.port, debug=self.debug)
        self.shutdown_event = threading.Event()
        self.router: Optional[Router] = None
        self._setup_environment()
        self._mount_static()
        self._register_routes()

    # ------------------------------------------------------------------ lifecycle
    def start(self) -> None:
        """
        Start the FastAPI RPC server in the background.
        """
        self.runner.start()

    def stop(self) -> None:
        """
        Stop the FastAPI RPC server.
        """
        self.shutdown_event.set()
        self.runner.stop()

    # ------------------------------------------------------------------ setup helpers
    def _setup_environment(self) -> None:
        """
        Align the filesystem layout with the expectations of the legacy tool.
        """
        auto_kill = bool(self.app_config.get("server.auto_kill_old_instances", True))
        cleaned = port_manager.cleanup_old_server(self.port, auto_kill=auto_kill)
        if not cleaned:
            self.color_print.print_red(f"[FlutterDevTools] Port {self.port} could not be cleaned up automatically")

        wait_timeout = int(self.app_config.get("server.startup_wait_timeout", 3))
        port_manager.wait_for_port_release(self.port, timeout=wait_timeout)

        if bool(self.app_config.get("features.auto_expand_structure", True)):
            expand_results = design_structure_auto_expand.ensure_all_apps_design_structure()
            expanded_count = sum(1 for success in expand_results.values() if success)
            self.color_print.print_blue(f"[FlutterDevTools] Auto-expanded design docs for {expanded_count} apps")

        apps_dir = path_utils.get_apps_dir()
        if bool(self.app_config.get("features.auto_initialize_apps", True)):
            app_checker.auto_initialize_all_apps(apps_dir)

    def _mount_static(self) -> None:
        """
        Ensure static assets directory exists.
        """
        if not STATIC_DIR.exists():
            self.color_print.print_yellow("[FlutterDevTools] Static directory missing; UI will not be served")

    # ------------------------------------------------------------------ route registration
    def _register_routes(self) -> None:
        """
        Wire HTTP routes on the FastAPI app to mirror the legacy server.
        """
        app = self.runner.app
        self.router = Router(STATIC_DIR, self.shutdown_event)

        @app.api_route("/", methods=["GET", "POST"])
        async def root(request: Request) -> Response:
            return await self._route_http(request)

        @app.api_route("/{full_path:path}", methods=["GET", "POST"])
        async def handle_any(full_path: str, request: Request) -> Response:
            return await self._route_http(request)

    # ------------------------------------------------------------------ helpers
    async def _route_http(self, request: Request) -> Response:
        """
        Route HTTP requests through the legacy router layer.
        """
        if not self.router:
            return Response(
                content=b'{"success": false, "error": "Router not initialized"}',
                media_type="application/json",
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            )

        body = await request.body()
        adapter = FastAPIRequestAdapter(request, body)
        try:
            self.router.dispatch(adapter, request.method.upper())
        except Exception as exc:  # pragma: no cover - defensive
            self.color_print.print_red(f"[FlutterDevTools] Router error: {exc}")
            return Response(
                content=b'{"success": false, "error": "Internal server error"}',
                media_type="application/json",
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            )
        return adapter.make_response()

    def _delayed_stop(self) -> None:
        """
        Give the API time to respond before stopping uvicorn.
        """
        time.sleep(0.5)
        self.stop()


def create_flutter_dev_tools_server(
    host: str | None = None,
    port: int | None = None,
    debug: bool = False,
) -> FlutterDevToolsServer:
    """
    Factory helper for convenience imports.
    """
    return FlutterDevToolsServer(host=host, port=port, debug=debug)


__all__ = ["FlutterDevToolsServer", "create_flutter_dev_tools_server"]
