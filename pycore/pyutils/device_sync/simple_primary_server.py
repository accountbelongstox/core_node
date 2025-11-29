# -*- coding: utf-8 -*-
"""
Simple Primary HTTP Server - Serves files to secondary devices

Only handles PRIMARY server functionality, no client logic.
Uses global_config for shared state.
"""

import os
import json
import threading
import socket
from pathlib import Path
from typing import Optional, Dict, List
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

from .global_config import get_global_config
from .logging_config import setup_logging

logger = setup_logging(__name__)


class PrimaryServerHandler(BaseHTTPRequestHandler):
    """HTTP request handler for PRIMARY server"""

    def log_message(self, format, *args):
        """Override to use our logger"""
        logger.debug(f"{self.address_string()} - {format % args}")

    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        config = get_global_config()

        # Check API access control (except for root and status)
        if path.startswith('/api/') and path != '/api/status':
            if not config.api_enabled:
                self.send_error(403, "API access is disabled")
                return

        # Route handling
        if path == '/':
            self._handle_root()
        elif path == '/api/status':
            self._handle_status()
        elif path == '/api/files':
            self._handle_files_list()
        elif path.startswith('/api/file/'):
            self._handle_file_download(path)
        elif path == '/api/devices':
            self._handle_devices()
        else:
            self.send_error(404, "Not Found")

    def do_POST(self):
        """Handle POST requests"""
        self.send_error(405, "Method Not Allowed")

    def _handle_root(self):
        """Handle root path - simple dashboard"""
        config = get_global_config()

        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Device Sync - PRIMARY Server</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }}
        .container {{ background: white; padding: 30px; border-radius: 8px; max-width: 800px; margin: 0 auto; }}
        h1 {{ color: #2c3e50; }}
        .status {{ background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; }}
        .info {{ margin: 10px 0; }}
        .label {{ font-weight: bold; color: #555; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Device Sync - PRIMARY Server</h1>
        <div class="status">
            <div class="info"><span class="label">Mode:</span> PRIMARY (File Server)</div>
            <div class="info"><span class="label">Hostname:</span> {config.hostname}</div>
            <div class="info"><span class="label">IP:</span> {config.local_ip or 'Unknown'}</div>
            <div class="info"><span class="label">Port:</span> {config.http_port}</div>
            <div class="info"><span class="label">Root Dir:</span> {config.root_dir}</div>
            <div class="info"><span class="label">Device ID:</span> {config.device_id}</div>
        </div>
        <h2>API Endpoints</h2>
        <ul>
            <li><a href="/api/status">/api/status</a> - Server status</li>
            <li><a href="/api/files">/api/files</a> - File list</li>
            <li><a href="/api/devices">/api/devices</a> - Online devices</li>
        </ul>
    </div>
</body>
</html>"""

        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))

    def _handle_status(self):
        """Handle /api/status"""
        config = get_global_config()

        status = {
            'mode': 'primary',
            'isPrimaryServer': True,
            'sync_enabled': False,  # Primary never syncs
            'api_enabled': config.api_enabled,
            'device_id': config.device_id,
            'hostname': config.hostname,
            'ip': config.local_ip,
            'http_port': config.http_port
        }

        self._send_json(status)

    def _handle_files_list(self):
        """Handle /api/files - return file list"""
        config = get_global_config()

        if not config.root_dir or not config.root_dir.exists():
            self._send_json({'error': 'Root directory not found'}, 500)
            return

        # Build file cache if needed (use global cache)
        if not config.file_cache:
            logger.info("Building file cache...")
            config.build_file_cache()
            logger.info(f"File cache built: {len(config.file_cache)} files")

        response = {
            'status': 'ok',
            'count': len(config.file_cache),
            'files': config.file_cache
        }

        self._send_json(response)

    def _handle_file_download(self, path):
        """Handle /api/file/{path} - download file"""
        config = get_global_config()

        # Extract file path from URL
        file_path_encoded = path[len('/api/file/'):]
        file_path = urllib.parse.unquote(file_path_encoded)

        full_path = config.root_dir / file_path

        if not full_path.exists():
            self.send_error(404, "File not found")
            return

        if not full_path.is_file():
            self.send_error(400, "Not a file")
            return

        # Send file
        try:
            with open(full_path, 'rb') as f:
                content = f.read()

            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        except Exception as e:
            logger.error(f"Failed to send file {file_path}: {e}")
            self.send_error(500, f"Failed to read file: {e}")

    def _handle_devices(self):
        """Handle /api/devices - return online devices"""
        config = get_global_config()
        self._send_json({'devices': config.online_devices})

    def _send_json(self, data: dict, status=200):
        """Send JSON response"""
        json_data = json.dumps(data, ensure_ascii=False, indent=2)

        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(json_data.encode('utf-8'))))
        self.end_headers()
        self.wfile.write(json_data.encode('utf-8'))


class SimplePrimaryServer:
    """
    Simple PRIMARY HTTP Server

    Only serves files to secondary devices.
    Uses global_config for shared state.
    """

    def __init__(self):
        """Initialize primary server"""
        self.config = get_global_config()
        self.server: Optional[HTTPServer] = None
        self.server_thread: Optional[threading.Thread] = None
        self.running = False

    def start(self):
        """Start PRIMARY server"""
        if self.running:
            logger.warning("Server already running")
            return

        logger.info(f"Starting PRIMARY server on port {self.config.http_port}...")

        try:
            # Create HTTP server
            self.server = HTTPServer(('0.0.0.0', self.config.http_port), PrimaryServerHandler)

            # Update network info if not set
            if not self.config.local_ip:
                self.config.update_network_info()

            # Start server thread
            self.running = True
            self.server_thread = threading.Thread(target=self._server_loop, daemon=True)
            self.server_thread.start()

            self.config.server_running = True

            logger.info(f"✓ PRIMARY server started on {self.config.local_ip}:{self.config.http_port}")

        except Exception as e:
            logger.error(f"Failed to start server: {e}", exc_info=True)
            self.running = False
            raise

    def stop(self):
        """Stop PRIMARY server"""
        if not self.running:
            return

        logger.info("Stopping PRIMARY server...")

        self.running = False

        if self.server:
            self.server.shutdown()
            self.server.server_close()

        if self.server_thread and self.server_thread.is_alive():
            self.server_thread.join(timeout=2)

        self.config.server_running = False

        logger.info("PRIMARY server stopped")

    def _server_loop(self):
        """Server main loop"""
        try:
            self.server.serve_forever()
        except Exception as e:
            if self.running:
                logger.error(f"Server error: {e}", exc_info=True)

    def is_running(self) -> bool:
        """Check if server is running"""
        return self.running
