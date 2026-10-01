#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comparison API - Handle comparison image creation, listing, and downloading
"""

from pathlib import Path
from typing import Dict, Any

from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.flutter_dev_tools.utils.comparison_manager import (
    get_comparison_base_dir,
    list_comparison_images,
    save_comparison_for_page,
)

def create_comparison(
    app_path: Path,
    page_key: str,
    expected_image_path: str,
    actual_image_data: bytes,
    description: str = "implemented"
) -> Dict[str, Any]:
    """
    Create comparison image from expected and actual images

    Args:
        app_path: Path to app directory
        page_key: Page key (e.g., "home_page")
        expected_image_path: Absolute path to expected design image
        actual_image_data: Binary data of actual/uploaded image
        description: Description for filename (default: "implemented")

    Returns:
        Result dict with success status, filename, download_url, etc.
    """
    app_name = app_path.name

    # Save uploaded actual image to temporary location
    temp_dir = TMP_DIR / "flutter_dev_tools"
    temp_dir.mkdir(parents=True, exist_ok=True)

    temp_actual_path = temp_dir / "temp_uploaded_actual.png"
    temp_actual_path.write_bytes(actual_image_data)

    # Verify expected image exists
    expected_path = Path(expected_image_path)
    if not expected_path.exists():
        return {
            "success": False,
            "error": f"Expected image not found: {expected_image_path}"
        }

    # Create comparison image
    result = save_comparison_for_page(
        app_name=app_name,
        page_key=page_key,
        expected_image=expected_path,
        actual_image=temp_actual_path,
        description=description
    )

    # Clean up temp file
    if temp_actual_path.exists():
        temp_actual_path.unlink()

    return result


def list_comparisons(app_path: Path, page_key: str) -> Dict[str, Any]:
    """
    List all comparison images for a page

    Args:
        app_path: Path to app directory
        page_key: Page key

    Returns:
        Result dict with success status and comparisons list
    """
    app_name = app_path.name
    comparisons = list_comparison_images(app_name, page_key)

    return {
        "success": True,
        "comparisons": comparisons
    }


def get_comparison_file_path(app_name: str, page_key: str, filename: str) -> Path:
    """
    Get full file path for comparison image

    Args:
        app_name: Application name
        page_key: Page key
        filename: Comparison filename

    Returns:
        Path to comparison file
    """
    comp_dir = get_comparison_base_dir(app_name)
    page_dir = comp_dir / page_key
    file_path = page_dir / filename

    if not file_path.exists():
        return None

    return file_path


__all__ = [
    'create_comparison',
    'list_comparisons',
    'get_comparison_file_path'
]
