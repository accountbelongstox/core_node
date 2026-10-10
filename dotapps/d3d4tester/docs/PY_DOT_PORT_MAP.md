# Python → C# Port Map (d3-check → d3d4tester)

Source `pyapps/d3-check/` (live code = reachable from `main.py`). Each C# type names its source in its summary (`1:1 Python <path>`); generic parts go to dotcore ([DOT_PUBLIC_LIBRARY_PROGRESS.md](../../../dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md) §2). Paths below are relative to `dotapps/d3d4tester/`; `Core/` = `D3D4TesterCore/`.

## Ported

| Python | C# |
|--------|----|
| `main.py`, `lifecycle/` (shutdown, log monitor) | `App.xaml.cs`, `Services/SystemInitializer`, `ShutdownManager`, `RosbotLogFileWatcher` |
| `providor/` (i18n, constants, template config) | `I18n/`, `Constants/`, `Core/D3TemplateConfig` |
| `config/` user config | `Config/` (`D3D4TesterConfigService`, Options, `ConfigBinding`) |
| `share/game_interface_data`, `ui_registry`, `asia_credentials`, `oauth_callback`, `template_match_debug` | `Core/GameInterfaceData`, `Ui/UiRegistry`, `Config/AsiaCredentialsService`, `Services/OAuthCallbackState`, `Core/MatchDebugNotify` |
| `share/coordinate_helper`, `scaled_template_matcher_base`, `d4_ocr_config` | dotcore `CoordinateScaler`, `ScaledTemplateMatcher`; `Core/D4/D4OcrConfig` |
| `d3utils/tick_driver`, `rosbot_task_processor`, `rosbot_flow/*`, `rosbot_flow_battlenet` | `Core/Flow/*` (sequential, not tick-driven: `RosbotFlowRunner`, `BattlenetReadyProcess`, `GameLaunchProcess`, `D3DirectProcess`, `F3MonitorProcess`, `BattlenetGuardRunner`; `TickDriver` only for periodic services), `Ctl/RosbotTaskProcessor`, `Ctl/RosbotFlowController` |
| `d3utils/battlenet_*`, `browser_login_*` | `Core/Battlenet/*`, `Core/BattlenetRegionDetection` |
| `d3utils/rosbot_*` (manager, operation, detection, log) | `Core/Rosbot*`, `Services/RosbotLog*`, `Services/RosbotSmartEchoCoordinator` |
| `d3utils/d3_manager`, `d3_status_provider`, `d3_start_game_and_teleport_waiter`, action groups | `Core/D3Manager`, `Ctl/D3StatusProvider`, `Core/D3ScreenState` (map teleport: CoreNodeBridge `ui_sequence`) |
| `d3utils/interface_detection`, `interface_manager`, `d3_scaled_template_matcher`, `game_window_detector` | `Core/D3InterfaceDetection`, `D3InterfaceManager`, `D3ScaledTemplateMatcher`, `GameWindowDetector` |
| `d3utils/collectors`, `slot_quality`, `debug_bag_hover`, `kanai/`, `state_aware_click_handler` | `Core/Bag/*`, `Core/Kanai/*`, `Core/StateAwareClickHandler` |
| `d3utils/macro_config_ops`, `d3u_common/hotkey_registry` | `Core/MacroSkillRunner`, `MacroFallbackRunner`, `Hotkeys/D3D4TesterHotkeyBinder` |
| `d3utils/yolo_record`, `yolo_train_flow`, `yolo_dataset_from_annotations` | dotcore `DotCore.YoloRecord`, `DotCore.VocAnnotator`, `DotCore.YoloTrain`, `DotCore.VocAnnotatorUI`; `Pages/Calibration`, `Services/YoloCalibrationData`, `Services/YoloTrainingService`, `Windows/YoloTrainingWindow` |
| `d3utils` generic helpers (screenshot, OCR, input, window, process, image) | dotcore (see progress doc) |
| `controller/game_assistant_controller`, `ctl_func/blacksmith_handler`, `login_try_screenshot_controller`, `http_bridge_controller` | `Ctl/GameAssistantController`, `Core/Blacksmith/*`, `Ctl/LoginTryController` (manual B + D) + `Core/Flow/GameLaunchProcess` (D) + `Core/Flow/D3DirectProcess` (C), `Services/D3D4TesterHttpBridge` |
| `controller/d4_controller`, `d4func/*`, `d4utils/*`, `threads/d4_extension_thread` | `Core/D4/*` (`D4Pipeline`, `D4Controller`, `D4Manager`, detectors, `D4EventManager`, `D4UiStatusUpdater`), `Ctl/D4TickLoop` |
| `d4utils/d4_battlenet_operation` (no caller in Python) | DOT-only wiring: `LoginTryController.EnsureD4RunningFromBattlenet` (D4 page "Start D4") via the shared D block + `Core/Battlenet/BattlenetGameLauncher` (tab + Play by `DetectGameUi`, shared with D3) |
| `pycore/pyutils/input/tray_clicker` (`find_and_click_tray_icon` in the D block) | dotcore `DotCore.UIInspect.TrayIconClicker`, `BattlenetManager.RestoreFromTray` |
| `threads/` (d3 extension, main function, log monitor) | `Ctl/RosbotTaskProcessor`, `Core/MainFunctionThreadRegistry`, `Ctl/CombatMacroController`, `Services/RosbotLogFileWatcher` |
| `timers/` (window monitor, one-shot tasks) | `Services/WindowMonitorService`, `RosbotDebugService`, `BattlenetUiAnalyzeService`, `RosbotUpdateManager`, `Core/PathScanner` |
| `ui/panels/*` | `Pages/{Main,Rosbot,D4,Calibration,RunLog}` |
| `ui/components/*` (title bar, bottom bar, tray, aux options, coordinate picker, record config, update info, debug window) | `Components/`, `StatusBar/`, `Services/TrayIconService`, `Windows/*` |
| `ui/theme`, `unified_styles`, `ui/widgets/basic` (themed widgets) | dotcore `DotCore.UITheme` + `Assets/Styles/` |
| `threads/task_thread_manager` + `share/values/task_status` (1 s `rosbot_task` loop) | `Core/Flow/TickDriver` (see deviations) |
| `d3utils/log_monitor_api`, `lifecycle/log_monitor`, `d3utils/rosbot_task_registry` | `Core/RosbotFlowHost` (`IRosbotFlowHost`), `Services/RosbotLogFileWatcher`, `Ctl/RosbotTaskProcessor` |
| `d3utils/rosbot_update_check` (facade), `d3utils/macro_config_provider` | `RosbotUpdateManager`, `Config/MacroConfigLoader` |
| `share/bag_data_hub` | `Core/Bag/DebugBagHover` (reads `GameInterfaceData` directly) |
| `share/values/skill_config_hotkeys`, `providor/constants/ui` | `Constants/AppConstants` (`DefaultQuickSwitchHotkey`, `TabCount`, `PopupKeyDebugWindow`) |
| `config/screenshot_categories` (`MATCH_DEBUG_DIR`) | `Core/D3InterfaceConstants.MatchDebugSubdir` |
| `ui/components/_tray_deps`, `status_item`, `status_row_config`, `ui/utils/app_root` | `Services/TrayIconService`, `MainWindow` status strip, `Ui/UiRegistry` |

## Not ported (or unused)

| Python | Reason |
|--------|--------|
| `utils/_obsolete_*`, `state/_obsolete_*`, duplicate `d3utils/*_thread.py`, `task_thread_manager` stale copy | Dead code (no live importer) |
| `d3utils/history/**`, `rosbot_history_parser`, `log_state_reader`, `log_info_organizer`, `history_*` | Dead (only `scripts/analyze_*`) |
| `collectors/ui_region_collector_anchor`, `_ultralytics`, `grid_screenshot_collector`, interface_manager `*_anchor` | Dead |
| `controller/pathfinding_controller`, `ctl_func/kanai_cube_handler`, `d4func/ocr_config`, `rosbot_flow/flow_a_entry_timer`, `flow_tm_backend`, `battlenet_button_detector` | Dead or pure re-export |
| `ui/components/menu_bar`, `status_bar`, `yolo_annotation_window`, `ui/panels/auxiliary_functions_panel`, `ui/widgets/combobox`, `ui/webview_launcher`, `ui/html`, `runtime/thread_registry` | Dead UI (never created / tab removed) |
| `scripts/*`, `athtest/*`, `train.py`, `validate.py`, `controller/training`, `config/training*`, `d4_modules/*` | Dev-only tools; YOLO training stays Python (C# `YoloTrainFlow.Flow6StartTrain` launches the Ultralytics CLI) |
| Kanai convert (`aux.kanai_convert`) | Python is a TODO stub; config/UI/debug button exist, no flow |
| GameAISDK record debug overlay window | No native equivalent; recording is native via `DotCore.YoloRecord` |
| TickDriver SIGINT guard (tick % 1), `d3utils/signal_utils` | Python-only console concern |
| `config/unified_config`, `config/grid_config` | Loaded by `config/__init__` only; no live caller (grid only by dead `pathfinding_controller`) |
| `d3utils/battlenet_capture`, `battlenet_match_debug`, `battlenet_template_matcher`, `ScreenshotCategoryManager` cleanup | Only reached from `LoginTryScreenshotController._capture_battlenet_window` / `debug_all_match_methods` / `capture_screenshot`, which have no caller |
| `d3utils/rosbot_flow/flow_d_launch_from_bn` | Re-exported by `rosbot_flow/__init__` only; D block lives in `login_try_screenshot_controller` (`LoginTryController`) |
| `threads/auxiliary_function_thread` | Idle thread that only waits for shutdown |
| `ui/utils/tk_variables`, `ui/components/bottom_bar_options_block` | tkinter-only (tk.Variable factory; per-tab empty strips); WPF binding replaces them |
| `providor/common_imports`, `providor/app_constants`, `d3utils/i18n_manager`, `d3utils/rosbot_flow_f3_history_baseline` | No live importer (`app_constants` only in `scripts/`) |
| `d4utils/d4_red_portal_detector` | Ported but unused (no caller in Python) |

## DOT deviations from Python (deliberate)

| Topic | Python | DOT |
|-------|--------|-----|
| D3 dynamic state | only `d3_disconnected` set; `d3_on_login_screen` / `d3_in_game` always False | `D3StatusProvider` maps the same one-capture template result: game tool = in game, start-game button or connecting = pre-game menu (status bar `d3_on_login_screen`) |
| D3 window geometry | on `game_data` | `GameInterfaceData.ApplyD3WindowGeometry` (no provider-private copy) |
| Flow switches | module state + mirror | `RosbotFlowState` is a view over `GameInterfaceData` (one copy) |
| BN-only toggle off | resets the flow-master B block only | also resets the BN-only B block and last result |
| Battle.net client screen state | only the on_login / disconnected / normal triple | `IBattlenetOperation.ClassifyClientState` (shared in base, login screens per CN / Asia class) via `BattlenetClientStateDetector`, probed every 10 s, shown in the status bar; live-scan fixes: sleep = sleep message text (the `announcer` group is always present), D4 tab id `game-nav-btn-Fen`, Play button has no AutomationId (name prefix), "战网" removed from loading keywords, UI region by exact ids (old substring judge read D3CN as Asia, removed) |
| Web login (B11) | `browser_login_ocr_flow` (Python browser automation: OCR + coordinate clicks; Tampermonkey userscript and OAuth callback removed) | `BrowserLoginAutomation` (UI Automation on the CN login popup and browsers; types saved credentials when the confirm page turns into a login form); OCR flow removed, Tampermonkey code removed (button, script path, OAuth bridge endpoints, status chip) |
| Battle.net guard | manual "ensure Battle.net only" button | `BattlenetGuardService` (persisted, default on, Battle.net tab + automation checkbox) -> `BattlenetGuardRunner` running `BattlenetReadyProcess` (abnormal / login timeout restarts) + global region `battlenet.region` |
| Template dir | `ROOT_DIR/images` | `SourcePaths.PythonImagesDir` (source dir stamped at build; artifacts live outside the repo), fallback app `Templates/` (ships `d4/small_map.jpg`) |
| Defaults / config | `providor/template_config.json` (contains machine paths) | `Config/default_config.json` embedded (clean defaults + Python skill defaults + DOT keys), merged into the user config at start |
| Battle.net region switch | manual | official `--setregion=CN|TW` restart (`BattlenetManager.RestartWithRegion`), enforced first by `BattlenetReadyProcess`; prompt on change in the Battle.net tab |
| Accounts | single `battlenet_*_credentials` | `battlenet_accounts.<region>` list + active mirror into `battlenet_*_credentials`; switch = account menu Log Out (live-scanned) |
| Resource monitor | — | `DotCore.Utils.SystemResourceSampler` (GetSystemTimes, GlobalMemoryStatusEx, PDH GPU counters) + `Components/ResourceMonitorBlock` on the log tab (1 s while visible) |
| Battle.net waking up | — | `RosbotRunFlow.RunE4Start` skips the ROSBOT start while `BattlenetWakingUp` |
| Full status refresh | Battle.net + D3 + ROSBOT | `RosbotTaskProcessor.RefreshAllGameStatus` also sets D4 running; RunLog "refresh game status" debug button runs it with the D3 dynamic capture and logs the center |
| `rosbot_task` status | Stop / login error set `rosbot_task` DISABLED, pausing the whole 1 s loop (flow, smart echo, inactive refresh) until start or BN-only on; 5 errors disable it | Monitoring is its own flow thread (`RosbotFlowRunner`); `TickDriver` always runs periodic services; errors are logged and the flow cycle retries |
| Removed duplicates | — | `RosbotFlowController.RunAsync` (second B/D/E path), `Ctl/BattlenetLoginCtl` (third start/login path), `RosbotFlowController.IsD3Running` (`Process` lookup), app `AnnotatorWindow` + VocAnnotator `MainWindow` (one shared `DotCore.VocAnnotatorUI` annotator), `YoloRecordBridgeClient` (Python HTTP bridge recording) |
| YOLO dataset | flow5 copies frames to images/ and trains and validates on the same images | `YoloDatasetAssembler`: configurable train/val/test split (seed, shuffle, per-class stratification), reviewed-empty images as capped negatives, unannotated frames excluded, unknown/difficult boxes reported; written to `{project}/_datasets/{stamp}` |
| YOLO training | flow6 TODO stub, fixed defaults | `YoloTrainingWindow`: environment probe (GPU, Python, torch/CUDA, Ultralytics) with recommended parameters, every Ultralytics parameter in config `yolo_training.*`, live log / epoch progress / stop, ONNX export, set as navigation model; runs in `{project}/_runs` |
| Specific training (task sets) | — | DOT-only: synthetic auto-labeled datasets from target variants pasted on scenes / common images and video frames (`DotCore.YoloTaskSet`, `TaskSetWindow`, training window "specific" mode) |
| Annotator | tk window: draw rectangles, save | Shared annotator: zoom/pan, move/resize, undo/redo, copy previous, keyboard shortcuts, filter/search, class add/rename/delete/reorder/color (propagated to every project annotation), AI pre-label with the exported ONNX, settings (`voc_annotator_config.json`) |

## Python reference copy and cross-references
- `reference/py_d3check/` is the Python reference (D4 code plus its d3-check dependencies, restored model `d4_modules/progress_bar_detector.pt`), mirroring `pyapps/d3-check` paths; source commit in `reference/py_d3check/MANIFEST.txt`. Not built or run by the app.
- C# side: each file starts with `// PY-REF: pyapps/d3-check/<path>` (or `// PY-REF: none (DOT-only)`).
- Python side: each reference `.py` carries `# DOT-REF: dotapps/d3d4tester/<path>` (or `# DOT-REF: none ...`).
