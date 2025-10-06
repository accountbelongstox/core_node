#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resolution Scaler
Scales template images based on actual screenshot resolution vs standard resolution
"""

import os
import sys
from typing import Tuple, Optional, Dict
from pathlib import Path
import numpy as np
import cv2

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint
from providor.providor_index import STANDARD_RESOLUTION_WIDTH, STANDARD_RESOLUTION_HEIGHT

class ResolutionScaler:
    """
    Handles resolution-based scaling of template images

    Standard resolution: Defined in providor_index.py
    - If screenshot matches standard resolution, use original templates
    - If screenshot differs, scale templates to match (non-proportional scaling)
    """

    # Standard resolution (reference) - imported from global config
    STANDARD_WIDTH = STANDARD_RESOLUTION_WIDTH
    STANDARD_HEIGHT = STANDARD_RESOLUTION_HEIGHT

    def __init__(self, screenshot_width: int, screenshot_height: int):
        """
        Initialize resolution scaler

        Args:
            screenshot_width: Actual screenshot width
            screenshot_height: Actual screenshot height
        """
        self.screenshot_width = screenshot_width
        self.screenshot_height = screenshot_height

        # Calculate scaling ratios
        self.scale_x = screenshot_width / self.STANDARD_WIDTH
        self.scale_y = screenshot_height / self.STANDARD_HEIGHT

        # Check if scaling is needed
        self.needs_scaling = not (
            abs(self.scale_x - 1.0) < 0.01 and
            abs(self.scale_y - 1.0) < 0.01
        )

        ColorPrint.green(f"[ResolutionScaler] Initialized")
        ColorPrint.blue(f"[ResolutionScaler] Standard resolution: {self.STANDARD_WIDTH}x{self.STANDARD_HEIGHT}")
        ColorPrint.blue(f"[ResolutionScaler] Screenshot resolution: {screenshot_width}x{screenshot_height}")
        ColorPrint.blue(f"[ResolutionScaler] Scale ratios: X={self.scale_x:.4f}, Y={self.scale_y:.4f}")

        if self.needs_scaling:
            ColorPrint.yellow(f"[ResolutionScaler] Scaling required")
        else:
            ColorPrint.green(f"[ResolutionScaler] No scaling needed (resolution matches standard)")

    def get_scale_ratios(self) -> Tuple[float, float]:
        """
        Get scaling ratios

        Returns:
            Tuple of (scale_x, scale_y)
        """
        return (self.scale_x, self.scale_y)

    def scale_template(self, template: np.ndarray) -> np.ndarray:
        """
        Scale a template image based on resolution difference

        Uses non-proportional scaling (different X and Y ratios)

        Args:
            template: Template image (numpy array)

        Returns:
            Scaled template image
        """
        if not self.needs_scaling:
            # No scaling needed
            return template

        original_height, original_width = template.shape[:2]

        # Calculate new dimensions (non-proportional)
        new_width = int(original_width * self.scale_x)
        new_height = int(original_height * self.scale_y)

        # Ensure dimensions are at least 1 pixel
        new_width = max(1, new_width)
        new_height = max(1, new_height)

        ColorPrint.gray(f"[Scale] Template: {original_width}x{original_height} -> {new_width}x{new_height}")

        # Scale using high-quality interpolation
        scaled = cv2.resize(
            template,
            (new_width, new_height),
            interpolation=cv2.INTER_CUBIC
        )

        return scaled

    def scale_template_from_path(
        self,
        template_path: Path,
        cache_dir: Optional[Path] = None
    ) -> np.ndarray:
        """
        Load and scale a template image from file

        If scaling is needed and cache_dir is provided, saves scaled version

        Args:
            template_path: Path to template image
            cache_dir: Optional directory to cache scaled templates

        Returns:
            Scaled template image (numpy array)
        """
        # Load template
        template = cv2.imread(str(template_path), cv2.IMREAD_COLOR)

        if template is None:
            ColorPrint.red(f"[Scale] Failed to load template: {template_path}")
            return None

        # If no scaling needed, return original
        if not self.needs_scaling:
            return template

        # Check cache first
        if cache_dir:
            cache_dir = Path(cache_dir)
            cache_dir.mkdir(parents=True, exist_ok=True)

            # Create cache filename with scale ratios
            cache_filename = (
                f"{template_path.stem}_"
                f"sx{self.scale_x:.4f}_sy{self.scale_y:.4f}"
                f"{template_path.suffix}"
            )
            cache_path = cache_dir / cache_filename

            # Try to load from cache
            if cache_path.exists():
                ColorPrint.blue(f"[Scale] Loading from cache: {cache_filename}")
                cached_template = cv2.imread(str(cache_path), cv2.IMREAD_COLOR)
                if cached_template is not None:
                    return cached_template

        # Scale template
        scaled = self.scale_template(template)

        # Save to cache if provided
        if cache_dir and scaled is not None:
            cv2.imwrite(str(cache_path), scaled)
            ColorPrint.green(f"[Scale] Saved to cache: {cache_filename}")

        return scaled

    def scale_coordinate(self, x: int, y: int) -> Tuple[int, int]:
        """
        Scale a coordinate from standard resolution to actual resolution

        Args:
            x: X coordinate in standard resolution
            y: Y coordinate in standard resolution

        Returns:
            Tuple of (scaled_x, scaled_y) in actual resolution
        """
        scaled_x = int(x * self.scale_x)
        scaled_y = int(y * self.scale_y)
        return (scaled_x, scaled_y)

    def scale_coordinates_reverse(self, x: int, y: int) -> Tuple[int, int]:
        """
        Scale a coordinate from actual resolution to standard resolution

        Args:
            x: X coordinate in actual resolution
            y: Y coordinate in actual resolution

        Returns:
            Tuple of (standard_x, standard_y) in standard resolution
        """
        standard_x = int(x / self.scale_x)
        standard_y = int(y / self.scale_y)
        return (standard_x, standard_y)

    def get_info(self) -> Dict:
        """
        Get scaler information

        Returns:
            Dictionary with scaler info
        """
        return {
            "standard_resolution": (self.STANDARD_WIDTH, self.STANDARD_HEIGHT),
            "actual_resolution": (self.screenshot_width, self.screenshot_height),
            "scale_ratios": (self.scale_x, self.scale_y),
            "needs_scaling": self.needs_scaling
        }

# Example usage
if __name__ == "__main__":
    # Example: Screenshot at 1920x1080
    scaler = ResolutionScaler(screenshot_width=1920, screenshot_height=1080)

    info = scaler.get_info()
    print(f"\nScaler Info:")
    print(f"  Standard: {info['standard_resolution']}")
    print(f"  Actual: {info['actual_resolution']}")
    print(f"  Scale ratios: {info['scale_ratios']}")
    print(f"  Needs scaling: {info['needs_scaling']}")

    # Example: Scale a coordinate
    standard_x, standard_y = 913, 650  # Center of standard resolution
    scaled_x, scaled_y = scaler.scale_coordinate(standard_x, standard_y)
    print(f"\nCoordinate scaling:")
    print(f"  Standard: ({standard_x}, {standard_y})")
    print(f"  Scaled: ({scaled_x}, {scaled_y})")
