# -*- coding: utf-8 -*-
"""
Desktop-integration helpers for the window launcher.

Extracted from launcher.py (modular split per AGENTS.md 800-line rule). Module-level
helpers:
- get_windows_version / get_dev_env_path: DELEGATE to ShortcutManager (re-use; the
  local copies duplicated pycore/pyutils/desktop/universal_shortcut.py static methods).
  The sibling is NOT edited - we only call into it.
- ensure_desktop_shortcut: Windows .lnk via DesktopIconGenerator (the same target as
  shortcut_check.ps1, so neither writer rewrites the other); Linux freedesktop
  .desktop entry. TODO: consolidate the hand-rolled freedesktop .desktop path with
  DesktopShortcutManager/ShortcutManager (reuse-first).
- show_admin_permission_warning: Windows-only "Run as administrator" guidance.
"""

import sys
from pathlib import Path

import subprocess


# Add project root to Python path to enable pycore imports. Same bootstrap as
# launcher.py so this module is importable standalone.
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import platform
import os

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.desktop_icon_generator import DesktopIconGenerator
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.runtime_abi import PYTHON_VERSION
from pycore.pyfoundations.shortcut_manager import ShortcutManager

# Real entry point for the .desktop fallback. Must NOT use __file__
# here — this module was split out of launcher.py and __file__ would point here.
_LAUNCHER_DIR = Path(__file__).resolve().parent
_LAUNCHER_PY_PATH = _LAUNCHER_DIR / 'launcher.py'

# Windows shortcut contract shared with shortcut_check.ps1 (keep both identical):
# <GlobalVars.ps1 PYTHON_EXE_PATH> -m pycore.pyutils.launcher, started in the repo root.
LAUNCHER_SHORTCUT_NAME = "Window Launcher"
LAUNCHER_SHORTCUT_DESCRIPTION = "Launch Window Launcher - Multiple Terminal Windows"
LAUNCHER_SHORTCUT_ARGUMENTS = "-m pycore.pyutils.launcher"
_PYTHON_DIR_PREFIX = "python"
_PYTHON_EXE_NAME = "python.exe"
_ICON_ICO_NAME = "icon.ico"
_ICON_PNG_NAME = "icon.png"


def get_windows_version():
    """Get Windows version (win10 or win11).

    Delegates to the foundation ShortcutManager implementation.
    """
    return ShortcutManager.get_windows_version()


def get_dev_env_path():
    """Get dev environment path. On Windows this is D:\\.dev_<winver>\\.winenvs
    (its parent is GlobalVars.ps1 LANG_COMPILER_DIR). On non-Windows there is no such
    drive, so use a hidden dir under the user home - otherwise the literal
    "D:\\.dev_...\\.winenvs" string is created as a folder in the cwd.

    Delegates to the foundation ShortcutManager implementation.
    """
    return ShortcutManager.get_dev_env_path()


def get_launcher_python_exe() -> Path:
    """Interpreter the Windows shortcut targets: GlobalVars.ps1 PYTHON_EXE_PATH
    (D:\\.dev_<winver>\\python<ver>\\python.exe) when installed, else the running one."""
    lang_compiler_dir = get_dev_env_path().parent
    canonical_python = lang_compiler_dir / f"{_PYTHON_DIR_PREFIX}{PYTHON_VERSION.replace('.', '')}" / _PYTHON_EXE_NAME
    if canonical_python.is_file():
        return canonical_python
    return Path(sys.executable)


def ensure_desktop_shortcut():
    """Ensure the "Window Launcher" desktop entry exists (create or replace).

    Windows: a .lnk via DesktopIconGenerator targeting get_launcher_python_exe() with
    LAUNCHER_SHORTCUT_ARGUMENTS in the repo root (identical to shortcut_check.ps1).
    Linux (Debian/Ubuntu/Kali): a freedesktop .desktop file in
    ~/.local/share/applications. macOS/other: no-op.
    The previous version ran the Windows path on every OS, so on Linux it wrote a
    useless .bat and then swallowed a RuntimeError (win32com absent) - leaving no
    desktop entry at all.

    TODO: the Linux freedesktop .desktop branch is hand-rolled here; consolidate
    with DesktopShortcutManager/ShortcutManager (reuse-first) rather than maintaining
    a separate .desktop writer.
    """
    launcher_py_path = _LAUNCHER_PY_PATH
    launcher_dir = _LAUNCHER_DIR

    if platform.system() == 'Linux':
        apps_dir = Path.home() / '.local' / 'share' / 'applications'
        apps_dir.mkdir(parents=True, exist_ok=True)
        icon_png = launcher_dir / 'icon.png'
        icon_field = str(icon_png) if icon_png.exists() else 'utilities-terminal'
        # The freedesktop "Terminal" key only says the app needs a terminal; the
        # spec leaves emulator choice to the DE, so the canonical helper (installed
        # by 193_install_window_launcher_shortcut.sh) is preferred: it spawns a known
        # emulator itself and shows the same interactive startup menu as Windows.
        # Fallback: run launcher.py with Terminal=true and let the DE pick one.
        helper = Path('/usr/local/bin/devlauncher')
        if helper.exists():
            exec_line = f'Exec={helper}'
            terminal_field = 'false'
        else:
            exec_line = f'Exec="{sys.executable}" "{launcher_py_path}"'
            terminal_field = 'true'
        entry = (
            "[Desktop Entry]\n"
            "Type=Application\n"
            f"Name={LAUNCHER_SHORTCUT_NAME}\n"
            f"{exec_line}\n"
            f"Icon={icon_field}\n"
            f"Terminal={terminal_field}\n"
            "Categories=Utility;\n"
            f"Comment={LAUNCHER_SHORTCUT_DESCRIPTION}\n"
        )
        dest = apps_dir / 'window-launcher.desktop'
        try:
            dest.write_text(entry, encoding='utf-8')
            os.chmod(dest, 0o755)
            subprocess.run(['update-desktop-database', str(apps_dir)], check=False,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            ColorPrint.plain(f"Created/updated .desktop entry: {dest}")
        except Exception as e:
            ColorPrint.plain(f"Warning: Failed to create .desktop entry: {e}")
        return

    if platform.system() != 'Windows':
        return  # macOS / other: no desktop-shortcut integration

    icon_generator = DesktopIconGenerator()
    python_exe = get_launcher_python_exe()

    # Use icon.ico if available, then icon.png, otherwise use Python icon
    icon_ico_path = launcher_dir / _ICON_ICO_NAME
    icon_png_path = launcher_dir / _ICON_PNG_NAME
    if icon_ico_path.exists():
        icon_path = str(icon_ico_path)
    elif icon_png_path.exists():
        icon_path = str(icon_png_path)
    else:
        icon_path = str(python_exe)

    # DesktopIconGenerator rewrites the .lnk only when a property differs
    try:
        icon_generator.create_shortcut(
            target_path=python_exe,
            name=LAUNCHER_SHORTCUT_NAME,
            icon_path=icon_path,
            working_dir=str(PROJECT_ROOT.resolve()),
            arguments=LAUNCHER_SHORTCUT_ARGUMENTS,
            description=LAUNCHER_SHORTCUT_DESCRIPTION
        )
    except Exception as e:
        ColorPrint.plain(f"Warning: Failed to create desktop shortcut: {e}")


# Use file lock to ensure warning is shown only once (even across multiple imports)
def show_admin_permission_warning():
    """Show warning about administrator permission for shortcut (only once) - using file lock"""
    if platform.system() != 'Windows':
        return  # Windows-only "Run as administrator" guidance; irrelevant on Linux/macOS
    # Use a lock file to ensure only one process shows the warning
    lock_file = TMP_DIR / 'window_launcher_admin_warning_shown.lock'

    # Check if warning was already shown (check lock file)
    if lock_file.exists():
        return

    # Create lock file immediately to prevent duplicate warnings
    try:
        lock_file.touch()
    except:
        pass  # If we can't create lock file, continue anyway

    # Print warning WITHOUT ANSI codes to avoid Windows terminal issues
    # Simple text output that won't cause duplicate printing
    ColorPrint.plain("\n" + "=" * 60)
    ColorPrint.plain("WARNING: Administrator Permission Required")
    ColorPrint.plain("=" * 60)
    ColorPrint.plain("Please add 'Run as administrator' permission to the")
    ColorPrint.plain("'Window Launcher' desktop shortcut:")
    ColorPrint.plain("\nSteps:")
    ColorPrint.plain("1. Right-click on 'Window Launcher' shortcut on desktop")
    ColorPrint.plain("2. Select 'Properties'")
    ColorPrint.plain("3. Go to 'Advanced' tab (or 'Compatibility' tab)")
    ColorPrint.plain("4. Check 'Run as administrator'")
    ColorPrint.plain("5. Click 'OK' to save")
    ColorPrint.plain("\nThis will ensure proper window positioning and permissions.")
    ColorPrint.plain("=" * 60 + "\n")
