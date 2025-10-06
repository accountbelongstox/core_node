#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Component
Bottom status bar with options and status displays
"""

import tkinter as tk
from typing import Optional
from ..theme import UITheme
from ..widgets import ThemedFrame, ThemedLabel, ThemedCheckbutton, ThemedEntry
from d3utils.i18n_manager import I18nManager
i18n_manager = I18nManager()


class BottomBar:
    """Bottom bar with options and status information"""

    def __init__(self, parent):
        """
        Create bottom bar component

        Args:
            parent: Parent widget
        """
        self.parent = parent

        # Variables
        self.sound_var = tk.BooleanVar(value=True)
        self.smart_pause_var = tk.BooleanVar(value=True)
        self.custom_stand_var = tk.BooleanVar(value=False)
        self.custom_stand_key_var = tk.StringVar(value='Shift')

        # Create bottom bar frame
        self.frame = tk.Frame(
            parent,
            bg=UITheme.get_color('bg_primary'),
            relief=tk.RAISED,
            bd=2
        )

        self._create_content()

    def _create_content(self):
        """Create bottom bar content"""
        # Left side - options
        self._create_left_options()

        # Right side - status and github link
        self._create_right_status()

    def _create_left_options(self):
        """Create left side options"""
        left_frame = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        left_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Sound feedback checkbox
        sound_check = ThemedCheckbutton.create(
            left_frame,
            text=i18n_manager.get_ui_text("options.play_sound_on_switch"),
            variable=self.sound_var,
            bg_color='bg_primary',
            select_color='text_secondary'
        )
        sound_check.pack(side=tk.LEFT, padx=(UITheme.get_size('padding_medium'),
                                             UITheme.get_size('padding_large')),
                        pady=UITheme.get_size('padding_small'))

        # Smart pause checkbox
        smart_check = ThemedCheckbutton.create(
            left_frame,
            text=i18n_manager.get_ui_text("options.smart_pause"),
            variable=self.smart_pause_var,
            bg_color='bg_primary',
            select_color='text_secondary'
        )
        smart_check.pack(side=tk.LEFT, padx=(0, UITheme.get_size('padding_large')),
                        pady=UITheme.get_size('padding_small'))

        # Custom stand key frame
        custom_frame = tk.Frame(left_frame, bg=UITheme.get_color('bg_primary'))
        custom_frame.pack(side=tk.LEFT, padx=(0, UITheme.get_size('padding_large')))

        custom_check = ThemedCheckbutton.create(
            custom_frame,
            text=i18n_manager.get_ui_text("options.use_custom_stand_key") + ":",
            variable=self.custom_stand_var,
            bg_color='bg_primary',
            select_color='text_secondary'
        )
        custom_check.pack(side=tk.LEFT)

        custom_entry = ThemedEntry.create(
            custom_frame,
            textvariable=self.custom_stand_key_var,
            width=8
        )
        custom_entry.pack(side=tk.LEFT, padx=UITheme.get_size('padding_small'))

    def _create_right_status(self):
        """Create right side status"""
        status_frame = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        status_frame.pack(side=tk.RIGHT)

        # Current config label
        self.status_config_label = ThemedLabel.create(
            status_frame,
            text=i18n_manager.get_ui_text("options.current_active_config") + ": Config 1",
            font_type='body',
            fg_color='text_success',
            bg_color='bg_primary'
        )
        self.status_config_label.pack(side=tk.LEFT, padx=UITheme.get_size('padding_small'),
                                      pady=UITheme.get_size('padding_small'))

        # Key send mode label
        self.status_mode_label = ThemedLabel.create(
            status_frame,
            text=i18n_manager.get_ui_text("options.key_send_mode") + ": Event",
            font_type='body',
            fg_color='text_success',
            bg_color='bg_primary'
        )
        self.status_mode_label.pack(side=tk.LEFT, padx=UITheme.get_size('padding_small'),
                                    pady=UITheme.get_size('padding_small'))

        # Note: Removed GitHub link as requested by user

    def pack(self, **kwargs):
        """Pack the bottom bar"""
        self.frame.pack(**kwargs)

    def grid(self, **kwargs):
        """Grid the bottom bar"""
        self.frame.grid(**kwargs)

    def update_config_status(self, config_name: str):
        """
        Update current config status - simplified to show config name directly

        Args:
            config_name: Current configuration name
        """
        text = f"{i18n_manager.get_ui_text('options.current_active_config')}: {config_name}"
        self.status_config_label.configure(text=text)

    def get_sound_enabled(self) -> bool:
        """Get sound feedback enabled status"""
        return self.sound_var.get()

    def get_smart_pause_enabled(self) -> bool:
        """Get smart pause enabled status"""
        return self.smart_pause_var.get()

    def get_custom_stand_key(self) -> Optional[str]:
        """Get custom stand key if enabled"""
        if self.custom_stand_var.get():
            return self.custom_stand_key_var.get()
        return None

