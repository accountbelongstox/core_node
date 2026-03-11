# 技术说明：i18n_skill_config_en.json、_obsolete_bot_scanner.py、FLOW_STATE_OWNERSHIP_DESIGN.md、template_config.json

**目的**：说明您指定查阅的以下四处文件/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `providor/i18n/i18n_skill_config_en.json`
- `utils/_obsolete_bot_scanner.py`
- `docs/FLOW_STATE_OWNERSHIP_DESIGN.md`
- `providor/template_config.json`

---

## 一、providor/i18n/i18n_skill_config_en.json

### 1.1 职责与约定

- **用途**：技能配置相关 UI 文案的英文 i18n 键值；与 main_functions_panel 的 strategy 显示、combobox 选项、skill_table 表头等对应。键路径含 ui.skill_config.strategies.continuous/single/hold/drag/disabled/buff、ui.main_functions_panel.*、ui.skill_table.*、ui.skill_config_list.strategy_options 等。
- **约定**：策略存盘用**英文键** continuous/single/hold；显示用本文件中的文案（如 "Continuous"/"Single"/"Hold"）。main_functions_panel 内 strategy_en_to_zh / strategy_zh_to_en 由 i18n 填充；若本文件改 key 或增删键未与代码中 get_ui_text 的键一致，会显示 key 或错文案；若把「显示文案」当存盘值写入 CONFIG 会导致 MacroLoopThread 用 sk_cfg.get('strategy') == 'continuous' 判断失败。

### 1.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 可能改 i18n key 名称或层级未与 main_functions_panel、ConfigBinding.create_combobox_binding 的 config_key 及 strategy 存盘约定同步，导致界面显示 key 或策略判断错。
2. 新增或删除 strategy 选项时未同时改本文件与 main_functions_panel 的 strategy_en_to_zh/strategy_zh_to_en 及 CONFIG 存盘值（英文键），会导致语言切换或存盘错。
3. 与 i18n_skill_config_zh.json 键结构须一致，仅 value 为不同语言；若只改 en 未改 zh 会中英键不一致。

### 1.3 正确做法

- 修改前通读 main_functions_panel 中 strategy 的读写与 i18n 键使用处；存盘一律用英文键 continuous/single/hold；i18n 键与 get_ui_text 调用处一致；en/zh 两文件键结构保持一致。

---

## 二、utils/_obsolete_bot_scanner.py

### 2.1 职责与约定

- **用途**：**已废弃模块**（_obsolete_ 前缀）。递归扫描 bot_base_dir 查找 RoS-BoT.exe，返回 bot_dir、boot_exe_name、other_exe_files；使用 utils.color_print（非 pycore ColorPrint）。与 **rosbot_manager** 的「ros_directory、按进程 exe 在目录下找窗口」逻辑**不同**：本文件为「用户指定目录递归找 RoS-BoT.exe」，rosbot_manager 为「配置的 ROS 目录 + 进程检测」。
- **约定**：不应被新代码或现有流程引用；若 code_reuse_analysis 或文档列 _obsolete_ 可含本文件，删除前须 grep 确认无脚本或 import 引用，否则 ImportError；误引用会混用两套「找 ROS 目录」语义。

### 2.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 可能将本文件与 rosbot_manager 的 get_rosbot_window、ros_directory 逻辑混淆，在流程中误用 BotScanner.scan_for_bot_directory 导致行为与「按配置目录+进程找窗口」不一致。
2. 删除本文件前未 grep 导致仍有脚本或测试引用则 ImportError。
3. 在本文件内加功能或当主入口使用，与「已废弃、替代方案为 rosbot_manager/ros_directory」相违。

### 2.3 正确做法

- 新代码不引用；删除前 grep 确认无引用；若需「找 ROS 目录」语义以 rosbot_manager 与配置 ros_settings.ros_directory 为准。详见技术说明_path_scanner与rosbot_status_provider等（若已存在）及 code_reuse_analysis。

---

## 三、docs/FLOW_STATE_OWNERSHIP_DESIGN.md

### 3.1 职责与约定

- **用途**：流程状态所有权设计方案。**流程类库**定义并持有 flow_master_enabled、bn_only_enabled 及步骤/节点状态；**其他类库**（provider、BN 流步骤、F0/F3/F4、extension_flow 等）不持有、不读取流程开关做分支判断；仅通过**返回值**表达结果；**Tick 只驱动流程类库**（process_task 每 2s 步）；game_interface_data.rosbot_flow_master_enabled / ensure_battlenet_only_master_enabled 仅由流程类库在 set 时写入，用于回调和 UI 展示，分支判断不依赖这两项（统一用 flow_state 的 get）。
- **约定**：面板通过 set_flow_master_enabled()/set_bn_only_enabled() 写；process_task、check_window、BN 流通过 get_flow_master_enabled()/get_bn_only_enabled() 读；被调用方（battlenet_status_provider、d3_status_provider、rosbot_flow_battlenet、extension_flow_tick_step 等）不读 flow_master/bn_only 做分支；流程根据返回值更新步骤。

### 3.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 可能在 provider 或 BN 流内自读 flow_master/bn_only 做分支，破坏「单源真相、仅流程类库读写」。
2. 在非流程类库处写 game_interface_data.rosbot_flow_master_enabled 或 ensure_battlenet_only_master_enabled，导致与文档「仅流程类库在 set 时写入」不一致。
3. 改 process_task 的 2s 步逻辑或 tick 驱动链未对照本文档，导致与 ENSURE_BATTLENET_ONLY_TICK_FLOW 或代码位置速查表不一致。

### 3.3 正确做法

- 修改流程或状态前通读本文档；所有流程开关读写经 flow_state；被调用方只返回明确结果；与 d3utils/rosbot_flow_state.py、flow_bn_only.py、rosbot_task_processor.process_task、rosbot_extension_panel 一致。

---

## 四、providor/template_config.json

### 4.1 职责与约定

- **用途**：配置模板与默认值；含 ui_settings、log_settings、ros_settings、macro_configs（current_skill_config、skill_configs.config1～4、auxiliary_config 下 blood_shard、quick_pickup、assistant_hotkey 等）、battlenet、d3、paths 等。CONFIG 加载时可能以本模板补齐缺失键；面板控件的 config_key 与 template 中路径一致（如 macro_configs.auxiliary_config.blood_shard.enabled、macro_configs.auxiliary_config.assistant_hotkey）。
- **约定**：config_key 与 CONFIG 读写路径、本文件结构须一致；新增或删除自动化项时须同步改 template 与 CONFIG 访问路径；strategy 在 skill_configs 中为英文 continuous/single/hold；恢复默认时可从 template 取默认值写回 CONFIG。

### 4.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 可能改 template 中键路径或增删节点未与代码中 CONFIG 访问路径（如 macro_configs.auxiliary_config.xxx）同步，导致 KeyError 或存错位置。
2. 在 template 中改 strategy 可选值或 blood_shard.count/type 等结构未与 main_functions_panel、自动化项 config_key 同步，导致 UI 绑定错或默认值错。
3. ros_settings 下 tab_item_names、profile_combobox_text、sequence_combobox_names 等为 _obsolete_ UI 自动化相关，若与 _obsolete_ui_automation_controller 混用或误当当前方案使用会错。

### 4.3 正确做法

- 修改 template 前通读 CONFIG 使用处（主功能面板、自动化项、热键绑定）；config_key 与 template 路径一一对应；新增/删除项时同步 template 与代码；与 i18n_skill_config 的 strategy 英文键一致。

---

**修改前请先通读本说明。** 此前若因未先通读上述约定而在 i18n_skill_config_en、_obsolete_bot_scanner、FLOW_STATE_OWNERSHIP_DESIGN、template_config 四处反复改错或理解偏差，责任在狗B 垃圾 Cursor。后续修改前以本说明为准，避免同类错误。
