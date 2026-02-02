#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Component
Two-row layout: row0 = macro + per-tab options, row1 = status (game status + window size).
Uses BottomBarOptionsBlock and BottomBarStatusBlock sub-components to avoid offset.
"""

import tkinter as tk
import winsound
from typing import Optional
from ..theme import UITheme
from ..utils.tk_variables import var_bool, var_str
from ..unified_styles import UnifiedStyles
from d3utils.i18n_manager import I18nManager
from d3utils.shutdown_manager import is_shutdown_requested
from .bottom_bar_options_block import BottomBarOptionsBlock
from .bottom_bar_status_block import BottomBarStatusBlock

i18n_manager = I18nManager()


class BottomBar:
    """Bottom bar: row0 = macro + options (per-tab), row1 = status (single row, no overlap)."""

    def __init__(self, parent):
        self.parent = parent

        self.sound_var = var_bool(parent, True)
        self.smart_pause_var = var_bool(parent, True)
        self.custom_stand_var = var_bool(parent, False)
        self.custom_stand_key_var = var_str(parent, 'Shift')
        self.game_status = var_str(parent, i18n_manager.get_ui_text("ui.status_bar.diablo_not_running"))
        self.window_size = var_str(parent, "0x0")
        self.config_name_var = var_str(parent, "Config 1")

        self._status_labels_list = []

        self.frame = tk.Frame(
            parent,
            bg=UITheme.get_color('bg_primary'),
            relief=tk.RAISED,
            bd=2
        )
        self.frame.grid_rowconfigure(0, weight=0)
        self.frame.grid_rowconfigure(1, weight=0)
        self.frame.grid_columnconfigure(1, weight=1)

        # Row 0: macro (col 0) + options strip (col 1). Main UI adds macro at row 0 col 0.
        options_container = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        options_container.grid(row=0, column=1, sticky="ew", padx=5, pady=(0, 2))
        options_container.grid_columnconfigure(0, weight=1)
        self._options_block = BottomBarOptionsBlock(options_container, {
            'sound_var': self.sound_var,
            'smart_pause_var': self.smart_pause_var,
            'custom_stand_var': self.custom_stand_var,
            'custom_stand_key_var': self.custom_stand_key_var,
            'config_name_var': self.config_name_var,
        })
        self._options_block.frame.grid(row=0, column=0, sticky="ew")

        # Row 1: status row (columnspan 2), single sub-component — no rowspan, no overlap
        status_container = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        status_container.grid(row=1, column=0, columnspan=2, sticky="ew", padx=5, pady=(0, 3))
        status_container.grid_columnconfigure(0, weight=1)
        self._status_block = BottomBarStatusBlock(
            status_container,
            self.game_status,
            self.window_size,
            self._register_status_labels
        )
        self._status_block.frame.grid(row=0, column=0, sticky="ew")

    def _register_status_labels(self, game_status_label: tk.Label, window_size_label: tk.Label):
        """Called by BottomBarStatusBlock to register for fg updates."""
        self._status_labels_list.append({
            'game_status_label': game_status_label,
            'window_size_label': window_size_label,
        })

    def show_tab_content(self, tab_index: int):
        """Show options row for the given main tab (0..5). Status row is shared, no change."""
        self._options_block.show_tab(tab_index)

    def pack(self, **kwargs):
        self.frame.pack(**kwargs)

    def grid(self, **kwargs):
        self.frame.grid(**kwargs)

    def update_config_status(self, config_name: str):
        self.config_name_var.set(config_name)
        if self.sound_var.get():
            winsound.Beep(1000, 100)

    def get_sound_enabled(self) -> bool:
        return self.sound_var.get()

    def get_smart_pause_enabled(self) -> bool:
        return self.smart_pause_var.get()

    def get_custom_stand_key(self) -> Optional[str]:
        if self.custom_stand_var.get():
            return self.custom_stand_key_var.get()
        return None

    def on_window_status_update(self, window_info):
        if is_shutdown_requested():
            return
        try:
            self.parent.after(0, lambda w=window_info: self._do_window_status_ui_update(w))
        except tk.TclError:
            pass

    def _do_window_status_ui_update(self, window_info):
        try:
            if window_info:
                width = window_info.get('width', 0)
                height = window_info.get('height', 0)
                self.game_status.set(i18n_manager.get_ui_text("ui.status_bar.diablo_running"))
                size_text = i18n_manager.get_ui_text("ui.status_bar.size_format").format(width=width, height=height)
                self.window_size.set(size_text)
                fg = UnifiedStyles.COLORS['success']
            else:
                self.game_status.set(i18n_manager.get_ui_text("ui.status_bar.diablo_not_running"))
                self.window_size.set("0x0")
                fg = UnifiedStyles.COLORS['error']
            for entry in self._status_labels_list:
                try:
                    entry['game_status_label'].config(fg=fg)
                except tk.TclError:
                    pass
        except Exception:
            pass
