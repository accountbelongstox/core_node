# -*- coding: utf-8 -*-
"""D4 Functions Panel Qt - same CONFIG (d4_settings.exp_farming_running) and API as Tk d4_panel."""

import threading
from typing import Optional, Dict

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QPushButton, QTextEdit, QFrame, QScrollArea,
)

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from providor.i18n_manager import i18n_manager
from controller.d4func.map_name_utils import get_current_map_name_from_shared_data
from runtime import is_shutdown_requested
from controller.d4_controller import get_d4_controller
from controller.d4func.screenshot_handler import get_screenshot_handler
from controller.d4func import get_ui_status_updater
from share.game_interface_data import get_d4_interface_data
from d4utils.d4_team_formation_checker import get_d4_team_formation_checker
from ui.components.debug_window import get_debug_window, close_debug_window

from ..theme.theme import UITheme
from ..unified_styles import UnifiedStyles
from ..utils.config_qt import config_set


class D4PanelQt(QWidget):
    """D4 Functions panel Qt: left sub-tab nav, right content (EXP farming control, status, debug, log). CONFIG: d4_settings.exp_farming_running."""

    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.d4_controller = get_d4_controller()
        self._log_list = []
        self._log_list_lock = threading.Lock()
        self.status_labels: Dict[str, QLabel] = {}
        self.subtab_buttons: Dict[str, QPushButton] = {}
        self.exp_farming_log: Optional[QTextEdit] = None
        self.exp_farming_btn: Optional[QPushButton] = None
        self.debug_btn: Optional[QPushButton] = None

        self._register_ui_status_callback()
        bg = UITheme.get_color("bg_primary")
        self.setStyleSheet(f"background-color: {bg};")
        self._create_layout()
        ColorPrint.register_callback(self.add_log_message)
        QTimer.singleShot(100, self._drain_log_queue)

    def _create_layout(self) -> None:
        main = QHBoxLayout(self)
        tab_pad = UnifiedStyles.TAB_PAD
        main.setContentsMargins(tab_pad, tab_pad, tab_pad, tab_pad)
        main.setSpacing(UnifiedStyles.SPACING["sm"])

        nav = QFrame()
        nav.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        nav.setMinimumWidth(120)
        nav_layout = QVBoxLayout(nav)
        nav_layout.setContentsMargins(UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["sm"])
        title = QLabel(i18n_manager.get_ui_text("d4_panel.title"))
        title.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']}; font-weight: bold;")
        nav_layout.addWidget(title)
        exp_btn = QPushButton(i18n_manager.get_ui_text("d4_panel.sub_tabs.exp_farming"))
        exp_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['accent']}; color: {UnifiedStyles.COLORS['text_primary']};")
        exp_btn.clicked.connect(self._show_exp_farming_tab)
        nav_layout.addWidget(exp_btn)
        self.subtab_buttons["exp_farming"] = exp_btn
        nav_layout.addStretch(1)
        main.addWidget(nav)

        self.content_container = QWidget()
        content_layout = QVBoxLayout(self.content_container)
        content_layout.setContentsMargins(0, 0, 0, 0)
        main.addWidget(self.content_container, 1)
        self._show_exp_farming_tab()

    def _set_active_subtab(self, tab_name: str) -> None:
        for name, btn in self.subtab_buttons.items():
            if name == tab_name:
                btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['accent']}; color: {UnifiedStyles.COLORS['text_primary']};")
            else:
                btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")

    def _show_exp_farming_tab(self) -> None:
        self._set_active_subtab("exp_farming")
        while self.content_container.layout() and self.content_container.layout().count():
            item = self.content_container.layout().takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        self._create_exp_farming_content()

    def _create_exp_farming_content(self) -> None:
        layout = self.content_container.layout() or QVBoxLayout(self.content_container)
        main_frame = QFrame()
        main_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_primary')};")
        frame_layout = QVBoxLayout(main_frame)

        control_frame = QHBoxLayout()
        self.exp_farming_btn = QPushButton(i18n_manager.get_ui_text("d4_panel.exp_farming.start_button"))
        self.exp_farming_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_success']}; color: {UnifiedStyles.COLORS['text_primary']};")
        self.exp_farming_btn.clicked.connect(self._toggle_exp_farming)
        control_frame.addWidget(self.exp_farming_btn)
        control_frame.addStretch(1)
        frame_layout.addLayout(control_frame)

        self._create_game_status_area(main_frame)
        frame_layout.addWidget(self._status_frame)
        self._create_debug_button_area(main_frame)
        frame_layout.addWidget(self._debug_frame)

        log_frame = QFrame()
        log_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_primary')};")
        log_layout = QVBoxLayout(log_frame)
        self.exp_farming_log = QTextEdit()
        self.exp_farming_log.setReadOnly(True)
        self.exp_farming_log.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_primary']}; color: {UnifiedStyles.COLORS['text_primary']}; font-family: monospace;")
        self.exp_farming_log.setMinimumHeight(200)
        log_layout.addWidget(self.exp_farming_log)
        frame_layout.addWidget(log_frame, 1)

        layout.addWidget(main_frame)
        self._add_exp_farming_log(i18n_manager.get_ui_text("d4_panel.exp_farming.status.ready"))
        self._update_game_status()

    def _create_game_status_area(self, parent: QWidget) -> None:
        self._status_frame = QFrame(parent)
        self._status_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        grid = QGridLayout(self._status_frame)
        labels_config = [
            (0, 0, "d4_panel.exp_farming.game_status.current_map", "current_map"),
            (0, 1, "d4_panel.exp_farming.game_status.game_state", "game_state"),
            (0, 2, "d4_panel.exp_farming.game_status.team_count", "team_count"),
            (0, 3, "d4_panel.exp_farming.game_status.dungeon_progress", "dungeon_progress"),
            (0, 4, "d4_panel.exp_farming.game_status.d4_running_status", "d4_running_status"),
            (1, 0, "d4_panel.exp_farming.game_status.screen_coordinates", "screen_coordinates"),
            (1, 1, "d4_panel.exp_farming.game_status.screen_size", "screen_size"),
            (1, 2, "d4_panel.exp_farming.game_status.map_switch_count", "map_switch_count"),
            (1, 3, "d4_panel.exp_farming.game_status.map_switch_state", "map_switch_state"),
            (1, 4, "d4_panel.exp_farming.game_status.reserved", "reserved_4"),
            (2, 0, "d4_panel.exp_farming.game_status.reserved", "reserved_5"),
            (2, 1, "d4_panel.exp_farming.game_status.reserved", "reserved_6"),
            (2, 2, "d4_panel.exp_farming.game_status.reserved", "reserved_7"),
            (2, 3, "d4_panel.exp_farming.game_status.reserved", "reserved_8"),
            (2, 4, "d4_panel.exp_farming.game_status.reserved", "reserved_9"),
        ]
        for row, col, label_key, value_key in labels_config:
            title_lbl = QLabel(i18n_manager.get_ui_text(label_key))
            title_lbl.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_secondary']}; font-size: 11px;")
            value_lbl = QLabel(i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.unknown"))
            value_lbl.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
            grid.addWidget(title_lbl, row * 2, col)
            grid.addWidget(value_lbl, row * 2 + 1, col)
            self.status_labels[value_key] = value_lbl

    def _create_debug_button_area(self, parent: QWidget) -> None:
        self._debug_frame = QFrame(parent)
        self._debug_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        layout = QHBoxLayout(self._debug_frame)
        self.debug_btn = QPushButton("Debug Images")
        self.debug_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        self.debug_btn.clicked.connect(self._toggle_debug_window)
        layout.addWidget(self.debug_btn)
        layout.addStretch(1)

    def _toggle_exp_farming(self) -> None:
        if not self.d4_controller.is_exp_farming_running():
            self._start_exp_farming()
        else:
            self._stop_exp_farming()

    def _start_exp_farming(self) -> None:
        self._add_exp_farming_log("Checking team status...")
        ColorPrint.blue("[D4] Checking team status before starting EXP farming")
        screenshot_handler = get_screenshot_handler()
        d4_data = get_d4_interface_data()
        ColorPrint.blue("[D4] Capturing screenshot to initialize window data...")
        if not screenshot_handler.capture_and_collect_info(d4_data):
            ColorPrint.yellow("[D4] Failed to capture screenshot, window data may be incomplete")
        else:
            ColorPrint.green(f"[D4] Window data initialized: fullscreen={d4_data.fullscreen_size}, window={d4_data.game_window_size}, windowed={d4_data.is_windowed_mode()}")
        team_checker = get_d4_team_formation_checker()
        if team_checker.run():
            d4_data = get_d4_interface_data()
            if d4_data.has_team is None:
                self._add_exp_farming_log("⚠️ Team status unknown, continuing anyway...")
                ColorPrint.yellow("[D4] Team status unknown")
            elif d4_data.has_team:
                self._add_exp_farming_log("✓ Team detected, starting EXP farming...")
                ColorPrint.green("[D4] Team detected")
            else:
                self._add_exp_farming_log("✗ No team detected, please form a team first")
                ColorPrint.red("[D4] No team detected, aborting start")
                return
        else:
            self._add_exp_farming_log("⚠️ Team check failed, continuing anyway...")
            ColorPrint.yellow("[D4] Team check failed")
        self.d4_controller.start_exp_farming()
        self.exp_farming_btn.setText(i18n_manager.get_ui_text("d4_panel.exp_farming.stop_button"))
        self.exp_farming_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_danger']}; color: {UnifiedStyles.COLORS['text_primary']};")
        config_set("d4_settings.exp_farming_running", True)
        self._add_exp_farming_log(f"[{i18n_manager.get_ui_text('d4_panel.exp_farming.status.running')}] EXP Farming started")
        ColorPrint.green("[D4] EXP Farming started via UI")

    def _stop_exp_farming(self) -> None:
        self.d4_controller.stop_exp_farming()
        self._reset_game_status_data()
        self.exp_farming_btn.setText(i18n_manager.get_ui_text("d4_panel.exp_farming.start_button"))
        self.exp_farming_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_success']}; color: {UnifiedStyles.COLORS['text_primary']};")
        config_set("d4_settings.exp_farming_running", False)
        self._add_exp_farming_log(f"[{i18n_manager.get_ui_text('d4_panel.exp_farming.status.stopped')}] EXP Farming stopped")
        ColorPrint.yellow("[D4] EXP Farming stopped via UI")

    def _add_exp_farming_log(self, message: str) -> None:
        if self.exp_farming_log is None:
            return
        self.exp_farming_log.append(message)
        self.exp_farming_log.verticalScrollBar().setValue(self.exp_farming_log.verticalScrollBar().maximum())

    def add_log_message(self, message: str, level: str = "INFO", color=None) -> None:
        if is_shutdown_requested():
            return
        if "[D4]" not in message and "D4" not in message:
            return
        with self._log_list_lock:
            self._log_list.append(message)
            if len(self._log_list) > 500:
                self._log_list = self._log_list[-500:]

    def _drain_log_queue(self) -> None:
        with self._log_list_lock:
            messages = list(self._log_list)
            self._log_list.clear()
        for msg in messages:
            self._add_exp_farming_log(msg)
        QTimer.singleShot(100, self._drain_log_queue)

    def _update_game_status(self) -> None:
        if not self.status_labels:
            return
        d4_data = get_d4_interface_data()
        current_map = get_current_map_name_from_shared_data()
        self._update_status_value("current_map", current_map)
        game_state = i18n_manager.get_ui_text("d4_panel.exp_farming.status.running") if self.d4_controller.is_exp_farming_running() else i18n_manager.get_ui_text("d4_panel.exp_farming.status.stopped")
        self._update_status_value("game_state", game_state)
        team_count, local_count, non_local_count = "0", "0", "0"
        if d4_data.team_health_info:
            team_count = str(d4_data.team_health_info.get("total_members", 0))
            local_count = str(d4_data.team_health_info.get("local_map_members", 0))
            non_local_count = str(d4_data.team_health_info.get("non_local_map_members", 0))
        self._update_status_value("team_count", f"{team_count} ({local_count}/{non_local_count})")
        dungeon_progress = "Unknown"
        if d4_data.detected_regions and "dungeon_progress" in d4_data.detected_regions:
            dungeon_progress = d4_data.detected_regions["dungeon_progress"]
        self._update_status_value("dungeon_progress", dungeon_progress)
        d4_running_status = i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.running") if self.d4_controller.is_exp_farming_running() else i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.stopped")
        self._update_status_value("d4_running_status", d4_running_status)
        screen_coordinates = "Unknown"
        if d4_data.window_offset and d4_data.window_offset != (0, 0):
            x, y = d4_data.window_offset
            screen_coordinates = f"({x}, {y})"
        self._update_status_value("screen_coordinates", screen_coordinates)
        screen_size = "Unknown"
        if d4_data.game_window_size and d4_data.game_window_size != (0, 0):
            w, h = d4_data.game_window_size
            mode = "Windowed" if d4_data.is_windowed_mode() else "Fullscreen"
            screen_size = f"{w}x{h} ({mode})"
        self._update_status_value("screen_size", screen_size)
        self._update_status_value("map_switch_count", str(d4_data.map_switch_count))
        if d4_data.is_switching_map:
            map_switch_state = "Switching"
        elif d4_data.is_post_switch_idle:
            map_switch_state = "Post-Switch"
        else:
            map_switch_state = "Normal"
        self._update_status_value("map_switch_state", map_switch_state)
        for i in range(4, 10):
            self._update_status_value(f"reserved_{i}", "-")

    def _update_status_value(self, key: str, value: str) -> None:
        if key in self.status_labels:
            self.status_labels[key].setText(str(value))

    def _reset_game_status_data(self) -> None:
        get_d4_interface_data().clear()
        self._update_game_status()

    def _register_ui_status_callback(self) -> None:
        get_ui_status_updater().set_ui_update_callback(self._on_ui_status_update)
        ColorPrint.blue("[D4Panel] UI status update callback registered")

    def _on_ui_status_update(self, status_data: dict) -> None:
        QTimer.singleShot(0, lambda: self._update_status_from_data(status_data))

    def _update_status_from_data(self, status_data: dict) -> None:
        if not self.status_labels:
            return
        for key, value in status_data.items():
            translated = self._translate_status_value(key, str(value))
            self._update_status_value(key, translated)

    def _translate_status_value(self, key: str, value: str) -> str:
        if key in ("d4_running_status", "game_state"):
            if value == "Running":
                return i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.running")
            if value == "Stopped":
                return i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.stopped")
        if key == "screen_size" and value != "Unknown":
            if "(Windowed)" in value:
                return value.replace("(Windowed)", f"({i18n_manager.get_ui_text('d4_panel.exp_farming.game_status.windowed')})")
            if "(Fullscreen)" in value:
                return value.replace("(Fullscreen)", f"({i18n_manager.get_ui_text('d4_panel.exp_farming.game_status.fullscreen')})")
        if value == "Unknown":
            return i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.unknown")
        return value

    def _toggle_debug_window(self) -> None:
        d4_data = get_d4_interface_data()
        if not d4_data.debug_window_open:
            debug_win = get_debug_window(None)
            if debug_win is not None:
                d4_data.debug_window_open = True
                self.debug_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['accent']}; color: {UnifiedStyles.COLORS['text_primary']};")
                debug_win.show()
                ColorPrint.green("[D4Panel] Debug window opened")
            else:
                ColorPrint.yellow("[D4Panel] Debug window requires Tk parent; not available in Qt build")
        else:
            close_debug_window()
            d4_data.debug_window_open = False
            self.debug_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
            ColorPrint.yellow("[D4Panel] Debug window closed")
