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
Image Processor Utility for Flutter Build System

Extended from legacy image_compressor.py to provide format conversion
and compression functionality with temporary directory management.

Key Features:
- Convert any image to specified format (default: PNG)
- Optional compression based on user parameters
- Temporary directory management for processed images
- Path tracking for original and processed files
- Support for PNG, JPG, JPEG, WebP formats
- Quality preservation and optimization
"""

import os
import shutil
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Optional, Dict, List, Tuple

from PIL import Image, ImageOps

class ImageProcessor:
    def __init__(self, flutter_root_dir: Optional[Path] = None):
        # Core configuration
        self.flutter_root_dir = flutter_root_dir or Path.cwd()
        self.cache_dir = self.flutter_root_dir / ".cache" / "processed_images"
        self.supported_input_formats = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tiff', '.tif'}
        self.supported_output_formats = {'.png', '.jpg', '.jpeg', '.webp'}

        # Default settings
        self.default_output_format = '.png'
        self.compression_enabled = False

        # Quality settings from legacy code
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

        # Ensure cache directory exists
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, input_path: Path, output_format: str) -> Path:
        """Generate cache path maintaining original folder structure"""
        try:
            # Try to get relative path from flutter root
            relative_path = input_path.relative_to(self.flutter_root_dir)
        except ValueError:
            # If input_path is not under flutter_root_dir, use just the filename
            relative_path = input_path.name

        # Change extension to output format
        cache_file_path = self.cache_dir / relative_path
        cache_file_path = cache_file_path.with_suffix(output_format)

        # Ensure parent directory exists
        cache_file_path.parent.mkdir(parents=True, exist_ok=True)

        return cache_file_path

    def _get_compression_quality(self, file_size: int) -> int:
        """Get appropriate compression quality based on file size"""
        if file_size > self.size_thresholds['large']:
            return self.quality_settings['medium']
        elif file_size > self.size_thresholds['medium']:
            return self.quality_settings['high']
        else:
            return self.quality_settings['high']

    def _prepare_image_for_format(self, img: Image.Image, output_format: str) -> Image.Image:
        """Prepare image for specific output format"""
        output_format_lower = output_format.lower()

        # Handle JPEG format - convert RGBA to RGB
        if output_format_lower in ['.jpg', '.jpeg']:
            if img.mode in ['RGBA', 'LA']:
                # Create white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'RGBA':
                    background.paste(img, mask=img.split()[-1])
                else:
                    background.paste(img)
                return background
            elif img.mode != 'RGB':
                return img.convert('RGB')

        # Handle PNG format - preserve transparency
        elif output_format_lower == '.png':
            if img.mode not in ['RGBA', 'LA', 'P']:
                if img.mode == 'RGB':
                    # Keep as RGB for PNG if no transparency needed
                    pass
                else:
                    img = img.convert('RGBA')

        # Handle WebP format
        elif output_format_lower == '.webp':
            if img.mode not in ['RGB', 'RGBA']:
                img = img.convert('RGBA')

        return img

    def _get_save_kwargs(self, output_format: str, file_size: int, compress: bool) -> Dict:
        """Get save arguments for different formats"""
        output_format_lower = output_format.lower()
        save_kwargs = {}

        if output_format_lower == '.png':
            save_kwargs = {'optimize': True}
            if compress:
                save_kwargs['compress_level'] = 9

        elif output_format_lower in ['.jpg', '.jpeg']:
            if compress:
                quality = self._get_compression_quality(file_size)
                save_kwargs = {
                    'quality': quality,
                    'optimize': True
                }
            else:
                save_kwargs = {
                    'quality': 95,
                    'optimize': True
                }

        elif output_format_lower == '.webp':
            if compress:
                quality = self._get_compression_quality(file_size)
                save_kwargs = {
                    'quality': quality,
                    'method': 6,  # Best compression method
                    'optimize': True
                }
            else:
                save_kwargs = {
                    'quality': 95,
                    'method': 6,
                    'optimize': True
                }

        return save_kwargs

    def process_image(self,
                     input_path: Path,
                     output_format: Optional[str] = None,
                     compress: bool = False) -> Dict:
        """
        Process a single image with format conversion and optional compression

        Args:
            input_path: Path to input image
            output_format: Target format (default: PNG)
            compress: Whether to apply compression

        Returns:
            Dict with processing results including original and processed paths
        """
        input_path = Path(input_path)
        output_format = output_format or self.default_output_format

        # Ensure output format has leading dot
        if not output_format.startswith('.'):
            output_format = '.' + output_format

        result = {
            'success': False,
            'original_path': str(input_path),
            'processed_path': None,
            'original_size': 0,
            'processed_size': 0,
            'compression_ratio': 0,
            'format_changed': False,
            'error': None
        }

        try:
            # SAFETY CHECK: Ensure we're not accidentally processing images in the original project directory
            current_dir = Path.cwd()
            flutter_root_str = str(self.flutter_root_dir)
            current_dir_str = str(current_dir)

            # Check if we're in a temporary/build directory
            is_in_temp_or_build = (".build_dir" in current_dir_str and "compile_factory" in current_dir_str) or \
                                  (".build_dir" in flutter_root_str and "compile_factory" in flutter_root_str)

            if not is_in_temp_or_build:
                result['error'] = f"SAFETY ERROR: Image processing should only occur in temporary build directories. Current: {current_dir}, Flutter root: {self.flutter_root_dir}"
                print(f"[SAFETY-ERROR] Blocked image processing in non-temporary directory: {current_dir}")
                return result

            # Validate input
            if not input_path.exists():
                result['error'] = f"Input file does not exist: {input_path}"
                return result

            if input_path.suffix.lower() not in self.supported_input_formats:
                result['error'] = f"Unsupported input format: {input_path.suffix}"
                return result

            if output_format.lower() not in self.supported_output_formats:
                result['error'] = f"Unsupported output format: {output_format}"
                return result

            # Get original file size
            result['original_size'] = input_path.stat().st_size

            # Generate cache path maintaining folder structure
            output_path = self._get_cache_path(input_path, output_format)

            # Check if format conversion is needed
            result['format_changed'] = input_path.suffix.lower() != output_format.lower()

            # Check if processed image already exists and is newer than original
            if output_path.exists() and output_path.stat().st_mtime >= input_path.stat().st_mtime:
                print(f"Using existing processed image: {output_path}")
                result['processed_path'] = str(output_path)
                result['processed_size'] = output_path.stat().st_size
                if result['original_size'] > 0:
                    result['compression_ratio'] = (1 - result['processed_size'] / result['original_size']) * 100
                result['success'] = True
                return result

            # Process image
            with Image.open(input_path) as img:
                # Prepare image for target format
                processed_img = self._prepare_image_for_format(img, output_format)

                # Get save parameters
                save_kwargs = self._get_save_kwargs(output_format, result['original_size'], compress)

                # Save processed image
                processed_img.save(output_path, **save_kwargs)

            # Update results
            result['processed_path'] = str(output_path)
            result['processed_size'] = output_path.stat().st_size

            if result['original_size'] > 0:
                result['compression_ratio'] = (1 - result['processed_size'] / result['original_size']) * 100

            result['success'] = True

        except Exception as e:
            result['error'] = f"Processing failed: {str(e)}"

        return result

    def process_multiple_images(self,
                               input_paths: List[Path],
                               output_format: Optional[str] = None,
                               compress: bool = False) -> List[Dict]:
        """Process multiple images with the same settings"""
        results = []

        for input_path in input_paths:
            result = self.process_image(input_path, output_format, compress)
            results.append(result)

        return results

    def cleanup_cache_directory(self):
        """Clean up cache directory"""
        try:
            if self.cache_dir.exists():
                shutil.rmtree(self.cache_dir)
                print(f"Cleaned up cache directory: {self.cache_dir}")
        except Exception as e:
            print(f"Error cleaning up cache directory: {e}")

    def get_cache_files(self) -> List[Path]:
        """Get list of all files in cache directory"""
        if not self.cache_dir.exists():
            return []

        return [f for f in self.cache_dir.rglob('*') if f.is_file()]

    def print_processing_result(self, result: Dict):
        """Print formatted processing result"""
        print(f"Original Path: {result['original_path']}")

        if result['success']:
            print(f"Processed Path: {result['processed_path']}")
            print(f"Original Size: {result['original_size']:,} bytes")
            print(f"Processed Size: {result['processed_size']:,} bytes")

            if result['compression_ratio'] > 0:
                print(f"Size Reduction: {result['compression_ratio']:.1f}%")
            elif result['compression_ratio'] < 0:
                print(f"Size Increase: {abs(result['compression_ratio']):.1f}%")
            else:
                print("Size: No change")

            if result['format_changed']:
                original_format = Path(result['original_path']).suffix.upper()
                processed_format = Path(result['processed_path']).suffix.upper()
                print(f"Format: {original_format} → {processed_format}")

            print("Status: SUCCESS")
        else:
            print(f"Status: FAILED - {result['error']}")

        print("-" * 50)

# Convenience functions for common operations
def convert_to_png(input_path: Path, compress: bool = False, flutter_root_dir: Optional[Path] = None) -> Dict:
    """Convert image to PNG format"""
    processor = ImageProcessor(flutter_root_dir)
    return processor.process_image(input_path, '.png', compress)

def convert_to_jpg(input_path: Path, compress: bool = False, flutter_root_dir: Optional[Path] = None) -> Dict:
    """Convert image to JPG format"""
    processor = ImageProcessor(flutter_root_dir)
    return processor.process_image(input_path, '.jpg', compress)

def convert_to_webp(input_path: Path, compress: bool = False, flutter_root_dir: Optional[Path] = None) -> Dict:
    """Convert image to WebP format"""
    processor = ImageProcessor(flutter_root_dir)
    return processor.process_image(input_path, '.webp', compress)

def batch_convert_images(input_paths: List[Path],
                        output_format: str = '.png',
                        compress: bool = False,
                        flutter_root_dir: Optional[Path] = None) -> List[Dict]:
    """Batch convert multiple images"""
    processor = ImageProcessor(flutter_root_dir)
    return processor.process_multiple_images(input_paths, output_format, compress)