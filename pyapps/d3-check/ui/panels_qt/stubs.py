# -*- coding: utf-8 -*-
"""Panel stubs with same API as Tk panels. Each is a QWidget with minimal content."""

from typing import Optional, Callable, Any

from PySide6.QtWidgets import QWidget, QVBoxLayout, QLabel

from ..theme.theme import UITheme


class LogPanelQt(QWidget):
    """Stub: same API as LogPanel."""

    def __init__(self, parent):
        super().__init__(parent)
        self.setStyleSheet(f"background-color: {UITheme.get_color('bg_primary')};")
        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("Log (Qt)"))

    def add_log_message(self, level: str, message: str):
        pass


class CoordinateCalibrationPanelQt(QWidget):
    """Stub: same API as CoordinateCalibrationPanel."""

    def __init__(self, parent):
        super().__init__(parent)
        self.setStyleSheet(f"background-color: {UITheme.get_color('bg_primary')};")
        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("Coordinate Calibration (Qt)"))
