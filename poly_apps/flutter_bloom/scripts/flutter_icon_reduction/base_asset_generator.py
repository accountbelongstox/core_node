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
Base Asset Generator for Flutter Projects

This is the base class containing common functionality for generating platform-specific image assets.
Platform-specific implementations should inherit from this class.

Author: Flutter Asset Generator
"""

import os
import sys
import re
from pathlib import Path
from PIL import Image, ImageOps
import json
from typing import Dict, List, Tuple, Optional

class BaseAssetGenerator:
    def __init__(self):
        # Hardcoded paths: .py + ../
        self.flutter_dir = Path(__file__).parent.parent.parent
        self.source_dir = self.flutter_dir / "assets" / ".internal_common"
        
        # Common DPI patterns to look for in folder names
        self.dpi_patterns = {
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
                    try:
                        return multiplier(match.group(1))
                    except (ValueError, IndexError):
                        continue
            else:
                if re.search(pattern, folder_lower):
                    return multiplier
        
        return None

    def get_target_size(self, source_size: Tuple[int, int], dpi_multiplier: float) -> Tuple[int, int]:
        """Calculate target size based on source size and DPI multiplier"""
        source_width, source_height = source_size
        target_width = int(source_width * dpi_multiplier)
        target_height = int(source_height * dpi_multiplier)
        return (target_width, target_height)

    def analyze_image_type(self, image_path: Path) -> str:
        """Analyze image type based on dimensions and aspect ratio"""
        try:
            with Image.open(image_path) as img:
                width, height = img.size
                
                # Check if it's a placeholder
                if width == 1 and height == 1:
                    return "placeholder"
                
                # Calculate aspect ratio
                aspect_ratio = width / height
                
                # Determine image type based on dimensions and aspect ratio
                if width <= 96 and height <= 96:
                    if width <= 48 and height <= 48:
                        return "small_icon"
                    else:
                        return "large_icon"
                elif width <= 384 and height <= 384:
                    return "very_large_icon"
                elif aspect_ratio > 1.5:  # Landscape
                    if width > 1000 or height > 1000:
                        return "landscape_background"
                    else:
                        return "banner_image"
                elif aspect_ratio < 0.67:  # Portrait
                    if width > 1000 or height > 1000:
                        return "portrait_background"
                    else:
                        return "banner_image"
                else:  # Square-ish
                    if width > 1000 or height > 1000:
                        return "banner_image"
                    else:
                        return "large_icon"
                        
        except Exception as e:
            self.log(f"Error analyzing image type for {image_path}: {e}", "ERROR")
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
        """Find DPI multiplier from the directory path of a target image"""
        # This method should be implemented by platform-specific classes
        raise NotImplementedError("Subclasses must implement find_dpi_from_path")

    def find_target_file_in_platform(self, target_filename: str) -> Optional[Path]:
        """Find target file in platform directory by filename"""
        # This method should be implemented by platform-specific classes
        raise NotImplementedError("Subclasses must implement find_target_file_in_platform")

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
                    elif width_diff_pct <= 50 and width_diff_pct <= 50:
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

    def process_platform(self, mapping: Dict, dry_run: bool = False, compress: bool = True) -> int:
        """Process assets for a specific platform"""
        # This method should be implemented by platform-specific classes
        raise NotImplementedError("Subclasses must implement process_platform")

    def generate_asset_mapping(self) -> Dict[str, Dict[str, List[Tuple[Path, List[Path]]]]]:
        """Generate mapping between source files and target image lists"""
        # This method should be implemented by platform-specific classes
        raise NotImplementedError("Subclasses must implement generate_asset_mapping")

    def run(self, dry_run: bool = False, compress: bool = True):
        """Run the asset generation process"""
        # This method should be implemented by platform-specific classes
        raise NotImplementedError("Subclasses must implement run")

