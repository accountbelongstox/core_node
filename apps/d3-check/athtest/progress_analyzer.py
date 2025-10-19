#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Progress bar analyzer based on color palette analysis
"""

import json
import math
from PIL import Image
import os
import colorsys

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

def is_color_in_group(color, color_group, tolerance=0.05):
    """Check if color belongs to any color in the group"""
    for group_color in color_group:
        if is_color_similar(color, group_color, tolerance):
            return True
    return False

def load_color_groups(pixel_data_file):
    """Load and categorize colors from pixel data"""
    
    # Load pixel data
    with open(pixel_data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Extract pixel data
    hex_pixels = data['regions']['hex_pixels']
    
    # Calculate grid dimensions (same as in generate_color_palette.py)
    num_colors = len(hex_pixels)
    cols = int(math.ceil(math.sqrt(num_colors)))
    
    # Get first row colors (excluding last 2)
    first_row_colors = []
    for i in range(cols - 2):  # Exclude last 2 colors
        if i < len(hex_pixels):
            first_row_colors.append(hex_to_rgb(hex_pixels[i]['color']))
    
    # Get all other colors as foreground colors
    foreground_colors = []
    for i in range(cols, len(hex_pixels)):  # Skip first row
        foreground_colors.append(hex_to_rgb(hex_pixels[i]['color']))
    
    # Also add first row colors (excluding last 2) to foreground
    for i in range(cols - 2):
        if i < len(hex_pixels):
            foreground_colors.append(hex_to_rgb(hex_pixels[i]['color']))
    
    # Get background colors (last 2 of first row)
    background_colors = []
    for i in range(cols - 2, cols):
        if i < len(hex_pixels):
            background_colors.append(hex_to_rgb(hex_pixels[i]['color']))
    
    print(f"Background colors: {len(background_colors)}")
    print(f"Foreground colors: {len(foreground_colors)}")
    
    return background_colors, foreground_colors

def analyze_progress_bar(image_path, pixel_data_file, tolerance=0.05):
    """Analyze progress bar in the image"""
    
    # Load color groups
    background_colors, foreground_colors = load_color_groups(pixel_data_file)
    
    # Load image
    img = Image.open(image_path)
    width, height = img.getbbox()[2], img.getbbox()[3]
    
    print(f"Image size: {width}x{height}")
    
    # Get middle row
    middle_y = height // 2
    
    # First pass: find all foreground pixels
    foreground_pixels = []
    for x in range(width):
        pixel_color = img.getpixel((x, middle_y))
        
        # Check if it's a foreground color (with brightness tolerance)
        is_foreground = False
        for fg_color in foreground_colors:
            # Check brightness difference (±5%)
            brightness_diff = abs(get_color_brightness(pixel_color) - get_color_brightness(fg_color))
            if brightness_diff <= 0.05 and is_color_similar(pixel_color, fg_color, tolerance):
                is_foreground = True
                break
        
        if is_foreground:
            foreground_pixels.append(x)
    
    print(f"Total foreground pixels found: {len(foreground_pixels)}")
    
    # Second pass: find the last position with 2 consecutive foreground pixels
    last_consecutive_position = 0
    consecutive_count = 0
    
    for i, x in enumerate(foreground_pixels):
        if i == 0:
            consecutive_count = 1
        else:
            if x == foreground_pixels[i-1] + 1:  # Consecutive pixel
                consecutive_count += 1
            else:
                consecutive_count = 1
        
        # If we have at least 2 consecutive pixels, update the position
        if consecutive_count >= 2:
            last_consecutive_position = x
    
    # Calculate progress percentage based on the last consecutive position
    # The progress is the distance from left edge (0) to the last consecutive position
    progress_percentage = (last_consecutive_position / (width - 1)) * 100
    
    print(f"Last consecutive foreground position: {last_consecutive_position}")
    print(f"Total image width: {width}")
    print(f"Progress percentage: {progress_percentage:.2f}%")
    
    return progress_percentage, last_consecutive_position, width

def create_visual_analysis(image_path, pixel_data_file, output_path, tolerance=0.05):
    """Create visual analysis of the progress bar"""
    
    from PIL import ImageDraw
    
    # Load color groups
    background_colors, foreground_colors = load_color_groups(pixel_data_file)
    
    # Load image
    img = Image.open(image_path)
    width, height = img.getbbox()[2], img.getbbox()[3]
    
    # Create analysis image
    analysis_img = img.copy()
    draw = ImageDraw.Draw(analysis_img)
    
    # Get middle row
    middle_y = height // 2
    
    # First pass: find all foreground pixels and last consecutive position
    foreground_pixels = []
    for x in range(width):
        pixel_color = img.getpixel((x, middle_y))
        
        # Check if it's a foreground color
        is_foreground = False
        for fg_color in foreground_colors:
            brightness_diff = abs(get_color_brightness(pixel_color) - get_color_brightness(fg_color))
            if brightness_diff <= 0.05 and is_color_similar(pixel_color, fg_color, tolerance):
                is_foreground = True
                break
        
        if is_foreground:
            foreground_pixels.append(x)
    
    # Find last consecutive position
    last_consecutive_position = 0
    consecutive_count = 0
    
    for i, x in enumerate(foreground_pixels):
        if i == 0:
            consecutive_count = 1
        else:
            if x == foreground_pixels[i-1] + 1:
                consecutive_count += 1
            else:
                consecutive_count = 1
        
        if consecutive_count >= 2:
            last_consecutive_position = x
    
    # Draw analysis line with different colors
    for x in range(width):
        pixel_color = img.getpixel((x, middle_y))
        
        # Check if it's a foreground color
        is_foreground = False
        for fg_color in foreground_colors:
            brightness_diff = abs(get_color_brightness(pixel_color) - get_color_brightness(fg_color))
            if brightness_diff <= 0.05 and is_color_similar(pixel_color, fg_color, tolerance):
                is_foreground = True
                break
        
        # Draw analysis indicator
        if is_foreground:
            if x <= last_consecutive_position:
                # Bright green for progress area
                draw.point((x, middle_y), fill=(0, 255, 0))
            else:
                # Yellow for foreground pixels beyond progress
                draw.point((x, middle_y), fill=(255, 255, 0))
        else:
            # Red for non-progress
            draw.point((x, middle_y), fill=(255, 0, 0))
    
    # Draw progress line marker
    if last_consecutive_position > 0:
        for y in range(max(0, middle_y-2), min(height, middle_y+3)):
            draw.point((last_consecutive_position, y), fill=(0, 0, 255))  # Blue line
    
    # Save analysis image
    analysis_img.save(output_path)
    print(f"Visual analysis saved to: {output_path}")
    print(f"Legend: Green=Progress, Yellow=Foreground beyond progress, Red=Background, Blue=Progress end marker")

def main():
    """Main function"""
    # File paths
    image_path = r"D:\programing\core_node\apps\d3-check\.test\pro.png"
    pixel_data_file = r"D:\programing\core_node\.cache\file_processor\left_pixels_sample.json"
    analysis_output = r"D:\programing\core_node\apps\d3-check\.test\progress_analysis.png"
    
    # Check if files exist
    if not os.path.exists(image_path):
        print(f"Error: Image file not found: {image_path}")
        return
    
    if not os.path.exists(pixel_data_file):
        print(f"Error: Pixel data file not found: {pixel_data_file}")
        return
    
    print("Starting progress bar analysis...")
    print("=" * 50)
    
    # Analyze progress bar
    progress_percentage, progress_length, total_analyzed = analyze_progress_bar(
        image_path, pixel_data_file, tolerance=0.05
    )
    
    print("=" * 50)
    print(f"FINAL RESULT: {progress_percentage:.2f}% progress")
    
    # Create visual analysis
    create_visual_analysis(image_path, pixel_data_file, analysis_output, tolerance=0.05)
    
    print("Analysis completed!")

if __name__ == "__main__":
    main()
