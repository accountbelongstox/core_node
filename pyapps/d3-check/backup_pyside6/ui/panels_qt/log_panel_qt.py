# -*- coding: utf-8 -*-
"""
Log Panel Qt - 1:1 with Tk log_panel.
CONFIG: log_settings.show_debug_logs, log_settings.auto_scroll, log_settings.log_level.
"""

import re
import datetime
from typing import Optional

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QPushButton, QCheckBox, QComboBox, QTextEdit,
    QFrame, QFileDialog,
)

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from providor.i18n_manager import i18n_manager
from providor.providor_index import CONFIG
from share.ui_registry import get_ui
from providor.constants.ui import PANEL_KEY_ROSBOT
import timers.timer_manager as timer_manager
from controller.ctl_func.blacksmith_handler import get_blacksmith_handler
from d3utils.debug_bag_hover import run_debug_bag_hover

from ..theme.theme import UITheme
from ..unified_styles import UnifiedStyles
from ..utils.config_qt import config_get, config_set


def _strip_ui_log_prefix(msg: str) -> str:
    """Remove [ROSBOT], [ROSBOT~*s], [LogAnalyzer] prefix for UI log display."""
    return re.sub(r'^\[(?:ROSBOT|ROSBOT~[^\]]*|LogAnalyzer)\]\s*', '', msg)


class LogPanelQt(QWidget):
    """Log Panel Qt - same CONFIG keys and 1:1 test/control/log as Tk LogPanel."""

    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.log_text: Optional[QTextEdit] = None
        self.level_combo: Optional[QComboBox] = None
        self._destroyed = False
        bg = UITheme.get_color("bg_primary")
        self.setStyleSheet(f"background-color: {bg};")
        main = QVBoxLayout(self)
        tab_pad = UnifiedStyles.TAB_PAD
        main.setContentsMargins(tab_pad, tab_pad, tab_pad, tab_pad)
        main.setSpacing(UnifiedStyles.SPACING["sm"])

        self._create_test_panel(main)
        self._create_control_panel(main)
        self._create_log_display(main)
        main.setStretch(2, 1)

    def _create_test_panel(self, main: QVBoxLayout) -> None:
        test_frame = QFrame()
        test_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        test_frame.setObjectName("test_functions")
        layout = QVBoxLayout(test_frame)
        layout.setContentsMargins(UnifiedStyles.SPACING["xs"], UnifiedStyles.SPACING["xs"], UnifiedStyles.SPACING["xs"], UnifiedStyles.SPACING["xs"])
        title = QLabel(i18n_manager.get_ui_text("log_panel.test_functions"))
        title.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']}; font-weight: bold;")
        layout.addWidget(title)
        grid = QGridLayout()
        cols_per_row = 8
        test_buttons = [
            ("log_panel.bag_test", self._test_bag),
            ("log_panel.yellow_upgrade", self._test_yellow_upgrade),
            ("log_panel.item_reforge", self._test_item_reforge),
            ("log_panel.test_pathfinding", self._test_pathfinding),
            ("auxiliary_panel.debug_blood_shard", self._debug_blood_shard),
            ("auxiliary_panel.debug_quick_pickup", self._debug_quick_pickup),
            ("auxiliary_panel.debug_blacksmith", self._debug_blacksmith),
            ("auxiliary_panel.debug_kanai_reforge", self._debug_kanai_reforge),
            ("auxiliary_panel.debug_kanai_upgrade", self._debug_kanai_upgrade),
            ("auxiliary_panel.debug_kanai_convert", self._debug_kanai_convert),
            ("auxiliary_panel.debug_auto_salvage", self._debug_auto_salvage),
            ("auxiliary_panel.debug_drop_equipment", self._debug_drop_equipment),
            ("auxiliary_panel.debug_sound_feedback", self._debug_sound_feedback),
            ("auxiliary_panel.debug_smart_pause", self._debug_smart_pause),
            ("rosbot.debug_battlenet_ui", self._debug_battlenet_ui_json),
            ("rosbot.debug_rosbot", self._debug_rosbot),
        ]
        pad = UnifiedStyles.SPACING["xs"]
        for i, (text_key, command) in enumerate(test_buttons):
            row, col = i // cols_per_row, i % cols_per_row
            btn = QPushButton(i18n_manager.get_ui_text(text_key))
            btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
            btn.clicked.connect(command)
            grid.addWidget(btn, row, col)
        layout.addLayout(grid)
        main.addWidget(test_frame)

    def _create_control_panel(self, main: QVBoxLayout) -> None:
        control_frame = QFrame()
        control_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        row = QHBoxLayout(control_frame)
        row.setContentsMargins(UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["sm"])

        clear_btn = QPushButton(i18n_manager.get_ui_text("log_panel.clear_logs"))
        clear_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        clear_btn.clicked.connect(self.clear_logs)
        row.addWidget(clear_btn)

        save_btn = QPushButton(i18n_manager.get_ui_text("log_panel.save_log"))
        save_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        save_btn.clicked.connect(self.save_logs)
        row.addWidget(save_btn)

        show_debug = config_get("log_settings.show_debug_logs", True)
        self._show_debug_cb = QCheckBox(i18n_manager.get_ui_text("log_panel.show_debug_logs"))
        self._show_debug_cb.setChecked(bool(show_debug))
        self._show_debug_cb.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
        self._show_debug_cb.stateChanged.connect(
            lambda s: config_set("log_settings.show_debug_logs", s == Qt.CheckState.Checked.value)
        )
        row.addWidget(self._show_debug_cb)

        auto_scroll = config_get("log_settings.auto_scroll", True)
        self._auto_scroll_cb = QCheckBox(i18n_manager.get_ui_text("log_panel.auto_scroll"))
        self._auto_scroll_cb.setChecked(bool(auto_scroll))
        self._auto_scroll_cb.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
        self._auto_scroll_cb.stateChanged.connect(
            lambda s: config_set("log_settings.auto_scroll", s == Qt.CheckState.Checked.value)
        )
        row.addWidget(self._auto_scroll_cb)

        row.addStretch(1)
        level_values = ["ALL", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        current_level = config_get("log_settings.log_level", "INFO")
        self.level_combo = QComboBox()
        self.level_combo.addItems(level_values)
        idx = self.level_combo.findText(current_level if current_level in level_values else "INFO")
        self.level_combo.setCurrentIndex(idx if idx >= 0 else 1)
        self.level_combo.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']}; min-width: 90px;")
        self.level_combo.currentTextChanged.connect(lambda v: config_set("log_settings.log_level", v))
        row.addWidget(self.level_combo)

        scan_btn = QPushButton(i18n_manager.get_ui_text("log_panel.scan_log_area"))
        scan_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_secondary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        scan_btn.clicked.connect(self._scan_and_report_log_area)
        row.addWidget(scan_btn)

        main.addWidget(control_frame)

    def _create_log_display(self, main: QVBoxLayout) -> None:
        log_frame = QFrame()
        log_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        layout = QVBoxLayout(log_frame)
        title = QLabel(i18n_manager.get_ui_text("log_panel.log_output"))
        title.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
        layout.addWidget(title)
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setStyleSheet(
            f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']}; font-family: monospace;"
        )
        self.log_text.setMinimumHeight(200)
        layout.addWidget(self.log_text)
        main.addWidget(log_frame, 1)

    def log_area_exists(self) -> tuple:
        """Return (container_exists, log_text_exists) for the tab log area."""
        container_ok = self.isVisible() or not self._destroyed
        log_text_ok = self.log_text is not None
        return (container_ok, log_text_ok)

    def _scan_and_report_log_area(self) -> None:
        container_ok, log_text_ok = self.log_area_exists()
        ColorPrint.blue(f"[LogPanel] Log area scan: container={container_ok}, log_text={log_text_ok}")

    def add_log_message(self, level_or_message, message_or_color=None) -> None:
        """Add a log message. ColorPrint calls (message, color_type); Tk compat (level, message)."""
        if self.log_text is None or self.level_combo is None:
            return
        message = str(level_or_message)
        level = "INFO"
        if message_or_color is not None:
            second = str(message_or_color)
            if second.upper() in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"):
                level = second.upper()
            elif second == "SUCCESS":
                level = "INFO"
            elif second in ("gray", "green", "red", "yellow", "white", "blue", "cyan"):
                level = {"gray": "DEBUG", "red": "ERROR", "yellow": "WARNING"}.get(second, "INFO")
        else:
            level = "INFO"
        show_debug = config_get("log_settings.show_debug_logs", True)
        if level == "DEBUG" and not show_debug:
            return
        current_level = self.level_combo.currentText() if self.level_combo else "ALL"
        level_map = {"DEBUG": 0, "INFO": 1, "WARNING": 2, "ERROR": 3, "CRITICAL": 4}
        msg_level = level_map.get(level, 1)
        filter_level = level_map.get(current_level, 0) if current_level != "ALL" else 0
        if current_level != "ALL" and msg_level < filter_level:
            return
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        formatted = f"[{timestamp}] [{level}] {_strip_ui_log_prefix(message)}\n"
        self.log_text.setReadOnly(False)
        self.log_text.append(formatted.rstrip("\n"))
        auto_scroll = config_get("log_settings.auto_scroll", True)
        if auto_scroll:
            self.log_text.verticalScrollBar().setValue(self.log_text.verticalScrollBar().maximum())
        self.log_text.setReadOnly(True)

    def clear_logs(self) -> None:
        if self.log_text is not None:
            self.log_text.setReadOnly(False)
            self.log_text.clear()
            self.log_text.setReadOnly(True)

    def save_logs(self) -> None:
        if self.log_text is None:
            return
        path, _ = QFileDialog.getSaveFileName(
            self,
            "",
            "",
            "Text files (*.txt);;All files (*.*)",
            "",
            QFileDialog.Option.DontUseNativeDialog,
        )
        if path:
            try:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(self.log_text.toPlainText())
                ColorPrint.green(f"[LogPanel] Logs saved to {path}")
            except Exception as e:
                ColorPrint.red(f"[LogPanel] Failed to save logs: {e}")

    def _test_bag(self) -> None:
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.bag_test')}] {i18n_manager.get_ui_text('log_panel.bag_test_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.bag_test')}] {i18n_manager.get_ui_text('log_panel.bag_test_complete')}")

    def _test_yellow_upgrade(self) -> None:
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.yellow_upgrade')}] {i18n_manager.get_ui_text('log_panel.yellow_upgrade_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.yellow_upgrade')}] {i18n_manager.get_ui_text('log_panel.yellow_upgrade_complete')}")

    def _test_item_reforge(self) -> None:
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.item_reforge')}] {i18n_manager.get_ui_text('log_panel.item_reforge_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.item_reforge')}] {i18n_manager.get_ui_text('log_panel.item_reforge_complete')}")

    def _test_pathfinding(self) -> None:
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.test_pathfinding')}] {i18n_manager.get_ui_text('log_panel.test_pathfinding_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.test_pathfinding')}] {i18n_manager.get_ui_text('log_panel.test_pathfinding_complete')}")

    def _debug_blood_shard(self) -> None:
        ColorPrint.blue("[AuxPanel] Debug: blood_shard (placeholder)")

    def _debug_quick_pickup(self) -> None:
        ColorPrint.blue("[AuxPanel] Debug: quick_pickup (placeholder)")

    def _debug_blacksmith(self) -> None:
        def on_blacksmith_debug():
            aux = (CONFIG.get("macro_configs", {}) or {}).get("auxiliary_config", {}) or {}
            keep = (aux.get("auto_salvage") or {}).get("keep", "keep_ancient_plus")
            get_blacksmith_handler().handle_auto_salvage_by_slots(keep, debug_only=False)
        timer_manager.submit_one_shot(lambda: run_debug_bag_hover(on_blacksmith_debug=on_blacksmith_debug))

    def _debug_kanai_reforge(self) -> None:
        ColorPrint.blue("[AuxPanel] Debug: kanai_reforge (placeholder)")

    def _debug_kanai_upgrade(self) -> None:
        def on_blacksmith_debug():
            aux = (CONFIG.get("macro_configs", {}) or {}).get("auxiliary_config", {}) or {}
            keep = (aux.get("auto_salvage") or {}).get("keep", "keep_ancient_plus")
            get_blacksmith_handler().handle_auto_salvage_by_slots(keep, debug_only=False)
        timer_manager.submit_one_shot(lambda: run_debug_bag_hover(on_blacksmith_debug=on_blacksmith_debug))

    def _debug_kanai_convert(self) -> None:
        ColorPrint.blue("[AuxPanel] Debug: kanai_convert (placeholder)")

    def _debug_auto_salvage(self) -> None:
        ColorPrint.blue("[AuxPanel] Debug: auto_salvage (placeholder)")

    def _debug_drop_equipment(self) -> None:
        ColorPrint.blue("[AuxPanel] Debug: drop_equipment (placeholder)")

    def _debug_sound_feedback(self) -> None:
        ColorPrint.blue("[AuxPanel] Debug: sound_feedback (placeholder)")

    def _debug_smart_pause(self) -> None:
        ColorPrint.blue("[AuxPanel] Debug: smart_pause (placeholder)")

    def _debug_battlenet_ui_json(self) -> None:
        ui = get_ui()
        if ui:
            panel = ui.get_panel(PANEL_KEY_ROSBOT)
            if panel and hasattr(panel, "_debug_battlenet_ui_json"):
                panel._debug_battlenet_ui_json()

    def _debug_rosbot(self) -> None:
        ui = get_ui()
        if ui:
            panel = ui.get_panel(PANEL_KEY_ROSBOT)
            if panel and hasattr(panel, "_debug_rosbot"):
                panel._debug_rosbot()
