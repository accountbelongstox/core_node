# -*- coding: utf-8 -*-
"""
Unified HTTP + WebSocket Server

Combines HTTP file serving and WebSocket communication on single port.

Port: 58923 (unified)

Features:
- HTTP API endpoints
- WebSocket real-time communication
- Web UI dashboard
- File synchronization
"""

import asyncio
import json
import threading
from pathlib import Path
from typing import Optional, Dict, Set

from pycore.pyfoundations.third_party import get_third_package_aiohttp

aiohttp = get_third_package_aiohttp()

web = aiohttp.web
web_ws = aiohttp.web_ws

from .logging_config import setup_logging

logger = setup_logging(__name__)

DEFAULT_PORT = 58923


class UnifiedServer:
    """
    Unified HTTP + WebSocket server.

    Runs HTTP and WebSocket on the same port using aiohttp.
    """

    def __init__(self, port: int = DEFAULT_PORT, root_dir: str = None):
        """
        Initialize unified server.

        Args:
            port: Server port
            root_dir: Root directory for file sync
        """
        self.port = port
        self.root_dir = Path(root_dir) if root_dir else Path.cwd()

        # WebSocket clients
        self.ws_clients: Set[web_ws.WebSocketResponse] = set()

        # Server components
        self.app: Optional[web.Application] = None
        self.runner: Optional[web.AppRunner] = None
        self.site: Optional[web.TCPSite] = None

        # Event loop and thread
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.thread: Optional[threading.Thread] = None

        # Device manager reference (will be set externally)
        self.device_manager = None

        # File cache for sync (delay build until PRIMARY mode set)
        self.file_cache: Dict[str, Dict] = {}
        self.file_cache_built = False

    def start(self):
        """Start unified server in separate thread."""
        logger.info(f"Starting unified server on port {self.port}")

        def run_server():
            """Run server in asyncio loop."""
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

            # Create and run server
            self.loop.run_until_complete(self._start_server())
            self.loop.run_forever()

        self.thread = threading.Thread(
            target=run_server,
            daemon=True,
            name="UnifiedServer"
        )
        self.thread.start()

        logger.info("Unified server started")

    def stop(self):
        """Stop unified server."""
        if self.loop:
            asyncio.run_coroutine_threadsafe(self._stop_server(), self.loop)
        logger.info("Unified server stopped")

    async def _start_server(self):
        """Start server (async)."""
        # Create app
        self.app = web.Application()

        # Add routes
        self.app.router.add_get('/', self._handle_index)
        self.app.router.add_get('/ws', self._handle_websocket)
        self.app.router.add_get('/api/devices', self._handle_api_devices)
        self.app.router.add_get('/api/status', self._handle_api_status)
        self.app.router.add_post('/api/mode', self._handle_api_set_mode)
        self.app.router.add_post('/api/sync/enable', self._handle_api_enable_sync)
        self.app.router.add_post('/api/sync/disable', self._handle_api_disable_sync)
        self.app.router.add_get('/api/files', self._handle_api_files)
        self.app.router.add_get('/api/file/{path:.*}', self._handle_api_file)

        # Start server
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()

        self.site = web.TCPSite(self.runner, '0.0.0.0', self.port)
        await self.site.start()

        logger.info(f"Server listening on http://0.0.0.0:{self.port}")

    async def _stop_server(self):
        """Stop server (async)."""
        if self.runner:
            await self.runner.cleanup()

    async def _handle_index(self, request):
        """Serve Web UI index page."""
        html = self._generate_dashboard_html()
        return web.Response(text=html, content_type='text/html')

    async def _handle_websocket(self, request):
        """Handle WebSocket connection."""
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        self.ws_clients.add(ws)
        client_addr = request.remote
        logger.info(f"WebSocket client connected: {client_addr}")

        try:
            # Send welcome message
            await ws.send_json({
                'type': 'welcome',
                'message': 'Connected to Device Sync'
            })

            # Send initial device list
            if self.device_manager:
                await ws.send_json({
                    'type': 'device_list',
                    'devices': self.device_manager.get_online_devices()
                })

            # Handle messages
            async for msg in ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        await self._handle_ws_message(ws, data)
                    except Exception as e:
                        logger.error(f"WebSocket message error: {e}")
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    logger.error(f"WebSocket error: {ws.exception()}")

        finally:
            self.ws_clients.discard(ws)
            logger.info(f"WebSocket client disconnected: {client_addr}")

        return ws

    async def _handle_ws_message(self, ws, data):
        """Handle WebSocket message."""
        msg_type = data.get('type')

        if msg_type == 'get_devices':
            # Send device list
            if self.device_manager:
                await ws.send_json({
                    'type': 'device_list',
                    'devices': self.device_manager.get_online_devices()
                })

    async def _handle_api_devices(self, request):
        """API: Get online devices."""
        if not self.device_manager:
            return web.json_response({'error': 'Device manager not available'}, status=500)

        devices = self.device_manager.get_online_devices()
        return web.json_response({'devices': devices})

    async def _handle_api_status(self, request):
        """API: Get current device status."""
        if not self.device_manager:
            return web.json_response({'error': 'Device manager not available'}, status=500)

        return web.json_response({
            'mode': self.device_manager.mode,
            'sync_enabled': self.device_manager.sync_enabled,
            'device_id': self.device_manager.device_discovery.device_id,
            'hostname': self.device_manager.device_discovery.hostname,
            'ip': self.device_manager.device_discovery.local_ip
        })

    async def _handle_api_set_mode(self, request):
        """API: Set device mode."""
        if not self.device_manager:
            return web.json_response({'error': 'Device manager not available'}, status=500)

        data = await request.json()
        mode = data.get('mode')

        if mode not in ['primary', 'secondary']:
            return web.json_response({'error': 'Invalid mode'}, status=400)

        self.device_manager.set_mode(mode)
        return web.json_response({'success': True, 'mode': mode})

    async def _handle_api_enable_sync(self, request):
        """API: Enable sync."""
        if not self.device_manager:
            return web.json_response({'error': 'Device manager not available'}, status=500)

        success = self.device_manager.enable_sync()
        return web.json_response({'success': success})

    async def _handle_api_disable_sync(self, request):
        """API: Disable sync."""
        if not self.device_manager:
            return web.json_response({'error': 'Device manager not available'}, status=500)

        self.device_manager.disable_sync()
        return web.json_response({'success': True})

    async def _handle_api_files(self, request):
        """API: Get file list."""
        files = list(self.file_cache.values())
        return web.json_response({
            'status': 'ok',
            'count': len(files),
            'files': files
        })

    async def _handle_api_file(self, request):
        """API: Download file."""
        file_path = request.match_info['path']

        full_path = self.root_dir / file_path
        if not full_path.exists() or not full_path.is_file():
            return web.json_response({'error': 'File not found'}, status=404)

        return web.FileResponse(full_path)

    async def broadcast(self, message: dict):
        """Broadcast message to all WebSocket clients."""
        if not self.ws_clients:
            return

        disconnected = set()
        for ws in self.ws_clients:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Broadcast error: {e}")
                disconnected.add(ws)

        self.ws_clients -= disconnected

    def build_file_cache_if_needed(self):
        """
        Build file cache if not already built.

        This is called when device is set as PRIMARY.
        """
        if self.file_cache_built:
            logger.info("File cache already built, skipping")
            return

        self._build_file_cache()

    def _build_file_cache(self):
        """Build file metadata cache (internal)."""
        logger.info(f"Building file cache from {self.root_dir}")

        try:
            file_count = 0

            for file_path in self.root_dir.rglob('*'):
                if not file_path.is_file():
                    continue

                # Skip hidden files and directories
                if any(part.startswith('.') for part in file_path.parts):
                    continue

                rel_path = file_path.relative_to(self.root_dir)
                stat = file_path.stat()

                self.file_cache[str(rel_path)] = {
                    'path': str(rel_path).replace('\\', '/'),
                    'size': stat.st_size,
                    'mtime': stat.st_mtime
                }

                file_count += 1

                # Log progress every 10000 files
                if file_count % 10000 == 0:
                    logger.info(f"Cached {file_count} files...")

            self.file_cache_built = True
            logger.info(f"File cache complete: {len(self.file_cache)} files")

        except Exception as e:
            logger.error(f"File cache error: {e}", exc_info=True)

    def _generate_dashboard_html(self) -> str:
        """Generate Web UI dashboard HTML."""
        return """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Device Sync Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .header h1 { color: #667eea; font-size: 32px; margin-bottom: 10px; }
        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            margin-right: 10px;
        }
        .status-primary { background: #27ae60; color: white; }
        .status-secondary { background: #3498db; color: white; }
        .status-unknown { background: #95a5a6; color: white; }

        .cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .card {
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .card h2 {
            color: #2c3e50;
            font-size: 20px;
            margin-bottom: 20px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }

        .device-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        .device-table th {
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #2c3e50;
            border-bottom: 2px solid #667eea;
        }
        .device-table td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
        }
        .device-table tr:hover {
            background: #f8f9fa;
        }

        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            margin: 5px;
            transition: background 0.3s;
        }
        .btn:hover { background: #5568d3; }
        .btn:disabled {
            background: #95a5a6;
            cursor: not-allowed;
        }
        .btn-danger { background: #e74c3c; }
        .btn-danger:hover { background: #c0392b; }

        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #ecf0f1;
        }
        .info-label { color: #7f8c8d; font-weight: 500; }
        .info-value { color: #2c3e50; font-weight: bold; }

        .online-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #27ae60;
            margin-right: 5px;
        }
        .offline-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #e74c3c;
            margin-right: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔄 Device Sync Dashboard</h1>
            <span id="mode-badge" class="status-badge status-unknown">Loading...</span>
            <span id="sync-badge" class="status-badge status-unknown">Sync: Unknown</span>
        </div>

        <div class="cards">
            <!-- Current Device Card -->
            <div class="card">
                <h2>Current Device</h2>
                <div class="info-row">
                    <span class="info-label">Hostname</span>
                    <span class="info-value" id="hostname">-</span>
                </div>
                <div class="info-row">
                    <span class="info-label">IP Address</span>
                    <span class="info-value" id="ip">-</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Mode</span>
                    <span class="info-value" id="mode">-</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Sync Status</span>
                    <span class="info-value" id="sync-status">-</span>
                </div>
                <div style="margin-top: 20px;">
                    <button class="btn" onclick="setMode('primary')">Set as Primary</button>
                    <button class="btn" onclick="setMode('secondary')">Set as Secondary</button>
                    <br>
                    <button class="btn" id="sync-btn" onclick="toggleSync()">Enable Sync</button>
                </div>
            </div>

            <!-- Online Devices Card -->
            <div class="card" style="grid-column: span 2;">
                <h2>Online Devices (<span id="device-count">0</span>)</h2>
                <table class="device-table">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Hostname</th>
                            <th>IP Address</th>
                            <th>Mode</th>
                            <th>Sync</th>
                            <th>Last Seen</th>
                        </tr>
                    </thead>
                    <tbody id="device-list">
                        <tr>
                            <td colspan="6" style="text-align: center; color: #7f8c8d;">
                                No devices found. Waiting for broadcasts...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        // WebSocket connection
        const ws = new WebSocket(`ws://${window.location.host}/ws`);
        let currentStatus = {};

        ws.onopen = () => {
            console.log('WebSocket connected');
            // Request initial data
            ws.send(JSON.stringify({type: 'get_devices'}));
            loadStatus();
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleMessage(data);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setTimeout(() => location.reload(), 3000);
        };

        function handleMessage(data) {
            console.log('Received:', data);

            if (data.type === 'device_list') {
                updateDeviceList(data.devices);
            } else if (data.type === 'status_change') {
                loadStatus();
            }
        }

        async function loadStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                currentStatus = data;
                updateStatus(data);
            } catch (error) {
                console.error('Failed to load status:', error);
            }
        }

        function updateStatus(status) {
            // Update badges
            const modeBadge = document.getElementById('mode-badge');
            const syncBadge = document.getElementById('sync-badge');

            if (status.mode === 'primary') {
                modeBadge.textContent = '● PRIMARY';
                modeBadge.className = 'status-badge status-primary';
            } else if (status.mode === 'secondary') {
                modeBadge.textContent = '● SECONDARY';
                modeBadge.className = 'status-badge status-secondary';
            } else {
                modeBadge.textContent = '● NOT SET';
                modeBadge.className = 'status-badge status-unknown';
            }

            syncBadge.textContent = status.sync_enabled ? 'Sync: ON' : 'Sync: OFF';
            syncBadge.className = status.sync_enabled ?
                'status-badge status-primary' : 'status-badge status-unknown';

            // Update info
            document.getElementById('hostname').textContent = status.hostname || '-';
            document.getElementById('ip').textContent = status.ip || '-';
            document.getElementById('mode').textContent = status.mode || 'Not set';
            document.getElementById('sync-status').textContent =
                status.sync_enabled ? 'Enabled' : 'Disabled';

            // Update sync button
            const syncBtn = document.getElementById('sync-btn');
            syncBtn.textContent = status.sync_enabled ? 'Disable Sync' : 'Enable Sync';
        }

        function updateDeviceList(devices) {
            const tbody = document.getElementById('device-list');
            const count = document.getElementById('device-count');

            count.textContent = devices.length;

            if (devices.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: #7f8c8d;">
                            No devices found
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = devices.map(device => {
                const timeDiff = Date.now()/1000 - device.last_seen;
                const timeAgo = timeDiff < 10 ? 'Just now' :
                               timeDiff < 60 ? `${Math.floor(timeDiff)}s ago` :
                               `${Math.floor(timeDiff/60)}m ago`;

                const modeBadge = device.mode === 'primary' ?
                    '<span class="status-badge status-primary">PRIMARY</span>' :
                    '<span class="status-badge status-secondary">SECONDARY</span>';

                const syncStatus = device.sync_enabled ?
                    '<span style="color: #27ae60;">● ON</span>' :
                    '<span style="color: #95a5a6;">○ OFF</span>';

                return `
                    <tr>
                        <td><span class="online-indicator"></span></td>
                        <td>${device.hostname}</td>
                        <td>${device.ip}</td>
                        <td>${modeBadge}</td>
                        <td>${syncStatus}</td>
                        <td>${timeAgo}</td>
                    </tr>
                `;
            }).join('');
        }

        async function setMode(mode) {
            try {
                const response = await fetch('/api/mode', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({mode: mode})
                });
                const data = await response.json();
                if (data.success) {
                    loadStatus();
                }
            } catch (error) {
                console.error('Failed to set mode:', error);
                alert('Failed to set mode');
            }
        }

        async function toggleSync() {
            const enabled = currentStatus.sync_enabled;
            const endpoint = enabled ? '/api/sync/disable' : '/api/sync/enable';

            try {
                const response = await fetch(endpoint, {method: 'POST'});
                const data = await response.json();

                if (!data.success && !enabled) {
                    alert('Failed to enable sync. Check if there is exactly one primary device.');
                }

                loadStatus();
            } catch (error) {
                console.error('Failed to toggle sync:', error);
                alert('Failed to toggle sync');
            }
        }

        // Auto-refresh
        setInterval(loadStatus, 5000);
    </script>
</body>
</html>
"""
