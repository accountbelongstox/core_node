#!/usr/bin/env python3
"""
Encrypted Constants Manager Module

Manages encrypted constants storage and retrieval from .secret_ignore directory.
"""

from typing import Dict, List, Any, Optional
from pathlib import Path

from utils.common_utils import ColorMessage, show_menu, clear_screen, safe_write_secret, safe_read_secret
from managers.file_number_manager import FileNumberManager
from managers.variable_input_handler import VariableInputHandler
from config.path_config import get_path_config


class EncryptedConstantsManager:
    """Manages encrypted constants storage and retrieval"""

    def __init__(self, project_root: Path, file_number_manager: FileNumberManager, variable_input_handler: VariableInputHandler):
        self.path_config = get_path_config(project_root)
        self.project_root = project_root
        self.file_number_manager = file_number_manager
        self.variable_input_handler = variable_input_handler
        self.raw_dir = self.path_config.raw_secret_dir

    def _select_file_number(self, config: Dict[str, Any]) -> tuple:
        """Select file number (create new or replace existing)"""
        var_names = [var['Name'] for var in config.get('Variables', [])]
        
        existing_numbers = self.file_number_manager.list_existing_encrypted_constants(var_names)
        next_file_number = self.file_number_manager.get_next_encrypted_constant_number(config.get('DisplayName', ''), var_names)

        config_name = config.get('DisplayName', '')
        menu_items = []
        menu_items.append({
            'Text': f"Create New {config_name} #{next_file_number}",
            'Action': f'create_{next_file_number}',
            'HasSubMenu': False
        })

        for file_num in sorted(existing_numbers, reverse=True):
            menu_items.append({
                'Text': f"Replace existing {config_name} #{file_num}",
                'Action': f'replace_{file_num}',
                'HasSubMenu': False
            })

        ColorMessage.write("Select action:", 'info')
        print()
        selected_action = show_menu("Encrypted Constants Selection", menu_items)

        if not selected_action:
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
            display_name = var['DisplayName']
            existing_value = self.variable_input_handler.load_existing_value_from_secrets(var_name, file_number)
            
            if existing_value:
                existing_values[var_name] = existing_value
                display_value = existing_value
                if len(display_value) > 70:
                    display_value = display_value[:67] + "..."
                ColorMessage.write(f"  {display_name}: {display_value}", 'info')
            else:
                ColorMessage.write(f"  {display_name}: [Not set]", 'warning')
        
        return existing_values

    def save_encrypted_constants(self, config_name: str, config: Dict[str, Any]):
        """Save encrypted constants to .secret_ignore directory"""
        clear_screen()
        ColorMessage.write(f"Save Encrypted Constants for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()
        ColorMessage.write("This configuration stores values as encrypted constants (not environment variables).", 'info')
        ColorMessage.write("Values will be saved to .secret_ignore directory.", 'info')
        print()

        mode, file_number = self._select_file_number(config)

        if mode is None or file_number is None:
            ColorMessage.write("Operation cancelled.", 'warning')
            input("Press Enter to continue...")
            return

        clear_screen()
        ColorMessage.write(f"Save Encrypted Constants for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()
        ColorMessage.write(f"Configuration: {config['DisplayName']}", 'info')
        ColorMessage.write(f"File Number: {file_number}", 'info')
        ColorMessage.write(f"Mode: {'Replace existing' if mode == 'replace' else 'Create new'}", 'info')
        print()

        ColorMessage.write("Enter values for encrypted constants:", 'info')
        if mode == 'replace':
            ColorMessage.write("(Press Enter to keep current value)", 'info')
        else:
            ColorMessage.write("(Press Enter to skip a variable)", 'info')
        print()

        existing_values = {}
        if mode == 'replace':
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

        self._save_to_secret_ignore(user_inputs, file_number)

        print()
        ColorMessage.write("Encrypted constants saved successfully!", 'success')
        ColorMessage.write("Note: These values are stored in .secret_ignore directory as encrypted constants.", 'info')
        print()
        input("Press Enter to continue...")

    def _save_to_secret_ignore(self, user_inputs: Dict[str, str], file_number: int):
        """Save values to .secret_ignore directory"""
        if not self.raw_dir.exists():
            self.raw_dir.mkdir(parents=True, exist_ok=True)

        saved_count = 0
        for var_name, var_value in user_inputs.items():
            secret_key_name = f"{var_name}_{file_number}"
            secret_file = self.raw_dir / secret_key_name

            try:
                safe_write_secret(secret_file, var_value)
                ColorMessage.write(f"[OK] Saved {var_name} (#{file_number}) to .secret_ignore", 'success')
                saved_count += 1
            except Exception as e:
                ColorMessage.write(f"[X] Error saving {var_name}: {e}", 'warning')

        if saved_count > 0:
            ColorMessage.write(f"Saved {saved_count}/{len(user_inputs)} encrypted constants to .secret_ignore", 'success')
            ColorMessage.write(f"Location: {self.raw_dir}", 'info')
            ColorMessage.write(f"File number: {file_number}", 'info')

    def view_encrypted_constants(self, config_name: str, config: Dict[str, Any]):
        """View encrypted constants from .secret_ignore directory"""
        clear_screen()
        ColorMessage.write(f"View Encrypted Constants for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        var_names = [var['Name'] for var in config.get('Variables', [])]
        existing_numbers = self.file_number_manager.list_existing_encrypted_constants(var_names)

        if not existing_numbers:
            ColorMessage.write("No encrypted constants found.", 'warning')
            ColorMessage.write("Use 'Save Encrypted Constants' to add values.", 'info')
            print()
            input("Press Enter to continue...")
            return

        menu_items = []
        for file_num in sorted(existing_numbers, reverse=True):
            menu_items.append({
                'Text': f"View {config['DisplayName']} #{file_num}",
                'Action': f'view_{file_num}',
                'HasSubMenu': False
            })

        ColorMessage.write("Select which version to view:", 'info')
        print()
        selected_action = show_menu("View Encrypted Constants", menu_items)

        if not selected_action or not selected_action.startswith('view_'):
            return

        file_number = int(selected_action.replace('view_', ''))

        clear_screen()
        ColorMessage.write(f"View Encrypted Constants for {config_name} (#{file_number})", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        ColorMessage.write(f"Reading from: {self.raw_dir}", 'info')
        ColorMessage.write(f"File number: {file_number}", 'info')
        print()

        found_count = 0
        for var in config['Variables']:
            display_name = var['DisplayName']
            var_name = var['Name']
            secret_key_name = f"{var_name}_{file_number}"
            secret_file = self.raw_dir / secret_key_name

            ColorMessage.write(f"{display_name}:", 'info', no_newline=True)
            if secret_file.exists():
                try:
                    value = safe_read_secret(secret_file).strip()
                    if value:
                        if len(value) > 8:
                            preview = value[:8] + "..."
                        else:
                            preview = "***"
                        ColorMessage.write(f" {preview} (saved)", 'success')
                        found_count += 1
                    else:
                        ColorMessage.write(" [Empty file]", 'warning')
                except Exception as e:
                    ColorMessage.write(f" [Error reading: {e}]", 'error')
            else:
                ColorMessage.write(" [Not set]", 'warning')

        print()
        if found_count > 0:
            ColorMessage.write(f"Found {found_count}/{len(config['Variables'])} encrypted constants", 'success')
        else:
            ColorMessage.write("No encrypted constants found for this version.", 'warning')

        print()
        input("Press Enter to continue...")


__all__ = ['EncryptedConstantsManager']

