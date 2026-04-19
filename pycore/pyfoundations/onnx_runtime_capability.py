# -*- coding: utf-8 -*-
"""
ONNX Runtime capability: distinguish "system has GPU" (nvidia-smi) from "ONNX Runtime can use CUDA".
Install required base libraries for ORT GPU (CUDA EP): onnxruntime-gpu[cuda,cudnn], nvidia-cublas-cu12.
TensorRT EP (tensorrt-cu12) is not auto-installed: pip install often hangs downloading NVIDIA binaries;
CUDA EP is sufficient for GPU inference. Install tensorrt-cu12 manually if TensorRT EP is needed.

Ref: https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements
     https://onnxruntime.ai/docs/execution-providers/TensorRT-ExecutionProvider.html#requirements
- PyPI onnxruntime-gpu [cuda,cudnn] does not include nvidia-cublas-cu12; install it explicitly.
"""
from __future__ import annotations

import importlib
import sys
from typing import Callable, Optional

from pycore.pyfoundations.cpu_gpu_packages import ORT_GPU_PKG, get_ort_install_package
from pycore.pyfoundations.cuda_detector import CUDADetector

_ORT_CUDA_USABLE: Optional[bool] = None


def _get_torch_cuda_major() -> Optional[int]:
    """Return PyTorch CUDA major version (11 or 12) or None if not available / no CUDA.
    Checks torch.version.cuda first; fallback to torch.__version__ for wheel tags like +cu118, +cu121.
    """
    try:
        import torch
        cuda = getattr(torch.version, "cuda", None)
        if cuda and isinstance(cuda, str):
            if cuda.startswith("11."):
                return 11
            if cuda.startswith("12."):
                return 12
        # Fallback: e.g. __version__ "2.7.1+cu118" or "2.0.0+cu118"
        ver = getattr(torch, "__version__", "") or ""
        if "cu118" in ver or "cu117" in ver or "cu116" in ver or "+cu11" in ver:
            return 11
        if "cu124" in ver or "cu121" in ver or "cu122" in ver or "+cu12" in ver:
            return 12
        return None
    except Exception:
        return None


def _prepare_onnx_cuda_dlls() -> None:
    """
    Load CUDA/cuDNN/cuBLAS DLLs before first ORT use to avoid "cublasLt64_12.dll missing" (Error 126).
    When PyTorch is CUDA 11.x and onnxruntime-gpu is CUDA 12 (PyPI), do NOT load from PyTorch lib (wrong DLLs).
    Use preload_dlls(directory="") to load only from nvidia site-packages (requires nvidia-cublas-cu12 etc.).
    """
    try:
        torch_major = _get_torch_cuda_major()
        import onnxruntime as ort
        if getattr(ort, "preload_dlls", None) is not None:
            if torch_major == 11:
                # PyPI onnxruntime-gpu is CUDA 12; PyTorch has CUDA 11 DLLs. Load only from nvidia site-packages.
                ort.preload_dlls(directory="")
            else:
                ort.preload_dlls()
    except Exception:
        pass
    try:
        import torch  # noqa: F401
    except Exception:
        pass


def clear_onnx_cuda_usable_cache() -> None:
    """Clear cached ORT CUDA result so next is_onnx_cuda_usable() will probe again (e.g. after preload_dlls or pip install)."""
    global _ORT_CUDA_USABLE
    _ORT_CUDA_USABLE = None


def _make_minimal_onnx_bytes() -> Optional[bytes]:
    """Build minimal ONNX model bytes for session test. Returns None if onnx not available."""
    try:
        from onnx import helper, TensorProto
        c = helper.make_tensor("c", TensorProto.FLOAT, [1], [1.0])
        out_vi = helper.make_tensor_value_info("out", TensorProto.FLOAT, [1])
        node = helper.make_node("Identity", ["c"], ["out"])
        graph = helper.make_graph([node], "minimal", [], [out_vi], initializer=[c])
        model = helper.make_model(graph)
        return model.SerializeToString()
    except Exception:
        return None


def _probe_ort_cuda() -> bool:
    """Actually try create CUDA session (no cache). Returns True if session runs."""
    try:
        import onnxruntime as ort
    except ImportError:
        return False
    get_providers = getattr(ort, "get_available_providers", None)
    if get_providers is None:
        return False
    if "CUDAExecutionProvider" not in get_providers():
        return False
    model_bytes = _make_minimal_onnx_bytes()
    if not model_bytes:
        return False
    try:
        sess = ort.InferenceSession(
            model_bytes,
            providers=["CUDAExecutionProvider"],
            sess_options=ort.SessionOptions(),
        )
        sess.run(["out"], {})
    except Exception:
        return False
    return True


def is_onnx_cuda_usable() -> bool:
    """
    Return True only if ONNX Runtime can create an inference session with CUDAExecutionProvider.
    Cached per process. When False, OCR uses context='cpu' (after ensure_onnx_cuda_usable() has been tried).
    """
    global _ORT_CUDA_USABLE
    if _ORT_CUDA_USABLE is not None:
        return _ORT_CUDA_USABLE
    _ORT_CUDA_USABLE = _probe_ort_cuda()
    return _ORT_CUDA_USABLE


# Required for ORT GPU CUDA EP. TensorRT EP (tensorrt-cu12) is optional and often slow to install
# (downloads large binaries from NVIDIA); skip auto-install to avoid blocking. See PyPI tensorrt-cu12 readme.
_ORT_GPU_REQUIRED = ("nvidia-cublas-cu12",)


# Set to True when _run_ensure_cuda12_packages actually ran pip install (did not skip). Used so dependency fix runs only when pip may have printed conflicts.
_ort_install_ran_this_run: bool = False


def last_ort_install_ran() -> bool:
    """True if this process ran ORT GPU install (did not skip); used to run dependency fix only when pip may have shown conflicts."""
    return _ort_install_ran_this_run


def _run_ensure_cuda12_packages(
    run_pip_install: Optional[Callable[[str], None]],
    log: Callable[[str], None],
    is_pip_package_installed: Optional[Callable[[str], bool]] = None,
) -> None:
    """
    Install required base libraries for ORT GPU (CUDA 12): ORT package (from cpu_gpu_packages),
    nvidia-cublas-cu12 (cublasLt64_12.dll). TensorRT EP (tensorrt-cu12) is not auto-installed
    to avoid long/hanging installs; use CUDA EP only, or install tensorrt-cu12 manually if needed.
    When is_pip_package_installed is provided, skip pip install if ORT GPU and all _ORT_GPU_REQUIRED are already installed.
    """
    global _ort_install_ran_this_run
    _ort_install_ran_this_run = False
    if run_pip_install is None:
        return
    if is_pip_package_installed is not None:
        if is_pip_package_installed(ORT_GPU_PKG) and all(
            is_pip_package_installed(p) for p in _ORT_GPU_REQUIRED
        ):
            log("[HF] ORT GPU deps already satisfied (onnxruntime-gpu + nvidia-cublas-cu12), skipping install.")
            return
    try:
        ort_pkg = get_ort_install_package()
        log("[HF] Ensuring ORT GPU deps (CUDA EP): %s + nvidia-cublas-cu12..." % ort_pkg)
        run_pip_install(ort_pkg)
        for pkg in _ORT_GPU_REQUIRED:
            run_pip_install(pkg)
        _ort_install_ran_this_run = True
    except Exception:
        pass


def ensure_onnx_cuda_usable(
    run_pip_install: Optional[Callable[[str], None]] = None,
    log: Optional[Callable[[str], None]] = None,
    is_pip_package_installed: Optional[Callable[[str], bool]] = None,
) -> bool:
    """
    Best-effort to make ORT CUDA usable when system has GPU. Runs pip install (CUDA 12 packages)
    before any import of onnxruntime so cublasLt64_12.dll is present; then preload_dlls and probe.
    When is_pip_package_installed is provided, skips install if onnxruntime-gpu and nvidia-cublas-cu12 are already installed.
    Only then fall back to CPU. log(msg) optional for [HF] messages.
    """
    global _ORT_CUDA_USABLE
    if not CUDADetector.is_cuda_available():
        return False
    _log = log if log is not None else lambda _: None

    # 0) Install CUDA 12 packages before first onnxruntime import (avoids "cublasLt64_12.dll missing" on load). Skip when already installed.
    _run_ensure_cuda12_packages(run_pip_install, _log, is_pip_package_installed)
    for key in list(sys.modules.keys()):
        if key == "onnxruntime" or key.startswith("onnxruntime."):
            del sys.modules[key]
    importlib.invalidate_caches()
    clear_onnx_cuda_usable_cache()

    # 1) Preload DLLs then probe (PyTorch 11: preload from nvidia site-packages only).
    _prepare_onnx_cuda_dlls()
    if is_onnx_cuda_usable():
        return True
    torch_major = _get_torch_cuda_major()

    # 2) preload_dlls explicitly (ORT 1.21+): when PyTorch is 11 use directory="" (nvidia only).
    clear_onnx_cuda_usable_cache()
    try:
        import onnxruntime as ort
        if getattr(ort, "preload_dlls", None) is not None:
            if torch_major == 11:
                _log("[HF] Trying onnxruntime.preload_dlls(directory='') (PyTorch CUDA 11, ORT CUDA 12)...")
                ort.preload_dlls(directory="")
            else:
                ort.preload_dlls()
            if _probe_ort_cuda():
                _ORT_CUDA_USABLE = True
                _log("[HF] ORT CUDA usable after preload_dlls().")
                return True
    except Exception:
        pass
    clear_onnx_cuda_usable_cache()

    # 3) Import PyTorch to preload DLLs. Skip when PyTorch is CUDA 11 (ORT PyPI is CUDA 12).
    if torch_major != 11:
        try:
            _log("[HF] Trying import torch to preload CUDA/cuDNN...")
            import torch
            if getattr(torch, "cuda", None) is not None and torch.cuda.is_available():
                if _probe_ort_cuda():
                    _ORT_CUDA_USABLE = True
                    _log("[HF] ORT CUDA usable after torch preload.")
                    return True
        except Exception:
            pass
    elif torch_major == 11:
        _log("[HF] PyTorch is CUDA 11.x; ORT (PyPI) is CUDA 12.x — using nvidia site-packages only.")
    clear_onnx_cuda_usable_cache()

    return is_onnx_cuda_usable()
