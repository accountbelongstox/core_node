#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified RPC Server - HTTP and WebSocket on same port

This server provides both HTTP and WebSocket RPC on the same port,
using aiohttp to handle both protocols. Events are cached in a shared
event cache that can be accessed by both HTTP and WebSocket handlers.

Reference: ncore/utils/rpc/http_rpc/ExpressServer.js and WsManager.js

Usage:
    from pycore.pyutils.rpc import UnifiedRpcServer
    
    server = UnifiedRpcServer(port=8080)
    server.route('echo', lambda params: {'message': params.get('message')})
    await server.start()
"""

import asyncio
import time
from pathlib import Path
from typing import Dict, Optional, Callable, Any

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_aiohttp

aiohttp = get_third_package_aiohttp()

web = aiohttp.web

from pycore.pyutils.rpc.config.constants import RPC_CONSTANTS
from pycore.pyutils.rpc.common.event_cache import EventCache, default_event_cache
from pycore.pyutils.rpc.common.request_manager import RequestManager, default_request_manager
from pycore.pyutils.rpc.common.request_event_table import (
    RequestEventTable,
    RequestEvent,
    RequestStatus,
    default_request_event_table
)
from pycore.pyutils.rpc.common.inventory_table import (
    InventoryTable,
    InventoryItem,
    default_inventory_table
)

from pycore.pyutils.rpc.server.client_manager import ClientManager
from pycore.pyutils.rpc.server.routes import RoutesManager
from pycore.pyutils.rpc.server.ack_manager import AckManager
from pycore.pyutils.rpc.server.request_processor import RequestProcessor
from pycore.pyutils.rpc.server.http_handler import HttpHandler
from pycore.pyutils.rpc.server.websocket_handler import WebSocketHandler
from pycore.pyutils.rpc.protocol.rpc_protocol import (
    RPC_STATUS_PATH,
    RPC_INFO_PATH,
    RPC_PROTOCOL_VERSION
)

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES
DEFAULTS = RPC_CONSTANTS.DEFAULTS
ERROR_CODES = RPC_CONSTANTS.ERROR_CODES
EVENTS = RPC_CONSTANTS.EVENTS
WS_PATH = RPC_CONSTANTS.WS_PATH
HTTP_PATH_PREFIX = RPC_CONSTANTS.HTTP_PATH_PREFIX


class UnifiedRpcServer:
    """
    Unified RPC Server - HTTP and WebSocket on same port
    
    Provides both HTTP and WebSocket RPC endpoints on the same port.
    Uses shared event cache for both protocols.
    
    Features:
    - HTTP RPC endpoints
    - WebSocket RPC endpoints
    - Shared event cache
    - Route registration
    - Event broadcasting
    
    Development Guidelines:
    ======================
    
    1. Request Processing Flow:
       - All requests are stored in the event table with a request ID
       - Controller handlers can be synchronous or asynchronous (no forced async/await)
       - After controller processing, the system retrieves the callback from the event table
       - All operations are based on request ID, not async/await patterns
    
    2. Event Table Usage:
       - Every request must be stored in the event table before processing
       - Request ID is the primary key for all operations
       - Controller results are stored back in the event table
       - Callbacks are retrieved from the event table using request ID
    
    3. Handler Implementation:
       - Handlers can be regular functions (sync) or async functions
       - No requirement to use async/await in handlers
       - Handler signature: handler(params, request_id, context) -> result
       - Context contains request-specific information (ws, client_id, request object)
    
    4. Callback Mechanism:
       - After controller processing, system looks up callback in event table by request ID
       - For WebSocket: notification with retry mechanism
       - For HTTP: result stored, client polls via query endpoint
       - All based on request ID lookup, not async patterns
    
    5. Architecture Principles:
       - Event-driven: All requests stored in event table
       - ID-based: All operations use request ID as identifier
       - Protocol-agnostic: Same event table for HTTP and WebSocket
       - No async dependency: Handlers can be sync or async
    
    6. Acknowledgment (ACK) Mechanism:
       - After sending event/response, wait for client ACK confirmation
       - Only mark as notified after receiving ACK
       - HTTP: Use status code 200 to confirm receipt
       - WebSocket: Use ACK message type to confirm receipt
       - No blocking await: Use event table status tracking
       - ACK timeout: If no ACK received, retry or store in inventory
       
    7. Communication Protocol:
       - Request: Client -> Server (with request_id)
       - Response: Server -> Client (with request_id, requires_ack flag)
       - ACK: Client -> Server (with request_id, confirms receipt)
       - HTTP: Status 200 = ACK received, other codes = retry needed
       - WebSocket: ACK message type = confirmation received
       - All based on request_id lookup in event table
    """
    
    def __init__(self, options: Optional[Dict] = None):
        """
        Initialize Unified RPC Server
        
        Args:
            options: Configuration options
        """
        options = options or {}
        self.port = options.get('port', DEFAULTS['SERVER_PORT'])
        self.host = options.get('host', DEFAULTS['SERVER_HOST'])
        self.debug = options.get('debug', False)
        self.max_requests = options.get('max_requests', 10000000)
        
        # Shared event cache
        self.event_cache: EventCache = options.get('event_cache', default_event_cache)
        
        # Request manager
        self.request_manager: RequestManager = options.get('request_manager', default_request_manager)
        
        # Request event table
        self.request_event_table: RequestEventTable = options.get(
            'request_event_table',
            RequestEventTable(max_size=self.max_requests)
        )
        
        # Inventory table (stores failed notification results)
        self.inventory_table: InventoryTable = options.get(
            'inventory_table',
            InventoryTable(max_size=self.max_requests)
        )
        
        # Initialize managers
        self.client_manager = ClientManager(debug=self.debug)
        self.routes_manager = RoutesManager(debug=self.debug)
        self.ack_manager = AckManager(
            request_event_table=self.request_event_table,
            inventory_table=self.inventory_table,
            ws_clients=self.client_manager.ws_clients,
            debug=self.debug
        )
        self.request_processor = RequestProcessor(
            request_event_table=self.request_event_table,
            routes=self.routes_manager.routes,
            debug=self.debug
        )
        
        # Initialize handlers
        self.http_handler = HttpHandler(
            request_event_table=self.request_event_table,
            inventory_table=self.inventory_table,
            routes=self.routes_manager.routes,
            ack_manager=self.ack_manager,
            request_processor=self.request_processor,
            client_manager=self.client_manager,
            debug=self.debug
        )
        
        self.websocket_handler = WebSocketHandler(
            request_event_table=self.request_event_table,
            inventory_table=self.inventory_table,
            routes=self.routes_manager.routes,
            ack_manager=self.ack_manager,
            request_processor=self.request_processor,
            client_manager=self.client_manager,
            routes_manager=self.routes_manager,
            debug=self.debug
        )
        
        # aiohttp app and server
        self.app: Optional[web.Application] = None
        self.runner: Optional[web.AppRunner] = None
        self.site: Optional[web.TCPSite] = None
        
        # Server state
        self._running = False
        
        # Static file serving
        self.static_dirs: Dict[str, str] = {}  # URL prefix -> directory path
        
        # Add default static directories (e.g., frontend JS libraries)
        self._add_default_static_dirs()
    
    def route(self, name: str, handler: Callable):
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
        self.routes_manager.register_route(name, handler)
    
    def on(self, event: str, handler: Callable):
        """
        Register event handler
        
        Args:
            event: Event name
            handler: Event handler function
        """
        self.routes_manager.register_event_handler(event, handler)
    
    def emit(self, event: str, data: Any):
        """
        Emit event to all handlers
        
        Args:
            event: Event name
            data: Event data
        """
        self.routes_manager.emit_event(event, data)
    
    def add_static_dir(self, url_prefix: str, directory: str):
        """
        Add static directory for file serving
        
        Args:
            url_prefix: URL prefix (e.g., '/static' or '/js')
            directory: Directory path to serve files from
        """
        dir_path = Path(directory)
        if not dir_path.exists():
            dir_path.mkdir(parents=True, exist_ok=True)
        
        self.static_dirs[url_prefix] = str(dir_path.absolute())
        
        if self.debug:
            ColorPrint.blue(f"[UnifiedRpcServer] Added static directory: {url_prefix} -> {directory}")
    
    def _add_default_static_dirs(self):
        """
        Add default static directories (e.g., frontend JS libraries)
        This is called automatically during initialization.
        """
        # Get the RPC package directory
        rpc_package_dir = Path(__file__).parent.parent
        
        # Default: serve client JS libraries at /js/rpc
        client_js_dir = rpc_package_dir / 'client'
        if client_js_dir.exists():
            self.static_dirs['/js/rpc'] = str(client_js_dir.absolute())
            if self.debug:
                ColorPrint.blue(f"[UnifiedRpcServer] Added default static directory: /js/rpc -> {client_js_dir}")
    
    async def broadcast(self, message: Dict[str, Any], exclude_client_id: Optional[str] = None):
        """
        Broadcast message to all WebSocket clients
        
        Args:
            message: Message to broadcast
            exclude_client_id: Client ID to exclude
        """
        disconnected_clients = []
        
        for client_id, ws in self.client_manager.ws_clients.items():
            if exclude_client_id and client_id == exclude_client_id:
                continue
            
            try:
                await ws.send_json(message)
            except Exception as e:
                ColorPrint.yellow(f"[UnifiedRpcServer] Broadcast error to {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Remove disconnected clients
        for client_id in disconnected_clients:
            self.client_manager.unregister_websocket_client(client_id)
    
    async def start(self):
        """Start unified RPC server"""
        if self._running:
            if self.debug:
                ColorPrint.yellow("[UnifiedRpcServer] Server already running")
            return
        
        # Create aiohttp app
        self.app = web.Application()
        
        # Add static directories (must be added before other routes)
        for url_prefix, directory in self.static_dirs.items():
            self.app.router.add_static(url_prefix, directory)
            if self.debug:
                ColorPrint.blue(f"[UnifiedRpcServer] Serving static files: {url_prefix} -> {directory}")
        
        # Add protocol endpoints for service discovery (must be before dynamic routes)
        async def rpc_status(request):
            """Handle /rpc/status endpoint for service discovery"""
            return web.json_response({
                "is_rpc_service": True,
                "protocol_version": RPC_PROTOCOL_VERSION
            })
        
        async def rpc_info(request):
            """Handle /rpc/info endpoint for service discovery"""
            return web.json_response({
                "is_rpc_service": True,
                "protocol_version": RPC_PROTOCOL_VERSION,
                "service_name": "Unified RPC Service",
                "port": self.port,
                "host": self.host if self.host != "0.0.0.0" else "localhost",
                "capabilities": ["http", "websocket"],
                "metadata": {
                    "routes": self.routes_manager.get_all_routes()
                }
            })
        
        self.app.router.add_get(RPC_STATUS_PATH, rpc_status)
        self.app.router.add_get(RPC_INFO_PATH, rpc_info)
        
        # Add health check (unified basic route)
        async def health_check(request):
            return web.json_response({
                'status': 'ok',
                'service': 'UnifiedRpcServer',
                'routes': self.routes_manager.get_all_routes(),
                'ws_clients': len(self.client_manager.get_all_websocket_clients()),
                'http_sessions': len(self.client_manager.http_sessions),
                'pending_requests': len([e for e in self.request_event_table.events.values() if e.status == RequestStatus.PENDING]),
                'inventory_items': self.inventory_table.size()
            })
        
        self.app.router.add_get('/health', health_check)
        
        # Add query result endpoint (must be before dynamic route)
        self.app.router.add_get(f'{HTTP_PATH_PREFIX}/query/{{request_id}}', self.http_handler.handle_query_result)
        
        # Add HTTP RPC routes (dynamic route, must be last)
        self.app.router.add_post(f'{HTTP_PATH_PREFIX}/{{route}}', self.http_handler.handle_http_rpc)
        self.app.router.add_get(f'{HTTP_PATH_PREFIX}/{{route}}', self.http_handler.handle_http_rpc)
        
        # Add WebSocket route
        self.app.router.add_get(WS_PATH, self.websocket_handler.handle_websocket)
        
        # Add heartbeat endpoint for HTTP
        async def http_heartbeat(request):
            session_id = request.headers.get('X-Session-ID', str(id(request)))
            self.client_manager.update_client_metadata(session_id, 'http', request.remote)
            
            # Check for pending notifications (heartbeat includes event query)
            pending_events = self.request_event_table.get_pending_notifications(client_id=session_id)
            inventory_items = self.inventory_table.get_by_client(session_id)
            
            return web.json_response({
                'status': 'ok',
                'timestamp': time.time(),
                'pending_requests': len(pending_events),
                'inventory_items': len(inventory_items),
                'notifications': [
                    {
                        'request_id': event.request_id,
                        'route': event.route,
                        'result': event.result,
                        'error': event.error
                    }
                    for event in pending_events[:10]  # Limit to 10
                ],
                'inventory': [
                    {
                        'request_id': item.request_id,
                        'route': item.route,
                        'result': item.result,
                        'error': item.error
                    }
                    for item in inventory_items[:10]  # Limit to 10
                ]
            })
        
        self.app.router.add_get(f'{HTTP_PATH_PREFIX}/heartbeat', http_heartbeat)
        self.app.router.add_post(f'{HTTP_PATH_PREFIX}/heartbeat', http_heartbeat)
        
        # Start server
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        
        self.site = web.TCPSite(self.runner, self.host, self.port)
        await self.site.start()
        
        self._running = True
        
        ColorPrint.green(f"[UnifiedRpcServer] Server started on {self.host}:{self.port}")
        ColorPrint.blue(f"[UnifiedRpcServer] HTTP RPC: http://{self.host}:{self.port}{HTTP_PATH_PREFIX}/<route>")
        ColorPrint.blue(f"[UnifiedRpcServer] WebSocket RPC: ws://{self.host}:{self.port}{WS_PATH}")
    
    async def stop(self):
        """Stop unified RPC server"""
        if not self._running:
            return
        
        self._running = False
        
        # Close all WebSocket connections
        for client_id, ws in list(self.client_manager.ws_clients.items()):
            try:
                await ws.close()
            except Exception:
                pass
        self.client_manager.ws_clients.clear()
        
        # Stop server
        if self.site:
            await self.site.stop()
        if self.runner:
            await self.runner.cleanup()
        
        ColorPrint.blue("[UnifiedRpcServer] Server stopped")
    
    def is_running(self) -> bool:
        """Check if server is running"""
        return self._running


__all__ = ['UnifiedRpcServer']

