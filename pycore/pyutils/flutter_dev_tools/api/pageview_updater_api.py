"""
PageView Map Updater API - Update pageview_map.json with image analysis

Provides API endpoints for:
- Updating pageview_map.json with color palette and OCR data
- Analyzing images in specific layers (rough/detailed)
- Force re-analysis of all images
"""

from pathlib import Path
from typing import Dict, Any
import json

from pycore.pyfoundations.atomic_json_store import atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyutils.flutter_dev_tools.utils.pageview_updater import (
    update_pageview_map,
    cleanup_orphaned_entries,
    add_actual_image,
)


import tempfile


def update_app_pageview_map(
    app_path: Path,
    layer: str = "all",
    force: bool = False
) -> Dict[str, Any]:
    """
    Update pageview_map.json for an app

    Args:
        app_path: Path to app directory (e.g., lib/apps/app_wuy)
        layer: Which layer to update ("rough", "detailed", or "all")
        force: Force re-analysis even if already analyzed

    Returns:
        Result dict with success status and stats
    """
    design_docs_dir = app_path / "design_docs_and_progress"

    if not design_docs_dir.exists():
        return {
            "success": False,
            "error": f"Design docs directory not found: {design_docs_dir}"
        }

    app_name = app_path.name

    ColorPrint.plain(f"[PageViewUpdater] Updating pageview_map.json for: {app_name}")
    ColorPrint.plain(f"[PageViewUpdater] Layer: {layer}, Force: {force}")

    # Update pageview map
    updated_map = update_pageview_map(
        design_docs_dir,
        app_name,
        force_reanalyze=force
    )

    # Cleanup orphaned entries
    removed_count = cleanup_orphaned_entries(updated_map, design_docs_dir)

    # Save if there were orphaned entries
    if removed_count > 0:
        atomic_write_json(design_docs_dir / "pageview_map.json", updated_map)

    # Collect stats
    total_pages = len(updated_map.get("pages", {}))
    total_images = sum(
        len(page.get("images", []))
        for page in updated_map.get("pages", {}).values()
    )

    return {
        "success": True,
        "app_name": app_name,
        "stats": {
            "total_pages": total_pages,
            "total_images": total_images,
            "removed_orphans": removed_count
        },
        "pageview_map_path": str(design_docs_dir / "pageview_map.json")
    }


def upload_actual_image(
    app_path: Path,
    page_key: str,
    description: str,
    image_data: bytes
) -> Dict[str, Any]:
    """
    Upload an actual/composite image for comparison

    Args:
        app_path: Path to app directory
        page_key: Page key (e.g., "home_page")
        description: Description of composite (e.g., "implemented", "v1_test")
        image_data: Binary image data

    Returns:
        Result dict with success status
    """
    design_docs_dir = app_path / "design_docs_and_progress"
    pageview_map_path = design_docs_dir / "pageview_map.json"

    if not design_docs_dir.exists():
        return {
            "success": False,
            "error": f"Design docs directory not found: {design_docs_dir}"
        }

    app_name = app_path.name

    # Load existing pageview map
    if pageview_map_path.exists():
        with open(pageview_map_path, 'r', encoding='utf-8') as f:
            pageview_map = json.load(f)
    else:
        return {
            "success": False,
            "error": "pageview_map.json not found"
        }

    # Create temporary file for image
    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix='.png',
        dir=str(TMP_DIR),
    ) as temp_file:
        temp_file.write(image_data)
        temp_path = Path(temp_file.name)

    # Add actual image
    result = add_actual_image(
        pageview_map,
        design_docs_dir,
        app_name,
        page_key,
        description,
        temp_path,
        analyze=True
    )

    # Clean up temp file
    temp_path.unlink()

    atomic_write_json(pageview_map_path, pageview_map)

    return result


def get_pageview_map_stats(app_path: Path) -> Dict[str, Any]:
    """
    Get statistics about current pageview_map.json

    Args:
        app_path: Path to app directory

    Returns:
        Stats dict
    """
    design_docs_dir = app_path / "design_docs_and_progress"
    pageview_map_path = design_docs_dir / "pageview_map.json"

    if not pageview_map_path.exists():
        return {
            "success": False,
            "error": "pageview_map.json not found"
        }

    with open(pageview_map_path, 'r', encoding='utf-8') as f:
        pageview_map = json.load(f)

    pages = pageview_map.get("pages", {})
    total_pages = len(pages)
    total_expected = 0
    total_actual = 0
    analyzed_images = 0

    for page in pages.values():
        # Count expected images
        expected_images = page.get("expected_images", [])
        total_expected += len(expected_images)

        for img in expected_images:
            if img.get("color_palette") and img.get("ocr_text"):
                analyzed_images += 1

        # Count actual images
        actual_images = page.get("actual_images", [])
        total_actual += len(actual_images)

        for img in actual_images:
            if img.get("color_palette") and img.get("ocr_text"):
                analyzed_images += 1

    total_images = total_expected + total_actual

    return {
        "success": True,
        "version": pageview_map.get("version", "unknown"),
        "app_name": pageview_map.get("app_name", ""),
        "last_updated": pageview_map.get("last_updated", ""),
        "stats": {
            "total_pages": total_pages,
            "total_images": total_images,
            "expected_images": total_expected,
            "actual_images": total_actual,
            "analyzed_images": analyzed_images,
            "analysis_completion": round(analyzed_images / total_images * 100, 1) if total_images > 0 else 0
        }
    }


__all__ = ['update_app_pageview_map', 'upload_actual_image', 'get_pageview_map_stats']
