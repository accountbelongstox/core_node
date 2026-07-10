# -*- coding: utf-8 -*-
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
  - 152_install_terminal_grid_shortcut.sh : WindowLauncher(...).launch_windows(limit=...)
Backwards-compat re-exports below cover WindowLauncher, main, get_windows_version,
get_dev_env_path, ensure_desktop_shortcut, show_admin_permission_warning,
launch_pycore_module and the (deleted) launch_device_sync (kept as a no-op stub).
"""

import sys
from pathlib import Path

# Add project root to Python path to enable pycore imports
# This MUST be done before importing from pycore
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Now import remaining stdlib and pycore modules
import platform
import os
import tempfile
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime, run_background

from pycore.pyutils.launcher.screen_manager import ScreenManager
from pycore.pyutils.launcher.ratio_calculator import RatioCalculator
from pycore.pyutils.launcher.wt_launcher import WindowsTerminalLauncher
from pycore.pyutils.launcher.editor_launcher import EditorLauncher
from pycore.pyutils.launcher.script_generator import ScriptGenerator
from pycore.pyutils.launcher.explorer_executor import ExplorerExecutor
from pycore.pyutils.launcher.config_manager import ConfigManager
from pycore.pyutils.launcher.app_finder import AppFinder
from pycore.pyutils.launcher.menu import InteractiveMenu
from pycore.pyutils.common.icon_generator import DesktopIconGenerator
from pycore.pyutils.common.process_manager import ProcessManager

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
    import argparse, os, sys
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--mode", choices=["windows", "module", "both"], default=None)
    parser.add_argument("--no-pause", action="store_true")
    args, _ = parser.parse_known_args()
    mode = args.mode or os.environ.get("PYLAUNCHER_MODE") or None
    no_pause = args.no_pause or bool(mode) or (not sys.stdin.isatty())
    return mode, no_pause


def main():
    """Main entry point"""
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
    script_generator = ScriptGenerator()

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
    print("\n" + "=" * 60)
    print("Window Launcher - Startup Options")
    print("=" * 60)
    print("Options:")
    print("  [1] - Launch Window Layout Only")
    print("  [2] - Launch Pycore Module Only (background)")
    print("  [3] - Launch Both (Window Layout + Pycore Module)")
    print("  [M] - Configuration Menu")
    print("  [Enter] - Default (Launch Both)")
    print("=" * 60)
    print("Tip: If admin rights are needed, right-click the desktop shortcut -> Run as administrator.")
    print("=" * 60)

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
        print(f"[Launcher] Headless mode (no-pause); auto-selected option {user_input}")
    else:
        try:
            user_input = input("Select option: ").strip().upper()
        except EOFError:
            # stdin reported a TTY but yielded EOF (e.g. closed pipe): take the default.
            user_input = ''

    if user_input == '1':
        launch_windows = True
        launch_module = False
        print("\n[Launcher] Mode: Window Layout Only")
    elif user_input == '2':
        launch_windows = False
        launch_module = True
        print("\n[Launcher] Mode: Pycore Module Only")
    elif user_input == '3' or user_input == '':
        launch_windows = True
        launch_module = True
        print("\n[Launcher] Mode: Both (Window Layout + Pycore Module)")
    elif user_input == 'M':
        menu = InteractiveMenu(config_manager, app_finder)
        menu.run()
        print("\nContinuing with launcher...")
        launch_windows = True
        launch_module = True
    else:
        print("\n[Launcher] Unknown option, using default (Both)")
        launch_windows = True
        launch_module = True

    if launch_module:
        launch_pycore_module()
        import time
        time.sleep(0.5)

    if not launch_windows:
        print("\n[Launcher] Skipping window layout (Pycore Module only mode)")
        print("[Launcher] Pycore Module running in background (RPC v2 default :59000)")
        print("\n" + "=" * 60)
        if not no_pause:
            try:
                input("Press Enter to exit...")
            except EOFError:
                pass
        return

    print("=" * 60)
    print("Window Layout Calculator - Step by Step")
    print("=" * 60)

    # Use configuration
    term_config = config_manager.get_terminal_config()
    measurements_config = config_manager.get_measurements_config()
    calibration_config = config_manager.get_calibration_config()

    if term_config.get('enabled', True) and term_config.get('toggle') != 'DISABLE':
        # Update grid columns and rows from config
        grid_columns = term_config.get('columns', 3)
        grid_rows = term_config.get('rows', 2)
    else:
        grid_columns = 0
        grid_rows = 0

    # Launch based on configuration
    if grid_columns > 0 and grid_rows > 0:
        measured_columns = measurements_config.get('columns', 67)
        measured_width_px = measurements_config.get('columns_width_px', 510)
        measured_rows = measurements_config.get('rows', 164)
        measured_height_px = measurements_config.get('rows_height_px', 485)

        calibration_height = calibration_config.get('actual_height_px', 485)
        calibration_rows = calibration_config.get('term_rows', 270)
        window_chrome = config_manager.get('window_chrome') or {}
        if not isinstance(window_chrome, dict):
            window_chrome = {}

        print(f"\nCharacter size measurement:")
        print(f"  Column ratio: {measured_columns} columns = {measured_width_px}px")
        print(f"  Row ratio: {measured_rows} rows = {measured_height_px}px")
        if calibration_height and calibration_rows:
            print(f"  Calibration: {calibration_rows} rows = {calibration_height}px (actual)")

        total_windows = grid_columns * grid_rows
        ubuntu_count = WindowLauncher().calculate_ubuntu_count(total_windows)
        wt_count = total_windows - ubuntu_count

        print(f"Grid layout: {grid_columns} columns x {grid_rows} rows = {total_windows} windows")
        if ubuntu_count > 0:
            print(f"  - {wt_count} Windows Terminal windows")
            print(f"  - {ubuntu_count} Ubuntu terminals (auto-reserved)")
        else:
            print(f"  - {total_windows} Windows Terminal windows")
        print(f"Calculation: Window size = Screen / Grid, then convert to columns.rows using column/row ratios")
        print("=" * 60)

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
            window_chrome_gap_vertical_px=window_chrome.get('gap_vertical_px', 24)
        )

        # Launch windows
        launcher.launch_windows()
    else:
        print("Terminal launching is disabled")

    # Launch configured applications using explorer executor (via bat files)
    apps_config = config_manager.get_applications_config()
    executor = ExplorerExecutor()
    # Reused to skip browsers that are already running (avoid duplicate launches).
    process_manager = ProcessManager()

    for app_name, app_config in apps_config.items():
        if app_config.get('enabled', False):
            # vscode is intentionally not launched by this flow anymore.
            if app_name == 'vscode':
                print(f"\nSkipping {app_name} (not launched by this flow).")
                continue

            # chrome/edge: skip if an instance is already running (avoid duplicates).
            if app_name in ('chrome', 'edge'):
                exe_names = AppFinder.APP_DEFINITIONS.get(app_name, {}).get('names', [])
                if any(process_manager.is_process_running(name) for name in exe_names):
                    print(f"\nSkipping {app_name} (already running).")
                    continue

            # Get path from cache first, then from config if cache doesn't have it
            app_path = None

            # Try to get from cache (AppFinder cache)
            if app_name == 'chrome':
                version = app_config.get('version', 'stable')
                cache_key = f'chrome_{version}'
                if cache_key in app_finder.cache:
                    cached_path = Path(app_finder.cache[cache_key])
                    if cached_path.exists():
                        app_path = str(cached_path)
            elif app_name == 'chrome_beta':
                # chrome_beta always uses beta version
                # Use same cache key format as find_chrome_by_version('beta')
                cache_key = 'chrome_beta'
                if cache_key in app_finder.cache:
                    cached_path = Path(app_finder.cache[cache_key])
                    if cached_path.exists():
                        app_path = str(cached_path)
            else:
                cache_key = f'{app_name}_path'
                if cache_key in app_finder.cache:
                    cached_path = Path(app_finder.cache[cache_key])
                    if cached_path.exists():
                        app_path = str(cached_path)

            # If not in cache, try to find it (and save to cache only, NOT config)
            if not app_path:
                if app_name == 'chrome':
                    version = app_config.get('version', 'stable')
                    app_path = app_finder.find_chrome_by_version(version)
                elif app_name == 'chrome_beta':
                    app_path = app_finder.find_chrome_by_version('beta')
                else:
                    app_path = app_finder.find_app(app_name)
                # AppFinder.save_cache() will be called by find_app/find_chrome_by_version
                # Paths are saved to app_cache.json, NOT config.json

            if app_path:
                print(f"\nLaunching {app_name}...")
                try:
                    app_path_obj = Path(app_path)

                    if app_path_obj.exists():
                        # Windows: write a launch .bat (legacy/diagnostic) first.
                        # Linux: skip it (an unrunnable, stray .bat artifact) and just
                        # launch the binary independently.
                        if platform.system() == 'Windows':
                            temp_bat = script_generator.get_temp_dir() / f'launch_{app_name}.bat'
                            bat_content = f'@echo off\r\nstart "" "{app_path}"\r\n'
                            with open(temp_bat, 'w', encoding='utf-8', newline='\r\n') as f:
                                f.write(bat_content)
                        # Launch independently (explorer on Windows; exec/xdg-open on Linux).
                        executor.execute_file(app_path, independent=True)
                        print(f"  Launched: {app_path}")
                    else:
                        print(f"  Error: Application path does not exist: {app_path}")
                except Exception as e:
                    print(f"Failed to launch {app_name}: {e}")

    # Pause to view output, wait for 'y' or Enter to continue.
    # Headless (auto-start) runs skip this pause so the launcher exits on its own.
    print("\n" + "=" * 60)
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
