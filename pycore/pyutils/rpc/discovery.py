# -*- coding: utf-8 -*-
"""Optional LAN discovery client for Pycore HTTP services."""

from __future__ import annotations

import ipaddress
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.net_probe import lan_segments
from pycore.pyfoundations.network_constants import HTTP_STATUS_PATH, PYCORE_HTTP_PORT
from pycore.pyfoundations.service_contract import lan_max_scan_hosts
from pycore.pyutils.common.client_key_auth import client_key_headers
from pycore.pyutils.common.http_client import HttpClient, build_http_base_url


@dataclass(frozen=True)
class HttpServiceHost:
    ip: str
    port: int
    response_time: float
    discovered_at: float = field(default_factory=time.time)
    is_active: bool = True
    hostname: str = ""
    instance_id: str = ""


class HttpServiceScanner:
    """Scan the local RFC 1918 LAN segments for the HTTP status endpoint."""

    def __init__(
        self,
        port: int = PYCORE_HTTP_PORT,
        timeout: float = 2.0,
        batch_size: int = 50,
        max_scan_hosts: int = lan_max_scan_hosts(),
    ) -> None:
        self.port = int(port)
        self.timeout = max(0.1, float(timeout))
        self.batch_size = max(1, int(batch_size))
        self.max_scan_hosts = max(1, int(max_scan_hosts))

    def local_network_segments(self) -> List[Dict[str, str]]:
        return lan_segments(self.max_scan_hosts)

    def scan_network_segment(self, segment: Optional[str] = None) -> List[HttpServiceHost]:
        segments = [segment] if segment else [entry["cidr"] for entry in self.local_network_segments()]
        hosts = []
        for network_value in segments:
            network = ipaddress.IPv4Network(network_value, strict=False)
            hosts.extend(self._scan_network(network))
        return hosts

    def _scan_network(self, network: ipaddress.IPv4Network) -> List[HttpServiceHost]:
        discovered = []
        addresses = tuple(network.hosts())
        for offset in range(0, len(addresses), self.batch_size):
            signals = []
            for address in addresses[offset:offset + self.batch_size]:
                signal = f"http.discovery.{uuid.uuid4().hex}"
                signals.append(signal)
                start_bus_task(
                    self._check_host,
                    str(address),
                    thread_name="HttpDiscoveryThread",
                    response_signal=signal,
                )
            for signal in signals:
                response = THREAD_BUS.wait_signal(signal, timeout=self.timeout + 1.0)
                THREAD_BUS.clear_signal(signal)
                if not isinstance(response, dict) or not response.get("success"):
                    continue
                host = response.get("result")
                if isinstance(host, HttpServiceHost):
                    discovered.append(host)
        return discovered

    def _check_host(self, ip: str) -> Optional[HttpServiceHost]:
        started_at = time.monotonic()
        base_url = build_http_base_url(ip, self.port)
        client = HttpClient(
            base_url=base_url,
            default_timeout=self.timeout,
            trust_env=False,
        )
        # A LAN pycore admits only K3-signed machine callers (K7).
        response = client.get(
            HTTP_STATUS_PATH,
            headers=client_key_headers("GET", base_url.rstrip("/") + HTTP_STATUS_PATH),
        )
        payload = response.json() if response.status_code == 200 else {}
        if not isinstance(payload, dict) or not payload.get("is_http_service"):
            return None
        return HttpServiceHost(
            ip=ip,
            port=self.port,
            response_time=time.monotonic() - started_at,
            hostname=str(payload.get("hostname") or ""),
            instance_id=str(payload.get("instance_id") or ""),
        )


http_service_scanner = HttpServiceScanner()


__all__ = ["HttpServiceHost", "HttpServiceScanner", "http_service_scanner"]
