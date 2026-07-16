# -*- coding: utf-8 -*-
"""
Window Launcher Utility Library
Provides utilities for launching multiple windows in grid layout
"""

import sys
from pathlib import Path

from pycore.pyutils.launcher.ratio_calculator import RatioCalculator
from pycore.pyutils.launcher.screen_manager import ScreenManager
from pycore.pyutils.launcher.explorer_executor import ExplorerExecutor
from pycore.pyutils.launcher.script_generator import ScriptGenerator
from pycore.pyutils.launcher.char_size_measurer import CharSizeMeasurer
from pycore.pyutils.launcher.wt_launcher import WindowsTerminalLauncher
from pycore.pyutils.launcher.editor_launcher import EditorLauncher
from pycore.pyutils.launcher.config_manager import ConfigManager
from pycore.pyutils.launcher.app_finder import AppFinder
from pycore.pyutils.launcher.menu import InteractiveMenu
from pycore.pyutils.launcher.launcher import WindowLauncher, main
from pycore.pyutils.launcher.launch_guard import (
    compute_terminal_deficit,
    count_open_terminals,
    is_app_running,
    is_pycore_module_running,
    resolve_process_names,
)

__all__ = [
    'RatioCalculator',
    'ScreenManager',
    'ExplorerExecutor',
    'ScriptGenerator',
    'CharSizeMeasurer',
    'WindowsTerminalLauncher',
    'EditorLauncher',
    'ConfigManager',
    'AppFinder',
    'InteractiveMenu',
    'WindowLauncher',
    'main',
    'compute_terminal_deficit',
    'count_open_terminals',
    'is_app_running',
    'is_pycore_module_running',
    'resolve_process_names',
]

