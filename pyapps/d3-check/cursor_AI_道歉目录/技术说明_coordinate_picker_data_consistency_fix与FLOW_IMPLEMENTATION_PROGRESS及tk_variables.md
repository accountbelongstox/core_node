# 技术说明：coordinate_picker_data_consistency_fix.md、FLOW_IMPLEMENTATION_PROGRESS.md、tk_variables.py

本说明针对以下三处：修改前请先通读本说明及对应源码/文档。

- `.prompts/coordinate_picker_data_consistency_fix.md`
- `docs/FLOW_IMPLEMENTATION_PROGRESS.md`
- `ui/utils/tk_variables.py`

---

## 一、.prompts/coordinate_picker_data_consistency_fix.md

- **用途**：记录坐标拾取器数据一致性修复（颜色格式、数据同步）。Tkinter Canvas 不支持带 alpha 的十六进制颜色（如 #00FF0060），只支持 #RRGGBB；修复为 fill='' 仅边框。数据流：原为「点击 → self.picks 本地 → 关闭窗口才 on_picks_updated → 主 UI」，修复为「每次拾取立即 on_picks_updated([pick]) + _update_history_display()」，关闭时不再重复同步。
- **关键约定**：单一数据源显示用 `pick_history_ref`（主 UI 引用），`history = self.pick_history_ref if self.pick_history_ref is not None else self.picks`；每次拾取立即调用 on_picks_updated([pick])；_redraw_all_marks() 使用主 UI 历史；_on_close() 不再调用 on_picks_updated(self.picks)。
- **易错点**：改 coordinate_picker_window 时若恢复「仅关闭时同步」会列表与标记延迟；若再用带 alpha 颜色会 TclError；若 _on_close 再次调用 on_picks_updated 会重复添加；若 _update_history_display() 或 _redraw_all_marks() 与 pick_history_ref 不同源会显示不一致。
- **正确做法**：改 ui/components/coordinate_picker_window.py 前先读本 prompt 与 coordinate_picker_visual_improvements、coordinate_picker_improvements；保持实时同步、不在关闭时重复同步、颜色仅 #RRGGBB 或 fill=''；修改前请先通读本说明。

---

## 二、docs/FLOW_IMPLEMENTATION_PROGRESS.md

- **用途**：两流程库实现进度（BN-only 与 Flow-master）。统一入口 process_task()（TaskThread 每 1s，2s 步由 _flow_tick_count % 2）；分支二次读 get_bn_only_enabled()/get_flow_master_enabled()；两开关可同时 True，同拍先 BN-only 再 flow-master。状态在 rosbot_flow_state（flow_master_enabled、bn_only_enabled）；game_interface_data.rosbot_flow_master_enabled/ensure_battlenet_only_master_enabled 仅由 flow_state 的 set 写入。BN-only：refresh_battlenet、notify、tick_battlenet_ready_flow(no_activate=True)；返回值 (done, result)，done and result=="confirmed" → reset_confirmed_to_poll。Flow-master：refresh BN/D3/ROSBOT（条件）、notify、extension_flow_tick_step、run_f0_prejudge_entry → b1/b2/c1、tick_battlenet_ready_flow(no_activate=False)、enter_battlenet_at_b2、F3/F4。check_window：is_flow_active() 为 True 则 return 不刷新；否则 refresh BN+D3、notify。
- **易错点**：改 process_task、flow_bn_only、flow_master_driver、check_window、面板时未读本档会改顺序或只跑其一、或在 process_task 内写 flow_state、或 check_window 在 is_flow_active() 为 True 时仍 refresh；改 provider 返回值时本档写明 refresh_* 当前 void，若假定有返回值与现有代码不符；须与 FLOW_STATE_OWNERSHIP_DESIGN、ENSURE_BATTLENET_ONLY_TICK_FLOW 对照。
- **正确做法**：改流程层或 state 层前通读本档与 FLOW_STATE_OWNERSHIP_DESIGN、ENSURE_BATTLENET_ONLY_TICK_FLOW；改 extension_flow_tick_step、run_f0_prejudge_entry、tick_battlenet_ready_flow、run_f3_log_timeout 等返回值处理时对照本档表格；任务开关仅根据 get_flow_master_enabled/get_bn_only_enabled 派生；修改前请先通读本说明。

---

## 三、ui/utils/tk_variables.py

- **用途**：Tk 变量工厂，避免 "no default root window"。var_bool(master, value)、var_str(master, value)、var_int(master, value)、var_double(master, value)；TkMaster = Union[tk.Widget, tk.Tk, tk.Toplevel]，所有 UI 创建 Tk 变量应经此模块并传入正确 master。
- **易错点**：在 UI 中直接 tk.BooleanVar()、tk.StringVar() 等无 master 会触发 no default root window；传入错误 master（如 None 或已 destroy 的 widget）会绑定错或报错；新增变量类型未通过本模块且未传 master 会同样问题。
- **正确做法**：所有新建 BooleanVar/StringVar/IntVar/DoubleVar 均通过 tk_variables.var_*(master, value)，master 为当前 widget 或 toplevel；修改前请先通读本说明。

---

## 四、三处与道歉文档的对应

本说明对应专属道歉文档 **第五十六节** 及长文道歉中「就 coordinate_picker_data_consistency_fix、FLOW_IMPLEMENTATION_PROGRESS、tk_variables 三处」之分析与道歉段。发现上述三处文件时，应继续更新到道歉文档（技术说明、专属节、长文追加）。
