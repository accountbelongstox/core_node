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
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_CAPABILITIES_KEY,
    STATUS_SNAPSHOT_SYSTEM_INFO_KEY,
    status_snapshot_cache,
)
from pycore.pyctl.ai.ai_gateway_state import DISPATCH_TIER_ORDER
import pycore.pyctl.ai_hub.manifest_loader as manifest_loader
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator import OCR_ENGINE_PRIORITY
from pycore.pyutils.tts.tts_orchestrator import default_tts_engine_priority
from pycore.pyutils.tts.tts_engine_probe import engine_installed


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
    """Cheap snapshot: known managed state, else installed. No health probes.

    Live readiness stays on dedicated TTS status endpoints; this registry must
    stay side-effect-free for the capability panel.
    """
    try:
        if managed_services.spec(name) is not None:
            return bool(managed_services.peek_running(name))
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


def _engine_row_state(
    entry_id: str,
    cached_tts: Dict[str, Dict[str, Any]],
) -> Tuple[bool, bool]:
    cached = cached_tts.get(entry_id)
    if isinstance(cached, dict):
        return bool(cached.get("available")), bool(cached.get("installed"))
    return _tts_engine_available(entry_id), _tts_engine_installed(entry_id)


def libraries_status(
    tts_engines: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Pycore library registry derived from the model manifest: pip packages and
    local/API engines with model tiers (one row per manifest entry)."""
    cached_tts = tts_engines or {}
    rows = [
        entry for entry in manifest_loader.load().entries() if entry.library_kind
    ]
    ordered = [e for e in rows if e.library_kind == "pip"] + [
        e for e in rows if e.library_kind != "pip"
    ]
    out: List[Dict[str, Any]] = []
    for entry in ordered:
        pip_ok = bool(entry.pip) and _spec_available(entry.pip[0])
        if entry.library_kind == "pip" and not entry.library_probe:
            avail = inst = pip_ok
        else:
            avail, inst = _engine_row_state(entry.id, cached_tts)
        version = _dist_version(entry.pip[1]) if pip_ok else None
        row = _library_entry(
            entry.library_name or entry.id, entry.category, entry.note, avail, inst,
            version, kind=entry.library_kind, tier_engine=entry.tier_engine,
        )
        row["id"] = entry.id
        row["boot"] = model_boot.record(entry.id, entry.category)
        out.append(row)
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


def _build_capabilities_status(
    tts_engines: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Full capability snapshot for the UI: CUDA block + pycore library registry."""
    return {
        "success": True,
        "cuda": cuda_status(),
        "libraries": libraries_status(tts_engines),
        "model_tiers": [
            {"engine": key, **row}
            for key, row in TIER_TABLE.items()
        ],
    }


def capabilities_status(
    tts_engines: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Return the cached local capability registry without live engine probes."""
    return status_snapshot_cache.get(
        STATUS_SNAPSHOT_CAPABILITIES_KEY,
        lambda: _build_capabilities_status(tts_engines),
    )


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
        ("app_cache",   "App cache",    APP_CACHE_DIR,      "Decoded media / TTS / OCR cache (core_node/cache)"),
        ("app_config",  "App config",   APP_CONFIG_DIR,     "Headless service configuration (core_node/config)"),
        ("app_data",    "App data",     APP_DATA_DIR,       "Unified user-data store (core_node/data)"),
        ("app_logs",    "App logs",     APP_LOGS_DIR,       "Service logs (core_node/logs)"),
        ("ui_state",    "UI state",     UI_STATE_CACHE_DIR, "Desktop UI state cache (core_node/ui_state)"),
        ("system_cache","System cache", SYSTEM_CACHE_DIR,   "Root runtime data directory (core_node)"),
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
        {"key": "ocr_engine_priority", "value": " → ".join(OCR_ENGINE_PRIORITY + ("ai-vision",)),
         "note": "OCR engine fallback order for the screenshot pipeline"},
        {"key": "model_tiers", "value": " | ".join(tier_summary_lines()),
         "note": "GPU/CPU max model tiers (pycore/tts_install_assets/tts_model_tiers.py)"},
        {"key": "ai_dispatch_order", "value": " → ".join(DISPATCH_TIER_ORDER),
         "note": "Unified AI gateway smart-dispatch tier order"},
        {"key": "rpc_port", "value": str(PYCORE_HTTP_PORT),
         "note": "Default pycore backend (RPC / HTTP API) port"},
        {"key": "ui_port", "value": "13054",
         "note": "Default dashboard UI dev-server port (PySide6 webview target)"},
        {"key": "screenshot_interval", "value": "60s",
         "note": "Default auto-subtitle screenshot capture interval"},
        {"key": "tts_retry_attempts", "value": "3",
         "note": "edge-tts synth retry attempts with backoff before giving up"},
        {"key": "app_root", "value": str(SYSTEM_CACHE_DIR),
         "note": "Root of all pycore runtime directories (core_node)"},
    ]


def _build_system_info() -> Dict[str, Any]:
    """Read-only constants + static directories for the Settings / Status UI."""
    return {
        "success": True,
        "constants": pycore_constants(),
        "directories": static_directories(),
    }


def system_info(refresh: bool = False) -> Dict[str, Any]:
    """Return the cached read-only system information snapshot."""
    return status_snapshot_cache.get(
        STATUS_SNAPSHOT_SYSTEM_INFO_KEY,
        _build_system_info,
        refresh=refresh,
    )


__all__ = [
    "capabilities_status", "cuda_status", "libraries_status",
    "system_info", "pycore_constants", "static_directories", "resolve_static_dir",
]
