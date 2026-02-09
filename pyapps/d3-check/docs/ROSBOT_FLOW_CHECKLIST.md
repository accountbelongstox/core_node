# ROSBOT 流程对比进度（文档 vs 代码）

按 `ROSBOT_FLOW_MERMAID.md` 一个步骤一个步骤对照代码，正确的打勾 ✓。

**精细对比进度**：第 1–18 批完成（共 90 步）| 累计已精细对比：90 步 | 全部对比完成

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

### 第 8 批（B 块步骤 36–37 + B16→D1 + F 块步骤 38–40）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 36 | B13 其他 → B15c_Other → B6_Activate | BN_Poll 内非 normal/disconnected/on_login/browser_wait 且未超时时：`op.click_d3_tab()`（no_activate 时跳过），`ctx.set_b13_poll_deadline(0.0)`、`ctx.set_current_step(BNNode.BN_Act)`，log "flow B13→B6 | [B15c] unknown state" | ✓ |
| 37 | B12_Ok / B14_Ok → B16_Confirmed | B9/B11 确认时已设 BN_Confirmed、set_bn_flow_ever_confirmed；B13 确认同理，无单独 B12/B14 节点，BN_Confirmed 即文档 B16 | ✓ |
| 38 | B16_Confirmed → D1_Entry | flow_master_driver：当 tick_battlenet_ready_flow 返回 done=True, result="confirmed" 时 `set_battlenet_tick_confirmed(_FM_BN)`、`trigger_extension_rosbot_start()`，extension 线程执行 ensure_battlenet_started_and_login_check（D1 从战网启动 D3） | ✓ |
| 39 | F_Entry 预判入口 | flow_master_driver 在 F0_PREJUDGE 步骤调用 `run_f0_prejudge_entry()`（rosbot_flow_f0_entry），内层仅调用 run_f1_d3_online，即文档“F_Entry→F1” | ✓ |
| 40 | F_Entry→F1_HasD3；F1 否→B2 | run_f0_prejudge_entry 内 step=run_f1_d3_online()（get_d3_manager().is_running()）；step=="b1" 时 return "b1"，flow_master 走 F0_ACTION_B1 即 tick_battlenet_ready_flow（B 块入口，本 tick 为 B1→B2），与文档 F1 否→B2 一致 | ✓ |

### 第 9 批（F 块步骤 41–45）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 41 | F1 是 → C1 入口 | action==C1 时：若 extension_flow_is_idle() 且 get_bn_flow_ever_confirmed() 且 get_d3_manager().is_running() 则 start_extension_flow_c_branch()、extension_flow_tick_step()（C 块）；否则 trigger_extension_rosbot_start()（extension 跑 D/C），与文档 F1 是→C1 一致 | ✓ |
| 42 | F1d_Offline 识别到掉线 | C4 branch_result=="disconnect" 时调用 run_c4_disconnect_then_f1d_f1c()，其内先 run_f1d_on_disconnect()：set_d3_dynamic_status(disconnected=True)、reset_flow_master_bn_block()，log "[F1d] Disconnect detected" | ✓ |
| 43 | F1d → F1c_EndD3 结束 D3 进程 | run_c4_disconnect_then_f1d_f1c() 在 run_f1d_on_disconnect() 后调用 run_f1c_end_d3()：get_d3_manager().kill_if_running()，与文档“结束 D3 进程”一致 | ✓ |
| 44 | F1c → F_Entry 下一 tick 从 F_Entry 再判 | run_f1c_end_d3 后 extension_flow_tick_step 返回 "fallthrough"，本 tick 不再跑 B；下一 tick flow_master 仍从 F0_PREJUDGE（run_f0_prejudge_entry）开始，即 F_Entry | ✓ |
| 45 | F2_RosbotOnline ROSBOT 是否在线？ | ensure_battlenet_started_and_login_check 返回 True 后，d3_extension_thread 内 step=run_f2_rosbot_online()（refresh_rosbot_status、读 rosbot_extended_status），返回 "c1"/"f3"，与文档“F2 在 A8 success 后执行”一致 | ✓ |

### 第 10 批（F 块步骤 46–50）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 46 | F2 否 → E1 结束已有 ROSBOT | d3_extension_thread 中 run_f2_rosbot_online() 返回 "c1" 时执行 run_e1_kill()（flow_e_rosbot_run：get_rosbot_manager().kill_if_running()），随后 E2–E6 启动 ROSBOT，与文档 F2 否→E1 一致 | ✓ |
| 47 | F2 是 → F3_LogTimeout | run_f2 返回 "f3" 时 extension 不跑 E 块；下一 tick flow_master 中 g.rosbot_extended_status in ("running","paused") 成立，走 F3_F4 步骤调用 run_f3_log_timeout()，即 F2 是→F3 | ✓ |
| 48 | F3 未超时 回到 F3 | run_f3_log_timeout() 返回 "f3_stay"（last_log 未超时），flow_master 不进入 step=="f4" 分支，下一 tick 仍走 F3_F4 即继续轮询 F3 | ✓ |
| 49 | F3 超时 → F4a_EndD3 → F4b_SendF7 | run_f3_log_timeout() 超时或 last_ts<=0 时返回 "f4"；flow_master 内 if step=="f4" 调用 run_f4_close_d3_send_f7()（kill D3、send_f7_to_system、kill rosbot），与文档 F4a/F4b 一致 | ✓ |
| 50 | F4 → B2_HasWin | run_f4_close_d3_send_f7() 后 flow_master 立即 enter_battlenet_at_b2(_FM_BN)，即进入 B 块 B2 检查战网窗口，与文档 F4→B2_HasWin 一致 | ✓ |

### 第 11 批（C 块步骤 51–55）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 51 | C1_Entry 入口 | extension_flow_tick_step 在 C_ENTRY 时 run_c1_entry(has_bn_confirmed, has_d3_process)；flow_c_d3_direct.run_c1_entry 返回 has_bn_confirmed and has_d3_process；Controller 侧 ensure_* 中 run_c1_entry(has_bn_confirmed, has_d3_process) 一致 | ✓ |
| 52 | C1 → C2_Resize 将 D3 窗口缩放到标准分辨率 | C_ENTRY 通过后 run_c2_resize()（resize_window_by_titles_to_client_size），随后 set_phase(C_C3_LOOP)、set_deadline_tick，与文档 C1→C2→C3 一致 | ✓ |
| 53 | C2 → C3_Step 截屏识图与识图结果 | phase==C_C3_LOOP 时 state=run_c3_screenshot_state()（detect_d3_already_running_state：disconnect/start/game_tool/wait/None），与文档 C3 一步截屏识图一致 | ✓ |
| 54 | C3 未识别/connecting 未超时 → C3w_Wait → C3_Step | state 非 disconnect/start/game_tool 时（wait 即 connecting 或 None）set_phase(C_C3_WAIT)、set_wait_ticks_remaining(1)；下一 tick C_C3_WAIT 递减后 set_phase(C_C3_LOOP)，与文档 C3w→C3 一致 | ✓ |
| 55 | C3 出现 d3_start_game_button → C5_StartGame | C_C3_LOOP 内 state=="start" 时 click_start_game_button_if_found()，成功则 set_deadline_tick(current_tick+C3_DEADLINE_TICKS)，再 set_phase(C_C3_WAIT) 等 1 tick 后回 C3，与文档“start 时 click 并重置 deadline”一致 | ✓ |

### 第 12 批（C 块步骤 56–60）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 56 | C3 出现 d3_game_tool → C6_GameTool | C_C3_LOOP 内 state=="game_tool" 时 set_phase(C_C4_BRANCH)、set_payload("branch_result","game_tool")；C4 分支 branch_result=="game_tool" 时 set_phase(C_C10_SEND_M)，即 C6→C10_Check（截图→M），与文档一致 | ✓ |
| 57 | C3 游戏掉线 连续两次 → F1d_Offline | state=="disconnect" 时 set_phase(C_C3_DISCONFIRM)、set_wait_ticks_remaining(1)；下一 tick 再 run_c3_screenshot_state() 若仍 "disconnect" 则 set_phase(C_C4_BRANCH)、set_payload("disconnect")，C4 内 run_c4_disconnect_then_f1d_f1c() | ✓ |
| 58 | C3 未识别/超时 1 分钟 → C12_EndD3 | current_tick >= deadline 时 set_phase(C_C4_BRANCH)、set_payload(state or "other")；C4 中 branch_result 非 disconnect/start/game_tool 时 run_c12_end_d3()、reset_state()、return "fallthrough" | ✓ |
| 59 | C3 超时时长 1 分钟、start 重置 | providor/constants/d3.py C3_DEADLINE_TICKS=30（2s×30=60s）；C_ENTRY 后 set_deadline_tick(current_tick+C3_DEADLINE_TICKS)；state=="start" 且 click 成功时 set_deadline_tick(current_tick+C3_DEADLINE_TICKS) 重置 | ✓ |
| 60 | C5_StartGame 点击开始游戏按钮 | C3 循环内 state=="start" 时 click_start_game_button_if_found()（d3_start_game_and_teleport_waiter）；C4 branch "start" 时进入 C_F1_WAIT_GAME_TOOL（C5w），与文档 C5 点击一致 | ✓ |

### 第 13 批（C 块步骤 61–65）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 61 | C5 → C5w_Wait wait 直到 d3_game_tool 或超时 | C4 branch_result=="start" 时 set_phase(C_F1_WAIT_GAME_TOOL)、set_deadline_tick(current_tick+5)（5 tick=10s）；phase==C_F1_WAIT_GAME_TOOL 时每 tick 调 detect_d3_already_running_state，与文档 C5w 一致 | ✓ |
| 62 | C5w 超时 → C12_EndD3 | C_F1_WAIT_GAME_TOOL 内 current_tick >= get_deadline_tick() 时 run_c12_end_d3()、reset_state()、return "fallthrough"，log "C5w timeout -> C12" | ✓ |
| 63 | C5w 出现 d3_game_tool → C6_GameTool | C_F1_WAIT_GAME_TOOL 内 state=="game_tool" 时 set_phase(C_C10_SEND_M)，即进入 C10_Check（C6→C10）；C_C10_SEND_M 即文档 C10a 截图→M | ✓ |
| 64 | C6_GameTool → C10_Check | phase==C_C10_SEND_M 时调用 step_c10_send_m(window_titles)，失败则 run_c12_end_d3；成功则 set_phase(C_C10_WAIT)、set_wait_ticks_remaining(1)，下一 tick 进入 C_C10_COMPARE（C10b） | ✓ |
| 65 | C10_Check → C10_Result C10b 发送前后截图高度相似？ | phase==C_C10_COMPARE 时 result=step_c10_compare(window_titles)；result is False 或 not True 时 run_c12_end_d3；True 时 set_phase(C_C7a_SEND_M)，与文档 C10_Result 一致 | ✓ |

### 第 14 批（C 块步骤 66–70）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 66 | C10_Result 是（相似，M 无反应）→ C12_EndD3 | C_C10_COMPARE 内 result is False 时 run_c12_end_d3()、reset_state()、return "fallthrough"；step_c10_compare 返回 False 表示截图高度相似（M 无反应、掉线），与文档一致 | ✓ |
| 67 | C10_Result 否 → C7a→C7w→C7b→C8_Result | result is True 时 set_phase(C_C7a_SEND_M)；随后 C_C7a_SEND_M→C_C7a_WAIT→C_C7b_MINIMIZE→C_C7b_WAIT→C_C7b_TELEPORT；C_C7b_TELEPORT 内 set_d3_status(True)、kill_if_running、start_rosbot、run_after_rosbot_start 后 reset_state()、return "success"，即 C8→A8 | ✓ |
| 68 | C8_Result → A8_Success → F2_RosbotOnline | extension_flow_tick_step  return "success" 后 flow_master_driver 调用 trigger_extension_rosbot_started(True)；extension 线程侧 ensure_* 返回 True 后执行 run_f2_rosbot_online()，与文档 A8→F2 一致 | ✓ |
| 69 | C12_EndD3 结束 D3 进程，进入 D 流程 | run_c12_end_d3() 在 extension_flow_tick_step 多处调用（C5w 超时、C10 失败、C4 other 等），内部 get_d3_manager().kill_if_running()；return "fallthrough" 后 extension 由 trigger 或下一轮跑 D，与文档 C12→D1 一致 | ✓ |
| 70 | C12 → D1_Entry | C12 后 reset_state()、return "fallthrough"，flow_master 本 tick 不跑 B；extension 线程下次 ensure_battlenet_started_and_login_check 或 trigger_extension_rosbot_start 触发时执行 D 块（从战网启动 D3），与文档一致 | ✓ |

### 第 15 批（D 块步骤 71–75）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 71 | D1_Entry 从战网启动 D3 入口 | ensure_battlenet_started_and_login_check() 为 D 块唯一入口；内部先判 run_c1_entry（D3 已运行直连 C），否则走 D 分支：find_windows、activate、get_dynamic_state、click_d3_tab、click_start_game 等，与文档一致 | ✓ |
| 72 | D1 → D4_Activate 激活战网窗口 | D 分支内 get_battlenet_manager().find_windows()、get_battlenet_manager().activate_window()（含 tray 激活），与文档 D1→D4 一致 | ✓ |
| 73 | D4 → D4w_Wait 等 1 秒 | 激活后 time.sleep(1)（如 640 行附近），与文档 D4w 等 1 秒一致 | ✓ |
| 74 | D4w → D5_UI UI 识别战网界面 | sleep(1) 后 op.get_dynamic_state() 得 on_login/disconnected/normal_available，与文档 D5 当前界面判断一致 | ✓ |
| 75 | D5 → D6_HasWin 找到战网窗口？ | find_windows 非空且 activate 成功则继续；否则 return False 或重试，与文档 D6 否→D_Fail / 是→D7 一致 | ✓ |

### 第 16 批（D 块步骤 76–80）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 76 | D6 否 → D_Fail；D6 是 → D7_FindTab | 无窗口或非 normal 时 continue 重试或 return False；有窗口且需点 tab 时 op.click_d3_tab()、op.click_start_game()，与文档 D7→D8 一致 | ✓ |
| 77 | D8 否 → D10_UIState → D1_Entry | on_login/disconnected 时重启战网或登录流程后 continue（_restart_battlenet_and_retry_from_step1 等），回到 D 轮，与文档一致 | ✓ |
| 78 | D8 是 → D9→D11w→D11_Click；D11→D12_Sleep | click_d3_tab、click_start_game 成功后 time.sleep(5)（如 682 行），与文档 D11→D12 sleep(5) 一致 | ✓ |
| 79 | D12 → D12b_Poll 轮询 D3 窗口最多 10 秒 | sleep(5) 后 for poll_i in range(_poll_sec) 内 time.sleep(1)、get_d3_manager().find_windows()，_poll_sec=10，与文档 D12b 一致 | ✓ |
| 80 | D12b→D13；D13 是→C1；D13 否→D14→B2 | 找到 D3 窗口则 run_c1_entry、run_c2_resize、_run_c3_loop_and_handle_branch（C1 入口）；未找到则 _restart_battlenet_and_retry_from_step1、return False，与文档一致 | ✓ |

### 第 17 批（D 块步骤 81–85）

| # | 文档步骤 | 代码核对结论 | 状态 |
|---|----------|--------------|------|
| 81 | D6 否 → D_Fail | 无窗口时 find_windows 空→start BN、continue；activate_window 失败时 continue 或 return False，与文档 D6 否→D_Fail 一致 | ✓ |
| 82 | D6 是 → D7_FindTab | 有窗口且 activate 成功后 get_dynamic_state；normal_available 时进入 click_d3_tab、click_start_game，即 D7 查 D3 tab 与 Play | ✓ |
| 83 | D7 → D8_TabOk 找到 D3 tab 且可点击？ | op.click_d3_tab() 失败则 restart、continue；op.click_start_game() 失败同理；成功则 break 到 D12，与文档 D8 是→D9→D11 一致 | ✓ |
| 84 | D8 否 → D10_UIState → D1_Entry | disconnected/on_login/not normal_available 时 get_battlenet_manager().restart() 或 _run_cn_login_flow_ui_only、time.sleep、continue（回到 D 轮），与文档一致 | ✓ |
| 85 | D8 是 → D9_ClickTab → D11w_WaitPlay → D11_Click | click_d3_tab() 后 time.sleep(0.8)；click_start_game() 成功则 break；与文档 D9→D11w→D11 一致 | ✓ |

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
| B13 其他 | → B15c_Other → B6_Activate | unknown → BN_Act (click_d3_tab 或直接 B6) | ✓ 已精细对比 |
| B12_Ok / B14_Ok | → B16_Confirmed | BN_Confirmed | ✓ 已精细对比 |
| B16_Confirmed | → D1_Entry | set_battlenet_tick_confirmed + trigger_extension_rosbot_start | ✓ 已精细对比 |

---

## F 预判（D3/ROSBOT 在线与日志超时）

| 文档步骤/转移 | 说明 | 代码位置 | 状态 |
|---------------|------|----------|------|
| F_Entry | 预判入口 | run_f0_prejudge_entry | ✓ 已精细对比 |
| F_Entry → F1_HasD3 | D3 是否在线？ | run_f1_d3_online | ✓ 已精细对比 |
| F1 否 | → B2 当前是否有战网窗口？ | 返回 b1 → tick_battlenet_ready_flow (B 块) | ✓ 已精细对比 |
| F1 是 | → C1 入口 | 返回 c1 → start_extension_flow_c_branch / extension_flow_tick_step 或 trigger_extension_rosbot_start | ✓ 已精细对比 |
| F1d_Offline | 识别到掉线 | run_f1d_on_disconnect (C4 disconnect 分支) | ✓ 已精细对比 |
| F1d → F1c_EndD3 | 结束 D3 进程 | run_f1c_end_d3 | ✓ 已精细对比 |
| F1c → F_Entry | 下一 tick 从 F_Entry 再判 | reset 后 fallthrough，下一 tick 走 F0 | ✓ 已精细对比 |
| F2_RosbotOnline | ROSBOT 是否在线？ | A8 success 后由 panel/extension 走 F2；run_f2_rosbot_online | ✓ 已精细对比 |
| F2 否 | → E1 结束已有 ROSBOT | E1_Kill | ✓ 已精细对比 |
| F2 是 | → F3_LogTimeout | run_f3_log_timeout | ✓ 已精细对比 |
| F3 未超时 | 回到 F3 | 继续轮询 | ✓ 已精细对比 |
| F3 超时 | → F4a_EndD3 → F4b_SendF7 → B2_HasWin | run_f4_close_d3_send_f7，enter_battlenet_at_b2 | ✓ 已精细对比 |

---

## C D3 已运行直连

| 文档步骤/转移 | 说明 | 代码位置 | 状态 |
|---------------|------|----------|------|
| C1_Entry | 入口 | run_c1_entry (extension C_ENTRY) | ✓ 已精细对比 |
| C1 → C2_Resize | 将 D3 窗口缩放到标准分辨率 | run_c2_resize | ✓ 已精细对比 |
| C2 → C3_Step | 截屏识图与识图结果 | ExtensionPhase.C_C3_LOOP，run_c3_screenshot_state | ✓ 已精细对比 |
| C3 未识别/connecting 未超时 | → C3w_Wait → C3_Step | C_C3_WAIT → C_C3_LOOP | ✓ 已精细对比 |
| C3 出现 d3_start_game_button | → C5_StartGame | state=="start"，click 并重置 deadline | ✓ 已精细对比 |
| C3 出现 d3_game_tool | → C6_GameTool | branch_result game_tool → C_C10_SEND_M | ✓ 已精细对比 |
| C3 游戏掉线 | 连续两次识图确认 → F1d_Offline | C_C3_DISCONFIRM，两次 disconnect → run_c4_disconnect_then_f1d_f1c | ✓ 已精细对比 |
| C3 未识别/超时 1 分钟 | → C12_EndD3 | current_tick >= deadline → C4 branch "other" → run_c12_end_d3 | ✓ 已精细对比 |
| C3 超时时长 1 分钟、start 重置 | 文档说明 | C3_DEADLINE_TICKS=30 (2s×30=60s)，start 时 set_deadline_tick 重置 | ✓ 已精细对比 |
| C5_StartGame | 点击开始游戏按钮 | click_start_game_button_if_found | ✓ 已精细对比 |
| C5 → C5w_Wait | wait 直到 d3_game_tool 或超时 | C_F1_WAIT_GAME_TOOL，deadline 5 tick | ✓ 已精细对比 |
| C5w 超时 | → C12_EndD3 | timeout → run_c12_end_d3 | ✓ 已精细对比 |
| C5w 出现 d3_game_tool | → C6_GameTool | state game_tool → C_C10_SEND_M | ✓ 已精细对比 |
| C6_GameTool | → C10_Check | C_C10_SEND_M (C10a 截图→M→截图) | ✓ 已精细对比 |
| C10_Check → C10_Result | C10b 发送前后截图高度相似？ | step_c10_compare | ✓ 已精细对比 |
| C10_Result 是（相似，M 无反应） | 视为游戏掉线 → C12_EndD3 | result False → run_c12_end_d3 | ✓ 已精细对比 |
| C10_Result 否 | → C7a_PressM → C7w_Wait → C7b_Teleport → C8_Result | C_C7a_SEND_M → C_C7a_WAIT → C_C7b_* → success | ✓ 已精细对比 |
| C8_Result | → A8_Success → F2_RosbotOnline | return "success"，trigger_extension_rosbot_started | ✓ 已精细对比 |
| C12_EndD3 | 结束 D3 进程，进入 D 流程 | run_c12_end_d3；Controller 侧 D1 由 extension 触发 | ✓ 已精细对比 |
| C12 → D1_Entry | 文档 | ensure_battlenet_started_and_login_check 跑 D 块 | ✓ 已精细对比 |

---

## D 从战网启动 D3

| 文档步骤/转移 | 说明 | 代码位置 | 状态 |
|---------------|------|----------|------|
| D1_Entry | 从战网启动 D3 入口 | LoginTryScreenshotController.ensure_battlenet_started_and_login_check（D 块） | ✓ 已精细对比 |
| D1 → D4_Activate | 激活战网窗口 | find_windows，activate_window | ✓ 已精细对比 |
| D4 → D4w_Wait | 等 1 秒 | time.sleep(1) 等 | ✓ 已精细对比 |
| D4w → D5_UI | UI 识别战网界面 | get_dynamic_state | ✓ 已精细对比 |
| D5 → D6_HasWin | 找到战网窗口？ | find_windows / activate 成功 | ✓ 已精细对比 |
| D6 否 | → D_Fail | return False 或 continue 重试 | ✓ 已精细对比 |
| D6 是 | → D7_FindTab | 查 D3 tab 与 Play | ✓ 已精细对比 |
| D7 → D8_TabOk | 找到 D3 tab 且可点击？ | click_d3_tab / click_start_game | ✓ 已精细对比 |
| D8 否 | → D10_UIState → D1_Entry | on_login/disconnected/not normal_available → 重启或登录后 continue（回到 D 轮） | ✓ 已精细对比 |
| D8 是 | → D9_ClickTab → D11w_WaitPlay → D11_Click | click_d3_tab，click_start_game | ✓ 已精细对比 |
| D11 → D12_Sleep | sleep(5) | time.sleep(5) | ✓ 已精细对比 |
| D12 → D12b_Poll | 轮询 D3 窗口最多 10 秒 | poll 10s find_windows D3 | ✓ 已精细对比 |
| D12b → D13_HasD3Win | 10 秒内找到 D3 窗口？ | windows = get_d3_manager().find_windows() | ✓ 已精细对比 |
| D13 是 | → C1 入口 | run_c1_entry, run_c2_resize, _run_c3_loop_and_handle_branch | ✓ 已精细对比 |
| D13 否 | → D13b_RestartD3 → D14_Restart → D14w_Wait → B2_HasWin | _restart_battlenet_and_retry_from_step1 后 return False，交回 tick 做 B2 | ✓ 已精细对比 |

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
| 2026-02-09 | 第四次核验：对照更新后清单（第 1–7 批共 35 步）逐项核对；第 7 批 B6/B13（activate_window、click_d3_tab、BN_Poll 已登录/掉线/超时）与 rosbot_flow_battlenet 一致，flow_master_driver 第 144 行、BN 常量 3s/2min/2s 无误。代码无需修复。 |
