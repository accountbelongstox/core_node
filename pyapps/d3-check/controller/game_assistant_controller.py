#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Assistant Function Controller
Controls game assistant functions like Kanai's Cube operations
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
from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher
from share.game_interface_data import get_game_interface_data
from share.template_match_debug import is_debug_ui_active, push as debug_push
from providor.providor_index import (
    can_start_assistant,
    set_assistant_running,
    should_stop_assistant,
    reset_assistant_state
)
from controller.ctl_func.blacksmith_handler import get_blacksmith_handler
from controller.ctl_func.kanai_cube_handler import get_kanai_cube_handler
from providor.providor_index import CONFIG

# Assistant hotkey: match on full window, then require match center in game left 30% (avoids SIFT failure when crop makes template too small)
LEFT_REGION_RATIO = 0.3
TEMPLATE_BAG_OPENED = "bag_opened_indicator"
TEMPLATE_KANAI_LEFT = "kanai_cube_left_panel_indicator"


def _match_in_left_region(full_image, matcher, template_name: str) -> bool:
    """Match template on full window; if matched, require center to be in left 30%."""
    if full_image is None:
        return False
    w = full_image.size[0] if hasattr(full_image, "size") else full_image.shape[1]
    r = matcher.match_template(target_image=full_image, template_name=template_name, output_dir=None)
    if r.get("total_matches", 0) <= 0:
        return False
    match = r.get("matches", [None])[0]
    if not match or not match.get("success"):
        return False
    center = match.get("center")
    if center is None or (hasattr(center, "__len__") and len(center) < 2):
        return False
    cx = float(center[0]) if hasattr(center[0], "__float__") else center[0]
    return cx < w * LEFT_REGION_RATIO

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

    def _detect_interface_from_full_window(self, full_window_image):
        """
        Match templates on full game window (avoids left-30% crop making template too small for SIFT).
        If matched, require center in left 30%: bag_opened_indicator -> blacksmith, kanai_cube_left_panel_indicator -> Kanai Cube.
        Returns "blacksmith" | "kanai_cube" | None.
        """
        if not full_window_image:
            return None
        matcher = get_d3_scaled_template_matcher()
        if _match_in_left_region(full_window_image, matcher, TEMPLATE_BAG_OPENED):
            ColorPrint.green("[AutoUseInterface] Left 30%: found bag_opened_indicator -> blacksmith flow")
            return "blacksmith"
        if _match_in_left_region(full_window_image, matcher, TEMPLATE_KANAI_LEFT):
            ColorPrint.green("[AutoUseInterface] Left 30%: found kanai_cube_left_panel_indicator -> Kanai Cube flow")
            return "kanai_cube"
        return None

    def auto_use_interface_function(self) -> bool:
        """
        Auto use game interface function.

        On hotkey: capture once, match in game left 30% only:
        - bag_opened_indicator -> blacksmith flow
        - kanai_cube_left_panel_indicator -> Kanai Cube flow
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

        # Step 2: Detect interface (match on full window, then require match center in left 30%)
        ColorPrint.blue("[AutoUseInterface] Step 2: Detecting interface (full window match, center in left 30%)...")
        shared_data = get_game_interface_data()
        full_window = shared_data.game_window_image
        interface_type = self._detect_interface_from_full_window(full_window)

        if interface_type is None:
            msg = "[AutoUseInterface] No bag_opened_indicator or kanai_cube_left_panel_indicator in game left 30%"
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

        shared_data = get_game_interface_data()
        result = False
        if interface_type == "kanai_cube":
            result = self._handle_kanai_cube_upgrade(shared_data)
        else:
            aux = CONFIG.get("macro_configs", {}).get("auxiliary_config", {})
            auto_salvage = aux.get("auto_salvage", {})
            if auto_salvage.get("enabled") is True:
                keep = auto_salvage.get("keep", "keep_ancient_plus")
                result = get_blacksmith_handler().handle_auto_salvage_by_slots(keep)
            else:
                result = self._handle_blacksmith_upgrade()

        reset_assistant_state()
        ColorPrint.blue("[AutoUseInterface] Execution finished, state reset")
        return result

    def _handle_kanai_cube_upgrade(self, shared_data) -> bool:
        """
        Handle Kanai Cube upgrade yellow items

        Delegates to KanaiCubeHandler for upgrade operation.

        Args:
            shared_data: Shared game interface data (already collected)

        Returns:
            True if operation successful, False otherwise
        """
        ColorPrint.blue("\n[AutoUpgrade] Interface type: Kanai Cube")
        ColorPrint.blue("[AutoUpgrade] Executing Kanai Cube upgrade logic...")
        
        # Get Kanai Cube handler
        kanai_handler = get_kanai_cube_handler()
        
        # Execute upgrade operation
        result = kanai_handler.handle_upgrade_operation()
        
        if result:
            ColorPrint.green("[AutoUpgrade] Kanai Cube upgrade operation completed")
        else:
            ColorPrint.red("[AutoUpgrade] Kanai Cube upgrade operation failed")
        
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
    """Return the global GameAssistantController instance (singleton). 导出前实例化."""
    global _game_assistant_controller_instance
    if _game_assistant_controller_instance is None:
        _game_assistant_controller_instance = GameAssistantController()
    return _game_assistant_controller_instance