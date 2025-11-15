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
from pycore.pyfoundations.third_party import aiohttp

web = aiohttp.web

from pycore.pyutils.rpc.config.constants import RPC_CONSTANTS
from pycore.pyutils.rpc.common.request_event_table import RequestEventTable, RequestEvent, RequestStatus
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
        ws_clients: Dict[str, Any],
        debug: bool = False
    ):
        """
        Initialize ACK Manager
        
        Args:
            request_event_table: Request event table
            inventory_table: Inventory table
            ws_clients: WebSocket clients dictionary
            debug: Enable debug logging
        """
        self.request_event_table = request_event_table
        self.inventory_table = inventory_table
        self.ws_clients = ws_clients
        self.debug = debug
        self.ack_timeout = 5.0  # 5 seconds timeout for ACK
    
    async def notify_websocket_with_retry(
        self,
        client_id: str,
        request_id: str,
        result: Any,
        error: Optional[str]
    ):
        """
        Notify WebSocket client with retry and ACK mechanism
        
        Development Guidelines:
        - Send response to client with requires_ack flag
        - Update event status to ACK_PENDING (waiting for ACK)
        - No blocking await: Use event table status tracking
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
        
        for attempt in range(max_retries):
            try:
                ws = self.ws_clients.get(client_id)
                if not ws or ws.closed:
                    if self.debug:
                        ColorPrint.yellow(f"[AckManager] WebSocket client {client_id} not connected, attempt {attempt + 1}/{max_retries}")
                    
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_interval)
                        continue
                    else:
                        # All retries failed, store in inventory
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
                
                # Send response with requires_ack flag
                await ws.send_json({
                    'type': MSG_TYPES['RESPONSE'],
                    'id': request_id,
                    'result': result,
                    'error': error,
                    'success': error is None,
                    'requires_ack': True  # Request ACK confirmation
                })
                
                # Update status to ACK_PENDING (waiting for client ACK)
                # No blocking await - status tracked in event table
                self.request_event_table.update_status(request_id, RequestStatus.ACK_PENDING)
                self.request_event_table.increment_notify_attempt(request_id)
                
                if self.debug:
                    ColorPrint.green(f"[AckManager] Sent response to WebSocket client {client_id} for request {request_id}, waiting for ACK")
                
                # Start ACK timeout check (non-blocking)
                asyncio.create_task(self._check_ack_timeout(request_id, client_id, event, result, error))
                return
                
            except Exception as e:
                if self.debug:
                    ColorPrint.yellow(f"[AckManager] Notification attempt {attempt + 1}/{max_retries} failed: {e}")
                
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_interval)
                else:
                    # All retries failed, store in inventory
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
        
        If no ACK received within timeout, retry or store in inventory
        """
        await asyncio.sleep(self.ack_timeout)
        
        # Check if ACK was received (status changed from ACK_PENDING)
        current_event = self.request_event_table.get_event(request_id)
        if current_event and current_event.status == RequestStatus.ACK_PENDING:
            # ACK not received, retry or store
            if self.debug:
                ColorPrint.yellow(f"[AckManager] ACK timeout for request {request_id}, retrying...")
            
            # Retry notification
            await self.notify_websocket_with_retry(
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
        
        Development Guidelines:
        - HTTP ACK is confirmed by status 200 response
        - Client receives HTTP 200 = ACK confirmed
        - If timeout and still ACK_PENDING, mark as ACK_RECEIVED (HTTP 200 was sent)
        - HTTP protocol: status 200 = ACK received (client confirms receipt by receiving 200)
        """
        await asyncio.sleep(self.ack_timeout)
        
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

