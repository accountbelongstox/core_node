#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket RPC handler for the FastAPI RPC server.

Accepts WebSocket connections, replays pending events/inventory on connect, and
dispatches inbound message types (REQUEST sync+async / PING / ACK / EVENT).
Constructed with injected tables/managers + debug (same pattern as
ack_manager / request_processor / routes_manager). The shared `_broadcast_loop`
singleton lives on the server orchestrator and is captured in its route wiring.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Dict, List, Set, Tuple

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_fastapi

fastapi = get_third_package_fastapi()
WebSocket = fastapi.WebSocket
WebSocketDisconnect = fastapi.WebSocketDisconnect

from pycore.pyutils.rpc_v2.config import RPC_CONSTANTS
from pycore.pyutils.rpc_v2.common import (
    InventoryTable,
    RequestEventTable,
    RequestStatus,
    RPCRequestContext,
)
from pycore.pyutils.rpc_v2.server.ack_manager import FastAPIAckManager
from pycore.pyutils.rpc_v2.server.client_registry import ClientRegistry, ClientStatus
from pycore.pyutils.rpc_v2.server.routes_manager import RoutesManager
from pycore.pyutils.rpc_v2.server.request_processor import RequestProcessor
from pycore.pyutils.rpc_v2.server._serialized_bridge import await_serialized

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES
ERROR_CODES = RPC_CONSTANTS.ERROR_CODES
CONTROL_MSG_TYPES = frozenset({
    MSG_TYPES["ACK"],
    MSG_TYPES["PING"],
    MSG_TYPES["EVENT"],
    MSG_TYPES["PONG"],
})


class WebSocketRPCHandler:
    """Accept WebSocket connections and dispatch RPC messages."""

    def __init__(
        self,
        client_registry: ClientRegistry,
        request_event_table: RequestEventTable,
        inventory_table: InventoryTable,
        routes_manager: RoutesManager,
        request_processor: RequestProcessor,
        ack_manager: FastAPIAckManager,
        debug: bool = False,
    ):
        self.client_registry = client_registry
        self.request_event_table = request_event_table
        self.inventory_table = inventory_table
        self.routes_manager = routes_manager
        self.request_processor = request_processor
        self.ack_manager = ack_manager
        self.debug = debug

    async def handle_websocket(self, websocket: WebSocket):
        """Accept WebSocket connections and dispatch messages."""
        # Logged unconditionally (not behind debug): this is THE signal that a WS
        # upgrade actually reached the backend. If you see this in the terminal, the
        # /rpc/ws path/proxy works; if you never see it, the upgrade never arrived.
        ColorPrint.cyan(
            f"[WS] upgrade reached backend: path={websocket.url.path} "
            f"client={websocket.client.host if websocket.client else '?'} "
            f"origin={websocket.headers.get('origin', '-')}"
        )
        await websocket.accept()

        client_id = websocket.query_params.get("client_id") or str(uuid.uuid4())
        remote_addr = websocket.client.host if websocket.client else "unknown"
        user_agent = websocket.headers.get("User-Agent")
        connection_tasks: Set[asyncio.Task] = set()

        await self.client_registry.register_websocket_client(
            client_id=client_id,
            websocket=websocket,
            remote_addr=remote_addr,
            user_agent=user_agent,
        )
        await self.client_registry.set_client_status(client_id, ClientStatus.CONNECTED)

        ColorPrint.green(f"[WS] connected id={client_id[:8]} addr={remote_addr}")

        # Prefetch reconnect notifications before welcome so welcome means
        # "server is ready to accept requests" — not "still initializing".
        pending_events, inventory_items = await self._load_client_notifications(client_id)

        await self.client_registry.send_to_client(
            client_id,
            {
                "type": MSG_TYPES["WELCOME"],
                "client_id": client_id,
                "timestamp": time.time(),
            },
        )

        # Historical completions may arrive after welcome; delivery is fire-and-
        # forget via the ACK manager and must not block the receive loop.
        self._deliver_client_notifications(client_id, pending_events, inventory_items)

        try:
            while True:
                message = await websocket.receive_json()
                msg_type = message.get("type", MSG_TYPES["REQUEST"])
                if msg_type in CONTROL_MSG_TYPES:
                    # ACK/PING/EVENT must not wait behind a slow REQUEST.
                    await self.handle_websocket_message(client_id, websocket, message)
                    continue
                task = asyncio.create_task(
                    self.handle_websocket_message(client_id, websocket, message)
                )
                connection_tasks.add(task)
                task.add_done_callback(connection_tasks.discard)
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            for task in list(connection_tasks):
                task.cancel()
            if connection_tasks:
                await asyncio.gather(*connection_tasks, return_exceptions=True)
            # Pass this websocket so a connection already superseded by a newer one
            # for the same client_id doesn't clobber the live session.
            await self.client_registry.unregister_websocket_client(client_id, websocket)
            ColorPrint.yellow(f"[WS] disconnected id={client_id[:8]}")

    async def handle_websocket_message(
        self,
        client_id: str,
        websocket: WebSocket,
        data: Dict[str, Any],
    ):
        """Process WS message types (request/ping/ack)."""
        await self.client_registry.update_client_activity(client_id)

        msg_type = data.get("type", MSG_TYPES["REQUEST"])
        request_id = data.get("event_id") or data.get("id") or self._generate_request_id()

        if msg_type == MSG_TYPES["REQUEST"]:
            await self._handle_request(client_id, websocket, data, request_id)

        elif msg_type == MSG_TYPES["PING"]:
            await self.client_registry.update_client_ping(client_id)

            pending_events = await await_serialized(
                self.request_event_table.get_pending_notifications, client_id
            )
            inventory_items = await await_serialized(
                self.inventory_table.get_by_client, client_id
            )

            await self.client_registry.send_to_client(
                client_id,
                {
                    "type": MSG_TYPES["PONG"],
                    "timestamp": time.time(),
                    "pending_requests": len(pending_events),
                    "inventory_items": len(inventory_items),
                },
            )
            await self._replay_client_notifications(client_id, limit=5)

        elif msg_type == MSG_TYPES["ACK"]:
            self.ack_manager.handle_ack(client_id, data.get("event_id") or request_id)

        elif msg_type == MSG_TYPES["EVENT"]:
            event_name = data.get("event")
            if event_name:
                payload = data.get("data", {})
                self.routes_manager.emit_event(event_name, payload)

    async def _handle_request(
        self,
        client_id: str,
        websocket: WebSocket,
        data: Dict[str, Any],
        request_id: str,
    ) -> None:
        """Dispatch a WS REQUEST on the sync or durable-async path."""
        route = data.get("route")
        if not route:
            await self.client_registry.send_to_client(
                client_id,
                {
                    "type": MSG_TYPES["ERROR"],
                    "route": None,
                    "id": request_id,
                    "error": ERROR_CODES["ROUTE_NOT_FOUND"],
                    "message": "Route not specified",
                },
            )
            return
        if not self.routes_manager.has_route(route):
            await self.client_registry.send_to_client(
                client_id,
                {
                    "type": MSG_TYPES["ERROR"],
                    "route": route,
                    "id": request_id,
                    "error": ERROR_CODES["ROUTE_NOT_FOUND"],
                    "message": f"Route {route} not found",
                },
            )
            return

        # Support both 'data' (RPC v2 format) and 'params' (legacy) fields
        params = data.get("data") or data.get("params", {})
        is_sync = self.routes_manager.is_sync_route(route)

        if is_sync:
            await self._handle_sync_request(
                client_id=client_id,
                websocket=websocket,
                route=route,
                params=params,
                request_id=request_id,
            )
            return

        # Keep inventory until the client ACKs the replayed completion.
        # Removing it before delivery would lose the result if the socket
        # disconnects between send and ACK.
        inventory_item = await await_serialized(
            self.inventory_table.get, request_id, remove=False
        )
        if inventory_item:
            await self.client_registry.send_to_client(
                client_id,
                {
                    "type": MSG_TYPES["RESPONSE"],
                    "route": inventory_item.route,
                    "id": request_id,
                    "event_id": request_id,
                    "client_id": client_id,
                    "result": inventory_item.result,
                    "error": inventory_item.error,
                    "success": inventory_item.error is None,
                    "from_inventory": True,
                    "requires_ack": True,
                    "queue": None,
                },
            )
            return

        existing_event = await await_serialized(
            self.request_event_table.get_event, request_id
        )
        if existing_event:
            if existing_event.client_id and existing_event.client_id != client_id:
                await self.client_registry.send_to_client(
                    client_id,
                    {
                        "type": MSG_TYPES["ERROR"],
                        "route": route,
                        "id": request_id,
                        "event_id": request_id,
                        "client_id": client_id,
                        "error": "event belongs to another client",
                        "success": False,
                    },
                )
                return
            if existing_event.status in (
                RequestStatus.COMPLETED,
                RequestStatus.ACK_PENDING,
                RequestStatus.ACK_RECEIVED,
                RequestStatus.NOTIFIED,
                RequestStatus.STORED,
            ):
                self.ack_manager.notify_websocket_with_retry(
                    client_id=client_id,
                    request_id=request_id,
                    result=existing_event.result,
                    error=existing_event.error,
                )
                return
            if existing_event.status in (RequestStatus.PROCESSING, RequestStatus.PENDING):
                await self.client_registry.send_to_client(
                    client_id,
                    {
                        "type": MSG_TYPES["EVENT"],
                        "route": "request_processing",
                        "event": "request_processing",
                        "id": request_id,
                        "data": {"status": existing_event.status.value},
                    },
                )
                return

        await await_serialized(
            self.request_event_table.create_event,
            request_id=request_id,
            route=route,
            params=params,
            client_id=client_id,
            client_type="websocket",
        )

        if self.debug:
            ColorPrint.blue(f"[WS RPC] Event {request_id[:8]} accepted route={route}")

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

        await self.client_registry.send_to_client(
            client_id,
            {
                "type": MSG_TYPES["EVENT"],
                "route": "request_accepted",
                "event": "request_accepted",
                "id": request_id,
                "event_id": request_id,
                "client_id": client_id,
                "data": {"status": "accepted"},
            },
        )

    async def _handle_sync_request(
        self,
        client_id: str,
        websocket: WebSocket,
        route: str,
        params: Dict[str, Any],
        request_id: str,
    ) -> None:
        """Execute a sync route immediately — no inventory, RequestEvent, or ACK."""
        handler = self.routes_manager.get_route(route)
        if not handler:
            await self.client_registry.send_to_client(
                client_id,
                {
                    "type": MSG_TYPES["ERROR"],
                    "route": route,
                    "id": request_id,
                    "event_id": request_id,
                    "client_id": client_id,
                    "error": ERROR_CODES["ROUTE_NOT_FOUND"],
                    "message": f"Route {route} not found",
                    "success": False,
                    "sync_response": True,
                    "requires_ack": False,
                    "queue": None,
                    "timestamp": int(time.time() * 1000),
                },
            )
            return

        context = RPCRequestContext(
            transport="websocket",
            client_id=client_id,
            websocket=websocket,
        ).__dict__

        if self.debug:
            ColorPrint.blue(f"[WS RPC] Sync route {route} id={request_id[:8]}")

        result = None
        error = None
        # Handler failures become an in-band error response (network RPC boundary).
        try:
            if asyncio.iscoroutinefunction(handler):
                result = await handler(params, request_id, context)
            else:
                result = await asyncio.to_thread(handler, params, request_id, context)
        except Exception as exc:
            error = str(exc)
            ColorPrint.red(f"[WS RPC] Sync route {route} error: {exc}")

        await self.client_registry.send_to_client(
            client_id,
            {
                "type": MSG_TYPES["RESPONSE"],
                "route": route,
                "id": request_id,
                "event_id": request_id,
                "client_id": client_id,
                "result": result,
                "error": error,
                "success": error is None,
                "sync_response": True,
                "requires_ack": False,
                "queue": None,
                "timestamp": int(time.time() * 1000),
            },
        )

    @staticmethod
    def _generate_request_id() -> str:
        return str(uuid.uuid4())

    async def _load_client_notifications(
        self,
        client_id: str,
        limit: int = 10,
    ) -> Tuple[List[Any], List[Any]]:
        """Load pending completions / inventory rows for reconnect replay."""
        pending_events = await await_serialized(
            self.request_event_table.get_pending_notifications, client_id
        )
        inventory_items = await await_serialized(
            self.inventory_table.get_by_client, client_id
        )
        return list(pending_events[:limit]), list(inventory_items[:limit])

    def _deliver_client_notifications(
        self,
        client_id: str,
        pending_events: List[Any],
        inventory_items: List[Any],
    ) -> None:
        """Schedule durable completion delivery (non-blocking)."""
        for event in pending_events:
            self.ack_manager.notify_websocket_with_retry(
                client_id=client_id,
                request_id=event.request_id,
                result=event.result,
                error=event.error,
            )
        for item in inventory_items:
            self.ack_manager.notify_websocket_with_retry(
                client_id=client_id,
                request_id=item.request_id,
                result=item.result,
                error=item.error,
            )

    async def _replay_client_notifications(self, client_id: str, limit: int = 10) -> None:
        """Schedule durable completion delivery for a connected client."""
        pending_events, inventory_items = await self._load_client_notifications(
            client_id, limit=limit
        )
        self._deliver_client_notifications(client_id, pending_events, inventory_items)


__all__ = ["WebSocketRPCHandler"]
