#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ACK Manager - Manages acknowledgment (ACK) mechanism

Handles ACK confirmation for both HTTP and WebSocket protocols.
No blocking await - uses event table status tracking.
"""

import asyncio
import time
from typing import Dict, Optional, Any

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_aiohttp

aiohttp = get_third_package_aiohttp()

web = aiohttp.web

from pycore.pyutils.rpc.config.constants import RPC_CONSTANTS
from pycore.pyutils.rpc.common.task_table import RequestEventTable, RequestEvent, RequestStatus
from pycore.pyutils.rpc.common.inventory_table import InventoryTable

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES
ERROR_CODES = RPC_CONSTANTS.ERROR_CODES


class AckManager:
    """
    ACK Manager - Manages acknowledgment mechanism

    Development Guidelines:
    - After sending event/response, wait for client ACK confirmation
    - Only mark as notified after receiving ACK
    - HTTP: Use status code 200 to confirm receipt
    - WebSocket: Use ACK message type to confirm receipt
    - No blocking await: Use event table status tracking
    - ACK timeout: If no ACK received, retry or store in inventory
    """

    def __init__(
        self,
        request_event_table: RequestEventTable,
        inventory_table: InventoryTable,
        client_manager: Any,  # ✅ Pass ClientManager instead of static dict
        debug: bool = True
    ):
        """
        Initialize ACK Manager

        Args:
            request_event_table: Request event table
            inventory_table: Inventory table
            client_manager: ClientManager instance (provides ws_clients dynamically)
            debug: Enable debug logging
        """
        self.request_event_table = request_event_table
        self.inventory_table = inventory_table
        self.client_manager = client_manager  # ✅ Store ClientManager reference
        self.debug = debug
        self.ack_timeout = 5.0  # 5 seconds timeout for ACK

        if self.debug:
            ColorPrint.green(f"[AckManager] Initialized with ack_timeout={self.ack_timeout}s")

    def notify_websocket_with_retry(
        self,
        client_id: str,
        request_id: str,
        result: Any,
        error: Optional[str]
    ):
        """
        Notify WebSocket client with retry and ACK mechanism (NON-BLOCKING)

        Development Guidelines:
        - Send response to client with requires_ack flag
        - Update event status to ACK_PENDING (waiting for ACK)
        - ✅ NO blocking await: Use event table status tracking + call_later
        - Retry if no ACK received (3 times, 3 second interval)
        - Only mark as ACK_RECEIVED after client sends ACK
        - If all retries fail: store in inventory table

        Args:
            client_id: Client ID
            request_id: Request ID
            result: Result data
            error: Error message if failed
        """
        event = self.request_event_table.get_event(request_id)
        if not event:
            return

        max_retries = event.max_retries
        retry_interval = event.retry_interval

        # ✅ NON-BLOCKING: Use recursive scheduling instead of await loop
        def schedule_attempt(attempt: int):
            """Schedule notification attempt (non-blocking)"""
            if attempt >= max_retries:
                # All retries exhausted, store in inventory
                self.inventory_table.store(
                    request_id=request_id,
                    route=event.route,
                    result=result,
                    client_id=client_id,
                    client_type='websocket',
                    error=error
                )
                self.request_event_table.mark_stored(request_id)
                if self.debug:
                    ColorPrint.blue(f"[AckManager] Stored result in inventory for request {request_id} after {max_retries} failed notification attempts")
                return

            # Create async task for this attempt
            asyncio.create_task(self._send_notification_attempt(
                client_id=client_id,
                request_id=request_id,
                result=result,
                error=error,
                attempt=attempt,
                max_retries=max_retries,
                retry_interval=retry_interval,
                schedule_next=lambda: asyncio.get_event_loop().call_later(
                    retry_interval,
                    lambda: schedule_attempt(attempt + 1)
                )
            ))

        # Start first attempt immediately
        schedule_attempt(0)

    async def _send_notification_attempt(
        self,
        client_id: str,
        request_id: str,
        result: Any,
        error: Optional[str],
        attempt: int,
        max_retries: int,
        retry_interval: float,
        schedule_next
    ):
        """
        Send single notification attempt (async but non-blocking)

        Uses callback for scheduling next retry instead of await sleep
        """
        try:
            # ✅ Use ClientManager public method instead of direct dict access
            message = {
                'type': MSG_TYPES['RESPONSE'],
                'id': request_id,
                'success': error is None,
                'status': 'completed' if error is None else 'failed',
                'result': result,
                'error': error,
                'requires_ack': True,  # Request ACK confirmation
                'timestamp': int(time.time() * 1000),
                'queue': None
            }

            # ✅ Use ClientManager.safe_send() - handles all connection checks
            success = await self.client_manager.safe_send(
                client_id=client_id,
                message=message,
                queue_if_disconnected=(attempt < max_retries - 1)  # Queue on retry
            )

            if not success:
                # Send failed, check if should retry or store
                if attempt < max_retries - 1:
                    # Schedule next retry (non-blocking)
                    if self.debug:
                        ColorPrint.yellow(f"[AckManager] Send failed for client {client_id[:8]}..., will retry (attempt {attempt + 1}/{max_retries})")
                    schedule_next()
                else:
                    # Last attempt failed, store in inventory
                    event = self.request_event_table.get_event(request_id)
                    if event:
                        self.inventory_table.store(
                            request_id=request_id,
                            route=event.route,
                            result=result,
                            client_id=client_id,
                            client_type='websocket',
                            error=error
                        )
                        self.request_event_table.mark_stored(request_id)
                        if self.debug:
                            ColorPrint.blue(f"[AckManager] Stored result in inventory for request {request_id[:12]}... (route: {event.route})")
                return

            # Update status to ACK_PENDING (waiting for client ACK)
            self.request_event_table.update_status(request_id, RequestStatus.ACK_PENDING)
            self.request_event_table.increment_notify_attempt(request_id)

            if self.debug:
                ColorPrint.green(f"[AckManager] Sent response to WebSocket client {client_id} for request {request_id}, waiting for ACK")

            # Start ACK timeout check (non-blocking)
            event = self.request_event_table.get_event(request_id)
            if event:
                asyncio.create_task(self._check_ack_timeout(request_id, client_id, event, result, error))

        except Exception as e:
            if self.debug:
                ColorPrint.yellow(f"[AckManager] Notification attempt {attempt + 1}/{max_retries} failed: {e}")

            if attempt < max_retries - 1:
                # Schedule next retry (non-blocking)
                schedule_next()
            else:
                # Last attempt failed, store in inventory
                event = self.request_event_table.get_event(request_id)
                if event:
                    self.inventory_table.store(
                        request_id=request_id,
                        route=event.route,
                        result=result,
                        client_id=client_id,
                        client_type='websocket',
                        error=error
                    )
                    self.request_event_table.mark_stored(request_id)
                    if self.debug:
                        ColorPrint.blue(f"[AckManager] Stored result in inventory for request {request_id}")
    
    async def _check_ack_timeout(
        self,
        request_id: str,
        client_id: str,
        event: RequestEvent,
        result: Any,
        error: Optional[str]
    ):
        """
        Check ACK timeout (non-blocking)

        ✅ Non-blocking implementation using call_later instead of await sleep
        If no ACK received within timeout, retry or store in inventory
        """
        # ✅ Non-blocking: Use call_later to schedule timeout check
        asyncio.get_event_loop().call_later(
            self.ack_timeout,
            lambda: asyncio.create_task(self._handle_ack_timeout(
                request_id, client_id, result, error
            ))
        )

    async def _handle_ack_timeout(
        self,
        request_id: str,
        client_id: str,
        result: Any,
        error: Optional[str]
    ):
        """
        Handle ACK timeout event (called by call_later)
        """
        # Check if ACK was received (status changed from ACK_PENDING)
        current_event = self.request_event_table.get_event(request_id)
        if current_event and current_event.status == RequestStatus.ACK_PENDING:
            # ACK not received, retry or store
            if self.debug:
                ColorPrint.yellow(f"[AckManager] ACK timeout for request {request_id}, retrying...")

            # Retry notification
            self.notify_websocket_with_retry(
                client_id=client_id,
                request_id=request_id,
                result=result,
                error=error
            )
    
    def handle_ack(self, client_id: str, request_id: str):
        """
        Handle ACK (acknowledgment) from client
        
        Development Guidelines:
        - Client sends ACK message with request_id
        - Lookup event in event table by request_id
        - Update status to ACK_RECEIVED
        - Mark as successfully notified
        
        Args:
            client_id: Client ID
            request_id: Request ID
        """
        event = self.request_event_table.get_event(request_id)
        if event:
            if event.status == RequestStatus.ACK_PENDING:
                # ACK received, mark as confirmed
                self.request_event_table.update_status(request_id, RequestStatus.ACK_RECEIVED)
                self.request_event_table.mark_notified(request_id)
                
                if self.debug:
                    ColorPrint.green(f"[AckManager] ACK received from client {client_id} for request {request_id}")
            else:
                if self.debug:
                    ColorPrint.yellow(f"[AckManager] Unexpected ACK for request {request_id} with status {event.status}")
    
    def prepare_http_response_with_ack(
        self,
        request_id: str,
        data: Dict[str, Any],
        status_code: int = 200,
        event: Optional[RequestEvent] = None
    ) -> web.Response:
        """
        Prepare HTTP response with ACK mechanism
        
        Development Guidelines:
        - Return result with requires_ack flag
        - HTTP status 200 = ACK received (client confirms receipt by receiving 200)
        - Update status to ACK_PENDING
        - Start ACK timeout check (non-blocking)
        
        Args:
            request_id: Request ID
            data: Response data
            status_code: HTTP status code
            event: Optional event object
            
        Returns:
            HTTP response with ACK mechanism
        """
        # Add requires_ack flag
        data['requires_ack'] = True
        
        # Create response
        response = web.json_response(data, status=status_code)
        
        # Update event status to ACK_PENDING (waiting for HTTP 200 confirmation)
        if event:
            self.request_event_table.update_status(request_id, RequestStatus.ACK_PENDING)
        else:
            event = self.request_event_table.get_event(request_id)
            if event:
                self.request_event_table.update_status(request_id, RequestStatus.ACK_PENDING)
        
        # HTTP status 200 = ACK received (client confirms receipt by receiving 200)
        # Start ACK timeout check (non-blocking)
        if event:
            asyncio.create_task(self._check_http_ack_timeout(request_id, event))
        
        return response
    
    async def _check_http_ack_timeout(self, request_id: str, event: RequestEvent):
        """
        Check HTTP ACK timeout (non-blocking)

        ✅ Non-blocking implementation using call_later instead of await sleep

        Development Guidelines:
        - HTTP ACK is confirmed by status 200 response
        - Client receives HTTP 200 = ACK confirmed
        - If timeout and still ACK_PENDING, mark as ACK_RECEIVED (HTTP 200 was sent)
        - HTTP protocol: status 200 = ACK received (client confirms receipt by receiving 200)
        """
        # ✅ Non-blocking: Use call_later to schedule timeout check
        asyncio.get_event_loop().call_later(
            self.ack_timeout,
            lambda: self._handle_http_ack_timeout(request_id)
        )

    def _handle_http_ack_timeout(self, request_id: str):
        """
        Handle HTTP ACK timeout event (called by call_later)
        """
        # Check if ACK was received (status changed from ACK_PENDING)
        current_event = self.request_event_table.get_event(request_id)
        if current_event and current_event.status == RequestStatus.ACK_PENDING:
            # ACK confirmed (HTTP 200 was sent, client received it)
            # HTTP protocol: status 200 = ACK received
            self.request_event_table.update_status(request_id, RequestStatus.ACK_RECEIVED)
            self.request_event_table.mark_notified(request_id)

            if self.debug:
                ColorPrint.blue(f"[AckManager] HTTP ACK confirmed for request {request_id} (status 200 sent and received)")

__all__ = ['AckManager']

