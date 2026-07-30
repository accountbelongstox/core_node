# -*- coding: utf-8 -*-
"""
Unified HTTP Server - Always running, mode-aware server

Architecture:
- HTTP server always runs (started once at app launch)
- Mode switching via global_config (no server restart)
- PRIMARY mode: Serves files to clients
- SECONDARY mode: Syncs from primary server
- Both modes share the same HTTP server and web interface
"""

import json
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional

from pycore.pyutils.launcher.device_sync.core.config import (
    get_global_config,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.device_sync.core.database import get_sync_record_store
import pycore.pyutils.launcher.device_sync.routes as routes
from pycore.pyutils.launcher.device_sync.sse_protocol import serve_sync_events
from pycore.pyutils.launcher.device_sync.static_assets import serve_device_sync_asset

class UnifiedHTTPHandler(BaseHTTPRequestHandler):
    """
    Unified HTTP request handler

    Responds differently based on global_config.isPrimaryServer
    """

    def log_message(self, format, *args):
        """Override to use our logger"""
        ColorPrint.debug(f"{self.address_string()} - {format % args}")

    def do_GET(self):
        """Handle GET requests (mode-aware)"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        config = get_global_config()

        # ===== Public Endpoints (available in both modes) =====
        if path == routes.ROOT_PATH:
            self._handle_dashboard()
        elif path == routes.STATUS_PATH:
            self._handle_status()
        elif path == routes.DEVICES_PATH:
            self._handle_devices()

        # ===== PRIMARY Mode Endpoints =====
        elif config.isPrimaryServer:
            if path == routes.FILES_PATH:
                self._handle_files_list()
            elif path == routes.EVENTS_PATH:
                self._handle_sync_events()
            elif path.startswith(routes.FILE_PATH_PREFIX):
                self._handle_file_download(path)
            else:
                self.send_error(404, "Not Found")

        # ===== SECONDARY Mode Endpoints (GET) =====
        else:
            if path == routes.SYNC_STATUS_PATH:
                self._handle_sync_status()
            else:
                self.send_error(404, "Not Found")

    def do_POST(self):
        """Handle POST requests (SECONDARY mode sync control)"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        config = get_global_config()

        # Only SECONDARY mode can handle POST requests
        if config.isPrimaryServer:
            self.send_error(405, "Method Not Allowed - PRIMARY servers do not accept POST requests")
            return

        # ===== SECONDARY Mode POST Endpoints =====
        if path == routes.SYNC_START_PATH:
            self._handle_sync_start()
        elif path == routes.SYNC_STOP_PATH:
            self._handle_sync_stop()
        else:
            self.send_error(404, "Not Found")

    # ========== Common Handlers ==========

    def _handle_dashboard(self):
        serve_device_sync_asset(self, routes.ROOT_PATH)

    def _handle_status(self):
        """Handle /api/status - Return current mode status"""
        config = get_global_config()

        # Log current config state for debugging
        ColorPrint.debug(f"_handle_status: isPrimaryServer={config.isPrimaryServer}, api_enabled={config.api_enabled}")

        status = {
            'mode': 'primary' if config.isPrimaryServer else 'secondary',
            'isPrimaryServer': config.isPrimaryServer,
            'sync_enabled': config.sync_enabled,
            'api_enabled': config.api_enabled,
            'device_id': config.device_id,
            'hostname': config.hostname,
            'ip': config.local_ip,
            'http_port': config.http_port,
            'online_devices_count': config.online_devices_count,
            'primary_servers_count': len(config.primary_servers)
        }

        self._send_json(status)

    def _handle_devices(self):
        """Handle /api/devices - Return online devices"""
        config = get_global_config()
        self._send_json({'devices': config.online_devices})

    # ========== PRIMARY Mode Handlers ==========

    def _handle_files_list(self):
        """Handle /api/files - Return file list (PRIMARY mode only)"""
        config = get_global_config()
        record_store = get_sync_record_store()

        # Check API access permission
        if not config.api_enabled:
            self.send_error(403, "API access is disabled")
            return

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

        # Build file cache if needed
        if not config.file_cache:
            ColorPrint.info("Building file cache...")
            start_time = time.time()
            config.build_file_cache()
            duration = time.time() - start_time
            ColorPrint.info(f"File cache built: {len(config.file_cache)} files")

            # Record scan
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
        """Handle /api/file/{path} - Download file (PRIMARY mode only)"""
        config = get_global_config()
        record_store = get_sync_record_store()
        client_ip = self.client_address[0]

        # Check API access permission
        if not config.api_enabled:
            self.send_error(403, "API access is disabled")
            return

        # Extract file path
        file_path_encoded = path[len(routes.FILE_PATH_PREFIX):]
        file_path = urllib.parse.unquote(file_path_encoded)

        full_path = config.root_dir / file_path

        if not full_path.exists():
            record_store.record_transfer(None, 'download', file_path, 0, 'failed', client_ip, 'File not found')
            self.send_error(404, "File not found")
            return

        if not full_path.is_file():
            record_store.record_transfer(None, 'download', file_path, 0, 'failed', client_ip, 'Not a file')
            self.send_error(400, "Not a file")
            return

        # Send file
        try:
            with open(full_path, 'rb') as f:
                content = f.read()

            record_store.record_transfer(None, 'download', file_path, len(content), 'success', client_ip)

            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)

            ColorPrint.info(f"File downloaded by {client_ip}: {file_path} ({len(content)} bytes)")

        except Exception as e:
            record_store.record_transfer(None, 'download', file_path, 0, 'failed', client_ip, str(e))
            ColorPrint.error(f"Failed to send file {file_path}: {e}")
            self.send_error(500, f"Failed to read file: {e}")

    # ========== SECONDARY Mode Handlers ==========

    def _handle_sync_status(self):
        """Handle /api/sync/status - Return sync status (SECONDARY mode only)"""
        config = get_global_config()
        can_sync = self._can_enable_sync()

        status = {
            'sync_enabled': config.sync_enabled,
            'can_sync': can_sync['allowed'],
            'reason': can_sync['reason'],
            'primary_server_ip': config.primary_server_ip,
            'primary_servers_count': len(config.primary_servers),
            'primary_servers': config.primary_servers
        }

        self._send_json(status)

    def _handle_sync_start(self):
        """Handle /api/sync/start - Start sync (SECONDARY mode only)"""
        config = get_global_config()
        can_sync = self._can_enable_sync()

        if not can_sync['allowed']:
            self._send_json({'error': can_sync['reason']}, 400)
            return

        config.enable_sync()
        self._send_json({'status': 'ok', 'message': 'Sync started'})

    def _handle_sync_stop(self):
        """Handle /api/sync/stop - Stop sync (SECONDARY mode only)"""
        config = get_global_config()
        config.disable_sync()
        self._send_json({'status': 'ok', 'message': 'Sync stopped'})

    # ========== Helper Methods ==========

    def _can_enable_sync(self) -> dict:
        """
        Check if sync can be enabled

        Returns:
            {'allowed': bool, 'reason': str}
        """
        config = get_global_config()

        # Must be SECONDARY mode
        if config.isPrimaryServer:
            return {'allowed': False, 'reason': 'Cannot sync: This is a PRIMARY server'}

        # Must have exactly one PRIMARY server
        if len(config.primary_servers) == 0:
            return {'allowed': False, 'reason': 'No PRIMARY servers found on network'}

        if len(config.primary_servers) > 1:
            return {'allowed': False, 'reason': f'Multiple PRIMARY servers found ({len(config.primary_servers)}). Only one allowed.'}

        # Cannot connect to self
        primary = config.primary_servers[0]
        if primary['ip'] == config.local_ip:
            return {'allowed': False, 'reason': 'Cannot sync to self'}

        return {'allowed': True, 'reason': 'OK'}

    def _send_json(self, data: dict, status=200):
        """Send JSON response"""
        json_data = json.dumps(data, ensure_ascii=False, indent=2)

        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(json_data.encode('utf-8'))))
        # Disable browser caching for API responses
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.end_headers()
        self.wfile.write(json_data.encode('utf-8'))


class UnifiedHTTPServer:
    """
    Unified HTTP Server - Always running

    Starts once when app launches, never stops.
    Mode switching is handled via global_config, no server restart needed.
    """

    def __init__(self):
        """Initialize unified server"""
        self.config = get_global_config()
        self.server: Optional[ThreadingHTTPServer] = None
        self.running = False

    def start(self):
        """
        Start unified HTTP server (called once at app startup)

        This should be called from main() BEFORE tray menu starts.
        Server runs in main thread, tray runs on top of it.
        """
        if self.running:
            ColorPrint.warning("Server already running")
            return

        ColorPrint.info(f"Starting unified HTTP server on port {self.config.http_port}...")

        try:
            # Create HTTP server
            self.server = ThreadingHTTPServer(
                ('0.0.0.0', self.config.http_port),
                UnifiedHTTPHandler,
            )

            # Update network info if not set
            if not self.config.local_ip:
                self.config.update_network_info()

            self.running = True
            self.config.server_running = True

            ColorPrint.info(f"✓ Unified HTTP server started on {self.config.local_ip}:{self.config.http_port}")
            ColorPrint.info(f"  Current mode: {'PRIMARY' if self.config.isPrimaryServer else 'SECONDARY'}")
            ColorPrint.info(f"  Dashboard: http://{self.config.local_ip}:{self.config.http_port}/")

        except Exception as e:
            ColorPrint.error(f"Failed to start server: {e}")
            self.running = False
            raise

    def serve_forever(self):
        """
        Run server loop (blocking)

        This should be called from main thread.
        """
        if not self.server:
            raise RuntimeError("Server not started")

        try:
            self.server.serve_forever()
        except KeyboardInterrupt:
            ColorPrint.info("Server interrupted by user")
        except Exception as e:
            ColorPrint.error(f"Server error: {e}")
        finally:
            self.stop()

    def stop(self):
        """Stop unified HTTP server"""
        if not self.running:
            return

        ColorPrint.info("Stopping unified HTTP server...")

        self.running = False

        if self.server:
            self.server.shutdown()
            self.server.server_close()

        self.config.server_running = False

        ColorPrint.info("Unified HTTP server stopped")

    def is_running(self) -> bool:
        """Check if server is running"""
        return self.running


