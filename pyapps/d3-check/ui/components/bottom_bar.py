#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Component
Two-row layout: row0 = macro + per-tab options, row1 = status (game status + window size).
Uses BottomBarOptionsBlock and BottomBarStatusBlock sub-components to avoid offset.
"""

import tkinter as tk
import winsound
from typing import Optional
from ..theme import UITheme
from ..utils.tk_variables import var_bool, var_str
from ..unified_styles import UnifiedStyles
from d3utils.i18n_manager import I18nManager
from runtime import is_shutdown_requested
from .bottom_bar_options_block import BottomBarOptionsBlock
from .bottom_bar_status_block import BottomBarStatusBlock

i18n_manager = I18nManager()


class BottomBar:
    """Bottom bar: row0 = macro + options (per-tab), row1 = status (single row, no overlap)."""

    def __init__(self, parent):
        self.parent = parent

        self.sound_var = var_bool(parent, True)
        self.smart_pause_var = var_bool(parent, True)
        self.custom_stand_var = var_bool(parent, False)
        self.custom_stand_key_var = var_str(parent, 'Shift')
        self.game_status = var_str(parent, i18n_manager.get_ui_text("ui.status_bar.diablo_not_running"))
        self.window_size = var_str(parent, "0x0")
        self.config_name_var = var_str(parent, "Config 1")
        self.battlenet_status = var_str(parent, "-")
        self.ros_status = var_str(parent, "-")
        self.d3_status = var_str(parent, "-")
        self.map_status = var_str(parent, "-")
        self.stage_status = var_str(parent, "-")
        self.oauth_status = var_str(parent, "-")

        self._value_labels = {}

        self.frame = tk.Frame(
            parent,
            bg=UITheme.get_color('bg_primary'),
            relief=tk.RAISED,
            bd=2
        )
        self.frame.grid_rowconfigure(0, weight=0)
        self.frame.grid_rowconfigure(1, weight=0)
        self.frame.grid_columnconfigure(1, weight=1)

        # Row 0: macro (col 0) + options strip (col 1). Main UI adds macro at row 0 col 0.
        options_container = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        options_container.grid(row=0, column=1, sticky="ew", padx=5, pady=(0, 2))
        options_container.grid_columnconfigure(0, weight=1)
        self._options_block = BottomBarOptionsBlock(options_container, {
            'sound_var': self.sound_var,
            'smart_pause_var': self.smart_pause_var,
            'custom_stand_var': self.custom_stand_var,
            'custom_stand_key_var': self.custom_stand_key_var,
            'config_name_var': self.config_name_var,
        })
        self._options_block.frame.grid(row=0, column=0, sticky="ew")

        # Row 1: status row (columnspan 2), single sub-component — merged Battle.net/ROS/D3/Map/Stage/OAuth + game status + window size
        status_container = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        status_container.grid(row=1, column=0, columnspan=2, sticky="ew", padx=5, pady=(0, 3))
        status_container.grid_columnconfigure(0, weight=1)
        status_vars = {
            "battlenet": self.battlenet_status,
            "ros": self.ros_status,
            "d3": self.d3_status,
            "map": self.map_status,
            "stage": self.stage_status,
            "oauth": self.oauth_status,
            "game_status": self.game_status,
            "window_size": self.window_size,
        }
        self._status_block = BottomBarStatusBlock(status_container, status_vars, self._register_status_labels)
        self._status_block.frame.grid(row=0, column=0, sticky="ew")

    def _register_status_labels(self, value_labels: dict):
        """Called by BottomBarStatusBlock: value_labels = var_key -> Label (for fg updates)."""
        self._value_labels = value_labels

    def show_tab_content(self, tab_index: int):
        """Show options row for the given main tab (0..5). Status row is shared, no change."""
        self._options_block.show_tab(tab_index)

    def pack(self, **kwargs):
        self.frame.pack(**kwargs)

    def grid(self, **kwargs):
        self.frame.grid(**kwargs)

    def update_config_status(self, config_name: str):
        self.config_name_var.set(config_name)
        if self.sound_var.get():
            winsound.Beep(1000, 100)

    def get_sound_enabled(self) -> bool:
        return self.sound_var.get()

    def get_smart_pause_enabled(self) -> bool:
        return self.smart_pause_var.get()

    def get_custom_stand_key(self) -> Optional[str]:
        if self.custom_stand_var.get():
            return self.custom_stand_key_var.get()
        return None

    def on_window_status_update(self, window_info):
        if is_shutdown_requested():
            return
        try:
            self.parent.after(0, lambda w=window_info: self._do_window_status_ui_update(w))
        except tk.TclError:
            pass

    def _do_window_status_ui_update(self, window_info):
        try:
            if window_info:
                width = window_info.get('width', 0)
                height = window_info.get('height', 0)
                self.game_status.set(i18n_manager.get_ui_text("ui.status_bar.diablo_running"))
                size_text = i18n_manager.get_ui_text("ui.status_bar.size_format").format(width=width, height=height)
                self.window_size.set(size_text)
                fg_ok = UnifiedStyles.COLORS['success']
                fg_bad = UnifiedStyles.COLORS['error']
            else:
                self.game_status.set(i18n_manager.get_ui_text("ui.status_bar.diablo_not_running"))
                self.window_size.set("0x0")
                fg_ok = UnifiedStyles.COLORS['error']
                fg_bad = UnifiedStyles.COLORS['error']
            for key, lb in (self._value_labels or {}).items():
                try:
                    if key == "game_status":
                        lb.config(fg=fg_ok if window_info else fg_bad)
                    elif key == "window_size":
                        lb.config(fg=UnifiedStyles.COLORS['success'] if window_info else UnifiedStyles.COLORS['text_secondary'])
                except tk.TclError:
                    pass
        except Exception:
            pass

    def update_status_from_state(self, state: dict):
        """Update all status vars and value label fg from state (state sync callback)."""
        try:
            from d3utils.i18n_manager import I18nManager
            from ..unified_styles import UnifiedStyles
            i18n = I18nManager()
            C = UnifiedStyles.COLORS

            bn_found = state.get("battlenet_window_found", False)
            if not bn_found:
                self.battlenet_status.set(i18n.get_ui_text("rosbot.not_found"))
                bn_fg = C['error']
            elif state.get("battlenet_disconnected", False):
                self.battlenet_status.set(i18n.get_ui_text("rosbot.battlenet_disconnected"))
                bn_fg = C['warning']
            elif state.get("battlenet_on_login_screen", False):
                self.battlenet_status.set(i18n.get_ui_text("rosbot.battlenet_on_login_screen"))
                bn_fg = C['warning']
            elif state.get("battlenet_normal_available", False):
                self.battlenet_status.set(i18n.get_ui_text("rosbot.battlenet_normal_available"))
                bn_fg = C['success']
            else:
                self.battlenet_status.set(i18n.get_ui_text("rosbot.found_unknown_state"))
                bn_fg = C['text_secondary']

            ros_ext = state.get("rosbot_extended_status", "not_found")
            if ros_ext == "running":
                self.ros_status.set(i18n.get_ui_text("rosbot.extended_running"))
                ros_fg = C['success']
            elif ros_ext == "paused":
                self.ros_status.set(i18n.get_ui_text("rosbot.extended_paused"))
                ros_fg = C['warning']
            else:
                self.ros_status.set(i18n.get_ui_text("rosbot.not_found"))
                ros_fg = C['error']

            if not state.get("d3_running", False):
                self.d3_status.set(i18n.get_ui_text("rosbot.not_running"))
                d3_fg = C['error']
            elif state.get("d3_disconnected", False):
                self.d3_status.set(i18n.get_ui_text("rosbot.d3_disconnected"))
                d3_fg = C['warning']
            elif state.get("d3_on_login_screen", False):
                self.d3_status.set(i18n.get_ui_text("rosbot.d3_on_login_screen"))
                d3_fg = C['warning']
            elif state.get("d3_in_game", False):
                self.d3_status.set(i18n.get_ui_text("rosbot.d3_in_game"))
                d3_fg = C['success']
            else:
                self.d3_status.set(i18n.get_ui_text("rosbot.found"))
                d3_fg = C['success']

            map_type = state.get("map_type", "unknown")
            self.map_status.set(i18n.get_ui_text(f"rosbot.map_{map_type}"))
            map_fg = C['success'] if map_type != "unknown" else C['text_secondary']

            game_stage = state.get("game_stage", "unknown")
            self.stage_status.set(i18n.get_ui_text(f"rosbot.stage_{game_stage}"))
            stage_fg = C['success'] if game_stage != "unknown" else C['text_secondary']

            oauth_connected = state.get("oauth_script_connected", False)
            self.oauth_status.set(
                i18n.get_ui_text("rosbot.oauth_script_connected" if oauth_connected else "rosbot.oauth_script_disconnected")
            )
            oauth_fg = C['success'] if oauth_connected else C['warning']

            running = state.get("d3_running", False)
            self.game_status.set(
                i18n.get_ui_text("ui.status_bar.diablo_running") if running else i18n.get_ui_text("ui.status_bar.diablo_not_running")
            )
            game_fg = C['success'] if running else C['error']

            fg_map = {
                "battlenet": bn_fg, "ros": ros_fg, "d3": d3_fg, "map": map_fg,
                "stage": stage_fg, "oauth": oauth_fg, "game_status": game_fg,
            }
            for key, lb in (self._value_labels or {}).items():
                try:
                    if key in fg_map:
                        lb.config(fg=fg_map[key])
                except tk.TclError:
                    pass
        except Exception:
            pass
