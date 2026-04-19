# UI 重启恢复上次 TAB 时 TAB 页空白 — 可能性报告（文档编号 5）

**现象**：目前 UI 重启、恢复到上一次 TAB 时，TAB 页没有渲染出内容，为空白。  
**范围**：`pyapps/d3-check`；先看代码 → 再看项目文档 → 再调用 MCP 查 Tkinter 官方文档；已按 §六 方向实施修改。  
**目录**：`docs/ui_5`（文档编号 5）。

---

## 一、代码现状（启动与 TAB 恢复流程）

### 1.1 启动顺序（Controller → UI → Timer）

| 步骤 | 位置 | 行为 |
|------|------|------|
| 1 | **controller/d3_macro_controller.py** L264 | `self.ui = Diablo3MacroUI(self.current_skill_config)` 创建主窗口 |
| 2 | **ui/diablo3_macro_ui.py** L151、L155 | `_initialization_complete = False`，随后 `_create_ui()` → `_create_main_tabs()` |
| 3 | **_create_main_tabs** L499-508 | 依次 `_create_table1_tab()` … `_create_table3_tab()`，`register_ui(self)`，**然后** `self.rosbot_extension_panel.ensure_content()` |
| 4 | **timers/timer_manager.py** L143-148 | `ensure_content()` 内调用 `timer_manager.submit_one_shot(...)`；若 `_running` 为 False 则 **直接 return，不排队**，并打印 `"[TimerManager] submit_one_shot ignored: timer not started yet"` |
| 5 | **_create_main_tabs** L513-524 | `main_notebook.bind('<<NotebookTabChanged>>', ...)`，`main_notebook.select(tab_ids[idx])`（idx = last_selected_tab），`bottom_bar.show_tab_content(idx)`，`root.update_idletasks()`，`root.update()` |
| 6 | **controller** L298-300 | `get_thread_registry().start_timer_loop_after_ui_ready()`（此处才 **timer_manager.start()**），`self.ui.start_system_tray_if_needed()`，**然后** `self.ui.run()`（mainloop） |

**结论**：`ensure_content()` 在 **TimerManager 尚未 start** 时被调用，`submit_one_shot` 被忽略，ROSBOT 面板内容创建任务从未入队。

### 1.2 ROSBOT 面板内容创建（懒加载 + 依赖 Timer）

| 位置 | 行为 |
|------|------|
| **rosbot_extension_panel.py** L152-159 | `ensure_content()`：若 `_content_created` 已为 True 则直接 return；否则 **仅** 调用 `timer_manager.submit_one_shot(lambda: _fetch_rosbot_config_then_create(self))`，无 fallback。 |
| **timer_manager.py** L143-149 | `submit_one_shot(callback)`：若 `_running` 为 False 则打印 "submit_one_shot ignored: timer not started yet" 并 **return**，不执行、不排队。 |
| **_fetch_rosbot_config_then_create** | 在 timer 线程中拉取 config snapshot，再 `panel.container.after(0, on_main)` 在主线程执行 `_create_content_with_snapshot(snapshot)`。 |

**结论**：ROSBOT 是唯一依赖「timer 线程 one_shot」创建内容的 tab；其他 tab（主功能、辅助、D4、校准、日志）均在 `_create_*_tab()` 内同步创建 Panel 与子控件，故只有恢复至 ROSBOT tab（index=2）时会出现空白。

### 1.3 首次 TAB 变更时的“初始化跳过”逻辑（修复前）

| 位置 | 行为（修复前） |
|------|----------------|
| **diablo3_macro_ui.py** L760-771（旧） | `_deferred_after_tab_changed()`：若 `_initialization_complete` 为 False，则设置 True 并 **立即 return**，不执行 `show_tab_content`、`_reregister_log_callback`、**ensure_content()**、`update_idletasks`/`update`。 |
| **diablo3_macro_ui.py** L513、L761 | `select(tab_ids[idx])` 触发 `<<NotebookTabChanged>>` → `after(0, _deferred_after_tab_changed)`。该 after(0) 在 **mainloop 开始后** 执行（此时 Timer 已由 `start_timer_loop_after_ui_ready()` 启动）。 |

**结论（修复前）**：首次 deferred 回调整段被跳过，恢复至 tab 2 时没有任何路径再调用 `ensure_content()`。

### 1.4 日志与现象对应

用户日志片段：

- `[UI-DBG] ensure_content ENTER t=...`
- `[TimerManager] submit_one_shot ignored: timer not started yet`
- `[UI-DBG] ensure_content EXIT submit_one_shot done t=0.001`
- `[UI] Tab changed to: 2`

对应代码路径：`_create_main_tabs()` 内 L508 的 `ensure_content()` 被调用时 Timer 未启动，one_shot 被忽略；随后 `select(2)` 触发 Tab changed，但 deferred 回调因初始化跳过而不调用 `ensure_content()`，故 TAB 2 内容始终未创建，显示空白。

---

## 二、项目文档与架构（简要）

- **docs/UI_AND_THREAD_ARCHITECTURE.md** §1.4：Rosbot 面板懒加载；首次选中 tab 2 时原为 `root.after(50, ensure_content)`，现实现为 `ensure_content()` → `submit_one_shot(_fetch_rosbot_config_then_create)`；若 timer 未启动则 one_shot 不执行。
- **docs/UI_AND_THREAD_ARCHITECTURE.md** §2.4：启动顺序为创建 UI → … → **start_timer_loop_after_ui_ready()** → ui.run()；即 Timer 在 mainloop **之前** 才启动，而 `_create_main_tabs()` 中的 `ensure_content()` 在 UI 构建阶段即被调用，早于 Timer 启动。
- **docs/DESIGN_ISSUES_MAJOR.md** §9：rosbot_extension_panel 内容为延迟创建（ensure_content 内部 submit_one_shot）；get_panel(PANEL_KEY_ROSBOT) 返回的 panel 在 ensure_content 完成前可能尚未完成内部控件创建。
- **runtime/thread_registry.py** L113-118：`start_timer_loop_after_ui_ready()` 内才调用 `timer_manager.start()` 并 `submit_one_shot(do_window_monitor_initial_check)`；此前任何 `submit_one_shot` 均会被忽略。

---

## 三、MCP 官方文档（tkdocs_pyref）要点

- **ttk.Notebook**：`add(child, **kw)` 添加 tab；`select(tab_id)` 选中并显示对应子控件；Notebook “displays a single one at a time”，即选中哪个 tab 就显示哪个 child，**不负责** 子控件是否已创建或是否为空。
- **结论**：TAB 内容是否空白由**子控件是否已创建**决定；若 ROSBOT 的 container 内从未执行 `_create_content_with_snapshot`，则该 tab 显示为空，与 Notebook 自身行为一致。

---

## 四、可能性归纳（按优先级）

### 可能性 1（高）：ensure_content 在 Timer 未启动时调用，submit_one_shot 被忽略

- **表现**：恢复至 ROSBOT tab 时该页空白。
- **依据**：`_create_main_tabs()` L508 在 `register_ui(self)` 后立即调用 `ensure_content()`，此时 Controller 尚未执行 `start_timer_loop_after_ui_ready()`，`timer_manager._running` 为 False，`submit_one_shot` 直接 return，ROSBOT 内容创建任务从未入队。
- **与日志一致**：用户日志中有 "submit_one_shot ignored: timer not started yet"。

### 可能性 2（高）：首次 Tab 变更时 _deferred_after_tab_changed 整段被跳过，未补调 ensure_content

- **表现**：即便 mainloop 后 Timer 已启动，恢复至 tab 2 时仍无内容。
- **依据**：`select(tab_ids[idx])` 触发 `_on_tab_changed` → `after(0, _deferred_after_tab_changed)`。首次执行时 `_initialization_complete` 为 False，代码在设置 `_initialization_complete = True` 后直接 return，不执行 `ensure_content()`，因此 **没有任何第二次机会** 在 Timer 已启动后为 ROSBOT 创建内容。
- **与架构一致**：设计上“初始化阶段跳过完整 update”以避免多余重绘，但顺带跳过了对 ROSBOT 的 ensure_content，导致恢复至 tab 2 时无内容。

### 可能性 3（中）：仅 ROSBOT 依赖 submit_one_shot，其他 tab 无此问题

- **表现**：仅当 last_selected_tab == 2（ROSBOT）时空白；恢复至 0/1/3/4/5 时正常。
- **依据**：其余 Panel 均在 `_create_*_tab()` 内同步创建子控件；只有 RosbotExtensionPanel 采用懒加载且仅通过 `ensure_content()` → `submit_one_shot` 创建内容。
- **与代码一致**：仅 `rosbot_extension_panel` 有 `ensure_content()` 且内部仅依赖 timer_manager.submit_one_shot。

### 可能性 4（低）：last_selected_tab 从 CONFIG 恢复为 2 的时机

- **表现**：若 last_selected_tab 未正确恢复，可能误选其他 tab；但若正确恢复为 2，则仍因上述 1、2 导致空白。
- **依据**：`_load_last_tab()` 在 `_create_main_tabs()` 开头调用，从 CONFIG 读 last_selected_tab；若为 4（坐标校准）会强制改为 0，避免“full UI freeze”。恢复为 2 时仅影响“选中哪个 tab”，不改变“ROSBOT 内容从未被创建”的事实。

---

## 五、代码实际与查找是否同一问题（对照表）

| 查找的问题 | 代码实际（修复前） | MCP/文档依据 | 是否同一问题 |
|------------|--------------------|--------------|--------------|
| **恢复上次 TAB 时 TAB 页空白** | 恢复的若是 tab 2（ROSBOT）：(1) L508 的 `ensure_content()` 在 Timer 未启动时调用，`submit_one_shot` 被忽略；(2) `select(2)` 触发的 `_deferred_after_tab_changed` 因 `_initialization_complete == False` 直接 return，不调用 `ensure_content()`。故 ROSBOT 内容从未创建。 | ttk.Notebook 只负责显示当前选中的 child；子控件未创建则显示为空。 | **是** |
| **仅 ROSBOT tab 空白** | 仅 RosbotExtensionPanel 使用懒加载 + `submit_one_shot`；其他 Panel 在 `_create_*_tab()` 内同步创建内容。 | 同上。 | **是** |
| **“submit_one_shot ignored” 与空白的关系** | `ensure_content()` 仅在 Timer 未启动时被调用（L508），且首次 tab 变更时 deferred 回调跳过 ensure_content，故 one_shot 从未在 Timer 启动后被提交。 | timer_manager 设计：未 start 时拒绝 one_shot。 | **是** |

---

## 六、优化与架构调整方向（仅设计，不实施代码）

### 6.1 确保 ROSBOT 内容在“恢复至 tab 2”时有机会创建

- **方向 A**：不在 `_create_main_tabs()` 内提前调用 `ensure_content()`；仅在「选中的 tab 为 2」时通过事件路径调用（例如在 `_deferred_after_tab_changed` 中**不**在初始化阶段跳过对 `ensure_content()` 的调用；或仅在 `selected_tab == TAB_INDEX_ROSBOT` 时允许初始化阶段也执行 ensure_content）。
- **方向 B**：将 ROSBOT 内容创建改为不依赖 Timer：例如在主线程用 `root.after(0, lambda: _fetch_rosbot_config_then_create_sync_or_async(...))` 或主线程内先取 snapshot 再 after(0, create_content)，使恢复至 tab 2 时即使 Timer 未启动也能创建内容（需评估主线程阻塞与 THREAD_BUS 约定）。
- **方向 C**：在 `start_timer_loop_after_ui_ready()` 之后、`ui.run()` 之前，若 `last_selected_tab == TAB_INDEX_ROSBOT`，显式调用一次 `rosbot_extension_panel.ensure_content()`，此时 Timer 已启动，submit_one_shot 会执行。

### 6.2 初始化跳过逻辑与 ensure_content 解耦

- **当前**：`_deferred_after_tab_changed` 用 `_initialization_complete` 一次跳过整段逻辑，包括 `ensure_content()`。
- **建议**：将「避免 init 阶段多余 update_idletasks/update」与「必须执行的逻辑」分离：例如 init 阶段仍执行 `bottom_bar.show_tab_content`、`_reregister_log_callback`、对 TAB_INDEX_ROSBOT 的 `ensure_content()`，仅跳过 `root.update_idletasks()` / `root.update()`；或单独标志位控制“仅跳过重绘”，不跳过 ensure_content。

### 6.3 时序与依赖关系文档化

- **建议**：在 docs（如 UI_AND_THREAD_ARCHITECTURE 或 DESIGN_ISSUES_MAJOR）中明确：(1) Timer 在 `start_timer_loop_after_ui_ready()` 中启动，早于 mainloop；(2) `_create_main_tabs()` 内对 `ensure_content()` 的调用早于 Timer 启动，因此该次调用不会使 ROSBOT 内容创建；(3) 恢复至 tab 2 时，必须依赖「Tab 变更后的 deferred 回调」或「Timer 启动后的显式 ensure_content」才能创建内容；当前因初始化跳过导致 deferred 回调未调用 ensure_content，需按 6.1/6.2 调整。

### 6.4 可选：统一懒加载策略

- 若其他 tab 未来也采用懒加载，建议约定：**内容创建入口**（如 ensure_content）不依赖「Timer 已启动」作为唯一路径；或在 Timer 未启动时 fallback 到主线程 after(0, …) 或同步创建（在符合 THREAD_BUS 与主线程不阻塞的前提下），避免“恢复上次 tab 即空白”的同一类问题。

---

## 七、文档与 MCP 引用

- **项目**：`ui/diablo3_macro_ui.py`（`_create_main_tabs`、`_on_tab_changed`、`_deferred_after_tab_changed`、`_initialization_complete`）、`ui/panels/rosbot_extension_panel.py`（`ensure_content`、`_fetch_rosbot_config_then_create`）、`timers/timer_manager.py`（`submit_one_shot`、`start`）、`runtime/thread_registry.py`（`start_timer_loop_after_ui_ready`）、`controller/d3_macro_controller.py`（`run()` 顺序）、`docs/UI_AND_THREAD_ARCHITECTURE.md`、`docs/DESIGN_ISSUES_MAJOR.md` §9。
- **MCP**：Context7 库 `tkdocs_pyref` — ttk.Notebook `add`/`select`，仅显示当前选中子控件，不保证子控件已创建。

---

## 八、已实施的代码修改（与 §六 方向一致）

- **文件**：`ui/diablo3_macro_ui.py`，`_deferred_after_tab_changed`。
- **修改要点**：初始化阶段（`_initialization_complete == False`）**不再整段 return**；先取 `selected_tab`，再执行 **必须逻辑**：`set_config_value_async("ui_settings.last_selected_tab", selected_tab)`、`bottom_bar.show_tab_content(selected_tab)`、`_reregister_log_callback()`、若 `selected_tab == TAB_INDEX_ROSBOT` 则 `rosbot_extension_panel.ensure_content()`；然后设置 `_initialization_complete = True` 并 return，**仅跳过** `root.update_idletasks()` / `root.update()`。
- **效果**：`select(tab_ids[idx])` 触发的 `after(0, _deferred_after_tab_changed)` 在 mainloop 后执行时，Timer 已由 `start_timer_loop_after_ui_ready()` 启动，此时在 init 分支内调用 `ensure_content()` 会使 `submit_one_shot` 成功入队，ROSBOT 内容得以创建，恢复至 tab 2 时不再空白。
- **与 §六 对应**：采用 6.2「初始化跳过逻辑与 ensure_content 解耦」：init 阶段仍执行 show_tab_content、_reregister_log_callback、ROSBOT 的 ensure_content，仅跳过重绘。

---

## 九、代码实际与查找是否同一问题（修复后对照）

| 查找的问题 | 代码实际（修复后） | 是否同一问题 / 状态 |
|------------|--------------------|----------------------|
| **恢复上次 TAB 时 TAB 页空白** | **修复后**：首次 `_deferred_after_tab_changed` 在 init 分支内会执行 `ensure_content()`（当 `selected_tab == TAB_INDEX_ROSBOT`），此时 Timer 已启动，`submit_one_shot` 成功，ROSBOT 内容在 timer 线程取 snapshot 后经 `after(0, on_main)` 创建，TAB 2 有内容。 | **是**；已通过解耦 init 跳过与 ensure_content 修复。 |
| **仅 ROSBOT tab 空白** | 仍仅 ROSBOT 依赖懒加载 + one_shot；修复后恢复至 tab 2 时 deferred 回调会补调 ensure_content。 | **是**；行为已修正。 |
| **“submit_one_shot ignored” 与空白** | L508 的 `ensure_content()` 仍会在 Timer 未启动时被调用（仍会 ignored），但不影响结果：真正生效的是 deferred 回调中（Timer 已启动后）的 `ensure_content()`。 | **是**；根因在「第二次机会」未调用，已修复。 |

---

## 十、小结

- **根因**：UI 重启并恢复至上次 TAB（尤其 tab 2 ROSBOT）时，(1) `_create_main_tabs()` 内调用的 `ensure_content()` 发生在 Timer 未启动前，`submit_one_shot` 被忽略；(2) `select(2)` 触发的 `_deferred_after_tab_changed` 在首次执行时因「初始化跳过」整段 return，未调用 `ensure_content()`，导致 ROSBOT 内容从未被创建，TAB 页空白。
- **代码实际与查找问题一致**：均为「恢复上次 TAB 时该 TAB 无内容渲染」；仅影响依赖懒加载 + Timer one_shot 的 ROSBOT tab。
- **已实施**：按 §六 6.2 在 `_deferred_after_tab_changed` 中将「必须执行的逻辑」（含 ROSBOT 的 ensure_content）与「仅跳过重绘」解耦，init 阶段仍执行 ensure_content，恢复至 tab 2 时内容可正常创建；文档与 MCP 引用见 §七。
