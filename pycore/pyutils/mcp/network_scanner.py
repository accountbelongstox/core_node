"""
Network Scanner - Local Network Discovery

This module provides network scanning capabilities for detecting:
- Local machine IP address
- Network segment (e.g., 192.168.1.0/24)
- Active hosts on the network
- Router gateway address

Architecture:
1. Fast Detection: Use system network interfaces (preferred)
2. Fallback Detection: Connect to external address to get local IP
3. Router Detection: Probe common gateway addresses
4. Network Scan: Scan entire subnet (1-255) with 500ms timeout

Platform Support:
- Windows: Uses socket and platform-specific commands
- Linux: Uses socket and network interface queries
"""

import socket
import platform
import subprocess
import ipaddress
import threading
import time
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from pycore import ColorPrint


class NetworkScanner:
    """
    Network Scanner for detecting local network configuration.

    This scanner implements a multi-stage detection strategy:
    1. Quick detection using network interfaces
    2. Fallback detection using external connection
    3. Router detection using common gateway addresses
    4. Full network scan with concurrent IP probing

    Usage:
        scanner = NetworkScanner()

        # Detect local IP
        local_ip = scanner.detect_local_ip()

        # Detect network segment
        network_info = scanner.detect_network_segment()

        # Scan for active hosts
        active_hosts = scanner.scan_network_segment(network_info['network'])
    """

    COMMON_GATEWAY_PATTERNS = [
        '192.168.1.1',
        '192.168.0.1',
        '192.168.2.1',
        '10.0.0.1',
        '172.16.0.1',
    ]

    SCAN_TIMEOUT = 0.5
    MAX_SCAN_THREADS = 100

    def __init__(self, debug: bool = False):
        """
        Initialize Network Scanner.

        Args:
            debug: Enable debug output
        """
        self.debug = debug
        self.platform_type = platform.system().lower()
        self.local_ip = None
        self.network_segment = None
        self.gateway_ip = None

    def detect_local_ip(self) -> Optional[str]:
        """
        Detect local machine IP address using multi-stage strategy.

        Strategy:
        1. Quick: Get IP from network interface
        2. Fallback: Connect to external address (8.8.8.8)
        3. Last resort: Parse system commands

        Returns:
            Local IP address string or None if detection failed
        """
        if self.debug:
            ColorPrint.blue("[NetworkScanner] Detecting local IP address...")

        # Stage 1: Quick detection using socket
        local_ip = self._detect_ip_quick()
        if local_ip and self._is_valid_local_ip(local_ip):
            self.local_ip = local_ip
            if self.debug:
                ColorPrint.green(f"[NetworkScanner] Quick detection: {local_ip}")
            return local_ip

        # Stage 2: Fallback detection using external connection
        local_ip = self._detect_ip_fallback()
        if local_ip and self._is_valid_local_ip(local_ip):
            self.local_ip = local_ip
            if self.debug:
                ColorPrint.green(f"[NetworkScanner] Fallback detection: {local_ip}")
            return local_ip

        # Stage 3: Platform-specific detection
        local_ip = self._detect_ip_platform_specific()
        if local_ip and self._is_valid_local_ip(local_ip):
            self.local_ip = local_ip
            if self.debug:
                ColorPrint.green(f"[NetworkScanner] Platform-specific detection: {local_ip}")
            return local_ip

        if self.debug:
            ColorPrint.red("[NetworkScanner] Failed to detect local IP")
        return None

    def _detect_ip_quick(self) -> Optional[str]:
        """
        Quick IP detection using socket hostname resolution.

        Returns:
            IP address or None
        """
        hostname = socket.gethostname()
        if not hostname:
            return None

        ip_address = socket.gethostbyname(hostname)
        return ip_address if ip_address else None

    def _detect_ip_fallback(self) -> Optional[str]:
        """
        Fallback IP detection by connecting to external address.

        This method doesn't actually send data, just establishes socket
        to determine which local interface would be used.

        Returns:
            IP address or None
        """
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        if not sock:
            return None

        sock.settimeout(1)

        # Connect to Google DNS (doesn't actually send data)
        sock.connect(('8.8.8.8', 80))
        local_ip = sock.getsockname()[0]
        sock.close()

        return local_ip if local_ip else None

    def _detect_ip_platform_specific(self) -> Optional[str]:
        """
        Platform-specific IP detection using system commands.

        Returns:
            IP address or None
        """
        if self.platform_type == 'windows':
            return self._detect_ip_windows()
        elif self.platform_type == 'linux':
            return self._detect_ip_linux()
        else:
            return None

    def _detect_ip_windows(self) -> Optional[str]:
        """
        Detect IP on Windows using ipconfig command.

        Returns:
            IP address or None
        """
        result = subprocess.run(
            ['ipconfig'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode != 0:
            return None

        output = result.stdout
        if not output:
            return None

        # Parse ipconfig output for IPv4 addresses
        for line in output.split('\n'):
            line_stripped = line.strip()
            if 'IPv4' in line_stripped and ':' in line_stripped:
                parts = line_stripped.split(':')
                if len(parts) >= 2:
                    ip = parts[1].strip()
                    if self._is_valid_local_ip(ip):
                        return ip

        return None

    def _detect_ip_linux(self) -> Optional[str]:
        """
        Detect IP on Linux using ip or ifconfig command.

        Returns:
            IP address or None
        """
        # Try 'ip addr' command first (modern Linux)
        result = subprocess.run(
            ['ip', 'addr'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0 and result.stdout:
            output = result.stdout
            for line in output.split('\n'):
                line_stripped = line.strip()
                if 'inet ' in line_stripped and 'scope global' in line_stripped:
                    parts = line_stripped.split()
                    if len(parts) >= 2:
                        ip_with_mask = parts[1]
                        ip = ip_with_mask.split('/')[0]
                        if self._is_valid_local_ip(ip):
                            return ip

        # Fallback to ifconfig (older Linux)
        result = subprocess.run(
            ['ifconfig'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0 and result.stdout:
            output = result.stdout
            for line in output.split('\n'):
                line_stripped = line.strip()
                if 'inet ' in line_stripped:
                    parts = line_stripped.split()
                    if len(parts) >= 2:
                        ip = parts[1]
                        if self._is_valid_local_ip(ip):
                            return ip

        return None

    def _is_valid_local_ip(self, ip: str) -> bool:
        """
        Check if IP address is valid local network address.

        Valid local network ranges:
        - 192.168.0.0/16
        - 10.0.0.0/8
        - 172.16.0.0/12

        Args:
            ip: IP address string

        Returns:
            True if valid local IP
        """
        if not ip or ip == '127.0.0.1':
            return False

        ip_obj = ipaddress.ip_address(ip)
        return ip_obj.is_private

    def detect_gateway(self) -> Optional[str]:
        """
        Detect router gateway address.

        Strategy:
        1. Probe common gateway patterns
        2. Use system routing table

        Returns:
            Gateway IP address or None
        """
        if self.debug:
            ColorPrint.blue("[NetworkScanner] Detecting gateway...")

        # Stage 1: Probe common gateway addresses
        for gateway in self.COMMON_GATEWAY_PATTERNS:
            if self._probe_host(gateway, timeout=0.5):
                self.gateway_ip = gateway
                if self.debug:
                    ColorPrint.green(f"[NetworkScanner] Gateway found: {gateway}")
                return gateway

        # Stage 2: Parse routing table
        gateway = self._detect_gateway_from_routing_table()
        if gateway:
            self.gateway_ip = gateway
            if self.debug:
                ColorPrint.green(f"[NetworkScanner] Gateway from routing table: {gateway}")
            return gateway

        if self.debug:
            ColorPrint.yellow("[NetworkScanner] Gateway not detected")
        return None

    def _detect_gateway_from_routing_table(self) -> Optional[str]:
        """
        Extract gateway from system routing table.

        Returns:
            Gateway IP or None
        """
        if self.platform_type == 'windows':
            result = subprocess.run(
                ['route', 'print'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode != 0 or not result.stdout:
                return None

            output = result.stdout
            for line in output.split('\n'):
                line_stripped = line.strip()
                if '0.0.0.0' in line_stripped:
                    parts = line_stripped.split()
                    if len(parts) >= 3:
                        gateway = parts[2]
                        if self._is_valid_local_ip(gateway):
                            return gateway

        elif self.platform_type == 'linux':
            result = subprocess.run(
                ['ip', 'route'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode != 0 or not result.stdout:
                return None

            output = result.stdout
            for line in output.split('\n'):
                line_stripped = line.strip()
                if 'default via' in line_stripped:
                    parts = line_stripped.split()
                    if len(parts) >= 3:
                        gateway = parts[2]
                        if self._is_valid_local_ip(gateway):
                            return gateway

        return None

    def detect_network_segment(self) -> Optional[Dict[str, str]]:
        """
        Detect network segment (subnet) information.

        Returns:
            Dictionary with network info:
            {
                'local_ip': '192.168.1.100',
                'network': '192.168.1.0/24',
                'network_prefix': '192.168.1',
                'gateway': '192.168.1.1'
            }
        """
        if self.debug:
            ColorPrint.blue("[NetworkScanner] Detecting network segment...")

        # Ensure local IP is detected
        local_ip = self.local_ip or self.detect_local_ip()
        if not local_ip:
            if self.debug:
                ColorPrint.red("[NetworkScanner] Cannot detect network segment without local IP")
            return None

        # Parse IP to get network prefix
        ip_parts = local_ip.split('.')
        if len(ip_parts) != 4:
            return None

        # Assume /24 subnet (most common for local networks)
        network_prefix = '.'.join(ip_parts[:3])
        network = f"{network_prefix}.0/24"

        # Detect gateway
        gateway = self.gateway_ip or self.detect_gateway()

        network_info = {
            'local_ip': local_ip,
            'network': network,
            'network_prefix': network_prefix,
            'gateway': gateway or 'unknown'
        }

        self.network_segment = network_info

        if self.debug:
            ColorPrint.green(f"[NetworkScanner] Network segment detected:")
            ColorPrint.blue(f"  Local IP: {local_ip}")
            ColorPrint.blue(f"  Network: {network}")
            ColorPrint.blue(f"  Gateway: {gateway or 'unknown'}")

        return network_info

    def scan_network_segment(self, network: str = None, timeout: float = None) -> List[str]:
        """
        Scan entire network segment for active hosts.

        This performs a concurrent ping sweep of the network (1-255).

        Args:
            network: Network CIDR (e.g., '192.168.1.0/24'), auto-detected if None
            timeout: Timeout per host in seconds (default: 0.5)

        Returns:
            List of active IP addresses
        """
        if timeout is None:
            timeout = self.SCAN_TIMEOUT

        if self.debug:
            ColorPrint.blue(f"[NetworkScanner] Scanning network segment (timeout={timeout}s)...")

        # Auto-detect network if not provided
        if not network:
            network_info = self.network_segment or self.detect_network_segment()
            if not network_info:
                if self.debug:
                    ColorPrint.red("[NetworkScanner] Cannot scan without network segment")
                return []
            network = network_info['network']

        # Parse network CIDR
        network_obj = ipaddress.ip_network(network, strict=False)
        network_prefix = str(network_obj).split('/')[0].rsplit('.', 1)[0]

        if self.debug:
            ColorPrint.blue(f"[NetworkScanner] Scanning {network}...")
            start_time = time.time()

        # Scan all IPs (1-255) concurrently
        active_hosts = []
        futures = []

        with ThreadPoolExecutor(max_workers=self.MAX_SCAN_THREADS) as executor:
            for host_num in range(1, 256):
                ip = f"{network_prefix}.{host_num}"
                future = executor.submit(self._probe_host, ip, timeout)
                futures.append((future, ip))

            # Collect results
            for future, ip in futures:
                result = future.result()
                if result:
                    active_hosts.append(ip)
                    if self.debug:
                        ColorPrint.green(f"  [+] {ip}")

        if self.debug:
            elapsed = time.time() - start_time
            ColorPrint.green(f"[NetworkScanner] Scan complete: {len(active_hosts)} active hosts in {elapsed:.2f}s")

        return sorted(active_hosts, key=lambda ip: [int(x) for x in ip.split('.')])

    def _probe_host(self, ip: str, timeout: float) -> bool:
        """
        Probe if host is active by attempting TCP connection.

        This is faster than ICMP ping and doesn't require privileges.

        Args:
            ip: IP address to probe
            timeout: Connection timeout

        Returns:
            True if host responds
        """
        # Try common ports: HTTP (80), HTTPS (443), SSH (22)
        common_ports = [80, 443, 22]

        for port in common_ports:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)

            result = sock.connect_ex((ip, port))
            sock.close()

            # Connection succeeded or refused (host is alive)
            if result == 0 or result == 10061:  # 10061 = WSAECONNREFUSED on Windows
                return True

        return False

    def get_network_info_summary(self) -> Dict[str, any]:
        """
        Get complete network information summary.

        Returns:
            Dictionary with all detected network information
        """
        if not self.local_ip:
            self.detect_local_ip()

        if not self.network_segment:
            self.detect_network_segment()

        return {
            'platform': self.platform_type,
            'local_ip': self.local_ip,
            'gateway': self.gateway_ip,
            'network_segment': self.network_segment,
            'detection_time': time.time()
        }
