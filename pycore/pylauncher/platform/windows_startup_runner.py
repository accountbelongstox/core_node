#!/usr/bin/env pythonw
# -*- coding: utf-8 -*-
"""Windowless bridge from a Windows Startup shortcut or the logon task to a PS1.

It waits for the PS1, so the elevated logon task stays running while pycore runs
and its IgnoreNew setting drops the Startup shortcut's second start at logon.
"""

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
    subprocess.run(
        POWERSHELL_ARGUMENTS,
        cwd=str(WORKING_DIRECTORY_PATH),
        creationflags=WINDOWS_CREATE_NO_WINDOW,
        close_fds=True,
        check=False,
    )
