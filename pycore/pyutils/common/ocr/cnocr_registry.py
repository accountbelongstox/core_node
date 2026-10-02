"""
CnOCR engines by model key (general, general_en, general_cht, number,
document, naive), created on first use from installed weights only.

The language keys reuse the third_party prewarmed zh/en/cht instances when
present; the general engine otherwise tries the official detector order (v5,
server variants first under CUDA, then v4, v3 and naive_det).
"""

from typing import Any, Dict, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector, is_onnx_cuda_usable
from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, call_serialized
from pycore.pyfoundations.third_party.api import CNOCR_INSTALLER, get_cnocr_prewarmed
from pycore.pyutils.common.model_checks import module_present
from pycore.pyutils.common.ocr.cnocr_engine import NAIVE_DET, CnOCREngine


# https://cnocr.readthedocs.io/zh-cn/stable/models/ (v5/v4/v3 detectors;
# ch_PP-OCRv5, en_PP-OCRv4, chinese_cht_PP-OCRv3 recognizers).
MODEL_PROFILES: Dict[str, Dict[str, Any]] = {
    "general": {
        "det_model_name": "ch_PP-OCRv5_det",
        "rec_model_name": "ch_PP-OCRv5",
        "rec_model_fallbacks": ["ch_PP-OCRv5_server", "ch_PP-OCRv4", "doc-densenet_lite_136-gru", "densenet_lite_136-gru"],
        "cand_alphabet": None,
    },
    "number": {
        "det_model_name": NAIVE_DET,
        "rec_model_name": "number-densenet_lite_136-fc",
        "rec_model_fallbacks": ["doc-densenet_lite_136-gru"],
        "cand_alphabet": "0123456789",
    },
    "naive": {
        "det_model_name": NAIVE_DET,
        "rec_model_name": "doc-densenet_lite_136-gru",
        "rec_model_fallbacks": ["densenet_lite_136-gru"],
        "cand_alphabet": None,
    },
    "general_en": {
        "det_model_name": "en_PP-OCRv3_det",
        "rec_model_name": "en_PP-OCRv4",
        "rec_model_fallbacks": ["en_PP-OCRv3"],
        "cand_alphabet": None,
    },
    "general_cht": {
        "det_model_name": "ch_PP-OCRv3_det",
        "rec_model_name": "chinese_cht_PP-OCRv3",
        "rec_model_fallbacks": [],
        "cand_alphabet": None,
    },
}
# "document" shares the general engine (same models, one load).
_MODEL_KEY_ALIASES = {"document": "general"}
# Model keys served by the third_party prewarmed instances.
_PREWARMED_MODEL_KEYS = {"general": "zh", "general_en": "en", "general_cht": "cht"}
_LANGUAGE_MODEL_KEYS = ("general", "general_en", "general_cht")
_ENGINE_QUEUE = "ocr.cnocr_registry"
_ENGINE_TIMEOUT_SECONDS = 600.0


def _profile_engine(profile: Dict[str, Any], det_model_name: Optional[str] = None,
                    prewarmed_instance: Any = None) -> CnOCREngine:
    return CnOCREngine(
        model_name=profile["rec_model_name"],
        det_model_name=det_model_name or profile["det_model_name"],
        rec_model_fallbacks=profile.get("rec_model_fallbacks") or [],
        cand_alphabet=profile.get("cand_alphabet"),
        prewarmed_instance=prewarmed_instance,
    )


def _default_detector_order() -> Tuple[str, ...]:
    """Official order v5 -> v4 -> v3 -> naive_det; server variants first under CUDA."""
    if CUDADetector.is_cuda_available():
        return ("ch_PP-OCRv5_det_server", "ch_PP-OCRv5_det", "ch_PP-OCRv4_det_server",
                "ch_PP-OCRv4_det", "ch_PP-OCRv3_det", NAIVE_DET)
    return ("ch_PP-OCRv5_det", "ch_PP-OCRv4_det", "ch_PP-OCRv3_det", NAIVE_DET)


class CnOCRRegistry:
    """Keyed owner of the CnOCR engines; engines load on the registry queue."""

    def __init__(self) -> None:
        self._engines: Dict[str, CnOCREngine] = {}
        self._worker = SerializedWorkerThread(_ENGINE_QUEUE, "CnOCRRegistryThread")
        self._worker.start()

    def _create_general(self) -> Optional[CnOCREngine]:
        for detector in _default_detector_order():
            engine = _profile_engine(MODEL_PROFILES["general"], det_model_name=detector)
            if engine.init():
                if detector == NAIVE_DET:
                    ColorPrint.gray(
                        f"[CnOCR] general engine uses naive_det (no bbox positions); install the PP-OCR detectors with {CNOCR_INSTALLER}"
                    )
                return engine
        return None

    def _engine(self, model_key: str) -> Optional[CnOCREngine]:
        key = _MODEL_KEY_ALIASES.get(model_key, model_key)
        engine = self._engines.get(key)
        if engine is not None:
            return engine
        profile = MODEL_PROFILES.get(key)
        if profile is None:
            ColorPrint.yellow(f"[CnOCR] unknown model key: {key}")
            return None
        language = _PREWARMED_MODEL_KEYS.get(key)
        prewarmed = get_cnocr_prewarmed(language) if language else None
        if prewarmed is not None:
            engine = _profile_engine(profile, prewarmed_instance=prewarmed)
            ColorPrint.blue(f"[CnOCR] using the prewarmed engine for {key} (lang={language})")
        elif not module_present("cnocr"):
            ColorPrint.yellow(f"[CnOCR] cnocr is not installed - run {CNOCR_INSTALLER}")
            return None
        elif key == "general":
            engine = self._create_general()
        else:
            engine = _profile_engine(profile)
            if not engine.init():
                engine = None
        if engine is None:
            ColorPrint.yellow(f"[CnOCR] init failed for model key: {key}")
            return None
        self._engines[key] = engine
        return engine

    def _load_languages(self) -> bool:
        if not module_present("cnocr"):
            ColorPrint.yellow(f"[CnOCR] cnocr is not installed - run {CNOCR_INSTALLER}")
            return False
        ColorPrint.blue(f"[CnOCR] device={'GPU' if is_onnx_cuda_usable() else 'CPU'}")
        for key in _LANGUAGE_MODEL_KEYS:
            engine = self._engine(key)
            if engine is None:
                ColorPrint.gray(f"[CnOCR]   {key}: not loaded")
            else:
                ColorPrint.blue(f"[CnOCR]   {key}: rec={engine.model_name} context={engine.effective_context}")
        return True

    def ensure_loaded(self) -> bool:
        """Load the general / general_en / general_cht engines (startup)."""
        return call_serialized(_ENGINE_QUEUE, self._load_languages, timeout=_ENGINE_TIMEOUT_SECONDS)

    def for_model_key(self, model_key: str) -> Optional[CnOCREngine]:
        """The engine of one model key: general, general_en, general_cht,
        number, document, naive."""
        return call_serialized(_ENGINE_QUEUE, self._engine, str(model_key or "general"), timeout=_ENGINE_TIMEOUT_SECONDS)

    def default(self) -> Optional[CnOCREngine]:
        return self.for_model_key("general")


cnocr_registry = CnOCRRegistry()


__all__ = ["CnOCRRegistry", "MODEL_PROFILES", "cnocr_registry"]
