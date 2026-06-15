# DOT d3check Entry and Data Architecture 1:1 with Python main.py

This document aligns **dotnet run --project dotapps/d3check/d3check.csproj** with **python pyapps/d3-check/main.py** by logic (not code), and states **data centralization** and **multi-app / sub-app** structure per [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md) and [PYCORE_PYAPPS_STRUCTURE.md](../../../development-guides/PYCORE_PYAPPS_STRUCTURE.md).

---

## 1. Entry 1:1 (logic)

| Step | Python (main.py) | DOT (d3check) |
|------|------------------|---------------|
| Parse CLI | `_parse_args()`: --http-bridge-only, --host, --port | N/A (GUI-only app; no CLI mode). |
| Branch | `main()`: if http_bridge_only → _run_bridge_only else _run_gui_and_bridge | App_Startup: single path (GUI). |
| Load config | (inside _run_*) sys_init.initialize_system → config loaded via runtime | App_Startup: `D3CheckConfigService.Instance.Load()`. |
| System init | get_system_initializer().initialize_system(gui_mode=True) | Implicit: config load; MainWindow.OnLoaded wires paths, hotkeys, i18n. |
| i18n | i18n_manager.load_language_from_config() | MainWindow.OnLoaded: D3CheckI18n.EnsureInitialized(); language combo from provider. |
| Main controller / UI | D3MacroController(); HTTPBridgeController.start(); controller.run() | MainWindow created and shown; no HTTP bridge (DOT is native client). |
| Keep-alive loop | controller.run() = Tk mainloop | WPF Application.Run() (message loop). |
| Periodic tick | Timers inside controller / task_thread_manager | MainWindow: _statePollTimer (100 ms), _bnOnlyFlowTimer (2 s when EnsureBattlenetOnlyEnabled). |
| Exit | KeyboardInterrupt / exception → bridge_controller.stop() | App_Exit: D3CheckConfigService.Instance.FlushPendingSave(). |

**Summary:** DOT GUI entry = Load config → Show MainWindow → WPF message loop + timers. No bridge-only mode; no Tk. Data and flow semantics match Python where applicable.

---

## 2. Data centralization

| Concept | Python | DOT |
|---------|--------|-----|
| Config (keys, persistence) | providor (load_config, queue_config_save), CONFIG, get_config_value_safe | D3CheckConfigService.Instance (Load, GetValueSafe, SetValueAsync, QueueSave, FlushPendingSave). ConfigKeys constants. |
| Game / BN / ROSBOT state | share/game_interface_data (get_game_interface_data), snapshot, callbacks | GameInterfaceData.Instance, GetStateSnapshot(), RegisterCallback, NotifyCallbacks, SetMarshalToUi. |
| Paths / region | providor.app_constants, ros_settings.*, battlenet_region_cache | ConfigKeys (RosSettingsRosDirectory, BattlenetPath, D3Path, RosSettingsBattlenetRegionCache). BattlenetRegionDetection; GameInterfaceData.SetBattlenetRegion. |
| Credentials | share/asia_credentials, battlenet_*_credentials in config | AsiaCredentialsService (GetCredentials, SaveCredentials, LoadCredentialsForUi). ConfigKeys.BattlenetAsiaCredentials etc. |

All config and shared app state go through the above; no duplicate stores. See [CREDENTIALS_AND_REGION_PY_DOT_1TO1.md](CREDENTIALS_AND_REGION_PY_DOT_1TO1.md) for credentials and region.

---

## 3. Multi-app shared lib vs sub-app lib

| Layer | Python | DOT |
|-------|--------|-----|
| Public class libraries | pycore/ (pyfoundations, pyutils, …) | dotcore/ (DotCore.Foundations, DotCore.Utils, DotCore.UIInspect, …). |
| Sub-app library | pyapps/d3-check/: controller, d3utils, providor, share, ui, … | dotapps/d3check/: Ctl/, Config/, Panels/, D3CheckCore/, … . **D3CheckCore** = sub-app lib (path scanner, GameInterfaceData, Battlenet ops, RosbotOperation). |
| App entry | pyapps/d3-check/main.py | dotapps/d3check/ App.xaml.cs + MainWindow. |
| Dependency rule | App uses pycore; app does not use another pyapps app. | App references dotcore and D3CheckCore; D3CheckCore references only dotcore. No app-to-app refs. |

Canonical: [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md), [PYCORE_PYAPPS_STRUCTURE.md](../../../development-guides/PYCORE_PYAPPS_STRUCTURE.md), [.cursor/rules/dot.mdc](../../../.cursor/rules/dot.mdc). **UI layer:** canonical spec [DOT_ARCHITECTURE.md](../../../development-guides/DOT_ARCHITECTURE.md), [.cursor/rules/dot-ui.mdc](../../../.cursor/rules/dot-ui.mdc).

---

## 4. Run commands

- Python GUI: `python .\pyapps\d3-check\main.py`
- DOT GUI: `dotnet run --project dotapps\d3check\d3check.csproj`

Both start the GUI, load config, show the main window, and keep the process running with an event loop (Tk vs WPF) plus periodic timers.
