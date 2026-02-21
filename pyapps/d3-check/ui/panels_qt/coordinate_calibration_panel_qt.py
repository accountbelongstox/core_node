# -*- coding: utf-8 -*-
"""Coordinate Calibration Panel Qt - 1:1 with Tk. CONFIG: coord_calibration.client_type, yolo_current_project, yolo_project_list."""

import os
import json
import tkinter as tk
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QPushButton, QRadioButton, QButtonGroup, QTextEdit,
    QFrame, QMessageBox, QFileDialog, QComboBox, QTreeWidget, QTreeWidgetItem,
    QTableWidget, QTableWidgetItem, QMenu, QInputDialog,
)
from pycore.pyutils.system_launcher import open_dir
from pycore.pyutils.window_activator import WindowActivator

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.common.window_finder import WindowFinder
from d3utils.screenshot_provider import get_window_screenshot
from providor.providor_index import (
    CLIENT_TYPE_BATTLENET,
    CLIENT_TYPE_D3_GAME,
    CLIENT_TYPE_D4_GAME,
    VALID_CLIENT_TYPES,
    DIABLO_IV_WINDOW_TITLES,
)
from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.d3_manager import get_d3_manager
from providor.i18n_manager import i18n_manager

from ..theme.theme import UITheme
from ..unified_styles import UnifiedStyles
from ..utils.config_qt import config_get, config_set

CONFIG_KEY_CLIENT_TYPE = "coord_calibration.client_type"
CONFIG_KEY_YOLO_CURRENT_PROJECT = "coord_calibration.yolo_current_project"
CONFIG_KEY_YOLO_PROJECT_LIST = "coord_calibration.yolo_project_list"
YOLO_PROJECT_LIST_MAX = 30


def _short_project_path_display(path: str) -> str:
    if not path or not str(path).strip():
        return ""
    p = os.path.normpath(str(path).strip())
    parts = [x for x in p.split(os.sep) if x]
    if len(parts) >= 2:
        return os.path.join(parts[-2], parts[-1])
    return parts[-1] if parts else p


# Optional YOLO imports (same as Tk panel)
try:
    from d3utils.yolo_record import (
        run_gameaisdk_start_record,
        stop_record as bridge_stop_record,
        is_recording as bridge_is_recording,
        load_record_config,
        open_record_directory,
        get_record_output_subdir,
        get_latest_segment_dir,
        list_segments,
        segment_info,
        compose_segment_to_frames,
        continue_to_labeling,
        open_frames_dir_for_labeling,
        delete_segment,
        merge_segments_to_folder,
        start_record_segment,
        end_record_segment,
        DEFAULT_HTTP_PORT,
        YOLO_DATA_ROOT,
        CLIENT_TYPE_TO_RECORD_SUBDIR,
        get_default_project_path,
        is_valid_project_path,
    )
except ImportError:
    run_gameaisdk_start_record = None
    bridge_stop_record = None
    bridge_is_recording = None
    load_record_config = None
    open_record_directory = None
    get_record_output_subdir = None
    get_latest_segment_dir = None
    list_segments = None
    segment_info = None
    compose_segment_to_frames = None
    continue_to_labeling = None
    open_frames_dir_for_labeling = None
    delete_segment = None
    merge_segments_to_folder = None
    start_record_segment = None
    end_record_segment = None
    DEFAULT_HTTP_PORT = 52808
    YOLO_DATA_ROOT = None
    CLIENT_TYPE_TO_RECORD_SUBDIR = {}

    def get_default_project_path(_ct):
        return ""

    def is_valid_project_path(_path):
        return False

try:
    from d3utils.yolo_train_flow import (
        flow1_start_record,
        flow1_stop_record,
        flow1_new_segment,
        flow1_is_recording,
        flow2_export_frames,
        flow3_open_label_tool,
    )
except ImportError:
    flow1_start_record = None
    flow1_stop_record = None
    flow1_new_segment = None
    flow1_is_recording = None
    flow2_export_frames = None
    flow3_open_label_tool = None

try:
    from pycore.pyutils.voc_annotator import patch_data
    from pycore.pyutils.voc_annotator.project_config import save_project_config
except ImportError:
    patch_data = None
    save_project_config = None

try:
    from ..components.coordinate_picker_window import CoordinatePicker
except ImportError:
    CoordinatePicker = None

try:
    from ..components.record_config_dialog import RecordConfigDialog
    from ..utils.app_root import get_app_root
except ImportError:
    RecordConfigDialog = None
    get_app_root = None


class CoordinateCalibrationPanelQt(QWidget):
    """Coordinate Calibration panel Qt. CONFIG: coord_calibration.client_type, yolo_current_project, yolo_project_list."""

    WINDOW_TITLES_MAP = {
        CLIENT_TYPE_BATTLENET: ["Battle.net"],
        CLIENT_TYPE_D3_GAME: None,
        CLIENT_TYPE_D4_GAME: DIABLO_IV_WINDOW_TITLES,
    }

    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.screenshot = None
        self.screenshot_path = None
        self.pick_history: List[Dict] = []
        saved = config_get(CONFIG_KEY_CLIENT_TYPE, None)
        self.current_client_type = (
            saved if saved in VALID_CLIENT_TYPES else CLIENT_TYPE_BATTLENET
        )
        self._yolo_current_project_path: Optional[str] = None
        saved_project = config_get(CONFIG_KEY_YOLO_CURRENT_PROJECT, None)
        if saved_project and isinstance(saved_project, str) and saved_project.strip():
            candidate = os.path.normpath(saved_project.strip())
            if os.path.isdir(candidate) and (is_valid_project_path and is_valid_project_path(candidate)):
                self._yolo_current_project_path = candidate
            elif get_default_project_path:
                default_proj = get_default_project_path(self.current_client_type)
                if default_proj:
                    config_set(CONFIG_KEY_YOLO_CURRENT_PROJECT, default_proj)
        saved_list = config_get(CONFIG_KEY_YOLO_PROJECT_LIST, None)
        self._yolo_project_list: List[str] = []
        if isinstance(saved_list, list):
            self._yolo_project_list = [
                os.path.normpath(str(p).strip()) for p in saved_list if p and str(p).strip()
            ][:YOLO_PROJECT_LIST_MAX]

        self._use_yolo_data_panel = bool(get_record_output_subdir and get_latest_segment_dir)
        self.record_log_text: Optional[QTextEdit] = None
        self._yolo_project_combo: Optional[QComboBox] = None
        self._yolo_record_toggle_btn: Optional[QPushButton] = None
        self.yolo_data_tree: Optional[QTreeWidget] = None
        self._yolo_workflow_s1: Optional[QLabel] = None
        self._yolo_workflow_s2: Optional[QLabel] = None
        self._yolo_workflow_s3: Optional[QLabel] = None
        self._yolo_segment_context_menu_selected_iid: Optional[int] = None
        self.history_table: Optional[QTableWidget] = None
        self.popup_window = None
        self.selected_item: Optional[str] = None
        self._game_mode = "d3"
        self._last_record_hwnd = None
        self._last_record_port = None
        self._last_record_project_path: Optional[str] = None
        self._yolo_data_segment_paths: Dict[str, str] = {}
        self._tk_root = None
        self._create_content()

    def _create_content(self) -> None:
        tab_pad = UnifiedStyles.TAB_PAD
        main = QVBoxLayout(self)
        main.setContentsMargins(tab_pad, tab_pad, tab_pad, tab_pad)
        main.setSpacing(UnifiedStyles.SPACING["sm"])

        self._create_client_and_button_row(main)
        if self._use_yolo_data_panel:
            self._create_yolo_section(main)
        else:
            self._create_history_panel(main)
        self._create_record_log_panel(main)

    def _create_client_and_button_row(self, main: QVBoxLayout) -> None:
        top = QFrame()
        top.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        row = QHBoxLayout(top)
        row.setContentsMargins(UnifiedStyles.SPACING['sm'], UnifiedStyles.SPACING['sm'], UnifiedStyles.SPACING['sm'], UnifiedStyles.SPACING['sm'])
        lbl = QLabel(i18n_manager.get_ui_text("ui.coord_calibration.client_mode"))
        lbl.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_secondary']};")
        row.addWidget(lbl)
        self._client_group = QButtonGroup(self)
        for val, key in [
            (CLIENT_TYPE_BATTLENET, "ui.coord_calibration.client_battlenet"),
            (CLIENT_TYPE_D3_GAME, "ui.coord_calibration.client_d3_game"),
            (CLIENT_TYPE_D4_GAME, "ui.coord_calibration.client_d4_game"),
        ]:
            rb = QRadioButton(i18n_manager.get_ui_text(key))
            rb.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
            rb.setProperty("value", val)
            if val == self.current_client_type:
                rb.setChecked(True)
            rb.toggled.connect(self._make_client_toggled(val))
            row.addWidget(rb)
            self._client_group.addButton(rb)
        row.addStretch(1)
        capture_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.capture_button"))
        capture_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['accent']}; color: {UnifiedStyles.COLORS['text_primary']};")
        capture_btn.clicked.connect(self._on_capture_screenshot)
        row.addWidget(capture_btn)
        main.addWidget(top)

    def _make_client_toggled(self, value: str):
        def _on(checked):
            if checked:
                self._on_client_type_change(value)
        return _on

    def _on_client_type_change(self, value: str) -> None:
        self.current_client_type = value
        config_set(CONFIG_KEY_CLIENT_TYPE, value)
        if self._use_yolo_data_panel and CLIENT_TYPE_TO_RECORD_SUBDIR and get_default_project_path and YOLO_DATA_ROOT:
            subdir = CLIENT_TYPE_TO_RECORD_SUBDIR.get(value, "d3_game")
            root_abs = os.path.abspath(YOLO_DATA_ROOT)
            current = self._yolo_current_project_path
            if current and root_abs and subdir and not os.path.normpath(current).startswith(os.path.join(root_abs, subdir)):
                self._yolo_current_project_path = None
                config_set(CONFIG_KEY_YOLO_CURRENT_PROJECT, get_default_project_path(value) or "")
        if self._yolo_project_combo is not None and self._use_yolo_data_panel:
            self._update_yolo_project_dropdown()

    def _create_yolo_section(self, main: QVBoxLayout) -> None:
        pad = UnifiedStyles.SPACING["sm"]
        section = QFrame()
        section.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        layout = QVBoxLayout(section)
        layout.setContentsMargins(pad, pad, pad, pad)
        title = QLabel(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_title") or "YOLO Data Management")
        title.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']}; font-weight: bold;")
        layout.addWidget(title)
        if run_gameaisdk_start_record is not None:
            rec_row = QHBoxLayout()
            config_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_config") or "Config")
            config_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
            config_btn.clicked.connect(self._on_yolo_record_config)
            rec_row.addWidget(config_btn)
            self._yolo_record_toggle_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_start") or "Start")
            self._yolo_record_toggle_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['success']}; color: {UnifiedStyles.COLORS['text_primary']};")
            self._yolo_record_toggle_btn.clicked.connect(self._on_yolo_record_toggle)
            rec_row.addWidget(self._yolo_record_toggle_btn)
            open_label_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label"))
            open_label_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
            open_label_btn.clicked.connect(self._on_flow3_open_label)
            rec_row.addWidget(open_label_btn)
            patch_menu_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import") or "Import patch")
            patch_menu_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
            patch_menu = QMenu(self)
            patch_menu.addAction(i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_one") or "Import one image", lambda: self._on_yolo_patch_import(True))
            patch_menu.addAction(i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_folder") or "Import folder", lambda: self._on_yolo_patch_import(False))
            patch_menu_btn.setMenu(patch_menu)
            rec_row.addWidget(patch_menu_btn)
            rec_row.addStretch(1)
            layout.addLayout(rec_row)
            self._update_yolo_record_status()
        proj_row = QHBoxLayout()
        self._yolo_project_combo = QComboBox()
        self._yolo_project_combo.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        self._yolo_project_combo.setMinimumWidth(200)
        self._yolo_project_combo.currentIndexChanged.connect(self._on_yolo_project_combo_changed)
        proj_row.addWidget(self._yolo_project_combo)
        create_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.yolo_project_create") or "Create new project")
        create_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        create_btn.clicked.connect(self._on_yolo_project_create)
        proj_row.addWidget(create_btn)
        open_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_open_project") or "Open project dir")
        open_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        open_btn.clicked.connect(self._on_yolo_data_open_project_dir)
        proj_row.addWidget(open_btn)
        proj_row.addStretch(1)
        layout.addLayout(proj_row)
        workflow_bar = QHBoxLayout()
        self._yolo_workflow_s1 = QLabel("")
        self._yolo_workflow_s2 = QLabel("")
        self._yolo_workflow_s3 = QLabel("")
        for lbl in (self._yolo_workflow_s1, self._yolo_workflow_s2, self._yolo_workflow_s3):
            lbl.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_secondary']};")
        workflow_bar.addWidget(self._yolo_workflow_s1)
        workflow_bar.addWidget(self._yolo_workflow_s2)
        workflow_bar.addWidget(self._yolo_workflow_s3)
        workflow_bar.addStretch(1)
        layout.addLayout(workflow_bar)
        self.yolo_data_tree = QTreeWidget()
        self.yolo_data_tree.setHeaderLabels([
            i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_col_timestamp") or "Timestamp",
            i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_col_frames") or "Frames",
            i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_col_status") or "Status",
            i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_col_size") or "Size",
        ])
        self.yolo_data_tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.yolo_data_tree.customContextMenuRequested.connect(self._on_yolo_segment_context_menu)
        self.yolo_data_tree.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
        layout.addWidget(self.yolo_data_tree, 1)
        tool_row = QHBoxLayout()
        for key, cmd in [
            ("ui.coord_calibration.yolo_data_refresh", self._on_yolo_data_refresh),
            ("ui.coord_calibration.yolo_data_export_selected", self._on_yolo_data_export_selected),
            ("ui.coord_calibration.yolo_data_open_label", self._on_yolo_data_open_label),
            ("ui.coord_calibration.yolo_data_merge_selected", self._on_yolo_data_merge_selected),
            ("ui.coord_calibration.yolo_data_delete_selected", self._on_yolo_data_delete_selected),
        ]:
            b = QPushButton(i18n_manager.get_ui_text(key) or key.split(".")[-1])
            b.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
            b.clicked.connect(cmd)
            tool_row.addWidget(b)
        patch_tool = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import") or "Import patch")
        patch_tool.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        patch_tool_menu = QMenu(self)
        patch_tool_menu.addAction(i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_one") or "Import one image", lambda: self._on_yolo_patch_import(True))
        patch_tool_menu.addAction(i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_folder") or "Import folder", lambda: self._on_yolo_patch_import(False))
        patch_tool.setMenu(patch_tool_menu)
        tool_row.addWidget(patch_tool)
        tool_row.addStretch(1)
        layout.addLayout(tool_row)
        main.addWidget(section, 1)
        self._update_yolo_project_dropdown()
        self._refresh_yolo_data_table()
        self._update_yolo_workflow_bar()

    def _on_yolo_project_combo_changed(self, index: int) -> None:
        if index < 0 or self._yolo_project_combo is None:
            return
        path = self._yolo_project_combo.currentData()
        if path and os.path.isdir(path):
            self._on_yolo_project_switch(path)

    def _create_history_panel(self, main: QVBoxLayout) -> None:
        section = QFrame()
        section.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        layout = QVBoxLayout(section)
        layout.addWidget(QLabel(i18n_manager.get_ui_text("ui.coord_calibration.history_title")))
        self.history_table = QTableWidget()
        self.history_table.setColumnCount(6)
        self.history_table.setHorizontalHeaderLabels(
            ["ID", i18n_manager.get_ui_text("ui.coord_calibration.history_type"),
             i18n_manager.get_ui_text("ui.coord_calibration.history_coords"),
             i18n_manager.get_ui_text("ui.coord_picker.history_col_name") or "Name",
             i18n_manager.get_ui_text("ui.coord_calibration.history_mode"),
             i18n_manager.get_ui_text("ui.coord_calibration.history_time")]
        )
        self.history_table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.history_table.customContextMenuRequested.connect(self._on_history_context_menu)
        self.history_table.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
        layout.addWidget(self.history_table, 1)
        btn_row = QHBoxLayout()
        clear_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.confirm_clear") or "Clear history")
        clear_btn.clicked.connect(self._on_clear_history)
        btn_row.addWidget(clear_btn)
        export_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.export_success") or "Export history")
        export_btn.clicked.connect(self._on_export_history)
        btn_row.addWidget(export_btn)
        layout.addLayout(btn_row)
        main.addWidget(section, 1)

    def _update_history_display(self) -> None:
        if self.history_table is None:
            return
        self.history_table.setRowCount(len(self.pick_history))
        for idx, pick in enumerate(self.pick_history, 1):
            pick_type = pick.get("type", "point")
            x, y = pick.get("x", 0), pick.get("y", 0)
            name = pick.get("name", f"{pick_type.capitalize()} {idx}")
            if pick_type == "point":
                coords = f"({x}, {y})"
            elif pick_type == "rect":
                w, h = pick.get("width", 0), pick.get("height", 0)
                coords = f"{x},{y} {w}×{h}"
            elif pick_type == "circle":
                r = pick.get("radius", 0)
                coords = f"({x},{y}) r={r}"
            else:
                coords = f"({x}, {y})"
            game_mode = pick.get("game_mode", "d3")
            timestamp = (pick.get("timestamp", "") or "")[:19]
            self.history_table.setItem(idx - 1, 0, QTableWidgetItem(str(idx)))
            self.history_table.setItem(idx - 1, 1, QTableWidgetItem(pick_type))
            self.history_table.setItem(idx - 1, 2, QTableWidgetItem(coords))
            self.history_table.setItem(idx - 1, 3, QTableWidgetItem(name))
            self.history_table.setItem(idx - 1, 4, QTableWidgetItem(game_mode))
            self.history_table.setItem(idx - 1, 5, QTableWidgetItem(timestamp))

    def _on_history_context_menu(self, pos) -> None:
        idx = self.history_table.indexAt(pos).row()
        if idx < 0:
            return
        self.history_table.selectRow(idx)
        self.selected_item = f"item_{idx + 1}"
        menu = QMenu(self)
        menu.addAction(i18n_manager.get_ui_text("ui.coord_calibration.rename_item"), self._on_rename_item)
        menu.addAction(i18n_manager.get_ui_text("ui.coord_calibration.delete_item"), self._on_delete_item)
        menu.exec(self.history_table.viewport().mapToGlobal(pos))

    def _on_rename_item(self) -> None:
        if not self.selected_item:
            QMessageBox.warning(self, i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                               i18n_manager.get_ui_text("ui.coord_calibration.select_item_first"))
            return
        parts = self.selected_item.split("_")
        if len(parts) != 2 or not parts[1].isdigit():
            QMessageBox.critical(self, i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection"))
            return
        item_id = int(parts[1]) - 1
        if item_id < 0 or item_id >= len(self.pick_history):
            QMessageBox.critical(self, i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection"))
            return
        old_name = self.pick_history[item_id].get("name", "")
        new_name, ok = QInputDialog.getText(self, i18n_manager.get_ui_text("ui.coord_calibration.rename_title"),
                                            i18n_manager.get_ui_text("ui.coord_calibration.new_name"), text=old_name)
        if ok and new_name is not None:
            self.pick_history[item_id]["name"] = new_name
            self._update_history_display()

    def _on_delete_item(self) -> None:
        if not self.selected_item:
            QMessageBox.warning(self, i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                               i18n_manager.get_ui_text("ui.coord_calibration.select_item_first"))
            return
        parts = self.selected_item.split("_")
        if len(parts) != 2 or not parts[1].isdigit():
            return
        item_id = int(parts[1]) - 1
        if 0 <= item_id < len(self.pick_history):
            del self.pick_history[item_id]
            self._update_history_display()

    def _on_clear_history(self) -> None:
        if QMessageBox.Yes != QMessageBox.question(self, i18n_manager.get_ui_text("ui.coord_calibration.confirm_title"),
                                                   i18n_manager.get_ui_text("ui.coord_calibration.confirm_clear"),
                                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                                                   QMessageBox.StandardButton.No):
            return
        self.pick_history.clear()
        self._update_history_display()
        ColorPrint.green("[COORD_CALIBRATION] History cleared")

    def _on_export_history(self) -> None:
        if not self.pick_history:
            QMessageBox.warning(self, i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                               i18n_manager.get_ui_text("ui.coord_calibration.history_empty"))
            return
        export_dir = Path(__file__).resolve().parent.parent.parent / "exports" / "calibration"
        export_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_path = export_dir / f"calibration_export_{ts}.json"
        export_data = {"timestamp": datetime.now().isoformat(), "total_picks": len(self.pick_history), "picks": self.pick_history}
        with open(export_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        QMessageBox.information(self, i18n_manager.get_ui_text("ui.coord_calibration.success_title"),
                                f"{i18n_manager.get_ui_text('ui.coord_calibration.export_success')}\n{export_path}")
        ColorPrint.green(f"[COORD_CALIBRATION] Export saved to {export_path}")

    def _create_record_log_panel(self, main: QVBoxLayout) -> None:
        log_frame = QFrame()
        log_frame.setStyleSheet(f"background-color: {UITheme.get_color('bg_secondary')};")
        layout = QVBoxLayout(log_frame)
        title = QLabel(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_log_title"))
        title.setStyleSheet(f"color: {UnifiedStyles.COLORS['text_primary']};")
        layout.addWidget(title)
        self.record_log_text = QTextEdit()
        self.record_log_text.setReadOnly(True)
        self.record_log_text.setMaximumHeight(160)
        self.record_log_text.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']}; font-family: monospace;")
        layout.addWidget(self.record_log_text)
        btn_row = QHBoxLayout()
        btn_row.addStretch(1)
        export_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_export_frames"))
        export_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        export_btn.clicked.connect(self._on_export_game_frames)
        btn_row.addWidget(export_btn)
        open_dir_btn = QPushButton(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_open_dir"))
        open_dir_btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['bg_tertiary']}; color: {UnifiedStyles.COLORS['text_primary']};")
        open_dir_btn.clicked.connect(self._on_open_record_dir)
        btn_row.addWidget(open_dir_btn)
        layout.addLayout(btn_row)
        main.addWidget(log_frame)

    def _append_log(self, text: str) -> None:
        if self.record_log_text is None:
            ColorPrint.blue("[YOLO_RECORD] " + text)
            return
        self.record_log_text.append(text)
        self.record_log_text.verticalScrollBar().setValue(self.record_log_text.verticalScrollBar().maximum())
        ColorPrint.blue("[YOLO_RECORD] " + text)

    def _on_capture_screenshot(self) -> None:
        ColorPrint.blue(f"[COORD_CALIBRATION] Capturing for client: {self.current_client_type}...")
        screenshot, err = self._capture_for_client()
        if err:
            QMessageBox.warning(
                self,
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                err,
            )
            ColorPrint.yellow("[COORD_CALIBRATION] No window")
            return
        ColorPrint.green("[COORD_CALIBRATION] Captured in memory")
        self._open_calibration_window()

    def _open_calibration_window(self) -> None:
        if CoordinatePicker is None:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.capture_button") or "Coordinate picker not available.")
            return
        if self.popup_window is not None:
            try:
                if hasattr(self.popup_window, "window") and self.popup_window.window.winfo_exists():
                    self.popup_window.window.destroy()
            except Exception:
                pass
            self.popup_window = None
        if self._tk_root is None or not self._tk_root.winfo_exists():
            self._tk_root = tk.Tk()
            self._tk_root.withdraw()
        self.popup_window = CoordinatePicker(
            screenshot=self.screenshot,
            game_mode=self._game_mode,
            on_picks_updated=self._on_picks_updated,
            parent=self._tk_root,
            client_mode=self.current_client_type,
            pick_history_ref=self.pick_history,
            on_refresh_screenshot=self._capture_for_client,
        )
        def _poll_tk():
            try:
                if self.popup_window and hasattr(self.popup_window, "window") and self.popup_window.window.winfo_exists():
                    self._tk_root.update()
                    QTimer.singleShot(50, _poll_tk)
            except Exception:
                pass
        QTimer.singleShot(50, _poll_tk)

    def _on_picks_updated(self, picks: List[Dict]) -> None:
        for pick in picks:
            pick["timestamp"] = datetime.now().isoformat()
            pick["game_mode"] = self._game_mode
            if "id" not in pick:
                pick["id"] = f"pick_{len(self.pick_history)}"
            self.pick_history.append(pick)
        if not self._use_yolo_data_panel and self.history_table is not None:
            self._update_history_display()
        ColorPrint.green(f"[COORD_CALIBRATION] Added {len(picks)} picks to history")

    def _capture_for_client(self):
        """Returns (screenshot, None) or (None, error_msg)."""
        window_titles = self.WINDOW_TITLES_MAP.get(
            self.current_client_type,
            self.WINDOW_TITLES_MAP[CLIENT_TYPE_BATTLENET],
        )
        if self.current_client_type == CLIENT_TYPE_BATTLENET:
            get_battlenet_manager().prime_window_cache_for_capture()
        elif self.current_client_type == CLIENT_TYPE_D3_GAME:
            get_d3_manager().prime_window_cache_for_capture()
            window_titles = get_d3_manager().get_capture_titles()
        if window_titles is None:
            window_titles = self.WINDOW_TITLES_MAP[CLIENT_TYPE_BATTLENET]
        ws = get_window_screenshot(match_mode="endswith")
        out = ws.capture_first_window_to_memory(titles=window_titles, use_cache=True)
        if not out:
            return (None, i18n_manager.get_ui_text("ui.coord_calibration.no_game_window") or "No window")
        self.screenshot, info = out
        self.screenshot_path = None
        return (self.screenshot, None)

    def _get_yolo_current_project(self) -> Optional[str]:
        if self._yolo_current_project_path and os.path.isdir(self._yolo_current_project_path):
            if is_valid_project_path and is_valid_project_path(self._yolo_current_project_path):
                return self._yolo_current_project_path
        if self._last_record_project_path and os.path.isdir(self._last_record_project_path):
            if is_valid_project_path and is_valid_project_path(self._last_record_project_path):
                return self._last_record_project_path
        if get_default_project_path:
            default = get_default_project_path(self.current_client_type)
            if default and os.path.isdir(default):
                return default
        return None

    def _get_standard_project_paths(self) -> List[str]:
        if not YOLO_DATA_ROOT or not CLIENT_TYPE_TO_RECORD_SUBDIR:
            return []
        subdir = CLIENT_TYPE_TO_RECORD_SUBDIR.get(self.current_client_type, "d3_game")
        root_abs = os.path.abspath(YOLO_DATA_ROOT)
        standard_base = os.path.join(root_abs, subdir)
        try:
            os.makedirs(standard_base, exist_ok=True)
            default_proj = os.path.join(standard_base, "default")
            os.makedirs(default_proj, exist_ok=True)
        except OSError:
            return []
        try:
            names = [n for n in os.listdir(standard_base) if os.path.isdir(os.path.join(standard_base, n))]
            names.sort()
            return [os.path.normpath(os.path.join(standard_base, n)) for n in names]
        except OSError:
            return []

    def _update_yolo_project_dropdown(self) -> None:
        if self._yolo_project_combo is None:
            return
        block = self._yolo_project_combo.blockSignals(True)
        try:
            self._yolo_project_combo.clear()
            standard_paths = self._get_standard_project_paths()
            standard_set = {os.path.normpath(p) for p in standard_paths}
            cache_paths = [p for p in self._yolo_project_list if os.path.normpath(p) not in standard_set and os.path.isdir(p)]
            combined = standard_paths + cache_paths
            for p in combined:
                disp = _short_project_path_display(p)
                path = os.path.normpath(p)
                self._yolo_project_combo.addItem(disp, path)
            current = self._get_yolo_current_project()
            idx = -1
            if current:
                for i in range(self._yolo_project_combo.count()):
                    if self._yolo_project_combo.itemData(i) == current:
                        idx = i
                        break
            if idx >= 0:
                self._yolo_project_combo.setCurrentIndex(idx)
            elif self._yolo_project_combo.count():
                self._yolo_project_combo.setCurrentIndex(0)
        finally:
            self._yolo_project_combo.blockSignals(block)

    def _on_yolo_project_create(self) -> None:
        if not YOLO_DATA_ROOT or not CLIENT_TYPE_TO_RECORD_SUBDIR:
            self._append_log("YOLO_DATA_ROOT not available.")
            return
        subdir = CLIENT_TYPE_TO_RECORD_SUBDIR.get(self.current_client_type, "d3_game")
        root_abs = os.path.abspath(YOLO_DATA_ROOT)
        base = os.path.join(root_abs, subdir)
        try:
            os.makedirs(base, exist_ok=True)
        except OSError as e:
            self._append_log(str(e))
            return
        name = "project_" + datetime.now().strftime("%Y%m%d_%H%M%S")
        project_path = os.path.join(base, name)
        try:
            os.makedirs(project_path, exist_ok=True)
        except OSError as e:
            self._append_log(str(e))
            return
        config_path = os.path.join(project_path, "annotator_config.json")
        if save_project_config:
            save_project_config(config_path, name, ["object"])
        self._yolo_current_project_path = os.path.normpath(project_path)
        config_set(CONFIG_KEY_YOLO_CURRENT_PROJECT, self._yolo_current_project_path)
        self._add_project_to_cache(self._yolo_current_project_path)
        self._update_yolo_project_dropdown()
        self._refresh_yolo_data_table()
        self._append_log((i18n_manager.get_ui_text("ui.coord_calibration.yolo_project_created") or "Project: ") + self._yolo_current_project_path)

    def _add_project_to_cache(self, project_path: str) -> None:
        if not project_path or not str(project_path).strip():
            return
        p = os.path.normpath(str(project_path).strip())
        if p in self._yolo_project_list:
            self._yolo_project_list.remove(p)
        self._yolo_project_list.insert(0, p)
        self._yolo_project_list = self._yolo_project_list[:YOLO_PROJECT_LIST_MAX]
        config_set(CONFIG_KEY_YOLO_PROJECT_LIST, self._yolo_project_list)

    def _on_yolo_data_open_project_dir(self) -> None:
        project = self._get_yolo_current_project()
        if not project:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_no_project") or "No project.")
            return
        if open_record_directory and open_record_directory(project):
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_opened_dir") or "Record directory opened")
        else:
            open_dir(project)
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_opened_dir") or "Opened.")

    def _get_current_client_window_hwnd(self):
        window_titles = self.WINDOW_TITLES_MAP.get(
            self.current_client_type,
            self.WINDOW_TITLES_MAP[CLIENT_TYPE_BATTLENET],
        )
        if self.current_client_type == CLIENT_TYPE_BATTLENET:
            get_battlenet_manager().prime_window_cache_for_capture()
        elif self.current_client_type == CLIENT_TYPE_D3_GAME:
            get_d3_manager().prime_window_cache_for_capture()
            window_titles = get_d3_manager().get_capture_titles()
        if window_titles is None:
            window_titles = self.WINDOW_TITLES_MAP[CLIENT_TYPE_BATTLENET]
        windows = WindowFinder.find_windows_by_titles(
            titles=window_titles, match_mode="endswith", use_cache=True
        )
        if not windows:
            return None
        return windows[0].get("hwnd")

    def _on_yolo_record_config(self) -> None:
        if RecordConfigDialog is None or get_app_root is None:
            return
        try:
            RecordConfigDialog(parent=get_app_root())
        except Exception as e:
            QMessageBox.critical(
                self,
                i18n_manager.get_ui_text("ui.coord_calibration.error_title") or "Error",
                str(e),
            )

    def _on_yolo_record_toggle(self) -> None:
        recording = False
        if flow1_is_recording is not None:
            recording = flow1_is_recording()
        else:
            if bridge_is_recording:
                recording = bridge_is_recording()
        if recording:
            self._on_yolo_record_stop()
        else:
            self._on_yolo_record_start()

    def _on_yolo_record_start(self) -> None:
        self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_starting") or "Starting record...")
        hwnd = self._get_current_client_window_hwnd()
        if hwnd is None:
            msg = i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_error_client_window_required") or "No window found for current client. Open Battle.net / D3 / D4 window first."
            self._append_log(msg)
            return
        if hwnd:
            try:
                WindowActivator().activate_window_by_handle(int(hwnd))
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_client_topped") or "Client window brought to top")
            except (OSError, TypeError) as e:
                self._append_log(str(e))
        cfg = load_record_config() if load_record_config else {}
        w = cfg.get("FrameWidth", 640)
        h = cfg.get("FrameHeight", 360)
        width = int(w) if w is not None and str(w).strip().lstrip("-").isdigit() else 640
        height = int(h) if h is not None and str(h).strip().lstrip("-").isdigit() else 360
        pt = cfg.get("RecordHttpPort", DEFAULT_HTTP_PORT)
        port = int(pt) if pt is not None and str(pt).strip().isdigit() else DEFAULT_HTTP_PORT
        if port < 1024 or port > 65535:
            port = DEFAULT_HTTP_PORT
        project_path = self._get_yolo_current_project()
        if not project_path:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_error_no_sdk") or "project_path required")
            return
        if flow1_start_record and hwnd is not None:
            ok, msg = flow1_start_record(project_path, int(hwnd), width, height, cfg)
            if not ok:
                self._append_log(msg or "Start failed")
                if msg == "already_recording":
                    self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_already") or "Already recording")
                return
        else:
            def _log_cb(line):
                if self.window() and self.window().isVisible():
                    QTimer.singleShot(0, lambda l=line: self._append_log(l))
            ok, msg, project_path = run_gameaisdk_start_record(
                project=project_path,
                client_type=self.current_client_type,
                serial=hwnd,
                port=port,
                width=width,
                height=height,
                log_callback=_log_cb,
            )
            if not ok:
                self._append_log(msg or "Start failed")
                if msg == "already_recording":
                    self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_already") or "Already recording")
                elif msg == "windows_hwnd_required":
                    self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_error_client_window_required") or "No client window. Open Battle.net/D3/D4 first.")
                elif msg == "gameaisdk_or_script_not_found":
                    self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_error_no_sdk") or "SDK not found")
                elif msg == "action_config_not_found":
                    self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_error_no_action_cfg") or "action config not found")
                return
        self._update_yolo_record_status()
        self._last_record_hwnd = int(hwnd) if hwnd is not None else None
        self._last_record_port = port
        self._last_record_project_path = project_path
        if project_path:
            self._update_yolo_project_dropdown()
        self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_start_ok") or "Recording started")
        if project_path:
            self._append_log((i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_dir_label") or "Record dir: ") + project_path)
        if start_record_segment:
            QTimer.singleShot(800, lambda: self._send_start_segment(port))
        if open_record_directory and project_path:
            open_record_directory(project_path)
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_opened_dir") or "Record directory opened")

    def _send_start_segment(self, port: int) -> None:
        if start_record_segment and start_record_segment(port):
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_segment_started") or "Segment started (parameter).")

    def _on_yolo_record_stop(self) -> None:
        self._do_stop_record()

    def _do_stop_record(self) -> None:
        if flow1_stop_record:
            flow1_stop_record()
        else:
            port = self._last_record_port if self._last_record_port is not None else DEFAULT_HTTP_PORT
            if end_record_segment:
                end_record_segment(port)
            if bridge_stop_record:
                bridge_stop_record(port)
        self._update_yolo_record_status()
        self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_stop_ok"))
        if self._use_yolo_data_panel:
            self._refresh_yolo_data_table()
        project = self._get_yolo_current_project()
        if project:
            if get_record_output_subdir:
                out_label = i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_segments_in_output") or "Segments under: "
                self._append_log(out_label + get_record_output_subdir(project))
            if open_record_directory and open_record_directory(project):
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_opened_dir") or "Record directory opened")
            if continue_to_labeling and open_frames_dir_for_labeling:
                segment_dir, frames_dir = continue_to_labeling(project)
                if segment_dir:
                    if frames_dir:
                        open_frames_dir_for_labeling(frames_dir)
                        self._append_log(
                            i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_frames_opened_for_label") or "Segment exported to frames, opened for labeling."
                        )
                    else:
                        self._append_log(
                            i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_no_frames_in_segment") or "No video/images in segment, skip export."
                        )

    def _update_yolo_record_status(self) -> None:
        recording = False
        if flow1_is_recording is not None:
            recording = flow1_is_recording()
        else:
            if bridge_is_recording:
                recording = bridge_is_recording()
        if self._yolo_record_toggle_btn is None:
            return
        btn = self._yolo_record_toggle_btn
        if recording:
            btn.setText(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_stop") or "Stop")
            btn.clicked.disconnect()
            btn.clicked.connect(self._on_yolo_record_stop)
            btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['error']}; color: {UnifiedStyles.COLORS['text_primary']};")
        else:
            client_online = self._get_current_client_window_hwnd() is not None
            btn.clicked.disconnect()
            btn.clicked.connect(self._on_yolo_record_toggle)
            if client_online:
                btn.setText(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_start") or "Start")
                btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS['success']}; color: {UnifiedStyles.COLORS['text_primary']};")
            else:
                btn.setText(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_start_need_window") or "Start (open client window first)")
                btn.setStyleSheet(f"background-color: {UnifiedStyles.COLORS.get('bg_tertiary', '#888888')}; color: {UnifiedStyles.COLORS['text_primary']};")

    def _refresh_yolo_data_table(self) -> None:
        if self.yolo_data_tree is None:
            return
        self.yolo_data_tree.clear()
        self._yolo_data_segment_paths.clear()
        project = self._get_yolo_current_project()
        if not project:
            return
        config_path = os.path.join(project, "annotator_config.json")
        if patch_data:
            base_dir, items = patch_data.load_patch_data(config_path)
            patch_label = (i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_row_label") or "Patch images (for generation)")
            n = len(items)
            patch_item = QTreeWidgetItem(self.yolo_data_tree, ["[%s] %d 张" % (patch_label, n), "-", "-", "-"])
            patch_item.setData(0, Qt.ItemDataRole.UserRole, "_patch")
        if not list_segments or not segment_info:
            return
        status_i18n = {"raw": i18n_manager.get_ui_text("ui.coord_calibration.yolo_status_raw") or "Raw", "exported": i18n_manager.get_ui_text("ui.coord_calibration.yolo_status_exported") or "Exported", "labeled": i18n_manager.get_ui_text("ui.coord_calibration.yolo_status_labeled") or "Labeled"}
        for timestamp, seg_path in list_segments(project):
            info = segment_info(seg_path)
            frames_str = str(info["frames_count"]) if info["frames_count"] else ("video" if info["has_video"] else "-")
            status_key = info.get("status", "raw")
            status_text = status_i18n.get(status_key, status_key)
            size_mb = info.get("size_mb", 0)
            size_str = "%.1f MB" % size_mb if size_mb else "-"
            item = QTreeWidgetItem(self.yolo_data_tree, [timestamp, frames_str, status_text, size_str])
            item.setData(0, Qt.ItemDataRole.UserRole, seg_path)
            self._yolo_data_segment_paths[id(item)] = seg_path
        if not self._yolo_data_segment_paths and self._append_log:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_no_segments") or "No segments. Start recording then stop.")
        self._update_yolo_project_dropdown()
        self._update_yolo_workflow_bar()

    def _update_yolo_workflow_bar(self) -> None:
        if self._yolo_workflow_s1 is None:
            return
        project = self._get_yolo_current_project()
        if not project or not list_segments or not segment_info:
            return
        segments = list_segments(project)
        total = len(segments)
        exported = sum(1 for _, p in segments if segment_info(p).get("has_frames"))
        labeled = sum(1 for _, p in segments if segment_info(p).get("status") == "labeled")
        s1 = i18n_manager.get_ui_text("ui.coord_calibration.yolo_workflow_step1") or "Step 1: Record"
        s2 = i18n_manager.get_ui_text("ui.coord_calibration.yolo_workflow_step2") or "Step 2: Export"
        s3 = i18n_manager.get_ui_text("ui.coord_calibration.yolo_workflow_step3") or "Step 3: Label"
        self._yolo_workflow_s1.setText("%s  %s %d" % (s1, "●" if total else "○", total))
        self._yolo_workflow_s2.setText("%s  %s %d" % (s2, "●" if exported else "○", exported))
        self._yolo_workflow_s3.setText("%s  %s %d" % (s3, "●" if labeled else "○", labeled))

    def _on_yolo_project_switch(self, path: str) -> None:
        if not path or not os.path.isdir(path):
            return
        self._yolo_current_project_path = os.path.normpath(path)
        config_set(CONFIG_KEY_YOLO_CURRENT_PROJECT, self._yolo_current_project_path)
        self._update_yolo_project_dropdown()
        self._refresh_yolo_data_table()
        self._update_yolo_workflow_bar()

    def _on_yolo_segment_context_menu(self, pos) -> None:
        item = self.yolo_data_tree.itemAt(pos)
        self._yolo_segment_context_menu_selected_iid = id(item) if item else None
        if item:
            self.yolo_data_tree.setCurrentItem(item)
            menu = QMenu(self)
            menu.addAction(i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_open_folder") or "Open folder", self._on_yolo_segment_open_folder)
            menu.addAction(i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_export_frames") or "Export frames", self._on_yolo_segment_export_frames)
            menu.addAction(i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_open_label") or "Open for labeling", self._on_yolo_segment_open_for_label)
            delete_act = menu.addAction(i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_delete") or "Delete segment", self._on_yolo_segment_delete)
            if bridge_is_recording and bridge_is_recording():
                delete_act.setEnabled(False)
            menu.exec(self.yolo_data_tree.mapToGlobal(pos))

    def _get_selected_segment_paths(self) -> List[str]:
        paths = []
        if self.yolo_data_tree is None:
            return paths
        for item in self.yolo_data_tree.selectedItems():
            seg_path = item.data(0, Qt.ItemDataRole.UserRole) if item else None
            if seg_path and seg_path != "_patch" and isinstance(seg_path, str) and os.path.isdir(seg_path):
                paths.append(seg_path)
        return paths

    def _get_context_segment_path(self) -> Optional[str]:
        if self.yolo_data_tree is None:
            return None
        for item in self.yolo_data_tree.selectedItems():
            seg_path = item.data(0, Qt.ItemDataRole.UserRole) if item else None
            if seg_path and seg_path != "_patch" and isinstance(seg_path, str) and os.path.isdir(seg_path):
                return seg_path
        iid = self._yolo_segment_context_menu_selected_iid
        if iid is not None and iid in self._yolo_data_segment_paths:
            return self._yolo_data_segment_paths[iid]
        paths = self._get_selected_segment_paths()
        return paths[0] if paths else None

    def _on_yolo_segment_open_folder(self) -> None:
        seg_path = self._get_context_segment_path()
        if not seg_path or not os.path.isdir(seg_path):
            return
        open_dir(seg_path)

    def _on_yolo_segment_export_frames(self) -> None:
        seg_path = self._get_context_segment_path()
        if not seg_path:
            return
        if compose_segment_to_frames:
            compose_segment_to_frames(seg_path, output_subdir="frames", skip_frames=1)
        self._refresh_yolo_data_table()

    def _on_yolo_segment_open_for_label(self) -> None:
        seg_path = self._get_context_segment_path()
        if not seg_path:
            return
        project = self._get_yolo_current_project()
        if not project or not os.path.isdir(project):
            return
        frames_dir = os.path.join(seg_path, "frames")
        if not os.path.isdir(frames_dir) and compose_segment_to_frames:
            ok, _, frames_dir = compose_segment_to_frames(seg_path, output_subdir="frames", skip_frames=1)
            if not ok:
                frames_dir = None
        if flow3_open_label_tool is not None:
            ok, msg = flow3_open_label_tool(images_dir=frames_dir, project_path=project, tk_after=None)
            if ok:
                self._append_log(msg if msg else (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label") or "Open label"))
            else:
                self._append_log(msg or (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label_failed") or "Open label failed"))
        else:
            if open_frames_dir_for_labeling and frames_dir and os.path.isdir(frames_dir):
                open_frames_dir_for_labeling(frames_dir)
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_label_todo") or "TODO: integrate labelImg (see docs/yolo_train_flow.md)")
        self._refresh_yolo_data_table()

    def _on_yolo_segment_delete(self) -> None:
        seg_path = self._get_context_segment_path()
        if not seg_path:
            return
        confirm = i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_confirm_delete") or "Delete this segment folder? This cannot be undone."
        if QMessageBox.question(self, i18n_manager.get_ui_text("ui.coord_calibration.confirm_title") or "Confirm", confirm, QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No, QMessageBox.StandardButton.No) != QMessageBox.StandardButton.Yes:
            return
        if delete_segment:
            ok, msg = delete_segment(seg_path)
            if ok:
                self._refresh_yolo_data_table()
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_deleted") or "Segment deleted.")
            elif self._append_log:
                self._append_log("Delete failed: " + str(msg))

    def _on_yolo_patch_import(self, one_file: bool = True) -> None:
        if not patch_data:
            if self._append_log:
                self._append_log("patch_data (pycore.voc_annotator) not available.")
            return
        project = self._get_yolo_current_project()
        if not project:
            if self._append_log:
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_no_project") or "No project. Start recording first.")
            return
        config_path = os.path.join(project, "annotator_config.json")
        items = []
        base_dir = ""
        if one_file:
            f, _ = QFileDialog.getOpenFileName(self, i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_one") or "Select one patch image", "", "Images (*.png *.jpg *.jpeg *.bmp);;All (*.*)")
            if f:
                base_dir = os.path.dirname(f)
                name = os.path.basename(f)
                stem = os.path.splitext(name)[0].strip() or name
                items = [(name, stem)]
        else:
            d = QFileDialog.getExistingDirectory(self, i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_folder") or "Select folder of patch images")
            if d:
                base_dir = d
                items = patch_data.load_patch_dir(d)
        if not items:
            return
        patch_data.add_patch_source(config_path, base_dir, items)
        self._refresh_yolo_data_table()
        flat = patch_data.get_patch_items_flat(config_path)
        if self._append_log:
            self._append_log((i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_row_label") or "Patch") + ": +%d (new source), total %d. Manage in VOC Annotator (File)." % (len(items), len(flat)))

    def _on_yolo_data_refresh(self) -> None:
        self._refresh_yolo_data_table()
        if self._append_log:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_refreshed") or "Segment list refreshed.")

    def _on_yolo_data_export_selected(self) -> None:
        paths = self._get_selected_segment_paths()
        if not paths:
            if self._append_log:
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_select_first") or "Select one or more segments.")
            return
        first_frames_dir = None
        for seg_path in paths:
            if compose_segment_to_frames:
                ok, msg, frames_dir = compose_segment_to_frames(seg_path, output_subdir="frames", skip_frames=1)
                if ok and frames_dir and first_frames_dir is None:
                    first_frames_dir = frames_dir
        if first_frames_dir and open_frames_dir_for_labeling:
            open_frames_dir_for_labeling(first_frames_dir)
        self._refresh_yolo_data_table()

    def _on_yolo_data_open_label(self) -> None:
        project = self._get_yolo_current_project()
        if not project or not os.path.isdir(project):
            if self._append_log:
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_no_project") or "No project.")
            return
        frames_dir = None
        paths = self._get_selected_segment_paths()
        if paths:
            seg_path = paths[0]
            frames_dir = os.path.join(seg_path, "frames")
            if not os.path.isdir(frames_dir) and compose_segment_to_frames:
                ok, _, frames_dir = compose_segment_to_frames(seg_path, output_subdir="frames", skip_frames=1)
                if not ok:
                    frames_dir = None
        else:
            if get_latest_segment_dir:
                latest_seg = get_latest_segment_dir(project)
                if latest_seg:
                    frames_dir = os.path.join(latest_seg, "frames")
                    if not os.path.isdir(frames_dir) and compose_segment_to_frames:
                        ok, _, frames_dir = compose_segment_to_frames(latest_seg, output_subdir="frames", skip_frames=1)
                        if not ok:
                            frames_dir = None
        if flow3_open_label_tool is not None:
            ok, msg = flow3_open_label_tool(images_dir=frames_dir, project_path=project, tk_after=None)
            if ok:
                self._append_log(msg if msg else (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label") or "Open label"))
            else:
                self._append_log(msg or (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label_failed") or "Open label failed"))
        else:
            if open_frames_dir_for_labeling and frames_dir and os.path.isdir(frames_dir):
                open_frames_dir_for_labeling(frames_dir)
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_label_todo") or "TODO: integrate labelImg (see docs/yolo_train_flow.md)")
        self._refresh_yolo_data_table()

    def _on_yolo_data_merge_selected(self) -> None:
        paths = self._get_selected_segment_paths()
        if not paths:
            if self._append_log:
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_select_first") or "Select one or more segments.")
            return
        if not merge_segments_to_folder:
            return
        target = QFileDialog.getExistingDirectory(self, i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_merge_target") or "Select folder for merged frames")
        if not target:
            return
        ok, msg, merged_dir = merge_segments_to_folder(paths, target, skip_frames=1)
        if ok and merged_dir and open_frames_dir_for_labeling:
            open_frames_dir_for_labeling(merged_dir)
        if self._append_log:
            self._append_log(msg if msg else (i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_merged") or "Merged."))
        self._refresh_yolo_data_table()

    def _on_yolo_data_delete_selected(self) -> None:
        paths = self._get_selected_segment_paths()
        if not paths:
            if self._append_log:
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_select_first") or "Select at least one segment.")
            return
        if bridge_is_recording and bridge_is_recording():
            if self._append_log:
                self._append_log("Cannot delete while recording.")
            return
        msg = (i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_confirm_delete_multiple") or "Delete {count} segments?").replace("{count}", str(len(paths)))
        if QMessageBox.question(self, i18n_manager.get_ui_text("ui.coord_calibration.confirm_title") or "Confirm", msg, QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No, QMessageBox.StandardButton.No) != QMessageBox.StandardButton.Yes:
            return
        failed = 0
        for seg_path in paths:
            if delete_segment:
                ok, _ = delete_segment(seg_path)
                if not ok:
                    failed += 1
        self._refresh_yolo_data_table()
        self._update_yolo_workflow_bar()
        if self._append_log:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_deleted") or "Deleted." if not failed else "Delete failed for %d segment(s)." % failed)

    def _on_flow3_open_label(self) -> None:
        if flow3_open_label_tool is None:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_label_todo") or "TODO: integrate labelImg (see docs/yolo_train_flow.md)")
            return
        project = self._get_yolo_current_project()
        if not project or not os.path.isdir(project):
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_no_project") or "No project.")
            return
        ok, msg = flow3_open_label_tool(project_path=project, tk_after=None)
        if ok:
            self._append_log(msg if msg else (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label") or "Open label"))
        else:
            self._append_log(msg or (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label_failed") or "Open label failed"))

    def _on_export_game_frames(self) -> None:
        project = self._get_yolo_current_project()
        if not project:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_no_dir_yet") or "No record dir yet.")
            return
        if flow2_export_frames:
            ok, msg, frames_dir = flow2_export_frames(project, skip_frames=1)
            if ok:
                self._append_log((i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_export_frames_ok") or "Frames: ") + (msg or ""))
            else:
                self._append_log((i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_export_frames_failed") or "Export failed: ") + (msg or ""))
        else:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_no_dir_yet") or "Export: use Tk build for flow2.")

    def _on_open_record_dir(self) -> None:
        project = self._get_yolo_current_project()
        if not project:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_no_dir_yet") or "No record dir yet. Start recording first.")
            return
        if open_record_directory and open_record_directory(project):
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_opened_dir") or "Record directory opened")
        else:
            open_dir(project)
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_opened_dir") or "Opened.")

    def add_log_message(self, message: str, level: str = "INFO", color=None) -> None:
        """Optional ColorPrint callback; append coord/YOLO-related lines to record log."""
        if "[YOLO" in message or "COORD" in message or "yolo" in message.lower():
            self._append_log(message.strip())