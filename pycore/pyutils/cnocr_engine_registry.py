"""
CnOCR engine registry (generic, pycore-only).
Uses third_party for cnocr (lazy load, returns None on failure). Engines created on first use by model key.
document shares engine with general to avoid double init. GPU/CPU chosen in CnOCREngine (gpu then cpu).
"""
from typing import Optional, Dict, Any

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_cnocr
from pycore.pyutils.ocr_cnocr_engine import CnOCREngine

# (det, rec, rec_fallbacks, cand_alphabet). Prefer free doc model; number uses -fc + cand_alphabet, fallback to doc.
# "document" uses same engine as "general" (single init for doc model).
MODEL_PROFILES: Dict[str, Dict[str, Any]] = {
    "general": {
        "det_model_name": "naive_det",
        "rec_model_name": "doc-densenet_lite_136-gru",
        "rec_model_fallbacks": ["densenet_lite_136-gru"],
        "cand_alphabet": None,
    },
    "number": {
        "det_model_name": "naive_det",
        "rec_model_name": "number-densenet_lite_136-fc",
        "rec_model_fallbacks": ["doc-densenet_lite_136-gru"],
        "cand_alphabet": "0123456789",
    },
    "document": {
        "det_model_name": "naive_det",
        "rec_model_name": "doc-densenet_lite_136-gru",
        "rec_model_fallbacks": [],
        "cand_alphabet": None,
    },
}

# document shares engine with general to avoid double init of same doc model
_DOC_ALIAS = "general"

_engines_by_model: Dict[str, Optional[CnOCREngine]] = {}
_cnocr_module_loaded = False


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


def _get_engine_for_model_key(model_key: str) -> Optional[CnOCREngine]:
    """Return cached initialized engine for model_key; create and init if missing. document reuses general."""
    global _engines_by_model
    resolve_key = _DOC_ALIAS if model_key == "document" else model_key
    if resolve_key not in _engines_by_model:
        _engines_by_model[resolve_key] = None
    eng = _engines_by_model[resolve_key]
    if eng is not None:
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


def ensure_cnocr_loaded_and_engines_initialized() -> bool:
    """
    Lazy-load cnocr via third_party only. Do not pre-initialize engines;
    engines are created on first get_cnocr_engine_by_model_key() / get_cnocr_engine_for_task().
    Call once at app startup to ensure package is loadable.
    """
    return _ensure_cnocr_package_loaded()


def get_cnocr_engine_default() -> Optional[CnOCREngine]:
    """Default engine (same as general)."""
    return get_cnocr_engine_by_model_key("general")


def get_cnocr_engine_by_model_key(model_key: str) -> Optional[CnOCREngine]:
    """Return engine for model key: general, number, document."""
    return _get_engine_for_model_key(model_key)
