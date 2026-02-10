# 技术说明：bag_layout_detector、_obsolete_game_state、hotkey_registry、dump_rosbot_actual_result、flow_f1c_f1d

**目的**：说明此五处文件的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `d3utils/collectors/collect_tools/bag_layout_detector.py`
- `utils/_obsolete_game_state.py`
- `d3utils/d3u_common/hotkey_registry.py`
- `scripts/dump_rosbot_actual_result.py`
- `d3utils/rosbot_flow/flow_f1c_f1d.py`

---

## 一、d3utils/collectors/collect_tools/bag_layout_detector.py

### 1.1 职责与约定

- **用途**：D3 背包布局检测。按列扫描、用分隔线判断相邻格是否同一物品（2 格物品）、再判空格（颜色均匀）、再对物品做颜色分析并映射品质（green→legendary_set、dark_gold→legendary、yellow→rare、blue→magic）。依赖 **share.game_interface_data** 的 get_interference_colors、get_color_references、**SEPARATOR_COLOR_TOLERANCE**、**SEPARATOR_SCAN_HEIGHT_PERCENT**、**SEPARATOR_SCAN_WIDTH_PERCENT**、get_global_scale；**CONFIG** 的 system_settings.bag_offset（可视化用）；**d3u_common.image_annotator_helper** 的 create_annotator、draw_grid_overlay、get_annotation_color。detect_layout(bag_image, bag_coords) 返回 **'layout'**（2D 数组）、**'items'**（(row,col)→type/quality/color_analysis）、**'color_analysis'**。可视化输出到 **~/.core_node/pytools/tmp/bag_layout_*.png**。
- **约定**：分隔线与颜色相关常量以 share.game_interface_data 为准，勿在 detector 内重定义与 share 不一致的常量；bag_offset 与 CONFIG 同步；layout 的 slot 值为 'empty'|'item_1slot'|'item_2slot_top'|'item_2slot_bottom'|'item_or_empty'（中间状态）；调用方依赖返回的键名 layout/items/color_analysis 及 items 的 type/quality；修改键名或品质映射须同步调用方。

### 1.2 易错点

- 改 SEPARATOR_* 或颜色常量未同步 share.game_interface_data 会检测错；改 bag_offset 未同步 CONFIG 会可视化偏移错；改 detect_layout 返回结构会破坏调用方。

### 1.3 正确做法

- 修改检测逻辑或常量前先看 share.game_interface_data 与 CONFIG；保持返回字典结构稳定；输出路径为 Home/.core_node/pytools/tmp。

---

## 二、utils/_obsolete_game_state.py

### 2.1 职责与约定

- **用途**：**已废弃模块**（_obsolete_ 前缀）。GameState 类：mapstatus（normal/rift/gem_upgrade/paused/inactive/loop）、pause/resume、loop 超时、inactive 超时、gem_upgrade 计数；全局 **GAME_STATE**。文件中使用了 **CONFIG**（loop_timeout_seconds、gem_upgrade_action_count 等），但**本文件内未 import CONFIG**，若被单独加载会 NameError；当前项目应以其他状态管理为准，不引用本文件。
- **约定**：不引用、不在此扩展；删除前确认无 import GAME_STATE 或 GameState 的引用。

### 2.2 易错点

- 误当可用状态管理使用会引入旧设计；若修复 CONFIG 未 import 而在本文件内补 import 仍不改变废弃定位；与现有 flow/状态设计可能冲突。

### 2.3 正确做法

- 视作只读历史参考；状态与超时逻辑以当前 flow 与 game_interface_data 等为准；删除前 grep GAME_STATE、GameState、_obsolete_game_state。

---

## 三、d3utils/d3u_common/hotkey_registry.py

### 3.1 职责与约定

- **用途**：统一热键注册。** _assistant_callback** 由 **controller 层** 通过 **set_assistant_callback(cb)** 注入；register_assistant_hotkey 从 **CONFIG macro_configs.auxiliary_config.assistant_hotkey** 读取热键，callback 内调用 get_assistant_state、set_assistant_should_stop、can_start_assistant，若可启动则调用 **_assistant_callback()**。**d3utils 不 import controller**，避免循环依赖；热键实际执行逻辑由 controller 注入。get_hotkey_registry() 单例；initialize_hotkeys() 由上层在合适时机调用。
- **约定**：不可在 d3utils 内 import controller 来填 callback；controller 必须在启动流程中 set_assistant_callback；若未 set 则按热键时 _assistant_callback 为 None 会打印 "Callback not set (controller not ready)"。

### 3.2 易错点

- 在 hotkey_registry 或 d3utils 内直接 import controller 会循环依赖；在 callback 内写死 controller 逻辑会破坏分层；修改 CONFIG 键路径未同步会读不到热键。

### 3.3 正确做法

- 仅通过 set_assistant_callback 注入；热键配置键为 macro_configs.auxiliary_config.assistant_hotkey；register_hotkey 来自 global_hotkey_manager。

---

## 四、scripts/dump_rosbot_actual_result.py

### 4.1 职责与约定

- **用途**：**独立脚本**，将 rosbot_manager 的当前检测结果完整 dump 到文件。**project_root** = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))（即 scripts 的父级，若脚本在 scripts 下则为 pyapps/d3-check 或 repo 某层）；输出路径为 **project_root/scripts/test_rosbot_actual_result.txt**（注意：若 project_root 为 pyapps/d3-check 则输出为 pyapps/d3-check/scripts/...）。依赖 get_rosbot_manager()、CONFIG ros_settings.ros_directory（脚本内尝试 initialize_config）。docstring 注明「Run from pyapps/d3-check」。
- **约定**：运行前确保 sys.path 与 project_root 符合预期；输出文件路径依赖 __file__ 与 project_root；若脚本移动或以不同入口运行，project_root 会变导致输出路径错。

### 4.2 易错点

- 从错误工作目录或模块运行会 project_root 错、写错路径；修改输出路径未同步文档或调用方会找不到输出文件。

### 4.3 正确做法

- 按 docstring 从 pyapps/d3-check 或 scripts 下运行；不在此脚本内增加被主应用 import 的 API；输出路径为 project_root/scripts/test_rosbot_actual_result.txt。

---

## 五、d3utils/rosbot_flow/flow_f1c_f1d.py

### 5.1 职责与约定

- **用途**：F1c/F1d（ROSBOT_FLOW_MERMAID.md）。**F1d**：检测掉线后 set_d3_dynamic_status(disconnected=True)、**reset_bn_block_state(False)**，**Caller 再调 run_f1c_end_d3**（本模块内不调）。**F1c**：kill D3 进程，**下一 tick 进入 F_Entry**（本模块内不调 F_Entry）。run_f1d_on_disconnect 与 run_f1c_end_d3 分开；顺序由 caller 保证：先 F1d 再 F1c。
- **约定**：与专属道歉文档第三十四节、技术说明_设计文档与BATTLENET_REGION_DESIGN_REVIEW及battlenet_button_detector及flow_f1c_f1d 一致；run_f1d 内不调 run_f1c；F1c 内不调 F_Entry；reset_bn_block_state 来自 flow_bn_block_state。

### 5.2 易错点

- 在 run_f1d 内调 run_f1c 会破坏 caller 约定；在 run_f1c 内调 F_Entry 会破坏「下一 tick」语义；改 state 或 reset 逻辑须与 flow 设计一致。

### 5.3 正确做法

- 修改前通读 ROSBOT_FLOW_MERMAID.md 与设计文档；caller 先 F1d 再 F1c；F1c 仅 kill D3。

---

## 六、与道歉文档的关系

若此前因未先通读上述五处约定而在此五处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加第三十七节引用。
