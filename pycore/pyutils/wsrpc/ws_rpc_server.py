# -*- coding: utf-8 -*-
"""
WebSocket RPC Server
Main server implementation with full feature set
"""

import asyncio
import json
import uuid
from typing import Dict, Callable, Optional, Any, List
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.gvar.ws_rpc_constants import WS_RPC_CONSTANTS

from .libs.heartbeat_manager import HeartbeatManager
from .libs.middleware_chain import MiddlewareChain
from .libs.auth_manager import AuthManager
from .libs.rate_limiter import RateLimiter
from .libs.performance_monitor import PerformanceMonitor
from .libs.namespace_manager import NamespaceManager
from .libs.message_compressor import MessageCompressor
from .libs.interceptor_manager import InterceptorManager

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    ColorPrint.red("websockets package not found. Install with: pip install websockets")
    raise

MSG_TYPES = WS_RPC_CONSTANTS.MESSAGE_TYPES
DEFAULTS = WS_RPC_CONSTANTS.DEFAULTS
ERROR_CODES = WS_RPC_CONSTANTS.ERROR_CODES
EVENTS = WS_RPC_CONSTANTS.EVENTS


class WsRpcServer:
    """WebSocket RPC Server with advanced features"""

    def __init__(self, options: Optional[Dict] = None):
        """
        Initialize WebSocket RPC Server

        Args:
            options: Configuration options
        """
        options = options or {}
        self.port = options.get('port', DEFAULTS['SERVER_PORT'])
        self.host = options.get('host', DEFAULTS['SERVER_HOST'])
        self.debug = options.get('debug', False)
        self.request_timeout = options.get('request_timeout', DEFAULTS['REQUEST_TIMEOUT'])
        self.max_payload_size = options.get('max_payload_size', DEFAULTS['MAX_PAYLOAD_SIZE'])

        self.routes: Dict[str, Callable] = {}
        self.events: Dict[str, List[Callable]] = {}
        self.pending_requests: Dict[str, Dict] = {}
        self.clients: Dict[str, WebSocketServerProtocol] = {}
        self.server = None

        # Initialize managers
        self.heartbeat = HeartbeatManager({
            'interval': options.get('heartbeat_interval', DEFAULTS['HEARTBEAT_INTERVAL']),
            'timeout': options.get('heartbeat_timeout', DEFAULTS['HEARTBEAT_TIMEOUT']),
            'on_timeout': self._handle_heartbeat_timeout,
            'on_pong': lambda client_id, latency: self.emit(EVENTS['LATENCY'], {'client_id': client_id, 'latency': latency})
        })

        self.middleware = MiddlewareChain()

        auth_options = options.get('auth', {})
        self.auth = AuthManager({
            'enabled': auth_options.get('enabled', False),
            'secret': auth_options.get('secret'),
            'token_expiry': auth_options.get('token_expiry'),
            'auth_handler': auth_options.get('handler')
        })

        rate_limit_options = options.get('rate_limit', {})
        self.rate_limiter = RateLimiter({
            'enabled': rate_limit_options.get('enabled', False),
            'max_requests': rate_limit_options.get('max_requests'),
            'window_ms': rate_limit_options.get('window_ms'),
            'on_limit_reached': lambda client_id: self.emit('rate_limit_reached', {'client_id': client_id})
        })

        performance_options = options.get('performance', {})
        self.performance = PerformanceMonitor({
            'enabled': performance_options.get('enabled', True),
            'sample_rate': performance_options.get('sample_rate'),
            'max_history_size': performance_options.get('max_history_size')
        })

        self.namespace = NamespaceManager()

        compression_options = options.get('compression', {})
        self.compressor = MessageCompressor({
            'enabled': compression_options.get('enabled', False),
            'threshold': compression_options.get('threshold'),
            'algorithm': compression_options.get('algorithm')
        })

        self.interceptors = InterceptorManager()

        self.event_handlers: Dict[str, List[Callable]] = {}
        self.options = options

    async def start(self):
        """Start the WebSocket server"""
        try:
            self.server = await websockets.serve(
                self._handle_connection,
                self.host,
                self.port,
                max_size=self.max_payload_size
            )
            ColorPrint.green(f"WebSocket RPC Server listening on {self.host}:{self.port}")
        except Exception as error:
            ColorPrint.red(f"Failed to start WsRpcServer: {error}")
            raise

    async def stop(self):
        """Stop the WebSocket server"""
        self.heartbeat.stop_all()

        for client_id, ws in list(self.clients.items()):
            await ws.close()
        self.clients.clear()

        for request_id in list(self.pending_requests.keys()):
            pending = self.pending_requests.pop(request_id)
            if 'future' in pending:
                pending['future'].cancel()

        self.rate_limiter.destroy()
        self.namespace.clear()

        if self.server:
            self.server.close()
            await self.server.wait_closed()
            ColorPrint.green("WebSocket RPC Server stopped")

    def route(self, route_name: str, handler: Callable) -> 'WsRpcServer':
        """
        Register a route handler

        Args:
            route_name: Name of the route
            handler: Handler function

        Returns:
            Self for chaining
        """
        if not callable(handler):
            ColorPrint.red(f"Handler for route '{route_name}' must be callable")
            return self

        self.routes[route_name] = handler
        ColorPrint.debug(f"Route registered: {route_name}")
        return self

    def on(self, event_name: str, handler: Callable) -> 'WsRpcServer':
        """
        Register an event handler

        Args:
            event_name: Name of the event
            handler: Handler function

        Returns:
            Self for chaining
        """
        if event_name not in self.event_handlers:
            self.event_handlers[event_name] = []
        self.event_handlers[event_name].append(handler)
        ColorPrint.debug(f"Event listener registered: {event_name}")
        return self

    def emit(self, event_name: str, data: Any):
        """
        Emit an event to all handlers

        Args:
            event_name: Name of the event
            data: Event data
        """
        handlers = self.event_handlers.get(event_name, [])
        for handler in handlers:
            try:
                asyncio.create_task(handler(data))
            except Exception as error:
                ColorPrint.red(f"Event handler error ({event_name}): {error}")

    async def trigger_event(self, event_name: str, data: Any, target_client_id: Optional[str] = None):
        """
        Trigger an event to clients

        Args:
            event_name: Event name
            data: Event data
            target_client_id: Optional specific client ID
        """
        message = {
            'type': MSG_TYPES['EVENT'],
            'event': event_name,
            'data': data,
            'timestamp': asyncio.get_event_loop().time()
        }

        if target_client_id:
            ws = self.clients.get(target_client_id)
            if ws and not ws.closed:
                await ws.send(json.dumps(message))
        else:
            await self.broadcast(message)

    async def call_client(self, route_name: str, params: Any, client_id: str) -> Any:
        """
        Call a route on a client

        Args:
            route_name: Route name
            params: Parameters
            client_id: Client ID

        Returns:
            Response from client
        """
        ws = self.clients.get(client_id)
        if not ws or ws.closed:
            raise Exception(f"Client {client_id} not connected")

        request_id = str(uuid.uuid4())
        message = {
            'type': MSG_TYPES['REQUEST'],
            'id': request_id,
            'route': route_name,
            'params': params,
            'timestamp': asyncio.get_event_loop().time()
        }

        future = asyncio.Future()
        self.pending_requests[request_id] = {
            'future': future,
            'route': route_name,
            'client_id': client_id
        }

        await ws.send(json.dumps(message))
        ColorPrint.debug(f"Calling client route: {route_name} (ID: {request_id})")

        try:
            result = await asyncio.wait_for(future, timeout=self.request_timeout)
            return result
        except asyncio.TimeoutError:
            self.pending_requests.pop(request_id, None)
            raise Exception(f"Request timeout: {route_name}")

    async def broadcast(self, message: Dict):
        """
        Broadcast message to all clients

        Args:
            message: Message to broadcast
        """
        message_str = json.dumps(message)
        for client_id, ws in list(self.clients.items()):
            if not ws.closed:
                try:
                    await ws.send(message_str)
                except Exception as error:
                    ColorPrint.red(f"Error broadcasting to {client_id}: {error}")

    async def broadcast_to_namespace(self, namespace: str, message: Dict):
        """Broadcast to namespace"""
        clients = self.namespace.get_namespace_clients(namespace)
        message_str = json.dumps(message)
        for client_id in clients:
            ws = self.clients.get(client_id)
            if ws and not ws.closed:
                await ws.send(message_str)

    async def broadcast_to_room(self, room: str, message: Dict, namespace: str = 'default'):
        """Broadcast to room"""
        clients = self.namespace.get_room_clients(room, namespace)
        message_str = json.dumps(message)
        for client_id in clients:
            ws = self.clients.get(client_id)
            if ws and not ws.closed:
                await ws.send(message_str)

    def get_clients(self) -> List[str]:
        """Get list of connected client IDs"""
        return list(self.clients.keys())

    def use(self, middleware: Callable) -> 'WsRpcServer':
        """Add middleware"""
        self.middleware.use(middleware)
        return self

    def use_error(self, error_handler: Callable) -> 'WsRpcServer':
        """Add error handler"""
        self.middleware.use_error(error_handler)
        return self

    def add_request_interceptor(self, on_fulfilled: Callable, on_rejected: Optional[Callable] = None) -> int:
        """Add request interceptor"""
        return self.interceptors.add_request_interceptor(on_fulfilled, on_rejected)

    def add_response_interceptor(self, on_fulfilled: Callable, on_rejected: Optional[Callable] = None) -> int:
        """Add response interceptor"""
        return self.interceptors.add_response_interceptor(on_fulfilled, on_rejected)

    def add_error_interceptor(self, handler: Callable) -> int:
        """Add error interceptor"""
        return self.interceptors.add_error_interceptor(handler)

    def create_namespace(self, name: str) -> 'WsRpcServer':
        """Create namespace"""
        self.namespace.create_namespace(name)
        return self

    def get_all_stats(self) -> Dict:
        """Get all statistics"""
        return {
            'performance': self.performance.get_global_stats(),
            'compression': self.compressor.get_stats(),
            'namespace': self.namespace.get_stats(),
            'middleware_count': self.middleware.count(),
            'interceptor_count': self.interceptors.get_count(),
            'route_count': len(self.routes),
            'event_count': len(self.event_handlers),
            'client_count': len(self.clients)
        }

    async def _handle_connection(self, websocket: WebSocketServerProtocol, path: str):
        """Handle new WebSocket connection"""
        client_id = str(uuid.uuid4())
        self.clients[client_id] = websocket

        ColorPrint.green(f"Client connected: {client_id}")
        self.emit(EVENTS['CONNECTION'], {'client_id': client_id})

        # Start heartbeat
        self.heartbeat.start(client_id, lambda msg: asyncio.create_task(websocket.send(json.dumps(msg))))

        # Send welcome message
        await websocket.send(json.dumps({
            'type': MSG_TYPES['WELCOME'],
            'client_id': client_id,
            'auth_required': self.auth.enabled,
            'timestamp': asyncio.get_event_loop().time()
        }))

        try:
            async for message in websocket:
                await self._handle_message(client_id, message)
        except websockets.exceptions.ConnectionClosed:
            ColorPrint.yellow(f"Client disconnected: {client_id}")
        except Exception as error:
            ColorPrint.red(f"Client error ({client_id}): {error}")
        finally:
            self._cleanup_client(client_id)

    def _cleanup_client(self, client_id: str):
        """Cleanup client resources"""
        self.heartbeat.stop(client_id)
        self.auth.revoke(client_id)
        self.namespace.remove_client(client_id)
        self.clients.pop(client_id, None)
        self.emit(EVENTS['DISCONNECT'], {'client_id': client_id})

    async def _handle_message(self, client_id: str, data: str):
        """Handle incoming message"""
        try:
            if len(data.encode('utf-8')) > self.max_payload_size:
                ColorPrint.red(f"Payload too large from {client_id}")
                await self._send_error(client_id, ERROR_CODES['PAYLOAD_TOO_LARGE'], 'Payload exceeds maximum size')
                return

            message = json.loads(data)
            ColorPrint.debug(f"Received message from {client_id}: {message.get('type')}")

            if message.get('compressed'):
                message = self.compressor.decompress(message)

            message = await self.interceptors.execute_request_interceptors(message)

            msg_type = message.get('type')

            if msg_type == MSG_TYPES['REQUEST']:
                await self._handle_request(client_id, message)
            elif msg_type == MSG_TYPES['RESPONSE']:
                self._handle_response(message)
            elif msg_type == MSG_TYPES['EVENT']:
                await self._handle_event(client_id, message)
            elif msg_type == MSG_TYPES['PONG']:
                self.heartbeat.received_pong(client_id, message)
            elif msg_type == MSG_TYPES['AUTH']:
                await self._handle_auth(client_id, message)
            elif msg_type == MSG_TYPES['SUBSCRIBE']:
                self._handle_subscribe(client_id, message)
            elif msg_type == MSG_TYPES['UNSUBSCRIBE']:
                self._handle_unsubscribe(client_id, message)
            elif msg_type == MSG_TYPES['CANCEL']:
                self._handle_cancel(client_id, message)

        except Exception as error:
            ColorPrint.red(f"Error handling message: {error}")
            handled_error = await self.interceptors.execute_error_interceptors(error, {'client_id': client_id})
            await self._send_error(client_id, ERROR_CODES['INTERNAL_ERROR'], str(handled_error))

    async def _handle_request(self, client_id: str, message: Dict):
        """Handle RPC request"""
        request_id = message.get('id')
        route = message.get('route')
        params = message.get('params')

        self.performance.start_request(request_id, route, client_id)

        try:
            # Rate limit check
            rate_check = self.rate_limiter.check(client_id)
            if not rate_check['allowed']:
                await self._send_response(client_id, request_id, False, None, ERROR_CODES['FORBIDDEN'], 'Rate limit exceeded')
                self.performance.end_request(request_id, False, Exception('Rate limit exceeded'))
                return

            # Auth check
            if self.auth.enabled and not self.auth.is_authenticated(client_id):
                await self._send_response(client_id, request_id, False, None, ERROR_CODES['UNAUTHORIZED'], 'Authentication required')
                self.performance.end_request(request_id, False, Exception('Unauthorized'))
                return

            # Get handler
            handler = self.routes.get(route)
            if not handler:
                await self._send_response(client_id, request_id, False, None, ERROR_CODES['ROUTE_NOT_FOUND'], f'Route not found: {route}')
                self.performance.end_request(request_id, False, Exception('Route not found'))
                return

            # Execute through middleware
            context = {
                'client_id': client_id,
                'request_id': request_id,
                'route': route,
                'params': params,
                'auth': self.auth.get_auth_data(client_id)
            }

            result = await self.middleware.execute(context, lambda ctx: handler(ctx['params'], ctx['client_id'], ctx))

            # Process response
            processed_result = await self.interceptors.execute_response_interceptors(result)
            compressed = self.compressor.compress(processed_result)
            if compressed['compressed']:
                processed_result = compressed

            await self._send_response(client_id, request_id, True, processed_result)
            self.performance.end_request(request_id, True)

        except Exception as error:
            ColorPrint.red(f"Route error ({route}): {error}")
            handled_error = await self.interceptors.execute_error_interceptors(error, {'client_id': client_id, 'route': route})
            await self._send_response(client_id, request_id, False, None, ERROR_CODES['INTERNAL_ERROR'], str(handled_error))
            self.performance.end_request(request_id, False, error)

    async def _send_response(self, client_id: str, request_id: str, success: bool, result: Any = None, code: Optional[str] = None, error: Optional[str] = None):
        """Send response to client"""
        ws = self.clients.get(client_id)
        if ws and not ws.closed:
            await ws.send(json.dumps({
                'type': MSG_TYPES['RESPONSE'],
                'id': request_id,
                'success': success,
                'result': result,
                'code': code,
                'error': error,
                'timestamp': asyncio.get_event_loop().time()
            }))

    async def _send_error(self, client_id: str, code: str, message: str):
        """Send error to client"""
        ws = self.clients.get(client_id)
        if ws and not ws.closed:
            await ws.send(json.dumps({
                'type': MSG_TYPES['ERROR'],
                'code': code,
                'error': message,
                'timestamp': asyncio.get_event_loop().time()
            }))

    def _handle_response(self, message: Dict):
        """Handle response from client"""
        request_id = message.get('id')
        pending = self.pending_requests.get(request_id)

        if pending and 'future' in pending:
            if message.get('success'):
                pending['future'].set_result(message.get('result'))
            else:
                pending['future'].set_exception(Exception(message.get('error', 'Unknown error')))
            self.pending_requests.pop(request_id, None)

    async def _handle_event(self, client_id: str, message: Dict):
        """Handle event from client"""
        event_name = message.get('event')
        data = message.get('data')
        handlers = self.event_handlers.get(event_name, [])

        for handler in handlers:
            try:
                await handler(data, client_id)
            except Exception as error:
                ColorPrint.red(f"Event handler error ({event_name}): {error}")

    async def _handle_auth(self, client_id: str, message: Dict):
        """Handle authentication"""
        credentials = message.get('credentials')
        result = await self.auth.authenticate(client_id, credentials)

        ws = self.clients.get(client_id)
        if ws and not ws.closed:
            await ws.send(json.dumps({
                'type': MSG_TYPES['AUTH_RESPONSE'],
                **result,
                'timestamp': asyncio.get_event_loop().time()
            }))

            if result['success']:
                self.emit(EVENTS['AUTHENTICATED'], {'client_id': client_id})
            else:
                self.emit(EVENTS['UNAUTHORIZED'], {'client_id': client_id})

    def _handle_subscribe(self, client_id: str, message: Dict):
        """Handle namespace/room subscription"""
        namespace = message.get('namespace')
        room = message.get('room')

        if namespace:
            self.namespace.join_namespace(client_id, namespace)
        if room:
            self.namespace.join_room(client_id, room, namespace or 'default')

    def _handle_unsubscribe(self, client_id: str, message: Dict):
        """Handle namespace/room unsubscription"""
        namespace = message.get('namespace')
        room = message.get('room')

        if namespace:
            self.namespace.leave_namespace(client_id, namespace)
        if room:
            self.namespace.leave_room(client_id, room, namespace or 'default')

    def _handle_cancel(self, client_id: str, message: Dict):
        """Handle request cancellation"""
        request_id = message.get('request_id')
        pending = self.pending_requests.get(request_id)

        if pending and pending.get('client_id') == client_id:
            if 'future' in pending:
                pending['future'].cancel()
            self.pending_requests.pop(request_id, None)
            ColorPrint.debug(f"Request cancelled: {request_id}")

    def _handle_heartbeat_timeout(self, client_id: str):
        """Handle heartbeat timeout"""
        ws = self.clients.get(client_id)
        if ws:
            ColorPrint.yellow(f"Heartbeat timeout for client {client_id}, closing connection")
            asyncio.create_task(ws.close())
