#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ADB Command Queue - Serialized ADB command executor

Single module-global singleton that serializes ALL ADB commands so only ONE
runs at a time across every device/thread in the process.

Why a queue (not a lock):
- Windows ADB server has a bug where it cannot handle 19+ concurrent
  device-specific commands (even with -s or ANDROID_SERIAL). Serializing every
  adb invocation through one worker thread eliminates the contention without
  per-call retry/lock logic at call sites.

State ownership:
- The module-global singleton state below (_adb_command_queue,
  _adb_queue_worker_thread, _adb_queue_shutdown) lives ONLY in this module.
  Never re-declare it elsewhere. All callers go through _run_adb_command_via_queue.
"""

import subprocess
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

# ============================================================================
# Module-global singleton state (declared once, here, never re-declared)
# ============================================================================

_ADB_QUEUE = 'pyutils.device.adb.commands'
_ADB_WORKER = SerializedWorkerThread(_ADB_QUEUE, 'ADBCommandThread')
_ADB_WORKER.start()


def _execute_adb_command(cmd: list, env: dict, command_timeout: float):
    """Execute one ADB command on the command-owner thread."""
    return subprocess.run(
        cmd,
        env=env,
        capture_output=True,
        text=True,
        timeout=command_timeout,
        check=False,
    )


def _run_adb_command_via_queue(cmd: list, env: dict, timeout: float = 10.0) -> subprocess.CompletedProcess:
    """
    Run ADB command through the global queue (serialized execution).

    Args:
        cmd: ADB command list (e.g., ['adb', 'reverse', ...])
        env: Environment variables (must include ANDROID_SERIAL)
        timeout: Command timeout (default 10s)

    Returns:
        subprocess.CompletedProcess result

    Raises:
        RuntimeError: If command fails or times out
    """
    # CRITICAL: Ensure MSYS_NO_PATHCONV is set for Git Bash compatibility
    # This prevents path conversion issues on Windows when using Git Bash
    if 'MSYS_NO_PATHCONV' not in env:
        env = env.copy()
        env['MSYS_NO_PATHCONV'] = '1'

    return call_serialized(
        _ADB_QUEUE,
        _execute_adb_command,
        cmd,
        env,
        timeout,
        timeout=timeout + 5.0,
    )


__all__ = [
    '_run_adb_command_via_queue',
]
