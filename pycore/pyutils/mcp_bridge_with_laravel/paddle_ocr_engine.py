#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PaddleOCR Local Engine Implementation
Provides offline OCR capabilities using PaddlePaddle framework
"""

import os
import sys
import time
import logging
import importlib.util
import importlib
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import tempfile
import subprocess

from ocr_config import OCRLimits, APIKeys

# Check for optional dependencies at module level
_paddle_available = importlib.util.find_spec("paddle") is not None
_paddleocr_available = importlib.util.find_spec("paddleocr") is not None

# Import paddle if available (for GPU checks)
if _paddle_available:
    paddle = importlib.import_module("paddle")
else:
    paddle = None

class PaddleOCREngine:
    """PaddleOCR local engine for offline text recognition"""

    def __init__(self, model_dir: Optional[str] = None):
        """Initialize PaddleOCR engine"""
        self.name = "paddle"
        self.limits = OCRLimits.PADDLE_OCR
        self.model_dir = model_dir or os.getenv(APIKeys.ENV_PADDLE_MODEL_DIR)
        self.ocr_instance = None
        self.is_initialized = False
        self.initialization_error = None

        # Setup logging
        self.logger = logging.getLogger(f"OCREngine.{self.name}")

    def initialize(self) -> Dict[str, Any]:
        """Initialize PaddleOCR with model download and setup"""
        try:
            self.logger.info("Initializing PaddleOCR engine...")

            # Check if PaddlePaddle is available
            paddle_available = self._check_paddle_availability()
            if not paddle_available:
                return {
                    "success": False,
                    "error": "PaddlePaddle framework not available",
                    "details": "Please install paddlepaddle and paddleocr packages",
                    "install_command": "python -m pip install paddlepaddle paddleocr"
                }

            # Try to import and initialize PaddleOCR
            initialization_result = self._initialize_paddleocr()
            if not initialization_result["success"]:
                return initialization_result

            # Test basic functionality
            test_result = self._test_basic_functionality()
            if not test_result["success"]:
                return test_result

            self.is_initialized = True
            self.logger.info("PaddleOCR engine initialized successfully")

            return {
                "success": True,
                "engine": self.name,
                "message": "PaddleOCR initialized successfully",
                "models_ready": True,
                "gpu_available": self._check_gpu_support(),
                "supported_languages": ["ch", "en", "japanese", "korean", "ta", "te", "ka", "latin", "arabic", "cyrillic", "devanagari"]
            }

        except Exception as e:
            error_msg = f"PaddleOCR initialization failed: {str(e)}"
            self.logger.error(error_msg)
            self.initialization_error = error_msg
            return {
                "success": False,
                "error": error_msg,
                "details": "Failed to initialize PaddleOCR engine"
            }

    def _check_paddle_availability(self) -> bool:
        """Check if PaddlePaddle is available"""
        import importlib.util
        paddle_available = importlib.util.find_spec("paddle") is not None
        paddleocr_available = importlib.util.find_spec("paddleocr") is not None
        return paddle_available and paddleocr_available

    def _initialize_paddleocr(self) -> Dict[str, Any]:
        """Initialize PaddleOCR instance"""
        import importlib.util
        if importlib.util.find_spec("paddleocr") is None:
            return {
                "success": False,
                "error": "PaddleOCR not installed",
                "install_command": "python -m pip install paddleocr"
            }
        
        try:
            from paddleocr import PaddleOCR

            # Initialize with basic configuration
            self.ocr_instance = PaddleOCR(
                use_angle_cls=True,
                lang='ch',  # Support Chinese by default
                show_log=False
                # Removed GPU and other advanced options for compatibility
            )

            return {"success": True}

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to initialize PaddleOCR: {str(e)}",
                "install_command": "python -m pip install paddleocr"
            }

    def _check_gpu_support(self) -> bool:
        """Check if GPU support is available"""
        if not _paddle_available or paddle is None:
            return False
        try:
            return paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0
        except:
            return False

    def _test_basic_functionality(self) -> Dict[str, Any]:
        """Test basic OCR functionality with a simple image"""
        try:
            # Create a simple test image
            test_image_path = self._create_test_image()

            # Perform OCR test
            if test_image_path and os.path.exists(test_image_path):
                result = self.ocr_instance.ocr(test_image_path, cls=True)

                # Cleanup test image
                try:
                    os.remove(test_image_path)
                except:
                    pass

                if result is not None:
                    return {"success": True}
                else:
                    return {
                        "success": False,
                        "error": "OCR test returned None result"
                    }
            else:
                return {
                    "success": False,
                    "error": "Failed to create test image"
                }

        except Exception as e:
            return {
                "success": False,
                "error": f"OCR functionality test failed: {str(e)}"
            }

    def _create_test_image(self) -> Optional[str]:
        """Create a simple test image for initialization testing"""
        from pycore.pyfoundations.third_party import PIL
        Image = PIL.Image
        ImageDraw = PIL.ImageDraw
        ImageFont = PIL.ImageFont
        
        try:

            # Create a simple white image with text
            img = Image.new('RGB', (200, 100), color='white')
            draw = ImageDraw.Draw(img)

            # Try to use a basic font
            try:
                font = ImageFont.load_default()
            except:
                font = None

            # Draw simple text
            draw.text((20, 30), "Test", fill='black', font=font)

            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            img.save(temp_file.name)
            temp_file.close()

            return temp_file.name

        except Exception as e:
            self.logger.warning(f"Failed to create test image: {e}")
            return None

    def is_available(self) -> bool:
        """Check if the engine is available and initialized"""
        return self.is_initialized and self.ocr_instance is not None

    def recognize_text(self, image_path: str, **kwargs) -> Dict[str, Any]:
        """Recognize text from image using PaddleOCR"""
        start_time = time.time()

        try:
            if not self.is_available():
                return {
                    "success": False,
                    "error": "PaddleOCR engine not initialized",
                    "initialization_error": self.initialization_error
                }

            # Validate file
            if not os.path.exists(image_path):
                return {
                    "success": False,
                    "error": f"Image file not found: {image_path}"
                }

            # Check file size
            file_size = os.path.getsize(image_path)
            if file_size > self.limits["file_size_limit"]:
                return {
                    "success": False,
                    "error": f"File size {file_size} exceeds limit {self.limits['file_size_limit']}"
                }

            # Perform OCR
            self.logger.info(f"Running PaddleOCR on: {image_path}")
            result = self.ocr_instance.ocr(image_path, cls=True)

            if result is None or len(result) == 0:
                return {
                    "success": True,
                    "text": "",
                    "confidence": 0.0,
                    "provider": self.name,
                    "processing_time": time.time() - start_time,
                    "details": "No text detected"
                }

            # Parse results
            extracted_text = []
            total_confidence = 0.0
            box_count = 0

            for line in result:
                if line:
                    for box_info in line:
                        if len(box_info) >= 2:
                            text = box_info[1][0] if box_info[1] else ""
                            confidence = box_info[1][1] if len(box_info[1]) > 1 else 0.0

                            if text.strip():
                                extracted_text.append(text)
                                total_confidence += confidence
                                box_count += 1

            final_text = "\n".join(extracted_text)
            avg_confidence = total_confidence / box_count if box_count > 0 else 0.0

            return {
                "success": True,
                "text": final_text,
                "confidence": avg_confidence,
                "provider": self.name,
                "processing_time": time.time() - start_time,
                "details": {
                    "detected_boxes": box_count,
                    "total_lines": len(extracted_text),
                    "file_size": file_size,
                    "gpu_used": self._check_gpu_support()
                }
            }

        except Exception as e:
            error_msg = f"PaddleOCR recognition failed: {str(e)}"
            self.logger.error(error_msg)

            return {
                "success": False,
                "error": error_msg,
                "provider": self.name,
                "processing_time": time.time() - start_time
            }

    def get_engine_info(self) -> Dict[str, Any]:
        """Get detailed information about the engine"""
        return {
            "name": self.name,
            "type": "local",
            "initialized": self.is_initialized,
            "available": self.is_available(),
            "limits": self.limits,
            "gpu_support": self._check_gpu_support(),
            "model_dir": self.model_dir,
            "supported_formats": self.limits["supported_formats"],
            "initialization_error": self.initialization_error
        }

    def cleanup(self):
        """Cleanup resources"""
        try:
            if self.ocr_instance:
                del self.ocr_instance
                self.ocr_instance = None
            self.is_initialized = False
        except Exception as e:
            self.logger.warning(f"Cleanup warning: {e}")

# Utility function for package installation
def install_paddleocr_dependencies() -> Dict[str, Any]:
    """Install PaddleOCR dependencies if needed"""
    import importlib.util
    try:
        # Check if packages are already installed
        paddle_available = importlib.util.find_spec("paddle") is not None
        paddleocr_available = importlib.util.find_spec("paddleocr") is not None
        
        if paddle_available and paddleocr_available:
            return {
                "success": True,
                "message": "PaddleOCR dependencies already installed",
                "already_installed": True
            }

        # Install packages
        print("Installing PaddleOCR dependencies...")

        # Install PaddlePaddle CPU version first
        result1 = subprocess.run([
            sys.executable, "-m", "pip", "install",
            "paddlepaddle==3.0.0",
            "-i", "https://www.paddlepaddle.org.cn/packages/stable/cpu/"
        ], capture_output=True, text=True, timeout=300)

        if result1.returncode != 0:
            return {
                "success": False,
                "error": "Failed to install PaddlePaddle",
                "details": result1.stderr
            }

        # Install PaddleOCR
        result2 = subprocess.run([
            sys.executable, "-m", "pip", "install", "paddleocr"
        ], capture_output=True, text=True, timeout=300)

        if result2.returncode != 0:
            return {
                "success": False,
                "error": "Failed to install PaddleOCR",
                "details": result2.stderr
            }

        return {
            "success": True,
            "message": "PaddleOCR dependencies installed successfully",
            "installed_packages": ["paddlepaddle", "paddleocr"]
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Installation timeout - packages too large",
            "suggestion": "Try installing manually: pip install paddlepaddle paddleocr"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Installation failed: {str(e)}"
        }

if __name__ == "__main__":
    # Test the engine
    engine = PaddleOCREngine()
    init_result = engine.initialize()
    print(f"Initialization result: {init_result}")

    if init_result["success"]:
        info = engine.get_engine_info()
        print(f"Engine info: {info}")