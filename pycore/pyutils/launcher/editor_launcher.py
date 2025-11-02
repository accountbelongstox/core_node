# -*- coding: utf-8 -*-
"""
Editor Launcher
Handles launching Chrome/VSCode/Cursor windows
"""

from pycore.pyutils.launcher.script_generator import ScriptGenerator
from pycore.pyutils.launcher.explorer_executor import ExplorerExecutor
import time


class EditorLauncher:
    """Launch editor applications (Chrome, VSCode, Cursor) windows"""
    
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
    
    def launch_cursor(self, windows_config, delay=0.2):
        """
        Launch Cursor windows
        
        Args:
            windows_config: List of tuples (x, y, width, height, file_path=None)
            delay: Delay between launches in seconds
        
        Returns:
            list: List of created batch file paths
        """
        return self._launch_editor('cursor', windows_config, delay)
    
    def _launch_editor(self, app_name, windows_config, delay):
        """Internal method to launch editor windows"""
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
            
            print(f"Created batch file for {app_name} {i}: {bat_path}")
        
        # Launch windows
        for i, bat_path in enumerate(bat_files, 1):
            print(f"Launching {app_name} window {i}...")
            self.executor.execute_bat_file(bat_path, independent=True)
            time.sleep(delay)
        
        return bat_files

