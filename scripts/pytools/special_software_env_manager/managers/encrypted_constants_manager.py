#!/usr/bin/env python3
"""
Encrypted Constants Manager Module

Manages encrypted constants storage and retrieval from .secret_ignore directory.
"""

import re
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
                ColorMessage.write(f"  {display_name}: {existing_value}", 'info')
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
            ColorMessage.write("(Enter=keep current; Space=clear to Not set, confirm [N/y])", 'info')
        else:
            ColorMessage.write("(Press Enter to skip a variable)", 'info')
        print()

        existing_values = {}
        if mode == 'replace':
            ColorMessage.write("Current values:", 'info')
            ColorMessage.write("-" * 60, 'info')
            existing_values = self._load_existing_values(config, file_number)
            print()
            ColorMessage.write(
                "Enter new values (Enter=keep; Space=clear to Not set):",
                'info'
            )
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
        """Save values to .secret_ignore directory. Empty string clears to [Not set]."""
        if not self.raw_dir.exists():
            self.raw_dir.mkdir(parents=True, exist_ok=True)

        saved_count = 0
        cleared_count = 0
        for var_name, var_value in user_inputs.items():
            secret_key_name = f"{var_name}_{file_number}"
            secret_file = self.raw_dir / secret_key_name

            try:
                if var_value == "" or var_value is None:
                    if secret_file.exists():
                        secret_file.unlink()
                    ColorMessage.write(
                        f"[OK] Cleared {var_name} (#{file_number}) to [Not set]",
                        'success'
                    )
                    cleared_count += 1
                    continue

                safe_write_secret(secret_file, var_value)
                ColorMessage.write(f"[OK] Saved {var_name} (#{file_number}) to .secret_ignore", 'success')
                saved_count += 1
            except Exception as e:
                ColorMessage.write(f"[X] Error saving {var_name}: {e}", 'warning')

        if saved_count > 0:
            ColorMessage.write(f"Saved {saved_count}/{len(user_inputs)} encrypted constants to .secret_ignore", 'success')
            ColorMessage.write(f"Location: {self.raw_dir}", 'info')
            ColorMessage.write(f"File number: {file_number}", 'info')
        if cleared_count > 0:
            ColorMessage.write(f"Cleared {cleared_count} constant(s) to [Not set]", 'success')

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
                        ColorMessage.write(f" {value} (saved)", 'success')
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

    @staticmethod
    def _normalize_custom_key(key: str) -> Optional[str]:
        """Normalize an arbitrary custom KEY into a safe, env-var-style name.

        - Spaces and hyphens become underscores.
        - Any remaining filesystem/env-illegal characters are dropped.
        - A leading digit is prefixed with '_' (env vars cannot start with a digit).

        Returns the normalized key, or None if nothing usable remains.
        """
        candidate = key.strip().replace('-', '_').replace(' ', '_')
        candidate = re.sub(r'[^A-Za-z0-9_]', '', candidate)
        if not candidate:
            return None
        if candidate[0].isdigit():
            candidate = f"_{candidate}"
        return candidate

    def custom_add(self):
        """Add one or more custom KEY=VALUE secrets with an auto-incrementing index.

        The user may enter ANY key name. For each key we auto-detect existing
        ``{KEY}_N`` files in the .secret_ignore directory and save the new value
        under the next free index (``{KEY}_1``, ``{KEY}_2``, ``{KEY}_3`` ...), so
        previously saved values are never overwritten.
        """
        clear_screen()
        ColorMessage.write("Custom Add - Add Any Custom KEY", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()
        ColorMessage.write("Enter any custom KEY name and its value.", 'info')
        ColorMessage.write("The file name is auto-indexed (KEY_1, KEY_2, KEY_3 ...) so an", 'info')
        ColorMessage.write("existing value is never overwritten.", 'info')
        ColorMessage.write(f"Storage location: {self.raw_dir}", 'info')
        print()

        added_count = 0

        while True:
            raw_key = input("  Custom KEY name (press Enter to finish): ").strip()
            if not raw_key:
                break

            key = self._normalize_custom_key(raw_key)
            if key is None:
                ColorMessage.write("  [X] Invalid KEY. Use letters, digits, and underscores.", 'error')
                print()
                continue

            if key != raw_key:
                ColorMessage.write(f"  [i] KEY normalized to: {key}", 'warning')

            # Auto-detect existing entries and compute the next index for this key.
            existing_numbers = self.file_number_manager.list_existing_encrypted_constants([key])
            next_number = self.file_number_manager.get_next_encrypted_constant_number(key, [key])

            if existing_numbers:
                existing_str = ", ".join(f"{key}_{n}" for n in existing_numbers)
                ColorMessage.write(f"  [i] Existing: {existing_str}", 'info')
            ColorMessage.write(f"  [i] Will save as: {key}_{next_number}", 'success')

            value = input(f"  Value for {key}_{next_number}: ").strip()
            if not value:
                ColorMessage.write("  [SKIP] No value entered, skipped.", 'warning')
                print()
                continue

            self._save_to_secret_ignore({key: value}, next_number)
            added_count += 1
            print()

            again = input("  Add another custom KEY? (y/N): ").strip().lower()
            print()
            if again != 'y':
                break

        if added_count > 0:
            ColorMessage.write(f"Custom add complete. {added_count} secret(s) saved to .secret_ignore.", 'success')
        else:
            ColorMessage.write("No custom secrets were added.", 'warning')
        print()
        input("Press Enter to continue...")


__all__ = ['EncryptedConstantsManager']

