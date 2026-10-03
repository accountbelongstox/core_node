# -*- coding: utf-8 -*-
import ipaddress
import socket
from typing import List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

LOOPBACK_IPV4 = "127.0.0.1"
ROUTE_PROBE_HOST = "8.8.8.8"
ROUTE_PROBE_PORT = 80
# RFC 1918 networks: the LAN addresses a phone on the same network can reach
# (CGNAT ranges such as Tailscale's 100.64/10 are excluded).
PRIVATE_LAN_NETWORKS = tuple(
    ipaddress.ip_network(cidr) for cidr in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
)


def local_lan_ip() -> str:
    """Return the IPv4 address of the default-route interface (no packet is sent)."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect((ROUTE_PROBE_HOST, ROUTE_PROBE_PORT))
        return str(probe.getsockname()[0])
    except OSError as exc:
        ColorPrint.yellow(f"[net_probe] default-route probe failed: {exc}; using {LOOPBACK_IPV4}")
        return LOOPBACK_IPV4
    finally:
        probe.close()


def private_lan_ipv4_addresses() -> List[str]:
    """RFC 1918 IPv4 addresses of this machine, the default-route one first."""
    candidates = [local_lan_ip()]
    try:
        candidates.extend(str(info[4][0]) for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET))
    except OSError as exc:
        ColorPrint.yellow(f"[net_probe] hostname address lookup failed: {exc}")
    addresses: List[str] = []
    for candidate in candidates:
        try:
            address = ipaddress.ip_address(candidate)
        except ValueError:
            continue
        if any(address in network for network in PRIVATE_LAN_NETWORKS) and candidate not in addresses:
            addresses.append(candidate)
    return addresses


def lan_prefix(ip: str) -> str:
    """Return the /24 prefix of an IPv4 address (``192.168.1``)."""
    parts = ip.split(".")
    if len(parts) != 4:
        return ""
    return ".".join(parts[:3])


__all__ = ["LOOPBACK_IPV4", "local_lan_ip", "lan_prefix", "private_lan_ipv4_addresses"]
