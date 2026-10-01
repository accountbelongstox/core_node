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
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional, Union
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

_PATH = Union[str, Path]
_WINDOWS_NOTEPAD = "notepad.exe"
_LINUX_FALLBACK_EDITORS = ("gnome-text-editor", "gedit", "kate", "mousepad", "xed")


def _spawn_detached(argv: list) -> bool:
    """Start argv in its own session with no inherited pipes (opener may outlive us)."""
    try:
        subprocess.Popen(
            argv,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
            close_fds=True,
        )
    except OSError as exc:
        ColorPrint.yellow(f"[SystemLauncher] start {argv[0]} failed: {exc}")
        return False
    return True


def _launch_path(p: str) -> bool:
    """Launch path with default app. p is absolute. Returns True if launched, False on OSError."""
    if sys.platform == "win32":
        try:
            os.startfile(p)
        except OSError as exc:
            ColorPrint.yellow(f"[SystemLauncher] open {p} failed: {exc}")
            return False
        return True
    if sys.platform == "darwin":
        return _spawn_detached(["open", p])
    return _spawn_detached(["xdg-open", p])


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


def open_file_with_notepad(path: _PATH, editor: Optional[str] = None) -> bool:
    """
    Open a file in a text editor: Windows notepad.exe; macOS TextEdit; Linux the
    given editor binary (e.g. the resolved default text editor), else xdg-open.
    Returns False if path is not a file or no launcher could be started.
    """
    p = Path(path).resolve()
    if not p.is_file():
        return False
    if sys.platform == "win32":
        return _spawn_detached([_WINDOWS_NOTEPAD, str(p)])
    if sys.platform == "darwin":
        return _spawn_detached(["open", "-e", str(p)])
    for candidate in (editor, "xdg-open", *_LINUX_FALLBACK_EDITORS):
        if candidate and shutil.which(candidate) and _spawn_detached([candidate, str(p)]):
            return True
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
    except OSError as exc:
        ColorPrint.yellow(f"[SystemLauncher] start {exe} failed: {exc}")
        return False
