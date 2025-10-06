#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bag Info Collector
Collects bag coordinates and layout information using standard coordinates
"""

import os
import sys
from pathlib import Path
from typing import Optional, Dict, Tuple
import numpy as np
import cv2

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))

sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint
from d3utils.share import get_game_interface_data, BagCoordinates, BagLayout
from d3utils.share import get_scaled_bag_region, get_global_scale
from d3utils.collectors.collect_tools.bag_layout_detector import BagLayoutDetector
from providor.providor_index import CONFIG, DIABLO_III_WINDOW_TITLES
from d3utils.screenshot_provider import get_screenshot_provider

class BagInfoCollector:
    """
    Bag Information Collector

    Collects:
    - Bag coordinates and dimensions using standard coordinates
    - Bag item layout and quality information
    - Bag opened status detection
    """

    def __init__(self):
        """Initialize bag info collector"""
        self.layout_detector = BagLayoutDetector()
        ColorPrint.green("[BagInfoCollector] Initialized")

    def collect_bag_info(self, screenshot_image: np.ndarray) -> bool:
        """
        Collect comprehensive bag information

        Args:
            screenshot_image: Screenshot image array (BGR format)

        Returns:
            True if collection successful, False otherwise
        """
        ColorPrint.blue("[BagInfoCollector] Starting bag information collection...")
        
        # Step 1: Detect bag border using standard coordinates
        bag_match, match_type, _, _ = self._detect_bag_border()
        if not bag_match:
            ColorPrint.red("[BagInfoCollector] Failed to detect bag border")
            return False
            
        # Step 2: Calculate bag coordinates
        bag_coords = self._calculate_bag_coordinates(bag_match)
        if not bag_coords:
            ColorPrint.red("[BagInfoCollector] Failed to calculate bag coordinates")
            return False
            
        # Step 3: Detect bag layout
        bag_layout = self._detect_bag_layout(screenshot_image, bag_coords)
        if not bag_layout:
            ColorPrint.yellow("[BagInfoCollector] Failed to detect bag layout, but coordinates available")
            
        # Step 4: Update shared data
        shared_data = get_game_interface_data()
        shared_data.bag_coordinates = bag_coords
        shared_data.bag_layout = bag_layout
        
        ColorPrint.green("[BagInfoCollector] Bag information collection completed")
        return True

    def _detect_bag_border(self) -> Tuple[Optional[Dict], Optional[str], Optional[Dict], Optional[Dict]]:
        """Get bag region using standard coordinates"""
            (bag_left_x, bag_top_y), (bag_right_x, bag_bottom_y) = get_scaled_bag_region()

        ColorPrint.green(f"[BagInfoCollector] Bag region: ({bag_left_x}, {bag_top_y}) -> ({bag_right_x}, {bag_bottom_y})")

            synthetic_match = {
                "polygon": [
                [bag_left_x, bag_top_y],
                [bag_right_x, bag_top_y],
                [bag_right_x, bag_bottom_y],
                [bag_left_x, bag_bottom_y]
                ],
                "center": [(bag_left_x + bag_right_x) // 2, (bag_top_y + bag_bottom_y) // 2],
            "match_score": 1.0,
                "template_name": "standard_coordinates"
            }

            return synthetic_match, "standard_coordinates", None, None

    def _calculate_bag_coordinates(self, bag_match: Dict) -> Optional[BagCoordinates]:
        """Calculate bag coordinates from border match"""
        border_left = int(bag_match["polygon"][0][0])
        border_top = int(bag_match["polygon"][0][1])
        border_right = int(bag_match["polygon"][2][0])
        border_bottom = int(bag_match["polygon"][2][1])

            is_standard_coords = bag_match.get("template_name") == "standard_coordinates"

            if is_standard_coords:
            # For standard coordinates, use border coordinates directly (no offset)
            bag_left, bag_top = border_left, border_top
            bag_right, bag_bottom = border_right, border_bottom
            else:
            # For template matching, apply offset
                scale_x, scale_y = get_global_scale()
                bag_offset = CONFIG.get('system_settings', {}).get('bag_offset', {})

            scaled_offset_left = int(bag_offset.get('left', 9) * scale_x)
            scaled_offset_right = int(bag_offset.get('right', 22) * scale_x)
            scaled_offset_top = int(bag_offset.get('top', 0) * scale_y)
            scaled_offset_bottom = int(bag_offset.get('bottom', 0) * scale_y)

            bag_left = border_left + scaled_offset_left
            bag_top = border_top + scaled_offset_top
            bag_right = border_right - scaled_offset_right
            bag_bottom = border_bottom - scaled_offset_bottom

        return BagCoordinates(
                top_left=(bag_left, bag_top),
                bottom_right=(bag_right, bag_bottom),
                width=int(bag_right - bag_left),
                height=int(bag_bottom - bag_top),
                rows=6,
            cols=10
        )

    def _detect_bag_layout(self, screenshot_image: np.ndarray, bag_coords: BagCoordinates) -> Optional[BagLayout]:
        """Detect bag item layout using BagLayoutDetector"""
            top_left = bag_coords.top_left
            bottom_right = bag_coords.bottom_right

        bag_region = screenshot_image[top_left[1]:bottom_right[1], top_left[0]:bottom_right[0]]

            bag_coords_dict = {
            "top_left": top_left,
            "bottom_right": bottom_right,
            "width": bag_coords.width,
            "height": bag_coords.height,
                "rows": bag_coords.rows,
                "cols": bag_coords.cols
            }

        # Use BagLayoutDetector to detect items
        items = self.layout_detector.detect_bag_layout(bag_region, bag_coords)

        return BagLayout(
            items=items,
            coordinates=bag_coords_dict
        )

    def is_bag_opened(self, screenshot_image: np.ndarray) -> bool:
        """
        Check if bag is opened by looking for bag opened indicator

        Args:
            screenshot_image: Screenshot image array (BGR format)

        Returns:
            True if bag is opened, False otherwise
        """
        ColorPrint.blue("[BagInfoCollector] Checking if bag is opened...")
        
        # Use template matching to detect bag opened indicator
        screenshot_provider = get_screenshot_provider()
        screenshot_data = screenshot_provider.gen(
            use_optimized_capture=True,
            window_titles=DIABLO_III_WINDOW_TITLES
        )

        if not screenshot_data or not screenshot_data.game_window_image:
            ColorPrint.red("[BagInfoCollector] Failed to capture screenshot for bag opened check")
            return False

        screenshot_array = np.array(screenshot_data.game_window_image)
        screenshot = cv2.cvtColor(screenshot_array, cv2.COLOR_RGB2BGR)

        # Search for bag opened indicator template
        from d3utils.scaled_template_matcher import get_scaled_template_matcher
        matcher = get_scaled_template_matcher()
        
        result = matcher.match_template_in_region(
            target_image_path=None,  # Use screenshot directly
            template_name="bag_opened_indicator",
                output_dir=None
            )

            if result["total_matches"] > 0:
            ColorPrint.green("[BagInfoCollector] Bag opened indicator found")
            return True

        ColorPrint.yellow("[BagInfoCollector] Bag opened indicator not found")
        return False