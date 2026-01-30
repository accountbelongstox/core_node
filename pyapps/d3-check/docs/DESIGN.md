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
- **单回调按当前 Tab**：主界面 `_reregister_log_callback()` 只注册**当前选中 Tab** 下面有 `add_log_message` 的面板；启动时与切换 Tab 时都会调用，故 D3/ROSBOT 日志只进 ROSBOT Tab，D4 日志只进 D4 Tab。D4Panel 的 `add_log_message` 对非 D4 消息（不含 `[D4]`/`D4`）直接 return，不写队列。

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
| **窗口缓存** | `pycore.pyutils.common.window_finder`、`pycore.pyutils.window_screenshot`、`d3utils.screenshot_provider` | 同一组 `titles` 使用**单一规范 cache key**（`window_cache_{titles[0].lower()}`），所有调用方共享；无效时 `ENCYCLOPEDIA.remove(cache_key)`。战网窗口标题含 `BATTLE_NET_WINDOW_TITLES`（含 `"Battle.net Login"`）。 |
| **截图提供** | `d3utils.screenshot_provider` | 按窗口标题截取战网窗口或全屏；截图触发与日志触发均需 |
| **OCR 关键词** | `d3utils.ocr_helper` | `ocr_has_any_keywords(image_path, keywords, ...)`：判断是否包含关键词；`ocr_find_keyword_boxes(image_path, keywords, ...)`：返回匹配的 `{keyword, text, bbox}` 列表（图像坐标），用于国服流程点击；`bbox_center(bbox)`、`bbox_first_char_center(bbox, num_chars=3)`：由 bbox 算点击中心。国服流程用上述接口找「您同意」「使用网易账号登录或注册」「登陆」并点击。 |
| **战网窗口截图并保存** | `d3utils.battlenet_capture` | `capture_battlenet_and_save_to_category(category)`：截战网窗口、保存到分类目录、清理旧文件；返回 `(screenshot_data, path)` |
| **战网模板匹配** | `d3utils.battlenet_template_matcher` | `load_scaled_battlenet_template(name, w, h)`、`match_battlenet_template(...)`、`get_best_attempt_tm(...)`；统一按窗口尺寸缩放模板后匹配 |
| **PIL→BGR** | `d3utils.d3u_common.image_utils` | `convert_pil_to_bgr(pil_image)`：PIL/RGBA 转 BGR，供 matcher 使用 |
| **调试图保存** | `d3utils.d3u_common.image_annotator_helper` | `save_match_debug_image(image_source, match, label, output_dir, ...)`、`save_no_match_debug_image(image_source, method_name, output_dir, ...)`：通用匹配/无匹配调试图保存 |
| **全方法匹配调试** | `d3utils.battlenet_match_debug` | `ALL_MATCH_METHODS`、`debug_all_match_methods(...)`：对所有匹配方法跑一遍并保存调试图；控制器仅薄封装调用 |
| **战网重新登陆工具类** | `controller.login_try_screenshot_controller.LoginTryScreenshotController` | 统一入口：截图触发、日志触发；内部调用上述子类库，仅做编排 |
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
| `BATTLE_NET_CN_AGREE_KEYWORDS` | 国服同意条款关键词（如 `("您同意",)`），用于无 D3 小图时判断国服流程 |
| `BATTLE_NET_CN_NETEASE_LOGIN_KEYWORDS` | 国服网易登录入口（如 `("使用网易账号登录或注册",)`） |
| `BATTLE_NET_CN_LOGIN_BUTTON_KEYWORDS` | 国服登录按钮 OCR（如 `("登陆", "登录")`），全屏截图后点此 |
| `BATTLE_NET_EXE_NAME` | 进程名（如 `"Battle.net.exe"`），用于 taskkill |
| `DIABLO_III_EXE_NAME` | 进程名（如 `"Diablo III.exe"`），点击战网前若检测到 D3 窗口则先 taskkill 再等 5 秒 |

### 3.7 战网 / D3 / ROSBOT 管理类库（复用基础类库）

战网、D3、ROSBOT 的进程/窗口逻辑统一由管理类库承担，控制器只调用管理器接口，避免重复代码。

| 类库 | 路径 | 职责 |
|------|------|------|
| **process_helper** | `d3utils.process_helper` | 共用：`get_pid_from_hwnd(hwnd)`（win32process.GetWindowThreadProcessId）；`kill_process_by_pid(pid)`（taskkill /F /PID）；`kill_process_by_exe(exe_name)`（taskkill /F /IM）。D3Manager 按「找到的窗口」取 PID 再 k，BattleNetManager 仍按 exe 名 k。 |
| **BattleNetManager** | `d3utils.battlenet_manager` | 战网：`get_path()`（从 CONFIG）、`kill()`、`restart(exe_path=None, wait_after_sec=2.0)`（kill + sleep + start）、`start(exe_path)`（explorer）、`find_windows()`、`activate_window()`（WindowFinder + WindowActivator）。单例：`get_battlenet_manager()`。**每次对战网做点击前**需先调用 `activate_window()` 确保窗口置顶。战网窗口标题含 `BATTLE_NET_WINDOW_TITLES`（含 `"Battle.net Login"` 等）。 |
| **D3Manager** | `d3utils.d3_manager` | D3：`_find_windows()`（WindowFinder + DIABLO_III_WINDOW_TITLES，use_cache=True）、`is_running()`、`kill_if_running()`：**按实际找到的窗口取 PID**，再 `kill_process_by_pid(pid)`，不依赖固定 exe 名（标题/exe 可能变化）。单例：`get_d3_manager()`。 |
| **ROSBOTManager** | `d3utils.rosbot_manager` | ROSBOT：`get_ros_directory()`（从 CONFIG ros_settings.ros_directory）；`find_rosbot_exe()`（ROSBOT_EXE_PATTERNS 在目录下找主 exe）；`find_same_dir_exe_names()`（同目录下生成的临时 exe，排除主程序与 install/uninstall）；`is_running()`（psutil：任一进程 exe 路径在该目录下）；`kill_if_running()`（上述进程按 PID k）；`start()`（Popen 主 exe）。单例：`get_rosbot_manager()`。**原 ROS 管理类**：`utils/_obsolete_rosbot_manager.py` 的 `RoSBotManager`（含 find_other_exe_files、cleanup_old_other_exe_processes、wait_for_new_other_exe、start_rosbot_sequence 等完整序列）；当前 d3utils 版为精简版，仅 k/start，详见 [ROSBOT_FLOW.md 第 0 节](ROSBOT_FLOW.md#0-原-ros-管理类库已废弃仅作对照)。 |

**依赖基础类库**：WindowFinder、WindowActivator、get_default_skip_browser_callable（pycore/pyutils/common）；ColorPrint、WindowActivator（providor.common_imports）；config.constants；providor_index（CONFIG、窗口标题常量）。

### 3.8 LoginTryScreenshotController 接口（登陆功能类库）

- **ensure_battlenet_started_and_login_check()**：**启动 ROSBOT 第一步**。**状态1 = 完整游戏流程（唯一流程）；状态2、3 = 检测客户端是否掉线**，检测到没掉线则**回到 1 的流程、从中间处继续**。**三个流程的共同最后一步（与前面如何到达无关）**：M 打开地图；按一次 M、等 2s、检测一次悬赏进度，共两轮；检测到有进度图即地图已打开，再三连点。由 `open_map_verify_bounty_then_teleport_three_clicks()` 实现。① 若 D3 已运行：resize → `detect_d3_already_running_state()` 做掉线检测；`"start"` 或 `"game_tool"` = 没掉线，从 1 的流程中间继续（start→fragment1+send_m_then_teleport_three_clicks；game_tool→fragment2），二者最后均走共同最后一步；None 或失败则 kill D3 后走战网。② 战网流程（状态1）：战网窗口未找到则 `start(bn_path)`；杀 D3、等 5 秒；托盘→activate、截图；need-login 则 restart；有 D3 小图则点小图、Play、sleep(5)、轮询 D3、resize、`wait_for_and_click_start_game`（内部找到 game_tool 后也走共同最后一步）、k ROSBOT、start、start_rosbot_task、run_after_rosbot_start；无小图则国服或 restart。**最多 3 轮**外层重试；重启后等 5 秒再进入下一轮。
- **handle_screenshot_trigger()**：截图 → `ocr_has_any_keywords(path, BATTLE_NET_NEED_LOGIN_KEYWORDS)` → 若命中则 `get_battlenet_manager().restart(bn_path)`。
- **handle_login_try()**：截图 → `ocr_has_any_keywords(path, BATTLE_NET_DISCONNECT_KEYWORDS)` → 若掉线则 `get_battlenet_manager().restart(bn_path)`；未配置时退化为全屏截图。
- **capture_screenshot()**：全屏截图并保存到 `LOGIN_TRY_SCREENSHOT_DIR`。
- **debug_all_match_methods()**：薄封装，调用 `d3utils.battlenet_match_debug.debug_all_match_methods(...)`。
- **get_login_try_screenshot_controller()**：返回全局单例。

**点击战网前杀 D3**：`get_d3_manager().kill_if_running()`（按找到的窗口取 PID 再 k），再等待 5 秒。

**每次对战网点击前**：先 `get_battlenet_manager().activate_window()`，再 `time.sleep(0.3)`，再执行点击（D3 小图、Play 按钮均如此）。

**D3 稳定后启动 ROSBOT**：在 ensure_battlenet_started_and_login_check 内点击 Play 之后，**先 sleep(5)** 再轮询 D3 窗口（最多 10 秒）；找到则 set_d3_status(True)、先 k ROSBOT 再 start 主 exe、`start_rosbot_task()`，再调用 **ROSBOT UI 自动化**（见 3.11）。

### 3.9 日志与配置路径

- **日志目录**：由 `providor.providor_index.get_dynamic_paths()` 得到，如 `DOCUMENTS_PATH` + `paths.rosbot_logs_relative`（默认 `RoS-BoT/Logs`）。
- **Battle.net 路径**：`CONFIG["battlenet"]["battlenet_path"]`，UI 中在 ROSBOT 扩展面板配置。

### 3.10 图标查找与等比例缩放

- **规则（与 D3/D4 一致）**：预定一个**标准分辨率**（参考窗口尺寸）；若**实际窗口**与标准存在比例差，则用于查找的**小图（模板）按同一比例伸缩**后再参与匹配，以避免窗口拉伸后图标找不到。
- **游戏窗口**：
  - D3：标准分辨率（客户区）`STANDARD_RESOLUTION_WIDTH x HEIGHT`（1300x800）；截图/GetWindowRect 得到的是**外框**（含标题栏与左右底边），当客户区为 1300x800 时外框为 1316x839（去两边空白 9+7、标题 31、底边 8 后即 1300x800）。`D3_STANDARD_OUTER_WIDTH/HEIGHT`（1316x839）由 `share/game_interface_data` 根据边框常量推导。实际尺寸由 `screenshot_provider` / `game_interface_data` 得到；`get_global_scale()` 返回 `(scale_x, scale_y)` = 实际/标准；`d3utils.scaled_template_matcher.ScaledTemplateMatcher` 用该比例缩放模板后再调用 `ImageMatcher` 匹配。
  - D4：同理，标准为 `D4_STANDARD_RESOLUTION_*`（1763x1126），`d4utils.d4_scaled_template_matcher` 按 `get_global_scale()` 缩放模板。
- **战网窗口**：
  - **统一入口**：`d3utils.battlenet_template_matcher`。标准分辨率：`BATTLENET_STANDARD_RESOLUTION_WIDTH x HEIGHT`（960x540），定义在 `providor.providor_index`。
  - **加载与缩放**：`load_scaled_battlenet_template(template_name, window_width, window_height)` 从 `BATTLENET_TEMPLATE_CONFIGS` 读 path，按 `scale_x = window_width/960`、`scale_y = window_height/540` 缩放模板后返回 `(template_bgr, config)`。
  - **匹配**：`match_battlenet_template(game_window_image, template_name, w, h, match_method=None)` 内部 `convert_pil_to_bgr` + `load_scaled_battlenet_template` + `ImageMatcher.match_single_template`；`get_best_attempt_tm(...)` 用于 TM 方法调试（低于阈值也返回最佳位置）。
  - 控制器与 `battlenet_match_debug` 均调用该模块，不再在 controller 内重复实现。
- **小结**：战网模板的加载、缩放、匹配统一在 `battlenet_template_matcher`；PIL→BGR 统一用 `d3utils.d3u_common.image_utils.convert_pil_to_bgr`（含 RGBA 支持）。

### 3.11 ROSBOT UI 自动化（启动后点击主档案与 Start botting）

- **模块**：`d3utils.rosbot_ui_automation`。使用 **uiautomation**（pycore.pyfoundations.third_party.get_third_package_uiautomation）枚举并点击 ROSBOT 窗口内控件；窗口通过 `WindowFinder.find_windows_by_titles(ROSBOT_WINDOW_TITLES)` 查找。
- **窗口标题常量**：`providor.providor_index.ROSBOT_WINDOW_TITLES`（如 `RoS-BoT`、`RoS-BoT.exe`、`ROSBOT`）。
- **入口**：`run_after_rosbot_start(wait_sec=5, do_debug=True, do_tab=True, do_start_botting=True)`。等待 ROSBOT 窗口出现 → 激活窗口 → 用 uiautomation 取 Control → **DEBUG 打印可操作元素**（`debug_print_operable_elements`：递归遍历控件树，ColorPrint 输出 type、name、automation_id、rect）→ 点击 **主档案** Tab（TabItemControl 名称含 主档案/主檔案/Main Profile）→ 点击 **Start botting!** 按钮（ButtonControl automation_id `btnStart` 或名称含 Start botting）。
- **调用时机**：在 `ensure_battlenet_started_and_login_check()` 内，`get_rosbot_manager().start()` 与 `start_rosbot_task()` 之后调用；若异常仅打 Yellow 日志，不中断流程。
- **点击实现**：控件级点击用 `control.Click()`（uiautomation），非 pyautogui 屏幕坐标。屏幕坐标点击（战网 Play、托盘）仍用 `ClickHandler`（pycore/pyutils/click_handler.py，内部 pyautogui）。

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
| ① 战网 | LoginTryScreenshotController | `controller/login_try_screenshot_controller.py` | `ensure_battlenet_started_and_login_check()`（**状态1=完整流程；状态2、3=掉线检测**，检测到没掉线则回到 1 的流程从中间继续。D3 已运行时 `detect_d3_already_running_state()`；战网流程：杀 D3→托盘→截图→有 D3 小图则点小图→Play→轮询 D3→wait_for_and_click_start_game→k ROSBOT→start→run_after_rosbot_start；**最多 3 轮**；掉线/需要登陆用 `restart(bn_path)`） |
| ① 战网 | ClickHandler（托盘点击激活） | pycore/pyutils/click_handler.py | `find_and_click_tray_icon()`：通过托盘图标点击激活战网窗口，**不重启** |
| ① 战网 | 配置 / 截图 / 战网截图保存 | `providor.providor_index`、`d3utils.screenshot_provider`、`d3utils.battlenet_capture` | `CONFIG["battlenet"]["battlenet_path"]`，`BATTLE_NET_WINDOW_TITLES`；战网截图统一 `capture_battlenet_and_save_to_category("login_try")` |
| ② D3 | WindowMonitor / WindowFinder / D3Manager / GameState | `timers/window_monitor_timer.py`、`pycore.pyutils.common.window_finder`、`d3utils.d3_manager`、`share/game_interface_data.py` | 点击 Play 后轮询 `WindowFinder.find_windows_by_titles(DIABLO_III_WINDOW_TITLES)` 找到即「D3 窗口就绪」；**d3_running 仅由窗口检测维护**：WindowMonitor 定时检测 D3 窗口并 `set_d3_status`，controller 轮询到 D3 窗口时也 `set_d3_status(True)`；log_analyzer 不读写 d3_running |
| ③ ROSBOT | ROSBOTManager / rosbot_task_processor / rosbot_ui_automation / TaskThreadManager | `d3utils/rosbot_manager.py`、`d3utils/rosbot_task_processor.py`、`d3utils/rosbot_ui_automation.py`、`d3utils/task_thread_manager.py` | **D3 稳定后**：`kill_if_running()` → `start()`（若 `ros_settings.auto_start_rosbot`）→ `start_rosbot_task()` → **`run_after_rosbot_start()`**（DEBUG 打印可操作元素、点主档案、点 Start botting!）；详见 [ROSBOT_FLOW.md](ROSBOT_FLOW.md) |

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

- **状态来源**：`game_state.d3_running` **不由日志决定**，仅由窗口检测设置：① `WindowMonitor`（`timers/window_monitor_timer.py`）定时用 `WindowFinder.find_windows_by_titles(DIABLO_III_WINDOW_TITLES)` 检测到 D3 窗口则 `set_d3_status(True)`，未检测到则 `set_d3_status(False)`；② 在 `ensure_battlenet_started_and_login_check()` 内点击 Play 后轮询到 D3 窗口时也会 `set_d3_status(True)`。`log_analyzer` 不读写 d3_running。
- **含义**：不在本程序内启动 D3 进程；D3 由用户在战网客户端中点击启动。本步只做「确保检测到 D3 已运行」：轮询/等待 D3 窗口出现，由 WindowMonitor 或 controller 更新 d3_running。
- **顺序约束**：必须先 ① 战网并登陆，用户才能在战网里启动 D3；之后才能进行 ③。D3 运行状态仅由窗口检测维护。

**③ 确保 ROSBOT 启动**

- **触发时机**：在 `ensure_battlenet_started_and_login_check()` 内，点击 Play 之后 **先 sleep(5)** 等 D3 稳定，再轮询 D3 窗口（最多 10 秒）；当 `WindowFinder.find_windows_by_titles(DIABLO_III_WINDOW_TITLES, use_cache=True)` 找到窗口时，执行：① `get_game_interface_data().set_d3_status(True)`；② `get_rosbot_manager().kill_if_running()`（先关再启，未跑则直接启）；③ sleep(1)；④ 若配置 `ros_settings.auto_start_rosbot` 则 `get_rosbot_manager().start()`（启动主 exe）；⑤ `start_rosbot_task()`；⑥ **`d3utils.rosbot_ui_automation.run_after_rosbot_start()`**（等 ROSBOT 窗口、DEBUG 打印可操作元素、点击主档案、点击 Start botting!）。
- **入口**：`rosbot_processor.start_rosbot_task()`（见 [ROSBOT_FLOW.md](ROSBOT_FLOW.md)）。
- **内部**：`RosbotTaskProcessor.start_rosbot()` → `set_log_file(...)`（若未初始化）、`set_rosbot_running(True)`、`game_state.set_rosbot_status(True)`。
- **调用前**：需已执行 `set_task_status('rosbot_task', TaskStatus.ENABLED)`（面板 `_start_rosbot` 先设状态再调 `ensure_battlenet_started_and_login_check`，后者在 D3 窗口就绪后调 `start_rosbot_task()`）。

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
                    │  d3_running 仅由 WindowMonitor/      │
                    │  controller 窗口检测更新，不由日志   │
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
- 随后执行：更新 UI → `set_task_status('rosbot_task', ENABLED)` → `start_rosbot_task()`。② D3 的确保依赖用户于战网内启动 D3；d3_running 由窗口检测更新，不由日志。

### 4.6 四路扩展线程与主线程共享数据

- **四路扩展线程**（均继承 `threading.Thread`，原生写法）：
  1. **主要功能**（`d3utils.main_function_thread.MainFunctionThread`）：宏循环（技能执行）。命令：`start_macro`、`stop_macro`、`shutdown`。读配置用 `CONFIG_LOCK`。UI 启动/停止宏通过 `put_command('start_macro'|'stop_macro')`；切换技能配置通过 `set_current_skill_config(config_name)`。
  2. **辅助功能**（`d3utils.auxiliary_function_thread.AuxiliaryFunctionThread`）：占位线程，命令队列仅处理 `shutdown`，可扩展为周期性轻量任务。
  3. **Rosbot 扩展**（`d3utils.d3_extension_thread.D3ExtensionThread`）：战网登录检查、ROSBOT 启动/停止。命令：`start_rosbot`、`stop_rosbot`、`shutdown`。完成通过 `schedule_on_main_thread(callback)` 回主线程更新 UI。
  4. **D4 功能**（`d3utils.d4_extension_thread.D4ExtensionThread`）：每 3s 当 `d4_data.is_exp_farming_running()` 或 `debug_window_open` 时调用 `d4_controller.process()`。不再注册到 timer_manager；关闭时 `request_shutdown()`。
- **主线程与各线程共享数据**：
  - **game_interface_data**（`share/game_interface_data.py`）：已有 `_lock`，主线程与各扩展线程可安全共享。
  - **CONFIG**：`providor.providor_index` 提供 `CONFIG_LOCK` 及 `get_config_value_safe`/`set_config_value_safe`；主要功能线程读宏配置时使用 `CONFIG_LOCK`。UI 可随时修改配置，确保配置为所有线程共享的安全类型。
- **启动顺序**：`Controller.run()` 在创建 UI、注册回调后，依次创建并 `start()` 四个线程（MainFunctionThread、AuxiliaryFunctionThread、D3ExtensionThread、D4ExtensionThread），再 `ui.run()`。关闭时 `ShutdownManager.execute_shutdown()` 的 Step 0 对四个线程依次 `request_shutdown()` 并 `join(timeout=3)`，再停 hotkey、timer、销毁 UI。
- **包引入**：所有包引入放在文件开头；Controller、ShutdownManager、各扩展线程等不再在函数内 `import`。
- **窗口监控回调与关闭**：WindowMonitor 回调内先 `is_shutdown_requested()`，再通过 `parent.after(0, ...)` 调度到主线程；对 `after` 用 `try/except tk.TclError` 避免 main loop 已停止时报错。

---

## 5. 相关文件索引

| 文档/模块 | 路径 |
|-----------|------|
| 设计文档（详细） | `docs/设计文档.md` |
| Login/Battle.net 分类与复用 | `docs/LOGIN_BATTLENET_CLASSIFICATION.md` |
| ROSBOT 启动流程 | `docs/ROSBOT_FLOW.md` |
| 常量 | `config/constants.py` |
| 盘符顺序与缓存 | `d3utils/drive_order.py` |
| 路径扫描 | `d3utils/path_scanner.py` |
| ROSBOT 面板 | `ui/panels/rosbot_extension_panel.py` |
| 配置绑定 | `ui/utils/config_binding.py` |
| ColorPrint | pycore/pyfoundations/color_print.py |
| 公共导入 | `providor/common_imports.py` |
| 日志监控 | `d3utils/log_monitor.py` |
| 日志解析 | `d3utils/log_analyzer.py` |
| 窗口监控（D3 状态由窗口检测） | `timers/window_monitor_timer.py` |
| Login Try 控制器（登陆功能类库） | `controller/login_try_screenshot_controller.py` |
| 截图提供 | `d3utils/screenshot_provider.py` |
| 战网窗口截图并保存 | `d3utils/battlenet_capture.py` |
| 战网模板匹配 | `d3utils/battlenet_template_matcher.py` |
| 战网全方法匹配调试 | `d3utils/battlenet_match_debug.py` |
| OCR 关键词 | `d3utils/ocr_helper.py` |
| 调试图保存 | `d3utils/d3u_common/image_annotator_helper.py` |
| PIL→BGR | `d3utils/d3u_common/image_utils.py` |
| 进程 k（exe/PID） | `d3utils/process_helper.py` |
| 战网管理 | `d3utils/battlenet_manager.py` |
| D3 管理（按窗口 PID k） | `d3utils/d3_manager.py` |
| ROSBOT 管理（同目录 exe、k/start） | `d3utils/rosbot_manager.py` |
| ROSBOT UI 自动化（uiautomation：主档案、Start botting） | `d3utils/rosbot_ui_automation.py` |
| 共享游戏状态（d3_running/rosbot_running 等） | `share/game_interface_data.py` |
| 主要功能线程（宏循环） | `d3utils/main_function_thread.py` |
| 辅助功能线程（占位/轻量任务） | `d3utils/auxiliary_function_thread.py` |
| D3/ROSBOT 扩展线程（登录检查、ROSBOT 启动/停止） | `d3utils/d3_extension_thread.py` |
| D4 功能线程（d4_controller.process 每 3s） | `d3utils/d4_extension_thread.py` |
| 配置线程安全（CONFIG_LOCK、get/set_config_value_safe） | `providor/providor_index.py` |
| 托盘点击激活（ClickHandler） | pycore/pyutils/click_handler.py |
