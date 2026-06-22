#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - System Info Collector

Collect hostname, kernel, distro, CPU, memory, disk, and network information.
"""

import asyncio
import json as _json
import os
import platform
import re

from pycore.pyfoundations.pybasecommon.commander import get_command_output
from pyapps.claude_host.model.data_types import (
    DiskInfo,
    MemoryInfo,
    NetInterface,
    SystemInfo,
)
from pyapps.claude_host.service.cmd_utils import run_async


class SystemInfoCollector:
    """System information gathering."""

    @staticmethod
    def hostname() -> str:
        return platform.node()

    @staticmethod
    def kernel() -> str:
        return platform.release()

    @staticmethod
    def arch() -> str:
        return platform.machine()

    @staticmethod
    def distro() -> tuple[str, str]:
        if os.name == "nt":
            return platform.system(), platform.release()
        name, version = "Linux", ""
        if os.path.isfile("/etc/os-release"):
            with open("/etc/os-release") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        name = line.split("=", 1)[1].strip().strip('"')
                    elif line.startswith("VERSION_ID="):
                        version = line.split("=", 1)[1].strip().strip('"')
        return name, version

    @staticmethod
    def cpu_count() -> int:
        return os.cpu_count() or 1

    @staticmethod
    def load_avg() -> tuple[float, float, float]:
        if not hasattr(os, "getloadavg"):
            return (0.0, 0.0, 0.0)
        return os.getloadavg()

    @staticmethod
    def uptime() -> float:
        if not os.path.isfile("/proc/uptime"):
            return 0.0
        with open("/proc/uptime") as f:
            content = f.readline().split()
            return float(content[0]) if content else 0.0

    @staticmethod
    def memory() -> MemoryInfo:
        if os.name == "nt":
            mem_output = get_command_output(
                "wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value"
            )
            total_kb = 0
            free_kb = 0
            for line in mem_output.splitlines():
                line = line.strip()
                if line.startswith("TotalVisibleMemorySize="):
                    total_kb = int(line.split("=", 1)[1].strip() or "0")
                elif line.startswith("FreePhysicalMemory="):
                    free_kb = int(line.split("=", 1)[1].strip() or "0")
            total = total_kb // 1024
            avail = free_kb // 1024
            return MemoryInfo(
                total=total, available=avail,
                used=max(0, total - avail),
                swap_total=0, swap_used=0,
            )

        info: dict[str, int] = {}
        if os.path.isfile("/proc/meminfo"):
            with open("/proc/meminfo") as f:
                for line in f:
                    parts = line.split()
                    if len(parts) >= 2:
                        key = parts[0].rstrip(":")
                        val = parts[1]
                        if val.isdigit():
                            info[key] = int(val) // 1024

        return MemoryInfo(
            total=info.get("MemTotal", 0),
            available=info.get("MemAvailable", 0),
            used=info.get("MemTotal", 0) - info.get("MemAvailable", 0),
            swap_total=info.get("SwapTotal", 0),
            swap_used=info.get("SwapTotal", 0) - info.get("SwapFree", 0),
        )

    @staticmethod
    async def disks() -> list[DiskInfo]:
        result = await run_async(
            "df", "-T",
            "--output=source,fstype,size,used,avail,pcent,target",
            "-x", "tmpfs", "-x", "devtmpfs", "-x", "squashfs",
        )
        if not result.ok:
            return []
        disks = []
        for line in result.stdout.splitlines()[1:]:
            parts = line.split()
            if len(parts) < 7:
                continue
            # Validate numeric fields before conversion
            if not (parts[2].isdigit() and parts[3].isdigit() and parts[4].isdigit()
                    and parts[5].rstrip("%").isdigit()):
                continue
            disks.append(DiskInfo(
                device=parts[0], fstype=parts[1],
                total_gb=int(parts[2]) / 1048576,
                used_gb=int(parts[3]) / 1048576,
                avail_gb=int(parts[4]) / 1048576,
                use_percent=int(parts[5].rstrip("%")),
                mount=parts[6],
            ))
        return disks

    @staticmethod
    async def network_interfaces() -> list[NetInterface]:
        result = await run_async("ip", "-j", "addr", "show")
        if not result.ok:
            return await SystemInfoCollector._network_interfaces_fallback()
        stdout = result.stdout.strip()
        if not stdout or not stdout.startswith("["):
            return []
        data = _json.loads(stdout)

        interfaces = []
        for iface in data:
            name = iface.get("ifname", "")
            if name == "lo":
                continue
            ni = NetInterface(
                name=name,
                state=iface.get("operstate", ""),
                mac=iface.get("address", ""),
            )
            for addr in iface.get("addr_info", []):
                if addr.get("family") == "inet":
                    ni.ipv4.append(f"{addr['local']}/{addr.get('prefixlen', '')}")
                elif addr.get("family") == "inet6":
                    ni.ipv6.append(f"{addr['local']}/{addr.get('prefixlen', '')}")
            interfaces.append(ni)
        return interfaces

    @staticmethod
    async def _network_interfaces_fallback() -> list[NetInterface]:
        result = await run_async("ip", "addr", "show")
        if not result.ok:
            return []
        interfaces = []
        current = None
        for line in result.stdout.splitlines():
            m = re.match(r"\d+:\s+(\S+?):", line)
            if m:
                name = m.group(1)
                if name == "lo":
                    current = None
                    continue
                current = NetInterface(name=name)
                interfaces.append(current)
                if "state UP" in line:
                    current.state = "UP"
                elif "state DOWN" in line:
                    current.state = "DOWN"
                continue
            if current is None:
                continue
            m = re.search(r"inet (\S+)", line)
            if m:
                current.ipv4.append(m.group(1))
            m = re.search(r"inet6 (\S+)", line)
            if m and not m.group(1).startswith("fe80"):
                current.ipv6.append(m.group(1))
            m = re.search(r"link/ether (\S+)", line)
            if m:
                current.mac = m.group(1)
        return interfaces

    @staticmethod
    async def collect() -> SystemInfo:
        distro_name, distro_ver = SystemInfoCollector.distro()
        disks, net = await asyncio.gather(
            SystemInfoCollector.disks(),
            SystemInfoCollector.network_interfaces(),
        )
        return SystemInfo(
            hostname=SystemInfoCollector.hostname(),
            kernel=SystemInfoCollector.kernel(),
            arch=SystemInfoCollector.arch(),
            distro=distro_name,
            distro_version=distro_ver,
            uptime_seconds=SystemInfoCollector.uptime(),
            load_avg=SystemInfoCollector.load_avg(),
            cpu_count=SystemInfoCollector.cpu_count(),
            memory=SystemInfoCollector.memory(),
            disks=disks,
            network=net,
        )
