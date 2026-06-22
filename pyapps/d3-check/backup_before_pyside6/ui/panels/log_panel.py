#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Panel (TABLE4) - Unified Style Version
Contains log display and control functions with unified styling
"""

import re
import tkinter as tk
from tkinter import ttk, scrolledtext, filedialog
import datetime
import sys
import os
from typing import Optional, Callable

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from runtime import is_shutdown_requested

# Import unified styles
from ..unified_styles import UnifiedStyles

# Import i18n manager (global singleton instance)
from providor.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding
from providor.providor_index import CONFIG
from share.ui_registry import get_ui
from providor.constants.ui import PANEL_KEY_ROSBOT
import timers.timer_manager as timer_manager
from controller.ctl_func.blacksmith_handler import get_blacksmith_handler
from d3utils.debug_bag_hover import run_debug_bag_hover


def _strip_ui_log_prefix(msg: str) -> str:
    """Remove [ROSBOT], [ROSBOT~*s], [LogAnalyzer] prefix for UI log display."""
    return re.sub(r'^\[(?:ROSBOT|ROSBOT~[^\]]*|LogAnalyzer)\]\s*', '', msg)


class LogPanel:
    """
    Log Panel for TABLE4
    Unified styling and layout
    """
    
    def __init__(self, parent):
        """Initialize log panel"""
        self.parent = parent
        
        # Create main container - tab main style (UnifiedStyles.TAB_PAD, reused by all tab panels)
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        tab_pad = UnifiedStyles.TAB_PAD
        self.container.pack(fill=tk.BOTH, expand=True, padx=tab_pad, pady=tab_pad)
        
        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_rowconfigure(2, weight=1)
        
        self.create_content()

    def _create_test_panel(self):
        """Create test functions panel: buttons in multi-row grid, max width 100%, same style, auto-wrap."""
        test_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("log_panel.test_functions"), style='TLabelframe')
        test_frame.grid(row=0, column=0, sticky="ew", padx=UnifiedStyles.SPACING['sm'], pady=(UnifiedStyles.SPACING['sm'], 0))
        test_frame.grid_columnconfigure(0, weight=1)

        inner = tk.Frame(test_frame, bg=UnifiedStyles.COLORS['bg_primary'])
        inner.pack(fill=tk.X, expand=False, padx=UnifiedStyles.SPACING['xs'], pady=UnifiedStyles.SPACING['xs'])

        cols_per_row = 8
        for c in range(cols_per_row):
            inner.grid_columnconfigure(c, weight=1, uniform="test_btn")

        test_buttons = [
            ("log_panel.bag_test", self._test_bag),
            ("log_panel.yellow_upgrade", self._test_yellow_upgrade),
            ("log_panel.item_reforge", self._test_item_reforge),
            ("log_panel.test_pathfinding", self._test_pathfinding),
            ("auxiliary_panel.debug_blood_shard", self._debug_blood_shard),
            ("auxiliary_panel.debug_quick_pickup", self._debug_quick_pickup),
            ("auxiliary_panel.debug_blacksmith", self._debug_blacksmith),
            ("auxiliary_panel.debug_kanai_reforge", self._debug_kanai_reforge),
            ("auxiliary_panel.debug_kanai_upgrade", self._debug_kanai_upgrade),
            ("auxiliary_panel.debug_kanai_convert", self._debug_kanai_convert),
            ("auxiliary_panel.debug_auto_salvage", self._debug_auto_salvage),
            ("auxiliary_panel.debug_drop_equipment", self._debug_drop_equipment),
            ("auxiliary_panel.debug_sound_feedback", self._debug_sound_feedback),
            ("auxiliary_panel.debug_smart_pause", self._debug_smart_pause),
            ("rosbot.debug_battlenet_ui", self._debug_battlenet_ui_json),
            ("rosbot.debug_rosbot", self._debug_rosbot),
        ]

        pad_x = UnifiedStyles.SPACING['xs']
        pad_y = UnifiedStyles.SPACING['xs']
        btn_style = dict(
            bg=UnifiedStyles.COLORS['btn_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=pad_x,
            pady=2,
            relief=tk.FLAT,
            cursor='hand2',
        )
        for i, (text_key, command) in enumerate(test_buttons):
            row, col = i // cols_per_row, i % cols_per_row
            btn = tk.Button(
                inner,
                text=i18n_manager.get_ui_text(text_key),
                command=command,
                **btn_style,
            )
            btn.grid(row=row, column=col, padx=pad_x, pady=pad_y, sticky="ew")

    def create_content(self):
        """Create panel content"""
        # Test functions panel
        self._create_test_panel()

        # Control panel
        self._create_control_panel()

        # Log display
        self._create_log_display()

    def _create_control_panel(self):
        """Create log control panel"""
        control_frame = tk.Frame(self.container, bg=UnifiedStyles.COLORS['bg_secondary'])
        control_frame.grid(row=1, column=0, sticky="ew",
                          padx=UnifiedStyles.SPACING['sm'],
                          pady=(UnifiedStyles.SPACING['sm'], 0))
        control_frame.grid_columnconfigure(2, weight=1)
        
        # Clear button
        clear_btn = tk.Button(control_frame, text=i18n_manager.get_ui_text("log_panel.clear_logs"),
                             bg=UnifiedStyles.COLORS['btn_primary'],
                             fg=UnifiedStyles.COLORS['text_primary'],
                             font=UnifiedStyles.FONTS['button'],
                             command=self.clear_logs)
        clear_btn.grid(row=0, column=0, padx=(UnifiedStyles.SPACING['sm'], UnifiedStyles.SPACING['xs']))
        
        # Save button
        save_btn = tk.Button(control_frame, text=i18n_manager.get_ui_text("log_panel.save_log"),
                            bg=UnifiedStyles.COLORS['btn_primary'],
                            fg=UnifiedStyles.COLORS['text_primary'],
                            font=UnifiedStyles.FONTS['button'],
                            command=self.save_logs)
        save_btn.grid(row=0, column=1, padx=UnifiedStyles.SPACING['xs'])

        # Show DEBUG logs checkbox: when unchecked, DEBUG messages are filtered in add_log_message callback
        show_debug_check = ConfigBinding.create_checkbox_binding(
            control_frame, "log_settings.show_debug_logs",
            text=i18n_manager.get_ui_text("log_panel.show_debug_logs"), default_value=True,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
            activebackground=UnifiedStyles.COLORS['bg_secondary'],
            activeforeground=UnifiedStyles.COLORS['text_primary']
        )
        show_debug_check.grid(row=0, column=2, padx=UnifiedStyles.SPACING['sm'], sticky="w")
        
        # Auto-scroll checkbox using ConfigBinding (debug_log_latency moved to ROSBOT tab)
        auto_scroll_check = ConfigBinding.create_checkbox_binding(
            control_frame, "log_settings.auto_scroll",
            text=i18n_manager.get_ui_text("log_panel.auto_scroll"), default_value=True,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
            activebackground=UnifiedStyles.COLORS['bg_secondary'],
            activeforeground=UnifiedStyles.COLORS['text_primary']
        )
        auto_scroll_check.grid(row=0, column=3, padx=UnifiedStyles.SPACING['sm'], sticky="e")

        # Log level: dropdown only (no separate label per project rule)
        level_combo = ConfigBinding.create_combobox_binding(
            control_frame, "log_settings.log_level",
            values=['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
            default_value="INFO", width=8
        )
        level_combo.grid(row=0, column=4, padx=(UnifiedStyles.SPACING['md'], UnifiedStyles.SPACING['sm']), sticky="e")
        level_combo.bind('<<ComboboxSelected>>', self._filter_logs)

        # Store reference to the combobox for getting current value
        self.level_combo = level_combo

        # Scan button: check whether tab log area exists (container + log_text)
        scan_btn = tk.Button(
            control_frame,
            text=i18n_manager.get_ui_text("log_panel.scan_log_area"),
            bg=UnifiedStyles.COLORS['btn_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            command=self._scan_and_report_log_area,
        )
        scan_btn.grid(row=0, column=5, padx=UnifiedStyles.SPACING['sm'], sticky="e")

    def log_area_exists(self) -> tuple[bool, bool]:
        """Return (container_exists, log_text_exists) for the tab log area. Safe to call from any thread; winfo_exists on main thread only."""
        container_ok = self.container.winfo_exists() if self.container else False
        log_text_ok = self.log_text.winfo_exists() if self.log_text else False
        return (container_ok, log_text_ok)

    def _scan_and_report_log_area(self):
        """Scan and report log area existence (for debugging)."""
        container_ok, log_text_ok = self.log_area_exists()
        ColorPrint.blue(f"[LogPanel] Log area scan: container={container_ok}, log_text={log_text_ok}")

    def _create_log_display(self):
        """Create log display area"""
        log_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("log_panel.log_output"), style='TLabelframe')
        log_frame.grid(row=2, column=0, sticky="nsew",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['sm'])
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(0, weight=1)

        # Create scrolled text widget
        self.log_text = scrolledtext.ScrolledText(
            log_frame,
            wrap=tk.WORD,
            bg=UnifiedStyles.COLORS['bg_tertiary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['code'],
            state=tk.DISABLED,
            height=20
        )
        self.log_text.grid(row=0, column=0, sticky="nsew", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['sm'])

    def add_log_message(self, level: str, message: str):
        """Add a log message to the display"""
        if not hasattr(self, 'log_text') or not self.log_text.winfo_exists():
            return
        
        # Check if DEBUG logs should be shown
        show_debug = ConfigBinding.get_config_value("log_settings.show_debug_logs", True)
        if level == "DEBUG" and not show_debug:
            return
        
        # Filter combo uses DEBUG/INFO/WARNING/ERROR/ALL; map SUCCESS to INFO
        current_level = self.level_combo.get() if hasattr(self, 'level_combo') else "ALL"
        level_map = {"DEBUG": 0, "INFO": 1, "WARNING": 2, "ERROR": 3, "CRITICAL": 4}
        msg_level = level_map.get(level, 1)
        filter_level = level_map.get(current_level, 0) if current_level != "ALL" else 0
        if current_level != "ALL" and msg_level < filter_level:
            return
        
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        formatted_message = f"[{timestamp}] [{level}] {_strip_ui_log_prefix(message)}\n"
        
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, formatted_message)
        
        # Auto-scroll if enabled
        auto_scroll = ConfigBinding.get_config_value("log_settings.auto_scroll", True)
        if auto_scroll:
            self.log_text.see(tk.END)
        
        self.log_text.config(state=tk.DISABLED)

    def clear_logs(self):
        """Clear all log messages"""
        if hasattr(self, 'log_text') and self.log_text.winfo_exists():
            self.log_text.config(state=tk.NORMAL)
            self.log_text.delete(1.0, tk.END)
            self.log_text.config(state=tk.DISABLED)

    def save_logs(self):
        """Save log messages to a file"""
        if not hasattr(self, 'log_text') or not self.log_text.winfo_exists():
            return
        
        filename = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )
        
        if filename:
            try:
                with open(filename, 'w', encoding='utf-8') as f:
                    content = self.log_text.get(1.0, tk.END)
                    f.write(content)
                ColorPrint.green(f"[LogPanel] Logs saved to {filename}")
            except Exception as e:
                ColorPrint.red(f"[LogPanel] Failed to save logs: {e}")

    def _filter_logs(self, event=None):
        """Filter logs based on selected level"""
        # Log filtering is handled in add_log_message
        pass

    def _test_bag(self):
        """Test bag functionality"""
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.bag_test')}] {i18n_manager.get_ui_text('log_panel.bag_test_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.bag_test')}] {i18n_manager.get_ui_text('log_panel.bag_test_complete')}")

    def _test_yellow_upgrade(self):
        """Test yellow upgrade functionality"""
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.yellow_upgrade')}] {i18n_manager.get_ui_text('log_panel.yellow_upgrade_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.yellow_upgrade')}] {i18n_manager.get_ui_text('log_panel.yellow_upgrade_complete')}")

    def _test_item_reforge(self):
        """Test item reforge functionality"""
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.item_reforge')}] {i18n_manager.get_ui_text('log_panel.item_reforge_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.item_reforge')}] {i18n_manager.get_ui_text('log_panel.item_reforge_complete')}")

    def _test_pathfinding(self):
        """Test pathfinding functionality"""
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.test_pathfinding')}] {i18n_manager.get_ui_text('log_panel.test_pathfinding_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.test_pathfinding')}] {i18n_manager.get_ui_text('log_panel.test_pathfinding_complete')}")

    # Debug methods (moved from auxiliary panel)
    def _debug_blood_shard(self):
        """Debug blood shard functionality"""
        ColorPrint.blue("[AuxPanel] Debug: blood_shard (placeholder)")

    def _debug_quick_pickup(self):
        """Debug quick pickup functionality"""
        ColorPrint.blue("[AuxPanel] Debug: quick_pickup (placeholder)")

    def _debug_blacksmith(self):
        """Debug blacksmith functionality"""
        def on_blacksmith_debug():
            aux = (CONFIG.get("macro_configs", {}) or {}).get("auxiliary_config", {}) or {}
            keep = (aux.get("auto_salvage") or {}).get("keep", "keep_ancient_plus")
            get_blacksmith_handler().handle_auto_salvage_by_slots(keep, debug_only=False)
        timer_manager.submit_one_shot(lambda: run_debug_bag_hover(on_blacksmith_debug=on_blacksmith_debug))

    def _debug_kanai_reforge(self):
        """Debug kanai reforge functionality"""
        ColorPrint.blue("[AuxPanel] Debug: kanai_reforge (placeholder)")

    def _debug_kanai_upgrade(self):
        """Debug kanai upgrade functionality"""
        def on_blacksmith_debug():
            aux = (CONFIG.get("macro_configs", {}) or {}).get("auxiliary_config", {}) or {}
            keep = (aux.get("auto_salvage") or {}).get("keep", "keep_ancient_plus")
            get_blacksmith_handler().handle_auto_salvage_by_slots(keep, debug_only=False)
        timer_manager.submit_one_shot(lambda: run_debug_bag_hover(on_blacksmith_debug=on_blacksmith_debug))

    def _debug_kanai_convert(self):
        """Debug kanai convert functionality"""
        ColorPrint.blue("[AuxPanel] Debug: kanai_convert (placeholder)")

    def _debug_auto_salvage(self):
        """Debug auto salvage functionality"""
        ColorPrint.blue("[AuxPanel] Debug: auto_salvage (placeholder)")

    def _debug_drop_equipment(self):
        """Debug drop equipment functionality"""
        ColorPrint.blue("[AuxPanel] Debug: drop_equipment (placeholder)")

    def _debug_sound_feedback(self):
        """Debug sound feedback functionality"""
        ColorPrint.blue("[AuxPanel] Debug: sound_feedback (placeholder)")

    def _debug_smart_pause(self):
        """Debug smart pause functionality"""
        ColorPrint.blue("[AuxPanel] Debug: smart_pause (placeholder)")

    def _debug_battlenet_ui_json(self):
        """Delegate to ROSBOT panel: export Battle.net UI to JSON (moved from ROSBOT tab)."""
        ui = get_ui()
        if ui:
            panel = ui.get_panel(PANEL_KEY_ROSBOT)
            if panel and hasattr(panel, '_debug_battlenet_ui_json'):
                panel._debug_battlenet_ui_json()

    def _debug_rosbot(self):
        """Delegate to ROSBOT panel: debug ROSBOT (moved from ROSBOT tab)."""
        ui = get_ui()
        if ui:
            panel = ui.get_panel(PANEL_KEY_ROSBOT)
            if panel and hasattr(panel, '_debug_rosbot'):
                panel._debug_rosbot()

# Language change is now handled by main UI - no individual panel methods needed
