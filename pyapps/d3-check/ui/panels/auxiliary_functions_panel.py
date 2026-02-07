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

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG, save_config, DIABLO_III_WINDOW_TITLES

# Import unified styles
from ..unified_styles import UnifiedStyles

# Import widgets
from ..widgets import HotkeyInput

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager
from ..utils.tk_variables import var_str
from ui.utils.config_binding import ConfigBinding
from share.game_interface_data import get_game_interface_data, get_scaled_bag_region, get_global_scale
from pycore.pyfoundations.third_party import get_third_package_PIL_ImageTk
from d3utils.screenshot_provider import get_screenshot_provider

ImageTk = get_third_package_PIL_ImageTk()

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

        btn_row = len(settings)
        open_bag_btn = ttk.Button(
            bag_frame,
            text=i18n_manager.get_ui_text("ui.auxiliary_panel.open_bag_adjust"),
            command=self._open_bag_adjust_window
        )
        open_bag_btn.grid(row=btn_row, column=0, columnspan=2, sticky="w",
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['xs'])

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
        """Create automation section - one checkbox per row with multiple columns"""
        auto_frame = tk.LabelFrame(parent, text=i18n_manager.get_ui_text("auxiliary_panel.automation_section_title"),
                                  bg=UnifiedStyles.COLORS['bg_secondary'],
                                  fg=UnifiedStyles.COLORS['text_primary'],
                                  font=UnifiedStyles.FONTS['subheading'])
        auto_frame.pack(fill=tk.X, padx=UnifiedStyles.SPACING['sm'],
                       pady=UnifiedStyles.SPACING['sm'])

        # Configure grid - each row has checkbox in column 0, other controls in columns 1,2,3...
        auto_frame.grid_columnconfigure(0, weight=0)  # Checkbox column - fixed width
        auto_frame.grid_columnconfigure(1, weight=1)  # Extra controls column - expandable
        auto_frame.grid_columnconfigure(2, weight=0)  # Reserved for future use

        # Auto functions using ConfigBinding - one checkbox per row
        # Format: (i18n_key, config_key, default, row, has_menu, menu_config)
        #
        # NOTE: For combobox menus, we use KEY-VALUE pattern:
        # - Display: i18n_manager.get_ui_text() for multi-language support
        # - Value: Fixed English keys (e.g., "until_ancient", "double_crit")
        # This ensures internal logic consistency regardless of UI language
        #
        # IMPORTANT: menu_items stores i18n KEYS (not translated text) to support language switching
        auto_functions = [
            ("auxiliary_panel.blood_shard_enabled", "macro_configs.auxiliary_config.blood_shard.enabled", True, 0, False, None),
            ("auxiliary_panel.quick_pickup_enabled", "macro_configs.auxiliary_config.quick_pickup.enabled", True, 1, False, None),
            ("auxiliary_panel.blacksmith_enabled", "macro_configs.auxiliary_config.blacksmith.enabled", False, 2, False, None),
            ("auxiliary_panel.kanai_reforge_enabled", "macro_configs.auxiliary_config.kanai_reforge.enabled", False, 3, True, {
                "menu_config_key": "macro_configs.auxiliary_config.kanai_reforge.mode",
                # Store i18n keys (not translated text) for language switching support
                "menu_items": [
                    ("auxiliary_panel.kanai_reforge_until_ancient", "until_ancient"),
                    ("auxiliary_panel.kanai_reforge_double_crit", "double_crit"),
                    ("auxiliary_panel.kanai_reforge_double_crit_ancient", "double_crit_ancient")
                ],
                "menu_default": "until_ancient"
            }),
            ("auxiliary_panel.kanai_upgrade_enabled", "macro_configs.auxiliary_config.kanai_upgrade.enabled", False, 4, False, None),
            ("auxiliary_panel.kanai_convert_enabled", "macro_configs.auxiliary_config.kanai_convert.enabled", False, 5, True, {
                "menu_config_key": "macro_configs.auxiliary_config.kanai_convert.material",
                # Store i18n keys (not translated text) for language switching support
                "menu_items": [
                    ("auxiliary_panel.kanai_convert_forgotten_soul", "forgotten_soul"),
                    ("auxiliary_panel.kanai_convert_veiled_crystal", "veiled_crystal"),
                    ("auxiliary_panel.kanai_convert_arcane_dust", "arcane_dust")
                ],
                "menu_default": "forgotten_soul"
            }),
            ("auxiliary_panel.drop_equipment_enabled", "macro_configs.auxiliary_config.drop_equipment.enabled", False, 6, False, None),
            ("auxiliary_panel.sound_feedback", "macro_configs.auxiliary_config.sound_feedback", True, 7, False, None),
            ("auxiliary_panel.smart_pause", "macro_configs.auxiliary_config.smart_pause", True, 8, False, None)
        ]

        for i18n_key, config_key, default, row, has_menu, menu_config in auto_functions:
            # Checkbox in column 0
            check = ConfigBinding.create_checkbox_binding(
                auto_frame, config_key, text=i18n_manager.get_ui_text(i18n_key), default_value=default,
                bg=UnifiedStyles.COLORS['bg_secondary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
                activebackground=UnifiedStyles.COLORS['bg_secondary'],
                activeforeground=UnifiedStyles.COLORS['text_primary']
            )
            check.grid(row=row, column=0, sticky='w',
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['xs'])

            # Add combobox menu in column 1 if specified
            # KEY-VALUE pattern: Display i18n text, store fixed English values
            if has_menu and menu_config:
                # menu_items contains: (i18n_key, internal_value)
                # We translate i18n_key dynamically to support language switching
                menu_items = menu_config["menu_items"]

                # Translate i18n keys to display texts
                display_texts = [i18n_manager.get_ui_text(item[0]) for item in menu_items]
                # Build mapping: display_text -> internal_value
                value_mapping = {i18n_manager.get_ui_text(item[0]): item[1] for item in menu_items}
                # Build reverse mapping: internal_value -> i18n_key (not translated text!)
                reverse_mapping = {item[1]: item[0] for item in menu_items}

                # Get current saved value and convert to display text
                config_parts = menu_config["menu_config_key"].split('.')
                current_value = CONFIG
                for part in config_parts:
                    current_value = current_value.get(part, menu_config["menu_default"])

                # Convert stored value to display text via i18n key
                if isinstance(current_value, str) and current_value in reverse_mapping:
                    i18n_key = reverse_mapping[current_value]
                    current_display = i18n_manager.get_ui_text(i18n_key)
                    ColorPrint.blue(f"[ConfigBinding-KV] Loaded from cache: {menu_config['menu_config_key']} = {current_value} -> '{current_display}'")
                else:
                    current_display = display_texts[0] if display_texts else ""
                    ColorPrint.yellow(f"[ConfigBinding-KV] No cache found for {menu_config['menu_config_key']}, using default: '{current_display}'")

                # Create StringVar for the combobox (master for correct root binding)
                menu_var = var_str(auto_frame, current_display)
                menu = ttk.Combobox(auto_frame, textvariable=menu_var,
                                   values=display_texts, state='readonly', width=18)
                menu.grid(row=row, column=1, sticky='w',
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['xs'])

                # Bind selection event to save the internal value (not display text)
                def on_menu_select(event, key=menu_config["menu_config_key"], items=menu_items):
                    display_text = menu_var.get()

                    # Debug: Show all available options for this menu
                    ColorPrint.blue(f"[ConfigBinding-KV] Selected: '{display_text}' from menu: {key}")

                    # Find internal value by comparing current translated text with stored i18n keys
                    internal_value = None
                    for i18n_key, value in items:
                        translated = i18n_manager.get_ui_text(i18n_key)
                        if translated == display_text:
                            internal_value = value
                            ColorPrint.green(f"[ConfigBinding-KV] Matched: {i18n_key} -> {value}")
                            break

                    # Fallback: if not found, use first item's value
                    if internal_value is None:
                        ColorPrint.yellow(f"[ConfigBinding-KV] Warning: '{display_text}' not found in mapping")
                        ColorPrint.yellow(f"[ConfigBinding-KV] Available options: {[i18n_manager.get_ui_text(item[0]) for item in items]}")
                        internal_value = items[0][1]
                        ColorPrint.yellow(f"[ConfigBinding-KV] Using default: {internal_value}")

                    # Save internal value to CONFIG
                    config_parts = key.split('.')
                    config_obj = CONFIG
                    for part in config_parts[:-1]:
                        if part not in config_obj:
                            config_obj[part] = {}
                        config_obj = config_obj[part]
                    config_obj[config_parts[-1]] = internal_value
                    save_config()
                    ColorPrint.blue(f"[ConfigBinding-KV] Saved: {key} = {internal_value} (displayed as: {display_text})")

                menu.bind('<<ComboboxSelected>>', on_menu_select)

        # Blood shard configuration - using grid to match auto_frame layout
        blood_frame = tk.Frame(auto_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        blood_frame.grid(row=9, column=0, columnspan=3, sticky='ew',
                        padx=UnifiedStyles.SPACING['sm'],
                        pady=UnifiedStyles.SPACING['sm'])

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

        # KEY-VALUE pattern for blood shard type combobox
        # Display: i18n multi-language text
        # Value: Fixed English keys (weapon, armor, jewelry, helmet, gloves, boots)
        # NOTE: This pattern should be used for ALL comboboxes in the UI
        # IMPORTANT: Store i18n KEYS (not translated text) to support language switching
        blood_type_items = [
            ("auxiliary_panel.blood_shard_type_weapon", "weapon"),
            ("auxiliary_panel.blood_shard_type_armor", "armor"),
            ("auxiliary_panel.blood_shard_type_jewelry", "jewelry"),
            ("auxiliary_panel.blood_shard_type_helmet", "helmet"),
            ("auxiliary_panel.blood_shard_type_gloves", "gloves"),
            ("auxiliary_panel.blood_shard_type_boots", "boots")
        ]

        # Translate i18n keys to display texts
        blood_type_display = [i18n_manager.get_ui_text(item[0]) for item in blood_type_items]
        # Build reverse mapping: internal_value -> i18n_key
        blood_type_reverse = {item[1]: item[0] for item in blood_type_items}

        # Get saved value and convert to display via i18n key
        saved_type = CONFIG.get("macro_configs", {}).get("auxiliary_config", {}).get("blood_shard", {}).get("type", "weapon")
        if saved_type in blood_type_reverse:
            i18n_key = blood_type_reverse[saved_type]
            current_display = i18n_manager.get_ui_text(i18n_key)
            ColorPrint.blue(f"[ConfigBinding-KV] Loaded blood shard type from cache: {saved_type} -> '{current_display}'")
        else:
            current_display = blood_type_display[0] if blood_type_display else ""
            ColorPrint.yellow(f"[ConfigBinding-KV] No cache for blood shard type, using default: '{current_display}'")

        blood_type_var = var_str(blood_frame, current_display)
        blood_type = ttk.Combobox(blood_frame, textvariable=blood_type_var,
                                  values=blood_type_display, state='readonly', width=10)
        blood_type.pack(side=tk.LEFT, padx=(UnifiedStyles.SPACING['sm'], 0))

        # Save internal value on selection
        def on_blood_type_select(event, items=blood_type_items):
            display_text = blood_type_var.get()

            ColorPrint.blue(f"[ConfigBinding-KV] Selected blood shard type: '{display_text}'")

            # Find internal value by comparing current translated text with stored i18n keys
            internal_value = None
            for i18n_key, value in items:
                translated = i18n_manager.get_ui_text(i18n_key)
                if translated == display_text:
                    internal_value = value
                    ColorPrint.green(f"[ConfigBinding-KV] Matched: {i18n_key} -> {value}")
                    break

            # Fallback: use first item's value
            if internal_value is None:
                ColorPrint.yellow(f"[ConfigBinding-KV] Warning: '{display_text}' not found")
                ColorPrint.yellow(f"[ConfigBinding-KV] Available: {[i18n_manager.get_ui_text(item[0]) for item in items]}")
                internal_value = items[0][1]
                ColorPrint.yellow(f"[ConfigBinding-KV] Using default: {internal_value}")

            if "macro_configs" not in CONFIG:
                CONFIG["macro_configs"] = {}
            if "auxiliary_config" not in CONFIG["macro_configs"]:
                CONFIG["macro_configs"]["auxiliary_config"] = {}
            if "blood_shard" not in CONFIG["macro_configs"]["auxiliary_config"]:
                CONFIG["macro_configs"]["auxiliary_config"]["blood_shard"] = {}
            CONFIG["macro_configs"]["auxiliary_config"]["blood_shard"]["type"] = internal_value
            save_config()
            ColorPrint.blue(f"[ConfigBinding-KV] Saved: blood_shard.type = {internal_value} (displayed as: {display_text})")

        blood_type.bind('<<ComboboxSelected>>', on_blood_type_select)

        # Assistant macro hotkey setting (moved from main panel)
        # Using grid row 10 to place at bottom of automation section
        hotkey_label = tk.Label(auto_frame,
                               text=i18n_manager.get_ui_text("main_functions_panel.macro_pause_hotkey_label"),
                               bg=UnifiedStyles.COLORS['bg_secondary'],
                               fg=UnifiedStyles.COLORS['text_primary'],
                               font=UnifiedStyles.FONTS['label'])
        hotkey_label.grid(row=10, column=0, sticky='w',
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['md'])

        # Get current hotkey value from CONFIG
        current_hotkey = CONFIG.get("macro_configs", {}).get("auxiliary_config", {}).get("assistant_hotkey", "")

        # Helper function to save hotkey to CONFIG
        def on_hotkey_change(hotkey):
            if "macro_configs" not in CONFIG:
                CONFIG["macro_configs"] = {}
            if "auxiliary_config" not in CONFIG["macro_configs"]:
                CONFIG["macro_configs"]["auxiliary_config"] = {}
            CONFIG["macro_configs"]["auxiliary_config"]["assistant_hotkey"] = hotkey
            save_config()
            ColorPrint.blue(f"[ConfigBinding-Hotkey] assistant_hotkey = {hotkey}")

        # HotkeyInput widget with high contrast styling
        hotkey_input = HotkeyInput(
            auto_frame,
            initial_value=current_hotkey,
            on_change=on_hotkey_change,
            width=18,
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
        hotkey_input.grid(row=10, column=1, sticky='w',
                         padx=UnifiedStyles.SPACING['sm'],
                         pady=UnifiedStyles.SPACING['md'])

    def _open_bag_adjust_window(self):
        """Open a popup window that displays the cropped bag region from current game window image."""
        win = tk.Toplevel(self.parent)
        win.title(i18n_manager.get_ui_text("ui.auxiliary_panel.bag_adjust_window_title"))
        win.configure(bg=UnifiedStyles.COLORS['bg_primary'])
        win.geometry("500x400")

        content = tk.Frame(win, bg=UnifiedStyles.COLORS['bg_primary'])
        content.pack(fill=tk.BOTH, expand=True, padx=UnifiedStyles.SPACING['md'], pady=UnifiedStyles.SPACING['md'])

        img_label = tk.Label(content, text="", bg=UnifiedStyles.COLORS['bg_secondary'],
                             fg=UnifiedStyles.COLORS['text_primary'], font=UnifiedStyles.FONTS['label'])
        img_label.pack(fill=tk.BOTH, expand=True)

        def _refresh():
            # Re-capture screenshot each time (memory only, no path saved)
            provider = get_screenshot_provider()
            sd = provider.gen(
                use_optimized_capture=True,
                window_titles=list(DIABLO_III_WINDOW_TITLES),
            )
            game_data = get_game_interface_data()
            img = getattr(game_data, "game_window_image", None) if sd is None else sd.game_window_image
            if img is None:
                img_label.configure(image="", text=i18n_manager.get_ui_text("ui.auxiliary_panel.no_game_window_image"))
                return
            try:
                (tl, br) = get_scaled_bag_region()
                scale_x, scale_y = get_global_scale()
                off = CONFIG.get("ui_analysis", {}).get("bag_offset", {})
                left = tl[0] + int(off.get("left", 9) * scale_x)
                top = tl[1] + int(off.get("top", 0) * scale_y)
                right = br[0] - int(off.get("right", 22) * scale_x)
                bottom = br[1] - int(off.get("bottom", 0) * scale_y)
                left = max(0, min(left, img.width))
                top = max(0, min(top, img.height))
                right = max(left, min(right, img.width))
                bottom = max(top, min(bottom, img.height))
                cropped = img.crop((left, top, right, bottom))
                photo = ImageTk.PhotoImage(cropped)
                win._bag_photo = photo
                img_label.configure(image=photo, text="")
            except Exception as e:
                img_label.configure(image="", text=str(e))
                win._bag_photo = None

        refresh_btn = ttk.Button(content, text=i18n_manager.get_ui_text("ui.auxiliary_panel.refresh_bag_preview"), command=_refresh)
        refresh_btn.pack(pady=UnifiedStyles.SPACING['xs'])

        _refresh()

    # Note: Removed _test_bag_offset method as requested by user
    # Note: Removed _start_automation and _stop_automation methods - replaced with hotkey control

# Language change is now handled by main UI - no individual panel methods needed
