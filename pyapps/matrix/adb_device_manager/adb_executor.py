#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ADB Executor - ADB Command Execution Wrapper

Provides a clean interface for executing ADB commands with proper error handling,
timeout management, and result parsing.
"""

import re
from typing import Optional, List, Tuple, Dict
from pycore import ColorPrint
from pycore.pyfoundations.pybasecommon import exec_silent


class ADBExecutor:
    """ADB command executor"""

    def __init__(self, adb_path: str = "adb", timeout: int = 10):
        """
        Initialize ADB executor

        Args:
            adb_path: Path to adb executable (default: "adb" from PATH)
            timeout: Command timeout in seconds
        """
        self.adb_path = adb_path
        self.timeout = timeout

    def execute(
        self,
        args: List[str],
        serial: Optional[str] = None,
        timeout: Optional[int] = None
    ) -> Tuple[bool, str, str]:
        """
        Execute ADB command

        Args:
            args: ADB command arguments
            serial: Device serial (optional)
            timeout: Command timeout (optional, uses default if not specified)

        Returns:
            (success, stdout, stderr)
        """
        cmd = [self.adb_path]

        if serial:
            cmd.extend(['-s', serial])

        cmd.extend(args)

        timeout_val = timeout or self.timeout

        try:
            result = exec_silent(cmd, info=False)
            
            stdout = result.stdout.strip()
            stderr = result.stderr.strip()
            success = result.return_code == 0

            return success, stdout, stderr

        except Exception as e:
            if 'timeout' in str(e).lower():
                return False, "", f"Timeout after {timeout_val}s"
            return False, "", str(e)

    def get_devices(self) -> List[Tuple[str, str]]:
        """
        Get connected devices

        Returns:
            List of (serial, state) tuples
        """
        success, stdout, stderr = self.execute(['devices'])

        if not success:
            ColorPrint.yellow(f"[ADB] Failed to get devices: {stderr}")
            return []

        devices = []
        for line in stdout.splitlines()[1:]:  # Skip header
            line = line.strip()
            if not line:
                continue

            parts = line.split()
            if len(parts) >= 2:
                serial, state = parts[0], parts[1]
                devices.append((serial, state))

        return devices

    def get_device_ip(self, serial: str) -> Optional[str]:
        """
        Get device IP address

        Args:
            serial: Device serial

        Returns:
            IP address or None
        """
        success, stdout, stderr = self.execute(['shell', 'ifconfig', 'wlan0'], serial=serial)

        if success and stdout:
            match = re.search(r'inet addr:(\d+\.\d+\.\d+\.\d+)', stdout)
            if match:
                return match.group(1)

            match = re.search(r'inet (\d+\.\d+\.\d+\.\d+)', stdout)
            if match:
                return match.group(1)

        success, stdout, stderr = self.execute(['shell', 'ip', '-o', 'a'], serial=serial)

        if success and stdout:
            for line in stdout.splitlines():
                if 'wlan0' in line and 'inet ' in line:
                    match = re.search(r'inet (\d+\.\d+\.\d+\.\d+)', line)
                    if match:
                        return match.group(1)

        return None

    def enable_tcpip(self, serial: str, port: int = 5555) -> bool:
        """
        Enable TCP/IP mode on device

        Args:
            serial: Device serial
            port: TCP/IP port (default: 5555)

        Returns:
            True if successful
        """
        success, stdout, stderr = self.execute(['tcpip', str(port)], serial=serial)

        if success and ('restarting' in stdout.lower() or 'tcp mode' in stdout.lower()):
            return True

        ColorPrint.yellow(f"[ADB] Failed to enable tcpip on {serial}: {stderr or stdout}")
        return False

    def connect_wireless(self, ip: str, port: int = 5555) -> bool:
        """
        Connect to device wirelessly

        Args:
            ip: Device IP address
            port: TCP/IP port (default: 5555)

        Returns:
            True if successful
        """
        addr = f"{ip}:{port}"
        success, stdout, stderr = self.execute(['connect', addr])

        if success and ('connected' in stdout.lower() or 'already connected' in stdout.lower()):
            return True

        ColorPrint.yellow(f"[ADB] Failed to connect to {addr}: {stderr or stdout}")
        return False

    def disconnect_wireless(self, ip: str, port: int = 5555) -> bool:
        """
        Disconnect from wireless device

        Args:
            ip: Device IP address
            port: TCP/IP port (default: 5555)

        Returns:
            True if successful
        """
        addr = f"{ip}:{port}"
        success, stdout, stderr = self.execute(['disconnect', addr])

        return success

    def enable_root_wifi_adb(self, serial: str, port: int = 5555) -> bool:
        """
        Enable WiFi ADB on rooted device

        Args:
            serial: Device serial
            port: TCP/IP port (default: 5555)

        Returns:
            True if successful
        """
        cmd = f"setprop service.adb.tcp.port {port} && stop adbd && start adbd"
        success, stdout, stderr = self.execute(['shell', 'su', '-c', cmd], serial=serial)

        if success:
            ColorPrint.green(f"[ADB] Enabled root WiFi ADB on {serial}")
            return True

        ColorPrint.yellow(f"[ADB] Failed to enable root WiFi ADB on {serial}: {stderr or stdout}")
        return False

    def check_device_root(self, serial: str) -> bool:
        """
        Check if device is rooted

        Args:
            serial: Device serial

        Returns:
            True if rooted
        """
        success, stdout, stderr = self.execute(['shell', 'su', '-c', 'id'], serial=serial, timeout=5)

        if success and 'uid=0' in stdout:
            return True

        return False

    def get_device_info(self, serial: str) -> Dict[str, Optional[str]]:
        """
        Get device information

        Args:
            serial: Device serial

        Returns:
            Device info dictionary
        """
        info = {
            'model': None,
            'android_version': None,
            'manufacturer': None,
            'product': None
        }

        success, stdout, _ = self.execute(['shell', 'getprop', 'ro.product.model'], serial=serial)
        if success:
            info['model'] = stdout.strip()

        success, stdout, _ = self.execute(['shell', 'getprop', 'ro.build.version.release'], serial=serial)
        if success:
            info['android_version'] = stdout.strip()

        success, stdout, _ = self.execute(['shell', 'getprop', 'ro.product.manufacturer'], serial=serial)
        if success:
            info['manufacturer'] = stdout.strip()

        success, stdout, _ = self.execute(['shell', 'getprop', 'ro.product.name'], serial=serial)
        if success:
            info['product'] = stdout.strip()

        return info

    @staticmethod
    def is_wifi_device(serial: str) -> bool:
        """
        Check if serial is a WiFi device (IP:PORT format)

        Args:
            serial: Device serial

        Returns:
            True if WiFi device
        """
        pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$'
        return bool(re.match(pattern, serial))

    @staticmethod
    def extract_ip_from_serial(serial: str) -> Optional[str]:
        """
        Extract IP address from WiFi device serial

        Args:
            serial: Device serial (e.g., "192.168.1.100:5555")

        Returns:
            IP address or None
        """
        if ADBExecutor.is_wifi_device(serial):
            return serial.split(':')[0]
        return None
