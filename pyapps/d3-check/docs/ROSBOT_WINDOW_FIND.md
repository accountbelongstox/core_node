# ROSBOT 窗口查找逻辑

## 背景

ROS 启动后，主程序（如 RoS-BoT.exe）会在同目录下生成并运行另一个 exe（other exe），**实际 UI 窗口往往属于该进程**，窗口标题未必是 RoS-BoT/ROSBOT。若仅按固定标题（如 `RoS-BoT`、`RoS-BoT.exe`、`ROSBOT`）查找，会找不到窗口。

## 查找策略

- **仅按进程找**：枚举 exe 路径在「ROS 目录」下的所有进程，对每个 PID 取主窗口；优先返回有非空标题的窗口。不按固定标题（RoS-BoT/ROSBOT）查找，因启动后标题与 exe 名都可能变化（见原 `_obsolete_rosbot_manager`）。

## 实现位置

| 内容 | 文件 | 说明 |
|------|------|------|
| 按进程找窗口 | `d3utils/rosbot_manager.py` | `ROSBOTManager.get_rosbot_window()` |
| 调用入口 | `d3utils/rosbot_ui_automation.py` | `run_after_rosbot_start()` 内轮询；找到后打印 title/pid/exe_name/exe_path，再等主界面就绪后点主档案/Start |

---

## 配置：ros_directory

- **来源**：`CONFIG["ros_settings"]["ros_directory"]`，UI 中可配置为**目录**或**主 exe 路径**。
- **内部变量**（`ROSBOTManager.__init__`）：
  - `_ros_directory`：原始配置字符串。
  - `_ros_dir_norm`：`_normpath(_ros_directory)`，用于其它逻辑。
  - `_ros_dir_norm_for_pid`：用于「进程是否在 ROS 目录下」判断的**目录**：
    - 若 `_ros_directory` 是文件路径 → `_normpath(os.path.dirname(_ros_directory))`；
    - 否则 → `_normpath(_ros_directory)`。
- **get_ros_directory()**：返回实际工作目录。若配置是目录则返回该目录；若配置是 exe 路径则返回其所在目录；无效则返回 `None`。`find_rosbot_exe()`、`start()` 等均依赖此返回值。

---

## _pids_with_exe_under_ros_dir()（rosbot_manager.py）

- **作用**：得到所有「进程 exe 在 ROS 目录下」的 PID 集合（主 exe 与同目录 other exe 都算）。
- **依据**：`_ros_dir_norm_for_pid`（一定是目录，且配置为 exe 时自动取 dirname）。
- **匹配规则**（psutil 遍历进程，取 `exe` 并 `_normpath`）：
  - `exe_norm == _ros_dir_norm_for_pid`（exe 恰好是该目录，极少见），或
  - `exe_norm.startswith(_ros_dir_norm_for_pid + os.sep)`（exe 在该目录或其子目录下）。
- **依赖**：psutil。若未安装或 `_ros_dir_norm_for_pid` 为空，返回空集合。

---

## 如何找到标题

- **调用链**：`run_after_rosbot_start()` → `get_rosbot_manager().get_rosbot_window()` → 对每个「exe 在 ROS 目录下」的 PID 调用 `find_window_by_pid(pid)`。
- **find_window_by_pid(pid)**（rosbot_manager.py）：`win32gui.EnumWindows` 枚举所有顶层窗口，对每个窗口若 `IsWindowVisible(hwnd)` 且 `GetWindowThreadProcessId(hwnd)` 等于该 `pid`，则 **`title = win32gui.GetWindowText(hwnd)`**，写入返回的 `{"hwnd", "title", "pid"}`。即**标题唯一来源是 Win32 API GetWindowText(hwnd)**，与 exe 名、窗口类名无关。
- **get_rosbot_window()** 优先返回 `title` 非空的那条（主 UI 窗口通常有标题），否则返回第一个找到的窗口。

---

## get_rosbot_window()（rosbot_manager.py）

- **步骤**：
  1. `_pids_with_exe_under_ros_dir()` 得到 PID 集合。
  2. 对每个 PID 调用 `find_window_by_pid(pid)`。
  3. 若有窗口的 `title` 非空，立即返回该窗口（优先有标题的 UI 窗口）。
  4. 否则返回第一个找到的窗口；都没有则返回 `None`。
- **返回**：`{"hwnd": int, "title": str, "pid": int}` 或 `None`。

---

## run_after_rosbot_start() 中的等待（rosbot_ui_automation.py）

- 在 `wait_sec` 秒内每秒轮询一次：仅调用 `get_rosbot_manager().get_rosbot_window()`，若返回的 `hwnd` 有效则用该窗口，结束轮询；否则 `sleep(1)`。
- 超时仍未找到则打 Yellow 日志并返回 False。
- 找到窗口后：打印 **title、pid、exe_name、exe_path**（由 psutil 从 pid 取 exe）；SetForegroundWindow、ShowWindow(SW_RESTORE)。
- **等主界面就绪**（对齐原 `_obsolete_rosbot_manager.start_rosbot_sequence`）：
  1. **SERVER_WAIT**：固定等待 `SERVER_WAIT_SECONDS`（默认 10s）供连接服务器。
  2. **轮询主档案 Tab**：每 `MAIN_UI_POLL_INTERVAL_SECONDS`（2s）取 ControlFromHandle，检查是否存在主档案 TabItemControl；超时 `MAIN_UI_POLL_TIMEOUT_SECONDS`（50s）则仍继续执行。
- 然后 uiautomation 执行 DEBUG 打印、点主档案 Tab、点 Start botting!。

---

## 与原 _obsolete_rosbot_manager 的对应

- **找窗**：原流程为 `wait_for_new_other_exe`（等同目录生成的 other exe 进程出现）→ `find_window_by_pid(pid)` 得到 hwnd/title。当前 `get_rosbot_window()` 等价：枚举同目录下所有进程 PID，对每个 PID 取窗口，优先返回有非空 title 的窗口。
- **标题/exe**：原用 `process_info.get('title')`、exe_name 做日志与激活；当前找到窗口后打印 title、pid、exe_name、exe_path（psutil 从 pid 取）。
- **等主界面**：原在找到 new other exe 后 **SERVER_WAIT 10 秒** 再 `activate_and_analyze_window`。当前在找到窗口后同样先 SERVER_WAIT 10s，再轮询直到主档案 Tab 可见或超时，然后执行 tab/start。
- **启动方式**：原 **_obsolete_rosbot_manager** 用 **subprocess.Popen(exe_path, cwd=..., stdout=DEVNULL, stderr=DEVNULL)**，不用 explorer 也不用 cmd start。战网 / _obsolete_process_manager 用 **explorer**（`subprocess.run(['explorer', launch_path], ...)`）。当前 `ROSBOTManager.start_executable()` 与**原 ROS 一致**，使用 **Popen**。
- **ControlFromHandle 前**：等主界面轮询结束后、执行 uiautomation 前，**再次调用 get_rosbot_window()** 取当前 hwnd，避免长时间等待后原句柄失效（"An event was unable to invoke any of the subscribers" 等）。

---

## 原代码启动方式对照

| 模块 | 原实现 | 说明 |
|------|--------|------|
| **_obsolete_rosbot_manager** | **subprocess.Popen(exe_path, cwd=..., stdout=DEVNULL, stderr=DEVNULL)** | 直接起进程，不用 explorer，不用 cmd start。 |
| **_obsolete_process_manager**（战网用） | **subprocess.run(['explorer', launch_path], ...)** | 用 explorer 启动。 |
| **_obsolete_battlenet_manager** | process_manager.start_program_with_explorer | 即 explorer。 |
| **当前 ROSBOTManager** | Popen（与原 ROS 一致） | 见上。 |
| **当前 BattleNetManager** | subprocess.run(["explorer", str(exe_path)], ...) | 与 process_manager 一致。 |

---

## 当前实现与原逻辑的差异/不足

1. **等窗时间**：原 `wait_for_new_other_exe(60)` 最多等 **60 秒** 让「新 other exe」出现；当前 `run_after_rosbot_start()` 默认 `wait_sec=30`（原逻辑 60 秒）；调用处可传入更大值。若 other exe 出现较慢，可能超时未找到窗；可增大 `wait_sec`（如 30 或 60）或由配置传入。
2. **完整序列**：原有完整 `start_rosbot_sequence`（validate → cleanup → start → wait_for_process → wait_for_new_other_exe → SERVER_WAIT → activate_and_analyze）；当前由 controller 编排（kill_if_running → start → start_rosbot_task → run_after_rosbot_start），无显式 wait_for_new_other_exe，而是轮询 get_rosbot_window（等价：任意同目录进程的窗口）。
3. **startup_delay**：原有 `startup_delay_seconds`（如 3）；当前 controller 在 start 后仅 sleep(1)，run_after_rosbot_start 内再轮询。若需要可在外层或 run_after_rosbot_start 开头加短延迟。

---

## 其它使用同一 PID 集合的逻辑

- **is_running()**：`len(_pids_with_exe_under_ros_dir()) > 0`。
- **kill_if_running()**：对 `_pids_with_exe_under_ros_dir()` 中每个 PID 调用 `kill_process_by_pid(pid)`。
- 因此「是否在跑」「杀进程」与「找窗口」对「ROS 目录」的认定一致（都基于 `_ros_dir_norm_for_pid`）。

---

## 排查建议

- 若始终找不到窗口：
  1. 确认 `ros_settings.ros_directory` 已配置且指向有效目录或主 exe 路径。
  2. 确认 ROS 进程已启动，且其 exe 路径确实在该目录（或其子目录）下。
  3. 若配置的是 exe 路径，确认该路径存在；代码会用其所在目录做 PID 匹配。
- 若按标题能找到、按进程找不到：多为配置为空、路径错误、或 exe 实际不在该目录下（如从别处启动）。
