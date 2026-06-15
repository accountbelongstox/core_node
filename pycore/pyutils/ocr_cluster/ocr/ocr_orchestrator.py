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

import importlib.util
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

# Ordered engine priority. Each entry: (name, spec-module probed for availability).
# The spec module is what we import-check; it must NOT trigger any install.
_ENGINE_SPECS = (
    ("windows", "winrt.windows.media.ocr"),
    ("easyocr", "easyocr"),
    ("cnocr", "cnocr"),
)
OCR_ENGINE_PRIORITY = tuple(name for name, _ in _ENGINE_SPECS)

# Lazily-built engine instances (built once, reused). Guarded for the screenshot
# monitor thread + request threads hitting extract_text concurrently.
_lock = threading.Lock()
_windows_engine: Any = None       # WindowsOCREngine or False (init failed)
_easyocr_reader: Any = None       # easyocr.Reader or False
_easyocr_langs = ["ch_sim", "en"]


def _spec_available(module: str) -> bool:
    """True if the module can be imported WITHOUT importing it (no install)."""
    try:
        return importlib.util.find_spec(module) is not None
    except (ImportError, ValueError, ModuleNotFoundError):
        # find_spec raises if a parent package is itself missing — treat as absent.
        return False


def engine_available(name: str) -> bool:
    """Cheap availability probe for one engine (no heavy import / no install)."""
    for ename, spec in _ENGINE_SPECS:
        if ename == name:
            return _spec_available(spec)
    return False


def best_engine() -> Optional[str]:
    """Highest-priority engine whose package is installed, or None."""
    for name, spec in _ENGINE_SPECS:
        if _spec_available(spec):
            return name
    return None


def ocr_status() -> Dict[str, Any]:
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
    for i, (name, _spec) in enumerate(_ENGINE_SPECS):
        engines.append({
            "name": name,
            "priority": i + 1,
            "available": engine_available(name),
            "note": notes.get(name, ""),
        })
    avail = [e for e in engines if e["available"]]
    return {
        "success": True,
        "best": best_engine(),
        "available_count": len(avail),
        "engines": engines,
    }


# --------------------------------------------------------------------------- #
# Per-engine extraction (each returns extracted text or "" on failure).        #
# --------------------------------------------------------------------------- #
def _extract_windows(image_path: str) -> str:
    global _windows_engine
    with _lock:
        if _windows_engine is None:
            from pycore.pyutils.ocr_cluster.ocr_windows_engine import create_windows_ocr
            _windows_engine = create_windows_ocr() or False
        engine = _windows_engine
    if not engine:
        return ""
    return (engine.ocr(img_path=image_path).get("text") or "").strip()


def _extract_easyocr(image_path: str) -> str:
    global _easyocr_reader
    with _lock:
        if _easyocr_reader is None:
            import easyocr
            _easyocr_reader = easyocr.Reader(_easyocr_langs)
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
    from pycore.pyutils.ocr_cluster.ocr.ocr_manager import ocr_manager
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


def extract_text(image_path: str, lang: Optional[str] = None) -> Dict[str, Any]:
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
    for name, spec in _ENGINE_SPECS:
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


__all__ = [
    "OCR_ENGINE_PRIORITY",
    "engine_available",
    "best_engine",
    "ocr_status",
    "extract_text",
]
