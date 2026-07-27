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
from typing import Any, Dict, List, Optional, Set, Tuple

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
from pycore.pyutils.rpc_v2.server.rpc_delivery_service import get_rpc_delivery_service
from pycore.database import StateRepository

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES
ERROR_CODES = RPC_CONSTANTS.ERROR_CODES
_STATE_REPO = StateRepository()
CONTROL_MSG_TYPES = frozenset({
    MSG_TYPES["ACK"],
    MSG_TYPES["PING"],
    MSG_TYPES["EVENT"],
    MSG_TYPES["PONG"],
})

_HANDSHAKE_TIMEOUT_S = 10.0
_SERVER_INSTANCE_ID = uuid.uuid4().hex
HELLO_TYPE = MSG_TYPES.get("HELLO", "hello")


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
        ColorPrint.cyan(
            f"[WS] upgrade reached backend: path={websocket.url.path} "
            f"client={websocket.client.host if websocket.client else '?'} "
            f"origin={websocket.headers.get('origin', '-')}"
        )
        await websocket.accept()

        connection_id = uuid.uuid4().hex
        remote_addr = websocket.client.host if websocket.client else "unknown"
        user_agent = websocket.headers.get("User-Agent")
        connection_tasks: Set[asyncio.Task] = set()
        pending_first_message: Optional[Dict[str, Any]] = None

        client_id = websocket.query_params.get("client_id")
        resume_seq = 0
        resume_token_in: Optional[str] = None
        got_hello = False

        try:
            first = await asyncio.wait_for(websocket.receive_json(), timeout=_HANDSHAKE_TIMEOUT_S)
            if str(first.get("type", "")).lower() == HELLO_TYPE:
                client_id = str(first.get("client_id") or client_id or uuid.uuid4())
                resume_seq = int(first.get("last_acked_seq") or 0)
                resume_token_in = first.get("resume_token")
                if resume_token_in is not None:
                    resume_token_in = str(resume_token_in)
                got_hello = True
            else:
                pending_first_message = first
                client_id = str(client_id or uuid.uuid4())
        except asyncio.TimeoutError:
            client_id = str(client_id or uuid.uuid4())
        except (WebSocketDisconnect, RuntimeError):
            return

        auth_ok, resume_token = await asyncio.to_thread(
            _STATE_REPO.authenticate_client_session,
            client_id,
            resume_token_in if got_hello else None,
        )
        if not auth_ok:
            ColorPrint.red(f"[WS] rejected client_id={client_id[:8]} invalid resume token")
            await websocket.close(code=4001, reason="invalid resume token")
            return

        await self.client_registry.register_websocket_client(
            client_id=client_id,
            websocket=websocket,
            remote_addr=remote_addr,
            user_agent=user_agent,
        )
        await self.client_registry.set_client_status(client_id, ClientStatus.CONNECTED)

        ColorPrint.green(f"[WS] connected id={client_id[:8]} addr={remote_addr}")

        pending_events, inventory_items = await self._load_client_notifications(client_id)
        delivery = get_rpc_delivery_service()
        offset = delivery.get_client_offset(client_id)
        if resume_seq > offset:
            offset = resume_seq

        await self.client_registry.send_to_client(
            client_id,
            {
                "type": MSG_TYPES["WELCOME"],
                "client_id": client_id,
                "connection_id": connection_id,
                "resume_token": resume_token,
                "server_instance_id": _SERVER_INSTANCE_ID,
                "highest_contiguous_acked_seq": offset,
                "timestamp": time.time(),
            },
        )

        self._deliver_client_notifications(client_id, pending_events, inventory_items)
        self._deliver_durable_events(client_id, after_seq=offset)

        if pending_first_message is not None:
            await self.handle_websocket_message(client_id, websocket, pending_first_message)

        try:
            while True:
                message = await websocket.receive_json()
                msg_type = message.get("type", MSG_TYPES["REQUEST"])
                if msg_type in CONTROL_MSG_TYPES:
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
        request_id = (
            data.get("request_id")
            or data.get("event_id")
            or data.get("id")
            or self._generate_request_id()
        )

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
            event_id = str(data.get("event_id") or "")
            seq = int(data.get("seq") or 0)
            connection_id = data.get("connection_id")
            if event_id and seq:
                delivery = get_rpc_delivery_service()
                ok = delivery.ack_event(client_id, event_id, seq)
                await self.client_registry.send_to_client(
                    client_id,
                    {
                        "type": MSG_TYPES.get("ACK_CONFIRMATION", "ack_confirmation"),
                        "client_id": client_id,
                        "connection_id": connection_id,
                        "event_id": event_id,
                        "seq": seq,
                        "success": ok,
                        "highest_contiguous_acked_seq": delivery.get_client_offset(client_id),
                    },
                )
            else:
                legacy_id = data.get("request_id") or data.get("id") or event_id
                if legacy_id:
                    self.ack_manager.handle_ack(client_id, str(legacy_id))

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
        idempotency_key = data.get("idempotency_key")
        if idempotency_key is not None:
            idempotency_key = str(idempotency_key).strip() or None

        deadline_at = data.get("deadline_at")
        if deadline_at is not None:
            try:
                if time.time() > float(deadline_at):
                    await self._send_request_error(
                        client_id,
                        route,
                        request_id,
                        ERROR_CODES["TIMEOUT"],
                        "Request deadline exceeded",
                    )
                    return
            except (TypeError, ValueError):
                pass

        if idempotency_key:
            cached = await asyncio.to_thread(
                _STATE_REPO.get_command_idempotency,
                client_id,
                route,
                idempotency_key,
            )
            if cached and cached.get("status") == "completed" and cached.get("response_json"):
                await self.client_registry.send_to_client(
                    client_id, cached["response_json"]
                )
                return
            if cached and cached.get("status") == "pending":
                await self.client_registry.send_to_client(
                    client_id,
                    {
                        "type": MSG_TYPES["EVENT"],
                        "route": "request_processing",
                        "event": "request_processing",
                        "id": request_id,
                        "request_id": request_id,
                        "data": {"status": "pending", "idempotent": True},
                    },
                )
                return
            await asyncio.to_thread(
                _STATE_REPO.save_command_idempotency_pending,
                client_id,
                route,
                idempotency_key,
                request_id,
            )

        is_sync = self.routes_manager.is_sync_route(route)

        if is_sync:
            await self._handle_sync_request(
                client_id=client_id,
                websocket=websocket,
                route=route,
                params=params,
                request_id=request_id,
                idempotency_key=idempotency_key,
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
                    "request_id": request_id,
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
                notify_callback=self._wrap_idempotent_notify(
                    client_id, route, idempotency_key, request_id
                ),
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
        idempotency_key: Optional[str] = None,
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
                "request_id": request_id,
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
        if idempotency_key:
            response_envelope = {
                "type": MSG_TYPES["RESPONSE"],
                "route": route,
                "request_id": request_id,
                "id": request_id,
                "result": result,
                "error": error,
                "success": error is None,
                "sync_response": True,
            }
            await asyncio.to_thread(
                _STATE_REPO.save_command_idempotency_response,
                client_id,
                route,
                idempotency_key,
                response_envelope,
                "completed" if error is None else "failed",
                {"message": error} if error else None,
            )

    def _wrap_idempotent_notify(
        self,
        client_id: str,
        route: str,
        idempotency_key: Optional[str],
        request_id: str,
    ):
        base_notify = self.ack_manager.notify_websocket_with_retry

        async def _notify(
            notify_client_id: str,
            notify_request_id: str,
            result: Any,
            error: Optional[str],
        ) -> None:
            if idempotency_key:
                envelope = {
                    "type": MSG_TYPES["RESPONSE"],
                    "route": route,
                    "request_id": notify_request_id,
                    "id": notify_request_id,
                    "result": result,
                    "error": error,
                    "success": error is None,
                    "requires_ack": True,
                }
                await asyncio.to_thread(
                    _STATE_REPO.save_command_idempotency_response,
                    client_id,
                    route,
                    idempotency_key,
                    envelope,
                    "completed" if error is None else "failed",
                    {"message": error} if error else None,
                )
            if asyncio.iscoroutinefunction(base_notify):
                await base_notify(notify_client_id, notify_request_id, result, error)
            else:
                base_notify(notify_client_id, notify_request_id, result, error)

        return _notify

    async def _send_request_error(
        self,
        client_id: str,
        route: Optional[str],
        request_id: str,
        error_code: str,
        message: str,
    ) -> None:
        await self.client_registry.send_to_client(
            client_id,
            {
                "type": MSG_TYPES["ERROR"],
                "route": route,
                "request_id": request_id,
                "id": request_id,
                "error": error_code,
                "message": message,
                "success": False,
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

    def _deliver_durable_events(self, client_id: str, after_seq: int = 0) -> None:
        """Replay durable server_event deliveries after reconnect (paged)."""
        delivery = get_rpc_delivery_service()
        offset = max(int(after_seq or 0), delivery.get_client_offset(client_id))
        while True:
            frames = delivery.replay_unacked(client_id, after_seq=offset, limit=100)
            if not frames:
                break
            for frame in frames:
                asyncio.create_task(self.client_registry.send_to_client(client_id, frame))
            if len(frames) < 100:
                break
            offset = int(frames[-1].get("seq") or offset)

    async def _replay_client_notifications(self, client_id: str, limit: int = 10) -> None:
        """Schedule durable completion delivery for a connected client."""
        pending_events, inventory_items = await self._load_client_notifications(
            client_id, limit=limit
        )
        self._deliver_client_notifications(client_id, pending_events, inventory_items)


__all__ = ["WebSocketRPCHandler"]
