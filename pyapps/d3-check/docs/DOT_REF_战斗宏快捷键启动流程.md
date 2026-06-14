# 战斗宏快捷键启动流程 — 供 DOT 参考

**说明**：本文档供 **DOT（.NET 端口）** 参考，要求 DOT 按 **DOT 规范**（[DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md)、[.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc)；**UI 层以 [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md)、[.cursor/rules/dot-ui.mdc](../../../.cursor/rules/dot-ui.mdc) 为规范**）实现，**功能与 Python 1:1 对应**。代码与注释使用英文/ASCII；行为与下述 Python 流程一致。

---

## 1. 流程总览

- **入口**：用户按下「战斗宏启停热键」（UI 文案 i18n key：`main_functions_panel.macro_start_hotkey_label`，中文「战斗宏启停热键」）。
- **配置键**：`macro_configs.auxiliary_config.macro_start_hotkey`（与辅助宏 `assistant_hotkey` 区分）。
- **行为**：启停「战斗宏」—— 若未运行则启动主控的 `start_macro()`（通知主功能线程 / 扩展事件 + 可选 fallback 宏循环）；若已在运行则调用 `stop_macro()`（通知停止 + 清缓存 + 停 fallback）。**热键回调必须在主线程执行启停**，故通过 schedule（如 `root.after(0, _toggle_combat_macro)`）marshal 到主线程。

---

## 2. 配置与 UI 绑定（代码地址）

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| 2.1 | 配置路径常量 | `d3utils/d3u_common/hotkey_registry.py`：`HOTKEY_CONFIG_PATH_AUXILIARY = "macro_configs.auxiliary_config"`，`CONFIG_KEY_MACRO_START_HOTKEY = "macro_start_hotkey"` |
| 2.2 | 主面板底部栏：战斗宏热键（row=0） | `ui/panels/main_functions_panel.py`：`_create_bottom_bar_in_frame`，**row=0**：Label 使用 `i18n_manager.get_ui_text("main_functions_panel.macro_start_hotkey_label")`，HotkeyInput 初始值来自 `CONFIG["macro_configs"]["auxiliary_config"].get("macro_start_hotkey")`，规范化用 `normalize_hotkey_canonical` |
| 2.3 | 用户修改热键时写回 CONFIG 并通知重绑 | `ui/panels/main_functions_panel.py` 约 609–615 行：`_on_macro_start_hotkey_change(hotkey)` 写 `CONFIG["macro_configs"]["auxiliary_config"][CONFIG_KEY_MACRO_START_HOTKEY] = hotkey`，`queue_config_save()`，`get_config_change_hub().notify_config_changed(HOTKEY_CONFIG_PATH_AUXILIARY)` |

DOT 要求：UI 热键控件与 `macro_configs.auxiliary_config.macro_start_hotkey` 绑定；修改时写回 CONFIG 并触发 `ConfigKeys.HotkeyConfigPathAuxiliary`（与辅助宏同一路径），以便立即重绑战斗宏热键。

---

## 3. 热键注册与回调注入（代码地址）

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| 3.1 | 启动时从 CONFIG 注册战斗宏热键 | `d3utils/d3u_common/hotkey_registry.py`：`initialize_hotkeys()` 调用 `get_hotkey_registry().register_combat_hotkey()`；`register_combat_hotkey()` 从 `CONFIG['macro_configs']['auxiliary_config']['macro_start_hotkey']` 读取，经 `normalize_hotkey_canonical` 后若为空则跳过并返回 False |
| 3.2 | 热键回调逻辑（仅调注入的 _combat_callback，无状态机） | `d3utils/d3u_common/hotkey_registry.py` 约 195–203 行：`combat_hotkey_callback()` 内若 `_combat_callback` 已设置则调用 `_combat_callback()`，否则打日志 "Combat: Callback not set (controller not ready)"；**不**调用 get_assistant_state / can_start_assistant 等 |
| 3.3 | Controller 注入战斗回调（须 marshal 到主线程） | `controller/d3_macro_controller.py` 约 101 行：`set_combat_callback(self._schedule_toggle_combat_macro)`；`_schedule_toggle_combat_macro()` 若有 UI 且 root 存在则 `self.ui.root.after(0, self._toggle_combat_macro)`，否则直接 `_toggle_combat_macro()` |
| 3.4 | 初始化顺序 | 与辅助宏相同：`initialize_hotkeys()` 中同时 `register_assistant_hotkey()` 与 `register_combat_hotkey()`；主控制器在 `__init__` 中 `set_combat_callback(...)`，在 `run()` 之前完成注入 |

DOT 要求：等效于 HotkeyRegistry 的模块从 CONFIG 读 `macro_start_hotkey` 并注册；回调内仅调用注入的委托（ToggleCombatMacro 或等价）；**该委托必须把实际启停逻辑调度到 UI/主线程执行**，不可在热键线程直接改 macro_running 或调 start_macro/stop_macro 若 DOT 的 UI 线程与热键线程不同。

---

## 4. 配置变更重绑（代码地址）

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| 4.1 | 订阅 config 变更，与辅助宏同路径重绑 | `controller/d3_macro_controller.py` 约 272–276 行：`if key_path and key_path.startswith(HOTKEY_CONFIG_PATH_AUXILIARY)` 则 `get_hotkey_registry().reregister_assistant_hotkey()`、`reregister_combat_hotkey()`；**先 assistant 再 combat** |
| 4.2 | 重绑实现 | `d3utils/d3u_common/hotkey_registry.py`：`reregister_combat_hotkey()` 读 `auxiliary_config.macro_start_hotkey`，语义与 `reregister_assistant_hotkey()` 一致：未注册且新键非空则 `register_combat_hotkey()`；已注册则比较新旧键，不同则 unregister 再 register；新键为空则只 unregister（design §8.2）；失败时回滚旧键同辅助宏 |

DOT 要求：当 keyPath 以 `macro_configs.auxiliary_config` 开头时，重绑辅助宏与战斗宏热键；顺序为先 assistant 再 combat；空键只解注不注册。

---

## 5. 战斗宏执行入口（start_macro / stop_macro）（代码地址）

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| 5.1 | 热键触发的实际切换 | `controller/d3_macro_controller.py` 218–230 行：`_schedule_toggle_combat_macro()` 将 `_toggle_combat_macro()` 调度到主线程；`_toggle_combat_macro()` 若 `self.macro_running` 则 `self.stop_macro()`，否则 `self.start_macro()` |
| 5.2 | start_macro 逻辑 | 同上 126–146 行：若已 `macro_running` 则 return；从 CONFIG 读 `current_skill_config` 并 `get_macro_config_loader().load_active()`；若有 main function thread 则 `set_current_skill_config`；`trigger_extension_main_start_macro()`；`self.macro_running = True`；若无 main thread 则 `get_thread_registry().start_macro_fallback(self)`；最后若 `on_macro_start` 则调用 |
| 5.3 | stop_macro 逻辑 | 同上 148–158 行：若未 `macro_running` 则 return；`trigger_extension_main_stop_macro()`；`self.macro_running = False`；`clear_d3_window_cache()`；`get_thread_registry().stop_macro_fallback()`；若 `on_macro_stop` 则调用 |
| 5.4 | 扩展事件 | `d3utils/event_center.py`：`trigger_extension_main_start_macro()` / `trigger_extension_main_stop_macro()` 触发 `EXTENSION_MAIN_START_MACRO` / `EXTENSION_MAIN_STOP_MACRO`，handler 向 main function thread 投递 `put_command("start_macro")` / `put_command("stop_macro")` | `d3utils/event_center.py` 约 210–218、273–278 行；`providor/constants/common.py` EXTENSION_MAIN_START_MACRO / EXTENSION_MAIN_STOP_MACRO |

DOT 要求：主控制器提供 StartMacro / StopMacro，行为与上一致（读 current_skill_config、load_active、通知扩展/主功能线程、macro_running、fallback 启停、on_macro_start/on_macro_stop 回调）；热键路径上必须经「调度到主线程」再调用 Toggle（若已运行则 Stop，否则 Start）。

---

## 6. 热键底层注册与触发（代码地址）

与辅助宏共用：`d3utils/global_hotkey_manager.py` 的 `register_hotkey` / `unregister_hotkey`，`source="hotkey_registry"`，`priority=50`；`pycore/pyutils/hotkey_listener.py` 的 listener；`controller/game_interface_controller.py` 的 `initialize_game_interface()` 中 `hotkey_listener.start_listening()`。战斗宏与辅助宏在同一 `initialize_hotkeys()` 中注册，同一 listener 监听。

---

## 7. 小结：DOT 1:1 对应要点

- **配置**：`macro_configs.auxiliary_config.macro_start_hotkey`；与辅助宏 `assistant_hotkey` 分离；UI 标签使用 `main_functions_panel.macro_start_hotkey_label`（战斗宏启停热键），与辅助宏标签 key 不可混用。
- **注册**：启动时从 CONFIG 读 macro_start_hotkey，规范化后注册；回调内仅调注入的「调度到主线程再 Toggle」的委托，不读助理状态机。
- **主线程**：热键在后台线程触发，**必须**通过 `root.after(0, _toggle_combat_macro)` 或 DOT 的 `Dispatcher.Invoke` 等在主线程执行 start_macro/stop_macro，否则 UI/扩展线程状态可能不同步。
- **重绑与关闭**：与辅助宏相同路径 `HOTKEY_CONFIG_PATH_AUXILIARY` 触发重绑；关闭时 `unregister_all_auxiliary_hotkeys()` 同时解注 assistant 与 combat。

---

## 8. 深入细节（DOT 1:1 必现）

### 8.1 默认配置与模板

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 模板默认热键 | `providor/template_config.json` 中 `macro_configs.auxiliary_config.macro_start_hotkey` 默认 `"F2"`；`assistant_hotkey` 默认 `"F3"` | `providor/template_config.json` 约 559–560 行 |
| Controller 内默认 | `game_interface_controller._load_hotkey_config()` 中 `auxiliary_config.get('macro_start_hotkey', 'F9')` 仅用于该控制器内部打印，**不参与注册**；注册始终从 hotkey_registry 读 CONFIG | `controller/game_interface_controller.py` 约 94–95 行 |

### 8.2 战斗宏回调与主线程调度

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 为何必须主线程 | start_macro/stop_macro 会触发扩展事件、更新 macro_running、可能调 on_macro_start/on_macro_stop（刷新 UI）；若在热键线程直接执行会导致 UI 或扩展线程竞态 | `controller/d3_macro_controller.py` 218–230 行 |
| 调度方式 | 有 UI 且 root 存在：`self.ui.root.after(0, self._toggle_combat_macro)`；否则（如未建 UI 或已销毁）：直接 `_toggle_combat_macro()` | 同上 219–223 行 |
| _toggle_combat_macro | 仅做：若 `macro_running` 则 `stop_macro()`，否则 `start_macro()`；无参数，无返回值 | 同上 225–230 行 |

DOT 要求：热键回调内只调用「ScheduleToggleCombatMacro」；该函数必须在主/UI 线程上执行「若 MacroRunning 则 StopMacro 否则 StartMacro」。

### 8.3 与辅助宏的差异（勿混淆）

| 维度 | 辅助宏 | 战斗宏 |
|------|--------|--------|
| 配置键 | `assistant_hotkey` | `macro_start_hotkey` |
| 回调逻辑 | 读 get_assistant_state / can_start_assistant；若在运行则 set_assistant_should_stop(True)，否则调 _assistant_callback() | 仅调 _combat_callback()，无状态机 |
| 执行入口 | GameInterfaceController.run_assistant_auto_use() → GameAssistantController.auto_use_interface_function() | D3MacroController._toggle_combat_macro() → start_macro() / stop_macro() |
| 线程 | 回调在热键线程直接调 run_assistant_auto_use（Python 未 marshal） | 回调必须 marshal 到主线程再 _toggle_combat_macro |
| UI 行 | 主面板底部栏 row=1 | 主面板底部栏 row=0 |
| i18n label | `macro_pause_hotkey_label`（辅助宏启停热键） | `macro_start_hotkey_label`（战斗宏启停热键） |

### 8.4 重绑顺序与关闭

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 重绑顺序 | 同一 keyPath 下先 `reregister_assistant_hotkey()` 再 `reregister_combat_hotkey()` | `controller/d3_macro_controller.py` 273–276 行 |
| 关闭 | `unregister_all_auxiliary_hotkeys()` 遍历 `('assistant', 'combat')`，先 assistant 后 combat 解注 | `d3utils/d3u_common/hotkey_registry.py` 265–275 行 |

### 8.5 i18n 键

| 用途 | i18n key | 中文示例 | 英文示例 | 代码/配置 |
|------|----------|----------|----------|-----------|
| 战斗宏热键标签 | `main_functions_panel.macro_start_hotkey_label` | 战斗宏启停热键 | Combat Macro Hotkey / Macro Start Hotkey | `providor/i18n_config.json` 116、640 行；`i18n_main_window_zh.json` 67；`i18n_main_window_en.json` 67 |

与辅助宏 `macro_pause_hotkey_label` 区分，勿混用。

### 8.6 start_macro / stop_macro 与扩展事件

| 步骤 | 说明 | 代码/常量 |
|------|------|-----------|
| trigger_extension_main_start_macro | 触发后 event_center 的 handler 向 main function thread 投递 `put_command("start_macro")` | `runtime/__init__.py` 导出；`d3utils/event_center.py` 273–278、210–213 行；`providor/constants/common.py` EXTENSION_MAIN_START_MACRO |
| trigger_extension_main_stop_macro | 投递 `put_command("stop_macro")` | 同上 EXTENSION_MAIN_STOP_MACRO、215–218 行 |
| start_macro_fallback | 当无 main function thread 时由 ThreadRegistry 启动 controller 的 MacroLoopThread（fallback 宏循环） | `controller/d3_macro_controller.py` 141–143 行；`lifecycle/thread_registry.py` start_macro_fallback |
| stop_macro_fallback | 停止 fallback 线程 | 同上 156 行；thread_registry.stop_macro_fallback |

DOT 要求：StartMacro 时若存在主功能线程等价物则通知其开始并传 current_skill_config，否则启动 fallback 宏循环；StopMacro 时通知停止并停 fallback；Trigger 事件名/命令与 Python 一致以便扩展线程行为 1:1。

---

## 9. DOT 实现说明（dotapps/d3check）

DOT 端已按 1:1 逻辑实现战斗宏热键与 UI 绑定，并与 Python `.\pyapps\d3-check\main.py` 行为对齐。实现位置与调试输出如下。

| 项 | DOT 实现 | 说明 |
|----|----------|------|
| 热键回调日志 | `Hotkeys/D3CheckHotkeyBinder.cs`：`BuildCombatCallback()` | 回调内若 `_combatCallback` 已设置则先打 `[HOTKEY] Combat: Toggle macro...` 再调用；否则打 `[HOTKEY] Combat: Callback not set (controller not ready)`（与 Python hotkey_registry 195–201 行一致） |
| 主线程调度 | `DotCore.Utils/WindowsGlobalHotkeyService.cs`：`OnWmHotkey` 经 `_dispatcher.Invoke(entry.Callback)` | 热键线程收到 WM_HOTKEY 后由 MainThreadDispatcher 派发到 UI 线程，再执行 Toggle |
| Toggle/Start/Stop 调试 | `Ctl/CombatMacroController.cs` | `Toggle()` 打 `[CombatMacro] Toggle -> Start|Stop`；`StartMacro()` 打 `[CombatMacro] StartMacro: current_skill_config=...`；`StopMacro()` 打 `[CombatMacro] StopMacro` |
| UI 按钮 | `Panels/MainPanel.xaml`：`BtnCombatMacroToggle`；`MainPanel.xaml.cs`：`BtnCombatMacroToggle_Click` | 主面板底部栏「战斗宏 启/停」按钮，i18n key：`main_functions_panel.combat_macro_toggle_button`。点击时打 `[DEBUG][MainPanel] BtnCombatMacroToggle Click -> ...` 及 `MacroRunning=`，再调用 `UiRegistry.GetCombatMacroController()?.Toggle()` |
| Controller 注册 | `Ui/UiRegistry.cs`：`RegisterCombatMacroController` / `GetCombatMacroController`；`MainWindow.xaml.cs`：OnLoaded 中 `UiRegistry.RegisterCombatMacroController(_combatMacroController)` | 主窗口创建 CombatMacroController 并注册后，MainPanel 通过 UiRegistry 取得 controller 绑定按钮，等价于 Python UI 的 `on_ui_macro_start` / `on_ui_macro_stop` |

运行 DOT 应用后：按战斗宏热键（默认 F2）会看到 `[HOTKEY] WM_HOTKEY received` → `[HOTKEY] Dispatching id=combat` → `[HOTKEY] Combat: Toggle macro...` → `[CombatMacro] Toggle -> Start|Stop` 及后续 StartMacro/StopMacro 日志；点击「战斗宏 启/停」按钮会看到上述 `[DEBUG][MainPanel]` 与 `[CombatMacro]` 的详细输出。

---

## 10. 战斗宏按键发送流程（DOT 公共库 → D3 子库）

DOT 端战斗宏在 **fallback 循环** 中按当前配置向 D3 窗口发送按键与鼠标，与 Python `d3utils/macro_config_ops.run_one_skill_tick` 及 `controller/d3_macro_controller.MacroLoopThread` 行为 1:1 对应。架构为：**公共库（DotCore.Utils）→ D3 子库（D3CheckCore）**。

| 层级 | 说明 | DOT 实现 |
|------|------|----------|
| 公共库 | 窗口输入：发键、取客户区、置前台、光标是否在矩形内、按当前光标发鼠标点击 | `dotcore/DotCore.Utils/WindowInputHelper.cs`：`SendKey` / `PressKey`、`GetWindowClientRectScreen`、`SetForegroundWindow`、`IsCursorInRect`、`SendMouseClickAtCursor`；内部 `WindowInputNative` 调用 user32（PostMessage、GetClientRect、ClientToScreen、GetCursorPos、ScreenToClient、SetForegroundWindow） |
| D3 子库 | 技能键名→VK 映射；单 tick 逻辑：按 skill1..potion 顺序，根据 strategy/interval/delay/random_delay 决定是否发送，左/右键用 `WindowInputHelper.SendMouseClickAtCursor` 且需光标在 D3 客户区内（用 `GameInterfaceData.GetCachedD3ClientRect` + `IsCursorInRect`），其余键用 `WindowInputHelper.PressKey` | `dotapps/d3check/D3CheckCore/MacroSkillRunner.cs`：`KeyNameToVk`、`RunOneSkillTick(hwnd, skills, lastSkillTimes, now, cachedD3Rect)` |
| Fallback 循环 | 每轮：`D3WindowFinder.FindFirstHandle()` 取 D3 窗口；首次有效 hwnd 时刷新 D3 窗口缓存（`WindowInputHelper.GetWindowClientRectScreen` → `GameInterfaceData.RefreshD3WindowCache`）、`WindowInputHelper.SetForegroundWindow(hwnd)`；每 tick 取当前技能配置（`SkillConfigProvider`，由 app 设为 `MacroConfigLoader.Instance.GetCurrentSkillConfig`）、调用 `MacroSkillRunner.RunOneSkillTick` 更新 lastSkillTimes；停止时 `GameInterfaceData.ClearD3WindowCache` | `dotapps/d3check/D3CheckCore/MacroFallbackRunner.cs`：`RunLoop` 内 hwnd→cache→激活→每 100ms 一 tick；`Stop()` 中 `ClearD3WindowCache()`；`SkillConfigProvider` 在 `CombatMacroController` 构造函数中设为 `() => MacroConfigLoader.Instance.GetCurrentSkillConfig()` |

配置来源：`MacroConfigLoader.LoadActive()` 由 `CombatMacroController.StartMacro()` 调用，从 CONFIG 读 `macro_configs.skill_configs.{current}.skills` 写入内存；fallback 循环通过 `SkillConfigProvider` 取当前技能字典（skillKey → key/strategy/interval/delay/random_delay），与 Python `get_current_skill_config()` 一致。启动时根据配置自动激活 D3 窗口并开始按配置发送按键；配置修改后热键重绑沿用第 4 节（`HotkeyConfigPathAuxiliary`），技能配置修改后下次 tick 即使用新配置（因每 tick 调用 `GetCurrentSkillConfig()`）。

**每次启动读 CONFIG 载入**：每次 `StartMacro` 都会从 CONFIG 读取 `macro_configs.current_skill_config` 并调用 `MacroConfigLoader.LoadActive()`，将当前选中配置的技能表载入内存；切换「当前配置」下拉时也会立即调用 `LoadActive()`，保证 UI 与宏运行时使用的配置一致。架构为公共库（DotCore.Utils：WindowInputHelper）→ D3 子库（D3CheckCore：D3WindowFinder、MacroSkillRunner、MacroFallbackRunner）调用公共库；配置由主程序 Config（MacroConfigLoader）从 CONFIG 读取，经 `SkillConfigProvider` 注入给 MacroFallbackRunner。

---

以上细节均需在 DOT 端 1:1 实现或等价实现，以保证与 Python 战斗宏快捷键启停行为一致。热键规范化、HotkeyInput 行为、config 变更主线程 rebind、shutdown 解注等与 [DOT_REF_辅助宏快捷键启动流程.md](DOT_REF_辅助宏快捷键启动流程.md) 第 8 节共用，此处不重复。
