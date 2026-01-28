#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Universal icon extraction tool
Supports automatic icon position detection and extraction, path compatible with Windows and Linux
"""

import cv2
import numpy as np
from pathlib import Path
import argparse
import sys
import os
from datetime import datetime
from collections import Counter

def calculate_brightness(bgr_color):
    """Calculate brightness of BGR color"""
    return 0.299 * bgr_color[2] + 0.587 * bgr_color[1] + 0.114 * bgr_color[0]

def find_background_color(img):
    """Find background color (using most common color)"""
    h, w = img.shape[:2]
    # Sample edge pixels to determine background color
    edge_pixels = []
    # Top edge
    edge_pixels.extend([tuple(img[0, x]) for x in range(w)])
    # Bottom edge
    edge_pixels.extend([tuple(img[h-1, x]) for x in range(w)])
    # Left edge
    edge_pixels.extend([tuple(img[y, 0]) for y in range(h)])
    # Right edge
    edge_pixels.extend([tuple(img[y, w-1]) for y in range(h)])
    
    # Find most common color as background
    pixel_counts = Counter(edge_pixels)
    background_pixel = pixel_counts.most_common(1)[0][0]
    background_brightness = calculate_brightness(background_pixel)
    
    return background_pixel, background_brightness

def is_blank_row(img, row_idx, base_brightness, threshold_percent=2):
    """Check if a row is blank"""
    row = img[row_idx, :]
    brightness_threshold = base_brightness * (threshold_percent / 100.0)
    
    # Check percentage of non-blank pixels in this row
    non_blank_count = 0
    for pixel in row:
        pixel_brightness = calculate_brightness(pixel)
        diff = abs(pixel_brightness - base_brightness)
        if diff > brightness_threshold:
            non_blank_count += 1
    
    # If non-blank pixels less than 5%, consider it blank row
    return non_blank_count < len(row) * 0.05

def is_blank_col(img, col_idx, base_brightness, threshold_percent=2):
    """Check if a column is blank"""
    col = img[:, col_idx]
    brightness_threshold = base_brightness * (threshold_percent / 100.0)
    
    # Check percentage of non-blank pixels in this column
    non_blank_count = 0
    for pixel in col:
        pixel_brightness = calculate_brightness(pixel)
        diff = abs(pixel_brightness - base_brightness)
        if diff > brightness_threshold:
            non_blank_count += 1
    
    # If non-blank pixels less than 5%, consider it blank column
    return non_blank_count < len(col) * 0.05

def find_vertical_ranges(img, base_brightness, threshold_percent=2):
    """Scan from top to bottom, find vertical ranges (row ranges)"""
    h, w = img.shape[:2]
    ranges = []
    in_range = False
    start_row = None
    
    for y in range(h):
        is_blank = is_blank_row(img, y, base_brightness, threshold_percent)
        
        if not is_blank and not in_range:
            start_row = y
            in_range = True
        elif is_blank and in_range:
            ranges.append((start_row, y - 1))
            in_range = False
    
    if in_range:
        ranges.append((start_row, h - 1))
    
    return ranges

def find_horizontal_ranges(img, base_brightness, threshold_percent=2):
    """Scan from left to right, find horizontal ranges (column ranges)"""
    h, w = img.shape[:2]
    ranges = []
    in_range = False
    start_col = None
    
    for x in range(w):
        is_blank = is_blank_col(img, x, base_brightness, threshold_percent)
        
        if not is_blank and not in_range:
            start_col = x
            in_range = True
        elif is_blank and in_range:
            ranges.append((start_col, x - 1))
            in_range = False
    
    if in_range:
        ranges.append((start_col, w - 1))
    
    return ranges

def get_desktop_path():
    """Get desktop path (cross-platform)"""
    if sys.platform == "win32":
        return Path.home() / "Desktop"
    else:
        # Linux/Mac
        return Path.home() / "Desktop"

def create_temp_output_dir(base_dir=None):
    """Create temporary output directory"""
    if base_dir:
        base_path = Path(base_dir)
    else:
        # Use temporary directory on desktop
        desktop = get_desktop_path()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_path = desktop / f"extracted_icons_{timestamp}"
    
    base_path.mkdir(parents=True, exist_ok=True)
    return base_path

def open_directory(path):
    """Open directory based on operating system"""
    path_str = str(path.resolve())
    if sys.platform == "win32":
        os.startfile(path_str)
    elif sys.platform == "darwin":
        os.system(f"open '{path_str}'")
    else:
        # Linux
        os.system(f"xdg-open '{path_str}'")

def extract_icons_auto_detect(
    input_image_path,
    output_dir=None,
    icon_names=None,
    threshold_percent=2,
    open_dir=True
):
    """Automatically detect icon positions and extract"""
    # Process path (compatible with Windows and Linux)
    input_path = Path(input_image_path).resolve()
    if not input_path.exists():
        print(f"Error: File not found {input_path}")
        return None
    
    # Read image
    img = cv2.imread(str(input_path))
    if img is None:
        print(f"Error: Cannot read image {input_path}")
        return None
    
    print(f"Reading image: {input_path}")
    print(f"Image size: {img.shape}")
    
    # Find background color
    base_pixel, base_brightness = find_background_color(img)
    print(f"Background color: BGR={base_pixel}, Brightness={base_brightness:.2f}")
    print(f"Threshold: ±{threshold_percent}% = ±{base_brightness * (threshold_percent / 100.0):.2f}")
    
    # Find vertical ranges (row ranges)
    vertical_ranges = find_vertical_ranges(img, base_brightness, threshold_percent)
    print(f"\nVertical ranges (rows): {vertical_ranges}")
    
    # Find horizontal ranges (column ranges)
    horizontal_ranges = find_horizontal_ranges(img, base_brightness, threshold_percent)
    print(f"Horizontal ranges (columns): {horizontal_ranges}")
    
    # Calculate all intersection regions
    icon_regions = []
    for v_start, v_end in vertical_ranges:
        for h_start, h_end in horizontal_ranges:
            width = h_end - h_start + 1
            height = v_end - v_start + 1
            # Filter out regions that are too small (likely separators or text lines)
            # Minimum size: 30x30 pixels for valid icons
            if width >= 30 and height >= 30:
                icon_regions.append({
                    'x': h_start,
                    'y': v_start,
                    'w': width,
                    'h': height
                })
    
    print(f"\nDetected {len(icon_regions)} icon regions (filtered, min size 30x30):")
    for i, region in enumerate(icon_regions):
        print(f"  Icon {i+1}: x={region['x']}, y={region['y']}, w={region['w']}, h={region['h']}")
    
    # Find maximum width and height
    max_w = max(region['w'] for region in icon_regions)
    max_h = max(region['h'] for region in icon_regions)
    print(f"\nMaximum size: w={max_w}, h={max_h}")
    
    # Unify all icon sizes (expand from center point)
    h_img, w_img = img.shape[:2]
    for region in icon_regions:
        # Calculate current icon center point
        center_x = region['x'] + region['w'] // 2
        center_y = region['y'] + region['h'] // 2
        
        # Calculate new position after expansion (expand from center)
        new_w = max_w
        new_h = max_h
        new_x = center_x - new_w // 2
        new_y = center_y - new_h // 2
        
        # Ensure not exceeding image boundaries
        new_x = max(0, min(new_x, w_img - new_w))
        new_y = max(0, min(new_y, h_img - new_h))
        
        # If exceeds boundary, adjust to within boundary
        if new_x + new_w > w_img:
            new_x = w_img - new_w
        if new_y + new_h > h_img:
            new_y = h_img - new_h
        
        # Update region
        region['x'] = new_x
        region['y'] = new_y
        region['w'] = new_w
        region['h'] = new_h
    
    print(f"\nUnified icon regions (all icons size: {max_w}x{max_h}):")
    for i, region in enumerate(icon_regions):
        print(f"  Icon {i+1}: x={region['x']}, y={region['y']}, w={region['w']}, h={region['h']}")
    
    # Create output directory
    if output_dir:
        output_path = Path(output_dir).resolve()
    else:
        output_path = create_temp_output_dir()
    
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Prepare filename list
    if icon_names and len(icon_names) >= len(icon_regions):
        names = icon_names[:len(icon_regions)]
    else:
        # Use default numbering
        names = [f"icon_{i+1:03d}" for i in range(len(icon_regions))]
        if icon_names:
            # Partially use provided names
            for i, name in enumerate(icon_names):
                if i < len(names):
                    names[i] = name
    
    # Extract each icon
    for i, (region, name) in enumerate(zip(icon_regions, names)):
        x = region['x']
        y = region['y']
        w = region['w']
        h = region['h']
        
        # Extract icon region
        icon_img = img[y:y+h, x:x+w]
        
        # Save (ensure filename has .png extension)
        if not name.endswith('.png'):
            name = f"{name}.png"
        output_file = output_path / name
        cv2.imwrite(str(output_file), icon_img)
        print(f"Extracted icon {i+1}/{len(icon_regions)}: {name} (size: {w}x{h})")
    
    print(f"\nAll icons saved to: {output_path}")
    
    # Open output directory
    if open_dir:
        print(f"Opening directory: {output_path}")
        open_directory(output_path)
    
    return output_path

def main():
    parser = argparse.ArgumentParser(description='Automatically detect and extract icons')
    parser.add_argument('input_image', type=str, help='Input image path')
    parser.add_argument('-o', '--output', type=str, default=None, help='Output directory (if not specified, create temp directory on desktop with timestamp)')
    parser.add_argument('-n', '--names', type=str, nargs='+', default=None, help='Icon filename list (match in order, use default numbering if insufficient)')
    parser.add_argument('-t', '--threshold', type=float, default=2.0, help='Brightness threshold percentage (default 2%%)')
    parser.add_argument('--no-open', action='store_true', help='Do not open directory after extraction')
    
    args = parser.parse_args()
    
    extract_icons_auto_detect(
        args.input_image,
        args.output,
        args.names,
        args.threshold,
        not args.no_open
    )

if __name__ == '__main__':
    main()

