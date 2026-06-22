# ROSBOT 查找流程（唯一逻辑）

**约定：所有「找 ROSBOT 进程/窗口」的代码必须只走本流程；按 exe 找进程，按 PID 取窗口，不做标题过滤（同目录 exe 唯一）。**

---

## 1. 数据源

| 项 | 来源 |
|----|------|
| 目录 | `ros_settings.ros_directory`（配置），由 `get_ros_directory()` 解析 |
| 主 exe 名 | `ros_settings.rosbot_exe_name`（默认 `RoS-BoT.exe`） |
| 同目录 exe 列表 | `find_other_exe_files()`：在 ros_directory 下按配置 pattern 扫 `*.exe`，排除主 exe/Uninstall/setup 等，得到「其它同目录 exe」；主 exe 单独用 `rosbot_exe_name` |

---

## 2. 查找顺序（固定）

1. **先**：遍历「其它同目录 exe」（`find_other_exe_files()` 的每一项）
2. **后**：再查主 exe（`rosbot_exe_name`）

同目录的其它 exe（如生成的 worker exe）优先于主 exe。

---

## 3. 进程怎么找

- **唯一方式**：`find_process_by_exe_name(exe_name)`
  - 用 **psutil** 按进程的 name 或 exe 路径的 basename 匹配 `exe_name`
  - 且 exe 路径在 `ros_directory` 下（或未配置目录则不限制路径）
- **禁止**：不用窗口标题找进程（不调用 `_check_process_running_by_title` 或任何「标题包含 RoS-BoT」的逻辑）

---

## 4. 窗口怎么找

- **唯一方式**：对上面得到的 PID 调 `find_window_by_pid(pid, visible_only=...)`
- **含义**：只认该 PID 下的窗口；同目录 exe 唯一，不做标题过滤，窗口由 exe→进程→PID 确定。

---

## 5. 唯一入口（对外）

| 需求 | 调用 | 说明 |
|------|------|------|
| 当前 ROSBOT 窗口（仅 paused 时） | `get_rosbot_manager().get_rosbot_window()` | 内部走 `_get_rosbot_window_and_process()` |
| 当前状态（not_found / running / paused） | `get_rosbot_manager().get_rosbot_detection()` | 同上 |
| 刷新到全局状态并取窗口 | `refresh_rosbot_status()` | 内部用 `get_rosbot_detection()`，写 game_interface_data |
| 同目录所有进程列表（含窗口信息） | `get_rosbot_manager().get_running_rosbot_processes()` | 同目录 exe 先 other 后 main，窗口按 PID 取，无标题过滤 |
| 是否在跑（任意同目录 exe 有进程） | `get_rosbot_manager().is_running()` | 仅 `find_process_by_exe_name`，不涉及窗口 |

需要「ROSBOT 窗口」时，必须用 `get_rosbot_window()` 或 `get_rosbot_detection()["window_info"]`，不得自己按标题或 PID 乱取窗口。

---

## 6. 内部单点实现

- **`_get_rosbot_window_and_process()`**（`rosbot_manager.py`）
  - 实现上述顺序 + 进程 + 窗口规则
  - 返回 `(window_info or None, process_found: bool)`
- **`get_rosbot_window()`**：返回 `_get_rosbot_window_and_process()[0]`
- **`get_rosbot_detection()`**：根据 `_get_rosbot_window_and_process()` 的返回值得到 status 和 window_info

其它如 `kill_if_running`、`wait_for_process`、`cleanup_old_other_exe_processes` 等，凡涉及「进程列表」的都用 `find_process_by_exe_name`（同目录 exe）；凡涉及「要操作的窗口」的，都用 `find_window_by_pid(pid, ...)` 或 `get_rosbot_window()`，不做标题过滤。

---

## 7. 流程小结（一句话）

**同目录 exe 列表（先 other 后 main）→ 仅按 exe 名用 psutil 找进程 → 按 PID 取窗口（无标题过滤，exe 唯一）→ 对外只通过 get_rosbot_window / get_rosbot_detection / get_running_rosbot_processes / refresh_rosbot_status 暴露。**
