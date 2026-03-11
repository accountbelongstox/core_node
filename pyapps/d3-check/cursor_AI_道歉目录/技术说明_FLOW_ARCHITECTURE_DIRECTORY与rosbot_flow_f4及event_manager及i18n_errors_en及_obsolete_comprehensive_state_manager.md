# 技术说明：FLOW_ARCHITECTURE_DIRECTORY、rosbot_flow_f4_close_d3_send_f7、event_manager、i18n_errors_en、_obsolete_comprehensive_state_manager

**目的**：说明此五处文件/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/FLOW_ARCHITECTURE_DIRECTORY.md`
- `d3utils/rosbot_flow_f4_close_d3_send_f7.py`
- `controller/d4func/events/event_manager.py`
- `providor/i18n/i18n_errors_en.json`
- `utils/_obsolete_comprehensive_state_manager.py`

---

## 一、docs/FLOW_ARCHITECTURE_DIRECTORY.md

### 1.1 职责与约定

- **用途**：定义 d3-check 的**流程架构**：**仅两个流程库**（BN-only、Flow-master）、目录布局、避免重复定义。Tick 入口 `rosbot_task_processor.process_task` 按 flow_state 调用 `tick_bn_only_flow()` 与 `tick_flow_master()`；**两流程可在同一 2s tick 内同时运行**（顺序：先 BN-only，再 flow-master）。**rosbot_flow_state** 仅持 flow_master_enabled、bn_only_enabled；**flow_bn_only_state** 持所有 BN 步骤与状态（BNStep/BNNode、BNOnlyState）；**flow_bn_only** 为 BN-only tick 驱动；**flow_master_driver** 为 Flow-master tick 与步骤/结果状态；**rosbot_flow_battlenet** 为第三方，仅通过 flow_bn_only_state 读写、不持有 BN 步骤或状态。
- **约定**：BNStep/BNNode、BN 状态（current_step、b5_entry_reason、wait_until 等）**仅存在于 flow_bn_only_state**；rosbot_flow_battlenet 不得定义 BNNode 或本地 _current_node 等；reset_confirmed_to_poll、enter_battlenet_at_b2、set_battlenet_tick_confirmed、get_bn_flow_ever_confirmed 等在 flow_bn_only_state 实现；rosbot_flow/ 下为流程库（tick 驱动+共享状态），顶层 rosbot_flow_*.py 为 F 块/BN 步实现。与 FLOW_IMPLEMENTATION_PROGRESS、ENSURE_BATTLENET_ONLY_TICK_FLOW 一致。

### 1.2 易被误解或改错的原因

1. **在 rosbot_flow_battlenet 内定义 BNStep/BNNode 或本地 BN 状态**：文档明确单源真相在 flow_bn_only_state，若在 battlenet 内复制会重复定义与 §4 冲突。
2. **假定两流程互斥**：文档明确两开关可同时为 True、同 tick 先 BN-only 再 flow-master；若加互斥或改顺序会违反 §7。
3. **在 rosbot_task_processor 内直接调用 refresh/notify 以外的第三方**：Tick 入口只调 tick_bn_only_flow/tick_flow_master，不直接调第三方；若在 process_task 内增加对 battlenet_manager 等直接调用会破坏分层。
4. **将 extension 阶段定义在 flow_master_driver**：extension 阶段在 extension_flow_state，flow_master_driver 使用之、不重复定义。

### 1.3 正确做法

- 修改流程或 BN 状态前先读本文与 §2–§5、§6–§7；BN 步骤与状态只放在 flow_bn_only_state；两流程同 tick 顺序不可颠倒；rosbot_flow_battlenet 仅通过 flow_bn_only_state 读写。

---

## 二、d3utils/rosbot_flow_f4_close_d3_send_f7.py

### 2.1 职责与约定

- **用途**：**[F4]** F4a 关 D3、F4b 向系统发 F7 关 ROSBOT（ROSBOT_FLOW_MERMAID F 块）。`run_f4_close_d3_send_f7()`：`get_d3_manager().kill_if_running()`；`send_f7_to_system()`；`get_rosbot_manager().kill_if_running()`。**调用方随后进入 B2**（如 enter_battlenet_at_b2）。无返回值；F3 返回 "f4" 时由 flow_master_driver 调用本函数再 enter_battlenet_at_b2。
- **约定**：执行顺序为 kill D3 → send F7 → kill ROSBOT；send_f7_to_system 失败仅打 yellow 不抛异常；不在此函数内调用 enter_battlenet_at_b2（由 caller 调）。若颠倒顺序或在此内调 enter_battlenet_at_b2 会与 ROSBOT_FLOW_MERMAID 与 FLOW_IMPLEMENTATION_PROGRESS 不一致。

### 2.2 易被误解或改错的原因

1. **先 kill ROSBOT 再 kill D3 或先 send F7**：文档与流程图为先关 D3、再发 F7、再关 ROSBOT；若颠倒可能 ROSBOT 未收 F7 即被 kill。
2. **在本函数内调用 enter_battlenet_at_b2**：约定为 caller（flow_master_driver）在 run_f4 后调 enter_battlenet_at_b2；若在此内调会重复或流程耦合。
3. **给 run_f4_close_d3_send_f7 加返回值或条件分支**：当前为 void、无分支；若改为根据 kill/send 结果 return 会改变 flow_master_driver 的调用约定。

### 2.3 正确做法

- 保持 kill D3 → send F7 → kill ROSBOT 顺序；enter_battlenet_at_b2 由 caller 在 run_f4 后调用；与 ROSBOT_FLOW_MERMAID、FLOW_IMPLEMENTATION_PROGRESS 一致。

---

## 三、controller/d4func/events/event_manager.py

### 3.1 职责与约定

- **用途**：**D4 事件管理器**。通过 **get_d4_interface_data()** 与 **D4_EVENT_KEYS**（来自 share.game_interface_data）读共享数据；无参数传入，数据直接从共享内存读。**event_functions** 将 D4_EVENT_KEYS 的 value 映射到各 event 函数（exp_farming_*、team_health_*、screen_*、game_state_*）。**check_state_changes()** 调用 _check_exp_farming_changes、_check_team_health_changes、_check_screen_changes、_check_game_state_changes，用 **previous_states** 做变更检测后 trigger_event(event_key)。单例 get_event_manager()。
- **约定**：current_dir = Path(__file__).parent.parent.parent.parent（d4func→events→…→项目根）；D4State 已并入 D4InterfaceData，不单独用 D4State；trigger_event 仅当 event_key 在 event_functions 内时调用对应函数；新增事件须在 D4_EVENT_KEYS 与 event_functions 及对应 _check_* 中增加。若在 event 函数内写死数据而非从 get_d4_interface_data() 读会破坏「无参数、读共享数据」约定。

### 3.2 易被误解或改错的原因

1. **在 trigger_event 或 event 函数内传入非 key 参数**：文档写「No parameters are passed - data is read directly from shared memory」；若改为传参会与 D4InterfaceData 单例读法不一致。
2. **在 event_manager 内定义 D4_EVENT_KEYS 或重复定义 key**：D4_EVENT_KEYS 定义在 share.game_interface_data，此处仅引用；若在此重定义会与 game_interface_data 不同步。
3. **新增事件未同步 D4_EVENT_KEYS、event_functions、_check_* 三处**：会 Unknown event key 或永不触发。
4. **_check_* 内 previous_states 键名与 d4_data 属性不一致**：会检测不到变更或误触发。

### 3.3 正确做法

- 事件数据只从 get_d4_interface_data() 读；D4_EVENT_KEYS 以 game_interface_data 为准；新增事件时三处同步；previous_states 键与 d4_data 属性一致。

---

## 四、providor/i18n/i18n_errors_en.json

### 4.1 职责与约定

- **用途**：**英文错误/提示文案**。当前结构：**ui.error_messages.bag_offset_failed** = "Failed to update bag offset configuration"。供 i18n 按 key（如 error_messages.bag_offset_failed 或 ui.error_messages.bag_offset_failed，视 get_ui_text/translate 前缀约定）取文案。与 i18n_common_zh、i18n_common_en 等并列，专用于错误类消息。
- **约定**：消费方通过 i18n 的 get_ui_text 或 translate 取 key；若 i18n_manager 对 error 有单独前缀（如 "ui." 或 "error_messages."）须与 JSON 结构一致。新增错误文案须在此与对应语言文件同时加键；改键名须同步所有引用处。

### 4.2 易被误解或改错的原因

1. **假定 key 路径为 error_messages.bag_offset_failed 而实际为 ui.error_messages.bag_offset_failed**：若 get_ui_text 补 "ui." 则传 "error_messages.bag_offset_failed" 即可；若 translate 不补前缀则需传完整路径。
2. **只改 i18n_errors_en 未改 zh 或其它语言**：会 fallback 到 key 或英文。
3. **删除或重命名 bag_offset_failed 未查引用**：会取不到或显示 key 路径。

### 4.3 正确做法

- 新增/修改错误文案时同步各语言文件与 get_ui_text/translate 的 key 约定；与 i18n_manager 的 prefix 逻辑一致。

---

## 五、utils/_obsolete_comprehensive_state_manager.py

### 5.1 职责与约定

- **用途**：**已废弃模块**（_obsolete_ 前缀）。ComprehensiveStateManager 持 RosBotState、BattleNetState、DiabloState、SystemRuntimeState、GameLogState、GameStatusState 等 dataclass，依赖 **providor_second.CONFIG、load_config**，含 update_rosbot_startup_status、update_battlenet_status、update_diablo_status 等。**不应被新代码或当前流程引用**；当前状态以 game_interface_data、rosbot_flow_state、flow_bn_only_state、flow_master_driver 等为准。
- **约定**：不在此文件扩展；不将本模块作为状态管理的推荐实现；若需 ROSBOT/战网/D3 状态应使用 game_interface_data 与流程层状态；删除前确认无引用。

### 5.2 易被误解或改错的原因

1. **误当可用状态管理器使用**：未注意 _obsolete_ 前缀而在此模块上开发或 import，会引入 providor_second、CONFIG 与当前设计不一致。
2. **与 FLOW_ARCHITECTURE_DIRECTORY 冲突**：文档中 BN 状态在 flow_bn_only_state、流程状态在 flow_master_driver；若用本文件的状态会重复或与两流程库设计冲突。
3. **CONFIG 键与当前配置迁移**：若 CONFIG 或 load_config 已迁移到 providor_index 或别处，本文件会 ImportError 或读错配置。

### 5.3 正确做法

- 视本文件为只读历史参考；不新增依赖、不在新代码中 import；状态需求以 game_interface_data 与流程架构文档为准；删除前全局搜索确认无引用。

---

## 六、与道歉文档的关系

若此前因未先通读上述五处约定（FLOW_ARCHITECTURE_DIRECTORY 两流程与目录与单源真相、run_f4 顺序与 caller 进 B2、event_manager 无参读 D4InterfaceData、i18n_errors_en 键路径、_obsolete_comprehensive_state_manager 勿用）而在此五处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加对本文的引用。
