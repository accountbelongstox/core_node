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

# -*- coding: utf-8 -*-
"""
Flutter Android Asset Generator

This script generates Android-specific image assets from source images in assets/.internal_common
and replaces target images in Android platform directories with properly sized and compressed versions.

Features:
- Android platform support only
- Intelligent size analysis based on folder names (e.g., dpixx)
- Proportional scaling with smart cropping
- Image compression and optimization
- Skip placeholder images (1x1px)
- Batch processing with detailed logging

Usage:
    python asset_generator.py

Author: Flutter Asset Generator
"""

import os
import sys
import re
from pathlib import Path
from PIL import Image, ImageOps
import json
from typing import Dict, List, Tuple, Optional

class FlutterAssetGenerator:
    def __init__(self):
        # Hardcoded paths: .py + ../
        self.flutter_dir = Path(__file__).parent.parent
        self.source_dir = self.flutter_dir / "assets" / ".internal_common"
        # Only Android platform
        self.platforms = {
            "android": self.flutter_dir / "android"
        }
        
        # Asset mapping: $sourcefile => [$targetImageFileList]
        # Only Android platform mapping
        self.android_mapping = {
            "background": ["background.png"]
        }
        
        # Android DPI patterns to look for in folder names
        self.dpi_patterns = {
            # Android patterns
            r'drawable-mdpi': 1.0,
            r'drawable-hdpi': 1.5,
            r'drawable-xhdpi': 2.0,
            r'drawable-xxhdpi': 3.0,
            r'drawable-xxxhdpi': 4.0,
            # Custom DPI patterns
            r'dpi(\d+)': lambda x: int(x) / 160,
            r'hdpi': 1.5,
            r'xhdpi': 2.0,
            r'xxhdpi': 3.0,
            r'xxxhdpi': 4.0,
            r'mdpi': 1.0
        }
        
        # Recommended sizes for different image types and DPI levels
        self.recommended_sizes = {
            "small_icon": {
                1.0: (24, 24),      # mdpi
                1.5: (36, 36),      # hdpi
                2.0: (48, 48),      # xhdpi
                3.0: (72, 72),      # xxhdpi
                4.0: (96, 96)       # xxxhdpi
            },
            "large_icon": {
                1.0: (48, 48),      # mdpi
                1.5: (72, 72),      # hdpi
                2.0: (96, 96),      # xhdpi
                3.0: (144, 144),    # xxhdpi
                4.0: (192, 192)     # xxxhdpi
            },
            "very_large_icon": {
                1.0: (96, 96),      # mdpi
                1.5: (144, 144),    # hdpi
                2.0: (192, 192),    # xhdpi
                3.0: (288, 288),    # xxhdpi
                4.0: (384, 384)     # xxxhdpi
            },
            "portrait_background": {
                1.0: (320, 480),    # mdpi
                1.5: (480, 720),    # hdpi
                2.0: (640, 960),    # xhdpi
                3.0: (960, 1440),   # xxhdpi
                4.0: (1280, 1920)  # xxxhdpi
            },
            "landscape_background": {
                1.0: (480, 320),    # mdpi
                1.5: (720, 480),    # hdpi
                2.0: (960, 640),    # xhdpi
                3.0: (1440, 960),   # xxhdpi
                4.0: (1920, 1280)  # xxxhdpi
            },
            "banner_image": {
                1.0: (320, 240),    # mdpi
                1.5: (480, 360),    # hdpi
                2.0: (640, 480),    # xhdpi
                3.0: (960, 720),    # xxhdpi
                4.0: (1280, 960)   # xxxhdpi
            }
        }
        
        # Supported image formats
        self.supported_formats = {'.png', '.jpg', '.jpeg', '.webp'}
        
        # Compression settings
        self.compression_settings = {
            'png': {'optimize': True, 'compress_level': 9},
            'jpg': {'quality': 85, 'optimize': True},
            'jpeg': {'quality': 85, 'optimize': True},
            'webp': {'quality': 85, 'method': 6}
        }

    def log(self, message: str, level: str = "INFO"):
        """Log messages with timestamp and level"""
        from datetime import datetime
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def analyze_dpi_from_folder(self, folder_name: str) -> Optional[float]:
        """Extract DPI multiplier from folder name"""
        folder_lower = folder_name.lower()
        
        for pattern, multiplier in self.dpi_patterns.items():
            if callable(multiplier):
                # Handle dynamic patterns like dpi(\d+)
                match = re.search(pattern, folder_lower)
                if match:
                    return multiplier(match.group(1))
            else:
                # Handle static patterns
                if re.search(pattern, folder_lower):
                    return multiplier
        
        return None

    def get_target_size(self, source_size: Tuple[int, int], dpi_multiplier: float) -> Tuple[int, int]:
        """Calculate target size based on DPI multiplier"""
        width, height = source_size
        target_width = int(width * dpi_multiplier)
        target_height = int(height * dpi_multiplier)
        return target_width, target_height

    def analyze_image_type(self, image_path: Path) -> str:
        """Intelligently analyze image type based on dimensions and characteristics"""
        try:
            with Image.open(image_path) as img:
                width, height = img.size
                
                # Check for placeholder (1x1px)
                if width == 1 and height == 1:
                    return "placeholder"
                
                # Calculate aspect ratio
                aspect_ratio = width / height if height > 0 else 0
                
                # Check for square images (icons)
                if 0.8 <= aspect_ratio <= 1.2:
                    # Small icon: typically 16x16 to 64x64
                    if width <= 64 and height <= 64:
                        return "small_icon"
                    # Large icon: typically 128x128 to 512x512
                    elif width <= 512 and height <= 512:
                        return "large_icon"
                    # Very large icon: typically 1024x1024+
                    else:
                        return "very_large_icon"
                
                # Check for landscape images (wide backgrounds)
                elif aspect_ratio > 1.5:
                    return "landscape_background"
                
                # Check for portrait images (tall backgrounds)
                elif aspect_ratio < 0.67:
                    return "portrait_background"
                
                # Check for medium aspect ratio (banner-like)
                elif 0.67 <= aspect_ratio <= 1.5:
                    return "banner_image"
                
                # Default case
                else:
                    return "unknown"
                    
        except Exception as e:
            self.log(f"Error analyzing image {image_path}: {e}", "ERROR")
            return "unknown"
    
    def is_placeholder_image(self, image_path: Path) -> bool:
        """Check if image is a placeholder (1x1px)"""
        return self.analyze_image_type(image_path) == "placeholder"

    def resize_and_crop_image(self, source_img: Image.Image, target_size: Tuple[int, int]) -> Image.Image:
        """Resize image proportionally and crop to target size"""
        target_width, target_height = target_size
        source_width, source_height = source_img.size
        
        # Calculate scaling factors
        width_ratio = target_width / source_width
        height_ratio = target_height / source_height
        
        # Use the larger ratio to ensure we cover the target size
        scale_ratio = max(width_ratio, height_ratio)
        
        # Calculate new size
        new_width = int(source_width * scale_ratio)
        new_height = int(source_height * scale_ratio)
        
        # Resize image
        resized_img = source_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Calculate crop box to center the image
        left = (new_width - target_width) // 2
        top = (new_height - target_height) // 2
        right = left + target_width
        bottom = top + target_height
        
        # Crop to target size
        cropped_img = resized_img.crop((left, top, right, bottom))
        
        return cropped_img

    def compress_image(self, image: Image.Image, output_path: Path, quality: int = 85) -> bool:
        """Compress and save image with appropriate settings"""
        try:
            file_ext = output_path.suffix.lower()
            
            if file_ext in ['.jpg', '.jpeg']:
                # Convert to RGB if necessary
                if image.mode in ('RGBA', 'LA', 'P'):
                    # Create white background for transparent images
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    if image.mode == 'P':
                        image = image.convert('RGBA')
                    background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                    image = background
                elif image.mode != 'RGB':
                    image = image.convert('RGB')
                
                image.save(output_path, 'JPEG', quality=quality, optimize=True)
                
            elif file_ext == '.png':
                # Preserve transparency
                if image.mode in ('RGBA', 'LA', 'P'):
                    if image.mode == 'P':
                        image = image.convert('RGBA')
                    elif image.mode == 'LA':
                        image = image.convert('RGBA')
                else:
                    image = image.convert('RGBA')
                
                image.save(output_path, 'PNG', optimize=True, compress_level=9)
                
            elif file_ext == '.webp':
                # Convert to RGB if necessary
                if image.mode in ('RGBA', 'LA', 'P'):
                    if image.mode == 'P':
                        image = image.convert('RGBA')
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                    image = background
                elif image.mode != 'RGB':
                    image = image.convert('RGB')
                
                image.save(output_path, 'WEBP', quality=quality, method=6)
            
            return True
            
        except Exception as e:
            self.log(f"Failed to compress image: {e}", "ERROR")
            return False

    def find_source_images(self) -> List[Path]:
        """Find all source images in .internal_common directory"""
        source_images = []
        
        if not self.source_dir.exists():
            self.log(f"Source directory not found: {self.source_dir}", "ERROR")
            return source_images
        
        for file_path in self.source_dir.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in self.supported_formats:
                if not self.is_placeholder_image(file_path):
                    source_images.append(file_path)
                else:
                    self.log(f"Skipping placeholder image: {file_path.name}", "DEBUG")
        
        return source_images





    def find_dpi_from_path(self, target_path: Path) -> Optional[float]:
        """Find DPI multiplier from the directory path of a target image (Android only)"""
        current_path = target_path.parent
        android_dir = self.platforms["android"]
        
        # Check current directory and parent directories for DPI information
        while current_path != android_dir:
            dpi_multiplier = self.analyze_dpi_from_folder(current_path.name)
            if dpi_multiplier is not None:
                return dpi_multiplier
            current_path = current_path.parent
        
        return None

    def find_target_file_in_platform(self, target_filename: str) -> Optional[Path]:
        """Find target file in Android platform directory by filename"""
        android_dir = self.platforms["android"]
        
        if not android_dir.exists():
            return None
        
        # Recursively search for the target file
        for root, dirs, files in os.walk(android_dir):
            root_path = Path(root)
            
            for file_path in root_path.iterdir():
                if file_path.is_file() and file_path.name == target_filename:
                    return file_path
        
        return None

    def analyze_size_compatibility(self, image_path: Path, image_type: str) -> Dict:
        """Analyze image size compatibility with recommended sizes"""
        try:
            with Image.open(image_path) as img:
                current_width, current_height = img.size
                
                # Get DPI multiplier from folder path
                dpi_multiplier = self.find_dpi_from_path(image_path)
                if dpi_multiplier is None:
                    dpi_multiplier = 1.0  # Default to mdpi
                
                # Get recommended size for this image type and DPI
                recommended_size = None
                if image_type in self.recommended_sizes and dpi_multiplier in self.recommended_sizes[image_type]:
                    recommended_size = self.recommended_sizes[image_type][dpi_multiplier]
                
                # Calculate compatibility score
                compatibility_score = 0
                compatibility_note = ""
                
                if recommended_size:
                    rec_width, rec_height = recommended_size
                    
                    # Check if dimensions are close to recommended
                    width_diff = abs(current_width - rec_width)
                    height_diff = abs(current_height - rec_height)
                    
                    # Calculate percentage difference
                    width_diff_pct = (width_diff / rec_width) * 100
                    height_diff_pct = (height_diff / rec_height) * 100
                    
                    # Determine compatibility
                    if width_diff_pct <= 5 and height_diff_pct <= 5:
                        compatibility_score = 100
                        compatibility_note = "Perfect match"
                    elif width_diff_pct <= 10 and height_diff_pct <= 10:
                        compatibility_score = 90
                        compatibility_note = "Very good match"
                    elif width_diff_pct <= 20 and height_diff_pct <= 20:
                        compatibility_score = 75
                        compatibility_note = "Good match"
                    elif width_diff_pct <= 50 and height_diff_pct <= 50:
                        compatibility_score = 50
                        compatibility_note = "Acceptable match"
                    else:
                        compatibility_score = 25
                        compatibility_note = "Poor match - significant size difference"
                else:
                    compatibility_note = "No recommended size available for this type"
                
                return {
                    "current_size": (current_width, current_height),
                    "dpi_multiplier": dpi_multiplier,
                    "recommended_size": recommended_size,
                    "compatibility_score": compatibility_score,
                    "compatibility_note": compatibility_note,
                    "folder_path": str(image_path.parent)
                }
                
        except Exception as e:
            return {
                "current_size": (0, 0),
                "dpi_multiplier": 1.0,
                "recommended_size": None,
                "compatibility_score": 0,
                "compatibility_note": f"Error analyzing: {e}",
                "folder_path": str(image_path.parent)
            }

    def find_and_analyze_android_images(self) -> Dict[str, List[Tuple[Path, str]]]:
        """Find and intelligently analyze all images in Android platform"""
        android_dir = self.platforms["android"]
        image_categories = {
            "small_icon": [],
            "large_icon": [],
            "very_large_icon": [],
            "landscape_background": [],
            "portrait_background": [],
            "banner_image": [],
            "placeholder": [],
            "unknown": []
        }
        
        if not android_dir.exists():
            return image_categories
        
        # Recursively scan Android directory
        for root, dirs, files in os.walk(android_dir):
            root_path = Path(root)
            
            for file_path in root_path.iterdir():
                if file_path.is_file() and file_path.suffix.lower() in self.supported_formats:
                    # Analyze image type
                    image_type = self.analyze_image_type(file_path)
                    
                    # Add to appropriate category
                    if image_type in image_categories:
                        image_categories[image_type].append((file_path, image_type))
                    else:
                        image_categories["unknown"].append((file_path, image_type))
        
        return image_categories

    def generate_asset_mapping(self) -> Dict[str, Dict[str, List[Tuple[Path, List[Path]]]]]:
        """Generate mapping between source files and target image lists for Android platform using hardcoded mapping"""
        mapping = {}
        source_images = self.find_source_images()
        
        self.log(f"Found {len(source_images)} source images")
        
        # Only process Android platform
        platform = "android"
        mapping[platform] = {}
        
        self.log(f"  Performing intelligent image analysis for Android platform...")
        
        # Analyze all images in Android directory
        android_images = self.find_and_analyze_android_images()
        
        # Log analysis results with size compatibility
        for category, images in android_images.items():
            if images:
                self.log(f"    Found {len(images)} {category} images")
                for img_path, img_type in images:
                    # Analyze size compatibility
                    compatibility = self.analyze_size_compatibility(img_path, img_type)
                    
                    # Format the log message
                    if compatibility["recommended_size"]:
                        rec_width, rec_height = compatibility["recommended_size"]
                        self.log(f"      - {img_path.name}: {img_path.parent.name}")
                        self.log(f"        Current: {compatibility['current_size'][0]}x{compatibility['current_size'][1]}")
                        self.log(f"        Recommended: {rec_width}x{rec_height} (DPI: {compatibility['dpi_multiplier']}x)")
                        self.log(f"        Compatibility: {compatibility['compatibility_score']}/100 - {compatibility['compatibility_note']}")
                    else:
                        self.log(f"      - {img_path.name}: {img_path.parent.name}")
                        self.log(f"        Current: {compatibility['current_size'][0]}x{compatibility['current_size'][1]}")
                        self.log(f"        DPI: {compatibility['dpi_multiplier']}x")
                        self.log(f"        Note: {compatibility['compatibility_note']}")
                    
                    # Add file size info
                    file_size = img_path.stat().st_size
                    self.log(f"        File size: {file_size} bytes")
                    
                    # Only show first 3 detailed, then summarize
                    if images.index((img_path, img_type)) >= 2:
                        remaining = len(images) - 3
                        if remaining > 0:
                            self.log(f"        ... and {remaining} more {category} images")
                        break
        
        # Process mapped sources
        if self.android_mapping:
            for source_path in source_images:
                source_name = source_path.stem
                
                if source_name in self.android_mapping:
                    self.log(f"  Processing mapped source '{source_name}' for Android")
                    
                    target_files = self.android_mapping[source_name]
                    target_paths = []
                    
                    for target_file in target_files:
                        target_path = self.find_target_file_in_platform(target_file)
                        if target_path:
                            target_paths.append(target_path)
                            # Analyze the target image
                            img_type = self.analyze_image_type(target_path)
                            self.log(f"    Target '{target_file}' identified as: {img_type}")
                        else:
                            self.log(f"    Warning: Target file '{target_file}' not found in Android")
                    
                    if target_paths:
                        dpi_key = "1x"
                        if dpi_key not in mapping[platform]:
                            mapping[platform][dpi_key] = []
                        
                        mapping[platform][dpi_key].append((source_path, target_paths))
                        self.log(f"    Mapped to {len(target_paths)} targets")
                else:
                    self.log(f"  No mapping for '{source_name}' in Android")
        else:
            self.log(f"  No Android mapping defined")
        
        return mapping

    def process_platform(self, mapping: Dict, dry_run: bool = False, compress: bool = True) -> int:
        """Process assets for Android platform"""
        self.log("Processing Android platform")
        
        if "android" not in mapping:
            self.log("No mapping found for Android platform", "WARNING")
            return 0
        
        processed_count = 0
        
        for dpi_key, source_target_pairs in mapping["android"].items():
            self.log(f"  Processing {dpi_key}...")
            
            for source_path, target_list in source_target_pairs:
                try:
                    # Extract DPI multiplier from the key (e.g., "2x" -> 2.0)
                    if dpi_key == "default":
                        self.log(f"    Skipping default group for {source_path.name}")
                        continue
                        
                    dpi_multiplier = float(dpi_key.replace('x', ''))
                    if dpi_multiplier <= 0:
                        self.log(f"    Invalid DPI multiplier: {dpi_key}, skipping", "WARNING")
                        continue
                    
                    # Open source image
                    with Image.open(source_path) as source_img:
                        source_size = source_img.size
                        target_size = self.get_target_size(source_size, dpi_multiplier)
                        
                        self.log(f"    Processing {source_path.name} -> {len(target_list)} targets")
                        self.log(f"      Source: {source_size[0]}x{source_size[1]}")
                        self.log(f"      Target: {target_size[0]}x{target_size[1]} (DPI: {dpi_multiplier})")
                        
                        if dry_run:
                            self.log(f"      [DRY RUN] Would resize and replace {len(target_list)} targets")
                            processed_count += len(target_list)
                            continue
                        
                        # Process each target in the list
                        for target_path in target_list:
                            try:
                                # Resize and crop image
                                processed_img = self.resize_and_crop_image(source_img, target_size)
                                
                                # Compress and save
                                if compress:
                                    success = self.compress_image(processed_img, target_path)
                                else:
                                    success = self.compress_image(processed_img, target_path, quality=100)
                                
                                if success:
                                    self.log(f"        ✅ Successfully processed {target_path.name}")
                                    processed_count += 1
                                else:
                                    self.log(f"        ❌ Failed to process {target_path.name}", "ERROR")
                            
                            except Exception as e:
                                self.log(f"        ❌ Error processing {target_path.name}: {e}", "ERROR")
                
                except Exception as e:
                    self.log(f"      ❌ Error processing {source_path.name}: {e}", "ERROR")
        
        return processed_count

    def run(self, dry_run: bool = False, compress: bool = True):
        """Run the asset generation process for Android platform"""
        self.log("Starting Flutter Asset Generator (Android Only)")
        self.log(f"Flutter directory: {self.flutter_dir}")
        self.log(f"Source directory: {self.source_dir}")
        self.log(f"Platform: Android")
        self.log(f"Dry run: {dry_run}")
        self.log(f"Compression: {compress}")
        
        # Generate asset mapping
        mapping = self.generate_asset_mapping()
        
        # Process Android platform
        if "android" in mapping:
            processed = self.process_platform(mapping, dry_run, compress)
            self.log(f"Android platform: {processed} images processed")
        else:
            self.log("Android platform: No assets found", "WARNING")
            processed = 0
        
        self.log(f"Asset generation complete. Total processed: {processed}")
        
        # Save mapping to JSON for reference
        mapping_file = self.flutter_dir / "scripts" / "asset_mapping.json"
        try:
            with open(mapping_file, 'w', encoding='utf-8') as f:
                # Convert Path objects to strings for JSON serialization
                json_mapping = {}
                for platform, dpi_data in mapping.items():
                    json_mapping[platform] = {}
                    for dpi_folder, pairs in dpi_data.items():
                        json_mapping[platform][dpi_folder] = [
                            (str(source), [str(target) for target in target_list]) for source, target_list in pairs
                        ]
                
                json.dump(json_mapping, f, indent=2, ensure_ascii=False)
                self.log(f"Asset mapping saved to: {mapping_file}")
        except Exception as e:
            self.log(f"Failed to save asset mapping: {e}", "WARNING")

def main():
    # Hardcoded configuration constants
    DRY_RUN = False                                    # Set to True for dry run
    COMPRESS = True                                     # Enable compression
    
    # Initialize generator
    generator = FlutterAssetGenerator()
    
    # Run generation with hardcoded values
    generator.run(DRY_RUN, COMPRESS)

if __name__ == "__main__":
    main()
