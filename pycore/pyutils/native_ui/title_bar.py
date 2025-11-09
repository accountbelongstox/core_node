#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Custom Title Bar Module
Custom title bar module
"""

# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

# Import ColorPrint for logging
from pycore.pyfoundations.color_print import ColorPrint

import tkinter as tk
from pycore.pyutils.native_ui.config import UIConfig
from pycore.pyutils.native_ui.signals import SignalManager, SignalType


class CustomTitleBar(tk.Frame):
    """
    Custom title bar component
    Contains: left menu, center title (draggable), right control buttons
    """

    def __init__(self, parent, config: UIConfig, signal_manager: SignalManager):
        super().__init__(
            parent,
            height=config.title_bar_height,
            bg=config.title_bar_bg
        )

        self.config = config
        self.signal_manager = signal_manager
        self.parent_window = parent

        # Drag related variables
        self._drag_start_x = 0
        self._drag_start_y = 0
        self._is_maximized = False

        self._create_widgets()
        self._bind_events()

        ColorPrint.blue(f"[TitleBar] Custom title bar created: {config.app_name}")

    def _create_widgets(self):
        """Create title bar widgets"""
        # Left: Menu button (hamburger menu icon)
        self.menu_btn = tk.Button(
            self,
            text="☰",
            bg=self.config.title_bar_bg,
            fg=self.config.title_bar_fg,
            relief=tk.FLAT,
            font=("Arial", 12),
            width=3,
            command=self._on_menu_click
        )
        self.menu_btn.pack(side=tk.LEFT, padx=5)

        # Right: Control buttons
        button_style = {
            'bg': self.config.title_bar_bg,
            'fg': self.config.title_bar_fg,
            'relief': tk.FLAT,
            'width': 3,
            'font': ("Arial", 10)
        }

        # Restart button
        self.restart_btn = tk.Button(
            self,
            text="↻",
            command=self._on_restart_click,
            **button_style
        )
        self.restart_btn.pack(side=tk.RIGHT, padx=2)

        # Close button
        self.close_btn = tk.Button(
            self,
            text="✕",
            command=self._on_close_click,
            **button_style
        )
        self.close_btn.pack(side=tk.RIGHT, padx=2)

        # Maximize/restore button
        self.maximize_btn = tk.Button(
            self,
            text="□",
            command=self._on_maximize_click,
            **button_style
        )
        self.maximize_btn.pack(side=tk.RIGHT, padx=2)

        # Minimize button
        self.minimize_btn = tk.Button(
            self,
            text="_",
            command=self._on_minimize_click,
            **button_style
        )
        self.minimize_btn.pack(side=tk.RIGHT, padx=2)

        # Center: Title label (draggable area)
        self.title_label = tk.Label(
            self,
            text=self.config.app_name,
            bg=self.config.title_bar_bg,
            fg=self.config.title_bar_fg,
            font=self.config.title_font
        )
        self.title_label.pack(side=tk.LEFT, expand=True, fill=tk.BOTH, padx=10)

    def _bind_events(self):
        """Bind events"""
        # Title bar dragging
        self.title_label.bind("<Button-1>", self._start_drag)
        self.title_label.bind("<B1-Motion>", self._on_drag)
        self.title_label.bind("<Double-Button-1>", self._on_title_double_click)

        # Button hover effects
        for btn in [self.minimize_btn, self.maximize_btn, self.close_btn, self.restart_btn]:
            btn.bind("<Enter>", lambda e, b=btn: self._on_button_hover(b, True))
            btn.bind("<Leave>", lambda e, b=btn: self._on_button_hover(b, False))

    def _on_button_hover(self, button: tk.Button, is_hover: bool):
        """Button hover effect"""
        if is_hover:
            if button == self.close_btn:
                button.config(bg="#e74c3c")
            else:
                button.config(bg="#34495e")
        else:
            button.config(bg=self.config.title_bar_bg)

    def _start_drag(self, event):
        """Start dragging"""
        self._drag_start_x = event.x
        self._drag_start_y = event.y

    def _on_drag(self, event):
        """Drag window"""
        if self._is_maximized:
            return

        x = self.parent_window.winfo_x() + event.x - self._drag_start_x
        y = self.parent_window.winfo_y() + event.y - self._drag_start_y
        self.parent_window.geometry(f"+{x}+{y}")

    def _on_title_double_click(self, event):
        """Double click title bar to toggle maximize/restore"""
        self._on_maximize_click()

    def _on_menu_click(self):
        """Menu button click (extensible for dropdown menu implementation)"""
        ColorPrint.blue("[TitleBar] Menu button clicked")
        # TODO: Implement dropdown menu

    def _on_minimize_click(self):
        """Minimize button click"""
        ColorPrint.blue("[TitleBar] Minimize button clicked")
        self.signal_manager.emit(SignalType.WINDOW_MINIMIZE)

    def _on_maximize_click(self):
        """Maximize/restore button click"""
        if self._is_maximized:
            ColorPrint.blue("[TitleBar] Restore button clicked")
            self.signal_manager.emit(SignalType.WINDOW_RESTORE)
            self.maximize_btn.config(text="□")
            self._is_maximized = False
        else:
            ColorPrint.blue("[TitleBar] Maximize button clicked")
            self.signal_manager.emit(SignalType.WINDOW_MAXIMIZE)
            self.maximize_btn.config(text="❐")
            self._is_maximized = True

    def _on_close_click(self):
        """Close button click"""
        ColorPrint.yellow("[TitleBar] Close button clicked")
        self.signal_manager.emit(SignalType.WINDOW_CLOSE)

    def _on_restart_click(self):
        """Restart button click"""
        ColorPrint.yellow("[TitleBar] Restart button clicked")
        self.signal_manager.emit(SignalType.WINDOW_RESTART)

    def set_title(self, title: str):
        """Set title text"""
        self.title_label.config(text=title)
        ColorPrint.green(f"[TitleBar] Title updated: {title}")
