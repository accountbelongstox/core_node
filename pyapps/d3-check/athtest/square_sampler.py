#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Square sampling detection algorithm
Uses 22x22 squares with 4 corner sampling points
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

def get_square_corner_points(start_x, start_y, square_size=22):
    """
    Get 4 corner points of a square
    
    Args:
        start_x, start_y: Top-left corner of the square
        square_size: Size of the square (default 22x22)
    
    Returns:
        List of 4 corner points [(x1,y1), (x2,y2), (x3,y3), (x4,y4)]
    """
    return [
        (start_x, start_y),  # Top-left
        (start_x + square_size - 1, start_y),  # Top-right
        (start_x, start_y + square_size - 1),  # Bottom-left
        (start_x + square_size - 1, start_y + square_size - 1)  # Bottom-right
    ]

def expand_detection_region(img, center_x, center_y, button_colors, tolerance=0.05, max_expansion=100):
    """
    Expand detection region from a center point until no more matching pixels
    
    Args:
        img: PIL Image object
        center_x, center_y: Center point of expansion
        button_colors: List of button colors to detect
        tolerance: Color matching tolerance
        max_expansion: Maximum expansion radius
    
    Returns:
        List of matching pixel coordinates
    """
    width, height = img.size
    matching_pixels = []
    visited = set()
    
    # Start from center point
    queue = [(center_x, center_y)]
    visited.add((center_x, center_y))
    
    # Check center point
    if 0 <= center_x < width and 0 <= center_y < height:
        pixel_color = img.getpixel((center_x, center_y))
        if is_color_in_button_colors(pixel_color, button_colors, tolerance):
            matching_pixels.append((center_x, center_y))
    
    # Expand outward
    expansion_radius = 1
    while queue and expansion_radius <= max_expansion:
        current_level = queue.copy()
        queue.clear()
        
        for x, y in current_level:
            # Check 8 neighboring pixels
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    
                    new_x, new_y = x + dx, y + dy
                    
                    # Check bounds
                    if (0 <= new_x < width and 0 <= new_y < height and 
                        (new_x, new_y) not in visited):
                        
                        visited.add((new_x, new_y))
                        
                        # Check if pixel matches button colors
                        pixel_color = img.getpixel((new_x, new_y))
                        if is_color_in_button_colors(pixel_color, button_colors, tolerance):
                            matching_pixels.append((new_x, new_y))
                            queue.append((new_x, new_y))
        
        expansion_radius += 1
        
        # Stop if no new matching pixels found in this expansion
        if not queue:
            break
    
    return matching_pixels

def square_sampling_detection(img, button_colors, tolerance=0.05, square_size=22, step_size=20):
    """
    Square sampling detection algorithm
    
    Args:
        img: PIL Image object
        button_colors: List of button colors to detect
        tolerance: Color matching tolerance
        square_size: Size of sampling squares (default 22x22)
        step_size: Step size between squares (default 20)
    
    Returns:
        Tuple of (detected_regions, all_sampled_pixels)
    """
    width, height = img.size
    detected_regions = []
    all_sampled_pixels = []
    
    print(f"Using square sampling detection with {square_size}x{square_size} squares")
    print(f"Step size: {step_size} pixels")
    
    # Sample squares across the image
    for start_y in range(0, height - square_size + 1, step_size):
        for start_x in range(0, width - square_size + 1, step_size):
            # Get 4 corner points of the square
            corner_points = get_square_corner_points(start_x, start_y, square_size)
            
            # Add corner points to sampled pixels for visualization
            all_sampled_pixels.extend(corner_points)
            
            # Check if any corner point matches button colors
            hit_detected = False
            hit_point = None
            
            for x, y in corner_points:
                if 0 <= x < width and 0 <= y < height:
                    pixel_color = img.getpixel((x, y))
                    if is_color_in_button_colors(pixel_color, button_colors, tolerance):
                        hit_detected = True
                        hit_point = (x, y)
                        break
            
            # If hit detected, expand detection region
            if hit_detected:
                print(f"Hit detected at square ({start_x}, {start_y}), expanding from {hit_point}")
                
                # Expand detection region from hit point
                matching_pixels = expand_detection_region(
                    img, hit_point[0], hit_point[1], button_colors, tolerance, max_expansion=100
                )
                
                if len(matching_pixels) >= 20:  # Minimum threshold
                    # Find bounding box
                    min_x = min(p[0] for p in matching_pixels)
                    max_x = max(p[0] for p in matching_pixels)
                    min_y = min(p[1] for p in matching_pixels)
                    max_y = max(p[1] for p in matching_pixels)
                    
                    # Add padding
                    padding = 5
                    min_x = max(0, min_x - padding)
                    min_y = max(0, min_y - padding)
                    max_x = min(width - 1, max_x + padding)
                    max_y = min(height - 1, max_y + padding)
                    
                    # Check for overlap with existing regions
                    new_bbox = (min_x, min_y, max_x, max_y)
                    overlaps = False
                    
                    for existing_region in detected_regions:
                        existing_bbox = existing_region['bbox']
                        if (new_bbox[0] < existing_bbox[2] and new_bbox[2] > existing_bbox[0] and
                            new_bbox[1] < existing_bbox[3] and new_bbox[3] > existing_bbox[1]):
                            overlaps = True
                            break
                    
                    if not overlaps:
                        region_info = {
                            'bbox': new_bbox,
                            'matching_pixels': len(matching_pixels),
                            'center': ((min_x + max_x) // 2, (min_y + max_y) // 2),
                            'hit_point': hit_point
                        }
                        detected_regions.append(region_info)
                        print(f"Detected region at {hit_point} with {len(matching_pixels)} matching pixels")
    
    return detected_regions, all_sampled_pixels

def detect_buttons_square_sampling(image_path, button_data_file, output_path, tolerance=0.05):
    """Detect buttons using square sampling algorithm"""
    
    # Load button colors
    button_colors = load_button_colors(button_data_file)
    
    # Load main image
    img = Image.open(image_path)
    width, height = img.size
    
    print(f"Main image size: {width}x{height}")
    print(f"Using {len(button_colors)} button colors for detection")
    
    # Use square sampling detection
    detected_regions, all_sampled_pixels = square_sampling_detection(
        img, button_colors, tolerance, square_size=22, step_size=20
    )
    
    print(f"Total regions detected: {len(detected_regions)}")
    print(f"Total sampled pixels: {len(all_sampled_pixels)}")
    
    # Create result image with bounding boxes and sampled points
    result_img = img.copy()
    draw = ImageDraw.Draw(result_img)
    
    # Draw sampled points in blue
    for x, y in all_sampled_pixels:
        draw.point((x, y), fill=(0, 0, 255))  # Blue color for sampled points
    
    # Draw bounding boxes
    for i, region in enumerate(detected_regions):
        bbox = region['bbox']
        
        # Draw rectangle
        draw.rectangle(bbox, outline=(255, 0, 0), width=2)
        
        # Add region number
        center = region['center']
        draw.text((center[0] - 10, center[1] - 10), str(i + 1), fill=(255, 0, 0))
        
        # Draw hit point
        hit_point = region['hit_point']
        draw.point(hit_point, fill=(0, 255, 0))  # Green for hit points
    
    # Save result image
    result_img.save(output_path)
    print(f"Result image saved to: {output_path}")
    print(f"Blue dots = sampled points, Red boxes = detected regions, Green dots = hit points")
    
    return detected_regions

def main():
    """Main function"""
    # File paths
    main_image_path = r"D:\programing\core_node\apps\d3-check\.test\test.png"
    button_data_file = r"D:\programing\core_node\.cache\file_processor\button_pixels_sample.json"
    result_output = r"D:\programing\core_node\apps\d3-check\.test\square_sampling_result.png"
    
    # Check if files exist
    if not os.path.exists(main_image_path):
        print(f"Error: Main image file not found: {main_image_path}")
        return
    
    if not os.path.exists(button_data_file):
        print(f"Error: Button data file not found: {button_data_file}")
        return
    
    print("Starting square sampling detection...")
    print("=" * 50)
    
    # Detect buttons using square sampling
    detected_regions = detect_buttons_square_sampling(
        main_image_path, button_data_file, result_output, tolerance=0.05
    )
    
    print("=" * 50)
    print(f"FINAL RESULT: {len(detected_regions)} regions detected")
    
    # Print region details
    for i, region in enumerate(detected_regions):
        bbox = region['bbox']
        print(f"Region {i + 1}: BBox({bbox[0]}, {bbox[1]}, {bbox[2]}, {bbox[3]}) - {region['matching_pixels']} pixels")
    
    print("Square sampling detection completed!")

if __name__ == "__main__":
    main()
