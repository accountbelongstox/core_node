# main.py → ROSBOT Login Logic (1:1 Mapping)

## Entry from main.py

- **main.py** `main()`:
  - `get_system_initializer().initialize_system(gui_mode=True)` → no ROSBOT yet
  - `D3MacroController()` → in `__init__` calls `register_login_controller_actions(ensure_battlenet_started_and_login_check, ensure_d3_running_from_battlenet_no_rosbot, ensure_battlenet_only)` from `controller.login_try_screenshot_controller`
  - `controller.run()` → creates `Diablo3MacroUI`, wires panels, **`get_thread_registry().create_extension_threads(...)`** which registers E-block and flow; **timer 1s tick** runs `rosbot_task_processor.process_rosbot_task()` which drives F0/F1/B/C/D/E

So **ROSBOT “login”** is not a single function in main.py; it is the **flow** triggered by:
1. **Start ROSBOT** (UI) → flow master on → **A1e** → **F0** → **F1** (D3 online?) → **B** (Battle.net ready) → **D** (launch D3 from BN) → **E** (start ROSBOT process, then E5/E5a wait window + run_after_rosbot_start).
2. **ensure_battlenet_started_and_login_check** (one-shot): BN + login (Asia fill/submit, CN agree+NetEase+click Login) until BN normal_available; can run from panel or from flow when B block needs login.
3. **ensure_d3_running_from_battlenet_no_rosbot** (one-shot): if D3 disconnected or not online, launch D3 from BN only (no ROSBOT start).
4. **ensure_battlenet_only** (one-shot): BN only (login/ready), no D3/ROSBOT.

## Key Python modules (1:1 with DOT)

| Python | DOT |
|--------|-----|
| `controller.login_try_screenshot_controller` (ensure_battlenet_started_and_login_check, ensure_d3_running_from_battlenet_no_rosbot, ensure_battlenet_only) | `Ctl.RosbotFlowController` (B block, D block), `BattlenetLoginCtl` |
| `timers.one_shot_tasks` (register_login_controller_actions, do_path_scan, do_login_check, E block run_e1_kill…run_e6_done) | `Ctl.RosbotFlowController.RunAsync` (B/D/E), E block in same controller |
| `d3utils.rosbot_operation` (get_rosbot_operation, RosbotOperation: get_window, activate_window, run_after_rosbot_start, resume_rosbot, get_ui_state) | `Core.IRosbotOperation` / `Core.RosbotOperation`, `RosbotStatusProvider.GetRosbotOperation()` |
| `d3utils.rosbot_status_provider` (refresh_rosbot_status → GetDetection, set_rosbot_extended_status, set_rosbot_ui_need_key from get_ui_state) | `Ctl.RosbotStatusProvider.Refresh()` + `GetRosbotOperation().GetUiState()` → `GameInterfaceData.SetRosbotUiNeedKey` |
| `providor.constants.d3` (TAB_MAIN_PROFILE_NAMES, START_BUTTON_NAMES, START_BUTTON_AUTOMATION_ID, UI_OPERATION_DELAY, MAIN_UI_POLL_*, ROSBOT_LOG_TIMEOUT_MINUTES_DEFAULT) | `Core.RosbotConstants` (TabMainProfileNames, StartButtonNames, StartButtonAutomationId, UiOperationDelaySec, MainUiPollTimeoutSeconds, MainUiPollIntervalSeconds, RosbotLogTimeoutMinutesDefault) |
| `d3utils.rosbot_ui_structure` (BTN_START, profileTab, masterProfilePage, grpMasterProfile, TAB_ITEM_MAIN name_candidates) | `Core.RosbotConstants` (StartButtonAutomationId, ProfileTabAutomationId, MasterProfilePageAutomationId, GrpMasterProfileAutomationId, TabMainProfileNames) |
| `docs/rosbot_ui_elements_1.json` (KEY dialog: window title "Error", "Please, enter a key") | `Core.RosbotConstants` (KeyDialogWindowTitleDefault, KeyDialogPromptSubstring, RosbotNeedKeyMessageFallback) |

## Flow diagram reference

- **ROSBOT_FLOW_MERMAID.md** – A/B/F/D/E blocks and B10/B11 (CN/Asia login, browser).
- **ROSBOT_FLOW.md** – Step index and text description.

## DOT usage

- **RosbotFlowController.RunAsync()**: F1 → B block (BN login) → D block (launch D3) → E block (start ROSBOT exe).
- **RosbotStatusProvider.Refresh()**: GetDetection → GameInterfaceData (status, has_main_ui, found display) + **GetRosbotOperation().GetUiState()** → SetRosbotUiNeedKey.
- **IRosbotOperation**: GetWindow, ActivateWindow, RunAfterRosbotStart (stub), ResumeRosbot (stub), GetUiState (KEY dialog by window title per PID).
