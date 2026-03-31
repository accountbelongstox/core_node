# d3-check UI 无法操作 — 可能性报告

基于 MCP 查阅的 Tkinter 文档与代码库检索，从**非线程阻塞**角度归纳可能导致主窗或控件无法响应的原因（不假定必须维持现有代码结构）。

**文档用法与流程**：先根据代码定位实际调用点（grab、overrideredirect、taskbar、focus_force、after 等），再通过 MCP 查询 Tk/Tcl 官方文档；在**附录**中对照“代码实际”与“文档/排查目标”，标明二者是否针对**同一问题**，便于在 UI 架构与排查中一致使用。

**勘误**：附录里「`_create_ui` 末尾 `overrideredirect(True)`」等表述可能已过期；无边框与双窗口调查见 **`docs/ui2/WINDOWS_TK_WRAPPER_GHOST_DOUBLE_WINDOW_INVESTIGATION.md`**。

---

## 1. Grab 未释放（Tk 文档：grab 子树独占指针直到 release）

- **依据**：Tk 文档明确 “Grab subtree owns pointer until released”；`diablo3_macro_ui.run()` 仅在进入 `mainloop()` 前调用一次 `_release_any_grab()`。
- **可能路径**：
  - 某处 `Toplevel` 或菜单调用了 `grab_set()`，关闭时未在所有路径上调用 `grab_release()`（异常、WM_DELETE_WINDOW 未正确映射、或逻辑遗漏）。
  - **rosbot_extension_panel._ask_choose_rosbot_directory**：`top.grab_set()` 后，`on_ok`/`on_cancel` 仅 `top.destroy()`，未显式 `top.grab_release()`。依赖 “destroy 时 Tk 自动释放 grab” 在部分平台/版本上可能不可靠。
  - 右键菜单：`log_panel` / `rosbot_extension_panel` 使用 `tk_popup` + `menu.grab_release()`，若在 `grab_release()` 前抛错或未执行到，也可能留下 grab。
- **建议**：所有使用 `grab_set()` 的 Toplevel/对话框在关闭路径上显式 `grab_release()` 再 `destroy()`；在 `run()` 之外增加定期或事件后 “检测并释放残留 grab” 的调试/修复路径（仅作验证用亦可）。

---

## 2. overrideredirect + Win32 SetWindowLong/SetWindowPos 导致输入丢失

- **依据**：代码注释已写明 “Win32 SetWindowLong/SetWindowPos in Map path can leave window unresponsive (no input)”，且将 taskbar 修复推迟到 `after(350, _apply_taskbar_fix)` 以避免在 Map 中调用。
- **可能路径**：
  - `_apply_taskbar_fix` 内调用 `ensure_tk_root_in_taskbar(root)`（`SetWindowLong` 改 GWL_EXSTYLE、GWLP_HWNDPARENT，再 `SetWindowPos(..., SWP_FRAMECHANGED)`）。在 Windows 上，这类 Win32 调用会改变窗口的 “所有者/样式”，可能使 Tk 与系统对“前台/焦点窗口”的认知不一致，导致后续键盘/鼠标事件不再投递到该窗口。
  - 若 350ms 时窗口尚未完全就绪，或 SetWindowPos 再次触发 Map，可能与现有的 “只处理一次 Map” 逻辑产生竞态，使焦点/输入状态异常。
- **建议**（思路可完全独立于现有结构）：
  - 临时禁用 `_apply_taskbar_fix`（不调用 `ensure_tk_root_in_taskbar`）观察是否恢复可操作；若恢复，则问题高度可能与 Win32 修改有关。
  - 查阅 Tcl/Tk 官方对 Windows 上 `wm overrideredirect` 与 taskbar 的说明，考虑延后到首次 deiconify 或用户交互后再做 Win32 样式修改，或改用其他方式让窗口出现在任务栏（例如不设 overrideredirect，仅隐藏标题栏边框等）。

---

## 3. focus_force 时机与 Windows SetForegroundWindow 限制

- **依据**：Tk 文档有 `focus_force()`；Windows 对 `SetForegroundWindow` 有限制（例如非前台进程不能随意抢焦点），且代码注释称 “do not focus_force before mainloop (focus is applied in Map handler after(1) to avoid overrideredirect window losing input)”.
- **可能路径**：
  - 当前在 Map 后通过 `after(1, focus_force)`、`_deferred_after_map` 中 50/150/300ms 的多次 `focus_force`，以及 350ms 的 `_apply_taskbar_fix` 末尾的 `focus_force`。若系统因 “非用户激活” 拒绝赋予焦点，而 Tk 内部又认为已请求焦点，可能导致窗口“看起来在前台”但实际收不到键鼠。
  - `event_center._do_show` 中 `deiconify(); lift(); focus_force()` 顺序若在某种窗口状态下被系统拒绝，也会出现同样现象。
- **建议**：
  - 用 MCP/文档查 Windows “SetForegroundWindow” 的允许条件（如当前拥有焦点的线程、用户最近是否点击过本进程等），对照启动/从托盘恢复的时序。
  - 尝试减少或后移部分 `focus_force`（例如仅在用户第一次点击窗口后再做一次），或改为在收到第一次 `<FocusIn>` 时再做了可选的 “巩固焦点” 逻辑，避免与系统策略冲突。

---

## 4. 主线程 after(0) 队列与 handler 内耗时

- **依据**：Tk 文档称 `after(ms, func)` 在主事件循环中执行；`event_center` 通过 `ui.root.after(0, lambda: THREAD_BUS.trigger_event(...))` 将事件派发到主线程。
- **可能路径**（仍属“主线程被占满”，而非其他线程阻塞主线程）：
  - 若主线程上 `after(0)` 排队的任务过多，或某个 handler 内执行了长时间同步操作（如大文件 I/O、复杂计算、或误用的 `wait_window`），会推迟或延迟处理鼠标/键盘事件，表现为 UI “卡住” 或“点不动”。
  - `_dispatch_pending_events` 在 UI 就绪时一次性用多个 `after(0, ...)` 调度积压事件；若积压很多，且每个 handler 都做一点工作，可能造成短时间主线程饱和。
- **建议**：在关键 handler 内加耗时检测或改为 “仅入队 + 下次 idle 处理”；确保没有任何 handler 在主线程上调用阻塞型 `wait_*`（除非设计上就是模态对话框）。

---

## 5. bindtags / takefocus 导致事件未投递到预期控件

- **依据**：Tk 文档中事件按 bindtags 顺序匹配；`takefocus` 控制是否参与 Tab/焦点链。
- **可能路径**：
  - 若某控件或根窗口的 `bindtags` 被改乱，或某层绑定 `return "break"` 且条件过宽，可能吞掉鼠标/键盘事件。
  - `main_notebook` 显式设置了 `takefocus=0`；若大量子控件也 `takefocus=0`，焦点链可能异常，表现为键盘导航或首次点击 “无效”（仅影响键盘或仅影响鼠标视实现而定）。
- **建议**：临时给 root 或主 frame 绑定 `<Button-1>`/`<Key>` 做日志，确认事件是否到达 Tk；再逐层检查是否有 `return "break"` 或 bindtags 修改。

---

## 6. Tk 与 Win32 窗口状态不同步

- **依据**：`ensure_tk_root_in_taskbar` 用 `root.winfo_id()` 取 hwnd 再调 Win32 API；overrideredirect 窗口在 SetWindowLong/SetWindowPos 后，窗口的 Z 序、所有者、样式已由系统修改，Tk 内部状态可能仍按修改前维护。
- **可能路径**：后续 Tk 用 `focus_force()` 或内部逻辑基于过时假设操作“当前窗口”，与 Windows 实际前台窗口不一致，导致输入被送到别的窗口或丢弃。
- **建议**：在 Win32 修改前后打印/记录 `winfo_id()`、焦点窗口、前台窗口（若可用 GetForegroundWindow 等），对比 “可操作” 与 “不可操作” 两种场景的差异。

---

## 7. 其他（简要）

- **系统/防病毒/辅助功能**：某些软件会注入或拦截输入，导致特定窗口收不到键鼠（与代码结构无关，可作环境排查）。
- **多显示器/DPI**：overrideredirect 窗口在部分环境下存在坐标或裁剪问题，可能表现为“点不到”（更像是命中测试问题，可与“无响应”区分）。

---

## 建议的排查顺序（与现有结构解耦的“新思路”）

1. **验证 Grab**：在 `mainloop()` 后或定时器中打印 `root.grab_current()`；若非空且不是预期模态窗，则先在该处加 `grab_release()` 或修复对应对话框的 release 逻辑。
2. **验证 Win32 taskbar 修复**：注释掉 `_apply_taskbar_fix` 的调用或其中 `ensure_tk_root_in_taskbar`，看 UI 是否恢复可操作。
3. **验证焦点策略**：减少或后置 `focus_force`，观察是否改善；并查 Tcl/Tk 官方对 Windows overrideredirect 与焦点的说明。
4. **验证主线程负载**：对 `after(0, ...)` 的 handler 做简单耗时统计，排除 “主线程被占满” 导致的假性无响应。

以上均基于 MCP 检索的 Tk 文档与当前代码路径归纳，未假定必须维持现有架构；可按需选用或重构调用方式（例如将 taskbar/焦点逻辑完全移到独立模块、或改用非 overrideredirect 方案再对比）。

---

## 附录：代码实际与文档/排查目标对照（MCP 先看代码再查文档）

以下先根据代码实际调用点列出“代码在做什么”，再对照 MCP 查到的官方文档，判断**代码实际**与**文档/排查针对的是否为同一问题**。

### A. Grab：代码实际 vs 文档

| 项目 | 代码实际 | 官方文档（MCP 查询 Tk grab / Tcl grab） | 是否同一问题 |
|------|----------|----------------------------------------|----------------|
| **grab_current() 返回值** | `diablo3_macro_ui._release_any_grab`: `current = self.root.grab_current()`，`paths = current if isinstance(current, (list, tuple)) else [current]`，再对 `path` 做 `nametowidget(path)`、`w.grab_release()`。 | Tcl/Tk 官方：`grab current`（无参数）返回 **“A list whose elements are all of the windows grabbed by this application for all displays”**（或空串）。即可能返回 **list**。 | **一致**。代码已按“可能是 list 或单个”处理，与文档“无参返回 list”相符；若某版本返回单一路径字符串，代码也能兼容。 |
| **Toplevel 关闭时是否释放 grab** | **rosbot_extension_panel._ask_choose_rosbot_directory**：`top.grab_set()` 后，`on_ok`/`on_cancel` 仅调用 `top.destroy()`，**未**调用 `top.grab_release()`。 | Tcl/Tk：`destroy` 文档只说明“删除窗口及子控件”，**未**写“destroy 会自动 release grab”。grab 需显式 `grab release window`。 | **一致**。排查“对话框未 release 导致主窗无法操作”针对的正是该处：应显式 `grab_release()` 再 `destroy()`。 |
| **其他 grab 使用** | **asia_credentials**：`top.grab_set()`，`on_ok`/`on_cancel` 内均有 `top.grab_release()` 再 `top.destroy()`。**log_panel / rosbot_extension_panel**：右键菜单 `tk_popup` 后 `menu.grab_release()`。 | 文档：grab 将事件限制在 grab 子树内；release 后恢复。 | **一致**。asia_credentials 与菜单的用法符合文档；问题焦点在 rosbot 目录选择对话框。 |

### B. overrideredirect + Win32 taskbar：代码实际 vs 文档

| 项目 | 代码实际 | 官方文档（MCP 查询 tkdocs / tk） | 是否同一问题 |
|------|----------|----------------------------------|----------------|
| **overrideredirect** | `diablo3_macro_ui._create_ui` 末尾：`self.root.update_idletasks()` 后 `self.root.overrideredirect(True)`。 | tkdocs：`wm_overrideredirect(True)` 移除窗口管理器装饰（标题栏等）。 | **一致**。代码与文档一致；无边框窗口对焦点/输入更敏感，与报告所述问题相关。 |
| **Win32 修改** | **pycore/pyutils/tk_taskbar.py**：`ensure_tk_root_in_taskbar(root)` 内 `hwnd = root.winfo_id()`，然后 GetWindowLong(GWL_EXSTYLE) → 去掉 WS_EX_TOOLWINDOW、加 WS_EX_APPWINDOW → SetWindowLong(GWL_EXSTYLE)、SetWindowLong(GWLP_HWNDPARENT, 0) → SetWindowPos(hwnd, HWND_TOP, 0,0,0,0, SWP_NOMOVE\|NOSIZE\|NOZORDER\|FRAMECHANGED)。**diablo3_macro_ui**：`after(350, _apply_taskbar_fix)` 中调用，且注释写明“第二次 SetWindowLong/SetWindowPos 会使窗口 unresponsive”。 | Tk 文档未描述 Win32 扩展样式/所有者修改；行为属 Windows 与 Tk 交互。 | **一致**。代码实际就是“overrideredirect 后用 Win32 改样式/所有者并 SetWindowPos”，与报告中“SetWindowLong/SetWindowPos 可能导致输入丢失”为同一类问题。 |

### C. focus_force 与 Map/after 时序：代码实际 vs 文档

| 项目 | 代码实际 | 官方文档（MCP 查询 tkdocs） | 是否同一问题 |
|------|----------|-----------------------------|----------------|
| **focus_force 调用点** | Map 回调：`after(1, focus_force)`、`after(0, _deferred_after_map)`（内再 `focus_force`）、`_deferred_after_map` 中 50/150/300ms 再各一次 `focus_force`；350ms `_apply_taskbar_fix` 末尾 `focus_force`；500ms topmost 解除后 `focus_force`。**event_center._do_show**：`deiconify(); lift(); focus_force()`。 | tkdocs：`focus_force()` 强制焦点到该控件。未规定与 Win32 SetForegroundWindow 的对应关系。 | **一致**。文档描述的是 Tk 语义；报告讨论的是“同一现象”在 Windows 上的系统限制（SetForegroundWindow），与代码中多处 focus_force 的时机是否为同一问题：是，均为“窗口获得/恢复焦点与输入”的同一链路。 |

### D. 主线程 after(0) 与事件派发：代码实际 vs 文档

| 项目 | 代码实际 | 官方文档（MCP 查询 tkdocs） | 是否同一问题 |
|------|----------|-----------------------------|----------------|
| **after 调度** | **event_center**：`_schedule_on_main_thread` 使用 `ui.root.after(0, lambda: THREAD_BUS.trigger_event(...))`；UI 未就绪时事件入队，`register_main_thread_handlers` 末尾 `_dispatch_pending_events()` 用多个 `after(0, ...)` 派发积压。 | tkdocs：`after(ms, func)` 在主事件循环中在指定 ms 后执行 func；`mainloop()` 运行事件循环。 | **一致**。代码确实把所有跨线程 UI 操作收敛到 main thread 的 after(0)，与文档“主循环执行 after”一致；排查“主线程被 after 任务占满导致无响应”针对的就是同一机制。 |

### E. 小结：代码实际与查找的是否同一问题

- **Grab**：代码里 `grab_current()` 的 list/单值处理与 Tcl 文档一致；**rosbot 目录选择对话框**只 `destroy()` 不 `grab_release()`，与文档“需显式 release”一致，**是同一问题**。
- **overrideredirect + Win32**：代码在 350ms 调用 `ensure_tk_root_in_taskbar`（SetWindowLong/SetWindowPos），与报告中“Win32 修改导致无响应”的路径一致，**是同一问题**。
- **focus_force**：代码多处、多时机调用，与文档“强制焦点”一致；与 Windows 焦点限制的讨论针对同一现象，**是同一问题**。
- **after(0)**：代码通过 `root.after(0, ...)` 派发到主线程，与文档一致；主线程饱和的排查与代码实际一致，**是同一问题**。

结论：当前可能性报告中的各项，与代码实际和 MCP 所查官方文档**均针对同一类问题**，可按报告中的排查顺序在现有代码上验证（优先：grab 释放、临时关闭 taskbar 修复、焦点时机、主线程负载）。

---

## 代码实际 vs 文档归纳：是否同一问题

以下对照**当前代码实现**与上文归纳的**可能性**，并引用 MCP 查阅的 Tk 官方文档，说明“代码在防的是什么”与“文档归纳的是否为同一类问题”。

### 1. Grab 未释放

| 项目 | 说明 |
|------|------|
| **文档归纳** | grab 子树独占输入直到 release；Toplevel 仅 `destroy()` 未显式 `grab_release()` 可能残留 grab。 |
| **代码实际** | `diablo3_macro_ui.run()` 仅在进入 `mainloop()` 前调用一次 `_release_any_grab()`（约 L897–915），内部用 `root.grab_current()` 取当前 grab，按“字符串路径或路径列表”解析后对对应 widget 调 `grab_release()`。`rosbot_extension_panel._ask_choose_rosbot_directory`（L377–409）：`top.grab_set()` 后，`on_ok`/`on_cancel` 仅 `top.destroy()`，**无显式 `top.grab_release()`**。`asia_credentials` 中 OK/Cancel 与 WM_DELETE_WINDOW 均先 `grab_release()` 再 `destroy()`。 |
| **MCP 文档** | Tk 文档（tkdocs_pyref）：`grab_current()` 返回“当前持有 grab 的 widget”；`grab_release()` 释放 grab；`destroy()` 销毁 widget。文档未明确写“destroy 是否自动释放 grab”，实现上通常会在销毁时释放，但显式 release 更稳妥。 |
| **是否同一问题** | **是**。文档归纳的“仅 destroy、未显式 release”与 rosbot 目录选择对话框的代码一致；主窗口只在 mainloop 前释放一次 grab，无法解决**运行过程中**因该对话框或菜单异常路径导致的残留 grab。 |

---

### 2. overrideredirect + Win32 SetWindowLong/SetWindowPos

| 项目 | 说明 |
|------|------|
| **文档归纳** | 在 Map 中或多次执行 Win32 修改会导致窗口 unresponsive；应只在一次、延后（如 350ms）执行 taskbar 修复。 |
| **代码实际** | `diablo3_macro_ui.py`：L148–153 注释明确“第二次 SetWindowLong/SetWindowPos 会使窗口 unresponsive”“Map 路径中调用会 no input”；L154–167 的 `<Map>` 处理中**不**调用 `ensure_tk_root_in_taskbar`，仅做 `focus_force` 与 `_deferred_after_map`（50/150/300ms 再 focus_force）；L153 用 `after(350, self._apply_taskbar_fix)` 仅一次；L416–431 `_apply_taskbar_fix` 内用 `_taskbar_style_applied` 保证 `ensure_tk_root_in_taskbar(root)` 只执行一次，且前后有 `update_idletasks()` 和 `focus_force()`。`pycore.pyutils.tk_taskbar.ensure_tk_root_in_taskbar`（L106–124）：对 `root.winfo_id()` 取 hwnd，调 SetWindowLongPtrW(GWL_EXSTYLE)、SetWindowLongPtrW(GWLP_HWNDPARENT)、SetWindowPos(SWP_FRAMECHANGED)。 |
| **MCP 文档** | Tk 文档：`wm_overrideredirect(True)` 去除窗口管理器装饰；无直接写“与 Win32 组合后输入丢失”，但与“焦点/grab 由窗口状态决定”一致。 |
| **是否同一问题** | **是**。代码刻意避免在 Map 中调 Win32、且只在一处 350ms 后执行一次，**针对的正是文档归纳的同一问题**。若仍出现无响应，可能是“单次 350ms 执行”在部分环境下仍导致焦点/输入丢失（文档建议的“临时禁用 ensure_tk_root_in_taskbar 观察”在代码中尚未做成可配置）。 |

---

### 3. focus_force 时机与 Windows 限制

| 项目 | 说明 |
|------|------|
| **文档归纳** | 多次 focus_force、或在不当时机调用，可能被系统拒绝，导致“窗口在前台但收不到键鼠”。 |
| **代码实际** | Map 后：`after(1, focus_force)`、`_deferred_after_map` 内立即一次再加 50/150/300ms 各一次；350ms 的 `_apply_taskbar_fix` 末尾一次；500ms 的 `_apply_first_run_topmost` 回调里一次（注释写明“restore focus after -topmost to prevent input loss”）；`event_center._do_show`（L58–65）中 `deiconify(); lift(); focus_force()`。 |
| **MCP 文档** | Tk 文档：`focus_force()` 强制把焦点设到该 widget；无 Windows SetForegroundWindow 限制的说明（属系统行为）。 |
| **是否同一问题** | **是**。代码通过多处、多时机 focus_force 来“补偿” overrideredirect 与 Win32 修改带来的焦点丢失，与文档归纳的“焦点策略可能被系统拒绝”属同一类问题；若系统拒绝某次 focus_force，现象即“无法操作”。 |

---

### 4. 主线程 after(0) 队列与 handler 耗时

| 项目 | 说明 |
|------|------|
| **文档归纳** | 大量 `after(0, ...)` 或 handler 内耗时会导致主线程迟迟不处理键鼠事件，表现为“卡住/点不动”。 |
| **代码实际** | `event_center._dispatch_pending_events`（L134–149）：在 UI 就绪时 `while _pending_events` 循环，对每个积压事件执行 `ui.root.after(0, lambda ... THREAD_BUS.trigger_event(...))`，即一次性调度多个 after(0)。主线程上其他处也大量使用 `root.after(0, f)` 或 `container.after(0, f)` 将结果回主线程。 |
| **MCP 文档** | Tk 文档（Global Methods）：`after(ms, func=None, *args)` 在指定延迟后调用函数；主事件循环按顺序执行这些回调。 |
| **是否同一问题** | **是**。代码的“积压事件一次性用多个 after(0) 派发”与文档归纳的“主线程队列饱和/短时占满”一致；若某 handler 内存在同步耗时或误用 `wait_window`，也会与文档描述一致。 |

---

### 5. bindtags / takefocus

| 项目 | 说明 |
|------|------|
| **文档归纳** | bindtags 被改乱或 `return "break"` 过宽会吞事件；大量 `takefocus=0` 可能影响焦点链。 |
| **代码实际** | 仅 `diablo3_macro_ui.py` L484–486：`main_notebook.configure(takefocus=0)`，注释为“avoid dotted focus ring on selected tab”。未发现对 root 或主 frame 的 bindtags 修改；未全局搜索 `return "break"`。 |
| **MCP 文档** | Tk 文档：事件按 bindtags 顺序匹配；takefocus 控制是否参与焦点链。 |
| **是否同一问题** | **部分一致**。代码仅对 Notebook 有意设置 takefocus=0，与文档“大量 takefocus=0 可能影响焦点链”相比范围小；文档建议的“检查 bindtags / return break”需在代码中逐绑定排查，当前未做。 |

---

### 6. Tk 与 Win32 窗口状态不同步

| 项目 | 说明 |
|------|------|
| **文档归纳** | Win32 修改后，Tk 内部对“当前窗口/焦点”的假设可能过时，导致输入投递到错误窗口或丢失。 |
| **代码实际** | `_apply_taskbar_fix` 在调用 `ensure_tk_root_in_taskbar(root)` 前后均 `update_idletasks()` 并在最后 `focus_force()`，意图让 Tk 与系统同步并夺回焦点；未在 Win32 调用前后打印 `winfo_id()`/GetForegroundWindow 等做对比。 |
| **MCP 文档** | Tk 文档：`winfo_id()` 返回窗口 ID；无 Win32 与 Tk 状态同步的专门说明。 |
| **是否同一问题** | **是**。代码用“Win32 后立刻 focus_force”来缓解文档归纳的“不同步”；若某次 focus_force 未真正生效，即表现为同一类“无法操作”问题。 |

---

### 7. 其他（环境 / DPI）

| 项目 | 说明 |
|------|------|
| **文档归纳** | 系统/防病毒/辅助功能拦截输入；多显示器/DPI 导致命中测试异常。 |
| **代码实际** | 无针对环境或 DPI 的专项逻辑；与“无响应”的代码层面原因无直接对应。 |
| **是否同一问题** | **一致**。文档将此类归为环境/外部因素，代码未假定与其为同一实现问题，仅作排查方向。 |

---

### 小结（代码 vs 文档）

- **1 Grab**：代码与文档针对的是同一类问题；rosbot 目录对话框仍缺显式 `grab_release()`，且 `_release_any_grab` 仅 mainloop 前执行一次。
- **2 overrideredirect + Win32**：代码已按文档思路规避“Map 内/多次调用”，只在一处 350ms 执行；若仍无响应，与文档“单次 Win32 仍可能导致输入丢失”一致，建议按文档做“禁用 taskbar 修复”的对比测试。
- **3 focus_force**：代码通过多时机 focus_force 应对文档归纳的焦点丢失；与“被系统拒绝导致无法操作”为同一问题。
- **4 after(0)**：积压事件一次性 after(0) 派发与文档“主线程饱和”一致；handler 内是否耗时需结合具体回调排查。
- **5 bindtags/takefocus**：仅 Notebook takefocus=0，与文档部分一致；bindtags/return break 需人工补查。
- **6 Tk/Win32 不同步**：代码用 focus_force 缓解，与文档归纳同一问题；未做文档建议的“前后对比打印”。
- **7 其他**：环境/DPI 与代码无直接对应，一致。

以上“代码实际”基于当前仓库检索；“MCP 文档”基于 Context7 查询的 tkdocs_pyref / Tk 全局方法及 Toplevel 继承方法。
