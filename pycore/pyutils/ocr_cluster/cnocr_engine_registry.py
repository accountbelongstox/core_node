"""
CnOCR engine registry (generic, pycore-only).
Uses third_party for cnocr (eager load + prewarmed zh/en/cht). Engines created on first use by model key.
Official: ch_PP-OCRv5_det default; v5->v4->v3; CUDA prefer _server. 中/英/繁体 profiles.
Init: see pycore/pyfoundations/OCR_INIT.md. Default init loads all languages (general, general_en, general_cht),
prints GPU/CPU and model status; set PYCORE_CNOCR_DEBUG=1 (or app config e.g. show_debug_logs) to run screen-capture test.
"""
import os
from typing import Optional, Dict, Any, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.pybasecommon.compute_caps import is_onnx_cuda_usable
from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, call_serialized
from pycore.pyfoundations.third_party.api import get_third_package_cnocr
from pycore.pyfoundations.third_party.api import get_cnocr_prewarmed, init_third_party_cnocr
from pycore.pyutils.ocr_cluster.ocr_cnocr_engine import CnOCREngine

from pycore.pyfoundations.third_party.api import get_third_package_PIL_ImageGrab


# Official: https://cnocr.readthedocs.io/zh-cn/stable/usage/  default det_model_name='ch_PP-OCRv5_det'
# Models: https://cnocr.readthedocs.io/zh-cn/stable/models/  v5/v4/v3 det; ch_PP-OCRv5, en_PP-OCRv4, chinese_cht_PP-OCRv3
MODEL_PROFILES: Dict[str, Dict[str, Any]] = {
    "general": {
        "det_model_name": "ch_PP-OCRv5_det",
        "rec_model_name": "ch_PP-OCRv5",
        "rec_model_fallbacks": ["ch_PP-OCRv5_server", "ch_PP-OCRv4", "doc-densenet_lite_136-gru", "densenet_lite_136-gru"],
        "cand_alphabet": None,
    },
    "number": {
        "det_model_name": "naive_det",
        "rec_model_name": "number-densenet_lite_136-fc",
        "rec_model_fallbacks": ["doc-densenet_lite_136-gru"],
        "cand_alphabet": "0123456789",
    },
    "document": {
        "det_model_name": "ch_PP-OCRv5_det",
        "rec_model_name": "ch_PP-OCRv5",
        "rec_model_fallbacks": ["ch_PP-OCRv4", "doc-densenet_lite_136-gru"],
        "cand_alphabet": None,
    },
    "naive": {
        "det_model_name": "naive_det",
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

# document shares engine with general to avoid double init of same doc model
_DOC_ALIAS = "general"

# Model keys that use prewarmed zh/en/cht from third_party (OCR_INIT: direct use of initialized models).
_PREWARMED_MODEL_KEYS: Dict[str, str] = {
    "general": "zh",
    "general_en": "en",
    "general_cht": "cht",
}

_engines_by_model: Dict[str, Optional[CnOCREngine]] = {}
_cnocr_module_loaded = False
_ENGINE_QUEUE = "ocr.cnocr_engine_registry"
_ENGINE_WORKER = SerializedWorkerThread(_ENGINE_QUEUE, "CnOCREngineRegistryThread")
_ENGINE_WORKER.start()


def _is_cnocr_debug() -> bool:
    """True when PYCORE_CNOCR_DEBUG is 1/true/yes (env or set by app before init). Enables screen-capture test after init."""
    return os.environ.get("PYCORE_CNOCR_DEBUG", "").lower() in ("1", "true", "yes")


def _print_init_status() -> None:
    """打印 GPU/CPU 及各语言模型初始化情况（对齐 OCR_INIT 文档）。"""
    ColorPrint.blue("[CnOCR] --- OCR init (OCR_INIT) ---")
    gpu = is_onnx_cuda_usable()
    ctx = "GPU" if gpu else "CPU"
    ColorPrint.blue("[CnOCR] device=%s (onnx_cuda_usable=%s)" % (ctx, gpu))
    for key in ("general", "general_en", "general_cht"):
        eng = _engines_by_model.get(key)
        if eng is not None:
            rec = getattr(eng, "_effective_rec_model", None) or "?"
            eff_ctx = getattr(eng, "_effective_context", None) or "?"
            ColorPrint.blue("[CnOCR]   %s: rec=%s context=%s (prewarmed)" % (key, rec, eff_ctx))
        else:
            ColorPrint.gray("[CnOCR]   %s: not loaded" % key)


def _run_screen_capture_test() -> None:
    """PYCORE_CNOCR_DEBUG=1 或 app 设置时：截屏 -> 用 default 引擎 OCR -> 打印结果。"""
    try:
        ImageGrab = get_third_package_PIL_ImageGrab()
        if ImageGrab is None:
            ColorPrint.gray("[CnOCR DEBUG] Screen test skipped: ImageGrab not available")
            return
        bbox = (0, 0, 400, 120)
        img = ImageGrab.grab(bbox=bbox)
        if img is None:
            ColorPrint.gray("[CnOCR DEBUG] Screen test skipped: grab returned None")
            return
        default_eng = _get_engine_for_model_key("general")
        if default_eng is None:
            ColorPrint.yellow("[CnOCR DEBUG] Screen test skipped: no default engine")
            return
        out = default_eng.ocr(image=img)
        text = (out or {}).get("text", "") or ""
        ColorPrint.blue("[CnOCR DEBUG] Screen capture test (bbox=%s): text_len=%d sample=%s" % (
            bbox, len(text), repr(text[:80]) if text else ""))
    except Exception as e:
        ColorPrint.yellow("[CnOCR DEBUG] Screen test error: %s" % e)


def _ensure_cnocr_package_loaded() -> bool:
    """Load cnocr via third_party (lazy, returns None on failure). Idempotent."""
    global _cnocr_module_loaded
    if _cnocr_module_loaded:
        return True
    m = get_third_package_cnocr()
    _cnocr_module_loaded = m is not None
    if _cnocr_module_loaded:
        ColorPrint.green("[CnOCR] cnocr package loaded (third_party)")
    return _cnocr_module_loaded


def _det_order_for_default() -> Tuple[str, ...]:
    """Official: v5 then v4 then v3. When CUDA prefer _server (larger, better)."""
    if CUDADetector.is_cuda_available():
        return ('ch_PP-OCRv5_det_server', 'ch_PP-OCRv5_det', 'ch_PP-OCRv4_det_server', 'ch_PP-OCRv4_det', 'ch_PP-OCRv3_det', 'naive_det')
    return ('ch_PP-OCRv5_det', 'ch_PP-OCRv4_det', 'ch_PP-OCRv3_det', 'naive_det')


def _create_default_engine() -> Optional[CnOCREngine]:
    """Create default OCR engine. Det order: v5 (server when CUDA) -> v4 -> v3 -> naive_det. Rec: v5->v4->doc (official)."""
    profile = MODEL_PROFILES["general"]
    for det in _det_order_for_default():
        eng = CnOCREngine(
            det_model_name=det,
            rec_model_name=profile["rec_model_name"],
            rec_model_fallbacks=profile.get("rec_model_fallbacks") or [],
            cand_alphabet=profile.get("cand_alphabet"),
        )
        if eng.init():
            if det == 'naive_det':
                ColorPrint.gray("[CnOCR] Default engine using naive_det (no bbox position). Install huggingface_hub and/or download PP-OCR from cnstd-cnocr-models.")
            return eng
    return None


def _create_engine_from_prewarmed(resolve_key: str, lang: str) -> Optional[CnOCREngine]:
    """Build CnOCREngine from third_party prewarmed instance (per OCR_INIT: direct use of initialized models)."""
    prewarmed = get_cnocr_prewarmed(lang)
    if prewarmed is None:
        return None
    profile = MODEL_PROFILES.get(resolve_key)
    if not profile:
        return None
    eng = CnOCREngine(
        det_model_name=profile["det_model_name"],
        rec_model_name=profile["rec_model_name"],
        rec_model_fallbacks=profile.get("rec_model_fallbacks") or [],
        cand_alphabet=profile.get("cand_alphabet"),
        prewarmed_instance=prewarmed,
    )
    return eng


def _get_engine_for_model_key(model_key: str) -> Optional[CnOCREngine]:
    """Return cached engine for model_key. general/general_en/general_cht use prewarmed zh/en/cht; document reuses general."""
    global _engines_by_model
    resolve_key = _DOC_ALIAS if model_key == "document" else model_key
    if resolve_key not in _engines_by_model:
        _engines_by_model[resolve_key] = None
    eng = _engines_by_model[resolve_key]
    if eng is not None:
        return eng
    prewarmed_lang = _PREWARMED_MODEL_KEYS.get(resolve_key)
    if prewarmed_lang is not None:
        init_third_party_cnocr()
        eng = _create_engine_from_prewarmed(resolve_key, prewarmed_lang)
        if eng is not None:
            _engines_by_model[resolve_key] = eng
            ColorPrint.blue("[CnOCR] Using prewarmed engine for %s (lang=%s)" % (resolve_key, prewarmed_lang))
            return eng
        ColorPrint.gray("[CnOCR] No prewarmed instance for %s, falling back to init" % prewarmed_lang)
    if resolve_key == "general":
        init_third_party_cnocr()
        eng = _create_default_engine()
        if eng is not None:
            _engines_by_model[resolve_key] = eng
        return eng
    profile = MODEL_PROFILES.get(resolve_key)
    if profile is None:
        ColorPrint.yellow(f"[CnOCR] Unknown model key: {resolve_key}")
        return None
    if not _ensure_cnocr_package_loaded():
        return None
    eng = CnOCREngine(
        det_model_name=profile["det_model_name"],
        rec_model_name=profile["rec_model_name"],
        rec_model_fallbacks=profile.get("rec_model_fallbacks") or [],
        cand_alphabet=profile.get("cand_alphabet"),
    )
    if eng.init():
        _engines_by_model[resolve_key] = eng
        return eng
    ColorPrint.yellow(f"[CnOCR] Init failed for model: {resolve_key}")
    return None


def _ensure_cnocr_loaded_and_engines_initialized() -> bool:
    """
    Initialize CnOCR at app startup (not lazy). Per OCR_INIT.md: prewarm zh/en/cht,
    then eagerly create and cache all language engines (general, general_en, general_cht)
    from prewarmed; print GPU/CPU and model init status; if PYCORE_CNOCR_DEBUG=1 run screen
    capture test.
    """
    if not init_third_party_cnocr() or not _ensure_cnocr_package_loaded():
        return False
    # 默认初始化全部语言（OCR_INIT 文档：prewarm 后立即建 general / general_en / general_cht）
    for model_key in ("general", "general_en", "general_cht"):
        if _get_engine_for_model_key(model_key) is None:
            ColorPrint.yellow("[CnOCR] Engine %s (from prewarmed) not available after init" % model_key)
    _print_init_status()
    if _is_cnocr_debug():
        _run_screen_capture_test()
    return True


def ensure_cnocr_loaded_and_engines_initialized() -> bool:
    return call_serialized(
        _ENGINE_QUEUE,
        _ensure_cnocr_loaded_and_engines_initialized,
        timeout=600.0,
    )


def get_cnocr_engine_default() -> Optional[CnOCREngine]:
    """Default engine (same as general)."""
    return get_cnocr_engine_by_model_key("general")


def get_cnocr_engine_by_model_key(model_key: str) -> Optional[CnOCREngine]:
    """Return engine for model key: general, number, document."""
    return call_serialized(
        _ENGINE_QUEUE,
        _get_engine_for_model_key,
        model_key,
        timeout=600.0,
    )
