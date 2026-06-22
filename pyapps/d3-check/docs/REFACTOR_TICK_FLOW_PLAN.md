# [历史记录] Ensure Battle.net Only / Tick 驱动流程重构方案

> **说明（2026 更新）**：本文件为早期「只在 `rosbot_task_processor.process_task()` 内做二次读」的重构方案，当时结论是「不单独创建 tick 驱动流程类库」。  
> 目前架构已按 `FLOW_STATE_OWNERSHIP_DESIGN.md` 与 `FLOW_ARCHITECTURE_DIRECTORY.md` 演进为**单一流程类库 `d3utils.rosbot_flow`（内部含 BN-only / Flow-master 两个 flow）持有全部流程状态，Tick 入口只调用 flow 的 tick 入口**。  
> 因此，**本文件仅保留作历史参考，不再作为新增代码或重构的设计依据**；与上述两份文档冲突之处一律以 `FLOW_STATE_OWNERSHIP_DESIGN.md` / `FLOW_ARCHITECTURE_DIRECTORY.md` 为准。

依据 `ENSURE_BATTLENET_ONLY_TICK_FLOW.md` 规范，先做逻辑问题梳理与是否引入 tick 流程类库的结论，再给出具体改动项。

---

## 1. 逻辑不合理之处

### 1.1 已按规范实现的部分

- **入口条件**：`process_task()` 入口用 `flow_master` / `bn_only` 判断，不符合则直接 return；2s 步用 `_flow_tick_count % 2`，符合文档 §1.3。
- **二次读状态**：文档 §4 要求的「refresh + notify 之后再次读 D3State」已在 `rosbot_task_processor.py` 实现（约 141–146 行）：`bn_only2` / `flow_master2` 再读，`not flow_master2 and not bn_only2` 则 return，分支用 `bn_only2`。关闭「确保战网」后本 tick 跳过后半段已满足。
- **两路驱动互斥**：`check_window` 在 `flow_master or bn_only` 时直接 return；两者都关时仅由 check_window 做 BN+D3 刷新，与文档 §5.2 一致。
- **面板派生任务开关**：`_ensure_battlenet_only` / `_start_rosbot` / `_stop_rosbot` / `_on_login_check_done` 等对 `rosbot_task` 的 ENABLED/DISABLED 设定与文档 §5.1 派生规则一致。

### 1.2 仍存在的逻辑问题

| 位置 | 问题 | 说明 |
|------|------|------|
| `rosbot_task_processor.py` 约 188 行 | F3/F4 使用入口时的 `flow_master` | 二次读之后的分支应统一使用「再读状态」；此处若用户在本 tick 内关闭 flow_master，主线程已写 `rosbot_flow_master_enabled=False`，任务线程仍用入口时的 `flow_master=True` 执行 F3/F4，违反文档 §5.3「仅当 flow_master 且 ROSBOT extended 为 running/paused」的「当前状态」语义。 |

**结论**：只需将 F3/F4 条件从 `flow_master` 改为 `flow_master2`，使二次读之后的所有分支都基于「再读状态」，与文档一致。

---

## 2. 关于 tick 驱动的流程类库（已被新架构取代）

### 2.1 当时的现状（历史）

- 写本方案时，BN-only / Flow-master 仍全部实现在单文件 `rosbot_task_processor.py` 的 `process_task()` 内，文档也尚未拆成「两流程库 + 单一流程状态持有者」。

### 2.2 现状：已存在单一流程类库 `d3utils.rosbot_flow`

- 现有设计见：
  - [`FLOW_STATE_OWNERSHIP_DESIGN.md`](FLOW_STATE_OWNERSHIP_DESIGN.md)：**流程开关与步骤状态仅由流程类库持有，tick 只驱动流程类库**。
  - [`FLOW_ARCHITECTURE_DIRECTORY.md`](FLOW_ARCHITECTURE_DIRECTORY.md)：定义了**两条 flow（BN-only / Flow-master）都归属于单一流程类库 `d3utils/rosbot_flow`**：
    - BN-only：`d3utils/rosbot_flow/flow_bn_only_state.py` + `flow_bn_only.py`
    - Flow-master：`d3utils/rosbot_flow/flow_master_driver.py` + `extension_flow_state.py`
  - [`FLOW_IMPLEMENTATION_PROGRESS.md`](FLOW_IMPLEMENTATION_PROGRESS.md)：按「两个流程库 + 统一 Tick 入口」记录实现进度。
- Tick 入口 `rosbot_task_processor.process_task()` 的职责已收敛为：**只读 flow_state + 2s gate + 分支到 `tick_bn_only_flow()` / `tick_flow_master()`**，流程状态全部在 `d3utils.rosbot_flow*` 内部维护。

### 2.3 本节的新结论

- 本文件原先的「**不创建独立 tick 驱动流程类库**」结论已被上述三份文档与现有代码结构取代。  
- **当前唯一合法的流程类库**是 `d3utils.rosbot_flow`（目录下的 flow_* 文件）；任何新的流程状态/步骤只能加在该目录内由 flow 层持有。  
- `rosbot_task_processor.process_task()` 以及 controller / timers / UI（包括 `login_try_screenshot_controller`）一律视为**第三方调用方**：  
  - 只能调用 flow 层暴露的 tick/辅助 API（如 `tick_bn_only_flow` / `tick_flow_master` / 各 F 步），  
  - **不得自建流程状态或在流程外直接读写 flow_master / bn_only / BN 步骤状态**。

本节及后续对「是否创建流程类库」的讨论仅供历史参考；如与 `FLOW_STATE_OWNERSHIP_DESIGN.md`、`FLOW_ARCHITECTURE_DIRECTORY.md`、`FLOW_IMPLEMENTATION_PROGRESS.md` 有任何不一致，一律以后者为准。

---

## 3. 具体重构项（方案）

### 3.1 必须修改

| 文件 | 修改 |
|------|------|
| `d3utils/rosbot_task_processor.py` | 约 188 行：`if flow_master and g.rosbot_extended_status in (...)` 改为 `if flow_master2 and g.rosbot_extended_status in (...)`，使 F3/F4 与二次读后的分支一致。 |

### 3.2 建议注释（可选）

- 在 `process_task()` 二次读状态处（约 141 行附近）保留或补一句注释：标明「二次读之后所有分支仅使用 flow_master2 / bn_only2，不再使用入口的 flow_master / bn_only」。
- 模块顶注释中可简要写：F3/F4 使用再读后的 flow_master2（与 ENSURE_BATTLENET_ONLY_TICK_FLOW §5.3/§5.5 一致）。

### 3.3 不改动

- `share/game_interface_data.py`：状态定义与写入方不变。
- `timers/window_monitor_timer.py`：check_window 的互斥逻辑不变。
- `ui/panels/rosbot_extension_panel.py`：任务开关与 D3State 的写入逻辑不变。
- 不新增 tick 流程类或新模块。

---

## 4. 小结

- **逻辑问题**：仅 1 处——F3/F4 使用入口 `flow_master`，应改为再读后的 `flow_master2`。
- **是否建 tick 流程类库**：不建；保持现有 process_task 结构，仅做最小代码修正并靠注释固化「二次读后只用 flow_master2/bn_only2」的约定。
- **实施**：改 1 行 + 可选注释增强即可满足 `ENSURE_BATTLENET_ONLY_TICK_FLOW.md` 规范。
