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

# Import CONFIG from providor
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))
from providor.providor_index import CONFIG

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding


class RosbotExtensionPanel:
    """ROSBOT Extension panel with unified styling"""
    
    def __init__(self, parent):
        """Initialize ROSBOT extension panel"""
        self.parent = parent
        self.vars = {}
        
        # Configure TTK styles
        self.style = UnifiedStyles.configure_ttk_styles()
        
        # Create main container
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        self.container.pack(fill=tk.BOTH, expand=True, 
                           padx=UnifiedStyles.SPACING['md'], 
                           pady=UnifiedStyles.SPACING['md'])
        
        # Configure grid
        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_columnconfigure(1, weight=1)
        self.container.grid_rowconfigure(0, weight=1)
        
        # Create content
        self.create_content()

        # Load configuration
        self._load_rosbot_config()

        # Note: Language change is handled by main UI, not individual panels

    def create_content(self):
        """Create panel content"""
        # Left panel - Configuration
        self._create_config_panel()
        
        # Right panel - Control and Status
        self._create_control_panel()

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
            ("自动启用最新ROS", "ros_settings.auto_enable_latest_ros", True),
            ("自动启动ROSBOT", "ros_settings.auto_start_rosbot", True),
            ("自动启动其他EXE", "ros_settings.auto_start_other_exe", True),
            ("强制清理重启", "ros_settings.force_cleanup_restart", True),
            ("自动配置UI", "ros_settings.auto_configure_ui", True),
            ("详细日志", "ros_settings.detailed_logging", True),
            ("捡血岩碎片", "rosbot.pickup_blood_shards", False),
            ("防止卡住", "rosbot.prevent_stuck", False),
            ("蓝门拾取材料 优先", "rosbot.blue_portal_priority", False),
            ("开机启动", "rosbot.startup", False),
            ("监控启动ROSBOT", "rosbot.monitor_start_rosbot", False)
        ]

        row = 0
        col = 0
        for setting_name, config_key, default in bot_settings:
            check = ConfigBinding.create_checkbox_binding(
                settings_frame, config_key, text=setting_name, default_value=default,
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
        control_frame.grid_rowconfigure(2, weight=1)
        
        # Control buttons
        self._create_control_buttons(control_frame)
        
        # Status display
        self._create_status_display(control_frame)
        
        # Log display
        self._create_log_display(control_frame)

    def _create_control_buttons(self, parent):
        """Create control buttons"""
        button_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        button_frame.grid(row=0, column=0, sticky="ew", 
                         padx=UnifiedStyles.SPACING['sm'], 
                         pady=UnifiedStyles.SPACING['sm'])
        button_frame.grid_columnconfigure(0, weight=1)
        button_frame.grid_columnconfigure(1, weight=1)
        
        # Start button
        start_btn = tk.Button(button_frame, text=i18n_manager.get_ui_text("rosbot.start_rosbot"),
                             bg=UnifiedStyles.COLORS['btn_success'],
                             fg=UnifiedStyles.COLORS['text_primary'],
                             font=UnifiedStyles.FONTS['button'],
                             command=self._start_rosbot)
        start_btn.grid(row=0, column=0, sticky="ew", 
                      padx=(0, UnifiedStyles.SPACING['xs']))
        
        # Stop button
        stop_btn = tk.Button(button_frame, text=i18n_manager.get_ui_text("rosbot.stop_rosbot"),
                            bg=UnifiedStyles.COLORS['btn_danger'],
                            fg=UnifiedStyles.COLORS['text_primary'],
                            font=UnifiedStyles.FONTS['button'],
                            command=self._stop_rosbot)
        stop_btn.grid(row=0, column=1, sticky="ew", 
                     padx=(UnifiedStyles.SPACING['xs'], 0))

    def _create_status_display(self, parent):
        """Create status display"""
        status_frame = tk.LabelFrame(parent, text=i18n_manager.get_ui_text("rosbot.status_info"),
                                    bg=UnifiedStyles.COLORS['bg_secondary'],
                                    fg=UnifiedStyles.COLORS['text_primary'],
                                    font=UnifiedStyles.FONTS['subheading'])
        status_frame.grid(row=1, column=0, sticky="ew", 
                         padx=UnifiedStyles.SPACING['sm'], 
                         pady=UnifiedStyles.SPACING['sm'])
        
        # Status labels
        self.status_var = tk.StringVar(value=i18n_manager.get_ui_text("rosbot.not_running"))
        status_label = tk.Label(status_frame, text=i18n_manager.get_ui_text("rosbot.status") + ":",
                               bg=UnifiedStyles.COLORS['bg_secondary'],
                               fg=UnifiedStyles.COLORS['text_primary'],
                               font=UnifiedStyles.FONTS['label'])
        status_label.grid(row=0, column=0, sticky="w", 
                         padx=UnifiedStyles.SPACING['sm'], 
                         pady=UnifiedStyles.SPACING['xs'])
        
        status_value = tk.Label(status_frame, textvariable=self.status_var,
                               bg=UnifiedStyles.COLORS['bg_secondary'],
                               fg=UnifiedStyles.COLORS['success'],
                               font=UnifiedStyles.FONTS['label'])
        status_value.grid(row=0, column=1, sticky="w", 
                         padx=UnifiedStyles.SPACING['sm'], 
                         pady=UnifiedStyles.SPACING['xs'])

    def _create_log_display(self, parent):
        """Create log display"""
        log_frame = tk.LabelFrame(parent, text=i18n_manager.get_ui_text("rosbot.rosbot_log"),
                                 bg=UnifiedStyles.COLORS['bg_secondary'],
                                 fg=UnifiedStyles.COLORS['text_primary'],
                                 font=UnifiedStyles.FONTS['subheading'])
        log_frame.grid(row=2, column=0, sticky="nsew", 
                      padx=UnifiedStyles.SPACING['sm'], 
                      pady=UnifiedStyles.SPACING['sm'])
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(0, weight=1)
        
        # Log text widget
        self.log_text = tk.Text(log_frame,
                               bg=UnifiedStyles.COLORS['bg_primary'],
                               fg=UnifiedStyles.COLORS['text_primary'],
                               font=UnifiedStyles.FONTS['code'],
                               wrap=tk.WORD,
                               height=10,
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
    
    def _browse_rosbot_path(self):
        """Browse for ROSBOT executable"""
        filename = filedialog.askopenfilename(
            title=i18n_manager.get_ui_text("rosbot.select_rosbot_executable"),
        filetypes=[(i18n_manager.get_ui_text("rosbot.executable_files"), "*.exe"), (i18n_manager.get_ui_text("rosbot.all_files"), "*.*")]
        )
        if filename:
            self.vars['rosbot_path'].set(filename)

    def _start_rosbot(self):
        """Start ROSBOT"""
        messagebox.showinfo("ROSBOT", i18n_manager.get_ui_text("rosbot.start_functionality"))
    
    def _stop_rosbot(self):
        """Stop ROSBOT"""
        messagebox.showinfo("ROSBOT", i18n_manager.get_ui_text("rosbot.stop_functionality"))

    def _load_rosbot_config(self):
        """Load ROSBOT configuration"""
        try:
            # Load from CONFIG if available
            if hasattr(CONFIG, 'rosbot_path'):
                self.vars['rosbot_path'].set(CONFIG.rosbot_path)

            print("[ROSBOT] Configuration loaded successfully")

        except Exception as e:
            print(f"[ROSBOT] Failed to load configuration: {e}")

# Language change is now handled by main UI - no individual panel methods needed
