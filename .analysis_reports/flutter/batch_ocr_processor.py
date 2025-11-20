#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Batch OCR Processor for Flutter App Documentation Images
Scans directory and performs OCR on all images, generating individual info files
"""

import json
import sys
import os
from pathlib import Path
from typing import Dict, Any, List
import subprocess
import time

class BatchOCRProcessor:
    """Batch process images with OCR and generate info files"""

    def __init__(self, docs_dir: str, output_dir: str = None):
        self.docs_dir = Path(docs_dir)
        self.output_dir = Path(output_dir) if output_dir else self.docs_dir / "ocr_results"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # MCP file_processor path
        self.file_processor_path = Path("D:/programing/core_node/ncore/mcp_server/file_processor")
        sys.path.insert(0, str(self.file_processor_path))

    def find_images(self) -> List[Path]:
        """Find all image files in the directory"""
        image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
        images = []

        for ext in image_extensions:
            images.extend(self.docs_dir.glob(f'*{ext}'))
            images.extend(self.docs_dir.glob(f'*{ext.upper()}'))

        return sorted(images)

    def call_file_processor_ocr(self, image_path: Path) -> Dict[str, Any]:
        """Call file_processor OCR via MCP"""
        try:
            # Import file_processor modules
            from image_processor import SmartImageProcessor
            from ocr_engines import ocr_manager

            # Initialize if needed
            if not ocr_manager.is_initialized():
                print(f"Initializing OCR engines...")
                ocr_manager.initialize_engines()

            # Process image
            processor = SmartImageProcessor()
            result = processor.process_image(
                str(image_path),
                ocr_engine="auto",
                language="chs"
            )

            return result

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__
            }

    def generate_info_file(self, image_path: Path, ocr_result: Dict[str, Any]) -> Path:
        """Generate information file for the image with OCR results"""

        # Create info filename
        info_filename = image_path.stem + "_info.json"
        info_path = self.output_dir / info_filename

        # Prepare info data
        info_data = {
            "file_info": {
                "filename": image_path.name,
                "filepath": str(image_path.absolute()),
                "relative_path": str(image_path.relative_to(self.docs_dir.parent)),
                "file_size_bytes": image_path.stat().st_size,
                "file_size_kb": round(image_path.stat().st_size / 1024, 2),
                "modified_time": time.ctime(image_path.stat().st_mtime)
            },
            "ocr_result": ocr_result,
            "processing_info": {
                "processed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "processor_version": "1.0.0"
            }
        }

        # Write to file
        with open(info_path, 'w', encoding='utf-8') as f:
            json.dump(info_data, f, ensure_ascii=False, indent=2)

        return info_path

    def process_all_images(self) -> Dict[str, Any]:
        """Process all images in the directory"""

        print(f"\n{'='*60}")
        print(f"Batch OCR Processing for Flutter App Documentation")
        print(f"{'='*60}\n")
        print(f"Source Directory: {self.docs_dir}")
        print(f"Output Directory: {self.output_dir}")
        print()

        # Find all images
        images = self.find_images()
        total_images = len(images)

        print(f"Found {total_images} images to process\n")

        if total_images == 0:
            return {
                "success": False,
                "message": "No images found in directory",
                "total_images": 0
            }

        # Process each image
        results = {
            "successful": [],
            "failed": [],
            "info_files": []
        }

        for idx, image_path in enumerate(images, 1):
            print(f"[{idx}/{total_images}] Processing: {image_path.name}")

            try:
                # Perform OCR
                ocr_result = self.call_file_processor_ocr(image_path)

                # Generate info file
                info_file = self.generate_info_file(image_path, ocr_result)

                if ocr_result.get("success", False):
                    text_length = len(ocr_result.get("text", ""))
                    confidence = ocr_result.get("confidence", 0)
                    print(f"  [OK] OCR Success: {text_length} chars, confidence: {confidence:.2%}")
                    results["successful"].append(str(image_path))
                else:
                    error_msg = ocr_result.get("error", "Unknown error")
                    print(f"  [FAIL] OCR Failed: {error_msg}")
                    results["failed"].append({
                        "file": str(image_path),
                        "error": error_msg
                    })

                results["info_files"].append(str(info_file))
                print(f"  -> Info file: {info_file.name}\n")

            except Exception as e:
                error_msg = f"{type(e).__name__}: {str(e)}"
                print(f"  [ERROR] {error_msg}\n")
                results["failed"].append({
                    "file": str(image_path),
                    "error": error_msg
                })

        # Generate summary
        summary = {
            "success": True,
            "total_images": total_images,
            "successful_ocr": len(results["successful"]),
            "failed_ocr": len(results["failed"]),
            "info_files_generated": len(results["info_files"]),
            "success_rate": f"{len(results['successful'])/total_images*100:.1f}%",
            "details": results
        }

        # Save summary
        summary_path = self.output_dir / "batch_ocr_summary.json"
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

        print(f"\n{'='*60}")
        print(f"Processing Complete!")
        print(f"{'='*60}")
        print(f"Total Images: {total_images}")
        print(f"Successful: {len(results['successful'])} ({summary['success_rate']})")
        print(f"Failed: {len(results['failed'])}")
        print(f"Info Files: {len(results['info_files'])}")
        print(f"\nSummary saved to: {summary_path}")
        print(f"{'='*60}\n")

        return summary


def main():
    """Main entry point"""

    # Configuration
    docs_dir = "D:/programing/core_node/poly_apps/flutter_bloom/lib/apps/app_qy/docs"
    output_dir = "D:/programing/core_node/.analysis_reports/flutter/ocr_results"

    # Process images
    processor = BatchOCRProcessor(docs_dir, output_dir)
    result = processor.process_all_images()

    # Exit with appropriate code
    if result["success"]:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
