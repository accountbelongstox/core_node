#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Main Functions Panel (TABLE1) - Unified Style Version
Contains skill configuration and basic info with unified styling
"""

import tkinter as tk
from tkinter import ttk
import sys
import os
from typing import Optional, Callable, Dict, Any, List

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint

# Import unified styles
from ..unified_styles import UnifiedStyles

# Import widgets and theme
from ..widgets import HotkeyInput, ThemedCheckbutton, ThemedEntry, ThemedLabel
from ..theme import UITheme

# Import i18n (global singleton instance)
from d3utils.i18n_manager import i18n_manager

# Import CONFIG and ConfigBinding
from providor.providor_index import CONFIG, CONFIG_USER_PATH, save_config
from ..utils.tk_variables import var_str, var_int
from ui.utils.config_binding import ConfigBinding

# i18n key prefix for main functions sub-tabs (aligned with providor/i18n and providor/i18n_config.json)

class MainFunctionsPanel:
    """
    Main Functions Panel for TABLE1
    Unified styling and layout
    """

    def __init__(self, parent, initial_config=None, bottom_bar=None):
        """
        Initialize main functions panel

        Args:
            parent: Parent widget
            initial_config: Initial configuration name (optional, ConfigBinding will load saved value)
            bottom_bar: BottomBar instance for updating current config display
        """
        self.parent = parent
        self.bottom_bar = bottom_bar  # Store bottom bar reference

        # Use provided initial_config or default
        # ConfigBinding will automatically load the saved value in _create_config_selection
        self.current_config = initial_config or "config1"
        self.config_vars = {}
        self.skill_vars = {}
        self.additional_vars = {}

        # KEY-VALUE pattern: Strategy mapping
        # Display: i18n multi-language text (Chinese, English, etc.)
        # Value: Fixed English keys (continuous, single, hold)
        # NOTE: This pattern ensures internal logic consistency regardless of UI language
        # All comboboxes in the UI should follow this pattern
        self.strategy_en_to_zh = {
            'continuous': i18n_manager.get_ui_text("skill_config.strategies.continuous"),
            'single': i18n_manager.get_ui_text("skill_config.strategies.single"),
            'hold': i18n_manager.get_ui_text("skill_config.strategies.hold")
        }
        self.strategy_zh_to_en = {v: k for k, v in self.strategy_en_to_zh.items()}
        
        # Configure TTK styles
        self.style = UnifiedStyles.configure_ttk_styles()
        
        # Create main container - tab main style (UnifiedStyles.TAB_PAD, same as other tab panels)
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        tab_pad = UnifiedStyles.TAB_PAD
        self.container.pack(fill=tk.BOTH, expand=True, padx=tab_pad, pady=tab_pad)
        
        # Configure grid weights
        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_columnconfigure(1, weight=1)
        self.container.grid_rowconfigure(0, weight=1)
        
        # Create content
        self.create_content()

        # Update config info
        self._update_config_info()

        # Initialize bottom bar with current config
        if self.bottom_bar:
            self.bottom_bar.update_config_status(self.current_config)

        # Note: Language change is handled by main UI, not individual panels

    def create_content(self):
        """Create panel content: skill config (left) + other settings & basic info (right)."""
        content_frame = ttk.Frame(self.container, style='Dark.TFrame')
        content_frame.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0, pady=0)
        content_frame.grid_columnconfigure(0, weight=1)
        content_frame.grid_columnconfigure(1, weight=1)
        content_frame.grid_rowconfigure(0, weight=1)

        self._create_skill_panel_in_frame(content_frame)
        self._create_basic_info_panel_in_frame(content_frame)

    def _create_skill_panel_in_frame(self, parent_frame):
        """Create skill configuration panel (left column)."""
        skill_frame = ttk.LabelFrame(parent_frame, text=i18n_manager.get_ui_text("skill_config.title"), style='TLabelframe')
        skill_frame.grid(row=0, column=0, sticky="nsew",
                        padx=(0, UnifiedStyles.SPACING['md']),
                        pady=UnifiedStyles.SPACING['sm'])

        skill_frame.grid_columnconfigure(0, weight=1)
        skill_frame.grid_rowconfigure(1, weight=1)

        self._func1_skill_frame = skill_frame

        self._create_config_selection(skill_frame)
        self._create_skill_tabs(skill_frame)

    def _create_skill_panel(self):
        """Create skill configuration panel (deprecated - use _create_skill_panel_in_frame)"""
        # Create left frame for skill configuration
        skill_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("skill_config.title"), style='TLabelframe')
        skill_frame.grid(row=0, column=0, sticky="nsew",
                        padx=(0, UnifiedStyles.SPACING['md']),
                        pady=UnifiedStyles.SPACING['sm'])
        
        # Configure skill frame grid
        skill_frame.grid_columnconfigure(0, weight=1)
        skill_frame.grid_rowconfigure(1, weight=1)
        
        # Configuration selection
        self._create_config_selection(skill_frame)
        
        # Skill configuration tabs
        self._create_skill_tabs(skill_frame)

        # Additional settings
        self._create_additional_settings(skill_frame)

    def _create_config_selection(self, parent):
        """Create configuration selection section"""
        config_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        config_frame.grid(row=0, column=0, sticky="ew",
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['sm'])
        config_frame.grid_columnconfigure(1, weight=1)

        # Config label
        config_label = tk.Label(config_frame, text=i18n_manager.get_ui_text("main_functions_panel.current_config") + ":",
                               bg=UnifiedStyles.COLORS['bg_secondary'],
                               fg=UnifiedStyles.COLORS['text_primary'],
                               font=UnifiedStyles.FONTS['label'])
        config_label.grid(row=0, column=0, sticky="w", padx=(0, UnifiedStyles.SPACING['sm']))

        # Get config values
        skill_configs = CONFIG.get("macro_configs", {}).get("skill_configs", {})
        config_values = list(skill_configs.keys()) if skill_configs else ["config1", "config2", "config3", "config4"]

        # Config combobox - use ConfigBinding for auto sync
        config_combo = ConfigBinding.create_combobox_binding(
            config_frame,
            "macro_configs.current_skill_config",
            values=config_values,
            default_value="config1",
            width=15
        )
        config_combo.grid(row=0, column=1, sticky="w", padx=UnifiedStyles.SPACING['sm'])

        # Store reference
        self.config_combo = config_combo

        # Update current_config from CONFIG (ConfigBinding has already loaded it)
        self.current_config = CONFIG.get("macro_configs", {}).get("current_skill_config", "config1")

        # Bind selection change event
        config_combo.bind('<<ComboboxSelected>>', self._on_config_changed)

    def _create_skill_tabs(self, parent):
        """Create skill configuration table"""
        # Create frame for skill configuration
        skills_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        skills_frame.grid(row=1, column=0, sticky="nsew",
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['sm'])

        # Configure grid
        skills_frame.grid_columnconfigure(1, weight=1)
        skills_frame.grid_columnconfigure(2, weight=1)
        skills_frame.grid_columnconfigure(3, weight=1)
        skills_frame.grid_columnconfigure(4, weight=1)
        skills_frame.grid_columnconfigure(5, weight=1)

        # Create header row
        headers = [
            i18n_manager.get_ui_text("skill_config.skill"),
            i18n_manager.get_ui_text("skill_config.key"),
            i18n_manager.get_ui_text("skill_config.strategy"),
            i18n_manager.get_ui_text("skill_config.interval"),
            i18n_manager.get_ui_text("skill_config.delay"),
            i18n_manager.get_ui_text("skill_config.random_delay")
        ]

        for col, header in enumerate(headers):
            header_label = tk.Label(skills_frame, text=header,
                                   bg=UnifiedStyles.COLORS['bg_secondary'],
                                   fg=UnifiedStyles.COLORS['text_primary'],
                                   font=UnifiedStyles.FONTS['label'],
                                   relief=tk.RIDGE, bd=1)
            header_label.grid(row=0, column=col, sticky="ew",
                            padx=1, pady=1)

        # Get current config
        current_config = CONFIG.get("macro_configs", {}).get("skill_configs", {}).get(self.current_config, {})
        skills_config = current_config.get("skills", {})

        # Create rows for skill1-4
        skill_keys = ["skill1", "skill2", "skill3", "skill4"]
        for i, skill_key in enumerate(skill_keys, start=1):
            self._create_skill_config_row(skills_frame, skill_key,
                                         skills_config.get(skill_key, {}), i)

        # Create additional skill settings
        self._create_additional_skill_settings(skills_frame)

        # Store the frame reference for later updates
        self.skills_config_frame = skills_frame

    def _create_skill_config_row(self, parent, skill_key, skill_data, row):
        """Create a skill configuration row with all parameters"""
        # Skill name label
        skill_name = i18n_manager.get_ui_text(f"skill_table.skills.{skill_key}")
        if skill_name == f"skill_table.skills.{skill_key}":
            skill_name = skill_key.replace("_", " ").title()

        name_label = tk.Label(parent, text=skill_name,
                             bg=UnifiedStyles.COLORS['bg_primary'],
                             fg=UnifiedStyles.COLORS['text_primary'],
                             font=UnifiedStyles.FONTS['label'],
                             relief=tk.RIDGE, bd=1)
        name_label.grid(row=row, column=0, sticky="ew", padx=1, pady=1)

        # Key input - use HotkeyInput widget
        key_value = skill_data.get('key', '')
        key_input = HotkeyInput(
            parent,
            initial_value=key_value,
            on_change=lambda hotkey: self._on_skill_param_changed(skill_key, 'key', hotkey),
            width=8
        )
        key_input.grid(row=row, column=1, sticky="ew", padx=1, pady=1)

        # Strategy combobox - KEY-VALUE pattern
        # Display: i18n text (e.g. Continuous mode)
        # Save: Fixed English key (e.g., "continuous")
        strategy_en = skill_data.get('strategy', 'continuous')
        strategy_zh = self.strategy_en_to_zh.get(strategy_en, strategy_en)
        strategy_var = var_str(parent, strategy_zh)

        # Get i18n strategy values for display
        strategy_values_zh = list(self.strategy_en_to_zh.values())

        strategy_combo = ttk.Combobox(parent, textvariable=strategy_var,
                                     values=strategy_values_zh,
                                     state='readonly', width=10)
        strategy_combo.grid(row=row, column=2, sticky="ew", padx=1, pady=1)
        strategy_combo.bind('<<ComboboxSelected>>',
                          lambda e: self._on_strategy_changed(skill_key, strategy_var.get()))

        # Interval spinbox
        interval_var = var_int(parent, skill_data.get('interval', 100))
        interval_spin = tk.Spinbox(parent, from_=0, to=10000, increment=10,
                                  textvariable=interval_var, width=8,
                                  bg=UnifiedStyles.COLORS['input_bg'],
                                  fg=UnifiedStyles.COLORS['input_text'],
                                  font=UnifiedStyles.FONTS['input'],
                                  relief=tk.RIDGE, bd=1)
        interval_spin.grid(row=row, column=3, sticky="ew", padx=1, pady=1)
        interval_var.trace_add('write', lambda *_: self._on_skill_param_changed(skill_key, 'interval', interval_var.get()))

        # Delay spinbox
        delay_var = var_int(parent, skill_data.get('delay', 0))
        delay_spin = tk.Spinbox(parent, from_=0, to=10000, increment=10,
                               textvariable=delay_var, width=8,
                               bg=UnifiedStyles.COLORS['input_bg'],
                               fg=UnifiedStyles.COLORS['input_text'],
                               font=UnifiedStyles.FONTS['input'],
                               relief=tk.RIDGE, bd=1)
        delay_spin.grid(row=row, column=4, sticky="ew", padx=1, pady=1)
        delay_var.trace_add('write', lambda *_: self._on_skill_param_changed(skill_key, 'delay', delay_var.get()))

        # Random delay spinbox
        random_delay_var = var_int(parent, skill_data.get('random_delay', 0))
        random_delay_spin = tk.Spinbox(parent, from_=0, to=10000, increment=10,
                                       textvariable=random_delay_var, width=8,
                                       bg=UnifiedStyles.COLORS['input_bg'],
                                       fg=UnifiedStyles.COLORS['input_text'],
                                       font=UnifiedStyles.FONTS['input'],
                                       relief=tk.RIDGE, bd=1)
        random_delay_spin.grid(row=row, column=5, sticky="ew", padx=1, pady=1)
        random_delay_var.trace_add('write', lambda *_: self._on_skill_param_changed(skill_key, 'random_delay', random_delay_var.get()))

        # Store variables and widgets
        self.skill_vars[f"{skill_key}_key"] = key_input  # Store widget instead of var
        self.skill_vars[f"{skill_key}_strategy"] = strategy_var
        self.skill_vars[f"{skill_key}_interval"] = interval_var
        self.skill_vars[f"{skill_key}_delay"] = delay_var
        self.skill_vars[f"{skill_key}_random_delay"] = random_delay_var

    def _on_strategy_changed(self, skill_key, strategy_zh):
        """Handle strategy change - KEY-VALUE pattern
        Convert i18n display text to fixed English key for storage
        """
        # Convert i18n display to fixed English key
        strategy_en = self.strategy_zh_to_en.get(strategy_zh, 'continuous')
        self._on_skill_param_changed(skill_key, 'strategy', strategy_en)

    def _on_skill_param_changed(self, skill_key, param_name, value):
        """Handle skill parameter change"""
        if "macro_configs" not in CONFIG:
            CONFIG["macro_configs"] = {}
        if "skill_configs" not in CONFIG["macro_configs"]:
            CONFIG["macro_configs"]["skill_configs"] = {}
        if self.current_config not in CONFIG["macro_configs"]["skill_configs"]:
            CONFIG["macro_configs"]["skill_configs"][self.current_config] = {"skills": {}}
        if "skills" not in CONFIG["macro_configs"]["skill_configs"][self.current_config]:
            CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"] = {}
        if skill_key not in CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"]:
            CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key] = {}

        if param_name in ['interval', 'delay', 'random_delay']:
            try:
                value = int(value)
            except (ValueError, tk.TclError):
                value = 0

        CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key][param_name] = value
        save_config()
        ColorPrint.blue(f"[MainFunctionsPanel] {skill_key}.{param_name} updated to: {value}")

    def _create_additional_skill_settings(self, parent):
        """Create additional skill settings (quick_switch, movement, potion)"""
        # Create a frame below the skills table
        additional_frame = tk.LabelFrame(parent,
                                        text=i18n_manager.get_ui_text("additional_settings.title"),
                                        bg=UnifiedStyles.COLORS['bg_secondary'],
                                        fg=UnifiedStyles.COLORS['text_primary'],
                                        font=UnifiedStyles.FONTS['subheading'])
        additional_frame.grid(row=5, column=0, columnspan=6, sticky="ew",
                            padx=UnifiedStyles.SPACING['sm'],
                            pady=UnifiedStyles.SPACING['sm'])
        additional_frame.grid_columnconfigure(1, weight=1)
        additional_frame.grid_columnconfigure(3, weight=1)

        current_config = CONFIG.get("macro_configs", {}).get("skill_configs", {}).get(self.current_config, {})

        # Quick switch
        quick_switch_label = tk.Label(additional_frame,
                                     text=i18n_manager.get_ui_text("additional_settings.quick_switch") + ":",
                                     bg=UnifiedStyles.COLORS['bg_secondary'],
                                     fg=UnifiedStyles.COLORS['text_primary'],
                                     font=UnifiedStyles.FONTS['label'])
        quick_switch_label.grid(row=0, column=0, sticky="w",
                               padx=UnifiedStyles.SPACING['sm'],
                               pady=UnifiedStyles.SPACING['xs'])

        quick_switch_value = current_config.get('quick_switch', 'F1')
        quick_switch_input = HotkeyInput(
            additional_frame,
            initial_value=quick_switch_value,
            on_change=lambda hotkey: self._on_skill_changed('quick_switch', hotkey),
            width=10
        )
        quick_switch_input.grid(row=0, column=1, sticky="w",
                               padx=UnifiedStyles.SPACING['sm'],
                               pady=UnifiedStyles.SPACING['xs'])

        # Movement
        movement_label = tk.Label(additional_frame,
                                 text=i18n_manager.get_ui_text("additional_settings.movement") + ":",
                                 bg=UnifiedStyles.COLORS['bg_secondary'],
                                 fg=UnifiedStyles.COLORS['text_primary'],
                                 font=UnifiedStyles.FONTS['label'])
        movement_label.grid(row=0, column=2, sticky="w",
                          padx=UnifiedStyles.SPACING['sm'],
                          pady=UnifiedStyles.SPACING['xs'])

        movement_value = current_config.get('movement', 'Space')
        movement_input = HotkeyInput(
            additional_frame,
            initial_value=movement_value,
            on_change=lambda hotkey: self._on_skill_changed('movement', hotkey),
            width=10
        )
        movement_input.grid(row=0, column=3, sticky="w",
                          padx=UnifiedStyles.SPACING['sm'],
                          pady=UnifiedStyles.SPACING['xs'])

        # Potion
        potion_label = tk.Label(additional_frame,
                               text=i18n_manager.get_ui_text("additional_settings.potion") + ":",
                               bg=UnifiedStyles.COLORS['bg_secondary'],
                               fg=UnifiedStyles.COLORS['text_primary'],
                               font=UnifiedStyles.FONTS['label'])
        potion_label.grid(row=1, column=0, sticky="w",
                        padx=UnifiedStyles.SPACING['sm'],
                        pady=UnifiedStyles.SPACING['xs'])

        potion_value = current_config.get('potion', 'Q')
        potion_input = HotkeyInput(
            additional_frame,
            initial_value=potion_value,
            on_change=lambda hotkey: self._on_skill_changed('potion', hotkey),
            width=10
        )
        potion_input.grid(row=1, column=1, sticky="w",
                        padx=UnifiedStyles.SPACING['sm'],
                        pady=UnifiedStyles.SPACING['xs'])

        # Potion interval
        potion_interval_label = tk.Label(additional_frame,
                                        text=i18n_manager.get_ui_text("additional_settings.potion_interval") + ":",
                                        bg=UnifiedStyles.COLORS['bg_secondary'],
                                        fg=UnifiedStyles.COLORS['text_primary'],
                                        font=UnifiedStyles.FONTS['label'])
        potion_interval_label.grid(row=1, column=2, sticky="w",
                                  padx=UnifiedStyles.SPACING['sm'],
                                  pady=UnifiedStyles.SPACING['xs'])

        potion_interval_var = var_int(additional_frame, current_config.get('potion_interval', 500))
        potion_interval_spin = tk.Spinbox(additional_frame, from_=0, to=10000, increment=100,
                                         textvariable=potion_interval_var, width=10,
                                         bg=UnifiedStyles.COLORS['input_bg'],
                                         fg=UnifiedStyles.COLORS['input_text'],
                                         font=UnifiedStyles.FONTS['input'])
        potion_interval_spin.grid(row=1, column=3, sticky="w",
                                 padx=UnifiedStyles.SPACING['sm'],
                                 pady=UnifiedStyles.SPACING['xs'])
        potion_interval_var.trace_add('write', lambda *_: self._on_skill_changed('potion_interval', potion_interval_var.get()))

        # Store widgets and variables
        self.skill_vars['quick_switch'] = quick_switch_input  # Store widget instead of var
        self.skill_vars['movement'] = movement_input  # Store widget instead of var
        self.skill_vars['potion'] = potion_input  # Store widget instead of var
        self.skill_vars['potion_interval'] = potion_interval_var

        # Macro options (sound, smart pause, custom stand key, current config) merged here from bottom bar; no block background
        if self.bottom_bar:
            bb = self.bottom_bar
            ThemedCheckbutton.create(
                additional_frame, text=i18n_manager.get_ui_text("options.play_sound_on_switch"),
                variable=bb.sound_var, bg_color='bg_primary', select_color='text_secondary'
            ).grid(row=2, column=0, columnspan=2, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
            ThemedCheckbutton.create(
                additional_frame, text=i18n_manager.get_ui_text("options.smart_pause"),
                variable=bb.smart_pause_var, bg_color='bg_primary', select_color='text_secondary'
            ).grid(row=2, column=2, columnspan=2, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
            custom_f = tk.Frame(additional_frame, bg=UnifiedStyles.COLORS['bg_primary'])
            custom_f.grid(row=3, column=0, columnspan=2, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
            ThemedCheckbutton.create(
                custom_f, text=i18n_manager.get_ui_text("options.use_custom_stand_key") + ":",
                variable=bb.custom_stand_var, bg_color='bg_primary', select_color='text_secondary'
            ).pack(side=tk.LEFT)
            ThemedEntry.create(custom_f, textvariable=bb.custom_stand_key_var, width=8).pack(side=tk.LEFT, padx=5)
            right_f = tk.Frame(additional_frame, bg=UnifiedStyles.COLORS['bg_primary'])
            right_f.grid(row=3, column=2, columnspan=2, sticky="e", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
            tk.Label(right_f, text=i18n_manager.get_ui_text("options.current_active_config") + " ",
                     bg=UnifiedStyles.COLORS['bg_primary'], fg=UnifiedStyles.COLORS['success'],
                     font=UnifiedStyles.FONTS['default']).pack(side=tk.LEFT)
            tk.Label(right_f, textvariable=bb.config_name_var, bg=UnifiedStyles.COLORS['bg_primary'],
                     fg=UnifiedStyles.COLORS['success'], font=UnifiedStyles.FONTS['default']).pack(side=tk.LEFT, padx=(0, 5))

    def _get_skill_key(self, skill_name):
        """Convert internationalized skill name to English key"""
        skill_mapping = {
            i18n_manager.get_ui_text("main_functions_panel.primary_skill"): "primary_skill",
            i18n_manager.get_ui_text("main_functions_panel.secondary_skill"): "secondary_skill", 
            i18n_manager.get_ui_text("main_functions_panel.defensive_skill"): "defensive_skill",
            i18n_manager.get_ui_text("main_functions_panel.ultimate_skill"): "ultimate_skill",
            i18n_manager.get_ui_text("skill_config.movement_skill"): "movement_skill",
            i18n_manager.get_ui_text("skill_config.dodge_skill"): "dodge_skill",
            i18n_manager.get_ui_text("skill_config.teleport_skill"): "teleport_skill",
            i18n_manager.get_ui_text("skill_config.healing_potion"): "healing_potion",
            i18n_manager.get_ui_text("skill_config.mana_potion"): "mana_potion",
            i18n_manager.get_ui_text("skill_config.town_portal"): "town_portal"
        }
        return skill_mapping.get(skill_name, skill_name.lower().replace(" ", "_"))

    def _get_setting_key(self, label_text):
        """Convert internationalized setting name to English key"""
        setting_mapping = {
            i18n_manager.get_ui_text("additional_settings.quick_switch"): "quick_switch",
            i18n_manager.get_ui_text("additional_settings.movement"): "movement_key",
            i18n_manager.get_ui_text("additional_settings.potion"): "potion_key"
        }
        return setting_mapping.get(label_text, label_text.lower().replace(" ", "_"))

    def _build_other_settings_rows(self, parent):
        """Build other-settings rows: animation speed, game language, macro stop hotkey. Used by right panel."""
        parent.grid_columnconfigure(1, weight=1)
        animation_speed_values = [
            i18n_manager.get_ui_text("main_functions_panel.animation_speed_slow"),
            i18n_manager.get_ui_text("main_functions_panel.animation_speed_medium"),
            i18n_manager.get_ui_text("main_functions_panel.animation_speed_fast")
        ]
        self._create_config_setting_row(parent, i18n_manager.get_ui_text("main_functions_panel.animation_speed_label"),
                                       "macro_configs.auxiliary_config.animation_speed",
                                       animation_speed_values, i18n_manager.get_ui_text("main_functions_panel.animation_speed_medium"), 0)
        game_language_values = [
            i18n_manager.get_ui_text("main_functions_panel.game_language_simplified"),
            i18n_manager.get_ui_text("main_functions_panel.game_language_traditional"),
            i18n_manager.get_ui_text("main_functions_panel.game_language_english")
        ]
        self._create_config_setting_row(parent, i18n_manager.get_ui_text("main_functions_panel.game_language_label"),
                                       "macro_configs.auxiliary_config.game_language",
                                       game_language_values, i18n_manager.get_ui_text("main_functions_panel.game_language_traditional"), 1)
        self._create_hotkey_input_row(parent,
                                      i18n_manager.get_ui_text("main_functions_panel.macro_start_hotkey_label"),
                                      "macro_configs.auxiliary_config.macro_start_hotkey", 2)

    def _create_additional_settings(self, parent):
        """Create additional settings section (legacy; other settings now merged to right panel)."""
        settings_frame = ttk.LabelFrame(parent, text=i18n_manager.get_ui_text("additional_settings.title"), style='TLabelframe')
        settings_frame.grid(row=2, column=0, sticky="ew",
                           padx=UnifiedStyles.SPACING['sm'],
                           pady=UnifiedStyles.SPACING['sm'])
        settings_frame.grid_columnconfigure(1, weight=1)
        self._build_other_settings_rows(settings_frame)

    def _create_setting_row(self, parent, label_text, default_value, values, row):
        """Create a setting row with label and combobox"""
        # Label
        label = tk.Label(parent, text=label_text,
                        bg=UnifiedStyles.COLORS['bg_secondary'],
                        fg=UnifiedStyles.COLORS['text_primary'],
                        font=UnifiedStyles.FONTS['label'])
        label.grid(row=row, column=0, sticky="w", 
                  padx=UnifiedStyles.SPACING['sm'], 
                  pady=UnifiedStyles.SPACING['xs'])
        
        # Combobox
        var = var_str(parent, default_value)
        combo = ttk.Combobox(parent, textvariable=var, values=values, 
                            state='readonly', width=10)
        combo.grid(row=row, column=1, sticky="w", 
                  padx=UnifiedStyles.SPACING['sm'], 
                  pady=UnifiedStyles.SPACING['xs'])
        
        # Store with English key name
        setting_key = self._get_setting_key(label_text)
        self.additional_vars[setting_key] = var

    def _create_config_setting_row(self, parent, label_text, config_key, values, default_value, row):
        """Create a setting row with ConfigBinding combobox"""
        # Label
        label = tk.Label(parent, text=label_text,
                        bg=UnifiedStyles.COLORS['bg_secondary'],
                        fg=UnifiedStyles.COLORS['text_primary'],
                        font=UnifiedStyles.FONTS['label'])
        label.grid(row=row, column=0, sticky="w",
                  padx=UnifiedStyles.SPACING['sm'],
                  pady=UnifiedStyles.SPACING['xs'])

        # Combobox with ConfigBinding
        combo = ConfigBinding.create_combobox_binding(
            parent, config_key, values=values, default_value=default_value, width=15
        )
        combo.grid(row=row, column=1, sticky="w",
                  padx=UnifiedStyles.SPACING['sm'],
                  pady=UnifiedStyles.SPACING['xs'])

    def _create_config_input_row(self, parent, label_text, config_key, default_value, row):
        """Create a setting row with ConfigBinding input"""
        # Label
        label = tk.Label(parent, text=label_text,
                        bg=UnifiedStyles.COLORS['bg_secondary'],
                        fg=UnifiedStyles.COLORS['text_primary'],
                        font=UnifiedStyles.FONTS['label'])
        label.grid(row=row, column=0, sticky="w",
                  padx=UnifiedStyles.SPACING['sm'],
                  pady=UnifiedStyles.SPACING['xs'])

        # Input with ConfigBinding
        entry = ConfigBinding.create_input_binding(
            parent, config_key, default_value=default_value, width=15
        )
        entry.grid(row=row, column=1, sticky="w",
                  padx=UnifiedStyles.SPACING['sm'],
                  pady=UnifiedStyles.SPACING['xs'])

    def _create_hotkey_input_row(self, parent, label_text, config_key, row):
        """Create a hotkey input row with HotkeyInput widget and ConfigBinding"""
        # Label
        label = tk.Label(parent, text=label_text,
                        bg=UnifiedStyles.COLORS['bg_secondary'],
                        fg=UnifiedStyles.COLORS['text_primary'],
                        font=UnifiedStyles.FONTS['label'])
        label.grid(row=row, column=0, sticky="w",
                  padx=UnifiedStyles.SPACING['sm'],
                  pady=UnifiedStyles.SPACING['xs'])

        # Get current value from CONFIG
        config_parts = config_key.split('.')
        current_value = CONFIG
        for part in config_parts:
            current_value = current_value.get(part, {})
        # If not found or not a string, use empty string (user will input)
        if not isinstance(current_value, str):
            current_value = ""

        # Helper function to save hotkey to CONFIG
        def on_hotkey_change(hotkey):
            # Navigate to the config location and set value
            config_parts = config_key.split('.')
            config_obj = CONFIG
            for part in config_parts[:-1]:
                if part not in config_obj:
                    config_obj[part] = {}
                config_obj = config_obj[part]
            config_obj[config_parts[-1]] = hotkey
            save_config()
            ColorPrint.blue(f"[ConfigBinding-Hotkey] {config_key} = {hotkey}")

        # HotkeyInput widget with high contrast styling passed as parameters
        hotkey_input = HotkeyInput(
            parent,
            initial_value=current_value,
            on_change=on_hotkey_change,
            width=15,
            # High contrast styling parameters
            bg=UnifiedStyles.COLORS['input_bg'],
            fg=UnifiedStyles.COLORS['input_text'],
            selectbackground=UnifiedStyles.COLORS['accent'],
            selectforeground=UnifiedStyles.COLORS['text_primary'],
            insertbackground=UnifiedStyles.COLORS['text_primary'],
            relief=tk.RIDGE,
            bd=2,
            highlightbackground=UnifiedStyles.COLORS['input_border'],
            highlightcolor=UnifiedStyles.COLORS['accent'],
            highlightthickness=2
        )
        hotkey_input.grid(row=row, column=1, sticky="w",
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['xs'])

    def _create_basic_info_panel_in_frame(self, parent_frame):
        """Create right panel: other settings (animation/language/hotkey) + basic info (Text), merged into one column."""
        right_column = tk.Frame(parent_frame, bg=UnifiedStyles.COLORS['bg_primary'])
        right_column.grid(row=0, column=1, sticky="nsew",
                         padx=(UnifiedStyles.SPACING['md'], 0),
                         pady=UnifiedStyles.SPACING['sm'])
        right_column.grid_columnconfigure(0, weight=1)
        right_column.grid_rowconfigure(0, weight=0)
        right_column.grid_rowconfigure(1, weight=1)

        # Other settings: animation speed, game language, macro stop hotkey
        other_frame = ttk.LabelFrame(right_column, text=i18n_manager.get_ui_text("additional_settings.title"), style='TLabelframe')
        other_frame.grid(row=0, column=0, sticky="ew", padx=0, pady=(0, UnifiedStyles.SPACING['sm']))
        other_frame.grid_columnconfigure(1, weight=1)
        self._build_other_settings_rows(other_frame)

        # Basic info: current config, path, skills, additional settings, status
        info_frame = ttk.LabelFrame(right_column, text=i18n_manager.get_ui_text("basic_info.title"), style='TLabelframe')
        info_frame.grid(row=1, column=0, sticky="nsew", padx=0, pady=0)
        info_frame.grid_columnconfigure(0, weight=1)
        info_frame.grid_rowconfigure(0, weight=1)
        self.info_text = tk.Text(info_frame,
                                bg=UnifiedStyles.COLORS['bg_secondary'],
                                fg=UnifiedStyles.COLORS['text_primary'],
                                font=UnifiedStyles.FONTS['code'],
                                wrap=tk.WORD,
                                height=15,
                                width=35)
        self.info_text.grid(row=0, column=0, sticky="nsew",
                            padx=UnifiedStyles.SPACING['sm'],
                            pady=UnifiedStyles.SPACING['sm'])

    def _create_basic_info_panel(self):
        """Create basic info display panel (deprecated - use _create_basic_info_panel_in_frame)"""
        info_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("basic_info.title"), style='TLabelframe')
        info_frame.grid(row=0, column=1, sticky="nsew",
                       padx=(UnifiedStyles.SPACING['sm'], 0),
                       pady=UnifiedStyles.SPACING['xs'])
        
        # Create text widget for info display
        self.info_text = tk.Text(info_frame, 
                                bg=UnifiedStyles.COLORS['bg_secondary'],
                                fg=UnifiedStyles.COLORS['text_primary'],
                                font=UnifiedStyles.FONTS['code'],
                                wrap=tk.WORD,
            height=15,
                                width=35)
        self.info_text.pack(fill=tk.BOTH, expand=True, 
                           padx=UnifiedStyles.SPACING['sm'], 
                           pady=UnifiedStyles.SPACING['sm'])

    def _update_config_info(self):
        """Update configuration info display"""
        if hasattr(self, 'info_text'):
            self.info_text.delete(1.0, tk.END)
            current_config = CONFIG.get("macro_configs", {}).get("skill_configs", {}).get(self.current_config, {})
            skills_config = current_config.get("skills", {})
            movement_key = current_config.get('movement', 'Space')
            if movement_key == 'Space':
                movement_key = i18n_manager.get_ui_text("main_functions_panel.space_key")
            info_text = f"""{i18n_manager.get_ui_text("main_functions_panel.current_config")}: {self.current_config}

{i18n_manager.get_ui_text("main_functions_panel.config_file_path")}:
{CONFIG_USER_PATH}

{i18n_manager.get_ui_text("main_functions_panel.skill_config")}:
- {i18n_manager.get_ui_text("main_functions_panel.skill1")}: {skills_config.get('skill1', {}).get('key', '1')}
- {i18n_manager.get_ui_text("main_functions_panel.skill2")}: {skills_config.get('skill2', {}).get('key', '2')}
- {i18n_manager.get_ui_text("main_functions_panel.skill3")}: {skills_config.get('skill3', {}).get('key', '3')}
- {i18n_manager.get_ui_text("main_functions_panel.skill4")}: {skills_config.get('skill4', {}).get('key', '4')}

{i18n_manager.get_ui_text("main_functions_panel.additional_settings")}:
- {i18n_manager.get_ui_text("main_functions_panel.quick_switch_key")}: {current_config.get('quick_switch', 'F1')}
- {i18n_manager.get_ui_text("main_functions_panel.movement_key")}: {movement_key}
- {i18n_manager.get_ui_text("main_functions_panel.potion_key")}: {current_config.get('potion', 'Q')}
- {i18n_manager.get_ui_text("main_functions_panel.potion_interval")}: {current_config.get('potion_interval', 500)}ms

{i18n_manager.get_ui_text("status_bar.status")}: {i18n_manager.get_ui_text("main_functions_panel.status_config_loaded")}
"""
            self.info_text.insert(1.0, info_text)

    def _on_skill_changed(self, skill_key, value):
        """Handle skill configuration change"""
        if "macro_configs" not in CONFIG:
            CONFIG["macro_configs"] = {}
        if "skill_configs" not in CONFIG["macro_configs"]:
            CONFIG["macro_configs"]["skill_configs"] = {}
        if self.current_config not in CONFIG["macro_configs"]["skill_configs"]:
            CONFIG["macro_configs"]["skill_configs"][self.current_config] = {"skills": {}}

        if skill_key in ["movement", "quick_switch", "potion", "potion_interval"]:
            if skill_key == "potion_interval":
                try:
                    value = int(value)
                except (ValueError, tk.TclError):
                    value = 500
            CONFIG["macro_configs"]["skill_configs"][self.current_config][skill_key] = value
        else:
            if "skills" not in CONFIG["macro_configs"]["skill_configs"][self.current_config]:
                CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"] = {}
            if skill_key not in CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"]:
                CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key] = {}
            CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key]["key"] = value

        save_config()
        ColorPrint.green(f"[MainFunctionsPanel] {skill_key} updated to: {value}")

    def _on_config_changed(self, event=None):
        """Handle configuration change"""
        if hasattr(self, 'config_combo'):
            new_config = self.config_combo.get()
            if new_config != self.current_config:
                self.current_config = new_config

                # ConfigBinding will auto-save, no need to manually save here

                # Update bottom bar with current config
                if self.bottom_bar:
                    self.bottom_bar.update_config_status(new_config)

                self._update_config_info()
                # Recreate skill tabs with new config
                self._recreate_skill_tabs()
                ColorPrint.green(f"[MainFunctionsPanel] Configuration changed to: {new_config}")

    def _recreate_skill_tabs(self):
        """Recreate skill configuration with updated configuration"""
        if hasattr(self, 'skills_config_frame'):
            self.skills_config_frame.destroy()
        self.skill_vars.clear()
        parent = getattr(self, '_func1_skill_frame', None)
        if parent is None:
            ColorPrint.red("[MainFunctionsPanel] _func1_skill_frame not found, skip recreate")
            return
        self._create_skill_tabs(parent)
        self._update_config_info()

# Language change is now handled by main UI - no individual panel methods needed
