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

import importlib.util as u
import os
import re
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyutils.common.model_tiers import (
    runtime_faster_whisper_compute_type,
    runtime_faster_whisper_device,
    whisper_model,
)
from pycore.pyutils.media_processing.media_processor import media_processor

try:
    from faster_whisper.tokenizer import _LANGUAGE_CODES
    from faster_whisper.utils import _MODELS
except ImportError:
    _LANGUAGE_CODES = {"en"}
    _MODELS = {}
try:
    from huggingface_hub import scan_cache_dir
except ImportError:
    scan_cache_dir = None
try:
    from whisper.tokenizer import LANGUAGES
except ImportError:
    LANGUAGES = {}

# --------------------------------------------------------------------------- #
# whisper runtime helpers (GPU detection / model auto-pick) - shared           #
# --------------------------------------------------------------------------- #
def has_nvidia_gpu() -> bool:
    """Return whether faster-whisper can use the policy-matched CUDA backend."""
    _add_nvidia_dll_dirs()
    try:
        return runtime_faster_whisper_device() == "cuda"
    except Exception:
        return False


def resolve_whisper_runtime(device: str, compute_type: str):
    policy_device = runtime_faster_whisper_device()
    if device == "auto" or (device == "cuda" and policy_device != "cuda"):
        device = policy_device
    if compute_type == "auto":
        compute_type = runtime_faster_whisper_compute_type(device)
    return device, compute_type


def detect_gpu_vram_mb() -> int:
    # VRAM via pyfoundations' cached nvidia-smi probe (no local subprocess copy).
    # get_cuda_info() returns gpus[].memory_total as a string like "8188 MiB".
    try:
        info = CUDADetector.get_cuda_info() or {}
    except Exception:
        return 0
    best = 0
    for g in info.get("gpus") or []:
        nums = re.findall(r"\d+", str(g.get("memory_total") or ""))
        if nums:
            best = max(best, int(nums[0]))
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
    except Exception:
        return "medium"


# Whisper model sizes the UI offers, in ascending capability order. Only the ones
# actually downloaded on this backend are selectable (see list_installed_whisper_models).
WHISPER_MODEL_CANDIDATES = ("tiny", "base", "small", "medium", "large-v3", "turbo")


def _fw_model_repos() -> Dict[str, str]:
    """Map candidate model name -> HuggingFace repo id (from faster-whisper)."""
    repos: Dict[str, str] = {}
    try:
        for name in WHISPER_MODEL_CANDIDATES:
            if name in _MODELS:
                repos[name] = _MODELS[name]
    except Exception:
        pass
    return repos


def list_installed_whisper_models() -> List[str]:
    """
    Return the candidate model names whose weights are already downloaded in the
    local HuggingFace cache (so the UI only offers installed models). Empty list
    if the cache can't be read.
    """
    repos = _fw_model_repos()
    if not repos:
        return []
    try:
            cached = {r.repo_id for r in scan_cache_dir().repos} if scan_cache_dir else set()
    except Exception:
        return []
    return [name for name in WHISPER_MODEL_CANDIDATES
            if repos.get(name) and repos[name] in cached]


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
    installed model so 'auto' (or an API caller) never silently triggers a
    multi-GB download the user didn't choose. Returns the name unchanged when the
    installed set is unknown/empty.
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
    codes: List[str] = []
    try:
        codes = sorted(_LANGUAGE_CODES)
    except Exception:
        codes = ["en"]
    names: Dict[str, str] = {}
    try:
        names = {k: v.title() for k, v in LANGUAGES.items()}
    except Exception:
        names = {}
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
    # Kept for back-compat (older UI used this as the selectable set).
    models = ["auto"] + installed
    return {
        "models": models,
        "all_models": list(WHISPER_MODEL_CANDIDATES),  # full catalog, ascending capability
        "installed_models": installed,
        "default_model": best_installed_model(installed) or "auto",
        "languages": list_supported_languages(),
        "default_lang": "en",
        "ffmpeg_found": media_processor.available(),
    }


def _add_nvidia_dll_dirs():
    """Make pip-installed cuBLAS/cuDNN DLLs discoverable for CTranslate2 (Windows)."""
    if os.name != "nt":
        return
    try:
        for mod in ("nvidia.cublas", "nvidia.cudnn"):
            spec = u.find_spec(mod)
            if spec and spec.submodule_search_locations:
                bin_dir = os.path.join(list(spec.submodule_search_locations)[0], "bin")
                if os.path.isdir(bin_dir):
                    os.add_dll_directory(bin_dir)
    except Exception:
        pass
