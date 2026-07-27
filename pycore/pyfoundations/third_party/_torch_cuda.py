# -*- coding: utf-8 -*-
import torch
"""
Torch CUDA wheel resolution + CPU/GPU build guards.

REUSES compute_caps.CUDADetector directly (no new CUDA/ORT logic). The pip
execution layer comes from _pip_runner; the CUDA constants from _deps.

CRITICAL: this module is one directory deeper than the former third_party.py,
so Path(__file__).resolve().parents index for the repo root is 3 (was 2).
"""

import os
import sys

from pycore.pyfoundations.serialized_worker import SerializedValue
import importlib.metadata
import shutil
from typing import Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.ai_runtime_policy import (
    TORCH_INDEX_BASE,
    cuda_tier_by_tag,
    cuda_tier_for_driver,
)

from ._deps import (
    PYTORCH_CUDA_INDEX_URL,
    PYTORCH_CPU_INDEX_URL,
)
from ._pip_runner import (
    _is_pip_package_installed,
    run_third_party_command,
    run_pip_install_with_realtime_output,
)

try:
except Exception:  # The installed binary may fail to load; startup must not reinstall it.
    torch = None


def _print_cuda_support_prompt():
    """
    Print whether current system supports CUDA (using CUDADetector).
    Official docs: https://pytorch.org/get-started/locally
    """
    info = CUDADetector.get_cuda_info()
    available = info.get("available", False)
    nvidia_smi_found = info.get("nvidia_smi_found", False)
    gpu_count = info.get("gpu_count", 0)
    driver_version = info.get("driver_version")
    gpus = info.get("gpus", [])
    cuda_env_vars = info.get("cuda_env_vars", {})

    ColorPrint.blue("[CUDA] Current system CUDA support check (see https://pytorch.org/get-started/locally):")
    if available:
        ColorPrint.blue("[CUDA] System supports CUDA.")
        if nvidia_smi_found:
            ColorPrint.blue(f"[CUDA] nvidia-smi: found. GPU count: {gpu_count}. Driver: {driver_version or 'N/A'}")
            for i, gpu in enumerate(gpus[:5], 1):
                name = gpu.get("name", "N/A")
                mem = gpu.get("memory_total", "")
                ColorPrint.blue(f"[CUDA]   GPU {i}: {name}" + (f" ({mem})" if mem else ""))
        if cuda_env_vars:
            ColorPrint.blue("[CUDA] CUDA env: " + " ".join(f"{k}={v}" for k, v in list(cuda_env_vars.items())[:3]))
    else:
        ColorPrint.yellow("[CUDA] System does NOT support CUDA (no nvidia-smi and no CUDA env).")
        if not nvidia_smi_found:
            ColorPrint.yellow("[CUDA] nvidia-smi not available. Install NVIDIA driver or see https://pytorch.org/get-started/locally")
        ColorPrint.yellow("[CUDA] Skipping PyTorch CUDA build; using CPU.")
    ColorPrint.blue("[CUDA] ---")


def _ensure_torch_cpu_build_when_no_gpu():
    """Preserve an installed torch distribution; install-time guards own ABI changes."""
    if os.environ.get("TORCH_FORCE_CUDA") == "1":
        return
    if torch is None:
        return
    if getattr(torch.version, "cuda", None) is None:
        return  # already a CPU build
    ColorPrint.yellow(
        "[CUDA] No GPU detected while a CUDA torch build is installed; preserving it. "
        "The installer owns explicit CPU/GPU ABI changes."
    )


_SHERPA_ONNX_BUILD_CHECKED = SerializedValue(
    False,
    "SherpaONNXBuildCheckStateThread",
)


def _ensure_sherpa_onnx_cpu_build_when_no_gpu():
    """Preserve installed sherpa-onnx; the installer owns explicit ABI changes."""
    if not _SHERPA_ONNX_BUILD_CHECKED.compare_and_set(False, True):
        return
    if os.environ.get("TORCH_FORCE_CUDA") == "1" or os.environ.get("SHERPA_ONNX_FORCE_CUDA") == "1":
        return
    try:
        version = importlib.metadata.version("sherpa-onnx")
    except Exception:
        return  # not installed
    if "+cuda" not in (version or "").lower():
        return  # already the CPU build
    if CUDADetector.is_cuda_available():
        return  # GPU present -> keep the CUDA build
    ColorPrint.yellow(
        f"[sherpa] No GPU detected, but sherpa-onnx is a CUDA build ({version}); "
        "preserving it and allowing the caller to skip the engine."
    )


def _detect_driver_cuda_version() -> Optional[Tuple[int, int]]:
    """The NVIDIA driver's MAX CUDA runtime version (major, minor) from `nvidia-smi`, or
    None. This bounds which torch CUDA wheel can actually initialize here - a wheel built for
    a newer CUDA than the driver supports trips torch.cuda.is_available()=False (the 'driver
    too old' UserWarning). nvidia-smi prints 'CUDA Version: X.Y' in its header."""
    smi = CUDADetector._nvidia_smi_cmd()
    if not (os.path.isfile(smi) or shutil.which(smi)):
        return None
    proc = run_third_party_command([smi], capture_output=True, timeout=15)
    out = (getattr(proc, "stdout", "") or "") if proc is not None else ""
    marker = "CUDA Version:"
    idx = out.find(marker)
    if idx == -1:
        return None
    try:
        frag = out[idx + len(marker):].strip().split()[0]  # e.g. "12.4"
        parts = frag.split(".")
        return (int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
    except (ValueError, IndexError):
        return None


def _resolve_pytorch_cuda_index_url() -> str:
    """Resolve the driver-matched wheel index from the central Python policy."""
    requested_driver = None
    requested_tier = None
    requested_tag = ""
    driver_cv = None
    tier = None
    if PYTORCH_CUDA_INDEX_URL:
        return PYTORCH_CUDA_INDEX_URL
    requested_tag = (os.environ.get("CORE_CUDA_TAG") or "").strip().lower()
    requested_tier = cuda_tier_by_tag(requested_tag) if requested_tag else None
    requested_driver = _detect_driver_cuda_version()
    if requested_tier is not None and requested_driver is not None:
        driver_cv = requested_driver[0] * 100 + requested_driver[1]
        if driver_cv >= requested_tier["minimum_driver_cv"]:
            return f"{TORCH_INDEX_BASE}/{requested_tier['tag']}"
    if requested_driver is not None:
        driver_cv = requested_driver[0] * 100 + requested_driver[1]
        tier = cuda_tier_for_driver(driver_cv)
    if tier is None:
        return PYTORCH_CPU_INDEX_URL
    return f"{TORCH_INDEX_BASE}/{tier['tag']}"


def _ensure_torch_cuda_build_first():
    """Install torch only when absent; never mutate an installed runtime at startup."""
    _print_cuda_support_prompt()
    cuda_available = CUDADetector.is_cuda_available()
    if torch is not None:
        if cuda_available and not torch.cuda.is_available():
            ColorPrint.yellow(
                "[CUDA] Installed torch cannot initialize CUDA; preserving it to avoid a startup reinstall loop."
            )
        elif not cuda_available:
            _ensure_torch_cpu_build_when_no_gpu()
        return
    if _is_pip_package_installed("torch"):
        ColorPrint.yellow(
            "[CUDA] torch package metadata exists but the binary cannot load; preserving it for installer repair."
        )
        return

    cuda_index_url = _resolve_pytorch_cuda_index_url() if cuda_available else PYTORCH_CPU_INDEX_URL
    ColorPrint.blue("[INFO] torch is missing; installing from " + cuda_index_url)
    pip_cmd = [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio",
               "--index-url", cuda_index_url]
    if os.name != "nt":
        pip_cmd.append("--break-system-packages")
    else:
        pip_cmd.append("--no-user")
    run_pip_install_with_realtime_output(pip_cmd, "torch")
