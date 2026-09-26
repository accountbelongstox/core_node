# -*- coding: utf-8 -*-
"""
Console line input with a timeout (Windows console and POSIX TTY).

ask_yes_no_timed() prints a caller-localized prompt, waits up to timeout_sec
for a line and falls back to the default answer on timeout, EOF, a non-TTY
stdin or a non-interactive caller, so unattended runs never block.
"""

import os
import sys
import time

IS_WINDOWS = os.name == 'nt'
if IS_WINDOWS:
    import msvcrt
else:
    import select
    import termios

POLL_INTERVAL_SEC = 0.05
YES_ANSWERS = frozenset({'y', 'yes'})
NO_ANSWERS = frozenset({'n', 'no'})
WINDOWS_ENTER_KEYS = ('\r', '\n')
WINDOWS_BACKSPACE_KEY = '\b'
WINDOWS_PREFIX_KEYS = ('\x00', '\xe0')


def stdin_is_interactive() -> bool:
    """True when stdin is an attached terminal that can answer a prompt."""
    return bool(sys.stdin) and sys.stdin.isatty()


def read_line_with_timeout(timeout_sec: float):
    """Return the typed line, or None on timeout / EOF / non-TTY stdin."""
    if not stdin_is_interactive():
        return None
    if IS_WINDOWS:
        return _read_line_windows(timeout_sec)
    return _read_line_posix(timeout_sec)


def _read_line_posix(timeout_sec: float):
    ready, _, _ = select.select([sys.stdin], [], [], max(0.0, timeout_sec))
    if not ready:
        # Drop a partially typed (unterminated) answer so it does not leak
        # into the next prompt.
        termios.tcflush(sys.stdin, termios.TCIFLUSH)
        return None
    line = sys.stdin.readline()
    if line == '':
        return None
    return line


def _read_line_windows(timeout_sec: float):
    deadline = time.monotonic() + max(0.0, timeout_sec)
    chars = []
    while True:
        if not msvcrt.kbhit():
            # The timeout only applies until the first key: once the user
            # starts typing, wait for Enter.
            if not chars and time.monotonic() >= deadline:
                return None
            time.sleep(POLL_INTERVAL_SEC)
            continue
        key = msvcrt.getwch()
        if key in WINDOWS_PREFIX_KEYS:
            msvcrt.getwch()
            continue
        if key in WINDOWS_ENTER_KEYS:
            msvcrt.putwch('\r')
            msvcrt.putwch('\n')
            return ''.join(chars)
        if key == WINDOWS_BACKSPACE_KEY:
            if chars:
                chars.pop()
                msvcrt.putwch('\b')
                msvcrt.putwch(' ')
                msvcrt.putwch('\b')
            continue
        chars.append(key)
        msvcrt.putwch(key)


def ask_yes_no_timed(prompt: str, timeout_sec: float, default_yes: bool = True,
                     interactive: bool = True) -> bool:
    """Ask a yes/no question; the default wins on timeout or when not interactive."""
    sys.stdout.write(prompt)
    sys.stdout.flush()
    if not interactive or timeout_sec <= 0:
        sys.stdout.write('\n')
        sys.stdout.flush()
        return default_yes
    line = read_line_with_timeout(timeout_sec)
    if line is None:
        sys.stdout.write('\n')
        sys.stdout.flush()
        return default_yes
    answer = line.strip().lower()
    if answer in YES_ANSWERS:
        return True
    if answer in NO_ANSWERS:
        return False
    return default_yes
