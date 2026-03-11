# 技术说明：bn_flow_B5.json、_obsolete_game_state_manager、rosbot_status_provider、ctl_func/__init__、d4_controller

**目的**：说明这五处文件/代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `.cache/bn_flow_snapshots/bn_flow_B5.json`
- `utils/_obsolete_game_state_manager.py`
- `d3utils/rosbot_status_provider.py`
- `controller/ctl_func/__init__.py`
- `controller/d4_controller.py`

---

## 一、.cache/bn_flow_snapshots/bn_flow_B5.json

### 1.1 职责与约定

- **用途**：BN 流程 **B5** 节点运行时快照（UI Automation 控件树）。由 `save_ui_elements_snapshot` 等写入，`meta.node`="B5"、`meta.reason`="B5_exit"；`controls` 为战网窗口在该节点时的控件列表（name、automation_id、type、rect 等）。用于调试、1:1 对照与登录/主界面判断参考。缓存路径由 `providor.constants.common.BN_FLOW_SNAPSHOTS_DIR` 决定（.cache/bn_flow_snapshots）。
- **约定**：结构与 B4/B6/B7/B9/B13 等节点快照一致；下游（battlenet_region_judge、is_on_login_screen、poll 逻辑）若读取快照，需与 meta/controls 结构约定一致；.cache 为运行时产物，可被清理，不应写死为唯一数据源。

### 1.2 易被误解或改错的原因

1. **写死路径或节点名**：若代码写死 `bn_flow_B5.json` 或 .cache 绝对路径，换节点或清理缓存后读不到；应使用 BN_FLOW_SNAPSHOTS_DIR 与节点名拼接。
2. **meta/controls 结构与判断逻辑不一致**：若 battlenet_region_judge 或 B 块逻辑期望的 automation_id/name/rect 与 B5 快照实际结构不同，会导致 B5 出口判断或后续分支错误。
3. **把 .cache 当权威提交或跨机依赖**：.cache 为本地运行时产物，若在文档或脚本中假定其一定存在且未在别机生成，会报错；快照仅作参考与调试用。
4. **B5 与其它节点快照混用**：各节点 reason/controls 对应不同 UI 状态；若用 B5 快照做 B7 或 B9 的判断，会误判。

### 1.3 正确做法

- 快照路径从 BN_FLOW_SNAPSHOTS_DIR 与节点名生成；读取快照的代码与 battlenet_operation、battlenet_region_judge 约定的 controls 结构一致；不把 .cache 当唯一权威；B5 仅用于 B5 节点相关逻辑。

---

## 二、utils/_obsolete_game_state_manager.py

### 2.1 职责与约定

- **用途**：文件名带 **\_obsolete_**，表示**已废弃**。原为「Diablo III 与 RoS-BoT 统一状态管理」：GameStateManager、ProcessState、check_diablo_status、check_rosbot_status、check_other_exe_status、should_start_diablo、should_start_rosbot、get_system_status。依赖 CONFIG（monitoring、ros_settings）、GameProcessDetector、**utils.rosbot_manager.RoSBotManager**。
- **注意**：utils 目录下仅有 `_obsolete_rosbot_manager.py`，无 `rosbot_manager.py`；当前主流程使用 **d3utils.rosbot_manager**。若未在 utils 下提供 rosbot_manager 的转发或别名，从此文件 import RoSBotManager 会 **ImportError**。主流程的状态与「是否启动 ROSBOT」由 **rosbot_status_provider**、**flow（process_task、flow_state）**、**d3utils/rosbot_manager** 负责，不由此文件决定。

### 2.2 易被误解或改错的原因

1. **当作主流程状态或启动决策入口**：若在面板或定时器中调用 GameStateManager.update_all_status()、should_start_rosbot() 等作为「是否启动 ROSBOT」或「游戏状态」的依据，会绕过 flow 与 rosbot_status_provider，与 FLOW_STATE_OWNERSHIP_DESIGN 不符。
2. **依赖 utils.rosbot_manager**：该 import 在无 utils/rosbot_manager 时会失败；即便存在，也应是 obsolete 链，不应作为主流程依赖。
3. **在 obsolete 中加功能**：在此文件内新增方法或改 CONFIG 键、期望主程序生效，主流程不会调用，会导致无效修改或两套逻辑。
4. **与 rosbot_status_provider 混淆**：当前 ROSBOT 状态刷新与展示由 rosbot_status_provider.refresh_rosbot_status() 写 game_interface_data；是否启动/由谁启动由 process_task 与 flow_state 决定；勿用 GameStateManager 替代。

### 2.3 正确做法

- 主流程不引用 _obsolete_game_state_manager；ROSBOT 状态用 rosbot_status_provider + game_interface_data；启动决策用 flow_state 与 process_task；不在本文件增加功能或修复 import 作为主流程方案。

---

## 三、d3utils/rosbot_status_provider.py

### 3.1 职责与约定

- **用途**：ROSBOT **扩展状态**的检测与 game_interface_data 更新。仅提供 refresh_rosbot_status()、get_current_rosbot_window()；**所有查找通过 same-dir exe flow**（见 docs/ROSBOT_LOOKUP_FLOW.md），即 get_rosbot_manager().get_rosbot_detection()、get_rosbot_window()、get_running_rosbot_processes()。状态取值：**not_found | running | paused**（running = 有进程无窗口，paused = 有窗口）。不读 flow_master_enabled/bn_only（符合 FLOW_STATE_OWNERSHIP_DESIGN）。
- **写入**：game_interface_data 的 rosbot_extended_status、rosbot_window_found、rosbot_found_exe_name、rosbot_found_window_title；由 set_rosbot_extended_status、set_rosbot_found_display 写入。

### 3.2 易被误解或改错的原因

1. **在 provider 内读流程开关做分支**：若在 refresh_rosbot_status 内根据 flow_master_enabled 或 bn_only_enabled 决定「是否执行」或「写不同状态」，违反「其他类库无状态开关」；provider 只负责检测并写 game_interface_data，是否调用由 process_task 决定。
2. **调用顺序或调用方错误**：应由 process_task/flow 在 REFRESH_NOTIFY 阶段调用 refresh_rosbot_status；若由 window_monitor 直接调用且与 process_task 不同步，可能重复或竞态。
3. **get_rosbot_detection() 契约变更**：若 rosbot_manager.get_rosbot_detection() 返回的 key（status、window_info）或语义变更，未同步本模块会写错字段或取不到 window_info。
4. **与 rosbot_operation 混淆**：rosbot_operation 负责「激活窗口、run_after_rosbot_start、resume_rosbot」；rosbot_status_provider 只负责「检测状态并写 game_interface_data」；勿在 status_provider 内做激活或点击。

### 3.3 正确做法

- 仅由 process_task（或约定入口）在 REFRESH_NOTIFY 阶段调用 refresh_rosbot_status；不在本模块内读 flow_state；与 rosbot_manager 的 get_rosbot_detection/get_rosbot_window 契约一致；状态仅 not_found/running/paused，与 ROSBOT_LOOKUP_FLOW 一致。

---

## 四、controller/ctl_func/__init__.py

### 4.1 职责与约定

- **用途**：Controller 子包 **ctl_func** 的包说明。文档明确：**直接从子模块 import，不做二次封装**（no secondary encapsulation）。示例：`from controller.ctl_func.blacksmith_handler import get_blacksmith_handler, BlacksmithHandler`、`from controller.ctl_func.kanai_cube_handler import get_kanai_cube_handler, KanaiCubeHandler`。
- **约定**：不在 __init__.py 中做 `from .blacksmith_handler import ...` 再 re-export；不在此聚合多个 handler 的 get_* 或类名；新增 handler 时在对应子模块实现，调用方直接从子模块 import。

### 4.2 易被误解或改错的原因

1. **在 __init__ 中做聚合导出**：若在 __init__.py 写 `from .blacksmith_handler import get_blacksmith_handler` 并 `__all__ = ['get_blacksmith_handler', ...]`，与「no secondary encapsulation」不符；文档要求直接 from 子模块。
2. **新增 handler 只加在 __init__ 未建子模块**：若只在本文件加一行 import 而子模块不存在，会报错；应先建子模块再在调用方直接 from 子模块。
3. **与 controller.d4func 混淆**：ctl_func 为 D3 相关（铁匠、卡奈等）；d4func 为 D4（exp_farming、screenshot_handler 等）；勿在 ctl_func/__init__ 中导出 d4func 或反之。

### 4.3 正确做法

- __init__.py 保持仅包说明与 import 示例，不 re-export；调用方始终 `from controller.ctl_func.xxx_handler import get_xxx_handler, XxxHandler`；新增 handler 时新建子模块并在调用处直接 import 子模块。

---

## 五、controller/d4_controller.py

### 5.1 职责与约定

- **用途**：D4 主控制器。**由 D4ExtensionThread 按 D4_TICK_INTERVAL 驱动**，不由 timer_manager 的通用定时器驱动。process() 为唯一主入口：当 **exp_farming_running** 时执行 start_exp_farming_process(d4_data) + update_ui_status + check_state_changes + _update_debug_window_if_open；当 **debug_window_open** 时执行截图 + collect → region_detector.detect_regions_from_shared_data → map_switch_detector → map_name_recognizer → _update_debug_window_if_open；否则 return。get_interceptor() 返回「is_exp_farming_running or debug_window_open」的谓词，供外部判断是否执行 process。
- **依赖**：get_d4_interface_data()、ExpFarmingManager、get_ui_status_updater()、get_event_manager()；D4_SCREENSHOT_DIR、D4_ANNOTATED_DIR；exp_farming_running、debug_window_open、detected_regions 等来自 d4_data。

### 5.2 易被误解或改错的原因

1. **由错误方驱动 process()**：若由 timer_manager 或其它 1s/10s 定时器直接调 d4_controller.process()，与「仅 D4ExtensionThread 驱动」不符；D4 逻辑应只在 D4ExtensionThread 的 tick 中调用 process()。
2. **调换 process() 内顺序**：必须先截图与 collect → region_detection → map_switch + map_name_recognizer；若先 map_switch 再 detect_regions，detected_regions 未就绪会失败。
3. **detected_regions 结构假设错误**：_update_debug_window_if_open 依赖 d4_data.detected_regions 含 'region_images'；若 d4_small_map_detector 或其它模块**整体覆盖** detected_regions 为仅 location_type/is_in_town，会丢掉 region_images 导致 debug 窗口无图或报错；需保证检测链中合并写入而非整体覆盖。
4. **exp_farming_running 的写入**：start_exp_farming/stop_exp_farming 直接写 d4_data.exp_farming_running；若由别处写或读错来源，状态会乱。
5. **与 D4ExtensionThread 条件不一致**：D4ExtensionThread 仅在 is_exp_farming_running 或 debug_window_open 时调 process()；若 interceptor 或线程内条件与 d4_controller 不一致，会多调或少调。

### 5.3 正确做法

- 仅由 D4ExtensionThread 在 D4_TICK_INTERVAL 且（exp_farming 或 debug_window_open）时调用 process()；不调换 process() 内截图 → region_detection → map_switch → map_name 顺序；保证 detected_regions 的更新为合并而非整体覆盖（见 d4_small_map_detector 技术说明）；exp_farming 状态仅通过 d4_data 与 start/stop_exp_farming 读写；与 d4_extension_thread、exp_farming 技术说明一致。

---

## 六、与道歉文档的关系

若此前因上述任一点（如 B5 快照路径或结构混用、误用 _obsolete_game_state_manager 做状态或启动决策、在 rosbot_status_provider 内读流程开关或调用方错误、在 ctl_func/__init__ 做聚合导出、d4_controller 由错误方驱动或 process 顺序或 detected_regions 覆盖问题）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
