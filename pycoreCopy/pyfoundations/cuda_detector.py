#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CUDA Detection Utility

Detects CUDA availability without requiring any third-party packages.
Uses only Python standard library for maximum compatibility.

Detection methods:
1. nvidia-smi command availability
2. CUDA environment variables (CUDA_PATH, CUDA_HOME)
3. NVIDIA driver detection
"""

import os
import platform
from typing import Dict, Optional, Tuple
from pycore.pyfoundations.pybasecommon import exec_silent


class CUDADetector:
    """
    CUDA availability detector using only Python standard library

    Does NOT require torch or any third-party packages.
    """

    _cached_result: Optional[bool] = None
    _cached_info: Optional[Dict[str, any]] = None

    @classmethod
    def is_cuda_available(cls) -> bool:
        """
        Check if CUDA is available on the system

        Returns:
            bool: True if CUDA is detected, False otherwise
        """
        if cls._cached_result is not None:
            return cls._cached_result

        cls._cached_result = cls._detect_cuda()
        return cls._cached_result

    @classmethod
    def get_cuda_info(cls) -> Dict[str, any]:
        """
        Get detailed CUDA information

        Returns:
            dict: CUDA information including version, GPUs, driver version
        """
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
        """
        Internal CUDA detection logic

        Returns:
            bool: True if CUDA detected
        """
        # Method 1: Check nvidia-smi command
        if cls._check_nvidia_smi() is not None:
            return True

        # Method 2: Check CUDA environment variables
        if cls._check_cuda_env_vars():
            return True

        return False

    @classmethod
    def _check_nvidia_smi(cls) -> Optional[Dict[str, any]]:
        """
        Check if nvidia-smi is available and get GPU info

        Returns:
            dict or None: GPU information if nvidia-smi found, None otherwise
        """
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
        """
        Check CUDA-related environment variables

        Returns:
            dict: Dictionary of found CUDA environment variables
        """
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
        """
        Reset cached detection results

        Use this if CUDA state might have changed.
        """
        cls._cached_result = None
        cls._cached_info = None

    @classmethod
    def print_cuda_info(cls):
        """
        Print CUDA information to console

        For debugging purposes.
        """
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


# Convenience functions
def is_cuda_available() -> bool:
    """
    Check if CUDA is available

    Returns:
        bool: True if CUDA detected
    """
    return CUDADetector.is_cuda_available()


def get_cuda_info() -> Dict[str, any]:
    """
    Get CUDA information

    Returns:
        dict: CUDA information
    """
    return CUDADetector.get_cuda_info()


if __name__ == '__main__':
    # Test CUDA detection
    CUDADetector.print_cuda_info()
