#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PageView Map Updater - Auto-update pageview_map.json with image analysis

Features:
- Single pageview_map.json per app (not per page)
- Auto color palette extraction (top 10 colors)
- Auto OCR text extraction with positions
- Incremental updates (only update changed images)
- Clean up meaningless fields
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Import image analyzer
from .image_analyzer import analyze_image_full


# ============================================================
# PageView Map Structure
# ============================================================

def get_empty_pageview_map() -> Dict[str, Any]:
    """
    Get empty pageview_map.json template

    Structure:
    {
        "version": "2.0",
        "app_name": "app_xxx",
        "last_updated": "2025-11-19T12:00:00",
        "pages": {
            "home_page": {
                "page_key": "home_page",
                "layer": "rough" | "detailed",
                "images": [
                    {
                        "file_name": "home_v1.png",
                        "file_path": "2_page_designs_rough/images/home_v1.png",
                        "color_palette": [
                            ["#FFFFFF", 0.35],
                            ["#000000", 0.25],
                            ...  // Top 10 colors
                        ],
                        "ocr_text": [
                            {
                                "text": "Welcome",
                                "position": [x, y, w, h],
                                "confidence": 0.95
                            }
                        ],
                        "last_analyzed": "2025-11-19T12:00:00"
                    }
                ]
            }
        }
    }
    """
    return {
        "version": "2.0",
        "app_name": "",
        "last_updated": datetime.now().isoformat(),
        "pages": {}
    }


def create_page_entry(
    page_key: str,
    layer: str = "rough"
) -> Dict[str, Any]:
    """
    Create empty page entry

    Args:
        page_key: Page identifier (e.g., "home_page")
        layer: Design layer ("rough" or "detailed")

    Returns:
        Empty page entry dict
    """
    return {
        "page_key": page_key,
        "layer": layer,
        "expected_images": [],  # Design images (from 2_page_designs_rough / 3_page_designs_detailed)
        "actual_images": [],    # Actual/composite images (AI-generated or screenshots)
        "comparison_notes": ""  # Notes for AI to adjust based on expected vs actual
    }


def create_image_entry(
    file_name: str,
    file_path: str,
    color_palette: List[List[Any]] = None,
    ocr_text: List[Dict[str, Any]] = None,
    is_expected: bool = True
) -> Dict[str, Any]:
    """
    Create image entry with analysis data

    Args:
        file_name: Image file name
        file_path: Relative path from design_docs_and_progress root
        color_palette: Top 10 colors [[hex, ratio], ...]
        ocr_text: OCR results [{"text": str, "position": [x,y,w,h], "confidence": float}]
        is_expected: True if this is expected design image, False if actual/composite

    Returns:
        Image entry dict
    """
    return {
        "file_name": file_name,
        "file_path": file_path,
        "image_type": "expected" if is_expected else "actual",
        "download_url": f"/api/file/download?path={file_path}",
        "color_palette": color_palette or [],
        "ocr_text": ocr_text or [],
        "last_analyzed": datetime.now().isoformat()
    }


# ============================================================
# Update Functions
# ============================================================

def update_image_analysis(
    image_entry: Dict[str, Any],
    image_full_path: Path,
    force: bool = False
) -> bool:
    """
    Update image analysis data (colors + OCR)

    Args:
        image_entry: Existing image entry dict
        image_full_path: Full path to image file
        force: Force re-analysis even if already analyzed

    Returns:
        True if updated, False if skipped
    """
    # Skip if already analyzed recently (unless force=True)
    if not force and image_entry.get("last_analyzed") and image_entry.get("color_palette"):
        # Already analyzed and has data
        return False

    # Perform full analysis
    analysis = analyze_image_full(
        image_full_path,
        include_colors=True,
        include_ocr=True,
        color_top_n=10,
        ocr_model="scene"
    )

    # Update entry
    image_entry["color_palette"] = analysis.get("colors", [])

    ocr_data = analysis.get("ocr", {})
    image_entry["ocr_text"] = ocr_data.get("words", [])

    image_entry["last_analyzed"] = datetime.now().isoformat()

    return True


def scan_layer_images(
    layer_path: Path,
    layer_name: str
) -> List[Dict[str, Any]]:
    """
    Scan images in a design layer directory

    Args:
        layer_path: Path to layer directory (e.g., 2_page_designs_rough)
        layer_name: Layer identifier ("rough" or "detailed")

    Returns:
        List of discovered images with metadata
    """
    discovered_images = []

    # Supported formats
    image_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}

    # For rough layer: images are in layer_path/images/
    # For detailed layer: images are in layer_path/{page_name}/images/

    if layer_name == "rough":
        # Scan images/ subdirectory
        images_dir = layer_path / "images"
        if images_dir.exists():
            for img_file in images_dir.iterdir():
                if img_file.is_file() and img_file.suffix.lower() in image_extensions:
                    # Infer page key from filename (e.g., "home_v1.png" -> "home")
                    page_key = img_file.stem.split('_')[0] if '_' in img_file.stem else img_file.stem

                    discovered_images.append({
                        "file_name": img_file.name,
                        "file_path": f"{layer_path.name}/images/{img_file.name}",
                        "full_path": img_file,
                        "page_key": page_key,
                        "layer": "rough"
                    })

    elif layer_name == "detailed":
        # Scan each page subdirectory
        for page_dir in layer_path.iterdir():
            if not page_dir.is_dir():
                continue

            page_key = page_dir.name  # e.g., "home_page"
            images_dir = page_dir / "images"

            if images_dir.exists():
                for img_file in images_dir.iterdir():
                    if img_file.is_file() and img_file.suffix.lower() in image_extensions:
                        discovered_images.append({
                            "file_name": img_file.name,
                            "file_path": f"{layer_path.name}/{page_key}/images/{img_file.name}",
                            "full_path": img_file,
                            "page_key": page_key,
                            "layer": "detailed"
                        })

    return discovered_images


def update_pageview_map(
    design_docs_root: Path,
    app_name: str,
    force_reanalyze: bool = False
) -> Dict[str, Any]:
    """
    Update pageview_map.json for an app

    Args:
        design_docs_root: Path to design_docs_and_progress directory
        app_name: Application name
        force_reanalyze: Force re-analysis of all images

    Returns:
        Updated pageview map dict
    """
    pageview_map_path = design_docs_root / "pageview_map.json"

    # Load existing or create new
    if pageview_map_path.exists():
        with open(pageview_map_path, 'r', encoding='utf-8') as f:
            pageview_map = json.load(f)
    else:
        pageview_map = get_empty_pageview_map()
        pageview_map["app_name"] = app_name

    # Ensure version 2.0
    pageview_map["version"] = "2.0"
    pageview_map["last_updated"] = datetime.now().isoformat()

    # Scan rough layer
    rough_layer = design_docs_root / "2_page_designs_rough"
    rough_images = scan_layer_images(rough_layer, "rough")

    # Scan detailed layer
    detailed_layer = design_docs_root / "3_page_designs_detailed"
    detailed_images = scan_layer_images(detailed_layer, "detailed")

    # Merge all discovered images
    all_images = rough_images + detailed_images

    print(f"[INFO] Found {len(all_images)} images ({len(rough_images)} rough + {len(detailed_images)} detailed)")

    # Update pageview map
    updated_count = 0

    for img_info in all_images:
        page_key = img_info["page_key"]
        layer = img_info["layer"]
        file_name = img_info["file_name"]
        file_path = img_info["file_path"]
        full_path = img_info["full_path"]

        # Ensure page entry exists
        if page_key not in pageview_map["pages"]:
            pageview_map["pages"][page_key] = create_page_entry(page_key, layer)

        # Find or create image entry in expected_images
        page_entry = pageview_map["pages"][page_key]

        # Migrate old structure (images -> expected_images)
        if "images" in page_entry and not isinstance(page_entry.get("expected_images"), list):
            page_entry["expected_images"] = page_entry.pop("images", [])
        if "expected_images" not in page_entry:
            page_entry["expected_images"] = []
        if "actual_images" not in page_entry:
            page_entry["actual_images"] = []
        if "comparison_notes" not in page_entry:
            page_entry["comparison_notes"] = ""

        image_entry = None

        for img in page_entry["expected_images"]:
            if img["file_name"] == file_name:
                image_entry = img
                break

        if image_entry is None:
            # Create new expected image entry
            image_entry = create_image_entry(file_name, file_path, is_expected=True)
            page_entry["expected_images"].append(image_entry)

        # Update analysis
        if update_image_analysis(image_entry, full_path, force=force_reanalyze):
            updated_count += 1
            print(f"[UPDATED] {page_key}/{file_name}")

    # Save updated map
    with open(pageview_map_path, 'w', encoding='utf-8') as f:
        json.dump(pageview_map, f, indent=2, ensure_ascii=False)

    print(f"[SUCCESS] Updated {updated_count} images in pageview_map.json")
    return pageview_map


def add_actual_image(
    pageview_map: Dict[str, Any],
    design_docs_root: Path,
    app_name: str,
    page_key: str,
    description: str,
    image_file: Path,
    analyze: bool = True
) -> Dict[str, Any]:
    """
    Add an actual/composite image to pageview_map

    Args:
        pageview_map: PageView map dict
        design_docs_root: Path to design_docs_and_progress
        app_name: Application name (e.g., "app_wuy")
        page_key: Page key (e.g., "home_page")
        description: Description of the composite (e.g., "implemented", "v1_test")
        image_file: Path to actual image file
        analyze: Whether to analyze the image

    Returns:
        Result dict with success status
    """
    # Generate composite filename: {appname}_{pagename}_{description}_{timestamp}.png
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    composite_filename = f"{app_name}_{page_key}_{description}_{timestamp}.png"

    # Create composites directory
    composites_dir = design_docs_root / "composites" / page_key
    composites_dir.mkdir(parents=True, exist_ok=True)

    # Copy image to composites directory
    composite_path = composites_dir / composite_filename
    import shutil
    shutil.copy2(image_file, composite_path)

    # Create relative path
    relative_path = f"composites/{page_key}/{composite_filename}"

    # Ensure page entry exists
    if page_key not in pageview_map["pages"]:
        pageview_map["pages"][page_key] = create_page_entry(page_key)

    page_entry = pageview_map["pages"][page_key]

    # Ensure actual_images list exists
    if "actual_images" not in page_entry:
        page_entry["actual_images"] = []

    # Create actual image entry
    actual_entry = create_image_entry(
        composite_filename,
        relative_path,
        is_expected=False
    )

    # Add description
    actual_entry["description"] = description
    actual_entry["uploaded_at"] = datetime.now().isoformat()

    # Analyze if requested
    if analyze:
        update_image_analysis(actual_entry, composite_path, force=True)

    # Add to actual_images list (prepend to keep newest first)
    page_entry["actual_images"].insert(0, actual_entry)

    print(f"[ADDED] Actual image: {relative_path}")

    return {
        "success": True,
        "file_name": composite_filename,
        "file_path": str(composite_path),
        "relative_path": relative_path
    }


def cleanup_orphaned_entries(
    pageview_map: Dict[str, Any],
    design_docs_root: Path
) -> int:
    """
    Remove entries for images that no longer exist

    Args:
        pageview_map: PageView map dict
        design_docs_root: Path to design_docs_and_progress

    Returns:
        Number of entries removed
    """
    removed_count = 0

    for page_key in list(pageview_map["pages"].keys()):
        page_entry = pageview_map["pages"][page_key]

        # Check expected images
        if "expected_images" in page_entry:
            for img_entry in list(page_entry["expected_images"]):
                file_path = design_docs_root / img_entry["file_path"]

                if not file_path.exists():
                    # Remove orphaned entry
                    page_entry["expected_images"].remove(img_entry)
                    removed_count += 1
                    print(f"[REMOVED] Orphaned expected image: {img_entry['file_path']}")

        # Check actual images
        if "actual_images" in page_entry:
            for img_entry in list(page_entry["actual_images"]):
                file_path = design_docs_root / img_entry["file_path"]

                if not file_path.exists():
                    # Remove orphaned entry
                    page_entry["actual_images"].remove(img_entry)
                    removed_count += 1
                    print(f"[REMOVED] Orphaned actual image: {img_entry['file_path']}")

        # Remove empty pages (no expected or actual images)
        if (not page_entry.get("expected_images") and
            not page_entry.get("actual_images")):
            del pageview_map["pages"][page_key]
            print(f"[REMOVED] Empty page: {page_key}")

    return removed_count


# ============================================================
# CLI Interface
# ============================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python pageview_updater.py <design_docs_path> [--force]")
        print("\nExample:")
        print("  python pageview_updater.py lib/apps/app_wuy/design_docs_and_progress")
        print("  python pageview_updater.py lib/apps/app_wuy/design_docs_and_progress --force")
        sys.exit(1)

    design_docs_path = Path(sys.argv[1])
    force_reanalyze = "--force" in sys.argv

    if not design_docs_path.exists():
        print(f"[ERROR] Directory not found: {design_docs_path}")
        sys.exit(1)

    # Infer app name from path
    app_name = design_docs_path.parent.name

    print(f"[INFO] Updating pageview_map.json for: {app_name}")
    print(f"[INFO] Design docs root: {design_docs_path}")
    print(f"[INFO] Force reanalyze: {force_reanalyze}")
    print("="*60)

    # Update pageview map
    updated_map = update_pageview_map(
        design_docs_path,
        app_name,
        force_reanalyze=force_reanalyze
    )

    # Cleanup orphaned entries
    removed = cleanup_orphaned_entries(updated_map, design_docs_path)
    if removed > 0:
        # Save again after cleanup
        pageview_map_path = design_docs_path / "pageview_map.json"
        with open(pageview_map_path, 'w', encoding='utf-8') as f:
            json.dump(updated_map, f, indent=2, ensure_ascii=False)
        print(f"[CLEANUP] Removed {removed} orphaned entries")

    print("="*60)
    print(f"[DONE] PageView map updated: {design_docs_path / 'pageview_map.json'}")
