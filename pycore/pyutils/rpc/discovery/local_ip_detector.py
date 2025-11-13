#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Local IP Detector - Detects local LAN IP address

Provides methods to detect and confirm local LAN IP address.
"""

import socket
import ipaddress
from pycore.pyfoundations.third_party import netifaces
from typing import Optional

from pycore import ColorPrint


def get_local_lan_ip(debug: bool = False) -> Optional[str]:
    """
    Get local LAN IP address (not localhost)
    
    Detects the local IP address on the LAN, excluding:
    - 127.0.0.1 (localhost)
    - 169.254.x.x (link-local)
    
    Args:
        debug: Enable debug output
    
    Returns:
        Local LAN IP address or None
    """
    try:
        # Method 1: Connect to external address to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            # Connect to a non-routable address (doesn't actually send data)
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            s.close()
            
            # Filter out localhost and link-local
            if not local_ip.startswith('127.') and not local_ip.startswith('169.254.'):
                if debug:
                    ColorPrint.blue(f"[LocalIPDetector] Detected local LAN IP: {local_ip}")
                return local_ip
        except Exception:
            s.close()
        
        # Method 2: Use hostname
        try:
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            if not local_ip.startswith('127.') and not local_ip.startswith('169.254.'):
                if debug:
                    ColorPrint.blue(f"[LocalIPDetector] Detected local LAN IP via hostname: {local_ip}")
                return local_ip
        except Exception:
            pass
        
        # Method 3: Use netifaces
        for interface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(interface)
            if netifaces.AF_INET in addrs:
                for addr_info in addrs[netifaces.AF_INET]:
                    ip = addr_info.get('addr')
                    if ip and not ip.startswith('127.') and not ip.startswith('169.254.'):
                        if debug:
                            ColorPrint.blue(f"[LocalIPDetector] Detected local LAN IP via netifaces: {ip}")
                        return ip
        
        if debug:
            ColorPrint.yellow("[LocalIPDetector] Could not detect local LAN IP")
        
        return None
    
    except Exception as e:
        if debug:
            ColorPrint.red(f"[LocalIPDetector] Error detecting local LAN IP: {e}")
        return None


def confirm_local_lan_ip(ip: str, debug: bool = False) -> bool:
    """
    Confirm if IP address is local LAN IP
    
    Args:
        ip: IP address to check
        debug: Enable debug output
    
    Returns:
        True if IP is local LAN IP
    """
    if ip.startswith('127.'):
        return False  # localhost
    
    if ip.startswith('169.254.'):
        return False  # link-local
    
    try:
        # Check if IP is in local network ranges
        ip_obj = ipaddress.IPv4Address(ip)
        
        # Common private network ranges
        private_ranges = [
            ipaddress.IPv4Network('10.0.0.0/8'),
            ipaddress.IPv4Network('172.16.0.0/12'),
            ipaddress.IPv4Network('192.168.0.0/16')
        ]
        
        for network in private_ranges:
            if ip_obj in network:
                if debug:
                    ColorPrint.green(f"[LocalIPDetector] Confirmed local LAN IP: {ip}")
                return True
        
        # Check if IP matches detected local IP
        detected_ip = get_local_lan_ip(debug=False)
        if detected_ip == ip:
            if debug:
                ColorPrint.green(f"[LocalIPDetector] Confirmed local LAN IP (matches detected): {ip}")
            return True
        
        if debug:
            ColorPrint.yellow(f"[LocalIPDetector] IP {ip} is not confirmed as local LAN IP")
        
        return False
    
    except Exception as e:
        if debug:
            ColorPrint.red(f"[LocalIPDetector] Error confirming local LAN IP: {e}")
        return False


__all__ = ['get_local_lan_ip', 'confirm_local_lan_ip']

