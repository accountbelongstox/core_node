# -*- coding: utf-8 -*-
"""
Torch CUDA wheel resolution + CPU/GPU build guards.

REUSES compute_caps.CUDADetector directly (no new CUDA/ORT logic). The pip
execution layer comes from _pip_runner; the CUDA constants from _deps.

CRITICAL: this module is one directory deeper than the former third_party.py,
so Path(__file__).resolve().parents index for the repo root is 3 (was 2).
"""

import os
import sys
import importlib
import importlib.metadata
import platform
import shutil
from pathlib import Path
from typing import Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector

from ._deps import (
    PYTORCH_CUDA_INDEX_URL,
    PYTORCH_CPU_INDEX_URL,
    _PYTORCH_CUDA_WHEELS,
    _PYTORCH_CUDA_DEFAULT_TAG,
)
from ._pip_runner import (
    run_third_party_command,
    run_pip_install_with_realtime_output,
    _run_pip_uninstall,
    build_pip_install_command,
)

try:
    import torch
except ImportError:
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


def _uninstall_orphan_nvidia_wheels():
    """Reclaim disk after switching torch to CPU on a no-GPU host: pip leaves the
    nvidia-* CUDA wheels (~4.3G) behind. Uninstall every nvidia-* and triton wheel."""
    proc = run_third_party_command(
        [sys.executable, "-m", "pip", "list", "--format=freeze"],
        capture_output=True,
        timeout=30,
    )
    if proc is None or proc.returncode != 0:
        return
    names = []
    for line in (proc.stdout or "").splitlines():
        name = line.split("==", 1)[0].strip()
        low = name.lower()
        if low.startswith("nvidia-") or low == "triton":
            names.append(name)
    if names:
        run_third_party_command(
            [sys.executable, "-m", "pip", "uninstall", "-y", *names],
            "pip uninstall nvidia-* (no GPU)",
        )


def _ensure_torch_cpu_build_when_no_gpu():
    """No NVIDIA GPU, but a CUDA build of torch is installed -> it dragged in ~4.3G of
    nvidia-* wheels for nothing. Reinstall the CPU build from the CPU index and remove
    the orphaned nvidia-* wheels. No-op if torch is absent or already the CPU build.
    Override: TORCH_FORCE_CUDA=1 leaves it alone."""
    if os.environ.get("TORCH_FORCE_CUDA") == "1":
        return
    if torch is None:
        return
    if getattr(torch.version, "cuda", None) is None:
        return  # already a CPU build
    # SAFETY: never downgrade a CUDA torch that actually WORKS. nvidia-smi can be
    # missing from a sanitized PATH (false 'no GPU'); if torch itself sees the GPU
    # there IS a GPU, so keep the CUDA build instead of a destructive ~5G reinstall.
    try:
        if torch.cuda.is_available():
            ColorPrint.blue(
                "[CUDA] torch reports CUDA available; keeping the CUDA build "
                "(ignoring the nvidia-smi PATH miss)."
            )
            return
    except Exception:  # noqa: BLE001
        pass
    ColorPrint.yellow(
        "[CUDA] No GPU detected, but torch is a CUDA build (pulls ~4.3G nvidia-*). "
        "Reinstalling the CPU build and removing nvidia-* wheels."
    )
    current_platform = platform.system()
    pip_cmd = [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio",
               "--index-url", PYTORCH_CPU_INDEX_URL, "--force-reinstall"]
    if current_platform != "Windows":
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    else:
        pip_cmd.append("--no-user")
    run_pip_install_with_realtime_output(pip_cmd, "torch (CPU, no GPU)")
    _uninstall_orphan_nvidia_wheels()
    importlib.invalidate_caches()
    if "torch" in sys.modules:
        del sys.modules["torch"]


_sherpa_onnx_build_checked = False


def _ensure_sherpa_onnx_cpu_build_when_no_gpu():
    """No NVIDIA GPU but a '+cuda' build of sherpa-onnx is installed -> switch to the
    CPU wheel from PyPI. Unlike torch, the sherpa-onnx CPU wheel is the DEFAULT and
    pulls no CUDA libs; the '+cuda' build needs the system CUDA Toolkit + cuDNN and
    is useless (often un-importable) without a GPU. Mirrors the install-time
    scripts/shells/linux/common/sherpa_onnx_cpu_guard.sh. Runs at most once / process.
    No-op if sherpa-onnx is absent, already CPU, or a GPU is present.
    Override: TORCH_FORCE_CUDA=1 / SHERPA_ONNX_FORCE_CUDA=1 leaves it alone."""
    global _sherpa_onnx_build_checked
    if _sherpa_onnx_build_checked:
        return
    _sherpa_onnx_build_checked = True
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
        "reinstalling the CPU wheel."
    )
    pip_cmd = [sys.executable, "-m", "pip", "install", "sherpa-onnx", "--force-reinstall"]
    if platform.system() != "Windows":
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    else:
        pip_cmd.append("--no-user")
    run_pip_install_with_realtime_output(pip_cmd, "sherpa-onnx (CPU, no GPU)")
    importlib.invalidate_caches()
    for _mod in list(sys.modules.keys()):
        if _mod == "sherpa_onnx" or _mod.startswith("sherpa_onnx."):
            del sys.modules[_mod]


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
    """Driver-matched PyTorch CUDA wheel index. Resolution order (so the default is NEVER a
    second hardcode - it auto-syncs from the system / the shell helper):
      1. env PYTORCH_CUDA_INDEX_URL - explicit override;
      2. the shared shell resolver scripts/shells/linux/common/base_libs/cuda_index.sh
         - the SINGLE source of truth for the driver->wheel mapping AND the default, so this
         module and every *.sh installer always agree;
      3. in-process nvidia-smi parse (same mapping) only if that .sh is unreachable.
    """
    if PYTORCH_CUDA_INDEX_URL:
        return PYTORCH_CUDA_INDEX_URL
    # (2) Defer to the shell single-source-of-truth so Python + the *.sh installers can't
    # diverge (the default lives there, not here).
    # NOTE: this file lives in pycore/pyfoundations/third_party/_torch_cuda.py, so the repo
    # root is parents[3] (parents[0]=third_party, [1]=pyfoundations, [2]=pycore, [3]=root).
    try:
        helper = Path(__file__).resolve().parents[3] / "scripts/shells/linux/common/base_libs/cuda_index.sh"
        if helper.is_file():
            proc = run_third_party_command(
                ["bash", "-c", '. "$1"; torch_cuda_index_url', "_", str(helper)],
                capture_output=True, timeout=20)
            url = (getattr(proc, "stdout", "") or "").strip() if proc is not None else ""
            if url.startswith("https://download.pytorch.org/whl/"):
                return url
    except Exception:
        pass
    # (3) Fallback only when the shell helper is missing: same driver->wheel mapping.
    drv = _detect_driver_cuda_version()
    tag = _PYTORCH_CUDA_DEFAULT_TAG
    if drv is not None:
        for cmaj, cmin, wheel in _PYTORCH_CUDA_WHEELS:
            if drv >= (cmaj, cmin):
                tag = wheel
                break
    return "https://download.pytorch.org/whl/" + tag


def _ensure_torch_cuda_build_first():
    """
    Run before other package checks. Ensure torch is CUDA build only when system supports CUDA.
    System support: NVIDIA GPU + driver (nvidia-smi or CUDA env). Per PyTorch docs: is_available() for runtime.
    On a host with NO GPU, ensure torch is the CPU build (not a stray CUDA build).
    """
    _print_cuda_support_prompt()

    # No CUDA support: make sure any stray CUDA-build torch is switched to CPU.
    if not CUDADetector.is_cuda_available():
        _ensure_torch_cpu_build_when_no_gpu()
        return

    if torch is not None and getattr(torch, "cuda", None) is not None and torch.cuda.is_available():
        return
    if torch is not None:
        if getattr(torch.version, "cuda", None) is None:
            ColorPrint.blue(
                "[INFO] Ensuring PyTorch CUDA build (current is CPU-only; system has NVIDIA GPU). "
                "See https://pytorch.org/get-started/locally"
            )
        else:
            if torch.cuda.is_available():
                return
            ColorPrint.blue("[INFO] Reinstalling PyTorch CUDA build (driver/runtime may need match)...")
    else:
        ColorPrint.blue("[INFO] Installing PyTorch with CUDA first (system has NVIDIA GPU)...")
    current_platform = platform.system()
    cuda_index_url = _resolve_pytorch_cuda_index_url()
    ColorPrint.blue("[INFO] PyTorch CUDA wheel index (driver-matched): " + cuda_index_url)
    # We only reach here when torch is missing OR present-but-cuda-unavailable (CPU-only build
    # OR a CUDA build too new for the driver, e.g. cu130 on a 12.4 driver). When REPLACING an
    # existing build, uninstall the importable torch stack FIRST and always --force-reinstall:
    # otherwise --ignore-installed merely drops the driver-matched wheel BESIDE the stale one,
    # the stale build keeps shadowing it, torch.cuda.is_available() stays False, and this
    # reinstall fires again on every launch (the ~5GB re-download loop). --ignore-installed is
    # still passed for the mpmath<1.4-no-RECORD case (Debian/Kali ship mpmath 1.4.x without a
    # RECORD file, which aborts a plain reinstall of torch's deps).
    if torch is not None:
        for _pkg in ("torch", "torchvision", "torchaudio"):
            _run_pip_uninstall(_pkg)
    pip_cmd = [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio",
               "--index-url", cuda_index_url]
    if current_platform != "Windows":
        pip_cmd.extend(["--break-system-packages", "--ignore-installed"])
    else:
        pip_cmd.append("--no-user")
    if torch is not None:
        pip_cmd.append("--force-reinstall")
    run_pip_install_with_realtime_output(pip_cmd, "torch (CUDA)")
    importlib.invalidate_caches()
    if "torch" in sys.modules:
        del sys.modules["torch"]

    # Verify CUDA torch actually loads (e.g. avoid WinError 127 from torch_cuda.dll). If not, install CPU build so app runs.
    proc = run_third_party_command(
        [sys.executable, "-c", "import torch"],
        capture_output=True,
        timeout=60,
    )
    if proc is not None and proc.returncode != 0:
        err = (proc.stderr or "").strip() or (proc.stdout or "").strip()
        ColorPrint.yellow(
            "[CUDA] PyTorch CUDA build failed to load (e.g. WinError 127 / missing DLL). Installing CPU build so the app can run."
        )
        if err:
            ColorPrint.yellow("[CUDA] Error: " + err[:400])
        pip_cpu = [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio", "--force-reinstall"]
        if current_platform != "Windows":
            pip_cpu.extend(["--break-system-packages", "--ignore-installed"])
        else:
            pip_cpu.append("--no-user")
        run_pip_install_with_realtime_output(pip_cpu, "torch (CPU fallback)")
        importlib.invalidate_caches()
        if "torch" in sys.modules:
            del sys.modules["torch"]
