#!/usr/bin/env python3
"""
Real-time Multi-Device Stream Monitor
FastAPI + WebSocket实时监控所有设备的推流状态
"""
import asyncio
import subprocess
import json
import sys
from pathlib import Path
from typing import Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager

# Setup path to import from pycore
current_dir = Path(__file__).parent
project_root = current_dir.parent.parent.parent
sys.path.insert(0, str(project_root))

from pycore.pyutils.scrcpy_init import get_initializer

# Initialize scrcpy paths
scrcpy_init = get_initializer()
ADB_PATH = scrcpy_init.get_adb_path()
SCRCPY_VERSION = "3.3.3"

# Get scrcpy-server.jar path - check multiple locations
def get_jar_path() -> Path:
    """Find scrcpy-server.jar in multiple possible locations"""
    # Location 1: scrcpy directory (extracted from package)
    scrcpy_jar = scrcpy_init.scrcpy_dir / "scrcpy-server"
    if scrcpy_jar.exists():
        return scrcpy_jar

    # Location 2: matrix resources directory
    resources_jar = project_root / "pyapps" / "matrix" / "resources" / "scrcpy-server.jar"
    if resources_jar.exists():
        return resources_jar

    # Location 3: Try with .jar extension
    scrcpy_jar_ext = scrcpy_init.scrcpy_dir / "scrcpy-server.jar"
    if scrcpy_jar_ext.exists():
        return scrcpy_jar_ext

    # Return first location as default (will show error if missing)
    return scrcpy_jar

JAR_PATH = get_jar_path()

# Store active WebSocket connections
active_connections: Set[WebSocket] = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler - starts device monitoring on startup"""
    print("[DEBUG] Lifespan startup - creating device monitor task", flush=True)
    sys.stdout.flush()
    # Startup: Start device monitoring
    task = asyncio.create_task(device_monitor_task())
    print(f"[DEBUG] Task created: {task}", flush=True)
    sys.stdout.flush()
    yield
    # Shutdown: cleanup if needed
    print("[DEBUG] Lifespan shutdown", flush=True)
    sys.stdout.flush()


app = FastAPI(lifespan=lifespan)


def get_devices():
    """Get all online devices"""
    result = subprocess.run(
        [str(ADB_PATH), "devices"],
        capture_output=True,
        text=True
    )

    devices = []
    for line in result.stdout.splitlines()[1:]:
        if '\tdevice' in line:
            serial = line.split('\t')[0]
            devices.append(serial)

    return devices


def check_server_file(serial: str) -> bool:
    """Check if scrcpy-server.jar exists on device"""
    result = subprocess.run(
        [str(ADB_PATH), "-s", serial, "shell", "ls /data/local/tmp/scrcpy-server.jar"],
        capture_output=True
    )
    return result.returncode == 0


def push_server_file(serial: str) -> bool:
    """Push scrcpy-server.jar to device"""
    if not JAR_PATH or not JAR_PATH.exists():
        print(f"[ERROR] scrcpy-server.jar not found at: {JAR_PATH}", flush=True)
        return False

    print(f"[DEBUG] Pushing {JAR_PATH.name} from {JAR_PATH}", flush=True)

    result = subprocess.run(
        [str(ADB_PATH), "-s", serial, "push", str(JAR_PATH), "//data/local/tmp/scrcpy-server.jar"],
        capture_output=True,
        timeout=10
    )

    return result.returncode == 0


async def connect_to_server(serial: str, scid: int):
    """Connect to scrcpy-server via already-established ADB forward tunnel"""
    import socket

    # Forward tunnel was already created before starting server
    local_port = 27183 + (scid % 100)

    # Connect to server
    try:
        print(f"[DEBUG] [{serial}] Connecting to 127.0.0.1:{local_port}...", flush=True)

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect(("127.0.0.1", local_port))

        print(f"[DEBUG] [{serial}] TCP connection established!", flush=True)

        # Set to non-blocking mode for async video reading
        sock.setblocking(False)

        return sock, None

    except Exception as e:
        return None, str(e)


async def start_scrcpy_server(serial: str, scid: int):
    """Start scrcpy-server on device and connect to it"""
    print(f"[DEBUG] [{serial}] start_scrcpy_server called, SCID={scid}", flush=True)

    # IMPORTANT: Create ADB forward tunnel FIRST (before starting server)
    socket_name = f"localabstract:scrcpy_{scid:08x}"
    local_port = 27183 + (scid % 100)

    print(f"[DEBUG] [{serial}] Creating forward BEFORE server start: tcp:{local_port} -> {socket_name}", flush=True)
    forward_result = await asyncio.create_subprocess_exec(
        str(ADB_PATH), "-s", serial, "forward",
        f"tcp:{local_port}", socket_name,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    await forward_result.wait()

    if forward_result.returncode != 0:
        print(f"[DEBUG] [{serial}] Forward creation failed", flush=True)
        return

    shell_cmd = (
        f"cd /data/local/tmp && "
        f"CLASSPATH=scrcpy-server.jar "
        f"app_process . com.genymobile.scrcpy.Server "
        f"{SCRCPY_VERSION} scid={scid} log_level=info audio=false "
        f"max_size=720 max_fps=30 bit_rate=2000000 tunnel_forward=true"
    )

    print(f"[DEBUG] [{serial}] Starting server process...", flush=True)
    proc = await asyncio.create_subprocess_exec(
        str(ADB_PATH), "-s", serial, "shell", shell_cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT
    )
    print(f"[DEBUG] [{serial}] Server process started, PID={proc.pid}", flush=True)

    device_status = {
        'serial': serial,
        'scid': scid,
        'scid_hex': f"{scid:08x}",
        'status': 'starting',
        'device_info': None,
        'encoder': None,
        'error': None
    }

    # Broadcast initial status
    await broadcast_status(device_status)

    # Wait for server to be ready by reading initial output
    print(f"[DEBUG] [{serial}] Waiting for server to be ready...", flush=True)
    server_ready = False
    while not server_ready:
        line = await proc.stdout.readline()
        if not line:
            device_status['status'] = 'error'
            device_status['error'] = 'Server process died before becoming ready'
            await broadcast_status(device_status)
            return

        line_str = line.decode().strip()
        if line_str:
            print(f"[DEBUG] [{serial}] {line_str}", flush=True)

        # Server is ready when it outputs device info
        if '[server] INFO: Device:' in line_str:
            server_ready = True
            device_status['status'] = 'started'
            import re
            match = re.search(r'Device: \[(.*?)\] (.*?) \((.*?)\)', line_str)
            if match:
                device_status['device_info'] = {
                    'brand': match.group(1),
                    'model': match.group(2),
                    'android': match.group(3)
                }
            await broadcast_status(device_status)

    # NOW connect to server socket (server is ready and waiting)
    print(f"[DEBUG] [{serial}] Server ready, connecting to socket...", flush=True)
    device_status['status'] = 'connecting'
    await broadcast_status(device_status)

    sock, error = await connect_to_server(serial, scid)

    if sock is None:
        print(f"[DEBUG] [{serial}] Socket connection FAILED: {error}", flush=True)
        device_status['status'] = 'error'
        device_status['error'] = f"Connection failed: {error}"
        await broadcast_status(device_status)

        try:
            proc.terminate()
            await proc.wait()
        except:
            pass
        return

    print(f"[DEBUG] [{serial}] Socket connection SUCCESS", flush=True)
    device_status['status'] = 'connected'
    device_status['message'] = f"Socket connected (port {27183 + (scid % 100)})"
    await broadcast_status(device_status)

    # Now server will start encoding because we connected
    # Read output line by line and video data
    print(f"[DEBUG] [{serial}] Reading server output...", flush=True)
    try:
        video_frame_count = 0

        while True:
            line = await proc.stdout.readline()
            if not line:
                print(f"[DEBUG] [{serial}] No more output from server (EOF)", flush=True)
                break

            line_str = line.decode().strip()
            if line_str:
                print(f"[DEBUG] [{serial}] {line_str}", flush=True)

            # Parse server output
            if '[server] INFO: Video encoder:' in line_str:
                device_status['status'] = 'streaming'
                match = re.search(r'Video encoder: (.*)', line_str)
                if match:
                    device_status['encoder'] = match.group(1).strip()

            elif '[server] ERROR' in line_str or 'Exception' in line_str:
                device_status['status'] = 'error'
                device_status['error'] = line_str

            # Broadcast updated status
            await broadcast_status(device_status)

            # Read video data from socket (to keep server alive)
            # Non-blocking socket read
            if device_status['status'] == 'streaming':
                try:
                    # Try to read video data (non-blocking)
                    data = sock.recv(8192)  # 8KB chunks
                    if data:
                        video_frame_count += len(data)
                        if video_frame_count % 100000 == 0:  # Every ~100KB
                            device_status['message'] = f"Received {video_frame_count // 1024}KB video data"
                            await broadcast_status(device_status)
                except BlockingIOError:
                    # No data available, continue
                    pass
                except:
                    pass

    except Exception as e:
        device_status['status'] = 'error'
        device_status['error'] = str(e)
        await broadcast_status(device_status)

    finally:
        try:
            sock.close()
        except:
            pass

        try:
            proc.terminate()
            await proc.wait()
        except:
            pass


async def broadcast_status(status: dict):
    """Broadcast device status to all connected WebSocket clients"""
    message = json.dumps(status)

    # Create copy to avoid modification during iteration
    connections = list(active_connections)

    for connection in connections:
        try:
            await connection.send_text(message)
        except:
            active_connections.discard(connection)


async def device_monitor_task():
    """Background task to monitor all devices"""
    print("\n[DEBUG] device_monitor_task started")
    devices = get_devices()
    print(f"[DEBUG] Found {len(devices)} devices: {devices}")

    # Broadcast initial discovery
    await broadcast_status({
        'type': 'discovery',
        'total_devices': len(devices),
        'serials': devices
    })
    print(f"[DEBUG] Broadcasted discovery to {len(active_connections)} connections")

    # Check and push server files
    print(f"[DEBUG] Checking server files on all devices...")
    for idx, serial in enumerate(devices):
        has_server = check_server_file(serial)
        print(f"[DEBUG] {serial}: has_server = {has_server}")

        if not has_server:
            # Broadcast pushing status
            await broadcast_status({
                'serial': serial,
                'status': 'pushing',
                'message': 'Pushing scrcpy-server.jar...'
            })

            # Push file
            success = push_server_file(serial)

            if success:
                await broadcast_status({
                    'serial': serial,
                    'status': 'ready',
                    'message': 'File pushed successfully'
                })
            else:
                await broadcast_status({
                    'serial': serial,
                    'status': 'push_failed',
                    'error': 'Failed to push scrcpy-server.jar'
                })
                continue

    # Start all device servers
    print(f"[DEBUG] Starting scrcpy servers...")
    tasks = []
    for idx, serial in enumerate(devices):
        has_server = check_server_file(serial)

        if has_server:
            scid = 3000000 + idx
            print(f"[DEBUG] Starting server for {serial} with SCID {scid}")
            task = asyncio.create_task(start_scrcpy_server(serial, scid))
            tasks.append(task)
        else:
            # Still missing after push attempt
            await broadcast_status({
                'serial': serial,
                'status': 'missing_file',
                'error': 'scrcpy-server.jar not found (push failed)'
            })

    # Wait for all tasks
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


@app.get("/")
async def get():
    """Serve HTML monitoring page"""
    html_content = """
<!DOCTYPE html>
<html>
<head>
    <title>Multi-Device Stream Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #0a0a0a;
            color: #e0e0e0;
            padding: 20px;
        }
        h1 {
            text-align: center;
            color: #00ff00;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .subtitle {
            text-align: center;
            color: #888;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-bottom: 30px;
            font-size: 16px;
        }
        .stat {
            padding: 10px 20px;
            background: #1a1a1a;
            border-radius: 5px;
            border: 1px solid #333;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #00ff00;
        }
        .devices-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
        }
        .device-card {
            background: #1a1a1a;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 15px;
            transition: all 0.3s;
        }
        .device-card.starting {
            border-color: #ff9800;
        }
        .device-card.started {
            border-color: #2196F3;
        }
        .device-card.streaming {
            border-color: #00ff00;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        }
        .device-card.error {
            border-color: #f44336;
            box-shadow: 0 0 20px rgba(244, 67, 54, 0.3);
        }
        .device-card.missing_file {
            border-color: #666;
            opacity: 0.6;
        }
        .device-card.pushing {
            border-color: #9c27b0;
        }
        .device-card.ready {
            border-color: #4caf50;
        }
        .device-card.push_failed {
            border-color: #ff5722;
        }
        .device-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .device-serial {
            font-weight: bold;
            font-size: 14px;
            color: #00ff00;
        }
        .device-status {
            padding: 3px 10px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-pushing { background: #9c27b0; color: #fff; }
        .status-ready { background: #4caf50; color: #fff; }
        .status-starting { background: #ff9800; color: #000; }
        .status-started { background: #2196F3; color: #fff; }
        .status-streaming { background: #00ff00; color: #000; }
        .status-error { background: #f44336; color: #fff; }
        .status-missing_file { background: #666; color: #fff; }
        .status-push_failed { background: #ff5722; color: #fff; }
        .device-info {
            font-size: 13px;
            color: #aaa;
            margin: 5px 0;
        }
        .device-scid {
            font-family: monospace;
            color: #666;
            font-size: 12px;
        }
        .device-encoder {
            font-size: 12px;
            color: #00ff00;
            margin-top: 8px;
            padding: 5px;
            background: #0a2a0a;
            border-radius: 3px;
        }
        .device-error {
            font-size: 11px;
            color: #f44336;
            margin-top: 8px;
            padding: 5px;
            background: #2a0a0a;
            border-radius: 3px;
            word-break: break-all;
        }
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 12px;
            font-weight: bold;
        }
        .connected {
            background: #00ff00;
            color: #000;
        }
        .disconnected {
            background: #f44336;
            color: #fff;
        }
    </style>
</head>
<body>
    <div class="connection-status disconnected" id="connection-status">● CONNECTING...</div>

    <h1>🎬 Multi-Device Stream Monitor</h1>
    <div class="subtitle">Real-time monitoring of scrcpy-server instances</div>

    <div class="stats">
        <div class="stat">
            <div>Total Devices</div>
            <div class="stat-value" id="total-count">0</div>
        </div>
        <div class="stat">
            <div>Streaming</div>
            <div class="stat-value" id="streaming-count" style="color: #00ff00;">0</div>
        </div>
        <div class="stat">
            <div>Starting</div>
            <div class="stat-value" id="starting-count" style="color: #ff9800;">0</div>
        </div>
        <div class="stat">
            <div>Errors</div>
            <div class="stat-value" id="error-count" style="color: #f44336;">0</div>
        </div>
    </div>

    <div class="devices-grid" id="devices-grid"></div>

    <script>
        const devices = new Map();
        let ws = null;

        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

            ws.onopen = () => {
                document.getElementById('connection-status').textContent = '● CONNECTED';
                document.getElementById('connection-status').className = 'connection-status connected';
            };

            ws.onclose = () => {
                document.getElementById('connection-status').textContent = '● DISCONNECTED';
                document.getElementById('connection-status').className = 'connection-status disconnected';

                // Reconnect after 2 seconds
                setTimeout(connectWebSocket, 2000);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                updateDevice(data);
            };
        }

        function updateDevice(data) {
            devices.set(data.serial, data);
            renderDevices();
        }

        function renderDevices() {
            const grid = document.getElementById('devices-grid');
            grid.innerHTML = '';

            let streamingCount = 0;
            let startingCount = 0;
            let errorCount = 0;

            devices.forEach((device) => {
                const card = document.createElement('div');
                card.className = `device-card ${device.status}`;

                let deviceInfoHtml = '';
                if (device.device_info) {
                    deviceInfoHtml = `
                        <div class="device-info">
                            ${device.device_info.brand} ${device.device_info.model}<br>
                            ${device.device_info.android}
                        </div>
                    `;
                }

                let encoderHtml = '';
                if (device.encoder) {
                    encoderHtml = `<div class="device-encoder">📹 ${device.encoder}</div>`;
                }

                let errorHtml = '';
                if (device.error) {
                    errorHtml = `<div class="device-error">⚠️ ${device.error}</div>`;
                }

                let messageHtml = '';
                if (device.message && !device.error) {
                    messageHtml = `<div class="device-info">ℹ️ ${device.message}</div>`;
                }

                card.innerHTML = `
                    <div class="device-header">
                        <div class="device-serial">${device.serial}</div>
                        <div class="device-status status-${device.status}">${device.status}</div>
                    </div>
                    <div class="device-scid">SCID: ${device.scid || 'N/A'}</div>
                    ${deviceInfoHtml}
                    ${messageHtml}
                    ${encoderHtml}
                    ${errorHtml}
                `;

                grid.appendChild(card);

                if (device.status === 'streaming') streamingCount++;
                else if (device.status === 'starting' || device.status === 'started') startingCount++;
                else if (device.status === 'error') errorCount++;
            });

            document.getElementById('total-count').textContent = devices.size;
            document.getElementById('streaming-count').textContent = streamingCount;
            document.getElementById('starting-count').textContent = startingCount;
            document.getElementById('error-count').textContent = errorCount;
        }

        connectWebSocket();
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time device status updates"""
    await websocket.accept()
    active_connections.add(websocket)

    try:
        # Keep connection alive
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        active_connections.discard(websocket)


if __name__ == "__main__":
    import uvicorn

    print("=" * 70)
    print("Multi-Device Stream Monitor Server")
    print("=" * 70)

    # Print all paths for debugging
    print("\n[PATHS CONFIGURATION]")
    print(f"Project Root:     {project_root}")
    print(f"ADB Path:         {ADB_PATH}")
    print(f"JAR Path:         {JAR_PATH}")
    print(f"Scrcpy Dir:       {scrcpy_init.scrcpy_dir}")
    print(f"User Data Dir:    {scrcpy_init.user_data_dir}")
    print(f"Scrcpy Version:   {SCRCPY_VERSION}")

    # Check if paths exist
    print("\n[PATHS STATUS]")
    print(f"ADB exists:       {ADB_PATH.exists() if ADB_PATH else False}")
    print(f"JAR exists:       {JAR_PATH.exists() if JAR_PATH else False}")

    # Get device count
    devices = get_devices()
    print(f"\n[DEVICES]")
    print(f"Device count:     {len(devices)}")
    for i, serial in enumerate(devices):
        print(f"  [{i}] {serial}")

    print("\n" + "=" * 70)
    print(f"Open browser: http://localhost:8765")
    print("=" * 70)

    uvicorn.run(app, host="0.0.0.0", port=8765)
