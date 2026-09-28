#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Blacksmith Handler
Handles blacksmith-specific operations
"""

import os
import sys
import time
from pathlib import Path
from typing import Optional, List, Tuple

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))

sys.path.insert(0, project_root)

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_numpy
from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher as get_scaled_template_matcher
from share.game_interface_data import (
    get_game_interface_data,
    get_scaled_blacksmith_tab_salvage_materials,
    get_scaled_blacksmith_salvage_dialog_salvage_button,
    get_scaled_blacksmith_salvage_dialog_confirm,
    get_scaled_blacksmith_ui_coords,
)
from d3utils.state_aware_click_handler import get_state_aware_click_handler
from d3utils.slot_quality import _find_line_in_crop
from d3utils.debug_bag_hover import _search_region_bounds
from d3utils.screenshot_provider import get_screenshot_provider
from providor.constants.common import SCALED_TEMPLATES_CACHE_DIR, CLICK_MOVE_DURATION_SEC, CLICK_PAUSE_AFTER_MOVE_SEC
from providor.providor_index import CONFIG

np = get_third_package_numpy()

class BlacksmithHandler:
    """
    Blacksmith operation handler

    Handles:
    - Sidebar tab clicking (switch to salvage tab)
    - Salvage button clicking
    - Item salvaging operations
    """

    def __init__(self):
        """Initialize blacksmith handler"""
        self.scaled_matcher = get_scaled_template_matcher()
        self.click_handler = get_state_aware_click_handler()
        ColorPrint.green("[BlacksmithHandler] Initialized")

    def handle_salvage_operation(self) -> bool:
        """
        Handle blacksmith salvage operation

        Workflow:
        1. Click sidebar tab to switch to salvage tab
        2. Click salvage button

        Returns:
            True if operation successful, False otherwise
        """
        ColorPrint.blue("\n[BlacksmithHandler] Starting salvage operation...")

        # Get shared data
        shared_data = get_game_interface_data()

        window_offset = shared_data.window_offset
        window_offset_x, window_offset_y = window_offset[0], window_offset[1]

        # Step 1: Click sidebar tab
        ColorPrint.blue("[BlacksmithHandler] Step 1: Clicking sidebar tab...")
        if not self._click_sidebar_tab(shared_data, window_offset_x, window_offset_y):
            ColorPrint.red("[BlacksmithHandler] Failed to click sidebar tab")
            return False

        # Wait for UI update
        time.sleep(0.5)

        # Step 2: Click salvage button
        ColorPrint.blue("[BlacksmithHandler] Step 2: Clicking salvage button...")
        if not self._click_salvage_button(shared_data, window_offset_x, window_offset_y):
            ColorPrint.red("[BlacksmithHandler] Failed to click salvage button")
            return False

        ColorPrint.green("[BlacksmithHandler] Salvage operation completed")
        return True

    def _click_sidebar_tab(self, shared_data, window_offset_x: int, window_offset_y: int) -> bool:
        """
        Click blacksmith sidebar tab

        Searches for either blacksmith_sidebar_tab_1 or blacksmith_sidebar_tab_2
        Clicks whichever is found first

        Args:
            shared_data: Shared game interface data
            window_offset_x: Game window X offset
            window_offset_y: Game window Y offset

        Returns:
            True if clicked successfully, False otherwise
        """
        # Use game_window_image from shared data (in-memory, no temp file)
        if not shared_data.game_window_image:
            ColorPrint.red("[BlacksmithHandler] No game window image in shared data")
            return False

        # Match on in-memory image (matcher accepts PIL Image)
        sidebar_tabs = ["blacksmith_sidebar_tab_1", "blacksmith_sidebar_tab_2"]
        for tab_name in sidebar_tabs:
            ColorPrint.blue(f"[BlacksmithHandler] Trying {tab_name}...")
            result = self.scaled_matcher.match_template(
                target_image=shared_data.game_window_image,
                template_name=tab_name,
                output_dir=None
            )

            if result["total_matches"] > 0:
                match = result["matches"][0]
                center = match["center"]

                # Convert to screen coordinates
                click_x = int(center[0] + window_offset_x)
                click_y = int(center[1] + window_offset_y)

                ColorPrint.green(f"[BlacksmithHandler] Found {tab_name} at {center}")
                ColorPrint.blue(f"[BlacksmithHandler] Clicking at screen: ({click_x}, {click_y})")

                # Click the tab
                self.click_handler.click(click_x, click_y, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)

                return True

        ColorPrint.red("[BlacksmithHandler] No sidebar tab matched")
        return False

    def _click_salvage_button(self, shared_data, window_offset_x: int, window_offset_y: int) -> bool:
        """
        Click blacksmith salvage button using scaled standard coordinates

        Args:
            shared_data: Shared game interface data
            window_offset_x: Game window X offset
            window_offset_y: Game window Y offset

        Returns:
            True if clicked successfully, False otherwise
        """
        # Check if we have window size information
        if not shared_data.game_window_size or shared_data.game_window_size == (0, 0):
            ColorPrint.red("[BlacksmithHandler] No game window size information")
            return False

        actual_width, actual_height = shared_data.game_window_size

        try:
            ColorPrint.blue(f"[BlacksmithHandler] Using scaled coordinates for window size: {actual_width}x{actual_height}")

            # Get scaled coordinate for salvage button
            button_x, button_y = get_scaled_blacksmith_salvage_button()

            # Convert to screen coordinates
            click_x = int(button_x + window_offset_x)
            click_y = int(button_y + window_offset_y)

            ColorPrint.green(f"[BlacksmithHandler] Calculated salvage button at game window: ({button_x}, {button_y})")
            ColorPrint.blue(f"[BlacksmithHandler] Clicking at screen: ({click_x}, {click_y})")

            # Click the button
            self.click_handler.click(click_x, click_y, direct_click=True, return_to_original=True, duration=CLICK_MOVE_DURATION_SEC, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)

            return True

        except Exception as e:
            ColorPrint.red(f"[BlacksmithHandler] Error calculating button position: {e}")
            return False

    def handle_auto_salvage_by_slots(self, keep: str, debug_only: bool = False) -> bool:
        """
        Hover each gear slot once to get quality (normal/ancient/primal), then decide salvage by dropdown rule. One hover per slot.
        keep: "keep_ancient_plus" = keep ancient+, salvage rest; "keep_primal" = keep primal only, salvage rest.
        """
        shared_data = get_game_interface_data()
        coords = shared_data.bag_coordinates
        layout = shared_data.bag_layout
        if not coords or not layout or not layout.items:
            ColorPrint.red("[BlacksmithHandler] No bag coordinates/layout for auto salvage")
            return False
        window_offset = shared_data.window_offset
        ox, oy = int(window_offset[0]), int(window_offset[1])
        top_left = coords.top_left
        w, h = coords.width, coords.height
        rows, cols = coords.rows, coords.cols
        slot_width = w / cols
        slot_height = h / rows

        slots_to_process: List[Tuple[int, int, dict]] = []
        for r in range(rows):
            for c in range(cols):
                info = layout.items.get((r, c))
                if not info:
                    continue
                if info.get("type") not in ("item_1slot", "item_2slot"):
                    continue
                slots_to_process.append((r, c, info))

        if debug_only:
            ColorPrint.gray("[BlacksmithHandler] Salvage preview (debug_only): %d slots to scan (hover each then decide)" % len(slots_to_process))
            return True

        coords_ui = get_scaled_blacksmith_ui_coords()
        tab_x, tab_y = coords_ui["tab_salvage_materials"]
        btn_salvage_x, btn_salvage_y = coords_ui["salvage_dialog_salvage_button"]
        btn_confirm_x, btn_confirm_y = coords_ui["salvage_dialog_confirm"]

        # Salvage materials TAB opened once at start
        self.click_handler.click(ox + tab_x, oy + tab_y, direct_click=True, return_to_original=True, duration=0.0, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
        time.sleep(0.4)

        # Window size for crop offset (reuse debug upgrade logic; crop left area only to detect primal/ancient line)
        gs = shared_data.game_window_size
        if gs and gs[0] > 0 and gs[1] > 0:
            window_w, window_h = int(gs[0]), int(gs[1])
        elif hasattr(shared_data, "game_window_image") and shared_data.game_window_image is not None:
            wi = shared_data.game_window_image
            window_w, window_h = (wi.width, wi.height) if hasattr(wi, "width") else (wi.shape[1], wi.shape[0])
        else:
            window_w, window_h = 1300, 800

        provider = get_screenshot_provider()
        search_length = 0.5 * slot_width
        salvage_count = 0
        for (r, c, info) in slots_to_process:
            quality = info.get("quality", "unknown")
            slot_screen_x = int(ox + top_left[0] + (c + 0.5) * slot_width)
            slot_screen_y = int(oy + top_left[1] + (r + 0.5) * slot_height)

            # One hover per slot; crop small area only to detect primal/ancient/normal legendary (reuse debug_bag_hover crop)
            self.click_handler.move_mouse(slot_screen_x, slot_screen_y, duration=0.0)
            time.sleep(0.35)
            x_min, y_min, x_max, y_max, left_edge_x, center_y = _search_region_bounds(
                top_left, slot_width, slot_height, r, c, window_w, window_h
            )
            region_w = x_max - x_min
            region_h = y_max - y_min
            screen_left = ox + x_min
            screen_top = oy + y_min
            region_pil = provider.capture_region(screen_left, screen_top, region_w, region_h)
            if region_pil is None or region_w <= 0 or region_h <= 0:
                continue
            crop_array = np.array(region_pil)
            left_edge_x_in_crop = left_edge_x - x_min
            center_y_in_crop = center_y - y_min
            kind, height, _primal_xy, _ancient_xy = _find_line_in_crop(
                crop_array, left_edge_x_in_crop, center_y_in_crop, search_length
            )
            if kind == "orange" and height is not None:
                tier = "primal"
            elif kind == "ancient" and height is not None:
                tier = "ancient"
            else:
                tier = "normal"

            if quality in ("rare", "magic"):
                should_salvage = True
            elif quality not in ("legendary_set", "legendary"):
                should_salvage = True
            elif keep == "keep_ancient_plus":
                should_salvage = tier == "normal"
            else:
                should_salvage = tier in ("normal", "ancient")

            if not should_salvage:
                continue

            self.click_handler.click(slot_screen_x, slot_screen_y, direct_click=True, return_to_original=True, duration=0.0, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
            time.sleep(0.2)
            self.click_handler.click(ox + btn_salvage_x, oy + btn_salvage_y, direct_click=True, return_to_original=True, duration=0.0, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
            time.sleep(0.15)
            self.click_handler.click(ox + btn_confirm_x, oy + btn_confirm_y, direct_click=True, return_to_original=True, duration=0.0, pause_after_move=CLICK_PAUSE_AFTER_MOVE_SEC)
            time.sleep(0.25)
            salvage_count += 1

        ColorPrint.green("[BlacksmithHandler] Auto salvage by slots completed (salvaged %d)" % salvage_count)
        return True


# Singleton instance
_blacksmith_handler_instance = None

def get_blacksmith_handler() -> BlacksmithHandler:
    """Get singleton blacksmith handler instance"""
    global _blacksmith_handler_instance
    if _blacksmith_handler_instance is None:
        _blacksmith_handler_instance = BlacksmithHandler()
    return _blacksmith_handler_instance

# Example usage
if __name__ == "__main__":
    handler = get_blacksmith_handler()
    result = handler.handle_salvage_operation()
    print(f"Result: {result}")
