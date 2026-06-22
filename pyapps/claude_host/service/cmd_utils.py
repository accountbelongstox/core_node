#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host - Command Execution Utilities

Async and sync wrappers for subprocess execution, shared across all services.
"""

import asyncio
import logging
import os
import platform
import subprocess

from pyapps.claude_host.model.data_types import CmdResult

log = logging.getLogger("claude_host.cmd")

IS_UNIX = platform.system() != "Windows"

if IS_UNIX:
    import grp
    import pwd
else:
    grp = None
    pwd = None


async def run_async(
    *args: str,
    timeout: float = 30,
    env: dict | None = None,
    cwd: str | None = None,
    stdin_data: bytes | None = None,
) -> CmdResult:
    """Execute a command asynchronously, return CmdResult."""
    log.debug(f"exec: {' '.join(args)}")
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.PIPE if stdin_data else None,
            env=env,
            cwd=cwd,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=stdin_data), timeout=timeout,
        )
        result = CmdResult(
            returncode=proc.returncode,
            stdout=stdout.decode("utf-8", errors="replace").strip(),
            stderr=stderr.decode("utf-8", errors="replace").strip(),
        )
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        result = CmdResult(-1, "", "Command timed out")
    except FileNotFoundError:
        result = CmdResult(-1, "", f"Command not found: {args[0]}")
    except Exception as e:
        result = CmdResult(-1, "", str(e))

    if not result.ok:
        log.warning(f"exec failed ({result.returncode}): {' '.join(args)} — {result.stderr}")
    return result


def run_sync(*args: str, timeout: float = 30) -> CmdResult:
    """Execute a command synchronously, return CmdResult."""
    log.debug(f"exec_sync: {' '.join(args)}")
    try:
        proc = subprocess.run(args, capture_output=True, timeout=timeout)
        return CmdResult(
            returncode=proc.returncode,
            stdout=proc.stdout.decode("utf-8", errors="replace").strip(),
            stderr=proc.stderr.decode("utf-8", errors="replace").strip(),
        )
    except subprocess.TimeoutExpired:
        return CmdResult(-1, "", "Command timed out")
    except FileNotFoundError:
        return CmdResult(-1, "", f"Command not found: {args[0]}")


def is_root() -> bool:
    """Check if the current process runs as root."""
    if not IS_UNIX:
        return False
    return os.getuid() == 0


def require_root(operation: str):
    """Raise PermissionError if not running as root."""
    if not is_root():
        raise PermissionError(f"Root required for: {operation}")
