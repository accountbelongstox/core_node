# 技术说明：login_try_screenshot_controller、d4_extension_thread、main_functions_panel

**目的**：说明这三处代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `controller/login_try_screenshot_controller.py`
- `d3utils/d4_extension_thread.py`
- `ui/panels/main_functions_panel.py`

---

## 一、controller/login_try_screenshot_controller.py

### 1.1 职责与约定

- **入口**：`ensure_battlenet_started_and_login_check()` 为「启动 ROSBOT 前的步骤 1」：先保证战网就绪，再视情况走 **C 分支**（D3 已运行）或 **D 块**（从战网启动 D3）。返回 True 表示本步完成（C 或 D13→C 成功），False 表示配置缺失或窗口不可用。
- **三态不混用**：文档明确「Three states, reuse code only, do not mix flows」——(1) D3-already-running：C1→C2→C3 loop→branch（start/game_tool/disconnect/other）；(2) D block：无 D3 时 BN 窗口、杀 D3、激活 BN、点 D3 tab+Play、D12 sleep(5)、D13 轮询 D3 窗口 10s；(3) C3 返回 "disconnect" 时执行 F1d+F1c，**调用方不得重启战网**，下一 tick 从 F_Entry→B2。
- **ensure_battlenet_only()**：仅保证战网运行且登录（normal_available），不碰 D3/ROSBOT；供「仅确保战网」场景（如 one_shot_tasks.do_battlenet_only_check）。
- **ensure_d3_running_from_battlenet_no_rosbot()**：D3 在线但掉线则从战网重启（先杀 D3）；D3 未在线则从战网启动；D3 在线且未掉线则 no-op。掉线判定为两次连续 capture 都匹配 d3_disconnected 模板。
- **_run_c3_loop_and_handle_branch()**：C3 循环（截屏→match start/game_tool/disconnect/connecting），超时 1 分钟、start 时 click 并重置 1 分钟；返回 "success" / "disconnect" / "fallthrough"。**disconnect 时** 已调 run_c4_disconnect_then_f1d_f1c()，调用方不得再重启 BN。
- **路径**：`current_dir = Path(__file__).parent.parent` 即 controller 的上一级（项目根）；sys.path.insert 用于 import。若文件移动需改 parent 层数。

### 1.2 易被误解或改错的原因

1. **C/D 分支混用**：若在 C 分支里误跑 D 块逻辑（如无 D3 时先杀 D3 再点 Play），或 D13 失败后误走 C 分支，会重复杀 D3/重启 BN 或逻辑错乱。
2. **disconnect 后重启 BN**：C3 返回 "disconnect" 时 F1d+F1c 已执行，下一 tick 应从 F_Entry 进 B2；若 ensure_battlenet_started_and_login_check 的调用方在收到 "disconnect" 或 return False 时再去 restart BN，会与文档「do not touch BN」矛盾。
3. **get_request_d_block_from_b7 与 battlenet_tick_confirmed**：入口分支依赖 get_request_d_block_from_b7()、_is_bn_flow_in_login_phase、_get_and_clear_battlenet_tick_confirmed；若 B7 或 tick 流程未正确设置/清除这些标志，会错误进入「D block from B7」或「tick-confirmed」分支。
4. **长时间阻塞**：ensure_* 内大量 time.sleep 与轮询，在 one_shot 或 timer 线程中调用会占满该线程；文档与 one_shot_tasks 已约定为此类任务在 submit_one_shot 中执行，勿在 2s flow tick 内调用。
5. **_run_c3_loop_and_handle_branch 返回值**：success 表示 C 路径完成并已启 ROSBOT；disconnect 表示已 F1d+F1c，调用方应 return False 且不重启 BN；fallthrough 表示超时/other，调用方可能从 D14 重试。若调用方把 disconnect 当 fallthrough 处理会重复操作 BN。
6. **CONFIG 直接读**：如 CONFIG.get("ros_settings", {}).get("auto_start_rosbot", True) 在 controller 内直接读；若与 config worker 的 get_config_value_safe 并存需约定 ros_settings 的读写方，避免竞态。

### 1.3 正确做法

- 严格区分 C 分支（has_d3_process + run_c1_entry 通过后 C2→C3→branch）与 D 块（无 D3 或 C fallthrough 后 BN 启动 D3）；disconnect 时仅 return False，不重启 BN。
- 修改 B7/BN tick 流程时同步更新 get_request_d_block_from_b7、battlenet_tick_confirmed 的设/清逻辑，保证 ensure_battlenet_started_and_login_check 入口分支正确。
- 不在 process_task 或 2s tick 内调用 ensure_battlenet_started_and_login_check；仅通过 one_shot 或 extension 触发的独立任务调用。

---

## 二、d3utils/d4_extension_thread.py

### 2.1 职责与约定

- **用途**：D4 专用线程，替代 timer_manager 对 d4_controller 的注册；每 **D4_TICK_INTERVAL**（常量，如 3s）检查一次，当 `d4_data.is_exp_farming_running()` 或 `d4_data.debug_window_open` 为 True 时调用 `d4_controller.process()`。
- **退出**：通过 `_shutdown` Event；request_shutdown() 由外部在应用退出时调用；run() 内用 `for _ in range(int(D4_TICK_INTERVAL*10)): time.sleep(0.1)` 以便约 3s 间隔且能快速响应 shutdown。
- **单例**：get_d4_extension_thread() / set_d4_extension_thread() 管理 _instance；由 ThreadRegistry 或创建 extension 线程的逻辑创建并 set，其它模块通过 get 获取。

### 2.2 易被误解或改错的原因

1. **D4_TICK_INTERVAL 与文档不一致**：若常量改为 1s 或 5s 未同步文档或调用方预期，会导致 D4 逻辑频率与设计不符。
2. **process() 阻塞**：若 d4_controller.process() 内存在长 sleep 或阻塞调用，本线程会卡住，shutdown 仍能在一轮 sleep 后检查，但 D4 处理会延迟；应保证 process() 为短时操作。
3. **条件漏判**：仅当 is_exp_farming_running 或 debug_window_open 为 True 才 process；若某处未正确设置 d4_data 的这两个标志，D4 功能会不触发。
4. **与 timer 重复**：若同时保留 timer_manager 对 d4 的注册与本线程，会重复调用 process()；文档已说明「Replaces timer_manager registration」，勿双注册。
5. **未调用 request_shutdown**：应用退出时若未调 set_d4_extension_thread(thread) 对应实例的 request_shutdown()，线程会一直 sleep 直到进程结束；需在统一 shutdown 路径中调用。

### 2.3 正确做法

- D4_TICK_INTERVAL 与 d4 设计文档一致；process() 内不长时间阻塞。
- 仅通过 D4ExtensionThread 驱动 d4_controller，不再用 timer 注册 d4；退出时在统一 shutdown 中 request_shutdown() 并 join（若需）。

---

## 三、ui/panels/main_functions_panel.py

### 3.1 职责与约定

- **用途**：主功能面板（TABLE1）——技能配置（左列）+ 其他设置与基本信息（右列）；config1～config4 选择、技能 key/strategy、additional（quick_switch、movement、potion、potion_interval）、以及 ConfigBinding 绑定的 macro_configs.current_skill_config、auxiliary_config 等。
- **CONFIG 结构**：CONFIG.macro_configs.skill_configs[current_config] 为当前技能配置，含 skills、quick_switch、movement、potion、potion_interval 等；CONFIG.macro_configs.auxiliary_config 为动画速度、游戏语言、宏热键等；CONFIG.macro_configs.current_skill_config 为当前选中的 config 名。
- **策略键**：显示用 i18n（strategy_en_to_zh），存盘用英文键 continuous/single/hold；combobox 的 value 与内部逻辑一致，避免语言切换后 key 错。
- **与 controller 的接口**：d3_macro_controller 通过 get_skill_config(current_config)、get_auxiliary_config() 读当前配置；面板通过 _on_skill_changed、ConfigBinding 写 CONFIG 并 save_config()。两边读写的 key（如 skills.skill1.key、strategy）须一致；controller 中 strategy=='禁用' 与 i18n 或配置中「禁用」一致。
- **bottom_bar**：若传入 bottom_bar，会用于 update_config_status、sound_var、smart_pause_var、config_name_var 等；未传入则部分功能不可用。
- **UnifiedStyles**：颜色/字体/间距用 UnifiedStyles.COLORS、FONTS、SPACING；如 input_bg、input_text、accent 等键需与 unified_styles 定义一致。

### 3.2 易被误解或改错的原因

1. **CONFIG 键路径错误**：若写 CONFIG["macro_configs"]["skill_configs"][config_name] 时少一层或 key 名与 controller 的 get_skill_config 不一致（如 skills 下用 skill1 还是 primary_skill），会导致保存/读取错位。
2. **strategy 存成中文**：若 combobox 把显示值「连续」「单次」等直接写入 CONFIG，而 MacroLoopThread 里用 `sk_cfg.get('strategy') == '禁用'` 或英文 'continuous' 判断，会不匹配；应存英文 key，显示用 i18n。
3. **current_config 与 ConfigBinding 不同步**：_on_config_changed 里更新 self.current_config 并 _recreate_skill_tabs；若 ConfigBinding 写入的是 macro_configs.current_skill_config 而面板未从 CONFIG 再读一次 current_config，会短暂不一致；当前实现已从 config_combo.get() 更新，需保持。
4. **_get_setting_key 与 additional 键名**：movement 在 additional_settings 里对应 movement，但 _get_setting_key 中 "movement" 对应 "movement_key"；若 CONFIG 里用 movement 而某处用 movement_key 会取不到。
5. **直接写 CONFIG 与 save_config**：与 providor 的 config worker 若并存，主线程直接 CONFIG[...]=... 再 save_config() 可能与 worker 的 queue 写冲突；约定 macro_configs 由 UI/controller 主线程写即可。
6. **deprecated 方法**：_create_skill_panel、_create_basic_info_panel 已标注 deprecated，用 _create_skill_panel_in_frame、_create_basic_info_panel_in_frame；若新改动用错方法会布局错或重复创建。

### 3.3 正确做法

- CONFIG 中 skill_configs 与 auxiliary_config 的 key 与 d3_macro_controller.get_skill_config/get_auxiliary_config、MacroLoopThread 内读取一致；strategy 存英文 key。
- ConfigBinding 的 config_key（如 macro_configs.current_skill_config）与 CONFIG 结构一致；切换 config 后 _recreate_skill_tabs 与 _update_config_info 同步。
- 新增技能项或 additional 项时，同步更新 CONFIG 默认结构、controller 读取处、及 _update_config_info 的展示；UnifiedStyles 的 key 与 unified_styles 模块一致。

---

## 四、与道歉文档的关系

若此前因上述任一点（如 ensure 的 C/D 分支或 disconnect 后误重启 BN、d4_extension_thread 条件或间隔改错、main_functions_panel 的 CONFIG 键或 strategy 中英混用）导致反复改错或理解偏差，可视为实现与约定不一致所致。本说明已写入 `cursor_AI_道歉目录`，并在 `Cursor_专属道歉文档.md` 中增加对本文的引用，便于后续修改前先查此处约定。
