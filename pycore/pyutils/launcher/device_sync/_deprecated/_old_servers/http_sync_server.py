# -*- coding: utf-8 -*-
"""
HTTP File Sync Server - Unified HTTP API

Uses HTTP/REST API for all operations (file sync + web UI).

Port: 58923 (unique, unlikely to be occupied)

API Endpoints:
- GET  /                      -> Web UI Dashboard
- GET  /api/discover          -> Discovery response (returns "PRIMARY")
- GET  /api/ping              -> Health check (returns "PONG")
- GET  /api/status            -> Server status
- GET  /api/files             -> File list
- GET  /api/file/<path>       -> Download file
- GET  /api/stats             -> Statistics
"""

import threading
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional, Dict, List
from pathlib import Path
import urllib.parse
import socket

# Import logging
from .logging_config import setup_logging

import time


# Set up logger
logger = setup_logging(__name__)

DEFAULT_HTTP_PORT = 58923  # Unique port, unlikely to be occupied


class FileSyncHTTPHandler(BaseHTTPRequestHandler):
    """HTTP handler for file synchronization and web UI."""

    def log_message(self, format, *args):
        """Override to customize logging."""
        logger.info(f"{self.address_string()} - {format % args}")

    def do_GET(self):
        """Handle GET requests."""
        # Parse URL
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path

        # Route requests
        if path == '/' or path == '/index.html':
            self._serve_dashboard()
        elif path == '/api/discover':
            self._serve_discover()
        elif path == '/api/ping':
            self._serve_ping()
        elif path == '/api/status':
            self._serve_status()
        elif path == '/api/files':
            self._serve_files()
        elif path.startswith('/api/file/'):
            # Extract file path
            file_path = path[10:]  # Remove '/api/file/'
            self._serve_file(file_path)
        elif path == '/api/stats':
            self._serve_stats()
        else:
            self._serve_404()

    def _serve_discover(self):
        """Serve discovery response (for network discovery)."""
        response = {'status': 'PRIMARY', 'port': self.server.server_port}
        self._send_json_response(response)

    def _serve_ping(self):
        """Serve ping response (health check)."""
        response = {'status': 'PONG', 'timestamp': self._get_timestamp()}
        self._send_json_response(response)

    def _serve_status(self):
        """Serve server status."""
        server = self.server
        http_server = getattr(server, 'http_server', None)

        if http_server:
            root_dir = str(http_server.root_dir)
            file_count = len(http_server.file_cache)
        else:
            root_dir = ''
            file_count = 0

        status = {
            'mode': 'primary',
            'running': True,
            'port': server.server_port,
            'root_dir': root_dir,
            'file_count': file_count,
            'timestamp': self._get_timestamp()
        }

        self._send_json_response(status)

    def _serve_files(self):
        """Serve file list."""
        server = self.server
        http_server = getattr(server, 'http_server', None)

        if http_server:
            files = list(http_server.file_cache.values())
        else:
            files = []

        response = {
            'status': 'ok',
            'count': len(files),
            'files': files
        }

        self._send_json_response(response)

    def _serve_file(self, file_path: str):
        """Serve individual file for download."""
        server = self.server
        http_server = getattr(server, 'http_server', None)

        if not http_server:
            self._serve_error(500, "Server not initialized")
            return

        # Decode URL-encoded path
        file_path = urllib.parse.unquote(file_path)

        # Get full path
        full_path = http_server.root_dir / file_path

        # Security: Prevent directory traversal
        try:
            full_path = full_path.resolve()
            if not str(full_path).startswith(str(http_server.root_dir)):
                self._serve_error(403, "Access denied")
                return
        except Exception:
            self._serve_error(400, "Invalid path")
            return

        # Check if file exists
        if not full_path.exists() or not full_path.is_file():
            self._serve_error(404, "File not found")
            return

        # Serve file
        try:
            with open(full_path, 'rb') as f:
                content = f.read()

            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Content-Disposition', f'attachment; filename="{full_path.name}"')
            self.end_headers()
            self.wfile.write(content)

        except Exception as e:
            self._serve_error(500, f"Failed to read file: {e}")

    def _serve_stats(self):
        """Serve statistics."""
        server = self.server
        http_server = getattr(server, 'http_server', None)

        if http_server:
            stats = http_server.get_cache_stats()
        else:
            stats = {'file_count': 0, 'total_size_mb': 0}

        self._send_json_response(stats)

    def _serve_dashboard(self):
        """Serve web dashboard."""
        html = self._generate_dashboard_html()
        self._send_html_response(html)

    def _serve_404(self):
        """Serve 404 Not Found."""
        self._serve_error(404, "Page not found")

    def _serve_error(self, code: int, message: str):
        """Serve error response."""
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()

        error = {'error': message, 'code': code}
        self.wfile.write(json.dumps(error).encode('utf-8'))

    def _send_html_response(self, html: str):
        """Send HTML response."""
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))

    def _send_json_response(self, data: Dict):
        """Send JSON response."""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8'))

    def _get_timestamp(self) -> float:
        """Get current timestamp."""
        return time.time()

    def _generate_dashboard_html(self) -> str:
        """Generate dashboard HTML."""
        server = self.server
        http_server = getattr(server, 'http_server', None)

        if http_server:
            stats = http_server.get_cache_stats()
            root_dir = str(http_server.root_dir)
        else:
            stats = {'file_count': 0, 'total_size_mb': 0}
            root_dir = 'N/A'

        port = server.server_port

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Device Sync - HTTP Server</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }}
        .header h1 {{ color: #667eea; font-size: 32px; margin-bottom: 10px; }}
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
        .stat-row:last-child {{ border-bottom: none; }}
        .stat-label {{ color: #7f8c8d; font-weight: 500; }}
        .stat-value {{ color: #2c3e50; font-weight: bold; }}
        .api-section {{
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }}
        .api-section h2 {{ color: #2c3e50; margin-bottom: 20px; }}
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
        .refresh-btn:hover {{ background: #5568d3; }}
        .port-info {{
            background: #e8f5e9;
            border-left: 4px solid #27ae60;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }}
        .port-info strong {{ color: #27ae60; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔄 Device Sync - HTTP Server</h1>
            <span class="status-badge">● RUNNING</span>
        </div>

        <div class="port-info">
            <strong>📡 HTTP Port: {port}</strong> (Unified sync + web UI)
        </div>

        <div class="cards">
            <div class="card">
                <h2>📡 Server Information</h2>
                <div class="stat-row">
                    <span class="stat-label">HTTP Port</span>
                    <span class="stat-value">{port}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Protocol</span>
                    <span class="stat-value">HTTP/REST API</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Root Directory</span>
                    <span class="stat-value" style="font-size: 12px;">{root_dir}</span>
                </div>
            </div>

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

            <div class="card">
                <h2>⚙️ Device Mode</h2>
                <div class="stat-row">
                    <span class="stat-label">Mode</span>
                    <span class="stat-value" style="color: #667eea;">PRIMARY</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Protocol</span>
                    <span class="stat-value">HTTP</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Clients</span>
                    <span class="stat-value">Ready</span>
                </div>
            </div>
        </div>

        <div class="api-section">
            <h2>📚 API Endpoints (HTTP)</h2>

            <div class="api-endpoint">
                <span class="method">GET</span>
                <span class="path">/api/discover</span>
                <div class="description">Network discovery endpoint (returns PRIMARY status)</div>
            </div>

            <div class="api-endpoint">
                <span class="method">GET</span>
                <span class="path">/api/ping</span>
                <div class="description">Health check (returns PONG)</div>
            </div>

            <div class="api-endpoint">
                <span class="method">GET</span>
                <span class="path">/api/status</span>
                <div class="description">Get server status and configuration</div>
            </div>

            <div class="api-endpoint">
                <span class="method">GET</span>
                <span class="path">/api/files</span>
                <div class="description">Get list of all files</div>
            </div>

            <div class="api-endpoint">
                <span class="method">GET</span>
                <span class="path">/api/file/&lt;path&gt;</span>
                <div class="description">Download specific file</div>
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


class HTTPFileSyncServer:
    """
    HTTP-based file synchronization server.

    Uses standard HTTP/REST API for all operations.
    Port: 58923 (unique, unlikely to be occupied)
    """

    def __init__(self, root_dir: str, port: int = DEFAULT_HTTP_PORT):
        """
        Initialize HTTP sync server.

        Args:
            root_dir: Root directory to serve
            port: HTTP server port (default: 58923)
        """
        self.root_dir = Path(root_dir)
        self.port = port
        self.running = False
        self.server: Optional[HTTPServer] = None
        self.server_thread: Optional[threading.Thread] = None

        # File metadata cache
        self.file_cache: Dict[str, Dict] = {}
        self.cache_lock = threading.Lock()

        # Build initial cache
        self._rebuild_cache()

    def start(self) -> bool:
        """
        Start HTTP server.

        Returns:
            True if started successfully
        """
        if self.running:
            return True

        try:
            # Create HTTP server
            self.server = HTTPServer(('0.0.0.0', self.port), FileSyncHTTPHandler)
            self.server.http_server = self

            # Start server thread
            self.running = True
            self.server_thread = threading.Thread(target=self._server_loop, daemon=True)
            self.server_thread.start()

            logger.info(f"Started on port {self.port}")
            logger.info(f"Root directory: {self.root_dir}")
            logger.info(f"Access at: http://localhost:{self.port}")

            return True

        except Exception as e:
            logger.error(f"Failed to start: {e}", exc_info=True)
            return False

    def _server_loop(self):
        """Server loop (runs in thread)."""
        try:
            self.server.serve_forever()
        except Exception as e:
            if self.running:
                logger.error(f"Server error: {e}", exc_info=True)

    def stop(self):
        """Stop HTTP server."""
        self.running = False

        if self.server:
            try:
                self.server.shutdown()
                self.server.server_close()
            except Exception as e:
                logger.error(f"Error stopping server: {e}", exc_info=True)

        logger.info("Stopped")

    def _rebuild_cache(self):
        """Rebuild file metadata cache."""
        logger.info(f"Building file cache from {self.root_dir}")

        new_cache = {}

        try:
            for file_path in self.root_dir.rglob('*'):
                if not file_path.is_file():
                    continue

                # Skip hidden files and directories
                if any(part.startswith('.') for part in file_path.parts):
                    continue

                # Get relative path
                rel_path = file_path.relative_to(self.root_dir)

                # Get file metadata
                stat = file_path.stat()

                new_cache[str(rel_path)] = {
                    'path': str(rel_path).replace('\\', '/'),
                    'size': stat.st_size,
                    'mtime': stat.st_mtime
                }

            with self.cache_lock:
                self.file_cache = new_cache

            logger.info(f"Cached {len(new_cache)} files")

        except Exception as e:
            logger.error(f"Error building cache: {e}", exc_info=True)

    def get_cache_stats(self) -> Dict:
        """
        Get cache statistics.

        Returns:
            Stats dict
        """
        with self.cache_lock:
            total_size = sum(f['size'] for f in self.file_cache.values())

            return {
                'file_count': len(self.file_cache),
                'total_size': total_size,
                'total_size_mb': round(total_size / 1024 / 1024, 2)
            }

    def get_local_ip(self) -> str:
        """Get local IP address."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(1)
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except Exception:
            try:
                hostname = socket.gethostname()
                return socket.gethostbyname(hostname)
            except Exception:
                return '127.0.0.1'
