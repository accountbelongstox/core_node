# D3Check Dot Port: Sub-libraries (Functional Requirements)

This document lists **functional capabilities** that the .NET port must provide to achieve 1:1 parity with the Python d3-check app. Each item is a **requirement** for dotCore or dotapps/D3Check—not a code translation. Implementation uses .NET idioms.

**Project norms:** Dot: [development-guides/DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md), [.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc). Python: [docs/PROJECT_STANDARDS.md](PROJECT_STANDARDS.md), [.cursor/rules/d3-check.mdc](../../../.cursor/rules/d3-check.mdc). Code and comments in **English**; **ASCII only** in dot source. Literal constants in a single place (e.g. app_constants); config keys and paths consistent with Python.

---

## 1. Config (Providor)

- **Load config**: Load application config from file (e.g. JSON) at startup; support sync load and optional force reload.
- **Get / set value**: Get value by key path (e.g. `"ui_settings.window_geometry"`); set value by key path; support safe get with default.
- **User config path**: Single writable user config file path: `CONFIG_USER_PATH` = `{CURRENT_USER_DATA_PATH}/d3check_config.json` (same as Python `providor_index.CONFIG_USER_PATH`). Used for load/save.
- **Async save**: Optional queue so multiple set operations can be coalesced into one write; support explicit save and queue-and-save.
- **Key paths used**: At least: `ui_settings.window_geometry`, `ui_settings.app_icon`, `ui_settings.skip_taskbar_win32_fix`; `macro_configs.current_skill_config`, `macro_configs.skill_configs`, `macro_configs.auxiliary_config`; language; battlenet/d3/ros paths; hotkeys. **Auxiliary-config path** for hotkey rebind: `macro_configs.auxiliary_config` (same as Python `HOTKEY_CONFIG_PATH_AUXILIARY`). Same logical keys as Python.
- **Merge / sync**: Ability to merge default config with user config and to sync or fix config with templates if the app uses templates.
- **Thread safety**: Main thread and worker/extension threads must not directly mutate config; use safe get/set (e.g. get_config_value_safe, set_config_value_safe, set_config_value_async) and optional config worker thread. Same contract as Python.

---

## 2. i18n (Providor)

- **Load language**: Load current UI language from config (or default).
- **Get UI text**: Get localized string by key (e.g. `get_ui_text("main.tab_title")`). Keys and behavior equivalent to Python.
- **Language change**: When user changes language, support notification so the app can rebuild or refresh UI (e.g. re-create main window or refresh labels). Same contract as Python: one source of truth for current language.

---

## 3. UI registry (Share)

- **Register main UI**: Register the main window/UI instance once after creation (and again after rebuild, e.g. language change).
- **Get main UI**: Return the registered main UI instance; null if not yet created or after exit.
- **Get root**: Return the main window (root) for use as parent for popups or scheduling; null when no UI.
- **Get panel by key**: Return the panel instance for a given string key. Keys must match Python: `main`, `rosbot`, `d4`, `calibration`, `log`. Delegation to main UI’s `get_panel(key)` is acceptable; callers must not depend on panel type, only on key.
- **Popups**: Register popup by key when created; get popup by key; unregister when closed. At least support key for debug window (or equivalent). Same key set as Python where applicable.
- **Scope**: Registry is per-application (D3Check); no cross-app UI.
- **Log tab / ColorPrint**: Dot uses **DotCore.Foundations.ColorPrinter** for all log-style output (logic 1:1 with Python ColorPrint). The public library exposes only **RegisterCallback** / **UnregisterCallback** (callback signature: message, colorType, logLevel); it does not reference any UI. The **sub-app (d3check)** registers a single callback at a time: **MainWindow** switches it by selected tab—when tab index 1 (Rosbot), **RosbotPanel** is the callback target (ROSBOT log); otherwise **LogPanel** is the target. Panels expose `RegisterAsLogTarget` / `UnregisterAsLogTarget`; MainWindow calls them on tab change so only the current tab receives ColorPrint output (1:1 Python _reregister_log_callback).

---

## 4. Constants (Providor)

- **Tab indices**: Exactly 5 tabs in order: Main=0, Rosbot=1, D4=2, Calibration=3, Log=4. Same numeric indices as Python (`TAB_INDEX_*`, `TAB_COUNT=5`).
- **Panel keys**: String constants for panel keys: `main`, `rosbot`, `d4`, `calibration`, `log` (Python: `PANEL_KEY_*` in `providor.constants.ui`).
- **Popup keys**: String constant for debug popup: `debug_window` (Python: `POPUP_KEY_DEBUG_WINDOW`). Same key set where applicable.
- **Skill config names**: Fixed set of skill config names: `config1`, `config2`, `config3`, `config4`. Used for current_skill_config and skill_configs keys.
- **Paths**: Constants or helpers for app root, resources, default window geometry (e.g. 670×550), default icon paths (app_icon.ico, logo.png, app_icon.png), user data dir, config file path. Same logical paths as Python (`providor.constants.common`: ROOT_DIR, DEFAULT_WINDOW_GEOMETRY, DEFAULT_APP_ICON_PATH, etc.).
- **Literal constants**: All literals (magic strings/numbers) in a single constants layer (e.g. app_constants); no scattered literals in feature modules. Dot equivalent: one place for UI/config/key constants.

---

## 5. Runtime / system init

- **System initializer**: Initialize system (e.g. GUI mode) once at startup; return success/failure. Responsibilities: set up log watching, register window-status callback with UI (e.g. bottom bar), register shutdown hooks, and any other one-time setup the Python `SystemInitializer` does.
- **GUI mode**: When running as GUI app, perform GUI-specific init (e.g. no console attach, tray/UI ready).

---

## 6. Threads and task manager (Lifecycle / d3utils)

- **Thread registry**: Register and track app threads so they can be shut down in order (e.g. main, auxiliary, extension threads).
- **Main function thread**: Dedicated thread for main macro loop; get/set reference so other code can post work or check state.
- **Auxiliary function thread**: Dedicated thread for auxiliary tasks.
- **Extension threads**: At least D3 extension thread and D4 extension thread; getters so controllers can start/stop or post work.
- **Task thread manager**: Run one-off or recurring tasks on worker threads; support status (e.g. TaskStatus) and cancellation. Equivalent to Python task manager.

---

## 7. Event center (d3utils)

- **Main-thread handlers**: Register handlers for: app exit, window show, window minimize, window maximize. Handlers run on the main (UI) thread. Triggers from any thread must marshal to main thread before invoking these handlers.
- **Extension handlers**: Register handlers for extension events (e.g. start/stop macro, start/stop Rosbot). Same event set as Python.
- **Triggers**: Provide trigger functions that any thread can call: `trigger_app_exit`, `trigger_app_restart`, `trigger_window_show`, `trigger_window_minimize`, `trigger_window_maximize`, `trigger_extension_main_start_macro`, `trigger_extension_main_stop_macro`, `trigger_extension_rosbot_start`, `trigger_extension_rosbot_stop`. Behavior must match Python: event is queued and dispatched to registered handlers (on correct thread).
- **Shutdown provider**: Register a shutdown provider (e.g. is_shutdown_requested, request_shutdown, request_restart) so event center can coordinate with shutdown manager.

---

## 8. Shutdown manager (d3utils)

- **Shutdown state**: `is_shutdown_requested`, `request_shutdown`, `request_restart`, `is_restart_requested`.
- **Execute shutdown**: Single `execute_shutdown()` that: stops hotkey listener, runs registered shutdown hooks, stops log watching, runs thread-shutdown runner (join threads, stop task manager), closes UI, exits process (or returns for restart). Same order and semantics as Python.
- **Registration**: Register shutdown runner (thread join + task manager stop); register stop-log-watching; register shutdown hooks (e.g. reset Battlenet flow state). Register hotkey listener reference for cleanup.

---

## 9. Macro config (d3utils)

- **Config loader**: Load macro/skill configs from config; list config names; get current config name.
- **Current skill config**: Get current skill config (dictionary/object) for the active macro.
- **Config by name**: Get skill config by name. Same structure as Python (skill keys, timings, etc.).

---

## 10. Macro operations (d3utils)

- **Window cache**: Refresh D3 window cache for a given hwnd; clear cache. Used so macro logic has up-to-date window/position data.
- **Run one skill tick**: Given hwnd, skill config, and last-execution state, run one tick of the skill loop (send keys, respect cooldowns); return updated state. Same semantics as Python `run_one_skill_tick`.
- **Send key to window**: Send key press to window by hwnd and key name (virtual key or name). Support press-only or press+release as needed.
- **Cursor in bounds**: Optional helper to check if cursor is within game window bounds (for safety or pause logic).

---

## 11. Hotkey registry (d3utils)

- **Assistant callback**: Set a callback invoked when the assistant hotkey is pressed; clear or replace.
- **Combat callback**: Set a callback invoked when the combat hotkey is pressed.
- **Initialize hotkeys**: Register all app hotkeys with the system (or listener); return success/failure.
- **Unregister auxiliary hotkeys**: Unregister only auxiliary hotkeys on shutdown or mode switch.
- **Normalize hotkey**: Canonical form for hotkey strings (e.g. for config and comparison).

**Dot implementation:** **dotcore:** `HotkeyUtil.NormalizeCanonical`; `IGlobalHotkeyService` (Register/Unregister/UnregisterAll); `WindowsGlobalHotkeyService` (RegisterHotKey; app forwards WM_HOTKEY to `OnWmHotkey(wParam)`). **d3check:** Default hotkeys: macro_start_hotkey **F2**, assistant_hotkey **F3** (config keys `macro_configs.auxiliary_config.macro_start_hotkey` / `assistant_hotkey`). Hotkeys come from CONFIG; UI shows and updates from CONFIG. **Hotkey boxes (logic 1:1 with Python HotkeyInput):** Macro start and Assistant hotkey text boxes are read-only for typing; user focuses the box and **presses a key** (e.g. F2, F4, Ctrl+F1) to set the hotkey. Key press is captured in PreviewKeyDown, canonical string is built (modifiers + key), CONFIG is updated, `D3CheckConfigChangeHub.Notify(ConfigKeys.HotkeyConfigPathAuxiliary)` is called so the binder rebinds immediately. Escape/Delete clear the hotkey. MainPanel also subscribes to config-change; when keyPath starts with `macro_configs.auxiliary_config`, it refreshes both hotkey text boxes from CONFIG so UI stays in sync. `D3CheckHotkeyBinder` subscribes to the same hub and on change calls `ReregisterAuxiliary()`. MainWindow: creates `WindowsGlobalHotkeyService(hwnd, dispatcher)`, adds `HwndSource` hook for WM_HOTKEY, creates binder, sets combat/assistant callbacks, calls `Initialize()`; on Closed calls `Shutdown()`. Single-hotkey and full-auxiliary rebind both go through `ReregisterAuxiliary()`; config switch (current_skill_config) does not change auxiliary hotkeys (they are one set per app).

---

## 12. Game window detector (d3utils)

- **Find game window**: Detect Diablo 3 (or target game) window by title/process; return hwnd and optional window info (rect, process id).
- **Current window**: Return current/last detected game window; refresh on demand or on timer.

---

## 13. Battlenet (d3utils)

- **Battlenet manager**: Launch/find Battlenet client; get window info; region detection.
- **Battlenet operations**: Region-specific operations (e.g. Asia, CN) for login flow: find controls (account, password, submit, continue), click, type. Same steps as Python for each region.
- **Battlenet status**: Refresh Battlenet status (window state, login state); get current Battlenet window.
- **Region**: Read/prefer region from config; ensure region in config after detection.

---

## 14. Rosbot (d3utils)

- **Rosbot manager**: Given ros directory path, validate path; list/run Rosbot-related operations; version parsing from path.
- **Rosbot operations**: Execute Rosbot flows (e.g. start/stop task, run one tick); same high-level operations as Python.
- **Rosbot flow / Battlenet block**: Battlenet login block state (steps, wait times, poll deadlines); tick Battlenet ready flow; reset flow state on shutdown.
- **Rosbot update manager**: Check for updates; pick best Rosbot dir by region; path conventions.
- **Dot tab[1] (Rosbot panel)**: **d3check** RosbotPanel layout is 1:1 with Python `rosbot_extension_panel`: **row 0** = two columns — **left** = config (paths: ROS directory, Battle.net, D3; then "Bot settings" 3×3 grid: row0 = auto_enable_latest_ros | blue_portal_priority | firstborn_blue_gate_reuse; row1 = pickup_blood_shards | smart_echo + seconds | test_mode + timeout minutes; row2 = prevent_stuck | startup | timeout_restart + minutes); **right** = control panel (Start ROSBOT, Ensure Battle.net only, Update ROSBOT, Open Tampermonkey script, Set account/password, stacked vertically). **Row 1** = ROSBOT log full width. Config keys and default template match Python `ROSBOT_PANEL_CONFIG_KEYS`. Buttons use placeholder handlers until extension/flow are ported. ColorPrint targets this log when tab 1 is selected. **dotcore:** path/scan and game state use **DotCore.D3Check** (PathScanner, GameInterfaceData, D3PathConstants); sub-app d3check references dotcore only and composes the panel.

---

## 15. OCR (d3utils)

- **OCR result**: Given image or window region, return recognized text (and optionally boxes). Support at least one engine (e.g. default/general).
- **Keyword search**: Check if any of a set of keywords appears in OCR result; find keyword boxes (bounding boxes) for given keywords.
- **Engine selection**: Optional: different engines for different tasks (e.g. default, number, document); get engine by task name. Dot may use a different OCR library; same capability (text + boxes, keyword match).

---

## 16. Log analyzer (d3utils)

- **Login try callback**: Register a callback invoked when a login attempt is detected in the log (e.g. for screenshot or state update). Same contract as Python.

---

## 17. Path scanner (d3utils)

- **Scan for paths**: Scan configured or default drives for Battlenet path, D3 path, Rosbot directory; return best candidates. Support skip-scan when paths are already valid.
- **Path validation**: Validate that configured paths exist and are usable.

---

## 18. Timers / tick driver (d3utils)

- **Tick driver**: Global tick count; flow tick derived from global; `on_tick()` invoked periodically (e.g. by a timer). Register callbacks that run on tick (e.g. inactive refresh).
- **Window monitor**: Timer or tick-based logic to monitor game window presence/foreground and update UI or state (e.g. bottom bar status). Naming: full refresh `run_full_status_refresh()`; when flow inactive, `refresh_window_status_if_inactive()`.
- **One-shot / delayed**: Schedule a single run after delay (e.g. for deferred init or debounce). **Contract**: one-shot work is submitted via a single entry (e.g. timer_manager.submit_one_shot) and implemented as named do_* functions (e.g. do_path_scan, do_login_check); no ad-hoc threads for one-off tasks. Same in dot: one-shot via central scheduler + named handlers.

---

## 19. Login / screenshot controller (app or d3utils)

- **Login try screenshot**: When a login try is detected (from log or flow), take screenshot and optionally notify UI or save. Same behavior as Python login_try_screenshot_controller.
- **Callbacks**: Register with log analyzer or flow so login attempts trigger the controller.

---

## 20. Config change hub (Share)

- **Subscribe**: Components (e.g. UI, controllers) subscribe to config change events (by key path or global). Subscriber receives optional key_path so it can decide whether to rebind hotkeys (e.g. when key_path starts with `macro_configs.auxiliary_config`) or refresh macro config loader (e.g. when key_path starts with `macro_configs`).
- **Notify**: When config is updated, notify subscribers so they can refresh. Same publish/subscribe contract as Python. Hub may be scoped to a root/window for Tk after(0) or equivalent; dot uses Dispatcher or equivalent for main-thread apply.

**Dot implementation:** **dotcore:** `ConfigChangeNotifier` (Subscribe, NotifyConfigChanged(keyPath), Unsubscribe). **d3check:** `D3CheckConfigChangeHub` static class with `Notifier` and `Notify(keyPath)`; `D3CheckHotkeyBinder` subscribes and when keyPath starts with `ConfigKeys.HotkeyConfigPathAuxiliary` calls `ReregisterAuxiliary()`. UI (e.g. MainPanel) calls `D3CheckConfigChangeHub.Notify(...)` after saving hotkey config.

---

## 21. Game interface data (Share)

- **Current game state**: If the app keeps a “game interface” data structure (current hwnd, window state, etc.), provide get/update and optional notification so UI and macro logic stay in sync. Same logical data as Python.

---

## 22. Lifecycle (app)

- **Shutdown registration**: On startup, register the thread-shutdown runner with shutdown manager so `execute_shutdown` can join threads and stop task manager. No circular dependency: event center and shutdown manager do not reference thread implementations; lifecycle does.
- **Entry import**: Only the main entry (and event bus) imports lifecycle/thread registry; controllers and UI use **runtime** as the single facade for threads, shutdown, event center, task manager. Dot: same idea—one runtime facade for lifecycle.

---

## 23. Summary: where to implement in dot

| Capability | Prefer in dotCore | Prefer in dotapps/D3Check |
|------------|-------------------|---------------------------|
| Config load/save, paths | DotCore.Common / DotCore.Infrastructure | App-specific keys in D3Check |
| i18n | DotCore.Common or app | D3Check (keys/usage) |
| UI registry | — | D3Check only |
| Constants (tab/panel keys) | — | D3Check |
| System init, threads, event center, shutdown | DotCore.Foundations / DotCore.Common or dedicated lib | D3Check wires them |
| Macro config/ops, hotkeys, game window, Battlenet, Rosbot, OCR, log, path scanner, timers | DotCore.* if shared across apps; else D3Check | D3Check at least for app-specific flows |
| Config change hub, game interface data | — | D3Check or shared DotCore if needed |

Implementation must provide **the same capabilities and contracts** as the Python side; code structure and naming follow .NET and dot architecture (see `development-guides/DOT_ARCHITECTURE.md`).

---

## 24. Share structure (Python convention; dot equivalent)

- **Data vs functions**: Python separates **share/values** (data only: get/set, config/credentials, queues) and **share/common** (shared pure functions, base classes; no run_*/do_*). Dot should provide equivalent split: data access layer vs shared utilities; no business workflow in shared data layer.
- **Forbidden in share (data)**: run_*, do_*, business flows, complex algorithms, scheduled tasks. Only data access and sync.
- **Forbidden in share (common)**: D3-only/D4-only business, run_*/do_*; common may depend on share/values, providor, pycore.

---

## 25. Flow state ownership (Python; dot must match)

- **Single owner**: All flow switch and step/block state are held only by the **flow library** (e.g. d3utils.rosbot_flow*). Tick entry (e.g. process_rosbot_task → tick_bn_only_flow / tick_flow_master) only reads flow state and calls flow APIs.
- **Controllers / UI / timers**: Treated as **callers**; they only call flow layer public APIs and must not create or directly read/write flow_master, bn_only, or BN step state. Dot: same—controllers and UI do not hold flow state; they call flow service APIs.

---

## 26. References

| Document | Purpose |
|----------|---------|
| [development-guides/DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md) | Dot layout, naming, dependencies |
| [docs/PROJECT_STANDARDS.md](PROJECT_STANDARDS.md) | Python: share/, constants, threads, flow, imports |
| [docs/THREAD_BUS_AND_REGISTRY.md](THREAD_BUS_AND_REGISTRY.md) | Threads, event center, no blocking |
| [docs/FLOW_ARCHITECTURE_DIRECTORY.md](FLOW_ARCHITECTURE_DIRECTORY.md) | Flow layout, tick-driven, no timers in flow |
| [runtime/__init__.py](../runtime/__init__.py) | Single facade: lifecycle, event center, shutdown, threads |
| [providor/constants/ui.py](../providor/constants/ui.py) | Tab indices, panel keys, popup keys |
| [d3utils/d3u_common/hotkey_registry.py](../d3utils/d3u_common/hotkey_registry.py) | HOTKEY_CONFIG_PATH_AUXILIARY |
