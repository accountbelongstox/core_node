"""
Scrcpy-server device implementation

This provides a concrete implementation of AndroidDevice that connects
to scrcpy-server for video streaming and device control.
"""

# Standard library imports
import os
import sys
import random
import socket
import struct
import subprocess
import threading
import time
import queue
from typing import Optional, Callable, Tuple, Any
from pathlib import Path

# Local imports
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
from pycore.pyutils.device.android_device import AndroidDevice
from pycore.pyutils.device.device_info import DeviceInfo, Resolution
from pycore.pyutils.device.server_params import ServerParams, VideoCodec

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


# ============================================================================
# ADB COMMAND QUEUE (用队列序列化 ADB 命令，避免 Windows ADB 服务器 bug)
# ============================================================================
# Windows ADB server has a bug where it cannot handle 19+ concurrent device-specific
# commands (even with -s or ANDROID_SERIAL). The solution is to serialize ALL ADB
# commands through a queue, ensuring only ONE adb command runs at a time.
#
# Reference: User requirement - "不要使用线程锁，使用队列" (Don't use thread locks, use queues)
# ============================================================================

# Global ADB command queue
_adb_command_queue: queue.Queue = queue.Queue()
_adb_queue_worker_thread: Optional[threading.Thread] = None
_adb_queue_shutdown = threading.Event()


def _adb_queue_worker():
    """
    Worker thread that processes ADB commands sequentially from the queue.

    This ensures only ONE ADB command runs at a time across all devices,
    avoiding the Windows ADB server bug with 19+ concurrent devices.
    """
    print("[ADB Queue Worker] Started")

    while not _adb_queue_shutdown.is_set():
        try:
            # Get command from queue (timeout 1s to check shutdown periodically)
            item = _adb_command_queue.get(timeout=1.0)

            if item is None:  # Poison pill
                break

            cmd, env, result_event, result_container = item

            try:
                # Execute ADB command (serialized)
                result = subprocess.run(
                    cmd,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=10,
                    check=False
                )
                result_container['result'] = result
                result_container['error'] = None
            except Exception as e:
                result_container['result'] = None
                result_container['error'] = e
            finally:
                # Signal completion
                result_event.set()
                _adb_command_queue.task_done()

        except queue.Empty:
            continue

    print("[ADB Queue Worker] Stopped")


def _ensure_adb_queue_worker():
    """Ensure ADB queue worker thread is running"""
    global _adb_queue_worker_thread

    if _adb_queue_worker_thread is None or not _adb_queue_worker_thread.is_alive():
        _adb_queue_shutdown.clear()
        _adb_queue_worker_thread = threading.Thread(
            target=_adb_queue_worker,
            daemon=True,
            name="ADB-Queue-Worker"
        )
        _adb_queue_worker_thread.start()


def _run_adb_command_via_queue(cmd: list, env: dict, timeout: float = 10.0) -> subprocess.CompletedProcess:
    """
    Run ADB command through the global queue (serialized execution).

    Args:
        cmd: ADB command list (e.g., ['adb', 'reverse', ...])
        env: Environment variables (must include ANDROID_SERIAL)
        timeout: Command timeout (default 10s)

    Returns:
        subprocess.CompletedProcess result

    Raises:
        RuntimeError: If command fails or times out
    """
    _ensure_adb_queue_worker()

    # Create event and result container
    result_event = threading.Event()
    result_container = {}

    # Add command to queue
    _adb_command_queue.put((cmd, env, result_event, result_container))

    # Wait for completion
    if not result_event.wait(timeout=timeout + 5.0):  # Extra 5s for queue processing
        raise RuntimeError(f"ADB command timeout in queue: {' '.join(cmd)}")

    # Check result
    if result_container.get('error'):
        raise result_container['error']

    return result_container['result']


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
        self._device_socket_name: Optional[str] = None  # For tunnel cleanup
        self._tunnel_mode: Optional[str] = None  # "reverse" or "forward"

        # Device info
        self.info: Optional[DeviceInfo] = None

        # Callbacks
        self._on_video_data: Optional[Callable[[bytes], None]] = None

    def start_server(self) -> int:
        """
        Start scrcpy-server on the device using REVERSE tunnel mode with queue serialization

        REVERSE mode (default scrcpy mode):
        - PC listens on a local TCP port
        - Device connects to PC via ADB reverse tunnel
        - Uses: adb reverse localabstract:scrcpy_<SCID> tcp:<LOCAL_PORT>

        Queue serialization:
        - All ADB commands go through a global queue
        - Only ONE ADB command executes at a time
        - Eliminates Windows ADB server bug with 19+ concurrent devices
        - No thread locks, no retry mechanisms needed

        Returns:
            Local video port number

        Raises:
            RuntimeError: If server fails to start

        Reference: scrcpy develop.md, user requirement "使用队列" (use queues)
        """
        # NOTE: Stagger delay removed - queue serialization already prevents contention
        # QtScrcpy achieves 1.8s connection time without artificial delays

        # Cleanup old processes (via queue)
        self._cleanup_old_tunnels()

        # Find free port for tunnel (single tunnel carries both video and control)
        # Official scrcpy pattern: ONE forward tunnel, both sockets connect to same local port
        video_port = self._find_free_port()
        # CRITICAL: In official scrcpy, control socket uses SAME port as video socket
        # Both connections route through single tunnel to device's abstract socket
        # The device accepts multiple sequential connections on same abstract socket
        control_port = video_port  # Same port for both video and control

        # Generate random SCID (Session ID)
        scid = random.randint(0, 0x7FFFFFFF)  # 31-bit random number
        device_socket_name = f"scrcpy_{scid:08x}"  # e.g., scrcpy_1a2b3c4d

        print(f"\n[ScrcpyDevice] Starting scrcpy-server for {self.serial}")
        print(f"[ScrcpyDevice] SCID: {scid:08x}")
        print(f"[ScrcpyDevice] Device socket: localabstract:{device_socket_name}")
        print(f"[ScrcpyDevice] Tunnel port: {video_port} (both video and control use same port)")

        # Setup tunnel with automatic fallback (REVERSE → FORWARD)
        tunnel_mode = self._setup_tunnel(video_port, device_socket_name)

        # Build server command (pass tunnel_mode for proper parameter)
        server_cmd = self._build_server_command(scid, tunnel_mode)

        # Use ANDROID_SERIAL environment variable for adb shell
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        # CRITICAL FIX: Pass command as single string to shell
        # Environment variable CLASSPATH=... must be interpreted by shell, not as separate arg
        shell_command = ' '.join(server_cmd)

        adb_cmd = [
            self.adb_path,
            "-s", self.serial,  # ✅ Explicit -s parameter for Windows reliability
            "shell",
            shell_command  # Pass as single string for proper shell parsing
        ]

        print(f"[ScrcpyDevice] Starting scrcpy-server process...")
        print(f"[ScrcpyDevice] Shell command: {shell_command}")
        print(f"[ScrcpyDevice] ADB command: {' '.join(adb_cmd)}")

        # Start scrcpy-server process
        self._server_process = subprocess.Popen(
            adb_cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE
        )

        # ============================================================================
        # Socket connection handling (different for REVERSE vs FORWARD mode)
        # ============================================================================
        if tunnel_mode == "reverse":
            # REVERSE MODE: PC listens, device connects to us
            print(f"[ScrcpyDevice] REVERSE mode: Creating listening socket on port {video_port}...")
            video_listen_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            video_listen_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            video_listen_socket.bind(('localhost', video_port))
            video_listen_socket.listen(1)
            video_listen_socket.settimeout(10.0)

            # Wait for device to connect (via reverse tunnel)
            print(f"[ScrcpyDevice] Waiting for device to connect...")
            try:
                self._video_socket, _ = video_listen_socket.accept()
                print(f"[ScrcpyDevice] [OK] Video socket connected from device (REVERSE)")
            except socket.timeout:
                video_listen_socket.close()
                raise RuntimeError(f"Timeout waiting for video connection from {self.serial}")
            finally:
                video_listen_socket.close()

        elif tunnel_mode == "forward":
            # FORWARD MODE: Device listens, PC connects to device
            print(f"[ScrcpyDevice] FORWARD mode: Waiting for device to start listening...")

            # ✅ FIXED: Remove fixed sleep, start retrying immediately (QtScrcpy pattern)
            # QtScrcpy achieves 1.8s by immediate retry polling
            # In multi-device scenarios with ADB queue, server startup is delayed
            # Solution: Start polling immediately, allow longer total timeout

            # PC connects to forwarded port
            # Increased retries to accommodate ADB queue delays in multi-device scenarios
            print(f"[ScrcpyDevice] Connecting to forwarded port {video_port}...")
            self._video_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._video_socket.settimeout(10.0)

            max_retries = 150  # Increased from 50 to 150 for multi-device queue delays
            retry_interval = 0.1  # 100ms intervals (official scrcpy standard)
            # Total timeout: 150 × 0.1 = 15 seconds (covers ADB queue delays)
            for retry in range(max_retries):
                try:
                    self._video_socket.connect(('localhost', video_port))
                    print(f"[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)")

                    # ✅ FIXED: In tunnel_forward mode, server SENDS dummy byte, client does NOT read
                    # Official scrcpy: videoSocket.getOutputStream().write(0) on server side
                    # Client just connects and starts reading video stream directly
                    # Previous code incorrectly tried to READ dummy byte, causing connection close

                    break
                except (ConnectionRefusedError, OSError) as e:
                    if retry < max_retries - 1:
                        if retry % 10 == 0 and retry > 0:  # Log every 10th retry to reduce spam
                            print(f"[ScrcpyDevice] Connection refused (retry {retry + 1}/{max_retries}), waiting...")
                        time.sleep(retry_interval)
                    else:
                        raise RuntimeError(f"Failed to connect to device after {max_retries} retries: {e}")

        # Setup control socket (ALWAYS - scrcpy-server v3.3.3 expects 2 sockets)
        # QtScrcpy pattern: Always connect control socket even if control=False
        # The control parameter only disables message processing, not the socket connection
        if control_port > 0:
            print(f"[ScrcpyDevice] Setting up control socket on port {control_port}...")

            if tunnel_mode == "reverse":
                # REVERSE MODE: PC listens, device connects to us
                control_listen_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                control_listen_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                control_listen_socket.bind(('localhost', control_port))
                control_listen_socket.listen(1)
                control_listen_socket.settimeout(10.0)

                try:
                    self._control_socket, _ = control_listen_socket.accept()
                    print(f"[ScrcpyDevice] [OK] Control socket connected from device (REVERSE)")
                except socket.timeout:
                    control_listen_socket.close()
                    raise RuntimeError(f"Timeout waiting for control connection from {self.serial}")
                finally:
                    control_listen_socket.close()

            elif tunnel_mode == "forward":
                # FORWARD MODE: Device listens, PC connects to device
                print(f"[ScrcpyDevice] Connecting to forwarded control port {control_port}...")
                self._control_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self._control_socket.settimeout(10.0)

                max_retries = 50  # Increased from 10 to 50 (official scrcpy standard)
                retry_interval = 0.1  # 100ms intervals (official scrcpy standard)
                for retry in range(max_retries):
                    try:
                        self._control_socket.connect(('localhost', control_port))
                        print(f"[ScrcpyDevice] [OK] Control socket connected to device (FORWARD)")
                        break
                    except (ConnectionRefusedError, OSError) as e:
                        if retry < max_retries - 1:
                            if retry % 10 == 0 and retry > 0:  # Log every 10th retry to reduce spam
                                print(f"[ScrcpyDevice] Control connection refused (retry {retry + 1}/{max_retries}), waiting...")
                            time.sleep(retry_interval)
                        else:
                            raise RuntimeError(f"Failed to connect control socket after {max_retries} retries: {e}")

        # Read device metadata
        print(f"[ScrcpyDevice] Reading device metadata...")
        try:
            self._read_device_metadata()
            print(f"[ScrcpyDevice] [OK] Device: {self.info.model}")
        except Exception as e:
            raise RuntimeError(f"Failed to read device metadata from {self.serial}: {e}")

        # Read codec metadata
        print(f"[ScrcpyDevice] Reading video codec metadata...")
        try:
            self._read_video_codec_metadata()
            print(f"[ScrcpyDevice] [OK] Resolution: {self.info.resolution.width}x{self.info.resolution.height}")
        except Exception as e:
            raise RuntimeError(f"Failed to read video codec metadata from {self.serial}: {e}")

        # Switch to blocking mode for long-running streams
        if self._video_socket:
            self._video_socket.settimeout(None)
        if self._control_socket:
            self._control_socket.settimeout(None)

        print(f"\n[ScrcpyDevice] [OK] Server started successfully for {self.serial}")
        print(f"  Video port: {video_port}")
        print(f"  Resolution: {self.info.resolution.width}x{self.info.resolution.height}")
        print(f"  Model: {self.info.model}\n")

        # Store ports
        self._video_port = video_port
        self._control_port = control_port

        return video_port

    def stop_server(self):
        """Stop scrcpy-server and clean up resources"""
        # Close sockets
        if self._video_socket:
            self._video_socket.close()
            self._video_socket = None

        if self._control_socket:
            self._control_socket.close()
            self._control_socket = None

        # Remove tunnels based on mode used
        if self._device_socket_name and self._tunnel_mode:
            if self._tunnel_mode == "reverse":
                self._remove_reverse_tunnel(self._device_socket_name)
            elif self._tunnel_mode == "forward":
                self._remove_port_forward(self._video_port)
            self._device_socket_name = None
            self._tunnel_mode = None

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
        """Remove all old tunnels (both REVERSE and FORWARD) and kill old scrcpy-server processes"""
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        # Remove reverse tunnels (via queue)
        cmd = [self.adb_path, "-s", self.serial, "reverse", "--remove-all"]
        try:
            result = _run_adb_command_via_queue(cmd, env, timeout=5.0)
            if result.returncode == 0:
                print(f"[ScrcpyDevice] [OK] Cleaned up old reverse tunnels for {self.serial}")
            else:
                print(f"[ScrcpyDevice] [WARN] Failed to cleanup reverse tunnels: {result.stderr}")
        except Exception as e:
            print(f"[ScrcpyDevice] [WARN] Error cleaning reverse tunnels: {e}")

        # Remove forward tunnels (via queue) - critical for fallback support
        cmd = [self.adb_path, "-s", self.serial, "forward", "--remove-all"]
        try:
            result = _run_adb_command_via_queue(cmd, env, timeout=5.0)
            if result.returncode == 0:
                print(f"[ScrcpyDevice] [OK] Cleaned up old forward tunnels for {self.serial}")
            else:
                print(f"[ScrcpyDevice] [WARN] Failed to cleanup forward tunnels: {result.stderr}")
        except Exception as e:
            print(f"[ScrcpyDevice] [WARN] Error cleaning forward tunnels: {e}")

        # Kill old scrcpy-server processes (via queue)
        cmd = [self.adb_path, "-s", self.serial, "shell", "pkill -f com.genymobile.scrcpy.Server"]
        try:
            result = _run_adb_command_via_queue(cmd, env, timeout=5.0)
            if result.returncode == 0:
                print(f"[ScrcpyDevice] [OK] Killed old scrcpy-server processes on {self.serial}")
            else:
                print(f"[ScrcpyDevice] [WARN] No old processes to kill (expected)")
        except Exception as e:
            print(f"[ScrcpyDevice] [WARN] Error killing old processes: {e}")

        # Give device time to cleanup
        time.sleep(0.3)

    def _find_free_port(self) -> int:
        """Find an available local port"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            s.listen(1)
            port = s.getsockname()[1]
        return port

    def _setup_tunnel(self, local_port: int, device_socket_name: str) -> str:
        """
        Setup ADB tunnel with automatic fallback (REVERSE → FORWARD)

        REVERSE mode (preferred):
        - PC listens on port, device connects via tunnel
        - Uses: adb reverse localabstract:scrcpy_SCID tcp:PORT
        - More efficient, but has bug with network devices on Windows

        FORWARD mode (fallback):
        - Device listens, PC connects via tunnel
        - Uses: adb forward tcp:PORT localabstract:scrcpy_SCID
        - More reliable for network devices (IP:PORT format)

        This automatic fallback is the OFFICIAL scrcpy behavior:
        Reference: https://github.com/Genymobile/scrcpy/issues/1071

        Args:
            local_port: PC port number
            device_socket_name: Device abstract socket name (without localabstract: prefix)

        Returns:
            "reverse" or "forward" - the mode that succeeded

        Raises:
            RuntimeError: If both modes fail
        """
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        # ============================================================================
        # TRY REVERSE MODE FIRST (preferred for efficiency)
        # ============================================================================
        try:
            cmd = [
                self.adb_path,
                "-s", self.serial,
                "reverse",
                f"localabstract:{device_socket_name}",
                f"tcp:{local_port}"
            ]

            print(f"[ScrcpyDevice] [TUNNEL] Trying REVERSE mode for {self.serial}...")
            print(f"[ScrcpyDevice] [TUNNEL] Command: {' '.join(cmd)}")

            result = _run_adb_command_via_queue(cmd, env, timeout=10.0)

            if result.returncode == 0:
                print(f"[ScrcpyDevice] [OK] REVERSE tunnel established: localabstract:{device_socket_name} -> tcp:{local_port}")
                self._device_socket_name = device_socket_name
                self._tunnel_mode = "reverse"
                return "reverse"
            else:
                error_msg = result.stderr.strip()
                print(f"[ScrcpyDevice] [WARN] REVERSE mode failed: {error_msg}")
                raise RuntimeError(f"REVERSE failed: {error_msg}")

        except Exception as reverse_error:
            print(f"[ScrcpyDevice] [WARN] REVERSE mode failed for {self.serial}: {reverse_error}")
            print(f"[ScrcpyDevice] → Falling back to FORWARD mode (official scrcpy fallback)...")

            # ========================================================================
            # FALLBACK TO FORWARD MODE (reliable for network devices)
            # ========================================================================
            try:
                cmd = [
                    self.adb_path,
                    "-s", self.serial,
                    "forward",
                    f"tcp:{local_port}",
                    f"localabstract:{device_socket_name}"
                ]

                print(f"[ScrcpyDevice] [TUNNEL] Trying FORWARD mode for {self.serial}...")
                print(f"[ScrcpyDevice] [TUNNEL] Command: {' '.join(cmd)}")

                result = _run_adb_command_via_queue(cmd, env, timeout=10.0)

                if result.returncode == 0:
                    print(f"[ScrcpyDevice] [OK] FORWARD tunnel established: tcp:{local_port} -> localabstract:{device_socket_name}")
                    self._device_socket_name = device_socket_name
                    self._tunnel_mode = "forward"
                    return "forward"
                else:
                    error_msg = result.stderr.strip()
                    raise RuntimeError(f"FORWARD also failed: {error_msg}")

            except Exception as forward_error:
                print(f"[ScrcpyDevice] [ERROR] Both REVERSE and FORWARD modes failed for {self.serial}")
                print(f"[ScrcpyDevice] → REVERSE error: {reverse_error}")
                print(f"[ScrcpyDevice] → FORWARD error: {forward_error}")
                raise RuntimeError(f"Both tunnel modes failed. REVERSE: {reverse_error}, FORWARD: {forward_error}")

    def _setup_port_forward(self, local_port: int, remote: str):
        """
        Setup ADB port forwarding (FORWARD mode - fallback) via queue
        PC connects to device's listening socket

        Args:
            local_port: PC port to forward
            remote: Device socket (e.g., localabstract:scrcpy_XXXXXXXX)
        """
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "forward", f"tcp:{local_port}", remote]
        result = _run_adb_command_via_queue(cmd, env, timeout=10.0)
        if result.returncode != 0:
            raise RuntimeError(f"adb forward failed: {result.stderr}")

    def _remove_reverse_tunnel(self, device_socket_name: str):
        """Remove ADB reverse tunnel via queue"""
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "reverse", "--remove", f"localabstract:{device_socket_name}"]
        _run_adb_command_via_queue(cmd, env, timeout=5.0)

    def _remove_port_forward(self, local_port: int):
        """Remove ADB port forwarding via queue"""
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "forward", "--remove", f"tcp:{local_port}"]
        _run_adb_command_via_queue(cmd, env, timeout=5.0)

    def _connect_to_port(self, port: int) -> socket.socket:
        """Connect to local port with timeout"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10.0)  # 10 second timeout for debugging
        sock.connect(('127.0.0.1', port))
        print(f"[ScrcpyDevice] Socket connected successfully to port {port}")
        return sock

    def _build_server_command(self, scid: int, tunnel_mode: str) -> list:
        """
        Build scrcpy-server shell command for v3.3.3 (supports both REVERSE and FORWARD)

        Args:
            scid: 31-bit random session ID
            tunnel_mode: "reverse" or "forward" - determines tunnel_forward parameter

        Reference: scrcpy_source/server/src/main/java/com/genymobile/scrcpy/Options.java
        """
        # scrcpy v3.3.3 server command - supports both tunnel modes
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

        # CRITICAL: Add tunnel_forward=true in FORWARD mode (QtScrcpy pattern)
        # This tells scrcpy-server to use FORWARD mode protocol
        if tunnel_mode == "forward":
            cmd.append("tunnel_forward=true")

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
        """Get device screen DPI via ADB (via queue)"""
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "shell", "wm", "density"]
        result = _run_adb_command_via_queue(cmd, env, timeout=5.0)
        if result.returncode == 0:
            # Output format: "Physical density: 440"
            output = result.stdout.strip()
            if ":" in output:
                dpi_str = output.split(":")[-1].strip()
                return int(dpi_str)
        return 480  # Default DPI

    def _get_android_version(self) -> str:
        """Get Android version via ADB (via queue)"""
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "shell", "getprop", "ro.build.version.release"]
        result = _run_adb_command_via_queue(cmd, env, timeout=5.0)
        if result.returncode == 0:
            return result.stdout.strip()
        return "Unknown"

    def _get_sdk_version(self) -> int:
        """Get Android SDK version via ADB (via queue)"""
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "shell", "getprop", "ro.build.version.sdk"]
        result = _run_adb_command_via_queue(cmd, env, timeout=5.0)
        if result.returncode == 0:
            return int(result.stdout.strip())
        return 0  # Unknown SDK version
