"""
Scrcpy-server device implementation

This provides a concrete implementation of AndroidDevice that connects
to scrcpy-server for video streaming and device control.
"""

import random
import socket
import struct
import subprocess
import threading
import time
from typing import Optional, Callable
from pathlib import Path

from .android_device import AndroidDevice
from .device_info import DeviceInfo, Resolution
from .server_params import ServerParams, VideoCodec


class ScrcpyDevice(AndroidDevice):
    """
    Concrete AndroidDevice implementation using scrcpy-server

    This class:
    - Starts scrcpy-server on the device via ADB
    - Manages port forwarding for video and control
    - Provides video stream socket
    - Provides control socket
    - Handles device information parsing

    Apps can extend this class for customization.
    """

    def __init__(self, serial: str, params: ServerParams, adb_path: str = "adb"):
        """
        Initialize scrcpy device

        Args:
            serial: Device serial number
            params: Server parameters
            adb_path: Path to ADB executable
        """
        super().__init__(serial, params)
        self.adb_path = adb_path

        # Server process
        self._server_process: Optional[subprocess.Popen] = None

        # Socket connections
        self._video_socket: Optional[socket.socket] = None
        self._control_socket: Optional[socket.socket] = None

        # Port forwarding
        self._video_port: Optional[int] = None
        self._control_port: Optional[int] = None

        # Device info
        self.info: Optional[DeviceInfo] = None

        # Callbacks
        self._on_video_data: Optional[Callable[[bytes], None]] = None

    def start_server(self) -> int:
        """
        Start scrcpy-server on the device

        Returns:
            Local video port number

        Raises:
            RuntimeError: If server fails to start
        """
        # ✅ FIX: Use correct scrcpy protocol - single tunnel with SCID
        scid = random.randint(0, 0x7FFFFFFF)  # 31-bit random number

        # 1. Find ONE port for the tunnel (scrcpy uses single tunnel for all sockets)
        tunnel_port = self._find_free_port()

        # 2. Setup SINGLE port forwarding to scrcpy abstract address
        # Format: adb forward tcp:<port> localabstract:scrcpy_<SCID>
        abstract_addr = f"localabstract:scrcpy_{scid:08x}"
        self._setup_port_forward(tunnel_port, abstract_addr)

        print(f"\n[ScrcpyDevice] Starting scrcpy-server for {self.serial}")
        print(f"[ScrcpyDevice] SCID: {scid:08x}")
        print(f"[ScrcpyDevice] Tunnel: tcp:{tunnel_port} -> {abstract_addr}")

        # 3. Build scrcpy-server command with SCID
        server_cmd = self._build_server_command(scid)

        # 4. Start scrcpy-server process
        adb_cmd = [
            self.adb_path,
            "-s", self.serial,
            "shell",
            *server_cmd
        ]

        print(f"[ScrcpyDevice] Command: {' '.join(adb_cmd)}")

        self._server_process = subprocess.Popen(
            adb_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE
        )

        # 5. Connect with retry logic (like scrcpy client does)
        # Reference: scrcpy app/src/server.c line 639-642
        # scrcpy uses 100 attempts with 100ms delay between attempts
        print(f"[ScrcpyDevice] Connecting to server with retry logic...")

        max_attempts = 100
        retry_delay = 0.1  # 100ms

        self._video_socket = None
        for attempt in range(max_attempts):
            # Check if server process crashed
            if self._server_process.poll() is not None:
                stdout, stderr = self._server_process.communicate()
                print(f"[ScrcpyDevice] ERROR: scrcpy-server terminated unexpectedly")
                print(f"[ScrcpyDevice] Return code: {self._server_process.returncode}")
                if stdout:
                    print(f"[ScrcpyDevice] stdout: {stdout.decode('utf-8', errors='ignore')}")
                if stderr:
                    print(f"[ScrcpyDevice] stderr: {stderr.decode('utf-8', errors='ignore')}")
                raise RuntimeError(f"scrcpy-server terminated with code {self._server_process.returncode}")

            try:
                # Try to connect and read dummy byte (this proves server is ready)
                print(f"[ScrcpyDevice] Connection attempt {attempt + 1}/{max_attempts}...")
                test_socket = self._connect_to_port(tunnel_port)

                # Read dummy byte to verify server is actually listening
                # Reference: server.c line 474-480, DesktopConnection.java line 68-70
                dummy_byte = self._recv_exactly(test_socket, 1)

                # Success! Server is ready
                print(f"[ScrcpyDevice] ✓ Connection successful after {attempt + 1} attempts")
                print(f"[ScrcpyDevice] ✓ Dummy byte received: 0x{dummy_byte[0]:02x}")
                self._video_socket = test_socket
                break

            except (ConnectionRefusedError, socket.timeout, OSError) as e:
                # Server not ready yet, close socket and retry
                if attempt < max_attempts - 1:
                    print(f"[ScrcpyDevice]   Server not ready, retrying in {retry_delay}s... ({e})")
                    time.sleep(retry_delay)
                else:
                    print(f"[ScrcpyDevice] ✗ Failed to connect after {max_attempts} attempts")
                    raise RuntimeError(f"Server failed to start after {max_attempts * retry_delay}s")

        if self._video_socket is None:
            raise RuntimeError("Failed to establish video socket connection")

        # 6. Read device metadata from FIRST socket (per scrcpy protocol)
        # Sent by connection.sendDeviceMeta() in Server.java line 106-108
        print(f"[ScrcpyDevice] Reading device metadata from first socket...")
        self._read_device_metadata()
        print(f"[ScrcpyDevice] ✓ Device: {self.info.model}")

        # 7. Read codec metadata from video socket (12 bytes: codec_id + width + height)
        # Sent by videoStreamer.writeVideoHeader() after encoding starts
        print(f"[ScrcpyDevice] Reading video codec metadata...")
        self._read_video_codec_metadata()
        print(f"[ScrcpyDevice] ✓ Resolution: {self.info.resolution.width}x{self.info.resolution.height}")

        # 8. Connect control socket to tunnel (second socket, since audio=false)
        print(f"[ScrcpyDevice] Connecting control socket to tunnel port {tunnel_port}...")
        self._control_socket = self._connect_to_port(tunnel_port)
        print(f"[ScrcpyDevice] ✓ Control socket connected")

        print(f"\n[ScrcpyDevice] ✓ Server started successfully for {self.serial}")
        print(f"  Tunnel port: {tunnel_port}")
        print(f"  Resolution: {self.info.resolution.width}x{self.info.resolution.height}")
        print(f"  Model: {self.info.model}\n")

        # Store tunnel port for cleanup
        self._video_port = tunnel_port
        self._control_port = tunnel_port

        return tunnel_port

    def stop_server(self):
        """Stop scrcpy-server and clean up resources"""
        try:
            # Close sockets
            if self._video_socket:
                self._video_socket.close()
                self._video_socket = None

            if self._control_socket:
                self._control_socket.close()
                self._control_socket = None

            # Remove port forwarding
            if self._video_port:
                self._remove_port_forward(self._video_port)
            if self._control_port:
                self._remove_port_forward(self._control_port)

            # Kill server process
            if self._server_process:
                self._server_process.terminate()
                try:
                    self._server_process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self._server_process.kill()
                self._server_process = None

            print(f"[ScrcpyDevice] Server stopped for {self.serial}")

        except Exception as e:
            print(f"[ScrcpyDevice] Error stopping server: {e}")

    def get_video_socket(self) -> socket.socket:
        """
        Get video stream socket

        Returns:
            Socket for reading H.264 stream
        """
        if not self._video_socket:
            raise RuntimeError("Video socket not connected")
        return self._video_socket

    def get_control_socket(self) -> socket.socket:
        """
        Get control socket

        Returns:
            Socket for sending control messages
        """
        if not self._control_socket:
            raise RuntimeError("Control socket not connected")
        return self._control_socket

    def get_device_info(self) -> DeviceInfo:
        """
        Get device information

        Returns:
            DeviceInfo object
        """
        if not self.info:
            raise RuntimeError("Device info not available")
        return self.info

    def read_video_frame(self) -> Optional[bytes]:
        """
        Read one video frame from socket according to scrcpy protocol

        Frame header format (12 bytes):
        - PTS (8 bytes, u64): bits 63-62 contain flags (config|keyframe), bits 61-0 contain PTS
        - packet_size (4 bytes, u32): size of the raw packet

        Returns:
            Tuple of (frame_data, pts, is_config, is_keyframe) or None if connection closed

        Reference: scrcpy develop.md line 366-393
        """
        # Read 12-byte frame header
        header = self._recv_exactly(self._video_socket, 12)
        if not header:
            return None

        # Unpack header: PTS (8 bytes) + packet_size (4 bytes)
        pts_raw, packet_size = struct.unpack(">QI", header)

        # Extract flags from top 2 bits of PTS
        is_config = bool(pts_raw & 0x8000000000000000)  # bit 63
        is_keyframe = bool(pts_raw & 0x4000000000000000)  # bit 62
        pts = pts_raw & 0x3FFFFFFFFFFFFFFF  # bits 61-0

        # Read packet data
        packet_data = self._recv_exactly(self._video_socket, packet_size)
        if not packet_data:
            return None

        return {
            'data': packet_data,
            'pts': pts,
            'is_config': is_config,
            'is_keyframe': is_keyframe,
            'size': packet_size
        }

    def send_control_message(self, message: bytes):
        """
        Send control message to device

        Args:
            message: Control message bytes (built by MessageBuilder)
        """
        try:
            self._control_socket.sendall(message)
        except Exception as e:
            print(f"[ScrcpyDevice] Error sending control message: {e}")

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    def _find_free_port(self) -> int:
        """Find an available local port"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            s.listen(1)
            port = s.getsockname()[1]
        return port

    def _setup_port_forward(self, local_port: int, remote: str):
        """Setup ADB port forwarding"""
        cmd = [
            self.adb_path,
            "-s", self.serial,
            "forward",
            f"tcp:{local_port}",
            remote
        ]
        subprocess.run(cmd, check=True, capture_output=True)

    def _remove_port_forward(self, local_port: int):
        """Remove ADB port forwarding"""
        cmd = [
            self.adb_path,
            "-s", self.serial,
            "forward",
            "--remove",
            f"tcp:{local_port}"
        ]
        subprocess.run(cmd, capture_output=True)

    def _connect_to_port(self, port: int) -> socket.socket:
        """Connect to local port with timeout"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10.0)  # 10 second timeout for debugging
        sock.connect(('127.0.0.1', port))
        print(f"[ScrcpyDevice] Socket connected successfully to port {port}")
        return sock

    def _build_server_command(self, scid: int) -> list:
        """
        Build scrcpy-server shell command for v3.3.3

        Command format:
            CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server <version> [key=value...]

        Args:
            scid: 31-bit random session ID

        Reference: scrcpy_source/server/src/main/java/com/genymobile/scrcpy/Options.java
        """
        # scrcpy v3.3.3 server command (matches scrcpy_source exactly)
        cmd = [
            "CLASSPATH=/data/local/tmp/scrcpy-server.jar",
            "app_process",
            "/",
            "com.genymobile.scrcpy.Server",
            "3.3.3",  # Version (args[0]) - must match BuildConfig.VERSION_NAME

            # Session ID
            f"scid={scid}",

            # Video configuration (key=value format)
            "video=true",
            f"video_bit_rate={self.params.bit_rate}",
            f"max_size={self.params.max_size}",
            f"max_fps={self.params.max_fps}",
            f"video_codec={self.params.codec.value}",  # h264, h265, av1

            # Audio configuration (disabled for now)
            "audio=false",

            # Control configuration
            f"control={str(self.params.control).lower()}",
            "tunnel_forward=true",

            # Additional options for stability
            "cleanup=true",
            "power_on=true",
            "clipboard_autosync=true",
            "downsize_on_error=true",
        ]
        return cmd

    def _read_device_metadata(self):
        """
        Read device metadata from FIRST socket (per scrcpy protocol)

        According to scrcpy develop.md:
        - Device metadata is sent on the first socket opened
        - Currently only contains device name (64 bytes, null-terminated)
        - May contain more fields in future versions

        Reference: https://github.com/Genymobile/scrcpy/blob/master/server/src/main/java/com/genymobile/scrcpy/DesktopConnection.java#L151
        """
        # Read device name (64 bytes, null-terminated string)
        name_bytes = self._recv_exactly(self._video_socket, 64)
        device_name = name_bytes.split(b'\x00')[0].decode('utf-8')

        print(f"[ScrcpyDevice] Device name from metadata: {device_name}")

        # Initialize DeviceInfo with placeholder resolution (will be updated from codec metadata)
        self.info = DeviceInfo(
            serial=self.serial,
            model=device_name,
            resolution=Resolution(width=0, height=0)  # Will be updated
        )

    def _read_video_codec_metadata(self):
        """
        Read codec metadata from VIDEO socket (per scrcpy protocol)

        According to scrcpy develop.md (line 355-363):
        Video socket sends 12 bytes of codec metadata:
        - codec_id (u32): H264=0x68323634, H265=0x68323635, AV1=0x00617631
        - width (u32): initial video width
        - height (u32): initial video height

        Reference: https://github.com/Genymobile/scrcpy/blob/master/server/src/main/java/com/genymobile/scrcpy/Streamer.java#L33-L51
        """
        # Read 12 bytes: codec_id (4) + width (4) + height (4)
        codec_metadata = self._recv_exactly(self._video_socket, 12)

        # Unpack as big-endian unsigned integers
        codec_id, width, height = struct.unpack(">III", codec_metadata)

        print(f"[ScrcpyDevice] Codec metadata: codec_id=0x{codec_id:08x}, {width}x{height}")

        # Update DeviceInfo with actual resolution
        self.info.resolution = Resolution(width=width, height=height)

    def _read_device_info(self):
        """
        DEPRECATED: Use _read_device_metadata() and _read_video_codec_metadata() instead

        This method is kept for backward compatibility but should not be used.
        """
        # Legacy method - now split into two methods following scrcpy protocol
        raise NotImplementedError("Use _read_device_metadata() and _read_video_codec_metadata() instead")

    def _recv_exactly(self, sock: socket.socket, length: int) -> bytes:
        """
        Receive exactly `length` bytes from socket

        Args:
            sock: Socket to read from
            length: Number of bytes to read

        Returns:
            Exactly `length` bytes

        Raises:
            ConnectionError: If connection closed before receiving all data
        """
        data = b''
        while len(data) < length:
            chunk = sock.recv(length - len(data))
            if not chunk:
                raise ConnectionError("Connection closed")
            data += chunk
        return data
