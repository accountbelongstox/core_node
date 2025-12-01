#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nuxt Main Start Script - Full Featured Launcher (Python Version)

Equivalent to start.ps1 with all features

Usage:
    python start.py                    # Interactive menu
    python start.py <app>              # Direct launch in debug mode
    python start.py <app> debug        # Direct launch in debug mode
    python start.py <app> build        # Direct launch in build mode
    python start.py help               # Show help
    python start.py list               # List available apps

Examples:
    python start.py pymatrix           # Start pyMatrix in debug mode
    python start.py ittools build      # Build ITTools
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from typing import Dict, Optional, Tuple

# ============================================================
# Global Variables
# ============================================================
ORIGINAL_WORKING_DIR = os.getcwd()
SCRIPT_DIR = Path(__file__).parent
APP_DIR = SCRIPT_DIR.parent
SWITCH_APP_SCRIPT = SCRIPT_DIR / "switch-app.js"

# ANSI Color Codes
class Colors:
    RESET = '\033[0m'
    BRIGHT = '\033[1m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'
    GRAY = '\033[90m'


def log(message: str, color: str = 'RESET'):
    """Print colored log message"""
    color_code = getattr(Colors, color.upper(), Colors.RESET)
    print(f"{color_code}{message}{Colors.RESET}")


def separator(color: str = 'CYAN'):
    """Print separator line"""
    log('=' * 79, color)


# ============================================================
# App Configuration Scanner
# ============================================================
def scan_app_configs() -> Dict:
    """Scan and load app configurations"""
    apps_dir = APP_DIR / 'apps'
    app_configs = {}

    if not apps_dir.exists():
        return app_configs

    for entry in apps_dir.iterdir():
        if entry.is_dir() and entry.name.startswith('app_'):
            app_name = entry.name.replace('app_', '', 1)
            config_path = entry / 'app-config.json'

            if config_path.exists():
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        config_data = json.load(f)
                        app_configs[app_name] = {
                            'name': app_name,
                            'displayName': config_data.get('displayName', config_data.get('display_name', app_name)),
                            'port': config_data.get('port', 3000),
                            'devCommand': config_data.get('devCommand', config_data.get('dev_command', 'nuxt dev')),
                            'buildCommand': config_data.get('buildCommand', config_data.get('build_command', 'nuxt build'))
                        }
                except Exception:
                    # Skip invalid config
                    pass

    return app_configs


# ============================================================
# Interactive Menu
# ============================================================
def show_interactive_menu(app_configs: Dict, saved_state: Dict) -> Dict:
    """
    Show interactive menu for app selection

    Returns:
        Dict with selectedApp, mode, selectedIndex
    """
    try:
        import readchar
    except ImportError:
        log('[WARNING] readchar not installed, using simplified menu', 'YELLOW')
        return show_simple_menu(app_configs, saved_state)

    apps = sorted(app_configs.keys())
    selected_index = saved_state.get('selectedIndex', 0)
    mode = saved_state.get('mode', 'debug')

    if selected_index >= len(apps):
        selected_index = 0

    def render():
        nonlocal selected_index, mode
        os.system('cls' if os.name == 'nt' else 'clear')
        separator('GREEN')
        log('  NUXT MULTI-APP LAUNCHER - INTERACTIVE MENU', 'GREEN')
        separator('GREEN')
        log('')
        log('Use Arrow Keys to navigate, Enter to select, Q to quit', 'YELLOW')
        log('Press D for Debug mode, B for Build mode', 'YELLOW')
        log('')
        log(f'Current Mode: {mode.upper()}', 'CYAN' if mode == 'debug' else 'MAGENTA')
        log('')

        for index, app_name in enumerate(apps):
            config = app_configs[app_name]
            prefix = '→' if index == selected_index else ' '
            color = 'CYAN' if index == selected_index else 'WHITE'
            log(f'  {prefix} [{index + 1}] {config["displayName"]} ({app_name}) - Port {config["port"]}', color)

        log('')
        separator('GREEN')

    def update_state(new_index=None, new_mode=None):
        nonlocal selected_index, mode
        if new_index is not None:
            selected_index = new_index
        if new_mode is not None:
            mode = new_mode

    while True:
        render()

        try:
            key = readchar.readkey()
        except KeyboardInterrupt:
            sys.exit(0)

        if key == 'q' or key == 'Q':
            sys.exit(0)
        elif key == readchar.key.UP:
            new_index = selected_index - 1 if selected_index > 0 else len(apps) - 1
            update_state(new_index=new_index)
        elif key == readchar.key.DOWN:
            new_index = selected_index + 1 if selected_index < len(apps) - 1 else 0
            update_state(new_index=new_index)
        elif key == 'd' or key == 'D':
            update_state(new_mode='debug')
        elif key == 'b' or key == 'B':
            update_state(new_mode='build')
        elif key == readchar.key.ENTER or key == '\r' or key == '\n':
            app_name = apps[selected_index]
            return {
                'selectedApp': app_configs[app_name],
                'mode': mode,
                'selectedIndex': selected_index
            }


def show_simple_menu(app_configs: Dict, saved_state: Dict) -> Dict:
    """Simplified menu without interactive navigation"""
    apps = sorted(app_configs.keys())

    separator('GREEN')
    log('  NUXT MULTI-APP LAUNCHER - MENU', 'GREEN')
    separator('GREEN')
    log('')

    for index, app_name in enumerate(apps):
        config = app_configs[app_name]
        log(f'  [{index + 1}] {config["displayName"]} ({app_name}) - Port {config["port"]}', 'CYAN')

    log('')
    log('Enter number to select app, or Q to quit:', 'YELLOW')

    try:
        choice = input('> ').strip()
    except KeyboardInterrupt:
        sys.exit(0)

    if choice.lower() == 'q':
        sys.exit(0)

    try:
        index = int(choice) - 1
        if 0 <= index < len(apps):
            app_name = apps[index]
            log('')
            log('Select mode: [1] Debug  [2] Build', 'YELLOW')
            mode_choice = input('> ').strip()
            mode = 'build' if mode_choice == '2' else 'debug'

            return {
                'selectedApp': app_configs[app_name],
                'mode': mode,
                'selectedIndex': index
            }
    except (ValueError, IndexError):
        pass

    log('[ERROR] Invalid selection', 'RED')
    sys.exit(1)


# ============================================================
# Menu State Management
# ============================================================
def get_menu_state() -> Dict:
    """Load saved menu state"""
    state_path = APP_DIR / '.menu-state.json'
    try:
        if state_path.exists():
            with open(state_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {'selectedIndex': 0, 'mode': 'debug'}


def save_menu_state(selected_index: int, mode: str):
    """Save menu state"""
    state_path = APP_DIR / '.menu-state.json'
    with open(state_path, 'w', encoding='utf-8') as f:
        json.dump({'selectedIndex': selected_index, 'mode': mode}, f)


# ============================================================
# Parse Arguments
# ============================================================
def parse_args() -> Dict:
    """Parse command-line arguments"""
    args = sys.argv[1:]
    result = {
        'appName': '',
        'mode': 'debug',
        'multiApps': [],
        'showHelp': False,
        'showList': False
    }

    if not args:
        return result  # Interactive mode

    i = 0
    while i < len(args):
        arg = args[i]

        if arg in ('help', '-h', '--help'):
            result['showHelp'] = True
            return result

        if arg in ('list', '-list', '--list'):
            result['showList'] = True
            return result

        if arg in ('-MultiApps', '--multi', 'multi'):
            if i + 1 < len(args):
                result['multiApps'] = [s.strip() for s in args[i + 1].split(',')]
                i += 1
            i += 1
            continue

        if i == 0:
            result['appName'] = arg
        elif i == 1:
            if arg in ('debug', 'build'):
                result['mode'] = arg

        i += 1

    return result


# ============================================================
# Show Help
# ============================================================
def show_help(app_configs: Dict):
    """Show help message"""
    log('')
    separator('GREEN')
    log('  NUXT MAIN LAUNCHER - HELP', 'GREEN')
    separator('GREEN')
    log('')
    log('Usage:', 'YELLOW')
    log('  python start.py                    Interactive menu', 'WHITE')
    log('  python start.py <app>              Direct launch in debug mode', 'WHITE')
    log('  python start.py <app> debug        Direct launch in debug mode', 'WHITE')
    log('  python start.py <app> build        Direct launch in build mode', 'WHITE')
    log('  python start.py list               List available apps', 'WHITE')
    log('  python start.py help               Show this help', 'WHITE')
    log('')
    log('Available Apps:', 'YELLOW')
    for key in sorted(app_configs.keys()):
        config = app_configs[key]
        log(f'  - {key}', 'CYAN')
        log(f'    ({config["displayName"]} on port {config["port"]})', 'GRAY')
    log('')
    log('Examples:', 'YELLOW')
    log('  python start.py pymatrix           Start pyMatrix in debug mode', 'WHITE')
    log('  python start.py ittools build      Build ITTools', 'WHITE')
    log('')
    separator('GREEN')


# ============================================================
# Show List
# ============================================================
def show_list(app_configs: Dict):
    """Show list of available apps"""
    log('')
    separator('GREEN')
    log('  AVAILABLE APPLICATIONS', 'GREEN')
    separator('GREEN')
    log('')
    for key in sorted(app_configs.keys()):
        config = app_configs[key]
        log('  App Name     : ', 'YELLOW')
        log(f'  {key}', 'CYAN')
        log('  Display Name : ', 'YELLOW')
        log(f'  {config["displayName"]}', 'WHITE')
        log('  Port         : ', 'YELLOW')
        log(f'  {config["port"]}', 'WHITE')
        log('')
    separator('GREEN')


# ============================================================
# Execute Command with Error Handling
# ============================================================
def execute_command(command: list, description: str, cwd: Path, env: Dict) -> bool:
    """Execute command and return success status"""
    log('')
    separator('MAGENTA')
    log(f'  {description}', 'MAGENTA')
    separator('MAGENTA')
    log(f'[COMMAND] {" ".join(command)}', 'YELLOW')
    log('')

    try:
        # Merge environment
        command_env = os.environ.copy()
        command_env.update(env)

        subprocess.run(
            command,
            cwd=str(cwd),
            env=command_env,
            check=True,
            stdout=sys.stdout,
            stderr=sys.stderr
        )

        log('')
        log(f'[SUCCESS] {description} completed', 'GREEN')
        separator('MAGENTA')
        log('')
        return True

    except subprocess.CalledProcessError as e:
        log('')
        log(f'[ERROR] {description} failed', 'RED')
        log(f'[ERROR] Exit code: {e.returncode}', 'RED')
        separator('MAGENTA')
        log('')
        return False
    except Exception as e:
        log('')
        log(f'[ERROR] {description} failed: {e}', 'RED')
        separator('MAGENTA')
        log('')
        return False


# ============================================================
# Main Function
# ============================================================
def main():
    """Main entry point"""
    log('')
    separator('CYAN')
    log('  NUXT MAIN APPLICATION LAUNCHER - INITIALIZATION', 'CYAN')
    separator('CYAN')
    log('')
    log('[TRACE] Script Initialization:', 'YELLOW')
    log(f'  > Original Working Directory: {ORIGINAL_WORKING_DIR}', 'WHITE')
    log(f'  > Script Directory: {SCRIPT_DIR}', 'WHITE')
    log(f'  > Application Directory: {APP_DIR}', 'WHITE')
    log('')

    # Scan app configs
    log('[TRACE] Scanning application configurations...', 'YELLOW')
    app_configs = scan_app_configs()
    log(f'  [OK] Found {len(app_configs)} applications', 'GREEN')
    log('')

    # Change to app directory
    log('[TRACE] Changing Directory to Application Root:', 'YELLOW')
    log(f'  > Set Working Directory: {APP_DIR}', 'WHITE')
    os.chdir(APP_DIR)
    log(f'  [OK] Current Location: {os.getcwd()}', 'GREEN')
    log('')
    separator('CYAN')
    log('')

    # Parse arguments
    parsed_args = parse_args()

    if parsed_args['showHelp']:
        show_help(app_configs)
        sys.exit(0)

    if parsed_args['showList']:
        show_list(app_configs)
        sys.exit(0)

    # Determine mode
    selected_app = None
    mode = 'debug'
    selected_index = 0

    if parsed_args['appName']:
        # Command-line mode
        if parsed_args['appName'] not in app_configs:
            log('')
            separator('RED')
            log(f'  ERROR: Unknown application \'{parsed_args["appName"]}\'', 'RED')
            separator('RED')
            log('')
            log('Available apps:', 'YELLOW')
            for key in sorted(app_configs.keys()):
                log(f'  - {key}', 'CYAN')
            log('')
            sys.exit(1)

        selected_app = app_configs[parsed_args['appName']]
        mode = parsed_args['mode']

        log('')
        separator('GREEN')
        log('  COMMAND-LINE MODE ACTIVATED', 'GREEN')
        separator('GREEN')
        log(f'  Selected App: {selected_app["displayName"]}', 'CYAN')
        log(f'  Mode: {mode}', 'CYAN')
        separator('GREEN')
        log('')
    else:
        # Interactive mode
        saved_state = get_menu_state()
        menu_result = show_interactive_menu(app_configs, saved_state)
        selected_app = menu_result['selectedApp']
        mode = menu_result['mode']
        selected_index = menu_result['selectedIndex']
        save_menu_state(selected_index, mode)

    # Set environment variables
    env = {
        'NUXT_HOST': '0.0.0.0',
        'NUXT_PORT': str(selected_app['port']),
        'APP_ENTRY': selected_app['name']
    }

    log('')
    separator('CYAN')
    log('  APPLICATION STARTUP INFO', 'CYAN')
    separator('CYAN')
    log('')
    log('=== Application Selection ===', 'YELLOW')
    log(f'  Selected App     : {selected_app["displayName"]}', 'GREEN')
    log(f'  Namespace        : {selected_app["name"]}', 'GREEN')
    log(f'  Mode             : {mode}', 'GREEN')
    log(f'  Port             : {selected_app["port"]}', 'GREEN')
    log(f'  Host             : 0.0.0.0', 'GREEN')
    log('')
    log('=== Network Configuration ===', 'YELLOW')
    log(f'  Local URL        : http://127.0.0.1:{selected_app["port"]}', 'CYAN')
    log(f'  Network URL      : http://0.0.0.0:{selected_app["port"]}', 'CYAN')
    log('')
    separator('CYAN')
    log('')

    # Step 1: Switch pages directory
    switch_success = execute_command(
        ['node', str(SWITCH_APP_SCRIPT), selected_app['name']],
        'STEP 1: SWITCHING APP PAGES DIRECTORY',
        APP_DIR,
        env
    )

    if not switch_success:
        log('[ERROR] Failed to switch pages directory', 'RED')
        sys.exit(1)

    # Step 2: Start application server
    if mode == 'debug':
        log('')
        log('[INFO] Opening browser...', 'GREEN')
        url = f'http://127.0.0.1:{selected_app["port"]}'
        try:
            import webbrowser
            webbrowser.open(url)
        except Exception:
            log('[WARNING] Could not open browser automatically', 'YELLOW')

        execute_command(
            ['node', str(SWITCH_APP_SCRIPT), selected_app['name'], '--mode', 'dev'],
            'STEP 2: STARTING APPLICATION SERVER (DEBUG MODE)',
            APP_DIR,
            env
        )
    else:
        execute_command(
            ['node', str(SWITCH_APP_SCRIPT), selected_app['name'], '--mode', 'build'],
            'STEP 2: BUILDING APPLICATION (BUILD MODE)',
            APP_DIR,
            env
        )

    # Restore original directory
    os.chdir(ORIGINAL_WORKING_DIR)


# ============================================================
# Entry Point
# ============================================================
if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        log('\n[INFO] Interrupted by user', 'YELLOW')
        sys.exit(0)
    except Exception as e:
        log(f'\n[FATAL ERROR] {e}', 'RED')
        import traceback
        traceback.print_exc()
        sys.exit(1)
