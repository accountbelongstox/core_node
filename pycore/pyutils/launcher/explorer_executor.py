# -*- coding: utf-8 -*-
"""
Explorer Executor
Executes batch files via explorer to ensure independent processes
"""

from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
import os
import shutil
import platform
from pathlib import Path
import subprocess

_IS_WINDOWS = platform.system() == 'Windows'


def _spawn_detached(argv, cwd=None, shell=False):
    """Launch a fully-detached child that survives the launcher exiting.

    Windows uses DETACHED_PROCESS|CREATE_NEW_PROCESS_GROUP — those flags do NOT
    exist on Linux/macOS and accessing them raises AttributeError; POSIX uses
    start_new_session=True (setsid) for the same detach effect.
    """
    if _IS_WINDOWS:
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        return subprocess.Popen(argv, cwd=cwd, shell=shell,
                                creationflags=flags, close_fds=True)
    return subprocess.Popen(argv, cwd=cwd, start_new_session=True, close_fds=True)


def _open_on_linux(path_str):
    """Open a path on Linux: run it directly if executable, else via xdg-open."""
    if os.path.isfile(path_str) and os.access(path_str, os.X_OK):
        return _spawn_detached([path_str])
    opener = shutil.which('xdg-open') or 'xdg-open'
    return _spawn_detached([opener, path_str])


class ExplorerExecutor:
    """Execute files/apps independently (explorer on Windows, xdg-open/exec on Linux)"""
    
    @staticmethod
    def execute_bat_file(bat_path, independent=True):
        """
        Execute a batch file using explorer
        
        Args:
            bat_path: Path to batch file
            independent: If True, launch as independent process (not child of Python)
        
        Returns:
            subprocess.Popen: Process object
        """
        bat_path = Path(bat_path)
        if not bat_path.exists():
            raise FileNotFoundError(f"Batch file not found: {bat_path}")
        
        # Use explorer to launch the bat file
        # explorer /select,"path" selects the file, but to execute we need a different approach
        # Using start command with explorer or directly calling via shell
        bat_path_str = str(bat_path.resolve())

        if not _IS_WINDOWS:
            # No .bat on Linux: run a shell script directly, else open the target.
            if bat_path_str.endswith(('.sh', '.bash')):
                return _spawn_detached(['bash', bat_path_str])
            return _open_on_linux(bat_path_str)

        if independent:
            # Use explorer with shell execute - this executes the file
            # explorer will use the default handler (cmd for .bat files)
            return subprocess.Popen(
                ['explorer', bat_path_str],
                shell=True,  # Use shell=True so explorer properly executes the file
                creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                close_fds=True
            )
        else:
            return subprocess.Popen(['explorer', bat_path_str], shell=True)
    
    @staticmethod
    def execute_file(file_path, independent=True):
        """
        Execute a file directly using explorer
        
        Args:
            file_path: Path to file (exe, bat, etc.)
        
        Returns:
            subprocess.Popen: Process object
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        file_path_str = str(file_path.resolve())

        if not _IS_WINDOWS:
            # Linux/macOS: run the binary directly (or xdg-open a data file),
            # detached so the launched app outlives the launcher process.
            return _open_on_linux(file_path_str)

        # Use explorer to launch file (independent process)
        return subprocess.Popen(
            ['explorer', file_path_str],
            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
            close_fds=True
        )
    
    @staticmethod
    def execute_bat_file_with_cmd(bat_path, independent=True):
        """
        Execute a batch file using cmd /c
        
        Args:
            bat_path: Path to batch file
            independent: If True, launch as independent process (not child of Python)
        
        Returns:
            subprocess.Popen: Process object
        """
        bat_path = Path(bat_path)
        if not bat_path.exists():
            raise FileNotFoundError(f"Batch file not found: {bat_path}")
        
        bat_path_str = str(bat_path.resolve())

        if not _IS_WINDOWS:
            if bat_path_str.endswith(('.sh', '.bash')):
                return _spawn_detached(['bash', bat_path_str])
            return _open_on_linux(bat_path_str)

        if independent:
            # Use cmd /c to execute bat file as independent process
            return subprocess.Popen(
                ['cmd', '/c', bat_path_str],
                creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                close_fds=True
            )
        else:
            # Execute as child process
            return subprocess.Popen(['cmd', '/c', bat_path_str])
    
    @staticmethod
    def execute_bat_file_with_start(bat_path, independent=True):
        """
        Execute a batch file using start command
        
        Args:
            bat_path: Path to batch file
            independent: If True, launch as independent process (not child of Python)
        
        Returns:
            subprocess.Popen: Process object
        """
        bat_path = Path(bat_path)
        if not bat_path.exists():
            raise FileNotFoundError(f"Batch file not found: {bat_path}")
        
        bat_path_str = str(bat_path.resolve())
        working_dir = str(bat_path.parent.resolve())

        if not _IS_WINDOWS:
            if bat_path_str.endswith(('.sh', '.bash')):
                return _spawn_detached(['bash', bat_path_str], cwd=working_dir)
            return _open_on_linux(bat_path_str)

        if independent:
            # Use start command to execute bat file as independent process
            return subprocess.Popen(
                ['cmd', '/c', 'start', '', bat_path_str],
                cwd=working_dir,
                creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                close_fds=True
            )
        else:
            # Execute as child process
            return subprocess.Popen(['cmd', '/c', 'start', '', bat_path_str], cwd=working_dir)

