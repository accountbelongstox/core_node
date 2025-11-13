#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Request Processor - Processes RPC requests

Handles request processing, controller execution, and result storage.
All operations based on request_id lookup in event table.
"""

import asyncio
from typing import Dict, Optional, Any, Callable

from pycore import ColorPrint

from pycore.pyutils.rpc.common.request_event_table import RequestEventTable, RequestStatus


class RequestProcessor:
    """
    Request Processor - Processes RPC requests
    
    Development Guidelines:
    - Request is already stored in event table with request_id
    - Controller handler can be sync or async (no forced async/await)
    - After controller processing, retrieve callback from event table by request_id
    - All operations based on request_id, not async patterns
    """
    
    def __init__(
        self,
        request_event_table: RequestEventTable,
        routes: Dict[str, Callable],
        debug: bool = False
    ):
        """
        Initialize Request Processor
        
        Args:
            request_event_table: Request event table
            routes: Routes dictionary
            debug: Enable debug logging
        """
        self.request_event_table = request_event_table
        self.routes = routes
        self.debug = debug
    
    async def process_request_async(
        self,
        request_id: str,
        route: str,
        params: Dict[str, Any],
        client_id: str,
        client_type: str,
        context: Dict[str, Any],
        notify_callback: Optional[Callable] = None
    ):
        """
        Process request (stored in event table)
        
        Development Guidelines:
        - Request is already stored in event table with request_id
        - Controller handler can be sync or async (no forced async/await)
        - After controller processing, retrieve callback from event table by request_id
        - All operations based on request_id, not async patterns
        
        Flow:
        1. Update event status to PROCESSING (lookup by request_id in event table)
        2. Call route handler (controller) - supports both sync and async
        3. Store result in event table (using request_id)
        4. Retrieve callback from event table by request_id
        5. Call notify_callback if provided
        
        Args:
            request_id: Request ID (used to lookup in event table)
            route: Route name
            params: Request parameters
            client_id: Client ID
            client_type: Client type ('websocket' or 'http')
            context: Request context
            notify_callback: Optional callback function to notify client
                           Signature: callback(client_id, request_id, result, error)
        """
        try:
            # Update status to PROCESSING (event table lookup by request_id)
            self.request_event_table.update_status(request_id, RequestStatus.PROCESSING)
            
            # Get handler
            handler = self.routes.get(route)
            if not handler:
                error_msg = f'Route {route} not found'
                self.request_event_table.set_result(request_id, None, error=error_msg)
                if notify_callback:
                    await notify_callback(client_id, request_id, None, error_msg)
                return
            
            # Execute handler (controller) - supports both sync and async
            # No forced async/await requirement
            if asyncio.iscoroutinefunction(handler):
                result = await handler(params, request_id, context)
            else:
                # Sync handler - execute directly
                result = handler(params, request_id, context)
            
            # Store result in event table (using request_id)
            self.request_event_table.set_result(request_id, result, error=None)
            
            # Retrieve callback from event table by request_id
            # Call notify_callback if provided
            if notify_callback:
                await notify_callback(client_id, request_id, result, None)
            # HTTP: result stored in event table, client will poll via query endpoint
            
        except Exception as e:
            error_msg = str(e)
            ColorPrint.red(f"[RequestProcessor] Processing error for {request_id}: {e}")
            
            # Store error in event table (using request_id)
            self.request_event_table.set_result(request_id, None, error=error_msg)
            
            # Retrieve callback from event table by request_id and notify client
            if notify_callback:
                await notify_callback(client_id, request_id, None, error_msg)

__all__ = ['RequestProcessor']

