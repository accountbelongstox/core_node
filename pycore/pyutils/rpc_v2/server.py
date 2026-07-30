# -*- coding: utf-8 -*-
"""HTTP-only RPC v2 controller and replayable event server."""

from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple, Union

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import await_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_fastapi
from pycore.pyfoundations.pygvar import (
    HTTP_BIND_HOST,
    PYCORE_HTTP_PORT,
    RPC_CONTROLLER_PREFIX,
    RPC_CONTROLLERS_PATH,
    RPC_EVENTS_PATH,
    RPC_INFO_PATH,
    RPC_PROTOCOL_VERSION,
    RPC_ROUTES_PATH,
    RPC_STATUS_PATH,
)
from pycore.pyutils.rpc_v2.delivery import rpc_delivery_service
from pycore.pyutils.rpc_v2.dispatcher import RpcDispatcher, RpcRoute
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


class _PrivateNetworkAccessMiddleware:
    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: Dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_header(message: Dict[str, Any]) -> None:
            if message.get("type") == "http.response.start":
                headers = list(message.get("headers") or [])
                headers.append((b"access-control-allow-private-network", b"true"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_header)


class RpcServer:
    """Compose HTTP controllers and bounded replayable events."""

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
        self.binding_id = f"rpc-server-{id(self)}"
        self.app = FastAPI(
            title="Pycore RPC Server",
            version=RPC_PROTOCOL_VERSION,
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
        self.app.add_middleware(_PrivateNetworkAccessMiddleware)
        self.dispatcher = RpcDispatcher(sync_invoker=self._invoke_sync_handler)
        self.event_service = (
            HttpEventService(
                self.app,
                fastapi_module=fastapi,
                event_path=RPC_EVENTS_PATH,
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
        self._register_http_controller_routes()
        self._register_fastapi_routers(server_options.get("fastapi_routers", ()))
        self._register_static_mounts(server_options.get("static_mounts", ()))

    @staticmethod
    async def _invoke_sync_handler(handler: Callable, arguments: tuple) -> Any:
        return await await_bus_task(
            handler,
            *arguments,
            thread_name="RpcControllerThread",
        )

    def _register_lifecycle(self) -> None:
        @self.app.on_event("startup")
        async def start_delivery() -> None:
            event_loop = asyncio.get_running_loop()
            self._previous_loop_exception_handler = event_loop.get_exception_handler()
            event_loop.set_exception_handler(self._handle_loop_exception)
            self._started = True
            if self.event_service is not None:
                rpc_delivery_service.bind(
                    self.binding_id,
                    asyncio.get_running_loop(),
                    self.event_service.publish_event,
                )
            for event_name, handler in tuple(self._thread_bus_listeners.items()):
                THREAD_BUS.register_event_handler(event_name, handler)
            if (
                self.event_service is not None
                and self.stream_logs
                and rpc_delivery_service.enable_log_stream(self.binding_id)
            ):
                ColorPrint.register_callback(rpc_delivery_service.publish_log)

        @self.app.on_event("shutdown")
        async def stop_delivery() -> None:
            event_loop = asyncio.get_running_loop()
            event_loop.set_exception_handler(self._previous_loop_exception_handler)
            rpc_delivery_service.unbind(self.binding_id)
            for event_name, handler in tuple(self._thread_bus_listeners.items()):
                THREAD_BUS.unregister_event_handler(event_name, handler)
            self._started = False
            if (
                self.event_service is not None
                and self.stream_logs
                and rpc_delivery_service.disable_log_stream(self.binding_id)
            ):
                ColorPrint.unregister_callback(rpc_delivery_service.publish_log)

    def _handle_loop_exception(
        self,
        event_loop: asyncio.AbstractEventLoop,
        context: Dict[str, Any],
    ) -> None:
        exception = context.get("exception")
        message = str(context.get("message") or "")
        winerror = getattr(exception, "winerror", None)
        expected_reset = (
            isinstance(exception, ConnectionResetError)
            and winerror == 10054
            and "ProactorBasePipeTransport._call_connection_lost" in message
        )
        if expected_reset:
            return
        if self._previous_loop_exception_handler is not None:
            self._previous_loop_exception_handler(event_loop, context)
            return
        event_loop.default_exception_handler(context)

    def _register_exception_handler(self) -> None:
        @self.app.exception_handler(Exception)
        async def rpc_error(request: Request, exc: Exception) -> Any:
            request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
            ColorPrint.red(
                f"[RpcServer] {request.method} {request.url.path} failed: {exc}"
            )
            return self._error_response(
                request_id,
                request.url.path,
                "internal_error",
                str(exc),
                500,
            )

    def _register_protocol_routes(self) -> None:
        @self.app.get(RPC_STATUS_PATH)
        async def status() -> Dict[str, Any]:
            return {
                "is_rpc_service": True,
                "protocol_version": RPC_PROTOCOL_VERSION,
                "service": "RpcServer",
                "transport": "http",
            }

        @self.app.get(RPC_INFO_PATH)
        async def info() -> Dict[str, Any]:
            journal = self.event_service.events if self.event_service is not None else None
            return {
                "service": "RpcServer",
                "protocol_version": RPC_PROTOCOL_VERSION,
                "host": self.host,
                "port": self.port,
                "transports": {
                    "http": True,
                },
                "controllers": self.list_controllers(),
                "events": {
                    "enabled": journal is not None,
                    "instance_id": journal.instance_id if journal is not None else None,
                    "seq": journal.seq if journal is not None else 0,
                },
            }

        @self.app.get(RPC_ROUTES_PATH)
        async def routes() -> Dict[str, Any]:
            return {"controllers": self.list_controllers()}

    def _register_http_controller_routes(self) -> None:
        @self.app.get(RPC_CONTROLLERS_PATH)
        async def list_controllers() -> Dict[str, Any]:
            return {"controllers": self.list_controllers()}

        @self.app.api_route(
            f"{RPC_CONTROLLER_PREFIX}/{{controller_name:path}}",
            methods=["GET", "POST"],
        )
        async def dispatch_controller(controller_name: str, request: Request) -> Any:
            route = self.dispatcher.get(controller_name)
            request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
            method = str(request.method or "").upper()
            if route is None:
                return self._error_response(
                    request_id,
                    controller_name,
                    "controller_not_found",
                    f"Controller not found: {controller_name}",
                    404,
                )
            if method not in route.methods:
                return self._error_response(
                    request_id,
                    route.name,
                    "method_not_allowed",
                    f"{method} is not allowed for {route.name}",
                    405,
                )
            params = await self._read_http_params(request)
            context = self._build_http_context(request, request_id)
            result = await self.dispatcher.dispatch(route, params, request_id, context)
            return self._success_response(result, request_id)

    def controller(
        self,
        name: str,
        handler: Callable,
        description: Optional[str] = None,
        timeout: Optional[float] = None,
        methods: Iterable[str] = ("POST",),
    ) -> RpcRoute:
        route = self.dispatcher.register(
            name,
            handler,
            methods=methods,
            description=description,
            timeout=timeout,
        )
        if self.debug:
            ColorPrint.blue(f"[RpcServer] Registered HTTP controller: {route.name}")
        return route

    def route(
        self,
        name: str,
        handler: Callable,
        description: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> RpcRoute:
        return self.controller(
            name,
            handler,
            description=description,
            timeout=timeout,
        )

    def register_routes(
        self,
        routes: Iterable[RouteRegistration],
        group: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> List[RpcRoute]:
        """Register a controller mapping without duplicating route loops."""
        registered = []
        for registration in routes:
            name = registration[0]
            handler = registration[1]
            description = registration[2] if len(registration) > 2 else None
            registered.append(
                self.route(
                    name=name,
                    handler=handler,
                    description=description,
                    timeout=timeout,
                )
            )
        if group:
            ColorPrint.green(
                f"[RpcServer] Registered HTTP controller group: {group}"
            )
        return registered

    def get(
        self,
        name: str,
        handler: Callable,
        description: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> RpcRoute:
        return self.controller(
            name,
            handler,
            description=description,
            timeout=timeout,
            methods=("GET",),
        )

    def post(
        self,
        name: str,
        handler: Callable,
        description: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> RpcRoute:
        return self.controller(
            name,
            handler,
            description=description,
            timeout=timeout,
            methods=("POST",),
        )

    def list_controllers(self) -> list[Dict[str, Any]]:
        return self.dispatcher.list_routes(RPC_CONTROLLER_PREFIX)

    def add_static_dir(self, url_prefix: str, directory: str) -> None:
        path = Path(directory)
        if not path.exists():
            ColorPrint.yellow(f"[RpcServer] Static directory does not exist: {directory}")
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
        rpc_delivery_service.publish_topic(event_name, dict(data or {}))

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
            rpc_delivery_service.publish_topic(normalized_name, payload)

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
    async def _read_http_params(request: Any) -> Dict[str, Any]:
        if str(request.method).upper() == "GET":
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
        body = await request.body()
        if not body:
            return {}
        payload = json.loads(body)
        if not isinstance(payload, dict):
            raise ValueError("RPC request body must be a JSON object")
        return payload

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
    def _success_response(result: Any, request_id: str) -> Any:
        if isinstance(result, Response):
            result.headers.setdefault("X-Request-ID", request_id)
            return result
        if result is None:
            response = Response(status_code=204)
        else:
            response = fastapi.responses.JSONResponse(
                fastapi.encoders.jsonable_encoder(result),
                status_code=200,
            )
        response.headers["X-Request-ID"] = request_id
        return response

    @staticmethod
    def _error_response(
        request_id: str,
        controller_name: str,
        code: str,
        message: str,
        status_code: int,
    ) -> Any:
        response = fastapi.responses.JSONResponse(
            {
                "success": False,
                "error": {"code": code, "message": message},
                "controller": controller_name,
                "request_id": request_id,
            },
            status_code=status_code,
        )
        response.headers["X-Request-ID"] = request_id
        return response




__all__ = ["RpcServer"]
