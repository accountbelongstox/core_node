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
- Stable ORT GPU dependencies are derived from the centralized supported CUDA major.

NOTE: onnxruntime / torch / onnx are OPTIONAL packages resolved through
importlib or an injected getter, so import statements remain at file scope.
"""
from __future__ import annotations

import os
import sys
import importlib
import platform
import re
import shutil
from typing import Any, Callable, Dict, Optional, Tuple

# Intra-pybasecommon imports (allowed: same stdlib-only kernel package).
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import exec_silent
from pycore.pyfoundations.ai_runtime_policy import ONNXRUNTIME_CUDA_MAJOR
from pycore.pyfoundations.serialized_worker import SerializedValue

_TORCH_GETTER_STATE = SerializedValue(
    None,
    "ComputeTorchGetterStateThread",
)


def register_compute_torch_getter(getter: Callable[[], Any]) -> None:
    """Register the third-party layer's lazy Torch getter."""
    _TORCH_GETTER_STATE.set(getter)


def _get_torch():
    """Resolve Torch through the injected upper-layer getter."""
    getter = _TORCH_GETTER_STATE.get()
    return getter() if callable(getter) else None


def _get_onnxruntime():
    """Lazy ONNX Runtime getter so package switching cannot leave a stale module."""
    try:
        return importlib.import_module("onnxruntime")
    except ImportError:
        return None


# ===========================================================================
# CUDA detection (no third-party packages; nvidia-smi + env vars only)
# ===========================================================================
class CUDADetector:
    """
    CUDA availability detector using only Python standard library.

    Does NOT require torch or any third-party packages.
    """

    _cached_result: Optional[bool] = None
    _cached_info: Optional[Dict[str, Any]] = None

    @classmethod
    def is_cuda_available(cls) -> bool:
        """Check if CUDA is available on the system."""
        if cls._cached_result is not None:
            return cls._cached_result

        cls._cached_result = cls._detect_cuda()
        return cls._cached_result

    @classmethod
    def get_cuda_info(cls) -> Dict[str, Any]:
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

        # Fallback positive signal: a working CUDA torch PROVES a GPU is present,
        # even when nvidia-smi is not resolvable (e.g. a service launched with a
        # sanitized PATH). Without this a real GPU false-negatives and the torch
        # CPU-guard destructively downgrades the CUDA build. See _torch_cuda.py.
        if not info['available'] and cls._torch_cuda_available():
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

        # Method 3: a working CUDA torch (definitive) - covers nvidia-smi PATH misses.
        if cls._torch_cuda_available():
            return True

        return False

    @classmethod
    def _nvidia_smi_cmd(cls) -> str:
        """Resolve the nvidia-smi executable. Do NOT rely on PATH alone: a service
        launched with a sanitized PATH (e.g. pyservice) may not have System32 on it,
        which false-negatives GPU detection and trips the CPU-torch guard. Falls back
        to the well-known driver install locations, then to the bare name."""
        found = shutil.which("nvidia-smi")
        if found:
            return found
        candidates = []
        if platform.system() == "Windows":
            sysroot = os.environ.get("SystemRoot") or r"C:\Windows"
            candidates.append(os.path.join(sysroot, "System32", "nvidia-smi.exe"))
            for pf_var in ("ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"):
                pf = os.environ.get(pf_var)
                if pf:
                    candidates.append(os.path.join(pf, "NVIDIA Corporation", "NVSMI", "nvidia-smi.exe"))
        else:
            candidates.extend(["/usr/bin/nvidia-smi", "/usr/local/bin/nvidia-smi", "/bin/nvidia-smi"])
        for cand in candidates:
            if cand and os.path.isfile(cand):
                return cand
        return "nvidia-smi"

    @classmethod
    def _torch_cuda_available(cls) -> bool:
        """Definitive positive GPU signal: a working CUDA torch. Used only as a
        FALLBACK when nvidia-smi is not resolvable, so a real GPU is never missed."""
        try:
            t = _get_torch()
            return bool(t is not None and getattr(t, "cuda", None) is not None
                        and t.cuda.is_available())
        except Exception:
            return False

    @classmethod
    def _check_nvidia_smi(cls) -> Optional[Dict[str, Any]]:
        """Check if nvidia-smi is available and get GPU info."""
        try:
            smi = cls._nvidia_smi_cmd()
            # Try to run nvidia-smi (resolved full path, not PATH-dependent)
            result = exec_silent([smi, '--query-gpu=name,driver_version,memory.total', '--format=csv,noheader'], info=False)

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

                # NVIDIA-SMI reports the maximum CUDA runtime supported by the active
                # driver. New Windows drivers label this field "CUDA UMD Version".
                cuda_version = None
                try:
                    cuda_result = exec_silent([smi], info=False)
                    if cuda_result.return_code == 0:
                        match = re.search(
                            r"CUDA(?:\s+UMD)?\s+Version:\s*([0-9]+(?:\.[0-9]+)?)",
                            cuda_result.stdout or "",
                            re.IGNORECASE,
                        )
                        cuda_version = match.group(1) if match else None
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


def get_cuda_info() -> Dict[str, Any]:
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
    Package to install for ORT under the one canonical CUDA-major policy.
    """
    if is_onnx_cuda_policy_compatible():
        return "onnxruntime-gpu[cuda,cudnn]"
    return ORT_CPU_PKG


# CnOCR (pip extra: ort-cpu vs ort-gpu)
CNOCR_PIP_CPU = "cnocr[ort-cpu]"
CNOCR_PIP_GPU = "cnocr[ort-gpu]"


def get_cnocr_pip_package() -> str:
    """Package to install for CnOCR: cnocr[ort-cpu] or cnocr[ort-gpu]."""
    if is_onnx_cuda_policy_compatible():
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
_ORT_CUDA_USABLE_STATE = SerializedValue(
    None,
    "ONNXRuntimeCUDAStateThread",
)


def _get_torch_cuda_major() -> Optional[int]:
    """Return the PyTorch CUDA major, including future policy-supported majors."""
    try:
        torch = _get_torch()
        cuda = getattr(torch.version, "cuda", None)
        if cuda and isinstance(cuda, str):
            major = cuda.split(".", 1)[0]
            return int(major) if major.isdigit() else None
        ver = getattr(torch, "__version__", "") or ""
        match = re.search(r"\+?cu(\d{2,3})", ver)
        if match:
            return int(match.group(1)[:-1])
        return None
    except Exception:
        return None


def is_onnx_cuda_policy_compatible() -> bool:
    """Whether stable ORT GPU matches the canonical PyTorch CUDA major."""
    return (
        CUDADetector.is_cuda_available()
        and _get_torch_cuda_major() == ONNXRUNTIME_CUDA_MAJOR
    )


def _prepare_onnx_cuda_dlls() -> None:
    """Preload the canonical PyTorch/ORT CUDA libraries before the provider probe."""
    ort_module = _get_onnxruntime()
    if ort_module is None:
        return
    try:
        if getattr(ort_module, "preload_dlls", None) is not None:
            ort_module.preload_dlls()
    except Exception:
        pass
    try:
        _get_torch()
    except Exception:
        pass


def clear_onnx_cuda_usable_cache() -> None:
    """Clear cached ORT CUDA result so next is_onnx_cuda_usable() will probe again (e.g. after preload_dlls or pip install)."""
    _ORT_CUDA_USABLE_STATE.set(None)


def _make_minimal_onnx_bytes() -> Optional[bytes]:
    """Build minimal ONNX model bytes for session test. Returns None if onnx not available."""
    try:
        onnx_module = importlib.import_module("onnx")
        helper = onnx_module.helper
        tensor_proto = onnx_module.TensorProto
        c = helper.make_tensor("c", tensor_proto.FLOAT, [1], [1.0])
        out_vi = helper.make_tensor_value_info("out", tensor_proto.FLOAT, [1])
        node = helper.make_node("Identity", ["c"], ["out"])
        graph = helper.make_graph([node], "minimal", [], [out_vi], initializer=[c])
        model = helper.make_model(graph)
        return model.SerializeToString()
    except Exception:
        return None


def _probe_ort_cuda() -> bool:
    """Actually try create CUDA session (no cache). Returns True if session runs."""
    ort_module = _get_onnxruntime()
    if ort_module is None:
        return False
    get_providers = getattr(ort_module, "get_available_providers", None)
    if get_providers is None:
        return False
    if "CUDAExecutionProvider" not in get_providers():
        return False
    model_bytes = _make_minimal_onnx_bytes()
    if not model_bytes:
        return False
    try:
        sess = ort_module.InferenceSession(
            model_bytes,
            providers=["CUDAExecutionProvider"],
            sess_options=ort_module.SessionOptions(),
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
    if not is_onnx_cuda_policy_compatible():
        _ORT_CUDA_USABLE_STATE.set(False)
        return False
    cached = _ORT_CUDA_USABLE_STATE.get()
    if cached is not None:
        return bool(cached)
    probed = _probe_ort_cuda()
    _ORT_CUDA_USABLE_STATE.set(probed)
    return probed


# Required for the stable ORT GPU CUDA EP. TensorRT is not auto-installed.
_ORT_GPU_REQUIRED = (f"nvidia-cublas-cu{ONNXRUNTIME_CUDA_MAJOR}",)


# Set when the ORT GPU dependency installer actually mutated packages.
_ORT_INSTALL_RAN_STATE = SerializedValue(
    False,
    "ONNXRuntimeInstallStateThread",
)


def last_ort_install_ran() -> bool:
    """True if this process ran ORT GPU install (did not skip); used to run dependency fix only when pip may have shown conflicts."""
    return bool(_ORT_INSTALL_RAN_STATE.get())


def _run_ensure_ort_gpu_packages(
    run_pip_install: Optional[Callable[[str], None]],
    log: Callable[[str], None],
    is_pip_package_installed: Optional[Callable[[str], bool]] = None,
) -> None:
    """
    Install the stable ORT GPU package and matching CUDA-major base libraries.
    When is_pip_package_installed is provided, skip pip install if ORT GPU and all _ORT_GPU_REQUIRED are already installed.
    """
    _ORT_INSTALL_RAN_STATE.set(False)
    if run_pip_install is None:
        return
    if is_pip_package_installed is not None:
        if is_pip_package_installed(ORT_GPU_PKG) and all(
            is_pip_package_installed(p) for p in _ORT_GPU_REQUIRED
        ):
            log("[HF] ORT GPU dependencies already satisfy the canonical CUDA policy; skipping install.")
            return
    try:
        ort_pkg = get_ort_install_package()
        log("[HF] Ensuring ORT GPU dependencies for CUDA %s: %s..." % (ONNXRUNTIME_CUDA_MAJOR, ort_pkg))
        run_pip_install(ort_pkg)
        for pkg in _ORT_GPU_REQUIRED:
            run_pip_install(pkg)
        _ORT_INSTALL_RAN_STATE.set(True)
    except Exception:
        pass


def ensure_onnx_cuda_usable(
    run_pip_install: Optional[Callable[[str], None]] = None,
    log: Optional[Callable[[str], None]] = None,
    is_pip_package_installed: Optional[Callable[[str], bool]] = None,
) -> bool:
    """
    Best-effort to make ORT CUDA usable only when its stable GPU build matches the
    one canonical CUDA major. Incompatible hosts use CPU ORT without adding another stack.
    Only then fall back to CPU. log(msg) optional for [HF] messages.
    """
    _log = log if log is not None else lambda _: None
    if not is_onnx_cuda_policy_compatible():
        _ORT_CUDA_USABLE_STATE.set(False)
        _log(
            "[HF] Stable ORT GPU requires CUDA %s but canonical torch uses CUDA %s; using CPU ORT."
            % (ONNXRUNTIME_CUDA_MAJOR, _get_torch_cuda_major() or "none")
        )
        return False

    _run_ensure_ort_gpu_packages(run_pip_install, _log, is_pip_package_installed)
    for key in list(sys.modules.keys()):
        if key == "onnxruntime" or key.startswith("onnxruntime."):
            del sys.modules[key]
    importlib.invalidate_caches()
    clear_onnx_cuda_usable_cache()

    # 1) Preload DLLs then probe (PyTorch 11: preload from nvidia site-packages only).
    _prepare_onnx_cuda_dlls()
    if is_onnx_cuda_usable():
        return True
    # 2) Explicit preload for ORT 1.21+.
    clear_onnx_cuda_usable_cache()
    try:
        ort_module = _get_onnxruntime()
        if ort_module is not None and getattr(ort_module, "preload_dlls", None) is not None:
            ort_module.preload_dlls()
            if _probe_ort_cuda():
                _ORT_CUDA_USABLE_STATE.set(True)
                _log("[HF] ORT CUDA usable after preload_dlls().")
                return True
    except Exception:
        pass
    clear_onnx_cuda_usable_cache()

    # 3) Import canonical PyTorch to preload matching CUDA/cuDNN libraries.
    try:
        _log("[HF] Trying import torch to preload CUDA/cuDNN...")
        torch = _get_torch()
        if getattr(torch, "cuda", None) is not None and torch.cuda.is_available():
            if _probe_ort_cuda():
                _ORT_CUDA_USABLE_STATE.set(True)
                _log("[HF] ORT CUDA usable after torch preload.")
                return True
    except Exception:
        pass
    clear_onnx_cuda_usable_cache()

    return is_onnx_cuda_usable()


# ===========================================================================
# CUDA initialization: single per-process entry for GPU detection + ORT readiness
# ===========================================================================
ORT_CUDA_REQUIREMENTS_URL = "https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements"


class CudaInitializer:
    """
    Single entry for CUDA init: print system GPU info, then ensure ONNX Runtime can use CUDA
    (preload_dlls, import torch, and policy-matched ORT GPU dependencies).
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
        # Align ORT with the canonical CUDA policy before probing the provider.
        if self._run_ort_version_switch is not None:
            self._run_ort_version_switch()
        system_gpu = self.is_system_gpu()
        ort_policy_compatible = is_onnx_cuda_policy_compatible()
        if ort_policy_compatible:
            ensure_onnx_cuda_usable(
                run_pip_install=self._run_pip_install,
                log=self._log,
                is_pip_package_installed=self._is_pip_package_installed,
            )
        ort_gpu = self.is_ort_cuda_usable()
        if system_gpu and not ort_policy_compatible:
            ColorPrint.blue(
                "[HF] Canonical CUDA %s has no stable ORT GPU match (required CUDA %s); OCR uses CPU ORT."
                % (_get_torch_cuda_major() or "none", ONNXRUNTIME_CUDA_MAJOR)
            )
        elif system_gpu and not ort_gpu:
            ColorPrint.yellow(
                "[HF] ORT CUDA %s is selected but unavailable. See %s"
                % (ONNXRUNTIME_CUDA_MAJOR, ORT_CUDA_REQUIREMENTS_URL)
            )
        ColorPrint.blue(
            "[HF] Download/inference device: is_onnx_cuda_usable()=%s -> %s"
            % (ort_gpu, "GPU (v5_server/ort-gpu)" if ort_gpu else "CPU (v5/ort-cpu)")
        )


if __name__ == '__main__':
    CUDADetector.print_cuda_info()
