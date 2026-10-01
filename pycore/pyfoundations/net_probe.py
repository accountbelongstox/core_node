# -*- coding: utf-8 -*-
import socket

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

LOOPBACK_IPV4 = "127.0.0.1"
ROUTE_PROBE_HOST = "8.8.8.8"
ROUTE_PROBE_PORT = 80


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


def lan_prefix(ip: str) -> str:
    """Return the /24 prefix of an IPv4 address (``192.168.1``)."""
    parts = ip.split(".")
    if len(parts) != 4:
        return ""
    return ".".join(parts[:3])


__all__ = ["LOOPBACK_IPV4", "local_lan_ip", "lan_prefix"]
