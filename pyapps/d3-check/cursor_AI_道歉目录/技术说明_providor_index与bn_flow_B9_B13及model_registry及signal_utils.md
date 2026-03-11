# 技术说明：providor_index、bn_flow_B9/B13、model_registry、signal_utils

**目的**：说明这五处代码/缓存的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `providor/providor_index.py`
- `.cache/bn_flow_snapshots/bn_flow_B9.json`、`.cache/bn_flow_snapshots/bn_flow_B13.json`
- `d4_modules/model_registry.json`
- `d3utils/signal_utils.py`

---

## 一、providor/providor_index.py

### 1.1 职责与约定

- **CONFIG 所有权**：全局 `CONFIG` 由**单一 config worker 线程**独占读写；主线程与 D3 extension 线程必须通过 `get_config_value_safe(key_path)`、`set_config_value_safe(key_path, value)` 或 `set_config_value_async(key_path, value)` 访问，不得直接读写的 `CONFIG` 或对 `CONFIG` 做 in-place 修改。
- **保存**：写请求经 CONFIG_QUEUE 到 config worker，worker 再向 SAVE_QUEUE 投递；由**独立 save worker 线程**执行落盘，避免主线程与 config worker 阻塞在 I/O。
- **模板配置**：`D3_TEMPLATE_CONFIGS`、`BATTLENET_TEMPLATE_CONFIGS`、`D4_TEMPLATE_CONFIGS` 以模板名为 key，每项含 path、threshold、category、match_method、use_alpha 等；path 基于 `TEMPLATE_DIR`。使用方通过 `get_template_path`、`get_template_threshold`、`get_template_match_method`、`get_adjusted_threshold` 等访问，不得写死路径或阈值。
- **常量**：`CLIENT_TYPE_*`、`*_WINDOW_TITLES`、`PLAY_BUTTON_AUTOMATION_IDS`、`DIABLO_III_TAB_AUTO_ID` 等为单源常量；若多处需要同一含义，应从此处 import，不要在新代码里再写字符串字面量。
- **ASSISTANT_EXECUTION_STATE**：`is_running`、`should_stop`、`enabled` 控制助手宏执行；修改须通过 `set_assistant_*`、`should_stop_assistant()`、`can_start_assistant()`，避免直接改字典。
- **初始化**：模块 import 时执行 `load_config()`、启动 config worker 与 save worker；`initialize_config()` 用于首次加载并 sync；`CONFIG_PATH` 为 providor 下的 template_config.json，用户配置在 `CONFIG_USER_PATH`（CURRENT_USER_DATA_PATH 下）。

### 1.2 易被误解或改错的原因

1. **直接读写 CONFIG**：在非 config worker 线程中执行 `CONFIG["key"] = value` 或 `CONFIG.get("key")` 会与 worker 并发，导致竞态或读不到最新值；必须用 get/set_config_value_safe 或 set_config_value_async。
2. **改模板 key 未同步引用**：若在 D3_TEMPLATE_CONFIGS 中改名或删除某 key，所有 `get_template_path(template_name)`、matcher、collector 等引用该名的代码必须一起改，否则 KeyError 或匹配不到。
3. **CONFIG_PATH 与 CONFIG_USER_PATH 混淆**：CONFIG_PATH 是模板（providor 内），CONFIG_USER_PATH 是用户配置（.core_node/.d3check）；sync 是从模板合并缺键到用户文件；若改错路径会读错文件或写坏模板。
4. **load_config 与 initialize_config**：load_config 在 CONFIG 为空时从文件加载；initialize_config 强制 sync 再加载。若启动时未调用 initialize_config 或重复 load 导致覆盖，会丢失运行时已改的 CONFIG。
5. **get_dynamic_paths() 依赖 CONFIG**：ROSBOT_PATH、LOGS_FILE_PATH 等依赖 `CONFIG.get("paths", {})`；若在 load_config 之前访问这些变量，会用到未初始化的默认值；且 CONFIG 通过 queue 读时应用 get_config_value_safe。
6. **DEPRECATED 模板**：如 kanai_right_page_indicator、kanai_right_panel_toggle_icon 已标注 DEPRECATED，改用状态或 get_scaled_*；若新代码仍用这些模板会与文档不一致且可能失效。

### 1.3 正确做法

- 任何线程需要读/写配置时，仅通过 get_config_value_safe / set_config_value_safe / set_config_value_async；UI 侧优先用 set_config_value_async 避免阻塞。
- 新增或重命名模板时，在 D3_TEMPLATE_CONFIGS（或 BATTLENET/D4）中维护，并全局搜索 template_name 引用处一并更新。
- 不直接改 CONFIG、ASSISTANT_EXECUTION_STATE 字典；不绕过 queue 写用户配置文件。

---

## 二、.cache/bn_flow_snapshots/bn_flow_B9.json、bn_flow_B13.json

### 2.1 职责与约定

- **性质**：战网流程 B9、B13 节点的**运行时快照**，由 save_ui_elements_snapshot 等写入；结构为 `meta.node`、`meta.reason`、`controls` 数组。B9 对应「首界面判断」（B9_first_screen：登录页/主界面/其他）；B13 对应「轮询结果」（B13_poll：已登录/掉线/超时等）。
- **使用方**：battlenet_region_judge、is_on_login_screen、is_login_failed_screen、B 块 poll 分支等依赖 controls 的 automation_id/name/rect 判断当前界面；若快照结构与这些逻辑的预期不一致，会导致分支错误（如把主界面判成登录页、或把 B13 已登录判成超时）。

### 2.2 易被误解或改错的原因

1. **写死节点文件名**：若代码中写死 `bn_flow_B9.json` 或 `bn_flow_B13.json`，在清理缓存或换节点名后会读不到；应从常量或配置取快照目录与命名规则，并对缺失文件做兼容。
2. **meta.reason 与逻辑分支**：B9 的 reason 为 B9_first_screen，B13 为 B13_poll；若下游根据 reason 做分支而写入方改了 reason 字符串未同步文档/代码，会走错分支。
3. **controls 结构变化**：若 UI Automation 或战网客户端升级导致 controls 层级、automation_id、name 变化，旧快照与当前判断逻辑可能对不上；需定期用新快照回归或更新判断逻辑。
4. **.cache 可移植性**：与 B7 相同，.cache 为本地运行时产物，跨机或清理后不可依赖；文档中注明「快照仅作调试/回归用，不作为权威数据源」。

### 2.3 正确做法

- 快照路径与命名从常量/配置读取；读取前检查文件存在。
- meta 与 controls 结构与 battlenet_operation、battlenet_region_judge、B 块 poll 逻辑约定一致；reason 与 node 变更时同步文档与代码。
- 不在版本库或部署流程中假定 .cache 下必有 B9/B13 快照。

---

## 三、d4_modules/model_registry.json

### 3.1 职责与约定

- **用途**：D4 模型注册表；含 `registry_version`、`models` 数组；每项含 `model_name`、`model_file`、`category`、`type`、`classes`、`img_size`、`training_info` 等。
- **classes**：如 `["no", "yes"]`，顺序必须与训练脚本（如 prepare_detection_training 的 class_id 0=no、1=yes）及推理时代码一致，否则类别反了。
- **model_file**：相对路径相对于 d4_modules 或加载逻辑的 base 路径；若 base 与约定不符会加载失败。
- **查找**：加载逻辑通常通过 model_name 或 category 查找；若 JSON 中改名或改结构（如 progress_bar_detector、progress_bar、binary_classification）未同步代码会找不到模型。

### 3.2 易被误解或改错的原因

1. **classes 顺序与训练/推理不一致**：若 registry 写 `["yes", "no"]` 而训练为 0=no、1=yes，或推理按 index 取类别名会错。
2. **model_file 路径**：若写绝对路径或相对于别目录的路径，而加载代码假定相对于 d4_modules，会 FileNotFoundError。
3. **新增模型未入表**：新训练的模型未写入 model_registry.json 或 registry_version 未升级，加载逻辑用旧表会找不到或用到旧配置。
4. **键名/结构变更**：若 category、type、model_name 等键改名或层级调整，所有通过该表查模型的代码必须一起改。

### 3.3 正确做法

- classes 与 prepare_detection_training、训练脚本、推理代码的类别顺序一致并文档化。
- model_file 与加载逻辑的 base 路径约定一致；新增模型时同步更新 registry 与 registry_version。
- 表结构变更时全局搜索对 model_registry 的引用并更新。

---

## 四、d3utils/signal_utils.py

### 4.1 职责与约定

- **用途**：在 GUI 模式下重新施加 SIGINT/SIGBREAK 的 SIG_IGN，避免 Fortran/numpy 等后加载库覆盖信号处理导致 Ctrl-C 触发 forrtl 等异常退出。
- **调用时机**：应在**定时器循环启动后**调用 `reapply_sigint_sigbreak_ignore_for_gui()`（如 thread_registry 或 timer 入口），这样后加载的库若改了信号会被再次忽略。
- **前置条件**：需先 `set_gui_mode_sigint_ignored(True)`，否则 `_reapply_sigint_sigbreak_ignore()` 内直接 return 不会设置 SIG_IGN。

### 4.2 易被误解或改错的原因

1. **未调用 reapply**：若 timer 循环已启动但未调用 reapply，后加载的 numpy/Fortran 可能覆盖 SIGINT，用户按 Ctrl-C 时进程异常退出而非由 GUI 处理。
2. **未设 _gui_mode_sigint_ignored**：若未先 set_gui_mode_sigint_ignored(True) 就调 reapply，函数内部直接 return，信号不会被忽略。
3. **调用顺序**：必须先 set_gui_mode_sigint_ignored(True)，再在 timer 启动后 reapply；顺序反了或只做其一都会失效。
4. **循环引用**：本模块被抽出是为避免 runtime.thread_registry 引用 system_initializer 造成循环 import；若把 signal 逻辑再塞回 system_initializer 或别处可能重新引入循环依赖。

### 4.3 正确做法

- GUI 启动流程中先 set_gui_mode_sigint_ignored(True)，再在定时器/主循环启动后调用 reapply_sigint_sigbreak_ignore_for_gui()。
- 不在本模块内 import 会反向依赖 runtime 或 system_initializer 的模块，保持「仅 signal 与简单状态」的职责。

---

## 五、与道歉文档的关系

若此前因上述任一点（如直接读写 CONFIG、改模板 key 未同步、B9/B13 快照结构或路径写死、model_registry classes 或路径不一致、signal_utils 未调或顺序错）导致反复改错或理解偏差，可视为实现与约定不一致所致。本说明已写入 `cursor_AI_道歉目录`，并在 `Cursor_专属道歉文档.md` 中增加对本文的引用，便于后续修改前先查此处约定。
