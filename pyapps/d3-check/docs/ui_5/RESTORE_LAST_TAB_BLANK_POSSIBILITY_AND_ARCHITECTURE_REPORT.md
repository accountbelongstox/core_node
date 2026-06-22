# UI 重启恢复上次 TAB 时页内容空白 — 可能性报告与架构分析

**问题**：目前 UI 重启、恢复到上一次 TAB 时，TAB 页没有渲染出内容，为空白。  
**范围**：`pyapps/d3-check`；文档编号 5；目录 `docs/ui_5`。  
**依据**：先看代码 → 再看项目文档 → 再通过 MCP 查 Tkinter 官方文档；**仅创建文档，暂不修改代码**。

---

## 一、代码现状（启动与 TAB 恢复流程）

### 1.1 启动顺序（Controller → UI → Timer）

| 步骤 | 位置 | 行为 |
|------|------|------|
| 1 | **controller** L264 | `self.ui = Diablo3MacroUI(self.current_skill_config)`，UI 完整构建 |
| 2 | **diablo3_macro_ui** L151 | `_initialization_complete = False`（在 `_create_ui` 前设置） |
| 3 | **diablo3_macro_ui** L306 | `_create_ui()` → `_create_main_tabs()` |
| 4 | **diablo3_macro_ui** L494-495 | `_load_last_tab()`：从 CONFIG 读 `last_selected_tab`，赋给 `self.last_selected_tab` |
| 5 | **diablo3_macro_ui** L499-504 | `_create_table1_tab()` … `_create_table3_tab()`，创建所有 tab 与 panel（含 RosbotExtensionPanel） |
| 6 | **diablo3_macro_ui** L508 | `self.rosbot_extension_panel.ensure_content()` **此时被调用** |
| 7 | **rosbot_extension_panel** L159 | `timer_manager.submit_one_shot(lambda: _fetch_rosbot_config_then_create(self))` |
| 8 | **timer_manager** L145-147 | `if not _running:` → **`submit_one_shot` 被忽略**，打印 "submit_one_shot ignored: timer not started yet" |
| 9 | **diablo3_macro_ui** L514-523 | 绑定 `<<NotebookTabChanged>>`，`idx = last_selected_tab`，`main_notebook.select(tab_ids[idx])`，`bottom_bar.show_tab_content(idx)`，`root.update_idletasks()`，`root.update()` |
| 10 | **diablo3_macro_ui** L760-762 | `select()` 触发 `<<NotebookTabChanged>>` → `_deferred_after_tab_changed()` |
| 11 | **diablo3_macro_ui** L769-771 | `if not _initialization_complete:` → `_initialization_complete = True` 并 **return**，不执行 `ensure_content()`、不执行 `update_idletasks/update` |
| 12 | **controller** L299 | `get_thread_registry().start_timer_loop_after_ui_ready()` → **此时才启动 Timer** |

**结论**：ROSBOT 面板内容依赖 `ensure_content()` → `submit_one_shot(_fetch_rosbot_config_then_create)`。该调用发生在 `_create_main_tabs()` 内，早于 Timer 启动，故 `submit_one_shot` 被忽略，内容从未被调度创建。随后 `select(last_selected_tab)` 触发 tab 变更，但 `_deferred_after_tab_changed` 在初始化阶段直接 return，不会对当前选中的 tab（例如 ROSBOT）再调 `ensure_content()`。若上次选中的是 TAB 2（ROSBOT），则恢复的正是该 tab，但其内容从未创建 → **表现为该 TAB 页空白**。

### 1.2 ROSBOT 面板的延迟创建

| 位置 | 行为 |
|------|------|
| **rosbot_extension_panel** L152-160 | `ensure_content()`：若未创建则 `submit_one_shot(_fetch_rosbot_config_then_create)`，在 timer 线程取配置后通过 `panel.container.after(0, on_main)` 在主线程执行 `_create_content_with_snapshot` |
| **share/ui_registry** L41-43 | 说明：PANEL_KEY_ROSBOT 在「首次切换到该 tab 或 ensure_content 完成前」可能尚未创建内部控件（`_content_created=False`） |
| **diablo3_macro_ui** L776-778 | 非初始化阶段：`_deferred_after_tab_changed` 中若 `selected_tab == TAB_INDEX_ROSBOT` 会调用 `ensure_content()`，此时 Timer 已启动，`submit_one_shot` 有效 |

因此：**只有用户在 Timer 启动后手动切换到 ROSBOT tab，才会触发有效的 `ensure_content()`；启动时若直接恢复为 ROSBOT tab，不会再次触发 `ensure_content()`，内容永远不创建。**

### 1.3 其他 TAB 为何不空白

其余 panel（Main、Auxiliary、D4、Calibration、Log）均在各自 `__init__` 中同步创建完整内容（container 内 pack/grid 等），不依赖 Timer 或 one_shot。故恢复为 tab 0/1/3/4/5 时，内容已存在，不会空白。仅 ROSBOT 采用「首次 ensure_content 时通过 submit_one_shot 延迟创建」，且该路径在启动时失效。

---

## 二、项目文档与架构（简要）

- **THREAD_BUS_AND_REGISTRY / timers**：Timer 在「UI 就绪后」由 Controller 调用 `start_timer_loop_after_ui_ready()` 启动，避免在控件未创建时执行状态回调。
- **share/ui_registry**：明确 ROSBOT panel 可能尚未完成内部控件创建，调用方需检查 `_content_created` 或确保 `ensure_content` 已完成。
- **rosbot_extension_panel**：为减少主线程阻塞，配置在 timer 线程读取，再在主线程用 snapshot 创建 UI（THREAD_BUS §5）；但 one_shot 依赖 Timer 已运行。

---

## 三、官方文档（MCP tkdocs_pyref）要点

- **ttk.Notebook**：`add(child, **kw)` 添加 tab；`select(tab_id)` 选中 tab；Notebook 同时只显示一个子窗口。选中某 tab 仅切换显示哪个 child，**不负责创建 child 内容**；若 child 内无控件或未 pack/grid，则该 tab 显示为空。
- **时序**：先 add 再 select 为常规用法；若 child 内容依赖异步或延迟创建，需保证在 select 前或选中后某时刻完成内容创建，否则会出现「选中但空白」的现象。

---

## 四、可能性归纳（按优先级）

### 可能性 1（高）：ensure_content 在 Timer 启动前调用，submit_one_shot 被忽略

- **表现**：恢复为 ROSBOT tab 时该页空白。
- **依据**：`_create_main_tabs()` 中调用 `ensure_content()` 时 Timer 尚未启动，`submit_one_shot` 直接 return，`_fetch_rosbot_config_then_create` 从未执行，`_content_created` 始终 False，ROSBOT 容器内无控件。
- **与日志一致**："[TimerManager] submit_one_shot ignored: timer not started yet" 与 "[UI-DBG] ensure_content EXIT submit_one_shot done" 紧接出现，且 "Tab changed to: 2" 表明当前选中的是 ROSBOT。

### 可能性 2（高）：初始化阶段 Tab 变更回调故意跳过 ensure_content

- **表现**：即便 select(tab_ids[2]) 触发 `<<NotebookTabChanged>>`，也不会对当前 tab 补建内容。
- **依据**：`_deferred_after_tab_changed` 中若 `not _initialization_complete` 则设 `_initialization_complete = True` 并 return，不执行 `if selected_tab == TAB_INDEX_ROSBOT: ensure_content()`，设计上为避免 init 时重复 update，但导致「恢复为 ROSBOT」时失去唯一一次在 select 后补建内容的机会。
- **结果**：启动时恢复的若是 ROSBOT，既没有有效的 ensure_content（可能性 1），也没有在 tab 变更里补调 ensure_content（可能性 2），双重原因导致空白。

### 可能性 3（中）：Timer 启动与 ROSBOT 内容创建的时序未约定

- **表现**：架构上 Timer「在 UI 就绪后」启动，但「就绪」不包含「ROSBOT 内容已创建」；ROSBOT 内容又依赖 Timer 的 one_shot，形成循环依赖。
- **依据**：Controller 在 `start_timer_loop_after_ui_ready()` 之后没有对「当前若为 ROSBOT tab 则再调 ensure_content」的约定或调用。

### 可能性 4（低）：Tk 对未映射 tab 的 child 不布局

- **表现**：若认为「未选中的 tab 的 child 不参与布局」，则恢复时选中的 tab 的 child 应已参与布局；本项目中空白主因是 child 内根本没有创建控件，而非 Tk 不布局。该可能性为次要。

---

## 五、代码实际与查找是否同一问题

| 查找的问题 | 代码实际 | MCP/官方文档 | 是否同一问题 |
|------------|----------|--------------|--------------|
| **恢复上次 TAB 时该页空白** | 当上次为 ROSBOT(tab 2) 时：ensure_content 在 Timer 启动前调用，submit_one_shot 被忽略；且 init 阶段 tab 变更回调直接 return，不补调 ensure_content，ROSBOT 内容从未创建 | Notebook 只负责切换显示哪个 child；child 内容需由应用自行创建。若 child 内无控件，则显示为空 | **是**：现象为「恢复的 TAB 页空白」，本质为该 tab 的 child（ROSBOT panel 的 container）内未创建任何控件，与「Notebook 仅切换显示、不负责内容创建」一致 |

---

## 五.2 代码实际（修复后）与查找是否同一问题（续）

**依据**：先看代码 → 再看文档 → 再调用 MCP（tkdocs_pyref：Notebook、widget.after 延后回调）。

### 已实现修复（方案 B）

| 维度 | 内容 |
|------|------|
| **代码实际（修复后）** | **controller/d3_macro_controller.py**：① 在 `start_timer_loop_after_ui_ready()` 之后执行 `self.ui.root.after(50, self._ensure_rosbot_content_if_selected)`，在主线程 50ms 后执行一次补建检查；② 新增 `_ensure_rosbot_content_if_selected()`：若 `main_notebook` 当前选中为 `TAB_INDEX_ROSBOT` 且 `get_ui_panel(PANEL_KEY_ROSBOT)._content_created` 为 False，则调用 `panel.ensure_content()`。此时 Timer 已运行，`submit_one_shot` 有效，ROSBOT 内容可被创建。 |
| **MCP/官方文档** | tkdocs：Notebook 的 `select()` 切换显示 child；child 内容由应用创建。Tk 的 `widget.after(ms, callback)` 在主线程延后执行回调，用于在「Timer 已就绪」后再触发 ensure_content，与「异步/延迟创建」的常见用法一致。 |
| **是否同一问题** | **是**。修复针对「恢复为 ROSBOT 时内容未创建」的同一问题；通过「Timer 启动后主线程 after 补调 ensure_content」在不动 Notebook 用法的前提下补齐时序，与文档中「child 内容需在适当时机由应用创建」一致。 |

### 架构上的约定（修复后）

- **时序**：Timer 启动后 50ms，Controller 检查「当前 tab 是否为 ROSBOT 且未创建内容」，若是则调用 `ensure_content()`，保证恢复为 ROSBOT 时有一次在 Timer 已就绪后的补建机会。
- **不变**：ROSBOT 仍通过 `submit_one_shot(_fetch_rosbot_config_then_create)` 在 timer 线程取配置、主线程建 UI；不在 Timer 未启动时改为主线程同步取配置，避免阻塞主线程。

---

## 六、架构优化建议（方案 B 已实现，其余为可选）

### 6.1 保证 ROSBOT 内容在「恢复 tab」后仍能创建

- **方案 B（已实现）**：Timer 启动后由 Controller 通过 `root.after(50, _ensure_rosbot_content_if_selected)` 执行一次「若当前选中 tab 为 ROSBOT 且未创建内容则调用 ensure_content()」，保证恢复为 ROSBOT 时在 Timer 已就绪后补建内容。
- **方案 A（可选）**：Timer 未启动时用 root.after(delay, …) 在主线程延后执行等价逻辑，使 ensure_content 不依赖 Timer；当前未采用，保留「配置在 timer 线程读取」的既有设计。
- **方案 C（可选）**：在 `_deferred_after_tab_changed` 的 init 阶段也对 ROSBOT 单独执行 ensure_content；当前依赖 Controller 侧补调，不再在 init 阶段调用 ensure_content。

### 6.2 统一「延迟创建」与「Timer 就绪」的时序

- 明确「UI 就绪」是否包含「所有 tab 的占位或内容已可显示」；若包含 ROSBOT，则需约定：要么 ROSBOT 内容不依赖 Timer（如主线程延迟 after），要么 Timer 启动后有一致的一次性补建（如方案 B）。
- 文档化：依赖 `submit_one_shot` 的面板，仅在 Timer 已启动后调用 ensure_content 才有效；启动路径上若会恢复到此 tab，需在 Timer 启动后或主线程 after 中再触发一次 ensure_content。

### 6.3 与 ttk.Notebook 官方用法对齐

- 官方：add(child) 后 select(tab_id) 即可显示对应 child；若 child 内容异步生成，应用需在内容就绪后做一次 update_idletasks/update 或保证内容在 select 前已创建。当前问题不在 Notebook API，而在「child 内容何时、在何种时序下创建」的架构设计。

---

## 七、文档与 MCP 引用

- **代码**：`ui/diablo3_macro_ui.py`（`_create_main_tabs`、`_load_last_tab`、`_deferred_after_tab_changed`、`_initialization_complete`）、`ui/panels/rosbot_extension_panel.py`（`ensure_content`、`_fetch_rosbot_config_then_create`）、`timers/timer_manager.py`（`submit_one_shot`、`_running`）、`controller/d3_macro_controller.py`（`run()`、`start_timer_loop_after_ui_ready`、**`_ensure_rosbot_content_if_selected()`**、**`root.after(50, _ensure_rosbot_content_if_selected)`**）、`share/ui_registry.py`（ROSBOT 说明）、`providor/constants/ui.py`（`TAB_INDEX_ROSBOT`、`PANEL_KEY_ROSBOT`）。
- **MCP**：`/websites/tkdocs_pyref` — ttk.Notebook 的 `add`、`select`、单子窗口显示语义；Tk 的 `widget.after(ms, callback)` 在主线程延后执行，用于在 Timer 就绪后补建 ROSBOT 内容。

---

## 八、小结

- **UI 重启恢复上次 TAB 时该页空白**的主要原因：当上次选中的是 **ROSBOT（tab 2）** 时，（1）`ensure_content()` 在 `_create_main_tabs()` 中调用时 Timer 尚未启动，`submit_one_shot` 被忽略，ROSBOT 内容从未被调度创建；（2）随后 `select(tab_ids[2])` 触发 `<<NotebookTabChanged>>`，但 `_deferred_after_tab_changed` 在初始化阶段直接 return，不对 ROSBOT 再调 `ensure_content()`。因此该 tab 的 child 内无任何控件，显示为空白。
- **代码实际与查找的问题为同一问题**：恢复的 TAB 页空白 = 该 tab 对应的 child（ROSBOT panel 的 container）内未创建内容，与 tkdocs 中「Notebook 只切换显示、不负责 child 内容」一致。
- **修复（方案 B）**：在 Controller 的 `run()` 中，`start_timer_loop_after_ui_ready()` 之后调度 `self.ui.root.after(50, self._ensure_rosbot_content_if_selected)`；`_ensure_rosbot_content_if_selected()` 检查当前选中 tab 是否为 ROSBOT 且 `_content_created` 为 False，若是则调用 `panel.ensure_content()`。此时 Timer 已运行，`submit_one_shot` 有效，ROSBOT 内容可在恢复为该 tab 时被正确创建，与「先看代码、看文档、再调用 MCP」的结论一致。
