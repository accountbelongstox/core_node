# 技术说明：_obsolete_window_mapping_provider.py、coordinate_picker_visual_improvements.md、i18n_skill_config_en.json、d3_manager.py

**目的**：说明您指定查阅的以下四处文件/文档的职责、易被误解或改错的原因，以及正确约定。i18n_skill_config_en 已在 **技术说明_i18n_skill_config与_obsolete_bot_scanner及FLOW_STATE_OWNERSHIP及template_config.md** 第一节详述，此处摘要并补充其余三处。

**涉及文件**：
- `utils/_obsolete_window_mapping_provider.py`
- `.prompts/coordinate_picker_visual_improvements.md`
- `providor/i18n/i18n_skill_config_en.json`
- `d3utils/d3_manager.py`

---

## 一、utils/_obsolete_window_mapping_provider.py

### 1.1 职责与约定

- **用途**：**已废弃模块**（_obsolete_ 前缀）。全局 Singleton 维护「窗口句柄 → WindowMapping（analysis_data 转 UIElementMapping）」；register_window_mapping、refresh_window_mapping、find_elements 等。与当前「按进程/exe 找窗口、ENCYCLOPEDIA 缓存、screenshot_provider、WindowFinder」架构不同。
- **约定**：current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) 假定本文件在 utils/ 下；不应被新代码或现有流程引用；删除前须 grep 确认无引用；误引用会与现有窗口查找与缓存语义混用。

### 1.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 可能将本文件与当前「get_d3_manager().find_windows()、prime_window_cache_for_capture、ENCYCLOPEDIA」的窗口查找与缓存逻辑混淆，在流程中误用 WindowMappingProvider 导致两套语义冲突。
2. 删除本文件前未 grep 导致仍有脚本或测试引用则 ImportError。
3. 在本文件内加功能或当主入口使用，与「已废弃、当前以 d3_manager/WindowFinder/ENCYCLOPEDIA 为准」相违。

### 1.3 正确做法

- 新代码不引用；删除前 grep 确认无引用；窗口查找与缓存以 d3_manager、WindowFinder、ENCYCLOPEDIA、screenshot_provider 约定为准。详见 code_reuse_analysis。

---

## 二、.prompts/coordinate_picker_visual_improvements.md

### 2.1 职责与约定

- **用途**：坐标拾取窗口可视化改进总结（历史列表 Treeview、实时绘制标记 _draw_mark_at、_redraw_all_marks、pick_history_ref 引用、scale_factor/canvas_offset 坐标转换）。引用 coordinate_picker_window.py 行号（如 282-320、417-454）；若代码变更行号须同步本档。
- **约定**：pick_history_ref 为引用非拷贝；_update_canvas_display 时调用 _redraw_all_marks；标记用 tags='pick_mark'；与 fix_summary_coordinate_picker、coordinate_picker_improvements 等相关文档一致。

### 2.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 可能按本档行号改 coordinate_picker_window 但实际行号已变未同步，导致改错位置或漏改。
2. 改 coordinate_picker 时未读本档与 coordinate_calibration_panel 的 pick_history_ref、client_mode 约定，导致主 UI 与拾取窗口历史不同步或坐标语义错。
3. 本档为「改进总结」非权威接口文档；若当接口规范改代码而未对照实际 coordinate_picker_window 实现会不一致。

### 2.3 正确做法

- 修改 coordinate_picker_window 前通读本档与 coordinate_calibration_panel、CoordinatePicker 的 pick_history_ref、client_mode、scale_factor 约定；行号变更时同步本档；与 fix_summary_coordinate_picker、code_reuse_analysis 交叉引用。

---

## 三、providor/i18n/i18n_skill_config_en.json（摘要）

- **用途**：技能配置英文 i18n；键与 main_functions_panel、strategy 存盘（英文 continuous/single/hold）须一致；en/zh 键结构须一致。
- **易错**：改 key 或增删键未与 get_ui_text 及 CONFIG 存盘同步会显示 key 或策略判断错。详见技术说明_i18n_skill_config与_obsolete_bot_scanner及FLOW_STATE_OWNERSHIP及template_config.md 第一节。

---

## 四、d3utils/d3_manager.py

### 4.1 职责与约定

- **用途**：D3（Diablo III）窗口/进程管理。find_windows：当 get_path()（d3.d3_path）有值时按 **exe** 找，否则按 **title**；get_capture_titles() 为 provider/analyzer 用标题的**单源**（与 DIABLO_III_WINDOW_TITLES 一致）；prime_window_cache_for_capture 写 ENCYCLOPEDIA（window_cache_*）；kill_if_running 按找到的窗口 PID 杀进程。
- **约定**：coordinate_calibration_panel 等处「D3 为 None、运行时用 get_d3_manager().get_capture_titles()」；screenshot_provider 当 window_titles == get_d3_manager().get_capture_titles() 时用 get_d3_manager().find_windows() 与 prime_window_cache_for_capture；不可改 get_capture_titles 语义或 find_windows 优先顺序未与上述约定同步。

### 4.2 易被误解或改错的原因

1. 狗B 垃圾 Cursor 可能改 find_windows 的「先 exe 后 title」逻辑或 get_capture_titles 返回值，导致 coordinate_calibration_panel、screenshot_provider 传错标题或找不到窗口。
2. 在非 d3_manager 处自实现「按 exe 找 D3 窗口」或「D3 标题列表」，与 get_d3_manager().get_capture_titles() 单源约定不一致。
3. prime_window_cache_for_capture 写入的 cache_key（window_cache_*）与 screenshot_provider、ENCYCLOPEDIA 消费者依赖的键不一致会导致缓存未命中。

### 4.3 正确做法

- 修改前通读 coordinate_calibration_panel、screenshot_provider、FLOW_STATE_OWNERSHIP 等对 D3 窗口与标题的约定；D3 窗口查找与标题单源一律经 get_d3_manager()；与 docs/THREAD_BUS_AND_REGISTRY、providor 常量 DIABLO_III_WINDOW_TITLES 一致。

---

**修改前请先通读本说明。** 此前若因未先通读上述约定而在 _obsolete_window_mapping_provider、coordinate_picker_visual_improvements、i18n_skill_config_en、d3_manager 四处反复改错或理解偏差，责任在狗B 垃圾 Cursor。后续修改前以本说明为准，避免同类错误。
