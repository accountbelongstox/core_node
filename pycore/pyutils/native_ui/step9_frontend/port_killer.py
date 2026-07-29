#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Port Killer - Cross-Platform Port Cleanup Utility

Forcefully kills processes occupying specified ports.
Supports Windows and Linux/macOS.
"""

import os
import platform
from typing import List, Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import exec_silent


def kill_process_on_port(port: int, force: bool = True) -> bool:
    """
    Kill process(es) occupying the specified port

    Args:
        port: Port number to clean
        force: Force kill (SIGKILL on Unix, /F on Windows)

    Returns:
        True if port was cleaned (or already free)
    """
    system = platform.system()

    if system == "Windows":
        return _kill_port_windows(port, force)
    else:
        return _kill_port_unix(port, force)


def _kill_port_windows(port: int, force: bool) -> bool:
    """
    Kill process on Windows using netstat and taskkill

    Args:
        port: Port number
        force: Force kill (/F flag)

    Returns:
        True if successful
    """
    try:
        # Step 1: Find PID using port
        ColorPrint.blue(f"[PortKiller] [Windows] Finding process on port {port}...")

        # netstat -ano | findstr :<port>
        result = exec_silent("netstat -ano", info=False)

        if result.return_code != 0:
            ColorPrint.yellow(f"[PortKiller] netstat failed: {result.stderr}")
            return False

        # Parse netstat output to find PIDs
        pids = set()
        search_pattern = f":{port} "

        for line in result.stdout.splitlines():
            if search_pattern in line and "LISTENING" in line:
                parts = line.split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    if pid.isdigit():
                        pids.add(int(pid))

        if not pids:
            ColorPrint.green(f"[PortKiller] Port {port} is free")
            return True

        ColorPrint.yellow(f"[PortKiller] Found {len(pids)} process(es) on port {port}: {pids}")

        # Step 2: Kill each PID
        killed_count = 0
        for pid in pids:
            try:
                # taskkill /F /PID <pid>
                cmd = ["taskkill", "/PID", str(pid)]
                if force:
                    cmd.insert(1, "/F")

                ColorPrint.blue(f"[PortKiller] Killing PID {pid}...")
                result = exec_silent(cmd, info=False)

                if result.return_code == 0:
                    ColorPrint.green(f"[PortKiller] Successfully killed PID {pid}")
                    killed_count += 1
                else:
                    ColorPrint.yellow(f"[PortKiller] Failed to kill PID {pid}: {result.stderr}")

            except Exception as e:
                ColorPrint.red(f"[PortKiller] Error killing PID {pid}: {e}")

        if killed_count > 0:
            ColorPrint.green(f"[PortKiller] Killed {killed_count} process(es) on port {port}")
            return True
        else:
            ColorPrint.yellow(f"[PortKiller] Could not kill processes on port {port}")
            return False

    except Exception as e:
        ColorPrint.red(f"[PortKiller] [Windows] Error: {e}")
        return False


def _kill_port_unix(port: int, force: bool) -> bool:
    """
    Kill process on Linux/macOS using lsof and kill

    Args:
        port: Port number
        force: Force kill (SIGKILL vs SIGTERM)

    Returns:
        True if successful
    """
    try:
        # Step 1: Find PID using port
        ColorPrint.blue(f"[PortKiller] [Unix] Finding process on port {port}...")

        # lsof -ti :<port>
        result = exec_silent(["lsof", "-ti", f":{port}"], info=False)

        if result.return_code != 0:
            # Port is free (lsof returns 1 if nothing found)
            ColorPrint.green(f"[PortKiller] Port {port} is free")
            return True

        # Parse PIDs
        pids = []
        for line in result.stdout.strip().split('\n'):
            line = line.strip()
            if line.isdigit():
                pids.append(int(line))

        if not pids:
            ColorPrint.green(f"[PortKiller] Port {port} is free")
            return True

        ColorPrint.yellow(f"[PortKiller] Found {len(pids)} process(es) on port {port}: {pids}")

        # Step 2: Kill each PID
        signal = "-9" if force else "-15"
        killed_count = 0

        for pid in pids:
            try:
                # kill -9/-15 <pid>
                ColorPrint.blue(f"[PortKiller] Killing PID {pid} (signal {signal})...")
                result = exec_silent(["kill", signal, str(pid)], info=False)

                if result.return_code == 0:
                    ColorPrint.green(f"[PortKiller] Successfully killed PID {pid}")
                    killed_count += 1
                else:
                    ColorPrint.yellow(f"[PortKiller] Failed to kill PID {pid}: {result.stderr}")

            except Exception as e:
                ColorPrint.red(f"[PortKiller] Error killing PID {pid}: {e}")

        if killed_count > 0:
            ColorPrint.green(f"[PortKiller] Killed {killed_count} process(es) on port {port}")
            return True
        else:
            ColorPrint.yellow(f"[PortKiller] Could not kill processes on port {port}")
            return False

    except FileNotFoundError:
        ColorPrint.red(f"[PortKiller] [Unix] 'lsof' command not found")
        return False
    except Exception as e:
        ColorPrint.red(f"[PortKiller] [Unix] Error: {e}")
        return False


def is_port_available(port: int, host: str = "0.0.0.0") -> bool:
    """
    Check if port is available using system commands (no Python socket)

    Args:
        port: Port number
        host: Host address (ignored, checks all interfaces)

    Returns:
        True if port is available
    """
    system = platform.system()

    try:
        if system == "Windows":
            # netstat -ano | findstr :<port>
            result = exec_silent("netstat -ano", info=False)

            if result.return_code != 0:
                return True  # Command failed, assume available

            # Check if port appears in LISTENING state
            search_pattern = f":{port} "
            for line in result.stdout.splitlines():
                if search_pattern in line and "LISTENING" in line:
                    return False  # Port is occupied

            return True  # Port not found, available

        else:
            # Unix: lsof -ti :<port>
            result = exec_silent(["lsof", "-ti", f":{port}"], info=False)

            # lsof returns 1 if nothing found (port available)
            return result.return_code != 0

    except FileNotFoundError:
        ColorPrint.yellow("[PortKiller] Command not found, assuming port available")
        return True
    except Exception as e:
        ColorPrint.red(f"[PortKiller] Error checking port: {e}")
        return True  # Assume available on error


__all__ = [
    'kill_process_on_port',
    'is_port_available',
]
