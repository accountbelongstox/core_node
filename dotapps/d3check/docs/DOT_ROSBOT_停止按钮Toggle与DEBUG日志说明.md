# DOT ROSBOT 停止/按钮 Toggle 与 DEBUG 日志说明

**目的**：说明「停止 ROSBOT」按钮无 toggle（开始后无法停止）的原因与修复、公共类库与 D3 子类库引用关系、Python 查找逻辑对照，以及**每个细节须打 DEBUG 日志**的约定。

---

## 1. 按钮无 Toggle 的原因与修复

### 1.1 现象

- 点击「启动 ROSBOT」后，按钮应变为「停止」并可再次点击以停止。
- 实际：开始后按钮被禁用，无法点击「停止」。

### 1.2 根因（DOT 与 Python 差异）

| 行为 | Python | DOT（修复前） |
|------|--------|----------------|
| 点击 Start 后按钮是否禁用 | **不禁用**。`_start_rosbot()` 只做：`set_flow_master_enabled(True)`、`get_task_manager().set_task_status("rosbot_task", TaskStatus.ENABLED)`、`self.rosbot_running = True`、`_update_control_button()`。按钮立即变为「Stop」且**保持可点击**。 | **禁用**。`BtnStartRosbot_Click` 在 START 分支里执行 `BtnStartRosbot.IsEnabled = false`，直到 `DoRunRosbotAfterWakeAsync` 的 `finally` 才 `IsEnabled = true`。流程 B/D/E 可能很长，期间用户无法点停止。 |
| 何时禁用按钮 | 仅在**发送 Stop 到扩展线程**时：`_stop_rosbot()` 内 `_control_btn_set_busy(True)` 再 `trigger_extension_rosbot_stop()`；停止完成后 `_on_rosbot_stop_done` 里 `_control_btn_set_busy(False)`。 | 无等价「仅 Stop 时短暂禁用」；Start 时误用了长时间禁用。 |

**结论**：DOT 在「启动」时错误地禁用了按钮，导致 1:1 的 toggle 行为丢失。

### 1.3 修复（1:1 Python）

- **位置**：`dotapps/d3check/Panels/RosbotPanel.xaml.cs`
- **修改**：
  1. START 路径：**不再**执行 `BtnStartRosbot.IsEnabled = false`；设置 `game.SetRosbotFlowMasterEnabled(true)` 后调用 `UpdateRosbotControlFromState()`，并显式 `BtnStartRosbot.IsEnabled = true`（与 Python 一致：按钮始终可点）。
  2. `DoRunRosbotAfterWakeAsync`：去掉 `finally` 中的 `BtnStartRosbot.IsEnabled = true`（因启动时已不再禁用）；保留 `NotifyCallbacks()` 与 `UpdateRosbotControlFromState()` 以便状态与文案一致。

修复后：点击 Start → 按钮立刻变为 Stop（黄底）、保持可点；点击 Stop → `RosbotFlowController.StopRosbot()`、`SetRosbotFlowMasterEnabled(false)`、`UpdateRosbotControlFromState()`，按钮恢复 Start（绿底）。

### 1.4 Python 代码参考（查找逻辑）

| 步骤 | Python 文件与位置 |
|------|-------------------|
| 点击控件 → toggle | `ui/panels/rosbot_extension_panel.py`：`_toggle_rosbot()`（约 707–713 行）：`if self.rosbot_running: self._stop_rosbot() else: self._start_rosbot()` |
| Start：不禁用按钮 | 同上：`_start_rosbot()`（约 736–743 行）：仅设状态 + `_update_control_button()`，无 `control_btn.config(state=tk.DISABLED)` |
| Stop：发命令时短暂禁用 | 同上：`_stop_rosbot()`（约 846–859 行）：`_control_btn_set_busy(True)` 后 `trigger_extension_rosbot_stop()`；`_on_rosbot_stop_done` 中 `_control_btn_set_busy(False)` |
| 按钮文案/颜色来自状态 | 同上：`_update_control_button()`（约 864–878 行）：`self.rosbot_running = self.game_state.rosbot_flow_master_enabled`，再按状态设 text/bg |

---

## 2. 公共类库（DotCore）与 D3 子类库（DotApps.d3check）引用关系

### 2.1 结构约定

- **dotcore/**：公共类库（多应用复用），对应 Python 的 pycore + 部分 providor/share。
  - 例如：`DotCore.Foundations`（ColorPrinter、Guard、IMainThreadDispatcher）、`DotCore.Utils`（Security/PasswordCipher、ConfigChangeNotifier）、`DotCore.Infrastructure`（JsonKeyPathConfig、IFileReadWriter）、`DotCore.UIInspect`（FlaUI 封装）、`DotCore.TemplateMatcher` 等。
- **dotapps/d3check/**：D3Check 应用与** D3 子类库**。
  - **D3CheckCore/**：D3 专用核心（GameInterfaceData、BattlenetManager、RosbotDetection、BattlenetStuckDetector、RosbotVersionInfo 等），**引用 dotcore**，不反向依赖其他 app。
  - **Ctl/**、**Panels/**、**Config/**、**Windows/** 等：UI 与流程控制，引用 D3CheckCore + dotcore。

### 2.2 引用方向（1:1 对照 Python 查找逻辑）

- **Python**：`rosbot_extension_panel` 用 `d3utils.rosbot_flow_state`（set_flow_master_enabled）、`runtime`/event_center（trigger_extension_rosbot_start/stop）、`share.game_interface_data`（rosbot_flow_master_enabled）、`timers`/`d3utils.battlenet_manager` 等；UI 不直接持有一份 flow 状态，只读 game_state 与调用 trigger。
- **DOT**：
  - **Panels/RosbotPanel.xaml.cs** 引用 **D3CheckCore**（GameInterfaceData、BattlenetManager、BattlenetOperationFactory 等）与 **Ctl**（RosbotFlowController）、**Config**（D3CheckConfigService、AsiaCredentialsService）、**DotCore.Foundations**（ColorPrinter）。
  - **Ctl/RosbotFlowController.cs** 引用 D3CheckCore、Config、DotCore.Foundations；不引用 Panels。
  - **D3CheckCore/GameInterfaceData.cs** 引用 DotCore.Foundations（ColorPrinter 用于 DEBUG）；不引用 Ctl 或 Panels。

即：**公共类库（dotcore）→ 被 D3 子类库（D3CheckCore）引用 → 再被 Ctl/Panels 引用**；状态单源在 GameInterfaceData，启停逻辑在 RosbotFlowController，与 Python 的 game_interface_data + flow_state + trigger 对应。

### 2.3 为何「大量功能未完成」

- **Python 端**：ROSBOT 流程为 tick 驱动（1s 定时器、2s 步长）、扩展线程（D3ExtensionThread）收 CMD_START_ROSBOT/CMD_STOP_ROSBOT、B/D/C/E/F 块由 `rosbot_flow_battlenet`、`flow_c_d3_direct`、`flow_e_rosbot_run`、`flow_master_driver` 等分步执行；F3 日志超时、F4 关 D3 发 F7、凭证弹窗调度、油猴/国服 B10/B11 等均在该架构下实现。
- **DOT 端**：当前为**单次 RunAsync()** 驱动 B→D→E，无 1s/2s tick、无独立扩展线程命令队列、无 F3/F4 循环、无 flow_master_driver 的 F3-only 门控；E 块（RosbotRunFlow.RunEBlockAsync）有实现，但整体流程与 [DOT_REF_ROSBOT_流程.md](../../pyapps/d3-check/docs/DOT_REF_ROSBOT_流程.md) 的「A2 定时器 + F0/F1/F2/F3/F4 + extension 线程」尚未 1:1 对齐，因此表现为「大量功能未完成」。
- **补齐方向**：按 DOT_REF_ROSBOT_流程 引入公共层（如 IEventHub/trigger_extension_rosbot_start|stopped、可选扩展线程或等价调度）、2s tick 或等价步进、F3/F4 与 flow-master 单 tick 顺序；D3 子类库仅调用公共层并保持状态在 GameInterfaceData。

---

## 3. DEBUG 日志约定（每个细节都要打）

### 3.1 原则

- **每个关键分支、状态变更、对外调用**都应打一条 **DEBUG** 级日志，便于排查 toggle、启停、流程步骤是否按预期执行。
- 格式建议：`[DEBUG][模块名] 简短描述 key=value ...`。使用 `ColorPrinter.Gray(...)`（或项目统一 DEBUG 输出）避免刷屏为高级别错误。

### 3.2 已添加的 DEBUG 位置（示例）

| 位置 | 内容 |
|------|------|
| `RosbotPanel.xaml.cs` | `BtnStartRosbot_Click`：当前 snapshot 与路径（START/STOP）；`EnsureBattlenetRegionBeforeStart` 为 null 时；设置 `RosbotFlowMasterEnabled=true` 时；`DoRunRosbotAfterWakeAsync` 进入/返回/异常；`UpdateRosbotControlFromState` 的 `RosbotFlowMasterEnabled`/`EnsureBattlenetOnlyEnabled`；`BtnEnsureBattlenet_Click`、`BtnUpdateRosbot`、`BtnSetAccountPassword`、`BtnOpenTampermonkey` 点击与结果。 |
| `RosbotFlowController.cs` | `RunAsync()`：入口、`EnsureRegion()` 结果、F1 D3 online、进入 B 块、B16 结果、进入 D 块、进入 E 块、返回值；`StopRosbot()`：入口、killed 数量、异常。 |
| `GameInterfaceData.cs` | `SetRosbotFlowMasterEnabled(enabled)`、`SetRosbotStatus(running)` 在**值变化时**打 DEBUG。 |

### 3.3 建议继续覆盖的 DEBUG

- **Ctl/RosbotRunFlow.cs**：E 块每步（E1–E6）入口/出口、进程启动/查找 exe/失败原因。
- **Battlenet 相关**：B 块 B2/B4/B7/B9/B10a/B11、D 块 D4–D13 每步入口与关键判断结果。
- **Config/AsiaCredentialsService**：GetCredentials/SaveCredentials/LoadCredentialsForUi 的 region、key、是否有值、加解密是否成功。
- **状态回调**：`GameInterfaceData.NotifyCallbacks` 若需排查 UI 不刷新，可临时加 DEBUG（调用次数多，建议用条件或日志级别控制）。

新增或修改流程时，**每个分支、每步前后、每个状态写**都应加至少一条 DEBUG，便于与 Python 行为对照。

---

## 4. 相关文档与代码地址

| 文档/模块 | 说明 |
|-----------|------|
| [DOT_REF_ROSBOT_流程.md](../../pyapps/d3-check/docs/DOT_REF_ROSBOT_流程.md) | ROSBOT 流程 1:1 与 Python 代码地址；A/B/F/C/D/E 块、Extension 线程、flow-master 单 tick 顺序。 |
| [DOT_FIX_战网账号密码功能无效.md](DOT_FIX_战网账号密码功能无效.md) | 缺凭证时从流程内弹窗并等待的 1:1 修复。 |
| `pyapps/d3-check/ui/panels/rosbot_extension_panel.py` | Python 启停 toggle、_start_rosbot/_stop_rosbot、_update_control_button、_control_btn_set_busy。 |
| `dotapps/d3check/Panels/RosbotPanel.xaml.cs` | DOT 启停按钮、UpdateRosbotControlFromState、DoRunRosbotAfterWakeAsync（修复后不禁用按钮）。 |
| `dotapps/d3check/Ctl/RosbotFlowController.cs` | RunAsync、StopRosbot、B/D 块；DEBUG 已加。 |
| `dotapps/d3check/D3CheckCore/GameInterfaceData.cs` | SetRosbotFlowMasterEnabled、SetRosbotStatus、NotifyCallbacks；DEBUG 已加。 |

---

**总结**：按钮无 toggle 是因为 DOT 在启动时禁用了按钮，已改为与 Python 一致（启动不禁用，仅更新状态与文案）；公共类库为 dotcore，D3 子类库为 dotapps/d3check（含 D3CheckCore），引用关系与 Python 查找逻辑对应；功能未完成源于尚未实现 tick+extension+F3/F4 等完整流程；所有关键细节均需打 DEBUG 日志，便于 1:1 对照与排错。
