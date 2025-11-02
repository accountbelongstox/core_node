# -*- coding: utf-8 -*-
"""
Windows Terminal Launcher
Handles launching Windows Terminal windows
"""

from pycore.pyutils.launcher.script_generator import ScriptGenerator
from pycore.pyutils.launcher.explorer_executor import ExplorerExecutor
import time


class WindowsTerminalLauncher:
    """Launch Windows Terminal windows with specified layout"""
    
    def __init__(self, script_generator=None, executor=None):
        """
        Initialize Windows Terminal launcher
        
        Args:
            script_generator: ScriptGenerator instance (creates if None)
            executor: ExplorerExecutor instance (creates if None)
        """
        self.script_generator = script_generator or ScriptGenerator()
        self.executor = executor or ExplorerExecutor()
    
    def launch_windows(self, windows_config, delay=0.2):
        """
        Launch multiple Windows Terminal windows
        
        Args:
            windows_config: List of tuples (x, y, term_cols, term_rows)
            delay: Delay between launches in seconds
        
        Returns:
            list: List of created batch file paths
        """
        bat_files = []
        
        print("\nCreating batch files:")
        for i, (x, y, term_cols, term_rows) in enumerate(windows_config, 1):
            bat_path = self.script_generator.create_wt_bat(i, x, y, term_cols, term_rows)
            bat_files.append(bat_path)
            
            print(f"  Terminal {i}: {bat_path}")
        
        # Launch windows
        print("\nLaunching windows:")
        for i, bat_path in enumerate(bat_files, 1):
            x, y, term_cols, term_rows = windows_config[i-1]
            cmd = f'wt.exe --pos "{x},{y}" --size "{term_cols}.{term_rows}"'
            print(f"  Window {i}: {cmd}")
            self.executor.execute_bat_file_with_cmd(bat_path, independent=True)
            time.sleep(delay)
        
        return bat_files

