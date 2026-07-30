# -*- coding: utf-8 -*-
"""
Foundation system launcher: open path / open dir / open file / start program.
Single place for explorer, xdg-open, open, and in-process start (os.startfile / os.spawnv).

- open_path(path)            : open any path (file or directory) with default app
- open_dir(path)             : open directory in file manager; if path is a file, open its parent dir
- open_file(path)            : open file with default app (must exist and be a file)
- open_file_with_notepad(path): open file with Notepad (Windows) or default text editor (macOS/Linux); accepts str or Path
- start_program(exe)         : launch executable (file) in-process
"""

import os
import subprocess
import sys
from pathlib import Path
from typing import Union

_PATH = Union[str, Path]
_OPEN_TIMEOUT = 5


def _launch_path(p: str) -> bool:
    """Launch path with default app. p is absolute. Returns True if launched, False on OSError."""
    try:
        if sys.platform == "win32":
            os.startfile(p)
            return True
        if sys.platform == "darwin":
            subprocess.run(["open", p], check=False, timeout=_OPEN_TIMEOUT)
            return True
        subprocess.run(["xdg-open", p], check=False, timeout=_OPEN_TIMEOUT)
        return True
    except OSError:
        return False


def open_path(path: _PATH) -> bool:
    """
    Open path (file or directory) with default application.
    Windows: os.startfile. macOS: open. Linux/other: xdg-open.
    No existence check; returns False only on OSError.
    """
    p = os.path.abspath(str(path))
    return _launch_path(p)


def open_dir(path: _PATH) -> bool:
    """
    Open directory in file manager (explorer / Finder / xdg-open).
    If path is a file, opens its parent directory. If path is a directory, opens it.
    Returns False if path does not exist or on OSError.
    """
    p = Path(path).resolve()
    if not p.exists():
        return False
    if p.is_file():
        p = p.parent
    return _launch_path(str(p))


def open_file(path: _PATH) -> bool:
    """
    Open file with default application. Path must exist and be a file.
    Returns False if not a file, missing, or on OSError.
    """
    p = Path(path).resolve()
    if not p.is_file():
        return False
    return _launch_path(str(p))


def open_file_with_notepad(path: _PATH) -> bool:
    """
    Open a file with system Notepad (Windows) or default text editor (macOS/Linux).
    Accepts str or Path. Returns False if path does not exist, is not a file, or launch fails.
    """
    p = Path(path).resolve()
    if not p.exists() or not p.is_file():
        return False
    try:
        if sys.platform == "win32":
            subprocess.Popen(["notepad", str(p)])
            return True
        if sys.platform == "darwin":
            subprocess.Popen(["open", "-e", str(p)])
            return True
        for cmd in ["xdg-open", "gedit", "kate", "nano"]:
            try:
                subprocess.Popen([cmd, str(p)])
                return True
            except FileNotFoundError:
                continue
        return False
    except OSError:
        return False


def start_program(executable_path: _PATH, *args: str) -> bool:
    """
    Start executable in-process: Windows os.startfile, Unix os.spawnv(P_NOWAIT).
    executable_path must be an existing file. Returns False if not a file or on OSError.
    """
    exe = os.path.abspath(str(executable_path))
    if not os.path.isfile(exe):
        return False
    try:
        if sys.platform == "win32":
            os.startfile(exe)
            return True
        argv = [exe] + list(args)
        os.spawnv(os.P_NOWAIT, exe, argv)
        return True
    except OSError:
        return False
