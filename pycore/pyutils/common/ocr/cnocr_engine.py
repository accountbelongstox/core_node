"""
CnOCR engine for local OCR: one engine class for both configuration styles.

- Scene types (``model_type``: scene, doc, number, general, english,
  chinese_traditional) pick the detector and recognizer chain from
  ``MODEL_CONFIGS``; CnOCR runs on its default context.
- Explicit profiles (``det_model_name`` given, used by the model-key registry
  ``cnocr_registry``) try the recognizer and its ``rec_model_fallbacks`` on the
  GPU first, then the CPU, with an optional ``cand_alphabet``.

Weights are checked for presence only (``cnocr_models_present``); the engine
never downloads. ``recognize()`` returns an ``OCRResult``; ``ocr()`` /
``ocr_for_single_line()`` return the dict shape shared with the Windows engine
(text, raw_result, offset, region, grid_position) and accept a file path or an
in-memory image plus an optional 9-grid region.
"""

import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector, is_onnx_cuda_usable
from pycore.pyfoundations.third_party.api import (
    CNOCR_INSTALLER,
    REC_MORE_CONFIGS_CNOCR,
    cnocr_root,
    cnstd_root,
    get_third_package_PIL_Image,
    get_third_package_cnocr,
    get_third_package_numpy,
    ocr_model_dir_present,
)
from pycore.pyutils.common.model_checks import module_present
from pycore.pyutils.common.ocr.result import OCRResult


NAIVE_DET = "naive_det"
DEFAULT_DET = "ch_PP-OCRv3_det"
_DEFAULT_REC = "densenet_lite_136-gru"
_GPU_CONTEXT = "gpu"
_CPU_CONTEXT = "cpu"

MODEL_CONFIGS: Dict[str, Dict[str, Any]] = {
    "scene": {
        "models": ["scene-densenet_lite_136-gru", _DEFAULT_REC],
        "description": "Optimized for general scene photos with text",
    },
    "doc": {
        "models": ["doc-densenet_lite_136-gru", _DEFAULT_REC],
        "description": "Optimized for document screenshots and scans",
    },
    "number": {
        "models": ["number-densenet_lite_136-gru", _DEFAULT_REC],
        "description": "Optimized for number recognition (0-9 only)",
    },
    "general": {
        "models": [_DEFAULT_REC],
        "description": "General purpose model for mixed content",
    },
    "english": {
        "models": ["en_PP-OCRv3"],
        "description": "Optimized for English text",
    },
    "chinese_traditional": {
        "models": ["chinese_cht_PP-OCRv3"],
        "description": "Optimized for Traditional Chinese",
    },
}
# Scene types whose detector is not the default (the document type keeps the
# layout with naive detection).
_TYPE_DETECTORS = {"english": "en_PP-OCRv3_det", "doc": NAIVE_DET}


def cnocr_models_present(rec_model: str, det_model: str = DEFAULT_DET) -> bool:
    """True when the CnSTD detector and CnOCR recognizer weights are installed
    (CNSTD_HOME / CNOCR_HOME); checking never downloads."""
    det_ready = det_model == NAIVE_DET or ocr_model_dir_present(cnstd_root(), det_model)
    return det_ready and ocr_model_dir_present(cnocr_root(), rec_model)


def grid_region(img_width: int, img_height: int, grid_position: int) -> Tuple[int, int, int, int]:
    """(left, top, right, bottom) of one cell of the 9-grid (1..9, row-major)."""
    if not 1 <= grid_position <= 9:
        raise ValueError("grid_position must be between 1-9")
    grid_width = img_width // 3
    grid_height = img_height // 3
    row, col = divmod(grid_position - 1, 3)
    left = col * grid_width
    top = row * grid_height
    return left, top, left + grid_width, top + grid_height


class CnOCREngine:
    """CnOCR local OCR engine (scene types or an explicit detector profile)."""

    def __init__(
        self,
        model_type: str = "general",
        model_name: Optional[str] = None,
        *,
        det_model_name: Optional[str] = None,
        rec_model_fallbacks: Optional[List[str]] = None,
        cand_alphabet: Optional[str] = None,
        prewarmed_instance: Optional[Any] = None,
    ):
        self.model_configs = MODEL_CONFIGS
        self.model_type = model_type
        self.explicit_profile = det_model_name is not None
        self.det_model_name = det_model_name or _TYPE_DETECTORS.get(model_type, DEFAULT_DET)
        self.model_name = model_name or self._get_default_model(model_type)
        self.rec_model_fallbacks = list(rec_model_fallbacks or [])
        self.cand_alphabet = cand_alphabet
        self.ocr_instance: Any = None
        self.is_initialized = False
        self.initialization_error: Optional[str] = None
        self.effective_context: Optional[str] = None
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp']
        self.max_file_size = 50 * 1024 * 1024  # 50MB limit for local processing
        if prewarmed_instance is not None:
            self.ocr_instance = prewarmed_instance
            self.is_initialized = True
            self.effective_context = _GPU_CONTEXT if is_onnx_cuda_usable() else _CPU_CONTEXT

    def _get_default_model(self, model_type: str) -> str:
        return self.model_configs.get(model_type, {}).get("models", [_DEFAULT_REC])[0]

    def _rec_candidates(self) -> List[str]:
        if self.explicit_profile:
            return [self.model_name] + self.rec_model_fallbacks
        return list(self.model_configs.get(self.model_type, {}).get("models", [self.model_name]))

    def _contexts(self) -> Tuple[Optional[str], ...]:
        """Explicit profiles try the GPU first, then the CPU; scene types run
        on CnOCR's default context."""
        if not self.explicit_profile:
            return (None,)
        return (_GPU_CONTEXT, _CPU_CONTEXT) if CUDADetector.is_cuda_available() else (_CPU_CONTEXT,)

    def init(self) -> bool:
        """Create the CnOCR instance from installed weights; the first
        (context, recognizer) that loads wins. No-op once initialized."""
        if self.is_initialized:
            return True
        ColorPrint.blue(
            f"[INFO] Initializing CnOCR engine: type={self.model_type} det={self.det_model_name} rec={self.model_name}"
        )
        cnocr_module = get_third_package_cnocr() if module_present("cnocr") else None
        if cnocr_module is None:
            self.initialization_error = f"CnOCR is not installed - run {CNOCR_INSTALLER}"
            ColorPrint.red(f"[ERROR] {self.initialization_error}")
            return False
        rec_models = [model for model in self._rec_candidates() if cnocr_models_present(model, self.det_model_name)]
        if not rec_models:
            self.initialization_error = f"CnOCR {self.model_type} weights missing - run {CNOCR_INSTALLER}"
            ColorPrint.red(f"[ERROR] {self.initialization_error}")
            return False
        last_error: Optional[Exception] = None
        for context in self._contexts():
            for model in rec_models:
                kwargs: Dict[str, Any] = {
                    "rec_model_name": model,
                    # rec_more_configs (font_path) is required by some recognizers
                    # (en_PP-OCRv3, *_cht_*); passed everywhere.
                    "rec_more_configs": REC_MORE_CONFIGS_CNOCR,
                }
                if self.explicit_profile or self.model_type in _TYPE_DETECTORS:
                    # Other scene types keep CnOCR's own default detector.
                    kwargs["det_model_name"] = self.det_model_name
                if context is not None:
                    kwargs["context"] = context
                if self.cand_alphabet is not None:
                    kwargs["cand_alphabet"] = self.cand_alphabet
                try:
                    self.ocr_instance = cnocr_module.CnOcr(**kwargs)
                except Exception as exc:  # noqa: BLE001 - third-party model load; try the next candidate
                    last_error = exc
                    ColorPrint.gray(f"[CnOCR] init failed (context={context or 'default'}, rec={model}): {exc}")
                    continue
                self.model_name = model
                self.effective_context = context or _CPU_CONTEXT
                self.is_initialized = True
                ColorPrint.green(
                    f"[SUCCESS] CnOCR engine initialized: det={self.det_model_name} rec={model} "
                    f"context={context or 'default'}"
                )
                return True
        self.initialization_error = f"Failed to initialize any CnOCR model for type {self.model_type}: {last_error}"
        ColorPrint.red(f"[ERROR] {self.initialization_error}")
        return False

    def _prepare_image(self, image_path: str) -> Optional[str]:
        if not os.path.exists(image_path):
            ColorPrint.red(f"[ERROR] Image file not found: {image_path}")
            return None
        file_size = os.path.getsize(image_path)
        if file_size > self.max_file_size:
            ColorPrint.yellow(f"[WARNING] File size {file_size} bytes exceeds local processing limit")
        file_ext = Path(image_path).suffix.lower()
        if file_ext not in self.supported_formats:
            ColorPrint.red(f"[ERROR] Unsupported image format: {file_ext}")
            return None
        return image_path

    def _parse_response(self, cnocr_result) -> OCRResult:
        result = OCRResult()
        result.provider = f"CnOCR-{self.model_type}"
        result.raw_response = cnocr_result
        if not cnocr_result:
            result.error = "No text found in image"
            return result
        all_text: List[str] = []
        all_words: List[Dict[str, Any]] = []
        total_confidence = 0.0
        for detection in cnocr_result:
            if not detection or 'text' not in detection:
                continue
            text = detection.get('text', '').strip()
            if not text:
                continue
            confidence = detection.get('score', 0.0)
            all_text.append(text)
            word_info: Dict[str, Any] = {"text": text, "confidence": confidence, "score": confidence}
            position = _position_list(detection.get('position'))
            if position:
                x_coords = [point[0] for point in position]
                y_coords = [point[1] for point in position]
                word_info["bbox"] = {
                    "left": min(x_coords),
                    "top": min(y_coords),
                    "width": max(x_coords) - min(x_coords),
                    "height": max(y_coords) - min(y_coords),
                }
                word_info["position"] = position
            all_words.append(word_info)
            total_confidence += confidence
        result.text = "\n".join(all_text)
        result.words = all_words
        result.confidence = total_confidence / len(all_words) if all_words else 0
        result.success = True
        return result

    def recognize(self, image_path: str, **kwargs) -> OCRResult:
        """Recognize text from an image file as an ``OCRResult``."""
        start_time = time.time()
        if not self.is_initialized and not self.init():
            result = OCRResult()
            result.provider = f"CnOCR-{self.model_type}"
            result.error = self.initialization_error or "CnOCR initialization failed"
            return result
        prepared_path = self._prepare_image(image_path)
        if not prepared_path:
            result = OCRResult()
            result.provider = f"CnOCR-{self.model_type}"
            result.error = "Image preparation failed"
            return result
        result = self._parse_response(self.ocr_instance.ocr(prepared_path))
        result.processing_time = time.time() - start_time
        return result

    def _load_region(
        self,
        img_path: Optional[Union[str, Path]],
        image: Optional[Any],
        grid_position: Optional[int],
    ) -> Tuple[Any, Tuple[int, int], Tuple[int, int, int, int]]:
        """(image array, offset, region) of a path or in-memory image, cropped
        to one 9-grid cell when ``grid_position`` is given."""
        if not self.is_initialized:
            raise RuntimeError("OCR not initialized, please call init() first")
        if (image is None) == (img_path is None):
            raise ValueError("Provide exactly one of img_path or image")
        if image is not None:
            img = image if hasattr(image, "mode") else get_third_package_PIL_Image().fromarray(
                get_third_package_numpy().asarray(image)
            )
        else:
            img = get_third_package_PIL_Image().open(img_path)
        img_width, img_height = img.size
        offset = (0, 0)
        region = (0, 0, img_width, img_height)
        if grid_position is not None:
            region = grid_region(img_width, img_height, grid_position)
            img = img.crop(region)
            offset = (region[0], region[1])
        return get_third_package_numpy().array(img), offset, region

    def ocr(
        self,
        img_path: Optional[Union[str, Path]] = None,
        image: Optional[Any] = None,
        grid_position: Optional[int] = None,
    ) -> Dict[str, Any]:
        """OCR a file path or an in-memory image (PIL or ndarray), optionally one
        9-grid cell: ``{text, raw_result, offset, region, grid_position}``.
        Positions are lists of [x, y] shifted by the cell offset (None with
        ``naive_det``)."""
        img_array, offset, region = self._load_region(img_path, image, grid_position)
        items = []
        for item in self.ocr_instance.ocr(img_array) or []:
            normalized = dict(item)
            position = _position_list(normalized.get("position"))
            if position:
                normalized["position"] = [[point[0] + offset[0], point[1] + offset[1]] for point in position]
            items.append(normalized)
        return {
            "text": "\n".join(item.get("text", "") for item in items),
            "raw_result": items,
            "offset": offset,
            "region": region,
            "grid_position": grid_position,
        }

    def ocr_for_single_line(
        self,
        img_path: Union[str, Path],
        grid_position: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Single-line OCR of a file path, optionally one 9-grid cell."""
        img_array, offset, region = self._load_region(img_path, None, grid_position)
        result = self.ocr_instance.ocr_for_single_line(img_array)
        return {
            "text": result["text"],
            "raw_result": result,
            "offset": offset,
            "region": region,
            "grid_position": grid_position,
        }

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "provider": "CnOCR",
            "model_type": self.model_type,
            "model_name": self.model_name,
            "det_model_name": self.det_model_name,
            "context": self.effective_context,
            "is_initialized": self.is_initialized,
            "supported_formats": self.supported_formats,
            "max_file_size": self.max_file_size,
            "available_types": list(self.model_configs.keys()),
        }


def _position_list(position: Any) -> Optional[List[List[float]]]:
    """A detection position as a list of [x, y] (CnOCR may return an ndarray)."""
    if position is None:
        return None
    if hasattr(position, "tolist"):
        position = position.tolist()
    if isinstance(position, (list, tuple)) and len(position) >= 4:
        return [[float(point[0]), float(point[1])] for point in position[:4]]
    return None


__all__ = ["CnOCREngine", "DEFAULT_DET", "MODEL_CONFIGS", "NAIVE_DET", "cnocr_models_present", "grid_region"]
