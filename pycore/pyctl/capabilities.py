# -*- coding: utf-8 -*-
"""
Capability orchestration — CUDA/compute + free-library availability for the
"Capability Status" UI.

Cheap and side-effect-free: library checks use importlib.util.find_spec (no heavy
import, no install), TTS engine rows use installed / managed-running snapshots
(no HTTP health probes), and the CUDA block reuses the cached, nvidia-smi-based
CUDADetector. Heavier per-engine probes (AI providers, OCR/TTS/STT orchestrators, edge-tts
live synth) keep their own dedicated endpoints; this fills the gaps —
GPU/CUDA compute readiness and the pycore library registry (pip packages +
local/API neural engines) with GPU/CPU model tier metadata for the UI.
"""

import importlib.metadata
import importlib.util
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.network_constants import PYCORE_HTTP_PORT
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
from pycore.pyutils.common.model_tiers import (
    TIER_TABLE,
    engine_model,
    gpu_present,
    runtime_faster_whisper_model,
    runtime_whisper_model,
    tier_summary_lines,
)
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.tts.tts_orchestrator import default_tts_engine_priority
from pycore.pyutils.tts.tts_engine_probe import engine_installed


# Pip-installable libraries (find_spec probe). tier_engine -> TIER_TABLE key.
_PIP_LIBS = (
    {"name": "google_translate", "module": "googletrans", "dist": "googletrans",
     "category": "translate", "note": "Free Google translation (googletrans)"},
    {"name": "faster_whisper", "module": "faster_whisper", "dist": "faster-whisper",
     "category": "stt", "tier_engine": "faster_whisper",
     "note": "CTranslate2 Whisper STT (GPU large-v3 / CPU medium)"},
    {"name": "whisper", "module": "whisper", "dist": "openai-whisper",
     "category": "stt", "tier_engine": "whisper",
     "note": "OpenAI Whisper STT (GPU large-v3 / CPU medium)"},
    {"name": "vosk", "module": "vosk", "dist": "vosk", "category": "stt",
     "note": "Free offline STT (Vosk; needs VOSK_MODEL_DIR)"},
    {"name": "cnocr", "module": "cnocr", "dist": "cnocr", "category": "ocr",
     "note": "Free local OCR (CnOCR, onnxruntime)"},
    {"name": "easyocr", "module": "easyocr", "dist": "easyocr", "category": "ocr",
     "note": "Free local OCR (EasyOCR, torch)"},
    {"name": "windows_ocr", "module": "winrt.windows.media.ocr",
     "dist": "winrt-Windows.Media.Ocr", "category": "ocr",
     "note": "Windows native OCR (WinRT)"},
    {"name": "edge_tts", "module": "edge_tts", "dist": "edge-tts", "category": "tts",
     "note": "Microsoft Edge TTS (online, natural)"},
    {"name": "sherpa_onnx", "module": "sherpa_onnx", "dist": "sherpa-onnx",
     "category": "tts", "tier_engine": "sherpa",
     "note": "Sherpa-ONNX offline TTS (Kokoro multi-lang)"},
    {"name": "kokoro", "module": "sherpa_onnx", "dist": "sherpa-onnx",
     "category": "tts", "tier_engine": "kokoro", "probe_engine": "kokoro",
     "note": "Kokoro-82M via sherpa-onnx (zh/en offline)"},
    {"name": "voxcpm", "module": "voxcpm", "dist": "voxcpm", "category": "tts",
     "tier_engine": "voxcpm2", "probe_engine": "voxcpm2",
     "note": "VoxCPM2 in-process TTS (OpenBMB multilingual clone)"},
    # qwen3tts and melotts are class-C isolated-venv HTTP servers, NOT main-interpreter
    # pip packages - they appear once each in _API_TTS_LIBS below (installed/available
    # reflect venv readiness + server health, not a stray main-interpreter probe).
)

# Local HTTP / in-process neural TTS engines (orchestrator availability probe).
_API_TTS_LIBS = (
    {"name": "chattts", "category": "tts", "probe_engine": "chattts",
     "note": "ChatTTS dialogue TTS (laughs/sighs; CHATTTS_URL local api)"},
    {"name": "cosyvoice", "category": "tts", "tier_engine": "cosyvoice",
     "probe_engine": "cosyvoice",
     "note": "CosyVoice multilingual clone (COSYVOICE_URL; iic/CosyVoice2-0.5B)"},
    {"name": "fishspeech", "category": "tts", "tier_engine": "fishspeech",
     "probe_engine": "fishspeech",
     "note": "Fish Speech clone (openaudio-s1 GPU / openaudio-s1-mini CPU)"},
    {"name": "qwen3tts", "category": "tts", "tier_engine": "qwen3tts",
     "probe_engine": "qwen3tts",
     "note": "Qwen3-TTS multilingual (isolated-venv HTTP server; 1.7B GPU / 0.6B CPU)"},
    {"name": "melotts", "category": "tts", "tier_engine": "melotts",
     "probe_engine": "melotts",
     "note": "MeloTTS offline TTS (isolated-venv HTTP server; zh/en mixed)"},
    {"name": "bark", "category": "tts", "tier_engine": "bark", "probe_engine": "bark",
     "note": "Bark expressive TTS (transformers suno/bark; Python 3.13 native)"},
    {"name": "parler", "category": "tts", "tier_engine": "parler", "probe_engine": "parler",
     "note": "Parler-TTS voice-description TTS (HF parler-tts; Python 3.13 native)"},
    {"name": "gptsovits", "category": "tts", "tier_engine": "gptsovits",
     "probe_engine": "gptsovits",
     "note": "GPT-SoVITS voice clone (GPTSOVITS_HF_ALLOW GPU=* / CPU v2)"},
    {"name": "f5tts", "category": "tts", "probe_engine": "f5tts",
     "note": "F5-TTS flow-matching clone (F5TTS_URL local api)"},
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


def _tts_engine_available(name: str) -> bool:
    """Cheap snapshot: managed running, else installed. No HTTP health probes.

    Live readiness stays on dedicated TTS status endpoints; this registry must
    stay side-effect-free for the capability panel.
    """
    try:
        if managed_services.spec(name) is not None:
            return bool(managed_services.is_running(name))
    except Exception:
        pass
    return _tts_engine_installed(name)


def _tier_payload(tier_engine: Optional[str]) -> Dict[str, Any]:
    if not tier_engine:
        return {}
    row = TIER_TABLE.get(tier_engine)
    if not row:
        return {}
    gpu = gpu_present()
    active = engine_model(tier_engine, gpu)
    if tier_engine == "whisper" and _spec_available("whisper"):
        active = runtime_whisper_model()
    elif tier_engine == "faster_whisper" and _spec_available("faster_whisper"):
        active = runtime_faster_whisper_model()
    return {
        "model_gpu": row["gpu"],
        "model_cpu": row["cpu"],
        "model_active": active,
        "env": row.get("env"),
    }


def _tts_engine_installed(name: str) -> bool:
    try:
        return bool(engine_installed(name))
    except Exception:
        return False


def _library_entry(
    name: str,
    category: str,
    note: str,
    available: bool,
    installed: bool,
    version: Optional[str] = None,
    kind: str = "pip",
    tier_engine: Optional[str] = None,
) -> Dict[str, Any]:
    entry: Dict[str, Any] = {
        "name": name,
        "category": category,
        "kind": kind,
        "available": available,
        "installed": installed,
        "version": version,
        "note": note,
    }
    entry.update(_tier_payload(tier_engine))
    return entry


def libraries_status() -> List[Dict[str, Any]]:
    """Pycore library registry: pip packages + neural TTS engines with model tiers."""
    out: List[Dict[str, Any]] = []
    for lib in _PIP_LIBS:
        module = lib["module"]
        probe = lib.get("probe_engine")
        pip_ok = _spec_available(module)
        if probe:
            avail = _tts_engine_available(probe)
            inst = _tts_engine_installed(probe)
        else:
            avail = pip_ok
            inst = pip_ok
        version = _dist_version(lib["dist"]) if pip_ok else None
        out.append(_library_entry(
            lib["name"], lib["category"], lib["note"], avail, inst, version,
            kind="pip", tier_engine=lib.get("tier_engine"),
        ))
    for lib in _API_TTS_LIBS:
        probe = lib.get("probe_engine") or lib["name"]
        inst = _tts_engine_installed(probe)
        out.append(_library_entry(
            lib["name"], lib["category"], lib["note"],
            _tts_engine_available(probe), inst, None,
            kind="api", tier_engine=lib.get("tier_engine"),
        ))
    return out


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


def capabilities_status() -> Dict[str, Any]:
    """Full capability snapshot for the UI: CUDA block + pycore library registry."""
    return {
        "success": True,
        "cuda": cuda_status(),
        "libraries": libraries_status(),
        "model_tiers": [
            {"engine": key, **row}
            for key, row in TIER_TABLE.items()
        ],
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
        {"key": "tts_engine_priority", "value": " → ".join(default_tts_engine_priority()),
         "note": "TTS engine fallback order (override with TTS_ENGINE_PRIORITY)"},
        {"key": "tts_rate", "value": "-20%",
         "note": "Default speech rate for the subtitle pipeline (override with EDGE_TTS_RATE)"},
        {"key": "ocr_engine_priority", "value": "windows → easyocr → cnocr → ai-vision",
         "note": "OCR engine fallback order for the screenshot pipeline"},
        {"key": "model_tiers", "value": " | ".join(tier_summary_lines()),
         "note": "GPU/CPU max model tiers (pycore/tts_install_assets/tts_model_tiers.py)"},
        {"key": "ai_dispatch_order", "value": "free → balance → paid",
         "note": "Unified AI gateway smart-dispatch tier order"},
        {"key": "rpc_port", "value": str(PYCORE_HTTP_PORT),
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
