#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Button detector based on pixel sampling analysis
"""

import json
import math
import os
import colorsys

from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageDraw

Image = get_third_package_PIL_Image()
ImageDraw = get_third_package_PIL_ImageDraw()

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hsv(rgb):
    """Convert RGB to HSV"""
    r, g, b = [x/255.0 for x in rgb]
    return colorsys.rgb_to_hsv(r, g, b)

def get_color_brightness(rgb):
    """Get brightness of RGB color (0-1)"""
    r, g, b = rgb
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0

def is_color_similar(color1, color2, tolerance=0.05):
    """Check if two colors are similar within tolerance"""
    hsv1 = rgb_to_hsv(color1)
    hsv2 = rgb_to_hsv(color2)
    
    # Check hue similarity (with wraparound)
    hue_diff = abs(hsv1[0] - hsv2[0])
    hue_diff = min(hue_diff, 1.0 - hue_diff)
    
    # Check saturation and value similarity
    sat_diff = abs(hsv1[1] - hsv2[1])
    val_diff = abs(hsv1[2] - hsv2[2])
    
    return hue_diff <= tolerance and sat_diff <= tolerance and val_diff <= tolerance

def is_color_in_button_colors(pixel_color, button_colors, tolerance=0.05):
    """Check if pixel color matches any button color with brightness tolerance"""
    for button_color in button_colors:
        # Check brightness difference (±5%)
        brightness_diff = abs(get_color_brightness(pixel_color) - get_color_brightness(button_color))
        if brightness_diff <= 0.05 and is_color_similar(pixel_color, button_color, tolerance):
            return True
    return False

def load_button_colors(pixel_data_file):
    """Load button colors from pixel sampling data"""
    
    # Load pixel data
    with open(pixel_data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Extract pixel data
    hex_pixels = data['regions']['hex_pixels']
    
    # Convert to RGB colors and get unique colors only
    button_colors = []
    seen_colors = set()
    
    for pixel in hex_pixels:
        rgb_color = hex_to_rgb(pixel['color'])
        if rgb_color not in seen_colors:
            button_colors.append(rgb_color)
            seen_colors.add(rgb_color)
    
    # Limit to most common colors (first 50 for speed)
    limited_colors = button_colors[:50]
    
    print(f"Loaded {len(limited_colors)} unique button colors (from {len(button_colors)} total)")
    return limited_colors

def load_skip_colors(skip_data_file):
    """Load skip colors from pixel sampling data"""
    
    # Load pixel data
    with open(skip_data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Extract pixel data
    hex_pixels = data['regions']['hex_pixels']
    
    # Convert to RGB colors and get unique colors only
    skip_colors = []
    seen_colors = set()
    
    for pixel in hex_pixels:
        rgb_color = hex_to_rgb(pixel['color'])
        if rgb_color not in seen_colors:
            skip_colors.append(rgb_color)
            seen_colors.add(rgb_color)
    
    print(f"Loaded {len(skip_colors)} skip colors")
    return skip_colors

def is_color_in_skip_colors(pixel_color, skip_colors, tolerance=0.05):
    """Check if pixel color matches any skip color with brightness tolerance"""
    for skip_color in skip_colors:
        # Check brightness difference (±5% - standard tolerance)
        brightness_diff = abs(get_color_brightness(pixel_color) - get_color_brightness(skip_color))
        if brightness_diff <= 0.05 and is_color_similar(pixel_color, skip_color, tolerance):
            return True
    return False

def debug_pixel_color(pixel_color, skip_colors, button_colors, tolerance=0.05):
    """Debug function to check why pixels are being skipped"""
    is_skip = is_color_in_skip_colors(pixel_color, skip_colors, tolerance)
    is_button = is_color_in_button_colors(pixel_color, button_colors, tolerance)
    
    if is_skip:
        print(f"DEBUG: Pixel {pixel_color} is being skipped")
        for skip_color in skip_colors:
            brightness_diff = abs(get_color_brightness(pixel_color) - get_color_brightness(skip_color))
            if brightness_diff <= 0.05:
                print(f"  - Matches skip color {skip_color} (brightness diff: {brightness_diff:.3f})")
    
    return is_skip, is_button

def detect_buttons_in_region(img, start_x, start_y, button_colors, tolerance=0.05):
    """Detect buttons in a specific region"""
    
    width, height = img.size
    
    # Define search region (100x50 pixels to the right and down)
    search_width = min(100, width - start_x)
    search_height = min(50, height - start_y)
    
    if search_width <= 0 or search_height <= 0:
        return None
    
    # Find matching pixels in the region
    matching_pixels = []
    
    for y in range(start_y, start_y + search_height):
        for x in range(start_x, start_x + search_width):
            pixel_color = img.getpixel((x, y))
            
            if is_color_in_button_colors(pixel_color, button_colors, tolerance):
                matching_pixels.append((x, y))
    
    # Check if we have enough matching pixels (at least 50)
    if len(matching_pixels) < 50:
        return None
    
    # Find bounding box using the two farthest points
    if len(matching_pixels) < 2:
        return None
    
    # Calculate all pairwise distances to find the two farthest points
    max_distance = 0
    farthest_pair = None
    
    for i in range(len(matching_pixels)):
        for j in range(i + 1, len(matching_pixels)):
            x1, y1 = matching_pixels[i]
            x2, y2 = matching_pixels[j]
            distance = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
            
            if distance > max_distance:
                max_distance = distance
                farthest_pair = (matching_pixels[i], matching_pixels[j])
    
    if farthest_pair is None:
        return None
    
    # Create bounding box from the two farthest points
    (x1, y1), (x2, y2) = farthest_pair
    
    # Ensure proper bounding box coordinates
    min_x = min(x1, x2)
    max_x = max(x1, x2)
    min_y = min(y1, y2)
    max_y = max(y1, y2)
    
    # Add some padding
    padding = 2
    min_x = max(0, min_x - padding)
    min_y = max(0, min_y - padding)
    max_x = min(width - 1, max_x + padding)
    max_y = min(height - 1, max_y + padding)
    
    return {
        'bbox': (min_x, min_y, max_x, max_y),
        'matching_pixels': len(matching_pixels),
        'center': ((min_x + max_x) // 2, (min_y + max_y) // 2)
    }

def triangle_sparse_detection(img, button_colors, skip_colors, tolerance=0.05, use_skip=True, triangle_height=10):
    """
    Triangle sparse detection method for fast button detection
    
    Args:
        img: PIL Image object
        button_colors: List of button colors to detect
        skip_colors: List of colors to skip
        tolerance: Color matching tolerance
        use_skip: Whether to use skip optimization
        triangle_height: Height of the triangle (number of rows)
    
    Returns:
        Tuple of (detected_buttons, all_triangle_pixels)
    """
    width, height = img.size
    detected_buttons = []
    processed_regions = set()
    all_triangle_pixels = []  # Store all triangle pixels for visualization
    
    print(f"Using triangle sparse detection with height {triangle_height}")
    
    # Calculate triangle step size
    triangle_step = triangle_height
    start_y = 0
    max_iterations = height // triangle_height + 10  # Safety limit
    iteration_count = 0
    
    while start_y < height and iteration_count < max_iterations:
        iteration_count += 1
        # Check if we have enough rows for a complete triangle
        if start_y + triangle_height > height:
            # Not enough rows for a complete triangle, break the loop
            print(f"Not enough rows for triangle at row {start_y}, stopping")
            break
        
        print(f"Processing triangle starting at row {start_y}/{height}")
        
        # Define triangle points
        # Point 1: First row, first column
        # Point 2: Last row, middle column  
        # Point 3: First row, last column
        triangle_points = [
            (0, start_y),  # Top-left
            (width // 2, start_y + triangle_height - 1),  # Bottom-center
            (width - 1, start_y)  # Top-right
        ]
        
        # Check pixels along triangle edges
        triangle_pixels = []
        
        # Edge 1: Top-left to bottom-center
        for i in range(triangle_height):
            x = int((triangle_points[1][0] - triangle_points[0][0]) * i / (triangle_height - 1) + triangle_points[0][0])
            y = start_y + i
            if 0 <= x < width and 0 <= y < height:
                triangle_pixels.append((x, y))
        
        # Edge 2: Bottom-center to top-right
        for i in range(triangle_height):
            x = int((triangle_points[2][0] - triangle_points[1][0]) * i / (triangle_height - 1) + triangle_points[1][0])
            y = start_y + triangle_height - 1 - i
            if 0 <= x < width and 0 <= y < height:
                triangle_pixels.append((x, y))
        
        # Edge 3: Top-right to top-left (sample every 10th pixel for speed)
        for i in range(0, width, 10):
            x = i
            y = start_y
            if 0 <= x < width and 0 <= y < height:
                triangle_pixels.append((x, y))
        
        # Remove duplicate pixels
        triangle_pixels = list(set(triangle_pixels))
        
        # Add to all triangle pixels for visualization
        all_triangle_pixels.extend(triangle_pixels)
        
        # Check each triangle pixel (sample every 5th pixel for speed)
        skip_detected = False
        for i, (x, y) in enumerate(triangle_pixels):
            # Sample every 5th pixel for skip detection to speed up
            if i % 5 == 0:
                pixel_color = img.getpixel((x, y))
                
                # Check if should skip
                if use_skip and is_color_in_skip_colors(pixel_color, skip_colors, tolerance):
                    skip_detected = True
                    break  # If skip detected, no need to check more pixels in this triangle
        
        # Only check for buttons if no skip detected
        if not skip_detected:
            for x, y in triangle_pixels:
                pixel_color = img.getpixel((x, y))
                
                # Check if matches button colors
                if is_color_in_button_colors(pixel_color, button_colors, tolerance):
                    # Found potential button, expand detection area
                    button_region = expand_detection_area(img, x, y, button_colors, tolerance, start_y, triangle_height)
                    
                    if button_region is not None:
                        # Check for overlap with existing buttons
                        new_bbox = button_region['bbox']
                        overlaps = False
                        
                        for existing_button in detected_buttons:
                            existing_bbox = existing_button['bbox']
                            if (new_bbox[0] < existing_bbox[2] and new_bbox[2] > existing_bbox[0] and
                                new_bbox[1] < existing_bbox[3] and new_bbox[3] > existing_bbox[1]):
                                overlaps = True
                                break
                        
                        if not overlaps:
                            detected_buttons.append(button_region)
                            print(f"Detected button at ({x}, {y}) with {button_region['matching_pixels']} matching pixels")
        
        # If skip color detected in this triangle, jump down 10 pixels for next triangle
        if skip_detected and use_skip:
            print(f"Skip color detected in triangle at row {start_y}, jumping down 10 pixels")
            # Adjust the next triangle start position
            start_y += triangle_height + 10  # Add 10 pixels jump
        else:
            start_y += triangle_height
    
    return detected_buttons, all_triangle_pixels

def expand_detection_area(img, start_x, start_y, button_colors, tolerance, triangle_start_y, triangle_height):
    """
    Expand detection area from a starting point
    
    Args:
        img: PIL Image object
        start_x, start_y: Starting coordinates
        button_colors: List of button colors
        tolerance: Color matching tolerance
        triangle_start_y: Starting row of the triangle
        triangle_height: Height of the triangle
    
    Returns:
        Button region info or None
    """
    width, height = img.size
    
    # Define search area: 5 rows (2 up, 2 down from triangle area)
    search_start_y = max(0, triangle_start_y - 2)
    search_end_y = min(height, triangle_start_y + triangle_height + 2)
    
    # Start from the detected point and scan right
    matching_pixels = []
    
    for y in range(search_start_y, search_end_y):
        for x in range(start_x, width):
            pixel_color = img.getpixel((x, y))
            
            if is_color_in_button_colors(pixel_color, button_colors, tolerance):
                matching_pixels.append((x, y))
            else:
                # If we hit a non-matching pixel, continue scanning
                # but if we've found some pixels, don't stop immediately
                if len(matching_pixels) > 0:
                    # Check if we should continue or stop
                    # Stop if we've gone too far without finding more matches
                    break
    
    # Check if we have enough matching pixels
    if len(matching_pixels) < 20:
        return None
    
    # Find bounding box
    if not matching_pixels:
        return None
    
    min_x = min(p[0] for p in matching_pixels)
    max_x = max(p[0] for p in matching_pixels)
    min_y = min(p[1] for p in matching_pixels)
    max_y = max(p[1] for p in matching_pixels)
    
    # Add padding
    padding = 2
    min_x = max(0, min_x - padding)
    min_y = max(0, min_y - padding)
    max_x = min(width - 1, max_x + padding)
    max_y = min(height - 1, max_y + padding)
    
    return {
        'bbox': (min_x, min_y, max_x, max_y),
        'matching_pixels': len(matching_pixels),
        'center': ((min_x + max_x) // 2, (min_y + max_y) // 2)
    }

def detect_buttons_in_image(image_path, button_data_file, skip_data_file, output_path, tolerance=0.05, use_skip=True):
    """Detect buttons in the main image using triangle sparse detection"""
    
    # Load button colors and skip colors
    button_colors = load_button_colors(button_data_file)
    skip_colors = load_skip_colors(skip_data_file) if use_skip else []
    
    # Load main image
    img = Image.open(image_path)
    width, height = img.size
    
    print(f"Main image size: {width}x{height}")
    print(f"Using {len(button_colors)} button colors for detection")
    if use_skip:
        print(f"Using {len(skip_colors)} skip colors to speed up detection")
    else:
        print("Skip optimization disabled")
    
    # Use triangle sparse detection
    detected_buttons, all_triangle_pixels = triangle_sparse_detection(
        img, button_colors, skip_colors, tolerance, use_skip, triangle_height=10
    )
    
    print(f"Total buttons detected: {len(detected_buttons)}")
    print(f"Total triangle pixels scanned: {len(all_triangle_pixels)}")
    
    # Create result image with bounding boxes and triangle scan lines
    result_img = img.copy()
    draw = ImageDraw.Draw(result_img)
    
    # Draw triangle scan lines in gray
    for x, y in all_triangle_pixels:
        draw.point((x, y), fill=(128, 128, 128))  # Gray color for scan lines
    
    # Draw bounding boxes
    for i, button in enumerate(detected_buttons):
        bbox = button['bbox']
        
        # Draw rectangle
        draw.rectangle(bbox, outline=(255, 0, 0), width=2)
        
        # Add button number
        center = button['center']
        draw.text((center[0] - 10, center[1] - 10), str(i + 1), fill=(255, 0, 0))
    
    # Save result image
    result_img.save(output_path)
    print(f"Result image saved to: {output_path}")
    print(f"Gray lines show triangle scan paths")
    
    return detected_buttons

def main():
    """Main function"""
    # File paths
    main_image_path = r"D:\programing\core_node\apps\d3-check\.test\test.png"
    button_data_file = r"D:\programing\core_node\.cache\file_processor\button_pixels_sample.json"
    skip_data_file = r"D:\programing\core_node\.cache\file_processor\skip_pixels_sample.json"
    result_output = r"D:\programing\core_node\apps\d3-check\.test\result.png"
    
    # Check if files exist
    if not os.path.exists(main_image_path):
        print(f"Error: Main image file not found: {main_image_path}")
        return
    
    if not os.path.exists(button_data_file):
        print(f"Error: Button data file not found: {button_data_file}")
        return
    
    if not os.path.exists(skip_data_file):
        print(f"Error: Skip data file not found: {skip_data_file}")
        return
    
    print("Starting button detection with skip optimization...")
    print("=" * 50)
    
    # Detect buttons (first try without skip optimization)
    print("Testing without skip optimization...")
    detected_buttons = detect_buttons_in_image(
        main_image_path, button_data_file, skip_data_file, result_output, tolerance=0.05, use_skip=False
    )
    
    if len(detected_buttons) == 0:
        print("\nNo buttons detected without skip. Trying with skip optimization...")
        detected_buttons = detect_buttons_in_image(
            main_image_path, button_data_file, skip_data_file, result_output, tolerance=0.05, use_skip=True
        )
    
    print("=" * 50)
    print(f"FINAL RESULT: {len(detected_buttons)} buttons detected")
    
    # Print button details
    for i, button in enumerate(detected_buttons):
        bbox = button['bbox']
        print(f"Button {i + 1}: BBox({bbox[0]}, {bbox[1]}, {bbox[2]}, {bbox[3]}) - {button['matching_pixels']} pixels")
    
    print("Button detection completed!")

if __name__ == "__main__":
    main()
