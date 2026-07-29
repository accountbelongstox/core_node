#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Network scanner for locating RPC v2 services.
"""

import http.client
import ipaddress
import json
import socket
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.third_party.api import get_third_package_psutil

from pycore.pyutils.rpc_v2.config.rpc_config import get_rpc_config
from pycore.pyutils.rpc_v2.constants import RPC_STATUS_PATH
from pycore.pyfoundations.serialized_worker import start_bus_task

psutil = get_third_package_psutil()


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
        # Use psutil to get network interfaces
        try:
            for interface, addrs in psutil.net_if_addrs().items():
                for addr in addrs:
                    if addr.family == socket.AF_INET:
                        ip = addr.address
                        netmask = addr.netmask
                        if ip and netmask and not ip.startswith("127."):
                            try:
                                network = ipaddress.IPv4Network(f"{ip}/{netmask}", strict=False)
                                segments.append(str(network))
                            except Exception:
                                pass
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
        for start_index in range(0, len(ip_list), self.max_threads):
            response_signals = []
            for ip in ip_list[start_index:start_index + self.max_threads]:
                response_signal = f'pyutils.rpc_v2.scan.{uuid.uuid4().hex}'
                response_signals.append(response_signal)
                start_bus_task(
                    self._check_host,
                    str(ip),
                    self.port,
                    thread_name='RPCNetworkScanThread',
                    response_signal=response_signal,
                )
            for response_signal in response_signals:
                response = THREAD_BUS.wait_signal(
                    response_signal,
                    timeout=self.timeout + 1.0,
                )
                THREAD_BUS.clear_signal(response_signal)
                if not isinstance(response, dict) or not response.get('success'):
                    continue
                host = response.get('result')
                if isinstance(host, NetworkHost) and host.is_active:
                    hosts.append(host)
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
