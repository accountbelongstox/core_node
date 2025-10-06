#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Button Put Material Detector
Specialized detector for button_put_material_alt button
Uses 9-grid region capture for optimized detection
"""

import os
import sys
from typing import Optional, Dict
from pathlib import Path

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))

sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.scaled_template_matcher import get_scaled_template_matcher
from providor.providor_index import DIABLO_III_WINDOW_TITLES

class ButtonPutMaterialDetector:
    """
    Specialized detector for button_put_material_alt

    This button is only visible when Kanai's Cube right panel is opened.
    Uses 9-grid region 7 (bottom-right) for optimized detection.

    9-grid layout (0-indexed):
    0 1 2
    3 4 5
    6 7 8

    button_put_material_alt is in region 7 (row 2, col 1)
    """

    def __init__(self):
        """Initialize detector"""
        self.cached_result: Optional[Dict] = None
        self.matcher = get_scaled_template_matcher()
        ColorPrint.green("[ButtonPutMaterialDetector] Initialized")

    def detect(
        self,
        panel_opened: bool = False,
        force_redetect: bool = False
    ) -> Optional[Dict]:
        """
        Detect button_put_material_alt button

        Args:
            panel_opened: True if Kanai right panel is confirmed opened
            force_redetect: Force re-detection even if cached

        Returns:
            Match result dict with 'center', 'polygon', 'match_score', or None if not found
        """
        ColorPrint.blue("[ButtonPutMaterialDetector] ===== Starting RELIABLE detection =====")
        ColorPrint.blue(f"[ButtonPutMaterialDetector] Parameters:")
        ColorPrint.blue(f"[ButtonPutMaterialDetector]   - panel_opened: {panel_opened}")
        ColorPrint.blue(f"[ButtonPutMaterialDetector]   - force_redetect: {force_redetect}")
        ColorPrint.blue(f"[ButtonPutMaterialDetector]   - cached_result exists: {self.cached_result is not None}")

        # Use cached result if available and not forcing re-detection
        if self.cached_result and not force_redetect:
            ColorPrint.green("[ButtonPutMaterialDetector] Using cached RELIABLE result")
            ColorPrint.green(f"[ButtonPutMaterialDetector]   - Cached position: {self.cached_result['center']}")
            return self.cached_result

        # Only detect if panel is confirmed opened
        if not panel_opened:
            ColorPrint.red("[ButtonPutMaterialDetector] Detection BLOCKED: Panel not confirmed opened")
            ColorPrint.red("[ButtonPutMaterialDetector]   - Cannot perform reliable detection")
            ColorPrint.red("[ButtonPutMaterialDetector]   - Please open panel first using _toggle_kanai_right_panel()")
            return None

        try:
            ColorPrint.blue("[ButtonPutMaterialDetector] Panel confirmed opened, starting detection...")
            ColorPrint.blue("[ButtonPutMaterialDetector] Using 9-grid capture (grid region 7)")

            # Get screenshot provider
            provider = get_screenshot_provider()

            # Capture grid region 7 (bottom-right area where button is located)
            # IMPORTANT: use_cache=False to ensure fresh window detection after panel toggle
            ColorPrint.blue("[ButtonPutMaterialDetector] Capturing grid region 7 (fresh capture, no cache)...")
            grid_image = provider.gen_grid_region(
                window_titles=DIABLO_III_WINDOW_TITLES,
                grid_type='9grid',
                grid_index=7,  # Region 7 (row 2, col 1)
                use_cache=False  # Force fresh window detection after panel animation
            )

            if not grid_image:
                ColorPrint.red("[ButtonPutMaterialDetector] Failed to capture grid region 7")
                return None

            ColorPrint.green(f"[ButtonPutMaterialDetector] Grid region captured successfully")
            ColorPrint.gray(f"[ButtonPutMaterialDetector]   - Grid image size: {grid_image.size}")

            # Save grid region for matching and debugging
            temp_dir = Path.home() / ".core_node" / "pytools" / "tmp"
            temp_dir.mkdir(parents=True, exist_ok=True)

            # Save with timestamp for debugging
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            debug_path = temp_dir / f"debug_grid7_region_{timestamp}.png"
            grid_image.save(debug_path)
            ColorPrint.blue(f"[ButtonPutMaterialDetector]   - Debug image saved: {debug_path}")

            # Save to standard path for matching
            grid_path = temp_dir / "put_material_button_search_region.png"
            grid_image.save(grid_path)
            ColorPrint.gray(f"[ButtonPutMaterialDetector]   - Saved to: {grid_path}")

            # Match template in grid region
            ColorPrint.blue("[ButtonPutMaterialDetector] Matching template in grid region...")
            result = self.matcher.match_template(
                target_image=str(grid_path),
                template_name="button_put_material_alt",
                output_dir=None
            )

            ColorPrint.blue(f"[ButtonPutMaterialDetector] Match result - total_matches: {result['total_matches']}")

            if result["total_matches"] == 0:
                ColorPrint.yellow("[ButtonPutMaterialDetector] Button not found in grid region 7")
                ColorPrint.yellow("[ButtonPutMaterialDetector]   - This may indicate panel is not fully loaded")
                return None

            # Get match result (coordinates are relative to grid region)
            match_in_grid = result["matches"][0]
            ColorPrint.green("[ButtonPutMaterialDetector] Button found in grid region!")
            ColorPrint.green(f"[ButtonPutMaterialDetector]   - Match score: {match_in_grid.get('match_score', 'N/A')}")
            ColorPrint.green(f"[ButtonPutMaterialDetector]   - Position in grid: {match_in_grid['center']}")

            # Calculate grid region offset in game window
            # Grid 7 is at row 2, col 1 (bottom-middle position)
            # Need to get game window size to calculate grid position
            ColorPrint.blue("[ButtonPutMaterialDetector] Converting grid coordinates to game window coordinates...")
            ColorPrint.blue("[ButtonPutMaterialDetector] Capturing full game window to get size...")
            screenshot_data = provider.gen(
                use_optimized_capture=True,
                window_titles=DIABLO_III_WINDOW_TITLES
            )

            if not screenshot_data or not screenshot_data.game_window_size:
                ColorPrint.red("[ButtonPutMaterialDetector] Cannot get game window size")
                return None

            game_width, game_height = screenshot_data.game_window_size
            ColorPrint.gray(f"[ButtonPutMaterialDetector]   - Game window size: {game_width}x{game_height}")

            # Calculate grid cell size (3x3 grid)
            grid_cell_width = game_width // 3
            grid_cell_height = game_height // 3
            ColorPrint.gray(f"[ButtonPutMaterialDetector]   - Grid cell size: {grid_cell_width}x{grid_cell_height}")

            # Grid 7 offset: row 2 (index 2), col 1 (index 1)
            grid_offset_x = grid_cell_width * 1  # col 1
            grid_offset_y = grid_cell_height * 2  # row 2
            ColorPrint.gray(f"[ButtonPutMaterialDetector]   - Grid 7 offset: ({grid_offset_x}, {grid_offset_y})")

            # Convert coordinates from grid region to game window
            button_x = grid_offset_x + match_in_grid["center"][0]
            button_y = grid_offset_y + match_in_grid["center"][1]
            ColorPrint.green(f"[ButtonPutMaterialDetector]   - Final position in game window: ({button_x}, {button_y})")

            # Convert polygon if available
            polygon_in_window = None
            if "polygon" in match_in_grid and match_in_grid["polygon"] is not None:
                import numpy as np
                polygon_in_grid = match_in_grid["polygon"]
                polygon_in_window = polygon_in_grid.copy()
                polygon_in_window[:, 0] += grid_offset_x
                polygon_in_window[:, 1] += grid_offset_y
                ColorPrint.gray(f"[ButtonPutMaterialDetector]   - Polygon converted to window coordinates")

            # Create result dict
            button_match = {
                "center": (button_x, button_y),
                "polygon": polygon_in_window,
                "match_score": match_in_grid.get("match_score", match_in_grid.get("num_matches", 0) / 100.0)
            }

            # Cache the result (only cache when panel is opened = reliable detection)
            self.cached_result = button_match
            ColorPrint.green("[ButtonPutMaterialDetector] ===== Detection SUCCESSFUL (RELIABLE) =====")
            ColorPrint.green(f"[ButtonPutMaterialDetector] Button position: ({button_x}, {button_y})")
            ColorPrint.green(f"[ButtonPutMaterialDetector] Result cached for future use")
            ColorPrint.green(f"[ButtonPutMaterialDetector] Reliability: TRUE (panel confirmed opened)")

            return button_match

        except Exception as e:
            ColorPrint.red(f"[ButtonPutMaterialDetector] Error during detection: {e}")
            import traceback
            traceback.print_exc()
            return None

    def clear_cache(self):
        """Clear cached result"""
        self.cached_result = None
        ColorPrint.gray("[ButtonPutMaterialDetector] Cache cleared")

# Singleton instance
_detector_instance = None

def get_button_put_material_detector() -> ButtonPutMaterialDetector:
    """Get singleton detector instance"""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = ButtonPutMaterialDetector()
    return _detector_instance
