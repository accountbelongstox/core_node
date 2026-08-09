# -*- coding: utf-8 -*-
"""
OCR orchestrator — ONE entry that picks the highest-priority AVAILABLE local
OCR engine and extracts text from an image.

Priority (highest first), per project decision:
    1. windows  — Windows.Media.Ocr (WinRT). Native, offline, no GPU.
    2. easyocr  — torch/GPU OCR (heavy; high accuracy).
    3. cnocr    — CnOCR (onnxruntime, GPU/CPU; ships installed in this env).

The AI-vision fallback (transcribe the screenshot with a vision model) is NOT
here: it needs the pyctl AI gateway, and pyutils must not import pyctl. The
desktop pipeline calls extract_text() first and only falls back to the AI-vision
hook when this returns no text — see pyctl.desktop.processor.

Availability is probed CHEAPLY with importlib.util.find_spec so a status call
never imports torch or triggers a pip install. A real extract_text() call may
lazily build an engine, but only for engines whose package is already present —
it never triggers the WinRT/easyocr auto-install in the hot screenshot loop
(that is the install_ocr prerequisite's job).
"""

import base64
import importlib.metadata
import importlib.util
import os
import time
from pathlib import Path
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import TMP_DIR
from pycore.pyfoundations.third_party.api import get_third_package_easyocr

from pycore.pyutils.ocr_cluster.ocr_windows_engine import create_windows_ocr
from pycore.pyutils.common.ocr.manager import ocr_manager
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_OCR_KEY,
    status_snapshot_cache,
)

from pycore.pyutils.common.ocr.cnocr_engine import CnOCREngine



# Ordered engine priority. Each entry: (name, spec-module, PyPI dist for version).
# The spec module is what we import-check; it must NOT trigger any install.
_ENGINE_SPECS = (
    ("windows", "winrt.windows.media.ocr", "winrt-Windows.Media.Ocr"),
    ("easyocr", "easyocr", "easyocr"),
    ("cnocr", "cnocr", "cnocr"),
)
OCR_ENGINE_PRIORITY = tuple(name for name, _, _ in _ENGINE_SPECS)

# Lazily-built engine instances (built once, reused). Guarded for the screenshot
# monitor thread + request threads hitting extract_text concurrently.
_OCR_QUEUE = 'pyutils.ocr.orchestrator'
_OCR_WORKER = SerializedWorkerThread(_OCR_QUEUE, 'OCROrchestratorThread')
_OCR_WORKER.start()
_windows_engine: Any = None       # WindowsOCREngine or False (init failed)
_easyocr_reader: Any = None       # easyocr.Reader or False
_EASYOCR_LANGS = ("ch_sim", "en")


def _spec_available(module: str) -> bool:
    """True if the module can be imported WITHOUT importing it (no install)."""
    try:
        return importlib.util.find_spec(module) is not None
    except (ImportError, ValueError, ModuleNotFoundError):
        # find_spec raises if a parent package is itself missing — treat as absent.
        return False


def _dist_version(dist: str) -> Optional[str]:
    try:
        return importlib.metadata.version(dist)
    except Exception:
        return None


def engine_available(name: str) -> bool:
    """Cheap availability probe for one engine (no heavy import / no install)."""
    for ename, spec, _dist in _ENGINE_SPECS:
        if ename == name:
            return _spec_available(spec)
    return False


def best_engine() -> Optional[str]:
    """Highest-priority engine whose package is installed, or None."""
    for name, spec, _dist in _ENGINE_SPECS:
        if _spec_available(spec):
            return name
    return None


def _build_ocr_status() -> Dict[str, Any]:
    """
    Availability snapshot for the UI (no OCR run, no install triggered).

    Shape:
        { success, best, available_count,
          engines: [ {name, priority, available, note}, ... ] }
    """
    engines: List[Dict[str, Any]] = []
    notes = {
        "windows": "Windows.Media.Ocr (WinRT) — native, offline",
        "easyocr": "EasyOCR (torch/GPU) — high accuracy, heavy",
        "cnocr": "CnOCR (onnxruntime) — GPU/CPU local OCR",
    }
    for i, (name, _spec, dist) in enumerate(_ENGINE_SPECS):
        avail = engine_available(name)
        engines.append({
            "name": name,
            "priority": i + 1,
            "available": avail,
            "version": _dist_version(dist) if avail else None,
            "note": notes.get(name, ""),
        })
    avail = [e for e in engines if e["available"]]
    best = next((entry["name"] for entry in engines if entry["available"]), None)
    return {
        "success": True,
        "best": best,
        "available_count": len(avail),
        "engines": engines,
    }


def ocr_status() -> Dict[str, Any]:
    """Return the shared cached OCR availability snapshot."""
    return status_snapshot_cache.get(STATUS_SNAPSHOT_OCR_KEY, _build_ocr_status)


# --------------------------------------------------------------------------- #
# Per-engine extraction (each returns extracted text or "" on failure).        #
# --------------------------------------------------------------------------- #
def _extract_windows(image_path: str) -> str:
    global _windows_engine
    if _windows_engine is None:
        _windows_engine = create_windows_ocr() or False
    engine = _windows_engine
    if not engine:
        return ""
    return (engine.ocr(img_path=image_path).get("text") or "").strip()


def _extract_easyocr(image_path: str) -> str:
    global _easyocr_reader
    if _easyocr_reader is None:
        easyocr = get_third_package_easyocr()
        if easyocr is None:
            _easyocr_reader = False
            return ""
        _easyocr_reader = easyocr.Reader(list(_EASYOCR_LANGS))
    reader = _easyocr_reader
    if not reader:
        return ""
    # detail=0 -> list of plain strings, top-to-bottom reading order.
    lines = reader.readtext(image_path, detail=0, paragraph=True)
    return "\n".join(s for s in lines if s).strip()


# pycore lang code -> CnOCR model_type (cnocr handles mixed scripts within each).
_CNOCR_MODEL_BY_LANG = {
    "en": "english",
    "zh": "general",
    "cht": "chinese_traditional",
    "zh-tw": "chinese_traditional",
    "ja": "general",
    "ko": "general",
}


def _extract_cnocr(image_path: str, lang: Optional[str] = None) -> str:
    model_type = _CNOCR_MODEL_BY_LANG.get((lang or "").lower(), "general")
    res = ocr_manager.recognize_image(image_path, model_type=model_type)
    if res.get("success"):
        return (res.get("text") or "").strip()
    return ""


# Windows / easyocr auto-detect language; the hint only steers cnocr today.
_EXTRACTORS = {
    "windows": lambda path, lang=None: _extract_windows(path),
    "easyocr": lambda path, lang=None: _extract_easyocr(path),
    "cnocr": _extract_cnocr,
}


def _extract_text(image_path: str, lang: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract text from an image using the best available local OCR engine.

    Walks the priority order; the first available engine that returns non-empty
    text wins. An engine that errors or returns nothing falls through to the
    next. Engines whose package is not installed are skipped (never installed
    here — that is the prerequisite step's job).

    `lang` is the recognition-language hint (pycore code like "en"/"zh") that the
    UI selects; it currently steers the CnOCR model (windows/easyocr auto-detect).

    Returns:
        { success, text, engine, error, tried: [names] }
    """
    if not image_path or not Path(image_path).exists():
        return {"success": False, "text": "", "engine": None,
                "error": f"Image file not found: {image_path}", "tried": []}

    tried: List[str] = []
    last_error: Optional[str] = None
    for name, spec, _dist in _ENGINE_SPECS:
        if not _spec_available(spec):
            continue
        tried.append(name)
        try:
            text = _EXTRACTORS[name](image_path, lang)
        except Exception as e:  # noqa: BLE001 — try the next engine, surface last error
            last_error = f"{name}: {e}"
            ColorPrint.yellow(f"[ocr] {name} failed ({e}); trying next engine")
            continue
        if text:
            return {"success": True, "text": text, "engine": name,
                    "error": None, "tried": tried}
        ColorPrint.gray(f"[ocr] {name} returned no text; trying next engine")

    return {
        "success": False,
        "text": "",
        "engine": None,
        "error": last_error or ("No OCR engine available" if not tried
                                else "All OCR engines returned no text"),
        "tried": tried,
    }


def _extract_text_engine(engine: str, image_path: str, lang: Optional[str] = None,
                         model_type: Optional[str] = None,
                         languages: Optional[List[str]] = None) -> Dict[str, Any]:
    """Extract text with ONE specific engine (no fallback). Returns
    {success, text, engine, error}. Unknown / not-installed engines report
    success=False with a clear error instead of raising.

    Per-engine extra params:
    - model_type (cnocr): "general" | "scene" | "doc" | "number" | "english" | "chinese_traditional"
    - languages (easyocr): e.g. ["en", "ch_sim"] to override default ["ch_sim", "en"]"""
    if engine not in _EXTRACTORS:
        return {"success": False, "text": "", "engine": engine,
                "error": f"unknown OCR engine: {engine}"}
    if not engine_available(engine):
        return {"success": False, "text": "", "engine": engine,
                "error": f"{engine} not installed"}
    try:
        extra: Dict[str, Any] = {}
        if model_type:
            extra["model_type"] = model_type
        if languages:
            extra["languages"] = languages
        text = _EXTRACTORS[engine](image_path, lang) if not extra else \
            _extract_with_extra(engine, image_path, lang, extra)
    except Exception as e:  # noqa: BLE001 - surface the engine failure, do not fall through
        return {"success": False, "text": "", "engine": engine, "error": f"{e}"}
    text = (text or "").strip()
    if not text:
        return {"success": False, "text": "", "engine": engine,
                "error": f"{engine} returned no text"}
    return {"success": True, "text": text, "engine": engine, "error": None}


def extract_text(image_path: str, lang: Optional[str] = None) -> Dict[str, Any]:
    """Extract text through the OCR owner thread."""
    return call_serialized(
        _OCR_QUEUE,
        _extract_text,
        image_path,
        lang,
        timeout=300.0,
    )


def extract_text_engine(engine: str, image_path: str, lang: Optional[str] = None,
                        model_type: Optional[str] = None,
                        languages: Optional[List[str]] = None) -> Dict[str, Any]:
    """Run one OCR engine through the OCR owner thread."""
    return call_serialized(
        _OCR_QUEUE,
        _extract_text_engine,
        engine,
        image_path,
        lang,
        model_type,
        languages,
        timeout=300.0,
    )


def _extract_with_extra(engine: str, image_path: str, lang: Optional[str],
                         extra: Dict[str, Any]) -> str:
    """Call an OCR extractor with engine-specific extra params. Currently handles
    cnocr model_type and easyocr language list overrides."""
    if engine == "windows_ocr":
        return _EXTRACTORS[engine](image_path, lang)
    if engine == "easyocr":
        return _extract_easyocr_with_langs(image_path, extra.get("languages"))
    if engine == "cnocr":
        return _extract_cnocr_with_model(image_path, lang, extra.get("model_type"))
    return _EXTRACTORS[engine](image_path, lang)


def _extract_easyocr_with_langs(image_path: str, languages: Optional[List[str]]) -> str:
    """EasyOCR extraction with a custom language list (defaults to ['ch_sim', 'en'])."""
    easyocr = get_third_package_easyocr()
    if easyocr is None:
        return ""
    langs = languages if languages and len(languages) > 0 else _easyocr_langs
    reader = easyocr.Reader(langs)  # type: ignore[no-untyped-call]
    result = reader.readtext(image_path, detail=0, paragraph=True)  # type: ignore[no-untyped-call]
    return " ".join(result).strip() if result else ""


def _extract_cnocr_with_model(image_path: str, lang: Optional[str],
                               model_type: Optional[str]) -> str:
    """CnOCR extraction with a specific model type."""
    ocr = CnOCREngine()
    recognized = ocr.recognize(image_path, model_type=model_type)
    return recognized.text if recognized and recognized.text else ""


def ocr_test(engine: Optional[str] = None, image_path: Optional[str] = None,
             image_data: Optional[str] = None, lang: Optional[str] = None,
             # Per-engine extra params.
             model_type: Optional[str] = None,
             languages: Optional[List[str]] = None,
             **extra_params: Any) -> Dict[str, Any]:
    """Live OCR test for ONE engine (or the best available). Resolves the image
    from a base64 data-URL / raw base64 (``image_data``) or a filesystem path
    (``image_path``), runs the engine, and returns
    {success, engine, text, latency_ms, error, model_type}. The decoded base64
    image is written to a temp file and removed afterwards; a caller-supplied
    ``image_path`` is never deleted.

    Per-engine params:
    - model_type (cnocr): "general"|"scene"|"doc"|"number"|"english"|"chinese_traditional"
    - languages (easyocr): list of language codes to override default ["ch_sim", "en"]"""
    name = engine or best_engine()
    if not name:
        return {"success": False, "engine": None, "text": "", "latency_ms": 0,
                "error": "no OCR engine available"}

    tmp_path: Optional[str] = None
    resolved = image_path
    if not resolved and image_data:
        try:
            raw = image_data.strip()
            # Strip an optional data-URL prefix: data:image/png;base64,XXXX
            if raw.startswith("data:") and "," in raw:
                raw = raw.split(",", 1)[1]
            tmp_dir = TMP_DIR / "pycore_ocr_test"
            tmp_dir.mkdir(parents=True, exist_ok=True)
            tmp_path = str(tmp_dir / "sample.png")
            with open(tmp_path, "wb") as fh:
                fh.write(base64.b64decode(raw))
            resolved = tmp_path
        except Exception as e:  # noqa: BLE001
            return {"success": False, "engine": name, "text": "", "latency_ms": 0,
                    "error": f"could not decode image_data: {e}"}

    if not resolved or not Path(resolved).exists():
        return {"success": False, "engine": name, "text": "", "latency_ms": 0,
                "error": "no image provided (upload or paste an image, or let the popup render sample text)"}

    t0 = time.monotonic()
    try:
        result = extract_text_engine(name, resolved, lang,
                                     model_type=model_type, languages=languages)
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except Exception:  # noqa: BLE001 - cleanup is best-effort
                pass
    result["latency_ms"] = round((time.monotonic() - t0) * 1000)
    result["route"] = "/api/local/ocr/test"
    if model_type:
        result["model_type"] = model_type
    if languages:
        result["languages"] = languages
    return result


__all__ = [
    "OCR_ENGINE_PRIORITY",
    "engine_available",
    "best_engine",
    "ocr_status",
    "extract_text",
    "extract_text_engine",
    "ocr_test",
]
