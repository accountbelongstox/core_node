#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocket Handler - Handles WebSocket RPC requests

Processes WebSocket RPC requests, manages WebSocket connections,
and handles WebSocket message routing.
"""

import asyncio
import json
import time
from typing import Dict, Optional, Any

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_aiohttp

aiohttp = get_third_package_aiohttp()

web = aiohttp.web
WebSocketResponse = aiohttp.web_ws.WebSocketResponse

from pycore.pyutils.rpc.config.constants import RPC_CONSTANTS
from pycore.pyutils.rpc.common.task_table import RequestEventTable, RequestStatus
from pycore.pyutils.rpc.common.inventory_table import InventoryTable
from pycore.pyutils.rpc.server.ack_manager import AckManager
from pycore.pyutils.rpc.server.request_processor import RequestProcessor
from pycore.pyutils.rpc.server.routes import RoutesManager
from pycore.pyutils.rpc.server.client_manager import ClientStatus

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES
ERROR_CODES = RPC_CONSTANTS.ERROR_CODES


class WebSocketHandler:
    """
    WebSocket Handler - Handles WebSocket RPC requests
    
    Development Guidelines:
    - Check inventory table first
    - If not found, create event in event table
    - Process asynchronously
    - Send response with requires_ack flag
    - Wait for client ACK confirmation
    """
    
    def __init__(
        self,
        request_event_table: RequestEventTable,
        inventory_table: InventoryTable,
        routes: Dict[str, Any],
        ack_manager: AckManager,
        request_processor: RequestProcessor,
        client_manager: Any,
        routes_manager: Optional[RoutesManager] = None,
        debug: bool = True
    ):
        """
        Initialize WebSocket Handler

        Args:
            request_event_table: Request event table
            inventory_table: Inventory table
            routes: Routes dictionary
            ack_manager: ACK manager
            request_processor: Request processor
            client_manager: Client manager
            debug: Enable debug logging
        """
        self.request_event_table = request_event_table
        self.inventory_table = inventory_table
        self.routes = routes
        self.ack_manager = ack_manager
        self.request_processor = request_processor
        self.client_manager = client_manager
        self.routes_manager = routes_manager
        self.debug = debug

        if self.debug:
            ColorPrint.green("[WebSocketHandler] Initialized (WebSocket RPC connection handler)")
    
    async def handle_websocket(self, request: web.Request) -> WebSocketResponse:
        """
        Handle WebSocket connection (supports reconnection)

        Args:
            request: aiohttp request

        Returns:
            WebSocket response
        """
        ws = WebSocketResponse()
        await ws.prepare(request)

        # Extract client_id from query params (for reconnection) or generate new one
        import uuid
        query_client_id = request.query.get('client_id')
        client_id = query_client_id if query_client_id else str(uuid.uuid4())
        client_addr = request.remote

        # Register WebSocket client (reuses existing if RECONNECTING)
        client_info = await self.client_manager.register_websocket_client(
            client_id=client_id,
            ws=ws,
            remote_addr=client_addr,
            reuse_if_reconnecting=True  # Enable reconnection support
        )

        if self.debug:
            ColorPrint.green(f"[WebSocketHandler] WebSocket client connected: {client_addr} (id: {client_id})")

        # Set status to CONNECTED (handshake complete)
        await self.client_manager.set_client_status(client_id, ClientStatus.CONNECTED)

        # Send welcome message
        await ws.send_json({
            'type': MSG_TYPES['WELCOME'],
            'client_id': client_id,
            'timestamp': time.time(),
            'reconnected': len(client_info.pending_messages) > 0  # Indicate if this is a reconnection
        })

        # Send pending messages if this is a reconnection
        if client_info.pending_messages:
            await self.client_manager.send_pending_messages(client_id)

        # Don't push inventory automatically on connect
        # Wait for client to send client_id message (inventory push only on explicit reconnection)
        
        try:
            async for msg in ws:
                if msg.type == web.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        await self.handle_websocket_message(ws, client_id, data)
                    except json.JSONDecodeError as e:
                        ColorPrint.red(f"[WebSocketHandler] JSON decode error: {e}")
                        await ws.send_json({
                            'type': MSG_TYPES['ERROR'],
                            'error': ERROR_CODES['INVALID_MESSAGE'],
                            'message': 'Invalid JSON'
                        })
                    except Exception as e:
                        ColorPrint.red(f"[WebSocketHandler] WebSocket message error: {e}")
                        await ws.send_json({
                            'type': MSG_TYPES['ERROR'],
                            'error': ERROR_CODES['INTERNAL_ERROR'],
                            'message': str(e)
                        })
                elif msg.type == web.WSMsgType.ERROR:
                    if self.debug:
                        ColorPrint.red(f"[WebSocketHandler] WebSocket error: {ws.exception()}")
        
        finally:
            # Unregister WebSocket client (graceful shutdown with state transitions)
            await self.client_manager.unregister_websocket_client(client_id)
            if self.debug:
                ColorPrint.blue(f"[WebSocketHandler] WebSocket client disconnected: {client_addr} (id: {client_id})")
            await ws.close()
        
        return ws
    
    async def handle_websocket_message(
        self,
        ws: WebSocketResponse,
        client_id: str,
        data: Dict[str, Any]
    ):
        """
        Handle WebSocket message

        Args:
            ws: WebSocket connection
            client_id: Client ID
            data: Message data
        """
        # Update client activity on every message
        await self.client_manager.update_client_activity(client_id)

        msg_type = data.get('type', MSG_TYPES['REQUEST'])
        request_id = data.get('id', str(time.time()))

        if msg_type == 'client_id':
            # Client sent their ID for reconnection handling
            # Check inventory and push pending tasks if this is a reconnect with history
            received_client_id = data.get('client_id')

            if received_client_id and received_client_id == client_id:
                # Check for inventory items for this client
                inventory_items = self.inventory_table.get_by_client(client_id)

                if inventory_items:
                    if self.debug:
                        ColorPrint.blue(f"[WebSocketHandler] Pushing {len(inventory_items)} inventory items to reconnected client {client_id[:8]}...")

                    # Push all inventory items in a single message
                    items_data = []
                    for item in inventory_items:
                        items_data.append({
                            'request_id': item.request_id,
                            'route': item.route,
                            'result': item.result,
                            'error': item.error,
                            'success': item.error is None
                        })
                        # Remove from inventory after adding to push list
                        self.inventory_table.delete(item.request_id)

                    # Send inventory push message
                    await ws.send_json({
                        'type': 'inventory',
                        'id': f'inventory_{client_id}_{time.time()}',
                        'items': items_data,
                        'requires_ack': True
                    })

                    if self.debug:
                        ColorPrint.green(f"[WebSocketHandler] Pushed inventory to client {client_id[:8]}...")
                else:
                    if self.debug:
                        ColorPrint.blue(f"[WebSocketHandler] No inventory items for client {client_id[:8]}...")
            return

        if msg_type == MSG_TYPES['REQUEST']:
            # Handle RPC request
            route = data.get('route')
            params = data.get('params', {})
            
            if not route:
                await ws.send_json({
                    'type': MSG_TYPES['ERROR'],
                    'id': request_id,
                    'error': ERROR_CODES['ROUTE_NOT_FOUND'],
                    'message': 'Route not specified'
                })
                return
            
            if route not in self.routes:
                await ws.send_json({
                    'type': MSG_TYPES['ERROR'],
                    'id': request_id,
                    'error': ERROR_CODES['ROUTE_NOT_FOUND'],
                    'message': f'Route {route} not found'
                })
                return
            
            # Step 1: Check inventory table first
            inventory_item = self.inventory_table.get(request_id, remove=True)
            if inventory_item:
                if self.debug:
                    ColorPrint.blue(f"[WebSocketHandler] Found result in inventory for WebSocket request {request_id}")
                await ws.send_json({
                    'type': MSG_TYPES['RESPONSE'],
                    'id': request_id,
                    'result': inventory_item.result,
                    'error': inventory_item.error,
                    'success': inventory_item.error is None,
                    'from_inventory': True,
                    'requires_ack': True
                })
                return
            
            # Step 2: Check if event already exists
            existing_event = self.request_event_table.get_event(request_id)
            if existing_event:
                if existing_event.status == RequestStatus.COMPLETED:
                    # Result ready, notify immediately
                    await self.ack_manager.notify_websocket_with_retry(
                        client_id=client_id,
                        request_id=request_id,
                        result=existing_event.result,
                        error=existing_event.error
                    )
                    return
                elif existing_event.status == RequestStatus.PROCESSING:
                    # Still processing, send processing status
                    await ws.send_json({
                        'type': MSG_TYPES['EVENT'],
                        'event': 'request_processing',
                        'id': request_id,
                        'data': {'status': 'processing'}
                    })
                    return
            
            # Step 3: Create event in event table
            event = self.request_event_table.create_event(
                request_id=request_id,
                route=route,
                params=params,
                client_id=client_id,
                client_type='websocket'
            )

            # Step 4: Process asynchronously
            asyncio.create_task(self.request_processor.process_request_async(
                request_id=request_id,
                route=route,
                params=params,
                client_id=client_id,
                client_type='websocket',
                context={'ws': ws, 'client_id': client_id},
                notify_callback=self.ack_manager.notify_websocket_with_retry
            ))
            
            # Send accepted status
            await ws.send_json({
                'type': MSG_TYPES['EVENT'],
                'event': 'request_accepted',
                'id': request_id,
                'data': {'status': 'accepted', 'message': 'Request accepted, processing...'}
            })
        
        elif msg_type == MSG_TYPES['PING']:
            # Handle ping (WebSocket heartbeat mechanism)
            await self.client_manager.update_client_ping(client_id)

            # Check for pending notifications (heartbeat includes event query)
            pending_events = self.request_event_table.get_pending_notifications(client_id=client_id)
            inventory_items = self.inventory_table.get_by_client(client_id)
            
            # Send pong with notification info
            await ws.send_json({
                'type': MSG_TYPES['PONG'],
                'timestamp': time.time(),
                'pending_requests': len(pending_events),
                'inventory_items': len(inventory_items)
            })
            
            # Send pending notifications (limit to 5 per heartbeat)
            for event in pending_events[:5]:
                await self.ack_manager.notify_websocket_with_retry(
                    client_id=client_id,
                    request_id=event.request_id,
                    result=event.result,
                    error=event.error
                )
            
            # Send inventory items (limit to 5 per heartbeat)
            for item in inventory_items[:5]:
                await ws.send_json({
                    'type': MSG_TYPES['RESPONSE'],
                    'id': item.request_id,
                    'result': item.result,
                    'error': item.error,
                    'success': item.error is None,
                    'from_inventory': True,
                    'requires_ack': True
                })
                self.inventory_table.delete(item.request_id)
        
        elif msg_type == MSG_TYPES['ACK']:
            # Handle ACK (acknowledgment) from client
            self.ack_manager.handle_ack(client_id, request_id)
        
        elif msg_type == MSG_TYPES['EVENT']:
            # Handle event
            event = data.get('event')
            event_data = data.get('data', {})
            if self.routes_manager:
                self.routes_manager.emit_event(event, event_data)

__all__ = ['WebSocketHandler']

