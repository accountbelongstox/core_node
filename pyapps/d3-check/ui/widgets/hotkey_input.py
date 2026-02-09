#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hotkey Input Widget
A specialized input widget for capturing keyboard shortcuts
"""

import tkinter as tk
from tkinter import ttk
from ..unified_styles import UnifiedStyles
from d3utils.i18n_manager import i18n_manager


class HotkeyInput(tk.Entry):
    """
    Hotkey input widget that captures keyboard shortcuts

    Features:
    - Captures single keys (A, F1, Space, etc.)
    - Captures combination keys (Ctrl+A, Shift+F1, Ctrl+Shift+F2, etc.)
    - Displays captured hotkey in a user-friendly format
    - Supports clearing hotkey (Escape or Delete)
    - Read-only display, only accepts keyboard input through key capture
    - Internationalized key names
    """

    # Key name mapping for special keys
    # Maps tkinter key names to i18n lookup keys
    KEY_NAME_I18N_MAP = {
        'Control_L': 'ctrl',
        'Control_R': 'ctrl',
        'Shift_L': 'shift',
        'Shift_R': 'shift',
        'Alt_L': 'alt',
        'Alt_R': 'alt',
        'Win_L': 'win',
        'Win_R': 'win',
        'space': 'space',
        'Return': 'enter',
        'BackSpace': 'backspace',
        'Tab': 'tab',
        'Escape': 'esc',
        'Delete': 'del',
        'Insert': 'ins',
        'Home': 'home',
        'End': 'end',
        'Prior': 'pageup',
        'Next': 'pagedown',
        'Up': 'up',
        'Down': 'down',
        'Left': 'left',
        'Right': 'right'
    }

    def __init__(self, parent, initial_value="", on_change=None, **kwargs):
        """
        Initialize hotkey input widget

        Args:
            parent: Parent widget
            initial_value: Initial hotkey value
            on_change: Callback function when hotkey changes (receives hotkey string)
            **kwargs: Additional Entry widget arguments
        """
        # Set default styling
        default_kwargs = {
            'bg': UnifiedStyles.COLORS['input_bg'],
            'fg': UnifiedStyles.COLORS['input_text'],
            'font': UnifiedStyles.FONTS['input'],
            'relief': tk.RIDGE,
            'bd': 1
        }
        default_kwargs.update(kwargs)

        super().__init__(parent, **default_kwargs)

        # Store the styling for later use
        self.style_config = default_kwargs.copy()

        self.on_change = on_change
        self.current_hotkey = initial_value
        self.pressed_modifiers = set()
        self.is_capturing = False

        # Display initial value
        if initial_value:
            self._display_hotkey(initial_value)
        else:
            self._set_placeholder()

        # Make read-only except for key capture and force high contrast styling
        self.config(state='readonly')

        # Force apply high contrast styling after all initialization
        self._apply_high_contrast_styling()

        # Use after() to force apply styling after Tkinter finishes initialization
        self.after(1, self._force_final_styling)

        # Bind events
        self.bind('<FocusIn>', self._on_focus_in)
        self.bind('<FocusOut>', self._on_focus_out)
        self.bind('<KeyPress>', self._on_key_press)
        self.bind('<KeyRelease>', self._on_key_release)

    def _apply_high_contrast_styling(self):
        """Apply high contrast styling to the widget"""
        try:
            # Force apply high contrast styling with enhanced visibility
            # Use both normal and disabled colors to ensure visibility in all states
            self.config(
                bg=UnifiedStyles.COLORS['input_bg'],
                fg=UnifiedStyles.COLORS['input_text'],
                disabledbackground=UnifiedStyles.COLORS['input_bg'],
                disabledforeground=UnifiedStyles.COLORS['input_text'],
                readonlybackground=UnifiedStyles.COLORS['input_bg'],
                selectbackground=UnifiedStyles.COLORS['accent'],
                selectforeground=UnifiedStyles.COLORS['text_primary'],
                insertbackground=UnifiedStyles.COLORS['text_primary'],
                relief=tk.SOLID,
                bd=1,
                highlightbackground=UnifiedStyles.COLORS['input_border'],
                highlightcolor=UnifiedStyles.COLORS['accent'],
                highlightthickness=1,
                state='readonly'
            )
        except Exception:
            # Fallback to basic high contrast styling
            self.config(
                bg=UnifiedStyles.COLORS['input_bg'],
                fg=UnifiedStyles.COLORS['input_text'],
                disabledbackground=UnifiedStyles.COLORS['input_bg'],
                disabledforeground=UnifiedStyles.COLORS['input_text'],
                relief=tk.SOLID,
                bd=1,
                highlightbackground=UnifiedStyles.COLORS['input_border'],
                highlightcolor=UnifiedStyles.COLORS['accent'],
                highlightthickness=1,
                state='readonly'
            )

        # Register for language change events
        i18n_manager.add_language_change_listener(self._on_language_changed)

    def _force_final_styling(self):
        """Force apply final high contrast styling after Tkinter initialization"""
        try:
            # This is called after Tkinter finishes all initialization
            # Force override any system-applied styles
            current_state = str(self['state'])
            self.config(state='normal')  # Temporarily enable to allow style changes

            # Apply all high contrast styles with subtle borders
            self.config(
                bg=UnifiedStyles.COLORS['input_bg'],
                fg=UnifiedStyles.COLORS['input_text'] if self.current_hotkey else UnifiedStyles.COLORS['text_secondary'],
                disabledbackground=UnifiedStyles.COLORS['input_bg'],
                disabledforeground=UnifiedStyles.COLORS['input_text'],
                readonlybackground=UnifiedStyles.COLORS['input_bg'],
                selectbackground=UnifiedStyles.COLORS['accent'],
                selectforeground=UnifiedStyles.COLORS['text_primary'],
                insertbackground=UnifiedStyles.COLORS['text_primary'],
                relief=tk.SOLID,
                bd=1,
                highlightbackground=UnifiedStyles.COLORS['input_border'],
                highlightcolor=UnifiedStyles.COLORS['accent'],
                highlightthickness=1
            )

            # Restore original state
            self.config(state=current_state)
        except Exception:
            pass  # Ignore any errors

    def _get_key_name(self, i18n_key):
        """Get internationalized key name"""
        return i18n_manager.get_ui_text(f"hotkey_input.keys.{i18n_key}")

    def _set_placeholder(self):
        """Set placeholder text with high contrast styling"""
        self.config(state='normal')
        self.delete(0, tk.END)
        placeholder_text = i18n_manager.get_ui_text("hotkey_input.placeholder")
        self.insert(0, placeholder_text)
        self.config(state='readonly')
        # Force apply high contrast styling with placeholder-specific colors (subtle borders)
        self.config(
            bg=UnifiedStyles.COLORS['input_bg'],
            fg=UnifiedStyles.COLORS['text_secondary'],
            disabledbackground=UnifiedStyles.COLORS['input_bg'],
            disabledforeground=UnifiedStyles.COLORS['text_secondary'],
            readonlybackground=UnifiedStyles.COLORS['input_bg'],
            selectbackground=UnifiedStyles.COLORS['accent'],
            selectforeground=UnifiedStyles.COLORS['text_primary'],
            insertbackground=UnifiedStyles.COLORS['text_primary'],
            relief=tk.SOLID,
            bd=1,
            highlightbackground=UnifiedStyles.COLORS['input_border'],
            highlightcolor=UnifiedStyles.COLORS['accent'],
            highlightthickness=1,
            state='readonly'
        )

    def _display_hotkey(self, hotkey):
        """Display hotkey in the entry with high contrast styling"""
        self.config(state='normal')
        self.delete(0, tk.END)
        self.insert(0, hotkey)
        self.config(state='readonly')
        # Force apply high contrast styling with normal text colors (subtle borders)
        self.config(
            bg=UnifiedStyles.COLORS['input_bg'],
            fg=UnifiedStyles.COLORS['input_text'],
            disabledbackground=UnifiedStyles.COLORS['input_bg'],
            disabledforeground=UnifiedStyles.COLORS['input_text'],
            readonlybackground=UnifiedStyles.COLORS['input_bg'],
            selectbackground=UnifiedStyles.COLORS['accent'],
            selectforeground=UnifiedStyles.COLORS['text_primary'],
            insertbackground=UnifiedStyles.COLORS['text_primary'],
            relief=tk.SOLID,
            bd=1,
            highlightbackground=UnifiedStyles.COLORS['input_border'],
            highlightcolor=UnifiedStyles.COLORS['accent'],
            highlightthickness=1,
            state='readonly'
        )

    def _on_focus_in(self, event):
        """Handle focus in event with enhanced high contrast"""
        self.is_capturing = True
        self.pressed_modifiers.clear()

        # Apply enhanced focus styling for high contrast (highlight border)
        self.config(
            bg=UnifiedStyles.COLORS['input_bg'],
            fg=UnifiedStyles.COLORS['input_text'],
            selectbackground=UnifiedStyles.COLORS['accent'],
            selectforeground=UnifiedStyles.COLORS['text_primary'],
            insertbackground=UnifiedStyles.COLORS['text_primary'],
            relief=tk.SOLID,
            bd=1,
            highlightbackground=UnifiedStyles.COLORS['accent'],
            highlightcolor=UnifiedStyles.COLORS['accent'],
            highlightthickness=1,
            state='readonly'
        )

        # Clear placeholder if present
        current_value = self.get()
        placeholder_text = i18n_manager.get_ui_text("hotkey_input.placeholder")
        if current_value == placeholder_text:
            self.config(state='normal')
            self.delete(0, tk.END)
            self.config(state='readonly')

    def _on_focus_out(self, event):
        """Handle focus out event with normal high contrast"""
        self.is_capturing = False
        self.pressed_modifiers.clear()

        # Apply normal high contrast styling when not focused (normal border)
        self.config(
            bg=UnifiedStyles.COLORS['input_bg'],
            fg=UnifiedStyles.COLORS['input_text'],
            selectbackground=UnifiedStyles.COLORS['accent'],
            selectforeground=UnifiedStyles.COLORS['text_primary'],
            insertbackground=UnifiedStyles.COLORS['text_primary'],
            relief=tk.SOLID,
            bd=1,
            highlightbackground=UnifiedStyles.COLORS['input_border'],
            highlightcolor=UnifiedStyles.COLORS['accent'],
            highlightthickness=1,
            state='readonly'
        )

        # Restore placeholder if empty
        if not self.current_hotkey:
            self._set_placeholder()

    def _normalize_key_name(self, key):
        """Normalize key name to user-friendly format with i18n"""
        # Use i18n mapping if available
        if key in self.KEY_NAME_I18N_MAP:
            i18n_key = self.KEY_NAME_I18N_MAP[key]
            return self._get_key_name(i18n_key)

        # Function keys
        if key.startswith('F') and key[1:].isdigit():
            return key.upper()

        # Single character keys - capitalize
        if len(key) == 1:
            return key.upper()

        # Default: capitalize first letter
        return key.capitalize()

    def _on_key_press(self, event):
        """Handle key press event"""
        if not self.is_capturing:
            return

        key = event.keysym

        # Clear hotkey on Escape or Delete
        if key in ('Escape', 'Delete'):
            self.current_hotkey = ""
            self.pressed_modifiers.clear()
            self._set_placeholder()
            if self.on_change:
                self.on_change("")
            return 'break'

        # Track modifier keys
        if key in ('Control_L', 'Control_R', 'Shift_L', 'Shift_R', 'Alt_L', 'Alt_R', 'Win_L', 'Win_R'):
            i18n_key = self.KEY_NAME_I18N_MAP[key]
            modifier = self._get_key_name(i18n_key)
            self.pressed_modifiers.add(modifier)
            return 'break'

        # Build hotkey string
        hotkey_parts = []

        # Add modifiers in standard order (using i18n names)
        modifier_order = [
            self._get_key_name('ctrl'),
            self._get_key_name('shift'),
            self._get_key_name('alt'),
            self._get_key_name('win')
        ]
        for mod in modifier_order:
            if mod in self.pressed_modifiers:
                hotkey_parts.append(mod)

        # Add main key
        main_key = self._normalize_key_name(key)
        hotkey_parts.append(main_key)

        # Create hotkey string
        hotkey = '+'.join(hotkey_parts)

        # Update display and value
        self.current_hotkey = hotkey
        self._display_hotkey(hotkey)

        # Trigger callback
        if self.on_change:
            self.on_change(hotkey)

        return 'break'

    def _on_key_release(self, event):
        """Handle key release event"""
        if not self.is_capturing:
            return

        key = event.keysym

        # Remove released modifier from tracking
        if key in ('Control_L', 'Control_R', 'Shift_L', 'Shift_R', 'Alt_L', 'Alt_R', 'Win_L', 'Win_R'):
            i18n_key = self.KEY_NAME_I18N_MAP[key]
            modifier = self._get_key_name(i18n_key)
            self.pressed_modifiers.discard(modifier)

        return 'break'

    def _on_language_changed(self, new_language):
        """Handle language change event"""
        try:
            # Update placeholder if showing
            current_value = self.get()
            # Check if placeholder is currently shown (need to check both languages)
            if not self.current_hotkey or current_value in ["Press hotkey..."]:
                self._set_placeholder()
            else:
                # If showing a hotkey, we might need to update it if it contains i18n key names
                # For now, just keep the current hotkey as-is since it's already saved
                pass
        except Exception as e:
            pass  # Ignore errors during language change

    def get_hotkey(self):
        """Get current hotkey value"""
        return self.current_hotkey

    def set_hotkey(self, hotkey):
        """Set hotkey value programmatically"""
        self.current_hotkey = hotkey
        if hotkey:
            self._display_hotkey(hotkey)
        else:
            self._set_placeholder()

