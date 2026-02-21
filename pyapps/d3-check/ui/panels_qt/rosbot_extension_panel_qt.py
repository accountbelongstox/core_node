# -*- coding: utf-8 -*-
"""ROSBOT Extension Panel Qt - same CONFIG keys and API as Tk rosbot_extension_panel."""

import os
import re
import time
from typing import Optional, Callable, Any

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QLineEdit, QPushButton, QCheckBox, QSpinBox,
    QTextEdit, QScrollArea, QFrame, QFileDialog, QMessageBox,
    QMenu, QApplication,
)
from PySide6.QtGui import QAction

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import get_config_value_safe, LOGS_FILE_PATH
from providor.i18n_manager import i18n_manager
from share.game_interface_data import get_game_interface_data
from timers.one_shot_tasks import do_path_scan, do_rosbot_update, do_window_monitor_initial_check
from d3utils.path_scanner import pick_best_rosbot_dir_by_region, are_paths_valid_for_skip_scan
from pycore.pyutils.system_launcher import open_file_with_notepad
from providor.constants.common import TAMPERMONKEY_SCRIPT_PATH
from providor.constants.d3 import DIABLO_III_EXE_NAME, BATTLE_NET_EXE_NAME, ROSBOT_DIR_NAMESPACE_ASIA, ROSBOT_DIR_NAMESPACE_CN
from runtime import (
    get_task_manager,
    TaskStatus,
    D3ExtensionThread,
    get_d3_extension_thread,
    trigger_extension_rosbot_stop,
    is_shutdown_requested,
)
from ui.panels.log_panel import _strip_ui_log_prefix
import timers.timer_manager as timer_manager
import d3utils.rosbot_task_processor as rosbot_processor
from controller.login_try_screenshot_controller import get_login_try_screenshot_controller
from d3utils.rosbot_flow_battlenet import reset_flow_master_bn_block
from d3utils.log_monitor_api import get_last_log_modified_time
from d3utils.rosbot_flow_state import set_flow_master_enabled, set_bn_only_enabled
from share.asia_credentials import schedule_battlenet_credentials_dialog

from ..theme.theme import UITheme
from ..unified_styles import UnifiedStyles
from ..utils.config_qt import config_get, config_set

ROSBOT_PANEL_CONFIG_KEYS = [
    ("ros_settings.ros_directory", "D:\\applications\\GamesBot\\ros-bot7.18\\ros-bot7.18"),
    ("battlenet.battlenet_path", "D:\\applications\\Games\\Battle.net\\Battle.net.exe"),
    ("d3.d3_path", ""),
    ("ros_settings.auto_enable_latest_ros", True),
    ("rosbot.pickup_blood_shards", False),
    ("rosbot.prevent_stuck", False),
    ("rosbot.blue_portal_priority", False),
    ("rosbot.smart_echo", False),
    ("rosbot.smart_echo_wait_seconds", 15),
    ("rosbot.startup", False),
    ("rosbot.firstborn_blue_gate_reuse", False),
    ("rosbot.test_mode", False),
    ("rosbot.test_timeout_minutes", 30),
    ("battlenet.timeout_restart", True),
    ("rosbot.timeout_minutes", 8),
]


def _fetch_rosbot_config_then_create(panel: "RosbotExtensionPanelQt") -> None:
    """Timer thread: fetch config snapshot, then schedule UI creation on main."""
    if panel._content_created:
        return
    snapshot = {}
    for key_path, default in ROSBOT_PANEL_CONFIG_KEYS:
        snapshot[key_path] = get_config_value_safe(key_path, default)

    def on_main():
        if panel._content_created:
            return
        panel._create_content_with_snapshot(snapshot)

    try:
        QTimer.singleShot(0, on_main)
    except Exception:
        pass


def _fetch_rosbot_config_on_main_then_create(panel: "RosbotExtensionPanelQt") -> None:
    """Main thread: build snapshot and create UI."""
    if panel._content_created:
        return
    snapshot = {}
    for key_path, default in ROSBOT_PANEL_CONFIG_KEYS:
        snapshot[key_path] = get_config_value_safe(key_path, default)
    if panel._content_created:
        return
    panel._create_content_with_snapshot(snapshot)


class RosbotExtensionPanelQt(QWidget):
    """ROSBOT Extension panel Qt - same CONFIG and API as Tk."""

    def __init__(self, parent, bottom_bar=None):
        super().__init__(parent)
        self.parent = parent
        self._bottom_bar = bottom_bar
        self._path_scan_submit_time = 0.0
        if self._bottom_bar is not None:
            self._bottom_bar.set_region_changed_callback(self._submit_path_scan_if_throttle_ok)

        self.rosbot_running = False
        self._d3_extension_thread: Optional[D3ExtensionThread] = None
        self.game_state = get_game_interface_data()
        self._refresh_status_fn: Optional[Callable[[], None]] = None
        self._register_status_ui_fn: Optional[Callable[[], None]] = None

        self.container = self
        self._content_created = False
        self._path_scan_btn: Optional[QPushButton] = None
        self._login_check_generation = 0
        self._last_control_button_state: Optional[str] = None
        self._scan_status = [None]
        self._scan_in_progress = False
        self._scan_progress_timer: Optional[QTimer] = None
        self._scan_progress_label: Optional[QLabel] = None

        bg = UITheme.get_color("bg_primary")
        self.setStyleSheet(f"background-color: {bg};")

    def after(self, ms: int, fn: Callable[[], None]) -> Optional[QTimer]:
        """Compat for timer thread main-thread schedule (one_shot_tasks._schedule_on_main)."""
        t = QTimer(self)
        t.setSingleShot(True)
        t.timeout.connect(fn)
        t.start(ms)
        return t

    def after_cancel(self, t: Any) -> None:
        """Cancel a timer returned by after()."""
        if t is not None and isinstance(t, QTimer):
            t.stop()

    def winfo_exists(self) -> bool:
        """Compat for one_shot_tasks._schedule_on_main."""
        return True

    def ensure_content(self) -> None:
        if self._content_created:
            return
        if timer_manager.is_running():
            timer_manager.submit_one_shot(lambda: _fetch_rosbot_config_then_create(self))
        else:
            QTimer.singleShot(0, lambda: _fetch_rosbot_config_on_main_then_create(self))

    def ensure_content_sync(self) -> None:
        if self._content_created:
            return
        _fetch_rosbot_config_on_main_then_create(self)

    def _create_content_with_snapshot(self, snapshot: dict) -> None:
        self._content_created = True
        tab_pad = UnifiedStyles.TAB_PAD
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(tab_pad, tab_pad, tab_pad, tab_pad)
        top_row = QHBoxLayout()
        main_layout.addLayout(top_row)
        self._create_config_panel(snapshot, top_row)
        self._create_control_panel(top_row)
        self._create_log_display_row(main_layout)
        self._create_control_and_log_then_sync()

    def _create_config_panel(self, snapshot: dict, top_row: QHBoxLayout) -> None:
        cfg_frame = QFrame(self)
        cfg_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        top_row.addWidget(cfg_frame, 1)

        cfg_layout = QVBoxLayout(cfg_frame)
        cfg_layout.setContentsMargins(UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["xs"], UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["xs"])
        settings_frame = QFrame()
        settings_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        lbl = QLabel(i18n_manager.get_ui_text("rosbot.bot_settings"))
        lbl.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']}; font-weight: bold;")
        cfg_layout.addWidget(lbl)
        grid = QGridLayout(settings_frame)
        cfg_layout.addWidget(settings_frame)

        def add_check(row: int, col: int, i18n_key: str, config_key: str, default: bool) -> QCheckBox:
            val = snapshot.get(config_key, default)
            cb = QCheckBox(i18n_manager.get_ui_text(i18n_key))
            cb.setChecked(bool(val))
            cb.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
            cb.stateChanged.connect(lambda s, k=config_key: config_set(k, s == 2))
            grid.addWidget(cb, row, col)
            return cb

        def add_spin(config_key: str, val: int, from_: int, to: int, width: int = 4) -> QSpinBox:
            sb = QSpinBox()
            sb.setRange(from_, to)
            sb.setValue(val)
            sb.setMinimumWidth(width * 10)
            sb.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
            sb.valueChanged.connect(lambda v, k=config_key: config_set(k, v))
            return sb

        add_check(0, 0, "rosbot.auto_enable_latest_ros", "ros_settings.auto_enable_latest_ros", True)
        add_check(0, 1, "rosbot.blue_portal_priority", "rosbot.blue_portal_priority", False)
        add_check(0, 2, "rosbot.firstborn_blue_gate_reuse", "rosbot.firstborn_blue_gate_reuse", False)

        add_check(1, 0, "rosbot.pickup_blood_shards", "rosbot.pickup_blood_shards", False)
        cell_1_1 = QWidget()
        h1 = QHBoxLayout(cell_1_1)
        h1.setContentsMargins(0, 0, 0, 0)
        cb_echo = QCheckBox(i18n_manager.get_ui_text("rosbot.smart_echo"))
        cb_echo.setChecked(bool(snapshot.get("rosbot.smart_echo", False)))
        cb_echo.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
        cb_echo.stateChanged.connect(lambda s, k="rosbot.smart_echo": config_set(k, s == 2))
        h1.addWidget(cb_echo)
        sb_wait = add_spin("rosbot.smart_echo_wait_seconds", snapshot.get("rosbot.smart_echo_wait_seconds", 15), 1, 120)
        h1.addWidget(sb_wait)
        h1.addWidget(QLabel(i18n_manager.get_ui_text("rosbot.seconds")))
        grid.addWidget(cell_1_1, 1, 1)
        cell_1_2 = QWidget()
        h1_2 = QHBoxLayout(cell_1_2)
        h1_2.setContentsMargins(0, 0, 0, 0)
        cb_test = QCheckBox(i18n_manager.get_ui_text("rosbot.test_mode"))
        cb_test.setChecked(bool(snapshot.get("rosbot.test_mode", False)))
        cb_test.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
        cb_test.stateChanged.connect(lambda s, k="rosbot.test_mode": config_set(k, s == 2))
        h1_2.addWidget(cb_test)
        sb_test = add_spin("rosbot.test_timeout_minutes", snapshot.get("rosbot.test_timeout_minutes", 30), 1, 120)
        h1_2.addWidget(sb_test)
        h1_2.addWidget(QLabel(i18n_manager.get_ui_text("rosbot.minutes")))
        grid.addWidget(cell_1_2, 1, 2)

        add_check(2, 0, "rosbot.prevent_stuck", "rosbot.prevent_stuck", False)
        add_check(2, 1, "rosbot.startup", "rosbot.startup", False)
        cell_2_2 = QWidget()
        h2 = QHBoxLayout(cell_2_2)
        h2.setContentsMargins(0, 0, 0, 0)
        cb_timeout = QCheckBox(i18n_manager.get_ui_text("rosbot.timeout_restart"))
        cb_timeout.setChecked(bool(snapshot.get("battlenet.timeout_restart", True)))
        cb_timeout.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
        cb_timeout.stateChanged.connect(lambda s, k="battlenet.timeout_restart": config_set(k, s == 2))
        h2.addWidget(cb_timeout)
        sb_timeout = add_spin("rosbot.timeout_minutes", snapshot.get("rosbot.timeout_minutes", 8), 1, 120)
        h2.addWidget(sb_timeout)
        h2.addWidget(QLabel(i18n_manager.get_ui_text("rosbot.minutes")))
        grid.addWidget(cell_2_2, 2, 2)

    def _create_control_and_log_then_sync(self) -> None:
        scan_container = self._bottom_bar.get_row3_scan_container() if self._bottom_bar else None
        if scan_container is not None and scan_container.layout() is not None:
            self._path_scan_btn = QPushButton(i18n_manager.get_ui_text("rosbot.scan_one_click"))
            self._path_scan_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
            self._path_scan_btn.clicked.connect(self._run_one_click_scan)
            scan_container.layout().addWidget(self._path_scan_btn)
        if self._register_status_ui_fn:
            self._register_status_ui_fn()
        self.after(100, self._sync_status_ui_once)

    def _create_control_panel(self, top_row: QHBoxLayout) -> None:
        control_frame = QFrame(self)
        control_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        top_row.addWidget(control_frame, 0)

        ctrl_layout = QVBoxLayout(control_frame)
        ctrl_layout.setContentsMargins(UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["sm"], UnifiedStyles.SPACING["sm"])

        self.control_btn = QPushButton(i18n_manager.get_ui_text("rosbot.start_rosbot"))
        self.control_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_success']}; color: {UnifiedStyles.COLORS['text_primary']};")
        self.control_btn.clicked.connect(self._toggle_rosbot)
        ctrl_layout.addWidget(self.control_btn)

        self.ensure_battlenet_btn = QPushButton(i18n_manager.get_ui_text("rosbot.ensure_battlenet_only"))
        self.ensure_battlenet_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        self.ensure_battlenet_btn.clicked.connect(self._ensure_battlenet_only)
        ctrl_layout.addWidget(self.ensure_battlenet_btn)

        self.update_rosbot_btn = QPushButton(i18n_manager.get_ui_text("rosbot.update_rosbot"))
        self.update_rosbot_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        self.update_rosbot_btn.clicked.connect(self._update_rosbot)
        ctrl_layout.addWidget(self.update_rosbot_btn)

        self.open_tampermonkey_script_btn = QPushButton(i18n_manager.get_ui_text("rosbot.open_tampermonkey_script"))
        self.open_tampermonkey_script_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        self.open_tampermonkey_script_btn.clicked.connect(self._open_tampermonkey_script)
        ctrl_layout.addWidget(self.open_tampermonkey_script_btn)

        self.set_account_password_btn = QPushButton(i18n_manager.get_ui_text("rosbot.set_account_password"))
        self.set_account_password_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        self.set_account_password_btn.clicked.connect(self._open_set_account_password)
        ctrl_layout.addWidget(self.set_account_password_btn)

        ctrl_layout.addStretch(1)
        self.rosbot_running = self.game_state.rosbot_flow_master_enabled
        self._update_control_button()
        self._update_ensure_battlenet_button()

    def _create_log_display_row(self, main_layout: QVBoxLayout) -> None:
        self._last_log_time = None
        self._last_latency_sec = None

        log_frame = QFrame(self)
        log_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_primary')};")
        main_layout.addWidget(log_frame, 1)

        log_layout = QVBoxLayout(log_frame)
        log_layout.setContentsMargins(0, UnifiedStyles.SPACING["xs"], 0, UnifiedStyles.SPACING["xs"])

        header = QHBoxLayout()
        header.addWidget(QLabel(i18n_manager.get_ui_text("rosbot.rosbot_log")))
        self._scan_progress_label = QLabel("")
        self._scan_progress_label.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_muted']};")
        header.addWidget(self._scan_progress_label)
        header.addStretch(1)
        self._rosbot_log_status_lbl = QLabel("")
        self._rosbot_log_status_lbl.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']}; font-family: monospace;")
        header.addWidget(self._rosbot_log_status_lbl)
        self._rosbot_log_latency_lbl = QLabel("")
        self._rosbot_log_latency_lbl.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']}; font-family: monospace;")
        header.addWidget(self._rosbot_log_latency_lbl)
        self._debug_latency_cb = QCheckBox(i18n_manager.get_ui_text("log_panel.debug_log_latency"))
        self._debug_latency_cb.setChecked(bool(config_get("log_settings.debug_log_latency", False)))
        self._debug_latency_cb.stateChanged.connect(lambda s: config_set("log_settings.debug_log_latency", s == Qt.CheckState.Checked.value))
        self._debug_latency_cb.stateChanged.connect(lambda: self._update_rosbot_log_status_display())
        header.addWidget(self._debug_latency_cb)
        open_log_btn = QPushButton(i18n_manager.get_ui_text("rosbot.open_log_file"))
        open_log_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_primary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        open_log_btn.clicked.connect(self._open_rosbot_log_file)
        header.addWidget(open_log_btn)
        log_layout.addLayout(header)

        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_primary']}; color: {UnifiedStyles.COLORS['text_primary']}; font-family: monospace;")
        self.log_text.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.log_text.customContextMenuRequested.connect(self._show_rosbot_log_context_menu)
        log_layout.addWidget(self.log_text)
        self._schedule_rosbot_log_status_tick()

    def _run_one_click_scan(self) -> None:
        self._scan_in_progress = True
        self._scan_status[0] = None
        if self._path_scan_btn is not None:
            self._path_scan_btn.setEnabled(False)
            self._path_scan_btn.setText(i18n_manager.get_ui_text("rosbot.scan_searching"))
        self._scan_progress_tick()
        timer_manager.submit_one_shot(lambda: do_path_scan(self, include_rosbot=True, force_scan_rosbot=True))

    def _scan_progress_tick(self) -> None:
        if not self._scan_in_progress:
            return
        self._scan_progress_timer = self.after(200, self._scan_progress_tick)

    def _apply_scan_results(self, battlenet_path, rosbot_dirs, d3_path=None, error_msg=None) -> None:
        self._scan_in_progress = False
        if self._scan_progress_timer is not None:
            self.after_cancel(self._scan_progress_timer)
            self._scan_progress_timer = None
        if self._path_scan_btn is not None:
            self._path_scan_btn.setEnabled(True)
            self._path_scan_btn.setText(i18n_manager.get_ui_text("rosbot.scan_one_click"))
        if self._bottom_bar is not None:
            self._bottom_bar.refresh_path_icons()
        if error_msg:
            QMessageBox.critical(self, i18n_manager.get_ui_text("rosbot.error"), error_msg)
            return
        cur_bn = (get_config_value_safe("battlenet.battlenet_path") or "").strip()
        cur_d3 = (get_config_value_safe("d3.d3_path") or "").strip()
        cur_ros = (get_config_value_safe("ros_settings.ros_directory") or "").strip()
        bn_valid = cur_bn and os.path.isfile(cur_bn) and os.path.basename(cur_bn) == BATTLE_NET_EXE_NAME
        d3_valid = cur_d3 and os.path.isfile(cur_d3) and os.path.basename(cur_d3) == DIABLO_III_EXE_NAME
        ros_valid = cur_ros and os.path.isdir(cur_ros)
        if battlenet_path and not bn_valid:
            config_set("battlenet.battlenet_path", battlenet_path)
        if d3_path and not d3_valid:
            config_set("d3.d3_path", d3_path)
        if rosbot_dirs:
            region = self.game_state.get_battlenet_region()
            chosen = pick_best_rosbot_dir_by_region(rosbot_dirs, region)

            def _path_matches_region(p: str, r: str) -> bool:
                if not p or r not in ("asia", "cn"):
                    return False
                n = os.path.normpath(p).lower()
                if r == "asia":
                    return ROSBOT_DIR_NAMESPACE_ASIA.lower() in n
                return ROSBOT_DIR_NAMESPACE_CN.lower() in n and ROSBOT_DIR_NAMESPACE_ASIA.lower() not in n

            overwrite_ok = True
            if chosen and ros_valid and region in ("asia", "cn"):
                if _path_matches_region(cur_ros, region) and not _path_matches_region(chosen, region):
                    overwrite_ok = False
            if chosen and overwrite_ok and (not ros_valid or os.path.normpath(chosen) != os.path.normpath(cur_ros)):
                config_set("ros_settings.ros_directory", chosen)
        if not battlenet_path and not rosbot_dirs and not d3_path:
            msg = []
            if not battlenet_path:
                msg.append(i18n_manager.get_ui_text("rosbot.scan_not_found_battlenet"))
            if not d3_path:
                msg.append(i18n_manager.get_ui_text("rosbot.scan_not_found_d3"))
            if not rosbot_dirs:
                msg.append(i18n_manager.get_ui_text("rosbot.scan_not_found_rosbot"))
            QMessageBox.information(self, i18n_manager.get_ui_text("rosbot.scan_done"), "\n".join(msg))
        if self._bottom_bar is not None:
            self._bottom_bar.refresh_path_icons()

    def startup_path_scan_needed(self) -> bool:
        return not are_paths_valid_for_skip_scan()

    def _submit_path_scan_if_throttle_ok(self) -> None:
        now = time.time()
        if now - self._path_scan_submit_time < 5.0:
            return
        self._path_scan_submit_time = now
        timer_manager.submit_one_shot(lambda: do_path_scan(self, include_rosbot=True, force_scan_rosbot=True))

    def add_log_message(self, message: str, level: str = "INFO", color=None) -> None:
        if is_shutdown_requested():
            return
        if not any(m in message for m in ("[ROSBOT]", "[PathScan]", "LogAnalyzer")):
            return
        self._last_log_time = time.time()
        if "[ROSBOT~" in message and "s]" in message:
            start = message.index("[ROSBOT~") + len("[ROSBOT~")
            end = message.index("s]", start)
            segment = message[start:end]
            if segment.replace(".", "", 1).replace("-", "", 1).isdigit():
                self._last_latency_sec = float(segment)
            else:
                self._last_latency_sec = None
        else:
            self._last_latency_sec = None

        def _append():
            text = _strip_ui_log_prefix(message)
            self.log_text.append(text)
            self.log_text.verticalScrollBar().setValue(self.log_text.verticalScrollBar().maximum())

        QTimer.singleShot(0, _append)

    def _update_rosbot_log_status_display(self) -> None:
        log_mtime = get_last_log_modified_time()
        ui_log_time = self._last_log_time
        if log_mtime > 0:
            last_log_time = log_mtime if (ui_log_time is None or log_mtime > ui_log_time) else ui_log_time
        elif ui_log_time is not None:
            last_log_time = ui_log_time
        else:
            self._rosbot_log_status_lbl.setText("")
            self._rosbot_log_latency_lbl.setText("")
            return
        elapsed = time.time() - last_log_time
        if elapsed < 60:
            ago_val = "{:.1f}s".format(elapsed)
            status_text = (i18n_manager.get_ui_text("rosbot.log_last_ago", default="Last: {0} ago") or "Last: {0} ago").format(ago_val)
        else:
            ago_val = "{:.0f}min".format(elapsed / 60)
            status_text = (i18n_manager.get_ui_text("rosbot.log_last_ago_min", default="Last: {0} ago") or "Last: {0} ago").format(ago_val)
        self._rosbot_log_status_lbl.setText(status_text)
        show_latency = bool(config_get("log_settings.debug_log_latency", False))
        if show_latency and self._last_latency_sec is not None:
            lat_val = "{:.1f}".format(self._last_latency_sec)
            self._rosbot_log_latency_lbl.setText((i18n_manager.get_ui_text("rosbot.log_latency", default="latency +{0}s") or "latency +{0}s").format(lat_val))
            self._rosbot_log_latency_lbl.show()
        else:
            self._rosbot_log_latency_lbl.setText("")
            self._rosbot_log_latency_lbl.hide()

    def _schedule_rosbot_log_status_tick(self) -> None:
        self._update_rosbot_log_status_display()
        self.after(1000, self._schedule_rosbot_log_status_tick)

    def _show_rosbot_log_context_menu(self, pos):
        menu = QMenu(self)
        act = QAction(i18n_manager.get_ui_text("rosbot.copy"), self)
        act.triggered.connect(self._copy_rosbot_log_to_clipboard)
        menu.addAction(act)
        menu.exec(self.log_text.mapToGlobal(pos))

    def _copy_rosbot_log_to_clipboard(self) -> None:
        cursor = self.log_text.textCursor()
        if cursor.hasSelection():
            text = cursor.selectedText()
        else:
            text = self.log_text.toPlainText()
        if text.strip():
            app = QApplication.instance()
            if app:
                app.clipboard().setText(text)

    def _toggle_rosbot(self) -> None:
        if self.rosbot_running:
            self._stop_rosbot()
        else:
            self._start_rosbot()

    def set_d3_extension_thread(self, thread: Optional[D3ExtensionThread]) -> None:
        self._d3_extension_thread = thread

    def _ensure_battlenet_only(self) -> None:
        next_enabled = not self.game_state.ensure_battlenet_only_master_enabled
        set_bn_only_enabled(next_enabled)
        if next_enabled:
            self._request_status_refresh()
            get_task_manager().set_task_status("rosbot_task", TaskStatus.ENABLED)
        else:
            reset_flow_master_bn_block()
        self._update_ensure_battlenet_button()

    def _update_ensure_battlenet_button(self) -> None:
        on = self.game_state.ensure_battlenet_only_master_enabled
        key = "rosbot.ensure_battlenet_only_on" if on else "rosbot.ensure_battlenet_only"
        self.ensure_battlenet_btn.setText(i18n_manager.get_ui_text(key))

    def _start_rosbot(self) -> None:
        if self.rosbot_running:
            return
        set_flow_master_enabled(True)
        get_task_manager().set_task_status("rosbot_task", TaskStatus.ENABLED)
        self.rosbot_running = True
        self._update_control_button()
        self._request_status_refresh()

    def _control_btn_set_busy(self, busy: bool) -> None:
        self.control_btn.setEnabled(not busy)

    def get_status_ui_callback(self) -> Callable:
        return self._on_game_state_changed

    def set_refresh_status_fn(self, fn: Callable[[], None]) -> None:
        self._refresh_status_fn = fn

    def set_register_status_ui_fn(self, fn: Callable[[], None]) -> None:
        self._register_status_ui_fn = fn

    def _open_set_account_password(self) -> None:
        schedule_battlenet_credentials_dialog()

    def _request_status_refresh(self) -> None:
        timer_manager.submit_one_shot(do_window_monitor_initial_check)

    def _update_rosbot(self) -> None:
        timer_manager.submit_one_shot(lambda: do_rosbot_update(self))

    def _open_rosbot_log_file(self) -> None:
        if not open_file_with_notepad(LOGS_FILE_PATH):
            QMessageBox.warning(
                self,
                i18n_manager.get_ui_text("rosbot.warning"),
                (i18n_manager.get_ui_text("rosbot.log_file_not_found") or "File not found or could not open.") + "\n" + str(LOGS_FILE_PATH),
            )

    def _open_tampermonkey_script(self) -> None:
        if not open_file_with_notepad(TAMPERMONKEY_SCRIPT_PATH):
            QMessageBox.warning(
                self,
                i18n_manager.get_ui_text("rosbot.warning"),
                (i18n_manager.get_ui_text("rosbot.log_file_not_found") or "File not found or could not open.") + "\n" + str(TAMPERMONKEY_SCRIPT_PATH),
            )

    def get_login_check_callable(self) -> Callable:
        def _run():
            result = get_login_try_screenshot_controller().ensure_battlenet_started_and_login_check(for_f2_only=True)
            return (result, None)
        return _run

    def _on_login_check_done(self, success: bool, error=None, ran_e_block: bool = False, generation=None) -> None:
        if generation is not None and generation != self._login_check_generation:
            return
        self._control_btn_set_busy(False)
        if error is not None:
            ColorPrint.red(f"[RosbotPanel] Login check error: {error}")
            set_flow_master_enabled(False)
            reset_flow_master_bn_block()
            get_task_manager().set_task_status("rosbot_task", TaskStatus.DISABLED)
            self.rosbot_running = False
            self._update_control_button()
            self._request_status_refresh()
            return
        if not success:
            return
        self.rosbot_running = True
        self._update_control_button()
        get_task_manager().set_task_status("rosbot_task", TaskStatus.ENABLED)
        rosbot_processor.get_rosbot_processor().initialize()
        if not ran_e_block:
            rosbot_processor.start_rosbot_task()
        ColorPrint.green("[ROSBOT] Started monitoring")

    def _on_rosbot_stop_done(self) -> None:
        self._control_btn_set_busy(False)
        set_flow_master_enabled(False)
        reset_flow_master_bn_block()
        self.rosbot_running = False
        self._update_control_button()
        self._request_status_refresh()
        ColorPrint.yellow("[ROSBOT] Stopped monitoring")

    def _stop_rosbot(self) -> None:
        if not self.rosbot_running:
            return
        set_flow_master_enabled(False)
        set_bn_only_enabled(False)
        reset_flow_master_bn_block()
        self._update_ensure_battlenet_button()
        self.rosbot_running = False
        self._request_status_refresh()
        self._update_control_button()
        if get_d3_extension_thread():
            self._control_btn_set_busy(True)
            trigger_extension_rosbot_stop()
        else:
            rosbot_processor.stop_rosbot_task()
            ColorPrint.yellow("[ROSBOT] Stopped monitoring")

    def _update_control_button(self) -> None:
        self.rosbot_running = self.game_state.rosbot_flow_master_enabled
        state_str = "STOP (red)" if self.rosbot_running else "START (green)"
        if self._last_control_button_state != state_str:
            self._last_control_button_state = state_str
            ColorPrint.debug(f"[RosbotPanel] Control button: {state_str}")
        if self.rosbot_running:
            self.control_btn.setText(i18n_manager.get_ui_text("rosbot.stop_rosbot"))
            self.control_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_danger']}; color: {UnifiedStyles.COLORS['text_primary']};")
        else:
            self.control_btn.setText(i18n_manager.get_ui_text("rosbot.start_rosbot"))
            self.control_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['btn_success']}; color: {UnifiedStyles.COLORS['text_primary']};")

    def _refresh_path_icons(self) -> None:
        if self._bottom_bar is not None:
            self._bottom_bar.refresh_path_icons()

    def _sync_status_ui_once(self) -> None:
        state = self.game_state.get_summary()
        self._update_ui_from_state(state)

    def _on_game_state_changed(self, state) -> None:
        self._update_ui_from_state(state)

    def _update_ui_from_state(self, state) -> None:
        if self._bottom_bar is not None:
            self._bottom_bar.update_status_from_state(state)
        self._update_ensure_battlenet_button()
        self._update_control_button()
