# -*- coding: utf-8 -*-
"""Window launcher control for pycore: launch it, undo a launch (kill all), restart all."""

import os
import sys
import time
from typing import Any, Dict, List, Set

from pycore.pyctl.terminal.terminal_activity_log import terminal_activity_log
from pycore.pyfoundations.pybasecommon.commander import run_background
from pycore.pyfoundations.pygvar import IS_WINDOWS, PROJECT_ROOT, TMP_DIR
from pycore.pyfoundations.process_manager import process_manager
from pycore.pyfoundations.third_party.api import get_third_package_psutil
from pycore.pyutils.common.x11_display import x11_display
from pycore.pyutils.window.terminal_platform import terminal_backend

LAUNCHER_MODULE = "pycore.pyutils.launcher"
LAUNCH_MODES = ("device", "windows", "both")
DEFAULT_LAUNCH_MODE = "device"
LAUNCHER_LOG_DIR = TMP_DIR / "pycore_launcher"
LAUNCHER_LOG_FILE = LAUNCHER_LOG_DIR / "launcher_rpc.log"
X11_CONTROLS = frozenset({"x11", "xwayland"})
X11_NATIVE_ID_BASE = 16
RESTART_SETTLE_SECONDS = 2.0


class LauncherControlService:
    def launch(self, mode: str) -> Dict[str, Any]:
        """Run the desktop-icon launcher headless with *mode* (pycore itself keeps running)."""
        mode = mode or DEFAULT_LAUNCH_MODE
        if mode not in LAUNCH_MODES:
            return self._failure("launcher_mode_invalid")
        command = [sys.executable, "-m", LAUNCHER_MODULE, "--mode", mode, "--no-pause"]
        env = dict(os.environ)
        env["PYTHONPATH"] = os.pathsep.join(filter(None, [str(PROJECT_ROOT), env.get("PYTHONPATH")]))
        env["PYCORE_SKIP_DEP_CHECK"] = "1"
        try:
            LAUNCHER_LOG_DIR.mkdir(parents=True, exist_ok=True)
            process = run_background(command, cwd=str(PROJECT_ROOT), env=env, log_file=str(LAUNCHER_LOG_FILE))
        except OSError as error:
            terminal_activity_log.error("launcher.launch.failed", mode=mode, error=error)
            return self._failure("launcher_start_failed")
        terminal_activity_log.info("launcher.launched", mode=mode, pid=process.pid)
        return {"success": True, "error_code": None, "mode": mode, "pid": process.pid, "log_file": str(LAUNCHER_LOG_FILE)}

    def kill_all(self) -> Dict[str, Any]:
        """Reverse a launch: close every terminal window and stop the launcher's app slots."""
        protected = self._protected_pids()
        closed, failed = self._close_terminals(protected)
        stopped = self._stop_apps(protected)
        terminal_activity_log.info("launcher.killed", closed_terminals=closed, failed_terminals=failed, stopped_apps=stopped)
        return {
            "success": not failed,
            "error_code": "launcher_kill_partial" if failed else None,
            "closed_terminals": closed,
            "failed_terminals": failed,
            "stopped_apps": stopped,
        }

    def restart_all(self, mode: str) -> Dict[str, Any]:
        killed = self.kill_all()
        time.sleep(RESTART_SETTLE_SECONDS)
        launched = self.launch(mode)
        return {**launched, "closed_terminals": killed["closed_terminals"],
                "failed_terminals": killed["failed_terminals"], "stopped_apps": killed["stopped_apps"]}

    def _close_terminals(self, protected: Set[int]):
        snapshot = terminal_backend.snapshot()
        is_linux = str(snapshot.get("platform") or "").lower() == "linux"
        closed: List[str] = []
        failed: List[str] = []
        for window in snapshot.get("windows") or []:
            process_id = int(window.get("process_id") or 0)
            if process_id in protected:
                continue
            title = str(window.get("title") or window.get("id") or "")
            if self._close_window(window, process_id, is_linux):
                closed.append(title)
            else:
                failed.append(title)
        return closed, failed

    @staticmethod
    def _close_window(window: Dict[str, Any], process_id: int, is_linux: bool) -> bool:
        # Grid terminals may run as root while pycore does not: XKillClient closes them across uids.
        if is_linux and str(window.get("control") or "") in X11_CONTROLS:
            if x11_display.kill_client(int(str(window["native_id"]), X11_NATIVE_ID_BASE)):
                return True
        return process_id > 0 and process_manager.kill_process_tree(process_id)

    def _stop_apps(self, protected: Set[int]) -> List[str]:
        from pycore.pyutils.launcher.app_catalog import LINUX_PROCESS_NAMES
        from pycore.pyutils.launcher.app_slots import APP_SLOTS
        from pycore.pyutils.launcher.launch_guard import resolve_process_names

        stopped: List[str] = []
        for _slot, members in APP_SLOTS:
            for app_name in members:
                names = resolve_process_names(app_name) if IS_WINDOWS else LINUX_PROCESS_NAMES.get(app_name, [])
                pids = {
                    int(info["pid"])
                    for name in names
                    for info in process_manager.get_processes_by_name(name)
                } - protected
                if pids and all(process_manager.kill_process_tree(pid) for pid in sorted(pids)):
                    stopped.append(app_name)
        return stopped

    @staticmethod
    def _protected_pids() -> Set[int]:
        """pycore, its ancestors (the window or service hosting it) and its children survive."""
        psutil = get_third_package_psutil()
        protected = {os.getpid()}
        if psutil is None:
            return protected
        try:
            current = psutil.Process()
            protected.update(process.pid for process in current.parents())
            protected.update(process.pid for process in current.children(recursive=True))
        except psutil.Error as error:
            terminal_activity_log.warning("launcher.protect.failed", error=error)
        return protected

    @staticmethod
    def _failure(error_code: str) -> Dict[str, Any]:
        return {"success": False, "error_code": error_code}


launcher_control_service = LauncherControlService()

__all__ = ["LAUNCH_MODES", "LauncherControlService", "launcher_control_service"]
