#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTTP RPC handler for the FastAPI RPC server.

Processes POST /rpc + /rpc/{route_name} and the GET /rpc/query/{id} polling
endpoint. Mirrors the legacy HttpHandler flow on top of the shared
event/inventory tables + ACK manager. Constructed with injected tables/managers
+ debug (same pattern as ack_manager / request_processor / routes_manager).
"""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Dict, Optional

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_fastapi

fastapi = get_third_package_fastapi()
Request = fastapi.Request
JSONResponse = fastapi.responses.JSONResponse
status = fastapi.status

from pycore.pyutils.rpc_v2.config import RPC_CONSTANTS
from pycore.pyutils.rpc_v2.common import (
    InventoryTable,
    RequestEventTable,
    RequestStatus,
    RPCRequestContext,
)
from pycore.pyutils.rpc_v2.server.ack_manager import FastAPIAckManager
from pycore.pyutils.rpc_v2.server.routes_manager import RoutesManager
from pycore.pyutils.rpc_v2.server.request_processor import RequestProcessor

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES
ERROR_CODES = RPC_CONSTANTS.ERROR_CODES


class HttpRPCHandler:
    """Handle HTTP RPC requests (POST /rpc, /rpc/{route}) + result polling."""

    def __init__(
        self,
        request_event_table: RequestEventTable,
        inventory_table: InventoryTable,
        routes_manager: RoutesManager,
        request_processor: RequestProcessor,
        ack_manager: FastAPIAckManager,
        debug: bool = False,
    ):
        self.request_event_table = request_event_table
        self.inventory_table = inventory_table
        self.routes_manager = routes_manager
        self.request_processor = request_processor
        self.ack_manager = ack_manager
        self.debug = debug

    async def handle_http_rpc(
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

        # Compute the request id up front so every error branch below can reference
        # it (previously the route-not-specified / route-not-found branches read
        # `request_id` before it was assigned, raising NameError instead of a clean
        # 400/404 JSON error).
        request_id = data.get("id") or data.get("request_id") or self._generate_request_id()

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

        if "params" in data:
            # Support both 'data' (RPC v2 format) and 'params' (legacy) fields
            params = data.get("data") or data.get("params", {})
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

        # Check if route is synchronous (immediate response)
        is_sync = self.routes_manager.is_sync_route(route)

        event = self.request_event_table.create_event(
            request_id=request_id,
            route=route,
            params=params,
            client_id=session_id,
            client_type="http",
        )

        if is_sync:
            # Synchronous route: await processing and return immediately
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

                # Return result immediately (no requires_ack)
                return JSONResponse(
                    {
                        "type": MSG_TYPES["RESPONSE"],
                        "route": route,
                        "id": request_id,
                        "result": event.result,
                        "error": event.error,
                        "success": event.error is None,
                        "sync_response": True,  # Mark as sync response
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
            # Asynchronous route: use ACK mechanism (original behavior)
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

    async def handle_query_result(self, request_id: str) -> JSONResponse:
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

    @staticmethod
    def _generate_request_id() -> str:
        return str(uuid.uuid4())


__all__ = ["HttpRPCHandler"]
