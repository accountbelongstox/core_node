# -*- coding: utf-8 -*-
"""Windows guard: console children of a console-less process run without a window.

A tray / autostart / pythonw process has no console, so Windows gives every
console child it starts (ffmpeg, ffprobe, nvidia-smi, git, python, npm ...) a
NEW console window that flashes and takes keyboard focus. Once installed, a
child whose caller did not choose its window (CREATE_NEW_CONSOLE,
DETACHED_PROCESS or CREATE_NO_WINDOW) gets CREATE_NO_WINDOW. Processes attached
to a console are unchanged: their children share that console as before.
"""

import ctypes
import subprocess
import sys
from typing import Any, Callable, Optional

CREATE_NO_WINDOW = 0x08000000
CREATE_NEW_CONSOLE = 0x00000010
DETACHED_PROCESS = 0x00000008
WINDOW_CHOICE_FLAGS = CREATE_NO_WINDOW | CREATE_NEW_CONSOLE | DETACHED_PROCESS
# Index of creationflags in Popen's positional arguments (after args).
POPEN_CREATIONFLAGS_POSITION = 13


def windows_has_console() -> bool:
    """True when this Windows process is attached to a console window.

    Terminal-started processes (pyservice.ps1 runs python as a direct console
    child) return a non-NULL handle; tray / launcher / autostart / pythonw
    contexts return NULL.
    """
    kernel32 = ctypes.windll.kernel32
    kernel32.GetConsoleWindow.restype = ctypes.c_void_p
    return bool(kernel32.GetConsoleWindow())


class WindowlessSubprocess:
    def __init__(self) -> None:
        self._original_init: Optional[Callable[..., None]] = None

    def install(self) -> None:
        if sys.platform != "win32" or self._original_init is not None:
            return
        original_init = subprocess.Popen.__init__
        self._original_init = original_init

        def windowless_init(popen: subprocess.Popen, *args: Any, **kwargs: Any) -> None:
            flags = kwargs.get("creationflags", 0)
            if (len(args) <= POPEN_CREATIONFLAGS_POSITION
                    and not flags & WINDOW_CHOICE_FLAGS
                    and not windows_has_console()):
                kwargs["creationflags"] = flags | CREATE_NO_WINDOW
            original_init(popen, *args, **kwargs)

        subprocess.Popen.__init__ = windowless_init


windowless_subprocess = WindowlessSubprocess()
