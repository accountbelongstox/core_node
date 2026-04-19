# 技术说明：controller/d4func/__init__.py、docs/preview_mermaid.py、d3utils/log_monitor.py

**目的**：说明此三处文件的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `controller/d4func/__init__.py`
- `docs/preview_mermaid.py`
- `d3utils/log_monitor.py`

---

## 一、controller/d4func/__init__.py

### 1.1 职责与约定

- **用途**：D4 功能包入口；仅负责从子模块导入并导出 **ScreenshotHandler、RegionDetector、ImageAnnotator、ExpFarmingManager、UIStatusUpdater、get_ui_status_updater**。`__all__` 与 `from .xxx import` 必须一致；外部通过 `from controller.d4func import ...` 使用，未列入 __all__ 的不会被导出。
- **约定**：新增 D4 子模块（如新 py 文件）时须在此增加 `from .新模块 import 新类或函数` 并在 `__all__` 中追加对应名称；删除子模块时须同步移除此处的 import 与 __all__ 项，否则 ImportError 或导出与实现不一致。

### 1.2 易被误解或改错的原因

1. **新增子模块未更新 __init__**：在 d4func 下新建 py 但未在 __init__.py 中 import 与 __all__，外部无法 `from controller.d4func import 新类`。
2. **__all__ 与 import 不一致**：只改了 import 未改 __all__ 或反之，会导致导出列表与实际可引用对象不符。
3. **误改包名或路径**：controller/d4func 为 D4 扩展功能包，与 d3utils、rosbot_flow 等并列；若移动目录未同步所有 from controller.d4func 的引用会断链。

### 1.3 正确做法

- 修改 D4 功能集时先看 __init__.py；增删子模块必须同步 __all__ 与 from 列表；不在此处添加业务逻辑，仅做导出。

---

## 二、docs/preview_mermaid.py

### 2.1 职责与约定

- **用途**：**独立可执行脚本**（非被主应用 import）。从 **docs/ROSBOT_FLOW_MERMAID.md** 用正则提取第一个 ```mermaid ... ``` 块，调用 **mermaid-cli**（render_mermaid）渲染为 SVG，写入 **docs/mermaid_preview/ROSBOT_FLOW.svg**，然后根据平台用 os.startfile（Windows）、open（macOS）、xdg-open（Linux）打开。依赖：`pip install mermaid-cli`。脚本内使用 asyncio.run(run()) 同步执行异步渲染，渲染完成并写入文件后才执行打开。
- **约定**：若修改 ROSBOT_FLOW_MERMAID.md 的路径或文件名须同步 doc_dir、md_path；若修改输出目录或 SVG 文件名须同步 out_dir、out_svg；不可在主应用线程或无 asyncio 事件循环的环境中 import 并调用 run() 作为子流程而不处理事件循环；依赖 mermaid-cli 未安装时脚本直接 sys.exit(1)。

### 2.2 易被误解或改错的原因

1. **改 md 路径或输出路径未同步**：doc_dir 为脚本所在目录（docs），md_path 为 docs/ROSBOT_FLOW_MERMAID.md；若文档移动或改名未改脚本会 FileNotFoundError。
2. **误当库使用**：本脚本设计为 `python docs/preview_mermaid.py` 独立运行；若在其他模块中 import preview_mermaid 并期望调用会触发 asyncio.run 与 startfile，可能阻塞或与主应用事件循环冲突。
3. **正则只取第一个 mermaid 块**：若 md 中有多个 mermaid 块，仅第一个被渲染；若需渲染多个须改脚本逻辑。
4. **平台打开逻辑**：win32 用 startfile，darwin 用 open，否则 xdg-open；若在无图形环境或 WSL 中运行可能打开失败。

### 2.3 正确做法

- 仅作为独立脚本运行；改文档路径或输出路径时同步脚本内常量；不在此脚本内加入被主应用 import 的 API。

---

## 三、d3utils/log_monitor.py

### 3.1 职责与约定

- **用途**：**ROSBOT 日志监控**。文件变更驱动：当 **watchdog** 可用时，监控日志文件所在目录，文件修改时立即调用 **_read_and_process_new_lines**（无 tick 延迟）；新行经 **ColorPrint.info** 输出并调用 **analyze_log_line(line)**。**初始基线**：set_log_file 首次调用时，last_position 设为当前文件大小，**不打印该时刻之前的内容**。**回退**：无 watchdog 时由 **system_initializer** 的 timer 周期性调用 **check_logs()**。**调试**：log_settings.debug_log_latency 为 True 时解析行首时间戳并打印延迟（now - log_time）。**线程**：watchdog 的 on_modified 在 **observer 线程** 执行，会调用 _read_and_process_new_lines；模块注释明确「Runs in observer thread: must not block (no get_config_value in ColorPrint callbacks)」——即 **在 ColorPrint 回调链或 observer 线程内不得调用 get_config_value 或会引发主线程/ConfigBinding 死锁的 API**；当前实现中 _read_and_process_new_lines 内使用 **get_config_value_safe** 读 debug_log_latency，若该 API 非线程安全或内部访问 ConfigBinding 仍可能死锁，故约定为：**在 _read_and_process_new_lines 内除已明确线程安全的 get_config_value_safe 读 debug_log_latency 外，不得再读 config 或调用可能阻塞/死锁的接口**。全局单例通过 **get_log_monitor()** 获取；**set_log_file** 由调用方（如 system_initializer 或配置加载）在合适时机调用；**check_logs** 由 system_initializer 的 timer 在无 watchdog 时调用。
- **约定**：不在 observer 线程/回调内调用 get_config_value 或 ConfigBinding；set_log_file 的基线语义（不打印已有内容）不可改为「从头打印」否则重复刷屏；log_monitor_api 通过 register(get_log_monitor) 注册，其他模块通过 api 或本模块 get_log_monitor 使用；stop_log_watching 应在关闭时调用以便 observer 停止。

### 3.2 易被误解或改错的原因

1. **在 _read_and_process_new_lines 或 ColorPrint 回调内读 config**：observer 线程与主线程不同，在回调内 get_config_value 或读 ConfigBinding 可能导致死锁（与 log_panel 约定一致）。
2. **改 set_log_file 基线语义**：将 last_position 设为 0 或「先读再设」会重复打印已有日志，违反「初始 read = 现在，不打印此前内容」。
3. **误在 system_initializer 外启动 observer 或误在 LogMonitor 内启动 timer**：observer 由 set_log_file 内 _start_watching 启动；timer 由 system_initializer 管理并调用 check_logs；若在别处重复启动 observer 或 timer 会重复处理或资源冲突。
4. **get_log_monitor 与 log_monitor_api.register**：对外应统一通过 get_log_monitor() 或 api 获取实例；若绕过单例新建 LogMonitor 会存在多实例，监控状态不一致。
5. **analyze_log_line 与 log_analyzer**：每行必须调用 analyze_log_line(line)，若在此处去掉或改条件会破坏日志分析逻辑。

### 3.3 正确做法

- 修改前通读模块注释与 log_panel 相关技术说明（回调线程、不得读 config）；保持 set_log_file 基线语义；observer 仅由 set_log_file 启动、timer 仅由 system_initializer 调 check_logs；不在 _read_and_process_new_lines 内增加会死锁的 config 读取。

---

## 四、与道歉文档的关系

若此前因未先通读上述三处约定（d4func __init__ 与 __all__ 同步、preview_mermaid 独立脚本与路径、log_monitor 线程与基线语义）而在此三处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加对本文的引用（第三十六节）。
