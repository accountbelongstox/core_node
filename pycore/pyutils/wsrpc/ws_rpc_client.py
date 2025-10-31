# -*- coding: utf-8 -*-
"""
WebSocket RPC Client
Client implementation with reconnection and advanced features
"""

import asyncio
import json
import uuid
from typing import Dict, Callable, Optional, Any, List
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.gvar.ws_rpc_constants import WS_RPC_CONSTANTS

try:
    import websockets
    from websockets.client import WebSocketClientProtocol
except ImportError:
    ColorPrint.red("websockets package not found. Install with: pip install websockets")
    raise

MSG_TYPES = WS_RPC_CONSTANTS.MESSAGE_TYPES
DEFAULTS = WS_RPC_CONSTANTS.DEFAULTS
ERROR_CODES = WS_RPC_CONSTANTS.ERROR_CODES
EVENTS = WS_RPC_CONSTANTS.EVENTS


class WsRpcClient:
    """WebSocket RPC Client with advanced features"""

    def __init__(self, url: str, options: Optional[Dict] = None):
        """
        Initialize WebSocket RPC Client

        Args:
            url: WebSocket server URL
            options: Configuration options
        """
        options = options or {}
        self.url = url
        self.debug = options.get('debug', False)
        self.ws: Optional[WebSocketClientProtocol] = None
        self.connected = False
        self.authenticated = False
        self.client_id: Optional[str] = None
        self.auth_token: Optional[str] = None

        self.routes: Dict[str, Callable] = {}
        self.event_handlers: Dict[str, List[Callable]] = {}
        self.pending_requests: Dict[str, Dict] = {}

        self.request_timeout = options.get('request_timeout', DEFAULTS['REQUEST_TIMEOUT'])
        self.reconnect = options.get('reconnect', True)
        self.reconnect_interval = options.get('reconnect_interval', DEFAULTS['RECONNECT_INTERVAL'])
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = options.get('max_reconnect_attempts', DEFAULTS['MAX_RECONNECT_ATTEMPTS'])

        self.heartbeat_interval = options.get('heartbeat_interval', DEFAULTS['HEARTBEAT_INTERVAL'])
        self.heartbeat_timeout = options.get('heartbeat_timeout', DEFAULTS['HEARTBEAT_TIMEOUT'])
        self.enable_heartbeat = options.get('enable_heartbeat', True)

        self.heartbeat_timer: Optional[asyncio.Task] = None
        self.heartbeat_timeout_timer: Optional[asyncio.Task] = None

        self.request_interceptors: List[Dict] = []
        self.response_interceptors: List[Dict] = []
        self.error_interceptors: List[Dict] = []

        self.message_queue: List[Dict] = []
        self.options = options

        # Event callbacks
        self.on_connected: Optional[Callable] = options.get('on_connected')
        self.on_disconnected: Optional[Callable] = options.get('on_disconnected')
        self.on_error: Optional[Callable] = options.get('on_error')
        self.on_reconnecting: Optional[Callable] = options.get('on_reconnecting')
        self.on_authenticated: Optional[Callable] = options.get('on_authenticated')
        self.on_auth_failed: Optional[Callable] = options.get('on_auth_failed')

    async def connect(self):
        """Connect to WebSocket server"""
        try:
            ColorPrint.blue(f"Connecting to {self.url}...")
            self.ws = await websockets.connect(self.url)
            self.connected = True
            self.reconnect_attempts = 0

            ColorPrint.green("Connected to server")
            await self._flush_message_queue()

            if self.enable_heartbeat:
                self._start_heartbeat()

            if self.on_connected:
                await self.on_connected()

            self._emit_event(EVENTS['CONNECTION'], {})

            # Start message handling
            asyncio.create_task(self._message_loop())

        except Exception as error:
            ColorPrint.red(f"Connection error: {error}")
            if self.on_error:
                await self.on_error(error)
            raise

    async def disconnect(self):
        """Disconnect from server"""
        self.reconnect = False
        self._stop_heartbeat()

        if self.ws and not self.ws.closed:
            await self.ws.close()

        self.connected = False
        self.authenticated = False

        for request_id in list(self.pending_requests.keys()):
            pending = self.pending_requests.pop(request_id)
            if 'future' in pending:
                pending['future'].cancel()

    async def authenticate(self, credentials: Dict) -> Dict:
        """
        Authenticate with server

        Args:
            credentials: Authentication credentials

        Returns:
            Authentication result
        """
        if not self.connected:
            raise Exception("Not connected to server")

        request_id = str(uuid.uuid4())
        message = {
            'type': MSG_TYPES['AUTH'],
            'id': request_id,
            'credentials': credentials,
            'timestamp': asyncio.get_event_loop().time()
        }

        future = asyncio.Future()
        self.pending_requests[request_id] = {
            'future': future,
            'route': 'authenticate'
        }

        await self._send(message)

        try:
            result = await asyncio.wait_for(future, timeout=self.request_timeout)

            if result.get('success'):
                self.authenticated = True
                self.auth_token = result.get('token')
                ColorPrint.green("Authentication successful")

                if self.on_authenticated:
                    await self.on_authenticated(result)

                self._emit_event(EVENTS['AUTHENTICATED'], result)
            else:
                ColorPrint.red(f"Authentication failed: {result.get('message')}")

                if self.on_auth_failed:
                    await self.on_auth_failed(result)

                self._emit_event(EVENTS['UNAUTHORIZED'], result)

            return result

        except asyncio.TimeoutError:
            self.pending_requests.pop(request_id, None)
            raise Exception("Authentication timeout")

    def subscribe(self, namespace: str, room: Optional[str] = None):
        """
        Subscribe to namespace/room

        Args:
            namespace: Namespace name
            room: Optional room name
        """
        asyncio.create_task(self._send({
            'type': MSG_TYPES['SUBSCRIBE'],
            'namespace': namespace,
            'room': room,
            'timestamp': asyncio.get_event_loop().time()
        }))
        ColorPrint.debug(f"Subscribed to namespace: {namespace}{f', room: {room}' if room else ''}")

    def unsubscribe(self, namespace: str, room: Optional[str] = None):
        """
        Unsubscribe from namespace/room

        Args:
            namespace: Namespace name
            room: Optional room name
        """
        asyncio.create_task(self._send({
            'type': MSG_TYPES['UNSUBSCRIBE'],
            'namespace': namespace,
            'room': room,
            'timestamp': asyncio.get_event_loop().time()
        }))
        ColorPrint.debug(f"Unsubscribed from namespace: {namespace}{f', room: {room}' if room else ''}")

    def cancel_request(self, request_id: str):
        """
        Cancel a pending request

        Args:
            request_id: Request ID to cancel
        """
        pending = self.pending_requests.get(request_id)
        if pending:
            if 'future' in pending:
                pending['future'].cancel()
            self.pending_requests.pop(request_id, None)

            asyncio.create_task(self._send({
                'type': MSG_TYPES['CANCEL'],
                'request_id': request_id,
                'timestamp': asyncio.get_event_loop().time()
            }))

            ColorPrint.debug(f"Request cancelled: {request_id}")

    def add_request_interceptor(self, on_fulfilled: Callable, on_rejected: Optional[Callable] = None) -> int:
        """Add request interceptor"""
        interceptor_id = len(self.request_interceptors)
        self.request_interceptors.append({
            'id': interceptor_id,
            'on_fulfilled': on_fulfilled,
            'on_rejected': on_rejected
        })
        return interceptor_id

    def add_response_interceptor(self, on_fulfilled: Callable, on_rejected: Optional[Callable] = None) -> int:
        """Add response interceptor"""
        interceptor_id = len(self.response_interceptors)
        self.response_interceptors.append({
            'id': interceptor_id,
            'on_fulfilled': on_fulfilled,
            'on_rejected': on_rejected
        })
        return interceptor_id

    def add_error_interceptor(self, handler: Callable) -> int:
        """Add error interceptor"""
        interceptor_id = len(self.error_interceptors)
        self.error_interceptors.append({
            'id': interceptor_id,
            'handler': handler
        })
        return interceptor_id

    def route(self, route_name: str, handler: Callable) -> 'WsRpcClient':
        """
        Register route handler

        Args:
            route_name: Route name
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

    def on(self, event_name: str, handler: Callable) -> 'WsRpcClient':
        """
        Register event handler

        Args:
            event_name: Event name
            handler: Handler function

        Returns:
            Self for chaining
        """
        if not callable(handler):
            ColorPrint.red(f"Handler for event '{event_name}' must be callable")
            return self

        if event_name not in self.event_handlers:
            self.event_handlers[event_name] = []
        self.event_handlers[event_name].append(handler)
        ColorPrint.debug(f"Event listener registered: {event_name}")
        return self

    async def call(self, route_name: str, params: Any = None) -> Any:
        """
        Call server route

        Args:
            route_name: Route name
            params: Parameters

        Returns:
            Response from server
        """
        if not self.connected:
            raise Exception("Not connected to server")

        request_id = str(uuid.uuid4())
        message = {
            'type': MSG_TYPES['REQUEST'],
            'id': request_id,
            'route': route_name,
            'params': params,
            'timestamp': asyncio.get_event_loop().time()
        }

        if self.auth_token:
            message['token'] = self.auth_token

        # Execute request interceptors
        for interceptor in self.request_interceptors:
            try:
                if interceptor['on_fulfilled']:
                    message = await interceptor['on_fulfilled'](message)
            except Exception as error:
                if interceptor['on_rejected']:
                    message = await interceptor['on_rejected'](error)
                else:
                    raise

        future = asyncio.Future()
        self.pending_requests[request_id] = {
            'future': future,
            'route': route_name
        }

        await self._send(message)
        ColorPrint.debug(f"Calling server route: {route_name} (ID: {request_id})")

        try:
            result = await asyncio.wait_for(future, timeout=self.request_timeout)
            return result
        except asyncio.TimeoutError:
            self.pending_requests.pop(request_id, None)
            raise Exception(f"Request timeout: {route_name}")

    async def emit(self, event_name: str, data: Any):
        """
        Emit event to server

        Args:
            event_name: Event name
            data: Event data
        """
        message = {
            'type': MSG_TYPES['EVENT'],
            'event': event_name,
            'data': data,
            'timestamp': asyncio.get_event_loop().time()
        }

        await self._send(message)
        ColorPrint.debug(f"Event emitted: {event_name}")

    def _start_heartbeat(self):
        """Start heartbeat"""
        if self.heartbeat_timer:
            self.heartbeat_timer.cancel()

        self.heartbeat_timer = asyncio.create_task(self._heartbeat_loop())
        ColorPrint.debug("Heartbeat started")

    def _stop_heartbeat(self):
        """Stop heartbeat"""
        if self.heartbeat_timer:
            self.heartbeat_timer.cancel()
            self.heartbeat_timer = None

        if self.heartbeat_timeout_timer:
            self.heartbeat_timeout_timer.cancel()
            self.heartbeat_timeout_timer = None

    async def _heartbeat_loop(self):
        """Heartbeat loop"""
        while self.connected:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                await self._send_pong()
            except asyncio.CancelledError:
                break
            except Exception as error:
                ColorPrint.red(f"Heartbeat error: {error}")

    async def _send_pong(self):
        """Send pong message"""
        await self._send({
            'type': MSG_TYPES['PONG'],
            'timestamp': asyncio.get_event_loop().time()
        })

        if self.heartbeat_timeout_timer:
            self.heartbeat_timeout_timer.cancel()

        self.heartbeat_timeout_timer = asyncio.create_task(self._heartbeat_timeout())

    async def _heartbeat_timeout(self):
        """Handle heartbeat timeout"""
        await asyncio.sleep(self.heartbeat_timeout)
        ColorPrint.yellow("Heartbeat timeout - server not responding")
        if self.ws:
            await self.ws.close()

    async def _send(self, message: Dict):
        """Send message to server"""
        if not self.connected or not self.ws or self.ws.closed:
            self.message_queue.append(message)
            ColorPrint.debug("Message queued (not connected)")
            return

        await self.ws.send(json.dumps(message))

    async def _flush_message_queue(self):
        """Flush queued messages"""
        if not self.message_queue:
            return

        ColorPrint.debug(f"Flushing {len(self.message_queue)} queued messages")

        while self.message_queue:
            message = self.message_queue.pop(0)
            await self.ws.send(json.dumps(message))

    async def _message_loop(self):
        """Main message handling loop"""
        try:
            async for message in self.ws:
                await self._handle_message(message)
        except websockets.exceptions.ConnectionClosed:
            ColorPrint.yellow("Connection closed")
            self.connected = False
            self.authenticated = False
            self._stop_heartbeat()

            if self.on_disconnected:
                await self.on_disconnected()

            self._emit_event(EVENTS['DISCONNECT'], {})

            if self.reconnect:
                await self._attempt_reconnect()
        except Exception as error:
            ColorPrint.red(f"Message loop error: {error}")
            if self.on_error:
                await self.on_error(error)

    async def _handle_message(self, data: str):
        """Handle incoming message"""
        try:
            message = json.loads(data)
            ColorPrint.debug(f"Received message: {message.get('type')}")

            if self.heartbeat_timeout_timer:
                self.heartbeat_timeout_timer.cancel()
                self.heartbeat_timeout_timer = None

            msg_type = message.get('type')

            if msg_type == MSG_TYPES['WELCOME']:
                self.client_id = message.get('client_id')
                ColorPrint.green(f"Assigned client ID: {self.client_id}")
                if message.get('auth_required'):
                    ColorPrint.yellow("Server requires authentication")

            elif msg_type == MSG_TYPES['REQUEST']:
                await self._handle_request(message)

            elif msg_type == MSG_TYPES['RESPONSE']:
                await self._handle_response(message)

            elif msg_type == MSG_TYPES['EVENT']:
                await self._handle_event(message)

            elif msg_type == MSG_TYPES['ERROR']:
                ColorPrint.red(f"Server error: {message.get('error')}")
                self._emit_event(EVENTS['ERROR'], message)

            elif msg_type == MSG_TYPES['PING']:
                await self._handle_ping(message)

            elif msg_type == MSG_TYPES['AUTH_RESPONSE']:
                await self._handle_auth_response(message)

        except Exception as error:
            ColorPrint.red(f"Error handling message: {error}")
            for interceptor in self.error_interceptors:
                try:
                    await interceptor['handler'](error, {})
                except Exception:
                    pass

    async def _handle_ping(self, message: Dict):
        """Handle ping from server"""
        await self._send({
            'type': MSG_TYPES['PONG'],
            'timestamp': message.get('timestamp', asyncio.get_event_loop().time())
        })

    async def _handle_auth_response(self, message: Dict):
        """Handle authentication response"""
        request_id = message.get('id')
        pending = self.pending_requests.get(request_id)

        if pending and 'future' in pending:
            pending['future'].set_result(message)
            self.pending_requests.pop(request_id, None)

    async def _handle_request(self, message: Dict):
        """Handle request from server"""
        request_id = message.get('id')
        route = message.get('route')
        params = message.get('params')

        try:
            handler = self.routes.get(route)

            if not handler:
                await self._send({
                    'type': MSG_TYPES['RESPONSE'],
                    'id': request_id,
                    'success': False,
                    'code': ERROR_CODES['ROUTE_NOT_FOUND'],
                    'error': f'Route not found: {route}',
                    'timestamp': asyncio.get_event_loop().time()
                })
                return

            result = await handler(params)

            await self._send({
                'type': MSG_TYPES['RESPONSE'],
                'id': request_id,
                'success': True,
                'result': result,
                'timestamp': asyncio.get_event_loop().time()
            })

        except Exception as error:
            ColorPrint.red(f"Route error ({route}): {error}")

            await self._send({
                'type': MSG_TYPES['RESPONSE'],
                'id': request_id,
                'success': False,
                'code': ERROR_CODES['INTERNAL_ERROR'],
                'error': str(error),
                'timestamp': asyncio.get_event_loop().time()
            })

    async def _handle_response(self, message: Dict):
        """Handle response from server"""
        request_id = message.get('id')
        pending = self.pending_requests.get(request_id)

        if not pending or 'future' not in pending:
            return

        try:
            if message.get('success'):
                result = message.get('result')

                # Execute response interceptors
                for interceptor in self.response_interceptors:
                    try:
                        if interceptor['on_fulfilled']:
                            result = await interceptor['on_fulfilled'](result)
                    except Exception as error:
                        if interceptor['on_rejected']:
                            result = await interceptor['on_rejected'](error)
                        else:
                            raise

                pending['future'].set_result(result)
            else:
                error = Exception(message.get('error', 'Unknown error'))
                error.code = message.get('code')
                pending['future'].set_exception(error)

            self.pending_requests.pop(request_id, None)

        except Exception as error:
            ColorPrint.red(f"Response handling error: {error}")
            pending['future'].set_exception(error)
            self.pending_requests.pop(request_id, None)

    async def _handle_event(self, message: Dict):
        """Handle event from server"""
        event_name = message.get('event')
        data = message.get('data')
        self._emit_event(event_name, data)

    def _emit_event(self, event_name: str, data: Any):
        """Emit event to handlers"""
        handlers = self.event_handlers.get(event_name, [])
        for handler in handlers:
            try:
                asyncio.create_task(handler(data))
            except Exception as error:
                ColorPrint.red(f"Event handler error ({event_name}): {error}")

    async def _attempt_reconnect(self):
        """Attempt to reconnect"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            ColorPrint.red("Max reconnection attempts reached")
            self._emit_event(EVENTS['RECONNECT_FAILED'], {})
            return

        self.reconnect_attempts += 1
        ColorPrint.yellow(f"Reconnecting... (attempt {self.reconnect_attempts}/{self.max_reconnect_attempts})")

        if self.on_reconnecting:
            await self.on_reconnecting(self.reconnect_attempts)

        self._emit_event(EVENTS['RECONNECT'], {'attempt': self.reconnect_attempts})

        await asyncio.sleep(self.reconnect_interval)

        try:
            await self.connect()
        except Exception as error:
            ColorPrint.red(f"Reconnection failed: {error}")

    def is_connected(self) -> bool:
        """Check if connected"""
        return self.connected

    def is_authenticated(self) -> bool:
        """Check if authenticated"""
        return self.authenticated

    def get_client_id(self) -> Optional[str]:
        """Get client ID"""
        return self.client_id

    def get_auth_token(self) -> Optional[str]:
        """Get auth token"""
        return self.auth_token

    def get_pending_request_count(self) -> int:
        """Get pending request count"""
        return len(self.pending_requests)

    def get_queued_message_count(self) -> int:
        """Get queued message count"""
        return len(self.message_queue)
