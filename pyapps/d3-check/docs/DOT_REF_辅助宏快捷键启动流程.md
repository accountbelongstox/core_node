# 辅助宏快捷键启动流程 — 供 DOT 参考

**说明**：本文档供 **DOT（.NET 端口）** 参考，要求 DOT 按 **DOT 规范**（[DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md)、[.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc)；**UI 层以 [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md)、[.cursor/rules/dot-ui.mdc](../../../.cursor/rules/dot-ui.mdc) 为规范**）实现，**功能与 Python 1:1 对应**。代码与注释使用英文/ASCII；行为与下述 Python 流程一致。

**更新**：本节新增 **§9 颜色类库、识别类库等在流程中的嵌入**，描述 ColorPrint、UnifiedStyles/UITheme、D3InterfaceManager、界面检测与模板匹配等在该流程中的嵌入位置与依赖顺序，便于 DOT 按 1:1 引入等价类库与初始化顺序。

---

## 1. 流程总览

- **入口**：用户按下「辅助宏启停热键」（UI 文案 i18n key：`main_functions_panel.macro_pause_hotkey_label`，中文「辅助宏启停热键」）。
- **配置键**：`macro_configs.auxiliary_config.assistant_hotkey`（与战斗宏 `macro_start_hotkey` 区分）。
- **行为**：启停「辅助宏」—— 若未运行则启动 `auto_use_interface_function`（铁匠/卡奈等自动化）；若已在运行则请求停止（热键再次按下即停止）。

---

## 2. 配置与 UI 绑定（代码地址）

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| 2.1 | 配置路径常量 | `d3utils/d3u_common/hotkey_registry.py`：`HOTKEY_CONFIG_PATH_AUXILIARY = "macro_configs.auxiliary_config"`，`CONFIG_KEY_ASSISTANT_HOTKEY = "assistant_hotkey"` |
| 2.2 | 主面板底部栏：辅助宏热键标签 + 输入框 | `ui/panels/main_functions_panel.py`：`_create_bottom_bar_in_frame`，row=1：Label 使用 `i18n_manager.get_ui_text("main_functions_panel.macro_pause_hotkey_label")`，HotkeyInput 初始值来自 `CONFIG["macro_configs"]["auxiliary_config"].get("assistant_hotkey")`，规范化用 `normalize_hotkey_canonical` |
| 2.3 | 用户修改热键时写回 CONFIG 并通知重绑 | `ui/panels/main_functions_panel.py` 约 617–623 行：`_on_assistant_hotkey_change(hotkey)` 写 `CONFIG["macro_configs"]["auxiliary_config"][CONFIG_KEY_ASSISTANT_HOTKEY] = hotkey`，`queue_config_save()`，`get_config_change_hub().notify_config_changed(HOTKEY_CONFIG_PATH_AUXILIARY)` |

DOT 要求：UI 热键控件与 `macro_configs.auxiliary_config.assistant_hotkey` 绑定；修改时写回 CONFIG 并触发 `ConfigKeys.HotkeyConfigPathAuxiliary`（或等价路径）的变更通知，以便立即重绑热键。

---

## 3. 热键注册与回调注入（代码地址）

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| 3.1 | 启动时从 CONFIG 注册辅助宏热键 | `d3utils/d3u_common/hotkey_registry.py`：`initialize_hotkeys()` 调用 `get_hotkey_registry().register_assistant_hotkey()`；`register_assistant_hotkey()` 从 `CONFIG['macro_configs']['auxiliary_config']['assistant_hotkey']` 读取，经 `normalize_hotkey_canonical` 后若为空则跳过并返回 False |
| 3.2 | 热键回调逻辑（在 d3utils 层，不引用 controller） | `d3utils/d3u_common/hotkey_registry.py` 约 96–111 行：`assistant_hotkey_callback()` 内：`state = get_assistant_state()`；若 `state["is_running"]` 则 `set_assistant_should_stop(True)`；否则若 `can_start_assistant()` 且 `_assistant_callback` 已设置则调用 `_assistant_callback()`，否则打日志 "Callback not set (controller not ready)" 或 "Cannot start - execution disabled" |
| 3.3 | 状态与可启动判定（providor） | `providor/providor_index.py`：`ASSISTANT_EXECUTION_STATE`（`is_running`, `should_stop`, `enabled`）；`get_assistant_state()` 返回该字典；`set_assistant_should_stop(value)` 写 `should_stop`；`can_start_assistant()` 返回 `not is_running and enabled` |
| 3.4 | Controller 注入助理回调（d3utils 不 import controller） | `controller/d3_macro_controller.py` 约 100 行：`set_assistant_callback(lambda: self.game_interface_controller.run_assistant_auto_use())` |
| 3.5 | 初始化顺序（热键在 CONFIG 与 callback 就绪后） | `d3utils/system_initializer.py` 约 207–229 行：先 `initialize_configuration()`，再 `ensure_cnocr_loaded_and_engines_initialized()`，再 `initialize_hotkeys()`；热键初始化失败仅 `ColorPrint.yellow` 不 return False。主控制器在创建时调用 `set_assistant_callback`，故须在 `initialize_hotkeys()` 之前或之后、UI/controller 创建时完成 callback 注入 |

DOT 要求：等效于 HotkeyRegistry 的模块从 CONFIG 读 `assistant_hotkey` 并注册；回调内仅读状态（get_assistant_state、can_start_assistant、set_assistant_should_stop），实际「启动助理」由 controller 注入的委托执行（1:1 对应 `run_assistant_auto_use`）。

---

## 4. 配置变更重绑（代码地址）

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| 4.1 | 订阅 config 变更，按路径决定是否重绑辅助宏热键 | `controller/d3_macro_controller.py` 约 273–275 行：`if key_path and key_path.startswith(HOTKEY_CONFIG_PATH_AUXILIARY)` 则 `get_hotkey_registry().reregister_assistant_hotkey()`（以及 `reregister_combat_hotkey()`） |
| 4.2 | 重绑实现：先解注旧键再注新键，新键为空则只解注 | `d3utils/d3u_common/hotkey_registry.py`：`reregister_assistant_hotkey()` 读 `auxiliary_config.assistant_hotkey`，若当前未注册且新键非空则 `register_assistant_hotkey()`；若已注册则比较新旧键，不同则 `unregister_hotkey(old)` 再 `register_hotkey(new, ...)`；新键为空则只 `unregister_hotkey(old)` 并清除本地记录（design §8.2） |

DOT 要求：当配置变更的 keyPath 以 `macro_configs.auxiliary_config` 开头时，重绑辅助宏热键（及战斗宏热键），语义与 Python 一致（空键只解注、不注册）。

---

## 5. 助理执行入口（run_assistant_auto_use）（代码地址）

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| 5.1 | 游戏界面控制器提供 run_assistant_auto_use | `controller/game_interface_controller.py` 约 78–83 行：`run_assistant_auto_use()` 若 `assistant_controller` 为 None 则取 `get_game_assistant_controller()`，然后调用 `self.assistant_controller.auto_use_interface_function()` |
| 5.2 | 助理控制器：一次截图、界面检测、分支执行 | `controller/game_assistant_controller.py`：`auto_use_interface_function()` 先 `can_start_assistant()` 否则 return False；`set_assistant_running(True)`；`should_stop_assistant()` 检查后执行：`collect_ui_info(force_new_capture=True)`，`_detect_interface_from_full_window`（左 30% 匹配 bag_opened_indicator → 铁匠，kanai_cube_left_panel_indicator → 卡奈），再按类型调铁匠或卡奈流程；各分支与 return 前在需要时调用 `reset_assistant_state()` / `should_stop_assistant()` |

DOT 要求：GameInterfaceController 提供 RunAssistantAutoUse，内部调用 GameAssistantController.AutoUseInterfaceFunction；状态通过等效于 providor 的 get_assistant_state / can_start_assistant / set_assistant_running / should_stop_assistant / reset_assistant_state 管理，支持热键再次按下即停止。

---

## 6. 热键底层注册与触发（代码地址）

| 步骤 | 说明 | Python 代码地址 |
|------|------|-----------------|
| 6.1 | 全局热键注册 API | `d3utils/global_hotkey_manager.py`：`register_hotkey(hotkey, callback, description, source, priority, enabled)` 经 worker 队列调用 `GlobalHotkeyManager._do_register`，内部 `register_global_hotkey(normalized_hotkey, wrapped_callback, ...)`；`unregister_hotkey(hotkey, source)` 同理 |
| 6.2 | 规范化与回调包装 | `d3utils/d3u_common/hotkey_registry.py`：`normalize_hotkey_canonical(hotkey)` 小写、去空格、保留 '+'；hotkey_registry 使用 `source="hotkey_registry"`, `priority=50` 调用 `register_hotkey` |
| 6.3 | 监听器启动 | `controller/game_interface_controller.py`：`initialize_game_interface()` 中 `self.hotkey_manager.hotkey_listener.start_listening()`；热键实际由 global_hotkey_manager 的 listener 触发后调用已注册的 callback |

DOT 要求：提供等效的全局热键注册/解注与规范化（如 HotkeyUtil.NormalizeCanonical）；辅助宏热键的 callback 由「HotkeyRegistry 等价层」注册，内部按上述 3.2 逻辑调用状态接口与注入的 RunAssistantAutoUse 委托。

---

## 7. 小结：DOT 1:1 对应要点

- **配置**：`macro_configs.auxiliary_config.assistant_hotkey`；与战斗宏 `macro_start_hotkey` 分离；UI 标签使用与「辅助宏启停热键」对应的 i18n key（如 main_functions_panel.macro_pause_hotkey_label）。
- **注册**：启动时从 CONFIG 读 assistant_hotkey，规范化后注册；回调内仅用 get_assistant_state、set_assistant_should_stop、can_start_assistant，实际启动由 controller 注入的 RunAssistantAutoUse 执行。
- **重绑**：config 变更 keyPath 以 `macro_configs.auxiliary_config` 开头时，重绑辅助宏（及战斗宏）热键；新键为空则只解注。
- **行为**：按下热键 → 若助理未运行且 can_start_assistant 则调用 RunAssistantAutoUse（内部 auto_use_interface_function：截图、界面检测、铁匠/卡奈等）；若已在运行则 set_assistant_should_stop(True)，实现「热键再次按下即停止」。

本文档仅描述流程与代码地址，供 DOT 按 DOT 规范实现与 Python 1:1 的辅助宏快捷键启动与启停行为。

---

## 8. 深入细节（DOT 1:1 必现）

### 8.1 默认配置与模板

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 模板默认热键 | `providor/template_config.json` 中 `macro_configs.auxiliary_config.assistant_hotkey` 默认 `"F3"`，`macro_start_hotkey` 默认 `"F2"`；合并后 CONFIG 若无用户覆盖则为此值 | `providor/template_config.json` 约 559–560 行 |
| Controller 内默认 | `game_interface_controller._load_hotkey_config()` 中 `auxiliary_config.get('assistant_hotkey', 'F10')` 仅用于该控制器内部打印/缓存，**不参与注册**；注册始终从 `hotkey_registry` 读 CONFIG | `controller/game_interface_controller.py` 约 94–96 行 |

### 8.2 热键字符串规范化（canonical）

| 层 | 规则 | 代码地址 |
|----|------|----------|
| hotkey_registry | `normalize_hotkey_canonical(hotkey)`：`str(hotkey).strip().lower()`，再 `.replace(" ", "")`；空或仅空白返回 `""`；**不**删除 `+` | `d3utils/d3u_common/hotkey_registry.py` 40–47 行 |
| HotkeyInput 输出 | 用户按键后传给 `on_change` 的为 **canonical**：修饰键顺序 `ctrl` → `shift` → `alt` → `win`，再主键；主键 F 键为小写如 `f3`；组合用 `+` 连接，如 `ctrl+f1`；Escape/Delete 传 `""` | `ui/widgets/hotkey_input.py` 283–344 行（`_on_key_press`）、301–306 行（Escape/Delete）、334–336 行（canonical 构建） |
| 底层 listener | `_normalize_hotkey`：`hotkey.lower().replace(' ', '').replace('+', '+')`（保留 `+`） | `pycore/pyutils/hotkey_listener.py` 386–387 行 |

DOT 要求：写入 CONFIG 与注册用的字符串须与上述 canonical 一致（小写、无空格、`+` 连接）；清空热键时写入空字符串并触发重绑，重绑侧空键只解注不注册。

### 8.3 HotkeyInput 控件行为（1:1 对应）

| 行为 | 说明 | 代码地址 |
|------|------|----------|
| 只读 + 捕获 | 控件 `state='readonly'`，仅通过按键捕获更新；FocusIn 时 `is_capturing=True`，FocusOut 时恢复 placeholder（若当前为空） | `ui/widgets/hotkey_input.py` 118、229–256、258–282 行 |
| 清空 | Escape 或 Delete → `current_hotkey=""`，`_set_placeholder()`，`on_change("")` | 同上 318–326 行 |
| 修饰键 | Control_L/R、Shift_L/R、Alt_L/R、Win_L/R 只计入 `_modifiers_canonical`，不单独触发 `on_change`；与主键一起按下时一次输出完整组合 | 同上 329–336 行 |
| 程序设置 | `set_hotkey(hotkey)`：空则显示 placeholder，非空则 `_display_hotkey(hotkey)`；主面板切换配置时用此刷新显示 | 同上 392–398 行 |
| placeholder i18n | `i18n_manager.get_ui_text("hotkey_input.placeholder")`；语言切换时若当前为空会刷新 placeholder | 同上 184、254、384 行 |

### 8.4 配置变更与重绑执行线程

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 订阅与派发 | `get_config_change_hub(self.ui.root).subscribe(...)` 收到变更后，用 `root.after(0, lambda: self._apply_config_sync_and_rebind_hotkeys(...))` 将**整段** sync+rebind 放到主线程执行 | `controller/d3_macro_controller.py` 约 264–266、268–277 行 |
| 重绑顺序 | 先 `reregister_assistant_hotkey()`，再 `reregister_combat_hotkey()`；两者均读当前 CONFIG，无需额外参数 | 同上 273–276 行 |
| reregister 失败回滚 | 若 `unregister_hotkey(old)` 成功但 `register_hotkey(new, ...)` 失败，则再次 `register_hotkey(old, ...)` 恢复旧键，并保持 `entry['hotkey']=old_hotkey`；若 unregister 失败则不改 entry | `d3utils/d3u_common/hotkey_registry.py` 161–176 行 |

### 8.5 热键回调执行线程与 RunAssistantAutoUse

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 回调线程 | 底层使用 `keyboard.add_hotkey`，callback 在 **keyboard 库的后台线程** 执行；`run_assistant_auto_use()` 及 `auto_use_interface_function()` 在该线程同步执行完毕（Python 未做 marshal 到主线程） | `pycore/pyutils/hotkey_listener.py` 394–408 行；`d3utils/global_hotkey_manager.py` 217–224 行（wrapped_callback 直接调 entry.callback()） |
| DOT 注意 | 若 DOT 的 UI/状态更新必须在主线程，则热键回调内调用 RunAssistantAutoUse 时需通过 `Dispatcher.Invoke` 等 marshal 到 UI 线程，行为上仍等价「按下热键 → 执行一次启/停」 | — |

### 8.6 助理状态机（ASSISTANT_EXECUTION_STATE）精确约定

| 键 | 类型 | 含义 | 默认 | 代码地址 |
|----|------|------|------|----------|
| is_running | bool | 助理流程是否正在运行 | False | `providor/providor_index.py` 55–59、65–68 行 |
| should_stop | bool | 是否请求停止（热键再次按下设为 True） | False | 同上 70–73、80–82 行 |
| enabled | bool | 是否允许启动 | True | 同上 75–78、84–86 行 |
| can_start_assistant() | — | `not is_running and enabled` | — | 同上 84–86 行 |
| reset_assistant_state() | — | 将三项置为 `False, False, True` | — | 同上 88–93 行 |

`auto_use_interface_function` 内 **所有** return/分支结束前必须保证状态一致：正常结束或提前退出均调用 `reset_assistant_state()`，具体调用点：76 行后 can_start 失败不 set_running；80；83–86（set_running 后立即 should_stop）；92–94（collect_ui 失败）；95–98（之后 should_stop）；124–125（界面检测失败）；131–132（collect_bag 失败）；134–137（之后 should_stop）；191（分支结束后统一 reset）。见 `controller/game_assistant_controller.py` 65–194 行。

### 8.7 关闭流程中的热键注销

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 注册 shutdown hook | `system_initializer` 在初始化时调用 `register_shutdown_hook(unregister_all_auxiliary_hotkeys)` | `d3utils/system_initializer.py` 约 35 行 |
| 执行时机 | `execute_shutdown()` 的 Step 2 中执行所有 shutdown hooks；Step 1 为停止 Ctrl+Click 等其它 listener，非 F2/F3 的 global hotkey listener | `d3utils/shutdown_manager.py` 148–171 行 |
| 只解注 assistant/combat | `unregister_all_auxiliary_hotkeys()` 仅遍历 `('assistant', 'combat')`，对每项 `unregister_hotkey(hotkey, "hotkey_registry")` 并从 `_registered_hotkeys` 删除；**不**动 custom 热键 | `d3utils/d3u_common/hotkey_registry.py` 265–275、382–384 行 |

### 8.8 初始化与 Listener 启动顺序（精确定序）

1. `initialize_configuration()` 加载/合并 CONFIG（含 template 的 assistant_hotkey）。
2. `ensure_cnocr_loaded_and_engines_initialized()`。
3. `initialize_hotkeys()`：`register_assistant_hotkey()` / `register_combat_hotkey()` 从 CONFIG 读键并向 global_hotkey_manager 注册；此时 **listener 尚未 start_listening**，热键已加入 manager 的 `hotkey_registry` 字典。
4. 主控制器创建：`D3MacroController.__init__` 中 `set_assistant_callback(...)` 注入回调。
5. `controller.run()` → `initialize_game_interface()` → `hotkey_manager.hotkey_listener.start_listening()`：此时才把已注册的热键挂到 `keyboard` 上开始监听。

故 DOT 须保证：先 CONFIG 就绪 → 再注册 assistant/combat 热键 → 再注入 RunAssistantAutoUse 委托 → 最后启动全局热键监听；顺序不可颠倒。

### 8.9 i18n 键与多语言

| 用途 | i18n key | 中文示例 | 英文示例 | 代码/配置 |
|------|----------|----------|----------|-----------|
| 辅助宏热键标签 | `main_functions_panel.macro_pause_hotkey_label` | 辅助宏启停热键 | Assistant Macro Hotkey / Macro Pause Hotkey | `providor/i18n_config.json` 117、641 行；`i18n_main_window_zh.json` 68；`i18n_main_window_en.json` 68 |
| 战斗宏热键标签 | `main_functions_panel.macro_start_hotkey_label` | 战斗宏启停热键 | Combat Macro Hotkey | 与上区分，勿混用 |
| 热键输入框占位 | `hotkey_input.placeholder` | 按下热键... | Press hotkey... | `ui/widgets/hotkey_input.py` 184、254、384 行；`providor/i18n/i18n_common_zh.json` 51；`i18n_common_en.json` 51 |

DOT 要求：标签与占位符均走 i18n，键名与 Python 一致；辅助宏与战斗宏的 label key 不可互换。

### 8.10 ConfigChangeHub 与 notify 的 key_path

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 传入的 key_path | UI 调用 `get_config_change_hub().notify_config_changed(HOTKEY_CONFIG_PATH_AUXILIARY)` 时传入的为**字符串** `"macro_configs.auxiliary_config"`（不包含 `.assistant_hotkey` 或 `.macro_start_hotkey`） | `ui/panels/main_functions_panel.py` 615、623 行 |
| 订阅过滤 | Controller 订阅时未传 key_prefix 或传 None 则收到所有变更；若传 key_prefix 则仅当 `key_path is not None and key_path.startswith(key_prefix)` 时调用 callback；当前 d3_macro_controller 使用 `subscribe(self._on_config_change_from_hub)` 未传 key_prefix，故收到任意 key_path | `share/values/config_change_hub.py` 41–49、91–96 行；`controller/d3_macro_controller.py` 334 行 |
| 主线程与合并 | `notify_config_changed` 不会在调用线程执行 callback；若有 root 则 `root.after(50, self._dispatch_pending)`（**50ms 延迟**，合并多次 notify）；若无 root 则加入 `_pending_queue`，待 `_set_root(root)` 后 `root.after(50, _flush_pending_queue)` | `share/values/config_change_hub.py` 56–75、37–40、77–83 行 |
| get_config_change_hub 的 root | 主面板写 CONFIG 后调用 `get_config_change_hub()` **不传 root**；Controller 在 run() 中调用 `get_config_change_hub(self.ui.root).subscribe(...)` 时传入 root，hub 会 _set_root，之后 notify 才能 after(50) 派发 | `share/values/config_change_hub.py` 17–24、36–40 行 |

DOT 要求：热键变更后 Notify 的 keyPath 为 `macro_configs.auxiliary_config`（或等价常量）；订阅方用 startswith 判断是否重绑热键；派发须在主/UI 线程且可做短延迟合并。

### 8.11 queue_config_save 与 CONFIG 写入顺序

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 语义 | `queue_config_save()` 向 SAVE_QUEUE 投递一次保存请求；**不阻塞**调用线程；实际写文件在独立线程；若队列满则 `put_nowait` 抛 queue.Full，被 except 忽略（不重试） | `providor/providor_index.py` 826–831、816–818、793–798 行 |
| 与 notify 顺序 | 主面板热键回调中**先**写 CONFIG，**再** `queue_config_save()`，**再** `get_config_change_hub().notify_config_changed(HOTKEY_CONFIG_PATH_AUXILIARY)`；重绑时从 CONFIG 读到的已是新值（因同线程先写后 notify） | `ui/panels/main_functions_panel.py` 617–623 行 |

DOT 要求：写 CONFIG → 排队保存 → Notify 变更；重绑逻辑读到的配置须为新值（同一主线程内先写再派发）。

### 8.12 CONFIG 中 assistant_hotkey 的类型与 normalize

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 读取方式 | `raw = (CONFIG.get('macro_configs', {}) or {}).get('auxiliary_config', {}) or {}` 再 `raw = raw.get('assistant_hotkey')`；若键缺失则 raw 为 None | `d3utils/d3u_common/hotkey_registry.py` 86–88 行 |
| 规范化入口 | `assistant_hotkey = normalize_hotkey_canonical(raw) if raw else ""`；**仅当 raw 为 truthy 时才调用 normalize**；若 raw 为 None、""、0、[] 等则结果为 ""，不注册 | 同上 88 行 |
| normalize 入参 | `normalize_hotkey_canonical(hotkey)` 内 `str(hotkey).strip().lower().replace(" ", "")`；若 CONFIG 误存为数字则会被转为字符串如 "0"，仍可能被注册；约定 CONFIG 中应存字符串或缺失 | 同上 40–47 行 |

DOT 要求：从配置读 assistant_hotkey 时做与 Python 一致的 truthy 判断；空/缺失则视为未配置，不注册；写入 CONFIG 的应为字符串（canonical 或用户可见格式由实现统一）。

### 8.13 global_hotkey_manager 的 source 与 unregister

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 注册时的 source | hotkey_registry 调用 `register_hotkey(..., source="hotkey_registry", ...)`；**字符串字面量** `"hotkey_registry"` | `d3utils/d3u_common/hotkey_registry.py` 115–121、204–210 行 |
| 解注时的 source | `unregister_hotkey(old_hotkey, "hotkey_registry")` 必须与注册时一致；GlobalHotkeyManager._do_unregister 中 `if entry.source != source` 则返回 False，不删除 | `d3utils/global_hotkey_manager.py` 161–163 行；hotkey_registry 154、156、273 行 |
| 冲突与 priority | 同一 hotkey 已存在且 priority 相同则新注册失败（不覆盖）；priority=50 为 hotkey_registry 固定值 | `d3utils/global_hotkey_manager.py` 199–213 行 |

DOT 要求：Unregister 时使用的 source 必须与 Register 时一致（如 `"hotkey_registry"` 或 DOT 等价常量）；否则解注失败，热键仍生效。

### 8.14 HotkeyInput：仅非修饰键按下触发 on_change

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 修饰键单独按下 | Control_L/R、Shift_L/R、Alt_L/R、Win_L/R 按下时只更新 `_modifiers_canonical` 与 `pressed_modifiers`，**不**构建 canonical，**不**调用 `on_change`，`return 'break'` | `ui/widgets/hotkey_input.py` 328–333 行 |
| 非修饰键按下 | 在 `_on_key_press` 中与 modifiers 一起构建 `parts`，`canonical = '+'.join(parts)`，`on_change(canonical)`；故**只有按下「主键」（如 F3、A、Space）时才会触发 on_change** | 同上 334–344 行 |
| 纯修饰键松开 | KeyRelease 只更新 `_modifiers_canonical` / `pressed_modifiers`，不调用 on_change | 同上 346–356 行 |

DOT 要求：热键输入框 1:1 行为——仅当用户按下「主键」（含修饰键组合）时写入 CONFIG 并触发重绑；仅按下/松开修饰键不触发。

### 8.15 模板与 CONFIG 中 auxiliary_config 的结构

| 项 | 说明 | 代码地址 |
|----|------|----------|
| 模板路径 | `macro_configs.auxiliary_config` 为对象；其下 `assistant_hotkey`、`macro_start_hotkey` 为**顶级键**（与 animation_speed、game_language、blood_shard 等并列） | `providor/template_config.json` 558–561 行 |
| 合并后 CONFIG | fix_config_with_template / 合并逻辑保证 `CONFIG["macro_configs"]["auxiliary_config"]` 存在且为 dict；主面板读取时用 `.get("assistant_hotkey")`，若用户从未保存过则来自模板默认 "F3" | 合并逻辑见 providor；主面板 629 行 |

DOT 要求：配置树中 `macro_configs.auxiliary_config.assistant_hotkey` 与 `macro_start_hotkey` 为平级键；默认值来自模板（F3/F2），缺省时重绑读到的为空或默认由实现约定。

### 8.16 助理状态 enabled 与 set_assistant_enabled

| 项 | 说明 | 代码地址 |
|----|------|----------|
| enabled 含义 | `can_start_assistant()` 为 `not is_running and enabled`；enabled=False 时热键按下不会启动助理（打日志 "Cannot start - execution disabled"） | `providor/providor_index.py` 75–78、84–86 行；`hotkey_registry.py` 105–111 行 |
| set_assistant_enabled | 由 providor 暴露，**当前热键回调不调用**；若别处（如 UI 或配置）调用 `set_assistant_enabled(False)` 可禁用「热键启动助理」，热键仍可响应「再次按下停止」 | `providor/providor_index.py` 75–78 行 |

DOT 要求：状态机提供 Enabled 与 SetAssistantEnabled；热键回调内仅通过 CanStartAssistant() 读 enabled，不修改 enabled；DOT 若实现「禁用助理」开关，应等价调用 SetAssistantEnabled(false)。

---

## 9. 颜色类库、识别类库等在流程中的嵌入（更新）

本节说明辅助宏快捷键流程所依赖的**颜色/样式类库**与**识别/模板类库**的嵌入位置及初始化顺序，供 DOT 引入等价实现时对齐。

### 9.1 颜色与日志类库

| 类库/模块 | 用途 | 在流程中的嵌入位置 | 代码地址 |
|-----------|------|--------------------|----------|
| **ColorPrint** | 控制台彩色日志（blue/green/yellow/red）；热键注册、回调、重绑、助理启停等均用其打日志 | hotkey_registry（注册/重绑/回调内）、game_assistant_controller（auto_use 各分支）、main_functions_panel（配置变更日志）、system_initializer（初始化与热键失败）、interface_manager（collect 结果） | `pycore/pyfoundations/color_print.py`；`d3utils/d3u_common/hotkey_registry.py` 多处；`controller/game_assistant_controller.py` 76–191；`ui/panels/main_functions_panel.py` 399、556、755、773；`d3utils/system_initializer.py` 229；`d3utils/interface_manager.py` 49、173 |
| **UnifiedStyles** | 主面板与 HotkeyInput 的 bg/fg/font/spacing；单源调色板 COLORS = UITheme.COLORS + 扩展键 | main_functions_panel：容器、Label、HotkeyInput、底部栏的 bg_primary/bg_secondary/text_primary/input_bg/input_text/accent/input_border、FONTS['label'/'default'/'input'/'code']、SPACING、TAB_PAD | `ui/unified_styles.py`（COLORS、FONTS、SPACING、PADDING、TAB_PAD）；`ui/panels/main_functions_panel.py` 103–104、173、207–216、227、251–253、287–300、336–340、437–652、599–679；`ui/widgets/hotkey_input.py` 92–98、134–150、161–174、205–226、234–246、264–275 |
| **UITheme** | ttk 样式单源入口；COLORS 被 UnifiedStyles 合并；主窗口 apply_to_root 后各面板不再单独 configure_ttk_styles | 主窗口应用主题后，主面板仅用 UnifiedStyles.COLORS/FONTS 配置 tk 控件；HotkeyInput 的 readonly/高对比样式依赖 UnifiedStyles.COLORS | `ui/theme/theme.py`；`ui/unified_styles.py` 14、44；`ui/panels/main_functions_panel.py` 100（注释：ttk from UITheme） |

DOT 要求：提供等效的日志输出（可按级别着色）；主面板与热键输入框的配色、字体、间距与 Python 单源（UnifiedStyles/UITheme）一致，便于 1:1 还原 UI 与可读性。

### 9.2 识别与界面采集类库

| 类库/模块 | 用途 | 在流程中的嵌入位置 | 代码地址 |
|-----------|------|--------------------|----------|
| **D3InterfaceManager** | 单例；collect_ui_info（刷新截图与 UI 区域）、collect_bag_info_from_current_shared（基于当前 shared 图采背包，不二次截图） | 热键触发 run_assistant_auto_use → auto_use_interface_function：Step 1 调用 `interface_manager.collect_ui_info(force_new_capture=True, save_screenshot=False)`；Step 3 调用 `collect_bag_info_from_current_shared(save_screenshot=False)`；**必须先 collect_ui_info 再 collect_bag** | `d3utils/interface_manager.py`（D3InterfaceManager、get_d3_interface_manager）；`controller/game_assistant_controller.py` 22、51、89、128 |
| **interface_detection** | 从全窗口图检测界面类型：左 30% 内匹配 bag_opened_indicator → 铁匠，kanai_cube_left_panel_indicator → 卡奈 | auto_use_interface_function Step 2：取 `get_game_interface_data().game_window_image`，调用 `detect_interface_type_from_full_window(full_window, want_blacksmith=...)`；返回 "blacksmith" | "kanai_cube" | None | `d3utils/interface_detection.py`（detect_interface_type_from_full_window）；`controller/game_assistant_controller.py` 36、54–63、100–111 |
| **d3_scaled_template_matcher** | 模板匹配；供 interface_detection 调用 match_template（target_image, template_name） | detect_interface_type_from_full_window 内若未传入 matcher 则 `matcher = get_d3_scaled_template_matcher()`；匹配结果需经 `is_match_center_in_left_region(match, image_width)` 判定左 30% | `d3utils/d3_scaled_template_matcher.py`；`d3utils/interface_detection.py` 14、46、52–68；`share/scaled_template_matcher_base.py`（is_match_center_in_left_region） |
| **模板名常量** | bag_opened_indicator、kanai_cube_left_panel_indicator 等名称单源 | providor.constants.d3：BAG_OPENED_INDICATOR_TEMPLATE_NAME、KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME；interface_detection 与模板配置共用 | `providor/constants/d3.py`；`d3utils/interface_detection.py` 16–18、54、62–67 |
| **get_game_interface_data()** | 共享数据：game_window_image、interface_type 等；collect_ui_info 后写入 | auto_use 中 Step 2 读 full_window = shared_data.game_window_image；Step 3 后读 resolved_type = shared_data.interface_type or interface_type | `share/game_interface_data.py`；`controller/game_assistant_controller.py` 102–103、141–142 |

DOT 要求：助理执行路径 1:1 依赖「先 collect_ui_info 再 collect_bag」；界面类型检测依赖全窗口图 + 模板匹配 + 左 30% 规则；模板名与常量与 Python 一致，便于复用配置与模板资源。

### 9.3 初始化顺序中的 CnOCR / 识别前置

| 阶段 | 说明 | 代码地址 |
|------|------|----------|
| ensure_cnocr_loaded_and_engines_initialized | 在 initialize_hotkeys **之前**执行；加载 CnOCR 与引擎（OCR 识别用）；**与热键注册无直接依赖**，但同属 system_initializer 顺序 | `d3utils/system_initializer.py` 211–215、227–229；`d3utils/cnocr_engine_registry.py` |
| 助理流程是否用 OCR | auto_use_interface_function 内当前**不直接调用** CnOCR；铁匠/卡奈流程若后续用 OCR 识别文字，则依赖此前已加载的 CnOCR | 当前 `game_assistant_controller.py` 未 import cnocr；识别仅用模板匹配 + 左 30% |

DOT 要求：若 DOT 端有统一「识别/OCR 前置初始化」，其顺序应与 Python 一致（在热键初始化之前）；助理流程 1:1 时先实现模板匹配与 collect_ui/collect_bag 顺序，OCR 可按需后续接入。

### 9.4 嵌入顺序小结

- **UI 与热键配置**：主面板创建时依赖 UnifiedStyles/UITheme（颜色、字体、间距）；HotkeyInput 的 initial_value 来自 CONFIG，on_change 写回 CONFIG 并 notify；ColorPrint 仅用于日志，不参与绑定。
- **热键回调执行**：回调内 get_assistant_state/can_start_assistant/set_assistant_should_stop 与 _assistant_callback()；_assistant_callback 即 run_assistant_auto_use → GameAssistantController.auto_use_interface_function。
- **auto_use 内识别链**：collect_ui_info(force_new_capture=True) → get_game_interface_data().game_window_image → detect_interface_type_from_full_window（get_d3_scaled_template_matcher、左 30% 规则）→ collect_bag_info_from_current_shared → 按 interface_type 分支铁匠/卡奈。

以上类库在流程中的嵌入位置与顺序均需在 DOT 端 1:1 或等价实现，以保证行为与 Python 一致。

---

## 10. Python 如何找到 D3 窗口并进行截图识别（1:1 供 DOT 实现）

本节按执行顺序描述 Python 端「辅助宏热键 → auto_use_interface_function」中**查找 D3 窗口**与**截图、识别**的完整链，便于 DOT 1:1 实现。

### 10.1 查找 D3 窗口（find_windows）

| 步骤 | 说明 | Python 代码位置 |
|------|------|-----------------|
| 入口 | D3Manager.find_windows(use_cache=True) | `d3utils/d3_manager.py` 106–112 行 |
| 优先按 exe | 若配置 d3.d3_path 存在且为有效文件，则 _find_windows_by_exe()：EnumWindows 回调中 IsWindowVisible、get_process_exe_path(hwnd) 与 DIABLO_III_EXE_NAME 比较，匹配则 GetWindowRect、GetWindowText、GetClassName 填入 list | 同上 66–95、108–109 行 |
| 否则按标题 | _find_windows_by_title(use_cache)：WindowFinder.find_windows_by_titles(titles=DIABLO_III_WINDOW_TITLES, match_mode="in", use_cache, skip_browser_if=...) | 同上 97–105、111 行 |
| 常量 | DIABLO_III_EXE_NAME = "Diablo III.exe"；DIABLO_III_WINDOW_TITLES 来自 providor（如 ["Diablo III"]） | `providor/constants/d3.py`；`providor/providor_index.py` |
| 返回 | List[Dict]：每项含 hwnd, title, class_name, rect, width, height；取第一个窗口即 D3 主窗口 | 同上 |

DOT 要求：等价实现「按配置 exe 路径优先查找，否则按进程名/标题查找」；返回可用 hwnd 供截图使用。当前 DOT 已有通过 Process.GetProcessesByName("Diablo III") 取 MainWindowHandle 的模式（如 CalibrationPanel、RosbotFlowController），可先复用该模式，再扩展为「d3.d3_path 存在时按 exe 路径 + EnumWindows」与 Python 一致。

### 10.2 截图与写入共享数据（collect_ui_info 链）

| 步骤 | 说明 | Python 代码位置 |
|------|------|-----------------|
| 前置缓存 | 当 window_titles 与 get_d3_manager().get_capture_titles() 一致时，gen() 内调用 get_d3_manager().prime_window_cache_for_capture()：find_windows → 取第一个窗口 rect，写入 ENCYCLOPEDIA["window_cache_<label>"]（hwnd, title, rect, left/top/right/bottom/width/height） | `d3utils/screenshot_provider.py` 237–240 行；`d3utils/d3_manager.py` 171–194 行 |
| 生成截图 | ScreenshotProvider.gen(use_optimized_capture=True, window_titles=DIABLO_III_WINDOW_TITLES)：screenshot_manager.screenshot_first_window_by_titles(titles, use_cache=True, save_to_disk=False)；优化模式下返回的即为游戏窗口图（game_window_image），无全屏图 | `d3utils/screenshot_provider.py` 338–369、409–424 行 |
| 写共享数据 | get_game_interface_data() 单例：fullscreen_image、game_window_image、window_offset、fullscreen_size、game_window_size、timestamp；update_global_scale(game_window_size) | `share/game_interface_data.py`；screenshot_provider 内 412–419 行 |
| UI 区域 | UIRegionCollectorOptimized.collect(force_new_capture=True)：调用 _screenshot_provider.gen(...)；从 ENCYCLOPEDIA 取 window_cache 得到 left/top/width/height；构建 UIRegion；shared_data.ui_region = ui_region；**依赖 shared_data.game_window_image 已由 provider 写入** | `d3utils/collectors/ui_region_collector_optimized.py` 71–119 行 |

DOT 要求：提供等价「按 hwnd 截游戏窗口」并写入共享数据结构（含 game_window_image 或等价 Bitmap、game_window_size）；调用 UpdateGlobalScale(actualWidth, actualHeight)。DOT 已有 ScreenCaptureService.Gen(gameWindowHwnd)、GameInterfaceData.UpdateGlobalScale，需在 Gen 后把 game_window_size 传入 UpdateGlobalScale，并可选将 GameWindowImage 暴露给后续检测（若 DOT 共享数据持有一份引用或副本）。

### 10.3 界面类型检测（detect_interface_type_from_full_window）

| 步骤 | 说明 | Python 代码位置 |
|------|------|-----------------|
| 输入 | full_image = get_game_interface_data().game_window_image（即上一步截图）；image_width = full_image 的宽（PIL Image 或 ndarray） | `controller/game_assistant_controller.py` 102 行；`d3utils/interface_detection.py` 46–48 行 |
| 匹配顺序 | want_blacksmith 时先匹配 BAG_OPENED_INDICATOR_TEMPLATE_NAME；再匹配 KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME | `d3utils/interface_detection.py` 51–69 行 |
| 模板匹配 | matcher = get_d3_scaled_template_matcher()；matcher.match_template(target_image=full_image, template_name=..., output_dir=None)；取 matches[0]，success 且 is_match_center_in_left_region(match, image_width) 则返回 "blacksmith" 或 "kanai_cube" | `d3utils/d3_scaled_template_matcher.py`；`share/scaled_template_matcher_base.py` 150–165 行（LEFT_REGION_RATIO=0.3） |
| 左 30% 规则 | is_match_center_in_left_region(match, image_width, ratio=0.3)：match["center"] 的 x &lt; image_width * ratio | `share/scaled_template_matcher_base.py` 150–170 行 |

DOT 要求：等价实现「全窗口图 + 模板匹配 + 左 30% 判定」；模板名与常量与 Python 一致（BAG_OPENED_INDICATOR_TEMPLATE_NAME、KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME）。若 DOT 暂未实现模板匹配库，可先实现「取图 → UpdateGlobalScale」与「未检测到界面」的日志分支，检测逻辑返回 None 并打日志。

### 10.4 背包/界面信息（collect_bag_info_from_current_shared）

| 步骤 | 说明 | Python 代码位置 |
|------|------|-----------------|
| 前置 | 必须先 collect_ui_info，使 shared_data.game_window_image 已有数据 | `d3utils/interface_manager.py` 166–177 行 |
| 调用 | interface_manager.collect_bag_info_from_current_shared(save_screenshot=False)：从 get_game_interface_data().game_window_image 读图；_bag_collector.collect(force_refresh=True, save_screenshot=False) | 同上 |
| 结果 | BagCoordinates（top_left, bottom_right, width, height, rows, cols, total_slots）或 None | `share/game_interface_data.py` BagCoordinates |

DOT 要求：在「已有 game_window_image 与 scale」的前提下实现等价 collect_bag（或先 stub 返回 null，打日志「collect_bag not yet implemented」）。

### 10.5 小结：DOT 实现顺序建议

1. **查找 D3 窗口**：按进程名 "Diablo III" 取 MainWindowHandle（或扩展为 d3.d3_path + EnumWindows）。
2. **截图**：ScreenCaptureService.GetScreenshotProvider().Gen(hwnd)；用返回的 GameWindowSize 调用 GameInterfaceData.Instance.UpdateGlobalScale。
3. **界面检测**：若有模板匹配库则 1:1 实现 detect_interface_type_from_full_window（左 30%、两模板名）；否则 stub 返回 null 并打日志。
4. **collect_bag**：若有背包检测逻辑则 1:1；否则 stub 并打日志。
5. **铁匠/卡奈分支**：按 interface_type 调用对应 handler（Python：blacksmith_handler、run_kanai_*）；DOT 可先打日志再逐步实现。

---

以上细节均需在 DOT 端 1:1 实现或等价实现，以保证与 Python 行为一致。

**相关文档**：[DOT_REF_战斗宏快捷键启动流程.md](DOT_REF_战斗宏快捷键启动流程.md) 描述战斗宏热键（macro_start_hotkey）的配置、注册、主线程调度与启停逻辑，与本文档共用配置路径、重绑与关闭流程。

**相关文档**：[DOT_REF_战斗宏快捷键启动流程.md](DOT_REF_战斗宏快捷键启动流程.md) 描述战斗宏热键（macro_start_hotkey）的配置、注册、主线程调度与启停逻辑，与本文档共用配置路径、重绑与关闭流程。
