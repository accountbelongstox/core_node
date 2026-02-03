#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Options Block
Per-tab first row: tab 0 = sound/smart pause/custom stand/current config; tab 1-5 = title label.
"""

import tkinter as tk
from ..theme import UITheme
from ..unified_styles import UnifiedStyles
from ..widgets import ThemedCheckbutton, ThemedEntry
from d3utils.i18n_manager import I18nManager

i18n_manager = I18nManager()


class BottomBarOptionsBlock:
    """Container with 6 tab-specific option rows. Show one at a time via show_tab(tab_index)."""

    def __init__(self, parent, bottom_bar_vars):
        """
        Args:
            parent: Parent widget
            bottom_bar_vars: dict with sound_var, smart_pause_var, custom_stand_var,
                             custom_stand_key_var, config_name_var
        """
        self._vars = bottom_bar_vars
        self.frame = tk.Frame(parent, bg=UITheme.get_color('bg_primary'))
        self.frame.grid_columnconfigure(0, weight=1)
        self.frame.grid_rowconfigure(0, weight=0)

        self._tab_frames = []
        for tab_index in range(6):
            f = self._build_tab_strip(tab_index)
            self._tab_frames.append(f)
            f.grid(row=0, column=0, sticky="ew")
            if tab_index != 0:
                f.grid_remove()

    def _build_tab_strip(self, tab_index: int) -> tk.Frame:
        """Build one row for tab: empty frame (no per-tab title; status merged into bottom Game Status row)."""
        root = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        root.grid_columnconfigure(0, weight=1)
        return root

    def show_tab(self, tab_index: int):
        """Show options row for the given tab (0..5)."""
        for i, f in enumerate(self._tab_frames):
            if i == tab_index:
                f.grid(row=0, column=0, sticky="ew")
            else:
                f.grid_remove()
