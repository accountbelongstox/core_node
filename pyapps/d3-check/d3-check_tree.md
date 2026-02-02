# d3-check Architecture Tree

**Path:** `pyapps/d3-check`  
**Requirements:** AGENTS.md, docs/CODE_TREE.md, docs/THREAD_BUS_AND_REGISTRY.md

---

## Layer 1: Entry

Only imports **runtime** for lifecycle/thread/event. No direct d3utils/share for init/shutdown/events.

```
main.py                    # Entry; args → GUI / bridge / tray / train. Uses runtime (get_system_initializer, execute_shutdown).
train.py                   # Training entry (delegated from main).
validate.py                # Validation entry.
```

---

## Layer 2: Runtime (lifecycle, threads, events)

Single facade. **Consumers (main, controller, ui) import from `runtime` only** for init, shutdown, event center, task threads, thread registry.

```
runtime/
└── __init__.py            # Re-exports: get_system_initializer, execute_shutdown, is_shutdown_requested, request_shutdown,
                           # request_restart, is_restart_requested; register_main_thread_handlers, register_extension_handlers,
                           # trigger_app_exit, trigger_*, get_task_manager, TaskStatus, get_thread_registry.

# Implementation (internal; do not import from main/controller/ui for these):
d3utils/
├── system_initializer.py  # Config, hotkeys, signals, timer system, task thread manager.
├── shutdown_manager.py    # Shutdown sequence: extension threads, hotkey, task manager, timer, UI.
├── event_center.py        # Event bus over THREAD_BUS; main-thread and extension-thread handlers.
├── event_signals.py       # Event names and triggers (extension shutdown, rosbot started/stopped).
└── task_thread_manager.py # Task threads (e.g. rosbot_task); fire-and-forget API, status snapshot.

share/
└── thread_registry.py     # Central owner of extension threads, macro fallback, tray, game_interface_macro;
                           # create_extension_threads, start_timer_loop_after_ui_ready.
```

---

## Layer 3: Controllers

Use **runtime** for get_thread_registry, event_center triggers, execute_shutdown. No direct d3utils.event_center / d3utils.shutdown_manager / share.thread_registry for lifecycle.

```
controller/
├── d3_macro_controller.py      # Main controller; UI, extension threads, event handlers. Uses runtime.
├── game_interface_controller.py # Game interface macro. Uses runtime (get_thread_registry).
├── http_bridge_controller.py    # HTTP API bridge.
├── login_try_screenshot_controller.py
├── d4_controller.py
├── game_assistant_controller.py
├── pathfinding_controller.py
├── ctl_func/                    # blacksmith_handler, kanai_cube_handler
├── d4func/                      # D4 events, exp_farming, region_detector, etc.
└── training/
```

---

## Layer 4: d3utils (D3/Battle.net logic; no lifecycle facade)

Thread **classes** and D3/BN logic. Internal imports only (no runtime import).

```
d3utils/
├── main_function_thread.py     # Macro loop thread class.
├── auxiliary_function_thread.py
├── d3_extension_thread.py      # D3/ROSBOT extension thread class.
├── d4_extension_thread.py
├── rosbot_task_processor.py    # ROSBOT task tick.
├── rosbot_flow_battlenet.py
├── rosbot_manager.py
├── rosbot_ui_automation.py
├── log_monitor.py
├── log_analyzer.py
├── d3_start_game_and_teleport_waiter.py
├── battlenet_capture.py
├── battlenet_operation.py
├── battlenet_template_matcher.py
├── battlenet_status_provider.py
├── battlenet_manager.py
├── battlenet_button_detector.py
├── battlenet_match_debug.py
├── d3_manager.py
├── d3_status_provider.py
├── d3_scaled_template_matcher.py
├── game_window_detector.py
├── screenshot_provider.py
├── path_scanner.py
├── process_helper.py
├── window_resizer.py
├── drive_order.py
├── state_aware_click_handler.py
├── status_provider_common.py
├── interface_manager.py
├── global_hotkey_manager.py
├── i18n_manager.py
├── ocr_helper.py
├── collectors/                  # bag_info_collector, grid_screenshot_collector, ui_region_collector_*, etc.
├── d3u_common/                  # hotkey_registry, image_annotator_helper, image_utils
└── ...
```

---

## Layer 5: share (shared data, one-shot work)

```
share/
├── game_interface_data.py   # Shared D3/D4 interface data.
├── thread_registry.py       # Re-exported by runtime.
├── threads.py               # One-shot do_* (window monitor, path scan, refresh, battlenet_ui_analyze).
├── oauth_callback.py
├── project_path.py
├── scaled_template_matcher_base.py
├── coordinate_helper.py
└── __init__.py
```

---

## Layer 6: timers

```
timers/
├── timer_manager.py         # Single-thread timer loop; register_task, submit_one_shot.
├── window_monitor_timer.py
├── __init__.py
└── README.md
```

---

## Layer 7: UI

Import **runtime** for is_shutdown_requested, trigger_*, get_task_manager, get_thread_registry, register_main_thread_handlers. No direct d3utils.event_center / d3utils.shutdown_manager for these.

```
ui/
├── diablo3_macro_ui.py      # Main TK window; uses runtime (register_main_thread_handlers, trigger_*).
├── unified_styles.py
├── webview_launcher.py
├── panels/
│   ├── main_functions_panel.py
│   ├── rosbot_extension_panel.py  # Uses runtime (get_task_manager, trigger_extension_*, is_shutdown_requested).
│   ├── d4_panel.py
│   ├── log_panel.py
│   ├── coordinate_calibration_panel.py
│   └── auxiliary_functions_panel.py
├── components/
│   ├── system_tray.py       # Uses runtime (get_thread_registry).
│   ├── title_bar.py         # Uses runtime (trigger_window_*, trigger_app_*).
│   ├── status_bar.py        # Uses runtime (is_shutdown_requested).
│   ├── bottom_bar.py
│   ├── coordinate_picker_window.py
│   ├── debug_window.py
│   ├── macro_controls.py
│   ├── menu_bar.py
│   ├── bottom_bar_*.py
│   └── template_matcher_helper.py
├── theme/
├── utils/
└── widgets/
```

---

## Layer 8: config and providor

```
config/
├── unified_config.py
├── grid_config.py
├── screenshot_categories.py
├── __init__.py
└── ...

providor/
├── providor_index.py        # CONFIG, initialize_config, get_config_value_safe
├── app_constants.py         # Literal constants
├── template_config.json
├── i18n/                    # i18n JSON
└── ...
```

---

## Other (scripts, docs, assets)

```
docs/                        # CODE_TREE.md, THREAD_BUS_AND_REGISTRY.md, DESIGN.md, ...
scripts/                     # Standalone scripts
timers/                      # See Layer 6
d4utils/                     # D4 detectors, matchers (d4_scaled_template_matcher, team_health_detector, ...)
utils/                       # _obsolete_* only
state/                       # _obsolete_* only
athtest/, images/, d4_modules/, ...
```

---

## Import Rules (summary)

| Consumer        | Lifecycle/thread/event source | Other |
|----------------|-------------------------------|--------|
| main.py        | **runtime** only             | controller, d3utils.i18n_manager |
| controller/*   | **runtime** only             | d3utils (logic), share, timers, config, providor |
| ui/*           | **runtime** only             | share, d3utils (i18n, etc.), config, providor |
| d3utils/*      | Internal (no runtime)        | share, timers, providor, config |
| share/*        | Internal                     | providor, etc. |

---

## Related docs

- **docs/CODE_TREE.md** — Layer table and import rules
- **docs/THREAD_BUS_AND_REGISTRY.md** — No cross-thread block; event center; init all at startup; tick-driven
- **AGENTS.md** — Runtime and code tree, threads
