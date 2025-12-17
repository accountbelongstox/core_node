"""Video streaming service using direct H.264 frame reading from ScrcpyDevice"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import asyncio
import struct
import subprocess
import time
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

        # H.264 streaming (direct H.264 transmission)
        # Background streaming tasks (one per device)
        self.active_streams: Dict[str, asyncio.Task] = {}
        self.stop_events: Dict[str, asyncio.Event] = {}

        # WebSocket client management (multiple clients per device)
        self.stream_clients: Dict[str, Set[WebSocket]] = {}

        # Client pause state management
        self.paused_clients: Dict[str, Set[WebSocket]] = {}

        # Config frame cache (one per device) - Critical for H.264 decoding
        # When new clients join, they need SPS/PPS config frame to start decoding
        self.cached_config_frames: Dict[str, Dict] = {}

        # YUV streaming (decoded YUV transmission) - Unified architecture
        # Background streaming tasks for YUV (one per device)
        self.yuv_active_streams: Dict[str, asyncio.Task] = {}
        self.yuv_stop_events: Dict[str, asyncio.Event] = {}

        # YUV client management (multiple clients per device)
        self.yuv_stream_clients: Dict[str, Set[WebSocket]] = {}

        # YUV paused clients
        self.yuv_paused_clients: Dict[str, Set[WebSocket]] = {}

        # Hardware acceleration settings per device
        self.yuv_hwaccel: Dict[str, Optional[str]] = {}

        # Device initialization state (prevents concurrent device creation)
        # True = device is being initialized by another client
        # False/Missing = device is ready or not being initialized
        self.device_initializing: Dict[str, bool] = {}

        # Cleanup state (prevents concurrent cleanup)
        # True = cleanup is in progress
        # False/Missing = no cleanup in progress
        self.cleanup_in_progress: Dict[str, bool] = {}

        # Client keyframe synchronization state (智能丢帧优化)
        # Tracks which clients have received a keyframe and are ready for P-frames
        # Format: {serial: {websocket: bool}}
        self.client_keyframe_received: Dict[str, Dict[WebSocket, bool]] = {}

        # Video stream health service integration
        from pyapps.matrix.services.video_stream_health_service import get_video_stream_health_service
        self.health_service = get_video_stream_health_service()

    @classmethod
    def instance(cls) -> 'VideoStreamService':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def start_stream(self, serial: str, websocket: WebSocket) -> bool:
        """
        Start streaming for a device (scrcpy_web_test pattern)

        Uses config frame cache + state flag to handle concurrent connections.
        No locks needed - simpler and faster!

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

        # Register device with health service
        self.health_service.mark_device_active(serial)

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

        # Check if another client is initializing this device
        # Wait up to 3 seconds for initialization to complete
        for retry in range(6):
            if self.device_initializing.get(serial, False):
                ColorPrint.yellow(f"[VideoStreamService] Device {serial} is being initialized, waiting... (retry {retry + 1}/6)")
                await asyncio.sleep(0.5)

                # After waiting, check if stream is now active
                if serial in self.active_streams:
                    ColorPrint.green(f"[VideoStreamService] Stream now active for {serial}, sending cached config frame")
                    await websocket.send_json({"type": "stream_started", "serial": serial})

                    # Send cached config frame
                    if serial in self.cached_config_frames:
                        config_frame = self.cached_config_frames[serial]
                        payload = self._pack_frame(serial, config_frame)
                        await websocket.send_bytes(payload)

                    return True
            else:
                break

        # If still initializing after 3 seconds, return error
        if self.device_initializing.get(serial, False):
            ColorPrint.red(f"[VideoStreamService] Timeout waiting for device {serial} initialization")
            if serial in self.stream_clients:
                self.stream_clients[serial].discard(websocket)
                if len(self.stream_clients[serial]) == 0:
                    del self.stream_clients[serial]
            return False

        # Mark device as initializing
        self.device_initializing[serial] = True

        try:
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
                control=False  # Temporarily disabled - testing if control socket causes connection issues
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

        finally:
            # Always clear initializing flag when done (success or error)
            if serial in self.device_initializing:
                self.device_initializing[serial] = False
                ColorPrint.blue(f"[VideoStreamService] Cleared initializing flag for {serial}")

    async def stop_stream(self, serial: str, websocket: WebSocket):
        """Stop streaming for a device or detach client"""
        ColorPrint.blue(f"[VideoStreamService] stop_stream called for {serial}")

        # Remove client from subscription list
        if serial in self.stream_clients:
            self.stream_clients[serial].discard(websocket)
            ColorPrint.yellow(f"[VideoStreamService] Client unsubscribed from {serial}, remaining: {len(self.stream_clients[serial])}")

            # Clean up keyframe tracking for this client
            if serial in self.client_keyframe_received and websocket in self.client_keyframe_received[serial]:
                del self.client_keyframe_received[serial][websocket]

            # If no more clients, stop streaming task
            if len(self.stream_clients[serial]) == 0:
                ColorPrint.blue(f"[VideoStreamService] No more clients for {serial}, stopping task")
                del self.stream_clients[serial]

                # Clean up all keyframe tracking for this serial
                if serial in self.client_keyframe_received:
                    del self.client_keyframe_received[serial]

                # Mark device as inactive in health service
                self.health_service.mark_device_inactive(serial)

                if serial in self.stop_events:
                    self.stop_events[serial].set()
                    del self.stop_events[serial]

                if serial in self.active_streams:
                    del self.active_streams[serial]

        # Clean up paused state
        if serial in self.paused_clients:
            self.paused_clients[serial].discard(websocket)
            if len(self.paused_clients[serial]) == 0:
                del self.paused_clients[serial]

    async def force_stop_stream(self, serial: str, reason: str = "Health check failed"):
        """
        Force stop streaming for a device (called by HealthService)

        This method forcibly stops the streaming task and cleans up all clients
        when health check determines the device is unrecoverable.

        Args:
            serial: Device serial number
            reason: Reason for force stop
        """
        ColorPrint.red(f"[VideoStreamService] force_stop_stream called for {serial}: {reason}")

        # Stop streaming task
        if serial in self.stop_events:
            self.stop_events[serial].set()
            ColorPrint.blue(f"[VideoStreamService] Stop event set for {serial}")

        # Notify all connected clients before cleanup
        if serial in self.stream_clients:
            error_message = {
                "type": "stream.error",
                "data": {
                    "serial": serial,
                    "error": reason,
                    "fatal": True
                }
            }

            clients = list(self.stream_clients[serial])
            ColorPrint.yellow(f"[VideoStreamService] Notifying {len(clients)} clients about stream termination")

            for ws in clients:
                try:
                    await ws.send_json(error_message)
                except Exception as e:
                    ColorPrint.yellow(f"[VideoStreamService] Failed to notify client: {e}")

        # Clean up all state
        if serial in self.stream_clients:
            del self.stream_clients[serial]
            ColorPrint.blue(f"[VideoStreamService] Removed all clients for {serial}")

        if serial in self.paused_clients:
            del self.paused_clients[serial]

        if serial in self.stop_events:
            del self.stop_events[serial]

        if serial in self.active_streams:
            task = self.active_streams[serial]
            if not task.done():
                task.cancel()
                ColorPrint.yellow(f"[VideoStreamService] Cancelled streaming task for {serial}")
            del self.active_streams[serial]

        if serial in self.cached_config_frames:
            del self.cached_config_frames[serial]

        # Mark device as inactive in health service
        self.health_service.mark_device_inactive(serial)

        ColorPrint.green(f"[VideoStreamService] ✓ Force stop completed for {serial}")

    # ========== YUV STREAMING (UNIFIED ARCHITECTURE) ==========

    async def start_yuv_stream(self, serial: str, websocket: WebSocket, hwaccel: Optional[str] = None) -> bool:
        """
        Start YUV streaming for a device (unified shared architecture)

        Uses config frame cache + state flag to handle concurrent connections.
        No locks needed - simpler and faster!

        Args:
            serial: Device serial number
            websocket: WebSocket client to subscribe
            hwaccel: Hardware acceleration type (cuda/qsv/dxva2/vaapi/auto)

        Returns:
            True if successful
        """
        ColorPrint.blue(f"[VideoStreamService] start_yuv_stream called for {serial} (hwaccel={hwaccel})")

        # Add client to YUV subscription list
        if serial not in self.yuv_stream_clients:
            self.yuv_stream_clients[serial] = set()
        self.yuv_stream_clients[serial].add(websocket)
        ColorPrint.green(f"[VideoStreamService] Client subscribed to YUV {serial}, total clients: {len(self.yuv_stream_clients[serial])}")

        # Store hwaccel setting for this device
        if hwaccel:
            self.yuv_hwaccel[serial] = hwaccel

        # Register device with health service
        self.health_service.mark_device_active(serial)

        # If YUV streaming task already exists, just attach client and send init message
        if serial in self.yuv_active_streams:
            ColorPrint.yellow(f"[VideoStreamService] YUV stream already active for {serial}, attached client")
            await websocket.send_json({"type": "stream_started", "serial": serial})
            return True

        # Check if another client is initializing this device
        # Wait up to 3 seconds (6 retries * 500ms) for initialization to complete
        for retry in range(6):
            if self.device_initializing.get(serial, False):
                ColorPrint.yellow(f"[VideoStreamService] Device {serial} is being initialized by another client, waiting... (retry {retry + 1}/6)")
                await asyncio.sleep(0.5)

                # After waiting, check if stream is now active
                if serial in self.yuv_active_streams:
                    ColorPrint.green(f"[VideoStreamService] YUV stream now active for {serial}, attached client")
                    await websocket.send_json({"type": "stream_started", "serial": serial})
                    return True
            else:
                # No one is initializing, break and proceed
                break

        # If still initializing after 3 seconds, return error
        if self.device_initializing.get(serial, False):
            ColorPrint.red(f"[VideoStreamService] Timeout waiting for device {serial} initialization")
            if serial in self.yuv_stream_clients:
                self.yuv_stream_clients[serial].discard(websocket)
                if len(self.yuv_stream_clients[serial]) == 0:
                    del self.yuv_stream_clients[serial]
            return False

        # Mark device as initializing (prevent concurrent initialization)
        self.device_initializing[serial] = True

        try:
            # Get or create device
            device = self.device_manager.get_device(serial)
            if not device:
                ColorPrint.yellow(f"[VideoStreamService] Device {serial} not in DeviceManager, creating ScrcpyDevice...")

                # Create new device instance directly (like QtScrcpy does)
                try:
                    # Import ScrcpyDevice
                    from pycore.pyutils.device.scrcpy_device import ScrcpyDevice

                    # Create temporary params for device instance
                    # Will be replaced with actual params when starting server
                    temp_params = ServerParams(
                        max_size=720,
                        bit_rate=8000000,
                        max_fps=60,
                        codec=VideoCodec.H264,
                        control=True  # Re-enabled after fixing control socket for FORWARD mode
                    )
                    device = ScrcpyDevice(serial, temp_params, self.adb_path)
                    ColorPrint.green(f"[VideoStreamService] ✓ Created ScrcpyDevice for {serial}")
                except Exception as e:
                    ColorPrint.red(f"[VideoStreamService] Failed to create device: {e}")
                    import traceback
                    traceback.print_exc()
                    # Cleanup client registration
                    if serial in self.yuv_stream_clients:
                        self.yuv_stream_clients[serial].discard(websocket)
                        if len(self.yuv_stream_clients[serial]) == 0:
                            del self.yuv_stream_clients[serial]
                    return False

            # Connect device if not connected
            if not device.is_connected():
                ColorPrint.yellow(f"[VideoStreamService] Device {serial} not connected, starting scrcpy-server...")

                # Push scrcpy-server.jar to device first
                ColorPrint.blue(f"[VideoStreamService] Ensuring scrcpy-server.jar on device {serial}...")
                scrcpy_jar = Path(self.scrcpy_server_jar)
                if not scrcpy_jar.exists():
                    ColorPrint.red(f"[VideoStreamService] ✗ Missing scrcpy-server.jar at {scrcpy_jar}")
                    if serial in self.yuv_stream_clients:
                        self.yuv_stream_clients[serial].discard(websocket)
                        if len(self.yuv_stream_clients[serial]) == 0:
                            del self.yuv_stream_clients[serial]
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
                    if serial in self.yuv_stream_clients:
                        self.yuv_stream_clients[serial].discard(websocket)
                        if len(self.yuv_stream_clients[serial]) == 0:
                            del self.yuv_stream_clients[serial]
                    return False

                ColorPrint.green(f"[VideoStreamService] ✓ scrcpy-server.jar pushed to {serial}")

                # Get config from ConfigService
                config_service = ConfigService.instance()
                global_config = await config_service.get_global()

                # Create ServerParams and update device params
                params = ServerParams(
                    max_size=global_config.get('max_size', 720),
                    bit_rate=global_config.get('bit_rate', 8000000),
                    max_fps=global_config.get('max_fps', 60),
                    codec=VideoCodec.H264,  # Always use H.264 for decoding
                    control=global_config.get('control', True),
                    locked_video_orientation=global_config.get('locked_video_orientation', -1)
                )

                # Update device params (ScrcpyDevice uses self.params in start_server)
                device.params = params

                # Start scrcpy server (no parameters - uses self.params)
                try:
                    await asyncio.get_event_loop().run_in_executor(
                        None,
                        device.start_server
                    )
                    ColorPrint.green(f"[VideoStreamService] ✓ ScrcpyDevice started for {serial}")
                except Exception as e:
                    ColorPrint.red(f"[VideoStreamService] Failed to start device: {e}")
                    import traceback
                    traceback.print_exc()
                    # Cleanup client registration on error
                    if serial in self.yuv_stream_clients:
                        self.yuv_stream_clients[serial].discard(websocket)
                        if len(self.yuv_stream_clients[serial]) == 0:
                            del self.yuv_stream_clients[serial]
                    return False

            ColorPrint.green(f"[VideoStreamService] Device {serial} ready, starting background YUV streaming task")

            # Create stop event
            stop_event = asyncio.Event()
            self.yuv_stop_events[serial] = stop_event

            # Create background YUV streaming task
            task = asyncio.create_task(self._stream_yuv_loop(serial, device, stop_event, hwaccel))
            self.yuv_active_streams[serial] = task

            ColorPrint.green(f"[VideoStreamService] Background YUV streaming task created for {serial}")
            return True

        finally:
            # Always clear initializing flag when done (success or error)
            if serial in self.device_initializing:
                self.device_initializing[serial] = False
                ColorPrint.blue(f"[VideoStreamService] Cleared initializing flag for {serial}")

    async def stop_yuv_stream(self, serial: str, websocket: WebSocket):
        """Stop YUV streaming for a device or detach client"""
        ColorPrint.blue(f"[VideoStreamService] stop_yuv_stream called for {serial}")

        # Remove client from subscription list
        if serial in self.yuv_stream_clients:
            self.yuv_stream_clients[serial].discard(websocket)
            ColorPrint.yellow(f"[VideoStreamService] Client unsubscribed from YUV {serial}, remaining: {len(self.yuv_stream_clients[serial])}")

            # Clean up keyframe tracking for this client
            if serial in self.client_keyframe_received and websocket in self.client_keyframe_received[serial]:
                del self.client_keyframe_received[serial][websocket]

            # If no more clients, stop streaming task
            if len(self.yuv_stream_clients[serial]) == 0:
                ColorPrint.blue(f"[VideoStreamService] No more YUV clients for {serial}, stopping task")
                del self.yuv_stream_clients[serial]

                # Clean up all keyframe tracking for this serial
                if serial in self.client_keyframe_received:
                    del self.client_keyframe_received[serial]

                # Mark device as inactive in health service
                self.health_service.mark_device_inactive(serial)

                if serial in self.yuv_stop_events:
                    self.yuv_stop_events[serial].set()
                    del self.yuv_stop_events[serial]

                if serial in self.yuv_active_streams:
                    del self.yuv_active_streams[serial]

                # Clean up hwaccel setting
                if serial in self.yuv_hwaccel:
                    del self.yuv_hwaccel[serial]

        # Clean up paused state
        if serial in self.yuv_paused_clients:
            self.yuv_paused_clients[serial].discard(websocket)
            if len(self.yuv_paused_clients[serial]) == 0:
                del self.yuv_paused_clients[serial]

    async def pause_yuv_stream(self, serial: str, websocket: WebSocket):
        """Pause YUV stream for specific client"""
        ColorPrint.yellow(f"[VideoStreamService] Pausing YUV stream for client on {serial}")

        if serial not in self.yuv_paused_clients:
            self.yuv_paused_clients[serial] = set()
        self.yuv_paused_clients[serial].add(websocket)

        # No need to flush decoder - it continues running for other clients
        # Decoder is shared across all clients for this device

        await websocket.send_json({"type": "stream.paused", "serial": serial})

    async def resume_yuv_stream(self, serial: str, websocket: WebSocket):
        """Resume YUV stream for specific client"""
        ColorPrint.yellow(f"[VideoStreamService] Resuming YUV stream for client on {serial}")

        if serial in self.yuv_paused_clients:
            self.yuv_paused_clients[serial].discard(websocket)
            if len(self.yuv_paused_clients[serial]) == 0:
                del self.yuv_paused_clients[serial]

        await websocket.send_json({"type": "stream.resumed", "serial": serial})

    async def pause_stream(self, serial: str, websocket: WebSocket):
        """
        Pause video stream for specific client
        Client stays connected but doesn't receive frames
        """
        ColorPrint.yellow(f"[VideoStreamService] Pausing stream for client on {serial}")

        # Add to paused set
        if serial not in self.paused_clients:
            self.paused_clients[serial] = set()
        self.paused_clients[serial].add(websocket)

        ColorPrint.green(f"[VideoStreamService] Stream paused for client on {serial}, total paused: {len(self.paused_clients[serial])}")

        # Send pause acknowledgment
        await websocket.send_json({"type": "stream.paused", "serial": serial})

    async def resume_stream(self, serial: str, websocket: WebSocket):
        """
        Resume video stream for specific client
        Client will start receiving frames again
        """
        ColorPrint.yellow(f"[VideoStreamService] Resuming stream for client on {serial}")

        # Remove from paused set
        if serial in self.paused_clients:
            self.paused_clients[serial].discard(websocket)
            if len(self.paused_clients[serial]) == 0:
                del self.paused_clients[serial]

        ColorPrint.green(f"[VideoStreamService] Stream resumed for client on {serial}")

        # No need to flush decoder - it continues running for other clients
        # Decoder is shared across all clients for this device
        # Config frame will be sent below to ensure proper H.264 decoding

        # Send resume acknowledgment
        await websocket.send_json({"type": "stream.resumed", "serial": serial})

        # Send cached config frame immediately if available (for H.264 mode)
        if serial in self.cached_config_frames:
            config_frame = self.cached_config_frames[serial]
            ColorPrint.green(f"[VideoStreamService] Sending cached config frame to resumed client for {serial}")
            payload = self._pack_frame(serial, config_frame)
            await websocket.send_bytes(payload)

    async def send_cached_config_frame(self, serial: str, websocket: WebSocket):
        """
        Send cached config frame to specific client (for fast reconnection)

        This allows clients to immediately restore their decoder configuration
        after reconnection without waiting for the next natural config frame.
        """
        ColorPrint.blue(f"[VideoStreamService] Client requested config frame for {serial}")

        if serial in self.cached_config_frames:
            config_frame = self.cached_config_frames[serial]
            payload = self._pack_frame(serial, config_frame)
            await websocket.send_bytes(payload)
            ColorPrint.green(f"[VideoStreamService] ✓ Sent cached config frame to {websocket.client}")
            await websocket.send_json({
                "type": "config.sent",
                "message": "Config frame sent from cache"
            })
        else:
            ColorPrint.yellow(f"[VideoStreamService] No cached config frame for {serial}")
            await websocket.send_json({
                "type": "config.not_available",
                "message": "Config frame not cached yet, please wait for next config frame"
            })

    def mark_client_needs_keyframe(self, serial: str, websocket: WebSocket):
        """
        Mark client as needing keyframe synchronization

        When a client reconnects or explicitly requests a keyframe,
        we mark it as needing synchronization. The next keyframe will
        be guaranteed to be sent to this client (via smart dropping logic).

        This is handled automatically by the smart dropping logic in _broadcast_frame:
        - New clients automatically wait for keyframe
        - Failed sends reset keyframe state
        """
        ColorPrint.blue(f"[VideoStreamService] Marking client as needing keyframe for {serial}")

        # Initialize keyframe tracking if needed
        if serial not in self.client_keyframe_received:
            self.client_keyframe_received[serial] = {}

        # Mark this client as NOT having received keyframe yet
        # Next keyframe will be sent to this client
        self.client_keyframe_received[serial][websocket] = False

        ColorPrint.green(f"[VideoStreamService] ✓ Client will receive next keyframe for {serial}")

    async def _stream_video_loop(self, serial: str, device, stop_event: asyncio.Event):
        """
        Background streaming task (scrcpy_web_test pattern)

        Continuously reads frames from device and broadcasts to all subscribed WebSocket clients.
        Enhanced with proper error handling and cleanup coordination with HealthService.
        """
        ColorPrint.blue(f"[VideoStreamService] Background streaming loop started for {serial}")

        loop = asyncio.get_event_loop()
        frame_count = 0
        bytes_sent = 0
        start_time = loop.time()

        try:
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
                    ColorPrint.yellow(f"[VideoStreamService] Video stream ended for {serial} (no frame)")
                    break

                frame_count += 1
                bytes_sent += len(frame['data'])

                # Update health service timestamp (device is sending data)
                self.health_service.update_data_timestamp(serial)

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

        except Exception as e:
            ColorPrint.red(f"[VideoStreamService] Fatal error in streaming loop for {serial}: {e}")
            import traceback
            traceback.print_exc()

        finally:
            ColorPrint.blue(f"[VideoStreamService] Streaming loop ended for {serial}")
            ColorPrint.blue(f"[Stats] Frames: {frame_count}, Data: {bytes_sent / (1024 * 1024):.2f} MB")

            # CRITICAL: Clean up all resources
            await self._cleanup_stream(serial)

    async def _stream_yuv_loop(self, serial: str, device, stop_event: asyncio.Event, hwaccel: Optional[str]):
        """
        Background YUV streaming task (UNIFIED SHARED ARCHITECTURE)

        Continuously reads H.264 frames from device, decodes to YUV once,
        and broadcasts to all subscribed WebSocket clients.

        This fixes Problem 1 & 2: One read, one decode, multiple broadcasts.
        """
        ColorPrint.blue(f"[VideoStreamService] Background YUV streaming loop started for {serial}")

        loop = asyncio.get_event_loop()
        frame_count = 0
        decoded_count = 0
        bytes_sent = 0
        start_time = loop.time()

        # Create YUV decoder (shared for all clients)
        decoder_service = VideoDecoderService.instance()

        try:
            # Create decoder with hardware acceleration
            try:
                decoder_service.create_decoder(serial, hwaccel=hwaccel)
                ColorPrint.green(f"[VideoStreamService] ✓ YUV decoder created for {serial} (hwaccel={hwaccel})")
            except Exception as e:
                ColorPrint.red(f"[VideoStreamService] Failed to create YUV decoder: {e}")
                return

            # Get device info
            device_info = device.get_device_info()

            # Send init message to all clients
            init_message = {
                "type": "video.init",
                "timestamp": 0,
                "data": {
                    "serial": serial,
                    "codec": "h264",  # Source codec
                    "format": "yuv420p",  # Output format
                    "width": device_info.resolution.width,
                    "height": device_info.resolution.height,
                    "fps": device.params.max_fps,
                    "bitrate": device.params.bit_rate,
                    "hwaccel": hwaccel or "software"
                }
            }
            await self._broadcast_yuv_json(serial, init_message)

            while not stop_event.is_set():
                # Read H.264 frame from device (ONCE, blocking call, run in executor)
                h264_frame = await loop.run_in_executor(None, device.read_video_frame)

                if not h264_frame:
                    ColorPrint.yellow(f"[VideoStreamService] YUV stream ended for {serial} (no frame)")
                    break

                frame_count += 1

                # Update health service timestamp (device is sending data)
                self.health_service.update_data_timestamp(serial)

                # Decode H.264 to YUV420P (ONCE)
                try:
                    yuv_frame = decoder_service.decode_frame(serial, h264_frame['data'])

                    if yuv_frame:
                        decoded_count += 1

                        # Broadcast YUV frame to all subscribed clients with keyframe info
                        # Pass keyframe info from H.264 frame for smart dropping
                        is_keyframe = h264_frame.get('is_keyframe', False)
                        bytes_sent_this_frame = await self._broadcast_yuv_frame(serial, yuv_frame, is_keyframe)
                        bytes_sent += bytes_sent_this_frame

                except Exception as e:
                    # Decode errors for individual frames can be skipped
                    ColorPrint.yellow(f"[VideoStreamService] YUV decode error for frame {frame_count} on {serial}: {e}")
                    # Continue to next frame

                # Send metadata every 60 frames
                if decoded_count % 60 == 0 and decoded_count > 0:
                    elapsed = loop.time() - start_time
                    fps = decoded_count / elapsed if elapsed > 0 else 0

                    metadata = {
                        "type": "video.metadata",
                        "timestamp": int(elapsed * 1000),
                        "data": {
                            "fps": round(fps, 2),
                            "frames": decoded_count,
                            "bytes": bytes_sent,
                            "mbps": round(bytes_sent * 8 / elapsed / 1_000_000, 2) if elapsed > 0 else 0,
                            "width": yuv_frame['width'],
                            "height": yuv_frame['height']
                        }
                    }
                    await self._broadcast_yuv_json(serial, metadata)

                # Log progress every 300 frames
                if decoded_count % 300 == 0 and decoded_count > 0:
                    mb_sent = bytes_sent / (1024 * 1024)
                    ColorPrint.blue(f"[VideoStreamService] {serial} YUV: {decoded_count} frames, {mb_sent:.2f} MB sent")

        except Exception as e:
            ColorPrint.red(f"[VideoStreamService] Fatal error in YUV streaming loop for {serial}: {e}")
            import traceback
            traceback.print_exc()

        finally:
            ColorPrint.blue(f"[VideoStreamService] YUV streaming loop ended for {serial}")
            ColorPrint.blue(f"[Stats] Frames: {frame_count}, Decoded: {decoded_count}, Data: {bytes_sent / (1024 * 1024):.2f} MB")

            # Clean up YUV decoder
            try:
                decoder_service.close_decoder(serial)
                ColorPrint.green(f"[VideoStreamService] ✓ YUV decoder closed for {serial}")
            except Exception as e:
                ColorPrint.yellow(f"[VideoStreamService] Could not close YUV decoder: {e}")

            # CRITICAL: Clean up all resources
            await self._cleanup_yuv_stream(serial)

    async def _cleanup_stream(self, serial: str):
        """
        Clean up streaming resources (idempotent with state flag)

        This method ensures consistent cleanup across all code paths:
        - Normal stream end
        - Error termination
        - Force stop from HealthService
        """
        # Check if cleanup already in progress (prevent concurrent cleanup)
        if self.cleanup_in_progress.get(serial, False):
            ColorPrint.yellow(f"[VideoStreamService] Cleanup already in progress for {serial}")
            return

        # Mark cleanup as in progress
        self.cleanup_in_progress[serial] = True

        try:
            ColorPrint.yellow(f"[VideoStreamService] Cleaning up stream for {serial}")

            # Clean up active streams
            if serial in self.active_streams:
                del self.active_streams[serial]
                ColorPrint.blue(f"[VideoStreamService] Removed active stream for {serial}")

            # Clean up stream clients (but preserve WebSocket connections)
            if serial in self.stream_clients:
                # Notify clients that stream has ended
                end_message = {
                    "type": "stream.ended",
                    "data": {
                        "serial": serial,
                        "reason": "Stream terminated"
                    }
                }

                clients = list(self.stream_clients[serial])
                for ws in clients:
                    try:
                        await ws.send_json(end_message)
                    except Exception as e:
                        ColorPrint.yellow(f"[VideoStreamService] Failed to notify client about stream end: {e}")

                del self.stream_clients[serial]
                ColorPrint.blue(f"[VideoStreamService] Removed all clients for {serial}")

            # Clean up paused clients
            if serial in self.paused_clients:
                del self.paused_clients[serial]

            # Clean up stop events
            if serial in self.stop_events:
                del self.stop_events[serial]

            # Clean up cached config frames
            if serial in self.cached_config_frames:
                del self.cached_config_frames[serial]
                ColorPrint.blue(f"[VideoStreamService] Cleaned up cached config frame for {serial}")

            # Mark device as inactive in health service
            self.health_service.mark_device_inactive(serial)

            ColorPrint.green(f"[VideoStreamService] ✓ Stream cleanup completed for {serial}")

        finally:
            # Always clear cleanup flag
            if serial in self.cleanup_in_progress:
                self.cleanup_in_progress[serial] = False

    async def _broadcast_frame(self, serial: str, frame: Dict):
        """
        Broadcast binary frame to all subscribed clients (PARALLEL, SMART DROPPING)

        智能丢帧策略：
        - 新客户端：等待关键帧才开始发送（避免解码错误）
        - 关键帧（I-frame）：强制发送给所有客户端（保证同步）
        - 预测帧（P-frame）：只发送给已同步的客户端，慢客户端跳过（保持实时性）
        """
        clients = self.stream_clients.get(serial)
        if not clients:
            return

        # Get paused clients set for this serial
        paused = self.paused_clients.get(serial, set())

        # Check if this is a keyframe (关键帧)
        is_keyframe = frame.get('is_keyframe', False)
        is_config = frame.get('is_config', False)

        # Initialize keyframe tracking for this serial if needed
        if serial not in self.client_keyframe_received:
            self.client_keyframe_received[serial] = {}

        # Pack frame with custom protocol ONCE
        payload = self._pack_frame(serial, frame)

        # Build parallel send tasks with smart dropping
        tasks = []
        target_clients = []
        skipped_count = 0

        for ws in list(clients):
            if ws in paused:
                continue  # Skip paused clients

            # Track keyframe state for this client
            has_keyframe = self.client_keyframe_received[serial].get(ws, False)

            # Decision logic for sending
            if is_config:
                # Config frames (SPS/PPS) always send
                tasks.append(ws.send_bytes(payload))
                target_clients.append(ws)
            elif is_keyframe:
                # Keyframe: send to all clients and mark as synchronized
                tasks.append(ws.send_bytes(payload))
                target_clients.append(ws)
                self.client_keyframe_received[serial][ws] = True
            elif has_keyframe:
                # P-frame: only send to clients that have received keyframe
                tasks.append(ws.send_bytes(payload))
                target_clients.append(ws)
            else:
                # New client waiting for keyframe, skip P-frames
                skipped_count += 1

        # Log if skipping clients (waiting for keyframe)
        if skipped_count > 0:
            ColorPrint.blue(f"[SmartDrop] {serial}: {skipped_count} clients waiting for keyframe")

        # Send to all clients in parallel (non-blocking)
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Check for send failures
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    ws = target_clients[i]
                    ColorPrint.yellow(f"[VideoStreamService] Failed to send frame to client: {result}")
                    # Reset keyframe state for failed client (will wait for next keyframe)
                    if serial in self.client_keyframe_received and ws in self.client_keyframe_received[serial]:
                        self.client_keyframe_received[serial][ws] = False

    async def _broadcast_json(self, serial: str, message: Dict):
        """Broadcast JSON message to all subscribed clients (PARALLEL, skip paused clients)"""
        clients = self.stream_clients.get(serial)
        if not clients:
            return

        # Get paused clients set for this serial
        paused = self.paused_clients.get(serial, set())

        # Build parallel send tasks for all active (non-paused) clients
        tasks = []
        for ws in list(clients):
            if ws not in paused:
                tasks.append(ws.send_json(message))

        # Send to all clients in parallel (non-blocking)
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Check for send failures
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    ColorPrint.yellow(f"[VideoStreamService] Failed to send JSON to client: {result}")

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

    # YUV Broadcasting Methods (Problem 1 & 2 Fix)

    async def _broadcast_yuv_frame(self, serial: str, yuv_frame: Dict, is_keyframe: bool = False) -> int:
        """
        Broadcast YUV frame to all subscribed clients (PARALLEL, SMART DROPPING)

        智能丢帧策略（YUV模式）：
        - 新客户端：等待关键帧才开始发送（避免花屏）
        - 关键帧：强制发送给所有客户端（保证同步）
        - 预测帧：只发送给已同步的客户端，慢客户端跳过（保持实时性）

        Args:
            serial: Device serial
            yuv_frame: Decoded YUV frame
            is_keyframe: Whether this frame comes from H.264 keyframe

        Returns:
            Total bytes sent
        """
        clients = self.yuv_stream_clients.get(serial)
        if not clients:
            return 0

        # Get paused clients set for this serial
        paused = self.yuv_paused_clients.get(serial, set())

        # Initialize keyframe tracking for this serial if needed
        if serial not in self.client_keyframe_received:
            self.client_keyframe_received[serial] = {}

        # Pack YUV frame ONCE
        payload = self._pack_yuv_frame(serial, yuv_frame)

        # Build parallel send tasks with smart dropping
        tasks = []
        target_clients = []
        skipped_count = 0

        for ws in list(clients):
            if ws in paused:
                continue  # Skip paused clients

            # Track keyframe state for this client
            has_keyframe = self.client_keyframe_received[serial].get(ws, False)

            # Decision logic for sending
            if is_keyframe:
                # Keyframe: send to all clients and mark as synchronized
                tasks.append(ws.send_bytes(payload))
                target_clients.append(ws)
                self.client_keyframe_received[serial][ws] = True
            elif has_keyframe:
                # P-frame: only send to clients that have received keyframe
                tasks.append(ws.send_bytes(payload))
                target_clients.append(ws)
            else:
                # New client waiting for keyframe, skip P-frames
                skipped_count += 1

        # Log if skipping clients (waiting for keyframe)
        if skipped_count > 0:
            ColorPrint.blue(f"[SmartDrop YUV] {serial}: {skipped_count} clients waiting for keyframe")

        # Send to all clients in parallel (non-blocking)
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Check for send failures
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    ws = target_clients[i]
                    ColorPrint.yellow(f"[VideoStreamService] Failed to send YUV frame to client: {result}")
                    # Reset keyframe state for failed client (will wait for next keyframe)
                    if serial in self.client_keyframe_received and ws in self.client_keyframe_received[serial]:
                        self.client_keyframe_received[serial][ws] = False

        # Calculate total bytes sent (payload size * number of successful sends)
        bytes_sent = len(payload) * len(target_clients)
        return bytes_sent

    async def _broadcast_yuv_json(self, serial: str, message: Dict):
        """Broadcast JSON message to all YUV subscribed clients (PARALLEL, skip paused clients)"""
        clients = self.yuv_stream_clients.get(serial)
        if not clients:
            return

        # Get paused clients set for this serial
        paused = self.yuv_paused_clients.get(serial, set())

        # Build parallel send tasks for all active (non-paused) clients
        tasks = []
        for ws in list(clients):
            if ws not in paused:
                tasks.append(ws.send_json(message))

        # Send to all clients in parallel
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Check for send failures
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    ColorPrint.yellow(f"[VideoStreamService] Failed to send YUV JSON to client: {result}")

    def _pack_yuv_frame(self, serial: str, yuv_frame: Dict) -> bytes:
        """
        Pack YUV frame with custom binary protocol

        Format: [serial_len(1)][serial(N)][pts(8)][width(2)][height(2)][y_size(4)][u_size(4)][v_size(4)][y_data][u_data][v_data]
        """
        serial_bytes = serial.encode('utf-8')[:255]

        # Pack header with proper format
        header = bytes([len(serial_bytes)]) + serial_bytes

        # Add pts, width, height, and plane sizes (big-endian)
        header += struct.pack(
            ">QHHIII",
            yuv_frame.get('pts', 0),  # pts: 8 bytes
            yuv_frame['width'],  # width: 2 bytes
            yuv_frame['height'],  # height: 2 bytes
            len(yuv_frame['y_plane']),  # y_size: 4 bytes
            len(yuv_frame['u_plane']),  # u_size: 4 bytes
            len(yuv_frame['v_plane'])  # v_size: 4 bytes
        )

        # Combine all data
        payload = (
            header +
            yuv_frame['y_plane'] +
            yuv_frame['u_plane'] +
            yuv_frame['v_plane']
        )

        return payload

    async def _cleanup_yuv_stream(self, serial: str):
        """
        Clean up YUV streaming resources (idempotent with state flag)

        This method ensures consistent cleanup across all code paths for YUV streams.
        """
        # Check if cleanup already in progress
        if self.cleanup_in_progress.get(serial, False):
            ColorPrint.yellow(f"[VideoStreamService] Cleanup already in progress for YUV {serial}")
            return

        # Mark cleanup as in progress
        self.cleanup_in_progress[serial] = True

        try:
            ColorPrint.yellow(f"[VideoStreamService] Cleaning up YUV stream for {serial}")

            # Clean up YUV active streams
            if serial in self.yuv_active_streams:
                del self.yuv_active_streams[serial]
                ColorPrint.blue(f"[VideoStreamService] Removed YUV active stream for {serial}")

            # Clean up YUV stream clients (notify clients stream ended)
            if serial in self.yuv_stream_clients:
                end_message = {
                    "type": "stream.ended",
                    "data": {"serial": serial, "reason": "Stream terminated", "format": "yuv"}
                }

                clients = list(self.yuv_stream_clients[serial])
                ColorPrint.yellow(f"[VideoStreamService] Notifying {len(clients)} YUV clients about stream end")

                for ws in clients:
                    try:
                        await ws.send_json(end_message)
                    except Exception as e:
                        ColorPrint.yellow(f"[VideoStreamService] Failed to notify YUV client: {e}")

                del self.yuv_stream_clients[serial]

            # Clean up other YUV resources
            if serial in self.yuv_paused_clients:
                del self.yuv_paused_clients[serial]
            if serial in self.yuv_stop_events:
                del self.yuv_stop_events[serial]
            if serial in self.yuv_hwaccel:
                del self.yuv_hwaccel[serial]

            # Mark device as inactive in health service
            self.health_service.mark_device_inactive(serial)

            ColorPrint.green(f"[VideoStreamService] ✓ YUV stream cleanup completed for {serial}")

        finally:
            # Always clear cleanup flag
            if serial in self.cleanup_in_progress:
                self.cleanup_in_progress[serial] = False

    async def stream_yuv_to_websocket(
        self,
        serial: str,
        websocket: WebSocket,
        hwaccel: Optional[str] = None
    ):
        """
        Stream YUV420P decoded video to WebSocket

        This method:
        1. Connects the device and starts scrcpy-server
        2. Reads H.264 frames from device
        3. Decodes H.264 to YUV420P using VideoDecoderService
        4. Sends YUV data to WebSocket client

        Args:
            serial: Device serial number
            websocket: WebSocket client connection
            hwaccel: Hardware acceleration type (cuda/qsv/dxva2/vaapi/auto)
        """
        ColorPrint.blue(f"[VideoStreamService] Starting YUV stream for {serial} (hwaccel={hwaccel})")

        # Register client for pause/resume support and health monitoring
        if serial not in self.stream_clients:
            self.stream_clients[serial] = set()
        self.stream_clients[serial].add(websocket)
        ColorPrint.green(f"[VideoStreamService] Client registered for YUV stream {serial}, total clients: {len(self.stream_clients[serial])}")

        # Register device with health service
        self.health_service.mark_device_active(serial)

        # Get or create device
        device = self.device_manager.get_device(serial)
        if not device:
            ColorPrint.red(f"[VideoStreamService] Device {serial} not found")
            # Cleanup client registration
            self.stream_clients[serial].discard(websocket)
            if len(self.stream_clients[serial]) == 0:
                del self.stream_clients[serial]
            await websocket.send_json({
                "type": "error",
                "message": f"Device {serial} not found"
            })
            return

        # Connect device if not connected
        if not device.is_connected():
            ColorPrint.yellow(f"[VideoStreamService] Device {serial} not connected, starting scrcpy-server...")

            # Get config from ConfigService
            config_service = ConfigService.instance()
            global_config = await config_service.get_global()

            # Create ServerParams
            params = ServerParams(
                max_size=global_config.get('max_size', 720),
                bit_rate=global_config.get('bit_rate', 8000000),
                max_fps=global_config.get('max_fps', 60),
                codec=VideoCodec.H264,  # Always use H.264 for decoding
                control=global_config.get('control', True),
                locked_video_orientation=global_config.get('locked_video_orientation', -1)
            )

            # Start scrcpy server
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: device.start_server(
                        jar_path=self.scrcpy_server_jar,
                        params=params
                    )
                )
                ColorPrint.green(f"[VideoStreamService] ✓ ScrcpyDevice started for {serial}")
            except Exception as e:
                ColorPrint.red(f"[VideoStreamService] Failed to start device: {e}")
                # Cleanup client registration on error
                if serial in self.stream_clients:
                    self.stream_clients[serial].discard(websocket)
                    if len(self.stream_clients[serial]) == 0:
                        del self.stream_clients[serial]
                await websocket.send_json({
                    "type": "video.error",
                    "data": {
                        "error": f"Failed to start device: {str(e)}"
                    }
                })
                return

        # Get device info
        device_info = device.get_device_info()

        # Create YUV decoder
        decoder_service = VideoDecoderService.instance()
        try:
            decoder_service.create_decoder(serial, hwaccel=hwaccel)
            ColorPrint.green(f"[VideoStreamService] ✓ YUV decoder created for {serial}")
        except Exception as e:
            ColorPrint.red(f"[VideoStreamService] Failed to create decoder: {e}")
            # Cleanup client registration on error
            if serial in self.stream_clients:
                self.stream_clients[serial].discard(websocket)
                if len(self.stream_clients[serial]) == 0:
                    del self.stream_clients[serial]
            await websocket.send_json({
                "type": "video.error",
                "data": {
                    "error": f"Failed to create YUV decoder: {str(e)}"
                }
            })
            return

        # Send init message
        init_message = {
            "type": "video.init",
            "timestamp": int(time.time() * 1000),
            "data": {
                "serial": serial,
                "codec": "h264",  # Source codec
                "format": "yuv420p",  # Output format
                "width": device_info.resolution.width,
                "height": device_info.resolution.height,
                "fps": device.params.max_fps,
                "bitrate": device.params.bit_rate,
                "hwaccel": hwaccel or "software"
            }
        }
        await websocket.send_json(init_message)
        ColorPrint.green(f"[VideoStreamService] Sent YUV init message to client")

        # Stream loop
        loop = asyncio.get_event_loop()
        frame_count = 0
        decoded_count = 0
        bytes_sent = 0
        start_time = loop.time()

        try:
            while True:
                # Read H.264 frame from device (blocking, run in executor)
                h264_frame = await loop.run_in_executor(None, device.read_video_frame)

                if not h264_frame:
                    ColorPrint.yellow(f"[VideoStreamService] Video stream ended for {serial}")
                    break

                frame_count += 1

                # Update health service timestamp
                self.health_service.update_data_timestamp(serial)

                # Decode H.264 to YUV420P
                try:
                    yuv_frame = decoder_service.decode_frame(serial, h264_frame['data'])

                    if yuv_frame:
                        decoded_count += 1

                        # Pack YUV data
                        # Format: [serial_len(1)][serial(N)][pts(8)][width(2)][height(2)][y_size(4)][u_size(4)][v_size(4)][y_data][u_data][v_data]
                        serial_bytes = serial.encode('utf-8')[:255]

                        # Pack header with proper format matching frontend expectations
                        header = bytes([len(serial_bytes)]) + serial_bytes

                        # Add pts, width, height, and plane sizes (big-endian)
                        header += struct.pack(
                            ">QHHIII",
                            yuv_frame.get('pts', 0),  # pts: 8 bytes
                            yuv_frame['width'],  # width: 2 bytes
                            yuv_frame['height'],  # height: 2 bytes
                            len(yuv_frame['y_plane']),  # y_size: 4 bytes
                            len(yuv_frame['u_plane']),  # u_size: 4 bytes
                            len(yuv_frame['v_plane'])  # v_size: 4 bytes
                        )

                        # Combine all data
                        payload = (
                            header +
                            yuv_frame['y_plane'] +
                            yuv_frame['u_plane'] +
                            yuv_frame['v_plane']
                        )

                        # Send to WebSocket (check if paused)
                        paused = self.paused_clients.get(serial, set())
                        if websocket not in paused:
                            await websocket.send_bytes(payload)
                            bytes_sent += len(payload)

                        # Log progress every 60 frames
                        if decoded_count % 60 == 0:
                            elapsed = loop.time() - start_time
                            fps = decoded_count / elapsed if elapsed > 0 else 0
                            mbps = bytes_sent * 8 / elapsed / 1_000_000 if elapsed > 0 else 0

                            ColorPrint.blue(
                                f"[VideoStreamService] {serial} YUV: "
                                f"{decoded_count} frames @ {fps:.1f} fps, "
                                f"{mbps:.1f} Mbps"
                            )

                            # Send metadata (check if paused)
                            if websocket not in paused:
                                metadata = {
                                    "type": "video.metadata",
                                    "timestamp": int(elapsed * 1000),
                                    "data": {
                                        "fps": round(fps, 2),
                                        "frames": decoded_count,
                                        "bytes": bytes_sent,
                                        "mbps": round(mbps, 2),
                                        "format": "yuv420p"
                                    }
                                }
                                await websocket.send_json(metadata)

                except Exception as decode_error:
                    if frame_count <= 5:  # Log first few decode errors
                        ColorPrint.yellow(f"[VideoStreamService] Decode error frame {frame_count}: {decode_error}")
                    continue

        except WebSocketDisconnect:
            ColorPrint.blue(f"[VideoStreamService] WebSocket disconnected for {serial}")
        except Exception as e:
            ColorPrint.red(f"[VideoStreamService] YUV streaming error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            ColorPrint.blue(f"[VideoStreamService] YUV stream ended for {serial}")
            ColorPrint.blue(
                f"[Stats] H.264 frames: {frame_count}, "
                f"Decoded: {decoded_count}, "
                f"Data sent: {bytes_sent / (1024 * 1024):.2f} MB"
            )

            # CRITICAL: Clean up resources when WebSocket disconnects
            # 1. Remove client from subscription list
            if serial in self.stream_clients:
                self.stream_clients[serial].discard(websocket)
                ColorPrint.yellow(f"[VideoStreamService] Client unsubscribed from YUV {serial}, remaining: {len(self.stream_clients[serial])}")
                if len(self.stream_clients[serial]) == 0:
                    del self.stream_clients[serial]
                    ColorPrint.blue(f"[VideoStreamService] No more clients for YUV {serial}")

            # 2. Clean up paused state
            if serial in self.paused_clients:
                self.paused_clients[serial].discard(websocket)
                if len(self.paused_clients[serial]) == 0:
                    del self.paused_clients[serial]

            # 3. Close decoder (only if no more clients for this serial)
            if serial not in self.stream_clients:
                decoder_service = VideoDecoderService.instance()
                try:
                    decoder_service.close_decoder(serial)
                    ColorPrint.green(f"[VideoStreamService] ✓ Decoder closed for {serial}")
                except Exception as e:
                    ColorPrint.yellow(f"[VideoStreamService] Error closing decoder for {serial}: {e}")
