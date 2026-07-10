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

import os
import queue
import subprocess
import threading
from typing import Optional

# ============================================================================
# Module-global singleton state (declared once, here, never re-declared)
# ============================================================================

# Global ADB command queue
_adb_command_queue: queue.Queue = queue.Queue()
_adb_queue_worker_thread: Optional[threading.Thread] = None
_adb_queue_shutdown = threading.Event()


def _adb_queue_worker():
    """
    Worker thread that processes ADB commands sequentially from the queue.

    This ensures only ONE ADB command runs at a time across all devices,
    avoiding the Windows ADB server bug with 19+ concurrent devices.
    """
    print("[ADB Queue Worker] Started")

    while not _adb_queue_shutdown.is_set():
        try:
            # Get command from queue (timeout 1s to check shutdown periodically)
            item = _adb_command_queue.get(timeout=1.0)

            if item is None:  # Poison pill
                break

            cmd, env, result_event, result_container = item

            try:
                # Execute ADB command (serialized)
                result = subprocess.run(
                    cmd,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=10,
                    check=False
                )
                result_container['result'] = result
                result_container['error'] = None
            except Exception as e:
                result_container['result'] = None
                result_container['error'] = e
            finally:
                # Signal completion
                result_event.set()
                _adb_command_queue.task_done()

        except queue.Empty:
            continue

    print("[ADB Queue Worker] Stopped")


def _ensure_adb_queue_worker():
    """Ensure ADB queue worker thread is running"""
    global _adb_queue_worker_thread

    if _adb_queue_worker_thread is None or not _adb_queue_worker_thread.is_alive():
        _adb_queue_shutdown.clear()
        _adb_queue_worker_thread = threading.Thread(
            target=_adb_queue_worker,
            daemon=True,
            name="ADB-Queue-Worker"
        )
        _adb_queue_worker_thread.start()


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
    _ensure_adb_queue_worker()

    # CRITICAL: Ensure MSYS_NO_PATHCONV is set for Git Bash compatibility
    # This prevents path conversion issues on Windows when using Git Bash
    if 'MSYS_NO_PATHCONV' not in env:
        env = env.copy()
        env['MSYS_NO_PATHCONV'] = '1'

    # Create event and result container
    result_event = threading.Event()
    result_container = {}

    # Add command to queue
    _adb_command_queue.put((cmd, env, result_event, result_container))

    # Wait for completion
    if not result_event.wait(timeout=timeout + 5.0):  # Extra 5s for queue processing
        raise RuntimeError(f"ADB command timeout in queue: {' '.join(cmd)}")

    # Check result
    if result_container.get('error'):
        raise result_container['error']

    return result_container['result']


__all__ = [
    '_adb_command_queue',
    '_adb_queue_worker_thread',
    '_adb_queue_shutdown',
    '_adb_queue_worker',
    '_ensure_adb_queue_worker',
    '_run_adb_command_via_queue',
]
