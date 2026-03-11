# 技术说明：ROSBOT_WINDOW_FIND、_obsolete_window_analyzer、game_assistant_controller

**目的**：说明此三处文件的职责、易被误解或改错的原因，以及正确约定。**修改前请先通读本说明。**

**涉及文件**：
- `docs/ROSBOT_WINDOW_FIND.md`
- `utils/_obsolete_window_analyzer.py`
- `controller/game_assistant_controller.py`

---

## 一、docs/ROSBOT_WINDOW_FIND.md

### 1.1 职责与约定

- **用途**：ROSBOT 窗口查找逻辑的权威说明。核心为**仅按进程找**：枚举 exe 路径在「ROS 目录」下的所有进程，对每个 PID 取主窗口（find_window_by_pid）；优先返回有非空 title 的窗口。**不按固定标题**（RoS-BoT/ROSBOT）查找，因启动后实际 UI 窗口往往属于同目录 other exe，标题与 exe 名都可能变化。实现位置：`d3utils/rosbot_manager.py` 的 `get_rosbot_window()`、`_pids_with_exe_under_ros_dir()`、`find_window_by_pid(pid)`；调用入口 `d3utils/rosbot_ui_automation.py` 的 `run_after_rosbot_start()` 内轮询 get_rosbot_window。
- **配置 ros_directory**：来源 `CONFIG["ros_settings"]["ros_directory"]`，可为**目录**或**主 exe 路径**。`_ros_dir_norm_for_pid` 用于 PID 匹配：若配置是 exe 路径则 `os.path.dirname(_ros_directory)`，否则为配置目录。`get_ros_directory()`、`find_rosbot_exe()`、`start()`、`is_running()`、`kill_if_running()` 均依赖此。标题唯一来源是 `win32gui.GetWindowText(hwnd)`，与 exe 名、窗口类名无关。
- **与原 _obsolete_ 对照**：找窗等价于原 wait_for_new_other_exe → find_window_by_pid；当前 ROSBOTManager 启动用 **Popen**（与原 _obsolete_rosbot_manager 一致），战网用 **explorer**（与 _obsolete_process_manager 一致）。等主界面：找到窗口后 SERVER_WAIT 10s，再轮询主档案 Tab；执行 uiautomation 前**再次调用 get_rosbot_window()** 取当前 hwnd，避免句柄失效。

### 1.2 易错点

- 若按「固定标题」查找 ROSBOT 窗口会找不到（文档明确不按标题）；改 ros_directory 语义或 _ros_dir_norm_for_pid 未与 is_running/kill_if_running/get_rosbot_window 一致会 PID 集合错；改 run_after_rosbot_start 的 wait_sec 或等主界面逻辑未与文档同步会超时或漏等；删或改「再次调用 get_rosbot_window()」会长时间等待后句柄失效。

### 1.3 正确做法

- 修改 ROSBOT 窗口查找、rosbot_manager、run_after_rosbot_start 前必读本文档；凡「找 ROSBOT 窗口」统一用 get_rosbot_manager().get_rosbot_window()，不按标题枚举；改 ros_settings.ros_directory 或 _ros_dir_norm_for_pid 时与 get_ros_directory、_pids_with_exe_under_ros_dir 对照；与 _obsolete_rosbot_manager 差异（如等窗 60s vs 当前 wait_sec）在文档中已写明，改实现须同步文档。

---

## 二、utils/_obsolete_window_analyzer.py

### 2.1 职责与约定

- **用途**：**已废弃**。WindowAnalyzer 用 `get_window_by_titles(window_titles)` **按标题**枚举窗口（win32gui.EnumWindows，对每个 hwnd 若 `title in window_title` 则返回），与 ROSBOT_WINDOW_FIND 的「仅按进程找、不按固定标题」**完全相反**。使用 DEBUG_DIR（providor_second）、utils.color_print；current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) 即项目根（utils 的 parent）。提供 get_window_info、enumerate_controls_ui_automation、enumerate_child_windows_legacy、take_screenshot、draw_element_numbers、analyze_window 等，用于历史调试/分析，非当前 ROSBOT 找窗流程。
- **约定**：不引用、不扩展；删前必 grep 全仓确认无 import 或引用；若误用本类找 ROSBOT 窗口会与 rosbot_manager.get_rosbot_window() 及 ROSBOT_WINDOW_FIND 约定冲突（按标题找不到 other exe 窗口）。

### 2.2 易错点

- 误引用或在新逻辑中调用 WindowAnalyzer.get_window_by_titles 做 ROSBOT 找窗会违反「仅按进程找」；删文件未 grep 会导致 ImportError；将本文件与 rosbot_manager 或 ROSBOT_WINDOW_FIND 混为一谈会改错实现或文档。

### 2.3 正确做法

- 凡 ROSBOT 找窗统一用 rosbot_manager.get_rosbot_window() 及 docs/ROSBOT_WINDOW_FIND.md 约定；不引用 _obsolete_window_analyzer；删前 grep _obsolete_window_analyzer、WindowAnalyzer。

---

## 三、controller/game_assistant_controller.py

### 3.1 职责与约定

- **用途**：游戏助手功能控制器（卡奈魔盒/铁匠等）。current_dir = os.path.dirname(os.path.abspath(__file__))（controller/），project_root = os.path.dirname(current_dir)（项目根）。依赖：can_start_assistant、set_assistant_running、should_stop_assistant、reset_assistant_state（providor_index）；D3InterfaceManager、get_d3_scaled_template_matcher、get_game_interface_data；先 **collect_ui_info(force_new_capture=True)**，再取 shared_data.game_window_image 做 **_detect_interface_from_full_window**（全窗口匹配，且 match center 须在 **left 30%**）：bag_opened_indicator → blacksmith，kanai_cube_left_panel_indicator → kanai_cube；再 **collect_bag_info_from_current_shared**（不二次截图）；然后根据 interface_type 调 get_kanai_cube_handler().handle_upgrade_operation() 或 get_blacksmith_handler() 的 handle_auto_salvage_by_slots / handle_salvage_operation。LEFT_REGION_RATIO=0.3、TEMPLATE_BAG_OPENED、TEMPLATE_KANAI_LEFT 为模板名与左区判定。
- **约定**：须遵守技术说明_slot_line_scan与interface_manager 中「**先 collect_ui 再 collect_bag**」「Optimized 与 Anchor 不可混用」；assistant 状态由 providor_index 的 can_start_assistant/set_assistant_running/should_stop_assistant/reset_assistant_state 控制；auto_salvage 取自 CONFIG["macro_configs"]["auxiliary_config"]["auto_salvage"]（enabled、keep）；热键触发后一次截图、全窗口匹配、中心在左 30% 才认定界面类型。

### 3.2 易错点

- 先 collect_bag 再 collect_ui 或混用 Optimized/Anchor 会违反 interface_manager 约定；改 LEFT_REGION_RATIO 或 TEMPLATE_* 未与 get_d3_scaled_template_matcher、模板配置同步会匹配错；改 assistant 状态未通过 providor_index 的四个函数会与热键/面板状态不同步；改 game_window_image 的写入时机或来源未与 collect_ui_info、get_game_interface_data 对照会 _detect_interface_from_full_window 拿到空或旧图。

### 3.3 正确做法

- 修改前通读技术说明_slot_line_scan与interface_manager 及本技术说明；保持「先 collect_ui_info 再 collect_bag_info_from_current_shared」；assistant 状态仅经 providor_index 的 can_start_assistant/set_assistant_running/should_stop_assistant/reset_assistant_state；改模板名或左区比例与 d3_scaled_template_matcher、模板配置一致。

---

## 四、三处交叉注意

- **ROSBOT_WINDOW_FIND** 与 rosbot_manager、run_after_rosbot_start、_obsolete_rosbot_manager 对照；**_obsolete_window_analyzer** 与 ROSBOT 找窗无关，按标题找窗已废弃，勿引用；**game_assistant_controller** 与 interface_manager、providor_index、template 配置、LEFT_REGION_RATIO 一致。修改前请先通读本说明及三处文件与对应消费者。
