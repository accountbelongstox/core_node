# 技术说明：screenshot_categories、ROSBOT_FIND_LOGIC_LIST、bn_flow_BN_LoginAsia、OCR_CNSTD_MODEL_INSTALL、kanai_cube_handler

**目的**：说明此五处文件/文档/缓存的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `config/screenshot_categories.py`
- `docs/ROSBOT_FIND_LOGIC_LIST.md`
- `.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json`
- `docs/OCR_CNSTD_MODEL_INSTALL.md`
- `controller/ctl_func/kanai_cube_handler.py`

---

## 一、config/screenshot_categories.py

### 1.1 职责与约定

- **用途**：截图分类常量与清理。**SCREENSHOT_CATEGORIES** 字典 key 为类别名（login_try、d4_screenshots、d4_annotated、match_debug、pathfinding、debug_capture、ui_annotated、validation、scaled_templates），value 为 **providor.constants** 与 **providor.constants.d4** 中的 Path 常量（LOGIN_TRY_SCREENSHOT_DIR、D4_SCREENSHOT_DIR 等）。**ScreenshotCategoryManager** 提供 get_dir(category)、register_category、clean_older_than(category, max_age_seconds)、clean_all()；**get_screenshot_category_manager()** 返回单例。清理仅针对目录内文件、不递归子目录；删除失败时 ColorPrint.yellow 打日志。
- **约定**：调用方传的 category 必须与 SCREENSHOT_CATEGORIES 的 key 一致，否则 get_dir 返回 None；若在 providor.constants 中增删或改名常量，须同步本文件 SCREENSHOT_CATEGORIES；DEFAULT_CLEANUP_MAX_AGE_SECONDS 来自 constants，勿在本文件改默认值。

### 1.2 易被误解或改错的原因

1. **category 拼写或 key 不一致**：若调用 clean_older_than("login_try_screenshot") 而 key 为 "login_try"，get_dir 返回 None，clean 返回 0 且无报错，易误以为已清理。
2. **常量来源变更**：若 LOGIN_TRY_SCREENSHOT_DIR 等迁移到别处或改名，本文件未同步会 ImportError 或指向错误目录。
3. **register_category 与默认 categories**：若其他模块 register_category 注册新类别，须用相同 name 调用 get_dir/clean_older_than，否则仍取不到。
4. **clean 不递归**：子目录内文件不会被删除，若误以为「按类别清理」会清子目录，会漏删或需另写逻辑。

### 1.3 正确做法

- 调用 clean_older_than/get_dir 时使用 SCREENSHOT_CATEGORIES 中已有的 key 或已 register_category 的 name；修改 constants 中路径常量时同步本文件；需清理子目录时在调用方或本模块扩展逻辑并文档化。

---

## 二、docs/ROSBOT_FIND_LOGIC_LIST.md

### 2.1 职责与约定

- **用途**：**ROSBOT 查找逻辑清单**，规定唯一流程以 ROSBOT_LOOKUP_FLOW.md 为准；**唯一逻辑入口**为 get_rosbot_window、get_rosbot_detection、refresh_rosbot_status、get_running_rosbot_processes（均来自 rosbot_manager / rosbot_status_provider）；需要「ROSBOT 窗口」时只允许用以上接口，**不得自行按标题或 PID 取窗口**。文档列出当前调用方（rosbot_status_provider、rosbot_operation、rosbot_ui_automation、share/threads、window_monitor_timer、bottom_bar、scan_rosbot_running、test_rosbot_window_ui 等）及**已废弃**（_obsolete_rosbot_manager、_obsolete_game_process_detector、_obsolete_game_state_manager），明确以上废弃均不参与当前查找。
- **约定**：新增或修改 ROSBOT 窗口/进程查找逻辑时须走上述入口，不得在业务代码中按窗口标题或 PID 自实现；废弃模块不得被引用；调用方列表与 ROSBOT_LOOKUP_FLOW、ROSBOT_WINDOW_AND_STATUS 一致。

### 2.2 易被误解或改错的原因

1. **自实现按标题查找**：若在任意模块写「按标题找 ROSBOT 窗口」或「enum 窗口匹配标题」，即违反「只允许用 get_rosbot_window 等」的约定，与 ROSBOT_LOOKUP_FLOW 不一致。
2. **误用废弃模块**：若 import _obsolete_rosbot_manager 或 _obsolete_game_process_detector 的 check_process_running_by_title、detect_rosbot_process 等，会与当前「exe 唯一、无标题过滤」的设计冲突。
3. **文档与代码不同步**：若 rosbot_manager 新增接口或调用方增减，本清单未更新会导致文档与实现两张皮，后续维护者按文档写会漏用或错用。
4. **login_try_screenshot_controller 等**：文档明确其仅用 kill_if_running/start，不取窗口；若在此类模块中增加「取 ROSBOT 窗口」逻辑，须通过 get_rosbot_window 等入口，且需在本清单调用方中补充。

### 2.3 正确做法

- 凡需 ROSBOT 窗口或状态时仅调用 get_rosbot_window、get_rosbot_detection、refresh_rosbot_status、get_running_rosbot_processes；不引用 _obsolete_* 中查找逻辑；清单与 ROSBOT_LOOKUP_FLOW 及代码同步更新。

---

## 三、.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json

### 3.1 职责与约定

- **用途**：BN 流程节点 **BN_LoginAsia** 的快照缓存，结构同 bn_flow_B4 等：**meta**（node、reason，此处 node 为 "BN_LoginAsia"、reason 为 "asia_login"）、**controls** 数组，每项含 name、automation_id、type、rect（left/top/right/bottom/width/height）、level。用于调试或回放亚洲登录界面控件树。
- **约定**：消费方可能依赖 meta.node、meta.reason 或 controls 的 name/automation_id/type/rect；文件名与 meta.node 对应（BN_LoginAsia）；若生成逻辑或 battlenet 快照流程变更，meta.reason 或 controls 结构可能变化，消费方须兼容或同步更新。

### 3.2 易被误解或改错的原因

1. **误删 meta 或改 node/reason**：若脚本或人工改 meta 导致 node 与文件名不一致，按「文件名即节点」查找会错；reason 被消费方用于区分进入原因时，改 reason 会影响逻辑。
2. **controls 结构变更**：若 battlenet 快照产出方改字段名或层级（如 rect 改为 bounds），依赖本结构的解析会报错或取错。
3. **.cache 清理**：若清理 .cache 或 bn_flow_snapshots 时未确认是否有逻辑依赖该目录，可能破坏调试或回放。
4. **与 BN 节点枚举一致**：meta.node 须与 flow_bn_only_state/BNNode 或 rosbot_flow_battlenet 中亚洲登录相关节点名一致，否则流程图或代码对照会错位。

### 3.3 正确做法

- 修改快照结构或 meta 时先确认消费方（脚本、调试工具）；清理 .cache 前确认 bn_flow_snapshots 是否被依赖；meta.node 与项目内 BN 节点命名保持一致。

---

## 四、docs/OCR_CNSTD_MODEL_INSTALL.md

### 4.1 职责与约定

- **用途**：CnSTD/CnOCR **检测模型**安装说明。当出现 ch_PP-OCRv5_det 找不到或 Det model init failed 时，OCR 会回退到 naive_det（无框仅文字）；要获得**位置/框**（如 CN 登录点击）须按文档安装检测模型。文档说明：推荐先用 **db_shufflenet_v2_small**（CnSTD 原生，通常自动下载）；若失败则安装 cnstd[ort-cpu] 或 [ort-gpu]；若自动下载失败可手动从 Hugging Face 或百度网盘下载并放到 cnstd 1.2 目录；**本 app 引擎回退顺序**为 db_shufflenet_v2_small → ch_PP-OCRv5_det → naive_det。
- **约定**：代码中若假定「一定有检测模型」或「一定有 boxes」，在 naive_det 回退时可能无框，CN 登录等逻辑须兼容「仅文字无框」时的比例点击等降级；cnstd 1.2 目录路径因平台而异（Windows/Linux/Mac），文档已写明，脚本或配置勿写死路径。

### 4.2 易被误解或改错的原因

1. **假定检测模型一定存在**：若代码在 OCR 初始化后直接取 boxes 而未判断是否 naive_det，在未安装模型环境下会 AttributeError 或取到空。
2. **路径写死**：若安装脚本或文档中把 cnstd 1.2 路径写死为某一平台，其他平台用户按文档操作会放错目录。
3. **回退顺序与文档不一致**：若代码中引擎选择顺序改为先 ch_PP-OCRv5_det 再 db_shufflenet_v2_small，与文档不一致会导致「按文档装了仍报错」或「文档说用 A 实际用 B」。
4. **onnxruntime 与 cnstd[ort-*] 冲突**：文档要求若已有 onnxruntime 先 uninstall 再装 cnstd 的 extra，若未按此操作可能仍失败，文档未强调时易被忽略。

### 4.3 正确做法

- 使用 OCR 结果时判断是否有 boxes/位置，无则走比例或文字匹配等降级；安装说明与代码中模型回退顺序一致；路径按文档按平台区分；强调 onnxruntime 与 cnstd 安装顺序。

---

## 五、controller/ctl_func/kanai_cube_handler.py

### 5.1 职责与约定

- **用途**：卡奈魔方操作处理（升级、重铸、黄装处理）。依赖 **get_game_interface_data()**：interface_type 须为 "kanai_cube"、须有 bag_layout、**window_offset**、**kanai_right_page_opened**；坐标通过 **get_scaled_kanai_put_material_button、get_scaled_kanai_right_panel_toggle、get_scaled_conversion_button、get_scaled_kanai_next_page_button** 与 window_offset 换算屏幕坐标；**get_state_aware_click_handler()** 执行点击；**should_stop_assistant()** 在翻页等循环中检查中断。流程：校验界面与背包 → _reset_panel_to_first_page（依赖 kanai_right_page_opened）→ _navigate_to_page(page_clicks) → _process_yellow_items。路径 project_root 为 ctl_func 的上级的上级（即 controller）。
- **约定**：调用前须保证 game_interface_data 已更新（interface_type=kanai_cube、bag_layout、window_offset、kanai_right_page_opened 已设）；get_scaled_* 与 game_interface_data 中标准坐标及缩放约定一致；不应在未校验 interface_type 与 bag_layout 时执行操作；路径与 sys.path.insert 依赖 controller 目录结构，从别处运行或移动文件会 import 失败。

### 5.2 易被误解或改错的原因

1. **未校验 interface_type 或 bag_layout**：若直接调用 handle_upgrade_operation 而当前界面不是卡奈或背包未采集，会 False 或误点；若在调用方未先刷新 game_interface_data 就调 handler，易用旧数据。
2. **window_offset 为空**：若未做窗口采集或 game_interface_data.window_offset 未设，所有 get_scaled_* + offset 的屏幕坐标错，点击错位。
3. **kanai_right_page_opened 未维护**：_reset_panel_to_first_page 依赖该状态，若上游从未写入或写入错误，重置逻辑会误判开/关，导致多点击或少点击 toggle。
4. **get_scaled_* 与常量/缩放不一致**：若 providor 或 game_interface_data 中卡奈按钮标准坐标或缩放比例变更，本 handler 未同步会点错位置。
5. **project_root 与 import**：current_dir 为 ctl_func，project_root 为 controller；若文件移至他处或从 repo 根运行，sys.path.insert(0, project_root) 可能仍指向错误，导致 import share/d3utils 等失败。

### 5.3 正确做法

- 调用 handler 前确保已打开卡奈界面并刷新 game_interface_data（interface_type、bag_layout、window_offset、kanai_right_page_opened）；修改卡奈相关坐标或缩放时同步本 handler 所用 get_scaled_* 来源；从 controller 或约定入口运行，避免路径错；循环中保持 should_stop_assistant() 检查。

---

## 六、与道歉文档的关系

若此前因未先通读上述五处约定（如 screenshot_categories 的 key 与 constants、ROSBOT_FIND_LOGIC_LIST 的唯一入口与废弃勿用、bn_flow_BN_LoginAsia 的 meta/controls 与消费方、OCR_CNSTD 的回退顺序与路径、kanai_cube_handler 的 interface_type/window_offset/kanai_right_page_opened）而在此五处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加对本文的引用。
