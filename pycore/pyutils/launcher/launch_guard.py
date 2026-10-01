# -*- coding: utf-8 -*-
"""
Idempotent launch guards for the window launcher.

Before starting terminals, applications, or the pycore module, check whether the
target is already running and skip when it is. Terminal counting mirrors
193_install_window_launcher_shortcut.sh (Linux X11 client list/pgrep; Windows WT window class).
"""

import platform
import re
import sys
from pathlib import Path
from typing import Iterable, List, Optional

from pycore.pyfoundations.pybasecommon.commander import exec_silent
from pycore.pyfoundations.network_constants import HTTP_LOOPBACK_HOST, PYCORE_HTTP_PORT
from pycore.pyfoundations.third_party.api import get_third_package_psutil
from pycore.pyfoundations.third_party.api import get_third_package_win32gui
from pycore.pyfoundations.third_party.api import get_third_package_win32process
from pycore.pyfoundations.process_manager import ProcessManager
from pycore.pyfoundations.system_service_state import process_matches, tcp_port_open
from pycore.pyutils.common.terminal_identifiers import is_linux_terminal_class
from pycore.pyutils.common.x11_display import x11_display
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.app_catalog import (
    APP_DEFINITIONS,
    CHROME_EXE_NAMES,
    CMDLINE_PROCESS_MATCHERS,
    LINUX_BINARIES,
    LINUX_PROCESS_NAMES,
    WINDOWS_NAME_MATCHED_APPS,
)
from pycore.pyutils.launcher.app_finder import app_finder
from pycore.pyutils.launcher.chrome_finder import chrome_finder
from pycore.pyutils.launcher.text_editor_finder import text_editor_finder
from pycore.pyutils.launcher.char_size_measurer import count_wt_windows


_PYCORE_MODULE_MARKER = 'pycore_module_caller'
_SOCKET_TIMEOUT_SEC = 0.05
_PYTHON_PROC_NAMES = frozenset({
    'python.exe', 'pythonw.exe', 'python3', 'python',
})

CHROME_FAMILY_APPS = ('chrome', 'edge', 'chrome_beta')


def resolve_process_names(app_name: str) -> List[str]:
    """Return executable / comm names used to detect whether *app_name* is running."""
    if sys.platform != 'win32':
        if app_name in CHROME_FAMILY_APPS:
            return list(LINUX_BINARIES.get('edge', []))
        return list(LINUX_BINARIES.get(app_name, []))

    if app_name in CHROME_FAMILY_APPS:
        return list(CHROME_EXE_NAMES)

    if app_name in WINDOWS_NAME_MATCHED_APPS:
        return text_editor_finder.windows_process_names()

    names = list(APP_DEFINITIONS.get(app_name, {}).get('names', []))
    if app_name == 'aiassistant':
        ai_path = app_finder.find_aiassistant()
        if ai_path:
            names = [Path(ai_path).name]
    return names


def resolve_launch_path(app_name: str, app_config: dict) -> Optional[str]:
    """Resolve the executable path for launching *app_name* (cache then finder)."""
    if app_name == 'chrome':
        return chrome_finder.find_by_version(app_config.get('version', 'stable'))
    return app_finder.find_app(app_name)


_CHROME_EXE_BASENAMES = frozenset({'chrome.exe', 'googlechrome.exe'})


def _is_chrome_exe_name(exe_name: str) -> bool:
    return exe_name.lower() in _CHROME_EXE_BASENAMES


def _resolve_exe_path(path: Path) -> Path:
    try:
        return path.resolve()
    except OSError:
        return path


def _same_exe(proc_exe: str, target_resolved: Path, target_lower: str) -> bool:
    try:
        return Path(proc_exe).resolve() == target_resolved
    except OSError:
        return str(proc_exe).lower() == target_lower


def _has_visible_window_for_exe(exe_path: str) -> bool:
    """True when *exe_path* owns a visible top-level window (Chrome background excluded)."""
    win32gui = get_third_package_win32gui()
    win32process = get_third_package_win32process()

    psutil = get_third_package_psutil()
    target_resolved = _resolve_exe_path(Path(exe_path))
    target_lower = str(exe_path).lower()
    found = False

    def _process_exe(hwnd) -> Optional[str]:
        try:
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            return psutil.Process(pid).exe()
        except (psutil.NoSuchProcess, psutil.AccessDenied, OSError) as exc:
            ColorPrint.debug(f"[launch_guard] window {hwnd} process exe unavailable: {exc}")
            return None

    def _callback(hwnd, _):
        nonlocal found
        if found:
            return True
        if not win32gui.IsWindowVisible(hwnd) or win32gui.GetParent(hwnd) != 0:
            return True
        proc_exe = _process_exe(hwnd)
        if proc_exe and _same_exe(proc_exe, target_resolved, target_lower):
            found = True
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
    target_lower = str(exe_path).lower()
    return any(proc.get('exe') and _same_exe(proc['exe'], target_resolved, target_lower)
               for proc in process_manager.get_processes_by_name(target.name))


def is_app_running(
    app_name: str,
    process_manager: 'ProcessManager',
    exe_path: Optional[str] = None,
) -> bool:
    """True when the target *app_name* (or *exe_path* when given) is already running."""
    cmdline_matcher = CMDLINE_PROCESS_MATCHERS.get(app_name)
    if cmdline_matcher:
        return is_cmdline_process_running(**cmdline_matcher)

    if sys.platform == 'win32' and app_name in WINDOWS_NAME_MATCHED_APPS:
        return any(process_manager.is_process_running(name)
                   for name in resolve_process_names(app_name))

    if sys.platform != 'win32':
        # comm-name match first: the resolved launch path is a wrapper/symlink
        # (google-chrome -> .../google-chrome script) whose resolved target never
        # equals the real process exe (.../chrome), so exe-path comparison alone
        # misses every running instance.
        for proc_name in LINUX_PROCESS_NAMES.get(app_name, []):
            if process_manager.is_process_running(proc_name):
                return True
        if exe_path:
            return _is_exe_path_running(process_manager, exe_path)
        return False

    if exe_path:
        return _is_exe_path_running(process_manager, exe_path)

    names = resolve_process_names(app_name)
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
    if tcp_port_open(HTTP_LOOPBACK_HOST, PYCORE_HTTP_PORT, _SOCKET_TIMEOUT_SEC):
        return True
    return _pycore_module_process_running()


def _pycore_module_process_running() -> bool:
    """Fallback: locate pycore_module_caller in a Python process command line."""
    return is_cmdline_process_running(
        arg_markers=(_PYCORE_MODULE_MARKER,),
        owner_names=_PYTHON_PROC_NAMES,
    )


def is_cmdline_process_running(
    arg_markers: Iterable[str] = (),
    exe_basenames: Iterable[str] = (),
    process_names: Iterable[str] = (),
    owner_names: Iterable[str] = (),
) -> bool:
    """True when any process (any user) matches by name, argv[0] basename or argv marker."""
    return process_matches(
        markers=arg_markers,
        exe_basenames=exe_basenames,
        process_names=process_names,
        owner_names=owner_names,
    )


# Title marker every grid window carries (re-asserted each prompt by the grid
# shell rc written by LinuxTerminalLauncher._grid_shell_inner, so the
# shell's own PS1 title escape cannot erase it).
GRID_TITLE_RE = re.compile(r'pylauncher-\d+')


def list_linux_grid_windows():
    """Open GRID terminal windows (title carries pylauncher-NN), or None without an X11/Xwayland display."""
    windows = x11_display.list_client_windows()
    if windows is None:
        return None
    return [window for window in windows if GRID_TITLE_RE.search(window.title)]


def _count_linux_terminals() -> int:
    """Count open GRID terminal windows on Linux.

    Only windows whose title carries the launcher marker (pylauncher-NN)
    count: unrelated terminals -- the launcher's own menu window included --
    must never shrink the deficit, otherwise a 4x3 grid launches fewer than
    12 windows. Falls back to the terminal-class count (152 helper parity)
    only when no X11/Xwayland display can be enumerated.
    """
    grid_windows = list_linux_grid_windows()
    if grid_windows is not None:
        return len(grid_windows)

    ps = exec_silent(['ps', '-e', '-o', 'comm='], capture_output=True, text=True)
    if ps.return_code != 0 or not ps.stdout:
        return 0

    count = 0
    for line in ps.stdout.splitlines():
        comm = line.strip()
        if is_linux_terminal_class(comm):
            count += 1
    return count
