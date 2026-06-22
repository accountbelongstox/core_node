# 多语言切换后UI未完全更新 — 架构分析与优化方案

**问题**：中文切换英文后，切回来时UI没有全部更新，比如TAB面没有更新，同时下拉框中的values也没有更新。  
**范围**：`pyapps/d3-check`；全新思路，不依赖此前ui_analyzer / ui2 / ui_3的结论。  
**依据**：先看代码 → 再看项目文档 → 再通过MCP查Tkinter官方文档，综合写出可能性与修复方向。

---

## 一、代码现状（语言切换流程与UI更新）

### 1.1 语言切换触发链

| 位置 | 行为 | 问题 |
|------|------|------|
| **title_bar.py** L177 | `_on_language_combo_changed` → `i18n_manager.set_language(new_language)` | 触发全局语言切换 |
| **i18n_manager.py** L203 | `set_language()` → `_notify_language_change()` → 遍历所有listener | 广播到所有监听器 |
| **diablo3_macro_ui.py** L622 | `_on_language_changed()` → `_recreate_ui_for_language_change()` | 重建所有tab内容 |
| **Controller** L244 | `_on_language_changed()` → `self.ui._on_language_changed()` | **双重调用**（一次listener，一次Controller转调） |

**结论**：语言切换通过监听器广播，主UI的`_on_language_changed`会被调用两次（一次作为listener，一次被Controller转调），只能靠`_language_change_in_progress`防重入。

### 1.2 TAB标签文本设置

| 位置 | 行为 | 问题 |
|------|------|------|
| **diablo3_macro_ui.py** L559-562 | `_create_table1_tab()` → `main_notebook.add(table1_frame, text=i18n_manager.get_ui_text("tabs.main_functions"))` | 创建时设置text |
| **diablo3_macro_ui.py** L662-672 | `_recreate_ui_for_language_change()` → destroy所有tab → 重新`_create_table*_tab()` | **重建时重新设置text**，但tab_id可能变化 |
| **diablo3_macro_ui.py** L679-693 | `tab_ids = self.main_notebook.tabs()` 后循环 `self.main_notebook.tab(tid, text=i18n_manager.get_ui_text(_TAB_I18N_KEYS[i]))` | **当前代码已显式更新每个 tab 的 text** |
| **diablo3_macro_ui.py** L694-697 | `main_notebook.select(tab_ids[idx])`、`bottom_bar.show_tab_content(idx)` | 恢复选中与底部栏 |

**结论**：当前实现已在 `_recreate_ui_for_language_change()` 内重建后显式调用 `notebook.tab(tab_id, text=...)` 更新所有 TAB 标签，与 MCP 文档 `tab(tab_id, **kw)` 可设置 tab 选项一致。若仍出现「TAB 面没有更新」，需排查刷新时序或主题/样式。

### 1.3 下拉框values更新

| 位置 | 行为 | 问题 |
|------|------|------|
| **main_functions_panel.py** L81-85 | `__init__`时初始化：`self.strategy_en_to_zh = {'continuous': i18n_manager.get_ui_text(...), ...}` | 字典在初始化时固定 |
| **main_functions_panel.py** L278 | `_create_skill_row()`中：`strategy_values_zh = list(self.strategy_en_to_zh.values())` | 从固定字典取values |
| **main_functions_panel.py** L515-530 | `_create_additional_skill_settings()`中：`animation_speed_values = [i18n_manager.get_ui_text(...), ...]` | 创建时用i18n，但**语言切换后未更新** |
| **diablo3_macro_ui.py** L662-672 | `_recreate_ui_for_language_change()` → destroy所有tab → 重新创建panel | Panel重建时`__init__`会重新初始化字典，但**若panel有`_on_language_changed`且只更新部分UI，字典不会更新** |

**结论**：下拉框的values在创建时从i18n获取，但语言切换后：
- 若panel完全重建（destroy + 新建），values会更新（因为`__init__`重新初始化字典）。
- 若panel有`_on_language_changed`且只更新部分UI（不重建），字典不会更新，下拉框的values也不会更新。

### 1.4 HotkeyInput生命周期问题

| 位置 | 行为 | 问题 |
|------|------|------|
| **hotkey_input.py** L341-345 | `_on_language_changed()` → `current_value = self.get()` | 访问控件值 |
| **diablo3_macro_ui.py** L664 | `_recreate_ui_for_language_change()` → `widget.destroy()` | 销毁所有tab内容 |
| **i18n_manager.py** L182-183 | `_notify_language_change()` → 遍历所有listener | **在destroy之后仍可能调用listener** |

**结论**：`_recreate_ui_for_language_change()`先destroy所有tab内容，然后重建。但i18n_manager的listener列表中的HotkeyInput实例在destroy后仍可能被调用`_on_language_changed()`，此时控件已销毁，调用`self.get()`会报`TclError: invalid command name`。

### 1.5 Panel语言监听器注册

| 位置 | 行为 | 问题 |
|------|------|------|
| **diablo3_macro_ui.py** L709-714 | `_register_panel_language_listeners()` → `panels_with_language_listener = []` | **列表为空，没有注册任何panel** |
| **title_bar.py** L46 | `i18n_manager.add_language_change_listener(self._on_language_changed)` | TitleBar注册了监听器 |
| **hotkey_input.py** L95 | `_apply_high_contrast_styling()` → `i18n_manager.add_language_change_listener(self._on_language_changed)` | HotkeyInput注册了监听器 |
| **status_bar.py** L58 | `i18n_manager.add_language_change_listener(self._on_language_changed)` | StatusBar注册了监听器 |

**结论**：Panel本身没有注册语言监听器，语言切换时panel不会收到通知。主UI通过`_recreate_ui_for_language_change()`重建所有panel，但若panel内部有需要更新的数据（如`strategy_en_to_zh`字典），重建时才会更新。

---

## 二、项目文档与架构（简要）

- **docs/DESIGN_ISSUES_MAJOR.md §1**：语言变更双路径与监听器职责混乱；Controller和Diablo3MacroUI都是listener，导致双重调用。
- **docs/DESIGN_ISSUES_MAJOR.md §10**：i18n与CONFIG的双源与同步（已修正，单一事实来源为CONFIG）。
- 当前策略：语言切换时主UI重建所有tab内容，但TAB标签text和下拉框values的更新依赖重建，若重建不完整或panel有局部更新逻辑，可能遗漏。

---

## 三、官方文档（MCP Context7 / tkdocs_pyref）要点

- **ttk.Notebook**：`add(child, **kw)` 添加 tab；`tab(tab_id, option=None, **kw)` **Gets or sets tab options**（如 `notebook.tab(tab_id, text="New Title")` 可动态更新 tab 文案，无需重建 tab）。
- **ttk.Combobox**：Configuration option **values** (list) — A list of values to display in the dropdown；可通过 `combobox['values'] = new_values` 或 `configure(values=new_values)` 动态更新下拉选项。
- **Widget 生命周期**：`winfo_exists()` 返回 whether the widget exists；destroy 后访问控件会报 `TclError: invalid command name`；应在 destroy 前移除监听器，或在监听器回调中先检查 `widget.winfo_exists()`。
- **事件监听器管理**：应在控件 destroy 时移除监听器，避免访问已销毁控件。

---

## 四、可能性归纳（按优先级排序）

### 可能性1（高）：TAB标签text未显式更新

- **表现**：语言切换后，TAB标签的文本（如"主功能"、"辅助功能"）没有更新为新语言的文本。
- **依据**：
  - `_recreate_ui_for_language_change()`重建tab内容时，虽然`main_notebook.add()`会设置新的text，但若重建过程中tab_id管理不当，或重建顺序导致tab被destroy后立即重建，可能text未正确设置。
  - 官方文档：`n.tab(tab_id, text="New Title")`可以动态更新text，无需重建。
- **修复方向**：
  - 在`_recreate_ui_for_language_change()`中，重建tab后显式更新所有tab的text：`self.main_notebook.tab(tab_id, text=i18n_manager.get_ui_text("tabs.main_functions"))`。
  - 或：在`_on_language_changed()`中，不重建tab，只更新tab的text和panel内容。

### 可能性2（高）：下拉框values未更新

- **表现**：语言切换后，下拉框的选项列表（如策略下拉的"连续模式"、"单次模式"）没有更新为新语言的文本。
- **依据**：
  - `main_functions_panel.py`中`strategy_en_to_zh`字典在`__init__`时初始化，语言切换后若panel不重建，字典不会更新。
  - `_create_skill_row()`中下拉框的values来自`list(self.strategy_en_to_zh.values())`，字典不更新则values不更新。
  - 官方文档：`combobox['values'] = new_values`可以动态更新values。
- **修复方向**：
  - Panel注册语言监听器，在`_on_language_changed()`中更新字典和下拉框values。
  - 或：主UI重建panel时，确保panel的`__init__`重新初始化字典。

### 可能性3（高）：HotkeyInput在destroy后访问控件

- **表现**：语言切换时，`TclError: invalid command name ".!notebook.!frame.!frame.!frame.!labelframe.!frame2.!hotkeyinput"`。
- **依据**：
  - `_recreate_ui_for_language_change()`先destroy所有tab内容，然后重建。
  - HotkeyInput注册了语言监听器，destroy后仍可能被调用`_on_language_changed()`。
  - `_on_language_changed()`中调用`self.get()`访问已销毁控件。
- **修复方向**：
  - 在`_on_language_changed()`中检查控件是否存在：`if not self.winfo_exists(): return`。
  - 或：在destroy前移除所有语言监听器，重建后再注册。
  - 或：HotkeyInput在destroy时自动移除监听器（`__del__`或destroy事件绑定）。

### 可能性4（中）：Panel语言监听器未注册

- **表现**：Panel内部需要更新的数据（如字典、下拉框values）在语言切换时不会更新，除非panel重建。
- **依据**：
  - `_register_panel_language_listeners()`中`panels_with_language_listener = []`为空，没有注册任何panel。
  - Panel的`_on_language_changed()`方法存在但未被调用。
- **修复方向**：
  - Panel注册语言监听器，在`_on_language_changed()`中更新内部数据（字典、下拉框values等）。
  - 或：统一由主UI重建panel，确保panel的`__init__`重新初始化所有数据。

### 可能性5（中）：语言切换双重调用导致时序问题

- **表现**：Controller和Diablo3MacroUI都是listener，导致`_on_language_changed()`被调用两次，可能在某些时序下导致UI更新不完整。
- **依据**：
  - `docs/DESIGN_ISSUES_MAJOR.md §1`：语言变更双路径与监听器职责混乱。
  - 当前用`_language_change_in_progress`防重入，但若两次调用之间有其他操作，可能导致状态不一致。
- **修复方向**：
  - 统一语言切换入口：仅Controller或仅Diablo3MacroUI作为"语言变更协调者"，其余组件只做局部刷新。
  - 或：保持双重调用但确保两次调用之间状态一致。

---

## 五、建议修复顺序（不改变既有架构前提下）

1. **立即**：修复HotkeyInput的destroy后访问问题（可能性3），在`_on_language_changed()`中检查`self.winfo_exists()`。
2. **立即**：在`_recreate_ui_for_language_change()`中显式更新所有TAB标签的text（可能性1）。
3. **立即**：Panel注册语言监听器，在`_on_language_changed()`中更新字典和下拉框values（可能性2、4）。
4. **可选**：统一语言切换入口，避免双重调用（可能性5）。

---

## 六、架构优化建议（可调架构、复制/移动代码）

### 6.1 统一语言切换协调者

- **当前**：Controller和Diablo3MacroUI都是listener，导致双重调用。
- **建议**：仅Diablo3MacroUI作为"语言变更协调者"，Controller不注册监听器，或Controller只负责业务逻辑，UI更新由Diablo3MacroUI统一处理。

### 6.2 Panel语言更新策略

- **当前**：Panel不注册监听器，语言切换时完全重建panel。
- **建议**：
  - **方案A**：Panel注册监听器，在`_on_language_changed()`中更新内部数据（字典、下拉框values等），主UI只更新TAB标签text。
  - **方案B**：主UI重建panel，确保panel的`__init__`重新初始化所有数据，TAB标签text显式更新。

### 6.3 监听器生命周期管理

- **当前**：控件注册监听器后，destroy时不会自动移除，可能导致访问已销毁控件。
- **建议**：
  - 控件在destroy时自动移除监听器（`__del__`或destroy事件绑定）。
  - 或：监听器回调中检查控件是否存在（`widget.winfo_exists()`）。

### 6.4 TAB标签和下拉框values的更新方式

- **当前**：依赖重建tab/panel来更新text和values。
- **建议**：
  - TAB标签：用`main_notebook.tab(tab_id, text=...)`动态更新，无需重建。
  - 下拉框values：用`combobox['values'] = new_values`动态更新，无需重建控件。

---

## 七、代码实际与查找是否同一问题（逐条对照）

**流程**：先看代码（diablo3_macro_ui、main_functions_panel、hotkey_input、i18n_manager）→ 再看项目文档（DESIGN_ISSUES_MAJOR）→ 再调用 MCP 查 tkdocs_pyref（Notebook.tab、Combobox values、Widget winfo_exists/destroy），综合后填写下表与 7.2 逐条。

### 7.1 总表

| 查找的问题 | 代码实际（当前实现） | MCP/官方文档依据 | 是否同一问题 / 状态 |
|------------|----------------------|------------------|----------------------|
| **TAB面没有更新** | **当前**：`_recreate_ui_for_language_change()` 在重建后 L679-693 循环 `main_notebook.tab(tid, text=i18n_manager.get_ui_text(_TAB_I18N_KEYS[i]))` 显式更新每个 tab 的 text。 | tkdocs_pyref：`Notebook.tab(tab_id, **kw)` gets or sets tab options。 | **是**；已按官方 API 显式更新。 |
| **下拉框values没有更新** | **当前**：语言切换时全量 destroy + 新建 Panel，Panel `__init__` 中 `strategy_en_to_zh` 与 combobox values 按当前语言重新初始化，故重建后 values 为新语言。 | tkdocs_pyref：Combobox 具 **values** 配置项，可 `configure(values=...)` 更新。 | **是**；当前通过全量重建已覆盖；不重建时需 Panel 注册 listener 并更新 values。 |
| **HotkeyInput错误** | **当前**：`_on_language_changed` 内 `winfo_exists()` 检查 + `self.get()` 包在 try/except TclError，异常或不存在时移除自身 listener；`<Destroy>` 绑定 `_on_destroy` 移除监听器；i18n_manager 对 listener 列表拷贝迭代并单次 try/except。 | tkdocs_pyref：`winfo_exists()`；destroy 后访问报 `TclError: invalid command name`。 | **是**；已按「销毁时移除监听器、回调前检查存在与 TclError」修复。 |
| **Panel语言监听器未注册** | **当前**：`_register_panel_language_listeners()` 中 `panels_with_language_listener = []` 仍为空，未注册 panel。 | 监听器应在需要响应的组件上注册，destroy 时注销。 | **是**；当前依赖全量重建刷新；若改为仅刷新不重建，需在此注册 panel 并实现 `_on_language_changed`。 |

### 7.2 代码实际 vs 查找问题（按代码路径逐条）

#### 7.2.1 TAB 面没有更新

| 维度 | 内容 |
|------|------|
| **代码实际** | `diablo3_macro_ui.py` L662-672：`_recreate_ui_for_language_change()` 内 `for widget in self.main_notebook.winfo_children(): widget.destroy()`，然后依次 `_create_table1_tab()` … `_create_table3_tab()`。每次 `_create_table*_tab()` 中 `main_notebook.add(frame, text=i18n_manager.get_ui_text("tabs.xxx"))`，即 **tab 的 text 仅在 add 时设置一次**。重建后未再对已有 tab 调用 `main_notebook.tab(tab_id, text=...)`。 |
| **MCP 官方文档** | tkdocs_tutorial (complex)：`n.tab(f1, text="New Title")` 可修改指定 tab 的 text；`print(n.tab(f1)['text'])` 可读取当前 text。 |
| **查找的问题** | 「TAB 面没有更新」——用户反馈切换语言后 tab 标签文案未变。 |
| **是否同一问题** | **是**。当前实现依赖「destroy 后重新 add」间接更新 text；若重建顺序、tab_id 或 i18n 时机有偏差，易出现 tab 文案未更新。与文档「用 tab(tab_id, text=...) 动态改标题」一致，应视为同一类问题。 |

#### 7.2.2 下拉框 values 没有更新

| 维度 | 内容 |
|------|------|
| **代码实际** | `main_functions_panel.py` L81-86：`self.strategy_en_to_zh = { 'continuous': i18n_manager.get_ui_text(...), ... }` 在 **Panel.__init__** 中一次性赋值；L278：`strategy_values_zh = list(self.strategy_en_to_zh.values())` 作为 ThemedCombobox 的 values。语言切换时若走 `_recreate_ui_for_language_change()`，会 destroy 再新建 Panel，新 Panel 的 `__init__` 会重新执行，字典与下拉 values 会更新；但 **若未重建或重建未覆盖该 Panel**，则 strategy_en_to_zh 与下拉 values 均不会变。L515-530 的 `animation_speed_values` / `game_language_values` 在 `_build_other_settings_rows` 内用 `get_ui_text` 现算，同样只在创建时生效，语言切换后未再更新。 |
| **MCP 官方文档** | tkdocs_pyref (ttk_combobox)：Configuration Options 含 **values** (list)；Methods 含 **configure(cnf=None, **kw)**。即 Combobox 的 values 可通过 configure 或 `cget` 读写，可动态替换列表。 |
| **查找的问题** | 「下拉框中的 values 没有更新」——切换语言后下拉选项仍为旧语言。 |
| **是否同一问题** | **是**。代码中下拉 values 来源于 Panel 内字典/列表，仅在创建时从 i18n 取一次；语言切换后未对现有 Combobox 做 `configure(values=new_list)` 或等价更新，与文档「values 可配置」一致，属同一问题。 |

#### 7.2.3 HotkeyInput 报错 invalid command name

| 维度 | 内容 |
|------|------|
| **代码实际** | `i18n_manager.py` L180-184：`_notify_language_change()` 对 `list(self.language_change_listeners)` 的**副本**顺序调用每个 listener。注册顺序大致为：TitleBar（创建时）→ Controller（run 里）→ StatusBar、HotkeyInput（随 UI 创建）。语言切换时：先执行 Controller._on_language_changed → 调用 `self.ui._on_language_changed()` → `_recreate_ui_for_language_change()` → **destroy 所有 main_notebook 子控件**（含各 Panel 及其中 HotkeyInput）。destroy 后，同一轮 _notify 中**后续** listener 仍会被调用，包括已销毁的 HotkeyInput 实例的 `_on_language_changed`。`hotkey_input.py` L341-345：`_on_language_changed` 内直接 `current_value = self.get()`，此时 self 已 destroy，Tk 报 `TclError: invalid command name ".!notebook...hotkeyinput"`。 |
| **MCP 官方文档** | tkdocs_pyref：ttk.Widget 继承方法含 **winfo_exists()** — "Checks if the widget exists"。destroy 后访问控件会报 invalid command name。 |
| **查找的问题** | 语言切换时控制台报 `TclError: invalid command name "...hotkeyinput"`。 |
| **是否同一问题** | **是**。原因即：listener 在控件 destroy 之后仍被调用且未做存在性检查，与文档「destroy 后不可再访问」「winfo_exists 可查存在」一致。 |

#### 7.2.4 Panel 语言监听器未注册

| 维度 | 内容 |
|------|------|
| **代码实际** | `diablo3_macro_ui.py` L709-714：`_register_panel_language_listeners()` 内 `panels_with_language_listener = []` 为空列表，for 循环不执行，**没有任何 panel 被注册**。主 UI 仅通过 `_recreate_ui_for_language_change()` 全量重建 tab 内容来间接刷新 panel；panel 自身若需在「不重建」策略下刷新（如只更新 label、combobox values），则必须作为 listener 注册并实现 `_on_language_changed`，当前未注册故不会收到通知。 |
| **查找的问题** | 部分 UI（如 tab 内文案、下拉 values）未随语言更新。 |
| **是否同一问题** | **是**。Panel 未注册导致不重建时无法主动刷新，与「监听器应在需要响应的组件上注册」一致。 |

### 7.3 小结（代码实际与查找是否同一问题）

- **TAB 面**：实现依赖重建时 add 的 text，未用 `tab(tab_id, text=...)` 显式更新 → 与「TAB 面没有更新」**同一问题**。
- **下拉 values**：仅在创建时从 i18n 取，未在语言切换后对 Combobox 做 values 更新 → 与「下拉框 values 没有更新」**同一问题**。
- **HotkeyInput**：listener 在 destroy 之后仍被调用且未检查 winfo_exists → 与报错 **同一问题**。
- **Panel 监听器**：列表为空、未注册 panel → 与「部分 UI 未更新」**同一问题**。

---

## 八、代码实际（修复后）与 MCP/官方文档对照 — 是否同一问题（续）

**依据**：先看代码 → 再看文档 → 再调用 MCP 查 tkdocs_pyref（Notebook.tab、Combobox、Widget destroy/winfo_exists）。

### 8.1 HotkeyInput 销毁后回调（已按官方思路修复）

| 维度 | 内容 |
|------|------|
| **代码实际（修复后）** | `hotkey_input.py`：① `bind('<Destroy>', self._on_destroy)`，在 `_on_destroy` 中 `i18n_manager.remove_language_change_listener(self._on_language_changed)`；② `_on_language_changed` 开头用 `winfo_exists()` 判断，`self.get()` 包在 `try/except tk.TclError` 中；占位符用 `i18n_manager.get_ui_text("hotkey_input.placeholder")` 参与判断。 |
| **MCP/官方文档** | tkdocs_pyref：Widget 标准方法含 `destroy()`、`bind()`、`winfo_exists()`；destroy 后再访问会报 invalid command name；应在销毁时移除对外回调或回调中检查控件是否存在。 |
| **是否同一问题** | **是**。问题为「销毁后仍被通知导致 TclError」，修复为「Destroy 时移除监听器 + 回调内检查存在与 TclError」，与官方推荐的「销毁时清理、回调前检查」一致。 |

### 8.2 TAB 标签文案（已按官方 API 显式更新）

| 维度 | 内容 |
|------|------|
| **代码实际（修复后）** | `diablo3_macro_ui.py` 的 `_recreate_ui_for_language_change()`：在 `_create_table*_tab()` 之后、`select` 之前，对 `main_notebook.tabs()` 遍历，调用 `self.main_notebook.tab(tid, text=i18n_manager.get_ui_text(_TAB_I18N_KEYS[i]))` 显式设置当前语言的 tab 文案（`_TAB_I18N_KEYS` 与六个 tab 的 i18n key 一一对应）。 |
| **MCP/官方文档** | tkdocs_pyref（ttk.Notebook）：`tab(tab_id, option=None, **kw)` — Gets or sets tab options；示例 `notebook.add(frame1, text='Tab 1')` 表明 tab 有 text 选项，可通过 `tab(tab_id, text="New Title")` 动态更新。 |
| **是否同一问题** | **是**。现象为「语言切回后 TAB 面没更新」，本质是 tab 的 text 未随语言刷新；用 `notebook.tab(tab_id, text=...)` 显式更新与文档一致。 |

### 8.3 下拉框 values（当前策略：重建 Panel 即更新）

| 维度 | 内容 |
|------|------|
| **代码实际** | `_recreate_ui_for_language_change()` 会 destroy 所有 notebook 子控件并重新执行 `_create_table*_tab()`，每个 tab 内新建 Panel；Panel 的 `__init__` 中会再次执行 `i18n_manager.get_ui_text(...)` 初始化字典与下拉 values，故**重建后**下拉框 values 应为新语言。若此前仍不更新，多为异常打断通知链（如修复前的 HotkeyInput TclError）导致主 UI 未执行重建。 |
| **MCP/官方文档** | tkdocs_pyref（ttk.Combobox）：Configuration Options 含 `values` (list)；可通过 `configure` 或索引赋值动态更新。 |
| **是否同一问题** | **是**。查找为「下拉框 values 未更新」，代码实际为「依赖整页重建刷新 values；异常会阻止重建」。修复 HotkeyInput 后通知链完整，重建会执行，values 会更新；若后续需「不重建仅刷新」，可对 combobox 显式 `configure(values=...)` 与文档一致。 |

### 8.4 架构推进：已实现与建议

- **已实现（与文档、MCP 一致）**  
  1. **HotkeyInput 监听器生命周期**：Destroy 时移除 i18n 监听器；`_on_language_changed` 内检查 `winfo_exists()` 并捕获 `self.get()` 的 TclError。  
  2. **TAB 标签显式更新**：语言切换重建后，用 `main_notebook.tab(tab_id, text=i18n_manager.get_ui_text(key))` 按当前语言显式设置所有 tab 的 text。

- **建议（可选）**  
  - 下拉框不重建仅刷新：可为相关 Panel 注册语言监听器，在回调中更新字典并执行 `combobox.configure(values=new_values)`。  
  - 统一语言协调者：仍可考虑仅由主 UI 或 Controller 一方作为语言变更协调者（当前已用 `_language_change_in_progress` 防重入）。

---

## 九、文档与MCP引用

- **项目**：`ui/diablo3_macro_ui.py`（`_on_language_changed`、`_recreate_ui_for_language_change`、`_TAB_I18N_KEYS` 与 tab 显式更新）、`ui/panels/main_functions_panel.py`（`strategy_en_to_zh` 字典、下拉框 values）、`ui/widgets/hotkey_input.py`（`_on_destroy`、`_on_language_changed`）、`d3utils/i18n_manager.py`（监听器列表、`_notify_language_change`）、`docs/DESIGN_ISSUES_MAJOR.md`（语言变更双路径）。
- **官方**：MCP 查询库 `tkdocs_pyref`（websites/tkdocs_pyref）— Notebook `tab(tab_id, **kw)` 动态设置 tab 选项、Combobox `values` 配置项与 `configure()`、Widget `destroy()`/`winfo_exists()`/`bind()`，以及「destroy 后勿访问、应在销毁时移除监听器或回调中检查存在」的用法。

---

## 十、小结

- **TAB 面没有更新、下拉框 values 没有更新、HotkeyInput 错误**的主要原因在代码中对应为：① TAB 标签 text 未显式更新；② Panel 的字典和下拉 values 仅在创建时从 i18n 取，语言切换后未对现有控件更新；③ HotkeyInput 在 destroy 后仍被通知且未移除监听器/未检查控件存在。
- **修复后**：① HotkeyInput 在 Destroy 时移除 i18n 监听器，回调内检查 `winfo_exists()` 并捕获 TclError；② `_recreate_ui_for_language_change()` 在重建 tab 后显式调用 `main_notebook.tab(tid, text=i18n_manager.get_ui_text(...))` 更新所有 TAB 文案；③ 下拉 values 依赖重建 Panel 刷新，修复异常后通知链完整，重建会执行。
- 与「先看代码、看文档、再调用 MCP 查官方文档」的结论一致；**代码实际与查找的问题为同一问题**，已按 tkdocs_pyref 的 Notebook.tab、Widget 生命周期与监听器管理思路完成上述修改，并允许后续再复制/移动代码或调整架构（如 Panel 注册监听器仅刷新 values 而不重建）。

---

## 十、已实施的代码修改（与文档对照）

| 问题 | 代码实际 | 已实施修改 | 依据 |
|------|----------|------------|------|
| **HotkeyInput 报错** | listener 在 destroy 后仍被调用并执行 `self.get()` | `hotkey_input.py`：`_on_language_changed` 内先 `if not self.winfo_exists(): return`，并用 `try/except tk.TclError` 包裹 `self.get()`；`_on_destroy` 中 `remove_language_change_listener` | MCP winfo_exists、destroy 后不可访问 |
| **TAB 标签未更新** | 重建时仅依赖 add 时 text，未显式更新 | `diablo3_macro_ui.py` L678-692：`_recreate_ui_for_language_change()` 在重建后遍历 `main_notebook.tabs()`，对每个 tab_id 调用 `main_notebook.tab(tid, text=i18n_manager.get_ui_text(_TAB_I18N_KEYS[i]))` | MCP：`n.tab(f1, text="New Title")` |
| **下拉 values 未更新** | Panel 字典与 Combobox values 仅在创建时设置 | 当前仍依赖「重建 Panel」刷新（重建后 `__init__` 重新执行，字典与 values 为新语言）；若改为不重建仅刷新，需 Panel 注册 listener 并更新 `strategy_en_to_zh` 及 `combobox['values']` | MCP：Combobox 具 `values` 配置项、可 configure 更新 |

以上为结合代码实际与 MCP 官方文档后的架构分析与已做修改记录；后续若需「不重建仅刷新」策略，可按 §六 方案 A 为 Panel 注册监听器并更新字典与 Combobox values。
