#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Title Bar Component
Top title bar with back button and application title
"""

import tkinter as tk
from tkinter import ttk
from typing import Optional, Callable
from ..theme.theme import UITheme
from ..utils.config_binding import ConfigBinding
from d3utils import event_center
from d3utils.i18n_manager import i18n_manager
from providor.common_imports import ColorPrint


class TitleBar:
    """Title bar component with back button and title"""

    def __init__(self, parent):
        """
        Create title bar component

        Args:
            parent: Parent widget (should be Diablo3MacroUI instance)
        """
        self.parent = parent

        # Create title bar frame directly on root window
        self.frame = tk.Frame(
            parent.root,
            bg=UITheme.get_color('bg_primary'),
            relief=tk.RAISED,
            bd=2
        )

        self._create_content()

        # Register for language change events
        i18n_manager.add_language_change_listener(self._on_language_changed)

    def _create_content(self):
        """Create title bar content"""

        # Title label with drag functionality (9px as minimum font size)
        self.title_label = tk.Label(
            self.frame,
            text=i18n_manager.get_ui_text("main_window.title"),
            font=('Arial', 9, 'bold'),   # 9px as minimum font size
            fg=UITheme.get_color('text_secondary'),
            bg=UITheme.get_color('bg_primary'),
            cursor='fleur'  # Drag cursor
        )
        self.title_label.pack(side=tk.LEFT, expand=True, fill=tk.X, pady=3, padx=(12, 12))  # Scaled to 60%
        
        # Bind drag functionality to title label
        self._bind_drag_events()

        # Right side controls
        right_frame = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        right_frame.pack(side=tk.RIGHT, padx=10, pady=5)
        
        # Language selection
        self._create_language_menu(right_frame)
        
        # Window controls
        self._create_window_controls(right_frame)

        # Decorative separator
        separator = tk.Frame(
            self.frame,
            bg=UITheme.get_color('border_primary'),
            height=2
        )
        separator.pack(side=tk.BOTTOM, fill=tk.X, padx=10)

    def _create_language_menu(self, parent):
        """Create language selection menu"""
        # Language label
        self.lang_label = tk.Label(
            parent,
            text=i18n_manager.get_ui_text("main_window.language") + ":",
            font=('Arial', 9),
            fg=UITheme.get_color('test_high_contrast'),  # Use high contrast test color
            bg=UITheme.get_color('bg_primary')
        )
        self.lang_label.pack(side=tk.LEFT, padx=(0, 5))
        
        # Language combobox using ConfigBinding
        self.language_combo = ConfigBinding.create_combobox_binding(
            parent, "ui_settings.current_language",
            values=["zh", "en"], default_value="zh", width=5
        )
        self.language_combo.pack(side=tk.LEFT, padx=(0, 10))

        # Bind language change event to trigger UI updates
        self.language_combo.bind('<<ComboboxSelected>>', self._on_language_combo_changed)
    
    def _create_window_controls(self, parent):
        """Create window control buttons"""
        # Minimize button
        self.minimize_btn = tk.Button(
            parent,
            text="−",
            command=self._minimize_window,
            width=2,
            bg=UITheme.get_color('bg_secondary'),
            fg=UITheme.get_color('text_primary'),
            relief=tk.RAISED,
            bd=1
        )
        self.minimize_btn.pack(side=tk.LEFT, padx=2)

        # Maximize/Restore button
        self.maximize_btn = tk.Button(
            parent,
            text="□",
            command=self._toggle_maximize,
            width=2,
            bg=UITheme.get_color('bg_secondary'),
            fg=UITheme.get_color('text_primary'),
            relief=tk.RAISED,
            bd=1
        )
        self.maximize_btn.pack(side=tk.LEFT, padx=2)

        # Restart button
        self.restart_btn = tk.Button(
            parent,
            text="↻",
            command=self._restart_application,
            width=2,
            bg=UITheme.get_color('bg_secondary'),
            fg=UITheme.get_color('text_primary'),
            relief=tk.RAISED,
            bd=1
        )
        self.restart_btn.pack(side=tk.LEFT, padx=2)

        # Close button
        self.close_btn = tk.Button(
            parent,
            text="×",
            command=self._close_window,
            width=2,
            bg=UITheme.get_color('btn_secondary'),
            fg=UITheme.get_color('text_primary'),
            relief=tk.RAISED,
            bd=1
        )
        self.close_btn.pack(side=tk.LEFT, padx=2)
    
    def _on_language_combo_changed(self, event=None):
        """Handle language combobox selection change - ConfigBinding will handle everything"""
        try:
            new_language = self.language_combo.get()
            ColorPrint.blue(f"[TitleBar] Language combo changed to: {new_language}")
        except Exception as e:
            ColorPrint.red(f"[TitleBar] Error handling language change: {e}")

    def _on_language_changed(self, new_language: str):
        """Handle language change - update UI elements (called by i18n_manager)"""
        ColorPrint.blue(f"[TitleBar] Updating UI for language: {new_language}")

        if hasattr(self, 'title_label'):
            self.title_label.configure(text=i18n_manager.get_ui_text("main_window.title"))

        if hasattr(self, 'lang_label'):
            self.lang_label.configure(text=i18n_manager.get_ui_text("main_window.language") + ":")

        if hasattr(self, 'language_combo'):
            current_value = self.language_combo.get()
            if current_value != new_language:
                self.language_combo.unbind('<<ComboboxSelected>>')
                self.language_combo.set(new_language)
                self.language_combo.bind('<<ComboboxSelected>>', self._on_language_combo_changed)

        if hasattr(self.parent, '_on_language_changed'):
            self.parent._on_language_changed(new_language)

    def update_title(self, new_title: str):
        """Update title text"""
        if hasattr(self, 'title_label'):
            self.title_label.configure(text=new_title)
    
    def _minimize_window(self):
        """Minimize window; runs on main thread via event center."""
        event_center.trigger_window_minimize()

    def _toggle_maximize(self):
        """Toggle maximize/restore; runs on main thread via event center."""
        event_center.trigger_window_maximize()

    def _restart_application(self):
        """Restart application; dispatched to main thread via event center."""
        event_center.trigger_app_restart()

    def _close_window(self):
        """Close window; dispatched to main thread via event center."""
        event_center.trigger_app_exit()
    
    def _bind_drag_events(self):
        """Bind drag events for window dragging"""
        # Bind to title label for dragging
        self.title_label.bind("<Button-1>", self._start_drag)
        self.title_label.bind("<B1-Motion>", self._on_drag)
    
    def _start_drag(self, event):
        """Start window dragging"""
        self.drag_start_x = event.x_root
        self.drag_start_y = event.y_root
    
    def _on_drag(self, event):
        """Handle window dragging"""
        if hasattr(self, 'drag_start_x'):
            root = self.parent.root
            x = root.winfo_x() + (event.x_root - self.drag_start_x)
            y = root.winfo_y() + (event.y_root - self.drag_start_y)
            root.geometry(f"+{x}+{y}")
            self.drag_start_x = event.x_root
            self.drag_start_y = event.y_root


    def pack(self, **kwargs):
        """Pack the title bar"""
        self.frame.pack(**kwargs)

    def grid(self, **kwargs):
        """Grid the title bar"""
        self.frame.grid(**kwargs)

