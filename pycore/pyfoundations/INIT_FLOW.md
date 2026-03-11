# 项目内初始化相关代码一览

按规范集中初始化到最合适版本（CUDA/ORT 等）。全项目仅一处 CUDA 初始化；OCR 初始化依赖 CUDA 初始化完成后再执行。

---

## 1. 主入口与顺序

| 入口 | 文件 | 说明 |
|------|------|------|
| **init_third_party_cnocr()** | `third_party.py` | 统一入口：先 `_cuda_initializer.run()` 再 `_ocr_initializer.run()`；HF CLI 前置。全项目 CUDA 初始化只在此路径触发。 |

调用链：

```
init_third_party_cnocr()
  -> get_third_package_huggingface_hub() / _ensure_huggingface_cli_on_path()
  -> _cuda_initializer.run()
  -> _ocr_initializer.run()
```

---

## 2. CUDA / ORT 初始化（唯一）

| 组件 | 文件 | 说明 |
|------|------|------|
| **CudaInitializer** | `cuda_initializer.py` | 单次 run：print_cuda_prompt → run_ort_version_switch → ensure_onnx_cuda_usable → 设备行/黄色提示。 |
| **run_ort_version_switch** | `third_party.py`（注入） | 调用 `_ocr_initializer._ensure_onnx_runtime_switch()`，cpu/gpu 二选一；gpu 时安装 onnxruntime-gpu[cuda,cudnn]。 |
| **ensure_onnx_cuda_usable** | `onnx_runtime_capability.py` | 先 pip 安装完整 ORT GPU 基础库（onnxruntime-gpu[cuda,cudnn] + nvidia-cublas-cu12 + tensorrt-cu12），再首次 import onnxruntime 与 preload_dlls；满足 CUDA EP 与 TensorRT EP 所需 DLL。 |
| **CUDADetector** | `cuda_detector.py` | 仅查询：nvidia-smi、CUDA 环境变量；不执行安装或切换。 |
| **CPU/GPU 包选型** | `cpu_gpu_packages.py` | 全项目唯一：`get_ort_install_package()`、`get_cnocr_pip_package()` 等，决策依据 `CUDADetector.is_cuda_available()`。见 [CPU_GPU_PACKAGES.md](CPU_GPU_PACKAGES.md)。 |

---

## 3. OCR 初始化（依赖 CUDA 已初始化）

| 组件 | 文件 | 说明 |
|------|------|------|
| **OcrInitializer** | `ocr_initializer.py` | 单次 run：init_ocr_models_from_hf → 加载 cnocr → 预热 zh/en/cht。ONNX 切换仅在 CudaInitializer 中通过 run_ort_version_switch 执行一次。 |
| **_ensure_onnx_runtime_switch** | `ocr_initializer.py` | 由 run_ort_version_switch 调用（唯一调用点）：按 need_uninstall/need_install 卸载另一侧、安装目标（gpu 时用 onnxruntime-gpu[cuda,cudnn]）。 |
| **init_ocr_models_from_hf** | `ocr_hf_models.py` | 按 ocr_prewarm_spec 下载 CnSTD/CnOCR 模型。 |
| **get_cnocr_prewarmed** | `third_party.py` | 委托 `_ocr_initializer.get_prewarmed(lang)`。 |

---

## 4. 其他 ensure / 懒加载（非主 CUDA/OCR 初始化）

| 函数/逻辑 | 文件 | 说明 |
|-----------|------|------|
| **_ensure_torch_cuda_build_first** | `third_party.py` | 打印 CUDA 支持信息；仅在“系统有 GPU 且当前 torch 非 CUDA 构建”时尝试安装/重装 PyTorch CUDA；不负责 ORT。 |
| **ensure_huggingface_cli_prerequisite** | `third_party.py` | 确保 huggingface_hub 可用并将 CLI 加入 PATH。 |
| **_ensure_huggingface_cli_on_path** | `third_party.py` | 在 init_third_party_cnocr 中调用，前置于 CUDA/OCR init。 |
| **ensure_cnocr_loaded_and_engines_initialized** | `cnocr_engine_registry.py` | 调用 init_third_party_cnocr() 并 _ensure_cnocr_package_loaded()，供 general/general_en/general_cht 等引擎使用。 |
| **ensure_huggingface_hub** | `huggingface_hub_helper.py` | 懒加载/安装 huggingface_hub。 |
| **ensure_cnstd_models / ensure_cnocr_models** | `ocr_hf_models.py` | 按 spec 确保单模型存在；被 init_ocr_models_from_hf 使用。 |
| **PackageManager.ensure_packages / initialize_all_packages** | `pyutils/mcp_bridge_with_laravel/main.py` | MCP 桥接侧包管理与后台初始化；OCR 仍应通过 init_third_party_cnocr 走 CudaInitializer + OcrInitializer。 |
| **_initialize_ocr_engines** | `pyutils/mcp_bridge_with_laravel/main.py` | MCP 启动时初始化 PaddleOCR / CnOCR；若使用 cnocr 应依赖 init_third_party_cnocr 的预热结果。 |

---

## 5. 版本与规范

- **CUDA/ORT 版本**：以当前 PyTorch CUDA 主版本为准；PyTorch 11 → ORT 从 CUDA 11 feed 安装/重装；否则 PyPI（CUDA 12）+ nvidia-cublas-cu12。见 [CUDA_INIT.md](CUDA_INIT.md) §4、[OCR_INIT.md](OCR_INIT.md)。
- **MCP 规范**：MCP 相关模块遵循 `pycore/pyutils/mcp/MCP_CODING_STANDARDS.md`（日志、MCP 模式等）；初始化“到最合适版本”的逻辑在 pyfoundations（CudaInitializer、OcrInitializer、onnx_runtime_capability）中实现，third_party 为唯一入口。
