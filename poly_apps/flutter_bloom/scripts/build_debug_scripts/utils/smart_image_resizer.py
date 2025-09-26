#!/usr/bin/env python3
"""
Smart Image Resizer
Intelligent image scaling and cropping utility for platform-specific requirements
"""

import os
from pathlib import Path
from typing import Tuple, Optional, Dict, Any
from PIL import Image, ImageOps
import math


class SmartImageResizer:
    """
    Smart image resizing utility that handles scaling and cropping for platform-specific requirements
    """

    def __init__(self):
        self.supported_formats = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}

    def resize_and_crop_to_target(
        self,
        source_image_path: Path,
        target_size: Tuple[int, int],
        output_path: Path,
        quality: int = 95
    ) -> Dict[str, Any]:
        """
        Resize and crop image to exact target size using smart scaling

        Args:
            source_image_path: Path to source image
            target_size: Target size as (width, height)
            output_path: Path to save the processed image
            quality: Output quality for JPEG (1-100)

        Returns:
            Dict containing processing results
        """
        try:
            print(f"[SMART-RESIZE] Processing: {source_image_path.name}")
            print(f"[SMART-RESIZE] Target size: {target_size[0]}x{target_size[1]}")

            # Validate input
            if not source_image_path.exists():
                return {'success': False, 'error': f'Source image not found: {source_image_path}'}

            if source_image_path.suffix.lower() not in self.supported_formats:
                return {'success': False, 'error': f'Unsupported format: {source_image_path.suffix}'}

            # Open and analyze source image
            with Image.open(source_image_path) as img:
                # Convert to RGB if necessary (for WEBP, PNG with transparency, etc.)
                if img.mode in ('RGBA', 'LA'):
                    # Create white background for transparency
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'RGBA':
                        background.paste(img, mask=img.split()[-1])  # Use alpha channel as mask
                    else:
                        background.paste(img)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                original_size = img.size
                target_width, target_height = target_size

                print(f"[SMART-RESIZE] Original size: {original_size[0]}x{original_size[1]}")

                # Calculate scaling factor for optimal fit
                scale_x = target_width / original_size[0]
                scale_y = target_height / original_size[1]

                # Use the larger scale factor to ensure we can fill the target size
                # This means one dimension will match exactly, the other might be larger
                scale_factor = max(scale_x, scale_y)

                # Calculate new size after scaling
                new_width = int(original_size[0] * scale_factor)
                new_height = int(original_size[1] * scale_factor)

                print(f"[SMART-RESIZE] Scale factor: {scale_factor:.3f}")
                print(f"[SMART-RESIZE] Scaled size: {new_width}x{new_height}")

                # Resize image with high quality resampling
                resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                # Calculate crop box to center the image
                left = (new_width - target_width) // 2
                top = (new_height - target_height) // 2
                right = left + target_width
                bottom = top + target_height

                print(f"[SMART-RESIZE] Crop box: ({left}, {top}, {right}, {bottom})")

                # Crop to exact target size
                final_img = resized_img.crop((left, top, right, bottom))

                # Ensure output directory exists
                output_path.parent.mkdir(parents=True, exist_ok=True)

                # Save with appropriate format and quality
                save_kwargs = {}
                if output_path.suffix.lower() in {'.jpg', '.jpeg'}:
                    save_kwargs = {
                        'format': 'JPEG',
                        'quality': quality,
                        'optimize': True
                    }
                elif output_path.suffix.lower() == '.png':
                    save_kwargs = {
                        'format': 'PNG',
                        'optimize': True
                    }
                else:
                    save_kwargs = {'format': 'PNG', 'optimize': True}

                final_img.save(output_path, **save_kwargs)

                # Calculate file sizes
                original_size_bytes = source_image_path.stat().st_size
                new_size_bytes = output_path.stat().st_size

                # Calculate scaling details
                scaling_info = {
                    'method': 'upscale' if scale_factor > 1 else 'downscale' if scale_factor < 1 else 'exact',
                    'scale_factor': scale_factor,
                    'cropped': new_width > target_width or new_height > target_height
                }

                result = {
                    'success': True,
                    'source_path': str(source_image_path),
                    'output_path': str(output_path),
                    'original_size': original_size,
                    'target_size': target_size,
                    'final_size': (target_width, target_height),
                    'original_size_bytes': original_size_bytes,
                    'new_size_bytes': new_size_bytes,
                    'scaling_info': scaling_info
                }

                self._print_resize_result(result)
                return result

        except Exception as e:
            error_msg = f"Failed to process image: {e}"
            print(f"[SMART-RESIZE] [ERROR] {error_msg}")
            return {'success': False, 'error': error_msg}

    def _print_resize_result(self, result: Dict[str, Any]) -> None:
        """Print detailed resize result information"""
        print()
        print("=" * 60)
        print("SMART IMAGE RESIZE RESULTS")
        print("=" * 60)

        scaling_info = result['scaling_info']
        original_size = result['original_size']
        final_size = result['final_size']

        print(f"Source: {Path(result['source_path']).name}")
        print(f"Output: {result['output_path']}")
        print(f"Original Size: {original_size[0]}x{original_size[1]}")
        print(f"Target Size: {result['target_size'][0]}x{result['target_size'][1]}")
        print(f"Final Size: {final_size[0]}x{final_size[1]}")

        # File size information
        original_kb = result['original_size_bytes'] / 1024
        new_kb = result['new_size_bytes'] / 1024
        size_change = ((result['new_size_bytes'] - result['original_size_bytes']) / result['original_size_bytes']) * 100

        print(f"File Size: {original_kb:.1f}KB → {new_kb:.1f}KB ({size_change:+.1f}%)")

        # Scaling method information
        method = scaling_info['method']
        scale_factor = scaling_info['scale_factor']

        if method == 'upscale':
            print(f"Method: UPSCALE (x{scale_factor:.3f})")
        elif method == 'downscale':
            print(f"Method: DOWNSCALE (x{scale_factor:.3f})")
        else:
            print("Method: EXACT MATCH")

        if scaling_info['cropped']:
            print("Processing: SCALED + CROPPED to fit exact dimensions")
        else:
            print("Processing: SCALED to exact dimensions")

        print("Status: SUCCESS")
        print("=" * 60)
        print()

    def batch_resize_for_platform(
        self,
        source_image_path: Path,
        platform_targets: Dict[str, Tuple[int, int]],
        base_output_dir: Path
    ) -> Dict[str, Dict[str, Any]]:
        """
        Batch resize image for multiple platform-specific targets

        Args:
            source_image_path: Source image to process
            platform_targets: Dict mapping target names to (width, height) tuples
            base_output_dir: Base directory for outputs

        Returns:
            Dict mapping target names to processing results
        """
        results = {}

        print(f"[BATCH-RESIZE] Processing {len(platform_targets)} targets for: {source_image_path.name}")

        for target_name, target_size in platform_targets.items():
            output_path = base_output_dir / f"{target_name}_{target_size[0]}x{target_size[1]}.png"

            result = self.resize_and_crop_to_target(
                source_image_path=source_image_path,
                target_size=target_size,
                output_path=output_path
            )

            results[target_name] = result

        print(f"[BATCH-RESIZE] Completed {len(results)} targets")
        return results

    def validate_image_requirements(
        self,
        image_path: Path,
        required_size: Tuple[int, int],
        tolerance_percent: float = 5.0
    ) -> Dict[str, Any]:
        """
        Validate if image meets size requirements within tolerance

        Args:
            image_path: Path to image to validate
            required_size: Required size as (width, height)
            tolerance_percent: Allowed size difference percentage

        Returns:
            Dict containing validation results
        """
        try:
            with Image.open(image_path) as img:
                actual_size = img.size
                required_width, required_height = required_size
                actual_width, actual_height = actual_size

                width_diff_percent = abs(actual_width - required_width) / required_width * 100
                height_diff_percent = abs(actual_height - required_height) / required_height * 100

                is_valid = width_diff_percent <= tolerance_percent and height_diff_percent <= tolerance_percent

                return {
                    'valid': is_valid,
                    'actual_size': actual_size,
                    'required_size': required_size,
                    'width_diff_percent': width_diff_percent,
                    'height_diff_percent': height_diff_percent,
                    'tolerance_percent': tolerance_percent,
                    'needs_resize': not is_valid
                }

        except Exception as e:
            return {
                'valid': False,
                'error': str(e),
                'needs_resize': True
            }


def main():
    """Test function for SmartImageResizer"""
    print("[TEST] Smart Image Resizer - Standalone Test")

    resizer = SmartImageResizer()

    # Example test (would need actual image file)
    # test_image = Path("test_image.png")
    # if test_image.exists():
    #     result = resizer.resize_and_crop_to_target(
    #         test_image,
    #         (72, 72),
    #         Path("output_72x72.png")
    #     )
    #     print(f"Test result: {result}")

    print("[TEST] SmartImageResizer initialized successfully")


if __name__ == "__main__":
    main()