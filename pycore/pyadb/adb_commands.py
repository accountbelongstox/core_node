"""
ADB Commands - High-Level Command Wrappers

Provides high-level, user-friendly wrappers around common ADB operations.
These are convenience functions built on top of ADBManager.
"""

from typing import List, Optional
from pathlib import Path
from .adb_manager import ADBManager
from .adb_device import ADBDevice


class ADBCommands:
    """
    High-level ADB command wrappers

    These methods provide user-friendly interfaces for common operations.
    All methods are static for consistency with ADBManager.
    """

    # ========== Device Management ==========

    @staticmethod
    def get_connected_devices(adb_path: str = "adb") -> List[ADBDevice]:
        """
        Get list of connected and online devices

        Returns only devices in DEVICE state (ready for use).

        Args:
            adb_path: Path to ADB executable

        Returns:
            List of online ADBDevice objects
        """
        all_devices = ADBManager.list_devices(adb_path)
        return [d for d in all_devices if d.is_online]

    @staticmethod
    def get_device_count(adb_path: str = "adb") -> int:
        """Get number of connected devices"""
        devices = ADBCommands.get_connected_devices(adb_path)
        return len(devices)

    @staticmethod
    def has_devices(adb_path: str = "adb") -> bool:
        """Check if any devices are connected"""
        return ADBCommands.get_device_count(adb_path) > 0

    @staticmethod
    def get_device_by_serial(serial: str, adb_path: str = "adb") -> Optional[ADBDevice]:
        """
        Find device by serial number

        Args:
            serial: Device serial or IP:PORT
            adb_path: Path to ADB executable

        Returns:
            ADBDevice or None if not found
        """
        devices = ADBManager.list_devices(adb_path)
        for device in devices:
            if device.serial == serial:
                return device
        return None

    @staticmethod
    def is_device_connected(serial: str, adb_path: str = "adb") -> bool:
        """Check if specific device is connected and online"""
        device = ADBCommands.get_device_by_serial(serial, adb_path)
        return device is not None and device.is_online

    @staticmethod
    def wait_for_device(
        serial: str,
        adb_path: str = "adb",
        timeout: int = 30
    ) -> bool:
        """
        Wait for device to become online

        Args:
            serial: Device serial
            adb_path: Path to ADB executable
            timeout: Maximum wait time in seconds

        Returns:
            True if device became online, False if timeout
        """
        import time
        start_time = time.time()

        while time.time() - start_time < timeout:
            if ADBCommands.is_device_connected(serial, adb_path):
                return True
            time.sleep(0.5)

        return False

    # ========== WiFi Connection Helpers ==========

    @staticmethod
    def setup_wifi_connection(
        serial: str,
        port: int = 5555,
        adb_path: str = "adb"
    ) -> Optional[str]:
        """
        Complete WiFi ADB setup workflow

        Steps:
        1. Enable WiFi ADB on device (via USB)
        2. Get device IP
        3. Connect via WiFi
        4. Return WiFi serial (IP:PORT)

        Args:
            serial: Device serial (must be USB-connected)
            port: WiFi ADB port
            adb_path: Path to ADB executable

        Returns:
            WiFi serial (IP:PORT) or None if failed

        Examples:
            >>> wifi_serial = ADBCommands.setup_wifi_connection("ABC123")
            >>> print(wifi_serial)  # "192.168.1.100:5555"
        """
        # Step 1: Enable WiFi ADB
        if not ADBManager.enable_wifi_adb(serial, port, adb_path):
            print("Failed to enable WiFi ADB")
            return None

        # Step 2: Get device IP
        import time
        time.sleep(2)  # Wait for WiFi ADB to initialize

        ip = ADBManager.get_device_ip(serial, adb_path)
        if not ip:
            print("Failed to get device IP")
            return None

        # Step 3: Connect via WiFi
        if not ADBManager.connect_wifi(ip, port, adb_path):
            print(f"Failed to connect to {ip}:{port}")
            return None

        wifi_serial = f"{ip}:{port}"

        # Step 4: Verify connection
        if not ADBCommands.wait_for_device(wifi_serial, adb_path, timeout=10):
            print(f"Device {wifi_serial} not ready")
            return None

        print(f"WiFi connection established: {wifi_serial}")
        return wifi_serial

    @staticmethod
    def get_wifi_devices(adb_path: str = "adb") -> List[ADBDevice]:
        """Get all WiFi-connected devices"""
        all_devices = ADBManager.list_devices(adb_path)
        return [d for d in all_devices if d.is_wifi]

    @staticmethod
    def get_usb_devices(adb_path: str = "adb") -> List[ADBDevice]:
        """Get all USB-connected devices"""
        all_devices = ADBManager.list_devices(adb_path)
        return [d for d in all_devices if d.is_usb]

    # ========== Screen Control ==========

    @staticmethod
    def screenshot(
        serial: str,
        save_path: Path,
        adb_path: str = "adb"
    ) -> bool:
        """
        Take screenshot and save to PC

        Args:
            serial: Device serial
            save_path: Local save path (e.g., Path("screenshot.png"))
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        try:
            # Take screenshot on device
            remote_path = "/sdcard/screenshot_temp.png"
            ADBManager.execute_shell(serial, f"screencap -p {remote_path}", adb_path)

            # Pull to PC
            success = ADBManager.pull_file(serial, remote_path, save_path, adb_path)

            # Clean up remote file
            ADBManager.execute_shell(serial, f"rm {remote_path}", adb_path, timeout=5)

            return success

        except Exception as e:
            print(f"Failed to take screenshot: {e}")
            return False

    @staticmethod
    def record_screen_start(
        serial: str,
        remote_path: str = "/sdcard/screenrecord.mp4",
        adb_path: str = "adb",
        time_limit: int = 180,
        bit_rate: int = 8000000
    ) -> bool:
        """
        Start screen recording on device (non-blocking)

        Args:
            serial: Device serial
            remote_path: Remote save path on device
            adb_path: Path to ADB executable
            time_limit: Recording time limit in seconds (max 180)
            bit_rate: Bitrate in bits per second

        Returns:
            Success status

        Note: Recording runs in background. Use record_screen_stop() to stop.
        """
        try:
            # Start recording in background
            cmd = f"screenrecord --time-limit {time_limit} --bit-rate {bit_rate} {remote_path} &"
            ADBManager.execute_shell(serial, cmd, adb_path, timeout=5)
            return True

        except Exception as e:
            print(f"Failed to start screen recording: {e}")
            return False

    @staticmethod
    def record_screen_stop(
        serial: str,
        adb_path: str = "adb"
    ) -> bool:
        """
        Stop ongoing screen recording

        Args:
            serial: Device serial
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        try:
            # Kill screenrecord process
            ADBManager.execute_shell(serial, "pkill -SIGINT screenrecord", adb_path, timeout=5)
            return True

        except Exception as e:
            print(f"Failed to stop screen recording: {e}")
            return False

    @staticmethod
    def pull_recording(
        serial: str,
        remote_path: str,
        local_path: Path,
        adb_path: str = "adb",
        cleanup: bool = True
    ) -> bool:
        """
        Pull screen recording from device to PC

        Args:
            serial: Device serial
            remote_path: Remote file path on device
            local_path: Local save path
            adb_path: Path to ADB executable
            cleanup: Delete remote file after pull

        Returns:
            Success status
        """
        try:
            # Pull file
            success = ADBManager.pull_file(serial, remote_path, local_path, adb_path)

            # Clean up if requested
            if success and cleanup:
                ADBManager.execute_shell(serial, f"rm {remote_path}", adb_path, timeout=5)

            return success

        except Exception as e:
            print(f"Failed to pull recording: {e}")
            return False

    # ========== Input Control ==========

    @staticmethod
    def tap(serial: str, x: int, y: int, adb_path: str = "adb") -> bool:
        """
        Simulate tap at coordinates

        Args:
            serial: Device serial
            x: X coordinate
            y: Y coordinate
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        try:
            ADBManager.execute_shell(serial, f"input tap {x} {y}", adb_path)
            return True
        except Exception:
            return False

    @staticmethod
    def swipe(
        serial: str,
        x1: int,
        y1: int,
        x2: int,
        y2: int,
        duration: int = 300,
        adb_path: str = "adb"
    ) -> bool:
        """
        Simulate swipe gesture

        Args:
            serial: Device serial
            x1: Start X coordinate
            y1: Start Y coordinate
            x2: End X coordinate
            y2: End Y coordinate
            duration: Swipe duration in milliseconds
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        try:
            ADBManager.execute_shell(
                serial,
                f"input swipe {x1} {y1} {x2} {y2} {duration}",
                adb_path
            )
            return True
        except Exception:
            return False

    @staticmethod
    def input_text(serial: str, text: str, adb_path: str = "adb") -> bool:
        """
        Input text (spaces replaced with %s)

        Args:
            serial: Device serial
            text: Text to input
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        try:
            # Replace spaces with %s for shell compatibility
            escaped_text = text.replace(" ", "%s")
            ADBManager.execute_shell(serial, f"input text {escaped_text}", adb_path)
            return True
        except Exception:
            return False

    @staticmethod
    def press_key(serial: str, keycode: int, adb_path: str = "adb") -> bool:
        """
        Press Android keycode

        Args:
            serial: Device serial
            keycode: Android keycode (e.g., 3=HOME, 4=BACK, 24=VOLUME_UP)
            adb_path: Path to ADB executable

        Returns:
            Success status

        Common keycodes:
            - 3: HOME
            - 4: BACK
            - 24: VOLUME_UP
            - 25: VOLUME_DOWN
            - 26: POWER
            - 82: MENU
            - 187: RECENT_APPS
        """
        try:
            ADBManager.execute_shell(serial, f"input keyevent {keycode}", adb_path)
            return True
        except Exception:
            return False

    # ========== App Management ==========

    @staticmethod
    def list_packages(serial: str, adb_path: str = "adb") -> List[str]:
        """
        List all installed packages

        Args:
            serial: Device serial
            adb_path: Path to ADB executable

        Returns:
            List of package names
        """
        try:
            output = ADBManager.execute_shell(serial, "pm list packages", adb_path, timeout=30)
            packages = []

            for line in output.split('\n'):
                if line.startswith("package:"):
                    package_name = line.split(":", 1)[1].strip()
                    packages.append(package_name)

            return packages

        except Exception as e:
            print(f"Failed to list packages: {e}")
            return []

    @staticmethod
    def is_package_installed(serial: str, package_name: str, adb_path: str = "adb") -> bool:
        """Check if package is installed"""
        packages = ADBCommands.list_packages(serial, adb_path)
        return package_name in packages

    @staticmethod
    def launch_app(serial: str, package_name: str, adb_path: str = "adb") -> bool:
        """
        Launch app by package name

        Args:
            serial: Device serial
            package_name: Package name (e.g., "com.android.chrome")
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        try:
            cmd = f"monkey -p {package_name} -c android.intent.category.LAUNCHER 1"
            ADBManager.execute_shell(serial, cmd, adb_path, timeout=10)
            return True
        except Exception:
            return False

    @staticmethod
    def force_stop_app(serial: str, package_name: str, adb_path: str = "adb") -> bool:
        """Force stop app"""
        try:
            ADBManager.execute_shell(serial, f"am force-stop {package_name}", adb_path)
            return True
        except Exception:
            return False

    @staticmethod
    def clear_app_data(serial: str, package_name: str, adb_path: str = "adb") -> bool:
        """Clear app data and cache"""
        try:
            ADBManager.execute_shell(serial, f"pm clear {package_name}", adb_path, timeout=30)
            return True
        except Exception:
            return False

    # ========== System Settings ==========

    @staticmethod
    def set_screen_brightness(serial: str, brightness: int, adb_path: str = "adb") -> bool:
        """
        Set screen brightness (0-255)

        Args:
            serial: Device serial
            brightness: Brightness value (0-255)
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        try:
            brightness = max(0, min(255, brightness))  # Clamp to 0-255
            ADBManager.execute_shell(
                serial,
                f"settings put system screen_brightness {brightness}",
                adb_path
            )
            return True
        except Exception:
            return False

    @staticmethod
    def set_volume(serial: str, stream: str, volume: int, adb_path: str = "adb") -> bool:
        """
        Set audio volume

        Args:
            serial: Device serial
            stream: Stream type ("music", "ring", "alarm", "notification")
            volume: Volume level (typically 0-15)
            adb_path: Path to ADB executable

        Returns:
            Success status
        """
        try:
            stream_map = {
                "music": 3,
                "ring": 2,
                "alarm": 4,
                "notification": 5
            }
            stream_id = stream_map.get(stream, 3)
            ADBManager.execute_shell(
                serial,
                f"media volume --stream {stream_id} --set {volume}",
                adb_path
            )
            return True
        except Exception:
            return False

    @staticmethod
    def get_system_info(serial: str, adb_path: str = "adb") -> dict:
        """
        Get comprehensive system information

        Returns dictionary with:
        - model, manufacturer, brand
        - android_version, sdk_version
        - screen_resolution
        - battery_level
        - ip_address
        """
        info = {}

        try:
            # Basic properties
            info['model'] = ADBManager.get_device_model(serial, adb_path)
            info['android_version'] = ADBManager.get_android_version(serial, adb_path)

            # Screen resolution
            width, height = ADBManager.get_screen_resolution(serial, adb_path)
            info['screen_width'] = width
            info['screen_height'] = height

            # Battery
            battery = ADBManager.get_battery_status(serial, adb_path)
            if battery:
                info['battery_level'] = battery.level
                info['battery_charging'] = battery.charging

            # IP address
            info['ip_address'] = ADBManager.get_device_ip(serial, adb_path)

        except Exception as e:
            print(f"Failed to get system info: {e}")

        return info
