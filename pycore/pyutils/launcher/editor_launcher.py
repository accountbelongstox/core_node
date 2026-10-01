# -*- coding: utf-8 -*-
"""
Editor Launcher
Handles launching Chrome/VSCode/Antigravity windows
"""

import shutil
import sys
import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.app_search import find_linux_app
from pycore.pyutils.launcher.explorer_executor import ExplorerExecutor, spawn_detached_posix
from pycore.pyutils.launcher.script_generator import ScriptGenerator


class EditorLauncher:
    """Launch editor applications (Chrome, VSCode, Antigravity) windows"""

    def __init__(self, script_generator=None, executor=None):
        """
        Initialize editor launcher
        
        Args:
            script_generator: ScriptGenerator instance (creates if None)
            executor: ExplorerExecutor instance (creates if None)
        """
        self.script_generator = script_generator or ScriptGenerator()
        self.executor = executor or ExplorerExecutor()
    
    def launch_chrome(self, windows_config, delay=0.2):
        """
        Launch Chrome windows
        
        Args:
            windows_config: List of tuples (x, y, width, height, file_path=None)
            delay: Delay between launches in seconds
        
        Returns:
            list: List of created batch file paths
        """
        return self._launch_editor('chrome', windows_config, delay)
    
    def launch_vscode(self, windows_config, delay=0.2):
        """
        Launch VSCode windows
        
        Args:
            windows_config: List of tuples (x, y, width, height, file_path=None)
            delay: Delay between launches in seconds
        
        Returns:
            list: List of created batch file paths
        """
        return self._launch_editor('vscode', windows_config, delay)
    
    def launch_antigravity(self, windows_config, delay=0.2):
        """
        Launch Antigravity windows

        Args:
            windows_config: List of tuples (x, y, width, height, file_path=None)
            delay: Delay between launches in seconds

        Returns:
            list: List of created batch file paths
        """
        return self._launch_editor('antigravity', windows_config, delay)
    
    def _launch_editor(self, app_name, windows_config, delay):
        """Internal method to launch editor windows"""
        if sys.platform != 'win32':
            return self._launch_editor_linux(app_name, windows_config, delay)

        bat_files = []
        
        for i, config in enumerate(windows_config, 1):
            if len(config) == 4:
                x, y, width, height = config
                file_path = None
            elif len(config) == 5:
                x, y, width, height, file_path = config
            else:
                raise ValueError(f"Invalid config: expected 4 or 5 elements, got {len(config)}")
            
            bat_path = self.script_generator.create_editor_bat(
                i, app_name, x, y, width, height, file_path
            )
            bat_files.append(bat_path)
            
            ColorPrint.plain(f"Created batch file for {app_name} {i}: {bat_path}")
        
        # Launch windows
        for i, bat_path in enumerate(bat_files, 1):
            ColorPrint.plain(f"Launching {app_name} window {i}...")
            self.executor.execute_bat_file(bat_path, independent=True)
            time.sleep(delay)

        return bat_files

    def _launch_editor_linux(self, app_name, windows_config, delay):
        """Launch editor windows on Linux via the PATH binary (no .bat / explorer).

        Debian/Ubuntu/Kali ship code/antigravity/chrome on PATH; we open one --new-window
        per grid cell (window positioning is left to the WM, same as the terminal grid).
        """
        binary = find_linux_app(app_name) or shutil.which(app_name)
        if not binary:
            ColorPrint.plain(f"  {app_name}: no binary found on PATH (Linux) -- skipping")
            return []

        launched = []
        for i, config in enumerate(windows_config, 1):
            file_path = config[4] if len(config) >= 5 else None
            argv = [binary, '--new-window']
            if file_path:
                argv.append(str(file_path))
            ColorPrint.plain(f"Launching {app_name} window {i} ({binary})...")
            if spawn_detached_posix(argv) is None:
                ColorPrint.yellow(f"  Failed to launch {app_name}: {' '.join(argv)}")
            launched.append(binary)
            time.sleep(delay)
        return launched

