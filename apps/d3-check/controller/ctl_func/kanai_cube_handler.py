#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kanai Cube Handler
Handles Kanai's Cube operations for item upgrading and reforging
"""

import os
import sys
import time
from pathlib import Path
from typing import Optional

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))

sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint
from d3utils.share import get_game_interface_data
from d3utils.share.game_interface_data import (
    get_scaled_kanai_put_material_button,
    get_scaled_kanai_right_panel_toggle,
    get_scaled_conversion_button,
    get_scaled_kanai_next_page_button
)
from d3utils.state_aware_click_handler import get_state_aware_click_handler
from providor.providor_index import should_stop_assistant


class KanaiCubeHandler:
    """
    Kanai's Cube operation handler

    Handles:
    - Kanai's Cube panel navigation
    - Item upgrading operations
    - Item reforging operations
    - Yellow item processing
    """

    def __init__(self):
        """Initialize Kanai Cube handler"""
        self.click_handler = get_state_aware_click_handler()
        ColorPrint.green("[KanaiCubeHandler] Initialized")

    def handle_upgrade_operation(self) -> bool:
        """
        Handle Kanai's Cube upgrade operation for yellow items

        Workflow:
        1. Validate Kanai's Cube is opened
        2. Reset panel to first page
        3. Navigate to upgrade page (2 clicks)
        4. Process all yellow items

        Returns:
            True if operation successful, False otherwise
        """
        ColorPrint.blue("\n[KanaiCubeHandler] Starting upgrade operation...")

        # Get shared data
        shared_data = get_game_interface_data()

        # Step 1: Validate Kanai's Cube is opened
        if shared_data.interface_type != "kanai_cube":
            ColorPrint.red("[KanaiCubeHandler] Kanai's Cube not opened (interface_type is not kanai_cube)")
            return False

        # Step 2: Validate bag data
        if not shared_data.bag_layout:
            ColorPrint.red("[KanaiCubeHandler] No bag layout data available")
            return False

        # Step 3: Reset panel to first page
        ColorPrint.blue("[KanaiCubeHandler] Resetting panel to first page...")
        if not self._reset_panel_to_first_page(shared_data):
            ColorPrint.red("[KanaiCubeHandler] Failed to reset panel to first page")
            return False

        # Step 4: Navigate to upgrade page (2 clicks)
        ColorPrint.blue("[KanaiCubeHandler] Navigating to upgrade page...")
        if not self._navigate_to_page(shared_data, page_clicks=2):
            ColorPrint.red("[KanaiCubeHandler] Failed to navigate to upgrade page")
            return False

        # Step 5: Process yellow items
        ColorPrint.blue("[KanaiCubeHandler] Processing yellow items...")
        result = self._process_yellow_items(shared_data)

        if result:
            ColorPrint.green("[KanaiCubeHandler] Upgrade operation completed successfully!")
        else:
            ColorPrint.red("[KanaiCubeHandler] Upgrade operation failed")

        return result

    def handle_reforge_operation(self) -> bool:
        """
        Handle Kanai's Cube reforge operation for yellow items

        Workflow:
        1. Validate Kanai's Cube is opened
        2. Reset panel to first page
        3. Navigate to reforge page (1 click)
        4. Process all yellow items

        Returns:
            True if operation successful, False otherwise
        """
        ColorPrint.blue("\n[KanaiCubeHandler] Starting reforge operation...")

        # Get shared data
        shared_data = get_game_interface_data()

        # Step 1: Validate Kanai's Cube is opened
        if shared_data.interface_type != "kanai_cube":
            ColorPrint.red("[KanaiCubeHandler] Kanai's Cube not opened (interface_type is not kanai_cube)")
            return False

        # Step 2: Validate bag data
        if not shared_data.bag_layout:
            ColorPrint.red("[KanaiCubeHandler] No bag layout data available")
            return False

        # Step 3: Reset panel to first page
        ColorPrint.blue("[KanaiCubeHandler] Resetting panel to first page...")
        if not self._reset_panel_to_first_page(shared_data):
            ColorPrint.red("[KanaiCubeHandler] Failed to reset panel to first page")
            return False

        # Step 4: Navigate to reforge page (1 click)
        ColorPrint.blue("[KanaiCubeHandler] Navigating to reforge page...")
        if not self._navigate_to_page(shared_data, page_clicks=1):
            ColorPrint.red("[KanaiCubeHandler] Failed to navigate to reforge page")
            return False

        # Step 5: Process yellow items
        ColorPrint.blue("[KanaiCubeHandler] Processing yellow items...")
        result = self._process_yellow_items(shared_data)

        if result:
            ColorPrint.green("[KanaiCubeHandler] Reforge operation completed successfully!")
        else:
            ColorPrint.red("[KanaiCubeHandler] Reforge operation failed")

        return result

    def _click_right_panel_toggle(self, shared_data) -> bool:
        """
        Click Kanai's Cube right panel toggle button and update state

        This method:
        1. Clicks the toggle button at coordinate (514, 997)
        2. Toggles kanai_right_page_opened state (True<->False)

        Args:
            shared_data: Shared game interface data

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.blue("[KanaiToggle] === Starting toggle click ===")

        # Get window offset
        window_offset = shared_data.window_offset
        if not window_offset:
            ColorPrint.red("[KanaiToggle] Window offset not available")
            return False

        window_offset_x, window_offset_y = window_offset
        ColorPrint.blue(f"[KanaiToggle] Window offset: ({window_offset_x}, {window_offset_y})")

        # Get right panel toggle button coordinate
        toggle_btn = get_scaled_kanai_right_panel_toggle()
        toggle_btn_screen = (toggle_btn[0] + window_offset_x, toggle_btn[1] + window_offset_y)
        ColorPrint.blue(f"[KanaiToggle] Toggle button coordinate (scaled): {toggle_btn}")
        ColorPrint.blue(f"[KanaiToggle] Toggle button coordinate (screen): {toggle_btn_screen}")

        # Get current state
        current_state = shared_data.kanai_right_page_opened
        target_state = not current_state if current_state is not None else None
        ColorPrint.blue(f"[KanaiToggle] Current state: {current_state} -> Target state: {target_state}")

        # Click toggle button
        ColorPrint.blue(f"[KanaiToggle] Clicking toggle button at {toggle_btn_screen}...")
        if not self.click_handler.left_click(toggle_btn_screen[0], toggle_btn_screen[1], 0.1):
            ColorPrint.red("[KanaiToggle] Failed to click toggle button")
            return False

        # Update state
        if current_state is not None:
            shared_data.kanai_right_page_opened = not current_state
            ColorPrint.green(f"[KanaiToggle] ✓ Toggle successful! State updated: {current_state} -> {shared_data.kanai_right_page_opened}")
        else:
            ColorPrint.yellow("[KanaiToggle] State was unknown, cannot update")

        time.sleep(0.5)
        ColorPrint.blue("[KanaiToggle] === Toggle click completed ===")
        return True

    def _reset_panel_to_first_page(self, shared_data) -> bool:
        """
        Reset Kanai's Cube right panel to first page and ensure it's OPENED

        Logic:
        - If right panel is CLOSED: Click toggle 1 time to open (now on first page)
        - If right panel is OPENED: Click toggle 2 times (close -> open, reset to first page)

        Result: Right panel is always OPENED and on first page, ready for navigation
        Uses _click_right_panel_toggle() to maintain state consistency.

        Args:
            shared_data: Shared game interface data

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.blue("[KanaiReset] Checking Kanai right page state...")
        ColorPrint.blue(f"[KanaiReset] Current state: kanai_right_page_opened = {shared_data.kanai_right_page_opened}")

        # Check if right page state is available
        if not hasattr(shared_data, 'kanai_right_page_opened') or shared_data.kanai_right_page_opened is None:
            ColorPrint.yellow("[KanaiReset] kanai_right_page_opened state not available")
            return False

        if not shared_data.kanai_right_page_opened:
            # Right panel is CLOSED, click once to open (will be on first page)
            ColorPrint.blue("[KanaiReset] Right panel is CLOSED, clicking toggle ONCE to open...")
            if not self._click_right_panel_toggle(shared_data):
                ColorPrint.red("[KanaiReset] Failed to open right panel")
                return False
            ColorPrint.green("[KanaiReset] Right panel opened successfully (now on first page)!")
        else:
            # Right panel is OPENED, click twice to reset (close -> open)
            ColorPrint.blue("[KanaiReset] Right panel is OPENED, clicking toggle TWICE to reset...")

            # First click: close (back to left panel only)
            ColorPrint.blue("[KanaiReset] First click: closing right panel...")
            if not self._click_right_panel_toggle(shared_data):
                ColorPrint.red("[KanaiReset] Failed to close right panel")
                return False
            time.sleep(0.3)

            # Second click: open (now on first page)
            ColorPrint.blue("[KanaiReset] Second click: opening right panel...")
            if not self._click_right_panel_toggle(shared_data):
                ColorPrint.red("[KanaiReset] Failed to open right panel")
                return False
            ColorPrint.green("[KanaiReset] Right panel reset successfully (now on first page)!")

        ColorPrint.blue(f"[KanaiReset] Final state: kanai_right_page_opened = {shared_data.kanai_right_page_opened}")
        return True

    def _navigate_to_page(self, shared_data, page_clicks: int) -> bool:
        """
        Navigate to specific Kanai's Cube page by clicking next page button

        Note: Assumes right panel is already OPENED and on first page
        (handled by _reset_panel_to_first_page)

        Args:
            shared_data: Shared game interface data
            page_clicks: Number of next page button clicks
                        - 1 for reforge page (first page -> reforge page)
                        - 2 for upgrade page (first page -> second page -> upgrade page)

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.blue(f"[KanaiNav] Navigating to target page (clicking next button {page_clicks} times)...")
        ColorPrint.blue(f"[KanaiNav] Current state: kanai_right_page_opened = {shared_data.kanai_right_page_opened}")

        # Verify right panel is opened (should always be true after _reset_panel_to_first_page)
        if not shared_data.kanai_right_page_opened:
            ColorPrint.red("[KanaiNav] Right panel is not opened! This should not happen after reset.")
            return False

        window_offset = shared_data.window_offset
        if not window_offset:
            ColorPrint.red("[KanaiNav] Window offset not available")
            return False

        window_offset_x, window_offset_y = window_offset

        # Get next page button coordinate
        next_page_btn = get_scaled_kanai_next_page_button()
        next_page_btn_screen = (next_page_btn[0] + window_offset_x, next_page_btn[1] + window_offset_y)
        ColorPrint.blue(f"[KanaiNav] Next page button coordinate (scaled): {next_page_btn}")
        ColorPrint.blue(f"[KanaiNav] Next page button coordinate (screen): {next_page_btn_screen}")

        # Click next page button N times
        for i in range(page_clicks):
            # Check for interruption
            if should_stop_assistant():
                ColorPrint.yellow(f"[KanaiNav] Execution interrupted at page click {i+1}/{page_clicks}")
                return False

            ColorPrint.blue(f"[KanaiNav] Clicking next page button ({i+1}/{page_clicks}) at {next_page_btn_screen}...")

            if not self.click_handler.left_click(next_page_btn_screen[0], next_page_btn_screen[1], 0.1):
                ColorPrint.red(f"[KanaiNav] Failed to click next page button ({i+1}/{page_clicks})")
                return False

            ColorPrint.green(f"[KanaiNav] Successfully clicked next page button ({i+1}/{page_clicks})")
            time.sleep(0.3)

        ColorPrint.green(f"[KanaiNav] Successfully navigated to target page!")
        return True

    def _process_yellow_items(self, shared_data) -> bool:
        """
        Process all yellow items in the bag for upgrade/reforge

        Flow for each yellow item:
        1. Right-click on item in bag
        2. Left-click put_material_button
        3. Left-click conversion_button
        4. Wait 2 seconds
        5. Left-click conversion_button again

        Args:
            shared_data: Shared game interface data

        Returns:
            True if processing successful, False otherwise
        """
        ColorPrint.blue("=" * 60)
        ColorPrint.blue("[KanaiProcess] Starting yellow item processing...")
        ColorPrint.blue("=" * 60)

        # Get window offset for coordinate conversion
        window_offset = shared_data.window_offset
        if not window_offset:
            ColorPrint.red("[KanaiProcess] Window offset not available")
            return False

        window_offset_x, window_offset_y = window_offset
        ColorPrint.blue(f"[KanaiProcess] Window offset: ({window_offset_x}, {window_offset_y})")

        # Get put material button coordinate using scaled standard coordinate
        material_btn = get_scaled_kanai_put_material_button()
        ColorPrint.blue(f"[KanaiProcess] Put material button coordinate (scaled): {material_btn}")

        # Get conversion button coordinate using scaled standard coordinate
        conversion_btn = get_scaled_conversion_button()
        ColorPrint.blue(f"[KanaiProcess] Conversion button coordinate (scaled): {conversion_btn}")

        # Convert button coordinates from screenshot to screen coordinates
        material_btn_screen = (material_btn[0] + window_offset_x, material_btn[1] + window_offset_y)
        conversion_btn_screen = (conversion_btn[0] + window_offset_x, conversion_btn[1] + window_offset_y)
        ColorPrint.blue(f"[KanaiProcess] Put material button coordinate (screen): {material_btn_screen}")
        ColorPrint.blue(f"[KanaiProcess] Conversion button coordinate (screen): {conversion_btn_screen}")
        ColorPrint.blue(f"[KanaiProcess] Note: Right panel must be OPENED for put material button to be visible")

        # Get bag layout
        bag_layout = shared_data.bag_layout
        if not bag_layout or not hasattr(bag_layout, 'items'):
            ColorPrint.yellow("[KanaiProcess] No bag layout available")
            return False

        # Find all rare (yellow) items
        rare_items = []
        for (row, col), item_info in bag_layout.items.items():
            if item_info.get('quality') == 'rare':
                rare_items.append((row, col, item_info))

        if not rare_items:
            ColorPrint.yellow("[KanaiProcess] No rare (yellow) items found in bag")
            return True

        ColorPrint.green(f"[KanaiProcess] Found {len(rare_items)} rare item(s) to process")

        # Get bag coordinates
        bag_coords = shared_data.bag_coordinates
        if not bag_coords:
            ColorPrint.red("[KanaiProcess] Bag coordinates not available")
            return False

        # Calculate slot size
        bag_width = bag_coords.width
        bag_height = bag_coords.height
        rows = bag_coords.rows
        cols = bag_coords.cols
        slot_width = bag_width / cols
        slot_height = bag_height / rows

        # Process each rare item
        for idx, (row, col, item_info) in enumerate(rare_items, 1):
            # Check for interruption at start of each iteration
            if should_stop_assistant():
                ColorPrint.yellow(f"[KanaiProcess] Execution interrupted by user at item {idx}/{len(rare_items)}")
                return False

            ColorPrint.blue(f"\n{'='*50}")
            ColorPrint.blue(f"[KanaiProcess] Processing item {idx}/{len(rare_items)} at slot ({row},{col})")
            ColorPrint.blue(f"[KanaiProcess] Item info: {item_info}")

            # Calculate item center position (screenshot coordinates)
            bag_top_left = bag_coords.top_left
            item_x_screenshot = int(bag_top_left[0] + (col + 0.5) * slot_width)
            item_y_screenshot = int(bag_top_left[1] + (row + 0.5) * slot_height)
            ColorPrint.blue(f"[KanaiProcess] Bag top-left: {bag_top_left}, slot size: {slot_width:.1f}x{slot_height:.1f}")
            ColorPrint.blue(f"[KanaiProcess] Item center (screenshot): ({item_x_screenshot}, {item_y_screenshot})")

            # Convert to screen coordinates
            item_x_screen = item_x_screenshot + window_offset_x
            item_y_screen = item_y_screenshot + window_offset_y
            ColorPrint.blue(f"[KanaiProcess] Item center (screen): ({item_x_screen}, {item_y_screen})")

            # Step 1: Right-click on item
            ColorPrint.gray(f"[KanaiProcess] Step 1: Right-clicking item at ({item_x_screen}, {item_y_screen})")
            if not self.click_handler.right_click(item_x_screen, item_y_screen, duration=0):
                ColorPrint.red(f"[KanaiProcess] Failed to right-click item at ({row},{col})")
                continue
            time.sleep(0.3)

            # Step 2: Left-click material button
            ColorPrint.gray(f"[KanaiProcess] Step 2: Clicking material button at {material_btn_screen}")
            if not self.click_handler.left_click(material_btn_screen[0], material_btn_screen[1], duration=0):
                ColorPrint.red("[KanaiProcess] Failed to click material button")
                continue
            time.sleep(0.3)

            # Step 3: Left-click conversion button
            ColorPrint.gray(f"[KanaiProcess] Step 3: Clicking conversion button at {conversion_btn_screen}")
            if not self.click_handler.left_click(conversion_btn_screen[0], conversion_btn_screen[1], duration=0):
                ColorPrint.red("[KanaiProcess] Failed to click conversion button")
                continue

            # Step 4: Wait 2 seconds
            ColorPrint.gray(f"[KanaiProcess] Step 4: Waiting 2 seconds...")
            time.sleep(2.0)

            # Step 5: Left-click conversion button again
            ColorPrint.gray(f"[KanaiProcess] Step 5: Clicking conversion button again at {conversion_btn_screen}")
            if not self.click_handler.left_click(conversion_btn_screen[0], conversion_btn_screen[1], duration=0):
                ColorPrint.red("[KanaiProcess] Failed to click conversion button (2nd time)")
                continue

            ColorPrint.green(f"[KanaiProcess] Item {idx}/{len(rare_items)} processed successfully")
            time.sleep(0.5)

        ColorPrint.green(f"\n[KanaiProcess] Processing completed: {len(rare_items)} items processed")
        return True


# Singleton instance
_kanai_cube_handler_instance = None

def get_kanai_cube_handler() -> KanaiCubeHandler:
    """Get singleton Kanai Cube handler instance"""
    global _kanai_cube_handler_instance
    if _kanai_cube_handler_instance is None:
        _kanai_cube_handler_instance = KanaiCubeHandler()
    return _kanai_cube_handler_instance

# Example usage
if __name__ == "__main__":
    handler = get_kanai_cube_handler()
    result = handler.handle_upgrade_operation()
    print(f"Result: {result}")
