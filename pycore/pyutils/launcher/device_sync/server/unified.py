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
import socket
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Optional

from ..core.config import get_global_config, DEFAULT_ROOT_DIR
from ..core.logging import setup_logging
from ..core.database import get_sync_database

import time


logger = setup_logging(__name__)


class UnifiedHTTPHandler(BaseHTTPRequestHandler):
    """
    Unified HTTP request handler

    Responds differently based on global_config.isPrimaryServer
    """

    def log_message(self, format, *args):
        """Override to use our logger"""
        logger.debug(f"{self.address_string()} - {format % args}")

    def do_GET(self):
        """Handle GET requests (mode-aware)"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        config = get_global_config()

        # ===== Public Endpoints (available in both modes) =====
        if path == '/':
            self._handle_dashboard()
        elif path == '/api/status':
            self._handle_status()
        elif path == '/api/devices':
            self._handle_devices()

        # ===== PRIMARY Mode Endpoints =====
        elif config.isPrimaryServer:
            if path == '/api/files':
                self._handle_files_list()
            elif path.startswith('/api/file/'):
                self._handle_file_download(path)
            else:
                self.send_error(404, "Not Found")

        # ===== SECONDARY Mode Endpoints (GET) =====
        else:
            if path == '/api/sync/status':
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
        if path == '/api/sync/start':
            self._handle_sync_start()
        elif path == '/api/sync/stop':
            self._handle_sync_stop()
        else:
            self.send_error(404, "Not Found")

    # ========== Common Handlers ==========

    def _handle_dashboard(self):
        """Handle / - Unified dashboard showing current mode"""
        config = get_global_config()
        db = get_sync_database()

        # Log current config state for debugging
        logger.info(f"_handle_dashboard: config id={id(config)}, isPrimaryServer={config.isPrimaryServer}, api_enabled={config.api_enabled}")

        mode = "PRIMARY SERVER" if config.isPrimaryServer else "SECONDARY CLIENT"
        mode_color = "#27ae60" if config.isPrimaryServer else "#3498db"

        # Get statistics
        db_stats = db.get_stats()
        recent_transfers = db.get_recent_transfers(limit=10)

        # Build mode-specific content
        if config.isPrimaryServer:
            mode_content = self._build_primary_content(config, db_stats)
        else:
            mode_content = self._build_secondary_content(config, db_stats)

        # Build transfers table
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

        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Device Sync - {mode}</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        h1 {{ color: #2c3e50; margin-bottom: 10px; }}
        .mode-badge {{ display: inline-block; padding: 8px 16px; border-radius: 5px; font-weight: bold; background: {mode_color}; color: white; }}
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
        .stats-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 15px 0; }}
        .stat-box {{ text-align: center; padding: 15px; background: #f8f9fa; border-radius: 5px; }}
        .stat-number {{ font-size: 24px; font-weight: bold; color: #3498db; }}
        .stat-label {{ font-size: 12px; color: #7f8c8d; margin-top: 5px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔄 Device Sync</h1>
        <div class="mode-badge">{mode}</div>
        <div class="subtitle">Auto-refresh every 30s</div>

        <div class="grid">
            <div class="card">
                <h2>📊 System Status</h2>
                <div class="info"><span class="label">Mode:</span> <span class="value">{mode}</span></div>
                <div class="info"><span class="label">Hostname:</span> <span class="value">{config.hostname}</span></div>
                <div class="info"><span class="label">IP Address:</span> <span class="value">{config.local_ip or 'Unknown'}</span></div>
                <div class="info"><span class="label">Port:</span> <span class="value">{config.http_port}</span></div>
                <div class="info"><span class="label">Root Dir:</span> <span class="value">{DEFAULT_ROOT_DIR}</span></div>
                <div class="info"><span class="label">Device ID:</span> <span class="value">{config.device_id[:16] if config.device_id else 'N/A'}...</span></div>
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
                        <div class="stat-number">{config.online_devices_count}</div>
                        <div class="stat-label">Devices</div>
                    </div>
                </div>
            </div>
        </div>

        {mode_content}

        <div class="card">
            {transfers_html}
        </div>
    </div>
</body>
</html>"""

        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        # Disable browser caching to ensure config changes are reflected immediately
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))

    def _build_primary_content(self, config, db_stats) -> str:
        """Build PRIMARY mode specific content"""
        # Connected clients
        clients_html = ""
        if config.connected_clients:
            clients_html = "<h3>Connected Clients</h3><ul>"
            for client in config.connected_clients:
                clients_html += f"""
                <li>
                    <strong>{client.get('ip', 'Unknown')}</strong>
                    {f" - {client.get('hostname', '')}" if client.get('hostname') else ""}
                </li>
                """
            clients_html += "</ul>"
        else:
            clients_html = "<h3>Connected Clients</h3><p>No clients currently connected</p>"

        # API endpoints
        endpoints_html = """
        <h3>API Endpoints</h3>
        <ul>
            <li><a href="/api/status">/api/status</a> - Server status</li>
            <li><a href="/api/files">/api/files</a> - File list (requires API access)</li>
            <li><a href="/api/devices">/api/devices</a> - Online devices</li>
        </ul>
        """

        return f"""
        <div class="grid">
            <div class="card">
                <h2>👥 Clients</h2>
                {clients_html}
            </div>
            <div class="card">
                <h2>🔗 API</h2>
                <div class="info"><span class="label">API Access:</span> <span class="status-badge {'enabled' if config.api_enabled else 'disabled'}">{('Enabled' if config.api_enabled else 'Disabled').upper()}</span></div>
                {endpoints_html}
            </div>
        </div>
        """

    def _build_secondary_content(self, config, db_stats) -> str:
        """Build SECONDARY mode specific content"""
        # Primary servers
        servers_html = ""
        if config.primary_servers:
            servers_html = "<h3>Available PRIMARY Servers</h3><ul>"
            for server in config.primary_servers:
                servers_html += f"""
                <li>
                    <strong>{server.get('ip', 'Unknown')}</strong>
                    {f" ({server.get('hostname', '')})" if server.get('hostname') else ""}
                </li>
                """
            servers_html += "</ul>"
        else:
            servers_html = "<h3>Available PRIMARY Servers</h3><p>No PRIMARY servers found on network</p>"

        # Sync status
        can_sync = self._can_enable_sync()
        sync_status_msg = ""
        if not can_sync['allowed']:
            sync_status_msg = f"<p style='color: #e74c3c;'>⚠️ {can_sync['reason']}</p>"
        else:
            sync_status_msg = "<p style='color: #27ae60;'>✓ Sync can be enabled</p>"

        return f"""
        <div class="grid">
            <div class="card">
                <h2>🔄 Sync Status</h2>
                <div class="info"><span class="label">Sync Enabled:</span> <span class="status-badge {'enabled' if config.sync_enabled else 'disabled'}">{('YES' if config.sync_enabled else 'NO')}</span></div>
                <div class="info"><span class="label">Primary Server:</span> <span class="value">{config.primary_server_ip or 'Not set'}</span></div>
                {sync_status_msg}
            </div>
            <div class="card">
                <h2>🌐 Network</h2>
                {servers_html}
            </div>
        </div>
        """

    def _handle_status(self):
        """Handle /api/status - Return current mode status"""
        config = get_global_config()

        # Log current config state for debugging
        logger.debug(f"_handle_status: isPrimaryServer={config.isPrimaryServer}, api_enabled={config.api_enabled}")

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
        db = get_sync_database()

        # Check API access permission
        if not config.api_enabled:
            self.send_error(403, "API access is disabled")
            return

        # Record connection
        client_ip = self.client_address[0]
        db.record_connection('client_connect', client_ip, request_path='/api/files')

        client_info = {'ip': client_ip, 'last_seen': time.time()}
        config.upsert_connected_client(client_info)

        if not config.root_dir or not config.root_dir.exists():
            self._send_json({'error': 'Root directory not found'}, 500)
            return

        # Build file cache if needed
        if not config.file_cache:
            logger.info("Building file cache...")
            start_time = time.time()
            config.build_file_cache()
            duration = time.time() - start_time
            logger.info(f"File cache built: {len(config.file_cache)} files")

            # Record scan
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
        """Handle /api/file/{path} - Download file (PRIMARY mode only)"""
        config = get_global_config()
        db = get_sync_database()
        client_ip = self.client_address[0]

        # Check API access permission
        if not config.api_enabled:
            self.send_error(403, "API access is disabled")
            return

        # Extract file path
        file_path_encoded = path[len('/api/file/'):]
        file_path = urllib.parse.unquote(file_path_encoded)

        full_path = config.root_dir / file_path

        if not full_path.exists():
            db.record_transfer(None, 'download', file_path, 0, 'failed', client_ip, 'File not found')
            self.send_error(404, "File not found")
            return

        if not full_path.is_file():
            db.record_transfer(None, 'download', file_path, 0, 'failed', client_ip, 'Not a file')
            self.send_error(400, "Not a file")
            return

        # Send file
        try:
            with open(full_path, 'rb') as f:
                content = f.read()

            db.record_transfer(None, 'download', file_path, len(content), 'success', client_ip)

            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)

            logger.info(f"File downloaded by {client_ip}: {file_path} ({len(content)} bytes)")

        except Exception as e:
            db.record_transfer(None, 'download', file_path, 0, 'failed', client_ip, str(e))
            logger.error(f"Failed to send file {file_path}: {e}")
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
        self.server: Optional[HTTPServer] = None
        self.running = False

    def start(self):
        """
        Start unified HTTP server (called once at app startup)

        This should be called from main() BEFORE tray menu starts.
        Server runs in main thread, tray runs on top of it.
        """
        if self.running:
            logger.warning("Server already running")
            return

        logger.info(f"Starting unified HTTP server on port {self.config.http_port}...")

        try:
            # Create HTTP server
            self.server = HTTPServer(('0.0.0.0', self.config.http_port), UnifiedHTTPHandler)

            # Update network info if not set
            if not self.config.local_ip:
                self.config.update_network_info()

            self.running = True
            self.config.server_running = True

            logger.info(f"✓ Unified HTTP server started on {self.config.local_ip}:{self.config.http_port}")
            logger.info(f"  Current mode: {'PRIMARY' if self.config.isPrimaryServer else 'SECONDARY'}")
            logger.info(f"  Dashboard: http://{self.config.local_ip}:{self.config.http_port}/")

        except Exception as e:
            logger.error(f"Failed to start server: {e}", exc_info=True)
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
            logger.info("Server interrupted by user")
        except Exception as e:
            logger.error(f"Server error: {e}", exc_info=True)
        finally:
            self.stop()

    def stop(self):
        """Stop unified HTTP server"""
        if not self.running:
            return

        logger.info("Stopping unified HTTP server...")

        self.running = False

        if self.server:
            self.server.shutdown()
            self.server.server_close()

        self.config.server_running = False

        logger.info("Unified HTTP server stopped")

    def is_running(self) -> bool:
        """Check if server is running"""
        return self.running
