# -*- coding: utf-8 -*-
"""
Editor Launcher
Handles launching Chrome/VSCode/Antigravity windows
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.script_generator import ScriptGenerator
from pycore.pyutils.launcher.explorer_executor import ExplorerExecutor
import sys
import time
import shutil
import subprocess


class EditorLauncher:
    """Launch editor applications (Chrome, VSCode, Antigravity) windows"""

    # Linux PATH binaries per app (Debian/Ubuntu/Kali). First found on PATH wins.
    _LINUX_BINARIES = {
        'chrome': ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'],
        'vscode': ['code', 'code-insiders'],
        'antigravity': ['antigravity'],
    }
    
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
        binary = None
        for name in self._LINUX_BINARIES.get(app_name, [app_name]):
            binary = shutil.which(name)
            if binary:
                break
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
            try:
                subprocess.Popen(argv, start_new_session=True, close_fds=True)
            except Exception as e:
                ColorPrint.plain(f"  Failed to launch {app_name}: {e}")
            launched.append(binary)
            time.sleep(delay)
        return launched

