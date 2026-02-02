#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Status Block
Single row: game status + window size. Used by BottomBar as sub-component.
"""

import tkinter as tk
from ..theme import UITheme
from ..unified_styles import UnifiedStyles
from d3utils.i18n_manager import I18nManager

i18n_manager = I18nManager()


class BottomBarStatusBlock:
    """One row: game status LabelFrame + window size LabelFrame."""

    def __init__(self, parent, game_status_var, window_size_var, register_callback):
        """
        Args:
            parent: Parent widget
            game_status_var: StringVar for game status text
            window_size_var: StringVar for window size text
            register_callback: Callable(game_status_label, window_size_label) to register for fg updates
        """
        self.frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        self.frame.grid_columnconfigure(0, weight=0)
        self.frame.grid_columnconfigure(1, weight=0)

        status_lf = tk.LabelFrame(
            self.frame,
            text=i18n_manager.get_ui_text("ui.status_bar.game_status"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default']
        )
        status_lf.pack(side=tk.LEFT, padx=5, pady=2)
        self.game_status_label = tk.Label(
            status_lf,
            textvariable=game_status_var,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['error'],
            font=UnifiedStyles.FONTS['default']
        )
        self.game_status_label.pack(padx=10, pady=2)

        window_lf = tk.LabelFrame(
            self.frame,
            text=i18n_manager.get_ui_text("ui.status_bar.window_size"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default']
        )
        window_lf.pack(side=tk.LEFT, padx=5, pady=2)
        self.window_size_label = tk.Label(
            window_lf,
            textvariable=window_size_var,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['code']
        )
        self.window_size_label.pack(padx=10, pady=2)

        register_callback(self.game_status_label, self.window_size_label)
