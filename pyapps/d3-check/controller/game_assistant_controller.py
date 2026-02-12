#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Assistant Function Controller

铁匠与魔盒为不同流程，不可混为一谈：
- 铁匠 (blacksmith)：bag_opened_indicator 左 30% → 拆解装备等，走 blacksmith_handler。
- 魔盒 (Kanai Cube)：kanai_cube_left_panel_indicator 左 30% → 升级/重铸等，走 run_kanai_upgrade_flow。
"""

import os
import sys
from typing import Optional

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

sys.path.insert(0, project_root)

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.interface_manager import D3InterfaceManager, get_d3_interface_manager
from share.game_interface_data import get_game_interface_data
from share.template_match_debug import is_debug_ui_active, push as debug_push
from providor.providor_index import (
    can_start_assistant,
    set_assistant_running,
    should_stop_assistant,
    reset_assistant_state
)
from controller.ctl_func.blacksmith_handler import get_blacksmith_handler
from d3utils.kanai import run_kanai_upgrade_flow
from providor.providor_index import CONFIG

from d3utils.interface_detection import detect_interface_type_from_full_window


class GameAssistantController:
    """
    Game Assistant Function Controller

    Handles:
    - Interface detection and initialization
    - Delegates to specialized handlers for operations
    """

    def __init__(self):
        """Initialize game assistant controller"""
        ColorPrint.green("[GameAssistantController] Initializing...")
        self.interface_manager = get_d3_interface_manager()
        ColorPrint.green("[GameAssistantController] Initialized")

    def _detect_interface_from_full_window(self, full_window_image, want_blacksmith: bool = False):
        """Delegate to single implementation; returns "blacksmith" | "kanai_cube" | None."""
        interface_type, _ = detect_interface_type_from_full_window(
            full_window_image, want_blacksmith=want_blacksmith
        )
        if interface_type == "blacksmith":
            ColorPrint.green("[AutoUseInterface] Found bag_opened_indicator (blacksmith) in left 30% -> blacksmith flow")
        elif interface_type == "kanai_cube":
            ColorPrint.green("[AutoUseInterface] Found kanai_cube_left_panel_indicator in left 30% -> Kanai Cube flow")
        return interface_type

    def auto_use_interface_function(self) -> bool:
        """
        Auto use game interface function.

        On hotkey: capture once; both indicators require match center in left 30%.
        - bag_opened_indicator (left 30%) -> blacksmith flow
        - kanai_cube_left_panel_indicator (left 30%) -> Kanai Cube flow
        - neither -> log and return

        Supports interruption via hotkey toggle.
        """
        if not can_start_assistant():
            ColorPrint.yellow("[AutoUseInterface] Cannot start: already running or disabled")
            return False

        set_assistant_running(True)
        ColorPrint.blue("\n" + "="*80)
        ColorPrint.blue("[AutoUseInterface] Starting auto use interface function...")
        ColorPrint.blue("[AutoUseInterface] Press hotkey again to stop")
        ColorPrint.blue("="*80)

        if should_stop_assistant():
            ColorPrint.yellow("[AutoUseInterface] Execution stopped by user")
            reset_assistant_state()
            return False

        # Step 1: One capture and UI region (no full bag collect yet)
        ColorPrint.blue("[AutoUseInterface] Step 1: Capturing game window...")
        ui_region = self.interface_manager.collect_ui_info(force_new_capture=True, save_screenshot=False)
        if not ui_region:
            ColorPrint.red("[AutoUseInterface] Failed to collect UI info")
            reset_assistant_state()
            return False

        if should_stop_assistant():
            ColorPrint.yellow("[AutoUseInterface] Execution stopped by user")
            reset_assistant_state()
            return False

        # Step 2: Detect interface (match on full window; icons may be left or right)
        # Only try bag_opened_indicator when blacksmith upgrade or auto salvage is enabled (see AUTO_USE_INTERFACE_BLACKSMITH_FLOW.md)
        ColorPrint.blue("[AutoUseInterface] Step 2: Detecting interface (full window match)...")
        shared_data = get_game_interface_data()
        full_window = shared_data.game_window_image
        aux = CONFIG.get("macro_configs", {}).get("auxiliary_config", {})
        want_blacksmith = aux.get("blacksmith", {}).get("enabled", False) or aux.get("auto_salvage", {}).get("enabled", False)
        interface_type = self._detect_interface_from_full_window(full_window, want_blacksmith=want_blacksmith)

        if interface_type is None:
            if want_blacksmith:
                msg = "[AutoUseInterface] Blacksmith UI not found (bag_opened_indicator not matched in left 30%)"
            else:
                msg = "[AutoUseInterface] No bag_opened_indicator or kanai_cube_left_panel_indicator matched in left 30% on game window"
            ColorPrint.yellow(msg)
            try:
                if is_debug_ui_active():
                    debug_push("AutoUseInterface", msg, None)
            except Exception:
                pass
            reset_assistant_state()
            return False

        # Step 3: Collect bag/interface from current shared image (no second capture), then run handler
        bag_coords = self.interface_manager.collect_bag_info_from_current_shared(save_screenshot=False)
        if not bag_coords:
            ColorPrint.red("[AutoUseInterface] Failed to collect bag/interface info for handler")
            reset_assistant_state()
            return False

        if should_stop_assistant():
            ColorPrint.yellow("[AutoUseInterface] Execution stopped by user")
            reset_assistant_state()
            return False

        # 铁匠与魔盒分支互斥：魔盒走 Kanai 流程；铁匠走拆解/自动分解（根据配置 debug_only 决定是否真实点击拆解）
        shared_data = get_game_interface_data()
        resolved_type = shared_data.interface_type or interface_type
        result = False
        if resolved_type == "kanai_cube":
            # 魔盒：Kanai Cube 升级/重铸等，与铁匠无关
            result = run_kanai_upgrade_flow()
        else:
            # 铁匠：blacksmith，拆解装备。配置 debug_only=False 时执行真实拆解（点 TAB、装备、拆解、确认）
            aux = CONFIG.get("macro_configs", {}).get("auxiliary_config", {}) or {}
            auto_salvage = aux.get("auto_salvage") or {}
            if auto_salvage.get("enabled") is True:
                keep = auto_salvage.get("keep", "keep_ancient_plus")
                debug_only = auto_salvage.get("debug_only", False)
                result = get_blacksmith_handler().handle_auto_salvage_by_slots(keep, debug_only=debug_only)
            else:
                result = self._handle_blacksmith_upgrade()

        reset_assistant_state()
        ColorPrint.blue("[AutoUseInterface] Execution finished, state reset")
        return result

    def _handle_blacksmith_upgrade(self) -> bool:
        """
        Handle blacksmith salvage operation

        Blacksmith does not have upgrade function.
        Instead, this will perform salvage operation.

        Returns:
            True if operation successful, False otherwise
        """
        ColorPrint.blue("\n[AutoUpgrade] Interface type: Blacksmith")
        ColorPrint.blue("[AutoUpgrade] Blacksmith does not have upgrade function")
        ColorPrint.blue("[AutoUpgrade] Executing salvage operation instead...")

        # Get handler instance
        blacksmith_handler = get_blacksmith_handler()

        # Execute salvage operation
        result = blacksmith_handler.handle_salvage_operation()

        if result:
            ColorPrint.green("[AutoUpgrade] Blacksmith salvage operation completed")
        else:
            ColorPrint.red("[AutoUpgrade] Blacksmith salvage operation failed")

        return result

    def _handle_no_interface_upgrade(self) -> bool:
        """
        Handle upgrade when no functional interface is opened

        Returns:
            False (cannot proceed)
        """
        ColorPrint.red("\n[AutoUpgrade] No functional interface detected")
        ColorPrint.red("[AutoUpgrade] Please open Kanai's Cube to use upgrade function")
        ColorPrint.yellow("[AutoUpgrade] Steps:")
        ColorPrint.yellow("[AutoUpgrade]   1. Open inventory (press 'I')")
        ColorPrint.yellow("[AutoUpgrade]   2. Click Kanai's Cube icon")
        ColorPrint.yellow("[AutoUpgrade]   3. Wait for interface to fully load")
        ColorPrint.yellow("[AutoUpgrade]   4. Run this function again")
        return False


_game_assistant_controller_instance: Optional["GameAssistantController"] = None


def get_game_assistant_controller() -> "GameAssistantController":
    """Return the global GameAssistantController instance (singleton)."""
    global _game_assistant_controller_instance
    if _game_assistant_controller_instance is None:
        _game_assistant_controller_instance = GameAssistantController()
    return _game_assistant_controller_instance