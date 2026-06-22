#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Component
Row0 = macro + per-tab options, row1 = status block. Uses BottomBarOptionsBlock and BottomBarStatusBlock.
Single creator for BottomBarOptionsBlock / BottomBarStatusBlock, instantiated only here.
"""

import os
import tkinter as tk
import winsound
from typing import Callable, Optional
from ..theme import UITheme
from ..utils.tk_variables import var_bool, var_str
from ..unified_styles import UnifiedStyles
from providor.i18n_manager import i18n_manager
from providor.providor_index import get_config_value_safe, set_config_value_async
from providor.constants.common import BATTLE_NET_EXE_NAME
from providor.constants.d3 import DIABLO_III_EXE_NAME, ROSBOT_DIR_NAMESPACE_ASIA, ROSBOT_DIR_NAMESPACE_CN
from d3utils.rosbot_flow_f3_log_timeout import get_test_mode_display_string
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_update_manager import get_rosbot_update_manager
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
        self.test_mode_status = var_str(parent, "")

        self._value_labels = {}
        self._path_icons = {}
        self._row3_right_extra = None
        self._region_changed_callback: Optional[Callable[[], None]] = None
        self._mismatch_scan_triggered = False  # Trigger path scan at most once when version mismatch; reset when matched

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
            "test_mode": self.test_mode_status,
        }
        self._status_block = BottomBarStatusBlock(
            status_container, status_vars, self._register_status_labels,
            register_path_icons_cb=self._register_path_icons,
            register_row3_right_extra_cb=self._register_row3_right_extra,
        )
        self._status_block.frame.grid(row=0, column=0, sticky="ew")

        self._set_region_display_from_config()
        self.refresh_path_icons()

    def _region_display_text(self, region_key) -> str:
        """Single source: region key -> display text (i18n)."""
        i18n = i18n_manager
        if region_key == "cn":
            return i18n.get_ui_text("rosbot.server_cn") or "CN"
        if region_key == "asia":
            return i18n.get_ui_text("rosbot.server_asia") or "Asia"
        return i18n.get_ui_text("rosbot.server_unknown") or "Unknown"

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

    def _register_path_icons(self, path_icons: dict):
        """Called by BottomBarStatusBlock: path_icons = BN/D3/D4/ROS -> Label (fg = green when path found)."""
        self._path_icons = path_icons

    def _register_row3_right_extra(self, container: tk.Frame):
        """Called by BottomBarStatusBlock: container for scan button etc."""
        self._row3_right_extra = container

    def get_row3_scan_container(self) -> Optional[tk.Frame]:
        """Return the frame for row 3 right extra (scan button). Use as parent when creating the button so pack/grid are not mixed."""
        return self._row3_right_extra

    def set_region_changed_callback(self, cb: Optional[Callable[[], None]]) -> None:
        """Set callback when Battle.net region changes; used to auto-trigger path scan to match ROSBOT."""
        self._region_changed_callback = cb

    def _ros_version_display_from_update_logic(self) -> str:
        """ROS label: if parent of ros_dir is standard name (Asia_* or CN_* with version), use it; else fallback to parse version + Battle.net region."""
        try:
            ros_dir = get_rosbot_manager().get_ros_directory()
            if not ros_dir:
                return ""
            parent = os.path.dirname(ros_dir)
            parent_basename = os.path.basename(parent) if parent else ""
            um = get_rosbot_update_manager()
            # Standard dir = GameTools\\{Asia|CN}_{version}\\RosBot -> parent is Asia_36.0129 or CN_36.0129
            is_standard = (
                parent_basename.startswith(ROSBOT_DIR_NAMESPACE_ASIA + "_")
                or parent_basename.startswith(ROSBOT_DIR_NAMESPACE_CN + "_")
            ) and (um.parse_version_from_name(parent_basename) is not None)
            if is_standard:
                return parent_basename
            # Non-standard dir (e.g. ros-bot7.18): parse version from path, prefix by Battle.net region if known
            ver = um.parse_version_from_name(ros_dir)
            if not ver:
                return parent_basename or ""
            version_str = um.version_to_str(ver)
            region = get_game_interface_data().get_battlenet_region()
            region_dir = ROSBOT_DIR_NAMESPACE_ASIA if region == "asia" else (ROSBOT_DIR_NAMESPACE_CN if region == "cn" else "")
            if region_dir:
                return f"{region_dir}_{version_str}"
            return version_str
        except Exception:
            return ""

    def refresh_path_icons(self):
        """Update BN/D3/D4/ROS: check when path set, circle when not; ROS shows actual scanned dir name (e.g. Asia_36.0129); fg green/muted."""
        if not self._path_icons:
            return
        C = UnifiedStyles.COLORS
        check = "\u2713"  # check mark (has value)
        circle = "\u25CB"  # circle (no value)
        bn = (get_config_value_safe("battlenet.battlenet_path") or "").strip()
        d3 = (get_config_value_safe("d3.d3_path") or "").strip()
        ros = (get_config_value_safe("ros_settings.ros_directory") or "").strip()
        bn_ok = bool(bn and os.path.isfile(bn) and os.path.basename(bn) == BATTLE_NET_EXE_NAME)
        d3_ok = bool(d3 and os.path.isfile(d3) and os.path.basename(d3) == DIABLO_III_EXE_NAME)
        ros_ok = bool(ros and (os.path.isdir(ros) or (os.path.isfile(ros) and ros.lower().endswith(".exe"))))
        ros_ver = self._ros_version_display_from_update_logic()
        ros_suffix = f" {ros_ver}" if ros_ver else ""
        for key, lbl in self._path_icons.items():
            if key == "BN":
                lbl.config(text=f"{check if bn_ok else circle} BN", fg=C["success"] if bn_ok else C["text_muted"])
            elif key == "D3":
                lbl.config(text=f"{check if d3_ok else circle} D3", fg=C["success"] if d3_ok else C["text_muted"])
            elif key == "D4":
                lbl.config(text=f"{circle} D4", fg=C["text_muted"])
            elif key == "ROS":
                lbl.config(text=f"{check if ros_ok else circle} ROS{ros_suffix}", fg=C["success"] if ros_ok else C["text_muted"])

    def show_tab_content(self, tab_index: int):
        """Show options row for the given main tab (0..4). Status row is shared, no change."""
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

        # Rescan only when region changed: write cache and trigger scan when cache differs from current; UI uses async config write to avoid blocking main thread
        if region_key in ("asia", "cn"):
            cached = get_config_value_safe("ros_settings.battlenet_region_cache")
            if cached != region_key:
                set_config_value_async("ros_settings.battlenet_region_cache", region_key)
                if cached is not None and self._region_changed_callback:
                    self._region_changed_callback()
            # When Battle.net and ROSBOT version mismatch, auto-scan once; trigger once, reset when matched
            ros_dir = get_rosbot_manager().get_ros_directory() or ""
            norm = os.path.normpath(ros_dir).lower()
            match = (region_key == "asia" and (ROSBOT_DIR_NAMESPACE_ASIA.lower() in norm or "asia" in norm)) or (
                region_key == "cn" and ROSBOT_DIR_NAMESPACE_CN.lower() in norm and ROSBOT_DIR_NAMESPACE_ASIA.lower() not in norm
            )
            if match:
                self._mismatch_scan_triggered = False
            elif ros_dir and not self._mismatch_scan_triggered and self._region_changed_callback:
                self._mismatch_scan_triggered = True
                self._region_changed_callback()

        # ROS column: display only (ResetNum) per requirement; label "ROS:" from i18n.
        ros_ext = state.get("rosbot_extended_status") or "not_found"
        restart_count = state.get("rosbot_total_restart_count", 0)
        if restart_count > 0:
            fmt = i18n.get_ui_text("rosbot.restart_count_format") or "[R{count}]"
            ros_val = fmt.format(count=restart_count)
        else:
            ros_val = "-"
        if ros_ext == "running":
            ros_fg = C['success']
        elif ros_ext == "paused":
            ros_fg = C['warning']
        else:
            ros_fg = C['error']
        self.ros_status.set(ros_val)

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
            "battlenet": bn_fg, "ros": ros_fg, "d3": d3_fg, "map": map_fg,
            "stage": stage_fg, "oauth": oauth_fg,
        }
        for key, lb in (self._value_labels or {}).items():
            if key in fg_map:
                lb.config(fg=fg_map[key])

        # Test mode row: always visible; left part shows elapsed/timeout/record when rosbot.test_mode is on
        test_mode_on = bool(get_config_value_safe("rosbot.test_mode", False))
        tm_text = (state.get("rosbot_test_mode_display") or get_test_mode_display_string() or "").strip() if test_mode_on else ""
        self.test_mode_status.set(tm_text)
        self.refresh_path_icons()
