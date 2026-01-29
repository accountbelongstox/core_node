# d3-check 设计文档

本文档记录子应用 d3-check 的核心功能设计与实现要点。与 [设计文档.md](设计文档.md) **合并使用**：本文档为总览与索引，设计文档.md 为 Login Try / Battle.net 掉线重启的详细设计。

---

## 1. 路径配置与一键扫描

### 1.1 功能概述

- **路径配置**：在 ROSBOT 扩展面板中配置「ROSBOT 路径」与「战网路径」。
- **一键扫描**：从 D 盘起、最后 C 盘，最多 4 级目录，自动查找 `Battle.net.exe` 与 ROSBOT 可执行文件目录；支持「一键扫描」或「浏览」选择。

### 1.2 常量（config/constants.py）

| 常量 | 含义 |
|------|------|
| `BATTLE_NET_EXE_NAME` | `"Battle.net.exe"` |
| `ROSBOT_EXE_PATTERNS` | `("ros-bot*.exe", "RoS-BoT*.exe")` |
| `PATH_SCAN_MAX_DEPTH` | 扫描最大目录层级，默认 4 |
| `PATH_SCAN_PREFERRED_ORDER` | 盘符排序偏好：`("D", "E", "F", "G", "H", "C")`（C 最后）；实际盘符列表由 `d3utils.drive_order` 动态获取并缓存。 |

### 1.3 盘符顺序与缓存（d3utils/drive_order.py）

- **盘符动态获取**：使用 Windows API `GetLogicalDrives` 得到所有逻辑盘符，再对每个根路径（如 `C:\`）调用 `GetDriveTypeW` 判断类型；仅保留 **DRIVE_FIXED (3)**，跳过 **DRIVE_REMOVABLE (2)**（U 盘/移动盘）、**DRIVE_CDROM (5)**、**DRIVE_REMOTE (4)**（网络盘）等。
- **缓存**：首次调用 `get_fixed_drive_roots_for_scan(use_cache=True)` 时计算固定盘列表并写入模块级缓存，后续调用直接返回缓存；传 `use_cache=False` 或先调用 `invalidate_cache()` 可刷新。
- **排序**：在固定盘内按 `PATH_SCAN_PREFERRED_ORDER` 排序（D 优先，C 最后），其余盘符按字母序追加。
- **接口**：
  - `get_fixed_drive_roots_for_scan(use_cache=True)` → `List[str]`，元素为 `"X:\\"`。
  - `invalidate_cache()`：清空缓存。

### 1.4 路径扫描工具（d3utils/path_scanner.py）

- **盘符来源**：调用 `d3utils.drive_order.get_fixed_drive_roots_for_scan()`，不再硬编码盘符列表。
- **`_scan_dir(root, depth)`**：递归扫描单目录及子目录，深度不超过 `PATH_SCAN_MAX_DEPTH`；收集 `Battle.net.exe` 全路径与匹配 `ROSBOT_EXE_PATTERNS` 的 exe 所在目录。
- **`scan_for_paths()`**：对外接口。返回 `(battlenet_exe_path 或 None, rosbot_dir 列表)`。Battle.net 只取首个；ROSBOT 可多个。

### 1.5 UI 与配置绑定

- **配置键**：
  - `ros_settings.ros_directory`：ROSBOT 目录（或 exe 路径，与浏览行为一致）。
  - `battlenet.battlenet_path`：Battle.net 可执行文件完整路径。
- **面板**：`ui/panels/rosbot_extension_panel.py`
  - 路径区：ROSBOT 路径输入框 + 浏览、战网路径输入框 + 浏览、「一键扫描」按钮。
  - 一键扫描：后台线程调用 `scan_for_paths()`；完成后在主线程写回配置。若找到多个 ROSBOT 目录，弹窗让用户选一个再写入。
- **i18n**：`providor/i18n/i18n_rosbot_panel_zh.json` / `_en.json` 中增加 `scan_one_click`、`scan_searching`、`scan_done`、`scan_found_multiple_rosbot`、`scan_choose_one`、`scan_not_found_battlenet`、`scan_not_found_rosbot`、`cancel`。

---

## 2. ColorPrint 与 UI 日志回调

### 2.1 机制说明

- **ColorPrint**（pycore/pyfoundations/color_print.py）：每次调用 `green/red/blue/yellow` 等时，内部执行 `_log_to_callback(message, color_type, log_level)`，通过 `_color_print_callback.notify(message, color_type, log_level)` 通知所有已注册回调。
- **回调签名**：`(message, color_type)` 或 `(message, color_type, log_level)`（2 或 3 个参数）。
- **RosbotExtensionPanel**：在 `__init__` 中执行 `ColorPrint.register_callback(self.add_log_message)`，因此所有 ColorPrint 输出都会进入 ROSBOT 日志区域。

### 2.2 扫描过程日志

- **path_scanner** 在关键步骤调用 ColorPrint，便于在 ROSBOT 日志中看到进度：
  - 开始：`[PathScan] Start scan, drives: ..., max depth: 4`
  - 每盘：`[PathScan] Scanning D:\ ...`
  - 找到 Battle.net：`[PathScan] Found Battle.net.exe: <path>`
  - 每找到一个 ROSBOT 目录：`[PathScan] Found ROSBOT: <dir>`
  - 结束：`[PathScan] Done. Battle.net: 1/0, ROSBOT dirs: N`

### 2.3 线程安全（add_log_message）

- 扫描在后台线程执行，ColorPrint 会在该线程触发回调；Tk 仅允许在主线程更新 UI。
- **实现**：`add_log_message` 不再直接操作 `log_text`，而是通过 `self.container.after(0, _append)` 将「插入一行日志」调度到主线程执行；`_append` 内对 `log_text` 做 insert/see/configure，并捕获 `TclError` 与控件不存在情况，避免跨线程写 UI 导致崩溃。

---

## 3. 战网重新登陆的两种触发方式

战网重新登陆（kill + 再启动）由两种方式触发，**顺序无关**，满足任一条即执行同一套重启流程。以下能力均依赖**子类库**（截图、OCR、日志解析、配置、进程控制等），见 3.4。

> 详细设计见 [设计文档.md](设计文档.md)。

### 3.1 两种触发方式概览

| 方式 | 触发条件 | 入口/工具类 | 子类库依赖 |
|------|----------|-------------|------------|
| **① 截图触发** | 对战网窗口截图，OCR 发现「需要登陆」等字样 | `LoginTryScreenshotController.handle_screenshot_trigger()`（或等价接口） | 见 3.4 |
| **② 日志触发** | ROSBOT 日志中出现 `Login try` | `LoginTryScreenshotController.handle_login_try()`，由 `log_analyzer` 调用 | 见 3.4 |

两种方式最终都走同一套「截图 → OCR 判断 → 若需重新登陆则 taskkill + explorer 启动」流程；工具类统一为 `controller.login_try_screenshot_controller.LoginTryScreenshotController`。

---

### 3.2 ① 截图触发（需要登陆等字样）

- **触发条件**：对战网窗口进行截图，对截图做 OCR；若识别文本中包含「需要登陆」等配置关键词，则触发重新登陆流程。
- **常量**：`config.constants.BATTLE_NET_NEED_LOGIN_KEYWORDS`，默认包含 `("需要登陆", "请登录", "登录")` 等（可与掉线关键词复用或分开配置）。
- **流程**（无 Python 线程）：
  1. 读取配置：`CONFIG["battlenet"]["battlenet_path"]`；若未配置或文件不存在，不执行重启。
  2. 截取 Battle.net 窗口：`screenshot_provider.gen(use_optimized_capture=True, window_titles=BATTLE_NET_WINDOW_TITLES)`；若未找到窗口，可退化为全屏截图或直接返回。
  3. OCR 判断：使用 `CnOCREngine` 对截图 OCR，检查是否包含 `BATTLE_NET_NEED_LOGIN_KEYWORDS` 中任一词。
  4. 若命中：执行与掉线相同的重启流程（taskkill + 等待约 2 秒 + explorer 启动）。
- **工具类**：`LoginTryScreenshotController` 需提供截图触发入口（如 `handle_screenshot_trigger()`），内部复用 `_capture_battlenet_window()`、OCR 检测「需要登陆」关键词、`_kill_battlenet()`、`_start_battlenet()`。**需确保该工具类存在并实现上述能力。**

---

### 3.3 ② 日志触发（Login try）

- **触发条件**：ROSBOT 日志文件（默认 `Documents\RoS-BoT\Logs\logs.txt`）某行中出现配置的触发串。
- **配置项**：`log_detection.login_try`，默认 `"Login try"`。
- **常量**：未配置时使用 `config.constants.LOGIN_TRY_TRIGGER_DEFAULT`（`"Login try"`）。
- **流程**（无 Python 线程）：当日志行包含触发串时，由 `d3utils.log_analyzer` 调用 `LoginTryScreenshotController.handle_login_try()`，顺序执行：
  1. **读取配置**  
     Battle.net 可执行路径：`CONFIG["battlenet"]["battlenet_path"]`。若未配置或文件不存在，仅退化为全屏截图（`capture_screenshot()`），不进行掉线检测与重启。
  2. **截取 Battle.net 窗口**  
     使用 `d3utils.screenshot_provider.get_screenshot_provider().gen(use_optimized_capture=True, window_titles=BATTLE_NET_WINDOW_TITLES)`。窗口标题来自 `providor.providor_index.BATTLE_NET_WINDOW_TITLES`。截图保存到 `config.constants.LOGIN_TRY_SCREENSHOT_DIR`，前缀 `LOGIN_TRY_SCREENSHOT_PREFIX`（如 `login_try_battlenet_*.png`）。若未找到 Battle.net 窗口，退化为全屏截图后返回。
  3. **OCR 判断是否掉线**  
     使用 `providor.common_imports.CnOCREngine` 对截图做整图 OCR。掉线关键词：`config.constants.BATTLE_NET_DISCONNECT_KEYWORDS`，默认 `("Retry", "重试")`。若识别文本中包含任一关键词，判定为掉线。
  4. **掉线时重启 Battle.net**  
     - **结束进程**：`subprocess.run(["taskkill", "/F", "/IM", "Battle.net.exe"], ...)`，仅使用 Windows taskkill，不使用 Python 线程库。  
     - **等待**：约 2 秒。  
     - **启动**：`subprocess.run(["explorer", str(exe_path)], cwd=parent)`，exe 路径与工作目录来自配置中的 `battlenet_path`。

---

### 3.4 子类库依赖（两种触发方式均需要）

以下子类库为两种触发方式共用，实现时需依赖或调用：

| 子类库 / 模块 | 路径 | 用途 |
|---------------|------|------|
| **截图提供** | `d3utils.screenshot_provider` | 按窗口标题截取战网窗口或全屏；截图触发与日志触发均需 |
| **OCR 引擎** | `providor.common_imports.CnOCREngine` | 对截图做文字识别；截图触发检测「需要登陆」，日志触发检测「Retry/重试」 |
| **战网重新登陆工具类** | `controller.login_try_screenshot_controller.LoginTryScreenshotController` | 统一入口：截图触发、日志触发；内部截图、OCR、taskkill、explorer 启动 |
| **配置与窗口标题** | `providor.providor_index` | `CONFIG["battlenet"]["battlenet_path"]`、`BATTLE_NET_WINDOW_TITLES` |
| **常量** | `config.constants` | 截图目录、前缀、日志触发串、掉线关键词、需要登陆关键词、进程名等 |
| **日志监控与解析** | `d3utils.log_monitor`、`d3utils.log_analyzer` | 仅**日志触发**需要：读日志、匹配 "Login try"、调用 `handle_login_try()` |

---

### 3.5 涉及模块与常量（索引）

| 模块/文件 | 职责 |
|-----------|------|
| `d3utils.log_monitor` | 按间隔读日志、调用 `log_analyzer.analyze_log_line(line)`（仅日志触发需要） |
| `d3utils.log_analyzer` | 解析每行日志；若包含 Login try 触发串则调用 `get_login_try_screenshot_controller().handle_login_try()` |
| `controller.login_try_screenshot_controller` | 战网截图、OCR（掉线/需要登陆）、taskkill + explorer 重启；截图触发 `handle_screenshot_trigger()`、日志触发 `handle_login_try()` |
| `config.constants` | Login Try 与 Battle.net 相关常量（含 `BATTLE_NET_NEED_LOGIN_KEYWORDS`） |
| `providor.providor_index` | `CONFIG`、`BATTLE_NET_WINDOW_TITLES` |
| `d3utils.screenshot_provider` | 按窗口标题截取 Battle.net 窗口 |
| `providor.common_imports.CnOCREngine` | 截图 OCR，用于检测 Retry/重试（日志触发）与 需要登陆（截图触发） |

### 3.6 常量（config/constants.py，战网重新登陆相关）

| 常量 | 含义 |
|------|------|
| `LOGIN_TRY_SCREENSHOT_SUBDIR` | 登录尝试截图子目录名（如 `login_try_screenshots`） |
| `LOGIN_TRY_SCREENSHOT_PREFIX` | 截图文件名前缀（如 `login_try`） |
| `LOGIN_TRY_SCREENSHOT_DIR` | 完整截图目录（`TMP_DIR / LOGIN_TRY_SCREENSHOT_SUBDIR`） |
| `LOGIN_TRY_TRIGGER_DEFAULT` | 日志默认触发串（如 `"Login try"`） |
| `BATTLE_NET_DISCONNECT_KEYWORDS` | 界面掉线关键词元组（如 `("Retry", "重试")`），用于日志触发后 OCR 判断 |
| `BATTLE_NET_NEED_LOGIN_KEYWORDS` | 界面「需要登陆」关键词元组（如 `("需要登陆", "请登录", "登录")`），用于截图触发 OCR 判断 |
| `BATTLE_NET_EXE_NAME` | 进程名（如 `"Battle.net.exe"`），用于 taskkill |

### 3.7 LoginTryScreenshotController 接口（登陆功能类库）

- **ensure_battlenet_started_and_login_check()**：**启动 ROSBOT 第一步**。确保战网启动 → 激活 UI（托盘点击，不重启）→ 截图 → OCR 检测「需要登陆」关键词；若无登陆性文字则打印「UI 登陆成功」，若有则触发重新登陆（kill + start）。返回 True 表示本步已执行，False 表示未配置或窗口不可用。依赖子类库：`ClickHandler.find_and_click_tray_icon()`（pycore/pyutils/click_handler.py）、screenshot_provider、CnOCREngine。
- **handle_screenshot_trigger()**：截图触发入口。对战网窗口截图 → OCR 检测 `BATTLE_NET_NEED_LOGIN_KEYWORDS` → 若命中则 taskkill + explorer 启动。
- **handle_login_try()**：日志触发入口。完整流程（配置 → Battle.net 截图 → OCR 检测掉线关键词 → 若掉线则 taskkill + explorer 重启）；异常或未配置时退化为全屏截图。
- **capture_screenshot()**：全屏截图并保存到 `LOGIN_TRY_SCREENSHOT_DIR`，返回保存路径信息。
- **get_login_try_screenshot_controller()**：返回全局单例。

**激活窗口（不重启）**：使用 `ClickHandler.find_and_click_tray_icon()`（pycore/pyutils/click_handler.py），通过系统托盘图标点击激活战网窗口，不杀进程、不重启。

### 3.8 日志与配置路径

- **日志目录**：由 `providor.providor_index.get_dynamic_paths()` 得到，如 `DOCUMENTS_PATH` + `paths.rosbot_logs_relative`（默认 `RoS-BoT/Logs`）。
- **Battle.net 路径**：`CONFIG["battlenet"]["battlenet_path"]`，UI 中在 ROSBOT 扩展面板配置。

### 3.9 图标查找与等比例缩放

- **规则（与 D3/D4 一致）**：预定一个**标准分辨率**（参考窗口尺寸）；若**实际窗口**与标准存在比例差，则用于查找的**小图（模板）按同一比例伸缩**后再参与匹配，以避免窗口拉伸后图标找不到。
- **游戏窗口**：
  - D3：标准分辨率 `STANDARD_RESOLUTION_WIDTH x HEIGHT`（1826x1301）；实际尺寸由 `screenshot_provider` / `game_interface_data` 得到；`get_global_scale()` 返回 `(scale_x, scale_y)` = 实际/标准；`d3utils.scaled_template_matcher.ScaledTemplateMatcher` 用该比例缩放模板后再调用 `ImageMatcher` 匹配。
  - D4：同理，标准为 `D4_STANDARD_RESOLUTION_*`（1763x1126），`d4utils.d4_scaled_template_matcher` 按 `get_global_scale()` 缩放模板。
- **战网窗口**：
  - 标准分辨率：`BATTLENET_STANDARD_RESOLUTION_WIDTH x HEIGHT`（960x540），定义在 `providor.providor_index`。
  - 实际窗口：由当前截图得到，`screenshot_data.game_window_size` 即当前战网窗口宽高。
  - 缩放：`scale_x = 当前宽 / 960`，`scale_y = 当前高 / 540`；在 `LoginTryScreenshotController._match_battlenet_template()` 内对模板图做 `cv2.resize(..., (tw*scale_x, th*scale_y))`，再用原有 `ImageMatcher`（`standard_width/height` 设为当前窗口尺寸，避免二次缩放）做等比例查找。
- **小结**：先通过当前窗口/截图得到「当前定位差」（实际尺寸），再按「实际/标准」比例缩放模板，用原有图片查找类库进行匹配；战网与游戏窗口采用同一套等比例伸缩规则。

---

## 4. 启动顺序与流程

### 4.1 规则（顺序不可乱）

任何「一键启动」或自动化流程必须严格按以下顺序执行：

1. **① 确保战网启动并登陆**  
2. **② 确保暗黑3启动**  
3. **③ 确保 ROSBOT 启动**  

后续步骤依赖前序步骤；不可先启 ROSBOT 再启战网或 D3。

### 4.2 所用类库（与上文同一套）

| 步骤 | 类库/模块 | 路径 | 主要接口/职责 |
|------|------------|------|----------------|
| ① 战网 | LoginTryScreenshotController | `controller/login_try_screenshot_controller.py` | `ensure_battlenet_started_and_login_check()`（第一步：启动→激活 UI→截图→检测登陆）；`_get_battlenet_path()`、`_start_battlenet()`、`_kill_battlenet()`；掉线 `handle_login_try()`，需要登陆 `handle_screenshot_trigger()` |
| ① 战网 | ClickHandler（托盘点击激活） | pycore/pyutils/click_handler.py | `find_and_click_tray_icon()`：通过托盘图标点击激活战网窗口，**不重启** |
| ① 战网 | 配置 / 截图 | `providor.providor_index`、`d3utils.screenshot_provider` | `CONFIG["battlenet"]["battlenet_path"]`，`BATTLE_NET_WINDOW_TITLES`；按窗口标题检测战网窗口是否存在 |
| ② D3 | GameState / LogAnalyzer | `share/game_interface_data.py`、`d3utils/log_analyzer.py` | `get_game_interface_data().d3_running`、`set_d3_status(True/False)`；D3 状态由 **ROSBOT 日志** 解析得到（Diablo detected / D3 lost） |
| ③ ROSBOT | rosbot_task_processor / TaskThreadManager | `d3utils/rosbot_task_processor.py`、`d3utils/task_thread_manager.py` | `start_rosbot_task()`、`set_task_status('rosbot_task', ENABLED)`；详见 [ROSBOT_FLOW.md](ROSBOT_FLOW.md) |

### 4.3 各步流程简述

**① 确保战网启动并登陆**

- **输入**：`CONFIG["battlenet"]["battlenet_path"]`（可由 path_scanner 或面板配置得到）。
- **点击「启动 ROSBOT」后的第一步**（由面板 `_start_rosbot` 开头调用）：
  1. 调用 `get_login_try_screenshot_controller().ensure_battlenet_started_and_login_check()`。
  2. 内部流程：若战网窗口不存在则 `_start_battlenet()` 启动；**激活 UI** 使用 `ClickHandler().find_and_click_tray_icon()`（托盘点击，不重启）；截图战网窗口；OCR 检测 `BATTLE_NET_NEED_LOGIN_KEYWORDS`（需要登陆/请登录/登录）。
  3. **若无登陆性文字**：打印「UI 登陆成功」。
  4. **若有登陆性文字**：触发重新登陆（`_kill_battlenet()` + `_start_battlenet()`）。
- **可选检测**：用 `screenshot_provider.gen(window_titles=BATTLE_NET_WINDOW_TITLES)` 判断战网窗口是否存在；或检测进程 `Battle.net.exe`。
- **若未运行**：`LoginTryScreenshotController._get_battlenet_path()` 取路径，再 `_start_battlenet(exe_path)`（`explorer` 启动），等待数秒。
- **「登陆」**：由用户手动登陆；若运行中掉线（出现 Retry/重试），由日志触发 `handle_login_try()` 做截图 + OCR + taskkill + `_start_battlenet` 重启（见 3.2）。

**② 确保暗黑3启动**

- **状态来源**：`game_state.d3_running` 由 `log_analyzer.analyze_line(line)` 根据 ROSBOT 日志设置（`Diablo.*detected` / `D3.*found` → True，`Diablo.*lost` → False）。  
- **含义**：不在本程序内启动 D3 进程；D3 由用户在战网客户端中点击启动。本步只做「确保检测到 D3 已运行」：轮询/等待 `get_game_interface_data().d3_running == True`，或依赖后续 LogMonitor 读到日志后更新状态。  
- **顺序约束**：必须先 ① 战网并登陆，用户才能在战网里启动 D3；之后才能进行 ③（ROSBOT 会读日志并更新 d3_running）。

**③ 确保 ROSBOT 启动**

- **入口**：`rosbot_processor.start_rosbot_task()`（见 [ROSBOT_FLOW.md](ROSBOT_FLOW.md)）。
- **内部**：`RosbotTaskProcessor.start_rosbot()` → `set_log_file(...)`（若未初始化）、`set_rosbot_running(True)`、`game_state.set_rosbot_status(True)`。
- **调用前**：需已执行 `set_task_status('rosbot_task', TaskStatus.ENABLED)`（通常由面板 `_start_rosbot` 先设状态再调 `start_rosbot_task()`）。

### 4.4 流程简图

```
                    ┌─────────────────────────────────────┐
                    │  ① 确保战网启动并登陆                 │
                    │  LoginTryScreenshotController        │
                    │  _get_battlenet_path → _start_battlenet │
                    │  可选：screenshot_provider 检测窗口   │
                    │  掉线：handle_login_try (kill+start)  │
                    └─────────────────┬───────────────────┘
                                      │ 顺序不可乱
                                      ▼
                    ┌─────────────────────────────────────┐
                    │  ② 确保暗黑3启动                     │
                    │  用户于战网内启动 D3                 │
                    │  game_state.d3_running 由 log_analyzer │
                    │  根据 ROSBOT 日志更新（后续才有日志）  │
                    └─────────────────┬───────────────────┘
                                      │ 顺序不可乱
                                      ▼
                    ┌─────────────────────────────────────┐
                    │  ③ 确保 ROSBOT 启动                  │
                    │  set_task_status('rosbot_task', ENABLED) │
                    │  rosbot_processor.start_rosbot_task() │
                    │  → set_rosbot_running(True)          │
                    │  → game_state.set_rosbot_status(True) │
                    └─────────────────────────────────────┘
```

### 4.5 与 ROSBOT 面板的关系（第一步已接入）

- 面板「启动 ROSBOT」按钮（`rosbot_extension_panel._start_rosbot`）**第一步**：在更新 UI 之前调用 `get_login_try_screenshot_controller().ensure_battlenet_started_and_login_check()`，完成「确保战网启动、激活 UI（托盘点击）、截图、若无登陆性文字则打印 UI 登陆成功、若有则触发重新登陆」。
- 随后执行：更新 UI → `set_task_status('rosbot_task', ENABLED)` → `start_rosbot_task()`。② D3 的确保仍依赖用户于战网内启动 D3 及后续日志更新。

---

## 5. 相关文件索引

| 文档/模块 | 路径 |
|-----------|------|
| 设计文档（详细） | `docs/设计文档.md` |
| 常量 | `config/constants.py` |
| 盘符顺序与缓存 | `d3utils/drive_order.py` |
| 路径扫描 | `d3utils/path_scanner.py` |
| ROSBOT 面板 | `ui/panels/rosbot_extension_panel.py` |
| 配置绑定 | `ui/utils/config_binding.py` |
| ColorPrint | pycore/pyfoundations/color_print.py |
| 公共导入 | `providor/common_imports.py` |
| 日志监控 | `d3utils/log_monitor.py` |
| 日志解析 | `d3utils/log_analyzer.py` |
| Login Try 控制器（登陆功能类库） | `controller/login_try_screenshot_controller.py` |
| 截图提供 | `d3utils/screenshot_provider.py` |
| 托盘点击激活（ClickHandler） | pycore/pyutils/click_handler.py |
