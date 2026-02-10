#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Progress Bar and HP Bar Detector V2
Detects horizontal bars (progress bars and player HP bars) in game screenshots

Usage:
    python progress_bar_detector_v2.py <image_path>

Algorithm:
    1. Scan region with margins (left:155, top:190, bottom:400, right:1055)
    2. Row-by-row scan:
       - First pixel matching any target color → lock as base color
       - Check every 11th pixel: if matches base color ±5% → middle 10 pixels count as continuous
    3. When a line is found, probe next 10 rows and select the longest segment
    4. Keep the first row's y-coordinate, jump 24 pixels down based on first row
    5. Classification: >150px = Progress Bar, ≤150px = HP Bar
"""

import os
import sys
import time
from pathlib import Path
from typing import List, Tuple, Optional, Dict

# Add project paths
current_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(current_dir))
from share.project_path import get_project_root
sys.path.insert(0, str(get_project_root().parent.parent))

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
from pycore.pyfoundations.color_print import ColorPrint

cv2 = get_third_package_cv2()
np = get_third_package_numpy()


# ============================================================================
# Configuration
# ============================================================================

# Target colors (BGR format) - from requirement
TARGET_COLORS_BGR = [
    (0x57, 0x5b, 0xc6),  # c65b57
    (0x0c, 0x12, 0x72),  # 72120c
    (0x0f, 0x17, 0x6d),  # 6d170f
    (0x0c, 0x0d, 0x49),  # 490d0c
    (0x38, 0x39, 0x94),  # 943938
    (0x0a, 0x08, 0x36),  # 36080a
    (0x14, 0x14, 0x53),  # 531414
    (0x2d, 0x39, 0xa0),  # a0392d
]

# Scan region margins (pixels to skip from edges)
LEFT_MARGIN = 155
TOP_MARGIN = 190
BOTTOM_MARGIN = 400
RIGHT_MARGIN = 1055

# Detection parameters
COLOR_TOLERANCE = 0.05  # ±5% tolerance
GROUP_SIZE = 11  # Check 11 pixels as one group
MIN_MATCHES_PER_GROUP = 1  # At least 1 match in each group
ROW_SKIP_DISTANCE = 24  # Skip 24 pixels down after finding a line
PROBE_DEPTH = 10  # Probe next 10 rows to find longest segment
PROGRESS_BAR_THRESHOLD = 150  # Lines >150px are progress bars


# ============================================================================
# Utility Functions
# ============================================================================

def load_image(image_path: Path) -> Optional[np.ndarray]:
    """Load image supporting non-ASCII paths"""
    try:
        data = np.fromfile(str(image_path), dtype=np.uint8)
        if data.size == 0:
            return None
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except Exception as e:
        ColorPrint.red(f"[Error] Failed to load image: {e}")
        return None


def save_image(path: Path, image: np.ndarray) -> bool:
    """Save image supporting non-ASCII paths"""
    try:
        suffix = path.suffix or '.png'
        success, buffer = cv2.imencode(suffix, image)
        if not success:
            return False
        buffer.tofile(str(path))
        return True
    except Exception as e:
        ColorPrint.red(f"[Error] Failed to save image: {e}")
        return False


def pixel_matches_any_color(pixel_bgr: np.ndarray, tolerance: float = COLOR_TOLERANCE) -> bool:
    """
    Check if a pixel matches any target color within tolerance

    Args:
        pixel_bgr: Pixel value (B, G, R)
        tolerance: Color tolerance (±5% = 0.05)

    Returns:
        True if pixel matches any target color
    """
    b, g, r = int(pixel_bgr[0]), int(pixel_bgr[1]), int(pixel_bgr[2])

    for target_b, target_g, target_r in TARGET_COLORS_BGR:
        # Calculate ±5% range for each channel
        b_lower = int(target_b * (1 - tolerance))
        b_upper = int(target_b * (1 + tolerance))
        g_lower = int(target_g * (1 - tolerance))
        g_upper = int(target_g * (1 + tolerance))
        r_lower = int(target_r * (1 - tolerance))
        r_upper = int(target_r * (1 + tolerance))

        # Check if pixel is within range
        if (b_lower <= b <= b_upper and
            g_lower <= g <= g_upper and
            r_lower <= r <= r_upper):
            return True

    return False


def pixel_matches_base_color(pixel_bgr: np.ndarray, base_color_bgr: np.ndarray, tolerance: float = COLOR_TOLERANCE) -> bool:
    """
    Check if a pixel matches a base color within tolerance

    Args:
        pixel_bgr: Pixel value (B, G, R)
        base_color_bgr: Base color to match against (B, G, R)
        tolerance: Color tolerance (±5% = 0.05)

    Returns:
        True if pixel matches base color
    """
    b, g, r = int(pixel_bgr[0]), int(pixel_bgr[1]), int(pixel_bgr[2])
    base_b, base_g, base_r = int(base_color_bgr[0]), int(base_color_bgr[1]), int(base_color_bgr[2])

    # Calculate ±5% range for each channel based on base color
    b_lower = int(base_b * (1 - tolerance))
    b_upper = int(base_b * (1 + tolerance))
    g_lower = int(base_g * (1 - tolerance))
    g_upper = int(base_g * (1 + tolerance))
    r_lower = int(base_r * (1 - tolerance))
    r_upper = int(base_r * (1 + tolerance))

    # Check if pixel is within range
    return (b_lower <= b <= b_upper and
            g_lower <= g <= g_upper and
            r_lower <= r <= r_upper)


# ============================================================================
# Core Detection Logic
# ============================================================================

def find_first_segment_in_row(row_pixels: np.ndarray, debug: bool = False) -> Optional[Tuple[int, int, Optional[np.ndarray]]]:
    """
    Find the first continuous segment in a row using base color locking

    Algorithm:
    1. Find first pixel that matches any target color → lock as base color
    2. Check every 11th pixel: if it matches base color ±5%, middle 10 pixels all count as continuous
    3. If 11th pixel doesn't match → segment ends

    Args:
        row_pixels: Row pixel array (shape: [width, 3])
        debug: Enable debug output

    Returns:
        (x_start, x_end, base_color) if found, None otherwise
    """
    width = len(row_pixels)
    if width == 0:
        return None

    # Step 1: Find first pixel matching any target color (this becomes base color)
    base_color = None
    segment_start = None

    for x in range(width):
        pixel = row_pixels[x]
        if pixel_matches_any_color(pixel):
            base_color = pixel.copy()  # Lock this pixel's actual color as base
            segment_start = x
            if debug:
                ColorPrint.gray(f"    [BaseColor] Locked at x={x}: BGR({base_color[0]}, {base_color[1]}, {base_color[2]})")
            break

    if base_color is None:
        # No matching pixel found in entire row
        return None

    # Step 2: Scan in groups of 11, checking if 11th pixel matches base color
    x = segment_start

    while x < width:
        # Check the 11th pixel (or last pixel if less than 11 remaining)
        check_pos = min(x + GROUP_SIZE, width) - 1
        check_pixel = row_pixels[check_pos]

        # If 11th pixel matches base color → entire group is continuous
        if pixel_matches_base_color(check_pixel, base_color):
            x = check_pos + 1  # Move past this group
            continue
        else:
            # 11th pixel doesn't match → segment ends at current position
            return (segment_start, x, base_color)

    # Segment extends to row end
    return (segment_start, width, base_color)


def find_longest_segment_in_rows(
    image: np.ndarray,
    first_y: int,
    x_min: int,
    x_max: int,
    y_max: int,
    debug: bool = False
) -> Optional[Tuple[int, int, int, Optional[np.ndarray]]]:
    """
    Find the longest segment from first_y and next PROBE_DEPTH rows

    Args:
        image: Source image
        first_y: First row y-coordinate
        x_min: Scan region left boundary
        x_max: Scan region right boundary
        y_max: Scan region bottom boundary
        debug: Enable debug output

    Returns:
        (x_start, x_end, length, base_color) of longest segment, or None
    """
    longest_segment = None
    max_length = 0
    best_base_color = None

    # Probe first_y and next PROBE_DEPTH rows (total: PROBE_DEPTH + 1 rows)
    for dy in range(PROBE_DEPTH + 1):
        probe_y = first_y + dy
        if probe_y >= y_max:
            break

        # Extract row pixels
        row_pixels = image[probe_y, x_min:x_max]

        # Find first segment in this row
        segment = find_first_segment_in_row(row_pixels, debug=debug)

        if segment is not None:
            x_start, x_end, base_color = segment
            length = x_end - x_start

            if debug and dy == 0:
                ColorPrint.gray(f"  [Probe] Row dy={dy}: segment=[{x_start}, {x_end}), length={length}")

            if length > max_length:
                max_length = length
                longest_segment = (x_start, x_end, length)
                best_base_color = base_color

    if longest_segment is not None:
        return (longest_segment[0], longest_segment[1], longest_segment[2], best_base_color)

    return None


def detect_horizontal_bars(
    image: np.ndarray,
    left_margin: int = LEFT_MARGIN,
    top_margin: int = TOP_MARGIN,
    bottom_margin: int = BOTTOM_MARGIN,
    right_margin: int = RIGHT_MARGIN
) -> List[Dict]:
    """
    Detect horizontal bars (progress and HP bars)

    Args:
        image: Source image (BGR)
        left_margin, top_margin, bottom_margin, right_margin: Scan margins

    Returns:
        List of detected bars with coordinates and metadata
    """
    h, w = image.shape[:2]

    # Calculate scan region
    x_min = left_margin
    x_max = w - right_margin
    y_min = top_margin
    y_max = h - bottom_margin

    ColorPrint.blue(f"[ScanRegion] Image: {w}x{h}")
    ColorPrint.blue(f"[ScanRegion] Scan area: x=[{x_min}, {x_max}), y=[{y_min}, {y_max})")
    ColorPrint.blue(f"[ScanRegion] Effective size: {x_max - x_min}x{y_max - y_min}")

    bars = []
    y = y_min

    while y < y_max:
        # Extract current row pixels in scan region
        row_pixels = image[y, x_min:x_max]

        # Find first segment in current row
        segment = find_first_segment_in_row(row_pixels, debug=False)

        if segment is None:
            # No segment found, move to next row
            y += 1
            continue

        # Found a segment! Now probe next PROBE_DEPTH rows to find longest
        longest = find_longest_segment_in_rows(image, y, x_min, x_max, y_max, debug=False)

        if longest is None:
            # Should not happen (we already found a segment), but handle gracefully
            y += 1
            continue

        x_start_rel, x_end_rel, length, base_color = longest

        # Convert to absolute coordinates
        x_start_abs = x_min + x_start_rel
        x_end_abs = x_min + x_end_rel

        # Classify bar type
        bar_type = 'progress' if length > PROGRESS_BAR_THRESHOLD else 'hp'

        # Record bar (include base color for debugging)
        bars.append({
            'y': y,  # Keep first row's y
            'x_start': x_start_abs,
            'x_end': x_end_abs,
            'length': length,
            'type': bar_type,
            'base_color': base_color  # Store base color used
        })

        # Jump ROW_SKIP_DISTANCE pixels down from first row
        y += ROW_SKIP_DISTANCE

    ColorPrint.green(f"[Result] Found {len(bars)} bars")
    progress_bars = [b for b in bars if b['type'] == 'progress']
    hp_bars = [b for b in bars if b['type'] == 'hp']
    ColorPrint.green(f"[Result] Progress: {len(progress_bars)}, HP: {len(hp_bars)}")

    return bars


# ============================================================================
# Visualization
# ============================================================================

def create_color_mask(image: np.ndarray) -> np.ndarray:
    """
    Create binary mask showing pixels matching target colors

    Args:
        image: Source image (BGR)

    Returns:
        Binary mask (255 = match, 0 = no match)
    """
    h, w = image.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    ColorPrint.blue("[ColorMask] Creating mask...")

    for y in range(h):
        for x in range(w):
            pixel = image[y, x]
            if pixel_matches_any_color(pixel):
                mask[y, x] = 255

    matched_pixels = np.sum(mask > 0)
    total_pixels = h * w
    match_percent = (matched_pixels / total_pixels) * 100
    ColorPrint.green(f"[ColorMask] Matched: {matched_pixels}/{total_pixels} ({match_percent:.2f}%)")

    return mask


def draw_detection_results(
    image: np.ndarray,
    bars: List[Dict],
    left_margin: int = LEFT_MARGIN,
    top_margin: int = TOP_MARGIN,
    bottom_margin: int = BOTTOM_MARGIN,
    right_margin: int = RIGHT_MARGIN
) -> np.ndarray:
    """
    Draw detected bars on image with annotations

    Args:
        image: Source image
        bars: Detected bars
        margins: Scan region margins

    Returns:
        Annotated image
    """
    result = image.copy()
    h, w = result.shape[:2]

    # Draw scan region rectangle (cyan)
    x_min = left_margin
    x_max = w - right_margin
    y_min = top_margin
    y_max = h - bottom_margin
    cv2.rectangle(result, (x_min, y_min), (x_max, y_max), (255, 255, 0), 2)

    # Draw each bar
    progress_idx = 0
    hp_idx = 0

    for bar in bars:
        y = bar['y']
        x_start = bar['x_start']
        x_end = bar['x_end']
        length = bar['length']
        bar_type = bar['type']
        base_color = bar.get('base_color')

        if bar_type == 'progress':
            progress_idx += 1
            color = (0, 255, 0)  # Green
            label = f"Progress #{progress_idx} ({length}px)"
        else:
            hp_idx += 1
            color = (0, 165, 255)  # Orange
            label = f"HP #{hp_idx} ({length}px)"

        # Add base color info to label if available
        if base_color is not None:
            label += f" B{int(base_color[0])}"

        # Draw horizontal line (thick)
        cv2.line(result, (x_start, y), (x_end - 1, y), color, 3)

        # Draw start/end markers
        cv2.circle(result, (x_start, y), 5, (255, 0, 0), -1)  # Blue start
        cv2.circle(result, (x_end - 1, y), 5, (0, 0, 255), -1)  # Red end

        # Draw label
        label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        label_x = x_start
        label_y = y - 10

        # Label background
        cv2.rectangle(
            result,
            (label_x, label_y - label_size[1] - 2),
            (label_x + label_size[0] + 4, label_y + 2),
            color,
            -1
        )

        # Label text
        cv2.putText(
            result,
            label,
            (label_x + 2, label_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA
        )

    return result


# ============================================================================
# Main Processing
# ============================================================================

def process_image(image_path: Path, output_dir: Path = None) -> None:
    """
    Process image and detect bars

    Args:
        image_path: Input image path
        output_dir: Output directory (default: ./output)
    """
    image_path = Path(image_path).resolve()

    # Load image
    ColorPrint.blue(f"[Load] Loading image: {image_path}")
    load_start = time.time()
    image = load_image(image_path)
    load_time = (time.time() - load_start) * 1000

    if image is None:
        ColorPrint.red(f"[Error] Failed to load image")
        return

    h, w = image.shape[:2]
    ColorPrint.green(f"[Load] Image loaded: {w}x{h} ({load_time:.2f}ms)")

    # Create color mask
    ColorPrint.blue("[Step 1/3] Creating color mask...")
    mask_start = time.time()
    mask = create_color_mask(image)
    mask_time = (time.time() - mask_start) * 1000
    ColorPrint.green(f"[Step 1/3] Mask created ({mask_time:.2f}ms)")

    # Detect bars
    ColorPrint.blue("[Step 2/3] Detecting horizontal bars...")
    detect_start = time.time()
    bars = detect_horizontal_bars(image, LEFT_MARGIN, TOP_MARGIN, BOTTOM_MARGIN, RIGHT_MARGIN)
    detect_time = (time.time() - detect_start) * 1000
    ColorPrint.green(f"[Step 2/3] Detection completed ({detect_time:.2f}ms)")

    # Draw results
    ColorPrint.blue("[Step 3/3] Drawing results...")
    draw_start = time.time()
    result_image = draw_detection_results(image, bars, LEFT_MARGIN, TOP_MARGIN, BOTTOM_MARGIN, RIGHT_MARGIN)
    draw_time = (time.time() - draw_start) * 1000
    ColorPrint.green(f"[Step 3/3] Drawing completed ({draw_time:.2f}ms)")

    # Save outputs
    if output_dir is None:
        output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    input_name = image_path.stem
    result_path = output_dir / f"{input_name}_bars_detected.png"
    mask_path = output_dir / f"{input_name}_bars_mask.png"

    save_start = time.time()
    result_saved = save_image(result_path, result_image)
    mask_saved = save_image(mask_path, mask)
    save_time = (time.time() - save_start) * 1000

    if result_saved:
        ColorPrint.green(f"[Output] Detection result: {result_path}")
    if mask_saved:
        ColorPrint.green(f"[Output] Color mask: {mask_path}")

    ColorPrint.green(f"[Output] Files saved ({save_time:.2f}ms)")

    # Print summary
    total_time = load_time + mask_time + detect_time + draw_time + save_time

    print("\n" + "="*80)
    print("DETECTION SUMMARY")
    print("="*80)
    print(f"Input:           {image_path}")
    print(f"Image size:      {w}x{h}")
    print(f"Bars found:      {len(bars)}")
    print(f"  - Progress:    {len([b for b in bars if b['type'] == 'progress'])}")
    print(f"  - HP:          {len([b for b in bars if b['type'] == 'hp'])}")
    print(f"Output dir:      {output_dir}")
    print("="*80)
    print(f"\nTIMING (milliseconds):")
    print(f"  Load:          {load_time:8.2f}ms")
    print(f"  Mask:          {mask_time:8.2f}ms")
    print(f"  Detection:     {detect_time:8.2f}ms")
    print(f"  Drawing:       {draw_time:8.2f}ms")
    print(f"  Save:          {save_time:8.2f}ms")
    print(f"  {'Total:':<15}{total_time:8.2f}ms")
    print("="*80)

    # Print bar details
    if bars:
        print("\nDETECTED BARS:")
        print("="*80)

        # Progress bars
        progress_bars = [b for b in bars if b['type'] == 'progress']
        if progress_bars:
            print(f"\nProgress Bars ({len(progress_bars)}):")
            print("-"*80)
            for idx, bar in enumerate(progress_bars, 1):
                print(f"  #{idx}: y={bar['y']:4d}, x=[{bar['x_start']:4d}, {bar['x_end']:4d}), length={bar['length']:4d}px")

        # HP bars
        hp_bars = [b for b in bars if b['type'] == 'hp']
        if hp_bars:
            print(f"\nHP Bars ({len(hp_bars)}):")
            print("-"*80)
            for idx, bar in enumerate(hp_bars, 1):
                print(f"  #{idx}: y={bar['y']:4d}, x=[{bar['x_start']:4d}, {bar['x_end']:4d}), length={bar['length']:4d}px")

        print("="*80)


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Progress Bar and HP Bar Detector V2")
        print("="*80)
        print("\nUsage:")
        print("  python progress_bar_detector_v2.py <image_path>")
        print("\nExample:")
        print("  python progress_bar_detector_v2.py screenshot.png")
        print("  python progress_bar_detector_v2.py D:\\path\\to\\image.png")
        print("\nConfiguration:")
        print(f"  Target colors:       {len(TARGET_COLORS_BGR)} colors")
        print(f"  Color tolerance:     ±{COLOR_TOLERANCE*100:.1f}%")
        print(f"  Scan margins:        L={LEFT_MARGIN}, T={TOP_MARGIN}, B={BOTTOM_MARGIN}, R={RIGHT_MARGIN}")
        print(f"  Group size:          {GROUP_SIZE} pixels")
        print(f"  Min matches/group:   {MIN_MATCHES_PER_GROUP}")
        print(f"  Row skip:            {ROW_SKIP_DISTANCE} pixels")
        print(f"  Probe depth:         {PROBE_DEPTH} rows")
        print(f"  Progress threshold:  >{PROGRESS_BAR_THRESHOLD} pixels")
        print("="*80)
        sys.exit(1)

    image_path = Path(sys.argv[1]).resolve()

    if not image_path.exists():
        ColorPrint.red(f"[Error] Image not found: {image_path}")
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
