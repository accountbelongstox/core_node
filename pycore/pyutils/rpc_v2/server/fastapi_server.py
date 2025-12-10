#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FastAPI-based RPC server (v2).

This implementation unifies HTTP + WebSocket transports on top of FastAPI while
reusing the proven event/request/inventory tables from rpc v1.
"""

from __future__ import annotations

import asyncio
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from pycore import ColorPrint, THREAD_BUS
from pycore.pyfoundations.third_party import (
    get_third_package_fastapi,
    get_third_package_uvicorn,
)

fastapi = get_third_package_fastapi()
FastAPI = fastapi.FastAPI
Request = fastapi.Request
WebSocket = fastapi.WebSocket
WebSocketDisconnect = fastapi.WebSocketDisconnect
status = fastapi.status
JSONResponse = fastapi.responses.JSONResponse

# Import CORS middleware and StaticFiles properly
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

uvicorn = get_third_package_uvicorn()

from pycore.pyutils.rpc_v2.config import RPC_CONSTANTS
from pycore.pyutils.rpc_v2.common import (
    EventCache,
    RequestManager,
    InventoryTable,
    RequestEventTable,
    RequestStatus,
    default_event_cache,
    default_request_manager,
    RPCRequestContext,
)
from pycore.pyutils.rpc_v2.server.ack_manager import FastAPIAckManager
from pycore.pyutils.rpc_v2.server.client_registry import ClientRegistry, ClientStatus
from pycore.pyutils.rpc_v2.server.routes_manager import RoutesManager
from pycore.pyutils.rpc_v2.server.request_processor import RequestProcessor
from pycore.pyutils.rpc_v2.protocol import RPCProtocolServer

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES
ERROR_CODES = RPC_CONSTANTS.ERROR_CODES
WS_PATH = RPC_CONSTANTS.WS_PATH
HTTP_PATH_PREFIX = RPC_CONSTANTS.HTTP_PATH_PREFIX


class FastAPIRPCServer:
    """Main FastAPI RPC server."""

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

        # Event loop for async broadcast
        self._broadcast_loop = None

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
        Broadcast an event to all connected WebSocket clients.

        Args:
            event_name: Event name (e.g., 'voice_subtitle_update')
            data: Event data to send to clients
        """
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
        if self._broadcast_loop is None:
            if self.debug:
                ColorPrint.yellow(f"[Broadcast] Event loop not ready for {event_name}, skipping")
            return

        # Schedule the coroutine in the uvicorn event loop
        asyncio.run_coroutine_threadsafe(
            self.broadcast_event(event_name, data),
            self._broadcast_loop
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
            asyncio.run_coroutine_threadsafe(
                self.broadcast_event(event_name, event_data),
                self._broadcast_loop
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
        """Wire HTTP + WebSocket endpoints."""

        @self.app.post(f"{HTTP_PATH_PREFIX}/{{route_name:path}}")
        async def handle_named_route(route_name: str, request: Request):
            return await self._handle_http_rpc(request, route_override=route_name)

        @self.app.post(HTTP_PATH_PREFIX)
        async def handle_root_route(request: Request):
            return await self._handle_http_rpc(request)

        @self.app.get(f"{HTTP_PATH_PREFIX}/query/{{request_id}}")
        async def query_result(request_id: str):
            return await self._handle_query_result(request_id)

        @self.app.get(f"{HTTP_PATH_PREFIX}/routes")
        async def list_routes():
            return JSONResponse({"routes": self.routes_manager.get_all_routes()})

        @self.app.websocket(WS_PATH)
        async def websocket_endpoint(websocket: WebSocket):
            await self._handle_websocket(websocket)

    # ------------------------------------------------------------------ HTTP handlers
    async def _handle_http_rpc(
        self,
        request: Request,
        route_override: Optional[str] = None,
    ) -> JSONResponse:
        """Process HTTP RPC requests (mirrors legacy HttpHandler flow)."""
        try:
            if request.method == "POST":
                data = await request.json()
            else:
                data = dict(request.query_params)
        except Exception as exc:
            return JSONResponse(
                {
                    "type": MSG_TYPES["ERROR"],
                    "id": None,
                    "route": None,
                    "success": False,
                    "error": ERROR_CODES["INVALID_MESSAGE"],
                    "message": str(exc),
                },
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        route = route_override or data.get("route")
        if not route:
            return JSONResponse(
                {
                    "type": MSG_TYPES["ERROR"],
                    "id": request_id,
                    "route": None,
                    "success": False,
                    "error": ERROR_CODES["ROUTE_NOT_FOUND"],
                    "message": "Route not specified",
                },
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if not self.routes_manager.has_route(route):
            return JSONResponse(
                {
                    "type": MSG_TYPES["ERROR"],
                    "id": request_id,
                    "route": route,
                    "success": False,
                    "error": ERROR_CODES["ROUTE_NOT_FOUND"],
                    "message": f"Route {route} not found",
                },
                status_code=status.HTTP_404_NOT_FOUND,
            )

        request_id = data.get("id") or data.get("request_id") or self._generate_request_id()

        if "params" in data:
            params = data.get("params", {})
        else:
            params = {
                k: v
                for k, v in data.items()
                if k not in {"route", "id", "session_id", "request_id"}
            }

        session_id = (
            data.get("session_id")
            or request.headers.get("X-Session-ID")
            or f"http-{uuid.uuid4()}"
        )

        if self.debug:
            ColorPrint.blue(
                f"[HTTP RPC] route={route} request_id={request_id} session={session_id} params_keys={list(params.keys())}"
            )

        # Inventory check
        inventory_item = self.inventory_table.get(request_id, remove=False)
        if inventory_item:
            if self.debug:
                ColorPrint.green(f"[HTTP RPC] Found inventory hit for request {request_id}")
            event = self.request_event_table.get_event(request_id) or self.request_event_table.create_event(
                request_id=request_id,
                route=inventory_item.route,
                params=params,
                client_id=session_id,
                client_type="http",
            )
            self.request_event_table.set_result(
                request_id=request_id,
                result=inventory_item.result,
                error=inventory_item.error,
            )
            return self.ack_manager.prepare_http_response_with_ack(
                request_id=request_id,
                data={
                    "type": MSG_TYPES["RESPONSE"],
                    "route": inventory_item.route,
                    "id": request_id,
                    "result": inventory_item.result,
                    "error": inventory_item.error,
                    "success": inventory_item.error is None,
                    "from_inventory": True,
                    "queue": None,
                },
                status_code=status.HTTP_200_OK,
                event=event,
            )

        existing_event = self.request_event_table.get_event(request_id)
        if existing_event:
            if existing_event.status == RequestStatus.COMPLETED:
                return self.ack_manager.prepare_http_response_with_ack(
                    request_id=request_id,
                    data={
                        "type": MSG_TYPES["RESPONSE"],
                        "route": existing_event.route,
                        "id": request_id,
                        "result": existing_event.result,
                        "error": existing_event.error,
                        "success": existing_event.error is None,
                        "queue": None,
                    },
                    status_code=status.HTTP_200_OK,
                    event=existing_event,
                )
            if existing_event.status in (RequestStatus.PROCESSING, RequestStatus.PENDING):
                return JSONResponse(
                    {
                        "type": MSG_TYPES["RESPONSE"],
                        "route": existing_event.route,
                        "id": request_id,
                        "status": existing_event.status.value,
                        "message": "Request is being processed",
                        "queue": None,
                    },
                    status_code=status.HTTP_202_ACCEPTED,
                )

            if self.debug:
                ColorPrint.blue(f"[HTTP RPC] Reusing existing event {request_id} in status {existing_event.status}")

        # ✅ Check if route is synchronous (immediate response)
        is_sync = self.routes_manager.is_sync_route(route)

        event = self.request_event_table.create_event(
            request_id=request_id,
            route=route,
            params=params,
            client_id=session_id,
            client_type="http",
        )

        if is_sync:
            # ✅ Synchronous route: await processing and return immediately
            if self.debug:
                ColorPrint.blue(f"[HTTP RPC] Sync route {route}, processing immediately...")

            # Await processing completion
            await self.request_processor.process_request_async(
                request_id=request_id,
                route=route,
                params=params,
                client_id=session_id,
                client_type="http",
                context=RPCRequestContext(
                    transport="http",
                    client_id=session_id,
                    request=request,
                ).__dict__,
                notify_callback=None  # No callback for sync routes
            )

            # Get completed event
            event = self.request_event_table.get_event(request_id)
            if event and event.status == RequestStatus.COMPLETED:
                if self.debug:
                    ColorPrint.green(f"[HTTP RPC] Sync route {route} completed, returning result")

                # Mark sync responses as notified to skip ACK/redo flow
                self.request_event_table.mark_notified(request_id)

                # ✅ Return result immediately (no requires_ack)
                return JSONResponse(
                    {
                        "type": MSG_TYPES["RESPONSE"],
                        "route": route,
                        "id": request_id,
                        "result": event.result,
                        "error": event.error,
                        "success": event.error is None,
                        "sync_response": True,  # ✅ Mark as sync response
                        "queue": None,
                        "timestamp": int(time.time() * 1000),
                    },
                    status_code=status.HTTP_200_OK,
                )
            else:
                # Processing failed
                return JSONResponse(
                    {
                        "type": MSG_TYPES["ERROR"],
                        "route": route,
                        "id": request_id,
                        "error": event.error if event else "Processing failed",
                        "success": False,
                    },
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        else:
            # ✅ Asynchronous route: use ACK mechanism (original behavior)
            if self.debug:
                ColorPrint.blue(f"[HTTP RPC] Async route {route}, using ACK mechanism...")

            asyncio.create_task(
                self.request_processor.process_request_async(
                    request_id=request_id,
                    route=route,
                    params=params,
                    client_id=session_id,
                    client_type="http",
                    context=RPCRequestContext(
                        transport="http",
                        client_id=session_id,
                        request=request,
                    ).__dict__,
                )
            )

            return self.ack_manager.prepare_http_response_with_ack(
                request_id=request_id,
                data={
                    "type": MSG_TYPES["RESPONSE"],
                    "route": route,
                    "id": request_id,
                    "status": "accepted",
                    "message": "Request accepted, please query result after 1 second",
                    "queue": None,
                },
                status_code=status.HTTP_200_OK,
                event=event,
            )

    async def _handle_query_result(self, request_id: str) -> JSONResponse:
        """HTTP polling endpoint."""
        inventory_item = self.inventory_table.get(request_id, remove=False)
        if inventory_item:
            if self.debug:
                ColorPrint.green(f"[HTTP Query] Inventory replay for {request_id}")
            event = self.request_event_table.get_event(request_id) or self.request_event_table.create_event(
                request_id=request_id,
                route=inventory_item.route,
                params={},
                client_id=inventory_item.client_id,
                client_type=inventory_item.client_type,
            )
            self.request_event_table.set_result(
                request_id=request_id,
                result=inventory_item.result,
                error=inventory_item.error,
            )
            return self.ack_manager.prepare_http_response_with_ack(
                request_id=request_id,
                data={
                    "type": MSG_TYPES["RESPONSE"],
                    "route": inventory_item.route,
                    "id": request_id,
                    "result": inventory_item.result,
                    "error": inventory_item.error,
                    "success": inventory_item.error is None,
                    "from_inventory": True,
                    "queue": None,
                },
                status_code=status.HTTP_200_OK,
                event=event,
            )

        event = self.request_event_table.get_event(request_id)
        if not event:
            if self.debug:
                ColorPrint.yellow(f"[HTTP Query] Request {request_id} not found")
            return JSONResponse(
                {
                    "type": MSG_TYPES["RESPONSE"],
                    "route": None,
                    "id": request_id,
                    "status": "not_found",
                    "message": "Request not found",
                    "queue": None,
                },
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if event.status == RequestStatus.COMPLETED:
            return self.ack_manager.prepare_http_response_with_ack(
                request_id=request_id,
                data={
                    "type": MSG_TYPES["RESPONSE"],
                    "route": event.route,
                    "id": request_id,
                    "result": event.result,
                    "error": event.error,
                    "success": event.error is None,
                    "queue": None,
                },
                status_code=status.HTTP_200_OK,
                event=event,
            )

        if event.status in (RequestStatus.PROCESSING, RequestStatus.PENDING):
            if self.debug:
                ColorPrint.blue(f"[HTTP Query] Request {request_id} still {event.status.value}")
            return JSONResponse(
                {
                    "type": MSG_TYPES["RESPONSE"],
                    "route": event.route,
                    "id": request_id,
                    "status": event.status.value,
                    "message": "Request is being processed",
                    "queue": None,
                },
                status_code=status.HTTP_202_ACCEPTED,
            )

        return JSONResponse(
            {
                "type": MSG_TYPES["RESPONSE"],
                "route": event.route,
                "id": request_id,
                "status": event.status.value,
                "message": f"Request status: {event.status.value}",
                "queue": None,
            }
        )

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

    # ------------------------------------------------------------------ WebSocket handlers
    async def _handle_websocket(self, websocket: WebSocket):
        """Accept WebSocket connections and dispatch messages."""
        await websocket.accept()

        # Capture event loop on first WebSocket connection
        if self._broadcast_loop is None:
            self._broadcast_loop = asyncio.get_running_loop()
            if self.debug:
                ColorPrint.blue("[WS] Captured event loop for broadcast")

        client_id = websocket.query_params.get("client_id") or str(uuid.uuid4())
        remote_addr = websocket.client.host if websocket.client else "unknown"
        user_agent = websocket.headers.get("User-Agent")

        await self.client_registry.register_websocket_client(
            client_id=client_id,
            websocket=websocket,
            remote_addr=remote_addr,
            user_agent=user_agent,
        )
        await self.client_registry.set_client_status(client_id, ClientStatus.CONNECTED)

        if self.debug:
            ColorPrint.green(f"[WS] Client connected id={client_id[:8]} addr={remote_addr}")

        await websocket.send_json(
            {
                "type": MSG_TYPES["WELCOME"],
                "client_id": client_id,
                "timestamp": time.time(),
            }
        )

        # Deliver pending events/inventory
        pending_events = self.request_event_table.get_pending_notifications(client_id)
        inventory_items = self.inventory_table.get_by_client(client_id)

        for event in pending_events[:10]:
            self.ack_manager.notify_websocket_with_retry(
                client_id=client_id,
                request_id=event.request_id,
                result=event.result,
                error=event.error,
            )

        for item in inventory_items[:10]:
            await websocket.send_json(
                {
                    "type": MSG_TYPES["RESPONSE"],
                    "route": item.route,
                    "id": item.request_id,
                    "result": item.result,
                    "error": item.error,
                    "success": item.error is None,
                    "from_inventory": True,
                    "requires_ack": True,
                    "queue": None,
                }
            )
            self.inventory_table.delete(item.request_id)

        try:
            while True:
                message = await websocket.receive_json()
                await self._handle_websocket_message(client_id, websocket, message)
        except WebSocketDisconnect:
            pass
        finally:
            await self.client_registry.unregister_websocket_client(client_id)
            if self.debug:
                ColorPrint.yellow(f"[WS] Client disconnected id={client_id[:8]}")

    async def _handle_websocket_message(
        self,
        client_id: str,
        websocket: WebSocket,
        data: Dict[str, Any],
    ):
        """Process WS message types (request/ping/ack)."""
        await self.client_registry.update_client_activity(client_id)

        msg_type = data.get("type", MSG_TYPES["REQUEST"])
        request_id = data.get("id") or self._generate_request_id()

        if msg_type == MSG_TYPES["REQUEST"]:
            route = data.get("route")
            if not route:
                await websocket.send_json(
                    {
                        "type": MSG_TYPES["ERROR"],
                        "route": None,
                        "id": request_id,
                        "error": ERROR_CODES["ROUTE_NOT_FOUND"],
                        "message": "Route not specified",
                    }
                )
                return
            if not self.routes_manager.has_route(route):
                await websocket.send_json(
                    {
                        "type": MSG_TYPES["ERROR"],
                        "route": route,
                        "id": request_id,
                        "error": ERROR_CODES["ROUTE_NOT_FOUND"],
                        "message": f"Route {route} not found",
                    }
                )
                return

            params = data.get("params", {})

            inventory_item = self.inventory_table.get(request_id, remove=True)
            if inventory_item:
                await websocket.send_json(
                    {
                        "type": MSG_TYPES["RESPONSE"],
                        "route": inventory_item.route,
                        "id": request_id,
                        "result": inventory_item.result,
                        "error": inventory_item.error,
                        "success": inventory_item.error is None,
                        "from_inventory": True,
                        "requires_ack": True,
                        "queue": None,
                    }
                )
                return

            existing_event = self.request_event_table.get_event(request_id)
            if existing_event:
                if existing_event.status == RequestStatus.COMPLETED:
                    self.ack_manager.notify_websocket_with_retry(
                        client_id=client_id,
                        request_id=request_id,
                        result=existing_event.result,
                        error=existing_event.error,
                    )
                    return
                if existing_event.status in (RequestStatus.PROCESSING, RequestStatus.PENDING):
                    await websocket.send_json(
                        {
                            "type": MSG_TYPES["EVENT"],
                            "route": "request_processing",
                            "event": "request_processing",
                            "id": request_id,
                            "data": {"status": existing_event.status.value},
                        }
                    )
                    return

            # ✅ Check if route is synchronous (immediate response)
            is_sync = self.routes_manager.is_sync_route(route)

            self.request_event_table.create_event(
                request_id=request_id,
                route=route,
                params=params,
                client_id=client_id,
                client_type="websocket",
            )

            if is_sync:
                # ✅ Synchronous route: await processing and return immediately
                if self.debug:
                    ColorPrint.blue(f"[WS RPC] Sync route {route}, processing immediately...")

                # Await processing completion
                await self.request_processor.process_request_async(
                    request_id=request_id,
                    route=route,
                    params=params,
                    client_id=client_id,
                    client_type="websocket",
                    context=RPCRequestContext(
                        transport="websocket",
                        client_id=client_id,
                        websocket=websocket,
                    ).__dict__,
                    notify_callback=None  # No callback for sync routes
                )

                # Get completed event
                event = self.request_event_table.get_event(request_id)
                if event and event.status == RequestStatus.COMPLETED:
                    if self.debug:
                        ColorPrint.green(f"[WS RPC] Sync route {route} completed, sending result")

                    # Mark sync responses as notified so ACK manager does not retry them
                    self.request_event_table.mark_notified(request_id)

                    # ✅ Send result immediately (no ACK mechanism)
                    await websocket.send_json(
                        {
                            "type": MSG_TYPES["RESPONSE"],
                            "route": route,
                            "id": request_id,
                            "result": event.result,
                            "error": event.error,
                            "success": event.error is None,
                            "sync_response": True,  # ✅ Mark as sync response
                            "requires_ack": False,  # ✅ No ACK required
                            "queue": None,
                            "timestamp": int(time.time() * 1000),
                        }
                    )
                    return  # ✅ Sync route completed, exit handler
                else:
                    # Processing failed
                    await websocket.send_json(
                        {
                            "type": MSG_TYPES["ERROR"],
                            "route": route,
                            "id": request_id,
                            "error": event.error if event else "Processing failed",
                            "success": False,
                        }
                    )
                    return  # ✅ Sync route failed, exit handler
            else:
                # ✅ Asynchronous route: use ACK mechanism (original behavior)
                if self.debug:
                    ColorPrint.blue(f"[WS RPC] Async route {route}, using ACK mechanism...")

                asyncio.create_task(
                    self.request_processor.process_request_async(
                        request_id=request_id,
                        route=route,
                        params=params,
                        client_id=client_id,
                        client_type="websocket",
                        context=RPCRequestContext(
                            transport="websocket",
                            client_id=client_id,
                            websocket=websocket,
                        ).__dict__,
                        notify_callback=self.ack_manager.notify_websocket_with_retry,
                    )
                )

                # Send accepted event for async routes
                await websocket.send_json(
                    {
                        "type": MSG_TYPES["EVENT"],
                        "route": "request_accepted",
                        "event": "request_accepted",
                        "id": request_id,
                        "data": {"status": "accepted"},
                    }
                )

        elif msg_type == MSG_TYPES["PING"]:
            await self.client_registry.update_client_ping(client_id)

            pending_events = self.request_event_table.get_pending_notifications(client_id)
            inventory_items = self.inventory_table.get_by_client(client_id)

            await websocket.send_json(
                {
                    "type": MSG_TYPES["PONG"],
                    "timestamp": time.time(),
                    "pending_requests": len(pending_events),
                    "inventory_items": len(inventory_items),
                }
            )

            for event in pending_events[:5]:
                self.ack_manager.notify_websocket_with_retry(
                    client_id=client_id,
                    request_id=event.request_id,
                    result=event.result,
                    error=event.error,
                )

            for item in inventory_items[:5]:
                await websocket.send_json(
                    {
                        "type": MSG_TYPES["RESPONSE"],
                        "id": item.request_id,
                        "result": item.result,
                        "error": item.error,
                        "success": item.error is None,
                        "from_inventory": True,
                        "requires_ack": True,
                    }
                )
                self.inventory_table.delete(item.request_id)

        elif msg_type == MSG_TYPES["ACK"]:
            self.ack_manager.handle_ack(client_id, request_id)

        elif msg_type == MSG_TYPES["EVENT"]:
            event_name = data.get("event")
            if event_name:
                payload = data.get("data", {})
                self.routes_manager.emit_event(event_name, payload)

    # ------------------------------------------------------------------ Helpers
    @staticmethod
    def _generate_request_id() -> str:
        return str(uuid.uuid4())


class FastAPIRPCServerRunner:
    """Run FastAPIRPCServer inside a background thread."""

    def __init__(self, **server_options):
        self.server = FastAPIRPCServer(options=server_options)
        self._thread: Optional[threading.Thread] = None
        self._uvicorn_server: Optional[uvicorn.Server] = None
        self._start_event = threading.Event()

    def start(self):
        if self._thread and self._thread.is_alive():
            ColorPrint.yellow("[FastAPIRPCRunner] Server already running")
            return

        # Configure logging to suppress CancelledError during shutdown
        import logging

        class SuppressCancelledErrorFilter(logging.Filter):
            """Filter to suppress asyncio.CancelledError logs during shutdown"""
            def filter(self, record):
                # Suppress CancelledError from starlette/uvicorn during shutdown
                if "CancelledError" in str(record.msg):
                    return False
                if hasattr(record, 'exc_info') and record.exc_info:
                    exc_type = record.exc_info[0]
                    if exc_type and exc_type.__name__ == 'CancelledError':
                        return False
                return True

        # Add filter to uvicorn's error logger
        uvicorn_error_logger = logging.getLogger("uvicorn.error")
        cancel_filter = SuppressCancelledErrorFilter()
        uvicorn_error_logger.addFilter(cancel_filter)

        self._start_event.clear()
        config = uvicorn.Config(
            app=self.server.app,
            host=self.server.host,
            port=self.server.port,
            loop="asyncio",
            log_level="debug" if self.server.debug else "info",
        )
        self._uvicorn_server = uvicorn.Server(config=config)

        def runner():
            ColorPrint.green(
                f"[FastAPIRPCRunner] Starting FastAPI RPC server on {self.server.host}:{self.server.port}"
            )
            self._start_event.set()
            try:
                self._uvicorn_server.run()
            except Exception:
                # Suppress expected errors during shutdown (CancelledError, etc.)
                pass

        self._thread = threading.Thread(target=runner, name="FastAPIRPCServerThread", daemon=True)
        self._thread.start()
        self._start_event.wait(timeout=5)

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
    def app(self) -> FastAPI:
        return self.server.app
