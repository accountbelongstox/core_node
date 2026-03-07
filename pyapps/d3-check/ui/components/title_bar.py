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
from ..utils.tk_variables import var_str
from ..widgets import ThemedCombobox
from runtime import trigger_window_minimize, trigger_window_maximize, trigger_app_restart, trigger_app_exit
from providor.i18n_manager import i18n_manager
from pycore.pyfoundations.color_print import ColorPrint


class TitleBar:
    """Title bar component with back button and title"""

    def __init__(self, parent):
        """
        Create title bar component

        Args:
            parent: Parent widget (should be Diablo3MacroUI instance)
        """
        self.parent = parent
        self.drag_start_x = 0
        self.drag_start_y = 0

        # Create title bar frame directly on root window
        self.frame = tk.Frame(
            parent.root,
            bg=UITheme.get_color('bg_primary'),
            relief=tk.RAISED,
            bd=2
        )

        self._create_content()
        # Bind drag on the whole title bar frame so any click on title area (frame bg, borders, gaps) moves window
        self.frame.bind("<Button-1>", self._start_drag)
        self.frame.bind("<B1-Motion>", self._on_drag)

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
        
        # Bind drag and double-click (toggle maximize) to title label
        self._bind_drag_events()
        self.title_label.bind("<Double-Button-1>", self._on_title_double_click)

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
        """Create language selection menu. Dropdown shows i18n names (e.g. 中文/English); CONFIG stores zh/en."""
        lang_keys = i18n_manager.get_supported_languages()
        lang_names = i18n_manager.get_language_names()
        display_values = [lang_names.get(lang, lang) for lang in lang_keys]
        current = i18n_manager.get_current_language()
        idx = lang_keys.index(current) if current in lang_keys else 0
        self._lang_keys = lang_keys
        self._lang_display_values = display_values
        self._lang_var = var_str(parent, display_values[idx])
        self.language_combo = ThemedCombobox.create(
            parent, textvariable=self._lang_var, values=display_values,
            state="readonly", width=8
        )
        self.language_combo.pack(side=tk.LEFT, padx=(0, 10))

        def _on_lang_select(event=None):
            display = self._lang_var.get()
            i = self._lang_display_values.index(display) if display in self._lang_display_values else 0
            new_lang = self._lang_keys[i]
            ConfigBinding.set_config_value("ui_settings.current_language", new_lang)
            i18n_manager.set_language(new_lang)

        self.language_combo.bind("<<ComboboxSelected>>", _on_lang_select)
    
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

        # Restore to preset size button
        self.restore_preset_btn = tk.Button(
            parent,
            text="⧉",
            command=self._restore_to_preset_size,
            width=2,
            bg=UITheme.get_color('bg_secondary'),
            fg=UITheme.get_color('text_primary'),
            relief=tk.RAISED,
            bd=1
        )
        self.restore_preset_btn.pack(side=tk.LEFT, padx=2)

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
    
    def _on_language_changed(self, new_language: str):
        """Handle language change - update only title bar UI. Parent (Diablo3MacroUI) is a separate listener and will run its own _on_language_changed once; do not call parent here to avoid double _recreate_ui_for_language_change."""
        ColorPrint.blue(f"[TitleBar] Updating UI for language: {new_language}")

        self.title_label.configure(text=i18n_manager.get_ui_text("main_window.title"))
        if hasattr(self, "_lang_keys") and new_language in self._lang_keys:
            idx = self._lang_keys.index(new_language)
            self._lang_var.set(self._lang_display_values[idx])

    def update_title(self, new_title: str):
        """Update title text"""
        self.title_label.configure(text=new_title)
    
    def _minimize_window(self):
        """Minimize window; runs on main thread via event center."""
        trigger_window_minimize()

    def _toggle_maximize(self):
        """Toggle maximize/restore; runs on main thread via event center."""
        trigger_window_maximize()

    def _restore_to_preset_size(self):
        """Restore window to initial preset size (e.g. 670x550)."""
        self.parent.restore_window_to_preset()

    def _restart_application(self):
        """Restart application; dispatched to main thread via event center."""
        trigger_app_restart()

    def _close_window(self):
        """Close window; dispatched to main thread via event center."""
        trigger_app_exit()
    
    def _bind_drag_events(self):
        """Bind drag events for window dragging"""
        # Bind to title label for dragging
        self.title_label.bind("<Button-1>", self._start_drag)
        self.title_label.bind("<B1-Motion>", self._on_drag)
    
    def _on_title_double_click(self, event):
        """Double-click on title bar: toggle maximize/restore (same as maximize button)."""
        trigger_window_maximize()

    def _start_drag(self, event):
        """Start window dragging"""
        self.drag_start_x = event.x_root
        self.drag_start_y = event.y_root

    def _on_drag(self, event):
        """Handle window dragging. Only called after _start_drag (code-level guarantee).
        Use winfo_rootx/rooty (screen coords) so overrideredirect root moves correctly; winfo_x/y can be wrong for frameless root."""
        root = self.parent.root
        x = root.winfo_rootx() + (event.x_root - self.drag_start_x)
        y = root.winfo_rooty() + (event.y_root - self.drag_start_y)
        root.geometry(f"+{x}+{y}")
        self.drag_start_x = event.x_root
        self.drag_start_y = event.y_root


    def pack(self, **kwargs):
        """Pack the title bar"""
        self.frame.pack(**kwargs)

    def grid(self, **kwargs):
        """Grid the title bar"""
        self.frame.grid(**kwargs)

