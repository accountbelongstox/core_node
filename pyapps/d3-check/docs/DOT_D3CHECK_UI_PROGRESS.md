# D3Check Dot UI – Progress Reference

Progress of the .NET/WPF UI for d3check. Layout and element spec: [DOT_D3CHECK_UI_LIBRARY.md](DOT_D3CHECK_UI_LIBRARY.md). Norms: [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md), [.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc). **UI layer:** canonical spec [DOT_UI_PROJECT_SPECIFICATION.md](../../../development-guides/DOT_UI_PROJECT_SPECIFICATION.md), [.cursor/rules/dot-ui.mdc](../../../.cursor/rules/dot-ui.mdc).

---

## Done

| Area | Status | Notes |
|------|--------|--------|
| **Project** | Done | d3check converted to WPF: `net8.0-windows`, `UseWPF`, `WinExe`. In `dotcore.sln`. |
| **Constants** | Done | `DotApps.d3check.Constants.AppConstants`: tab count/indices (Main=0, Rosbot=1, D4=2, Calibration=3, Log=4), panel keys (`main`, `rosbot`, `d4`, `calibration`, `log`), `PopupKeyDebugWindow`, `MinWindowWidth/Height`, `DefaultWindowGeometry`. |
| **UI registry** | Done | `DotApps.d3check.Ui.UiRegistry`: `RegisterMainUi(Window, IMainWindowHost)`, `UnregisterMainUi()`, `GetRoot()`, `GetPanel(key)`. Main window implements `IMainWindowHost.GetPanel(key)`. |
| **App entry** | Done | `App.xaml` + `App.xaml.cs`; startup creates and shows `MainWindow`. No `Program.cs`. |
| **Main window shell** | Done | Single window; title bar (title, language ComboBox, Minimize/Maximize/Close); TabControl with 5 tabs (Main, Rosbot, D4, Calibration, Log); bottom bar (macro placeholder + status text). Min size 670×400. |
| **Panel content** | Done | Each tab has full UI per §3.1.4–3.1.8. Panels are `UserControl`s under `dotapps/d3check/Panels/`; resolvable by key via `UiRegistry.GetPanel(key)`. |
| **Theme and styling** | Done | Single theme at startup: `Themes/AppTheme.xaml` (semantic brushes from Python UITheme + UnifiedStyles), `Themes/AppStyles.xaml` (implicit styles for TextBlock, Button, TextBox, ComboBox, ComboBoxItem, TabItem, CheckBox, RadioButton). ComboBox template: dropdown popup uses `InputBackgroundBrush` for contrast. TabItem: uniform height (MinHeight 32), selected = `TabSelectedBackgroundBrush`/`TabSelectedForegroundBrush`, unselected = `TabUnselected*`. Button: `VerticalContentAlignment`/`HorizontalContentAlignment` = Center. See [DOT_D3CHECK_UI_THEMING.md](DOT_D3CHECK_UI_THEMING.md). |
| **Frameless + simulated title bar** | Done | `WindowStyle="None"`, `ResizeMode="CanResize"`. Reusable `Components/TitleBarControl`: drag to move, double-click to maximize/restore, min/max/close wired to host window via `Window.GetWindow(this)`. Title and `LanguageComboBox` (for i18n) exposed. |
| **Config binding** | Done | UI reads/writes same config as Python (`ConfigPaths.ConfigUserPath` = `~/.core_node/.d3check/d3check_config.json`). MainWindow: geometry load on Loaded, save on Closing. MainPanel: skill config ComboBox, hotkeys, animation speed, game language, bag offset, auxiliary checkboxes — load on Loaded, save on change via `SetValueAsync` + `QueueSave`. RosbotPanel: ROS/Battlenet/D3 paths, auto-enable/pickup/prevent-stuck — same pattern. LogPanel: show DEBUG, auto-scroll, log level — same pattern. All keys in `Constants/ConfigKeys.cs`; no magic strings. |

---

## Tab UI details (implemented)

### Tab Main (`Panels/MainPanel.xaml`) — 1:1 with Python main_functions_panel

- Config row: skill config `ComboBox` (config1–config4), current config label. Layout: left column = config + skill table, right = bag offset + automation; bottom bar spans both (same as Python).
- Skill table: header (Skill, Key, **Strategy**, Interval, Delay, Random delay) + 7 rows (skill1–skill4, left_click, right_click, potion). Per row: display name (i18n), key (TextBox or fixed LMB/RMB), **Strategy ComboBox** (continuous / single / hold / ignore — stored as English key, display from i18n `ui.skill_config.strategies.*`; logic 1:1 Python strategy_en_to_zh), interval/delay/random_delay TextBoxes.
- Hotkey area: Macro start hotkey, Assistant hotkey (TextBox + PreviewKeyDown), Quick switch; Animation speed ComboBox, Game language ComboBox.
- Auxiliary: Bag offset TextBox; checkboxes (Blood shard, Quick pickup, Blacksmith, Kanai reforge/upgrade/convert, Auto salvage, Drop equipment, Sound feedback, Smart pause); Custom stand key.

### Tab Rosbot (`Panels/RosbotPanel.xaml`)

- Control panel: Start ROSBOT, Ensure Battle.net only, Update ROSBOT, Open Tampermonkey script, Set account/password.
- Path/config: ROS directory, Battle.net path, D3 path (TextBoxes); checkboxes (Auto enable latest ROS, Pickup blood shards, Prevent stuck).
- Log display: scrollable read-only TextBox for ROSBOT messages.

### Tab D4 (`Panels/D4Panel.xaml`) — 1:1 with Python tab[2] (ui/panels/d4_panel.py)

- Left: sub-tab nav (title + EXP Farming button); both from i18n (`ui.d4_panel.title`, `ui.d4_panel.sub_tabs.exp_farming`).
- Right: EXP Farming content — Start/Stop toggle (i18n start/stop button text), **Game status grid** (3×5: current_map, game_state, team_count, dungeon_progress, d4_running_status; screen_coordinates, screen_size, map_switch_count, map_switch_state, reserved_4; reserved_5–9), Debug button, Log frame (scrollable TextBox). All labels from `I18nKeys.D4*`.
- Logic: `RefreshI18n()` on Loaded and on language change (MainWindow calls when `GetPanel(d4)` is D4Panel). Start/Stop toggles local `_expFarmingRunning`; log via `AddLog` + timer drain; status display from local state (no D4 backend yet). ColorPrinter callback appends `[D4]` messages to log; Unloaded unregisters callback.
- **Not yet**: D4 controller/extension thread, screenshot/team check, debug window; backend state (e.g. DotCore.D3Check or app-level D4 state) for real map/team/dungeon values.

### Tab Calibration (`Panels/CalibrationPanel.xaml`) — 1:1 with Python tab[3] (coordinate_calibration_panel)

- Client mode: label, client type RadioButtons (Battle.net, D3 Game, D4 Game), Capture screenshot button. Client type persisted to `coord_calibration.client_type`.
- YOLO section: Config, Record Start/Stop, Import patch; Project ComboBox, Create project, Open project dir; workflow label **Step 1 Record; Step 2 Export; Step 3 Label** (aligned with Python).
- YOLO toolbar: Refresh, Export selected, **Open label** (opens in-process **AnnotatorWindow** using DotCore.VocAnnotator; uses `coord_calibration.yolo_current_project` as images/project dir; no process launch), Merge, Delete, Import patch.
- YOLO segment DataGrid: columns Timestamp, Frames, Status, Size; empty `ObservableCollection<YoloSegmentRow>`.
- Record log: scrollable read-only TextBox; Open label result appended here.
- **VocAnnotator integration**: d3check references DotCore.VocAnnotator; "Open label" opens an **in-process** WPF annotator window (`DotApps.d3check.Windows.AnnotatorWindow`) with images dir and project path from config; all I/O via DotCore.VocAnnotator (library). Standalone VocAnnotator.exe remains available via VocAnnotatorLauncher for CLI/shell use.

### Tab Log (`Panels/LogPanel.xaml`)

- Test functions: grid of buttons (Bag test, Yellow upgrade, Item reforge, Pathfinding, Debug blood shard, Debug quick pickup, Debug blacksmith, Kanai reforge/upgrade/convert, Auto salvage, Drop equipment, Sound feedback, Smart pause, Debug Battle.net UI, Debug ROSBOT).
- Control row: Clear, Save, Show DEBUG checkbox, Auto-scroll checkbox, Log level ComboBox, Scan log area button.
- Log text area: scrollable read-only TextBox.

---

## In progress

- None.

---

## Not started (by spec section)

- **§1 – Resize borders**: Optional thin draggable edges/corners (4 edges + 4 corners) for resize; currently `ResizeMode="CanResize"` uses system resize.
- **§1 – System tray**: Tray icon, Show/Exit (and optional tab shortcuts).
- **§1 – Window icon**: Resolve from config → default .ico / logo.png / app_icon.png.
- **§3.1.3 – Bottom bar**: Full layout (macro row, per-tab options, status rows 1–3, test mode, path icons).
- **§3.1.9 – System tray**: Full menu (Show, Maximize, Restart, Exit, optional Tab 0–4).
- **§3.1.10 – Popups**: e.g. `debug_window` key.
- **§3.1.11 – Widget mapping**: HotkeyInput custom control (key capture); Main panel key cells use TextBox placeholder. DataGrid/NumericUpDown where applicable already used.
- **i18n**: All visible strings from resource keys; language switch from title bar combo.
- **Config binding**: Main panel, Rosbot, Log bound to config; skill table rows not yet bound (same keys as Python).

---

## Reference

- **Element list**: [DOT_D3CHECK_UI_LIBRARY.md §3.1](DOT_D3CHECK_UI_LIBRARY.md#31-complete-ui-element-list-derived-from-python-reference)
- **Theming**: [DOT_D3CHECK_UI_THEMING.md](DOT_D3CHECK_UI_THEMING.md) (WPF approach, Python theme, dot derivation).
- **Repo paths**: App `dotapps/d3check/`; constants `Constants/`; config `Config/`; registry `Ui/UiRegistry.cs`; main window `MainWindow.xaml` / `MainWindow.xaml.cs`; panels `Panels/`; **reusable components** `Components/TitleBarControl.xaml`; theme `Themes/AppTheme.xaml`, `Themes/AppStyles.xaml`.
- **Architecture (config)**: Single config file shared with Python. Literal key paths only in `ConfigKeys`; UI and panels use `D3CheckConfigService.Instance` and `ConfigKeys.*`. Updates are applied in real time (control change → `SetValueAsync` + `QueueSave`).
