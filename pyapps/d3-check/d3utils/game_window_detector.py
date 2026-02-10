#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Window Detector
Detects game window position by finding anchor points in full screen screenshot.
类库：导出前实例化，通过 get_game_window_detector() 获取单例，禁止各处自行 new。
"""

import os
import sys
from typing import Optional, Tuple, Dict
from pathlib import Path

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
cv2 = get_third_package_cv2()
np = get_third_package_numpy()
from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher as get_scaled_template_matcher
from providor.providor_index import (
    get_template_path,
    get_template_threshold,
    get_template_use_alpha,
    get_templates_by_category
)

class GameWindowDetector:
    """
    Detects game window position using anchor point images

    Algorithm:
    1. Capture full screen screenshot
    2. Find bottom-left anchor point (tries 3 variants)
    3. Find bottom-right anchor point
    4. Calculate game window rect from anchor positions
    """

    def __init__(self):
        """Initialize game window detector"""
        self.template_matcher = get_scaled_template_matcher()

        # Get anchor templates
        self.anchor_templates = get_templates_by_category("game_anchor")

        ColorPrint.green("[GameWindowDetector] Initialized")
        ColorPrint.blue(f"[GameWindowDetector] Found {len(self.anchor_templates)} anchor templates")

    def detect_game_window(self, screenshot_path: str) -> Optional[Dict]:
        """
        Detect game window position in full screen screenshot

        Args:
            screenshot_path: Path to full screen screenshot

        Returns:
            Dictionary with game window info or None if not detected:
            {
                "window_rect": (left, top, right, bottom),
                "bottom_left_anchor": {"name": str, "position": (x, y), "size": (w, h)},
                "bottom_right_anchor": {"name": str, "position": (x, y), "size": (w, h)}
            }
        """
        ColorPrint.blue(f"\n[Detector] Detecting game window in screenshot...")

        try:
            # Load screenshot
            screenshot = cv2.imread(str(screenshot_path))
            if screenshot is None:
                ColorPrint.red(f"[Detector] Failed to load screenshot: {screenshot_path}")
                return None

            screen_height, screen_width = screenshot.shape[:2]
            ColorPrint.blue(f"[Detector] Screen size: {screen_width}x{screen_height}")

            # Step 1: Find bottom-left anchor (try 3 variants)
            bottom_left_anchor = self._find_bottom_left_anchor(screenshot_path)

            if bottom_left_anchor is None:
                ColorPrint.yellow("[Detector] Bottom-left anchor not found")
                return None

            ColorPrint.green(f"[Detector] Found bottom-left anchor: {bottom_left_anchor['name']} at {bottom_left_anchor['position']}")

            # Step 2: Find bottom-right anchor
            bottom_right_anchor = self._find_bottom_right_anchor(screenshot_path)

            if bottom_right_anchor is None:
                ColorPrint.yellow("[Detector] Bottom-right anchor not found")
                return None

            ColorPrint.green(f"[Detector] Found bottom-right anchor: {bottom_right_anchor['name']} at {bottom_right_anchor['position']}")

            # Step 3: Calculate game window rect
            window_rect = self._calculate_window_rect(
                bottom_left_anchor,
                bottom_right_anchor,
                screen_width,
                screen_height
            )

            ColorPrint.green(f"[Detector] Game window rect: {window_rect}")

            return {
                "window_rect": window_rect,
                "bottom_left_anchor": bottom_left_anchor,
                "bottom_right_anchor": bottom_right_anchor
            }

        except Exception as e:
            ColorPrint.red(f"[Detector] Error detecting game window: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _find_bottom_left_anchor(self, screenshot_path: str) -> Optional[Dict]:
        """
        Find bottom-left anchor point (tries 3 variants)

        Returns:
            Dict with anchor info: {"name": str, "position": (x, y), "size": (w, h)}
        """
        ColorPrint.blue("[Detector] Searching for bottom-left anchor...")

        # Try 3 variants in order
        anchor_names = [
            "game_anchor_bottom_left_1",
            "game_anchor_bottom_left_2",
            "game_anchor_bottom_left_3"
        ]

        for anchor_name in anchor_names:
            template_path = get_template_path(anchor_name)
            if not template_path or not Path(template_path).exists():
                ColorPrint.yellow(f"[Detector] Template not found: {anchor_name}")
                continue

            ColorPrint.blue(f"[Detector] Trying {anchor_name}...")

            result = self.template_matcher.match_template(
                target_image=screenshot_path,
                template_name=anchor_name,
                output_dir=None
            )

            if result["total_matches"] > 0:
                match = result["matches"][0]

                # Get template size
                template = cv2.imread(str(template_path))
                template_h, template_w = template.shape[:2]

                return {
                    "name": anchor_name,
                    "position": tuple(match["center"]),
                    "size": (template_w, template_h)
                }

        return None

    def _find_bottom_right_anchor(self, screenshot_path: str) -> Optional[Dict]:
        """
        Find bottom-right anchor point

        Returns:
            Dict with anchor info: {"name": str, "position": (x, y), "size": (w, h)}
        """
        ColorPrint.blue("[Detector] Searching for bottom-right anchor...")

        anchor_name = "game_anchor_bottom_right"
        template_path = get_template_path(anchor_name)

        if not template_path or not Path(template_path).exists():
            ColorPrint.yellow(f"[Detector] Template not found: {anchor_name}")
            return None

        ColorPrint.blue(f"[Detector] Trying {anchor_name}...")

        result = self.template_matcher.match_template(
            target_image=screenshot_path,
            template_name=anchor_name,
            output_dir=None
        )

        if result["total_matches"] > 0:
            match = result["matches"][0]

            # Get template size
            template = cv2.imread(str(template_path))
            template_h, template_w = template.shape[:2]

            return {
                "name": anchor_name,
                "position": tuple(match["center"]),
                "size": (template_w, template_h)
            }

        return None

    def _calculate_window_rect(
        self,
        bottom_left_anchor: Dict,
        bottom_right_anchor: Dict,
        screen_width: int,
        screen_height: int
    ) -> Tuple[int, int, int, int]:
        """
        Calculate game window rectangle from anchor positions

        Algorithm (based on user requirement):
        - Left edge: bottom_left anchor center X - anchor width (offset left by 1 template size)
        - Top edge: 0 (screen top)
        - Right edge: bottom_right anchor center X + anchor width (offset right by 1 template size)
        - Bottom edge: Use the OFFSET anchor Y positions (already offset down by 1 template size)
          * Bottom-left offset Y: bl_y + bl_h
          * Bottom-right offset Y: br_y + br_h
          * Take the maximum of these two

        Args:
            bottom_left_anchor: Bottom-left anchor info
            bottom_right_anchor: Bottom-right anchor info
            screen_width: Screen width
            screen_height: Screen height

        Returns:
            Tuple (left, top, right, bottom)
        """
        # Get anchor positions and sizes
        bl_x, bl_y = bottom_left_anchor["position"]
        bl_w, bl_h = bottom_left_anchor["size"]

        br_x, br_y = bottom_right_anchor["position"]
        br_w, br_h = bottom_right_anchor["size"]

        ColorPrint.blue(f"[Calc] Bottom-left anchor: pos=({bl_x}, {bl_y}), size=({bl_w}x{bl_h})")
        ColorPrint.blue(f"[Calc] Bottom-right anchor: pos=({br_x}, {br_y}), size=({br_w}x{br_h})")

        # Calculate offset positions (bottom-left / bottom-right)
        # Bottom-left: offset left by bl_w, down by bl_h
        left_bottom_x = int(bl_x - bl_w)
        left_bottom_y = int(bl_y + bl_h)

        # Bottom-right: offset right by br_w, down by br_h
        right_bottom_x = int(br_x + br_w)
        right_bottom_y = int(br_y + br_h)

        ColorPrint.blue(f"[Calc] Offset bottom-left: ({left_bottom_x}, {left_bottom_y})")
        ColorPrint.blue(f"[Calc] Offset bottom-right: ({right_bottom_x}, {right_bottom_y})")

        # Calculate window edges
        left = left_bottom_x
        top = 0  # Extend to screen top
        right = right_bottom_x
        bottom = max(left_bottom_y, right_bottom_y)  # Take lower of the two bottom edges

        # Clamp to screen bounds
        left = max(0, left)
        top = max(0, top)
        right = min(screen_width, right)
        bottom = min(screen_height, bottom)

        ColorPrint.blue(f"[Calc] Final game window rect: left={left}, top={top}, right={right}, bottom={bottom}")
        ColorPrint.blue(f"[Calc] Window size: {right - left}x{bottom - top}")

        return (left, top, right, bottom)

# Example usage
if __name__ == "__main__":
    detector = GameWindowDetector()

    # Test with a full screen screenshot
    screenshot_path = "path/to/fullscreen_screenshot.png"
    result = detector.detect_game_window(screenshot_path)

    if result:
        print(f"\nGame window detected:")
        print(f"  Rect: {result['window_rect']}")
        print(f"  Bottom-left anchor: {result['bottom_left_anchor']['name']}")
        print(f"  Bottom-right anchor: {result['bottom_right_anchor']['name']}")
    else:
        print("\nGame window not detected")

# 导出前实例化：全项目唯一 GameWindowDetector 实例
_game_window_detector_instance: Optional[GameWindowDetector] = None


def get_game_window_detector() -> GameWindowDetector:
    """Return the global GameWindowDetector instance (singleton)."""
    global _game_window_detector_instance
    if _game_window_detector_instance is None:
        _game_window_detector_instance = GameWindowDetector()
    return _game_window_detector_instance
