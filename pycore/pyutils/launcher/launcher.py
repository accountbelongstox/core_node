# -*- coding: utf-8 -*-
"""Window launcher CLI orchestrator: startup options, terminal grid, app slots, services."""

import argparse
import os
import platform
import sys
import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.timed_input import stdin_is_interactive
from pycore.pyfoundations.pygvar import PROJECT_ROOT
from pycore.pyutils.launcher.app_slots import launch_configured_apps
from pycore.pyutils.launcher.background_runner import launch_pycore_module
from pycore.pyutils.launcher.config_manager import ConfigManager
from pycore.pyutils.launcher.desktop_integration import ensure_desktop_shortcut, show_admin_permission_warning
from pycore.pyutils.launcher.grid_profile import (
    GridI18nKeys, enable_cross_device_mode, print_grid_startup_commands, resolve_terminal_grid)
from pycore.pyutils.launcher.launcher_text import launcher_text
from pycore.pyutils.launcher.menu import InteractiveMenu
from pycore.pyutils.launcher.screen_manager import create_screen_manager
from pycore.pyutils.launcher.service_orchestrator import run_launcher_service_prompts
from pycore.pyutils.launcher.terminal_backup_restore import offer_terminal_backup_restore
from pycore.pyutils.launcher.window_launcher import WindowLauncher

RULE = "=" * 60
CHROME_VERSIONS = ('stable', 'canary', 'beta')
DEFAULT_CHROME_VERSION = 'stable'
LAUNCH_MODES = ("windows", "module", "both", "device")
# Headless --mode / PYLAUNCHER_MODE -> equivalent interactive option.
MODE_OPTIONS = {'windows': '2', 'module': '3', 'device': '1', 'both': '4'}
OPTION_CROSS_DEVICE = '1'
OPTION_WINDOWS = '2'
OPTION_MODULE = '3'
OPTION_BOTH = '4'
OPTION_MENU = 'M'
OPTION_DEFAULT = ''
MODULE_START_SETTLE_SEC = 0.5
CONTINUE_ANSWERS = ('y', '')


class LauncherI18nKeys:
    STARTUP_TITLE = 'launcher.main.startup_title'
    STARTUP_OPTIONS = 'launcher.main.startup_options'
    ADMIN_TIP = 'launcher.main.admin_tip'
    HEADLESS_OPTION = 'launcher.main.headless_option'
    SELECT_OPTION = 'launcher.main.select_option'
    MODE_WINDOWS = 'launcher.main.mode_windows'
    MODE_MODULE = 'launcher.main.mode_module'
    MODE_BOTH = 'launcher.main.mode_both'
    MENU_DONE = 'launcher.main.menu_done'
    UNKNOWN_OPTION = 'launcher.main.unknown_option'
    MODULE_ONLY = 'launcher.main.module_only'
    PRESS_ENTER_EXIT = 'launcher.main.press_enter_exit'
    LAYOUT_TITLE = 'launcher.main.layout_title'
    LAYOUT_DETAILS = 'launcher.main.layout_details'
    LAYOUT_CALIBRATION = 'launcher.main.layout_calibration'
    LAYOUT_GRID = 'launcher.main.layout_grid'
    LAYOUT_WT_COUNT = 'launcher.main.layout_wt_count'
    LAYOUT_UBUNTU_COUNT = 'launcher.main.layout_ubuntu_count'
    LAYOUT_CALCULATION = 'launcher.main.layout_calculation'
    PRESS_CONTINUE = 'launcher.main.press_continue'


def _parse_launch_args():
    """Resolve (mode, no_pause) from argv / PYLAUNCHER_MODE / TTY.

    Headless when --mode or PYLAUNCHER_MODE is set, or when stdin is not a TTY.
    """
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--mode", choices=LAUNCH_MODES, default=None)
    parser.add_argument("--no-pause", action="store_true")
    args, _ = parser.parse_known_args()
    mode = args.mode or os.environ.get("PYLAUNCHER_MODE") or None
    no_pause = args.no_pause or bool(mode) or (not sys.stdin.isatty())
    return mode, no_pause


def _prompt(text: str) -> str:
    """input() that treats a closed stdin (EOF) as an empty answer."""
    try:
        return input(text)
    except EOFError:
        return ''


def _normalize_chrome_version(config_manager: ConfigManager) -> None:
    version = config_manager.get_app_config('chrome').get('version', DEFAULT_CHROME_VERSION)
    if version not in CHROME_VERSIONS:
        config_manager.set('applications.chrome.version', DEFAULT_CHROME_VERSION)
        config_manager.save_config()


def _print_startup_options() -> None:
    ColorPrint.plain("\n" + RULE)
    ColorPrint.plain(launcher_text.get(LauncherI18nKeys.STARTUP_TITLE))
    ColorPrint.plain(RULE)
    ColorPrint.plain(launcher_text.get(GridI18nKeys.MENU_CROSS_DEVICE))
    ColorPrint.plain(launcher_text.get(LauncherI18nKeys.STARTUP_OPTIONS))
    ColorPrint.plain(RULE)
    print_grid_startup_commands(PROJECT_ROOT)
    ColorPrint.plain(RULE)
    if platform.system() == 'Windows':
        ColorPrint.plain(launcher_text.get(LauncherI18nKeys.ADMIN_TIP))
    ColorPrint.plain(RULE)


def _select_option(mode, no_pause: bool) -> str:
    if no_pause:
        # Headless: never block on input(); with no mode use the default (Both),
        # the same action [Enter] selects in the interactive menu.
        option = MODE_OPTIONS.get(mode, OPTION_BOTH)
        ColorPrint.plain(launcher_text.get(LauncherI18nKeys.HEADLESS_OPTION, option=option))
        return option
    return _prompt(launcher_text.get(LauncherI18nKeys.SELECT_OPTION)).strip().upper()


def _apply_option(option: str, config_manager: ConfigManager):
    """Return (launch_windows, launch_module) for the chosen startup option."""
    if option == OPTION_WINDOWS:
        ColorPrint.plain(launcher_text.get(LauncherI18nKeys.MODE_WINDOWS))
        return True, False
    if option == OPTION_MODULE:
        ColorPrint.plain(launcher_text.get(LauncherI18nKeys.MODE_MODULE))
        return False, True
    if option in (OPTION_BOTH, OPTION_DEFAULT):
        ColorPrint.plain(launcher_text.get(LauncherI18nKeys.MODE_BOTH))
        return True, True
    if option == OPTION_CROSS_DEVICE:
        enable_cross_device_mode()
        ColorPrint.plain(launcher_text.get(GridI18nKeys.MODE_CROSS_DEVICE))
        return True, False
    if option == OPTION_MENU:
        InteractiveMenu(config_manager).run()
        ColorPrint.plain(launcher_text.get(LauncherI18nKeys.MENU_DONE))
        return True, True
    ColorPrint.plain(launcher_text.get(LauncherI18nKeys.UNKNOWN_OPTION))
    return True, True


def _launch_terminal_grid(config_manager: ConfigManager) -> None:
    ColorPrint.plain(RULE)
    ColorPrint.plain(launcher_text.get(LauncherI18nKeys.LAYOUT_TITLE))
    ColorPrint.plain(RULE)

    measurements_config = config_manager.get_measurements_config()
    calibration_config = config_manager.get_calibration_config()

    # Configured grid, or the resolution profile (2K 5x3 / 4K 6x3) when
    # terminal.auto_grid is on; the detected screen is reused for the layout.
    terminal_grid = resolve_terminal_grid(config_manager.get_terminal_config(), create_screen_manager())
    grid_columns = terminal_grid.columns
    grid_rows = terminal_grid.rows
    if grid_columns <= 0 or grid_rows <= 0:
        return

    measured_columns = measurements_config.get('columns', 67)
    measured_width_px = measurements_config.get('columns_width_px', 510)
    measured_rows = measurements_config.get('rows', 32)
    measured_height_px = measurements_config.get('rows_height_px', 485)
    calibration_height = calibration_config.get('actual_height_px', 485)
    calibration_rows = calibration_config.get('term_rows', 32)
    window_chrome = config_manager.get('window_chrome') or {}
    if not isinstance(window_chrome, dict):
        window_chrome = {}

    ColorPrint.plain(launcher_text.get(
        LauncherI18nKeys.LAYOUT_DETAILS, columns=measured_columns, width=measured_width_px,
        rows=measured_rows, height=measured_height_px))
    if calibration_height and calibration_rows:
        ColorPrint.plain(launcher_text.get(
            LauncherI18nKeys.LAYOUT_CALIBRATION, rows=calibration_rows, height=calibration_height))

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

    total_windows = grid_columns * grid_rows
    ubuntu_count = launcher.calculate_ubuntu_count(total_windows)
    ColorPrint.plain(launcher_text.get(
        LauncherI18nKeys.LAYOUT_GRID, columns=grid_columns, rows=grid_rows, total=total_windows))
    ColorPrint.plain(launcher_text.get(LauncherI18nKeys.LAYOUT_WT_COUNT, count=total_windows - ubuntu_count))
    if ubuntu_count > 0:
        ColorPrint.plain(launcher_text.get(LauncherI18nKeys.LAYOUT_UBUNTU_COUNT, count=ubuntu_count))
    ColorPrint.plain(launcher_text.get(LauncherI18nKeys.LAYOUT_CALCULATION))
    ColorPrint.plain(RULE)

    # Idempotent: WindowLauncher tops up only the deficit.
    launcher.launch_windows()


def main():
    """Main entry point"""
    # Skip third_party import-time dep check: this launcher only opens windows/apps
    # and must not trigger a heavy package install as a side effect of starting.
    os.environ['PYCORE_SKIP_DEP_CHECK'] = '1'

    # Resolve headless/interactive up front. When headless (--no-pause, --mode,
    # PYLAUNCHER_MODE, or a closed stdin) we never call input(): auto-start runs
    # this from a .desktop/systemd unit with no TTY, so any input() would block
    # the boot launcher forever.
    mode, no_pause = _parse_launch_args()

    ensure_desktop_shortcut()
    show_admin_permission_warning()

    # Application paths live in app_cache.json (AppPathCache), never in config.
    config_manager = ConfigManager()
    _normalize_chrome_version(config_manager)

    offer_terminal_backup_restore(config_manager, interactive=(not no_pause) and stdin_is_interactive())

    _print_startup_options()
    launch_windows, launch_module = _apply_option(_select_option(mode, no_pause), config_manager)

    if launch_module:
        launch_pycore_module()
        time.sleep(MODULE_START_SETTLE_SEC)

    if not launch_windows:
        ColorPrint.plain(launcher_text.get(LauncherI18nKeys.MODULE_ONLY))
        ColorPrint.plain("\n" + RULE)
        if not no_pause:
            _prompt(launcher_text.get(LauncherI18nKeys.PRESS_ENTER_EXIT))
        return

    _launch_terminal_grid(config_manager)

    # One browser (chrome), one code editor (cursor, then codex) and the system
    # default text editor; running slots are skipped and every app outlives
    # the launcher.
    launch_configured_apps(config_manager)

    # Offer laravel_main / mcp-chrome / nexus-dash background services: running
    # ones are skipped, the rest are started or installed after a timed Y/n.
    run_launcher_service_prompts(config_manager, interactive=(not no_pause) and stdin_is_interactive())

    # Headless (auto-start) runs skip this pause so the launcher exits on its own.
    ColorPrint.plain("\n" + RULE)
    if not no_pause:
        while _prompt(launcher_text.get(LauncherI18nKeys.PRESS_CONTINUE)).strip().lower() not in CONTINUE_ANSWERS:
            pass
