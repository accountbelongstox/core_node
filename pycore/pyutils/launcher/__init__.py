# -*- coding: utf-8 -*-
"""
Window Launcher Utility Library
Provides utilities for launching multiple windows in grid layout
"""

import sys
from pathlib import Path

# Add parent directory to path for dependency checking
pytools_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(pytools_dir))

from pycore import check_and_install_dependencies
check_and_install_dependencies()

from pycore.pyutils.launcher.ratio_calculator import RatioCalculator
from pycore.pyutils.launcher.screen_manager import ScreenManager
from pycore.pyutils.launcher.explorer_executor import ExplorerExecutor
from pycore.pyutils.launcher.script_generator import ScriptGenerator
from pycore.pyutils.launcher.wt_launcher import WindowsTerminalLauncher
from pycore.pyutils.launcher.editor_launcher import EditorLauncher
from pycore.pyutils.launcher.config_manager import ConfigManager
from pycore.pyutils.launcher.app_finder import AppFinder
from pycore.pyutils.launcher.menu import InteractiveMenu
from pycore.pyutils.launcher.launcher import WindowLauncher, main

__all__ = [
    'RatioCalculator',
    'ScreenManager',
    'ExplorerExecutor',
    'ScriptGenerator',
    'WindowsTerminalLauncher',
    'EditorLauncher',
    'ConfigManager',
    'AppFinder',
    'InteractiveMenu',
    'WindowLauncher',
    'main',
]

