# Ensure Battle.net Only / Tick 驱动流程重构方案

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

## 2. 是否创建 tick 驱动的流程类库

### 2.1 文档与现状

- 文档 §2 结论：「无需改结构，仅需保持『状态 → 任务开关 → process_task 分支』这条线不变即可」；§4 的改动的仅是「在 process_task 内增加二次状态判断」。
- 当前实现：单文件 `rosbot_task_processor.py` 内一条 `process_task()`，约 80 行，结构清晰；状态来源明确（D3State + TaskThread），分支顺序与文档流程图一致。

### 2.2 不建独立 tick 流程类库的理由

1. **改动范围小**：仅 1 处变量替换（`flow_master` → `flow_master2`）即可满足规范，无需抽象新类型。
2. **文档未要求**：规范没有要求抽成「tick 驱动流程类库」，只要求状态读两次、分支用再读状态。
3. **复用边界清晰**：当前只有一条 2s flow（process_task）；若未来出现第二条 tick 流，再考虑抽取公共「入口读 → 刷新 → 再读 → 分支」模式更合适。
4. **与 d3-check 规则一致**：Reuse before adding；无重复逻辑、无第二处实现同一行为，不必为「可能复用」提前建库。

### 2.3 建议

- **不创建**独立的 tick 驱动流程类库。
- 保持「D3State + TaskThread 两状态类库」与「process_task 内二次读 + 分支」的现有形态；仅做上述 1 处代码修正，并在注释中明确「二次读之后一律用 flow_master2/bn_only2」。

若后续出现多个类似 process_task 的 tick 流（例如 10s 步的独立流程也需「再读后分支」），再考虑在 `d3utils` 下增加小型辅助（例如「在指定步骤后重新取 D3State 并判断是否继续」），而不是现在就上「流程类库」。

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
