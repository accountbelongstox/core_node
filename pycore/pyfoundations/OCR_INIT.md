# OCR 初始化说明 (OCR Initialization)

本文档是 OCR（CnSTD/CnOCR）初始化的**唯一说明**：所有约定与实现一致，无冲突。

**前置**：**CUDA 初始化**为 OCR 初始化的前置；全项目仅有一处 CUDA 初始化（`CudaInitializer.run()`），在 `init_third_party_cnocr()` 中先于 `OcrInitializer.run()` 调用。初始化时按规范选最合适版本：根据当前 PyTorch CUDA 版本选择 ORT 源（PyTorch 11 → ORT CUDA 11 feed；否则 PyPI + nvidia-cublas-cu12），不对则自动切换。详见 [CUDA_INIT.md](CUDA_INIT.md)、[INIT_FLOW.md](INIT_FLOW.md)。

---

## 1. 必须满足的约定

| 约定 | 说明 |
|------|------|
| **CUDA 初始化前置** | OCR 初始化前必须先执行 CUDA 初始化（`CudaInitializer.run()`）。ONNX 切换、系统 GPU 信息、`ensure_onnx_cuda_usable()`、设备行与黄色提示均在 CUDA 初始化中完成；OCR 初始化仅做 HF 下载、cnocr 加载与预热。 |
| **third_party 不引入 pyutils** | `pycore.pyfoundations.third_party` 及 OCR 相关逻辑**不得** import `pycore.pyutils`，仅依赖 pyfoundations（如 color_print、cuda_detector、ocr_hf_models、ocr_prewarm_spec）。 |
| **加载并预热 中/英/繁体** | 初始化时加载 CnOCR 并预热三种语言：zh（简体）、en（英文）、cht（繁体）。 |
| **有 CUDA 时优先使用 GPU** | **下载/安装**仍按系统 GPU（`CUDADetector.is_cuda_available()`）选装 onnxruntime-gpu；**推理 context** 由 `is_onnx_cuda_usable()` 决定：仅当 ONNX Runtime 能成功创建 CUDA 会话时才使用 `context='gpu'`，否则回退 CPU，避免 cublasLt64_12.dll 等缺失导致的 EP 报错。 |
| **默认 v5 版** | 中文使用 ch_PP-OCRv5_det / ch_PP-OCRv5（GPU 下用 ch_PP-OCRv5_det_server / ch_PP-OCRv5_server），与 CnOCR 官方默认一致。 |
| **有 V5+ 就不下别的** | 下载范围由 `ocr_prewarm_spec` 唯一决定：zh 只含 V5（及 server），en/cht 只含各自最新；**spec 未列出的模型一律不下载**（不下载 zh 的 v4/v3 等旧版）。 |
| **单次初始化** | 下载与预热在进程内只执行一次，由守卫避免重复。 |
| **按需切换 ONNX 版本** | 由 `CudaInitializer.run()` 内 `run_ort_version_switch()` 调用 `OcrInitializer._ensure_onnx_runtime_switch()`，用 `pip show` 检测；无须切换时跳过；需要时仅卸载另一侧、安装目标（gpu 用 onnxruntime-gpu[cuda,cudnn]），有变更时清除 cnocr 缓存。 |

---

## 2. GPU 与 CPU 互斥 + 初始化前清空另一版本（官方）

- **出处**：CnOCR 安装说明 <https://cnocr.readthedocs.io/zh-cn/stable/install/>
- **结论**：默认的 `onnxruntime` 仅支持 CPU；要用 GPU，需**先卸载** `onnxruntime`，再安装 `onnxruntime-gpu`。即 **GPU 版与 CPU 版二选一，不可同时安装**。
- **本项目**：安装仍按系统 GPU（`CUDADetector.is_cuda_available()`）选 onnxruntime-gpu 或 onnxruntime；**预热与推理的 context 由 `is_onnx_cuda_usable()` 决定**，ORT 无法加载 CUDA 时自动回退 CPU，避免报错。
- **ONNX Runtime GPU 要求**（<https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements>）：PyPI 的 onnxruntime-gpu 自 1.19 起默认 **CUDA 12.x + cuDNN 9.x**；Windows 需将 CUDA 的 `bin`、cuDNN 的 `bin` 加入 PATH，或通过 pip 安装 NVIDIA 运行时。
- **cublasLt64_12.dll 缺失原因**：`onnxruntime_providers_cuda.dll` 依赖 **cuBLAS**（cublasLt64_12.dll）。PyPI 上 onnxruntime-gpu 的 `[cuda,cudnn]` 可选依赖**不包含** nvidia-cublas-cu12（仅含 nvidia-cuda-runtime-cu12、nvidia-cudnn-cu12 等），故需单独安装：`pip install nvidia-cublas-cu12`。见 <https://pypi.org/project/nvidia-cublas-cu12/>。
- **尽可能确保能使用 GPU**：ensure_onnx_cuda_usable() 在**首次 import onnxruntime 前**先执行 `pip install onnxruntime-gpu[cuda,cudnn]` 与 `nvidia-cublas-cu12`，再 preload_dlls 与探测；PyTorch 为 CUDA 11 时仅从 nvidia site-packages 加载（见 [CUDA_INIT.md](CUDA_INIT.md) §4），全部失败后才回退 CPU。
- **PyTorch CUDA 11 与 ORT CUDA 12**：若本机为 PyTorch cu118，PyPI 的 onnxruntime-gpu 为 CUDA 12，DLL 不兼容会报 "Failed to load cublasLt64_12.dll"。可选：安装 nvidia-cublas-cu12 等用 ORT 12，或改装 onnxruntime-gpu 的 CUDA 11 源。见 [CUDA_INIT.md](CUDA_INIT.md) §4。
- **按需切换 ONNX 版本**：在 CUDA 初始化中由 `run_ort_version_switch()` 调用 `_ensure_onnx_runtime_switch()`，用 `pip show` 检测；无须切换时跳过；需要时仅卸载/安装目标（gpu 用 onnxruntime-gpu[cuda,cudnn]），有变更才清 cnocr 缓存。

---

## 3. 从 HF Collection 直接拿「最新」的用法

### 3.1 页面与列表来源

- 用户集合首页：<https://huggingface.co/breezedeus/collections>
- CnOCR 集合：<https://huggingface.co/collections/breezedeus/cnocr>
- CnSTD 集合：<https://huggingface.co/collections/breezedeus/cnstd>
- 列表来源：`HfApi.get_collection(collection_slug)` 取集合内容；文档：<https://huggingface.co/docs/huggingface_hub/en/package_reference/collections>

### 3.2 「最新」的含义

- 不传 `revision` 或传 `revision="main"`，即该分支当前最新提交。
- 单文件：`hf_hub_download(repo_id, filename, revision="main")`
- 整仓：`snapshot_download(repo_id, local_dir=..., revision="main")`

### 3.3 项目内封装（huggingface_hub_helper.py）

| 函数 | 作用 |
|------|------|
| **hf_get_collection_models(collection_slug)** | 入参：集合短 slug，如 `"breezedeus/cnocr"`、`"breezedeus/cnstd"`。内部调用 `HfApi.get_collection(collection_slug)`，只保留 `item_type=="model"` 的项。返回：该 collection 内所有模型的 `repo_id` 列表（如 `breezedeus/cnocr-ppocr-ch_PP-OCRv5`）。 |
| **hf_download_repo_latest(repo_id, local_dir, allow_patterns=..., revision=...)** | 用 `revision=None` 或 `"main"` 拉取该 repo 当前最新版本到 `local_dir`；可选 `allow_patterns` 只下部分文件（如 `["*.onnx", "*.yaml"]`）。 |

当前 OCR 下载由 **ocr_prewarm_spec** 驱动，如需改为「从 collection 动态取 repo 列表」可在此之上再接一层，用 `hf_get_collection_models("breezedeus/cnocr")` / `"breezedeus/cnstd"` 与 spec 结合或替换部分列表。

---

## 4. 架构：单一数据源 + 下载与预热

### 4.1 模块关系

```
cuda_initializer.py    CudaInitializer：全项目唯一 CUDA 初始化（系统 GPU 信息 + ensure_onnx_cuda_usable + 设备行/黄色提示）
        │
onnx_runtime_capability.py  is_onnx_cuda_usable()、ensure_onnx_cuda_usable()：供 CudaInitializer 与 OCR 使用
        │
ocr_prewarm_spec.py    单源：zh/en/cht 各语言「最新」模型及 HF 来源（repo/zip）
        │
        ├──► ocr_hf_models.py    按 spec 从 HF 下载（单仓 repo + 合集 zip）
        │
        ├──► ocr_initializer.py  初始化类（CUDA/ONNX 切换已由 CudaInitializer 完成）：下载 -> 预热（context 用 is_onnx_cuda_usable）
        │
        └──► third_party.py      先 _cuda_initializer.run() 再 _ocr_initializer.run()；唯一入口 init_third_party_cnocr()；不引用 pyutils
```

- **cuda_initializer**：**全项目唯一 CUDA 初始化**。职责：① 打印系统 GPU 信息（`print_cuda_prompt`）；② 系统有 GPU 时调用 `ensure_onnx_cuda_usable(run_pip_install, log)`；③ 打设备行；④ 若 ORT CUDA 不可用则打黄色提示。详见 [CUDA_INIT.md](CUDA_INIT.md)。
- **onnx_runtime_capability**：提供 `is_onnx_cuda_usable()`（探测并缓存）、`clear_onnx_cuda_usable_cache()`、**`ensure_onnx_cuda_usable(run_pip_install, log)`**。ensure 在**首次 import onnxruntime 前**先 pip 安装 [cuda,cudnn] 与 nvidia-cublas-cu12，再 preload_dlls 与探测，全部失败后才回退 CPU。
- **ocr_prewarm_spec**：定义 `PREWARM_SPEC`（每语言 det/rec、repos、zips）、`prewarm_det_rec_for_lang(lang, use_gpu)` 等。**「下载什么」「预热用哪个模型」只由此推导，有 V5+ 就不下别的 = spec 只列 V5 与各语言最新。**
- **ocr_hf_models**：仅根据 spec 的并集（`all_cnstd_repos()`、`all_cnocr_repos()`、`all_cnstd_zips()`、`all_cnocr_zips()`）下载，无额外分支。
- **ocr_initializer**：**OCR 初始化类**（假定 CUDA 已初始化）。职责：① 调用 `init_ocr_models_from_hf()`；② 加载 cnocr；③ 预热 context 用 `is_onnx_cuda_usable()`。ONNX 切换由 CudaInitializer 中的 run_ort_version_switch 完成。由 third_party 注入各回调。
- **third_party**：先调用 `_cuda_initializer.run()`（唯一 CUDA 初始化），再调用 `_ocr_initializer.run()`；`get_cnocr_prewarmed(lang)` 委托给 `_ocr_initializer.get_prewarmed(lang)`。

### 4.2 初始化顺序

1. 调用 `init_third_party_cnocr()`（如由 `cnocr_engine_registry.ensure_cnocr_loaded_and_engines_initialized()` 或首次使用 general 引擎触发）。
2. **CUDA 初始化**（全项目唯一）：`_cuda_initializer.run()`。若已执行过则直接返回（由 `CudaInitializer._done` 保证）。内容：打印系统 GPU 信息；若系统有 GPU 则 `ensure_onnx_cuda_usable()`；打设备行；若 ORT CUDA 不可用则打黄色提示。
3. **OCR 初始化**：`_ocr_initializer.run()`。若已执行过则直接返回（由 `OcrInitializer._done` 保证）。
4. **按需切换 ONNX 版本**：在 CudaInitializer.run() 中通过 run_ort_version_switch() 调用 `_ensure_onnx_runtime_switch()`；`_need_onnx_runtime_switch()` 用 `pip show`（注入的 `is_pip_package_installed`）检测；若目标已激活则跳过；否则仅当另一版本已安装时 uninstall、仅当目标未安装时 install（gpu 用 onnxruntime-gpu[cuda,cudnn]），有变更时清除 cnocr 缓存。
5. `init_ocr_models_from_hf(...)` 按 spec 下载。
6. 加载 cnocr；预热时 **use_gpu = is_onnx_cuda_usable()**，对 zh/en/cht 用 `prewarm_det_rec_for_lang(lang, use_gpu)` 创建 `CnOcr(..., context=ctx)`（ctx=gpu 仅当 use_gpu 为 True），写入 prewarmed 缓存；外部通过 `get_cnocr_prewarmed(lang)` 获取。

---

## 5. 各语言「最新」与来源（与官方一致）

- **CnOCR 使用说明** <https://cnocr.readthedocs.io/zh-cn/stable/usage/>：`det_model_name` 默认 `ch_PP-OCRv5_det`，`context` 可为 `cpu`/`gpu`/`cuda`。
- **可用模型** <https://cnocr.readthedocs.io/zh-cn/stable/models/>：v5 det/rec、v5_server（GPU 更大模型）、en/繁体模型名称与下表一致。

| 语言 | 检测 (det) | 识别 (rec) | 来源 |
|------|------------|------------|------|
| **zh** | ch_PP-OCRv5_det（GPU 用 ch_PP-OCRv5_det_server） | ch_PP-OCRv5（GPU 用 ch_PP-OCRv5_server） | 单仓 HF repo |
| **en** | en_PP-OCRv3_det | en_PP-OCRv4（备选 en_PP-OCRv3） | 单仓 HF repo |
| **cht** | ch_PP-OCRv3_det | chinese_cht_PP-OCRv3 | 合集 zip（cnstd-cnocr-models） |

- CnSTD 路径：`~/.cnstd`（Windows: `%APPDATA%\cnstd`），模型在 `1.2/ppocr/<model_name>/`。
- CnOCR 路径：`~/.cnocr`（Windows: `%APPDATA%\cnocr`），模型在 `2.3/ppocr/<model_name>/`。

---

## 6. 下载策略（与「有 V5+ 就不下别的」一致）

- **单仓 repo**：仅下载 spec 中列出的 repo（`all_cnstd_repos()` / `all_cnocr_repos()`），每个 repo 拉取 `.onnx` 与 `config.yaml` 到上述路径。
- **合集 zip**：仅下载 spec 中列出的 zip（`all_cnstd_zips()` / `all_cnocr_zips()`）作为 allowlist，从 `breezedeus/cnstd-cnocr-models` 对应子目录下载并解压。
- **不下 spec 外内容**：zh 只含 V5（及 server），不下载 zh 的 v4/v3；en/cht 只含各自最新。因此「有 V5+ 就不下别的」由 spec 唯一保证，无需额外开关。

---

## 7. 预热策略

- **context**：`is_onnx_cuda_usable()` 为 True 时 `ctx='gpu'`，否则 `'cpu'`（CUDA 初始化已确保 ORT 可用性）。
- **每语言**：`prewarm_det_rec_for_lang(lang, use_gpu)` 给出 det 与 rec 尝试顺序；zh 在 use_gpu 时优先 _server。按 rec_order 依次创建 `CnOcr(det_model_name=..., rec_model_name=..., context=ctx)`，第一个成功即写入 `_CNOCR_PREWARMED[lang]`。

---

## 8. 参考链接

- CnOCR 安装（GPU/CPU 互斥）：<https://cnocr.readthedocs.io/zh-cn/stable/install/>
- CnOCR 模型列表：<https://cnocr.readthedocs.io/zh-cn/stable/models/>
- CnOCR 使用：<https://cnocr.readthedocs.io/zh-cn/stable/usage/>
- HF Collections 文档：<https://huggingface.co/docs/huggingface_hub/en/package_reference/collections>
- HF breezedeus 集合：<https://huggingface.co/breezedeus/collections>，CnOCR <https://huggingface.co/collections/breezedeus/cnocr>，CnSTD <https://huggingface.co/collections/breezedeus/cnstd>
- HF 合集仓库：<https://huggingface.co/breezedeus/cnstd-cnocr-models>
- ONNX Runtime CUDA EP 与要求（CUDA 12.x、cuDNN 9.x、PATH、preload_dlls、[cuda,cudnn] 安装）：<https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html>，Requirements：<https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements>
- cublasLt64_12.dll 来自 nvidia-cublas-cu12（[cuda,cudnn] 不包含）：<https://pypi.org/project/nvidia-cublas-cu12/>
- ORT preload_dlls 与 Windows 下先加载 DLL 再探测（#23674）：<https://github.com/microsoft/onnxruntime/issues/23674>
- CUDA Windows 安装指南：<https://docs.nvidia.com/cuda/cuda-installation-guide-microsoft-windows/>

---

## 9. 相关代码位置

| 内容 | 文件 |
|------|------|
| **CUDA 初始化**（全项目唯一；前置于 OCR） | `pycore/pyfoundations/cuda_initializer.py`（`CudaInitializer`）、[CUDA_INIT.md](CUDA_INIT.md) |
| 单源 spec（zh/en/cht 最新；有 V5+ 就不下别的由 spec 保证） | `pycore/pyfoundations/ocr_prewarm_spec.py` |
| HF 下载（按 spec 并集） | `pycore/pyfoundations/ocr_hf_models.py` |
| **ORT 能力检测**（推理是否用 GPU） | `pycore/pyfoundations/onnx_runtime_capability.py`（`is_onnx_cuda_usable()`） |
| **OCR 初始化类**（下载 + 预热，context 依 is_onnx_cuda_usable；ONNX 切换在 CUDA 初始化中） | `pycore/pyfoundations/ocr_initializer.py`（`OcrInitializer`） |
| Collection 取模型列表 / 按 repo 拉最新 | `pycore/pyfoundations/huggingface_hub_helper.py`（`hf_get_collection_models`、`hf_download_repo_latest`） |
| 入口与注入（不引 pyutils）：先 CudaInitializer.run() 再 OcrInitializer.run()、pip/clear cnocr、get_cnocr_prewarmed | `pycore/pyfoundations/third_party.py`（`_cuda_initializer`、`_ocr_initializer`、`_print_cuda_support_prompt`、`init_third_party_cnocr`） |
| 调用方（直接使用预热好的模型） | `pycore/pyutils/cnocr_engine_registry.py` 通过 `get_cnocr_prewarmed("zh"/"en"/"cht")` 取已预热实例，构造 `CnOCREngine(prewarmed_instance=...)` 不再重复 init；`ocr_cnocr_engine.CnOCREngine` 支持 `prewarmed_instance` 时跳过 init、直接调用底层 CnOcr。 |
