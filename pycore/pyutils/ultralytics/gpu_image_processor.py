"""
GPU-accelerated image processing utilities
Provides GPU acceleration for image operations during training data generation
"""

import cv2
import numpy as np
from typing import Optional, Tuple
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA


class GPUImageProcessor:
    """
    GPU-accelerated image processor using cv2.cuda (if available)

    Falls back to CPU if GPU is not available
    """

    def __init__(self, verbose: bool = True):
        """
        Initialize GPU image processor

        Args:
            verbose: Whether to print information
        """
        self.verbose = verbose
        self.cuda_available = False
        self.gpu_device_count = 0
        self.device_name = None
        self.device_memory = None
        self.pytorch_cuda_available = False

        # Check if already initialized (use ENCYCLOPEDIA cache)
        cached_info = ENCYCLOPEDIA.get("gpu_image_processor_info")
        if cached_info is not None:
            self.cuda_available = cached_info['cuda_available']
            self.gpu_device_count = cached_info['device_count']
            self.device_name = cached_info['device_name']
            self.device_memory = cached_info['device_memory']
            self.pytorch_cuda_available = cached_info.get('pytorch_cuda_available', False)
            return

        # Check PyTorch CUDA availability first (most common)
        try:
            import torch
            self.pytorch_cuda_available = torch.cuda.is_available()
            if self.pytorch_cuda_available and not self.device_name:
                self.device_name = torch.cuda.get_device_name(0)
                self.device_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        except ImportError:
            pass

        # Check cv2.cuda availability for OpenCV acceleration
        try:
            self.gpu_device_count = cv2.cuda.getCudaEnabledDeviceCount()
            if self.gpu_device_count > 0:
                self.cuda_available = True
                # Get device info
                try:
                    info = cv2.cuda.DeviceInfo(0)
                    if not self.device_name:  # Only set if not already set by PyTorch
                        self.device_name = info.name()
                        self.device_memory = info.totalMemory() / (1024**3)
                except Exception:
                    pass

                if self.verbose:
                    print(f"✅ OpenCV CUDA support detected: {self.gpu_device_count} device(s)")
                    if self.device_name:
                        print(f"   Device 0: {self.device_name}")
                        print(f"   Total Memory: {self.device_memory:.2f} GB")
        except AttributeError:
            # OpenCV CUDA not available, but PyTorch CUDA might be
            if self.verbose and self.pytorch_cuda_available:
                print("ℹ️  OpenCV CUDA not available, but PyTorch CUDA is available")
                print(f"   GPU Device: {self.device_name}")
                print(f"   Image processing will use CPU (OpenCV operations)")
                print(f"   Model training will use GPU (PyTorch operations)")
                print()
            elif self.verbose:
                print("⚠️  OpenCV CUDA support not available")
                print("   Image generation will use CPU")
                print()
                print("   To enable GPU acceleration for image processing:")
                print("   1. Install opencv-contrib-python with CUDA support:")
                print("      pip uninstall opencv-python opencv-contrib-python -y")
                print("      # Then install pre-built CUDA version from:")
                print("      # https://github.com/opencv/opencv-python/releases")
                print()

        # Cache the result in ENCYCLOPEDIA
        ENCYCLOPEDIA.add("gpu_image_processor_info", {
            'cuda_available': self.cuda_available,
            'device_count': self.gpu_device_count,
            'device_name': self.device_name,
            'device_memory': self.device_memory,
            'pytorch_cuda_available': self.pytorch_cuda_available
        })

    def get_status_info(self) -> dict:
        """
        Get GPU status information

        Returns:
            Dictionary with GPU status information
        """
        return {
            'cuda_available': self.cuda_available,
            'device_count': self.gpu_device_count,
            'device_name': self.device_name,
            'device_memory_gb': self.device_memory,
            'pytorch_cuda_available': self.pytorch_cuda_available
        }

    def resize(self, img: np.ndarray, size: Tuple[int, int],
               interpolation: int = cv2.INTER_AREA) -> np.ndarray:
        """
        Resize image using GPU if available

        Args:
            img: Input image
            size: Target size (width, height)
            interpolation: Interpolation method

        Returns:
            Resized image
        """
        if self.cuda_available:
            try:
                # Upload to GPU
                gpu_img = cv2.cuda_GpuMat()
                gpu_img.upload(img)

                # Resize on GPU
                gpu_resized = cv2.cuda.resize(gpu_img, size, interpolation=interpolation)

                # Download from GPU
                return gpu_resized.download()
            except Exception as e:
                # Fallback to CPU
                if self.verbose:
                    print(f"⚠️  GPU resize failed, using CPU: {e}")
                return cv2.resize(img, size, interpolation=interpolation)
        else:
            # CPU fallback
            return cv2.resize(img, size, interpolation=interpolation)

    def blend(self, img1: np.ndarray, img2: np.ndarray,
              alpha: float) -> np.ndarray:
        """
        Blend two images using GPU if available

        Args:
            img1: First image
            img2: Second image
            alpha: Blend factor (0.0 to 1.0)

        Returns:
            Blended image
        """
        if self.cuda_available:
            try:
                # Upload to GPU
                gpu_img1 = cv2.cuda_GpuMat()
                gpu_img2 = cv2.cuda_GpuMat()
                gpu_img1.upload(img1)
                gpu_img2.upload(img2)

                # Blend on GPU
                gpu_result = cv2.cuda.addWeighted(
                    gpu_img1, alpha, gpu_img2, 1 - alpha, 0
                )

                # Download from GPU
                return gpu_result.download()
            except Exception as e:
                # Fallback to CPU
                if self.verbose:
                    print(f"⚠️  GPU blend failed, using CPU: {e}")
                return cv2.addWeighted(img1, alpha, img2, 1 - alpha, 0)
        else:
            # CPU fallback
            return cv2.addWeighted(img1, alpha, img2, 1 - alpha, 0)

    def convert_color(self, img: np.ndarray, code: int) -> np.ndarray:
        """
        Convert color space using GPU if available

        Args:
            img: Input image
            code: Color conversion code (e.g., cv2.COLOR_BGR2GRAY)

        Returns:
            Converted image
        """
        if self.cuda_available:
            try:
                # Upload to GPU
                gpu_img = cv2.cuda_GpuMat()
                gpu_img.upload(img)

                # Convert on GPU
                gpu_result = cv2.cuda.cvtColor(gpu_img, code)

                # Download from GPU
                return gpu_result.download()
            except Exception as e:
                # Fallback to CPU
                if self.verbose:
                    print(f"⚠️  GPU color conversion failed, using CPU: {e}")
                return cv2.cvtColor(img, code)
        else:
            # CPU fallback
            return cv2.cvtColor(img, code)

    def is_cuda_available(self) -> bool:
        """Check if CUDA is available for OpenCV"""
        return self.cuda_available


# Singleton instance
_gpu_processor: Optional[GPUImageProcessor] = None


def get_gpu_processor(verbose: bool = False) -> GPUImageProcessor:
    """
    Get or create the global GPU processor instance

    Args:
        verbose: Whether to print information

    Returns:
        GPUImageProcessor instance
    """
    global _gpu_processor
    if _gpu_processor is None:
        _gpu_processor = GPUImageProcessor(verbose=verbose)
    return _gpu_processor


if __name__ == "__main__":
    # Test GPU image processor
    processor = GPUImageProcessor(verbose=True)

    # Test with a simple image
    test_img = np.random.randint(0, 255, (1080, 1920, 3), dtype=np.uint8)

    print("\nTesting resize...")
    resized = processor.resize(test_img, (640, 640))
    print(f"Resized shape: {resized.shape}")

    print("\nTesting color conversion...")
    gray = processor.convert_color(test_img, cv2.COLOR_BGR2GRAY)
    print(f"Gray shape: {gray.shape}")

    print(f"\nCUDA available: {processor.is_cuda_available()}")
