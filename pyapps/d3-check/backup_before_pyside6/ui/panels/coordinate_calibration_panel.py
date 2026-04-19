#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coordinate Calibration Panel (TABLE5) - Unified Style Version
Contains coordinate picking and calibration tools. CoordinatePicker is a transient dialog created on demand and not cached.
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog, simpledialog
import os
import sys
from typing import Optional, Callable, List, Dict

from pycore.pyutils.system_launcher import open_dir
from pathlib import Path
import json
from datetime import datetime

from share.project_path import ensure_d3_check_in_sys_path
from share.ui_registry import get_root
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.common.window_finder import WindowFinder
from d3utils.screenshot_provider import get_window_screenshot
from providor.providor_index import (
    CONFIG,
    save_config,
    CLIENT_TYPE_BATTLENET,
    CLIENT_TYPE_D3_GAME,
    CLIENT_TYPE_D4_GAME,
    VALID_CLIENT_TYPES,
    get_config_value_safe,
    set_config_value_async,
    DIABLO_III_WINDOW_TITLES,
    DIABLO_IV_WINDOW_TITLES,
)
from ..unified_styles import UnifiedStyles
from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.d3_manager import get_d3_manager
from ..utils.tk_variables import var_str, var_bool
from providor.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding
from ..components.yolo_annotation_window import YoloAnnotationWindow
from ..components.coordinate_picker_window import CoordinatePicker
from pycore.pyutils.window_activator import WindowActivator

try:
    from ..components.record_config_dialog import RecordConfigDialog
except ImportError:
    RecordConfigDialog = None

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
        launch_sdktool,
        open_gameaisdk_doc,
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
    launch_sdktool = None
    open_gameaisdk_doc = None
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
        flow4_clean_unlabeled,
        flow5_voc_to_yolo,
        flow6_get_train_config_paths,
        flow6_start_train,
    )
except ImportError:
    flow1_start_record = None
    flow1_stop_record = None
    flow1_new_segment = None
    flow1_is_recording = None
    flow2_export_frames = None
    flow3_open_label_tool = None
    flow4_clean_unlabeled = None
    flow5_voc_to_yolo = None
    flow6_get_train_config_paths = None
    flow6_start_train = None

try:
    from pycore.pyutils.voc_annotator import patch_data
    from pycore.pyutils.voc_annotator.project_config import save_project_config
except ImportError:
    patch_data = None
    save_project_config = None

# Config key for client type (class-library style: module-level constant)
CONFIG_KEY_CLIENT_TYPE = "coord_calibration.client_type"
CONFIG_KEY_YOLO_CURRENT_PROJECT = "coord_calibration.yolo_current_project"
CONFIG_KEY_YOLO_PROJECT_LIST = "coord_calibration.yolo_project_list"
YOLO_PROJECT_LIST_MAX = 30


def _short_project_path_display(path: str) -> str:
    """Return a short display path (last 2 components or basename) for dropdown/labels. Module-level so dropdown never depends on instance method."""
    if not path or not str(path).strip():
        return ""
    p = os.path.normpath(str(path).strip())
    parts = [x for x in p.split(os.sep) if x]
    if len(parts) >= 2:
        return os.path.join(parts[-2], parts[-1])
    return parts[-1] if parts else p


class CoordinateCalibrationPanel:
    """
    Coordinate Calibration Panel for TABLE5
    Handles coordinate picking and analysis for game windows
    """

    # Window title mappings (Battle.net/D3: by exe when path set, else title; use get_capture_titles() for D3 at runtime)
    WINDOW_TITLES_MAP = {
        CLIENT_TYPE_BATTLENET: ["Battle.net"],
        CLIENT_TYPE_D3_GAME: None,  # resolved at capture time via get_d3_manager().get_capture_titles()
        CLIENT_TYPE_D4_GAME: DIABLO_IV_WINDOW_TITLES,
    }

    def __init__(self, parent):
        """Initialize coordinate calibration panel"""
        self.parent = parent
        self.vars = {}
        self.screenshot = None
        self.screenshot_path = None
        self.pick_history: List[Dict] = []

        saved = get_config_value_safe(CONFIG_KEY_CLIENT_TYPE, None)
        self.current_client_type = (
            saved if saved in VALID_CLIENT_TYPES else CLIENT_TYPE_BATTLENET
        )
        self.should_save_screenshot = True
        self.should_compress_screenshot = False
        self.popup_window = None
        self.selected_item = None

        # ttk styles: single source from UITheme.apply_to_root (no second configure here; see docs/ui2)

        # Tab main style (UnifiedStyles.TAB_PAD, same as other tab panels)
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        tab_pad = UnifiedStyles.TAB_PAD
        self.container.pack(fill=tk.BOTH, expand=True, padx=tab_pad, pady=tab_pad)

        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_rowconfigure(0, weight=0)
        self.container.grid_rowconfigure(1, weight=1, minsize=200)
        self.container.grid_rowconfigure(2, weight=0, minsize=120)

        self._last_record_project_path = None
        self._yolo_current_project_path = None  # project namespace: set by dropdown / Create / Load (must be YOLO_DATA_ROOT/client_type/project_name)
        saved_project = get_config_value_safe(CONFIG_KEY_YOLO_CURRENT_PROJECT, None) if get_config_value_safe else None
        if saved_project and isinstance(saved_project, str) and saved_project.strip():
            candidate = os.path.normpath(saved_project.strip())
            if os.path.isdir(candidate) and is_valid_project_path(candidate):
                self._yolo_current_project_path = candidate
            else:
                default_proj = get_default_project_path(self.current_client_type)
                if default_proj:
                    set_config_value_async(CONFIG_KEY_YOLO_CURRENT_PROJECT, default_proj)
        saved_list = get_config_value_safe(CONFIG_KEY_YOLO_PROJECT_LIST, None) if get_config_value_safe else None
        self._yolo_project_list = []  # cache: paths opened via "Load project" (non-standard), persisted
        if isinstance(saved_list, list):
            self._yolo_project_list = [os.path.normpath(str(p).strip()) for p in saved_list if p and str(p).strip()][:YOLO_PROJECT_LIST_MAX]
        self._last_record_hwnd = None
        self._last_record_port = None
        self.record_log_text = None
        self.create_content()

    def create_content(self):
        """Create panel: one top row (client type + coordinate buttons), then YOLO section (or history) and log. Per YOLO_UI_DESIGN."""
        self._create_client_and_button_row()
        self._use_yolo_data_panel = bool(get_record_output_subdir and get_latest_segment_dir is not None)
        if self._use_yolo_data_panel:
            self._create_yolo_section()
        else:
            self._create_history_panel()
        self._create_record_log_panel()

    def _on_client_type_change(self, value: str) -> None:
        """Update current client type and persist so next launch restores selection."""
        self.current_client_type = value
        set_config_value_async(CONFIG_KEY_CLIENT_TYPE, value)
        if getattr(self, "_use_yolo_data_panel", False):
            subdir = CLIENT_TYPE_TO_RECORD_SUBDIR.get(value, "d3_game")
            root_abs = os.path.abspath(YOLO_DATA_ROOT) if YOLO_DATA_ROOT else ""
            current = getattr(self, "_yolo_current_project_path", None)
            if current and root_abs and subdir and not os.path.normpath(current).startswith(os.path.join(root_abs, subdir)):
                self._yolo_current_project_path = None
                set_config_value_async(CONFIG_KEY_YOLO_CURRENT_PROJECT, get_default_project_path(value) or "")
            self._update_yolo_record_status()
            self._update_yolo_project_dropdown()
            self._refresh_yolo_data_table()

    def _create_client_and_button_row(self):
        """Single top row: client type (label + radios) and coordinate buttons, compact height."""
        pad = UnifiedStyles.SPACING['sm']
        btn_pady = 2
        top_frame = tk.Frame(
            self.container,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            highlightbackground=UnifiedStyles.COLORS['panel_border'],
            highlightthickness=1,
        )
        top_frame.grid(row=0, column=0, sticky="ew", padx=0, pady=(0, UnifiedStyles.SPACING['sm']))
        top_frame.grid_columnconfigure(0, weight=1)

        inner = tk.Frame(top_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        inner.pack(side=tk.LEFT, padx=pad, pady=pad)
        lbl = tk.Label(
            inner,
            text=i18n_manager.get_ui_text("ui.coord_calibration.client_mode"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_secondary'],
            font=UnifiedStyles.FONTS['label'],
        )
        lbl.pack(side=tk.LEFT, padx=(0, pad))
        self.var_client = tk.StringVar(value=self.current_client_type)
        for val, key in [
            (CLIENT_TYPE_BATTLENET, "ui.coord_calibration.client_battlenet"),
            (CLIENT_TYPE_D3_GAME, "ui.coord_calibration.client_d3_game"),
            (CLIENT_TYPE_D4_GAME, "ui.coord_calibration.client_d4_game"),
        ]:
            rb = tk.Radiobutton(
                inner,
                text=i18n_manager.get_ui_text(key),
                variable=self.var_client,
                value=val,
                bg=UnifiedStyles.COLORS['bg_secondary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
                activebackground=UnifiedStyles.COLORS['bg_secondary'],
                activeforeground=UnifiedStyles.COLORS['text_primary'],
                font=UnifiedStyles.FONTS['label'],
                command=lambda v=val: self._on_client_type_change(v),
            )
            rb.pack(side=tk.LEFT, padx=(0, pad * 2))

        btn_frame = tk.Frame(top_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        btn_frame.pack(side=tk.LEFT, padx=(pad * 2, 0), pady=pad)
        capture_btn = tk.Button(
            btn_frame,
            text=i18n_manager.get_ui_text("ui.coord_calibration.capture_button"),
            command=self._on_capture_screenshot,
            bg=UnifiedStyles.COLORS['accent'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['accent_light'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=UnifiedStyles.SPACING['sm'],
            pady=btn_pady,
            relief=tk.FLAT,
            cursor='hand2',
        )
        capture_btn.pack(side=tk.LEFT, padx=(0, UnifiedStyles.SPACING['xs']))

    def _create_yolo_section(self):
        """Single YOLO block per YOLO_UI_DESIGN: record row, project row, workflow bar, segment table, toolbar."""
        self.history_tree = None
        if run_gameaisdk_start_record is not None:
            self._yolo_bridge_start = run_gameaisdk_start_record
            self._yolo_bridge_stop = bridge_stop_record
            self._yolo_bridge_is_recording = bridge_is_recording
        pad = UnifiedStyles.SPACING['sm']
        section = ttk.LabelFrame(
            self.container,
            text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_title") or "YOLO Data Management",
            style='TLabelframe',
        )
        section.grid(row=1, column=0, sticky="nsew", padx=0, pady=0)
        section.grid_columnconfigure(0, weight=1)
        inner = tk.Frame(section, bg=UnifiedStyles.COLORS['bg_secondary'])
        inner.grid(row=0, column=0, sticky="nsew", padx=pad, pady=pad)
        inner.grid_columnconfigure(0, weight=1)
        inner.grid_rowconfigure(3, weight=1)
        row_idx = 0

        if run_gameaisdk_start_record is not None:
            rec_row = tk.Frame(inner, bg=UnifiedStyles.COLORS['bg_secondary'])
            rec_row.grid(row=row_idx, column=0, sticky="ew", pady=(0, pad))
            rec_row.grid_columnconfigure(0, weight=1)
            row_idx += 1
            step1 = tk.Frame(rec_row, bg=UnifiedStyles.COLORS['bg_secondary'])
            step1.pack(side=tk.LEFT)
            tk.Button(step1, text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_config") or "Config", command=self._on_yolo_record_config, bg=UnifiedStyles.COLORS['bg_tertiary'], fg=UnifiedStyles.COLORS['text_primary'], font=UnifiedStyles.FONTS['button'], padx=pad, pady=2, relief=tk.FLAT, cursor='hand2').pack(side=tk.LEFT, padx=(0, pad))
            self._yolo_record_toggle_btn = tk.Button(step1, text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_start") or "Start", command=self._on_yolo_record_toggle, bg=UnifiedStyles.COLORS['success'], fg=UnifiedStyles.COLORS['text_primary'], font=UnifiedStyles.FONTS['button'], padx=pad, pady=2, relief=tk.FLAT, cursor='hand2')
            self._yolo_record_toggle_btn.pack(side=tk.LEFT, padx=(0, pad))
            step2 = tk.Frame(rec_row, bg=UnifiedStyles.COLORS['bg_secondary'])
            step2.pack(side=tk.LEFT, padx=(pad * 2, 0))
            self._yolo_open_label_btn = tk.Button(step2, text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label"), command=self._on_flow3_open_label, bg=UnifiedStyles.COLORS['bg_tertiary'], fg=UnifiedStyles.COLORS['text_primary'], font=UnifiedStyles.FONTS['button'], padx=pad, pady=2, relief=tk.FLAT, cursor='hand2')
            self._yolo_open_label_btn.pack(side=tk.LEFT, padx=(0, pad))
            self._yolo_patch_import_btn = tk.Menubutton(step2, text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import") or "Import patch", bg=UnifiedStyles.COLORS['bg_tertiary'], fg=UnifiedStyles.COLORS['text_primary'], font=UnifiedStyles.FONTS['button'], padx=pad, pady=2, relief=tk.FLAT, cursor='hand2')
            self._yolo_patch_import_menu = tk.Menu(self._yolo_patch_import_btn, tearoff=0)
            self._yolo_patch_import_menu.add_command(label=i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_one") or "Import one image", command=lambda: self._on_yolo_patch_import(one_file=True))
            self._yolo_patch_import_menu.add_command(label=i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_folder") or "Import folder", command=lambda: self._on_yolo_patch_import(one_file=False))
            self._yolo_patch_import_btn["menu"] = self._yolo_patch_import_menu
            self._yolo_patch_import_btn.pack(side=tk.LEFT, padx=(0, pad))
            self._update_yolo_record_status()

        project_row = tk.Frame(inner, bg=UnifiedStyles.COLORS['bg_secondary'])
        project_row.grid(row=row_idx, column=0, sticky="ew", pady=(0, pad))
        project_row.grid_columnconfigure(0, weight=1)
        row_idx += 1
        self._yolo_project_dropdown = tk.Menubutton(project_row, text="", bg=UnifiedStyles.COLORS['bg_tertiary'], fg=UnifiedStyles.COLORS['text_primary'], font=UnifiedStyles.FONTS['body'], anchor=tk.W, relief=tk.FLAT, cursor='hand2')
        self._yolo_project_dropdown.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, pad))
        self._yolo_project_dropdown_menu = tk.Menu(self._yolo_project_dropdown, tearoff=0)
        self._yolo_project_dropdown["menu"] = self._yolo_project_dropdown_menu
        tk.Button(project_row, text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_project_create") or "Create new project", command=self._on_yolo_project_create, bg=UnifiedStyles.COLORS['bg_tertiary'], fg=UnifiedStyles.COLORS['text_primary'], font=UnifiedStyles.FONTS['button'], padx=pad, pady=2, relief=tk.FLAT, cursor='hand2').pack(side=tk.RIGHT, padx=(0, pad))
        tk.Button(project_row, text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_open_project") or "Open project dir", command=self._on_yolo_data_open_project_dir, bg=UnifiedStyles.COLORS['bg_tertiary'], fg=UnifiedStyles.COLORS['text_primary'], font=UnifiedStyles.FONTS['button'], padx=pad, pady=2, relief=tk.FLAT, cursor='hand2').pack(side=tk.RIGHT)

        self._yolo_workflow_bar = tk.Frame(inner, bg=UnifiedStyles.COLORS['bg_secondary'])
        self._yolo_workflow_bar.grid(row=row_idx, column=0, sticky="ew", pady=(0, pad))
        self._yolo_workflow_bar.grid_columnconfigure(0, weight=1)
        row_idx += 1
        self._yolo_workflow_s1 = tk.Label(self._yolo_workflow_bar, text="", bg=UnifiedStyles.COLORS['bg_secondary'], fg=UnifiedStyles.COLORS['text_secondary'], font=UnifiedStyles.FONTS['label'])
        self._yolo_workflow_s1.pack(side=tk.LEFT, padx=(0, pad * 2))
        self._yolo_workflow_s2 = tk.Label(self._yolo_workflow_bar, text="", bg=UnifiedStyles.COLORS['bg_secondary'], fg=UnifiedStyles.COLORS['text_secondary'], font=UnifiedStyles.FONTS['label'])
        self._yolo_workflow_s2.pack(side=tk.LEFT, padx=(0, pad * 2))
        self._yolo_workflow_s3 = tk.Label(self._yolo_workflow_bar, text="", bg=UnifiedStyles.COLORS['bg_secondary'], fg=UnifiedStyles.COLORS['text_secondary'], font=UnifiedStyles.FONTS['label'])
        self._yolo_workflow_s3.pack(side=tk.LEFT)

        scrollbar = ttk.Scrollbar(inner)
        scrollbar.grid(row=row_idx, column=1, sticky="ns")
        self.yolo_data_tree = ttk.Treeview(inner, columns=("Timestamp", "Frames", "Status", "Size"), height=8, yscrollcommand=scrollbar.set, style='Treeview', selectmode="extended")
        scrollbar.config(command=self.yolo_data_tree.yview)
        self.yolo_data_tree.column('#0', width=0, stretch=tk.NO)
        self.yolo_data_tree.column("Timestamp", width=180, anchor=tk.W)
        self.yolo_data_tree.column("Frames", width=70, anchor=tk.CENTER)
        self.yolo_data_tree.column("Status", width=90, anchor=tk.W)
        self.yolo_data_tree.column("Size", width=70, anchor=tk.E)
        self.yolo_data_tree.heading("Timestamp", text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_col_timestamp") or "Timestamp")
        self.yolo_data_tree.heading("Frames", text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_col_frames") or "Frames")
        self.yolo_data_tree.heading("Status", text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_col_status") or "Status")
        self.yolo_data_tree.heading("Size", text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_col_size") or "Size")
        self.yolo_data_tree.tag_configure("raw", background="#f0f0f0")
        self.yolo_data_tree.tag_configure("exported", background="#e0f0ff")
        self.yolo_data_tree.tag_configure("labeled", background="#e0ffe0")
        self.yolo_data_tree.grid(row=row_idx, column=0, sticky="nsew")
        self.yolo_data_tree.bind("<Button-3>", self._on_yolo_segment_context_menu)
        self._yolo_data_segment_paths = {}
        self._yolo_segment_context_menu = tk.Menu(self.yolo_data_tree, tearoff=0)
        self._yolo_segment_context_menu.add_command(label=i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_open_folder") or "Open folder", command=self._on_yolo_segment_open_folder)
        self._yolo_segment_context_menu.add_command(label=i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_export_frames") or "Export frames", command=self._on_yolo_segment_export_frames)
        self._yolo_segment_context_menu.add_command(label=i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_open_label") or "Open for labeling", command=self._on_yolo_segment_open_for_label)
        self._yolo_segment_context_menu.add_separator()
        self._yolo_segment_context_menu.add_command(label=i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_delete") or "Delete segment", command=self._on_yolo_segment_delete)
        row_idx += 1

        tool_row = tk.Frame(inner, bg=UnifiedStyles.COLORS['bg_secondary'])
        tool_row.grid(row=row_idx, column=0, sticky="ew", pady=(pad, 0))
        tool_row.grid_columnconfigure(0, weight=1)
        for _key, _cmd in [
            ("ui.coord_calibration.yolo_data_refresh", self._on_yolo_data_refresh),
            ("ui.coord_calibration.yolo_data_export_selected", self._on_yolo_data_export_selected),
            ("ui.coord_calibration.yolo_data_open_label", self._on_yolo_data_open_label),
            ("ui.coord_calibration.yolo_data_merge_selected", self._on_yolo_data_merge_selected),
            ("ui.coord_calibration.yolo_data_delete_selected", self._on_yolo_data_delete_selected),
        ]:
            btn = tk.Button(tool_row, text=i18n_manager.get_ui_text(_key) or _key.split(".")[-1], command=_cmd, bg=UnifiedStyles.COLORS['bg_tertiary'], fg=UnifiedStyles.COLORS['text_primary'], font=UnifiedStyles.FONTS['button'], padx=pad, pady=2, relief=tk.FLAT, cursor='hand2')
            btn.pack(side=tk.LEFT, padx=(0, pad))
        patch_menubtn = tk.Menubutton(tool_row, text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import") or "Import patch", bg=UnifiedStyles.COLORS['bg_tertiary'], fg=UnifiedStyles.COLORS['text_primary'], font=UnifiedStyles.FONTS['button'], padx=pad, pady=2, relief=tk.FLAT, cursor='hand2')
        patch_menu = tk.Menu(patch_menubtn, tearoff=0)
        patch_menu.add_command(label=i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_one") or "Import one image", command=lambda: self._on_yolo_patch_import(one_file=True))
        patch_menu.add_command(label=i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_folder") or "Import folder", command=lambda: self._on_yolo_patch_import(one_file=False))
        patch_menubtn["menu"] = patch_menu
        patch_menubtn.pack(side=tk.LEFT, padx=(0, pad))
        self._refresh_yolo_data_table()
        self._update_yolo_project_dropdown()
        self._update_yolo_workflow_bar()

    def _update_yolo_workflow_bar(self):
        """Update workflow step counts. Call only when YOLO section is active."""
        if not getattr(self, '_yolo_workflow_s1', None) or not self._yolo_workflow_s1.winfo_exists():
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
        self._yolo_workflow_s1.config(text="%s  %s %d" % (s1, "●" if total else "○", total))
        self._yolo_workflow_s2.config(text="%s  %s %d" % (s2, "●" if exported else "○", exported))
        self._yolo_workflow_s3.config(text="%s  %s %d" % (s3, "●" if labeled else "○", labeled))

    def _on_yolo_data_delete_selected(self):
        """Delete all selected segments after confirmation."""
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
        if not messagebox.askyesno(i18n_manager.get_ui_text("ui.coord_calibration.confirm_title"), msg):
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

    def _on_yolo_open_sdktool(self):
        """Launch GameAISDK SDKTool (Config Record / Start Record per doc)."""
        if not launch_sdktool:
            return
        ok, msg = launch_sdktool()
        if ok:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_sdktool_launched") or "SDKTool launched.")
        else:
            self._append_log((i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_sdktool_failed") or "SDKTool launch failed: ") + msg)

    def _on_yolo_open_doc(self):
        """Open GameAISDK doc folder (advanced: Windows recording, Config Record, etc.)."""
        if not open_gameaisdk_doc:
            return
        if open_gameaisdk_doc():
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_doc_opened") or "GameAISDK doc opened.")
        else:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_doc_failed") or "GameAISDK doc not found.")

    def _on_yolo_open_yolo_doc(self):
        """Open GameAISDK YOLO train doc (video to images, labeling, train)."""
        if not open_gameaisdk_doc:
            return
        if open_gameaisdk_doc("YOLO/TrainDetModel.md"):
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_yolo_doc_opened") or "YOLO train doc opened.")
        else:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_doc_failed") or "GameAISDK doc not found.")

    def _on_yolo_record_config(self):
        """Open record config dialog per GameAISDK spec; save to record_cfg.json. TclError kept per PROJECT_STANDARDS (Tk lifecycle)."""
        if RecordConfigDialog is None:
            return
        try:
            RecordConfigDialog(parent=self.parent)
        except tk.TclError as e:
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                str(e),
            )

    def _get_current_client_window_hwnd(self):
        """Resolve window for current UI client type; return hwnd or None (for GameAISDK --serial)."""
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

    def _on_yolo_record_toggle(self):
        """Toggle start/stop: when idle run start, when recording run stop."""
        if flow1_is_recording is not None:
            recording = flow1_is_recording()
        else:
            recording = self._yolo_bridge_is_recording()
        if recording:
            self._on_yolo_record_stop()
        else:
            self._on_yolo_record_start()

    def _on_yolo_record_start(self):
        """Step 1: Start recording (GameAISDK RecordSession). Requires client window for current type (Battle.net/D3/D4) to be open."""
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
        root = self.parent
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
                if root.winfo_exists():
                    root.after(0, lambda l=line: self._append_log(l))
            ok, msg, project_path = self._yolo_bridge_start(
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
        # Auto start first segment (no manual New segment button)
        if start_record_segment:
            root.after(800, lambda: self._send_start_segment(port))
        if open_record_directory and project_path:
            open_record_directory(project_path)
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_opened_dir") or "Record directory opened")

    def _send_start_segment(self, port: int):
        """Parameter control: HTTP method=start_segment to begin recording (no F1)."""
        if start_record_segment and start_record_segment(port):
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_segment_started") or "Segment started (parameter).")

    def _on_yolo_new_segment(self):
        """Step 1d: New segment. end_segment then start_segment."""
        if flow1_new_segment and flow1_new_segment():
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_new_segment") or "New segment started.")
        else:
            port = self._last_record_port if self._last_record_port is not None else DEFAULT_HTTP_PORT
            if end_record_segment:
                end_record_segment(port)
            if start_record_segment and start_record_segment(port):
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_new_segment") or "New segment started.")
        self._update_yolo_record_status()

    def _on_yolo_record_stop(self):
        """Per GameAISDK spec: HTTP end_segment -> quit -> update UI -> log -> open output dir (parameter control, no shortcuts)."""
        self._do_stop_record()

    def _do_stop_record(self):
        """Step 1c: Stop recording; then step 2: export segment frames and open labeling dir (see docs/yolo_train_flow.md)."""
        if flow1_stop_record:
            flow1_stop_record()
        else:
            port = self._last_record_port if self._last_record_port is not None else DEFAULT_HTTP_PORT
            if end_record_segment:
                end_record_segment(port)
            self._yolo_bridge_stop(port)
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

    def _update_yolo_record_status(self):
        """Update toggle button by recording state and client-online state: Recording -> Stop; Idle+client online -> Start; Idle+client offline -> Start (open client window first)."""
        if flow1_is_recording is not None:
            recording = flow1_is_recording()
        else:
            recording = self._yolo_bridge_is_recording()
        if getattr(self, '_yolo_record_toggle_btn', None) and self._yolo_record_toggle_btn.winfo_exists():
            if recording:
                self._yolo_record_toggle_btn.config(
                    text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_stop") or "Stop",
                    command=self._on_yolo_record_stop,
                    bg=UnifiedStyles.COLORS['error'],
                )
            else:
                client_online = self._get_current_client_window_hwnd() is not None
                if client_online:
                    self._yolo_record_toggle_btn.config(
                        text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_start") or "Start",
                        command=self._on_yolo_record_toggle,
                        bg=UnifiedStyles.COLORS['success'],
                    )
                else:
                    self._yolo_record_toggle_btn.config(
                        text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_start_need_window") or "Start (open client window first)",
                        command=self._on_yolo_record_toggle,
                        bg=UnifiedStyles.COLORS.get('bg_tertiary', '#888888'),
                    )

    def _create_history_panel(self):
        """Create history list panel"""
        history_frame = ttk.LabelFrame(
            self.container,
            text=i18n_manager.get_ui_text("ui.coord_calibration.history_title"),
            style='TLabelframe'
        )
        history_frame.grid(row=1, column=0, sticky="nsew", padx=0, pady=0)
        history_frame.grid_rowconfigure(0, weight=0)
        history_frame.grid_columnconfigure(0, weight=1)

        # Create scrollbar
        scrollbar = ttk.Scrollbar(history_frame)
        scrollbar.grid(row=0, column=1, sticky="ns")

        # Treeview height reduced; record log panel below
        self.history_tree = ttk.Treeview(
            history_frame,
            columns=('Index', 'Type', 'Coordinates', 'Name', 'GameMode', 'Timestamp'),
            height=8,
            yscrollcommand=scrollbar.set,
            style='Treeview'
        )
        scrollbar.config(command=self.history_tree.yview)

        self.history_tree.column('#0', width=0, stretch=tk.NO)
        self.history_tree.column('Index', width=50, anchor=tk.CENTER)
        self.history_tree.column('Type', width=80, anchor=tk.CENTER)
        self.history_tree.column('Coordinates', width=150, anchor=tk.W)
        self.history_tree.column('Name', width=120, anchor=tk.W)
        self.history_tree.column('GameMode', width=80, anchor=tk.CENTER)
        self.history_tree.column('Timestamp', width=150, anchor=tk.W)

        self.history_tree.heading('#0', text='', anchor=tk.W)
        self.history_tree.heading('Index', text='ID')
        self.history_tree.heading('Type', text=i18n_manager.get_ui_text("ui.coord_calibration.history_type"))
        self.history_tree.heading('Coordinates', text=i18n_manager.get_ui_text("ui.coord_calibration.history_coords"))
        self.history_tree.heading('Name', text=i18n_manager.get_ui_text("ui.coord_picker.history_col_name") or "Name")
        self.history_tree.heading('GameMode', text=i18n_manager.get_ui_text("ui.coord_calibration.history_mode"))
        self.history_tree.heading('Timestamp', text=i18n_manager.get_ui_text("ui.coord_calibration.history_time"))

        self.history_tree.grid(row=0, column=0, sticky="nsew")

        # Bind right-click context menu
        self.history_tree.bind('<Button-3>', self._on_history_context_menu)

        # Add context menu
        self.context_menu = tk.Menu(self.history_tree, tearoff=0)
        self.context_menu.add_command(
            label=i18n_manager.get_ui_text("ui.coord_calibration.rename_item"),
            command=self._on_rename_item
        )
        self.context_menu.add_command(
            label=i18n_manager.get_ui_text("ui.coord_calibration.delete_item"),
            command=self._on_delete_item
        )


    def _refresh_yolo_data_table(self):
        """Reload segment list into table. First row: patch images (for generation). Then segments. Columns: Timestamp, Frames, Status, Size."""
        if not self.yolo_data_tree.winfo_exists():
            return
        for iid in self.yolo_data_tree.get_children():
            self.yolo_data_tree.delete(iid)
        self._yolo_data_segment_paths.clear()
        project = self._get_yolo_current_project()
        if not project:
            return
        config_path = os.path.join(project, "annotator_config.json")
        if patch_data:
            base_dir, items = patch_data.load_patch_data(config_path)
            patch_label = (i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_row_label") or "Patch images (for generation)")
            n = len(items)
            self.yolo_data_tree.insert("", "end", iid="_patch", values=("[%s] %d 张" % (patch_label, n), "-", "-", "-"), tags=("patch",))
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
            iid = self.yolo_data_tree.insert("", "end", values=(timestamp, frames_str, status_text, size_str), tags=(status_key,))
            self._yolo_data_segment_paths[iid] = seg_path
        if not self._yolo_data_segment_paths and self._append_log:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_no_segments") or "No segments. Start recording then stop.")
        self._update_yolo_project_dropdown()
        self._update_yolo_workflow_bar()

    def _get_standard_project_paths(self):
        """All projects under YOLO_DATA_ROOT/{client_type}: each direct subdir is one project. Ensures client_type and default exist. Sorted by name."""
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

    def _get_yolo_current_project(self):
        """Current project (namespace): explicit Create/Load path, or last record path, or default YOLO_DATA_ROOT/{client_type}/default."""
        if getattr(self, '_yolo_current_project_path', None) and os.path.isdir(self._yolo_current_project_path) and is_valid_project_path(self._yolo_current_project_path):
            return self._yolo_current_project_path
        if getattr(self, '_last_record_project_path', None) and os.path.isdir(self._last_record_project_path) and is_valid_project_path(self._last_record_project_path):
            return self._last_record_project_path
        default = get_default_project_path(self.current_client_type)
        if default and os.path.isdir(default):
            return default
        return None

    def _add_project_to_cache(self, project_path: str) -> None:
        """Add path to cache (non-standard paths opened via Load project). Dedupe, trim, persist."""
        if not project_path or not str(project_path).strip():
            return
        p = os.path.normpath(str(project_path).strip())
        if p in self._yolo_project_list:
            self._yolo_project_list.remove(p)
        self._yolo_project_list.insert(0, p)
        self._yolo_project_list = self._yolo_project_list[:YOLO_PROJECT_LIST_MAX]
        set_config_value_async(CONFIG_KEY_YOLO_PROJECT_LIST, self._yolo_project_list)

    def _on_yolo_project_create(self):
        """Create new project under YOLO_DATA_ROOT/{client_type}/ with auto-generated name (project_YYYYMMDD_HHMMSS). No dialog. Then set as current and refresh dropdown."""
        if not YOLO_DATA_ROOT or not CLIENT_TYPE_TO_RECORD_SUBDIR:
            if self._append_log:
                self._append_log("YOLO_DATA_ROOT not available.")
            return
        subdir = CLIENT_TYPE_TO_RECORD_SUBDIR.get(self.current_client_type, "d3_game")
        root_abs = os.path.abspath(YOLO_DATA_ROOT)
        base = os.path.join(root_abs, subdir)
        try:
            os.makedirs(base, exist_ok=True)
        except OSError as e:
            if self._append_log:
                self._append_log(str(e))
            return
        name = "project_" + datetime.now().strftime("%Y%m%d_%H%M%S")
        project_path = os.path.join(base, name)
        try:
            os.makedirs(project_path, exist_ok=True)
        except OSError as e:
            if self._append_log:
                self._append_log(str(e))
            return
        config_path = os.path.join(project_path, "annotator_config.json")
        if save_project_config:
            save_project_config(config_path, name, ["object"])
        self._yolo_current_project_path = os.path.normpath(project_path)
        set_config_value_async(CONFIG_KEY_YOLO_CURRENT_PROJECT, self._yolo_current_project_path)
        self._add_project_to_cache(self._yolo_current_project_path)
        self._update_yolo_project_dropdown()
        self._refresh_yolo_data_table()
        if self._append_log:
            self._append_log((i18n_manager.get_ui_text("ui.coord_calibration.yolo_project_created") or "Project: ") + self._yolo_current_project_path)

    def _on_yolo_project_load(self):
        """Load project: open non-standard path; add to cache and set as current."""
        toplevel = self.parent.winfo_toplevel() if hasattr(self.parent, "winfo_toplevel") else self.parent
        d = filedialog.askdirectory(
            title=i18n_manager.get_ui_text("ui.coord_calibration.yolo_project_load_title") or "Select project directory",
            parent=toplevel,
        )
        if not d or not os.path.isdir(d):
            return
        self._yolo_current_project_path = os.path.normpath(d)
        set_config_value_async(CONFIG_KEY_YOLO_CURRENT_PROJECT, self._yolo_current_project_path)
        self._add_project_to_cache(self._yolo_current_project_path)
        self._update_yolo_project_dropdown()
        self._refresh_yolo_data_table()
        if self._append_log:
            self._append_log((i18n_manager.get_ui_text("ui.coord_calibration.yolo_project_loaded") or "Loaded project: ") + self._yolo_current_project_path)

    def _make_yolo_project_switch_cmd(self, project_path: str):
        """Return a command callable that switches to the given project (for dropdown menu; avoids closure capture)."""
        return lambda: self._on_yolo_project_switch(project_path)

    def _on_yolo_project_switch(self, project_path):
        """Switch current project to the given path (from dropdown). Updates dropdown label, segment table, and workflow bar."""
        if not project_path or not os.path.isdir(project_path):
            return
        self._yolo_current_project_path = os.path.normpath(project_path)
        set_config_value_async(CONFIG_KEY_YOLO_CURRENT_PROJECT, self._yolo_current_project_path)
        self._update_yolo_project_dropdown()
        self._refresh_yolo_data_table()
        self._update_yolo_workflow_bar()

    def _short_project_path(self, path: str) -> str:
        """Return a short display path (last 2 components or basename). Delegates to module-level helper."""
        return _short_project_path_display(path)

    def _update_yolo_project_dropdown(self):
        """Rebuild project dropdown: list = standard + cache paths only; dropdown is for switching project. Current selection is persisted and restored on next open."""
        if not getattr(self, '_yolo_project_dropdown', None) or not self._yolo_project_dropdown.winfo_exists():
            return
        project = self._get_yolo_current_project()
        label_prefix = i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_project_label") or "Project: "
        if project:
            self._yolo_project_dropdown.config(text=label_prefix + _short_project_path_display(project))
        else:
            self._yolo_project_dropdown.config(text=label_prefix + (i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_no_project") or "(none)"))
        standard_paths = self._get_standard_project_paths()
        standard_set = {os.path.normpath(p) for p in standard_paths}
        cache_paths = [p for p in self._yolo_project_list if os.path.normpath(p) not in standard_set and os.path.isdir(p)]
        combined = standard_paths + cache_paths
        menu = self._yolo_project_dropdown_menu
        menu.delete(0, tk.END)
        for p in combined:
            disp = _short_project_path_display(p)
            path = os.path.normpath(p)
            menu.add_command(label=disp, command=self._make_yolo_project_switch_cmd(path))
        # Dropdown is only for switching project; Create is a separate button, Load removed from here

    def _on_yolo_data_open_project_dir(self):
        project = self._get_yolo_current_project()
        if project and open_record_directory:
            open_record_directory(project, open_latest_segment=False)
        elif self._append_log:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_no_project") or "No project.")

    def _on_yolo_segment_context_menu(self, event):
        """Show segment right-click menu. Disable Delete when recording."""
        item = self.yolo_data_tree.identify('item', event.x, event.y)
        if item:
            self.yolo_data_tree.selection_set(item)
            self._yolo_segment_context_menu_selected_iid = item
            delete_index = 4
            if bridge_is_recording and bridge_is_recording():
                self._yolo_segment_context_menu.entryconfig(delete_index, state=tk.DISABLED)
            else:
                self._yolo_segment_context_menu.entryconfig(delete_index, state=tk.NORMAL)
            self._yolo_segment_context_menu.tk_popup(event.x_root, event.y_root)

    def _get_selected_segment_paths(self):
        sel = self.yolo_data_tree.selection()
        return [self._yolo_data_segment_paths[iid] for iid in sel if iid in self._yolo_data_segment_paths]

    def _on_yolo_patch_import(self, one_file=True):
        """Import one image or a folder as a new patch source (project-level). Data is managed in VOC Annotator (File)."""
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
            f = filedialog.askopenfilename(
                title=i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_one") or "Select one patch image",
                filetypes=[("Images", "*.png *.jpg *.jpeg *.bmp"), ("All", "*.*")],
            )
            if f:
                base_dir = os.path.dirname(f)
                name = os.path.basename(f)
                stem = os.path.splitext(name)[0].strip() or name
                items = [(name, stem)]
        else:
            d = filedialog.askdirectory(title=i18n_manager.get_ui_text("ui.coord_calibration.yolo_patch_import_folder") or "Select folder of patch images")
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

    def _get_context_segment_path(self):
        iid = getattr(self, '_yolo_segment_context_menu_selected_iid', None)
        if iid and iid in self._yolo_data_segment_paths:
            return self._yolo_data_segment_paths[iid]
        paths = self._get_selected_segment_paths()
        return paths[0] if paths else None

    def _on_yolo_segment_open_folder(self):
        seg_path = self._get_context_segment_path()
        if not seg_path or not os.path.isdir(seg_path):
            return
        open_dir(seg_path)

    def _on_yolo_segment_export_frames(self):
        seg_path = self._get_context_segment_path()
        if not seg_path:
            return
        if compose_segment_to_frames:
            compose_segment_to_frames(seg_path, output_subdir="frames", skip_frames=1)
        self._refresh_yolo_data_table()

    def _on_yolo_segment_open_for_label(self):
        """Right-click: Open for labeling. Open VOC Annotator with project path; optionally pass this segment's frames so annotator opens on it."""
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
            root = get_root()
            ok, msg = flow3_open_label_tool(images_dir=frames_dir, project_path=project, tk_after=root.after if root else None)
            if ok:
                self._append_log(msg if msg else (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label") or "Open label"))
            else:
                self._append_log(msg or (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label_failed") or "Open label failed"))
        else:
            if open_frames_dir_for_labeling and frames_dir and os.path.isdir(frames_dir):
                open_frames_dir_for_labeling(frames_dir)
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_label_todo") or "TODO: integrate labelImg (see docs/yolo_train_flow.md)")
        self._refresh_yolo_data_table()

    def _on_yolo_segment_delete(self):
        seg_path = self._get_context_segment_path()
        if not seg_path:
            return
        confirm = i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_confirm_delete") or "Delete this segment folder? This cannot be undone."
        if not messagebox.askyesno(
            i18n_manager.get_ui_text("ui.coord_calibration.confirm_title"),
            confirm,
        ):
            return
        if delete_segment:
            ok, msg = delete_segment(seg_path)
            if ok:
                self._refresh_yolo_data_table()
                if self._append_log:
                    self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_segment_deleted") or "Segment deleted.")
            elif self._append_log:
                self._append_log("Delete failed: " + msg)

    def _on_yolo_data_merge_selected(self):
        paths = self._get_selected_segment_paths()
        if not paths:
            if self._append_log:
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_select_first") or "Select one or more segments.")
            return
        if not merge_segments_to_folder:
            return
        target = filedialog.askdirectory(
            title=i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_merge_target") or "Select folder for merged frames",
        )
        if not target:
            return
        ok, msg, merged_dir = merge_segments_to_folder(paths, target, skip_frames=1)
        if ok and merged_dir and open_frames_dir_for_labeling:
            open_frames_dir_for_labeling(merged_dir)
        if self._append_log:
            self._append_log(msg if msg else (i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_merged") or "Merged."))
        self._refresh_yolo_data_table()

    def _on_yolo_data_refresh(self):
        self._refresh_yolo_data_table()
        if self._append_log:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_refreshed") or "Segment list refreshed.")

    def _on_yolo_data_export_selected(self):
        sel = self.yolo_data_tree.selection()
        paths = [self._yolo_data_segment_paths[iid] for iid in sel if iid in self._yolo_data_segment_paths]
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

    def _on_yolo_data_open_label(self):
        """Data toolbar: Open label. Always open VOC Annotator with current active project; use selected segment's frames or latest segment's frames as default images dir."""
        project = self._get_yolo_current_project()
        if not project or not os.path.isdir(project):
            if self._append_log:
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_no_project") or "No project.")
            return
        frames_dir = None
        sel = self.yolo_data_tree.selection()
        paths = [self._yolo_data_segment_paths[iid] for iid in sel if iid in self._yolo_data_segment_paths]
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
            root = get_root()
            ok, msg = flow3_open_label_tool(images_dir=frames_dir, project_path=project, tk_after=root.after if root else None)
            if ok:
                self._append_log(msg if msg else (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label") or "Open label"))
            else:
                self._append_log(msg or (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label_failed") or "Open label failed"))
        else:
            if open_frames_dir_for_labeling and frames_dir and os.path.isdir(frames_dir):
                open_frames_dir_for_labeling(frames_dir)
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_label_todo") or "TODO: integrate labelImg (see docs/yolo_train_flow.md)")
        self._refresh_yolo_data_table()

    def _create_record_log_panel(self):
        """Record log area below history (GameAISDK spec: show log and record info) and open-record-dir button."""
        log_frame = ttk.LabelFrame(
            self.container,
            text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_log_title"),
            style='TLabelframe',
        )
        log_frame.grid(row=2, column=0, sticky="nsew", padx=0, pady=(UnifiedStyles.SPACING['sm'], 0))
        log_frame.grid_rowconfigure(0, weight=1)
        log_frame.grid_columnconfigure(0, weight=1)
        inner = tk.Frame(log_frame)
        inner.pack(fill=tk.BOTH, expand=True)
        inner.grid_columnconfigure(0, weight=1)
        inner.grid_rowconfigure(0, weight=1)
        log_scroll = ttk.Scrollbar(inner)
        self.record_log_text = tk.Text(
            inner,
            height=8,
            wrap=tk.WORD,
            state=tk.DISABLED,
            bg=UnifiedStyles.COLORS.get('bg_tertiary', '#2d2d2d'),
            fg=UnifiedStyles.COLORS.get('text_primary', '#eceff4'),
            font=('Consolas', 9),
            insertbackground=UnifiedStyles.COLORS.get('text_primary', '#eceff4'),
            yscrollcommand=log_scroll.set,
        )
        log_scroll.config(command=self.record_log_text.yview)
        self.record_log_text.grid(row=0, column=0, sticky="nsew")
        log_scroll.grid(row=0, column=1, sticky="ns")
        btn_row = tk.Frame(inner, bg=UnifiedStyles.COLORS['bg_primary'])
        btn_row.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(UnifiedStyles.SPACING['xs'], 0))
        btn_row.grid_columnconfigure(0, weight=1)
        export_frames_btn = tk.Button(
            btn_row,
            text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_export_frames"),
            command=self._on_export_game_frames,
            bg=UnifiedStyles.COLORS['bg_tertiary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=UnifiedStyles.SPACING['sm'],
            pady=2,
            relief=tk.FLAT,
            cursor='hand2',
        )
        export_frames_btn.pack(side=tk.RIGHT, padx=(0, UnifiedStyles.SPACING['xs']))
        self._open_record_dir_btn = tk.Button(
            btn_row,
            text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_open_dir"),
            command=self._on_open_record_dir,
            bg=UnifiedStyles.COLORS['bg_tertiary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=UnifiedStyles.SPACING['sm'],
            pady=2,
            relief=tk.FLAT,
            cursor='hand2',
        )
        self._open_record_dir_btn.pack(side=tk.RIGHT)

    def _append_log(self, text: str):
        """Append one line to record log and echo via ColorPrint so console and GameAISDK output are visible."""
        if self.record_log_text is None or not self.record_log_text.winfo_exists():
            ColorPrint.blue("[YOLO_RECORD] " + text)
            return
        self.record_log_text.config(state=tk.NORMAL)
        self.record_log_text.insert(tk.END, text + "\n")
        self.record_log_text.see(tk.END)
        self.record_log_text.config(state=tk.DISABLED)
        ColorPrint.blue("[YOLO_RECORD] " + text)

    def _on_flow2_export_frames(self):
        """Step 2: Export frames. Export latest segment to frames (equivalent to GameAISDK TrainDetModel frame export)."""
        project = self._get_yolo_current_project()
        if not project:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_no_dir_yet") or "No record dir yet.")
            return
        if flow2_export_frames is not None:
            ok, msg, frames_dir = flow2_export_frames(project, skip_frames=1)
        else:
            if not get_latest_segment_dir or not compose_segment_to_frames:
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_no_dir_yet") or "No record dir yet.")
                return
            segment_dir = get_latest_segment_dir(project)
            if not segment_dir:
                self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_no_segment") or "No segment in project.")
                return
            ok, msg, frames_dir = compose_segment_to_frames(segment_dir, output_subdir="frames", skip_frames=1)
        if ok:
            self._append_log((i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_export_frames_ok") or "Frames: ") + (msg or ""))
            if frames_dir and open_frames_dir_for_labeling:
                open_frames_dir_for_labeling(frames_dir)
            elif frames_dir:
                open_dir(frames_dir)
        else:
            self._append_log((i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_export_frames_failed") or "Export failed: ") + (msg or ""))

    def _on_flow3_open_label(self):
        """Step 3: Label. Open VOC Annotator with project path only; annotator loads config, segments, patch and provides segment switcher."""
        ColorPrint.blue("[DEBUG] 打开标注 (flow3) clicked")
        if flow3_open_label_tool is None:
            ColorPrint.yellow("[DEBUG] flow3_open_label_tool is None, cannot open annotator")
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_label_todo") or "TODO: integrate labelImg (see docs/yolo_train_flow.md)")
            return
        project = self._get_yolo_current_project()
        ColorPrint.blue("[DEBUG] 打开标注 (flow3): project=%s, isdir=%s" % (project, os.path.isdir(project) if project else False))
        if not project or not os.path.isdir(project):
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_data_no_project") or "No project.")
            return
        root = get_root()
        ColorPrint.blue("[DEBUG] 打开标注 (flow3): calling flow3_open_label_tool(project_path=%s)" % project)
        ok, msg = flow3_open_label_tool(project_path=project, tk_after=root.after if root else None)
        ColorPrint.blue("[DEBUG] 打开标注 (flow3): flow3_open_label_tool returned ok=%s, msg=%s" % (ok, msg))
        if ok:
            self._append_log(msg if msg else (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label") or "Open label"))
        else:
            self._append_log(msg or (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_open_label_failed") or "Open label failed"))

    def _on_flow4_clean_unlabeled(self):
        """Step 4 (optional): Clean unlabeled. Remove images without XML and XML without image (GameAISDK yolo_label_lib)."""
        if flow4_clean_unlabeled is None:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_lib_not_available") or "GameAISDK yolo_label_lib not available")
            return
        frames_dir = None
        project = self._get_yolo_current_project()
        if project and get_latest_segment_dir:
            seg = get_latest_segment_dir(project)
            if seg:
                frames_dir = os.path.join(seg, "frames")
        if not frames_dir or not os.path.isdir(frames_dir):
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_no_segment") or "Export frames first (step2).")
            return
        ok, msg = flow4_clean_unlabeled(frames_dir, None)
        if ok:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_clean_done") or "Clean unlabeled done.")
        else:
            self._append_log(msg or (i18n_manager.get_ui_text("ui.coord_calibration.yolo_flow_clean_failed") or "Clean unlabeled failed."))

    def _on_export_game_frames(self):
        """Same as step 2: export frames (log-area button reuse)."""
        self._on_flow2_export_frames()

    def _on_open_record_dir(self):
        """Open record directory in explorer; open latest segment folder if present (unified layout: project_path/segment_id/)."""
        project = self._get_yolo_current_project()
        if not project:
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_no_dir_yet") or "No record dir yet. Start recording first.")
            return
        if open_record_directory and open_record_directory(project):
            self._append_log(i18n_manager.get_ui_text("ui.coord_calibration.yolo_record_opened_dir") or "Record directory opened")

    def _capture_for_client(self):
        """Capture current client window to memory. Returns (screenshot, None) or (None, error_msg)."""
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

    def _on_capture_screenshot(self):
        """Activate client window, capture to memory (no file), open picker."""
        ColorPrint.blue(f"[COORD_CALIBRATION] Capturing for client: {self.current_client_type}...")
        screenshot, err = self._capture_for_client()
        if err:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                err
            )
            ColorPrint.yellow(f"[COORD_CALIBRATION] No window")
            return
        ColorPrint.green(f"[COORD_CALIBRATION] Captured in memory")
        self._open_calibration_window()

    def _on_yolo_collect(self):
        """Capture for current client and open YOLO training data collection window."""
        ColorPrint.blue(f"[COORD_CALIBRATION] YOLO collect for client: {self.current_client_type}...")
        screenshot, err = self._capture_for_client()
        if err:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                err
            )
            return
        YoloAnnotationWindow(
            initial_screenshot=screenshot,
            client_mode=self.current_client_type,
            on_capture=self._capture_for_client,
            parent=self.parent,
        )

    def _open_calibration_window(self):
        """Open calibration window for coordinate picking"""
        if self.popup_window:
            self.popup_window.destroy()

        game_mode = self.vars.get('game_mode')
        game_mode_val = game_mode.get() if game_mode else 'd3'
        self.popup_window = CoordinatePicker(
            screenshot=self.screenshot,
            game_mode=game_mode_val,
            on_picks_updated=self._on_picks_updated,
            parent=self.parent,
            client_mode=self.current_client_type,
            pick_history_ref=self.pick_history,
            on_refresh_screenshot=self._capture_for_client,
        )

    def _on_picks_updated(self, picks: List[Dict]):
        """Handle updated picks from calibration window"""
        gm_var = self.vars.get('game_mode')
        game_mode_val = gm_var.get() if gm_var is not None else 'd3'
        for pick in picks:
            pick['timestamp'] = datetime.now().isoformat()
            pick['game_mode'] = game_mode_val
            # Ensure pick has an id if not present
            if 'id' not in pick:
                pick['id'] = f"pick_{len(self.pick_history)}"
            self.pick_history.append(pick)

        if not self._use_yolo_data_panel:
            self._update_history_display()
        ColorPrint.green(f"[COORD_CALIBRATION] Added {len(picks)} picks to history")

    def _update_history_display(self):
        """Update history tree display. Call only when history panel is active (_use_yolo_data_panel is False)."""
        for item in self.history_tree.get_children():
            self.history_tree.delete(item)

        for idx, pick in enumerate(self.pick_history, 1):
            pick_type = pick.get('type', 'point')
            x, y = pick.get('x', 0), pick.get('y', 0)
            name = pick.get('name', f"{pick_type.capitalize()} {idx}")
            if pick_type == 'point':
                coords = f"({x}, {y})"
            elif pick_type == 'rect':
                w, h = pick.get('width', 0), pick.get('height', 0)
                coords = f"{x},{y} {w}×{h}"
            elif pick_type == 'circle':
                r = pick.get('radius', 0)
                coords = f"({x},{y}) r={r}"
            else:
                coords = f"({x}, {y})"
            game_mode = pick.get('game_mode', 'd3')
            timestamp = pick.get('timestamp', '')[:19]

            self.history_tree.insert(
                '',
                'end',
                iid=f"item_{idx}",
                values=(idx, pick_type, coords, name, game_mode, timestamp)
            )

    def _on_history_context_menu(self, event):
        """Show context menu for history item. Bound only when history panel is active."""
        if not self.history_tree.winfo_exists():
            return
        item = self.history_tree.identify('item', event.x, event.y)
        if item:
            self.history_tree.selection_set(item)
            self.selected_item = item
            if self.context_menu.winfo_exists():
                self.context_menu.tk_popup(event.x_root, event.y_root)

    def _on_rename_item(self):
        """Rename selected history item. Invoked from context menu only when history panel is active."""
        if self.selected_item is None or not self.selected_item:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.select_item_first")
            )
            return
        parts = self.selected_item.split('_')
        if len(parts) != 2 or not parts[1].isdigit():
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection")
            )
            return
        item_id = int(parts[1]) - 1
        if item_id < 0 or item_id >= len(self.pick_history):
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection")
            )
            return
        old_name = self.pick_history[item_id].get('name', '')

        dialog = tk.Toplevel(self.parent)
        dialog.title(i18n_manager.get_ui_text("ui.coord_calibration.rename_title"))
        dialog.geometry("300x100")
        dialog.resizable(False, False)

        label = tk.Label(dialog, text=i18n_manager.get_ui_text("ui.coord_calibration.new_name"))
        label.pack(padx=10, pady=5)

        entry = tk.Entry(dialog, bg=UnifiedStyles.COLORS['input_bg'], fg=UnifiedStyles.COLORS['input_text'])
        entry.insert(0, old_name)
        entry.pack(padx=10, pady=5, fill=tk.X)
        entry.focus()

        def on_ok():
            new_name = entry.get()
            self.pick_history[item_id]['name'] = new_name
            if not self._use_yolo_data_panel:
                self._update_history_display()
            dialog.destroy()

        btn = tk.Button(dialog, text="OK", command=on_ok)
        btn.pack(pady=5)

    def _on_delete_item(self):
        """Delete selected history item. Invoked from context menu only when history panel is active."""
        if self.selected_item is None or not self.selected_item:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.select_item_first")
            )
            return
        parts = self.selected_item.split('_')
        if len(parts) != 2 or not parts[1].isdigit():
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection")
            )
            return
        item_id = int(parts[1]) - 1
        if item_id < 0 or item_id >= len(self.pick_history):
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection")
            )
            return
        del self.pick_history[item_id]
        if not self._use_yolo_data_panel:
            self._update_history_display()

    def _on_clear_history(self):
        """Clear all history"""
        if messagebox.askyesno(
            i18n_manager.get_ui_text("ui.coord_calibration.confirm_title"),
            i18n_manager.get_ui_text("ui.coord_calibration.confirm_clear")
        ):
            self.pick_history.clear()
            if not self._use_yolo_data_panel:
                self._update_history_display()
            ColorPrint.green("[COORD_CALIBRATION] History cleared")

    def _on_export_history(self):
        """Export history to JSON"""
        if not self.pick_history:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.history_empty")
            )
            return

        export_dir = Path(__file__).parent.parent.parent / "exports" / "calibration"
        export_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_path = export_dir / f"calibration_export_{timestamp}.json"
        export_data = {
            'timestamp': datetime.now().isoformat(),
            'total_picks': len(self.pick_history),
            'picks': self.pick_history
        }
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        messagebox.showinfo(
            i18n_manager.get_ui_text("ui.coord_calibration.success_title"),
            f"{i18n_manager.get_ui_text('ui.coord_calibration.export_success')}\n{export_path}"
        )
        ColorPrint.green(f"[COORD_CALIBRATION] Export saved to {export_path}")
