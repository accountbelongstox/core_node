#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simplified Nuxt App Launcher (Python Version)

Equivalent to start.ps1 core logic for launching a single app
Usage: python start_simple.py <appname> [port]

Example:
    python start_simple.py pymatrix 3007
"""

import os
import sys
import subprocess
import tempfile
from pathlib import Path


# ============================================================
# Configuration
# ============================================================
SCRIPT_DIR = Path(__file__).parent
APP_DIR = SCRIPT_DIR.parent
SWITCH_APP_SCRIPT = SCRIPT_DIR / "switch-app.js"


def log(message: str, color: str = 'reset'):
    """Print colored log message"""
    colors = {
        'reset': '\033[0m',
        'green': '\033[32m',
        'yellow': '\033[33m',
        'red': '\033[31m',
        'cyan': '\033[36m',
        'blue': '\033[34m',
    }
    color_code = colors.get(color, colors['reset'])
    print(f"{color_code}{message}{colors['reset']}")


def run_command(cmd: list, description: str, cwd: Path, env: dict = None) -> bool:
    """
    Run command and return success status

    Args:
        cmd: Command as list
        description: Description for logging
        cwd: Working directory
        env: Environment variables

    Returns:
        True if successful, False otherwise
    """
    log(f"[Command] {description}", 'yellow')
    log(f"[Command] Executing: {' '.join(cmd)}", 'cyan')
    log('')

    try:
        # Use current env + custom env
        command_env = os.environ.copy()
        if env:
            command_env.update(env)

        subprocess.run(
            cmd,
            cwd=str(cwd),
            env=command_env,
            check=True,
            # Show output in real-time
            stdout=sys.stdout,
            stderr=sys.stderr
        )

        log('')
        log(f"[Command] ✓ {description} completed successfully", 'green')
        log('')
        return True

    except subprocess.CalledProcessError as e:
        log('')
        log(f"[Command] ✗ {description} failed", 'red')
        log(f"[Command] Exit code: {e.returncode}", 'red')
        return False
    except Exception as e:
        log('')
        log(f"[Command] ✗ {description} failed: {e}", 'red')
        return False


def start_nuxt_app(app_name: str, port: int):
    """
    Start Nuxt app with factory sync

    Args:
        app_name: App namespace (e.g., 'pymatrix')
        port: Port number (e.g., 3007)
    """
    log('')
    log('=' * 70, 'cyan')
    log('[Nuxt Launcher] Simplified Launcher Starting...', 'cyan')
    log('=' * 70, 'cyan')
    log(f'[Config] App Name: {app_name}', 'blue')
    log(f'[Config] Port: {port}', 'blue')
    log(f'[Config] Script Dir: {SCRIPT_DIR}', 'blue')
    log(f'[Config] App Dir: {APP_DIR}', 'blue')
    log('=' * 70, 'cyan')
    log('')

    # ============================================================
    # Step 1: Change to app directory
    # ============================================================
    log('[Step 1] Changing to app directory...', 'yellow')
    os.chdir(APP_DIR)
    log(f'[Step 1] ✓ Working directory: {os.getcwd()}', 'green')
    log('')

    # ============================================================
    # Step 2: Set environment variables
    # ============================================================
    log('[Step 2] Setting environment variables...', 'yellow')
    env_vars = {
        'NUXT_HOST': '0.0.0.0',
        'NUXT_PORT': str(port),
        'APP_ENTRY': app_name
    }

    for key, value in env_vars.items():
        os.environ[key] = value
        log(f'[Step 2] ✓ {key} = {value}', 'green')
    log('')

    # ============================================================
    # Step 3: Switch pages directory
    # ============================================================
    log('=' * 70, 'cyan')
    log('[Step 3] Switching pages directory...', 'cyan')
    log('=' * 70, 'cyan')

    success = run_command(
        cmd=['node', str(SWITCH_APP_SCRIPT), app_name],
        description=f'Switch pages directory to {app_name}',
        cwd=APP_DIR,
        env=env_vars
    )

    if not success:
        log('[Step 3] ✗ Failed to switch pages directory', 'red')
        sys.exit(1)

    # ============================================================
    # Step 4: Start factory sync + dev server
    # ============================================================
    log('=' * 70, 'cyan')
    log('[Step 4] Starting factory sync and dev server...', 'cyan')
    log('=' * 70, 'cyan')
    log(f'[Step 4] URL: http://localhost:{port}', 'green')
    log('=' * 70, 'cyan')
    log('')

    success = run_command(
        cmd=['node', str(SWITCH_APP_SCRIPT), app_name, '--mode', 'dev'],
        description=f'Start {app_name} in dev mode',
        cwd=APP_DIR,
        env=env_vars
    )

    if not success:
        log('[Step 4] ✗ Failed to start dev server', 'red')
        sys.exit(1)


def start_nuxt_app_background(app_name: str, port: int):
    """
    Start Nuxt app in background (for use with Matrix/subprocess)

    Args:
        app_name: App namespace (e.g., 'pymatrix')
        port: Port number (e.g., 3007)

    Returns:
        subprocess.Popen instance
    """
    log('')
    log('=' * 70, 'cyan')
    log('[Nuxt Launcher] Background Mode Starting...', 'cyan')
    log('=' * 70, 'cyan')
    log(f'[Config] App Name: {app_name}', 'blue')
    log(f'[Config] Port: {port}', 'blue')
    log('=' * 70, 'cyan')
    log('')

    # Change to app directory
    os.chdir(APP_DIR)

    # Set environment variables
    env_vars = os.environ.copy()
    env_vars.update({
        'NUXT_HOST': '0.0.0.0',
        'NUXT_PORT': str(port),
        'APP_ENTRY': app_name
    })

    # Step 1: Switch pages directory (synchronous)
    log('[Step 1] Switching pages directory...', 'yellow')
    try:
        subprocess.run(
            ['node', str(SWITCH_APP_SCRIPT), app_name],
            cwd=str(APP_DIR),
            env=env_vars,
            check=True,
            capture_output=True,
            text=True
        )
        log('[Step 1] ✓ Pages directory switched', 'green')
    except subprocess.CalledProcessError as e:
        log('[Step 1] ✗ Failed to switch pages directory', 'red')
        log(f'[Error] {e.stderr}', 'red')
        raise

    # Step 2: Start factory sync + dev server (background)
    log('[Step 2] Starting factory sync in background...', 'yellow')
    log(f'[Step 2] URL: http://localhost:{port}', 'green')

    import platform
    if platform.system() == 'Windows':
        # Windows: Launch in new console window
        fd, temp_script_path = tempfile.mkstemp(suffix='.bat', text=True)
        temp_script = Path(temp_script_path)

        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write('@echo off\n')
            f.write(f'title Nuxt Dev Server - {app_name}\n')
            f.write(f'cd /d "{APP_DIR}"\n')
            f.write(f'set NUXT_PORT={port}\n')
            f.write(f'set NUXT_HOST=0.0.0.0\n')
            f.write(f'set APP_ENTRY={app_name}\n')
            f.write(f'node "{SWITCH_APP_SCRIPT}" {app_name} --mode dev\n')
            f.write('echo.\n')
            f.write('echo Process ended. Press any key to close...\n')
            f.write('pause > nul\n')

        # Launch in new console
        import subprocess
        process = subprocess.Popen(
            str(temp_script),
            creationflags=subprocess.CREATE_NEW_CONSOLE,
            shell=True
        )

        log('[Step 2] ✓ Dev server launched in new console', 'green')
        return process

    else:
        # Linux/Mac: Launch in background
        process = subprocess.Popen(
            ['node', str(SWITCH_APP_SCRIPT), app_name, '--mode', 'dev'],
            cwd=str(APP_DIR),
            env=env_vars,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        log('[Step 2] ✓ Dev server launched in background', 'green')
        return process


def main():
    """Main entry point"""
    # Parse arguments
    if len(sys.argv) < 2:
        print('[ERROR] Usage: python start_simple.py <appname> [port]')
        print('[ERROR] Example: python start_simple.py pymatrix 3007')
        sys.exit(1)

    app_name = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 3000

    # Validate script exists
    if not SWITCH_APP_SCRIPT.exists():
        log(f'[ERROR] switch-app.js not found: {SWITCH_APP_SCRIPT}', 'red')
        sys.exit(1)

    # Start app
    start_nuxt_app(app_name, port)


if __name__ == '__main__':
    main()
