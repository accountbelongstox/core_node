#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Routes Manager - Manages route registration and event handling

Handles route registration, event handlers, and event broadcasting.
"""

import asyncio
from typing import Dict, Optional, Callable, Any, List

from pycore import ColorPrint


class RoutesManager:
    """
    Routes Manager - Manages route registration and event handling
    
    Handles route registration, event handlers, and event broadcasting.
    """
    
    def __init__(self, debug: bool = False):
        """
        Initialize Routes Manager
        
        Args:
            debug: Enable debug logging
        """
        self.debug = debug
        
        # Routes
        self.routes: Dict[str, Callable] = {}
        self.events: Dict[str, List[Callable]] = {}
    
    def register_route(self, name: str, handler: Callable):
        """
        Register RPC route
        
        Development Guidelines:
        - Handler can be synchronous or asynchronous (no forced async/await)
        - Handler signature: handler(params, request_id, context) -> result
        - Request is stored in event table before handler is called
        - Handler result is stored back in event table using request_id
        - Callback is retrieved from event table by request_id after processing
        
        Args:
            name: Route name
            handler: Route handler function (can be sync or async)
                    Signature: handler(params: Dict, request_id: str, context: Dict) -> Any
                    - params: Request parameters
                    - request_id: Request ID (for event table lookup)
                    - context: Request context (contains 'ws', 'client_id', 'request', etc.)
                    - Returns: Result data (will be stored in event table)
        """
        self.routes[name] = handler
        if self.debug:
            ColorPrint.blue(f"[RoutesManager] Registered route: {name}")
    
    def get_route(self, name: str) -> Optional[Callable]:
        """
        Get route handler by name
        
        Args:
            name: Route name
            
        Returns:
            Route handler or None
        """
        return self.routes.get(name)
    
    def has_route(self, name: str) -> bool:
        """
        Check if route exists
        
        Args:
            name: Route name
            
        Returns:
            True if route exists
        """
        return name in self.routes
    
    def register_event_handler(self, event: str, handler: Callable):
        """
        Register event handler
        
        Args:
            event: Event name
            handler: Event handler function
        """
        if event not in self.events:
            self.events[event] = []
        self.events[event].append(handler)
        
        if self.debug:
            ColorPrint.blue(f"[RoutesManager] Registered event handler: {event}")
    
    def emit_event(self, event: str, data: Any):
        """
        Emit event to all handlers
        
        Args:
            event: Event name
            data: Event data
        """
        handlers = self.events.get(event, [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    asyncio.create_task(handler(data))
                else:
                    handler(data)
            except Exception as e:
                ColorPrint.red(f"[RoutesManager] Event handler error: {e}")
    
    def get_all_routes(self) -> List[str]:
        """
        Get all registered route names
        
        Returns:
            List of route names
        """
        return list(self.routes.keys())

__all__ = ['RoutesManager']

