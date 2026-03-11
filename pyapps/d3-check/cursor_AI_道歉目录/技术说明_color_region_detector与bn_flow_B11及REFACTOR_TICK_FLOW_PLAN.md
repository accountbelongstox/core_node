# 技术说明：color_region_detector、bn_flow_B11.json、REFACTOR_TICK_FLOW_PLAN

**目的**：说明此三处脚本/缓存/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `scripts/color_region_detector.py`
- `.cache/bn_flow_snapshots/bn_flow_B11.json`
- `docs/REFACTOR_TICK_FLOW_PLAN.md`

---

## 一、scripts/color_region_detector.py

### 1.1 职责与约定

- **用途**：**脚本/工具**，用滑动窗口做颜色区域检测。输入图像 BGR（cv2.imread）；**TARGET_COLORS** 为 BGR 元组列表（12 色）；**COLOR_TOLERANCE** ±5%；**MIN_REGION_AREA** 10 像素；滑动窗口最大 310×600；扫描边界 left_margin=150、right_margin=328、bottom_margin=200；候选区为颜色种类占比 <30%，正常区 ≥30%；找到颜色占比 ≥50% 的区域后**提前停止**检测。用法：`python color_region_detector.py <image_path>`；输出默认 **scripts/output/** 下 `{stem}_detected.png`、`{stem}_mask.png`。**show_color_palette.py** 从本脚本 import TARGET_COLORS、COLOR_TOLERANCE、calculate_color_range；**game_interface_data** 注释中提及 red portal 检测区域基于本脚本的 scan boundaries。
- **约定**：图像必须 BGR；区域元组为 7 元 (x, y, width, height, area, color_stats, is_candidate) 或兼容 6 元；TARGET_COLORS 变更须与 show_color_palette 及任何引用方一致。

### 1.2 易被误解或改错的原因

1. **BGR 与 RGB 混用**：若传入 RGB 图或 TARGET_COLORS 误写为 RGB，cv2.inRange 与色块显示会错；show_color_palette 假定 BGR，与源一致。
2. **扫描边界与分辨率**：left/right/bottom margin 针对特定分辨率或 UI 布局；若图像尺寸或布局变化未调 margin，会漏检或误检；game_interface_data 中 red portal 区域若基于本脚本边界，改 margin 须同步。
3. **魔数**：310、600、150、328、200、30%、50% 等；若改阈值或窗口未文档化，行为变化难以追溯。
4. **作为库用时的元组长度**：draw_regions 与打印逻辑兼容 6 元与 7 元；若调用方假定仅 6 元会漏 is_candidate；新增字段时须保持向后兼容或同步所有解包处。
5. **路径**：current_dir = Path(__file__).resolve().parent.parent（即 d3-check 根）；output 默认 parent/scripts/output；若脚本移动，output 相对路径会变。

### 1.3 正确做法

- 输入图像统一 BGR；修改 TARGET_COLORS、margin、阈值时同步 show_color_palette 与 game_interface_data 等引用；作为库用时明确区域元组为 7 元并文档化；魔数可提为脚本顶常量并注释用途。

---

## 二、.cache/bn_flow_snapshots/bn_flow_B11.json

### 2.1 职责与约定

- **用途**：BN 流程 **B11** 节点运行时快照（UI Automation 控件树）。由 **rosbot_flow_battlenet** 内 `_save_ui_snapshot("B11", "B11_wait_oauth")` 写入；**meta.node**="B11"、**meta.reason**="B11_wait_oauth"（OAuth 等待态）。与 B4/B5/B6/B7/B9/B13 等结构一致；用于调试、1:1 对照与登录/OAuth 相关判断参考。缓存路径由 BN_FLOW_SNAPSHOTS_DIR 决定；.cache 为运行时产物。
- **约定**：下游若读取 B11 快照（如登录失败/OAuth 超时检测），需与 meta/controls 结构约定一致；文件名固定为 bn_flow_B11.json（步名），reason 在 meta 中；勿写死路径或把 B11 快照用于其它节点。

### 2.2 易被误解或改错的原因

1. **写死路径或节点名**：若代码写死 .cache 或 bn_flow_B11.json 绝对路径，清缓存或换环境后读不到；应从 BN_FLOW_SNAPSHOTS_DIR 与节点名生成路径。
2. **controls 结构与检测逻辑不一致**：若登录失败/OAuth 检测期望的 automation_id/name 与 B11 快照实际结构不同，会误判；B11 为「等待 OAuth 返回」态，与 B5/B7 等语义不同，勿混用。
3. **reason 与文件名**：文档与道歉目录中强调「步名固定为 bn_flow_B11.json、reason 在 meta」；若某路径写出 bn_flow_B11_wait_oauth.json 等带 reason 的文件名，与约定不符。
4. **.cache 当权威**：.cache 可清理、跨机可能不存在；勿在文档或脚本中假定其一定存在。

### 2.3 正确做法

- 快照路径从 BN_FLOW_SNAPSHOTS_DIR 与 "B11" 生成；读取快照的代码与 battlenet_region_judge 等约定的 controls 结构一致；B11 仅用于 B11/OAuth 相关逻辑；文件名固定步名、reason 仅在 meta 与日志中。

---

## 三、docs/REFACTOR_TICK_FLOW_PLAN.md

### 3.1 职责与约定

- **用途**：**Ensure Battle.net Only / Tick 驱动流程重构方案**，依据 ENSURE_BATTLENET_ONLY_TICK_FLOW.md。结论：**仅 1 处必须改**——`rosbot_task_processor.py` 约 188 行，F3/F4 条件从 `flow_master` 改为 **flow_master2**（二次读状态后的值），使 F3/F4 与「再读后分支」一致；**不创建**独立的 tick 驱动流程类库；不改 game_interface_data、window_monitor_timer、rosbot_extension_panel；可选在 process_task 二次读处加注释「二次读之后所有分支仅用 flow_master2/bn_only2」。
- **约定**：实现须按本方案做上述 1 行修改；不得在未与文档一致的情况下新增 tick 流程类库或改其它文件。

### 3.2 易被误解或改错的原因

1. **未改 F3/F4 条件**：若仍用 flow_master 而不用 flow_master2，用户在本 tick 内关闭 flow_master 后任务线程仍会用旧值执行 F3/F4，违反 ENSURE 文档 §5.3「当前状态」语义。
2. **误建 tick 流程类库**：文档明确「不创建」独立类库；若抽成新模块或新类「tick flow driver」，与方案不符。
3. **改动范围扩大**：方案仅 1 行 + 可选注释；若顺带改 game_interface_data、window_monitor、panel 的写入或 check_window 逻辑，可能引入不必要风险；除非另有设计，应只做方案所列修改。
4. **与 ENSURE_BATTLENET_ONLY_TICK_FLOW 脱节**：本方案是其实施清单；若 ENSURE 文档后续修订（如新增「再读」步骤），本方案应同步更新。

### 3.3 正确做法

- 在 rosbot_task_processor 中把 F3/F4 分支条件改为 flow_master2；不新增 tick 流程类；可选注释固化「二次读后只用 flow_master2/bn_only2」；其它文件按方案「不改动」执行；与 ENSURE_BATTLENET_ONLY_TICK_FLOW 保持一致。

---

## 四、与道歉文档的关系

若此前因上述任一点（如 color_region_detector 的 BGR/margin/元组长度与引用方不一致、B11 快照路径或结构或文件名约定混用、REFACTOR_TICK_FLOW_PLAN 未改 flow_master2 或误建类库）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
