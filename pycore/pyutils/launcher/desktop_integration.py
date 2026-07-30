# -*- coding: utf-8 -*-
"""
Desktop-integration helpers for the window launcher.

Extracted from launcher.py (modular split per AGENTS.md 800-line rule). Module-level
helpers:
- get_windows_version / get_dev_env_path: DELEGATE to ShortcutManager (re-use; the
  local copies duplicated pycore/pyutils/desktop/universal_shortcut.py static methods).
  The sibling is NOT edited - we only call into it.
- ensure_desktop_shortcut: Windows .bat+.lnk via DesktopIconGenerator; Linux
  freedesktop .desktop entry. TODO: consolidate the hand-rolled freedesktop .desktop
  path with DesktopShortcutManager/ShortcutManager (reuse-first).
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
import tempfile

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.desktop_icon_generator import DesktopIconGenerator
from pycore.pyfoundations.shortcut_manager import ShortcutManager

# Real entry point for the desktop shortcut (.bat / .desktop). Must NOT use __file__
# here — this module was split out of launcher.py and __file__ would point here.
_LAUNCHER_DIR = Path(__file__).resolve().parent
_LAUNCHER_PY_PATH = _LAUNCHER_DIR / 'launcher.py'


def get_windows_version():
    """Get Windows version (win10 or win11).

    Delegates to the foundation ShortcutManager implementation.
    """
    return ShortcutManager.get_windows_version()


def get_dev_env_path():
    """Get dev environment path. On Windows this is D:\\.dev_<winver>\\.winenvs
    (where the launcher .bat shortcut lives). On non-Windows there is no such
    drive, so use a hidden dir under the user home - otherwise the literal
    "D:\\.dev_...\\.winenvs" string is created as a folder in the cwd.

    Delegates to the foundation ShortcutManager implementation.
    """
    return ShortcutManager.get_dev_env_path()


def ensure_desktop_shortcut():
    """Ensure the "Window Launcher" desktop entry exists (create or replace).

    Windows: a .bat plus a .lnk via DesktopIconGenerator. Linux (Debian/Ubuntu/Kali):
    a freedesktop .desktop file in ~/.local/share/applications. macOS/other: no-op.
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
        entry = (
            "[Desktop Entry]\n"
            "Type=Application\n"
            "Name=Window Launcher\n"
            f'Exec="{sys.executable}" "{launcher_py_path}"\n'
            f"Icon={icon_field}\n"
            "Terminal=false\n"
            "Categories=Utility;\n"
            "Comment=Launch Window Launcher - Multiple Terminal Windows\n"
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
    shortcut_name = "Window Launcher"

    # Create bat file in dev environment directory
    dev_env_path = get_dev_env_path()
    bat_path = dev_env_path / 'launch.bat'

    # Get Python executable
    python_exe = sys.executable

    # Create bat file content - use start with /B to run in background and avoid cmd window
    # Change to launcher directory to ensure correct working directory
    launcher_dir = launcher_py_path.parent
    bat_content = f'@echo off\r\ncd /d "{launcher_dir}"\r\n"{python_exe}" "{launcher_py_path}"\r\n'

    # Write bat file (overwrite if exists)
    with open(bat_path, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(bat_content)

    ColorPrint.plain(f"Created/updated bat file: {bat_path}")

    # Use icon.ico if available, then icon.png, otherwise use Python icon
    icon_ico_path = launcher_dir / 'icon.ico'
    icon_png_path = launcher_dir / 'icon.png'
    if icon_ico_path.exists():
        icon_path = str(icon_ico_path)
    elif icon_png_path.exists():
        icon_path = str(icon_png_path)
    else:
        icon_path = python_exe

    # Create desktop shortcut pointing to bat file (will create or overwrite)
    try:
        icon_generator.create_shortcut(
            target_path=bat_path,
            name=shortcut_name,
            icon_path=icon_path,  # Use icon.ico, icon.png, or Python icon
            working_dir=str(launcher_dir),  # Set working directory to launcher directory
            description="Launch Window Launcher - Multiple Terminal Windows"
        )
        ColorPrint.plain(f"Created/updated desktop shortcut: {shortcut_name}")
    except Exception as e:
        ColorPrint.plain(f"Warning: Failed to create desktop shortcut: {e}")


# Use file lock to ensure warning is shown only once (even across multiple imports)
def show_admin_permission_warning():
    """Show warning about administrator permission for shortcut (only once) - using file lock"""
    if platform.system() != 'Windows':
        return  # Windows-only "Run as administrator" guidance; irrelevant on Linux/macOS
    # Use a lock file to ensure only one process shows the warning
    lock_file = Path(tempfile.gettempdir()) / 'window_launcher_admin_warning_shown.lock'

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
