# -*- coding: utf-8 -*-
"""
Idempotent launch guards for the window launcher.

Before starting terminals, applications, or the pycore module, check whether the
target is already running and skip when it is. Terminal counting mirrors
193_install_terminal_grid_shortcut.sh (Linux wmctrl/pgrep; Windows WT window class).
"""

import platform
import socket
import sys
from pathlib import Path
from typing import List, Optional

from pycore.pyfoundations.pybasecommon.commander import exec_silent
from pycore.pyfoundations.network_constants import HTTP_LOOPBACK_HOST, PYCORE_HTTP_PORT
from pycore.pyfoundations.third_party.api import get_third_package_psutil
from pycore.pyfoundations.third_party.api import get_third_package_win32gui
from pycore.pyfoundations.third_party.api import get_third_package_win32process
from pycore.pyfoundations.process_manager import ProcessManager
from pycore.pyutils.common.terminal_identifiers import is_linux_terminal_class
from pycore.pyutils.launcher.app_finder import AppFinder
from pycore.pyutils.launcher.char_size_measurer import count_wt_windows


_PYCORE_MODULE_MARKER = 'pycore_module_caller'
_SOCKET_TIMEOUT_SEC = 0.05
_PYTHON_PROC_NAMES = frozenset({
    'python.exe', 'pythonw.exe', 'python3', 'python',
})

def resolve_process_names(app_name: str, app_finder: 'AppFinder') -> List[str]:
    """Return executable / comm names used to detect whether *app_name* is running."""
    if sys.platform != 'win32':
        if app_name in ('chrome', 'edge', 'chrome_beta'):
            return list(app_finder._LINUX_BINARIES.get('edge', []))
        return list(app_finder._LINUX_BINARIES.get(app_name, []))

    if app_name in ('chrome', 'edge', 'chrome_beta'):
        return list(app_finder.CHROME_EXE_NAMES)

    app_def = app_finder.APP_DEFINITIONS.get(app_name, {})
    names = list(app_def.get('names', []))

    if app_name == 'aiassistant':
        ai_path = app_finder.find_aiassistant()
        if ai_path:
            names = [Path(ai_path).name]

    return names


def resolve_launch_path(
    app_name: str,
    app_config: dict,
    app_finder: 'AppFinder',
) -> Optional[str]:
    """Resolve the executable path for launching *app_name* (cache then finder)."""
    app_path = None

    if app_name == 'chrome':
        version = app_config.get('version', 'stable')
        if version == 'stable':
            app_path = app_finder.find_chrome_by_version(version)
        else:
            cache_key = f'chrome_{version}'
            if cache_key in app_finder.cache:
                cached_path = Path(app_finder.cache[cache_key])
                if cached_path.exists():
                    app_path = str(cached_path)
            if not app_path:
                app_path = app_finder.find_chrome_by_version(version)
    elif app_name == 'chrome_beta':
        cache_key = 'chrome_beta'
        if cache_key in app_finder.cache:
            cached_path = Path(app_finder.cache[cache_key])
            if cached_path.exists():
                app_path = str(cached_path)
        if not app_path:
            app_path = app_finder.find_chrome_by_version('beta')
    elif app_name == 'edge':
        cache_key = 'edge_path'
        if cache_key in app_finder.cache:
            cached_path = Path(app_finder.cache[cache_key])
            if cached_path.exists():
                app_path = str(cached_path)
        if not app_path:
            app_path = app_finder.find_portable_chrome()
    else:
        cache_key = f'{app_name}_path'
        if cache_key in app_finder.cache:
            cached_path = Path(app_finder.cache[cache_key])
            if cached_path.exists():
                app_path = str(cached_path)
        if not app_path:
            app_path = app_finder.find_app(app_name)

    return app_path


_CHROME_EXE_BASENAMES = frozenset({'chrome.exe', 'googlechrome.exe'})


def _is_chrome_exe_name(exe_name: str) -> bool:
    return exe_name.lower() in _CHROME_EXE_BASENAMES


def _resolve_exe_path(path: Path) -> Path:
    try:
        return path.resolve()
    except OSError:
        return path


def _has_visible_window_for_exe(exe_path: str) -> bool:
    """True when *exe_path* owns a visible top-level window (Chrome background excluded)."""
    win32gui = get_third_package_win32gui()
    win32process = get_third_package_win32process()

    psutil = get_third_package_psutil()
    target_resolved = _resolve_exe_path(Path(exe_path))
    target_lower = str(exe_path).lower()
    found = False

    def _callback(hwnd, _):
        nonlocal found
        if found:
            return True
        if not win32gui.IsWindowVisible(hwnd) or win32gui.GetParent(hwnd) != 0:
            return True
        try:
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            proc_exe = psutil.Process(pid).exe()
            if not proc_exe:
                return True
            try:
                matches = Path(proc_exe).resolve() == target_resolved
            except OSError:
                matches = str(proc_exe).lower() == target_lower
            if matches:
                found = True
        except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
            pass
        return True

    win32gui.EnumWindows(_callback, None)
    return found


def _is_exe_path_running(process_manager: 'ProcessManager', exe_path: str) -> bool:
    """True when a process is running from the given executable path."""
    target = Path(exe_path)
    if not target.name:
        return False
    if sys.platform == 'win32' and _is_chrome_exe_name(target.name):
        return _has_visible_window_for_exe(exe_path)

    target_resolved = _resolve_exe_path(target)

    for proc in process_manager.get_processes_by_name(target.name):
        proc_exe = proc.get('exe')
        if not proc_exe:
            continue
        try:
            if Path(proc_exe).resolve() == target_resolved:
                return True
        except OSError:
            if str(proc_exe).lower() == str(exe_path).lower():
                return True
    return False


def is_app_running(
    app_name: str,
    process_manager: 'ProcessManager',
    app_finder: 'AppFinder',
    exe_path: Optional[str] = None,
) -> bool:
    """True when the target *app_name* (or *exe_path* when given) is already running."""
    if exe_path:
        return _is_exe_path_running(process_manager, exe_path)

    names = resolve_process_names(app_name, app_finder)
    if not names:
        return False
    return any(process_manager.is_process_running(name) for name in names)


def count_open_terminals() -> int:
    """Count open terminal windows for the current platform."""
    system = platform.system()
    if system == 'Windows':
        return count_wt_windows()
    if system == 'Linux':
        return _count_linux_terminals()
    return 0


def compute_terminal_deficit(grid_columns: int, grid_rows: int, open_count: Optional[int] = None) -> int:
    """Return how many grid cells still need launching (0 = skip)."""
    grid_total = grid_columns * grid_rows
    if open_count is None:
        open_count = count_open_terminals()
    return max(0, grid_total - open_count)


def is_pycore_module_running() -> bool:
    """True when a pycore_module_caller singleton instance is already alive."""
    if _is_tcp_port_open(HTTP_LOOPBACK_HOST, PYCORE_HTTP_PORT):
        return True
    return _pycore_module_process_running()


def _is_tcp_port_open(host: str, port: int, timeout: float = _SOCKET_TIMEOUT_SEC) -> bool:
    """Return True when *host*:*port* accepts a TCP connection."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((host, port))
        return True
    except OSError:
        return False
    finally:
        sock.close()


def _pycore_module_process_running() -> bool:
    """Fallback: locate pycore_module_caller in a Python process command line."""

    psutil = get_third_package_psutil()
    marker = _PYCORE_MODULE_MARKER
    for proc in psutil.process_iter(['name']):
        name = (proc.info.get('name') or '').lower()
        if name not in _PYTHON_PROC_NAMES:
            continue
        cmdline = proc.cmdline()
        if any(marker in part for part in cmdline):
            return True
    return False


def _count_linux_terminals() -> int:
    """Count terminal windows/processes on Linux (152 helper parity)."""
    wmctrl = exec_silent(['wmctrl', '-lx'], capture_output=True, text=True)
    if wmctrl.return_code == 0 and wmctrl.stdout:
        count = 0
        for line in wmctrl.stdout.splitlines():
            parts = line.split(None, 3)
            if len(parts) < 3:
                continue
            window_class = parts[2].lower()
            if '.' in window_class:
                window_class = window_class.split('.', 1)[1]
            if is_linux_terminal_class(window_class):
                count += 1
        return count

    ps = exec_silent(['ps', '-e', '-o', 'comm='], capture_output=True, text=True)
    if ps.return_code != 0 or not ps.stdout:
        return 0

    count = 0
    for line in ps.stdout.splitlines():
        comm = line.strip()
        if is_linux_terminal_class(comm):
            count += 1
    return count
