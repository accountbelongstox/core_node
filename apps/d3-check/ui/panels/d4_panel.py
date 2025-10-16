#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Functions Panel - Unified Style Version
Contains D4-specific automation features with unified styling
"""

import tkinter as tk
from tkinter import ttk
import sys
import os

# Import unified styles
from ..unified_styles import UnifiedStyles

# Import from common_imports
from providor.common_imports import ColorPrint

# Import CONFIG from providor
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))
from providor.providor_index import CONFIG, save_config

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager

# Import D4 controller and state
from controller.d4_controller import get_d4_controller
from d4utils.d4_state import get_d4_state


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

        # Get D4 controller and state
        self.d4_controller = get_d4_controller()
        self.d4_state = get_d4_state()

        # Register state change callback
        self.d4_state.add_callback(self._on_state_changed)

        # Create main container with 2-column grid layout
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        self.container.pack(fill=tk.BOTH, expand=True,
                           padx=UnifiedStyles.SPACING['md'],
                           pady=UnifiedStyles.SPACING['md'])

        # Configure grid - 2 columns: left for sub-tab navigation, right for content
        self.container.grid_columnconfigure(0, weight=0, minsize=120)  # Sub-tab column (fixed width)
        self.container.grid_columnconfigure(1, weight=1)  # Content column (expandable)
        self.container.grid_rowconfigure(0, weight=1)

        # Create content
        self.create_content()

        # Register as ColorPrint callback for D4-specific logs
        ColorPrint.register_callback(self.add_log_message)

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
        main_frame.grid_rowconfigure(1, weight=1)  # Log area

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

        # Log display frame
        log_frame = ttk.LabelFrame(main_frame,
                                  text=i18n_manager.get_ui_text("d4_panel.exp_farming.log_title"),
                                  style='TLabelframe')
        log_frame.grid(row=1, column=0, sticky="nsew",
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
        Handle D4 state changes

        Called by D4State when state changes (e.g., new screenshot saved)
        Must schedule UI updates on main thread to avoid threading issues
        """
        try:
            # Get latest state
            state_dict = self.d4_state.get_state_dict()

            # Check if new screenshot was saved
            screenshot_path = state_dict.get("last_screenshot_path")
            if screenshot_path:
                # Schedule UI update on main thread
                self.container.after(0, lambda: self._add_exp_farming_log(f"Screenshot: {screenshot_path}"))

        except Exception as e:
            ColorPrint.red(f"[D4Panel] Error handling state change: {e}")

    def _start_exp_farming(self):
        """Start EXP farming"""
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
        """
        Add a log message to the appropriate log display

        Args:
            message: Log message
            level: Log level
            color: Color hint (optional)
        """
        # Filter D4-related messages to this panel's log
        if "[D4]" in message or "D4" in message:
            self._add_exp_farming_log(message)
