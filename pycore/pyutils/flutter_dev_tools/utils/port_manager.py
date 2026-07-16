"""
Port Manager - Safe cleanup of old server processes

This module safely kills old instances of the design documentation server
without affecting other processes.
"""

from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
import sys
import platform
from pathlib import Path
from typing import List, Dict, Optional

import time

import urllib.error




def shutdown_via_http(host: str = "127.0.0.1", port: int = 5757, timeout: int = 5) -> bool:
    """
    Try to shutdown server gracefully via HTTP API.

    Args:
        host: Server host
        port: Server port
        timeout: Request timeout in seconds

    Returns:
        True if shutdown request succeeded
    """
    try:
        import urllib.request

        url = f"http://{host}:{port}/api/shutdown"
        req = urllib.request.Request(url, method='POST')

        print(f"[PORT-CHECK] Attempting graceful shutdown via {url}...")

        with urllib.request.urlopen(req, timeout=timeout) as response:
            data = response.read().decode('utf-8')
            print(f"[PORT-CHECK] Server acknowledged shutdown request")
            return True

    except urllib.error.URLError as e:
        print(f"[PORT-CHECK] HTTP shutdown failed: {e}")
        return False
    except Exception as e:
        print(f"[PORT-CHECK] HTTP shutdown error: {e}")
        return False


def get_process_using_port(port: int) -> Optional[Dict[str, str]]:
    """
    Get process information for the process using a specific port.

    Args:
        port: Port number to check

    Returns:
        Dict with pid, name, and cmdline, or None if port is free
    """
    try:
        if sys.platform == "win32":
            return _get_process_windows(port)
        else:
            return _get_process_unix(port)
    except Exception as e:
        print(f"[WARNING] Failed to check port {port}: {e}")
        return None


def _get_process_windows(port: int) -> Optional[Dict[str, str]]:
    """Get process info on Windows using netstat and tasklist"""
    try:
        # Find PID using netstat
        result = exec_silent(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            timeout=5
        )

        pid = None
        for line in result.stdout.split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.split()
                pid = parts[-1]
                break

        if not pid:
            return None

        # Get process details using tasklist
        result = exec_silent(
            ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/V"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.stdout:
            lines = result.stdout.strip().split('\n')
            if len(lines) > 1:
                # Parse CSV output
                data = lines[1].strip('"').split('","')
                process_name = data[0] if data else ""

                # Get command line using multiple methods
                cmdline = ""

                # Method 1: Try PowerShell (more reliable)
                try:
                    ps_cmd = f'(Get-WmiObject Win32_Process -Filter "ProcessId = {pid}").CommandLine'
                    ps_result = exec_silent(
                        ["powershell", "-NoProfile", "-Command", ps_cmd],
                        capture_output=True,
                        text=True,
                        timeout=5,
                        encoding='utf-8',
                        errors='ignore'
                    )
                    cmdline = ps_result.stdout.strip()
                except Exception:
                    pass  # Silent fallback

                # Method 2: Fallback to wmic if PowerShell failed
                if not cmdline:
                    try:
                        wmic_result = exec_silent(
                            ["wmic", "process", "where", f"ProcessId={pid}", "get", "CommandLine"],
                            capture_output=True,
                            text=True,
                            timeout=5,
                            encoding='utf-8',
                            errors='ignore'
                        )
                        lines = wmic_result.stdout.strip().split('\n')
                        # Skip header line, get actual command
                        if len(lines) > 1:
                            cmdline = lines[1].strip()
                    except Exception:
                        pass  # Silent fallback

                return {
                    "pid": pid,
                    "name": process_name,
                    "cmdline": cmdline
                }

        return None

    except Exception as e:
        print(f"[WARNING] Windows port check failed: {e}")
        return None


def _get_process_unix(port: int) -> Optional[Dict[str, str]]:
    """Get process info on Linux/macOS using lsof"""
    try:
        # Use lsof to find process
        result = exec_silent(
            ["lsof", "-i", f":{port}", "-t"],
            capture_output=True,
            text=True,
            timeout=5
        )

        pid = result.stdout.strip()
        if not pid:
            return None

        # Get process details using ps
        ps_result = exec_silent(
            ["ps", "-p", pid, "-o", "comm=,args="],
            capture_output=True,
            text=True,
            timeout=5
        )

        if ps_result.stdout:
            parts = ps_result.stdout.strip().split(None, 1)
            process_name = parts[0] if parts else ""
            cmdline = parts[1] if len(parts) > 1 else ""

            return {
                "pid": pid,
                "name": process_name,
                "cmdline": cmdline
            }

        return None

    except FileNotFoundError:
        print("[WARNING] lsof not found. Install it or run as root.")
        return None
    except Exception as e:
        print(f"[WARNING] Unix port check failed: {e}")
        return None


def is_our_server_process(process_info: Dict[str, str], port: int = 5757) -> bool:
    """
    Check if the process is our design documentation server.

    Safety checks:
    - Process name must be python/python3/python.exe
    - Command line must contain design_doc_tool.py or main.py
    - Command line must contain flutter_dev_tools OR design_doc OR port 5757

    Args:
        process_info: Process information dict
        port: Expected port number (default 5757)

    Returns:
        True if it's our server process
    """
    if not process_info:
        return False

    name = process_info.get("name", "").lower()
    cmdline = process_info.get("cmdline", "").lower()

    # Check 1: Must be Python process
    is_python = (
        "python" in name or
        name.endswith(".exe") and "python" in name
    )

    if not is_python:
        return False

    # Check 2: Must run our server scripts
    is_our_script = (
        "design_doc_tool.py" in cmdline or
        "design_doc_tool" in cmdline or
        ("main.py" in cmdline and ("flutter_dev_tools" in cmdline or "design" in cmdline))
    )

    if not is_our_script:
        return False

    # Check 3: Must be in flutter_dev_tools directory OR mention our port
    is_our_context = (
        "flutter_dev_tools" in cmdline or
        "design_doc" in cmdline or
        f":{port}" in cmdline or
        str(port) in cmdline
    )

    if not is_our_context:
        return False

    return True


def kill_process(pid: str, force: bool = True) -> bool:
    """
    Kill a process by PID.

    Args:
        pid: Process ID to kill
        force: Use force kill (default True)

    Returns:
        True if successful
    """
    try:
        if sys.platform == "win32":
            # Windows: taskkill
            cmd = ["taskkill", "/PID", pid]
            if force:
                cmd.append("/F")
        else:
            # Unix: kill
            signal = "-9" if force else "-15"
            cmd = ["kill", signal, pid]

        result = exec_silent(cmd, capture_output=True, timeout=5)
        return result.return_code == 0

    except Exception as e:
        print(f"[ERROR] Failed to kill process {pid}: {e}")
        return False


def cleanup_old_server(port: int, auto_kill: bool = True, host: str = "127.0.0.1") -> bool:
    """
    Clean up old server instance on the specified port.

    Strategy:
    1. First try graceful HTTP shutdown
    2. If that fails, try force kill (if it's our process)

    Args:
        port: Port number (default 5757)
        auto_kill: Automatically kill if it's our server (default True)
        host: Server host for HTTP shutdown (default 127.0.0.1)

    Returns:
        True if port is now free or was successfully cleaned
    """
    print(f"\n[PORT-CHECK] Checking port {port}...")

    process_info = get_process_using_port(port)

    if not process_info:
        print(f"[PORT-CHECK] Port {port} is free")
        return True

    pid = process_info["pid"]
    name = process_info["name"]
    cmdline = process_info["cmdline"]

    print(f"[PORT-CHECK] Port {port} is in use:")
    print(f"  PID:     {pid}")
    print(f"  Name:    {name}")
    print(f"  Command: {cmdline[:100] if cmdline else '(unavailable)'}...")

    # Check if it's our server
    if is_our_server_process(process_info, port):
        print(f"[PORT-CHECK] [OK] Identified as our server process")

        if auto_kill:
            # Strategy 1: Try graceful HTTP shutdown first
            if shutdown_via_http(host, port, timeout=3):
                print(f"[PORT-CHECK] Waiting for graceful shutdown...")
                if wait_for_port_release(port, timeout=5):
                    print(f"[PORT-CHECK] [OK] Server shut down gracefully")
                    return True
                else:
                    print(f"[PORT-CHECK] Graceful shutdown timed out, trying force kill...")

            # Strategy 2: Force kill
            print(f"[PORT-CHECK] Killing old server instance (PID: {pid})...")
            if kill_process(pid):
                print(f"[PORT-CHECK] [OK] Successfully killed old server")
                return True
            else:
                print(f"[PORT-CHECK] [FAIL] Failed to kill process")
                return False
        else:
            print(f"[PORT-CHECK] Auto-kill disabled. Please stop it manually.")
            return False
    else:
        print(f"[PORT-CHECK] [FAIL] NOT our server process - will not kill")
        print(f"[PORT-CHECK] Please stop the process manually or use a different port")
        return False


def wait_for_port_release(port: int, timeout: int = 5) -> bool:
    """
    Wait for port to be released after killing process.

    Args:
        port: Port number
        timeout: Maximum wait time in seconds

    Returns:
        True if port is free
    """
    start_time = time.time()

    while time.time() - start_time < timeout:
        process_info = get_process_using_port(port)
        if not process_info:
            return True
        time.sleep(0.5)

    return False
