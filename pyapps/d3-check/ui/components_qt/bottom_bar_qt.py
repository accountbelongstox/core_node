# -*- coding: utf-8 -*-
"""Qt Bottom Bar: status row and options row (same API as Tk BottomBar for controller/window_monitor)."""

from typing import Optional, Callable

from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame
from PySide6.QtCore import Qt

from providor.i18n_manager import i18n_manager
from runtime import is_shutdown_requested
from ..theme.theme import UITheme
from ..unified_styles import UnifiedStyles


class BottomBarQt(QWidget):
    """Bottom bar: row0 = macro + options, row1 = status. Same API as Tk version."""

    def __init__(self, parent_ui):
        super().__init__()
        self.parent_ui = parent_ui
        self._value_labels = {}
        self._region_changed_callback: Optional[Callable[[], None]] = None
        bg = UITheme.get_color("bg_primary")
        self.setStyleSheet(f"background-color: {bg};")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(UnifiedStyles.TAB_PAD, 0, UnifiedStyles.TAB_PAD, UnifiedStyles.TAB_PAD // 2)
        layout.setSpacing(4)

        # Row 0: macro slot (left) + options (right)
        row0 = QHBoxLayout()
        self._macro_slot = QWidget()
        self._macro_slot.setStyleSheet(f"background-color: {bg};")
        macro_slot_layout = QHBoxLayout(self._macro_slot)
        macro_slot_layout.setContentsMargins(0, 0, 0, 0)
        row0.addWidget(self._macro_slot)
        row0.addStretch(1)
        self._config_label = QLabel("Config 1")
        self._config_label.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']}; font-size: 9px;")
        row0.addWidget(self._config_label)
        layout.addLayout(row0)

        # Row 1: status
        status_row = QHBoxLayout()
        self._window_size_label = QLabel("0x0")
        self._window_size_label.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']}; font-size: 9px;")
        status_row.addWidget(self._window_size_label)
        status_row.addStretch(1)
        layout.addLayout(status_row)

        # Row 2: path icons BN/D3/D4/ROS + extra slot for ROSBOT tab scan button
        self._row3_widget = QWidget()
        self._row3_widget.setStyleSheet(f"background-color: {bg};")
        row3_layout = QHBoxLayout(self._row3_widget)
        row3_layout.setContentsMargins(0, 2, 0, 2)
        row3_layout.addStretch(1)
        self._row3_extra = QWidget()
        row3_extra_layout = QHBoxLayout(self._row3_extra)
        row3_extra_layout.setContentsMargins(0, 0, 0, 0)
        row3_layout.addWidget(self._row3_extra)
        layout.addLayout(row3_layout)

        self._value_labels["window_size"] = self._window_size_label
        self._option_sound = True
        self._option_smart_pause = True
        self._option_custom_stand = False
        self._option_custom_stand_key = "Shift"

    def set_option_state(
        self,
        sound: bool = True,
        smart_pause: bool = True,
        custom_stand: bool = False,
        custom_stand_key: str = "Shift",
    ) -> None:
        """Sync option state from Main Functions Panel (tab 0) so get_* return correct values."""
        self._option_sound = sound
        self._option_smart_pause = smart_pause
        self._option_custom_stand = custom_stand
        self._option_custom_stand_key = custom_stand_key or "Shift"

    @property
    def frame(self) -> QWidget:
        """Compat: parent code may do bottom_bar.frame."""
        return self

    def add_macro_controls(self, macro_widget: QWidget):
        """Called by main UI to place macro controls in row0."""
        self._macro_slot.layout().addWidget(macro_widget)

    def set_region_changed_callback(self, cb: Optional[Callable[[], None]]) -> None:
        """Called by ROSBOT panel to get path scan on region change."""
        self._region_changed_callback = cb

    def get_row3_scan_container(self) -> QWidget:
        """Return widget where ROSBOT panel can add one-click scan button (row 3 right)."""
        return self._row3_extra

    def refresh_path_icons(self) -> None:
        """Refresh path validity icons (BN/D3/D4/ROS); minimal no-op."""
        pass

    def show_tab_content(self, tab_index: int):
        """Per-tab options; no-op for minimal."""
        pass

    def update_config_status(self, config_name: str):
        self._config_label.setText(config_name)

    def get_sound_enabled(self) -> bool:
        return getattr(self, "_option_sound", True)

    def get_smart_pause_enabled(self) -> bool:
        return getattr(self, "_option_smart_pause", True)

    def get_custom_stand_key(self) -> Optional[str]:
        if getattr(self, "_option_custom_stand", False):
            return getattr(self, "_option_custom_stand_key", "Shift")
        return None

    def on_window_status_update(self, window_info):
        if is_shutdown_requested():
            return
        self.parent_ui.root.after(0, lambda: self._do_window_status_ui_update(window_info))

    def _do_window_status_ui_update(self, window_info):
        if window_info:
            w = window_info.get("width", 0)
            h = window_info.get("height", 0)
            fmt = i18n_manager.get_ui_text("ui.status_bar.size_format") or "{width}x{height}"
            self._window_size_label.setText(fmt.format(width=w, height=h))
            self._window_size_label.setStyleSheet(f"color: {UnifiedStyles.COLORS['success']}; font-size: 9px;")
        else:
            self._window_size_label.setText("0x0")
            self._window_size_label.setStyleSheet(f"color: {UnifiedStyles.COLORS['error']}; font-size: 9px;")

    def update_status_from_state(self, state: dict):
        """Update status from window monitor state."""
        # Minimal: just window size if present
        w = state.get("width", 0)
        h = state.get("height", 0)
        if w and h:
            fmt = i18n_manager.get_ui_text("ui.status_bar.size_format") or "{width}x{height}"
            self._window_size_label.setText(fmt.format(width=w, height=h))

    def pack(self, **kwargs):
        pass

    def grid(self, **kwargs):
        pass
