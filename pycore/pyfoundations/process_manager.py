#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Foundation Process Manager
Handles process management including starting, stopping, and monitoring processes
"""

import os
import signal
import time
from pathlib import Path
from typing import List, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import exec_silent
from pycore.pyfoundations.pygvar import IS_WINDOWS, TMP_DIR
from pycore.pyfoundations.third_party.api import (
    get_third_package_psutil,
    get_third_package_win32gui,
    get_third_package_win32process,
)



PROCESS_EXIT_WAIT_SECONDS = 3.0
KILL_COMMAND_TIMEOUT_SECONDS = 5
PROCESS_POLL_SECONDS = 0.2
PROCESS_START_TOLERANCE_SECONDS = 1.0


class ProcessManager:
    """Cross-platform process inspection and termination (Windows and Linux),
    plus Windows explorer launch and window-title lookup."""

    def __init__(self):
        self.temp_bat_dir = TMP_DIR / 'd3check_bats'
    
    def start_program_with_explorer(self, exe_path: str, args: str = "", force_restart: bool = False, wait_time: int = 3) -> bool:
        """
        Start program using explorer (as specified in requirements)
        If program has arguments, create a bat file first

        Args:
            exe_path: Path to executable
            args: Command line arguments
            force_restart: Whether to kill existing processes first
            wait_time: Time to wait before checking if process started

        Returns:
            True if started successfully (process is actually running)
        """
        exe_path = Path(exe_path)
        if not exe_path.exists():
            ColorPrint.red(f"[ERROR] Executable not found: {exe_path}")
            return False

        if force_restart:
            ColorPrint.blue(f"[RESTART] Force restart requested, killing existing {exe_path.name} processes...")
            self.kill_process_by_name(exe_path.name)
            time.sleep(2)  # Wait for processes to terminate

        if args:
            # Create bat file for programs with arguments
            bat_content = f'@echo off\ncd /d "{exe_path.parent}"\n"{exe_path}" {args}\n'
            bat_file = self.temp_bat_dir / f"launch_{exe_path.stem}_{int(time.time())}.bat"
            try:
                self.temp_bat_dir.mkdir(parents=True, exist_ok=True)
                with open(bat_file, 'w', encoding='utf-8') as f:
                    f.write(bat_content)
            except OSError as exc:
                ColorPrint.red(f"[ERROR] Write launcher bat {bat_file} failed: {exc}")
                return False
            ColorPrint.blue(f"[BAT] Created bat file: {bat_file}")
            launch_path = str(bat_file)
        else:
            launch_path = str(exe_path)

        ColorPrint.blue(f"[START] Starting with explorer: {launch_path}")
        process_name = exe_path.name

        # exec_silent reports failures through its CommandResult (124 = timeout).
        result = exec_silent(['explorer', launch_path], timeout=30)
        if result.return_code == 124:
            ColorPrint.yellow(f"[TIMEOUT] Explorer command timeout for: {process_name}")
        elif result.return_code == -1:
            ColorPrint.red(f"[ERROR] Explorer command failed: {result.stderr}")
            return False
        else:
            ColorPrint.blue(f"[EXEC] Explorer command executed for: {process_name}")

        ColorPrint.blue(f"[WAIT] Waiting {wait_time} seconds for process to start...")
        time.sleep(wait_time)

        if self.is_process_running(process_name):
            ColorPrint.green(f"[SUCCESS] Process confirmed running: {process_name}")
            return True
        ColorPrint.red(f"[FAILED] Process not found after startup: {process_name}")
        return False

    def kill_process_tree(self, pid: int, force: bool = True, include_children: bool = True) -> bool:
        """Terminate ``pid`` (and, by default, its whole child tree) on Windows and Linux.

        Graceful first (SIGTERM / TerminateProcess), then a forced kill for anything
        still alive after PROCESS_EXIT_WAIT_SECONDS when ``force`` is set. Without
        psutil it uses ``taskkill [/T] [/F]`` on Windows and os.kill on Linux.
        Returns True when no process of the tree is left running."""
        psutil = get_third_package_psutil()
        if psutil is None:
            return self._kill_without_psutil(pid, force, include_children)
        try:
            root = psutil.Process(pid)
        except psutil.NoSuchProcess:
            return True
        except psutil.Error as exc:
            ColorPrint.red(f"[KILL] Inspect PID {pid} failed: {exc}")
            return False
        targets = [root]
        if include_children:
            try:
                targets = root.children(recursive=True) + [root]
            except psutil.Error as exc:
                ColorPrint.yellow(f"[KILL] Listing children of PID {pid} failed: {exc}")
        ColorPrint.blue(f"[KILL] Terminating PID {pid} ({len(targets)} process(es))")
        for proc in targets:
            try:
                proc.terminate()
            except psutil.NoSuchProcess:
                continue
            except psutil.Error as exc:
                ColorPrint.yellow(f"[KILL] Terminate PID {proc.pid} failed: {exc}")
        _gone, alive = psutil.wait_procs(targets, timeout=PROCESS_EXIT_WAIT_SECONDS)
        if alive and force:
            ColorPrint.yellow(f"[KILL] Force killing {[proc.pid for proc in alive]}")
            for proc in alive:
                try:
                    proc.kill()
                except psutil.NoSuchProcess:
                    continue
                except psutil.Error as exc:
                    ColorPrint.red(f"[KILL] Kill PID {proc.pid} failed: {exc}")
            _gone, alive = psutil.wait_procs(alive, timeout=PROCESS_EXIT_WAIT_SECONDS)
        if alive:
            ColorPrint.red(f"[KILL] Still running after kill: {[proc.pid for proc in alive]}")
            return False
        ColorPrint.green(f"[OK] Terminated PID {pid}")
        return True

    @staticmethod
    def _kill_without_psutil(pid: int, force: bool, include_children: bool) -> bool:
        if IS_WINDOWS:
            cmd = ['taskkill', '/PID', str(pid)] + (['/T'] if include_children else []) + (['/F'] if force else [])
            result = exec_silent(cmd, info=False, timeout=KILL_COMMAND_TIMEOUT_SECONDS)
            if result.return_code != 0:
                ColorPrint.yellow(f"[KILL] {' '.join(cmd)} exit={result.return_code}: {result.stderr.strip()}")
            return result.return_code == 0
        targets = (ProcessManager._linux_descendants(pid) if include_children else []) + [pid]
        remaining = [target for target in targets if ProcessManager._linux_pid_running(target)]
        for sig in ((signal.SIGTERM, signal.SIGKILL) if force else (signal.SIGTERM,)):
            for target in remaining:
                try:
                    os.kill(target, sig)
                except ProcessLookupError:
                    continue
                except OSError as exc:
                    ColorPrint.red(f"[KILL] signal {sig} to PID {target} failed: {exc}")
            deadline = time.time() + PROCESS_EXIT_WAIT_SECONDS
            while remaining and time.time() < deadline:
                time.sleep(PROCESS_POLL_SECONDS)
                remaining = [target for target in remaining if ProcessManager._linux_pid_running(target)]
            if not remaining:
                return True
        ColorPrint.red(f"[KILL] Still running after kill: {remaining}")
        return False

    @staticmethod
    def _linux_pid_running(pid: int) -> bool:
        """True while ``pid`` exists and is not a zombie (/proc state Z)."""
        try:
            with open(f"/proc/{pid}/stat", "r", encoding="utf-8", errors="replace") as handle:
                stat = handle.read()
        except FileNotFoundError:
            return False
        except OSError as exc:
            ColorPrint.gray(f"[KILL] read /proc/{pid}/stat failed: {exc}")
            return True
        return stat.rpartition(")")[2].split()[:1] != ["Z"]

    @staticmethod
    def _linux_descendants(pid: int) -> List[int]:
        """All descendants of ``pid`` (deepest first) from the /proc ppid table."""
        children: Dict[int, List[int]] = {}
        try:
            entries = [name for name in os.listdir("/proc") if name.isdigit()]
        except OSError as exc:
            ColorPrint.yellow(f"[KILL] list /proc failed: {exc}")
            return []
        for name in entries:
            try:
                with open(f"/proc/{name}/stat", "r", encoding="utf-8", errors="replace") as handle:
                    fields = handle.read().rpartition(")")[2].split()
            except OSError as exc:
                ColorPrint.gray(f"[KILL] read /proc/{name}/stat failed (process exited?): {exc}")
                continue
            if len(fields) > 1 and fields[1].isdigit():
                children.setdefault(int(fields[1]), []).append(int(name))
        ordered: List[int] = []
        frontier = [pid]
        while frontier:
            level = [child for parent in frontier for child in children.get(parent, [])]
            ordered = level + ordered
            frontier = level
        return ordered

    def is_same_process(self, pid: int, expected_start: Optional[float] = None) -> bool:
        """True while ``pid`` runs and, when ``expected_start`` is given, is still the
        process created at that time (a reused PID is a different process)."""
        psutil = get_third_package_psutil()
        if psutil is None:
            return self.is_process_running_by_pid(pid)
        try:
            proc = psutil.Process(pid)
            if proc.status() == psutil.STATUS_ZOMBIE:
                return False
            return expected_start is None or abs(proc.create_time() - float(expected_start)) <= PROCESS_START_TOLERANCE_SECONDS
        except psutil.NoSuchProcess:
            return False
        except psutil.Error as exc:
            ColorPrint.yellow(f"[PROC] Inspect PID {pid} failed: {exc}")
            return True

    def wait_process_exit(self, pid: int, timeout: float, expected_start: Optional[float] = None) -> bool:
        """True once ``pid`` (the process created at ``expected_start``) has exited within ``timeout``."""
        deadline = time.monotonic() + max(0.0, float(timeout))
        while self.is_same_process(pid, expected_start):
            if time.monotonic() >= deadline:
                return False
            time.sleep(PROCESS_POLL_SECONDS)
        return True

    @staticmethod
    def _is_own_ancestor(pid: int) -> bool:
        psutil = get_third_package_psutil()
        if psutil is None:
            return True
        try:
            return any(parent.pid == pid for parent in psutil.Process().parents())
        except psutil.Error as exc:
            ColorPrint.yellow(f"[PROC] Listing own parents failed: {exc}")
            return True

    def retire_process(self, pid: int, grace: float, expected_start: Optional[float] = None) -> bool:
        """Give ``pid`` ``grace`` seconds to exit by itself, then terminate it (its child
        tree too unless this process descends from it). Never targets this process.
        Returns True when that process is gone."""
        if pid == os.getpid():
            return False
        if self.wait_process_exit(pid, grace, expected_start):
            return True
        ColorPrint.yellow(f"[KILL] PID {pid} still running {grace:.0f}s after the exit request; terminating it")
        self.kill_process_tree(pid, force=True, include_children=not self._is_own_ancestor(pid))
        return self.wait_process_exit(pid, PROCESS_EXIT_WAIT_SECONDS, expected_start)

    def kill_process_by_pid(self, pid: int, force: bool = True) -> bool:
        """Terminate one process by PID (graceful, then forced when ``force``)."""
        return self.kill_process_tree(pid, force=force, include_children=False)

    def kill_process_by_name(self, process_name: str, force: bool = True) -> bool:
        """Terminate every process whose name matches ``process_name`` (case-insensitive)."""
        psutil = get_third_package_psutil()
        ColorPrint.blue(f"[KILL] Killing process: {process_name}")
        if psutil is None:
            return self._kill_name_without_psutil(process_name, force)
        processes = self.get_processes_by_name(process_name)
        results = [self.kill_process_by_pid(info['pid'], force=force) for info in processes]
        return all(results) and not self.is_process_running(process_name)

    def _kill_name_without_psutil(self, process_name: str, force: bool) -> bool:
        if IS_WINDOWS:
            cmd = ['taskkill', '/IM', process_name, '/T'] + (['/F'] if force else [])
            result = exec_silent(cmd, info=False, timeout=KILL_COMMAND_TIMEOUT_SECONDS)
            if result.return_code != 0:
                ColorPrint.yellow(f"[KILL] {' '.join(cmd)} exit={result.return_code}: {result.stderr.strip()}")
            return not self.is_process_running(process_name)
        exec_silent(['pkill', '-x', process_name], info=False, timeout=KILL_COMMAND_TIMEOUT_SECONDS)
        deadline = time.time() + PROCESS_EXIT_WAIT_SECONDS
        while time.time() < deadline and self.is_process_running(process_name):
            time.sleep(PROCESS_POLL_SECONDS)
        if force and self.is_process_running(process_name):
            ColorPrint.yellow(f"[KILL] Force killing {process_name}")
            exec_silent(['pkill', '-KILL', '-x', process_name], info=False, timeout=KILL_COMMAND_TIMEOUT_SECONDS)
            time.sleep(PROCESS_POLL_SECONDS)
        return not self.is_process_running(process_name)

    def is_process_running(self, process_name: str) -> bool:
        """
        Check if process is running by name

        Args:
            process_name: Name of process to check

        Returns:
            True if process is running
        """
        psutil = get_third_package_psutil()
        if psutil is None:
            if IS_WINDOWS:
                result = exec_silent(['tasklist', '/FI', f'IMAGENAME eq {process_name}', '/NH'], info=False,
                                     timeout=KILL_COMMAND_TIMEOUT_SECONDS)
                return process_name.lower() in (result.stdout or '').lower()
            result = exec_silent(['pgrep', '-x', process_name], info=False, timeout=KILL_COMMAND_TIMEOUT_SECONDS)
            return result.return_code == 0
        try:
            for proc in psutil.process_iter(['name']):
                if proc.info['name'] and proc.info['name'].lower() == process_name.lower():
                    return True
        except psutil.Error as exc:
            ColorPrint.red(f"[ERROR] Checking process {process_name} failed: {exc}")
        return False

    def is_process_running_by_pid(self, pid: int) -> bool:
        """
        Check if process is running by PID

        Args:
            pid: Process ID

        Returns:
            True if process is running
        """
        psutil = get_third_package_psutil()
        if psutil is None:
            if IS_WINDOWS:
                result = exec_silent(['tasklist', '/FI', f'PID eq {pid}', '/NH'], info=False,
                                     timeout=KILL_COMMAND_TIMEOUT_SECONDS)
                return str(pid) in (result.stdout or '').split()
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                return False
            except OSError:
                return True
            return True
        try:
            return psutil.pid_exists(pid)
        except (psutil.Error, OSError, ValueError) as exc:
            ColorPrint.red(f"[ERROR] Checking PID {pid} failed: {exc}")
            return False

    def get_processes_by_name(self, process_name: str) -> List[Dict]:
        """
        Get all processes matching the given name

        Args:
            process_name: Name of process to find

        Returns:
            List of process information dictionaries
        """
        psutil = get_third_package_psutil()
        processes = []
        if psutil is None:
            ColorPrint.yellow(f"[PROC] psutil unavailable; cannot list processes named {process_name}")
            return processes
        try:
            for proc in psutil.process_iter(['pid', 'name', 'exe', 'create_time']):
                if proc.info['name'] and proc.info['name'].lower() == process_name.lower():
                    processes.append({
                        'pid': proc.info['pid'],
                        'name': proc.info['name'],
                        'exe': proc.info['exe'],
                        'create_time': proc.info['create_time']
                    })
        except psutil.Error as exc:
            ColorPrint.red(f"[ERROR] Listing processes named {process_name} failed: {exc}")
        return processes

    def get_processes_by_window_title(self, window_titles: List[str]) -> List[Dict]:
        """
        Get processes that have windows with matching titles

        Args:
            window_titles: List of window titles to match

        Returns:
            List of process information dictionaries
        """
        win32gui = get_third_package_win32gui()
        win32process = get_third_package_win32process()

        matching_processes = []

        def process_info(hwnd, window_title):
            psutil = get_third_package_psutil()
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            try:
                proc = psutil.Process(pid)
                return {
                    'pid': pid,
                    'name': proc.name(),
                    'exe': proc.exe(),
                    'window_title': window_title,
                    'create_time': proc.create_time()
                }
            except (psutil.NoSuchProcess, psutil.AccessDenied) as exc:
                ColorPrint.gray(f"[WINDOW] Skip pid {pid} ({window_title}): {exc}")
                return None

        def enum_windows_callback(hwnd, lparam):
            if not win32gui.IsWindowVisible(hwnd):
                return True
            window_title = win32gui.GetWindowText(hwnd)
            if not window_title:
                return True
            for target_title in window_titles:
                if target_title.lower() in window_title.lower():
                    proc_info = process_info(hwnd, window_title)
                    if proc_info is not None and proc_info not in matching_processes:
                        matching_processes.append(proc_info)
                    break
            return True

        try:
            win32gui.EnumWindows(enum_windows_callback, None)
        except Exception as exc:  # pywintypes.error derives from Exception only
            ColorPrint.red(f"[ERROR] Enumerating windows for {window_titles} failed: {exc}")

        return matching_processes

    def cleanup_temp_files(self):
        """Clean up temporary bat files"""
        if not self.temp_bat_dir.exists():
            return
        for bat_file in self.temp_bat_dir.glob("*.bat"):
            try:
                bat_file.unlink()
            except OSError as exc:
                ColorPrint.yellow(f"[WARN] Could not delete {bat_file}: {exc}")
                continue
            ColorPrint.gray(f"[CLEAN] Cleaned up: {bat_file}")


process_manager = ProcessManager()
