# -*- coding: utf-8 -*-
"""
Simple Device Scanner - Local Network Device Scanner

Simple TCP port scanning approach with network configuration cache.

Strategy:
1. Load cached network config (fast startup)
2. Validate cache by pinging router
3. Only scan device sync service port (58923)
4. No repeated full network scanning
"""

import socket
import json
import time
import urllib.request
import urllib.error
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from .logging import setup_logging
from ..network_cache import NetworkCache

logger = setup_logging(__name__)

# Device sync service port
DEVICE_SYNC_PORT = 58923

# Scan timeout (seconds)
SCAN_TIMEOUT = 0.3

# Max concurrent scan threads (reduced from 100 to avoid Windows performance issues)
MAX_THREADS = 30


class SimpleDeviceScanner:
    """
    Simple device scanner - Scan local network and detect devices via HTTP

    Features:
    - Use cached network configuration (fast startup)
    - Only scan device sync service port (58923)
    - No full network scan every time
    - Integrates with global_config

    Usage:
        scanner = SimpleDeviceScanner()
        devices = scanner.scan_devices()

        for device in devices:
            print(f"Found: {device['hostname']} at {device['ip']}")
    """

    def __init__(self, port: int = DEVICE_SYNC_PORT):
        """
        Initialize scanner

        Args:
            port: Port to scan (default 58923)
        """
        self.port = port
        self.local_ip = None
        self.network_prefix = None
        self.last_scan_time: float = 0

        # Network cache
        self.network_cache = NetworkCache()

    def scan_devices(self, force_rescan_network: bool = False) -> List[Dict]:
        """
        Scan devices on local network (uses cached network config)

        This method only scans for device sync services (port 58923),
        not the entire network.

        Args:
            force_rescan_network: Force rescan network configuration

        Returns:
            List of device info dicts
        """
        # 1. Get network configuration (from cache or scan once)
        network_info = self.network_cache.get_network_info(force_rescan=force_rescan_network)

        if not network_info:
            logger.error("Cannot get network configuration")
            return []

        self.local_ip = network_info['local_ip']
        self.network_prefix = network_info['network_prefix']

        # 2. Scan only device sync services (port 58923) in network segment
        logger.info(f"Scanning {self.network_prefix}.0/24 for Device Sync services (port {self.port})...")
        start_time = time.time()

        devices = []
        futures = []

        with ThreadPoolExecutor(max_workers=MAX_THREADS) as executor:
            # Scan all IPs (1-255)
            for host_num in range(1, 256):
                ip = f"{self.network_prefix}.{host_num}"
                future = executor.submit(self._scan_device, ip)
                futures.append(future)

            # Collect results
            for future in as_completed(futures):
                device_info = future.result()
                if device_info:
                    devices.append(device_info)
                    logger.info(f"Found device: {device_info['hostname']} ({device_info['ip']})")

        elapsed = time.time() - start_time
        logger.info(f"Scan complete: Found {len(devices)} device(s) in {elapsed:.2f}s")

        # Update last scan time
        self.last_scan_time = time.time()

        # Update global config
        from .config import get_global_config
        config = get_global_config()
        config.update_online_devices(devices)

        return devices

    def scan_all_devices(self) -> List[Dict]:
        """
        Alias for scan_devices() for backward compatibility

        Returns:
            List of device info dicts
        """
        return self.scan_devices()

    def _scan_device(self, ip: str) -> Optional[Dict]:
        """
        Scan single IP address

        1. Test if port is open
        2. If open, fetch device info via HTTP API

        Args:
            ip: IP address

        Returns:
            Device info dict, or None if not a device sync service
        """
        # Skip local IP (avoid duplicate)
        if ip == self.local_ip:
            return None

        # Test port
        if not self._test_http_port(ip, timeout=SCAN_TIMEOUT):
            return None

        # Get device info
        device_info = self._get_device_info(ip)
        return device_info

    def _test_http_port(self, ip: str, timeout: float = SCAN_TIMEOUT) -> bool:
        """
        Test if HTTP port is open

        Args:
            ip: IP address
            timeout: Timeout

        Returns:
            True if port is open
        """
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)

        try:
            result = sock.connect_ex((ip, self.port))
            return result == 0
        except Exception:
            return False
        finally:
            sock.close()

    def _get_device_info(self, ip: str) -> Optional[Dict]:
        """
        Fetch device info via HTTP API

        Args:
            ip: IP address

        Returns:
            Device info dict
        """
        url = f"http://{ip}:{self.port}/api/status"

        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                data = response.read().decode('utf-8')
                info = json.loads(data)

                # Build device info
                device_info = {
                    'ip': ip,
                    'hostname': info.get('hostname', 'unknown'),
                    'device_id': info.get('device_id', 'unknown'),
                    'mode': info.get('mode'),
                    'sync_enabled': info.get('sync_enabled', False),
                    'http_port': self.port,
                    'last_seen': time.time()
                }

                return device_info

        except urllib.error.URLError:
            # Port open but not device sync service
            return None
        except Exception as e:
            logger.debug(f"Failed to get device info from {ip}: {e}")
            return None

    def get_primary_devices(self, devices: List[Dict]) -> List[Dict]:
        """
        Filter PRIMARY devices from device list

        Args:
            devices: Device list

        Returns:
            PRIMARY device list
        """
        return [d for d in devices if d.get('mode') == 'primary']

    def find_primary_device(self) -> Optional[Dict]:
        """
        Scan and find PRIMARY device

        Returns:
            PRIMARY device info, or None if not found or multiple found
        """
        devices = self.scan_devices()
        primary_devices = self.get_primary_devices(devices)

        if len(primary_devices) == 0:
            logger.warning("No primary device found")
            return None

        if len(primary_devices) > 1:
            logger.error(f"Multiple primary devices found: {len(primary_devices)}")
            for i, dev in enumerate(primary_devices, 1):
                logger.error(f"  {i}. {dev['hostname']} ({dev['ip']})")
            return None

        primary = primary_devices[0]
        logger.info(f"Found primary device: {primary['hostname']} ({primary['ip']})")
        return primary

    def scan_if_needed(self, force: bool = False, interval: float = 60.0):
        """
        Scan network if needed (only in SECONDARY mode)

        Args:
            force: Force scan even if recently scanned
            interval: Minimum interval between scans (seconds, default 60)
        """
        from .config import get_global_config
        config = get_global_config()

        # Only scan in SECONDARY mode
        if config.isPrimaryServer:
            return

        # Check if we need to scan
        current_time = time.time()
        time_since_last_scan = current_time - self.last_scan_time

        # Scan every interval seconds, or if forced
        if force or time_since_last_scan > interval:
            self.scan_devices()


# Global scanner instance
_scanner: SimpleDeviceScanner | None = None


def get_network_scanner() -> SimpleDeviceScanner:
    """Get or create global network scanner singleton"""
    global _scanner
    if _scanner is None:
        _scanner = SimpleDeviceScanner()
    return _scanner
