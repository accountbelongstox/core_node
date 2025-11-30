#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified GPU Manager
Centralized GPU detection, installation, and management for all acceleration tasks.

Priority Order:
1. NVIDIA GPU (CUDA) - PyTorch + OpenCV
2. AMD GPU (ROCm) - PyTorch ROCm
3. Intel GPU (oneAPI) - Future support
4. CPU (Fallback) - Always available

Features:
- Auto-detection of GPU hardware
- Automatic installation of required packages
- Unified interface for all GPU operations
- ENCYCLOPEDIA caching for performance
"""

import sys
import subprocess
import platform
import importlib.util
from typing import Optional, Dict, Tuple, List
from pathlib import Path
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.color_print import ColorPrint

from pycore.pyfoundations.third_party import get_third_package_torch, get_third_package_cv2

torch = get_third_package_torch()
cv2 = get_third_package_cv2()


class UnifiedGPUManager:
    """
    Unified GPU Manager for all acceleration tasks

    Handles detection, installation, and management of GPU acceleration libraries
    including PyTorch CUDA, OpenCV CUDA, AMD ROCm, etc.
    """

    def __init__(self, verbose: bool = True, auto_install: bool = False):
        """
        Initialize GPU Manager

        Args:
            verbose: Print detailed information
            auto_install: Automatically install required packages when detected
        """
        self.verbose = verbose
        self.auto_install = auto_install

        # Check cache first
        cached = ENCYCLOPEDIA.get("unified_gpu_manager_state")
        if cached is not None:
            self._load_from_cache(cached)
            return

        # Initialize state
        self.gpu_type = None  # 'nvidia', 'amd', 'intel', or None
        self.gpu_name = None
        self.gpu_memory_gb = None
        self.driver_version = None

        # Component availability
        self.pytorch_available = False
        self.pytorch_cuda_available = False
        self.pytorch_rocm_available = False
        self.opencv_cuda_available = False

        # Device selection
        self.device = "cpu"  # Default fallback
        self.device_type = "CPU"

        # Perform detection
        self._detect_and_setup()

        # Cache the results
        self._save_to_cache()

    def _print(self, *args, **kwargs):
        """Print if verbose mode enabled"""
        if self.verbose:
            print(*args, **kwargs)

    def _load_from_cache(self, cached: Dict):
        """Load state from ENCYCLOPEDIA cache"""
        self.gpu_type = cached.get('gpu_type')
        self.gpu_name = cached.get('gpu_name')
        self.gpu_memory_gb = cached.get('gpu_memory_gb')
        self.driver_version = cached.get('driver_version')
        self.pytorch_available = cached.get('pytorch_available', False)
        self.pytorch_cuda_available = cached.get('pytorch_cuda_available', False)
        self.pytorch_rocm_available = cached.get('pytorch_rocm_available', False)
        self.opencv_cuda_available = cached.get('opencv_cuda_available', False)
        self.device = cached.get('device', 'cpu')
        self.device_type = cached.get('device_type', 'CPU')

    def _save_to_cache(self):
        """Save state to ENCYCLOPEDIA cache"""
        ENCYCLOPEDIA.add("unified_gpu_manager_state", {
            'gpu_type': self.gpu_type,
            'gpu_name': self.gpu_name,
            'gpu_memory_gb': self.gpu_memory_gb,
            'driver_version': self.driver_version,
            'pytorch_available': self.pytorch_available,
            'pytorch_cuda_available': self.pytorch_cuda_available,
            'pytorch_rocm_available': self.pytorch_rocm_available,
            'opencv_cuda_available': self.opencv_cuda_available,
            'device': self.device,
            'device_type': self.device_type
        })

    def _detect_and_setup(self):
        """Detect GPU and setup acceleration libraries"""
        self._print("\n" + "=" * 80)
        self._print("[GPU MANAGER] Unified GPU Detection and Setup")
        self._print("=" * 80)

        # Priority 1: NVIDIA GPU
        if self._detect_nvidia_gpu():
            self._setup_nvidia()
            return

        # Priority 2: AMD GPU
        if self._detect_amd_gpu():
            self._setup_amd()
            return

        # Priority 3: Intel GPU (Future)
        # if self._detect_intel_gpu():
        #     self._setup_intel()
        #     return

        # Fallback: CPU
        self._setup_cpu()

    def _detect_nvidia_gpu(self) -> bool:
        """Detect NVIDIA GPU via nvidia-smi"""
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                if lines:
                    parts = lines[0].split(',')
                    if len(parts) >= 3:
                        self.gpu_type = 'nvidia'
                        self.gpu_name = parts[0].strip()
                        self.driver_version = parts[1].strip()
                        memory_str = parts[2].strip()
                        # Parse memory (e.g., "8188 MiB")
                        self.gpu_memory_gb = float(memory_str.split()[0]) / 1024
                        return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        return False

    def _detect_amd_gpu(self) -> bool:
        """Detect AMD GPU via rocm-smi"""
        try:
            result = subprocess.run(
                ["rocm-smi", "--showproductname"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                self.gpu_type = 'amd'
                self.gpu_name = result.stdout.strip()
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        return False

    def _setup_nvidia(self):
        """Setup NVIDIA GPU acceleration"""
        self._print(f"[OK] NVIDIA GPU Detected: {self.gpu_name}")
        self._print(f"     Driver Version: {self.driver_version}")
        self._print(f"     Memory: {self.gpu_memory_gb:.2f} GB")

        # Check PyTorch CUDA
        self.pytorch_available, self.pytorch_cuda_available = self._check_pytorch_cuda()

        if not self.pytorch_cuda_available:
            self._print("\n[WARN] PyTorch CUDA not available")
            if self.auto_install:
                self._print("[ACTION] Auto-installing PyTorch with CUDA support...")
                self._install_pytorch_cuda()
            else:
                self._print_pytorch_cuda_install_instructions()
        else:
            self._print(f"[OK] PyTorch CUDA available")
            self.device = "cuda"
            self.device_type = "NVIDIA GPU"

        # Check OpenCV CUDA (optional, for image processing acceleration)
        self.opencv_cuda_available = self._check_opencv_cuda()

        if not self.opencv_cuda_available:
            self._print("\n[INFO] OpenCV CUDA not available (optional)")
            self._print("       Image processing will use CPU (slower but functional)")
            if self.auto_install:
                self._print("[INFO] OpenCV CUDA requires manual build, skipping auto-install")
                self._print_opencv_cuda_info()

        self._print("=" * 80 + "\n")

    def _setup_amd(self):
        """Setup AMD GPU acceleration"""
        self._print(f"[OK] AMD GPU Detected: {self.gpu_name}")

        # Check PyTorch ROCm
        self.pytorch_available, self.pytorch_rocm_available = self._check_pytorch_rocm()

        if not self.pytorch_rocm_available:
            self._print("\n[WARN] PyTorch ROCm not available")
            if self.auto_install:
                self._print("[ACTION] Auto-installing PyTorch with ROCm support...")
                self._install_pytorch_rocm()
            else:
                self._print_pytorch_rocm_install_instructions()
        else:
            self._print(f"[OK] PyTorch ROCm available")
            self.device = "cuda"  # ROCm uses cuda device string in PyTorch
            self.device_type = "AMD GPU"

        self._print("=" * 80 + "\n")

    def _setup_cpu(self):
        """Setup CPU fallback"""
        self._print("[INFO] No GPU detected - Using CPU")
        self._print("       Training will be slower but functional")
        self.device = "cpu"
        self.device_type = "CPU"

        # Check if PyTorch is at least installed
        self.pytorch_available, _ = self._check_pytorch_cuda()

        if not self.pytorch_available:
            self._print("\n[WARN] PyTorch not installed")
            if self.auto_install:
                self._print("[ACTION] Installing PyTorch (CPU version)...")
                self._install_pytorch_cpu()
            else:
                self._print("\nTo install PyTorch (CPU version):")
                self._print("  pip install torch torchvision torchaudio")

        self._print("=" * 80 + "\n")

    def _check_pytorch_cuda(self) -> Tuple[bool, bool]:
        """Check PyTorch and CUDA availability"""
        pytorch_available = True
        cuda_available = False
        
        if hasattr(torch, 'cuda') and torch.cuda.is_available():
            cuda_available = True
            if not self.gpu_name:
                # Get GPU info from PyTorch
                self.gpu_name = torch.cuda.get_device_name(0)
                props = torch.cuda.get_device_properties(0)
                self.gpu_memory_gb = props.total_memory / (1024**3)
            
            # Print CUDA information if available
            if self.verbose:
                cuda_version = torch.version.cuda if hasattr(torch.version, 'cuda') else "Unknown"
                device_count = torch.cuda.device_count()
                ColorPrint.green(f"[OK] PyTorch CUDA available")
                ColorPrint.blue(f"     CUDA Version: {cuda_version}")
                ColorPrint.blue(f"     GPU Count: {device_count}")
                if self.gpu_name:
                    ColorPrint.blue(f"     GPU Name: {self.gpu_name}")
                if self.gpu_memory_gb:
                    ColorPrint.blue(f"     GPU Memory: {self.gpu_memory_gb:.2f} GB")
        else:
            if self.verbose:
                ColorPrint.yellow("[WARN] PyTorch CUDA not available")

        return pytorch_available, cuda_available

    def _check_pytorch_rocm(self) -> Tuple[bool, bool]:
        """Check PyTorch ROCm availability"""
        pytorch_available = True
        rocm_available = hasattr(torch, 'hip') and torch.hip.is_available()
        return pytorch_available, rocm_available

    def _check_opencv_cuda(self) -> bool:
        """Check OpenCV CUDA availability"""
        if hasattr(cv2, 'cuda'):
            device_count = cv2.cuda.getCudaEnabledDeviceCount()
            return device_count > 0
        return False

    def _install_pytorch_cuda(self):
        """Auto-install PyTorch with CUDA support"""
        try:
            # Determine CUDA version from driver
            cuda_version = self._get_cuda_version_from_driver()

            if cuda_version >= 12.4:
                index_url = "https://download.pytorch.org/whl/cu124"
            elif cuda_version >= 12.1:
                index_url = "https://download.pytorch.org/whl/cu121"
            else:
                index_url = "https://download.pytorch.org/whl/cu118"

            self._print(f"[INFO] Installing PyTorch for CUDA {cuda_version:.1f}")

            # Uninstall existing PyTorch
            subprocess.run(
                [sys.executable, "-m", "pip", "uninstall", "-y", "torch", "torchvision", "torchaudio"],
                check=False
            )

            # Install PyTorch with CUDA
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio",
                 "--index-url", index_url],
                check=True,
                capture_output=True,
                text=True
            )

            self._print("[OK] PyTorch with CUDA installed successfully")

            # Re-check
            self.pytorch_available, self.pytorch_cuda_available = self._check_pytorch_cuda()
            if self.pytorch_cuda_available:
                self.device = "cuda"
                self.device_type = "NVIDIA GPU"

        except subprocess.CalledProcessError as e:
            self._print(f"[ERROR] Failed to install PyTorch: {e}")
            self._print_pytorch_cuda_install_instructions()

    def _install_pytorch_rocm(self):
        """Auto-install PyTorch with ROCm support"""
        try:
            self._print("[INFO] Installing PyTorch with ROCm support")

            # Uninstall existing PyTorch
            subprocess.run(
                [sys.executable, "-m", "pip", "uninstall", "-y", "torch", "torchvision", "torchaudio"],
                check=False
            )

            # Install PyTorch with ROCm
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio",
                 "--index-url", "https://download.pytorch.org/whl/rocm6.0"],
                check=True,
                capture_output=True,
                text=True
            )

            self._print("[OK] PyTorch with ROCm installed successfully")

            # Re-check
            self.pytorch_available, self.pytorch_rocm_available = self._check_pytorch_rocm()
            if self.pytorch_rocm_available:
                self.device = "cuda"
                self.device_type = "AMD GPU"

        except subprocess.CalledProcessError as e:
            self._print(f"[ERROR] Failed to install PyTorch: {e}")
            self._print_pytorch_rocm_install_instructions()

    def _install_pytorch_cpu(self):
        """Auto-install PyTorch CPU version"""
        try:
            self._print("[INFO] Installing PyTorch (CPU version)")

            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "torch", "torchvision", "torchaudio"],
                check=True,
                capture_output=True,
                text=True
            )

            self._print("[OK] PyTorch (CPU) installed successfully")
            self.pytorch_available = True

        except subprocess.CalledProcessError as e:
            self._print(f"[ERROR] Failed to install PyTorch: {e}")

    def _get_cuda_version_from_driver(self) -> float:
        """Extract CUDA version from driver version"""
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                driver_version = result.stdout.strip()
                # Driver version mapping to CUDA version (approximate)
                # https://docs.nvidia.com/cuda/cuda-toolkit-release-notes/
                major = int(driver_version.split('.')[0])
                if major >= 550:
                    return 12.4
                elif major >= 525:
                    return 12.1
                else:
                    return 11.8
        except:
            pass
        return 12.4  # Default to latest

    def _print_pytorch_cuda_install_instructions(self):
        """Print PyTorch CUDA installation instructions"""
        self._print("\n" + "=" * 80)
        self._print("PYTORCH CUDA INSTALLATION INSTRUCTIONS")
        self._print("=" * 80)
        self._print("\n1. Check your CUDA version:")
        self._print("   nvidia-smi")
        self._print("\n2. Uninstall existing PyTorch:")
        self._print("   pip uninstall torch torchvision torchaudio -y")
        self._print("\n3. Install PyTorch with CUDA support:")
        self._print("\n   For CUDA 12.4:")
        self._print("   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124")
        self._print("\n   For CUDA 12.1:")
        self._print("   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121")
        self._print("\n   For CUDA 11.8:")
        self._print("   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118")
        self._print("\n" + "=" * 80)

    def _print_pytorch_rocm_install_instructions(self):
        """Print PyTorch ROCm installation instructions"""
        self._print("\n" + "=" * 80)
        self._print("PYTORCH ROCM INSTALLATION INSTRUCTIONS")
        self._print("=" * 80)
        self._print("\n1. Uninstall existing PyTorch:")
        self._print("   pip uninstall torch torchvision torchaudio -y")
        self._print("\n2. Install PyTorch with ROCm support:")
        self._print("   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.0")
        self._print("\n" + "=" * 80)

    def _print_opencv_cuda_info(self):
        """Print OpenCV CUDA information"""
        self._print("\n" + "=" * 80)
        self._print("OPENCV CUDA INFORMATION (OPTIONAL)")
        self._print("=" * 80)
        self._print("\nOpenCV CUDA is OPTIONAL and only provides image processing acceleration.")
        self._print("Model training already uses GPU via PyTorch CUDA.")
        self._print("\nTo enable OpenCV CUDA (advanced users):")
        self._print("\n1. Standard opencv-python does NOT include CUDA support")
        self._print("2. You need to build opencv-contrib-python from source with CUDA")
        self._print("3. OR use pre-built wheels (if available for your platform)")
        self._print("\nBuild from source:")
        self._print("   git clone --recursive https://github.com/opencv/opencv-python.git")
        self._print("   cd opencv-python")
        self._print("   export CMAKE_ARGS=\"-DWITH_CUDA=ON -DCUDA_ARCH_BIN=8.6\"")
        self._print("   export ENABLE_CONTRIB=1")
        self._print("   pip wheel . --verbose")
        self._print("\nNote: This is complex and may take hours to build.")
        self._print("      Image processing on CPU is usually sufficient for most use cases.")
        self._print("=" * 80)

    # Public API

    def get_device(self) -> str:
        """Get device string for PyTorch/training ('cuda', 'cpu', etc.)"""
        return self.device

    def get_device_type(self) -> str:
        """Get human-readable device type"""
        return self.device_type

    def is_gpu_available(self) -> bool:
        """Check if any GPU is available"""
        return self.device != "cpu"

    def is_pytorch_cuda_available(self) -> bool:
        """Check if PyTorch CUDA is available"""
        return self.pytorch_cuda_available

    def is_opencv_cuda_available(self) -> bool:
        """Check if OpenCV CUDA is available"""
        return self.opencv_cuda_available

    def get_info(self) -> Dict:
        """Get complete GPU information"""
        return {
            'gpu_type': self.gpu_type,
            'gpu_name': self.gpu_name,
            'gpu_memory_gb': self.gpu_memory_gb,
            'driver_version': self.driver_version,
            'device': self.device,
            'device_type': self.device_type,
            'pytorch_available': self.pytorch_available,
            'pytorch_cuda_available': self.pytorch_cuda_available,
            'pytorch_rocm_available': self.pytorch_rocm_available,
            'opencv_cuda_available': self.opencv_cuda_available
        }

    def print_summary(self):
        """Print GPU status summary"""
        self._print("\n" + "=" * 80)
        self._print("[GPU MANAGER] Summary")
        self._print("=" * 80)
        self._print(f"Selected Device:  {self.device}")
        self._print(f"Device Type:      {self.device_type}")

        if self.gpu_name:
            self._print(f"GPU Name:         {self.gpu_name}")
        if self.gpu_memory_gb:
            self._print(f"GPU Memory:       {self.gpu_memory_gb:.2f} GB")

        self._print(f"\nAcceleration Status:")
        self._print(f"  PyTorch:        {'[OK] Available' if self.pytorch_available else '[X] Not installed'}")
        self._print(f"  PyTorch CUDA:   {'[OK] Available' if self.pytorch_cuda_available else '[X] Not available'}")
        self._print(f"  OpenCV CUDA:    {'[OK] Available' if self.opencv_cuda_available else '[X] Not available'}")
        self._print("=" * 80 + "\n")


# Singleton instance
_gpu_manager: Optional[UnifiedGPUManager] = None


def get_gpu_manager(verbose: bool = True, auto_install: bool = False) -> UnifiedGPUManager:
    """
    Get or create the global GPU manager instance

    Args:
        verbose: Print detailed information
        auto_install: Automatically install required packages

    Returns:
        UnifiedGPUManager instance
    """
    global _gpu_manager
    if _gpu_manager is None:
        _gpu_manager = UnifiedGPUManager(verbose=verbose, auto_install=auto_install)
    return _gpu_manager


def get_device(verbose: bool = True) -> str:
    """
    Get the best available device

    Args:
        verbose: Print detailed information

    Returns:
        Device string ("cuda" or "cpu")
    """
    manager = get_gpu_manager(verbose=verbose)
    return manager.get_device()


if __name__ == "__main__":
    # Test unified GPU manager
    print("Testing Unified GPU Manager\n")

    manager = UnifiedGPUManager(verbose=True, auto_install=False)
    manager.print_summary()

    print("\nGPU Info:")
    import json
    print(json.dumps(manager.get_info(), indent=2))
