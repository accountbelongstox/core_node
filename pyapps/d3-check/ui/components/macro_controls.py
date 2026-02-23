#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Macro Controls Component
Macro start/stop by hotkey only; no UI buttons.
"""

from typing import Optional, Callable
from ..widgets import ThemedFrame


class MacroControls:
    """Macro control: start/stop by hotkey only; no UI buttons."""

    def __init__(self, parent, on_start: Optional[Callable] = None,
                 on_stop: Optional[Callable] = None):
        """
        Create macro controls component (hotkey-only; no buttons).

        Args:
            parent: Parent widget
            on_start: Callback for start (used by hotkey)
            on_stop: Callback for stop (used by hotkey)
        """
        self.parent = parent
        self.on_start = on_start
        self.on_stop = on_stop
        self.is_running = False

        self.frame = ThemedFrame.create(parent, bg_color='bg_primary')
        self._create_controls()

    def _create_controls(self):
        """No buttons: macro start/stop is via hotkey only."""
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
        """Set macro running state (hotkey-only; no UI to update)."""
        self.is_running = running

    def pack(self, **kwargs):
        """Pack the controls"""
        self.frame.pack(**kwargs)

    def grid(self, **kwargs):
        """Grid the controls"""
        self.frame.grid(**kwargs)

    def update_text(self):
        """No UI elements (hotkey-only)."""
        pass

