# ROSBOT Update and UI Logic

Logic document for: ROSBOT update triggers, update flow, UI data sources (ROSBOT status, game area, current state), and how they are displayed in the UI. Entry point: `main.py` → D3MacroController → ROSBOT panel / timers / game_interface_data.

---

## 1. ROSBOT Update: Triggers and Flow

### 1.1 Who Triggers ROSBOT Update

| Trigger | Where | What happens |
|--------|--------|---------------|
| **User clicks "Update ROSBOT"** | `RosbotExtensionPanel._update_rosbot()` | `timer_manager.submit_one_shot(lambda: do_rosbot_update(self))`. Runs in timer thread. |
| **Path scan (one-click or auto)** | `do_path_scan(..., include_rosbot=True)` in `one_shot_tasks.py` | After scan completes, calls `do_rosbot_update(panel, silent=True)` (no dialog; apply if update found). |
| **Login check (flow E-block)** | Flow E3 via `run_e3_update_flow` in `flow_e_rosbot_run.py` | When starting ROSBOT and BN region is asia/cn: `run_rosbot_update_check()` → if newer zip and not auto: `ask_yes_no_on_main_thread`; if yes or auto: `apply_rosbot_update`. |
| **F2 → E-block pending** | When F2 returns “ROSBOT not online”, `set_e_block_after_f2_pending()`; panel sync consumes it | Panel `_sync_status_ui_once` / state callback can submit `do_rosbot_update` when E-block-after-F2 is pending (implementation may wire this to a dedicated path). |

So: **direct trigger** = “Update ROSBOT” button or path scan; **indirect** = flow E3 (login/start ROSBOT) or E-block-after-F2.

### 1.2 Update-Only Flow (do_rosbot_update)

- **Entry**: `timers/one_shot_tasks.do_rosbot_update(panel, silent=False)`.
- **Runs in**: Timer thread (one-shot).
- **Steps (logic only)**:
  1. **E1**: Kill existing ROSBOT process (`run_e1_kill()`).
  2. **E2**: Sleep 1s (`run_e2_sleep(1.0)`).
  3. **Region**: `get_rosbot_update_manager().get_battlenet_region()`; if asia/cn, optionally check both regions (config `check_both_regions_for_update`); build `regions_to_check` (Asia first).
  4. **Current state**: `get_current_ros_dir_info()` (path, ctime, version); `get_downloads_dir()`.
  5. **Find update**: For each region, `get_best_newer_zip(region)`; if none newer, collect `detection_per_region` (candidates, versions) for “no update” UI.
  6. **No update**: If no `best_update`, and not `silent`: show `RosbotUpdateInfoPanel.show_no_update_info(detection_data)` on main thread; then `run_e6_done()`, `_rosbot_update_done(panel)` and return.
  7. **Confirm (non-silent)**: Show `RosbotUpdateInfoPanel.show_update_available(...)` on main thread; wait user Yes/No. If No or timeout → E6, `_rosbot_update_done`, return.
  8. **Already on disk**: If `update_manager.target_already_has_version(best_region, version_str, zip_path)`: update config `ros_settings.ros_directory` to final dir, clear `rosbot_manager` cache, E6, `_rosbot_update_done`, return.
  9. **Apply**: `update_manager.apply_update(zip_path, best_region, version_str)` (extract, copy RoS-BoT.ini, set `ros_settings.ros_directory`, clear cache); then E6, `_rosbot_update_done`.

### 1.3 After Update (_rosbot_update_done)

- `refresh_rosbot_status()` (update game_interface_data with current ROSBOT detection).
- `get_game_interface_data().notify_state_sync()` (no direct cross-thread after; UI will see state on next main-thread poll).
- Update UI bindings for `ros_settings.ros_directory` (ConfigBinding).
- On main thread: `_update_rosbot_button_if_exists(panel)`, `panel._refresh_path_icons()` (bottom bar BN/D3/ROS icons and ROS version text).

So: **update logic** is in `rosbot_update_manager` + `one_shot_tasks.do_rosbot_update`; **trigger** = button or path scan (or flow E3 / E-block); **UI refresh after update** = status refresh + state sync + path icons + control button.

---

## 2. UI Data: Sources and Meaning

All **ROSBOT-related UI data** and **game area / current state** come from a single shared object: **`share.game_interface_data.get_game_interface_data()`** (D3InterfaceData). Flow and status providers **write**; UI and controllers **read** (or register callbacks that receive a snapshot).

### 2.1 ROSBOT State (Written by Flow + Status Provider)

| Field | Written by | Meaning |
|-------|------------|--------|
| `rosbot_flow_master_enabled` | `rosbot_flow_state.set_flow_master_enabled()` | True = user started ROSBOT (flow runs); False = stopped. |
| `ensure_battlenet_only_master_enabled` | `rosbot_flow_state.set_bn_only_enabled()` | True = “Ensure Battle.net only” (tick runs BN block only). |
| `rosbot_extended_status` | `rosbot_status_provider.refresh_rosbot_status()` → `game_data.set_rosbot_extended_status(status)` | `not_found` \| `running` \| `paused`. running = process, no visible window; paused = has window. |
| `rosbot_window_found` | Same; derived as `status == "paused"`. | True when ROSBOT has a visible window. |
| `rosbot_has_main_ui` | Same; `set_rosbot_has_main_ui(has_main_ui)`. | True when paused (any visible UI). |
| `rosbot_found_exe_name`, `rosbot_found_window_title` | Same; `set_rosbot_found_display(exe_name, window_title)`. | For status bar “process: xxx title: xxx”. |
| `rosbot_need_key_input`, `rosbot_need_key_message` | Same; `set_rosbot_ui_need_key(need_key, message)` from `get_rosbot_operation().get_ui_state(pids)`. | Need-key hint (e.g. bottom bar). |
| `rosbot_test_mode_display` | Flow/tick when test_mode on. | One line for test elapsed/timeout/record. |
| `rosbot_total_restart_count` | Flow/tick. | Total restart count (all types). |
| `rosbot_disconnected_from_log` | Log analyzer. | ROSBOT disconnection from log text. |

**Single writer for detection**: `refresh_rosbot_status()` uses `get_rosbot_manager().get_rosbot_detection()` and then updates the above fields; no other code should write these from detection.

### 2.2 Game Area / Current State (D3, Battle.net, Map, Stage)

| Field | Meaning |
|-------|--------|
| `battlenet_window_found`, `battlenet_region` | BN window and region (asia/cn). |
| `battlenet_on_login_screen`, `battlenet_disconnected`, `battlenet_normal_available` | BN dynamic state. |
| `d3_running` | D3 window detected. |
| `d3_on_login_screen`, `d3_disconnected`, `d3_in_game` | D3 dynamic state. |
| `map_type` | town, greater_rift, rift, unknown. |
| `game_stage` | gem_upgrade, kill_boss, back_town, in_greater_rift, in_rift, unknown. |

These are written by `battlenet_status_provider`, `d3_status_provider`, and flow/tick logic; UI reads them via **state snapshot** passed to callbacks.

### 2.3 How UI Gets Updates (Main Thread Only)

- **game_interface_data** runs a **main-thread poll**: `start_main_thread_poll(after_fn, interval_ms)` (e.g. 100 ms). Each tick it calls `get_state_snapshot()` and invokes all **registered callbacks** with that snapshot on the main thread.
- **Registration**: Controller calls `panel.set_register_status_ui_fn(lambda: window_monitor.register_status_ui(panel.get_status_ui_callback()))`. When ROSBOT panel content is created, it calls this; `register_status_ui` does `get_game_interface_data().register_callback(callback)`. The panel’s callback is `_on_game_state_changed(state)` → `_update_ui_from_state(state)`.
- So: **UI data** = snapshot from `game_interface_data`; **when** = every poll interval on main thread; **no** direct cross-thread `after()` from status providers (they only write; poll drains and notifies).

---

## 3. Status Refresh Triggers (When Does ROSBOT/BN/D3 State Get Refreshed?)

- **run_full_status_refresh()** (in `rosbot_task_processor`):
  - If BN-only and not flow_master: only `refresh_battlenet_status()`, then `notify_state_sync()`; returns None.
  - Else: `refresh_battlenet_status()`, `refresh_d3_status(skip_dynamic=True)`, **`refresh_rosbot_status()`**, then `notify_state_sync()`; returns D3 window info.
- **Who calls run_full_status_refresh**:
  - **do_window_monitor_initial_check** (one-shot): full refresh at startup (or after “manual refresh”).
  - **refresh_window_status_if_inactive()** (window_monitor): at most once when flow is “inactive” (e.g. startup), then `mark_inactive_refresh_done()` so it is idempotent.
  - **Panel _request_status_refresh()**: submits `do_window_monitor_initial_check` (one-shot). Used after Start/Stop ROSBOT, Ensure Battle.net toggle, or manual refresh.

So: **ROSBOT status** is refreshed when:
- Startup / initial check,
- Once when “inactive” (window_monitor),
- After flow/ensure_bn toggle or manual refresh,
- Inside **process_task** when flow_master and BN flow ever confirmed (refresh_rosbot_status in the same refresh sequence).

After **do_rosbot_update**, `_rosbot_update_done` calls `refresh_rosbot_status()` and `notify_state_sync()` so the next main-thread poll sees updated state.

---

## 4. UI Display: Where Each Piece Is Shown

### 4.1 Bottom Bar (Shared Status Row)

- **BottomBar** holds status vars: `battlenet_status`, `battlenet_region`, `ros_status`, `ros_found_status`, `d3_status`, `map_status`, `stage_status`, `oauth_status`, `test_mode_status`, `window_size`.
- **update_status_from_state(state)** is the state callback (same snapshot as ROSBOT panel). It:
  - Sets **BN** text and color from `battlenet_window_found`, `battlenet_region`, `battlenet_*` dynamic flags.
  - Sets **ROS** from `rosbot_extended_status` and `rosbot_total_restart_count`: shows `[R{count}]` if count > 0, else "-"; color by running/paused/not_found.
  - Sets **D3** from `d3_running` and `d3_*` dynamic flags.
  - Sets **map** / **stage** from `map_type`, `game_stage`.
  - Sets **oauth** from `oauth_script_connected` (if present in state).
  - Sets **test_mode** row from `rosbot_test_mode_display` when `rosbot.test_mode` is on.
  - Calls **refresh_path_icons()**: BN/D3/D4/ROS icons (and ROS version from `_ros_version_display_from_update_logic()`).

So: **ROSBOT status** in the bar = extended status + restart count; **game area** = map_type + game_stage; **current state** = BN/D3 dynamic + ROS running/paused/not_found. All from **state** snapshot.

### 4.2 ROSBOT Extension Panel

- **Control button (Start/Stop)**: From `game_state.rosbot_flow_master_enabled`; `_update_control_button()` sets text and color (Start green / Stop red). Syncs `rosbot_running` from `rosbot_flow_master_enabled`.
- **Ensure Battle.net button**: From `game_state.ensure_battlenet_only_master_enabled`; `_update_ensure_battlenet_button()` sets text (on/off).
- **Log area**: ColorPrint callback `add_log_message`; filters by `[ROSBOT]`, `[PathScan]`, `LogAnalyzer`. Log status/latency labels updated by `_update_rosbot_log_status_display()` (last log time, optional latency).
- **Path icons**: Panel calls `_refresh_path_icons()` which delegates to `bottom_bar.refresh_path_icons()` (same BN/D3/ROS/D4 and ROS version as above).
- **need_key**: Documented as shown in bottom bar status row (from `rosbot_need_key_input` / `rosbot_need_key_message` in state).

Panel does **not** duplicate the full status row; it only updates control/ensure-BN buttons and log. The **single status row** is in the bottom bar and is updated from the same **state** via `update_status_from_state(state)`.

### 4.3 Summary Table

| Data | Source (writer) | Shown in UI |
|------|------------------|-------------|
| ROSBOT update trigger | User / path scan / flow E3 | Button “Update ROSBOT”; path scan result. |
| rosbot_flow_master_enabled | flow_state | Panel: Start/Stop button text and color. |
| ensure_battlenet_only_master_enabled | flow_state | Panel: Ensure Battle.net button text. |
| rosbot_extended_status, rosbot_total_restart_count | refresh_rosbot_status | Bottom bar: ROS column (e.g. [R{n}] or "-") and color. |
| rosbot_need_key_* | refresh_rosbot_status → set_rosbot_ui_need_key | Bottom bar (need-key hint). |
| rosbot_test_mode_display | Tick when test_mode on | Bottom bar: test mode row. |
| map_type, game_stage | Status/tick | Bottom bar: map, stage. |
| battlenet_* / d3_* | BN/D3 status providers | Bottom bar: BN, D3, region. |
| ROS path / version | rosbot_update_manager + path config | Bottom bar: ROS path icon + version (e.g. Asia_36.0129). |

---

## 5. Data Flow Summary

1. **Update path**: User or path scan or flow → `do_rosbot_update` (timer thread) → E1/E2/E3…/E6 → `_rosbot_update_done` → `refresh_rosbot_status` + state sync + main-thread button/path refresh.
2. **Status path**: Timer or flow calls `run_full_status_refresh()` or BN-only refresh → `refresh_battlenet_status` / `refresh_d3_status` / `refresh_rosbot_status` → write `game_interface_data` → main-thread poll calls registered callbacks with snapshot → **BottomBar.update_status_from_state(state)** and **RosbotExtensionPanel._update_ui_from_state(state)** (which updates bar + ensure-BN + control button).
3. **Single source of truth for UI**: `game_interface_data.get_state_snapshot()`; all status and game-area display derive from this snapshot on the main thread.

No code changes in this document; it only describes the existing logic.

---

## 6. Dot (d3check) differences

- **Drive model**: Python is tick/timer-driven (timer_manager.submit_one_shot, flow ticks). Dot uses **wait-based** execution: one-click scan runs on a thread pool task and awaits completion; no central timer loop.
- **One-click scan**: Bottom bar "One-Click Scan" runs `PathScanner.ScanForPaths(..., includeRosbot: true, forceScanRosbot: true)` on a background task. After scan: CONFIG is updated (battlenet_path, d3_path, ros_settings.ros_directory), `QueueSave()` is called, bottom bar status and Rosbot panel path fields are refreshed. **Dot does not yet run ROSBOT update after scan** (no `do_rosbot_update(silent)` equivalent); path scan + CONFIG update only.
- **Bottom bar status**: Three status items (Battle.net, D3, ROSBOT) use **DotCore.Common.StatusDisplaySymbols** (Found / NotFound) from the public lib; **DotCore.D3Check.D3StatusSymbols** uses those and adds labels + `FormatStatus()` for the d3 sub-lib. Same [PathScan] log tag; ColorPrinter in PathScanner feeds Log tab when callback is registered.
- **Config**: D3CheckConfigService loads/saves `d3check_config.json`; one-click scan writes paths and queues a single coalesced save.
