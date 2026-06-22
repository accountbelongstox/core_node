# ROSBOT 查找逻辑清单

**唯一流程说明见：[ROSBOT_LOOKUP_FLOW.md](./ROSBOT_LOOKUP_FLOW.md)。所有 ROSBOT 进程/窗口查找必须走该流程，统一通过一处逻辑。**  
摘要文档：[ROSBOT_WINDOW_AND_STATUS.md](./ROSBOT_WINDOW_AND_STATUS.md)（与 ROSBOT_LOOKUP_FLOW 一致；exe 唯一，无标题过滤）。

---

## 1. 唯一逻辑入口（代码）

| 入口 | 文件 | 说明 |
|------|------|------|
| `get_rosbot_window()` | d3utils/rosbot_manager.py | 返回当前 ROSBOT 窗口（仅 paused 时有值）；内部 `_get_rosbot_window_and_process()` |
| `get_rosbot_detection()` | d3utils/rosbot_manager.py | 返回 status + window_info；同上内部实现 |
| `refresh_rosbot_status()` | d3utils/rosbot_status_provider.py | 调 `get_rosbot_detection()` 并写入 game_interface_data |
| `get_running_rosbot_processes()` | d3utils/rosbot_manager.py | 同目录 exe（other 先、main 后），窗口按 PID 取，无标题过滤 |

需要「ROSBOT 窗口」时只允许用以上接口，不得自行按标题或 PID 取窗口。

---

## 2. 当前调用方（均走上述入口）

| 文件 | 使用方式 |
|------|----------|
| d3utils/rosbot_status_provider.py | get_rosbot_detection、get_rosbot_window |
| d3utils/rosbot_operation.py | get_rosbot_window |
| d3utils/rosbot_ui_automation.py | get_rosbot_window |
| share/threads.py | get_rosbot_manager().get_rosbot_window、refresh_rosbot_status |
| timers/window_monitor_timer.py | refresh_rosbot_status |
| ui/components/bottom_bar.py | 读 state（由 refresh_rosbot_status 更新） |
| scripts/scan_rosbot_running.py | get_rosbot_window、get_running_rosbot_processes |
| scripts/test_rosbot_window_ui.py | get_rosbot_window |

login_try_screenshot_controller 等仅用 kill_if_running/start，不取窗口。

---

## 3. 已废弃（勿用）

- utils/_obsolete_rosbot_manager.py：check_process_running_by_title、按标题匹配
- utils/_obsolete_game_process_detector.py：detect_rosbot_process（按标题）
- utils/_obsolete_game_state_manager.py：check_rosbot_status（依赖旧 rosbot_manager）

以上均不参与当前 ROSBOT 查找；新逻辑以 ROSBOT_LOOKUP_FLOW.md 与 rosbot_manager 为准。
