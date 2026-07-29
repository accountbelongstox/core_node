"""
CnOCR Engine for local OCR processing with scene-specific models
Supports different model types: scene, doc, number, general
"""

import os
import sys
import time
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from pycore.pyfoundations.pybasecommon.commander import exec_silent, exec_realtime
from pycore.pyfoundations.pybasecommon.compute_caps import get_cnocr_pip_package

# Get logger
logger = logging.getLogger(__name__)

# Import OCRResult from base module
from .ocr_result import OCRResult

class CnOCREngine:
    """CnOCR local OCR engine with scene-specific models"""

    def __init__(self, model_type: str = "general", model_name: Optional[str] = None):
        """
        Initialize CnOCR engine

        Args:
            model_type: Model type - scene, doc, number, general
            model_name: Specific model name (optional)
        """
        self.model_type = model_type
        self.model_name = model_name or self._get_default_model(model_type)
        self.ocr_instance = None
        self.is_initialized = False
        self.initialization_error = None
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif']
        self.max_file_size = 50 * 1024 * 1024  # 50MB limit for local processing

        # Model configurations for different scenarios
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

    def _get_default_model(self, model_type: str) -> str:
        """Get default model name for given type"""
        return self.model_configs.get(model_type, {}).get("models", ["densenet_lite_136-gru"])[0]

    def initialize(self) -> bool:
        """Initialize CnOCR engine"""
        if self.is_initialized:
            return True

        try:
            logger.info(f"Initializing CnOCR engine with model type: {self.model_type}")

            # Check if CnOCR is available
            try:
                pass
            except ImportError as e:
                self.initialization_error = f"CnOCR not installed: {str(e)}"
                logger.error(self.initialization_error)
                return False

            # Try to initialize with primary model
            models_to_try = self.model_configs.get(self.model_type, {}).get("models", [self.model_name])

            for model in models_to_try:
                try:
                    logger.info(f"Trying to initialize CnOCR with model: {model}")

                    # Initialize CnOCR instance
                    if self.model_type == "english":
                        self.ocr_instance = CnOcr(
                            det_model_name='en_PP-OCRv3_det',
                            rec_model_name=model
                        )
                    elif self.model_type == "chinese_traditional":
                        self.ocr_instance = CnOcr(rec_model_name=model)
                    elif self.model_type == "doc":
                        # For document images, use naive detection for better layout
                        self.ocr_instance = CnOcr(
                            det_model_name='naive_det',
                            rec_model_name=model
                        )
                    else:
                        # Default configuration for scene, number, general
                        self.ocr_instance = CnOcr(rec_model_name=model)

                    # Test initialization with a simple operation
                    # This will download the model if not available
                    logger.info(f"CnOCR model {model} initialized successfully")
                    self.model_name = model
                    break

                except Exception as model_error:
                    logger.warning(f"Failed to initialize model {model}: {model_error}")
                    continue

            if self.ocr_instance is None:
                self.initialization_error = f"Failed to initialize any CnOCR model for type {self.model_type}"
                logger.error(self.initialization_error)
                return False

            self.is_initialized = True
            logger.info(f"CnOCR engine initialized successfully with model: {self.model_name}")
            return True

        except Exception as e:
            self.initialization_error = f"CnOCR initialization failed: {str(e)}"
            logger.error(self.initialization_error)
            return False

    def _prepare_image(self, image_path: str) -> Optional[str]:
        """Prepare image for CnOCR processing"""
        try:
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image file not found: {image_path}")

            # Check file size
            file_size = os.path.getsize(image_path)
            if file_size > self.max_file_size:
                logger.warning(f"File size {file_size} bytes exceeds local processing limit")

            # Check format
            file_ext = Path(image_path).suffix.lower()
            if file_ext not in self.supported_formats:
                raise ValueError(f"Unsupported image format: {file_ext}")

            return image_path

        except Exception as e:
            logger.error(f"Image preparation failed: {e}")
            return None

    def _parse_response(self, cnocr_result) -> OCRResult:
        """Parse CnOCR response"""
        result = OCRResult()
        result.provider = f"CnOCR-{self.model_type}"
        result.raw_response = cnocr_result

        try:
            if not cnocr_result or len(cnocr_result) == 0:
                result.error = "No text found in image"
                return result

            # Process CnOCR results
            all_text = []
            all_words = []
            total_confidence = 0.0
            word_count = 0

            for detection in cnocr_result:
                if detection and 'text' in detection:
                    text = detection.get('text', '').strip()
                    confidence = detection.get('score', 0.0)

                    if text:
                        all_text.append(text)

                        # Create word info
                        word_info = {
                            "text": text,
                            "confidence": confidence
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

                        all_words.append(word_info)
                        total_confidence += confidence
                        word_count += 1

            # Combine results
            result.text = "\n".join(all_text)
            result.words = all_words
            result.confidence = total_confidence / word_count if word_count > 0 else 0
            result.success = True

            return result

        except Exception as e:
            logger.error(f"CnOCR response parsing failed: {e}")
            result.error = f"Response parsing failed: {e}"
            return result

    def recognize(self, image_path: str, **kwargs) -> OCRResult:
        """Recognize text from image using CnOCR"""
        start_time = time.time()

        try:
            # Initialize if not already done
            if not self.is_initialized:
                if not self.initialize():
                    result = OCRResult()
                    result.provider = f"CnOCR-{self.model_type}"
                    result.error = self.initialization_error or "CnOCR initialization failed"
                    return result

            logger.info(f"Starting CnOCR recognition: {image_path}")

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

            logger.info(f"CnOCR completed in {result.processing_time:.2f}s")
            return result

        except Exception as e:
            logger.error(f"CnOCR recognition failed: {e}")
            result = OCRResult()
            result.provider = f"CnOCR-{self.model_type}"
            result.error = str(e)
            result.processing_time = time.time() - start_time
            return result

    @staticmethod
    def install_dependencies():
        """Install CnOCR dependencies via get_cnocr_pip_package() (GPU/CPU per CUDADetector); install latest (--upgrade)."""
        try:
            logger.info("Installing CnOCR dependencies...")
            pip_pkg = get_cnocr_pip_package()
            result = exec_silent([
                sys.executable, "-m", "pip", "install", "--upgrade",
                pip_pkg,
                "-i", "https://mirrors.aliyun.com/pypi/simple"
            ], capture_output=True, text=True, timeout=300)

            if result.return_code != 0:
                logger.error(f"CnOCR installation failed: {result.stderr}")
                return False

            logger.info("CnOCR dependencies installed successfully")
            return True

        except Exception as e:
            logger.error(f"CnOCR dependency installation failed: {e}")
            return False

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
