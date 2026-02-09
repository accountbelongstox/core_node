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

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_numpy
from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher as get_scaled_template_matcher
from share.game_interface_data import (
    get_game_interface_data,
    get_scaled_blacksmith_salvage_button,
    get_scaled_blacksmith_tab_salvage_materials,
    get_scaled_blacksmith_salvage_dialog_salvage_button,
    get_scaled_blacksmith_salvage_dialog_confirm,
)
from d3utils.state_aware_click_handler import get_state_aware_click_handler
from d3utils.debug_bag_hover import classify_slot_quality_from_window
from providor.constants.common import TMP_DIR, SCALED_TEMPLATES_CACHE_DIR
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

        # Get game window offset from shared data
        window_offset = getattr(shared_data, "window_offset", None)

        if (
            not isinstance(window_offset, tuple)
            or len(window_offset) != 2
            or any(coord is None for coord in window_offset)
        ):
            ColorPrint.red("[BlacksmithHandler] Window offset unavailable in shared data")
            return False

        window_offset_x, window_offset_y = window_offset

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
        # Use game_window_image from shared data
        if not shared_data.game_window_image:
            ColorPrint.red("[BlacksmithHandler] No game window image in shared data")
            return False

        # Save to temporary file for template matching
        temp_screenshot_path = SCALED_TEMPLATES_CACHE_DIR / f"temp_blacksmith_{shared_data.timestamp}.png"
        SCALED_TEMPLATES_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        shared_data.game_window_image.save(temp_screenshot_path)

        try:
            # Try both sidebar tab templates
            sidebar_tabs = ["blacksmith_sidebar_tab_1", "blacksmith_sidebar_tab_2"]

            for tab_name in sidebar_tabs:
                ColorPrint.blue(f"[BlacksmithHandler] Trying {tab_name}...")
                result = self.scaled_matcher.match_template(
                    target_image=temp_screenshot_path,
                    template_name=tab_name,
                    output_dir=None
                )

                if result["total_matches"] > 0:
                    match = result["matches"][0]
                    center = match['center']

                    # Convert to screen coordinates
                    click_x = int(center[0] + window_offset_x)
                    click_y = int(center[1] + window_offset_y)

                    ColorPrint.green(f"[BlacksmithHandler] Found {tab_name} at {center}")
                    ColorPrint.blue(f"[BlacksmithHandler] Clicking at screen: ({click_x}, {click_y})")

                    # Click the tab
                    self.click_handler.click(click_x, click_y)

                    return True

            # Neither tab found
            ColorPrint.yellow("[BlacksmithHandler] No sidebar tab found")
            return False

        finally:
            # Clean up temp file
            try:
                if temp_screenshot_path.exists():
                    temp_screenshot_path.unlink()
            except Exception as e:
                ColorPrint.gray(f"[BlacksmithHandler] Could not clean up temp file: {e}")

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
            self.click_handler.click(click_x, click_y)

            return True

        except Exception as e:
            ColorPrint.red(f"[BlacksmithHandler] Error calculating button position: {e}")
            return False

    def handle_auto_salvage_by_slots(self, keep: str) -> bool:
        """
        Auto salvage: for each bag slot that should be salvaged (by keep policy),
        click slot -> click dialog salvage button -> click confirm.
        keep: "keep_ancient_plus" = salvage normal/rare/magic; "keep_primal" = salvage normal/ancient/rare/magic.
        """
        shared_data = get_game_interface_data()
        coords = getattr(shared_data, "bag_coordinates", None)
        layout = getattr(shared_data, "bag_layout", None)
        if not coords or not layout or not getattr(layout, "items", None):
            ColorPrint.red("[BlacksmithHandler] No bag coordinates/layout for auto salvage")
            return False
        window_offset = getattr(shared_data, "window_offset", (0, 0))
        if not isinstance(window_offset, (tuple, list)) or len(window_offset) != 2:
            ColorPrint.red("[BlacksmithHandler] Window offset unavailable")
            return False
        ox, oy = int(window_offset[0]), int(window_offset[1])
        top_left = coords.top_left
        w, h = coords.width, coords.height
        rows, cols = coords.rows, coords.cols
        slot_width = w / cols
        slot_height = h / rows

        if not shared_data.game_window_image:
            ColorPrint.red("[BlacksmithHandler] No game window image for slot classification")
            return False
        img_array = np.array(shared_data.game_window_image)

        # Switch to salvage materials tab
        tab_x, tab_y = get_scaled_blacksmith_tab_salvage_materials()
        self.click_handler.click(ox + tab_x, oy + tab_y)
        time.sleep(0.4)

        btn_salvage_x, btn_salvage_y = get_scaled_blacksmith_salvage_dialog_salvage_button()
        btn_confirm_x, btn_confirm_y = get_scaled_blacksmith_salvage_dialog_confirm()

        slots_to_process: List[Tuple[int, int, dict]] = []
        for r in range(rows):
            for c in range(cols):
                info = layout.items.get((r, c))
                if not info:
                    continue
                if info.get("type") not in ("item_1slot", "item_2slot"):
                    continue
                slots_to_process.append((r, c, info))

        to_salvage: List[Tuple[int, int]] = []
        for (r, c, info) in slots_to_process:
            quality = info.get("quality", "unknown")
            if quality in ("rare", "magic"):
                to_salvage.append((r, c))
                continue
            if quality not in ("legendary_set", "legendary"):
                to_salvage.append((r, c))
                continue
            tier = classify_slot_quality_from_window(
                img_array, top_left, slot_width, slot_height, r, c
            )
            if keep == "keep_ancient_plus":
                if tier == "normal":
                    to_salvage.append((r, c))
            else:
                if tier in ("normal", "ancient"):
                    to_salvage.append((r, c))

        if not to_salvage:
            ColorPrint.blue("[BlacksmithHandler] Auto salvage: no slots to salvage")
            return True

        ColorPrint.blue(f"[BlacksmithHandler] Auto salvage: {len(to_salvage)} slots (keep={keep})")
        for (r, c) in to_salvage:
            slot_screen_x = int(ox + top_left[0] + (c + 0.5) * slot_width)
            slot_screen_y = int(oy + top_left[1] + (r + 0.5) * slot_height)
            self.click_handler.click(slot_screen_x, slot_screen_y)
            time.sleep(0.2)
            self.click_handler.click(ox + btn_salvage_x, oy + btn_salvage_y)
            time.sleep(0.15)
            self.click_handler.click(ox + btn_confirm_x, oy + btn_confirm_y)
            time.sleep(0.25)
        ColorPrint.green("[BlacksmithHandler] Auto salvage by slots completed")
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
