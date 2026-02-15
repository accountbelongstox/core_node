#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Component
Row0 = macro + per-tab options, row1 = status block. Uses BottomBarOptionsBlock and BottomBarStatusBlock.
本类为 BottomBarOptionsBlock / BottomBarStatusBlock 的单一创建者，仅在此处实例化一次。
"""

import tkinter as tk
import winsound
from typing import Optional
from ..theme import UITheme
from ..utils.tk_variables import var_bool, var_str
from ..unified_styles import UnifiedStyles
from d3utils.i18n_manager import i18n_manager
from providor.providor_index import get_config_value_safe
from runtime import is_shutdown_requested
from share.game_interface_data import get_game_interface_data
from .bottom_bar_options_block import BottomBarOptionsBlock
from .bottom_bar_status_block import BottomBarStatusBlock


class BottomBar:
    """Bottom bar: row0 = macro + options (per-tab), row1 = status (single row, no overlap)."""

    def __init__(self, parent):
        self.parent = parent

        self.sound_var = var_bool(parent, True)
        self.smart_pause_var = var_bool(parent, True)
        self.custom_stand_var = var_bool(parent, False)
        self.custom_stand_key_var = var_str(parent, 'Shift')
        self.window_size = var_str(parent, "0x0")
        self.config_name_var = var_str(parent, "Config 1")
        self.battlenet_status = var_str(parent, "-")
        self.battlenet_region = var_str(parent, "-")
        self.ros_status = var_str(parent, "-")
        self.ros_found_status = var_str(parent, "-")
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
        self.frame.grid_rowconfigure(2, weight=0)
        self.frame.grid_columnconfigure(1, weight=1)
        tab_pad = UnifiedStyles.TAB_PAD

        # Row 0: macro (col 0) + options strip (col 1). Main UI adds macro at row 0 col 0.
        options_container = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        options_container.grid(row=0, column=1, sticky="ew", padx=tab_pad, pady=(0, tab_pad // 2))
        options_container.grid_columnconfigure(0, weight=1)
        self._options_block = BottomBarOptionsBlock(options_container, {
            'sound_var': self.sound_var,
            'smart_pause_var': self.smart_pause_var,
            'custom_stand_var': self.custom_stand_var,
            'custom_stand_key_var': self.custom_stand_key_var,
            'config_name_var': self.config_name_var,
        })
        self._options_block.frame.grid(row=0, column=0, sticky="ew")

        # Row 1: status row (columnspan 2)
        status_container = tk.Frame(self.frame, bg=UITheme.get_color('bg_primary'))
        status_container.grid(row=1, column=0, columnspan=2, sticky="ew", padx=tab_pad, pady=(0, tab_pad // 2))
        status_container.grid_columnconfigure(0, weight=1)
        status_vars = {
            "battlenet": self.battlenet_status,
            "battlenet_region": self.battlenet_region,
            "ros": self.ros_status,
            "ros_found": self.ros_found_status,
            "d3": self.d3_status,
            "map": self.map_status,
            "stage": self.stage_status,
            "oauth": self.oauth_status,
            "window_size": self.window_size,
        }
        self._status_block = BottomBarStatusBlock(status_container, status_vars, self._register_status_labels)
        self._status_block.frame.grid(row=0, column=0, sticky="ew")

        self._set_region_display_from_config()

    def _region_display_text(self, region_key) -> str:
        """Single source: region key -> display (亚服/国服/未知)."""
        i18n = i18n_manager
        if region_key == "cn":
            return i18n.get_ui_text("rosbot.server_cn") or "国服"
        if region_key == "asia":
            return i18n.get_ui_text("rosbot.server_asia") or "亚服"
        return i18n.get_ui_text("rosbot.server_unknown") or "未知"

    def _set_region_display_from_config(self) -> None:
        """Set battlenet_region var from config/game_data so it shows at UI startup."""
        g = get_game_interface_data()
        region = g.get_battlenet_region()
        if region is None:
            region = get_config_value_safe("ros_settings.battlenet_region_cache")
        self.battlenet_region.set(self._region_display_text(region) if region else self._region_display_text(None))

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
        self.parent.after(0, lambda w=window_info: self._do_window_status_ui_update(w))

    def _do_window_status_ui_update(self, window_info):
        if window_info:
            width = window_info.get('width', 0)
            height = window_info.get('height', 0)
            size_text = i18n_manager.get_ui_text("ui.status_bar.size_format").format(width=width, height=height)
            self.window_size.set(size_text)
        else:
            self.window_size.set("0x0")
        for key, lb in (self._value_labels or {}).items():
            if key == "window_size":
                lb.config(fg=UnifiedStyles.COLORS['success'] if window_info else UnifiedStyles.COLORS['error'])

    def update_status_from_state(self, state: dict):
        """Update all status vars and value label fg from state (state sync callback)."""
        i18n = i18n_manager
        C = UnifiedStyles.COLORS

        bn_found = state.get("battlenet_window_found", False)
        region_key = state.get("battlenet_region")
        region_suffix = (i18n.get_ui_text("rosbot.server_cn") if region_key == "cn" else
                         i18n.get_ui_text("rosbot.server_asia") if region_key == "asia" else
                         i18n.get_ui_text("rosbot.server_unknown"))
        bn_state_detected = False  # True only when UI state was detected (not "status undetected")
        if not bn_found:
            bn_text = i18n.get_ui_text("rosbot.not_found")
            bn_fg = C['error']
        elif state.get("battlenet_disconnected", False):
            bn_text = i18n.get_ui_text("rosbot.battlenet_disconnected")
            bn_fg = C['warning']
            bn_state_detected = True
        elif state.get("battlenet_on_login_screen", False):
            bn_text = i18n.get_ui_text("rosbot.battlenet_on_login_screen")
            bn_fg = C['warning']
            bn_state_detected = True
        elif state.get("battlenet_normal_available", False):
            bn_text = i18n.get_ui_text("rosbot.battlenet_normal_available")
            bn_fg = C['success']
            bn_state_detected = True
        else:
            bn_text = i18n.get_ui_text("rosbot.found_unknown_state")
            bn_fg = C['warning']
        if bn_state_detected:
            bn_text = f"{bn_text}({region_suffix})"
        self.battlenet_status.set(bn_text)

        self.battlenet_region.set(self._region_display_text(region_key))

        ros_ext = state.get("rosbot_extended_status") or "not_found"
        exe_name = (state.get("rosbot_found_exe_name") or "").strip()
        window_title = (state.get("rosbot_found_window_title") or "").strip()
        ros_val = "-"
        if ros_ext == "running":
            ros_val = i18n.get_ui_text("rosbot.extended_running") or "运行中"
            ros_fg = C['success']
        elif ros_ext == "paused":
            if exe_name or window_title:
                fmt = i18n.get_ui_text("rosbot.ros_found_format", default="进程:{exe} 标题:{title}") or "进程:{exe} 标题:{title}"
                ros_val = fmt.format(exe=exe_name or "-", title=window_title or "-")
            else:
                ros_val = i18n.get_ui_text("rosbot.extended_paused") or "暂停中"
            ros_fg = C['warning']
        else:
            ros_val = i18n.get_ui_text("rosbot.not_found") or "未找到"
            ros_fg = C['error']
        need_key = state.get("rosbot_need_key_input", False)
        need_key_msg = (state.get("rosbot_need_key_message") or "").strip()
        if need_key and need_key_msg:
            ros_val = f"{ros_val}({need_key_msg})"
        self.ros_status.set(ros_val or "-")

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
        map_fg = C['success'] if map_type != "unknown" else C['warning']

        game_stage = state.get("game_stage", "unknown")
        self.stage_status.set(i18n.get_ui_text(f"rosbot.stage_{game_stage}"))
        stage_fg = C['success'] if game_stage != "unknown" else C['warning']

        oauth_connected = state.get("oauth_script_connected", False)
        self.oauth_status.set(
            i18n.get_ui_text("rosbot.oauth_script_connected" if oauth_connected else "rosbot.oauth_script_disconnected")
        )
        oauth_fg = C['success'] if oauth_connected else C['error']

        region_fg = C['success'] if region_key in ("asia", "cn") else C['warning']

        fg_map = {
            "battlenet": bn_fg, "battlenet_region": region_fg, "ros": ros_fg, "d3": d3_fg, "map": map_fg,
            "stage": stage_fg, "oauth": oauth_fg,
        }
        for key, lb in (self._value_labels or {}).items():
            if key in fg_map:
                lb.config(fg=fg_map[key])
