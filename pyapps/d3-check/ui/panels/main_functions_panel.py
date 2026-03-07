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
from ..widgets import HotkeyInput, ThemedCheckbutton, ThemedCombobox, ThemedEntry, ThemedLabel
from ..theme import UITheme

# Import i18n (global singleton instance)
from providor.i18n_manager import i18n_manager

# Import CONFIG and ConfigBinding
from providor.providor_index import CONFIG, CONFIG_USER_PATH, queue_config_save, get_config_value_safe
from ..utils.tk_variables import var_str, var_int
from ui.utils.config_binding import ConfigBinding
from ui.components.auxiliary_options_block import create_auxiliary_options_block
from share.values.config_change_hub import get_config_change_hub
from share.values.skill_config_hotkeys import PER_CONFIG_HOTKEY_SPEC, get_per_config_hotkey_keys
from d3utils.d3u_common.hotkey_registry import (
    HOTKEY_CONFIG_PATH_AUXILIARY,
    CONFIG_KEY_MACRO_START_HOTKEY,
    CONFIG_KEY_ASSISTANT_HOTKEY,
    normalize_hotkey_canonical,
)

# i18n key prefix for main functions sub-tabs (aligned with providor/i18n and providor/i18n_config.json)

# Skill table row order: skills 1-4, left click, right click, potion (potion = one row: key/strategy/interval/delay/random_delay, default key Q)
SKILL_TABLE_KEYS = ("skill1", "skill2", "skill3", "skill4", "left_click", "right_click", "potion")


def _parse_int_from_ui(value, default: int) -> int:
    """Parse int from UI binding without using try/except. Returns default when invalid."""
    if isinstance(value, int):
        return value
    s = str(value).strip()
    if not s or not s.lstrip("-").isdigit():
        return default
    return int(s)


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
        self.info_text = None
        self.config_combo = None
        self.skills_config_frame = None
        self._func1_skill_frame = None

        # Use provided initial_config or default
        # ConfigBinding will automatically load the saved value in _create_config_selection
        self.current_config = initial_config or "config1"
        self.config_vars = {}
        self.skill_vars = {}
        self.additional_vars = {}
        self._skill_config_switch_callback: Optional[Callable[[str], None]] = None

        # KEY-VALUE pattern: Strategy mapping
        # Display: i18n multi-language text (Chinese, English, etc.)
        # Value: Fixed English keys (continuous, single, hold)
        # NOTE: This pattern ensures internal logic consistency regardless of UI language
        # All comboboxes in the UI should follow this pattern
        self.strategy_en_to_zh = {
            'continuous': i18n_manager.get_ui_text("skill_config.strategies.continuous"),
            'single': i18n_manager.get_ui_text("skill_config.strategies.single"),
            'hold': i18n_manager.get_ui_text("skill_config.strategies.hold"),
            'ignore': i18n_manager.get_ui_text("skill_config.strategies.ignore"),
        }
        self.strategy_zh_to_en = {v: k for k, v in self.strategy_en_to_zh.items()}
        
        # ttk styles: single source from UITheme.apply_to_root (no second configure_ttk_styles here; see docs/ui2)
        
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

        # Initialize bottom bar with current config (bottom_bar always passed by main window)
        self.bottom_bar.update_config_status(self.current_config)

        # Note: Language change is handled by main UI, not individual panels

    def create_content(self):
        """Create panel content: top 70% = left (skill config) + right (basic info), bottom = bar spanning both columns."""
        content_frame = ttk.Frame(self.container, style='Dark.TFrame')
        content_frame.grid(row=0, column=0, columnspan=2, sticky="nsew", padx=0, pady=0)
        content_frame.grid_columnconfigure(0, weight=1)
        content_frame.grid_columnconfigure(1, weight=1)
        content_frame.grid_rowconfigure(0, weight=7)   # 70% height: left and right columns
        content_frame.grid_rowconfigure(1, weight=3)   # 30% height: bottom bar

        self._create_skill_panel_in_frame(content_frame)
        self._create_basic_info_panel_in_frame(content_frame)
        self._create_bottom_bar_in_frame(content_frame)

    def _create_skill_panel_in_frame(self, parent_frame):
        """Create skill configuration panel (left column). No label title per requirement."""
        skill_frame = ttk.Frame(parent_frame)
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
        skill_frame = ttk.Frame(self.container)
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
        """Create configuration selection section. Combobox shows i18n display names; CONFIG stores config1..config4."""
        config_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        config_frame.grid(row=0, column=0, sticky="ew",
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['sm'])
        config_frame.grid_columnconfigure(1, weight=1)

        skill_configs = get_config_value_safe("macro_configs.skill_configs", {}) or {}
        self._config_keys = list(skill_configs.keys()) if isinstance(skill_configs, dict) and skill_configs else ["config1", "config2", "config3", "config4"]
        self._config_display_values = [i18n_manager.get_ui_text("config_tabs." + k, default=k) for k in self._config_keys]
        current_key = get_config_value_safe("macro_configs.current_skill_config", "config1")
        if current_key not in self._config_keys:
            current_key = self._config_keys[0] if self._config_keys else "config1"
        current_index = self._config_keys.index(current_key)
        config_display_var = var_str(config_frame, self._config_display_values[current_index])
        config_combo = ThemedCombobox.create(
            config_frame, textvariable=config_display_var, values=self._config_display_values,
            state="readonly", width=15
        )
        config_combo.grid(row=0, column=0, sticky="w", padx=(0, UnifiedStyles.SPACING['sm']))

        def _on_config_combo_select(event=None):
            display = config_display_var.get()
            idx = self._config_display_values.index(display) if display in self._config_display_values else 0
            new_key = self._config_keys[idx]
            ConfigBinding.set_config_value("macro_configs.current_skill_config", new_key)
            self._on_config_changed_with_key(new_key)

        config_combo.bind("<<ComboboxSelected>>", _on_config_combo_select)

        self._current_config_display_frame = tk.Frame(config_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        self._current_config_display_frame.grid(row=0, column=1, sticky="w", padx=(UnifiedStyles.SPACING['md'], 0))
        tk.Label(
            self._current_config_display_frame,
            text=i18n_manager.get_ui_text("main_functions_panel.current_config") + ": ",
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['label']
        ).pack(side=tk.LEFT)
        tk.Label(
            self._current_config_display_frame,
            textvariable=self.bottom_bar.config_name_var,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['success'],
            font=UnifiedStyles.FONTS['default']
        ).pack(side=tk.LEFT)

        self.config_combo = config_combo
        self._config_display_var = config_display_var
        self.current_config = current_key
        self.bottom_bar.update_config_status(current_key)

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

        # Get current config from CONFIG (thread-safe); structure ensured by fix_config_with_template on load
        skill_configs = get_config_value_safe("macro_configs.skill_configs", {}) or {}
        current_config = skill_configs.get(self.current_config, {}) if isinstance(skill_configs, dict) else {}
        skills_config = current_config.get("skills", {}) or {}

        # Create rows from SKILL_TABLE_KEYS (potion row: key Q / strategy / interval / delay / random_delay)
        _mouse_default = {"key": "", "strategy": "ignore", "interval": 100, "delay": 0, "random_delay": 0}
        _potion_default = {"key": "Q", "strategy": "ignore", "interval": 100, "delay": 0, "random_delay": 0}
        for i, skill_key in enumerate(SKILL_TABLE_KEYS, start=1):
            if skill_key in ("left_click", "right_click"):
                default = _mouse_default
            elif skill_key == "potion":
                default = _potion_default
            else:
                default = {}
            skill_data = skills_config.get(skill_key) or default
            self._create_skill_config_row(skills_frame, skill_key, skill_data, i)

        # Store the frame reference for later updates (hotkeys and options moved to bottom bar _create_bottom_bar_in_frame)
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

        # Key column: HotkeyInput for skill1-4 and potion; fixed label for left_click/right_click (no key binding)
        if skill_key in ("left_click", "right_click"):
            key_label_text = i18n_manager.get_ui_text(f"skill_table.key_{skill_key}")
            key_widget = tk.Label(
                parent, text=key_label_text,
                bg=UnifiedStyles.COLORS['bg_primary'],
                fg=UnifiedStyles.COLORS['text_secondary'],
                font=UnifiedStyles.FONTS['label'],
                relief=tk.FLAT,
            )
            key_widget.grid(row=row, column=1, sticky="ew", padx=1, pady=1)
        else:
            key_default = "Q" if skill_key == "potion" else ""
            key_value = skill_data.get("key") or key_default
            key_widget = HotkeyInput(
                parent,
                initial_value=key_value,
                on_change=lambda hotkey: self._on_skill_param_changed(skill_key, 'key', hotkey),
                width=8
            )
            key_widget.grid(row=row, column=1, sticky="ew", padx=1, pady=1)

        # Strategy combobox - KEY-VALUE pattern
        # Display: i18n text (e.g. Continuous mode)
        # Save: Fixed English key (e.g., "continuous")
        strategy_en = skill_data.get('strategy', 'continuous')
        strategy_zh = self.strategy_en_to_zh.get(strategy_en, strategy_en)
        strategy_var = var_str(parent, strategy_zh)

        # Get i18n strategy values for display
        strategy_values_zh = list(self.strategy_en_to_zh.values())

        strategy_combo = ThemedCombobox.create(parent, textvariable=strategy_var,
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
        self.skill_vars[f"{skill_key}_key"] = key_widget  # Store widget (HotkeyInput or Label)
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
            value = _parse_int_from_ui(value, 0)

        CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key][param_name] = value
        queue_config_save()
        get_config_change_hub().notify_config_changed("macro_configs.skill_configs")
        ColorPrint.blue(f"[MainFunctionsPanel] {skill_key}.{param_name} updated to: {value}")

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
            i18n_manager.get_ui_text("additional_settings.potion"): "potion_key",
            i18n_manager.get_ui_text("additional_settings.water"): "water_key"
        }
        return setting_mapping.get(label_text, label_text.lower().replace(" ", "_"))

    def _build_other_settings_rows(self, parent):
        """Build other-settings rows: animation speed, game language (dropdown only, no separate label per project rule)."""
        parent.grid_columnconfigure(0, weight=1)
        animation_speed_values = [
            i18n_manager.get_ui_text("main_functions_panel.animation_speed_slow"),
            i18n_manager.get_ui_text("main_functions_panel.animation_speed_medium"),
            i18n_manager.get_ui_text("main_functions_panel.animation_speed_fast")
        ]
        self._create_config_combo_only_row(parent, "macro_configs.auxiliary_config.animation_speed",
                                         animation_speed_values, i18n_manager.get_ui_text("main_functions_panel.animation_speed_medium"), 0)
        game_language_values = [
            i18n_manager.get_ui_text("main_functions_panel.game_language_simplified"),
            i18n_manager.get_ui_text("main_functions_panel.game_language_traditional"),
            i18n_manager.get_ui_text("main_functions_panel.game_language_english")
        ]
        self._create_config_combo_only_row(parent, "macro_configs.auxiliary_config.game_language",
                                         game_language_values, i18n_manager.get_ui_text("main_functions_panel.game_language_traditional"), 1)
        # Combat macro / assistant macro hotkeys are in shortcut area (combat above assistant)

    def _create_additional_settings(self, parent):
        """Create additional settings section (legacy; other settings now merged to right panel). No label title per requirement."""
        settings_frame = ttk.Frame(parent)
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
        
        # Combobox (reuse ThemedCombobox component)
        var = var_str(parent, default_value)
        combo = ThemedCombobox.create(parent, textvariable=var, values=values,
                                     state='readonly', width=10)
        combo.grid(row=row, column=1, sticky="w", 
                  padx=UnifiedStyles.SPACING['sm'], 
                  pady=UnifiedStyles.SPACING['xs'])
        
        # Store with English key name
        setting_key = self._get_setting_key(label_text)
        self.additional_vars[setting_key] = var

    def _create_config_combo_only_row(self, parent, config_key, values, default_value, row):
        """Create a setting row with ConfigBinding combobox only (no label per project rule)."""
        combo = ConfigBinding.create_combobox_binding(
            parent, config_key, values=values, default_value=default_value, width=15
        )
        combo.grid(row=row, column=0, sticky="ew",
                  padx=UnifiedStyles.SPACING['sm'],
                  pady=UnifiedStyles.SPACING['xs'])

    def _create_config_setting_row(self, parent, label_text, config_key, values, default_value, row):
        """Create a setting row with ConfigBinding combobox (label + combo; use _create_config_combo_only_row when integrating label into dropdown)."""
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

        # Helper function to save hotkey to CONFIG; notify hub so hotkey listener rebinds immediately
        def on_hotkey_change(hotkey):
            config_parts = config_key.split('.')
            config_obj = CONFIG
            for part in config_parts[:-1]:
                if part not in config_obj:
                    config_obj[part] = {}
                config_obj = config_obj[part]
            config_obj[config_parts[-1]] = hotkey
            queue_config_save()
            get_config_change_hub().notify_config_changed(config_key)
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
        """Create right panel: other settings (animation/language/hotkey) + auxiliary function area (blank area, replaced basic info)."""
        right_column = tk.Frame(parent_frame, bg=UnifiedStyles.COLORS['bg_primary'])
        right_column.grid(row=0, column=1, sticky="nsew",
                         padx=(UnifiedStyles.SPACING['md'], 0),
                         pady=UnifiedStyles.SPACING['sm'])
        right_column.grid_columnconfigure(0, weight=1)
        right_column.grid_rowconfigure(0, weight=1)

        # Auxiliary function area only (animation speed and game language areas removed)
        aux_frame = ttk.Frame(right_column)
        aux_frame.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        aux_frame.grid_columnconfigure(0, weight=1)
        aux_frame.grid_rowconfigure(0, weight=1)
        create_auxiliary_options_block(aux_frame)
        self.info_text = None

    def _create_bottom_bar_in_frame(self, parent_frame):
        """Bottom bar spanning both columns: multi-row layout, hotkey settings (each item one row or separate columns)."""
        bar_frame = tk.Frame(parent_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        bar_frame.grid(row=1, column=0, columnspan=2, sticky="nsew",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['sm'])
        bar_frame.grid_columnconfigure(1, weight=1)
        bar_frame.grid_columnconfigure(3, weight=1)

        _sc = get_config_value_safe("macro_configs.skill_configs", {}) or {}
        current_config = _sc.get(self.current_config, {}) if isinstance(_sc, dict) else {}

        def _on_macro_start_hotkey_change(hotkey):
            c = CONFIG.get("macro_configs", {})
            if "auxiliary_config" not in c:
                c["auxiliary_config"] = {}
            c["auxiliary_config"][CONFIG_KEY_MACRO_START_HOTKEY] = hotkey
            queue_config_save()
            get_config_change_hub().notify_config_changed(HOTKEY_CONFIG_PATH_AUXILIARY)

        def _on_assistant_hotkey_change(hotkey):
            c = CONFIG.get("macro_configs", {})
            if "auxiliary_config" not in c:
                c["auxiliary_config"] = {}
            c["auxiliary_config"][CONFIG_KEY_ASSISTANT_HOTKEY] = hotkey
            queue_config_save()
            get_config_change_hub().notify_config_changed(HOTKEY_CONFIG_PATH_AUXILIARY)

        _start_val = normalize_hotkey_canonical(
            (CONFIG.get("macro_configs", {}).get("auxiliary_config", {}).get("macro_start_hotkey") or "")
        )
        _aux_val = normalize_hotkey_canonical(
            (CONFIG.get("macro_configs", {}).get("auxiliary_config", {}).get("assistant_hotkey") or "")
        )

        # Row 0: combat macro start/stop hotkey
        tk.Label(bar_frame, text=i18n_manager.get_ui_text("main_functions_panel.macro_start_hotkey_label") + ":",
                 bg=UnifiedStyles.COLORS['bg_secondary'], fg=UnifiedStyles.COLORS['text_primary'],
                 font=UnifiedStyles.FONTS['label']).grid(row=0, column=0, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        HotkeyInput(bar_frame, initial_value=_start_val, on_change=_on_macro_start_hotkey_change, width=10,
                    bg=UnifiedStyles.COLORS['input_bg'], fg=UnifiedStyles.COLORS['input_text'],
                    selectbackground=UnifiedStyles.COLORS['accent'], selectforeground=UnifiedStyles.COLORS['text_primary'],
                    insertbackground=UnifiedStyles.COLORS['text_primary'], relief=tk.RIDGE, bd=2,
                    highlightbackground=UnifiedStyles.COLORS['input_border'], highlightcolor=UnifiedStyles.COLORS['accent'],
                    highlightthickness=2).grid(row=0, column=1, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])

        # Row 1: assistant macro start/stop hotkey
        tk.Label(bar_frame, text=i18n_manager.get_ui_text("main_functions_panel.macro_pause_hotkey_label") + ":",
                 bg=UnifiedStyles.COLORS['bg_secondary'], fg=UnifiedStyles.COLORS['text_primary'],
                 font=UnifiedStyles.FONTS['label']).grid(row=1, column=0, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        HotkeyInput(bar_frame, initial_value=_aux_val, on_change=_on_assistant_hotkey_change, width=10,
                    bg=UnifiedStyles.COLORS['input_bg'], fg=UnifiedStyles.COLORS['input_text'],
                    selectbackground=UnifiedStyles.COLORS['accent'], selectforeground=UnifiedStyles.COLORS['text_primary'],
                    insertbackground=UnifiedStyles.COLORS['text_primary'], relief=tk.RIDGE, bd=2,
                    highlightbackground=UnifiedStyles.COLORS['input_border'], highlightcolor=UnifiedStyles.COLORS['accent'],
                    highlightthickness=2).grid(row=1, column=1, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])

        # Row 2: quick switch
        tk.Label(bar_frame, text=i18n_manager.get_ui_text("additional_settings.quick_switch") + ":",
                 bg=UnifiedStyles.COLORS['bg_secondary'], fg=UnifiedStyles.COLORS['text_primary'],
                 font=UnifiedStyles.FONTS['label']).grid(row=2, column=0, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        quick_switch_inp = HotkeyInput(bar_frame,
            initial_value=current_config.get('quick_switch', 'F1'),
            on_change=lambda h: self._on_skill_changed('quick_switch', h),
            width=10, bg=UnifiedStyles.COLORS['input_bg'], fg=UnifiedStyles.COLORS['input_text'],
            selectbackground=UnifiedStyles.COLORS['accent'], selectforeground=UnifiedStyles.COLORS['text_primary'],
            insertbackground=UnifiedStyles.COLORS['text_primary'], relief=tk.RIDGE, bd=2,
            highlightbackground=UnifiedStyles.COLORS['input_border'], highlightcolor=UnifiedStyles.COLORS['accent'],
            highlightthickness=2)
        quick_switch_inp.grid(row=2, column=1, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        self.skill_vars['quick_switch'] = quick_switch_inp

        # Row 3: play sound, smart pause, custom stand key (same row, option-style)
        bb = self.bottom_bar
        opt_row = 3
        ThemedCheckbutton.create(bar_frame, text=i18n_manager.get_ui_text("options.play_sound_on_switch"),
            variable=bb.sound_var, bg_color='bg_secondary', select_color='text_secondary'
        ).grid(row=opt_row, column=0, columnspan=2, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        ThemedCheckbutton.create(bar_frame, text=i18n_manager.get_ui_text("options.smart_pause"),
            variable=bb.smart_pause_var, bg_color='bg_secondary', select_color='text_secondary'
        ).grid(row=opt_row, column=2, columnspan=2, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        custom_f = tk.Frame(bar_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        custom_f.grid(row=opt_row, column=4, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        ThemedCheckbutton.create(custom_f, text=i18n_manager.get_ui_text("options.use_custom_stand_key") + ":",
            variable=bb.custom_stand_var, bg_color='bg_secondary', select_color='text_secondary'
        ).pack(side=tk.LEFT)
        ThemedEntry.create(custom_f, textvariable=bb.custom_stand_key_var, width=8).pack(side=tk.LEFT, padx=5)

    def _create_basic_info_panel(self):
        """Create basic info display panel (deprecated - use _create_basic_info_panel_in_frame). No label title per requirement."""
        info_frame = ttk.Frame(self.container)
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
        """Update configuration info display (info_text created in create_content). No-op when right panel is auxiliary area (no info_text)."""
        if self.info_text is None:
            return
        self.info_text.delete(1.0, tk.END)
        _sc = get_config_value_safe("macro_configs.skill_configs", {}) or {}
        current_config = _sc.get(self.current_config, {}) if isinstance(_sc, dict) else {}
        skills_config = (current_config or {}).get("skills", {}) or {}
        extra_lines = "\n".join(
            f"- {i18n_manager.get_ui_text('main_functions_panel.' + key + '_key')}: {current_config.get(key, default)}"
            for key, default in PER_CONFIG_HOTKEY_SPEC
        )
        info_text = f"""{i18n_manager.get_ui_text("main_functions_panel.current_config")}: {self.current_config}

{i18n_manager.get_ui_text("main_functions_panel.config_file_path")}:
{CONFIG_USER_PATH}

{i18n_manager.get_ui_text("main_functions_panel.skill_config")}:
- {i18n_manager.get_ui_text("main_functions_panel.skill1")}: {skills_config.get('skill1', {}).get('key', '1')}
- {i18n_manager.get_ui_text("main_functions_panel.skill2")}: {skills_config.get('skill2', {}).get('key', '2')}
- {i18n_manager.get_ui_text("main_functions_panel.skill3")}: {skills_config.get('skill3', {}).get('key', '3')}
- {i18n_manager.get_ui_text("main_functions_panel.skill4")}: {skills_config.get('skill4', {}).get('key', '4')}
- {i18n_manager.get_ui_text("skill_table.skills.potion")}: {skills_config.get('potion', {}).get('key', 'Q')}

{i18n_manager.get_ui_text("main_functions_panel.additional_settings")}:
{extra_lines}

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

        if skill_key in get_per_config_hotkey_keys():
            CONFIG["macro_configs"]["skill_configs"][self.current_config][skill_key] = value
        else:
            if "skills" not in CONFIG["macro_configs"]["skill_configs"][self.current_config]:
                CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"] = {}
            if skill_key not in CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"]:
                CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key] = {}
            CONFIG["macro_configs"]["skill_configs"][self.current_config]["skills"][skill_key]["key"] = value

        queue_config_save()
        get_config_change_hub().notify_config_changed("macro_configs.skill_configs")
        ColorPrint.green(f"[MainFunctionsPanel] {skill_key} updated to: {value}")

    def set_skill_config_switch_callback(self, callback: Callable[[str], None]) -> None:
        """Set callback when user switches current skill config (config combo)."""
        self._skill_config_switch_callback = callback

    def _on_config_changed_with_key(self, new_config: str):
        """Handle configuration change by config key (config1..config4). Updates label, skills, callbacks."""
        if new_config != self.current_config:
            self.current_config = new_config
            self.bottom_bar.update_config_status(new_config)
            self._update_config_info()
            if self.skills_config_frame and self.skills_config_frame.winfo_exists() and self.skill_vars:
                self._update_skill_tabs_content()
            else:
                self._recreate_skill_tabs()
            if self._skill_config_switch_callback:
                self._skill_config_switch_callback(new_config)
            ColorPrint.green(f"[MainFunctionsPanel] Configuration changed to: {new_config}")

    def _on_config_changed(self, event=None):
        """Legacy: handle config change when combo value is raw key. Prefer _on_config_changed_with_key from combobox select."""
        new_config = self.config_combo.get()
        if new_config in getattr(self, "_config_keys", ()):
            self._on_config_changed_with_key(new_config)
        elif new_config in getattr(self, "_config_display_values", ()):
            idx = self._config_display_values.index(new_config)
            self._on_config_changed_with_key(self._config_keys[idx])

    def _update_skill_tabs_content(self):
        """Refresh skill tab widgets from CONFIG for current_config (no destroy/recreate, minimal redraw)."""
        _sc = get_config_value_safe("macro_configs.skill_configs", {}) or {}
        cfg = _sc.get(self.current_config, {}) if isinstance(_sc, dict) else {}
        skills_data = cfg.get("skills", {})
        for skill_key in SKILL_TABLE_KEYS:
            data = skills_data.get(skill_key, {})
            key_widget = self.skill_vars.get(f"{skill_key}_key")
            if key_widget is not None and skill_key not in ("left_click", "right_click"):
                default_key = "Q" if skill_key == "potion" else ""
                key_widget.set_hotkey(data.get("key", default_key))
            strategy_var = self.skill_vars.get(f"{skill_key}_strategy")
            if strategy_var is not None:
                strategy_var.set(self.strategy_en_to_zh.get(data.get("strategy", "continuous"), data.get("strategy", "continuous")))
            for param, default in (("interval", 100), ("delay", 0), ("random_delay", 0)):
                var = self.skill_vars.get(f"{skill_key}_{param}")
                if var is not None:
                    var.set(data.get(param, default))
        for hotkey_key, default in PER_CONFIG_HOTKEY_SPEC:
            widget = self.skill_vars.get(hotkey_key)
            if widget is not None:
                widget.set_hotkey(cfg.get(hotkey_key, default))

    def _recreate_skill_tabs(self):
        """Recreate skill configuration with updated configuration (skills_config_frame created in create_content)."""
        self.skills_config_frame.destroy()
        self.skill_vars.clear()
        parent = self._func1_skill_frame
        self._create_skill_tabs(parent)
        self._update_config_info()

# Language change is now handled by main UI - no individual panel methods needed
