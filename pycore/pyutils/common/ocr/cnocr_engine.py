"""
CnOCR Engine for local OCR processing with scene-specific models
Supports different model types: scene, doc, number, general, english, chinese_traditional
"""

import os
import time
from pathlib import Path
from typing import Dict, Any, Optional, List

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    REC_MORE_CONFIGS_CNOCR,
    get_third_package_cnocr,
)
from pycore.pyutils.common.ocr.result import OCRResult


_REC_MORE_CONFIGS = REC_MORE_CONFIGS_CNOCR


class CnOCREngine:
    """CnOCR local OCR engine with scene-specific models"""

    def __init__(self, model_type: str = "general", model_name: Optional[str] = None):
        """
        Initialize CnOCR engine

        Args:
            model_type: Model type - scene, doc, number, general, english, chinese_traditional
            model_name: Specific model name (optional)
        """
        # Model configurations for different scenarios (must be defined first)
        self.model_configs = {
            "scene": {
                "models": ["scene-densenet_lite_136-gru", "densenet_lite_136-gru"],
                "description": "Optimized for general scene photos with text"
            },
            "doc": {
                "models": ["doc-densenet_lite_136-gru", "densenet_lite_136-gru"],
                "description": "Optimized for document screenshots and scans"
            },
            "number": {
                "models": ["number-densenet_lite_136-gru", "densenet_lite_136-gru"],
                "description": "Optimized for number recognition (0-9 only)"
            },
            "general": {
                "models": ["densenet_lite_136-gru"],
                "description": "General purpose model for mixed content"
            },
            "english": {
                "models": ["en_PP-OCRv3"],
                "description": "Optimized for English text"
            },
            "chinese_traditional": {
                "models": ["chinese_cht_PP-OCRv3"],
                "description": "Optimized for Traditional Chinese"
            }
        }

        self.model_type = model_type
        self.model_name = model_name or self._get_default_model(model_type)
        self.ocr_instance = None
        self.is_initialized = False
        self.initialization_error = None
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp']
        self.max_file_size = 50 * 1024 * 1024  # 50MB limit for local processing

    def _get_default_model(self, model_type: str) -> str:
        """Get default model name for given type"""
        return self.model_configs.get(model_type, {}).get("models", ["densenet_lite_136-gru"])[0]

    def initialize(self) -> bool:
        """Initialize CnOCR engine"""
        if self.is_initialized:
            return True

        ColorPrint.blue(f"[INFO] Initializing CnOCR engine with model type: {self.model_type}")

        cnocr_module = get_third_package_cnocr()
        if cnocr_module is None:
            self.initialization_error = "CnOCR is not available"
            ColorPrint.red(f"[ERROR] {self.initialization_error}")
            return False
        CnOcr = cnocr_module.CnOcr

        # Try to initialize with primary model
        models_to_try = self.model_configs.get(self.model_type, {}).get("models", [self.model_name])

        for model in models_to_try:
            ColorPrint.blue(f"[INFO] Trying to initialize CnOCR with model: {model}")

            # Initialize CnOCR instance. rec_more_configs (font_path) is required
            # by some recognizers (en_PP-OCRv3, *_cht_*) — pass it everywhere.
            if self.model_type == "english":
                self.ocr_instance = CnOcr(
                    det_model_name='en_PP-OCRv3_det',
                    rec_model_name=model,
                    rec_more_configs=_REC_MORE_CONFIGS,
                )
            elif self.model_type == "chinese_traditional":
                self.ocr_instance = CnOcr(rec_model_name=model, rec_more_configs=_REC_MORE_CONFIGS)
            elif self.model_type == "doc":
                # For document images, use naive detection for better layout
                self.ocr_instance = CnOcr(
                    det_model_name='naive_det',
                    rec_model_name=model,
                    rec_more_configs=_REC_MORE_CONFIGS,
                )
            else:
                # Default configuration for scene, number, general
                self.ocr_instance = CnOcr(rec_model_name=model, rec_more_configs=_REC_MORE_CONFIGS)

            ColorPrint.green(f"[SUCCESS] CnOCR model {model} initialized successfully")
            self.model_name = model
            break

        if self.ocr_instance is None:
            self.initialization_error = f"Failed to initialize any CnOCR model for type {self.model_type}"
            ColorPrint.red(f"[ERROR] {self.initialization_error}")
            return False

        self.is_initialized = True
        ColorPrint.green(f"[SUCCESS] CnOCR engine initialized with model: {self.model_name}")
        return True

    def _prepare_image(self, image_path: str) -> Optional[str]:
        """Prepare image for CnOCR processing"""
        if not os.path.exists(image_path):
            ColorPrint.red(f"[ERROR] Image file not found: {image_path}")
            return None

        # Check file size
        file_size = os.path.getsize(image_path)
        if file_size > self.max_file_size:
            ColorPrint.yellow(f"[WARNING] File size {file_size} bytes exceeds local processing limit")

        # Check format
        file_ext = Path(image_path).suffix.lower()
        if file_ext not in self.supported_formats:
            ColorPrint.red(f"[ERROR] Unsupported image format: {file_ext}")
            return None

        return image_path

    def _parse_response(self, cnocr_result) -> OCRResult:
        """Parse CnOCR response"""
        result = OCRResult()
        result.provider = f"CnOCR-{self.model_type}"
        result.raw_response = cnocr_result

        if not cnocr_result or len(cnocr_result) == 0:
            result.error = "No text found in image"
            return result

        # Process CnOCR results
        all_text = []
        all_words = []
        total_confidence = 0.0
        word_count = 0

        # Debug: show first detection structure
        if cnocr_result and len(cnocr_result) > 0:
            ColorPrint.yellow(f"[DEBUG] First CnOCR detection structure: {cnocr_result[0]}")
            ColorPrint.yellow(f"[DEBUG] Detection keys: {list(cnocr_result[0].keys())}")

        for detection in cnocr_result:
            if detection and 'text' in detection:
                text = detection.get('text', '').strip()
                confidence = detection.get('score', 0.0)

                if text:
                    all_text.append(text)

                    # Create word info
                    word_info = {
                        "text": text,
                        "confidence": confidence,
                        "score": confidence  # Add score as alias for compatibility
                    }

                    # Extract bounding box if available
                    if 'position' in detection:
                        position = detection['position']
                        if isinstance(position, list) and len(position) >= 4:
                            # Convert position to standard bbox format
                            x_coords = [p[0] for p in position]
                            y_coords = [p[1] for p in position]
                            word_info["bbox"] = {
                                "left": min(x_coords),
                                "top": min(y_coords),
                                "width": max(x_coords) - min(x_coords),
                                "height": max(y_coords) - min(y_coords)
                            }
                            word_info["position"] = position
                            ColorPrint.green(f"[DEBUG] Word '{text}' has bbox: {word_info['bbox']}")
                    else:
                        ColorPrint.yellow(f"[DEBUG] Word '{text}' has NO 'position' in detection")
                        ColorPrint.yellow(f"[DEBUG] Detection data: {detection}")

                    all_words.append(word_info)
                    total_confidence += confidence
                    word_count += 1

        # Combine results
        result.text = "\n".join(all_text)
        result.words = all_words
        result.confidence = total_confidence / word_count if word_count > 0 else 0
        result.success = True

        return result

    def recognize(self, image_path: str, **kwargs) -> OCRResult:
        """Recognize text from image using CnOCR"""
        start_time = time.time()

        # Initialize if not already done
        if not self.is_initialized:
            if not self.initialize():
                result = OCRResult()
                result.provider = f"CnOCR-{self.model_type}"
                result.error = self.initialization_error or "CnOCR initialization failed"
                return result

        ColorPrint.blue(f"[INFO] Starting CnOCR recognition: {image_path}")

        # Prepare image
        prepared_path = self._prepare_image(image_path)
        if not prepared_path:
            result = OCRResult()
            result.provider = f"CnOCR-{self.model_type}"
            result.error = "Image preparation failed"
            return result

        # Perform OCR
        cnocr_result = self.ocr_instance.ocr(prepared_path)

        # Parse response
        result = self._parse_response(cnocr_result)
        result.processing_time = time.time() - start_time

        ColorPrint.green(f"[SUCCESS] CnOCR completed in {result.processing_time:.2f}s")
        return result

    def get_model_info(self) -> Dict[str, Any]:
        """Get current model information"""
        return {
            "provider": "CnOCR",
            "model_type": self.model_type,
            "model_name": self.model_name,
            "is_initialized": self.is_initialized,
            "supported_formats": self.supported_formats,
            "max_file_size": self.max_file_size,
            "available_types": list(self.model_configs.keys())
        }


__all__ = ['CnOCREngine']
