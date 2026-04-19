# 技术说明：test_menu.py、color_region_detector.py、bn_flow_BN_LoginAsia.json、ROSBOT_FLOW_STEP_INDEX.md

**目的**：说明此四处文件/文档的职责、易被误解或改错的原因，以及正确约定。bn_flow_BN_LoginAsia 已在 **技术说明_screenshot_categories与ROSBOT_FIND_LOGIC_LIST及bn_flow_BN_LoginAsia及OCR_CNSTD及kanai_cube_handler.md** 第三节详述，此处仅摘要并补充与 test_menu、color_region_detector、ROSBOT_FLOW_STEP_INDEX 的联动。

**涉及文件**：
- `scripts/test_menu.py`
- `scripts/color_region_detector.py`
- `.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json`
- `docs/ROSBOT_FLOW_STEP_INDEX.md`

---

## 一、scripts/test_menu.py

### 1.1 职责与约定

- **用途**：**交互式菜单功能测试脚本**，用于验证 interactive_menu 的单选/多选与缓存持久化。依赖 `from interactive_menu import InteractiveMenu`；缓存路径为 `Path.home() / ".core_node" / ".scripts" / "menu_test_cache.json"`，即用户主目录下 .core_node/.scripts，**非**项目内路径。
- **约定**：运行时应能从当前环境解析 `interactive_menu`（通常 **cwd 为 pyapps/d3-check** 或 PYTHONPATH 含 pyapps/d3-check，且 interactive_menu 位于 scripts/ 或包根）；cache_key 与 test 中 "test_game_type"、"test_templates" 一致；勿把 cache 改到项目 .cache 或 scripts 下，否则与「跨运行持久化到用户目录」设计不符。

### 1.2 易被误解或改错的原因

1. **import 与运行目录**：狗B 垃圾 Cursor 可能误以为 test_menu 在 scripts/ 下即应以 `from scripts.interactive_menu` 或相对路径导入，或改 sys.path 为 `parent.parent`（指向 core_node）导致在 pyapps/d3-check 下运行反而找不到 interactive_menu。
2. **cache 路径**：若将 cache_file 改为 `Path(__file__).parent / "menu_test_cache.json"` 或项目 .cache，会破坏「每次运行脚本在不同工作目录下仍共享同一用户级缓存」的约定，测试无法验证跨运行持久化。
3. **与 interactive_menu 的契约**：技术说明_interactive_menu与combobox及code_reuse_analysis 已写明 interactive_menu 为 **脚本级 CLI**、无 tk；若在 test_menu 中引入 tk 或 providor 做「菜单测试」会与 interactive_menu 定位冲突。

### 1.3 正确做法

- 修改 test_menu 前先读 **技术说明_interactive_menu与combobox及code_reuse_analysis.md**；不改 cache_file 为用户主目录 .core_node/.scripts；不改 import 为包内相对导入，除非同时文档化运行方式（如 `python -m scripts.test_menu` 且 scripts 为包）；运行方式以「在 pyapps/d3-check 下执行或 PYTHONPATH 含该目录」为准。

---

## 二、scripts/color_region_detector.py

### 2.1 职责与约定

- **用途**：**颜色区域检测脚本**，用滑动窗口法在图像中检测目标色块。`current_dir = Path(__file__).resolve().parent.parent` 即 **pyapps/d3-check**，`sys.path.insert(0, str(current_dir))` 后导入 `from pycore.pyfoundations.color_print import ColorPrint`，故要求 pycore 位于 pyapps/d3-check 下或该路径在 PYTHONPATH 中。
- **算法约定**：TARGET_COLORS 为 BGR 元组列表（OpenCV BGR）；COLOR_TOLERANCE=0.05（±5%）；MIN_REGION_AREA=10；扫描边界 left_margin=150、right_margin=328、bottom_margin=200；检测区域最大 310×600；区域元组为 **(x, y, width, height, area, color_stats, is_candidate)** 共 7 项，is_candidate 为 color 使用率 <30%；同类型区域不可重叠、不同类型（candidate vs normal）可重叠；找到 color 使用率≥50% 的正常区域后提前停止检测。
- **约定**：draw_regions、process_image 等会按 7 元组或 6 元组（兼容无 is_candidate）解包；改 left/right/bottom 边界或 310/600 未与算法说明或调用方同步会漏检或误检；改 BGR 色表或 tolerance 未与使用该脚本的流程同步会识别错。

### 2.2 易被误解或改错的原因

1. **项目根与 pycore**：狗B 垃圾 Cursor 可能把 `parent.parent` 改为 `parent.parent.parent` 以「指向 core_node」，导致在 pyapps/d3-check 下运行脚本时 pycore 不在 path 中而 ImportError；或误以为 pycore 在 workspace 根而非 pyapps/d3-check 下。
2. **扫描边界与算法**：left_margin/right_margin/bottom_margin 与文档注释「Skip edges: left 150px, right 328px, bottom 200px」一致；若为「优化」随意改小或改大扫描区会漏掉有效区域或扫进无关边缘。
3. **区域元组结构**：返回值与 draw_regions、REGION DETAILS 打印处均依赖 7 元组（含 is_candidate）；若改为 6 元组且未在 draw_regions 中统一按 6 元组并计算 is_candidate 会解包错或显示错。
4. **BGR 与 RGB**：注释已写明 OpenCV 用 BGR；若按 RGB 顺序改 TARGET_COLORS 会颜色完全错。

### 2.3 正确做法

- 修改前确认运行上下文：脚本以 pyapps/d3-check 为项目根、parent.parent 即该目录；改 margin 或 max_width/max_height 时与算法说明及任何依赖「检测区域」的调用方同步；保持区域 7 元组或全项目统一 6 元组并兼容；BGR 色表与 tolerance 与上游约定一致。

---

## 三、.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json

### 3.1 职责与约定（摘要）

- **用途**：BN 流程节点 **BN_LoginAsia**（亚洲登录窗口）的快照缓存。结构：**meta**（node="BN_LoginAsia", reason="asia_login"）、**controls** 数组，每项含 name、automation_id、type、rect（left/top/right/bottom/width/height）、level。文件名与 meta.node 对应。
- **约定**：meta.node 与 BN 节点命名（如 flow_battlenet、BNNode）一致；reason 可被消费方用于区分进入原因；controls 结构（含 rect、automation_id）与 operate_by_spec、docs/rosbot_ui_structure 等一致；勿删 meta 或改 node/reason 导致与文件名或流程图节点错位。

### 3.2 易被误解或改错的原因

1. **与 B8 等快照混淆**：bn_flow_B8.json 的 meta.reason 为 "B8_to_B9" 等步骤间原因；BN_LoginAsia 的 reason 为 "asia_login" 表示亚洲登录界面。若狗B 垃圾 Cursor 统一改成数字或步骤代号会破坏消费方对 reason 的语义依赖。
2. **controls 结构**：若改 rect 为 bounds 或改 automation_id 命名未与 rosbot_ui_structure、operate_by_spec 同步会解析错或点击错。
3. **.cache 清理**：清理 .cache 或 bn_flow_snapshots 时未确认是否有逻辑依赖该目录会破坏调试或回放。

### 3.3 正确做法

- 详见 **技术说明_screenshot_categories与ROSBOT_FIND_LOGIC_LIST及bn_flow_BN_LoginAsia及OCR_CNSTD及kanai_cube_handler.md** 第三节；修改 meta 或 controls 前确认消费方；meta.node 与项目内 BN 节点命名一致。

---

## 四、docs/ROSBOT_FLOW_STEP_INDEX.md

### 4.1 职责与约定

- **用途**：**ROSBOT 流程图步骤与代码模块索引**。每个流程图步骤（A1–A9、B1–B16、F0–F4、C1–C12、D1–D14、E1–E6、TM）映射到实现模块与状态（Done/TODO）。**Source of truth** 为 `docs/ROSBOT_FLOW_MERMAID.md`。
- **约定**：代码或 MERMAID 变更时须同步本索引；文末「Code vs diagram (current behaviour)」描述当前行为（如 F0 只跑 F1、A8→F2、C4 disconnect→D1）；若改 flow_master_driver、rosbot_flow_*.py、rosbot_flow_battlenet 等未同步本文档会导致索引与实现不符，后续维护者按索引读会错。

### 4.2 易被误解或改错的原因

1. **F0 只跑 F1**：文档明确 F0 只运行 F1，返回 b1→B2 或 c1→C1；F2/F3/F4 不在 F0 内执行。若狗B 垃圾 Cursor 在 F0 或 run_f0_prejudge_entry 内加入 F2/F3 调用会破坏「F0 仅预判、F2 在 A8 后由 extension 线程跑」的设计。
2. **A8→F2**：图中 C8 成功后到 A8，再进入 F2（is ROSBOT online?）。代码侧 C8 成功在 extension 线程内返回后该线程会跑 run_f2_rosbot_online()；在 tick 侧 C8 成功时 trigger_extension_rosbot_started(True)、E 块已在 C_C7b 内跑过，F2 不在 tick 中再跑。若误在 tick 中再跑 F2 会重复或状态乱。
3. **索引与实现脱节**：若改 rosbot_flow_f3_log_timeout、run_f4_close_d3_send_f7、enter_battlenet_at_b2 等函数名或调用关系未更新本索引的 Module 列，会误导后续阅读。
4. **Code vs diagram 节**：该节描述当前行为与图差异；若代码改行为（如 C4 disconnect 后走 D1）未更新该节会文档与实现不一致。

### 4.3 正确做法

- 修改 flow 相关代码或 ROSBOT_FLOW_MERMAID.md 时当次更新 ROSBOT_FLOW_STEP_INDEX.md 的 Step/Module/Status 及「Code vs diagram」；读本文档时以「Source of truth 为 MERMAID」为准，索引为速查；勿在未读本索引与 MERMAID 的情况下改 F0/F2/F3/F4 的调用关系。

---

## 五、四处联动与易错总结

- **test_menu** 依赖 **interactive_menu**（脚本级 CLI），运行根为 pyapps/d3-check，cache 在用户主目录；改 test_menu 的 import 或 cache 须与 interactive_menu 技术说明一致。
- **color_region_detector** 项目根为 parent.parent=pyapps/d3-check，pycore 在此路径下；算法常数与 7 元组区域结构勿单独改而不同步。
- **bn_flow_BN_LoginAsia.json** 与 bn_flow_B8 等同属 bn_flow_snapshots，meta.node/reason 与 BN 节点命名及消费方约定一致；结构变更须同步技术说明_screenshot_categories... 与 operate_by_spec。
- **ROSBOT_FLOW_STEP_INDEX.md** 与 ROSBOT_FLOW_MERMAID、flow_master_driver、rosbot_flow_*.py 须双向同步；F0/F1、A8→F2、C4→D1 等行为描述不可与代码不一致。

此前若因未先通读上述约定而在此四处反复改错或理解偏差，责任在狗B 垃圾 Cursor。后续修改前以本说明为准。
