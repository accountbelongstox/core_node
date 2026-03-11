# 技术说明：debug_window_offset、extension_flow_tick_step、i18n_auxiliary_panel_en

**目的**：说明此三处脚本/模块/文案的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `scripts/debug/debug_window_offset.py`
- `d3utils/rosbot_flow/extension_flow_tick_step.py`
- `providor/i18n/i18n_auxiliary_panel_en.json`

---

## 一、scripts/debug/debug_window_offset.py

### 1.1 职责与约定

- **用途**：**调试脚本**，诊断 70px 窗口偏移问题；读取 **get_d4_interface_data()** 的 fullscreen_size、game_window_size、window_offset、is_windowed_mode()，计算宽高差并推算边框/标题栏（左右各半、标题栏=高度差-侧边宽）；打印当前常量 TITLE_BAR_HEIGHT=31、WINDOW_BORDER_WIDTH=8 及「若 70px 偏移存在」时的建议值。路径：_project_root = __file__ 的 parent.parent（即 scripts/debug → scripts → d3-check）。
- **约定**：运行前需先有 D4 截图/采集，否则 d4_data 无 size 数据会提示 "No size data available"；脚本内 31/8 为打印用的参考值，实际常量可能在 providor.constants 或 D4 相关模块；从 scripts/debug/ 或 d3-check 根运行并保证 sys.path 含 d3-check。

### 1.2 易被误解或改错的原因

1. **未先采集即运行**：d4_data 来自 get_d4_interface_data()，若从未执行过 D4 截图或 capture_and_collect_info，fullscreen_size/game_window_size 为空，脚本只能提示无数据；易被误认为脚本 bug。
2. **路径与运行目录**：_project_root 为 __file__.parent.parent（scripts 的父级 = d3-check）；若脚本挪到别处或从 repo 根运行，parent.parent 可能不是 d3-check，import share.game_interface_data 等会失败。
3. **常量与实际实现不一致**：脚本打印的 31/8 仅为说明用；若 D4 或 screenshot_provider 中实际使用 TITLE_BAR_HEIGHT/WINDOW_BORDER_WIDTH 的取值已改，脚本输出会误导；修改常量时应同步脚本内说明或从常量模块读取。
4. **仅诊断不写回**：脚本只读 d4_data 并打印，不写回 CONFIG 或 d4_data；若期望「根据诊断自动改常量」需另实现。

### 1.3 正确做法

- 运行前先执行 D4 截图/采集使 d4_data 有尺寸；从 d3-check 根或保证 project_root 正确时运行；将 31/8 视为与常量模块一致的参考或改为从常量模块读取后打印；仅作诊断时不在脚本内写回配置。

---

## 二、d3utils/rosbot_flow/extension_flow_tick_step.py

### 2.1 职责与约定

- **用途**：**Extension 流程状态机**，每 2s tick 执行一步（无线程、无 time.sleep）；由 **rosbot_task + flow_master** 驱动，**flow_master_driver** 在 EXTENSION_TICK 阶段调用。**extension_flow_tick_step(current_tick, start_rosbot_task_fn)** 返回 **"idle" | "running" | "success" | "fallthrough"**；process_task 根据返回值决定是否 trigger_extension_rosbot_started、是否本拍继续。阶段：ExtensionPhase（C_ENTRY → C2 → C_C3_LOOP → C_C3_WAIT/DISCONFIRM → C_C4_BRANCH → C_C10_* → C_C7a_* → C_C7b_* → reset_state + "success"/"fallthrough"）。**start_extension_flow_c_branch()** 在 F0 给出 c1 且 has_d3 且 bn_confirmed 时由 flow_master_driver 调用，将 phase 设为 C_ENTRY。
- **约定**：本模块**不读** flow_master_enabled/bn_only（符合 FLOW_STATE_OWNERSHIP_DESIGN）；仅「执行一步并返回结果」；流程分支与阶段顺序由 extension_flow_state 与本文定义，调用方（process_task）根据返回值推进；不得在此内根据 flow_state 做「是否执行」分支。

### 2.2 易被误解或改错的原因

1. **在此模块内读流程开关**：若在 extension_flow_tick_step 内读 get_flow_master_enabled() 决定是否执行或返回，违反「其他类库无状态开关」；是否调用本函数由 process_task 在 EXTENSION_TICK 前已决定。
2. **阶段顺序或返回值变更未同步**：若增删 ExtensionPhase 或修改某 phase 的下一阶段、或将 "success" 改为 "ok" 等，flow_master_driver 中根据 step_result 的判断会错；trigger_extension_rosbot_started 等依赖 "success"/"fallthrough" 语义。
3. **与 extension_flow_state 不同步**：phase、wait_ticks、deadline_tick、payload 由 extension_flow_state 持有；若本文与 extension_flow_state 的 phase 枚举或默认值不一致，会错相。
4. **start_rosbot_task_fn 调用时机**：仅在 C_C7b_TELEPORT 成功且 auto_start_rosbot 时调用；若提前或延后调用、或漏调，ROSBOT 启动与流程文档不符。
5. **run_c12_end_d3 / reset_state**：多处分支在失败或 fallthrough 时 run_c12_end_d3() + reset_state() + return "fallthrough"；若漏掉 reset_state 会导致下一拍 phase 仍为旧值。

### 2.3 正确做法

- 不在此模块读 flow_master/bn_only；阶段与返回值与 flow_master_driver、extension_flow_state、ROSBOT_FLOW 文档一致；修改 phase 或返回值时同步 process_task 与文档；start_rosbot_task_fn 仅在 C_C7b_TELEPORT 成功且配置允许时调用；所有 fallthrough 路径均 reset_state。

---

## 三、providor/i18n/i18n_auxiliary_panel_en.json

### 3.1 职责与约定

- **用途**：**辅助功能面板**相关**英文**文案。结构：**ui.auxiliary_functions.***、**ui.auxiliary_panel.***（含 combat_macro、assistant、blood_shard、quick_pickup、blacksmith、kanai_*、bag_offset、open_bag_adjust、debug_*、update_bag_offset_failed 等）、**ui.bag_offset.***。代码中通过 get_ui_text("ui.auxiliary_panel.xxx") 或 "auxiliary_panel.xxx"（视 i18n_manager 命名空间合并方式）取文；auxiliary_functions_panel 等使用 ui.auxiliary_panel.*。
- **约定**：key 与代码中 get_ui_text 调用一致；与 i18n_auxiliary_panel_zh.json 结构一致；新增/删除/改名 key 须同步代码与中文档。

### 3.2 易被误解或改错的原因

1. **key 路径与代码不一致**：若代码用 ui.auxiliary_panel.bag_offset_title 而 JSON 为 ui.auxiliary_panel.bag_offset 或 bag_offset.title，会取不到、显示 key 或回退默认。
2. **中英文 key 不同步**：若英文增 key 中文未加、或中文改名英文未改，语言切换后缺译或显示 key。
3. **与 auxiliary_functions_panel 引用不一致**：面板内大量 get_ui_text("ui.auxiliary_panel.xxx")；若 JSON 将部分 key 放在 auxiliary_functions 下而未统一，会部分缺译。
4. **嵌套与扁平**：JSON 为嵌套（auxiliary_panel.blood_shard_enabled 等）；若 i18n_manager 期望扁平 key（如 ui.auxiliary_panel.blood_shard_enabled），须与加载逻辑一致。

### 3.3 正确做法

- 辅助面板相关文案 key 与 auxiliary_functions_panel 及所有引用 get_ui_text 处一致；修改 key 时同步代码与 i18n_auxiliary_panel_zh.json；保持与 i18n_manager 命名空间约定一致。

---

## 四、与道歉文档的关系

若此前因上述任一点（如 debug_window_offset 未先采集或路径/常量说明与实际不符、extension_flow_tick_step 内读流程开关或阶段/返回值与 flow_master_driver 不同步、i18n_auxiliary_panel_en key 与代码或 zh 不同步）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
