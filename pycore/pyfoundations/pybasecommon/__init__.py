#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyBaseCommon - Common base utilities for pyfoundations
"""

import importlib

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

_MODULE_MAP = {
    'ColorPrint': 'pycore.pyfoundations.pybasecommon.color_print',
    'Commander': 'pycore.pyfoundations.pybasecommon.commander',
    'CommandResult': 'pycore.pyfoundations.pybasecommon.commander',
    'commander': 'pycore.pyfoundations.pybasecommon.commander',
    'exec_realtime': 'pycore.pyfoundations.pybasecommon.commander',
    'exec_capture': 'pycore.pyfoundations.pybasecommon.commander',
    'exec_silent': 'pycore.pyfoundations.pybasecommon.commander',
    'exec_check': 'pycore.pyfoundations.pybasecommon.commander',
    'command_exists': 'pycore.pyfoundations.pybasecommon.commander',
    'get_command_output': 'pycore.pyfoundations.pybasecommon.commander',
    'run_background': 'pycore.pyfoundations.pybasecommon.commander',
    'Encyclopedia': 'pycore.pyfoundations.pybasecommon.encyclopedia',
    'ENCYCLOPEDIA': 'pycore.pyfoundations.pybasecommon.encyclopedia',
    'CUDADetector': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'is_cuda_available': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'get_cuda_info': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'ORT_CPU_PKG': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'ORT_GPU_PKG': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'CNOCR_PIP_CPU': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'CNOCR_PIP_GPU': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'get_ort_install_package': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'get_cnocr_pip_package': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'get_paddle_install_package': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'is_onnx_cuda_usable': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'is_onnx_cuda_policy_compatible': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'ensure_onnx_cuda_usable': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'clear_onnx_cuda_usable_cache': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'last_ort_install_ran': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'CudaInitializer': 'pycore.pyfoundations.pybasecommon.compute_caps',
    'ORT_CUDA_REQUIREMENTS_URL': 'pycore.pyfoundations.pybasecommon.compute_caps',
}

def __getattr__(name: str):
    if name in _MODULE_MAP:
        module_name = _MODULE_MAP[name]
        module = importlib.import_module(module_name)
        return getattr(module, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

def __dir__():
    return __all__
