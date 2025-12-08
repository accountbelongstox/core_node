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
from fastapi import WebSocket, WebSocketDisconnect

from pycore import ColorPrint, THREAD_BUS
from pycore.pyutils.device_manager import DeviceManager
from pyapps.matrix.matrix_config import Config
from .video_decoder_service import VideoDecoderService


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

        # Track active WebSocket connections for hot-reload
        # Key: serial, Value: WebSocket instance
        self.active_websockets: Dict[str, WebSocket] = {}

        # Register THREAD_BUS listener for config changes
        THREAD_BUS.on("config.video_stream_mode.changed", self._handle_video_mode_change)
        ColorPrint.blue("[VideoStreamService] Registered config change listener on THREAD_BUS")

    @classmethod
    def instance(cls) -> 'VideoStreamService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _handle_video_mode_change(self, event_data: Dict):
        """
        Handle video stream mode change event from THREAD_BUS

        When video stream mode changes (h264 <-> yuv):
        1. Close all active WebSocket connections
        2. Frontend will automatically reconnect with new mode

        Args:
            event_data: Event data containing:
                - scope: "global" or "device"
                - old_mode: Previous mode ("h264" or "yuv")
                - new_mode: New mode ("h264" or "yuv")
                - device_name: (if scope="device") Device name
                - config: Updated configuration
        """
        scope = event_data.get("scope")
        old_mode = event_data.get("old_mode")
        new_mode = event_data.get("new_mode")

        ColorPrint.yellow("=" * 70)
        ColorPrint.yellow(f"[VideoStreamService] Video mode change detected")
        ColorPrint.yellow(f"  - Scope: {scope}")
        ColorPrint.yellow(f"  - Old mode: {old_mode}")
        ColorPrint.yellow(f"  - New mode: {new_mode}")
        ColorPrint.yellow("=" * 70)

        if scope == "global":
            # Global change - close all WebSocket connections
            ColorPrint.yellow(f"[VideoStreamService] Closing all active WebSocket connections for mode switch...")
            serials_to_close = list(self.active_websockets.keys())

            for serial in serials_to_close:
                websocket = self.active_websockets.get(serial)
                if websocket:
                    try:
                        # Create task to close WebSocket asynchronously
                        asyncio.create_task(self._close_websocket_for_reload(serial, websocket, new_mode))
                    except Exception as e:
                        ColorPrint.red(f"[VideoStreamService] Error closing WebSocket for {serial}: {e}")

        elif scope == "device":
            # Device-specific change - close only that device's WebSocket
            device_name = event_data.get("device_name")
            if device_name and device_name in self.active_websockets:
                websocket = self.active_websockets[device_name]
                ColorPrint.yellow(f"[VideoStreamService] Closing WebSocket for device {device_name}...")
                try:
                    asyncio.create_task(self._close_websocket_for_reload(device_name, websocket, new_mode))
                except Exception as e:
                    ColorPrint.red(f"[VideoStreamService] Error closing WebSocket for {device_name}: {e}")

        ColorPrint.green("[VideoStreamService] Video mode change handled. Frontend will reconnect with new mode.")

    async def _close_websocket_for_reload(self, serial: str, websocket: WebSocket, new_mode: str):
        """
        Close WebSocket connection gracefully and notify client

        Args:
            serial: Device serial number
            websocket: WebSocket to close
            new_mode: New video stream mode
        """
        try:
            # Send notification to client before closing
            await websocket.send_json({
                "type": "video.mode_changed",
                "data": {
                    "serial": serial,
                    "new_mode": new_mode,
                    "message": f"Video stream mode changed to {new_mode}. Reconnecting..."
                }
            })

            # Close WebSocket with reason code
            await websocket.close(code=1012, reason=f"Video mode changed to {new_mode}")

            # Remove from active connections
            if serial in self.active_websockets:
                del self.active_websockets[serial]

            ColorPrint.green(f"[VideoStreamService] ✓ Closed WebSocket for {serial}, client will reconnect")

        except Exception as e:
            ColorPrint.red(f"[VideoStreamService] Error during graceful close for {serial}: {e}")
            # Force remove from tracking
            if serial in self.active_websockets:
                del self.active_websockets[serial]

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
        ColorPrint.blue("=" * 70)
        ColorPrint.blue(f"[VideoStreamService] H.264 Stream Request")
        ColorPrint.blue(f"  - Serial: {serial}")
        ColorPrint.blue(f"  - Protocol: scrcpy_web_test compatible")
        ColorPrint.blue("=" * 70)

        # Track active WebSocket for hot-reload
        self.active_websockets[serial] = websocket
        ColorPrint.blue(f"[VideoStreamService] Tracking WebSocket for {serial} (active: {len(self.active_websockets)})")

        try:
            # Mark as not paused
            self.paused[serial] = False

            # Initialize frame stats
            self.frame_stats[serial] = {
                'frame_count': 0,
                'bytes_sent': 0,
                'start_time': asyncio.get_event_loop().time()
            }

            # Get device from centralized DeviceManager
            ColorPrint.blue(f"[VideoStreamService] Step 1: Getting device {serial}...")
            device = self.device_manager.get_device(serial)
            if not device:
                error_msg = {
                    "type": "video.error",
                    "timestamp": 0,
                    "data": {"error": f"Device {serial} not found"}
                }
                await websocket.send_json(error_msg)
                ColorPrint.red(f"[VideoStreamService] ✗ Device {serial} not found in DeviceManager")
                return

            ColorPrint.green(f"[VideoStreamService] ✓ Device {serial} found")

            # Verify device is connected
            ColorPrint.blue(f"[VideoStreamService] Step 2: Verifying device connection...")
            if not device.is_connected():
                error_msg = {
                    "type": "video.error",
                    "timestamp": 0,
                    "data": {"error": f"Device {serial} not connected. Check scrcpy-server."}
                }
                await websocket.send_json(error_msg)
                ColorPrint.red(f"[VideoStreamService] ✗ Device {serial} not connected")
                ColorPrint.red(f"  - Video socket: {device._video_socket}")
                ColorPrint.red(f"  - Control socket: {device._control_socket}")
                return

            ColorPrint.green(f"[VideoStreamService] ✓ Device {serial} is connected")
            ColorPrint.blue(f"  - Video socket: {device._video_socket}")

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
            ColorPrint.blue(f"[VideoStreamService] Step 4: Starting H.264 streaming loop...")
            ColorPrint.green(f"[VideoStreamService] ✓ H.264 streaming loop started")

            loop = asyncio.get_event_loop()
            stats = self.frame_stats[serial]
            first_frame = True

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

                if first_frame:
                    ColorPrint.green(f"[VideoStreamService] ✓ First H.264 frame received:")
                    ColorPrint.green(f"  - Size: {len(frame['data'])} bytes")
                    ColorPrint.green(f"  - PTS: {frame['pts']}")
                    ColorPrint.green(f"  - Is config: {frame.get('is_config', False)}")
                    ColorPrint.green(f"  - Is keyframe: {frame.get('is_keyframe', False)}")

                # Extract frame data
                frame_data = frame['data']
                stats['frame_count'] += 1
                stats['bytes_sent'] += len(frame_data)

                # Pack frame with custom protocol (scrcpy_web_test compatible)
                payload = self._pack_frame(serial, frame)

                if first_frame:
                    ColorPrint.green(f"[VideoStreamService] ✓ First frame packed:")
                    ColorPrint.green(f"  - Total payload size: {len(payload)} bytes")
                    ColorPrint.green(f"  - Protocol: [serial_len][serial][pts][size][H.264 data]")

                # Send binary frame to WebSocket
                await websocket.send_bytes(payload)

                if first_frame:
                    ColorPrint.green(f"[VideoStreamService] ✓ First H.264 frame sent to WebSocket")
                    first_frame = False

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

        finally:
                # Cleanup: Remove from active WebSockets
                    if serial in self.active_websockets:
                    del self.active_websockets[serial]
                    ColorPrint.blue(f"[VideoStreamService] Removed {serial} from active WebSockets (remaining: {len(self.active_websockets)})")

            # Cleanup frame stats
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

    # ========== YUV Streaming Methods ==========

    async def stream_yuv_to_websocket(
        self,
        serial: str,
        websocket: WebSocket,
        hwaccel: Optional[str] = None
    ):
        """
        Stream YUV420P video to WebSocket (WebGL-optimized)

        基于 QtScrcpy OpenGL 实现的 YUV 推流方案
        - 后端 FFmpeg 解码 H.264 → YUV420P
        - WebSocket 推送 YUV 数据
        - 前端 WebGL 着色器渲染（GPU 加速）

        Flow:
            1. 读取 H.264 帧
            2. FFmpeg 解码到 YUV420P
            3. 打包 YUV 数据
            4. WebSocket 发送

        Args:
            serial: 设备序列号
            websocket: WebSocket 连接
            hwaccel: 硬件加速类型 ('cuda', 'qsv', 'dxva2', 'vaapi', None)
        """
        ColorPrint.blue("=" * 70)
        ColorPrint.blue(f"[VideoStreamService] YUV Stream Request")
        ColorPrint.blue(f"  - Serial: {serial}")
        ColorPrint.blue(f"  - Hardware Acceleration: {hwaccel or 'software'}")
        ColorPrint.blue("=" * 70)

        # Track active WebSocket for hot-reload
        self.active_websockets[serial] = websocket
        ColorPrint.blue(f"[VideoStreamService] Tracking WebSocket for {serial} (active: {len(self.active_websockets)})")

        try:
            # Mark as not paused
            self.paused[serial] = False

            # Initialize frame stats
            self.frame_stats[serial] = {
                'frame_count': 0,
                'bytes_sent': 0,
                'start_time': asyncio.get_event_loop().time()
            }

        # Get device
        ColorPrint.blue(f"[VideoStreamService] Step 1: Getting device {serial}...")
        device = self.device_manager.get_device(serial)
        if not device:
            error_msg = {
                "type": "video.error",
                "timestamp": 0,
                "data": {"error": f"Device {serial} not found"}
            }
            await websocket.send_json(error_msg)
            ColorPrint.red(f"[VideoStreamService] ✗ Device {serial} not found in DeviceManager")
            return

        ColorPrint.green(f"[VideoStreamService] ✓ Device {serial} found")

        # Verify device is connected
        ColorPrint.blue(f"[VideoStreamService] Step 2: Verifying device connection...")
        if not device.is_connected():
            error_msg = {
                "type": "video.error",
                "timestamp": 0,
                "data": {"error": f"Device {serial} not connected"}
            }
            await websocket.send_json(error_msg)
            ColorPrint.red(f"[VideoStreamService] ✗ Device {serial} not connected")
            ColorPrint.red(f"  - Video socket: {device._video_socket}")
            ColorPrint.red(f"  - Control socket: {device._control_socket}")
            return

        ColorPrint.green(f"[VideoStreamService] ✓ Device {serial} is connected")
        ColorPrint.blue(f"  - Video socket: {device._video_socket}")

        # Get device info
        ColorPrint.blue(f"[VideoStreamService] Step 3: Getting device info...")
        device_info = device.get_device_info()
        ColorPrint.green(f"[VideoStreamService] ✓ Device info:")
        ColorPrint.green(f"  - Resolution: {device_info.resolution.width}x{device_info.resolution.height}")
        ColorPrint.green(f"  - Max FPS: {device.params.max_fps}")
        ColorPrint.green(f"  - Bit Rate: {device.params.bit_rate}")

        # Send video init message
        ColorPrint.blue(f"[VideoStreamService] Step 4: Sending init message to WebSocket...")
        init_message = {
            "type": "video.init",
            "timestamp": 0,
            "data": {
                "serial": serial,
                "codec": "yuv420p",
                "format": "yuv",
                "width": device_info.resolution.width,
                "height": device_info.resolution.height,
                "fps": device.params.max_fps,
                "hwaccel": hwaccel or "software"
            }
        }
        await websocket.send_json(init_message)
        ColorPrint.green(f"[VideoStreamService] ✓ Sent YUV init message")

        # Create decoder
        ColorPrint.blue(f"[VideoStreamService] Step 5: Creating FFmpeg decoder...")
        decoder = VideoDecoderService.instance()
        try:
            decoder.create_decoder(serial, hwaccel=hwaccel)
            ColorPrint.green(f"[VideoStreamService] ✓ FFmpeg decoder created successfully")
        except Exception as e:
            ColorPrint.red(f"[VideoStreamService] ✗ Failed to create decoder: {e}")
            import traceback
            traceback.print_exc()
            error_msg = {
                "type": "video.error",
                "timestamp": 0,
                "data": {"error": f"Failed to create FFmpeg decoder: {str(e)}"}
            }
            await websocket.send_json(error_msg)
            return

        # Streaming loop
        ColorPrint.blue(f"[VideoStreamService] Step 6: Starting video streaming loop...")
        ColorPrint.green(f"[VideoStreamService] ✓ YUV streaming loop started")

        loop = asyncio.get_event_loop()
        stats = self.frame_stats[serial]

        try:
            first_frame = True
            while True:
                # Check if paused
                if self.paused.get(serial, False):
                    await asyncio.sleep(0.1)
                    continue

                # Read H.264 frame
                h264_frame = await loop.run_in_executor(None, device.read_video_frame)

                if not h264_frame:
                    ColorPrint.yellow(f"[VideoStreamService] YUV stream ended for {serial}")
                    break

                if first_frame:
                    ColorPrint.green(f"[VideoStreamService] ✓ First H.264 frame received:")
                    ColorPrint.green(f"  - Size: {len(h264_frame['data'])} bytes")
                    ColorPrint.green(f"  - PTS: {h264_frame['pts']}")
                    ColorPrint.green(f"  - Is config: {h264_frame.get('is_config', False)}")
                    ColorPrint.green(f"  - Is keyframe: {h264_frame.get('is_keyframe', False)}")

                # Decode to YUV
                yuv_frame = await loop.run_in_executor(
                    None,
                    decoder.decode_frame,
                    serial,
                    h264_frame['data']
                )

                if not yuv_frame:
                    # Decode failed, skip frame
                    if first_frame:
                        ColorPrint.yellow(f"[VideoStreamService] ⚠ First frame decode failed, skipping...")
                    continue

                if first_frame:
                    ColorPrint.green(f"[VideoStreamService] ✓ First frame decoded to YUV:")
                    ColorPrint.green(f"  - Resolution: {yuv_frame['width']}x{yuv_frame['height']}")
                    ColorPrint.green(f"  - Y plane: {len(yuv_frame['y_plane'])} bytes")
                    ColorPrint.green(f"  - U plane: {len(yuv_frame['u_plane'])} bytes")
                    ColorPrint.green(f"  - V plane: {len(yuv_frame['v_plane'])} bytes")
                    ColorPrint.green(f"  - Format: {yuv_frame['format']}")

                stats['frame_count'] += 1
                yuv_size = len(yuv_frame['y_plane']) + len(yuv_frame['u_plane']) + len(yuv_frame['v_plane'])
                stats['bytes_sent'] += yuv_size

                # Pack YUV frame
                payload = self._pack_yuv_frame(serial, yuv_frame)

                if first_frame:
                    serial_bytes_len = len(serial.encode('utf-8'))
                    ColorPrint.green(f"[VideoStreamService] ✓ First frame packed:")
                    ColorPrint.green(f"  - Total payload size: {len(payload)} bytes")
                    ColorPrint.green(f"  - Breakdown:")
                    ColorPrint.green(f"    • serial_len: 1 byte")
                    ColorPrint.green(f"    • serial: {serial_bytes_len} bytes")
                    ColorPrint.green(f"    • header (pts+dims+sizes): 24 bytes")
                    ColorPrint.green(f"    • Y data: {len(yuv_frame['y_plane'])} bytes")
                    ColorPrint.green(f"    • U data: {len(yuv_frame['u_plane'])} bytes")
                    ColorPrint.green(f"    • V data: {len(yuv_frame['v_plane'])} bytes")
                    ColorPrint.green(f"  - Expected total: {1 + serial_bytes_len + 24 + yuv_size} bytes")

                # Send to WebSocket
                await websocket.send_bytes(payload)

                if first_frame:
                    ColorPrint.green(f"[VideoStreamService] ✓ First frame sent to WebSocket")
                    first_frame = False

                # Send metadata every 60 frames
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
                            "mbps": round(stats['bytes_sent'] * 8 / elapsed / 1_000_000, 2) if elapsed > 0 else 0,
                            "format": "yuv420p"
                        }
                    }
                    await websocket.send_json(metadata)

                # Log progress every 300 frames
                if stats['frame_count'] % 300 == 0:
                    mb_sent = stats['bytes_sent'] / (1024 * 1024)
                    ColorPrint.blue(f"[VideoStreamService] YUV {serial}: {stats['frame_count']} frames, {mb_sent:.2f} MB")

        finally:
            # Cleanup decoder
            decoder.close_decoder(serial)

            # Remove from active WebSockets
            if serial in self.active_websockets:
                del self.active_websockets[serial]
                ColorPrint.blue(f"[VideoStreamService] Removed {serial} from active WebSockets (remaining: {len(self.active_websockets)})")

            # Stream ended
            ColorPrint.blue(f"[VideoStreamService] YUV stream ended for {serial}")
            ColorPrint.blue(f"[Stats] Frames: {stats['frame_count']}, Data: {stats['bytes_sent'] / (1024 * 1024):.2f} MB")

            # Cleanup
            if serial in self.paused:
                del self.paused[serial]
            if serial in self.frame_stats:
                del self.frame_stats[serial]

    def _pack_yuv_frame(self, serial: str, yuv_frame: Dict) -> bytes:
        """
        Pack YUV frame with custom binary protocol

        Protocol Format:
            [serial_len (1 byte)]
            [serial (N bytes)]
            [pts (8 bytes)]
            [width (2 bytes)]
            [height (2 bytes)]
            [y_size (4 bytes)]
            [u_size (4 bytes)]
            [v_size (4 bytes)]
            [Y plane data]
            [U plane data]
            [V plane data]

        Args:
            serial: Device serial number
            yuv_frame: YUV frame dict from decoder

        Returns:
            Packed binary frame
        """
        # Encode serial
        serial_bytes = serial.encode('utf-8')
        if len(serial_bytes) > 255:
            serial_bytes = serial_bytes[:255]

        # Pack header (WITHOUT serial_len, it goes before serial)
        # Format: pts(8) + width(2) + height(2) + y_size(4) + u_size(4) + v_size(4)
        header = struct.pack(
            ">QHHiii",
            yuv_frame['pts'],                 # pts (8 bytes, unsigned)
            yuv_frame['width'],               # width (2 bytes, unsigned)
            yuv_frame['height'],              # height (2 bytes, unsigned)
            len(yuv_frame['y_plane']),        # y_size (4 bytes, signed)
            len(yuv_frame['u_plane']),        # u_size (4 bytes, signed)
            len(yuv_frame['v_plane'])         # v_size (4 bytes, signed)
        )

        # CRITICAL: serial_len must come BEFORE serial, not inside header
        # Combine all parts in correct order
        payload = (
            bytes([len(serial_bytes)]) +      # serial_len (1 byte) - MUST BE FIRST
            serial_bytes +                     # serial (N bytes)
            header +                           # pts + dimensions + sizes
            yuv_frame['y_plane'] +
            yuv_frame['u_plane'] +
            yuv_frame['v_plane']
        )

        return payload
