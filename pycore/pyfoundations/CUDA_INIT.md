# CUDA 初始化说明 (CUDA Initialization)

全项目**唯一**的 CUDA 初始化入口：根据显卡/系统做全方位初始化（系统检测、ORT CUDA 可用性确保），作为 OCR 初始化的前置。实现与约定一致。

---

## 1. 约定

| 约定 | 说明 |
|------|------|
| **唯一入口** | 全项目仅在一处执行 CUDA 初始化：`CudaInitializer.run()`，由 `third_party.init_third_party_cnocr()` 在调用 `OcrInitializer.run()` 之前调用。 |
| **前置于 OCR** | OCR 初始化（ONNX 切换、HF 下载、cnocr 预热）假定 CUDA 已初始化；不再在 OCR 路径内打印 CUDA 信息或执行 ensure_onnx_cuda_usable。 |
| **单次执行** | 进程内只执行一次，由 `CudaInitializer._done` 守卫。 |
| **注入回调** | 由 third_party 注入 `print_cuda_prompt`、`run_pip_install`、`log`，不依赖 pyutils。 |

---

## 2. 职责

- **系统 GPU 信息**：调用 `print_cuda_prompt()`（即 `_print_cuda_support_prompt`），打印 nvidia-smi、驱动、GPU 数量等（见 PyTorch 文档）。
- **ORT 版本对齐**：在 ensure 前调用注入的 `run_ort_version_switch()`（即 `OcrInitializer._ensure_onnx_runtime_switch`），仅做 onnxruntime / onnxruntime-gpu 二选一（目标：OCR 使用 CUDA 12）；安装 gpu 时一律用 PyPI（CUDA 12），不切换至 ORT CUDA 11 源。
- **ORT CUDA 可用性**：若系统有 GPU，调用 `ensure_onnx_cuda_usable(run_pip_install, log)`（在首次 import onnxruntime 前 pip 安装**全部基础库**：onnxruntime-gpu[cuda,cudnn] + nvidia-cublas-cu12 + tensorrt-cu12，再 preload_dlls 并探测）。
- **设备行与提示**：打印 `[HF] Download/inference device: is_onnx_cuda_usable()=... -> GPU/CPU`；若系统有 GPU 但 ORT CUDA 不可用，打印黄色安装提示。

---

## 3. 调用关系

```
third_party.init_third_party_cnocr()
    -> _cuda_initializer.run()   # 唯一 CUDA 初始化
        -> print_cuda_prompt()
        -> run_ort_version_switch()   # onnxruntime / onnxruntime-gpu 二选一（gpu 用 PyPI CUDA 12）
        -> ensure_onnx_cuda_usable()
        -> 设备行 / 黄色提示
    -> _ocr_initializer.run()    # 再次 ONNX 切换（通常跳过）、HF 下载、cnocr 预热
```

其他模块（如 whisper、ultralytics）仅**查询** `CUDADetector.is_cuda_available()` 或 `is_onnx_cuda_usable()`，不执行“初始化”；初始化只在此路径。

---

## 4. OCR 使用 CUDA 12（完整基础库）

- **现象**：PyPI 的 onnxruntime-gpu 为 **CUDA 12.x**，依赖 `cublasLt64_12.dll`（cuBLAS）与 TensorRT EP 所需的 `nvinfer_10.dll`；前者不在 `onnxruntime-gpu[cuda,cudnn]` 内，后者需单独安装 `tensorrt-cu12`。若 PyTorch 为 CUDA 11，其 lib 中为 11 的 DLL，会与 ORT 冲突。
- **规范**：全项目 OCR 统一使用 **CUDA 12**，且**安装所有 ORT GPU 所需基础库**（不降级、不“可忽略”）：`onnxruntime-gpu[cuda,cudnn]`、`nvidia-cublas-cu12`、`tensorrt-cu12`。`ensure_onnx_cuda_usable` 在**首次 import onnxruntime 前**依次 pip 安装上述三项，再 preload_dlls 并探测。开发目标：满足所有基础类库，使 CUDA EP 与 TensorRT EP 均可正常加载。
- **preload**：当 PyTorch 为 11 时，`preload_dlls(directory="")` 仅从 nvidia site-packages 加载，避免加载 PyTorch 的 CUDA 11 DLL。见 <https://onnxruntime.ai/docs/install/>。

## 5. 参考链接

- PyTorch 本地安装（CUDA）：<https://pytorch.org/get-started/locally>
- ONNX Runtime 安装（含 CUDA 11 源）：<https://onnxruntime.ai/docs/install/>
- ONNX Runtime CUDA EP 要求：<https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements>
- cublasLt64_12.dll（nvidia-cublas-cu12）：<https://pypi.org/project/nvidia-cublas-cu12/>
- ORT preload_dlls（#23674）：<https://github.com/microsoft/onnxruntime/issues/23674>
- TensorRT EP 要求与 nvinfer：<https://onnxruntime.ai/docs/execution-providers/TensorRT-ExecutionProvider.html#requirements>
- tensorrt-cu12（PyPI）：<https://pypi.org/project/tensorrt-cu12/>

---

## 6. 相关代码位置

| 内容 | 文件 |
|------|------|
| **CUDA 初始化类** | `pycore/pyfoundations/cuda_initializer.py`（`CudaInitializer`） |
| 系统 GPU 检测 | `pycore/pyfoundations/cuda_detector.py`（`CUDADetector`） |
| ORT 能力与 ensure（完整 GPU 依赖：ORT + nvidia-cublas-cu12 + tensorrt-cu12；preload_dlls） | `pycore/pyfoundations/onnx_runtime_capability.py` |
| 入口与注入 | `pycore/pyfoundations/third_party.py`（`_cuda_initializer`、`init_third_party_cnocr`） |
| OCR 初始化（后继） | `pycore/pyfoundations/ocr_initializer.py`、见 [OCR_INIT.md](OCR_INIT.md) |
