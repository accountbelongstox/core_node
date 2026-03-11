# D3Check 启动后内存占用报告

本文档基于代码与公开资料，估算 `python main.py` 启动完成（GUI 就绪、定时器已开）后的**进程内存（RAM）**与**显存（GPU VRAM）**占用，并按模块拆分主要消耗来源。

---

## 1. 总览估算

| 类型 | 估算范围 | 说明 |
|------|----------|------|
| **进程 RAM** | **约 800 MB ~ 1.5 GB** | 含 Python 解释器、依赖库、业务数据与 UI |
| **GPU VRAM** | **约 1.2 GB ~ 2.0 GB** | 主要为 ONNX Runtime (CnOCR) 多语言模型 + CUDA 缓存 |

实际值随机器、驱动、首次/二次启动及 nvidia-smi 与任务管理器统计方式会有波动；上述为“启动完成后相对稳定”的粗略量级。

---

## 2. 启动流程与模块加载顺序（与内存关系）

入口与初始化链（仅列与内存强相关步骤）：

1. **main.py** → `get_system_initializer().initialize_system(gui_mode=True)`  
   - 见 `pyapps/d3-check/main.py`  
2. **SystemInitializer** → 配置 → **CnOCR 加载与预热** → 热键 → 定时器/任务线程  
   - 见 `d3utils/system_initializer.py`（`initialize_configuration` → `ensure_cnocr_loaded_and_engines_initialized` → `initialize_hotkeys` → `initialize_timer_system`）  
3. **D3MacroController** → GameInterfaceController、HTTP Bridge、**Diablo3MacroUI**（TK 主窗 + 5 个 Tab 面板）  
   - 见 `controller/d3_macro_controller.py`、`ui/diablo3_macro_ui.py`  

下面按“谁占内存”分块说明。

---

## 3. 各模块内存占用拆分

### 3.1 Python 解释器与基础运行时（RAM）

- **量级**：约 50–80 MB（仅解释器 + 常用 stdlib）。  
- **说明**：进程一启动即存在；随后续 `import` 增加。  
- **参考**：Python 进程基线（无大型库）通常在数十 MB 级；见 [Python memory management](https://devguide.python.org/internals/memory-management/) 等。

### 3.2 数据库与配置（RAM）

- **涉及**：`DatabaseManager`（common.db、speech.db）、`TableRegistry`、`GlobalConfig`、`CONFIG` 与单例配置加载。  
- **量级**：约 5–20 MB（SQLite 连接 + 缓存 + 配置字典与合并结果）。  
- **代码**：  
  - 数据库/表注册：`pycore/database`、启动日志中的 `[DatabaseManager]`、`[TableRegistry]`。  
  - 配置：`providor/providor_index.py`、`initialize_config`、模板与用户配置合并。

### 3.3 CnOCR + ONNX Runtime（RAM + **GPU VRAM**）

- **职责**：启动时通过 `ensure_cnocr_loaded_and_engines_initialized()` 拉取/校验模型并 **prewarm 三个语言（zh / en / cht）**，每个语言一个 CnOcr 实例（det + rec 两个 ONNX 模型）。  
- **代码**：  
  - 入口：`d3utils/system_initializer.py` 中调用 `ensure_cnocr_loaded_and_engines_initialized()`；  
  - 实现：`pycore/pyutils/cnocr_engine_registry.py`（`ensure_cnocr_loaded_and_engines_initialized`、prewarmed zh/en/cht）；  
  - 预热与模型规格：`pycore/pyfoundations/ocr_initializer.py`（`_prewarm`）、`ocr_prewarm_spec.py`（`prewarm_det_rec_for_lang`）；  
  - 模型下载：`pycore/pyfoundations/ocr_hf_models.py`、Hugging Face 缓存（CnSTD/CnOCR）。  

**模型与显存（典型）**：

- zh：det = ch_PP-OCRv5_det_server（约 84 MB 文件），rec = ch_PP-OCRv5_server（约 81 MB）；  
- en：det = en_PP-OCRv3_det（约 2.3 MB），rec = en_PP-OCRv4（约 8.6 MB）；  
- cht：det = ch_PP-OCRv3_det（约 2.3 MB），rec = chinese_cht_PP-OCRv3（约 11 MB）。  

ONNX Runtime 加载模型时会分配 GPU 显存用于权重与推理缓存；多 Session（3 语言 × 2 模型 = 6 个 det/rec 图）共享 CUDA EP，但各自占显存。  

- **RAM**：约 100–200 MB（Python 侧 cnocr/rapidocr、onnxruntime 绑定、模型路径与配置、HF 缓存元数据等）。  
- **GPU VRAM**：**约 0.8–1.5 GB**（权重 + 运行时 arena；ORT 使用 CUDA 缓存分配器，`nvidia-smi` 可能显示为“已预留”）。  
- **参考**：  
  - [ONNX Runtime CUDA EP](https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html)（gpu_mem_limit、arena 等）；  
  - [CnOCR 模型列表](https://github.com/breezedeus/cnocr)（det/rec 模型大小）。

### 3.4 PyTorch（torch）与 CUDA 运行时（RAM + GPU VRAM）

- **用途**：本应用主要用 ONNX Runtime 做 OCR，但环境中已 `import torch`（例如 ultralytics、部分 pycore 能力），会初始化 CUDA 上下文。  
- **RAM**：约 80–150 MB（torch 库与 CUDA 主机端结构）。  
- **GPU VRAM**：约 200–400 MB（CUDA context、cuBLAS/cuDNN 等缓存；PyTorch 使用 caching allocator，未分配 tensor 时也会预留块）。  
- **参考**：  
  - [PyTorch CUDA semantics – Memory management](https://pytorch.org/docs/stable/notes/cuda.html#memory-management)；  
  - [torch.cuda memory_allocated / memory_reserved](https://pytorch.org/docs/stable/cuda.html#memory-management)。

### 3.5 Tkinter GUI（RAM）

- **涉及**：`Diablo3MacroUI`（`tk.Tk()`）、TitleBar、MenuBar、BottomBar、MacroControls、SystemTray、5 个 Tab（MainFunctionsPanel、LogPanel、RosbotExtensionPanel、D4Panel、CoordinateCalibrationPanel）。  
- **代码**：`ui/diablo3_macro_ui.py`、`ui/components/`、`ui/panels/`。  
- **量级**：约 30–80 MB（Tk 运行时、控件树、主题/样式、少量图标与 PIL 图像对象）。  
- **说明**：Tk 本身较轻；若面板内存在大列表或图像缓存会再增加。

### 3.6 游戏接口与截图/模板匹配（RAM）

- **涉及**：`GameInterfaceController`、`WindowScreenshot`、`D3ScaledTemplateMatcher`、`GameWindowDetector`（锚点模板）、`ScreenshotProvider`。  
- **代码**：`controller/game_interface_controller.py`、相关 share 与 pycore 截图/匹配实现。  
- **量级**：约 20–50 MB（模板图像、窗口/屏幕缓冲、匹配缓存）。

### 3.7 D4 相关（RAM）

- **涉及**：`D4Controller`、`D4WindowRegionDetector`、`D4TeamHealthDetector`、`D4SmallMapDetector`、`ImageAnnotator`、`ExpFarmingManager` 等。  
- **代码**：`controller/d4_controller.py`、D4 面板与 detector 等。  
- **量级**：约 20–60 MB（配置、模板图、检测器状态与缓存）。

### 3.8 HTTP Bridge 与 Web 栈（RAM）

- **涉及**：`HTTPBridgeController`、Werkzeug/Flask 风格服务器（端口 8765）。  
- **代码**：`controller/http_bridge_controller.py`。  
- **量级**：约 10–30 MB（服务器栈、路由表、请求缓冲）。

### 3.9 热键、定时器、任务线程与事件中心（RAM）

- **涉及**：`HotkeyListener`、`GlobalHotkeyManager`、`timer_manager`、`TaskThreadManager`（如 rosbot_task）、`event_center`、`ThreadRegistry`、`LogMonitorThread`。  
- **代码**：`d3utils/system_initializer.py`、`timers/`、`d3utils/event_center.py`、`runtime`、lifecycle。  
- **量级**：约 5–15 MB（线程栈、队列、回调表、定时器结构）。

### 3.10 其他依赖与杂项（RAM）

- **涉及**：numpy、PIL、opencv、i18n JSON、CONFIG 绑定、路径扫描缓存、日志缓冲等。  
- **量级**：约 50–150 MB（视 numpy/OpenCV 使用与缓存大小而定）。

---

## 4. 汇总表（按模块）

| 模块 | 主要占用类型 | 估算量级 |
|------|--------------|----------|
| Python 解释器 + 基础运行时 | RAM | 50–80 MB |
| 数据库 + 配置 | RAM | 5–20 MB |
| CnOCR + ONNX Runtime（3 语言 prewarm） | RAM + **GPU** | RAM 100–200 MB，**GPU 0.8–1.5 GB** |
| PyTorch + CUDA 运行时 | RAM + GPU | RAM 80–150 MB，GPU 200–400 MB |
| Tkinter GUI（主窗 + 5 面板 + 托盘） | RAM | 30–80 MB |
| 游戏接口与截图/模板匹配 | RAM | 20–50 MB |
| D4 相关逻辑与检测器 | RAM | 20–60 MB |
| HTTP Bridge | RAM | 10–30 MB |
| 热键 / 定时器 / 任务线程 / 事件中心 | RAM | 5–15 MB |
| 其他（numpy/PIL/OpenCV/i18n/缓存等） | RAM | 50–150 MB |

---

## 5. 如何自行测量（建议）

- **进程 RAM**：  
  - Windows：任务管理器 → 详细信息 → 选择 `python.exe`，看“工作集”或“专用工作集”。  
  - 或使用 `psutil.Process().memory_info().rss` 在启动完成后打点采样。  
- **GPU VRAM**：  
  - `nvidia-smi` 查看对应进程的显存占用。  
  - 若需更细：PyTorch 用 `torch.cuda.memory_allocated()` / `memory_reserved()`；ONNX Runtime 无统一 Python API，以 nvidia-smi 为主。  
- **可选**：在 `controller.run()` 进入主循环后、或 `start_timer_loop_after_ui_ready()` 之后加一次 `psutil` + 日志，便于对比本报告与实机差异。

---

## 6. 参考资料（网络检索）

- PyTorch CUDA 内存管理：https://pytorch.org/docs/stable/notes/cuda.html#memory-management  
- torch.cuda 内存接口：https://pytorch.org/docs/stable/cuda.html#memory-management  
- ONNX Runtime CUDA Execution Provider：https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html  
- CnOCR 模型与仓库：https://github.com/breezedeus/cnocr  

以上为基于代码结构与公开文档的估算；实际占用以本机测量为准。
