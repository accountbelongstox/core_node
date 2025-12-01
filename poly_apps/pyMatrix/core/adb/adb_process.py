"""
ADB Process Wrapper

Reference: SmartMatrixCore/src/adb/adbprocess.cpp
"""

import os
import sys
import subprocess
import re
from pathlib import Path
from typing import List, Optional
from PyQt6.QtCore import QObject, pyqtSignal, QThread

from .adb_types import AdbExecResult, AdbDeviceInfo


# Global ADB path
g_adb_path: str = ""


class AdbProcess(QObject):
    """
    ADB process wrapper class
    Reference: adbprocess.cpp
    """
    # Signals
    adb_process_result = pyqtSignal(AdbExecResult, str)  # (result, output)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._process: Optional[subprocess.Popen] = None
        self._stdout: str = ""
        self._stderr: str = ""
        self._running: bool = False

    @staticmethod
    def set_adb_path(adb_path: str):
        """
        Set ADB path
        Reference: adbprocess.cpp:29-32
        """
        global g_adb_path
        g_adb_path = adb_path

    @staticmethod
    def get_adb_path() -> str:
        """
        Get ADB path with fallback search
        Reference: adbprocessimpl.cpp:28-54

        Search order:
        1. Environment variable: PyMatrix_ADB_PATH
        2. Global variable: g_adb_path
        3. Application directory: adb/adb(.exe)
        4. System PATH
        """
        global g_adb_path

        # Return cached path
        if g_adb_path:
            return g_adb_path

        # Build potential paths list
        potential_paths: List[str] = []

        # 1. Environment variable
        env_path = os.getenv('PyMatrix_ADB_PATH', '')
        if env_path:
            potential_paths.append(env_path)

        # 2. Application directory
        if getattr(sys, 'frozen', False):
            # PyInstaller bundle
            app_dir = Path(sys._MEIPASS)
        else:
            # Development
            app_dir = Path(__file__).parent.parent.parent / 'resources'

        adb_name = 'adb.exe' if sys.platform == 'win32' else 'adb'

        # Platform-specific paths
        if sys.platform == 'win32':
            potential_paths.append(str(app_dir / 'adb' / 'windows' / adb_name))
        elif sys.platform == 'darwin':
            potential_paths.append(str(app_dir / 'adb' / 'macos' / adb_name))
        else:  # Linux
            potential_paths.append(str(app_dir / 'adb' / 'linux' / adb_name))

        # 3. System PATH
        potential_paths.append(adb_name)  # Will search in PATH

        # Find first valid path
        for path in potential_paths:
            if Path(path).is_file() or AdbProcess._is_in_path(path):
                g_adb_path = path
                return g_adb_path

        # Fallback to 'adb' (hope it's in PATH)
        g_adb_path = adb_name
        return g_adb_path

    @staticmethod
    def _is_in_path(command: str) -> bool:
        """Check if command exists in system PATH"""
        try:
            subprocess.run([command, 'version'],
                         stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE,
                         check=False)
            return True
        except (FileNotFoundError, PermissionError):
            return False

    def execute(self, serial: str, args: List[str]):
        """
        Execute ADB command
        Reference: adbprocess.cpp:34-37

        Args:
            serial: Device serial number (empty for no device selection)
            args: ADB command arguments
        """
        if self._running:
            self.kill()

        cmd = [self.get_adb_path()]

        # Add serial if specified
        if serial:
            cmd.extend(["-s", serial])

        cmd.extend(args)

        try:
            self._process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            self._running = True

            # Read output in thread to avoid blocking
            self._read_output()

        except FileNotFoundError:
            self.adb_process_result.emit(AdbExecResult.ERROR_MISSING_BINARY,
                                        f"ADB not found: {self.get_adb_path()}")
        except Exception as e:
            self.adb_process_result.emit(AdbExecResult.ERROR_START, str(e))

    def _read_output(self):
        """Read process output"""
        if not self._process:
            return

        try:
            # Wait for process to complete
            self._stdout, self._stderr = self._process.communicate(timeout=30)

            exit_code = self._process.returncode
            self._running = False

            if exit_code == 0:
                self.adb_process_result.emit(AdbExecResult.SUCCESS_EXEC, self._stdout)
            else:
                self.adb_process_result.emit(AdbExecResult.ERROR_EXEC,
                                           self._stderr or self._stdout)
        except subprocess.TimeoutExpired:
            self.kill()
            self.adb_process_result.emit(AdbExecResult.ERROR_EXEC, "Timeout")
        except Exception as e:
            self.adb_process_result.emit(AdbExecResult.ERROR_EXEC, str(e))

    def is_running(self) -> bool:
        """Check if process is running"""
        return self._running and self._process is not None

    def kill(self):
        """Kill running process"""
        if self._process:
            try:
                self._process.kill()
                self._process.wait(timeout=3)
            except:
                pass
            finally:
                self._process = None
                self._running = False

    def get_stdout(self) -> str:
        """Get standard output"""
        return self._stdout

    def get_stderr(self) -> str:
        """Get standard error"""
        return self._stderr

    # === High-level ADB commands ===

    def get_devices(self) -> List[AdbDeviceInfo]:
        """
        Get connected devices list
        Reference: adbprocessimpl.cpp:131-147

        Command: adb devices
        Output format:
            List of devices attached
            ABC123DEF456    device
            GHI789JKL012    offline
        """
        args = ["devices"]
        self.execute("", args)

        # Parse will be done in signal handler
        # For synchronous version, see get_devices_sync()
        return []

    def get_devices_sync(self) -> List[AdbDeviceInfo]:
        """Synchronous version of get_devices"""
        cmd = [self.get_adb_path(), "devices"]

        try:
            result = subprocess.run(cmd,
                                  capture_output=True,
                                  text=True,
                                  timeout=5,
                                  check=False)

            return self._parse_devices_output(result.stdout)
        except Exception as e:
            print(f"Error getting devices: {e}")
            return []

    def _parse_devices_output(self, output: str) -> List[AdbDeviceInfo]:
        """
        Parse 'adb devices' output
        Reference: adbprocessimpl.cpp:131-147
        """
        devices: List[AdbDeviceInfo] = []

        lines = output.strip().split('\n')
        for line in lines:
            # Skip header and empty lines
            if not line or line.startswith('List of devices'):
                continue

            # Parse: "SERIAL\tSTATE"
            parts = re.split(r'\s+', line.strip(), maxsplit=1)
            if len(parts) >= 2:
                serial, state = parts[0], parts[1]
                devices.append(AdbDeviceInfo(serial=serial, state=state))

        return devices

    def forward(self, serial: str, local_port: int, device_socket_name: str):
        """
        Port forwarding
        Reference: adbprocessimpl.cpp:198-205

        Command: adb -s <serial> forward tcp:<localPort> localabstract:<socketName>
        """
        args = ["forward", f"tcp:{local_port}", f"localabstract:{device_socket_name}"]
        self.execute(serial, args)

    def forward_remove(self, serial: str, local_port: int):
        """Remove port forwarding"""
        args = ["forward", "--remove", f"tcp:{local_port}"]
        self.execute(serial, args)

    def reverse(self, serial: str, device_socket_name: str, local_port: int):
        """
        Reverse tunneling
        Reference: adbprocessimpl.cpp:216-223

        Command: adb -s <serial> reverse localabstract:<socketName> tcp:<localPort>
        """
        args = ["reverse", f"localabstract:{device_socket_name}", f"tcp:{local_port}"]
        self.execute(serial, args)

    def reverse_remove(self, serial: str, device_socket_name: str):
        """Remove reverse tunneling"""
        args = ["reverse", "--remove", f"localabstract:{device_socket_name}"]
        self.execute(serial, args)

    def push(self, serial: str, local: str, remote: str):
        """
        Push file to device
        Reference: adbprocessimpl.cpp:234-241

        Command: adb -s <serial> push <local> <remote>
        """
        args = ["push", local, remote]
        self.execute(serial, args)

    def install(self, serial: str, apk_path: str):
        """
        Install APK
        Reference: adbprocessimpl.cpp:243-250

        Command: adb -s <serial> install -r <apk_path>
        """
        args = ["install", "-r", apk_path]
        self.execute(serial, args)

    def set_show_touches_enabled(self, serial: str, enabled: bool):
        """
        Enable/disable touch indicators
        Reference: adbprocessimpl.cpp:119-129

        Command: adb -s <serial> shell settings put system show_touches <0|1>
        """
        value = "1" if enabled else "0"
        args = ["shell", "settings", "put", "system", "show_touches", value]
        self.execute(serial, args)

    def get_device_ip(self, serial: str):
        """
        Get device IP address
        Reference: adbprocessimpl.cpp:168-186

        Command: adb -s <serial> shell ip addr show wlan0
        """
        args = ["shell", "ip", "addr", "show", "wlan0"]
        self.execute(serial, args)

    def tcpip(self, serial: str, port: int = 5555):
        """
        Enable TCP/IP mode

        Command: adb -s <serial> tcpip 5555
        """
        args = ["tcpip", str(port)]
        self.execute(serial, args)

    def connect(self, ip_address: str, port: int = 5555):
        """
        Connect to device over WiFi

        Command: adb connect <ip>:<port>
        """
        args = ["connect", f"{ip_address}:{port}"]
        self.execute("", args)

    def disconnect(self, ip_address: str, port: int = 5555):
        """
        Disconnect from device

        Command: adb disconnect <ip>:<port>
        """
        args = ["disconnect", f"{ip_address}:{port}"]
        self.execute("", args)
