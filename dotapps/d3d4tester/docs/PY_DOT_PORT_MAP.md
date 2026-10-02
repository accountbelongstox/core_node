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
| `d3utils/tick_driver`, `rosbot_task_processor`, `rosbot_flow/*`, `rosbot_flow_battlenet` | `Core/Flow/*` (`TickDriver`, `FlowMasterDriver`, `BattlenetReadyFlow`, `BnBlockState`, `BnOnlyFlow`, `ExtensionFlowTickStep`, F1c/F1d, F3, F4), `Ctl/RosbotTaskProcessor`, `Ctl/RosbotFlowController` |
| `d3utils/battlenet_*`, `browser_login_*` | `Core/Battlenet/*`, `Core/BattlenetRegionDetection` |
| `d3utils/rosbot_*` (manager, operation, detection, log) | `Core/Rosbot*`, `Services/RosbotLog*`, `Services/RosbotSmartEchoCoordinator` |
| `d3utils/d3_manager`, `d3_status_provider`, `d3_start_game_and_teleport_waiter`, action groups | `Core/D3Manager`, `Ctl/D3StatusProvider`, `Core/D3StartGameAndTeleport`, `Core/Flow/ActionGroups/` |
| `d3utils/interface_detection`, `interface_manager`, `d3_scaled_template_matcher`, `game_window_detector` | `Core/D3InterfaceDetection`, `D3InterfaceManager`, `D3ScaledTemplateMatcher`, `GameWindowDetector` |
| `d3utils/collectors`, `slot_quality`, `debug_bag_hover`, `kanai/`, `state_aware_click_handler` | `Core/Bag/*`, `Core/Kanai/*`, `Core/StateAwareClickHandler` |
| `d3utils/macro_config_ops`, `d3u_common/hotkey_registry` | `Core/MacroSkillRunner`, `MacroFallbackRunner`, `Hotkeys/D3D4TesterHotkeyBinder` |
| `d3utils/yolo_record`, `yolo_train_flow`, `yolo_dataset_from_annotations` | dotcore `DotCore.YoloRecord`, `DotCore.VocAnnotator`; `Pages/Calibration`, `Services/YoloCalibrationData` |
| `d3utils` generic helpers (screenshot, OCR, input, window, process, image) | dotcore (see progress doc) |
| `controller/game_assistant_controller`, `ctl_func/blacksmith_handler`, `login_try_screenshot_controller`, `http_bridge_controller` | `Ctl/GameAssistantController`, `Core/Blacksmith/*`, `Ctl/LoginTryController` + `Ctl/D3ConnectC3Flow`, `Services/D3D4TesterHttpBridge` |
| `controller/d4_controller`, `d4func/*`, `d4utils/*`, `threads/d4_extension_thread` | `Core/D4/*` (`D4Pipeline`, `D4Controller`, `D4Manager`, detectors, `D4EventManager`, `D4UiStatusUpdater`), `Ctl/D4TickLoop` |
| `d4utils/d4_battlenet_operation` (no caller in Python) | DOT-only wiring: `LoginTryController.EnsureD4RunningFromBattlenet` (D4 page "Start D4") via the shared D block + `D4Pipeline.LaunchFromBattlenet` |
| `pycore/pyutils/input/tray_clicker` (`find_and_click_tray_icon` in the D block) | dotcore `DotCore.UIInspect.TrayIconClicker`, `BattlenetManager.RestoreFromTray` |
| `threads/` (d3 extension, main function, log monitor) | `Ctl/RosbotTaskProcessor`, `Core/MainFunctionThreadRegistry`, `Ctl/CombatMacroController`, `Services/RosbotLogFileWatcher` |
| `timers/` (window monitor, one-shot tasks) | `Services/WindowMonitorService`, `RosbotDebugService`, `BattlenetUiAnalyzeService`, `RosbotUpdateManager`, `Core/PathScanner` |
| `ui/panels/*` | `Pages/{Main,Rosbot,D4,Calibration,RunLog}` |
| `ui/components/*` (title bar, bottom bar, tray, aux options, coordinate picker, record config, update info, debug window) | `Components/`, `StatusBar/`, `Services/TrayIconService`, `Windows/*` |
| `ui/theme`, `unified_styles` | dotcore `DotCore.UITheme` + `Assets/Styles/` |

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
| TickDriver SIGINT guard (tick % 1) | Python-only console concern |
| `d4utils/d4_red_portal_detector` | Ported but unused (no caller in Python) |

## DOT deviations from Python (deliberate)

| Topic | Python | DOT |
|-------|--------|-----|
| D3 dynamic state | only `d3_disconnected` set; `d3_on_login_screen` / `d3_in_game` always False | `D3StatusProvider` maps the same one-capture template result: game tool = in game, start-game button or connecting = pre-game menu (status bar `d3_on_login_screen`) |
| D3 window geometry | on `game_data` | `GameInterfaceData.ApplyD3WindowGeometry` (no provider-private copy) |
| Flow switches | module state + mirror | `RosbotFlowState` is a view over `GameInterfaceData` (one copy) |
| BN-only toggle off | resets the flow-master B block only | also resets the BN-only B block and last result |
| Battle.net client screen state | only the on_login / disconnected / normal triple | `IBattlenetOperation.ClassifyClientState` (shared in base, login screens per CN / Asia class) via `BattlenetClientStateDetector`, probed every 10 s, shown in the status bar; live-scan fixes: sleep = sleep message text (the `announcer` group is always present), D4 tab id `game-nav-btn-Fen`, Play button has no AutomationId (name prefix), "战网" removed from loading keywords, UI region by exact ids (old substring judge read D3CN as Asia, removed) |
| Battle.net waking up | — | `RosbotRunFlow.RunE4Start` skips the ROSBOT start while `BattlenetWakingUp` |
| Full status refresh | Battle.net + D3 + ROSBOT | `RosbotTaskProcessor.RefreshAllGameStatus` also sets D4 running; RunLog "refresh game status" debug button runs it with the D3 dynamic capture and logs the center |
| Removed duplicates | — | `RosbotFlowController.RunAsync` (second B/D/E path), `Ctl/BattlenetLoginCtl` (third start/login path), `RosbotFlowController.IsD3Running` (`Process` lookup) |

## Python reference copy and cross-references
- `reference/py_d3check/` is the Python reference (D4 code plus its d3-check dependencies, restored model `d4_modules/progress_bar_detector.pt`), mirroring `pyapps/d3-check` paths; source commit in `reference/py_d3check/MANIFEST.txt`. Not built or run by the app.
- C# side: each file starts with `// PY-REF: pyapps/d3-check/<path>` (or `// PY-REF: none (DOT-only)`).
- Python side: each reference `.py` carries `# DOT-REF: dotapps/d3d4tester/<path>` (or `# DOT-REF: none ...`).
