# 启动 ROSBOT 后的逻辑与类库索引

**启动顺序规则**：战网启动并登陆 → 暗黑3启动 → ROSBOT 启动，顺序不可乱。详见 [DESIGN.md 第 4 节：启动顺序与流程](DESIGN.md#4-启动顺序与流程)。

**D3 稳定后启动 ROSBOT**：在「启动 ROSBOT」第一步 `ensure_battlenet_started_and_login_check()` 内，点击 Play 之后 **先 sleep(5)** 等 D3 稳定，再轮询 D3 窗口最多 10 秒（`WindowFinder.find_windows_by_titles(DIABLO_III_WINDOW_TITLES, use_cache=True)`）；一旦找到则：① `get_game_interface_data().set_d3_status(True)`；② **resize D3 窗口** 到标准 1300x800（`resize_window_by_titles_to_client_size`）；③ **D3 内「开始游戏」等待**：`wait_for_and_click_start_game()` 每 2 秒对 D3 截图、SIFT 查找 `d3_start_game_button`（最多 `D3_START_GAME_MAX_ATTEMPTS` 次，默认 10×2s），找到则点击、wait 2 秒；④ **游戏工具等待**：继续每 2 秒截图直到出现 `d3_game_tool`（最多 `D3_GAME_TOOL_MAX_ATTEMPTS` 次，默认 10×2s），然后对 D3 窗口 **发送 M 键**，再按基准 1300x800 比例计算点击坐标 **（602, 94）**（`D3_GAME_TOOL_CLICK_STANDARD`）并点击；⑤ 若③或④超时未找到，则调用 **`_restart_battlenet_and_retry_from_step1(bn_path)`**（重启战网、等 5s），然后 **continue 外层重试**（最多 `max_outer_retries` 轮）；⑥ 若成功则 `get_rosbot_manager().kill_if_running()`；⑦ sleep(1)；⑧ 若配置 `ros_settings.auto_start_rosbot` 则 `get_rosbot_manager().start()`；⑨ `start_rosbot_task()`；⑩ **`run_after_rosbot_start()`**（等 ROSBOT 窗口、DEBUG 打印、点主档案、点 Start botting!）。

---

## 0. 原 ROS 管理类库（已废弃，仅作对照）

**位置**：`utils/_obsolete_rosbot_manager.py`，类名 **`RoSBotManager`**（注意大小写）。

原类负责：RoS-BoT.exe 与**同目录下生成的临时 exe**（other exe）的查找、进程检测、清理、启动与完整启动序列。

| 原接口 / 逻辑 | 说明 |
|---------------|------|
| **配置** | `ros_settings.ros_directory`、`rosbot_exe_name`（默认 `RoS-BoT.exe`）、`other_exe_search_patterns`（默认 `['*.exe']`）、`other_exe_exclude_patterns`（`RoS-BoT.exe`、`Uninstall*.exe`、`setup*.exe`）、`auto_start_rosbot`、`auto_start_other_exe`、`startup_delay_seconds`、`process_detection_timeout` |
| **find_rosbot_exe()** | 在目录下找**固定文件名** `rosbot_exe_name`（如 `RoS-BoT.exe`），非 glob。 |
| **find_other_exe_files()** | 按 `search_patterns` 在目录下 glob（如 `*.exe`），再按 `exclude_patterns` 排除（子串匹配），得到「同目录生成的临时 exe」列表。 |
| **find_process_by_exe_name(exe_name)** | psutil 按进程名匹配，再 `find_window_by_pid` 取窗口信息。 |
| **find_window_by_pid(pid)** | win32 `EnumWindows` + `GetWindowThreadProcessId`。 |
| **check_process_running(exe_name)** | `find_process_by_exe_name`；若为 `rosbot_exe_name` 则回退到按窗口标题匹配。 |
| **kill_process_by_pid(pid, exe_name)** | taskkill /F /PID。 |
| **cleanup_old_other_exe_processes()** | 对每个 other exe：若在跑则先 **send_f7_to_process** 再 kill。 |
| **wait_for_new_other_exe(timeout)** | 轮询 `find_other_exe_files` + `find_process_by_exe_name`，等待 RoS-BoT 生成新的 other exe 并返回。 |
| **start_rosbot_sequence(force_cleanup=None)** | 校验目录 → find_rosbot_exe → 若 force_cleanup：cleanup_old_other_exe_processes + 杀旧 RoS-BoT.exe → start_executable(主 exe) → wait_for_process(主 exe) → wait_for_new_other_exe(60) → activate_and_analyze_window（WindowAnalyzer、IntegratedAutomationController）。 |

依赖（已废弃模块）：`utils.window_activator`、`utils.window_analyzer`、`utils.integrated_automation_controller`；`providor.providor_second.CONFIG`、`load_config`。

**当前新类库（d3utils/rosbot_manager.py）已补全的细节点**：配置（rosbot_exe_name、other_exe_search_patterns、other_exe_exclude_patterns、startup_delay、process_detection_timeout）、validate_ros_directory、find_rosbot_exe（先精确名再 pattern）、find_other_exe_files（全路径 + 配置排除）、find_window_by_pid、find_process_by_exe_name、check_process_running（含按标题回退）、start_executable、wait_for_process、send_f7_to_process、cleanup_old_other_exe_processes(send_f7_before_kill)、wait_for_new_other_exe。

**新类库不足（相对原 RoSBotManager）**：
- **无 activate_and_analyze_window**：原类用 WindowAnalyzer、IntegratedAutomationController 做窗口分析与 UI 自动化；新类不依赖废弃模块（utils.window_analyzer、utils.integrated_automation_controller），故未实现。
- **无完整 start_rosbot_sequence 编排**：原类内部串联「validate → find_rosbot_exe → cleanup（可选）→ 杀旧主 exe（可选）→ start 主 exe → wait_for_process(主 exe) → wait_for_new_other_exe → activate_and_analyze_window」；新类只提供单步能力（kill_if_running、start、cleanup_old_other_exe_processes、wait_for_process、wait_for_new_other_exe），由调用方（如 controller）编排；若需完整序列可自行调用上述方法组合。
- **send_f7_before_kill 为可选且依赖 win32**：cleanup_old_other_exe_processes(send_f7_before_kill=True) 需 win32api/win32gui/win32con，若未安装则 send_f7_to_process 直接返回 False，仅做 k。

---

## 1. ROSBOT 管理类库（d3utils/rosbot_manager.py，当前使用）

| 接口 | 职责 |
|------|------|
| **get_ros_directory()** | 从 CONFIG ros_settings.ros_directory 取目录，校验存在后返回。 |
| **find_rosbot_exe()** | 在目录下按 `ROSBOT_EXE_PATTERNS`（如 `ros-bot*.exe`、`RoS-BoT*.exe`）找主 exe，返回第一个匹配的完整路径。 |
| **find_same_dir_exe_names()** | 列出同目录下除主程序与 install/uninstall 外的 exe  basename，即「同目录生成的临时 exe」作为进程名时的候选。 |
| **is_running()** | 用 psutil 判断是否有进程的 exe 路径位于 ros_directory 下（主程序或同目录临时 exe 均在列）。 |
| **kill_if_running()** | 收集上述进程的 PID，逐个 `process_helper.kill_process_by_pid(pid)`（k）。 |
| **start()** | 调用 `find_rosbot_exe()` 得到主 exe 路径，`Popen(exe_path, cwd=dir)` 启动。 |
| **get_rosbot_manager(ros_directory=None)** | 全局单例；可选覆盖 ros_directory。 |

**注意**：进程检测与 k 均基于「exe 路径是否在 ros_directory 下」，不依赖固定 exe 名，故主程序与同目录生成的临时 exe 都会被识别并可在启动前统一 k 掉。

---

## 2. 入口：启动 ROSBOT 按钮

| 位置 | 说明 |
|------|------|
| `ui/panels/rosbot_extension_panel.py` | 按钮 `control_btn`，文案 `rosbot.start_rosbot`（i18n） |
| 绑定 | `command=self._toggle_rosbot` |

点击后调用：`_toggle_rosbot()` → 若未运行则 `_start_rosbot()`。

---

## 3. 启动 ROSBOT 的完整逻辑（主线程）

**文件**：`ui/panels/rosbot_extension_panel.py`

```
_start_rosbot()
  ├─ Step 1: 更新 UI 状态
  │    ├─ self.rosbot_running = True
  │    └─ _update_control_button()  # 按钮改为「停止ROSBOT」红色
  ├─ Step 2: 启用任务线程里的 rosbot_task
  │    └─ set_task_status('rosbot_task', TaskStatus.ENABLED)
  │         → d3utils/task_thread_manager.py
  ├─ Step 3: 执行 ROSBOT 启动（同步，仍在主线程）
  │    └─ rosbot_processor.start_rosbot_task()
  │         → d3utils/rosbot_task_processor.py
  └─ Step 4: 打日志 [ROSBOT] Started monitoring
```

**注意**：`start_rosbot_task()` 是在**主线程**里同步调用的，会阻塞到 `processor.start_rosbot()` 执行完。  
**第一步**：在调用上述 Step 1～4 之前，先执行 `ensure_battlenet_started_and_login_check()`。**状态1 是完整游戏流程；状态2、3 仅用于检测客户端是否掉线，检测到没掉线则回到 1 的流程、从中间处继续**：  
- **状态1（完整流程）**：战网流程（点小图→点 Play→sleep(5)→轮询 D3→resize→`wait_for_and_click_start_game`）或从 D3 中间某处继续执行同一套流程。  
- **状态2、3（掉线检测）**：D3 已运行时先 `detect_d3_already_running_state()` 一次截图，用于**检测是否掉线**（有「开始游戏」或已有 game_tool = 没掉线）。检测到没掉线后**回到状态1的流程、从中间处开始**：检测到 `"start"` 则从「点开始游戏→等 game_tool→M+三连点」继续；检测到 `"game_tool"` 则从「已在游戏中→M+悬赏检测+三连点」继续。检测不到（None）或继续失败则视为掉线，kill D3 后走战网流程。  
战网流程：点击 Play 后 **sleep(5)**，轮询 D3 最多 10 秒，找到则 set_d3_status(True)、resize、**D3 开始游戏等待**（`wait_for_and_click_start_game`）、成功则 k ROSBOT→start→`start_rosbot_task()`→**`run_after_rosbot_start()`**；见 DESIGN.md 3.8、3.11。

---

## 3.5 ROSBOT UI 自动化（启动后点击主档案与 Start botting）

**文件**：`d3utils/rosbot_ui_automation.py`

- **依赖**：uiautomation、win32gui、win32con（pycore.pyfoundations.third_party）；WindowFinder；providor_index.ROSBOT_WINDOW_TITLES（如 RoS-BoT、RoS-BoT.exe、ROSBOT）。
- **入口**：`run_after_rosbot_start(wait_sec=5, do_debug=True, do_tab=True, do_start_botting=True)`。等待 ROSBOT 窗口出现（WindowFinder.find_windows_by_titles(ROSBOT_WINDOW_TITLES)）→ 激活窗口 → uiautomation.ControlFromHandle → **DEBUG 打印可操作元素**（递归遍历控件树，ColorPrint 输出 type、name、automation_id、rect）→ 点击 **主档案** Tab（TabItemControl 名称含 主档案/主檔案/Main Profile）→ 点击 **Start botting!**（ButtonControl automation_id `btnStart` 或名称含 Start botting）。
- **调用时机**：在 `ensure_battlenet_started_and_login_check()` 内，**D3 开始游戏并传送地图**（`d3_start_game_and_teleport_waiter.wait_for_and_click_start_game`）之后、`get_rosbot_manager().start()` 与 `start_rosbot_task()` 之后调用；异常仅打 Yellow 日志。

---

## 3.6 D3 内「开始游戏并传送地图」（d3_start_game_and_teleport_waiter）

**文件**：`d3utils/d3_start_game_and_teleport_waiter.py`

**状态1 = 完整游戏流程（唯一流程）；状态2、3 = 检测客户端是否掉线**，检测到没掉线则**回到 1 的流程、从中间处继续**：  
1. **状态1（完整流程）**：战网 → 点 Play → sleep(5) → 轮询 D3 → resize → `wait_for_and_click_start_game`；或从 D3 中间某处继续执行同一套流程。  
2. **状态2、3（掉线检测）**：D3 已运行时 `detect_d3_already_running_state()` 一次截图，用于**检测是否掉线**（有开始游戏界面或已有 game_tool = 没掉线）。没掉线则**从 1 的流程中间处继续**：检测到 `"start"` 从「点开始游戏→等 game_tool→M+三连点」继续；检测到 `"game_tool"` 从「已在游戏中→M+悬赏检测+三连点」继续。None 或失败则 kill D3 后走战网流程。

- **开始游戏**：`config/constants.py` 中 `D3_START_GAME_BUTTON_FILENAME`、`D3_START_GAME_BUTTON_TEMPLATE_NAME`、`D3_START_GAME_WAIT_INTERVAL_SEC`（2.0）、`D3_START_GAME_MAX_ATTEMPTS`（10）；模板 `D3_TEMPLATE_CONFIGS["d3_start_game_button"]`，`match_method": "SIFT"`。入口 `wait_for_and_click_start_game(interval_sec=2.0, wait_after_click_sec=2.0)`：每 **2 秒** 对 D3 截图，SIFT 匹配 `d3_start_game_button`，最多 **10 次**（20 秒）；找到则点击、wait 2 秒；超时返回 False，由调用方重启战网并从头重试。
- **游戏工具与传送**：常量 `D3_GAME_TOOL_CLICK_STANDARD = (602, 113)`、`D3_GAME_TOOL_CLICK_SECOND = (749, 421)`、`D3_GAME_TOOL_CLICK_THIRD = (715, 608)`、`D3_GAME_TOOL_AFTER_M_DELAY_SEC`（2.0）、`D3_GAME_TOOL_MAX_ATTEMPTS`（10）。入口 `wait_for_game_tool_then_send_m_and_click`：每 **2 秒** 截图直到匹配到 **d3_game_tool**，然后走**共同最后一步**（见下）；超时返回 False。
- **三个流程的共同最后一步（与前面如何到达无关）**：M 打开地图。用「按一次 M、等 2s、检测一次悬赏进度」两轮方式确认地图已打开（检测到有进度图即说明地图 toggle 开了），再执行三连点 (602,113)、(749,421)、(715,608)。由 `open_map_verify_bounty_then_teleport_three_clicks()` 实现，状态1/2/3 均调用。
- **掉线检测与从中间继续**：状态2、3 仅用于**检测客户端是否掉线**；检测到没掉线后**回到状态1的流程、从中间处继续**，最后都走上述**共同最后一步**。**D3 已运行入口**：`detect_d3_already_running_state()` 得 `"start"` / `"game_tool"` / None。`"start"`：fragment1 + `send_m_then_teleport_three_clicks`（内部即共同最后一步）。`"game_tool"`：fragment2（内部即共同最后一步）。**片段1** `try_fragment1_click_start_game_wait_game_tool()`：有 `d3_start_game_button` 则点击、等 5×2s 出现 `d3_game_tool`；返回 True/False/None。**片段2** `try_fragment2_game_tool_press_m_then_clicks()`：有 `d3_game_tool` 则调用共同最后一步。
- **失败时**：若 `wait_for_and_click_start_game()` 返回 False，`ensure_battlenet_started_and_login_check()` 内调用 **`_restart_battlenet_and_retry_from_step1(bn_path)`**（重启 Battle.net、等 5s），然后 **continue 外层循环**（最多 `max_outer_retries` 轮），从战网截图与 D3 小图匹配重新开始。
- **调用时机**：在 `ensure_battlenet_started_and_login_check()` 内，**resize D3 窗口**之后、**k ROSBOT 再 start ROSBOT** 之前；仅当「开始游戏」+「游戏工具」均成功（或 D3 直连片段成功）才执行 k ROSBOT 与 start ROSBOT，否则重启战网并重试或 kill D3 后走战网。
- **点击调试图**：类库 `d3utils/d3u_common/image_annotator_helper.py` 提供 **`save_click_debug_image(image_source, click_points, output_dir, filename_prefix)`**：在截图上标出点击坐标（圆+标签）并保存到 `config/screenshot_categories.py` 的 **MATCH_DEBUG_DIR**。流程中在 **点击的那一下** 先截屏、生成该次点击的 debug 图、再执行点击：战网小图点击（`login_try_small_map_click`）、Play 点击（`login_try_play_click`）、开始游戏并传送地图三连点（每次点击前截屏并保存 `start_game_teleport_click_1`、`start_game_teleport_click_2`、`start_game_teleport_click_3`）。

---

## 4. ROSBOT 启动实现（rosbot_task_processor）

**文件**：`d3utils/rosbot_task_processor.py`

| 函数/类 | 作用 |
|---------|------|
| `start_rosbot_task()` | 模块级入口：取全局 processor，调 `processor.start_rosbot()` |
| `get_rosbot_processor()` | 返回单例 `RosbotTaskProcessor` |
| `RosbotTaskProcessor.start_rosbot()` | 实际启动逻辑 |

**start_rosbot() 内部顺序**：

1. 若未初始化：`initialize()` → `set_log_file(~\Documents\RoS-BoT\Logs\logs.txt)`
2. `set_rosbot_running(True)` → **LogMonitor** 全速监控
3. `self.game_state.set_rosbot_status(True)` → **D3State** 更新并通知回调

---

## 5. 线程：任务线程管理器

**文件**：`d3utils/task_thread_manager.py`

| 类/函数 | 说明 |
|---------|------|
| `TaskThreadManager` | 管理所有已注册的 `TaskThread` |
| `TaskThread` | 单个后台线程：按 `interval` 轮询，当 `status == ENABLED` 时执行 `task_func()` |
| `set_task_status(name, status)` | 设置任务状态（如 `rosbot_task` → `ENABLED`） |
| `get_task_manager()` | 全局单例 |

**rosbot_task 的注册**（应用启动时）：

**文件**：`d3utils/system_initializer.py` → `_init_task_thread_manager()`

```python
register_task(
    name='rosbot_task',
    task_func=rosbot_processor.process_rosbot_task,  # 每轮调用的函数
    interval=1.0
)
start_all_tasks()  # 启动所有任务线程
```

即：**后台线程**每隔 1 秒调用一次 `process_rosbot_task()`；当前 `process_rosbot_task()` 为空（`pass`），真正启动是在主线程的 `start_rosbot_task()` 里完成的。

---

## 6. 相关操作类库一览

| 模块/类 | 路径 | 职责 |
|---------|------|------|
| **RosbotExtensionPanel** | `ui/panels/rosbot_extension_panel.py` | 启动/停止按钮、配置、日志区；调 set_task_status + start_rosbot_task |
| **rosbot_task_processor** | `d3utils/rosbot_task_processor.py` | `RosbotTaskProcessor`、`start_rosbot_task()`、`stop_rosbot_task()`、`process_rosbot_task()` |
| **TaskThreadManager / TaskThread** | `d3utils/task_thread_manager.py` | 任务线程的创建、启停、状态（ENABLED/DISABLED） |
| **LogMonitor** | `d3utils/log_monitor.py` | 监控 ROSBOT 日志文件；`set_rosbot_running(True/False)` 控制是否全速轮询 |
| **GameState (D3State)** | `share/game_interface_data.py` | `set_rosbot_status(running)`，通知已注册回调（如面板的 `_on_game_state_changed`） |
| **SystemInitializer** | `d3utils/system_initializer.py` | 启动时注册 `rosbot_task` 并 `start_all_tasks()` |
| **ROSBOTManager** | `d3utils/rosbot_manager.py` | 目录配置、find_rosbot_exe、同目录临时 exe、is_running、kill_if_running（按 PID）、start；D3 稳定后由 ensure_battlenet_started_and_login_check 调用 k + start。 |
| **rosbot_ui_automation** | `d3utils/rosbot_ui_automation.py` | ROSBOT 启动后：用 uiautomation（pycore third_party）找 ROSBOT 窗口（ROSBOT_WINDOW_TITLES），DEBUG 打印可操作元素，点击「主档案」Tab、点击「Start botting!」；入口 `run_after_rosbot_start()`。 |

---

## 7. 状态回调与 UI 更新

**文件**：`ui/panels/rosbot_extension_panel.py`

- 面板在 `__init__` 中：`self.game_state.register_callback(self._on_game_state_changed)`
- `game_state.set_rosbot_status(True)` 被调用后，会 `_notify_callbacks(state)`
- `_on_game_state_changed(state)` 在**任意线程**被调用，内部用 `self.container.after(0, lambda: self._update_ui_from_state(state))` 把 UI 更新投递到**主线程**
- `_update_ui_from_state()` 更新 ROS/D3/地图/阶段等状态显示

**状态栏对齐**：ROS / D3 / 阶段 / 地图 四行，i18n 键为 `rosbot.ros_status`、`rosbot.d3_status`、`rosbot.map_status`、`rosbot.stage`（中文为「ROS」「D3」「地图」「阶段」），值为运行中/未运行/未知。

---

## 8. 流程简图

```
[用户点击「启动ROSBOT」]
       ↓
RosbotExtensionPanel._toggle_rosbot → _start_rosbot (主线程)
       ↓
ensure_battlenet_started_and_login_check()  ← 第一步（外层最多 max_outer_retries 轮，内层每轮最多 max_rounds 次）
       │  每轮：战网未找到→start；杀 D3→等 5s；托盘→activate_window→截图
       │  need-login → restart(bn_path) → 等 5 秒 → continue
       │  无 D3 小图 → 国服？(OCR 您同意/使用网易账号登录或注册) → 是：国服流程(点您同意首字→点网易登录→等 5s→全屏 OCR 点登陆)→continue；否：restart→等 5 秒→continue
       │  有 D3 小图 → break → 点 D3 小图→点 Play
       ↓
sleep(5) → 轮询 D3 窗口（WindowFinder, use_cache=True），最多 10 秒
       │  若「开始游戏」或「游戏工具」超时 → _restart_battlenet_and_retry_from_step1(bn_path) → continue 外层
       ↓
[找到 D3 窗口] → set_d3_status(True) → kill_if_running() → start()（若 auto_start_rosbot）→ start_rosbot_task() → run_after_rosbot_start()（DEBUG 打印可操作元素、点主档案、点 Start botting!）
       ↓
set_task_status('rosbot_task', ENABLED)   ← 任务线程之后每 1s 会执行 process_rosbot_task()
       ↓
rosbot_processor.start_rosbot_task()     ← 主线程同步执行（若上一步已执行则此处为二次调用；通常由 ensure_* 内已调）
       ↓
RosbotTaskProcessor.start_rosbot()
       ├─ set_log_file(...) 若未初始化
       ├─ set_rosbot_running(True)        → LogMonitor 全速监控
       └─ game_state.set_rosbot_status(True)  → D3State 通知回调
              ↓
       _on_game_state_changed(state)      → container.after(0, _update_ui_from_state)
              ↓
       UI 状态栏更新（ROS/D3/地图/阶段）
```
