#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTTP Bridge for GUI Communication
Provides HTTP server for web-based GUI to communicate with Python backend
"""

import json
import threading
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Callable, Dict, Any, Optional
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.color_print import ColorPrint


class HTTPBridgeHandler(BaseHTTPRequestHandler):
    """HTTP request handler for GUI bridge"""

    def log_message(self, format, *args):
        """Override to use custom logging"""
        logger = logging.getLogger('HTTPBridge')
        logger.info("%s - - [%s] %s" % (
            self.address_string(),
            self.log_date_time_string(),
            format % args
        ))

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-App-Namespace')
        self.end_headers()

    def do_GET(self):
        """Handle GET requests"""
        try:
            bridge = self.server.bridge_instance
            parsed_url = urlparse(self.path)
            path = parsed_url.path
            query_params = parse_qs(parsed_url.query)

            response_data = bridge.handle_get(path, query_params)
            self._send_json_response(200, response_data)

        except Exception as e:
            self._send_error_response(500, str(e))

    def do_POST(self):
        """Handle POST requests"""
        try:
            bridge = self.server.bridge_instance
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'

            try:
                request_data = json.loads(body)
            except json.JSONDecodeError:
                request_data = {}

            parsed_url = urlparse(self.path)
            path = parsed_url.path

            response_data = bridge.handle_post(path, request_data)
            self._send_json_response(200, response_data)

        except Exception as e:
            self._send_error_response(500, str(e))

    def _send_json_response(self, status_code: int, data: Dict[str, Any]):
        """Send JSON response with CORS headers"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response_json = json.dumps(data, ensure_ascii=False)
        self.wfile.write(response_json.encode('utf-8'))

    def _send_error_response(self, status_code: int, message: str):
        """Send error response"""
        self._send_json_response(status_code, {
            'error': True,
            'message': message
        })


class HTTPBridgeServer:
    """HTTP Bridge Server for GUI communication"""

    def __init__(self, host: str = '127.0.0.1', port: int = 8765):
        """
        Initialize HTTP bridge server

        Args:
            host: Server host address
            port: Server port number
        """
        self.host = host
        self.port = port
        self.server: Optional[HTTPServer] = None
        self.server_thread: Optional[threading.Thread] = None
        self.running = False
        self.logger = logging.getLogger('HTTPBridge')

        # Route handlers
        self.get_handlers: Dict[str, Callable] = {}
        self.post_handlers: Dict[str, Callable] = {}

        # Store instance in ENCYCLOPEDIA
        ENCYCLOPEDIA['http_bridge'] = self

        ColorPrint.blue(f"[HTTPBridge] Initialized on {host}:{port}")

    def register_get_handler(self, path: str, handler: Callable):
        """
        Register GET request handler

        Args:
            path: URL path (e.g., '/api/status')
            handler: Handler function that takes query_params and returns dict
        """
        self.get_handlers[path] = handler
        self.logger.info(f"Registered GET handler for {path}")

    def register_post_handler(self, path: str, handler: Callable):
        """
        Register POST request handler

        Args:
            path: URL path (e.g., '/api/command')
            handler: Handler function that takes request_data and returns dict
        """
        self.post_handlers[path] = handler
        self.logger.info(f"Registered POST handler for {path}")

    def handle_get(self, path: str, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle GET request"""
        handler = self.get_handlers.get(path)
        if handler:
            return handler(query_params)
        else:
            return {
                'error': True,
                'message': f'No handler registered for GET {path}'
            }

    def handle_post(self, path: str, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle POST request"""
        handler = self.post_handlers.get(path)
        if handler:
            return handler(request_data)
        else:
            return {
                'error': True,
                'message': f'No handler registered for POST {path}'
            }

    def start(self):
        """Start HTTP server in background thread"""
        if self.running:
            ColorPrint.yellow("[HTTPBridge] Server already running")
            return

        try:
            # Create custom HTTPServer class with bridge instance
            class BridgeHTTPServer(HTTPServer):
                bridge_instance = self

            self.server = BridgeHTTPServer((self.host, self.port), HTTPBridgeHandler)
            self.running = True

            # Start server in background thread
            self.server_thread = threading.Thread(target=self._run_server, daemon=True)
            self.server_thread.start()

            ColorPrint.green(f"[HTTPBridge] Server started on http://{self.host}:{self.port}")

        except Exception as e:
            ColorPrint.red(f"[HTTPBridge] Failed to start server: {e}")
            self.running = False

    def _run_server(self):
        """Run server loop"""
        try:
            self.server.serve_forever()
        except Exception as e:
            ColorPrint.red(f"[HTTPBridge] Server error: {e}")
            self.running = False

    def stop(self):
        """Stop HTTP server"""
        if not self.running:
            return

        self.running = False
        if self.server:
            self.server.shutdown()
            self.server.server_close()

        if self.server_thread:
            self.server_thread.join(timeout=2)

        ColorPrint.blue("[HTTPBridge] Server stopped")

    def is_running(self) -> bool:
        """Check if server is running"""
        return self.running


def get_http_bridge() -> Optional[HTTPBridgeServer]:
    """
    Get global HTTP bridge instance from ENCYCLOPEDIA

    Returns:
        HTTPBridgeServer instance or None if not initialized
    """
    return ENCYCLOPEDIA.get('http_bridge')


def create_http_bridge(host: str = '127.0.0.1', port: int = 8765) -> HTTPBridgeServer:
    """
    Create and return HTTP bridge instance

    Args:
        host: Server host address
        port: Server port number

    Returns:
        HTTPBridgeServer instance
    """
    bridge = get_http_bridge()
    if bridge is None:
        bridge = HTTPBridgeServer(host, port)
    return bridge
