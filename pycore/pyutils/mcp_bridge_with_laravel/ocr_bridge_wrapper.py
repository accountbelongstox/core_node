#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR Bridge Wrapper

Wraps Laravel HTTP bridge to provide same interface as old OCR engines.
Allows seamless replacement in main.py without changing tool signatures.
"""

import logging
from typing import Dict, Any, List, Optional

try:
    from laravel_bridge import laravel_bridge
    LARAVEL_BRIDGE_AVAILABLE = True
except ImportError:
    LARAVEL_BRIDGE_AVAILABLE = False
    laravel_bridge = None

logger = logging.getLogger(__name__)


class OCRBridgeResult:
    """
    OCR result wrapper matching original OCRResult interface
    """
    def __init__(self, laravel_response: Dict[str, Any]):
        self.success = laravel_response.get('success', False)
        self.text = laravel_response.get('text', '')
        self.confidence = laravel_response.get('confidence', 0.0)
        self.words = laravel_response.get('words', [])
        self.provider = laravel_response.get('provider', 'Laravel-OCR')
        self.processing_time = laravel_response.get('processing_time', 0.0)
        self.error = laravel_response.get('error')
        self.raw_response = laravel_response

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'success': self.success,
            'text': self.text,
            'confidence': self.confidence,
            'words': self.words,
            'provider': self.provider,
            'processing_time': self.processing_time,
            'error': self.error
        }


class OCRBridgeManager:
    """
    OCR manager using Laravel HTTP bridge
    Provides same interface as original ocr_manager
    """

    def __init__(self):
        """Initialize OCR bridge manager"""
        if not LARAVEL_BRIDGE_AVAILABLE:
            logger.warning("Laravel bridge not available")
            self.bridge = None
        else:
            self.bridge = laravel_bridge
            # Check connectivity
            health = self.bridge.health_check()
            if health.get('success'):
                logger.info("Laravel OCR bridge connected successfully")
            else:
                logger.warning(f"Laravel OCR bridge connection failed: {health.get('error')}")

    def recognize_image(
        self,
        image_path: str,
        engine: str = "cnocr",
        model_type: str = "general",
        **kwargs
    ) -> OCRBridgeResult:
        """
        Recognize text from image

        Args:
            image_path: Path to image file
            engine: Engine name (ignored, using Laravel)
            model_type: Model type
            **kwargs: Additional parameters

        Returns:
            OCRBridgeResult
        """
        if not self.bridge:
            return OCRBridgeResult({
                'success': False,
                'error': 'Laravel bridge not available'
            })

        response = self.bridge.recognize_image(image_path, model_type)
        return OCRBridgeResult(response)

    def recognize_batch(
        self,
        image_paths: List[str],
        engine: str = "cnocr",
        model_type: str = "general",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Recognize text from multiple images

        Args:
            image_paths: List of image paths
            engine: Engine name (ignored)
            model_type: Model type
            **kwargs: Additional parameters

        Returns:
            Batch result dictionary
        """
        if not self.bridge:
            return {
                'success': False,
                'error': 'Laravel bridge not available'
            }

        return self.bridge.recognize_batch(image_paths, model_type)

    def get_available_engines(self) -> List[str]:
        """Get available OCR engines"""
        if not self.bridge:
            return []

        models_info = self.bridge.get_available_models()
        if models_info.get('success'):
            return models_info.get('available_model_types', [])
        return ['cnocr']  # Fallback

    def get_engine_info(self, engine: str = "cnocr") -> Dict[str, Any]:
        """Get engine information"""
        if not self.bridge:
            return {
                'success': False,
                'error': 'Laravel bridge not available'
            }

        return self.bridge.get_engine_info()


# Create singleton instance
ocr_bridge_manager = OCRBridgeManager()


# Compatibility exports matching original module
class OCRResult:
    """Compatibility class"""
    def __init__(self):
        self.success = False
        self.text = ""
        self.confidence = 0.0
        self.words = []
        self.provider = ""
        self.processing_time = 0.0
        self.error = None


# Export with same names as original module
ocr_manager = ocr_bridge_manager
OCRResult = OCRBridgeResult


__all__ = ['ocr_manager', 'ocr_bridge_manager', 'OCRResult', 'OCRBridgeResult']
