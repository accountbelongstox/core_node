#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR-Based Placeholder Replacer
Scans directories, detects placeholder images using OCR, and replaces them intelligently
"""

import os
import sys
import re
import time
import json
import requests
import hashlib
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass
from PIL import Image

# Configure for proper initialization
def ensure_dependencies():
    """Ensure required packages are installed"""
    try:
        import requests
        from PIL import Image
    except ImportError as e:
        print(f"[INIT_ERROR] Missing dependency: {e}")
        print("[INIT_ERROR] Install with: pip install requests pillow")
        return False
    return True


@dataclass
class PlaceholderDetectionResult:
    """Result of placeholder detection"""
    is_placeholder: bool
    confidence: float
    detected_size: Optional[Tuple[int, int]] = None  # (width, height)
    detected_format: Optional[str] = None  # 'png', 'jpg', etc.
    ocr_text: str = ""
    image_hash: str = ""
    reason: str = ""


class SimpleOCREngine:
    """Simplified OCR engine using Free OCR service"""

    def __init__(self, api_key: str = "K84414795888957"):
        self.base_url = "https://api.ocr.space/parse/image"
        self.api_key = api_key
        self.max_file_size = 1024 * 1024  # 1MB
        print("[OCR_ENGINE] Initialized with Free OCR API")

    def recognize_text(self, image_path: str, timeout: int = 15) -> Tuple[bool, str, float]:
        """
        Recognize text from image using OCR

        Args:
            image_path: Path to image file
            timeout: Request timeout in seconds

        Returns:
            Tuple of (success, text, confidence)
        """
        try:
            # Check file size
            file_size = os.path.getsize(image_path)
            if file_size > self.max_file_size:
                print(f"[OCR_ENGINE] File too large ({file_size} bytes), compressing...")
                image_path = self._compress_image(image_path)

            # Prepare request
            with open(image_path, 'rb') as f:
                files = {'file': (os.path.basename(image_path), f, 'application/octet-stream')}

                payload = {
                    'apikey': self.api_key,
                    'language': 'eng',
                    'isOverlayRequired': False,
                    'detectOrientation': True,
                    'scale': True,
                    'OCREngine': 2
                }

                print(f"[OCR_ENGINE] Recognizing: {os.path.basename(image_path)}")
                response = requests.post(
                    self.base_url,
                    files=files,
                    data=payload,
                    timeout=timeout
                )

            response.raise_for_status()
            result = response.json()

            # Parse response
            if result.get("IsErroredOnProcessing", False):
                error_msg = result.get("ErrorMessage", "Unknown error")
                print(f"[OCR_ENGINE] Error: {error_msg}")
                return False, "", 0.0

            parsed_results = result.get("ParsedResults", [])
            if not parsed_results:
                print("[OCR_ENGINE] No text found")
                return True, "", 0.0

            # Extract text
            text = parsed_results[0].get("ParsedText", "").strip()
            confidence = parsed_results[0].get("FileParseExitCode", 0) == 1

            print(f"[OCR_ENGINE] Recognized: '{text[:50]}...'")
            return True, text, 0.8 if confidence else 0.5

        except requests.exceptions.Timeout:
            print(f"[OCR_ENGINE] Timeout after {timeout}s")
            return False, "", 0.0

        except Exception as e:
            print(f"[OCR_ENGINE] Failed: {e}")
            return False, "", 0.0

    def _compress_image(self, image_path: str) -> str:
        """Compress image to meet size limits"""
        try:
            img = Image.open(image_path)

            # Resize if too large
            max_dimension = 1280
            if max(img.size) > max_dimension:
                ratio = max_dimension / max(img.size)
                new_size = tuple(int(dim * ratio) for dim in img.size)
                img = img.resize(new_size, Image.Resampling.LANCZOS)

            # Save compressed version
            temp_path = image_path + ".compressed.jpg"
            img.convert('RGB').save(temp_path, 'JPEG', quality=85, optimize=True)

            print(f"[OCR_ENGINE] Compressed: {os.path.basename(temp_path)}")
            return temp_path

        except Exception as e:
            print(f"[OCR_ENGINE] Compression failed: {e}")
            return image_path


class PlaceholderDetector:
    """Detects placeholder images using OCR and pattern matching"""

    def __init__(self, ocr_engine: Optional[SimpleOCREngine] = None):
        self.ocr_engine = ocr_engine or SimpleOCREngine()
        self.image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}

        # Patterns for placeholder detection
        self.size_pattern = re.compile(r'(\d{3,4})\s*[xX×]\s*(\d{3,4})', re.IGNORECASE)
        self.format_pattern = re.compile(r'\b(png|jpg|jpeg|gif|bmp|webp)\b', re.IGNORECASE)
        self.placeholder_keywords = ['placeholder', 'image', 'picture', 'photo', 'size']

        print("[DETECTOR] Initialized placeholder detector")

    def detect_placeholder(self, image_path: str, use_ocr: bool = True) -> PlaceholderDetectionResult:
        """
        Detect if image is a placeholder

        Args:
            image_path: Path to image file
            use_ocr: Whether to use OCR for detection

        Returns:
            PlaceholderDetectionResult
        """
        result = PlaceholderDetectionResult(
            is_placeholder=False,
            confidence=0.0,
            image_hash=self._calculate_image_hash(image_path)
        )

        try:
            # Step 1: Check file size (placeholders are usually small)
            file_size = os.path.getsize(image_path)
            if file_size < 1024:  # Less than 1KB
                result.is_placeholder = True
                result.confidence = 0.3
                result.reason = "Very small file size"
                print(f"[DETECTOR] Small file detected: {file_size} bytes")

            # Step 2: Check image dimensions (simple placeholders are often perfect squares or standard sizes)
            try:
                with Image.open(image_path) as img:
                    width, height = img.size

                    # Common placeholder sizes
                    if (width, height) in [(100, 100), (200, 200), (300, 300), (400, 300),
                                           (800, 600), (1920, 1080), (640, 480)]:
                        result.is_placeholder = True
                        result.confidence = min(result.confidence + 0.2, 1.0)
                        result.reason += "; Common placeholder size"
                        print(f"[DETECTOR] Standard size detected: {width}x{height}")

            except Exception as e:
                print(f"[DETECTOR] Image read error: {e}")

            # Step 3: OCR Detection
            if use_ocr:
                success, text, ocr_confidence = self.ocr_engine.recognize_text(image_path)

                if success and text:
                    result.ocr_text = text
                    is_ph, conf, size, fmt = self._analyze_ocr_text(text)

                    if is_ph:
                        result.is_placeholder = True
                        result.confidence = max(result.confidence, conf)
                        result.detected_size = size
                        result.detected_format = fmt
                        result.reason += f"; OCR detected: {text[:50]}"
                        print(f"[DETECTOR] OCR confirms placeholder: confidence={conf:.2f}")

            # Final decision
            if result.confidence >= 0.5:
                result.is_placeholder = True

            print(f"[DETECTOR] Result: is_placeholder={result.is_placeholder}, confidence={result.confidence:.2f}")
            return result

        except Exception as e:
            print(f"[DETECTOR] Detection failed: {e}")
            return result

    def _analyze_ocr_text(self, text: str) -> Tuple[bool, float, Optional[Tuple[int, int]], Optional[str]]:
        """
        Analyze OCR text for placeholder indicators

        Returns:
            Tuple of (is_placeholder, confidence, size, format)
        """
        confidence = 0.0
        detected_size = None
        detected_format = None

        # Check for size pattern (e.g., "300x200", "300 x 200", "300X200")
        size_match = self.size_pattern.search(text)
        if size_match:
            width = int(size_match.group(1))
            height = int(size_match.group(2))
            detected_size = (width, height)
            confidence += 0.5
            print(f"[DETECTOR] Size pattern found: {width}x{height}")

        # Check for format pattern (e.g., "PNG", "JPG")
        format_match = self.format_pattern.search(text)
        if format_match:
            detected_format = format_match.group(1).lower()
            confidence += 0.3
            print(f"[DETECTOR] Format pattern found: {detected_format}")

        # Check for placeholder keywords
        text_lower = text.lower()
        keyword_count = sum(1 for kw in self.placeholder_keywords if kw in text_lower)
        if keyword_count > 0:
            confidence += 0.2 * keyword_count
            print(f"[DETECTOR] Keywords found: {keyword_count}")

        is_placeholder = confidence >= 0.5
        return is_placeholder, min(confidence, 1.0), detected_size, detected_format

    def _calculate_image_hash(self, image_path: str) -> str:
        """Calculate MD5 hash of image file"""
        try:
            with open(image_path, 'rb') as f:
                return hashlib.md5(f.read()).hexdigest()
        except Exception:
            return ""


class PlaceholderReplacementQueue:
    """Queue manager for batch placeholder replacement with rate limiting"""

    def __init__(self, min_interval: float = 5.0):
        self.queue = []
        self.processing = False
        self.min_interval = min_interval  # Minimum seconds between API calls
        self.processed_hashes = set()  # Track processed images by hash
        self.stats = {
            "total": 0,
            "processed": 0,
            "skipped": 0,
            "failed": 0
        }
        print(f"[QUEUE] Initialized with {min_interval}s interval")

    def add_image(self, image_path: str, detection_result: PlaceholderDetectionResult,
                 placeholder_type: str = "unsplash_image",
                 description: Optional[str] = None):
        """Add image to replacement queue"""
        # Check if already processed (same hash)
        if detection_result.image_hash in self.processed_hashes:
            print(f"[QUEUE] Skipped duplicate: {os.path.basename(image_path)}")
            self.stats["skipped"] += 1
            return

        self.queue.append({
            "image_path": image_path,
            "detection": detection_result,
            "placeholder_type": placeholder_type,
            "description": description
        })
        self.stats["total"] += 1
        print(f"[QUEUE] Added to queue: {os.path.basename(image_path)}")

    def get_status(self) -> Dict[str, Any]:
        """Get queue status"""
        return {
            "queue_size": len(self.queue),
            "processing": self.processing,
            "stats": self.stats
        }


class OCRPlaceholderReplacer:
    """
    Main class for OCR-based placeholder detection and replacement
    """

    def __init__(self):
        # Initialize components
        if not ensure_dependencies():
            raise RuntimeError("Missing required dependencies")

        self.ocr_engine = SimpleOCREngine()
        self.detector = PlaceholderDetector(self.ocr_engine)
        self.queue = PlaceholderReplacementQueue(min_interval=5.0)

        print("[REPLACER] Initialized OCR Placeholder Replacer")

    def scan_directory(self, directory: str, recursive: bool = True,
                      use_ocr: bool = True) -> List[Dict[str, Any]]:
        """
        Scan directory for placeholder images

        Args:
            directory: Directory path to scan
            recursive: Whether to scan subdirectories
            use_ocr: Whether to use OCR for detection

        Returns:
            List of detected placeholder info
        """
        print(f"\n[SCAN] Starting directory scan: {directory}")
        print(f"[SCAN] Recursive: {recursive}, OCR: {use_ocr}")

        placeholders = []
        path_obj = Path(directory)

        if not path_obj.exists():
            print(f"[SCAN] Error: Directory not found: {directory}")
            return placeholders

        # Get all image files
        pattern = "**/*" if recursive else "*"
        image_files = []

        for ext in self.detector.image_extensions:
            image_files.extend(path_obj.glob(f"{pattern}{ext}"))
            image_files.extend(path_obj.glob(f"{pattern}{ext.upper()}"))

        print(f"[SCAN] Found {len(image_files)} images")

        # Detect placeholders
        for i, image_path in enumerate(image_files, 1):
            print(f"\n[SCAN] Processing {i}/{len(image_files)}: {image_path.name}")

            detection = self.detector.detect_placeholder(str(image_path), use_ocr=use_ocr)

            if detection.is_placeholder:
                info = {
                    "path": str(image_path),
                    "filename": image_path.name,
                    "is_placeholder": True,
                    "confidence": detection.confidence,
                    "detected_size": detection.detected_size,
                    "detected_format": detection.detected_format,
                    "ocr_text": detection.ocr_text,
                    "hash": detection.image_hash,
                    "reason": detection.reason
                }
                placeholders.append(info)
                print(f"[SCAN] [PLACEHOLDER FOUND] {image_path.name} (confidence: {detection.confidence:.2f})")

        print(f"\n[SCAN] Scan complete: Found {len(placeholders)} placeholders out of {len(image_files)} images")
        return placeholders

    def replace_placeholders_in_directory(self, directory: str,
                                         placeholder_type: str = "unsplash_image",
                                         description: Optional[str] = None,
                                         recursive: bool = True,
                                         use_ocr: bool = True,
                                         dry_run: bool = False) -> Dict[str, Any]:
        """
        Scan directory and replace all detected placeholders

        Args:
            directory: Directory to scan
            placeholder_type: Type of placeholder to generate
            description: Description for unsplash_search type
            recursive: Scan subdirectories
            use_ocr: Use OCR for detection
            dry_run: Only detect, don't replace

        Returns:
            Summary dictionary
        """
        print("\n" + "=" * 60)
        print(f" OCR Placeholder Replacement")
        print("=" * 60)
        print(f" Directory: {directory}")
        print(f" Type: {placeholder_type}")
        print(f" Recursive: {recursive}")
        print(f" OCR: {use_ocr}")
        print(f" Dry Run: {dry_run}")
        print("=" * 60 + "\n")

        # Step 1: Scan directory
        placeholders = self.scan_directory(directory, recursive=recursive, use_ocr=use_ocr)

        if not placeholders:
            print("[REPLACE] No placeholders detected")
            return {
                "success": True,
                "message": "No placeholders found",
                "scanned": 0,
                "detected": 0,
                "replaced": 0
            }

        # Step 2: Add to queue
        for ph_info in placeholders:
            detection = PlaceholderDetectionResult(
                is_placeholder=True,
                confidence=ph_info["confidence"],
                detected_size=ph_info["detected_size"],
                detected_format=ph_info["detected_format"],
                ocr_text=ph_info["ocr_text"],
                image_hash=ph_info["hash"],
                reason=ph_info["reason"]
            )

            # Use detected size if available
            if detection.detected_size:
                width, height = detection.detected_size
                print(f"[QUEUE] Using detected size: {width}x{height}")
            else:
                # Get actual image size
                try:
                    with Image.open(ph_info["path"]) as img:
                        width, height = img.size
                    print(f"[QUEUE] Using actual size: {width}x{height}")
                except:
                    width, height = 800, 600
                    print(f"[QUEUE] Using default size: {width}x{height}")

            if not dry_run:
                self.queue.add_image(
                    ph_info["path"],
                    detection,
                    placeholder_type=placeholder_type,
                    description=description or ph_info.get("ocr_text", "")
                )

        # Step 3: Process queue (if not dry run)
        if not dry_run:
            self._process_queue()

        # Return summary
        status = self.queue.get_status()
        return {
            "success": True,
            "message": f"Processed {status['stats']['processed']} placeholders",
            "detected": len(placeholders),
            "replaced": status['stats']['processed'],
            "skipped": status['stats']['skipped'],
            "failed": status['stats']['failed'],
            "placeholders": placeholders
        }

    def _process_queue(self):
        """Process replacement queue with rate limiting"""
        from main import PlaceholderImageGenerator

        print("\n" + "=" * 60)
        print(" Processing Replacement Queue")
        print("=" * 60 + "\n")

        generator = PlaceholderImageGenerator()
        self.queue.processing = True

        try:
            for i, item in enumerate(self.queue.queue, 1):
                print(f"\n[PROCESS] {i}/{len(self.queue.queue)}: {os.path.basename(item['image_path'])}")

                # Get image dimensions
                try:
                    with Image.open(item['image_path']) as img:
                        width, height = img.size
                except:
                    width, height = 800, 600

                # Generate replacement
                success, message = generator.generate_placeholder(
                    item['image_path'],
                    width=width,
                    height=height,
                    placeholder_type=item['placeholder_type'],
                    description=item.get('description')
                )

                if success:
                    print(f"[PROCESS] [OK] Replaced: {message}")
                    self.queue.processed_hashes.add(item['detection'].image_hash)
                    self.queue.stats["processed"] += 1
                else:
                    print(f"[PROCESS] [FAIL] Failed: {message}")
                    self.queue.stats["failed"] += 1

                # Rate limiting
                if i < len(self.queue.queue):
                    wait_time = self.queue.min_interval
                    print(f"[PROCESS] Waiting {wait_time}s before next image...")
                    time.sleep(wait_time)

        finally:
            self.queue.processing = False
            print("\n" + "=" * 60)
            print(" Queue Processing Complete")
            print("=" * 60)
            print(f" Processed: {self.queue.stats['processed']}")
            print(f" Failed: {self.queue.stats['failed']}")
            print(f" Skipped: {self.queue.stats['skipped']}")
            print("=" * 60 + "\n")


# Global instance
_replacer_instance = None

def get_replacer() -> OCRPlaceholderReplacer:
    """Get global replacer instance"""
    global _replacer_instance
    if _replacer_instance is None:
        _replacer_instance = OCRPlaceholderReplacer()
    return _replacer_instance
