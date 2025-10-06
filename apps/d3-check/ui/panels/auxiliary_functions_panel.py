#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auxiliary Functions Panel (TABLE2) - Unified Style Version
Contains auxiliary functions with unified styling
"""

import tkinter as tk
from tkinter import ttk, messagebox
import sys
import os
from typing import Optional, Callable

# Import from common_imports (unified public library imports)
from providor.common_imports import ColorPrint
from providor.providor_index import CONFIG, save_config

# Import unified styles
from ..unified_styles import UnifiedStyles

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding

class AuxiliaryFunctionsPanel:
    """
    Auxiliary Functions Panel for TABLE2
    Unified styling and layout
    """
    
    def __init__(self, parent):
        """Initialize auxiliary functions panel"""
        self.parent = parent
        self.vars = {}
        
        # Configure TTK styles
        self.style = UnifiedStyles.configure_ttk_styles()
        
        # Create main container
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        self.container.pack(fill=tk.BOTH, expand=True, 
                           padx=UnifiedStyles.SPACING['md'], 
                           pady=UnifiedStyles.SPACING['md'])
        
        # Configure grid for multi-row layout
        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_columnconfigure(1, weight=1)
        self.container.grid_rowconfigure(0, weight=1)
        self.container.grid_rowconfigure(1, weight=1)
        self.container.grid_rowconfigure(2, weight=1)
        
        # Create content
        self.create_content()

        # Note: Language change is handled by main UI, not individual panels

    def create_content(self):
        """Create panel content"""
        # Left panel - Bag offset configuration
        self._create_bag_offset_panel()
        
        # Right panel - Auxiliary functions
        self._create_auxiliary_functions_panel()

    def _create_bag_offset_panel(self):
        """Create bag offset configuration panel - First row, first column"""
        bag_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("ui.auxiliary_panel.bag_offset_title"), style='TLabelframe')
        bag_frame.grid(row=0, column=0, sticky="nsew",
                      padx=(0, UnifiedStyles.SPACING['sm']),
                      pady=UnifiedStyles.SPACING['xs'])
        
        # Configure grid
        bag_frame.grid_columnconfigure(1, weight=1)
        
        # Bag offset settings - read from CONFIG
        bag_offset_config = CONFIG.get("ui_analysis", {}).get("bag_offset", {})
        settings = [
            (i18n_manager.get_ui_text("ui.auxiliary_panel.left_offset"), "left",
             bag_offset_config.get("left", 9), -500, 500),
            (i18n_manager.get_ui_text("ui.auxiliary_panel.right_offset"), "right",
             bag_offset_config.get("right", 22), -500, 500),
            (i18n_manager.get_ui_text("ui.auxiliary_panel.top_offset"), "top",
             bag_offset_config.get("top", 0), -500, 500),
            (i18n_manager.get_ui_text("ui.auxiliary_panel.bottom_offset"), "bottom",
             bag_offset_config.get("bottom", 0), -500, 500)
        ]
        
        for i, (label_text, var_name, default, min_val, max_val) in enumerate(settings):
            self._create_spinbox_row(bag_frame, label_text, var_name, default, min_val, max_val, i)
        
        # Note: Removed bag offset test button as requested by user

    def _create_spinbox_row(self, parent, label_text, var_name, default, min_val, max_val, row):
        """Create a spinbox configuration row using ConfigBinding"""
        # Label
        label = tk.Label(parent, text=label_text,
                        bg=UnifiedStyles.COLORS['bg_secondary'],
                        fg=UnifiedStyles.COLORS['text_primary'],
                        font=UnifiedStyles.FONTS['label'])
        label.grid(row=row, column=0, sticky="w",
                  padx=UnifiedStyles.SPACING['sm'],
                  pady=UnifiedStyles.SPACING['xs'])

        # Spinbox with ConfigBinding
        config_key = f"ui_analysis.bag_offset.{var_name}"
        spinbox = ConfigBinding.create_spinbox_binding(
            parent, config_key, from_=min_val, to=max_val,
            increment=1, default_value=default, width=10,
            bg=UnifiedStyles.COLORS['input_bg'],
            fg=UnifiedStyles.COLORS['input_text'],
            font=UnifiedStyles.FONTS['input']
        )
        spinbox.grid(row=row, column=1, sticky="w",
                    padx=UnifiedStyles.SPACING['sm'],
                    pady=UnifiedStyles.SPACING['xs'])



    def _create_auxiliary_functions_panel(self):
        """Create auxiliary functions panel"""
        aux_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("ui.auxiliary_panel.auxiliary_functions"), style='TLabelframe')
        aux_frame.grid(row=0, column=1, sticky="nsew", 
                      padx=(UnifiedStyles.SPACING['sm'], 0), 
                      pady=UnifiedStyles.SPACING['xs'])
        
        # Configure grid
        aux_frame.grid_columnconfigure(0, weight=1)

        # Create automation section
        self._create_automation_section(aux_frame)

    def _create_automation_section(self, parent):
        """Create automation section"""
        auto_frame = tk.LabelFrame(parent, text=i18n_manager.get_ui_text("auxiliary_panel.automation_section_title"),
                                  bg=UnifiedStyles.COLORS['bg_secondary'],
                                  fg=UnifiedStyles.COLORS['text_primary'],
                                  font=UnifiedStyles.FONTS['subheading'])
        auto_frame.pack(fill=tk.X, padx=UnifiedStyles.SPACING['sm'], 
                       pady=UnifiedStyles.SPACING['sm'])
        
        # Auto functions using ConfigBinding
        auto_functions = [
            ("auxiliary_panel.blood_shard_enabled", "macro_configs.auxiliary_config.blood_shard.enabled", True),
            ("auxiliary_panel.quick_pickup_enabled", "macro_configs.auxiliary_config.quick_pickup.enabled", True),
            ("auxiliary_panel.blacksmith_enabled", "macro_configs.auxiliary_config.blacksmith.enabled", False),
            ("auxiliary_panel.kanai_reforge_enabled", "macro_configs.auxiliary_config.kanai_reforge.enabled", False),
            ("auxiliary_panel.kanai_upgrade_enabled", "macro_configs.auxiliary_config.kanai_upgrade.enabled", False),
            ("auxiliary_panel.kanai_convert_enabled", "macro_configs.auxiliary_config.kanai_convert.enabled", False),
            ("auxiliary_panel.drop_equipment_enabled", "macro_configs.auxiliary_config.drop_equipment.enabled", False),
            ("auxiliary_panel.sound_feedback", "macro_configs.auxiliary_config.sound_feedback", True),
            ("auxiliary_panel.smart_pause", "macro_configs.auxiliary_config.smart_pause", True)
        ]

        for i18n_key, config_key, default in auto_functions:
            check = ConfigBinding.create_checkbox_binding(
                auto_frame, config_key, text=i18n_manager.get_ui_text(i18n_key), default_value=default,
                bg=UnifiedStyles.COLORS['bg_secondary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
                activebackground=UnifiedStyles.COLORS['bg_secondary'],
                activeforeground=UnifiedStyles.COLORS['text_primary']
            )
            check.pack(anchor='w', padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['xs'])

        # Blood shard configuration
        blood_frame = tk.Frame(auto_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        blood_frame.pack(fill=tk.X, padx=UnifiedStyles.SPACING['sm'],
                        pady=UnifiedStyles.SPACING['xs'])

        blood_label = tk.Label(blood_frame, text=i18n_manager.get_ui_text("auxiliary_panel.blood_shard_count_label"),
                              bg=UnifiedStyles.COLORS['bg_secondary'],
                              fg=UnifiedStyles.COLORS['text_primary'],
                              font=UnifiedStyles.FONTS['label'])
        blood_label.pack(side=tk.LEFT)

        blood_count = ConfigBinding.create_spinbox_binding(
            blood_frame, "macro_configs.auxiliary_config.blood_shard.count",
            from_=1, to=100, increment=1, default_value=15, width=8
        )
        blood_count.pack(side=tk.LEFT, padx=(UnifiedStyles.SPACING['sm'], 0))

        blood_type_label = tk.Label(blood_frame, text=i18n_manager.get_ui_text("auxiliary_panel.blood_shard_type_label"),
                                   bg=UnifiedStyles.COLORS['bg_secondary'],
                                   fg=UnifiedStyles.COLORS['text_primary'],
                                   font=UnifiedStyles.FONTS['label'])
        blood_type_label.pack(side=tk.LEFT, padx=(UnifiedStyles.SPACING['md'], 0))

        blood_type_values = [
            i18n_manager.get_ui_text("auxiliary_panel.blood_shard_type_weapon"),
            i18n_manager.get_ui_text("auxiliary_panel.blood_shard_type_armor"),
            i18n_manager.get_ui_text("auxiliary_panel.blood_shard_type_jewelry"),
            i18n_manager.get_ui_text("auxiliary_panel.blood_shard_type_helmet"),
            i18n_manager.get_ui_text("auxiliary_panel.blood_shard_type_gloves"),
            i18n_manager.get_ui_text("auxiliary_panel.blood_shard_type_boots")
        ]
        blood_type = ConfigBinding.create_combobox_binding(
            blood_frame, "macro_configs.auxiliary_config.blood_shard.type",
            values=blood_type_values,
            default_value=i18n_manager.get_ui_text("auxiliary_panel.blood_shard_type_weapon"), width=10
        )
        blood_type.pack(side=tk.LEFT, padx=(UnifiedStyles.SPACING['sm'], 0))
        
        # Control buttons
        button_frame = tk.Frame(auto_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        button_frame.pack(fill=tk.X, padx=UnifiedStyles.SPACING['sm'], 
                         pady=UnifiedStyles.SPACING['md'])
        
        # Start button
        start_btn = tk.Button(button_frame, text=i18n_manager.get_ui_text("ui.auxiliary_panel.start"),
                             bg=UnifiedStyles.COLORS['btn_success'],
                             fg=UnifiedStyles.COLORS['text_primary'],
                             font=UnifiedStyles.FONTS['button'],
                             command=self._start_automation)
        start_btn.pack(side=tk.LEFT, padx=(0, UnifiedStyles.SPACING['sm']))
        
        # Stop button
        stop_btn = tk.Button(button_frame, text=i18n_manager.get_ui_text("ui.auxiliary_panel.stop"),
                            bg=UnifiedStyles.COLORS['btn_danger'],
                            fg=UnifiedStyles.COLORS['text_primary'],
                            font=UnifiedStyles.FONTS['button'],
                            command=self._stop_automation)
        stop_btn.pack(side=tk.LEFT)

    # Note: Removed _test_bag_offset method as requested by user

    def _start_automation(self):
        """Start automation functions"""
        enabled_functions = []
        for var_name, var in self.vars.items():
            if var_name.startswith('auto_') and var.get():
                enabled_functions.append(var_name.replace('auto_', ''))
        
        ColorPrint.print_colored(f"[AuxiliaryPanel] Starting automation: {enabled_functions}", "green")
        messagebox.showinfo(i18n_manager.get_ui_text("ui.auxiliary_panel.automation"), f"{i18n_manager.get_ui_text('ui.auxiliary_panel.automation_started')}:\n{', '.join(enabled_functions)}")

    def _stop_automation(self):
        """Stop automation functions"""
        ColorPrint.print_colored("[AuxiliaryPanel] Stopping automation", "yellow")
        messagebox.showinfo(i18n_manager.get_ui_text("ui.auxiliary_panel.automation"), i18n_manager.get_ui_text("ui.auxiliary_panel.automation_stopped"))

# Language change is now handled by main UI - no individual panel methods needed
