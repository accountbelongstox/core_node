#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Macro Controls Component
Start/Stop buttons and status indicator for macro control
"""

import tkinter as tk
from typing import Optional, Callable
from ..theme import UITheme
from ..widgets import ThemedFrame, ThemedButton, ThemedLabel


class MacroControls:
    """Macro control buttons with status indicator"""

    def __init__(self, parent, on_start: Optional[Callable] = None,
                 on_stop: Optional[Callable] = None):
        """
        Create macro controls component

        Args:
            parent: Parent widget
            on_start: Callback for start button
            on_stop: Callback for stop button
        """
        self.parent = parent
        self.on_start = on_start
        self.on_stop = on_stop
        self.is_running = False

        # Create control frame
        self.frame = ThemedFrame.create(parent, bg_color='bg_primary')

        self._create_controls()

    def _create_controls(self):
        """Create control buttons and status - removed stop button and status display"""
        # Stop button and status indicators removed as per user request
        pass

    def _on_start_clicked(self):
        """Handle start button click"""
        if self.on_start:
            self.on_start()
        self.set_running(True)

    def _on_stop_clicked(self):
        """Handle stop button click"""
        if self.on_stop:
            self.on_stop()
        self.set_running(False)

    def set_running(self, running: bool):
        """
        Set macro running state - removed UI updates since controls are hidden

        Args:
            running: True if macro is running
        """
        self.is_running = running
        # No UI elements to update since stop button and status are removed

    def pack(self, **kwargs):
        """Pack the controls"""
        self.frame.pack(**kwargs)

    def grid(self, **kwargs):
        """Grid the controls"""
        self.frame.grid(**kwargs)

    def update_text(self):
        """Update button and status text after language change - no UI to update"""
        # No UI elements to update since stop button and status are removed
        pass

