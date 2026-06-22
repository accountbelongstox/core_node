# 多语言切换 TclError 修复与 MCP 官方参考

**问题**：切换语言时抛出 `_tkinter.TclError: invalid command name ".!notebook.!frame.!frame.!frame.!labelframe.!frame2.!hotkeyinput"`，且 TAB 标签/下拉框 values 未完全更新。  
**范围**：`pyapps/d3-check`，与 `docs/ui_4/MULTILINGUAL_UI_UPDATE_ARCHITECTURE_ANALYSIS.md` 互补，侧重根因与已做修复及 MCP 依据。

---

## 一、根因（调用顺序）

1. 用户在下拉框选新语言 → `title_bar._on_language_combo_changed` → `i18n_manager.set_language(new_language)` → `_notify_language_change()` 遍历所有 listener。
2. **Controller** 是 listener 之一，其 `_on_language_changed` 会调用 `self.ui._on_language_changed(new_language)` → `_recreate_ui_for_language_change()` → 对 `main_notebook.winfo_children()` 逐子执行 `widget.destroy()`，即**先销毁所有 tab 及其中控件**（含各 HotkeyInput）。
3. 遍历仍在继续，随后会调用 **HotkeyInput** 的 `_on_language_changed`。此时对应控件已被 destroy，但 Destroy 事件尚未处理，listener 仍在列表中，故会执行到 `self.get()`，触发 `TclError: invalid command name`。

结论：**同一轮 `_notify_language_change()` 中，先执行“重建”导致控件销毁，后执行到已销毁控件的 listener，造成 TclError。**

---

## 二、MCP 官方文档依据（Context7 / tkdocs_pyref）

- **winfo_exists()**：Returns whether the widget exists.（控件销毁后不应再调用其方法；回调中应先检查存在性。）
- **destroy()**：Destroys the widget and its children.（destroy 后访问控件会报 `TclError: invalid command name`。）
- **事件/监听器**：控件 destroy 时应移除对外监听器，或在回调中检查控件是否仍存在，避免访问已销毁控件。

据此，修复方向为：  
① 在 listener 回调中若发现控件已销毁则直接返回并移除自身；  
② 通知时对 listener 列表做拷贝迭代，允许回调中安全移除自身；  
③ 通知循环中捕获异常，避免单个 listener 抛错导致后续 listener 不被调用。

---

## 三、已做代码修改

### 3.1 `d3utils/i18n_manager.py` — `_notify_language_change`

- **原**：`for listener in self.language_change_listeners: listener(self.current_language)`
- **现**：  
  - 使用 `list(self.language_change_listeners)` 拷贝后迭代，允许在回调中 `remove_language_change_listener` 而不触发 “list changed size during iteration”。  
  - 对每次 `listener(self.current_language)` 包一层 `try/except Exception`，避免单个 listener 的 TclError 或其他异常中断其余 listener 的通知。

### 3.2 `ui/widgets/hotkey_input.py` — `_on_language_changed`（与现有逻辑一致）

- 先 `winfo_exists()`，不存在则移除自身 listener 并 return。  
- 对 `winfo_exists()` / `self.get()` 可能产生的 `tk.TclError` 做 try/except，在 except 中移除自身 listener 并 return。  
- 占位符判断使用 `get_ui_text("hotkey_input.placeholder")` 与 `"Press hotkey..."` 两种，避免仅英文判断。  
- `<Destroy>` 已绑定 `_on_destroy`，在控件销毁时移除语言监听器，减少后续语言切换再次回调到已销毁控件的可能。

上述与 MCP 文档中“destroy 后不访问控件、在回调中检查存在性或移除监听”的建议一致。

---

## 四、与 TAB/下拉框“未更新”的关系

- **TAB 标签**：`_recreate_ui_for_language_change()` 会 destroy 再重新 `_create_*_tab()`，新 tab 的 `text=` 在 `main_notebook.add(..., text=i18n_manager.get_ui_text(...))` 时已按当前语言设置。若仍出现“TAB 面没有更新”，可在重建后显式对每个 tab_id 再执行一次 `main_notebook.tab(tab_id, text=i18n_manager.get_ui_text("tabs.xxx"))`，参见 `docs/ui_4/MULTILINGUAL_UI_UPDATE_ARCHITECTURE_ANALYSIS.md` 可能性 1。  
- **下拉框 values**：若 panel 未重建或字典在 `__init__` 固定，切换语言后下拉框 values 不会变。可让 panel 注册语言监听器，在 `_on_language_changed` 中更新字典并设置 `combobox['values'] = new_values`，参见同文档可能性 2、4。

TclError 修复后，语言切换不再因 HotkeyInput 抛错中断；TAB/下拉框的进一步一致性可按上述文档做增量优化。

---

## 五、与主文档「代码实际与查找是否同一问题」的对应关系

- 本报告侧重 **HotkeyInput TclError 根因与修复** 及 MCP 依据。
- 主文档 **docs/ui_4/MULTILINGUAL_UI_UPDATE_ARCHITECTURE_ANALYSIS.md** 第七章「代码实际与查找是否同一问题」总表（7.1）及 7.2、第八章已按「先看代码 → 再看文档 → 再调用 MCP」逐条填写：TAB 显式更新、下拉 values 全量重建、HotkeyInput 生命周期、Panel 未注册。本报告与主文档结论一致，可对照阅读。

---

## 六、文档与 MCP 引用

- **项目**：`d3utils/i18n_manager.py`（`_notify_language_change`）、`ui/widgets/hotkey_input.py`（`_on_language_changed`、`_on_destroy`）、`ui/diablo3_macro_ui.py`（`_on_language_changed`、`_recreate_ui_for_language_change`）、`controller/d3_macro_controller.py`（`_on_language_changed`）。  
- **MCP/官方**：Context7 库 `tkdocs_pyref` — `winfo_exists()`、`destroy()`、控件生命周期与事件监听器管理。
