# -*- coding: utf-8 -*-
import argparse, os, sys
"""
Window Launcher Main Module
Main entry point for launching multiple windows in grid layout

Modular split per AGENTS.md (800-line rule): the implementation now lives in
sibling modules under this package:
  - window_launcher.py    : WindowLauncher class (grid math + launch_* entry points)
  - desktop_integration.py: get_windows_version / get_dev_env_path (delegated to
                             ShortcutManager), ensure_desktop_shortcut,
                             show_admin_permission_warning
  - background_runner.py  : launch_pycore_module
This file keeps the CLI orchestrator (_parse_launch_args / main) and re-exports
the public API so existing importers are unaffected:
  - __init__.py / __main__.py : `from ...launcher import WindowLauncher, main`
  - 193_install_window_launcher_shortcut.sh : WindowLauncher(...).launch_windows(limit=...)
Backwards-compat re-exports below cover WindowLauncher, main, get_windows_version,
get_dev_env_path, ensure_desktop_shortcut, show_admin_permission_warning,
launch_pycore_module and the (deleted) launch_device_sync (kept as a no-op stub).
"""

import sys
from pathlib import Path

import time


# Add project root to Python path to enable pycore imports
# This MUST be done before importing from pycore
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Now import remaining stdlib and pycore modules
import platform
import os
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime, run_background

from pycore.pyfoundations.pybasecommon.timed_input import stdin_is_interactive
from pycore.pyutils.launcher.screen_manager import ScreenManager, create_screen_manager
from pycore.pyutils.launcher.ratio_calculator import RatioCalculator
from pycore.pyutils.launcher.wt_launcher import WindowsTerminalLauncher
from pycore.pyutils.launcher.editor_launcher import EditorLauncher
from pycore.pyutils.launcher.config_manager import ConfigManager
from pycore.pyutils.launcher.app_finder import AppFinder
from pycore.pyutils.launcher.menu import InteractiveMenu
from pycore.pyutils.launcher.grid_profile import resolve_terminal_grid
from pycore.pyutils.launcher.app_slots import launch_configured_apps
from pycore.pyutils.launcher.service_orchestrator import run_launcher_service_prompts

# ============================================================================
# Re-exports: implementations split into sibling modules (public API preserved).
# ============================================================================
from pycore.pyutils.launcher.window_launcher import WindowLauncher
from pycore.pyutils.launcher.desktop_integration import (
    get_windows_version,
    get_dev_env_path,
    ensure_desktop_shortcut,
    show_admin_permission_warning,
)
from pycore.pyutils.launcher.background_runner import launch_pycore_module


# ============================================================================
# Legacy constants - DEPRECATED: Use ConfigManager instead
# These are kept for backward compatibility but should be removed
# ============================================================================
# Note: All configuration should now come from ConfigManager
# These constants are only used as fallbacks when config is not available


def launch_device_sync():
    """Launch device sync in background mode.

    DISABLED dead code (formerly L423-505). Its body began with a bare ``return``,
    so it never executed anything. The implementation was removed (reuse-first =
    remove dead). Kept as a no-op stub for backwards compatibility so any importer
    that still references the name does not break.

    TODO: remove this stub once confirmed no importer references launch_device_sync.
    """
    return


def _parse_launch_args():
    """Resolve (mode, no_pause) from argv / PYLAUNCHER_MODE / TTY.

    Headless when --mode or PYLAUNCHER_MODE is set, or when stdin is not a TTY.
    """
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--mode", choices=["windows", "module", "both"], default=None)
    parser.add_argument("--no-pause", action="store_true")
    args, _ = parser.parse_known_args()
    mode = args.mode or os.environ.get("PYLAUNCHER_MODE") or None
    no_pause = args.no_pause or bool(mode) or (not sys.stdin.isatty())
    return mode, no_pause


def main():
    """Main entry point"""
    # Skip third_party import-time dep check: this launcher only opens windows/apps
    # and must not trigger a heavy package install as a side effect of starting.
    if os.environ.get('PYCORE_SKIP_DEP_CHECK') != '1':
        os.environ['PYCORE_SKIP_DEP_CHECK'] = '1'

    # Resolve headless/interactive up front. When headless (--no-pause, --mode,
    # PYLAUNCHER_MODE, or a closed stdin) we never call input(): auto-start runs
    # this from a .desktop/systemd unit with no TTY, so any input() would block
    # the boot launcher forever.
    mode, no_pause = _parse_launch_args()

    # Check and create desktop shortcut if needed
    ensure_desktop_shortcut()

    # Show administrator permission warning (only once)
    show_admin_permission_warning()

    # Load configuration and find applications
    config_manager = ConfigManager()
    app_finder = AppFinder()

    # Fix version names (migrate old format to English) in config only
    apps_config = config_manager.get_applications_config()
    config_updated = False

    for app_name, app_config in apps_config.items():
        # Fix version names (migrate old format to English)
        if app_name == 'chrome':
            version = app_config.get('version', 'stable')
            # Convert old format version names to English if needed
            version_map = {
                'stable': 'stable',
                'canary': 'canary',
                'beta': 'beta'
            }
            # If version is not in standard format, default to stable
            if version not in version_map:
                version = 'stable'
                config_manager.set('applications.chrome.version', 'stable')
                config_updated = True
            else:
                version = version_map.get(version, 'stable')

    if config_updated:
        config_manager.save_config()

    # Note: Application path cache is stored in app_cache.json by AppFinder
    # Do NOT write paths to config.json automatically
    # Paths are only written when user explicitly finds applications via menu

    # Show prompt
    ColorPrint.plain("\n" + "=" * 60)
    ColorPrint.plain("Window Launcher - Startup Options")
    ColorPrint.plain("=" * 60)
    ColorPrint.plain("Options:")
    ColorPrint.plain("  [1] - Launch Window Layout Only")
    ColorPrint.plain("  [2] - Launch Pycore Module Only (background)")
    ColorPrint.plain("  [3] - Launch Both (Window Layout + Pycore Module)")
    ColorPrint.plain("  [M] - Configuration Menu")
    ColorPrint.plain("  [Enter] - Default (Launch Both)")
    ColorPrint.plain("=" * 60)
    if platform.system() == 'Windows':
        ColorPrint.plain("Tip: If admin rights are needed, right-click the desktop shortcut -> Run as administrator.")
    ColorPrint.plain("=" * 60)

    launch_windows = True
    launch_module = False

    if no_pause:
        # Headless: never block on input(). Map --mode/PYLAUNCHER_MODE to the
        # equivalent menu option; with no mode use the default (Both), the same
        # action [Enter] selects in the interactive menu.
        if mode == 'windows':
            user_input = '1'
        elif mode == 'module':
            user_input = '2'
        else:  # 'both' or None
            user_input = '3'
        ColorPrint.plain(f"[Launcher] Headless mode (no-pause); auto-selected option {user_input}")
    else:
        try:
            user_input = input("Select option: ").strip().upper()
        except EOFError:
            # stdin reported a TTY but yielded EOF (e.g. closed pipe): take the default.
            user_input = ''

    if user_input == '1':
        launch_windows = True
        launch_module = False
        ColorPrint.plain("\n[Launcher] Mode: Window Layout Only")
    elif user_input == '2':
        launch_windows = False
        launch_module = True
        ColorPrint.plain("\n[Launcher] Mode: Pycore Module Only")
    elif user_input == '3' or user_input == '':
        launch_windows = True
        launch_module = True
        ColorPrint.plain("\n[Launcher] Mode: Both (Window Layout + Pycore Module)")
    elif user_input == 'M':
        menu = InteractiveMenu(config_manager, app_finder)
        menu.run()
        ColorPrint.plain("\nContinuing with launcher...")
        launch_windows = True
        launch_module = True
    else:
        ColorPrint.plain("\n[Launcher] Unknown option, using default (Both)")
        launch_windows = True
        launch_module = True

    if launch_module:
        launch_pycore_module()
        time.sleep(0.5)

    if not launch_windows:
        ColorPrint.plain("\n[Launcher] Skipping window layout (Pycore Module only mode)")
        ColorPrint.plain("[Launcher] Pycore Module running in background (RPC v2 default :59000)")
        ColorPrint.plain("\n" + "=" * 60)
        if not no_pause:
            try:
                input("Press Enter to exit...")
            except EOFError:
                pass
        return

    ColorPrint.plain("=" * 60)
    ColorPrint.plain("Window Layout Calculator - Step by Step")
    ColorPrint.plain("=" * 60)

    # Use configuration
    term_config = config_manager.get_terminal_config()
    measurements_config = config_manager.get_measurements_config()
    calibration_config = config_manager.get_calibration_config()

    # Configured grid, or the resolution profile (2K 5x3 / 4K 6x3) when
    # terminal.auto_grid is on; the detected screen is reused for the layout.
    terminal_grid = resolve_terminal_grid(term_config, create_screen_manager())
    grid_columns = terminal_grid.columns
    grid_rows = terminal_grid.rows

    # Launch based on configuration
    if grid_columns > 0 and grid_rows > 0:
        measured_columns = measurements_config.get('columns', 67)
        measured_width_px = measurements_config.get('columns_width_px', 510)
        measured_rows = measurements_config.get('rows', 32)
        measured_height_px = measurements_config.get('rows_height_px', 485)

        calibration_height = calibration_config.get('actual_height_px', 485)
        calibration_rows = calibration_config.get('term_rows', 32)
        window_chrome = config_manager.get('window_chrome') or {}
        if not isinstance(window_chrome, dict):
            window_chrome = {}

        ColorPrint.plain(f"\nCharacter size measurement:")
        ColorPrint.plain(f"  Column ratio: {measured_columns} columns = {measured_width_px}px")
        ColorPrint.plain(f"  Row ratio: {measured_rows} rows = {measured_height_px}px")
        if calibration_height and calibration_rows:
            ColorPrint.plain(f"  Calibration: {calibration_rows} rows = {calibration_height}px (actual)")

        total_windows = grid_columns * grid_rows
        ubuntu_count = WindowLauncher().calculate_ubuntu_count(total_windows)
        wt_count = total_windows - ubuntu_count

        ColorPrint.plain(f"Grid layout: {grid_columns} columns x {grid_rows} rows = {total_windows} windows")
        if ubuntu_count > 0:
            ColorPrint.plain(f"  - {wt_count} Windows Terminal windows")
            ColorPrint.plain(f"  - {ubuntu_count} Ubuntu terminals (auto-reserved)")
        else:
            ColorPrint.plain(f"  - {total_windows} Windows Terminal windows")
        ColorPrint.plain(f"Calculation: Window size = Screen / Grid, then convert to columns.rows using column/row ratios")
        ColorPrint.plain("=" * 60)

        # Create launcher instance with values from config
        launcher = WindowLauncher(
            grid_columns=grid_columns,
            grid_rows=grid_rows,
            measured_columns=measured_columns,
            measured_rows=measured_rows,
            measured_width_px=measured_width_px,
            measured_height_px=measured_height_px,
            calibration_actual_height=calibration_height,
            calibration_term_rows=calibration_rows,
            window_chrome_title_bar_px=window_chrome.get('title_bar_plus_padding_px', 56),
            window_chrome_horizontal_px=window_chrome.get('horizontal_padding_px', 24),
            window_chrome_content_scale=window_chrome.get('content_scale', 0.78),
            window_chrome_gap_horizontal_px=window_chrome.get('gap_horizontal_px', 16),
            window_chrome_gap_vertical_px=window_chrome.get('gap_vertical_px', 24),
            screen_rect=terminal_grid.screen_rect,
            auto_profile=terminal_grid.profile
        )

        # Launch windows (idempotent: WindowLauncher tops up only the deficit).
        launcher.launch_windows()

    # One browser (chrome), one code editor (cursor, then codex) and the system
    # default text editor; running slots are skipped and every app outlives
    # the launcher.
    launch_configured_apps(config_manager, app_finder)

    # Offer laravel_main / mcp-chrome / nexus-dash background services: running
    # ones are skipped, the rest are started or installed after a timed Y/n.
    run_launcher_service_prompts(config_manager, interactive=(not no_pause) and stdin_is_interactive())

    # Pause to view output, wait for 'y' or Enter to continue.
    # Headless (auto-start) runs skip this pause so the launcher exits on its own.
    ColorPrint.plain("\n" + "=" * 60)
    if not no_pause:
        while True:
            try:
                user_input = input("Press 'y' or Enter to continue: ").strip().lower()
            except EOFError:
                break
            if user_input == 'y' or user_input == '':
                break


if __name__ == '__main__':
    main()
