#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Replace Android app icons and splash screens
Scans android directory and replaces icons/splash with logo.png and splash.png
"""

import os
import sys
import re
from pathlib import Path
from PIL import Image

def find_icon_files(directory):
    """Find all icon files in android directory"""
    found_files = []
    directory_path = Path(directory)
    
    if not directory_path.exists():
        print(f"[ERROR] Directory not found: {directory}")
        return found_files
    
    image_extensions = {'.png', '.jpg', '.jpeg', '.webp'}
    
    # Patterns to match icon files - ALL possible icon filenames
    icon_patterns = [
        r'icon',
        r'ic_launcher',
        r'ic_launcher_foreground',
        r'ic_launcher_background',
        r'ic_launcher_round',
        r'ic_launcher_adaptive_foreground',
        r'ic_launcher_adaptive_background',
        r'appicon',
        r'app_icon',
        r'app-icon',
        r'launcher_icon',
        r'launcher-icon',
        r'AppIcon',
        r'AppIcon-.*\.png',
        r'app-icon-.*\.png',
        r'launcher-.*\.png',
    ]
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path = Path(root) / file
            file_ext = file_path.suffix.lower()
            
            # Only process image files
            if file_ext not in image_extensions:
                continue
            
            file_lower = file.lower()
            file_name = file_path.name
            
            # Check if matches any icon pattern
            for pattern in icon_patterns:
                if re.search(pattern, file_lower, re.IGNORECASE):
                    found_files.append(file_path)
                    break
    
    return found_files

def find_splash_files(directory):
    """Find all splash screen files in android directory"""
    found_files = []
    directory_path = Path(directory)
    
    if not directory_path.exists():
        print(f"[ERROR] Directory not found: {directory}")
        return found_files
    
    image_extensions = {'.png', '.jpg', '.jpeg', '.webp'}
    
    # Patterns to match splash files - ALL possible splash filenames
    splash_patterns = [
        r'splash',
        r'launch_screen',
        r'launchscreen',
        r'launch-screen',
        r'launchscreen-.*\.png',
        r'launch-screen-.*\.png',
        r'startup',
        r'startup-.*\.png',
        r'splash-.*\.png',
        r'splash_screen',
        r'splashscreen',
        r'splash-screen',
    ]
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path = Path(root) / file
            file_ext = file_path.suffix.lower()
            
            # Only process image files
            if file_ext not in image_extensions:
                continue
            
            file_lower = file.lower()
            
            # Check if matches any splash pattern
            for pattern in splash_patterns:
                if re.search(pattern, file_lower, re.IGNORECASE):
                    found_files.append(file_path)
                    break
    
    return found_files

def resize_and_replace(source_path, target_path):
    """Resize source image to match target image dimensions (proportional scaling, centered)"""
    try:
        # Open source image
        source_img = Image.open(source_path)
        
        # Convert to RGBA for transparency support
        if source_img.mode != 'RGBA':
            source_img = source_img.convert('RGBA')
        
        # Get target image info
        target_img = Image.open(target_path)
        target_width, target_height = target_img.size
        target_format = target_img.format or 'PNG'
        target_img.close()
        
        # Calculate scaling to fit within target size (maintain aspect ratio)
        source_width, source_height = source_img.size
        scale_w = target_width / source_width
        scale_h = target_height / source_height
        scale = min(scale_w, scale_h)  # Use smaller scale to fit within bounds
        
        # Calculate new dimensions
        new_width = int(source_width * scale)
        new_height = int(source_height * scale)
        
        # Resize source image maintaining aspect ratio
        resized_img = source_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Create new image with target size and transparent background
        new_img = Image.new('RGBA', (target_width, target_height), (0, 0, 0, 0))
        
        # Center the resized image
        paste_x = (target_width - new_width) // 2
        paste_y = (target_height - new_height) // 2
        new_img.paste(resized_img, (paste_x, paste_y), resized_img)
        
        # Convert format if target is JPEG
        if target_format == 'JPEG' or target_format == 'JPG':
            # Convert RGBA to RGB for JPEG
            if new_img.mode == 'RGBA':
                rgb_img = Image.new('RGB', new_img.size, (255, 255, 255))
                rgb_img.paste(new_img, mask=new_img.split()[3])
                new_img = rgb_img
        
        # Save with appropriate format
        if target_format == 'PNG':
            new_img.save(target_path, 'PNG', optimize=True)
        elif target_format == 'JPEG' or target_format == 'JPG':
            new_img.save(target_path, 'JPEG', quality=95, optimize=True)
        else:
            new_img.save(target_path, target_format)
        
        return True
    except Exception as e:
        print(f"[ERROR] Failed to replace {target_path}: {e}")
        import traceback
        traceback.print_exc()
        return False

def replace_icons(android_dir, logo_path):
    """Replace all icon files with logo.png"""
    if not os.path.exists(logo_path):
        print(f"[WARNING] Logo file not found: {logo_path}")
        return 0
    
    # Find all icon files
    icon_files = find_icon_files(android_dir)
    
    if not icon_files:
        print("[INFO] No icon files found")
        return 0
    
    print(f"[INFO] Found {len(icon_files)} icon files")
    
    replaced_count = 0
    for icon_file in icon_files:
        print(f"[INFO] Replacing icon: {icon_file}")
        if resize_and_replace(logo_path, icon_file):
            replaced_count += 1
            print(f"[SUCCESS] Replaced: {icon_file}")
        else:
            print(f"[ERROR] Failed to replace: {icon_file}")
    
    return replaced_count

def replace_splash(android_dir, splash_path):
    """Replace all splash screen files with splash.png"""
    if not os.path.exists(splash_path):
        print(f"[WARNING] Splash file not found: {splash_path}")
        return 0
    
    # Find all splash files
    splash_files = find_splash_files(android_dir)
    
    if not splash_files:
        print("[INFO] No splash files found")
        return 0
    
    print(f"[INFO] Found {len(splash_files)} splash files")
    
    replaced_count = 0
    for splash_file in splash_files:
        print(f"[INFO] Replacing splash: {splash_file}")
        if resize_and_replace(splash_path, splash_file):
            replaced_count += 1
            print(f"[SUCCESS] Replaced: {splash_file}")
        else:
            print(f"[ERROR] Failed to replace: {splash_file}")
    
    return replaced_count

def find_directory_recursive(start_dir, dir_name):
    """Recursively find directory by name"""
    start_path = Path(start_dir)
    if not start_path.exists():
        return None
    
    # First check direct child
    direct_path = start_path / dir_name
    if direct_path.exists() and direct_path.is_dir():
        return direct_path
    
    # Recursively search
    for root, dirs, files in os.walk(start_path):
        for d in dirs:
            if d.lower() == dir_name.lower():
                return Path(root) / d
    
    return None

def find_file_recursive(start_dir, filename):
    """Recursively find file by name"""
    start_path = Path(start_dir)
    if not start_path.exists():
        return None
    
    # First check direct child
    direct_path = start_path / filename
    if direct_path.exists() and direct_path.is_file():
        return direct_path
    
    # Recursively search
    for root, dirs, files in os.walk(start_path):
        for f in files:
            if f.lower() == filename.lower():
                return Path(root) / f
    
    return None

def main():
    # Get script directory and project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # Recursively find android directory (not hardcoded)
    android_dir = find_directory_recursive(project_root, "android")
    if not android_dir:
        print(f"[ERROR] Android directory not found in {project_root}")
        sys.exit(1)
    
    # Recursively find logo.png and splash.png (not hardcoded)
    logo_path = find_file_recursive(project_root, "logo.png")
    splash_path = find_file_recursive(project_root, "splash.png")
    
    print("=" * 60)
    print("Android Assets Replacement Script")
    print("=" * 60)
    print(f"Project root: {project_root}")
    print(f"Android dir: {android_dir}")
    if logo_path:
        print(f"Logo file: {logo_path}")
    else:
        print(f"Logo file: NOT FOUND")
    if splash_path:
        print(f"Splash file: {splash_path}")
    else:
        print(f"Splash file: NOT FOUND")
    print("")
    
    # Replace icons
    if logo_path:
        print("[INFO] Processing icons...")
        icon_count = replace_icons(android_dir, logo_path)
        print("")
    else:
        print("[WARNING] Logo file not found, skipping icon replacement")
        icon_count = 0
        print("")
    
    # Replace splash screens
    if splash_path:
        print("[INFO] Processing splash screens...")
        splash_count = replace_splash(android_dir, splash_path)
        print("")
    else:
        print("[WARNING] Splash file not found, skipping splash replacement")
        splash_count = 0
        print("")
    
    # Summary
    print("=" * 60)
    print("Summary:")
    print(f"  Icons replaced: {icon_count}")
    print(f"  Splash screens replaced: {splash_count}")
    print("=" * 60)

if __name__ == "__main__":
    main()
