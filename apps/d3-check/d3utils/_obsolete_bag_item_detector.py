#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bag Item Detector
Detects items in Diablo III bag by scanning grid slots
"""

import os
import sys
import time
from typing import List, Dict, Tuple, Optional
from pathlib import Path
import numpy as np

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint
from pytools.pyutils.click_handler import ClickHandler
from pytools.pyutils.image_crop import ImageCrop
from pytools.pyutils.image_comparator import ImageComparator
from pytools.pyutils.window_screenshot import WindowScreenshot

class BagItemDetector:
    """
    Detects items in Diablo III bag by scanning grid slots

    Strategy:
    1. Move mouse to each bag slot in column order (1,11,21,31... then 2,12,22,32...)
    2. Capture screenshot at each position
    3. Crop 25% width region to the left of mouse cursor
    4. Match cropped region against item quality templates
    5. Compare consecutive slots to detect 2-slot items (vertical)
    6. Build 2D array of item types

    Bag Layout:
    - 6 rows x 10 columns = 60 slots
    - Some items occupy 2 slots vertically (rows)
    - Scan in column order to detect vertical items
    """

    # Item quality types (from images_tree.md)
    ITEM_TYPES = [
        "item_primal_ancient",      # 太古
        "item_ancient_set",          # 远古套装
        "item_legendary",            # 普通传奇
        "item_rare_yellow",          # 黄装
        "item_rare_blue",            # 蓝装
    ]

    def __init__(self, bag_coordinates: Dict[str, Tuple[int, int]], template_dir: Optional[Path] = None):
        """
        Initialize bag item detector

        Args:
            bag_coordinates: Dictionary with 'top_left' and 'bottom_right' tuples
            template_dir: Directory containing item template images (default: auto-detect)
        """
        self.bag_coords = bag_coordinates
        self.click_handler = ClickHandler()
        self.screenshot_manager = WindowScreenshot()

        # Auto-detect template directory if not provided
        if template_dir is None:
            detector_dir = Path(__file__).parent
            project_root = detector_dir.parent
            template_dir = project_root / "images"

        self.template_dir = Path(template_dir)

        # Load item templates
        self.item_templates = self._load_item_templates()

        # Calculate grid layout
        self.grid_info = self._calculate_grid_layout()

        ColorPrint.green("[BagItemDetector] Initialized")
        ColorPrint.blue(f"[BagItemDetector] Bag: {bag_coordinates['top_left']} -> {bag_coordinates['bottom_right']}")
        ColorPrint.blue(f"[BagItemDetector] Grid: {self.grid_info['rows']}x{self.grid_info['cols']}")
        ColorPrint.blue(f"[BagItemDetector] Loaded {len(self.item_templates)} item templates")

    def _load_item_templates(self) -> Dict[str, np.ndarray]:
        """
        Load item quality template images

        Returns:
            Dictionary mapping item type name to template image
        """
        templates = {}

        for item_type in self.ITEM_TYPES:
            template_path = self.template_dir / f"{item_type}.png"
            if template_path.exists():
                try:
                    template_image = ImageCrop.load_image(template_path)
                    templates[item_type] = template_image
                    ColorPrint.gray(f"[Template] Loaded: {item_type}")
                except Exception as e:
                    ColorPrint.yellow(f"[Template] Failed to load {item_type}: {e}")
            else:
                ColorPrint.yellow(f"[Template] Not found: {template_path}")

        return templates

    def _calculate_grid_layout(self) -> Dict:
        """
        Calculate grid slot positions

        Returns:
            Dictionary with grid information
        """
        top_left = self.bag_coords["top_left"]
        bottom_right = self.bag_coords["bottom_right"]

        width = bottom_right[0] - top_left[0]
        height = bottom_right[1] - top_left[1]

        rows = 6
        cols = 10

        slot_width = width / cols
        slot_height = height / rows

        return {
            "rows": rows,
            "cols": cols,
            "slot_width": slot_width,
            "slot_height": slot_height,
            "top_left": top_left,
            "width": width,
            "height": height
        }

    def _get_slot_center(self, row: int, col: int) -> Tuple[int, int]:
        """
        Get center coordinates of a bag slot

        Args:
            row: Row index (0-5)
            col: Column index (0-9)

        Returns:
            Tuple of (x, y) coordinates
        """
        grid = self.grid_info
        top_left = grid["top_left"]
        slot_width = grid["slot_width"]
        slot_height = grid["slot_height"]

        # Calculate center of slot
        center_x = int(top_left[0] + (col + 0.5) * slot_width)
        center_y = int(top_left[1] + (row + 0.5) * slot_height)

        return (center_x, center_y)

    def _detect_item_quality(self, screenshot: np.ndarray, mouse_x: int, mouse_y: int) -> Optional[str]:
        """
        Detect item quality from screenshot at mouse position

        Args:
            screenshot: Full screenshot image
            mouse_x: Mouse X position
            mouse_y: Mouse Y position

        Returns:
            Item type name or None if no match
        """
        # Calculate 25% width region to the left of mouse
        img_height, img_width = screenshot.shape[:2]
        crop_width = int(img_width * 0.25)

        # Crop region to the left of mouse (from mouse_x - crop_width to mouse_x)
        left_x = max(0, mouse_x - crop_width)
        right_x = mouse_x
        top_y = 0
        bottom_y = img_height

        cropped_region = ImageCrop.crop_region(
            screenshot,
            (left_x, top_y),
            (right_x, bottom_y)
        )

        ColorPrint.gray(f"[Detect] Cropped region at ({mouse_x}, {mouse_y}): {cropped_region.shape}")

        # Try to match against each item template
        best_match = None
        best_score = 0.0

        for item_type, template in self.item_templates.items():
            try:
                found, score, location = ImageComparator.find_template_in_image(
                    cropped_region, template, threshold=0.6
                )

                if found and score > best_score:
                    best_score = score
                    best_match = item_type

            except Exception as e:
                ColorPrint.gray(f"[Detect] Error matching {item_type}: {e}")

        if best_match:
            ColorPrint.green(f"[Detect] Found item: {best_match} (score: {best_score:.3f})")
        else:
            ColorPrint.gray(f"[Detect] No item matched at ({mouse_x}, {mouse_y})")

        return best_match

    def scan_bag(self, delay_between_slots: float = 0.1) -> List[List[Optional[str]]]:
        """
        Scan all bag slots and detect items

        Scanning order: column-wise (1,11,21,31... then 2,12,22,32...)
        This allows detecting 2-slot vertical items

        Args:
            delay_between_slots: Delay between each slot scan (seconds)

        Returns:
            2D array (rows x cols) of item types
            - Single-slot item: one entry
            - 2-slot vertical item: two consecutive entries marked as same
            - Empty slot: None
        """
        ColorPrint.blue("\n[Scan] Starting bag scan...")

        # Initialize result array
        rows = self.grid_info["rows"]
        cols = self.grid_info["cols"]
        result_grid = [[None for _ in range(cols)] for _ in range(rows)]

        # Find Diablo III window
        windows = self.screenshot_manager.find_windows_by_titles(["Diablo III"])
        if not windows:
            ColorPrint.red("[Scan] Diablo III window not found")
            return result_grid

        window_info = windows[0]
        ColorPrint.green(f"[Scan] Found Diablo III window: {window_info['title']}")

        # Scan in column order
        for col in range(cols):
            ColorPrint.blue(f"\n[Scan] Scanning column {col + 1}/{cols}...")

            for row in range(rows):
                # Skip if already marked as part of 2-slot item
                if result_grid[row][col] is not None:
                    ColorPrint.gray(f"[Scan] Slot ({row},{col}) already scanned")
                    continue

                # Get slot center
                center_x, center_y = self._get_slot_center(row, col)
                ColorPrint.blue(f"[Scan] Slot ({row},{col}) at ({center_x}, {center_y})")

                # Move mouse to slot center
                self.click_handler.move_mouse_to(center_x, center_y, duration=0.05)
                time.sleep(delay_between_slots)

                # Capture screenshot
                screenshot_path = self.screenshot_manager.capture_window_screenshot(
                    window_info, filename_prefix=f"bag_scan_r{row}_c{col}"
                )

                if screenshot_path is None:
                    ColorPrint.yellow(f"[Scan] Failed to capture screenshot at ({row},{col})")
                    continue

                # Load screenshot
                screenshot = ImageCrop.load_image(screenshot_path)

                # Detect item quality
                item_type = self._detect_item_quality(screenshot, center_x, center_y)

                if item_type:
                    result_grid[row][col] = item_type

                    # Check next row in same column for 2-slot items
                    if row + 1 < rows:
                        # Move to next row slot
                        next_center_x, next_center_y = self._get_slot_center(row + 1, col)
                        self.click_handler.move_mouse_to(next_center_x, next_center_y, duration=0.05)
                        time.sleep(delay_between_slots)

                        # Capture screenshot of next slot
                        next_screenshot_path = self.screenshot_manager.capture_window_screenshot(
                            window_info, filename_prefix=f"bag_scan_r{row+1}_c{col}"
                        )

                        if next_screenshot_path:
                            next_screenshot = ImageCrop.load_image(next_screenshot_path)
                            next_item_type = self._detect_item_quality(next_screenshot, next_center_x, next_center_y)

                            # If same item type, mark as 2-slot item
                            if next_item_type == item_type:
                                ColorPrint.green(f"[Scan] Detected 2-slot item: {item_type} at ({row},{col})-({row+1},{col})")
                                result_grid[row + 1][col] = f"{item_type}_2slot_bottom"
                                result_grid[row][col] = f"{item_type}_2slot_top"
                else:
                    ColorPrint.gray(f"[Scan] Empty slot at ({row},{col})")

        ColorPrint.green("\n[Scan] Bag scan complete!")
        self._print_scan_results(result_grid)

        return result_grid

    def _print_scan_results(self, result_grid: List[List[Optional[str]]]) -> None:
        """
        Print scan results in a formatted table

        Args:
            result_grid: 2D array of item types
        """
        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("Bag Scan Results")
        ColorPrint.blue("=" * 80)

        rows = len(result_grid)
        cols = len(result_grid[0]) if result_grid else 0

        # Count items
        item_counts = {}
        empty_count = 0

        for row in range(rows):
            for col in range(cols):
                item = result_grid[row][col]
                if item:
                    # Extract base item type (remove _2slot_top/bottom suffix)
                    base_item = item.split("_2slot_")[0] if "_2slot_" in item else item
                    item_counts[base_item] = item_counts.get(base_item, 0) + 1
                else:
                    empty_count += 1

        # Print summary
        ColorPrint.green("\nItem Summary:")
        for item_type, count in sorted(item_counts.items()):
            ColorPrint.green(f"  {item_type}: {count}")
        ColorPrint.gray(f"  Empty slots: {empty_count}")

        # Print grid
        ColorPrint.blue("\nGrid Layout (R=Row, C=Column):")
        ColorPrint.gray("  " + "".join(f"C{c:2d} " for c in range(cols)))

        for row in range(rows):
            row_str = f"R{row} "
            for col in range(cols):
                item = result_grid[row][col]
                if item:
                    # Abbreviate item name
                    if "primal" in item:
                        symbol = "PA"
                    elif "ancient_set" in item:
                        symbol = "AS"
                    elif "legendary" in item:
                        symbol = "LG"
                    elif "rare_yellow" in item:
                        symbol = "RY"
                    elif "rare_blue" in item:
                        symbol = "RB"
                    else:
                        symbol = "??"

                    if "_2slot_top" in item:
                        symbol = symbol + "^"
                    elif "_2slot_bottom" in item:
                        symbol = symbol + "v"

                    row_str += f"{symbol:3s} "
                else:
                    row_str += " .  "

            ColorPrint.gray(row_str)

        ColorPrint.blue("=" * 80 + "\n")

# Example usage
if __name__ == "__main__":
    # Example bag coordinates (from interface detector)
    bag_coords = {
        "top_left": (1337, 707),
        "bottom_right": (1959, 1076)
    }

    # Create detector
    detector = BagItemDetector(bag_coords)

    # Scan bag
    result_grid = detector.scan_bag(delay_between_slots=0.2)
