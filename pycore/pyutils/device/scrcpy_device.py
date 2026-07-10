"""
Scrcpy-server device implementation

Concrete AndroidDevice that connects to scrcpy-server for video streaming and
device control.

Architecture (see SEAMS in pycore/pyutils/device/):
- adb_command_queue.py : module-global serialized ADB-command executor. ALL adb
  invocations from this module go through _run_adb_command_via_queue to avoid
  the Windows ADB server bug with 19+ concurrent device-specific commands.
- tunnel_mode.py       : ReverseTunnelMode / ForwardTunnelMode / TunnelModeFactory.
  This module delegates adb reverse/forward command building and per-mode socket
  creation / dummy-byte / server-parameter logic to those classes.
- port_pool.py         : async port pool (not reused here - see _find_free_port TODO).
- adb_manager.py       : ADBManager (not reused here - see _get_* / _remove_* TODOs;
  ADBManager.execute bypasses the serialization queue).
"""

# Standard library imports
import os
import random
import select
import socket
import struct
import subprocess
import threading
import time
from typing import Optional, Callable

# Local imports
from pycore.pyutils.device.android_device import AndroidDevice
from pycore.pyutils.device.device_info import DeviceInfo, Resolution
from pycore.pyutils.device.server_params import ServerParams
from pycore.pyutils.device.adb_command_queue import _run_adb_command_via_queue
from pycore.pyutils.device.tunnel_mode import (
    TunnelMode,
    TunnelModeFactory,
    TunnelConfig,
)


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
        - All ADB commands go through a global queue (adb_command_queue)
        - Only ONE ADB command executes at a time
        - Eliminates Windows ADB server bug with 19+ concurrent devices
        - No thread locks, no retry mechanisms needed

        Returns:
            Local video port number

        Raises:
            RuntimeError: If server fails to start

        Reference: scrcpy develop.md, user requirement to use queues for serialization
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
        scid_hex = f"{scid:08x}"  # e.g., "1a2b3c4d"
        # CRITICAL: Both device socket name AND scid parameter use hex format!
        # Server parses scid with Integer.parseInt(value, 0x10) - expects hex string!
        device_socket_name = f"scrcpy_{scid_hex}"  # e.g., scrcpy_1a2b3c4d

        print(f"\n[ScrcpyDevice] Starting scrcpy-server for {self.serial}")
        print(f"[ScrcpyDevice] SCID: {scid_hex} (hex), {scid} (decimal)")
        print(f"[ScrcpyDevice] Device socket: localabstract:{device_socket_name}")
        print(f"[ScrcpyDevice] Tunnel port: {video_port} (both video and control use same port)")

        # Tunnel configuration shared by setup + socket creation (delegated to tunnel_mode)
        tunnel_config = TunnelConfig(
            device_serial=self.serial,
            scid_hex=scid_hex,
            local_port=video_port,
            device_socket_name=device_socket_name,
        )

        # Setup tunnel with automatic fallback (REVERSE -> FORWARD) via TunnelModeFactory
        mode = self._setup_tunnel(tunnel_config)

        # Build server command (mode decides tunnel_forward parameter)
        server_cmd = self._build_server_command(scid_hex, mode)

        # Use ANDROID_SERIAL environment variable for adb shell
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial
        # CRITICAL: Disable Git Bash path conversion for CLASSPATH
        # Without this, /data/local/tmp becomes D:/applications/Git/data/local/tmp
        # This affects CLASSPATH variable even inside adb shell commands
        env['MSYS_NO_PATHCONV'] = '1'

        # CRITICAL FIX: Pass command as single string to shell
        # Environment variable CLASSPATH=... must be interpreted by shell, not as separate arg
        shell_command = ' '.join(server_cmd)

        adb_cmd = [
            self.adb_path,
            "-s", self.serial,  # Must use -s with 19 devices
            "shell",
            shell_command  # Pass as single string for proper shell parsing
        ]

        print(f"[ScrcpyDevice] Starting scrcpy-server process...")
        print(f"[ScrcpyDevice] Shell command: {shell_command}")
        print(f"[ScrcpyDevice] ADB command: {' '.join(adb_cmd)}")

        # Start scrcpy-server process
        # CRITICAL: stdout/stderr MUST be consumed by background threads to prevent PIPE deadlock!
        # Server with log_level=debug produces large output. If PIPE is used without reading,
        # the buffer (~64KB) fills up, causing server's write() to block.
        # Background threads continuously consume output, preventing deadlock while capturing errors.
        # Reference: https://docs.python.org/3/library/subprocess.html#subprocess.Popen
        self._server_process = subprocess.Popen(
            adb_cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            text=True,
            bufsize=1  # Line buffered
        )

        # Background threads to consume Server output (prevent PIPE deadlock)
        def _read_server_output(pipe, prefix):
            print(f"[Server-{self.serial}] [{prefix}] Thread started")
            try:
                for line in pipe:
                    line = line.rstrip()
                    if line:  # Only print non-empty lines
                        print(f"[Server-{self.serial}] [{prefix}] {line}")
                print(f"[Server-{self.serial}] [{prefix}] Thread finished (EOF)")
            except Exception as e:
                print(f"[Server-{self.serial}] [{prefix}] Thread error: {e}")

        self._server_stdout_thread = threading.Thread(
            target=_read_server_output,
            args=(self._server_process.stdout, "OUT"),
            daemon=True
        )
        self._server_stderr_thread = threading.Thread(
            target=_read_server_output,
            args=(self._server_process.stderr, "ERR"),
            daemon=True
        )
        self._server_stdout_thread.start()
        self._server_stderr_thread.start()

        print(f"[ScrcpyDevice] Server process started (PID: {self._server_process.pid})")

        # ============================================================================
        # Socket connection handling (delegated to TunnelMode.create_client_socket)
        # ============================================================================
        mode_name = mode.get_mode_name()
        if mode_name == "REVERSE":
            # REVERSE MODE: PC listens, device connects to us
            print(f"[ScrcpyDevice] REVERSE mode: Creating listening socket on port {video_port}...")
            video_listen_socket = mode.create_client_socket(tunnel_config, 10.0)

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

        elif mode_name == "FORWARD":
            # FORWARD MODE: Device listens, PC connects to device
            print(f"[ScrcpyDevice] FORWARD mode: Waiting for device to start listening...")

            # CRITICAL: Give server time to fully initialize before connecting
            # Server needs to: load classes -> create LocalServerSocket -> bind to socket name
            # Without this delay, PC may connect before server is ready to accept
            time.sleep(3.0)  # 3 second delay - allows server initialization (Android 7.0 is slow)

            # PC connects to forwarded port (mode.create_client_socket returns unconnected socket)
            print(f"[ScrcpyDevice] Connecting to forwarded port {video_port}...")
            self._video_socket = mode.create_client_socket(tunnel_config, 10.0)

            max_retries = 150  # Increased from 50 to 150 for multi-device queue delays
            retry_interval = 0.1  # 100ms intervals (official scrcpy standard)
            # Total timeout: 150 x 0.1 = 15 seconds (covers ADB queue delays)
            for retry in range(max_retries):
                try:
                    self._video_socket.connect(('localhost', video_port))
                    print(f"[ScrcpyDevice] [OK] Video socket connected to device (FORWARD)")
                    break
                except (ConnectionRefusedError, OSError) as e:
                    if retry < max_retries - 1:
                        if retry % 10 == 0 and retry > 0:  # Log every 10th retry to reduce spam
                            print(f"[ScrcpyDevice] Connection refused (retry {retry + 1}/{max_retries}), waiting...")
                        time.sleep(retry_interval)
                    else:
                        raise RuntimeError(f"Failed to connect to device after {max_retries} retries: {e}")

            # CRITICAL: Read dummy byte IMMEDIATELY after connecting first socket (FORWARD mode only)
            # Based on official scrcpy client: app/src/server.c:467-483 connect_and_read_byte()
            # Server sends dummy byte on FIRST socket only (DesktopConnection.java:68-71)
            # Must read it NOW, before connecting other sockets, to detect connection errors
            if mode.should_send_dummy_byte():
                print(f"[ScrcpyDevice] Reading dummy byte from first socket (FORWARD mode)...")
                ready_sockets, _, _ = select.select([self._video_socket], [], [], 5.0)

                if not ready_sockets:
                    print(f"[ScrcpyDevice] [ERROR] Timeout waiting for dummy byte!")
                    raise RuntimeError("Timeout waiting for dummy byte from first socket (FORWARD mode)")

                dummy_byte = self._video_socket.recv(1)
                if not dummy_byte:
                    print(f"[ScrcpyDevice] [ERROR] Connection closed while reading dummy byte!")
                    raise RuntimeError("Connection closed while reading dummy byte from first socket (FORWARD mode)")

                print(f"[ScrcpyDevice] [OK] Dummy byte received: {dummy_byte.hex()}")
                print(f"[ScrcpyDevice] First socket ready, now connecting control socket...")

        # Setup control socket (ALWAYS - scrcpy-server v3.3.3 expects 2 sockets)
        # QtScrcpy pattern: Always connect control socket even if control=False
        # The control parameter only disables message processing, not the socket connection
        if control_port > 0:
            print(f"[ScrcpyDevice] Setting up control socket on port {control_port}...")

            if mode_name == "REVERSE":
                # REVERSE MODE: PC listens, device connects to us
                control_listen_socket = mode.create_client_socket(tunnel_config, 10.0)

                try:
                    self._control_socket, _ = control_listen_socket.accept()
                    print(f"[ScrcpyDevice] [OK] Control socket connected from device (REVERSE)")
                except socket.timeout:
                    control_listen_socket.close()
                    raise RuntimeError(f"Timeout waiting for control connection from {self.serial}")
                finally:
                    control_listen_socket.close()

            elif mode_name == "FORWARD":
                # FORWARD MODE: Device listens, PC connects to device
                print(f"[ScrcpyDevice] Connecting to forwarded control port {control_port}...")
                self._control_socket = mode.create_client_socket(tunnel_config, 10.0)

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
        # Note: Dummy byte was already read after connecting first socket in FORWARD mode
        print(f"[ScrcpyDevice] Reading device metadata...")
        self._read_device_metadata()
        print(f"[ScrcpyDevice] [OK] Device: {self.info.model}")

        # Read codec metadata
        print(f"[ScrcpyDevice] Reading video codec metadata...")
        self._read_video_codec_metadata()
        print(f"[ScrcpyDevice] [OK] Resolution: {self.info.resolution.width}x{self.info.resolution.height}")

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

    def read_video_frame(self) -> Optional[dict]:
        """
        Read one video frame from socket according to scrcpy protocol

        Frame header format (12 bytes):
        - PTS (8 bytes, u64): bits 63-62 contain flags (config|keyframe), bits 61-0 contain PTS
        - packet_size (4 bytes, u32): size of the raw packet

        Returns:
            Dict with frame data/pts/flags or None if connection closed

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
        cmd = [self.adb_path, "-s", self.serial, "reverse", "--remove-all"]  # Must use -s with 19 devices
        try:
            result = _run_adb_command_via_queue(cmd, env, timeout=5.0)
            if result.returncode == 0:
                print(f"[ScrcpyDevice] [OK] Cleaned up old reverse tunnels for {self.serial}")
            else:
                print(f"[ScrcpyDevice] [WARN] Failed to cleanup reverse tunnels: {result.stderr}")
        except Exception as e:
            print(f"[ScrcpyDevice] [WARN] Error cleaning reverse tunnels: {e}")

        # Remove forward tunnels (via queue) - critical for fallback support
        cmd = [self.adb_path, "-s", self.serial, "forward", "--remove-all"]  # Must use -s with 19 devices
        try:
            result = _run_adb_command_via_queue(cmd, env, timeout=5.0)
            if result.returncode == 0:
                print(f"[ScrcpyDevice] [OK] Cleaned up old forward tunnels for {self.serial}")
            else:
                print(f"[ScrcpyDevice] [WARN] Failed to cleanup forward tunnels: {result.stderr}")
        except Exception as e:
            print(f"[ScrcpyDevice] [WARN] Error cleaning forward tunnels: {e}")

        # Kill old scrcpy-server processes (via queue)
        cmd = [self.adb_path, "-s", self.serial, "shell", "pkill -f com.genymobile.scrcpy.Server"]  # Must use -s with 19 devices
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
        """
        Find an available local port.

        TODO (reuse-first): pycore/pyutils/device/port_pool.py (port_pool) is the
        intended canonical port allocator, but PortPool.allocate() is async and
        serial-tracked (fixed range starting at 27183), which does not fit this
        synchronous start_server() context (no event loop available; uses OS
        ephemeral ports). Reuse port_pool once a synchronous allocate() exists.
        """
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            s.listen(1)
            port = s.getsockname()[1]
        return port

    def _setup_tunnel(self, config: TunnelConfig) -> TunnelMode:
        """
        Setup ADB tunnel with automatic fallback (REVERSE -> FORWARD).

        Uses TunnelModeFactory to build the adb reverse/forward command for each
        mode (preferring REVERSE, falling back to FORWARD - the official scrcpy
        behavior, see https://github.com/Genymobile/scrcpy/issues/1071). Each adb
        command is routed through the serialized ADB queue (adb_command_queue) to
        avoid the Windows ADB 19-device concurrency bug.

        Args:
            config: Tunnel configuration (serial, local port, device socket name)

        Returns:
            The TunnelMode that succeeded.

        Raises:
            RuntimeError: If all modes fail.
        """
        env = os.environ.copy()
        # CRITICAL: Set ANDROID_SERIAL environment variable
        # This is the CORRECT way to specify device for ADB commands
        # The -s parameter is NOT enough when multiple devices are connected
        env['ANDROID_SERIAL'] = self.serial

        last_error: Optional[Exception] = None
        for mode in TunnelModeFactory.get_all_modes_by_priority():
            mode_name = mode.get_mode_name()
            cmd = mode.get_adb_tunnel_command(self.adb_path, config)

            print(f"[ScrcpyDevice] [TUNNEL] Trying {mode_name} mode for {self.serial}...")
            print(f"[ScrcpyDevice] [TUNNEL] Command: {' '.join(cmd)}")
            print(f"[ScrcpyDevice] [TUNNEL] ANDROID_SERIAL={self.serial}")

            try:
                result = _run_adb_command_via_queue(cmd, env, timeout=10.0)
            except Exception as e:
                last_error = e
                print(f"[ScrcpyDevice] [WARN] {mode_name} mode failed for {self.serial}: {e}")
                print(f"[ScrcpyDevice] -> Trying next tunnel mode...")
                continue

            if result.returncode == 0:
                print(f"[ScrcpyDevice] [OK] {mode_name} tunnel established: "
                      f"localabstract:{config.device_socket_name} <-> tcp:{config.local_port}")
                self._device_socket_name = config.device_socket_name
                self._tunnel_mode = mode_name.lower()
                return mode

            error_msg = result.stderr.strip()
            last_error = RuntimeError(f"{mode_name} failed: {error_msg}")
            print(f"[ScrcpyDevice] [WARN] {mode_name} mode failed: {error_msg}")
            print(f"[ScrcpyDevice] -> Trying next tunnel mode...")

        raise RuntimeError(
            f"All tunnel modes failed for {self.serial}. Last error: {last_error}"
        )

    def _remove_reverse_tunnel(self, device_socket_name: str):
        """
        Remove ADB reverse tunnel via queue.

        TODO (reuse-first): TunnelMode cleanup could be delegated to tunnel_mode.py
        (ReverseTunnelMode has no remove helper) and/or ADBManager. Kept local
        because ADBManager.execute bypasses the serialization queue, which would
        re-introduce the Windows ADB 19-device concurrency bug during concurrent
        stop_server() calls.
        """
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "reverse", "--remove", f"localabstract:{device_socket_name}"]
        _run_adb_command_via_queue(cmd, env, timeout=5.0)

    def _remove_port_forward(self, local_port: int):
        """
        Remove ADB port forwarding via queue.

        TODO (reuse-first): ADBManager.forward_remove(serial, local_port, adb_path)
        exists but routes through ADBManager.execute (exec_silent) which bypasses
        the serialization queue. Kept local + queue-based to preserve the
        Windows ADB 19-device concurrency invariant during concurrent stop_server().
        """
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "forward", "--remove", f"tcp:{local_port}"]
        _run_adb_command_via_queue(cmd, env, timeout=5.0)

    def _build_server_command(self, scid_hex: str, mode: TunnelMode) -> list:
        """
        Build scrcpy-server shell command for v3.3.4 (supports both REVERSE and FORWARD)

        Args:
            scid_hex: Session ID in 8-digit hex format (e.g., "1a2b3c4d")
            mode: TunnelMode - decides the tunnel_forward server parameter

        Reference: https://github.com/genymobile/scrcpy/blob/master/doc/develop.md
        """
        # Official scrcpy v3.3.4 server command format (Android 7.0 compatible):
        # cd /data/local/tmp && CLASSPATH=scrcpy-server app_process . com.genymobile.scrcpy.Server 3.3.4 ...
        # CRITICAL: Android 7.0 ClassLoader requirements (TECHNICAL_SPECIFICATION.md line 366-376):
        # 1. MUST cd to /data/local/tmp first
        # 2. CLASSPATH MUST be relative path (scrcpy-server, not /data/local/tmp/scrcpy-server)
        # 3. app_process MUST use "." (current dir), not "/" (root dir)
        # 4. File MUST be pushed WITHOUT .jar extension (scrcpy-server, not scrcpy-server.jar)
        # 5. Version MUST match jar file version (scrcpy-server.jar in resources is v3.3.4)
        # 6. SCID MUST be hex string (server parses with Integer.parseInt(value, 0x10))
        cmd = [
            "cd", "/data/local/tmp", "&&",  # CRITICAL: cd to /data/local/tmp first
            "CLASSPATH=scrcpy-server",       # CRITICAL: relative path, NO .jar extension!
            "app_process",
            ".",                              # CRITICAL: current directory, not /
            "com.genymobile.scrcpy.Server",
            "3.3.4",  # Version (args[0]) - must match BuildConfig.VERSION_NAME in scrcpy-server.jar
            f"scid={scid_hex}",  # CRITICAL: Must be HEX string (e.g., "1a2b3c4d"), not decimal!
            "log_level=debug",
            "audio=false",  # CRITICAL: Must disable audio since we don't connect audio socket
            f"max_size={self.params.max_size}",  # Video resolution limit
        ]

        # NOTE: 'control' is NOT a valid server parameter (TECHNICAL_SPECIFICATION.md line 560-562)
        # Control functionality is handled by connecting/not connecting the control socket
        # Server does not have a control=false parameter - it will cause "Aborted" crash

        if self.params.locked_video_orientation != -1:
            cmd.append(f"locked_video_orientation={self.params.locked_video_orientation}")

        # CRITICAL: tunnel_forward parameter controls server socket behavior
        # Based on official scrcpy source code analysis (DesktopConnection.java:64-101):
        #   - tunnel_forward=true  -> Server creates LocalServerSocket and WAITS (FORWARD mode)
        #   - tunnel_forward=false -> Server CONNECTS to socket as client (REVERSE mode, default)
        # Delegated to the TunnelMode's get_server_parameter() (returns None for REVERSE,
        # "tunnel_forward=true" for FORWARD).
        server_param = mode.get_server_parameter()
        if server_param:
            cmd.append(server_param)

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
        # Read 64-byte device name from socket (both REVERSE and FORWARD modes)
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
        """
        Get device screen DPI via ADB (via queue).

        TODO (reuse-first): ADBManager lacks a get_dpi() helper (only wm size via
        get_screen_resolution). Kept local + queue-based because ADBManager.execute
        bypasses the serialization queue (Windows ADB 19-device invariant).
        """
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "shell", "wm", "density"]
        result = _run_adb_command_via_queue(cmd, env, timeout=20.0)
        if result.returncode == 0:
            # Output format: "Physical density: 440"
            output = result.stdout.strip()
            if ":" in output:
                dpi_str = output.split(":")[-1].strip()
                return int(dpi_str)
        return 480  # Default DPI

    def _get_android_version(self) -> str:
        """
        Get Android version via ADB (via queue).

        TODO (reuse-first): ADBManager.get_android_version(serial, adb_path) exists
        but routes through ADBManager.execute (exec_silent) which bypasses the
        serialization queue. Kept local + queue-based to preserve the Windows ADB
        19-device concurrency invariant during concurrent start_server() calls.
        """
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "shell", "getprop", "ro.build.version.release"]
        result = _run_adb_command_via_queue(cmd, env, timeout=20.0)
        if result.returncode == 0:
            return result.stdout.strip()
        return "Unknown"

    def _get_sdk_version(self) -> int:
        """
        Get Android SDK version via ADB (via queue).

        TODO (reuse-first): ADBManager.get_prop(serial, "ro.build.version.sdk")
        exists but routes through ADBManager.execute (exec_silent) which bypasses
        the serialization queue. Kept local + queue-based to preserve the Windows
        ADB 19-device concurrency invariant during concurrent start_server() calls.
        """
        env = os.environ.copy()
        env['ANDROID_SERIAL'] = self.serial

        cmd = [self.adb_path, "-s", self.serial, "shell", "getprop", "ro.build.version.sdk"]
        result = _run_adb_command_via_queue(cmd, env, timeout=20.0)
        if result.returncode == 0:
            return int(result.stdout.strip())
        return 0  # Unknown SDK version
