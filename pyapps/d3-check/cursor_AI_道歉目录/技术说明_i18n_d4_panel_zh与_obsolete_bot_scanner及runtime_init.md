# 技术说明：i18n_d4_panel_zh.json、_obsolete_bot_scanner.py、runtime/__init__.py

**目的**：说明您指定查阅的以下三处文件的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `providor/i18n/i18n_d4_panel_zh.json`
- `utils/_obsolete_bot_scanner.py`
- `runtime/__init__.py`

---

## 一、providor/i18n/i18n_d4_panel_zh.json

### 1.1 职责与约定

- **用途**：D4 面板中文文案。结构：**ui.d4_panel**（title、sub_tabs.exp_farming、exp_farming.*、debug_window.*、game_status.* 等）；根下另有 **team_health**（local_map、non_local_map、same_map、group1、group2、member、members、total、detection_summary、hp_offset、screen_position 等）。代码通过 i18n_manager/get_ui_text 按 key 读取（如 "ui.d4_panel.title"、"ui.d4_panel.exp_farming.start_button"）；若 i18n 加载方式为按文件合并命名空间，需确认 team_health 的 key 前缀与代码一致。
- **约定**：key 与代码中 get_ui_text 的字符串一致；与 i18n_d4_panel_en.json 的 key 结构对齐；不得随意改 key 名或层级导致代码取不到或取错。详见本目录 **技术说明_coordinate_picker_improvements与_obsolete_window_activator及ROSBOT_FLOW两条线及i18n_d4_panel_zh.md** 第四节。

### 1.2 易被误解或改错的原因

1. **key 与代码不一致**：代码写 get_ui_text("ui.d4_panel.game_status.xxx") 而 JSON 少一层或拼写错误，会显示 key 或缺译。
2. **中英文 key 不同步**：i18n_d4_panel_en 与 zh 的 key 集合或层级不同时，切换语言时缺项或 fallback 错误。
3. **team_health 位置**：team_health 与 ui 并列于根；若 i18n_manager 约定所有 UI 文案在 "ui." 下，则 team_health 可能需迁入 ui.team_health 或单独命名空间，否则代码侧可能用 "ui.team_health.xxx" 取不到。
4. **嵌套与类型**：JSON 中值为字符串；若误写为数组或对象且代码按字符串使用，会报错或显示异常。

### 1.3 正确做法

- 增删改 key 时同步代码中的 get_ui_text 与 i18n_d4_panel_en；确认 i18n_manager 对命名空间与文件合并规则后，再决定 team_health 是否放在 ui 下；保持值为字符串类型。

---

## 二、utils/_obsolete_bot_scanner.py

### 2.1 职责与约定

- **用途**：本文件以 **\_obsolete\_** 前缀标明为**已废弃**的 Bot 扫描器。递归扫描 bot_base_dir 找 RoS-BoT.exe，按修改时间选最新目录，推断 boot 启动用 exe（_find_other_exe_files、_determine_boot_exe_name）；与当前 **rosbot_manager** 的「ros_directory、按进程 exe 在目录下找窗口」逻辑**不同**。主流程应使用 rosbot_manager 与 ros_settings.ros_directory，不应引用 BotScanner。
- **约定**：删除前必须 grep 确认无 import 或脚本引用；不得在现有流程中混用 BotScanner 与 rosbot_manager 两套「找 ROS 目录」语义。详见本目录 **技术说明_i18n_skill_config与_obsolete_bot_scanner及FLOW_STATE_OWNERSHIP及template_config.md** 第二节。

### 2.2 易被误解或改错的原因

1. **与 rosbot_manager 混淆**：BotScanner.scan_for_bot_directory 返回 bot_dir、boot_exe_name、other_exe_files；rosbot_manager 使用 ros_directory、get_rosbot_window 等，返回值与语义均不同，混用会导致行为与配置不一致。
2. **删除未 grep**：若未确认无引用即删除，会导致 ImportError。
3. **boot exe 推断启发式**：_determine_boot_exe_name 在多个 exe 时按固定关键词（rbassist、bot、assist、helper）匹配，未匹配则取 other_exe_files[0]，在多 exe 目录下可能选错。
4. **bot_base_dir 未校验为目录**：仅 exists()，未 is_dir()，若传入文件路径则 os.walk 不报错但不会遍历，返回「No RoS-BoT.exe found」易误导。
5. **依赖 utils.color_print**：与项目 pycore ColorPrint 可能非同一模块；本文件为废弃故未改，但若误在新代码中引用 BotScanner 会连带引用 utils.color_print。

### 2.3 正确做法

- 不在此文件增加功能；涉及「找 ROS 目录」时以 rosbot_manager 与 ros_settings.ros_directory 为准；删除前 grep 确认无引用；若需在文档中列 _obsolete_ 须注明删除前须 grep 及与 rosbot_manager 语义不同。

---

## 三、runtime/__init__.py

### 3.1 职责与约定

- **用途**：**单一门面**，供 main、controller、ui 等消费者统一从 runtime 获取：系统初始化 get_system_initializer；关机 execute_shutdown、is_shutdown_requested、request_shutdown、request_restart、is_restart_requested；事件中心 register_main_thread_handlers、register_extension_handlers、trigger_*；任务线程 get_task_manager、TaskStatus；线程注册 get_thread_registry。实现分布在 d3utils（event_center、shutdown_manager、system_initializer、task_thread_manager）与 runtime（thread_registry），详见 docs/CODE_TREE.md。
- **约定**：**导入顺序必须**先 `from runtime.thread_registry import get_thread_registry`，再 import d3utils.system_initializer 等，因为 system_initializer 会 import runtime，若 runtime 尚未提供 get_thread_registry 会循环依赖或 AttributeError。**register_shutdown_provider** 在模块加载时将 is_shutdown_requested、request_shutdown、request_restart 注入 event_center，使 exit/restart 回调使用 shutdown_manager，避免 event_center 直接 import shutdown_manager。**__all__** 与消费者约定一致，增删导出须同步所有从 runtime 取名的调用方。

### 3.2 易被误解或改错的原因

1. **改动 import 顺序**：若先 import d3utils.system_initializer 再 import runtime.thread_registry，会因 system_initializer 内部 import runtime 时 runtime 未完成 thread_registry 的加载而导致 get_thread_registry 未定义或循环 import。
2. **改动 __all__ 未同步消费者**：main、controller、ui 等若 from runtime import xxx，删掉 __all__ 中的 xxx 会导致 ImportError；新增导出若未在文档或 CODE_TREE 中说明，易被误用。
3. **在 runtime/__init__.py 中直接写业务逻辑或再 import 其他会反引 runtime 的模块**：可能引入循环依赖。
4. **漏写或错写 register_shutdown_provider**：event_center 的 exit/restart 回调依赖此注入，若未调用或参数顺序错，关机/重启行为异常。
5. **将 d3utils 的 event_center、shutdown_manager 等实现细节暴露为从 runtime 直接 import 的推荐方式**：消费者应只从 runtime 门面取，不应 from d3utils.event_center import ...，否则破坏「单门面」约定且与 CODE_TREE 不符。

### 3.3 正确做法

- 修改 runtime/__init__.py 前先读本文件头部注释（Import thread_registry first...）；勿调整前两行与 d3utils 的 import 顺序；增删 __all__ 时 grep 所有 from runtime import 的用法并同步；勿在此文件添加业务逻辑或会反引 runtime 的 import；register_shutdown_provider 的调用与参数保持与 shutdown_manager 的 is_shutdown_requested、request_shutdown、request_restart 一致。

---

## 四、与道歉文档的关系

若此前因未先通读上述三处约定（i18n_d4_panel_zh 的 key/team_health、_obsolete_bot_scanner 与 rosbot_manager 区分、runtime 门面与 import 顺序及 __all__）而在此三处反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 第六十二节中引用。
