# -*- coding: utf-8 -*-
"""
Simple Primary HTTP Server - Serves files to secondary devices

Only handles PRIMARY server functionality, no client logic.
Uses global_config for shared state.
"""

import os
import json
import socket
from pathlib import Path
from typing import Any, Optional, Dict, List
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus import THREAD_BUS
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

from ..core.config import get_global_config, DEFAULT_ROOT_DIR
from ..core.logging import setup_logging
from ..core.database import get_sync_database

import time


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
        """Handle root path - comprehensive dashboard"""
        config = get_global_config()
        db = get_sync_database()

        # Get statistics
        db_stats = db.get_stats()
        recent_transfers = db.get_recent_transfers(limit=10)
        recent_scans = db.get_recent_scans(limit=5)
        recent_connections = db.get_recent_connections(limit=10)

        # Build connected clients HTML
        connected_clients_html = ""
        if config.connected_clients:
            connected_clients_html = "<h3>Connected Clients</h3><ul>"
            for client in config.connected_clients:
                connected_clients_html += f"""
                <li>
                    <strong>{client.get('ip', 'Unknown')}</strong>
                    {f" - {client.get('hostname', '')}" if client.get('hostname') else ""}
                    {f" ({client.get('device_id', '')[:8]}...)" if client.get('device_id') else ""}
                </li>
                """
            connected_clients_html += "</ul>"
        else:
            connected_clients_html = "<h3>Connected Clients</h3><p>No clients currently connected</p>"

        # Build online devices HTML
        online_devices_html = ""
        if config.online_devices:
            online_devices_html = "<h3>Network Devices</h3><ul>"
            for device in config.online_devices:
                device_mode = device.get('mode', 'unknown').upper()
                online_devices_html += f"""
                <li>
                    <strong>{device.get('ip', 'Unknown')}</strong> - {device_mode}
                    {f" ({device.get('hostname', '')})" if device.get('hostname') else ""}
                </li>
                """
            online_devices_html += "</ul>"
        else:
            online_devices_html = "<h3>Network Devices</h3><p>No other devices discovered</p>"

        # Build recent transfers HTML
        transfers_html = ""
        if recent_transfers:
            transfers_html = "<h3>Recent File Transfers</h3><table><tr><th>Time</th><th>Operation</th><th>File</th><th>Size</th><th>Status</th></tr>"
            for transfer in recent_transfers:
                size_mb = transfer['file_size'] / (1024 * 1024)
                transfers_html += f"""
                <tr>
                    <td>{transfer['timestamp']}</td>
                    <td>{transfer['operation']}</td>
                    <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">{transfer['file_path']}</td>
                    <td>{size_mb:.2f} MB</td>
                    <td class="status-{transfer['status']}">{transfer['status']}</td>
                </tr>
                """
            transfers_html += "</table>"
        else:
            transfers_html = "<h3>Recent File Transfers</h3><p>No transfers recorded</p>"

        # Build recent scans HTML
        scans_html = ""
        if recent_scans:
            scans_html = "<h3>Recent Scans</h3><table><tr><th>Time</th><th>Files Found</th><th>Duration</th><th>Scan node_modules</th></tr>"
            for scan in recent_scans:
                scans_html += f"""
                <tr>
                    <td>{scan['timestamp']}</td>
                    <td>{scan['files_found']}</td>
                    <td>{scan['duration_seconds']:.2f}s</td>
                    <td>{'Yes' if scan['scan_node_modules'] else 'No'}</td>
                </tr>
                """
            scans_html += "</table>"

        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Device Sync - PRIMARY Server Dashboard</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        h1 {{ color: #2c3e50; margin-bottom: 10px; }}
        .subtitle {{ color: #7f8c8d; margin-bottom: 30px; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }}
        .card {{ background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .card h2 {{ margin-top: 0; color: #34495e; font-size: 18px; border-bottom: 2px solid #3498db; padding-bottom: 10px; }}
        .card h3 {{ color: #2c3e50; font-size: 16px; margin-top: 20px; margin-bottom: 10px; }}
        .info {{ margin: 8px 0; line-height: 1.6; }}
        .label {{ font-weight: 600; color: #555; display: inline-block; min-width: 140px; }}
        .value {{ color: #2c3e50; }}
        .status-badge {{ display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: 600; }}
        .status-badge.active {{ background: #d4edda; color: #155724; }}
        .status-badge.enabled {{ background: #cce5ff; color: #004085; }}
        .status-badge.disabled {{ background: #f8d7da; color: #721c24; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }}
        th {{ background: #ecf0f1; padding: 8px; text-align: left; font-weight: 600; color: #2c3e50; }}
        td {{ padding: 8px; border-bottom: 1px solid #ecf0f1; }}
        tr:hover {{ background: #f8f9fa; }}
        .status-success {{ color: #27ae60; font-weight: 600; }}
        .status-failed {{ color: #e74c3c; font-weight: 600; }}
        ul {{ margin: 10px 0; padding-left: 20px; }}
        li {{ margin: 5px 0; }}
        a {{ color: #3498db; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        .stats-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 15px 0; }}
        .stat-box {{ text-align: center; padding: 15px; background: #f8f9fa; border-radius: 5px; }}
        .stat-number {{ font-size: 24px; font-weight: bold; color: #3498db; }}
        .stat-label {{ font-size: 12px; color: #7f8c8d; margin-top: 5px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔄 Device Sync - PRIMARY Server</h1>
        <div class="subtitle">Monitoring Dashboard (Auto-refresh every 30s)</div>

        <div class="grid">
            <div class="card">
                <h2>📊 Server Status</h2>
                <div class="info"><span class="label">Mode:</span> <span class="status-badge active">PRIMARY</span></div>
                <div class="info"><span class="label">Hostname:</span> <span class="value">{config.hostname}</span></div>
                <div class="info"><span class="label">IP Address:</span> <span class="value">{config.local_ip or 'Unknown'}</span></div>
                <div class="info"><span class="label">Port:</span> <span class="value">{config.http_port}</span></div>
                <div class="info"><span class="label">Root Dir:</span> <span class="value">{DEFAULT_ROOT_DIR}</span></div>
                <div class="info"><span class="label">Device ID:</span> <span class="value">{config.device_id[:16] if config.device_id else 'N/A'}...</span></div>
                <div class="info"><span class="label">API Access:</span> <span class="status-badge {'enabled' if config.api_enabled else 'disabled'}">{('Enabled' if config.api_enabled else 'Disabled').upper()}</span></div>
                <div class="info"><span class="label">Scan node_modules:</span> <span class="value">{'Yes' if config.scan_node_modules else 'No'}</span></div>
            </div>

            <div class="card">
                <h2>📈 Statistics</h2>
                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-number">{config.file_cache_count}</div>
                        <div class="stat-label">Files Cached</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">{config.total_scans}</div>
                        <div class="stat-label">Total Scans</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">{db_stats['total_transfers']}</div>
                        <div class="stat-label">Transfers</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">{len(config.connected_clients)}</div>
                        <div class="stat-label">Clients</div>
                    </div>
                </div>
                <div class="info"><span class="label">Last Scan:</span> <span class="value">{config.last_scan_time or 'Never'}</span></div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                {connected_clients_html}
                {online_devices_html}
            </div>

            <div class="card">
                <h2>🔗 API Endpoints</h2>
                <ul>
                    <li><a href="/api/status">/api/status</a> - Server status (always accessible)</li>
                    <li><a href="/api/files">/api/files</a> - File list (requires API access)</li>
                    <li><a href="/api/devices">/api/devices</a> - Online devices</li>
                </ul>
            </div>
        </div>

        <div class="card">
            {transfers_html}
        </div>

        <div class="card">
            {scans_html}
        </div>
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
        db = get_sync_database()

        # Record connection
        client_ip = self.client_address[0]
        db.record_connection('client_connect', client_ip, request_path='/api/files')

        # Add to connected clients list if not already there
        client_info = {'ip': client_ip, 'last_seen': time.time()}
        if not any(c['ip'] == client_ip for c in config.connected_clients):
            config.connected_clients.append(client_info)
        else:
            # Update last seen time
            for c in config.connected_clients:
                if c['ip'] == client_ip:
                    c['last_seen'] = time.time()

        if not config.root_dir or not config.root_dir.exists():
            self._send_json({'error': 'Root directory not found'}, 500)
            return

        # Build file cache if needed (use global cache)
        if not config.file_cache:
            logger.info("Building file cache...")
            start_time = time.time()
            config.build_file_cache()
            duration = time.time() - start_time
            logger.info(f"File cache built: {len(config.file_cache)} files")

            # Record scan to database
            db.record_scan(
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

    def _handle_file_download(self, path):
        """Handle /api/file/{path} - download file"""
        config = get_global_config()
        db = get_sync_database()
        client_ip = self.client_address[0]

        # Extract file path from URL
        file_path_encoded = path[len('/api/file/'):]
        file_path = urllib.parse.unquote(file_path_encoded)

        full_path = config.root_dir / file_path

        if not full_path.exists():
            # Record failed transfer
            db.record_transfer(
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
            db.record_transfer(
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
            db.record_transfer(
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

            logger.info(f"File downloaded by {client_ip}: {file_path} ({len(content)} bytes)")

        except Exception as e:
            # Record failed transfer
            db.record_transfer(
                session_id=None,
                operation='download',
                file_path=file_path,
                file_size=0,
                status='failed',
                remote_device=client_ip,
                error_message=str(e)
            )
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
        self.server_thread: Optional[Any] = None
        self.running = False
        self._running_signal = f"device_sync.primary.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)

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
            THREAD_BUS.signal(self._running_signal, True)
            self.server_thread = start_bus_task(
                self._server_loop,
                thread_name="PrimaryServerThread",
            )

            self.config.server_running = True

            logger.info(f"✓ PRIMARY server started on {self.config.local_ip}:{self.config.http_port}")

        except Exception as e:
            logger.error(f"Failed to start server: {e}", exc_info=True)
            self.running = False
            THREAD_BUS.signal(self._running_signal, False)
            raise

    def stop(self):
        """Stop PRIMARY server"""
        if not self.running:
            return

        logger.info("Stopping PRIMARY server...")

        self.running = False
        THREAD_BUS.signal(self._running_signal, False)

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
            if THREAD_BUS.get_signal(self._running_signal, False):
                logger.error(f"Server error: {e}", exc_info=True)

    def is_running(self) -> bool:
        """Check if server is running"""
        return bool(THREAD_BUS.get_signal(self._running_signal, False))
