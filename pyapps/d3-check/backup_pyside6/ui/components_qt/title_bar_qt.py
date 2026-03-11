# -*- coding: utf-8 -*-
"""Qt Title Bar: drag, language combo, min/max/restore/restart/close."""

from PySide6.QtCore import Qt, QEvent
from PySide6.QtWidgets import QWidget, QHBoxLayout, QLabel, QPushButton, QComboBox
from PySide6.QtGui import QMouseEvent

from providor.i18n_manager import i18n_manager
from ..theme.theme import UITheme


class _BtnCompat:
    """Tk configure(text=...) compat for event_center title_bar.maximize_btn."""
    def __init__(self, qbtn):
        self._q = qbtn
    def configure(self, **kwargs):
        if "text" in kwargs:
            self._q.setText(str(kwargs["text"]))


class TitleBarQt(QWidget):
    """Title bar with title label (drag), language combo, window buttons."""

    def __init__(self, parent_ui):
        super().__init__()
        self.parent_ui = parent_ui
        self._drag_start = None
        bg = UITheme.get_color("bg_primary")
        border = UITheme.get_color("border_primary")
        self.setStyleSheet(f"background-color: {bg}; border-bottom: 2px solid {border};")
        self.setFixedHeight(28)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(12, 3, 10, 3)
        layout.setSpacing(8)

        self._title_label = QLabel(i18n_manager.get_ui_text("main_window.title"))
        self._title_label.setStyleSheet(f"color: {UITheme.get_color('text_secondary')}; font-weight: bold; font-size: 9px;")
        self._title_label.setCursor(Qt.CursorShape.SizeAllCursor)
        layout.addWidget(self._title_label, 1)
        self._title_label.mousePressEvent = self._start_drag
        self._title_label.mouseMoveEvent = self._on_drag
        self._title_label.mouseReleaseEvent = self._end_drag
        self._title_label.mouseDoubleClickEvent = self._on_title_double_click

        self._lang_combo = QComboBox()
        self._lang_combo.addItems(["zh", "en"])
        current = __import__("providor.providor_index", fromlist=["get_config_value_safe"]).get_config_value_safe("ui_settings.current_language", "zh")
        idx = self._lang_combo.findText(current)
        if idx >= 0:
            self._lang_combo.setCurrentIndex(idx)
        self._lang_combo.currentTextChanged.connect(self._on_language_changed)
        layout.addWidget(self._lang_combo)

        for text, slot in [
            ("−", self._minimize),
            ("□", self._toggle_maximize),
            ("⧉", self._restore_preset),
            ("↻", self._restart),
            ("×", self._close),
        ]:
            btn = QPushButton(text)
            if text == "□":
                self._max_btn = btn
            if text == "×":
                btn.setObjectName("closeBtn")
            btn.setFixedSize(24, 22)
            btn.clicked.connect(slot)
            layout.addWidget(btn)
        self.maximize_btn = _BtnCompat(self._max_btn)

        i18n_manager.add_language_change_listener(self._on_language_updated)

    def _start_drag(self, event: QMouseEvent):
        if event.button() == Qt.MouseButton.LeftButton:
            self._drag_start = (event.globalPosition().toPoint(), self.parent_ui.root.frameGeometry().topLeft())

    def _on_drag(self, event: QMouseEvent):
        if self._drag_start is None:
            return
        now = event.globalPosition().toPoint()
        delta = now - self._drag_start[0]
        new_pos = self._drag_start[1] + delta
        self.parent_ui.root.geometry(f"+{new_pos.x()}+{new_pos.y()}")

    def _end_drag(self, event: QMouseEvent):
        if event.button() == Qt.MouseButton.LeftButton:
            self._drag_start = None

    def _on_title_double_click(self, event):
        self._toggle_maximize()

    def _on_language_changed(self, lang: str):
        from providor.providor_index import set_config_value_async
        set_config_value_async("ui_settings.current_language", lang)
        i18n_manager.set_language(lang)

    def _on_language_updated(self, new_language: str):
        self._title_label.setText(i18n_manager.get_ui_text("main_window.title"))
        if self._lang_combo.currentText() != new_language:
            self._lang_combo.blockSignals(True)
            self._lang_combo.setCurrentText(new_language)
            self._lang_combo.blockSignals(False)

    def update_title(self, text: str):
        self._title_label.setText(text)

    def _minimize(self):
        from runtime import trigger_window_minimize
        trigger_window_minimize()

    def _toggle_maximize(self):
        from runtime import trigger_window_maximize
        trigger_window_maximize()

    def _restore_preset(self):
        self.parent_ui.restore_window_to_preset()

    def _restart(self):
        from runtime import trigger_app_restart
        trigger_app_restart()

    def _close(self):
        from runtime import trigger_app_exit
        trigger_app_exit()
