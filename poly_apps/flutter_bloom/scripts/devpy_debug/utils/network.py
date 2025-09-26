#!/usr/bin/env python3

import socket
import sys
from typing import List

class NetworkUtility:
    """Network-related utilities for Flutter debugging"""

    @staticmethod
    def get_network_ips() -> List[str]:
        """Get all available network IP addresses"""
        ips = []
        try:
            # Get local machine IP
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            if local_ip != "127.0.0.1":
                ips.append(local_ip)

            # Try to get more accurate network interfaces if available
            try:
                import netifaces
                for interface in netifaces.interfaces():
                    addrs = netifaces.ifaddresses(interface)
                    if netifaces.AF_INET in addrs:
                        for addr_info in addrs[netifaces.AF_INET]:
                            ip = addr_info.get('addr')
                            if ip and ip != '127.0.0.1' and not ip.startswith('169.254'):
                                if ip not in ips:
                                    ips.append(ip)
            except ImportError:
                # netifaces not available, use basic method
                pass

        except Exception as e:
            print(f"[WARNING] Failed to get network IPs: {e}", file=sys.stderr)

        # Always include localhost as fallback
        if "127.0.0.1" not in ips:
            ips.append("127.0.0.1")

        return ips

    @staticmethod
    def get_local_ip_address() -> str:
        """Get the primary local IP address"""
        ips = NetworkUtility.get_network_ips()
        # Prefer non-localhost addresses
        non_localhost = [ip for ip in ips if ip != "127.0.0.1"]
        return non_localhost[0] if non_localhost else "127.0.0.1"

    @staticmethod
    def test_port_available(port: int) -> bool:
        """Test if a port is available for binding"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                result = s.connect_ex(('localhost', port))
                return result != 0
        except Exception:
            return False

    @staticmethod
    def find_available_port(start_port: int = 10000, end_port: int = 10099) -> int:
        """Find the next available port in the specified range"""
        for port in range(start_port, end_port + 1):
            if NetworkUtility.test_port_available(port):
                return port
        return start_port  # Fallback to start port

    @staticmethod
    def show_network_urls(port: int, title: str = "Network URLs", show_copy_hint: bool = False):
        """Display network URLs for testing"""
        print("", file=sys.stderr)
        print("=" * 50, file=sys.stderr)
        print(title, file=sys.stderr)
        print("=" * 50, file=sys.stderr)

        ips = NetworkUtility.get_network_ips()
        for ip in ips:
            url = f"http://{ip}:{port}"
            print(f"  {url}", file=sys.stderr)

        if show_copy_hint:
            print("", file=sys.stderr)
            print("Copy these URLs to test on different devices", file=sys.stderr)
        print("", file=sys.stderr)