"""
Scrcpy-server device implementation

This provides a concrete implementation of AndroidDevice that connects
to scrcpy-server for video streaming and device control.
"""

import socket
import struct
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
import threading
import time
from typing import Optional, Callable
from pathlib import Path

from .android_device import AndroidDevice
from .device_info import DeviceInfo, Resolution
from .server_params import ServerParams, VideoCodec
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
        try:
            # 1. Find available ports
            self._video_port = self._find_free_port()
            self._control_port = self._find_free_port()

            # 2. Setup port forwarding
            self._setup_port_forward(self._video_port, "localabstract:scrcpy_video")
            self._setup_port_forward(self._control_port, "localabstract:scrcpy_control")

            # 3. Build scrcpy-server command
            server_cmd = self._build_server_command()

            # 4. Start scrcpy-server process
            adb_cmd = [
                self.adb_path,
                "-s", self.serial,
                "shell",
                *server_cmd
            ]

            self._server_process = subprocess.Popen(
                adb_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE
            )

            # 5. Wait for server to start (give it 2 seconds)
            time.sleep(2)

            # 6. Connect to video socket
            self._video_socket = self._connect_to_port(self._video_port)

            # 7. Connect to control socket
            self._control_socket = self._connect_to_port(self._control_port)

            # 8. Read device info from video socket (first frame contains metadata)
            self._read_device_info()

            print(f"[ScrcpyDevice] Server started for {self.serial}")
            print(f"  Video port: {self._video_port}")
            print(f"  Control port: {self._control_port}")

            return self._video_port

        except Exception as e:
            self.stop_server()
            raise RuntimeError(f"Failed to start scrcpy-server: {e}")

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
        Read one video frame from socket

        Returns:
            Frame data (H.264 NAL unit) or None if connection closed
        """
        try:
            # Read frame length (4 bytes)
            length_bytes = self._recv_exactly(self._video_socket, 4)
            if not length_bytes:
                return None

            frame_length = struct.unpack(">I", length_bytes)[0]

            # Read frame data
            frame_data = self._recv_exactly(self._video_socket, frame_length)
            return frame_data

        except Exception as e:
            print(f"[ScrcpyDevice] Error reading video frame: {e}")
            return None

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
        exec_silent(cmd, check=True, capture_output=True)

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
        """Connect to local port"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect(('127.0.0.1', port))
        return sock

    def _build_server_command(self) -> list:
        """Build scrcpy-server shell command"""
        # Basic scrcpy-server command structure
        # This is a simplified version - real scrcpy has many more options
        cmd = [
            "CLASSPATH=/data/local/tmp/scrcpy-server.jar",
            "app_process",
            "/",
            "com.genymobile.scrcpy.Server",
            "2.0",  # scrcpy version
            f"max_size={self.params.max_size}",
            f"bit_rate={self.params.bit_rate}",
            f"max_fps={self.params.max_fps}",
            f"codec={self.params.codec.value}",
            "tunnel_forward=true",
            f"control={str(self.params.control).lower()}",
        ]
        return cmd

    def _read_device_info(self):
        """
        Read device metadata from video socket

        Scrcpy sends device info in the first packet:
        - Device name (64 bytes)
        - Width (2 bytes)
        - Height (2 bytes)
        """
        try:
            # Read device name (64 bytes, null-terminated string)
            name_bytes = self._recv_exactly(self._video_socket, 64)
            device_name = name_bytes.split(b'\x00')[0].decode('utf-8')

            # Read width (2 bytes, big-endian unsigned short)
            width_bytes = self._recv_exactly(self._video_socket, 2)
            width = struct.unpack(">H", width_bytes)[0]

            # Read height (2 bytes, big-endian unsigned short)
            height_bytes = self._recv_exactly(self._video_socket, 2)
            height = struct.unpack(">H", height_bytes)[0]

            # Create DeviceInfo
            self.info = DeviceInfo(
                serial=self.serial,
                model=device_name,
                android_version="Unknown",  # Not provided by scrcpy
                resolution=Resolution(width=width, height=height),
                density=0,  # Not provided by scrcpy
                manufacturer="Unknown"  # Not provided by scrcpy
            )

            print(f"[ScrcpyDevice] Device info: {device_name} ({width}x{height})")

        except Exception as e:
            print(f"[ScrcpyDevice] Failed to read device info: {e}")
            # Create minimal device info
            self.info = DeviceInfo(
                serial=self.serial,
                model="Unknown",
                android_version="Unknown",
                resolution=Resolution(width=1080, height=1920),
                density=0,
                manufacturer="Unknown"
            )

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
