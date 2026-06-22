# d3-check UI 无法操作 — 可能性报告

基于 MCP 文档查询（Tkinter / Win32 API）与代码路径梳理，从**非线程阻塞**角度归纳可能导致主窗口无法接收键盘/鼠标输入的原因及对应思路。不假定必须维持现有代码结构。

## 文档勘误（与当前代码）

- 主窗口无边框在 Windows 上可能由 **`_make_frameless_win32`**（对 wrapper HWND 的 `GWL_STYLE` / `GWL_EXSTYLE`）实现，**不一定**再在 **`_create_ui()` 末尾**调用 **`overrideredirect(True)`**；表中旧行号（如 L319–321）与「`_create_ui` 末尾 overrideredirect」**可能已过期**。
- 与「双窗口 / ghost wrapper」相关的调查见 **`docs/ui2/WINDOWS_TK_WRAPPER_GHOST_DOUBLE_WINDOW_INVESTIGATION.md`**。
- 下文仍用 **overrideredirect** 描述**无边框顶层窗**的语义与焦点风险；若实际为 Win32 去装饰，Win32 样式修改可能已在初始化阶段完成，与 **`ensure_tk_root_in_taskbar`** 的叠加关系以当前 `diablo3_macro_ui.py` 为准。

---

## 1. Win32 修改窗口样式导致 Tk 与系统焦点不同步（高）

**依据**  
- 代码注释已写明：`SetWindowLong/SetWindowPos in Map path can leave window unresponsive (no input)`，且要求 taskbar 修复**只执行一次**、不可在 Map 路径中再次调用。  
- `pycore/pyutils/tk_taskbar.py` 中 `ensure_tk_root_in_taskbar()` 会：  
  - 修改 `GWL_EXSTYLE`（去掉 `WS_EX_TOOLWINDOW`，加上 `WS_EX_APPWINDOW`）；  
  - 将 owner 设为 NULL；  
  - 调用 `SetWindowPos(hwnd, HWND_TOP, 0,0,0,0, SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_FRAMECHANGED)`。  
- MSDN：使用 `SetWindowLong` 改窗口数据后，需用 `SetWindowPos(..., SWP_FRAMECHANGED)` 使改动生效；`SWP_FRAMECHANGED` 会触发 `WM_NCCALCSIZE` 等消息，可能改变窗口与输入焦点/激活状态的关系。  
- 当前流程：窗口 Map → 一次 Map 处理 + `focus_force`（1/50/150/300ms）→ 350ms 时执行 `ensure_tk_root_in_taskbar`（即上述 Win32 调用）→ 再 `focus_force`。若 Win32 调用后系统或 Tk 内部把窗口从“前台/激活”状态撤掉，而 Tk 仍认为已 focus，就会出现“窗口可见但无输入”的现象。

**可能性**  
在 **overrideredirect(True)** 的 Tk 窗口上，在已 Map 之后用 Win32 改 EXSTYLE 并 `SetWindowPos(SWP_FRAMECHANGED)`，与 Tk 的焦点/激活逻辑存在时序冲突，导致系统不再把输入交给该窗口。

**思路（可不拘泥现有结构）**  
- 方案 A：不在已显示的 overrideredirect 窗口上调用 `ensure_tk_root_in_taskbar`；改为接受“无任务栏按钮”或使用其他方式（如托盘 + 显示/隐藏），避免对同一 HWND 做 SetWindowLong + SetWindowPos。  
- 方案 B：若必须保留任务栏，可尝试在**首次 Map 之前**（例如在 `overrideredirect(True)` 之后、`deiconify`/首次显示之前）通过 Win32 设好 EXSTYLE/owner，再让窗口 Map，减少“先 Map 再改样式”的时序问题。  
- 方案 C：用 Win32 文档推荐的 `SetForegroundWindow`/`SetActiveWindow` 在 `ensure_tk_root_in_taskbar` 之后显式激活窗口，并考虑 MSDN 的“foreground lock timeout”限制（见下节）。

---

## 2. Windows 前台锁定超时导致 focus_force 无效（中高）

**依据**  
- MSDN：`SetForegroundWindow` 仅在满足一系列条件时生效，其中包括 **foreground lock timeout 已过期**；若用户近期在其他窗口有输入，系统会在一段时间内禁止本进程强制抢前台。  
- Tk 在 Windows 上的 `focus_force()` 通常会映射到 `SetForegroundWindow`。若此时系统因“前台锁定”拒绝请求，则不会报错，但窗口不会真正获得输入焦点。  
- 当前在 Map 与 350ms taskbar 修复后都调用了 `focus_force`；若启动时用户刚操作过其他程序（或调试器/启动脚本曾拥有焦点），可能出现“所有 focus_force 都静默失败、界面无输入”。

**可能性**  
在部分启动时序下，主窗口从未被系统授予前台，Tk 的 focus 状态与系统不一致，表现为 UI 无法操作。

**思路**  
- 查阅 MSDN：`AllowSetForegroundWindow`、`LockSetForegroundWindow`、`SPI_GETFOREGROUNDLOCKTIMEOUT`；若需强制本进程可设前台，需在满足条件时调用（例如本进程为前台、或由前台进程启动）。  
- 不依赖“启动时抢焦点”：改为在**用户第一次与窗口交互时**（如点击窗口或任务栏）再强调 focus，或仅用 `focus_set()` 而避免在 init 阶段频繁 `focus_force()`，减少与系统策略的冲突。  
- 或接受“首次需用户点一下窗口才可操作”，在 UI 上做简短提示。

---

## 3. overrideredirect(True) 与无边框窗口的输入行为（中）

**依据**  
- Tk 文档：`wm_overrideredirect(True)` 会移除窗口管理器装饰（标题栏、边框等）。  
- 在 Windows 上，overrideredirect 窗口通常不经过标准 WM_ACTIVATE/任务栏/Alt+Tab 路径，Tk 与系统对“谁拥有焦点”的维护可能不一致；部分环境或 Tk 版本下，此类窗口在经历 Win32 样式修改或 Z-order 变化后，会出现“可见但无输入”的已知问题。

**可能性**  
overrideredirect + 后续 Win32 修改（任务栏修复）组合，触发了 Tk 或系统对无边框窗口焦点处理的边界情况。

**思路**  
- 若可接受有边框：临时改为 `overrideredirect(False)` 验证“无 taskbar 修复时是否仍有问题”；若去掉 Win32 调用后可操作，则与 1 联合考虑。  
- 保留无边框时：尽量不再对同一窗口做 SetWindowLong/SetWindowPos（见 1）；或参考其他框架（如 CustomTkinter、PyQt 的无边框窗口）在 Windows 上的推荐做法（MCP 可查 CustomTkinter 等）。

---

## 4. Grab 未释放导致主窗口得不到输入（中）

**依据**  
- Tk 文档：`grab_set()` 会使该控件及其子树独占输入，直到 `grab_release()`；`grab_current()` 可查看当前拥有 grab 的控件。  
- 代码中：`rosbot_extension_panel._ask_choose_rosbot_directory`、`share/asia_credentials` 等对 Toplevel 使用 `top.grab_set()` + `wait_window()`；主窗 `run()` 前会 `_release_any_grab()`。  
- 若某次弹窗未正常关闭（异常、未走 on_ok/on_cancel 即 destroy），在部分 Tk 版本下 grab 可能未正确释放，导致后续所有输入仍被该（可能已不可见）窗口“持有”，主窗无法操作。

**可能性**  
启动阶段若曾打开过带 grab 的对话框且异常退出，或某处误对主 root 子控件调用了 `grab_set()` 且未释放，会出现整窗无输入。

**思路**  
- 在 `run()` 或主窗 `deiconify` 时再次调用 `_release_any_grab()`，并打日志：若 `grab_current()` 非空则打印 widget 路径，便于确认是否曾有残留 grab。  
- 检查所有 `grab_set()` 调用点，确保在 `destroy`、取消、异常路径中都有对应的 `grab_release()` 或 `wait_window()` 正确结束。  
- 若怀疑是启动时触发的弹窗：推迟此类对话框的创建或显示，直到用户明确点击再弹出，避免与主窗 Map/taskbar 修复时序重叠。

---

## 5. Map 事件只处理一次与 350ms 的二次 Map（低–中）

**依据**  
- 代码用 `_map_event_processed` 保证只处理一次 Map；注释称 350ms 的 `SetWindowPos` 可能再次触发 Map，因此不再在 Map 中做 taskbar 修复。  
- 若 350ms 的 SetWindowPos 确实引发第二次 Map，而 Tk 内部在第二次 Map 时做了某些“失活”或清除焦点的操作，且我们因“只处理一次”未再跑 focus 逻辑，则可能留下“无焦点”状态。

**可能性**  
第二次 Map 与“只处理一次 Map”的组合，在少数时序下导致焦点被清掉且未再拉回。

**思路**  
- 不依赖“只处理一次”：在 Map 回调里不做 Win32 调用，仅做轻量 focus（如 `after(1, focus_force)`）；所有 SetWindowLong/SetWindowPos 集中在 350ms 的单一 after 中，并在其后再次 `focus_force` + 可选 `update_idletasks()`。  
- 或：在 350ms 的 after 里执行完 taskbar 修复后，再 `after(10, focus_force)` 延迟一帧抢焦点，避免与 SetWindowPos 触发的消息处理同帧竞争。

---

## 6. 事件中心与 after(0) 调度（低）

**依据**  
- `event_center` 通过 `root.after(0, ...)` 把事件派发到主线程；`config_change_hub` 也用 `root.after(0, _dispatch_pending)` 做 coalesce。  
- 若主线程在 mainloop 之前或早期存在大量 after(0) 回调（如多处 notify_config_changed 或 pending 事件一次性派发），且某个回调耗时较长或存在递归 `update()`/`update_idletasks()`，理论上会推迟后续事件（包括输入）的处理；你已排除“线程阻塞”，此处仅考虑主线程上**同步耗时**导致的暂时无响应。

**可能性**  
主线程在启动阶段被大量 after(0) 占满或单次回调过重，短时间内表现为“点不动”。

**思路**  
- 将 config 变更或非关键 UI 同步改为 `after(50, ...)` 或 `after_idle`，分散到不同帧执行，避免与 Map/350ms 的 focus 逻辑挤在同一批 after(0) 中。  
- 确保 `_dispatch_pending_events`、`_flush_pending_queue` 等不执行重逻辑、不阻塞。

---

## 7. 坐标校准 Tab 与“全 UI 冻结”的关联（低–中）

**依据**  
- 代码注释：从不把 `last_selected_tab` 恢复为“坐标校准” tab，以避免“full UI freeze”。说明该 tab 或其内容（如 messagebox、控件、绑定）曾在启动或切换时导致整窗卡住。

**可能性**  
若用户通过配置或其它路径在启动时仍进入坐标校准 tab，或该 tab 内存在 grab/模态/死循环/大量 layout，可能间接触发“无法操作”或“看起来像无输入”的冻结。

**思路**  
- 保持“启动时不恢复至坐标校准 tab”的策略；若存在其它入口会切到该 tab，检查其是否在未完全创建或 Map 前就执行。  
- 单独排查该 tab 内是否有未释放的 grab、阻塞的 messagebox 或重复的 `update()` 调用。

---

## 8. 建议的排查顺序（与是否改结构无关）

1. **先验证 Win32 影响**：注释掉 `_apply_taskbar_fix` 中对 `ensure_tk_root_in_taskbar(root)` 的调用（或整个 350ms after），仅保留 `focus_force`。若这样即可操作，则 1/2/3 的组合概率高，再在“不调用 SetWindowLong/SetWindowPos”或“改变调用时机/方式”的前提下恢复任务栏逻辑。  
2. **再验证 focus 策略**：在保留 taskbar 修复的情况下，减少 init 阶段的 `focus_force` 次数，或改为在用户首次点击窗口时再 `focus_force`，看是否缓解。  
3. **检查 grab**：在 `run()` 和每次主窗显示时打印 `grab_current()`；若非空且非预期，按第 4 条排查并保证所有 grab 有释放路径。  
4. **最后再考虑**：overrideredirect 是否改为有条件使用、或引入其他 UI 框架的无边框方案（需评估成本）。

---

## 9. 文档来源摘要

- **Tkinter**（tkdocs_pyref）：`wm_overrideredirect`、grab/focus 方法、mainloop/after/update_idletasks。  
- **Win32**（learn_microsoft_en-us_windows_win32_api）：`SetForegroundWindow` 条件与限制、foreground lock timeout、`SetWindowPos` 与 `SWP_FRAMECHANGED`、`SetWindowLong` 后需调用 `SetWindowPos` 使样式生效。

以上为基于 MCP 文档与代码梳理的**可能性报告**，未改动现有实现；实际修复时可从第 8 条顺序入手，并视结果决定是否采用 1–7 中的某一或多种思路（包括不维护现有代码结构的方案）。

---

## 10. UI 架构过程（代码实际）与报告假设对照

本节先按**代码实际**梳理 UI 构建与焦点/任务栏流程，再逐条对照「报告中的假设」与「代码实际是否针对同一问题」，并注明 MCP 查阅的官方文档结论。**方法：先看代码，再根据代码调用 MCP 查 Tk 文档。**

### 10.1 代码中的 UI 构建与焦点时序（实际）

1. **主窗口创建**（`ui/diablo3_macro_ui.py`）  
   - `__init__`：`root = tk.Tk()` → geometry/title/minsize 等 → **`withdraw()`** → **`_make_frameless_win32`**（Windows）或 **`overrideredirect(True)`**（回退）→ **`UITheme.apply_to_root`** → **`_create_ui()`**（**不再**在 `_create_ui` 末尾调用 `overrideredirect`）。  
   - 其后：`after(350, _apply_taskbar_fix)`；`bind("<Map>", _on_map)`；`_apply_first_run_topmost()`；`bind("<Configure>", ...)`；`_create_system_tray()`；条件 **`ensure_content_sync`**；**`deiconify()`**；**`register_main_thread_handlers`**。详见 **`docs/ui2/WINDOWS_TK_WRAPPER_GHOST_DOUBLE_WINDOW_INVESTIGATION.md`**。

2. **Map 与焦点**  
   - `_on_map`：仅处理一次（`_map_event_processed`），内部 `after(1, focus_force)`、`after(0, _deferred_after_map)`。  
   - `_deferred_after_map`：以**当前源码**为准（通常为**单次** `focus_force()`，已简化多段 50/150/300ms）。  
   - 注释明确：Map 里**不**调用 `ensure_tk_root_in_taskbar`/SetForegroundWindow，避免“Win32 SetWindowLong/SetWindowPos in Map path can leave window unresponsive”。

3. **任务栏修复**（350ms）  
   - `_apply_taskbar_fix`：`update_idletasks` → `ensure_tk_root_in_taskbar(self.root)`（仅一次，`_taskbar_style_applied`）→ 再 `update_idletasks` → `focus_force()`。  
   - `ensure_tk_root_in_taskbar`（`pycore/pyutils/tk_taskbar.py`）：GetWindowLong(GWL_EXSTYLE) → 去掉 WS_EX_TOOLWINDOW、加 WS_EX_APPWINDOW → SetWindowLong → SetWindowLong(GWLP_HWNDPARENT, 0) → SetWindowPos(..., SWP_FRAMECHANGED)。

4. **run() 入口**  
   - `_release_any_grab()`：`current = self.root.grab_current()`，按 list 或单值转成 `paths`，对每个 path 若为 str 则 `nametowidget(path)` 后 `grab_release()`。  
   - 然后 `update_idletasks()` → `mainloop()`。  
   - **未**在 run() 或 _apply_taskbar_fix 后调用 `_win32_set_foreground()`（即当前代码**从未**调用 SetForegroundWindow）。

5. **grab 使用点（代码实际）**  
   - **asia_credentials**（`share/asia_credentials.py`）：`top.grab_set()`；on_ok / on_cancel 均先 `top.grab_release()` 再 `top.destroy()`。**与报告一致，此处为正确释放。**  
   - **rosbot_extension_panel._ask_choose_rosbot_directory**：`top.grab_set()`；on_ok / on_cancel 仅 `top.destroy()`，**未**显式 `top.grab_release()`。**与报告“某处 Toplevel 未在关闭路径释放 grab”对应。**  
   - **log_panel / rosbot_extension_panel 右键菜单**：使用 `menu.grab_release()`；若在 release 前异常，可能残留 grab。

6. **event_center 主线程派发**（`d3utils/event_center.py`）  
   - `register_main_thread_handlers(ui)` 在 UI 创建后、mainloop 前调用；WINDOW_SHOW 等由 THREAD_BUS 经 `ui.root.after(0, lambda: THREAD_BUS.trigger_event(...))` 派发。  
   - `_do_show()`：`deiconify()` → `lift()` → `focus_force()`，**未**调用 `_win32_set_foreground()`。

### 10.2 报告假设 vs 代码实际 vs 是否同一问题（含 MCP 文档）

| 报告节 | 报告中的假设 | 代码实际 | 是否同一问题 | MCP 官方文档对照（tkdocs_pyref） |
|--------|----------------|----------|--------------|----------------------------------|
| **§1 Win32 SetWindowPos/SetWindowLong** | 350ms 一次 taskbar 修复仍可能使窗口无输入；注释已指出“第二次会 unresponsive”。 | 代码仅在 350ms 调用一次 `ensure_tk_root_in_taskbar`，且刻意不在 Map 中调用；注释与实现一致。 | **是**。报告针对的正是“当前这一次”SetWindowLong/SetWindowPos 与焦点/输入的交互；代码已规避“第二次”，但未规避“第一次”可能带来的输入丢失。 | Tk 文档仅说明 `wm_overrideredirect(True)` 移除装饰，未规定 Windows 上其后 Win32 改 ex-style 的行为；焦点/输入属平台行为，与报告机制一致。 |
| **§2/§3 overrideredirect + 焦点时机** | 无边框窗口需在“真正映射后”再抢焦点；Map 内多次 focus_force 可能过早或与 SetWindowPos 冲突。 | 实际顺序：Map 内 after(1/0) 与 `_deferred_after_map`；350ms `_apply_taskbar_fix`；500ms topmost 等（以当前源码为准）。 | **是**（若仍属多时刻 focus）。 | 文档：focus_force “Forces focus to the widget”；无边框语义含 Win32 路径；与“时机敏感”假设不矛盾。 |
| **§4 grab 未释放** | 某处 Toplevel 未在关闭路径 grab_release；grab_current 可能返回单字符串，按 list 或类型判断不当会漏释。 | **rosbot 选择目录对话框**：on_ok/on_cancel 仅 `top.destroy()`，无 grab_release，与报告**一致**。asia_credentials 已正确 release。_release_any_grab 用 `isinstance(current,(list,tuple)) else [current]` 且只对 str 做 nametowidget。 | **是**。报告中的“未释放”在 rosbot 对话框中有对应实现；grab_current 返回值形态需在运行环境确认。 | 文档：grab_current() “Returns the widget that currently has the grab”；grab_release() “Releases the input grab”；destroy() 未写明是否自动释放 grab，故“显式 release 再 destroy”与文档不冲突。 |
| **§6 after(0) 淹没** | 大量 after(0) 使用户事件被延后，表现为卡顿或点不动。 | event_center 与多处 panel 使用 root/container.after(0, ...)；_dispatch_pending_events 用 while 循环多次 after(0, trigger_event)。 | **是**。代码存在“成批 after(0)”的路径，与报告“主线程不阻塞但事件被延后”一致。 | 文档：after(ms, func) 在主事件循环中执行；未规定 0ms 与用户事件的优先级，与“队列延后”假设一致。 |
| **§2 SetForegroundWindow** | 必要时需 SetForegroundWindow 补救；focus_force 可能被系统拒绝。 | 代码**从未**调用 `_win32_set_foreground()`（SetForegroundWindow）；仅多处 focus_force。 | **是**。若 Tk 的 focus_force 在 overrideredirect 下不足以让 Windows 交付输入，当前实现没有补救路径。 | 文档无 SetForegroundWindow（属 Win32）；focus_force 文档未保证 Windows 下 overrideredirect 窗口一定能收到输入。 |
| **§5 takefocus/bindtags** | 焦点链断裂或 bindtags 吞事件。 | 仅 `main_notebook.configure(takefocus=0)`；未发现对 root 或主 frame 的 bindtags 修改或全局 return "break"。 | **部分**。报告列为低优先级；代码未暴露出明显异常，与“补充检查”一致。 | 文档：takefocus 控制是否参与焦点链；bindtags 决定绑定顺序。 |

### 10.3 小结：代码实际与报告是否针对同一问题

- **§1、§2、§3、SetForegroundWindow**：代码实际与报告描述的是**同一类问题**——无边框（Win32 或 overrideredirect）+ 任务栏 Win32 修复 + Map/350ms 等路径上的 focus、且无 SetForegroundWindow 补救；报告建议的“单点焦点恢复”“延后或取消 taskbar 修复验证”“必要时 SetForegroundWindow”仍可用于对照。  
- **§4 grab**：**是同一问题**。rosbot 目录选择对话框未在 on_ok/on_cancel 中 grab_release，与报告“某处 Toplevel 未释放 grab”对应；asia_credentials 已正确释放；grab_current 返回值处理在代码中按 list/str 做了防御，但文档未明确返回类型，需运行态确认。  
- **§6 after(0)**：**是同一问题**。代码中 after(0) 的使用方式与报告“事件队列被占满”的假设一致。  
- **§5**：报告与代码一致，均为低优先级、无明显异常配置。

**MCP 使用方式**：先阅读 `ui/diablo3_macro_ui.py`、`pycore/pyutils/tk_taskbar.py`、`d3utils/event_center.py`、`ui/panels/rosbot_extension_panel.py`、`share/asia_credentials.py` 中与 overrideredirect、grab、focus、after 相关的片段；再通过 Context7 查询 tkdocs_pyref 的 grab_current、grab_release、focus_force、wm_overrideredirect、after，确认文档未否定上述机制，并注明“destroy 是否自动释放 grab”文档未明确，故建议显式 release 再 destroy。

---

## 10. 代码构架与初始化时间线（实际执行顺序）

以下为根据 `ui/diablo3_macro_ui.py` 与 `pycore/pyutils/tk_taskbar.py` 梳理的**实际代码执行顺序**，便于与报告中的“可能性”逐条对照。

### 10.1 进程启动 → 主窗创建

| 顺序 | 代码位置 | 行为 |
|------|----------|------|
| 1 | `__init__` 开头 | `set_windows_app_user_model_id("pycore.d3check.1.0")`（在创建 Tk 之前） |
| 2 | | `self.root = tk.Tk()`，设置 title、geometry、minsize 等 |
| 3 | | `withdraw()` → **`_make_frameless_win32`** 或 **`overrideredirect(True)`** → **`UITheme.apply_to_root`** → **`_create_ui()`**（无边框**不在**此处末尾设置） |
| 4 | | `root.after(350, self._apply_taskbar_fix)` 登记 350ms 后执行 |
| 5 | | `root.bind("<Map>", _on_map)`：Map 时 `_map_event_processed=True`，`after(1, focus_force)`，`after(0, _deferred_after_map)`（`_deferred_after_map` 以当前源码为准） |
| 6 | | `_apply_first_run_topmost()`：`lift()`，`attributes("-topmost", True)`，`after(500, ...)` 在 500ms 时 `attributes("-topmost", False)` 且 `focus_force` |
| 7 | | `bind("<Configure>", ...)`，`_create_system_tray()`，条件 ROSBOT **`ensure_content_sync`**，**`deiconify()`**，**`register_main_thread_handlers(self)`** |

### 10.2 延迟回调时间线（mainloop 前/中）

| 时间 | 回调 | 行为 |
|------|------|------|
| Map 时 | `_on_map` | 仅首次：`after(1, focus_force)`，`after(0, _deferred_after_map)`（以当前源码为准，未必仍有 50/150/300ms 多段） |
| 350ms | `_apply_taskbar_fix` | `update_idletasks` → **`ensure_tk_root_in_taskbar(root)`**（SetWindowLong GWL_EXSTYLE、GWLP_HWNDPARENT，SetWindowPos HWND_TOP + SWP_FRAMECHANGED）→ `update_idletasks` → win32 时 `_set_window_icon()` → **`focus_force()`** |
| 500ms | 来自 `_apply_first_run_topmost` | `attributes("-topmost", False)`，`focus_force()` |
| 500ms | `start_system_tray_if_needed` | 启动托盘（若尚未启动） |

### 10.3 与焦点相关的实际调用点

- **focus_force**：Map 路径（1ms、0ms、50/150/300ms）、`_apply_taskbar_fix` 末尾、500ms topmost 回调、`_do_show_window`（托盘“显示”）、`switch_to_tab`。
- **SetForegroundWindow（Win32）**：仅存在于 `_win32_set_foreground()`；**初始化与 350ms 路径中未调用**，仅在该方法被显式调用的场景（如从托盘恢复后若某处调用）才会执行。
- **ensure_tk_root_in_taskbar**：仅 350ms 的 `_apply_taskbar_fix` 内调用一次；内部为 `SetWindowLong(GWL_EXSTYLE)`、`SetWindowLong(GWLP_HWNDPARENT, 0)`、`SetWindowPos(..., SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_FRAMECHANGED)`（与 MSDN 要求“改 SetWindowLong 后须 SetWindowPos(SWP_FRAMECHANGED)”一致）。

### 10.4 run() 入口

- `run()` 内：`_release_any_grab()`（若有 grab 则对 root 下控件 `grab_release()`），`update_idletasks()`，**不**在 mainloop 前再调 `focus_force`（注释写明避免 overrideredirect 窗口在 mainloop 前抢焦点导致丢失输入）。

---

## 11. 代码实际与报告/文档对照：是否同一问题

在**先看代码、再据代码查 MCP 官方文档**的前提下，对报告中的每条“可能性”做对照：代码实际做的是否与文档/报告描述的是**同一类问题**。

### 可能性 1：Win32 修改窗口样式导致焦点不同步

| 维度 | 代码实际 | MCP 文档 / 报告 |
|------|----------|-----------------|
| **是否同一问题** | **是** | 报告描述的问题与代码路径一致。 |
| 代码实际 | 在**窗口已 Map 后**的 350ms，对 root 的 HWND 执行：`SetWindowLong(GWL_EXSTYLE)`（去 WS_EX_TOOLWINDOW、加 WS_EX_APPWINDOW）、`SetWindowLong(GWLP_HWNDPARENT, 0)`、`SetWindowPos(hwnd, HWND_TOP, 0,0,0,0, SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_FRAMECHANGED)`；随后立即 `focus_force()`。 |
| 官方文档 | **Win32 (MSDN)**：修改窗口数据（如 frame style）后必须调用 `SetWindowPos` 且带 `SWP_FRAMECHANGED` 才能生效（SetWindowLong Remarks）。代码的 flags 与 MSDN 推荐一致。文档未明确写“会改变焦点”，但明确要求 SWP_FRAMECHANGED 以更新缓存。 |
| 结论 | 代码在做 MSDN 规定的样式生效步骤；报告假设的“SetWindowPos(SWP_FRAMECHANGED) 可能影响焦点/激活”在文档中无直接表述，但与“改样式后缓存更新、窗口重算”一致，**与“窗口无输入”现象可对应**，视为同一类问题合理。 |

### 可能性 2：Windows 前台锁定导致 focus_force 无效

| 维度 | 代码实际 | MCP 文档 / 报告 |
|------|----------|-----------------|
| **是否同一问题** | **部分一致**：代码未直接用 SetForegroundWindow，但多次 focus_force；若 Tk 内部映射到 SetForegroundWindow，则与文档限制一致。 |
| 代码实际 | 启动阶段**仅使用 Tk 的 `focus_force()`**，未在 init/350ms 路径中调用 `_win32_set_foreground()`（即未直接调用 `SetForegroundWindow`）。focus_force 在 Map 后 1/0/50/150/300ms、350ms taskbar 修复后、500ms topmost 回调中调用。 |
| 官方文档 | **Tk (tkdocs_pyref)**：`focus_force()` 描述为 “Force focus to the widget”，无平台细节。**Win32 (MSDN)**：`SetForegroundWindow` 受 foreground lock timeout、调用进程与前台关系等限制，可能静默失败。 |
| 结论 | 报告所查的“前台锁定”针对的是 SetForegroundWindow；代码通过 Tk 的 focus_force 间接触发（若 Tk 在 Windows 上确实映射到 SetForegroundWindow），则**与报告描述的是同一类问题**。若现象为“启动时无输入、点一下窗口后恢复”，与“focus_force 被系统拒绝”相符。 |

### 可能性 3：overrideredirect 与无边框窗口输入

| 维度 | 代码实际 | MCP 文档 / 报告 |
|------|----------|-----------------|
| **是否同一问题** | **是**：代码确认为 overrideredirect + 后续 Win32 修改。 |
| 代码实际 | `_create_ui()` 末尾在 `update_idletasks()` 后调用 **`root.overrideredirect(True)`**；之后才 bind Map、登记 350ms taskbar 修复。 |
| 官方文档 | **Tk (tkdocs_pyref)**：`wm_overrideredirect(True)` 移除窗口管理器装饰。未写 Windows 上焦点或输入的特别说明。 |
| 结论 | 报告中的“overrideredirect + Win32 修改”组合与代码一致；Tk 文档未细化到“无输入”，但**与报告归纳的“同一类现象”相符**。 |

### 可能性 4：Grab 未释放

| 维度 | 代码实际 | MCP 文档 / 报告 |
|------|----------|-----------------|
| **是否同一问题** | **需看是否曾发生残留 grab**：代码在 run() 前有释放逻辑，但若某次弹窗异常未释放，则与报告一致。 |
| 代码实际 | **run() 入口** 调用 `_release_any_grab()`：对 `root.grab_current()` 得到的 widget 做 `grab_release()`。`rosbot_extension_panel._ask_choose_rosbot_directory`、`share/asia_credentials` 等对 Toplevel 使用 `grab_set()` + `wait_window()`，正常关闭时 destroy 会释放。 |
| 官方文档 | **Tk (tkdocs_pyref)**：`grab_set()` 独占输入直至 `grab_release()`；`grab_current()` 返回当前拥有 grab 的控件。 |
| 结论 | 报告描述的“grab 未释放导致主窗无输入”与 Tk 文档一致；代码在 run() 前有防护，**若问题复现时 run() 已执行仍无输入，则与 grab 残留不一定同因**；若 run() 前曾打开过未正确关闭的模态框，则**是同一问题**。 |

### 可能性 5：Map 只处理一次与 350ms 二次 Map

| 维度 | 代码实际 | MCP 文档 / 报告 |
|------|----------|-----------------|
| **是否同一问题** | **是**：代码确实只处理一次 Map，且 350ms 会做 SetWindowPos。 |
| 代码实际 | `_on_map` 内用 `_map_event_processed` 保证只执行一次 focus 序列；注释写明 350ms 的 SetWindowPos 可能再次触发 Map，且**不在 Map 中**调用 ensure_tk_root_in_taskbar。350ms 回调内执行 Win32 后立即 `focus_force()`。 |
| 官方文档 | Win32 SetWindowPos 可能触发窗口消息（如重绘），Tk 文档未明确“第二次 Map 会清焦点”。 |
| 结论 | 报告假设“第二次 Map 时 Tk 可能清焦点、且我们不再跑 focus”与代码逻辑一致；**是否为同一问题取决于 Tk 在二次 Map 时是否真的清除焦点**，需实测，但**逻辑上属同一类时序问题**。 |

### 可能性 6：after(0) 主线程调度

| 维度 | 代码实际 | MCP 文档 / 报告 |
|------|----------|-----------------|
| **是否同一问题** | **可能相关**：若启动时大量 after(0) 或某回调过重，会延迟输入处理。 |
| 代码实际 | `event_center` 用 `root.after(0, ...)` 派发事件；`config_change_hub` 用 `root.after(0, _dispatch_pending)`；Map 时 `after(0, _deferred_after_map)`。 |
| 官方文档 | **Tk (tkdocs_pyref)**：`after(ms, func)` 在指定时间后调度；主线程顺序执行，单次回调若阻塞会推迟后续事件。 |
| 结论 | 报告与文档一致；**与“无输入”是否为同一问题**取决于是否存在耗时 after(0) 回调；若排除线程阻塞后仍无输入，本条多为辅助因素而非主因。 |

### 可能性 7：坐标校准 Tab

| 维度 | 代码实际 | MCP 文档 / 报告 |
|------|----------|-----------------|
| **是否同一问题** | **仅当启动或切换至该 tab 时相关**。 |
| 代码实际 | `_load_last_tab()` 中若 `last_selected_tab == TAB_INDEX_CALIBRATION` 则改为 TAB_INDEX_MAIN，避免启动时进入坐标校准 tab（注释：避免 full UI freeze）。 |
| 结论 | 报告与代码策略一致；**与“主窗完全无输入”是否同一问题**取决于用户是否通过其它路径进入该 tab；若默认启动即无输入且未进该校准 tab，则可能不同因。 |

---

## 12. MCP 文档查询摘要（按代码实际调用）

- **Tk (tkdocs_pyref)**：`focus_force()` 为 “Force focus to the widget”；`wm_overrideredirect(True)` 移除装饰；`grab_current`/`grab_release`/`grab_set` 管理独占输入；`after(ms, func)` 调度；未对 Windows 上 focus_force 与 SetForegroundWindow 的对应关系做说明。  
- **Win32 (learn_microsoft_en-us_windows_win32_api)**：修改 `SetWindowLong` 的窗口数据（含 frame style）后，须调用 `SetWindowPos` 且使用 `SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED` 使缓存更新；代码中的 `tk_taskbar` 调用与此一致。`SetForegroundWindow` 受前台锁定超时等条件限制，可能静默失败。

**综合**：报告中的可能性 1（Win32 样式修改 + SWP_FRAMECHANGED）、2（前台锁定/focus_force）、3（overrideredirect）、5（Map 只处理一次 + 350ms SetWindowPos）与**代码实际构架和调用顺序一致**，可视为与“UI 无法操作”**同一类或强相关**问题；4（grab）、6（after(0)）、7（坐标校准 tab）视复现场景判断是否为同一问题。
