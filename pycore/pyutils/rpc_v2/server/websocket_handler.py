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
from typing import Any, Dict

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

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES
ERROR_CODES = RPC_CONSTANTS.ERROR_CODES


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

        await self.client_registry.register_websocket_client(
            client_id=client_id,
            websocket=websocket,
            remote_addr=remote_addr,
            user_agent=user_agent,
        )
        await self.client_registry.set_client_status(client_id, ClientStatus.CONNECTED)

        ColorPrint.green(f"[WS] connected id={client_id[:8]} addr={remote_addr}")

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
                await self.handle_websocket_message(client_id, websocket, message)
        except WebSocketDisconnect:
            pass
        finally:
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

            # Support both 'data' (RPC v2 format) and 'params' (legacy) fields
            params = data.get("data") or data.get("params", {})

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

            # Check if route is synchronous (immediate response)
            is_sync = self.routes_manager.is_sync_route(route)

            self.request_event_table.create_event(
                request_id=request_id,
                route=route,
                params=params,
                client_id=client_id,
                client_type="websocket",
            )

            if is_sync:
                # Synchronous route: await processing and return immediately
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

                    # Send result immediately (no ACK mechanism)
                    await websocket.send_json(
                        {
                            "type": MSG_TYPES["RESPONSE"],
                            "route": route,
                            "id": request_id,
                            "result": event.result,
                            "error": event.error,
                            "success": event.error is None,
                            "sync_response": True,  # Mark as sync response
                            "requires_ack": False,  # No ACK required
                            "queue": None,
                            "timestamp": int(time.time() * 1000),
                        }
                    )
                    return  # Sync route completed, exit handler
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
                    return  # Sync route failed, exit handler
            else:
                # Asynchronous route: use ACK mechanism (original behavior)
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

    @staticmethod
    def _generate_request_id() -> str:
        return str(uuid.uuid4())


__all__ = ["WebSocketRPCHandler"]
