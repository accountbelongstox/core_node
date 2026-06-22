# 流程状态所有权设计方案

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **流程类库定义并持有状态** | 流程开关（flow_master、bn_only）及流程步骤/节点状态由流程类库唯一持有；UI 与外部仅通过流程类库提供的 API 读写。 |
| **其他类库无状态开关** | 被流程调用的类库（provider、BN 流步骤、F0/F3/F4、extension_flow 等）不持有、不读取流程开关；只提供「执行并返回结果」的接口。 |
| **其他类库返回明确结果** | 接口返回 `True`/`False` 或明确类型（如 `"confirmed"`、`"b1"`、`"success"`）；不通过全局状态表达「是否执行成功」。 |
| **流程根据返回值更新状态与步骤** | 流程类库根据被调用方的返回值决定下一步（更新内部步骤、节点、或分支）；状态与步骤的推进仅由流程内部计算。 |
| **Tick 只驱动流程类库** | 定时器/任务线程仅调用流程的 tick 入口（如 `process_task()`）；流程内部根据自身状态决定本拍调用哪些类库、以及调用顺序。 |

## 2. 状态归属

### 2.1 流程类库持有的状态

| 状态 | 含义 | 读写方 | 说明 |
|------|------|--------|------|
| **flow_master_enabled** | 营动 ROSBOT 总开关 | 面板通过 `set_flow_master_enabled()` 写；process_task、check_window、BN 流通过 `get_flow_master_enabled()` 读 | 单源真相，存于 `rosbot_flow_state` |
| **bn_only_enabled** | 仅确保战网（不跑 D3/ROSBOT） | 面板通过 `set_bn_only_enabled()` 写；process_task、check_window、BN 流通过 `get_bn_only_enabled()` 读 | 同上 |
| **步骤/节点状态** | 如 2s 步计数、BN 流当前节点、extension 阶段等 | 仅流程内部读写 | 由 process_task 与子流程（如 BN flow）维护 |

### 2.2 其他类库不持有的状态

- **流程开关**：battlenet_status_provider、d3_status_provider、rosbot_status_provider、rosbot_flow_battlenet（BN 节点逻辑）、run_f0_prejudge_entry、extension_flow_tick_step、run_f3_log_timeout、run_f4_* 等**不读** flow_master/bn_only 做分支判断。
- **例外**：BN 流内为「no_activate 下用户关闭确保战网则提前退出」可读 `get_bn_only_enabled()`，仅用于提前 abort，不用于流程分支选择（分支由 process_task 决定）。

### 2.3 UI 展示用镜像

- `game_interface_data.rosbot_flow_master_enabled` / `ensure_battlenet_only_master_enabled` 仅由**流程类库**在 `set_flow_master_enabled` / `set_bn_only_enabled` 时写入，用于回调和 UI 展示；其他模块不直接写这两项，分支判断不依赖这两项（统一用 flow_state 的 get）。

## 3. 调用与返回值约定

### 3.1 流程类库（调用方）

- **入口**：`process_task()` 每 2s 步执行一次（由 1s tick + count % 2 控制）。
- **逻辑**：读 flow_state → 决定是否执行本拍、是否 refresh D3/ROSBOT → 调用各子模块 → **根据返回值**更新步骤或分支（如 `(done, result) = tick_battlenet_ready_flow(...)` 后若 `done and result == "confirmed"` 则 `reset_confirmed_to_poll()`）。

### 3.2 被调用类库（返回明确结果）

| 类库/接口 | 返回形式 | 流程中的用法 |
|-----------|----------|--------------|
| refresh_battlenet_status / refresh_d3_status / refresh_rosbot_status | 当前为 void，内部写 game_interface_data 展示用字段 | 流程按 flow_state 决定是否调用；若日后改为返回 bool/结构体，流程可根据返回值决定是否重试或跳过后续 |
| tick_battlenet_ready_flow(no_activate) | `(done: bool, result: str)`，如 `("confirmed", "exit", "wait")` | 流程根据 (done, result) 执行 reset_confirmed_to_poll、set_battlenet_tick_confirmed 等 |
| run_f0_prejudge_entry() | `"b1"` \| `"b2"` \| `"c1"` 等 | 流程走 b1/c1/b2 分支并调用对应下一步 |
| extension_flow_tick_step(...) | `"success"` \| `"fallthrough"` \| 其他 | 流程决定是否 trigger_extension_rosbot_started、是否继续本拍 |
| run_f3_log_timeout() | 如 `"f4"` 或 bool | 流程决定是否执行 run_f4_close_d3_send_f7、enter_battlenet_at_b2 |
| run_f4_close_d3_send_f7 | 当前为 void | 流程按 F3 返回值调用，无需再返回值 |

**约定**：被调用方不通过修改「流程开关」或「流程步骤」来表达结果；仅通过返回值。流程类库是唯一根据返回值更新状态与步骤的一方。

## 4. Tick 驱动链

```
TaskThreadManager（1s）
  └─ rosbot_task == ENABLED 时执行 process_rosbot_task() → process_task()
       └─ process_task()：读 flow_state → 若 not is_flow_active(): return
       └─ 2s 步：refresh → notify → 再读 flow_state → 按 bn_only2 / flow_master2 分支
       └─ 调用 tick_battlenet_ready_flow / run_f0_prejudge_entry / extension_flow_tick_step / F3/F4 等
       └─ 根据各返回值更新步骤或 return

window_monitor（10s）
  └─ if is_flow_active(): return   // 仅读流程类库，不读 game_interface_data 的流程开关
  └─ refresh_battlenet_status()；refresh_d3_status()；notify_state_sync()
```

- **唯一驱动流程执行的入口**：`process_task()`（由任务线程在 rosbot_task ENABLED 时调用）。
- **任务开关 rosbot_task**：由面板根据 flow_state 的 `is_flow_active()` 派生（flow_master 或 bn_only 至少一个为 True 则 ENABLED），不由流程内部写入。

## 5. 与 ENSURE_BATTLENET_ONLY_TICK_FLOW 的关系

- **ENSURE_BATTLENET_ONLY_TICK_FLOW.md** 描述的是在本设计方案下「Ensure Battle.net only」与 tick 驱动的具体行为（入口、二次读、bn_only 分支、check_window 互斥等）。
- 该文档已按「流程类库定义状态、其他类库无状态开关、tick 只驱动流程」组织；若本设计方案有增补（如更多返回值约定），ENSURE 文档可相应补充「其他类库与返回值」一节，无需改动架构原则。

## 6. 代码位置速查

| 职责 | 位置 |
|------|------|
| 流程状态定义与 API | `d3utils/rosbot_flow_state.py` |
| **BN-only 流程类库（bn_only_enabled）** | `d3utils/rosbot_flow/flow_bn_only.py`（`tick_bn_only_flow()`） |
| Tick 入口与分支、根据返回值更新步骤 | `d3utils/rosbot_task_processor.process_task()` |
| 面板设置 flow / bn_only / 任务状态 | `ui/panels/rosbot_extension_panel.py`（仅通过 flow_state 的 get/set） |
| check_window 是否执行 | `timers/window_monitor_timer.check_window()`（`is_flow_active()`） |
| 被调用方（无流程开关，返回结果） | battlenet_status_provider、d3_status_provider、rosbot_flow_battlenet、rosbot_flow_f0_entry、extension_flow_tick_step、run_f3_log_timeout 等 |
