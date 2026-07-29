#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Port Utilities - Helper functions for port management

Helps ensure clean takeover during singleton instance replacement.
"""

import socket
import time
import os
import signal
from typing import List, Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

import subprocess



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
    except OSError:
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
        time.sleep(0.2)

    ColorPrint.yellow(f"[PortUtils] Timeout waiting for port {port} (waited {timeout}s)")
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

        time.sleep(0.2)

    if remaining_ports:
        ColorPrint.yellow(f"[PortUtils] Timeout: {len(remaining_ports)} ports still in use: {list(remaining_ports)}")
        return False

    return True


def kill_process_using_port(port: int, host: str = '0.0.0.0', force: bool = False) -> bool:
    """
    Kill the process using a specific port

    Args:
        port: Port number
        host: Host address
        force: If True, use SIGKILL instead of SIGTERM

    Returns:
        True if process was killed successfully
    """
    try:
        # Find PID using the port (Linux/Unix)

        # Use netstat or ss to find the PID
        try:
            cmd = f"lsof -ti :{port}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=2.0)
            if result.returncode == 0 and result.stdout.strip():
                pid_str = result.stdout.strip().split('\n')[0]
                pid = int(pid_str)

                ColorPrint.yellow(f"[PortUtils] Found process {pid} using port {port}")

                # Kill the process
                sig = signal.SIGKILL if force else signal.SIGTERM
                sig_name = "SIGKILL" if force else "SIGTERM"

                ColorPrint.yellow(f"[PortUtils] Sending {sig_name} to PID {pid}...")
                os.kill(pid, sig)

                # Wait for process to die
                max_wait = 3.0
                start = time.time()
                while time.time() - start < max_wait:
                    try:
                        os.kill(pid, 0)  # Check if still alive
                        time.sleep(0.2)
                    except ProcessLookupError:
                        ColorPrint.green(f"[PortUtils] Process {pid} terminated")
                        return True

                # If still alive after SIGTERM, try SIGKILL
                if not force:
                    ColorPrint.yellow(f"[PortUtils] {sig_name} didn't work, trying SIGKILL...")
                    return kill_process_using_port(port, host, force=True)

                return False

        except subprocess.TimeoutExpired:
            ColorPrint.red(f"[PortUtils] Timeout finding process for port {port}")
            return False
        except Exception as e:
            ColorPrint.red(f"[PortUtils] Error finding process: {e}")
            return False

    except Exception as e:
        ColorPrint.red(f"[PortUtils] Failed to kill process on port {port}: {e}")
        return False

    return False


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
