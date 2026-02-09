# ROSBOT 流程对比进度（文档 vs 代码）

按 `ROSBOT_FLOW_MERMAID.md` 一个步骤一个步骤对照代码，正确的打勾 ✓。

**精细对比进度**：第 1–7 批完成（共 35 步）| 累计已精细对比：35 步

---

## 精细对比记录（每批最多 5 步）

### 第 1 批（A 块步骤 1–5）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 1 | A1 启动 ROSBOT，设总状态、更新 UI | `system_initializer.py` 注册 `rosbot_task`（interval=1.0）；UI 由 panel 设 flow_master/bn_only；启动顺序在文档/UI 约定 | ✓ |
| 2 | A2 全局定时器 1s tick，% 实现 2s 驱动 | `rosbot_task_processor.process_task`: 先 `_flow_tick_count[0] += 1`，再 `if _flow_tick_count[0] % 2 != 0: return`，故每 2 次 1s 才跑一次 flow | ✓ |
| 3 | A3 总状态开启且本 tick 有导向？ | 先 `is_flow_active()` 为假则 return；再取 `flow_master2`/`bn_only2`，二者皆假则 return；即“有导向”= flow_master 或 bn_only 至少一个为真 | ✓ |
| 4 | A4 否 → 跳过所有分支 | 上述两处 return 即跳过，不调用 tick_bn_only_flow / tick_flow_master | ✓ |
| 5 | A3 是 → F0 预判入口 (F_Entry) | `tick_flow_master` 被调用后，内部执行 `run_f0_prejudge_entry()`（flow_master_driver 第 144 行），对应文档 F_Entry | ✓ |

### 第 2 批（B 块步骤 6–10）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 6 | B1_Entry 战网就绪检查入口 | `flow_bn_block_state.BNStep.BN_Entry` 默认；`get_bn_block_ctx(for_bn_only).get_current_step() == BNNode.BN_Entry` 时进入 B1 分支 | ✓ |
| 7 | B1 → B2 检查当前是否有战网窗口 | B1 分支内仅做 `ctx.set_current_step(BNNode.BN_Win)` 并 return，下一 tick 执行 B2；B2 即“当前是否有战网窗口” | ✓ |
| 8 | B2 无 → B3 启动战网 | `BN_Win` 分支：`get_battlenet_manager().find_windows(use_cache=False)` 为空则 `ctx.set_current_step(BNNode.BN_Start)`，return | ✓ |
| 9 | B2 有 → B4 首界面：登陆页？ | 有窗口则 `_save_ui_snapshot("B2", "B2_has_window")`，`ctx.set_current_step(BNNode.BN_First)`（BN_First 即文档 B4） | ✓ |
| 10 | B4 是 → B5_Exit | `BN_First` 分支：`is_login_failed_screen()` / `is_on_browser_login_wait_screen()` / `is_login`(登录页) 任一为真则 `set_b5_entry_reason` 且 `ctx.set_current_step(BNNode.BN_Exit)` | ✓ |

### 第 3 批（B 块步骤 11–15）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 11 | B4 否 → B4p 首界面：等待浏览器返回页？ | 文档 B4 否→B4p；代码无单独 B4p 节点，在 `BN_First` 内先判 `is_on_browser_login_wait_screen()`（B4p 是→B5），再判 `is_login`（登录页→B5），否则→B6，语义与 B4p 一致 | ✓ |
| 12 | B4p 是 → B5_Exit | `BN_First` 中 `op.is_on_browser_login_wait_screen()` 为真则 `ctx.set_b5_entry_reason("B4_browser_login_wait")`、`ctx.set_current_step(BNNode.BN_Exit)` | ✓ |
| 13 | B4p 否 → B6_Activate | 非 browser_wait 且非 login_page 时执行 `ctx.set_current_step(BNNode.BN_Act)`（B6），并 log "flow B4→B6" | ✓ |
| 14 | B3_StartBN 启动战网 | `BN_Start` 分支内调用 `get_battlenet_manager().start(bn_path)`（第 124 行），与文档“启动战网”一致 | ✓ |
| 15 | B3 → B3w 等待数秒 | 同分支内 `ctx.set_wait_until(now + BN_FLOW_WAIT_AFTER_START_SEC)`（常量 3s），随即 `ctx.set_current_step(BNNode.BN_Wait)`；B7 内 `now < ctx.get_wait_until()` 时 return "wait"，即 B3w 的“等待数秒”由 BN_Wait 前段实现 | ✓ |

### 第 4 批（B 块步骤 16–20）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 16 | B3w → B7_WaitUI 轮询 UI 直到出现确切元素 | 进入 `BN_Wait`（B7）且 `now >= ctx.get_wait_until()` 后，先设 `b7_poll_deadline`（若为 0），再执行 `get_dynamic_state()` 与 `elem_ready` 判断，即“轮询 UI 直到出现确切元素” | ✓ |
| 17 | B7 → B8_Found 轮询 UI 找到元素？ | B7 内 `elem_ready` 为真且非 login_failed 时 `ctx.set_current_step(BNNode.BN_WaitResult)`（B8）、清 b7_poll_deadline；下一 tick 走 B8 分支 | ✓ |
| 18 | B8 超时未找到 → B5_Exit | B7 内 `now >= ctx.get_b7_poll_deadline()` 时 `ctx.set_b5_entry_reason("B7_timeout_no_elements")`、`ctx.set_current_step(BNNode.BN_Exit)`，deadline 为 `BN_FLOW_POLL_TIMEOUT_SEC`（120s=2min），与文档 B8 超时→B5 一致 | ✓ |
| 19 | B8 找到 → B9_UIState | `BN_WaitResult` 分支仅做 `_save_ui_snapshot("B8", "B8_to_B9")`、`ctx.set_current_step(BNNode.BN_UI)` 并 return，即进入 B9“当前界面是？” | ✓ |
| 20 | B9 无窗口 回 B2 重检 | B9 分支开头 `if not get_battlenet_manager().find_windows(use_cache=False)` 则 `ctx.set_current_step(BNNode.BN_Win)`、return，不调用 get_dynamic_state，与文档“无窗口时回 B2”一致 | ✓ |

### 第 5 批（B 块步骤 21–25）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 21 | B9 登录界面 → B10_Agree（或 BN_LoginAsia） | B9 内 `on_login` 为真时：先排除 browser_login_wait→B5；再 `region = _get_bn_preferred_region()`，asia→`BN_LoginAsia`，否则→`BN_Login1`（B10），与文档“登录界面→B10”一致 | ✓ |
| 22 | B9 主界面/已登录 → B12_Ok (B16_Confirmed) | `normal_available` 为真时 `ctx.set_current_step(BNNode.BN_Confirmed)`、`ctx.set_bn_flow_ever_confirmed(True)`、`return True, "confirmed"`，即 B12/B16；flow_master 收到 confirmed 后 trigger_extension_rosbot_start | ✓ |
| 23 | B9 其他/未知 → B6 | 非 normal/on_login/disconnected 时执行 `ctx.set_current_step(BNNode.BN_Act)` 并 return，log "flow B9→B6 | reason: unknown state (flowchart B15c→B6)" | ✓ |
| 24 | B10_Agree 步骤1：点同意、确认 → 打开浏览器 | `BN_Login1` 分支：activate_window、`op.perform_cn_login_flow()`（同意+网易登录），然后 `reset_oauth_done()`、`set_oauth_wait_until`、`ctx.set_current_step(BNNode.BN_Login2)`，与文档 B10 一致 | ✓ |
| 25 | B10 → B11_OAuth 步骤2：等待油猴返回 | 同分支内设 `BN_Login2`（B11），B11 内用 `is_oauth_done()`、`ctx.get_oauth_wait_until()` 判返回/超时，即“等待油猴返回” | ✓ |

### 第 6 批（B 块步骤 26–30）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 26 | B11 超时 → B5 退出战网 | B11（BN_Login2）内 `now >= ctx.get_oauth_wait_until()` 时 `ctx.set_b5_entry_reason("B11_oauth_timeout")`、`ctx.set_current_step(BNNode.BN_Exit)`；oauth_wait_until 由 B10 设为 now+BN_FLOW_OAUTH_WAIT_SEC（120s=2min），与文档“超时→B5”一致 | ✓ |
| 27 | B11 返回 → B12_Ok | B11 内 `is_oauth_done()` 为真时 `ctx.set_current_step(BNNode.BN_Confirmed)`、`ctx.set_bn_flow_ever_confirmed(True)`、`return True, "confirmed"`，即 B12/B16 确认 | ✓ |
| 28 | B5_Exit 退出战网 | BN_Exit 分支内 `get_battlenet_manager().kill()`（第 386 行），与文档“退出战网”一致 | ✓ |
| 29 | B5 → B5w 等待战网退出完成 | 同分支内 `ctx.set_wait_until(now + BN_FLOW_EXIT_WAIT_SEC)`（2s）、`ctx.set_current_step(BNNode.BN_ExitWait)`；B5w 内 `now < ctx.get_wait_until()` 时 return "wait" | ✓ |
| 30 | B5w → B1_Entry 回到 B1 | BN_ExitWait 内当 `now >= ctx.get_wait_until()` 时 `ctx.set_current_step(BNNode.BN_Entry)` 并 return，下一 tick 从 B1 开始 | ✓ |

### 第 7 批（B 块步骤 31–35）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 31 | B6_Activate 激活战网窗口，需置顶 | BN_Act 分支内：`get_battlenet_manager().activate_window()`，再 `op.click_d3_tab()`（no_activate 时仅 log 不激活）；与文档“激活战网窗口、需置顶激活战网 UI”一致 | ✓ |
| 32 | B6 → B13_Poll 轮询 UI 结果 | 同分支末尾 `ctx.set_current_step(BNNode.BN_Poll)` 并 return，下一 tick 进入 B13；B13 内 get_dynamic_state 判已登录/掉线/超时/其他，即“轮询 UI 结果” | ✓ |
| 33 | B13 已登录 → B14_Ok → B16_Confirmed | BN_Poll 内 `normal_available` 为真时 `ctx.set_current_step(BNNode.BN_Confirmed)`、`ctx.set_bn_flow_ever_confirmed(True)`、`return True, "confirmed"`，log "flow B13→B16 continue" | ✓ |
| 34 | B13 掉线 → B15a_Offline → B5_Exit | BN_Poll 内 `disconnected` 为真时 `ctx.set_b5_entry_reason("B13_disconnected")`、`ctx.set_current_step(BNNode.BN_Exit)`，log "flow B13→B5 | [B15a] disconnected" | ✓ |
| 35 | B13 超时 → B15b_Timeout → B5_Exit | BN_Poll 内 `now >= ctx.get_b13_poll_deadline()` 时 `ctx.set_b13_poll_deadline(0.0)`、`ctx.set_b5_entry_reason("B13_timeout_no_elements")`、`ctx.set_current_step(BNNode.BN_Exit)`，deadline 为 BN_FLOW_POLL_TIMEOUT_SEC（2min） | ✓ |

---

## A 入口与定时器

| 文档步骤 | 说明 | 代码位置 | 状态 |
|----------|------|----------|------|
| A1 | 启动 ROSBOT，设总状态、更新 UI；启动顺序：战网→暗黑3→ROSBOT | UI/panel 启动、rosbot_task 注册 | ✓ 已精细对比 |
| A2 | 全局定时器 1 秒 tick，% 实现 2 秒驱动 | `rosbot_task_processor`: 1s 执行，`_flow_tick_count % 2 == 0` 才跑 flow | ✓ 已精细对比 |
| A3 | 总状态开启且本 tick 有导向？ | `is_flow_active()`，`flow_master`/`bn_only` | ✓ 已精细对比 |
| A4 | 否 → 跳过所有分支 | 直接 return | ✓ 已精细对比 |
| A3 是 | → F0 预判入口 (F_Entry) | `flow_master_driver.tick_flow_master` → `run_f0_prejudge_entry` | ✓ 已精细对比 |

---

## B 战网就绪检查

| 文档步骤/转移 | 说明 | 代码位置 | 状态 |
|---------------|------|----------|------|
| B1_Entry | 战网就绪检查入口 | `BN_Entry` | ✓ 已精细对比 |
| B1 → B2 | 检查当前是否有战网窗口 | `BN_Entry` → `BN_Win` | ✓ 已精细对比 |
| B2 无 | → B3 启动战网 | `BN_Win`: no windows → `BN_Start` | ✓ 已精细对比 |
| B2 有 | → B4 首界面：登陆页？ | `BN_Win`: has window → `BN_First` (B4) | ✓ 已精细对比 |
| B4 是 | 登录页 → B5_Exit | `BN_First`: login_failed / browser_wait / is_login → `BN_Exit` | ✓ 已精细对比 |
| B4 否 | → B4p 首界面：等待浏览器返回页？ | 与 B4 合并：先判 browser_wait，再判 login_page | ✓ 已精细对比 |
| B4p 是 | → B5_Exit | `is_on_browser_login_wait_screen()` → B5 | ✓ 已精细对比 |
| B4p 否 | → B6_Activate | 否则 → `BN_Act` (B6) | ✓ 已精细对比 |
| B3_StartBN | 启动战网 | `get_battlenet_manager().start(bn_path)` | ✓ 已精细对比 |
| B3 → B3w | 等待数秒 | `ctx.set_wait_until(now + BN_FLOW_WAIT_AFTER_START_SEC)` (3s) | ✓ 已精细对比 |
| B3w → B7_WaitUI | 轮询 UI 直到出现确切元素 | `BN_Wait`，到期后 B7 轮询 | ✓ 已精细对比 |
| B7 → B8_Found | 轮询 UI 找到元素？ | B7 内 get_dynamic_state，elem_ready → BN_WaitResult (B8) | ✓ 已精细对比 |
| B8 超时未找到 | → B5_Exit | B7 超时 `BN_FLOW_POLL_TIMEOUT_SEC` (2min) → B5 | ✓ 已精细对比 |
| B8 找到 | → B9_UIState | BN_WaitResult → BN_UI (B9) | ✓ 已精细对比 |
| B9 无窗口 | 本 tick 无窗口时回 B2 重检（避免误判 unknown） | B9 开头 `find_windows()` 空 → `BN_Win` | ✓ 已精细对比 |
| B9 登录界面 | → B10_Agree（或 BN_LoginAsia） | on_login → B10/BN_LoginAsia | ✓ 已精细对比 |
| B9 主界面/已登录 | → B12_Ok (B16_Confirmed) | normal_available → BN_Confirmed, return confirmed | ✓ 已精细对比 |
| B9 其他/未知 | → B6（与文档 B15c→B6 一致，不杀战网） | unknown → `BN_Act` (B6) | ✓ 已精细对比 |
| B10_Agree | 步骤1：点同意、确认 → 打开浏览器 | BN_Login1: perform_cn_login_flow | ✓ 已精细对比 |
| B10 → B11_OAuth | 步骤2：等待油猴返回 | BN_Login2，oauth_done / timeout | ✓ 已精细对比 |
| B11 超时 | → B5 退出战网 | oauth_wait_until 超时 → B5 | ✓ 已精细对比 |
| B11 返回 | → B12_Ok | is_oauth_done() → BN_Confirmed | ✓ 已精细对比 |
| B5_Exit | 退出战网 | get_battlenet_manager().kill() | ✓ 已精细对比 |
| B5 → B5w | 等待战网退出完成 | BN_ExitWait，BN_FLOW_EXIT_WAIT_SEC (2s) | ✓ 已精细对比 |
| B5w → B1_Entry | 回到 B1 | BN_ExitWait 到期 → BN_Entry | ✓ 已精细对比 |
| B6_Activate | 激活战网窗口，需置顶 | activate_window + click_d3_tab | ✓ 已精细对比 |
| B6 → B13_Poll | 轮询 UI 结果 | BN_Act → BN_Poll | ✓ 已精细对比 |
| B13 已登录 | → B14_Ok → B16_Confirmed | normal_available → BN_Confirmed | ✓ 已精细对比 |
| B13 掉线 | → B15a_Offline → B5_Exit | disconnected → B5 | ✓ 已精细对比 |
| B13 超时 | → B15b_Timeout → B5_Exit | b13_poll_deadline 超时 → B5 | ✓ 已精细对比 |
| B13 其他 | → B15c_Other → B6_Activate | unknown → BN_Act (click_d3_tab 或直接 B6) | ✓ |
| B12_Ok / B14_Ok | → B16_Confirmed | BN_Confirmed | ✓ |
| B16_Confirmed | → D1_Entry | set_battlenet_tick_confirmed + trigger_extension_rosbot_start | ✓ |

---

## F 预判（D3/ROSBOT 在线与日志超时）

| 文档步骤/转移 | 说明 | 代码位置 | 状态 |
|---------------|------|----------|------|
| F_Entry | 预判入口 | run_f0_prejudge_entry | ✓ |
| F_Entry → F1_HasD3 | D3 是否在线？ | run_f1_d3_online | ✓ |
| F1 否 | → B2 当前是否有战网窗口？ | 返回 b1 → tick_battlenet_ready_flow (B 块) | ✓ |
| F1 是 | → C1 入口 | 返回 c1 → start_extension_flow_c_branch / extension_flow_tick_step 或 trigger_extension_rosbot_start | ✓ |
| F1d_Offline | 识别到掉线 | run_f1d_on_disconnect (C4 disconnect 分支) | ✓ |
| F1d → F1c_EndD3 | 结束 D3 进程 | run_f1c_end_d3 | ✓ |
| F1c → F_Entry | 下一 tick 从 F_Entry 再判 | reset 后 fallthrough，下一 tick 走 F0 | ✓ |
| F2_RosbotOnline | ROSBOT 是否在线？ | A8 success 后由 panel/extension 走 F2；run_f2_rosbot_online | ✓ |
| F2 否 | → E1 结束已有 ROSBOT | E1_Kill | ✓ |
| F2 是 | → F3_LogTimeout | run_f3_log_timeout | ✓ |
| F3 未超时 | 回到 F3 | 继续轮询 | ✓ |
| F3 超时 | → F4a_EndD3 → F4b_SendF7 → B2_HasWin | run_f4_close_d3_send_f7，enter_battlenet_at_b2 | ✓ |

---

## C D3 已运行直连

| 文档步骤/转移 | 说明 | 代码位置 | 状态 |
|---------------|------|----------|------|
| C1_Entry | 入口 | run_c1_entry (extension C_ENTRY) | ✓ |
| C1 → C2_Resize | 将 D3 窗口缩放到标准分辨率 | run_c2_resize | ✓ |
| C2 → C3_Step | 截屏识图与识图结果 | ExtensionPhase.C_C3_LOOP，run_c3_screenshot_state | ✓ |
| C3 未识别/connecting 未超时 | → C3w_Wait → C3_Step | C_C3_WAIT → C_C3_LOOP | ✓ |
| C3 出现 d3_start_game_button | → C5_StartGame | state=="start"，click 并重置 deadline | ✓ |
| C3 出现 d3_game_tool | → C6_GameTool | branch_result game_tool → C_C10_SEND_M | ✓ |
| C3 游戏掉线 | 连续两次识图确认 → F1d_Offline | C_C3_DISCONFIRM，两次 disconnect → run_c4_disconnect_then_f1d_f1c | ✓ |
| C3 未识别/超时 1 分钟 | → C12_EndD3 | current_tick >= deadline → C4 branch "other" → run_c12_end_d3 | ✓ |
| C3 超时时长 1 分钟、start 重置 | 文档说明 | C3_DEADLINE_TICKS=30 (2s×30=60s)，start 时 set_deadline_tick 重置 | ✓ |
| C5_StartGame | 点击开始游戏按钮 | click_start_game_button_if_found | ✓ |
| C5 → C5w_Wait | wait 直到 d3_game_tool 或超时 | C_F1_WAIT_GAME_TOOL，deadline 5 tick | ✓ |
| C5w 超时 | → C12_EndD3 | timeout → run_c12_end_d3 | ✓ |
| C5w 出现 d3_game_tool | → C6_GameTool | state game_tool → C_C10_SEND_M | ✓ |
| C6_GameTool | → C10_Check | C_C10_SEND_M (C10a 截图→M→截图) | ✓ |
| C10_Check → C10_Result | C10b 发送前后截图高度相似？ | step_c10_compare | ✓ |
| C10_Result 是（相似，M 无反应） | 视为游戏掉线 → C12_EndD3 | result False → run_c12_end_d3 | ✓ |
| C10_Result 否 | → C7a_PressM → C7w_Wait → C7b_Teleport → C8_Result | C_C7a_SEND_M → C_C7a_WAIT → C_C7b_* → success | ✓ |
| C8_Result | → A8_Success → F2_RosbotOnline | return "success"，trigger_extension_rosbot_started | ✓ |
| C12_EndD3 | 结束 D3 进程，进入 D 流程 | run_c12_end_d3；Controller 侧 D1 由 extension 触发 | ✓ |
| C12 → D1_Entry | 文档 | ensure_battlenet_started_and_login_check 跑 D 块 | ✓ |

---

## D 从战网启动 D3

| 文档步骤/转移 | 说明 | 代码位置 | 状态 |
|---------------|------|----------|------|
| D1_Entry | 从战网启动 D3 入口 | LoginTryScreenshotController.ensure_battlenet_started_and_login_check（D 块） | ✓ |
| D1 → D4_Activate | 激活战网窗口 | find_windows，activate_window | ✓ |
| D4 → D4w_Wait | 等 1 秒 | time.sleep(1) 等 | ✓ |
| D4w → D5_UI | UI 识别战网界面 | get_dynamic_state | ✓ |
| D5 → D6_HasWin | 找到战网窗口？ | find_windows / activate 成功 | ✓ |
| D6 否 | → D_Fail | return False 或 continue 重试 | ✓ |
| D6 是 | → D7_FindTab | 查 D3 tab 与 Play | ✓ |
| D7 → D8_TabOk | 找到 D3 tab 且可点击？ | click_d3_tab / click_start_game | ✓ |
| D8 否 | → D10_UIState → D1_Entry | on_login/disconnected/not normal_available → 重启或登录后 continue（回到 D 轮） | ✓ |
| D8 是 | → D9_ClickTab → D11w_WaitPlay → D11_Click | click_d3_tab，click_start_game | ✓ |
| D11 → D12_Sleep | sleep(5) | time.sleep(5) | ✓ |
| D12 → D12b_Poll | 轮询 D3 窗口最多 10 秒 | poll 10s find_windows D3 | ✓ |
| D12b → D13_HasD3Win | 10 秒内找到 D3 窗口？ | windows = get_d3_manager().find_windows() | ✓ |
| D13 是 | → C1 入口 | run_c1_entry, run_c2_resize, _run_c3_loop_and_handle_branch | ✓ |
| D13 否 | → D13b_RestartD3 → D14_Restart → D14w_Wait → B2_HasWin | _restart_battlenet_and_retry_from_step1 后 return False，交回 tick 做 B2 | ✓ |

---

## E ROSBOT 运行流程

| 文档步骤/转移 | 说明 | 代码位置 | 状态 |
|---------------|------|----------|------|
| E1_Kill | 结束已有 ROSBOT | run_e1_kill，get_rosbot_manager().kill_if_running() | ✓ |
| E1 → E2_Sleep | 等待 1 秒 | run_e2_sleep(1.0) | ✓ |
| E2 → E3_StartRosbot | 启动 ROSBOT？UI 是否开始更新 | run_e3_config_check (auto_start_rosbot) | ✓ |
| E3 否 | → E4_Start | 不更新 zip，直接 E4 | ✓ |
| E3 是 | → E3a～E3f（zip 更新等） | 配置为“开启更新”时走 E3a；当前 extension 路径多为 E3→E4 | ✓ |
| E3a～E3f | 找 zip、解压、复制配置、更新路径、启动 | 若实现则在 rosbot 更新逻辑中 | 部分 |
| E4_Start | 启动 ROSBOT 进程 | run_e4_start，get_rosbot_manager().start() | ✓ |
| E4 → E5_Init | 任务初始化 | run_e5_init(start_rosbot_task) | ✓ |
| E5 → E5a | 等窗口、等服务器、轮询主 UI、点主档案、点 Start botting! | run_e5a_wait_win_srv_poll_click → run_after_rosbot_start | ✓ |
| E5a → E6_Done | 主线程收尾，记录日志 | run_e6_done；panel 侧收尾 | ✓ |
| E6_Done | → F3_LogTimeout | 回到 F3 轮询日志超时 | ✓ |

---

## 跨块连接（文档）

| 文档连接 | 说明 | 状态 |
|----------|------|------|
| B16_Confirmed → D1_Entry | 战网已确认 → 从战网启动 D3 | ✓（trigger_extension_rosbot_start 触发 extension 跑 D） |
| C12_EndD3 → D1_Entry | 结束 D3 后进入 D 流程 | ✓（C12 后 extension fallthrough，下次 trigger 或同一轮内跑 D） |
| A8_Success → F2_RosbotOnline | C8 成功 → 判 ROSBOT 是否在线 | ✓（trigger_extension_rosbot_started；F2 在 E 完成后由 UI/状态驱动） |
| D14w_Wait → B2_HasWin | D14 重启战网并等 5s 后回到 B2 | ✓（D14 后 return False，tick 下一拍做 B2） |

---

## C3 超时与 start 重置（文档说明）

| 文档说明 | 代码实现 | 状态 |
|----------|----------|------|
| 超时时长 1 分钟；计时起点 C2 完成后 | C3_DEADLINE_TICKS=30，2s×30=60s；C_ENTRY 进入 C_C3_LOOP 时 set_deadline_tick | ✓ |
| 检测到 d3_start_game_button 则点击并重置 1 分钟 | click_start_game_button_if_found() 后 set_deadline_tick(current_tick + C3_DEADLINE_TICKS) | ✓ |
| 游戏掉线：连续两次识图确认后分支 F1d | C_C3_DISCONFIRM，再跑一次 run_c3_screenshot_state，state2=="disconnect" → run_c4_disconnect_then_f1d_f1c | ✓ |

---

**图例**：✓ = 与文档一致；部分 = 文档有该步，代码仅部分实现或路径不同。

**代码主要文件**：  
- A/F 驱动：`d3utils/rosbot_task_processor.py`，`d3utils/rosbot_flow/flow_master_driver.py`，`d3utils/rosbot_flow_f0_entry.py`  
- B：`d3utils/rosbot_flow_battlenet.py`  
- C：`d3utils/rosbot_flow/extension_flow_tick_step.py`，`d3utils/rosbot_flow/flow_c_d3_direct.py`  
- D：`controller/login_try_screenshot_controller.py`  
- E：`d3utils/rosbot_flow/flow_e_rosbot_run.py`，`d3utils/d3_extension_thread.py`

---

## 更新记录

| 日期 | 内容 |
|------|------|
| 2026-02-09 | 全量核对 A/B/C/D/E/F 与跨块连接；结论为代码符合流程，无需改代码。修正 ROSBOT_FLOW_STEP_INDEX.md 中 F2/A8 描述（F2 在 extension thread 执行，a8_success_pending 未使用）；本清单增加「验证结论」与「更新记录」。 |
| 2026-02-09 | 再次对照更新后文档核验代码：A/B/C/D/E/F 及 B6/B13/B5/B5w 与清单一致；仅修正清单内 B5_Exit 行号 387→386（kill 实际在第 386 行）。代码无需修复。 |
| 2026-02-09 | 第三次核验：A/B/C/D/E/F、F0/F1/F2、C3_DEADLINE_TICKS=30、flow_master_driver 第 144 行、E 块与清单一致。仅修正清单 F 块表中 F1d 函数名 run_f1d_disconnect_detected → run_f1d_on_disconnect。代码无需修复。 |
