#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Port Utilities - Helper functions for port management

Helps ensure clean takeover during singleton instance replacement.
"""

import errno
import os
import re
import socket
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.process_manager import process_manager
from pycore.pyfoundations.third_party.api import get_third_package_psutil

PORT_COMMAND_TIMEOUT = 5.0
PORT_POLL_SECONDS = 0.2
_SS_PID_RE = re.compile(r"pid=(\d+)")



# Bind refused because the address is taken (Linux EADDRINUSE, Windows WSAEADDRINUSE/WSAEACCES).
_ADDRESS_IN_USE_ERRNOS = frozenset({errno.EADDRINUSE, errno.EACCES, 10048, 10013})


def is_port_in_use(port: int, host: str = '0.0.0.0') -> bool:
    """
    Check if a port is in use

    Args:
        port: Port number to check
        host: Host address (default: 0.0.0.0)

    Returns:
        True if port is in use
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((host, port))
            return False  # Port is available
    except OSError as exc:
        if exc.errno not in _ADDRESS_IN_USE_ERRNOS:
            ColorPrint.red(f"[PortUtils] bind probe {host}:{port} failed: {exc}")
        return True  # Port is in use


def wait_for_port_release(port: int, timeout: float = 5.0, host: str = '0.0.0.0') -> bool:
    """
    Wait for a port to be released

    Args:
        port: Port number to wait for
        timeout: Maximum wait time in seconds
        host: Host address (default: 0.0.0.0)

    Returns:
        True if port was released, False if timeout
    """
    start_time = time.time()
    ColorPrint.blue(f"[PortUtils] Waiting for port {port} to be released...")

    while time.time() - start_time < timeout:
        if not is_port_in_use(port, host):
            ColorPrint.green(f"[PortUtils] Port {port} released after {time.time() - start_time:.1f}s")
            return True
        time.sleep(PORT_POLL_SECONDS)

    ColorPrint.yellow(f"[PortUtils] Timeout waiting for port {port} (waited {timeout}s)")
    return False


def find_available_port(start_port: int, max_attempts: int = 100, host: str = '0.0.0.0') -> Optional[int]:
    """First free port in [start_port, start_port + max_attempts), or None."""
    return next((port for port in range(start_port, start_port + max_attempts) if not is_port_in_use(port, host)), None)


def wait_for_port_bound(port: int, timeout: float, host: str = '0.0.0.0') -> bool:
    """Wait until some process binds the port (a server came up)."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if is_port_in_use(port, host):
            return True
        time.sleep(PORT_POLL_SECONDS)
    return False


def wait_for_multiple_ports(ports: List[int], timeout: float = 5.0, host: str = '0.0.0.0') -> bool:
    """
    Wait for multiple ports to be released

    Args:
        ports: List of port numbers to wait for
        timeout: Maximum wait time in seconds
        host: Host address

    Returns:
        True if all ports were released, False if timeout
    """
    start_time = time.time()
    remaining_ports = set(ports)

    ColorPrint.blue(f"[PortUtils] Waiting for {len(ports)} ports to be released: {ports}")

    while time.time() - start_time < timeout:
        for port in list(remaining_ports):
            if not is_port_in_use(port, host):
                remaining_ports.remove(port)
                ColorPrint.green(f"[PortUtils] Port {port} released")

        if not remaining_ports:
            ColorPrint.green(f"[PortUtils] All ports released after {time.time() - start_time:.1f}s")
            return True

        time.sleep(PORT_POLL_SECONDS)

    if remaining_ports:
        ColorPrint.yellow(f"[PortUtils] Timeout: {len(remaining_ports)} ports still in use: {list(remaining_ports)}")
        return False

    return True


def _netstat_listening_pids(port: int) -> List[int]:
    """Windows: PIDs in LISTENING state on :port from `netstat -ano`."""
    try:
        result = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=PORT_COMMAND_TIMEOUT)
    except (subprocess.SubprocessError, OSError) as e:
        ColorPrint.red(f"[PortUtils] netstat for port {port} failed: {e}")
        return []
    pids = set()
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[1].endswith(f":{port}") and "LISTENING" in line and parts[-1].isdigit():
            pids.add(int(parts[-1]))
    return sorted(pids)


def _ss_listening_pids(port: int) -> Optional[List[int]]:
    """Linux: PIDs from `ss -ltnpH sport = :port`; None when ss is unavailable."""
    try:
        result = subprocess.run(
            ["ss", "-ltnpH", "sport", "=", f":{port}"],
            capture_output=True, text=True, timeout=PORT_COMMAND_TIMEOUT,
        )
    except (subprocess.SubprocessError, OSError) as e:
        ColorPrint.yellow(f"[PortUtils] ss for port {port} unavailable: {e}")
        return None
    return sorted({int(pid) for pid in _SS_PID_RE.findall(result.stdout)})


def _lsof_listening_pids(port: int) -> List[int]:
    try:
        result = subprocess.run(
            ["lsof", "-ti", f"tcp:{port}", "-sTCP:LISTEN"],
            capture_output=True, text=True, timeout=PORT_COMMAND_TIMEOUT,
        )
    except (subprocess.SubprocessError, OSError) as e:
        ColorPrint.red(f"[PortUtils] lsof for port {port} failed: {e}")
        return []
    return sorted({int(line) for line in result.stdout.split() if line.isdigit()})


def find_port_pids(port: int) -> List[int]:
    """PIDs listening on a TCP port: psutil, else netstat (Windows) or ss, then lsof (Unix)."""
    psutil = get_third_package_psutil()
    if psutil is not None:
        try:
            return sorted({
                conn.pid for conn in psutil.net_connections(kind="inet")
                if conn.pid and conn.laddr and conn.laddr.port == port and conn.status == psutil.CONN_LISTEN
            })
        except (psutil.Error, OSError) as e:
            ColorPrint.yellow(f"[PortUtils] psutil connections for port {port} failed: {e}")
    if sys.platform == "win32":
        return _netstat_listening_pids(port)
    pids = _ss_listening_pids(port)
    return pids if pids else _lsof_listening_pids(port)


def port_process_info(port: int) -> Optional[Dict[str, Any]]:
    """{pid, name, cmdline} of the first process listening on port, or None."""
    psutil = get_third_package_psutil()
    pids = find_port_pids(port)
    if not pids:
        return None
    info = {"pid": pids[0], "name": "", "cmdline": ""}
    if psutil is None:
        return info
    try:
        proc = psutil.Process(pids[0])
        info.update(name=proc.name(), cmdline=" ".join(proc.cmdline()))
    except (psutil.Error, OSError) as e:
        ColorPrint.yellow(f"[PortUtils] inspect PID {pids[0]} on port {port} failed: {e}")
    return info


def _program_identity(cmdline: List[str]) -> str:
    """The script or ``-m`` module an interpreter command line runs ('' when none)."""
    args = cmdline[1:]
    for index, arg in enumerate(args):
        if arg == "-m":
            return args[index + 1] if index + 1 < len(args) else ""
        if not arg.startswith("-"):
            return os.path.basename(arg).lower()
    return ""


def retire_older_port_owners(port: int, grace: float) -> bool:
    """End every OLDER process of this same program listening on ``port`` (it gets
    ``grace`` seconds to exit by itself); other programs are left alone.
    Returns True when an older instance was found and is now gone."""
    psutil = get_third_package_psutil()
    if psutil is None:
        return False
    try:
        own = psutil.Process()
        own_identity = _program_identity(own.cmdline())
        own_started = own.create_time()
    except psutil.Error as e:
        ColorPrint.yellow(f"[PortUtils] inspect own process failed: {e}")
        return False
    retired = False
    for pid in find_port_pids(port):
        if pid == own.pid:
            continue
        try:
            owner = psutil.Process(pid)
            cmdline = owner.cmdline()
            started = owner.create_time()
        except psutil.Error as e:
            ColorPrint.yellow(f"[PortUtils] inspect PID {pid} on port {port} failed: {e}")
            continue
        if not own_identity or _program_identity(cmdline) != own_identity or started >= own_started:
            ColorPrint.yellow(f"[PortUtils] Port {port} held by PID {pid} ({' '.join(cmdline)}), not an older instance")
            continue
        ColorPrint.yellow(f"[PortUtils] Port {port} held by older instance PID {pid}; retiring it")
        retired = process_manager.retire_process(pid, grace, started) or retired
    return retired


def kill_process_using_port(port: int, host: str = '0.0.0.0', force: bool = False) -> bool:
    """Terminate the process trees listening on ``port`` (Windows and Linux).

    Each owner gets a graceful terminate, then a forced kill after the grace
    period (``force`` skips nothing; it is kept for callers that ask for a hard
    kill and behaves the same). True when no listening owner is left."""
    pids = find_port_pids(port)
    if not pids:
        return True
    ColorPrint.yellow(f"[PortUtils] Port {port} owned by PIDs {pids}")
    results = [process_manager.kill_process_tree(pid, force=True) for pid in pids]
    return all(results) and not find_port_pids(port)


def ensure_ports_available(ports: List[int], timeout: float = 5.0, force_kill: bool = True) -> bool:
    """
    Ensure ports are available, kill processes if necessary

    Args:
        ports: List of ports that must be available
        timeout: Maximum wait time before forcing
        force_kill: If True, kill processes using the ports

    Returns:
        True if all ports became available
    """
    # First, wait for natural release
    if wait_for_multiple_ports(ports, timeout=timeout):
        return True

    if not force_kill:
        return False

    # Force kill processes still using ports
    ColorPrint.yellow(f"[PortUtils] Force killing processes using ports: {ports}")

    for port in ports:
        if is_port_in_use(port):
            kill_process_using_port(port, force=True)

    # Wait a bit for ports to be released
    time.sleep(1.0)

    # Final check
    still_in_use = [p for p in ports if is_port_in_use(p)]
    if still_in_use:
        ColorPrint.red(f"[PortUtils] Failed to release ports: {still_in_use}")
        return False

    ColorPrint.green(f"[PortUtils] All ports successfully released")
    return True
