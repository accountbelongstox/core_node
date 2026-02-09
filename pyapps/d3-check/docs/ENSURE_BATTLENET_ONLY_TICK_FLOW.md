# Ensure Battle.net only 与 Tick 驱动流程

**本流程遵循 [FLOW_STATE_OWNERSHIP_DESIGN.md](FLOW_STATE_OWNERSHIP_DESIGN.md)**：流程类库定义状态，其他类库无状态开关、返回明确结果，tick 只驱动流程类库。以下为 Ensure Battle.net only 与 tick 驱动的具体约定与实现说明。

## 1. 架构原则（与设计方案一致）

- **流程类库定义并持有状态**：flow_master、bn_only 等流程开关由流程类库唯一持有；UI 通过流程类库读写。
- **其他类库无状态开关**：不持有、不读取流程开关；只提供「执行并返回结果」的接口（True/False 或明确类型）；流程根据返回值更新状态与步骤。
- **Tick 只驱动流程类库**：定时器/任务线程仅调用流程的 tick 入口（process_task）；流程内部根据自身状态决定调用哪些其他类库。

## 2. 流程状态（Flow State）

| 项目 | 说明 |
|------|------|
| **定义位置** | `d3utils/rosbot_flow_state.py` |
| **字段** | `flow_master_enabled`、`bn_only_enabled`（模块级，单源真相） |
| **API** | `get_flow_master_enabled()`、`set_flow_master_enabled(bool)`、`get_bn_only_enabled()`、`set_bn_only_enabled(bool)`、`is_flow_active()`（= flow_master or bn_only） |
| **同步 UI** | 每次 set 时调用 `game_interface_data.set_rosbot_flow_master_enabled` / `set_ensure_battlenet_only_master_enabled`，用于回调与展示；**仅 flow_state 写这两项**。 |

**读写约定**：面板、process_task、check_window、rosbot_flow_battlenet 等**只通过 rosbot_flow_state 的 get/set/is_flow_active** 读写流程开关；不直接读 game_interface_data 的 rosbot_flow_master_enabled / ensure_battlenet_only_master_enabled 做分支判断。

## 3. 入口与驱动链

### 3.1 UI 与任务开关

| 环节 | 位置 | 说明 |
|------|------|------|
| 确保战网 | `rosbot_extension_panel._ensure_battlenet_only()` | 调用 `set_bn_only_enabled(next_enabled)`；根据 `get_flow_master_enabled()` 决定是否 `set_task_status("rosbot_task", DISABLED)` |
| 营动 ROSBOT | `_start_rosbot` / `_stop_rosbot` / 登录检查回调等 | 调用 `set_flow_master_enabled(True/False)`、必要时 `set_bn_only_enabled(False)`；根据 flow state 设置 `rosbot_task` ENABLED/DISABLED |
| 任务线程 | `task_thread_manager` | 每 1s 若 rosbot_task 为 ENABLED 则执行 `process_rosbot_task()` → `process_task()` |

### 3.2 Tick 只驱动流程

```
TaskThreadManager（1s）
  └─ rosbot_task == ENABLED 时执行 process_rosbot_task() → process_task()
       └─ process_task() 内：读 flow_state（get_flow_master_enabled / get_bn_only_enabled）
       └─ if not is_flow_active(): return
       └─ 2s 步：refresh_battlenet_status、notify_state_sync、二次读 flow_state → 分支（bn_only 或 F0/...）
```

**check_window（10s 定时）**：仅当 `not is_flow_active()` 时执行 refresh BN + D3、notify_state_sync；由 `rosbot_flow_state.is_flow_active()` 决定，不读 game_interface_data 的流程开关。此时两开关均为 False，故无需再读 bn_only/flow_master 做 skip_d3 判断，直接执行 BN + D3 刷新即可。

## 4. process_task() 流程（流程类库内）

1. **入口**：`bn_only = get_bn_only_enabled()`，`flow_master = get_flow_master_enabled()`；`if not is_flow_active(): return`。
2. **2s 步**：`_flow_tick_count += 1`；若 `count % 2 != 0` 则 return。
3. **Refresh**：`refresh_battlenet_status()`；若 `flow_master and get_bn_flow_ever_confirmed()` 则 `refresh_d3_status()`、`refresh_rosbot_status()`；`notify_state_sync()`。
4. **二次读 flow state**：`bn_only2 = get_bn_only_enabled()`，`flow_master2 = get_flow_master_enabled()`；若 `not flow_master2 and not bn_only2` 则 **return**（本 tick 不再执行后续）。
5. **分支**（两流程可同拍运行）：  
   - 若 `bn_only2`：调用 `tick_bn_only_flow()`（内部 `tick_battlenet_ready_flow(no_activate=True)`、`reset_confirmed_to_poll()` 等）。  
   - 若 `flow_master2`：调用 `tick_flow_master()`（F0 → b1/c1/b2、extension、F3/F4 等）。  
   - 当两者均为 True 时，同拍先执行 BN-only 再执行 flow-master，不互斥。

其他类库（battlenet_status_provider、d3_status_provider、rosbot_flow_battlenet、run_f0_prejudge_entry、extension_flow_tick_step 等）**不读** flow_master/bn_only 做流程分支；仅由 process_task 根据 flow_state 决定调用谁。需要时由流程传入或由被调用方读 flow_state（如 `tick_battlenet_ready_flow` 内用 `get_bn_only_enabled()` 做 no_activate 下的提前退出）。

## 5. 状态组合与驱动源

| flow_master | bn_only | rosbot_task | 2s flow | 10s check_window |
|-------------|---------|-------------|---------|-------------------|
| F | F | DISABLED | 不执行（或入口 return） | 执行 refresh BN + D3、notify |
| F | T | ENABLED | process_task（仅 BN 分支） | 不执行（is_flow_active()） |
| T | F | ENABLED | process_task（完整流） | 不执行 |
| T | T | ENABLED | process_task（同拍先 BN-only 再 flow-master，两流程同时运行） | 不执行 |

## 6. 其他类库与返回值

以下由流程类库按需调用；**不持有流程开关**；返回 **True/False 或明确类型结果**，流程根据返回值更新状态与步骤（详见 [FLOW_STATE_OWNERSHIP_DESIGN.md](FLOW_STATE_OWNERSHIP_DESIGN.md) §3）。

| 类库/接口 | 返回值 | 流程中的用法 |
|-----------|--------|--------------|
| refresh_battlenet_status / refresh_d3_status / refresh_rosbot_status | 当前为 void；内部写 game_interface_data 展示用字段 | 流程按 flow_state 决定是否调用；若日后改为返回 bool/结构体，流程可根据结果决定后续 |
| tick_battlenet_ready_flow(no_activate) | (done: bool, result: str)，如 "confirmed"/"exit"/"wait" | 流程根据 (done, result) 做 reset_confirmed_to_poll、set_battlenet_tick_confirmed 等 |
| run_f0_prejudge_entry() | "b1" \| "b2" \| "c1" 等 | 流程走 b1/c1/b2 分支 |
| extension_flow_tick_step(...) | "success" \| "fallthrough" 等 | 流程决定 trigger_extension_rosbot_started、是否继续本拍 |
| run_f3_log_timeout / run_f4_close_d3_send_f7 | 步骤或 bool（如 "f4"） | 流程决定是否执行 F4、enter_battlenet_at_b2 |

## 7. 简要流程图

```
[用户] 点击「确保战网」开/关
    → set_bn_only_enabled(True/False)   // 仅写 flow_state，flow_state 同步 game_interface_data
    → 根据 get_flow_master_enabled() 决定 set_task_status("rosbot_task", …)

[每 1s] Task 线程
    → process_rosbot_task() → process_task()
    → get_flow_master_enabled() / get_bn_only_enabled()；if not is_flow_active(): return
    → _flow_tick_count += 1；if count % 2 != 0: return
    → refresh_battlenet_status()；条件性 refresh_d3/rosbot；notify_state_sync()
    → 二次读 get_bn_only_enabled() / get_flow_master_enabled()
    → if not active: return
    → if bn_only2: tick_bn_only_flow()；if flow_master2: tick_flow_master()（可同拍）
    → 否则 F0 → b1/c1/b2、extension、F3/F4

[10s] window_monitor
    → if is_flow_active(): return
    → refresh_battlenet_status()；refresh_d3_status()（skip_d3 由 flow state 派生）；notify_state_sync()
```

## 8. 代码位置速查

| 职责 | 位置 |
|------|------|
| 流程状态定义与读写 | `d3utils/rosbot_flow_state.py` |
| **BN-only 流程类库（每拍步骤与返回值处理）** | `d3utils/rosbot_flow/flow_bn_only.py`（`tick_bn_only_flow()`） |
| Tick 入口、分支、二次读、调用 flow_bn_only | `d3utils/rosbot_task_processor.process_task()` |
| 面板设置/读取 flow、bn_only、任务状态 | `ui/panels/rosbot_extension_panel.py`（仅通过 flow_state API） |
| check_window 是否执行 | `timers/window_monitor_timer.check_window()`（`is_flow_active()`） |
| BN 流内 no_activate 提前退出 | `d3utils/rosbot_flow_battlenet.tick_battlenet_ready_flow()`（读 `get_bn_only_enabled()` 仅用于 abort，不用于分支选择） |
| UI 展示用镜像 | `game_interface_data.rosbot_flow_master_enabled` / `ensure_battlenet_only_master_enabled`（仅由 flow_state 写入） |

若 [FLOW_STATE_OWNERSHIP_DESIGN.md](FLOW_STATE_OWNERSHIP_DESIGN.md) 有更新（如新增返回值约定），本节与 §6 可同步增补。
