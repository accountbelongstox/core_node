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

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import exec_silent
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
import subprocess
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
            result = exec_silent(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=timeout,
                text=True,
                check=False
            )

            return ADBExecuteResult(
                success=(result.return_code == 0),
                stdout=result.stdout,
                stderr=result.stderr,
                returncode=result.return_code
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
        except (OSError, subprocess.SubprocessError) as e:
            ColorPrint.yellow(f"[ADBManager] adb command failed {cmd}: {e}")
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
    ) -> Optional[str]:
        """
        Execute shell command on device

        Args:
            serial: Device serial
            command: Shell command (will be properly escaped)
            adb_path: Path to ADB executable
            timeout: Command timeout in seconds

        Returns:
            Command output (stdout), or None when the command failed (reported)

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
            ColorPrint.yellow(f"[ADBManager] shell command failed serial={serial} command={command!r}: {result.stderr}")
            return None

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
                state = ADBDeviceState._value2member_map_.get(state_str, ADBDeviceState.UNKNOWN)

                # Create basic device
                basic = ADBDeviceBasic(serial=serial, state=state)
                device = ADBDevice.from_basic(basic)
                device.last_seen = time.time()

                devices.append(device)

        return devices

    @staticmethod
    def get_device_info(serial: str, adb_path: str = "adb") -> ADBDevice:
        """
        Get device information (wrapper around list_devices for single device)

        Args:
            serial: Device serial number
            adb_path: Path to ADB executable

        Returns:
            ADBDevice object with properties filled in

        Examples:
            >>> device = ADBManager.get_device_info("ABC123")
            >>> print(f"{device.properties.model} - {device.serial}")
        """
        # Get all devices
        devices = ADBManager.list_devices(adb_path)
        device = next((d for d in devices if d.serial == serial), None)

        if not device:
            # Create a device object with offline state
            basic = ADBDeviceBasic(serial=serial, state=ADBDeviceState.OFFLINE)
            device = ADBDevice.from_basic(basic)
            return device

        # Get detailed properties if device is online
        if device.is_online:
            props = ADBManager.get_device_properties(serial, adb_path)
            if props:
                # Update device properties (need to create new dataclass since frozen)
                # Since ADBDevice is not frozen, we can set properties directly
                device.properties = props

        return device

    @staticmethod
    def get_prop(serial: str, prop: str, adb_path: str = "adb") -> str:
        """
        Get device property using getprop

        Args:
            serial: Device serial number
            prop: Property name (e.g., "ro.build.version.release")
            adb_path: Path to ADB executable

        Returns:
            Property value (empty string if failed)

        Examples:
            >>> version = ADBManager.get_prop("ABC123", "ro.build.version.release")
            >>> print(version)  # "13"
        """
        return ADBManager.execute_shell(serial, f"getprop {prop}", adb_path, timeout=5) or ""

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
        output = ADBManager.execute_shell(serial, "getprop", adb_path, timeout=10)
        if output is None:
            return None

        props = ADBDeviceProperties()
        string_props = {
            "ro.product.manufacturer": "manufacturer",
            "ro.product.model": "model",
            "ro.product.brand": "brand",
            "ro.product.device": "device",
            "ro.build.version.release": "android_version",
            "ro.build.id": "build_id",
            "ro.product.cpu.abi": "cpu_abi",
        }
        int_props = {
            "ro.build.version.sdk": "sdk_version",
            "ro.sf.lcd_density": "screen_density",
        }
        for line in output.split('\n'):
            match = re.match(r'\[([^\]]+)\]:\s*\[([^\]]*)\]', line)
            if not match:
                continue
            key, value = match.groups()
            if key in string_props:
                setattr(props, string_props[key], value)
            elif key in int_props and value.isdigit():
                setattr(props, int_props[key], int(value))

        return props

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
        output = ADBManager.execute_shell(serial, "dumpsys battery", adb_path, timeout=5)
        if output is None:
            return None

        battery = ADBDeviceBattery(
            level=0,
            charging=False,
            temperature=0.0,
            voltage=0,
            health=""
        )
        health_map = {
            1: "unknown",
            2: "good",
            3: "overheat",
            4: "dead",
            5: "over_voltage",
            6: "unspecified_failure",
            7: "cold"
        }
        for line in output.split('\n'):
            key, _, value = line.strip().partition(": ")
            numeric = int(value) if value.lstrip("-").isdigit() else None
            if key == "level" and numeric is not None:
                battery.level = numeric
            elif key in ("AC powered", "USB powered") and value == "true":
                battery.charging = True
            elif key == "temperature" and numeric is not None:
                # Temperature is in tenths of degree Celsius
                battery.temperature = numeric / 10.0
            elif key == "voltage" and numeric is not None:
                battery.voltage = numeric
            elif key == "health" and numeric is not None:
                battery.health = health_map.get(numeric, "unknown")

        return battery

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
        output = ADBManager.execute_shell(serial, "wm size", adb_path, timeout=5)
        # Parse: "Physical size: 1440x3120"
        match = re.search(r'(\d+)x(\d+)', output or "")
        if match:
            return int(match.group(1)), int(match.group(2))
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
            ColorPrint.plain(f"Local file not found: {local_path}")
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
        output = ADBManager.execute_shell(serial, "ip addr show wlan0", adb_path, timeout=5)
        # Parse: inet 192.168.1.100/24
        match = re.search(r'inet (\d+\.\d+\.\d+\.\d+)', output or "")
        return match.group(1) if match else None

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
        result = ADBManager.execute(serial, ["tcpip", str(port)], adb_path)
        if not result.success:
            ColorPrint.plain(f"Failed to enable WiFi ADB: {result.stderr}")
            return False
        # Wait for restart
        time.sleep(1)
        return True

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
            ColorPrint.plain(f"Failed to connect WiFi: {result.stderr}")
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
            ColorPrint.plain(f"APK file not found: {apk_path}")
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
        return ADBManager.execute_shell(
            serial,
            f"settings put system show_touches {value}",
            adb_path
        ) is not None

    @staticmethod
    def get_android_version(serial: str, adb_path: str = "adb") -> str:
        """Get Android version (e.g., "13", "14")"""
        return ADBManager.get_prop(serial, "ro.build.version.release", adb_path)

    @staticmethod
    def get_device_model(serial: str, adb_path: str = "adb") -> str:
        """Get device model name"""
        return ADBManager.get_prop(serial, "ro.product.model", adb_path)

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
