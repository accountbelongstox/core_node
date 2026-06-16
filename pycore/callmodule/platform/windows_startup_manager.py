#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Windows Startup Manager - Auto-start on Windows boot (PS1 + native shortcut)

Two-part design:

  1. A **PowerShell launcher script (.ps1)** at a FIXED path under the user data
     directory (``~/.core_node/data/autostart/PyCore_RPC_Server.ps1``). It runs
     the repo's canonical entry point ``pyservice.ps1 -NoInstall`` so boot starts
     the SAME stack as a manual run: the unified dashboard UI dev server
     (poly_apps/pycore_laravel_wordflow_ui, exported as PYCORE_UI_URL) and then the pycore
     worker. Launching the bare worker directly is kept only as a fallback when
     pyservice.ps1 cannot be found (it would skip the UI server, leaving the
     PySide6 webview with nothing to load -> ERR_CONNECTION_REFUSED). The script
     CONTENT is regenerated on every ``enable()`` AND on every service start
     (``refresh()``) so config/entry-point changes are picked up without touching
     the shortcut.

  2. A **shortcut (.lnk)** in the **common (All Users) Startup folder**
     (``%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs\Startup``) that points
     at PowerShell running that fixed .ps1. Created with the native Windows shell
     (WScript.Shell COM via pywin32, PowerShell fallback) - NOT Qt/PySide6. If the
     common folder isn't writable (no admin), it falls back to the per-user Startup
     folder. "Enabled?" is answered purely by whether the shortcut exists.
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path
from typing import List

from pycore.pyfoundations.system_paths import get_app_data_dir


def _ps_single_quote(value: str) -> str:
    """Quote a string as a PowerShell single-quoted literal."""
    return "'" + str(value).replace("'", "''") + "'"


class WindowsStartupManager:
    """Auto-start via a fixed regenerated .ps1 + a .lnk in the common Startup folder."""

    def __init__(self, app_name: str = "PyCore_RPC_Server"):
        self.app_name = app_name
        self.shortcut_name = f"{app_name}.lnk"

        # Common (All Users) Startup folder - preferred, system-wide location.
        program_data = os.environ.get('PROGRAMDATA', r'C:\ProgramData')
        self.common_startup = (Path(program_data) / 'Microsoft' / 'Windows'
                               / 'Start Menu' / 'Programs' / 'Startup')
        # Per-user Startup folder - fallback when the common folder isn't writable.
        # APPDATA can be empty under a stripped service env; fall back to an ABSOLUTE
        # path (USERPROFILE\AppData\Roaming, else the home dir) so we never build a
        # RELATIVE 'Microsoft\Windows\...' path that mkdir(parents=True) would create
        # as a stray directory under the current working directory.
        appdata = os.environ.get('APPDATA') or str(
            Path(os.environ.get('USERPROFILE') or Path.home()) / 'AppData' / 'Roaming')
        self.user_startup = (Path(appdata) / 'Microsoft' / 'Windows'
                             / 'Start Menu' / 'Programs' / 'Startup')

        self.common_shortcut = self.common_startup / self.shortcut_name
        self.user_shortcut = self.user_startup / self.shortcut_name

        # Fixed-location PowerShell launcher script (content regenerated each enable).
        self.script_dir = get_app_data_dir() / "autostart"
        self.ps1_path = self.script_dir / f"{app_name}.ps1"

        # What the .ps1 launches: the full-stack entry point pyservice.ps1
        # (UI dev server + worker); pythonw.exe + the bare worker is the fallback.
        self.python_exe = sys.executable
        self.pythonw_exe = self._get_pythonw_path()
        self.launcher_script = self._get_launcher_path()
        self.pyservice_script = self._get_pyservice_path()
        self.powershell_exe = self._resolve_powershell()

    # ----- path resolution ------------------------------------------------- #
    def _get_pythonw_path(self) -> Path:
        """pythonw.exe next to python.exe (falls back to python.exe)."""
        pythonw = Path(self.python_exe).parent / "pythonw.exe"
        return pythonw if pythonw.exists() else Path(self.python_exe)

    def _get_launcher_path(self) -> Path:
        """Locate pycore_module_caller.py (source tree or installed)."""
        current_file = Path(__file__)
        # .../pycore/callmodule/platform/windows_startup_manager.py -> pycore/ is 3 up.
        pycore_dir = current_file.parent.parent.parent
        for path in (
            pycore_dir / "pycore_module_caller.py",                                 # pycore/ (canonical)
            pycore_dir.parent / "pycore_module_caller.py",                          # repo root (fallback)
            Path(sys.executable).parent / "Scripts" / "pycore_module_caller.py",    # installed
        ):
            if path.exists():
                return path
        return pycore_dir / "pycore_module_caller.py"

    def _get_pyservice_path(self) -> Path:
        """Locate pyservice.ps1, the canonical full-stack entry point (repo root)."""
        # .../pycore/callmodule/platform/windows_startup_manager.py -> repo root is 4 up.
        return Path(__file__).resolve().parents[3] / "pyservice.ps1"

    def _resolve_powershell(self) -> str:
        """Absolute path to powershell.exe (or pwsh), with a System32 fallback."""
        exe = shutil.which("powershell") or shutil.which("pwsh")
        if exe:
            return exe
        sysroot = os.environ.get("SystemRoot", r"C:\Windows")
        return str(Path(sysroot) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe")

    def _shortcut_paths(self) -> List[Path]:
        """All locations a shortcut may live (common first)."""
        return [self.common_shortcut, self.user_shortcut]

    # ----- PS1 launcher script -------------------------------------------- #
    def _generate_ps1(self) -> str:
        """Build the PowerShell launcher content (absolute paths, current config)."""
        header = (
            "# PyCore RPC Server - auto-start launcher\n"
            "# AUTO-GENERATED: regenerated on every enable() and on every service start\n"
            "# (reflects current config).\n"
        )
        if self.pyservice_script.exists():
            # Boot runs the SAME entry point as a manual run: pyservice.ps1 starts
            # the unified dashboard UI dev server (pycore_laravel_wordflow_ui, exported as
            # PYCORE_UI_URL) and then the worker; its finally-block tears the UI
            # server down with the worker. -NoInstall skips the heavy prerequisite
            # step at boot (the machine was provisioned when auto-start was set up).
            # Invoked inline (&, not Start-Process) so this hidden PowerShell stays
            # the service host and pyservice's UI teardown keeps working.
            script = _ps_single_quote(str(self.pyservice_script))
            workdir = _ps_single_quote(str(self.pyservice_script.parent))
            return (
                header
                + "$ErrorActionPreference = 'SilentlyContinue'\n"
                + f"Set-Location -LiteralPath {workdir}\n"
                + f"& {script} -NoInstall\n"
            )
        # Fallback (pyservice.ps1 not found, e.g. installed layout): bare worker
        # only — the PySide6 webview then uses the legacy /web/subtitle page.
        pythonw = _ps_single_quote(str(self.pythonw_exe))
        workdir = _ps_single_quote(str(self.launcher_script.parent))
        # ArgumentList: a single-quoted PS string containing the double-quoted .py path.
        arglist = "'" + '"' + str(self.launcher_script).replace("'", "''") + '"' + "'"
        return (
            header
            + "$ErrorActionPreference = 'SilentlyContinue'\n"
            + f"Start-Process -FilePath {pythonw} -ArgumentList {arglist} "
            + f"-WorkingDirectory {workdir} -WindowStyle Hidden\n"
        )

    def _write_ps1(self) -> None:
        """(Re)write the fixed PS1 launcher with current config."""
        self.script_dir.mkdir(parents=True, exist_ok=True)
        with open(self.ps1_path, "w", encoding="utf-8") as fh:
            fh.write(self._generate_ps1())

    # ----- native shortcut creation --------------------------------------- #
    def _shortcut_arguments(self) -> str:
        """powershell.exe arguments that run the fixed .ps1 hidden."""
        return (f'-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden '
                f'-File "{self.ps1_path}"')

    def _create_shortcut(self, lnk_path: Path) -> bool:
        """Create the .lnk (pointing at powershell + the .ps1) with the native shell."""
        # Guard: refuse a relative target so a missing env var (e.g. empty APPDATA)
        # can never make mkdir(parents=True) materialize a stray 'Microsoft\Windows\...'
        # tree under the current working directory.
        if not lnk_path.is_absolute():
            return False
        lnk_path.parent.mkdir(parents=True, exist_ok=True)
        target = str(self.powershell_exe)
        arguments = self._shortcut_arguments()
        workdir = str(self.launcher_script.parent)

        # Primary: WScript.Shell COM via pywin32 (the canonical native way).
        try:
            import pythoncom  # noqa: F401  (initialize COM for this thread)
            try:
                pythoncom.CoInitialize()
            except Exception:
                pass
            from win32com.client import Dispatch
            shell = Dispatch('WScript.Shell')
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
        """If enabled, rewrite the fixed launcher .ps1 in place (self-heal).

        Called on every service start so launchers written by an OLDER version
        (bare worker, no UI server) are upgraded to the current entry point
        without the user having to toggle auto-start off and on. The shortcut
        points at the fixed .ps1 path, so only the file content needs refreshing.
        """
        if not self.is_enabled():
            return False
        try:
            self._write_ps1()
            return True
        except Exception:
            return False

    def get_status(self) -> dict:
        return {
            "enabled": self.is_enabled(),
            "platform": "windows",
            "supported": True,
            "scope": "all-users" if self.common_shortcut.exists() else (
                "current-user" if self.user_shortcut.exists() else "all-users"),
            "location": str(self.common_shortcut if self.common_shortcut.exists()
                            else self.user_shortcut),
            "common_shortcut": str(self.common_shortcut),
            "user_shortcut": str(self.user_shortcut),
            "script_path": str(self.ps1_path),
            "script_exists": self.ps1_path.exists(),
            "entry_point": str(self.pyservice_script),
            "entry_exists": self.pyservice_script.exists(),
            "launcher_script": str(self.launcher_script),
            "launcher_exists": self.launcher_script.exists(),
        }
