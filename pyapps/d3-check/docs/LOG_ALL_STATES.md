# 日志全部状态与组合说明（LOG_ALL_STATES）

基于整份 ROSBOT 日志（`Documents/RoS-BoT/Logs/history.txt`）扫描得到的**所有状态**。状态 = **缩进组件（tab 组件）** + **日志信息类型**。非空行总数 73017，共 **66 种** 状态组合。

---

## 一、Tab 组件（缩进组件）

行首仅使用**空格**表示缩进，未使用 TAB。空格按 Unicode 分为一种（当前仅出现 U+0020）。

| 组件键 | 说明 |
|--------|------|
| `tabs=0, U+0020=0` | 无行首空白，顶格。表示新日志条（主行）。 |
| `tabs=0, U+0020=3` | 行首 3 个普通空格 (U+0020)。表示续行（如堆栈 `   at ...`）。 |

---

## 二、日志信息类型（message_type）说明

- **info_xxx**：带时间戳的 `INFO -` 行，xxx 为内容分类。
- **warn_xxx**：带时间戳的 `WARN -` 行。
- **cont_xxx**：无时间戳的续行（多为异常堆栈、说明文字）。

| 类型 | 说明 |
|------|------|
| msg_info_other | INFO 行，未匹配到下列具体模式的其他内容。 |
| info_msg_Vendor_loop | 商人循环：Vendor loop / Vendor loop done。 |
| info_msg_Objective_RunLogic | 目标逻辑：Objective RunLogic: Open Rift / Do Rift / Kill Boss / Urshi / Talk to Orek / RiftItem。 |
| info_msg_Interact_PowerUpOrPool | 与池子/神坛交互：Interact PowerUpOrPool => ...。 |
| info_msg_Interact_end | 交互结束：Interact end。 |
| info_msg_portal_move_to_portal | 传送门移动：[N] portal > 10 move to portal。 |
| info_msg_Take_portal | 使用传送门：Take portal :...。 |
| info_msg_take_portal_actionfound | 找传送门但已有动作：[N] take portal but actionfound。 |
| info_msg_Take_portal_ended | 传送结束：Take portal ended from => to。 |
| info_msg_move_to_portal_success | 移动到传送门成功。 |
| info_msg_Take_portal_check_ended | 传送检查结束。 |
| info_msg_Start_a_loop | 开始循环：Start a loop / [N] Start a loop。 |
| info_msg_Town_portal_done | 回城完成：Town portal done。 |
| info_msg_FastModeR_loading | FastModeR 加载。 |
| info_msg_Loading | Loading...。 |
| info_msg_CancelRequested | 取消请求：CancelRequested => True/False。 |
| info_msg_end | 结束：end.。 |
| info_msg_Running | 地图类型：Running: Rift / Echoing Fury Exploration 等。 |
| info_msg_Botting | Botting !。 |
| info_msg_Town_portal | 回城：Town portal: UpdateGem Success BackTown。 |
| info_msg_Resurect | 复活：Resurect。 |
| info_msg_Dead | 死亡：Dead。 |
| info_msg_Resume_Game_try | 恢复游戏尝试：Resume Game try nbr N。 |
| info_msg_fighting_with_warden | 与守卫战斗：[N] fighting with warden。 |
| info_msg_Start_picking_up | 开始拾取：Start picking up items dropped。 |
| info_msg_RiftItem_elapsed | 大秘境拾取耗时：RiftItem elapsed total(timeout) :N。 |
| info_msg_Finish_picking_up | 拾取结束：Finish picking up items dropped。 |
| info_msg_Picking_end | 拾取结束：Picking end。 |
| info_msg_GoNext_Cacnel | 取消下一步：[N] GoNext Cacnel。 |
| info_msg_Open_Rift_Success | 打开小秘境成功。 |
| info_msg_Open_Greater_Rift_Success | 打开大秘境成功。 |
| info_msg_plugin_Disabled | 插件列表：xxx - Disabled。 |
| info_msg_Return_to_town_early | 提前回城：Return to town early(c) N。 |
| info_msg_DisconnectionEx_thrown | 断线异常：DisconnectionEx thrown (N)。 |
| info_msg_Disconnection | 断线：Disconnection。 |
| info_msg_BWGComprehensivePlugin | BWGComprehensivePlugin OnInitialize。 |
| info_msg_scan_dont_found | 未扫描到：scan dont found , move to boss loc。 |
| info_msg_move_to_boss | 移动到 Boss：move to boss X: ...。 |
| info_msg_Initializing_plugins | 初始化插件：Initializing plugins。 |
| info_msg_rsttcp.cfg | rsttcp.cfg 相关。 |
| info_msg_TCPRst_OnInitialize | TCPRst OnInitialize。 |
| info_msg_WinDivert_sys | WinDivert64.sys 路径/状态。 |
| info_msg_ExtPickup_OnInitialize | ExtPickup OnInitialize。 |
| info_msg_HCHelpPlugin_OnInitialize | HCHelpPlugin OnInitialize。 |
| info_msg_Installed_plugins | Installed plugins。 |
| info_msg_plugin_start | plugin start.。 |
| info_msg_extpick.cfg | extpick.cfg 相关。 |
| info_msg_plugin_stop | plugin stop.。 |
| info_msg_TCPRst_OnShutdown | TCPRst OnShutdown。 |
| info_msg_ExtPickup_OnShutdown | ExtPickup OnShutdown。 |
| info_msg_WinDivert | WinDivert 相关（未匹配到更具体模式）。 |
| info_msg_Session_Time_out | 会话超时：Session Time out 5 min..。 |
| warn_msg_WinDivert | WARN 行，WinDivert 相关。 |
| warn_msg_Exception_thrown_loding | WARN，加载异常：Exception thrown when loding ... .dll。 |
| warn_msg_Disconnected | WARN，断开：[N] Disconnected / Disconnected。 |
| warn_msg_Abnormal_situation | WARN，异常退出：Abnormal situation, exit game。 |
| warn_msg_Disconnection | WARN，Disconnection。 |
| cont_System | 堆栈续行：at System....。 |
| cont_obfuscated | 堆栈续行：at ?????????...（混淆名）。 |
| cont_at_other | 堆栈续行：at ...（其他）。 |
| cont_File_name | 续行：File name: '...'。 |
| cont_WRN_Assembly | 续行：WRN: Assembly binding logging...。 |
| cont_To_enable | 续行：To enable assembly bind failure logging...。 |
| cont_Note_There | 续行：Note: There is some performance penalty...。 |
| cont_To_turn | 续行：To turn this feature off...。 |
| cont_other | 无时间戳、未匹配到以上续行模式的其他行。 |

---

## 三、所有状态组合（66 种）

格式：`缩进组件 | 日志信息类型`。按出现次数从多到少排列。

| 序号 | 状态组合 | 行数 | 说明 |
|------|----------|------|------|
| 1 | tabs=0, U+0020=0 \| msg_info_other | 30022 | 顶格 INFO，其他未分类内容。 |
| 2 | tabs=0, U+0020=0 \| info_msg_Vendor_loop | 4122 | 顶格，商人循环。 |
| 3 | tabs=0, U+0020=0 \| info_msg_Objective_RunLogic | 3066 | 顶格，目标/跑图逻辑。 |
| 4 | tabs=0, U+0020=0 \| info_msg_Interact_PowerUpOrPool | 2931 | 顶格，神坛/池子交互。 |
| 5 | tabs=0, U+0020=0 \| info_msg_Interact_end | 2931 | 顶格，交互结束。 |
| 6 | tabs=0, U+0020=0 \| info_msg_portal_move_to_portal | 2526 | 顶格，传送门移动。 |
| 7 | tabs=0, U+0020=0 \| info_msg_Take_portal | 2410 | 顶格，使用传送门。 |
| 8 | tabs=0, U+0020=0 \| info_msg_take_portal_actionfound | 2375 | 顶格，找传送门但已有动作。 |
| 9 | tabs=0, U+0020=0 \| info_msg_Take_portal_ended | 2373 | 顶格，传送结束。 |
| 10 | tabs=0, U+0020=0 \| info_msg_move_to_portal_success | 2340 | 顶格，移动到传送门成功。 |
| 11 | tabs=0, U+0020=0 \| info_msg_Take_portal_check_ended | 2315 | 顶格，传送检查结束。 |
| 12 | tabs=0, U+0020=0 \| info_msg_Start_a_loop | 1970 | 顶格，开始循环。 |
| 13 | tabs=0, U+0020=0 \| info_msg_Town_portal_done | 1151 | 顶格，回城完成。 |
| 14 | tabs=0, U+0020=0 \| info_msg_FastModeR_loading | 1118 | 顶格，FastModeR 加载。 |
| 15 | tabs=0, U+0020=0 \| info_msg_Loading | 952 | 顶格，Loading...。 |
| 16 | tabs=0, U+0020=0 \| info_msg_CancelRequested | 889 | 顶格，取消请求。 |
| 17 | tabs=0, U+0020=0 \| info_msg_end | 875 | 顶格，end.。 |
| 18 | tabs=0, U+0020=0 \| info_msg_Running | 861 | 顶格，地图类型 Running:。 |
| 19 | tabs=0, U+0020=0 \| info_msg_Botting | 793 | 顶格，Botting !。 |
| 20 | tabs=0, U+0020=0 \| info_msg_Town_portal | 722 | 顶格，回城进度。 |
| 21 | tabs=0, U+0020=0 \| info_msg_Resurect | 673 | 顶格，复活。 |
| 22 | tabs=0, U+0020=0 \| info_msg_Dead | 588 | 顶格，死亡。 |
| 23 | tabs=0, U+0020=0 \| info_msg_Resume_Game_try | 522 | 顶格，恢复游戏尝试。 |
| 24 | tabs=0, U+0020=3 \| cont_System | 435 | 3 空格续行，at System....。 |
| 25 | tabs=0, U+0020=0 \| info_msg_fighting_with_warden | 360 | 顶格，与守卫战斗。 |
| 26 | tabs=0, U+0020=0 \| info_msg_Start_picking_up | 320 | 顶格，开始拾取。 |
| 27 | tabs=0, U+0020=0 \| info_msg_RiftItem_elapsed | 317 | 顶格，拾取耗时。 |
| 28 | tabs=0, U+0020=0 \| info_msg_Finish_picking_up | 317 | 顶格，拾取结束。 |
| 29 | tabs=0, U+0020=0 \| info_msg_Picking_end | 317 | 顶格，Picking end。 |
| 30 | tabs=0, U+0020=0 \| info_msg_GoNext_Cacnel | 298 | 顶格，GoNext 取消。 |
| 31 | tabs=0, U+0020=0 \| info_msg_Open_Rift_Success | 178 | 顶格，小秘境打开成功。 |
| 32 | tabs=0, U+0020=0 \| info_msg_Open_Greater_Rift_Success | 175 | 顶格，大秘境打开成功。 |
| 33 | tabs=0, U+0020=0 \| info_msg_plugin_Disabled | 160 | 顶格，插件 - Disabled。 |
| 34 | tabs=0, U+0020=3 \| cont_obfuscated | 154 | 3 空格续行，at ?????????...。 |
| 35 | tabs=0, U+0020=0 \| info_msg_Return_to_town_early | 153 | 顶格，提前回城。 |
| 36 | tabs=0, U+0020=0 \| cont_other | 146 | 顶格无时间戳，其他续行内容。 |
| 37 | tabs=0, U+0020=0 \| cont_File_name | 96 | 顶格，File name: '...'。 |
| 38 | tabs=0, U+0020=0 \| cont_WRN_Assembly | 96 | 顶格，WRN: Assembly...。 |
| 39 | tabs=0, U+0020=0 \| cont_To_enable | 96 | 顶格，To enable assembly...。 |
| 40 | tabs=0, U+0020=0 \| cont_Note_There | 96 | 顶格，Note: There is...。 |
| 41 | tabs=0, U+0020=0 \| cont_To_turn | 96 | 顶格，To turn this...。 |
| 42 | tabs=0, U+0020=0 \| info_msg_DisconnectionEx_thrown | 74 | 顶格，DisconnectionEx thrown。 |
| 43 | tabs=0, U+0020=0 \| info_msg_Disconnection | 71 | 顶格，Disconnection。 |
| 44 | tabs=0, U+0020=0 \| warn_msg_WinDivert | 64 | 顶格 WARN，WinDivert。 |
| 45 | tabs=0, U+0020=0 \| warn_msg_Disconnected | 49 | 顶格 WARN，Disconnected。 |
| 46 | tabs=0, U+0020=0 \| info_msg_BWGComprehensivePlugin | 38 | 顶格，BWG 插件初始化。 |
| 47 | tabs=0, U+0020=0 \| info_msg_scan_dont_found | 35 | 顶格，未扫描到。 |
| 48 | tabs=0, U+0020=0 \| info_msg_move_to_boss | 33 | 顶格，移动到 Boss。 |
| 49 | tabs=0, U+0020=0 \| info_msg_Initializing_plugins | 32 | 顶格，初始化插件。 |
| 50 | tabs=0, U+0020=0 \| info_msg_rsttcp.cfg | 32 | 顶格，rsttcp.cfg。 |
| 51 | tabs=0, U+0020=0 \| info_msg_TCPRst_OnInitialize | 32 | 顶格，TCPRst OnInitialize。 |
| 52 | tabs=0, U+0020=0 \| info_msg_WinDivert_sys | 32 | 顶格，WinDivert64.sys。 |
| 53 | tabs=0, U+0020=0 \| warn_msg_Exception_thrown_loding | 32 | 顶格 WARN，加载异常。 |
| 54 | tabs=0, U+0020=0 \| info_msg_ExtPickup_OnInitialize | 32 | 顶格，ExtPickup 初始化。 |
| 55 | tabs=0, U+0020=0 \| info_msg_HCHelpPlugin_OnInitialize | 32 | 顶格，HCHelp 初始化。 |
| 56 | tabs=0, U+0020=0 \| info_msg_Installed_plugins | 32 | 顶格，Installed plugins。 |
| 57 | tabs=0, U+0020=0 \| info_msg_plugin_start | 30 | 顶格，plugin start.。 |
| 58 | tabs=0, U+0020=0 \| warn_msg_Abnormal_situation | 9 | 顶格 WARN，异常退出。 |
| 59 | tabs=0, U+0020=0 \| info_msg_extpick.cfg | 7 | 顶格，extpick.cfg。 |
| 60 | tabs=0, U+0020=0 \| info_msg_plugin_stop | 4 | 顶格，plugin stop.。 |
| 61 | tabs=0, U+0020=0 \| info_msg_TCPRst_OnShutdown | 4 | 顶格，TCPRst OnShutdown。 |
| 62 | tabs=0, U+0020=0 \| info_msg_ExtPickup_OnShutdown | 4 | 顶格，ExtPickup OnShutdown。 |
| 63 | tabs=0, U+0020=0 \| info_msg_WinDivert | 1 | 顶格，WinDivert 其他。 |
| 64 | tabs=0, U+0020=0 \| info_msg_Session_Time_out | 1 | 顶格，Session Time out。 |
| 65 | tabs=0, U+0020=3 \| cont_at_other | 1 | 3 空格续行，at ... 其他。 |
| 66 | tabs=0, U+0020=0 \| warn_msg_Disconnection | 1 | 顶格 WARN，Disconnection。 |

---

## 四、组合汇总

- **缩进组件**：2 种（tabs=0 U+0020=0，tabs=0 U+0020=3）。
- **日志信息类型**：66 种（含 info_/warn_/cont_ 各类）。
- **状态组合**：66 种（每类信息在当前日志中只出现在一种缩进下：顶格或 3 空格）。
- **总非空行**：73017。

实现与复现：`d3utils.log_indent_spec.analyze_log_all_states(log_path, max_lines=0)`，返回 `state_to_count`、`state_to_sample`、`indent_states_seen`、`message_types_seen`。
