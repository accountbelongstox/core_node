#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PaddleOCR Engine (v3.x / PaddleX)
Optical Character Recognition using PaddleOCR
Supports Chinese (Simplified and Traditional) text recognition

IMPORTANT: This implementation uses PaddleOCR 3.x API (PaddleX)
Pitfalls encountered during development:
1. PaddleOCR 3.x removed 'show_log', 'use_gpu' parameters from initialization
2. Must use predict() method instead of ocr() method (v2.x API)
3. Chinese characters in file paths break OpenCV - use PIL + numpy instead
4. OCRResult is dict-like object with keys, not attributes
5. Keys are PLURAL: 'rec_texts', 'rec_scores' (not singular 'rec_text', 'rec_score')
6. Correct initialization: PaddleOCR(use_doc_orientation_classify=False,
   use_doc_unwarping=False, use_textline_orientation=False)
"""

import os
import sys
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime
from pycore.pyfoundations.runtime_abi import PADDLE_CPU_PACKAGE
import time
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import subprocess

from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image
from pycore.pyfoundations.third_party.api import get_third_package_numpy

import logging



# Add parent directory to path for dependency checking
pytools_dir = Path(__file__).parent.parent
sys.path.insert(0, str(pytools_dir))


from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA


class PaddleOCREngine:
    """
    PaddleOCR Engine for text recognition
    Supports auto-installation and Chinese text recognition
    """

    INSTALL_STATUS_KEY = "paddle_ocr_install_status"
    INSTALL_TIMESTAMP_KEY = "paddle_ocr_install_timestamp"
    INSTALL_COMPLETED = "completed"
    INSTALL_IN_PROGRESS = "in_progress"
    INSTALL_FAILED = "failed"

    def __init__(self, lang: str = "chinese_cht", auto_init: bool = True):
        """
        Initialize PaddleOCR Engine

        Args:
            lang: Language for OCR recognition
                  - "ch" or "chinese" or "chinese_sim": Chinese Simplified
                  - "chinese_cht": Chinese Traditional (default)
                  - "en": English
            auto_init: Automatically initialize and install if needed
        """
        self.lang = self._normalize_language(lang)
        self.ocr_instance = None
        self.is_initialized = False
        self.initialization_error = None

        ColorPrint.green(f"[INIT] PaddleOCR Engine initializing with language: {self.lang}")

        if auto_init:
            self.init()

    def _normalize_language(self, lang: str) -> str:
        """Normalize language code"""
        lang_lower = lang.lower()

        if lang_lower in ["ch", "chinese", "chinese_sim", "simplified"]:
            return "ch"
        elif lang_lower in ["chinese_cht", "traditional", "cht"]:
            return "chinese_cht"
        elif lang_lower in ["en", "english"]:
            return "en"
        else:
            ColorPrint.yellow(f"[WARN] Unknown language '{lang}', defaulting to 'chinese_cht'")
            return "chinese_cht"

    def _check_installation_status(self) -> str:
        """
        Check current installation status from encyclopedia

        Returns:
            Installation status: 'completed', 'in_progress', 'failed', or None
        """
        status = ENCYCLOPEDIA.get(self.INSTALL_STATUS_KEY)
        return status if status else None

    def _set_installation_status(self, status: str):
        """Set installation status in encyclopedia"""
        ENCYCLOPEDIA.add(self.INSTALL_STATUS_KEY, status)
        ENCYCLOPEDIA.add(self.INSTALL_TIMESTAMP_KEY, time.time())

    def _check_packages_installed(self) -> bool:
        """Check if required packages are installed"""
        try:
            ColorPrint.green("[CHECK] PaddleOCR packages already installed")
            return True
        except ImportError:
            ColorPrint.yellow("[CHECK] PaddleOCR packages not found")
            return False

    def _install_packages_with_progress(self) -> bool:
        """
        Install PaddleOCR packages with real-time progress output

        Returns:
            True if installation successful
        """
        try:
            ColorPrint.blue("[INSTALL] Starting PaddleOCR installation...")
            self._set_installation_status(self.INSTALL_IN_PROGRESS)

            # Get Python executable path
            python_exe = sys.executable
            ColorPrint.blue(f"[INSTALL] Using Python: {python_exe}")

            # Install PaddlePaddle CPU version
            ColorPrint.blue("[INSTALL] Installing PaddlePaddle (CPU version)...")
            paddle_cmd = [
                python_exe, "-m", "pip", "install",
                PADDLE_CPU_PACKAGE,
                "-i", "https://www.paddlepaddle.org.cn/packages/stable/cpu/"
            ]

            success = self._run_command_with_output(paddle_cmd, "PaddlePaddle")
            if not success:
                self._set_installation_status(self.INSTALL_FAILED)
                return False

            # Install PaddleOCR with all dependencies
            ColorPrint.blue("[INSTALL] Installing PaddleOCR...")
            ocr_cmd = [
                python_exe, "-m", "pip", "install",
                "paddleocr[all]"
            ]

            success = self._run_command_with_output(ocr_cmd, "PaddleOCR")
            if not success:
                self._set_installation_status(self.INSTALL_FAILED)
                return False

            ColorPrint.green("[INSTALL] Installation completed successfully!")
            self._set_installation_status(self.INSTALL_COMPLETED)
            return True

        except Exception as e:
            ColorPrint.red(f"[ERROR] Installation failed: {e}")
            self._set_installation_status(self.INSTALL_FAILED)
            return False

    def _run_command_with_output(self, cmd: List[str], package_name: str) -> bool:
        """
        Run command and display output in real-time

        Args:
            cmd: Command to execute
            package_name: Name of package being installed

        Returns:
            True if command succeeded
        """
        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )

            # Read output line by line
            for line in process.stdout:
                line = line.strip()
                if line:
                    # Show important lines
                    if any(keyword in line.lower() for keyword in ["downloading", "installing", "collecting", "successfully"]):
                        ColorPrint.gray(f"   {line}")

            process.wait()

            if process.returncode == 0:
                ColorPrint.green(f"[SUCCESS] {package_name} installed successfully")
                return True
            else:
                ColorPrint.red(f"[ERROR] {package_name} installation failed with code {process.returncode}")
                return False

        except Exception as e:
            ColorPrint.red(f"[ERROR] Command execution failed: {e}")
            return False

    def init(self) -> bool:
        """
        Initialize OCR engine with auto-installation if needed

        Returns:
            True if initialization successful
        """
        try:
            # Check if already initialized
            if self.is_initialized and self.ocr_instance:
                ColorPrint.blue("[INIT] OCR already initialized")
                return True

            # Check installation status
            install_status = self._check_installation_status()

            # Handle in-progress installations
            if install_status == self.INSTALL_IN_PROGRESS:
                timestamp = ENCYCLOPEDIA.get(self.INSTALL_TIMESTAMP_KEY)
                if timestamp and (time.time() - float(timestamp)) < 600:  # 10 minutes
                    ColorPrint.yellow("[INIT] Previous installation still in progress, retrying...")
                else:
                    ColorPrint.yellow("[INIT] Previous installation timed out, restarting...")
                    self._set_installation_status(None)

            # Check if packages are installed
            if not self._check_packages_installed():
                ColorPrint.blue("[INIT] PaddleOCR not installed, starting installation...")

                # Install packages
                if not self._install_packages_with_progress():
                    ColorPrint.red("[ERROR] Failed to install PaddleOCR packages")
                    self.initialization_error = "Package installation failed"
                    return False

                ColorPrint.green("[INIT] Packages installed, initializing OCR engine...")

            # Initialize PaddleOCR
            return self._initialize_ocr_engine()

        except Exception as e:
            error_msg = f"Initialization failed: {e}"
            ColorPrint.red(f"[ERROR] {error_msg}")
            self.initialization_error = error_msg
            return False

    def _initialize_ocr_engine(self) -> bool:
        """Initialize the PaddleOCR engine"""
        try:

            ColorPrint.blue(f"[INIT] Creating PaddleOCR instance with language: {self.lang}")

            # Suppress PaddleOCR logging
            logging.getLogger('ppocr').setLevel(logging.ERROR)

            # Initialize OCR with PaddleOCR 3.x parameters
            # PaddleOCR 3.x uses different initialization
            self.ocr_instance = PaddleOCR(
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False
            )

            self.is_initialized = True
            ColorPrint.green("[INIT] PaddleOCR engine initialized successfully")
            return True

        except Exception as e:
            error_msg = f"Failed to initialize PaddleOCR engine: {e}"
            ColorPrint.red(f"[ERROR] {error_msg}")
            self.initialization_error = error_msg
            return False

    def recognize_text(self, image_path: str) -> Optional[List[Dict[str, Any]]]:
        """
        Recognize text from image with coordinates

        Args:
            image_path: Path to image file

        Returns:
            List of detected text with information:
            [
                {
                    "text": "recognized text",
                    "confidence": 0.95,
                    "box": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]],  # 4 corner points
                    "center": (x, y),  # Center point
                    "bbox": (left, top, right, bottom)  # Bounding box
                },
                ...
            ]
            Returns None if recognition failed
        """
        try:
            if not self.is_initialized:
                ColorPrint.red("[ERROR] OCR not initialized")
                return None

            if not os.path.exists(image_path):
                ColorPrint.red(f"[ERROR] Image not found: {image_path}")
                return None

            ColorPrint.blue(f"[OCR] Recognizing text from: {image_path}")
            start_time = time.time()

            # Pitfall: OpenCV cannot handle Chinese characters in file paths
            # Solution: Load image with PIL and convert to numpy array before passing to OCR
            try:
                Image = get_third_package_PIL_Image()
                np = get_third_package_numpy()

                # Read image using PIL (handles Chinese/Unicode paths correctly)
                pil_image = Image.open(image_path)
                if pil_image.mode != 'RGB':
                    pil_image = pil_image.convert('RGB')
                image_array = np.array(pil_image)

                # Perform OCR using PaddleOCR 3.x predict() method with numpy array
                result = self.ocr_instance.predict(image_array)

            except Exception as e:
                ColorPrint.yellow(f"[WARN] Failed to load image with PIL: {e}, trying direct path")
                # Fallback to direct path (may fail with Chinese characters)
                result = self.ocr_instance.predict(image_path)

            if not result:
                ColorPrint.yellow("[OCR] No text detected in image")
                return []

            # Parse results - PaddleOCR 3.x returns list of OCRResult dict-like objects
            recognized_texts = []

            # PaddleOCR 3.x (PaddleX) returns list of OCRResult dictionary objects
            # Pitfall: OCRResult is dict-like, use dict access not attributes
            # Pitfall: keys are PLURAL - 'rec_texts', 'rec_scores' (not singular)
            for ocr_result in result:
                try:
                    # Access dictionary keys (v3 API uses plural forms)
                    boxes = ocr_result.get('dt_polys', None)
                    texts = ocr_result.get('rec_texts', None)  # Note: plural
                    scores = ocr_result.get('rec_scores', None)  # Note: plural

                    # If we have both boxes and texts, process them
                    if boxes is not None and texts is not None:
                        if scores is None:
                            scores = [1.0] * len(texts)

                        # Match boxes with texts
                        for box, text, score in zip(boxes, texts, scores):
                            if text and text.strip():
                                # Calculate center point
                                if len(box) >= 4:
                                    # box is array of points [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                                    box_list = box.tolist() if hasattr(box, 'tolist') else list(box)
                                    center_x = sum(point[0] for point in box_list) / len(box_list)
                                    center_y = sum(point[1] for point in box_list) / len(box_list)

                                    # Calculate bounding box
                                    x_coords = [point[0] for point in box_list]
                                    y_coords = [point[1] for point in box_list]
                                    left = min(x_coords)
                                    top = min(y_coords)
                                    right = max(x_coords)
                                    bottom = max(y_coords)

                                    recognized_texts.append({
                                        "text": text,
                                        "confidence": float(score),
                                        "box": box_list,
                                        "center": (int(center_x), int(center_y)),
                                        "bbox": (int(left), int(top), int(right), int(bottom))
                                    })

                except Exception as e:
                    ColorPrint.red(f"[ERROR] Error processing OCR result: {e}")

            elapsed_time = time.time() - start_time
            ColorPrint.green(f"[OCR] Recognized {len(recognized_texts)} text(s) in {elapsed_time:.2f}s")

            # Print recognized texts
            for i, item in enumerate(recognized_texts, 1):
                ColorPrint.blue(f"   [{i}] '{item['text']}' (confidence: {item['confidence']:.2f}, center: {item['center']})")

            return recognized_texts

        except Exception as e:
            ColorPrint.red(f"[ERROR] Text recognition failed: {e}")
            return None

    def get_full_text(self, image_path: str) -> Optional[str]:
        """
        Get all recognized text as a single string

        Args:
            image_path: Path to image file

        Returns:
            Combined text string, or None if failed
        """
        results = self.recognize_text(image_path)
        if results is None:
            return None

        return "\n".join(item["text"] for item in results if item["text"])

    def is_ready(self) -> bool:
        """Check if OCR is ready to use"""
        return self.is_initialized and self.ocr_instance is not None

    def get_status(self) -> Dict[str, Any]:
        """Get current OCR status"""
        return {
            "initialized": self.is_initialized,
            "ready": self.is_ready(),
            "language": self.lang,
            "installation_status": self._check_installation_status(),
            "error": self.initialization_error
        }


def main():
    """Test function"""
    ColorPrint.blue("\n[TEST] Testing PaddleOCR Engine...")

    # Create OCR instance (will auto-install if needed)
    ocr = PaddleOCREngine(lang="chinese_cht", auto_init=True)

    # Check status
    status = ocr.get_status()
    ColorPrint.blue(f"\n[STATUS] PaddleOCR Status: {status}")

    if ocr.is_ready():
        ColorPrint.green("\n[TEST] PaddleOCR Engine is ready for text recognition!")
    else:
        ColorPrint.red("\n[TEST] PaddleOCR Engine initialization failed")


if __name__ == "__main__":
    main()
