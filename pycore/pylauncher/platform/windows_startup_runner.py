#!/usr/bin/env pythonw
# -*- coding: utf-8 -*-
"""Windowless bridge from a Windows Startup shortcut to pyservice."""

import subprocess
import sys
from pathlib import Path


POWERSHELL_EXE_PATH = Path(sys.argv[1]).resolve()
AUTOSTART_SCRIPT_PATH = Path(sys.argv[2]).resolve()
WORKING_DIRECTORY_PATH = Path(sys.argv[3]).resolve()
WINDOWS_CREATE_NO_WINDOW = subprocess.CREATE_NO_WINDOW
POWERSHELL_ARGUMENTS = (
    str(POWERSHELL_EXE_PATH),
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-WindowStyle",
    "Hidden",
    "-File",
    str(AUTOSTART_SCRIPT_PATH),
)


if __name__ == "__main__":
    subprocess.Popen(
        POWERSHELL_ARGUMENTS,
        cwd=str(WORKING_DIRECTORY_PATH),
        creationflags=WINDOWS_CREATE_NO_WINDOW,
        close_fds=True,
    )
