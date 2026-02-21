# -*- coding: utf-8 -*-
"""
Single source of truth for CPU vs GPU package names across the project.

All install/choice logic that depends on "system has GPU" must use this module
so that OCR, CnOCR, and (optionally) Paddle/Ultralytics stay consistent.

Decision: CUDADetector.is_cuda_available() (nvidia-smi or CUDA env).
"""
from __future__ import annotations

from pycore.pyfoundations.cuda_detector import CUDADetector

# ---------------------------------------------------------------------------
# ONNX Runtime (mutually exclusive: onnxruntime vs onnxruntime-gpu)
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# CnOCR (pip extra: ort-cpu vs ort-gpu)
# ---------------------------------------------------------------------------
CNOCR_PIP_CPU = "cnocr[ort-cpu]"
CNOCR_PIP_GPU = "cnocr[ort-gpu]"


def get_cnocr_pip_package() -> str:
    """Package to install for CnOCR: cnocr[ort-cpu] or cnocr[ort-gpu]."""
    if CUDADetector.is_cuda_available():
        return CNOCR_PIP_GPU
    return CNOCR_PIP_CPU


# ---------------------------------------------------------------------------
# PaddlePaddle (optional; currently CPU-only in this project)
# ---------------------------------------------------------------------------
def get_paddle_install_package() -> str:
    """
    Package to install for PaddlePaddle. Currently CPU-only in project install paths.
    For GPU, PaddlePaddle provides separate index/wheels; extend here when needed.
    """
    return "paddlepaddle"  # CPU; GPU would be paddlepaddle-gpu + index
