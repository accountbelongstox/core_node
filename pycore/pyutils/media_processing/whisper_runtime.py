# -*- coding: utf-8 -*-

"""
Whisper runtime - shared GPU detection and faster-whisper runtime resolution +
UI capability surface for the Video Extract feature.

GPU detection reuses pyfoundations' single CUDA detector
(pybasecommon.compute_caps.CUDADetector) instead of a 3rd local nvidia-smi
subprocess copy. ctranslate2 (faster-whisper's backend) is kept as the PRIMARY
probe in has_nvidia_gpu: its device count is the authoritative "can STT
actually use CUDA right now" answer. A physical GPU alone does not override the
centralized CUDA-major compatibility policy.

Pure business logic: no HTTP/FastAPI. Imports only media_processor for
FFmpeg capability reporting - no import back into the processors
package otherwise.
"""

import re
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.third_party.api import (
    get_third_package_faster_whisper,
    get_third_package_whisper,
)
from pycore.pyutils.common.model_checks import module_present
from pycore.pyutils.common.model_tiers import (
    runtime_faster_whisper_compute_type,
    runtime_faster_whisper_device,
    whisper_model,
)
from pycore.pyutils.common.whisper_models import (
    WHISPER_MODEL_CANDIDATES,
    add_nvidia_dll_dirs,
    faster_whisper_weights,
)
from pycore.pyutils.media_processing.media_processor import media_processor


def has_nvidia_gpu() -> bool:
    """Return whether faster-whisper can use the policy-matched CUDA backend."""
    add_nvidia_dll_dirs()
    try:
        return runtime_faster_whisper_device() == "cuda"
    except Exception as exc:  # noqa: BLE001 - CUDA probe boundary; unknown means no GPU
        ColorPrint.yellow(f"[VideoExtract] CUDA policy probe failed: {exc}")
        return False


def resolve_whisper_runtime(device: str, compute_type: str):
    policy_device = runtime_faster_whisper_device()
    if device == "auto" or (device == "cuda" and policy_device != "cuda"):
        device = policy_device
    if compute_type == "auto":
        compute_type = runtime_faster_whisper_compute_type(device)
    return device, compute_type


def detect_gpu_vram_mb() -> int:
    """Largest GPU memory (MiB) from pyfoundations' cached nvidia-smi probe."""
    try:
        info = CUDADetector.get_cuda_info() or {}
    except Exception as exc:  # noqa: BLE001 - nvidia-smi probe boundary; unknown means 0 MiB
        ColorPrint.yellow(f"[VideoExtract] GPU VRAM probe failed: {exc}")
        return 0
    best = 0
    for gpu in info.get("gpus") or []:
        numbers = re.findall(r"\d+", str(gpu.get("memory_total") or ""))
        if numbers:
            best = max(best, int(numbers[0]))
    return best


def pick_whisper_model(device: str, vram_mb: int) -> str:
    if device == "cuda":
        if vram_mb >= 10000:
            return "large-v3"
        if vram_mb >= 6000:
            return "turbo"
        if vram_mb >= 4000:
            return "medium"
        if vram_mb >= 2500:
            return "small"
        return "base"
    try:
        return whisper_model(False)
    except Exception as exc:  # noqa: BLE001 - tier table read; keep the medium default
        ColorPrint.yellow(f"[VideoExtract] CPU whisper tier lookup failed: {exc}")
        return "medium"


def list_installed_whisper_models() -> List[str]:
    """Candidate model names whose faster-whisper weights the installer already
    placed (the UI only offers installed models; nothing is downloaded here)."""
    return [name for name in WHISPER_MODEL_CANDIDATES if faster_whisper_weights(name) is not None]


def best_installed_model(installed: Optional[List[str]] = None) -> Optional[str]:
    """Pick the most capable installed model (rightmost in the candidate order)."""
    if installed is None:
        installed = list_installed_whisper_models()
    for name in reversed(WHISPER_MODEL_CANDIDATES):
        if name in installed:
            return name
    return None


def clamp_model_to_installed(name: str) -> str:
    """
    Keep a requested model if it's installed; otherwise fall back to the best
    installed model. Returns the name unchanged when nothing is installed (the
    load then reports the missing weights and the installer step).
    """
    installed = list_installed_whisper_models()
    if not installed or name in installed:
        return name
    fallback = best_installed_model(installed)
    if fallback and fallback != name:
        ColorPrint.yellow(
            f"[VideoExtract] model '{name}' not installed; using installed '{fallback}'.")
        return fallback
    return name


def list_supported_languages() -> List[Dict[str, str]]:
    """
    Supported transcription languages as [{code, name}], English first then the
    rest alphabetically by display name. Codes come from faster-whisper; human
    names from openai-whisper's table when available, else the code itself.
    """
    codes: List[str] = ["en"]
    if module_present("faster_whisper"):
        faster_whisper = get_third_package_faster_whisper()
        if faster_whisper is not None:
            codes = sorted(faster_whisper.tokenizer._LANGUAGE_CODES)
    names: Dict[str, str] = {}
    if module_present("whisper"):
        whisper = get_third_package_whisper()
        if whisper is not None:
            names = {key: value.title() for key, value in whisper.tokenizer.LANGUAGES.items()}
    langs = [{"code": c, "name": names.get(c, c)} for c in codes]
    langs.sort(key=lambda x: ("" if x["code"] == "en" else x["name"].lower()))
    return langs


def whisper_capabilities() -> Dict[str, Any]:
    """Aggregate UI capability info: full model catalog + installed set + languages.

    The UI shows EVERY candidate model (``all_models``) so users can see what
    exists; only those in ``installed_models`` are selectable (the rest render
    disabled). 'auto' is always selectable and resolves to the best installed
    model at run time.
    """
    installed = list_installed_whisper_models()
    return {
        "models": ["auto"] + installed,
        "all_models": list(WHISPER_MODEL_CANDIDATES),  # full catalog, ascending capability
        "installed_models": installed,
        "default_model": best_installed_model(installed) or "auto",
        "languages": list_supported_languages(),
        "default_lang": "en",
        "ffmpeg_found": media_processor.available(),
    }
