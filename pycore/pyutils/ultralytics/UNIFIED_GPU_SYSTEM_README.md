# Unified GPU Management System

## Overview

The Unified GPU Management System provides a centralized solution for GPU detection, automatic installation, and management, supporting multiple GPU acceleration schemes with automatic fallback to CPU.

## Core Features

### 1. Automatic GPU Detection (Priority Order)

```
1. NVIDIA GPU (CUDA)
   ├── PyTorch CUDA (Model training)
   └── OpenCV CUDA (Image processing, optional)

2. AMD GPU (ROCm)
   └── PyTorch ROCm (Model training)

3. Intel GPU (oneAPI)
   └── Future support

4. CPU (Fallback)
   └── PyTorch CPU version
```

### 2. Automatic Installation Support

When `auto_install=True` is enabled, the system will automatically:

- **When NVIDIA GPU is detected**:
  - Analyze driver version to determine CUDA version
  - Automatically install corresponding PyTorch CUDA version
  - Provide OpenCV CUDA installation instructions (optional)

- **When AMD GPU is detected**:
  - Automatically install PyTorch ROCm version

- **When no GPU is detected**:
  - Install PyTorch CPU version

### 3. ENCYCLOPEDIA Caching

- GPU detection runs only once
- Results cached in global ENCYCLOPEDIA
- Subsequent calls return cached results immediately
- Zero performance overhead

## Usage

### Basic Usage

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager, get_device

# Method 1: Get manager instance (recommended)
gpu_manager = get_gpu_manager(verbose=True, auto_install=False)
device = gpu_manager.get_device()  # Returns: "cuda" or "cpu"

# Method 2: Quick device retrieval
device = get_device(verbose=True)  # Directly returns best device

# Method 3: Enable auto-installation
gpu_manager = get_gpu_manager(verbose=True, auto_install=True)
```

### Usage During Training

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_device
from ultralytics import YOLO

# Automatically select best device
device = get_device(verbose=True)

# Train
model = YOLO("yolov8n.pt")
results = model.train(
    data="dataset.yaml",
    epochs=300,
    device=device  # Automatically uses GPU or CPU
)
```

### Usage for Image Processing

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager
from pycore.pyutils.ultralytics.gpu_image_processor import get_gpu_processor

# Get GPU information
gpu_manager = get_gpu_manager()
info = gpu_manager.get_info()

# Use GPU-accelerated image processor
gpu_processor = get_gpu_processor()
resized = gpu_processor.resize(image, (640, 640))
```

### Check GPU Status

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager

manager = get_gpu_manager()

# Print detailed summary
manager.print_summary()

# Get complete information
info = manager.get_info()
print(f"GPU Type: {info['gpu_type']}")
print(f"GPU Name: {info['gpu_name']}")
print(f"PyTorch CUDA: {info['pytorch_cuda_available']}")
print(f"OpenCV CUDA: {info['opencv_cuda_available']}")

# Simple check
if manager.is_gpu_available():
    print("GPU acceleration available!")
else:
    print("Using CPU mode")
```

## OpenCV CUDA Installation Guide

### Why OpenCV CUDA?

- **Not needed**: If only doing model training (PyTorch already uses GPU)
- **Optional**: If need to accelerate large-scale image preprocessing operations
- **Recommended**: For real-time video processing or large-scale dataset generation

### Installation Methods

#### Option 1: Standard Installation (No CUDA)

```bash
# Current installation method
pip install opencv-python
# Or with contrib modules
pip install opencv-contrib-python
```

**Features**:
- ✅ Simple and fast installation
- ✅ Stable and reliable
- ❌ Image processing uses CPU
- ✅ Suitable for most users

#### Option 2: Compile from Source (With CUDA Support)

**For advanced users only! Requires 2-4 hours compilation time.**

```bash
# 1. Uninstall existing OpenCV
pip uninstall opencv-python opencv-contrib-python -y

# 2. Clone opencv-python repository
git clone --recursive https://github.com/opencv/opencv-python.git
cd opencv-python

# 3. Set compilation parameters (adjust CUDA_ARCH_BIN according to your GPU)
# RTX 4060 uses 8.9
# Check your GPU architecture: https://developer.nvidia.com/cuda-gpus
export CMAKE_ARGS="-DWITH_CUDA=ON -DCUDA_ARCH_BIN=8.9 -DWITH_CUBLAS=ON -DWITH_CUFFT=ON"
export ENABLE_CONTRIB=1

# 4. Compile (takes a long time)
pip wheel . --verbose

# 5. Install generated wheel file
pip install dist/opencv_contrib_python-*.whl
```

**Notes**:
- Requires CUDA Toolkit installation (matching driver version)
- Requires CMake 3.15+
- Windows requires Visual Studio 2019+
- Linux requires gcc/g++ compiler
- Compilation may take 2-4 hours

#### Option 3: Use Pre-compiled Packages (If Available)

Some third parties may provide pre-compiled OpenCV CUDA packages, but note:
- Compatibility may have issues
- Version may not be latest
- Security needs to be verified independently

### CUDA Architecture Version Reference

| GPU Series | Compute Capability | CUDA_ARCH_BIN |
|------------|-------------------|---------------|
| RTX 40 Series (4090/4080/4070/4060) | 8.9 | 8.9 |
| RTX 30 Series (3090/3080/3070/3060) | 8.6 | 8.6 |
| RTX 20 Series (2080/2070/2060) | 7.5 | 7.5 |
| GTX 16 Series (1660/1650) | 7.5 | 7.5 |
| GTX 10 Series (1080/1070/1060) | 6.1 | 6.1 |

View complete list: https://developer.nvidia.com/cuda-gpus

## System Output Examples

### NVIDIA GPU Detected

```
================================================================================
[GPU MANAGER] Unified GPU Detection and Setup
================================================================================
[OK] NVIDIA GPU Detected: NVIDIA GeForce RTX 4060 Laptop GPU
     Driver Version: 537.13
     Memory: 7.65 GB
[OK] PyTorch CUDA available

[INFO] OpenCV CUDA not available (optional)
       Image processing will use CPU (slower but functional)
================================================================================

================================================================================
[GPU MANAGER] Summary
================================================================================
Selected Device:  cuda
Device Type:      NVIDIA GPU
GPU Name:         NVIDIA GeForce RTX 4060 Laptop GPU
GPU Memory:       7.65 GB

Acceleration Status:
  PyTorch:        [OK] Available
  PyTorch CUDA:   [OK] Available
  OpenCV CUDA:    [X] Not available
================================================================================
```

### No GPU Detected

```
================================================================================
[GPU MANAGER] Unified GPU Detection and Setup
================================================================================
[INFO] No GPU detected - Using CPU
       Training will be slower but functional
================================================================================

================================================================================
[GPU MANAGER] Summary
================================================================================
Selected Device:  cpu
Device Type:      CPU

Acceleration Status:
  PyTorch:        [OK] Available
  PyTorch CUDA:   [X] Not available
  OpenCV CUDA:    [X] Not available
================================================================================
```

## Performance Comparison

### Model Training (YOLOv8n, 300 epochs)

| Device | Time per Epoch | Total Training Time | Speedup |
|--------|---------------|---------------------|---------|
| RTX 4060 (CUDA) | ~20s | ~1.7 hours | 10x |
| CPU (i7-12700) | ~200s | ~17 hours | 1x |

### Image Processing (1000 images 640x640)

| Operation | OpenCV CUDA | OpenCV CPU | Speedup |
|-----------|-------------|------------|---------|
| Resize | ~0.5s | ~2s | 4x |
| Blur | ~0.3s | ~1.5s | 5x |
| Color Conversion | ~0.2s | ~0.8s | 4x |

**Conclusion**:
- ✅ PyTorch CUDA is crucial for training (10x speedup)
- ⚠️ OpenCV CUDA helps image processing but not essential (4-5x speedup)

## Troubleshooting

### Issue 1: PyTorch CUDA Installation Failed

```bash
# Manually check CUDA version
nvidia-smi

# Manually install (according to output CUDA version)
pip uninstall torch torchvision torchaudio -y
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

### Issue 2: Insufficient Virtual Memory

Symptoms: Crash during training, error "WinError 1455: The paging file is too small"

Solutions:
1. Reduce batch_size (from 16 to 8)
2. Reduce workers count (from 8 to 4)
3. Increase Windows virtual memory to 16-32GB

### Issue 3: GPU Memory Insufficient

Symptoms: CUDA out of memory

Solutions:
```python
# Reduce batch size
results = model.train(
    data="dataset.yaml",
    epochs=300,
    batch=8,  # Reduced from 16 to 8
    device="cuda"
)
```

### Issue 4: Multi-GPU System Select Specific GPU

```python
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager

# Get manager
manager = get_gpu_manager()

# Manually specify GPU
import os
os.environ['CUDA_VISIBLE_DEVICES'] = '0'  # Use first GPU

# Or specify during training
results = model.train(
    data="dataset.yaml",
    device=0  # Use GPU 0
)
```

## Technical Architecture

### Component Relationships

```
unified_gpu_manager.py (Unified Manager)
    ├── Detect GPU hardware
    ├── Auto-install dependencies
    └── Provide unified interface
        ↓
device_manager.py (Device Management)
    ├── NVIDIA detection
    ├── AMD detection
    └── Device selection
        ↓
gpu_image_processor.py (Image Processing)
    ├── OpenCV CUDA acceleration
    └── CPU fallback
        ↓
Training and inference code
```

### ENCYCLOPEDIA Caching Flow

```
First call to get_gpu_manager()
    ↓
Check ENCYCLOPEDIA["unified_gpu_manager_state"]
    ↓
    No → Execute full detection
        ├── Detect GPU hardware
        ├── Detect PyTorch/OpenCV
        ├── (Optional) Auto-install
        └── Save results to ENCYCLOPEDIA
    ↓
    Yes → Load directly from cache
        └── Return immediately (<1ms)
```

## Best Practices

### 1. Development Environment

```python
# Disable auto-install during development, view complete information
from pycore.pyutils.ultralytics.unified_gpu_manager import get_gpu_manager

manager = get_gpu_manager(verbose=True, auto_install=False)
manager.print_summary()
```

### 2. Production Environment

```python
# Enable auto-install in production
from pycore.pyutils.ultralytics.unified_gpu_manager import get_device

device = get_device(verbose=False)  # Silent mode
```

### 3. CI/CD Environment

```bash
# Dockerfile example
FROM python:3.10

# Install base dependencies
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install your application
COPY . /app
WORKDIR /app
RUN pip install -r requirements.txt

# GPU will automatically fallback to CPU
```

### 4. Multi-Platform Support

```python
# Code automatically adapts to all platforms
from pycore.pyutils.ultralytics.unified_gpu_manager import get_device

# Windows: CUDA or CPU
# Linux: CUDA, ROCm or CPU
# macOS: CPU (Metal future support)
# Docker: Automatically select according to container configuration

device = get_device()  # Automatically handles everything
```

## Changelog

### v1.0.0 (2025-10-17)

**New Features**:
- ✅ Unified GPU manager
- ✅ NVIDIA CUDA automatic detection and installation
- ✅ AMD ROCm automatic detection and installation
- ✅ ENCYCLOPEDIA global caching
- ✅ Automatic fallback to CPU
- ✅ PyTorch and OpenCV unified management

**Improvements**:
- ✅ Eliminated duplicate dependency check messages
- ✅ Clear distinction between PyTorch CUDA and OpenCV CUDA
- ✅ Detailed installation guidance
- ✅ Complete error handling

## Contributing

Welcome to submit issues and improvement suggestions to the project repository.

## License

Consistent with the main project.

---

**Maintainer**: Core Node Team
**Last Updated**: 2025-10-17
**Document Version**: 1.0.0
