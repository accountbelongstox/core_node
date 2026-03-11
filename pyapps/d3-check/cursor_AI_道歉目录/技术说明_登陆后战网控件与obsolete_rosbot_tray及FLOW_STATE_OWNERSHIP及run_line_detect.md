# 技术说明：登陆后的战网元素-控件说明、_obsolete_rosbot_manager、_obsolete_tray_clicker、FLOW_STATE_OWNERSHIP_DESIGN、run_line_detect_on_image

**目的**：说明这五处文档/代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/登陆后的战网元素-控件说明.md`
- `utils/_obsolete_rosbot_manager.py`
- `utils/_obsolete_tray_clicker.py`
- `docs/FLOW_STATE_OWNERSHIP_DESIGN.md`
- `scripts/run_line_detect_on_image.py`

---

## 一、docs/登陆后的战网元素-控件说明.md

### 1.1 职责与约定

- **用途**：战网**登陆后**主界面控件的说明文档。数据来源为「调试(战网 UI JSON)」按钮导出的 JSON，复制到 `docs/登陆后的战网元素.json`（UI Automation，Chromium 战网）。与 `docs/登陆后的战网元素.json`、`providor/constants/d3.py` 的 D3_TAB_AUTOMATION_IDS、START_GAME_AUTOMATION_IDS 及 `d3utils/battlenet_operation.py` 的 BattlenetOperation 一致。
- **已用控件**：D3 游戏 Tab 小按钮 `game-nav-btn-D3CN`（TabItemControl "Diablo III"）；开始游戏按钮区域 `play-btn-main` / `play-btn`（GroupControl）；判断「游戏是否正在开始」：name 含 "Playing Now" / "Play" / "开始游戏" 且 `is_enabled` 为 False 或 name 含 "Playing Now" 则视为游戏中。
- **待实现**：同意登陆、点击确认登陆、是否处在登陆界面、是否已经登陆（文档中列为待实现，实现时应与 BattlenetOperation 及 JSON 结构同步）。

### 1.2 易被误解或改错的原因

1. **文档与代码 automation_id/name 不一致**：若代码中改用其它 id（如 `play-btn` 与 `play-btn-main` 顺序反）、或文档更新为其它 key 而 BattlenetOperation/constants 未同步，战网点击会失败或点错控件。
2. **把「待实现」当已实现**：同意登陆、确认登陆、登陆界面判断等在文档中为「待实现」；若在流程中假定这些接口已存在或返回值已稳定，会报错或行为未定义。
3. **JSON 路径与文档不符**：文档写「复制到 docs/登陆后的战网元素.json」；若实现从其它路径或 battlenet_ui_elements_*.json 读，需在文档或代码中统一说明，否则调试导出与代码读取不是同一文件。
4. **判断逻辑与 BattlenetOperation 不一致**：如「游戏中」判断（is_enabled=false / "Playing Now"）若在 BattlenetOperation.is_game_starting() 或 get_dynamic_state 中逻辑不同，会导致状态展示与文档说明不一致。

### 1.3 正确做法

- 修改战网控件 id/name 时同步更新本文档、`docs/登陆后的战网元素.json` 的导出说明、以及 `BattlenetOperation`/`providor/constants/d3.py`；实现「待实现」项时在文档中改为已用并注明接口位置；判断逻辑与 BattlenetOperation 保持一致。

---

## 二、utils/_obsolete_rosbot_manager.py

### 2.1 职责与约定

- **用途**：文件名带 **\_obsolete_**，表示**已废弃**。原为 RoS-BoT 进程管理（RoS-BoT.exe 与目录下其它 exe 的启动、清理、等待新 exe、发送 F7、窗口激活与 UI 分析）。当前主流程的 ROSBOT 启动与管理应使用 **d3utils/rosbot_manager.py** 及 **flow（flow_master_driver、rosbot_task_processor）**，不以此文件为入口。
- **依赖**：CONFIG ros_settings、ColorPrint、WindowActivator、WindowAnalyzer、IntegratedAutomationController；逻辑为 validate_ros_directory → find_rosbot_exe → 可选 cleanup_old_other_exe_processes → start_executable(RoS-BoT.exe) → wait_for_process → wait_for_new_other_exe → activate_and_analyze_window。

### 2.2 易被误解或改错的原因

1. **当作主入口使用**：若在面板或任务线程中从此文件导入 RoSBotManager 并调用 start_rosbot_sequence() 作为「启动 ROSBOT」的实现，会绕过 flow_master 与 rosbot_task_processor，与 FLOW_STATE_OWNERSHIP_DESIGN、DESIGN.md 的启动顺序与状态所有权不一致。
2. **在 obsolete 文件中加功能**：若在此文件内新增方法或改 CONFIG 键、期望主程序生效，会导致维护两套逻辑（d3utils/rosbot_manager 与 obsolete），且主流程不会用到新逻辑。
3. **与 d3utils/rosbot_manager 混淆**：d3utils/rosbot_manager.py 为当前使用的实现；若引用或复制逻辑时搞混两个文件，会改错地方。
4. **_obsolete_game_state_manager 的引用**：若 _obsolete_game_state_manager 仍 import RoSBotManager from utils.rosbot_manager，而 utils 下仅有 _obsolete_rosbot_manager，则可能为历史错误或已移除的 utils/rosbot_manager；不应以 obsolete 链作为主流程依据。

### 2.3 正确做法

- 主流程不引用 _obsolete_rosbot_manager；ROSBOT 启动、清理、状态由 d3utils/rosbot_manager 与 flow（process_task、tick_flow_master）负责；若需改 ROSBOT 行为，改 d3utils/rosbot_manager 与 flow 相关代码，不在此文件增加功能。

---

## 三、utils/_obsolete_tray_clicker.py

### 3.1 职责与约定

- **用途**：文件名带 **\_obsolete_**，表示**已废弃**。原为系统托盘图标双击工具（pywinauto Desktop + win32api），通过关键字查找托盘图标并双击（如 Battle.net）。当前战网相关操作（含托盘/窗口激活）应使用 **battlenet_operation、BattleNetManager、flow** 等约定入口，不以此文件为生产逻辑。
- **行为**：click_tray_icon(keyword)、print_tray_info；依赖 pywinauto、win32api、win32con；遍历 class_name 含 tray/notify/shell 的窗口及其子控件，匹配 title/class_name 含 keyword 的图标并双击中心。

### 3.2 易被误解或改错的原因

1. **当作主流程战网/托盘入口**：若在「确保战网」「重新登陆」等流程中调用此文件的 click_tray_icon 期望唤起战网，会与 battlenet_operation、flow_bn_only、rosbot_flow_battlenet 的约定不一致，且 obsolete 可能未与当前窗口查找逻辑同步。
2. **在 obsolete 中改 keyword 或点击逻辑**：若在此修改 Battle.net 关键字或双击坐标计算并期望主流程生效，主流程不会调用此处，会导致无效修改。
3. **与 _obsolete_click_handler 等重复**：战网点击（托盘、窗口、PyAutoGUI、UIA）在道歉文档与技术说明中已明确主流程用 battlenet_operation / battlenet_asia_ops；在 _obsolete_tray_clicker 内改与在 _obsolete_click_handler 内改一样，都不会影响主流程。
4. **环境依赖**：pywinauto Desktop(backend="uia") 与系统托盘实现相关，不同环境可能枚举不到或坐标不准；主流程不依赖此类实现。

### 3.3 正确做法

- 主流程不引用 _obsolete_tray_clicker；战网窗口激活、托盘相关行为以 BattleNetManager、battlenet_operation、flow 文档为准；不在此文件增加或修改生产逻辑。

---

## 四、docs/FLOW_STATE_OWNERSHIP_DESIGN.md

### 4.1 职责与约定

- **用途**：**流程状态所有权**设计方案。核心原则：**流程类库定义并持有状态**（flow_master_enabled、bn_only_enabled、步骤/节点）；**其他类库无状态开关**（不读 flow_master/bn_only 做分支）；**Tick 只驱动流程类库**（仅 process_task 被任务线程调用）；**流程根据返回值更新状态**（被调用方返回 True/False 或明确类型，不通过全局状态表达结果）。
- **状态归属**：flow_master_enabled、bn_only_enabled、步骤/节点由 rosbot_flow_state 与 process_task 维护；面板通过 set_flow_master_enabled/set_bn_only_enabled 写，process_task、check_window、BN 流通过 get_* 读；battlenet_status_provider、d3_status_provider、rosbot_flow_battlenet、run_f0_prejudge_entry、extension_flow_tick_step、run_f3_log_timeout 等**不读** flow_master/bn_only 做分支（例外：BN 流内 no_activate 下可读 get_bn_only_enabled() 仅用于提前 abort）。
- **Tick 驱动链**：TaskThreadManager(1s) → rosbot_task ENABLED 时 process_rosbot_task() → process_task()；window_monitor(10s) 先 is_flow_active() 再 refresh/notify。**唯一驱动流程执行的入口**为 process_task()。

### 4.2 易被误解或改错的原因

1. **在 provider 或 BN 流内读流程开关做分支**：若在 battlenet_status_provider、rosbot_flow_battlenet、run_f0_prejudge_entry 等内部根据 flow_master_enabled 或 bn_only_enabled 决定「是否执行」「走哪条分支」，违反「其他类库无状态开关」；分支应由 process_task 根据 flow_state 决定后调用谁。
2. **用 game_interface_data 的流程开关做分支**：若代码用 game_interface_data.rosbot_flow_master_enabled / ensure_battlenet_only_master_enabled 做 if 判断，与文档不符——这两项仅用于 UI 展示镜像，分支判断应统一用 flow_state 的 get_flow_master_enabled() / get_bn_only_enabled()。
3. **由 window_monitor 或其它定时器直接驱动 BN 流/extension**：若在 check_window 或 10s 定时器内直接调用 tick_battlenet_ready_flow、extension_flow_tick_step 等，违反「Tick 只驱动 process_task」；应仅由 process_task 内部按状态调用这些接口。
4. **被调用方通过写流程状态表达结果**：若 battlenet_flow、run_f3 等内部直接 set 步骤或 flow_master_enabled，违反「仅通过返回值」；流程类库是唯一根据返回值更新状态与步骤的一方。
5. **任务开关 rosbot_task 由流程内部写入**：文档明确「任务开关 rosbot_task 由面板根据 flow_state 的 is_flow_active() 派生」，不由流程内部写入；若在 process_task 或 flow 内写 ENABLED/DISABLED，会破坏设计。

### 4.3 正确做法

- 分支与是否执行由 process_task 读 flow_state 后决定；被调用方只返回明确结果（如 (done, result)、"b1"/"b2"/"c1"、"f4"）；不在 provider、BN 流、F0/F3/F4 内读 flow_master/bn_only 做分支；check_window 仅读 is_flow_active() 决定是否 refresh/notify，不直接调 tick_battlenet_ready_flow 等；代码位置以文档 §6 速查表为准（rosbot_flow_state、flow_bn_only、rosbot_task_processor、rosbot_extension_panel、window_monitor_timer）。

---

## 五、scripts/run_line_detect_on_image.py

### 5.1 职责与约定

- **用途**：**调试脚本**，对单张「debug_bag_line 区域」图像做太古/远古线检测，同目录输出带绿/白点的图。用法：`python run_line_detect_on_image.py <path_to_slot_image.png>`。路径基于 __file__（_script_dir、_d3_check_root、_core_node_root），依赖 `d3utils.debug_bag_hover` 的 _find_line_in_crop、_draw_dots_on_matched、_pixel_matches_any_ref、LINE_PRIMAL_ANCIENT_RGBS、LINE_PRIMAL_ANCIENT_TOLERANCE、LINE_ANCIENT_RGBS。
- **输出**：同目录下 `{src.stem}_line_{line_label}{suffix}`，line_label 为 primal_{height}、ancient_{height}、full_scan、normal、unknown 等。

### 5.2 易被误解或改错的原因

1. **脚本移动或路径破坏**：若脚本移至其它包或目录，_d3_check_root/_core_node_root 计算错误，sys.path.insert 可能找不到 d3_check 或 pycore，导致 import 失败。
2. **未传参或文件不存在**：若直接运行无 argv 或传入非文件路径，脚本 exit(1)；调用方需保证传入有效 slot 图像路径。
3. **debug_bag_hover 接口变更**：若 _find_line_in_crop 签名或返回值、或 LINE_* 常量在 debug_bag_hover 中改名/删除，此脚本会报错或结果错；修改 debug_bag_hover 时需兼容此脚本或同步改脚本。
4. **PIL/ndarray 约定**：脚本将图像转为 RGB 再 np.array；_find_line_in_crop 等假定 crop 为 RGB 数组；若传入 RGBA 或 BGR 未在脚本内统一转换，颜色匹配可能错。
5. **与 slot_line_scan_columns 等脚本分工**：本脚本为单图检测；slot_line_scan_columns 为批量/列扫描；二者共用 debug_bag_hover 的线检测逻辑，但输入/输出不同，勿混用命令行或输出路径约定。

### 5.3 正确做法

- 保持脚本在 scripts/ 下、路径基于 __file__；调用时传入有效 slot 图像路径；修改 debug_bag_hover 时保留 _find_line_in_crop、_draw_dots_on_matched 及 LINE_* 常量兼容性，或同步改此脚本；单图调试用本脚本，批量/列扫描用 slot_line_scan_columns。

---

## 六、与道歉文档的关系

若此前因上述任一点（如战网控件说明与 BattlenetOperation/JSON 不一致、误用 _obsolete_rosbot_manager 或 _obsolete_tray_clicker 作为主入口、违反 FLOW_STATE_OWNERSHIP 在 provider 内读流程开关或由非 process_task 驱动流程、run_line_detect 路径或 debug_bag_hover 接口变更未同步）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
