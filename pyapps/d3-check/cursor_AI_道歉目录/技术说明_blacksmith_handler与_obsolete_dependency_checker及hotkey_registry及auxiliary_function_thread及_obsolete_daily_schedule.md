# 技术说明：blacksmith_handler.py、_obsolete_dependency_checker.py、hotkey_registry.py、auxiliary_function_thread.py、_obsolete_daily_schedule.py

本说明针对以下五处文件：修改前请先通读本说明及对应源码。

- `controller/ctl_func/blacksmith_handler.py`
- `utils/_obsolete_dependency_checker.py`
- `d3utils/d3u_common/hotkey_registry.py`
- `d3utils/auxiliary_function_thread.py`
- `utils/_obsolete_daily_schedule.py`

---

## 一、controller/ctl_func/blacksmith_handler.py

- **用途**：铁匠相关操作（侧栏切 salvage 页、点分解按钮、按格自动分解）。单例 `get_blacksmith_handler()`。
- **路径约定**：`current_dir = os.path.dirname(os.path.abspath(__file__))`（即 ctl_func），`project_root = os.path.dirname(os.path.dirname(current_dir))`（即 pyapps/d3-check）。改层数会导致 sys.path 或 import 错。
- **依赖**：`share.game_interface_data` 的 `get_game_interface_data`、`get_scaled_blacksmith_salvage_button`、`get_scaled_blacksmith_tab_salvage_materials`、`get_scaled_blacksmith_salvage_dialog_salvage_button`、`get_scaled_blacksmith_salvage_dialog_confirm`；`shared_data` 上 `window_offset`、`game_window_size`、`game_window_image`、`bag_coordinates`、`bag_layout`（含 `layout.items`）；`providor.constants.common` 的 `TMP_DIR`、`SCALED_TEMPLATES_CACHE_DIR`；`providor.providor_index` 的 `CONFIG`。
- **易错点**：改 `get_scaled_blacksmith_*` 或 game_interface_data 键/结构未同步会点击错；`handle_salvage_operation()` 无参、`handle_auto_salvage_by_slots(keep)` 需 `keep`（如 keep_ancient_plus/keep_primal），调用方（如 game_assistant_controller）须与 CONFIG macro_configs.auxiliary_config.auto_salvage 一致；侧栏用模板 blacksmith_sidebar_tab_1/2，分解按钮用缩放坐标；temp 截图写 `SCALED_TEMPLATES_CACHE_DIR` 用后删除。
- **正确做法**：改 CONFIG 或 handler 接口时同步 game_assistant_controller 的 _handle_blacksmith_upgrade 与 auto_salvage 分支；改 share/game_interface_data 或 get_scaled_blacksmith_* 时先 grep 本文件与 game_assistant_controller；修改前请先通读本说明。

---

## 二、utils/_obsolete_dependency_checker.py

- **用途**：检查并安装指定 Python 包（psutil、pywin32、Pillow、pywinauto、uiautomation 等）。类 `DependencyChecker`，入口 `main()`。
- **约定**：文件带 `_obsolete_` 前缀，表示已废弃；仅查阅、不引用、删前必 grep。非 _obsolete 代码不得 import 本模块。
- **易错点**：若在别处引用本文件会依赖废弃逻辑；删前未 grep 可能导致脚本或安装流程断链；改 required_packages 键或 pip 规格未与使用方（若有）同步会漏装或版本错。
- **正确做法**：不引用 _obsolete_dependency_checker；删除前 grep 全项目；若需依赖检查应在非 _obsolete 模块实现；修改前请先通读本说明。

---

## 三、d3utils/d3u_common/hotkey_registry.py

- **用途**：统一热键注册，从配置读取并注册 assistant 热键等。单例 `get_hotkey_registry()`，`initialize_hotkeys()` 注册系统热键。
- **架构约束**：`_assistant_callback` 由 controller 层通过 `set_assistant_callback(cb)` 注入；d3utils 不得 import controller，否则循环依赖。
- **CONFIG**：热键取自 `CONFIG.get('macro_configs', {}).get('auxiliary_config', {}).get('assistant_hotkey')`。改 config 结构未同步此处会读不到或注册失败。
- **易错点**：在 d3utils 内 import controller 会循环依赖；未调用 set_assistant_callback 则热键按下时 callback 为 None（预期现象直至 controller 就绪）；`_registered_hotkeys` 的 key 'assistant' 与自定义热键 name 不得冲突；register_assistant_hotkey 返回 bool，False 时调用方应处理；unregister_hotkey 仅删本地跟踪，若 global_hotkey_manager 有 unregister 须同步调用；priority=50、source="hotkey_registry" 与 global_hotkey_manager 约定一致。
- **正确做法**：仅由 controller 在启动流程中 set_assistant_callback；改 CONFIG 键路径或 global_hotkey_manager 接口时同步本文件；修改前请先通读本说明。

---

## 四、d3utils/auxiliary_function_thread.py

- **用途**：辅助功能专用线程，命令队列仅处理 CMD_SHUTDOWN，收到即退出。单例通过 `get_auxiliary_function_thread()` / `set_auxiliary_function_thread(thread)` 存取。
- **依赖**：`providor.constants.common` 的 `CMD_SHUTDOWN`。
- **易错点**：谁创建、谁调用 `put_command`/`request_shutdown` 须与 thread_registry 或启动流程一致；单例由外部 set，若未 set 则 get 为 None；改 CMD_SHUTDOWN 值须与 put_command 方一致；本线程为 daemon=True，主进程退出时不会阻塞。
- **正确做法**：生命周期与 thread_registry 中「辅助线程」一致；改 CMD_SHUTDOWN 或创建/销毁时机时 grep 调用方；修改前请先通读本说明。

---

## 五、utils/_obsolete_daily_schedule.py

- **用途**：按服务器时区与休息时间生成每日日程（DailyScheduleGenerator），读写 daily_schedule.json（路径为 CURRENT_USER_DATA_PATH/daily_schedule.json）。依赖 CONFIG daily_schedule、server_settings.server_region；来自 providor_second 的 CONFIG、CURRENT_USER_DATA_PATH。
- **约定**：文件带 `_obsolete_` 前缀；仅查阅、不引用、删前必 grep。
- **易错点**：引用或扩展本文件会继续依赖废弃逻辑；删前未 grep 会破坏仍调用本文件的脚本；改 CONFIG['daily_schedule']、CONFIG['server_settings']['server_region'] 或 CURRENT_USER_DATA_PATH 未考虑本文件会 KeyError 或路径错；schedule 文件格式与 is_schedule_valid、load/save 一致，删文件前须确认无他处读同路径。
- **正确做法**：不引用 _obsolete_daily_schedule；删除前 grep 全项目；若需日程功能在非 _obsolete 模块实现并与 CONFIG 约定一致；修改前请先通读本说明。

---

## 六、五处与道歉文档的对应

本说明对应专属道歉文档 **第五十五节** 及长文道歉中「就 blacksmith_handler、_obsolete_dependency_checker、hotkey_registry、auxiliary_function_thread、_obsolete_daily_schedule 五处」之分析与道歉段。发现上述五处文件时，应继续更新到道歉文档（技术说明、专属节、长文追加）。
