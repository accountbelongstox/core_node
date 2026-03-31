# UI 无法操作 — 修复进度报告

依据 `docs/ui_analyzer/UNRESPONSIVE_UI_POSSIBILITY_REPORT.md` 中的方案逐项尝试，先看代码、再看文档、再查 MCP 官方文档后实施。本报告仅更新进度，不删除已有条目。

---

## 已实施的修复（待测试）

### 方案 1（报告 §1 + §8.1）

- **内容**  
  - **可选关闭 Win32 任务栏修复**：读取 `ui_settings.skip_taskbar_win32_fix`（默认 **True**）。为 True 时不调用 `ensure_tk_root_in_taskbar(root)`，用于验证“去掉 SetWindowLong/SetWindowPos 后是否恢复可操作”。  
  - 若需保留任务栏，在配置中设 `ui_settings.skip_taskbar_win32_fix` 为 `false`。  
  - **350ms 后延迟 focus**：在 `_apply_taskbar_fix` 末尾 `focus_force()` 之后增加 `after(10, focus_force)`，与 SetWindowPos 触发的消息处理错开一帧（报告 §5）。
- **修改文件**  
  - `ui/diablo3_macro_ui.py`：`_apply_taskbar_fix` 内按配置决定是否调用 `ensure_tk_root_in_taskbar`，并增加 `after(10, focus_force)`。
- **状态**：已实施，**请测试**（默认不显示任务栏；若 UI 可操作，可把配置改为 false 测任务栏是否仍导致无输入）。

---

### 方案 2（报告 §2）

- **内容**  
  - 减少 init 阶段 `focus_force` 次数：Map 后仅保留 `after(1, focus_force)` 与 `after(0, _deferred_after_map)`，`_deferred_after_map` 内只调用一次 `focus_force()`，去掉原先 50/150/300ms 的多次 `focus_force`。
- **修改文件**  
  - `ui/diablo3_macro_ui.py`：`_deferred_after_map` 仅保留单次 `self.root.focus_force()`。
- **状态**：已实施，**请测试**。

---

### 方案 4（报告 §4）

- **内容**  
  - `_release_any_grab()` 改为返回 bool（是否释放了 grab）。  
  - `run()` 入口：若释放了 grab 则打印 `[UI] Grab was held before mainloop; released.`。  
  - 托盘“显示窗口”时：在 `event_center._do_show()` 中先调用 `ui._release_any_grab()`，若有释放则打日志。
- **修改文件**  
  - `ui/diablo3_macro_ui.py`：`_release_any_grab` 返回值及 run() 内日志。  
  - `d3utils/event_center.py`：`_do_show()` 内调用 `_release_any_grab` 并打日志。
- **状态**：已实施，**请测试**（若控制台出现 grab 释放日志，说明曾存在残留 grab）。

---

### 方案 5（报告 §5）

- **内容**  
  - 350ms 的 `_apply_taskbar_fix` 末尾在立即 `focus_force()` 之后，再 `after(10, focus_force)` 一次，避免与 SetWindowPos 触发的消息处理同帧竞争。
- **修改文件**  
  - `ui/diablo3_macro_ui.py`：`_apply_taskbar_fix` 末尾增加 `self.root.after(10, lambda: self.root.focus_force() if self.root.winfo_exists() else None)`。
- **状态**：已实施，**请测试**。

---

### 方案 6（报告 §6）

- **内容**  
  - Config change hub 将主线程调度从 `after(0, ...)` 改为 `after(50, ...)`，避免与 Map/350ms 的 focus 逻辑挤在同一批 after(0) 中。  
  - `_set_root` 中 flush 队列用 `after(50, self._flush_pending_queue)`；`notify_config_changed` 中 dispatch 用 `after(50, self._dispatch_pending)`。
- **修改文件**  
  - `share/values/config_change_hub.py`：上述两处 `after(0, ...)` → `after(50, ...)`。
- **状态**：已实施，**请测试**。

---

### 「两个 UI」相关：区分 ghost wrapper 与标题栏坐标错觉

- **现象 A — 启动后两个矩形区，一个可操作、一个不可操作，操作后似合并**  
  与 Windows 上 Tk 对顶层窗的 **wrapper HWND** 及 **`overrideredirect(True)`** 触发的内部重建有关，**可能**出现旧外框与内容区短暂并存。详见 **`docs/ui2/WINDOWS_TK_WRAPPER_GHOST_DOUBLE_WINDOW_INVESTIGATION.md`**（调查记录与缓解思路；实现以 `diablo3_macro_ui.py` 中 frameless 逻辑为准）。

- **现象 B — 标题栏拖动「动另一个」（非线程）**  
  主流程仍只有一个 `tk.Tk()`。标题栏拖拽若用 `root.winfo_x()` / `root.winfo_y()` 算位移，在无边框根窗口上常**不是**屏幕坐标，`geometry("+x+y")` 设错，窗口跳到错误位置，**看起来像**「另一个窗口在动」。
- **修复（针对现象 B）**  
  `ui/components/title_bar.py` 的 `_on_drag` 使用 **`winfo_rootx()` / `winfo_rooty()`**（与 resize、`_save_window_geometry` 一致）。
- **状态**：现象 B 的修复已实施；现象 A 以 `WINDOWS_TK_WRAPPER_GHOST_DOUBLE_WINDOW_INVESTIGATION.md` 与当前 Win32 frameless 实现为准。

---

## 尚未实施的方案

- **报告 §1 方案 B**：在首次 Map 之前通过 Win32 设好 EXSTYLE/owner（需调整创建顺序）。  
- **报告 §1 方案 C**：在 taskbar 修复后显式调用 `SetForegroundWindow`（`_win32_set_foreground`），并处理 foreground lock timeout。  
- **报告 §3**：临时 `overrideredirect(False)` 验证；或参考 CustomTkinter 等无边框做法。  
- **报告 §7**：坐标校准 Tab 内 grab/messagebox/update 排查（当前已避免启动时恢复至该 tab）。

---

## 测试建议

1. **默认（skip_taskbar_win32_fix=True）**  
   - 启动应用，确认主窗口是否可正常点击、输入。  
   - 若可操作：说明 Win32 任务栏修复与无输入强相关；再在配置中设 `ui_settings.skip_taskbar_win32_fix` 为 `false` 测试是否复现无输入。  
2. **控制台**  
   - 观察是否出现 `[UI] Released grab when showing window from tray` 或 `Grab was held before mainloop`，若有则说明曾存在 grab 残留。  
3. **从托盘恢复**  
   - 最小化到托盘后点击“显示”，确认窗口是否可操作，是否有 grab 释放日志。

完成上述测试后，可将结果反馈，便于更新本报告并决定是否实施方案 B/C 或 §3/§7。
