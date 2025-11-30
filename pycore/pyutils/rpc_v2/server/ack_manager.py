#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FastAPI-friendly ACK manager.

Handles delivery retries, ACK tracking, and inventory fallback for the
FastAPI RPC server. This replaces the aiohttp-specific implementation.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_fastapi

fastapi = get_third_package_fastapi()
JSONResponse = fastapi.responses.JSONResponse

from pycore.pyutils.rpc_v2.config import RPC_CONSTANTS
from pycore.pyutils.rpc_v2.common import (
    RequestEvent,
    RequestEventTable,
    RequestStatus,
    InventoryTable,
)
from pycore.pyutils.rpc_v2.server.client_registry import ClientRegistry

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES


class FastAPIAckManager:
    """Manage ACK lifecycle for HTTP + WebSocket transports."""

    def __init__(
        self,
        request_event_table: RequestEventTable,
        inventory_table: InventoryTable,
        client_registry: ClientRegistry,
        debug: bool = True,
    ):
        self.request_event_table = request_event_table
        self.inventory_table = inventory_table
        self.client_registry = client_registry
        self.debug = debug
        self.ack_timeout = 5.0
        if self.debug:
            ColorPrint.green(f"[FastAPIAckManager] Initialized (ack_timeout={self.ack_timeout}s)")

    def notify_websocket_with_retry(
        self,
        client_id: str,
        request_id: str,
        result: Any,
        error: Optional[str],
    ):
        """
        Schedule websocket delivery with retry + ACK tracking without blocking awaits.
        """

        event = self.request_event_table.get_event(request_id)
        if not event:
            return

        self._schedule_ws_attempt(
            client_id=client_id,
            request_id=request_id,
            result=result,
            error=error,
            attempt=0,
            max_attempts=event.max_retries,
            retry_interval=event.retry_interval,
        )

    def _schedule_ws_attempt(
        self,
        client_id: str,
        request_id: str,
        result: Any,
        error: Optional[str],
        attempt: int,
        max_attempts: int,
        retry_interval: float,
        delay: float = 0.0,
    ):
        loop = asyncio.get_running_loop()

        def runner():
            asyncio.create_task(
                self._send_websocket_notification(
                    client_id=client_id,
                    request_id=request_id,
                    result=result,
                    error=error,
                    attempt=attempt,
                    max_attempts=max_attempts,
                    retry_interval=retry_interval,
                )
            )

        if delay <= 0:
            loop.call_soon(runner)
        else:
            loop.call_later(delay, runner)

    async def _send_websocket_notification(
        self,
        client_id: str,
        request_id: str,
        result: Any,
        error: Optional[str],
        attempt: int,
        max_attempts: int,
        retry_interval: float,
    ):
        """Attempt to deliver a websocket notification."""
        event = self.request_event_table.get_event(request_id)
        if not event:
            return

        payload = {
            "type": MSG_TYPES["RESPONSE"],
            "route": event.route if event else None,
            "id": request_id,
            "result": result,
            "error": error,
            "success": error is None,
            "requires_ack": True,
            "queue": None,
        }

        success = await self.client_registry.safe_send(client_id, payload)
        if success:
            self.request_event_table.update_status(request_id, RequestStatus.ACK_PENDING)
            self.request_event_table.increment_notify_attempt(request_id)
            self._schedule_ack_timeout(
                client_id=client_id,
                request_id=request_id,
                attempt=attempt,
                max_attempts=max_attempts,
                retry_interval=retry_interval,
                result=result,
                error=error,
            )
            if self.debug:
                ColorPrint.green(
                    f"[FastAPIAckManager] Sent WS result for {request_id} to {client_id[:8]}..., waiting for ACK"
                )
            return

        if attempt + 1 >= max_attempts:
            self._store_in_inventory(client_id, request_id, result, error, event)
            return

        if self.debug:
            ColorPrint.yellow(
                f"[FastAPIAckManager] WS send failed for {request_id} (attempt {attempt + 1}/{max_attempts}), retrying..."
            )

        self._schedule_ws_attempt(
            client_id=client_id,
            request_id=request_id,
            result=result,
            error=error,
            attempt=attempt + 1,
            max_attempts=max_attempts,
            retry_interval=retry_interval,
            delay=retry_interval,
        )

    def _schedule_ack_timeout(
        self,
        client_id: str,
        request_id: str,
        attempt: int,
        max_attempts: int,
        retry_interval: float,
        result: Any,
        error: Optional[str],
    ):
        loop = asyncio.get_running_loop()

        def runner():
            asyncio.create_task(
                self._check_websocket_ack_timeout(
                    client_id=client_id,
                    request_id=request_id,
                    attempt=attempt,
                    max_attempts=max_attempts,
                    retry_interval=retry_interval,
                    result=result,
                    error=error,
                )
            )

        loop.call_later(self.ack_timeout, runner)

    async def _check_websocket_ack_timeout(
        self,
        client_id: str,
        request_id: str,
        attempt: int,
        max_attempts: int,
        retry_interval: float,
        result: Any,
        error: Optional[str],
    ):
        """Retry delivery when ACK is not received before the timeout."""
        event = self.request_event_table.get_event(request_id)
        if not event or event.status != RequestStatus.ACK_PENDING:
            return

        if self.debug:
            ColorPrint.yellow(f"[FastAPIAckManager] ACK timeout for {request_id}, retrying delivery")

        self._schedule_ws_attempt(
            client_id=client_id,
            request_id=request_id,
            result=result,
            error=error,
            attempt=attempt + 1,
            max_attempts=max_attempts,
            retry_interval=retry_interval,
            delay=retry_interval,
        )

    def handle_ack(self, client_id: str, request_id: str):
        """Mark ACK as received."""
        event = self.request_event_table.get_event(request_id)
        if not event:
            return

        if event.status == RequestStatus.ACK_PENDING:
            self.request_event_table.update_status(request_id, RequestStatus.ACK_RECEIVED)
            self.request_event_table.mark_notified(request_id)
            if self.debug:
                ColorPrint.green(
                    f"[FastAPIAckManager] ACK received for {request_id} from {client_id[:8]}..."
                )
        elif self.debug:
            ColorPrint.yellow(
                f"[FastAPIAckManager] Unexpected ACK for {request_id} with status {event.status.value}"
            )

    def prepare_http_response_with_ack(
        self,
        request_id: str,
        data: Dict[str, Any],
        status_code: int = 200,
        event: Optional[RequestEvent] = None,
    ) -> JSONResponse:
        """Return HTTP response payload with ACK tracking semantics."""
        payload = dict(data)
        payload.setdefault("type", MSG_TYPES["RESPONSE"])
        payload.setdefault("queue", None)
        payload["requires_ack"] = True

        target_event = event or self.request_event_table.get_event(request_id)
        if target_event:
            self.request_event_table.update_status(request_id, RequestStatus.ACK_PENDING)
            self._schedule_http_ack_confirmation(request_id)

        return JSONResponse(content=payload, status_code=status_code)

    def _schedule_http_ack_confirmation(self, request_id: str):
        loop = asyncio.get_running_loop()

        async def confirmer():
            event = self.request_event_table.get_event(request_id)
            if not event or event.status != RequestStatus.ACK_PENDING:
                return
            self.request_event_table.update_status(request_id, RequestStatus.ACK_RECEIVED)
            self.request_event_table.mark_notified(request_id)
            if self.debug:
                ColorPrint.blue(f"[FastAPIAckManager] HTTP ACK confirmed for {request_id}")

        loop.call_later(self.ack_timeout, lambda: asyncio.create_task(confirmer()))

    def _store_in_inventory(
        self,
        client_id: str,
        request_id: str,
        result: Any,
        error: Optional[str],
        event: RequestEvent,
    ):
        """Persist response for later retrieval."""
        self.inventory_table.store(
            request_id=request_id,
            route=event.route,
            result=result,
            client_id=client_id,
            client_type=event.client_type,
            error=error,
        )
        self.request_event_table.mark_stored(request_id)
        if self.debug:
            ColorPrint.yellow(f"[FastAPIAckManager] Stored result of {request_id} in inventory")
