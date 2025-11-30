#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Local IP detection helpers for rpc_v2.
"""

import ipaddress
import socket
from typing import Optional

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_netifaces

netifaces = get_third_package_netifaces()


def get_local_lan_ip(debug: bool = False) -> Optional[str]:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            local_ip = sock.getsockname()[0]
            if not local_ip.startswith(("127.", "169.254.")):
                if debug:
                    ColorPrint.blue(f"[LocalIPDetector] Detected local LAN IP: {local_ip}")
                return local_ip
    except Exception:
        pass

    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        if not local_ip.startswith(("127.", "169.254.")):
            if debug:
                ColorPrint.blue(f"[LocalIPDetector] Hostname LAN IP: {local_ip}")
            return local_ip
    except Exception:
        pass

    for interface in netifaces.interfaces():
        addrs = netifaces.ifaddresses(interface)
        if netifaces.AF_INET in addrs:
            for addr_info in addrs[netifaces.AF_INET]:
                ip = addr_info.get("addr")
                if ip and not ip.startswith(("127.", "169.254.")):
                    if debug:
                        ColorPrint.blue(f"[LocalIPDetector] Netifaces LAN IP: {ip}")
                    return ip

    if debug:
        ColorPrint.yellow("[LocalIPDetector] Could not detect local LAN IP")
    return None


def confirm_local_lan_ip(ip: str, debug: bool = False) -> bool:
    if ip.startswith(("127.", "169.254.")):
        return False
    try:
        ip_obj = ipaddress.IPv4Address(ip)
        private_ranges = [
            ipaddress.IPv4Network("10.0.0.0/8"),
            ipaddress.IPv4Network("172.16.0.0/12"),
            ipaddress.IPv4Network("192.168.0.0/16"),
        ]
        if any(ip_obj in network for network in private_ranges):
            if debug:
                ColorPrint.green(f"[LocalIPDetector] Confirmed LAN IP: {ip}")
            return True
        detected = get_local_lan_ip(debug=False)
        return detected == ip
    except Exception as exc:
        if debug:
            ColorPrint.red(f"[LocalIPDetector] Error confirming LAN IP: {exc}")
        return False


__all__ = ["get_local_lan_ip", "confirm_local_lan_ip"]
