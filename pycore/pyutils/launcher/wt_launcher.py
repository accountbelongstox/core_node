# -*- coding: utf-8 -*-
"""
Windows Terminal Launcher
Handles launching Windows Terminal windows and Ubuntu terminals
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.script_generator import ScriptGenerator, format_wt_size
from pycore.pyutils.launcher.explorer_executor import ExplorerExecutor
from pycore.pyutils.launcher.ubuntu_finder import UbuntuFinder
import time


class WindowsTerminalLauncher:
    """Launch Windows Terminal windows and Ubuntu terminals with specified layout"""
    
    def __init__(self, script_generator=None, executor=None):
        """
        Initialize Windows Terminal launcher
        
        Args:
            script_generator: ScriptGenerator instance (creates if None)
            executor: ExplorerExecutor instance (creates if None)
        """
        self.script_generator = script_generator or ScriptGenerator()
        self.executor = executor or ExplorerExecutor()
        self.ubuntu_finder = UbuntuFinder()
    
    def launch_windows(self, windows_config, delay=0.2, ubuntu_count=0):
        """
        Launch multiple Windows Terminal windows
        
        Args:
            windows_config: List of tuples (x, y, term_cols, term_rows)
            delay: Delay between launches in seconds
            ubuntu_count: Number of Ubuntu terminals to launch (0 = no Ubuntu)
        
        Returns:
            list: List of created batch file paths
        """
        bat_files = []
        
        # Separate Windows Terminal and Ubuntu windows
        wt_windows = windows_config[:-ubuntu_count] if ubuntu_count > 0 else windows_config
        ubuntu_windows = windows_config[-ubuntu_count:] if ubuntu_count > 0 else []
        
        ColorPrint.plain("\nCreating batch files:")
        # One .bat per window: launch_terminal_1.bat .. launch_terminal_N.bat (each runs wt.exe -w -1 --pos ... --size ...)
        for i, (x, y, term_cols, term_rows) in enumerate(wt_windows, 1):
            bat_path = self.script_generator.create_wt_bat(i, x, y, term_cols, term_rows)
            bat_files.append(bat_path)
            ColorPrint.plain(f"  Windows Terminal {i}: {bat_path}")
        ColorPrint.plain(f"  -> Created {len(wt_windows)} batch files (one per window).")
        
        # Create Ubuntu batch files
        ubuntu_shortcut = self.ubuntu_finder.get_first_ubuntu_shortcut()
        if ubuntu_shortcut and ubuntu_count > 0:
            for i, (x, y, term_cols, term_rows) in enumerate(ubuntu_windows, 1):
                ubuntu_index = len(wt_windows) + i
                bat_path = self.script_generator.create_ubuntu_bat(
                    ubuntu_index, x, y, term_cols, term_rows, ubuntu_shortcut
                )
                bat_files.append(bat_path)
                ColorPrint.plain(f"  Ubuntu Terminal {i}: {bat_path}")
        elif ubuntu_count > 0:
            ColorPrint.plain(f"  Warning: No Ubuntu shortcut found, skipping {ubuntu_count} Ubuntu terminals")
        
        # Launch windows
        ColorPrint.plain("\nLaunching windows:")
        
        # Launch Windows Terminal windows
        for i, bat_path in enumerate(bat_files[:len(wt_windows)], 1):
            x, y, term_cols, term_rows = wt_windows[i-1]
            size_arg = format_wt_size(term_cols, term_rows)
            cmd = f'wt.exe -w -1 --pos "{x},{y}" --size "{size_arg}"'
            ColorPrint.plain(f"  Windows Terminal {i}: {cmd}")
            self.executor.execute_bat_file_with_cmd(bat_path, independent=True)
            time.sleep(delay)
        
        # Launch Ubuntu terminals
        if ubuntu_shortcut and ubuntu_count > 0:
            for i, bat_path in enumerate(bat_files[len(wt_windows):], 1):
                x, y, term_cols, term_rows = ubuntu_windows[i-1]
                ColorPrint.plain(f"  Ubuntu Terminal {i}: {bat_path}")
                self.executor.execute_bat_file_with_cmd(bat_path, independent=True)
                time.sleep(delay)
        
        return bat_files

