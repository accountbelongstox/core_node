# UI Repeated Redraw and Blank/Transparent During Draw — Possibility Report

Independent analysis with **code first → project docs → then MCP/official docs**. Focus: UI is restructured multiple times and never reaches a single “final” drawn state; instead repeated redraws produce blanks and transparent regions during the process. Not assumed to be thread blocking; structure and flow may be reworked (copy/move code, change architecture).

**Errata (frameless)**：The main window may use **Win32 `GWL_STYLE`** on the **wrapper HWND** (`_make_frameless_win32`) instead of `overrideredirect(True)` on Windows. See **`docs/ui2/WINDOWS_TK_WRAPPER_GHOST_DOUBLE_WINDOW_INVESTIGATION.md`**. Where this report says `overrideredirect(True)`, read it as “frameless top-level,” including that path.

---

## 1. Official Documentation (MCP / TkDocs / Tcl)

### 1.1 When drawing happens (TkDocs – Event Loop)

- **All screen updates occur only in the event loop.** Changing a widget does not paint immediately; the widget marks itself for redraw; the event loop later asks it to redraw. So any moment we force event processing we trigger a draw phase.
- **Source:** [TkDocs – Event Loop](https://tkdocs.com/tutorial/eventloop.html): *“All drawing occurs only in the event loop.”*

### 1.2 `update()` and nested event loops (TkDocs)

- Calling **`update()`** does not “just refresh the screen”; it runs the event loop (processes events) until the queue is empty. So each `update()` is effectively a **nested event loop**.
- **Source:** TkDocs: *“When you use update, you're not returning control back to the running event loop. You're effectively starting a new event loop nested within the existing one. … Nested event loops... this way madness lies.”*
- Implication: Multiple `update()` calls during init or after tab change create **multiple nested event loops** → multiple draw phases → user can see **intermediate states** (empty/blank or half-drawn, “transparent” or wrong background).

### 1.3 `update_idletasks` (Tcl wiki)

- **`update idletasks`** only processes the **idle queue** (e.g. deferred redraws), not full event handling.
- **Source:** [Tcl wiki – update](https://wiki.tcl-lang.org/page/update): *“update idletasks skips the first step, processing only events in the idle queue.”*
- So: `update_idletasks()` forces one pass of “idle” work (layout/redraw) without processing input/timers. Safer than `update()` but each call still triggers a **distinct draw phase**. Several `update_idletasks()` in a row = several draw phases = repeated redraw and possible blank/transparent frames.

### 1.4 `after(0)` and idle (TkDocs)

- **`after(0, callback)`** schedules the callback to run when Tk is **idle** (no other events to process). **Screen updates and redraws occur in the context of idle events.**
- So: Building UI in chunks via `after(0, chunk2)` means: first chunk is built → event loop runs → idle → chunk2 runs. User can see the window **after the first chunk** (e.g. empty tab) and only later see chunk2 content → **repeated draw**, **blank in between**.

---

## 2. Code Findings (pyapps/d3-check UI)

### 2.1 Multiple `update_idletasks()` / `update()` during build and tab switch

| Location | Call | Effect |
|----------|------|--------|
| `diablo3_macro_ui._create_main_tabs` end | `root.update_idletasks()` then `root.update()` | One full nested event loop + idle at end of tab creation. |
| `_recreate_ui_for_language_change` end | `root.update_idletasks()` then `root.update()` | Same again after full notebook recreate. |
| `_deferred_after_tab_changed` | `root.update_idletasks()` then `root.update()` | Every tab change runs another full refresh cycle. |
| `switch_to_tab` (tray/restore) | `root.update_idletasks()` then `root.update()` | Same on programmatic tab switch. |
| `_apply_taskbar_fix` (350 ms) | `root.update_idletasks()` (before/after Win32) | Extra idle passes after window already shown. |
| `run()` before mainloop | `root.update_idletasks()` | One more idle pass. |

So: **several separate “refresh” points** (create, language change, tab change, tray show, taskbar fix, run). Each can trigger a **new draw phase**; together they produce **repeated redraws** and the window **never appears as a single “final” frame** but as a sequence of states (e.g. empty tab → filled tab, or partial layout → full layout), which can show as **blanks or transparent/incorrect regions** during the process.

### 2.2 Lazy ROSBOT tab: content built in multiple steps after window is visible

- **`_create_main_tabs`** creates the notebook and **empty** tab frames (including `rosbot_frame`). Then it calls **`rosbot_extension_panel.ensure_content()`**.
- **`ensure_content()`** either:
  - submits a one-shot to the timer thread which then does **`container.after(0, on_main)`** to create content on the main thread, or  
  - (timer not running) does **`container.after(0, _fetch_rosbot_config_on_main_then_create)`**.
- So **ROSBOT tab content is not built in the same call stack as the rest of the window.** It is built **after** the next event loop iteration(s).
- **`_create_content_with_snapshot`** builds the config panel, then **`container.after(0, self._create_control_and_log_then_sync)`** for the second chunk. **`_create_control_and_log_then_sync`** then does **`container.after(100, self._sync_status_ui_once)`**.

Resulting sequence:

1. Window is built and **deiconify** runs → user sees window with **ROSBOT tab empty** (or only a bare frame).
2. First **after(0)** runs → config panel appears → **another draw phase**.
3. Second **after(0)** runs → control + log row → **another draw phase**.
4. **after(100)** runs → status sync → possible further redraw.

So the **“final” style is never drawn once**; it is drawn in **several steps** with **blanks/transparent or half-drawn states** in between. This matches “repeated redraw” and “blank/transparent during draw.”

### 2.3 Tab change and tray show force another full refresh

- **`_on_tab_changed`** defers to **`after(0, _deferred_after_tab_changed)`**. **`_deferred_after_tab_changed`** calls **`root.update_idletasks()`** and **`root.update()`** after updating bottom bar and (for ROSBOT) **`ensure_content()`**.
- So: tab change → deferred run → **ensure_content** (possibly more **after(0)** for ROSBOT) → **update_idletasks + update** → **another nested event loop** and draw phase. If the selected tab was just created or is lazy, user can again see a **brief blank or half-drawn** state before the next idle.
- **`switch_to_tab`** (e.g. from tray) does **deiconify**, **lift**, **focus_force**, then **update_idletasks()** and **update()** → same pattern: **repeated redraw**, risk of visible intermediate state.

### 2.4 No second deiconify in `_create_ui`

- **Single deiconify** is in **`__init__`** after **`_create_ui()`** and **`_create_system_tray()`** (line ~186). **`_create_ui`** does **not** call **deiconify** again. So the “repeated draw” is not from showing the window twice but from **multiple update/update_idletasks and deferred builds** after the window is already visible.

---

## 3. Possibility Summary

| # | Cause | Likelihood | Official / code basis |
|---|--------|------------|------------------------|
| 1 | **Multiple `update()` / `update_idletasks()`** at end of create, language change, tab change, tray show, taskbar fix → multiple nested event loops / idle passes → **multiple draw phases** → user sees intermediate states (blank/transparent). | High | TkDocs: drawing only in event loop; update = nested loop; code: 6+ distinct call sites. |
| 2 | **Lazy ROSBOT tab**: content created in **after(0)** (and again **after(0)**, then **after(100)**) so window is **shown with empty tab first**, then content in 2–3 steps → **repeated redraw**, blank in between. | High | TkDocs: idle and redraws; code: ensure_content → after(0) → _create_content_with_snapshot → after(0) → _create_control_and_log_then_sync → after(100). |
| 3 | **Tab change** triggers **ensure_content** + **update_idletasks()** + **update()** → another full refresh and possible **blank/transparent** moment when switching to a tab that is still building. | Medium | Code: _deferred_after_tab_changed; TkDocs: update = nested loop. |
| 4 | **Frameless** + **withdraw/deiconify**: first map may occur at **deiconify**; if layout is not yet complete (e.g. ROSBOT still deferred), first paint can be **incomplete** (blank/transparent areas) until later idle/update. | Medium | Code: frameless (Win32 or overrideredirect) before content; deiconify once; Tk: map/redraw at display. |

---

## 4. Recommendations (architecture / flow; no obligation to keep current structure)

1. **Reduce forced refresh**
   - Prefer **at most one** `update_idletasks()` (or one `update()`) at the **very end** of initial build, and avoid repeating it on every tab change or tray show. Rely on the natural event loop to redraw after layout changes.
   - Align with Tcl/Tk advice: avoid **update** where possible; use **after** and callbacks so the event loop does one thing at a time.

2. **Single “final” frame before show**
   - Option A: **Build all tab content synchronously** (including ROSBOT) before **deiconify**. No **after(0)** for initial ROSBOT content; config read can stay on timer thread but **creation** on main thread in the same build pass so the window is never shown with an empty tab.
   - Option B: Keep **withdraw** until the **first idle** after **ensure_content** (and any other lazy panels) have **finished** their first creation (e.g. one **after(0)** that sets a “ready” flag and then **deiconify**), so the first visible frame is already the “final” layout for that moment.

3. **Deferred build without extra update**
   - If ROSBOT (or others) must stay lazy: build in **after(0)** chunks but **do not** call **update_idletasks()** or **update()** in **_deferred_after_tab_changed** or **switch_to_tab**. Let the normal event loop redraw after new widgets are packed/gridded; that avoids extra nested event loops and reduces repeated redraw / blank frames.

4. **One place for “show”**
   - Centralize “window is ready to be seen” in one path (e.g. one **deiconify** after “all initial content ready” or after first idle post–ensure_content), and avoid **update()** in **_apply_taskbar_fix** and similar unless proven necessary; use **update_idletasks()** sparingly and only where layout must be current (e.g. before a single Win32 call that needs geometry).

---

## 5. Code Actual vs Problem We Looked For (代码实际与查找的是否同一问题)

| Problem we looked for | Code actual (before fixes) | Same problem? |
|-----------------------|----------------------------|----------------|
| UI never reaches a single “final” drawn style; repeated redraws cause blank/transparent during draw. | Multiple `root.update_idletasks()` / `root.update()` at end of _create_main_tabs, _recreate_ui_for_language_change, _deferred_after_tab_changed, switch_to_tab, _apply_taskbar_fix (2×), run(). Each forces a draw phase (TkDocs: update = nested event loop; idletasks = idle queue = redraws). | **Yes.** Multiple refresh points → multiple draw phases → user can see intermediate states. |
| Lazy ROSBOT tab: content built after window visible → empty tab first, then 2–3 steps. | ensure_content() schedules after(0) or timer one-shot → after(0); _create_content_with_snapshot had after(0, _create_control_and_log_then_sync) so two chunks. When last tab = ROSBOT, no sync build before deiconify in original flow. | **Yes.** First paint could show empty ROSBOT tab; then after(0) chunks added content → repeated draw, blank in between. |
| Theme: ensure “一开始构建的就是应了主题的 UI”. | __init__: root.withdraw() → **frameless** (_make_frameless_win32 or overrideredirect) → **UITheme.apply_to_root(root)** (theme_use('clam') + apply_ttk_style) → _create_ui() → ttk.Notebook(style='Dark.TNotebook'), ttk.Frame(style='Dark.TFrame'). No ttk created before apply_to_root. | **Yes, already correct.** First build uses Dark.* from style DB; no “native then theme” double build. |

Conclusion: The “repeated redraw / blank-transparent” issue corresponds to **multiple update/update_idletasks** and **deferred ROSBOT build**; the “theme from start” requirement was already satisfied by the existing order (apply_to_root before any ttk).

---

## 6. Code Actual After Fixes (修复后的代码实际)

Process: read code → read project docs → MCP official docs (TkDocs Event Loop, Tcl update) → apply fixes → document.

### 6.1 Theme (unchanged: 一开始构建的就是应了主题的 UI)

- **diablo3_macro_ui.__init__**: `root.withdraw()` → **frameless** (`_make_frameless_win32` or `overrideredirect(True)`) → **`UITheme.apply_to_root(self.root)`** → `_create_ui()`. No ttk widgets exist before apply_to_root; notebook and tab frames are created with `style='Dark.TNotebook'` / `style='Dark.TFrame'`. First build is already themed.

### 6.2 Single flush after first build

- **_create_main_tabs** (diablo3_macro_ui): After creating all tabs and calling ensure_content(), **no** root.update_idletasks() or root.update() at end. Only **`root.after(1, self._flush_after_first_build)`**. **_flush_after_first_build** (lines ~561–565): single `root.update_idletasks()` then `root.update()` so the first display is complete after any after(0) content. One nested event loop at a defined point only.

### 6.3 ROSBOT tab: sync build when restored tab is ROSBOT

- **__init__** (lines ~185–188): If `last_selected_tab == TAB_INDEX_ROSBOT`, call **`rosbot_extension_panel.ensure_content_sync()`** before **`root.deiconify()`**. ensure_content_sync() (rosbot_extension_panel) calls _fetch_rosbot_config_on_main_then_create() on the main thread so ROSBOT content exists before first map.
- ** _create_content_with_snapshot** (rosbot_extension_panel): Builds config panel then **calls _create_control_and_log_then_sync() directly** (no after(0) for second chunk). Single-frame build so first paint shows full panel content.

### 6.4 No forced refresh on tab change or switch_to_tab

- **_deferred_after_tab_changed** (diablo3_macro_ui): Still updates state, bottom_bar, log callback, ensure_content() for ROSBOT. **Removed** `root.update_idletasks()` and `root.update()`. Event loop redraws naturally (TkDocs: avoid nested update).
- **switch_to_tab** (diablo3_macro_ui): Same: **removed** `root.update_idletasks()` and `root.update()` after deiconify/lift/focus.

### 6.5 Taskbar fix and run()

- **_apply_taskbar_fix**: **One** `root.update_idletasks()` before ensure_tk_root_in_taskbar() so geometry is current for Win32; **removed** the second update_idletasks() after the Win32 call to avoid an extra draw phase.
- **run()**: **Removed** `root.update_idletasks()` before mainloop(); single flush is already done in _flush_after_first_build.

### 6.6 Remaining update_idletasks/update (intentional)

| Location | Purpose |
|----------|---------|
| _flush_after_first_build | Single end-of-first-build flush (after(1) from _create_main_tabs). |
| _recreate_ui_for_language_change | Full notebook destroy/recreate; one flush at end. |
| _apply_taskbar_fix | One update_idletasks before Win32. |
| _win32_set_foreground | One update_idletasks before SetForegroundWindow (geometry/hwnd). |
| _apply_tab_style / _force_style_update / _apply_all_tab_styles | Theme/style helpers; used outside init or on demand. |

---

## 7. References

- Python 3 [tkinter](https://docs.python.org/3/library/tkinter.html): Tk lifecycle, event loop, threading.
- [TkDocs – Event Loop](https://tkdocs.com/tutorial/eventloop.html): Drawing only in event loop; **update** = nested event loop; **after** and idle.
- [Tcl wiki – update](https://wiki.tcl-lang.org/page/update): **update** vs **update idletasks** (idle queue only).
- Code: `ui/diablo3_macro_ui.py` (_create_ui, _create_main_tabs, _flush_after_first_build, _deferred_after_tab_changed, switch_to_tab, _apply_taskbar_fix, run), `ui/panels/rosbot_extension_panel.py` (ensure_content, ensure_content_sync, _create_content_with_snapshot, _create_control_and_log_then_sync).
