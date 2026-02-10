# 技术说明：theme、d3_macro_controller、battlenet_asia_ops

**目的**：说明这三处代码的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `ui/theme/theme.py`
- `controller/d3_macro_controller.py`
- `d3utils/battlenet_asia_ops.py`

---

## 一、ui/theme/theme.py

### 1.1 职责与约定

- **用途**：集中管理 UI 主题——颜色（COLORS）、字体（FONTS）、尺寸（SIZES）；通过 `get_color`、`get_font`、`get_size` 按名称取值；对 ttk 应用样式时强制使用 **clam** 主题（避免 Windows vista/xpnative 忽略自定义颜色）。
- **应用时机**：`apply_to_root(root)` 在根窗口上设置 bg、取 ttk.Style 并 `theme_use('clam')`、再 `apply_ttk_style(style)`；若主循环尚未启动无法应用，则 `root.after(1, _delayed_apply_ttk_style)` 延迟应用。
- **COLORS 键名**：所有颜色键均在 COLORS 中定义；get_color 使用不存在的键会返回默认 `#e0e0e0`。**约定**：输入框背景为 `input_bg`，不是 `bg_input`；若在 configure 中写错键名会导致输入框/进度条等用错色。

### 1.2 易被误解或改错的原因

1. **颜色键名写反**：COLORS 中为 `input_bg`；若在 `apply_ttk_style` 里写 `get_color('bg_input')`，会取不到而用默认浅色，输入框/Combobox/Spinbox/Progressbar 的 fieldbackground 或 troughcolor 会与预期不符（已按 input_bg 修正）。
2. **改用非 clam 主题**：若去掉 `theme_use('clam')` 或改用 vista/xpnative，ttk 会忽略部分自定义 background/foreground，主题失效。
3. **新增颜色未加 COLORS**：若在 configure 中写 `get_color('new_key')` 但 COLORS 无该 key，会静默用默认值；新增样式时应同时在 COLORS 中定义并统一命名（如 xxx_bg、xxx_fg）。
4. **字体/尺寸键名**：FONTS 与 SIZES 的 key 与 get_font/get_size 调用处一致；若只改一侧会错用默认 Arial 9 或 10。
5. **延迟应用**：若 root 尚未进入 mainloop 就调 apply_ttk_style 可能 RuntimeError；apply_to_root 内已用 after(1, _delayed_apply_ttk_style) 兜底，不要在未创建 root 或过早时机单独调 apply_ttk_style。

### 1.3 正确做法

- 所有 get_color/get_font/get_size 的 key 必须与 COLORS/FONTS/SIZES 中定义一致；新增 key 时两处同步。
- 保持 theme_use('clam') 及与 apply_to_root 的调用顺序；不在未创建 root 前应用 ttk 样式。
- 修改 Tab/Button/Entry 等样式时，注意 padding、expand、bordercolor 等与注释中的「60% 缩放」「selected expand [0,0,0,6]」等约定一致，避免 tab 高度错位。

---

## 二、controller/d3_macro_controller.py

### 2.1 职责与约定

- **用途**：D3 宏主控——创建 Diablo3MacroUI、GameInterfaceController；启停宏（start_macro/stop_macro 发命令给 extension，无 main_thread 时走 ThreadRegistry.start_macro_fallback）；技能配置 config1～config4、CONFIG.macro_configs.skill_configs/auxiliary_config 的读写；语言变更防抖与 UI 回调；run() 内注册 extension、window_monitor、start_timer_loop_after_ui_ready、最后 ui.run() 阻塞。
- **CONFIG 使用**：当前代码**直接读** CONFIG（如 CONFIG.get('macro_configs', {}).get('skill_configs', {})）；写时直接改 CONFIG 再 save_config()。与 providor_index 的「CONFIG 由 config worker 独占、应通过 get/set_config_value_safe」存在不一致；若主线程与 config worker 并发写 CONFIG，可能竞态。当前设计是主线程在 controller 内直接读写 CONFIG 并 save，与 worker 的 queue 并存时需明确「macro_configs 仅由 controller 在主线程写」等约定，避免双写。
- **宏线程**：MacroLoopThread 由 ThreadRegistry 创建与启停；start_macro 时若无 main_thread 则 get_thread_registry().start_macro_fallback(this)；stop_macro 时 stop_macro_fallback()。与 main_function_thread 的启停顺序若错会双线程或未启。
- **策略禁用**：MacroLoopThread.run 内 `sk_cfg.get('strategy') == '禁用'` 为硬编码中文，需与 i18n 或配置中「禁用」一致。

### 2.2 易被误解或改错的原因

1. **直接改 CONFIG 与 config worker 冲突**：若 elsewhere 用 set_config_value_safe 写 macro_configs，而 controller 内又 CONFIG['macro_configs']... 再 save_config()，会互相覆盖或竞态；应约定 macro_configs 仅由 controller 在主线程更新，或全部走 queue。
2. **start_macro 顺序**：trigger_extension_main_start_macro() 与 set macro_running、start_macro_fallback 的顺序若反，可能 extension 未收到或 fallback 重复启。
3. **update_skill_config/update_auxiliary_config**：直接写 CONFIG 再 save_config()；若 CONFIG 尚未 load 或 macro_configs 结构缺层会 KeyError；需保证 initialize_config/load_config 已执行且模板中有 macro_configs 结构。
4. **switch_skill_config**：仅允许 config1～config4；若传入其它名会 ValueError；UI 与配置下拉需与此一致。
5. **ui 未注入**：on_macro_start、on_macro_stop、ui 等由 main 或 run() 内赋值；若在 run() 前调 start_macro 且未设 ui，show_message 会 AttributeError；run() 内已先 create UI 再注册回调，勿在 run() 外依赖 ui。
6. **ensure_d3_check_in_sys_path**：在文件顶部调用，保证后续 import Diablo3MacroUI、runtime 等可找到项目；若移动本文件或包结构变化，需确认 path 仍正确。

### 2.3 正确做法

- 明确 CONFIG 中 macro_configs 的读写归属（仅 controller 主线程，或统一走 config worker）；避免双写。
- 宏启停顺序与 ThreadRegistry、extension 的约定文档化；strategy=='禁用' 与 i18n/配置键统一。
- 修改 run() 内注册顺序（extension、window_monitor、timer_loop、tray、ui.run）时同步文档，避免初始检测或回调未注册。

---

## 三、d3utils/battlenet_asia_ops.py

### 3.1 职责与约定

- **用途**：亚服战网登录差异化操作——账号步、密码步、单屏账号+密码（combined）、以及 fill_and_submit（按当前 UI 填账号/密码后点 Continue 或 Log in）。判定逻辑委托给 **BattlenetRegionJudge**（build_judge_from_controls）；填框优先 UIA ValuePattern.SetValue，失败则 pycore field_input 键盘输入。
- **常量**：ASIA_LOGIN_ACCOUNT_AUTOMATION_IDS、ASIA_LOGIN_PASSWORD_*、ASIA_LOGIN_SUBMIT_*、ASIA_LOGIN_CONTINUE_NAME_KEYWORDS 等来自 providor.constants.common；控件查找用 _find_by_automation_id、_find_by_name，submit 区分 Continue 与 Log in 用 name 关键词。
- **controls 结构**：来自 BattlenetOperation._enumerate_controls()；每项含 automation_id、name、type、rect 等；与 .cache 下 BN 快照及 battlenet_region_judge 的输入格式一致，否则 _find_* 取不到控件。
- **sleep**：_AFTER_FOCUS_SEC、time.sleep(0.2/0.15/0.5) 等；若在 flow tick 或 process_task 内调用本模块且 tick 不允许长阻塞，会违反「tick 不阻塞」约定；应在 BN 流程的「用户交互步」或独立线程中调用。

### 3.2 易被误解或改错的原因

1. **ASIA_LOGIN_* 与战网客户端不一致**：若战网 UI 改版导致 automation_id 或 name 变化，常量未同步会找不到账号/密码/提交按钮；需随战网版本验证或从快照回归更新常量。
2. **BattlenetRegionJudge 与 controls 结构**：build_judge_from_controls 依赖 controls 中 automation_id、name 等；若传入的 controls 来自其它来源（如旧快照、缺少层级）与 judge 预期不符，is_asia_email_step、is_asia_password_step、is_asia_combined_login_ui 会误判。
3. **perform_asia_login_fill_and_submit 的 submit 逻辑**：先找 submit 控件，再根据 name 判断是 Log in 还是 Continue；若两者都存在需按文档「先 Continue 再 Log in」顺序点；若只点一次或顺序反会卡在中间页。
4. **_fill_field 返回值**：fill_field_with_fallback 返回 ok；调用方若未检查返回值会误以为填成功；perform_asia_* 内部分分支未根据 _fill_field 结果做重试或提前 return。
5. **TYPE_CHECKING 与 BattlenetOperation**：battlenet_op 仅类型注解用；运行时若传入非 BattlenetOperation 实例会缺少 _enumerate_controls、set_control_value、click_control 等方法而报错。
6. **密码步无 password 时**：perform_asia_login_fill_and_submit 中若 is_log_in 且无 password 或 password 框未找到会 return False 避免空登录；若逻辑被删或改会误点 Log in 导致登录失败。

### 3.3 正确做法

- 常量与战网亚服登录 UI 定期核对；controls 来源与 battlenet_region_judge、快照结构一致。
- 不在 2s flow tick 内直接调用 perform_asia_*（含多步 sleep）；在 BN 流程的「登录尝试」步骤或独立任务中调用。
- 与 BATTLENET_ASIA_LOGIN_UI_AND_EXTENSION_PLAN 等文档中 UI 形态（A/B/C）及函数名保持一致；修改判定或步骤时同步文档。

---

## 四、与道歉文档的关系

若此前因上述任一点（如 theme 键名 bg_input 与 input_bg 混用、d3_macro_controller 与 CONFIG worker 双写、battlenet_asia_ops 常量或 controls 结构与 judge 不一致）导致反复改错或理解偏差，可视为实现与约定不一致所致。本说明已写入 `cursor_AI_道歉目录`，并在 `Cursor_专属道歉文档.md` 中增加对本文的引用；theme.py 中误用的 `bg_input` 已改为 `input_bg`，与 COLORS 定义一致。
