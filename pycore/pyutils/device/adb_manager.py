"""
ADB Manager - Centralized ADB Command Execution

Stateless utility class for executing ADB commands.
All methods are static and require adb_path parameter.

Design Principles:
- No global state
- Pure functions where possible
- Parameter-based configuration
- Comprehensive error handling
- Type-safe interfaces
"""

import subprocess
import re
import shlex
from pathlib import Path
from typing import List, Optional, Tuple
import time

from pycore.pyutils.device.adb_types import (
    ADBDeviceBasic,
    ADBDeviceState,
    ADBExecuteResult,
    ADBDeviceProperties,
    ADBDeviceBattery,
    ADBForwardSpec
)
from pycore.pyutils.device.adb_device import ADBDevice


class ADBManager:
    """
    Centralized ADB command manager

    All ADB operations go through this class.
    No instance creation needed - all methods are static.
    """

    # Default timeout for ADB commands
    DEFAULT_TIMEOUT = 30

    @staticmethod
    def execute(
        serial: str,
        args: List[str],
        adb_path: str = "adb",
        timeout: int = DEFAULT_TIMEOUT
    ) -> ADBExecuteResult:
        """
        Execute ADB command

        Args:
            serial: Device serial (empty string for no device selection)
            args: Command arguments (e.g., ["devices"], ["shell", "input", "tap", "500", "1000"])
            adb_path: Path to ADB executable
            timeout: Command timeout in seconds

        Returns:
            ADBExecuteResult with success status and output

        Examples:
            >>> ADBManager.execute("", ["devices"])
            >>> ADBManager.execute("ABC123", ["shell", "getprop", "ro.build.version.release"])
        """
        cmd = [adb_path]

        # Add serial if specified
        if serial:
            cmd.extend(["-s", serial])

        cmd.extend(args)

        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=timeout,
                text=True,
                check=False
            )

            return ADBExecuteResult(
                success=(result.returncode == 0),
                stdout=result.stdout,
                stderr=result.stderr,
                returncode=result.returncode
            )

        except subprocess.TimeoutExpired:
            return ADBExecuteResult(
                success=False,
                stdout="",
                stderr=f"Command timed out after {timeout} seconds",
                returncode=-1
            )
        except FileNotFoundError:
            return ADBExecuteResult(
                success=False,
                stdout="",
                stderr=f"ADB executable not found: {adb_path}",
                returncode=-2
            )
        except Exception as e:
            return ADBExecuteResult(
                success=False,
                stdout="",
                stderr=str(e),
                returncode=-3
            )

    @staticmethod
    def execute_shell(
        serial: str,
        command: str,
        adb_path: str = "adb",
        timeout: int = DEFAULT_TIMEOUT
    ) -> str:
        """
        Execute shell command on device

        Args:
            serial: Device serial
            command: Shell command (will be properly escaped)
            adb_path: Path to ADB executable
            timeout: Command timeout in seconds

        Returns:
            Command output (stdout)

        Examples:
            >>> ADBManager.execute_shell("ABC123", "input tap 500 1000")
            >>> ADBManager.execute_shell("ABC123", "getprop ro.build.version.release")
        """
        # Use shlex.split for proper shell argument handling
        if isinstance(command, str):
            shell_args = shlex.split(command)
        else:
            shell_args = command

        args = ["shell"] + shell_args
        result = ADBManager.execute(serial, args, adb_path, timeout)

        if not result.success:
            raise RuntimeError(f"Shell command failed: {result.stderr}")

        return result.stdout.strip()

    @staticmethod
    def list_devices(adb_path: str = "adb") -> List[ADBDevice]:
        """
        List all connected ADB devices

        Args:
            adb_path: Path to ADB executable

        Returns:
            List of ADBDevice objects

        Examples:
            >>> devices = ADBManager.list_devices()
            >>> for device in devices:
            ...     print(f"{device.serial}: {device.state.value}")
        """
        result = ADBManager.execute("", ["devices"], adb_path)

        if not result.success:
            return []

        devices: List[ADBDevice] = []
        lines = result.stdout.strip().split('\n')

        for line in lines:
            # Skip header and empty lines
            if not line or line.startswith('List of devices'):
                continue

            # Parse: "SERIAL\tSTATE" or "SERIAL STATE"
            parts = re.split(r'\s+', line.strip(), maxsplit=1)
            if len(parts) >= 2:
                serial, state_str = parts[0], parts[1]

                # Parse state
                try:
                    state = ADBDeviceState(state_str)
                except ValueError:
                    state = ADBDeviceState.UNKNOWN

                # Create basic device
                basic = ADBDeviceBasic(serial=serial, state=state)
                device = ADBDevice.from_basic(basic)
                device.last_seen = time.time()

                devices.append(device)

        return devices

    @staticmethod
    def get_device_properties(
        serial: str,
        adb_path: str = "adb"
    ) -> Optional[ADBDeviceProperties]:
        """
        Get detailed device properties using getprop

        Args:
            serial: Device serial
            adb_path: Path to ADB executable

        Returns:
            ADBDeviceProperties or None if failed
        """
        try:
            # Get all properties at once
            output = ADBManager.execute_shell(serial, "getprop", adb_path, timeout=10)

            props = ADBDeviceProperties()

            # Parse getprop output
            for line in output.split('\n'):
                match = re.match(r'\[([^\]]+)\]:\s*\[([^\]]*)\]', line)
                if not match:
                    continue

                key, value = match.groups()

                # Map properties
                if key == "ro.product.manufacturer":
                    props.manufacturer = value
                elif key == "ro.product.model":
                    props.model = value
                elif key == "ro.product.brand":
                    props.brand = value
                elif key == "ro.product.device":
                    props.device = value
                elif key == "ro.build.version.release":
                    props.android_version = value
                elif key == "ro.build.version.sdk":
                    try:
                        props.sdk_version = int(value)
                    except ValueError:
                        pass
                elif key == "ro.build.id":
                    props.build_id = value
                elif key == "ro.product.cpu.abi":
                    props.cpu_abi = value
                elif key == "ro.sf.lcd_density":
                    try:
                        props.screen_density = int(value)
                    except ValueError:
                        pass

            return props

        except Exception as e:
            print(f"Failed to get device properties: {e}")
            return None

    @staticmethod
    def get_battery_status(
        serial: str,
        adb_path: str = "adb"
    ) -> Optional[ADBDeviceBattery]:
        """
        Get device battery status

        Args:
            serial: Device serial
            adb_path: Path to ADB executable

        Returns:
            ADBDeviceBattery or None if failed
        """
        try:
            output = ADBManager.execute_shell(serial, "dumpsys battery", adb_path, timeout=5)

            battery = ADBDeviceBattery(
                level=0,
                charging=False,
                temperature=0.0,
                voltage=0,
                health=""
            )

            for line in output.split('\n'):
                line = line.strip()
                if line.startswith("level: "):
                    battery.level = int(line.split(": ")[1])
                elif line.startswith("AC powered: ") or line.startswith("USB powered: "):
                    if line.split(": ")[1] == "true":
                        battery.charging = True
                elif line.startswith("temperature: "):
                    # Temperature is in tenths of degree Celsius
                    battery.temperature = int(line.split(": ")[1]) / 10.0
                elif line.startswith("voltage: "):
                    battery.voltage = int(line.split(": ")[1])
                elif line.startswith("health: "):
                    health_code = int(line.split(": ")[1])
                    health_map = {
                        1: "unknown",
                        2: "good",
                        3: "overheat",
                        4: "dead",
                        5: "over_voltage",
                        6: "unspecified_failure",
                        7: "cold"
                    }
                    battery.health = health_map.get(health_code, "unknown")

            return battery

        except Exception as e:
            print(f"Failed to get battery status: {e}")
            return None

    @staticmethod
    def get_screen_resolution(serial: str, adb_path: str = "adb") -> Tuple[int, int]:
        """
        Get device screen resolution

        Args:
            serial: Device serial
            adb_path: Path to ADB executable

        Returns:
            (width, height) tuple or (0, 0) if failed
        """
        try:
            output = ADBManager.execute_shell(serial, "wm size", adb_path, timeout=5)

            # Parse: "Physical size: 1440x3120"
            match = re.search(r'(\d+)x(\d+)', output)
            if match:
                width, height = int(match.group(1)), int(match.group(2))
                return width, height

            return (0, 0)

        except Exception:
            return (0, 0)

    @staticmethod
    def push_file(
        serial: str,
        local_path: Path,
        remote_path: str,
        adb_path: str = "adb"
    ) -> bool:
        """
        Push file to device

        Args:
            serial: Device serial
            local_path: Local file path
            remote_path: Remote file path on device
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        if not local_path.exists():
            print(f"Local file not found: {local_path}")
            return False

        result = ADBManager.execute(
            serial,
            ["push", str(local_path), remote_path],
            adb_path,
            timeout=60
        )

        return result.success

    @staticmethod
    def pull_file(
        serial: str,
        remote_path: str,
        local_path: Path,
        adb_path: str = "adb"
    ) -> bool:
        """
        Pull file from device

        Args:
            serial: Device serial
            remote_path: Remote file path on device
            local_path: Local destination path
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        result = ADBManager.execute(
            serial,
            ["pull", remote_path, str(local_path)],
            adb_path,
            timeout=60
        )

        return result.success

    @staticmethod
    def forward_port(
        serial: str,
        local_port: int,
        remote_socket: str,
        adb_path: str = "adb"
    ) -> bool:
        """
        Set up port forwarding (local PC -> device)

        Args:
            serial: Device serial
            local_port: Local TCP port
            remote_socket: Remote socket name (e.g., "scrcpy", "localabstract:name")
            adb_path: Path to ADB executable

        Returns:
            Success status

        Examples:
            >>> ADBManager.forward_port("ABC123", 27183, "scrcpy")
            >>> ADBManager.forward_port("ABC123", 27184, "localabstract:scrcpy_control")
        """
        result = ADBManager.execute(
            serial,
            ["forward", f"tcp:{local_port}", f"localabstract:{remote_socket}"],
            adb_path
        )

        return result.success

    @staticmethod
    def forward_remove(
        serial: str,
        local_port: int,
        adb_path: str = "adb"
    ) -> bool:
        """
        Remove port forwarding

        Args:
            serial: Device serial
            local_port: Local TCP port to remove
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        result = ADBManager.execute(
            serial,
            ["forward", "--remove", f"tcp:{local_port}"],
            adb_path
        )

        return result.success

    @staticmethod
    def forward_remove_all(serial: str, adb_path: str = "adb") -> bool:
        """Remove all port forwardings for a device"""
        result = ADBManager.execute(serial, ["forward", "--remove-all"], adb_path)
        return result.success

    # ========== WiFi ADB Methods ==========

    @staticmethod
    def get_device_ip(serial: str, adb_path: str = "adb") -> Optional[str]:
        """
        Get device IP address (WiFi)

        Args:
            serial: Device serial
            adb_path: Path to ADB executable

        Returns:
            IP address string or None if not found

        Examples:
            >>> ip = ADBManager.get_device_ip("ABC123")
            >>> print(ip)  # "192.168.1.100"
        """
        try:
            output = ADBManager.execute_shell(serial, "ip addr show wlan0", adb_path, timeout=5)

            # Parse: inet 192.168.1.100/24
            match = re.search(r'inet (\d+\.\d+\.\d+\.\d+)', output)
            if match:
                return match.group(1)

            return None

        except Exception as e:
            print(f"Failed to get device IP: {e}")
            return None

    @staticmethod
    def enable_wifi_adb(
        serial: str,
        port: int = 5555,
        adb_path: str = "adb"
    ) -> bool:
        """
        Enable WiFi ADB on device (requires USB connection first)

        Args:
            serial: Device serial (must be USB-connected)
            port: TCP port for WiFi ADB (default: 5555)
            adb_path: Path to ADB executable

        Returns:
            Success status

        Examples:
            >>> ADBManager.enable_wifi_adb("ABC123", 5555)
        """
        try:
            # Set TCP/IP port
            result = ADBManager.execute(serial, ["tcpip", str(port)], adb_path)

            if not result.success:
                print(f"Failed to enable WiFi ADB: {result.stderr}")
                return False

            # Wait for restart
            time.sleep(1)

            return True

        except Exception as e:
            print(f"Failed to enable WiFi ADB: {e}")
            return False

    @staticmethod
    def connect_wifi(
        ip: str,
        port: int = 5555,
        adb_path: str = "adb"
    ) -> bool:
        """
        Connect to device via WiFi

        Args:
            ip: Device IP address
            port: TCP port (default: 5555)
            adb_path: Path to ADB executable

        Returns:
            Success status

        Examples:
            >>> ADBManager.connect_wifi("192.168.1.100", 5555)
        """
        result = ADBManager.execute("", ["connect", f"{ip}:{port}"], adb_path, timeout=10)

        if not result.success:
            print(f"Failed to connect WiFi: {result.stderr}")
            return False

        # Check if connected successfully
        return "connected" in result.stdout.lower() or "already connected" in result.stdout.lower()

    @staticmethod
    def disconnect_wifi(
        ip: str,
        port: int = 5555,
        adb_path: str = "adb"
    ) -> bool:
        """
        Disconnect from WiFi device

        Args:
            ip: Device IP address
            port: TCP port (default: 5555)
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        result = ADBManager.execute("", ["disconnect", f"{ip}:{port}"], adb_path)
        return result.success

    @staticmethod
    def disconnect_all(adb_path: str = "adb") -> bool:
        """Disconnect all WiFi devices"""
        result = ADBManager.execute("", ["disconnect"], adb_path)
        return result.success

    # ========== Utility Methods ==========

    @staticmethod
    def install_apk(serial: str, apk_path: Path, adb_path: str = "adb") -> bool:
        """
        Install APK on device

        Args:
            serial: Device serial
            apk_path: Local APK file path
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        if not apk_path.exists():
            print(f"APK file not found: {apk_path}")
            return False

        result = ADBManager.execute(
            serial,
            ["install", "-r", str(apk_path)],
            adb_path,
            timeout=120
        )

        return result.success and "Success" in result.stdout

    @staticmethod
    def uninstall_package(serial: str, package_name: str, adb_path: str = "adb") -> bool:
        """
        Uninstall package from device

        Args:
            serial: Device serial
            package_name: Package name (e.g., "com.example.app")
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        result = ADBManager.execute(serial, ["uninstall", package_name], adb_path, timeout=30)
        return result.success and "Success" in result.stdout

    @staticmethod
    def set_show_touches(serial: str, enabled: bool, adb_path: str = "adb") -> bool:
        """
        Enable/disable touch indicators on screen

        Args:
            serial: Device serial
            enabled: True to enable, False to disable
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        value = "1" if enabled else "0"
        try:
            ADBManager.execute_shell(
                serial,
                f"settings put system show_touches {value}",
                adb_path
            )
            return True
        except Exception as e:
            print(f"Failed to set show touches: {e}")
            return False

    @staticmethod
    def get_android_version(serial: str, adb_path: str = "adb") -> str:
        """Get Android version (e.g., "13", "14")"""
        try:
            return ADBManager.execute_shell(
                serial,
                "getprop ro.build.version.release",
                adb_path,
                timeout=5
            )
        except Exception:
            return ""

    @staticmethod
    def get_device_model(serial: str, adb_path: str = "adb") -> str:
        """Get device model name"""
        try:
            return ADBManager.execute_shell(
                serial,
                "getprop ro.product.model",
                adb_path,
                timeout=5
            )
        except Exception:
            return ""

    @staticmethod
    def reboot(serial: str, mode: str = "", adb_path: str = "adb") -> bool:
        """
        Reboot device

        Args:
            serial: Device serial
            mode: Reboot mode ("", "bootloader", "recovery")
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        args = ["reboot"]
        if mode:
            args.append(mode)

        result = ADBManager.execute(serial, args, adb_path)
        return result.success
