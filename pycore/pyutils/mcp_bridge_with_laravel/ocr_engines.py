#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR Engines Module for Document Parser
Supports multiple OCR providers: Free OCR, PaddleOCR Local, CnOCR Local
"""

import os
import sys
import json
import base64
import logging
import time
import tempfile
import importlib.util
from typing import Dict, Any, Optional, List, Union
from pathlib import Path

from pycore.pyfoundations.third_party import get_third_package_requests

from pycore.pyutils.mcp_bridge_with_laravel.cnocr_engine import CnOCREngine


requests = get_third_package_requests()

# Check for optional dependencies at module level
_paddleocr_available = importlib.util.find_spec("paddleocr") is not None
_paddle_available = importlib.util.find_spec("paddle") is not None
_cnocr_available = importlib.util.find_spec("cnocr") is not None

# Import if available
if _paddleocr_available:
    from paddleocr import PaddleOCR
else:
    PaddleOCR = None

if _paddle_available:
    import paddle
else:
    paddle = None

if _cnocr_available:
    import cnocr
else:
    cnocr = None

# Configure logging
logger = logging.getLogger(__name__)

# Default API Keys
DEFAULT_FREE_OCR_API_KEY = "K84414795888957"  # Official OCR.space free API key

class OCRResult:
    """OCR result data structure"""

    def __init__(self):
        self.success = False
        self.text = ""
        self.confidence = 0.0
        self.words = []
        self.lines = []
        self.error = ""
        self.provider = ""
        self.processing_time = 0.0
        self.raw_response = {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "success": self.success,
            "text": self.text,
            "confidence": self.confidence,
            "words": self.words,
            "lines": self.lines,
            "error": self.error,
            "provider": self.provider,
            "processing_time": self.processing_time,
            "raw_response": self.raw_response
        }

class FreeOCREngine:
    """Free OCR service implementation"""

    def __init__(self, api_key: str = None):
        self.base_url = "https://api.ocr.space/parse/image"
        # Use provided API key, environment variable, default official key, or demo key as fallback
        self.api_key = api_key or os.getenv('OCRSPACE_API_KEY') or DEFAULT_FREE_OCR_API_KEY
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.bmp', '.tiff']
        self.max_file_size = 1024 * 1024  # 1MB limit for free tier

        # Note about API key status
        if self.api_key == "helloworld":
            logger.warning("Using demo API key. Register at https://ocr.space/ocrapi for free API key (500 requests/day)")
        elif self.api_key == DEFAULT_FREE_OCR_API_KEY:
            logger.info("Using official Free OCR API key (500 requests/day limit)")
        else:
            logger.info("Using custom Free OCR API key")

    def _prepare_image(self, image_path: str) -> Optional[str]:
        """Prepare image for OCR processing"""
        try:
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image file not found: {image_path}")

            # Check file size
            file_size = os.path.getsize(image_path)
            if file_size > self.max_file_size:
                logger.warning(f"File size {file_size} bytes exceeds free tier limit")
                # Could implement image compression here

            # Check format
            file_ext = Path(image_path).suffix.lower()
            if file_ext not in self.supported_formats:
                raise ValueError(f"Unsupported image format: {file_ext}")

            return image_path

        except Exception as e:
            logger.error(f"Image preparation failed: {e}")
            return None

    def _make_request(self, image_path: str, **kwargs) -> Dict[str, Any]:
        """Make OCR API request"""
        try:
            # Prepare parameters
            payload = {
                'apikey': self.api_key,
                'language': kwargs.get('language', 'chs'),  # Chinese Simplified
                'isOverlayRequired': kwargs.get('overlay', True),  # Enable overlay for position info
                'detectOrientation': kwargs.get('detect_orientation', True),
                'scale': kwargs.get('scale', True),
                'isTable': kwargs.get('is_table', False),
                'OCREngine': kwargs.get('engine', 2)  # Engine 2 for better accuracy
            }

            # Prepare file
            with open(image_path, 'rb') as f:
                files = {'file': (os.path.basename(image_path), f, 'application/octet-stream')}

                # Make request
                response = requests.post(
                    self.base_url,
                    files=files,
                    data=payload,
                    timeout=kwargs.get('timeout', 30)
                )

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"OCR API request failed: {e}")
            return {"IsErroredOnProcessing": True, "ErrorMessage": str(e)}
        except Exception as e:
            logger.error(f"OCR request preparation failed: {e}")
            return {"IsErroredOnProcessing": True, "ErrorMessage": str(e)}

    def _parse_response(self, response_data: Dict[str, Any]) -> OCRResult:
        """Parse OCR API response"""
        result = OCRResult()
        result.provider = "FreeOCR"
        result.raw_response = response_data

        try:
            if response_data.get("IsErroredOnProcessing", False):
                result.error = response_data.get("ErrorMessage", "Unknown error")
                return result

            parsed_results = response_data.get("ParsedResults", [])
            if not parsed_results:
                result.error = "No text found in image"
                return result

            # Extract text and confidence
            all_text = []
            all_words = []
            all_lines = []
            total_confidence = 0

            for parsed_result in parsed_results:
                # Main text
                text = parsed_result.get("ParsedText", "")
                if text:
                    all_text.append(text.strip())

                # Extract overlay data with positions
                overlay_data = parsed_result.get("TextOverlay", {})
                has_overlay = overlay_data.get("HasOverlay", False)

                if has_overlay:
                    # Extract line-level and word-level data
                    lines = overlay_data.get("Lines", [])

                    for line_idx, line in enumerate(lines):
                        line_text = line.get("LineText", "")
                        line_info = {
                            "line_number": line_idx + 1,
                            "text": line_text,
                            "bbox": {
                                "left": line.get("MinLeft", 0),
                                "top": line.get("MinTop", 0),
                                "width": line.get("MaxWidth", 0),
                                "height": line.get("MaxHeight", 0)
                            },
                            "words": []
                        }

                        line_words = line.get("Words", [])
                        for word_idx, word in enumerate(line_words):
                            word_info = {
                                "word_number": word_idx + 1,
                                "text": word.get("WordText", ""),
                                "confidence": word.get("Confidence", 0),
                                "bbox": {
                                    "left": word.get("Left", 0),
                                    "top": word.get("Top", 0),
                                    "width": word.get("Width", 0),
                                    "height": word.get("Height", 0)
                                }
                            }
                            line_info["words"].append(word_info)
                            all_words.append(word_info)
                            total_confidence += word.get("Confidence", 0)

                        all_lines.append(line_info)

            # Combine results
            result.text = "\n".join(all_text)
            result.words = all_words
            result.lines = all_lines
            result.confidence = total_confidence / len(all_words) if all_words else 0
            result.success = True

            return result

        except Exception as e:
            logger.error(f"Response parsing failed: {e}")
            result.error = f"Response parsing failed: {e}"
            return result

    def recognize(self, image_path: str, **kwargs) -> OCRResult:
        """Perform OCR recognition on image"""
        start_time = time.time()

        try:
            logger.info(f"Starting Free OCR recognition: {image_path}")

            # Prepare image
            prepared_path = self._prepare_image(image_path)
            if not prepared_path:
                result = OCRResult()
                result.provider = "FreeOCR"
                result.error = "Image preparation failed"
                return result

            # Make API request
            response_data = self._make_request(prepared_path, **kwargs)

            # Parse response
            result = self._parse_response(response_data)
            result.processing_time = time.time() - start_time

            logger.info(f"Free OCR completed in {result.processing_time:.2f}s")
            return result

        except Exception as e:
            logger.error(f"Free OCR recognition failed: {e}")
            result = OCRResult()
            result.provider = "FreeOCR"
            result.error = str(e)
            result.processing_time = time.time() - start_time
            return result

class PaddleOCREngine:
    """PaddleOCR local engine implementation"""

    def __init__(self, model_dir: str = None):
        self.model_dir = model_dir or os.getenv('PADDLE_OCR_MODEL_DIR')
        self.ocr_instance = None
        self.is_initialized = False
        self.initialization_error = None
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.bmp', '.pdf', '.tiff', '.webp']
        self.max_file_size = 50 * 1024 * 1024  # 50MB for local processing

        logger.info("PaddleOCR engine initialized")

    def initialize(self) -> bool:
        """Initialize PaddleOCR engine"""
        try:
            if self.is_initialized:
                return True

            # Check if PaddleOCR is available
            if not _paddleocr_available or PaddleOCR is None:
                self.initialization_error = "PaddleOCR not installed. Install with: pip install paddleocr"
                logger.error(self.initialization_error)
                return False

            # Initialize PaddleOCR instance with basic configuration
            self.ocr_instance = PaddleOCR(
                use_angle_cls=True,
                lang='ch',  # Support Chinese by default
                show_log=False
                # Removed GPU and other advanced options for compatibility
            )

            self.is_initialized = True
            logger.info("PaddleOCR engine initialized successfully")
            return True

        except Exception as e:
            self.initialization_error = f"PaddleOCR initialization failed: {str(e)}"
            logger.error(self.initialization_error)
            return False

    def _check_gpu_support(self) -> bool:
        """Check if GPU support is available"""
        if not _paddle_available or paddle is None:
            return False
        try:
            return paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0
        except:
            return False

    def _prepare_image(self, image_path: str) -> Optional[str]:
        """Prepare image for PaddleOCR processing"""
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

    def _parse_response(self, paddle_result) -> OCRResult:
        """Parse PaddleOCR response"""
        result = OCRResult()
        result.provider = "PaddleOCR"
        result.raw_response = paddle_result

        try:
            if paddle_result is None or len(paddle_result) == 0:
                result.error = "No text found in image"
                return result

            # Process PaddleOCR results
            all_text = []
            all_words = []
            total_confidence = 0.0
            box_count = 0

            for line in paddle_result:
                if line:
                    for box_info in line:
                        if len(box_info) >= 2:
                            text = box_info[1][0] if box_info[1] else ""
                            confidence = box_info[1][1] if len(box_info[1]) > 1 else 0.0
                            bbox_points = box_info[0] if box_info[0] else []

                            if text.strip():
                                all_text.append(text)

                                # Create word info
                                word_info = {
                                    "text": text,
                                    "confidence": confidence,
                                    "bbox_points": bbox_points
                                }

                                # Extract bounding box if available
                                if bbox_points and len(bbox_points) >= 4:
                                    x_coords = [point[0] for point in bbox_points]
                                    y_coords = [point[1] for point in bbox_points]
                                    word_info["bbox"] = {
                                        "left": min(x_coords),
                                        "top": min(y_coords),
                                        "width": max(x_coords) - min(x_coords),
                                        "height": max(y_coords) - min(y_coords)
                                    }

                                all_words.append(word_info)
                                total_confidence += confidence
                                box_count += 1

            # Combine results
            result.text = "\n".join(all_text)
            result.words = all_words
            result.confidence = total_confidence / box_count if box_count > 0 else 0
            result.success = True

            return result

        except Exception as e:
            logger.error(f"PaddleOCR response parsing failed: {e}")
            result.error = f"Response parsing failed: {e}"
            return result

    def recognize(self, image_path: str, **kwargs) -> OCRResult:
        """Perform OCR recognition on image"""
        start_time = time.time()

        try:
            # Initialize if not already done
            if not self.is_initialized:
                if not self.initialize():
                    result = OCRResult()
                    result.provider = "PaddleOCR"
                    result.error = self.initialization_error or "PaddleOCR initialization failed"
                    return result

            logger.info(f"Starting PaddleOCR recognition: {image_path}")

            # Prepare image
            prepared_path = self._prepare_image(image_path)
            if not prepared_path:
                result = OCRResult()
                result.provider = "PaddleOCR"
                result.error = "Image preparation failed"
                return result

            # Perform OCR
            paddle_result = self.ocr_instance.ocr(prepared_path, cls=True)

            # Parse response
            result = self._parse_response(paddle_result)
            result.processing_time = time.time() - start_time

            logger.info(f"PaddleOCR completed in {result.processing_time:.2f}s")
            return result

        except Exception as e:
            logger.error(f"PaddleOCR recognition failed: {e}")
            result = OCRResult()
            result.provider = "PaddleOCR"
            result.error = str(e)
            result.processing_time = time.time() - start_time
            return result

class OCRManager:
    """OCR Manager to handle multiple OCR engines"""

    def __init__(self):
        self.engines = {
            'free': FreeOCREngine(),
            'paddle': PaddleOCREngine(),
            'cnocr': None  # Will be initialized on demand
        }
        self.default_engine = 'free'

    def add_engine(self, name: str, engine):
        """Add custom OCR engine"""
        self.engines[name] = engine

    def set_paddle_model_dir(self, model_dir: str):
        """Set PaddleOCR model directory"""
        self.engines['paddle'] = PaddleOCREngine(model_dir)

    def set_free_ocr_key(self, api_key: str):
        """Set Free OCR API key"""
        self.engines['free'] = FreeOCREngine(api_key)

    def initialize_paddle_ocr(self) -> bool:
        """Initialize PaddleOCR engine"""
        if 'paddle' in self.engines:
            return self.engines['paddle'].initialize()
        return False

    def initialize_cnocr(self, model_type: str = "general") -> bool:
        """Initialize CnOCR engine"""
        try:
            self.engines['cnocr'] = CnOCREngine(model_type=model_type)
            return self.engines['cnocr'].initialize()
        except ImportError:
            logger.error("CnOCR engine not available")
            return False
        except Exception as e:
            logger.error(f"CnOCR initialization failed: {e}")
            return False

    def set_cnocr_model(self, model_type: str):
        """Set CnOCR model type"""
        try:
            self.engines['cnocr'] = CnOCREngine(model_type=model_type)
        except ImportError:
            logger.error("CnOCR engine not available")

    def get_available_engines(self) -> List[str]:
        """Get list of available OCR engines"""
        available = []
        for name, engine in self.engines.items():
            if name == 'free':
                available.append(name)
            elif name == 'paddle':
                # Check if PaddleOCR is available
                if _paddle_available and _paddleocr_available:
                    available.append(name)
            elif name == 'cnocr':
                # Check if CnOCR is available
                if _cnocr_available:
                    available.append(name)
        return available

    def recognize(self, image_path: str, engine: str = None, **kwargs) -> OCRResult:
        """Perform OCR recognition using specified engine"""
        try:
            # Use default engine if not specified
            if not engine:
                engine = self.default_engine

            # Check if engine is available
            if engine not in self.engines:
                result = OCRResult()
                result.error = f"OCR engine '{engine}' not available"
                return result

            # Get engine instance
            ocr_engine = self.engines[engine]

            # Initialize CnOCR on demand if needed
            if engine == 'cnocr' and ocr_engine is None:
                model_type = kwargs.get('content_type', 'general')
                if not self.initialize_cnocr(model_type):
                    result = OCRResult()
                    result.error = "CnOCR initialization failed"
                    return result
                ocr_engine = self.engines[engine]

            # Perform recognition
            return ocr_engine.recognize(image_path, **kwargs)

        except Exception as e:
            logger.error(f"OCR recognition failed: {e}")
            result = OCRResult()
            result.error = str(e)
            return result

    def recognize_with_fallback(self, image_path: str, engines: List[str] = None, **kwargs) -> OCRResult:
        """Perform OCR with fallback to other engines"""
        if not engines:
            engines = self.get_available_engines()

        last_error = ""
        for engine in engines:
            try:
                logger.info(f"Trying OCR engine: {engine}")
                result = self.recognize(image_path, engine, **kwargs)

                if result.success:
                    logger.info(f"OCR successful with engine: {engine}")
                    return result
                else:
                    last_error = result.error
                    logger.warning(f"OCR failed with {engine}: {result.error}")

            except Exception as e:
                last_error = str(e)
                logger.error(f"OCR engine {engine} crashed: {e}")
                continue

        # All engines failed
        result = OCRResult()
        result.error = f"All OCR engines failed. Last error: {last_error}"
        return result

# Global OCR manager instance
ocr_manager = OCRManager()