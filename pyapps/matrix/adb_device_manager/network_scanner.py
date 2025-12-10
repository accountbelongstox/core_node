#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network Scanner - LAN Device Discovery

Scans local network for devices with ADB port 5555 open (Root devices with WiFi ADB enabled).
Uses fast concurrent scanning with socket connections.
"""

import socket
import ipaddress
import concurrent.futures
from typing import List, Optional, Set
from pycore import ColorPrint


class NetworkScanner:
    """Network scanner for ADB devices"""

    def __init__(
        self,
        port: int = 5555,
        timeout: float = 0.2,
        max_workers: int = 100
    ):
        """
        Initialize network scanner

        Args:
            port: ADB port to scan (default: 5555)
            timeout: Socket connection timeout (default: 0.2s)
            max_workers: Max concurrent scan threads (default: 100)
        """
        self.port = port
        self.timeout = timeout
        self.max_workers = max_workers

    def scan_ip(self, ip: str) -> bool:
        """
        Check if IP has ADB port open

        Args:
            ip: IP address to check

        Returns:
            True if port is open
        """
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            result = sock.connect_ex((ip, self.port))
            sock.close()
            return result == 0
        except Exception:
            return False

    def get_local_network_range(self) -> Optional[str]:
        """
        Get local network CIDR range

        Returns:
            Network CIDR (e.g., "192.168.1.0/24") or None
        """
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.1)

            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()

            network = ipaddress.IPv4Network(f"{local_ip}/24", strict=False)
            return str(network)

        except Exception as e:
            ColorPrint.yellow(f"[NetworkScanner] Failed to get local network: {e}")
            return None

    def scan_network(self, network_cidr: Optional[str] = None) -> List[str]:
        """
        Scan network for devices with ADB port open

        Args:
            network_cidr: Network CIDR to scan (auto-detect if None)

        Returns:
            List of IP addresses with port open
        """
        if network_cidr is None:
            network_cidr = self.get_local_network_range()

        if not network_cidr:
            ColorPrint.yellow("[NetworkScanner] No network to scan")
            return []

        ColorPrint.blue(f"[NetworkScanner] Scanning {network_cidr} for port {self.port}...")

        try:
            network = ipaddress.IPv4Network(network_cidr, strict=False)
            hosts = [str(ip) for ip in network.hosts()]

            found_devices: Set[str] = set()

            with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                future_to_ip = {executor.submit(self.scan_ip, ip): ip for ip in hosts}

                for future in concurrent.futures.as_completed(future_to_ip):
                    ip = future_to_ip[future]
                    try:
                        if future.result():
                            found_devices.add(ip)
                            ColorPrint.green(f"[NetworkScanner] Found device at {ip}:{self.port}")
                    except Exception:
                        pass

            result = sorted(list(found_devices))
            ColorPrint.blue(f"[NetworkScanner] Scan complete: {len(result)} device(s) found")
            return result

        except Exception as e:
            ColorPrint.red(f"[NetworkScanner] Scan error: {e}")
            return []

    def quick_scan_ips(self, ips: List[str]) -> List[str]:
        """
        Quick scan specific IPs

        Args:
            ips: List of IPs to check

        Returns:
            List of IPs with port open
        """
        found_devices: Set[str] = set()

        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(ips), self.max_workers)) as executor:
            future_to_ip = {executor.submit(self.scan_ip, ip): ip for ip in ips}

            for future in concurrent.futures.as_completed(future_to_ip):
                ip = future_to_ip[future]
                try:
                    if future.result():
                        found_devices.add(ip)
                except Exception:
                    pass

        return sorted(list(found_devices))
