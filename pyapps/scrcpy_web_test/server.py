#!/usr/bin/env python3
"""
Scrcpy Web Test Server
HTTP + WebSocket server for device management and video streaming
Port: 27880
"""

import asyncio
import json
import os
import subprocess
import sys
import time
import base64
import io
import struct
from pathlib import Path
from typing import Dict, Set, Optional, Tuple, Any
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_aiohttp

aiohttp = get_third_package_aiohttp()
from aiohttp import web

# Add pycore to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'pycore'))

from pycore.pyutils.device.scrcpy_device import ScrcpyDevice
from pycore.pyutils.device.server_params import ServerParams
from pycore.pyutils.control import TouchEvent, TouchAction, MessageBuilder
from pycore.pyutils.device.scrcpy_init import get_initializer, get_adb_path
from pycore import ColorPrint

# UTF-8 encoding already handled by ScrcpyDevice import

# Device scanner
class DeviceScanner:
    def __init__(self, adb_path="adb"):
        self.adb_path = adb_path
        self._cache = None
        self._cache_time = 0
        self._cache_ttl = 30.0  # Cache devices for 30 seconds

    def scan_devices(self):
        """
        Scan all connected ADB devices with caching

        Caches results for 30 seconds to avoid repeated ADB calls
        which can timeout in multi-device environments
        """
        now = time.time()

        # Return cached results if valid
        if self._cache is not None and (now - self._cache_time) < self._cache_ttl:
            return self._cache

        # Perform actual scan
        result = subprocess.run(
            [self.adb_path, "devices", "-l"],
            capture_output=True,
            text=True,
            timeout=5
        )

        devices = []
        for line in result.stdout.strip().split('\n')[1:]:  # Skip header
            if line.strip() and 'device' in line:
                parts = line.split()
                serial = parts[0]

                # Get device model and info
                model = self._get_device_property(serial, "ro.product.model")
                manufacturer = self._get_device_property(serial, "ro.product.manufacturer")
                android_version = self._get_device_property(serial, "ro.build.version.release")

                devices.append({
                    'serial': serial,
                    'model': model,
                    'manufacturer': manufacturer,
                    'android_version': android_version,
                    'status': 'device'
                })

        # Update cache
        self._cache = devices
        self._cache_time = now

        return devices

    def _get_device_property(self, serial: str, prop: str) -> str:
        """Get device property via getprop"""
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = serial
        result = subprocess.run(
            [self.adb_path, "-s", serial, "shell", "getprop", prop],
            env=env,
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout.strip()


# WebSocket manager for video streaming
class VideoStreamManager:
    def __init__(self):
        self.clients: Set[web.WebSocketResponse] = set()
        self.active_devices: Dict[str, ScrcpyDevice] = {}
        self.stream_tasks: Dict[str, asyncio.Task] = {}
        self.stop_events: Dict[str, asyncio.Event] = {}
        self.ffmpeg_processes: Dict[str, subprocess.Popen] = {}  # FFmpeg recorders
        self.recording_files: Dict[str, Path] = {}  # Recording file paths
        self.device_clients: Dict[str, Set[web.WebSocketResponse]] = {}
        self.client_devices: Dict[web.WebSocketResponse, Set[str]] = {}
        self.screenshot_tasks: Dict[str, asyncio.Task] = {}
        self.default_resolution = {'width': 1080, 'height': 1920}
        self.control_locks: Dict[str, asyncio.Lock] = {}

    def _get_device_info_payload(self, device: ScrcpyDevice) -> Optional[Dict[str, Any]]:
        info = device.get_device_info()

        resolution = {
            'width': info.resolution.width or self.default_resolution['width'],
            'height': info.resolution.height or self.default_resolution['height']
        }

        return {
            'serial': info.serial,
            'model': info.model,
            'resolution': resolution,
            'dpi': info.dpi,
            'android_version': info.android_version,
            'sdk_version': info.sdk_version
        }

    async def register_client(self, ws: web.WebSocketResponse):
        """Register a new WebSocket client"""
        self.clients.add(ws)
        print(f"✓ Client registered. Total clients: {len(self.clients)}")

    async def unregister_client(self, ws: web.WebSocketResponse):
        """Unregister a WebSocket client"""
        self.clients.discard(ws)
        print(f"✗ Client unregistered. Total clients: {len(self.clients)}")

    def _attach_client(self, serial: str, ws: web.WebSocketResponse):
        """Track that a client is consuming a device stream"""
        device_watchers = self.device_clients.setdefault(serial, set())
        device_watchers.add(ws)

        client_streams = self.client_devices.setdefault(ws, set())
        client_streams.add(serial)

    def _detach_client(self, serial: str, ws: web.WebSocketResponse):
        """Detach a client from a device stream bookkeeping"""
        if serial in self.device_clients:
            watchers = self.device_clients[serial]
            watchers.discard(ws)
            if not watchers:
                del self.device_clients[serial]

        if ws in self.client_devices:
            subscriptions = self.client_devices[ws]
            subscriptions.discard(serial)
            if not subscriptions:
                del self.client_devices[ws]

    async def detach_client(self, ws: web.WebSocketResponse):
        """Detach client from all subscribed streams"""
        serials = list(self.client_devices.get(ws, set()))
        for serial in serials:
            await self.stop_stream(serial, ws)

    def _start_ffmpeg_recording(self, serial: str) -> Optional[subprocess.Popen]:
        """Start FFmpeg process to record H.264 stream to MP4"""
        # Create recordings directory
        recordings_dir = Path(__file__).parent / "recordings"
        recordings_dir.mkdir(exist_ok=True)

        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = recordings_dir / f"{serial}_{timestamp}.mp4"

        # FFmpeg command to convert raw H.264 to MP4
        ffmpeg_cmd = [
            "ffmpeg",
            "-f", "h264",          # Input format: raw H.264
            "-i", "pipe:0",        # Read from stdin
            "-c:v", "copy",        # Copy video codec (no re-encode)
            "-movflags", "+faststart",  # Optimize for streaming
            "-y",                  # Overwrite output file
            str(output_file)
        ]

        print(f"[FFmpeg] Starting recording to: {output_file}")

        # Start FFmpeg process
        proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0  # Unbuffered
        )

        self.ffmpeg_processes[serial] = proc
        self.recording_files[serial] = output_file

        print(f"✓ FFmpeg recording started (PID: {proc.pid})")
        return proc

    def _stop_ffmpeg_recording(self, serial: str):
        """Stop FFmpeg recording for a device"""
        if serial not in self.ffmpeg_processes:
            return

        proc = self.ffmpeg_processes[serial]
        output_file = self.recording_files.get(serial)

        print(f"\n[FFmpeg] Stopping recording for {serial}...")

        # Close stdin to signal end of input
        if proc.stdin:
            proc.stdin.close()

        # Wait for FFmpeg to finish
        proc.wait(timeout=5)

        # Check output file
        if output_file and output_file.exists():
            size_mb = output_file.stat().st_size / (1024 * 1024)
            print(f"✓ Recording saved: {output_file} ({size_mb:.2f} MB)")
        else:
            print(f"✗ Recording file not found: {output_file}")

        # Cleanup
        if serial in self.ffmpeg_processes:
            del self.ffmpeg_processes[serial]
        if serial in self.recording_files:
            del self.recording_files[serial]

    async def start_stream(self, serial: str, ws: web.WebSocketResponse, enable_recording: bool = False) -> Tuple[bool, bool, Optional[Dict[str, Any]]]:
        """
        Start video stream for a device with optional MP4 recording

        Returns:
            (success, started_new)
        """
        self._attach_client(serial, ws)

        if serial in self.active_devices:
            print(f"[VideoStreamManager] {serial} already streaming, attached client")
            info_payload = self._get_device_info_payload(self.active_devices[serial])
            return True, False, info_payload

        print(f"\n[VideoStreamManager] Starting stream for {serial}")

        params = ServerParams(
            max_size=720,
            max_fps=60,
            bit_rate=8_000_000,
            control=True,
        )

        device = ScrcpyDevice(serial, params, adb_path=ADB_PATH)

        # Use global ADB_PATH for server operations (not device.adb_path)
        if not await ensure_scrcpy_server(serial):
            print(f"✗ Unable to ensure scrcpy-server.jar for {serial}")
            self._detach_client(serial, ws)
            return False, False, None

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, device.start_server)

        self.active_devices[serial] = device

        if enable_recording:
            self._start_ffmpeg_recording(serial)

        stop_event = asyncio.Event()
        self.stop_events[serial] = stop_event

        task = asyncio.create_task(self._stream_video(serial, device, stop_event))
        self.stream_tasks[serial] = task

        info_payload = self._get_device_info_payload(device)
        self.control_locks.setdefault(serial, asyncio.Lock())

        print(f"✓ Stream started for {serial}")
        return True, True, info_payload

    async def stop_stream(self, serial: str, ws: Optional[web.WebSocketResponse] = None, force: bool = False) -> Tuple[bool, bool]:
        """
        Stop video stream for a device

        Returns:
            (success, actually_stopped)
        """
        if ws:
            self._detach_client(serial, ws)

        if serial not in self.active_devices and serial not in self.stream_tasks:
            return False, False

        if not force:
            watchers = self.device_clients.get(serial)
            if watchers:
                return True, False

        print(f"\n[VideoStreamManager] Stopping stream for {serial}")

        if force:
            for watcher in list(self.device_clients.get(serial, set())):
                self._detach_client(serial, watcher)

        stop_event = self.stop_events.get(serial)
        if stop_event and not stop_event.is_set():
            stop_event.set()

        if serial in self.stream_tasks:
            task = self.stream_tasks[serial]
            if not task.done():
                await task
            del self.stream_tasks[serial]

        self._stop_ffmpeg_recording(serial)

        if serial in self.screenshot_tasks:
            screenshot_task = self.screenshot_tasks.pop(serial)
            if not screenshot_task.done():
                screenshot_task.cancel()

        if serial in self.active_devices:
            device = self.active_devices.pop(serial)
            device.stop_server()

        if serial in self.stop_events:
            del self.stop_events[serial]

        self.device_clients.pop(serial, None)
        self.control_locks.pop(serial, None)

        print(f"✓ Stream stopped for {serial}")
        return True, True

    async def _stream_video(self, serial: str, device: ScrcpyDevice, stop_event: asyncio.Event):
        """Stream video frames from device to WebSocket clients and FFmpeg recorder"""
        print(f"[VideoStreamManager] Starting video frame reader for {serial}")

        # Get FFmpeg process if recording
        ffmpeg_proc = self.ffmpeg_processes.get(serial)
        frame_count = 0
        bytes_sent = 0
        last_screenshot_time = 0
        loop = asyncio.get_event_loop()

        while not stop_event.is_set():
            # Read video frame using device method (blocking, run in executor)
            frame = await loop.run_in_executor(None, device.read_video_frame)

            if not frame:
                print(f"✗ Video stream ended for {serial}")
                break

            frame_data = frame['data']
            frame_count += 1
            bytes_sent += len(frame_data)

            # Write to FFmpeg if recording
            if ffmpeg_proc and ffmpeg_proc.stdin:
                ffmpeg_proc.stdin.write(frame_data)
                if frame_count % 100 == 0:
                    ffmpeg_proc.stdin.flush()

            # Broadcast to subscribed WebSocket clients
            await self._broadcast_frame(serial, frame)

            # Take screenshot every 1 second
            current_time = time.time()
            if current_time - last_screenshot_time >= 1.0:
                existing_task = self.screenshot_tasks.get(serial)
                if not existing_task or existing_task.done():
                    task = asyncio.create_task(self._capture_and_broadcast_screenshot(serial))
                    self.screenshot_tasks[serial] = task
                    task.add_done_callback(lambda _t, s=serial: self.screenshot_tasks.pop(s, None))
                last_screenshot_time = current_time

            # Log progress every 5 seconds
            if frame_count % 300 == 0:
                mb_sent = bytes_sent / (1024 * 1024)
                print(f"[Stream] {serial}: {frame_count} frames, {mb_sent:.2f} MB sent")

        print(f"[VideoStreamManager] Video stream ended for {serial}")
        print(f"[Stats] Total frames: {frame_count}, Total data: {bytes_sent / (1024 * 1024):.2f} MB")

    async def _broadcast_frame(self, serial: str, frame: Dict):
        """Broadcast video frame (with header) to subscribed clients"""
        watchers = self.device_clients.get(serial)
        if not watchers:
            return

        serial_bytes = serial.encode('utf-8')
        if len(serial_bytes) > 255:
            return

        pts = frame['pts'] & 0x3FFFFFFFFFFFFFFF
        if frame.get('is_config'):
            pts |= 0x8000000000000000
        if frame.get('is_keyframe'):
            pts |= 0x4000000000000000

        header = struct.pack(">QI", pts, frame['size'])
        prefix = bytes([len(serial_bytes)]) + serial_bytes + header
        payload = prefix + frame['data']

        dead_clients = []
        for ws in list(watchers):
            try:
                await ws.send_bytes(payload)
            except (ConnectionResetError, RuntimeError):
                dead_clients.append(ws)

        for ws in dead_clients:
            asyncio.create_task(self.stop_stream(serial, ws))

    async def _broadcast_error(self, error_msg: str, serial: Optional[str] = None):
        """Broadcast error message"""
        if serial:
            targets = self.device_clients.get(serial, set())
        else:
            targets = self.clients

        if not targets:
            return

        message = {
            'type': 'error',
            'message': error_msg
        }
        if serial:
            message['serial'] = serial

        dead_clients = []
        for ws in list(targets):
            try:
                await ws.send_json(message)
            except ConnectionResetError:
                dead_clients.append(ws)
            except RuntimeError:
                dead_clients.append(ws)

        if serial:
            for ws in dead_clients:
                asyncio.create_task(self.stop_stream(serial, ws))
        else:
            for ws in dead_clients:
                await self.unregister_client(ws)

    async def _capture_and_broadcast_screenshot(self, serial: str):
        """Capture screenshot using adb and broadcast to clients"""
        # Capture screenshot via adb
        proc = await asyncio.create_subprocess_exec(
            'adb', '-s', serial, 'exec-out', 'screencap', '-p',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0 or not stdout:
            return

        # Convert to base64
        screenshot_b64 = base64.b64encode(stdout).decode('utf-8')

        # Broadcast screenshot
        watchers = self.device_clients.get(serial)
        if not watchers:
            return

        message = {
            'type': 'screenshot',
            'serial': serial,
            'data': screenshot_b64
        }

        dead_clients = []
        for ws in list(watchers):
            try:
                await ws.send_json(message)
            except ConnectionResetError:
                dead_clients.append(ws)
            except RuntimeError:
                dead_clients.append(ws)

        for ws in dead_clients:
            asyncio.create_task(self.stop_stream(serial, ws))

    async def handle_touch_event(
        self,
        serial: str,
        ws: web.WebSocketResponse,
        action: str,
        x: int,
        y: int,
        pressure: float,
        pointer_id: int
    ) -> Tuple[bool, Optional[str]]:
        """Inject touch events to the active device"""
        device = self.active_devices.get(serial)
        if not device:
            return False, "Device is not streaming"

        watchers = self.device_clients.get(serial)
        if not watchers or ws not in watchers:
            return False, "Client is not attached to this stream"

        info_payload = self._get_device_info_payload(device)
        resolution = info_payload['resolution'] if info_payload else self.default_resolution

        width = max(1, int(resolution.get('width', self.default_resolution['width'])))
        height = max(1, int(resolution.get('height', self.default_resolution['height'])))

        clamped_x = max(0, min(width - 1, int(x)))
        clamped_y = max(0, min(height - 1, int(y)))
        normalized_pressure = max(0.0, min(1.0, float(pressure)))

        loop = asyncio.get_event_loop()

        lock = self.control_locks.get(serial)
        if not lock:
            return False, "Control channel unavailable"

        async def dispatch(touch_action: TouchAction):
            event = TouchEvent(
                action=touch_action,
                x=clamped_x,
                y=clamped_y,
                pressure=normalized_pressure,
                pointer_id=pointer_id
            )
            message = MessageBuilder.build_touch_event(event, width, height)
            async with lock:
                await loop.run_in_executor(None, device.send_control_message, message)

        if action == 'double_tap':
            # Simulate two quick taps
            await dispatch(TouchAction.DOWN)
            await dispatch(TouchAction.UP)
            await asyncio.sleep(0.08)
            await dispatch(TouchAction.DOWN)
            await dispatch(TouchAction.UP)
            return True, None

        action_map = {
            'down': TouchAction.DOWN,
            'move': TouchAction.MOVE,
            'up': TouchAction.UP
        }

        if action not in action_map:
            return False, f"Unsupported touch action: {action}"

        await dispatch(action_map[action])
        return True, None


# ========== Initialize scrcpy and get tool paths ==========
ColorPrint.blue("=" * 70)
ColorPrint.blue("[Scrcpy Web Test] Initializing scrcpy tools from user data directory...")
ColorPrint.blue("=" * 70)

scrcpy_initializer = get_initializer()

# Ensure scrcpy is initialized (auto-downloads to C:\Users\<username>\.core_node\scrcpy)
if not scrcpy_initializer.is_initialized():
    ColorPrint.blue("[Scrcpy Web Test] Scrcpy not initialized, initializing now...")
    if scrcpy_initializer.initialize():
        ColorPrint.green("[Scrcpy Web Test] ✓ Scrcpy initialized successfully")
    else:
        ColorPrint.red("[Scrcpy Web Test] ✗ Failed to initialize scrcpy")
        raise RuntimeError("Failed to initialize scrcpy")
else:
    ColorPrint.green("[Scrcpy Web Test] ✓ Scrcpy already initialized")

# Get tool paths from user data directory
paths = scrcpy_initializer.get_paths()
ADB_PATH = str(paths['adb']) if paths['adb'] else "adb"
SCRCPY_PATH = str(paths['scrcpy']) if paths['scrcpy'] else "scrcpy"

ColorPrint.green(f"[Scrcpy Web Test] ✓ ADB path: {ADB_PATH}")
ColorPrint.green(f"[Scrcpy Web Test] ✓ Scrcpy path: {SCRCPY_PATH}")
ColorPrint.blue("=" * 70)

# Global instances
scanner = DeviceScanner(adb_path=ADB_PATH)
SCRCPY_SERVER_JAR = Path(__file__).resolve().parent.parent / "matrix" / "resources" / "scrcpy-server.jar"
# CRITICAL: Android 7.0 ClassLoader cannot load files with .jar extension!
# Must push and reference file WITHOUT extension (scrcpy-server, not scrcpy-server.jar)
# Git Bash path conversion prevention: Use // prefix (doubled slash)
SCRCPY_REMOTE_PATH = "//data/local/tmp/scrcpy-server"


async def ensure_scrcpy_server(serial: str, adb_path: str = None) -> bool:
    """Ensure scrcpy-server.jar is present on target device"""
    # Use global ADB_PATH if not specified
    if adb_path is None:
        adb_path = ADB_PATH

    if not SCRCPY_SERVER_JAR.exists():
        print(f"✗ Missing scrcpy-server.jar at {SCRCPY_SERVER_JAR}")
        return False

    print(f"[Scrcpy] Pushing server jar to {serial} ...")

    loop = asyncio.get_event_loop()

    def push_server():
        import os
        env = os.environ.copy()
        # CRITICAL: Disable Git Bash path conversion to prevent /data/local/tmp -> D:/applications/Git/data/local/tmp
        # This is needed when running Python from Git Bash environment on Windows
        env['MSYS_NO_PATHCONV'] = '1'
        return subprocess.run(
            [adb_path, "-s", serial, "push", str(SCRCPY_SERVER_JAR), SCRCPY_REMOTE_PATH],
            capture_output=True,
            text=True,
            env=env
        )

    proc = await loop.run_in_executor(None, push_server)

    if proc.returncode != 0:
        print(f"✗ Failed to push scrcpy-server.jar: {proc.stderr}")
        return False

    print(f"✓ scrcpy-server.jar pushed to device {serial}")
    return True


stream_manager = VideoStreamManager()


# HTTP Handlers
async def handle_index(request):
    """Serve the main HTML page"""
    index_path = Path(__file__).parent / "index.html"
    if index_path.exists():
        return web.FileResponse(index_path)
    else:
        return web.Response(text="index.html not found", status=404)


async def handle_devices(request):
    """API endpoint to get device list"""
    devices = scanner.scan_devices()
    return web.json_response({
        'devices': devices,
        'count': len(devices)
    })


async def handle_websocket(request):
    """WebSocket handler for video streaming"""
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    await stream_manager.register_client(ws)

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            data = json.loads(msg.data)
            command = data.get('command')

            if command == 'start_stream':
                serial = data.get('serial')
                if not serial:
                    await ws.send_json({
                        'type': 'error',
                        'message': 'No device serial provided'
                    })
                    continue

                success, started_new, info_payload = await stream_manager.start_stream(serial, ws)

                if success:
                    response_type = 'stream_started' if started_new else 'stream_attached'
                    response = {
                        'type': response_type,
                        'serial': serial
                    }
                    if info_payload:
                        response['info'] = info_payload
                    await ws.send_json(response)
                else:
                    await ws.send_json({
                        'type': 'stream_error',
                        'serial': serial,
                        'message': f'Failed to start stream for {serial}'
                    })

            elif command == 'stop_stream':
                serial = data.get('serial')
                if not serial:
                    await ws.send_json({
                        'type': 'error',
                        'message': 'No device serial provided for stop command'
                    })
                    continue

                success, stopped = await stream_manager.stop_stream(serial, ws)

                if not success:
                    await ws.send_json({
                        'type': 'error',
                        'serial': serial,
                        'message': f'No active stream for {serial}'
                    })
                else:
                    response_type = 'stream_stopped' if stopped else 'stream_detached'
                    await ws.send_json({
                        'type': response_type,
                        'serial': serial
                    })

            elif command == 'touch_event':
                serial = data.get('serial')
                if not serial:
                    await ws.send_json({
                        'type': 'error',
                        'message': 'No device serial provided for touch event'
                    })
                    continue

                action = data.get('action')
                x = data.get('x')
                y = data.get('y')

                if action not in {'down', 'move', 'up', 'double_tap'} or x is None or y is None:
                    await ws.send_json({
                        'type': 'error',
                        'serial': serial,
                        'message': 'Invalid touch payload'
                    })
                    continue

                pressure = float(data.get('pressure', 1.0))
                pointer_id = int(data.get('pointerId', 0))

                success, error_message = await stream_manager.handle_touch_event(
                    serial,
                    ws,
                    action,
                    int(x),
                    int(y),
                    pressure,
                    pointer_id
                )

                if not success:
                    await ws.send_json({
                        'type': 'error',
                        'serial': serial,
                        'message': error_message or 'Touch event rejected'
                    })

        elif msg.type == aiohttp.WSMsgType.ERROR:
            print(f'WebSocket error: {ws.exception()}')

    await stream_manager.detach_client(ws)
    await stream_manager.unregister_client(ws)

    return ws


async def start_background_tasks(app):
    """Start background tasks"""
    print("[Server] Background tasks started")


async def cleanup_background_tasks(app):
    """Cleanup background tasks"""
    print("[Server] Cleaning up...")

    # Stop all active streams
    for serial in list(stream_manager.active_devices.keys()):
        await stream_manager.stop_stream(serial, force=True)

    print("[Server] Cleanup complete")


def create_app():
    """Create and configure the web application"""
    app = web.Application()

    # Routes
    app.router.add_get('/', handle_index)
    app.router.add_get('/api/devices', handle_devices)
    app.router.add_get('/ws', handle_websocket)

    # Static files
    static_path = Path(__file__).parent / 'static'
    if static_path.exists():
        app.router.add_static('/static', static_path)

    # Background tasks
    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)

    return app


def main():
    """Main entry point"""
    app = create_app()
    print("=" * 70)
    print("Scrcpy Web Test Server")
    print("=" * 70)
    print(f"Server starting on http://localhost:27880")
    print(f"WebSocket endpoint: ws://localhost:27880/ws")
    print(f"API endpoint: http://localhost:27880/api/devices")
    print("=" * 70)

    web.run_app(app, host='0.0.0.0', port=27880)


if __name__ == '__main__':
    main()
