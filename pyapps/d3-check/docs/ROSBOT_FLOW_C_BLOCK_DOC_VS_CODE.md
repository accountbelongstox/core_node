# ROSBOT_FLOW_MERMAID C 块：文档与代码逐条对照

**文档来源：** `ROSBOT_FLOW_MERMAID.md` 中 C 子图（C D3 已运行直连）。  
**对照原则：** 仅以文档字面为准，不猜测、不补充文档未写内容。

---

## 1. 文档原文摘录（C 块）

| 节点/边 | 文档原文 |
|--------|----------|
| **C1_Entry** | [C1] 入口 |
| **C2_Resize** | [C2] 将 D3 窗口缩放到标准分辨率 |
| **C3_Step** | [C3] 截屏识图与识图结果 一步内：截屏→识图→**若识别到 start/game_tool/disconnected 之一则分支**；**若识别到 d3_connecting 或 d3_connecting_alt 则继续 wait**；**超时则未识别** |
| **C3_Result** | [C3] 识图结果 |
| C3_Result → C3w_Wait | **未识别或 d3_connecting / d3_connecting_alt 未超时，继续** |
| C3w_Wait → C3_Step | （回到 C3_Step） |
| C3_Result → C5_StartGame | 出现 **d3_start_game_button** 在开始游戏界面 |
| C3_Result → C6_GameTool | 出现 **d3_game_tool** 在游戏中，走 C6 流程 |
| C3_Result → F1d_Offline | **游戏掉线** |
| C3_Result → C12_EndD3 | **未识别/超时 1 分钟，进入 D** |
| **C5_StartGame** | [C5] 点击开始游戏按钮 |
| **C5w_Wait** | [C5w] **wait 直到出现 d3_game_tool 或超时** |
| C5w_Wait → C12_EndD3 | **超时，→C12** |
| C5w_Wait → C6_GameTool | 出现 d3_game_tool 走 C6 流程 |
| **C12_EndD3** | [C12] 结束 D3 进程，进入 D 流程 |

文档中 **C5w** 仅此一句与两条出边，**未写**「C5w 内若识别到 d3_connecting/d3_connecting_alt 则继续 wait」；connecting 的「继续 wait」只出现在 **C3_Step** 与 **C3_Result→C3w**。

---

## 2. 超时：要求多长、从哪计时、是否重置

| 文档原文 | 要求 | 代码实现 |
|----------|------|----------|
| C3_Result → C12：「**未识别/超时 1 分钟**，进入 D」 | **超时时长**：1 分钟（60 秒） | `C3_C3W_TIMEOUT_SEC = 60.0` |
| 同上 | **计时起点**：进入 C3 循环（C2 完成后，第一次 C3_Step 前） | `_run_c3_loop_and_handle_branch` 开头 `c3_deadline = time.time() + C3_C3W_TIMEOUT_SEC`，在 while 前只设一次 |
| 同上 | **是否重置**：**若检测到 d3_start_game_button 则点击并重置 1 分钟**；多次检测到则每次点击并重置（开始游戏可能卡住并重新开始） | 循环内 state=="start" 时调用 `click_start_game_button_if_found()`，若 True 则 `c3_deadline = time.time() + C3_C3W_TIMEOUT_SEC`，不 break，继续 C3w_Wait→C3_Step |
| C3_Result → C3w：「未识别或 d3_connecting…**未超时，继续**」 | 未超时则 C3w_Wait → 再 C3_Step，直到 1 分钟到或出现分支；**出现 start 时点击并重置 1 分钟再继续** | while 内 state 为 wait/None 则 sleep 后下一轮；state 为 start 则点击、重置 deadline、sleep 后下一轮；仅 disconnect/game_tool 时 break |

C5w 超时：文档仅写「wait 直到出现 d3_game_tool **或超时**」，未写具体时长；代码为 5×2 秒。

---

## 3. 逐条对照

### C1 入口

| 文档 | 代码位置 | 是否一致 |
|------|----------|----------|
| C1 入口 | `flow_c_d3_direct.run_c1_entry(has_bn_confirmed, has_d3_process)` | ✅ 入口条件：BN 已确认且存在 D3 进程 |

### C2 将 D3 窗口缩放到标准分辨率

| 文档 | 代码位置 | 是否一致 |
|------|----------|----------|
| C2 将 D3 窗口缩放到标准分辨率 | `flow_c_d3_direct.run_c2_resize()` → `resize_window_by_titles_to_client_size(DIABLO_III_WINDOW_TITLES, STANDARD_*)` + `WindowFinder.invalidate_window_cache` | ✅ |

### C3 截屏识图与识图结果

| 文档 | 代码位置 | 是否一致 |
|------|----------|----------|
| 一步内：截屏→识图 | `detect_d3_already_running_state()` 内一次 `provider.gen()` + 多模板匹配 | ✅ |
| 识别到 start → 分支 | 返回 `"start"`，`run_c4_branch_result` → `"start"`，controller 走 C5 | ✅ |
| 识别到 game_tool → 分支 | 返回 `"game_tool"`，C4 内先 C10 相似度，再返回 `"game_tool"`，controller 走 C6 | ✅ |
| 识别到 disconnected → 分支 | 返回 `"disconnect"`，C4 → F1d+F1c | ✅ |
| 识别到 d3_connecting 或 d3_connecting_alt 则继续 wait | 返回 `"wait"`，controller 循环内 `state not in (disconnect,start,game_tool)` 则 `sleep(C3W_WAIT_SEC)` 再 C3_Step | ✅ |
| 超时则未识别 | C3 循环总时长 `C3_C3W_TIMEOUT_SEC`（60s），超时后再测一次 state，再 C4 分支 | ✅ |

### C3_Result 出边

| 文档 | 代码 | 是否一致 |
|------|------|----------|
| 未识别或 d3_connecting/d3_connecting_alt 未超时，继续 → C3w_Wait | `state` 为 None 或 `"wait"` 且未超时：不 break，`time.sleep(C3W_WAIT_SEC)` 后下一轮 `run_c3_screenshot_state()` | ✅ |
| 未识别/超时 1 分钟，进入 D → C12 | 超时后 `run_c4_branch_result(state)` 得 `"other"` 时 `run_c12_end_d3()`，caller fallthrough 进 D | ✅ |
| 游戏掉线 → F1d_Offline | branch_result == `"disconnect"` → `run_c4_disconnect_then_f1d_f1c()` | ✅ |
| 出现 d3_start_game_button → C5_StartGame | branch_result == `"start"` → `try_fragment1_click_start_game_wait_game_tool()` | ✅ |
| 出现 d3_game_tool → C6_GameTool | branch_result == `"game_tool"` → `try_fragment2_game_tool_press_m_then_clicks()` | ✅ |

### C5 点击开始游戏按钮

| 文档 | 代码 | 是否一致 |
|------|------|----------|
| [C5] 点击开始游戏按钮 | `try_fragment1_*` 内 `_capture_and_match_start_game_button` 匹配到后 `clicker.click(...)` | ✅ |

### C5w wait 直到出现 d3_game_tool 或超时

| 文档 | 代码 | 是否一致 |
|------|------|----------|
| C5w wait 直到出现 d3_game_tool 或超时 | `try_fragment1_*` 内 `deadline = now + max_wait_game_tool_attempts * interval_sec`，循环内 `detect_d3_already_running_state()`，game_tool→True，disconnect→False，其它继续等 | ✅ |
| C5w 超时 → C12 | 超时后 return False，controller 执行 `run_c12_end_d3()` | ✅ |
| C5w 出现 d3_game_tool → C6 | return True 后 controller 执行 `send_m_then_teleport_three_clicks()`（C10+C7a/C7w/C7b） | ✅ |
| 文档未写：C5w 内 connecting 是否继续 wait | 文档无此条；代码按文档仅「出现 game_tool 或超时」二分支，未在 C5w 内对 connecting 做延长 | ✅ 与文档一致 |

### C12 结束 D3 进程，进入 D 流程

| 文档 | 代码 | 是否一致 |
|------|------|----------|
| [C12] 结束 D3 进程，进入 D 流程 | `run_c12_end_d3()` → `get_d3_manager().kill_if_running()`；controller 中 C12 后 fallthrough 到 D（从战网启动 D3） | ✅ |

---

## 4. 一个节点一个逻辑：节点 → 代码位置

| 文档节点 | 文档原文 | 代码位置（唯一对应） |
|----------|----------|----------------------|
| **C1_Entry** | [C1] 入口 | `flow_c_d3_direct.run_c1_entry(has_bn_confirmed, has_d3_process)`；controller 分支 A 与 D13 后均先调用此函数，通过后才执行 C2 |
| **C2_Resize** | [C2] 将 D3 窗口缩放到标准分辨率 | `flow_c_d3_direct.run_c2_resize()`（内调 resize_window_by_titles_to_client_size + invalidate_window_cache） |
| **C3_Step** | [C3] 截屏识图与识图结果（一步内：截屏→识图→分支/wait/超时） | `flow_c_d3_direct.run_c3_screenshot_state()` → `d3_start_game_and_teleport_waiter.detect_d3_already_running_state()` |
| **C3_Result** | [C3] 识图结果 | `flow_c_d3_direct.run_c4_branch_result(state)` 的返回值决定出边；controller 根据 branch_result 走各边 |
| **C3w_Wait** | [C3w] wait | controller `_run_c3_loop_and_handle_branch` 内 `time.sleep(C3W_WAIT_SEC)` |
| **C5_StartGame** | [C5] 点击开始游戏按钮 | `d3_start_game_and_teleport_waiter.try_fragment1_click_start_game_wait_game_tool` 内匹配到 d3_start_game_button 后 `clicker.click(...)` |
| **C5w_Wait** | [C5w] wait 直到出现 d3_game_tool 或超时 | 同上函数内 while 循环 + `detect_d3_already_running_state()`，game_tool→return True，超时→return False |
| **C6_GameTool** | [C6] 继续 d3_game_tool 流程 | `d3_start_game_and_teleport_waiter.try_fragment2_game_tool_press_m_then_clicks()`（内先 C10 已在 run_c4_branch_result 中做过，此处 C7a/C7w/C7b） |
| **C10_Check** | [C10a] 截图→发送 M→截图→对比相似度 | `d3_start_game_and_teleport_waiter.check_d3_online_by_m_similarity()`；C6 路径在 run_c4_branch_result(state==game_tool) 时已调用 |
| **C10_Result** | [C10b] 发送前后截图高度相似？ | 同上函数返回值；相似→视为掉线（return "disconnect"）；否→C7a |
| **C7a_PressM** | [C7a] 再按 M 复位地图 | `d3_start_game_and_teleport_waiter._run_c7a_c7w_c7b` 内第一次 M |
| **C7w_Wait** | [C7w] 等待 2 秒 | 同上函数内 `time.sleep(D3_GAME_TOOL_AFTER_M_DELAY_SEC)` |
| **C7b_Teleport** | [C7b] 传送：(751,413)+(610,126) | 同上函数内 `_do_c7b_teleport(...)` |
| **C8_Result** | [C8] 传送结果（流程步骤，无否分支） | C7b 成功后即 C8 完成，controller 返回 "success" → A8 |
| **C12_EndD3** | [C12] 结束 D3 进程，进入 D 流程 | `flow_c_d3_direct.run_c12_end_d3()`；controller 中 C3_Result 未识别/超时、C5w 超时、C6 失败均调用此函数后 fallthrough 进 D |

**边 C1→C2→C3**：controller 分支 A 为 `if run_c1_entry(...): run_c2_resize(); _run_c3_loop_and_handle_branch()`；D13 后为 `if run_c1_entry(True,True): run_c2_resize(); _run_c3_loop_and_handle_branch()`。

**边 C5w 超时→C12**：controller 在 `r1 is False or r1 is None` 时调用 `run_c12_end_d3()`。

**边 C3_Result 未识别/超时→C12**：controller 在 `branch_result` 非 disconnect/start/game_tool 时调用 `run_c12_end_d3()`。

---

## 5. 小结

- C1、C2、C3、C3_Result 各出边、C5、C5w 两条出边（超时→C12、出现 game_tool→C6）、C12 均与文档一致。
- 文档中「若识别到 d3_connecting 或 d3_connecting_alt 则继续 wait」仅出现在 **C3**，不适用于 C5w；C5w 文档仅规定「wait 直到出现 d3_game_tool 或超时」，未规定 connecting 时延长等待。
- 若需「C5w 内识别到连接中不杀 D3」，需在文档中补充 C5w 的对应条款后再改代码。
- 每个节点均对应唯一实现：C1=run_c1_entry，C2=run_c2_resize，C12=run_c12_end_d3，C3 一步=run_c3_screenshot_state + run_c4_branch_result，C5/C5w=try_fragment1_*，C6/C7a-C8=try_fragment2_* 与 send_m_then_teleport_three_clicks。
