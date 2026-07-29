#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network Scanner - LAN Device Discovery

Scans local network for devices with ADB port 5555 open (Root devices with WiFi ADB enabled).
Uses fast concurrent scanning with socket connections.
"""

import socket
import ipaddress
import threading
import concurrent.futures
from typing import List, Optional, Set
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class NetworkScanner:
    """
    Network scanner for ADB devices with intelligent IP caching

    Once a device is discovered at an IP, that IP is cached and skipped
    in subsequent scans to improve performance.
    """

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

        # ✅ IP cache: IPs that have discovered devices (skip in future scans)
        self._discovered_ips: Set[str] = set()

        ColorPrint.blue(f"[NetworkScanner] Initialized with IP caching enabled")

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
        Scan network for devices with ADB port open (with intelligent IP skip)

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

        try:
            network = ipaddress.IPv4Network(network_cidr, strict=False)
            all_hosts = [str(ip) for ip in network.hosts()]

            # ✅ Filter out already discovered IPs (optimization)
            hosts_to_scan = [ip for ip in all_hosts if ip not in self._discovered_ips]

            skipped_count = len(all_hosts) - len(hosts_to_scan)
            if skipped_count > 0:
                ColorPrint.blue(f"[NetworkScanner] Skipping {skipped_count} cached IP(s), scanning {len(hosts_to_scan)} IP(s)...")
            else:
                ColorPrint.blue(f"[NetworkScanner] Scanning {network_cidr} for port {self.port}...")

            found_devices: Set[str] = set()

            with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                future_to_ip = {executor.submit(self.scan_ip, ip): ip for ip in hosts_to_scan}

                for future in concurrent.futures.as_completed(future_to_ip):
                    ip = future_to_ip[future]
                    try:
                        if future.result():
                            found_devices.add(ip)
                            # ✅ Cache discovered IP for future scans
                            self._discovered_ips.add(ip)
                            ColorPrint.green(f"[NetworkScanner] Found device at {ip}:{self.port} (cached)")
                    except Exception:
                        pass

            result = sorted(list(found_devices))
            ColorPrint.blue(f"[NetworkScanner] Scan complete: {len(result)} new device(s) found, {len(self._discovered_ips)} total cached")
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

    # ================================================================
    # IP Cache Management API
    # ================================================================

    def cache_ip(self, ip: str) -> None:
        """
        Add IP to discovered cache (will be skipped in future scans)

        Args:
            ip: IP address to cache

        Usage:
            scanner.cache_ip("192.168.31.117")
        """
        if ip not in self._discovered_ips:
            self._discovered_ips.add(ip)
            ColorPrint.blue(f"[NetworkScanner] Cached IP: {ip}")

    def uncache_ip(self, ip: str) -> bool:
        """
        Remove IP from cache (will be scanned again in future)

        Args:
            ip: IP address to uncache

        Returns:
            True if IP was in cache, False otherwise

        Usage:
            # Device went offline, allow re-scanning
            scanner.uncache_ip("192.168.31.117")
        """
        if ip in self._discovered_ips:
            self._discovered_ips.remove(ip)
            ColorPrint.yellow(f"[NetworkScanner] Uncached IP: {ip} (will re-scan)")
            return True
        return False

    def clear_cache(self) -> int:
        """
        Clear all cached IPs (force full network scan next time)

        Returns:
            Number of IPs cleared from cache

        Usage:
            # Reset scanner to scan all IPs again
            cleared = scanner.clear_cache()
        """
        count = len(self._discovered_ips)
        self._discovered_ips.clear()
        ColorPrint.yellow(f"[NetworkScanner] Cache cleared: {count} IP(s) removed")
        return count

    def get_cached_ips(self) -> List[str]:
        """
        Get list of all cached IPs

        Returns:
            Sorted list of cached IP addresses

        Usage:
            cached = scanner.get_cached_ips()
            print(f"Cached IPs: {cached}")
        """
        return sorted(list(self._discovered_ips))

    def is_cached(self, ip: str) -> bool:
        """
        Check if IP is in cache

        Args:
            ip: IP address to check

        Returns:
            True if IP is cached, False otherwise

        Usage:
            if scanner.is_cached("192.168.31.117"):
                print("IP will be skipped in next scan")
        """
        return ip in self._discovered_ips

    def get_cache_stats(self) -> dict:
        """
        Get cache statistics

        Returns:
            Dictionary with cache statistics

        Usage:
            stats = scanner.get_cache_stats()
            print(f"Cached: {stats['cached_count']}, Last scan skipped: {stats['last_skip_count']}")
        """
        return {
            "cached_count": len(self._discovered_ips),
            "cached_ips": self.get_cached_ips(),
        }


# ✅ 创建全局唯一实例（模块级别单例）
network_scanner = NetworkScanner(port=5555, timeout=0.2, max_workers=100)

__all__ = ['NetworkScanner', 'network_scanner']
