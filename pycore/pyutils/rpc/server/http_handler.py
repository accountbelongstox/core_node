#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTTP Handler - Handles HTTP RPC requests

Processes HTTP RPC requests, manages inventory table lookup,
and handles query result endpoints.
"""

import asyncio
import time
from typing import Dict, Optional, Any

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_aiohttp

aiohttp = get_third_package_aiohttp()

web = aiohttp.web

from pycore.pyutils.rpc.config.constants import RPC_CONSTANTS
from pycore.pyutils.rpc.common.request_event_table import RequestEventTable, RequestStatus
from pycore.pyutils.rpc.common.inventory_table import InventoryTable
from pycore.pyutils.rpc.server.ack_manager import AckManager

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES
ERROR_CODES = RPC_CONSTANTS.ERROR_CODES


class HttpHandler:
    """
    HTTP Handler - Handles HTTP RPC requests
    
    Development Guidelines:
    - Check inventory table first
    - If not found, create event in event table
    - Process asynchronously
    - Return "accepted" status
    - Client will poll for result after 1 second
    - HTTP status 200 = ACK received (client confirms receipt by receiving 200)
    """
    
    def __init__(
        self,
        request_event_table: RequestEventTable,
        inventory_table: InventoryTable,
        routes: Dict[str, Any],
        ack_manager: AckManager,
        request_processor: Any,
        client_manager: Any,
        debug: bool = False
    ):
        """
        Initialize HTTP Handler
        
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
        self.debug = debug
    
    async def handle_http_rpc(self, request: web.Request) -> web.Response:
        """
        Handle HTTP RPC request
        
        According to architecture:
        1. Check inventory table first
        2. If not found, create event in event table
        3. Process asynchronously
        4. Return "accepted" status
        5. Client will poll for result after 1 second
        
        Args:
            request: aiohttp request
            
        Returns:
            aiohttp response
        """
        try:
            # Parse request
            if request.method == 'POST':
                data = await request.json()
            elif request.method == 'GET':
                data = dict(request.query)
            else:
                return web.json_response({
                    'error': ERROR_CODES['ROUTE_NOT_FOUND'],
                    'message': f'Method {request.method} not supported'
                }, status=405)
            
            # Extract route and params
            route = data.get('route') or request.match_info.get('route')
            params = data.get('params', {})
            request_id = data.get('id', str(time.time()))
            session_id = data.get('session_id', request.headers.get('X-Session-ID', str(id(request))))
            
            if not route:
                return web.json_response({
                    'error': ERROR_CODES['ROUTE_NOT_FOUND'],
                    'message': 'Route not specified'
                }, status=400)
            
            # Check if route exists
            if route not in self.routes:
                return web.json_response({
                    'error': ERROR_CODES['ROUTE_NOT_FOUND'],
                    'message': f'Route {route} not found'
                }, status=404)
            
            # Step 1: Check inventory table first
            inventory_item = self.inventory_table.get(request_id, remove=False)
            if inventory_item:
                if self.debug:
                    ColorPrint.blue(f"[HttpHandler] Found result in inventory for request {request_id}")
                
                # Return result with requires_ack flag
                event = self.request_event_table.get_event(request_id)
                if not event:
                    # Create event if not exists
                    event = self.request_event_table.create_event(
                        request_id=request_id,
                        route=inventory_item.route,
                        params={},
                        client_id=session_id,
                        client_type='http'
                    )
                    self.request_event_table.set_result(request_id, inventory_item.result, inventory_item.error)
                
                return self.ack_manager.prepare_http_response_with_ack(
                    request_id=request_id,
                    data={
                        'id': request_id,
                        'result': inventory_item.result,
                        'error': inventory_item.error,
                        'success': inventory_item.error is None,
                        'from_inventory': True
                    },
                    status_code=200,
                    event=event
                )
            
            # Step 2: Check if event already exists
            existing_event = self.request_event_table.get_event(request_id)
            if existing_event:
                if existing_event.status == RequestStatus.COMPLETED:
                    # Result ready, return it with requires_ack flag
                    return self.ack_manager.prepare_http_response_with_ack(
                        request_id=request_id,
                        data={
                            'id': request_id,
                            'result': existing_event.result,
                            'error': existing_event.error,
                            'success': existing_event.error is None
                        },
                        status_code=200,
                        event=existing_event
                    )
                elif existing_event.status == RequestStatus.PROCESSING:
                    # Still processing, return accepted
                    return web.json_response({
                        'id': request_id,
                        'status': 'processing',
                        'message': 'Request is being processed'
                    }, status=202)  # 202 Accepted
            
            # Step 3: Create event in event table
            event = self.request_event_table.create_event(
                request_id=request_id,
                route=route,
                params=params,
                client_id=session_id,
                client_type='http'
            )
            
            # Update client metadata
            self.client_manager.update_client_metadata(session_id, 'http', request.remote)
            
            # Step 4: Process asynchronously
            asyncio.create_task(self.request_processor.process_request_async(
                request_id=request_id,
                route=route,
                params=params,
                client_id=session_id,
                client_type='http',
                context={'request': request},
                notify_callback=None  # HTTP uses polling, no callback needed
            ))
            
            # Step 5: Return accepted status (client will poll after 1 second)
            return self.ack_manager.prepare_http_response_with_ack(
                request_id=request_id,
                data={
                    'id': request_id,
                    'status': 'accepted',
                    'message': 'Request accepted, please query result after 1 second'
                },
                status_code=200,
                event=event
            )
        
        except Exception as e:
            ColorPrint.red(f"[HttpHandler] HTTP RPC error: {e}")
            return web.json_response({
                'error': ERROR_CODES['INTERNAL_ERROR'],
                'message': str(e)
            }, status=500)
    
    async def handle_query_result(self, request: web.Request) -> web.Response:
        """
        Handle query result request
        
        Endpoint: GET /rpc/query/{request_id}
        
        Development Guidelines:
        - Client queries result by request_id
        - Check inventory table first
        - Check event table
        - Return result with requires_ack flag
        - HTTP status 200 = ACK confirmation (client confirms receipt)
        
        Args:
            request: aiohttp request
            
        Returns:
            aiohttp response with result or status
        """
        try:
            request_id = request.match_info.get('request_id')
            if not request_id:
                return web.json_response({
                    'error': ERROR_CODES['INVALID_MESSAGE'],
                    'message': 'Request ID not specified'
                }, status=400)
            
            # Check inventory table first
            inventory_item = self.inventory_table.get(request_id, remove=False)
            if inventory_item:
                # Return result with requires_ack flag
                event = self.request_event_table.get_event(request_id)
                if event:
                    pass  # Use existing event
                else:
                    # Create event if not exists
                    event = self.request_event_table.create_event(
                        request_id=request_id,
                        route=inventory_item.route,
                        params={},
                        client_id=None,
                        client_type='http'
                    )
                    self.request_event_table.set_result(request_id, inventory_item.result, inventory_item.error)
                
                return self.ack_manager.prepare_http_response_with_ack(
                    request_id=request_id,
                    data={
                        'id': request_id,
                        'result': inventory_item.result,
                        'error': inventory_item.error,
                        'success': inventory_item.error is None,
                        'from_inventory': True
                    },
                    status_code=200,
                    event=event
                )
            
            # Check event table
            event = self.request_event_table.get_event(request_id)
            if not event:
                return web.json_response({
                    'id': request_id,
                    'status': 'not_found',
                    'message': 'Request not found'
                }, status=404)
            
            if event.status == RequestStatus.COMPLETED:
                # Return result with requires_ack flag
                return self.ack_manager.prepare_http_response_with_ack(
                    request_id=request_id,
                    data={
                        'id': request_id,
                        'result': event.result,
                        'error': event.error,
                        'success': event.error is None
                    },
                    status_code=200,
                    event=event
                )
            elif event.status == RequestStatus.PROCESSING:
                return web.json_response({
                    'id': request_id,
                    'status': 'processing',
                    'message': 'Request is being processed'
                }, status=202)  # 202 Accepted (not ready yet)
            elif event.status == RequestStatus.PENDING:
                return web.json_response({
                    'id': request_id,
                    'status': 'pending',
                    'message': 'Request is pending'
                }, status=202)  # 202 Accepted (not ready yet)
            else:
                return web.json_response({
                    'id': request_id,
                    'status': event.status.value,
                    'message': f'Request status: {event.status.value}'
                }, status=200)
        
        except Exception as e:
            ColorPrint.red(f"[HttpHandler] Query result error: {e}")
            return web.json_response({
                'error': ERROR_CODES['INTERNAL_ERROR'],
                'message': str(e)
            }, status=500)

__all__ = ['HttpHandler']

