# 技术说明：i18n_config.json、pathfinding_controller.py、ui/widgets/__init__.py、d4_modules/README.md

**目的**：说明您指定查阅的以下四处文件/文档的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `providor/i18n_config.json`
- `controller/pathfinding_controller.py`
- `ui/widgets/__init__.py`
- `d4_modules/README.md`

---

## 一、providor/i18n_config.json

### 1.1 职责与约定

- **用途**：D3-Check 主 i18n 配置；含 description、default_language、supported_languages、translations.zh / translations.en。translations 下为嵌套键：ui.main_window、tabs、skill_config、skill_config.strategies（continuous/single/hold/drag/disabled/buff）、skill_table、auxiliary_functions、coord_calibration、coord_picker 等。与 get_ui_text 查找路径、main_functions_panel 的 strategy 存盘（英文 continuous/single/hold）须一致。
- **约定**：zh 与 en 的键结构须一一对应；新增或删除键时须同时改 zh 与 en，且与 get_ui_text 调用处、CONFIG/strategy 存盘键同步。strategies 下键名与 i18n_skill_config_en/zh、MacroLoopThread 策略判断一致。

### 1.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 若只改 zh 或只改 en、或改键名未与 get_ui_text、main_functions_panel、strategy 存盘同步，会导致界面显示 key 或策略判断错。
2. 若在 ui.skill_config、skill_table、strategies 等处增删键而未与 main_functions_panel 的 ConfigBinding、combobox 选项来源、i18n_skill_config_zh/en 对照，会显示错或存盘错。
3. 若将 coord_calibration、coord_picker、log_panel、rosbot 等区块键名或层级改掉而未与对应面板的 get_ui_text 调用路径同步，会显示 key。

### 1.3 正确做法

- 修改前通读 i18n_manager、get_ui_text 的查找逻辑及 main_functions_panel、strategy 存盘所用键；增删键时 zh/en 双文件同步，并全文检索 get_ui_text 的键路径；与技术说明_i18n_skill_config与_obsolete_bot_scanner及FLOW_STATE_OWNERSHIP及template_config 中 i18n 约定一致。

---

## 二、controller/pathfinding_controller.py

### 2.1 职责与约定

- **用途**：寻路/找 NPC 控制器；网格截图+OCR 找目标文案（如「附魔」/Enchanter）。路径约定：__file__ 为 controller/pathfinding_controller.py，故 os.path.dirname(os.path.dirname(__file__)) 为项目根（pyapps/d3-check）；d3utils_path = 项目根/d3utils，controller_path = 项目根，并 sys.path.insert。依赖 DIABLO_III_WINDOW_TITLES（providor_index）、TMP_DIR（providor.constants.common）、get_grid_config()（config.grid_config）、GridScreenshotCollector、get_state_aware_click_handler。
- **约定**：get_cell_center_position、capture_grid_cell 传 window_titles=DIABLO_III_WINDOW_TITLES、use_cache=True；网格行列来自 get_grid_config() 的 rows/cols；输出为 TMP_DIR / pathfinding_result_{timestamp}.txt。若 D3 窗口标题单源改为 get_d3_manager().get_capture_titles() 则须与 d3_manager 约定一致，不可仅在此处改标题来源而它处仍用 DIABLO_III_WINDOW_TITLES。

### 2.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 若误改 parent 次数（如把 d3utils_path 算成 controller 下某层），会导致 import d3utils 失败或导错包。
2. 若将 window_titles 改为别源而未与 get_d3_manager().get_capture_titles()、DIABLO_III_WINDOW_TITLES 单源约定同步，会与 coordinate_calibration_panel、screenshot_provider 等不一致。
3. 若改 get_grid_config() 的 rows/cols 或 GridScreenshotCollector 的网格语义而未与 config.grid_config、GridScreenshotCollector 实现对照，会网格错或截图错。

### 2.3 正确做法

- 修改路径前确认 __file__ 在 controller/ 下且 parent.parent 为项目根；修改 window_titles 或网格配置前读 d3_manager、DIABLO_III_WINDOW_TITLES、config.grid_config、GridScreenshotCollector 约定；TMP_DIR 与 providor 常量一致。

---

## 三、ui/widgets/__init__.py

### 3.1 职责与约定

- **用途**：UI 控件包入口；导出 ThemedLabel、ThemedButton、ThemedFrame、ThemedLabelFrame、ThemedEntry、ThemedText、ThemedCheckbutton、ThemedCombobox、ThemedScrollbar、HotkeyInput。注释明确：LanguageCombobox is now replaced by ConfigBinding.create_combobox_binding()；__all__ 中不导出 LanguageCombobox。
- **约定**：新增控件须加入 __all__ 且从对应子模块 from；不得重新导出 LanguageCombobox 或推荐用 ThemedCombobox 做配置绑定，以免与 ConfigBinding 方案冲突。与专属道歉文档第四十五节、技术说明_interactive_menu与combobox及code_reuse_analysis 一致。

### 3.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 若在 __all__ 中重新加入 LanguageCombobox 或推荐用 ThemedCombobox 做语言/配置绑定，会与「配置绑定用 ConfigBinding.create_combobox_binding」冲突。
2. 若新增 widget 未同步更新 __all__ 或子模块 import，会导致 from ui.widgets import 新控件 失败或导出与实现不一致。
3. 若删除注释「LanguageCombobox is now replaced by ConfigBinding...」，会导致后续维护者误用 LanguageCombobox 做配置绑定。

### 3.3 正确做法

- 修改 __all__ 或 export 前读本文件注释及 ConfigBinding 使用处；新增控件时同步 from 与 __all__；不恢复 LanguageCombobox 导出；与 combobox、main_functions_panel 的 ConfigBinding 用法一致。

---

## 四、d4_modules/README.md

### 4.1 职责与约定

- **用途**：d4_modules 目录说明：model_registry.json、训练好的 .pt/.json、训练流程。文档中训练数据路径为 .cache/training_data/source/（progress_bar/yes|no），训练脚本为 train_all.py、train_progressbar.py，验证为 validate_models.py，输出到 .core_node/pytools/tmp/model_validation/。
- **约定**：若项目实际训练数据路径为 .cache/training_data/1_sources/projects（与 simple_training_controller 一致），则 README 中 source/ 与 1_sources/projects 须在文档中注明或统一，避免按 README 放数据却与 simple_training_controller 的 source_base_dir 不一致。model_registry.json 的 models 数组、model_file、category、img_size 等与代码加载逻辑须一致。

### 4.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 若按 README 的 .cache/training_data/source/ 改 simple_training_controller 的 source_base_dir，会与当前 1_sources/projects 及 metadata.json 约定不符；或只改 README 未改代码导致文档与实现脱节。
2. 若改 model_registry 结构或字段名而未与加载 model_registry.json 的代码、YOLO 加载路径对照，会 KeyError 或加载错。
3. 若 validate_models 输出路径或 train_all/train_progressbar 的扫描路径与文档不一致而未同步更新 README，会误导使用者。

### 4.3 正确做法

- 修改 README 中路径或流程前与 simple_training_controller、.cache/training_data 实际结构、model_registry 加载代码对照；训练数据路径若为 1_sources/projects 须在 README 中写明并与 simple_training_controller 一致；model_registry 结构变更须与代码同步。

---

**修改前请先通读本说明。** 此前若因未先通读上述约定而在 i18n_config、pathfinding_controller、ui/widgets/__init__.py、d4_modules/README 四处反复改错或理解偏差，责任在狗B 垃圾 Cursor。后续修改前以本说明为准，避免同类错误。
