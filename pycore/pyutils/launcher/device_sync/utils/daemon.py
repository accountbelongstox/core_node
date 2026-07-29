# -*- coding: utf-8 -*-
"""
Daemon Mode - Background Process Manager

Detach from console and run in background.

Features:
- Auto-restart with pythonw.exe
- Detach from parent console
- Run as independent process
"""

import sys
import os
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime
from pathlib import Path
import subprocess

import time

import tempfile




def is_console_attached() -> bool:
    """
    Check if running with console window.

    Returns:
        True if console attached (python.exe)
        False if no console (pythonw.exe)
    """
    # Check if sys.stdout is connected to a console
    try:
        # If we can write to stdout without error, console is attached
        sys.stdout.write('')
        sys.stdout.flush()
        return True
    except:
        return False


def is_pythonw() -> bool:
    """
    Check if running with pythonw.exe.

    Returns:
        True if pythonw.exe
    """
    return 'pythonw' in sys.executable.lower()


def restart_as_background() -> bool:
    """
    Restart current process in background mode.

    Windows: Use pythonw.exe
    Linux: Use subprocess with start_new_session=True

    This detaches from console and runs independently.

    Returns:
        True if restarted successfully
    """
    # Get current script arguments
    script_args = sys.argv[1:]  # Skip script name

    if sys.platform == 'win32':
        # Windows: Use pythonw.exe
        if is_pythonw():
            return False  # Already running with pythonw

        # Find pythonw.exe
        python_dir = Path(sys.executable).parent
        pythonw_exe = python_dir / 'pythonw.exe'

        if not pythonw_exe.exists():
            print("[Daemon] Warning: pythonw.exe not found")
            print(f"[Daemon] Looked in: {pythonw_exe}")
            print("[Daemon] Running with console window attached")
            return False

        # Build command
        cmd = [str(pythonw_exe), '-m', 'pycore.pyutils.launcher.device_sync'] + script_args

        print("[Daemon] Restarting in background mode (Windows)...")
        print(f"[Daemon] Command: {' '.join(cmd)}")

        # Start detached process
        try:
            DETACHED_PROCESS = 0x00000008
            CREATE_NEW_PROCESS_GROUP = 0x00000200

            # Create log file for debugging
            log_dir = Path(tempfile.gettempdir()) / 'device_sync'
            log_dir.mkdir(exist_ok=True)
            log_file = log_dir / 'device_sync.log'

            # Set up environment with PYTHONPATH
            env = os.environ.copy()

            # Find project root (4 levels up from this file)
            project_root = Path(__file__).parent.parent.parent.parent.parent
            pythonpath = str(project_root)
            if 'PYTHONPATH' in env:
                pythonpath = f"{pythonpath};{env['PYTHONPATH']}"
            env['PYTHONPATH'] = pythonpath

            print(f"[Daemon] Project root: {project_root}")
            print(f"[Daemon] PYTHONPATH: {pythonpath}")

            log_handle = open(log_file, 'w', encoding='utf-8')

            subprocess.Popen(
                cmd,
                env=env,
                creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
                close_fds=True,
                stdin=subprocess.DEVNULL,
                stdout=log_handle,
                stderr=log_handle
            )

            print("[Daemon] Background process started")
            print("[Daemon] This console will now exit")
            print("[Daemon] Check system tray for Device Sync icon")
            print(f"[Daemon] Log file: {log_file}")

            return True

        except Exception as e:
            print(f"[Daemon] Failed to start background process: {e}")
            return False

    else:
        # Linux/Unix: Use subprocess with start_new_session
        cmd = [sys.executable, '-m', 'pycore.pyutils.launcher.device_sync'] + script_args

        print("[Daemon] Restarting in background mode (Linux)...")
        print(f"[Daemon] Command: {' '.join(cmd)}")

        try:
            # Set up environment with PYTHONPATH
            env = os.environ.copy()

            # Find project root (4 levels up from this file)
            project_root = Path(__file__).parent.parent.parent.parent.parent
            pythonpath = str(project_root)
            if 'PYTHONPATH' in env:
                pythonpath = f"{pythonpath}:{env['PYTHONPATH']}"  # Linux uses : separator
            env['PYTHONPATH'] = pythonpath

            print(f"[Daemon] Project root: {project_root}")
            print(f"[Daemon] PYTHONPATH: {pythonpath}")

            # Start detached process (new session)
            subprocess.Popen(
                cmd,
                env=env,
                start_new_session=True,
                close_fds=True,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )

            print("[Daemon] Background process started")
            print("[Daemon] This console will now exit")
            print("[Daemon] Process is running in background")

            return True

        except Exception as e:
            print(f"[Daemon] Failed to start background process: {e}")
            return False


def ensure_background_mode(force: bool = False) -> bool:
    """
    Ensure running in background mode (no console).

    If running with console (python.exe), automatically restart
    with pythonw.exe unless disabled.

    Args:
        force: Force restart even if console detected

    Returns:
        True if restarted (caller should exit)
        False if already in background mode or restart failed
    """
    # Check if already running in background
    if is_pythonw():
        return False

    # Check if console is attached
    if is_console_attached() or force:
        # Try to restart as background
        if restart_as_background():
            # Restart successful - caller should exit
            return True

    return False


def run_in_background(target_func, *args, **kwargs):
    """
    Run function in background mode.

    This ensures the function runs detached from console.

    Args:
        target_func: Function to run
        *args: Positional arguments
        **kwargs: Keyword arguments
    """
    # Check if we need to restart
    if ensure_background_mode():
        # We restarted - exit this process
        sys.exit(0)

    # We're in background mode - run the function
    target_func(*args, **kwargs)


# Environment variable to disable auto-background (for debugging)
DISABLE_AUTO_BACKGROUND = os.environ.get('DEVICE_SYNC_NO_BACKGROUND', '0') == '1'


def auto_background_wrapper(main_func):
    """
    Decorator to automatically run function in background mode.

    Usage:
        @auto_background_wrapper
        def main():
            # Your code here
            pass

        if __name__ == '__main__':
            main()
    """
    def wrapper(*args, **kwargs):
        # Skip if disabled via environment variable
        if DISABLE_AUTO_BACKGROUND:
            return main_func(*args, **kwargs)

        # Check if we need to restart
        if ensure_background_mode():
            # We restarted - exit this process
            time.sleep(1)  # Give user time to see message
            sys.exit(0)

        # We're in background mode - run the function
        return main_func(*args, **kwargs)

    return wrapper
