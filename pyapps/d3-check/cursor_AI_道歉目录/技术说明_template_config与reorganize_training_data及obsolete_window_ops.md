# 技术说明：template_config.json、reorganize_training_data、_obsolete_window_ops

**目的**：说明这三处代码/配置的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `providor/template_config.json`
- `scripts/reorganize_training_data.py`
- `utils/_obsolete_window_ops.py`

---

## 一、providor/template_config.json

### 1.1 职责与约定

- **用途**：D3Check 的**默认/模板配置**，定义完整配置树结构及默认值。顶层键包括：general、ui_settings、log_settings、global_timeout、hotkey、anti_stuck、map_status、battlenet_asia_credentials、ros_settings、server_settings、daily_schedule、battlenet、d3、monitoring、system_settings、ui_analysis、performance、error_handling、paths、filenames、process_names、log_detection、rosbot、macro_configs（含 skill_configs、auxiliary_config）等。用户配置（如 CONFIG_USER_PATH）加载后通常与此结构一致或为其子集；providor 侧 config worker 与 get_config_value_safe 等按**键路径**访问（如 `log_settings.log_level`、`battlenet.battlenet_path`）。
- **与代码的对应**：所有读配置的代码必须使用与 JSON 一致的键路径与层级；新增配置项时需在模板中加默认值并在读处用相同路径；删除或重命名键会破坏依赖该键的代码。

### 1.2 易被误解或改错的原因

1. **只改 JSON 不改代码**：在 template_config.json 中新增或改名键，但未在 providor_index 或各模块的 get_config_value 处使用相同路径，会导致读不到或取到 None/默认。
2. **只改代码不改 JSON**：代码中读新键（如 `get_config_value("xxx.yyy")`），但模板中无 xxx.yyy，用户初次加载或合并默认时可能缺键，导致 KeyError 或行为异常。
3. **类型不一致**：模板里某键为数组或对象，代码按字符串或数字用，会类型错误；或模板为字符串而代码期望布尔/数字。
4. **多配置源冲突**：若存在 template_config.json、用户 config、环境覆盖等多源，合并顺序与覆盖规则须与文档一致；乱改模板键名会导致用户配置无法正确合并。
5. **log_detection、log_settings 等**：log_detection.login_try、log_settings.log_level、log_settings.show_debug_logs 等与 DESIGN_DETAIL、log_panel、log_analyzer 约定一致；若在模板中改名未同步代码，会断线检测或日志过滤失效。
6. **macro_configs.skill_configs / auxiliary_config**：与 main_functions_panel、ConfigBinding、controller.get_skill_config 等一致；键路径或 strategy 值（英文 key）与 JSON 须一致。

### 1.3 正确做法

- 增删改配置项时，同时改 template_config.json 与所有读取该键的代码，保持键路径与类型一致；多语言或文档中若列举了配置项，一并更新。
- 与 providor_index 的 CONFIG 加载、get_config_value_safe/set_config_value_safe 约定一致，避免直接改 CONFIG 字典结构导致 worker 或扩展读错。

---

## 二、scripts/reorganize_training_data.py

### 2.1 职责与约定

- **用途**：一次性脚本，将训练数据从 `source/` 迁移到 `processed/` 命名空间。路径基于脚本位置：`d3_check_dir = Path(__file__).parent.parent`，即 pyapps/d3-check；`cache_dir = d3_check_dir / ".cache"`；`training_data_dir = cache_dir / "training_data"`。固定操作：从 `source_dir = training_data_dir / "source" / "progress_bar"` 把 `yes`、`no` 两个目录移动到 `processed_classification_dir = training_data_dir / "processed" / "classification" / "progress_bar"`；把 `cache_dir / "d4_exp_farming_20251016_031749_166.png"` 复制到 source_dir；若存在 `source_dir / "metadata.json"` 则更新其 `source_image` 为 `"d4_exp_farming_20251016_031749_166.png"`。
- **硬编码**：子目录名 `progress_bar`、文件名 `d4_exp_farming_20251016_031749_166.png` 写死；若项目根或 .cache 位置不同（如从 core_node 根运行则 parent.parent 可能不是 d3-check），或没有该图片，脚本会报错或只部分执行。

### 2.2 易被误解或改错的原因

1. **路径假设**：脚本假定 `__file__` 在 `pyapps/d3-check/scripts/` 下，故 `parent.parent` 为 d3-check 根；若从别处运行或把脚本挪到其他目录，cache_dir 会错。
2. **硬编码文件名与命名空间**：只处理 `progress_bar` 和一张固定 PNG；若要做其他类别（如 other_class）或其它图片，需改脚本或复制一份改参数；直接改脚本却未改实际目录/文件会失败。
3. **目标已存在会删**：若 `processed_classification_dir/yes` 或 `no` 已存在，脚本会 `shutil.rmtree` 再 move；若误把 processed 当 source 运行，会清空已处理数据。
4. **metadata.json 结构**：脚本只写 `metadata['source_image']`，若其他代码依赖 metadata 的更多字段，只运行本脚本可能不完整；若 metadata 不存在则不会创建。
5. **一次性与可重复**：设计为一次性重组；重复运行会因 source 已移走而 yes/no 找不到，仅打印 WARNING。

### 2.3 正确做法

- 仅作为历史/一次性迁移脚本使用；若需支持多命名空间或多图，应改为参数化（命令行或配置文件）而非硬编码。
- 运行前确认 `d3_check_dir`、`.cache/training_data/source/progress_bar` 及源图片存在；不要对已是目标结构的目录误运行。

---

## 三、utils/_obsolete_window_ops.py

### 3.1 职责与约定

- **用途**：文件名带 **\_obsolete_**，表示**已废弃**。提供 Windows 窗口相关操作：FindWindow、GetWindowText、ShowWindow、SetForegroundWindow、PostMessage 发键、close/minimize/maximize/restore/hide、GetWindowRect/GetWindowClientRect、EnumWindows、GetWindowThreadProcessId、find_windows_by_title、activate_and_send_key、focus_and_send_key。依赖 `utils.color_print`（非 pycore）。**find_windows_by_title**：若匹配到多个窗口，**只保留最后一个，其余通过 taskkill 杀进程**；主流程中找 D3/战网窗口通常用 d3_manager、battlenet_manager，不依赖此模块。
- **与主流程关系**：当前 D3 窗口查找与按键由 d3_manager、key_send 等负责；战网由 battlenet_manager；本文件未接入主流程，仅作遗留参考。

### 3.2 易被误解或改错的原因

1. **当现行模块用**：若在主流程中从此文件导入 find_windows_by_title 或 activate_and_send_key 并期望与 d3_manager/battlenet_manager 一致，会错误——且多窗时此模块会杀“多余”进程，可能与设计不符。
2. **多窗杀进程**：find_windows_by_title 的“保留最后一个并杀其余”行为具有破坏性；若某处误用此函数找战网/D3，可能误关其他实例。
3. **ColorPrint 来源**：此处用 `utils.color_print`，与项目其他处用 `pycore.pyfoundations.color_print` 不一致；若统一迁移到 pycore 时漏改此文件，或反过来在此改而影响其他 utils，会混用两套。
4. **send_key 坐标**：PostMessage 发键用 key_code，无坐标；get_window_rect 返回屏幕坐标，get_window_client_rect 返回客户区转屏幕坐标；若调用方混淆客户区与屏幕坐标用于点击，会点错。
5. **与 key_send、d3_manager 分工**：主流程发键、关窗应走 key_send、d3_manager、rosbot_manager 等；在此文件改行为不会影响主流程。

### 3.3 正确做法

- 窗口查找与发键逻辑只改 d3_manager、battlenet_manager、key_send 等主流程模块；不在此 _obsolete_ 文件上做功能增强或从主流程调用。
- 若仅参考实现（如 PostMessage 发键），可抄逻辑到新模块并接入主流程，而非直接复用本文件入口。

---

## 四、与道歉文档的关系

若此前因上述任一点（如改 template_config 未同步代码或类型、误改 reorganize_training_data 路径或重复运行导致数据丢失、误用 _obsolete_window_ops 或改其多窗杀进程逻辑）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
