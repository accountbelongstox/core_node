#!/usr/bin/env python3
"""
Command Handler Module

Handles global command creation and environment variable saving.
"""

import os
from typing import Dict, Any, Optional
from pathlib import Path

from utils.common_utils import (
    ColorMessage, clear_screen, is_admin, get_platform_type, show_menu
)
from utils.secret_manager import resolve_secret_value
from managers.file_number_manager import FileNumberManager
from managers.variable_input_handler import VariableInputHandler
from managers.script_manager import ScriptManager
from managers.environment_variable_manager import EnvironmentVariableManager


class CommandHandler:
    """Handles global command creation"""

    def __init__(
        self,
        file_number_manager: FileNumberManager,
        variable_input_handler: VariableInputHandler,
        script_manager: ScriptManager,
        env_var_manager: EnvironmentVariableManager,
        project_root: Path
    ):
        self.file_number_manager = file_number_manager
        self.variable_input_handler = variable_input_handler
        self.script_manager = script_manager
        self.env_var_manager = env_var_manager
        self.project_root = project_root

    def _prepare_config_info_for_display(self, config: dict, file_number: Optional[int] = None) -> dict:
        """Prepare configuration information for display in menu"""
        display_info = {}

        if 'Variables' in config and config['Variables']:
            variables = []
            for var in config['Variables']:
                var_info = var.copy()

                if file_number is not None:
                    var_name = var.get('Name', '')
                    secret_key_name = f"{var_name}_{file_number}"
                    encrypted_value = resolve_secret_value(secret_key_name)
                    if encrypted_value:
                        var_info['CurrentValue'] = encrypted_value

                variables.append(var_info)
            display_info['Variables'] = variables

        for key in ['SmartRecognition', 'MCPSupport', 'CommandPrefix', 'DisplayName']:
            if key in config:
                display_info[key] = config[key]

        return display_info

    def _select_file_number(self, config: Dict[str, Any], command_prefix: str) -> tuple:
        """Select file number (create new or replace existing)"""
        existing_scripts = self.file_number_manager.list_all_existing_scripts(command_prefix)
        next_file_number = self.file_number_manager.get_next_file_number(command_prefix)

        ColorMessage.write(f"Configuration: {config['DisplayName']}", 'info')
        ColorMessage.write(f"Command Prefix: {command_prefix}", 'info')
        print()

        menu_items = []

        config_info_new = self._prepare_config_info_for_display(config, file_number=None)
        menu_items.append({
            'Text': f"Create New {config['DisplayName']} #{next_file_number}",
            'Action': f'create_{next_file_number}',
            'HasSubMenu': False,
            'ConfigInfo': config_info_new
        })

        sorted_scripts = sorted(existing_scripts, key=lambda x: x['file_number'], reverse=True)
        for script in sorted_scripts:
            file_num = script['file_number']
            if script.get('exists_on_both', False):
                platform_info = f"{script['windows_name']} / {script['linux_name']}"
            elif script.get('windows_exists', False):
                platform_info = f"{script['windows_name']} (Windows only)"
            elif script.get('linux_exists', False):
                platform_info = f"{script['linux_name']} (Linux only)"
            else:
                platform_info = f"{script['windows_name']} / {script['linux_name']}"

            config_info_existing = self._prepare_config_info_for_display(config, file_number=file_num)

            menu_items.append({
                'Text': f"Replace existing {config['DisplayName']} #{file_num} ({platform_info})",
                'Action': f'replace_{file_num}',
                'HasSubMenu': False,
                'ConfigInfo': config_info_existing
            })

        if not menu_items:
            return 'create', next_file_number

        ColorMessage.write("Select action:", 'info')
        print()
        selected_action = show_menu("Script Selection", menu_items)

        if selected_action is None:
            return None, None

        if selected_action.startswith('create_'):
            mode = 'create'
            file_number = int(selected_action.replace('create_', ''))
        elif selected_action.startswith('replace_'):
            mode = 'replace'
            file_number = int(selected_action.replace('replace_', ''))
        else:
            mode = 'create'
            file_number = next_file_number

        return mode, file_number

    def _load_existing_values(self, config: Dict[str, Any], file_number: int) -> Dict[str, str]:
        """Load existing values for all variables"""
        existing_values = {}

        for var in config['Variables']:
            var_name = var['Name']
            display_name = var.get('DisplayName', var['Name'])
            existing_value = None

            secret_key_name = f"{var_name}_{file_number}"
            existing_value = resolve_secret_value(secret_key_name)

            if not existing_value:
                existing_value = os.environ.get(var_name, '')

            if existing_value:
                existing_values[var_name] = existing_value
                ColorMessage.write(f"  {display_name}: {existing_value}", 'info')
            else:
                ColorMessage.write(f"  {display_name}: [Not set]", 'warning')

        return existing_values

    def add_global_command(self, config_name: str, config: Dict[str, Any]):
        """Add a new global command for the specified configuration"""
        clear_screen()
        ColorMessage.write(f"Add Global Command for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')

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

        if get_platform_type() == 'windows' and not is_admin():
            ColorMessage.write("WARNING: Running without administrator privileges.", 'warning')
            ColorMessage.write("Generated scripts may require elevated privileges to set system variables.", 'warning')
            print()

        command_prefix = config.get('CommandPrefix', '')

        if not command_prefix:
            self.save_environment_variables_only(config_name, config)
            return

        mode, file_number = self._select_file_number(config, command_prefix)

        if mode is None or file_number is None:
            ColorMessage.write("Operation cancelled.", 'info')
            print()
            input("Press Enter to continue...")
            return

        clear_screen()
        ColorMessage.write(f"Add Global Command for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()
        ColorMessage.write(f"Configuration: {config['DisplayName']}", 'info')
        ColorMessage.write(f"Command Prefix: {command_prefix}", 'info')
        ColorMessage.write(f"File Number: {file_number}", 'info')
        ColorMessage.write(f"Mode: {'Replace existing' if mode == 'replace' else 'Create new'}", 'info')
        print()

        ColorMessage.write("Enter values for environment variables:", 'info')
        if mode == 'replace':
            ColorMessage.write("(Press Enter to keep current value)", 'info')
        else:
            ColorMessage.write("(Press Enter to skip a variable)", 'info')

        smart_recognition_enabled = config.get('SmartRecognition', {}).get('Enabled', False)

        if smart_recognition_enabled and config.get('Variables'):
            print()
            ColorMessage.write("Note: Multi-line input is supported and will be intelligently parsed.", 'info')
            ColorMessage.write("If input contains spaces or line breaks, smart extraction will be applied.", 'info')
            ColorMessage.write("Subsequent variables may be auto-filled if both URL and Token are detected.", 'info')

        print()

        existing_values = {}
        if mode == 'replace' and file_number is not None:
            ColorMessage.write("Current values:", 'info')
            ColorMessage.write("-" * 60, 'info')
            existing_values = self._load_existing_values(config, file_number)
            print()
            ColorMessage.write("Enter new values (press Enter to keep current value):", 'info')
            print()

        user_inputs = self.variable_input_handler.collect_variable_inputs(
            config=config,
            file_number=file_number,
            mode=mode,
            existing_values=existing_values
        )

        if not user_inputs:
            ColorMessage.write("No values provided. Aborting.", 'warning')
            input("Press Enter to continue...")
            return

        self.env_var_manager.save_environment_variables_only(
            config_name, config, file_number, user_inputs
        )

        script_paths = self.script_manager.generate_scripts_for_config(
            config_name, config, file_number, show_next_steps=True,
            secret_manager_available=True
        )

        # Auto-rewrite ALL scripts of this type when UseV4Launcher is set.
        # Every add/replace triggers a full regeneration so all numbered
        # scripts stay in sync with the v4 template (team + ultracode).
        if config.get('UseV4Launcher', False):
            print()
            ColorMessage.write("Regenerating ALL launcher scripts for this config type (v4)...", 'info')
            total = self.script_manager.regenerate_all_v4_launchers_for_config(
                config_name, config
            )
            if total > 0:
                ColorMessage.write(
                    f"[OK] Regenerated {total} v4 launcher script set(s) for {config_name}.",
                    'success'
                )
            else:
                ColorMessage.write(
                    "No secret file sets found; only the current script was generated.",
                    'warning'
                )

        print()
        input("Press Enter to continue...")

    def save_environment_variables_only(self, config_name: str, config: Dict[str, Any]):
        """Save environment variables to encrypted storage only (no script generation)"""
        clear_screen()
        ColorMessage.write(f"Save Environment Variables for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()
        ColorMessage.write("This configuration only saves encrypted content (no script generation).", 'info')
        print()

        ColorMessage.write("Enter values for environment variables:", 'info')
        print()

        user_inputs = self.variable_input_handler.collect_variable_inputs(
            config=config,
            file_number=1,
            mode='create',
            existing_values={}
        )

        if not user_inputs:
            ColorMessage.write("No values provided. Aborting.", 'warning')
            input("Press Enter to continue...")
            return

        self.env_var_manager.save_environment_variables_only(
            config_name, config, 1, user_inputs
        )

        print()
        ColorMessage.write("Environment variables saved successfully!", 'success')
        ColorMessage.write("Note: These values are stored in encrypted storage only.", 'info')
        print()
        input("Press Enter to continue...")


__all__ = ['CommandHandler']

