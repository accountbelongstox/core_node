#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from PIL import Image
import pycore.pyutils.ocr_cluster.ocr.ocr_manager as ocr_manager
import sys
"""
Image Analyzer - Color Analysis + OCR Integration

Provides:
- Color palette extraction (top 10 colors by frequency)
- OCR text extraction with positions
- Batch processing for design documentation
"""

from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
from collections import Counter
import json

# Try importing PIL for color analysis
try:
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("[WARNING] PIL not available, color analysis disabled")

# Import OCR manager from pycore
try:
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("[WARNING] OCR manager not available, text recognition disabled")


def rgb_to_hex(rgb: Tuple[int, int, int]) -> str:
    """Convert RGB tuple to hex color string"""
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def analyze_image_colors(
    image_path: Path,
    top_n: int = 10,
    resize_to: int = 200
) -> List[List[Any]]:
    """
    Analyze image colors and return top N colors by frequency

    Args:
        image_path: Path to image file
        top_n: Number of top colors to return (default 10)
        resize_to: Resize image to this width for faster processing (default 200)

    Returns:
        List of [color_hex, ratio] sorted by ratio descending
        Example: [["#FFFFFF", 0.35], ["#000000", 0.25], ...]
    """
    if not PIL_AVAILABLE:
        print(f"[SKIP] PIL not available, cannot analyze colors for: {image_path}")
        return []

    if not image_path.exists():
        print(f"[ERROR] Image not found: {image_path}")
        return []

    try:
        # Open and convert image to RGB
        img = Image.open(image_path)

        # Convert to RGB (handle RGBA, grayscale, etc.)
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # Resize for faster processing
        original_size = img.size
        aspect_ratio = img.height / img.width
        new_size = (resize_to, int(resize_to * aspect_ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

        # Get all pixels
        pixels = list(img.getdata())
        total_pixels = len(pixels)

        # Count color frequencies
        color_counts = Counter(pixels)

        # Get top N colors
        top_colors = color_counts.most_common(top_n)

        # Convert to [hex, ratio] format
        result = []
        for color_rgb, count in top_colors:
            hex_color = rgb_to_hex(color_rgb)
            ratio = round(count / total_pixels, 4)  # 4 decimal places
            result.append([hex_color, ratio])

        print(f"[SUCCESS] Analyzed colors for: {image_path.name} (found {len(result)} colors)")
        return result

    except Exception as e:
        print(f"[ERROR] Failed to analyze colors for {image_path}: {e}")
        return []


def analyze_image_ocr(
    image_path: Path,
    model_type: str = "scene"
) -> Dict[str, Any]:
    """
    Extract text from image using OCR

    Args:
        image_path: Path to image file
        model_type: OCR model type (scene/doc/general/etc.)

    Returns:
        Dict with OCR results:
        {
            "success": bool,
            "text": str,  # Full text
            "words": [    # Individual words with positions
                {
                    "text": str,
                    "position": [x, y, w, h],  # Bounding box
                    "confidence": float
                }
            ]
        }
    """
    if not OCR_AVAILABLE:
        print(f"[SKIP] OCR not available, cannot extract text from: {image_path}")
        return {
            "success": False,
            "text": "",
            "words": [],
            "error": "OCR module not available"
        }

    if not image_path.exists():
        print(f"[ERROR] Image not found: {image_path}")
        return {
            "success": False,
            "text": "",
            "words": [],
            "error": f"Image not found: {image_path}"
        }

    try:
        # Use OCR manager to recognize text
        result = ocr_manager.recognize_image(
            str(image_path),
            model_type=model_type,
            return_json=False
        )

        # Extract relevant information
        ocr_result = {
            "success": result.get("success", False),
            "text": result.get("text", ""),
            "words": []
        }

        # Parse words with positions
        words_data = result.get("words", [])
        for word_info in words_data:
            # Expected format from CnOCR:
            # {"text": str, "position": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]], "score": float}

            text = word_info.get("text", "")
            position = word_info.get("position", [])
            score = word_info.get("score", 0.0)

            # Convert position to [x, y, w, h] format
            if position and len(position) >= 4:
                # position is [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] (4 corners)
                xs = [p[0] for p in position]
                ys = [p[1] for p in position]
                x = min(xs)
                y = min(ys)
                w = max(xs) - x
                h = max(ys) - y
                bbox = [int(x), int(y), int(w), int(h)]
            else:
                bbox = [0, 0, 0, 0]

            ocr_result["words"].append({
                "text": text,
                "position": bbox,
                "confidence": round(score, 4)
            })

        if ocr_result["success"]:
            print(f"[SUCCESS] OCR extracted {len(ocr_result['words'])} words from: {image_path.name}")
        else:
            print(f"[WARNING] OCR failed for: {image_path.name}")

        return ocr_result

    except Exception as e:
        print(f"[ERROR] Failed to perform OCR on {image_path}: {e}")
        return {
            "success": False,
            "text": "",
            "words": [],
            "error": str(e)
        }


def analyze_image_full(
    image_path: Path,
    include_colors: bool = True,
    include_ocr: bool = True,
    color_top_n: int = 10,
    ocr_model: str = "scene"
) -> Dict[str, Any]:
    """
    Perform full image analysis (colors + OCR)

    Args:
        image_path: Path to image file
        include_colors: Whether to analyze colors
        include_ocr: Whether to perform OCR
        color_top_n: Number of top colors to extract
        ocr_model: OCR model type

    Returns:
        Dict with full analysis:
        {
            "image_path": str,
            "image_name": str,
            "colors": [[hex, ratio], ...],  # Top N colors
            "ocr": {
                "success": bool,
                "text": str,
                "words": [{"text": str, "position": [x,y,w,h], "confidence": float}]
            }
        }
    """
    result = {
        "image_path": str(image_path),
        "image_name": image_path.name,
        "colors": [],
        "ocr": {
            "success": False,
            "text": "",
            "words": []
        }
    }

    # Analyze colors
    if include_colors:
        result["colors"] = analyze_image_colors(image_path, top_n=color_top_n)

    # Perform OCR
    if include_ocr:
        result["ocr"] = analyze_image_ocr(image_path, model_type=ocr_model)

    return result


def analyze_directory_images(
    directory: Path,
    include_colors: bool = True,
    include_ocr: bool = True,
    color_top_n: int = 10,
    ocr_model: str = "scene"
) -> List[Dict[str, Any]]:
    """
    Analyze all images in a directory

    Args:
        directory: Directory containing images
        include_colors: Whether to analyze colors
        include_ocr: Whether to perform OCR
        color_top_n: Number of top colors to extract
        ocr_model: OCR model type

    Returns:
        List of analysis results for each image
    """
    if not directory.exists() or not directory.is_dir():
        print(f"[ERROR] Directory not found: {directory}")
        return []

    # Supported image formats
    image_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}

    # Find all images
    image_files = [
        f for f in directory.iterdir()
        if f.is_file() and f.suffix.lower() in image_extensions
    ]

    if not image_files:
        print(f"[WARNING] No images found in: {directory}")
        return []

    print(f"[INFO] Found {len(image_files)} images in: {directory}")

    # Analyze each image
    results = []
    for image_file in image_files:
        print(f"[PROCESSING] {image_file.name}...")
        analysis = analyze_image_full(
            image_file,
            include_colors=include_colors,
            include_ocr=include_ocr,
            color_top_n=color_top_n,
            ocr_model=ocr_model
        )
        results.append(analysis)

    print(f"[DONE] Analyzed {len(results)} images")
    return results


# ============================================================
# CLI Interface
# ============================================================

if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python image_analyzer.py <image_path>          # Analyze single image")
        print("  python image_analyzer.py <directory_path>      # Analyze all images in directory")
        print("\nExample:")
        print("  python image_analyzer.py design_docs_and_progress/2_page_designs_rough/images/")
        sys.exit(1)

    target = Path(sys.argv[1])

    if target.is_file():
        # Analyze single image
        result = analyze_image_full(target)
        print("\n" + "="*60)
        print(json.dumps(result, indent=2, ensure_ascii=False))

    elif target.is_dir():
        # Analyze directory
        results = analyze_directory_images(target)
        print("\n" + "="*60)
        print(json.dumps(results, indent=2, ensure_ascii=False))

    else:
        print(f"[ERROR] Invalid path: {target}")
        sys.exit(1)
