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

# Import unified styles
from ..unified_styles import UnifiedStyles

# Import from common_imports
from providor.common_imports import ColorPrint

# Import CONFIG from providor
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))
from providor.providor_index import CONFIG

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding

# Import game state and task thread manager
from d3utils.game_state import get_game_state, register_state_callback
from d3utils.task_thread_manager import get_task_manager, set_task_status, TaskStatus
import d3utils.rosbot_task_processor as rosbot_processor


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
        self.game_state = get_game_state()

        # Create main container
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        self.container.pack(fill=tk.BOTH, expand=True,
                           padx=UnifiedStyles.SPACING['md'],
                           pady=UnifiedStyles.SPACING['md'])

        # Configure grid - 2 rows, 2 columns in first row, 1 column in second row
        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_columnconfigure(1, weight=1)
        self.container.grid_rowconfigure(0, weight=0)
        self.container.grid_rowconfigure(1, weight=1)

        # Create content
        self.create_content()

        # Register as ColorPrint callback for rosbot-specific logs
        ColorPrint.register_callback(self.add_log_message)

        # Register game state callback for UI updates (after UI is fully created)
        register_state_callback(self._on_game_state_changed)

        # Note: Language change is handled by main UI, not individual panels

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
        config_frame.grid(row=0, column=0, sticky="nsew", 
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

    def _create_bot_settings(self, parent):
        """Create bot settings section"""
        settings_frame = tk.LabelFrame(parent, text=i18n_manager.get_ui_text("rosbot.bot_settings"),
                                      bg=UnifiedStyles.COLORS['bg_secondary'],
                                      fg=UnifiedStyles.COLORS['text_primary'],
                                      font=UnifiedStyles.FONTS['subheading'])
        settings_frame.grid(row=1, column=0, columnspan=2, sticky="ew", 
                           padx=UnifiedStyles.SPACING['sm'], 
                           pady=UnifiedStyles.SPACING['sm'])
        
        # Bot settings checkboxes using ConfigBinding
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
            if col > 1:
                col = 0
                row += 1

    def _create_control_panel(self):
        """Create ROSBOT control and status panel"""
        control_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("rosbot.control_panel"), style='TLabelframe')
        control_frame.grid(row=0, column=1, sticky="nsew",
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

        self.ros_status_var = tk.StringVar(value=i18n_manager.get_ui_text("rosbot.not_running"))
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

        self.d3_status_var = tk.StringVar(value=i18n_manager.get_ui_text("rosbot.not_running"))
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

        self.map_status_var = tk.StringVar(value=i18n_manager.get_ui_text("rosbot.map_unknown"))
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

        self.stage_var = tk.StringVar(value=i18n_manager.get_ui_text("rosbot.stage_unknown"))
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

        # Log text widget
        self.log_text = tk.Text(log_frame,
                               bg=UnifiedStyles.COLORS['bg_primary'],
                               fg=UnifiedStyles.COLORS['text_primary'],
                               font=UnifiedStyles.FONTS['code'],
                               wrap=tk.WORD,
                               height=8,
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
        """Add a log message to the rosbot log display"""
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, f"{message}\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

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
                # Step 1: Update UI state immediately to provide feedback
                messagebox.showinfo("Debug", "Step 1: Updating UI state")
                self.rosbot_running = True
                self._update_control_button()
                messagebox.showinfo("Debug", "Step 1: UI state updated successfully")
                
                # Step 2: Enable ROSBOT task thread
                messagebox.showinfo("Debug", "Step 2: Setting task status to ENABLED")
                set_task_status('rosbot_task', TaskStatus.ENABLED)
                messagebox.showinfo("Debug", "Step 2: Task status set successfully")
                
                # Step 3: Start ROSBOT operations in task thread
                messagebox.showinfo("Debug", "Step 3: Starting ROSBOT task")
                rosbot_processor.start_rosbot_task()
                messagebox.showinfo("Debug", "Step 3: ROSBOT task started successfully")
                
                # Step 4: Final confirmation
                messagebox.showinfo("Debug", "Step 4: ROSBOT startup completed")
                ColorPrint.green("[ROSBOT] Started monitoring")
                
            except Exception as e:
                messagebox.showerror("Debug Error", f"Error in _start_rosbot: {e}")
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
            messagebox.showinfo("Debug", f"Updating control button, rosbot_running: {self.rosbot_running}")
            
            if self.rosbot_running:
                self.control_btn.config(
                    text=i18n_manager.get_ui_text("rosbot.stop_rosbot"),
                    bg=UnifiedStyles.COLORS['btn_danger']
                )
                messagebox.showinfo("Debug", "Button updated to STOP (red)")
            else:
                self.control_btn.config(
                    text=i18n_manager.get_ui_text("rosbot.start_rosbot"),
                    bg=UnifiedStyles.COLORS['btn_success']
                )
                messagebox.showinfo("Debug", "Button updated to START (green)")
                
        except Exception as e:
            messagebox.showerror("Debug Error", f"Error in _update_control_button: {e}")

    def _on_game_state_changed(self, state):
        """Handle game state changes (called from background thread)"""
        # Schedule UI update on main thread to avoid tkinter thread safety issues
        self.container.after(0, lambda: self._update_ui_from_state(state))
    
    def _update_ui_from_state(self, state):
        """Update UI elements from game state (called on main thread)"""
        # Check if UI elements exist before updating
        if not hasattr(self, 'ros_status_var') or not hasattr(self, 'd3_status_var'):
            return  # UI not fully initialized yet
        
        # Update ROS status
        ros_text = i18n_manager.get_ui_text("rosbot.running" if state['rosbot_running'] else "rosbot.not_running")
        self.ros_status_var.set(ros_text)
        self.ros_status_label.config(fg=UnifiedStyles.COLORS['success' if state['rosbot_running'] else 'error'])
        
        # Update D3 status
        d3_text = i18n_manager.get_ui_text("rosbot.running" if state['d3_running'] else "rosbot.not_running")
        self.d3_status_var.set(d3_text)
        self.d3_status_label.config(fg=UnifiedStyles.COLORS['success' if state['d3_running'] else 'error'])
        
        # Update map status
        map_key = f"rosbot.map_{state['map_type']}"
        map_text = i18n_manager.get_ui_text(map_key)
        self.map_status_var.set(map_text)
        
        # Update stage status
        stage_key = f"rosbot.stage_{state['game_stage']}"
        stage_text = i18n_manager.get_ui_text(stage_key)
        self.stage_var.set(stage_text)

