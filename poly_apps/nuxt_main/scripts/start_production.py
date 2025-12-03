#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nuxt Production Mode Launcher

Supports building and running Nuxt apps in production mode with caching

Usage:
    python start_production.py <appname> [port] [--rebuild]

Options:
    --rebuild   Force rebuild even if .output exists
    --skip-build  Skip build and use existing .output (faster for testing)

Examples:
    python start_production.py pymatrix 38007
    python start_production.py pymatrix 38007 --rebuild
    python start_production.py pymatrix 38007 --skip-build
"""

import os
import sys
import subprocess
import platform
from pathlib import Path
from typing import Optional


# ============================================================
# Configuration
# ============================================================
SCRIPT_DIR = Path(__file__).parent
APP_DIR = SCRIPT_DIR.parent
SWITCH_APP_SCRIPT = SCRIPT_DIR / "switch-app.js"

# Factory build directory (Windows/Linux compatible)
def get_factory_root():
    """Get factory root directory based on platform"""
    if platform.system() == 'Windows':
        base_dir = Path('D:/programing')
    else:
        base_dir = Path('/www')
        if not base_dir.exists():
            base_dir = Path('/mnt/d/programing')

    factory_root = base_dir / '.build_dir' / 'nuxt_factory'
    return factory_root


def get_factory_app_dir(app_name: str):
    """Get factory directory for specific app"""
    factory_root = get_factory_root()

    if platform.system() == 'Windows':
        app_dir = factory_root / f'_app_{app_name}'
    else:
        app_dir = factory_root / 'linux' / f'_app_{app_name}'

    return app_dir


# ============================================================
# Logging
# ============================================================
class Colors:
    RESET = '\033[0m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    CYAN = '\033[36m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'


def log(message: str, color: str = 'RESET'):
    """Print colored log message"""
    color_code = getattr(Colors, color.upper(), Colors.RESET)
    print(f"{color_code}{message}{Colors.RESET}")


def separator(char='=', width=79, color='CYAN'):
    """Print separator line"""
    log(char * width, color)


# ============================================================
# Command Execution
# ============================================================
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
    log('')
    separator('=', color='MAGENTA')
    log(f'  {description}', 'MAGENTA')
    separator('=', color='MAGENTA')
    log(f'[Command] {" ".join(str(c) for c in cmd)}', 'YELLOW')
    log(f'[Working Dir] {cwd}', 'CYAN')
    log('')

    try:
        command_env = os.environ.copy()
        if env:
            command_env.update(env)

        subprocess.run(
            cmd,
            cwd=str(cwd),
            env=command_env,
            check=True,
            stdout=sys.stdout,
            stderr=sys.stderr
        )

        log('')
        log(f'[SUCCESS] {description} completed', 'GREEN')
        separator('=', color='MAGENTA')
        log('')
        return True

    except subprocess.CalledProcessError as e:
        log('')
        log(f'[ERROR] {description} failed', 'RED')
        log(f'[ERROR] Exit code: {e.returncode}', 'RED')
        separator('=', color='MAGENTA')
        log('')
        return False
    except Exception as e:
        log('')
        log(f'[ERROR] {description} failed: {e}', 'RED')
        separator('=', color='MAGENTA')
        log('')
        return False


# ============================================================
# Build Check and Execution
# ============================================================
def check_build_exists(factory_app_dir: Path) -> bool:
    """
    Check if build output exists

    Args:
        factory_app_dir: Factory app directory

    Returns:
        True if .output directory exists
    """
    output_dir = factory_app_dir / '.output'
    return output_dir.exists() and output_dir.is_dir()


def build_app(app_name: str, factory_app_dir: Path, env_vars: dict) -> bool:
    """
    Build Nuxt app using factory sync

    Args:
        app_name: App namespace
        factory_app_dir: Factory app directory
        env_vars: Environment variables

    Returns:
        True if build successful
    """
    log('')
    separator('=', color='BLUE')
    log('  BUILDING NUXT APPLICATION', 'BLUE')
    separator('=', color='BLUE')
    log(f'  App: {app_name}', 'CYAN')
    log(f'  Factory Dir: {factory_app_dir}', 'CYAN')
    separator('=', color='BLUE')
    log('')

    # Step 1: Switch pages directory
    log('[Build Step 1/2] Switching pages directory...', 'YELLOW')
    success = run_command(
        cmd=['node', str(SWITCH_APP_SCRIPT), app_name],
        description=f'Switch pages directory to {app_name}',
        cwd=APP_DIR,
        env=env_vars
    )

    if not success:
        log('[Build] Failed to switch pages directory', 'RED')
        return False

    # Step 2: Execute build using switch-app.js with --mode build
    log('[Build Step 2/2] Running factory build...', 'YELLOW')
    log('[Build] This may take several minutes...', 'YELLOW')
    log('')

    success = run_command(
        cmd=['node', str(SWITCH_APP_SCRIPT), app_name, '--mode', 'build'],
        description=f'Build {app_name} in production mode',
        cwd=APP_DIR,
        env=env_vars
    )

    if not success:
        log('[Build] Build failed', 'RED')
        return False

    # Verify build output
    if not check_build_exists(factory_app_dir):
        log(f'[Build] Build completed but .output directory not found in {factory_app_dir}', 'RED')
        return False

    log('')
    separator('=', color='GREEN')
    log('  BUILD COMPLETED SUCCESSFULLY', 'GREEN')
    separator('=', color='GREEN')
    log('')

    return True


# ============================================================
# Production Server Startup
# ============================================================
def start_production_server(factory_app_dir: Path, port: int, env_vars: dict):
    """
    Start Nuxt production server

    Args:
        factory_app_dir: Factory app directory
        port: Server port
        env_vars: Environment variables
    """
    output_server = factory_app_dir / '.output' / 'server' / 'index.mjs'

    if not output_server.exists():
        log(f'[Error] Server entry not found: {output_server}', 'RED')
        sys.exit(1)

    log('')
    separator('=', color='GREEN')
    log('  STARTING PRODUCTION SERVER', 'GREEN')
    separator('=', color='GREEN')
    log(f'  Server: {output_server}', 'CYAN')
    log(f'  Port: {port}', 'CYAN')
    log(f'  URL: http://localhost:{port}', 'GREEN')
    separator('=', color='GREEN')
    log('')

    # Prepare environment
    server_env = os.environ.copy()
    server_env.update(env_vars)
    server_env['NUXT_PORT'] = str(port)
    server_env['NUXT_HOST'] = '0.0.0.0'

    # Start server
    try:
        subprocess.run(
            ['node', str(output_server)],
            cwd=str(factory_app_dir),
            env=server_env,
            check=True
        )
    except KeyboardInterrupt:
        log('\n[Info] Server stopped by user', 'YELLOW')
    except Exception as e:
        log(f'\n[Error] Server crashed: {e}', 'RED')
        sys.exit(1)


# ============================================================
# Main Logic
# ============================================================
def main():
    """Main entry point"""
    log('')
    separator('=', color='CYAN')
    log('  NUXT PRODUCTION MODE LAUNCHER', 'CYAN')
    separator('=', color='CYAN')
    log('')

    # Parse arguments
    if len(sys.argv) < 2:
        log('[ERROR] Usage: python start_production.py <appname> [port] [--rebuild|--skip-build]', 'RED')
        log('[ERROR] Example: python start_production.py pymatrix 38007', 'RED')
        log('[ERROR] Options:', 'RED')
        log('[ERROR]   --rebuild     Force rebuild even if .output exists', 'RED')
        log('[ERROR]   --skip-build  Skip build and use existing .output', 'RED')
        sys.exit(1)

    app_name = sys.argv[1]
    port = 3000
    force_rebuild = False
    skip_build = False

    # Parse optional arguments
    for arg in sys.argv[2:]:
        if arg.isdigit():
            port = int(arg)
        elif arg == '--rebuild':
            force_rebuild = True
        elif arg == '--skip-build':
            skip_build = True

    # Validate switch-app.js exists
    if not SWITCH_APP_SCRIPT.exists():
        log(f'[ERROR] switch-app.js not found: {SWITCH_APP_SCRIPT}', 'RED')
        sys.exit(1)

    # Get factory directory
    factory_app_dir = get_factory_app_dir(app_name)

    log('[Config] Configuration:', 'YELLOW')
    log(f'  App Name: {app_name}', 'WHITE')
    log(f'  Port: {port}', 'WHITE')
    log(f'  Factory Dir: {factory_app_dir}', 'WHITE')
    log(f'  Force Rebuild: {force_rebuild}', 'WHITE')
    log(f'  Skip Build: {skip_build}', 'WHITE')
    log('')

    # Prepare environment
    env_vars = {
        'NUXT_HOST': '0.0.0.0',
        'NUXT_PORT': str(port),
        'APP_ENTRY': app_name
    }

    # Check if build exists
    build_exists = check_build_exists(factory_app_dir)

    if build_exists:
        log(f'[Info] Build output found in {factory_app_dir / ".output"}', 'GREEN')
    else:
        log(f'[Info] No build output found', 'YELLOW')

    # Determine if we need to build
    need_build = force_rebuild or not build_exists

    if skip_build:
        if not build_exists:
            log('[ERROR] --skip-build specified but no build exists', 'RED')
            log(f'[ERROR] Build directory not found: {factory_app_dir / ".output"}', 'RED')
            sys.exit(1)
        log('[Info] Skipping build as requested (--skip-build)', 'YELLOW')
        need_build = False

    # Build if needed
    if need_build:
        reason = 'forced rebuild' if force_rebuild else 'no existing build'
        log(f'[Info] Building application ({reason})...', 'YELLOW')

        if not build_app(app_name, factory_app_dir, env_vars):
            log('[ERROR] Build failed', 'RED')
            sys.exit(1)
    else:
        log('[Info] Using existing build', 'GREEN')

    # Start production server
    start_production_server(factory_app_dir, port, env_vars)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        log('\n[Info] Interrupted by user', 'YELLOW')
        sys.exit(0)
    except Exception as e:
        log(f'\n[FATAL ERROR] {e}', 'RED')
        import traceback
        traceback.print_exc()
        sys.exit(1)
