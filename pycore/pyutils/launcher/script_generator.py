# -*- coding: utf-8 -*-
"""
Script Generator
Generates temporary batch scripts for launching applications
"""

from pathlib import Path
import os

from pycore.pyfoundations.system_paths import get_system_cache_dir


def format_wt_size(term_cols, term_rows):
    """Format --size per Microsoft Learn: columns,rows (comma-separated character cells)."""
    return f'{term_cols},{term_rows}'


class ScriptGenerator:
    """Generate temporary batch scripts"""
    
    def __init__(self, temp_dir=None):
        """
        Initialize script generator
        
        Args:
            temp_dir: Temporary directory for scripts. If None, uses default location.
        """
        if temp_dir is None:
            # Centralized per-user state dir (D:\programing\Users\<user>\.core_node
            # on Windows, /var/_core_node on Linux) - see system_paths.
            temp_dir = get_system_cache_dir() / 'launch_multiple'

        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
    
    def create_wt_bat(self, index, x, y, term_cols, term_rows):
        """
        Create batch file for Windows Terminal
        
        Args:
            index: Window index (for filename)
            x: Window X position
            y: Window Y position
            term_cols: Terminal columns
            term_rows: Terminal rows
        
        Returns:
            Path: Path to created batch file
        """
        bat_path = self.temp_dir / f'launch_terminal_{index}.bat'
        
        # Format: wt.exe -w -1 --pos "x,y" --size "cols,rows"  (Learn: --size c,r)
        # -w -1 forces a new window so each launch gets its own window (not tab in existing)
        size_arg = format_wt_size(term_cols, term_rows)
        cmd = f'wt.exe -w -1 --pos "{x},{y}" --size "{size_arg}"'
        
        lines = [
            '@echo off',
            # Add small delay to ensure previous window is positioned before launching next
            f'if {index} gtr 1 timeout /t 0 /nobreak >nul',
            cmd
        ]
        
        with open(bat_path, 'w', encoding='utf-8', newline='\r\n') as f:
            f.write('\r\n'.join(lines) + '\r\n')
        
        # Print the command for verification
        print(f"  Command: {cmd}")
        
        return bat_path
    
    def create_editor_bat(self, index, app_name, x, y, width, height, file_path=None):
        """
        Create batch file for editor applications (chrome/vscode/cursor)
        
        Args:
            index: Window index
            app_name: Application name (chrome, vscode, cursor)
            x: Window X position
            y: Window Y position
            width: Window width
            height: Window height
            file_path: Optional file path to open
        
        Returns:
            Path: Path to created batch file
        """
        bat_path = self.temp_dir / f'launch_{app_name}_{index}.bat'
        
        # Determine executable name
        exe_map = {
            'chrome': 'chrome.exe',
            'vscode': 'code.exe',
            'cursor': 'cursor.exe'
        }
        
        exe_name = exe_map.get(app_name.lower(), f'{app_name}.exe')
        
        # Build command
        if file_path:
            cmd = f'start "" "{exe_name}" --new-window --position {x},{y} --size {width}x{height} "{file_path}"'
        else:
            cmd = f'start "" "{exe_name}" --new-window --position {x},{y} --size {width}x{height}'
        
        lines = [
            '@echo off',
            cmd
        ]
        
        with open(bat_path, 'w', encoding='utf-8', newline='\r\n') as f:
            f.write('\r\n'.join(lines) + '\r\n')
        
        return bat_path
    
    def create_ubuntu_bat(self, index, x, y, term_cols, term_rows, ubuntu_shortcut):
        """
        Create batch file for Ubuntu terminal
        
        Args:
            index: Window index (for filename)
            x: Window X position
            y: Window Y position
            term_cols: Terminal columns
            term_rows: Terminal rows
            ubuntu_shortcut: Dictionary with Ubuntu shortcut info (from UbuntuFinder)
        
        Returns:
            Path: Path to created batch file
        """
        bat_path = self.temp_dir / f'launch_ubuntu_{index}.bat'
        
        # Get Ubuntu shortcut target and arguments
        target = ubuntu_shortcut.get('target', '')
        arguments = ubuntu_shortcut.get('arguments', '')
        
        # Build command: Use Windows Terminal to launch Ubuntu with position and size
        # Format: wt.exe -w -1 --pos "x,y" --size "cols,rows" <target> <arguments>
        size_arg = format_wt_size(term_cols, term_rows)
        if target:
            # Combine target and arguments
            if arguments:
                ubuntu_cmd = f'{target} {arguments}'.strip()
            else:
                ubuntu_cmd = target

            # Use Windows Terminal to launch with position and size (-w -1 = new window)
            cmd = f'wt.exe -w -1 --pos "{x},{y}" --size "{size_arg}" {ubuntu_cmd}'
        else:
            # Fallback: try to launch shortcut directly (won't have position/size control)
            shortcut_path = ubuntu_shortcut.get('path', '')
            if shortcut_path:
                cmd = f'start "" "{shortcut_path}"'
            else:
                # Last resort: try wsl.exe
                cmd = f'wt.exe -w -1 --pos "{x},{y}" --size "{size_arg}" wsl.exe'
        
        lines = [
            '@echo off',
            f'if {index} gtr 1 timeout /t 0 /nobreak >nul',
            cmd
        ]
        
        with open(bat_path, 'w', encoding='utf-8', newline='\r\n') as f:
            f.write('\r\n'.join(lines) + '\r\n')
        
        print(f"  Command: {cmd}")
        
        return bat_path
    
    def get_temp_dir(self):
        """Get temporary directory path"""
        return self.temp_dir

