# ROSBOT_FLOW_MERMAID.md Step-to-Module Index

Every flowchart step is mapped to a code module and status (Done / TODO).  
**Source of truth:** `pyapps/d3-check/docs/ROSBOT_FLOW_MERMAID.md`.

## Flow transitions (from Mermaid)

- **A3** (tick has direction) → **F0** → F1.  
  **F1** No → **B2** (has Battle.net window?). **F1** Yes → **C1** (D3 direct-connect entry).
- **B16** (Battle.net confirmed) → **D1** (launch D3 from Battle.net).
- **C8** 传送结果（流程步骤，无否分支）→ **A8** → **F2** (is ROSBOT online?).  
  **F2** No → **E1** (kill existing) → … → **E6** → **F3**. **F2** Yes → **F3** (log timeout).
- **F3** not timeout → stay F3. **F3** timeout → **F4a** → **F4b** → **B2**.
- **C12** (end D3) → **D1**.
- **D13** No → **D13b** (restart D3) → **D14** → **D14w** → **B2**. **D13** Yes → **C1**.
- **E6** → **F3**.

## A – Entry and timer

| Step | Description | Module | Status |
|------|-------------|--------|--------|
| A1 | Start ROSBOT, set state, update UI. Order: Battle.net → D3 → ROSBOT | `ui.panels.rosbot_extension_panel` (Start button) | Done |
| A2 | Global 1s timer, % for 2s drive | `d3utils.task_thread_manager` + `rosbot_task_processor` | Done |
| A3 | Total state on and this tick has direction? | `d3utils.rosbot_task_processor.process_task` | Done |
| A4 | Skip all branches | `rosbot_task_processor` (early return) | Done |
| A8 | Return success, then F2 (is ROSBOT online?) | After C8 (teleport result step, single path); leads to F2 | Done |
| A9 | Panel running, enable periodic tasks | `rosbot_extension_panel` after E6 | Done |

## B – Battle.net ready check

| Step | Description | Module | Status |
|------|-------------|--------|--------|
| B1–B16 | All B nodes | `d3utils.rosbot_flow_battlenet` | Done |
| B16 → | Next: **D1** (from Mermaid) | Controller enters D after BN confirmed | Done |

## F – Pre-judge (D3/ROSBOT online and log timeout)

| Step | Description | Module | Status |
|------|-------------|--------|--------|
| F0 | Pre-judge entry (runs F1 only in diagram; F1 No→B2, Yes→C1) | `d3utils.rosbot_flow_f0_entry` | Done |
| F1 | Is D3 online? No → B2_HasWin, Yes → C1_Entry | `d3utils.rosbot_flow_f1_d3_online` | Done |
| F1c | End D3 process (from F1d; then F_Entry) | `d3utils.rosbot_flow.flow_f1c_f1d.run_f1c_end_d3` | Done |
| F1d | Detect disconnect (from C4) → then F1c | `d3utils.rosbot_flow.flow_f1c_f1d.run_f1d_on_disconnect` | Done |
| F2 | Is ROSBOT online? (entered from **A8**). No → E1, Yes → F3 | `d3utils.rosbot_flow_f2_rosbot_online` | Done |
| F3 | ROSBOT log timeout? (also from E6). Not timeout → stay F3, timeout → F4 | `d3utils.rosbot_flow_f3_log_timeout` | Done |
| F4a | Close D3 | `d3utils.rosbot_flow_f4_close_d3_send_f7` | Done |
| F4b | Send F7 to close ROSBOT → then B2 | `d3utils.rosbot_flow_f4_close_d3_send_f7` | Done |

## C – D3 already running (direct)

| Step | Description | Module | Status |
|------|-------------|--------|--------|
| C1 | Entry | `d3utils.rosbot_flow.flow_c_d3_direct.run_c1_entry` | Done |
| C2 | Resize D3 to standard resolution | `d3utils.rosbot_flow.flow_c_d3_direct.run_c2_resize` | Done |
| C3 | Screenshot + template match | `d3_start_game_and_teleport_waiter.detect_d3_already_running_state` | Done |
| C4 | Branch on result (start / game_tool / disconnect / other) | `flow_c_d3_direct.run_c4_branch_result` + controller | Done |
| C5, C5w | Click start game, wait d3_game_tool or timeout | `d3_start_game_and_teleport_waiter.try_fragment1_*` | Done |
| C6, C7a–C8 | game_tool flow, M, teleport three clicks | `d3_start_game_and_teleport_waiter` | Done |
| C10, C10_Result | [C10a] screenshot→send M→screenshot; [C10b] similarity (M no effect = disconnect) | `check_d3_online_by_m_similarity` in run_c4_branch_result / send_m_then_teleport_three_clicks | Done |
| C12 | End D3 process → D1 | `flow_c_d3_direct.run_c12_end_d3` + controller | Done |

## D – Launch D3 from Battle.net

| Step | Description | Module | Status |
|------|-------------|--------|--------|
| D1 | Entry (also from B16_Confirmed) | `controller.login_try_screenshot_controller` | Done |
| D1 → | D4 (diagram: no D2/D3 in path; D1→D4→D4w→D5…) | Same controller | Done |
| D4, D4w, D5, D6, D6f | Activate BN, wait 1s, UI identify, has window? | Same controller | Done |
| D7–D12, D12b | Find D3 tab, Play, click, sleep 5, poll D3 10s | Same controller + `d3_start_game_and_teleport_waiter` | Done |
| D13 | D3 window found within 10s? No → D13b, Yes → C1_Entry | Same controller | Done |
| D13 Yes | C2 resize, then C3 loop + branch (same as C block; no separate start-game poll) | `_run_c3_loop_and_handle_branch` | Done |
| D13b | Restart D3 | Same controller / battlenet flow | TODO: explicit D13b step |
| D14, D14w | Restart Battle.net, wait 5s → B2 | `battlenet_manager.restart` | Done |

## E – ROSBOT run flow

| Step | Description | Module | Status |
|------|-------------|--------|--------|
| E1 | Kill existing ROSBOT | `d3utils.rosbot_flow.flow_e_rosbot_run.run_e1_kill` | Done |
| E2 | Sleep 1s | `flow_e_rosbot_run.run_e2_sleep` | Done |
| E3 | Start ROSBOT? UI updating? No/skip → E4; Yes → E3a | `flow_e_rosbot_run.run_e3_config_check` (config only); E3 “UI update” = optional zip update | Done |
| E3a | Find latest zip in download dir | — | TODO |
| E3b | Newer than current dir? Yes → E3c, No → E4 | — | TODO |
| E3c–E3f | Extract, copy config, update path, launch | — | TODO |
| E4 | Start ROSBOT process | `rosbot_manager.start` | Done |
| E5 | Task init | `rosbot_task_processor.start_rosbot` | Done |
| E5a1–E5a5 | Wait window, server, poll UI, click profile, Start botting! | `rosbot_ui_automation.run_after_rosbot_start` | Done |
| E6 | Main thread wrap-up, log → **F3** | Panel + task | Done |

## TM – Tampermonkey (with B10/B11)

| Step | Description | Module | Status |
|------|-------------|--------|--------|
| T1.1–T1.6 | URL1 wait button, server, click, wait 5s, oauth-done, close | External script; backend: `share.oauth_callback`, `d3utils.rosbot_flow.flow_tm_backend` | Done (backend) |
| T2.1–T2.3 | URL2 enter page, GET oauth-step1-received, log | External script; backend: `flow_tm_backend` | TODO: endpoint oauth-step1-received if needed |

## Code vs diagram (current behaviour)

- **F0:** Code runs **F1 only**; returns b1 (→ B2) or c1 (→ C1). F2/F3/F4 are **not** run from F0.
- **A8 → F2:** Diagram: after C8 success, go to F2. Code: (1) When C8 success happens inside **extension thread** (ensure_battlenet_started_and_login_check → D block → C block → C8), that call returns True and the same thread then runs **run_f2_rosbot_online()** (F2); if F2 returns "c1" it runs E1–E6. (2) When C8 success happens in **tick** (extension_flow_tick_step returns "success"), flow_master_driver calls trigger_extension_rosbot_started(True) and E block was already run inside C_C7b_TELEPORT; F2 is not run in tick. F3/F4 run in flow_master_driver when rosbot_extended_status in ("running", "paused"). `get_and_clear_a8_success_pending()` / set_a8_success_pending are currently unused.
- **C4 disconnect → D1:** On branch_result "disconnect", code runs F1d+F1c then falls through to [D1] Launch D3 from Battle.net (C12_EndD3 → D1_Entry per diagram).
- **B16 → D1:** Diagram says B16_Confirmed → D1_Entry. Code: after BN confirmed, `trigger_extension_rosbot_start` runs `ensure_battlenet_started_and_login_check`, which does D (or C) branch; D1 is the start of that branch. Done.
