# -*- coding: utf-8 -*-
"""
D3 Qt Main Window - frameless window with Tk-compat API for d3-check.
"""

import sys
from typing import Optional

from PySide6.QtCore import Qt, QPoint, QRect, QTimer
from PySide6.QtGui import QMouseEvent, QCursor
from PySide6.QtWidgets import QMainWindow, QWidget, QFrame, QApplication

from .qt_compat import TkCompatRootMixin
from .theme.theme import UITheme


class D3MainWindow(TkCompatRootMixin, QMainWindow):
    """Frameless main window with resize edges and Tk-compat API."""

    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self._tk_compat_closed = False
        self._is_maximized = False
        self._resize_edge: Optional[str] = None
        self._resize_start_pos: Optional[QPoint] = None
        self._resize_start_rect: Optional[QRect] = None
        self._margin = 2
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.Window
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, False)
        self.setMinimumSize(670, 400)
        bg = UITheme.get_color("bg_dark")
        self.setStyleSheet(f"background-color: {bg};")
        self.setMouseTracking(True)

    def _edge_at(self, pos: QPoint) -> Optional[str]:
        """Return resize edge at position: n, s, e, w, nw, ne, sw, se or None."""
        m = self._margin
        x, y = pos.x(), pos.y()
        w, h = self.width(), self.height()
        left = x <= m
        right = x >= w - m
        top = y <= m
        bottom = y >= h - m
        if top and left:
            return "nw"
        if top and right:
            return "ne"
        if bottom and left:
            return "sw"
        if bottom and right:
            return "se"
        if top:
            return "n"
        if bottom:
            return "s"
        if left:
            return "w"
        if right:
            return "e"
        return None

    def mousePressEvent(self, event: QMouseEvent) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            edge = self._edge_at(event.position().toPoint())
            if edge:
                self._resize_edge = edge
                self._resize_start_pos = event.globalPosition().toPoint()
                self._resize_start_rect = self.frameGeometry()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent) -> None:
        if self._resize_edge:
            self._do_resize(event.globalPosition().toPoint())
            return
        edge = self._edge_at(event.position().toPoint())
        cursors = {
            "n": Qt.CursorShape.SizeVerCursor,
            "s": Qt.CursorShape.SizeVerCursor,
            "e": Qt.CursorShape.SizeHorCursor,
            "w": Qt.CursorShape.SizeHorCursor,
            "nw": Qt.CursorShape.SizeFDiagCursor,
            "se": Qt.CursorShape.SizeFDiagCursor,
            "ne": Qt.CursorShape.SizeBDiagCursor,
            "sw": Qt.CursorShape.SizeBDiagCursor,
        }
        if edge:
            self.setCursor(cursors.get(edge, Qt.CursorShape.ArrowCursor))
        else:
            self.unsetCursor()
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event: QMouseEvent) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self._resize_edge = None
        super().mouseReleaseEvent(event)

    def _do_resize(self, global_pos: QPoint) -> None:
        if not self._resize_start_pos or not self._resize_start_rect:
            return
        r = self._resize_start_rect
        dx = global_pos.x() - self._resize_start_pos.x()
        dy = global_pos.y() - self._resize_start_pos.y()
        x, y, w, h = r.x(), r.y(), r.width(), r.height()
        edge = self._resize_edge or ""
        if "e" in edge:
            w = max(420, w + dx)
        if "w" in edge:
            dw = max(420, w - dx) - w
            w = max(420, w - dx)
            x += dw
        if "s" in edge:
            h = max(400, h + dy)
        if "n" in edge:
            dh = max(400, h - dy) - h
            h = max(400, h - dy)
            y += dh
        self.setGeometry(QRect(x, y, w, h))
        self._resize_start_pos = global_pos
        self._resize_start_rect = self.frameGeometry()

    def closeEvent(self, event) -> None:
        self._tk_compat_closed = True
        cb = getattr(self, "_on_close_callback", None)
        if callable(cb):
            cb()
        super().closeEvent(event)
