#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resize two card background icons to the same size, using the smaller one as base.
"""

from PIL import Image
import os

def resize_images_to_same_size():
    """Resize both images to the same size, using the smaller image as base."""
    base_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'assets',
        'apps',
        'app_bank',
        'images'
    )
    
    img1_path = os.path.join(base_path, 'account_overview_card_bg_icon.png')
    img2_path = os.path.join(base_path, 'account_overview_card_bg_icon_second.png')
    
    # Open both images
    img1 = Image.open(img1_path)
    img2 = Image.open(img2_path)
    
    # Get dimensions
    size1 = img1.size
    size2 = img2.size
    
    print(f"Image 1 size: {size1[0]}x{size1[1]}")
    print(f"Image 2 size: {size2[0]}x{size2[1]}")
    
    # Calculate area to find smaller image
    area1 = size1[0] * size1[1]
    area2 = size2[0] * size2[1]
    
    # Use the smaller image's dimensions as base
    if area1 < area2:
        target_size = size1
        print(f"Using image 1 as base: {target_size[0]}x{target_size[1]}")
        # Resize image 2
        img2_resized = img2.resize(target_size, Image.Resampling.LANCZOS)
        img2_resized.save(img2_path, 'PNG')
        print(f"Resized image 2 to {target_size[0]}x{target_size[1]}")
    else:
        target_size = size2
        print(f"Using image 2 as base: {target_size[0]}x{target_size[1]}")
        # Resize image 1
        img1_resized = img1.resize(target_size, Image.Resampling.LANCZOS)
        img1_resized.save(img1_path, 'PNG')
        print(f"Resized image 1 to {target_size[0]}x{target_size[1]}")
    
    print("Done!")

if __name__ == '__main__':
    resize_images_to_same_size()
