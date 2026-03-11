# -*- coding: utf-8 -*-
"""
CUDA initialization: single entry for system GPU detection and ORT CUDA readiness.
Runs once per process. Used as predecessor to OCR init (init_third_party_cnocr calls
CudaInitializer.run() then OcrInitializer.run()). Whole project has only this one CUDA init.

Ref: PyTorch https://pytorch.org/get-started/locally
     ORT CUDA EP https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements
"""
from __future__ import annotations

from typing import Callable, Optional

from pycore.pyfoundations.cuda_detector import CUDADetector
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.onnx_runtime_capability import ensure_onnx_cuda_usable, is_onnx_cuda_usable

ORT_CUDA_REQUIREMENTS_URL = "https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements"


class CudaInitializer:
    """
    Single entry for CUDA init: print system GPU info, then ensure ONNX Runtime can use CUDA
    (preload_dlls, import torch, pip install onnxruntime-gpu[cuda,cudnn] + nvidia-cublas-cu12).
    Run once per process (guarded). Caller injects print_cuda_prompt, run_pip_install, log.
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
