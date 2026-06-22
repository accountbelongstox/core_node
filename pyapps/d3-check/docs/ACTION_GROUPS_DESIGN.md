# Action Groups Design

动作组：将一段连续操作抽象为「多步序列」，每 tick 只执行一步，运行期间忽略其他 TICK 驱动逻辑。

## 1. 目的

- **可扩展**：地图传送等流程抽象为动作组，便于新增/组合动作。
- **每 tick 一步**：动作组内每拍只跑当前步，然后跳过本 tick 其余逻辑，保证点击等操作连贯、不被刷新打断。
- **专用目录**：`d3utils/rosbot_flow/action_groups/`，一个文件可定义一到多个动作组。

## 2. 目录与结构

```
pyapps/d3-check/d3utils/rosbot_flow/
├── action_groups/
│   ├── __init__.py      # 注册表、ActionGroupDef、run_step 约定
│   ├── map_teleport.py  # 地图传送动作组（minimize -> wait 1 tick -> teleport）
│   └── (其它 .py)        # 每个文件可定义 1 个或多个动作组并 register()
├── extension_flow_state.py   # 阶段 C_ACTION_GROUP，is_in_action_group()
├── extension_flow_tick_step.py  # 若 phase==C_ACTION_GROUP 只跑一步动作组
└── flow_master_driver.py     # 若 is_in_action_group() 则跳过 refresh，只跑 extension_flow_tick_step
```

## 3. 动作组定义

- **ActionGroupDef**：`id: str`，`steps: List[ActionStep]`。
- **ActionStep**：`(context: Dict) -> "ok" | "done" | "fail"`  
  - `"ok"`：本步完成，下一 tick 执行下一步。  
  - `"done"`：本步为最后一步且成功，动作组结束，由 extension 做成功收尾（如 map_teleport 的 C8）。  
  - `"fail"`：本步失败，动作组终止，extension 做 fallthrough。

Context 由 extension 在启动动作组时注入（如 `titles`）；步骤内可自行调用 `get_screenshot_provider()` 等。

## 4. Tick 行为（与其它事件的关系）

- **flow_master_driver**：若 `is_in_action_group()` 为 True，则**不执行** REFRESH_FOR_ROUTING（不刷新 D3/ROSBOT 状态），只调用 `extension_flow_tick_step()`。
- **extension_flow_tick_step**：若 `phase == C_ACTION_GROUP`，则**仅**执行当前动作组的当前步（根据 payload 中的 `action_group_id`、`action_group_step_index`、`action_group_context`），根据返回值推进 index 或结束/失败，然后 return，**不执行**本 tick 的 wait 阶段、C3/C7a 等其它阶段逻辑。

即：**动作组运行期间，TICK 驱动的其它事件被忽略，每 tick 只优先执行动作组的一步，然后跳过。**

## 5. 状态与阶段

- **Extension 阶段**：新增 `C_ACTION_GROUP`。进入动作组时 `set_phase(C_ACTION_GROUP)`，并在 payload 中设置：
  - `action_group_id`
  - `action_group_step_index`（从 0 开始，每步成功后 +1）
  - `action_group_context`（传给各 step 的 dict）
- **reset_state()** 会清空 payload，从而清空动作组相关状态。

## 6. 地图传送动作组（map_teleport）

- **id**：`"map_teleport"`  
- **步骤**：  
  1. minimize：点击缩小地图。  
  2. wait one tick：空步，占一拍。  
  3. teleport：两次传送点击（大/小图 + 营地小图）。  
- 对应原 C7b 流程（minimize -> C_C7b_WAIT 1 tick -> C_C7b_TELEPORT），现由动作组统一执行；成功时 extension 层仍负责 set_d3_status、kill/start ROSBOT、set_last_teleport_success_time、reset_state、return "success"。

## 7. 扩展新动作组

1. 在 `action_groups/` 下新增或选用现有 `.py` 文件。  
2. 定义若干 `(ctx) -> "ok"|"done"|"fail"` 函数作为 steps。  
3. 构造 `ActionGroupDef(id="...", steps=[...])` 并 `register(group)`。  
4. 在 `__init__.py` 中 `from ... import ...` 该模块以便加载时完成 register。  
5. 在 extension 流程中在合适阶段 `set_phase(C_ACTION_GROUP)` 并设置上述 payload，即可在后续 tick 中按步执行。

与 FLOW 架构的关系：见 `FLOW_ARCHITECTURE_DIRECTORY.md`；动作组状态与阶段由 `extension_flow_state` 持有，flow_master 仅根据 `is_in_action_group()` 决定是否跳过 refresh。
