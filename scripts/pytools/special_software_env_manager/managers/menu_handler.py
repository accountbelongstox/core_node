#!/usr/bin/env python3
"""
Menu Handler Module

Handles menu display and navigation logic.
"""

import sys
from pathlib import Path
from typing import Dict, Any

from utils.common_utils import ColorMessage, show_menu, clear_screen
from config.config_manager import ConfigManager


class MenuHandler:
    """Handles menu display and navigation"""

    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager

    def get_full_config_name(self, action: str) -> str:
        """Get full config name from action"""
        for config_name, config in self.config_manager.get_all_configs().items():
            if config.get('Common') == action:
                return config_name
        return action

    def show_main_menu(self, handlers: Dict[str, Any]):
        """Display the main menu"""
        while True:
            clear_screen()
            script_path = Path(__file__).resolve()
            ColorMessage.write("=" * 80, 'info')
            ColorMessage.write("Special Software Environment Variables Manager", 'success')
            ColorMessage.write("=" * 80, 'info')
            ColorMessage.write(f"Script Location: {script_path}", 'info')
            ColorMessage.write(f"Working Directory: {Path.cwd()}", 'info')
            ColorMessage.write("=" * 80, 'info')
            print()

            # Custom Add is pinned as item #1 so it stays one keystroke away
            # regardless of how long the provider list below grows.
            menu_items = [
                {'Text': 'Custom Add (any KEY, auto-indexed)', 'Action': 'custom_add', 'HasSubMenu': False},
            ]

            for config_name, config in self.config_manager.get_all_configs().items():
                action = config['Common']
                menu_items.append({
                    'Text': config['DisplayName'],
                    'Action': action,
                    'HasSubMenu': True
                })

            menu_items.extend([
                {'Text': 'Regenerate All Scripts', 'Action': 'regenerate_all', 'HasSubMenu': False},
                {'Text': 'Restore Scripts from Secret Storage', 'Action': 'restore_scripts', 'HasSubMenu': False},
                {'Text': 'Add Scripts Directory to PATH', 'Action': 'addpath', 'HasSubMenu': False},
                {'Text': 'View All Environment Variables', 'Action': 'viewall', 'HasSubMenu': False},
                {'Text': 'Refresh Current Terminal Environment', 'Action': 'refresh', 'HasSubMenu': False},
                {'Text': 'Gitea Backup Management', 'Action': 'gitea_backup', 'HasSubMenu': False},
                {'Text': 'Back to dd.sh Main Menu', 'Action': 'back', 'HasSubMenu': False},
                {'Text': 'Exit', 'Action': 'exit', 'HasSubMenu': False}
            ])

            action = show_menu("Special Software Environment Variables Manager", menu_items)

            if action is None:
                continue

            if action == 'custom_add':
                handlers['encrypted_constants_manager'].custom_add()
            elif action == 'addpath':
                handlers['env_var_manager'].add_scripts_to_path()
            elif action == 'viewall':
                handlers['env_var_manager'].show_all_environment_variables(self.config_manager)
            elif action == 'refresh':
                handlers['env_var_manager'].refresh_current_terminal_environment()
            elif action == 'regenerate_all':
                handlers['script_manager'].regenerate_all_scripts(
                    self.config_manager, handlers.get('secret_manager_available', False)
                )
            elif action == 'restore_scripts':
                handlers['script_manager'].restore_scripts_from_secrets(
                    self.config_manager, handlers.get('secret_manager_available', False)
                )
            elif action == 'gitea_backup':
                self._run_gitea_backup_management()
            elif action == 'back':
                return
            elif action == 'exit':
                sys.exit(0)
            else:
                config_found = False
                for config_name, config in self.config_manager.get_all_configs().items():
                    if config.get('Common') == action:
                        config_found = True
                        self.show_submenu(action, handlers)
                        break

                if not config_found:
                    ColorMessage.write(f"Unknown action: {action}", 'error')
                    input("Press Enter to continue...")

    def show_submenu(self, action: str, handlers: Dict[str, Any]):
        """Show submenu for a specific configuration"""
        config_name = self.get_full_config_name(action)
        config = self.config_manager.get_config(config_name)

        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            input("Press Enter to continue...")
            return

        while True:
            display_name = config['DisplayName']
            command_prefix = config.get('CommandPrefix', '')
            storage_type = config.get('StorageType', 'environment_variable')
            has_command_prefix = bool(command_prefix)
            is_encrypted_constant = (storage_type == 'encrypted_constant')

            menu_items = []

            if is_encrypted_constant:
                menu_items.append({
                    'Text': f"Save {display_name} Encrypted Constants",
                    'Action': 'saveencrypted',
                    'HasSubMenu': False
                })
                menu_items.append({
                    'Text': f"View {display_name} Encrypted Constants",
                    'Action': 'viewencrypted',
                    'HasSubMenu': False
                })
            else:
                if has_command_prefix:
                    menu_items.append({
                        'Text': f"Add {display_name} Global Command",
                        'Action': 'addcommand',
                        'HasSubMenu': False
                    })
                else:
                    menu_items.append({
                        'Text': f"Save {display_name} Environment Variables",
                        'Action': 'saveenvvars',
                        'HasSubMenu': False
                    })

                menu_items.extend([
                    {
                        'Text': f"Set {display_name} Environment Variables",
                        'Action': 'setenvvars',
                        'HasSubMenu': False
                    },
                    {
                        'Text': f"View {display_name} Environment Variables",
                        'Action': 'viewenvvars',
                        'HasSubMenu': False
                    },
                ])

                if has_command_prefix:
                    menu_items.append({
                        'Text': f"View {display_name} Scripts",
                        'Action': 'viewscripts',
                        'HasSubMenu': False
                    })

            menu_items.extend([
                {'Text': 'Restore from Configuration', 'Action': 'restore', 'HasSubMenu': False},
                {'Text': 'Back to Main Menu', 'Action': 'back', 'HasSubMenu': False}
            ])

            submenu_action = show_menu(f"{display_name} Menu", menu_items)

            if submenu_action is None:
                continue

            if submenu_action == 'addcommand':
                handlers['command_handler'].add_global_command(config_name, config)
            elif submenu_action == 'saveencrypted':
                handlers['encrypted_constants_manager'].save_encrypted_constants(config_name, config)
            elif submenu_action == 'viewencrypted':
                handlers['encrypted_constants_manager'].view_encrypted_constants(config_name, config)
            elif submenu_action == 'saveenvvars':
                handlers['command_handler'].save_environment_variables_only(config_name, config)
            elif submenu_action == 'setenvvars':
                handlers['env_var_manager'].set_environment_variables(config_name, config)
            elif submenu_action == 'viewenvvars':
                handlers['env_var_manager'].view_environment_variables(config_name, config)
            elif submenu_action == 'viewscripts':
                handlers['script_manager'].view_scripts(config_name, config, handlers['file_number_manager'])
            elif submenu_action == 'restore':
                handlers['env_var_manager'].restore_configuration(config_name, config)
            elif submenu_action == 'back':
                return

    def _run_gitea_backup_management(self):
        """Run the Gitea backup management script"""
        import subprocess
        import os

        # Get the script directory (3 levels up from this file)
        script_dir = Path(__file__).resolve().parent.parent.parent.parent / 'shells' / 'linux' / 'menu_itemshells' / 'gitea_backup'
        backup_script = script_dir / 'backup_management_main.sh'

        if not backup_script.exists():
            ColorMessage.write(f"Backup script not found: {backup_script}", 'error')
            input("Press Enter to continue...")
            return

        try:
            # Run the backup management script
            ColorMessage.write("Starting Gitea Backup Management...", 'info')
            print()
            subprocess.run(['bash', str(backup_script)], check=False)
            print()
        except Exception as e:
            ColorMessage.write(f"Error running backup script: {str(e)}", 'error')
            input("Press Enter to continue...")


__all__ = ['MenuHandler']

