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
                          get_winenvs_dir, get_linuxenvs_dir, ensure_directory_exists)
from config_manager import ConfigManager
from command_content_generator_windows import WindowsCommandContentGenerator
from command_content_generator_linux import LinuxCommandContentGenerator

# Import secret manager from pycore
try:
    from pyfoundations import get_secret_key, set_secret_key, get_all_secret_keys
    SECRET_MANAGER_AVAILABLE = True
except ImportError:
    SECRET_MANAGER_AVAILABLE = False
    ColorMessage.write("WARNING: Secret manager not available from pycore", 'warning')


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
            'openai': 'OpenAI',
            'ssh': 'SSH Connection'
        }

        # Configuration backup directory
        from common_utils import get_project_root
        self.backup_dir = get_project_root() / 'scripts' / 'pytools' / 'special_software_env_manager' / 'backups'
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def get_full_config_name(self, action: str) -> str:
        """Get full configuration name from action"""
        return self.action_to_config.get(action, action)

    def get_next_file_number(self, command_prefix: str) -> int:
        """Get the next available file number for a command prefix"""
        platform_type = get_platform_type()

        # Check both winenvs and liunxenvs directories
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
                {'Text': 'View All Environment Variables', 'Action': 'viewall', 'HasSubMenu': False},
                {'Text': 'Refresh Current Terminal Environment', 'Action': 'refresh', 'HasSubMenu': False},
                {'Text': 'Back to Main Menu', 'Action': 'back', 'HasSubMenu': False},
                {'Text': 'Exit', 'Action': 'exit', 'HasSubMenu': False}
            ])

            action = show_menu("Special Software Environment Variables Manager", menu_items)

            # Handle actions
            if action == 'viewall':
                self.show_all_environment_variables()
            elif action == 'refresh':
                self.refresh_current_terminal_environment()
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
        existing_scripts = self.list_existing_scripts(command_prefix)
        next_file_number = self.get_next_file_number(command_prefix)

        # Build selection menu
        ColorMessage.write(f"Configuration: {config['DisplayName']}", 'info')
        ColorMessage.write(f"Command Prefix: {command_prefix}", 'info')
        print()

        menu_items = []
        # First option: Create new
        menu_items.append({
            'Text': f"Create New {config['DisplayName']} #{next_file_number}",
            'Action': f'create_{next_file_number}',
            'HasSubMenu': False
        })

        # Other options: Replace existing (only show scripts that exist on both platforms)
        for script in existing_scripts:
            file_num = script['file_number']
            menu_items.append({
                'Text': f"Replace existing {config['DisplayName']} #{file_num} ({script['windows_name']} / {script['linux_name']})",
                'Action': f'replace_{file_num}',
                'HasSubMenu': False
            })

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
        ColorMessage.write("(Press Enter to skip a variable)", 'info')

        # Import smart recognition module
        from .smart_recognition import (
            has_whitespace_in_middle,
            extract_api_url_and_token,
            display_extraction_results,
            prompt_token_fill_strategy,
            get_token_variables,
            get_value_for_input_type
        )

        # Check if smart recognition is enabled
        smart_recognition_enabled = config.get('SmartRecognition', {}).get('Enabled', False)

        # Show smart recognition hint for first variable
        if smart_recognition_enabled and config.get('Variables'):
            print()
            ColorMessage.write("Note: Multi-line input is supported and will be intelligently parsed.", 'info')
            ColorMessage.write("If input contains spaces or line breaks, smart extraction will be applied.", 'info')
            ColorMessage.write("Subsequent variables may be auto-filled if both URL and Token are detected.", 'info')

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

            if description:
                ColorMessage.write(f"{display_name}:", 'info')
                ColorMessage.write(f"  {description}", 'info')

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

            if current_value:
                prompt = f"  Value (current: ***hidden***): "
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
                            user_inputs[var['Name']] = value
                            ColorMessage.write(f"  [OK] Will set {display_name}", 'success')
                            print()
                            continue

                user_inputs[var['Name']] = user_input
                ColorMessage.write(f"  [OK] Will set {display_name}", 'success')
            elif current_value:
                user_inputs[var['Name']] = current_value
                ColorMessage.write(f"  [OK] Using current value", 'info')
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

            # Get password once for all secrets
            from pyfoundations.secret_manager import _get_password
            ColorMessage.write("Enter encryption password for all secrets:", 'info')
            encryption_password = _get_password("[SECRET_MANAGER] Password: ")

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

        # Now generate and save scripts (after secrets are encrypted)
        ColorMessage.write("Generating scripts...", 'info')
        print()

        success_count = 0
        script_paths = []

        # Always generate Windows script
        ps_command = config.get('WindowsCommand', f'{command_prefix}')

        # Always generate MCP section (with file existence checks inside)
        mcp_section = self.windows_generator.generate_mcp_section(
            command_prefix,
            config['DisplayName'],
            command_prefix,
            support_upgrade=True
        )

        content = self.windows_generator.generate_command_content(
            config_name,
            command_prefix,
            ps_command,
            file_number,
            config['Variables'],
            mcp_section,
            f"{file_name}.ps1"
        )

        # Save Windows script
        winenvs_dir = get_winenvs_dir()
        ensure_directory_exists(str(winenvs_dir))
        win_script_path = winenvs_dir / f"{file_name}.ps1"

        try:
            with open(win_script_path, 'w', encoding='utf-8') as f:
                f.write(content)
            ColorMessage.write(f"[OK] Windows script: {win_script_path}", 'success')
            script_paths.append(win_script_path)
            success_count += 1
        except Exception as e:
            ColorMessage.write(f"[X] Failed to create Windows script: {e}", 'error')

        # Always generate Linux script
        bash_command = config.get('LinuxCommand', command_prefix)

        # Always generate MCP section for Linux (with file existence checks inside)
        linux_mcp_section = self.linux_generator.generate_mcp_section(
            command_prefix,
            config['DisplayName'],
            command_prefix,
            support_upgrade=True
        )

        content = self.linux_generator.generate_command_content(
            config_name,
            command_prefix,
            bash_command,
            file_number,
            config['Variables'],
            linux_mcp_section,
            f"{file_name}.sh"
        )

        # Save Linux script
        linuxenvs_dir = get_linuxenvs_dir()
        ensure_directory_exists(str(linuxenvs_dir))
        linux_script_path = linuxenvs_dir / f"{file_name}.sh"

        try:
            with open(linux_script_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # Make script executable on Linux
            if platform.system() != 'Windows':
                import stat
                os.chmod(linux_script_path, os.stat(linux_script_path).st_mode | stat.S_IEXEC)

            ColorMessage.write(f"[OK] Linux script: {linux_script_path}", 'success')
            script_paths.append(linux_script_path)
            success_count += 1
        except Exception as e:
            ColorMessage.write(f"[X] Failed to create Linux script: {e}", 'error')

        print()
        success = success_count > 0

        if success:
            ColorMessage.write("Script generation completed successfully!", 'success')
            ColorMessage.write("", 'info')

            ColorMessage.write("Next steps:", 'info')

            if SECRET_MANAGER_AVAILABLE:
                ColorMessage.write("1. Secrets are encrypted and saved automatically", 'success')
                ColorMessage.write("2. Scripts will load secrets from encrypted storage", 'info')
            else:
                ColorMessage.write("1. Use SecretManager to store environment variables securely", 'info')

            ColorMessage.write("3. Run the scripts:", 'info')
            for i, script_path in enumerate(script_paths):
                ColorMessage.write(f"   {script_path}", 'info')

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
                from datetime import datetime

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
            import traceback
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
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")
        sys.exit(1)
