#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comparison Image Manager - Generate side-by-side comparison images

Features:
- Create composite images (expected left, actual right)
- Auto-resize to match height, pad width with white
- Add text labels at top ("Expected Design" vs "Actual Implementation")
- Store in external directory mapped via system_paths
"""

from pathlib import Path
from typing import Dict, Any, Tuple
from datetime import datetime

# Import PIL for image manipulation
try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("[WARNING] PIL not available, comparison image generation disabled")

# Import system paths
try:
    from pycore.pyfoundations.system_paths import map_web_path
    SYSTEM_PATHS_AVAILABLE = True
except ImportError:
    SYSTEM_PATHS_AVAILABLE = False
    print("[WARNING] system_paths not available, using local directory")


def get_comparison_base_dir(app_name: str) -> Path:
    """
    Get base directory for comparison images

    Uses: D:\programing\_build_dir\flutter_main\{appname}\comparison_images

    Args:
        app_name: Application name

    Returns:
        Path to comparison directory
    """
    if SYSTEM_PATHS_AVAILABLE:
        # Use system_paths to get programing directory
        programing_dir = map_web_path("programing")
        build_dir = programing_dir / "_build_dir" / "flutter_main" / app_name / "comparison_images"
    else:
        # Fallback to local directory
        build_dir = Path("comparisons") / app_name

    build_dir.mkdir(parents=True, exist_ok=True)
    return build_dir


def create_comparison_image(
    expected_image_path: Path,
    actual_image_path: Path,
    output_path: Path,
    label_expected: str = "Expected Design",
    label_actual: str = "Actual Implementation"
) -> Dict[str, Any]:
    """
    Create side-by-side comparison image

    Args:
        expected_image_path: Path to expected design image
        actual_image_path: Path to actual/uploaded image
        output_path: Path to save composite image
        label_expected: Label for expected image (left side)
        label_actual: Label for actual image (right side)

    Returns:
        Result dict with success status and dimensions
    """
    if not PIL_AVAILABLE:
        return {
            "success": False,
            "error": "PIL not available"
        }

    try:
        # Load images
        img_expected = Image.open(expected_image_path)
        img_actual = Image.open(actual_image_path)

        # Convert to RGB if needed
        if img_expected.mode != 'RGB':
            img_expected = img_expected.convert('RGB')
        if img_actual.mode != 'RGB':
            img_actual = img_actual.convert('RGB')

        # Calculate dimensions
        # Match height, scale width proportionally
        target_height = max(img_expected.height, img_actual.height)

        # Resize expected to target height
        if img_expected.height != target_height:
            scale_ratio = target_height / img_expected.height
            new_width = int(img_expected.width * scale_ratio)
            img_expected = img_expected.resize((new_width, target_height), Image.Resampling.LANCZOS)

        # Resize actual to target height
        if img_actual.height != target_height:
            scale_ratio = target_height / img_actual.height
            new_width = int(img_actual.width * scale_ratio)
            img_actual = img_actual.resize((new_width, target_height), Image.Resampling.LANCZOS)

        # Calculate total dimensions
        label_height = 80  # Space for text labels at top
        total_width = img_expected.width + img_actual.width
        total_height = target_height + label_height

        # Create composite canvas (white background)
        composite = Image.new('RGB', (total_width, total_height), color='white')
        draw = ImageDraw.Draw(composite)

        # Try to load font
        try:
            font_large = ImageFont.truetype("arial.ttf", 32)
            font_small = ImageFont.truetype("arial.ttf", 24)
        except:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()

        # Draw labels at top
        # Left label (Expected)
        left_label_text = label_expected
        left_bbox = draw.textbbox((0, 0), left_label_text, font=font_large)
        left_text_width = left_bbox[2] - left_bbox[0]
        left_x = (img_expected.width - left_text_width) // 2
        draw.text((left_x, 20), left_label_text, fill='#2563eb', font=font_large)

        # Right label (Actual)
        right_label_text = label_actual
        right_bbox = draw.textbbox((0, 0), right_label_text, font=font_large)
        right_text_width = right_bbox[2] - right_bbox[0]
        right_x = img_expected.width + (img_actual.width - right_text_width) // 2
        draw.text((right_x, 20), right_label_text, fill='#dc2626', font=font_large)

        # Draw vertical separator line
        separator_x = img_expected.width
        draw.line([(separator_x, label_height), (separator_x, total_height)], fill='#d1d5db', width=2)

        # Paste images below labels
        composite.paste(img_expected, (0, label_height))
        composite.paste(img_actual, (img_expected.width, label_height))

        # Save composite
        output_path.parent.mkdir(parents=True, exist_ok=True)
        composite.save(output_path, 'PNG')

        print(f"[SUCCESS] Created comparison image: {output_path}")

        return {
            "success": True,
            "output_path": str(output_path),
            "dimensions": {
                "width": total_width,
                "height": total_height,
                "expected_width": img_expected.width,
                "actual_width": img_actual.width,
                "target_height": target_height
            }
        }

    except Exception as e:
        print(f"[ERROR] Failed to create comparison image: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def save_comparison_for_page(
    app_name: str,
    page_key: str,
    expected_image: Path,
    actual_image: Path,
    description: str = "comparison"
) -> Dict[str, Any]:
    """
    Save comparison image to external directory

    Args:
        app_name: Application name
        page_key: Page key (e.g., "home_page")
        expected_image: Path to expected design image
        actual_image: Path to actual image
        description: Description for filename

    Returns:
        Result dict with file path and URL
    """
    # Get comparison base directory
    comp_dir = get_comparison_base_dir(app_name)
    page_dir = comp_dir / page_key
    page_dir.mkdir(parents=True, exist_ok=True)

    # Generate filename: {appname}_{pagename}_{description}_{timestamp}_comparison.png
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename = f"{app_name}_{page_key}_{description}_{timestamp}_comparison.png"
    output_path = page_dir / filename

    # Create comparison image
    result = create_comparison_image(
        expected_image,
        actual_image,
        output_path,
        label_expected="Expected Design",
        label_actual="Actual Implementation"
    )

    if result["success"]:
        result["filename"] = filename
        result["relative_path"] = f"{page_key}/{filename}"
        result["download_url"] = f"/api/comparison/download/{app_name}/{page_key}/{filename}"

    return result


def list_comparison_images(app_name: str, page_key: str) -> list:
    """
    List all comparison images for a page

    Args:
        app_name: Application name
        page_key: Page key

    Returns:
        List of comparison image info dicts (newest first)
    """
    comp_dir = get_comparison_base_dir(app_name)
    page_dir = comp_dir / page_key

    if not page_dir.exists():
        return []

    comparisons = []
    for img_file in page_dir.glob("*_comparison.png"):
        comparisons.append({
            "filename": img_file.name,
            "relative_path": f"{page_key}/{img_file.name}",
            "full_path": str(img_file),
            "download_url": f"/api/comparison/download/{app_name}/{page_key}/{img_file.name}",
            "created_at": datetime.fromtimestamp(img_file.stat().st_mtime).isoformat()
        })

    # Sort by created_at descending (newest first)
    comparisons.sort(key=lambda x: x["created_at"], reverse=True)

    return comparisons


__all__ = [
    'get_comparison_base_dir',
    'create_comparison_image',
    'save_comparison_for_page',
    'list_comparison_images'
]
