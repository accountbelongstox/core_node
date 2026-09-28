#!/usr/bin/env python3
"""
Variable Input Handler Module

Handles user input for configuration variables with support for:
- Menu selection (for app names)
- Text input
- Smart recognition
- Existing value preservation
- Clear to Not set (single space + N/y confirm, only when already set)
"""

from typing import List, Dict, Any, Optional
import os

from utils.common_utils import ColorMessage, show_menu
from utils.secret_manager import resolve_secret_value
from managers.app_scanner import AppScanner
from utils.smart_recognition import (
    has_whitespace_in_middle,
    extract_api_url_and_token,
    display_extraction_results,
    prompt_token_fill_strategy,
    get_token_variables,
    get_value_for_input_type
)


# Empty string in collect/save maps means clear secret to [Not set].
CLEAR_TO_NOT_SET = ""


class VariableInputHandler:
    """Handles user input for configuration variables"""

    def __init__(self, app_scanner: AppScanner, project_root):
        self.app_scanner = app_scanner
        self.project_root = project_root

    def prompt_menu_selection(self, display_name: str, description: str, options: List[str], existing_value: str = None) -> str:
        """Prompt user to select from menu options"""
        if not options:
            ColorMessage.write(f"No options available for {display_name}", 'warning')
            return input(f"  Value: ").strip()

        ColorMessage.write(f"{display_name}:", 'info')
        if description:
            ColorMessage.write(f"  {description}", 'info')
        print()

        menu_items = []
        for option in options:
            menu_items.append({
                'Text': option,
                'Action': option,
                'HasSubMenu': False
            })

        selected = show_menu(f"Select {display_name}", menu_items)

        if selected:
            ColorMessage.write(f"  [OK] Selected: {selected}", 'success')
            return selected

        if existing_value:
            ColorMessage.write(f"  [OK] Keeping current value: {existing_value}", 'success')
            return existing_value

        return ""

    def load_existing_value_from_secrets(self, var_name: str, file_number: int) -> Optional[str]:
        """Load existing value from .secret_ignore directory"""
        secret_key_name = f"{var_name}_{file_number}"
        return resolve_secret_value(secret_key_name)

    def read_value_with_keep_or_clear(
        self,
        display_name: str,
        existing_value: Optional[str] = None,
        prompt: Optional[str] = None,
    ) -> Optional[str]:
        """
        Shared text prompt: Enter keeps current; single space clears (N/y once).

        Only when ``existing_value`` is set:
          - Enter -> keep current
          - exactly one space -> confirm Clear to [Not set]? [N/y]
        When not set: Enter skips; space is ignored as empty.

        Returns:
            None — skip (no existing, empty Enter)
            existing value — keep
            CLEAR_TO_NOT_SET ("") — clear to Not set
            str — new value
        """
        has_existing = bool(existing_value)
        if prompt is None:
            if has_existing:
                prompt = (
                    f"  Value (Enter=keep current; Space=clear to Not set): "
                )
            else:
                prompt = f"  Value: "

        raw = input(prompt)
        # Do not strip before detecting the clear gesture (exactly one space).
        if has_existing and raw == " ":
            ColorMessage.write(
                f"  Clear {display_name} to [Not set]? [N/y]: ",
                'warning',
                no_newline=True,
            )
            confirm = input().strip().lower()
            if confirm == "y":
                ColorMessage.write(f"  [OK] Will clear {display_name} to [Not set]", 'success')
                return CLEAR_TO_NOT_SET
            ColorMessage.write(f"  [OK] Keeping current value", 'success')
            return existing_value

        user_input = raw.strip()
        if user_input:
            return user_input
        if has_existing:
            ColorMessage.write(f"  [OK] Keeping current value", 'success')
            return existing_value
        ColorMessage.write(f"  [SKIP] Skipped", 'warning')
        return None

    def prompt_variable_value(
        self,
        var: Dict[str, Any],
        existing_value: Optional[str] = None,
        mode: str = 'create',
        var_index: int = 0,
        config: Dict[str, Any] = None,
        extracted_data=None,
        token_fill_strategy=None,
        target_token_variable=None,
        auto_filled_variables: set = None
    ) -> Optional[str]:
        """
        Prompt user for a single variable value

        Returns:
            User input value, existing value if kept, "" if cleared, or None if skipped
        """
        if auto_filled_variables is None:
            auto_filled_variables = set()

        var_name = var.get('Name', '')
        display_name = var.get('DisplayName', var_name)
        description = var.get('Description', '')
        input_type = var.get('InputType', 'Text')

        # Check if this is a menu selection type
        menu_options = self.app_scanner.get_menu_options_for_input_type(input_type)
        if menu_options:
            return self.prompt_menu_selection(display_name, description, menu_options, existing_value)

        # Text input
        if description:
            ColorMessage.write(f"{display_name}:", 'info')
            ColorMessage.write(f"  {description}", 'info')

        hints = var.get('Hints') or []
        if hints:
            ColorMessage.write("  URL hints:", 'info')
            for hint in hints:
                label = hint.get('Label', '')
                value = hint.get('Value', '')
                if label and value:
                    ColorMessage.write(f"    [{label}] {value}", 'success')

        user_input = self.read_value_with_keep_or_clear(display_name, existing_value)

        # Cleared / kept / skipped — no smart recognition
        if user_input is None:
            return None
        if user_input == CLEAR_TO_NOT_SET:
            return CLEAR_TO_NOT_SET
        if existing_value and user_input == existing_value:
            return existing_value

        # Smart recognition handling
        if user_input and config:
            smart_recognition_enabled = config.get('SmartRecognition', {}).get('Enabled', False)
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

                        if extracted_data.tokens:
                            token_variables = get_token_variables(config)
                            if len(token_variables) > 1:
                                token_fill_strategy, target_token_variable = prompt_token_fill_strategy(token_variables)

                        value = get_value_for_input_type(input_type, extracted_data, user_input)
                        ColorMessage.write(f"  [OK] Will set {display_name}", 'success')
                        return value

        ColorMessage.write(f"  [OK] Will set {display_name}", 'success')
        return user_input

    def collect_variable_inputs(
        self,
        config: Dict[str, Any],
        file_number: int,
        mode: str = 'create',
        existing_values: Dict[str, str] = None
    ) -> Dict[str, str]:
        """
        Collect user inputs for all variables in a configuration

        Returns:
            Dictionary mapping variable names to their values.
            Empty string value means clear to [Not set].
        """
        if existing_values is None:
            existing_values = {}

        user_inputs = {}
        extracted_data = None
        token_fill_strategy = None
        target_token_variable = None
        auto_filled_variables = set()

        for var_index, var in enumerate(config.get('Variables', [])):
            var_name = var.get('Name', '')
            input_type = var.get('InputType', 'Text')

            # Get existing value
            existing_value = existing_values.get(var_name)
            if not existing_value:
                existing_value = self.load_existing_value_from_secrets(var_name, file_number)
            if not existing_value and mode != 'replace':
                existing_value = os.environ.get(var_name, '')

            # Auto-fill logic for smart recognition
            if extracted_data and extracted_data.has_data():
                if input_type == "Token" and token_fill_strategy:
                    if token_fill_strategy == "all":
                        if extracted_data.tokens:
                            value = get_value_for_input_type(input_type, extracted_data, "")
                            if value:
                                user_inputs[var_name] = value
                                auto_filled_variables.add(var_name)
                                ColorMessage.write(f"  [OK] Auto-filled from smart recognition", 'success')
                                print()
                                continue
                    elif token_fill_strategy == "single" and target_token_variable:
                        if var_name == target_token_variable['Name']:
                            if extracted_data.tokens:
                                value = get_value_for_input_type(input_type, extracted_data, "")
                                if value:
                                    user_inputs[var_name] = value
                                    auto_filled_variables.add(var_name)
                                    ColorMessage.write(f"  [OK] Auto-filled from smart recognition", 'success')
                                    print()
                                    continue

                if input_type == "Url" and extracted_data.api_urls and var_index > 0:
                    value = get_value_for_input_type(input_type, extracted_data, "")
                    if value:
                        user_inputs[var_name] = value
                        auto_filled_variables.add(var_name)
                        ColorMessage.write(f"  [OK] Auto-filled from smart recognition", 'success')
                        print()
                        continue

            # Prompt for value (None = skip; "" = clear; other = set/keep)
            value = self.prompt_variable_value(
                var=var,
                existing_value=existing_value,
                mode=mode,
                var_index=var_index,
                config=config,
                extracted_data=extracted_data,
                token_fill_strategy=token_fill_strategy,
                target_token_variable=target_token_variable,
                auto_filled_variables=auto_filled_variables
            )

            if value is not None:
                user_inputs[var_name] = value
                # Update extracted_data if smart recognition was used
                if var_index == 0 and value and value != existing_value:
                    input_type = var.get('InputType', 'Text')
                    if has_whitespace_in_middle(str(value)):
                        extracted_data = extract_api_url_and_token(str(value))
                        if extracted_data and extracted_data.has_data():
                            if extracted_data.tokens:
                                token_variables = get_token_variables(config)
                                if len(token_variables) > 1:
                                    token_fill_strategy, target_token_variable = prompt_token_fill_strategy(token_variables)

            print()

        return user_inputs


__all__ = ['VariableInputHandler', 'CLEAR_TO_NOT_SET']
