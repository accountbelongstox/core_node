#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Network Manager

Network diagnostics: ping, port check, listening ports, DNS, curl, downloads, firewall.
"""

from pyapps.claude_host.model.data_types import CmdResult
from pyapps.claude_host.service.cmd_utils import run_async, require_root


class NetworkManager:
    """Network diagnostics and configuration."""

    @staticmethod
    async def ping(host: str, count: int = 3, timeout: int = 5) -> CmdResult:
        return await run_async(
            "ping", "-c", str(count), "-W", str(timeout), host,
            timeout=count * timeout + 5,
        )

    @staticmethod
    async def port_check(host: str, port: int, timeout: int = 3) -> bool:
        result = await run_async(
            "bash", "-c",
            f"timeout {timeout} bash -c 'echo > /dev/tcp/{host}/{port}' 2>/dev/null",
            timeout=timeout + 2,
        )
        return result.ok

    @staticmethod
    async def listening_ports() -> list[dict]:
        result = await run_async("ss", "-tlnp")
        if not result.ok:
            return []
        ports = []
        for line in result.stdout.splitlines()[1:]:
            parts = line.split()
            if len(parts) >= 5:
                local = parts[3]
                proc = parts[5] if len(parts) > 5 else ""
                ports.append({"local": local, "process": proc})
        return ports

    @staticmethod
    async def dns_resolve(hostname: str) -> CmdResult:
        return await run_async("getent", "hosts", hostname)

    @staticmethod
    async def curl(url: str, timeout: int = 10, method: str = "GET") -> CmdResult:
        cmd = [
            "curl", "-s", "-S", "-o", "/dev/null", "-w", "%{http_code}",
            "--max-time", str(timeout),
        ]
        if method != "GET":
            cmd.extend(["-X", method])
        cmd.append(url)
        return await run_async(*cmd, timeout=timeout + 5)

    @staticmethod
    async def download(url: str, dest: str, timeout: int = 60) -> CmdResult:
        return await run_async(
            "curl", "-fsSL", "-o", dest, "--max-time", str(timeout), url,
            timeout=timeout + 10,
        )

    @staticmethod
    async def set_hostname(name: str) -> CmdResult:
        require_root("set hostname")
        return await run_async("hostnamectl", "set-hostname", name)

    @staticmethod
    async def firewall_allow(port: int, proto: str = "tcp") -> CmdResult:
        require_root("firewall rule")
        return await run_async(
            "iptables", "-A", "INPUT", "-p", proto,
            "--dport", str(port), "-j", "ACCEPT",
        )

    @staticmethod
    async def firewall_list() -> CmdResult:
        return await run_async("iptables", "-L", "-n", "--line-numbers")
