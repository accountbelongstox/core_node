#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Functions Panel - Unified Style Version
Contains D4-specific automation features with unified styling
"""

import queue
import tkinter as tk
from tkinter import ttk
import sys
import os

# Import unified styles
from ..unified_styles import UnifiedStyles

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint

# Import CONFIG from providor
from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from providor.providor_index import CONFIG, save_config

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager

# Import map name utilities
from controller.d4func.map_name_utils import get_current_map_name_from_shared_data
from runtime import is_shutdown_requested

# Import D4 controller and state
from controller.d4_controller import get_d4_controller
# D4State functionality now integrated into D4InterfaceData


class D4Panel:
    """D4 Functions panel with unified styling and sub-tab navigation"""

    def __init__(self, parent):
        """
        Initialize D4 panel

        Args:
            parent: Parent widget
        """
        self.parent = parent

        # Configure TTK styles
        self.style = UnifiedStyles.configure_ttk_styles()

        # Get D4 controller and data
        self.d4_controller = get_d4_controller()
        # D4State functionality now integrated into D4InterfaceData

        # Register UI status update callback
        self._register_ui_status_callback()

        # Create main container - tab main style (UnifiedStyles.TAB_PAD, same as other tab panels)
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        tab_pad = UnifiedStyles.TAB_PAD
        self.container.pack(fill=tk.BOTH, expand=True, padx=tab_pad, pady=tab_pad)

        # Configure grid - 2 columns: left for sub-tab navigation, right for content
        self.container.grid_columnconfigure(0, weight=0, minsize=120)  # Sub-tab column (fixed width)
        self.container.grid_columnconfigure(1, weight=1)  # Content column (expandable)
        self.container.grid_rowconfigure(0, weight=1)

        # Log queue for D4 messages (enqueue from any thread, drain on main thread)
        self._log_queue = queue.Queue(maxsize=500)

        # Create content
        self.create_content()

        # Register as ColorPrint callback for D4-specific logs
        ColorPrint.register_callback(self.add_log_message)

        # Start draining log queue on main thread
        self.container.after(100, self._drain_log_queue)

    def create_content(self):
        """Create panel content"""
        # Left column - Sub-tab navigation (vertical button list)
        self._create_subtab_navigation()

        # Right column - Content area
        self._create_content_area()

        # Show default sub-tab (EXP Farming)
        self._show_exp_farming_tab()

    def _create_subtab_navigation(self):
        """Create vertical sub-tab navigation on the left"""
        # Create navigation frame
        nav_frame = tk.Frame(self.container,
                            bg=UnifiedStyles.COLORS['bg_secondary'],
                            relief=tk.RIDGE, bd=1)
        nav_frame.grid(row=0, column=0, sticky="nsew",
                      padx=(0, UnifiedStyles.SPACING['sm']),
                      pady=0)

        # Title label
        title_label = tk.Label(nav_frame,
                              text=i18n_manager.get_ui_text("d4_panel.title"),
                              bg=UnifiedStyles.COLORS['bg_secondary'],
                              fg=UnifiedStyles.COLORS['text_primary'],
                              font=UnifiedStyles.FONTS['subheading'])
        title_label.pack(fill=tk.X, padx=UnifiedStyles.SPACING['sm'],
                        pady=UnifiedStyles.SPACING['sm'])

        # Separator
        separator = tk.Frame(nav_frame, height=1, bg=UnifiedStyles.COLORS['panel_border'])
        separator.pack(fill=tk.X, padx=UnifiedStyles.SPACING['xs'],
                      pady=UnifiedStyles.SPACING['xs'])

        # Sub-tab buttons
        self.subtab_buttons = {}

        # EXP Farming button
        exp_farming_btn = tk.Button(nav_frame,
                                    text=i18n_manager.get_ui_text("d4_panel.sub_tabs.exp_farming"),
                                    bg=UnifiedStyles.COLORS['btn_primary'],
                                    fg=UnifiedStyles.COLORS['text_primary'],
                                    font=UnifiedStyles.FONTS['button'],
                                    command=self._show_exp_farming_tab,
                                    relief=tk.FLAT,
                                    anchor='w',
                                    padx=UnifiedStyles.SPACING['sm'],
                                    pady=UnifiedStyles.SPACING['xs'])
        exp_farming_btn.pack(fill=tk.X, padx=UnifiedStyles.SPACING['xs'],
                            pady=UnifiedStyles.SPACING['xs'])
        self.subtab_buttons['exp_farming'] = exp_farming_btn

        # Set initial active button
        self._set_active_subtab('exp_farming')

    def _set_active_subtab(self, tab_name):
        """
        Set active sub-tab button styling

        Args:
            tab_name: Name of the active tab
        """
        for name, button in self.subtab_buttons.items():
            if name == tab_name:
                button.config(bg=UnifiedStyles.COLORS['accent'],
                            fg=UnifiedStyles.COLORS['text_primary'])
            else:
                button.config(bg=UnifiedStyles.COLORS['btn_primary'],
                            fg=UnifiedStyles.COLORS['text_primary'])

    def _create_content_area(self):
        """Create content area on the right"""
        # Create content container
        self.content_container = tk.Frame(self.container,
                                         bg=UnifiedStyles.COLORS['bg_primary'])
        self.content_container.grid(row=0, column=1, sticky="nsew",
                                   padx=0, pady=0)

        # Configure grid for content
        self.content_container.grid_columnconfigure(0, weight=1)
        self.content_container.grid_rowconfigure(0, weight=1)

    def _show_exp_farming_tab(self):
        """Show EXP Farming tab content"""
        # Clear existing content
        for widget in self.content_container.winfo_children():
            widget.destroy()

        # Set active button
        self._set_active_subtab('exp_farming')

        # Create EXP farming content
        self._create_exp_farming_content()

    def _create_exp_farming_content(self):
        """Create EXP Farming content area"""
        # Main frame
        main_frame = ttk.LabelFrame(self.content_container,
                                   text=i18n_manager.get_ui_text("d4_panel.exp_farming.title"),
                                   style='TLabelframe')
        main_frame.grid(row=0, column=0, sticky="nsew",
                       padx=0, pady=0)

        # Configure grid
        main_frame.grid_columnconfigure(0, weight=1)
        main_frame.grid_rowconfigure(0, weight=0)  # Control buttons
        main_frame.grid_rowconfigure(1, weight=0)  # Game status area
        main_frame.grid_rowconfigure(2, weight=0)  # Debug button area (NEW)
        main_frame.grid_rowconfigure(3, weight=1)  # Log area

        # Control buttons frame
        control_frame = tk.Frame(main_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        control_frame.grid(row=0, column=0, sticky="ew",
                          padx=UnifiedStyles.SPACING['sm'],
                          pady=UnifiedStyles.SPACING['sm'])
        control_frame.grid_columnconfigure(0, weight=1)

        # Start/Stop button (toggle)
        self.exp_farming_btn = tk.Button(control_frame,
                                        text=i18n_manager.get_ui_text("d4_panel.exp_farming.start_button"),
                                        bg=UnifiedStyles.COLORS['btn_success'],
                                        fg=UnifiedStyles.COLORS['text_primary'],
                                        font=UnifiedStyles.FONTS['button'],
                                        command=self._toggle_exp_farming)
        self.exp_farming_btn.grid(row=0, column=0, sticky="ew",
                                 padx=UnifiedStyles.SPACING['xs'],
                                 pady=UnifiedStyles.SPACING['xs'])

        # Game status frame
        self._create_game_status_area(main_frame)

        # Debug button area (NEW)
        self._create_debug_button_area(main_frame)

        # Log display frame
        log_frame = ttk.LabelFrame(main_frame,
                                  text=i18n_manager.get_ui_text("d4_panel.exp_farming.log_title"),
                                  style='TLabelframe')
        log_frame.grid(row=3, column=0, sticky="nsew",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['sm'])
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(0, weight=1)

        # Log text widget
        self.exp_farming_log = tk.Text(log_frame,
                                      bg=UnifiedStyles.COLORS['bg_primary'],
                                      fg=UnifiedStyles.COLORS['text_primary'],
                                      font=UnifiedStyles.FONTS['code'],
                                      wrap=tk.WORD,
                                      height=15,
                                      state=tk.DISABLED)

        # Scrollbar
        scrollbar = tk.Scrollbar(log_frame, orient=tk.VERTICAL,
                                command=self.exp_farming_log.yview)
        self.exp_farming_log.configure(yscrollcommand=scrollbar.set)

        # Grid layout
        self.exp_farming_log.grid(row=0, column=0, sticky="nsew",
                                 padx=(UnifiedStyles.SPACING['sm'], 0),
                                 pady=UnifiedStyles.SPACING['sm'])
        scrollbar.grid(row=0, column=1, sticky="ns",
                      padx=(0, UnifiedStyles.SPACING['sm']),
                      pady=UnifiedStyles.SPACING['sm'])

        # Add welcome message to log
        self._add_exp_farming_log(i18n_manager.get_ui_text("d4_panel.exp_farming.status.ready"))

    def _toggle_exp_farming(self):
        """Toggle EXP farming on/off"""
        # Check current state from controller
        if not self.d4_controller.is_exp_farming_running():
            self._start_exp_farming()
        else:
            self._stop_exp_farming()

    def _on_state_changed(self):
        """
        Handle D4 state changes (legacy method - now handled by UIStatusUpdater)
        """
        # State changes are now handled by UIStatusUpdater
        pass

    def _start_exp_farming(self):
        """Start EXP farming - checks team status first"""
        # Add log
        self._add_exp_farming_log("Checking team status...")
        ColorPrint.blue("[D4] Checking team status before starting EXP farming")

        # IMPORTANT: Capture screenshot first to update D4 data (window size, offset, etc.)
        # This is needed for TeamFormationChecker to correctly detect windowed mode
        from controller.d4func.screenshot_handler import ScreenshotHandler
        from share.game_interface_data import get_d4_interface_data

        screenshot_handler = ScreenshotHandler()
        d4_data = get_d4_interface_data()

        ColorPrint.blue("[D4] Capturing screenshot to initialize window data...")
        if not screenshot_handler.capture_and_collect_info(d4_data):
            ColorPrint.yellow("[D4] Failed to capture screenshot, window data may be incomplete")
        else:
            ColorPrint.green(f"[D4] Window data initialized: fullscreen={d4_data.fullscreen_size}, window={d4_data.game_window_size}, windowed={d4_data.is_windowed_mode()}")

        # Check team formation status
        from d4utils.d4_team_formation_checker import get_d4_team_formation_checker
        team_checker = get_d4_team_formation_checker()

        # Run team check
        if team_checker.run():
            # Get result from shared data
            from share.game_interface_data import get_d4_interface_data
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

        # Use controller to start (which updates state)
        self.d4_controller.start_exp_farming()

        # Update button
        self.exp_farming_btn.config(
            text=i18n_manager.get_ui_text("d4_panel.exp_farming.stop_button"),
            bg=UnifiedStyles.COLORS['btn_danger']
        )

        # Update config
        if "d4_settings" not in CONFIG:
            CONFIG["d4_settings"] = {}
        CONFIG["d4_settings"]["exp_farming_running"] = True
        save_config()

        # Add log
        self._add_exp_farming_log(f"[{i18n_manager.get_ui_text('d4_panel.exp_farming.status.running')}] EXP Farming started")
        ColorPrint.green("[D4] EXP Farming started via UI")

    def _stop_exp_farming(self):
        """Stop EXP farming"""
        # Use controller to stop (which updates state)
        self.d4_controller.stop_exp_farming()

        # Reset game status data
        self._reset_game_status_data()

        # Update button
        self.exp_farming_btn.config(
            text=i18n_manager.get_ui_text("d4_panel.exp_farming.start_button"),
            bg=UnifiedStyles.COLORS['btn_success']
        )

        # Update config
        if "d4_settings" not in CONFIG:
            CONFIG["d4_settings"] = {}
        CONFIG["d4_settings"]["exp_farming_running"] = False
        save_config()

        # Add log
        self._add_exp_farming_log(f"[{i18n_manager.get_ui_text('d4_panel.exp_farming.status.stopped')}] EXP Farming stopped")
        ColorPrint.yellow("[D4] EXP Farming stopped via UI")

    def _add_exp_farming_log(self, message):
        """
        Add log message to EXP farming log

        Args:
            message: Log message
        """
        if hasattr(self, 'exp_farming_log'):
            self.exp_farming_log.configure(state=tk.NORMAL)
            self.exp_farming_log.insert(tk.END, f"{message}\n")
            self.exp_farming_log.see(tk.END)
            self.exp_farming_log.configure(state=tk.DISABLED)

    def add_log_message(self, message, level="INFO", color=None):
        """Enqueue only D4-related messages; no Tk access. Main thread _drain_log_queue updates exp_farming_log."""
        if is_shutdown_requested():
            return
        if "[D4]" not in message and "D4" not in message:
            return
        log_queue = getattr(self, "_log_queue", None)
        if log_queue is None:
            return
        try:
            log_queue.put_nowait(message)
        except queue.Full:
            pass

    def _drain_log_queue(self):
        """Drain log queue on main thread and write to exp_farming_log."""
        log_queue = getattr(self, "_log_queue", None)
        if log_queue is None:
            return
        try:
            if not self.container.winfo_exists():
                return
            while True:
                try:
                    message = log_queue.get_nowait()
                except queue.Empty:
                    break
                self._add_exp_farming_log(message)
        except Exception:
            pass
        try:
            if self.container.winfo_exists():
                self.container.after(100, self._drain_log_queue)
        except tk.TclError:
            pass

    def _on_log_message(self, message: str, level: str = "INFO"):
        """
        Handle log messages (legacy method - now handled by UIStatusUpdater)
        """
        # Log messages are now handled by UIStatusUpdater
        pass

    def _create_game_status_area(self, parent):
        """
        Create game status display area
        
        Args:
            parent: Parent widget
        """
        # Game status frame
        status_frame = ttk.LabelFrame(parent,
                                     text=i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.title"),
                                     style='TLabelframe')
        status_frame.grid(row=1, column=0, sticky="ew",
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['sm'])
        status_frame.grid_columnconfigure(0, weight=1)
        status_frame.grid_columnconfigure(1, weight=1)
        status_frame.grid_columnconfigure(2, weight=1)
        status_frame.grid_columnconfigure(3, weight=1)
        status_frame.grid_columnconfigure(4, weight=1)

        # Status labels - Row 1
        self._create_status_label(status_frame, 0, 0, "d4_panel.exp_farming.game_status.current_map", "current_map")
        self._create_status_label(status_frame, 0, 1, "d4_panel.exp_farming.game_status.game_state", "game_state")
        self._create_status_label(status_frame, 0, 2, "d4_panel.exp_farming.game_status.team_count", "team_count")
        self._create_status_label(status_frame, 0, 3, "d4_panel.exp_farming.game_status.dungeon_progress", "dungeon_progress")
        self._create_status_label(status_frame, 0, 4, "d4_panel.exp_farming.game_status.d4_running_status", "d4_running_status")

        # Status labels - Row 2 (Screen info and map switching)
        self._create_status_label(status_frame, 1, 0, "d4_panel.exp_farming.game_status.screen_coordinates", "screen_coordinates")
        self._create_status_label(status_frame, 1, 1, "d4_panel.exp_farming.game_status.screen_size", "screen_size")
        self._create_status_label(status_frame, 1, 2, "d4_panel.exp_farming.game_status.map_switch_count", "map_switch_count")
        self._create_status_label(status_frame, 1, 3, "d4_panel.exp_farming.game_status.map_switch_state", "map_switch_state")
        self._create_status_label(status_frame, 1, 4, "d4_panel.exp_farming.game_status.reserved", "reserved_4")

        # Status labels - Row 3 (Reserved values 5-10)
        self._create_status_label(status_frame, 2, 0, "d4_panel.exp_farming.game_status.reserved", "reserved_5")
        self._create_status_label(status_frame, 2, 1, "d4_panel.exp_farming.game_status.reserved", "reserved_6")
        self._create_status_label(status_frame, 2, 2, "d4_panel.exp_farming.game_status.reserved", "reserved_7")
        self._create_status_label(status_frame, 2, 3, "d4_panel.exp_farming.game_status.reserved", "reserved_8")
        self._create_status_label(status_frame, 2, 4, "d4_panel.exp_farming.game_status.reserved", "reserved_9")

        # Initialize status values
        self._update_game_status()

    def _create_status_label(self, parent, row, column, label_key, value_key):
        """
        Create a status label with title and value
        
        Args:
            parent: Parent widget
            row: Grid row
            column: Grid column
            label_key: i18n key for label text
            value_key: Key for storing value reference
        """
        # Label frame for this status item
        item_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        item_frame.grid(row=row, column=column, sticky="ew", padx=2, pady=2)
        item_frame.grid_columnconfigure(0, weight=1)

        # Title label
        title_label = tk.Label(item_frame,
                              text=i18n_manager.get_ui_text(label_key),
                              bg=UnifiedStyles.COLORS['bg_secondary'],
                              fg=UnifiedStyles.COLORS['text_secondary'],
                              font=UnifiedStyles.FONTS['small'])
        title_label.grid(row=0, column=0, sticky="ew", padx=4, pady=(2, 0))

        # Value label
        value_label = tk.Label(item_frame,
                              text=i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.unknown"),
                              bg=UnifiedStyles.COLORS['bg_secondary'],
                              fg=UnifiedStyles.COLORS['text_primary'],
                              font=UnifiedStyles.FONTS['button'])
        value_label.grid(row=1, column=0, sticky="ew", padx=4, pady=(0, 2))

        # Store reference for dynamic updates
        if not hasattr(self, 'status_labels'):
            self.status_labels = {}
        self.status_labels[value_key] = value_label

    def _update_game_status(self):
        """
        Update game status display with current data
        """
        if not hasattr(self, 'status_labels'):
            return

        # Get D4 interface data
        from share.game_interface_data import get_d4_interface_data
        d4_data = get_d4_interface_data()

        # Update current map using unified method
        current_map = get_current_map_name_from_shared_data()
        self._update_status_value("current_map", current_map)

        # Update game state
        game_state = "Unknown"
        if self.d4_controller.is_exp_farming_running():
            game_state = i18n_manager.get_ui_text("d4_panel.exp_farming.status.running")
        else:
            game_state = i18n_manager.get_ui_text("d4_panel.exp_farming.status.stopped")
        self._update_status_value("game_state", game_state)

        # Update team count
        team_count = "0"
        local_count = "0"
        non_local_count = "0"
        if d4_data.team_health_info:
            total_members = d4_data.team_health_info.get('total_members', 0)
            local_map_count = d4_data.team_health_info.get('local_map_members', 0)
            non_local_map_count = d4_data.team_health_info.get('non_local_map_members', 0)
            team_count = str(total_members)
            local_count = str(local_map_count)
            non_local_count = str(non_local_map_count)
        
        team_display = f"{team_count} ({local_count}/{non_local_count})"
        self._update_status_value("team_count", team_display)

        # Update dungeon progress
        dungeon_progress = "Unknown"
        if d4_data.detected_regions and 'dungeon_progress' in d4_data.detected_regions:
            dungeon_progress = d4_data.detected_regions['dungeon_progress']
        self._update_status_value("dungeon_progress", dungeon_progress)

        # Update D4 running status
        d4_running_status = "Unknown"
        if self.d4_controller.is_exp_farming_running():
            d4_running_status = i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.running")
        else:
            d4_running_status = i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.stopped")
        self._update_status_value("d4_running_status", d4_running_status)

        # Update screen coordinates
        screen_coordinates = "Unknown"
        if d4_data.window_offset and d4_data.window_offset != (0, 0):
            x, y = d4_data.window_offset
            screen_coordinates = f"({x}, {y})"
        self._update_status_value("screen_coordinates", screen_coordinates)

        # Update screen size
        screen_size = "Unknown"
        if d4_data.game_window_size and d4_data.game_window_size != (0, 0):
            width, height = d4_data.game_window_size
            mode = "Windowed" if d4_data.is_windowed_mode() else "Fullscreen"
            screen_size = f"{width}x{height} ({mode})"
        self._update_status_value("screen_size", screen_size)

        # Update map switch count
        map_switch_count = d4_data.map_switch_count if hasattr(d4_data, 'map_switch_count') else 0
        self._update_status_value("map_switch_count", str(map_switch_count))

        # Update map switch state
        map_switch_state = "-"
        if hasattr(d4_data, 'is_switching_map') and d4_data.is_switching_map:
            map_switch_state = "Switching"
        elif hasattr(d4_data, 'is_post_switch_idle') and d4_data.is_post_switch_idle:
            map_switch_state = "Post-Switch"
        else:
            map_switch_state = "Normal"
        self._update_status_value("map_switch_state", map_switch_state)

        # Initialize reserved values (4-9)
        for i in range(4, 10):  # reserved_4 to reserved_9
            self._update_status_value(f"reserved_{i}", "-")

    def _update_status_value(self, key, value):
        """
        Update a status value display
        
        Args:
            key: Status key
            value: New value
        """
        if hasattr(self, 'status_labels') and key in self.status_labels:
            self.status_labels[key].config(text=str(value))

    def _reset_game_status_data(self):
        """
        Reset game status data when stopping EXP farming
        """
        # Clear D4 interface data
        from share.game_interface_data import get_d4_interface_data
        d4_data = get_d4_interface_data()
        d4_data.clear()

        # Update status display to show reset values
        self._update_game_status()

    def _register_ui_status_callback(self):
        """
        Register UI status update callback with UI status updater
        """
        try:
            from controller.d4func import get_ui_status_updater
            ui_status_updater = get_ui_status_updater()
            ui_status_updater.set_ui_update_callback(self._on_ui_status_update)
            ColorPrint.blue("[D4Panel] UI status update callback registered")
        except Exception as e:
            ColorPrint.red(f"[D4Panel] Error registering UI status callback: {e}")

    def _on_ui_status_update(self, status_data: dict):
        """
        Handle UI status update from UI status updater
        
        Args:
            status_data: Dictionary with status information
        """
        try:
            # Schedule UI update on main thread
            self.parent.after(0, lambda: self._update_status_from_data(status_data))
        except Exception as e:
            ColorPrint.red(f"[D4Panel] Error handling UI status update: {e}")

    def _update_status_from_data(self, status_data: dict):
        """
        Update status display from status data
        
        Args:
            status_data: Dictionary with status information
        """
        if not hasattr(self, 'status_labels'):
            return
        
        # Update each status value with proper i18n translation
        for key, value in status_data.items():
            translated_value = self._translate_status_value(key, value)
            self._update_status_value(key, translated_value)
    
    def _translate_status_value(self, key: str, value: str) -> str:
        """
        Translate status value based on key
        
        Args:
            key: Status key
            value: Raw value
            
        Returns:
            Translated value
        """
        # Handle special cases that need i18n translation
        if key in ['d4_running_status', 'game_state']:
            if value == "Running":
                return i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.running")
            elif value == "Stopped":
                return i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.stopped")
        
        elif key == 'screen_size' and value != "Unknown":
            # Extract mode from screen size string like "1920x1080 (Windowed)"
            if "(Windowed)" in value:
                mode = i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.windowed")
                return value.replace("(Windowed)", f"({mode})")
            elif "(Fullscreen)" in value:
                mode = i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.fullscreen")
                return value.replace("(Fullscreen)", f"({mode})")
        
        elif value == "Unknown":
            return i18n_manager.get_ui_text("d4_panel.exp_farming.game_status.unknown")
        
        # Return original value for other cases
        return value

    def _create_debug_button_area(self, parent):
        """
        Create debug button area below game status area

        Args:
            parent: Parent widget
        """
        # Debug button frame
        debug_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        debug_frame.grid(row=2, column=0, sticky="ew",
                        padx=UnifiedStyles.SPACING['sm'],
                        pady=UnifiedStyles.SPACING['xs'])
        debug_frame.grid_columnconfigure(0, weight=1)

        # Debug button
        self.debug_btn = tk.Button(debug_frame,
                                   text="Debug Images",
                                   bg=UnifiedStyles.COLORS['btn_primary'],
                                   fg=UnifiedStyles.COLORS['text_primary'],
                                   font=UnifiedStyles.FONTS['button'],
                                   command=self._toggle_debug_window,
                                   relief=tk.FLAT,
                                   padx=UnifiedStyles.SPACING['md'],
                                   pady=UnifiedStyles.SPACING['xs'])
        self.debug_btn.grid(row=0, column=0, sticky="ew",
                           padx=UnifiedStyles.SPACING['xs'],
                           pady=UnifiedStyles.SPACING['xs'])

    def _toggle_debug_window(self):
        """Toggle debug window visibility"""
        try:
            from share.game_interface_data import get_d4_interface_data
            from ui.components.debug_window import get_debug_window

            d4_data = get_d4_interface_data()

            if not d4_data.debug_window_open:
                # Open debug window
                debug_window = get_debug_window(self.parent)
                if debug_window:
                    d4_data.debug_window_open = True
                    self.debug_btn.config(bg=UnifiedStyles.COLORS['accent'])
                    ColorPrint.green("[D4Panel] Debug window opened")
                    
                    # Debug window will be automatically updated by the timer system
                    ColorPrint.blue("[D4Panel] Debug window will be updated automatically by timer")
            else:
                # Close debug window
                from ui.components.debug_window import close_debug_window
                close_debug_window()
                d4_data.debug_window_open = False
                self.debug_btn.config(bg=UnifiedStyles.COLORS['btn_primary'])
                ColorPrint.yellow("[D4Panel] Debug window closed")

        except Exception as e:
            ColorPrint.red(f"[D4Panel] Error toggling debug window: {e}")
            import traceback
            traceback.print_exc()
