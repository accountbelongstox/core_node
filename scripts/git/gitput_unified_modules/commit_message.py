#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Commit message management module
"""

import os
import sys
import time
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple
from gitput_unified_modules.utils import write_color_text

# Auto-continue with the default commit message after this many idle seconds.
COMMIT_MESSAGE_TIMEOUT_SECONDS = 3


def _read_line_with_timeout(timeout: float) -> Tuple[str, bool]:
    """Read a line from stdin, auto-giving up after `timeout` seconds.

    Returns (text, timed_out). On Windows the timeout is per-keystroke (idle);
    on POSIX it is the time allowed to submit the line (press Enter). A
    non-interactive stdin falls back to a plain blocking read.
    """
    try:
        if not sys.stdin.isatty():
            return input(), False
    except Exception:
        return input(), False

    # POSIX: wait up to `timeout` for the line to be submitted.
    try:
        import select
        rlist, _, _ = select.select([sys.stdin], [], [], timeout)
        if rlist:
            return sys.stdin.readline().rstrip("\n"), False
        return "", True
    except (ImportError, OSError):
        pass

    # Windows: read char-by-char, resetting the idle timer on each keystroke.
    try:
        import msvcrt
        buf = []
        deadline = time.monotonic() + timeout
        while True:
            if msvcrt.kbhit():
                ch = msvcrt.getwch()
                if ch in ("\r", "\n"):
                    sys.stdout.write("\n"); sys.stdout.flush()
                    return "".join(buf), False
                if ch == "\x03":  # Ctrl-C
                    raise KeyboardInterrupt
                if ch == "\x08":  # Backspace
                    if buf:
                        buf.pop()
                        sys.stdout.write("\b \b"); sys.stdout.flush()
                else:
                    buf.append(ch)
                    sys.stdout.write(ch); sys.stdout.flush()
                deadline = time.monotonic() + timeout
            elif time.monotonic() >= deadline:
                return "".join(buf), True
            else:
                time.sleep(0.03)
    except ImportError:
        return input(), False


class CommitMessageManager:
    """Manage commit messages within a session"""
    
    def __init__(self):
        self._commit_message: Optional[str] = None
        self._commit_file = Path(tempfile.gettempdir()) / f"git_commit_message_{os.getpid()}"
    
    def get_commit_message(self) -> str:
        """Get commit message (reuse if already set in this session)"""
        # Check if we have a stored commit message
        if self._commit_file.exists():
            stored_message = self._commit_file.read_text(encoding='utf-8').strip()
            if stored_message:
                write_color_text(f"Reusing commit message from this session: {stored_message}", "Cyan")
                self._commit_message = stored_message
                return self._commit_message
        
        # If we already have a message in this session, use it
        if self._commit_message:
            return self._commit_message
        
        # Ask user for input. Auto-continue with the timestamp default after
        # COMMIT_MESSAGE_TIMEOUT_SECONDS so an unattended push does not block.
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        try:
            write_color_text(
                f"Enter commit message ({COMMIT_MESSAGE_TIMEOUT_SECONDS}s timeout -> default: {timestamp}): ",
                "Yellow",
            )
            user_input, timed_out = _read_line_with_timeout(COMMIT_MESSAGE_TIMEOUT_SECONDS)
            user_input = user_input.strip()

            if timed_out and not user_input:
                self._commit_message = timestamp
                write_color_text(
                    f"No input for {COMMIT_MESSAGE_TIMEOUT_SECONDS}s; using timestamp as commit message: {timestamp}",
                    "Cyan",
                )
            elif not user_input:
                self._commit_message = timestamp
                write_color_text(f"Using timestamp as commit message: {timestamp}", "Cyan")
            else:
                self._commit_message = user_input
                write_color_text(f"Using custom commit message: {user_input}", "Green")
        except (EOFError, KeyboardInterrupt):
            self._commit_message = timestamp
            write_color_text(f"Using timestamp as commit message: {timestamp}", "Cyan")
        
        # Store the commit message in a file
        try:
            self._commit_file.write_text(self._commit_message, encoding='utf-8')
        except Exception:
            pass
        
        return self._commit_message


# Global instance
_commit_message_manager = CommitMessageManager()


def get_commit_message() -> str:
    """Get commit message (session-scoped)"""
    return _commit_message_manager.get_commit_message()

