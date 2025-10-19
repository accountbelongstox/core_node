#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Map Name Recognizer for D4
Recognizes map names using OCR when is_post_switch_idle is True
"""

import sys
import os
from pathlib import Path
from typing import Optional, Dict, Any
from PIL import Image
import io

# Add project paths
current_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(current_dir))

from providor.common_imports import ColorPrint
from share.game_interface_data import get_d4_interface_data
from d3utils.i18n_manager import I18nManager
from .map_name_utils import set_current_map_name

# Import OCR engines from pycore
sys.path.insert(0, str(Path(current_dir).parent / "pycore"))
try:
    from pyutils.ocr_cnocr_engine import CnOCREngine
    from pyutils.paddle_ocr import PaddleOCREngine
    OCR_AVAILABLE = True
except ImportError as e:
    ColorPrint.yellow(f"[MapNameRecognizer] OCR engines not available: {e}")
    OCR_AVAILABLE = False


class MapNameRecognizer:
    """
    Recognizes map names using OCR when is_post_switch_idle is True
    
    Features:
    1. Monitors is_post_switch_idle state
    2. Uses OCR to recognize text from Map Name region
    3. Updates current_map in shared data
    4. Resets is_post_switch_idle after recognition
    5. Uses memory-based image processing (no file I/O)
    """

    def __init__(self):
        """Initialize map name recognizer"""
        self.d4_data = get_d4_interface_data()
        self.i18n = I18nManager()
        
        # Initialize OCR engines
        self.cnocr_engine = None
        self.paddle_ocr_engine = None
        self._init_ocr_engines()
        
        # Recognition state
        self.last_recognized_map = "Unknown"
        self.recognition_attempts = 0
        self.max_recognition_attempts = 3
        
        ColorPrint.green("[MapNameRecognizer] Initialized")

    def _init_ocr_engines(self):
        """Initialize OCR engines"""
        if not OCR_AVAILABLE:
            ColorPrint.yellow("[MapNameRecognizer] OCR engines not available, map recognition disabled")
            return
            
        try:
            # Initialize CnOCR engine (faster, good for Chinese text)
            ColorPrint.blue("[MapNameRecognizer] Initializing CnOCR engine...")
            self.cnocr_engine = CnOCREngine(
                det_model_name='naive_det',
                rec_model_name='densenet_lite_136-gru'  # Supports Chinese, English, numbers
            )
            if self.cnocr_engine.init():
                ColorPrint.green("[MapNameRecognizer] CnOCR engine initialized successfully")
            else:
                ColorPrint.yellow("[MapNameRecognizer] CnOCR engine initialization failed")
                self.cnocr_engine = None
                
        except Exception as e:
            ColorPrint.red(f"[MapNameRecognizer] Error initializing CnOCR: {e}")
            self.cnocr_engine = None

        try:
            # Initialize PaddleOCR engine (more accurate, supports more languages)
            ColorPrint.blue("[MapNameRecognizer] Initializing PaddleOCR engine...")
            self.paddle_ocr_engine = PaddleOCREngine(
                lang="chinese_cht",  # Chinese Traditional (default for D4)
                auto_init=True
            )
            if self.paddle_ocr_engine.is_ready():
                ColorPrint.green("[MapNameRecognizer] PaddleOCR engine initialized successfully")
            else:
                ColorPrint.yellow("[MapNameRecognizer] PaddleOCR engine initialization failed")
                self.paddle_ocr_engine = None
                
        except Exception as e:
            ColorPrint.red(f"[MapNameRecognizer] Error initializing PaddleOCR: {e}")
            self.paddle_ocr_engine = None

    def recognize_map_name(self) -> bool:
        """
        Recognize map name when is_post_switch_idle is True
        
        Returns:
            bool: True if recognition was attempted, False otherwise
        """
        try:
            # Check if we should recognize (is_post_switch_idle is True)
            if not self.d4_data.is_post_switch_idle:
                return False
                
            # Check if we have region images available
            if not hasattr(self.d4_data, 'detected_regions') or self.d4_data.detected_regions is None:
                ColorPrint.yellow("[MapNameRecognizer] No detected_regions available")
                return False

            if 'region_images' not in self.d4_data.detected_regions:
                ColorPrint.yellow("[MapNameRecognizer] No region_images in detected_regions")
                return False

            region_images = self.d4_data.detected_regions['region_images']

            # Get Map Name region image
            if 'Map Name' not in region_images:
                ColorPrint.yellow("[MapNameRecognizer] Map Name region not found in detected_regions")
                return False

            map_name_image = region_images['Map Name']

            if map_name_image is None:
                ColorPrint.yellow("[MapNameRecognizer] Map Name region image is None")
                return False

            # Check if we have OCR engines available
            if not self._has_ocr_engine():
                ColorPrint.yellow("[MapNameRecognizer] No OCR engines available")
                return False

            # Increment recognition attempts
            self.recognition_attempts += 1
            
            ColorPrint.blue(f"[MapNameRecognizer] 🗺️ Attempting map name recognition (attempt {self.recognition_attempts}/{self.max_recognition_attempts})")

            # Perform OCR recognition on the Map Name region image
            recognized_text = self._perform_ocr_recognition(map_name_image)
            
            if recognized_text and recognized_text.strip():
                # Successfully recognized text
                self.last_recognized_map = recognized_text.strip()
                
                # Update shared data with recognized map name
                self._update_shared_data_with_map_name(recognized_text.strip())
                
                # Reset post-switch idle state
                self.d4_data.is_post_switch_idle = False
                self.recognition_attempts = 0
                
                ColorPrint.green(f"[MapNameRecognizer] ✅ Map name recognized: '{recognized_text.strip()}'")
                return True
            else:
                # No text recognized
                ColorPrint.yellow(f"[MapNameRecognizer] No text recognized in Map Name region")
                
                # Check if we've exceeded max attempts
                if self.recognition_attempts >= self.max_recognition_attempts:
                    ColorPrint.yellow(f"[MapNameRecognizer] Max recognition attempts reached, resetting post-switch idle")
                    self.d4_data.is_post_switch_idle = False
                    self.recognition_attempts = 0
                
                return True

        except Exception as e:
            ColorPrint.red(f"[MapNameRecognizer] Error recognizing map name: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _has_ocr_engine(self) -> bool:
        """Check if any OCR engine is available"""
        return self.cnocr_engine is not None or self.paddle_ocr_engine is not None

    def _perform_ocr_recognition(self, image: Image.Image) -> Optional[str]:
        """
        Perform OCR recognition on the image
        
        Args:
            image: PIL Image of the Map Name region
            
        Returns:
            Recognized text or None if failed
        """
        try:
            # Convert PIL Image to bytes for OCR processing
            # This avoids file I/O and keeps everything in memory
            img_bytes = self._pil_to_bytes(image)
            
            # Try CnOCR first (faster)
            if self.cnocr_engine is not None:
                try:
                    ColorPrint.blue("[MapNameRecognizer] Trying CnOCR recognition...")
                    result = self._recognize_with_cnocr(img_bytes)
                    if result and result.strip():
                        ColorPrint.green(f"[MapNameRecognizer] CnOCR result: '{result}'")
                        return result
                except Exception as e:
                    ColorPrint.yellow(f"[MapNameRecognizer] CnOCR recognition failed: {e}")

            # Try PaddleOCR as fallback (more accurate)
            if self.paddle_ocr_engine is not None:
                try:
                    ColorPrint.blue("[MapNameRecognizer] Trying PaddleOCR recognition...")
                    result = self._recognize_with_paddle_ocr(img_bytes)
                    if result and result.strip():
                        ColorPrint.green(f"[MapNameRecognizer] PaddleOCR result: '{result}'")
                        return result
                except Exception as e:
                    ColorPrint.yellow(f"[MapNameRecognizer] PaddleOCR recognition failed: {e}")

            return None

        except Exception as e:
            ColorPrint.red(f"[MapNameRecognizer] Error in OCR recognition: {e}")
            return None

    def _pil_to_bytes(self, image: Image.Image) -> bytes:
        """
        Convert PIL Image to bytes for OCR processing
        
        Args:
            image: PIL Image
            
        Returns:
            Image bytes
        """
        try:
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Save to bytes buffer
            img_buffer = io.BytesIO()
            image.save(img_buffer, format='PNG')
            img_bytes = img_buffer.getvalue()
            img_buffer.close()
            
            return img_bytes
            
        except Exception as e:
            ColorPrint.red(f"[MapNameRecognizer] Error converting PIL to bytes: {e}")
            return b''

    def _recognize_with_cnocr(self, img_bytes: bytes) -> Optional[str]:
        """
        Recognize text using CnOCR engine
        
        Args:
            img_bytes: Image bytes
            
        Returns:
            Recognized text or None
        """
        try:
            # Create temporary file path for CnOCR
            # Note: CnOCR requires file path, so we need to save to temp file
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                temp_file.write(img_bytes)
                temp_path = temp_file.name
            
            try:
                # Perform OCR recognition
                result = self.cnocr_engine.ocr(temp_path)
                
                if result and 'text' in result:
                    return result['text']
                else:
                    return None
                    
            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_path)
                except:
                    pass
                    
        except Exception as e:
            ColorPrint.red(f"[MapNameRecognizer] CnOCR recognition error: {e}")
            return None

    def _recognize_with_paddle_ocr(self, img_bytes: bytes) -> Optional[str]:
        """
        Recognize text using PaddleOCR engine
        
        Args:
            img_bytes: Image bytes
            
        Returns:
            Recognized text or None
        """
        try:
            # Create temporary file path for PaddleOCR
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                temp_file.write(img_bytes)
                temp_path = temp_file.name
            
            try:
                # Perform OCR recognition
                results = self.paddle_ocr_engine.recognize_text(temp_path)
                
                if results and len(results) > 0:
                    # Combine all recognized text
                    texts = [item['text'] for item in results if item.get('text')]
                    if texts:
                        return ' '.join(texts)
                
                return None
                
            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_path)
                except:
                    pass
                    
        except Exception as e:
            ColorPrint.red(f"[MapNameRecognizer] PaddleOCR recognition error: {e}")
            return None

    def _update_shared_data_with_map_name(self, map_name: str):
        """
        Update shared data with recognized map name using unified method
        
        Args:
            map_name: Recognized map name
        """
        try:
            # Use unified method to update map name
            set_current_map_name(map_name)
            ColorPrint.blue(f"[MapNameRecognizer] Updated shared data with map name: '{map_name}'")
            
        except Exception as e:
            ColorPrint.red(f"[MapNameRecognizer] Error updating shared data: {e}")

    def get_recognition_stats(self) -> Dict[str, Any]:
        """
        Get current recognition statistics
        
        Returns:
            Dictionary with recognition stats
        """
        return {
            'last_recognized_map': self.last_recognized_map,
            'recognition_attempts': self.recognition_attempts,
            'max_recognition_attempts': self.max_recognition_attempts,
            'cnocr_available': self.cnocr_engine is not None,
            'paddle_ocr_available': self.paddle_ocr_engine is not None,
            'is_post_switch_idle': self.d4_data.is_post_switch_idle
        }


# Global singleton instance
_map_name_recognizer = None


def get_map_name_recognizer() -> MapNameRecognizer:
    """
    Get global map name recognizer instance (singleton)
    
    Returns:
        Global MapNameRecognizer instance
    """
    global _map_name_recognizer
    
    if _map_name_recognizer is None:
        _map_name_recognizer = MapNameRecognizer()
        ColorPrint.green("[Global] Map name recognizer initialized")
    
    return _map_name_recognizer
