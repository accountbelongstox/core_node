# D3-Check 按需加载与启动内存优化

基于实际代码追踪的库加载链与按需加载方案，用于减小启动后 APP 内存占用。每个结论均对应具体文件与行号。

---

## 1. 当前启动时必然加载的重库（按触发顺序）

### 1.1 第三方依赖检查与 torch

| 库 | 首次加载位置 | 触发链 |
|----|--------------|--------|
| **torch** | `pycore/pyfoundations/third_party.py` | 模块底部（约 739 行）执行 `check_and_install_dependencies()` → 约 607 行 `_ensure_torch_cuda_build_first()`，在“列出已安装包”之前就加载/检查 torch。 |

- **触发时机**：任意代码第一次 `from pycore.pyfoundations.third_party import ...` 时（例如 `game_interface_data`、`providor_index`、`ColorPrint` 等）。
- **结论**：torch 在首轮 third_party 使用时就加载，早于 CnOCR 显式初始化。

### 1.2 PIL / numpy / OpenCV (cv2)

| 库 | 文件 | 行为 |
|----|------|------|
| **PIL** | `pyapps/d3-check/providor/providor_index.py` 第 15–20 行 | 模块顶层 `Image = get_third_package_PIL_Image()` 等，一旦 `providor_index` 被 import 即加载 PIL。 |
| **numpy, cv2, PIL** | `pyapps/d3-check/share/game_interface_data.py` 第 21–27 行 | 模块顶层 `numpy = get_third_package_numpy()`, `cv2 = get_third_package_cv2()`, `Image = get_third_package_PIL_Image()`，一旦 `game_interface_data` 被 import 即加载。 |

- **触发链**：`main` → `D3MacroController` → … → `get_game_interface_data` / `share.game_interface_data`；config 相关逻辑 → `providor_index`。两处均在控制器/配置初始化阶段即执行，早于 UI 或 OCR 首次使用。

### 1.3 Database (SQLite / SQLAlchemy) 与 GlobalConfig / SpeechConfig

| 库/组件 | 文件 | 行为 |
|---------|------|------|
| **pycore.database** | `pycore/database/__init__.py` | 导入时加载 SQLAlchemy、DatabaseManager、TableRegistry 等。 |
| **GlobalConfig / SpeechConfig** | `pycore/pyutils/common/global_config.py` 第 358 行、`speech_config.py` 第 370 行 | 模块底层单例：`global_config = GlobalConfig()`、`speech_config = SpeechConfig()`，构造时调用 `get_database_manager()`，触发 database 与表加载。 |
| **common 包** | `pycore/pyutils/common/__init__.py` 第 43–51 行 | 顶层 `from ... global_config import GlobalConfig, global_config` 与 `from ... speech_config import SpeechConfig, speech_config`。 |

- **触发链**：d3-check 中任意 `from pycore.pyutils.common.xxx import Y`（例如 `from pycore.pyutils.common.window_finder import WindowFinder`）会先执行 `pycore.pyutils.common` 的 `__init__.py`，从而加载 `global_config` / `speech_config` 模块并创建单例，进而加载 database。
- **使用 window_finder 的 d3-check 文件**（会间接拉齐 database）：
  - `controller/login_try_screenshot_controller.py`
  - `ui/panels/coordinate_calibration_panel.py`
  - `timers/one_shot_tasks.py`
  - `d3utils/battlenet_manager.py`
  - `d3utils/rosbot_flow/flow_c_d3_direct.py`
  - `d3utils/screenshot_provider.py`
  - `d3utils/window_resizer.py`
  - `d3utils/d3_manager.py`
  - 等。

因此：**只要用到 common 下的 window_finder（或 browser_window_detector），当前结构下就会在启动路径上加载 database。**

### 1.4 CnOCR / ONNX / HuggingFace

| 库/组件 | 文件 | 行为 |
|---------|------|------|
| **CnOCR 初始化** | `pyapps/d3-check/d3utils/system_initializer.py` 第 215 行 | `initialize_system()` 中无条件调用 `ensure_cnocr_loaded_and_engines_initialized()`。 |
| **实现** | `pyapps/d3-check/d3utils/cnocr_engine_registry.py` → `pycore/pyutils/cnocr_engine_registry.py` | 委托 pycore 的 `init_third_party_cnocr()`。 |
| **pycore 入口** | `pycore/pyfoundations/third_party.py` 第 1343–1355 行 `init_third_party_cnocr()` | 依次：`get_third_package_huggingface_hub()`、`_cuda_initializer.run()`（含 ONNX 切换/检查）、`_ocr_initializer.run()` → 拉取 HF 模型、加载 cnocr、预热 zh/en/cht 引擎。 |

- **结论**：在系统初始化阶段就完整拉齐 HuggingFace、ONNX、CnOCR 及多语言引擎，即使用户未使用 OCR 功能。

### 1.5 Ultralytics (YOLO)

| 库 | 文件 | 行为 |
|----|------|------|
| **ultralytics** | `pyapps/d3-check/d3utils/collectors/ui_region_collector_ultralytics.py` 第 15、30–32 行 | 顶层 `get_third_package_ultralytics()` 并 `YOLO = _ultralytics.YOLO ...`。 |
| **collectors 包** | `pyapps/d3-check/d3utils/collectors/__init__.py` 第 17 行 | 顶层 `from .ui_region_collector_ultralytics import UIRegionCollectorUltralytics`。 |

- **触发链**：`main` → `D3MacroController` → `GameInterfaceController` → `GameAssistantController` → `d3utils/interface_manager.py` 第 24–27 行 `from d3utils.collectors import UIRegionCollectorOptimized, ...` → 加载 `d3utils.collectors` → 加载 `ui_region_collector_ultralytics` → 加载 ultralytics（及依赖的 torch）。
- **结论**：YOLO/ultralytics 在控制器初始化时即加载，并非仅在“标定/训练”页打开时才加载。

---

## 2. 按需加载方案（库 → 文件 → 实现方式）

### 2.1 CnOCR / ONNX / 多语言引擎

- **库**：cnocr、onnxruntime、huggingface_hub、预热的 zh/en/cht 引擎。
- **当前**：`d3utils/system_initializer.py` 第 215 行在 `initialize_system()` 中无条件调用 `ensure_cnocr_loaded_and_engines_initialized()`。
- **建议**：
  - 从 `SystemInitializer.initialize_system()` 中**移除**对 `ensure_cnocr_loaded_and_engines_initialized()` 的调用。
  - 在 **pycore** 的 cnocr engine 注册表（例如 `pycore/pyutils/cnocr_engine_registry.py`）中，在 `get_cnocr_engine_default()`、`get_cnocr_engine_by_model_key()` 等**首次被调用时**再执行一次 `init_third_party_cnocr()`（若尚未初始化），并保持现有预热与模型键逻辑。
- **效果**：未使用 OCR（如未进 D4 地图名、未用路径规划 OCR 等）时，不加载 CnOCR/ONNX/HF 模型，显著降低启动内存与时间。

### 2.2 torch 不在首屏依赖检查时加载

- **库**：torch。
- **当前**：`pycore/pyfoundations/third_party.py` 中 `check_and_install_dependencies()`（约 601–730 行）在模块首次被使用时就执行，且其中约 607 行调用 `_ensure_torch_cuda_build_first()`，导致 torch 提前加载。
- **建议**：
  - 将 `_ensure_torch_cuda_build_first()` 从 `check_and_install_dependencies()` 中移出。
  - 仅在“真正依赖 torch 的包”首次被请求时执行（例如在 `init_third_party_cnocr()` 或 `get_third_package_ultralytics()` / `get_third_package_cnocr()` 的首次调用路径中）执行一次 torch 检查/安装。
- **效果**：不依赖 torch 的启动路径（例如仅用 Tk、配置、热键）不再加载 torch，进一步减小内存。

### 2.3 Database / GlobalConfig / SpeechConfig 与 common 解耦

- **库**：SQLAlchemy、pycore.database、GlobalConfig、SpeechConfig。
- **当前**：`pycore/pyutils/common/__init__.py` 顶层导入 `global_config`、`speech_config` 模块，其模块级单例在 import 时即调用 `get_database_manager()`，从而拉齐 database。
- **建议**（二选一或组合）：
  - **方案 A**：在 `pycore/pyutils/common/__init__.py` 中**不再**在顶层 `from ... global_config import ...` / `from ... speech_config import ...`。改为按需：例如对外暴露 `get_global_config()` / `get_speech_config()` 函数，在函数内部再 `import ... global_config` / `... speech_config` 并返回单例。这样仅 `from pycore.pyutils.common.window_finder import WindowFinder` 时不会执行 global_config/speech_config 的 import，database 不会在此时加载。
  - **方案 B**：将 `WindowFinder`、`BrowserWindowDetector` 等与“数据库配置”无关的组件挪到不依赖 common 的包（例如 `pycore.pyutils.window_finder`），d3-check 只从新路径 import，避免触发 `common/__init__.py`。
- **效果**：仅使用 window_finder / browser_window_detector 的 d3-check 启动路径不再加载 database 与 GlobalConfig/SpeechConfig，减少内存与 I/O。

### 2.4 PIL / numpy / cv2 延后到首次使用

- **库**：Pillow、numpy、opencv-python。
- **当前**：
  - `providor/providor_index.py` 第 15–20 行模块级调用 `get_third_package_PIL_Image()` 等。
  - `share/game_interface_data.py` 第 21–27 行模块级调用 `get_third_package_numpy()`、`get_third_package_cv2()`、`get_third_package_PIL_Image()`。
- **建议**：
  - **providor_index**：不在模块顶层保存 `Image`/`ImageDraw`/`ImageFont`；在具体使用到这些对象的函数内部调用 `get_third_package_PIL_Image()` 等并缓存到模块级仅当首次使用（或通过已有 getter 封装）。
  - **game_interface_data**：不在模块顶层绑定 `numpy`/`cv2`/`Image`；在真正需要的地方（如截图、分辨率、图像处理）通过 getter 或局部 import 按需加载，并保持接口不变（例如对外仍暴露 `get_third_package_*` 或同一 getter）。
- **效果**：不涉及图像/截图的启动路径不加载 PIL/numpy/cv2，进一步降低内存；需注意与 d3-check 规则“顶层 import、可选第三方用 try/except 置 None”的协调（可用“顶层 try/except 赋 None + 首次使用 getter 内 import”的模式）。

### 2.5 Ultralytics (YOLO) 按需加载

- **库**：ultralytics。
- **当前**：`d3utils/collectors/__init__.py` 顶层导入 `ui_region_collector_ultralytics`，而 `interface_manager` 在控制器初始化时即 `from d3utils.collectors import ...`，导致启动即加载 YOLO。
- **建议**：
  - 在 `d3utils/collectors/__init__.py` 中**不要**顶层 `from .ui_region_collector_ultralytics import UIRegionCollectorUltralytics`；改为在需要时再导入（例如在 `interface_manager` 中仅在用到 UIRegionCollectorUltralytics 的分支里 import，或提供 `get_ui_region_collector_ultralytics()` 之类函数，内部再 import 并返回）。
  - 或：`interface_manager` 不直接从 `d3utils.collectors` 一次性 import 所有 Collector 类型，而是按功能（optimized / anchor / ultralytics）按需 import，使 ultralytics 仅在启用“YOLO 检测”路径时才加载。
- **效果**：纯 D3 宏、Rosbot、仅用模板匹配的助手等场景不加载 ultralytics/torch，显著减小内存。

---

## 3. 实现时需遵守的约束

- **.cursor/rules/d3-check.mdc §10**：原则上所有 import 在文件顶部；允许“可选第三方在模块级 try/except 赋 None”。不要为规避循环依赖而滥用懒加载；若需懒加载，应出于“减少启动内存”等明确目的，并在本文档中写明。
- **pycore 规则**：第三方统一通过 `pycore.pyfoundations.third_party` 的 getter 使用；新包需在 third_party 中登记。

---

## 4. 建议实施顺序

1. **CnOCR/ONNX**：按 2.1 将 CnOCR 初始化从系统初始化移到首次 OCR 使用，收益大且改动集中。
2. **Ultralytics**：按 2.5 将 YOLO 从 collectors 顶层与 interface_manager 启动路径中拆出，按需再加载。
3. **Database/common**：按 2.3 调整 common 的导出方式或包结构，避免 window_finder 拉齐 database。
4. **torch**：按 2.2 将 torch 检查从通用依赖检查移到“依赖 torch 的包”首次使用。
5. **PIL/numpy/cv2**：按 2.4 在 providor_index 与 game_interface_data 中改为首次使用时加载，并保持 API 兼容。

以上顺序可根据风险与收益再微调；每步完成后建议做一次启动内存与关键功能（OCR、助手、D4、标定）的回归验证。
