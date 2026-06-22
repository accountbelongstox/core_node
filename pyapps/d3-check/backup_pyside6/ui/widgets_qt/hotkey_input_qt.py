# -*- coding: utf-8 -*-
"""Qt hotkey input: QLineEdit that captures key and emits canonical hotkey string."""

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QKeyEvent
from PySide6.QtWidgets import QLineEdit

from ..theme.theme import UITheme
from ..unified_styles import UnifiedStyles
from providor.i18n_manager import i18n_manager
from d3utils.d3u_common.hotkey_registry import normalize_hotkey_canonical

# Qt key -> canonical segment (same as Tk KEY_NAME_CANONICAL_MAP)
_QT_KEY_CANONICAL = {
    Qt.Key.Key_Control: "ctrl",
    Qt.Key.Key_Shift: "shift",
    Qt.Key.Key_Alt: "alt",
    Qt.Key.Key_Meta: "win",
    Qt.Key.Key_Space: "space",
    Qt.Key.Key_Return: "enter",
    Qt.Key.Key_Backspace: "backspace",
    Qt.Key.Key_Tab: "tab",
    Qt.Key.Key_Escape: "esc",
    Qt.Key.Key_Delete: "del",
    Qt.Key.Key_Insert: "ins",
    Qt.Key.Key_Home: "home",
    Qt.Key.Key_End: "end",
    Qt.Key.Key_PageUp: "pageup",
    Qt.Key.Key_PageDown: "pagedown",
    Qt.Key.Key_Up: "up",
    Qt.Key.Key_Down: "down",
    Qt.Key.Key_Left: "left",
    Qt.Key.Key_Right: "right",
}

_modifier_order = ("ctrl", "shift", "alt", "win")


def _main_key_canonical(qt_key: Qt.Key, text: str) -> str:
    if qt_key in _QT_KEY_CANONICAL:
        return _QT_KEY_CANONICAL[qt_key]
    try:
        if Qt.Key.Key_F1 <= qt_key <= Qt.Key.Key_F35:
            return f"f{int(qt_key) - int(Qt.Key.Key_F1) + 1}"
    except TypeError:
        pass
    if text and len(text) == 1:
        return text.lower()
    return str(qt_key).lower().replace("qt.key.key_", "")


class HotkeyInputQt(QLineEdit):
    """Read-only line edit: focus + key press captures hotkey, emits hotkey_changed(canonical_str)."""

    hotkey_changed = Signal(str)

    def __init__(self, parent=None, initial_value: str = ""):
        super().__init__(parent)
        self.setReadOnly(True)
        self._current_hotkey = normalize_hotkey_canonical(initial_value) if initial_value else ""
        self._modifiers = set()
        self._capturing = False
        bg = UITheme.get_color("input_bg")
        fg = UITheme.get_color("text_primary")
        self.setStyleSheet(
            f"QLineEdit {{ background-color: {bg}; color: {fg}; border: 1px solid {UnifiedStyles.COLORS['input_border']}; padding: 4px; font-size: 9px; }}"
        )
        if self._current_hotkey:
            self.setText(self._current_hotkey)
        else:
            self.setPlaceholderText(i18n_manager.get_ui_text("hotkey_input.placeholder") or "Click and press key")

    def keyPressEvent(self, event: QKeyEvent) -> None:
        if not self._capturing:
            super().keyPressEvent(event)
            return
        key = event.key()
        if key in (Qt.Key.Key_Escape, Qt.Key.Key_Delete):
            self._current_hotkey = ""
            self._modifiers.clear()
            self.setText("")
            self.hotkey_changed.emit("")
            event.accept()
            return
        if key in (Qt.Key.Key_Control, Qt.Key.Key_Shift, Qt.Key.Key_Alt, Qt.Key.Key_Meta):
            if key in _QT_KEY_CANONICAL:
                self._modifiers.add(_QT_KEY_CANONICAL[key])
            event.accept()
            return
        parts = [m for m in _modifier_order if m in self._modifiers]
        parts.append(_main_key_canonical(key, event.text()))
        canonical = "+".join(parts)
        self._current_hotkey = canonical
        self.setText(canonical)
        self.hotkey_changed.emit(canonical)
        event.accept()

    def keyReleaseEvent(self, event: QKeyEvent) -> None:
        if event.key() in (Qt.Key.Key_Control, Qt.Key.Key_Shift, Qt.Key.Key_Alt, Qt.Key.Key_Meta):
            if event.key() in _QT_KEY_CANONICAL:
                self._modifiers.discard(_QT_KEY_CANONICAL[event.key()])
        super().keyReleaseEvent(event)

    def focusInEvent(self, event) -> None:
        self._capturing = True
        self._modifiers.clear()
        super().focusInEvent(event)

    def focusOutEvent(self, event) -> None:
        self._capturing = False
        self._modifiers.clear()
        super().focusOutEvent(event)

    def set_hotkey(self, hotkey: str) -> None:
        """Set displayed value (e.g. when switching config)."""
        self._current_hotkey = normalize_hotkey_canonical(hotkey) if hotkey else ""
        self.setText(self._current_hotkey)
