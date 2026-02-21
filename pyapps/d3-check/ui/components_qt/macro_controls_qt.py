# -*- coding: utf-8 -*-
"""Qt Macro Controls: same API as Tk (no visible buttons per current design)."""

from typing import Optional, Callable

from PySide6.QtWidgets import QWidget, QHBoxLayout

from ..theme.theme import UITheme


class MacroControlsQt(QWidget):
    """Macro control placeholder (no visible UI per user request)."""

    def __init__(self, parent, on_start: Optional[Callable] = None, on_stop: Optional[Callable] = None):
        super().__init__(parent)
        self.parent = parent
        self.on_start = on_start
        self.on_stop = on_stop
        self.is_running = False
        self.setStyleSheet(f"background-color: {UITheme.get_color('bg_primary')};")
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

    def set_running(self, running: bool):
        self.is_running = running

    def pack(self, **kwargs):
        pass

    def grid(self, **kwargs):
        pass

    def update_text(self):
        pass
