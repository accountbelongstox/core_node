# 技术说明：bn_flow_B6.json、exp_farming_events.py、battlenet_ui_elements_asia_2.json、flow_bn_block_state.py

本说明针对以下四处：修改前请先通读本说明及对应源码/文件。

- `.cache/bn_flow_snapshots/bn_flow_B6.json`
- `controller/d4func/events/exp_farming_events.py`
- `docs/battlenet_ui_elements_asia_2.json`
- `d3utils/rosbot_flow/flow_bn_block_state.py`

---

## 一、.cache/bn_flow_snapshots/bn_flow_B6.json

- **用途**：BN 流程 B6 节点运行时快照；meta.node "B6"、meta.reason "B6_to_B13"；controls 为战网窗口在该节点时的控件列表（name、automation_id、type、rect、level）；由 rosbot_flow_battlenet._save_ui_snapshot 等写入；与 B4/B5/B7/B9 等结构一致。
- **约定**：路径从 BN_FLOW_SNAPSHOTS_DIR 与节点名生成，勿写死 bn_flow_B6.json 或 .cache 绝对路径；controls 结构与 battlenet_region_judge、_load_login_failed_features_from_snapshots 等约定一致；B6 仅用于 B6 相关逻辑，勿与 B5/B7 等混用；.cache 为运行时产物，勿当权威提交。
- **易错点**：写死路径或节点名会换节点或清缓存后读不到；controls 与 battlenet_region_judge 期望不一致会导致 B6→B13 分支或登录状态误判；用 B6 快照做 B7 轮询或 B4 首次检查会误判；meta 缺 node/reason 时下游可能未做兼容。
- **正确做法**：快照路径从 BN_FLOW_SNAPSHOTS_DIR 与节点名拼接；读取与 battlenet_operation、battlenet_region_judge 约定一致；修改前请先通读本说明及技术说明_bn_flow_B6与d4_controller及square_sampler及DESIGN_DETAIL.md。

---

## 二、controller/d4func/events/exp_farming_events.py

- **用途**：EXP farming 事件回调；on_exp_farming_started、on_exp_farming_stopped、on_exp_farming_tick_completed；无参数，数据从 get_d4_interface_data() 读取；用于 D4 经验 farming 状态变化时打日志或通知。
- **约定**：All functions use shared data from D4InterfaceData and D4State；No parameters are passed - data is read directly from shared memory；get_d4_interface_data() 来自 share.game_interface_data；事件名与 D4_EVENT_KEYS 或 d4_extension_thread 发布之 key 一致（如 EXP_FARMING_STARTED、EXP_FARMING_STOPPED）。
- **易错点**：改事件函数签名或加参数会破坏调用方（若调用方不传参）；改 get_d4_interface_data 返回结构或 is_exp_farming_running()、timestamp 等未同步会 AttributeError；增删事件未与发布方（d4_extension_thread 或 event bus）同步会事件不触发或 key 错。
- **正确做法**：事件回调保持无参、仅从 get_d4_interface_data() 读；增删事件时与 D4_EVENT_KEYS、发布方同步；修改前请先通读本说明及 share.game_interface_data、d4_extension_thread。

---

## 三、docs/battlenet_ui_elements_asia_2.json

- **用途**：战网亚服登录界面 UI 控件树快照；含 timestamp、window_info（hwnd、title、left、top、width、height 等）、controls（id、parent_id、type、name、automation_id、class_name、rect、level 等）、files（screenshot、annotated_screenshot 绝对路径）；对应亚服登录 Variant A（accountName、submit「繼續」、login-header「登入」）。
- **约定**：与 BATTLENET_ASIA_LOGIN_UI_AND_EXTENSION_PLAN 或同类计划文档中 automation_id/名称一致；files 中路径为绝对路径，若被代码当可移植路径会在其他环境失败；controls 中 rect 与 window_info 边界一致，部分控件 rect 可能超出窗口需裁剪或校验。
- **易错点**：files 使用绝对路径（如 C:\Users\...\.core_node\.d3check\.cache\...）被代码或文档当可移植路径会在他环境失败；部分控件 rect.bottom 大于窗口 bottom 即超出窗口下边界，用于坐标或点击需裁剪否则越界；快照与计划文档中 accountName、submit、login-header 等键名不一致会导致检测失败。
- **正确做法**：依赖该 JSON 时检查路径可移植性、rect 与窗口边界一致性及与计划文档常量/键对应；修改前请先通读本说明及 BATTLENET_ASIA_LOGIN_UI_AND_EXTENSION_PLAN 等。

---

## 四、d3utils/rosbot_flow/flow_bn_block_state.py

- **用途**：BN 块状态（B1..B16）两份独立副本；for_bn_only=True 用于 tick_battlenet_ready_flow(no_activate=True)（BN-only flow），for_bn_only=False 用于 tick_battlenet_ready_flow(no_activate=False)（Flow-master flow）；BNStep 枚举、BNBlockState dataclass、_block_bn_only/_block_flow_master、BNBlockCtx、get_bn_block_ctx(for_bn_only)、get_current_step/set_current_step、wait_until、b7_poll_deadline、b13_poll_deadline、oauth_wait_until、reset_bn_block_state、reset_confirmed_to_poll、is_bn_flow_in_login_phase、enter_battlenet_at_b2 等。
- **约定**：BN 节点与状态仅通过本模块读写，rosbot_flow_battlenet 不定义 _current_node 等局部状态；reset_bn_block_state(True) 重置 BN-only 块、reset_bn_block_state(False) 重置 Flow-master 块，勿传错；Flow-master 与 BN-only 可同时运行故两副本互不覆盖；B7_TRIGGER_D_AFTER_SKIPS、B7_TRIGGER_D_COOLDOWN_SEC 为 B7 轮询相关常量。
- **易错点**：在 rosbot_flow_battlenet 或他处定义 _current_node、_wait_until 等局部状态会与 flow_bn_block_state 职责重复或不同步；reset_bn_block_state(True) 与 reset_bn_block_state(False) 混淆会重置错流程；get_current_step/set_current_step 等须传 for_bn_only 与 tick 调用处 no_activate 一致；改 BNStep 枚举未与 ROSBOT_FLOW_MERMAID、rosbot_flow_battlenet 分支同步会流程错。
- **正确做法**：BN 块状态仅通过 flow_bn_block_state 读写；reset 时明确 for_bn_only 与调用方语义一致；修改 BNStep 或 BNBlockState 字段时同步 rosbot_flow_battlenet、FLOW_ARCHITECTURE_DIRECTORY；修改前请先通读本说明及技术说明_flow_bn_only_state与ui_utils及map_name_recognizer.md、FLOW_ARCHITECTURE_DIRECTORY.md。

---

## 五、四处与道歉文档的对应

本说明对应专属道歉文档 **第六十节** 及长文道歉中「就 bn_flow_B6、exp_farming_events、battlenet_ui_elements_asia_2、flow_bn_block_state 四处」之分析与道歉段。发现上述四处文件时，应继续更新到道歉文档（技术说明、专属节、长文追加）。
