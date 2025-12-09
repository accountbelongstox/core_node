"""Video streaming service using direct H.264 frame reading from ScrcpyDevice"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import asyncio
import struct
from typing import Optional, Dict, Set
from fastapi import WebSocket, WebSocketDisconnect

from pycore import ColorPrint
from pycore.pyutils.device_manager import DeviceManager
from pycore.pyutils.device import ServerParams, VideoCodec, ADBManager
from pyapps.matrix.matrix_config import Config
from pyapps.matrix.services.config_service import ConfigService
from .video_decoder_service import VideoDecoderService


class VideoStreamService:
    """
    Video streaming service - Direct H.264 frame streaming (scrcpy_web_test architecture)

    Architecture:
    - Each device has ONE background streaming task
    - Multiple WebSocket clients can subscribe to same device stream
    - Frames are broadcast to all subscribed clients
    """

    _instance: Optional['VideoStreamService'] = None

    def __init__(self):
        self.adb_path = Config.get_adb_path()
        self.device_manager = DeviceManager.instance()
        self.scrcpy_server_jar = Config.get_scrcpy_server_jar()

        # Background streaming tasks (one per device)
        self.active_streams: Dict[str, asyncio.Task] = {}
        self.stop_events: Dict[str, asyncio.Event] = {}

        # WebSocket client management (multiple clients per device)
        self.stream_clients: Dict[str, Set[WebSocket]] = {}

        # Config frame cache (one per device) - Critical for H.264 decoding
        # When new clients join, they need SPS/PPS config frame to start decoding
        self.cached_config_frames: Dict[str, Dict] = {}

    @classmethod
    def instance(cls) -> 'VideoStreamService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def start_stream(self, serial: str, websocket: WebSocket) -> bool:
        """
        Start streaming for a device (scrcpy_web_test pattern)

        Creates background streaming task if not exists, subscribes WebSocket client.
        If device not connected, connects it first (blocks 30s, but WebSocket waits).

        Args:
            serial: Device serial number
            websocket: WebSocket client to subscribe

        Returns:
            True if successful
        """
        ColorPrint.blue(f"[VideoStreamService] start_stream called for {serial}")

        # Add client to subscription list
        if serial not in self.stream_clients:
            self.stream_clients[serial] = set()
        self.stream_clients[serial].add(websocket)
        ColorPrint.green(f"[VideoStreamService] Client subscribed to {serial}, total clients: {len(self.stream_clients[serial])}")

        # If streaming task already exists, send cached config frame to new client
        if serial in self.active_streams:
            ColorPrint.yellow(f"[VideoStreamService] Stream already active for {serial}, attached client")

            # Send stream_started message first
            await websocket.send_json({"type": "stream_started", "serial": serial})

            # Send cached config frame to new client (critical for H.264 decoding)
            if serial in self.cached_config_frames:
                config_frame = self.cached_config_frames[serial]
                ColorPrint.green(f"[VideoStreamService] Sending cached config frame to new client for {serial}")
                payload = self._pack_frame(serial, config_frame)
                await websocket.send_bytes(payload)
            else:
                ColorPrint.yellow(f"[VideoStreamService] No cached config frame for {serial}, client must wait for next keyframe")

            return True

        # Get or create device (device already visible in adb devices, just start scrcpy-server)
        device = self.device_manager.get_device(serial)
        if not device:
            ColorPrint.yellow(f"[VideoStreamService] Device {serial} not in DeviceManager, creating ScrcpyDevice...")

            # Device is already connected via adb (visible in adb devices)
            # Just create ScrcpyDevice and start scrcpy-server
            from pycore.pyutils.device import ScrcpyDevice
            from pathlib import Path
            import subprocess

            server_params = ServerParams(
                max_size=720,
                bit_rate=8000000,
                max_fps=60,
                codec=VideoCodec.H264,
                control=True
            )

            # Ensure scrcpy-server.jar is on device (scrcpy_web_test pattern)
            ColorPrint.blue(f"[VideoStreamService] Ensuring scrcpy-server.jar on device {serial}...")
            scrcpy_jar = Path(self.scrcpy_server_jar)
            if not scrcpy_jar.exists():
                ColorPrint.red(f"[VideoStreamService] ✗ Missing scrcpy-server.jar at {scrcpy_jar}")
                error_msg = {"type": "video.error", "data": {"error": f"Missing scrcpy-server.jar"}}
                await websocket.send_json(error_msg)
                return False

            loop = asyncio.get_event_loop()
            push_result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    [self.adb_path, "-s", serial, "push", str(scrcpy_jar), "/data/local/tmp/scrcpy-server.jar"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
            )

            if push_result.returncode != 0:
                ColorPrint.red(f"[VideoStreamService] ✗ Failed to push scrcpy-server.jar: {push_result.stderr}")
                error_msg = {"type": "video.error", "data": {"error": "Failed to push scrcpy-server.jar"}}
                await websocket.send_json(error_msg)
                return False

            ColorPrint.green(f"[VideoStreamService] ✓ scrcpy-server.jar pushed to {serial}")

            # Create device and start scrcpy-server
            device = ScrcpyDevice(serial, server_params, self.adb_path)

            # Start scrcpy-server with timeout protection
            try:
                ColorPrint.blue(f"[VideoStreamService] Starting scrcpy-server for {serial} (30s timeout)...")
                await asyncio.wait_for(
                    loop.run_in_executor(None, device.start_server),
                    timeout=30.0
                )
                ColorPrint.green(f"[VideoStreamService] ✓ ScrcpyDevice started for {serial}")
            except asyncio.TimeoutError:
                ColorPrint.red(f"[VideoStreamService] ✗ Timeout starting scrcpy-server for {serial}")
                error_msg = {"type": "video.error", "data": {"error": "Timeout starting video server"}}
                await websocket.send_json(error_msg)
                # Remove client from subscription
                if serial in self.stream_clients:
                    self.stream_clients[serial].discard(websocket)
                    if len(self.stream_clients[serial]) == 0:
                        del self.stream_clients[serial]
                return False
            except Exception as e:
                ColorPrint.red(f"[VideoStreamService] ✗ Failed to start scrcpy-server for {serial}: {e}")
                error_msg = {"type": "video.error", "data": {"error": f"Failed to start video server: {str(e)}"}}
                await websocket.send_json(error_msg)
                # Remove client from subscription
                if serial in self.stream_clients:
                    self.stream_clients[serial].discard(websocket)
                    if len(self.stream_clients[serial]) == 0:
                        del self.stream_clients[serial]
                return False

        ColorPrint.green(f"[VideoStreamService] Device {serial} ready, starting background streaming task")

        # Create stop event
        stop_event = asyncio.Event()
        self.stop_events[serial] = stop_event

        # Create background streaming task
        task = asyncio.create_task(self._stream_video_loop(serial, device, stop_event))
        self.active_streams[serial] = task

        ColorPrint.green(f"[VideoStreamService] Background streaming task created for {serial}")
        return True

    async def stop_stream(self, serial: str, websocket: WebSocket):
        """Stop streaming for a device or detach client"""
        ColorPrint.blue(f"[VideoStreamService] stop_stream called for {serial}")

        # Remove client from subscription list
        if serial in self.stream_clients:
            self.stream_clients[serial].discard(websocket)
            ColorPrint.yellow(f"[VideoStreamService] Client unsubscribed from {serial}, remaining: {len(self.stream_clients[serial])}")

            # If no more clients, stop streaming task
            if len(self.stream_clients[serial]) == 0:
                ColorPrint.blue(f"[VideoStreamService] No more clients for {serial}, stopping task")
                del self.stream_clients[serial]

                if serial in self.stop_events:
                    self.stop_events[serial].set()
                    del self.stop_events[serial]

                if serial in self.active_streams:
                    del self.active_streams[serial]

    async def _stream_video_loop(self, serial: str, device, stop_event: asyncio.Event):
        """
        Background streaming task (scrcpy_web_test pattern)

        Continuously reads frames from device and broadcasts to all subscribed WebSocket clients.
        """
        ColorPrint.blue(f"[VideoStreamService] Background streaming loop started for {serial}")

        loop = asyncio.get_event_loop()
        frame_count = 0
        bytes_sent = 0
        start_time = loop.time()

        # Get device info
        device_info = device.get_device_info()

        # Send init message to all clients
        init_message = {
            "type": "video.init",
            "timestamp": 0,
            "data": {
                "serial": serial,
                "codec": "h264",
                "width": device_info.resolution.width,
                "height": device_info.resolution.height,
                "fps": device.params.max_fps,
                "bitrate": device.params.bit_rate
            }
        }
        await self._broadcast_json(serial, init_message)

        while not stop_event.is_set():
            # Read video frame (blocking call, run in executor)
            frame = await loop.run_in_executor(None, device.read_video_frame)

            # DEBUG: Log first 5 frames to verify config frame
            if frame_count < 5:
                ColorPrint.yellow(f"[VideoStreamService] Frame {frame_count + 1} for {serial}: is_config={frame.get('is_config')}, is_keyframe={frame.get('is_keyframe')}, size={frame.get('size')}")

            if not frame:
                ColorPrint.yellow(f"[VideoStreamService] Video stream ended for {serial}")
                break

            frame_count += 1
            bytes_sent += len(frame['data'])

            # Cache config frame (SPS/PPS) for new clients
            # Config frames are critical - new clients need them to start decoding
            if frame.get('is_config'):
                self.cached_config_frames[serial] = frame
                ColorPrint.green(f"[VideoStreamService] ✓ Cached config frame for {serial} (size: {frame['size']} bytes)")

            # Broadcast frame to all subscribed clients
            await self._broadcast_frame(serial, frame)

            # Send metadata every 60 frames
            if frame_count % 60 == 0:
                elapsed = loop.time() - start_time
                fps = frame_count / elapsed if elapsed > 0 else 0

                metadata = {
                    "type": "video.metadata",
                    "timestamp": int(elapsed * 1000),
                    "data": {
                        "fps": round(fps, 2),
                        "frames": frame_count,
                        "bytes": bytes_sent,
                        "mbps": round(bytes_sent * 8 / elapsed / 1_000_000, 2) if elapsed > 0 else 0
                    }
                }
                await self._broadcast_json(serial, metadata)

            # Log progress every 300 frames
            if frame_count % 300 == 0:
                mb_sent = bytes_sent / (1024 * 1024)
                ColorPrint.blue(f"[VideoStreamService] {serial}: {frame_count} frames, {mb_sent:.2f} MB sent")

        ColorPrint.blue(f"[VideoStreamService] Streaming loop ended for {serial}")
        ColorPrint.blue(f"[Stats] Frames: {frame_count}, Data: {bytes_sent / (1024 * 1024):.2f} MB")

        # Cleanup
        if serial in self.active_streams:
            del self.active_streams[serial]
        if serial in self.stream_clients:
            del self.stream_clients[serial]
        if serial in self.cached_config_frames:
            del self.cached_config_frames[serial]
            ColorPrint.blue(f"[VideoStreamService] Cleaned up cached config frame for {serial}")

    async def _broadcast_frame(self, serial: str, frame: Dict):
        """Broadcast binary frame to all subscribed clients"""
        clients = self.stream_clients.get(serial)
        if not clients:
            return

        # Pack frame with custom protocol
        payload = self._pack_frame(serial, frame)

        # Broadcast to all clients
        for ws in list(clients):
            await ws.send_bytes(payload)

    async def _broadcast_json(self, serial: str, message: Dict):
        """Broadcast JSON message to all subscribed clients"""
        clients = self.stream_clients.get(serial)
        if not clients:
            return

        for ws in list(clients):
            await ws.send_json(message)

    def _pack_frame(self, serial: str, frame: Dict) -> bytes:
        """
        Pack video frame with custom binary protocol

        Format (from scrcpy_web_test/server.py:375-393):
            [serial_len(1 byte)][serial(N bytes)][pts(8 bytes)][size(4 bytes)][H.264 data]
        """
        # Encode serial
        serial_bytes = serial.encode('utf-8')
        if len(serial_bytes) > 255:
            serial_bytes = serial_bytes[:255]

        # Pack PTS with flags
        pts = frame['pts'] & 0x3FFFFFFFFFFFFFFF
        if frame.get('is_config'):
            pts |= 0x8000000000000000
        if frame.get('is_keyframe'):
            pts |= 0x4000000000000000

        # Pack header
        header = struct.pack(">QI", pts, frame['size'])
        prefix = bytes([len(serial_bytes)]) + serial_bytes + header

        # Combine
        payload = prefix + frame['data']
        return payload
