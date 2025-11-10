#!/usr/bin/env python3
"""
Special Software Environment Variables Management Menu

Provides a menu interface for setting environment variables for special software like AI tools.
This is the Python implementation replacing the PowerShell version.

Usage:
    python special_software_env_manager.py
"""

import os
import sys
import platform
import json
import stat
import subprocess
import traceback
import shutil
import getpass
from typing import List, Dict, Any, Set
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Add pycore to path for secret_manager
_current_file = Path(__file__).resolve()
_project_root = _current_file.parent.parent.parent.parent
_pycore_path = _project_root / 'pycore'
if _pycore_path.exists():
    sys.path.insert(0, str(_pycore_path))

from common_utils import (ColorMessage, show_menu, is_admin, clear_screen, get_key_press,
                          get_platform_type, is_wsl, is_desktop, is_server,
                          get_winenvs_dir, get_linuxenvs_dir, ensure_directory_exists,
                          get_project_root)
from config_manager import ConfigManager
from command_content_generator_windows import WindowsCommandContentGenerator
from command_content_generator_linux import LinuxCommandContentGenerator
from smart_recognition import (
    has_whitespace_in_middle,
    extract_api_url_and_token,
    display_extraction_results,
    prompt_token_fill_strategy,
    get_token_variables,
    get_value_for_input_type
)

# Import secret manager from pycore
try:
    from pyfoundations import get_secret_key, set_secret_key, get_all_secret_keys
    from pyfoundations.secret_manager import _get_password
    SECRET_MANAGER_AVAILABLE = True
except Exception as exc:  # noqa: BLE001 - need to handle all import-time failures
    SECRET_MANAGER_AVAILABLE = False
    _get_password = None
    ColorMessage.write(
        f"WARNING: Secret manager not available from pycore ({exc})",
        'warning'
    )


class LocalSecretManager:
    """Lightweight secret loader that works directly with encrypted files"""

    def __init__(self):
        self.project_root = get_project_root()
        self.secret_keys_dir = self.project_root / '.secret_keys'
        self.raw_dir = self.secret_keys_dir / '.secret_ignore'
        self.encrypted_dir = self.secret_keys_dir / 'already_encrypted'
        self.batch_attempted = False
        self.node_command = self._detect_node_command()

    def _detect_node_command(self):
        for candidate in ('node', 'nodejs'):
            if shutil.which(candidate):
                return candidate
        return None

    def _read_raw_value(self, key_name):
        target_file = self.raw_dir / key_name
        if target_file.exists():
            try:
                content = target_file.read_text(encoding='utf-8').strip()
                if content:
                    return content
            except OSError:
                return None
        return None

    def _encrypted_file_exists(self, key_name):
        lower = self.encrypted_dir / f"{key_name}.js"
        upper = self.encrypted_dir / f"{key_name}.JS"
        return lower.exists() or upper.exists()

    def _gather_pending_files(self):
        if not self.encrypted_dir.exists():
            return []

        files = list(self.encrypted_dir.glob('*.js')) + list(self.encrypted_dir.glob('*.JS'))
        pending = []
        for enc_file in files:
            if not enc_file.is_file():
                continue
            if not (self.raw_dir / enc_file.stem).exists():
                pending.append(enc_file)
        return pending

    def _prompt_for_password(self):
        try:
            return getpass.getpass('Enter password to decrypt secret files: ')
        except (EOFError, KeyboardInterrupt):
            return None

    def _trigger_batch_decryption(self):
        pending_files = self._gather_pending_files()
        if not pending_files:
            self.batch_attempted = True
            return True

        if not self.node_command:
            ColorMessage.write('Node.js is required to decrypt secret files. Please install node.', 'warning')
            self.batch_attempted = True
            return False

        if not sys.stdin.isatty():
            ColorMessage.write('Cannot prompt for secret password (non-interactive session).', 'warning')
            self.batch_attempted = True
            return False

        ColorMessage.write('Encrypted secret files detected. A password is required to decrypt them.', 'info')
        password = self._prompt_for_password()
        if not password:
            ColorMessage.write('No password provided. Skipping decryption.', 'warning')
            self.batch_attempted = True
            return False

        try:
            self.raw_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            ColorMessage.write(f'Unable to create {self.raw_dir}: {exc}', 'error')
            self.batch_attempted = True
            return False

        success_count = 0
        for enc_file in pending_files:
            ColorMessage.write(f'  Decrypting {enc_file.name} ...', 'info')
            result = subprocess.run(
                [self.node_command, str(enc_file), 'pwd', password, str(self.raw_dir)],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0:
                success_count += 1
                ColorMessage.write('    OK', 'success')
            else:
                ColorMessage.write('    FAILED', 'warning')
                details = (result.stderr or result.stdout or '').strip()
                if details:
                    ColorMessage.write(f'    {details}', 'warning')

        password = None  # best-effort cleanup
        self.batch_attempted = True

        if success_count == len(pending_files):
            ColorMessage.write('All secret files decrypted successfully.', 'success')
            return True

        ColorMessage.write(
            f'Decrypted {success_count}/{len(pending_files)} secret files. Missing values may persist.',
            'warning'
        )
        return False

    def get_secret(self, key_name):
        if not key_name or not self.secret_keys_dir.exists():
            return None

        value = self._read_raw_value(key_name)
        if value:
            return value

        if not self._encrypted_file_exists(key_name):
            return None

        if not self.batch_attempted:
            self._trigger_batch_decryption()
            return self._read_raw_value(key_name)

        return self._read_raw_value(key_name)


LOCAL_SECRET_MANAGER = LocalSecretManager()


def resolve_secret_value(secret_key_name):
    """Load a secret value using pyfoundations or the local fallback"""

    if not secret_key_name:
        return None

    value = None

    if SECRET_MANAGER_AVAILABLE:
        try:
            value = get_secret_key(secret_key_name)
        except Exception as exc:  # noqa: BLE001 - propagate fallback instead of crashing
            ColorMessage.write(f"Secret manager error for {secret_key_name}: {exc}", 'warning')
            value = None

    if value:
        return value

    return LOCAL_SECRET_MANAGER.get_secret(secret_key_name)


class SpecialSoftwareEnvManager:
    """Main manager for special software environment variables"""

    def __init__(self):
        self.config_manager = ConfigManager()
        self.windows_generator = WindowsCommandContentGenerator()
        self.linux_generator = LinuxCommandContentGenerator()

        # Action to config name mapping
        self.action_to_config = {
            'claude': 'Claude AI',
            'droid': 'Factory AI Droid',
            'ssh': 'SSH Connection'
        }

        # Configuration backup directory
        self.backup_dir = get_project_root() / 'scripts' / 'pytools' / 'special_software_env_manager' / 'backups'
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def _prepare_config_info_for_display(self, config: dict, file_number: int = None) -> dict:
        """
        Prepare configuration information for display in menu
        
        Extracts relevant keys from config to show in menu details.
        Includes: Variables, SmartRecognition, MCPSupport, and other relevant keys.
        If file_number is provided, attempts to load encrypted values from storage.
        
        Args:
            config: Configuration dictionary
            file_number: Optional file number to load encrypted values for existing scripts
            
        Returns:
            Dictionary with configuration details formatted for display
        """
        display_info = {}
        
        # Always include Variables if present
        if 'Variables' in config and config['Variables']:
            variables = []
            for var in config['Variables']:
                var_info = var.copy()
                
                # If file_number is provided, try to load encrypted value
                if file_number is not None:
                    var_name = var.get('Name', '')
                    secret_key_name = f"{var_name}_{file_number}"
                    encrypted_value = resolve_secret_value(secret_key_name)

                    if encrypted_value:
                        var_info['EncryptedValue'] = True
                        if len(encrypted_value) > 8:
                            var_info['ValuePreview'] = encrypted_value[:8] + "..."
                        else:
                            var_info['ValuePreview'] = "***"
                    else:
                        var_info['EncryptedValue'] = False
                else:
                    var_info['EncryptedValue'] = False
                
                variables.append(var_info)
            
            display_info['Variables'] = variables
        
        # Include SmartRecognition if present and enabled
        if 'SmartRecognition' in config:
            smart_rec = config['SmartRecognition']
            if smart_rec and smart_rec.get('Enabled', False):
                display_info['SmartRecognition'] = {
                    'Enabled': smart_rec.get('Enabled', False),
                    'AllowedTypes': smart_rec.get('AllowedTypes', [])
                }
        
        # Include MCPSupport if present and enabled
        if 'MCPSupport' in config:
            mcp_support = config['MCPSupport']
            if mcp_support and mcp_support.get('Enabled', False):
                mcp_info = {'Enabled': True}
                # Include script paths if available
                if 'PreLaunchScript' in mcp_support:
                    mcp_info['PreLaunchScript'] = mcp_support['PreLaunchScript']
                if 'UpgradeScript' in mcp_support:
                    mcp_info['UpgradeScript'] = mcp_support['UpgradeScript']
                if 'MCPSyncScript' in mcp_support:
                    mcp_info['MCPSyncScript'] = mcp_support['MCPSyncScript']
                display_info['MCPSupport'] = mcp_info
        
        # Include other relevant keys (CommandPrefix, WindowsCommand, LinuxCommand)
        if 'CommandPrefix' in config:
            display_info['CommandPrefix'] = config['CommandPrefix']
        if 'WindowsCommand' in config:
            display_info['WindowsCommand'] = config['WindowsCommand']
        if 'LinuxCommand' in config:
            display_info['LinuxCommand'] = config['LinuxCommand']
        
        return display_info

    def get_full_config_name(self, action: str) -> str:
        """Get full configuration name from action"""
        return self.action_to_config.get(action, action)

    def get_next_file_number(self, command_prefix: str) -> int:
        """Get the next available file number for a command prefix"""
        platform_type = get_platform_type()

        # Check both winenvs and linuxenvs directories
        directories = []
        if platform_type == 'windows':
            directories.append(get_winenvs_dir())
        else:
            directories.append(get_linuxenvs_dir())

        max_number = 0

        for directory in directories:
            if not directory.exists():
                continue

            # Look for files with pattern: {prefix}{number}.{ext}
            for file_path in directory.iterdir():
                if file_path.is_file():
                    name = file_path.stem
                    if name.startswith(command_prefix):
                        try:
                            number_str = name[len(command_prefix):]
                            number = int(number_str)
                            max_number = max(max_number, number)
                        except ValueError:
                            continue

        return max_number + 1

    def list_existing_scripts(self, command_prefix: str) -> list:
        """
        List existing scripts for a command prefix

        Only returns scripts that exist on BOTH Windows and Linux platforms.
        This ensures consistency across platforms.

        Returns:
            List of script info dictionaries with file numbers that exist on both platforms
        """
        scripts = []

        # Get both directories
        winenvs_dir = get_winenvs_dir()
        linuxenvs_dir = get_linuxenvs_dir()

        # Collect file numbers from Windows scripts
        windows_file_numbers = set()
        if winenvs_dir.exists():
            for file_path in winenvs_dir.iterdir():
                if file_path.is_file() and file_path.suffix == '.ps1':
                    name = file_path.stem
                    if name.startswith(command_prefix):
                        try:
                            # Extract file number (e.g., "claude5" -> 5)
                            number_part = name.replace(command_prefix, '')
                            file_num = int(number_part)
                            windows_file_numbers.add(file_num)
                        except ValueError:
                            # Skip files that don't match expected naming pattern
                            continue

        # Collect file numbers from Linux scripts
        linux_file_numbers = set()
        if linuxenvs_dir.exists():
            for file_path in linuxenvs_dir.iterdir():
                if file_path.is_file() and file_path.suffix == '.sh':
                    name = file_path.stem
                    if name.startswith(command_prefix):
                        try:
                            # Extract file number (e.g., "claude5" -> 5)
                            number_part = name.replace(command_prefix, '')
                            file_num = int(number_part)
                            linux_file_numbers.add(file_num)
                        except ValueError:
                            # Skip files that don't match expected naming pattern
                            continue

        # Only include file numbers that exist on BOTH platforms
        common_file_numbers = windows_file_numbers & linux_file_numbers

        # Build script list for common file numbers
        for file_num in sorted(common_file_numbers):
            win_script_name = f"{command_prefix}{file_num}.ps1"
            linux_script_name = f"{command_prefix}{file_num}.sh"

            scripts.append({
                'file_number': file_num,
                'windows_name': win_script_name,
                'linux_name': linux_script_name,
                'windows_path': winenvs_dir / win_script_name,
                'linux_path': linuxenvs_dir / linux_script_name
            })

        return scripts

    def list_all_existing_scripts(self, command_prefix: str) -> list:
        """
        List all existing scripts for a command prefix from current platform

        Returns scripts that exist on the current platform, regardless of whether
        they exist on the other platform. This allows users to see and manage
        all scripts on their current platform.

        Returns:
            List of script info dictionaries with file numbers that exist on current platform
        """
        scripts = []
        platform_type = get_platform_type()
        is_windows_platform = platform_type in ('windows', 'wsl')

        # Get directories
        winenvs_dir = get_winenvs_dir()
        linuxenvs_dir = get_linuxenvs_dir()

        # Collect file numbers and script info
        file_numbers = set()
        script_info = {}  # file_num -> {windows_exists, linux_exists, windows_path, linux_path}

        # Check Windows scripts
        if winenvs_dir.exists():
            for file_path in winenvs_dir.iterdir():
                if file_path.is_file() and file_path.suffix == '.ps1':
                    name = file_path.stem
                    if name.startswith(command_prefix):
                        try:
                            number_part = name.replace(command_prefix, '')
                            file_num = int(number_part)
                            file_numbers.add(file_num)
                            if file_num not in script_info:
                                script_info[file_num] = {
                                    'windows_exists': False,
                                    'linux_exists': False,
                                    'windows_path': None,
                                    'linux_path': None
                                }
                            script_info[file_num]['windows_exists'] = True
                            script_info[file_num]['windows_path'] = file_path
                        except ValueError:
                            continue

        # Check Linux scripts
        if linuxenvs_dir.exists():
            for file_path in linuxenvs_dir.iterdir():
                if file_path.is_file() and file_path.suffix == '.sh':
                    name = file_path.stem
                    if name.startswith(command_prefix):
                        try:
                            number_part = name.replace(command_prefix, '')
                            file_num = int(number_part)
                            file_numbers.add(file_num)
                            if file_num not in script_info:
                                script_info[file_num] = {
                                    'windows_exists': False,
                                    'linux_exists': False,
                                    'windows_path': None,
                                    'linux_path': None
                                }
                            script_info[file_num]['linux_exists'] = True
                            script_info[file_num]['linux_path'] = file_path
                        except ValueError:
                            continue

        # Build script list - only include scripts that exist on current platform
        for file_num in sorted(file_numbers):
            info = script_info[file_num]
            
            # Only include if script exists on current platform
            if is_windows_platform and not info['windows_exists']:
                continue
            if not is_windows_platform and not info['linux_exists']:
                continue
            
            win_script_name = f"{command_prefix}{file_num}.ps1"
            linux_script_name = f"{command_prefix}{file_num}.sh"

            scripts.append({
                'file_number': file_num,
                'windows_name': win_script_name,
                'linux_name': linux_script_name,
                'windows_path': info['windows_path'] or (winenvs_dir / win_script_name),
                'linux_path': info['linux_path'] or (linuxenvs_dir / linux_script_name),
                'windows_exists': info['windows_exists'],
                'linux_exists': info['linux_exists'],
                'exists_on_both': info['windows_exists'] and info['linux_exists']
            })

        return scripts

    def save_configuration_backup(self, config_name: str, env_vars: dict) -> Path:
        """Save configuration as backup file"""
        command_prefix = self.config_manager.get_command_prefix(config_name)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{command_prefix}_backup_{timestamp}.json"
        backup_path = self.backup_dir / filename

        backup_data = {
            'config_name': config_name,
            'timestamp': timestamp,
            'platform': get_platform_type(),
            'environment_variables': env_vars
        }

        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2)

        return backup_path

    def list_configuration_backups(self, config_name: str) -> list:
        """List available configuration backups"""
        command_prefix = self.config_manager.get_command_prefix(config_name)
        backups = []

        if not self.backup_dir.exists():
            return backups

        for backup_file in self.backup_dir.iterdir():
            if backup_file.is_file() and backup_file.suffix == '.json':
                if backup_file.name.startswith(command_prefix):
                    try:
                        with open(backup_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            backups.append({
                                'path': backup_file,
                                'name': backup_file.name,
                                'timestamp': data.get('timestamp', 'unknown'),
                                'platform': data.get('platform', 'unknown'),
                                'config_name': data.get('config_name', config_name)
                            })
                    except Exception:
                        continue

        return sorted(backups, key=lambda x: x['timestamp'], reverse=True)

    def show_main_menu(self):
        """Display the main menu"""
        while True:
            # Display script path information at the top
            clear_screen()
            script_path = Path(__file__).resolve()
            ColorMessage.write("=" * 80, 'info')
            ColorMessage.write("Special Software Environment Variables Manager", 'success')
            ColorMessage.write("=" * 80, 'info')
            ColorMessage.write(f"Script Location: {script_path}", 'info')
            ColorMessage.write(f"Working Directory: {Path.cwd()}", 'info')
            ColorMessage.write("=" * 80, 'info')
            print()

            menu_items = []

            # Add configuration items
            for config_name, config in self.config_manager.get_all_configs().items():
                action = config['Common']
                menu_items.append({
                    'Text': config['DisplayName'],
                    'Action': action,
                    'HasSubMenu': True
                })

            # Add utility items
            menu_items.extend([
                {'Text': 'Restore Scripts from Secret Storage', 'Action': 'restore_scripts', 'HasSubMenu': False},
                {'Text': 'Add Scripts Directory to PATH', 'Action': 'addpath', 'HasSubMenu': False},
                {'Text': 'View All Environment Variables', 'Action': 'viewall', 'HasSubMenu': False},
                {'Text': 'Refresh Current Terminal Environment', 'Action': 'refresh', 'HasSubMenu': False},
                {'Text': 'Back to Main Menu', 'Action': 'back', 'HasSubMenu': False},
                {'Text': 'Exit', 'Action': 'exit', 'HasSubMenu': False}
            ])

            action = show_menu("Special Software Environment Variables Manager", menu_items)

            # Handle actions
            if action == 'addpath':
                self.add_scripts_to_path()
            elif action == 'viewall':
                self.show_all_environment_variables()
            elif action == 'refresh':
                self.refresh_current_terminal_environment()
            elif action == 'restore_scripts':
                self.restore_scripts_from_secrets()
            elif action == 'back':
                continue
            elif action == 'exit':
                sys.exit(0)
            elif action in self.action_to_config:
                self.show_submenu(action)
            else:
                ColorMessage.write(f"Unknown action: {action}", 'error')
                input("Press Enter to continue...")

    def show_submenu(self, action: str):
        """Show submenu for a specific configuration"""
        config_name = self.get_full_config_name(action)
        config = self.config_manager.get_config(config_name)

        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            input("Press Enter to continue...")
            return

        while True:
            display_name = config['DisplayName']
            menu_items = [
                {'Text': f"Add {display_name} Global Command", 'Action': 'addcommand', 'HasSubMenu': False},
                {'Text': f"Set {display_name} Environment Variables", 'Action': 'setenvvars', 'HasSubMenu': False},
                {'Text': f"View {display_name} Environment Variables", 'Action': 'viewenvvars', 'HasSubMenu': False},
                {'Text': f"View {display_name} Scripts", 'Action': 'viewscripts', 'HasSubMenu': False},
                {'Text': 'Restore from Configuration', 'Action': 'restore', 'HasSubMenu': False},
                {'Text': 'Back to Main Menu', 'Action': 'back', 'HasSubMenu': False}
            ]

            submenu_action = show_menu(f"{display_name} Menu", menu_items)

            if submenu_action == 'addcommand':
                self.add_global_command(config_name)
            elif submenu_action == 'setenvvars':
                self.set_environment_variables(config_name)
            elif submenu_action == 'viewenvvars':
                self.view_environment_variables(config_name)
            elif submenu_action == 'viewscripts':
                self.view_scripts(config_name)
            elif submenu_action == 'restore':
                self.restore_configuration(config_name)
            elif submenu_action == 'back':
                return

    def add_global_command(self, config_name: str):
        """Add a new global command for the specified configuration"""
        config = self.config_manager.get_config(config_name)
        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            input("Press Enter to continue...")
            return

        clear_screen()
        ColorMessage.write(f"Add Global Command for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')

        # Show platform information
        platform_type = get_platform_type()
        platform_names = {
            'windows': 'Windows',
            'wsl': 'WSL (Windows Subsystem for Linux)',
            'ubuntu_desktop': 'Ubuntu Desktop',
            'linux_desktop': 'Linux Desktop',
            'linux_server': 'Linux Server',
            'linux': 'Linux'
        }
        ColorMessage.write(f"Detected Platform: {platform_names.get(platform_type, platform_type)}", 'success')
        print()

        if not is_admin():
            ColorMessage.write("WARNING: Running without administrator/root privileges.", 'warning')
            ColorMessage.write("Generated scripts may require elevated privileges to set system variables.", 'warning')
            print()

        # Get command prefix and list existing scripts
        command_prefix = config.get('CommandPrefix', config.get('Common', ''))
        existing_scripts = self.list_all_existing_scripts(command_prefix)
        next_file_number = self.get_next_file_number(command_prefix)

        # Build selection menu
        ColorMessage.write(f"Configuration: {config['DisplayName']}", 'info')
        ColorMessage.write(f"Command Prefix: {command_prefix}", 'info')
        print()

        menu_items = []
        menu_index = 1
        
        # First option: Create new (no file_number, so no encrypted values)
        config_info_new = self._prepare_config_info_for_display(config, file_number=None)
        menu_items.append({
            'Text': f"Create New {config['DisplayName']} #{next_file_number}",
            'Action': f'create_{next_file_number}',
            'HasSubMenu': False,
            'ConfigInfo': config_info_new
        })
        menu_index += 1

        # Other options: Replace existing (show all scripts with platform info)
        # Sort existing scripts by file number (descending) to show newest first
        sorted_scripts = sorted(existing_scripts, key=lambda x: x['file_number'], reverse=True)
        for script in sorted_scripts:
            file_num = script['file_number']
            # Build platform indicator
            if script.get('exists_on_both', False):
                platform_info = f"{script['windows_name']} / {script['linux_name']}"
            elif script.get('windows_exists', False):
                platform_info = f"{script['windows_name']} (Windows only)"
            elif script.get('linux_exists', False):
                platform_info = f"{script['linux_name']} (Linux only)"
            else:
                platform_info = f"{script['windows_name']} / {script['linux_name']}"
            
            # Prepare config info with file_number to load encrypted values
            config_info_existing = self._prepare_config_info_for_display(config, file_number=file_num)
            
            menu_items.append({
                'Text': f"Replace existing {config['DisplayName']} #{file_num} ({platform_info})",
                'Action': f'replace_{file_num}',
                'HasSubMenu': False,
                'ConfigInfo': config_info_existing
            })
            menu_index += 1

        if not menu_items:
            # Fallback if no menu items (shouldn't happen since we always have "create new")
            file_number = next_file_number
            mode = 'create'
        else:
            # Show menu and get user choice
            ColorMessage.write("Select action:", 'info')
            print()
            selected_action = show_menu("Script Selection", menu_items)

            # Parse selection
            if selected_action.startswith('create_'):
                mode = 'create'
                file_number = int(selected_action.replace('create_', ''))
            elif selected_action.startswith('replace_'):
                mode = 'replace'
                file_number = int(selected_action.replace('replace_', ''))
            else:
                # Default to create new
                mode = 'create'
                file_number = next_file_number

        clear_screen()
        ColorMessage.write(f"Add Global Command for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()
        ColorMessage.write(f"Configuration: {config['DisplayName']}", 'info')
        ColorMessage.write(f"Command Prefix: {command_prefix}", 'info')
        ColorMessage.write(f"File Number: {file_number}", 'info')
        ColorMessage.write(f"Mode: {'Replace existing' if mode == 'replace' else 'Create new'}", 'info')
        print()

        # Get environment variable values from user with smart recognition
        ColorMessage.write("Enter values for environment variables:", 'info')
        if mode == 'replace':
            ColorMessage.write("(Press Enter to keep current value)", 'info')
        else:
            ColorMessage.write("(Press Enter to skip a variable)", 'info')

        # Check if smart recognition is enabled
        smart_recognition_enabled = config.get('SmartRecognition', {}).get('Enabled', False)

        # Show smart recognition hint for first variable
        if smart_recognition_enabled and config.get('Variables'):
            print()
            ColorMessage.write("Note: Multi-line input is supported and will be intelligently parsed.", 'info')
            ColorMessage.write("If input contains spaces or line breaks, smart extraction will be applied.", 'info')
            ColorMessage.write("Subsequent variables may be auto-filled if both URL and Token are detected.", 'info')

        print()

        # In replace mode, first load and display all existing values
        existing_values = {}  # Store existing values for all variables
        if mode == 'replace' and file_number is not None:
            ColorMessage.write("Current values:", 'info')
            ColorMessage.write("-" * 60, 'info')
            
            for var in config['Variables']:
                var_name = var['Name']
                display_name = var['DisplayName']
                existing_value = None
                
                # Try to load from encrypted or decrypted storage
                secret_key_name = f"{var_name}_{file_number}"
                existing_value = resolve_secret_value(secret_key_name)

                # Fallback to environment variable
                if not existing_value:
                    existing_value = os.environ.get(var_name, '')
                
                # Store the value
                if existing_value:
                    existing_values[var_name] = existing_value
                    # Display the value (truncate if too long)
                    display_value = existing_value
                    if len(display_value) > 70:
                        display_value = display_value[:67] + "..."
                    ColorMessage.write(f"  {display_name}: {display_value}", 'info')
                else:
                    ColorMessage.write(f"  {display_name}: [Not set]", 'warning')
            
            print()
            ColorMessage.write("Enter new values (press Enter to keep current value):", 'info')
            print()

        user_inputs = {}
        extracted_data = None
        token_fill_strategy = None
        target_token_variable = None
        auto_filled_variables = set()

        for var_index, var in enumerate(config['Variables']):
            display_name = var['DisplayName']
            description = var.get('Description', '')
            current_value = os.environ.get(var['Name'], '')
            input_type = var.get('InputType', '')
            var_name = var['Name']

            if description:
                ColorMessage.write(f"{display_name}:", 'info')
                ColorMessage.write(f"  {description}", 'info')

            # Get existing value (from pre-loaded values in replace mode, or current env)
            existing_value = existing_values.get(var_name) if mode == 'replace' else None
            if not existing_value:
                existing_value = current_value if current_value else None

            # Check if this variable should be auto-filled from extracted data
            if extracted_data and extracted_data.has_data():
                # Auto-fill logic for Token types based on strategy
                if input_type == "Token" and token_fill_strategy:
                    if token_fill_strategy == "all":
                        # Fill all Token variables
                        if extracted_data.tokens:
                            value = get_value_for_input_type(input_type, extracted_data, "")
                            if value:
                                user_inputs[var['Name']] = value
                                auto_filled_variables.add(var['Name'])
                                ColorMessage.write(f"  [OK] Auto-filled from smart recognition", 'success')
                                print()
                                continue
                    elif token_fill_strategy == "single" and target_token_variable:
                        # Only fill the target variable
                        if var['Name'] == target_token_variable['Name']:
                            if extracted_data.tokens:
                                value = get_value_for_input_type(input_type, extracted_data, "")
                                if value:
                                    user_inputs[var['Name']] = value
                                    auto_filled_variables.add(var['Name'])
                                    ColorMessage.write(f"  [OK] Auto-filled from smart recognition", 'success')
                                    print()
                                    continue

                # Auto-fill URL types
                if input_type == "Url" and extracted_data.api_urls and var_index > 0:
                    value = get_value_for_input_type(input_type, extracted_data, "")
                    if value:
                        user_inputs[var['Name']] = value
                        auto_filled_variables.add(var['Name'])
                        ColorMessage.write(f"  [OK] Auto-filled from smart recognition", 'success')
                        print()
                        continue

            # Build prompt based on whether we have existing value
            if existing_value:
                prompt = f"  Value (press Enter to keep current): "
            else:
                prompt = f"  Value: "

            user_input = input(prompt).strip()

            if user_input:
                # Smart recognition on first variable if input contains whitespace
                if var_index == 0 and smart_recognition_enabled and has_whitespace_in_middle(user_input):
                    ColorMessage.write("Multi-line input detected. Applying smart recognition...", 'info')
                    print()

                    extracted_data = extract_api_url_and_token(user_input)
                    display_extraction_results(extracted_data)

                    if extracted_data.has_data():
                        ColorMessage.write("Press Enter to continue with smart extraction, or type 'n' to use original input:", 'info')
                        confirm = input().strip().lower()

                        if confirm == 'n':
                            ColorMessage.write("Using original input...", 'info')
                            extracted_data = None
                        else:
                            ColorMessage.write("Continuing with smart extraction...", 'success')
                            print()

                            # Prompt for token fill strategy
                            if extracted_data.tokens:
                                token_variables = get_token_variables(config)
                                if len(token_variables) > 1:
                                    token_fill_strategy, target_token_variable = prompt_token_fill_strategy(token_variables)

                            # Use extracted value for current variable
                            value = get_value_for_input_type(input_type, extracted_data, user_input)
                            user_inputs[var_name] = value
                            ColorMessage.write(f"  [OK] Will set {display_name}", 'success')
                            print()
                            continue

                user_inputs[var_name] = user_input
                ColorMessage.write(f"  [OK] Will set {display_name}", 'success')
            elif existing_value:
                # If input is empty and we have existing value, use it
                user_inputs[var_name] = existing_value
                ColorMessage.write(f"  [OK] Keeping current value", 'success')
            else:
                ColorMessage.write(f"  [SKIP] Skipped", 'warning')

            print()

        if not user_inputs:
            ColorMessage.write("No values provided. Aborting.", 'warning')
            input("Press Enter to continue...")
            return

        # Generate script file name
        file_name = f"{command_prefix}{file_number}"

        # First, save secrets to encrypted storage BEFORE generating scripts
        if SECRET_MANAGER_AVAILABLE and user_inputs:
            ColorMessage.write("Saving secrets to encrypted storage...", 'info')
            print()

            # Get password once for all secrets (with confirmation)
            if not SECRET_MANAGER_AVAILABLE or _get_password is None:
                raise ImportError("Secret manager not available")
            
            encryption_password = None
            max_attempts = 3
            attempts = 0
            
            while attempts < max_attempts:
                ColorMessage.write("Enter encryption password for all secrets:", 'info')
                password1 = _get_password("[SECRET_MANAGER] Password: ")
                
                if not password1:
                    ColorMessage.write("No password provided, skipping encryption", 'warning')
                    break
                
                # Confirm password
                password2 = _get_password("[SECRET_MANAGER] Confirm Password: ")
                
                if password1 == password2:
                    encryption_password = password1
                    ColorMessage.write("Password confirmed.", 'success')
                    print()
                    break
                else:
                    attempts += 1
                    remaining = max_attempts - attempts
                    if remaining > 0:
                        ColorMessage.write("Passwords do not match. Please try again.", 'error')
                        ColorMessage.write(f"Remaining attempts: {remaining}", 'warning')
                        print()
                    else:
                        ColorMessage.write("Maximum attempts reached. Skipping encryption.", 'error')
                        print()
                        break
            
            if not encryption_password:
                ColorMessage.write("No password provided, skipping encryption", 'warning')
            else:
                saved_count = 0
                for var_name, var_value in user_inputs.items():
                    # Create key name with file number suffix
                    secret_key_name = f"{var_name}_{file_number}"

                    try:
                        # Pass the same password to all saves
                        if set_secret_key(secret_key_name, var_value, password=encryption_password):
                            ColorMessage.write(f"[OK] Saved {var_name} to encrypted storage", 'success')
                            saved_count += 1
                        else:
                            ColorMessage.write(f"[X] Failed to save {var_name}", 'warning')
                    except Exception as e:
                        ColorMessage.write(f"[X] Error saving {var_name}: {e}", 'warning')

                # Clear password from memory
                encryption_password = None

                print()
                if saved_count > 0:
                    ColorMessage.write(f"Saved {saved_count}/{len(user_inputs)} secrets to encrypted storage", 'success')
                    ColorMessage.write("Location: .secret_keys/already_encrypted/", 'info')
            print()

        script_paths = self._generate_scripts_for_config(config_name, file_number, show_next_steps=True)

        print()
        input("Press Enter to continue...")

    def _generate_scripts_for_config(self, config_name: str, file_number: int, show_next_steps: bool = True):
        """Generate Windows/Linux scripts for a configuration"""

        config = self.config_manager.get_config(config_name)
        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            return []

        command_prefix = config.get('CommandPrefix', config_name.lower().replace(' ', ''))
        file_name = f"{command_prefix}{file_number}"

        ColorMessage.write("Generating scripts...", 'info')
        print()

        script_paths = []
        success_count = 0

        # Generate Windows script
        ps_command = config.get('WindowsCommand', command_prefix)
        mcp_section = self.windows_generator.generate_mcp_section(
            command_prefix,
            config['DisplayName'],
            command_prefix,
            support_upgrade=True
        )

        windows_content = self.windows_generator.generate_command_content(
            config_name,
            command_prefix,
            ps_command,
            file_number,
            config['Variables'],
            mcp_section,
            f"{file_name}.ps1"
        )

        winenvs_dir = get_winenvs_dir()
        ensure_directory_exists(str(winenvs_dir))
        win_script_path = winenvs_dir / f"{file_name}.ps1"

        try:
            with open(win_script_path, 'w', encoding='utf-8') as f:
                f.write(windows_content)
            ColorMessage.write(f"[OK] Windows script: {win_script_path}", 'success')
            script_paths.append(win_script_path)
            success_count += 1
        except Exception as e:
            ColorMessage.write(f"[X] Failed to create Windows script: {e}", 'error')

        # Generate Linux script
        bash_command = config.get('LinuxCommand', command_prefix)
        linux_mcp_section = self.linux_generator.generate_mcp_section(
            command_prefix,
            config['DisplayName'],
            command_prefix,
            support_upgrade=True
        )

        linux_content = self.linux_generator.generate_command_content(
            config_name,
            command_prefix,
            bash_command,
            file_number,
            config['Variables'],
            linux_mcp_section,
            f"{file_name}.sh"
        )

        linuxenvs_dir = get_linuxenvs_dir()
        ensure_directory_exists(str(linuxenvs_dir))
        linux_script_path = linuxenvs_dir / f"{file_name}.sh"

        try:
            with open(linux_script_path, 'w', encoding='utf-8') as f:
                f.write(linux_content)

            # Always try to set execute permission (works on Linux/Mac, no-op on Windows)
            try:
                os.chmod(linux_script_path, 0o755)
            except Exception:
                pass

            # Try to create symlink on Linux/Mac
            if platform.system() != 'Windows':
                self._ensure_linux_symlink(linux_script_path)

            ColorMessage.write(f"[OK] Linux script: {linux_script_path}", 'success')
            script_paths.append(linux_script_path)
            success_count += 1
        except Exception as e:
            ColorMessage.write(f"[X] Failed to create Linux script: {e}", 'error')

        if success_count == 0:
            ColorMessage.write("No scripts were generated.", 'error')
            return script_paths

        if show_next_steps:
            print()
            ColorMessage.write("Script generation completed successfully!", 'success')
            ColorMessage.write("", 'info')
            ColorMessage.write("Next steps:", 'info')

            if SECRET_MANAGER_AVAILABLE:
                ColorMessage.write("1. Secrets are encrypted and saved automatically", 'success')
                ColorMessage.write("2. Scripts will load secrets from encrypted storage", 'info')
            else:
                ColorMessage.write("1. Use SecretManager to store environment variables securely", 'info')

            ColorMessage.write("3. Run the scripts:", 'info')
            for script_path in script_paths:
                ColorMessage.write(f"   {script_path}", 'info')

        return script_paths

    def _generate_symlink_script(self):
        """Generate a helper script to create symlinks on Linux"""
        linuxenvs_dir = get_linuxenvs_dir()
        script_path = linuxenvs_dir / "create_symlinks.sh"

        # Find all .sh scripts in linuxenvs directory
        sh_scripts = sorted(linuxenvs_dir.glob("*.sh"))
        if not sh_scripts:
            return

        # Build script content
        script_lines = [
            "#!/bin/bash",
            "# Auto-generated script to create symlinks for Linux environment scripts",
            "# This script should be run on Linux to create symlinks in /usr/local/bin",
            "",
            "set -e",
            "",
            "# Get script directory",
            "SCRIPT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\"",
            "",
            "echo \"Creating symlinks in /usr/local/bin...\"",
            "echo \"\"",
            "",
            "# Check if we need sudo",
            "if [ -w /usr/local/bin ]; then",
            "    USE_SUDO=\"\"",
            "else",
            "    USE_SUDO=\"sudo\"",
            "fi",
            "",
        ]

        # Add symlink commands for each script
        for script in sh_scripts:
            if script.name == "create_symlinks.sh":
                continue
            script_name = script.stem
            script_lines.append(f"# Link {script_name}")
            script_lines.append(f"$USE_SUDO chmod +x \"$SCRIPT_DIR/{script.name}\"")
            script_lines.append(f"$USE_SUDO ln -sf \"$SCRIPT_DIR/{script.name}\" /usr/local/bin/{script_name}")
            script_lines.append(f"echo \"[LINK] {script_name} -> $SCRIPT_DIR/{script.name}\"")
            script_lines.append("")

        script_lines.extend([
            "echo \"\"",
            "echo \"Symlinks created successfully!\"",
            "echo \"You can now run these commands from anywhere:\"",
            ""
        ])

        # Add command list
        for script in sh_scripts:
            if script.name != "create_symlinks.sh":
                script_lines.append(f"echo \"  {script.stem}\"")

        # Write script
        try:
            with open(script_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write('\n'.join(script_lines) + '\n')

            # Try to set execute permission
            try:
                os.chmod(script_path, 0o755)
            except Exception:
                pass

            ColorMessage.write(f"\n[CREATED] Symlink helper: {script_path}", 'success')
        except Exception as e:
            ColorMessage.write(f"[WARNING] Failed to create symlink helper script: {e}", 'warning')

    def _ensure_linux_symlink(self, script_path: Path):
        """Ensure /usr/local/bin links to the given script"""

        if platform.system() == 'Windows':
            return

        link_dir = Path('/usr/local/bin')
        link_path = link_dir / script_path.stem

        try:
            if not link_dir.exists():
                parent = link_dir.parent
                if parent.exists() and os.access(parent, os.W_OK):
                    link_dir.mkdir(parents=True, exist_ok=True)
                else:
                    subprocess.run(['sudo', 'mkdir', '-p', str(link_dir)], check=True)

            if os.access(link_dir, os.W_OK):
                os.chmod(script_path, os.stat(script_path).st_mode | stat.S_IEXEC)
                subprocess.run(['ln', '-sf', str(script_path), str(link_path)], check=True)
            else:
                subprocess.run(['sudo', 'chmod', '+x', str(script_path)], check=True)
                subprocess.run(['sudo', 'ln', '-sf', str(script_path), str(link_path)], check=True)

            ColorMessage.write(f"[LINK] {link_path} -> {script_path}", 'success')
        except Exception as e:
            ColorMessage.write(f"[LINK] Failed to update symlink for {script_path.name}: {e}", 'warning')

    def _collect_secret_file_numbers(self, config: dict) -> List[int]:
        """Collect file numbers from secret storage for a config"""

        numbers: Set[int] = set()
        directories = [
            (LOCAL_SECRET_MANAGER.raw_dir, False),
            (LOCAL_SECRET_MANAGER.encrypted_dir, True)
        ]

        var_names = [var['Name'] for var in config.get('Variables', [])]

        for var_name in var_names:
            prefix = f"{var_name}_"
            prefix_upper = prefix.upper()

            for directory, is_encrypted in directories:
                if not directory or not directory.exists():
                    continue

                for entry in directory.iterdir():
                    if not entry.is_file():
                        continue

                    name = entry.name
                    if is_encrypted and name.lower().endswith('.js'):
                        name = name[:-3]

                    if name.upper().startswith(prefix_upper):
                        suffix = name[len(prefix):]
                        if suffix.isdigit():
                            numbers.add(int(suffix))

        return sorted(numbers)

    def restore_scripts_from_secrets(self):
        """Restore winenvs/linuxenvs scripts based on stored secrets"""

        clear_screen()
        ColorMessage.write("Restore Scripts from Secret Storage", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        if not is_admin():
            ColorMessage.write("Administrator/root privileges are required to restore scripts.", 'error')
            input("Press Enter to continue...")
            return

        if not LOCAL_SECRET_MANAGER.secret_keys_dir.exists():
            ColorMessage.write("Secret storage directory not found.", 'error')
            input("Press Enter to continue...")
            return

        total_sets = 0
        for config_name, config in self.config_manager.get_all_configs().items():
            file_numbers = self._collect_secret_file_numbers(config)
            if not file_numbers:
                continue

            ColorMessage.write(
                f"{config['DisplayName']}: found versions {', '.join(str(n) for n in file_numbers)}",
                'info'
            )

            for number in file_numbers:
                ColorMessage.write(f"  Restoring #{number}...", 'info')
                script_paths = self._generate_scripts_for_config(config_name, number, show_next_steps=False)
                if script_paths:
                    total_sets += 1

            print()

        if total_sets == 0:
            ColorMessage.write("No matching secrets were found to restore scripts.", 'warning')
        else:
            ColorMessage.write(f"Restored {total_sets} script set(s) from secret storage.", 'success')

            # Generate symlink creation script for Linux
            self._generate_symlink_script()

            if platform.system() == 'Windows':
                ColorMessage.write("\nTo use Linux scripts, run this on Linux:", 'info')
                ColorMessage.write("  bash scripts/linuxenvs/create_symlinks.sh", 'info')
            else:
                ColorMessage.write("Linux commands were linked into /usr/local/bin.", 'info')

        print()
        input("Press Enter to continue...")

    def view_scripts(self, config_name: str):
        """View existing scripts for the specified configuration"""
        config = self.config_manager.get_config(config_name)
        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            input("Press Enter to continue...")
            return

        clear_screen()
        ColorMessage.write(f"View Scripts for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        # Get command prefix
        command_prefix = config.get('CommandPrefix', config.get('Common', ''))

        # List existing scripts
        scripts = self.list_existing_scripts(command_prefix)

        if not scripts:
            ColorMessage.write("No scripts found for this configuration.", 'warning')
            ColorMessage.write(f"Command prefix: {command_prefix}", 'info')
            ColorMessage.write("(Only showing scripts that exist on BOTH Windows and Linux platforms)", 'info')
            print()
            ColorMessage.write("Use 'Add Global Command' to create a new script.", 'info')
        else:
            ColorMessage.write(f"Found {len(scripts)} script pair(s) for {config['DisplayName']}:", 'success')
            ColorMessage.write("(Scripts exist on BOTH Windows and Linux platforms)", 'info')
            print()

            for i, script in enumerate(scripts, 1):
                ColorMessage.write(f"{i}. Script #{script['file_number']}", 'info')
                print()

                # Show Windows script info
                ColorMessage.write(f"   Windows: {script['windows_name']}", 'info')
                ColorMessage.write(f"   Path: {script['windows_path']}", 'info')
                try:
                    stat_info = script['windows_path'].stat()
                    size = stat_info.st_size
                    mtime = stat_info.st_mtime
                    mod_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                    ColorMessage.write(f"   Size: {size} bytes | Modified: {mod_time}", 'info')
                except Exception as e:
                    ColorMessage.write(f"   Error reading file info: {e}", 'warning')

                print()

                # Show Linux script info
                ColorMessage.write(f"   Linux: {script['linux_name']}", 'info')
                ColorMessage.write(f"   Path: {script['linux_path']}", 'info')
                try:
                    stat_info = script['linux_path'].stat()
                    size = stat_info.st_size
                    mtime = stat_info.st_mtime
                    mod_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                    ColorMessage.write(f"   Size: {size} bytes | Modified: {mod_time}", 'info')
                except Exception as e:
                    ColorMessage.write(f"   Error reading file info: {e}", 'warning')

                print()

            ColorMessage.write("Operations:", 'info')
            ColorMessage.write("  - To edit: Open the script file in your text editor", 'info')
            ColorMessage.write("  - To run: Execute the script from your terminal/shell", 'info')

        print()
        input("Press Enter to continue...")

    def restore_configuration(self, config_name: str):
        """Restore configuration from saved file"""
        config = self.config_manager.get_config(config_name)
        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            input("Press Enter to continue...")
            return

        clear_screen()
        ColorMessage.write(f"Restore Configuration for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        # List available backups
        backups = self.list_configuration_backups(config_name)

        if not backups:
            ColorMessage.write("No configuration backups found.", 'warning')
            ColorMessage.write(f"Backup directory: {self.backup_dir}", 'info')
            print()
            ColorMessage.write("Use 'Set Environment Variables' to create a configuration backup.", 'info')
            print()
            input("Press Enter to continue...")
            return

        ColorMessage.write(f"Found {len(backups)} backup(s):", 'success')
        print()

        # Display backups
        for i, backup in enumerate(backups, 1):
            ColorMessage.write(f"{i}. {backup['name']}", 'info')
            ColorMessage.write(f"   Timestamp: {backup['timestamp']}", 'info')
            ColorMessage.write(f"   Platform: {backup['platform']}", 'info')
            print()

        # Get user selection
        ColorMessage.write("Enter backup number to restore (or 0 to cancel): ", 'info', no_newline=True)
        try:
            choice = int(input().strip())
            if choice == 0:
                ColorMessage.write("Restore cancelled.", 'info')
                print()
                input("Press Enter to continue...")
                return

            if choice < 1 or choice > len(backups):
                ColorMessage.write("Invalid selection.", 'error')
                print()
                input("Press Enter to continue...")
                return

            selected_backup = backups[choice - 1]
        except ValueError:
            ColorMessage.write("Invalid input.", 'error')
            print()
            input("Press Enter to continue...")
            return

        # Load backup
        print()
        ColorMessage.write(f"Loading backup: {selected_backup['name']}", 'info')

        try:
            with open(selected_backup['path'], 'r', encoding='utf-8') as f:
                backup_data = json.load(f)

            env_vars = backup_data.get('environment_variables', {})

            if not env_vars:
                ColorMessage.write("No environment variables found in backup.", 'warning')
                print()
                input("Press Enter to continue...")
                return

            print()
            ColorMessage.write("Environment variables in backup:", 'info')
            for var_name, var_value in env_vars.items():
                ColorMessage.write(f"  {var_name}: ***hidden***", 'info')

            print()
            ColorMessage.write("Do you want to restore these variables? (y/N): ", 'warning', no_newline=True)
            confirm = input().strip().lower()

            if confirm != 'y':
                ColorMessage.write("Restore cancelled.", 'info')
                print()
                input("Press Enter to continue...")
                return

            # Restore variables to current session
            print()
            ColorMessage.write("Restoring environment variables...", 'info')

            for var_name, var_value in env_vars.items():
                os.environ[var_name] = var_value
                ColorMessage.write(f"[OK] Restored {var_name}", 'success')

            print()
            ColorMessage.write("Configuration restored successfully!", 'success')
            ColorMessage.write("Note: Variables are set in current session only.", 'warning')
            ColorMessage.write("Use 'Add Global Command' to make them permanent.", 'info')

        except Exception as e:
            ColorMessage.write(f"Error restoring configuration: {e}", 'error')
            traceback.print_exc()

        print()
        input("Press Enter to continue...")

    def set_environment_variables(self, config_name: str):
        """Set environment variables for the specified configuration"""
        config = self.config_manager.get_config(config_name)
        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            input("Press Enter to continue...")
            return

        clear_screen()
        ColorMessage.write(config['Title'], 'info')
        ColorMessage.write(config['Description'], 'info')
        ColorMessage.write("=" * len(config['Title']), 'info')
        print()

        if not is_admin():
            ColorMessage.write("This operation requires administrator/root privileges.", 'error')
            ColorMessage.write("Please run this script as administrator/root.", 'warning')
            input("Press any key to continue...")
            return

        ColorMessage.write("Current environment variable status:", 'info')
        for var in config['Variables']:
            value = os.environ.get(var['Name'])
            if value:
                ColorMessage.write(f"{var['DisplayName']}: {value}", 'success')
            else:
                ColorMessage.write(f"{var['DisplayName']}: [Not set]", 'warning')

        print()
        ColorMessage.write("Enter new values for each variable.", 'info')
        ColorMessage.write("Press Enter to skip or keep current value.", 'info')
        print()

        new_values = {}
        for var in config['Variables']:
            display_name = var['DisplayName']
            description = var.get('Description', '')
            current_value = os.environ.get(var['Name'], '')

            if description:
                ColorMessage.write(f"{display_name}: {description}", 'info')

            if current_value:
                prompt = f"{display_name} (current: ***hidden***): "
            else:
                prompt = f"{display_name} (not set): "

            user_input = input(prompt).strip()

            if user_input:
                new_values[var['Name']] = user_input
                ColorMessage.write(f"Will set {display_name}", 'success')
            elif current_value:
                ColorMessage.write(f"Keeping current value for {display_name}", 'info')
            else:
                ColorMessage.write(f"Skipping {display_name}", 'warning')

        if new_values:
            print()
            ColorMessage.write("Setting environment variables...", 'info')

            if platform.system() == 'Windows':
                ColorMessage.write("On Windows, you need to use WindowsPathFunction.ps1 to set system variables", 'warning')
                ColorMessage.write("For now, setting variables in current session only", 'info')

            for var_name, var_value in new_values.items():
                os.environ[var_name] = var_value
                ColorMessage.write(f"Set {var_name} in current session", 'success')

            print()
            ColorMessage.write("Environment variables updated in current session", 'success')
            ColorMessage.write("Note: These changes are temporary. Use 'Add Global Command' to make them permanent.", 'warning')

            # Save configuration backup
            try:
                backup_path = self.save_configuration_backup(config_name, new_values)
                ColorMessage.write(f"Configuration backup saved: {backup_path.name}", 'success')
            except Exception as e:
                ColorMessage.write(f"Warning: Failed to save backup: {e}", 'warning')
        else:
            ColorMessage.write("No changes made", 'info')

        print()
        input("Press Enter to continue...")

    def view_environment_variables(self, config_name: str):
        """View environment variables for the specified configuration"""
        config = self.config_manager.get_config(config_name)
        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            input("Press Enter to continue...")
            return

        clear_screen()
        ColorMessage.write(config['Title'], 'info')
        ColorMessage.write(config['Description'], 'info')
        ColorMessage.write("=" * len(config['Title']), 'info')
        print()

        for var in config['Variables']:
            value = os.environ.get(var['Name'])
            display_name = var['DisplayName']

            ColorMessage.write(f"{display_name}: ", 'info', no_newline=True)
            if value:
                ColorMessage.write(value, 'success')
            else:
                ColorMessage.write("[Not set]", 'warning')

        print()
        input("Press Enter to continue...")

    def show_all_environment_variables(self):
        """Show all environment variables for all configurations"""
        clear_screen()
        ColorMessage.write("All Environment Variables Status", 'info')
        ColorMessage.write("=" * 50, 'info')

        for config_name, config in self.config_manager.get_all_configs().items():
            print()
            ColorMessage.write(config['Title'], 'info')
            ColorMessage.write("-" * len(config['Title']), 'info')

            for var in config['Variables']:
                value = os.environ.get(var['Name'])
                if value:
                    ColorMessage.write(f"{var['DisplayName']}: {value}", 'success')
                else:
                    ColorMessage.write(f"{var['DisplayName']}: [Not set]", 'warning')

        print()
        input("Press Enter to continue...")

    def refresh_current_terminal_environment(self):
        """Refresh environment variables in current terminal"""
        clear_screen()
        ColorMessage.write("Refresh Current Terminal Environment", 'info')
        ColorMessage.write("=" * 50, 'info')
        ColorMessage.write("This will refresh all environment variables in the current terminal session.", 'info')
        ColorMessage.write("No system changes will be made - only current terminal will be updated.", 'info')
        print()

        if platform.system() == 'Windows':
            ColorMessage.write("On Windows, environment variables are refreshed automatically", 'success')
            ColorMessage.write("when you restart your terminal or use the Windows path function.", 'info')
        else:
            ColorMessage.write("On Linux, you may need to source your shell configuration:", 'info')
            ColorMessage.write("  source ~/.bashrc  (for bash)", 'success')
            ColorMessage.write("  source ~/.zshrc   (for zsh)", 'success')

        print()
        input("Press Enter to continue...")

    def add_scripts_to_path(self):
        """Add winenvs/liunenvs directories to system PATH"""
        clear_screen()
        ColorMessage.write("Add Scripts Directory to PATH", 'info')
        ColorMessage.write("=" * 80, 'info')
        print()

        if platform.system() == 'Windows':
            winenvs_dir = get_winenvs_dir()
            ColorMessage.write(f"Target directory: {winenvs_dir}", 'info')
            print()

            # Check if already in PATH
            current_path = os.environ.get('PATH', '')
            if str(winenvs_dir) in current_path:
                ColorMessage.write("winenvs directory is already in your PATH!", 'success')
                print()
                input("Press Enter to continue...")
                return

            ColorMessage.write("This will add the winenvs directory to your USER PATH.", 'info')
            ColorMessage.write("Note: Administrator privileges are NOT required for user PATH.", 'info')
            print()

            choice = input("Do you want to proceed? (y/N): ")
            if choice.lower() != 'y':
                ColorMessage.write("Operation cancelled", 'warning')
                print()
                input("Press Enter to continue...")
                return

            print()
            ColorMessage.write("Adding to PATH...", 'info')

            try:
                # Use PowerShell to modify user PATH
                ps_script = f"""
$currentUserPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
$newPath = '{winenvs_dir}'

if ($currentUserPath -notlike "*$newPath*") {{
    $updatedPath = $currentUserPath + ';' + $newPath
    [Environment]::SetEnvironmentVariable('PATH', $updatedPath, 'User')
    Write-Host '[SUCCESS] Added to PATH' -ForegroundColor Green
    Write-Host '[INFO] Please restart your terminal for changes to take effect' -ForegroundColor Yellow
}} else {{
    Write-Host '[INFO] Path already exists in PATH' -ForegroundColor Yellow
}}
"""
                result = subprocess.run(
                    ['powershell', '-Command', ps_script],
                    capture_output=True,
                    text=True
                )

                if result.returncode == 0:
                    ColorMessage.write(result.stdout, 'success')
                    ColorMessage.write("\nPATH updated successfully!", 'success')
                    ColorMessage.write("Please restart your terminal for changes to take effect.", 'warning')
                else:
                    ColorMessage.write(f"Error: {result.stderr}", 'error')

            except Exception as e:
                ColorMessage.write(f"Failed to update PATH: {e}", 'error')

        else:  # Linux
            linuxenvs_dir = get_linuxenvs_dir()
            ColorMessage.write(f"Target directory: {linuxenvs_dir}", 'info')
            print()

            # Check if scripts directory exists
            if not linuxenvs_dir.exists():
                ColorMessage.write(f"Scripts directory does not exist: {linuxenvs_dir}", 'error')
                print()
                input("Press Enter to continue...")
                return

            ColorMessage.write("This will create symbolic links in /usr/local/bin (requires sudo)", 'info')
            ColorMessage.write("This allows you to run scripts from anywhere without modifying PATH.", 'info')
            print()

            choice = input("Do you want to proceed? (y/N): ")
            if choice.lower() != 'y':
                ColorMessage.write("Operation cancelled", 'warning')
                print()
                input("Press Enter to continue...")
                return

            # Create symbolic links
            print()
            ColorMessage.write("Creating symbolic links...", 'info')
            success_count = 0
            failed_count = 0

            try:
                # Check if /usr/local/bin exists
                usr_local_bin = Path('/usr/local/bin')
                if not usr_local_bin.exists():
                    ColorMessage.write("/usr/local/bin does not exist, creating it...", 'warning')
                    subprocess.run(['sudo', 'mkdir', '-p', str(usr_local_bin)], check=True)

                # Create symbolic links for all shell scripts
                for script_file in linuxenvs_dir.iterdir():
                    if script_file.is_file() and script_file.suffix == '.sh':
                        link_name = script_file.stem
                        link_path = usr_local_bin / link_name

                        try:
                            ColorMessage.write(f"  {link_name} -> {script_file}", 'info')
                            subprocess.run(['sudo', 'ln', '-sf', str(script_file), str(link_path)], check=True)
                            # Make sure the original script is executable
                            subprocess.run(['sudo', 'chmod', '+x', str(script_file)], check=True)
                            success_count += 1
                        except Exception as e:
                            ColorMessage.write(f"  Failed: {link_name} - {e}", 'error')
                            failed_count += 1

                print()
                if success_count > 0:
                    ColorMessage.write(f"Successfully created {success_count} symbolic link(s)", 'success')
                if failed_count > 0:
                    ColorMessage.write(f"Failed to create {failed_count} symbolic link(s)", 'error')

            except Exception as e:
                ColorMessage.write(f"Failed to create symbolic links: {e}", 'error')

        print()
        input("Press Enter to continue...")


def main():
    """Main entry point"""
    clear_screen()

    # Check for admin privileges
    if not is_admin():
        ColorMessage.write("This script requires administrator/root privileges.", 'error')
        ColorMessage.write("Please run as administrator/root to manage system environment variables.", 'warning')
        input("Press any key to continue...")

    # Create and run manager
    manager = SpecialSoftwareEnvManager()
    manager.show_main_menu()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        ColorMessage.write("Program interrupted by user", 'warning')
        sys.exit(0)
    except Exception as e:
        ColorMessage.write(f"An error occurred: {e}", 'error')
        traceback.print_exc()
        input("Press Enter to exit...")
        sys.exit(1)
