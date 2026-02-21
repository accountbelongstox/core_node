# CPU / GPU 差异包统一说明

全项目 CPU 与 GPU 包选型以 **`cpu_gpu_packages.py`** 为唯一来源，决策依据为 `CUDADetector.is_cuda_available()`（nvidia-smi 或 CUDA 环境变量）。

---

## 1. 统一入口

| 模块 | 说明 |
|------|------|
| **cpu_gpu_packages.py** | 提供 `get_ort_install_package()`、`get_cnocr_pip_package()`、`get_paddle_install_package()` 及常量 `ORT_CPU_PKG`、`ORT_GPU_PKG`、`CNOCR_PIP_CPU`、`CNOCR_PIP_GPU`。所有「按 CPU/GPU 选包」的逻辑必须使用此模块，不得在各处重复写 `CUDADetector.is_cuda_available() ? gpu_pkg : cpu_pkg`。 |

---

## 2. 各组件 CPU/GPU 包

| 组件 | CPU 包 | GPU 包 | 说明 |
|------|--------|--------|------|
| **ONNX Runtime** | `onnxruntime` | `onnxruntime-gpu[cuda,cudnn]`，另装 `nvidia-cublas-cu12`、`tensorrt-cu12`（完整基础库，满足 CUDA EP + TensorRT EP） | 互斥安装；安装选型用 `get_ort_install_package()`；ensure 时由 onnx_runtime_capability 安装上述全部；检测是否已装用 `ORT_CPU_PKG` / `ORT_GPU_PKG`。 |
| **CnOCR** | `cnocr[ort-cpu]` | `cnocr[ort-gpu]` | 选型用 `get_cnocr_pip_package()`。 |
| **PyTorch** | 默认 pip（CPU） | `--index-url https://download.pytorch.org/whl/cu118`（third_party 中） | 不在 cpu_gpu_packages 中；由 `_ensure_torch_cuda_build_first()`（如被调用）使用 `PYTORCH_CUDA_INDEX_URL`。Ultralytics 等可能提示 cu121/cu124，项目未统一 PyTorch CUDA 版本。 |
| **PaddlePaddle** | `paddlepaddle` | 当前未用 GPU 安装路径 | `get_paddle_install_package()` 目前恒返回 CPU 包；GPU 需时可在此扩展。 |

---

## 3. 使用处

- **ocr_initializer**：`ORT_CPU_PKG`、`ORT_GPU_PKG`、`get_ort_install_package()`（ONNX 切换与安装）。
- **onnx_runtime_capability**：`get_ort_install_package()`（ensure 时安装 ORT GPU 包）。
- **third_party**：`get_cnocr_pip_package()`（get_third_package_cnocr 安装 cnocr）。
- **mcp_bridge main**：`get_cnocr_pip_package()`（`_cnocr_pip`）。
- **mcp_bridge cnocr_engine**：`get_cnocr_pip_package()`（install_dependencies）。
- **ocr_cnocr_engine**：`get_cnocr_pip_package()`（错误提示中的安装建议）。

---

## 4. 其他说明

- **推理时 GPU 是否可用**：OCR 推理用 `is_onnx_cuda_usable()`（ORT 能否建 CUDA 会话），与「安装时选 GPU 包」的 `CUDADetector.is_cuda_available()` 区分开。
- **PaddleOCR**：当前安装逻辑（如 paddle_ocr.py、paddle_ocr_engine.py）仅装 CPU 版；若日后支持 GPU，应在 `get_paddle_install_package()` 中按 `CUDADetector.is_cuda_available()` 返回对应包或索引。
