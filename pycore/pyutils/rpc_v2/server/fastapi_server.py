#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FastAPI-based RPC server (v2) - orchestrator + facade.

This implementation unifies HTTP + WebSocket + SSE transports on top of FastAPI
while reusing the proven event/request/inventory tables from rpc v1. The
transport handlers live in sibling modules (http_handler / websocket_handler /
sse_broadcaster) and the uvicorn runner in server_runner; this module wires them
together and owns the shared `_broadcast_loop` singleton that keeps SSE + WS +
sync broadcast scheduling coherent.

Public API: FastAPIRPCServer (runner re-exported from server.__init__).
SSEBroadcaster, HttpRPCHandler, WebSocketRPCHandler are sibling modules.
"""

from __future__ import annotations

import asyncio
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from pycore import ColorPrint, THREAD_BUS
from pycore.pyfoundations.serialized_worker import submit_coroutine_via_bus
from pycore.pyfoundations.third_party import get_third_package_fastapi

fastapi = get_third_package_fastapi()
FastAPI = fastapi.FastAPI
Request = fastapi.Request
WebSocket = fastapi.WebSocket
JSONResponse = fastapi.responses.JSONResponse

# Import CORS middleware and StaticFiles properly
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from pycore.pyutils.rpc_v2.config import RPC_CONSTANTS
from pycore.pyutils.rpc_v2.common import (
    EventCache,
    RequestManager,
    InventoryTable,
    RequestEventTable,
    default_event_cache,
    default_request_manager,
)
from pycore.pyutils.rpc_v2.server.ack_manager import FastAPIAckManager
from pycore.pyutils.rpc_v2.server.client_registry import ClientRegistry
from pycore.pyutils.rpc_v2.server.routes_manager import RoutesManager
from pycore.pyutils.rpc_v2.server.request_processor import RequestProcessor
from pycore.pyutils.rpc_v2.server.http_handler import HttpRPCHandler
from pycore.pyutils.rpc_v2.server.websocket_handler import WebSocketRPCHandler
from pycore.pyutils.rpc_v2.server.sse_broadcaster import SSEBroadcaster
from pycore.pyutils.rpc_v2.protocol import RPCProtocolServer

WS_PATH = RPC_CONSTANTS.WS_PATH
HTTP_PATH_PREFIX = RPC_CONSTANTS.HTTP_PATH_PREFIX


class _PrivateNetworkAccessMiddleware:
    """Pure-ASGI middleware: stamp `Access-Control-Allow-Private-Network: true`
    on every HTTP response (including CORS preflight) so a browser in a SECURE
    CONTEXT can reach this loopback/private pycore service from a public or
    less-private origin (Private Network Access / PNA).

    WebSocket upgrades pass through untouched (scope type != "http"); the PNA
    preflight Chrome sends before a WS handshake is an HTTP OPTIONS that DOES go
    through here, so the header is added to it as well.

    This does NOT help a non-secure-context origin (plain HTTP on a public IP):
    the browser blocks public->loopback/private BEFORE any preflight, so no
    header can rescue it. For that path use an HTTPS origin, a localhost origin,
    or the `block-insecure-private-network-requests` Chrome flag.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        async def _send(message):
            if message.get("type") == "http.response.start":
                headers = list(message.get("headers") or [])
                headers.append((b"access-control-allow-private-network", b"true"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, _send)


class FastAPIRPCServer:
    """Main FastAPI RPC server (orchestrator + facade)."""

    def __init__(self, options: Optional[Dict[str, Any]] = None):
        options = options or {}

        self.host = options.get("host", RPC_CONSTANTS.DEFAULTS["SERVER_HOST"])
        self.port = options.get("port", RPC_CONSTANTS.DEFAULTS["SERVER_PORT"])
        self.debug = options.get("debug", False)
        self.allow_origins = options.get("allow_origins", ["*"])

        self.event_cache: EventCache = options.get("event_cache", default_event_cache)
        self.request_manager: RequestManager = options.get(
            "request_manager",
            default_request_manager,
        )
        self.request_event_table: RequestEventTable = options.get(
            "request_event_table",
            RequestEventTable(max_size=options.get("max_requests", 10_000_000), debug=self.debug),
        )
        self.inventory_table: InventoryTable = options.get(
            "inventory_table",
            InventoryTable(max_size=options.get("max_requests", 10_000_000), debug=self.debug),
        )

        self.routes_manager = RoutesManager(debug=self.debug)
        self.client_registry = ClientRegistry(debug=self.debug)
        self.request_processor = RequestProcessor(
            request_event_table=self.request_event_table,
            routes=self.routes_manager.routes,
            debug=self.debug,
        )
        self.ack_manager = FastAPIAckManager(
            request_event_table=self.request_event_table,
            inventory_table=self.inventory_table,
            client_registry=self.client_registry,
            debug=self.debug,
        )

        # Transport handlers (injected tables/managers + debug, mirroring the
        # ack_manager / request_processor / routes_manager construction pattern).
        self.sse_broadcaster = SSEBroadcaster(
            debug=self.debug,
            sse_ring_size=options.get("sse_ring_size", 500),
        )
        self.http_handler = HttpRPCHandler(
            request_event_table=self.request_event_table,
            inventory_table=self.inventory_table,
            routes_manager=self.routes_manager,
            request_processor=self.request_processor,
            ack_manager=self.ack_manager,
            debug=self.debug,
        )
        self.websocket_handler = WebSocketRPCHandler(
            client_registry=self.client_registry,
            request_event_table=self.request_event_table,
            inventory_table=self.inventory_table,
            routes_manager=self.routes_manager,
            request_processor=self.request_processor,
            ack_manager=self.ack_manager,
            debug=self.debug,
        )

        self.app = FastAPI(
            title="Pycore RPC Server",
            version="2.0.0",
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
        # PNA middleware added AFTER CORS so it wraps it (outermost): CORS handles
        # the OPTIONS preflight short-circuit, this outer layer then stamps the
        # Private-Network header onto that preflight response (and every other).
        self.app.add_middleware(_PrivateNetworkAccessMiddleware)

        # Windows asyncio (Proactor) raises a benign ConnectionResetError
        # ([WinError 10054]) from _ProactorBasePipeTransport._call_connection_lost
        # whenever a client drops a connection abruptly - a browser closing the WS,
        # or an SSE EventSource on its ~50s reconnect cycle. It is harmless but spams
        # "Exception in callback" tracebacks once per disconnect. Install a loop
        # exception handler at startup that swallows ONLY these client-reset errors
        # and defers everything else to asyncio's default handler.
        @self.app.on_event("startup")
        async def _install_loop_exception_handler() -> None:
            def _handler(loop: "asyncio.AbstractEventLoop", context: Dict[str, Any]) -> None:
                exc = context.get("exception")
                if isinstance(exc, (ConnectionResetError, ConnectionAbortedError)):
                    return  # client went away mid-stream; nothing to do
                loop.default_exception_handler(context)
            try:
                asyncio.get_running_loop().set_exception_handler(_handler)
            except Exception:
                pass

        self._static_mounts: Dict[str, str] = {}
        self._register_builtin_routes()
        self._add_default_static_dirs()

        # Register FastAPI routers (from config)
        fastapi_routers = options.get("fastapi_routers", [])
        if fastapi_routers:
            router_names = []
            for router in fastapi_routers:
                self.app.include_router(router)
                # Extract router name from tags or prefix
                router_name = router.tags[0] if router.tags else (router.prefix or "unnamed")
                router_names.append(router_name)

            if self.debug:
                ColorPrint.green(f"[FastAPIRPC] Registered {len(fastapi_routers)} routers: {', '.join(router_names)}")

        # Mount static directories (from config)
        static_mounts = options.get("static_mounts", [])
        for mount_config in static_mounts:
            url_prefix = mount_config.get("url_prefix")
            directory = mount_config.get("directory")
            name = mount_config.get("name", url_prefix.strip("/").replace("/", "_"))
            if url_prefix and directory:
                path = Path(directory)
                if path.exists():
                    self.app.mount(url_prefix, StaticFiles(directory=str(path), html=True), name=name)
                    if self.debug:
                        ColorPrint.green(f"[FastAPIRPC] Mounted static dir {url_prefix} -> {path}")
                else:
                    if self.debug:
                        ColorPrint.yellow(f"[FastAPIRPC] Static directory does not exist: {directory}")

        self.protocol_server = RPCProtocolServer(self)

        # Shared event loop for async broadcast. This is the ONE _broadcast_loop
        # singleton: captured lazily in the WS + SSE route wiring (below) and READ
        # by broadcast_event_sync + register_thread_bus_listener. The SSE + WS
        # handlers never duplicate it - they are pure-injection and do not touch it.
        self._broadcast_loop = None

        # Live log streaming (observer pattern): register a callback into the base
        # print library so every printed line is relayed to connected WS clients.
        # rpc_v2 imports ColorPrint, never the reverse - ColorPrint stays decoupled.
        # The callback is a no-op until a client connects / the loop is running.
        self._log_guard_prefix = f'pyutils.rpc_v2.log_guard.{id(self)}'
        ColorPrint.register_callback(self._colorprint_ws_callback)

    def _colorprint_ws_callback(self, message, color_type="white", log_level=None):
        """ColorPrint callback: relay every printed line to connected WS clients as a 'pycore_log' event. Never raises; no-op when no client/loop."""
        guard_signal = f'{self._log_guard_prefix}.{threading.get_ident()}'
        if THREAD_BUS.get_signal(guard_signal, False):
            return
        # The broadcast path logs "[Broadcast] ..." in debug mode (on the loop thread,
        # where this guard doesn't apply); skip those to avoid a log->broadcast->log loop.
        if isinstance(message, str) and message.lstrip().startswith("[Broadcast]"):
            return
        THREAD_BUS.signal(guard_signal, True)
        try:
            self.broadcast_event_sync("pycore_log", {"message": message, "color": color_type or "white", "level": log_level or "INFO"})
        finally:
            THREAD_BUS.clear_signal(guard_signal)

    # ------------------------------------------------------------------ Public API
    def route(self, name: str, handler: Callable, sync: bool = False, description: Optional[str] = None):
        """
        Register RPC route.

        Args:
            name: Route name
            handler: Route handler function (can be sync or async)
            sync: If True, response is returned immediately without ACK mechanism (default: False)
            description: Optional route description
        """
        self.routes_manager.register_route(name, handler, sync=sync, description=description)

    def add_static_dir(self, url_prefix: str, directory: str):
        """Expose static files (e.g., JS client bundle)."""
        path = Path(directory)
        if not path.exists():
            ColorPrint.yellow(f"[FastAPIRPC] Static directory does not exist: {directory}")
            return

        mount_path = url_prefix if url_prefix.startswith("/") else f"/{url_prefix}"
        self._static_mounts[mount_path] = str(path)
        self.app.mount(mount_path, StaticFiles(directory=str(path)), name=mount_path)
        if self.debug:
            ColorPrint.blue(f"[FastAPIRPC] Mounted static dir {mount_path} -> {path}")

    async def broadcast_event(self, event_name: str, data: Dict[str, Any]):
        """
        Broadcast an event to all connected WebSocket clients (and SSE subscribers).

        NOTE: Live "stream every ColorPrint line to the UI" rides on this method:
        this server registers `_colorprint_ws_callback` into ColorPrint's callback
        registry (observer pattern), which calls broadcast_event_sync('pycore_log',
        ...). rpc_v2 imports ColorPrint, never the reverse - ColorPrint stays a
        decoupled base library, so no import cycle forms.

        The SSE fan-out (monotonic seq + ring buffer + subscriber queues) is owned
        by self.sse_broadcaster.publish(); the WS fan-out runs here. SSE runs FIRST
        so it shares the SAME event source as WS and is NOT skipped when no WS
        client is connected.

        Args:
            event_name: Event name (e.g., 'voice_subtitle_update')
            data: Event data to send to clients
        """
        # SSE fan-out FIRST so it shares the SAME event source as WS and is NOT
        # skipped when no WS client is connected.
        self.sse_broadcaster.publish(event_name, data)

        clients = self.client_registry.ws_clients
        if not clients:
            return

        message = {
            'type': 'event',
            'event': event_name,
            'data': data,
            'timestamp': time.time()
        }

        for client_id, websocket in clients.items():
            try:
                await websocket.send_json(message)
                if self.debug:
                    ColorPrint.blue(f"[Broadcast] Sent {event_name} to client {client_id[:8]}")
            except Exception as e:
                if self.debug:
                    ColorPrint.yellow(f"[Broadcast] Failed to send to client {client_id[:8]}: {e}")

    def broadcast_event_sync(self, event_name: str, data: Dict[str, Any]):
        """
        Synchronous wrapper for broadcast_event() for use from non-async contexts.

        This method can be called from any thread (e.g., HeartbeatPusher thread).

        Args:
            event_name: Event name
            data: Event data
        """
        # Guard against a missing or stopped server loop during shutdown.
        loop = self._broadcast_loop
        if loop is None or not loop.is_running():
            if self.debug and loop is None:
                ColorPrint.yellow(f"[Broadcast] Event loop not ready for {event_name}, skipping")
            return

        # Schedule the coroutine in the uvicorn event loop
        submit_coroutine_via_bus(
            loop,
            self.broadcast_event(event_name, data),
            thread_name="RPCBroadcastBridgeThread",
        )

    def register_thread_bus_listener(self, event_name: str):
        """
        Register a THREAD_BUS event listener that broadcasts to WebSocket clients.

        Args:
            event_name: THREAD_BUS event name to listen for
        """
        def handler(event_data):
            """THREAD_BUS event handler that broadcasts to WebSocket clients"""
            # Check if event loop is available
            if self._broadcast_loop is None:
                if self.debug:
                    ColorPrint.yellow(f"[Broadcast] Event loop not ready for {event_name}, waiting for first WebSocket connection")
                return

            # Schedule the coroutine in the uvicorn loop
            submit_coroutine_via_bus(
                self._broadcast_loop,
                self.broadcast_event(event_name, event_data),
                thread_name="RPCThreadBusBroadcastBridgeThread",
            )

        THREAD_BUS.register_event_handler(event_name, handler)
        if self.debug:
            ColorPrint.green(f"[FastAPIRPC] Registered THREAD_BUS listener for: {event_name}")

    # ------------------------------------------------------------------ Internal setup
    def _add_default_static_dirs(self):
        """Serve RPC JS client at /rpc/src by default."""
        pyutils_root = Path(__file__).resolve().parents[2]
        client_js_dir = pyutils_root / "rpc_v2" / "client"
        if client_js_dir.exists():
            self.add_static_dir("/rpc/src", str(client_js_dir))

    def _register_builtin_routes(self):
        """Wire HTTP + WebSocket + SSE endpoints, delegating to the transport handlers."""

        @self.app.post(f"{HTTP_PATH_PREFIX}/{{route_name:path}}")
        async def handle_named_route(route_name: str, request: Request):
            return await self.http_handler.handle_http_rpc(request, route_override=route_name)

        @self.app.post(HTTP_PATH_PREFIX)
        async def handle_root_route(request: Request):
            return await self.http_handler.handle_http_rpc(request)

        @self.app.get(f"{HTTP_PATH_PREFIX}/query/{{request_id}}")
        async def query_result(request_id: str):
            return await self.http_handler.handle_query_result(request_id)

        @self.app.get(f"{HTTP_PATH_PREFIX}/routes")
        async def list_routes():
            return JSONResponse({"routes": self.routes_manager.get_all_routes()})

        @self.app.websocket(WS_PATH)
        async def websocket_endpoint(websocket: WebSocket):
            # Capture the shared broadcast event loop on the first WS connection.
            # This is the ONE _broadcast_loop singleton (read by broadcast_event_sync
            # + register_thread_bus_listener); the SSE route below captures the same
            # loop. Never duplicate it - the handlers are pure-injection and do not
            # touch it. asyncio.get_running_loop() is valid from the very start of
            # the request coroutine (same loop before/after accept).
            if self._broadcast_loop is None:
                self._broadcast_loop = asyncio.get_running_loop()
                ColorPrint.blue("[WS] Captured event loop for broadcast")
            await self.websocket_handler.handle_websocket(websocket)

        @self.app.get(f"{HTTP_PATH_PREFIX}/sse")
        async def sse_stream(request: Request, client_id: Optional[str] = None, since: Optional[int] = None):
            # Capture the loop here too so SSE works even before any WS connect.
            if self._broadcast_loop is None:
                self._broadcast_loop = asyncio.get_running_loop()
            return await self.sse_broadcaster.handle_sse(request, client_id=client_id, since=since)

    def _build_status_payload(self) -> Dict[str, Any]:
        """Return diagnostics for /rpc/status."""
        return {
            "service": "FastAPIRPCServer",
            "host": self.host,
            "port": self.port,
            "routes": self.routes_manager.get_all_routes(),
            "event_table": self.request_event_table.get_stats(),
            "inventory": self.inventory_table.get_stats(),
        }


__all__ = [
    "FastAPIRPCServer",
]
