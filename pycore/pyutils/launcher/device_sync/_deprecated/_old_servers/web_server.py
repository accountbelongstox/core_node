# -*- coding: utf-8 -*-
"""
Device Sync Web Server - HTTP API and Web UI

Provides web interface and RESTful API for device synchronization.

Features:
- Web UI dashboard (HTML)
- RESTful API
- File statistics
- Device status
- Network discovery information

Port: 8080 (default)
"""

import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional, Dict, Any
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pathlib import Path
import urllib.parse


class DeviceSyncWebHandler(BaseHTTPRequestHandler):
    """HTTP request handler for Device Sync web interface."""

    def log_message(self, format, *args):
        """Override to customize logging."""
        print(f"[WebServer] {self.address_string()} - {format % args}")

    def do_GET(self):
        """Handle GET requests."""
        # Parse URL
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path

        # Route requests
        if path == '/' or path == '/index.html':
            self._serve_dashboard()
        elif path == '/api/status':
            self._serve_api_status()
        elif path == '/api/files':
            self._serve_api_files()
        elif path == '/api/stats':
            self._serve_api_stats()
        else:
            self._serve_404()

    def _serve_dashboard(self):
        """Serve web dashboard HTML."""
        html = self._generate_dashboard_html()
        self._send_html_response(html)

    def _serve_api_status(self):
        """Serve device status API."""
        # Get server instance from handler class
        server = self.server
        sync_server = getattr(server, 'sync_server', None)

        status = {
            'mode': 'primary',
            'running': True,
            'port': getattr(sync_server, 'port', 45679) if sync_server else 45679,
            'root_dir': str(getattr(sync_server, 'root_dir', '')) if sync_server else '',
            'web_port': server.server_port
        }

        self._send_json_response(status)

    def _serve_api_files(self):
        """Serve file list API."""
        server = self.server
        sync_server = getattr(server, 'sync_server', None)

        if sync_server:
            files = list(sync_server.file_cache.values())
        else:
            files = []

        response = {
            'count': len(files),
            'files': files[:100]  # Limit to first 100
        }

        self._send_json_response(response)

    def _serve_api_stats(self):
        """Serve statistics API."""
        server = self.server
        sync_server = getattr(server, 'sync_server', None)

        if sync_server:
            stats = sync_server.get_cache_stats()
        else:
            stats = {
                'file_count': 0,
                'total_size_mb': 0
            }

        self._send_json_response(stats)

    def _serve_404(self):
        """Serve 404 Not Found."""
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()

        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Not Found</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: #e74c3c; }
            </style>
        </head>
        <body>
            <h1>404 - Page Not Found</h1>
            <p><a href="/">Back to Dashboard</a></p>
        </body>
        </html>
        """

        self.wfile.write(html.encode('utf-8'))

    def _send_html_response(self, html: str):
        """Send HTML response."""
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))

    def _send_json_response(self, data: Dict[str, Any]):
        """Send JSON response."""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8'))

    def _generate_dashboard_html(self) -> str:
        """Generate dashboard HTML."""
        server = self.server
        sync_server = getattr(server, 'sync_server', None)

        # Get server info
        if sync_server:
            stats = sync_server.get_cache_stats()
            root_dir = str(sync_server.root_dir)
            sync_port = sync_server.port
        else:
            stats = {'file_count': 0, 'total_size_mb': 0}
            root_dir = 'N/A'
            sync_port = 45679

        web_port = server.server_port

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Device Sync - Primary Server</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}

        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}

        .header {{
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }}

        .header h1 {{
            color: #667eea;
            font-size: 32px;
            margin-bottom: 10px;
        }}

        .status-badge {{
            display: inline-block;
            background: #27ae60;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
        }}

        .cards {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }}

        .card {{
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }}

        .card h2 {{
            color: #2c3e50;
            font-size: 18px;
            margin-bottom: 15px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }}

        .stat-row {{
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #ecf0f1;
        }}

        .stat-row:last-child {{
            border-bottom: none;
        }}

        .stat-label {{
            color: #7f8c8d;
            font-weight: 500;
        }}

        .stat-value {{
            color: #2c3e50;
            font-weight: bold;
        }}

        .api-section {{
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }}

        .api-section h2 {{
            color: #2c3e50;
            margin-bottom: 20px;
        }}

        .api-endpoint {{
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 5px;
        }}

        .api-endpoint .method {{
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 3px 10px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 10px;
        }}

        .api-endpoint .path {{
            font-family: 'Courier New', monospace;
            color: #2c3e50;
            font-weight: bold;
        }}

        .api-endpoint .description {{
            color: #7f8c8d;
            margin-top: 8px;
            font-size: 14px;
        }}

        .refresh-btn {{
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            margin-top: 20px;
            transition: background 0.3s;
        }}

        .refresh-btn:hover {{
            background: #5568d3;
        }}

        @media (max-width: 768px) {{
            .cards {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🔄 Device Sync - Primary Server</h1>
            <span class="status-badge">● RUNNING</span>
        </div>

        <!-- Stats Cards -->
        <div class="cards">
            <!-- Server Info -->
            <div class="card">
                <h2>📡 Server Information</h2>
                <div class="stat-row">
                    <span class="stat-label">Sync Port</span>
                    <span class="stat-value">{sync_port}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Web Port</span>
                    <span class="stat-value">{web_port}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Root Directory</span>
                    <span class="stat-value" style="font-size: 12px;">{root_dir}</span>
                </div>
            </div>

            <!-- File Stats -->
            <div class="card">
                <h2>📁 File Statistics</h2>
                <div class="stat-row">
                    <span class="stat-label">Total Files</span>
                    <span class="stat-value" id="file-count">{stats.get('file_count', 0)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Total Size</span>
                    <span class="stat-value" id="total-size">{stats.get('total_size_mb', 0)} MB</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Status</span>
                    <span class="stat-value" style="color: #27ae60;">Active</span>
                </div>
            </div>

            <!-- Device Mode -->
            <div class="card">
                <h2>⚙️ Device Mode</h2>
                <div class="stat-row">
                    <span class="stat-label">Mode</span>
                    <span class="stat-value" style="color: #667eea;">PRIMARY</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Function</span>
                    <span class="stat-value">File Server</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Clients</span>
                    <span class="stat-value">Ready</span>
                </div>
            </div>
        </div>

        <!-- API Documentation -->
        <div class="api-section">
            <h2>📚 API Endpoints</h2>

            <div class="api-endpoint">
                <span class="method">GET</span>
                <span class="path">/api/status</span>
                <div class="description">Get server status and configuration</div>
            </div>

            <div class="api-endpoint">
                <span class="method">GET</span>
                <span class="path">/api/files</span>
                <div class="description">Get list of cached files (first 100)</div>
            </div>

            <div class="api-endpoint">
                <span class="method">GET</span>
                <span class="path">/api/stats</span>
                <div class="description">Get file synchronization statistics</div>
            </div>

            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Dashboard</button>
        </div>
    </div>

    <script>
        // Auto-refresh stats every 10 seconds
        setInterval(() => {{
            fetch('/api/stats')
                .then(res => res.json())
                .then(data => {{
                    document.getElementById('file-count').textContent = data.file_count || 0;
                    document.getElementById('total-size').textContent = (data.total_size_mb || 0) + ' MB';
                }})
                .catch(err => console.error('Failed to refresh stats:', err));
        }}, 10000);
    </script>
</body>
</html>
        """

        return html


class DeviceSyncWebServer:
    """
    Web server for Device Sync.

    Provides web UI and RESTful API.
    """

    def __init__(self, port: int = 8080, sync_server=None):
        """
        Initialize web server.

        Args:
            port: Web server port
            sync_server: FileSyncServer instance
        """
        self.port = port
        self.sync_server = sync_server
        self.running = False
        self.server: Optional[HTTPServer] = None
        self.server_thread: Optional[Any] = None
        self._running_signal = f"device_sync.legacy_web.running.{id(self)}"
        THREAD_BUS.signal(self._running_signal, False)

    def start(self) -> bool:
        """
        Start web server.

        Returns:
            True if started successfully
        """
        if self.running:
            return True

        try:
            # Create server
            self.server = HTTPServer(('0.0.0.0', self.port), DeviceSyncWebHandler)
            self.server.sync_server = self.sync_server

            # Start server thread
            self.running = True
            THREAD_BUS.signal(self._running_signal, True)
            self.server_thread = start_bus_task(
                self._server_loop,
                thread_name="LegacyWebServerThread",
            )

            print(f"[WebServer] Started on port {self.port}")
            print(f"[WebServer] Access at: http://localhost:{self.port}")

            return True

        except Exception as e:
            print(f"[WebServer] Failed to start: {e}")
            return False

    def _server_loop(self):
        """Server loop (runs in thread)."""
        while THREAD_BUS.get_signal(self._running_signal, False):
            try:
                self.server.handle_request()
            except Exception as e:
                if THREAD_BUS.get_signal(self._running_signal, False):
                    print(f"[WebServer] Error: {e}")

    def stop(self):
        """Stop web server."""
        self.running = False
        THREAD_BUS.signal(self._running_signal, False)

        if self.server:
            self.server.shutdown()
            self.server.server_close()

        print("[WebServer] Stopped")

    def get_url(self) -> str:
        """Get web server URL."""
        return f"http://localhost:{self.port}"
