# -*- coding: utf-8 -*-
"""
HTTP Device Discovery - Network Device Discovery via HTTP

Auto-discover primary devices on local network using HTTP requests.

Strategy:
1. Detect local network segment
2. Scan network for HTTP servers (port 58923)
3. Verify via /api/discover endpoint
4. Cache primary device address

Port: 58923 (unique HTTP port)
"""

import ipaddress
import socket
import json
from typing import Optional, List, Dict
from pycore.pyfoundations.serialized_worker import map_bus_tasks
import urllib.request
import urllib.error

import time


DEFAULT_HTTP_PORT = 58923
DISCOVERY_TIMEOUT = 1.0
MAX_THREADS = 100


class HTTPDeviceDiscovery:
    """
    HTTP-based device discovery for finding primary sync servers.

    Usage:
        discovery = HTTPDeviceDiscovery()
        primary = discovery.find_primary_device()

        if primary:
            print(f"Found primary at {primary['host']}:{primary['port']}")
    """

    def __init__(self, http_port: int = DEFAULT_HTTP_PORT):
        """
        Initialize device discovery.

        Args:
            http_port: HTTP server port to scan
        """
        self.http_port = http_port
        self.cached_primary: Optional[Dict] = None

    def find_primary_device(self, use_cache: bool = True) -> Optional[Dict]:
        """
        Find primary device on network via HTTP.

        Args:
            use_cache: Use cached result if available

        Returns:
            Primary device info dict or None:
            {
                'host': '192.168.1.100',
                'port': 58923,
                'response_time': 0.123,
                'conflict': False
            }
        """
        # Use cache if available
        if use_cache and self.cached_primary:
            if self._verify_primary(self.cached_primary['host']):
                return self.cached_primary

        # Detect local network
        network = self._detect_network()
        if not network:
            print("[HTTPDiscovery] Failed to detect network")
            return None

        print(f"[HTTPDiscovery] Scanning network: {network}")

        # Scan network for primary device
        devices = self._scan_network(network)

        if not devices:
            print("[HTTPDiscovery] No primary device found")
            return None

        # Check for multiple primary devices (conflict)
        if len(devices) > 1:
            print(f"[HTTPDiscovery] WARNING: Multiple primary devices found ({len(devices)})")
            for i, dev in enumerate(devices, 1):
                print(f"[HTTPDiscovery]   {i}. {dev['host']}:{dev['port']}")
            print("[HTTPDiscovery] This will cause sync conflicts!")

            # Mark first device as conflicted
            primary = devices[0]
            primary['conflict'] = True
            primary['conflict_count'] = len(devices)
            primary['conflict_hosts'] = [d['host'] for d in devices]
            self.cached_primary = primary
            return primary

        # Single primary device found (normal)
        primary = devices[0]
        primary['conflict'] = False
        self.cached_primary = primary
        print(f"[HTTPDiscovery] Found primary: {primary['host']}:{primary['port']}")
        return primary

    def _detect_network(self) -> Optional[str]:
        """
        Detect local network CIDR.

        Returns:
            Network CIDR string (e.g., '192.168.1.0/24')
        """
        local_ip = self._get_local_ip()
        if not local_ip:
            return None

        # Assume /24 subnet
        ip_parts = local_ip.split('.')
        if len(ip_parts) != 4:
            return None

        network_prefix = '.'.join(ip_parts[:3])
        return f"{network_prefix}.0/24"

    def _get_local_ip(self) -> Optional[str]:
        """
        Get local IP address.

        Returns:
            Local IP string
        """
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(1)
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except Exception:
            try:
                hostname = socket.gethostname()
                return socket.gethostbyname(hostname)
            except Exception:
                return None

    def _scan_network(self, network: str) -> List[Dict]:
        """
        Scan network for HTTP servers.

        Args:
            network: Network CIDR

        Returns:
            List of found devices
        """
        network_obj = ipaddress.ip_network(network, strict=False)
        network_prefix = str(network_obj).split('/')[0].rsplit('.', 1)[0]

        found_devices = []
        addresses = [f"{network_prefix}.{host_num}" for host_num in range(1, 256)]
        for result in map_bus_tasks(
            self._probe_device,
            addresses,
            MAX_THREADS,
            thread_prefix="LegacyHttpProbe",
        ):
            if result:
                found_devices.append(result)

        return sorted(found_devices, key=lambda d: d['response_time'])

    def _probe_device(self, ip: str) -> Optional[Dict]:
        """
        Probe single IP for HTTP server via /api/discover.

        Args:
            ip: IP address

        Returns:
            Device info dict or None
        """

        url = f"http://{ip}:{self.http_port}/api/discover"

        try:
            start_time = time.time()

            # Set timeout for discovery
            with urllib.request.urlopen(url, timeout=DISCOVERY_TIMEOUT) as response:
                response_time = time.time() - start_time
                data = response.read().decode('utf-8')
                result = json.loads(data)

                # Check if it's a primary device
                if result.get('status') == 'PRIMARY':
                    return {
                        'host': ip,
                        'port': self.http_port,
                        'response_time': round(response_time, 3)
                    }

        except (urllib.error.URLError, urllib.error.HTTPError, socket.timeout):
            # Device not responding or not a primary device
            pass
        except Exception:
            # Other errors
            pass

        return None

    def _verify_primary(self, host: str) -> bool:
        """
        Verify primary device is still accessible via HTTP ping.

        Args:
            host: Host IP address

        Returns:
            True if accessible
        """
        url = f"http://{host}:{self.http_port}/api/ping"

        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                data = response.read().decode('utf-8')
                result = json.loads(data)
                return result.get('status') == 'PONG'

        except Exception:
            return False

    def get_cached_primary(self) -> Optional[Dict]:
        """
        Get cached primary device.

        Returns:
            Cached primary info or None
        """
        return self.cached_primary

    def clear_cache(self):
        """Clear cached primary device."""
        self.cached_primary = None
