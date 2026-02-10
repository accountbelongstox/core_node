#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bag Information Collector
Collects bag coordinates and layout information
Updates shared game interface data
"""

# Standard library imports
import os
import sys
from pathlib import Path
from typing import Optional, Dict, Tuple

# Third-party imports
from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy

cv2 = get_third_package_cv2()
numpy = get_third_package_numpy()
np = numpy

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

# Project imports
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.image_annotator import ImageAnnotator
from share.game_interface_data import (
    get_game_interface_data,
    BagCoordinates,
    BagLayout,
    DetectionResult,
    get_scaled_bag_region,
    get_global_scale,
    scale_standard_value_to_actual,
    WINDOW_BORDER_LEFT,
    WINDOW_BORDER_RIGHT,
    TITLE_BAR_HEIGHT,
    WINDOW_BORDER_BOTTOM,
)
from d3utils.collectors.collect_tools.bag_layout_detector import BagLayoutDetector
from d3utils.d3u_common import draw_match_result
from d3utils.d3u_common.image_annotator_helper import get_tmp_dir, generate_timestamp, get_image_pil
from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher as get_scaled_template_matcher
from providor.providor_index import (
    CONFIG,
    get_template_path
)


class BagInfoCollector:
    """
    Bag Information Collector

    Collects bag-related information and updates shared data

    Responsibilities:
    - Detect bag border coordinates
    - Detect bag item layout
    - Calculate bag grid positions
    - Update shared data with bag offset
    """

    def __init__(self):
        """Initialize bag info collector"""
        # Use ScaledTemplateMatcher for automatic template scaling
        self.scaled_matcher = get_scaled_template_matcher()
        self.bag_layout_detector = BagLayoutDetector(rows=6, cols=10)

        ColorPrint.green("[BagInfoCollector] Initialized with ScaledTemplateMatcher")

    def collect(self, force_refresh: bool = False, save_screenshot: bool = False) -> Optional[BagCoordinates]:
        """
        Collect bag information and update shared data

        Workflow:
        1. Check if UI region exists in shared data
        2. Get screenshot from shared data (in-memory)
        3. Detect bag border using template matching (in-memory)
        4. Calculate bag coordinates with offset
        5. Detect bag layout (items)
        6. Update shared data

        Args:
            force_refresh: Force re-detection even if data exists
            save_screenshot: Save annotated screenshot with detection results

        Returns:
            BagCoordinates or None if detection failed
        """
        ColorPrint.blue("\n[BagInfoCollector] Collecting bag information...")

        # Get shared data
        shared_data = get_game_interface_data()

        # Check UI region
        if not shared_data.has_ui_region():
            ColorPrint.red("[BagInfoCollector] No UI region in shared data")
            ColorPrint.yellow("[BagInfoCollector] Please call UI region collector first")
            return None

        # Check if already exists
        if not force_refresh and shared_data.has_bag_data():
            ColorPrint.green("[BagInfoCollector] Using existing bag data from shared data")
            return shared_data.bag_coordinates

        # Get game_window_image from shared data (set by UI region collector)
        if not shared_data.game_window_image:
            ColorPrint.red("[BagInfoCollector] No game window image in shared data")
            ColorPrint.yellow("[BagInfoCollector] UI region collector must be called first to capture screenshot")
            return None

        # Convert PIL image to numpy array once for all cv2 operations
        screenshot_image = cv2.cvtColor(np.array(shared_data.game_window_image), cv2.COLOR_RGB2BGR)
        ColorPrint.gray(f"[BagInfoCollector] Game window image array shape: {screenshot_image.shape}")

        try:
            # Step 1: Check if bag is opened using bag_opened_indicator
            ColorPrint.blue("[BagInfoCollector] Step 1: Checking if bag is opened...")
            bag_opened = self._check_bag_opened(shared_data.game_window_image)

            if not bag_opened:
                ColorPrint.yellow("[BagInfoCollector] Bag is not opened - stopping collection")
                return None

            ColorPrint.green("[BagInfoCollector] Bag is opened - proceeding with border detection")

            # Step 2: Detect bag border with resolution scaling (use PIL Image directly, no temp file)
            bag_match, template_path, bag_buttom_match, bag_left_match = self._detect_bag_border(
                shared_data.game_window_image,  # Pass PIL Image directly
                screenshot_image,
                shared_data
            )

            if not bag_match:
                ColorPrint.yellow("[BagInfoCollector] Bag border not detected")
                # Save partial detection results to share
                shared_data.bag_buttom_match = bag_buttom_match
                shared_data.bag_left_match = bag_left_match
                # Optionally save detection result (in-memory only when save_screenshot=False)
                self._save_comprehensive_detection_result(
                    screenshot_image=screenshot_image,
                    detection_success=False,
                    save_to_disk=save_screenshot
                )
                return None

            # Calculate bag coordinates with offset
            bag_coords = self._calculate_bag_coordinates(bag_match)

            if not bag_coords:
                ColorPrint.yellow("[BagInfoCollector] Failed to calculate bag coordinates")
                return None

            # Detect bag layout
            bag_layout = self._detect_bag_layout(screenshot_image, bag_coords)

            # Detect interface buttons and type
            # Note: _detect_interface_buttons updates shared_data.button_detections internally
            self._detect_interface_buttons(shared_data.game_window_image, shared_data)

            # Update shared data with all detection results
            shared_data.bag_coordinates = bag_coords
            shared_data.bag_layout = bag_layout
            shared_data.bag_buttom_match = bag_buttom_match
            shared_data.bag_left_match = bag_left_match

            ColorPrint.green(f"[BagInfoCollector] Bag detected: {bag_coords.top_left} -> {bag_coords.bottom_right}")
            ColorPrint.green(f"[BagInfoCollector] Grid: {bag_coords.rows}x{bag_coords.cols} ({bag_coords.total_slots} slots)")

            # Draw annotation in memory; save to disk only when save_screenshot=True
            self._save_comprehensive_detection_result(
                screenshot_image=screenshot_image,
                detection_success=True,
                save_to_disk=save_screenshot
            )

            return bag_coords

        except Exception as e:
            ColorPrint.red(f"[BagInfoCollector] Error in collect: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _check_bag_opened(self, game_window_image) -> bool:
        """
        Check if bag is opened using bag_opened_indicator template

        Args:
            game_window_image: PIL Image of game window

        Returns:
            True if bag is opened, False otherwise
        """
        try:
            ColorPrint.blue("[BagInfoCollector] Detecting bag_opened_indicator...")

            # Get template path
            template_path = get_template_path("bag_opened_indicator")
            if not template_path or not Path(template_path).exists():
                ColorPrint.gray("[BagInfoCollector] bag_opened_indicator template not found")
                return False

            # Match template using scaled_matcher
            result = self.scaled_matcher.match_template(
                target_image=game_window_image,  # PIL Image directly
                template_name="bag_opened_indicator",
                output_dir=None
            )

            if result["total_matches"] > 0:
                ColorPrint.green("[BagInfoCollector] bag_opened_indicator FOUND - Bag is opened")
                return True
            else:
                ColorPrint.yellow("[BagInfoCollector] bag_opened_indicator NOT FOUND - Bag is closed")
                return False

        except Exception as e:
            ColorPrint.red(f"[BagInfoCollector] Error checking bag opened: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _detect_bag_border(
        self,
        game_window_image,  # PIL Image
        screenshot_image: np.ndarray,  # numpy array for dimension checking
        shared_data
    ) -> Tuple[Optional[Dict], Optional[str], Optional[Dict], Optional[Dict]]:
        """
        Get bag region using standard coordinates with resolution scaling

        Uses fixed standard coordinates (864, 422) to (1286, 637) at base 1300x800;
        was (1209, 680)-(1801, 1036) at 1826x1301. Scales by actual game window size.

        Args:
            game_window_image: PIL Image (not used, kept for compatibility)
            screenshot_image: numpy array for dimension checking
            shared_data: Shared game interface data (not used, kept for compatibility)

        Returns:
            Tuple of (synthetic_match or None, method_name, None, None)
        """
        try:
            ColorPrint.blue("[BagInfoCollector] Getting bag region from standard coordinates...")

            # Get scaled bag region from standard coordinates
            (bag_left_x, bag_top_y), (bag_right_x, bag_bottom_y) = get_scaled_bag_region()

            ColorPrint.green(f"[BagInfoCollector] Bag region (standard coordinates):")
            ColorPrint.green(f"  Top-left: ({bag_left_x}, {bag_top_y})")
            ColorPrint.green(f"  Bottom-right: ({bag_right_x}, {bag_bottom_y})")
            ColorPrint.green(f"  Width: {bag_right_x - bag_left_x}, Height: {bag_bottom_y - bag_top_y}")

            # Create synthetic match result compatible with _calculate_bag_coordinates
            # Format: polygon with [top-left, top-right, bottom-right, bottom-left]
            synthetic_match = {
                "polygon": [
                    [bag_left_x, bag_top_y],           # Top-left
                    [bag_right_x, bag_top_y],          # Top-right
                    [bag_right_x, bag_bottom_y],       # Bottom-right
                    [bag_left_x, bag_bottom_y]         # Bottom-left
                ],
                "center": [(bag_left_x + bag_right_x) // 2, (bag_top_y + bag_bottom_y) // 2],
                "match_score": 1.0,  # Perfect match (fixed coordinates)
                "template_name": "standard_coordinates"
            }

            return synthetic_match, "standard_coordinates", None, None

        except Exception as e:
            ColorPrint.red(f"[BagInfoCollector] Error getting bag coordinates: {e}")
            import traceback
            traceback.print_exc()
            return None, None, None, None

    def _calculate_bag_coordinates(self, bag_match: Dict) -> Optional[BagCoordinates]:
        """
        Calculate bag coordinates from border match

        For standard_coordinates: use coordinates directly without offset
        For template matching: apply offset from config

        Args:
            bag_match: Bag border match result

        Returns:
            BagCoordinates or None
        """
        try:
            # Get border position (convert to int)
            border_left = int(bag_match["polygon"][0][0])  # Top-left X
            border_top = int(bag_match["polygon"][0][1])   # Top-left Y
            border_right = int(bag_match["polygon"][2][0])  # Bottom-right X
            border_bottom = int(bag_match["polygon"][2][1]) # Bottom-right Y

            # Apply crop offset only when UI "use offset in calculation" is checked; otherwise skip (same as 0,0,0,0)
            use_offset = bool(CONFIG.get("ui_analysis", {}).get("bag_offset", {}).get("use_in_calculation", False))
            bag_offset = CONFIG.get("ui_analysis", {}).get("bag_offset", {}) or CONFIG.get("system_settings", {}).get("bag_offset", {})
            if use_offset:
                bag_offset_left = bag_offset.get("left", 0)
                bag_offset_right = bag_offset.get("right", 0)
                bag_offset_top = bag_offset.get("top", 0)
                bag_offset_bottom = bag_offset.get("bottom", 0)
            else:
                bag_offset_left = bag_offset_right = bag_offset_top = bag_offset_bottom = 0

            scale_x, scale_y = get_global_scale()
            # Offset in standard outer space: subtract border -> scale -> add border (see COORDINATE_SCALE_SPEC.md)
            scaled_offset_left = scale_standard_value_to_actual(bag_offset_left, scale_x, WINDOW_BORDER_LEFT)
            scaled_offset_right = scale_standard_value_to_actual(bag_offset_right, scale_x, WINDOW_BORDER_RIGHT)
            scaled_offset_top = scale_standard_value_to_actual(bag_offset_top, scale_y, TITLE_BAR_HEIGHT)
            scaled_offset_bottom = scale_standard_value_to_actual(bag_offset_bottom, scale_y, WINDOW_BORDER_BOTTOM)

            bag_left = int(border_left + scaled_offset_left)
            bag_top = int(border_top + scaled_offset_top)
            bag_right = int(border_right - scaled_offset_right)
            bag_bottom = int(border_bottom - scaled_offset_bottom)

            is_standard_coords = bag_match.get("template_name") == "standard_coordinates"
            if is_standard_coords:
                ColorPrint.blue(f"[BagInfoCollector] Standard coordinates" + (" with offset" if use_offset else " (offset skipped):"))
            else:
                ColorPrint.blue(f"[BagInfoCollector] Template matching" + (" with offset" if use_offset else " (offset skipped):"))
            ColorPrint.blue(f"  Bag region: ({bag_left}, {bag_top}) -> ({bag_right}, {bag_bottom})")
            ColorPrint.blue(f"  Dimensions: {bag_right - bag_left}x{bag_bottom - bag_top}")

            # Create BagCoordinates
            bag_coords = BagCoordinates(
                top_left=(bag_left, bag_top),
                bottom_right=(bag_right, bag_bottom),
                width=int(bag_right - bag_left),
                height=int(bag_bottom - bag_top),
                rows=6,
                cols=10,
                total_slots=60
            )

            # Validate coordinates
            if bag_left < 0 or bag_top < 0:
                ColorPrint.red(f"[BagInfoCollector] ERROR: Negative bag coordinates! ({bag_left}, {bag_top})")
            if bag_right <= bag_left or bag_bottom <= bag_top:
                ColorPrint.red(f"[BagInfoCollector] ERROR: Invalid bag dimensions! Width={bag_right - bag_left}, Height={bag_bottom - bag_top}")

            return bag_coords

        except Exception as e:
            ColorPrint.red(f"[BagInfoCollector] Error calculating bag coordinates: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _detect_bag_layout(self, screenshot_image: np.ndarray, bag_coords: BagCoordinates) -> Optional[BagLayout]:
        """
        Detect bag item layout

        Args:
            screenshot_image: Screenshot image as numpy array (BGR format, full game window)
            bag_coords: Bag coordinates

        Returns:
            BagLayout or None
        """
        try:
            ColorPrint.blue("[BagInfoCollector] Detecting bag layout...")

            # screenshot_image is already a numpy array in BGR format (full game window)
            # Crop bag region
            top_left = bag_coords.top_left
            bottom_right = bag_coords.bottom_right

            bag_region = screenshot_image[
                top_left[1]:bottom_right[1],
                top_left[0]:bottom_right[0]
            ]

            # Detect layout
            bag_coords_dict = {
                "top_left": bag_coords.top_left,
                "bottom_right": bag_coords.bottom_right,
                "rows": bag_coords.rows,
                "cols": bag_coords.cols
            }

            layout_result = self.bag_layout_detector.detect_layout(bag_region, bag_coords_dict)

            if layout_result:
                bag_layout = BagLayout(
                    layout=layout_result["layout"],
                    items=layout_result["items"]
                )
                ColorPrint.green("[BagInfoCollector] Bag layout detected")
                return bag_layout
            else:
                ColorPrint.yellow("[BagInfoCollector] Bag layout detection failed")
                return None

        except Exception as e:
            ColorPrint.red(f"[BagInfoCollector] Error detecting bag layout: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _save_comprehensive_detection_result(
        self,
        screenshot_image: np.ndarray,
        detection_success: bool,
        save_to_disk: bool = False
    ) -> None:
        """
        Draw comprehensive detection result in memory; optionally save to tmp dir.
        Screenshot is only ever used in memory. When save_to_disk=False, nothing is written to disk.
        """
        if screenshot_image is None:
            return
        try:
            annotator = ImageAnnotator(screenshot_image)
            self._draw_comprehensive_detection_annotation(annotator, detection_success)
            if save_to_disk:
                timestamp = generate_timestamp()
                tmp_dir = get_tmp_dir()
                annotated_path = tmp_dir / f"bag_comprehensive_{timestamp}.png"
                annotated_path.parent.mkdir(parents=True, exist_ok=True)
                annotator.save(annotated_path)
                ColorPrint.green(f"[BagInfoCollector] Saved comprehensive result: {annotated_path}")
        except Exception as e:
            ColorPrint.red(f"[BagInfoCollector] Error in comprehensive detection result: {e}")
            import traceback
            traceback.print_exc()

    def get_annotated_detection_image(
        self,
        screenshot_image: np.ndarray,
        detection_success: bool
    ):
        """
        Draw comprehensive detection result in memory and return as PIL Image (RGB).
        Same content as _save_comprehensive_detection_result: status, offset,
        bag_buttom/bag_left, bag rectangle, _draw_bag_layout_grid, button legend.
        No file is written.

        Args:
            screenshot_image: BGR numpy array (game window image)
            detection_success: Whether bag was detected

        Returns:
            PIL.Image or None on error
        """
        if screenshot_image is None:
            return None
        try:
            annotator = ImageAnnotator(screenshot_image)
            self._draw_comprehensive_detection_annotation(annotator, detection_success)
            return get_image_pil(annotator)
        except Exception as e:
            ColorPrint.red(f"[BagInfoCollector] get_annotated_detection_image: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _draw_comprehensive_detection_annotation(
        self,
        annotator: ImageAnnotator,
        detection_success: bool
    ) -> None:
        """
        Draw comprehensive bag detection annotation on the given annotator.
        Reads shared_data and draws status, offsets, bag_buttom/bag_left, grid, legend.
        """
        shared_data = get_game_interface_data()
        bag_buttom_match = shared_data.bag_buttom_match
        bag_left_match = shared_data.bag_left_match
        bag_coords = shared_data.bag_coordinates
        bag_layout = shared_data.bag_layout
        button_detections = shared_data.button_detections

        scale_x, scale_y = get_global_scale()

        # Define color palette for different detections
        COLORS = {
            'bag_detection': (0, 255, 0) if detection_success else (0, 0, 255),  # Green/Red
            'resolution': (128, 128, 128),  # Gray
            'offset': (64, 64, 64),  # Dark gray
            'interface_type': (0, 128, 255),  # Orange
            'bag_buttom': (255, 0, 255),  # Magenta
            'bag_left': (255, 255, 0),  # Cyan
            'conversion_enabled': (0, 255, 0),  # Green
            'conversion_disabled': (0, 0, 255),  # Red
            'material_button': (255, 0, 255),  # Magenta
            'interface_indicator': (255, 128, 0),  # Blue-ish
        }

        # Text positions (y-coordinate, line by line)
        text_y = 30
        line_height = 40

        # Draw summary status
        if detection_success:
            summary_text = "Bag Detection: SUCCESS"
        else:
            summary_text = "Bag Detection: FAILED"

        annotator.draw_text(
            text=summary_text,
            position=(10, text_y),
            color=(255, 255, 255),
            font_scale=0.8,
            thickness=2,
            background_color=COLORS['bag_detection']
        )
        text_y += line_height

        # Draw resolution scale info
        scale_text = f"Resolution Scale: {scale_x:.2%} x {scale_y:.2%}"
        annotator.draw_text(
            text=scale_text,
            position=(10, text_y),
            color=(255, 255, 255),
            font_scale=0.6,
            thickness=2,
            background_color=COLORS['resolution']
        )
        text_y += line_height

        # Get bag offset from CONFIG
        bag_offset = CONFIG.get('system_settings', {}).get('bag_offset', {})
        bag_offset_left = bag_offset.get('left', 9)
        bag_offset_right = bag_offset.get('right', 22)
        bag_offset_top = bag_offset.get('top', 0)
        bag_offset_bottom = bag_offset.get('bottom', 0)

        # Draw offset configuration
        offset_text = f"Offset Config: L={bag_offset_left}, R={bag_offset_right}, T={bag_offset_top}, B={bag_offset_bottom}"
        annotator.draw_text(
            text=offset_text,
            position=(10, text_y),
            color=(255, 255, 255),
            font_scale=0.5,
            thickness=1,
            background_color=COLORS['offset']
        )
        text_y += line_height

        # Scaled offset display
        scaled_offset_left = int(bag_offset_left * scale_x)
        scaled_offset_right = int(bag_offset_right * scale_x)
        scaled_offset_top = int(bag_offset_top * scale_y)
        scaled_offset_bottom = int(bag_offset_bottom * scale_y)

        scaled_offset_text = f"Scaled Offset: L={scaled_offset_left}, R={scaled_offset_right}, T={scaled_offset_top}, B={scaled_offset_bottom}"
        annotator.draw_text(
            text=scaled_offset_text,
            position=(10, 135),
            color=(255, 255, 255),
            font_scale=0.5,
            thickness=1,
            background_color=(64, 64, 64)
        )

        # Calculate and display offset percentages if bag was detected
        if detection_success and bag_coords:
            # Calculate border dimensions (before offset applied)
            border_width = bag_coords.width + scaled_offset_left + scaled_offset_right
            border_height = bag_coords.height + scaled_offset_top + scaled_offset_bottom

            # Calculate offset percentages
            offset_left_pct = (scaled_offset_left / border_width * 100) if border_width > 0 else 0
            offset_right_pct = (scaled_offset_right / border_width * 100) if border_width > 0 else 0
            offset_top_pct = (scaled_offset_top / border_height * 100) if border_height > 0 else 0
            offset_bottom_pct = (scaled_offset_bottom / border_height * 100) if border_height > 0 else 0

            offset_pct_text = f"Offset %: L={offset_left_pct:.1f}% R={offset_right_pct:.1f}% T={offset_top_pct:.1f}% B={offset_bottom_pct:.1f}%"
            annotator.draw_text(
                text=offset_pct_text,
                position=(10, 165),
                color=(255, 255, 255),
                font_scale=0.5,
                thickness=1,
                background_color=(64, 128, 64)
            )

            # Display final bag dimensions
            bag_dims_text = f"Bag Size: {bag_coords.width}x{bag_coords.height}px ({bag_coords.rows}x{bag_coords.cols} grid)"
            annotator.draw_text(
                text=bag_dims_text,
                position=(10, 195),
                color=(255, 255, 255),
                font_scale=0.5,
                thickness=1,
                background_color=(128, 64, 128)
            )

        # Draw bag_buttom match result (annotation layout: scaled from 300 at 1826x1301)
        template_x_offset = 10
        template_y_offset = 184   # was 300 at 1826x1301
        if bag_buttom_match:
            bag_buttom_path = get_template_path("bag_buttom")
            draw_match_result(
                annotator=annotator,
                match_result=bag_buttom_match,
                name="bag_buttom",
                color=(0, 255, 0),  # Green
                template_path=bag_buttom_path,
                draw_template=True,
                template_position=(template_x_offset, template_y_offset)
            )
            template_x_offset += 213  # was 300 at 1826x1301
        else:
            # Draw "NOT FOUND" text
            annotator.draw_text(
                text="bag_buttom: NOT FOUND",
                position=(10, 200),
                color=(255, 255, 255),
                font_scale=0.6,
                thickness=2,
                background_color=(0, 0, 255)
            )

        # Draw bag_left match result
        if bag_left_match:
            bag_left_path = get_template_path("bag_left")
            draw_match_result(
                annotator=annotator,
                match_result=bag_left_match,
                name="bag_left",
                color=(255, 165, 0),  # Orange
                template_path=bag_left_path,
                draw_template=True,
                template_position=(template_x_offset, template_y_offset)
            )

            # Also draw bag_left bottom edge line (which is bag's top edge)
            polygon = bag_left_match.get("polygon")
            if polygon is not None and (not isinstance(polygon, np.ndarray) or polygon.size > 0):
                bottom_left = (int(polygon[3][0]), int(polygon[3][1]))
                bottom_right = (int(polygon[2][0]), int(polygon[2][1]))
                annotator.draw_line(
                    start=bottom_left,
                    end=bottom_right,
                    color=(255, 255, 0),  # Cyan - highlights the important edge
                    thickness=3
                )
                annotator.draw_text(
                    text="bag_left BOTTOM = bag TOP",
                    position=(bottom_left[0], bottom_left[1] + 20),
                    color=(255, 255, 0),
                    font_scale=0.5,
                    thickness=2,
                    background_color=(0, 0, 0)
                )
        else:
            annotator.draw_text(
                text="bag_left: NOT FOUND",
                position=(10, 240),
                color=(255, 255, 255),
                font_scale=0.6,
                thickness=2,
                background_color=(0, 0, 255)
            )

        # Draw bag area and grid if detection succeeded
        if detection_success and bag_coords:
            annotator.draw_rectangle(
                top_left=bag_coords.top_left,
                bottom_right=bag_coords.bottom_right,
                color=(255, 0, 255),  # Magenta
                thickness=3,
                label=f"Bag: {bag_coords.width}x{bag_coords.height}"
            )

            if bag_layout is not None:
                ColorPrint.blue("[BagInfoCollector] Drawing bag layout grid...")
                from d3utils.d3u_common.image_annotator_helper import _draw_bag_layout_grid
                _draw_bag_layout_grid(
                    annotator=annotator,
                    bag_coords=bag_coords,
                    bag_layout=bag_layout
                )

        # Draw ALL detection results with appropriate colors
        self._draw_all_detection_results(annotator, button_detections, COLORS)

        # Draw legend and detection results summary in top-left corner
        legend_x = 10
        legend_y = 230
        legend_line_height = 35

        annotator.draw_text(
            text="Detection Results:",
            position=(legend_x, legend_y),
            color=(255, 255, 255),
            font_scale=0.7,
            thickness=2,
            background_color=(50, 50, 50)
        )
        legend_y += legend_line_height

        interface_indicators = [
            ("blacksmith_indicator_1", "blacksmith", COLORS['interface_indicator']),
            ("blacksmith_indicator_2", "blacksmith", (255, 200, 0))
        ]

        for indicator_name, type_name, color in interface_indicators:
            found = False
            if button_detections and indicator_name in button_detections:
                indicator_detection = button_detections[indicator_name]
                if indicator_detection and hasattr(indicator_detection, 'match'):
                    found = True

            status_color = (0, 255, 0) if found else (128, 128, 128)
            if found and indicator_name in button_detections:
                detection_result = button_detections[indicator_name]
                status_text = self._get_status_text_with_coordinates(detection_result, indicator_name)
            else:
                status_text = "NOT FOUND"

            annotator.draw_rectangle(
                top_left=(legend_x, legend_y - 20),
                bottom_right=(legend_x + 25, legend_y - 5),
                color=color,
                thickness=-1
            )
            annotator.draw_text(
                text=f"{type_name}: {status_text}",
                position=(legend_x + 35, legend_y),
                color=(255, 255, 255),
                font_scale=0.5,
                thickness=1,
                background_color=status_color
            )
            legend_y += legend_line_height

        # Conversion button
        conv_found = button_detections and button_detections.get('conversion_button') is not None
        conv_status = "NOT FOUND"
        conv_color = (128, 128, 128)
        if conv_found:
            conv_data = button_detections['conversion_button']
            state = conv_data.state
            conv_color = COLORS['conversion_enabled'] if state == 'enabled' else COLORS['conversion_disabled']
            default_status = f"FOUND ({state.upper()})" if state else "FOUND"
            conv_status = self._get_status_text_with_coordinates(conv_data, 'conversion_button', default_status)

        annotator.draw_rectangle(
            top_left=(legend_x, legend_y - 20),
            bottom_right=(legend_x + 25, legend_y - 5),
            color=conv_color,
            thickness=-1
        )
        annotator.draw_text(
            text=f"Conversion Button: {conv_status}",
            position=(legend_x + 35, legend_y),
            color=(255, 255, 255),
            font_scale=0.5,
            thickness=1,
            background_color=conv_color
        )
        legend_y += legend_line_height

        # Material button
        mat_found = button_detections and button_detections.get('material_button') is not None
        mat_status = "FOUND" if mat_found else "NOT FOUND"
        mat_color = COLORS['material_button'] if mat_found else (128, 128, 128)
        if mat_found:
            mat_data = button_detections['material_button']
            mat_status = self._get_status_text_with_coordinates(mat_data, 'material_button')

        annotator.draw_rectangle(
            top_left=(legend_x, legend_y - 20),
            bottom_right=(legend_x + 25, legend_y - 5),
            color=mat_color,
            thickness=-1
        )
        annotator.draw_text(
            text=f"Material Button: {mat_status}",
            position=(legend_x + 35, legend_y),
            color=(255, 255, 255),
            font_scale=0.5,
            thickness=1,
            background_color=mat_color
        )

    def _safe_extract_coordinates(self, center, template_name="unknown"):
        """
        Safely extract coordinates from various data types (numpy arrays, lists, tuples, etc.)

        Args:
            center: Center coordinate data (could be numpy array, list, tuple, etc.)
            template_name: Name of template for error logging

        Returns:
            Tuple[int, int] or None if extraction fails
        """
        if center is None:
            return None

        try:
            # Handle numpy arrays
            if hasattr(center, 'size') and center.size >= 2:
                return int(float(center[0])), int(float(center[1]))

            # Handle lists, tuples, and other sequence types
            elif isinstance(center, (list, tuple)) or (hasattr(center, '__len__') and len(center) >= 2):
                return int(float(center[0])), int(float(center[1]))

            # Handle objects with x, y attributes
            elif hasattr(center, 'x') and hasattr(center, 'y'):
                return int(float(center.x)), int(float(center.y))

            # Handle dict with x, y keys
            elif isinstance(center, dict) and 'x' in center and 'y' in center:
                return int(float(center['x'])), int(float(center['y']))

            else:
                ColorPrint.yellow(f"[BagInfoCollector] Unsupported center coordinate format for {template_name}: {type(center)} - {center}")
                return None

        except (ValueError, TypeError, IndexError, AttributeError) as e:
            ColorPrint.yellow(f"[BagInfoCollector] Error extracting coordinates for {template_name}: {e}, center: {center}")
            return None

    def _get_status_text_with_coordinates(self, detection_result, template_name, default_status="FOUND"):
        """
        Helper method to get status text with coordinates if available

        Args:
            detection_result: DetectionResult object
            template_name: Name of the template for logging
            default_status: Default status text (e.g., "FOUND", "FOUND (ENABLED)")

        Returns:
            Status text with coordinates if available, otherwise default status
        """
        if not detection_result or not hasattr(detection_result, 'match') or not detection_result.match:
            return default_status

        match = detection_result.match
        if not isinstance(match, dict) or 'center' not in match:
            return default_status

        center = match['center']
        coords = self._safe_extract_coordinates(center, template_name)

        if coords is None:
            return default_status

        center_x, center_y = coords

        # Handle special cases with additional state information
        if template_name == 'conversion_button' and hasattr(detection_result, 'state'):
            state = detection_result.state
            state_part = f" ({state.upper()})" if state else ""
            return f"FOUND{state_part} ({center_x}, {center_y})"

        return f"FOUND ({center_x}, {center_y})"

    def _draw_all_detection_results(self, annotator, button_detections, COLORS):
        """
        Draw detection boxes for ALL found templates with appropriate colors

        This method iterates through all detection results in button_detections
        and draws detection boxes with colors based on template types.

        Args:
            annotator: ImageAnnotator instance
            button_detections: Dict[str, DetectionResult] with all detection results
            COLORS: Color palette dictionary
        """
        if not button_detections:
            ColorPrint.gray("[BagInfoCollector] No button detections to draw")
            return

        ColorPrint.blue(f"[BagInfoCollector] Drawing detection boxes for {len(button_detections)} templates")

        # Template type to color mapping (extended)
        template_color_map = {
            # Interface indicators
            'blacksmith_indicator_1': (255, 200, 0),  # Orange-yellow
            'blacksmith_indicator_2': (255, 165, 0),  # Orange
            'kanai_cube_left_panel_indicator': (128, 0, 128),  # Purple
            'kanai_right_page_indicator': (0, 128, 255),  # Orange-blue

            # Functional buttons
            'conversion_button': (0, 255, 0),  # Green when enabled, Red when disabled
            'material_button': (255, 0, 255),  # Magenta
            'upgrade_button': (0, 255, 128),  # Lime green
            'reforge_button': (255, 128, 0),  # Blue-orange

            # Map elements
            'waypoint_indicator': (0, 255, 255),  # Cyan
            'health_orb': (255, 0, 0),  # Red
            'resource_orb': (0, 0, 255),  # Blue
            'inventory_indicator': (255, 255, 0),  # Yellow
            'skill_bar_indicator': (128, 0, 255),  # Purple
            'minimap_indicator': (0, 165, 255),  # Blue

            # UI elements
            'close_button': (0, 0, 255),  # Red
            'cancel_button': (128, 128, 128),  # Gray
            'accept_button': (0, 255, 0),  # Green
            'tab_button': (255, 165, 0),  # Orange

            # Item quality indicators
            'legendary_item': (255, 128, 0),  # Orange
            'set_item': (0, 255, 0),  # Green
            'rare_item': (255, 255, 0),  # Yellow
            'magic_item': (0, 128, 255),  # Blue
            'common_item': (128, 128, 128),  # Gray

            # Bag elements (already handled separately)
            'bag_buttom': (0, 255, 0),  # Green
            'bag_left': (255, 165, 0),  # Orange
            'bag_grid': (192, 192, 192),  # Silver

            # NPC and interaction elements
            'npc_indicator': (255, 0, 255),  # Magenta
            'dialogue_box': (0, 128, 128),  # Teal
            'quest_marker': (255, 215, 0),  # Gold

            # Default color for unknown templates
            'default': (128, 128, 128)  # Gray
        }

        drawn_count = 0

        for template_name, detection_result in button_detections.items():
            if detection_result is None:
                continue

            # Get match data from DetectionResult object
            if not hasattr(detection_result, 'match') or detection_result.match is None:
                continue

            match_data = detection_result.match

            # Skip bag templates since they're already handled separately
            if template_name in ['bag_buttom', 'bag_left']:
                continue

            # Get appropriate color for this template type
            color = template_color_map.get(template_name, template_color_map['default'])

            # Special handling for conversion button based on state
            if template_name == 'conversion_button' and hasattr(detection_result, 'state'):
                if detection_result.state == 'enabled':
                    color = (0, 255, 0)  # Green
                elif detection_result.state == 'disabled':
                    color = (0, 0, 255)  # Red
                else:
                    color = (255, 255, 0)  # Yellow for unknown state

            # Draw detection polygon if available
            if isinstance(match_data, dict) and 'polygon' in match_data:
                polygon = match_data['polygon']
                if polygon is not None and len(polygon) > 0:
                    annotator.draw_polygon(
                        points=polygon,
                        color=color,
                        thickness=3
                    )
                    ColorPrint.green(f"[BagInfoCollector] Drew polygon for {template_name}")

            # Draw center point and label
            center = match_data.get('center') if isinstance(match_data, dict) else None
            if center is not None:
                coords = self._safe_extract_coordinates(center, template_name)

                if coords is not None:
                    center_x, center_y = coords

                    # Draw center circle
                    annotator.draw_circle(
                        center=(center_x, center_y),
                        radius=8,
                        color=color,
                        filled=True
                    )

                    # Draw template name label
                    label = template_name.replace('_', ' ').upper()
                    annotator.draw_text(
                        text=label,
                        position=(center_x + 15, center_y),
                        color=(255, 255, 255),
                        font_scale=0.6,
                        thickness=2,
                        background_color=color
                    )

                    ColorPrint.green(f"[BagInfoCollector] Drew center and label for {template_name} at ({center_x}, {center_y})")
                    drawn_count += 1
                else:
                    ColorPrint.yellow(f"[BagInfoCollector] Failed to extract coordinates for {template_name}")
            else:
                ColorPrint.yellow(f"[BagInfoCollector] No center coordinate found for {template_name}")

        ColorPrint.green(f"[BagInfoCollector] Successfully drew detection boxes for {drawn_count} templates")

    def _detect_interface_buttons(self, game_window_image, shared_data) -> Dict:
        """
        Detect interface type and functional buttons

        Detection logic (simplified):
        1. Check blacksmith indicators (blacksmith_indicator_1 or blacksmith_indicator_2):
           - If found → interface_type = "blacksmith"

        2. Check Kanai's Cube left panel indicator (kanai_cube_left_panel_indicator):
           - If found → interface_type = "kanai_cube"

        3. If neither found → No functional interface opened

        Updates shared_data with:
        - interface_type: "blacksmith", "kanai_cube", or None
        - button_detections: Dict[str, DetectionResult]

        Note: Conversion button uses get_scaled_conversion_button() (standard (207,618); was (290,1005) at 1826x1301)

        Args:
            game_window_image: PIL Image for template matching
            shared_data: Shared game interface data

        Returns:
            Dict with detection results for visualization (legacy format)
        """
        ColorPrint.blue("\n[BagInfoCollector] Detecting interface type...")

        # Store detection results using DetectionResult structure
        button_detections: Dict[str, DetectionResult] = {}

        # Legacy detection_results for visualization compatibility
        detection_results = {
            'interface_indicators': {},
            'conversion_button': None,
            'material_button': None
        }

        interface_type = None

        # ============================================================
        # Step 1: Check if in Blacksmith (check indicators 1 or 2)
        # ============================================================
        ColorPrint.blue("[BagInfoCollector] Step 1: Checking blacksmith indicators...")

        blacksmith_indicators = [
            ("blacksmith_indicator_1", "blacksmith"),
            ("blacksmith_indicator_2", "blacksmith")
        ]

        for indicator_name, type_name in blacksmith_indicators:
            template_path = get_template_path(indicator_name)
            if not template_path or not Path(template_path).exists():
                ColorPrint.gray(f"[BagInfoCollector] Template not found: {indicator_name}")
                continue

            ColorPrint.blue(f"[BagInfoCollector] Detecting {indicator_name}...")
            result = self.scaled_matcher.match_template(
                target_image=game_window_image,  # PIL Image directly
                template_name=indicator_name,
                output_dir=None
            )

            if result["total_matches"] > 0:
                ColorPrint.green(f"[BagInfoCollector] {indicator_name} FOUND → Blacksmith interface detected")

                # Store in button_detections
                button_detections[indicator_name] = DetectionResult(
                    match=result["matches"][0],
                    reliable=True,
                    state=None
                )

                # Set interface type
                interface_type = "blacksmith"
                shared_data.interface_type = interface_type
                ColorPrint.green(f"[BagInfoCollector] Interface type: {interface_type}")

                # Found blacksmith, no need to check conversion button
                break
            else:
                ColorPrint.gray(f"[BagInfoCollector] {indicator_name} not found")

        # ============================================================
        # Step 2: If not blacksmith, check Kanai's Cube left panel indicator
        # ============================================================
        if not interface_type:
            ColorPrint.blue("[BagInfoCollector] Step 2: Checking Kanai's Cube left panel indicator...")

            # Detect kanai_cube_left_panel_indicator
            indicator_path = get_template_path("kanai_cube_left_panel_indicator")
            if indicator_path and Path(indicator_path).exists():
                indicator_result = self.scaled_matcher.match_template(
                    target_image=game_window_image,  # PIL Image directly
                    template_name="kanai_cube_left_panel_indicator",
                    output_dir=None
                )

                if indicator_result["total_matches"] > 0:
                    ColorPrint.green("[BagInfoCollector] kanai_cube_left_panel_indicator FOUND → Kanai Cube interface detected")

                    # Store in button_detections
                    button_detections['kanai_cube_left_panel_indicator'] = DetectionResult(
                        match=indicator_result["matches"][0],
                        reliable=True,
                        state=None
                    )

                    # Set interface type
                    interface_type = "kanai_cube"
                    shared_data.interface_type = interface_type
                    ColorPrint.green(f"[BagInfoCollector] Interface type: {interface_type}")
                else:
                    ColorPrint.gray("[BagInfoCollector] kanai_cube_left_panel_indicator not found")
            else:
                ColorPrint.gray("[BagInfoCollector] kanai_cube_left_panel_indicator template not found")

        # ============================================================
        # Step 3: Final result
        # ============================================================
        if not interface_type:
            ColorPrint.yellow("[BagInfoCollector] No functional interface detected")
            ColorPrint.yellow("[BagInfoCollector]   - Not in Blacksmith (no indicators found)")
            ColorPrint.yellow("[BagInfoCollector]   - Not in Kanai Cube (no conversion button found)")
        else:
            ColorPrint.green(f"[BagInfoCollector] Interface detection complete: {interface_type}")

        # ============================================================
        # Additional detections (only if Kanai Cube)
        # ============================================================
        if interface_type == "kanai_cube":
            # Note: interface_type == "kanai_cube" already means left panel is opened
            # No need to detect kanai_panel_opened separately

            # Detect if Kanai's Cube right page is opened
            ColorPrint.blue("[BagInfoCollector] Detecting if Kanai's Cube right page is opened...")
            right_page_path = get_template_path("kanai_right_page_indicator")
            if right_page_path and Path(right_page_path).exists():
                right_page_result = self.scaled_matcher.match_template(
                    target_image=game_window_image,  # PIL Image directly
                    template_name="kanai_right_page_indicator",
                    output_dir=None
                )

                if right_page_result["total_matches"] > 0:
                    shared_data.kanai_right_page_opened = True
                    ColorPrint.green("[BagInfoCollector] Kanai's Cube right page is OPENED")
                else:
                    shared_data.kanai_right_page_opened = False
                    ColorPrint.yellow("[BagInfoCollector] Kanai's Cube right page is CLOSED")
            else:
                ColorPrint.gray("[BagInfoCollector] kanai_right_page_indicator template not found")
                shared_data.kanai_right_page_opened = None

        # Update shared_data with button_detections
        shared_data.button_detections = button_detections

        return detection_results


# Example usage
if __name__ == "__main__":
    collector = BagInfoCollector()
    bag_coords = collector.collect()

    if bag_coords:
        ColorPrint.green(f"\nBag collected:")
        ColorPrint.blue(f"  Top-left: {bag_coords.top_left}")
        ColorPrint.blue(f"  Bottom-right: {bag_coords.bottom_right}")
        ColorPrint.blue(f"  Size: {bag_coords.width}x{bag_coords.height}")
