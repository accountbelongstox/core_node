# D3Check Dot Port: Controllers (Responsibilities & Dot Requirements)

This document describes **controller responsibilities** in the Python d3-check app and the **development requirements** for the .NET port (dotCore and dotapps/D3Check). Controllers are specified by **what they do**, not by copying Python code. The dot side must fulfill the same responsibilities using .NET patterns.

**Project norms:** Dot: [development-guides/DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md), [.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc)—**English only**, **ASCII only** in code. Python: [docs/PROJECT_STANDARDS.md](PROJECT_STANDARDS.md), [.cursor/rules/d3-check.mdc](../../../.cursor/rules/d3-check.mdc). Flow state is owned only by the flow library; controllers and UI only call flow APIs (see [docs/FLOW_ARCHITECTURE_DIRECTORY.md](FLOW_ARCHITECTURE_DIRECTORY.md)).

---

## 1. Entry and ownership

- **Single entry**: Application entry (e.g. `Program.Main` or equivalent) performs: system init (GUI mode), load i18n from config, create **one** main controller, start HTTP bridge (if used), then call main controller’s run. Exit is via UI/tray only (no reliance on console Ctrl+C for normal shutdown).
- **Single main UI owner**: Only the main controller creates and owns the main window/UI instance. No other component creates a second main window. The same instance is registered in the UI registry and used for the lifetime of the app (or until language-change rebuild, after which the new instance is registered).

---

## 2. Main controller (D3MacroController equivalent)

Responsibilities below must be provided 1:1 in behavior by the dot app’s main controller.

### 2.1 Initialization

- **Game interface**: Obtain or create the game-interface controller; call initialize before showing UI. If initialization fails, do not run UI and return failure.
- **Callbacks wiring**: Wire callbacks so that:
  - Log-analyzer “login try” events invoke the login-try screenshot controller (e.g. handle login try).
  - Assistant hotkey invokes game-interface controller’s assistant/auto-use.
  - Combat hotkey invokes main controller’s toggle combat macro (start if stopped, stop if running).
  - Login controller actions (e.g. ensure Battlenet started and login check, ensure D3 running from Battlenet without Rosbot, Battlenet-only) are registered with the one-shot/timer system so they can be called from extension or timer logic.
- **State**: Hold macro running flag, current skill config name (e.g. config1–config4), and last skill execution state for the macro tick. No duplicate macro state elsewhere.

### 2.2 UI creation and run

- **Create UI once**: Create the main window (with title bar, 5 tabs, panels, bottom bar, macro controls, system tray) and store reference. Set callbacks on the UI: macro start, macro stop, config change (save from UI), skill config switch.
- **Config change hub**: Subscribe to config change hub (with main window as context if needed). On config change, run sync logic: defer config read to a worker thread, then apply config on the UI thread; when key_path starts with `macro_configs.auxiliary_config`, rebind assistant and combat hotkeys; when key_path starts with `macro_configs`, refresh macro config loader. Same contract as Python (avoid blocking UI thread on config read).
- **Window monitor**: Register the UI’s window-status callback (e.g. bottom_bar.on_window_status_update) with the window monitor. Register bottom bar for state updates (e.g. window_monitor.register_status_ui(bottom_bar.update_status_from_state)). Register Rosbot panel: set_register_status_ui_fn so the panel can register its get_status_ui_callback with the window monitor; set_refresh_status_fn to window_monitor.refresh_window_status_if_inactive. Same in dot: one window monitor with register_status_ui and refresh_window_status_if_inactive.
- **Game interface poll**: Start the main-thread poll for game interface data (e.g. current hwnd) with a suitable interval (e.g. 100 ms) and marshal updates to UI thread (e.g. get_game_interface_data().start_main_thread_poll(dispatch, interval)).
- **Extension threads**: Create and register extension threads (D3, D4). Provide schedule function that marshals to UI thread (e.g. `Dispatcher.Invoke`). Pass: Rosbot panel (or getter), current skill config name, Battlenet login-check provider (e.g. lambda for ensure_battlenet_started_and_login_check(for_f2_only=True)), and D4 process function (e.g. get_d4_controller().process). Start timer loop after UI is ready.
- **Extension handlers**: Register with event center: main UI and Rosbot panel, main/auxiliary/D3/D4 thread getters, so that extension events (start/stop macro, start/stop Rosbot) are dispatched to the correct handlers.
- **Rosbot / path scan**: If Rosbot tab is selected and path scan is needed at startup (e.g. panel.startup_path_scan_needed()), schedule one path scan after a short delay (e.g. 800 ms, throttled). Ensure current tab content is created when needed (e.g. ensure_current_tab_content_if_needed; for Rosbot tab, ensure_content or equivalent so panel internals exist before use).
- **System tray**: Start system tray when UI is ready. Tray “Show” and “Exit” are already wired to trigger_window_show and trigger_app_exit in UI; no extra wiring in controller beyond ensuring tray is started.
- **Run UI**: Call the UI run (message loop). After the UI exits, call execute_shutdown(). In finally: clear macro state, stop macro fallback, shutdown game interface.

### 2.3 Macro

- **Start macro**: If already running, return. Read current skill config name from config; load active macro config. Notify main function thread (if present) with current config; trigger extension “start macro”. Set macro running; if no main function thread, start macro fallback (controller-owned loop that runs skill ticks). Invoke on_macro_start callback (e.g. UI refresh).
- **Stop macro**: If not running, return. Trigger extension “stop macro”; clear macro running; clear D3 window cache; stop macro fallback. Invoke on_macro_stop callback.
- **Combat hotkey**: Runs on worker thread; must schedule toggle (start/stop macro) on UI thread so it runs on main thread. Same as Python “after(0, …)” / Dispatcher.

### 2.4 Skill config

- **Switch skill config**: Accept config name from fixed set: config1, config2, config3, config4. Update current skill config; notify main function thread if present; optionally notify UI (on_config_change). Same allowed set as Python.
- **Get/update config**: Get current merged config (skill + auxiliary); get skill config by name; update skill config or auxiliary config and queue config save. Apply config sync from hub path with pre-fetched data on main thread; optionally rebind hotkeys when auxiliary config path changed, and refresh macro config loader when macro_configs changed.

### 2.5 Language change

- **Listener**: Register a top-level language-change listener with i18n. On language change (with debouncing), call the main UI’s language-change handler. The UI is responsible for rebuilding or re-creating the window and re-registering; controller only delegates to UI and does not create a second UI instance itself.

### 2.6 Shutdown

- **Unified exit**: Normal exit is through trigger_app_exit → main-thread handler → execute_shutdown. Controller’s shutdown method (if exposed) should stop macro, shutdown game interface, stop tray, then exit; it is used only as fallback or from tests. No duplicate exit paths: one execute_shutdown path.

---

## 3. HTTP bridge controller

- **Role**: Optional HTTP server (e.g. 127.0.0.1:8765) for external commands (e.g. start/stop macro, get status). Started by entry point before main controller run; stopped on exception or process exit.
- **Requirements**: Dot must provide equivalent: start/stop server, hold reference to main controller so API handlers can call start_macro, stop_macro, get status, etc. Same logical API as Python (port and paths can be configurable).

---

## 4. Sub-controllers (used by main controller)

- **Game interface controller**: Initialize and shutdown game interface (e.g. window detection, game state). Provide run_assistant_auto_use for assistant hotkey. Main controller holds reference and calls initialize before UI, shutdown in finally.
- **Login-try screenshot controller**: Handle login try (from log analyzer callback); ensure Battlenet started and login check; ensure D3 running from Battlenet (no Rosbot); Battlenet-only. Main controller registers these actions with the one-shot/timer system (e.g. register_login_controller_actions) and registers the login-try callback with the log analyzer (register_login_try_callback).
- **D4 controller**: Provide process method used by D4 extension thread. Main controller passes it when creating extension threads.

These are **responsibilities**; dot can implement them as separate classes or services, as long as the same behavior is available to the main controller.

---

## 5. Dot development requirements (summary)

### 5.1 dotapps/D3Check

- **One main controller**: Single class or composition root that owns the main UI and performs all wiring above. No duplicate UI creation.
- **UI thread**: All UI updates and UI-triggered logic (macro start/stop from button, config apply, tab content) run on the main UI thread. Hotkey or timer callbacks that must update UI or call controller methods that touch UI must marshal to the main thread (e.g. `Dispatcher.Invoke` in WPF).
- **Same contracts**: Panel keys (main, rosbot, d4, calibration, log), tab indices (0–4), callback signatures (macro start/stop, config change, skill config switch, language change), and config key paths must match the Python behavior so that extension threads, timers, and event center can be ported with minimal change to contracts.
- **Event flow**: Exit, show window, minimize, maximize, start/stop macro, start/stop Rosbot must go through the same logical triggers and handlers as Python (event center + main-thread handlers). Dot implements the same flow with .NET types (events, Dispatcher, etc.).
- **Shutdown**: Single execute_shutdown path: stop hotkeys, run shutdown hooks, stop log watching, run thread-shutdown runner, close UI, exit (or restart). Lifecycle registers thread-shutdown runner with shutdown manager; no circular dependency (event center/shutdown manager do not reference thread types).

### 5.2 dotCore (if used)

- **No app-specific UI**: dotCore does not create D3Check windows or panels. It may provide: theme data (DotCore.UITheme), foundations (thread bus, event bus, logging), config/i18n infrastructure, or shared utilities. Controllers and main window live in dotapps/D3Check.
- **References**: D3Check references dotCore libraries only. Controllers in D3Check may depend on DotCore.* for config, i18n, event center, or shutdown; the exact split is decided by the dot architecture (see `development-guides/DOT_ARCHITECTURE.md`).

### 5.3 Testing and maintainability

- **Single creator**: Easiest way to avoid duplicate main windows is to have only the main controller create the main window and register it. Tests that need a UI can use the same controller or a test double that implements the same contracts.
- **Callback contracts**: Document or type the callback signatures (macro start/stop, config change, skill switch, language change, window status) so that dot and Python can be kept in sync when adding features.

This document is the reference for **controller responsibilities and dot requirements** when implementing dotapps/D3Check. Implementation uses .NET and WPF idioms; behavior must match the Python app as described above.

---

## 6. References

| Document | Purpose |
|----------|---------|
| [development-guides/DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md) | Dot layout, naming, dependencies |
| [.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc) | Dot rule: English, ASCII |
| [docs/PROJECT_STANDARDS.md](PROJECT_STANDARDS.md) | Python: share/, constants, threads, flow, one-shot |
| [docs/FLOW_ARCHITECTURE_DIRECTORY.md](FLOW_ARCHITECTURE_DIRECTORY.md) | Flow state ownership, tick-driven |
| [main.py](../main.py) | Entry: lifecycle, system init, i18n, controller, HTTP bridge, run |
| [controller/d3_macro_controller.py](../controller/d3_macro_controller.py) | Main controller wiring, run(), callbacks |
| [d3utils/d3u_common/hotkey_registry.py](../d3utils/d3u_common/hotkey_registry.py) | HOTKEY_CONFIG_PATH_AUXILIARY for rebind condition |
