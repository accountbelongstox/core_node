"""
Scrcpy-server device implementation

This provides a concrete implementation of AndroidDevice that connects
to scrcpy-server for video streaming and device control.
"""

import sys
import random
import socket
import struct
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
import threading
import time
from typing import Optional, Callable
from pathlib import Path

# UTF-8 encoding for Windows - DISABLED
# Reason: Modifying sys.stdout breaks MCP STDIO protocol and other use cases
# Solution: Use ensure_stdio_has_buffer_attributes() in entry points instead
# if sys.platform == 'win32':
#     import codecs
#     # Check if stdout is already wrapped to avoid double-wrapping
#     if hasattr(sys.stdout, 'buffer'):
#         sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
#         sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
#     # If already wrapped, stdout/stderr are already UTF-8 capable

from pycore.pyutils.device.android_device import AndroidDevice
from pycore.pyutils.device.device_info import DeviceInfo, Resolution
from pycore.pyutils.device.server_params import ServerParams, VideoCodec
import subprocess


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
        self._device_socket_name: Optional[str] = None  # For reverse tunnel cleanup

        # Device info
        self.info: Optional[DeviceInfo] = None

        # Callbacks
        self._on_video_data: Optional[Callable[[bytes], None]] = None

    def start_server(self) -> int:
        """
        Start scrcpy-server on the device using REVERSE mode (default)

        REVERSE mode (default, recommended):
        - PC listens on a port, device connects to PC
        - Uses: adb reverse localabstract:scrcpy_<SCID> tcp:<PORT>
        - More reliable, no polling needed
        - No dummy byte sent

        FORWARD mode (fallback):
        - Device listens on abstract socket, PC connects to device
        - Uses: adb forward tcp:<PORT> localabstract:scrcpy_<SCID>
        - Requires polling until server is ready
        - Dummy byte sent to detect connection errors

        Returns:
            Local video port number

        Raises:
            RuntimeError: If server fails to start

        Reference: scrcpy develop.md lines 309-319, adb_tunnel.c
        """
        # Cleanup old reverse tunnels first
        self._cleanup_old_tunnels()

        scid = random.randint(0, 0x7FFFFFFF)  # 31-bit random number

        # Find free port for the tunnel
        tunnel_port = self._find_free_port()

        # Setup REVERSE tunnel (PC listens, device connects)
        # This is scrcpy's default mode and most reliable
        abstract_addr = f"scrcpy_{scid:08x}"
        self._setup_reverse_tunnel(tunnel_port, abstract_addr)

        print(f"\n[ScrcpyDevice] Starting scrcpy-server for {self.serial}")
        print(f"[ScrcpyDevice] SCID: {scid:08x}")
        print(f"[ScrcpyDevice] Mode: REVERSE (PC listens, device connects)")
        print(f"[ScrcpyDevice] Tunnel: adb reverse localabstract:{abstract_addr} -> tcp:{tunnel_port}")

        # Start listening socket BEFORE starting server
        listen_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        listen_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        listen_socket.bind(('127.0.0.1', tunnel_port))
        listen_socket.listen(2)  # video + control
        listen_socket.settimeout(30.0)  # 30 second timeout
        print(f"[ScrcpyDevice] [OK] Listening on tcp:{tunnel_port}")

        # Build and start scrcpy-server process
        server_cmd = self._build_server_command(scid)

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

        # Accept connections from device (reverse mode)
        print(f"[ScrcpyDevice] Waiting for device to connect...")

        # Accept video socket (first socket)
        print(f"[ScrcpyDevice] Accepting video socket...")
        try:
            self._video_socket, _ = listen_socket.accept()
            self._video_socket.settimeout(10.0)
            print(f"[ScrcpyDevice] [OK] Video socket connected")
        except socket.timeout:
            listen_socket.close()
            raise RuntimeError(f"Timeout waiting for video socket connection from {self.serial}")

        # NOTE: In REVERSE mode, NO dummy byte is sent
        # Dummy byte is only sent in FORWARD mode
        # Reference: scrcpy develop.md lines 333-336

        # Accept control socket if enabled
        if self.params.control:
            print(f"[ScrcpyDevice] Accepting control socket...")
            try:
                self._control_socket, _ = listen_socket.accept()
                self._control_socket.settimeout(10.0)
                print(f"[ScrcpyDevice] [OK] Control socket connected")
            except socket.timeout:
                listen_socket.close()
                raise RuntimeError(f"Timeout waiting for control socket connection from {self.serial}")

        listen_socket.close()

        # 7. NOW read device metadata (server can send it now)
        # Sent by connection.sendDeviceMeta() in Server.java line 107
        print(f"[ScrcpyDevice] Reading device metadata from first socket...")
        try:
            self._read_device_metadata()
            print(f"[ScrcpyDevice] [OK] Device: {self.info.model}")
        except Exception as e:
            raise RuntimeError(f"Failed to read device metadata from {self.serial}: {e}")

        # 8. Read codec metadata from video socket (12 bytes: codec_id + width + height)
        # Sent by videoStreamer.writeVideoHeader() after encoding starts
        print(f"[ScrcpyDevice] Reading video codec metadata...")
        try:
            self._read_video_codec_metadata()
            print(f"[ScrcpyDevice] [OK] Resolution: {self.info.resolution.width}x{self.info.resolution.height}")
        except Exception as e:
            raise RuntimeError(f"Failed to read video codec metadata from {self.serial}: {e}")

        # After the initial handshake, switch sockets back to blocking mode so
        # long-running streams are not interrupted by read timeouts.
        if self._video_socket:
            self._video_socket.settimeout(None)
        if self._control_socket:
            self._control_socket.settimeout(None)

        print(f"\n[ScrcpyDevice] [OK] Server started successfully for {self.serial}")
        print(f"  Tunnel port: {tunnel_port}")
        print(f"  Resolution: {self.info.resolution.width}x{self.info.resolution.height}")
        print(f"  Model: {self.info.model}\n")

        # Store tunnel port for cleanup
        self._video_port = tunnel_port
        self._control_port = tunnel_port

        return tunnel_port

    def stop_server(self):
        """Stop scrcpy-server and clean up resources"""
        # Close sockets
        if self._video_socket:
            self._video_socket.close()
            self._video_socket = None

        if self._control_socket:
            self._control_socket.close()
            self._control_socket = None

        # Remove reverse tunnel (if using reverse mode)
        if self._device_socket_name:
            self._remove_reverse_tunnel(self._device_socket_name)
            self._device_socket_name = None

        # Remove port forwarding (if using forward mode)
        if self._video_port:
            self._remove_port_forward(self._video_port)

        # Kill server process
        if self._server_process:
            self._server_process.terminate()
            self._server_process.wait(timeout=3)
            self._server_process = None

        print(f"[ScrcpyDevice] Server stopped for {self.serial}")

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
        self._control_socket.sendall(message)

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    def _cleanup_old_tunnels(self):
        """Remove all old reverse tunnels and kill old scrcpy-server processes"""
        # Remove reverse tunnels with timeout
        cmd = [
            self.adb_path,
            "-s", self.serial,
            "reverse",
            "--remove-all"
        ]
        try:
            exec_silent(cmd, capture_output=True, timeout=5)
            print(f"[ScrcpyDevice] [OK] Cleaned up old reverse tunnels for {self.serial}")
        except subprocess.TimeoutExpired:
            print(f"[ScrcpyDevice] [WARN] Timeout cleaning reverse tunnels for {self.serial}")

        # Kill old scrcpy-server processes with timeout
        cmd = [
            self.adb_path,
            "-s", self.serial,
            "shell",
            "pkill -f com.genymobile.scrcpy.Server"
        ]
        try:
            exec_silent(cmd, capture_output=True, timeout=5)
            print(f"[ScrcpyDevice] [OK] Killed old scrcpy-server processes on {self.serial}")
        except subprocess.TimeoutExpired:
            print(f"[ScrcpyDevice] [WARN] Timeout killing old processes for {self.serial}")

        # Give device time to cleanup
        time.sleep(0.5)

    def _find_free_port(self) -> int:
        """Find an available local port"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            s.listen(1)
            port = s.getsockname()[1]
        return port

    def _setup_reverse_tunnel(self, local_port: int, device_socket_name: str):
        """
        Setup ADB reverse tunnel (REVERSE mode)
        Device connects to PC's listening port

        Args:
            local_port: PC port to listen on
            device_socket_name: Device abstract socket name (without localabstract: prefix)
        """
        cmd = [
            self.adb_path,
            "-s", self.serial,
            "reverse",
            f"localabstract:{device_socket_name}",
            f"tcp:{local_port}"
        ]
        result = exec_silent(cmd, capture_output=True, text=True)

        if result.return_code != 0:
            raise RuntimeError(f"adb reverse failed: {result.stderr}")

        print(f"[ScrcpyDevice] [OK] Reverse tunnel: localabstract:{device_socket_name} -> tcp:{local_port}")

        # Store for cleanup
        self._device_socket_name = device_socket_name

    def _setup_port_forward(self, local_port: int, remote: str):
        """
        Setup ADB port forwarding (FORWARD mode - fallback)
        PC connects to device's listening socket

        Args:
            local_port: PC port to forward
            remote: Device socket (e.g., localabstract:scrcpy_XXXXXXXX)
        """
        cmd = [
            self.adb_path,
            "-s", self.serial,
            "forward",
            f"tcp:{local_port}",
            remote
        ]
        exec_silent(cmd, check=True, capture_output=True)

    def _remove_reverse_tunnel(self, device_socket_name: str):
        """Remove ADB reverse tunnel"""
        cmd = [
            self.adb_path,
            "-s", self.serial,
            "reverse",
            "--remove",
            f"localabstract:{device_socket_name}"
        ]
        exec_silent(cmd, capture_output=True)

    def _remove_port_forward(self, local_port: int):
        """Remove ADB port forwarding"""
        cmd = [
            self.adb_path,
            "-s", self.serial,
            "forward",
            "--remove",
            f"tcp:{local_port}"
        ]
        exec_silent(cmd, capture_output=True)

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

        Exact format from official scrcpy (captured from running process):
        app_process / com.genymobile.scrcpy.Server 3.3.3 scid=XXXXXXXX log_level=debug audio=false max_size=720 max_fps=60

        Args:
            scid: 31-bit random session ID

        Reference: scrcpy_source/server/src/main/java/com/genymobile/scrcpy/Options.java
        """
        # scrcpy v3.3.3 server command - EXACT match with official scrcpy
        cmd = [
            "CLASSPATH=/data/local/tmp/scrcpy-server.jar",
            "app_process",
            "/",
            "com.genymobile.scrcpy.Server",
            "3.3.3",  # Version (args[0]) - must match BuildConfig.VERSION_NAME
            f"scid={scid:08x}",
            "log_level=debug",
            "audio=false",  # Audio streaming is currently disabled for web tests
            f"max_size={self.params.max_size}",
            f"max_fps={self.params.max_fps}",
        ]

        if self.params.bit_rate:
            cmd.append(f"video_bit_rate={self.params.bit_rate}")

        if self.params.codec:
            cmd.append(f"video_codec={self.params.codec.value}")

        if not self.params.control:
            cmd.append("control=false")

        if self.params.locked_video_orientation != -1:
            cmd.append(f"locked_video_orientation={self.params.locked_video_orientation}")

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

        # Get additional device info from ADB (scrcpy protocol doesn't provide these)
        dpi = self._get_device_dpi()
        android_version = self._get_android_version()
        sdk_version = self._get_sdk_version()

        # Initialize DeviceInfo with placeholder resolution (will be updated from codec metadata)
        self.info = DeviceInfo(
            serial=self.serial,
            model=device_name,
            resolution=Resolution(width=0, height=0),  # Will be updated
            dpi=dpi,
            android_version=android_version,
            sdk_version=sdk_version
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

    def _get_device_dpi(self) -> int:
        """Get device screen DPI via ADB"""
        cmd = [self.adb_path, "-s", self.serial, "shell", "wm", "density"]
        result = exec_silent(cmd, capture_output=True, text=True, timeout=5)
        if result.return_code == 0:
            # Output format: "Physical density: 440"
            output = result.stdout.strip()
            if ":" in output:
                dpi_str = output.split(":")[-1].strip()
                return int(dpi_str)
        return 480  # Default DPI

    def _get_android_version(self) -> str:
        """Get Android version via ADB"""
        cmd = [self.adb_path, "-s", self.serial, "shell", "getprop", "ro.build.version.release"]
        result = exec_silent(cmd, capture_output=True, text=True, timeout=5)
        if result.return_code == 0:
            return result.stdout.strip()
        return "Unknown"

    def _get_sdk_version(self) -> int:
        """Get Android SDK version via ADB"""
        cmd = [self.adb_path, "-s", self.serial, "shell", "getprop", "ro.build.version.sdk"]
        result = exec_silent(cmd, capture_output=True, text=True, timeout=5)
        if result.return_code == 0:
            return int(result.stdout.strip())
        return 0  # Unknown SDK version
