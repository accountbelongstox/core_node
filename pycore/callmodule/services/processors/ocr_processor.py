# -*- coding: utf-8 -*-
"""
OCR Processor - Core logic for OCR processing
"""

import time
from typing import Dict, Any, List, Optional
from pathlib import Path

import pycore.pyutils.ocr_cluster.ocr.ocr_manager as ocr_manager
from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image



class OCRProcessor:
    """Processor for OCR (Optical Character Recognition)"""

    def __init__(self):
        self._paddleocr = None
        self._easyocr = None
        self._tesseract = None

    def _get_paddleocr(self):
        """Lazy load PaddleOCR"""
        if self._paddleocr is None:
            try:
                self._paddleocr = ocr_manager
            except ImportError:
                raise RuntimeError("PaddleOCR not available. Check pycore.pyutils.ocr_manager")
        return self._paddleocr

    def _get_easyocr(self, languages: List[str]):
        """Lazy load EasyOCR"""
        if self._easyocr is None:
            try:
                self._easyocr = easyocr.Reader(languages)
            except ImportError:
                raise RuntimeError("EasyOCR not available. Install with: pip install easyocr")
        return self._easyocr

    def _get_tesseract(self):
        """Check Tesseract availability"""
        try:
            return pytesseract
        except ImportError:
            raise RuntimeError("Tesseract not available. Install with: pip install pytesseract")

    def process_image(self, image_path: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform OCR on image.

        Args:
            image_path: Path to image file
            config: OCR configuration
                - engine: OCR engine (paddleocr, easyocr, tesseract)
                - language: Language code
                - confidence_threshold: Minimum confidence threshold

        Returns:
            Dictionary with OCR result
        """
        start_time = time.time()

        try:
            engine = config.get("engine", "paddleocr")
            language = config.get("language", "ch")
            confidence_threshold = config.get("confidence_threshold", 0.5)

            # Check if image exists
            if not Path(image_path).exists():
                return {
                    "success": False,
                    "error": f"Image file not found: {image_path}",
                    "execution_time": time.time() - start_time
                }

            # Perform OCR based on engine
            if engine == "paddleocr":
                result = self._ocr_with_paddleocr(image_path, language, confidence_threshold)
            elif engine == "easyocr":
                result = self._ocr_with_easyocr(image_path, language, confidence_threshold)
            elif engine == "tesseract":
                result = self._ocr_with_tesseract(image_path, language)
            else:
                return {
                    "success": False,
                    "error": f"Unknown OCR engine: {engine}",
                    "execution_time": time.time() - start_time
                }

            result["execution_time"] = time.time() - start_time
            result["engine_used"] = engine
            return result

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "execution_time": time.time() - start_time
            }

    def _ocr_with_paddleocr(self, image_path: str, language: str, threshold: float) -> Dict[str, Any]:
        """OCR using PaddleOCR"""
        try:
            ocr_manager = self._get_paddleocr()
            result = ocr_manager.ocr(image_path)

            if not result or not result.get("success"):
                return {
                    "success": False,
                    "error": "PaddleOCR failed to process image"
                }

            # Extract text blocks
            text_blocks = []
            full_text_parts = []
            total_confidence = 0.0
            count = 0

            for block in result.get("blocks", []):
                confidence = block.get("confidence", 0.0)
                if confidence >= threshold:
                    text = block.get("text", "")
                    bbox = block.get("bbox", [0, 0, 0, 0])

                    text_blocks.append({
                        "text": text,
                        "confidence": confidence,
                        "bbox": bbox
                    })

                    full_text_parts.append(text)
                    total_confidence += confidence
                    count += 1

            return {
                "success": True,
                "full_text": "\n".join(full_text_parts),
                "text_blocks": text_blocks,
                "average_confidence": total_confidence / count if count > 0 else 0.0,
                "language": language
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"PaddleOCR error: {str(e)}"
            }

    def _ocr_with_easyocr(self, image_path: str, language: str, threshold: float) -> Dict[str, Any]:
        """OCR using EasyOCR"""
        try:
            # Map language codes
            lang_map = {"ch": "ch_sim", "en": "en"}
            easyocr_lang = lang_map.get(language, language)

            reader = self._get_easyocr([easyocr_lang])
            results = reader.readtext(image_path)

            text_blocks = []
            full_text_parts = []
            total_confidence = 0.0
            count = 0

            for (bbox, text, confidence) in results:
                if confidence >= threshold:
                    # Convert bbox format
                    x_coords = [p[0] for p in bbox]
                    y_coords = [p[1] for p in bbox]
                    x, y = min(x_coords), min(y_coords)
                    w, h = max(x_coords) - x, max(y_coords) - y

                    text_blocks.append({
                        "text": text,
                        "confidence": float(confidence),
                        "bbox": [int(x), int(y), int(w), int(h)]
                    })

                    full_text_parts.append(text)
                    total_confidence += confidence
                    count += 1

            return {
                "success": True,
                "full_text": "\n".join(full_text_parts),
                "text_blocks": text_blocks,
                "average_confidence": total_confidence / count if count > 0 else 0.0,
                "language": language
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"EasyOCR error: {str(e)}"
            }

    def _ocr_with_tesseract(self, image_path: str, language: str) -> Dict[str, Any]:
        """OCR using Tesseract"""
        try:
            pytesseract = self._get_tesseract()
            Image = get_third_package_PIL_Image()

            image = Image.open(image_path)
            text = pytesseract.image_to_string(image, lang=language)

            return {
                "success": True,
                "full_text": text.strip(),
                "text_blocks": [],  # Tesseract doesn't provide block-level results easily
                "average_confidence": None,
                "language": language
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Tesseract error: {str(e)}"
            }
