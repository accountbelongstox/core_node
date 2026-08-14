#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Launcher Windows startup manager using pythonw, PS1, and native shortcuts.

Two-part design:

  1. A **PowerShell launcher script (.ps1)** at a FIXED path under the user data
     directory (``~/.core_node/data/autostart/PyCore_RPC_Server.ps1``). It runs
     the repo's canonical entry point ``pyservice.ps1 -NoInstall`` so boot starts
     the SAME stack as a manual run: the unified dashboard UI dev server
     (poly_apps/pycore_laravel_wordnew_ui, exported as PYCORE_UI_URL) and then the pycore
     worker. The script CONTENT is regenerated on every ``enable()`` AND on every
     service start (``refresh()``) so config/entry-point changes are picked up.

  2. A **shortcut (.lnk)** in the **common (All Users) Startup folder**
     (``%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs\Startup``) that points
     at the full path to ``pythonw.exe``. The windowless Python process runs a fixed
     bridge with full-path arguments for PowerShell, the generated PS1, and the repo
     working directory. Created with the native Windows shell (WScript.Shell COM via
     pywin32, PowerShell fallback) - NOT Qt/PySide6. If the common folder isn't
     writable (no admin), it falls back to the per-user Startup folder. "Enabled?"
     is answered purely by whether the shortcut exists.
"""

import os
import sys
import subprocess
from pathlib import Path
from typing import List

from pycore.pyfoundations.system_paths import get_app_data_dir
from pycore.pylauncher.platform.autostart_target import (
    VALID_TARGETS,
    VALID_MECHANISMS,
    normalize_target,
    normalize_mechanism,
    read_preference,
    write_preference,
)

from pycore.pyfoundations.third_party.api import (
    get_third_package_pythoncom,
    get_third_package_win32com_client,
)


CORE_NODE_ROOT_PATH = Path(__file__).resolve().parents[3]
PYCORE_MODULE_CALLER_PATH = CORE_NODE_ROOT_PATH / "pycore" / "pycore_module_caller.py"
PYSERVICE_SCRIPT_PATH = CORE_NODE_ROOT_PATH / "pyservice.ps1"
WINDOWS_STARTUP_RUNNER_PATH = Path(__file__).resolve().with_name(
    "windows_startup_runner.py"
)
PYTHON_EXE_PATH = Path(sys.executable).resolve()
PYTHONW_EXE_PATH = PYTHON_EXE_PATH.with_name("pythonw.exe")
SYSTEM_ROOT_PATH = Path(os.environ.get("SystemRoot", r"C:\Windows")).resolve()
POWERSHELL_EXE_PATH = (
    SYSTEM_ROOT_PATH
    / "System32"
    / "WindowsPowerShell"
    / "v1.0"
    / "powershell.exe"
).resolve()
PROGRAM_DATA_PATH = Path(
    os.environ.get("PROGRAMDATA", r"C:\ProgramData")
).resolve()
USER_PROFILE_PATH = Path(
    os.environ.get("USERPROFILE") or Path.home()
).resolve()
ROAMING_APP_DATA_PATH = Path(
    os.environ.get("APPDATA")
    or USER_PROFILE_PATH / "AppData" / "Roaming"
).resolve()
COMMON_STARTUP_PATH = (
    PROGRAM_DATA_PATH
    / "Microsoft"
    / "Windows"
    / "Start Menu"
    / "Programs"
    / "Startup"
).resolve()
USER_STARTUP_PATH = (
    ROAMING_APP_DATA_PATH
    / "Microsoft"
    / "Windows"
    / "Start Menu"
    / "Programs"
    / "Startup"
).resolve()
AUTOSTART_DATA_PATH = (get_app_data_dir() / "autostart").resolve()


def _ps_single_quote(value: str) -> str:
    """Quote a string as a PowerShell single-quoted literal."""
    return "'" + str(value).replace("'", "''") + "'"


class WindowsStartupManager:
    """Auto-start via a fixed regenerated .ps1 + a .lnk in the common Startup folder."""

    def __init__(self, app_name: str = "PyCore_RPC_Server", target=None):
        self.app_name = app_name
        self.shortcut_name = f"{app_name}.lnk"

        # Resolve target: explicit arg > persisted preference > default.
        self.target = normalize_target(
            target if target is not None else read_preference()["target"])

        self.common_startup = COMMON_STARTUP_PATH
        self.user_startup = USER_STARTUP_PATH

        self.common_shortcut = self.common_startup / self.shortcut_name
        self.user_shortcut = self.user_startup / self.shortcut_name

        # Fixed-location PowerShell launcher script (content regenerated each enable).
        self.script_dir = AUTOSTART_DATA_PATH
        self.ps1_path = self.script_dir / f"{app_name}.ps1"

        self.python_exe = PYTHON_EXE_PATH
        self.pythonw_exe = PYTHONW_EXE_PATH
        self.launcher_script = PYCORE_MODULE_CALLER_PATH
        self.pyservice_script = PYSERVICE_SCRIPT_PATH
        self.startup_runner = WINDOWS_STARTUP_RUNNER_PATH
        self.powershell_exe = POWERSHELL_EXE_PATH

    def _shortcut_paths(self) -> List[Path]:
        """All locations a shortcut may live (common first)."""
        return [self.common_shortcut, self.user_shortcut]

    # ----- PS1 launcher script -------------------------------------------- #
    def _pyservice_ps1(self) -> str:
        """PowerShell lines that start the full pycore RPC stack inline."""
        script = _ps_single_quote(str(self.pyservice_script))
        workdir = _ps_single_quote(str(self.pyservice_script.parent))
        return (
            f"Set-Location -LiteralPath {workdir}\n"
            f"& {script} -NoInstall\n"
        )

    def _launcher_ps1(self, inline: bool = True) -> str:
        """PowerShell lines that start the multi-terminal grid launcher.

        ``inline`` (& from the repo root) keeps this PowerShell as the foreground
        host; when False the launcher is started detached with Start-Process so a
        preceding pyservice piece can stay running ("both" target).
        """
        python = _ps_single_quote(str(self.python_exe))
        repo_root = _ps_single_quote(str(self.pyservice_script.parent))  # repo root; pycore importable here
        if inline:
            return (
                f"Set-Location -LiteralPath {repo_root}\n"
                f"& {python} -m pycore.pyutils.launcher --no-pause\n"
            )
        arglist = "'-m','pycore.pyutils.launcher','--no-pause'"
        return (
            f"Start-Process -FilePath {python} -ArgumentList {arglist} "
            f"-WorkingDirectory {repo_root} -WindowStyle Hidden\n"
        )

    def _generate_ps1(self) -> str:
        """Build the PowerShell launcher content per self.target (absolute paths)."""
        header = (
            "# PyCore RPC Server - auto-start launcher\n"
            "# AUTO-GENERATED: regenerated on every enable() and on every service start\n"
            "# (reflects current config).\n"
        )
        body = "$ErrorActionPreference = 'SilentlyContinue'\n"
        if self.target == "launcher":
            body += self._launcher_ps1(inline=True)
        elif self.target == "both":
            # Start pyservice detached, then run the launcher inline (foreground).
            pyservice_inline = self._pyservice_ps1()
            powershell = _ps_single_quote(str(self.powershell_exe))
            body += (
                f"Start-Process -FilePath {powershell} -ArgumentList "
                "'-NoProfile','-WindowStyle','Hidden','-Command',"
                + _ps_single_quote(pyservice_inline)
                + "\n"
            )
            body += self._launcher_ps1(inline=True)
        else:
            body += self._pyservice_ps1()
        return header + body

    def _write_ps1(self) -> None:
        """(Re)write the fixed PS1 launcher with current config."""
        self.script_dir.mkdir(parents=True, exist_ok=True)
        with open(self.ps1_path, "w", encoding="utf-8") as fh:
            fh.write(self._generate_ps1())

    # ----- native shortcut creation --------------------------------------- #
    def _shortcut_arguments(self) -> str:
        """Full-path arguments for the windowless Python startup bridge."""
        return (
            f'"{self.startup_runner}" '
            f'"{self.powershell_exe}" '
            f'"{self.ps1_path}" '
            f'"{self.pyservice_script.parent}"'
        )

    def _create_shortcut(self, lnk_path: Path) -> bool:
        """Create the .lnk pointing at pythonw and the full-path startup bridge."""
        # Guard: refuse a relative target so a missing env var (e.g. empty APPDATA)
        # can never make mkdir(parents=True) materialize a stray 'Microsoft\Windows\...'
        # tree under the current working directory.
        if not lnk_path.is_absolute():
            return False
        lnk_path.parent.mkdir(parents=True, exist_ok=True)
        target = str(self.pythonw_exe)
        arguments = self._shortcut_arguments()
        workdir = str(self.pyservice_script.parent)

        # Primary: WScript.Shell COM via pywin32 (the canonical native way).
        try:
            pythoncom = get_third_package_pythoncom()
            win32com_client = get_third_package_win32com_client()
            try:
                pythoncom.CoInitialize()
            except Exception:
                pass
            shell = win32com_client.Dispatch('WScript.Shell')
            sc = shell.CreateShortcut(str(lnk_path))
            sc.TargetPath = target
            sc.Arguments = arguments
            sc.WorkingDirectory = workdir
            sc.WindowStyle = 7  # minimized
            sc.Description = "PyCore RPC Server - auto-start on boot"
            sc.IconLocation = str(self.pythonw_exe)
            sc.Save()
            return lnk_path.exists()
        except Exception:
            pass  # fall through to PowerShell

        # Fallback: drive the same WScript.Shell COM object from PowerShell.
        try:
            ps = (
                "$ws = New-Object -ComObject WScript.Shell; "
                f"$s = $ws.CreateShortcut('{lnk_path}'); "
                f"$s.TargetPath = '{target}'; "
                f"$s.Arguments = '{arguments}'; "
                f"$s.WorkingDirectory = '{workdir}'; "
                "$s.WindowStyle = 7; "
                "$s.Description = 'PyCore RPC Server - auto-start on boot'; "
                f"$s.IconLocation = '{self.pythonw_exe}'; "
                "$s.Save()"
            )
            subprocess.run(
                [self.powershell_exe, "-NoProfile", "-NonInteractive", "-Command", ps],
                capture_output=True, text=True, timeout=30, check=True,
            )
            return lnk_path.exists()
        except Exception:
            return False

    # ----- public API ------------------------------------------------------ #
    def is_enabled(self) -> bool:
        """Auto-start is on iff the shortcut exists (common or per-user)."""
        return any(p.exists() for p in self._shortcut_paths())

    def enable(self) -> dict:
        """Regenerate the PS1, then create the startup shortcut (common, then user)."""
        # Always refresh the fixed PS1 so config changes are reflected.
        try:
            self._write_ps1()
        except Exception as e:
            return {"success": False, "enabled": self.is_enabled(),
                    "message": f"Failed to write launcher script: {e}", "error": str(e)}

        # Persist the chosen target so refresh()/status recover it later.
        write_preference(self.target)

        last_error = None
        for lnk, scope in ((self.common_shortcut, "all-users"),
                           (self.user_shortcut, "current-user")):
            try:
                if self._create_shortcut(lnk):
                    return {
                        "success": True, "enabled": True, "scope": scope,
                        "message": f"Auto-start enabled ({scope}): {lnk}",
                        "shortcut_path": str(lnk), "script_path": str(self.ps1_path),
                    }
            except Exception as e:
                last_error = str(e)
        return {
            "success": False, "enabled": self.is_enabled(),
            "message": "Failed to create startup shortcut "
                       "(the common folder needs administrator rights).",
            "error": last_error or "shortcut creation failed",
        }

    def disable(self) -> dict:
        """Remove the startup shortcut(s); leave the fixed PS1 in place (harmless)."""
        removed, errors = [], []
        for lnk in self._shortcut_paths():
            try:
                if lnk.exists():
                    lnk.unlink()
                    removed.append(str(lnk))
            except Exception as e:
                errors.append(f"{lnk}: {e}")
        if errors and self.is_enabled():
            return {"success": False, "enabled": True,
                    "message": "Failed to remove startup shortcut: " + "; ".join(errors),
                    "error": "; ".join(errors)}
        return {"success": True, "enabled": False,
                "message": ("Auto-start disabled (shortcut removed)" if removed
                            else "Auto-start already disabled"),
                "removed": removed}

    def toggle(self) -> dict:
        return self.disable() if self.is_enabled() else self.enable()

    def refresh(self) -> bool:
        """If enabled, rewrite the launcher and recreate existing shortcuts.

        Called on every service start so launchers written by an OLDER version
        are upgraded to the current full-path pythonw entry without the user
        having to toggle auto-start off and on.
        """
        shortcut_paths = [path for path in self._shortcut_paths() if path.exists()]
        if not shortcut_paths:
            return False
        try:
            self._write_ps1()
            return all(self._create_shortcut(path) for path in shortcut_paths)
        except Exception:
            return False

    def get_status(self) -> dict:
        return {
            "enabled": self.is_enabled(),
            "platform": "windows",
            "supported": True,
            "target": self.target,
            "targets": list(VALID_TARGETS),
            "mechanism": "windows",
            "mechanisms": ["windows"],
            "scope": "all-users" if self.common_shortcut.exists() else (
                "current-user" if self.user_shortcut.exists() else "all-users"),
            "location": str(self.common_shortcut if self.common_shortcut.exists()
                            else self.user_shortcut),
            "common_shortcut": str(self.common_shortcut),
            "user_shortcut": str(self.user_shortcut),
            "script_path": str(self.ps1_path),
            "script_exists": self.ps1_path.exists(),
            "pythonw": str(self.pythonw_exe),
            "startup_runner": str(self.startup_runner),
            "powershell": str(self.powershell_exe),
            "entry_point": str(self.pyservice_script),
            "entry_exists": self.pyservice_script.exists(),
            "launcher_script": str(self.launcher_script),
            "launcher_exists": self.launcher_script.exists(),
        }
