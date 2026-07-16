# -*- coding: utf-8 -*-
"""
Compute capabilities kernel (pybasecommon).

Single source of truth for hardware/runtime compute capability across the
project. Merged from the former cuda_detector / cpu_gpu_packages /
onnx_runtime_capability / cuda_initializer modules so the whole CUDA+ONNX
concern lives in ONE stdlib-only kernel file that the upper layers
(third_party, OCR, etc.) depend on without sideways pyfoundations imports.

Contents:
- CUDADetector      - CUDA presence detection (nvidia-smi / env vars), no third-party deps
- CPU/GPU packages  - single source of truth for onnxruntime / cnocr / paddle install names
- ONNX capability   - distinguish "system has GPU" from "ONNX Runtime can use CUDA"
- CudaInitializer   - single per-process CUDA init entry (callback-injected pip/log)

Refs:
- PyTorch https://pytorch.org/get-started/locally
- ORT CUDA EP https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements
- ORT TensorRT EP https://onnxruntime.ai/docs/execution-providers/TensorRT-ExecutionProvider.html#requirements
- PyPI onnxruntime-gpu [cuda,cudnn] does not include nvidia-cublas-cu12; install it explicitly.

NOTE: onnxruntime / torch / onnx are OPTIONAL third-party packages probed lazily
at the point of use (inside try/except), never required at import time. This is a
hardware-capability probe module, so those guarded local imports are intentional.
"""
from __future__ import annotations

import os
import sys
import importlib
import platform
from typing import Dict, Optional, Tuple, Callable

# Intra-pybasecommon imports (allowed: same stdlib-only kernel package).
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import exec_silent


def _get_torch():
    """Lazy torch getter — avoids circular import with third_party at module load."""
    from pycore.pyfoundations.third_party import get_third_package_torch
    return get_third_package_torch()


# ===========================================================================
# CUDA detection (no third-party packages; nvidia-smi + env vars only)
# ===========================================================================
class CUDADetector:
    """
    CUDA availability detector using only Python standard library.

    Does NOT require torch or any third-party packages.
    """

    _cached_result: Optional[bool] = None
    _cached_info: Optional[Dict[str, any]] = None

    @classmethod
    def is_cuda_available(cls) -> bool:
        """Check if CUDA is available on the system."""
        if cls._cached_result is not None:
            return cls._cached_result

        cls._cached_result = cls._detect_cuda()
        return cls._cached_result

    @classmethod
    def get_cuda_info(cls) -> Dict[str, any]:
        """Get detailed CUDA information (version, GPUs, driver version)."""
        if cls._cached_info is not None:
            return cls._cached_info

        info = {
            'available': False,
            'nvidia_smi_found': False,
            'cuda_env_vars': {},
            'driver_version': None,
            'cuda_version': None,
            'gpu_count': 0,
            'gpus': [],
        }

        # Check nvidia-smi
        nvidia_smi_info = cls._check_nvidia_smi()
        if nvidia_smi_info:
            info['available'] = True
            info['nvidia_smi_found'] = True
            info.update(nvidia_smi_info)

        # Check environment variables
        cuda_env = cls._check_cuda_env_vars()
        info['cuda_env_vars'] = cuda_env
        if cuda_env:
            info['available'] = True

        cls._cached_info = info
        return info

    @classmethod
    def _detect_cuda(cls) -> bool:
        """Internal CUDA detection logic."""
        # Method 1: Check nvidia-smi command
        if cls._check_nvidia_smi() is not None:
            return True

        # Method 2: Check CUDA environment variables
        if cls._check_cuda_env_vars():
            return True

        return False

    @classmethod
    def _check_nvidia_smi(cls) -> Optional[Dict[str, any]]:
        """Check if nvidia-smi is available and get GPU info."""
        try:
            # Try to run nvidia-smi
            result = exec_silent(['nvidia-smi', '--query-gpu=name,driver_version,memory.total', '--format=csv,noheader'], info=False)

            if result.return_code == 0 and result.stdout.strip():
                gpus = []
                for line in result.stdout.strip().split('\n'):
                    parts = [p.strip() for p in line.split(',')]
                    if len(parts) >= 3:
                        gpus.append({
                            'name': parts[0],
                            'driver_version': parts[1] if len(parts) > 1 else None,
                            'memory_total': parts[2] if len(parts) > 2 else None,
                        })

                # Get CUDA version
                cuda_version = None
                try:
                    cuda_result = exec_silent(['nvidia-smi', '--query-gpu=compute_cap', '--format=csv,noheader'], info=False)
                    if cuda_result.return_code == 0:
                        cuda_version = cuda_result.stdout.strip().split('\n')[0] if cuda_result.stdout else None
                except Exception:
                    pass

                return {
                    'gpus': gpus,
                    'gpu_count': len(gpus),
                    'driver_version': gpus[0]['driver_version'] if gpus else None,
                    'cuda_version': cuda_version,
                }
        except Exception:
            # Error running nvidia-smi
            pass

        return None

    @classmethod
    def _check_cuda_env_vars(cls) -> Dict[str, str]:
        """Check CUDA-related environment variables."""
        cuda_env_vars = {}

        # Common CUDA environment variables
        env_var_names = [
            'CUDA_PATH',
            'CUDA_HOME',
            'CUDA_ROOT',
            'CUDA_VISIBLE_DEVICES',
            'NVIDIA_VISIBLE_DEVICES',
        ]

        for var_name in env_var_names:
            var_value = os.environ.get(var_name)
            if var_value:
                cuda_env_vars[var_name] = var_value

        return cuda_env_vars

    @classmethod
    def reset_cache(cls):
        """Reset cached detection results (use if CUDA state might have changed)."""
        cls._cached_result = None
        cls._cached_info = None

    @classmethod
    def print_cuda_info(cls):
        """Print CUDA information to console (for debugging)."""
        info = cls.get_cuda_info()

        print("=== CUDA Detection Results ===")
        print(f"CUDA Available: {info['available']}")
        print(f"nvidia-smi Found: {info['nvidia_smi_found']}")

        if info['driver_version']:
            print(f"Driver Version: {info['driver_version']}")

        if info['cuda_version']:
            print(f"CUDA Version: {info['cuda_version']}")

        print(f"GPU Count: {info['gpu_count']}")

        if info['gpus']:
            print("\nGPUs:")
            for i, gpu in enumerate(info['gpus'], 1):
                print(f"  {i}. {gpu['name']}")
                if gpu.get('memory_total'):
                    print(f"     Memory: {gpu['memory_total']}")

        if info['cuda_env_vars']:
            print("\nCUDA Environment Variables:")
            for key, value in info['cuda_env_vars'].items():
                print(f"  {key}: {value}")

        print("=" * 30)


def is_cuda_available() -> bool:
    """Check if CUDA is available."""
    return CUDADetector.is_cuda_available()


def get_cuda_info() -> Dict[str, any]:
    """Get CUDA information."""
    return CUDADetector.get_cuda_info()


# ===========================================================================
# CPU vs GPU package names (single source of truth for install/choice logic)
# ===========================================================================
# Decision: CUDADetector.is_cuda_available() (nvidia-smi or CUDA env).

# ONNX Runtime (mutually exclusive: onnxruntime vs onnxruntime-gpu)
ORT_CPU_PKG = "onnxruntime"
ORT_GPU_PKG = "onnxruntime-gpu"


def get_ort_install_package() -> str:
    """
    Package to install for ORT: CPU-only or GPU with CUDA 12 extras.
    Used by ONNX switch and ensure_onnx_cuda_usable; nvidia-cublas-cu12 is installed separately.
    """
    if CUDADetector.is_cuda_available():
        return "onnxruntime-gpu[cuda,cudnn]"
    return ORT_CPU_PKG


# CnOCR (pip extra: ort-cpu vs ort-gpu)
CNOCR_PIP_CPU = "cnocr[ort-cpu]"
CNOCR_PIP_GPU = "cnocr[ort-gpu]"


def get_cnocr_pip_package() -> str:
    """Package to install for CnOCR: cnocr[ort-cpu] or cnocr[ort-gpu]."""
    if CUDADetector.is_cuda_available():
        return CNOCR_PIP_GPU
    return CNOCR_PIP_CPU


def get_paddle_install_package() -> str:
    """
    Package to install for PaddlePaddle. Currently CPU-only in project install paths.
    For GPU, PaddlePaddle provides separate index/wheels; extend here when needed.
    """
    return "paddlepaddle"  # CPU; GPU would be paddlepaddle-gpu + index


# ===========================================================================
# ONNX Runtime capability: "system has GPU" vs "ONNX Runtime can use CUDA"
# ===========================================================================
_ORT_CUDA_USABLE: Optional[bool] = None


def _get_torch_cuda_major() -> Optional[int]:
    """Return PyTorch CUDA major version (11 or 12) or None if not available / no CUDA.
    Checks torch.version.cuda first; fallback to torch.__version__ for wheel tags like +cu118, +cu121.
    """
    try:
        torch = _get_torch()
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
        if getattr(ort, "preload_dlls", None) is not None:
            if torch_major == 11:
                # PyPI onnxruntime-gpu is CUDA 12; PyTorch has CUDA 11 DLLs. Load only from nvidia site-packages.
                ort.preload_dlls(directory="")
            else:
                ort.preload_dlls()
    except Exception:
        pass
    try:
        _get_torch()
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
        pass
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
    Install required base libraries for ORT GPU (CUDA 12): ORT package (from the
    CPU/GPU package helpers above), nvidia-cublas-cu12 (cublasLt64_12.dll). TensorRT
    EP (tensorrt-cu12) is not auto-installed to avoid long/hanging installs; use CUDA
    EP only, or install tensorrt-cu12 manually if needed.
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
            torch = _get_torch()
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


# ===========================================================================
# CUDA initialization: single per-process entry for GPU detection + ORT readiness
# ===========================================================================
ORT_CUDA_REQUIREMENTS_URL = "https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements"


class CudaInitializer:
    """
    Single entry for CUDA init: print system GPU info, then ensure ONNX Runtime can use CUDA
    (preload_dlls, import torch, pip install onnxruntime-gpu[cuda,cudnn] + nvidia-cublas-cu12).
    Run once per process (guarded). Caller injects print_cuda_prompt, run_pip_install, log.

    Whole project has only this one CUDA init. Used as predecessor to OCR init
    (init_third_party_cnocr calls CudaInitializer.run() then OcrInitializer.run()).
    """

    def __init__(
        self,
        *,
        print_cuda_prompt: Callable[[], None],
        run_pip_install: Optional[Callable[[str], None]] = None,
        log: Optional[Callable[[str], None]] = None,
        run_ort_version_switch: Optional[Callable[[], None]] = None,
        is_pip_package_installed: Optional[Callable[[str], bool]] = None,
    ):
        self._print_cuda_prompt = print_cuda_prompt
        self._run_pip_install = run_pip_install
        self._log = log if log is not None else lambda _: None
        self._run_ort_version_switch = run_ort_version_switch
        self._is_pip_package_installed = is_pip_package_installed
        self._done = False

    def is_system_gpu(self) -> bool:
        """Whether system has NVIDIA GPU (nvidia-smi or CUDA env)."""
        return CUDADetector.is_cuda_available()

    def is_ort_cuda_usable(self) -> bool:
        """Whether ONNX Runtime can create CUDA session (after ensure_onnx_cuda_usable)."""
        return is_onnx_cuda_usable()

    def run(self) -> None:
        """
        Run full CUDA init once: print system GPU info -> if system has GPU, ensure_onnx_cuda_usable();
        then print device line and yellow prompt if ORT CUDA still not usable.
        """
        if self._done:
            return
        self._done = True
        self._print_cuda_prompt()
        # Align ORT with PyTorch CUDA version (e.g. install ORT from CUDA 11 feed when PyTorch is cu11) before ensure.
        if self._run_ort_version_switch is not None:
            self._run_ort_version_switch()
        system_gpu = self.is_system_gpu()
        if system_gpu:
            ensure_onnx_cuda_usable(
                run_pip_install=self._run_pip_install,
                log=self._log,
                is_pip_package_installed=self._is_pip_package_installed,
            )
        ort_gpu = self.is_ort_cuda_usable()
        if system_gpu and not ort_gpu:
            ColorPrint.yellow(
                "[HF] ORT CUDA not usable (e.g. cublasLt64_12.dll missing). "
                "For OCR on CUDA 12 run: pip install onnxruntime-gpu[cuda,cudnn] nvidia-cublas-cu12 . See %s"
                % ORT_CUDA_REQUIREMENTS_URL
            )
        ColorPrint.blue(
            "[HF] Download/inference device: is_onnx_cuda_usable()=%s -> %s"
            % (ort_gpu, "GPU (v5_server/ort-gpu)" if ort_gpu else "CPU (v5/ort-cpu)")
        )


if __name__ == '__main__':
    CUDADetector.print_cuda_info()
