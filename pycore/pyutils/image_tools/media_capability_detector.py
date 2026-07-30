#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Media Capability Detector

GPU + FFmpeg/nvenc capability detection for the media compressor, plus the
ENCYCLOPEDIA capability cache (single cache for the whole compressor) and
optimal-worker calculation.

REUSE-FIRST: GPU detection reuses compute_caps.CUDADetector (the project-wide
CUDA detection kernel) as the canonical nvidia-smi fallback instead of a
private subprocess probe. PyTorch (via the third_party lazy accessor) and
OpenCV CUDA are still probed first because they yield the most accurate device
name + memory. FFmpeg probes keep commander.exec_silent.
"""
import subprocess
from typing import Optional, Dict

from pycore.pyfoundations.pybasecommon.commander import exec_silent
from pycore.pyfoundations.pybasecommon.compute_caps import CUDADetector
from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_cv2, get_third_package_torch

import os


cv2 = get_third_package_cv2()


class MediaCapabilityDetector:
    """
    Detect GPU (PyTorch / OpenCV / nvidia-smi via CUDADetector) and FFmpeg/nvenc
    codec support, caching the result in ENCYCLOPEDIA so repeated compressor
    instantiations skip the (expensive) probe.

    Attributes populated after detection:
        cuda_available, gpu_device_count, gpu_name, gpu_memory_gb,
        ffmpeg_available, ffmpeg_cuda_support
    """

    def __init__(self, verbose: bool = True):
        """
        Initialize capability detector and populate capability attributes.

        Args:
            verbose: Whether to print detailed detection information
        """
        self.verbose = verbose
        self.cuda_available = False
        self.gpu_device_count = 0
        self.gpu_name = None
        self.gpu_memory_gb = None
        self.ffmpeg_available = False
        self.ffmpeg_cuda_support = False

        # Check cache first
        cached_info = ENCYCLOPEDIA.get("media_compressor_info")
        if cached_info is not None:
            self._load_from_cache(cached_info)
        else:
            # Perform detection
            self._detect_capabilities()
            # Cache the results
            self._save_to_cache()

    def _print(self, *args, **kwargs):
        """Print if verbose mode enabled"""
        if self.verbose:
            ColorPrint.plain(*args, **kwargs)

    def _load_from_cache(self, cached: Dict):
        """Load state from ENCYCLOPEDIA cache"""
        self.cuda_available = cached.get('cuda_available', False)
        self.gpu_device_count = cached.get('device_count', 0)
        self.gpu_name = cached.get('device_name')
        self.gpu_memory_gb = cached.get('device_memory')
        self.ffmpeg_available = cached.get('ffmpeg_available', False)
        self.ffmpeg_cuda_support = cached.get('ffmpeg_cuda_support', False)

    def _save_to_cache(self):
        """Save state to ENCYCLOPEDIA cache"""
        ENCYCLOPEDIA.add("media_compressor_info", {
            'cuda_available': self.cuda_available,
            'device_count': self.gpu_device_count,
            'device_name': self.gpu_name,
            'device_memory': self.gpu_memory_gb,
            'ffmpeg_available': self.ffmpeg_available,
            'ffmpeg_cuda_support': self.ffmpeg_cuda_support
        })

    def _detect_capabilities(self):
        """Detect GPU and software capabilities"""
        self._print("\n" + "=" * 80)
        self._print("[MEDIA COMPRESSOR] Detecting GPU and Codec Support")
        self._print("=" * 80)

        # Detect GPU via multiple methods
        self._detect_gpu()

        # Detect FFmpeg and codec support
        self._detect_ffmpeg()

        # Print summary
        self._print_capabilities_summary()

    def _detect_gpu(self):
        """Detect GPU availability via PyTorch, OpenCV and CUDADetector (nvidia-smi)"""
        # 1) Try PyTorch first (most accurate device name + memory).
        #    get_third_package_torch() returns None when torch is not installed,
        #    so the guard below replaces the former unguarded torch reference
        #    (which raised NameError because torch was never imported).
        torch = get_third_package_torch()
        if torch is not None:
            try:
                if torch.cuda.is_available():
                    self.cuda_available = True
                    self.gpu_device_count = torch.cuda.device_count()
                    self.gpu_name = torch.cuda.get_device_name(0)
                    self.gpu_memory_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                    self._print(f"✅ PyTorch CUDA detected: {self.gpu_name}")
                    self._print(f"   Memory: {self.gpu_memory_gb:.2f} GB")
            except Exception:
                pass

        # 2) Try OpenCV CUDA
        try:
            device_count = cv2.cuda.getCudaEnabledDeviceCount()
            if device_count > 0:
                self.cuda_available = True
                self.gpu_device_count = device_count
                try:
                    info = cv2.cuda.DeviceInfo(0)
                    if not self.gpu_name:
                        self.gpu_name = info.name()
                        self.gpu_memory_gb = info.totalMemory() / (1024**3)
                    self._print(f"✅ OpenCV CUDA detected: {device_count} device(s)")
                except Exception:
                    pass
        except AttributeError:
            if not self.cuda_available:
                self._print("ℹ️  OpenCV CUDA not available")

        # 3) CUDADetector fallback (replaces the former manual nvidia-smi
        #    subprocess probe). Reuses the project-wide CUDA detection kernel so
        #    there is one source of truth for nvidia-smi parsing.
        if not self.cuda_available:
            info = CUDADetector.get_cuda_info()
            gpus = info.get('gpus') or []
            if gpus:
                self.cuda_available = True
                self.gpu_device_count = info.get('gpu_count') or len(gpus)
                first = gpus[0]
                if not self.gpu_name:
                    self.gpu_name = first.get('name')
                if self.gpu_memory_gb is None:
                    self.gpu_memory_gb = self._parse_gpu_memory_gb(first.get('memory_total'))
                self._print(f"✅ NVIDIA GPU detected via CUDADetector: {self.gpu_name}")

        if not self.cuda_available:
            self._print("⚠️  No CUDA-capable GPU detected, will use CPU")

    @staticmethod
    def _parse_gpu_memory_gb(memory_str) -> Optional[float]:
        """Parse an nvidia-smi memory string (e.g. '8192 MiB') to GB, or None."""
        if not memory_str:
            return None
        try:
            return int(str(memory_str).split()[0]) / 1024.0
        except (ValueError, IndexError):
            return None

    def _detect_ffmpeg(self):
        """Detect FFmpeg availability and CUDA support"""
        try:
            # Check if ffmpeg exists
            result = exec_silent(
                ["ffmpeg", "-version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.return_code == 0:
                self.ffmpeg_available = True
                self._print("✅ FFmpeg detected")

                # Check for NVIDIA codec support
                if self.cuda_available:
                    codec_result = exec_silent(
                        ["ffmpeg", "-hide_banner", "-encoders"],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if codec_result.return_code == 0:
                        output = codec_result.stdout
                        # Check for NVIDIA hardware encoders
                        if 'h264_nvenc' in output or 'hevc_nvenc' in output:
                            self.ffmpeg_cuda_support = True
                            self._print("✅ FFmpeg NVIDIA hardware encoding support detected")
                        else:
                            self._print("ℹ️  FFmpeg CUDA encoders not available")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            self._print("⚠️  FFmpeg not found, video compression will be limited")
            self._print("   Install FFmpeg: https://ffmpeg.org/download.html")

    def _print_capabilities_summary(self):
        """Print capabilities summary"""
        self._print("\n" + "-" * 80)
        self._print("CAPABILITIES SUMMARY:")
        self._print(f"  GPU Available: {self.cuda_available}")
        if self.cuda_available:
            self._print(f"  GPU Device: {self.gpu_name}")
            if self.gpu_memory_gb:
                self._print(f"  GPU Memory: {self.gpu_memory_gb:.2f} GB")
        self._print(f"  FFmpeg: {self.ffmpeg_available}")
        self._print(f"  Hardware Video Encoding: {self.ffmpeg_cuda_support}")
        self._print("-" * 80 + "\n")

    def calculate_optimal_workers(self) -> int:
        """
        Calculate optimal number of worker threads based on GPU availability and memory

        Returns:
            Optimal number of worker threads
        """
        if not self.cuda_available or not self.ffmpeg_cuda_support:
            # CPU mode: use conservative thread count
            cpu_count = os.cpu_count() or 4
            return max(2, cpu_count // 2)

        # GPU mode: calculate based on GPU memory
        if self.gpu_memory_gb:
            if self.gpu_memory_gb >= 8:
                # High-end GPU: 4-6 concurrent tasks
                return 6
            elif self.gpu_memory_gb >= 4:
                # Mid-range GPU: 3-4 concurrent tasks
                return 4
            else:
                # Low-end GPU: 2 concurrent tasks
                return 2
        else:
            # Unknown GPU memory, use conservative estimate
            return 3

    def get_status_info(self) -> Dict:
        """
        Get capability status information

        Returns:
            Dictionary with status information
        """
        return {
            'cuda_available': self.cuda_available,
            'gpu_device_count': self.gpu_device_count,
            'gpu_name': self.gpu_name,
            'gpu_memory_gb': self.gpu_memory_gb,
            'ffmpeg_available': self.ffmpeg_available,
            'ffmpeg_cuda_support': self.ffmpeg_cuda_support
        }
