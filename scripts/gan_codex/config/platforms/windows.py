"""Windows specific terminal definitions."""

from __future__ import annotations

from pathlib import Path
from typing import List

from ..base.settings import TerminalDefinition

PROGRAM_FILES = Path("C:/Program Files")
PROGRAM_FILES_X86 = Path("C:/Program Files (x86)")
SYSTEM32 = Path("C:/Windows/System32")


def get_definitions() -> List[TerminalDefinition]:
    return [
        TerminalDefinition(
            key="cmd",
            display_name="Command Prompt",
            exec_names=("cmd.exe",),
            description="Legacy Windows command prompt",
            search_paths=(SYSTEM32 / "cmd.exe",),
        ),
        TerminalDefinition(
            key="powershell",
            display_name="Windows PowerShell",
            exec_names=("powershell.exe",),
            description="Windows PowerShell",
            search_paths=(SYSTEM32 / "WindowsPowerShell/v1.0/powershell.exe",),
        ),
        TerminalDefinition(
            key="pwsh",
            display_name="PowerShell 7",
            exec_names=("pwsh.exe",),
            description="Cross platform PowerShell",
            search_paths=(
                PROGRAM_FILES / "PowerShell/7/pwsh.exe",
                PROGRAM_FILES_X86 / "PowerShell/7/pwsh.exe",
            ),
        ),
        TerminalDefinition(
            key="windows-terminal",
            display_name="Windows Terminal",
            exec_names=("wt.exe",),
            description="Modern Windows Terminal",
            search_paths=(
                SYSTEM32 / "wt.exe",
                PROGRAM_FILES / "WindowsApps/Microsoft.WindowsTerminal_8wekyb3d8bbwe/wt.exe",
            ),
        ),
        TerminalDefinition(
            key="git-bash",
            display_name="Git Bash",
            exec_names=("bash.exe", "git-bash.exe"),
            description="Git for Windows Bash",
            search_paths=(PROGRAM_FILES / "Git/bin/bash.exe",),
        ),
        TerminalDefinition(
            key="cmder",
            display_name="Cmder",
            exec_names=("Cmder.exe",),
            description="Cmder portable console",
            search_paths=(PROGRAM_FILES / "Cmder/Cmder.exe",),
        ),
    ]
