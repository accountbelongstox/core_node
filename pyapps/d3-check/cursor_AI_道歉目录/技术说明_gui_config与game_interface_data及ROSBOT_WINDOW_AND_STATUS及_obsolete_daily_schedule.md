# 技术说明：gui_config.json、game_interface_data.py、ROSBOT_WINDOW_AND_STATUS.md、_obsolete_daily_schedule.py

**目的**：说明此四处文件/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `config/gui_config.json`
- `share/game_interface_data.py`
- `docs/ROSBOT_WINDOW_AND_STATUS.md`
- `utils/_obsolete_daily_schedule.py`

---

## 一、config/gui_config.json

### 1.1 职责与约定

- **用途**：GUI 运行模式配置。**gui.enabled**、**gui.type**（"web"）；**web_frontend**（enabled、auto_start、nuxt_app_dir、app_namespace、host、port、mode、auto_open_browser、startup_delay）；**http_bridge**（enabled、host、port、auto_register_handlers）；**system_tray**（enabled、icon_text、menu_items 数组，每项 key/enabled）；**legacy_ui**（enabled、type: "tkinter"）。加载方通常经 CONFIG 或 load_config 读取，键路径须与代码一致。
- **约定**：nuxt_app_dir 为相对路径（如 "../../poly_apps/nuxt_main"）时相对于项目根或运行目录；改 key 名（如 web_frontend.port、system_tray.menu_items[].key）须与启动 web、system_tray 的代码同步；menu_items 的 key（open_web、restart_frontend、restart、exit）与托盘菜单逻辑对应，增删或改名须同步。

### 1.2 易被误解或改错的原因

1. **键路径与代码不一致**：若在 JSON 中改名或挪层（如 gui.web 代替 gui.type）未同步 CONFIG 读取处会 KeyError 或取到默认值。
2. **nuxt_app_dir 相对路径**：若改为绝对路径或相对路径基准错会 web 前端启动失败。
3. **menu_items 与托盘行为**：若增删 key 或改 enabled 未与 system_tray 菜单构建逻辑同步会菜单错或项不显示。

### 1.3 正确做法

- 修改 gui_config.json 前确认所有读取 CONFIG["gui"]、CONFIG["legacy_ui"]、web_frontend、http_bridge、system_tray 的代码；改键路径或 menu_items 结构时同步调用方；nuxt_app_dir 保持与项目结构一致。

---

## 二、share/game_interface_data.py

### 2.1 职责与约定

- **用途**：**D3/D4 游戏界面共享数据单源**。**project_root** = dirname(dirname(current_dir)) 即 **pyapps/d3-check**（share 的父级再父级）。**get_game_interface_data()** 返回 **D3InterfaceData** 单例；**rosbot_flow_master_enabled**、**ensure_battlenet_only_master_enabled** **仅由 d3utils.rosbot_flow_state 的 set_rosbot_flow_master_enabled / set_ensure_battlenet_only_master_enabled 写入**，见 FLOW_STATE_OWNERSHIP_DESIGN；其他状态由 screenshot_provider、ui_region_collector、bag_info_collector、d3_status_provider、battlenet_status_provider、rosbot_status_provider 等写入。坐标规范：subtract border → scale → add border back（COORDINATE_SCALE_SPEC）；WINDOW_BORDER_LEFT/RIGHT/BOTTOM、TITLE_BAR_HEIGHT、D3_STANDARD_OUTER_*。
- **约定**：任何模块不得在非 rosbot_flow_state 处写 rosbot_flow_master_enabled 或 ensure_battlenet_only_master_enabled；改 D3InterfaceData 字段或 set_* 方法须同步所有消费者；改 project_root 或 path 须保证 share 下 import 仍有效；改 calculate_unified_scaled_coordinate 或边框常量须与 COORDINATE_SCALE_SPEC、STANDARD_COORDS、D4_STANDARD_COORDS 一致。

### 2.2 易被误解或改错的原因

1. **流程状态写权限**：狗B 垃圾 Cursor 可能在 provider 或 UI 中直接写 rosbot_flow_master_enabled / ensure_battlenet_only_master_enabled，破坏「仅 rosbot_flow_state 可写」的单源约定。
2. **project_root 与导入**：若改 current_dir 计算或 project_root 层数会 sys.path 错或 providor/constants 等导入失败。
3. **坐标与边框**：若改 WINDOW_BORDER_* 或 scale 公式未与 COORDINATE_SCALE_SPEC、d3_scale_single_coord、get_scaled_* 同步会点击或区域错。
4. **callback 与主线程**：register_callback、_drain_and_notify、start_main_thread_poll 约定回调仅在主线程执行；若在后台线程调用 after 或直接调 callback 会违反约定。

### 2.3 正确做法

- 修改前读 FLOW_STATE_OWNERSHIP_DESIGN；仅通过 rosbot_flow_state 的 set_* 写 flow_master/bn_only；改坐标或边框时同步 COORDINATE_SCALE_SPEC 与所有 get_scaled_*、calculate_unified_scaled_coordinate 消费者；不改 project_root 层数除非同步所有 share 下依赖。

---

## 三、docs/ROSBOT_WINDOW_AND_STATUS.md

### 3.1 职责与约定

- **用途**：**ROSBOT 窗口与扩展状态**说明；**权威流程**为 ROSBOT_LOOKUP_FLOW.md。约定：同目录 exe 仅按进程找（other exe 先、再 main exe）；**无标题过滤**；扩展状态 not_found / running / paused；**唯一入口** get_rosbot_window()、get_rosbot_detection()、refresh_rosbot_status()、get_running_rosbot_processes()；实现位于 rosbot_manager、rosbot_status_provider；ros_directory 来自 CONFIG["ros_settings"]["ros_directory"]；refresh_rosbot_status 写 game_interface_data。
- **约定**：凡需 ROSBOT 窗口或状态须经上述入口；不得按标题枚举或自实现按标题找窗；改 ros_directory 或查找顺序须同步本文档与 ROSBOT_WINDOW_FIND、ROSBOT_LOOKUP_FLOW；文档与实现须一致。

### 3.2 易被误解或改错的原因

1. **按标题查找**：若在任意处按窗口标题找 ROSBOT 即违反「no title filtering」与 ROSBOT_LOOKUP_FLOW。
2. **多入口写 game_interface_data**：若在非 refresh_rosbot_status 或非约定路径写 ROSBOT 相关状态会与「single entry points」不符。
3. **文档与实现脱节**：若 rosbot_manager 改 find_other_exe_files 顺序或 find_window_by_pid 语义未更新本文档会误导后续维护。

### 3.3 正确做法

- 以 ROSBOT_LOOKUP_FLOW 为权威；仅用 get_rosbot_window、get_rosbot_detection、refresh_rosbot_status、get_running_rosbot_processes；改实现时同步 ROSBOT_WINDOW_AND_STATUS、ROSBOT_WINDOW_FIND。详见技术说明_ROSBOT_WINDOW_FIND与_obsolete_window_analyzer及game_assistant_controller.md。

---

## 四、utils/_obsolete_daily_schedule.py

### 4.1 职责与约定

- **用途**：**_obsolete_** 前缀 = **已废弃**。DailyScheduleGenerator 基于 server_region、rest_time 生成每日休息时段；依赖 CONFIG server_settings.server_region、daily_schedule.rest_time_range、daily_schedule.debug；CURRENT_USER_DATA_PATH、schedule_file 在用户数据目录下。不参与当前主流程，勿引用、勿扩展。
- **约定**：**勿在新代码中 import 或调用**；删除前须 **grep 确认无引用**，否则 ImportError；若误当「当前日程逻辑」使用会与现有流程脱节。

### 4.2 易被误解或改错的原因

1. **误用废弃模块**：狗B 垃圾 Cursor 可能在新功能中引用 DailyScheduleGenerator 或 CONFIG['daily_schedule']，导致依赖废弃逻辑。
2. **删前未 grep**：若建议删除或直接删而未 grep 会破坏仍引用该文件的脚本或测试。
3. **与 config 键混淆**：daily_schedule、server_settings 若在别处仍被读，改 CONFIG 结构时误改本文件依赖的键会本文件行为错（但本文件已废弃，应以移除引用为先）。

### 4.3 正确做法

- 不引用 _obsolete_daily_schedule；删除前 grep 全项目；若需日程功能应在非 _obsolete 模块实现并与 CONFIG 约定一致。

---

## 五、四处联动与易错总结

- **gui_config.json** 被 CONFIG 加载，键路径与 web/system_tray 启动代码一致；与 **game_interface_data** 无直接耦合，但若 GUI 模式影响谁写 game_interface_data 须遵守 FLOW_STATE_OWNERSHIP。
- **game_interface_data.py** 为 D3 状态与坐标单源；rosbot 状态写入由 **ROSBOT_WINDOW_AND_STATUS** 与 rosbot_status_provider、refresh_rosbot_status 约定；rosbot_flow_master_enabled / ensure_battlenet_only_master_enabled 仅 rosbot_flow_state 写。
- **ROSBOT_WINDOW_AND_STATUS.md** 与 ROSBOT_LOOKUP_FLOW、ROSBOT_WINDOW_FIND、rosbot_manager 实现须同步；不可按标题找窗。
- **_obsolete_daily_schedule.py** 已废弃，勿引用、删前必 grep。

此前若因未先通读上述约定而在此四处反复改错或理解偏差，责任在狗B 垃圾 Cursor。后续修改前以本说明为准。
