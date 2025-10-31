"""Video streaming service using pycore VideoStreamHandler"""

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

import asyncio
from typing import Optional, Dict
from pathlib import Path
from fastapi import WebSocket

from pycore.pyutils.device_manager import DeviceManager
from pycore.pyutils.stream import VideoStreamHandler
from poly_apps.pyMatrix.config import Config


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
        try:
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
                return

            # Create and start video stream handler
            handler = VideoStreamHandler(device)
            self.handlers[serial] = handler

            # Start handler (parses H.264 config)
            await handler.start()

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

            async for fmp4_chunk in handler.stream_fmp4():
                # Check if paused
                if self.paused.get(serial, False):
                    await asyncio.sleep(0.1)
                    continue

                # Send fMP4 media segment
                await websocket.send_bytes(fmp4_chunk)
                frame_count += 1

                # Send metadata every 60 frames (~1 second)
                if frame_count % 60 == 0:
                    elapsed = asyncio.get_event_loop().time() - start_time
                    metadata = {
                        "type": "video.metadata",
                        "timestamp": int(elapsed * 1000),
                        "data": {
                            "fps": frame_count / elapsed if elapsed > 0 else 0,
                            "droppedFrames": 0,
                            "latency": 100  # ms (TODO: measure actual latency)
                        }
                    }
                    await websocket.send_json(metadata)

            print(f"[VideoStreamService] Stream ended for {serial}")

        except asyncio.CancelledError:
            print(f"[VideoStreamService] Stream cancelled for {serial}")
        except Exception as e:
            print(f"[VideoStreamService] Video streaming error for {serial}: {e}")
            import traceback
            traceback.print_exc()

            # Send error to client
            error_msg = {
                "type": "video.error",
                "timestamp": 0,
                "data": {"error": str(e)}
            }
            try:
                await websocket.send_json(error_msg)
            except:
                pass

        finally:
            # Cleanup
            if handler:
                await handler.stop()
            if serial in self.handlers:
                del self.handlers[serial]
            if serial in self.paused:
                del self.paused[serial]

    async def set_quality(self, serial: str, quality_config: dict):
        """Change video quality settings"""
        # TODO: Send quality change to scrcpy-server
        print(f"Set quality for {serial}: {quality_config}")

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
