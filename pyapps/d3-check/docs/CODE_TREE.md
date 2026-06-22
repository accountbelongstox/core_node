# d3-check Code Tree

> **层次与模块角色已整合至 `docs/PROJECT_STANDARDS.md`** §一、§二；本档为分层细节展开。

Layers and modules. Entry uses **runtime** only for lifecycle/thread/event; runtime re-exports from d3utils and runtime.thread_registry. **share** = shared data (**share/values/**) + shared functions (**share/common/**); no run_/do_ in share. See `PROJECT_STANDARDS.md` §1.3.

## Layer 1: Entry

| Path | Role |
|------|------|
| `main.py` | Application entry; parses args, runs GUI / bridge / tray / train. Imports **runtime** (get_system_initializer, execute_shutdown). |

## Layer 2: Runtime (lifecycle, threads, events)

Single facade for startup, shutdown, event center, thread registry, task threads. **Consumers import from `runtime`**, not from d3utils/share for these.

| Path | Role |
|------|------|
| `runtime/__init__.py` | Re-exports: get_system_initializer, execute_shutdown, is_shutdown_requested, request_shutdown; register_main_thread_handlers, register_extension_handlers, trigger_app_exit, trigger_extension_*; get_task_manager, TaskStatus; get_thread_registry. |
| `d3utils/system_initializer.py` | System init: config, hotkeys, signals, timer system, task thread manager. |
| `d3utils/shutdown_manager.py` | Shutdown sequence: extension threads, hotkey, task manager, timer, UI. |
| `d3utils/event_center.py` | Event bus over THREAD_BUS; main-thread and extension-thread handlers. |
| `d3utils/event_signals.py` | Event names and triggers (extension shutdown, rosbot started/stopped). |
| `d3utils/task_thread_manager.py` | Task threads (e.g. rosbot_task); fire-and-forget API, status snapshot. |
| `runtime/thread_registry.py` | Central owner of extension threads, macro fallback, tray, game_interface_macro; create_extension_threads, start_timer_loop_after_ui_ready. |

## Layer 3: Controllers

| Path | Role |
|------|------|
| `controller/d3_macro_controller.py` | Main controller; creates UI, extension threads, registers event handlers; uses **runtime** (get_thread_registry, event_center, execute_shutdown). |
| `controller/game_interface_controller.py` | Game interface macro; uses **runtime** (get_thread_registry). |
| `controller/http_bridge_controller.py` | HTTP API bridge. |
| `controller/login_try_screenshot_controller.py` | Login flow, OAuth, screenshot. |
| `controller/d4_controller.py` | D4 extension logic. |
| `controller/game_assistant_controller.py` | Game assistant (blacksmith, kanai). |
| `controller/pathfinding_controller.py` | Pathfinding. |
| `controller/ctl_func/` | Handlers (blacksmith, kanai). |
| `controller/d4func/` | D4 events, exp_farming, region_detector, etc. |

## Layer 4: d3utils (D3/Battle.net logic, no lifecycle)

| Path | Role |
|------|------|
| `d3utils/main_function_thread.py` | Macro loop thread class. |
| `d3utils/auxiliary_function_thread.py` | Auxiliary thread class. |
| `d3utils/d3_extension_thread.py` | D3/ROSBOT extension thread class. |
| `d3utils/d4_extension_thread.py` | D4 extension thread class. |
| `d3utils/rosbot_task_processor.py` | ROSBOT task tick. |
| `d3utils/rosbot_flow_battlenet.py` | Battle.net flow states. |
| `d3utils/log_monitor.py` | Log monitor. |
| `d3utils/d3_start_game_and_teleport_waiter.py` | D3 start game and teleport. |
| `d3utils/battlenet_*.py` | Battle.net capture, operation, template, status. |
| `d3utils/d3_*.py` | D3 manager, status, scaled matcher. |
| `d3utils/collectors/` | Bag, grid, UI region collectors. |
| `d3utils/d3u_common/` | Hotkey registry, image utils. |
| `d3utils/i18n_manager.py` | i18n. |
| `d3utils/global_hotkey_manager.py` | Global hotkeys. |
| `d3utils/smart_echo.py` | SmartEcho: F7 pause + OCR-driven resume (do_smart_echo_pause_after_complete). |
| `d3utils/key_send.py` | System key send (e.g. F7). |
| Others | Screenshot, path scanner, window resizer, etc. |

## Layer 5: share (values = data, common = shared functions)

Per **PROJECT_STANDARDS.md §1.3**: share/values = data + data access only; share/common = shared functions and base classes. No run_/do_; no gitignore-prone dir names. Module list and roles see §1.3.

| Path | Role |
|------|------|
| share/values/ (或 share 根) | 数据与 get_*/set_* only |
| share/common/ (或 share 根) | 共用工具与基类，无 d3/d4 业务 |

## Layer 6: timers

| Path | Role |
|------|------|
| `timers/timer_manager.py` | Single-thread timer loop; register_task, submit_one_shot. |
| `timers/one_shot_tasks.py` | One-shot do_* (path scan, login check, ROSBOT debug, Battlenet UI, window monitor). |
| `timers/window_monitor_timer.py` | Window monitor. |

## Layer 7: UI

| Path | Role |
|------|------|
| `ui/diablo3_macro_ui.py` | Main TK window. |
| `ui/panels/*.py` | Panels (main, rosbot, d4, log, coordinate, auxiliary). |
| `ui/components/*.py` | System tray, status bar, bottom bar, coordinate picker, etc. |
| `ui/theme/`, `ui/utils/`, `ui/widgets/` | Theme, app root, config binding, widgets. |

## Layer 8: config and providor

| Path | Role |
|------|------|
| `config/` | unified_config, grid_config, screenshot_categories. |
| `providor/providor_index.py` | CONFIG, initialize_config, get_config_value_safe. |
| `providor/app_constants.py` | Literal constants. |
| `providor/i18n/` | i18n JSON. |

## Import rules

- **main.py** and **controllers** / **ui** that need lifecycle or thread/event: import from **runtime** only (get_system_initializer, execute_shutdown, get_thread_registry, event_center triggers, get_task_manager, is_shutdown_requested).
- **d3utils** and **share** (share/values = data, share/common = shared functions) internals: keep importing as needed; no business logic in share; see PROJECT_STANDARDS §1.3.
- One-shot work: `timers.timer_manager.submit_one_shot`, **`timers.one_shot_tasks.do_*`**; SmartEcho: `d3utils.smart_echo.do_smart_echo_pause_after_complete`.

## Related docs

- Thread/event rules: `docs/THREAD_BUS_AND_REGISTRY.md`
- Design: `docs/DESIGN.md` §4
