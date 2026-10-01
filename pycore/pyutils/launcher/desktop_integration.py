# -*- coding: utf-8 -*-
"""
Desktop integration for the window launcher: the "Window Launcher" desktop entry
(Windows .lnk shared with shortcut_check.ps1; Linux freedesktop .desktop) and the
Windows-only "Run as administrator" guidance.
"""

import platform
import sys
from pathlib import Path

from pycore.pyfoundations.desktop_icon_generator import DesktopIconGenerator
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import PROJECT_ROOT, TMP_DIR
from pycore.pyfoundations.runtime_abi import PYTHON_VERSION
from pycore.pyfoundations.shortcut_manager import ShortcutManager
from pycore.pyutils.launcher.launcher_text import launcher_text

LAUNCHER_DIR = Path(__file__).resolve().parent

# Windows shortcut contract shared with shortcut_check.ps1 (keep both identical):
# <GlobalVars.ps1 PYTHON_EXE_PATH> -m pycore.pyutils.launcher, started in the repo root.
LAUNCHER_SHORTCUT_NAME = "Window Launcher"
LAUNCHER_SHORTCUT_DESCRIPTION = "Launch Window Launcher - Multiple Terminal Windows"
LAUNCHER_MODULE = "pycore.pyutils.launcher"
LAUNCHER_SHORTCUT_ARGUMENTS = f"-m {LAUNCHER_MODULE}"
PYTHON_DIR_PREFIX = "python"
PYTHON_EXE_NAME = "python.exe"
ICON_ICO_NAME = "icon.ico"
ICON_PNG_NAME = "icon.png"

# Linux freedesktop entry. The canonical helper (installed by
# 193_install_window_launcher_shortcut.sh) spawns a known emulator itself; the
# fallback runs the launcher module with Terminal=true and lets the DE pick one.
LINUX_DESKTOP_FILE = 'window-launcher.desktop'
LINUX_DESKTOP_HELPER = Path('/usr/local/bin/devlauncher')
LINUX_FALLBACK_ICON = 'utilities-terminal'

ADMIN_WARNING_MARKER = TMP_DIR / 'window_launcher_admin_warning_shown.lock'
WARNING_RULE = "=" * 60


class DesktopI18nKeys:
    ENTRY_UPDATED = 'launcher.desktop.entry_updated'
    ENTRY_FAILED = 'launcher.desktop.entry_failed'
    SHORTCUT_FAILED = 'launcher.desktop.shortcut_failed'
    ADMIN_WARNING = 'launcher.desktop.admin_warning'


def launcher_python_exe() -> Path:
    """Interpreter the Windows shortcut targets: GlobalVars.ps1 PYTHON_EXE_PATH
    (D:\\.dev_<winver>\\python<ver>\\python.exe) when installed, else the running one."""
    lang_compiler_dir = ShortcutManager.get_dev_env_path().parent
    canonical_python = lang_compiler_dir / f"{PYTHON_DIR_PREFIX}{PYTHON_VERSION.replace('.', '')}" / PYTHON_EXE_NAME
    if canonical_python.is_file():
        return canonical_python
    return Path(sys.executable)


def ensure_desktop_shortcut() -> None:
    """Ensure the "Window Launcher" desktop entry exists (create or replace)."""
    system = platform.system()
    if system == 'Linux':
        _ensure_linux_desktop_entry()
    elif system == 'Windows':
        _ensure_windows_shortcut()


def _ensure_linux_desktop_entry() -> None:
    icon_png = LAUNCHER_DIR / ICON_PNG_NAME
    icon_field = str(icon_png) if icon_png.exists() else LINUX_FALLBACK_ICON
    if LINUX_DESKTOP_HELPER.exists():
        exec_line, working_dir, terminal = str(LINUX_DESKTOP_HELPER), None, False
    else:
        exec_line, working_dir, terminal = f'"{sys.executable}" {LAUNCHER_SHORTCUT_ARGUMENTS}', str(PROJECT_ROOT), True
    dest = ShortcutManager().write_linux_desktop_entry(
        name=LAUNCHER_SHORTCUT_NAME,
        exec_line=exec_line,
        icon=icon_field,
        working_dir=working_dir,
        terminal=terminal,
        comment=LAUNCHER_SHORTCUT_DESCRIPTION,
        file_name=LINUX_DESKTOP_FILE,
    )
    if dest is None:
        ColorPrint.yellow(launcher_text.get(DesktopI18nKeys.ENTRY_FAILED, path=LINUX_DESKTOP_FILE, error=""))
        return
    ColorPrint.plain(launcher_text.get(DesktopI18nKeys.ENTRY_UPDATED, path=dest))


def _ensure_windows_shortcut() -> None:
    python_exe = launcher_python_exe()
    icon_ico_path = LAUNCHER_DIR / ICON_ICO_NAME
    icon_png_path = LAUNCHER_DIR / ICON_PNG_NAME
    if icon_ico_path.exists():
        icon_path = str(icon_ico_path)
    elif icon_png_path.exists():
        icon_path = str(icon_png_path)
    else:
        icon_path = str(python_exe)

    # DesktopIconGenerator rewrites the .lnk only when a property differs.
    try:
        DesktopIconGenerator().create_shortcut(
            target_path=python_exe,
            name=LAUNCHER_SHORTCUT_NAME,
            icon_path=icon_path,
            working_dir=str(Path(PROJECT_ROOT).resolve()),
            arguments=LAUNCHER_SHORTCUT_ARGUMENTS,
            description=LAUNCHER_SHORTCUT_DESCRIPTION
        )
    except (OSError, RuntimeError) as exc:
        ColorPrint.yellow(launcher_text.get(DesktopI18nKeys.SHORTCUT_FAILED, target=python_exe, error=exc))


def show_admin_permission_warning() -> None:
    """Windows-only "Run as administrator" guidance, shown once per machine (marker file)."""
    if platform.system() != 'Windows' or ADMIN_WARNING_MARKER.exists():
        return
    try:
        ADMIN_WARNING_MARKER.touch()
    except OSError as exc:
        ColorPrint.yellow(f"[desktop_integration] touch {ADMIN_WARNING_MARKER} failed: {exc}")
    ColorPrint.plain("\n" + WARNING_RULE)
    ColorPrint.plain(launcher_text.get(DesktopI18nKeys.ADMIN_WARNING, shortcut=LAUNCHER_SHORTCUT_NAME))
    ColorPrint.plain(WARNING_RULE + "\n")
