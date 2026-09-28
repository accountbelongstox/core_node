#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Process PNG image: Convert non-transparent pixels to white while preserving transparency.
"""

from PIL import Image
import os
import sys

def process_image_to_white(input_path, output_path=None):
    """
    Process PNG image: Convert all non-transparent pixels to white.
    
    Args:
        input_path: Path to input PNG image
        output_path: Path to output PNG image (if None, overwrites input)
    """
    if not os.path.exists(input_path):
        print(f"Error: File not found: {input_path}")
        return False
    
    try:
        # Open the image
        img = Image.open(input_path)
        
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Get image data
        pixels = img.load()
        width, height = img.size
        
        # Process each pixel
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                
                # If pixel has transparency (alpha > 0), set RGB to white
                if a > 0:
                    pixels[x, y] = (255, 255, 255, a)
        
        # Save the processed image
        if output_path is None:
            output_path = input_path
        
        img.save(output_path, 'PNG')
        print(f"Successfully processed image: {output_path}")
        return True
        
    except Exception as e:
        print(f"Error processing image: {e}")
        return False


if __name__ == '__main__':
    # Default path to the image
    image_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'assets',
        'apps',
        'app_bank',
        'images',
        'account_overview_card_bg_icon.png'
    )
    
    # If command line argument provided, use it
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    
    # Process the image
    process_image_to_white(image_path)
