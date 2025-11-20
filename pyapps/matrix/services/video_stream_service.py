"""Video streaming service using pycore VideoStreamHandler"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import asyncio
from typing import Optional, Dict
from fastapi import WebSocket

from pycore import ColorPrint
from pycore.pyutils.device_manager import DeviceManager
from pycore.pyutils.video_stream import VideoStreamHandler
from pyapps.matrix.config import Config


class VideoStreamService:
    """
    Video streaming service

    Responsibilities:
    - Manage video streams from scrcpy-server
    - Encode H.264 to fMP4
    - Send video frames via WebSocket
    """

    _instance: Optional['VideoStreamService'] = None

    def __init__(self):
        self.adb_path = Config.get_adb_path()
        self.device_manager = DeviceManager.instance()
        self.streams: Dict[str, asyncio.Task] = {}  # serial -> stream task
        self.handlers: Dict[str, VideoStreamHandler] = {}  # serial -> stream handler
        self.paused: Dict[str, bool] = {}  # serial -> is_paused
        self.frame_timestamps: Dict[str, list] = {}  # serial -> list of (frame_time, send_time)

    @classmethod
    def instance(cls) -> 'VideoStreamService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def stream_to_websocket(self, serial: str, websocket: WebSocket):
        """
        Stream video from device to WebSocket using VideoStreamHandler

        Args:
            serial: Device serial number
            websocket: WebSocket connection

        Flow:
            1. Get device from DeviceManager
            2. Create VideoStreamHandler
            3. Send fMP4 init segment
            4. Stream fMP4 media segments
        """
        handler = None
        # ✅ REMOVED outer try-except for debugging - let errors surface

        # Mark as not paused
        self.paused[serial] = False

        # Get device from centralized DeviceManager
        device = self.device_manager.get_device(serial)
        if not device:
            error_msg = {
                "type": "video.error",
                "timestamp": 0,
                "data": {"error": f"Device {serial} not connected"}
            }
            await websocket.send_json(error_msg)
            print(f"[VideoStreamService] ERROR: Device {serial} not found in DeviceManager")
            return

        # ✅ CRITICAL: Verify device is connected and ready for streaming
        if not device.is_connected():
            error_msg = {
                "type": "video.error",
                "timestamp": 0,
                "data": {"error": f"Device {serial} not connected. scrcpy-server may have failed to start."}
            }
            await websocket.send_json(error_msg)
            print(f"[VideoStreamService] ERROR: Device {serial} is not connected")
            print(f"[VideoStreamService] Device info: {device}")
            print(f"[VideoStreamService] Video socket: {device._video_socket}")
            print(f"[VideoStreamService] Control socket: {device._control_socket}")
            print(f"[VideoStreamService] Troubleshooting:")
            print(f"  1. Check if scrcpy-server.jar is pushed to /data/local/tmp/")
            print(f"  2. Check if device allows USB debugging")
            print(f"  3. Try reconnecting the device")
            return

        print(f"\n{'='*60}")
        print(f"[VideoStreamService] Starting video stream for {serial}")
        print(f"[VideoStreamService] Device: {device}")
        print(f"[VideoStreamService] Device connected: {device.is_connected()}")

        # ✅ REMOVED try-except - let errors surface
        video_socket = device.get_video_socket()
        print(f"[VideoStreamService] Video socket: {video_socket}")
        print(f"[VideoStreamService] Socket type: {type(video_socket)}")

        # Create and start video stream handler
        handler = VideoStreamHandler(device)
        self.handlers[serial] = handler

        # Start handler (parses H.264 config)
        print(f"[VideoStreamService] Starting VideoStreamHandler...")
        # ✅ REMOVED try-except - let errors surface
        await handler.start()
        print(f"[VideoStreamService] VideoStreamHandler started successfully")

        # Get device info
        device_info = device.get_device_info()

        # Send video init message
        init_message = {
            "type": "video.init",
            "timestamp": 0,
            "data": {
                "serial": serial,
                "codec": "h264",
                "width": device_info.resolution.width,
                "height": device_info.resolution.height,
                "fps": 60,
                "bitrate": device.params.bit_rate
            }
        }
        await websocket.send_json(init_message)

        # Send fMP4 init segment
        init_segment = handler.get_init_segment()
        if init_segment:
            await websocket.send_bytes(init_segment)
            print(f"[VideoStreamService] Sent init segment ({len(init_segment)} bytes)")

        # Streaming loop
        frame_count = 0
        start_time = asyncio.get_event_loop().time()

        # Initialize latency tracking
        self.frame_timestamps[serial] = []

        # Stream fMP4 chunks
        async for fmp4_chunk in handler.stream_fmp4():
            # Check if paused
            if self.paused.get(serial, False):
                await asyncio.sleep(0.1)
                continue

            # Record frame timestamp for latency calculation
            frame_time = asyncio.get_event_loop().time()

            # Send fMP4 media segment
            send_start = asyncio.get_event_loop().time()
            await websocket.send_bytes(fmp4_chunk)
            send_end = asyncio.get_event_loop().time()

            # Track send latency (network + encoding time)
            send_latency = (send_end - send_start) * 1000  # Convert to ms
            self.frame_timestamps[serial].append((frame_time, send_latency))

            # Keep only last 120 frames for latency calculation (~2 seconds at 60fps)
            if len(self.frame_timestamps[serial]) > 120:
                self.frame_timestamps[serial].pop(0)

            frame_count += 1

            # Send metadata every 60 frames (~1 second)
            if frame_count % 60 == 0:
                elapsed = asyncio.get_event_loop().time() - start_time

                # Calculate average latency from recent frames
                if self.frame_timestamps[serial]:
                    recent_latencies = [lat for _, lat in self.frame_timestamps[serial][-60:]]
                    avg_latency = sum(recent_latencies) / len(recent_latencies)
                else:
                    avg_latency = 0

                metadata = {
                    "type": "video.metadata",
                    "timestamp": int(elapsed * 1000),
                    "data": {
                        "fps": frame_count / elapsed if elapsed > 0 else 0,
                        "droppedFrames": 0,
                        "latency": round(avg_latency, 2)  # Actual measured latency in ms
                    }
                }
                await websocket.send_json(metadata)

        ColorPrint.blue(f"[VideoStreamService] Stream ended for {serial}")

        # Cleanup
        if handler:
            await handler.stop()
        if serial in self.handlers:
            del self.handlers[serial]
        if serial in self.paused:
            del self.paused[serial]
        if serial in self.frame_timestamps:
            del self.frame_timestamps[serial]

    async def set_quality(self, serial: str, quality_config: dict):
        """
        Change video quality settings dynamically

        Args:
            serial: Device serial number
            quality_config: Quality configuration dict containing:
                - max_size: Maximum resolution (short edge, e.g., 720, 1080)
                - bit_rate: Video bitrate in bps (e.g., 8000000 for 8 Mbps)
                - max_fps: Maximum frame rate (e.g., 30, 60)

        Note:
            Quality changes require reconnecting the video stream to take effect.
            This method updates the device parameters and will apply on next connection.
        """
        device = self.device_manager.get_device(serial)
        if not device:
            print(f"[VideoStreamService] Device {serial} not found for quality change")
            return

        # Update device parameters
        if 'max_size' in quality_config:
            device.params.max_size = quality_config['max_size']
            print(f"[VideoStreamService] Updated max_size to {quality_config['max_size']}")

        if 'bit_rate' in quality_config:
            device.params.bit_rate = quality_config['bit_rate']
            print(f"[VideoStreamService] Updated bit_rate to {quality_config['bit_rate']}")

        if 'max_fps' in quality_config:
            device.params.max_fps = quality_config['max_fps']
            print(f"[VideoStreamService] Updated max_fps to {quality_config['max_fps']}")

        print(f"[VideoStreamService] Quality settings updated for {serial}")
        print(f"[VideoStreamService] Note: Changes will apply on next video stream connection")

    async def pause(self, serial: str):
        """Pause video stream"""
        self.paused[serial] = True

    async def resume(self, serial: str):
        """Resume video stream"""
        self.paused[serial] = False

    async def stop(self, serial: str):
        """Stop video stream"""
        if serial in self.streams:
            task = self.streams[serial]
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            del self.streams[serial]
