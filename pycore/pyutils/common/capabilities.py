# -*- coding: utf-8 -*-
"""
Capability probe — CUDA/compute + free-library availability for the
"Capability Status" UI.

Cheap and side-effect-free: library checks use importlib.util.find_spec (no heavy
import, no install), and the CUDA block reuses the cached, nvidia-smi-based
CUDADetector. Heavier per-engine probes (AI providers, OCR engines, edge-tts
live synth) keep their own dedicated endpoints; this fills the gaps —
GPU/CUDA compute readiness and the free, offline-capable libraries (translation,
TTS, OCR, STT) that the pipelines fall back to.
"""

import importlib.metadata
import importlib.util
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.system_paths import (
    APP_CACHE_DIR,
    APP_CONFIG_DIR,
    APP_DATA_DIR,
    APP_LOGS_DIR,
    SYSTEM_CACHE_DIR,
    UI_STATE_CACHE_DIR,
)
from pycore.pyfoundations.secret_manager import get_secret_directories

# Free / offline-capable libraries the pipelines use. module = import name probed
# with find_spec; dist = PyPI distribution name for the version lookup.
_FREE_LIBS = (
    {"name": "google_translate", "module": "googletrans",   "dist": "googletrans",     "category": "translate", "note": "Free Google translation (googletrans)"},
    {"name": "edge_tts",         "module": "edge_tts",       "dist": "edge-tts",        "category": "tts",       "note": "Microsoft Edge TTS (online, natural)"},
    {"name": "sherpa_onnx",      "module": "sherpa_onnx",    "dist": "sherpa-onnx",     "category": "tts",       "note": "Sherpa-ONNX offline TTS (CPU, never fails)"},
    {"name": "melotts",          "module": "melo",           "dist": "melotts",         "category": "tts",       "note": "MeloTTS offline TTS (zh/en mixed)"},
    {"name": "cnocr",            "module": "cnocr",          "dist": "cnocr",           "category": "ocr",       "note": "Free local OCR (CnOCR, onnxruntime)"},
    {"name": "easyocr",          "module": "easyocr",        "dist": "easyocr",         "category": "ocr",       "note": "Free local OCR (EasyOCR, torch)"},
    {"name": "windows_ocr",      "module": "winrt.windows.media.ocr", "dist": "winrt-Windows.Media.Ocr", "category": "ocr", "note": "Windows native OCR (WinRT)"},
    {"name": "faster_whisper",   "module": "faster_whisper", "dist": "faster-whisper",  "category": "stt",       "note": "Free local STT (faster-whisper)"},
    {"name": "whisper",          "module": "whisper",        "dist": "openai-whisper",  "category": "stt",       "note": "Free local STT (OpenAI Whisper)"},
    {"name": "vosk",             "module": "vosk",           "dist": "vosk",            "category": "stt",       "note": "Free offline STT (Vosk)"},
)


def _spec_available(module: str) -> bool:
    """True if a module is importable, WITHOUT importing it (find_spec safe)."""
    try:
        return importlib.util.find_spec(module) is not None
    except (ImportError, ValueError, ModuleNotFoundError):
        # find_spec raises when a parent package is itself absent (dotted names).
        return False


def _dist_version(dist: str) -> Optional[str]:
    try:
        return importlib.metadata.version(dist)
    except Exception:
        return None


def cuda_status() -> Dict[str, Any]:
    """CUDA / GPU compute readiness (cached, nvidia-smi based) + runtime flags."""
    info = CUDADetector.get_cuda_info()
    gpus = []
    for g in info.get("gpus", []) or []:
        if isinstance(g, dict):
            gpus.append({"name": g.get("name") or g.get("model") or "GPU",
                         "mem_total_mb": g.get("mem_total_mb") or g.get("memory_total_mb")})
        else:
            gpus.append({"name": str(g), "mem_total_mb": None})
    return {
        "available": bool(info.get("available")),
        "driver_version": info.get("driver_version"),
        "cuda_version": info.get("cuda_version"),
        "gpu_count": info.get("gpu_count", len(gpus)),
        "gpus": gpus,
        # Runtime libs that USE the GPU (installed-check only; cheap).
        "torch_installed": _spec_available("torch"),
        "onnxruntime_installed": _spec_available("onnxruntime"),
    }


def libraries_status() -> List[Dict[str, Any]]:
    """Availability + version for each free/offline library (find_spec only)."""
    out: List[Dict[str, Any]] = []
    for lib in _FREE_LIBS:
        available = _spec_available(lib["module"])
        out.append({
            "name": lib["name"],
            "category": lib["category"],
            "available": available,
            "version": _dist_version(lib["dist"]) if available else None,
            "note": lib["note"],
        })
    return out


def capabilities_status() -> Dict[str, Any]:
    """Full capability snapshot for the UI: CUDA block + free libraries."""
    return {
        "success": True,
        "cuda": cuda_status(),
        "libraries": libraries_status(),
    }


# --------------------------------------------------------------------------- #
# Hardcoded constants + static directories (read-only; fixed in code).         #
# --------------------------------------------------------------------------- #
# Keyed registry of the static directories pycore uses. The OPEN endpoint takes
# a KEY (never an arbitrary path) and resolves it here, so it can only ever open
# one of these known locations.
def _static_dir_registry() -> List[Tuple[str, str, Path, str]]:
    """(key, label, path, note) for each static directory pycore uses."""
    try:
        secret_dirs = get_secret_directories()
    except Exception:
        secret_dirs = {}
    secret_raw = secret_dirs.get("RAW_DIR")
    entries: List[Tuple[str, str, Any, str]] = [
        ("app_cache",   "App cache",    APP_CACHE_DIR,      "Decoded media / TTS / OCR cache (.core_node/cache)"),
        ("app_config",  "App config",   APP_CONFIG_DIR,     "Headless service configuration (.core_node/config)"),
        ("app_data",    "App data",     APP_DATA_DIR,       "Unified user-data store (.core_node/data)"),
        ("app_logs",    "App logs",     APP_LOGS_DIR,       "Service logs (.core_node/logs)"),
        ("ui_state",    "UI state",     UI_STATE_CACHE_DIR, "Desktop UI state cache (.core_node/ui_state)"),
        ("system_cache","System cache", SYSTEM_CACHE_DIR,   "Root cache directory (.core_node)"),
    ]
    if secret_raw:
        entries.append(("secret_keys", "Secret keys", secret_raw,
                        "Decrypted secret values (.secret_keys/.secret_ignore) — gitignored"))
    # Normalize to Path.
    return [(k, label, Path(p), note) for (k, label, p, note) in entries if p]


def static_directories() -> List[Dict[str, Any]]:
    """The static directories pycore uses, with existence (read-only display)."""
    out: List[Dict[str, Any]] = []
    for key, label, path, note in _static_dir_registry():
        out.append({
            "key": key,
            "label": label,
            "path": str(path),
            "exists": path.exists(),
            "note": note,
        })
    return out


def resolve_static_dir(key: str) -> Optional[Path]:
    """Resolve a static-directory KEY to its Path (open allow-list), or None."""
    for k, _label, path, _note in _static_dir_registry():
        if k == key:
            return path
    return None


def pycore_constants() -> List[Dict[str, Any]]:
    """
    Selected pycore constants that are FIXED IN CODE (not user-configurable).

    Shown read-only in the UI so operators can see the load-bearing values
    without hunting through source. Editing requires a code change.
    """
    return [
        {"key": "edge_tts_min_version", "value": ">= 7.2.4 (latest)",
         "note": "edge-tts is kept at latest; old versions 403 on a stale Sec-MS-GEC handshake"},
        {"key": "tts_engine_priority", "value": "edge → sherpa → melotts → gptsovits",
         "note": "TTS engine fallback order (override with TTS_ENGINE_PRIORITY)"},
        {"key": "tts_rate", "value": "-20%",
         "note": "Default speech rate for the subtitle pipeline (override with EDGE_TTS_RATE)"},
        {"key": "ocr_engine_priority", "value": "windows → easyocr → cnocr → ai-vision",
         "note": "OCR engine fallback order for the screenshot pipeline"},
        {"key": "ai_dispatch_order", "value": "free → balance → paid",
         "note": "Unified AI gateway smart-dispatch tier order"},
        {"key": "rpc_port", "value": "59000",
         "note": "Default pycore backend (RPC v2 / HTTP API) port"},
        {"key": "ui_port", "value": "13054",
         "note": "Default dashboard UI dev-server port (PySide6 webview target)"},
        {"key": "screenshot_interval", "value": "60s",
         "note": "Default auto-subtitle screenshot capture interval"},
        {"key": "tts_retry_attempts", "value": "3",
         "note": "edge-tts synth retry attempts with backoff before giving up"},
        {"key": "app_root", "value": str(SYSTEM_CACHE_DIR),
         "note": "Root of all pycore runtime directories (.core_node)"},
    ]


def system_info() -> Dict[str, Any]:
    """Read-only constants + static directories for the Settings / Status UI."""
    return {
        "success": True,
        "constants": pycore_constants(),
        "directories": static_directories(),
    }


__all__ = [
    "capabilities_status", "cuda_status", "libraries_status",
    "system_info", "pycore_constants", "static_directories", "resolve_static_dir",
]
