#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Region Collector - Anchor Version
Uses template matching on anchor points to detect game window.
Singleton via get_ui_region_collector_anchor(); do not instantiate elsewhere.
"""

import os
import sys
from typing import Dict, Optional, Tuple

from pycore.pyfoundations.third_party.api import get_third_package_cv2, get_third_package_numpy
cv2 = get_third_package_cv2()
np = get_third_package_numpy()
from pathlib import Path
from datetime import datetime
import tempfile

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from d3utils.d3u_common.image_annotator_helper import create_annotator, save_anchor_detection_result, get_tmp_dir, generate_timestamp
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher as get_scaled_template_matcher
from share.game_interface_data import get_game_interface_data, UIRegion
from providor.constants.common import DEBUG, TMP_DIR, BORDER_LINE_COLOR_TOLERANCE_PERCENT
from providor.constants.d3 import D3_STANDARD_RESOLUTION_WIDTH, D3_STANDARD_RESOLUTION_HEIGHT
from providor.providor_index import get_template_path, get_template_threshold, get_template_use_alpha

class UIRegionCollectorAnchor:
    """
    UI Region Collector - Anchor Version

    Uses anchor point template matching to detect game window.
    Best for: When window cache is not available or unreliable.

    Workflow:
    1. Capture fullscreen screenshot
    2. Find anchor points (bottom-right corner) using template matching
    3. Detect border line (for windowed mode) or check fullscreen
    4. Calculate UI region from anchor position
    5. Update shared data
    """

    def __init__(self):
        """Initialize anchor-based UI region collector"""
        self._screenshot_provider = get_screenshot_provider()
        self._template_matcher = get_scaled_template_matcher()
        ColorPrint.green("[UIRegionCollectorAnchor] Initialized")

    def collect(
        self,
        force_new_capture: bool = True,
        save_screenshot: bool = False
    ) -> Optional[UIRegion]:
        """
        Collect UI region using anchor template matching

        Args:
            force_new_capture: Force capture new screenshot (default: True)
            save_screenshot: Save screenshot to disk (default: False)

        Returns:
            UIRegion or None if failed
        """
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("[UIRegionCollectorAnchor] Collecting UI region")
        ColorPrint.blue("=" * 60)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]

        # Step 1: Capture screenshot (no optimized mode, use fullscreen)
        if force_new_capture:
            ColorPrint.blue("[Step 1/3] Generating fullscreen screenshot...")
            screenshot_data = self._screenshot_provider.gen(
                use_optimized_capture=False
            )
        else:
            ColorPrint.blue("[Step 1/3] Using shared screenshot...")
            screenshot_data = self._screenshot_provider.share()

        if screenshot_data is None or screenshot_data.fullscreen_image is None:
            ColorPrint.red("[ERROR] Failed to get screenshot")
            self._update_shared_data_error("Failed to get screenshot", timestamp)
            return None

        ColorPrint.green(f"[Step 1/3] Screenshot ready: {screenshot_data.fullscreen_size[0]}x{screenshot_data.fullscreen_size[1]}")

        # Step 2: Detect window position using anchors
        ColorPrint.blue("[Step 2/3] Detecting window position using anchors...")
        window_position = self._detect_window_position_by_anchors(screenshot_data)
        if not window_position:
            ColorPrint.red("[ERROR] Failed to detect window position")
            self._update_shared_data_error("Failed to detect window position", timestamp)
            return None

        ColorPrint.green(f"[Step 2/3] Window detected: ({window_position['x']}, {window_position['y']}) {window_position['width']}x{window_position['height']}")

        # Step 3: Create UI region
        ColorPrint.blue("[Step 3/3] Creating UI region data...")
        ui_region = UIRegion(
            x=window_position["x"],
            y=window_position["y"],
            width=window_position["width"],
            height=window_position["height"],
            ui_offset_x=window_position["ui_offset_x"],
            ui_offset_y=window_position["ui_offset_y"],
            is_fullscreen=window_position.get("is_fullscreen", False),
            source="anchor_match"
        )

        shared_data = get_game_interface_data()
        shared_data.ui_region = ui_region
        shared_data.timestamp = timestamp
        shared_data.error = None

        if not shared_data.game_window_image:
            ColorPrint.red("[ERROR] Game window image is NULL - anchor detection failed to update shared data")
            self._update_shared_data_error("Game window image is NULL", timestamp)
            return None

        ColorPrint.green(f"[SUCCESS] UI region detected:")
        ColorPrint.green(f"  Position: ({ui_region.x}, {ui_region.y})")
        ColorPrint.green(f"  Size: {ui_region.width}x{ui_region.height}")
        ColorPrint.green(f"  Offset: ({ui_region.ui_offset_x}, {ui_region.ui_offset_y})")
        ColorPrint.green(f"  Fullscreen: {ui_region.is_fullscreen}")
        ColorPrint.green(f"  Source: {ui_region.source}")
        ColorPrint.green(f"  Game window image size: {shared_data.game_window_size}")

        actual_width = screenshot_data.fullscreen_size[0]
        actual_height = screenshot_data.fullscreen_size[1]
        ColorPrint.blue(f"[Resolution] Actual: {actual_width}x{actual_height}, Standard: {D3_STANDARD_RESOLUTION_WIDTH}x{D3_STANDARD_RESOLUTION_HEIGHT}")
        if actual_width != D3_STANDARD_RESOLUTION_WIDTH or actual_height != D3_STANDARD_RESOLUTION_HEIGHT:
            scale_x = actual_width / D3_STANDARD_RESOLUTION_WIDTH
            scale_y = actual_height / D3_STANDARD_RESOLUTION_HEIGHT
            ColorPrint.blue(f"[Resolution] Auto-scaling enabled: {scale_x:.4f}x, {scale_y:.4f}y")

        if save_screenshot:
            saved_paths = self._screenshot_provider.save_current_screenshot()
            if saved_paths:
                ColorPrint.blue(f"[Saved] {saved_paths['fullscreen_path']}")

        return ui_region

    def _detect_window_position_by_anchors(self, screenshot_data) -> Optional[Dict]:
        """
        Detect game window position using anchor point template matching

        Args:
            screenshot_data: Screenshot data from provider

        Returns:
            Dictionary with window position or None
        """
        ColorPrint.blue("[AnchorDetect] Searching for anchor points...")

        # Save screenshot temporarily for template matching
        temp_screenshot_path = Path(tempfile.gettempdir()) / f"temp_fullscreen_{screenshot_data.timestamp}.png"
        screenshot_data.fullscreen_image.save(temp_screenshot_path)

        # Create annotator for drawing detection results
        annotator = create_annotator(temp_screenshot_path)

        # Track all anchor search attempts for annotation
        anchor_search_results = []

        # Variable to store detected border line
        detected_border_line = None

        try:
            # Step 1: Find bottom-right anchor
            bottom_right_template_path = get_template_path("game_anchor_bottom_right")
            if not bottom_right_template_path or not Path(bottom_right_template_path).exists():
                ColorPrint.yellow("[AnchorDetect] Bottom-right template not found")
                return None

            ColorPrint.blue("[AnchorDetect] Searching for bottom-right anchor...")

            # Use ScaledTemplateMatcher with auto-scaling
            result = self._template_matcher.match_template(
                target_image=temp_screenshot_path,
                template_name="game_anchor_bottom_right",
                output_dir=None
            )

            if result["total_matches"] == 0:
                ColorPrint.yellow("[AnchorDetect] Bottom-right anchor not found")
                # Record failed attempt
                anchor_search_results.append({
                    "name": "game_anchor_bottom_right",
                    "found": False,
                    "template_path": bottom_right_template_path
                })
                # Save annotated image
                tmp_dir = get_tmp_dir()
                annotated_path = tmp_dir / f"anchor_detection_{screenshot_data.timestamp}.png"
                save_anchor_detection_result(
                    annotator=annotator,
                    anchor_results=anchor_search_results,
                    timestamp=screenshot_data.timestamp,
                    success=False,
                    save_path=annotated_path,
                    window_rect=None,
                    border_line=None
                )
                return None

            match = result["matches"][0]
            bottom_right_pos = match["center"]
            bottom_right_polygon = match.get("polygon", None)
            ColorPrint.green(f"[AnchorDetect] Found bottom-right anchor at {bottom_right_pos}")

            # Record successful match
            anchor_search_results.append({
                "name": "game_anchor_bottom_right",
                "found": True,
                "position": bottom_right_pos,
                "polygon": bottom_right_polygon,
                "score": match.get("match_score", match.get("num_matches", 0) / 100.0),
                "template_path": bottom_right_template_path
            })

            # Step 2: Detect border line from anchor
            ColorPrint.blue("[BorderDetect] Scanning for vertical border line...")
            detected_border_line = self._detect_border_line_from_anchor(
                temp_screenshot_path=temp_screenshot_path,
                anchor_polygon=bottom_right_polygon,
                anchor_position=bottom_right_pos
            )

            # Calculate anchor dimensions
            if bottom_right_polygon is not None:
                anchor_width = int(np.max(bottom_right_polygon[:, 0]) - np.min(bottom_right_polygon[:, 0]))
                anchor_height = int(np.max(bottom_right_polygon[:, 1]) - np.min(bottom_right_polygon[:, 1]))
                anchor_bottom_right = (int(np.max(bottom_right_polygon[:, 0])), int(np.max(bottom_right_polygon[:, 1])))
            else:
                # Fallback: estimate anchor size
                anchor_width = 50
                anchor_height = 50
                anchor_bottom_right = (int(bottom_right_pos[0] + anchor_width/2), int(bottom_right_pos[1] + anchor_height/2))

            ColorPrint.blue(f"[AnchorDetect] Anchor dimensions: {anchor_width}x{anchor_height}")
            ColorPrint.blue(f"[AnchorDetect] Anchor bottom-right corner: {anchor_bottom_right}")

            screen_width = screenshot_data.fullscreen_size[0]
            screen_height = screenshot_data.fullscreen_size[1]

            # Step 3: Get game window offset from screenshot_data
            # In optimized mode, screenshot_data.fullscreen_image is actually game window
            # We need the game window's position relative to actual fullscreen
            game_window_offset_x = screenshot_data.window_offset[0]
            game_window_offset_y = screenshot_data.window_offset[1]

            ColorPrint.blue(f"[WindowOffset] Game window offset from screenshot_data: ({game_window_offset_x}, {game_window_offset_y})")

            # Step 4: Calculate UI region
            ui_region = None
            ui_offset_x = 0
            ui_offset_y = 0
            is_fullscreen = False

            if detected_border_line:
                # Case 1: Border line found - windowed mode
                ColorPrint.green(f"[BorderDetect] Found border line: {detected_border_line}")

                # Calculate UI region
                ui_bottom_right_x = anchor_bottom_right[0] + int(anchor_width * 0.30)
                ui_bottom_right_y = anchor_bottom_right[1] + int(anchor_height * 0.85)

                ui_top_left_x = detected_border_line["end_x"]
                ui_top_left_y = detected_border_line["start_y"]

                ui_width = ui_bottom_right_x - ui_top_left_x
                ui_height = ui_bottom_right_y - ui_top_left_y

                ui_region = {
                    "x": ui_top_left_x,
                    "y": ui_top_left_y,
                    "width": ui_width,
                    "height": ui_height
                }

                # Calculate UI offset relative to actual fullscreen
                # = game_window_offset + ui_offset_relative_to_game_window
                ui_offset_x = game_window_offset_x + ui_top_left_x
                ui_offset_y = game_window_offset_y + ui_top_left_y

                ColorPrint.green(f"[UIRegion] Windowed mode: ({ui_top_left_x}, {ui_top_left_y}) {ui_width}x{ui_height}")
                ColorPrint.blue(f"[UIRegion] UI offset relative to fullscreen: ({ui_offset_x}, {ui_offset_y})")

            else:
                # Case 2: No border line - check if fullscreen
                ColorPrint.yellow("[BorderDetect] No border line, checking for fullscreen mode...")

                distance_from_right = screen_width - anchor_bottom_right[0]
                distance_from_bottom = screen_height - anchor_bottom_right[1]

                threshold_width = anchor_width * 2.5
                threshold_height = anchor_height * 2.5

                ColorPrint.blue(f"[Fullscreen Check] Distance from right: {distance_from_right}, threshold: {threshold_width}")
                ColorPrint.blue(f"[Fullscreen Check] Distance from bottom: {distance_from_bottom}, threshold: {threshold_height}")

                if distance_from_right <= threshold_width and distance_from_bottom <= threshold_height:
                    # Fullscreen mode detected
                    is_fullscreen = True

                    ui_region = {
                        "x": 0,
                        "y": 0,
                        "width": screen_width,
                        "height": screen_height
                    }

                    # In fullscreen, UI region is the entire game window
                    # UI offset = game window offset (which is 0 in true fullscreen)
                    ui_offset_x = game_window_offset_x
                    ui_offset_y = game_window_offset_y

                    ColorPrint.green(f"[UIRegion] Fullscreen mode: (0, 0) {screen_width}x{screen_height}")
                    ColorPrint.blue(f"[UIRegion] UI offset relative to fullscreen: ({ui_offset_x}, {ui_offset_y})")
                else:
                    ColorPrint.yellow(f"[UIRegion] Anchor not in fullscreen position")
                    tmp_dir = get_tmp_dir()
                    annotated_path = tmp_dir / f"anchor_detection_{screenshot_data.timestamp}.png"
                    save_anchor_detection_result(
                        annotator=annotator,
                        anchor_results=anchor_search_results,
                        timestamp=screenshot_data.timestamp,
                        success=False,
                        save_path=annotated_path,
                        window_rect=None,
                        border_line=None
                    )
                    return None

            if ui_region is None:
                ColorPrint.red("[UIRegion] Failed to determine UI region")
                return None

            # Crop UI region from fullscreen and update both provider and shared data
            ui_image = screenshot_data.fullscreen_image.crop((
                ui_region["x"],
                ui_region["y"],
                ui_region["x"] + ui_region["width"],
                ui_region["y"] + ui_region["height"]
            ))
            screenshot_data.game_window_image = ui_image
            ColorPrint.green(f"[UIRegion] Created game_window_image: {ui_region['width']}x{ui_region['height']}")
            shared_data = get_game_interface_data()
            shared_data.game_window_image = ui_image
            shared_data.game_window_size = (ui_region["width"], ui_region["height"])
            ColorPrint.green(f"[UIRegion] Updated shared_data.game_window_image")
            if DEBUG:
                debug_ui_path = TMP_DIR / f"debug_ui_anchor_{screenshot_data.timestamp}.png"
                ui_image.save(debug_ui_path)
                ColorPrint.gray(f"[DEBUG] Saved UI region (anchor): {debug_ui_path}")

            # Save annotated image
            tmp_dir = get_tmp_dir()
            annotated_path = tmp_dir / f"anchor_detection_{screenshot_data.timestamp}.png"
            save_anchor_detection_result(
                annotator=annotator,
                anchor_results=anchor_search_results,
                timestamp=screenshot_data.timestamp,
                success=True,
                save_path=annotated_path,
                window_rect=(ui_region["x"], ui_region["y"], ui_region["width"], ui_region["height"]),
                border_line=detected_border_line
            )

            return {
                "x": ui_region["x"],
                "y": ui_region["y"],
                "width": ui_region["width"],
                "height": ui_region["height"],
                "ui_offset_x": ui_offset_x,
                "ui_offset_y": ui_offset_y,
                "is_fullscreen": is_fullscreen,
                "source": "anchor_match"
            }

        finally:
            # Clean up temporary file
            try:
                if temp_screenshot_path.exists():
                    temp_screenshot_path.unlink()
            except OSError:
                pass

    @staticmethod
    def _colors_match_with_tolerance(color1: Tuple[int, int, int], color2: Tuple[int, int, int], tolerance_percent: float = BORDER_LINE_COLOR_TOLERANCE_PERCENT) -> bool:
        """Check if two colors match within tolerance"""
        for c1, c2 in zip(color1, color2):
            tolerance = c1 * tolerance_percent
            lower_bound = c1 - tolerance
            upper_bound = c1 + tolerance
            if not (lower_bound <= c2 <= upper_bound):
                return False
        return True

    def _detect_border_line_from_anchor(
        self,
        temp_screenshot_path: Path,
        anchor_polygon: Optional[np.ndarray],
        anchor_position: Tuple[float, float]
    ) -> Optional[Dict]:
        """
        Detect border line by scanning upward from anchor top-left corner

        Returns:
            Dictionary with line info or None
        """
        img = cv2.imread(str(temp_screenshot_path))
        if img is None:
            ColorPrint.red("[BorderDetect] Failed to load screenshot")
            return None

        img_height, img_width = img.shape[:2]
        if anchor_polygon is not None:
            top_left_idx = np.argmin(anchor_polygon[:, 0] + anchor_polygon[:, 1])
            start_x = int(anchor_polygon[top_left_idx, 0])
            start_y = int(anchor_polygon[top_left_idx, 1])
        else:
            start_x = int(anchor_position[0])
            start_y = int(anchor_position[1])

        ColorPrint.blue(f"[BorderDetect] Starting scan from ({start_x}, {start_y})")
        for y in range(start_y, -1, -1):
            if y < 0 or y >= img_height:
                continue
            if start_x < 0 or start_x >= img_width:
                continue
            reference_color = tuple(img[y, start_x])
            consecutive_count = 0
            left_x = start_x
            while left_x >= 0:
                current_color = tuple(img[y, left_x])
                if self._colors_match_with_tolerance(reference_color, current_color):
                    consecutive_count += 1
                    left_x -= 1
                else:
                    break
            if consecutive_count > 600:
                line_end_x = left_x + 1
                line_start_x = start_x
                line_length = consecutive_count
                ColorPrint.green(f"[BorderDetect] Found border line at y={y}")
                ColorPrint.green(f"[BorderDetect] Length: {line_length} pixels")
                return {
                    "start_x": line_start_x,
                    "start_y": y,
                    "end_x": line_end_x,
                    "end_y": y,
                    "length": line_length,
                    "color": reference_color
                }
        ColorPrint.yellow("[BorderDetect] No border line > 600 pixels found")
        return None

    def _update_shared_data_error(self, error_msg: str, timestamp: str) -> None:
        """Update shared data with error"""
        shared_data = get_game_interface_data()
        shared_data.error = error_msg
        shared_data.timestamp = timestamp


_ui_region_collector_anchor_instance: Optional[UIRegionCollectorAnchor] = None


def get_ui_region_collector_anchor() -> UIRegionCollectorAnchor:
    """Return the global UIRegionCollectorAnchor instance (singleton)."""
    global _ui_region_collector_anchor_instance
    if _ui_region_collector_anchor_instance is None:
        _ui_region_collector_anchor_instance = UIRegionCollectorAnchor()
    return _ui_region_collector_anchor_instance


# Example usage
if __name__ == "__main__":
    collector = UIRegionCollectorAnchor()
    ui_region = collector.collect(force_new_capture=True, save_screenshot=True)

    if ui_region:
        print(f"\nUI Region collected:")
        print(f"  Position: ({ui_region.x}, {ui_region.y})")
        print(f"  Size: {ui_region.width}x{ui_region.height}")
        print(f"  Fullscreen: {ui_region.is_fullscreen}")
    else:
        print("\nFailed to collect UI region")
