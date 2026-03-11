# 技术说明：INITIAL_STATE_DETECTION、d4_modules/README、_obsolete_play_button_clicker、ROSBOT_FLOW_C_BLOCK_DOC_VS_CODE、bn_flow_B9

**目的**：说明此五处文档/目录/代码/缓存的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `docs/INITIAL_STATE_DETECTION.md`
- `d4_modules/README.md`
- `utils/_obsolete_play_button_clicker.py`
- `docs/ROSBOT_FLOW_C_BLOCK_DOC_VS_CODE.md`
- `.cache/bn_flow_snapshots/bn_flow_B9.json`

---

## 一、docs/INITIAL_STATE_DETECTION.md

### 1.1 职责与约定

- **用途**：规定 **应用启动时** 的**初始状态检测**：仅做检测、**不驱动流程**（不调 tick_bn_only_flow、tick_flow_master）。可复用入口为 **run_full_status_refresh()**（d3utils/rosbot_task_processor.py），执行 Battle.net（含亚服/国服）+ D3 + ROSBOT 检测并 notify_state_sync，**不做 flow 检查**。流程：UI ready → Controller 调 get_thread_registry().start_timer_loop_after_ui_ready()（在 ui.run() 前）→ **start_timer_loop_after_ui_ready() 先在主线程同步执行 do_window_monitor_initial_check()** → 再启动 timer 并 submit_one_shot(do_window_monitor_initial_check)；do_window_monitor_initial_check（timers/one_shot_tasks.py）**只调 run_full_status_refresh()**（从不调 check_window()），故不受 is_flow_active() 影响；notify_state_sync 推送 game_interface_data 到回调，底栏通过 window_monitor.register_status_ui 注册故收到状态并更新战网/ROS/D3/地图/阶段/窗口尺寸等。
- **约定**：初始检测与 2s tick 流程驱动分离；process_task() 仅在 flow 激活时调 tick_*，不用于此次初始检测；改初始检测逻辑须保持「主线程先跑一次 do_window_monitor_initial_check、再启动 timer」的顺序，否则首帧可能无状态。

### 1.2 易被误解或改错的原因

1. **误在初始检测中调 tick**：若在 do_window_monitor_initial_check 或 run_full_status_refresh 内调 tick_bn_only_flow/tick_flow_master，会违反「检测仅、不驱动流程」的约定。
2. **误用 check_window()**：文档明确 do_window_monitor_initial_check 只调 run_full_status_refresh()，从不 check_window()；若改成 check_window() 会受 is_flow_active() 影响，启动时 flow 未开则可能不执行。
3. **主线程顺序**：若先启动 timer 再跑 do_window_monitor_initial_check，首帧可能尚未收到 notify_state_sync，底栏会短暂无数据。
4. **文档与代码不同步**：若 rosbot_task_processor、one_shot_tasks、thread_registry、window_monitor_timer 的符号或调用链变更，文档中 Code locations 表未更新会导致对照错。

### 1.3 正确做法

- 初始检测仅用 run_full_status_refresh()，不调 tick；do_window_monitor_initial_check 只调 run_full_status_refresh + window callbacks；保持 start_timer_loop_after_ui_ready 内「先主线程 do_window_monitor_initial_check，再 timer + one_shot」；文档表与代码同步更新。

---

## 二、d4_modules/README.md

### 2.1 职责与约定

- **用途**：**D4 训练模型目录**说明。结构：model_registry.json、<model_name>_detector.pt、<model_name>_detector.json；model_registry.json 含 registry_version、models 数组（model_name、model_file、category、type、classes、img_size、samples、training_info、trained_at）。训练流程：数据放在 .cache/training_data/source/<project>/yes|no；train_all.py 或 train_progressbar.py 训练；模型存 d4_modules/；验证用 validate_models.py --image；验证输出到 .core_node/pytools/tmp/model_validation/。模型为二分类（no/yes）、YOLOv8 分类、80/20 划分。
- **约定**：代码加载模型时从 d4_modules/model_registry.json 读 models、用 model_file 路径加载；训练数据路径与 README 一致；若 model_registry 结构或 key 变更，消费代码须同步；validate_models 的 --stride、--confidence、--output 等与文档一致。

### 2.2 易被误解或改错的原因

1. **model_registry 结构变更**：若增加或删除 registry 的顶层 key 或 models 项结构，未同步 README 或加载代码会 KeyError 或解析错。
2. **路径假设**：README 中验证输出路径为 C:\Users\<username>\.core_node\pytools\tmp\model_validation\，若项目或环境不同会写错目录。
3. **训练数据路径**：若 .cache/training_data/source/ 或 yes/no 子目录约定变更，train_all 扫描会漏或错。
4. **二分类与 classes**：代码若假定 classes 为 ["no","yes"] 且 class_id 1 为 yes，与 README 一致；若 README 或训练脚本改 classes 顺序未同步推理代码会反。

### 2.3 正确做法

- 修改 model_registry 结构或 models 项时同步 README 与加载方；训练与验证路径以 README 为准或配置化；classes 与 class_id 约定与训练脚本、推理代码一致。

---

## 三、utils/_obsolete_play_button_clicker.py

### 3.1 职责与约定

- **用途**：**已废弃**（_obsolete_ 前缀）。PlayButtonClicker 用 **uiautomation**、**providor.providor_second.PLAY_BUTTON_AUTOMATION_IDS** 在战网界面找 Play 按钮并点击；依赖 **utils.color_print**（项目规范多为 pycore ColorPrint）；current_dir 为 utils 的父目录（即项目根）；递归深度 10、win32api SetCursorPos 与 play_button.Click()。**不应被新代码或现有流程引用**；战网 Play 点击应由当前约定实现（如 share/battlenet 或 d3utils 内统一入口）。
- **约定**：不在此文件扩展；不将本模块作为「点 Play 按钮」的推荐实现；若需 Play 点击逻辑，应使用项目内当前约定方案；删除前确认无引用。

### 3.2 易被误解或改错的原因

1. **误当可用工具**：未注意 _obsolete_ 前缀而在此模块上开发或在新流程中 import，会引入 uiautomation、providor_second、utils.color_print 等已弃用或与规范不符的依赖。
2. **utils.color_print**：项目多从 pycore 用 ColorPrint，若 utils 下无 color_print 或已改为 _obsolete_color_print，会 ImportError。
3. **PLAY_BUTTON_AUTOMATION_IDS**：若 providor_second 移除或常量迁移，本文件会报错；与当前战网控件约定可能不一致。
4. **与 INITIAL_STATE / flow 无关**：初始检测与流程驱动均不依赖本文件；误引用会与 ROSBOT_FLOW、战网流程设计脱节。

### 3.3 正确做法

- 视本文件为只读历史参考，不新增依赖、不在新代码中 import；Play 点击需求以项目现有战网/流程入口为准；删除前全局搜索并确认无引用。

---

## 四、docs/ROSBOT_FLOW_C_BLOCK_DOC_VS_CODE.md

### 4.1 职责与约定

- **用途**：**ROSBOT_FLOW_MERMAID 中 C 块**（C D3 已运行直连）的**文档与代码 1:1 对照**。原则：仅以文档字面为准。内容：C1 入口、C2 缩放、C3 截屏识图与 C3_Result 各出边、C3w、C5 点击开始游戏、C5w 等到 game_tool 或超时、C12 结束 D3 进 D；超时约定（C3/C3w 1 分钟、从进入 C3 循环起、检测到 start 则点击并重置 1 分钟；C5w 超时文档未写具体时长、代码为 5×2 秒）；**文档明确「d3_connecting/d3_connecting_alt 继续 wait」仅出现在 C3，不适用于 C5w**；每个节点对应唯一代码位置（C1=run_c1_entry，C2=run_c2_resize，C12=run_c12_end_d3 等）。
- **约定**：改 C 块逻辑须先对照本文档与 flow_c_d3_direct、d3_start_game_and_teleport_waiter 等实现，保持 1:1；若要在 C5w 内对 connecting 做延长等待，须**先在文档中补充 C5w 条款**再改代码；C10 仅判掉线（M 前后截图对比）、C7 为传送前确保地图打开，两套逻辑分离，不可混淆。

### 4.2 易被误解或改错的原因

1. **在 C5w 内加 connecting 延长**：文档未写 C5w 内 connecting 继续 wait，若直接改代码加逻辑会与文档不一致；应先改文档再改代码。
2. **超时起点或重置逻辑错**：C3 超时 1 分钟从进入 C3 循环起只设一次 deadline，出现 start 时点击并重置；若在 C3w 每轮都重置或从错误时刻计时会违反文档。
3. **节点与代码错位**：若误把 C7a/C7w/C7b 或 C10 的实现换位置，会与「一个节点一个逻辑」表不符。
4. **C3_Result 出边与 branch_result**：disconnect/start/game_tool/other 与 run_c4_branch_result 返回值及 controller 分支须一一对应，改返回值或分支未同步文档会 1:1 破坏。

### 4.3 正确做法

- 改 C 块前先读本文档与对应代码；超时与重置严格按文档表实现；新增行为（如 C5w 内 connecting）先补文档再实现；节点→代码表与 flow_c_d3_direct、controller 调用链同步更新。

---

## 五、.cache/bn_flow_snapshots/bn_flow_B9.json

### 5.1 职责与约定

- **用途**：BN 流程节点 **B9** 的快照缓存；**meta**（node="B9", reason="B9_first_screen"）、**controls** 数组（name、automation_id、type、rect、level），与 bn_flow_B4、bn_flow_BN_LoginAsia 结构一致。用于调试或回放 B9 首屏控件树。
- **约定**：消费方可能依赖 meta.node、meta.reason 或 controls；文件名与 meta.node 对应；B9 在 flow 中语义（如「首屏」）与 reason、流程文档一致；若生成逻辑变更，meta 或 controls 须与消费方兼容。

### 5.2 易被误解或改错的原因

1. **误删 meta 或改 node/reason**：若 reason 被消费方用于区分 B9 场景（如 first_screen），改 reason 会影响逻辑；node 与文件名不一致会导致按文件名查节点错。
2. **controls 结构或 automation_id**：若 battlenet 快照产出方改结构或战网客户端升级导致 automation_id 变化，依赖本文件的解析会错。
3. **.cache 清理**：若清理 .cache 或 bn_flow_snapshots 未确认 B9 等快照是否被依赖，会破坏调试或回放。
4. **与 B9 节点语义**：flow_bn_only_state/BNNode 中 B9 的语义（如无战网窗口时回 B2 等）与本文档无关，但 meta.node 须与节点名一致，否则流程图与快照对照错位。

### 5.3 正确做法

- 修改快照结构或 meta 时确认消费方；清理 .cache 前确认 bn_flow_snapshots 依赖；meta.node 与项目 BN 节点命名一致；reason 与流程文档或注释一致。

---

## 六、与道歉文档的关系

若此前因未先通读上述五处约定（如 INITIAL_STATE_DETECTION 的 run_full_status_refresh 与主线程顺序、d4_modules README 的 registry 与路径、_obsolete_play_button_clicker 勿用、ROSBOT_FLOW_C_BLOCK 的 C 块 1:1 与 C5w 文档先改、bn_flow_B9 的 meta/controls）而在此五处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加对本文的引用。
