#!/usr/bin/env python3
"""
Commander Utility - Python Version
Converted from D:\\programing\\core_node\\ncore\\foundation\\common\\commander.js
Handles command execution across different platforms
"""

import os
import sys
import subprocess
import platform
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Union, Any

class Commander:
    """Cross-platform command execution utility"""

    def __init__(self):
        self.platform = platform.system().lower()
        self.initial_cwd = os.getcwd()

    def is_windows(self) -> bool:
        """Check if running on Windows"""
        return self.platform == 'windows'

    def is_linux(self) -> bool:
        """Check if running on Linux"""
        return self.platform == 'linux'

    def is_mac(self) -> bool:
        """Check if running on macOS"""
        return self.platform == 'darwin'

    def get_platform_shell(self) -> Dict[str, Union[str, List[str]]]:
        """Get platform-specific shell configuration"""
        if self.is_windows():
            return {
                'shell': True,
                'command': 'cmd.exe',
                'args': ['/c']
            }
        else:
            shell = os.environ.get('SHELL', '/bin/sh')
            return {
                'shell': shell,
                'command': shell,
                'args': ['-c']
            }

    def exec_cmd(self, command: Union[str, List[str]],
                 show_output: bool = True,
                 cwd: Optional[str] = None,
                 timeout: int = 30) -> Dict[str, Any]:
        """Execute command and return result"""

        if isinstance(command, list):
            command = ' '.join(command)

        if show_output:
            print(f"[COMMAND] {command}")

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout,
                encoding='utf-8',
                errors='ignore'
            )

            success = result.returncode == 0
            stdout = result.stdout.strip()
            stderr = result.stderr.strip()

            if show_output:
                if stdout:
                    print(f"[OUTPUT] {stdout}")
                if stderr:
                    print(f"[ERROR] {stderr}")

            return {
                'success': success,
                'stdout': stdout,
                'stderr': stderr,
                'returncode': result.returncode
            }

        except subprocess.TimeoutExpired:
            error_msg = f"Command timed out after {timeout} seconds"
            if show_output:
                print(f"[TIMEOUT] {error_msg}")
            return {
                'success': False,
                'stdout': '',
                'stderr': error_msg,
                'returncode': -1
            }
        except Exception as e:
            error_msg = str(e)
            if show_output:
                print(f"[EXCEPTION] {error_msg}")
            return {
                'success': False,
                'stdout': '',
                'stderr': error_msg,
                'returncode': -1
            }

    def open_explorer(self, path: Union[str, Path]) -> bool:
        """Open file explorer at specified path"""
        path = str(Path(path).resolve())

        if not os.path.exists(path):
            print(f"[EXPLORER-ERROR] Path does not exist: {path}")
            return False

        try:
            if self.is_windows():
                # Use Windows Explorer
                result = self.exec_cmd(f'explorer "{path}"', show_output=False)
                return result['success']
            elif self.is_mac():
                # Use macOS Finder
                result = self.exec_cmd(f'open "{path}"', show_output=False)
                return result['success']
            else:
                # Use Linux file manager
                # Try common file managers in order
                file_managers = ['nautilus', 'dolphin', 'thunar', 'pcmanfm', 'nemo']
                for fm in file_managers:
                    if shutil.which(fm):
                        result = self.exec_cmd(f'{fm} "{path}" &', show_output=False)
                        return result['success']

                # Fallback to xdg-open
                if shutil.which('xdg-open'):
                    result = self.exec_cmd(f'xdg-open "{path}"', show_output=False)
                    return result['success']

                print("[EXPLORER-ERROR] No supported file manager found")
                return False

        except Exception as e:
            print(f"[EXPLORER-ERROR] Failed to open explorer: {e}")
            return False

    def remove_directory(self, path: Union[str, Path], force: bool = False) -> bool:
        """Remove directory recursively"""
        path = Path(path)

        if not path.exists():
            print(f"[REMOVE-WARNING] Directory does not exist: {path}")
            return True

        if not path.is_dir():
            print(f"[REMOVE-ERROR] Path is not a directory: {path}")
            return False

        try:
            if force:
                # Force remove with system command
                if self.is_windows():
                    result = self.exec_cmd(f'rmdir /s /q "{path}"', show_output=False)
                    return result['success']
                else:
                    result = self.exec_cmd(f'rm -rf "{path}"', show_output=False)
                    return result['success']
            else:
                # Use Python's shutil (safer)
                shutil.rmtree(path)
                print(f"[REMOVE-SUCCESS] Removed directory: {path}")
                return True

        except PermissionError:
            print(f"[REMOVE-ERROR] Permission denied: {path}")
            return False
        except OSError as e:
            print(f"[REMOVE-ERROR] Failed to remove {path}: {e}")
            return False
        except Exception as e:
            print(f"[REMOVE-ERROR] Unexpected error removing {path}: {e}")
            return False

    def exec_detached(self, command: Union[str, List[str]], cwd: Optional[str] = None) -> bool:
        """Execute command in detached mode (background)"""
        if isinstance(command, list):
            command = ' '.join(command)

        try:
            if self.is_windows():
                # Use START command to run detached
                result = subprocess.Popen(
                    f'start /b {command}',
                    shell=True,
                    cwd=cwd,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            else:
                # Use nohup to run detached
                result = subprocess.Popen(
                    f'nohup {command} > /dev/null 2>&1 &',
                    shell=True,
                    cwd=cwd,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

            print(f"[DETACHED] Process started with PID: {result.pid}")
            return True

        except Exception as e:
            print(f"[DETACHED-ERROR] Failed to start detached process: {e}")
            return False

    def find_executable(self, name: str) -> Optional[str]:
        """Find executable in PATH"""
        return shutil.which(name)

    def get_directory_size(self, path: Union[str, Path]) -> int:
        """Get directory size in bytes"""
        path = Path(path)
        total_size = 0

        try:
            for item in path.rglob('*'):
                if item.is_file():
                    total_size += item.stat().st_size
        except (OSError, PermissionError):
            pass

        return total_size

    def format_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"

# Global instance for easy access
commander = Commander()