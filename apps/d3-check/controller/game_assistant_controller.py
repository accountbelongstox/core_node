#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Assistant Function Controller
Controls game assistant functions like Kanai's Cube operations
"""

import os
import sys
import time
import numpy as np
from typing import Optional, Dict
from pathlib import Path

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
ncore_path = os.path.join(os.path.dirname(os.path.dirname(current_dir)), "ncore")
sys.path.insert(0, project_root)
sys.path.insert(0, ncore_path)

from pytools.pyfoundations.color_print import ColorPrint
from d3utils.interface_manager import D3InterfaceManager
from pytools.pyutils.click_handler import ClickHandler


class GameAssistantController:
    """
    Game Assistant Function Controller

    Handles:
    - Interface detection and initialization
    - Kanai's Cube operations (reforge, upgrade)
    - Material placement
    - Conversion operations
    """

    def __init__(self):
        """Initialize game assistant controller"""
        ColorPrint.green("[GameAssistantController] Initializing...")
        self.interface_manager = D3InterfaceManager()
        self.click_handler = ClickHandler()

        # Callback for updating UI (set by UI controller)
        self.on_bag_correction_image_update = None

        ColorPrint.green("[GameAssistantController] Initialized")

    def initialize_interface(self, force_refresh: bool = False) -> bool:
        """
        Initialize game interface detection

        Args:
            force_refresh: Force re-detection of all properties

        Returns:
            True if initialization successful, False otherwise
        """
        ColorPrint.blue("\n[Assistant] Initializing game interface...")

        try:
            # Initialize interface manager (auto-captures screenshot)
            success = self.interface_manager.initialize(force_refresh=force_refresh)

            if not success:
                ColorPrint.red("[Assistant] Interface initialization failed")
                return False

            # Print interface details
            ColorPrint.blue("\n[Assistant] Interface Detection Results:")
            ColorPrint.blue("=" * 60)

            # Bag coordinates
            bag = self.interface_manager.get_bag_coordinates()
            if bag:
                ColorPrint.green(f"[OK] Bag Coordinates: {bag['top_left']} -> {bag['bottom_right']}")
                ColorPrint.green(f"  Size: {bag['width']}x{bag['height']} pixels")
                ColorPrint.green(f"  Grid: {bag['rows']}x{bag['cols']} ({bag['total_slots']} slots)")
            else:
                ColorPrint.yellow("[NO] Bag Coordinates: Not detected")

            # Material button
            material_btn = self.interface_manager.get_put_material_button()
            if material_btn:
                ColorPrint.green(f"[OK] Material Placement Button: {material_btn}")
            else:
                ColorPrint.yellow("[NO] Material Placement Button: Not detected")

            # Conversion button
            conv_btn = self.interface_manager.get_conversion_button()
            if conv_btn:
                ColorPrint.green(f"[OK] Conversion Button: {conv_btn}")
            else:
                ColorPrint.yellow("[NO] Conversion Button: Not detected")

            # Conversion clickable state
            clickable = self.interface_manager.get_conversion_clickable()
            if clickable is not None:
                if clickable:
                    ColorPrint.green(f"[OK] Conversion Clickable: YES (button is enabled)")
                else:
                    ColorPrint.yellow(f"[OK] Conversion Clickable: NO (button is disabled)")
            else:
                ColorPrint.gray("[NO] Conversion Clickable: Unknown")

            # Functional interface type
            func_type = self.interface_manager.get_functional_interface()
            if func_type:
                func_name = {
                    "reforge": "REFORGE (重铸)",
                    "upgrade": "UPGRADE (升级黄装)"
                }.get(func_type, func_type.upper())
                ColorPrint.green(f"[OK] Functional Interface: {func_name}")
            else:
                ColorPrint.gray("[NO] Functional Interface: None detected")

            ColorPrint.blue("=" * 60)

            ColorPrint.green("\n[Assistant] Interface initialization complete!")

            # Initialize and print bag memory if bag is detected
            if bag:
                self._initialize_bag_memory()

            return True

        except Exception as e:
            ColorPrint.red(f"[Assistant] Error during initialization: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _initialize_bag_memory(self) -> None:
        """Initialize bag memory and print bag state"""
        try:
            ColorPrint.blue("\n[BagMemory] Initializing bag memory...")

            # Get bag layout data from interface manager
            bag_data = self.interface_manager.get_bag_layout()

            if not bag_data:
                ColorPrint.yellow("[BagMemory] No bag layout data available")
                return

            # Print bag memory state - access through _detector
            if hasattr(self.interface_manager, '_detector') and self.interface_manager._detector:
                detector = self.interface_manager._detector.bag_layout_detector
                if detector:
                    detector.print_bag_memory_state(bag_data)

            ColorPrint.green("[BagMemory] Bag memory initialized")

        except Exception as e:
            ColorPrint.red(f"[BagMemory] Error initializing bag memory: {e}")
            import traceback
            traceback.print_exc()

    def execute_assistant_functions(self) -> bool:
        """
        Execute assistant functions based on detected interface

        Flow:
        1. Take ONE screenshot
        2. Initialize interface (reuse screenshot)
        3. Check functional_interface type
        4. If upgrade: execute upgrade flow
        5. If reforge: execute reforge flow
        6. Close screenshot at end

        Returns:
            True if execution successful, False otherwise
        """
        ColorPrint.blue("\n[AssistantFunctions] Starting execution...")

        try:
            # Initialize interface (captures screenshot once)
            if not self.initialize_interface():
                ColorPrint.red("[AssistantFunctions] Failed to initialize interface")
                return False

            # Get functional interface type
            func_type = self.interface_manager.get_functional_interface()

            if not func_type:
                ColorPrint.yellow("[AssistantFunctions] No functional interface detected, ending")
                return False

            if func_type == "upgrade":
                ColorPrint.blue("[AssistantFunctions] Detected UPGRADE interface")
                result = self._execute_upgrade_flow()
                return result

            elif func_type == "reforge":
                ColorPrint.blue("[AssistantFunctions] Detected REFORGE interface")
                ColorPrint.yellow("[AssistantFunctions] Reforge flow not implemented yet")
                return False

            else:
                ColorPrint.yellow(f"[AssistantFunctions] Unknown interface type: {func_type}")
                return False

        finally:
            # Always close screenshot at the end
            if hasattr(self.interface_manager, '_detector') and self.interface_manager._detector:
                self.interface_manager._detector.close_screenshot()
                ColorPrint.blue("[AssistantFunctions] Screenshot closed")

    def _execute_upgrade_flow(self) -> bool:
        """
        Execute upgrade flow for rare (yellow) items

        Flow for each rare item:
        1. Right-click on item in bag
        2. Left-click put_material_button
        3. Left-click conversion_button
        4. Wait 2 seconds
        5. Left-click conversion_button again

        Returns:
            True if execution successful, False otherwise
        """
        ColorPrint.blue("\n[Upgrade] Starting upgrade flow...")

        # Get window offset for coordinate conversion
        window_offset_x, window_offset_y = self.interface_manager.get_window_offset()
        ColorPrint.blue(f"[Upgrade] Window offset: ({window_offset_x}, {window_offset_y})")

        # Verify required buttons exist
        material_btn = self.interface_manager.get_put_material_button()
        conversion_btn = self.interface_manager.get_conversion_button()

        if not material_btn or not conversion_btn:
            ColorPrint.red("[Upgrade] Missing required buttons")
            return False

        # Convert button coordinates from screenshot to screen coordinates
        material_btn_screen = (material_btn[0] + window_offset_x, material_btn[1] + window_offset_y)
        conversion_btn_screen = (conversion_btn[0] + window_offset_x, conversion_btn[1] + window_offset_y)

        ColorPrint.green(f"[Upgrade] Material button (screenshot): {material_btn}")
        ColorPrint.green(f"[Upgrade] Material button (screen): {material_btn_screen}")
        ColorPrint.green(f"[Upgrade] Conversion button (screenshot): {conversion_btn}")
        ColorPrint.green(f"[Upgrade] Conversion button (screen): {conversion_btn_screen}")

        # Get bag layout
        bag_data = self.interface_manager.get_bag_layout()
        if not bag_data or 'items' not in bag_data:
            ColorPrint.yellow("[Upgrade] No bag layout available")
            return False

        # Find all rare (yellow) items
        rare_items = []
        for (row, col), item_info in bag_data['items'].items():
            if item_info.get('quality') == 'rare':
                rare_items.append((row, col, item_info))

        if not rare_items:
            ColorPrint.yellow("[Upgrade] No rare (yellow) items found in bag")
            return True

        ColorPrint.green(f"[Upgrade] Found {len(rare_items)} rare item(s) to upgrade")

        # Get bag coordinates to calculate item positions
        bag_coords = self.interface_manager.get_bag_coordinates()
        if not bag_coords:
            ColorPrint.red("[Upgrade] Bag coordinates not available")
            return False

        # Calculate slot size
        bag_width = bag_coords['width']
        bag_height = bag_coords['height']
        rows = bag_coords['rows']
        cols = bag_coords['cols']
        slot_width = bag_width / cols
        slot_height = bag_height / rows

        # Process each rare item
        for idx, (row, col, item_info) in enumerate(rare_items, 1):
            ColorPrint.blue(f"\n[Upgrade] Processing item {idx}/{len(rare_items)} at slot ({row},{col})")

            # Calculate item center position (screenshot coordinates)
            bag_top_left = bag_coords['top_left']
            item_x_screenshot = int(bag_top_left[0] + (col + 0.5) * slot_width)
            item_y_screenshot = int(bag_top_left[1] + (row + 0.5) * slot_height)

            # Convert to screen coordinates
            item_x_screen = item_x_screenshot + window_offset_x
            item_y_screen = item_y_screenshot + window_offset_y

            # Step 1: Right-click on item
            ColorPrint.gray(f"[Upgrade] Step 1: Right-clicking item at screenshot({item_x_screenshot}, {item_y_screenshot}) -> screen({item_x_screen}, {item_y_screen})")
            if not self.click_handler.right_click(item_x_screen, item_y_screen, duration=0.3):
                ColorPrint.red(f"[Upgrade] Failed to right-click item at ({row},{col})")
                continue

            time.sleep(0.3)

            # Step 2: Left-click put_material_button
            ColorPrint.gray(f"[Upgrade] Step 2: Left-clicking material button at screen{material_btn_screen}")
            if not self.click_handler.left_click(material_btn_screen[0], material_btn_screen[1], duration=0.3):
                ColorPrint.red("[Upgrade] Failed to click material button")
                continue

            time.sleep(0.3)

            # Step 3: Left-click conversion_button
            ColorPrint.gray(f"[Upgrade] Step 3: Left-clicking conversion button at screen{conversion_btn_screen}")
            if not self.click_handler.left_click(conversion_btn_screen[0], conversion_btn_screen[1], duration=0.3):
                ColorPrint.red("[Upgrade] Failed to click conversion button")
                continue

            # Step 4: Wait 2 seconds
            ColorPrint.gray(f"[Upgrade] Step 4: Waiting 2 seconds...")
            time.sleep(2.0)

            # Step 5: Left-click conversion_button again
            ColorPrint.gray(f"[Upgrade] Step 5: Left-clicking conversion button again at screen{conversion_btn_screen}")
            if not self.click_handler.left_click(conversion_btn_screen[0], conversion_btn_screen[1], duration=0.3):
                ColorPrint.red("[Upgrade] Failed to click conversion button (2nd time)")
                continue

            ColorPrint.green(f"[Upgrade] Item {idx}/{len(rare_items)} upgraded successfully")
            time.sleep(0.5)

        ColorPrint.green(f"\n[Upgrade] Upgrade flow completed: {len(rare_items)} items processed")
        return True

    def execute_combat_functions(self) -> bool:
        """
        Execute combat-related assistant functions

        This method:
        1. Initializes interface detection
        2. Checks current interface type
        3. Executes appropriate operations

        Returns:
            True if execution successful, False otherwise
        """
        ColorPrint.blue("\n[CombatFunctions] Starting execution...")

        # Initialize interface
        if not self.initialize_interface():
            ColorPrint.red("[CombatFunctions] Failed to initialize interface")
            return False

        # Get functional interface type
        func_type = self.interface_manager.get_functional_interface()

        if func_type == "reforge":
            ColorPrint.blue("[CombatFunctions] Detected REFORGE interface")
            return self._execute_reforge()

        elif func_type == "upgrade":
            ColorPrint.blue("[CombatFunctions] Detected UPGRADE interface")
            return self._execute_upgrade()

        else:
            ColorPrint.yellow("[CombatFunctions] No functional interface detected")
            return False

    def _execute_reforge(self) -> bool:
        """Execute reforge operation"""
        ColorPrint.blue("\n[Reforge] Starting reforge operation...")

        # Check if conversion button is clickable
        clickable = self.interface_manager.get_conversion_clickable()
        if not clickable:
            ColorPrint.yellow("[Reforge] Conversion button is not clickable")
            return False

        ColorPrint.green("[Reforge] Conversion button is ready")
        ColorPrint.blue("[Reforge] TODO: Implement reforge logic")

        # TODO: Implement actual reforge logic
        # 1. Click material button
        # 2. Select items from bag
        # 3. Click conversion button

        return True

    def _execute_upgrade(self) -> bool:
        """Execute upgrade operation"""
        ColorPrint.blue("\n[Upgrade] Starting upgrade operation...")

        # Check if conversion button is clickable
        clickable = self.interface_manager.get_conversion_clickable()
        if not clickable:
            ColorPrint.yellow("[Upgrade] Conversion button is not clickable")
            return False

        ColorPrint.green("[Upgrade] Conversion button is ready")
        ColorPrint.blue("[Upgrade] TODO: Implement upgrade logic")

        # TODO: Implement actual upgrade logic
        # 1. Click material button
        # 2. Select rare items from bag
        # 3. Click conversion button

        return True

    def get_interface_summary(self) -> Dict:
        """
        Get summary of current interface state

        Returns:
            Dictionary with interface properties
        """
        return self.interface_manager.get_summary()

    def generate_bag_correction_image(self) -> Optional[str]:
        """
        Generate bag correction image for UI display

        This method:
        1. Captures a new screenshot
        2. Detects bag coordinates (simplified detection)
        3. Draws detection info (bag boundary, grid, marker positions)
        4. Crops bag region with 10px padding
        5. Saves and returns the image path

        Returns:
            Path to generated correction image, or None if failed
        """
        ColorPrint.blue("\n[BagCorrection] Generating bag correction image...")

        try:
            # Step 1: Initialize interface detection (captures screenshot)
            if not self.interface_manager.initialize():
                ColorPrint.red("[BagCorrection] Failed to initialize interface")
                return None

            # Step 2: Get bag coordinates
            bag_coords = self.interface_manager.get_bag_coordinates()
            if not bag_coords:
                ColorPrint.yellow("[BagCorrection] No bag coordinates detected")
                return None

            # Step 3: Get detector to access screenshot
            if not hasattr(self.interface_manager, '_detector') or not self.interface_manager._detector:
                ColorPrint.red("[BagCorrection] No detector available")
                return None

            detector = self.interface_manager._detector

            if not detector.shared_screenshot_image:
                ColorPrint.red("[BagCorrection] No screenshot image available")
                return None

            # Step 4: Get template match information
            matches = detector.last_matches

            # Step 5: Draw on screenshot
            import cv2
            from pytools.pyutils.image_annotator import ImageAnnotator
            from datetime import datetime
            from pathlib import Path

            # Convert PIL image to cv2 format for processing
            screenshot = np.array(detector.shared_screenshot_image)
            screenshot = cv2.cvtColor(screenshot, cv2.COLOR_RGB2BGR)

            # Create annotator with screenshot
            temp_path = Path.home() / ".core_node" / "pytools" / "tmp" / "temp_screenshot.png"
            temp_path.parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(temp_path), screenshot)

            annotator = ImageAnnotator(temp_path)

            # Draw bag rectangle
            annotator.draw_rectangle(
                bag_coords["top_left"],
                bag_coords["bottom_right"],
                color=(0, 255, 0),
                thickness=3,
                label=f"Bag {bag_coords['width']}x{bag_coords['height']}"
            )

            # Draw bag grid
            annotator.draw_grid(
                bag_coords["top_left"],
                bag_coords["bottom_right"],
                rows=6,
                cols=10,
                color=(0, 255, 0),
                thickness=1
            )

            # Draw bag_left marker if found
            if "bag_left" in matches:
                bag_left = matches["bag_left"]
                polygon = bag_left["polygon"]
                center = bag_left["center"]

                # Draw polygon
                annotator.draw_polygon(polygon, color=(255, 0, 255), thickness=2)

                # Highlight bottom-left corner (index 3)
                bottom_left = polygon[3]
                annotator.draw_circle(
                    (int(bottom_left[0]), int(bottom_left[1])),
                    radius=8,
                    color=(255, 0, 0),
                    filled=True
                )

                # Add label
                annotator.draw_text(
                    "bag_left (BL)",
                    (int(bottom_left[0]) + 10, int(bottom_left[1]) - 10),
                    color=(255, 255, 255),
                    font_scale=0.5,
                    thickness=2,
                    background_color=(255, 0, 0)
                )

            # Draw bag_buttom marker if found
            if "bag_buttom" in matches:
                bag_buttom = matches["bag_buttom"]
                polygon = bag_buttom["polygon"]
                center = bag_buttom["center"]

                # Draw polygon
                annotator.draw_polygon(polygon, color=(255, 255, 0), thickness=2)

                # Highlight top-left corner (index 0)
                top_left = polygon[0]
                annotator.draw_circle(
                    (int(top_left[0]), int(top_left[1])),
                    radius=8,
                    color=(0, 0, 255),
                    filled=True
                )

                # Add label
                annotator.draw_text(
                    "bag_buttom (TL)",
                    (int(top_left[0]) + 10, int(top_left[1]) + 20),
                    color=(255, 255, 255),
                    font_scale=0.5,
                    thickness=2,
                    background_color=(0, 0, 255)
                )

            # Save full annotated image temporarily
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            full_annotated_path = Path.home() / ".core_node" / "pytools" / "tmp" / f"bag_full_{timestamp}.png"
            annotator.save(full_annotated_path)

            ColorPrint.green(f"[BagCorrection] Saved full annotated image: {full_annotated_path}")

            # Step 6: Crop bag region with 10px padding
            padding = 10
            crop_left = max(0, bag_coords["top_left"][0] - padding)
            crop_top = max(0, bag_coords["top_left"][1] - padding)
            crop_right = min(screenshot.shape[1], bag_coords["bottom_right"][0] + padding)
            crop_bottom = min(screenshot.shape[0], bag_coords["bottom_right"][1] + padding)

            # Load annotated image and crop
            annotated_img = cv2.imread(str(full_annotated_path))
            cropped = annotated_img[crop_top:crop_bottom, crop_left:crop_right]

            # Save cropped image
            cropped_path = Path.home() / ".core_node" / "pytools" / "tmp" / f"bag_correction_{timestamp}.png"
            cv2.imwrite(str(cropped_path), cropped)

            ColorPrint.green(f"[BagCorrection] Saved cropped correction image: {cropped_path}")

            # Step 7: Update UI if callback is set
            if self.on_bag_correction_image_update:
                self.on_bag_correction_image_update(str(cropped_path))

            # Close screenshot
            detector.close_screenshot()

            return str(cropped_path)

        except Exception as e:
            ColorPrint.red(f"[BagCorrection] Error generating correction image: {e}")
            import traceback
            traceback.print_exc()
            return None


# Example usage
if __name__ == "__main__":
    controller = GameAssistantController()

    # Initialize and print details
    controller.initialize_interface()

    # Execute combat functions
    # controller.execute_combat_functions()
