#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ADB Command Queue - Serialized ADB command executor

Serializes ALL ADB commands so only ONE runs at a time across every
device/thread in the process. Windows ADB server cannot handle 19+ concurrent
device-specific commands (even with -s or ANDROID_SERIAL); one owner thread
removes the contention without per-call retry logic at call sites.

Failures never raise: a command that cannot run or times out yields a
CompletedProcess with returncode ADB_FAILED_RETURNCODE and the error in stderr.
"""

import subprocess

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

ADB_FAILED_RETURNCODE = -1
_ADB_QUEUE = 'pyutils.device.adb.commands'
_ADB_WORKER = SerializedWorkerThread(_ADB_QUEUE, 'ADBCommandThread')
_ADB_WORKER.start()


def _failed(cmd: list, error: str) -> subprocess.CompletedProcess:
    ColorPrint.yellow(f"[ADBCommandQueue] command failed {cmd}: {error}")
    return subprocess.CompletedProcess(cmd, ADB_FAILED_RETURNCODE, stdout="", stderr=error)


def _execute_adb_command(cmd: list, env: dict, command_timeout: float) -> subprocess.CompletedProcess:
    """Execute one ADB command on the command-owner thread."""
    try:
        return subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=command_timeout,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return _failed(cmd, str(exc))


def run_adb_command_via_queue(cmd: list, env: dict, timeout: float = 10.0) -> subprocess.CompletedProcess:
    """
    Run an ADB command through the global queue (serialized execution).

    ``env`` must include ANDROID_SERIAL. MSYS_NO_PATHCONV is added for Git Bash
    compatibility on Windows.
    """
    if 'MSYS_NO_PATHCONV' not in env:
        env = env.copy()
        env['MSYS_NO_PATHCONV'] = '1'
    try:
        return call_serialized(
            _ADB_QUEUE,
            _execute_adb_command,
            cmd,
            env,
            timeout,
            timeout=timeout + 5.0,
        )
    except TimeoutError as exc:
        return _failed(cmd, str(exc))


__all__ = [
    'ADB_FAILED_RETURNCODE',
    'run_adb_command_via_queue',
]
