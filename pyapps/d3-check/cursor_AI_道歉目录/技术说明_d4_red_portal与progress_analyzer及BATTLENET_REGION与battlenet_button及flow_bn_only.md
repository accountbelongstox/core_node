# 技术说明：d4_red_portal_detector、progress_analyzer、BATTLENET_REGION_DESIGN_REVIEW、battlenet_button_detector、flow_bn_only

**目的**：说明这五处代码/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `d4utils/d4_red_portal_detector.py`
- `athtest/progress_analyzer.py`
- `docs/BATTLENET_REGION_DESIGN_REVIEW.md`
- `d3utils/battlenet_button_detector.py`
- `d3utils/rosbot_flow/flow_bn_only.py`

---

## 一、d4utils/d4_red_portal_detector.py

### 1.1 职责与约定

- **用途**：D4 红门检测，基于 BGR 颜色掩码 + 滑动窗口；输入可为路径、PIL Image、numpy BGR；返回 `(x, y, width, height)` 或 None。
- **坐标与缩放**：扫描区域、窗口大小由 `D4StandardCoordinates` 与 `calculate_unified_scaled_coordinate` 决定；`is_windowed_mode()` 从 `get_d4_interface_data()` 读取，用于缩放计算。若 D4 分辨率或窗口模式与约定不符，扫描区会错位。
- **TARGET_COLORS**：BGR 列表，红/橙门色；COLOR_TOLERANCE 约 ±5%。若游戏 UI 改版或色偏，需更新 TARGET_COLORS 或容差。

### 1.2 易被误解或改错的原因

1. **D4StandardCoordinates 字段**：red_portal_scan_left_margin、red_portal_scan_right_margin、red_portal_scan_bottom_margin、red_portal_max_width、red_portal_max_height、red_portal_min_area 等若在 D4StandardCoordinates 中改名或改结构，_find_portal_region 会报错或扫错区域。
2. **is_windowed_mode 与缩放**：缩放依赖 current_width/current_height 与 is_windowed_mode；若 d4_data 未正确设置窗口模式或尺寸，calculate_unified_scaled_coordinate 会算错边距。
3. **输入格式**：PIL 转 BGR 时用 RGB→BGR；若调用方传入已是 BGR 的 numpy 却当 RGB 处理会色偏；文档已写明「numpy array (BGR)」。
4. **多门**：当前实现返回第一个满足 min_area 的区域；若需多门或优先级，需改逻辑并文档化。

### 1.3 正确做法

- 修改 D4 标准分辨率或坐标定义时同步改 D4StandardCoordinates 与本模块的引用；保证 get_d4_interface_data() 的窗口尺寸与 is_windowed_mode 与真实运行一致。
- 游戏更新导致红门色变时，更新 TARGET_COLORS 或 COLOR_TOLERANCE，并在注释中注明依据（截图/版本）。

---

## 二、athtest/progress_analyzer.py

### 2.1 职责与约定

- **用途**：进度条分析——从 JSON 加载前景/背景色（regions.hex_pixels），取图像中间一行，按前景色找连续像素，进度 = 最后连续前景位置 / 宽度。
- **JSON 结构**：与 load_color_groups 约定一致：第一行前 cols-2 为前景相关，最后 2 个为背景；cols = ceil(sqrt(num_colors))。若 JSON 格式或行列语义变化，需同步修改。
- **main() 路径**：写死 apps\d3-check、.cache\file_processor；若项目为 pyapps/d3-check 或缓存路径不同会 FileNotFoundError。

### 2.2 易被误解或改错的原因

1. **getbbox() 误用**：`width, height = img.getbbox()[2], img.getbbox()[3]` 取的是 bbox 的 right 和 bottom；仅当 left=0、top=0 时 right=width、bottom=height。若图像经过裁剪或 bbox 非从 (0,0) 开始，应使用 width = bbox[2]-bbox[0]，height = bbox[3]-bbox[1]，否则进度百分比与扫描范围会错。
2. **路径写死**：与 square_sampler、button_detector 相同，main() 中 apps、.cache 路径需改为参数或项目根推导，否则他机或子项目运行失败。
3. **中间行假设**：进度条假定在 middle_y = height//2；若 UI 布局变化进度条不在中间行，需改为可配置行或区域。
4. **athtest 与主流程**：本脚本属 athtest 工具，主流程 D3/D4 若有进度检测应使用正式模块，勿直接依赖本脚本的 JSON 或算法约定未文档化就复用。

### 2.3 正确做法

- 用 getbbox() 时 width = bbox[2]-bbox[0]，height = bbox[3]-bbox[1]；或直接用 img.size。
- main() 路径改为命令行参数或基于项目根；JSON 结构在模块头或 README 中说明，与主流程进度检测若有复用则约定一致。

---

## 三、docs/BATTLENET_REGION_DESIGN_REVIEW.md

### 3.1 职责与约定

- **用途**：战网国服/亚服操作与检测的**设计审查**——BattlenetOperation、BattlenetAsiaOps、BattlenetRegionJudge、BattleNetManager、rosbot_flow_battlenet 的职责与衔接；结论为「职责划分清晰、可保持现有结构」。
- **与代码一致**：文档中的模块路径、Judge 判定依据（LOGIN_WINDOW_*、asia email/password step）、流程节点（B4、B13、BN_LoginAsia）须与当前实现一致；若代码重构或常量迁移（如 Asia 从 JSON 加载）未同步更新文档，会误导后续修改。

### 3.2 易被误解或改错的原因

1. **文档与实现脱节**：若 BattlenetRegionJudge 增加新判定或 BattlenetAsiaOps 增加新步骤未在本文更新，读者会以为仍按文档行为实现，改错或漏改。
2. **「合理」结论的假设**：文档基于「亚服无 ntes」「国服有 legalAcceptance+ntes」等；若战网客户端改版导致 markers 重叠或新增，需重新评估并更新「潜在问题与建议」。
3. **JSON 与 constants**：文档提到亚服 D3/Play 可来自 docs JSON、国服为常量；若实际改为国服也从 JSON 加载或路径变更，文档中的「国服为常量」需更正。
4. **流程节点引用**：B4、B13、BN_LoginAsia 等若在 rosbot_flow_battlenet 中改名或分支调整，文档中的流程描述需同步，否则与 ROSBOT_FLOW_MERMAID 或 CHECKLIST 不一致。

### 3.3 正确做法

- 修改 Judge、AsiaOps、Operation、flow_battlenet 的判定逻辑或流程时，同步更新本审查文档的表格与结论；常量/JSON 来源变更时更新 §2、§4。
- 战网大版本或区服 UI 变化时，重新过一遍 §2.2、§3 的判定与建议，必要时更新「潜在问题」。

---

## 四、d3utils/battlenet_button_detector.py

### 4.1 职责与约定

- **用途**：按战网蓝色按钮色 #0074E0（BATTLE_NET_BUTTON_HEX/RGB）在图像中找按钮；以任意匹配像素为左上角尝试构建 button_w×button_h 框，仅校验左、上、右三条边（不校验底边），第一个成功即返回 bbox/center。
- **常量**：来自 providor.constants.common（BATTLE_NET_BUTTON_HEX、BATTLE_NET_BUTTON_RGB、DEFAULT_BRIGHTNESS_TOL、DEFAULT_BUTTON_W、DEFAULT_BUTTON_H）。若战网主题或按钮尺寸变化，需更新常量或调用方传参。

### 4.2 易被误解或改错的原因

1. **不校验底边**：设计上故意不校验底边以减少误判；若 UI 上非按钮区域也有同色且高度≥button_h，可能误检；若需更严可改为四边校验并文档化。
2. **button_w/button_h 与真实不一致**：DEFAULT_BUTTON_W/H 若与当前战网客户端按钮实际尺寸不符，会找不到或框错；不同分辨率下可能需缩放，当前接口未做缩放，调用方需传入已适配尺寸或本模块从 resolution 推导。
3. **RGB 与 BGR**：本模块用 RGB（_image_to_rgb）；若调用方传入 BGR 未转 RGB 会色偏，调用约定需写明输入格式。
4. **与 BattlenetOperation 的关系**：点击战网按钮通常走 UIA/控件；本模块为图像检测备用。若在流程中混用「先 UIA 再 fallback 本检测」需约定顺序，避免重复或冲突。

### 4.3 正确做法

- 战网主题或分辨率变更时核对 BATTLE_NET_BUTTON_* 与 DEFAULT_BUTTON_W/H；必要时按分辨率或 scale 传参。
- 输入图像格式（RGB/BGR）在函数注释或调用处明确；与 Operation 的点击策略在流程文档中区分「UIA 优先 / 图像 fallback」。

---

## 五、d3utils/rosbot_flow/flow_bn_only.py

### 5.1 职责与约定

- **用途**：BN-only 流程的一 tick 执行（Ensure Battle.net only，bn_only_enabled 为 True 时）；**不包含** D3 或 flow_master 逻辑。步骤顺序：REFRESH_NOTIFY（refresh_battlenet_status + notify_state_sync）→ RE_READ_ABORT（若 bn_only 关闭则 return）→ RUN_BN_TICK（tick_battlenet_ready_flow(no_activate=True)）→ HANDLE_BN_RESULT（set_last_bn_result，confirmed 时 reset_confirmed_to_poll(for_bn_only=True)）。
- **no_activate**：tick_battlenet_ready_flow(no_activate=True) 表示 BN-only 不激活窗口（不抢焦点）；与 flow_master 下 B 块可能激活的语义区分。
- **状态**：步骤与状态定义在 flow_bn_only_state；本模块只负责「执行 tick + 调第三方 + 更新状态」。

### 5.2 易被误解或改错的原因

1. **在此模块加 D3 或 flow_master 步骤**：若误在 tick_bn_only_flow 内调用 refresh_d3_status、tick_flow_master 或 extension_flow_tick_step，会破坏「仅确保战网」的语义，与 INITIAL_STATE_DETECTION 及 one_shot 的「BN-only 只刷 BN」矛盾。
2. **去掉 REFRESH_NOTIFY 或改顺序**：先 refresh 再 run_bn_tick 是约定；若先跑 BN tick 再 refresh 会基于旧状态做决策。
3. **no_activate 改为 False**：BN-only 场景通常不希望抢焦点；若改为 False 与「仅确保战网」的预期行为可能不符。
4. **set_last_bn_result / reset_confirmed_to_poll**：若 HANDLE_BN_RESULT 逻辑被删或改（如 confirmed 时不调用 reset_confirmed_to_poll），下游或 B 块可能误判「已确认」状态，导致重复确认或漏确认。

### 5.3 正确做法

- tick_bn_only_flow 内**仅**执行文档中的四步；不引入 D3、ROSBOT、flow_master、extension 的 tick。
- 修改 flow_bn_only_state 的步骤枚举或 rosbot_flow_battlenet 的 no_activate 语义时，同步更新本模块注释与 ROSBOT_FLOW 相关文档。

---

## 六、与道歉文档的关系

若此前因上述任一点（如 d4 红门坐标/缩放或 TARGET_COLORS 改错、progress_analyzer 的 getbbox 或路径、BATTLENET_REGION 文档未与实现同步、battlenet_button 尺寸或输入格式错误、flow_bn_only 混入 D3/flow_master）导致反复改错或理解偏差，可视为实现与约定不一致所致。本说明已写入 `cursor_AI_道歉目录`，并在 `Cursor_专属道歉文档.md` 中增加对本文的引用，便于后续修改前先查此处约定。
