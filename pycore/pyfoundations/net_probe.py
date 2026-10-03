# -*- coding: utf-8 -*-
import ipaddress
import socket
from typing import Dict, FrozenSet, List, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_psutil

LOOPBACK_IPV4 = "127.0.0.1"
ROUTE_PROBE_HOST = "8.8.8.8"
ROUTE_PROBE_PORT = 80
# RFC 1918 networks: the LAN addresses a phone on the same network can reach
# (CGNAT ranges such as Tailscale's 100.64/10 are excluded).
PRIVATE_LAN_NETWORKS = tuple(
    ipaddress.ip_network(cidr) for cidr in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
)
# Container, hypervisor and VPN interfaces carry addresses no phone or peer machine shares.
VIRTUAL_INTERFACE_PREFIXES = (
    "docker", "br-", "veth", "virbr", "vmnet", "vboxnet", "cni", "flannel", "podman", "lxc", "lxd",
    "tailscale", "wg", "tun", "tap",
)
MIN_SEGMENT_PREFIX = 30


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


def _lan_interface_addresses() -> List[Tuple[str, str]]:
    """(address, netmask) of every up, physical-looking interface that holds an RFC 1918 IPv4 address."""
    psutil = get_third_package_psutil()
    stats = psutil.net_if_stats()
    entries: List[Tuple[str, str]] = []
    for name, addresses in psutil.net_if_addrs().items():
        if name.lower().startswith(VIRTUAL_INTERFACE_PREFIXES) or not (name in stats and stats[name].isup):
            continue
        for address in addresses:
            if address.family != socket.AF_INET or not address.address or not address.netmask:
                continue
            if any(ipaddress.ip_address(address.address) in network for network in PRIVATE_LAN_NETWORKS):
                entries.append((address.address, address.netmask))
    return entries


def own_lan_addresses() -> FrozenSet[str]:
    """RFC 1918 IPv4 addresses held by this machine's physical interfaces."""
    return frozenset(address for address, _netmask in _lan_interface_addresses())


def lan_segments(max_hosts: int) -> List[Dict[str, str]]:
    """[{cidr, address}] of the LAN segments this machine sits on, the default-route one first.

    A segment wider than ``max_hosts`` hosts is narrowed to the largest block around the
    interface address that fits.
    """
    host_bits = (max_hosts + 2).bit_length() - 1
    default_address = local_lan_ip()
    segments: List[Dict[str, str]] = []
    for address, netmask in sorted(_lan_interface_addresses(), key=lambda entry: entry[0] != default_address):
        network = ipaddress.IPv4Network(f"{address}/{netmask}", strict=False)
        if network.prefixlen > MIN_SEGMENT_PREFIX:
            continue
        if network.max_prefixlen - network.prefixlen > host_bits:
            network = ipaddress.IPv4Network(f"{address}/{network.max_prefixlen - host_bits}", strict=False)
        cidr = str(network)
        if all(segment["cidr"] != cidr for segment in segments):
            segments.append({"cidr": cidr, "address": address})
    return segments


def lan_prefix(ip: str) -> str:
    """Return the /24 prefix of an IPv4 address (``192.168.1``)."""
    parts = ip.split(".")
    if len(parts) != 4:
        return ""
    return ".".join(parts[:3])


__all__ = [
    "LOOPBACK_IPV4",
    "lan_prefix",
    "lan_segments",
    "local_lan_ip",
    "own_lan_addresses",
    "private_lan_ipv4_addresses",
]
