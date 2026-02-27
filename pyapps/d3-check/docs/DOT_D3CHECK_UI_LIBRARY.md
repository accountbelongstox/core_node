# D3Check Dot Port: Common UI Library Design (Layout & Elements)

This document defines **UI layout and element requirements** for the .NET port of d3-check. It describes what the user sees and how the interface is structured—**not** Python or .NET code. dotCore and dotapps/D3Check must deliver the same layout and behavior using .NET/WPF.

**Project norms:** Dot stack follows [development-guides/DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md) and [.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc). Python source follows [docs/PROJECT_STANDARDS.md](PROJECT_STANDARDS.md) and [.cursor/rules/d3-check.mdc](../../../.cursor/rules/d3-check.mdc). All dot code and comments in **English**, **ASCII only** in source.

---

## 1. Main window structure (layout requirements)

- **Single main window**: One primary window for the app. No duplicate main windows.
- **Frameless / custom chrome**: Window has no OS default title bar; the app draws its own title area and window controls.
- **Resizable**: User can resize the window. **Minimum size**: width ≥ 670, height ≥ 400 (same as Python).
- **Geometry persistence**: Last position and size are saved and restored on next launch. Config key for geometry: `ui_settings.window_geometry`; default geometry string equivalent to 670×550 when not set.
- **Vertical layout (top to bottom)**:
  1. **Resize borders**: Thin draggable regions on all four edges and four corners so the user can resize from any edge/corner. Cursor feedback (e.g. resize arrows) per edge/corner.
  2. **Title bar**: One horizontal bar at the top. Contains:
     - Application title (or logo + title).
     - Language selector (switch UI language).
     - Window controls: Minimize, Maximize/Restore, Close.
  3. **Tabbed content area**: Main content is a **tab strip + one content area**. Exactly **5 tabs**, in fixed order:
     - Tab 0: **Main** (main functions panel).
     - Tab 1: **Rosbot** (Rosbot extension panel).
     - Tab 2: **D4** (D4 panel).
     - Tab 3: **Calibration** (coordinate calibration panel).
     - Tab 4: **Log** (log panel).
     - Only one tab is visible at a time; switching tabs shows the corresponding panel. Selected tab index can be persisted and restored.
  4. **Bottom bar**: One horizontal bar at the bottom. Contains:
     - **Window status / status text** (e.g. current window state or status message).
     - **Macro controls**: Start macro, Stop macro (or equivalent actions). These are the primary actions for the macro feature.

- **System tray**: One tray icon when running. Actions: Show window (restore from tray), Exit application. Closing the window (e.g. X button) and choosing Exit from tray must both trigger the same application exit path (no duplicate exit logic).
- **Window icon**: App/taskbar icon is resolved in order: config `ui_settings.app_icon` path (if set and exists) → default .ico → default logo.png → default app_icon.png; on Windows, .ico is preferred for taskbar. Fallback: generated simple icon if no file exists.
- **Taskbar (Windows)**: Optional one-time fix so the main window appears in the taskbar (e.g. SetWindowLong/SetWindowPos). Config can expose a skip option (e.g. `ui_settings.skip_taskbar_win32_fix`) for diagnostics.
- **Panel content on demand**: The Rosbot tab panel may defer creating its internal content until the tab is first selected or `ensure_content` is called; callers that depend on panel internals must respect this (e.g. check content-created flag or call ensure_content). Other panels may be created at startup. Same behavior in dot: panel lookup by key is always valid; content may be lazy per panel type.

---

## 2. Theme and styling (requirements)

- **Single theme entry**: One theme (colors, fonts, spacing) is applied **once at application startup** before any controls are shown. No mixed or late sources of style.
- **Semantic tokens (no widget types)**. The theme defines named tokens only; the dot implementation maps these to WPF resources or equivalent. Required semantic groups:
  - **Backgrounds**: primary, secondary, tertiary, dark, light, hover.
  - **Text**: primary, secondary, tertiary, dark, accent, success, warning, error.
  - **Interactive states**: normal, hover, active, focus, disabled.
  - **Buttons**: primary, secondary, success, danger, accent, info (and hover variants where needed).
  - **Inputs**: background, text, border, focus border.
  - **Borders / decoration**: primary, secondary, subtle, separator, panel border.
  - **Tabs**: unselected background/foreground, selected background/foreground.
  - **Accents**: default accent, blue, cyan, red, orange, green (for consistent highlights).
- **Fonts and spacing**: Named font families and sizes (e.g. title, body, small) and spacing/padding tokens. No control types in the theme definition—only data that the app uses to build styles.

---

## 3. Components (element count and role)

- **Title bar**: One instance; owned by the main window. Content: title, language selector, minimize/maximize/close.
- **Bottom bar**: One instance; owned by the main window. Content: status area and macro start/stop.
- **Macro controls**: One instance; visually embedded in the bottom bar. Exposes start and stop actions (Python ref: hotkey-only, no visible buttons; dot may expose Start/Stop buttons per product decision).
- **System tray**: One instance per application; show/hide and exit actions.
- **Panels**: One panel per tab. Panels are identified by **string keys** (e.g. `"main"`, `"rosbot"`, `"d4"`, `"calibration"`, `"log"`). The main window holds the mapping key → panel; external code (e.g. controllers, timers) must resolve a panel only by key, not by type. Same key set in dot as in Python.

---

## 3.1 Complete UI element list (derived from Python reference)

The following list is derived from the actual Python/Tk UI (`pyapps/d3-check/main.py` startup → `Diablo3MacroUI` and components/panels). Dot must implement the same elements using WPF idioms; i18n keys and config keys align with Python so behavior and persistence match.

### 3.1.1 Main window and chrome

| Element | Role | Notes |
|--------|------|--------|
| Resize border (top) | Draggable strip, cursor north-south | Thin (e.g. 2px); triggers resize north |
| Resize border (bottom) | Draggable strip, cursor north-south | Triggers resize south |
| Resize border (left) | Draggable strip, cursor east-west | Triggers resize west |
| Resize border (right) | Draggable strip, cursor east-west | Triggers resize east |
| Resize corner (nw, ne, sw, se) | Draggable corners, diagonal cursor | Triggers resize both dimensions |
| Title bar frame | Draggable to move window; holds title + controls | Double-click toggles maximize |
| Title label | Application title (i18n: `main_window.title`) | |
| Language combobox | Values: `zh`, `en`; config: `ui_settings.current_language` | |
| Minimize button | Minimize window | |
| Maximize / Restore button | Toggle maximized state | |
| Restore preset size button | Restore to preset geometry (optional; Python has ⧉) | |
| Restart button | Restart application (optional; Python has ↻) | |
| Close button | Trigger exit path | |
| Title bar bottom separator | Visual separator below title bar | |

### 3.1.2 Tabs and panel container

| Element | Role | Notes |
|--------|------|--------|
| Tab strip | 5 tabs, fixed order | Main, Rosbot, D4, Calibration, Log |
| Tab content area | Single content area; one panel visible at a time | Panel key = tab key |

### 3.1.3 Bottom bar

| Element | Role | Notes |
|--------|------|--------|
| Bottom bar row 0 (left) | Macro controls placeholder | Python: empty frame (macro by hotkey only); dot may add Start/Stop buttons |
| Bottom bar row 0 (right) | Per-tab options strip | Python: empty for all tabs; reserved for future |
| Bottom bar row 1 | Status row 1 | Label+value pairs: Battle.net, ROS, D3, Map, Stage (i18n keys: `rosbot.battlenet_status`, `rosbot.ros_label`, `rosbot.d3_status`, `rosbot.map_status`, `rosbot.stage`) |
| Bottom bar row 2 | Status row 2 | Label+value: OAuth script status, Window size (`rosbot.oauth_script_status`, `ui.status_bar.window_size`) |
| Bottom bar row 3 | Test mode + path icons | Left: test mode text (one label); Right: BN, D3, D4, ROS path indicators + optional “Scan” or extra actions |

### 3.1.4 Panel: Main (key `main`)

| Element | Role | Config / i18n |
|--------|------|----------------|
| Config combobox | Current skill config; values from `macro_configs.skill_configs` keys | `macro_configs.current_skill_config` |
| Current config display label | “Current config: &lt;name&gt;” | i18n: `main_functions_panel.current_config` |
| Skill table header row | Columns: Skill, Key, Strategy, Interval, Delay, Random delay | i18n: `skill_config.skill`, `.key`, `.strategy`, `.interval`, `.delay`, `.random_delay` |
| Skill rows (7 rows) | skill1, skill2, skill3, skill4, left_click, right_click, potion | Per row: name label, key (HotkeyInput or fixed label for mouse), strategy combobox, interval spinbox, delay spinbox, random_delay spinbox. Config: `macro_configs.skill_configs.<name>.skills.<skill_key>` |
| Hotkey area (in-panel bar) | Macro start hotkey | Label + HotkeyInput; config: `macro_configs.auxiliary_config.macro_start_hotkey` |
| | Assistant hotkey | Label + HotkeyInput; config: `macro_configs.auxiliary_config.assistant_hotkey` |
| Animation speed combobox | Slow / Medium / Fast | `macro_configs.auxiliary_config.animation_speed` |
| Game language combobox | Simplified / Traditional / English | `macro_configs.auxiliary_config.game_language` |
| Basic info area (right column) | Optional text / info block | |
| Auxiliary options block | Bag offset: label + single entry (top,left,bottom,right comma-separated) | `ui_analysis.bag_offset.top/left/bottom/right` |
| | Automation checkboxes + optional dropdowns | Blood shard (type menu), Quick pickup, Blacksmith, Kanai reforge (type), Kanai upgrade, Kanai convert, Auto salvage, Drop equipment, Sound feedback, Smart pause; config keys under `macro_configs.auxiliary_config` and optional debug actions |

### 3.1.5 Panel: Rosbot (key `rosbot`)

| Element | Role | Config / i18n |
|--------|------|----------------|
| Control panel frame | Group: control buttons | i18n: `rosbot.control_panel` |
| Start ROSBOT button | Toggle flow master; state: Start (green) / Stop | `rosbot.startup` / flow state |
| Ensure Battle.net only button | Run BN-only segment | |
| Update ROSBOT button | Check/apply ROSBOT update | i18n: `rosbot.update_rosbot` |
| Open Tampermonkey script button | Open script in Notepad | i18n: `rosbot.open_tampermonkey_script` |
| Set account/password button | Open credentials dialog (region + account/password) | i18n: `rosbot.set_account_password` |
| Path/config area | ROS directory, Battle.net path, D3 path, checkboxes (auto enable latest, pickup blood shards, prevent stuck, etc.) | Config keys: `ros_settings.ros_directory`, `battlenet.battlenet_path`, `d3.d3_path`, `ros_settings.auto_enable_latest_ros`, `rosbot.pickup_blood_shards`, etc. |
| Log display area | Scrollable log for ROSBOT messages | |

### 3.1.6 Panel: D4 (key `d4`)

| Element | Role | Config / i18n |
|--------|------|----------------|
| Sub-tab navigation (left) | Title + vertical buttons | i18n: `d4_panel.title` |
| Sub-tab: EXP Farming button | Switch to EXP Farming content | i18n: `d4_panel.sub_tabs.exp_farming` |
| Content area (right) | Single content for active sub-tab | |
| EXP Farming: Start/Stop button | Toggle exp farming running | `d4_settings.exp_farming_running` |
| EXP Farming: Game status area | Status labels (e.g. map, team) | |
| EXP Farming: Debug button area | Debug actions | |
| EXP Farming: Log frame | Log messages | i18n: `d4_panel.exp_farming.log_title` |

### 3.1.7 Panel: Calibration (key `calibration`)

| Element | Role | Config / i18n |
|--------|------|----------------|
| Client mode label | “Client mode” or equivalent | i18n: `ui.coord_calibration.client_mode` |
| Client type radio buttons | Battle.net, D3 Game, D4 Game | i18n: `ui.coord_calibration.client_battlenet` etc.; config: `coord_calibration.client_type` |
| Capture screenshot button | Capture for calibration | i18n: `ui.coord_calibration.capture_button` |
| YOLO section (optional) | When YOLO layout available | i18n: `ui.coord_calibration.yolo_data_title` |
| YOLO: Config button, Record Start/Stop, Open label, Import patch | Record and project workflow | |
| YOLO: Project dropdown, Create project, Open project dir | Project selection | |
| YOLO: Workflow labels (Step 1/2/3) | Workflow state | |
| YOLO: Segment table | Columns: Timestamp, Frames, Status, Size; context menu (open folder, export, open for label, delete) | |
| YOLO: Toolbar | Refresh, Export selected, Open label, Merge, Delete, Import patch | |
| Record log panel | Log text for calibration/record | |

### 3.1.8 Panel: Log (key `log`)

| Element | Role | Config / i18n |
|--------|------|----------------|
| Test functions frame | Grid of test/debug buttons | i18n: `log_panel.test_functions` |
| Test buttons | Bag test, Yellow upgrade, Item reforge, Pathfinding, Debug blood shard, Debug quick pickup, Debug blacksmith, Kanai reforge/upgrade/convert, Auto salvage, Drop equipment, Sound feedback, Smart pause, Debug Battle.net UI, Debug ROSBOT | i18n keys: `log_panel.bag_test`, `log_panel.yellow_upgrade`, etc., `auxiliary_panel.debug_*`, `rosbot.debug_battlenet_ui`, `rosbot.debug_rosbot` |
| Control row | Clear, Save, Show DEBUG checkbox, Auto-scroll checkbox, Log level combobox, Scan log area button | Config: `log_settings.show_debug_logs`, `log_settings.auto_scroll`, `log_settings.log_level` |
| Log text area | Scrollable, multi-line; optional color by level | |

### 3.1.9 System tray

| Element | Role | Notes |
|--------|------|--------|
| Tray icon | One icon in system tray | |
| Menu: Show window | Restore and focus main window | |
| Menu: Maximize | Optional | |
| Menu: Restart | Optional | |
| Menu: Exit | Same exit path as close button | |
| Menu: Tab 0..4 | Optional debug switch tab | |

### 3.1.10 Popups (optional, by key)

| Key | Role | Notes |
|-----|------|--------|
| `debug_window` | Debug image / state window | Register when opened, unregister when closed; D4 panel may open for annotated images |

### 3.1.11 Widget types used (dot equivalents)

| Python widget | Dot/WPF equivalent |
|---------------|---------------------|
| Label | TextBlock / Label |
| Button | Button |
| Combobox (readonly) | ComboBox (selection only) |
| Entry | TextBox |
| Spinbox | NumericUpDown or TextBox with validation |
| Checkbox | CheckBox |
| Radiobutton | RadioButton |
| HotkeyInput (click-to-capture key) | Custom control or KeyBinding input |
| Treeview (table) | DataGrid or ListView |
| Scrollable text | TextBox with ScrollViewer or RichTextBox |
| Frame (container) | Border / StackPanel / Grid |
| Tab strip + content | TabControl |

---

## 4. UI registry (contract)

- **Register main UI**: Once the main window is created, it is registered so that:
  - The main window (root) can be retrieved.
  - Any panel can be retrieved by its **key** (e.g. `GetPanel("rosbot")`).
- **Popups**: Optional popup windows are registered by key when created and unregistered when closed. Lookup by key. At least one popup key: `debug_window` (or equivalent constant `POPUP_KEY_DEBUG_WINDOW`). Same key set in dot as in Python.
- **Scope**: Registry is **app-scoped** (D3Check only). No cross-app UI registry.
- **Panel keys (exact)**: `main`, `rosbot`, `d4`, `calibration`, `log` — from `providor.constants.ui` in Python; dot must use the same string constants.

---

## 5. Cross-thread and lifecycle (behavior requirements)

- **Single UI thread**: Only the main UI thread may touch UI controls. Any other thread that must update UI or run UI-related logic must marshal to the main thread (e.g. Dispatcher.Invoke in WPF).
- **Exit path**: Close button and tray Exit both trigger the same shutdown/exit flow (e.g. via a central trigger/handler). No direct process kill from UI code; use a single exit request path.
- **Show from tray**: Tray “Show window” must bring the main window to front and give it focus, on the UI thread.

---

## 6. Where things live (dotCore vs dotapps/D3Check)

- **dotCore (shared, optional)**:
  - **DotCore.UITheme**: Optional shared library holding only **theme data** (color names, font names, spacing keys) if multiple dot-apps share the same palette. No WPF types. Namespace e.g. `DotCore.UITheme`.
- **dotapps/D3Check (app-specific)**:
  - **Main window**: WPF window implementing the layout above (frameless, title bar, tabs, bottom bar, resize borders).
  - **Theme application**: Either in-app (e.g. XAML resources + a theme class) or by referencing DotCore.UITheme for shared constants. Applied once at startup.
  - **Components**: TitleBar, BottomBar, MacroControls, SystemTray—each one instance, owned by the main window.
  - **Panels**: One view/content per tab; panel lookup by key. Same keys as Python.
  - **UI registry**: Implemented inside D3Check (e.g. singleton or DI); register main window, resolve root and panel by key.

---

## 7. Summary: layout checklist for dot

| Requirement | Description |
|-------------|-------------|
| One main window | Single window; frameless; resizable with minimum size; geometry persisted |
| Layout order | Resize borders → Title bar → Tabbed content (5 tabs) → Bottom bar |
| Title bar | Title, language selector, minimize / maximize / close; optional: restore preset, restart (see §3.1.1) |
| Tabs | Exactly 5: Main, Rosbot, D4, Calibration, Log; panel per key |
| Bottom bar | Row 0: macro area + options; Rows 1–3: status (Battle.net, ROS, D3, Map, Stage, OAuth, window size, test mode, path icons). See §3.1.3. |
| System tray | One icon; Show window, Exit; optional: Maximize, Restart, Tab 0–4 |
| Theme | Single application at startup; semantic tokens only (colors, fonts, spacing) |
| Panel lookup | By string key; same keys in dot as in Python |
| Full element list | §3.1 lists every UI element derived from Python; implement all for parity |
| UI thread | All UI updates on main thread; other threads marshal to it |
| Exit | Single path for close and tray exit |

This document is the reference for **layout and element requirements** when implementing dotapps/D3Check (and optionally DotCore.UITheme). **§3.1** is the complete UI element list derived from the Python reference UI; implement using .NET/WPF idioms, not by copying Python/Tk code.

---

## 8. References

| Document | Purpose |
|----------|---------|
| [development-guides/DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md) | Dot layout, naming, dependencies |
| [.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc) | Dot rule: English, ASCII, layout |
| [.cursor/skills/dot/SKILL.md](../../../.cursor/skills/dot/SKILL.md) | Dot skill: new lib/app, refs |
| [docs/PROJECT_STANDARDS.md](PROJECT_STANDARDS.md) | Python d3-check: share/, constants, threads, flow |
| [providor/constants/ui.py](../providor/constants/ui.py) | Tab indices, panel keys, popup keys |
| [providor/constants/common.py](../providor/constants/common.py) | UI_SETTINGS_*, DEFAULT_* geometry/icon |
