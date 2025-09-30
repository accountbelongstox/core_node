#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Interface Property Detector
Detects Diablo III game interface properties from screenshots
"""

import os
import sys
import numpy as np
from typing import List, Optional, Tuple, Dict, Union
from pathlib import Path

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
ncore_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(current_dir))), "ncore")
sys.path.insert(0, project_root)
sys.path.insert(0, ncore_path)

from pytools.pyfoundations.color_print import ColorPrint
from pytools.pyutils.image_matcher import ImageMatcher
from pytools.pyutils.image_annotator import ImageAnnotator
from d3utils.screenshot_capturer import D3ScreenshotCapturer
from d3utils.bag_layout_detector import BagLayoutDetector
from providor.providor_index import CONFIG


class InterfacePropertyDetector:
    """
    Detects game interface properties from screenshots

    Provides:
    - Automatic screenshot capture
    - Bag coordinate detection
    - Button position detection
    - Interface state detection

    Must call initialize() before using other methods
    """

    def __init__(self):
        """Initialize detector"""
        self.matcher = None
        self.capturer = None
        self.last_screenshot = None
        self.last_matches = {}
        self.bag_layout = None  # Store bag layout detection results
        self.bag_layout_detector = BagLayoutDetector(rows=6, cols=10)

        # Shared screenshot image object (opened once, closed at end)
        self.shared_screenshot_image = None

        # Window offset for coordinate conversion (screenshot coords -> screen coords)
        self.window_offset_x = 0
        self.window_offset_y = 0

        # Load bag offset values from configuration
        self._load_bag_offset_config()

        ColorPrint.green("[InterfacePropertyDetector] Initialized")
    
    def _load_bag_offset_config(self):
        """Load bag offset configuration from CONFIG"""
        try:
            bag_offset = CONFIG.get('system_settings', {}).get('bag_offset', {})
            self.bag_offset_left = bag_offset.get('left', 9)
            self.bag_offset_right = bag_offset.get('right', 22)
            self.bag_offset_top = bag_offset.get('top', 0)
            self.bag_offset_bottom = bag_offset.get('bottom', 0)
            
            ColorPrint.blue(f"[InterfacePropertyDetector] Loaded bag offset config: "
                          f"left={self.bag_offset_left}, right={self.bag_offset_right}, "
                          f"top={self.bag_offset_top}, bottom={self.bag_offset_bottom}")
        except Exception as e:
            ColorPrint.yellow(f"[InterfacePropertyDetector] Failed to load bag offset config, using defaults: {e}")
            # Fallback to default values
            self.bag_offset_left = 9
            self.bag_offset_right = 22
            self.bag_offset_top = 0
            self.bag_offset_bottom = 0
    
    def update_bag_offset_config(self):
        """Update bag offset configuration from CONFIG"""
        self._load_bag_offset_config()

    def close_screenshot(self):
        """Close shared screenshot image to free memory"""
        if self.shared_screenshot_image:
            self.shared_screenshot_image.close()
            self.shared_screenshot_image = None
            ColorPrint.blue("[Detector] Closed screenshot image")

    def get_window_offset(self) -> tuple:
        """
        Get window offset for converting screenshot coordinates to screen coordinates

        Returns:
            Tuple (offset_x, offset_y) representing window position on screen
        """
        return (self.window_offset_x, self.window_offset_y)

    def initialize(
        self,
        screenshot_path: Optional[Union[str, Path]] = None,
        template_dir: Optional[Union[str, Path]] = None
    ) -> Dict:
        """
        Initialize detector by analyzing screenshot

        This method:
        1. Captures a new screenshot (if screenshot_path not provided)
        2. Performs template matching to detect all interface elements

        Args:
            screenshot_path: Optional path to screenshot image (if None, captures new screenshot)
            template_dir: Directory containing template images (default: auto-detect)

        Returns:
            Dictionary with detection results:
            {
                "bag_left": {...},
                "bag_buttom": {...},
                "button_put_material": {...},
                "conversion_button": {...},
                ...
            }
        """
        ColorPrint.blue("\n[Detector] Initializing interface detection...")

        # Capture screenshot if not provided
        if screenshot_path is None:
            ColorPrint.blue("[Detector] Capturing new screenshot...")

            if self.capturer is None:
                self.capturer = D3ScreenshotCapturer()

            screenshot_path = self.capturer.capture(filename_prefix="d3_interface_detect")

            if screenshot_path is None:
                ColorPrint.red("[Detector] Failed to capture screenshot - window not found")
                return {}

            # Save window offset from capturer
            self.window_offset_x, self.window_offset_y = self.capturer.get_window_offset()
            ColorPrint.blue(f"[Detector] Window offset saved: ({self.window_offset_x}, {self.window_offset_y})")

        self.last_screenshot = str(screenshot_path)

        # Open screenshot image once and keep it in memory
        from PIL import Image
        self.shared_screenshot_image = Image.open(str(screenshot_path))
        ColorPrint.blue(f"[Detector] Opened screenshot image: {screenshot_path}")

        # Auto-detect template directory if not provided
        if template_dir is None:
            # Assume we're in ncore/pytools/pyutils, go up to find apps/d3check/images
            detector_dir = Path(__file__).parent
            project_root = detector_dir.parent.parent.parent
            template_dir = project_root / "apps" / "d3check" / "images"

        template_dir = Path(template_dir)

        if not template_dir.exists():
            ColorPrint.red(f"[Error] Template directory not found: {template_dir}")
            return {}

        # Define templates to search for
        template_files = {
            "bag_left": template_dir / "bag_left.png",
            "bag_buttom": template_dir / "bag_buttom.png",
            "reforge_interface_indicator": template_dir / "reforge_interface_indicator.png",  # Reforge interface indicator (text-based, not a button)
            "upgrade_interface_indicator": template_dir / "upgrade_interface_indicator.png",  # Upgrade interface indicator (text-based, not a button)
            "button_put_material_alt": template_dir / "button_put_material_alt.png",  # Actual material placement button (clickable)
            "button_convert_enabled": template_dir / "button_convert_enabled.png",
            "button_convert_disabled": template_dir / "button_convert_disabled.png",
        }

        # Filter existing templates
        existing_templates = {
            name: path
            for name, path in template_files.items()
            if path.exists()
        }

        if not existing_templates:
            ColorPrint.yellow("[Warning] No template files found")
            return {}

        ColorPrint.blue(f"[Detector] Found {len(existing_templates)} templates")

        # Initialize matcher if needed
        if self.matcher is None:
            self.matcher = ImageMatcher(
                ratio_thresh=0.80,
                min_inliers=4,
                nfeatures=10000
            )

        # Perform matching
        all_matches = {}

        for name, path in existing_templates.items():
            ColorPrint.blue(f"[Detector] Searching for: {name}")

            # Use stricter matching for text-based interface indicators
            if "interface_indicator" in name:
                # Create a stricter matcher for text-based templates
                strict_matcher = ImageMatcher(
                    ratio_thresh=0.85,  # Higher threshold for better matches
                    min_inliers=6,      # More inliers required
                    nfeatures=10000
                )
                result = strict_matcher.match_multiple_templates(
                    target_image_path=screenshot_path,
                    template_paths=[path],
                    output_dir=None  # Don't save output here
                )
            else:
                result = self.matcher.match_multiple_templates(
                    target_image_path=screenshot_path,
                    template_paths=[path],
                    output_dir=None  # Don't save output here
                )

            if result["total_matches"] > 0:
                match = result["matches"][0]
                all_matches[name] = match
                ColorPrint.green(f"[Detector] Found {name} at {match['center']}")
            else:
                ColorPrint.yellow(f"[Detector] {name} not found")

        # Fallback for conversion button if not found
        if "button_convert_enabled" not in all_matches and "button_convert_disabled" not in all_matches:
            self._apply_conversion_button_fallback(all_matches, screenshot_path)

        self.last_matches = all_matches

        ColorPrint.green(f"[Detector] Initialization complete: {len(all_matches)} elements detected")

        # Detect bag layout if bag coordinates are available
        self._detect_bag_layout(screenshot_path)

        # Draw annotations on screenshot
        self._draw_annotations(screenshot_path, all_matches)

        return all_matches

    def _apply_conversion_button_fallback(self, all_matches: Dict, screenshot_path: Union[str, Path]) -> None:
        """
        Apply fallback mechanism for conversion button if not found

        Fallback logic:
        - If button_put_material_alt is found, calculate conversion button position
        - Conversion button is at: (left_edge + 300) or (button_put_material_alt.x - 580)
        - Use same Y coordinate as button_put_material_alt

        Args:
            all_matches: Dictionary of matched templates
            screenshot_path: Path to screenshot
        """
        # Check if we have button_put_material_alt to use as reference
        if "button_put_material_alt" not in all_matches:
            ColorPrint.yellow("[Fallback] Cannot apply conversion button fallback - button_put_material_alt not found")
            return

        try:
            # Get screenshot width from shared image
            if self.shared_screenshot_image:
                screenshot_width = self.shared_screenshot_image.width
            else:
                ColorPrint.yellow("[Fallback] No shared screenshot image available")
                return

            # Get reference button position
            material_btn = all_matches["button_put_material_alt"]
            material_x = material_btn["center"][0]
            material_y = material_btn["center"][1]

            # Calculate conversion button position
            # Method: left_edge + 300, or equivalently: material_x - 580
            conversion_x = material_x - 580
            conversion_y = material_y  # Same Y coordinate

            ColorPrint.blue(f"[Fallback] Applying conversion button fallback calculation:")
            ColorPrint.blue(f"  button_put_material_alt at ({material_x}, {material_y})")
            ColorPrint.blue(f"  Calculated conversion button at ({conversion_x}, {conversion_y})")

            # Create a synthetic match entry
            all_matches["button_convert_enabled"] = {
                "center": [conversion_x, conversion_y],
                "polygon": [
                    [conversion_x - 40, conversion_y - 20],
                    [conversion_x + 40, conversion_y - 20],
                    [conversion_x + 40, conversion_y + 20],
                    [conversion_x - 40, conversion_y + 20]
                ],
                "template_name": "button_convert_enabled (fallback)"
            }

            ColorPrint.green(f"[Fallback] Successfully applied conversion button fallback")

        except Exception as e:
            ColorPrint.red(f"[Fallback] Error applying conversion button fallback: {e}")
            import traceback
            traceback.print_exc()

    def _detect_bag_layout(self, screenshot_path: Union[str, Path]) -> None:
        """
        Detect bag slot usage layout

        Args:
            screenshot_path: Path to screenshot
        """
        # Check if bag coordinates are available
        bag_coords = self.get_bag_coordinates()
        if not bag_coords:
            ColorPrint.yellow("[BagLayout] Skipping bag layout detection - bag coordinates not found")
            self.bag_layout = None
            return

        try:
            import cv2

            ColorPrint.blue("[BagLayout] Detecting bag slot usage...")

            # Use shared screenshot image
            if not self.shared_screenshot_image:
                ColorPrint.yellow("[BagLayout] No shared screenshot image available")
                self.bag_layout = None
                return

            # Convert PIL image to numpy array for OpenCV
            screenshot = np.array(self.shared_screenshot_image)
            screenshot = cv2.cvtColor(screenshot, cv2.COLOR_RGB2BGR)

            # Crop bag region
            top_left = bag_coords["top_left"]
            bottom_right = bag_coords["bottom_right"]

            bag_region = screenshot[
                top_left[1]:bottom_right[1],
                top_left[0]:bottom_right[0]
            ]

            # Detect layout
            self.bag_layout = self.bag_layout_detector.detect_layout(bag_region, bag_coords)

            ColorPrint.green("[BagLayout] Bag layout detection complete")

        except Exception as e:
            ColorPrint.red(f"[BagLayout] Error detecting bag layout: {e}")
            import traceback
            traceback.print_exc()
            self.bag_layout = None

    def _draw_annotations(self, screenshot_path: Union[str, Path], matches: Dict) -> None:
        """
        Draw annotations on screenshot for all detected elements

        Args:
            screenshot_path: Path to screenshot
            matches: Dictionary of matched templates
        """
        try:
            ColorPrint.blue("[Annotator] Drawing annotations on screenshot...")

            # Create annotator
            annotator = ImageAnnotator(screenshot_path)

            # Define colors for different element types
            colors = {
                "bag": (0, 255, 0),      # Green
                "button": (0, 0, 255),   # Red
                "item": (255, 0, 255)    # Magenta
            }

            # Draw all matched templates
            for name, match in matches.items():
                polygon = match["polygon"]
                center = match["center"]

                # Determine color based on template type
                if "bag" in name:
                    color = colors["bag"]
                    label_color = (255, 255, 255)
                elif "button" in name:
                    color = colors["button"]
                    label_color = (255, 255, 255)
                elif "item" in name:
                    color = colors["item"]
                    label_color = (255, 255, 255)
                else:
                    color = (255, 255, 0)  # Yellow for unknown
                    label_color = (255, 255, 255)

                # Draw polygon around matched template
                annotator.draw_polygon(
                    polygon,
                    color=color,
                    thickness=2
                )

                # Draw center point
                annotator.draw_circle(
                    (int(center[0]), int(center[1])),
                    radius=5,
                    color=color,
                    filled=True
                )

                # Draw label
                label_pos = (int(polygon[0][0]), int(polygon[0][1]) - 10)
                annotator.draw_text(
                    name,
                    label_pos,
                    color=label_color,
                    font_scale=0.5,
                    thickness=1,
                    background_color=color
                )

                ColorPrint.gray(f"[Annotator] Drew {name} at {center}")

            # Draw bag rectangle if available
            bag_coords = self.get_bag_coordinates()
            if bag_coords:
                annotator.draw_rectangle(
                    bag_coords["top_left"],
                    bag_coords["bottom_right"],
                    color=(0, 255, 0),
                    thickness=3,
                    label="Bag (60 slots)"
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

                ColorPrint.green(f"[Annotator] Drew bag rectangle and grid")

            # Draw button rectangles for specific buttons
            button_names = [
                "reforge_interface_indicator",
                "upgrade_interface_indicator",
                "button_put_material_alt",
                "button_convert_enabled",
                "button_convert_disabled"
            ]

            for button_name in button_names:
                if button_name in matches:
                    match = matches[button_name]
                    polygon = match["polygon"]

                    # Get bounding box from polygon
                    x_coords = [p[0] for p in polygon]
                    y_coords = [p[1] for p in polygon]
                    top_left = (int(min(x_coords)), int(min(y_coords)))
                    bottom_right = (int(max(x_coords)), int(max(y_coords)))

                    # Draw rectangle with label
                    button_label = button_name.replace("button_", "").replace("_", " ").title()
                    annotator.draw_rectangle(
                        top_left,
                        bottom_right,
                        color=(255, 0, 255),  # Magenta for button rectangles
                        thickness=2,
                        label=button_label
                    )

                    ColorPrint.gray(f"[Annotator] Drew button rectangle for {button_name}")

            # Save annotated image
            output_dir = Path.home() / ".core_node" / "pytools" / "tmp"
            output_dir.mkdir(parents=True, exist_ok=True)

            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"annotated_{timestamp}.png"
            output_path = output_dir / output_filename

            annotator.save(output_path)
            ColorPrint.green(f"[Annotator] Saved annotated image: {output_path}")

        except Exception as e:
            ColorPrint.red(f"[Annotator] Error drawing annotations: {e}")
            import traceback
            traceback.print_exc()

    def get_bag_coordinates(self) -> Optional[Dict]:
        """
        Calculate bag coordinates using two-stage detection

        Algorithm:
        1. First detect bag_buttom.png, use its top-left as bag's bottom-left
        2. Create search region: from (0, buttom_top - screen_height/2) to (buttom_left, buttom_top)
        3. Search for bag_left.png within this region
        4. Use bag_left's bottom-left corner as bag's top-left + offsets

        Coordinate mapping:
        - bag_left.png bottom-left -> bag top-left (with left/top offsets)
        - bag_buttom.png top-left -> bag bottom-left
        - bag right edge -> screen right edge - right offset
        - bag top Y -> bag_left bottom-left Y + top offset
        - bag bottom Y -> bag_buttom top-left Y - bottom offset

        Returns:
            Dictionary with bag coordinates or None:
            {
                "top_left": (x, y),
                "bottom_right": (x, y),
                "width": int,
                "height": int,
                "rows": int,
                "cols": int,
                "total_slots": int
            }
        """
        if "bag_buttom" not in self.last_matches:
            ColorPrint.yellow("[Bag] Missing bag_buttom template")
            return None

        # Step 1: Get bag_buttom position
        # bag_buttom top-left = bag's bottom-left reference
        bag_buttom = self.last_matches["bag_buttom"]
        buttom_polygon = bag_buttom["polygon"]
        buttom_left_x = int(buttom_polygon[0][0])  # bag_buttom top-left X
        buttom_left_y = int(buttom_polygon[0][1])  # bag_buttom top-left Y

        ColorPrint.blue(f"[Bag] bag_buttom top-left (bag bottom-left ref): ({buttom_left_x}, {buttom_left_y})")

        # Step 2: Create search region for bag_left
        if not self.shared_screenshot_image:
            ColorPrint.yellow("[Bag] No screenshot image available for region search")
            return None

        screenshot_width = self.shared_screenshot_image.width
        screenshot_height = self.shared_screenshot_image.height

        # Define search region: from top to bag_buttom, left edge to buttom_left
        search_region_left = 0
        search_region_top = max(0, buttom_left_y - screenshot_height // 2)
        search_region_right = buttom_left_x
        search_region_bottom = buttom_left_y

        ColorPrint.blue(f"[Bag] Search region for bag_left: ({search_region_left}, {search_region_top}) -> ({search_region_right}, {search_region_bottom})")

        # Step 3: Search for bag_left within the region
        left_bottom_left_x = None
        left_bottom_left_y = None

        if "bag_left" not in self.last_matches:
            ColorPrint.yellow("[Bag] bag_left not found in full image, trying region search...")

            # Crop the search region
            import cv2
            screenshot = np.array(self.shared_screenshot_image)
            screenshot = cv2.cvtColor(screenshot, cv2.COLOR_RGB2BGR)

            search_region = screenshot[
                search_region_top:search_region_bottom,
                search_region_left:search_region_right
            ]

            # Save region temporarily for matching
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            region_path = Path.home() / ".core_node" / "pytools" / "tmp" / f"bag_search_region_{timestamp}.png"
            region_path.parent.mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(region_path), search_region)

            # Search in region
            template_dir = Path(__file__).parent.parent / "images"
            bag_left_template = template_dir / "bag_left.png"

            result = self.matcher.match_multiple_templates(
                target_image_path=region_path,
                template_paths=[bag_left_template],
                output_dir=None
            )

            if result["total_matches"] == 0:
                ColorPrint.yellow("[Bag] bag_left not found in search region")
                return None

            # Adjust coordinates from region to full image
            match = result["matches"][0]
            region_polygon = match["polygon"]

            # Convert region coordinates to full image coordinates
            full_polygon = [
                [p[0] + search_region_left, p[1] + search_region_top]
                for p in region_polygon
            ]

            ColorPrint.green(f"[Bag] Found bag_left in region, adjusted polygon: {full_polygon}")

            # bag_left bottom-left corner (index 3)
            left_bottom_left_x = int(full_polygon[3][0])
            left_bottom_left_y = int(full_polygon[3][1])

        else:
            # bag_left was found in full image scan
            bag_left = self.last_matches["bag_left"]
            left_polygon = bag_left["polygon"]

            # Get bottom-left corner of bag_left (index 3)
            left_bottom_left_x = int(left_polygon[3][0])
            left_bottom_left_y = int(left_polygon[3][1])

        ColorPrint.blue(f"[Bag] bag_left bottom-left (bag top-left ref): ({left_bottom_left_x}, {left_bottom_left_y})")

        # Step 4: Calculate final bag coordinates using offsets
        # Bag top-left: bag_left's bottom-left + offsets
        bag_top_left_x = left_bottom_left_x + self.bag_offset_left
        bag_top_left_y = left_bottom_left_y + self.bag_offset_top

        # Bag bottom-left: bag_buttom's top-left Y coordinate
        bag_bottom_left_y = buttom_left_y - self.bag_offset_bottom

        # Bag right edge: screen right edge - right offset
        bag_right_x = screenshot_width - self.bag_offset_right

        # Bag top-right: same Y as top-left, X at right edge
        bag_top_right_x = bag_right_x
        bag_top_right_y = bag_top_left_y

        # Bag bottom-right: same Y as bottom-left, X at right edge
        bag_bottom_right_x = bag_right_x
        bag_bottom_right_y = bag_bottom_left_y

        ColorPrint.blue(f"[Bag] Applied offsets - left:{self.bag_offset_left}, right:{self.bag_offset_right}, top:{self.bag_offset_top}, bottom:{self.bag_offset_bottom}")
        ColorPrint.blue(f"[Bag] Bag corners:")
        ColorPrint.blue(f"  Top-left:     ({bag_top_left_x}, {bag_top_left_y})")
        ColorPrint.blue(f"  Top-right:    ({bag_top_right_x}, {bag_top_right_y})")
        ColorPrint.blue(f"  Bottom-left:  ({left_bottom_left_x}, {bag_bottom_left_y})")
        ColorPrint.blue(f"  Bottom-right: ({bag_bottom_right_x}, {bag_bottom_right_y})")

        result = {
            "top_left": (bag_top_left_x, bag_top_left_y),
            "bottom_right": (bag_bottom_right_x, bag_bottom_right_y),
            "width": bag_bottom_right_x - bag_top_left_x,
            "height": bag_bottom_right_y - bag_top_left_y,
            "rows": 6,
            "cols": 10,
            "total_slots": 60
        }

        ColorPrint.green(f"[Bag] Final coordinates: {result['top_left']} -> {result['bottom_right']}")
        ColorPrint.green(f"[Bag] Size: {result['width']}x{result['height']} pixels")

        return result

    def get_put_material_button(self) -> Optional[Tuple[int, int]]:
        """
        Get material placement button coordinates

        Only returns button_put_material_alt - the actual clickable button

        Returns:
            Button center (x, y) or None if not found
        """
        # Only check for the actual clickable button
        if "button_put_material_alt" in self.last_matches:
            center = self.last_matches["button_put_material_alt"]["center"]
            center_tuple = (int(center[0]), int(center[1]))
            ColorPrint.green(f"[Button] Material placement button: {center_tuple}")
            return center_tuple

        ColorPrint.yellow("[Button] Material placement button not found")
        return None

    def get_conversion_button(self) -> Optional[Tuple[int, int]]:
        """
        Get conversion button coordinates

        Checks for both enabled and disabled states

        Returns:
            Button center (x, y) or None if not found
        """
        # Check for both enabled and disabled buttons
        if "button_convert_enabled" in self.last_matches:
            center = self.last_matches["button_convert_enabled"]["center"]
            center_tuple = (int(center[0]), int(center[1]))
            ColorPrint.green(f"[Button] Conversion button (enabled): {center_tuple}")
            return center_tuple

        if "button_convert_disabled" in self.last_matches:
            center = self.last_matches["button_convert_disabled"]["center"]
            center_tuple = (int(center[0]), int(center[1]))
            ColorPrint.green(f"[Button] Conversion button (disabled): {center_tuple}")
            return center_tuple

        ColorPrint.yellow("[Button] Conversion button not found")
        return None

    def get_conversion_clickable(self) -> Optional[bool]:
        """
        Check if conversion button is clickable

        Returns:
            True if enabled button detected, False if disabled, None if not found
        """
        if "button_convert_enabled" in self.last_matches:
            ColorPrint.blue("[State] Conversion button is clickable (enabled state detected)")
            return True

        if "button_convert_disabled" in self.last_matches:
            ColorPrint.blue("[State] Conversion button is NOT clickable (disabled state detected)")
            return False

        ColorPrint.gray("[State] Conversion clickable state unknown")
        return None

    def get_functional_interface(self) -> Optional[str]:
        """
        Detect current functional interface type

        Logic:
        - reforge_interface_indicator = Reforge interface (重铸) - detected by text
        - upgrade_interface_indicator = Upgrade Rare interface (升级黄装) - detected by text

        Returns:
            "reforge", "upgrade", or None
        """
        # Check for upgrade interface indicator
        if "upgrade_interface_indicator" in self.last_matches:
            ColorPrint.blue("[State] Functional interface: UPGRADE (升级黄装)")
            return "upgrade"

        # Check for reforge interface indicator
        if "reforge_interface_indicator" in self.last_matches:
            ColorPrint.blue("[State] Functional interface: REFORGE (重铸)")
            return "reforge"

        ColorPrint.gray("[State] No functional interface detected")
        return None

    def get_all_properties(self) -> Dict:
        """
        Get all detected properties

        Returns:
            Dictionary with all detected properties
        """
        return {
            "bag_coordinates": self.get_bag_coordinates(),
            "put_material_button": self.get_put_material_button(),
            "conversion_button": self.get_conversion_button(),
            "conversion_clickable": self.get_conversion_clickable(),
            "functional_interface": self.get_functional_interface(),
            "raw_matches": self.last_matches
        }


# Example usage
if __name__ == "__main__":
    detector = InterfacePropertyDetector()

    # Initialize with screenshot
    screenshot = "path/to/screenshot.png"
    matches = detector.initialize(screenshot)

    # Get properties
    bag_coords = detector.get_bag_coordinates()
    material_btn = detector.get_put_material_button()

    # Get all properties
    all_props = detector.get_all_properties()
    print(all_props)
