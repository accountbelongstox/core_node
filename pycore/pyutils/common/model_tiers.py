# -*- coding: utf-8 -*-
from pycore.pyfoundations.third_party.api import get_third_package_torch
"""
Runtime bridge to pycore/tts_install_assets/tts_model_tiers.py.

Install scripts resolve GPU/CPU model tiers at install time; orchestrators call
these helpers at run time (env override > user_data > CUDA tier default).
"""

import importlib.util
import os
from pathlib import Path
from typing import Optional

from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.runtime_abi import CTRANSLATE2_CUDA_MAJOR
from pycore.pyfoundations.system_paths import get_user_data_store

try:
    import ctranslate2
except ImportError:
    ctranslate2 = None

_TIERS_PATH = Path(__file__).resolve().parents[2] / "tts_install_assets" / "tts_model_tiers.py"
_spec = importlib.util.spec_from_file_location("pycore_tts_model_tiers", _TIERS_PATH)
_tiers = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_tiers)

TIER_TABLE = _tiers.TIER_TABLE
engine_model = _tiers.engine_model
tier_summary_lines = _tiers.tier_summary_lines
whisper_model = _tiers.whisper_model
faster_whisper_model = _tiers.faster_whisper_model
kokoro_model_name = _tiers.kokoro_model_name
gptsovits_hf_allow = _tiers.gptsovits_hf_allow
cosyvoice_model_dir = _tiers.cosyvoice_model_dir
voxcpm2_model = _tiers.voxcpm2_model
fishspeech_checkpoint = _tiers.fishspeech_checkpoint
bark_model = _tiers.bark_model
parler_model = _tiers.parler_model
qwen3tts_model = _tiers.qwen3tts_model

_STT_SECTION = "stt"


def gpu_present() -> bool:
    try:
        return bool(CUDADetector.is_cuda_available())
    except Exception:
        return False


def _runtime_torch_cuda_major() -> Optional[int]:
    try:

        torch = get_third_package_torch()
        version = str(getattr(getattr(torch, "version", None), "cuda", "") or "")
        major = version.split(".", 1)[0]
        return int(major) if major.isdigit() else None
    except Exception:
        return None


def _faster_whisper_gpu_usable() -> bool:
    if not gpu_present() or _runtime_torch_cuda_major() != CTRANSLATE2_CUDA_MAJOR:
        return False
    try:
        return bool(ctranslate2 is not None and ctranslate2.get_cuda_device_count() > 0)
    except Exception:
        return False


def _persisted(section: str, key: str) -> Optional[str]:
    try:
        raw = (get_user_data_store().get_section(section) or {}).get(key)
        text = str(raw).strip() if raw is not None else ""
        return text or None
    except Exception:
        return None


def persist_stt_models(
    whisper: Optional[str] = None,
    faster_whisper: Optional[str] = None,
) -> None:
    """Persist install-time STT model picks (best-effort)."""
    try:
        store = get_user_data_store()
        section = dict(store.get_section(_STT_SECTION) or {})
        if whisper:
            section["whisper_model"] = whisper
        if faster_whisper:
            section["faster_whisper_model"] = faster_whisper
        if section:
            store.set_section(_STT_SECTION, section)
    except Exception:
        pass


def runtime_whisper_model() -> str:
    env = (os.environ.get("WHISPER_MODEL") or "").strip()
    if env:
        return env
    saved = _persisted(_STT_SECTION, "whisper_model")
    if saved:
        return saved
    return whisper_model(gpu_present())


def runtime_faster_whisper_model() -> str:
    env = (os.environ.get("FASTER_WHISPER_MODEL") or "").strip()
    if env:
        return env
    saved = _persisted(_STT_SECTION, "faster_whisper_model")
    if saved:
        return saved
    return faster_whisper_model(_faster_whisper_gpu_usable())


def runtime_faster_whisper_device() -> str:
    return "cuda" if _faster_whisper_gpu_usable() else "cpu"


def runtime_faster_whisper_compute_type(device: Optional[str] = None) -> str:
    dev = device or runtime_faster_whisper_device()
    return "float16" if dev == "cuda" else "int8"


def runtime_engine_model(engine: str) -> str:
    """Model/checkpoint id for a TTS/STT engine at the current GPU tier."""
    return engine_model(engine, gpu_present())


__all__ = [
    "TIER_TABLE",
    "engine_model",
    "tier_summary_lines",
    "whisper_model",
    "faster_whisper_model",
    "kokoro_model_name",
    "gptsovits_hf_allow",
    "cosyvoice_model_dir",
    "voxcpm2_model",
    "fishspeech_checkpoint",
    "bark_model",
    "parler_model",
    "qwen3tts_model",
    "gpu_present",
    "persist_stt_models",
    "runtime_whisper_model",
    "runtime_faster_whisper_model",
    "runtime_faster_whisper_device",
    "runtime_faster_whisper_compute_type",
    "runtime_engine_model",
]
