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
        if not shared_data.conversion_button:
            ColorPrint.red("[KanaiCubeHandler] Kanai's Cube not opened (no conversion button)")
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
        if not shared_data.conversion_button:
            ColorPrint.red("[KanaiCubeHandler] Kanai's Cube not opened (no conversion button)")
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

    def _reset_panel_to_first_page(self, shared_data) -> bool:
        """
        Reset Kanai's Cube right panel to first page

        Simplified logic: toggle → wait → toggle
        This ensures final state is OPENED regardless of initial state.

        Args:
            shared_data: Shared game interface data

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.blue("[KanaiReset] Resetting Kanai right panel to first page...")

        # Get window offset
        window_offset = shared_data.window_offset
        if not window_offset:
            ColorPrint.red("[KanaiReset] Window offset not available")
            return False

        window_offset_x, window_offset_y = window_offset

        # Get conversion button for toggle operations
        conversion_btn = shared_data.conversion_button
        if not conversion_btn:
            ColorPrint.red("[KanaiReset] Conversion button not available")
            return False

        # Convert to screen coordinates
        conversion_btn_screen = (conversion_btn[0] + window_offset_x, conversion_btn[1] + window_offset_y)

        # Toggle sequence: toggle → wait → toggle
        ColorPrint.blue("[KanaiReset] Executing toggle sequence...")

        # First toggle
        ColorPrint.blue("[KanaiReset] First toggle...")
        if not self.click_handler.click(conversion_btn_screen[0], conversion_btn_screen[1], "toggle_1"):
            ColorPrint.red("[KanaiReset] Failed first toggle")
            return False
        time.sleep(0.5)

        # Second toggle
        ColorPrint.blue("[KanaiReset] Second toggle...")
        if not self.click_handler.click(conversion_btn_screen[0], conversion_btn_screen[1], "toggle_2"):
            ColorPrint.red("[KanaiReset] Failed second toggle")
            return False
        time.sleep(0.5)

        ColorPrint.green("[KanaiReset] Panel reset to first page completed!")
        return True

    def _navigate_to_page(self, shared_data, page_clicks: int) -> bool:
        """
        Navigate to specific Kanai's Cube page by clicking next page button

        Args:
            shared_data: Shared game interface data
            page_clicks: Number of next page clicks needed

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.blue(f"[KanaiNav] Navigating to target page ({page_clicks} clicks)...")

        # Get material button for next page clicks
        material_btn = shared_data.put_material_button
        if not material_btn:
            ColorPrint.red("[KanaiNav] Put material button not found")
            return False

        window_offset = shared_data.window_offset
        if not window_offset:
            ColorPrint.red("[KanaiNav] Window offset not available")
            return False

        # Get button match from button_detections
        button_detections = shared_data.button_detections
        if not button_detections or 'material_button' not in button_detections:
            ColorPrint.red("[KanaiNav] Material button detection data not available")
            return False

        material_button_detection = button_detections['material_button']
        if not material_button_detection or not hasattr(material_button_detection, 'match'):
            ColorPrint.red("[KanaiNav] Material button detection is invalid")
            return False

        material_button_match = material_button_detection.match

        # Get button polygon
        polygon = material_button_match.get('polygon')
        if polygon is None or len(polygon) < 4:
            ColorPrint.red("[KanaiNav] Material button has no valid polygon")
            return False

        # Calculate button's right edge center point
        top_right = polygon[1]
        bottom_right = polygon[2]
        right_edge_center_x = (top_right[0] + bottom_right[0]) / 2
        right_edge_center_y = (top_right[1] + bottom_right[1]) / 2

        # Convert to window coordinates
        window_offset_x, window_offset_y = window_offset
        click_x = int(right_edge_center_x + window_offset_x)
        click_y = int(right_edge_center_y + window_offset_y)

        # Click next page button specified number of times
        for i in range(page_clicks):
            # Check for interruption
            if should_stop_assistant():
                ColorPrint.yellow(f"[KanaiNav] Execution interrupted at page click {i+1}/{page_clicks}")
                return False

            ColorPrint.blue(f"[KanaiNav] Clicking next page button ({i+1}/{page_clicks})...")
            
            # Perform click using state-aware click handler
            success = self.click_handler.click(click_x, click_y, "next_page_button")
            if not success:
                ColorPrint.red(f"[KanaiNav] Failed to click next page button ({i+1}/{page_clicks})")
                return False
            time.sleep(0.3)

        ColorPrint.green(f"[KanaiNav] Successfully navigated to page (clicked {page_clicks} times)")
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
        ColorPrint.blue("[KanaiProcess] Starting yellow item processing...")

        # Get window offset for coordinate conversion
        window_offset = shared_data.window_offset
        if not window_offset:
            ColorPrint.red("[KanaiProcess] Window offset not available")
            return False

        window_offset_x, window_offset_y = window_offset

        # Verify required buttons exist
        material_btn = shared_data.put_material_button
        conversion_btn = shared_data.conversion_button

        if not material_btn or not conversion_btn:
            ColorPrint.red("[KanaiProcess] Missing required buttons")
            return False

        # Convert button coordinates from screenshot to screen coordinates
        material_btn_screen = (material_btn[0] + window_offset_x, material_btn[1] + window_offset_y)
        conversion_btn_screen = (conversion_btn[0] + window_offset_x, conversion_btn[1] + window_offset_y)

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

            ColorPrint.blue(f"\n[KanaiProcess] Processing item {idx}/{len(rare_items)} at slot ({row},{col})")

            # Calculate item center position (screenshot coordinates)
            bag_top_left = bag_coords.top_left
            item_x_screenshot = int(bag_top_left[0] + (col + 0.5) * slot_width)
            item_y_screenshot = int(bag_top_left[1] + (row + 0.5) * slot_height)

            # Convert to screen coordinates
            item_x_screen = item_x_screenshot + window_offset_x
            item_y_screen = item_y_screenshot + window_offset_y

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
