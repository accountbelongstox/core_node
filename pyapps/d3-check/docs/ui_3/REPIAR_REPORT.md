# 下拉框/输入框无背景色、原生灰、对比度不足 — 修复进度报告

依据 `docs/ui_3/` 下多份可能性报告，按「复用下拉框和输入框的 component 组件」思路实施修复。本报告仅更新进度，不删除已有条目。

---

## 已实施的修复（待测试）

### 方案：复用 ThemedEntry / ThemedCombobox / ThemedSpinbox 组件

- **思路**  
  - ConfigBinding 不再直接创建 `tk.Entry` / `ttk.Combobox` / `tk.Spinbox`，改为委托 **ThemedEntry.create**、**ThemedCombobox.create**、**ThemedSpinbox.create**，保证所有与 CONFIG 绑定的输入/下拉/数字框均走同一套主题组件。
  - 面板内直接创建的 ttk.Combobox 改为使用 **ThemedCombobox.create**，与 ConfigBinding 路径一致。
  - 全局 **TCombobox** 在 theme 中增加 **style.map**，对 readonly/focus/active 状态统一使用 input_bg / text_primary，避免平台默认灰底。
  - ThemedText 使用不存在的 `bg_input` 改为 **input_bg**。

- **修改文件**  
  - **ui/utils/config_binding.py**：`create_input_binding` / `create_input_binding_with_initial` 改为调用 `ThemedEntry.create`；`create_combobox_binding` 改为调用 `ThemedCombobox.create`；`create_spinbox_binding` / `create_spinbox_binding_with_initial` 改为调用 `ThemedSpinbox.create`。移除对 UITheme 的依赖，改为从 `..widgets` 导入 ThemedEntry、ThemedCombobox、ThemedSpinbox。
  - **ui/theme/theme.py**：在 `apply_ttk_style` 中为 **TCombobox** 增加 `style.map('TCombobox', fieldbackground=[('readonly', _input_bg), ('focus', _input_bg), ('active', _input_bg)], foreground=[...])`，确保默认 TCombobox 在各状态下使用主题色。
  - **ui/widgets/basic.py**：ThemedText 的 `bg=UITheme.get_color('bg_input')` 改为 `bg=UITheme.get_color('input_bg')`。
  - **ui/widgets/__init__.py**：导出 **ThemedSpinbox**，供 ConfigBinding 使用。
  - **ui/panels/main_functions_panel.py**：策略下拉与设置行下拉由 `ttk.Combobox` 改为 **ThemedCombobox.create**；增加 ThemedCombobox 导入。
  - **ui/panels/auxiliary_functions_panel.py**：菜单下拉由 `ttk.Combobox` 改为 **ThemedCombobox.create**；增加 ThemedCombobox 导入。
  - **ui/components/yolo_annotation_window.py**：会话目录下拉由 `ttk.Combobox` 改为 **ThemedCombobox.create**；增加 ThemedCombobox 导入。

- **状态**：已实施，**请测试**（主功能/辅助/标题栏/日志/ Rosbot 等所有通过 ConfigBinding 的输入框、下拉框、数字框，以及主功能策略下拉、辅助菜单下拉、YOLO 会话目录下拉，应统一为深色背景与浅色字，对比度可读）。

---

## 尚未实施的方案（若仍存在灰底可继续尝试）

- **INPUT_AND_COMBO 报告 §4**：若 Windows 上 ttk.Combobox 的 fieldbackground 仍不生效，可为 TCombobox 使用**自定义样式名**（如 Dark.TCombobox），在 apply_to_root 后单独 configure+map，所有创建处传 `style='Dark.TCombobox'`。
- **ENTRY_COMBOBOX_BG 报告 §4.2**：若平台限制导致 Combobox 输入区仍灰，可考虑 ttk.Entry + 独立 Listbox/弹出窗口 自绘下拉，显式设置 Entry 的 bg/fg。
- **其余直接 tk.Spinbox**：main_functions_panel、auxiliary_functions_panel、coordinate_picker_window 中部分 Spinbox 仍为直接 `tk.Spinbox` 并显式传 bg/fg；若需完全统一，可改为 ThemedSpinbox.create。

---

## 测试建议

1. **主界面**  
   - 打开主功能、辅助功能、Rosbot、日志、标题栏等，检查所有输入框、下拉框、数字框是否为深色背景（#2a2a3e 或主题 input_bg）、浅色字（#e0e0e0），无原生灰、对比度可读。
2. **主功能面板**  
   - 策略下拉、设置行下拉、配置输入行、站桩快捷键输入等，确认与上述一致。
3. **YOLO 标注窗口**  
   - 会话目录下拉是否与主题一致。
4. **坐标校准**  
   - 重命名等对话框中的输入框已显式使用 UnifiedStyles input_bg/input_text，确认无灰底。

完成上述测试后，可将结果反馈，便于更新本报告并决定是否实施后续方案。
