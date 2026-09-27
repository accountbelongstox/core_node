# -*- coding: utf-8 -*-
from __future__ import annotations

import platform

from pycore.pyutils.window.terminal_backend import (
    TerminalWindowBackend,
    UnsupportedTerminalBackend,
)


SYSTEM_NAME = platform.system()

if SYSTEM_NAME == "Windows":
    from pycore.pyutils.window.windows_terminal_backend import windows_terminal_backend as platform_backend
elif SYSTEM_NAME == "Linux":
    from pycore.pyutils.window.linux_terminal_backend import linux_terminal_backend as platform_backend
else:
    platform_backend = UnsupportedTerminalBackend(SYSTEM_NAME.lower())

terminal_backend: TerminalWindowBackend = platform_backend


__all__ = ["terminal_backend"]
