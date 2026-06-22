# 两流程库实现进度

遵循 [FLOW_STATE_OWNERSHIP_DESIGN.md](FLOW_STATE_OWNERSHIP_DESIGN.md)：流程定义状态，其他类库无状态开关、返回明确结果，tick 只驱动流程。本文档先写出要实现的**两个流程及状态**，再列实现进度。

---

## 1. 总览：两个流程与统一入口

| 流程 | 开关 | 含义 | 每拍主要动作 |
|------|------|------|--------------|
| **BN-only 流程（确保战网）** | `bn_only_enabled` | 仅跑战网就绪流，不激活窗口、不跑 D3/ROSBOT | refresh_battlenet → notify → tick_battlenet_ready_flow(no_activate=True)（已与代码核对，见 §3 与 [ENSURE_BATTLENET_ONLY_TICK_FLOW.md](ENSURE_BATTLENET_ONLY_TICK_FLOW.md)） |
| **Flow-master 流程（营动 ROSBOT）** | `flow_master_enabled` | 完整流：BN→D3→ROSBOT，含 F0/b1/c1/b2、extension、F3/F4 | refresh BN + 条件性 D3/ROSBOT → notify → extension 或 F0 → b1/c1/b2 → F3/F4 |

- **统一入口**：`process_task()`（由 TaskThread 每 1s 调用，2s 步由 `_flow_tick_count % 2 == 0` 控制）。
- **分支**：入口与 refresh 后二次读 `get_bn_only_enabled()` / `get_flow_master_enabled()`；若 `bn_only2` 跑 `tick_bn_only_flow()`，若 `flow_master2` 跑 `tick_flow_master()`；**两开关可同时为 True，同拍先 BN-only 再 flow-master**。
- **任务开关**：`rosbot_task` 由面板根据 `is_flow_active()`（= flow_master or bn_only）设为 ENABLED/DISABLED。

---

## 2. 共享状态（流程类库持有）

| 状态 | 定义位置 | 说明 |
|------|----------|------|
| **flow_master_enabled** | `rosbot_flow_state` | 营动 ROSBOT 总开关；面板 set，process_task/check_window 只读 |
| **bn_only_enabled** | `rosbot_flow_state` | 仅确保战网；面板 set，process_task/check_window 只读 |
| **_flow_tick_count** | `rosbot_task_processor` | 2s 步计数，每 2s 步 +1；extension_flow 用做 deadline_tick |
| **_flow_last_run_time** | `rosbot_task_processor` | 上一拍 2s 步时间，用于日志 |

**API**：`get_flow_master_enabled()`、`set_flow_master_enabled(bool)`、`get_bn_only_enabled()`、`set_bn_only_enabled(bool)`、`is_flow_active()`。  
**UI 镜像**：`game_interface_data.rosbot_flow_master_enabled` / `ensure_battlenet_only_master_enabled` 仅由 flow_state 的 set 写入。

---

## 3. 流程一：BN-only（确保战网）

### 3.1 流程状态

| 状态 | 说明 |
|------|------|
| **BN 流节点** | 定义于 `rosbot_flow_battlenet.BNNode`；单源真相为模块级 `_current_node` |
| **节点枚举** | BN_Entry → BN_Win → BN_Start | BN_First → BN_Act → BN_Poll → BN_Confirmed；或 BN_Exit → BN_ExitWait → BN_Entry；中间可有 BN_Login1/2、BN_LoginAsia、BN_UI、BN_Wait、BN_WaitResult 等 |
| **内部变量** | `_b5_entry_reason`、`_wait_until`、`_b7_poll_deadline`、`_b13_poll_deadline`、`_oauth_wait_until`、`_bn_flow_ever_confirmed`、`_b7_skip_count`、`_b7_last_trigger_time` 等（仅 BN 流内部使用） |

### 3.2 每拍步骤（process_task 内 bn_only2 分支）

由 **BN-only 流程类库** `d3utils/rosbot_flow/flow_bn_only.py` 的 `tick_bn_only_flow()` 执行；process_task 在 bn_only2 时仅调用 `tick_bn_only_flow()` 后 return。

1. 已做（process_task 公共段）：`refresh_battlenet_status()`；`notify_state_sync()`。
2. 调用：`tick_battlenet_ready_flow(no_activate=True)`（在 flow_bn_only 内）。
3. 返回值：`(done: bool, result: str)`，如 `(True, "confirmed")`、`(True, "exit")`、`(False, "wait")`。
4. 流程根据返回值更新：若 `done and result == "confirmed"` 则 `reset_confirmed_to_poll()`（在 flow_bn_only 内），下一拍从 BN_Poll 继续检测。

### 3.3 调用的类库（无流程开关，仅返回结果）

| 类库/接口 | 返回值 | 流程侧处理 |
|-----------|--------|------------|
| refresh_battlenet_status | void（当前） | 仅按顺序调用 |
| tick_battlenet_ready_flow(no_activate=True) | (done, result) | result=="confirmed" → reset_confirmed_to_poll() |

BN 流内部可读 `get_bn_only_enabled()` 仅用于 no_activate 下的**提前退出**（用户本拍关闭「确保战网」则 abort），不用于分支选择。

### 3.4 专用说明（bn_only_enabled）

**针对 `bn_only_enabled` 的完整约定、驱动链与代码位置**见 **[ENSURE_BATTLENET_ONLY_TICK_FLOW.md](ENSURE_BATTLENET_ONLY_TICK_FLOW.md)**。该文档为「确保战网」专用，与 [FLOW_STATE_OWNERSHIP_DESIGN.md](FLOW_STATE_OWNERSHIP_DESIGN.md) 一致，包含：

- 流程状态与 API（`rosbot_flow_state`）
- 入口与驱动链（process_task 二次读、bn_only2 分支；check_window 用 `is_flow_active()` 决定是否执行）
- process_task 内 bn_only 分支的 5 步与返回值处理
- 状态组合表（flow_master / bn_only 与 2s flow、10s check_window 的对应）
- 其他类库与返回值约定
- 代码位置速查

**代码核对结论**：`rosbot_task_processor.process_task()` 在 `bn_only2` 为 True 时仅执行 `refresh_battlenet_status()`（与 flow_master 共用前半段）、`notify_state_sync()`，然后 `tick_battlenet_ready_flow(no_activate=True)`；不执行 `refresh_d3_status()`、`refresh_rosbot_status()` 及 F0/extension/F3/F4。`check_window()` 通过 `is_flow_active()`（`rosbot_flow_state`）判断，为 True 时直接 return，不刷新。

---

## 4. 流程二：Flow-master（营动 ROSBOT）

### 4.1 流程状态

| 状态 | 定义位置 | 说明 |
|------|----------|------|
| **BN 流节点** | `rosbot_flow_battlenet` | 与 BN-only 共用同一 `_current_node`；no_activate=False，会激活窗口、点击等 |
| **extension_flow 阶段** | `rosbot_flow.extension_flow_state` | `_phase`（idle / 各 C 阶段）、`_wait_ticks_remaining`、`_deadline_tick`、`_payload` 等 |
| **F0 动作** | 由本拍 `run_f0_prejudge_entry()` 返回 | 不持久化，当拍用 "b1" / "b2" / "c1" 决定分支 |

### 4.2 每拍步骤（process_task 内 flow_master2 分支，非 bn_only2）

1. 已做：`refresh_battlenet_status()`；若 `flow_master and get_bn_flow_ever_confirmed()` 则 `refresh_d3_status()`、`refresh_rosbot_status()`；`notify_state_sync()`。
2. 若 extension 非 idle：`extension_flow_tick_step(tick_count, start_rosbot_task)` → 根据返回值 "success" / "fallthrough" 做 trigger_extension_rosbot_started、return。
3. 否则：`run_f0_prejudge_entry()` → 得到 action in {"b1","b2","c1"}。
4. 根据 action：
   - **b1**：`tick_battlenet_ready_flow(no_activate=False)`；若 `done and result=="confirmed"` 则 `set_battlenet_tick_confirmed()`、`trigger_extension_rosbot_start()`。
   - **b2**：`enter_battlenet_at_b2()`。
   - **c1**：若 extension idle 且 ever_confirmed 且 D3 running：`start_extension_flow_c_branch()`，`extension_flow_tick_step(...)`，按 "success"/"fallthrough" 处理；否则 `trigger_extension_rosbot_start()`。
5. 若 `flow_master2 and rosbot_extended_status in ("running","paused")`：`run_f3_log_timeout()`；若返回 `"f4"` 则 `run_f4_close_d3_send_f7()`、`enter_battlenet_at_b2()`。

### 4.3 调用的类库（无流程开关，仅返回结果）

| 类库/接口 | 返回值 | 流程侧处理 |
|-----------|--------|------------|
| refresh_d3_status / refresh_rosbot_status | void（当前） | 按 flow_master 与 ever_confirmed 条件调用 |
| extension_flow_tick_step(tick_count, start_rosbot_task) | "success" \| "fallthrough" \| 其他 | success → trigger_extension_rosbot_started(True)；fallthrough → trigger_extension_rosbot_started(False)；return |
| run_f0_prejudge_entry() | "b1" \| "b2" \| "c1" | 走 b1/b2/c1 分支 |
| tick_battlenet_ready_flow(no_activate=False) | (done, result) | done and result=="confirmed" → set_battlenet_tick_confirmed()、trigger_extension_rosbot_start() |
| enter_battlenet_at_b2() | void | 仅调用 |
| run_f3_log_timeout() | "f4" 或 其他 | "f4" → run_f4_close_d3_send_f7()、enter_battlenet_at_b2() |
| run_f4_close_d3_send_f7() | void | 仅调用 |

---

## 5. 实现进度

### 5.1 已实现

| 项 | 位置 | 说明 |
|----|------|------|
| 流程状态 API | `rosbot_flow_state.py` | get/set flow_master_enabled、bn_only_enabled；is_flow_active；同步 game_interface_data |
| 统一入口与 2s 步 | `rosbot_task_processor.process_task()` | 入口读 flow_state；_flow_tick_count % 2；二次读 flow_state |
| BN-only 分支 | `rosbot_task_processor` | bn_only2 时 refresh_battlenet、notify、tick_battlenet_ready_flow(no_activate=True)、reset_confirmed_to_poll |
| Flow-master 分支 | `rosbot_task_processor` | extension_flow_tick_step、run_f0_prejudge_entry、b1/c1/b2、F3/F4；根据返回值更新步骤 |
| BN 流状态与节点 | `rosbot_flow_battlenet` | BNNode、_current_node、tick_battlenet_ready_flow 返回 (done, result)；no_activate 下读 get_bn_only_enabled() 提前退出 |
| extension 流状态 | `rosbot_flow.extension_flow_state` | _phase、_deadline_tick 等；extension_flow_tick_step 返回 success/fallthrough |
| 面板仅通过 flow_state 读写 | `rosbot_extension_panel` | set_bn_only_enabled、set_flow_master_enabled；get_* 决定任务开关与按钮 |
| check_window 仅读 is_flow_active | `window_monitor_timer` | is_flow_active() 为 True 则 return；否则 refresh BN + D3、notify |

### 5.2 待实现 / 待统一（可选）

| 项 | 说明 |
|----|------|
| provider 返回值 | refresh_battlenet_status / refresh_d3_status / refresh_rosbot_status 当前为 void；若需流程根据「是否找到窗口」等做分支，可改为返回 bool 或结构体，流程根据返回值更新或重试。 |
| 两流程状态显式分文件（**已由 `d3utils.rosbot_flow` 实现**） | 早期版本中 BN 流主要在 rosbot_flow_battlenet、Flow-master 逻辑主要在 process_task；现已按 [FLOW_ARCHITECTURE_DIRECTORY.md](FLOW_ARCHITECTURE_DIRECTORY.md) 拆出单一流程类库 `d3utils/rosbot_flow/`（含 BN-only 与 Flow-master 两个 flow 及其状态），Tick 入口仅调用 `tick_bn_only_flow()` / `tick_flow_master()`。今后如需新增流程状态/步骤，一律加在 `d3utils.rosbot_flow` 内，由该流程类库持有；不得在 controller/timers/UI 中自建流程状态。 |
| 任务开关与 flow_state 严格同步 | 确保所有设置 rosbot_task 的地方（面板启动/停止、登录检查回调、扩展线程清理等）均仅根据 get_flow_master_enabled() / get_bn_only_enabled() 派生，不直接读 game_interface_data 的流程布尔。 |

### 5.3 状态与流程小结表

| 流程 | 持有状态 | 每拍调用 | 返回值驱动 |
|------|----------|----------|------------|
| BN-only | flow_state.bn_only；BN _current_node 及内部变量 | refresh_battlenet、notify、tick_battlenet_ready_flow(no_activate=True) | (done, result) → reset_confirmed_to_poll 等 |
| Flow-master | flow_state.flow_master；BN 节点；extension _phase 等 | refresh BN/D3/ROSBOT、notify、extension_flow_tick_step、F0、b1/c1/b2、F3/F4 | extension 返回 success/fallthrough；F0 返回 b1/b2/c1；BN 返回 (done, result)；F3 返回 "f4" |

---

以上为要实现的**两个流程及状态**与当前进度；实现两流程库时按此文档与 [FLOW_STATE_OWNERSHIP_DESIGN.md](FLOW_STATE_OWNERSHIP_DESIGN.md)、[ENSURE_BATTLENET_ONLY_TICK_FLOW.md](ENSURE_BATTLENET_ONLY_TICK_FLOW.md) 对照即可。
