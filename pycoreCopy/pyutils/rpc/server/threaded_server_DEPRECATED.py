#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Threaded RPC Server - Pure Thread-based (NO asyncio)

Direct Thread inheritance, no asyncio, no locks.
Uses queue-based message passing and state machines.

Architecture:
1. Main server thread handles HTTP requests
2. WebSocket connections managed in separate threads
3. Request processing uses thread pool
4. Heartbeat system handles timeouts and cleanup

NO asyncio, NO await, NO locks.
"""

import threading
import socket
import json
import time
import queue
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any, Optional, Callable
from enum import Enum
from dataclasses import dataclass, field

from pycore import ColorPrint
from pycore.database import DatabaseJSONEncoder
from pycore.pyutils.rpc.config.constants import RPC_CONSTANTS
from pycore.pyutils.rpc.common.request_event_table import RequestEventTable, RequestStatus
from pycore.pyutils.rpc.common.inventory_table import InventoryTable

MSG_TYPES = RPC_CONSTANTS.MESSAGE_TYPES
DEFAULTS = RPC_CONSTANTS.DEFAULTS
ERROR_CODES = RPC_CONSTANTS.ERROR_CODES
WS_PATH = RPC_CONSTANTS.WS_PATH
HTTP_PATH_PREFIX = RPC_CONSTANTS.HTTP_PATH_PREFIX


class ClientState(Enum):
    """Client connection states"""
    CONNECTED = 'connected'
    PROCESSING = 'processing'
    DISCONNECTED = 'disconnected'
    RECONNECTING = 'reconnecting'


@dataclass
class ClientInfo:
    """Client information (NO locks - atomic state machine)"""
    client_id: str
    ws_socket: Optional[socket.socket] = None
    state: ClientState = ClientState.CONNECTED
    connected_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    message_queue: queue.Queue = field(default_factory=queue.Queue)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ThreadedRpcServer(threading.Thread):
    """
    Thread-based RPC Server

    Direct Thread inheritance (NO asyncio).
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, '_initialized') and self._initialized:
            return

        super().__init__(name='RpcServerThread', daemon=True)

        self._initialized = True
        self._running = False
        self._stop_flag = False

        # Configuration
        self.host = '0.0.0.0'
        self.port = DEFAULTS['SERVER_PORT']
        self.debug = False

        # Clients (NO locks - atomic dict operations via GIL)
        self.clients: Dict[str, ClientInfo] = {}

        # Routes (handler functions)
        self.routes: Dict[str, Callable] = {}

        # Event tables
        self.request_event_table = RequestEventTable(max_size=10000000)
        self.inventory_table = InventoryTable(max_size=10000000)

        # Request queue (thread-safe)
        self._request_queue: queue.Queue = queue.Queue()

        # HTTP server
        self._http_server: Optional[HTTPServer] = None

        # Worker threads
        self._worker_threads = []

        # Static file directories
        self.static_dirs: Dict[str, str] = {}

        # Add default static directories (RPC client library)
        self._add_default_static_dirs()

    def _add_default_static_dirs(self):
        """
        Add default static directories (e.g., frontend JS libraries)
        This is called automatically during initialization.
        """
        from pathlib import Path
        # Get the RPC package directory
        rpc_package_dir = Path(__file__).parent.parent

        # Default: serve client JS libraries at /js/rpc
        client_js_dir = rpc_package_dir / 'client'
        if client_js_dir.exists():
            self.static_dirs['/js/rpc'] = str(client_js_dir.absolute())
            if self.debug:
                ColorPrint.blue(f"[ThreadedRpc] Added default static directory: /js/rpc -> {client_js_dir}")
        else:
            ColorPrint.yellow(f"[ThreadedRpc] Client JS directory not found: {client_js_dir}")

    def configure(self, host: str = '0.0.0.0', port: int = 8765, debug: bool = False):
        """Configure server before starting"""
        self.host = host
        self.port = port
        self.debug = debug

    def add_static_dir(self, url_prefix: str, directory: str):
        """
        Add static file directory

        Args:
            url_prefix: URL prefix (e.g., '/', '/static')
            directory: File system directory path
        """
        from pathlib import Path
        dir_path = Path(directory)
        if dir_path.exists() and dir_path.is_dir():
            self.static_dirs[url_prefix] = str(dir_path)
            if self.debug:
                ColorPrint.blue(f"[ThreadedRpc] Added static dir: {url_prefix} -> {directory}")
        else:
            ColorPrint.yellow(f"[ThreadedRpc] Static dir not found: {directory}")

    def route(self, name: str, handler: Callable):
        """
        Register RPC route

        Handler signature: handler(params: Dict, request_id: str, context: Dict) -> Any
        NO async - must be synchronous function.
        """
        self.routes[name] = handler
        if self.debug:
            ColorPrint.blue(f"[ThreadedRpc] Registered route: {name}")

    def run(self):
        """Main server thread (Thread.run())"""
        self._running = True
        ColorPrint.green(f"[ThreadedRpc] Server starting on {self.host}:{self.port}")

        # Start worker threads for request processing
        self._start_workers(num_workers=4)

        # Start HTTP server
        self._start_http_server()

        ColorPrint.green(f"[ThreadedRpc] Server started")
        ColorPrint.blue(f"[ThreadedRpc] HTTP RPC: http://{self.host}:{self.port}{HTTP_PATH_PREFIX}/<route>")

        # Main loop - process internal events
        while not self._stop_flag:
            time.sleep(0.1)

        self._running = False
        ColorPrint.blue("[ThreadedRpc] Server stopped")

    def _start_workers(self, num_workers: int = 4):
        """Start worker threads for request processing"""
        for i in range(num_workers):
            worker = threading.Thread(
                target=self._worker_loop,
                name=f'RpcWorker-{i}',
                daemon=True
            )
            worker.start()
            self._worker_threads.append(worker)

        if self.debug:
            ColorPrint.blue(f"[ThreadedRpc] Started {num_workers} worker threads")

    def _worker_loop(self):
        """Worker thread loop - process requests from queue"""
        while not self._stop_flag:
            try:
                # Get request from queue (blocking with timeout)
                request_data = self._request_queue.get(timeout=1.0)

                if request_data is None:
                    continue

                self._process_request(request_data)

            except queue.Empty:
                continue
            except Exception as e:
                if self.debug:
                    ColorPrint.red(f"[ThreadedRpc] Worker error: {e}")

    def _process_request(self, request_data: Dict):
        """
        Process a single request (runs in worker thread)

        NO locks - uses atomic state updates.
        """
        request_id = request_data.get('id', '')
        route = request_data.get('route', '')
        params = request_data.get('params', {})
        client_id = request_data.get('client_id', '')
        response_queue = request_data.get('response_queue')

        if self.debug:
            ColorPrint.blue(f"[ThreadedRpc] Processing: {route} (id={request_id})")

        # Get handler
        handler = self.routes.get(route)
        if not handler:
            error_response = {
                'id': request_id,
                'success': False,
                'error': f'Route not found: {route}',
                'result': None
            }
            if response_queue:
                response_queue.put(error_response)
            return

        # Store in event table
        event = self.request_event_table.create_event(
            request_id=request_id,
            route=route,
            params=params,
            client_id=client_id,
            client_type='http'
        )

        # Execute handler (synchronous)
        try:
            context = {
                'client_id': client_id,
                'request_id': request_id
            }
            result = handler(params, request_id, context)

            # Store result
            self.request_event_table.set_result(request_id, result, error=None)

            response = {
                'id': request_id,
                'success': True,
                'result': result,
                'error': None
            }

        except Exception as e:
            error_msg = str(e)
            self.request_event_table.set_result(request_id, None, error=error_msg)

            if self.debug:
                ColorPrint.red(f"[ThreadedRpc] Handler error: {e}")

            response = {
                'id': request_id,
                'success': False,
                'result': None,
                'error': error_msg
            }

        # Send response
        if response_queue:
            response_queue.put(response)

    def _start_http_server(self):
        """Start HTTP server in separate thread"""
        server_instance = self

        class RpcRequestHandler(BaseHTTPRequestHandler):
            """HTTP request handler for RPC"""

            def _set_cors_headers(self):
                """Set CORS headers for cross-origin requests"""
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', '*')
                self.send_header('Access-Control-Allow-Credentials', 'true')

            def do_OPTIONS(self):
                """Handle OPTIONS requests (CORS preflight)"""
                self.send_response(200)
                self._set_cors_headers()
                self.end_headers()

            def do_POST(self):
                """Handle POST requests"""
                if self.path.startswith(HTTP_PATH_PREFIX):
                    self._handle_rpc_request()
                else:
                    self.send_error(404, "Not Found")

            def do_GET(self):
                """Handle GET requests"""
                if self.path == '/health':
                    self._handle_health_check()
                elif self.path.startswith(f'{HTTP_PATH_PREFIX}/query/'):
                    self._handle_query_result()
                else:
                    # Try to serve static file
                    if not self._serve_static_file():
                        self.send_error(404, "Not Found")

            def _handle_rpc_request(self):
                """Handle RPC request"""
                # Extract route from path
                route = self.path[len(HTTP_PATH_PREFIX) + 1:]

                # Read request body
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)

                try:
                    data = json.loads(body)
                except json.JSONDecodeError:
                    self.send_error(400, "Invalid JSON")
                    return

                request_id = data.get('id', f"req_{time.time()}_{id(self)}")
                params = data.get('params', {})

                # Create response queue for this request
                response_queue = queue.Queue()

                # Queue request for worker
                server_instance._request_queue.put({
                    'id': request_id,
                    'route': route,
                    'params': params,
                    'client_id': str(id(self)),
                    'response_queue': response_queue
                })

                # Wait for response (with timeout)
                try:
                    response = response_queue.get(timeout=30.0)

                    # Send response with CORS headers
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self._set_cors_headers()
                    self.end_headers()

                    response_json = json.dumps(response)
                    self.wfile.write(response_json.encode('utf-8'))

                except queue.Empty:
                    self.send_error(504, "Gateway Timeout")

            def _handle_query_result(self):
                """Handle query result request"""
                # Extract request_id
                request_id = self.path.split('/')[-1]

                # Check event table
                event = server_instance.request_event_table.get_event(request_id)

                if event and event.status in [RequestStatus.COMPLETED, RequestStatus.FAILED]:
                    response = {
                        'id': request_id,
                        'status': 'completed' if event.status == RequestStatus.COMPLETED else 'failed',
                        'result': event.result,
                        'error': event.error,
                        'success': event.error is None
                    }
                else:
                    response = {
                        'id': request_id,
                        'status': 'pending',
                        'message': 'Request still processing'
                    }

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))

            def _handle_health_check(self):
                """Handle health check"""
                status = {
                    'status': 'ok',
                    'service': 'ThreadedRpcServer',
                    'routes': list(server_instance.routes.keys()),
                    'clients': len(server_instance.clients),
                    'running': server_instance._running
                }

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(status).encode('utf-8'))

            def _serve_static_file(self) -> bool:
                """
                Serve static files from registered directories

                Returns:
                    True if file was served, False if not found
                """
                from pathlib import Path
                import mimetypes

                # Normalize path
                url_path = self.path.split('?')[0]  # Remove query string
                if url_path == '/':
                    url_path = '/index.html'

                # Find matching static directory
                for url_prefix, dir_path in server_instance.static_dirs.items():
                    if url_path.startswith(url_prefix):
                        # Calculate file path
                        if url_prefix == '/':
                            relative_path = url_path[1:]  # Remove leading /
                        else:
                            relative_path = url_path[len(url_prefix):]
                            # Remove leading / from relative path (if any)
                            if relative_path.startswith('/'):
                                relative_path = relative_path[1:]

                        file_path = Path(dir_path) / relative_path

                        # Security: prevent directory traversal
                        try:
                            file_path = file_path.resolve()
                            base_path = Path(dir_path).resolve()
                            if not str(file_path).startswith(str(base_path)):
                                return False
                        except Exception:
                            return False

                        # Serve file if exists
                        if file_path.exists() and file_path.is_file():
                            try:
                                with open(file_path, 'rb') as f:
                                    content = f.read()

                                # Guess content type
                                content_type, _ = mimetypes.guess_type(str(file_path))
                                if content_type is None:
                                    content_type = 'application/octet-stream'

                                self.send_response(200)
                                self.send_header('Content-Type', content_type)
                                self.send_header('Content-Length', str(len(content)))
                                self._set_cors_headers()
                                self.end_headers()
                                self.wfile.write(content)
                                return True
                            except Exception as e:
                                if server_instance.debug:
                                    ColorPrint.red(f"[HTTP] Error serving file: {e}")
                                return False

                return False

            def log_message(self, format, *args):
                """Suppress default logging"""
                if server_instance.debug:
                    ColorPrint.gray(f"[HTTP] {format % args}")

        # Create and start HTTP server in thread
        self._http_server = HTTPServer((self.host, self.port), RpcRequestHandler)

        http_thread = threading.Thread(
            target=self._http_server.serve_forever,
            name='HttpServerThread',
            daemon=True
        )
        http_thread.start()

    def stop(self):
        """Stop server"""
        self._stop_flag = True

        if self._http_server:
            self._http_server.shutdown()

    def is_running(self) -> bool:
        return self._running and self.is_alive()

    def get_status(self) -> Dict[str, Any]:
        """Get server status"""
        return {
            'running': self._running,
            'host': self.host,
            'port': self.port,
            'routes': list(self.routes.keys()),
            'clients': len(self.clients),
            'workers': len(self._worker_threads),
            'pending_requests': self._request_queue.qsize()
        }


# Singleton accessor
_threaded_server: Optional[ThreadedRpcServer] = None


def get_threaded_rpc_server() -> ThreadedRpcServer:
    """Get global threaded RPC server instance"""
    global _threaded_server
    if _threaded_server is None:
        _threaded_server = ThreadedRpcServer()
    return _threaded_server


__all__ = [
    'ThreadedRpcServer',
    'get_threaded_rpc_server',
    'ClientState',
    'ClientInfo'
]
