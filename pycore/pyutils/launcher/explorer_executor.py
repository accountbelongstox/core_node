# -*- coding: utf-8 -*-
"""
Explorer Executor
Executes batch files via explorer to ensure independent processes
"""

from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime
import os
import shlex
import shutil
import platform
from pathlib import Path
import subprocess

import ctypes

from pycore.pyutils.launcher.linux_desktop_user import (
    desktop_user,
    desktop_user_argv,
    desktop_user_env,
    gui_child_env,
    terminal_child_env,
)
from pycore.pyutils.launcher.linux_terminal_argv import LinuxTerminalArgv


_IS_WINDOWS = platform.system() == 'Windows'
_XDG_OPEN = 'xdg-open'
_WINDOWS_TERMINAL = 'wt'
_WINDOWS_SHELL = 'cmd.exe'
# Terminal windows keep an interactive shell after the command exits so its
# last output (errors included) stays readable.
_LINUX_TERMINAL_INNER = "printf '\\033]0;%s\\007' {title}; cd -- {cwd}; {command}; exec bash -i"
_WINDOWS_START_TEMPLATE = 'cmd.exe /c start "{title}" /D "{cwd}" cmd.exe /k "{command}"'


def _spawn_detached(argv, cwd=None, shell=False, env=None):
    """Launch a fully-detached child that survives the launcher exiting.

    Windows uses DETACHED_PROCESS|CREATE_NEW_PROCESS_GROUP — those flags do NOT
    exist on Linux/macOS and accessing them raises AttributeError; POSIX uses
    start_new_session=True (setsid) for the same detach effect.
    """
    if _IS_WINDOWS:
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        return subprocess.Popen(argv, cwd=cwd, shell=shell, env=env,
                                creationflags=flags, close_fds=True)
    # Detached GUI apps must not inherit the launcher's stdio: Electron/GTK noise
    # would pollute the launcher console and keep its pty/pipe open long after
    # the launcher exits. The env drops the launcher's private session bus and
    # systemd service markers (see linux_desktop_user).
    return subprocess.Popen(argv, cwd=cwd, env=gui_child_env() if env is None else env,
                            start_new_session=True, close_fds=True,
                            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL)


def _open_on_linux(path_str, as_desktop_user=False):
    """Open a path on Linux: run it directly if executable, else via xdg-open.

    as_desktop_user re-dispatches the child to the pkexec/sudo caller when the
    launcher runs as root (browsers refuse root; GUI apps belong in the
    user's own session).
    """
    if os.path.isfile(path_str) and os.access(path_str, os.X_OK):
        argv = [path_str]
    else:
        argv = [shutil.which(_XDG_OPEN) or _XDG_OPEN, path_str]
    user = desktop_user() if as_desktop_user else None
    if user is not None:
        user_argv = desktop_user_argv(user, argv)
        if user_argv:
            return _spawn_detached(user_argv, cwd=user.working_dir, env=desktop_user_env(user))
    return _spawn_detached(argv)


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
    def execute_file(file_path, independent=True, as_desktop_user=False):
        """
        Execute a file directly using explorer

        Args:
            file_path: Path to file (exe, bat, etc.)
            as_desktop_user: Linux only - run as the pkexec/sudo caller when
                the launcher runs as root (ignored on Windows).

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
            return _open_on_linux(file_path_str, as_desktop_user=as_desktop_user)

        # Use explorer to launch file (independent process)
        return subprocess.Popen(
            ['explorer', file_path_str],
            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
            close_fds=True
        )

    @staticmethod
    def execute_in_terminal(command_path, cwd, title):
        """
        Run a CLI in a NEW terminal window that outlives the launcher.

        Linux: the grid's emulator argv (dbus-run-session wrapped for a root
        xfce4-terminal) with the detached terminal env. Windows: a new Windows
        Terminal window, else a classic console via ``start``.

        Returns:
            subprocess.Popen, or None when no terminal emulator exists (Linux).
        """
        # Resolve symlinks like execute_file: pnpm shims locate their package
        # relative to their own directory, so /usr/local/bin/codex -> the
        # pnpm-global shim only works when invoked by its real path.
        command_str = str(Path(command_path).resolve())
        cwd_str = str(cwd)
        if not _IS_WINDOWS:
            terminal_argv = LinuxTerminalArgv()
            # Single-process emulators first: gnome-terminal hands the window to
            # its already-running server, which ignores this child's env and uid.
            emulator = (terminal_argv._find_wayland_x11_emulator()
                        or terminal_argv._find_fallback_emulator_or_none())
            if emulator is None:
                return None
            inner = _LINUX_TERMINAL_INNER.format(
                title=shlex.quote(title), cwd=shlex.quote(cwd_str),
                command=shlex.quote(command_str))
            argv = terminal_argv._build_titled_argv(emulator, inner)
            return _spawn_detached(argv, cwd=cwd_str, env=terminal_child_env())

        windows_terminal = shutil.which(_WINDOWS_TERMINAL)
        if windows_terminal:
            return _spawn_detached(
                [windows_terminal, '-w', '-1', 'new-tab', '--title', title,
                 '-d', cwd_str, _WINDOWS_SHELL, '/k', command_str],
                cwd=cwd_str)
        return _spawn_detached(
            _WINDOWS_START_TEMPLATE.format(title=title, cwd=cwd_str, command=command_str),
            cwd=cwd_str)

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

    @staticmethod
    def execute_as_admin(file_path):
        """
        Launch an executable with administrator elevation (Windows only).

        Uses ShellExecuteW with the ``runas`` verb so Windows shows the UAC prompt.
        On Linux/macOS, falls back to a normal detached launch.

        Args:
            file_path: Path to executable

        Returns:
            int: ShellExecute return value (>32 on success), or Popen on Linux
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        file_path_str = str(file_path.resolve())

        if not _IS_WINDOWS:
            return _open_on_linux(file_path_str)

        ret = ctypes.windll.shell32.ShellExecuteW(
            None, "runas", file_path_str, None, None, 1)
        if ret <= 32:
            raise RuntimeError(
                f"Failed to launch as administrator (ShellExecute code {ret}): {file_path_str}")
        return ret

