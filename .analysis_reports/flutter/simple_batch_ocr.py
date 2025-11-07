#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import json
from pathlib import Path

# Add file_processor to path
sys.path.insert(0, "D:/programing/core_node/ncore/mcp_server/file_processor")

# Import the main module
import main as file_processor_main

def process_directory():
    """Process all images in the docs directory"""

    docs_path = "D:/programing/core_node/poly_apps/flutter_bloom/lib/apps/app_qy/docs"
    output_path = "D:/programing/core_node/.analysis_reports/flutter/ocr_results"

    print("Calling MCP FileProcessor scan_directory_and_ocr...")
    print(f"Directory: {docs_path}")
    print(f"Output: {output_path}\n")

    # Call the MCP tool directly
    result = file_processor_main.scan_directory_and_ocr(
        directory_path=docs_path,
        max_depth=1,
        ocr_engine="free",
        language="chs",
        recursive=False,
        image_extensions=['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
    )

    # Create output directory
    Path(output_path).mkdir(parents=True, exist_ok=True)

    # Save main result
    result_file = Path(output_path) / "scan_result.json"
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\nMain result saved to: {result_file}")

    # Generate individual info files for each image
    if result.get("success") and "ocr_results" in result:
        ocr_results = result["ocr_results"]
        print(f"\nGenerating individual info files for {len(ocr_results)} images...\n")

        for filepath, ocr_data in ocr_results.items():
            # Get image filename
            image_name = Path(filepath).stem
            info_filename = f"{image_name}_info.json"
            info_path = Path(output_path) / info_filename

            # Create info file
            info_data = {
                "file_info": {
                    "filename": Path(filepath).name,
                    "filepath": filepath,
                    "location": filepath
                },
                "ocr_result": ocr_data
            }

            with open(info_path, 'w', encoding='utf-8') as f:
                json.dump(info_data, f, ensure_ascii=False, indent=2)

            if ocr_data.get("success"):
                print(f"[OK] {Path(filepath).name} -> {info_filename}")
            else:
                print(f"[FAIL] {Path(filepath).name} -> {info_filename}")

    # Print summary
    print(f"\n{'='*60}")
    print("Processing Complete")
    print(f"{'='*60}")
    if "summary" in result:
        summary = result["summary"]
        print(f"Total: {summary.get('total_files', 0)}")
        print(f"Success: {summary.get('successful', 0)}")
        print(f"Failed: {summary.get('failed', 0)}")
    print(f"{'='*60}\n")

    return result

if __name__ == "__main__":
    try:
        process_directory()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
