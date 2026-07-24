#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyBaseCommon - Common base utilities for pyfoundations
"""

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import (
    Commander,
    CommandResult,
    commander,
    exec_realtime,
    exec_capture,
    exec_silent,
    exec_check,
    command_exists,
    get_command_output,
    run_background,
)
from pycore.pyfoundations.pybasecommon.encyclopedia import Encyclopedia, ENCYCLOPEDIA
from pycore.pyfoundations.pybasecommon.compute_caps import (
    CUDADetector,
    is_cuda_available,
    get_cuda_info,
    ORT_CPU_PKG,
    ORT_GPU_PKG,
    CNOCR_PIP_CPU,
    CNOCR_PIP_GPU,
    get_ort_install_package,
    get_cnocr_pip_package,
    get_paddle_install_package,
    is_onnx_cuda_usable,
    is_onnx_cuda_policy_compatible,
    ensure_onnx_cuda_usable,
    clear_onnx_cuda_usable_cache,
    last_ort_install_ran,
    CudaInitializer,
    ORT_CUDA_REQUIREMENTS_URL,
)

__all__ = [
    'ColorPrint',
    'Commander',
    'CommandResult',
    'commander',
    'exec_realtime',
    'exec_capture',
    'exec_silent',
    'exec_check',
    'command_exists',
    'get_command_output',
    'run_background',
    'Encyclopedia',
    'ENCYCLOPEDIA',
    'CUDADetector',
    'is_cuda_available',
    'get_cuda_info',
    'ORT_CPU_PKG',
    'ORT_GPU_PKG',
    'CNOCR_PIP_CPU',
    'CNOCR_PIP_GPU',
    'get_ort_install_package',
    'get_cnocr_pip_package',
    'get_paddle_install_package',
    'is_onnx_cuda_usable',
    'is_onnx_cuda_policy_compatible',
    'ensure_onnx_cuda_usable',
    'clear_onnx_cuda_usable_cache',
    'last_ort_install_ran',
    'CudaInitializer',
    'ORT_CUDA_REQUIREMENTS_URL',
]
