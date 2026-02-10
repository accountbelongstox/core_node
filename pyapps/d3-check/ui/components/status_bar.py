#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Status Bar Component
Bottom status bar with game status, window size, and main log area
"""

import tkinter as tk
from tkinter import ttk, scrolledtext
from typing import Optional, Callable
import time
from ..theme import UITheme
from ..unified_styles import UnifiedStyles
from ..utils.tk_variables import var_str
from d3utils.i18n_manager import i18n_manager
import sys
import os

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from runtime import is_shutdown_requested

class StatusBar:
    """Bottom status bar with game status, window size, and main log area"""

    def __init__(self, parent):
        """
        Create status bar component

        Args:
            parent: Parent widget
        """
        self.parent = parent

        # Status variables (use factory so master is always set)
        self.game_status = var_str(parent, i18n_manager.get_ui_text("ui.status_bar.diablo_not_running"))
        self.window_size = var_str(parent, "0x0")
        
        # Create main frame
        self.frame = tk.Frame(
            parent,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            relief=tk.RAISED,
            bd=1,
            height=100
        )
        
        # Configure grid weights
        self.frame.grid_columnconfigure(2, weight=1)  # Log area gets most space
        
        self._create_content()
        self._setup_log_callback()

        # Note: Window monitoring is now handled by window_monitor_timer
        # Register callback using: window_monitor.add_callback(self.on_window_status_update)

        # Register for language change events
        i18n_manager.add_language_change_listener(self._on_language_changed)

    def _create_content(self):
        """Create status bar content"""
        # Status section
        self._create_status_section()
        
        # Window size section  
        self._create_window_section()
        
        # Main log section
        self._create_log_section()

    def _create_status_section(self):
        """Create game status section"""
        status_frame = tk.LabelFrame(
            self.frame,
            text=i18n_manager.get_ui_text("ui.status_bar.game_status"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default'],
            relief=tk.GROOVE,
            bd=2
        )
        status_frame.grid(row=0, column=0, sticky="nsew", padx=UnifiedStyles.SPACING['sm'], 
                         pady=UnifiedStyles.SPACING['sm'])
        
        # Game status label
        self.game_status_label = tk.Label(
            status_frame,
            textvariable=self.game_status,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['error'],  # Red by default
            font=UnifiedStyles.FONTS['default'],
            wraplength=120
        )
        self.game_status_label.pack(pady=UnifiedStyles.SPACING['sm'])

    def _create_window_section(self):
        """Create window size section"""
        window_frame = tk.LabelFrame(
            self.frame,
            text=i18n_manager.get_ui_text("ui.status_bar.window_size"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default'],
            relief=tk.GROOVE,
            bd=2
        )
        window_frame.grid(row=0, column=1, sticky="nsew", padx=UnifiedStyles.SPACING['sm'], 
                         pady=UnifiedStyles.SPACING['sm'])
        
        # Window size label
        self.window_size_label = tk.Label(
            window_frame,
            textvariable=self.window_size,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['code'],
            wraplength=120
        )
        self.window_size_label.pack(pady=UnifiedStyles.SPACING['sm'])

    def _create_log_section(self):
        """Create main log section"""
        log_frame = tk.LabelFrame(
            self.frame,
            text=i18n_manager.get_ui_text("ui.status_bar.main_log"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default'],
            relief=tk.GROOVE,
            bd=2
        )
        log_frame.grid(row=0, column=2, sticky="nsew", padx=UnifiedStyles.SPACING['sm'], 
                      pady=UnifiedStyles.SPACING['sm'])
        
        # Configure log frame grid
        log_frame.grid_rowconfigure(0, weight=1)
        log_frame.grid_columnconfigure(0, weight=1)
        
        # Log text area (increased height from 3 to 4 after removing note line)
        self.log_text = scrolledtext.ScrolledText(
            log_frame,
            height=4,
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['code'],
            wrap=tk.WORD,
            state=tk.DISABLED
        )
        self.log_text.grid(row=0, column=0, sticky="nsew", padx=UnifiedStyles.SPACING['xs'], 
                          pady=UnifiedStyles.SPACING['xs'])
        
        # Note: Removed multiple logs note to save space for log display

    def _setup_log_callback(self):
        """Setup ColorPrint callback; schedule UI update on main thread via after(0)."""
        def log_callback(message, level="INFO"):
            if is_shutdown_requested():
                return
            self.parent.after(0, lambda: self._add_log_message(message, level))
        ColorPrint.register_callback(log_callback)

    def _add_log_message(self, message, level="INFO"):
        """Add message to log area. ColorPrint callback; only registered when status bar exists."""
        if is_shutdown_requested():
            return
        self.log_text.config(state=tk.NORMAL)
        timestamp = time.strftime("%H:%M:%S")
        formatted_message = f"[{timestamp}] {message}\n"
        self.log_text.insert(tk.END, formatted_message)
        self.log_text.see(tk.END)
        lines = self.log_text.get("1.0", tk.END).split('\n')
        if len(lines) > 100:
            self.log_text.delete("1.0", f"{len(lines)-100}.0")
        self.log_text.config(state=tk.DISABLED)

    def _update_game_status(self, running):
        """Update game status display. Only called from window monitor callback while UI exists."""
        if running:
            self.game_status.set(i18n_manager.get_ui_text("ui.status_bar.diablo_running"))
            self.game_status_label.config(fg=UnifiedStyles.COLORS['success'])
        else:
            self.game_status.set(i18n_manager.get_ui_text("ui.status_bar.diablo_not_running"))
            self.game_status_label.config(fg=UnifiedStyles.COLORS['error'])

    def _update_window_size(self, size_text):
        """Update window size display. Only called from window monitor callback while UI exists."""
        self.window_size.set(size_text)

    def on_window_status_update(self, window_info):
        """
        Callback for window monitor timer updates. Schedules UI update on main thread.
        Call only when not shutdown and parent exists.
        """
        if is_shutdown_requested():
            return
        if window_info:
            width = window_info.get('width', 0)
            height = window_info.get('height', 0)
            size_text = i18n_manager.get_ui_text("ui.status_bar.size_format").format(
                width=width, height=height
            )
            self.parent.after(0, self._update_game_status, True)
            self.parent.after(0, self._update_window_size, size_text)
        else:
            self.parent.after(0, self._update_game_status, False)
            self.parent.after(0, self._update_window_size, "0x0")

    def update_status(self, status_text):
        """Update current status - deprecated, kept for compatibility"""
        pass

    def pack(self, **kwargs):
        """Pack the status bar frame"""
        self.frame.pack(**kwargs)

    def grid(self, **kwargs):
        """Grid the status bar frame"""
        self.frame.grid(**kwargs)

    def _on_language_changed(self, new_language):
        """Handle language change event"""
        self._update_ui_text()

    def _update_ui_text(self):
        """Update all UI text elements"""
        if "not running" in self.game_status.get():
            self.game_status.set(i18n_manager.get_ui_text("ui.status_bar.diablo_not_running"))
        elif "running" in self.game_status.get():
            self.game_status.set(i18n_manager.get_ui_text("ui.status_bar.diablo_running"))
        self._recreate_content()

    def _recreate_content(self):
        """Recreate content with updated language"""
        for widget in self.frame.winfo_children():
            widget.destroy()
        self._create_content()
