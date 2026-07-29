#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image pixel analysis for the File Processor MCP Server.

Extracted from main.py. analyze_image_pixels is a plain function (registered as
an MCP tool by server.py) with inline region/sampling/merge helpers. Kept
separate from image_tools.py (which is already >800 lines and holds only
image-manip operations, not pixel analysis).
"""

import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import csv

from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image
from pycore.pyfoundations.third_party.api import get_third_package_numpy

from collections import Counter




logger = logging.getLogger(__name__)


def analyze_image_pixels(
    image_path: str,
    region: str = "full",
    regions: Optional[List[str]] = None,
    deduplicate: bool = True,
    sample_size: int = 1000,
    sampling_strategy: str = "random",
    output_format: str = "hex",
    include_coordinates: bool = False,
    include_frequency: bool = True,
    color_tolerance: int = 0,
    max_dimension: Optional[int] = None,
    export_to_file: bool = True,
    export_path: Optional[str] = None,
    export_format: str = "json",
    export_filename: Optional[str] = None,
    return_inline_data: bool = False
) -> Dict[str, Any]:
    """
    Advanced image pixel analysis with customizable export options for AI workflows.

    IMPORTANT FOR AI: This function exports pixel data to files by default.
    DO NOT read pixel arrays token by token! Instead, use the Read tool to read the exported file.
    The response provides a file path - use it to efficiently access all pixel data at once.

    Export Format Guide:
    - "json": Full structured data with metadata (read with json.load())
    - "json-compact": Smaller JSON file without indentation
    - "csv": Simple spreadsheet format - columns: hex, r, g, b (or x, y, hex, r, g, b)
    - "txt": Human-readable plain text format
    - "python": Python dict literal (can be imported directly with eval())

    Example workflow for AI:
    1. Call analyze_image_pixels() with desired parameters
    2. Receive response with export_info.file_path
    3. Use Read tool to read the file at export_info.file_path
    4. Process pixel data efficiently in one operation

    Args:
        image_path: Path to the image file

        region: Single region to extract (ignored if regions is set):
            - "full": Entire image (default)
            - "left", "center", "right": Third columns
            - "top-left", "top-center", "top-right": 3x3 grid cells
            - "middle-left", "middle-center", "middle-right": 3x3 grid cells
            - "bottom-left", "bottom-center", "bottom-right": 3x3 grid cells
            - "custom:x1,y1,x2,y2": Custom rectangle (e.g., "custom:100,200,400,600")

        regions: List of regions for batch extraction (e.g., ["left", "center", "right"])

        deduplicate: Remove duplicate colors (default: True)

        sample_size: Number of pixel samples to extract (default: 1000)

        sampling_strategy: How to sample pixels:
            - "random": Random sampling (default)
            - "uniform": Uniformly distributed sampling
            - "grid": Grid-based sampling
            - "edge": Edge-priority sampling

        output_format: Output format - "hex", "rgb", "both"

        include_coordinates: Include pixel coordinates in output (default: False)

        include_frequency: Include color frequency statistics (default: True)

        color_tolerance: Merge similar colors within tolerance (0-255, default: 0 = exact match)

        max_dimension: Resize image if larger than this (for performance, default: None)

        export_to_file: Export results to file (default: True)

        export_path: Custom directory path for export (default: {project_root}/.cache/file_processor)
            - Absolute path: "D:/my_exports" or "/home/user/exports"
            - Relative to project: "exports/pixels" -> {project_root}/exports/pixels
            - Use "default" or None for default cache directory

        export_format: Export file format (default: "json"):
            - "json": JSON format with indentation
            - "json-compact": Compact JSON (no indentation, smaller file)
            - "csv": CSV format (colors only, good for spreadsheets)
            - "txt": Plain text format (human-readable)
            - "python": Python dict literal (can be imported directly)

        export_filename: Custom filename (default: auto-generated with timestamp)
            - Without extension: "my_colors" -> "my_colors.json"
            - With extension: "colors.csv" (extension must match export_format)

        return_inline_data: Return full data inline even if exported (default: False)
            - False: Return summary with file path (AI-friendly, avoids large responses)
            - True: Return all data inline + file path (may cause timeout for large data)

    Returns:
        AI-optimized response with file path and summary or full data based on return_inline_data
    """
    try:
        logger.info(f"Analyzing image pixels: {image_path}, region={region}, strategy={sampling_strategy}")

        try:
            Image = get_third_package_PIL_Image()
            np = get_third_package_numpy()
            IMAGE_PROCESSING_AVAILABLE = True
        except ImportError:
            return {
                "error": "Image processing not available. Please install: pip install Pillow numpy"
            }

        # Validate parameters
        if sample_size <= 0:
            return {"error": "sample_size must be greater than 0"}

        if color_tolerance < 0 or color_tolerance > 255:
            return {"error": "color_tolerance must be between 0 and 255"}

        if sampling_strategy not in ["random", "uniform", "grid", "edge"]:
            return {"error": f"Invalid sampling_strategy: {sampling_strategy}. Valid options: random, uniform, grid, edge"}

        # Validate export format
        valid_export_formats = ["json", "json-compact", "csv", "txt", "python"]
        if export_format not in valid_export_formats:
            return {"error": f"Invalid export_format: {export_format}. Valid options: {', '.join(valid_export_formats)}"}

        # Resolve image path
        image_file = Path(image_path)
        if not image_file.is_absolute():
            image_file = Path.cwd() / image_file

        if not image_file.exists():
            return {"error": f"Image file not found: {image_file}"}

        # Setup export directory
        try:
            project_root = FileProcessorConstants.get_project_root()
        except:
            project_root = Path(__file__).parent.parent.parent.parent

        # Determine export directory
        if export_path:
            if export_path == "default":
                export_dir = project_root / ".cache" / "file_processor"
            else:
                export_dir = Path(export_path)
                if not export_dir.is_absolute():
                    # Relative to project root
                    export_dir = project_root / export_dir
        else:
            export_dir = project_root / ".cache" / "file_processor"

        export_dir.mkdir(parents=True, exist_ok=True)

        try:
            img = Image.open(image_file).convert("RGB")

            # Resize if needed for performance
            original_size = img.size
            if max_dimension and (img.width > max_dimension or img.height > max_dimension):
                ratio = min(max_dimension / img.width, max_dimension / img.height)
                new_size = (int(img.width * ratio), int(img.height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
                logger.info(f"Resized image from {original_size} to {img.size}")

            img_array = np.array(img)
            height, width, channels = img_array.shape

            # Helper function to extract pixels from a region
            def extract_region_pixels(region_spec: str, img_arr: np.ndarray) -> Dict[str, Any]:
                h, w = img_arr.shape[:2]
                region_name = region_spec.lower()

                # Parse custom region
                if region_name.startswith("custom:"):
                    try:
                        coords = region_name.split(":", 1)[1]
                        x1, y1, x2, y2 = map(int, coords.split(","))
                        # Clamp to image bounds
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(w, x2), min(h, y2)
                        if x1 >= x2 or y1 >= y2:
                            return {"error": f"Invalid custom region coordinates: {coords}"}
                        region_coords = (x1, y1, x2, y2)
                    except:
                        return {"error": f"Invalid custom region format. Use: custom:x1,y1,x2,y2"}

                # Three-column regions
                elif region_name == "left":
                    region_coords = (0, 0, w // 3, h)
                elif region_name == "center":
                    region_coords = (w // 3, 0, 2 * w // 3, h)
                elif region_name == "right":
                    region_coords = (2 * w // 3, 0, w, h)

                # Nine-grid regions
                elif region_name == "top-left":
                    region_coords = (0, 0, w // 3, h // 3)
                elif region_name == "top-center":
                    region_coords = (w // 3, 0, 2 * w // 3, h // 3)
                elif region_name == "top-right":
                    region_coords = (2 * w // 3, 0, w, h // 3)
                elif region_name == "middle-left":
                    region_coords = (0, h // 3, w // 3, 2 * h // 3)
                elif region_name == "middle-center":
                    region_coords = (w // 3, h // 3, 2 * w // 3, 2 * h // 3)
                elif region_name == "middle-right":
                    region_coords = (2 * w // 3, h // 3, w, 2 * h // 3)
                elif region_name == "bottom-left":
                    region_coords = (0, 2 * h // 3, w // 3, h)
                elif region_name == "bottom-center":
                    region_coords = (w // 3, 2 * h // 3, 2 * w // 3, h)
                elif region_name == "bottom-right":
                    region_coords = (2 * w // 3, 2 * h // 3, w, h)

                # Full image
                elif region_name == "full":
                    region_coords = (0, 0, w, h)
                else:
                    return {"error": f"Invalid region: {region_spec}"}

                # Extract region
                x1, y1, x2, y2 = region_coords
                region_array = img_arr[y1:y2, x1:x2]
                region_h, region_w = region_array.shape[:2]

                return {
                    "coords": region_coords,
                    "array": region_array,
                    "name": region_name,
                    "width": region_w,
                    "height": region_h
                }

            # Helper function to apply sampling strategy
            def apply_sampling(pixels: np.ndarray, coords_list: List, strategy: str, n: int) -> Tuple[np.ndarray, List]:
                available = len(pixels)
                if available <= n:
                    return pixels, coords_list

                if strategy == "random":
                    indices = np.random.choice(available, n, replace=False)
                    return pixels[indices], [coords_list[i] for i in indices] if coords_list else []

                elif strategy == "uniform":
                    step = available / n
                    indices = [int(i * step) for i in range(n)]
                    return pixels[indices], [coords_list[i] for i in indices] if coords_list else []

                elif strategy == "grid":
                    # Sample in grid pattern
                    indices = np.linspace(0, available - 1, n, dtype=int)
                    return pixels[indices], [coords_list[i] for i in indices] if coords_list else []

                elif strategy == "edge":
                    # Prioritize edge pixels (first and last pixels in sorted order)
                    half = n // 2
                    indices = list(range(half)) + list(range(available - half, available))
                    indices = indices[:n]
                    return pixels[indices], [coords_list[i] for i in indices] if coords_list else []

                return pixels[:n], coords_list[:n] if coords_list else []

            # Helper function to merge similar colors
            def merge_similar_colors(pixels: np.ndarray, tolerance: int) -> Tuple[np.ndarray, Dict]:
                if tolerance == 0:
                    return pixels, {}

                # Round colors to tolerance buckets
                bucketed = (pixels // (tolerance + 1)) * (tolerance + 1)
                unique_buckets, inverse = np.unique(bucketed, axis=0, return_inverse=True)

                # Map original colors to buckets
                color_map = {}
                for i, bucket in enumerate(unique_buckets):
                    bucket_tuple = tuple(bucket)
                    original_colors = pixels[inverse == i]
                    avg_color = original_colors.mean(axis=0).astype(int)
                    color_map[bucket_tuple] = tuple(avg_color)

                return unique_buckets, color_map

            # Process regions
            region_list = regions if regions else [region]
            results = []

            for reg_spec in region_list:
                reg_data = extract_region_pixels(reg_spec, img_array)

                if "error" in reg_data:
                    results.append({"region": reg_spec, "error": reg_data["error"]})
                    continue

                region_array = reg_data["array"]

                # Flatten pixels and get coordinates if needed
                if include_coordinates:
                    coords = []
                    pixels_list = []
                    for y in range(reg_data["height"]):
                        for x in range(reg_data["width"]):
                            pixels_list.append(region_array[y, x])
                            coords.append((x + reg_data["coords"][0], y + reg_data["coords"][1]))
                    pixels = np.array(pixels_list)
                else:
                    pixels = region_array.reshape(-1, 3)
                    coords = []

                total_pixels = len(pixels)

                # Color frequency before deduplication
                if include_frequency:
                    color_freq = Counter([tuple(p) for p in pixels])

                # Apply color tolerance merging
                if color_tolerance > 0:
                    merged_pixels, color_map = merge_similar_colors(pixels, color_tolerance)
                    if include_frequency and color_map:
                        # Update frequency with merged colors
                        new_freq = Counter()
                        for orig_color, count in color_freq.items():
                            bucket = tuple((np.array(orig_color) // (color_tolerance + 1)) * (color_tolerance + 1))
                            merged_color = color_map.get(bucket, orig_color)
                            new_freq[merged_color] += count
                        color_freq = new_freq
                    pixels = merged_pixels

                # Deduplication
                if deduplicate:
                    unique_pixels, unique_indices = np.unique(pixels, axis=0, return_index=True)
                    pixels_to_sample = unique_pixels
                    coords_to_sample = [coords[i] for i in unique_indices] if coords else []
                    dedupe_count = len(unique_pixels)
                else:
                    pixels_to_sample = pixels
                    coords_to_sample = coords
                    dedupe_count = None

                # Apply sampling strategy
                sampled_pixels, sampled_coords = apply_sampling(
                    pixels_to_sample, coords_to_sample, sampling_strategy, sample_size
                )
                actual_sample_size = len(sampled_pixels)

                # Build region result
                region_result = {
                    "region": reg_data["name"],
                    "region_info": {
                        "coordinates": {
                            "x1": int(reg_data["coords"][0]),
                            "y1": int(reg_data["coords"][1]),
                            "x2": int(reg_data["coords"][2]),
                            "y2": int(reg_data["coords"][3])
                        },
                        "width": int(reg_data["width"]),
                        "height": int(reg_data["height"]),
                        "total_pixels": int(total_pixels)
                    },
                    "processing_info": {
                        "deduplicated": deduplicate,
                        "unique_colors": int(dedupe_count) if dedupe_count is not None else None,
                        "color_tolerance": color_tolerance,
                        "sampling_strategy": sampling_strategy,
                        "requested_sample_size": sample_size,
                        "actual_sample_size": int(actual_sample_size)
                    }
                }

                # Format output
                if output_format in ["hex", "both"]:
                    if include_coordinates:
                        region_result["hex_pixels"] = [
                            {"color": f"#{r:02x}{g:02x}{b:02x}", "x": x, "y": y}
                            for (r, g, b), (x, y) in zip(sampled_pixels, sampled_coords)
                        ]
                    else:
                        region_result["hex_colors"] = [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in sampled_pixels]

                if output_format in ["rgb", "both"]:
                    if include_coordinates:
                        region_result["rgb_pixels"] = [
                            {"color": [int(r), int(g), int(b)], "x": x, "y": y}
                            for (r, g, b), (x, y) in zip(sampled_pixels, sampled_coords)
                        ]
                    else:
                        region_result["rgb_colors"] = [[int(r), int(g), int(b)] for r, g, b in sampled_pixels]

                # Add frequency statistics
                if include_frequency:
                    sorted_freq = sorted(color_freq.items(), key=lambda x: x[1], reverse=True)
                    region_result["color_frequency"] = {
                        "unique_colors": len(color_freq),
                        "most_frequent": [
                            {
                                "rgb": [int(r), int(g), int(b)],
                                "hex": f"#{r:02x}{g:02x}{b:02x}",
                                "count": int(count),
                                "percentage": round(count / total_pixels * 100, 2)
                            }
                            for (r, g, b), count in sorted_freq[:10]
                        ]
                    }

                results.append(region_result)

            # Build final result
            final_result = {
                "success": True,
                "file_path": str(image_file),
                "image_info": {
                    "original_size": {"width": original_size[0], "height": original_size[1]} if max_dimension else None,
                    "processed_size": {"width": width, "height": height},
                    "channels": channels,
                    "format": img.format,
                    "mode": img.mode
                },
                "regions": results if len(results) > 1 else results[0]
            }

            # Export to file if requested
            if export_to_file:
                # Determine filename
                if export_filename:
                    # Check if filename has extension
                    if '.' in export_filename:
                        filename = export_filename
                    else:
                        # Add extension based on export_format
                        ext_map = {
                            "json": ".json",
                            "json-compact": ".json",
                            "csv": ".csv",
                            "txt": ".txt",
                            "python": ".py"
                        }
                        filename = export_filename + ext_map.get(export_format, ".txt")
                else:
                    timestamp = time.strftime("%Y%m%d_%H%M%S")
                    ext_map = {
                        "json": ".json",
                        "json-compact": ".json",
                        "csv": ".csv",
                        "txt": ".txt",
                        "python": ".py"
                    }
                    filename = f"pixels_{timestamp}{ext_map.get(export_format, '.txt')}"

                file_path = export_dir / filename

                # Export based on format
                try:
                    if export_format == "json":
                        with open(file_path, 'w', encoding='utf-8') as f:
                            json.dump(final_result, f, indent=2, ensure_ascii=False)

                    elif export_format == "json-compact":
                        with open(file_path, 'w', encoding='utf-8') as f:
                            json.dump(final_result, f, ensure_ascii=False)

                    elif export_format == "csv":
                        with open(file_path, 'w', newline='', encoding='utf-8') as f:
                            writer = csv.writer(f)
                            # Write header
                            if include_coordinates:
                                writer.writerow(['x', 'y', 'hex', 'r', 'g', 'b'])
                            else:
                                writer.writerow(['hex', 'r', 'g', 'b'])

                            # Write data from regions
                            region_data = final_result["regions"]
                            if not isinstance(region_data, list):
                                region_data = [region_data]

                            for reg in region_data:
                                if "hex_colors" in reg:
                                    for hex_color in reg["hex_colors"]:
                                        r = int(hex_color[1:3], 16)
                                        g = int(hex_color[3:5], 16)
                                        b = int(hex_color[5:7], 16)
                                        writer.writerow([hex_color, r, g, b])
                                elif "hex_pixels" in reg:
                                    for pixel in reg["hex_pixels"]:
                                        hex_color = pixel["color"]
                                        r = int(hex_color[1:3], 16)
                                        g = int(hex_color[3:5], 16)
                                        b = int(hex_color[5:7], 16)
                                        writer.writerow([pixel["x"], pixel["y"], hex_color, r, g, b])

                    elif export_format == "txt":
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write("=" * 60 + "\n")
                            f.write("Image Pixel Analysis Results\n")
                            f.write("=" * 60 + "\n\n")
                            f.write(f"Image: {image_file}\n")
                            f.write(f"Processed Size: {width}x{height}\n\n")

                            region_data = final_result["regions"]
                            if not isinstance(region_data, list):
                                region_data = [region_data]

                            for reg in region_data:
                                f.write(f"\n--- Region: {reg['region']} ---\n")
                                f.write(f"Samples: {reg['processing_info']['actual_sample_size']}\n\n")

                                if "hex_colors" in reg:
                                    for i, hex_color in enumerate(reg["hex_colors"], 1):
                                        f.write(f"{i}. {hex_color}\n")
                                elif "hex_pixels" in reg:
                                    for i, pixel in enumerate(reg["hex_pixels"], 1):
                                        f.write(f"{i}. ({pixel['x']}, {pixel['y']}) = {pixel['color']}\n")

                    elif export_format == "python":
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write("# Auto-generated pixel data\n")
                            f.write(f"# Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                            f.write("pixel_data = ")
                            f.write(repr(final_result))

                    file_size = file_path.stat().st_size

                    # Create AI-friendly response
                    if return_inline_data:
                        # Return full data + file info
                        final_result["export_info"] = {
                            "exported": True,
                            "file_path": str(file_path),
                            "file_name": filename,
                            "file_size_bytes": file_size,
                            "file_size_kb": round(file_size / 1024, 2),
                            "export_directory": str(export_dir),
                            "export_format": export_format,
                            "data_included_inline": True
                        }
                        logger.info(f"Exported to: {file_path} (data returned inline)")
                        return final_result
                    else:
                        # Return summary only (AI-friendly, fast response)
                        region_data = final_result["regions"]
                        if not isinstance(region_data, list):
                            region_data = [region_data]

                        summary_response = {
                            "success": True,
                            "message": "Analysis complete. Data exported to file. AI should read the file for pixel data.",
                            "export_info": {
                                "exported": True,
                                "file_path": str(file_path),
                                "file_name": filename,
                                "file_size_bytes": file_size,
                                "file_size_kb": round(file_size / 1024, 2),
                                "export_directory": str(export_dir),
                                "export_format": export_format,
                                "data_included_inline": False
                            },
                            "image_info": final_result["image_info"],
                            "summary": {
                                "regions_processed": len(region_data),
                                "regions": [
                                    {
                                        "region": reg["region"],
                                        "total_pixels": reg["region_info"]["total_pixels"],
                                        "samples_extracted": reg["processing_info"]["actual_sample_size"],
                                        "unique_colors": reg["processing_info"].get("unique_colors"),
                                        "top_color": reg.get("color_frequency", {}).get("most_frequent", [{}])[0] if "color_frequency" in reg else None
                                    }
                                    for reg in region_data
                                ]
                            },
                            "usage_tip": f"To access pixel data, read the file: {file_path}"
                        }

                        logger.info(f"Exported to: {file_path} (summary only returned)")
                        return summary_response

                except Exception as export_error:
                    logger.error(f"Export failed: {export_error}")
                    final_result["export_info"] = {
                        "exported": False,
                        "error": str(export_error)
                    }
                    return final_result

            # No export, return inline data
            logger.info(f"Image pixel analysis completed: {len(region_list)} region(s) processed (no export)")
            return final_result

        except Exception as img_error:
            return {"error": f"Failed to process image: {str(img_error)}"}

    except Exception as e:
        error_msg = f"Image pixel analysis failed: {str(e)}"
        logger.error(error_msg)
        return {"error": error_msg}
