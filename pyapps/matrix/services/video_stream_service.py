"""Video streaming service using direct H.264 frame reading from ScrcpyDevice"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import asyncio
import struct
from typing import Optional, Dict
from fastapi import WebSocket

from pycore import ColorPrint
from pycore.pyutils.device_manager import DeviceManager
from pyapps.matrix.matrix_config import Config


class VideoStreamService:
    """
    Video streaming service - Direct H.264 frame streaming

    Responsibilities:
    - Read raw H.264 frames from scrcpy video socket
    - Send frames directly to WebSocket with custom binary protocol
    - No encoding/transcoding - raw H.264 NAL units from device

    Protocol Format (from scrcpy_web_test/server.py):
        [serial_len(1 byte)][serial(N bytes)][pts(8 bytes)][size(4 bytes)][H.264 data]

        pts (8 bytes, big-endian uint64):
            - Bit 63 (0x8000000000000000): is_config frame
            - Bit 62 (0x4000000000000000): is_keyframe
            - Bits 0-61: Presentation timestamp

        size (4 bytes, big-endian uint32): Frame data length

        H.264 data: Raw NAL units from scrcpy-server
    """

    _instance: Optional['VideoStreamService'] = None

    def __init__(self):
        self.adb_path = Config.get_adb_path()
        self.device_manager = DeviceManager.instance()
        self.streams: Dict[str, asyncio.Task] = {}
        self.paused: Dict[str, bool] = {}
        self.frame_stats: Dict[str, Dict] = {}

    @classmethod
    def instance(cls) -> 'VideoStreamService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def stream_to_websocket(self, serial: str, websocket: WebSocket):
        """
        Stream video from device to WebSocket using direct H.264 frames

        This is the CORRECT implementation based on scrcpy_web_test/server.py.

        Flow:
            1. Get device from DeviceManager
            2. Verify device is connected
            3. Read video frames using device.read_video_frame()
            4. Pack frames with custom protocol header
            5. Send binary frames to WebSocket
            6. Send JSON metadata periodically

        Args:
            serial: Device serial number
            websocket: WebSocket connection
        """
        # Mark as not paused
        self.paused[serial] = False

        # Initialize frame stats
        self.frame_stats[serial] = {
            'frame_count': 0,
            'bytes_sent': 0,
            'start_time': asyncio.get_event_loop().time()
        }

        # Get device from centralized DeviceManager
        device = self.device_manager.get_device(serial)
        if not device:
            error_msg = {
                "type": "video.error",
                "timestamp": 0,
                "data": {"error": f"Device {serial} not found"}
            }
            await websocket.send_json(error_msg)
            ColorPrint.red(f"[VideoStreamService] Device {serial} not found")
            return

        # Verify device is connected
        if not device.is_connected():
            error_msg = {
                "type": "video.error",
                "timestamp": 0,
                "data": {"error": f"Device {serial} not connected. Check scrcpy-server."}
            }
            await websocket.send_json(error_msg)
            ColorPrint.red(f"[VideoStreamService] Device {serial} not connected")
            return

        ColorPrint.green(f"[VideoStreamService] Starting H.264 stream for {serial}")

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
                "fps": device.params.max_fps,
                "bitrate": device.params.bit_rate
            }
        }
        await websocket.send_json(init_message)
        ColorPrint.blue(f"[VideoStreamService] Sent init message: {device_info.resolution.width}x{device_info.resolution.height}")

        # Streaming loop - read frames from device
        loop = asyncio.get_event_loop()
        stats = self.frame_stats[serial]

        while True:
            # Check if paused
            if self.paused.get(serial, False):
                await asyncio.sleep(0.1)
                continue

            # Read video frame (blocking call, run in executor)
            # Returns dict: {'data': bytes, 'pts': int, 'size': int, 'is_config': bool, 'is_keyframe': bool}
            frame = await loop.run_in_executor(None, device.read_video_frame)

            if not frame:
                ColorPrint.yellow(f"[VideoStreamService] Video stream ended for {serial}")
                break

            # Extract frame data
            frame_data = frame['data']
            stats['frame_count'] += 1
            stats['bytes_sent'] += len(frame_data)

            # Pack frame with custom protocol
            payload = self._pack_frame(serial, frame)

            # Send binary frame to WebSocket
            await websocket.send_bytes(payload)

            # Send metadata every 60 frames (~1 second at 60fps)
            if stats['frame_count'] % 60 == 0:
                elapsed = loop.time() - stats['start_time']
                fps = stats['frame_count'] / elapsed if elapsed > 0 else 0

                metadata = {
                    "type": "video.metadata",
                    "timestamp": int(elapsed * 1000),
                    "data": {
                        "fps": round(fps, 2),
                        "frames": stats['frame_count'],
                        "bytes": stats['bytes_sent'],
                        "mbps": round(stats['bytes_sent'] * 8 / elapsed / 1_000_000, 2) if elapsed > 0 else 0
                    }
                }
                await websocket.send_json(metadata)

            # Log progress every 300 frames (~5 seconds)
            if stats['frame_count'] % 300 == 0:
                mb_sent = stats['bytes_sent'] / (1024 * 1024)
                ColorPrint.blue(f"[VideoStreamService] {serial}: {stats['frame_count']} frames, {mb_sent:.2f} MB sent")

        # Stream ended
        ColorPrint.blue(f"[VideoStreamService] Stream ended for {serial}")
        ColorPrint.blue(f"[Stats] Frames: {stats['frame_count']}, Data: {stats['bytes_sent'] / (1024 * 1024):.2f} MB")

        # Cleanup
        if serial in self.paused:
            del self.paused[serial]
        if serial in self.frame_stats:
            del self.frame_stats[serial]

    def _pack_frame(self, serial: str, frame: Dict) -> bytes:
        """
        Pack video frame with custom binary protocol

        Format (from scrcpy_web_test/server.py:375-393):
            [serial_len(1 byte)][serial(N bytes)][pts(8 bytes)][size(4 bytes)][H.264 data]

        Args:
            serial: Device serial number
            frame: Frame dict with keys: data, pts, size, is_config, is_keyframe

        Returns:
            Packed binary frame ready to send via WebSocket
        """
        # Encode serial
        serial_bytes = serial.encode('utf-8')
        if len(serial_bytes) > 255:
            serial_bytes = serial_bytes[:255]

        # Pack PTS with flags
        pts = frame['pts'] & 0x3FFFFFFFFFFFFFFF  # Mask to 62 bits
        if frame.get('is_config'):
            pts |= 0x8000000000000000  # Set bit 63
        if frame.get('is_keyframe'):
            pts |= 0x4000000000000000  # Set bit 62

        # Pack header: serial_len(1) + pts(8) + size(4)
        header = struct.pack(">QI", pts, frame['size'])
        prefix = bytes([len(serial_bytes)]) + serial_bytes + header

        # Combine: prefix + frame data
        payload = prefix + frame['data']

        return payload

    async def set_quality(self, serial: str, quality_config: dict):
        """
        Change video quality settings dynamically

        Note: Quality changes require reconnecting the video stream.
        This method updates device parameters for next connection.

        Args:
            serial: Device serial number
            quality_config: Dict containing max_size, bit_rate, max_fps
        """
        device = self.device_manager.get_device(serial)
        if not device:
            ColorPrint.red(f"[VideoStreamService] Device {serial} not found for quality change")
            return

        # Update device parameters
        if 'max_size' in quality_config:
            device.params.max_size = quality_config['max_size']
            ColorPrint.blue(f"[VideoStreamService] Updated max_size to {quality_config['max_size']}")

        if 'bit_rate' in quality_config:
            device.params.bit_rate = quality_config['bit_rate']
            ColorPrint.blue(f"[VideoStreamService] Updated bit_rate to {quality_config['bit_rate']}")

        if 'max_fps' in quality_config:
            device.params.max_fps = quality_config['max_fps']
            ColorPrint.blue(f"[VideoStreamService] Updated max_fps to {quality_config['max_fps']}")

        ColorPrint.green(f"[VideoStreamService] Quality settings updated for {serial}")
        ColorPrint.yellow(f"[VideoStreamService] Note: Reconnect video stream to apply changes")

    async def pause(self, serial: str):
        """Pause video stream"""
        self.paused[serial] = True
        ColorPrint.yellow(f"[VideoStreamService] Stream paused for {serial}")

    async def resume(self, serial: str):
        """Resume video stream"""
        self.paused[serial] = False
        ColorPrint.green(f"[VideoStreamService] Stream resumed for {serial}")

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
        ColorPrint.blue(f"[VideoStreamService] Stream stopped for {serial}")
