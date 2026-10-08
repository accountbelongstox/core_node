#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Launcher Windows startup manager using pythonw, PS1, and native shortcuts.

Two-part design:

  1. A **PowerShell launcher script (.ps1)** at a FIXED path under the user data
     directory (``<core_node_data_dir>/data/autostart/PyCore_RPC_Server.ps1``). It runs
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
     is answered by whether the shortcut exists.

  3. An **elevated scheduled task** (same name, logon trigger, highest run level,
     interactive user) is registered whenever enable()/refresh() runs elevated:
     a Startup-folder process is never elevated, and Windows UIPI drops the
     keystrokes and clicks it sends to Administrator terminals. The shortcut then
     runs ``<app_name>_task.ps1`` (Start-ScheduledTask), so pycore and its tray
     still start elevated from the Startup folder and can answer Administrator
     terminals; the task's IgnoreNew setting keeps it to one instance. The NSSM
     service run (LocalSystem) never registers it.
"""

import os
import sys
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple

from pycore.pyfoundations.system_paths import get_app_data_dir
from pycore.pyfoundations.system_service_state import is_elevated
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
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


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
SCHTASKS_EXE_PATH = SYSTEM_ROOT_PATH / "System32" / "schtasks.exe"
SERVICE_RUN_ENV = "PYCORE_SERVICE_RUN"
TASK_COMMAND_TIMEOUT_SECONDS = 60
TASK_DESCRIPTION = "PyCore RPC Server - elevated auto-start at logon"
TASK_UNCHANGED = "unchanged"
TASK_REGISTERED = "registered"


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
        self.task_ps1_path = self.script_dir / f"{app_name}_task.ps1"

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
            f"& {script} -NoInstall -NoReload -NoServicePrompt\n"
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

    def _generate_task_ps1(self) -> str:
        """Build the PowerShell lines that start the elevated logon task."""
        return (
            "# PyCore RPC Server - Startup-folder entry for the elevated logon task\n"
            "# AUTO-GENERATED: regenerated on every enable() and on every service start.\n"
            "$ErrorActionPreference = 'SilentlyContinue'\n"
            f"Start-ScheduledTask -TaskName {_ps_single_quote(self.app_name)}\n"
        )

    def _write_ps1(self) -> None:
        """Write the fixed PS1 launcher and the task-start PS1 only when their content changed."""
        self.script_dir.mkdir(parents=True, exist_ok=True)
        for path, content in ((self.ps1_path, self._generate_ps1()),
                              (self.task_ps1_path, self._generate_task_ps1())):
            if path.exists() and path.read_text(encoding="utf-8", errors="replace") == content:
                continue
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(content)

    # ----- native shortcut creation --------------------------------------- #
    def _shortcut_arguments(self, script_path: Path) -> str:
        """Full-path arguments for the windowless Python startup bridge."""
        return (
            f'"{self.startup_runner}" '
            f'"{self.powershell_exe}" '
            f'"{script_path}" '
            f'"{self.pyservice_script.parent}"'
        )

    def _create_shortcut(self, lnk_path: Path, script_path: Path) -> bool:
        """Create the .lnk pointing at pythonw and the full-path startup bridge."""
        # Guard: refuse a relative target so a missing env var (e.g. empty APPDATA)
        # can never make mkdir(parents=True) materialize a stray 'Microsoft\Windows\...'
        # tree under the current working directory.
        if not lnk_path.is_absolute():
            return False
        lnk_path.parent.mkdir(parents=True, exist_ok=True)
        target = str(self.pythonw_exe)
        arguments = self._shortcut_arguments(script_path)
        workdir = str(self.pyservice_script.parent)

        # Primary: WScript.Shell COM via pywin32 (the canonical native way).
        pythoncom = get_third_package_pythoncom()
        win32com_client = get_third_package_win32com_client()
        if pythoncom is not None and win32com_client is not None:
            try:
                pythoncom.CoInitialize()
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
            except (pythoncom.com_error, OSError, AttributeError) as exc:
                ColorPrint.yellow(f"[WindowsStartup] COM shortcut {lnk_path} failed ({exc}); trying PowerShell")

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
        except (OSError, subprocess.SubprocessError) as exc:
            ColorPrint.yellow(f"[WindowsStartup] PowerShell shortcut {lnk_path} failed: {exc}")
            return False

    # ----- elevated scheduled task ----------------------------------------- #
    @staticmethod
    def _task_user() -> str:
        domain = os.environ.get("USERDOMAIN", "")
        user = os.environ.get("USERNAME", "")
        return f"{domain}\\{user}" if domain and user else user

    @staticmethod
    def _can_register_task() -> bool:
        """Only an elevated interactive run may register the task (never the LocalSystem service)."""
        return os.environ.get(SERVICE_RUN_ENV) != "1" and is_elevated()

    def _run_task_output(self, arguments: List[str]) -> Optional[str]:
        """Stdout of a successful task command, None when it failed."""
        try:
            completed = subprocess.run(
                arguments,
                capture_output=True,
                text=True,
                timeout=TASK_COMMAND_TIMEOUT_SECONDS,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            ColorPrint.yellow(f"[WindowsStartup] task command {arguments[0]} failed: {exc}")
            return None
        if completed.returncode != 0 and (completed.stderr or "").strip():
            ColorPrint.gray(f"[WindowsStartup] task command: {completed.stderr.strip()}")
        return (completed.stdout or "") if completed.returncode == 0 else None

    def _run_task_command(self, arguments: List[str]) -> bool:
        return self._run_task_output(arguments) is not None

    def _task_exists(self) -> bool:
        return self._run_task_command([str(SCHTASKS_EXE_PATH), "/Query", "/TN", self.app_name])

    def _register_task(self) -> str:
        """Create the logon task, or re-register it only when its definition drifted.

        Re-registering an unchanged task on every start would detach the running
        instance from the task, so MultipleInstances=IgnoreNew stops guarding it.
        """
        user = _ps_single_quote(self._task_user())
        name = _ps_single_quote(self.app_name)
        execute = _ps_single_quote(str(self.pythonw_exe))
        argument = _ps_single_quote(self._shortcut_arguments(self.ps1_path))
        workdir = _ps_single_quote(str(self.pyservice_script.parent))
        ps = (
            f"$t = Get-ScheduledTask -TaskName {name} -ErrorAction SilentlyContinue; "
            "$a = if ($t) { @($t.Actions)[0] } else { $null }; "
            "$same = [bool]($t -and (@($t.Actions).Count -eq 1) "
            f"-and ($a.Execute -eq {execute}) -and ($a.Arguments -eq {argument}) "
            f"-and ($a.WorkingDirectory -eq {workdir}) "
            "-and ([string]$t.Principal.RunLevel -eq 'Highest') "
            "-and ([string]$t.Principal.LogonType -eq 'Interactive') "
            "-and ([string]$t.Settings.MultipleInstances -eq 'IgnoreNew') "
            "-and ([string]$t.Settings.ExecutionTimeLimit -eq 'PT0S') "
            "-and (@($t.Triggers).Count -eq 1) "
            "-and (@($t.Triggers)[0].CimClass.CimClassName -eq 'MSFT_TaskLogonTrigger')); "
            f"if ($same) {{ Write-Output '{TASK_UNCHANGED}'; return }}; "
            f"$action = New-ScheduledTaskAction -Execute {execute} "
            f"-Argument {argument} "
            f"-WorkingDirectory {workdir}; "
            f"$trigger = New-ScheduledTaskTrigger -AtLogOn -User {user}; "
            f"$principal = New-ScheduledTaskPrincipal -UserId {user} -LogonType Interactive -RunLevel Highest; "
            "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries "
            "-ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew; "
            f"Register-ScheduledTask -TaskName {name} "
            f"-Description {_ps_single_quote(TASK_DESCRIPTION)} -Action $action -Trigger $trigger "
            "-Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null"
        )
        output = self._run_task_output(
            [str(self.powershell_exe), "-NoProfile", "-NonInteractive", "-Command", ps]
        )
        if output is None:
            return ""
        return TASK_UNCHANGED if TASK_UNCHANGED in output else TASK_REGISTERED

    def _delete_task(self) -> bool:
        return self._run_task_command([str(SCHTASKS_EXE_PATH), "/Delete", "/TN", self.app_name, "/F"])

    def _remove_shortcuts(self) -> Tuple[List[str], List[str]]:
        """(removed paths, errors) for every existing startup shortcut."""
        removed, errors = [], []
        for lnk in self._shortcut_paths():
            if not lnk.exists():
                continue
            try:
                lnk.unlink()
            except OSError as exc:
                ColorPrint.yellow(f"[WindowsStartup] remove shortcut {lnk} failed: {exc}")
                errors.append(f"{lnk}: {exc}")
                continue
            removed.append(str(lnk))
        return removed, errors

    def _install_startup_shortcut(self, script_path: Path) -> Tuple[Optional[Path], str, str]:
        """(shortcut, scope, error) for the first Startup folder that accepts the shortcut."""
        last_error = ""
        for lnk, scope in ((self.common_shortcut, "all-users"),
                           (self.user_shortcut, "current-user")):
            try:
                if self._create_shortcut(lnk, script_path):
                    return lnk, scope, ""
            except OSError as e:
                ColorPrint.yellow(f"[WindowsStartup] create shortcut {lnk} failed: {e}")
                last_error = str(e)
        return None, "", last_error or "shortcut creation failed"

    def _install_task(self) -> bool:
        """Register the elevated task and point the Startup shortcut at it (no-op when both are in place)."""
        registration = self._register_task()
        if not registration:
            return False
        if registration == TASK_UNCHANGED and self.common_shortcut.exists() and not self.user_shortcut.exists():
            return True
        self._remove_shortcuts()
        lnk, _scope, error = self._install_startup_shortcut(self.task_ps1_path)
        if lnk is None:
            ColorPrint.yellow(f"[WindowsStartup] Startup shortcut for task {self.app_name} failed: {error}")
        ColorPrint.green(f"[WindowsStartup] elevated logon task registered: {self.app_name} (shortcut: {lnk})")
        return True

    # ----- public API ------------------------------------------------------ #
    def is_enabled(self) -> bool:
        """Auto-start is on iff the elevated task or a shortcut (common or per-user) exists."""
        return any(p.exists() for p in self._shortcut_paths()) or self._task_exists()

    def enable(self, start_now: bool = True) -> dict:
        """Regenerate the PS1, then register the logon task (shortcut as fallback).

        Nothing is started here, so ``start_now`` is moot on Windows.
        """
        # Always refresh the fixed PS1 so config changes are reflected.
        try:
            self._write_ps1()
        except OSError as e:
            ColorPrint.yellow(f"[WindowsStartup] write launcher script {self.ps1_path} failed: {e}")
            return {"success": False, "enabled": self.is_enabled(),
                    "message": f"Failed to write launcher script: {e}", "error": str(e)}

        # Persist the chosen target so refresh()/status recover it later.
        write_preference(self.target)

        if self._can_register_task() and self._install_task():
            return {
                "success": True, "enabled": True, "scope": "scheduled-task", "elevated": True,
                "message": f"Auto-start enabled (elevated logon task): {self.app_name}",
                "task_name": self.app_name, "script_path": str(self.ps1_path),
            }

        lnk, scope, error = self._install_startup_shortcut(self.ps1_path)
        if lnk is not None:
            return {
                "success": True, "enabled": True, "scope": scope, "elevated": False,
                "message": f"Auto-start enabled ({scope}): {lnk}",
                "shortcut_path": str(lnk), "script_path": str(self.ps1_path),
            }
        return {
            "success": False, "enabled": self.is_enabled(),
            "message": "Failed to create startup shortcut "
                       "(the common folder needs administrator rights).",
            "error": error,
        }

    def disable(self) -> dict:
        """Remove the elevated task and the startup shortcut(s); leave the fixed PS1 in place (harmless)."""
        removed, errors = [], []
        if self._task_exists():
            if self._delete_task():
                removed.append(f"task:{self.app_name}")
            else:
                errors.append(f"task {self.app_name}: delete failed (needs administrator rights)")
        removed_shortcuts, shortcut_errors = self._remove_shortcuts()
        removed += removed_shortcuts
        errors += shortcut_errors
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
        """If enabled, rewrite the launcher; migrate shortcuts to the elevated logon task.

        Called on every service start so launchers written by an OLDER version
        are upgraded to the current full-path pythonw entry without the user
        having to toggle auto-start off and on. An elevated run moves a
        shortcut-based auto-start onto the elevated logon task and its Startup
        shortcut.
        """
        shortcut_paths = [path for path in self._shortcut_paths() if path.exists()]
        task_exists = self._task_exists()
        if not shortcut_paths and not task_exists:
            return False
        try:
            self._write_ps1()
            if self._can_register_task():
                return self._install_task()
            script_path = self.task_ps1_path if task_exists else self.ps1_path
            return all(self._create_shortcut(path, script_path) for path in shortcut_paths)
        except OSError as exc:
            ColorPrint.yellow(f"[WindowsStartup] refresh launcher {self.ps1_path} failed: {exc}")
            return False

    def get_status(self) -> dict:
        task_exists = self._task_exists()
        return {
            "enabled": task_exists or any(p.exists() for p in self._shortcut_paths()),
            "elevated": task_exists,
            "task_name": self.app_name,
            "platform": "windows",
            "supported": True,
            "target": self.target,
            "targets": list(VALID_TARGETS),
            "mechanism": "windows",
            "mechanisms": ["windows"],
            "scope": "scheduled-task" if task_exists else (
                "all-users" if self.common_shortcut.exists() else (
                    "current-user" if self.user_shortcut.exists() else "all-users")),
            "location": str(self.common_shortcut if self.common_shortcut.exists()
                            else self.user_shortcut),
            "common_shortcut": str(self.common_shortcut),
            "user_shortcut": str(self.user_shortcut),
            "script_path": str(self.ps1_path),
            "script_exists": self.ps1_path.exists(),
            "task_script_path": str(self.task_ps1_path),
            "pythonw": str(self.pythonw_exe),
            "startup_runner": str(self.startup_runner),
            "powershell": str(self.powershell_exe),
            "entry_point": str(self.pyservice_script),
            "entry_exists": self.pyservice_script.exists(),
            "launcher_script": str(self.launcher_script),
            "launcher_exists": self.launcher_script.exists(),
        }
