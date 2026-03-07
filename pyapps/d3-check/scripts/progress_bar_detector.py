#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Progress Bar and HP Bar Detector
Detects horizontal bars (progress bars and player HP bars) in game screenshots

Usage:
    python progress_bar_detector.py <image_path>

Features:
    - Scan specific region with margins (left:155, top:190, bottom:400, right:1055)
    - Detect horizontal lines using target colors with ±5% tolerance
    - Use relaxed connectivity: 1 matched pixel in every 11 pixels counts as continuous
    - Skip 24 pixels down after finding each line
    - Classify bars: >150px = Progress Bar, <=150px = Player HP Bar

Algorithm:
    For each row in scan region:
    - Check pixels in groups of 11
    - If at least 1 pixel matches in the group, consider it continuous
    - Track continuous line segments
    - After finding a line, skip 24 pixels down
    - Classify and draw results
"""

import os
import sys
import time
from pathlib import Path
from typing import Dict, List, NamedTuple, Optional, Tuple

# Add project paths
current_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(current_dir))
from share.project_path import get_project_root
sys.path.insert(0, str(get_project_root().parent.parent))

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
from pycore.pyfoundations.color_print import ColorPrint

cv2 = get_third_package_cv2()
np = get_third_package_numpy()


# Target color group for HP/Progress bars (BGR format)
# RGB -> BGR conversion: #RRGGBB -> (BB, GG, RR)
TARGET_COLORS = [
    (0x57, 0x5b, 0xc6),  # c65b57 - RGB: c65b57
    (0x0c, 0x12, 0x72),  # 72120c - RGB: 72120c
    (0x0f, 0x17, 0x6d),  # 6d170f - RGB: 6d170f
    (0x0c, 0x0d, 0x49),  # 490d0c - RGB: 490d0c
    (0x0c, 0x0d, 0x49),  # 490d0c - RGB: 490d0c (duplicate)
    (0x38, 0x39, 0x94),  # 943938 - RGB: 943938
    (0x0a, 0x08, 0x36),  # 36080a - RGB: 36080a
    (0x14, 0x14, 0x53),  # 531414 - RGB: 531414
    (0x2d, 0x39, 0xa0),  # a0392d - RGB: a0392d
]

# Color tolerance (±5%)
COLOR_TOLERANCE = 0.05

# Scan margins (pixels to skip from edges)
LEFT_MARGIN = 155
TOP_MARGIN = 190
BOTTOM_MARGIN = 400
RIGHT_MARGIN = 1055

# Detection parameters
CONNECTIVITY_GROUP_SIZE = 11  # Check 1 matched pixel in every 11 pixels
MIN_MATCHES_PER_GROUP = 1     # At least 1 match in each group
ROW_SKIP_DISTANCE = 24        # Skip 24 pixels down after finding a line
PROGRESS_BAR_THRESHOLD = 150  # Lines > 150px are progress bars


def classify_bar(length: int) -> str:
    """Classify bar type based on length threshold."""
    return 'progress' if length > PROGRESS_BAR_THRESHOLD else 'hp'


def load_bgr_image(image_path: Path) -> Optional[np.ndarray]:
    """Load an image from disk supporting non-ASCII Windows paths."""
    try:
        data = np.fromfile(str(image_path), dtype=np.uint8)
    except OSError:
        return None
    if data.size == 0:
        return None
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    return image


def imwrite_unicode(path: Path, image: np.ndarray) -> bool:
    """Write an image to disk supporting non-ASCII Windows paths."""
    path = Path(path)
    suffix = path.suffix or '.png'
    success, buffer = cv2.imencode(suffix, image)
    if not success:
        return False
    try:
        buffer.tofile(str(path))
    except OSError:
        return False
    return True


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

        matched_count = np.sum(mask > 0)
        ColorPrint.blue(f"[ColorMask] Color {idx+1}: BGR{color} → Pixels: {matched_count}")

    return combined_mask


class RowSegment(NamedTuple):
    """Represents a detected segment within a single row."""

    start: int
    end: int
    length: int
    lower: np.ndarray
    upper: np.ndarray


def match_pixel_to_target_colors(
    pixel: np.ndarray,
    color_ranges: List[Tuple[np.ndarray, np.ndarray]],
) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    """Return the first target color range that matches the pixel."""

    for lower, upper in color_ranges:
        if (
            lower[0] <= pixel[0] <= upper[0]
            and lower[1] <= pixel[1] <= upper[1]
            and lower[2] <= pixel[2] <= upper[2]
        ):
            return lower, upper
    return None


def count_matches_in_range(pixels: np.ndarray, lower: np.ndarray, upper: np.ndarray) -> int:
    """Count how many pixels fall within the inclusive [lower, upper] range."""

    if pixels.size == 0:
        return 0
    pixels_2d = np.atleast_2d(pixels)
    matches = (
        (pixels_2d[..., 0] >= lower[0])
        & (pixels_2d[..., 0] <= upper[0])
        & (pixels_2d[..., 1] >= lower[1])
        & (pixels_2d[..., 1] <= upper[1])
        & (pixels_2d[..., 2] >= lower[2])
        & (pixels_2d[..., 2] <= upper[2])
    )
    return int(np.count_nonzero(matches))


def find_row_segment(
    pixel_row: np.ndarray,
    color_ranges: List[Tuple[np.ndarray, np.ndarray]],
    group_size: int,
    min_matches: int,
    tolerance: float,
    base_range: Optional[Tuple[np.ndarray, np.ndarray]] = None,
) -> Optional[RowSegment]:
    """Find the first segment in a row following the relaxed connectivity rule."""

    width = int(pixel_row.shape[0])
    if width == 0:
        return None

    x = 0
    in_segment = False
    segment_start = 0
    working_range: Optional[Tuple[np.ndarray, np.ndarray]] = (
        (base_range[0].copy(), base_range[1].copy()) if base_range is not None else None
    )

    while x < width:
        group_end = min(x + group_size, width)
        group_pixels = pixel_row[x:group_end]

        if not in_segment:
            if working_range is None:
                matched_range = None
                for pixel in group_pixels:
                    candidate = match_pixel_to_target_colors(pixel, color_ranges)
                    if candidate is not None:
                        matched_range = calculate_color_range(
                            (int(pixel[0]), int(pixel[1]), int(pixel[2])), tolerance
                        )
                        break
                if matched_range is not None:
                    working_range = matched_range
                    lower, upper = working_range
                    if count_matches_in_range(group_pixels, lower, upper) >= min_matches:
                        in_segment = True
                        segment_start = x
                        x = group_end
                        continue
            else:
                lower, upper = working_range
                if count_matches_in_range(group_pixels, lower, upper) >= min_matches:
                    in_segment = True
                    segment_start = x
                    x = group_end
                    continue
        else:
            if working_range is None:
                in_segment = False
                x = group_end
                continue
            lower, upper = working_range
            if count_matches_in_range(group_pixels, lower, upper) >= min_matches:
                x = group_end
                continue
            segment_end = x
            if segment_end > segment_start:
                return RowSegment(segment_start, segment_end, segment_end - segment_start, lower, upper)
            in_segment = False

        x = group_end

    if in_segment and working_range is not None:
        lower, upper = working_range
        return RowSegment(segment_start, width, width - segment_start, lower, upper)

    return None


def find_horizontal_bars(
    mask: np.ndarray,
    image: np.ndarray,
    left_margin: int = LEFT_MARGIN,
    top_margin: int = TOP_MARGIN,
    bottom_margin: int = BOTTOM_MARGIN,
    right_margin: int = RIGHT_MARGIN,
) -> List[Dict]:
    """Find horizontal bars (progress and HP) using the configured scan logic."""

    h, w = image.shape[:2]
    bars: List[Dict] = []

    color_ranges = [calculate_color_range(color, COLOR_TOLERANCE) for color in TARGET_COLORS]

    x_min = left_margin
    x_max = w - right_margin
    y_min = top_margin
    y_max = h - bottom_margin

    ColorPrint.blue(f"[ScanBounds] Image size: {w}x{h}")
    ColorPrint.blue(f"[ScanBounds] Scan region: x=[{x_min}, {x_max}), y=[{y_min}, {y_max})")
    ColorPrint.blue(
        f"[ScanBounds] Margins: left={left_margin}px, top={top_margin}px, bottom={bottom_margin}px, right={right_margin}px"
    )

    scan_width = x_max - x_min
    scan_height = y_max - y_min
    ColorPrint.blue(f"[ScanBounds] Effective scan area: {scan_width}x{scan_height} pixels")

    y = y_min
    scanned_rows = 0

    while y < y_max:
        scanned_rows += 1
        pixel_row = image[y, x_min:x_max]
        segment = find_row_segment(
            pixel_row,
            color_ranges,
            CONNECTIVITY_GROUP_SIZE,
            MIN_MATCHES_PER_GROUP,
            COLOR_TOLERANCE,
        )
        if segment is None or segment.length <= 0:
            y += 1
            continue

        best_segment = segment
        base_range = (segment.lower, segment.upper)

        for dy in range(1, 11):
            py = y + dy
            if py >= y_max:
                break
            candidate_row = image[py, x_min:x_max]
            candidate = find_row_segment(
                candidate_row,
                color_ranges,
                CONNECTIVITY_GROUP_SIZE,
                MIN_MATCHES_PER_GROUP,
                COLOR_TOLERANCE,
                base_range=base_range,
            )
            if candidate and candidate.length > best_segment.length:
                best_segment = candidate

        length = best_segment.length
        if length <= 0:
            y += 1
            continue

        abs_start = x_min + best_segment.start
        abs_end = x_min + best_segment.end

        bars.append(
            {
                'y': y,
                'x_start': abs_start,
                'x_end': abs_end,
                'length': length,
                'type': classify_bar(length),
            }
        )

        y += ROW_SKIP_DISTANCE

    ColorPrint.blue(f"[RowScan] Scanned {scanned_rows} rows, found {len(bars)} bars")

    progress_bars = [b for b in bars if b['type'] == 'progress']
    hp_bars = [b for b in bars if b['type'] == 'hp']

    ColorPrint.green(f"[Result] Progress Bars: {len(progress_bars)}, HP Bars: {len(hp_bars)}")

    return bars

def draw_bars(image: np.ndarray, bars: List[Dict]) -> np.ndarray:
    """
    Draw detected bars on image

    Args:
        image: Original image (BGR)
        bars: List of detected bars

    Returns:
        Annotated image
    """
    result = image.copy()

    # Draw scan region rectangle for visualization
    h, w = result.shape[:2]
    x_min = LEFT_MARGIN
    x_max = w - RIGHT_MARGIN
    y_min = TOP_MARGIN
    y_max = h - BOTTOM_MARGIN
    cv2.rectangle(result, (x_min, y_min), (x_max, y_max), (255, 255, 0), 2)  # Cyan rectangle

    progress_count = 0
    hp_count = 0

    for bar in bars:
        y = bar['y']
        x_start = bar['x_start']
        x_end = bar['x_end']
        length = bar['length']
        bar_type = bar['type']

        # Choose color and label based on type
        if bar_type == 'progress':
            progress_count += 1
            color = (0, 255, 0)  # Green for progress bars
            label = f"Progress #{progress_count} ({length}px)"
        else:
            hp_count += 1
            color = (0, 165, 255)  # Orange for HP bars
            label = f"HP #{hp_count} ({length}px)"

        # Draw horizontal line (thicker for visibility)
        end_x = max(x_start, x_end - 1)
        cv2.line(result, (x_start, y), (end_x, y), color, 3)

        # Draw start and end markers
        cv2.circle(result, (x_start, y), 4, (255, 0, 0), -1)  # Blue dot at start
        cv2.circle(result, (end_x, y), 4, (0, 0, 255), -1)    # Red dot at end

        # Draw label above the line
        label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        label_x = x_start
        label_y = y - 8

        # Draw label background
        cv2.rectangle(
            result,
            (label_x, label_y - label_size[1] - 2),
            (label_x + label_size[0] + 4, label_y + 2),
            color,
            -1
        )

        # Draw label text
        cv2.putText(
            result,
            label,
            (label_x + 2, label_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),  # White text
            1,
            cv2.LINE_AA
        )

    return result


def process_image(image_path: Path, output_dir: Path = None) -> None:
    """
    Process image and detect progress bars and HP bars

    Args:
        image_path: Input image path (supports Windows/Linux paths)
        output_dir: Output directory (default: current_dir/output)
    """
    # Normalize path for cross-platform compatibility
    image_path = Path(image_path).expanduser().resolve()

    # Read image (measure load time)
    load_start_time = time.time()
    image = load_bgr_image(image_path)
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

    # Find horizontal bars (measure detection time)
    ColorPrint.blue("[Step 2] Finding horizontal bars...")
    detection_start_time = time.time()
    bars = find_horizontal_bars(mask, image, LEFT_MARGIN, TOP_MARGIN, BOTTOM_MARGIN, RIGHT_MARGIN)
    detection_time_ms = (time.time() - detection_start_time) * 1000
    ColorPrint.green(f"[Timing] Detection processing time: {detection_time_ms:.2f}ms")

    # Draw results
    ColorPrint.blue("[Step 3] Drawing detection results...")
    result_image = draw_bars(image, bars)

    # Prepare output directory
    if output_dir is None:
        output_dir = Path(__file__).resolve().parent / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save results (measure save time)
    input_filename = image_path.stem
    result_path = output_dir / f"{input_filename}_bars_detected.png"
    mask_path = output_dir / f"{input_filename}_bars_mask.png"

    save_start_time = time.time()
    result_saved = imwrite_unicode(result_path, result_image)
    mask_saved = imwrite_unicode(mask_path, mask)
    save_time_ms = (time.time() - save_start_time) * 1000

    if result_saved:
        ColorPrint.green(f"[Output] Detection result saved: {result_path}")
    else:
        ColorPrint.red(f"[Error] Failed to save detection result: {result_path}")

    if mask_saved:
        ColorPrint.green(f"[Output] Color mask saved: {mask_path}")
    else:
        ColorPrint.red(f"[Error] Failed to save color mask: {mask_path}")

    ColorPrint.green(f"[Timing] Save time: {save_time_ms:.2f}ms")

    # Print detection summary
    print("\n" + "="*70)
    print("DETECTION SUMMARY")
    print("="*70)
    print(f"Input image:      {image_path}")
    print(f"Image size:       {image.shape[1]}x{image.shape[0]}")
    print(f"Target colors:    {len(TARGET_COLORS)} colors")
    print(f"Color tolerance:  ±{COLOR_TOLERANCE*100:.1f}%")
    print(f"Matched pixels:   {matched_pixels} ({match_percent:.2f}%)")
    print(f"Bars found:       {len(bars)}")
    print(f"Output directory: {output_dir}")
    print("="*70)
    print("\nTIMING BREAKDOWN (milliseconds):")
    print("-"*70)
    print(f"Image load time:       {load_time_ms:8.2f}ms")
    print(f"Detection time:        {detection_time_ms:8.2f}ms")
    print(f"Save time:             {save_time_ms:8.2f}ms")
    total_time_ms = load_time_ms + detection_time_ms + save_time_ms
    print(f"{'Total time:':<23}{total_time_ms:8.2f}ms")
    print("="*70 + "\n")

    # Print bar details
    if bars:
        print("BAR DETAILS:")
        print("="*70)

        # Print progress bars
        progress_bars = [b for b in bars if b['type'] == 'progress']
        if progress_bars:
            print(f"\nPROGRESS BARS ({len(progress_bars)} found):")
            print("-"*70)
            for idx, bar in enumerate(progress_bars, 1):
                print(f"Progress Bar #{idx}:")
                print(f"  Position:    y={bar['y']}, x=[{bar['x_start']}, {bar['x_end']})")
                print(f"  Length:      {bar['length']} pixels")
                print("-"*70)

        # Print HP bars
        hp_bars = [b for b in bars if b['type'] == 'hp']
        if hp_bars:
            print(f"\nPLAYER HP BARS ({len(hp_bars)} found):")
            print("-"*70)
            for idx, bar in enumerate(hp_bars, 1):
                print(f"HP Bar #{idx}:")
                print(f"  Position:    y={bar['y']}, x=[{bar['x_start']}, {bar['x_end']})")
                print(f"  Length:      {bar['length']} pixels")
                print("-"*70)

        print("="*70)

        # Print all lines summary
        print("\nALL DETECTED LINES:")
        print("="*70)
        for idx, bar in enumerate(bars, 1):
            bar_type_label = "PROGRESS" if bar['type'] == 'progress' else "HP"
            print(f"Line {idx:2d} [{bar_type_label:8s}]: y={bar['y']:4d}, x=[{bar['x_start']:4d}, {bar['x_end']:4d}), length={bar['length']:4d}px")
        print("="*70)


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python progress_bar_detector.py <image_path>")
        print("\nExample:")
        print("  python progress_bar_detector.py screenshot.png")
        print("  python progress_bar_detector.py /path/to/image.png")
        print("  python progress_bar_detector.py C:\\Users\\path\\to\\image.png")
        print("\nTarget colors (BGR):")
        for idx, color in enumerate(TARGET_COLORS, 1):
            b, g, r = color
            rgb_hex = f"#{r:02X}{g:02X}{b:02X}"
            print(f"  Color {idx}: {color} ({rgb_hex})")
        print(f"\nColor tolerance: ±{COLOR_TOLERANCE*100:.1f}%")
        print(f"Scan margins: left={LEFT_MARGIN}px, top={TOP_MARGIN}px, bottom={BOTTOM_MARGIN}px, right={RIGHT_MARGIN}px")
        print(f"Connectivity: {MIN_MATCHES_PER_GROUP} matched pixel(s) per {CONNECTIVITY_GROUP_SIZE} pixels")
        print(f"Row skip distance: {ROW_SKIP_DISTANCE} pixels")
        print(f"Progress bar threshold: >{PROGRESS_BAR_THRESHOLD} pixels")
        sys.exit(1)

    # Normalize path for cross-platform compatibility
    image_path = Path(sys.argv[1]).expanduser().resolve()

    if not image_path.exists():
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
