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

- **触发条件**：ROSBOT 日志文件（默认 `Documents\RoS-BoT\Logs\history.txt`）某行中出现配置的触发串。
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
| **ROSBOTManager** | `d3utils.rosbot_manager` | ROSBOT：同目录 exe 唯一查找流程见 [ROSBOT_LOOKUP_FLOW.md](ROSBOT_LOOKUP_FLOW.md)。`get_ros_directory()`；`find_rosbot_exe()`；`find_other_exe_files()`（同目录 exe 列表）；`get_rosbot_window()` / `get_rosbot_detection()`（先 other 后 main，仅 exe 找进程、按 PID 取窗口，无标题过滤）；`is_running()`、`kill_if_running()`、`start()`。单例：`get_rosbot_manager()`。废弃：`utils/_obsolete_rosbot_manager.py`，见 [ROSBOT_FLOW.md 第 0 节](ROSBOT_FLOW.md#0-原-ros-管理类库已废弃仅作对照)。 |

**依赖基础类库**：WindowFinder、WindowActivator、get_default_skip_browser_callable（pycore/pyutils/common）；ColorPrint、WindowActivator（providor.common_imports）；config.constants；providor_index（CONFIG、窗口标题常量）。

### 3.8 LoginTryScreenshotController 接口（登陆功能类库）

- **ensure_battlenet_started_and_login_check()**：**启动 ROSBOT 第一步**。**状态1 = 完整游戏流程（唯一流程）；状态2、3 = 检测客户端是否掉线**，检测到没掉线则**回到 1 的流程、从中间处继续**。**三个流程的共同最后一步（与前面如何到达无关）**：M 打开地图；按一次 M、等 2s、检测一次悬赏进度，共两轮；检测到有进度图即地图已打开，再三连点。由 `open_map_verify_bounty_then_teleport_three_clicks()` 实现。① 若 D3 已运行：resize → `detect_d3_already_running_state()` 做掉线检测；`"start"` 或 `"game_tool"` = 没掉线，从 1 的流程中间继续（start→fragment1+send_m_then_teleport_three_clicks；game_tool→fragment2），二者最后均走共同最后一步；None 或失败则 kill D3 后走战网。② 战网流程（状态1）：战网窗口未找到则 `start(bn_path)`；杀 D3、等 5 秒；托盘→activate、截图；need-login 则 restart；有 D3 小图则点小图、Play、sleep(5)、轮询 D3；找到 D3 窗口则 resize、**C3 循环+分支**（与 C 块相同，`_run_c3_loop_and_handle_branch`）、成功则 k ROSBOT、start、start_rosbot_task、run_after_rosbot_start；无小图则国服或 restart。**最多 3 轮**外层重试；重启后等 5 秒再进入下一轮。
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
- **游戏窗口（公共基类 + D3/D4 各自实现）**：
  - **公共基类**：`share/scaled_template_matcher_base.py` 的 `ScaledTemplateMatcherBase` 只提供通用逻辑，无游戏常量、无游戏专属方法。提供：标准宽高与 `get_scale_factors`/`get_template_config` 由子类注入、`_load_target_image`/`_load_original_template`/`_get_scaled_template_image`、`match_template`、`_match_single_with_scale(target_img_array, template_name, scale_x, scale_y)`（供子类封装）、`match_multiple_templates`、`match_template_in_image`、`clear_cache`。子类通过构造函数传入各自游戏维度和配置获取函数。
  - **D3**：`d3utils.d3_scaled_template_matcher` 内置常量 `D3_STANDARD_WIDTH`/`D3_STANDARD_HEIGHT`（1300x800），模板配置来自 providor。`D3ScaledTemplateMatcher` 继承基类并**在本类内**实现 `match_template_auto_scale(target_image, template_name)`：用目标图尺寸与 D3 标准分辨率推导 scale，再调用基类 `_match_single_with_scale`。`d3_status_provider._detect_d3_dynamic` 使用 `get_scaled_template_matcher().match_template_auto_scale(window_image, D3_DISCONNECTED_TEMPLATE_NAME)`。对外入口：`d3utils.scaled_template_matcher.ScaledTemplateMatcher` / `get_scaled_template_matcher`（re-export）。
  - **D4**：`d4utils.d4_scaled_template_matcher` 内置常量 `D4_STANDARD_WIDTH`/`D4_STANDARD_HEIGHT`（1763x1126），模板配置来自 providor。`D4ScaledTemplateMatcher` 继承基类并**在本类内**实现 `match_template_auto_scale`（同 D3 思路，用 D4 常量）以及 D4 独有方法：`match_template_in_region(template_name, region_name, ...)`、`_get_shared_region_image`、`_extract_region_from_full_image`、`_save_region_debug_image` 等。
- **战网窗口**：
  - **统一入口**：`d3utils.battlenet_template_matcher`。标准分辨率：`BATTLENET_STANDARD_RESOLUTION_WIDTH x HEIGHT`（960x540），定义在 `providor.providor_index`。
  - **加载与缩放**：`load_scaled_battlenet_template(template_name, window_width, window_height)` 从 `BATTLENET_TEMPLATE_CONFIGS` 读 path，按 `scale_x = window_width/960`、`scale_y = window_height/540` 缩放模板后返回 `(template_bgr, config)`。
  - **匹配**：`match_battlenet_template(game_window_image, template_name, w, h, match_method=None)` 内部 `convert_pil_to_bgr` + `load_scaled_battlenet_template` + `ImageMatcher.match_single_template`；`get_best_attempt_tm(...)` 用于 TM 方法调试（低于阈值也返回最佳位置）。
  - 控制器与 `battlenet_match_debug` 均调用该模块，不再在 controller 内重复实现。
- **小结**：战网模板的加载、缩放、匹配统一在 `battlenet_template_matcher`；PIL→BGR 统一用 `d3utils.d3u_common.image_utils.convert_pil_to_bgr`（含 RGBA 支持）。

### 3.11 ROSBOT UI 自动化（启动后点击主档案与 Start botting）

- **模块**：`d3utils.rosbot_ui_automation`。使用 **uiautomation** 枚举并点击 ROSBOT 窗口内控件；窗口通过 `get_rosbot_manager().get_rosbot_window()` 查找（同目录 exe 单一路径，见 [ROSBOT_LOOKUP_FLOW.md](ROSBOT_LOOKUP_FLOW.md)）。
- **入口**：`run_after_rosbot_start(wait_sec=5, do_debug=True, do_tab=True, do_start_botting=True)`。等待 ROSBOT 窗口出现 → 激活窗口 → 用 uiautomation 取 Control → **DEBUG 打印可操作元素**（`debug_print_operable_elements`：递归遍历控件树，ColorPrint 输出 type、name、automation_id、rect）→ 点击 **主档案** Tab（TabItemControl 名称含 主档案/主檔案/Main Profile）→ 点击 **Start botting!** 按钮（ButtonControl automation_id `btnStart` 或名称含 Start botting）。
- **调用时机**：在 `ensure_battlenet_started_and_login_check()` 内，`get_rosbot_manager().start()` 与 `start_rosbot_task()` 之后调用；若异常仅打 Yellow 日志，不中断流程。
- **点击实现**：控件级点击用 `control.Click()`（uiautomation），非 pyautogui 屏幕坐标。屏幕坐标点击（战网 Play、托盘）仍用 `ClickHandler`（pycore/pyutils/click_handler.py，内部 pyautogui）。

### 3.12 D3 / Battle.net 状态提供者与动态状态

**设计思路**：① 战网与 D3 状态**仅由窗口检测与各 provider 的 detect 逻辑更新**，与 ROSBOT 是否启动无关，便于独立展示与后续自动化。② **统一入口**：定时器与面板「刷新状态」按钮共用 `check_window()`，不重复实现。③ **注册即刷新**：`register_status_ui(callback)` 时在后台线程立即执行一次 `check_window()`，避免启动后 0～10 秒状态区显示默认「未找到/未运行」。

**设计原则**：战网状态与 D3 状态各自独立模块（非笼统的「窗口状态」）；逻辑代码在各自 provider 内，公共部分（刷新流程）在 `status_provider_common` 中共享，而非简单二次封装。

#### 3.12.1 模块与职责

| 模块 | 路径 | 职责 |
|------|------|------|
| **status_provider_common** | `d3utils/status_provider_common.py` | 共享刷新流程：`refresh_window_state(game_data, window_info_or_none, set_running_fn, set_dynamic_fn, detect_dynamic_fn, apply_geometry_fn=None)`。依次执行：set_running(窗口是否找到)、可选 apply_geometry、detect_dynamic → (on_login, disconnected, third)、set_dynamic。各 provider 只提供四个回调，不重复写流程。 |
| **d3_status_provider** | `d3utils/d3_status_provider.py` | D3 窗口查找（WindowFinder + DIABLO_III_WINDOW_TITLES）、D3 动态状态检测、D3 几何写入 game_interface_data。接口：`refresh_d3_status()` → 返回 D3 窗口信息或 None；`get_current_d3_window()`。 |
| **battlenet_status_provider** | `d3utils/battlenet_status_provider.py` | 战网窗口查找（BattleNetManager.find_windows）、战网动态状态检测（BattlenetOperation）。无几何。接口：`refresh_battlenet_status()` → 返回战网窗口信息或 None；`get_current_battlenet_window()`。 |
| **BattlenetOperation** | `d3utils/battlenet_operation.py` | 战网窗口操作：`start()`/`close()`/`restart()`、`activate_window()`、`click_d3_tab()`、`click_start_game()`、`is_game_starting()`；动态状态检测（已实现，**仅 UI 元素**，不截图）：`get_dynamic_state()` 一次枚举返回 (on_login_screen, disconnected, normal_available)；`is_on_login_screen()` / `is_disconnected()` 按控件名匹配（需要登陆/请登录/登录/您同意/使用网易账号登录或注册、Retry/重试）；`is_logged_in()` 为 D3 标签 + Play 区域；TODO：`agree_login()`、`click_confirm_login()`。控件名/automation_id 参考 `docs/登陆后的战网元素.json`（见 3.12.7）。 |

#### 3.12.2 动态状态字段与优先级

- **D3**（`share/game_interface_data.py`）：`d3_on_login_screen`、`d3_disconnected`（**最高优先级**）、`d3_in_game`（正常）。显示优先级：disconnected > on_login_screen > in_game。
- **Battle.net**：`battlenet_on_login_screen`、`battlenet_disconnected`、`battlenet_normal_available`。显示优先级同上：disconnected > on_login_screen > normal_available。
- 战网 / D3 状态**不依赖** rosbot 是否启动，仅由窗口检测与各 provider 的 detect 逻辑更新。

#### 3.12.2a 战网状态 UI 显示要求与当前限制

- **要求显示的几种状态**（ROSBOT 面板「战网」一行）：**未找到**、**掉线**、**登录界面**、**正常可用**；当仅检测到窗口存在且动态检测未实现时显示「**已找到(状态未检测)**」。
- **数据来源**：`battlenet_status_provider.refresh_battlenet_status()` → `BattlenetOperation.is_on_login_screen()`、`is_disconnected()`、`is_logged_in()` 写入 `game_interface_data` 的 `battlenet_on_login_screen`、`battlenet_disconnected`、`battlenet_normal_available`；面板 `_update_ui_from_state(state)` 按优先级显示对应 i18n 文案（见 `i18n_rosbot_panel_*` 中 `rosbot.battlenet_disconnected`、`rosbot.battlenet_on_login_screen`、`rosbot.battlenet_normal_available`、`rosbot.found_unknown_state`）。
- **实现情况**：`d3utils/battlenet_operation.py` 中战网动态状态**仅用 UI 元素**（JSON 控件树），不截图、不用 OCR。`get_dynamic_state()` 一次枚举控件，按控件名/automation_id 判断登录界面、掉线、正常可用；刷新后战网一行将按优先级显示「掉线」「登录界面」「正常可用」或「已找到(状态未检测)」。

#### 3.12.3 事件驱动与定时驱动（设计思路）

- **事件驱动**：由事件触发执行，而非固定周期轮询。当前事件触发包括：① 用户点击「刷新状态」→ `submit_one_shot(check_window)`；② 用户切换 flow master（Start/Stop）或 Ensure Battle.net → 同上，立即 `_request_status_refresh()` 即 `submit_one_shot(check_window)`，状态区即时更新；③ 注册状态 UI 时由 controller 在 UI 就绪后执行一次 `check_window()`；④ 日志出现 Login try 等 → `handle_login_try()`；⑤ 扩展线程命令完成 → 主线程回调更新 UI。
- **定时驱动**：定时器每 10 秒调用 `check_window()`；ROSBOT 流程由 2 秒 tick 驱动 F0/F1/F2…（见 ROSBOT_FLOW.md）。与事件驱动并存：事件保证「操作后立即反馈」，定时保证「无操作时周期更新」。

#### 3.12.3a 统一定时器与按钮立即调用

- **设计原则**：定时器**周期性**调用同一套模块逻辑；面板上的按钮与**状态切换事件****立即**调用同一套逻辑。入口统一为 `check_window()`，定时器 = 定时调用，按钮 / flow master 与 ensure_bn 切换 = 事件调用，不重复实现。
- **定时器与 UI 为平级子模块**：`timers/` 与 `ui/` 互不导入。由**主线程（controller）**统一导入并接线：controller 导入 `window_monitor_timer` 和创建 UI（含 ROSBOT 面板）；controller 调用 `window_monitor.register_status_ui(panel.get_status_ui_callback())` 注册状态回调；controller 调用 `panel.set_refresh_status_fn(window_monitor.check_window)` 注入「刷新」可调用，使「刷新状态」按钮可触发同一套逻辑而面板不导入定时器。所有包引入放在文件开头，不在函数内导入。
- **统一定时器**（`timers/window_monitor_timer.py`）：
  - 定时器每 10 秒调用 `check_window()`；`check_window()` 内依次调用 `refresh_d3_status()`、`refresh_battlenet_status()`，再 `get_game_interface_data().notify_state_sync()`、`_notify_callbacks(d3_info)`（D3 窗口信息回调）。
  - 定时器循环在 **UI 就绪后** 才启动：controller 在进入 mainloop 前调用 `get_system_initializer().start_timer_loop_after_ui_ready()`，此时才 `timer_manager.start()` 并执行一次 `check_window()`，避免回调早于状态控件创建。
- **按钮立即调用**（同一入口）：
  - 面板「**刷新状态**」按钮：点击后调用 controller 注入的 `_refresh_status_fn()`（即 `window_monitor.check_window`），在后台线程执行，逻辑与定时器一致。面板不导入 `window_monitor_timer`。
  - 「启动ROSBOT」「调试(战网UI JSON)」等按钮：各自调用对应流程（非 `check_window()`）；仅「刷新状态」与定时器共用 `check_window()`。
- **状态 UI 注册**：在 controller 中 `window_monitor.register_status_ui(panel.get_status_ui_callback())` 将 callback 注册到 `game_interface_data`；每次刷新（定时或按钮触发）后都会触发 `_notify_callbacks(state)`。首次检测在 `start_timer_loop_after_ui_ready()` 中执行，不在 `register_status_ui()` 内。
- **面板**（`ui/panels/rosbot_extension_panel.py`）：不导入定时器；提供 `get_status_ui_callback()` 与 `set_refresh_status_fn(fn)` 供 controller 接线。`_update_ui_from_state(state)` 按优先级显示 Battle.net / D3 状态（disconnected > on_login_screen > in_game / normal_available）。控制区「刷新状态」按钮调用注入的 `_refresh_status_fn()`。

#### 3.12.4 检测实现与 TODO

- **D3 动态状态**（`d3_status_provider._detect_d3_dynamic`）：
  - **掉线（disconnected）**：在 D3 窗口内截屏，用 SIFT 匹配模板 `d3_disconnected`（常量 `config.constants.D3_DISCONNECTED_TEMPLATE_NAME`，图 `images/d3_disconnected.png`，原 `ScreenShot_2026-01-30_071704_521.png`）；匹配到则设 `d3_disconnected=True`，状态 UI 显示「掉线」。
  - **登录界面 / 游戏中**：TODO；当前未检测时返回 (False, False, False)。
- **刷新时机**：全局定时器每 **10 秒**调用 `check_window()`（`timers/window_monitor_timer.DEFAULT_INTERVAL = 10.0`）；面板「刷新状态」按钮可**实时**调用同一 `check_window()`（由 controller 注入 `window_monitor.check_window`），逻辑与定时器一致。
- **Battle.net 动态状态**（`battlenet_status_provider._detect_battlenet_dynamic`）：**仅用 UI 元素**（JSON/控件树），不截图、不用 OCR。通过 `BattlenetOperation.get_dynamic_state()` 一次枚举控件，返回 `(on_login_screen, disconnected, normal_available)`：**未登陆** = 任一控件 automation_id 含 LoginWindow/loginWidgetContainer/loginWidget/login-wrapper/login-header/legalAcceptance/ntes/connectAccounts（特征来自未登陆 UI 分析 `*.d3check/cache/battlenet_ui_analyze/window_analysis_*/battlenet_analysis.json`），或控件名含需要登陆/请登录/登录/您同意/使用网易账号登录或注册；掉线 = 控件名含 Retry/重试；正常可用 = 存在 D3 标签（game-nav-btn-D3CN / game-nav-btn-D3）且存在 Play 区域（play-btn-main / play-btn 或名称含 Play/开始游戏/Playing Now）。控件参考 `docs/登陆后的战网元素.json`。优先级：disconnected > on_login_screen > normal_available。

#### 3.12.5 调用关系小结

| 触发方式 | 入口 | 行为 |
|----------|------|------|
| 定时器 | 每 10s 由 timer_manager 调用（timer 在 UI 就绪后启动） | `check_window()` → refresh_d3_status() + refresh_battlenet_status() + refresh_rosbot_status() → 更新 game_interface_data → 回调 |
| 面板「刷新状态」按钮 | 用户点击 → _refresh_status_now → submit_one_shot | 同上：后台线程中调用 `check_window()`，逻辑与定时器一致 |
| flow master / Ensure BN 切换 | 用户点击 Start/Stop 或 Ensure Battle.net → _request_status_refresh → submit_one_shot | 事件驱动：切换后立即提交一次 `check_window()`，状态区即时更新 |
| UI 就绪后 | controller 调用 start_timer_loop_after_ui_ready() | 启动 timer_manager 并 submit_one_shot(do_window_monitor_initial_check)：执行一次 BN+D3+ROS 刷新并 notify_state_sync，更新底部状态栏（战网/ROS/D3/地图/阶段/窗口尺寸）；不驱动流程。详见 [INITIAL_STATE_DETECTION.md](INITIAL_STATE_DETECTION.md)。 |

#### 3.12.6 相关文件索引

| 文档/模块 | 路径 |
|-----------|------|
| 共享刷新流程 | `d3utils/status_provider_common.py` |
| D3 状态提供者 | `d3utils/d3_status_provider.py` |
| 战网状态提供者 | `d3utils/battlenet_status_provider.py` |
| 战网操作（BattlenetOperation：start/close/restart、点击 D3/Play、动态状态 TODO） | `d3utils/battlenet_operation.py` |
| 共享游戏状态（含 d3/battlenet 动态字段） | `share/game_interface_data.py` |
| 窗口监控定时器（统一入口 check_window；定时与 UI 平级，由 controller 导入并接线） | `timers/window_monitor_timer.py` |
| ROSBOT 面板（刷新状态按钮调用注入的 _refresh_status_fn、状态区、get_status_ui_callback/set_refresh_status_fn、调试战网 UI JSON；不导入 timer） | `ui/panels/rosbot_extension_panel.py` |

#### 3.12.7 战网 UI 导出与控件说明

- **调试按钮**：ROSBOT 扩展面板「**调试(战网 UI JSON)**」按钮。点击后在子线程内先 `pythoncom.CoInitialize()` 再调用 `WindowAnalyzer`（pycore.pyutils.window_analyzer），枚举战网窗口的 UI Automation 树，导出为 JSON 并保存到 `docs/登陆后的战网元素.json`（若目录不可写则退化为复制到剪贴板）。
- **控件说明**：`docs/登陆后的战网元素-控件说明.md` 记录控件 key、automation_id、用途；数据来源为上述调试按钮导出的 JSON（Chromium 战网客户端）。
- **BattlenetOperation 依赖**：`BattlenetOperation` 内 D3 Tab、Play 等控件的 automation_id/名称常量参考该 JSON（如 `game-nav-btn-D3CN`、`play-btn-main`）；后续实现 `is_on_login_screen`/`is_disconnected`/`is_logged_in` 时可复用 LoginTryScreenshotController 的 OCR 关键词或该 JSON 中的登录相关控件。

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
| ① 战网 | LoginTryScreenshotController | `controller/login_try_screenshot_controller.py` | `ensure_battlenet_started_and_login_check()`（**状态1=完整流程；状态2、3=掉线检测**，检测到没掉线则回到 1 的流程从中间继续。D3 已运行时 `detect_d3_already_running_state()`；战网流程：杀 D3→托盘→截图→有 D3 小图则点小图→Play→轮询 D3→D13 找到窗口则 C2 resize + C3 循环+分支→成功则 k ROSBOT→start→run_after_rosbot_start；**最多 3 轮**；掉线/需要登陆用 `restart(bn_path)`） |
| ① 战网 | ClickHandler（托盘点击激活） | pycore/pyutils/click_handler.py | `find_and_click_tray_icon()`：通过托盘图标点击激活战网窗口，**不重启** |
| ① 战网 | 配置 / 截图 / 战网截图保存 | `providor.providor_index`、`d3utils.screenshot_provider`、`d3utils.battlenet_capture` | `CONFIG["battlenet"]["battlenet_path"]`，`BATTLE_NET_WINDOW_TITLES`；战网截图统一 `capture_battlenet_and_save_to_category("login_try")` |
| ② D3 | d3_status_provider / battlenet_status_provider / WindowMonitor / GameState | `d3utils/d3_status_provider.py`、`d3utils/battlenet_status_provider.py`、`timers/window_monitor_timer.py`、`share/game_interface_data.py` | 定时器 `check_window()` 依次调用 `refresh_d3_status()`、`refresh_battlenet_status()` 更新 d3_running / battlenet_window_found 及动态状态；**d3_running 仅由窗口检测维护**（d3_status_provider + controller 轮询到 D3 时 set_d3_status(True)）；log_analyzer 不读写 d3_running。见 3.12。 |
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

- **状态来源**：`game_state.d3_running` **不由日志决定**，仅由窗口检测设置：① 定时器调用 `d3_status_provider.refresh_d3_status()` 检测 D3 窗口并 `set_d3_status`；② 在 `ensure_battlenet_started_and_login_check()` 内点击 Play 后轮询到 D3 窗口时也会 `set_d3_status(True)`。`log_analyzer` 不读写 d3_running。D3/战网动态状态（on_login_screen、disconnected、in_game/normal_available）由各 status provider 更新，见 3.12。
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
- **线程注册中心（THREAD BUS 生命周期侧）**：`runtime/thread_registry.py` 的 `get_thread_registry()` 返回单例 **ThreadRegistry**（share 仅放共享数据，不放业务逻辑与线程注册）。所有线程实例仅在此创建与持有；**禁止在运行中动态创建线程**（防止卡住）。主线程只通过该中心引用线程（`create_extension_threads`、`get_xxx_thread`、`run_path_scan` 等）。禁止在组件内使用 `self.xxx_thread` 创建或持有线程。**正常运行时禁止线程互相卡住**；线程间通信**一律通过事件中心**（THREAD_BUS / event_center）；关闭阶段主线程可对工作线程 `join(timeout)` 做收尾。
- **线程实现为原生类**：禁止一个类对另一个类做简单封装。组件直接继承 Thread（如 `SystemTray(threading.Thread)`）或线程类 run() 内直接实现循环/逻辑。宏 fallback（`MacroLoopThread`）、游戏界面宏（`GameInterfaceMacroThread`）在各自 controller 模块，run() 内直接写循环；托盘为 `SystemTray(Thread)`，无单独 TrayRunnerThread。Registry 通过 create_macro_fallback_thread、create_macro_thread 获取线程实例，托盘则 start_tray(tray) 直接 start(tray)。
- **启动顺序与驱动**：**所有线程随 UI 同步启动**；执行仅由**全局状态与 tick** 驱动。`Controller.run()` 在创建 UI 后，由 controller 将定时器与 UI 接线，再调用 `get_thread_registry().create_extension_threads(schedule, panel, ...)` 创建并启动四路扩展线程，`register_extension_handlers(..., get_main_function_thread, ...)` 使用模块级 getter（由 registry 在创建时 set），然后 `get_thread_registry().start_timer_loop_after_ui_ready()`（启动 timer 并投递首次窗口检测，一次性工作均通过 `timer_manager.submit_one_shot` 投递，不新建线程），最后 `ui.run()`。关闭时 `ShutdownManager.execute_shutdown()` 的 Step 0 对四路线程依次 `request_shutdown()` 并 `join(timeout=3)`，再停 hotkey、timer、销毁 UI。
- **包引入**：所有包引入放在文件开头；Controller、ShutdownManager、各扩展线程等不再在函数内 `import`。
- **窗口监控回调与关闭**：WindowMonitor 回调内先 `is_shutdown_requested()`，再通过 `parent.after(0, ...)` 调度到主线程；对 `after` 用 `try/except tk.TclError` 避免 main loop 已停止时报错。

---

## 5. 相关文件索引

| 文档/模块 | 路径 |
|-----------|------|
| 设计文档（详细） | `docs/设计文档.md` |
| THREAD_BUS 与线程注册中心 | `docs/THREAD_BUS_AND_REGISTRY.md` |
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
| 窗口监控（调用 d3/battlenet status provider） | `timers/window_monitor_timer.py` |
| 共享状态刷新流程 | `d3utils/status_provider_common.py` |
| D3 状态提供者 | `d3utils/d3_status_provider.py` |
| 战网状态提供者 | `d3utils/battlenet_status_provider.py` |
| 战网操作（BattlenetOperation） | `d3utils/battlenet_operation.py` |
| 战网 UI 导出（调试按钮、WindowAnalyzer） | `ui/panels/rosbot_extension_panel.py`（_export_battlenet_ui_to_json） |
| 战网元素 JSON / 控件说明 | `docs/登陆后的战网元素.json`、`docs/登陆后的战网元素-控件说明.md` |
| WindowAnalyzer（UI Automation 树导出） | pycore.pyutils.window_analyzer |
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
| 线程注册中心（统一创建/持有线程，主线程仅通过此处引用） | `runtime/thread_registry.py` |
| 主要功能线程（宏循环） | `d3utils/main_function_thread.py` |
| 辅助功能线程（占位/轻量任务） | `d3utils/auxiliary_function_thread.py` |
| D3/ROSBOT 扩展线程（登录检查、ROSBOT 启动/停止） | `d3utils/d3_extension_thread.py` |
| D4 功能线程（d4_controller.process 每 3s） | `d3utils/d4_extension_thread.py` |
| 配置线程安全（CONFIG_LOCK、get/set_config_value_safe） | `providor/providor_index.py` |
| 托盘点击激活（ClickHandler） | pycore/pyutils/click_handler.py |
