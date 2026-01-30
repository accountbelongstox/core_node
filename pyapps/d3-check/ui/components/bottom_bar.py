#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Component
Bottom status bar with options and status displays
"""

import tkinter as tk
import winsound
from typing import Optional
from ..theme import UITheme
from ..utils.tk_variables import var_bool, var_str
from ..widgets import ThemedFrame, ThemedLabel, ThemedCheckbutton, ThemedEntry
from ..unified_styles import UnifiedStyles
from d3utils.i18n_manager import I18nManager
from d3utils.shutdown_manager import is_shutdown_requested

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

        # Variables (use factory so master is always set)
        self.sound_var = var_bool(parent, True)
        self.smart_pause_var = var_bool(parent, True)
        self.custom_stand_var = var_bool(parent, False)
        self.custom_stand_key_var = var_str(parent, 'Shift')
        self.game_status = var_str(parent, i18n_manager.get_ui_text("ui.status_bar.diablo_not_running"))
        self.window_size = var_str(parent, "0x0")

        # Create bottom bar frame
        self.frame = tk.Frame(
            parent,
            bg=UITheme.get_color('bg_primary'),
            relief=tk.RAISED,
            bd=2
        )

        # Configure grid for 3 rows (row 2 for macro controls)
        self.frame.grid_rowconfigure(0, weight=0)
        self.frame.grid_rowconfigure(1, weight=0)
        self.frame.grid_rowconfigure(2, weight=0)

        self._create_content()

    def _create_content(self):
        """Create bottom bar content - 2 rows"""
        # Row 1: Options and status
        self._create_row1_options_status()

        # Row 2: Game status and window size
        self._create_row2_game_window_status()

    def _create_row1_options_status(self):
        """Create row 1 with options and status"""
        row1_frame = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        row1_frame.grid(row=0, column=0, sticky="ew", padx=5, pady=3)
        row1_frame.grid_columnconfigure(1, weight=1)

        # Left: Options
        left_frame = tk.Frame(row1_frame, bg=UITheme.get_color('bg_primary'))
        left_frame.grid(row=0, column=0, sticky="w")

        sound_check = ThemedCheckbutton.create(
            left_frame,
            text=i18n_manager.get_ui_text("options.play_sound_on_switch"),
            variable=self.sound_var,
            bg_color='bg_primary',
            select_color='text_secondary'
        )
        sound_check.pack(side=tk.LEFT, padx=(5, 15))

        smart_check = ThemedCheckbutton.create(
            left_frame,
            text=i18n_manager.get_ui_text("options.smart_pause"),
            variable=self.smart_pause_var,
            bg_color='bg_primary',
            select_color='text_secondary'
        )
        smart_check.pack(side=tk.LEFT, padx=(0, 15))

        custom_frame = tk.Frame(left_frame, bg=UITheme.get_color('bg_primary'))
        custom_frame.pack(side=tk.LEFT)

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
        custom_entry.pack(side=tk.LEFT, padx=5)

        # Right: Config status
        right_frame = tk.Frame(row1_frame, bg=UITheme.get_color('bg_primary'))
        right_frame.grid(row=0, column=1, sticky="e")

        self.status_config_label = ThemedLabel.create(
            right_frame,
            text=i18n_manager.get_ui_text("options.current_active_config") + ": Config 1",
            font_type='body',
            fg_color='text_success',
            bg_color='bg_primary'
        )
        self.status_config_label.pack(side=tk.LEFT, padx=5)

        self.status_mode_label = ThemedLabel.create(
            right_frame,
            text=i18n_manager.get_ui_text("options.key_send_mode") + ": Event",
            font_type='body',
            fg_color='text_success',
            bg_color='bg_primary'
        )
        self.status_mode_label.pack(side=tk.LEFT, padx=5)

    def _create_row2_game_window_status(self):
        """Create row 2 with game status and window size"""
        row2_frame = tk.Frame(self.frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        row2_frame.grid(row=1, column=0, sticky="ew", padx=5, pady=(0, 3))

        # Game status
        status_label_frame = tk.LabelFrame(
            row2_frame,
            text=i18n_manager.get_ui_text("ui.status_bar.game_status"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default']
        )
        status_label_frame.pack(side=tk.LEFT, padx=5, pady=2)

        self.game_status_label = tk.Label(
            status_label_frame,
            textvariable=self.game_status,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['error'],
            font=UnifiedStyles.FONTS['default']
        )
        self.game_status_label.pack(padx=10, pady=2)

        # Window size
        window_label_frame = tk.LabelFrame(
            row2_frame,
            text=i18n_manager.get_ui_text("ui.status_bar.window_size"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default']
        )
        window_label_frame.pack(side=tk.LEFT, padx=5, pady=2)

        self.window_size_label = tk.Label(
            window_label_frame,
            textvariable=self.window_size,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['code']
        )
        self.window_size_label.pack(padx=10, pady=2)

    def pack(self, **kwargs):
        """Pack the bottom bar"""
        self.frame.pack(**kwargs)

    def grid(self, **kwargs):
        """Grid the bottom bar"""
        self.frame.grid(**kwargs)

    def update_config_status(self, config_name: str):
        """Update current config status and play sound if enabled"""
        text = f"{i18n_manager.get_ui_text('options.current_active_config')}: {config_name}"
        self.status_config_label.configure(text=text)

        if self.sound_var.get():
            winsound.Beep(1000, 100)

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

    def on_window_status_update(self, window_info):
        """Callback for window monitor timer updates. Schedules UI update on main thread."""
        if is_shutdown_requested():
            return
        try:
            self.parent.after(0, lambda w=window_info: self._do_window_status_ui_update(w))
        except tk.TclError:
            pass

    def _do_window_status_ui_update(self, window_info):
        """Update status widgets on main thread (called via after(0, ...))."""
        try:
            if window_info:
                width = window_info.get('width', 0)
                height = window_info.get('height', 0)
                self.game_status.set(i18n_manager.get_ui_text("ui.status_bar.diablo_running"))
                self.game_status_label.config(fg=UnifiedStyles.COLORS['success'])
                size_text = i18n_manager.get_ui_text("ui.status_bar.size_format").format(width=width, height=height)
                self.window_size.set(size_text)
            else:
                self.game_status.set(i18n_manager.get_ui_text("ui.status_bar.diablo_not_running"))
                self.game_status_label.config(fg=UnifiedStyles.COLORS['error'])
                self.window_size.set("0x0")
        except Exception:
            pass

