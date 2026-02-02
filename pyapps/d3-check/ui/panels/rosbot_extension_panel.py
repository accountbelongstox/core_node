#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ROSBOT Extension Panel - Unified Style Version
Contains ROSBOT configuration and management features with unified styling
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import sys
import os
import threading
from typing import Optional, Callable

# Import unified styles
from ..unified_styles import UnifiedStyles

# Import from common_imports
from providor.common_imports import ColorPrint
from ..utils.tk_variables import var_str

# Import CONFIG from providor
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))
from providor.providor_index import CONFIG

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding

# Import game state and task thread manager (timer/UI are sibling modules; controller wires status UI and refresh fn)
from share.game_interface_data import get_game_interface_data
from share.thread_registry import get_thread_registry
from d3utils.task_thread_manager import get_task_manager, set_task_status, TaskStatus
import d3utils.rosbot_task_processor as rosbot_processor
from controller.login_try_screenshot_controller import get_login_try_screenshot_controller
from d3utils.d3_extension_thread import D3ExtensionThread, get_d3_extension_thread
from d3utils.event_center import trigger_extension_rosbot_start, trigger_extension_rosbot_stop
from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.shutdown_manager import is_shutdown_requested


class RosbotExtensionPanel:
    """ROSBOT Extension panel with unified styling"""

    def __init__(self, parent):
        """Initialize ROSBOT extension panel"""
        self.parent = parent

        # Configure TTK styles
        self.style = UnifiedStyles.configure_ttk_styles()

        # ROSBOT running state
        self.rosbot_running = False

        # D3 extension thread (set after UI is ready; commands sent via put_command)
        self._d3_extension_thread: Optional[D3ExtensionThread] = None

        # Get game state instance
        self.game_state = get_game_interface_data()

        # Status UI callback and refresh fn are registered by controller (timer and UI are sibling modules; no cross-import)
        self._refresh_status_fn: Optional[Callable[[], None]] = None

        # Create main container - use grid so tab frame gives full space (avoids overflow/hidden scrollbar)
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        parent.grid_rowconfigure(0, weight=1)
        parent.grid_columnconfigure(0, weight=1)
        self.container.grid(row=0, column=0, sticky="nsew",
                            padx=UnifiedStyles.SPACING['md'],
                            pady=UnifiedStyles.SPACING['md'])

        # Configure grid - row 0: config/control (no vertical stretch), row 1: log (expand, min height for log area)
        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_columnconfigure(1, weight=1)
        self.container.grid_rowconfigure(0, weight=0)
        self.container.grid_rowconfigure(1, weight=1, minsize=160)

        # Create content
        self.create_content()

        # Register as ColorPrint callback for rosbot-specific logs
        ColorPrint.register_callback(self.add_log_message)

        # Note: State callback already registered in __init__

        # Note: Language change is handled by main UI, not individual panels

    def _debug_messagebox(self, title, message, icon="info"):
        """All output via ColorPrint only (no popup)."""
        ColorPrint.debug_messagebox(title, message, icon)

    def create_content(self):
        """Create panel content"""
        # Row 1, Column 1 - Configuration panel
        self._create_config_panel()

        # Row 1, Column 2 - Control panel
        self._create_control_panel()

        # Row 2 - Log display (spans both columns)
        self._create_log_display_row()

        # One-time sync so status UI shows current state (avoids race: first callback may run before status widgets existed)
        self.container.after(0, self._sync_status_ui_once)

    def _create_config_panel(self):
        """Create ROSBOT configuration panel"""
        config_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("rosbot.configuration"), style='TLabelframe')
        config_frame.grid(row=0, column=0, sticky="new",
                         padx=(0, UnifiedStyles.SPACING['sm']),
                         pady=UnifiedStyles.SPACING['xs'])
        
        # Configure grid
        config_frame.grid_columnconfigure(1, weight=1)
        
        # ROSBOT path configuration
        self._create_path_section(config_frame)
        
        # Bot settings
        self._create_bot_settings(config_frame)

    def _create_path_section(self, parent):
        """Create ROSBOT path configuration section"""
        path_frame = tk.LabelFrame(parent, text=i18n_manager.get_ui_text("rosbot.path_configuration"),
                                  bg=UnifiedStyles.COLORS['bg_secondary'],
                                  fg=UnifiedStyles.COLORS['text_primary'],
                                  font=UnifiedStyles.FONTS['subheading'])
        path_frame.grid(row=0, column=0, columnspan=2, sticky="ew",
                       padx=UnifiedStyles.SPACING['sm'],
                       pady=UnifiedStyles.SPACING['sm'])
        path_frame.grid_columnconfigure(1, weight=1)

        # ROSBOT executable path
        exe_label = tk.Label(path_frame, text=i18n_manager.get_ui_text("rosbot.rosbot_path") + ":",
                            bg=UnifiedStyles.COLORS['bg_secondary'],
                            fg=UnifiedStyles.COLORS['text_primary'],
                            font=UnifiedStyles.FONTS['label'])
        exe_label.grid(row=0, column=0, sticky="w",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['xs'])

        # ROSBOT path using ConfigBinding
        exe_entry = ConfigBinding.create_input_binding(
            path_frame, "ros_settings.ros_directory",
            default_value="D:\\applications\\GamesBot\\ros-bot7.18\\ros-bot7.18", width=50,
            bg=UnifiedStyles.COLORS['input_bg'],
            fg=UnifiedStyles.COLORS['input_text'],
            font=UnifiedStyles.FONTS['input'])
        exe_entry.grid(row=0, column=1, sticky="ew",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['xs'])

        browse_btn = tk.Button(path_frame, text=i18n_manager.get_ui_text("rosbot.browse"),
                              bg=UnifiedStyles.COLORS['btn_secondary'],
                              fg=UnifiedStyles.COLORS['text_primary'],
                              font=UnifiedStyles.FONTS['button'],
                              command=self._browse_rosbot_path)
        browse_btn.grid(row=0, column=2, padx=(0, UnifiedStyles.SPACING['sm']),
                       pady=UnifiedStyles.SPACING['xs'])

        # Battle.net executable path
        battlenet_label = tk.Label(path_frame, text=i18n_manager.get_ui_text("rosbot.battlenet_path") + ":",
                                  bg=UnifiedStyles.COLORS['bg_secondary'],
                                  fg=UnifiedStyles.COLORS['text_primary'],
                                  font=UnifiedStyles.FONTS['label'])
        battlenet_label.grid(row=1, column=0, sticky="w",
                            padx=UnifiedStyles.SPACING['sm'],
                            pady=UnifiedStyles.SPACING['xs'])

        # Battle.net path using ConfigBinding
        battlenet_entry = ConfigBinding.create_input_binding(
            path_frame, "battlenet.battlenet_path",
            default_value="D:\\applications\\Games\\Battle.net\\Battle.net.exe", width=50,
            bg=UnifiedStyles.COLORS['input_bg'],
            fg=UnifiedStyles.COLORS['input_text'],
            font=UnifiedStyles.FONTS['input'])
        battlenet_entry.grid(row=1, column=1, sticky="ew",
                            padx=UnifiedStyles.SPACING['sm'],
                            pady=UnifiedStyles.SPACING['xs'])

        battlenet_browse_btn = tk.Button(path_frame, text=i18n_manager.get_ui_text("rosbot.browse"),
                                        bg=UnifiedStyles.COLORS['btn_secondary'],
                                        fg=UnifiedStyles.COLORS['text_primary'],
                                        font=UnifiedStyles.FONTS['button'],
                                        command=self._browse_battlenet_path)
        battlenet_browse_btn.grid(row=1, column=2, padx=(0, UnifiedStyles.SPACING['sm']),
                                 pady=UnifiedStyles.SPACING['xs'])

        # One-click scan row
        scan_btn = tk.Button(path_frame, text=i18n_manager.get_ui_text("rosbot.scan_one_click"),
                             bg=UnifiedStyles.COLORS['btn_secondary'],
                             fg=UnifiedStyles.COLORS['text_primary'],
                             font=UnifiedStyles.FONTS['button'],
                             command=self._run_one_click_scan)
        scan_btn.grid(row=2, column=0, columnspan=3, pady=UnifiedStyles.SPACING['xs'])
        self._path_scan_btn = scan_btn

    def _run_one_click_scan(self):
        """Run path scan in background thread, then apply results on main thread."""
        self._path_scan_btn.config(state=tk.DISABLED, text=i18n_manager.get_ui_text("rosbot.scan_searching"))
        get_thread_registry().run_path_scan(self)

    def _apply_scan_results(self, battlenet_path, rosbot_dirs, error_msg=None):
        """Apply scan results: set config and optionally show choice dialog for multiple ROSBOT."""
        self._path_scan_btn.config(state=tk.NORMAL, text=i18n_manager.get_ui_text("rosbot.scan_one_click"))
        if error_msg:
            messagebox.showerror(i18n_manager.get_ui_text("rosbot.error"), error_msg)
            return
        if battlenet_path:
            ConfigBinding.set_config_value("battlenet.battlenet_path", battlenet_path)
        if len(rosbot_dirs) == 1:
            ConfigBinding.set_config_value("ros_settings.ros_directory", rosbot_dirs[0])
        elif len(rosbot_dirs) > 1:
            chosen = self._ask_choose_rosbot_directory(rosbot_dirs)
            if chosen:
                ConfigBinding.set_config_value("ros_settings.ros_directory", chosen)
        if not battlenet_path and not rosbot_dirs:
            msg = []
            if not battlenet_path:
                msg.append(i18n_manager.get_ui_text("rosbot.scan_not_found_battlenet"))
            if not rosbot_dirs:
                msg.append(i18n_manager.get_ui_text("rosbot.scan_not_found_rosbot"))
            messagebox.showinfo(i18n_manager.get_ui_text("rosbot.scan_done"), "\n".join(msg))

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

    def _create_bot_settings(self, parent):
        """Create bot settings section"""
        settings_frame = tk.LabelFrame(parent, text=i18n_manager.get_ui_text("rosbot.bot_settings"),
                                      bg=UnifiedStyles.COLORS['bg_secondary'],
                                      fg=UnifiedStyles.COLORS['text_primary'],
                                      font=UnifiedStyles.FONTS['subheading'])
        settings_frame.grid(row=1, column=0, columnspan=2, sticky="ew",
                           padx=UnifiedStyles.SPACING['sm'],
                           pady=UnifiedStyles.SPACING['xs'])
        settings_frame.grid_columnconfigure(0, weight=1)
        settings_frame.grid_columnconfigure(1, weight=1)
        settings_frame.grid_columnconfigure(2, weight=1)

        # Bot settings checkboxes using ConfigBinding (3 columns to reduce height)
        bot_settings = [
            ("rosbot.auto_enable_latest_ros", "ros_settings.auto_enable_latest_ros", True),
            ("rosbot.auto_start_rosbot", "ros_settings.auto_start_rosbot", True),
            ("rosbot.auto_start_other_exe", "ros_settings.auto_start_other_exe", True),
            ("rosbot.force_cleanup_restart", "ros_settings.force_cleanup_restart", True),
            ("rosbot.auto_configure_ui", "ros_settings.auto_configure_ui", True),
            ("rosbot.detailed_logging", "ros_settings.detailed_logging", True),
            ("rosbot.pickup_blood_shards", "rosbot.pickup_blood_shards", False),
            ("rosbot.prevent_stuck", "rosbot.prevent_stuck", False),
            ("rosbot.blue_portal_priority", "rosbot.blue_portal_priority", False),
            ("rosbot.startup", "rosbot.startup", False),
            ("rosbot.monitor_start_rosbot", "rosbot.monitor_start_rosbot", False)
        ]

        row = 0
        col = 0
        for i18n_key, config_key, default in bot_settings:
            check = ConfigBinding.create_checkbox_binding(
                settings_frame, config_key, text=i18n_manager.get_ui_text(i18n_key), default_value=default,
                bg=UnifiedStyles.COLORS['bg_secondary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
                activebackground=UnifiedStyles.COLORS['bg_secondary'],
                activeforeground=UnifiedStyles.COLORS['text_primary']
            )
            check.grid(row=row, column=col, sticky="w",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['xs'])

            col += 1
            if col > 2:
                col = 0
                row += 1

    def _create_control_panel(self):
        """Create ROSBOT control and status panel"""
        control_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("rosbot.control_panel"), style='TLabelframe')
        control_frame.grid(row=0, column=1, sticky="new",
                          padx=(UnifiedStyles.SPACING['sm'], 0),
                          pady=UnifiedStyles.SPACING['xs'])

        # Configure grid
        control_frame.grid_columnconfigure(0, weight=1)
        control_frame.grid_rowconfigure(1, weight=0)

        # Control buttons
        self._create_control_buttons(control_frame)

        # Status display
        self._create_status_display(control_frame)

    def _create_control_buttons(self, parent):
        """Create control buttons with toggle functionality"""
        button_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        button_frame.grid(row=0, column=0, sticky="ew", 
                         padx=UnifiedStyles.SPACING['sm'], 
                         pady=UnifiedStyles.SPACING['sm'])
        button_frame.grid_columnconfigure(0, weight=1)
        
        # Single toggle button for start/stop
        self.control_btn = tk.Button(button_frame, text=i18n_manager.get_ui_text("rosbot.start_rosbot"),
                                    bg=UnifiedStyles.COLORS['btn_success'],
                                    fg=UnifiedStyles.COLORS['text_primary'],
                                    font=UnifiedStyles.FONTS['button'],
                                    command=self._toggle_rosbot)
        self.control_btn.grid(row=0, column=0, sticky="ew", 
                             padx=UnifiedStyles.SPACING['xs'])

        # Debug button: export Battle.net UI to JSON (immediate call, same module logic as timer-driven flow)
        self.debug_battlenet_ui_btn = tk.Button(button_frame,
                                               text=i18n_manager.get_ui_text("rosbot.debug_battlenet_ui"),
                                               bg=UnifiedStyles.COLORS['bg_primary'],
                                               fg=UnifiedStyles.COLORS['text_primary'],
                                               font=UnifiedStyles.FONTS['button'],
                                               command=self._debug_battlenet_ui_json)
        self.debug_battlenet_ui_btn.grid(row=1, column=0, sticky="ew",
                                        padx=UnifiedStyles.SPACING['xs'],
                                        pady=(UnifiedStyles.SPACING['xs'], 0))

        # Refresh status button: immediate call of same check_window() that the timer calls periodically
        self.refresh_status_btn = tk.Button(button_frame,
                                           text=i18n_manager.get_ui_text("rosbot.refresh_status"),
                                           bg=UnifiedStyles.COLORS['bg_primary'],
                                           fg=UnifiedStyles.COLORS['text_primary'],
                                           font=UnifiedStyles.FONTS['button'],
                                           command=self._refresh_status_now)
        self.refresh_status_btn.grid(row=2, column=0, sticky="ew",
                                    padx=UnifiedStyles.SPACING['xs'],
                                    pady=(UnifiedStyles.SPACING['xs'], 0))
        
        # Update button state based on current ROSBOT status
        self._update_control_button()

    def _create_status_display(self, parent):
        """Create status display with ROS/D3/Map/Stage"""
        status_frame = tk.LabelFrame(parent, text=i18n_manager.get_ui_text("rosbot.status_info"),
                                    bg=UnifiedStyles.COLORS['bg_secondary'],
                                    fg=UnifiedStyles.COLORS['text_primary'],
                                    font=UnifiedStyles.FONTS['subheading'])
        status_frame.grid(row=1, column=0, sticky="ew",
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['sm'])

        # Configure grid for status display (5 rows: Battle.net / ROS / D3 / Map / Stage)
        for i in range(5):
            status_frame.grid_rowconfigure(i, weight=0, minsize=20)
        status_frame.grid_columnconfigure(0, weight=0)
        status_frame.grid_columnconfigure(1, weight=1)

        # Battle.net Status
        battlenet_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.battlenet_status") + ":",
                                  bg=UnifiedStyles.COLORS['bg_secondary'],
                                  fg=UnifiedStyles.COLORS['text_primary'],
                                  font=UnifiedStyles.FONTS['label'])
        battlenet_label.grid(row=0, column=0, sticky="w",
                            padx=UnifiedStyles.SPACING['sm'],
                            pady=UnifiedStyles.SPACING['xs'])
        self.battlenet_status_var = var_str(status_frame, i18n_manager.get_ui_text("rosbot.not_found"))
        self.battlenet_status_label = tk.Label(status_frame, textvariable=self.battlenet_status_var,
                                              bg=UnifiedStyles.COLORS['bg_secondary'],
                                              fg=UnifiedStyles.COLORS['error'],
                                              font=UnifiedStyles.FONTS['label'])
        self.battlenet_status_label.grid(row=0, column=1, sticky="w",
                                        padx=UnifiedStyles.SPACING['sm'],
                                        pady=UnifiedStyles.SPACING['xs'])

        # ROS Status
        ros_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.ros_status") + ":",
                            bg=UnifiedStyles.COLORS['bg_secondary'],
                            fg=UnifiedStyles.COLORS['text_primary'],
                            font=UnifiedStyles.FONTS['label'])
        ros_label.grid(row=1, column=0, sticky="w",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['xs'])

        self.ros_status_var = var_str(status_frame, i18n_manager.get_ui_text("rosbot.not_running"))
        self.ros_status_label = tk.Label(status_frame, textvariable=self.ros_status_var,
                                        bg=UnifiedStyles.COLORS['bg_secondary'],
                                        fg=UnifiedStyles.COLORS['error'],
                                        font=UnifiedStyles.FONTS['label'])
        self.ros_status_label.grid(row=1, column=1, sticky="w",
                                  padx=UnifiedStyles.SPACING['sm'],
                                  pady=UnifiedStyles.SPACING['xs'])

        # D3 Status
        d3_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.d3_status") + ":",
                           bg=UnifiedStyles.COLORS['bg_secondary'],
                           fg=UnifiedStyles.COLORS['text_primary'],
                           font=UnifiedStyles.FONTS['label'])
        d3_label.grid(row=2, column=0, sticky="w",
                     padx=UnifiedStyles.SPACING['sm'],
                     pady=UnifiedStyles.SPACING['xs'])

        self.d3_status_var = var_str(status_frame, i18n_manager.get_ui_text("rosbot.not_running"))
        self.d3_status_label = tk.Label(status_frame, textvariable=self.d3_status_var,
                                       bg=UnifiedStyles.COLORS['bg_secondary'],
                                       fg=UnifiedStyles.COLORS['error'],
                                       font=UnifiedStyles.FONTS['label'])
        self.d3_status_label.grid(row=2, column=1, sticky="w",
                                 padx=UnifiedStyles.SPACING['sm'],
                                 pady=UnifiedStyles.SPACING['xs'])

        # Map Status
        map_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.map_status") + ":",
                            bg=UnifiedStyles.COLORS['bg_secondary'],
                            fg=UnifiedStyles.COLORS['text_primary'],
                            font=UnifiedStyles.FONTS['label'])
        map_label.grid(row=3, column=0, sticky="w",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['xs'])

        self.map_status_var = var_str(status_frame, i18n_manager.get_ui_text("rosbot.map_unknown"))
        self.map_status_label = tk.Label(status_frame, textvariable=self.map_status_var,
                                        bg=UnifiedStyles.COLORS['bg_secondary'],
                                        fg=UnifiedStyles.COLORS['text_muted'],
                                        font=UnifiedStyles.FONTS['label'])
        self.map_status_label.grid(row=3, column=1, sticky="w",
                                  padx=UnifiedStyles.SPACING['sm'],
                                  pady=UnifiedStyles.SPACING['xs'])

        # Stage Status
        stage_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.stage") + ":",
                              bg=UnifiedStyles.COLORS['bg_secondary'],
                              fg=UnifiedStyles.COLORS['text_primary'],
                              font=UnifiedStyles.FONTS['label'])
        stage_label.grid(row=4, column=0, sticky="w",
                        padx=UnifiedStyles.SPACING['sm'],
                        pady=UnifiedStyles.SPACING['xs'])

        self.stage_var = var_str(status_frame, i18n_manager.get_ui_text("rosbot.stage_unknown"))
        self.stage_label = tk.Label(status_frame, textvariable=self.stage_var,
                                   bg=UnifiedStyles.COLORS['bg_secondary'],
                                   fg=UnifiedStyles.COLORS['text_muted'],
                                   font=UnifiedStyles.FONTS['label'])
        self.stage_label.grid(row=4, column=1, sticky="w",
                             padx=UnifiedStyles.SPACING['sm'],
                             pady=UnifiedStyles.SPACING['xs'])

        # 油猴脚本连接状态（健康机制：油猴定时 ping，此处显示已连接/未连接）
        oauth_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.oauth_script_status") + ":",
                              bg=UnifiedStyles.COLORS['bg_secondary'],
                              fg=UnifiedStyles.COLORS['text_primary'],
                              font=UnifiedStyles.FONTS['label'])
        oauth_label.grid(row=5, column=0, sticky="w",
                        padx=UnifiedStyles.SPACING['sm'],
                        pady=UnifiedStyles.SPACING['xs'])
        self.oauth_script_var = var_str(status_frame, i18n_manager.get_ui_text("rosbot.oauth_script_disconnected"))
        self.oauth_script_label = tk.Label(status_frame, textvariable=self.oauth_script_var,
                                          bg=UnifiedStyles.COLORS['bg_secondary'],
                                          fg=UnifiedStyles.COLORS['error'],
                                          font=UnifiedStyles.FONTS['label'])
        self.oauth_script_label.grid(row=5, column=1, sticky="w",
                                    padx=UnifiedStyles.SPACING['sm'],
                                    pady=UnifiedStyles.SPACING['xs'])
        status_frame.grid_rowconfigure(5, weight=0, minsize=20)

    def _create_log_display_row(self):
        """Create log display in its own row (row 1). Ensure scrollbar visible: row has weight=1, log_frame fills and constrains text."""
        log_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("rosbot.rosbot_log"), style='TLabelframe')
        log_frame.grid(row=1, column=0, columnspan=2, sticky="nsew",
                      padx=0,
                      pady=UnifiedStyles.SPACING['xs'])
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_columnconfigure(1, weight=0)  # scrollbar column fixed width
        log_frame.grid_rowconfigure(0, weight=1)

        # Log text widget - expands with row weight=1 so scrollbar stays visible
        self.log_text = tk.Text(log_frame,
                               bg=UnifiedStyles.COLORS['bg_primary'],
                               fg=UnifiedStyles.COLORS['text_primary'],
                               font=UnifiedStyles.FONTS['code'],
                               wrap=tk.WORD,
                               state=tk.DISABLED)

        # Scrollbar - column 1 so it stays visible (not overflow)
        scrollbar = tk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scrollbar.set)

        self.log_text.grid(row=0, column=0, sticky="nsew",
                          padx=(UnifiedStyles.SPACING['sm'], 0),
                          pady=UnifiedStyles.SPACING['sm'])
        scrollbar.grid(row=0, column=1, sticky="nsew",
                      padx=(0, UnifiedStyles.SPACING['sm']),
                      pady=UnifiedStyles.SPACING['sm'])

        # Right-click context menu: Copy
        self.log_text.bind("<Button-3>", self._show_rosbot_log_context_menu)

    def _show_rosbot_log_context_menu(self, event):
        """Show right-click context menu for ROSBOT log area (Copy)."""
        menu = tk.Menu(self.log_text, tearoff=0)
        menu.add_command(label=i18n_manager.get_ui_text("rosbot.copy"), command=self._copy_rosbot_log_to_clipboard)
        try:
            menu.tk_popup(event.x_root, event.y_root)
        finally:
            menu.grab_release()

    def _copy_rosbot_log_to_clipboard(self):
        """Copy ROSBOT log content to clipboard (selection if any, else all)."""
        try:
            if self.log_text.tag_ranges(tk.SEL):
                text = self.log_text.get(tk.SEL_FIRST, tk.SEL_LAST)
            else:
                text = self.log_text.get("1.0", tk.END)
            if text.strip():
                self.container.clipboard_clear()
                self.container.clipboard_append(text)
        except tk.TclError:
            pass

    def add_log_message(self, message, level="INFO", color=None):
        """Add a log message to the rosbot log display. Schedules UI update on main thread via after(0)."""
        if is_shutdown_requested():
            return
        def _append():
            try:
                if not self.log_text.winfo_exists():
                    return
                self.log_text.configure(state=tk.NORMAL)
                self.log_text.insert(tk.END, f"{message}\n")
                self.log_text.see(tk.END)
                self.log_text.configure(state=tk.DISABLED)
            except (tk.TclError, RuntimeError):
                pass
        try:
            if self.container.winfo_exists():
                self.container.after(0, _append)
        except (tk.TclError, RuntimeError):
            pass

    def _browse_rosbot_path(self):
        """Browse for ROSBOT executable"""
        filename = filedialog.askopenfilename(
            title=i18n_manager.get_ui_text("rosbot.select_rosbot_executable"),
            filetypes=[(i18n_manager.get_ui_text("rosbot.executable_files"), "*.exe"), (i18n_manager.get_ui_text("rosbot.all_files"), "*.*")]
        )
        if filename:
            ConfigBinding.set_config_value("ros_settings.ros_directory", filename)

    def _browse_battlenet_path(self):
        """Browse for Battle.net executable"""
        filename = filedialog.askopenfilename(
            title=i18n_manager.get_ui_text("rosbot.select_battlenet_executable"),
            filetypes=[(i18n_manager.get_ui_text("rosbot.executable_files"), "*.exe"), (i18n_manager.get_ui_text("rosbot.all_files"), "*.*")]
        )
        if filename:
            ConfigBinding.set_config_value("battlenet.battlenet_path", filename)

    def _toggle_rosbot(self):
        """Toggle ROSBOT start/stop"""
        if self.rosbot_running:
            self._stop_rosbot()
        else:
            self._start_rosbot()

    def set_d3_extension_thread(self, thread: Optional[D3ExtensionThread]) -> None:
        """Set the D3 extension thread (called after UI is ready). Commands sent via put_command."""
        self._d3_extension_thread = thread

    def _start_rosbot(self):
        """Start ROSBOT: signal via event center to D3 extension thread if set, else fallback to ad-hoc thread."""
        if not self.rosbot_running:
            self._control_btn_set_busy(True)
            if get_d3_extension_thread():
                trigger_extension_rosbot_start()
            else:
                get_thread_registry().run_login_check(self)

    def _control_btn_set_busy(self, busy):
        """Set control button to busy (disabled) or normal."""
        try:
            if hasattr(self, 'control_btn') and self.control_btn.winfo_exists():
                if busy:
                    self.control_btn.config(state=tk.DISABLED)
                else:
                    self.control_btn.config(state=tk.NORMAL)
        except Exception:
            pass

    def get_status_ui_callback(self):
        """Return callback for status UI (controller registers it with window_monitor)."""
        return self._on_game_state_changed

    def set_refresh_status_fn(self, fn: Callable[[], None]):
        """Set the refresh-status callable (controller injects window_monitor.check_window)."""
        self._refresh_status_fn = fn

    def _refresh_status_now(self):
        """Immediate refresh using injected fn; runs in background thread."""
        fn = self._refresh_status_fn
        if not callable(fn):
            ColorPrint.yellow("[Refresh] No refresh fn set (controller may not have wired window_monitor)")
            return
        ColorPrint.blue("[Refresh] 刷新状态 (manual) -> running check_window in background...")
        get_thread_registry().run_refresh_status(fn)

    def _debug_battlenet_ui_json(self):
        """Export Battle.net UI to JSON via UI Automation (Chrome/Chromium 辅助功能树). 子线程内先 CoInitialize 再调用 WindowAnalyzer."""
        get_thread_registry().run_battlenet_ui_analyze(self)

    def get_login_check_callable(self):
        """Return a callable that runs login check and returns (result: bool, error: Optional[Exception]). Used by ThreadRegistry."""
        def _run():
            try:
                result = get_login_try_screenshot_controller().ensure_battlenet_started_and_login_check()
                return (result, None)
            except Exception as e:
                return (False, e)
        return _run

    def _on_login_check_done(self, success, error=None):
        """Called on main thread after ensure_battlenet_started_and_login_check() finishes (in worker thread)."""
        self._control_btn_set_busy(False)
        if error is not None:
            ColorPrint.red(f"[RosbotPanel] Login check error: {error}")
            self.rosbot_running = False
            self._update_control_button()
            return
        if not success:
            self.rosbot_running = False
            self._update_control_button()
            return
        try:
            self.rosbot_running = True
            self._update_control_button()
            set_task_status('rosbot_task', TaskStatus.ENABLED)
            rosbot_processor.start_rosbot_task()
            ColorPrint.green("[ROSBOT] Started monitoring")
        except Exception as e:
            ColorPrint.red(f"[RosbotPanel] Error after login check: {e}")
            self.rosbot_running = False
            self._update_control_button()

    def _on_rosbot_stop_done(self) -> None:
        """Called on main thread after D3 extension thread has executed stop (task disabled, processor stopped)."""
        self._control_btn_set_busy(False)
        self.rosbot_running = False
        self._update_control_button()
        ColorPrint.yellow("[ROSBOT] Stopped monitoring")

    def _stop_rosbot(self):
        """Stop ROSBOT: signal via event center to D3 extension thread if set, else run stop on main thread."""
        if not self.rosbot_running:
            return
        if get_d3_extension_thread():
            self._control_btn_set_busy(True)
            trigger_extension_rosbot_stop()
        else:
            set_task_status("rosbot_task", TaskStatus.DISABLED)
            rosbot_processor.stop_rosbot_task()
            self.rosbot_running = False
            self._update_control_button()
            ColorPrint.yellow("[ROSBOT] Stopped monitoring")

    def _update_control_button(self):
        """Update control button appearance based on ROSBOT status"""
        try:
            ColorPrint.debug(f"[RosbotPanel] Updating control button, rosbot_running: {self.rosbot_running}")

            if self.rosbot_running:
                self.control_btn.config(
                    text=i18n_manager.get_ui_text("rosbot.stop_rosbot"),
                    bg=UnifiedStyles.COLORS['btn_danger']
                )
                ColorPrint.debug("[RosbotPanel] Button updated to STOP (red)")
            else:
                self.control_btn.config(
                    text=i18n_manager.get_ui_text("rosbot.start_rosbot"),
                    bg=UnifiedStyles.COLORS['btn_success']
                )
                ColorPrint.debug("[RosbotPanel] Button updated to START (green)")

        except Exception as e:
            ColorPrint.red(f"[RosbotPanel] Error in _update_control_button: {e}")

    def _sync_status_ui_once(self):
        """Pull current game state and update status UI (main thread). Used once after status widgets exist so UI reflects state even if first callback ran too early."""
        try:
            if not self.container.winfo_exists():
                return
            state = self.game_state.get_summary()
            self._update_ui_from_state(state)
        except Exception as e:
            ColorPrint.red(f"[RosbotPanel] _sync_status_ui_once error: {e}")

    def _on_game_state_changed(self, state):
        """Handle game state changes (called from background thread)"""
        try:
            if not self.container.winfo_exists():
                return
        except Exception:
            return
        try:
            self.container.after(0, lambda: self._update_ui_from_state(state))
        except Exception:
            pass

    def _update_ui_from_state(self, state):
        """Update UI elements from game state (called on main thread)"""
        if not hasattr(self, 'ros_status_var') or not hasattr(self, 'd3_status_var'):
            return

        # Update Battle.net status (priority: disconnected > on_login_screen > normal_available)
        bn_found = state.get("battlenet_window_found", False)
        ColorPrint.gray(
            f"[StatusUI] state: battlenet_found={bn_found}, d3_running={state.get('d3_running', False)}, "
            f"bn_disconnected={state.get('battlenet_disconnected', False)}, bn_normal={state.get('battlenet_normal_available', False)}"
        )
        if not bn_found:
            bn_text = i18n_manager.get_ui_text("rosbot.not_found")
            bn_ok = False
        elif state.get("battlenet_disconnected", False):
            bn_text = i18n_manager.get_ui_text("rosbot.battlenet_disconnected")
            bn_ok = False
        elif state.get("battlenet_on_login_screen", False):
            bn_text = i18n_manager.get_ui_text("rosbot.battlenet_on_login_screen")
            bn_ok = False
        elif state.get("battlenet_normal_available", False):
            bn_text = i18n_manager.get_ui_text("rosbot.battlenet_normal_available")
            bn_ok = True
        else:
            # Window found but dynamic detection not implemented (BattlenetOperation.is_* all return False)
            bn_text = i18n_manager.get_ui_text("rosbot.found_unknown_state")
            bn_ok = True
        if hasattr(self, "battlenet_status_var"):
            self.battlenet_status_var.set(bn_text)
            self.battlenet_status_label.config(fg=UnifiedStyles.COLORS["success" if bn_ok else "error"])

        # Update ROS status
        ros_running = state.get("rosbot_running", False)
        ros_text = i18n_manager.get_ui_text("rosbot.running" if ros_running else "rosbot.not_running")
        self.ros_status_var.set(ros_text)
        self.ros_status_label.config(fg=UnifiedStyles.COLORS["success" if ros_running else "error"])

        # Update D3 status (priority: disconnected > on_login_screen > in_game > found; align with Battle.net: window found => 已找到)
        if not state.get("d3_running", False):
            d3_text = i18n_manager.get_ui_text("rosbot.not_running")
            d3_ok = False
        elif state.get("d3_disconnected", False):
            d3_text = i18n_manager.get_ui_text("rosbot.d3_disconnected")
            d3_ok = False
        elif state.get("d3_on_login_screen", False):
            d3_text = i18n_manager.get_ui_text("rosbot.d3_on_login_screen")
            d3_ok = False
        elif state.get("d3_in_game", False):
            d3_text = i18n_manager.get_ui_text("rosbot.d3_in_game")
            d3_ok = True
        else:
            # Window found but granular state not detected: show 已找到 (same as Battle.net)
            d3_text = i18n_manager.get_ui_text("rosbot.found")
            d3_ok = True
        self.d3_status_var.set(d3_text)
        self.d3_status_label.config(fg=UnifiedStyles.COLORS["success" if d3_ok else "error"])

        # Update map status
        map_type = state.get("map_type", "unknown")
        map_key = f"rosbot.map_{map_type}"
        map_text = i18n_manager.get_ui_text(map_key)
        self.map_status_var.set(map_text)

        # Update stage status
        game_stage = state.get("game_stage", "unknown")
        stage_key = f"rosbot.stage_{game_stage}"
        stage_text = i18n_manager.get_ui_text(stage_key)
        self.stage_var.set(stage_text)

        # Update 油猴脚本 connection (health: script pings /api/login-try/oauth-ping)
        oauth_connected = state.get("oauth_script_connected", False)
        if hasattr(self, "oauth_script_var") and hasattr(self, "oauth_script_label"):
            oauth_text = i18n_manager.get_ui_text("rosbot.oauth_script_connected" if oauth_connected else "rosbot.oauth_script_disconnected")
            self.oauth_script_var.set(oauth_text)
            self.oauth_script_label.config(fg=UnifiedStyles.COLORS["success" if oauth_connected else "error"])

