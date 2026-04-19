# 技术说明：coordinate_picker_visual_improvements.md、log_monitor_api.py、status_row_config.py、bottom_bar_options_block.py、bn_flow_B9.json

本说明针对以下五处：修改前请先通读本说明及对应源码/文件。

- `.prompts/coordinate_picker_visual_improvements.md`
- `d3utils/log_monitor_api.py`
- `ui/components/status_row_config.py`
- `ui/components/bottom_bar_options_block.py`
- `.cache/bn_flow_snapshots/bn_flow_B9.json`

---

## 一、.prompts/coordinate_picker_visual_improvements.md

- **用途**：坐标拾取窗口可视化改进总结；Treeview 历史列表替代计数、_draw_mark_at/_redraw_all_marks 实时绘制与重绘、pick_history_ref 引用同步；对应 ui/components/coordinate_picker_window.py。
- **约定**：文档内行号（282–320、417–454、400–415 等）会随 coordinate_picker_window 修改漂移，按行号查找须先核对当前实现；方法名 _update_count→_update_history_display、_draw_pick→_draw_mark_at 若重构须同步文档；history = pick_history_ref if pick_history_ref is not None else self.picks 为统一数据源；坐标转换 canvas_x = int(x*scale_factor)+canvas_offset_x。
- **易错点**：按文档行号改 coordinate_picker_window 未核对实际行号会改错位置；改 _redraw_all_marks、_draw_mark_at 或 tags='pick_mark' 未同步本档会文档与实现不一致；引用的 coordinate_picker_improvements.md、fix_summary_coordinate_picker.md 路径或文件名变更会导致链断。
- **正确做法**：改 coordinate_picker_window 时同步本档行号与方法名，或改为「见代码搜索 _redraw_all_marks」等不依赖行号的描述；修改前请先通读本说明及 coordinate_picker_window 当前实现。

---

## 二、d3utils/log_monitor_api.py

- **用途**：薄委托层；set_log_file(file_path)、set_rosbot_running(running)；供 rosbot_task_processor 等设置日志文件与 ROSBOT 运行状态，避免 log_monitor 被直接 import 造成循环依赖（log_monitor → log_analyzer → … → rosbot_task_processor → log_monitor）。
- **约定**：register(get_monitor_fn) 由 log_monitor 在加载时调用；_get_monitor 未注册时 set_log_file/set_rosbot_running 为 no-op；对外应统一通过本 API 或 get_log_monitor() 获取实例，不可绕过单例新建 LogMonitor。
- **易错点**：在他处直接 import log_monitor 或新建 LogMonitor 会循环依赖或监控状态不一致；重复 register 会覆盖前一个 get_monitor_fn；改 log_monitor 的 set_log_file、set_rosbot_running 接口未同步本 API 会调用失败。
- **正确做法**：设置日志文件或 ROSBOT 状态仅通过 log_monitor_api.set_log_file、log_monitor_api.set_rosbot_running；修改 log_monitor 接口时同步本文件；修改前请先通读本说明及 log_monitor 模块。

---

## 三、ui/components/status_row_config.py

- **用途**：底栏状态行配置；两行 STATUS_ROW_1（battlenet、ros、d3、map）、STATUS_ROW_2（stage、oauth、window_size）；每项为 (label_i18n_key, var_key, default_fg)；BottomBar 按 state 设 value label 前景色。
- **约定**：var_key 与 bottom_bar 传入的 status_vars 键必须一一对应；label_i18n_key 须与 i18n 中 rosbot.*、ui.status_bar.* 等键存在；STATUS_ROW_1/2 顺序与底栏渲染顺序一致；default_fg 为 None 时由 BottomBar 按状态设颜色。
- **易错点**：增删或改名 var_key 后 bottom_bar_status_block 或主窗口未传对应 status_vars 会导致该列不显示或 KeyError；改 label_i18n_key 未与 i18n 键同步会显示 key 或文案错；调换 STATUS_ROW_1/2 顺序会打乱底栏布局。
- **正确做法**：增删状态项时同步 status_row_config 与 bottom_bar 的 status_vars 来源、i18n 键与 rosbot 面板；修改前请先通读本说明及 bottom_bar_status_block、diablo3_macro_ui。

---

## 四、ui/components/bottom_bar_options_block.py

- **用途**：底部栏每 Tab 首行选项块；tab 0 = sound/smart pause/custom stand/current config（由 bottom_bar_vars 提供），tab 1–5 = 当前仅空 Frame；6 个 tab_frames，show_tab(tab_index) 显示其一。
- **约定**：bottom_bar_vars 含 sound_var、smart_pause_var、custom_stand_var、custom_stand_key_var、config_name_var；与 bottom_bar 传入的 vars 一致；_build_tab_strip(tab_index) 当前返回空 Frame；tab_index 0..5。
- **易错点**：改 bottom_bar_vars 的 key 或 tab 数未与 bottom_bar 同步会 KeyError 或越界；在 _build_tab_strip 内增控件未用 ThemedCheckbutton/ThemedEntry 与 theme 一致会风格错。
- **正确做法**：改 bottom_bar_vars 结构时同步 bottom_bar 及传入处；修改前请先通读本说明及技术说明_rosbot_status_provider与bn_flow_B8及bottom_bar_options_block.md。

---

## 五、.cache/bn_flow_snapshots/bn_flow_B9.json

- **用途**：BN 流节点 B9 某次快照（B9_first_screen）；meta.node 为 "B9"、meta.reason 为 "B9_first_screen"；controls 为战网首屏控件树；与 B4、B8、B5 等结构一致，非流程定义。
- **约定**：meta.node 须与 BN 节点名 B9 一致；reason 由快照写入逻辑决定；controls 元素含 name、automation_id、type、rect、level；rect 含 left、top、right、bottom、width、height；勿在 flow 分支中读本文件做决策。
- **易错点**：改 meta 或 controls 结构未同步消费方会 KeyError 或解析错；automation_id（如 app-loading、app、main-header）可能随战网客户端版本变化，硬编码会 fragile；按 name「战网」过滤须考虑多语言；误当流程定义在 flow 中读会耦合。
- **正确做法**：改 meta/controls 前 grep 消费方；解析时容错 controls 为空或字段缺失；勿在流程逻辑中依赖本文件；修改前请先通读本说明及技术说明_providor_index与bn_flow_B9_B13及model_registry及signal_utils.md。

---

## 六、五处与道歉文档的对应

本说明对应专属道歉文档 **第五十八节** 及长文道歉中「就 coordinate_picker_visual_improvements、log_monitor_api、status_row_config、bottom_bar_options_block、bn_flow_B9 五处」之分析与道歉段。发现上述五处文件时，应继续更新到道歉文档（技术说明、专属节、长文追加）。
