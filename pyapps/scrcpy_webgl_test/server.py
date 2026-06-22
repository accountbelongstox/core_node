#!/usr/bin/env python3
"""
Scrcpy WebGL Test Server - YUV Streaming with WebGL Rendering
HTTP + WebSocket server for device management and YUV video streaming
"""

import asyncio
import json
import subprocess
import time
import struct
from pathlib import Path
from typing import Dict, Set, Optional, Tuple, Any

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_aiohttp

aiohttp = get_third_package_aiohttp()
from aiohttp import web

from pycore.pyutils.device.scrcpy_device import ScrcpyDevice
from pycore.pyutils.device.server_params import ServerParams
from pycore.pyutils.control import TouchEvent, TouchAction, MessageBuilder

# Import local video decoder (independent implementation)
from pyapps.scrcpy_webgl_test.video_decoder import VideoDecoder
from pyapps.scrcpy_webgl_test.scrcpy_webgl_test_config import Config


# Device scanner
class DeviceScanner:
    def __init__(self, adb_path="adb"):
        self.adb_path = adb_path

    def scan_devices(self):
        """Scan all connected ADB devices"""
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

        return devices

    def _get_device_property(self, serial: str, prop: str) -> str:
        """Get device property via getprop"""
        result = subprocess.run(
            [self.adb_path, "-s", serial, "shell", "getprop", prop],
            capture_output=True,
            text=True,
            timeout=3
        )
        return result.stdout.strip()


# WebSocket manager for YUV video streaming
class YUVStreamManager:
    def __init__(self):
        self.clients: Set[web.WebSocketResponse] = set()
        self.active_devices: Dict[str, ScrcpyDevice] = {}
        self.stream_tasks: Dict[str, asyncio.Task] = {}
        self.stop_events: Dict[str, asyncio.Event] = {}
        self.device_clients: Dict[str, Set[web.WebSocketResponse]] = {}
        self.client_devices: Dict[web.WebSocketResponse, Set[str]] = {}
        self.default_resolution = {'width': 1080, 'height': 1920}
        self.control_locks: Dict[str, asyncio.Lock] = {}

        # YUV decoder (local implementation)
        self.decoder = VideoDecoder()

    def _get_device_info_payload(self, device: ScrcpyDevice) -> Optional[Dict[str, Any]]:
        try:
            info = device.get_device_info()
        except RuntimeError:
            return None

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
        print(f"[+] Client registered. Total clients: {len(self.clients)}")

    async def unregister_client(self, ws: web.WebSocketResponse):
        """Unregister a WebSocket client"""
        self.clients.discard(ws)
        print(f"[-] Client unregistered. Total clients: {len(self.clients)}")

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

    async def start_stream(self, serial: str, ws: web.WebSocketResponse) -> Tuple[bool, bool, Optional[Dict[str, Any]]]:
        """
        Start YUV video stream for a device

        Returns:
            (success, started_new, device_info)
        """
        self._attach_client(serial, ws)

        if serial in self.active_devices:
            print(f"[YUVStreamManager] {serial} already streaming, attached client")
            info_payload = self._get_device_info_payload(self.active_devices[serial])
            return True, False, info_payload

        print(f"\n[YUVStreamManager] Starting YUV stream for {serial}")

        params = ServerParams(
            max_size=Config.VIDEO_MAX_SIZE,
            max_fps=Config.VIDEO_MAX_FPS,
            bit_rate=Config.VIDEO_BIT_RATE,
            control=True,
        )

        device = ScrcpyDevice(serial, params)

        if not await ensure_scrcpy_server(serial, device.adb_path):
            print(f"[X] Unable to ensure scrcpy-server.jar for {serial}")
            self._detach_client(serial, ws)
            return False, False, None

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, device.start_server)

        self.active_devices[serial] = device

        # Create YUV decoder for this device
        self.decoder.create_decoder(serial)

        stop_event = asyncio.Event()
        self.stop_events[serial] = stop_event

        task = asyncio.create_task(self._stream_yuv_video(serial, device, stop_event))
        self.stream_tasks[serial] = task

        info_payload = self._get_device_info_payload(device)
        self.control_locks.setdefault(serial, asyncio.Lock())

        print(f"[OK] YUV stream started for {serial}")
        return True, True, info_payload

    async def stop_stream(self, serial: str, ws: Optional[web.WebSocketResponse] = None, force: bool = False) -> Tuple[bool, bool]:
        """
        Stop YUV video stream for a device

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

        print(f"\n[YUVStreamManager] Stopping YUV stream for {serial}")

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

        # Close YUV decoder
        self.decoder.close_decoder(serial)

        if serial in self.active_devices:
            device = self.active_devices.pop(serial)
            device.stop_server()

        if serial in self.stop_events:
            del self.stop_events[serial]

        self.device_clients.pop(serial, None)
        self.control_locks.pop(serial, None)

        print(f"[OK] YUV stream stopped for {serial}")
        return True, True

    async def _stream_yuv_video(self, serial: str, device: ScrcpyDevice, stop_event: asyncio.Event):
        """Stream YUV video frames from device to WebSocket clients"""
        print(f"[YUVStreamManager] Starting YUV frame reader for {serial}")

        frame_count = 0
        yuv_bytes_sent = 0
        h264_bytes_received = 0
        config_frames_received = 0
        loop = asyncio.get_event_loop()

        while not stop_event.is_set():
            # Read H.264 video frame from device
            h264_frame = await loop.run_in_executor(None, device.read_video_frame)

            if not h264_frame:
                print(f"[X] Video stream ended for {serial}")
                break

            h264_data = h264_frame['data']
            h264_bytes_received += len(h264_data)

            # Check if this is a config frame (SPS/PPS)
            is_config = h264_frame.get('is_config', False)

            if is_config:
                config_frames_received += 1
                print(f"[YUVStreamManager] Received config frame #{config_frames_received} ({len(h264_data)} bytes)")
                # Send config frame to decoder to initialize it
                # Config frames don't produce video output, so we skip broadcasting
                self.decoder.decode_frame(serial, h264_data)
                continue

            # Decode H.264 to YUV420P
            yuv_frame = self.decoder.decode_frame(serial, h264_data)

            if not yuv_frame:
                # Skip if decode failed (may be incomplete frame)
                continue

            frame_count += 1

            # Broadcast YUV frame to WebSocket clients
            yuv_payload_size = await self._broadcast_yuv_frame(
                serial,
                yuv_frame,
                h264_frame.get('pts', 0)
            )
            yuv_bytes_sent += yuv_payload_size

            # Log progress every 5 seconds
            if frame_count % 300 == 0:
                h264_mb = h264_bytes_received / (1024 * 1024)
                yuv_mb = yuv_bytes_sent / (1024 * 1024)
                compression_ratio = h264_bytes_received / yuv_bytes_sent if yuv_bytes_sent > 0 else 0
                print(f"[YUV Stream] {serial}: {frame_count} frames")
                print(f"  H.264 received: {h264_mb:.2f} MB")
                print(f"  YUV sent: {yuv_mb:.2f} MB")
                print(f"  Compression ratio: {compression_ratio:.2f}x")

        print(f"[YUVStreamManager] YUV stream ended for {serial}")
        print(f"[Stats] Total frames: {frame_count} (+ {config_frames_received} config frames)")
        print(f"[Stats] H.264 data: {h264_bytes_received / (1024 * 1024):.2f} MB")
        print(f"[Stats] YUV data: {yuv_bytes_sent / (1024 * 1024):.2f} MB")

    async def _broadcast_yuv_frame(self, serial: str, yuv_frame: Dict, pts: int) -> int:
        """
        Broadcast YUV frame to subscribed clients

        Protocol:
        [1 byte] serial length
        [N bytes] serial (UTF-8)
        [8 bytes] pts (uint64, big-endian)
        [2 bytes] width (uint16, big-endian)
        [2 bytes] height (uint16, big-endian)
        [4 bytes] y_size (int32, big-endian)
        [4 bytes] u_size (int32, big-endian)
        [4 bytes] v_size (int32, big-endian)
        [y_size bytes] Y plane data
        [u_size bytes] U plane data
        [v_size bytes] V plane data

        Returns:
            Total payload size in bytes
        """
        watchers = self.device_clients.get(serial)
        if not watchers:
            print(f"[DEBUG] No watchers for {serial}, device_clients keys: {list(self.device_clients.keys())}")
            return 0

        print(f"[DEBUG] Broadcasting frame to {len(watchers)} clients for {serial}")

        serial_bytes = serial.encode('utf-8')
        if len(serial_bytes) > 255:
            return 0

        width = yuv_frame['width']
        height = yuv_frame['height']
        y_plane = yuv_frame['y_plane']
        u_plane = yuv_frame['u_plane']
        v_plane = yuv_frame['v_plane']

        # Build protocol header in two parts to match frontend parsing
        # Frontend expects: serialLen, serial, pts, width, height, sizes, planes
        header_part1 = struct.pack(">B", len(serial_bytes))  # 1 byte: serial length
        header_part2 = struct.pack(
            ">QHHIII",
            pts,                 # 8 bytes: pts
            width,               # 2 bytes: width
            height,              # 2 bytes: height
            len(y_plane),        # 4 bytes: y_size
            len(u_plane),        # 4 bytes: u_size
            len(v_plane)         # 4 bytes: v_size
        )

        # Construct payload: serialLen, serial, rest of header, YUV planes
        payload = header_part1 + serial_bytes + header_part2 + y_plane + u_plane + v_plane

        # Broadcast to clients
        dead_clients = []
        for ws in list(watchers):
            try:
                await ws.send_bytes(payload)
            except (ConnectionResetError, RuntimeError):
                dead_clients.append(ws)

        for ws in dead_clients:
            asyncio.create_task(self.stop_stream(serial, ws))

        return len(payload)

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


# Global instances
scanner = DeviceScanner()


async def ensure_scrcpy_server(serial: str, adb_path: str = "adb") -> bool:
    """Ensure scrcpy-server.jar is present on target device"""
    if not Config.SCRCPY_SERVER_JAR.exists():
        print(f"[X] Missing scrcpy-server.jar at {Config.SCRCPY_SERVER_JAR}")
        return False

    print(f"[Scrcpy] Pushing server jar to {serial} ...")

    loop = asyncio.get_event_loop()

    def push_server():
        return subprocess.run(
            [adb_path, "-s", serial, "push", str(Config.SCRCPY_SERVER_JAR), Config.SCRCPY_REMOTE_PATH],
            capture_output=True,
            text=True
        )

    proc = await loop.run_in_executor(None, push_server)

    if proc.returncode != 0:
        print(f"[X] Failed to push scrcpy-server.jar: {proc.stderr}")
        return False

    print(f"[OK] scrcpy-server.jar pushed to device {serial}")
    return True


stream_manager = YUVStreamManager()


# HTTP Handlers
async def handle_index(request):
    """Serve the main HTML page"""
    if Config.FRONTEND_FILE.exists():
        return web.FileResponse(Config.FRONTEND_FILE)
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
    """WebSocket handler for YUV video streaming"""
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
                        'serial': serial,
                        'stream_type': 'yuv'
                    }
                    if info_payload:
                        response['info'] = info_payload
                    await ws.send_json(response)
                else:
                    await ws.send_json({
                        'type': 'stream_error',
                        'serial': serial,
                        'message': f'Failed to start YUV stream for {serial}'
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

    # Close all decoders
    stream_manager.decoder.close_all()

    print("[Server] Cleanup complete")


def create_app():
    """Create and configure the web application"""
    app = web.Application()

    # Routes
    app.router.add_get('/', handle_index)
    app.router.add_get('/api/devices', handle_devices)
    app.router.add_get('/ws', handle_websocket)

    # Background tasks
    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)

    return app


def main():
    """Main entry point (deprecated - use start_server() instead)"""
    start_server()


def start_server():
    """Start the Scrcpy WebGL Test server"""
    app = create_app()
    web.run_app(app, host=Config.WEB_HOST, port=Config.WEB_PORT)


if __name__ == '__main__':
    main()
