# Windows 上 Tk 主窗口「双 UI」现象调查记录（wrapper HWND / overrideredirect）

**范围**：`pyapps/d3-check`，主窗口 `ui/diablo3_macro_ui.py`。  
**记录目的**：固定一次完整排查结论，避免与「标题栏拖动像两个窗」等其它现象混淆；供后续维护与文档交叉引用。

---

## 1. 现象（用户侧）

- 启动后屏幕上像有**两个 UI**：其中一个**可操作**，另一个**不可操作**（空壳或错位）。
- 对**可操作**窗口进行操作一段时间后，两窗在视觉上**合并为一个**（几何或层级被事件循环同步）。
- 与「多线程各建一个 `Tk()`」不同：主流程设计上仍是**单一** `tk.Tk()`。

---

## 2. 与「看起来像两个窗」的其它原因区分

| 现象 | 说明 |
|------|------|
| **本记录：ghost wrapper** | 与 Win32 层**两个 HWND**（见 §3）或 Tk **UpdateWrapper 重建**相关，可能同时映射旧 wrapper 与内容窗。 |
| **标题栏拖拽「动另一个」** | 已单独记录：`docs/ui_analyzer/REPIAR_REPORT.md` —— 多为 **`winfo_x()`/`winfo_y()` 非屏幕坐标** 导致 `geometry("+x+y")` 错误，**并非**必然存在第二个顶层窗。修复为 **`winfo_rootx()`/`winfo_rooty()`**。 |

两者可同时被用户描述为「两个窗口」，根因不同，排查时应对照本记录与 REPIAR_REPORT。

---

## 3. Windows 上 Tk 与 Win32：wrapper 与 content

在 Windows 上，单个 Tk 顶层窗口在实现上通常对应：

- **Wrapper HWND**：由窗口管理器风格管理的外框（标题栏、边框等），Tk 文档/社区中常称与 **`.wm_frame()`** 相关的**外层**句柄。
- **Content HWND**：实际挂载 tkinter 控件的**内层**客户区；**`winfo_id()`** 通常对应此内层。

**官方 Tcl/Tk 手册**对 `wm overrideredirect` 的说明要点：override-redirect 标志在窗口**首次被 map**，或从 **withdrawn → normal** 再次 map 时，才会被可靠处理（见 Tcl `wm` 手册 *wm overrideredirect*）。这与「先 withdraw、改属性、再 deiconify 首次 map」的用法一致，但**不保证**在 Windows 上内部实现不会因风格切换而重建外层句柄。

---

## 4. 第一次尝试：withdraw / overrideredirect / deiconify 之间补 `update_idletasks()`

**假设**：在 `withdraw()` 之后与 `overrideredirect(True)` 之后各调用 `update_idletasks()`，强制 Tk 先处理 withdraw，再处理样式变更，再在 `deiconify()` 前完成 wrapper 重建，避免出现「旧 wrapper 仍被映射」的瞬态或残留。

**结果**：**未能**从用户侧消除「双 UI」问题。说明仅协调 idle 任务顺序**不足以**规避该 Windows/Tk 组合下的异常表现。

---

## 5. 更深入原因（实现层归纳，非 Python 官方文档条文）

以下为对 **Tk Win32 端口源码路径**（社区与源码阅读中常引用 **`tkWinWm.c`**）的归纳，用于解释行为，**不等同**于 Python tkinter 手册中的保证：

- 调用 **`overrideredirect(True)`** 会驱动 Tk 在 Windows 上调整顶层窗的 Win32 风格（例如从带装饰的 overlapped 风格切到 popup/override 路径）。
- 该过程在实现中可能走 **`UpdateWrapper` 一类逻辑**：**销毁并重建 wrapper HWND**，再把 content 挂到新的 wrapper 上。
- 在部分 Windows 版本/主题/DWM 组合下，该过程可能出现**旧 wrapper 未立即从桌面合成中清除**或与**新映射**短暂并存 → 用户看到**两个矩形区域**：一个为**旧外框空壳**（不可点内容），一个为**实际内容**（可操作）；后续消息循环与几何同步后，观感上「合并」为一个。

**注意**：Python 文档主要描述 **「无装饰、自管窗口」** 的语义，**不**逐条承诺 Windows HWND 生命周期；上述段落用于**工程排查**，若需法理级依据应查阅 Tcl/Tk 源码与平台说明。

---

## 6. 记录中的缓解思路（与代码实现对应，本文档仅作说明）

目标：**避免**通过 `overrideredirect(True)` 触发上述 **wrapper 重建**路径。

**思路**：在 Windows 上优先对**已有** wrapper HWND 使用 **Win32 `GetWindowLongPtr` / `SetWindowLongPtr`（`GWL_STYLE`）** 去掉标题栏/厚边框等装饰位，并用 **`SetWindowPos(..., SWP_FRAMECHANGED)`** 通知系统重算非客户区；**`wm_frame()`** 取得外层句柄（与 `winfo_id()` 区分）。任务栏可见性可通过 **`GWL_EXSTYLE`**（如 `WS_EX_APPWINDOW`、去掉 `WS_EX_TOOLWINDOW`）在**同一**路径上处理，以减少与「Map 后再改样式」的重复操作。

- **非 Windows**：仍可回退为 **`overrideredirect(True)`**（与平台实现一致）。
- **失败回退**：Win32 路径异常时仍回退 **`overrideredirect(True)`**。

具体函数名与行号以仓库内 `diablo3_macro_ui.py` 为准（如 `_make_frameless_win32`）；本文档不绑定固定行号。

---

## 7. 与「无输入 / 任务栏修复」文档的关系

`docs/ui_analyzer/UNRESPONSIVE_UI_POSSIBILITY_REPORT.md` 等文主要讨论 **`ensure_tk_root_in_taskbar`**（`SetWindowLong` + `SetWindowPos`）与 **`overrideredirect`** 组合下的**焦点/输入**问题。架构变更后：

- 无边框可能**不再**依赖 `_create_ui` 末尾的 **`overrideredirect(True)`**；
- 若在 **frameless 初始化**中已设置 **`WS_EX_APPWINDOW`**，**`_apply_taskbar_fix`** 可能跳过重复的 Win32 样式工作（以代码为准）。

旧报告中的**行号、调用栈**可能已过期；以本记录与当前源码为准，旧文保留作历史排查参考，冲突处见各文件头部的**勘误**说明。

---

## 8. 参考与交叉引用

- Tcl/Tk：`wm overrideredirect`、`wm withdraw`、`wm deiconify`（*Tcl/Tk* 手册）。
- 项目内：`docs/ui_analyzer/REPIAR_REPORT.md`（标题栏坐标问题）、`docs/ui2/UI_REPEATED_*`（首帧绘制与 `update`）、`docs/ui_analyzer/UNRESPONSIVE_UI_POSSIBILITY_REPORT.md`（焦点与 taskbar）。

---

*本文件为调查与架构说明记录；若行为随 Tcl/Tk 版本变化，以实际源码与复现为准。*
