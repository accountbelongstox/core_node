#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Color Region Detector
Detects color regions using sliding window approach

Usage:
    python color_region_detector.py <image_path>

Features:
    - Read target color groups (12 colors)
    - Match each color with ±5% brightness tolerance
    - Use sliding window (max 310x600) to find color regions
    - Draw detected regions and save recognition results

Algorithm:
    For each matched color pixel:
    - Expand towards top-left and bottom-right
    - Max width: 310 pixels, Max height: 600 pixels
    - Count matched pixels in the window
    - If count >= 10, create region
"""

import os
import sys
import time
from pathlib import Path
from typing import List, Tuple, Set
from collections import deque

# Add project paths
current_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(current_dir))
from share.project_path import get_project_root
sys.path.insert(0, str(get_project_root().parent.parent))

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
from pycore.pyfoundations.color_print import ColorPrint

cv2 = get_third_package_cv2()
np = get_third_package_numpy()


# Target color group (BGR format)
# Note: OpenCV uses BGR format, not RGB
# RGB #RRGGBB -> BGR (BB, GG, RR)
TARGET_COLORS = [
    (0x41, 0x99, 0xfe),  # fe9941 - Original orange
    (0x3b, 0x77, 0xff),  # ff773b - Original orange-red

    # New color set (converted from RGB to BGR)
    (0x27, 0x6e, 0xfd),  # fd6e27 - RGB: fd6e27
    (0x20, 0x3a, 0xff),  # ff3a20 - RGB: ff3a20
    (0xa2, 0xe8, 0xff),  # ffe8a2 - RGB: ffe8a2
    (0x6e, 0xd0, 0xfe),  # fed06e - RGB: fed06e
    (0x21, 0x42, 0xeb),  # eb4221 - RGB: eb4221
    (0x7d, 0xd5, 0xfe),  # fed57d - RGB: fed57d
    (0x1e, 0x2a, 0xb2),  # b22a1e - RGB: b22a1e
    (0x21, 0x31, 0xe1),  # e13121 - RGB: e13121
    (0x20, 0x2d, 0x9f),  # 9f2d20 - RGB: 9f2d20
    (0x2b, 0x48, 0xe7),  # e7482b - RGB: e7482b (appears multiple times)
]

# Color tolerance (±5%)
COLOR_TOLERANCE = 0.05

# Minimum region area (pixels)
MIN_REGION_AREA = 10


def calculate_color_range(color: Tuple[int, int, int], tolerance: float = COLOR_TOLERANCE) -> Tuple[np.ndarray, np.ndarray]:
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


def create_color_mask(image: np.ndarray, colors: List[Tuple[int, int, int]], tolerance: float = COLOR_TOLERANCE) -> np.ndarray:
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
    for idx, color in enumerate(colors):
        lower, upper = calculate_color_range(color, tolerance)

        # Create single-color mask using inRange
        mask = cv2.inRange(image, lower, upper)

        # Merge into combined mask
        combined_mask = cv2.bitwise_or(combined_mask, mask)

        ColorPrint.blue(f"[ColorMask] Color {idx+1}: BGR{color} → Range[{lower}, {upper}] → Pixels: {np.sum(mask > 0)}")

    return combined_mask


def analyze_region_colors(image: np.ndarray, x: int, y: int, width: int, height: int, colors: List[Tuple[int, int, int]], tolerance: float = COLOR_TOLERANCE) -> Tuple[int, dict]:
    """
    Analyze which colors are present in a specific region

    Args:
        image: Original image (BGR)
        x, y: Region top-left corner
        width, height: Region dimensions
        colors: Target color list (BGR)
        tolerance: Color tolerance

    Returns:
        (total_pixels, color_stats) - total matched pixels and per-color statistics
        color_stats: {color_index: pixel_count}
    """
    # Extract region from image
    region = image[y:y+height, x:x+width]

    color_stats = {}
    total_matched = 0

    # Check each target color
    for idx, color in enumerate(colors):
        lower, upper = calculate_color_range(color, tolerance)
        mask = cv2.inRange(region, lower, upper)
        pixel_count = np.sum(mask > 0)

        if pixel_count > 0:
            color_stats[idx] = pixel_count
            total_matched += pixel_count

    return total_matched, color_stats


def find_connected_regions(mask: np.ndarray, image: np.ndarray = None, colors: List[Tuple[int, int, int]] = None, min_area: int = MIN_REGION_AREA, max_width: int = 310, max_height: int = 600) -> List[Tuple[int, int, int, int, int, dict, bool]]:
    """
    Find color regions using sliding window approach

    For each detected color pixel, expand towards top-left and bottom-right
    within maximum dimensions, count matched pixels, and create region if threshold is met.

    Args:
        mask: Binary mask (255=matched, 0=not matched)
        image: Original image (BGR), optional for color analysis
        colors: Target color list, optional for color analysis
        min_area: Minimum number of matched pixels (default: 10)
        max_width: Maximum region width (default: 310)
        max_height: Maximum region height (default: 600)

    Returns:
        List of regions [(x, y, width, height, area, color_stats, is_candidate), ...]
        color_stats: {color_index: pixel_count} dictionary
        is_candidate: True if color usage < 30%
    """
    h, w = mask.shape
    regions = []
    processed = np.zeros((h, w), dtype=int)  # Track which region each pixel belongs to (0 = unprocessed)
    region_candidate_status = []  # Track if each region is a candidate

    # Define scan boundaries to improve performance
    # Skip edges: left 150px, right 328px, bottom 200px
    left_margin = 150
    right_margin = 328
    bottom_margin = 200

    # Calculate valid scan region
    x_min = left_margin
    x_max = w - right_margin
    y_max = h - bottom_margin

    ColorPrint.blue(f"[ScanBounds] Image size: {w}x{h}")
    ColorPrint.blue(f"[ScanBounds] Scan region: x=[{x_min}, {x_max}), y=[0, {y_max})")
    ColorPrint.blue(f"[ScanBounds] Margins: left={left_margin}px, right={right_margin}px, bottom={bottom_margin}px")

    # Get all matched pixel coordinates
    # np.argwhere returns (y, x) pairs in row-major order (scan left-to-right, top-to-bottom)
    # We need column-major order (scan top-to-bottom, left-to-right)
    matched_coords_unsorted = np.argwhere(mask > 0)

    # Filter pixels within scan boundaries
    valid_mask = (
        (matched_coords_unsorted[:, 1] >= x_min) &  # x >= left margin
        (matched_coords_unsorted[:, 1] < x_max) &    # x < right margin
        (matched_coords_unsorted[:, 0] < y_max)      # y < bottom margin
    )
    matched_coords_filtered = matched_coords_unsorted[valid_mask]

    # Sort by column first (x), then row (y) - this gives us column-major order
    # matched_coords is (y, x), so we sort by [:, 1] (x) first, then [:, 0] (y)
    sorted_indices = np.lexsort((matched_coords_filtered[:, 0], matched_coords_filtered[:, 1]))
    matched_coords = matched_coords_filtered[sorted_indices]

    skipped_pixels = len(matched_coords_unsorted) - len(matched_coords)
    ColorPrint.blue(f"[SlidingWindow] Processing {len(matched_coords)} matched pixels (column-major order)")
    ColorPrint.blue(f"[SlidingWindow] Skipped {skipped_pixels} pixels outside scan boundaries")

    region_id = 1  # Start from 1, 0 means unprocessed
    found_normal_region = False  # Flag to stop processing after finding a normal region

    for pixel_idx, (py, px) in enumerate(matched_coords):
        # OPTIMIZATION: Stop immediately if we found a normal region (>= 50% color usage)
        if found_normal_region:
            break

        # Skip if this pixel is already part of a detected region
        if processed[py, px] != 0:
            continue

        # Use current pixel as top-left corner, create fixed size detection region
        x_start = px
        y_start = py

        # Calculate bottom-right corner with fixed dimensions (310x600)
        # Truncate if exceeds image boundaries
        x_end = min(w, x_start + max_width)
        y_end = min(h, y_start + max_height)

        # Extract region from mask
        region_mask = mask[y_start:y_end, x_start:x_end]

        # Check if ANY pixel in the detection region is already processed
        region_processed = processed[y_start:y_end, x_start:x_end]

        # Get matched pixels that are already assigned
        already_assigned = region_mask & (region_processed > 0)

        # If any matched pixel is already assigned, skip this detection region entirely
        if np.any(already_assigned):
            # Check if collision is allowed (different types can collide)
            overlapping_region_ids = np.unique(region_processed[already_assigned > 0])
            skip_region = False

            for other_region_id in overlapping_region_ids:
                if other_region_id == 0:
                    continue

                # We need to determine if current region would be a candidate
                # Do a quick check on the detection region
                temp_color_stats = {}
                if image is not None and colors is not None:
                    _, temp_color_stats = analyze_region_colors(image, x_start, y_start, x_end - x_start, y_end - y_start, colors)

                temp_num_colors = len(temp_color_stats) if temp_color_stats else 0
                temp_total_colors = len(colors) if colors else 12
                temp_percentage = (temp_num_colors / temp_total_colors) * 100 if temp_color_stats else 0
                temp_is_candidate = temp_percentage < 30.0

                other_is_candidate = region_candidate_status[other_region_id - 1]

                # Same type cannot collide
                if temp_is_candidate == other_is_candidate:
                    skip_region = True
                    break

            if skip_region:
                continue

        # Count only unprocessed matched pixels in this detection region
        unprocessed_matched_mask = region_mask & (region_processed == 0)
        matched_count = np.sum(unprocessed_matched_mask > 0)

        # If region contains enough matched pixels, create the region
        if matched_count >= min_area:
            # Find the bounding box of matched pixels (shrink to actual content)
            matched_pixels_coords = np.argwhere(unprocessed_matched_mask > 0)

            if len(matched_pixels_coords) > 0:
                # Get min/max coordinates relative to the detection region
                min_y, min_x = matched_pixels_coords.min(axis=0)
                max_y, max_x = matched_pixels_coords.max(axis=0)

                # Convert to absolute coordinates
                actual_x_start = x_start + min_x
                actual_y_start = y_start + min_y
                actual_x_end = x_start + max_x + 1  # +1 because we want inclusive
                actual_y_end = y_start + max_y + 1

                actual_width = actual_x_end - actual_x_start
                actual_height = actual_y_end - actual_y_start

                # Analyze color composition for the actual region
                color_stats = {}
                if image is not None and colors is not None:
                    _, color_stats = analyze_region_colors(image, actual_x_start, actual_y_start, actual_width, actual_height, colors)

                # Determine if this is a candidate region
                num_colors_used = len(color_stats) if color_stats else 0
                total_colors = len(colors) if colors else 12
                color_percentage = (num_colors_used / total_colors) * 100 if color_stats else 0
                is_candidate = color_percentage < 30.0

                # Check collision: if ANY matched pixel in this region is already assigned, cancel this region
                # Exception: gray (candidate) and green (normal) can overlap
                has_collision = False

                # Check all matched pixels in the actual bounding box
                actual_region_processed = processed[actual_y_start:actual_y_end, actual_x_start:actual_x_end]
                actual_region_mask = mask[actual_y_start:actual_y_end, actual_x_start:actual_x_end]

                # Get matched pixels that are already assigned to another region
                assigned_matched_pixels = actual_region_mask & (actual_region_processed > 0)

                if np.any(assigned_matched_pixels):
                    # Get the unique region IDs that overlap
                    overlapping_region_ids = np.unique(actual_region_processed[assigned_matched_pixels > 0])

                    for other_region_id in overlapping_region_ids:
                        if other_region_id == 0:
                            continue

                        other_is_candidate = region_candidate_status[other_region_id - 1]

                        # Rule: Same type (both gray OR both green) cannot collide
                        # Different types (gray vs green) CAN collide
                        if is_candidate == other_is_candidate:
                            has_collision = True
                            break

                if has_collision:
                    # Skip this entire region - do NOT create it
                    continue

                # Mark the matched pixels in the DETECTION region with this region ID
                matched_pixels_in_detection = mask[y_start:y_end, x_start:x_end] > 0
                processed[y_start:y_end, x_start:x_end][matched_pixels_in_detection] = region_id

                # Store region with actual bounding box
                regions.append((actual_x_start, actual_y_start, actual_width, actual_height, matched_count, color_stats, is_candidate))
                region_candidate_status.append(is_candidate)

                region_type = "Candidate" if is_candidate else "Normal"
                ColorPrint.green(f"[Region] Found: Position({actual_x_start},{actual_y_start}) Size({actual_width}x{actual_height}) Area={matched_count}px Type={region_type}")

                # OPTIMIZATION: If color usage >= 50%, stop all further detection
                if color_percentage >= 50.0:
                    found_normal_region = True
                    ColorPrint.green(f"[OPTIMIZATION] Found region with {color_percentage:.1f}% color usage (>= 50%) - stopping all further detection")

                region_id += 1

    ColorPrint.blue(f"[SlidingWindow] Detected {len(regions)} regions total")

    return regions


def draw_regions(image: np.ndarray, regions: List[Tuple[int, int, int, int, int, dict]], mask: np.ndarray = None) -> np.ndarray:
    """
    Draw detected regions and matched pixels on image

    Args:
        image: Original image (BGR)
        regions: List of regions [(x, y, width, height, area, color_stats), ...]
        mask: Binary mask of matched pixels (optional, for drawing pixel points)

    Returns:
        Annotated image
    """
    result = image.copy()

    # Draw matched pixel points if mask is provided
    if mask is not None:
        # Get all matched pixel coordinates
        matched_coords = np.argwhere(mask > 0)
        ColorPrint.blue(f"[DrawPixels] Drawing {len(matched_coords)} matched pixels...")

        # Draw small circles for each matched pixel (cyan color for visibility)
        for py, px in matched_coords:
            cv2.circle(result, (px, py), 1, (255, 255, 0), -1)  # Cyan dots

    # Draw region rectangles
    for idx, region_data in enumerate(regions):
        # Unpack region data
        if len(region_data) == 7:
            x, y, width, height, area, color_stats, is_candidate = region_data
        elif len(region_data) == 6:
            x, y, width, height, area, color_stats = region_data
            # Calculate is_candidate if not provided
            num_colors_used = len(color_stats) if color_stats else 0
            total_colors = len(TARGET_COLORS)
            color_percentage = (num_colors_used / total_colors) * 100 if color_stats else 0
            is_candidate = color_percentage < 30.0
        else:
            # Backward compatibility
            x, y, width, height, area = region_data[:5]
            color_stats = {}
            is_candidate = True

        # Choose color scheme based on candidate status
        if is_candidate:
            border_color = (128, 128, 128)  # Gray for candidate regions
            label_bg_color = (128, 128, 128)  # Gray background
            region_label = f"[Candidate] #{idx+1} ({area}px)"
        else:
            border_color = (0, 255, 0)  # Green for normal regions
            label_bg_color = (0, 255, 0)  # Green background
            region_label = f"#{idx+1} ({area}px)"

        # Draw rectangle border (2px)
        cv2.rectangle(result, (x, y), (x + width, y + height), border_color, 2)

        # Draw region number and area (top label)
        label_size, _ = cv2.getTextSize(region_label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)

        # Draw top label background
        cv2.rectangle(
            result,
            (x, y - label_size[1] - 5),
            (x + label_size[0] + 5, y),
            label_bg_color,
            -1
        )

        # Draw top label text
        cv2.putText(
            result,
            region_label,
            (x + 2, y - 3),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),  # White text for better visibility
            1,
            cv2.LINE_AA
        )

        # Draw color statistics (bottom label)
        if color_stats:
            num_colors_used = len(color_stats)
            total_colors = len(TARGET_COLORS)
            color_percentage = (num_colors_used / total_colors) * 100

            label_bottom = f"Pixels:{area} | Colors:{num_colors_used}/{total_colors} ({color_percentage:.1f}%)"
            label_size_b, baseline = cv2.getTextSize(label_bottom, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)

            # Position below the rectangle
            label_y = y + height + label_size_b[1] + 8

            # Draw bottom label background
            cv2.rectangle(
                result,
                (x, label_y - label_size_b[1] - 3),
                (x + label_size_b[0] + 5, label_y + 3),
                (255, 255, 255),
                -1
            )

            # Draw bottom label text
            cv2.putText(
                result,
                label_bottom,
                (x + 2, label_y - 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                (0, 0, 255),
                1,
                cv2.LINE_AA
            )

    return result


def process_image(image_path: str, output_dir: Path = None) -> None:
    """
    Process image and detect color regions

    Args:
        image_path: Input image path (supports Windows/Linux paths)
        output_dir: Output directory (default: current_dir/output)
    """
    # Normalize path for cross-platform compatibility
    image_path = str(Path(image_path).resolve())

    # Read image (measure screenshot/load time)
    load_start_time = time.time()
    image = cv2.imread(image_path)
    load_time_ms = (time.time() - load_start_time) * 1000

    if image is None:
        ColorPrint.red(f"[Error] Failed to read image: {image_path}")
        return

    ColorPrint.green(f"[Info] Image loaded: {image_path}")
    ColorPrint.blue(f"[Info] Image size: {image.shape[1]}x{image.shape[0]}")
    ColorPrint.green(f"[Timing] Image load time: {load_time_ms:.2f}ms")

    # Create color mask
    ColorPrint.blue("[Step 1] Creating color mask...")
    mask = create_color_mask(image, TARGET_COLORS, COLOR_TOLERANCE)

    # Calculate matched pixels
    matched_pixels = np.sum(mask > 0)
    total_pixels = mask.shape[0] * mask.shape[1]
    match_percent = (matched_pixels / total_pixels) * 100
    ColorPrint.green(f"[ColorMatch] Matched pixels: {matched_pixels}/{total_pixels} ({match_percent:.2f}%)")

    # Find color regions using sliding window (measure detection time)
    ColorPrint.blue("[Step 2] Finding color regions using sliding window...")
    detection_start_time = time.time()
    regions = find_connected_regions(mask, image, TARGET_COLORS, MIN_REGION_AREA)
    detection_time_ms = (time.time() - detection_start_time) * 1000
    ColorPrint.green(f"[Result] Found {len(regions)} regions (min pixels: {MIN_REGION_AREA})")
    ColorPrint.green(f"[Timing] Detection processing time: {detection_time_ms:.2f}ms")

    # Draw results (including matched pixel points)
    ColorPrint.blue("[Step 3] Drawing detection results with pixel points...")
    result_image = draw_regions(image, regions, mask)

    # Prepare output directory
    if output_dir is None:
        output_dir = Path(__file__).resolve().parent / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save results (measure save time)
    input_filename = Path(image_path).stem
    result_path = output_dir / f"{input_filename}_detected.png"
    mask_path = output_dir / f"{input_filename}_mask.png"

    save_start_time = time.time()
    cv2.imwrite(str(result_path), result_image)
    cv2.imwrite(str(mask_path), mask)
    save_time_ms = (time.time() - save_start_time) * 1000

    ColorPrint.green(f"[Output] Detection result saved: {result_path}")
    ColorPrint.green(f"[Output] Color mask saved: {mask_path}")
    ColorPrint.green(f"[Timing] Save time: {save_time_ms:.2f}ms")

    # Print detection summary
    print("\n" + "="*60)
    print("DETECTION SUMMARY")
    print("="*60)
    print(f"Input image:      {image_path}")
    print(f"Image size:       {image.shape[1]}x{image.shape[0]}")
    print(f"Target colors:    {len(TARGET_COLORS)} colors")
    print(f"Color tolerance:  ±{COLOR_TOLERANCE*100:.1f}%")
    print(f"Matched pixels:   {matched_pixels} ({match_percent:.2f}%)")
    print(f"Regions found:    {len(regions)}")
    print(f"Output directory: {output_dir}")
    print("="*60)
    print("\nTIMING BREAKDOWN (milliseconds):")
    print("-"*60)
    print(f"Image load time:       {load_time_ms:8.2f}ms")
    print(f"Detection time:        {detection_time_ms:8.2f}ms")
    print(f"Save time:             {save_time_ms:8.2f}ms")
    total_time_ms = load_time_ms + detection_time_ms + save_time_ms
    print(f"{'Total time:':<23}{total_time_ms:8.2f}ms")
    print("="*60 + "\n")

    # Print region details
    if regions:
        print("REGION DETAILS:")
        print("-"*60)
        for idx, region_data in enumerate(regions, 1):
            # Unpack region data
            if len(region_data) == 7:
                x, y, width, height, area, color_stats, is_candidate = region_data
            elif len(region_data) == 6:
                x, y, width, height, area, color_stats = region_data
                # Calculate is_candidate if not provided
                num_colors_used = len(color_stats) if color_stats else 0
                total_colors = len(TARGET_COLORS)
                color_percentage = (num_colors_used / total_colors) * 100 if color_stats else 0
                is_candidate = color_percentage < 30.0
            else:
                x, y, width, height, area = region_data[:5]
                color_stats = {}
                is_candidate = True

            # Calculate color percentage for display
            num_colors_used = len(color_stats) if color_stats else 0
            total_colors = len(TARGET_COLORS)
            color_percentage = (num_colors_used / total_colors) * 100 if color_stats else 0

            # Print region header with candidate marker
            if is_candidate:
                print(f"Region #{idx} [CANDIDATE - Low Color Usage]:")
            else:
                print(f"Region #{idx}:")

            print(f"  Position: ({x}, {y})")
            print(f"  Size:     {width}x{height}")
            print(f"  Area:     {area} pixels")

            # Print color statistics
            if color_stats:
                print(f"  Colors used: {num_colors_used}/{total_colors} ({color_percentage:.1f}%)")

                if is_candidate:
                    print(f"  ⚠ Warning: Color usage below 30% threshold")

                # Print per-color breakdown
                print(f"  Color breakdown:")
                for color_idx, pixel_count in sorted(color_stats.items()):
                    color_percent = (pixel_count / area) * 100
                    b, g, r = TARGET_COLORS[color_idx]
                    rgb_hex = f"#{r:02X}{g:02X}{b:02X}"
                    print(f"    Color {color_idx+1} ({rgb_hex}): {pixel_count} pixels ({color_percent:.1f}%)")

            print("-"*60)

    # Print matched pixel coordinates
    matched_coords = np.argwhere(mask > 0)
    print("\nMATCHED PIXEL COORDINATES:")
    print("="*60)
    print(f"Total matched pixels: {len(matched_coords)}")
    print("-"*60)

    # Print first 100 pixels to avoid overwhelming output
    max_print = min(100, len(matched_coords))
    for idx, (py, px) in enumerate(matched_coords[:max_print]):
        print(f"Pixel {idx+1:4d}: ({px:4d}, {py:4d})", end="")
        if (idx + 1) % 5 == 0:  # 5 pixels per line
            print()
        else:
            print("  |  ", end="")

    if len(matched_coords) > max_print:
        print(f"\n... and {len(matched_coords) - max_print} more pixels")
    else:
        print()
    print("="*60)


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python color_region_detector.py <image_path>")
        print("\nExample:")
        print("  python color_region_detector.py test_image.png")
        print("  python color_region_detector.py /path/to/image.png")
        print("  python color_region_detector.py C:\\Users\\path\\to\\image.png")
        print("\nTarget colors (BGR):")
        for idx, color in enumerate(TARGET_COLORS, 1):
            print(f"  Color {idx}: {color}")
        print(f"\nColor tolerance: ±{COLOR_TOLERANCE*100:.1f}%")
        print(f"Minimum region area: {MIN_REGION_AREA} pixels")
        sys.exit(1)

    # Normalize path for cross-platform compatibility
    image_path = str(Path(sys.argv[1]).resolve())

    if not Path(image_path).exists():
        ColorPrint.red(f"[Error] Image file not found: {image_path}")
        sys.exit(1)

    try:
        process_image(image_path)
    except Exception as e:
        ColorPrint.red(f"[Error] Processing failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
