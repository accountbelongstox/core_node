# 技术说明：rosbot_task_processor、_obsolete_d3_macro_controller_optimized、interface_manager

**目的**：说明这三处代码的职责、易被误解或改错的原因，以及正确约定。便于后续修改时不再犯同类错误。

**涉及文件**：
- `d3utils/rosbot_task_processor.py`
- `utils/_obsolete_d3_macro_controller_optimized.py`
- `d3utils/interface_manager.py`

---

## 一、rosbot_task_processor.py

### 1.1 职责与约定

- **唯一入口**：定时任务每 1 秒调用 `process_rosbot_task()`，内部调用 `processor.process_task()`。
- **2 秒步进**：`process_task()` 内使用 `_flow_tick_count`，仅当 `_flow_tick_count[0] % 2 == 0` 时才执行 flow（即实际为每 2 秒一步），与 ROSBOT_FLOW 文档一致。
- **不在此处做 refresh/notify**：Tick 内只读 flow 开关、调 flow 库（`tick_bn_only_flow()`、`tick_flow_master()`）；所有 refresh、notify 由 flow 库内部调用（Approach 3）。
- **执行顺序**：先 `tick_bn_only_flow()`，再 `tick_flow_master()`；当两个开关都开时，同一 tick 内两者都会执行。

### 1.2 易被误解或改错的原因

1. **1 秒与 2 秒混淆**：任务每 1 秒跑一次，但 flow 逻辑只每 2 秒执行一次。若在此处改成“每 1 秒都跑 flow”，会破坏 extension_flow 的 deadline_tick 等以 2 秒为单位的假设。
2. **在 process_task 里加 refresh/notify**：文档明确写“Tick does not call third-party libs; it only invokes the flow library”。若在此处增加 `refresh_battlenet_status()`、`refresh_d3_status()` 等，会与 flow 库内部的 refresh 重复或顺序错乱。
3. **调整 bn_only 与 flow_master 的先后顺序**：当前约定是 BN-only 先、flow_master 后；若颠倒或只跑其一而文档未改，会导致“先战网再 F0/extension”的流程不一致。
4. **is_flow_active() 与开关的二次读取**：代码在 2s 门通过后再次读取 `get_bn_only_enabled()`、`get_flow_master_enabled()`，若被“优化”成只读一次，可能在极短时间窗口内与用户切换开关不同步。

### 1.3 正确做法

- 修改 flow 步进周期或顺序时，必须同步看 `extension_flow_tick_step`、`flow_master_driver` 和文档 ROSBOT_FLOW_MERMAID / ROSBOT_FLOW_CHECKLIST。
- 不在 `process_task()` 内增加任何 refresh、notify 或第三方调用；状态刷新只在 flow 库或 `run_full_status_refresh()` 等明确入口进行。

---

## 二、utils/_obsolete_d3_macro_controller_optimized.py

### 2.1 职责与约定

- **明确废弃**：文件头注明 OBSOLETE；与 `controller.d3_macro_controller.D3MacroController` 重复，且依赖不存在的 `ui.diablo3_macro_ui_optimized.Diablo3MacroUIOptimized`，从未接入 main.py 或 http_bridge。
- **仅作参考保留**：类内方法均为 `pass` 或打印废弃提示；不应被任何新逻辑引用或继承。

### 2.2 易被误解或改错的原因

1. **误用为“优化版”控制器**：若看到“Optimized”字样就把它当主控制器使用或接到 main/http_bridge，会导致运行时缺少真实 UI 与逻辑。
2. **在“优化”需求时改这个文件**：真正生效的是 `controller.d3_macro_controller.D3MacroController` 和实际使用的 UI；修改本文件不会影响运行行为，反而容易造成“改错了文件”的困惑。
3. **删除或恢复 Diablo3MacroUIOptimized 的 import**：注释已说明该 UI 不存在；若取消注释或尝试实现一个“Diablo3MacroUIOptimized”来配合本文件，会与现有主流程脱节，应统一走现有 D3MacroController + 现有 UI。

### 2.3 正确做法

- 所有宏控制、技能配置、start/stop_macro 的修改一律在 `controller.d3_macro_controller` 及对应 UI 上进行。
- 本文件仅作历史参考，不接新依赖、不恢复废弃 import；若需删除须确认无文档或脚本引用该路径。

---

## 三、d3utils/interface_manager.py

### 3.1 职责与约定

- **D3InterfaceManager**：统一管理 D3 界面信息采集，对外提供两种路径：
  - **Optimized（窗口缓存）**：`collect_ui_info()`、`collect_bag_info_quik()`，使用 `UIRegionCollectorOptimized`。
  - **Anchor（全屏锚点）**：`collect_ui_info_anchor()`、`collect_bag_info_anchor()`，使用 `UIRegionCollectorAnchor`。
- **先 UI 后背包**：所有 `collect_bag_info_*` 均先调用对应的 `collect_ui_info*` 刷新屏幕与 UI 区域，再从 shared data 取图做背包检测；不得省略“先刷新 UI”的步骤。
- **无背包时送 I 再试一次**：`collect_bag_info_quik` / `collect_bag_info_anchor` 在首次未检测到背包时，会向 D3 发送按键 I 并等待后重试一次；这是约定逻辑，不要擅自删除或移到别处。

### 3.2 易被误解或改错的原因

1. **混淆两种采集方式**：Optimized 与 Anchor 使用不同 collector、不同捕获方式（窗口缓存 vs 全屏）；若在调用方混用（例如用 anchor 的 UI 结果配 optimized 的 bag），或改错 collector 类型，会导致坐标/尺度不一致。
2. **省略“先 collect_ui_info 再 collect_bag”**：若为“省一次调用”而直接调 `_bag_collector.collect()` 且当时 shared data 中无最新 game_window_image，背包检测会基于旧图或失败。
3. **修改 force_new_capture / force_refresh 的默认值**：文档约定“ALWAYS refresh screen data first”；若把 `force_new_capture=True` 改为 False 或把“先刷新再 bag”改成“有缓存就用缓存”，会违反“先 UI 后背包”的约定。
4. **get_window_offset() 与 bag 偏移**：注释写明“Bag offset is already included in bag coordinates”；若在此处再加一层 bag 偏移会导致重复偏移。

### 3.3 正确做法

- 新增或修改采集逻辑时，明确使用 Optimized 路径还是 Anchor 路径，且 UI 与 bag 同路径配对。
- 保持“先 collect_ui_info（或 anchor），再 collect bag”；无背包时“送 I 再试一次”保留在 interface_manager 内。
- 坐标与尺度以 shared data 和 get_scaled_* 为准；不在 get_window_offset() 中重复加 bag 偏移。

---

## 四、与道歉文档的关系

若此前因上述任一点（如：在 rosbot_task_processor 里加了 refresh、误改 obsolete 文件、或打乱 interface_manager 的 UI→bag 顺序）导致反复改错或理解偏差，可视为实现与约定不一致所致。本说明作为技术沉淀写入 `cursor_AI_道歉目录`，与 `Cursor_专属道歉文档.md` 并列；专属道歉文档中已通过“技术说明_rosbot_task_processor与obsolete及interface_manager”引用本文件，便于后续修改前先查此处约定。
