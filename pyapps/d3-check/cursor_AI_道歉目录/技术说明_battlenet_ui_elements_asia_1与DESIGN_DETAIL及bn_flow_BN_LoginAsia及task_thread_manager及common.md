# 技术说明：battlenet_ui_elements_asia_1.json、DESIGN_DETAIL.md、bn_flow_BN_LoginAsia.json、task_thread_manager.py、common.py

**目的**：说明此五处文件/文档的职责、易被误解或改错的原因，以及正确约定。bn_flow_BN_LoginAsia、DESIGN_DETAIL、common 已在本目录其他技术说明中部分涉及，此处汇总五处联动与易错点。

**涉及文件**：
- `docs/battlenet_ui_elements_asia_1.json`
- `docs/DESIGN_DETAIL.md`
- `.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json`
- `d3utils/task_thread_manager.py`
- `providor/constants/common.py`

---

## 一、docs/battlenet_ui_elements_asia_1.json

### 1.1 职责与约定

- **用途**：战网亚服登录窗口 **UI 控件树快照**（一次 dump 的完整输出）。含 **timestamp**、**window_info**（hwnd、title、left/top/width/height、is_active 等）、**controls** 数组（每项含 id、parent_id、type、name、automation_id、class_name、value、help_text、patterns、rect、is_enabled、is_visible、level）、**files**（screenshot、annotated_screenshot 绝对路径）。与 **.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json** 结构不同：本文件有 id/parent_id、class_name、files；bn_flow_BN_LoginAsia 有 meta.node/meta.reason、controls 无 id/parent_id。
- **约定**：消费方若按「battlenet_ui_elements_asia_*」解析须用 id/parent_id 树与 rect；若按 automation_id 查找须与 common.py 的 ASIA_LOGIN_*_AUTOMATION_IDS、LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA 一致；files 中路径为绝对路径，跨环境引用须改相对或占位；rect 与 window_info 边界一致，若有控件 rect 超出窗口须裁剪或校验。

### 1.2 易被误解或改错的原因

1. **与 bn_flow_BN_LoginAsia 混淆**：狗B 垃圾 Cursor 可能将两文件视为同一结构，改其一未区分 id/parent_id 与 meta.node/reason、controls 格式差异，导致解析或 operate_by_spec 用错结构。
2. **automation_id 与 common.py 不同步**：password、submit、login-wrapper、login-header 等若在 common.py ASIA_LOGIN_* 或 LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA 中改名或增删，本快照与代码查找会错位。
3. **files 路径可移植性**：screenshot/annotated_screenshot 为绝对路径（如 C:\Users\...\\.core_node\\.d3check\\.cache\\...），若代码或文档当相对路径使用会在其他机器失败。

### 1.3 正确做法

- 修改本文件或生成工具时区分「docs 下 UI dump」与「.cache/bn_flow_snapshots 下 BN 节点快照」两套结构；automation_id/name 与 common.py ASIA_LOGIN_*、LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA 同步；files 路径若需可移植则改为相对或配置化。

---

## 二、docs/DESIGN_DETAIL.md

### 2.1 职责与约定

- **用途**：**详细设计**，与 DESIGN.md 合用；侧重 **Login Try** 与 **战网断线重启**。触发：log 含 trigger（config 键 log_detection.login_try，默认 config.constants.LOGIN_TRY_TRIGGER_DEFAULT）；流程：读 config（battlenet_path）→ 截图战网窗口（screenshot_provider、BATTLE_NET_WINDOW_TITLES、LOGIN_TRY_SCREENSHOT_DIR）→ OCR 断线关键词（BATTLE_NET_DISCONNECT_KEYWORDS）→ 若断线则 taskkill Battle.net.exe → 等约 2 秒 → explorer 启动 exe_path。
- **约定**：实现须与文档一致：log_monitor→log_analyzer→get_login_try_screenshot_controller().handle_login_try()；CONFIG["battlenet"]["battlenet_path"]、LOGIN_TRY_SCREENSHOT_DIR、BATTLE_NET_DISCONNECT_KEYWORDS 来自 common.py 或 config，改常量或 config 键须同步本文档；文档写明「no Python threads」指该流程本身顺序执行，非指系统无线程。

### 2.2 易被误解或改错的原因

1. **与 DESIGN.md 分工混淆**：DESIGN_DETAIL 只写 Login Try 与战网重启；总览、模块表在 DESIGN.md；若只改本档未改 DESIGN.md（或反之）会文档分叉。
2. **常量与实现脱节**：若改 common.py 的 LOGIN_TRY_TRIGGER_DEFAULT、LOGIN_TRY_SCREENSHOT_DIR、BATTLE_NET_DISCONNECT_KEYWORDS 或 CONFIG 键未更新 DESIGN_DETAIL，会文档与代码不符。
3. **handle_login_try 流程变更未同步**：若调换截图/OCR/kill/start 顺序或增删步骤未更新文档，会维护者按文档读错。

### 2.3 正确做法

- 实现 Login Try 与战网重启以 DESIGN_DETAIL 为准；改触发、流程、常量时同步更新本档；保持 log_analyzer、LoginTryScreenshotController、constants、screenshot_provider 与文档描述一致。详见技术说明_obsolete_click_handler与ROSBOT_FLOW及i18n_log_panel及DESIGN_DETAIL.md、技术说明_bn_flow_B6与d4_controller及square_sampler及DESIGN_DETAIL.md。

---

## 三、.cache/bn_flow_snapshots/bn_flow_BN_LoginAsia.json

### 3.1 职责与约定（摘要）

- **用途**：BN 流程节点 **BN_LoginAsia** 快照；meta.node=BN_LoginAsia、reason=asia_login；controls 数组为 name、automation_id、type、rect、level（无 id/parent_id）。与 docs/battlenet_ui_elements_asia_1.json 为不同产出：本文件为 BN 流节点快照，后者为完整 UI dump。
- **约定**：meta.node 与 BN 节点命名一致；controls 与 operate_by_spec、common.py ASIA_LOGIN_*、LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA 一致；勿与 battlenet_ui_elements_asia_1 结构混用。

### 3.2 易被误解或改错的原因

1. **与 battlenet_ui_elements_asia_1 结构混用**：本文件无 id/parent_id、无 files；若按 battlenet_ui_elements_asia_1 的 id 或 class_name 解析会 KeyError 或逻辑错。
2. **rect 或 automation_id 与 common.py 不同步**：ASIA_LOGIN_PASSWORD_AUTOMATION_IDS、ASIA_LOGIN_SUBMIT_AUTOMATION_IDS、LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA 等若改，本快照与 battlenet 流程查找会错。

### 3.3 正确做法

- 详见技术说明_screenshot_categories与ROSBOT_FIND_LOGIC_LIST及bn_flow_BN_LoginAsia及OCR_CNSTD及kanai_cube_handler.md 第三节、技术说明_test_menu与color_region_detector及bn_flow_BN_LoginAsia及ROSBOT_FLOW_STEP_INDEX.md 第三节；修改 meta 或 controls 前确认消费方；与 battlenet_ui_elements_asia_1 区分两套结构。

---

## 四、d3utils/task_thread_manager.py

### 4.1 职责与约定

- **用途**：**后台任务线程管理**，为 ROSBOT 等任务提供非阻塞 API。**TaskThreadManager**：register_task(name, task_func, interval)、start_task/stop_task/set_task_status/set_task_interval、start_all/stop_all；**所有 public API 非阻塞**（fire-and-forget，_fire 入队、result_q 为 None）；状态读取用 **get_task_status(name)** 从 **_status_snapshot** 取，非直接读 task.status（worker 在 _worker_loop 中 _update_snapshot）。**TaskThread**：daemon 线程，status 为 DISABLED/ENABLED/RUNNING/ERROR；run() 仅当 status==ENABLED 且间隔到时执行 task_func；stop() 仅 set stop_event，不 join。
- **约定**：A2 的 global 1s timer 即 rosbot_task 注册 interval=1.0；不得在 public API 中阻塞（如 get() 等 result）；不得在业务线程直接读 task.status，须用 get_task_status；worker 内串行处理命令，命令与 _update_snapshot 顺序不变。

### 4.2 易被误解或改错的原因

1. **阻塞调用**：若在 register_task/start_task 等后加 result_q.get() 或 join() 会破坏「non-blocking」约定，与 docs/THREAD_BUS_AND_REGISTRY 不符。
2. **跨线程读 task.status**：若在业务代码直接读 self.tasks[name].status 而未通过 get_task_status（_status_snapshot），会存在可见性/竞态。
3. **与 timer_manager 混淆**：timer_manager 为单线程循环（仅 log_monitor 等）；task_thread_manager 为每任务一线程；若在此注册 state detection 或混淆两者会与 system_initializer、FLOW_IMPLEMENTATION_PROGRESS 不符。
4. **interval 与 A2 约定**：rosbot_task 为 1s 驱动，flow master 时 process_task 每 2s 等由 process_task 内部控制；若误改 interval 或在此实现 2s 会与 flow 约定错。

### 4.3 正确做法

- 修改前读 docs/THREAD_BUS_AND_REGISTRY.md 及技术说明_system_initializer与rosbot_task_registry及FLOW_IMPLEMENTATION_PROGRESS及log_panel.md；保持所有 public API 非阻塞；状态仅经 get_task_status 读 _status_snapshot；勿在此注册 state detection；A2 的 1s 由 interval=1.0 保证。

---

## 五、providor/constants/common.py

### 5.1 职责与约定

- **用途**：**通用常量**（无 D3_*、D4_* 前缀）。**_ROOT_PATH** = Path(__file__).resolve().parent.parent.parent = **pyapps/d3-check**；**TMP_DIR** = Path.home()/.core_node/pytools/tmp；LOGIN_TRY_*、BATTLE_NET_*、ASIA_LOGIN_*、BN_FLOW_*、BATTLE_NET_DISCONNECT_KEYWORDS、LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA 等；**BN_FLOW_SNAPSHOTS_DIR** = _ROOT_PATH/.cache/bn_flow_snapshots；DEBUG_SAVE_BN_FLOW_UI_SNAPSHOTS；CMD_*；DEFAULT_INTERVAL 等。
- **约定**：_ROOT_PATH 依赖 __file__ 在 providor/constants/common.py 下共三层 parent，文件移动须同步；TMP_DIR、LOGIN_TRY_SCREENSHOT_DIR 等与 DESIGN_DETAIL、LoginTryScreenshotController 一致；ASIA_LOGIN_*、LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA 与 battlenet_ui_elements_asia_1、bn_flow_BN_LoginAsia 的 automation_id/name 一致；BN_FLOW_SNAPSHOTS_DIR 与 .cache/bn_flow_snapshots 消费者一致；勿在此定义 D3_*、D4_*（属 providor/constants/d4.py）。

### 5.2 易被误解或改错的原因

1. **_ROOT_PATH 层数**：若文件移动或 parent 次数改错，ROOT_DIR、TMP_DIR、BN_FLOW_SNAPSHOTS_DIR、TAMPERMONKEY_SCRIPT_PATH 等全错。
2. **LOGIN_TRY / BATTLE_NET / ASIA_LOGIN 与 DESIGN_DETAIL / 快照不同步**：改关键词或 automation_id 未同步 DESIGN_DETAIL、battlenet_ui_elements_asia_1、bn_flow_BN_LoginAsia 会检测或点击错。
3. **BN_FLOW_SNAPSHOTS_DIR 与 .cache 消费者**：若改为他路径未同步保存/加载快照的代码会找不到文件。
4. **D3_* / D4_* 误放**：若在 common 中定义 D4_* 会与 providor/constants/d4.py 分工冲突。

### 5.3 正确做法

- 修改 _ROOT_PATH 或路径常量时确认所有引用方；修改 LOGIN_TRY_*、BATTLE_NET_*、ASIA_LOGIN_* 时同步 DESIGN_DETAIL、battlenet 快照与 operate_by_spec；D3_*、D4_* 仅放在 d4.py；BN_FLOW_SNAPSHOTS_DIR 与 .cache/bn_flow_snapshots 一致。

---

## 六、五处联动与易错总结

- **battlenet_ui_elements_asia_1.json** 与 **bn_flow_BN_LoginAsia.json** 结构不同（id/parent_id/files vs meta.node/reason），勿混用；两者 automation_id/name 须与 **common.py** ASIA_LOGIN_*、LOGIN_WINDOW_AUTOMATION_ID_MARKERS_ASIA 一致。
- **DESIGN_DETAIL.md** 描述 Login Try 与战网重启流程，所用常量（LOGIN_TRY_*、BATTLE_NET_DISCONNECT_KEYWORDS、battlenet_path）来自 **common.py** 或 config；改 common 或实现须同步 DESIGN_DETAIL。
- **task_thread_manager.py** 为 A2 的 1s 驱动提供线程与非阻塞 API；与 timer_manager 双驱动，勿混淆；get_task_status 读 _status_snapshot，勿跨线程直读 task.status。
- **common.py** 为五处常量之源：_ROOT_PATH、TMP_DIR、BN_FLOW_SNAPSHOTS_DIR、LOGIN_TRY_*、BATTLE_NET_*、ASIA_LOGIN_*；改任一项须检查 DESIGN_DETAIL、battlenet 快照、task_thread_manager 注册间隔与文档。

此前若因未先通读上述约定而在此五处反复改错或理解偏差，责任在狗B 垃圾 Cursor。后续修改前以本说明为准。
