#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Shared Data Types

All dataclasses and named types used across the claude_host application.
"""

from dataclasses import dataclass, field


@dataclass
class CmdResult:
    """Command execution result."""
    returncode: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.returncode == 0

    def __bool__(self) -> bool:
        return self.ok


@dataclass
class UserInfo:
    """System user information."""
    username: str
    uid: int
    gid: int
    home: str
    shell: str
    gecos: str = ""
    groups: list[str] = field(default_factory=list)
    exists: bool = True


@dataclass
class ProcessInfo:
    """Process information."""
    pid: int
    ppid: int
    user: str
    cpu: float
    mem: float
    command: str
    state: str = ""


@dataclass
class MemoryInfo:
    """Memory information (MB)."""
    total: int
    available: int
    used: int
    swap_total: int
    swap_used: int


@dataclass
class DiskInfo:
    """Disk partition information."""
    device: str
    mount: str
    fstype: str
    total_gb: float
    used_gb: float
    avail_gb: float
    use_percent: int


@dataclass
class NetInterface:
    """Network interface information."""
    name: str
    ipv4: list[str] = field(default_factory=list)
    ipv6: list[str] = field(default_factory=list)
    mac: str = ""
    state: str = ""


@dataclass
class SystemInfo:
    """Aggregated system information."""
    hostname: str
    kernel: str
    arch: str
    distro: str
    distro_version: str
    uptime_seconds: float
    load_avg: tuple[float, float, float]
    cpu_count: int
    memory: MemoryInfo
    disks: list[DiskInfo]
    network: list[NetInterface]


@dataclass
class ServiceStatus:
    """Systemd service status."""
    name: str
    active: str
    enabled: bool
    description: str = ""
    pid: int | None = None
