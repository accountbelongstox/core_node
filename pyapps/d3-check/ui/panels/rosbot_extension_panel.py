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

# Import game state and task thread manager
from share.game_interface_data import get_game_interface_data
from d3utils.task_thread_manager import get_task_manager, set_task_status, TaskStatus
import d3utils.rosbot_task_processor as rosbot_processor
from d3utils.path_scanner import scan_for_paths
from controller.login_try_screenshot_controller import get_login_try_screenshot_controller

class RosbotExtensionPanel:
    """ROSBOT Extension panel with unified styling"""

    def __init__(self, parent):
        """Initialize ROSBOT extension panel"""
        self.parent = parent

        # Configure TTK styles
        self.style = UnifiedStyles.configure_ttk_styles()

        # ROSBOT running state
        self.rosbot_running = False

        # Get game state instance
        self.game_state = get_game_interface_data()

        # Register state callback
        self.game_state.register_callback(self._on_game_state_changed)

        # Create main container
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        self.container.pack(fill=tk.BOTH, expand=True,
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
        def do_scan():
            try:
                bn, ros = scan_for_paths()
                self.container.after(0, lambda: self._apply_scan_results(bn, ros))
            except Exception as e:
                self.container.after(0, lambda: self._apply_scan_results(None, [], str(e)))
        threading.Thread(target=do_scan, daemon=True).start()

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

        # Configure grid for status display (4 rows x 2 columns)
        for i in range(4):
            status_frame.grid_rowconfigure(i, weight=0)
        status_frame.grid_columnconfigure(0, weight=0)
        status_frame.grid_columnconfigure(1, weight=1)

        # ROS Status
        ros_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.ros_status") + ":",
                            bg=UnifiedStyles.COLORS['bg_secondary'],
                            fg=UnifiedStyles.COLORS['text_primary'],
                            font=UnifiedStyles.FONTS['label'])
        ros_label.grid(row=0, column=0, sticky="w",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['xs'])

        self.ros_status_var = var_str(status_frame, i18n_manager.get_ui_text("rosbot.not_running"))
        self.ros_status_label = tk.Label(status_frame, textvariable=self.ros_status_var,
                                        bg=UnifiedStyles.COLORS['bg_secondary'],
                                        fg=UnifiedStyles.COLORS['error'],
                                        font=UnifiedStyles.FONTS['label'])
        self.ros_status_label.grid(row=0, column=1, sticky="w",
                                  padx=UnifiedStyles.SPACING['sm'],
                                  pady=UnifiedStyles.SPACING['xs'])

        # D3 Status
        d3_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.d3_status") + ":",
                           bg=UnifiedStyles.COLORS['bg_secondary'],
                           fg=UnifiedStyles.COLORS['text_primary'],
                           font=UnifiedStyles.FONTS['label'])
        d3_label.grid(row=1, column=0, sticky="w",
                     padx=UnifiedStyles.SPACING['sm'],
                     pady=UnifiedStyles.SPACING['xs'])

        self.d3_status_var = var_str(status_frame, i18n_manager.get_ui_text("rosbot.not_running"))
        self.d3_status_label = tk.Label(status_frame, textvariable=self.d3_status_var,
                                       bg=UnifiedStyles.COLORS['bg_secondary'],
                                       fg=UnifiedStyles.COLORS['error'],
                                       font=UnifiedStyles.FONTS['label'])
        self.d3_status_label.grid(row=1, column=1, sticky="w",
                                 padx=UnifiedStyles.SPACING['sm'],
                                 pady=UnifiedStyles.SPACING['xs'])

        # Map Status
        map_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.map_status") + ":",
                            bg=UnifiedStyles.COLORS['bg_secondary'],
                            fg=UnifiedStyles.COLORS['text_primary'],
                            font=UnifiedStyles.FONTS['label'])
        map_label.grid(row=2, column=0, sticky="w",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['xs'])

        self.map_status_var = var_str(status_frame, i18n_manager.get_ui_text("rosbot.map_unknown"))
        self.map_status_label = tk.Label(status_frame, textvariable=self.map_status_var,
                                        bg=UnifiedStyles.COLORS['bg_secondary'],
                                        fg=UnifiedStyles.COLORS['text_muted'],
                                        font=UnifiedStyles.FONTS['label'])
        self.map_status_label.grid(row=2, column=1, sticky="w",
                                  padx=UnifiedStyles.SPACING['sm'],
                                  pady=UnifiedStyles.SPACING['xs'])

        # Stage Status
        stage_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.stage") + ":",
                              bg=UnifiedStyles.COLORS['bg_secondary'],
                              fg=UnifiedStyles.COLORS['text_primary'],
                              font=UnifiedStyles.FONTS['label'])
        stage_label.grid(row=3, column=0, sticky="w",
                        padx=UnifiedStyles.SPACING['sm'],
                        pady=UnifiedStyles.SPACING['xs'])

        self.stage_var = var_str(status_frame, i18n_manager.get_ui_text("rosbot.stage_unknown"))
        self.stage_label = tk.Label(status_frame, textvariable=self.stage_var,
                                   bg=UnifiedStyles.COLORS['bg_secondary'],
                                   fg=UnifiedStyles.COLORS['text_muted'],
                                   font=UnifiedStyles.FONTS['label'])
        self.stage_label.grid(row=3, column=1, sticky="w",
                             padx=UnifiedStyles.SPACING['sm'],
                             pady=UnifiedStyles.SPACING['xs'])

    def _create_log_display_row(self):
        """Create log display in its own row (row 2)"""
        log_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("rosbot.rosbot_log"), style='TLabelframe')
        log_frame.grid(row=1, column=0, columnspan=2, sticky="nsew",
                      padx=0,
                      pady=UnifiedStyles.SPACING['xs'])
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(0, weight=1)

        # Log text widget (no fixed height so it expands with row weight=1)
        self.log_text = tk.Text(log_frame,
                               bg=UnifiedStyles.COLORS['bg_primary'],
                               fg=UnifiedStyles.COLORS['text_primary'],
                               font=UnifiedStyles.FONTS['code'],
                               wrap=tk.WORD,
                               state=tk.DISABLED)

        # Scrollbar
        scrollbar = tk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scrollbar.set)

        # Grid layout
        self.log_text.grid(row=0, column=0, sticky="nsew",
                          padx=(UnifiedStyles.SPACING['sm'], 0),
                          pady=UnifiedStyles.SPACING['sm'])
        scrollbar.grid(row=0, column=1, sticky="ns",
                      padx=(0, UnifiedStyles.SPACING['sm']),
                      pady=UnifiedStyles.SPACING['sm'])

    def add_log_message(self, message, level="INFO", color=None):
        """Add a log message to the rosbot log display. Thread-safe: schedules UI update on main thread if needed."""
        def _append():
            try:
                if not self.log_text.winfo_exists():
                    return
                self.log_text.configure(state=tk.NORMAL)
                self.log_text.insert(tk.END, f"{message}\n")
                self.log_text.see(tk.END)
                self.log_text.configure(state=tk.DISABLED)
            except tk.TclError:
                pass
        try:
            if self.container.winfo_exists():
                self.container.after(0, _append)
        except tk.TclError:
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

    def _start_rosbot(self):
        """Start ROSBOT"""
        if not self.rosbot_running:
            try:
                # Step 0: Ensure Battle.net started, activate UI (tray click), screenshot, check login text
                self._debug_messagebox("DEBUG #0", "[RosbotPanel] Step 0: Ensure Battle.net and login check")
                get_login_try_screenshot_controller().ensure_battlenet_started_and_login_check()

                # Step 1: Update UI state immediately to provide feedback
                self._debug_messagebox("DEBUG #1", "[RosbotPanel] Step 1: Start updating UI state")
                self.rosbot_running = True
                self._debug_messagebox("DEBUG #2", "[RosbotPanel] Step 1: rosbot_running set to True")

                self._update_control_button()
                self._debug_messagebox("DEBUG #3", "[RosbotPanel] Step 1: _update_control_button completed")

                # Step 2: Enable ROSBOT task thread
                self._debug_messagebox("DEBUG #4", "[RosbotPanel] Step 2: Preparing to set task status")
                set_task_status('rosbot_task', TaskStatus.ENABLED)
                self._debug_messagebox("DEBUG #5", "[RosbotPanel] Step 2: set_task_status completed")

                # Step 3: Start ROSBOT operations in task thread
                self._debug_messagebox("DEBUG #6", "[RosbotPanel] Step 3: Preparing to start ROSBOT task")
                rosbot_processor.start_rosbot_task()
                self._debug_messagebox("DEBUG #7", "[RosbotPanel] Step 3: start_rosbot_task returned")

                # Step 4: Final confirmation
                self._debug_messagebox("DEBUG #8", "[RosbotPanel] Step 4: All steps completed")
                ColorPrint.green("[ROSBOT] Started monitoring")

            except Exception as e:
                self._debug_messagebox("ERROR", f"[RosbotPanel] Exception: {e}", "error")
                ColorPrint.red(f"[RosbotPanel] Error in _start_rosbot: {e}")
                # Revert UI state on error
                self.rosbot_running = False
                self._update_control_button()

    def _stop_rosbot(self):
        """Stop ROSBOT"""
        if self.rosbot_running:
            # Disable ROSBOT task thread
            set_task_status('rosbot_task', TaskStatus.DISABLED)
            
            # Stop ROSBOT operations in task thread
            rosbot_processor.stop_rosbot_task()
            
            # Update UI state
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

    def _on_game_state_changed(self, state):
        """Handle game state changes (called from background thread)"""
        self._debug_messagebox("DEBUG #30", f"[RosbotPanel] Enter _on_game_state_changed, state={state}")

        # Check if container still exists (not destroyed during shutdown)
        try:
            if not self.container.winfo_exists():
                self._debug_messagebox("DEBUG #31-SKIP", "[RosbotPanel] Container destroyed, skipping")
                return
        except:
            # Container is destroyed or not accessible
            return

        # Schedule UI update on main thread to avoid tkinter thread safety issues
        self._debug_messagebox("DEBUG #31", "[RosbotPanel] Preparing to call container.after")
        try:
            self.container.after(0, lambda: self._update_ui_from_state(state))
            self._debug_messagebox("DEBUG #32", "[RosbotPanel] container.after returned")
        except:
            # Main loop may have stopped
            self._debug_messagebox("DEBUG #32-ERROR", "[RosbotPanel] container.after failed (main loop stopped)")

    def _update_ui_from_state(self, state):
        """Update UI elements from game state (called on main thread)"""
        self._debug_messagebox("DEBUG #33", f"[RosbotPanel] Enter _update_ui_from_state, state={state}")

        # Check if UI elements exist before updating
        if not hasattr(self, 'ros_status_var') or not hasattr(self, 'd3_status_var'):
            self._debug_messagebox("DEBUG #34-SKIP", "[RosbotPanel] UI not fully initialized, skipping")
            return  # UI not fully initialized yet

        self._debug_messagebox("DEBUG #34", "[RosbotPanel] Start updating UI elements")

        # Update ROS status
        ros_text = i18n_manager.get_ui_text("rosbot.running" if state['rosbot_running'] else "rosbot.not_running")
        self.ros_status_var.set(ros_text)
        self.ros_status_label.config(fg=UnifiedStyles.COLORS['success' if state['rosbot_running'] else 'error'])
        self._debug_messagebox("DEBUG #35", "[RosbotPanel] ROS status updated")

        # Update D3 status
        d3_text = i18n_manager.get_ui_text("rosbot.running" if state['d3_running'] else "rosbot.not_running")
        self.d3_status_var.set(d3_text)
        self.d3_status_label.config(fg=UnifiedStyles.COLORS['success' if state['d3_running'] else 'error'])
        self._debug_messagebox("DEBUG #36", "[RosbotPanel] D3 status updated")

        # Update map status
        map_key = f"rosbot.map_{state['map_type']}"
        map_text = i18n_manager.get_ui_text(map_key)
        self.map_status_var.set(map_text)
        self._debug_messagebox("DEBUG #37", "[RosbotPanel] Map status updated")

        # Update stage status
        stage_key = f"rosbot.stage_{state['game_stage']}"
        stage_text = i18n_manager.get_ui_text(stage_key)
        self.stage_var.set(stage_text)
        self._debug_messagebox("DEBUG #38", "[RosbotPanel] Stage status updated")
        self._debug_messagebox("DEBUG #39", "[RosbotPanel] _update_ui_from_state completed")

