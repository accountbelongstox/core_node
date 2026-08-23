# -*- coding: utf-8 -*-
"""Central HTTP API and replayable SSE server."""

from __future__ import annotations

import asyncio
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple, Union

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
from pycore.pyfoundations.network_constants import (
    HTTP_API_PREFIX,
    HTTP_BIND_HOST,
    HTTP_CLIENT_ID_PATH,
    HTTP_EVENTS_PATH,
    HTTP_EXPECTED_DISCONNECT_ERRNOS,
    HTTP_EXPECTED_DISCONNECT_MESSAGES,
    HTTP_EXPECTED_DISCONNECT_WINERRORS,
    HTTP_INFO_PATH,
    HTTP_PROTOCOL_VERSION,
    HTTP_ROUTES_PATH,
    HTTP_STATUS_PATH,
    PYCORE_HTTP_PORT,
)
from pycore.pyutils.rpc_v2.delivery import http_event_delivery_service
from pycore.pyutils.rpc_v2.dispatcher import HttpRoute
from pycore.pyutils.rpc_v2.execution import rpc_execution_kernel
from pycore.pyutils.rpc_v2.http.event_service import HttpEventService


fastapi = get_third_package_fastapi()
FastAPI = fastapi.FastAPI
Request = fastapi.Request
Response = fastapi.Response
CORSMiddleware = fastapi.CORSMiddleware
StaticFiles = fastapi.StaticFiles
RouteRegistration = Union[
    Tuple[str, Callable],
    Tuple[str, Callable, Optional[str]],
]


class _HttpProtocolMiddleware:
    STARTED_AT_SCOPE_KEY = "pycore.http.started_at"
    RESPONSE_LOGGED_SCOPE_KEY = "pycore.http.response_logged"

    def __init__(self, app: Any) -> None:
        self.app = app

    @classmethod
    def log_response(cls, scope: Dict[str, Any], status_code: int) -> None:
        if scope.get(cls.RESPONSE_LOGGED_SCOPE_KEY):
            return
        method = str(scope.get("method") or "HTTP").upper()
        route = str(scope.get("path") or "/")
        started_at = float(scope.get(cls.STARTED_AT_SCOPE_KEY) or time.perf_counter())
        duration_ms = (time.perf_counter() - started_at) * 1000
        ColorPrint.gray(
            f"[HttpServer] {method} {route} -> {status_code} "
            f"({duration_ms:.1f} ms)"
        )
        scope[cls.RESPONSE_LOGGED_SCOPE_KEY] = True

    async def __call__(self, scope: Dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        method = str(scope.get("method") or "HTTP").upper()
        route = str(scope.get("path") or "/")
        started_at = time.perf_counter()
        scope[self.STARTED_AT_SCOPE_KEY] = started_at
        scope[self.RESPONSE_LOGGED_SCOPE_KEY] = False
        ColorPrint.green(f"[HttpServer] Received {method} {route}")

        async def send_with_protocol(message: Dict[str, Any]) -> None:
            if message.get("type") == "http.response.start":
                headers = list(message.get("headers") or [])
                headers.append((b"access-control-allow-private-network", b"true"))
                message["headers"] = headers
                self.log_response(scope, int(message.get("status") or 0))
            await send(message)

        await self.app(scope, receive, send_with_protocol)


class HttpServer:
    """Compose HTTP routes and bounded replayable SSE events."""

    def __init__(self, options: Optional[Dict[str, Any]] = None) -> None:
        server_options = options or {}
        self.host = str(server_options.get("host", HTTP_BIND_HOST))
        self.port = int(server_options.get("port", PYCORE_HTTP_PORT))
        self.debug = bool(server_options.get("debug", False))
        self.allow_origins = list(server_options.get("allow_origins", ["*"]))
        self.http_events_enabled = bool(server_options.get("enable_http_events", True))
        self.http_keep_alive_timeout = max(
            1.0,
            float(server_options.get("http_keep_alive_timeout", 120.0)),
        )
        self.stream_logs = bool(server_options.get("stream_logs", True))
        self.binding_id = f"http-server-{id(self)}"
        self.app = FastAPI(
            title="Pycore HTTP Server",
            version=HTTP_PROTOCOL_VERSION,
            docs_url=None,
            redoc_url=None,
        )
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=self.allow_origins,
            allow_methods=["*"],
            allow_headers=["*"],
            allow_credentials=True,
        )
        self.app.add_middleware(_HttpProtocolMiddleware)
        self.dispatcher = rpc_execution_kernel.dispatcher
        self.event_service = (
            HttpEventService(
                self.app,
                fastapi_module=fastapi,
                event_path=HTTP_EVENTS_PATH,
            )
            if self.http_events_enabled
            else None
        )
        self._static_mounts: Dict[str, str] = {}
        self._thread_bus_listeners: Dict[str, Callable] = {}
        self._previous_loop_exception_handler: Optional[Callable] = None
        self._started = False
        self._register_lifecycle()
        self._register_exception_handler()
        self._register_protocol_routes()
        self._register_http_routes()
        self._register_fastapi_routers(server_options.get("fastapi_routers", ()))
        self._register_static_mounts(server_options.get("static_mounts", ()))

    def _register_lifecycle(self) -> None:
        @self.app.on_event("startup")
        async def start_delivery() -> None:
            event_loop = asyncio.get_running_loop()
            self._previous_loop_exception_handler = event_loop.get_exception_handler()
            event_loop.set_exception_handler(self._handle_loop_exception)
            self._started = True
            if self.event_service is not None:
                http_event_delivery_service.bind(
                    self.binding_id,
                    asyncio.get_running_loop(),
                    self.event_service.publish_event,
                )
            for event_name, handler in tuple(self._thread_bus_listeners.items()):
                THREAD_BUS.register_event_handler(event_name, handler)
            if (
                self.event_service is not None
                and self.stream_logs
                and http_event_delivery_service.enable_log_stream(self.binding_id)
            ):
                ColorPrint.register_callback(http_event_delivery_service.publish_log)

        @self.app.on_event("shutdown")
        async def stop_delivery() -> None:
            event_loop = asyncio.get_running_loop()
            event_loop.set_exception_handler(self._previous_loop_exception_handler)
            http_event_delivery_service.unbind(self.binding_id)
            for event_name, handler in tuple(self._thread_bus_listeners.items()):
                THREAD_BUS.unregister_event_handler(event_name, handler)
            self._started = False
            if (
                self.event_service is not None
                and self.stream_logs
                and http_event_delivery_service.disable_log_stream(self.binding_id)
            ):
                ColorPrint.unregister_callback(http_event_delivery_service.publish_log)

    def _handle_loop_exception(
        self,
        event_loop: asyncio.AbstractEventLoop,
        context: Dict[str, Any],
    ) -> None:
        exception = context.get("exception")
        message = str(context.get("message") or "")
        errno = getattr(exception, "errno", None)
        winerror = getattr(exception, "winerror", None)
        connection_error = isinstance(
            exception,
            (BrokenPipeError, ConnectionAbortedError, ConnectionResetError),
        ) or (
            isinstance(exception, OSError)
            and (
                errno in HTTP_EXPECTED_DISCONNECT_ERRNOS
                or winerror in HTTP_EXPECTED_DISCONNECT_WINERRORS
            )
        )
        expected_disconnect = (
            message in HTTP_EXPECTED_DISCONNECT_MESSAGES
            and (exception is None or connection_error)
        ) or (
            connection_error
            and "ProactorBasePipeTransport._call_connection_lost" in message
        )
        if expected_disconnect:
            return
        if self._previous_loop_exception_handler is not None:
            self._previous_loop_exception_handler(event_loop, context)
            return
        event_loop.default_exception_handler(context)

    def _register_exception_handler(self) -> None:
        @self.app.exception_handler(Exception)
        async def http_error(request: Request, exc: Exception) -> Any:
            request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
            ColorPrint.red(
                f"[HttpServer] {request.method} {request.url.path} failed: {exc}"
            )
            _HttpProtocolMiddleware.log_response(request.scope, 500)
            return self._error_response(
                request_id,
                request.url.path,
                "internal_error",
                str(exc),
                500,
            )

    def _register_protocol_routes(self) -> None:
        @self.app.post(HTTP_CLIENT_ID_PATH)
        async def client_id(request: Request) -> Dict[str, Any]:
            payload = await request.json()
            browser_id = str(payload.get("browser_id") or "").strip()
            allocation_key = browser_id
            journal = self.event_service.events if self.event_service is not None else None
            assigned_id = (
                journal.allocate_client_id(allocation_key)
                if journal is not None
                else f"pycore-{uuid.uuid4().hex}"
            )
            return {
                "success": True,
                "client_id": assigned_id,
                "instance_id": journal.instance_id if journal is not None else None,
            }

        @self.app.get(HTTP_STATUS_PATH)
        async def status() -> Dict[str, Any]:
            return {
                "is_http_service": True,
                "protocol_version": HTTP_PROTOCOL_VERSION,
                "service": "HttpServer",
                "transport": "http",
            }

        @self.app.get(HTTP_INFO_PATH)
        async def info() -> Dict[str, Any]:
            journal = self.event_service.events if self.event_service is not None else None
            return {
                "service": "HttpServer",
                "protocol_version": HTTP_PROTOCOL_VERSION,
                "host": self.host,
                "port": self.port,
                "transports": {
                    "http": True,
                },
                "routes": self.list_routes(),
                "events": {
                    "enabled": journal is not None,
                    "instance_id": journal.instance_id if journal is not None else None,
                    "seq": journal.seq if journal is not None else 0,
                },
            }

        @self.app.get(HTTP_ROUTES_PATH)
        async def routes() -> Dict[str, Any]:
            return {"routes": self.list_routes()}

    def _register_http_routes(self) -> None:
        @self.app.api_route(
            f"{HTTP_API_PREFIX}/{{route_path:path}}",
            methods=["GET", "POST"],
        )
        async def dispatch_route(route_path: str, request: Request) -> Any:
            route = self.dispatcher.get(route_path)
            request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
            method = str(request.method or "").upper()
            if route is None:
                return self._error_response(
                    request_id,
                    route_path,
                    "route_not_found",
                    f"HTTP route not found: {route_path}",
                    404,
                )
            if method not in route.methods:
                return self._error_response(
                    request_id,
                    route.path,
                    "method_not_allowed",
                    f"{method} is not allowed for {route.path}",
                    405,
                )
            query = self._read_query_params(request)
            body = (
                await request.body()
                if method != "GET"
                else b""
            )
            params = rpc_execution_kernel.decode_request_params(
                method,
                query,
                body,
                str(request.headers.get("Content-Type") or ""),
            )
            context = self._build_http_context(request, request_id)
            result = await rpc_execution_kernel.dispatch(
                route,
                params,
                request_id,
                context,
            )
            encoded = rpc_execution_kernel.encode_result(result, request_id)
            return Response(
                content=encoded.body,
                status_code=encoded.status_code,
                headers=encoded.headers,
            )

    def _register_route(
        self,
        path: str,
        handler: Callable,
        description: Optional[str] = None,
        timeout: Optional[float] = None,
        methods: Iterable[str] = ("POST",),
    ) -> HttpRoute:
        route = self.dispatcher.register(
            path,
            handler,
            methods=methods,
            description=description,
            timeout=timeout,
        )
        if self.debug:
            ColorPrint.blue(f"[HttpServer] Registered HTTP route: {route.path}")
        return route

    def register_routes(
        self,
        routes: Iterable[RouteRegistration],
        group: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> List[HttpRoute]:
        """Register an HTTP route group without duplicating registration loops."""
        registered = []
        for registration in routes:
            path = registration[0]
            handler = registration[1]
            description = registration[2] if len(registration) > 2 else None
            registered.append(
                self.post(
                    path=path,
                    handler=handler,
                    description=description,
                    timeout=timeout,
                )
            )
        if self.debug and group:
            ColorPrint.blue(
                f"[HttpServer] Registered HTTP route group: {group}"
            )
        return registered

    def get(
        self,
        path: str,
        handler: Callable,
        description: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> HttpRoute:
        return self._register_route(
            path,
            handler,
            description=description,
            timeout=timeout,
            methods=("GET",),
        )

    def post(
        self,
        path: str,
        handler: Callable,
        description: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> HttpRoute:
        return self._register_route(
            path,
            handler,
            description=description,
            timeout=timeout,
            methods=("POST",),
        )

    def list_routes(self) -> list[Dict[str, Any]]:
        return self.dispatcher.list_routes(HTTP_API_PREFIX)

    def add_static_dir(self, url_prefix: str, directory: str) -> None:
        path = Path(directory)
        if not path.exists():
            ColorPrint.yellow(f"[HttpServer] Static directory does not exist: {directory}")
            return
        mount_path = url_prefix if url_prefix.startswith("/") else f"/{url_prefix}"
        mount_name = mount_path.strip("/").replace("/", "_") or "root"
        self._static_mounts[mount_path] = str(path)
        self.app.mount(
            mount_path,
            StaticFiles(directory=str(path), html=True),
            name=mount_name,
        )

    async def broadcast_event(
        self,
        event_name: str,
        data: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        if self.event_service is None:
            return None
        return await self.event_service.publish_event(event_name, dict(data or {}))

    def broadcast_event_sync(self, event_name: str, data: Dict[str, Any]) -> None:
        http_event_delivery_service.publish_topic(event_name, dict(data or {}))

    def register_thread_bus_listener(self, event_name: str) -> None:
        normalized_name = str(event_name or "").strip()
        if not normalized_name:
            raise ValueError("Thread bus event name is required")

        def publish_event(event_data: Any) -> None:
            payload = (
                dict(event_data or {})
                if isinstance(event_data, dict)
                else {"value": event_data}
            )
            http_event_delivery_service.publish_topic(normalized_name, payload)

        previous = self._thread_bus_listeners.get(normalized_name)
        if previous is not None and self._started:
            THREAD_BUS.unregister_event_handler(normalized_name, previous)
        self._thread_bus_listeners[normalized_name] = publish_event
        if self._started:
            THREAD_BUS.register_event_handler(normalized_name, publish_event)

    def _register_fastapi_routers(self, routers: Iterable[Any]) -> None:
        for router in routers:
            self.app.include_router(router)

    def _register_static_mounts(self, mounts: Iterable[Dict[str, Any]]) -> None:
        for mount in mounts:
            url_prefix = mount.get("url_prefix")
            directory = mount.get("directory")
            if url_prefix and directory:
                self.add_static_dir(str(url_prefix), str(directory))

    @staticmethod
    def _read_query_params(request: Any) -> Dict[str, Any]:
        params: Dict[str, Any] = {}
        for key, value in request.query_params.multi_items():
            current = params.get(key)
            if current is None:
                params[key] = value
            elif isinstance(current, list):
                current.append(value)
            else:
                params[key] = [current, value]
        return params

    @staticmethod
    def _build_http_context(request: Any, request_id: str) -> Dict[str, Any]:
        client = getattr(request, "client", None)
        return {
            "transport": "http",
            "request_id": request_id,
            "client_id": request.headers.get("X-Pycore-Client-ID") or "",
            "browser_id": request.headers.get("X-Pycore-Browser-ID") or "",
            "remote_addr": getattr(client, "host", None),
            "user_agent": request.headers.get("User-Agent"),
            "method": request.method,
            "path": request.url.path,
            "path_params": dict(request.path_params),
            "headers": dict(request.headers),
            "request": request,
        }

    @staticmethod
    def _error_response(
        request_id: str,
        route_path: str,
        code: str,
        message: str,
        status_code: int,
    ) -> Any:
        response = fastapi.responses.JSONResponse(
            {
                "success": False,
                "error": {"code": code, "message": message},
                "route": route_path,
                "request_id": request_id,
            },
            status_code=status_code,
        )
        response.headers["X-Request-ID"] = request_id
        return response




__all__ = ["HttpServer"]
