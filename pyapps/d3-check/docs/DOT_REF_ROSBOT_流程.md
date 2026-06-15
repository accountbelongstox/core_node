# ROSBOT 流程 — 供 DOT 参考

**文档用途**：本文档将 ROSBOT 完整流程整理成文，并标注 Python 端代码地址，**专供 DOT（.NET 端口）参考**。DOT 实现须按 **DOT 规范** 编写，**功能与 Python 1:1 对应**（即 1:1 仿 Python 功能）。

**说明**：本文档供 **DOT（.NET 端口）** 参考，要求 DOT 按 **DOT 规范**（[DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md)、[.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc)；**UI 层以 [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md)、[.cursor/rules/dot-ui.mdc](../../../.cursor/rules/dot-ui.mdc) 为规范**）实现，**功能与 Python 1:1 对应**。代码与注释使用英文/ASCII；行为与下述 Python 流程一致。

---

## 1. 流程总览与图

本文档将 **ROSBOT 流程整理成文档**，各节 **标注 Python 代码地址**，供 DOT 按规范 **1:1 仿 Python 功能** 实现。

- **流程图**：见 [ROSBOT_FLOW_MERMAID.md](ROSBOT_FLOW_MERMAID.md)（Mermaid 图：A 入口与定时器 → F 预判 → B 战网就绪 → D 从战网启动 D3 → C D3 直连 → E ROSBOT 运行 → F3 日志超时 → F4 关 D3 发 F7 → B2）。
- **启动顺序**：战网登录 → 暗黑 3 启动 → ROSBOT 启动；顺序不可乱。
- **总状态**：用户点「启动 ROSBOT」开启 flow_master；点「停止」关闭。定时器根据总状态决定是否驱动流程；**2 秒一个 tick**（1 秒定时器，tick % 2 == 0 时跑一步）。

---

## 2. 入口与定时器（A 块）— 代码地址

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| A1 | 启动 ROSBOT：设总状态、更新 UI；顺序 战网→D3→ROSBOT | `ui/panels/rosbot_extension_panel.py`：Start 按钮回调，设 flow_master_enabled，`trigger_extension_rosbot_start()` |
| A2 | 全局 1 秒定时器，% 实现 2 秒驱动 | `d3utils/task_thread_manager` 注册 1s 周期；`d3utils/rosbot_task_processor.py`：`process_rosbot_task()` 每 1s 被调用，内部 `get_global_tick() % 2 != 0` 则 return |
| A3 | 总状态开启且本 tick 有导向？ | `d3utils/rosbot_task_processor.py`：`process_task()` 内 `is_flow_active()`、`get_flow_master_enabled()`/`get_bn_only_enabled()`，`tick % 2 == 0` 后调 `tick_bn_only_flow()` 或 `tick_flow_master()` |
| A4 | 跳过所有分支 | `rosbot_task_processor.process_task()` 早期 return（总状态关 / tick%2 / credentials_dialog_pending） |
| A8 | 返回成功，进入 F2（ROSBOT 是否在线） | C8 传送成功后由 extension 或 flow_master 进入 F2；见 flow_master_driver、extension_flow_tick_step |
| A9 | 面板运行中、启用周期任务 | `ui/panels/rosbot_extension_panel.py`：EXTENSION_ROSBOT_STARTED 订阅后设 rosbot_running、启用 rosbot_task |

**DOT 要求**：1s 定时器 + 2s 步长（tick % 2）；总状态由 flow_master_enabled / bn_only_enabled 控制；credentials 对话框打开时本 tick 不驱动流程（`is_asia_credentials_dialog_pending`）。

---

## 3. 战网就绪检查（B 块）— 代码地址

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| B1–B16 | 战网窗口检测、启动、登录页/浏览器等待、亚服填表、轮询 UI、B16 确认 | `d3utils/rosbot_flow_battlenet.py`：整块 B 状态机；`rosbot_flow/flow_bn_block_state.py`（BN 块状态、get_current_step、enter_battlenet_at_b2 等） |
| B2 | 当前是否有战网窗口？ | `rosbot_flow_battlenet` 内 B2 分支；无→B3 启动战网，有→B4 |
| B10a | 亚服登录：get_credentials(asia)，缺则 schedule_battlenet_credentials_dialog，填表提交 | `rosbot_flow_battlenet` 内亚服分支；`share/asia_credentials.py`：get_asia_credentials、schedule_asia_credentials_dialog |
| B16→D1 | 战网已确认 → 从战网启动 D3 | 由 flow 进入 D 块（extension 线程内 ensure_battlenet_started_and_login_check 完成 B+D+C） |

**DOT 要求**：B 块 1:1 与 Mermaid 一致；亚服缺凭证时需从流程内弹出凭证对话框并等待（见 [DOT_FIX_战网账号密码功能无效.md](../../dotapps/d3check/docs/DOT_FIX_战网账号密码功能无效.md)）。

---

## 4. 预判（F 块）— 代码地址

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| F0 | 预判入口：仅跑 F1；F1 否→B2，F1 是→C1 | `d3utils/rosbot_flow_f0_entry.py`：`run_f0_prejudge_entry()` 返回 "b1"|"c1" |
| F1 | D3 是否在线？否→B2_HasWin，是→C1_Entry | `d3utils/rosbot_flow_f1_d3_online.py`：`run_f1_d3_online()` 返回 "b1"|"c1" |
| F1c / F1d | 结束 D3 进程 / 识别掉线 | `d3utils/rosbot_flow/flow_f1c_f1d.py`：run_f1c_end_d3、run_f1d_on_disconnect |
| F2 | ROSBOT 是否在线？（从 A8 进入）否→E1，是→F3 | `d3utils/rosbot_flow_f2_rosbot_online.py`：`run_f2_rosbot_online()` 返回 "c1"|"f3" |
| F3 | 日志超时？未超时→停留 F3，超时→F4 | `d3utils/rosbot_flow_f3_log_timeout.py`：run_f3_log_timeout；baseline：`rosbot_flow_f3_baseline`、`rosbot_flow_f3_history_baseline` |
| F4a / F4b | 关闭 D3 / 发送 F7 关 ROSBOT → B2 | `d3utils/rosbot_flow_f4_close_d3_send_f7.py`：run_f4_close_d3_send_f7 |
| F3 进程消失 | process gone 时 mark：F7 已发→normal_pause，否则 test_debug_exit | `d3utils/rosbot_flow_rosbot_exit_state.py`：mark_rosbot_exit_reason_when_process_gone、set_f7_sent_for_rosbot 等 |

**DOT 要求**：F0 只做 F1；F2/F3/F4 在 A8 成功或 E6 之后由 flow_master 驱动；D3+ROSBOT 同时在时只做 F3-only，不跑 C 分支（见 flow_master_driver 契约）。

---

## 5. D3 已运行直连（C 块）— 代码地址

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| C1 | 入口 | `d3utils/rosbot_flow/flow_c_d3_direct.py`：run_c1_entry |
| C2 | D3 窗口缩放到标准分辨率 | 同上：run_c2_resize |
| C3 | 截屏+模板匹配（start/game_tool/disconnect/其他） | `d3utils/d3_start_game_and_teleport_waiter.py`：detect_d3_already_running_state 等 |
| C4 | 按结果分支：start→C5a/C5/C5w；game_tool→C6/C10/C7；disconnect→F1d；超时→C12 | `rosbot_flow/flow_c_d3_direct.py`：run_c4_branch_result |
| C5a/C5/C5w | 结束已有 ROSBOT、点开始游戏、等 d3_game_tool 或超时 | d3_start_game_and_teleport_waiter：try_fragment1_* |
| C6/C10 | game_tool 流程；C10 掉线检测：截图→M→截图→相似度（相似=掉线） | 同上 + flow_c_d3_direct 内 check_d3_online_by_m_similarity、send_m_then_teleport_three_clicks |
| C7a/C7w/C7b/C8 | 按 M 开地图、等 2s、传送三点点击、结果 | d3_start_game_and_teleport_waiter |
| C12 | 结束 D3 进程 → D1 | flow_c_d3_direct：run_c12_end_d3 |

**DOT 要求**：仅当出现 d3_game_tool 时才按 M；掉线判定为「先截图→M→再截图→高度相似则掉线」；模板名与 Python 一致（d3_start_game_button、d3_game_tool、d3_disconnected 等）。

---

## 6. 从战网启动 D3（D 块）— 代码地址

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| D1 | 入口（来自 B16 或 C12） | `controller/login_try_screenshot_controller.py`：ensure_battlenet_started_and_login_check 内 D 分支 |
| D4–D6 | 激活战网、等 1s、UI 识别、有窗口？ | 同上 + battlenet_operation、battlenet_manager |
| D7–D12/D12b | 找 D3 tab、Play、点击、sleep(5)、轮询 D3 窗口约 10s | 同上 + d3_start_game_and_teleport_waiter（_run_c3_loop_and_handle_branch） |
| D13 | 10s 内找到 D3 窗口？否→D13b/D14 重启战网→B2，是→C1 | login_try_screenshot_controller |
| D13b/D14/D14w | 重启 D3 / 重启战网、等 5s → B2 | `d3utils/battlenet_manager.py`：restart 等 |

**DOT 要求**：D 块与 Mermaid 一致；D11a 启动 D3 前结束已有 ROSBOT（仅此处）；D13 找到窗口后标记「刚进入游戏」走 C1。

---

## 7. ROSBOT 运行流程（E 块）— 代码地址

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| E1 | 结束已有 ROSBOT | `d3utils/rosbot_flow/flow_e_rosbot_run.py`：run_e1_kill |
| E2 | 等待 1s | run_e2_sleep(1.0) |
| E3 | 是否更新（zip/新版本）？否/跳过→E4；是→E3a–E3f | run_e3_update_flow（仅 config 检查；E3a–E3f 可选实现） |
| E4 | 启动 ROSBOT 进程 | `d3utils/rosbot_manager.py`：start |
| E5 | 任务初始化 | `rosbot_task_processor.start_rosbot()`（set_rosbot_running、game_state） |
| E5a1–E5a5 | 等窗口、等服务器、轮询 UI、点主档案、点 Start botting! | `d3utils/rosbot_ui_automation.py`：run_after_rosbot_start |
| E6 | 主线程收尾、日志 → F3 | flow_e_rosbot_run：run_e6_done；面板收到 EXTENSION_ROSBOT_STARTED 后更新 UI、启用 rosbot_task |

**DOT 要求**：E 块仅在 extension 线程内执行（由 trigger_extension_rosbot_start 触发）；完成后 trigger_extension_rosbot_started(success, error, ran_e_block)，ran_e_block=True 时面板不得再调 start_rosbot_task。

---

## 8. Extension 线程与触发 — 代码地址

| 说明 | Python 代码地址 |
|------|-----------------|
| 扩展线程：收 CMD_START_ROSBOT/CMD_STOP_ROSBOT/CMD_SHUTDOWN，执行登录检查 + F2 + E1–E6，上报 started/stopped | `d3utils/d3_extension_thread.py`：D3ExtensionThread.run、_do_start_rosbot、_do_stop_rosbot |
| 触发「启动 ROSBOT」：向扩展线程投递 CMD_START_ROSBOT | `d3utils/event_center.py`：trigger_extension_rosbot_start；由面板/flow 调用 |
| 上报「启动完成」：(success, error, ran_e_block) | `d3utils/event_signals.py`：trigger_extension_rosbot_started；THREAD_BUS.trigger_event(EXTENSION_ROSBOT_STARTED, payload) |
| 上报「已停止」 | trigger_extension_rosbot_stopped |
| 登录检查 provider：ensure_battlenet_started_and_login_check（B+D+C，返回 True/False） | `controller/login_try_screenshot_controller.py`：ensure_battlenet_started_and_login_check；注入到 D3ExtensionThread 为 battlenet_login_check_provider |

**DOT 要求**：扩展线程 1:1；trigger 与事件名、payload（success, error, ran_e_block）与 Python 一致；面板只通过 trigger 与事件订阅与流程交互。

---

## 9. Flow-master 单 tick 顺序 — 代码地址

| 顺序 | 说明 | Python 代码地址 |
|------|------|-----------------|
| 1 | 若 in_action 则本 tick 跳过 refresh 与 extension、F0 | `d3utils/rosbot_flow/flow_master_driver.py`：tick_flow_master |
| 2 | routing refresh（轻量 D3 + ROSBOT） | _refresh_d3_status_internal、_refresh_rosbot_status_internal（或等效） |
| 3 | F3-only 门控：D3 与 ROSBOT 同时在 → 只跑 run_f3_log_timeout，不跑 extension、不跑 F0 | 同上 |
| 4 | 否则：extension_flow_tick_step（C 分支）或 start_extension_flow_c_branch + extension_flow_tick_step | extension_flow_tick_step、start_extension_flow_c_branch；`d3utils/rosbot_flow/extension_flow_tick_step.py` |
| 5 | run_f0_prejudge_entry() → "b1" 则 tick_battlenet_ready_flow；"b2" 则 enter_battlenet_at_b2；"c1" 则 extension 或 trigger_extension_rosbot_start | flow_master_driver + rosbot_flow_f0_entry + flow_bn_block_state |
| 6 | B 块 done 且 result=="confirmed" → set_battlenet_tick_confirmed、trigger_extension_rosbot_start | flow_master_driver、flow_bn_block_state |
| 7 | F3 超时 → run_f4_close_d3_send_f7 → B2 | rosbot_flow_f4_close_d3_send_f7 |

**DOT 要求**：单 tick 顺序与上述一致；F3-only 时不跑 C 分支、不跑 F0；extension 状态仅由 flow 库更新。

---

## 10. 状态归属与任务注册 — 代码地址

| 说明 | Python 代码地址 |
|------|-----------------|
| 流程开关：flow_master_enabled、bn_only_enabled | `d3utils/rosbot_flow_state.py`：get_flow_master_enabled、get_bn_only_enabled、set_flow_master_enabled、set_bn_only_enabled |
| BN 块状态、ever_confirmed、enter_battlenet_at_b2 | `d3utils/rosbot_flow/flow_bn_block_state.py` |
| Extension 阶段、deadline_tick、phase | `d3utils/rosbot_flow/extension_flow_state.py` |
| 1s 任务注册：rosbot_task → process_rosbot_task，周期 1.0s | `d3utils/system_initializer.py`：register_task('rosbot_task', process_rosbot_task, 1.0)；`rosbot_task_processor.process_rosbot_task` |
| start/stop ROSBOT 任务注册 | `d3utils/rosbot_task_registry.py`：register_start_rosbot_task、register_stop_rosbot_task、get_start_rosbot_task、get_stop_rosbot_task |

**DOT 要求**：流程状态仅由 flow 库持有；UI/控制器只读状态与调用 trigger，不直接写 flow 状态；1s 定时 + 2s 步长与 Python 一致。

---

## 11. 油猴/国服登录（TM 与 B10/B11）— 代码地址

| 说明 | Python 代码地址 |
|------|-----------------|
| 国服 B10/B11：步骤1 点同意/确认→浏览器；步骤2 等待油猴 oauth-done、GET oauth-step1-received | `d3utils/rosbot_flow_battlenet` 国服分支；`share/oauth_callback.py`、`d3utils/rosbot_flow/flow_tm_backend`（若存在）；`controller/http_bridge_controller.py`（oauth-step1-received 等） |

**DOT 要求**：若实现国服流程，与 Python 两步一致；后端 oauth 记录与 B11 轮询语义 1:1。

---

## 12. 步骤–模块索引（简表）

| 块 | 步骤 | Python 模块/文件（路径均相对 pyapps/d3-check） |
|----|------|------------------------------------------------|
| A | A1–A4, A8, A9 | `ui/panels/rosbot_extension_panel.py`、`d3utils/rosbot_task_processor.py`、`d3utils/event_center.py`、`d3utils/task_thread_manager`、`d3utils/system_initializer.py` |
| B | B1–B16 | `d3utils/rosbot_flow_battlenet.py`、`d3utils/rosbot_flow/flow_bn_block_state.py`、`share/asia_credentials.py` |
| F | F0–F4 | `d3utils/rosbot_flow_f0_entry.py`、`d3utils/rosbot_flow_f1_d3_online.py`、`d3utils/rosbot_flow/flow_f1c_f1d.py`、`d3utils/rosbot_flow_f2_rosbot_online.py`、`d3utils/rosbot_flow_f3_log_timeout.py`（及 f3_baseline、f3_history_baseline）、`d3utils/rosbot_flow_f4_close_d3_send_f7.py`、`d3utils/rosbot_flow_rosbot_exit_state.py` |
| C | C1–C12 | `d3utils/rosbot_flow/flow_c_d3_direct.py`、`d3utils/d3_start_game_and_teleport_waiter.py` |
| D | D1–D14 | `controller/login_try_screenshot_controller.py`、`d3utils/battlenet_manager.py`、`d3utils/battlenet_operation.py` |
| E | E1–E6 | `d3utils/rosbot_flow/flow_e_rosbot_run.py`、`d3utils/rosbot_manager.py`、`d3utils/rosbot_ui_automation.py`、`d3utils/rosbot_task_processor.py` |
| Extension | 线程、trigger、started/stopped | `d3utils/d3_extension_thread.py`、`d3utils/event_center.py`、`d3utils/event_signals.py` |
| Flow-master | 单 tick | `d3utils/rosbot_flow/flow_master_driver.py`、`d3utils/rosbot_flow/extension_flow_tick_step.py`、`d3utils/rosbot_flow/extension_flow_state.py`、`d3utils/rosbot_flow/flow_bn_block_state.py` |

---

## 13. 相关文档

- [ROSBOT_FLOW_MERMAID.md](ROSBOT_FLOW_MERMAID.md)：Mermaid 流程图（唯一图示源）。
- [ROSBOT_FLOW.md](ROSBOT_FLOW.md)：流程分支文字描述与约定。
- [ROSBOT_FLOW_STEP_INDEX.md](ROSBOT_FLOW_STEP_INDEX.md)：步骤与模块索引与当前行为说明。
- [DOT_FIX_战网账号密码功能无效.md](../../dotapps/d3check/docs/DOT_FIX_战网账号密码功能无效.md)：战网账号密码在 DOT 端缺凭证时弹窗 1:1 修复。
- [DOT_REF_辅助宏快捷键启动流程.md](DOT_REF_辅助宏快捷键启动流程.md)、[DOT_REF_战斗宏快捷键启动流程.md](DOT_REF_战斗宏快捷键启动流程.md)：辅助宏/战斗宏热键流程供 DOT 参考。

---

**总结**：DOT 实现 ROSBOT 流程时须按本文档与 [ROSBOT_FLOW_MERMAID.md](ROSBOT_FLOW_MERMAID.md) 的节点与顺序 **1:1 仿 Python 功能**；入口（A2/A3）、B/F/C/D/E 块、Extension 线程与 trigger、flow-master 单 tick 顺序及状态归属均需与上表代码地址对应，保证行为一致。代码与注释遵循 DOT 规范（英文/ASCII）。

---

## 14. DOT 实现状态与调试（DOT 端）

| 项 | 说明 |
|----|------|
| **入口与 UI** | DOT 端入口与 Python main.py 对应：应用启动 → 加载配置与 i18n → 创建主窗口与面板；ROSBOT 流程由「启动 ROSBOT」按钮触发，逻辑 1:1 见 [DOT_ROSBOT_FLOW_DEVELOPMENT.md](../../dotapps/d3check/docs/DOT_ROSBOT_FLOW_DEVELOPMENT.md)。 |
| **驱动方式** | Python 为 2s tick 驱动；DOT 为**事件驱动、一次执行、内部轮询**（见 DOT_ROSBOT_FLOW_DEVELOPMENT §7.2），语义等价：Start 后执行 F1→B→D→E 直至完成或失败。 |
| **按钮调试** | 点击 ROSBOT 面板任一按钮时，DOT 在 Log/ROSBOT Log 中输出 `[DEBUG][ROSBOT UI]` 行：按钮名、当前状态（如 RosbotFlowMasterEnabled、EnsureBattlenetOnlyEnabled、BattlenetRegion、路径是否设置、HasBnWindow）、分支与结果，便于 1:1 对照与排错。不在每次状态刷新（UpdateRosbotControlFromState）时打 DEBUG，避免刷屏。 |
| **更新检查 DEBUG** | 点击「更新 ROSBOT」时，RosbotUpdateManager 输出：GetBattlenetRegion/GetDownloadsDir、目录是否存在、仅 asia/cn 支持说明；若 region 有效则输出 FindRosbotZipsInDownloads 数量、当前版本、候选 zip 前几条及 GetBestNewerZip 结果，便于核对「无可用更新」原因。 |
| **无可用更新提示** | 当 CheckUpdate 返回无更新（zipPath 为 null 或 isNewer 为 false）时，除日志外会弹出**居中提示窗口**（非模态）：标题「ROSBOT Update」，内容区分「仅支持 asia/cn 区域」或「未找到更新 zip，请将 20–50MB 且文件名匹配区域的 zip 放入 Downloads」，8 秒后自动关闭，也可点 OK 关闭。 |
| **公共组件与 D3 子类** | **公共库**：`DotCore.UITheme.Controls.CenterMessageWindow`（居中消息窗口，Show(owner, message, title, autoCloseSeconds)）。**D3 子类**：`DotApps.d3check.Windows.D3CheckCenterMessageWindow` 继承该类型，提供 `ShowNoUpdate(owner, message, title, autoCloseSeconds)` 供 ROSBOT 无更新等场景调用；其他面板也可直接使用公共库或该子类。 |
| **参考文档** | [DOT_ROSBOT_FLOW_DEVELOPMENT.md](../../dotapps/d3check/docs/DOT_ROSBOT_FLOW_DEVELOPMENT.md)：B/D/E 块、E5a FlaUI、启动流程与 Python 对照；[DOT_REF_辅助宏快捷键启动流程.md](DOT_REF_辅助宏快捷键启动流程.md) 等。 |
