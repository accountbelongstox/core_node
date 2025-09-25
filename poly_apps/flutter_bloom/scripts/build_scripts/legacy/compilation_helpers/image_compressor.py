# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

#!/usr/bin/env python3
"""
Image Compressor for Flutter Build System

PURPOSE:
Compresses and optimizes images according to Flutter development guidelines and mobile app performance standards.

SPECIFICATIONS FOLLOWED:
1. Flutter Asset Management Guidelines - Optimizes assets/common and assets/apps directories
2. Mobile Performance Standards - Reduces APK size through image compression
3. Multi-format Support - Handles PNG, JPG, JPEG, and WebP formats
4. Quality Preservation - Uses intelligent compression based on file size thresholds

FUNCTIONALITY:
- Automatically discovers all image directories in Flutter project
- Applies size-based compression thresholds (large/medium/small)
- Preserves image quality while reducing file sizes
- Creates backups before compression (optional)
- Supports recursive directory processing
- Handles transparency in PNG images properly

COMPRESSION STRATEGY:
- Large files (>2MB): Medium quality compression (75%)
- Medium files (512KB-2MB): High quality compression (90%) 
- Small files (<512KB): High quality preservation (90%)
- Files under 100KB: Skipped to avoid over-compression

COMPLIANCE:
- Follows Flutter asset directory structure standards
- Implements proper color space handling (RGBA to RGB conversion for JPEG)
- Uses Pillow library for reliable image processing
- Provides comprehensive error handling and logging

INTEGRATION:
- Called by run_all_helpers.py as part of build pipeline
- Receives compression settings via environment variables from PowerShell
- Works with Flutter project asset organization standards
- Supports both enabled and disabled compression modes

TECHNICAL DETAILS:
- Uses PIL (Pillow) for cross-platform image processing
- Handles different image formats with format-specific optimizations
- Provides detailed compression statistics and progress reporting
- Implements backup system for data safety
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageOps
import argparse

class ImageCompressor:
    def __init__(self, flutter_root, compression_enabled=True):
        self.flutter_root = Path(flutter_root)
        self.compression_enabled = compression_enabled
        self.supported_formats = {'.png', '.jpg', '.jpeg', '.webp'}
        
        # Image quality settings
        self.quality_settings = {
            'high': 90,
            'medium': 75,
            'low': 60
        }
        
        # Size thresholds for different compression levels
        self.size_thresholds = {
            'large': 2 * 1024 * 1024,  # 2MB
            'medium': 512 * 1024,      # 512KB
            'small': 100 * 1024        # 100KB
        }
    
    def get_image_directories(self):
        """Get all image directories in the Flutter project"""
        directories = []
        
        # Main assets directory
        assets_dir = self.flutter_root / "assets"
        if assets_dir.exists():
            directories.append(assets_dir)
        
        # App-specific assets
        apps_assets = assets_dir / "apps" if assets_dir.exists() else None
        if apps_assets and apps_assets.exists():
            for app_dir in apps_assets.iterdir():
                if app_dir.is_dir():
                    directories.append(app_dir)
        
        # Common assets
        common_assets = assets_dir / "common" if assets_dir.exists() else None
        if common_assets and common_assets.exists():
            directories.append(common_assets)
        
        return directories
    
    def should_compress_image(self, image_path):
        """Determine if image should be compressed based on size and format"""
        if not self.compression_enabled:
            return False
        
        file_size = image_path.stat().st_size
        file_ext = image_path.suffix.lower()
        
        # Skip if not supported format
        if file_ext not in self.supported_formats:
            return False
        
        # Compress if file is larger than small threshold
        return file_size > self.size_thresholds['small']
    
    def get_compression_quality(self, file_size):
        """Get appropriate compression quality based on file size"""
        if file_size > self.size_thresholds['large']:
            return self.quality_settings['medium']
        elif file_size > self.size_thresholds['medium']:
            return self.quality_settings['high']
        else:
            return self.quality_settings['high']
    
    def compress_image(self, image_path, backup=True):
        """Compress a single image file"""
        try:
            original_size = image_path.stat().st_size
            
            # Create backup if requested
            if backup:
                backup_path = image_path.with_suffix('.backup' + image_path.suffix)
                if not backup_path.exists():
                    backup_path.write_bytes(image_path.read_bytes())
            
            # Open and process image
            with Image.open(image_path) as img:
                # Convert RGBA to RGB for JPEG if necessary
                if image_path.suffix.lower() in ['.jpg', '.jpeg'] and img.mode in ['RGBA', 'LA']:
                    # Create white background
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'RGBA':
                        background.paste(img, mask=img.split()[-1])
                    else:
                        background.paste(img)
                    img = background
                
                # Get compression quality
                quality = self.get_compression_quality(original_size)
                
                # Save compressed image
                save_kwargs = {
                    'quality': quality,
                    'optimize': True
                }
                
                if image_path.suffix.lower() == '.png':
                    save_kwargs = {'optimize': True}
                elif image_path.suffix.lower() == '.webp':
                    save_kwargs['method'] = 6  # Best compression method for WebP
                
                img.save(image_path, **save_kwargs)
            
            new_size = image_path.stat().st_size
            compression_ratio = (1 - new_size / original_size) * 100
            
            print(f"Compressed {image_path.name}: {original_size} -> {new_size} bytes ({compression_ratio:.1f}% reduction)")
            return True
            
        except Exception as e:
            print(f"Error compressing {image_path}: {e}")
            return False
    
    def compress_directory(self, directory):
        """Compress all images in a directory recursively"""
        if not directory.exists():
            print(f"Directory does not exist: {directory}")
            return 0, 0
        
        compressed_count = 0
        total_count = 0
        
        print(f"Processing directory: {directory}")
        
        # Find all image files recursively
        for image_path in directory.rglob('*'):
            if image_path.is_file() and image_path.suffix.lower() in self.supported_formats:
                total_count += 1
                
                if self.should_compress_image(image_path):
                    if self.compress_image(image_path):
                        compressed_count += 1
                else:
                    print(f"Skipped {image_path.name} (too small or compression disabled)")
        
        return compressed_count, total_count
    
    def compress_all_images(self):
        """Compress all images in the Flutter project"""
        if not self.compression_enabled:
            print("Image compression is disabled")
            return
        
        print("Starting image compression for Flutter project...")
        
        total_compressed = 0
        total_images = 0
        
        directories = self.get_image_directories()
        
        if not directories:
            print("No image directories found")
            return
        
        for directory in directories:
            compressed, total = self.compress_directory(directory)
            total_compressed += compressed
            total_images += total
        
        print(f"\nImage compression completed:")
        print(f"  Total images found: {total_images}")
        print(f"  Images compressed: {total_compressed}")
        print(f"  Images skipped: {total_images - total_compressed}")

def print_specifications():
    """Print the specifications and standards this script follows"""
    print("=" * 80)
    print("IMAGE COMPRESSOR - SPECIFICATIONS")
    print("=" * 80)
    print("STANDARDS FOLLOWED:")
    print("• Flutter Asset Management Guidelines")
    print("• Mobile Performance Optimization Standards")
    print("• FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md Guidelines")
    print("• Multi-format Image Support (PNG, JPG, JPEG, WebP)")
    print("• Quality Preservation Standards")
    print("")
    print("COMPRESSION THRESHOLDS:")
    print("• Large files (>2MB): Medium quality (75%) for size reduction")
    print("• Medium files (512KB-2MB): High quality (90%) preservation")
    print("• Small files (<512KB): High quality (90%) preservation")
    print("• Tiny files (<100KB): Skipped to avoid over-compression")
    print("")
    print("OPERATIONS:")
    print("• Recursive directory scanning (assets/common, assets/apps)")
    print("• Automatic backup creation before compression")
    print("• Color space conversion (RGBA→RGB for JPEG)")
    print("• Progress reporting and compression statistics")
    print("=" * 80)

def main():
    print_specifications()
    
    parser = argparse.ArgumentParser(description='Compress Flutter project images')
    parser.add_argument('--flutter-root', required=True, help='Flutter project root directory')
    parser.add_argument('--compression', choices=['enabled', 'disabled'], default='enabled', 
                      help='Enable or disable image compression')
    parser.add_argument('--directory', help='Specific directory to compress (optional)')
    
    args = parser.parse_args()
    
    compression_enabled = args.compression == 'enabled'
    compressor = ImageCompressor(args.flutter_root, compression_enabled)
    
    if args.directory:
        # Compress specific directory
        directory = Path(args.directory)
        compressed, total = compressor.compress_directory(directory)
        print(f"Compressed {compressed}/{total} images in {directory}")
    else:
        # Compress all images
        compressor.compress_all_images()
    
    return 0

if __name__ == "__main__":
    exit(main())