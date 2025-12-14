"""
GPU Device Manager for YOLO Training
Automatically detects and selects the best available device (NVIDIA GPU > AMD GPU > CPU)
Provides detailed installation guidance and device information
"""

import os
import sys
import subprocess
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
import platform
from typing import Optional, Tuple, Dict
from pathlib import Path


# Detect if emoji is supported (avoid GBK encoding issues on Windows)
def _supports_emoji():
    """Check if terminal supports emoji"""
    if platform.system() == "Windows":
        # Windows terminals often have GBK encoding issues with emoji
        # Disable emoji on Windows by default
        return False
    return True


_USE_EMOJI = _supports_emoji()


class DeviceManager:
    """
    Manages device selection and provides installation guidance for GPU acceleration

    Priority:
    1. NVIDIA GPU (CUDA)
    2. AMD GPU (ROCm)
    3. CPU (fallback)
    """

    def __init__(self, verbose: bool = True):
        """
        Initialize device manager

        Args:
            verbose: Whether to print detailed information
        """
        self.verbose = verbose
        self.device = None
        self.device_type = None
        self.device_info = {}

        # Detect and select best device
        self._detect_device()

    def _print(self, *args, **kwargs):
        """Print if verbose mode is enabled"""
        if self.verbose:
            print(*args, **kwargs)

    def _check_nvidia_gpu(self) -> Tuple[bool, Dict]:
        """
        Check NVIDIA GPU availability

        Returns:
            (available, info_dict)
        """
        info = {
            "type": "NVIDIA",
            "driver_available": False,
            "pytorch_cuda": False,
            "gpu_name": None,
            "cuda_version": None,
            "gpu_memory": None,
        }

        # Check NVIDIA driver
        try:
            result = exec_silent(
                ["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.return_code == 0:
                info["driver_available"] = True
                lines = result.stdout.strip().split('\n')
                if lines:
                    parts = lines[0].split(',')
                    if len(parts) >= 3:
                        info["gpu_name"] = parts[0].strip()
                        info["cuda_version"] = parts[1].strip()
                        info["gpu_memory"] = parts[2].strip()
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        # Check PyTorch CUDA support
        try:
            import torch
            info["pytorch_cuda"] = torch.cuda.is_available()
            if info["pytorch_cuda"]:
                info["pytorch_version"] = torch.__version__
                info["cuda_capability"] = torch.cuda.get_device_capability()
        except ImportError:
            pass

        available = info["driver_available"] and info["pytorch_cuda"]
        return available, info

    def _check_amd_gpu(self) -> Tuple[bool, Dict]:
        """
        Check AMD GPU availability (ROCm)

        Returns:
            (available, info_dict)
        """
        info = {
            "type": "AMD",
            "rocm_available": False,
            "pytorch_rocm": False,
            "gpu_name": None,
        }

        # Check ROCm
        try:
            result = exec_silent(
                ["rocm-smi", "--showproductname"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.return_code == 0:
                info["rocm_available"] = True
                info["gpu_name"] = result.stdout.strip()
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

        # Check PyTorch ROCm support
        try:
            import torch
            info["pytorch_rocm"] = hasattr(torch, 'hip') and torch.hip.is_available()
            if info["pytorch_rocm"]:
                info["pytorch_version"] = torch.__version__
        except ImportError:
            pass

        available = info["rocm_available"] and info["pytorch_rocm"]
        return available, info

    def _detect_device(self):
        """Detect and select the best available device"""

        self._print("\n" + "=" * 80)
        icon = "[DETECT]" if not _USE_EMOJI else "🔍"
        self._print(f"{icon} DEVICE DETECTION")
        self._print("=" * 80)

        # 1. Check NVIDIA GPU
        nvidia_available, nvidia_info = self._check_nvidia_gpu()

        if nvidia_available:
            self.device = "cuda"
            self.device_type = "NVIDIA GPU"
            self.device_info = nvidia_info
            self._print_nvidia_info(nvidia_info)
            return

        # 2. Check AMD GPU
        amd_available, amd_info = self._check_amd_gpu()

        if amd_available:
            self.device = "hip"
            self.device_type = "AMD GPU"
            self.device_info = amd_info
            self._print_amd_info(amd_info)
            return

        # 3. Fallback to CPU
        self.device = "cpu"
        self.device_type = "CPU"
        self._print_cpu_fallback(nvidia_info, amd_info)

    def _print_nvidia_info(self, info: Dict):
        """Print NVIDIA GPU information"""
        check = "[OK]" if not _USE_EMOJI else "✅"
        self._print(f"{check} NVIDIA GPU Detected")
        self._print(f"   GPU Name:       {info.get('gpu_name', 'Unknown')}")
        self._print(f"   Memory:         {info.get('gpu_memory', 'Unknown')}")
        self._print(f"   PyTorch:        {info.get('pytorch_version', 'Unknown')}")
        self._print(f"   Device:         cuda")
        self._print("=" * 80 + "\n")

    def _print_amd_info(self, info: Dict):
        """Print AMD GPU information"""
        check = "[OK]" if not _USE_EMOJI else "✅"
        self._print(f"{check} AMD GPU Detected")
        self._print(f"   GPU Name:       {info.get('gpu_name', 'Unknown')}")
        self._print(f"   PyTorch:        {info.get('pytorch_version', 'Unknown')}")
        self._print(f"   Device:         hip")
        self._print("=" * 80 + "\n")

    def _print_cpu_fallback(self, nvidia_info: Dict, amd_info: Dict):
        """Print CPU fallback information with installation guidance"""
        warn = "[WARN]" if not _USE_EMOJI else "⚠️"
        doc = "[INFO]" if not _USE_EMOJI else "📋"

        self._print(f"{warn}  No GPU Detected - Using CPU")
        self._print()

        # Provide installation guidance
        if nvidia_info["driver_available"] and not nvidia_info["pytorch_cuda"]:
            self._print(f"{doc} NVIDIA GPU driver detected, but PyTorch CUDA support is missing")
            self._print()
            self._print("To enable NVIDIA GPU acceleration:")
            self._print("  1. Check your CUDA version:")
            self._print("     nvidia-smi")
            self._print()
            self._print("  2. Install PyTorch with CUDA support:")
            self._print("     # For CUDA 12.4 (recommended for CUDA 13.0 drivers)")
            self._print("     pip uninstall torch torchvision -y")
            self._print("     pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124")
            self._print()
            self._print("     # For CUDA 12.1")
            self._print("     pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121")
            self._print()
            self._print("     # For CUDA 11.8")
            self._print("     pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118")
            self._print()
        elif not nvidia_info["driver_available"]:
            self._print(f"{doc} No NVIDIA GPU driver detected")
            self._print()
            self._print("To enable NVIDIA GPU acceleration:")
            self._print("  1. Install NVIDIA GPU drivers from:")
            self._print("     https://www.nvidia.com/Download/index.aspx")
            self._print()
            self._print("  2. Verify installation:")
            self._print("     nvidia-smi")
            self._print()
            self._print("  3. Install PyTorch with CUDA support:")
            self._print("     pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124")
            self._print()

        if amd_info["rocm_available"] and not amd_info["pytorch_rocm"]:
            self._print(f"{doc} AMD GPU (ROCm) detected, but PyTorch ROCm support is missing")
            self._print()
            self._print("To enable AMD GPU acceleration:")
            self._print("  1. Install PyTorch with ROCm support:")
            self._print("     pip install torch torchvision --index-url https://download.pytorch.org/whl/rocm6.0")
            self._print()

        self._print(f"{warn}  Training will use CPU (slower)")
        self._print("=" * 80 + "\n")

    def get_device(self) -> str:
        """
        Get the selected device string

        Returns:
            Device string ("cuda", "hip", or "cpu")
        """
        return self.device

    def get_device_type(self) -> str:
        """
        Get human-readable device type

        Returns:
            Device type string ("NVIDIA GPU", "AMD GPU", or "CPU")
        """
        return self.device_type

    def get_device_info(self) -> Dict:
        """
        Get detailed device information

        Returns:
            Dictionary with device information
        """
        return self.device_info

    def is_gpu_available(self) -> bool:
        """
        Check if GPU is available

        Returns:
            True if GPU (NVIDIA or AMD) is available
        """
        return self.device in ["cuda", "hip"]

    def print_summary(self):
        """Print device summary"""
        chart = "[STATS]" if not _USE_EMOJI else "📊"
        check = "[OK]" if not _USE_EMOJI else "✅"
        warn = "[WARN]" if not _USE_EMOJI else "⚠️"

        self._print("\n" + "=" * 80)
        self._print(f"{chart} DEVICE SUMMARY")
        self._print("=" * 80)
        self._print(f"Selected Device:  {self.device}")
        self._print(f"Device Type:      {self.device_type}")

        if self.is_gpu_available():
            self._print(f"Acceleration:     {check} Enabled")
        else:
            self._print(f"Acceleration:     {warn}  Disabled (CPU mode)")

        self._print("=" * 80 + "\n")


# Singleton instance
_device_manager: Optional[DeviceManager] = None


def get_device_manager(verbose: bool = True) -> DeviceManager:
    """
    Get or create the global device manager instance

    Args:
        verbose: Whether to print detailed information

    Returns:
        DeviceManager instance
    """
    global _device_manager
    if _device_manager is None:
        _device_manager = DeviceManager(verbose=verbose)
    return _device_manager


def get_device(verbose: bool = True) -> str:
    """
    Get the best available device

    Args:
        verbose: Whether to print detailed information

    Returns:
        Device string ("cuda", "hip", or "cpu")
    """
    manager = get_device_manager(verbose=verbose)
    return manager.get_device()


if __name__ == "__main__":
    # Test device detection
    manager = DeviceManager(verbose=True)
    manager.print_summary()

    print("\nDevice Information:")
    print(f"  Device: {manager.get_device()}")
    print(f"  Type: {manager.get_device_type()}")
    print(f"  GPU Available: {manager.is_gpu_available()}")
    print(f"  Info: {manager.get_device_info()}")
