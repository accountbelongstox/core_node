#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ROSBOT Extension Panel - Unified Style Version
Contains ROSBOT configuration and management features with unified styling
"""

import os
import re
import threading
import time
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from typing import Optional, Callable

# Import unified styles
from ..unified_styles import UnifiedStyles

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from ..utils.tk_variables import var_str, var_bool

# Import CONFIG from providor (path set by main.py / app entry)
from providor.providor_index import CONFIG, get_config_value_safe, LOGS_FILE_PATH

# Import i18n manager (global singleton instance)
from providor.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding

# Import game state and task thread manager (timer/UI are sibling modules; controller wires status UI and refresh fn)
from share.game_interface_data import get_game_interface_data
from timers.one_shot_tasks import (
    do_path_scan,
    do_window_monitor_initial_check,
    do_battlenet_ui_analyze,
    do_rosbot_debug,
    do_rosbot_update,
)
from d3utils.path_scanner import pick_best_rosbot_dir_by_region, are_paths_valid_for_skip_scan
from pycore.pyutils.system_launcher import open_file_with_notepad
from providor.constants.common import TAMPERMONKEY_SCRIPT_PATH, BATTLE_NET_EXE_NAME
from providor.constants.d3 import DIABLO_III_EXE_NAME, ROSBOT_EXE_PATTERNS, ROSBOT_DIR_NAMESPACE_ASIA, ROSBOT_DIR_NAMESPACE_CN
from runtime import (
    get_task_manager,
    TaskStatus,
    D3ExtensionThread,
    get_d3_extension_thread,
    trigger_extension_rosbot_start,
    trigger_extension_rosbot_stop,
    is_shutdown_requested,
)
from ui.panels.log_panel import _strip_ui_log_prefix
import timers.timer_manager as timer_manager
import d3utils.rosbot_task_processor as rosbot_processor
from controller.login_try_screenshot_controller import get_login_try_screenshot_controller
from d3utils.rosbot_flow_battlenet import reset_flow_master_bn_block
from d3utils.log_monitor_api import get_last_log_modified_time
from d3utils.rosbot_flow_state import (
    set_flow_master_enabled,
    set_bn_only_enabled,
)
from d3utils.rosbot_operation import get_rosbot_operation
from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.rosbot_update_manager import get_rosbot_update_manager
from share.asia_credentials import schedule_battlenet_credentials_dialog


def _fetch_rosbot_config_then_create(panel: "RosbotExtensionPanel") -> None:
    """Run in timer thread: fetch all config values, then schedule UI creation on main thread (THREAD_BUS_AND_REGISTRY §5)."""
    if panel._content_created:
        return
    snapshot = {}
    for i, (key_path, default) in enumerate(ROSBOT_PANEL_CONFIG_KEYS):
        snapshot[key_path] = get_config_value_safe(key_path, default)
    def on_main():
        if panel._content_created:
            return
        panel._create_content_with_snapshot(snapshot)
    panel.container.after(0, on_main)


def _fetch_rosbot_config_on_main_then_create(panel: "RosbotExtensionPanel") -> None:
    """Run on main thread when timer is not started yet (docs/ui_5 plan B). Build snapshot via get_config_value_safe then create UI; may block briefly."""
    if panel._content_created:
        return
    snapshot = {}
    for key_path, default in ROSBOT_PANEL_CONFIG_KEYS:
        snapshot[key_path] = get_config_value_safe(key_path, default)
    if panel._content_created:
        return
    panel._create_content_with_snapshot(snapshot)


# Config keys and defaults for this panel; read in timer thread to avoid main-thread block (THREAD_BUS: no blocking on config worker).
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


class RosbotExtensionPanel:
    """ROSBOT Extension panel with unified styling"""

    def __init__(self, parent, bottom_bar=None):
        """Initialize ROSBOT extension panel. bottom_bar: optional BottomBar to update status (merged into bottom Game Status row)."""
        self.parent = parent
        self._bottom_bar = bottom_bar
        self._path_scan_submit_time = 0.0  # Debounce: avoid duplicate scan from startup and region/mismatch callback
        if self._bottom_bar is not None:
            self._bottom_bar.set_region_changed_callback(self._submit_path_scan_if_throttle_ok)

        # ttk styles: single source from UITheme.apply_to_root (no second configure here; see docs/ui2)

        # ROSBOT running state
        self.rosbot_running = False

        # D3 extension thread (set after UI is ready; commands sent via put_command)
        self._d3_extension_thread: Optional[D3ExtensionThread] = None

        # Get game state instance
        self.game_state = get_game_interface_data()

        # Status UI callback and refresh fn are registered by controller (timer and UI are sibling modules; no cross-import)
        self._refresh_status_fn: Optional[Callable[[], None]] = None
        self._register_status_ui_fn: Optional[Callable[[], None]] = None

        # Create main container - tab main style (UnifiedStyles.TAB_PAD, same as other tab panels)
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        parent.grid_rowconfigure(0, weight=1)
        parent.grid_columnconfigure(0, weight=1)
        tab_pad = UnifiedStyles.TAB_PAD
        self.container.grid(row=0, column=0, sticky="nsew", padx=tab_pad, pady=tab_pad)

        # Configure grid - row 0: config/control (no vertical stretch), row 1: log (expand, min height for log area)
        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_columnconfigure(1, weight=1)
        self.container.grid_rowconfigure(0, weight=0)
        self.container.grid_rowconfigure(1, weight=1, minsize=160)

        # Lazy content: create on first tab select to avoid blocking startup with many get_config_value_safe
        self._content_created = False
        self._path_scan_btn = None
        self.ensure_battlenet_btn = None
        self.control_btn = None
        self._login_check_generation = 0
        self._last_control_button_state = None

        # ColorPrint and status UI callbacks registered when content is created (code-level guarantee)

        # Note: Language change is handled by main UI, not individual panels

    def _debug_messagebox(self, title, message, icon="info"):
        """All output via ColorPrint only (no popup)."""
        ColorPrint.debug_messagebox(title, message, icon)

    def ensure_content(self):
        """Create panel content on first call (lazy). Prefer timer thread for config read (THREAD_BUS §5); if timer not started, use main-thread fallback (docs/ui_5 plan B)."""
        if self._content_created:
            return
        if timer_manager.is_running():
            timer_manager.submit_one_shot(lambda: _fetch_rosbot_config_then_create(self))
        else:
            self.container.after(0, lambda: _fetch_rosbot_config_on_main_then_create(self))

    def ensure_content_sync(self) -> None:
        """Build panel content synchronously on main thread (for first show when tab is ROSBOT; docs/ui2 UI_REPEATED_PAINT)."""
        if self._content_created:
            return
        _fetch_rosbot_config_on_main_then_create(self)

    def _create_content_with_snapshot(self, snapshot: dict) -> None:
        """Build panel widgets on main thread using pre-fetched config snapshot. Single-frame build so first paint shows full content (docs/ui2 UI_REPEATED_PAINT)."""
        self._content_created = True
        self._create_config_panel(snapshot)
        self._create_control_and_log_then_sync()

    def _create_control_and_log_then_sync(self) -> None:
        """Second chunk: control panel + log row, then sync status. Runs on main thread after yield."""
        self._create_control_panel()
        self._create_log_display_row()
        scan_container = self._bottom_bar.get_row3_scan_container() if self._bottom_bar else None
        if scan_container is not None:
            self._path_scan_btn = tk.Button(
                scan_container,
                text=i18n_manager.get_ui_text("rosbot.scan_one_click"),
                width=8,
                bg=UnifiedStyles.COLORS['bg_primary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                font=UnifiedStyles.FONTS['button'],
                command=self._run_one_click_scan,
            )
            self._path_scan_btn.pack(side=tk.LEFT, padx=(8, 0))
        else:
            self._path_scan_btn = None
        ColorPrint.register_callback(self.add_log_message)
        if self._register_status_ui_fn:
            self._register_status_ui_fn()
        self.container.after(100, self._sync_status_ui_once)

    def _create_config_panel(self, snapshot: dict):
        """Create ROSBOT configuration panel (no top label to save space). Uses snapshot to avoid main-thread config read."""
        config_frame = ttk.Frame(self.container)
        config_frame.grid(row=0, column=0, sticky="new",
                         padx=(0, UnifiedStyles.SPACING['sm']),
                         pady=UnifiedStyles.SPACING['xs'])

        # Configure grid
        config_frame.grid_columnconfigure(1, weight=1)

        # ROSBOT path configuration
        self._create_path_section(config_frame, snapshot)
        # Bot settings
        self._create_bot_settings(config_frame, snapshot)

    def _create_path_section(self, parent, snapshot: dict):
        """Path area: empty (BN/D3/D4/ROS + scan moved to bottom bar row 3 right)."""
        path_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        path_frame.grid(row=0, column=0, columnspan=2, sticky="ew",
                       padx=UnifiedStyles.SPACING['sm'],
                       pady=UnifiedStyles.SPACING['xs'])
        path_frame.grid_columnconfigure(0, weight=1)

        self._scan_status = [None]
        self._scan_in_progress = False
        self._scan_progress_after_id = None
        self._scan_progress_label = None

    def startup_path_scan_needed(self) -> bool:
        """True when at least one of BN/D3/ROSBOT is missing or invalid; then startup should run one path scan. Once all valid, next restart skips scan."""
        return not are_paths_valid_for_skip_scan()

    def _submit_path_scan_if_throttle_ok(self) -> None:
        """Called on region change, version mismatch, or startup (when startup_path_scan_needed); force full scan to discover all Asia/CN dirs for BN match; at most once per 5s."""
        now = time.time()
        if now - self._path_scan_submit_time < 5.0:
            return
        self._path_scan_submit_time = now
        timer_manager.submit_one_shot(lambda: do_path_scan(self, include_rosbot=True, force_scan_rosbot=True))

    def _run_one_click_scan(self):
        """Run path scan in background thread; scan button lives in bottom bar row 3."""
        self._scan_in_progress = True
        self._scan_status[0] = None
        if self._path_scan_btn is not None:
            self._path_scan_btn.config(state=tk.DISABLED, text=i18n_manager.get_ui_text("rosbot.scan_searching"))
        self._scan_progress_tick()
        timer_manager.submit_one_shot(lambda: do_path_scan(self, include_rosbot=True, force_scan_rosbot=True))

    def _scan_progress_tick(self) -> None:
        """Re-schedule until scan done; no progress label (moved to bottom bar)."""
        if not self._scan_in_progress:
            return
        self._scan_progress_after_id = self.container.after(200, self._scan_progress_tick)

    def _apply_scan_results(self, battlenet_path, rosbot_dirs, d3_path=None, error_msg=None):
        """Apply scan results: set config only when current path is missing or invalid (ROSBOT / Battle.net / D3). Multiple ROSBOT: prefer update-convention order; show choice dialog."""
        self._scan_in_progress = False
        if self._scan_progress_after_id is not None:
            self.container.after_cancel(self._scan_progress_after_id)
        self._scan_progress_after_id = None
        if self._path_scan_btn is not None:
            self._path_scan_btn.config(state=tk.NORMAL, text=i18n_manager.get_ui_text("rosbot.scan_one_click"))
        if self._bottom_bar is not None:
            self._bottom_bar.refresh_path_icons()
        if error_msg:
            messagebox.showerror(i18n_manager.get_ui_text("rosbot.error"), error_msg)
            return
        cur_bn = (get_config_value_safe("battlenet.battlenet_path") or "").strip()
        cur_d3 = (get_config_value_safe("d3.d3_path") or "").strip()
        cur_ros = (get_config_value_safe("ros_settings.ros_directory") or "").strip()
        bn_valid = cur_bn and os.path.isfile(cur_bn) and os.path.basename(cur_bn) == BATTLE_NET_EXE_NAME
        d3_valid = cur_d3 and os.path.isfile(cur_d3) and os.path.basename(cur_d3) == DIABLO_III_EXE_NAME
        ros_valid = cur_ros and os.path.isdir(cur_ros)
        if battlenet_path and not bn_valid:
            ConfigBinding.set_config_value("battlenet.battlenet_path", battlenet_path)
        if d3_path and not d3_valid:
            ConfigBinding.set_config_value("d3.d3_path", d3_path)
        if rosbot_dirs:
            region = get_game_interface_data().get_battlenet_region()
            chosen = pick_best_rosbot_dir_by_region(rosbot_dirs, region)
            # Do not overwrite when current config already matches BN region and chosen from scan does not (e.g. just updated to CN, scan only returned Asia)
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
                ConfigBinding.set_config_value("ros_settings.ros_directory", chosen)
        if not battlenet_path and not rosbot_dirs and not d3_path:
            msg = []
            if not battlenet_path:
                msg.append(i18n_manager.get_ui_text("rosbot.scan_not_found_battlenet"))
            if not d3_path:
                msg.append(i18n_manager.get_ui_text("rosbot.scan_not_found_d3"))
            if not rosbot_dirs:
                msg.append(i18n_manager.get_ui_text("rosbot.scan_not_found_rosbot"))
            messagebox.showinfo(i18n_manager.get_ui_text("rosbot.scan_done"), "\n".join(msg))
        if self._bottom_bar is not None:
            self._bottom_bar.refresh_path_icons()

    def _ask_choose_rosbot_directory(self, dirs):
        """Show dialog to choose one ROSBOT directory from list. Returns chosen path or None."""
        top = tk.Toplevel(self.container)
        top.title(i18n_manager.get_ui_text("rosbot.scan_choose_one"))
        top.transient(self.container)
        top.grab_set()
        result = [None]
        lb = tk.Listbox(top, height=min(10, len(dirs)), width=70,
                        bg=UnifiedStyles.COLORS.get('input_bg', '#2d2d2d'),
                        fg=UnifiedStyles.COLORS.get('text_primary', '#e0e0e0'))
        lb.pack(padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['sm'], fill=tk.BOTH, expand=True)
        for d in dirs:
            lb.insert(tk.END, d)
        lb.selection_set(0)

        def on_ok():
            sel = lb.curselection()
            if sel:
                result[0] = dirs[sel[0]]
            top.destroy()

        def on_cancel():
            top.destroy()

        btn_frame = tk.Frame(top, bg=UnifiedStyles.COLORS.get('bg_secondary', '#252525'))
        btn_frame.pack(pady=(0, UnifiedStyles.SPACING['sm']))
        tk.Button(btn_frame, text="OK", command=on_ok,
                  bg=UnifiedStyles.COLORS.get('btn_secondary', '#404040'),
                  fg=UnifiedStyles.COLORS.get('text_primary', '#e0e0e0')).pack(side=tk.LEFT, padx=UnifiedStyles.SPACING['xs'])
        tk.Button(btn_frame, text=i18n_manager.get_ui_text("rosbot.cancel"), command=on_cancel,
                  bg=UnifiedStyles.COLORS.get('btn_secondary', '#404040'),
                  fg=UnifiedStyles.COLORS.get('text_primary', '#e0e0e0')).pack(side=tk.LEFT, padx=UnifiedStyles.SPACING['xs'])
        top.wait_window()
        return result[0]

    def _create_bot_settings(self, parent, snapshot: dict):
        """Create bot settings section. Uses snapshot to avoid main-thread config read."""
        settings_frame = tk.LabelFrame(parent, text=i18n_manager.get_ui_text("rosbot.bot_settings"),
                                      bg=UnifiedStyles.COLORS['bg_secondary'],
                                      fg=UnifiedStyles.COLORS['text_primary'],
                                      font=UnifiedStyles.FONTS['subheading'])
        settings_frame.grid(row=1, column=0, columnspan=2, sticky="ew",
                           padx=UnifiedStyles.SPACING['sm'],
                           pady=UnifiedStyles.SPACING['xs'])
        pad = UnifiedStyles.SPACING['sm']
        # 3 columns, equal width
        for c in range(3):
            settings_frame.grid_columnconfigure(c, weight=1, uniform="bot_col")
        for r in range(3):
            settings_frame.grid_rowconfigure(r, weight=0)

        def cell_frame(row: int, col: int) -> tk.Frame:
            f = tk.Frame(settings_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
            f.grid(row=row, column=col, sticky="ew", padx=pad, pady=UnifiedStyles.SPACING['xs'])
            return f

        def add_check(cell: tk.Frame, i18n_key: str, config_key: str, default: bool):
            val = snapshot.get(config_key, default)
            ConfigBinding.create_checkbox_binding_with_initial(
                cell, config_key, val,
                text=i18n_manager.get_ui_text(i18n_key), default_value=default,
                bg=UnifiedStyles.COLORS['bg_secondary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
                activebackground=UnifiedStyles.COLORS['bg_secondary'],
                activeforeground=UnifiedStyles.COLORS['text_primary']
            ).pack(side=tk.LEFT)

        # Row 0: auto latest ROS | blue portal priority | firstborn blue gate reuse
        add_check(cell_frame(0, 0), "rosbot.auto_enable_latest_ros", "ros_settings.auto_enable_latest_ros", True)
        add_check(cell_frame(0, 1), "rosbot.blue_portal_priority", "rosbot.blue_portal_priority", False)
        add_check(cell_frame(0, 2), "rosbot.firstborn_blue_gate_reuse", "rosbot.firstborn_blue_gate_reuse", False)

        # Row 1: pickup blood shards | smart echo + wait N s | test mode + timeout minutes
        add_check(cell_frame(1, 0), "rosbot.pickup_blood_shards", "rosbot.pickup_blood_shards", False)
        c1 = cell_frame(1, 1)
        add_check(c1, "rosbot.smart_echo", "rosbot.smart_echo", False)
        wait_val = snapshot.get("rosbot.smart_echo_wait_seconds", 15)
        ConfigBinding.create_spinbox_binding_with_initial(
            c1, "rosbot.smart_echo_wait_seconds", wait_val,
            from_=1, to=120, increment=1, default_value=15, width=3,
            bg=UnifiedStyles.COLORS['bg_tertiary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            buttonbackground=UnifiedStyles.COLORS['bg_tertiary']
        ).pack(side=tk.LEFT, padx=(pad, 0))
        tk.Label(c1, text=i18n_manager.get_ui_text("rosbot.seconds"),
                 bg=UnifiedStyles.COLORS['bg_secondary'],
                 fg=UnifiedStyles.COLORS['text_primary']).pack(side=tk.LEFT)
        c1_2 = cell_frame(1, 2)
        add_check(c1_2, "rosbot.test_mode", "rosbot.test_mode", False)
        test_minutes_val = snapshot.get("rosbot.test_timeout_minutes", 30)
        sb = ConfigBinding.create_spinbox_binding_with_initial(
            c1_2, "rosbot.test_timeout_minutes", test_minutes_val,
            from_=1, to=120, increment=1, default_value=30, width=4,
            bg=UnifiedStyles.COLORS['bg_tertiary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            buttonbackground=UnifiedStyles.COLORS['bg_tertiary']
        )
        sb.pack(side=tk.LEFT, padx=(UnifiedStyles.SPACING['xs'], 0))
        tk.Label(c1_2, text=i18n_manager.get_ui_text("rosbot.minutes"),
                 bg=UnifiedStyles.COLORS['bg_secondary'],
                 fg=UnifiedStyles.COLORS['text_primary']).pack(side=tk.LEFT)

        # Row 2: prevent stuck | startup | timeout restart + minutes
        add_check(cell_frame(2, 0), "rosbot.prevent_stuck", "rosbot.prevent_stuck", False)
        add_check(cell_frame(2, 1), "rosbot.startup", "rosbot.startup", False)
        c2 = cell_frame(2, 2)
        timeout_val = snapshot.get("battlenet.timeout_restart", True)
        ConfigBinding.create_checkbox_binding_with_initial(
            c2, "battlenet.timeout_restart", timeout_val,
            text=i18n_manager.get_ui_text("rosbot.timeout_restart"),
            default_value=True,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
            activebackground=UnifiedStyles.COLORS['bg_secondary'],
            activeforeground=UnifiedStyles.COLORS['text_primary']
        ).pack(side=tk.LEFT)
        minutes_val = snapshot.get("rosbot.timeout_minutes", 8)
        ConfigBinding.create_spinbox_binding_with_initial(
            c2, "rosbot.timeout_minutes", minutes_val,
            from_=1, to=120, increment=1, default_value=8, width=4,
            bg=UnifiedStyles.COLORS['bg_tertiary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            buttonbackground=UnifiedStyles.COLORS['bg_tertiary']
        ).pack(side=tk.LEFT, padx=(UnifiedStyles.SPACING['xs'], 0))
        tk.Label(c2, text=i18n_manager.get_ui_text("rosbot.minutes"),
                 bg=UnifiedStyles.COLORS['bg_secondary'],
                 fg=UnifiedStyles.COLORS['text_primary']).pack(side=tk.LEFT)

    def _create_control_panel(self):
        """Create ROSBOT control and status panel"""
        control_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("rosbot.control_panel"), style='TLabelframe')
        control_frame.grid(row=0, column=1, sticky="new",
                          padx=(UnifiedStyles.SPACING['sm'], 0),
                          pady=UnifiedStyles.SPACING['xs'])

        # Configure grid: row 0 = main buttons, row 1 = DEBUG buttons
        control_frame.grid_columnconfigure(0, weight=1)
        control_frame.grid_rowconfigure(0, weight=0)
        control_frame.grid_rowconfigure(1, weight=0)

        # Control buttons (status display merged into bottom bar Game Status row)
        self._create_control_buttons(control_frame)

    def _create_control_buttons(self, parent):
        """Create control buttons with toggle functionality (same as ensure Battle.net: click toggles, button state updates on click)."""
        button_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        button_frame.grid(row=0, column=0, sticky="ew",
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['sm'])
        button_frame.grid_columnconfigure(0, weight=1)

        # Start ROSBOT: toggle button; click toggles run state, button text/color updated immediately (start -> Stop, stop -> Start)
        self.control_btn = tk.Button(button_frame, text=i18n_manager.get_ui_text("rosbot.start_rosbot"),
                                    bg=UnifiedStyles.COLORS['btn_success'],
                                    fg=UnifiedStyles.COLORS['text_primary'],
                                    font=UnifiedStyles.FONTS['button'],
                                    command=self._toggle_rosbot)
        self.control_btn.grid(row=0, column=0, sticky="ew", 
                             padx=UnifiedStyles.SPACING['xs'])

        # Ensure Battle.net only: same logic as start ROSBOT but only BN segment; re-login on exit/disconnect
        self.ensure_battlenet_btn = tk.Button(button_frame,
                                             text=i18n_manager.get_ui_text("rosbot.ensure_battlenet_only"),
                                             bg=UnifiedStyles.COLORS['bg_primary'],
                                             fg=UnifiedStyles.COLORS['text_primary'],
                                             font=UnifiedStyles.FONTS['button'],
                                             command=self._ensure_battlenet_only)
        self.ensure_battlenet_btn.grid(row=1, column=0, sticky="ew",
                                       padx=UnifiedStyles.SPACING['xs'],
                                       pady=(UnifiedStyles.SPACING['xs'], 0))

        self.update_rosbot_btn = tk.Button(button_frame,
                                           text=i18n_manager.get_ui_text("rosbot.update_rosbot"),
                                           bg=UnifiedStyles.COLORS['bg_primary'],
                                           fg=UnifiedStyles.COLORS['text_primary'],
                                           font=UnifiedStyles.FONTS['button'],
                                           command=self._update_rosbot)
        self.update_rosbot_btn.grid(row=2, column=0, sticky="ew",
                                   padx=UnifiedStyles.SPACING['xs'],
                                   pady=(UnifiedStyles.SPACING['xs'], 0))

        # Open Tampermonkey script in Notepad for easy copy
        self.open_tampermonkey_script_btn = tk.Button(button_frame,
                                                      text=i18n_manager.get_ui_text("rosbot.open_tampermonkey_script"),
                                                      bg=UnifiedStyles.COLORS['bg_primary'],
                                                      fg=UnifiedStyles.COLORS['text_primary'],
                                                      font=UnifiedStyles.FONTS['button'],
                                                      command=self._open_tampermonkey_script)
        self.open_tampermonkey_script_btn.grid(row=3, column=0, sticky="ew",
                                              padx=UnifiedStyles.SPACING['xs'],
                                              pady=(UnifiedStyles.SPACING['xs'], 0))

        # Set account/password: opens dialog with Asia/CN region dropdown and account/password per region (same style as ensure Battle.net / update / Tampermonkey)
        self.set_account_password_btn = tk.Button(button_frame,
                                                 text=i18n_manager.get_ui_text("rosbot.set_account_password"),
                                                 bg=UnifiedStyles.COLORS['bg_primary'],
                                                 fg=UnifiedStyles.COLORS['text_primary'],
                                                 font=UnifiedStyles.FONTS['button'],
                                                 command=self._open_set_account_password)
        self.set_account_password_btn.grid(row=4, column=0, sticky="ew",
                                          padx=UnifiedStyles.SPACING['xs'],
                                          pady=(UnifiedStyles.SPACING['xs'], 0))

        # Sync toggle from flow state (flow library owns state)
        self.rosbot_running = self.game_state.rosbot_flow_master_enabled
        self._update_control_button()
        self._update_ensure_battlenet_button()

    def _create_log_display_row(self):
        """Create log display in row 1. Header: one-click scan (left) + scan progress + log title (right) + status + latency + checkbox. Then log text + scrollbar."""
        self._last_log_time: Optional[float] = None
        self._last_latency_sec: Optional[float] = None

        log_frame = tk.Frame(self.container, bg=UnifiedStyles.COLORS['bg_primary'])
        log_frame.grid(row=1, column=0, columnspan=2, sticky="nsew",
                      padx=0,
                      pady=UnifiedStyles.SPACING['xs'])
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_columnconfigure(1, weight=0)
        log_frame.grid_rowconfigure(0, weight=0)
        log_frame.grid_rowconfigure(1, weight=1)

        # Header row: [log title] [scan progress] [status] [latency] [checkbox] [open log button]
        header = tk.Frame(log_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        header.grid(row=0, column=0, columnspan=2, sticky="ew", padx=UnifiedStyles.SPACING['sm'], pady=(UnifiedStyles.SPACING['xs'], 0))
        header.grid_columnconfigure(0, weight=1)
        header.grid_columnconfigure(1, weight=1)
        for c in (2, 3, 4, 5):
            header.grid_columnconfigure(c, weight=0)

        title_lbl = tk.Label(header, text=i18n_manager.get_ui_text("rosbot.rosbot_log"),
                            bg=UnifiedStyles.COLORS['bg_secondary'],
                            fg=UnifiedStyles.COLORS['text_primary'],
                            font=UnifiedStyles.FONTS['label'])
        title_lbl.grid(row=0, column=0, sticky="w", padx=(0, UnifiedStyles.SPACING['sm']))

        self._scan_progress_label = tk.Label(header, text="",
                                            bg=UnifiedStyles.COLORS['bg_secondary'],
                                            fg=UnifiedStyles.COLORS['text_muted'],
                                            font=UnifiedStyles.FONTS['small'])
        self._scan_progress_label.grid(row=0, column=1, sticky="w", padx=(0, UnifiedStyles.SPACING['sm']))

        self._rosbot_log_status_var = tk.StringVar(value="")
        self._rosbot_log_status_lbl = tk.Label(header, textvariable=self._rosbot_log_status_var,
                                              bg=UnifiedStyles.COLORS['bg_secondary'],
                                              fg=UnifiedStyles.COLORS['text_primary'],
                                              font=UnifiedStyles.FONTS['code'])
        self._rosbot_log_status_lbl.grid(row=0, column=2, sticky="w")

        self._rosbot_log_latency_var = tk.StringVar(value="")
        self._rosbot_log_latency_lbl = tk.Label(header, textvariable=self._rosbot_log_latency_var,
                                               bg=UnifiedStyles.COLORS['bg_secondary'],
                                               fg=UnifiedStyles.COLORS['text_primary'],
                                               font=UnifiedStyles.FONTS['code'])
        self._rosbot_log_latency_lbl.grid(row=0, column=3, sticky="e", padx=UnifiedStyles.SPACING['sm'])

        debug_latency_check = ConfigBinding.create_checkbox_binding(
            header, "log_settings.debug_log_latency",
            text=i18n_manager.get_ui_text("log_panel.debug_log_latency"), default_value=False,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
            activebackground=UnifiedStyles.COLORS['bg_secondary'],
            activeforeground=UnifiedStyles.COLORS['text_primary']
        )
        debug_latency_check.grid(row=0, column=4, sticky="e")
        debug_latency_check.bind("<ButtonRelease-1>", lambda e: self._update_rosbot_log_status_display())

        open_log_btn = tk.Button(header, text=i18n_manager.get_ui_text("rosbot.open_log_file"),
                                bg=UnifiedStyles.COLORS['bg_primary'],
                                fg=UnifiedStyles.COLORS['text_primary'],
                                font=UnifiedStyles.FONTS['button'],
                                command=self._open_rosbot_log_file)
        open_log_btn.grid(row=0, column=5, sticky="e", padx=(UnifiedStyles.SPACING['sm'], 0))

        # Log text widget
        self.log_text = tk.Text(log_frame,
                               bg=UnifiedStyles.COLORS['bg_primary'],
                               fg=UnifiedStyles.COLORS['text_primary'],
                               font=UnifiedStyles.FONTS['code'],
                               wrap=tk.WORD,
                               state=tk.DISABLED)
        scrollbar = tk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scrollbar.set)
        self.log_text.grid(row=1, column=0, sticky="nsew",
                          padx=(UnifiedStyles.SPACING['sm'], 0),
                          pady=UnifiedStyles.SPACING['sm'])
        scrollbar.grid(row=1, column=1, sticky="nsew",
                      padx=(0, UnifiedStyles.SPACING['sm']),
                      pady=UnifiedStyles.SPACING['sm'])

        self.log_text.bind("<Button-3>", self._show_rosbot_log_context_menu)
        self._schedule_rosbot_log_status_tick()

    def _update_rosbot_log_status_display(self) -> None:
        """Update last-log-ago and latency label (latency only when debug_log_latency is on). Only called from tick scheduled after content created.
        Syncs with log_monitor.get_last_log_modified_time() to ensure UI updates match actual log file changes."""
        # Get the most recent log time from both sources: UI callback (_last_log_time) and log_monitor (file mtime)
        log_mtime = get_last_log_modified_time()
        ui_log_time = self._last_log_time
        
        # Use the most recent time: if log_monitor has a valid mtime, prefer it; otherwise use UI callback time
        if log_mtime > 0:
            if ui_log_time is None or log_mtime > ui_log_time:
                # log_monitor has newer or only valid time
                last_log_time = log_mtime
            else:
                # UI callback has newer time (shouldn't happen often, but possible if callback fires after file write)
                last_log_time = ui_log_time
        elif ui_log_time is not None:
            # Only UI callback time available
            last_log_time = ui_log_time
        else:
            # No log time available
            self._rosbot_log_status_var.set("")
            self._rosbot_log_latency_var.set("")
            return
        
        elapsed = time.time() - last_log_time
        if elapsed < 60:
            ago_val = "{:.1f}s".format(elapsed)
            status_text = (i18n_manager.get_ui_text("rosbot.log_last_ago", default="Last: {0} ago") or "Last: {0} ago").format(ago_val)
        else:
            ago_val = "{:.0f}min".format(elapsed / 60)
            status_text = (i18n_manager.get_ui_text("rosbot.log_last_ago_min", default="Last: {0} ago") or "Last: {0} ago").format(ago_val)
        self._rosbot_log_status_var.set(status_text)
        show_latency = bool(ConfigBinding.get_config_value("log_settings.debug_log_latency", False))
        if show_latency and self._last_latency_sec is not None:
            lat_val = "{:.1f}".format(self._last_latency_sec)
            self._rosbot_log_latency_var.set((i18n_manager.get_ui_text("rosbot.log_latency", default="latency +{0}s") or "latency +{0}s").format(lat_val))
            self._rosbot_log_latency_lbl.grid()
        else:
            self._rosbot_log_latency_var.set("")
            self._rosbot_log_latency_lbl.grid_remove()

    def _schedule_rosbot_log_status_tick(self) -> None:
        """Tick every 1s to update last-log-ago label. Only scheduled after content created."""
        self._update_rosbot_log_status_display()
        self.container.after(1000, self._schedule_rosbot_log_status_tick)

    def _show_rosbot_log_context_menu(self, event):
        """Show right-click context menu for ROSBOT log area (Copy). Bound to log_text after content created."""
        menu = tk.Menu(self.log_text, tearoff=0)
        menu.add_command(label=i18n_manager.get_ui_text("rosbot.copy"), command=self._copy_rosbot_log_to_clipboard)
        menu.tk_popup(event.x_root, event.y_root)
        menu.grab_release()

    def _copy_rosbot_log_to_clipboard(self):
        """Copy ROSBOT log content to clipboard (selection if any, else all). Only called from context menu after content created."""
        if self.log_text.tag_ranges(tk.SEL):
            text = self.log_text.get(tk.SEL_FIRST, tk.SEL_LAST)
        else:
            text = self.log_text.get("1.0", tk.END)
        if text.strip():
            self.container.clipboard_clear()
            self.container.clipboard_append(text)

    def add_log_message(self, message, level="INFO", color=None):
        """ColorPrint callback for ROSBOT log. Only registered after content created (code-level)."""
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
        def _append():
            self.log_text.configure(state=tk.NORMAL)
            text = _strip_ui_log_prefix(message)
            self.log_text.insert(tk.END, f"{text}\n")
            self.log_text.see(tk.END)
            self.log_text.configure(state=tk.DISABLED)
        self.container.after(0, _append)

    def _browse_rosbot_path(self):
        """Browse for ROSBOT executable; when current value exists, open that directory."""
        current = (ConfigBinding.get_config_value("ros_settings.ros_directory") or "").strip()
        initialdir = None
        if current and os.path.exists(current):
            initialdir = current if os.path.isdir(current) else os.path.dirname(current)
        filetypes = [(i18n_manager.get_ui_text("rosbot.executable_files"), "*.exe"), (i18n_manager.get_ui_text("rosbot.all_files"), "*.*")]
        kwargs = {"title": i18n_manager.get_ui_text("rosbot.select_rosbot_executable"), "filetypes": filetypes}
        if initialdir:
            kwargs["initialdir"] = initialdir
        filename = filedialog.askopenfilename(**kwargs)
        if filename:
            ConfigBinding.set_config_value("ros_settings.ros_directory", filename)
            self._refresh_path_icons()

    def _browse_battlenet_path(self):
        """Browse for Battle.net executable; when current value exists, open that directory."""
        current = (ConfigBinding.get_config_value("battlenet.battlenet_path") or "").strip()
        initialdir = os.path.dirname(current) if current and os.path.exists(current) else None
        filetypes = [(i18n_manager.get_ui_text("rosbot.executable_files"), "*.exe"), (i18n_manager.get_ui_text("rosbot.all_files"), "*.*")]
        kwargs = {"title": i18n_manager.get_ui_text("rosbot.select_battlenet_executable"), "filetypes": filetypes}
        if initialdir:
            kwargs["initialdir"] = initialdir
        filename = filedialog.askopenfilename(**kwargs)
        if filename:
            ConfigBinding.set_config_value("battlenet.battlenet_path", filename)
            self._refresh_path_icons()

    def _browse_d3_path(self):
        """Browse for Diablo III executable; when current value exists, open that directory."""
        current = (ConfigBinding.get_config_value("d3.d3_path") or "").strip()
        initialdir = os.path.dirname(current) if current and os.path.exists(current) else None
        filetypes = [(i18n_manager.get_ui_text("rosbot.executable_files"), "*.exe"), (i18n_manager.get_ui_text("rosbot.all_files"), "*.*")]
        kwargs = {"title": i18n_manager.get_ui_text("rosbot.select_d3_executable"), "filetypes": filetypes}
        if initialdir:
            kwargs["initialdir"] = initialdir
        filename = filedialog.askopenfilename(**kwargs)
        if filename:
            ConfigBinding.set_config_value("d3.d3_path", filename)
            self._refresh_path_icons()

    def _toggle_rosbot(self):
        """Toggle ROSBOT start/stop (same as ensure Battle.net: click toggles state; button state updated immediately)."""
        if self.rosbot_running:
            self._stop_rosbot()
        else:
            self._start_rosbot()

    def set_d3_extension_thread(self, thread: Optional[D3ExtensionThread]) -> None:
        """Set the D3 extension thread (called after UI is ready). Commands sent via put_command."""
        self._d3_extension_thread = thread

    def _ensure_battlenet_only(self):
        """Toggle ensure Battle.net only: flow state so tick runs BN segment only (no D3/ROSBOT); after confirm, poll each tick and re-login if disconnected (ROSBOT_FLOW_MERMAID B)."""
        next_enabled = not self.game_state.ensure_battlenet_only_master_enabled
        set_bn_only_enabled(next_enabled)
        if next_enabled:
            self._request_status_refresh()
            get_task_manager().set_task_status("rosbot_task", TaskStatus.ENABLED)
        else:
            reset_flow_master_bn_block()
        self._update_ensure_battlenet_button()

    def _update_ensure_battlenet_button(self):
        """Update ensure-Battle.net button text. Only called after content created (code-level)."""
        on = self.game_state.ensure_battlenet_only_master_enabled
        key = "rosbot.ensure_battlenet_only_on" if on else "rosbot.ensure_battlenet_only"
        self.ensure_battlenet_btn.config(text=i18n_manager.get_ui_text(key))

    def _start_rosbot(self):
        """Start ROSBOT: only set flow master + enable task; tick drives flow library, flow library calls extension thread (which calls third-party). Do not submit one-shot here (FLOW_STATE_ARCHITECTURE)."""
        if self.rosbot_running:
            return
        set_flow_master_enabled(True)
        get_task_manager().set_task_status("rosbot_task", TaskStatus.ENABLED)
        self.rosbot_running = True
        self._update_control_button()
        self._request_status_refresh()

    def _control_btn_set_busy(self, busy):
        """Set control button to busy (disabled) or normal. Only called after content created (code-level)."""
        if busy:
            self.control_btn.config(state=tk.DISABLED)
        else:
            self.control_btn.config(state=tk.NORMAL)

    def get_status_ui_callback(self):
        """Return callback for status UI (controller registers it with window_monitor)."""
        return self._on_game_state_changed

    def set_refresh_status_fn(self, fn: Callable[[], None]):
        """Set the refresh-status callable (controller injects window_monitor.refresh_window_status_if_inactive)."""
        self._refresh_status_fn = fn

    def set_register_status_ui_fn(self, fn: Callable[[], None]):
        """Set callable to register status UI callback with window_monitor. Called once when content is created (code-level)."""
        self._register_status_ui_fn = fn

    def _open_set_account_password(self):
        """Open Battle.net account/password dialog (Asia/CN region dropdown, account/password per region)."""
        schedule_battlenet_credentials_dialog()

    def _refresh_status_now(self):
        """Manual refresh: same as initial check (BN + D3 + ROSBOT), runs in timer thread via one-shot. One log when done."""
        self._request_status_refresh()

    def _request_status_refresh(self):
        """Submit one-shot full refresh (BN + D3 + ROS + notify). Same logic as do_window_monitor_initial_check. Used after flow/ensure_bn toggle or manual refresh."""
        timer_manager.submit_one_shot(do_window_monitor_initial_check)

    def _debug_battlenet_ui_json(self):
        """Export Battle.net UI to JSON via UI Automation (Chrome/Chromium accessibility tree). CoInitialize in worker thread then call WindowAnalyzer."""
        timer_manager.submit_one_shot(lambda: do_battlenet_ui_analyze(self))

    def _debug_rosbot(self):
        """Debug ROSBOT: if paused run window analysis; if running send F7 to pause."""
        timer_manager.submit_one_shot(lambda: do_rosbot_debug(self))

    def _update_rosbot(self):
        """Update ROSBOT: E1 kill -> E2 wait 1s -> E3-E5a start and automate -> E6 wrap-up (ROSBOT_FLOW_MERMAID E block)."""
        timer_manager.submit_one_shot(lambda: do_rosbot_update(self))

    def _open_rosbot_log_file(self):
        """Open ROSBOT log file (logs.txt) with Notepad."""
        if not open_file_with_notepad(LOGS_FILE_PATH):
            messagebox.showwarning(
                i18n_manager.get_ui_text("rosbot.warning"),
                (i18n_manager.get_ui_text("rosbot.log_file_not_found") or "File not found or could not open.") + "\n" + str(LOGS_FILE_PATH),
            )

    def _open_tampermonkey_script(self):
        """Open Tampermonkey script file in Notepad for easy copy."""
        if not open_file_with_notepad(TAMPERMONKEY_SCRIPT_PATH):
            messagebox.showwarning(
                i18n_manager.get_ui_text("rosbot.warning"),
                (i18n_manager.get_ui_text("rosbot.log_file_not_found") or "File not found or could not open.") + "\n" + str(TAMPERMONKEY_SCRIPT_PATH),
            )

    def get_login_check_callable(self):
        """Return a callable that runs login check and returns (result: bool, error: Optional[Exception]). Only used by flow via extension thread (battlenet_login_check_provider)."""
        def _run():
            result = get_login_try_screenshot_controller().ensure_battlenet_started_and_login_check(for_f2_only=True)
            return (result, None)
        return _run

    def _on_login_check_done(self, success, error=None, ran_e_block=False, generation=None):
        """Main-thread cleanup: on success keep running and enable rosbot_task (ROSBOT_FLOW_MERMAID). ran_e_block=True: E1-E6 already ran in extension thread, do not call start_rosbot_task. When generation is not None, only accept callback matching current generation."""
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
        """Main-thread cleanup: clear flow master so timer skips all branches; reset button (ROSBOT_FLOW.md)."""
        self._control_btn_set_busy(False)
        set_flow_master_enabled(False)
        reset_flow_master_bn_block()
        self.rosbot_running = False
        self._update_control_button()
        self._request_status_refresh()
        ColorPrint.yellow("[ROSBOT] Stopped monitoring")

    def _stop_rosbot(self):
        """Stop ROSBOT: clear flow master and ensure-Battle.net state; update button toggle immediately (same as ensure Battle.net)."""
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

    def _update_control_button(self):
        """Update control button from game_interface_data (flow writes, UI read-only). Keeps self.rosbot_running in sync for _toggle_rosbot. Shows need-key hint when get_ui_state().need_key_input."""
        self.rosbot_running = self.game_state.rosbot_flow_master_enabled
        state_str = "STOP (red)" if self.rosbot_running else "START (green)"
        if self._last_control_button_state != state_str:
            self._last_control_button_state = state_str
            ColorPrint.debug(f"[RosbotPanel] Control button: {state_str}")
        if self.rosbot_running:
            self.control_btn.config(
                text=i18n_manager.get_ui_text("rosbot.stop_rosbot"),
                bg=UnifiedStyles.COLORS['btn_danger']
            )
        else:
            self.control_btn.config(
                text=i18n_manager.get_ui_text("rosbot.start_rosbot"),
                bg=UnifiedStyles.COLORS['btn_success']
            )
        # need_key is shown in bottom bar status row, not here

    def _refresh_path_icons(self) -> None:
        """Refresh path-related UI: bottom bar BN/D3/ROS icons. Safe when content not yet created or bottom_bar missing."""
        if self._bottom_bar is not None:
            self._bottom_bar.refresh_path_icons()

    def _sync_status_ui_once(self):
        """Pull current game state and update status UI (main thread). Only called after content created (code-level)."""
        state = self.game_state.get_summary()
        self._update_ui_from_state(state)

    def _on_game_state_changed(self, state):
        """Invoked only on main thread by game_interface_data poll. Only when content created (code-level)."""
        self._update_ui_from_state(state)

    def _update_ui_from_state(self, state):
        """Push state to bottom bar, ensure-BN button, and Start/Stop button from game_interface_data (flow writes, UI read-only)."""
        self._bottom_bar.update_status_from_state(state)
        self._update_ensure_battlenet_button()
        self._update_control_button()
