#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Red Portal Detector for Diablo 4
Detects red portals using color matching with sliding window approach

Usage:
    from d4utils.red_portal_detector import detect_red_portal

    # From file path
    result = detect_red_portal("screenshot.png")

    # From PIL Image
    from PIL import Image
    img = Image.open("screenshot.png")
    result = detect_red_portal(img)

    # From numpy array
    img = cv2.imread("screenshot.png")
    result = detect_red_portal(img)

Returns:
    Tuple[int, int, int, int] | None - (x, y, width, height) if portal found, None otherwise
"""

import sys
from pathlib import Path
from typing import Union, Optional, Tuple, List

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy, get_third_package_PIL_Image

cv2 = get_third_package_cv2()
numpy = get_third_package_numpy()
np = numpy
Image = get_third_package_PIL_Image()

# Add parent directory to path for imports
current_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(current_dir))

from share.game_interface_data import (
    D4StandardCoordinates,
    calculate_unified_scaled_coordinate,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    get_d4_interface_data
)

# Target color group (BGR format) - Red/Orange portal colors
TARGET_COLORS = [
    (0x41, 0x99, 0xfe),  # fe9941 - Original orange
    (0x3b, 0x77, 0xff),  # ff773b - Original orange-red
    (0x27, 0x6e, 0xfd),  # fd6e27
    (0x20, 0x3a, 0xff),  # ff3a20
    (0xa2, 0xe8, 0xff),  # ffe8a2
    (0x6e, 0xd0, 0xfe),  # fed06e
    (0x21, 0x42, 0xeb),  # eb4221
    (0x7d, 0xd5, 0xfe),  # fed57d
    (0x1e, 0x2a, 0xb2),  # b22a1e
    (0x21, 0x31, 0xe1),  # e13121
    (0x20, 0x2d, 0x9f),  # 9f2d20
    (0x2b, 0x48, 0xe7),  # e7482b
]

# Color tolerance (±5%)
COLOR_TOLERANCE = 0.05


def _normalize_input_to_bgr(image_input: Union[str, Image.Image, np.ndarray]) -> np.ndarray:
    """
    Normalize various input types to BGR numpy array

    Args:
        image_input: File path string, PIL Image, or numpy array

    Returns:
        BGR numpy array

    Raises:
        ValueError: If input type is invalid or image cannot be loaded
    """
    if isinstance(image_input, str):
        # File path
        img = cv2.imread(image_input)
        if img is None:
            raise ValueError(f"Failed to load image from path: {image_input}")
        return img

    elif isinstance(image_input, Image.Image):
        # PIL Image - convert to BGR
        img_rgb = np.array(image_input.convert('RGB'))
        img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
        return img_bgr

    elif isinstance(image_input, np.ndarray):
        # Numpy array - assume BGR format
        if len(image_input.shape) != 3 or image_input.shape[2] != 3:
            raise ValueError(f"Invalid numpy array shape: {image_input.shape}. Expected (H, W, 3)")
        return image_input

    else:
        raise ValueError(f"Unsupported input type: {type(image_input)}. Expected str, PIL.Image, or np.ndarray")


def _calculate_color_range(color: Tuple[int, int, int], tolerance: float = COLOR_TOLERANCE) -> Tuple[np.ndarray, np.ndarray]:
    """
    Calculate color tolerance range (±5%)

    Args:
        color: BGR color tuple
        tolerance: Tolerance ratio (default 0.05 = 5%)

    Returns:
        (lower_bound, upper_bound) - Lower and upper bounds of color range
    """
    b, g, r = color

    # Calculate ±5% range
    lower_b = max(0, int(b * (1 - tolerance)))
    lower_g = max(0, int(g * (1 - tolerance)))
    lower_r = max(0, int(r * (1 - tolerance)))

    upper_b = min(255, int(b * (1 + tolerance)))
    upper_g = min(255, int(g * (1 + tolerance)))
    upper_r = min(255, int(r * (1 + tolerance)))

    lower_bound = np.array([lower_b, lower_g, lower_r], dtype=np.uint8)
    upper_bound = np.array([upper_b, upper_g, upper_r], dtype=np.uint8)

    return lower_bound, upper_bound


def _create_color_mask(image: np.ndarray, colors: List[Tuple[int, int, int]], tolerance: float = COLOR_TOLERANCE) -> np.ndarray:
    """
    Create color mask matching all target colors

    Args:
        image: Image in BGR format
        colors: Target color list (BGR)
        tolerance: Color tolerance

    Returns:
        Binary mask (255=matched, 0=not matched)
    """
    h, w = image.shape[:2]
    combined_mask = np.zeros((h, w), dtype=np.uint8)

    # Create mask for each target color
    for color in colors:
        lower, upper = _calculate_color_range(color, tolerance)
        mask = cv2.inRange(image, lower, upper)
        combined_mask = cv2.bitwise_or(combined_mask, mask)

    return combined_mask


def _find_portal_region(mask: np.ndarray, coords: D4StandardCoordinates, current_width: int, current_height: int) -> Optional[Tuple[int, int, int, int]]:
    """
    Find portal region using sliding window approach with scaled coordinates

    Args:
        mask: Binary mask of matched pixels
        coords: D4StandardCoordinates instance
        current_width: Current screen width
        current_height: Current screen height

    Returns:
        (x, y, width, height) if portal found, None otherwise
    """
    h, w = mask.shape

    # Calculate scaled parameters using scale calculator
    # Get window mode from shared data instead of hardcoding
    game_window_size = (current_width, current_height)
    d4_data = get_d4_interface_data()
    is_windowed = d4_data.is_windowed_mode()  # Use shared data instead of hardcoding

    # Extract values from (x, None) or (None, y) format
    left_margin = calculate_unified_scaled_coordinate((coords.red_portal_scan_left_margin[0], 0), game_window_size, (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), is_windowed)[0]
    right_margin = calculate_unified_scaled_coordinate((coords.red_portal_scan_right_margin[0], 0), game_window_size, (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), is_windowed)[0]
    bottom_margin = calculate_unified_scaled_coordinate((0, coords.red_portal_scan_bottom_margin[1]), game_window_size, (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), is_windowed)[1]
    max_width = calculate_unified_scaled_coordinate((coords.red_portal_max_width[0], 0), game_window_size, (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), is_windowed)[0]
    max_height = calculate_unified_scaled_coordinate((0, coords.red_portal_max_height[1]), game_window_size, (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), is_windowed)[1]
    min_area = coords.red_portal_min_area

    # Calculate valid scan region
    x_min = left_margin
    x_max = w - right_margin
    y_max = h - bottom_margin

    # Get matched pixel coordinates within scan boundaries
    matched_coords_all = np.argwhere(mask > 0)

    # Filter pixels within scan boundaries
    valid_mask = (
        (matched_coords_all[:, 1] >= x_min) &
        (matched_coords_all[:, 1] < x_max) &
        (matched_coords_all[:, 0] < y_max)
    )
    matched_coords = matched_coords_all[valid_mask]

    if len(matched_coords) == 0:
        return None

    # Sort by column first (x), then row (y) - column-major order
    sorted_indices = np.lexsort((matched_coords[:, 0], matched_coords[:, 1]))
    matched_coords = matched_coords[sorted_indices]

    # Track processed pixels
    processed = np.zeros((h, w), dtype=bool)

    # Scan for portal region
    for py, px in matched_coords:
        if processed[py, px]:
            continue

        # Create detection window from current pixel
        x_start = px
        y_start = py
        x_end = min(w, x_start + max_width)
        y_end = min(h, y_start + max_height)

        # Extract region from mask
        region_mask = mask[y_start:y_end, x_start:x_end]
        region_processed = processed[y_start:y_end, x_start:x_end]

        # Count unprocessed matched pixels
        unprocessed_matched = region_mask & (~region_processed)
        matched_count = np.sum(unprocessed_matched > 0)

        # If enough pixels matched, we found the portal
        if matched_count >= min_area:
            # Find bounding box of matched pixels
            matched_pixel_coords = np.argwhere(unprocessed_matched > 0)

            if len(matched_pixel_coords) > 0:
                min_y, min_x = matched_pixel_coords.min(axis=0)
                max_y, max_x = matched_pixel_coords.max(axis=0)

                # Convert to absolute coordinates
                actual_x = x_start + min_x
                actual_y = y_start + min_y
                actual_width = max_x - min_x + 1
                actual_height = max_y - min_y + 1

                # Mark pixels as processed
                processed[y_start:y_end, x_start:x_end] |= (region_mask > 0)

                # Return first valid portal found
                return (actual_x, actual_y, actual_width, actual_height)

    return None


def detect_red_portal(image_input: Union[str, Image.Image, np.ndarray]) -> Optional[Tuple[int, int, int, int]]:
    """
    Detect red portal in Diablo 4 screenshot

    Args:
        image_input: Image as file path (str), PIL Image, or numpy array (BGR)

    Returns:
        (x, y, width, height) if portal found, None otherwise

    Raises:
        ValueError: If input is invalid or cannot be processed
    """
    # Normalize input to BGR numpy array
    image_bgr = _normalize_input_to_bgr(image_input)

    # Get current screen dimensions
    current_height, current_width = image_bgr.shape[:2]

    # Get D4 standard coordinates
    coords = D4StandardCoordinates()

    # Create color mask
    mask = _create_color_mask(image_bgr, TARGET_COLORS, COLOR_TOLERANCE)

    # Find portal region
    portal = _find_portal_region(mask, coords, current_width, current_height)

    return portal


if __name__ == "__main__":
    """Test the detector with a screenshot"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python red_portal_detector.py <image_path>")
        sys.exit(1)

    image_path = sys.argv[1]

    try:
        result = detect_red_portal(image_path)

        if result:
            x, y, w, h = result
            print(f"Red portal detected!")
            print(f"  Position: ({x}, {y})")
            print(f"  Size: {w}x{h}")

            # Draw result for visualization
            img = cv2.imread(image_path)
            cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(img, f"Portal ({w}x{h})", (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            output_path = Path(image_path).parent / f"{Path(image_path).stem}_portal_detected.png"
            cv2.imwrite(str(output_path), img)
            print(f"  Visualization saved: {output_path}")
        else:
            print("No red portal detected.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
