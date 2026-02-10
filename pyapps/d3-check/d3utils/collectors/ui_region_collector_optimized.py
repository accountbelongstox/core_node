#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Region Collector - Optimized Version
Uses window cache from encyclopedia for fast detection
"""

# Standard library imports
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

# Third-party imports
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_cv2, get_third_package_numpy

Image = get_third_package_PIL_Image()
cv2 = get_third_package_cv2()
np = get_third_package_numpy()
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.image_annotator import ImageAnnotator

# Local imports
from d3utils.d3u_common.image_annotator_helper import get_tmp_dir, generate_timestamp
from d3utils.screenshot_provider import get_screenshot_provider
from share.game_interface_data import get_game_interface_data, UIRegion
from providor.constants.common import DEBUG, TMP_DIR
from providor.constants.d3 import D3_STANDARD_RESOLUTION_WIDTH, D3_STANDARD_RESOLUTION_HEIGHT
from providor.providor_index import DIABLO_III_WINDOW_TITLES

class UIRegionCollectorOptimized:
    """
    UI Region Collector - Optimized Version

    Uses encyclopedia window cache for fast window detection.
    Best for: Quick detection when game window is already cached.

    Workflow:
    1. Generate screenshot with optimized capture (uses window cache)
    2. Get window position from encyclopedia cache
    3. Create UI region from window position
    4. Update shared data
    """

    def __init__(self):
        """Initialize optimized UI region collector"""
        self._screenshot_provider = get_screenshot_provider()
        ColorPrint.green("[UIRegionCollectorOptimized] Initialized")

    def collect(
        self,
        force_new_capture: bool = True,
        save_screenshot: bool = False
    ) -> Optional[UIRegion]:
        """
        Collect UI region using optimized window cache

        Args:
            force_new_capture: Force capture new screenshot (default: True)
            save_screenshot: Save screenshot to disk (default: False)

        Returns:
            UIRegion or None if failed
        """
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("[UIRegionCollectorOptimized] Collecting UI region")
        ColorPrint.blue("=" * 60)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]

        # Step 1: Capture screenshot with optimized mode (creates/uses window cache)
        if force_new_capture:
            ColorPrint.blue("[Step 1/3] Generating screenshot with optimized capture...")
            screenshot_data = self._screenshot_provider.gen(
                use_optimized_capture=True,  # Use optimized capture (faster, uses cache)
                window_titles=DIABLO_III_WINDOW_TITLES
            )
        else:
            ColorPrint.blue("[Step 1/3] Using shared screenshot...")
            screenshot_data = self._screenshot_provider.share()

        if screenshot_data is None:
            ColorPrint.red("[ERROR] Failed to get screenshot")
            self._update_shared_data_error("Failed to get screenshot", timestamp)
            return None

        ColorPrint.green(f"[Step 1/3] Screenshot ready: {screenshot_data.fullscreen_size[0]}x{screenshot_data.fullscreen_size[1]}")

        # Step 2: Get window position from encyclopedia cache
        ColorPrint.blue("[Step 2/3] Getting window position from cache...")

        # Same canonical cache key as WindowFinder (first title only)
        canonical_label = DIABLO_III_WINDOW_TITLES[0] if DIABLO_III_WINDOW_TITLES else ""
        cache_key = f"window_cache_{canonical_label.lower()}" if canonical_label else None
        window_info = ENCYCLOPEDIA.get(cache_key) if cache_key else None
        if window_info:
            ColorPrint.green(f"[Cache] Found window info for '{canonical_label}'")

        if not window_info:
            ColorPrint.red("[ERROR] Window not found in cache")
            ColorPrint.yellow("[Hint] Please ensure the game window was captured with optimized mode")
            self._update_shared_data_error("Window not found in cache", timestamp)
            return None

        ColorPrint.green(f"[Step 2/3] Window position: ({window_info['left']}, {window_info['top']})")
        ColorPrint.green(f"  Size: {window_info['width']}x{window_info['height']}")

        # Step 3: Create UI region
        ColorPrint.blue("[Step 3/3] Creating UI region data...")

        ui_region = UIRegion(
            x=window_info["left"],
            y=window_info["top"],
            width=window_info["width"],
            height=window_info["height"],
            ui_offset_x=window_info["left"],
            ui_offset_y=window_info["top"],
            is_fullscreen=False,  # Cached windows are typically not fullscreen
            source="window_cache_optimized"
        )

        # Update shared data
        shared_data = get_game_interface_data()
        shared_data.ui_region = ui_region
        shared_data.timestamp = timestamp
        shared_data.error = None

        # In optimized mode, fullscreen_image is not captured (set to NULL for compatibility)
        # Only game_window_image is available (captured directly by screenshot_provider)
        # This prevents potential errors if other code checks fullscreen_image
        if shared_data.fullscreen_image is None:
            ColorPrint.gray("[UIRegion] Fullscreen image is NULL (optimized mode - only game window captured)")

        # Ensure game_window_image is available for downstream components
        if not shared_data.game_window_image:
            ColorPrint.red("[ERROR] Game window image is NULL - screenshot provider may have failed")
            self._update_shared_data_error("Game window image is NULL", timestamp)
            return None

        ColorPrint.green(f"[SUCCESS] UI region detected:")
        ColorPrint.green(f"  Position: ({ui_region.x}, {ui_region.y})")
        ColorPrint.green(f"  Size: {ui_region.width}x{ui_region.height}")
        ColorPrint.green(f"  Offset: ({ui_region.ui_offset_x}, {ui_region.ui_offset_y})")
        ColorPrint.green(f"  Source: {ui_region.source}")

        # Log resolution info
        actual_width = screenshot_data.fullscreen_size[0]
        actual_height = screenshot_data.fullscreen_size[1]
        ColorPrint.blue(f"[Resolution] Actual: {actual_width}x{actual_height}, Standard: {D3_STANDARD_RESOLUTION_WIDTH}x{D3_STANDARD_RESOLUTION_HEIGHT}")
        if actual_width != D3_STANDARD_RESOLUTION_WIDTH or actual_height != D3_STANDARD_RESOLUTION_HEIGHT:
            scale_x = actual_width / D3_STANDARD_RESOLUTION_WIDTH
            scale_y = actual_height / D3_STANDARD_RESOLUTION_HEIGHT
            ColorPrint.blue(f"[Resolution] Auto-scaling enabled: {scale_x:.4f}x, {scale_y:.4f}y")

        # In optimized mode, fullscreen_image IS the game window (already captured)
        # No cropping needed - game_window_image is already set in screenshot_provider
        ColorPrint.green(f"[UIRegion] Using game window directly (optimized mode): {window_info['width']}x{window_info['height']}")
        ColorPrint.yellow("[UIRegion] Note: Using full game window (includes borders)")
        ColorPrint.yellow("[UIRegion] For accurate UI region, use UIRegionCollectorAnchor instead")

        # Save debug copy if DEBUG mode is enabled
        if DEBUG and screenshot_data.game_window_image:
            debug_ui_path = TMP_DIR / f"debug_ui_optimized_{timestamp}.png"
            screenshot_data.game_window_image.save(debug_ui_path)
            ColorPrint.gray(f"[DEBUG] Saved UI region (optimized): {debug_ui_path}")

        # Save annotated screenshot if requested
        if save_screenshot:
            self._save_annotated_screenshot(
                screenshot_data=screenshot_data,
                ui_region=ui_region,
                window_info=window_info
            )

        return ui_region

    def _save_annotated_screenshot(
        self,
        screenshot_data,
        ui_region: UIRegion,
        window_info: Dict
    ) -> None:
        """
        Save annotated screenshot with UI region visualization

        Args:
            screenshot_data: Screenshot data from provider
            ui_region: Detected UI region
            window_info: Window info from cache
        """
        ColorPrint.blue("[Save] Creating annotated screenshot...")

        # Use in-memory image (no temp file): prefer game_window_image in optimized mode
        pil_img = screenshot_data.game_window_image or screenshot_data.fullscreen_image
        if pil_img is None:
            ColorPrint.yellow("[Save] No image available for annotation")
            return
        img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        annotator = ImageAnnotator(img_bgr)

        # Draw UI region: on game_window_image use (0,0)-(w,h); on fullscreen use (x,y)-(x+w,y+h)
        if screenshot_data.game_window_image is not None:
            rx, ry = 0, 0
            rw, rh = ui_region.width, ui_region.height
        else:
            rx, ry = ui_region.x, ui_region.y
            rw, rh = ui_region.width, ui_region.height
        annotator.draw_rectangle(
            top_left=(rx, ry),
            bottom_right=(rx + rw, ry + rh),
            color=(0, 255, 0),
            thickness=3
        )

        # Draw label
        label_text = f"UI Region (Cache): {ui_region.width}x{ui_region.height}"
        annotator.draw_text(
            text=label_text,
            position=(rx + 10, ry + 30),
            font_scale=0.8,
            color=(0, 255, 0),
            thickness=2
        )

        # Draw info text
        info_lines = [
            f"Source: {ui_region.source}",
            f"Window: {window_info['title']}" if 'title' in window_info else "Window: (cached)",
            f"Position: ({ui_region.x}, {ui_region.y})",
            f"Size: {ui_region.width}x{ui_region.height}",
            f"Timestamp: {screenshot_data.timestamp}"
        ]

        y_offset = 30
        for i, line in enumerate(info_lines):
            annotator.draw_text(
                text=line,
                position=(10, y_offset + i * 25),
                font_scale=0.6,
                color=(255, 255, 255),
                thickness=2,
                bg_color=(0, 0, 0)
            )

        # Save annotated image to tmp only when this method is called (save_screenshot=True)
        tmp_dir = get_tmp_dir()
        annotated_path = tmp_dir / f"optimized_detection_{screenshot_data.timestamp}.png"
        annotator.save(annotated_path)
        ColorPrint.green(f"[Save] Annotated screenshot saved: {annotated_path}")

    def _update_shared_data_error(self, error_msg: str, timestamp: str) -> None:
        """Update shared data with error"""
        shared_data = get_game_interface_data()
        shared_data.error = error_msg
        shared_data.timestamp = timestamp

