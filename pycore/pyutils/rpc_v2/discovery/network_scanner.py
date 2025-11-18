#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network scanner for locating RPC v2 services.
"""

import http.client
import ipaddress
import json
import socket
import threading
import time
from dataclasses import dataclass, field
from typing import Any, List, Optional

from pycore import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_netifaces

from pycore.pyutils.rpc_v2.config import get_rpc_config
from pycore.pyutils.rpc_v2.protocol.rpc_protocol import RPC_STATUS_PATH

netifaces = get_third_package_netifaces()


@dataclass
class NetworkHost:
    ip: str
    port: int
    is_active: bool = False
    response_time: float = 0.0
    discovered_at: float = field(default_factory=time.time)


class NetworkScanner:
    def __init__(self, debug: bool = False):
        self.debug = debug
        self.config = get_rpc_config()
        self.port = self.config.get_port()
        self.timeout = self.config.scan_timeout
        self.max_threads = 50

    def get_local_network_segments(self) -> List[str]:
        segments: List[str] = []
        for interface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(interface)
            if netifaces.AF_INET in addrs:
                for addr_info in addrs[netifaces.AF_INET]:
                    ip = addr_info.get("addr")
                    netmask = addr_info.get("netmask")
                    if ip and netmask and not ip.startswith("127."):
                        try:
                            network = ipaddress.IPv4Network(f"{ip}/{netmask}", strict=False)
                            segments.append(str(network))
                        except Exception:
                            pass
        if not segments:
            segments = ["192.168.1.0/24", "192.168.0.0/24", "10.0.0.0/24"]
        if self.debug:
            ColorPrint.blue(f"[NetworkScanner] Segments: {segments}")
        return segments

    def scan_network_segment(self, segment: Optional[str] = None) -> List[NetworkHost]:
        segments = [segment] if segment else self.get_local_network_segments()
        hosts: List[NetworkHost] = []
        for seg in segments:
            try:
                network = ipaddress.IPv4Network(seg, strict=False)
                hosts.extend(self._scan_network(network))
            except Exception as exc:
                if self.debug:
                    ColorPrint.red(f"[NetworkScanner] Error scanning {seg}: {exc}")
        return hosts

    def _scan_network(self, network: ipaddress.IPv4Network) -> List[NetworkHost]:
        hosts: List[NetworkHost] = []
        ip_list = list(network.hosts())
        results: List[NetworkHost] = []
        lock = threading.Lock()

        def scan_ip(ip: str):
            host = self._check_host(ip, self.port)
            if host and host.is_active:
                with lock:
                    results.append(host)

        threads: List[threading.Thread] = []
        for idx, ip in enumerate(ip_list):
            if idx % self.max_threads == 0 and idx > 0:
                for thread in threads:
                    thread.join()
                threads = []
            thread = threading.Thread(target=scan_ip, args=(str(ip),), daemon=True)
            thread.start()
            threads.append(thread)
        for thread in threads:
            thread.join()
        hosts.extend(results)
        return hosts

    def _check_host(self, ip: str, port: int) -> Optional[NetworkHost]:
        start = time.time()
        try:
            conn = http.client.HTTPConnection(ip, port, timeout=self.timeout)
            conn.request("GET", RPC_STATUS_PATH)
            response = conn.getresponse()
            if response.status == 200:
                data = response.read().decode("utf-8")
                try:
                    payload = json.loads(data)
                    if payload.get("service") == "FastAPIRPCServer":
                        response_time = time.time() - start
                        return NetworkHost(ip=ip, port=port, is_active=True, response_time=response_time)
                except json.JSONDecodeError:
                    pass
        except Exception:
            return None
        finally:
            try:
                conn.close()
            except Exception:
                pass
        return None


__all__ = ["NetworkScanner", "NetworkHost"]
