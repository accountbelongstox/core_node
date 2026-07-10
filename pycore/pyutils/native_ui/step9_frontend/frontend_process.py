#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend Process Wrappers

Reusable subprocess helpers for the frontend launcher thread. Extracted from
frontend_thread.py so the streaming/highlighting logic is shared and the thread
stays focused on lifecycle/dispatch.

- stream_process_output: real-time stdout streaming (gray) for install/build.
- consume_dev_output: keyword-highlighting stdout consumer for dev servers.
- start_output_consumer: launch consume_dev_output on a daemon thread.
"""

import threading
import subprocess
from typing import List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


# Keywords that mark important dev-server output (always shown, color-coded)
_IMPORTANT_KEYWORDS = [
    'ready', 'vite v', 'local:', 'network:', 'error', 'warn',
    'failed', 'port', 'http://'
]


def popen_streaming(
    command: List[str],
    cwd: str,
    env: Optional[dict] = None
) -> subprocess.Popen:
    """
    Start a subprocess with merged, line-buffered, utf-8 piped stdout.

    The stdout pipe must be consumed (e.g. via ``stream_process_output`` for a
    blocking drain, or ``start_output_consumer`` for a background drain) to
    avoid the child blocking on a full pipe. The caller owns the returned
    ``Popen`` and is responsible for ``wait()``/cleanup.

    Args:
        command: Command list to execute.
        cwd: Working directory for the child process.
        env: Optional environment mapping; ``None`` inherits the parent env.
    """
    return subprocess.Popen(
        command,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        bufsize=1,
    )


def stream_process_output(
    process: subprocess.Popen,
    show_output: bool,
    prefix: str = ""
) -> None:
    """
    Stream a subprocess stdout in real-time (line-buffered, gray).

    Blocks until the stdout pipe is closed. Used by install/build steps that
    only need plain gray echoing of every non-empty line.
    """
    for line in process.stdout:
        stripped = line.strip()
        if stripped and show_output:
            if prefix:
                ColorPrint.gray(f"  {prefix} {stripped}")
            else:
                ColorPrint.gray(f"  {stripped}")


def consume_dev_output(
    process: subprocess.Popen,
    show_output: bool,
    prefix: str = "[vite]"
) -> None:
    """
    Consume a dev-server subprocess stdout with keyword-based highlighting.

    Important lines (ready/error/warn/...) are always shown and color-coded;
    other lines are shown in gray only when ``show_output`` is True. Intended
    to run in a background daemon thread to prevent the dev-server's stdout
    pipe from blocking.
    """
    try:
        for line in process.stdout:
            stripped = line.strip()
            if not stripped:
                continue

            lowered = stripped.lower()
            is_important = any(keyword in lowered for keyword in _IMPORTANT_KEYWORDS)

            if is_important:
                if 'ready' in lowered or 'local:' in lowered:
                    ColorPrint.green(f"  {prefix} {stripped}")
                elif 'error' in lowered or 'failed' in lowered:
                    ColorPrint.red(f"  {prefix} {stripped}")
                elif 'warn' in lowered:
                    ColorPrint.yellow(f"  {prefix} {stripped}")
                else:
                    ColorPrint.cyan(f"  {prefix} {stripped}")
            elif show_output:
                ColorPrint.gray(f"  {prefix} {stripped}")
    except Exception:
        pass


def start_output_consumer(
    process: subprocess.Popen,
    show_output: bool,
    prefix: str = "[vite]"
) -> threading.Thread:
    """
    Start a daemon thread that consumes a dev-server's stdout.

    Returns the started thread so callers may join/track it if desired.
    """
    thread = threading.Thread(
        target=consume_dev_output,
        args=(process, show_output, prefix),
        daemon=True
    )
    thread.start()
    return thread
