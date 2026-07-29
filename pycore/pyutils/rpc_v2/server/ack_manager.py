#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FastAPI-friendly ACK manager.

Handles delivery retries, ACK tracking, and inventory fallback for the
FastAPI RPC server. This replaces the aiohttp-specific implementation.

Durable-completion invariant: inventory rows are ONLY removed after a
matching client ACK. On reconnect / replay, `notify_websocket_with_retry`
constructs a shim event from the inventory row and drives the same retry
+ ACK-wait state machine as a live completion — sending the frame is not
the same as receiving the ACK.

Threading contract (RPC v2 desktop UI standard §6): every method that runs
on the uvicorn event loop is a coroutine, and every @serialized_method table
call goes through `await_serialized` so the loop NEVER blocks on the table
owner threads. Sync entry points would freeze the whole RPC layer (every
route times out together) the moment a table owner is busy.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_fastapi

fastapi = get_third_package_fastapi()
JSONResponse = fastapi.responses.JSONResponse

from pycore.pyutils.rpc_v2.config.rpc_constants import RPC_CONSTANTS
from pycore.pyutils.rpc_v2.common.request_event_table import RequestEvent, RequestEventTable, RequestStatus
from pycore.pyutils.rpc_v2.common.inventory_table import InventoryTable
from pycore.pyutils.rpc_v2.constants import (
    DEFAULT_ACK_MAX_RETRIES,
    DEFAULT_ACK_RETRY_INTERVAL,
)
from pycore.pyutils.rpc_v2.server.client_registry import ClientRegistry
from pycore.pyutils.rpc_v2.server._serialized_bridge import await_serialized

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES


@dataclass
class _RetryPlan:
    """Retry policy pulled from either a RequestEvent or the fallback defaults."""

    max_retries: int
    retry_interval: float
    route: str
    client_type: str


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
        # Track inventory-only deliveries awaiting an ACK. Keyed on
        # (client_id, request_id). Present entry = waiting for ACK.
        self._pending_inventory_acks: Dict[tuple, _RetryPlan] = {}
        if self.debug:
            ColorPrint.green(f"[FastAPIAckManager] Initialized (ack_timeout={self.ack_timeout}s)")

    async def notify_websocket_with_retry(
        self,
        client_id: str,
        request_id: str,
        result: Any,
        error: Optional[str],
    ):
        """
        Schedule websocket delivery with retry + ACK tracking without blocking awaits.

        Coroutine: callers either await it (idempotent notify wrapper) or schedule
        it with asyncio.create_task (fire-and-forget delivery). Table lookups go
        through await_serialized so the event loop never blocks.

        When only an inventory row exists (event has expired but the durable
        completion is still queued for delivery), the row IS NOT deleted here.
        We build a shim retry plan and drive the same send + ACK-wait loop
        as a live completion. Inventory removal happens only in `handle_ack`
        after the client confirms receipt.
        """

        event = await await_serialized(self.request_event_table.get_event, request_id)
        inventory_item = None
        plan: Optional[_RetryPlan] = None

        if event:
            plan = _RetryPlan(
                max_retries=event.max_retries,
                retry_interval=event.retry_interval,
                route=event.route,
                client_type=event.client_type,
            )
        else:
            # No event → fall back to inventory-only delivery.
            inventory_item = await await_serialized(
                self.inventory_table.get, request_id, remove=False
            )
            if inventory_item is None:
                # Nothing to deliver.
                return
            if inventory_item.client_id and inventory_item.client_id != client_id:
                if self.debug:
                    ColorPrint.yellow(
                        f"[FastAPIAckManager] Inventory {request_id} belongs to a different client, skipping"
                    )
                return
            plan = _RetryPlan(
                max_retries=DEFAULT_ACK_MAX_RETRIES,
                retry_interval=DEFAULT_ACK_RETRY_INTERVAL,
                route=inventory_item.route,
                client_type=inventory_item.client_type,
            )
            # Record that we're waiting on this ACK; handle_ack will consult
            # this map to decide whether to delete the inventory row.
            self._pending_inventory_acks[(client_id, request_id)] = plan

        self._schedule_ws_attempt(
            client_id=client_id,
            request_id=request_id,
            result=result,
            error=error,
            attempt=0,
            plan=plan,
        )

    def _schedule_ws_attempt(
        self,
        client_id: str,
        request_id: str,
        result: Any,
        error: Optional[str],
        attempt: int,
        plan: _RetryPlan,
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
                    plan=plan,
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
        plan: _RetryPlan,
    ):
        """Attempt to deliver a websocket notification.

        Never deletes inventory as a side-effect: only a matching client
        ACK removes it (see `handle_ack`).
        """
        event = await await_serialized(self.request_event_table.get_event, request_id)
        inventory_only = event is None

        if inventory_only:
            # Re-check inventory still exists — a race where it was removed
            # via cleanup / concurrent ACK should stop the loop.
            item = await await_serialized(
                self.inventory_table.get, request_id, remove=False
            )
            if item is None:
                self._pending_inventory_acks.pop((client_id, request_id), None)
                return

        payload = {
            "type": MSG_TYPES["RESPONSE"],
            "route": plan.route,
            "id": request_id,
            "event_id": request_id,
            "client_id": client_id,
            "result": result,
            "error": error,
            "success": error is None,
            "requires_ack": True,
            "queue": None,
            "from_inventory": inventory_only,
        }

        success = await self.client_registry.safe_send(client_id, payload)
        if success:
            if not inventory_only:
                await await_serialized(
                    self.request_event_table.update_status, request_id, RequestStatus.ACK_PENDING
                )
                await await_serialized(
                    self.request_event_table.increment_notify_attempt, request_id
                )
            self._schedule_ack_timeout(
                client_id=client_id,
                request_id=request_id,
                attempt=attempt,
                plan=plan,
                result=result,
                error=error,
                inventory_only=inventory_only,
            )
            if self.debug:
                origin = "inventory replay" if inventory_only else "live"
                ColorPrint.green(
                    f"[FastAPIAckManager] Sent WS result ({origin}) for {request_id} to {client_id[:8]}..., waiting for ACK"
                )
            return

        if attempt + 1 >= plan.max_retries:
            if not inventory_only:
                await self._store_in_inventory(client_id, request_id, result, error, event)
            elif self.debug:
                # Inventory is already the source of truth; keep it and drop the retry.
                ColorPrint.yellow(
                    f"[FastAPIAckManager] Gave up inventory-only delivery of {request_id} to {client_id[:8]}..."
                )
                self._pending_inventory_acks.pop((client_id, request_id), None)
            return

        if self.debug:
            ColorPrint.yellow(
                f"[FastAPIAckManager] WS send failed for {request_id} (attempt {attempt + 1}/{plan.max_retries}), retrying..."
            )

        self._schedule_ws_attempt(
            client_id=client_id,
            request_id=request_id,
            result=result,
            error=error,
            attempt=attempt + 1,
            plan=plan,
            delay=plan.retry_interval,
        )

    def _schedule_ack_timeout(
        self,
        client_id: str,
        request_id: str,
        attempt: int,
        plan: _RetryPlan,
        result: Any,
        error: Optional[str],
        inventory_only: bool,
    ):
        loop = asyncio.get_running_loop()

        def runner():
            asyncio.create_task(
                self._check_websocket_ack_timeout(
                    client_id=client_id,
                    request_id=request_id,
                    attempt=attempt,
                    plan=plan,
                    result=result,
                    error=error,
                    inventory_only=inventory_only,
                )
            )

        loop.call_later(self.ack_timeout, runner)

    async def _check_websocket_ack_timeout(
        self,
        client_id: str,
        request_id: str,
        attempt: int,
        plan: _RetryPlan,
        result: Any,
        error: Optional[str],
        inventory_only: bool,
    ):
        """Retry delivery when ACK is not received before the timeout."""
        if inventory_only:
            # If handle_ack already fired, the pending marker is gone.
            if (client_id, request_id) not in self._pending_inventory_acks:
                return
            # Inventory might have been cleaned up externally.
            item = await await_serialized(
                self.inventory_table.get, request_id, remove=False
            )
            if item is None:
                self._pending_inventory_acks.pop((client_id, request_id), None)
                return
        else:
            event = await await_serialized(self.request_event_table.get_event, request_id)
            if not event or event.status != RequestStatus.ACK_PENDING:
                return

        if self.debug:
            ColorPrint.yellow(f"[FastAPIAckManager] ACK timeout for {request_id}, retrying delivery")

        if attempt + 1 >= plan.max_retries:
            if not inventory_only:
                event = await await_serialized(self.request_event_table.get_event, request_id)
                if event:
                    await self._store_in_inventory(client_id, request_id, result, error, event)
            else:
                # Give up but keep inventory intact so a future reconnect
                # can try again.
                self._pending_inventory_acks.pop((client_id, request_id), None)
            return

        self._schedule_ws_attempt(
            client_id=client_id,
            request_id=request_id,
            result=result,
            error=error,
            attempt=attempt + 1,
            plan=plan,
            delay=plan.retry_interval,
        )

    async def handle_ack(self, client_id: str, request_id: str):
        """Mark ACK as received.

        Handles two cases:
          - live event exists → transition ACK_RECEIVED, mark notified, drop inventory.
          - only inventory exists (event expired) → validate client_id owns
            the inventory row, then delete it.
        """
        event = await await_serialized(self.request_event_table.get_event, request_id)

        if event is None:
            inventory_item = await await_serialized(
                self.inventory_table.get, request_id, remove=False
            )
            if inventory_item is None:
                return
            if inventory_item.client_id and inventory_item.client_id != client_id:
                if self.debug:
                    ColorPrint.yellow(
                        f"[FastAPIAckManager] Ignored inventory ACK for {request_id} from wrong client {client_id[:8]}..."
                    )
                return
            await await_serialized(self.inventory_table.delete, request_id)
            self._pending_inventory_acks.pop((client_id, request_id), None)
            if self.debug:
                ColorPrint.green(
                    f"[FastAPIAckManager] Inventory ACK received for {request_id} from {client_id[:8]}..."
                )
            return

        if event.client_id and event.client_id != client_id:
            if self.debug:
                ColorPrint.yellow(
                    f"[FastAPIAckManager] Ignored ACK for {request_id} from wrong client {client_id[:8]}..."
                )
            return

        if event.status == RequestStatus.ACK_PENDING:
            await await_serialized(
                self.request_event_table.update_status, request_id, RequestStatus.ACK_RECEIVED
            )
            await await_serialized(self.request_event_table.mark_notified, request_id)
            await await_serialized(self.inventory_table.delete, request_id)
            self._pending_inventory_acks.pop((client_id, request_id), None)
            if self.debug:
                ColorPrint.green(
                    f"[FastAPIAckManager] ACK received for {request_id} from {client_id[:8]}..."
                )
        elif self.debug:
            ColorPrint.yellow(
                f"[FastAPIAckManager] Unexpected ACK for {request_id} with status {event.status.value}"
            )

    async def prepare_http_response_with_ack(
        self,
        request_id: str,
        data: Dict[str, Any],
        status_code: int = 200,
        event: Optional[RequestEvent] = None,
    ) -> JSONResponse:
        """Return HTTP response payload with ACK tracking semantics.

        Coroutine: runs on the uvicorn loop (table calls via await_serialized),
        so `_schedule_http_ack_confirmation` always has a running loop. The old
        sync version was wrapped in await_serialized by the HTTP handler, which
        executed it on a bridge pool thread where asyncio.get_running_loop()
        raises — every async HTTP route answered 500.
        """
        payload = dict(data)
        payload.setdefault("type", MSG_TYPES["RESPONSE"])
        payload.setdefault("queue", None)
        payload["requires_ack"] = True

        target_event = event or await await_serialized(
            self.request_event_table.get_event, request_id
        )
        if target_event:
            await await_serialized(
                self.request_event_table.update_status, request_id, RequestStatus.ACK_PENDING
            )
            self._schedule_http_ack_confirmation(request_id)

        return JSONResponse(content=payload, status_code=status_code)

    def _schedule_http_ack_confirmation(self, request_id: str):
        loop = asyncio.get_running_loop()

        async def confirmer():
            event = await await_serialized(self.request_event_table.get_event, request_id)
            if not event or event.status != RequestStatus.ACK_PENDING:
                return
            await await_serialized(
                self.request_event_table.update_status, request_id, RequestStatus.ACK_RECEIVED
            )
            await await_serialized(self.request_event_table.mark_notified, request_id)
            if self.debug:
                ColorPrint.blue(f"[FastAPIAckManager] HTTP ACK confirmed for {request_id}")

        loop.call_later(self.ack_timeout, lambda: asyncio.create_task(confirmer()))

    async def _store_in_inventory(
        self,
        client_id: str,
        request_id: str,
        result: Any,
        error: Optional[str],
        event: RequestEvent,
    ):
        """Persist response for later retrieval."""
        await await_serialized(
            self.inventory_table.store,
            request_id=request_id,
            route=event.route,
            result=result,
            client_id=client_id,
            client_type=event.client_type,
            error=error,
        )
        await await_serialized(self.request_event_table.mark_stored, request_id)
        if self.debug:
            ColorPrint.yellow(f"[FastAPIAckManager] Stored result of {request_id} in inventory")
