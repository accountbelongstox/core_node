#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Map Name Recognizer for D4
Recognizes map names using OCR when is_post_switch_idle is True
"""

import io
import os
from pathlib import Path
from typing import Optional, Dict, Any

from pycore.pyfoundations.third_party import get_third_package_PIL_Image
from pycore.pyfoundations.color_print import ColorPrint

Image = get_third_package_PIL_Image()

from share.game_interface_data import get_d4_interface_data
from providor.i18n_manager import i18n_manager
from .map_name_utils import set_current_map_name
from d3utils.cnocr_engine_registry import get_cnocr_engine_for_task


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
        self.i18n = i18n_manager

        # OCR engine is initialized by the registry at app startup
        self.cnocr_engine = get_cnocr_engine_for_task('map_name')

        # Recognition state
        self.last_recognized_map = "Unknown"
        self.recognition_attempts = 0
        self.max_recognition_attempts = 3
        
        ColorPrint.green("[MapNameRecognizer] Initialized")

    def recognize_map_name(self) -> bool:
        """
        Recognize map name when is_post_switch_idle is True
        
        Returns:
            bool: True if recognition was attempted, False otherwise
        """
        if not self.d4_data.is_post_switch_idle:
            return False
        if self.d4_data.detected_regions is None:
            ColorPrint.yellow("[MapNameRecognizer] No detected_regions available")
            return False
        if 'region_images' not in self.d4_data.detected_regions:
            ColorPrint.yellow("[MapNameRecognizer] No region_images in detected_regions")
            return False
        region_images = self.d4_data.detected_regions['region_images']
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

    def _has_ocr_engine(self) -> bool:
        """Check if CnOCR engine is available"""
        return self.cnocr_engine is not None

    def _perform_ocr_recognition(self, image: Image.Image) -> Optional[str]:
        """
        Perform OCR recognition on the image using CnOCR

        Args:
            image: PIL Image of the Map Name region

        Returns:
            Recognized text or None if failed
        """
        img_bytes = self._pil_to_bytes(image)
        if self.cnocr_engine is not None:
            ColorPrint.blue("[MapNameRecognizer] Performing CnOCR recognition...")
            result = self._recognize_with_cnocr(img_bytes)
            if result and result.strip():
                ColorPrint.green(f"[MapNameRecognizer] CnOCR result: '{result}'")
                return result
        return None

    def _pil_to_bytes(self, image: Image.Image) -> bytes:
        """
        Convert PIL Image to bytes for OCR processing
        
        Args:
            image: PIL Image
            
        Returns:
            Image bytes
        """
        if image.mode != 'RGB':
            image = image.convert('RGB')
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
        img_bytes = img_buffer.getvalue()
        img_buffer.close()
        return img_bytes

    def _recognize_with_cnocr(self, img_bytes: bytes) -> Optional[str]:
        """
        Recognize text using CnOCR engine
        
        Args:
            img_bytes: Image bytes
            
        Returns:
            Recognized text or None
        """
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
            temp_file.write(img_bytes)
            temp_path = temp_file.name
        try:
            result = self.cnocr_engine.ocr(temp_path)
            if result and 'text' in result:
                return result['text']
            return None
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    def _update_shared_data_with_map_name(self, map_name: str):
        """
        Update shared data with recognized map name using unified method
        
        Args:
            map_name: Recognized map name
        """
        set_current_map_name(map_name)
        ColorPrint.blue(f"[MapNameRecognizer] Updated shared data with map name: '{map_name}'")

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
