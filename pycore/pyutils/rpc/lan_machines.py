# -*- coding: utf-8 -*-
"""Background-refreshed list of the pycore machines on this machine's LAN segments."""

import ipaddress
import time
from typing import Any, Dict, List

from pycore.pyfoundations.net_probe import own_lan_addresses
from pycore.pyfoundations.serialized_worker import RunningFlag, SerializedValue, start_bus_task
from pycore.pyfoundations.service_contract import lan_cache_seconds
from pycore.pyutils.common.http_client import build_http_base_url
from pycore.pyutils.rpc.discovery import HttpServiceHost, HttpServiceScanner

LAN_PROBE_TIMEOUT_SECONDS = 1.0
LAN_PROBE_BATCH_SIZE = 128


def _empty_scan() -> Dict[str, Any]:
    return {"cidrs": [], "machines": [], "scanned_at": 0.0}


class LanMachines:
    """Serves the cached scan at once and refreshes it on a bus thread, one scan at a time."""

    def __init__(self) -> None:
        self._scanner = HttpServiceScanner(timeout=LAN_PROBE_TIMEOUT_SECONDS, batch_size=LAN_PROBE_BATCH_SIZE)
        self._cache_seconds = lan_cache_seconds()
        self._scan = SerializedValue(_empty_scan(), "LanMachinesCacheThread")
        self._scanning = RunningFlag("lan_machines_scan")

    def snapshot(self) -> Dict[str, Any]:
        """{segments, machines, scanned_at, scanning}; starts a refresh when the cache is empty or stale."""
        segments = self._scanner.local_network_segments()
        cidrs = [segment["cidr"] for segment in segments]
        scan = self._scan.get()
        if scan["cidrs"] != cidrs:
            scan = _empty_scan()
        if time.time() - scan["scanned_at"] > self._cache_seconds and self._scanning.start():
            try:
                start_bus_task(self._refresh, segments, thread_name="LanMachinesScanThread")
            except Exception:
                self._scanning.stop()
                raise
        return {
            "segments": segments,
            "machines": scan["machines"],
            "scanned_at": scan["scanned_at"],
            "scanning": self._scanning.is_running(),
        }

    def _refresh(self, segments: List[Dict[str, str]]) -> None:
        try:
            hosts: List[HttpServiceHost] = []
            for segment in segments:
                hosts.extend(self._scanner.scan_network_segment(segment["cidr"]))
            own = own_lan_addresses()
            machines = [
                {
                    "ip": host.ip,
                    "url": build_http_base_url(host.ip, host.port),
                    "hostname": host.hostname,
                    "instance_id": host.instance_id,
                    "ms": round(host.response_time * 1000),
                    "self": host.ip in own,
                }
                for host in sorted(hosts, key=lambda found: ipaddress.IPv4Address(found.ip))
            ]
            self._scan.set({
                "cidrs": [segment["cidr"] for segment in segments],
                "machines": machines,
                "scanned_at": time.time(),
            })
        finally:
            self._scanning.stop()


lan_machines = LanMachines()


__all__ = ["LanMachines", "lan_machines"]
