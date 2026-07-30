# -*- coding: utf-8 -*-
"""
Simple Primary HTTP Server - Serves files to secondary devices

Only handles PRIMARY server functionality, no client logic.
Uses global_config for shared state.
"""

import json
from typing import Any, Optional
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import urllib.parse

from pycore.pyutils.launcher.device_sync.core.config import get_global_config
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.device_sync.core.database import get_sync_record_store
import pycore.pyutils.launcher.device_sync.routes as routes
from pycore.pyutils.launcher.device_sync.sse_protocol import serve_sync_events
from pycore.pyutils.launcher.device_sync.static_assets import serve_device_sync_asset

import time



class PrimaryServerHandler(BaseHTTPRequestHandler):
    """HTTP request handler for PRIMARY server"""

    def log_message(self, format, *args):
        """Override to use our logger"""
        ColorPrint.debug(f"{self.address_string()} - {format % args}")

    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        config = get_global_config()

        if path == routes.ROUTES_PATH:
            self._send_json(routes.PUBLIC_ROUTES)
            return
        if serve_device_sync_asset(self, path):
            return

        # Check API access control (except for root and status)
        if path.startswith(routes.API_PREFIX) and path not in routes.PUBLIC_API_PATHS:
            if not config.api_enabled:
                self.send_error(403, "API access is disabled")
                return

        # Route handling
        if path == routes.ROOT_PATH:
            self._handle_root()
        elif path == routes.STATUS_PATH:
            self._handle_status()
        elif path == routes.FILES_PATH:
            self._handle_files_list()
        elif path == routes.EVENTS_PATH:
            self._handle_sync_events()
        elif path.startswith(routes.FILE_PATH_PREFIX):
            self._handle_file_download(path)
        elif path == routes.DEVICES_PATH:
            self._handle_devices()
        else:
            self.send_error(404, "Not Found")

    def do_POST(self):
        """Handle POST requests"""
        self.send_error(405, "Method Not Allowed")

    def _handle_root(self):
        serve_device_sync_asset(self, routes.ROOT_PATH)

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
        record_store = get_sync_record_store()

        # Record connection
        client_ip = self.client_address[0]
        record_store.record_connection(
            'client_connect',
            client_ip,
            request_path=routes.FILES_PATH,
        )

        client_info = {'ip': client_ip, 'last_seen': time.time()}
        config.upsert_connected_client(client_info)

        if not config.root_dir or not config.root_dir.exists():
            self._send_json({'error': 'Root directory not found'}, 500)
            return

        # Build file cache if needed (use global cache)
        if not config.file_cache:
            ColorPrint.info("Building file cache...")
            start_time = time.time()
            config.build_file_cache()
            duration = time.time() - start_time
            ColorPrint.info(f"File cache built: {len(config.file_cache)} files")

            # Record the scan in the bounded history store
            record_store.record_scan(
                scan_type='full',
                files_found=len(config.file_cache),
                duration_seconds=duration,
                scan_node_modules=config.scan_node_modules
            )

        response = {
            'status': 'ok',
            'count': len(config.file_cache),
            'files': config.file_cache
        }

        self._send_json(response)

    def _handle_sync_events(self):
        """Hold an SSE connection and notify a SECONDARY when it should sync."""
        config = get_global_config()
        serve_sync_events(
            self,
            config,
            lambda: config.isPrimaryServer and config.server_running,
        )

    def _handle_file_download(self, path):
        """Handle /api/file/{path} - download file"""
        config = get_global_config()
        record_store = get_sync_record_store()
        client_ip = self.client_address[0]

        # Extract file path from URL
        file_path_encoded = path[len(routes.FILE_PATH_PREFIX):]
        file_path = urllib.parse.unquote(file_path_encoded)

        full_path = config.root_dir / file_path

        if not full_path.exists():
            # Record failed transfer
            record_store.record_transfer(
                session_id=None,
                operation='download',
                file_path=file_path,
                file_size=0,
                status='failed',
                remote_device=client_ip,
                error_message='File not found'
            )
            self.send_error(404, "File not found")
            return

        if not full_path.is_file():
            # Record failed transfer
            record_store.record_transfer(
                session_id=None,
                operation='download',
                file_path=file_path,
                file_size=0,
                status='failed',
                remote_device=client_ip,
                error_message='Not a file'
            )
            self.send_error(400, "Not a file")
            return

        # Send file
        try:
            with open(full_path, 'rb') as f:
                content = f.read()

            # Record successful transfer
            record_store.record_transfer(
                session_id=None,
                operation='download',
                file_path=file_path,
                file_size=len(content),
                status='success',
                remote_device=client_ip
            )

            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)

            ColorPrint.info(f"File downloaded by {client_ip}: {file_path} ({len(content)} bytes)")

        except Exception as e:
            # Record failed transfer
            record_store.record_transfer(
                session_id=None,
                operation='download',
                file_path=file_path,
                file_size=0,
                status='failed',
                remote_device=client_ip,
                error_message=str(e)
            )
            ColorPrint.error(f"Failed to send file {file_path}: {e}")
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
        self.server: Optional[ThreadingHTTPServer] = None
        self.server_thread: Optional[Any] = None
        self.running = False
        self._running_signal = f"device_sync.primary.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)

    def start(self):
        """Start PRIMARY server"""
        if self.running:
            ColorPrint.warning("Server already running")
            return

        ColorPrint.info(f"Starting PRIMARY server on port {self.config.http_port}...")

        try:
            # Create HTTP server
            self.server = ThreadingHTTPServer(
                ('0.0.0.0', self.config.http_port),
                PrimaryServerHandler,
            )

            # Update network info if not set
            if not self.config.local_ip:
                self.config.update_network_info()

            # Start server thread
            self.running = True
            THREAD_BUS.signal(self._running_signal, True)
            self.server_thread = start_bus_task(
                self._server_loop,
                thread_name="PrimaryServerThread",
            )

            self.config.server_running = True

            ColorPrint.info(f"✓ PRIMARY server started on {self.config.local_ip}:{self.config.http_port}")

        except Exception as e:
            ColorPrint.error(f"Failed to start server: {e}")
            self.running = False
            THREAD_BUS.signal(self._running_signal, False)
            raise

    def stop(self):
        """Stop PRIMARY server"""
        if not self.running:
            return

        ColorPrint.info("Stopping PRIMARY server...")

        self.running = False
        THREAD_BUS.signal(self._running_signal, False)

        if self.server:
            self.server.shutdown()
            self.server.server_close()

        if self.server_thread and self.server_thread.is_alive():
            self.server_thread.join(timeout=2)

        self.config.server_running = False

        ColorPrint.info("PRIMARY server stopped")

    def _server_loop(self):
        """Server main loop"""
        try:
            self.server.serve_forever()
        except Exception as e:
            if THREAD_BUS.get_signal(self._running_signal, False):
                ColorPrint.error(f"Server error: {e}")

    def is_running(self) -> bool:
        """Check if server is running"""
        return bool(THREAD_BUS.get_signal(self._running_signal, False))

