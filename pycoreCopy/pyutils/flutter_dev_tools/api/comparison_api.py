#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comparison API - Handle comparison image creation, listing, and downloading
"""

from pathlib import Path
from typing import Dict, Any
import base64

# Import comparison manager
try:
    from pycore.pyutils.flutter_dev_tools.utils.comparison_manager import (
        get_comparison_base_dir,
        save_comparison_for_page,
        list_comparison_images
    )
    COMPARISON_AVAILABLE = True
except ImportError:
    COMPARISON_AVAILABLE = False
    print("[WARNING] comparison_manager not available")


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
    if not COMPARISON_AVAILABLE:
        return {
            "success": False,
            "error": "Comparison manager not available"
        }

    try:
        app_name = app_path.name

        # Save uploaded actual image to temporary location
        design_docs_dir = app_path / "design_docs_and_progress"
        temp_dir = design_docs_dir / "temp"
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

    except Exception as e:
        print(f"[ERROR] Failed to create comparison: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }


def list_comparisons(app_path: Path, page_key: str) -> Dict[str, Any]:
    """
    List all comparison images for a page

    Args:
        app_path: Path to app directory
        page_key: Page key

    Returns:
        Result dict with success status and comparisons list
    """
    if not COMPARISON_AVAILABLE:
        return {
            "success": False,
            "error": "Comparison manager not available"
        }

    try:
        app_name = app_path.name
        comparisons = list_comparison_images(app_name, page_key)

        return {
            "success": True,
            "comparisons": comparisons
        }

    except Exception as e:
        print(f"[ERROR] Failed to list comparisons: {e}")
        return {
            "success": False,
            "error": str(e)
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
    if not COMPARISON_AVAILABLE:
        return None

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
