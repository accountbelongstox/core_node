"""
OCR Manager - Singleton interface for OCR operations

Provides unified interface to CnOCR engine with support for multiple model types.
Exports a singleton instance for global use.
"""

import json
from typing import Dict, Any, Optional
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.ocr_cluster.ocr.cnocr_engine import CnOCREngine
from pycore.pyutils.ocr_cluster.ocr.ocr_result import OCRResult


class OCRManager:
    """Unified OCR manager with support for multiple engines and models"""

    def __init__(self):
        """Initialize OCR manager"""
        self.engines: Dict[str, CnOCREngine] = {}
        self.default_model_type = "general"

    def _get_engine(self, model_type: str = "general") -> CnOCREngine:
        """Get or create OCR engine for specified model type"""
        if model_type not in self.engines:
            ColorPrint.blue(f"[INFO] Creating CnOCR engine for model type: {model_type}")
            self.engines[model_type] = CnOCREngine(model_type=model_type)

        return self.engines[model_type]

    def recognize_image(
        self,
        image_path: str,
        model_type: str = "general",
        return_json: bool = False
    ) -> Dict[str, Any]:
        """
        Recognize text from image

        Args:
            image_path: Path to image file
            model_type: Model type to use (scene, doc, number, general, english, chinese_traditional)
            return_json: If True, return JSON string instead of dict

        Returns:
            Dictionary with OCR results or JSON string
        """
        # Validate image path
        if not Path(image_path).exists():
            result = OCRResult()
            result.error = f"Image file not found: {image_path}"
            return json.dumps(result.to_json_safe_dict()) if return_json else result.to_dict()

        # Get appropriate engine
        engine = self._get_engine(model_type)

        # Perform OCR
        result = engine.recognize(image_path)

        # Return result
        result_dict = result.to_json_safe_dict()
        return json.dumps(result_dict, ensure_ascii=False) if return_json else result_dict

    def recognize_batch(
        self,
        image_paths: list,
        model_type: str = "general",
        return_json: bool = False
    ) -> Dict[str, Any]:
        """
        Recognize text from multiple images

        Args:
            image_paths: List of image file paths
            model_type: Model type to use
            return_json: If True, return JSON string instead of dict

        Returns:
            Dictionary with batch results or JSON string
        """
        results = []

        for image_path in image_paths:
            result = self.recognize_image(image_path, model_type, return_json=False)
            results.append({
                "image_path": image_path,
                "result": result
            })

        batch_result = {
            "total": len(image_paths),
            "results": results
        }

        return json.dumps(batch_result, ensure_ascii=False) if return_json else batch_result

    def get_available_models(self) -> Dict[str, Any]:
        """Get list of available model types"""
        engine = self._get_engine(self.default_model_type)
        return {
            "available_model_types": list(engine.model_configs.keys()),
            "model_configs": engine.model_configs,
            "default_model_type": self.default_model_type
        }

    def set_default_model_type(self, model_type: str) -> bool:
        """Set default model type"""
        engine = self._get_engine(self.default_model_type)
        if model_type in engine.model_configs:
            self.default_model_type = model_type
            ColorPrint.green(f"[SUCCESS] Default model type set to: {model_type}")
            return True
        else:
            ColorPrint.red(f"[ERROR] Invalid model type: {model_type}")
            return False

    def get_engine_info(self, model_type: Optional[str] = None) -> Dict[str, Any]:
        """Get information about OCR engine(s)"""
        if model_type:
            engine = self._get_engine(model_type)
            return engine.get_model_info()
        else:
            return {
                "loaded_engines": list(self.engines.keys()),
                "default_model_type": self.default_model_type
            }


# Create singleton instance
ocr_manager = OCRManager()


__all__ = ['OCRManager', 'ocr_manager']
