# -*- coding: utf-8 -*-
"""
Hugging Face Hub and cnocr package getters.

Model weights are installed only by the shell prerequisite scripts; this module
never downloads them.
"""

import importlib
import importlib.util

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector, get_cnocr_pip_package

from pycore.pyfoundations.third_party._package_cache import _PACKAGE_CACHE
from pycore.pyfoundations.third_party._deps import DEPENDENCY_MAP
from pycore.pyfoundations.third_party._pip_runner import build_pip_install_command, run_pip_install_with_realtime_output


def get_third_package_huggingface_hub():
    """
    Get huggingface_hub package (lazy load; pip self-install fallback).
    Returns None if still unavailable after install attempt.
    """
    if 'huggingface_hub' not in _PACKAGE_CACHE:
        try:
            _PACKAGE_CACHE['huggingface_hub'] = importlib.import_module(
                "huggingface_hub"
            )
        except (ImportError, ModuleNotFoundError):
            pip_package = DEPENDENCY_MAP.get('huggingface_hub', 'huggingface_hub')
            ColorPrint.yellow(f"[INSTALL] Package 'huggingface_hub' not found. Installing '{pip_package}' ...")
            pip_cmd = build_pip_install_command(pip_package)
            run_pip_install_with_realtime_output(pip_cmd, pip_package)
            importlib.invalidate_caches()
            try:
                _PACKAGE_CACHE['huggingface_hub'] = importlib.import_module(
                    "huggingface_hub"
                )
            except (ImportError, ModuleNotFoundError) as exc:
                ColorPrint.red(f"[INSTALL] huggingface_hub still not importable after installing '{pip_package}': {exc}")
                _PACKAGE_CACHE['huggingface_hub'] = None
    return _PACKAGE_CACHE.get('huggingface_hub')


def _print_cnocr_init_info(cnocr_module):
    """Print GPU support and loaded versions at cnocr init (official: PyPI cnocr, ort-cpu/ort-gpu)."""
    gpu_available = CUDADetector.is_cuda_available()
    cnocr_ver = getattr(cnocr_module, '__version__', 'unknown')
    onnx_ver = 'N/A'
    if importlib.util.find_spec("onnxruntime") is not None:
        onnxruntime_module = importlib.import_module("onnxruntime")
        onnx_ver = getattr(onnxruntime_module, '__version__', 'unknown')
    ColorPrint.blue(
        f"[CnOCR] GPU: {'yes' if gpu_available else 'no'} | cnocr: {cnocr_ver} | onnxruntime: {onnx_ver}"
    )


def get_third_package_cnocr():
    """
    Get cnocr package (lazy load). Official: https://cnocr.readthedocs.io/zh-cn/stable/install/
    GPU: pip install cnocr[ort-gpu], CPU: pip install cnocr[ort-cpu].
    When installing: uses get_cnocr_pip_package() and preserves installed distributions.
    Returns None if still unavailable after install attempt. On first load prints GPU support and versions.
    """
    if 'cnocr' not in _PACKAGE_CACHE:
        try:
            cnocr_module = importlib.import_module("cnocr")
            _PACKAGE_CACHE['cnocr'] = cnocr_module
            _print_cnocr_init_info(cnocr_module)
        except (ImportError, ModuleNotFoundError):
            pip_package = get_cnocr_pip_package()
            if pip_package:
                ColorPrint.yellow(f"[INSTALL] Package 'cnocr' not found. Installing '{pip_package}'...")
                pip_cmd = build_pip_install_command(pip_package)
                run_pip_install_with_realtime_output(pip_cmd, pip_package)
                importlib.invalidate_caches()
                try:
                    cnocr_module = importlib.import_module("cnocr")
                    _PACKAGE_CACHE['cnocr'] = cnocr_module
                    _print_cnocr_init_info(cnocr_module)
                except (ImportError, ModuleNotFoundError) as exc:
                    ColorPrint.red(f"[INSTALL] cnocr still not importable after installing '{pip_package}': {exc}")
                    _PACKAGE_CACHE['cnocr'] = None
            else:
                _PACKAGE_CACHE['cnocr'] = None
    return _PACKAGE_CACHE['cnocr']
