# -*- coding: utf-8 -*-
"""
Network Cache - Network Configuration Cache

Cache network segment information to avoid repeated scanning.

Strategy:
1. First scan: Detect local IP, router IP, network segment
2. Save to cache file (~/.device_sync/network_cache.json)
3. Next startup: Load from cache
4. Validate cache: Ping router IP
5. If router unreachable, rescan and update cache
"""

import json
import socket
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime
import platform
from typing import Optional, Dict
from pathlib import Path
from datetime import datetime

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

CACHE_FILE = Path.home() / '.device_sync' / 'network_cache.json'


class NetworkCache:
    """
    Network configuration cache manager

    Usage:
        cache = NetworkCache()

        # Load or detect network
        network_info = cache.get_network_info()

        ColorPrint.info(f"Network: {network_info['network_prefix']}.0/24")
        ColorPrint.info(f"Router: {network_info['gateway']}")
    """

    def __init__(self):
        """Initialize network cache"""
        self.cache_file = CACHE_FILE
        self.cache_file.parent.mkdir(parents=True, exist_ok=True)

        self.cached_info: Optional[Dict] = None

    def get_network_info(self, force_rescan: bool = False) -> Optional[Dict]:
        """
        Get network information (cached or scanned)

        Args:
            force_rescan: Force rescan even if cache exists

        Returns:
            Network info dict:
            {
                'local_ip': '192.168.50.22',
                'network_prefix': '192.168.50',
                'gateway': '192.168.50.1',
                'cached_at': '2025-01-12 18:30:00'
            }
        """
        if force_rescan:
            ColorPrint.info("Force rescan requested, ignoring cache")
            return self._scan_and_cache()

        # Try to load from cache
        cached = self._load_cache()

        if cached:
            # Validate cache by pinging router
            if self._validate_cache(cached):
                ColorPrint.info(f"Using cached network info (gateway: {cached['gateway']})")
                self.cached_info = cached
                return cached
            else:
                ColorPrint.warning("Cached network info invalid (router unreachable)")

        # Cache miss or invalid, perform scan
        return self._scan_and_cache()

    def _load_cache(self) -> Optional[Dict]:
        """
        Load network info from cache file

        Returns:
            Cached network info or None
        """
        if not self.cache_file.exists():
            ColorPrint.info("No network cache found")
            return None

        try:
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            ColorPrint.info(f"Loaded network cache: {data.get('network_prefix')}.0/24")
            return data

        except Exception as e:
            ColorPrint.error(f"Failed to load network cache: {e}")
            return None

    def _save_cache(self, network_info: Dict):
        """
        Save network info to cache file

        Args:
            network_info: Network information dict
        """
        try:
            # Add cache timestamp
            network_info['cached_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(network_info, f, indent=2)

            ColorPrint.info(f"Saved network cache: {network_info['network_prefix']}.0/24")

        except Exception as e:
            ColorPrint.error(f"Failed to save network cache: {e}")

    def _validate_cache(self, cached_info: Dict) -> bool:
        """
        Validate cached network info by pinging router

        Args:
            cached_info: Cached network information

        Returns:
            True if cache is valid (router reachable)
        """
        gateway = cached_info.get('gateway')

        if not gateway:
            ColorPrint.warning("No gateway in cache")
            return False

        # Ping router to check if network config changed
        is_reachable = self._ping_host(gateway)

        if is_reachable:
            ColorPrint.info(f"Router {gateway} is reachable, cache valid")
            return True
        else:
            ColorPrint.warning(f"Router {gateway} is unreachable, cache invalid")
            return False

    def _scan_and_cache(self) -> Optional[Dict]:
        """
        Scan network and save to cache

        Returns:
            Network info dict
        """
        ColorPrint.info("Scanning network configuration...")

        # 1. Detect local IP
        local_ip = self._detect_local_ip()
        if not local_ip:
            ColorPrint.error("Failed to detect local IP")
            return None

        # 2. Calculate network prefix
        network_prefix = self._calculate_network_prefix(local_ip)
        if not network_prefix:
            ColorPrint.error("Failed to calculate network prefix")
            return None

        # 3. Detect router/gateway
        gateway = self._detect_gateway(network_prefix)
        if not gateway:
            ColorPrint.warning("Failed to detect gateway, using default")
            gateway = f"{network_prefix}.1"

        # Build network info
        network_info = {
            'local_ip': local_ip,
            'network_prefix': network_prefix,
            'gateway': gateway
        }

        # Save to cache
        self._save_cache(network_info)

        self.cached_info = network_info
        return network_info

    def _detect_local_ip(self) -> Optional[str]:
        """
        Detect local IP address

        Returns:
            Local IP string
        """
        # Method 1: Connect to external address
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(1)
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            s.close()

            if local_ip and local_ip != '127.0.0.1':
                ColorPrint.info(f"Detected local IP: {local_ip}")
                return local_ip
        except Exception as e:
            ColorPrint.warning(f"Method 1 failed: {e}")

        # Method 2: Hostname resolution
        try:
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)

            if local_ip and local_ip != '127.0.0.1':
                ColorPrint.info(f"Detected local IP (hostname): {local_ip}")
                return local_ip
        except Exception as e:
            ColorPrint.warning(f"Method 2 failed: {e}")

        return None

    def _calculate_network_prefix(self, ip: str) -> Optional[str]:
        """
        Calculate network prefix (assume /24)

        Args:
            ip: IP address like '192.168.50.22'

        Returns:
            Network prefix like '192.168.50'
        """
        parts = ip.split('.')
        if len(parts) != 4:
            return None

        network_prefix = '.'.join(parts[:3])
        ColorPrint.info(f"Network prefix: {network_prefix}")
        return network_prefix

    def _detect_gateway(self, network_prefix: str) -> Optional[str]:
        """
        Detect router/gateway IP

        Args:
            network_prefix: Network prefix like '192.168.50'

        Returns:
            Gateway IP or None
        """
        # Common gateway patterns
        common_gateways = [
            f"{network_prefix}.1",
            f"{network_prefix}.254",
            '192.168.1.1',
            '192.168.0.1',
        ]

        ColorPrint.info("Detecting gateway...")

        for gateway in common_gateways:
            if self._ping_host(gateway, timeout=1):
                ColorPrint.info(f"Found gateway: {gateway}")
                return gateway

        ColorPrint.warning("Gateway not found")
        return None

    def _ping_host(self, ip: str, timeout: int = 1) -> bool:
        """
        Ping host to check if reachable

        Args:
            ip: IP address to ping
            timeout: Timeout in seconds

        Returns:
            True if host is reachable
        """
        system = platform.system().lower()

        try:
            if system == 'windows':
                # Windows: ping -n 1 -w 1000 192.168.1.1
                # Use CREATE_NO_WINDOW to prevent black console window from appearing
                result = exec_silent(
                    ['ping', '-n', '1', '-w', str(timeout * 1000), ip],
                    capture_output=True,
                    timeout=timeout + 1,
                    creationflags=subprocess.CREATE_NO_WINDOW  # Prevent black window
                )
            else:
                # Linux/Mac: ping -c 1 -W 1 192.168.1.1
                result = exec_silent(
                    ['ping', '-c', '1', '-W', str(timeout), ip],
                    capture_output=True,
                    timeout=timeout + 1
                )

            return result.return_code == 0

        except Exception as e:
            ColorPrint.debug(f"Ping {ip} failed: {e}")
            return False

    def clear_cache(self):
        """Clear network cache file"""
        if self.cache_file.exists():
            self.cache_file.unlink()
            ColorPrint.info("Network cache cleared")

        self.cached_info = None
