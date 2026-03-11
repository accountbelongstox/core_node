# Flow Architecture – Directory Structure and Two Flows

This document defines the flow architecture for d3-check: **exactly two flow libraries**, their directory layout, and how to avoid redundant definitions. Unify implementation against this design.

---

## 1. Two Flows Only

| Flow | Switch (flow state) | Tick entry | State / steps owner |
|------|---------------------|------------|----------------------|
| **BN-only** | `bn_only_enabled` | `tick_bn_only_flow()` | `flow_bn_only_state` + tick-level in `flow_bn_only` |
| **Flow-master** | `flow_master_enabled` | `tick_flow_master()` | `flow_master_driver` (and `extension_flow_state` for C branch) |

- **Tick entry** (`rosbot_task_processor.process_task`) calls each enabled flow: when `bn_only_enabled` runs `tick_bn_only_flow()`, when `flow_master_enabled` runs `tick_flow_master()`. **Both flows can run in the same tick** when both switches are on (order: BN-only first, then flow-master). Tick entry does not call third-party libs (Approach 3).
- **Third-party libs** (e.g. `rosbot_flow_battlenet`, providers) do not own flow switches or flow steps; they are called by the flow library and return results.

---

## 1.1 Log vs Flow: No Cross-Drive

- **Log-driven** (logs.txt change → print + events): File `LOGS_FILE_PATH` (RoS-BoT/Logs/logs.txt). **Driver**: watchdog `_LogFileEventHandler.on_modified()` → `_read_and_process_new_lines()`, or (no watchdog) `tick_driver` each 1s calls `check_logs()` → `_read_and_process_new_lines()`. **Print**: `ColorPrint.info(prefix + line)` per line. **Events**: `analyze_log_line(line)` → game_state (set_map_type, set_game_stage, set_rosbot_disconnected_from_log), login_try callback, smart_echo, vendor_loop. All in `log_monitor` + `log_analyzer`. **Does not trigger flow.**
- **rosbot_task_processor**: 1s **periodic task** only (runs tick_driver + flow). Does **not** implement log-driven; it only runs the 1s clock. Log read is delegated to log_monitor (watchdog or tick_driver calling check_logs).
- **Flow layer** (`rosbot_flow*`, `process_task`): Driven **only** by 2s tick in task thread. When flow runs it may **read** `get_last_log_modified_time()` (e.g. F3 timeout). No other coupling.

---

## 2. Target Directory Structure

```
pyapps/d3-check/
├── d3utils/
│   ├── rosbot_flow_state.py          # Global flow switches only: flow_master_enabled, bn_only_enabled (get/set/is_flow_active)
│   ├── rosbot_task_processor.py     # Tick entry: read flow_state, 2s gate, re-read; tick_bn_only_flow when bn_only, tick_flow_master when flow_master; both can run same tick
│   │
│   ├── rosbot_flow/                  # Flow libraries and their state
│   │   ├── __init__.py
│   │   │
│   │   # ---- Flow 1: BN-only ----
│   │   ├── flow_bn_only_state.py    # BN-only: all BN steps (BNStep) and all state (BNOnlyState). Single source of truth for BN block.
│   │   ├── flow_bn_only.py          # BN-only tick driver: refresh, re-read, call tick_battlenet_ready_flow, handle result (uses flow_bn_only_state)
│   │   │
│   │   # ---- Flow 2: Flow-master ----
│   │   ├── flow_master_driver.py   # Flow-master: tick driver + step enums + last-result state (F0 action, extension result, F3 result)
│   │   ├── extension_flow_state.py # Extension (C branch) phase/deadline/payload; used by flow_master_driver
│   │   ├── extension_flow_tick_step.py
│   │   ├── action_groups/         # Action groups: one step per tick; see docs/ACTION_GROUPS_DESIGN.md
│   │   │   ├── __init__.py        # Registry, ActionGroupDef, register/get
│   │   │   └── map_teleport.py    # Map teleport group (minimize -> wait 1 tick -> teleport)
│   │   │
│   │   # ---- Shared by flow-master (sub-steps, not flows) ----
│   │   ├── flow_a_entry_timer.py
│   │   ├── flow_c_d3_direct.py
│   │   ├── flow_d_launch_from_bn.py
│   │   ├── flow_e_rosbot_run.py
│   │   ├── flow_f1c_f1d.py
│   │   ├── flow_tm_backend.py
│   │
│   ├── rosbot_flow_battlenet.py     # Third-party: runs one BN step; reads/writes state via flow_bn_only_state only; returns (done, result)
│   ├── rosbot_flow_f0_entry.py
│   ├── rosbot_flow_f3_log_timeout.py
│   ├── rosbot_flow_f4_close_d3_send_f7.py
│   ├── battlenet_status_provider.py
│   ├── d3_status_provider.py
│   └── ...
```

**Module layout (naming)**: `rosbot_flow/` = flow library (tick drivers + shared state); top-level `rosbot_flow_*.py` = F-block / BN step implementations called by the flow layer. So e.g. `flow_bn_only` lives under `rosbot_flow/`, while `rosbot_flow_battlenet` is the BN block runner at d3utils root.

---

## 3. Role of Each Layer

| Layer | Responsibility | Does NOT |
|-------|----------------|----------|
| **rosbot_flow_state** | Hold `flow_master_enabled`, `bn_only_enabled`; sync to game_interface_data for UI. | Hold BN steps or flow-master steps. |
| **rosbot_task_processor** | Tick entry: read flow_state, 2s gate, re-read; call `tick_bn_only_flow()` when bn_only; call `tick_flow_master()` when flow_master; when both on, call both in same tick (BN-only first). | Call refresh/notify or any other third-party. |
| **flow_bn_only_state** | Define and hold **all** BN block steps (BNStep) and **all** BN state (BNOnlyState). Provide get/set/reset/enter_battlenet_at_b2/reset_confirmed_to_poll. | Run UI or Battle.net ops. |
| **flow_bn_only** | BN-only tick: call refresh/notify, re-read abort, call `tick_battlenet_ready_flow(no_activate=True)`, update from result (e.g. reset_confirmed_to_poll). Optionally hold tick-level step enum (REFRESH_NOTIFY, RUN_BN_TICK, …) and last BN result for logging. | Define BN block steps (those live in flow_bn_only_state). |
| **flow_master_driver** | Flow-master tick: refresh/notify, re-read abort, extension step, F0 pre-judge, b1/b2/c1, F3/F4. Define FlowMasterStep, F0Action, ExtensionStepResult; hold last F0/extension/F3 result state. | Own extension phase (that is in extension_flow_state). |
| **rosbot_flow_battlenet** | Third-party: `tick_battlenet_ready_flow(no_activate)`. Read/write **only** via flow_bn_block_state (get_current_step, set_current_step, …). Return (done, result). `reset_flow_master_bn_block()` resets Flow-master's BN block to entry; `reset_battlenet_flow_state` is deprecated alias. | Own any BN step or state; must not duplicate BNStep or BNOnlyState. |

---

## 4. Redundant Definitions to Remove or Unify

| Current | Issue | Target |
|---------|--------|--------|
| **BNStep / BNNode** | Must exist in **one** place only. | Only in `flow_bn_only_state` (BNStep; alias BNNode for compatibility). `rosbot_flow_battlenet` must not define BNNode. |
| **BN state (current_step, b5_entry_reason, wait_until, b7/b13 deadlines, ever_confirmed, b7_skip_count, …)** | Must be owned by flow library only. | Only in `flow_bn_only_state` (BNOnlyState + getters/setters). `rosbot_flow_battlenet` must use only these get/set; no local `_current_node` / `_b5_entry_reason` etc. |
| **reset_confirmed_to_poll / reset_bn_only_flow_state** | Single implementation. | Implemented in `flow_bn_only_state`. `rosbot_flow_battlenet.reset_flow_master_bn_block()` calls `reset_bn_block_state(False)` (Flow-master's BN block); `reset_battlenet_flow_state` is deprecated alias for UI/shutdown. |
| **BnOnlyStep (REFRESH_NOTIFY, RUN_BN_TICK, …)** in flow_bn_only | Tick-level steps for BN-only flow. | Either keep in `flow_bn_only` only (no duplicate in state) or move into `flow_bn_only_state` if we want “all BN-only steps” in one module. Prefer: tick-level steps stay in `flow_bn_only`; BN block steps stay in `flow_bn_only_state`. |
| **get_bn_flow_ever_confirmed / set_battlenet_tick_confirmed / get_and_clear_battlenet_tick_confirmed** | Used by flow-master and login check. | Implemented in `flow_bn_only_state`; re-export from `rosbot_flow_battlenet` for backward compatibility if needed, or callers import from `flow_bn_only_state`. |

---

## 5. File-Level Contract (Unify Logic Against This)

- **flow_bn_only_state.py**
  - Defines: `BNStep` (alias `BNNode`), `BNOnlyState`, all get/set for BN state, `reset_bn_only_flow_state`, `reset_confirmed_to_poll`, `enter_battlenet_at_b2`, `is_bn_flow_in_login_phase`, `set_battlenet_tick_confirmed`, `get_and_clear_battlenet_tick_confirmed`, `get_bn_flow_ever_confirmed` / `set_bn_flow_ever_confirmed`.
  - No calls to battlenet_manager or UI.

- **flow_bn_only.py**
  - Imports: `get_bn_only_enabled`, `refresh_battlenet_status`, `get_game_interface_data`, `tick_battlenet_ready_flow`, `reset_confirmed_to_poll` (from `flow_bn_only_state` or via battlenet).
  - Defines: tick-level step enum (optional), last BN result state (optional), `tick_bn_only_flow()`.
  - Does not define BNStep/BNNode or BN block state.

- **rosbot_flow_battlenet.py**
  - Imports: all BN state and step from `flow_bn_block_state` (BNNode, get_current_step, set_current_step, get_b5_entry_reason, set_b5_entry_reason, …).
  - Defines: `tick_battlenet_ready_flow(no_activate)`, `reset_flow_master_bn_block()` → calls `reset_bn_block_state(False)`; `reset_battlenet_flow_state` is deprecated alias.
  - Re-exports for compatibility: `reset_confirmed_to_poll`, `get_bn_flow_ever_confirmed`, `enter_battlenet_at_b2`, `set_battlenet_tick_confirmed`, `get_and_clear_battlenet_tick_confirmed` from `flow_bn_only_state` / `flow_bn_block_state` (or implement only in state and change callers to import from state).

- **flow_master_driver.py**
  - Defines: FlowMasterStep, F0Action, ExtensionStepResult, last F0/extension/F3 state, `tick_flow_master()`.
  - Uses `extension_flow_state` for phase; does not duplicate extension phase enum.

---

## 6. BN-only merge status (done)

- **flow_bn_only_state.py**: Single source of truth for BNStep (alias BNNode), BNOnlyState, and all get/set/reset/enter_battlenet_at_b2/reset_confirmed_to_poll/set_battlenet_tick_confirmed/get_bn_flow_ever_confirmed/etc.
- **flow_bn_only.py**: Imports `reset_confirmed_to_poll` from `flow_bn_only_state`; calls refresh, re-read, `tick_battlenet_ready_flow(no_activate=True)`, then `reset_confirmed_to_poll()` when result is confirmed.
- **rosbot_flow_battlenet.py**: No local BN state. All branches (B1–B13, B5, B5w) use only get/set from `flow_bn_block_state` (get_current_step, set_current_step, get_b5_entry_reason, set_b5_entry_reason, get_wait_until, set_wait_until, get_b13_poll_deadline, set_b13_poll_deadline, set_bn_flow_ever_confirmed, etc.). Defines `reset_flow_master_bn_block()` (calls `reset_bn_block_state(False)`); `reset_battlenet_flow_state` is deprecated alias. Re-exports `reset_confirmed_to_poll`, `get_bn_flow_ever_confirmed`, `enter_battlenet_at_b2`, etc. from `flow_bn_only_state` / `flow_bn_block_state` for backward compatibility.

Flow-master is handled separately; see §2–§5 for its intended layout.

---

## 7. Two flows can run simultaneously

- **Requirement**: 两个流程可以同时运行 — BN-only and Flow-master may both be enabled; in that case **both** run in the same 2s tick.
- **Tick entry behaviour**: `process_task()` re-reads `bn_only2` and `flow_master2`; if `bn_only2` it calls `tick_bn_only_flow()`; if `flow_master2` it calls `tick_flow_master(...)`. No mutual exclusion: when both are true, both are called (order: BN-only first, then flow-master).
- **Shared state**: Both flows use the same BN state (`flow_bn_only_state`). Running both in one tick means BN-only advances BN one step (e.g. ensure Battle.net), then flow-master may run extension/F0 and possibly another BN step (F0 B1 path). Design allows this; no separate “flow selector” that forces only one.

---

## 8. Summary

- **Two flows only**: BN-only (tick `tick_bn_only_flow`) and Flow-master (tick `tick_flow_master`). **Both can run in the same 2s tick** when both switches are enabled.
- **BN-only (merged)**: All BN steps and state in `flow_bn_only_state`; tick driver in `flow_bn_only`; third-party BN step runner in `rosbot_flow_battlenet` uses state only via `flow_bn_only_state`; no duplicate BN state in `rosbot_flow_battlenet`.
- **Flow-master**: Tick and step/result state in `flow_master_driver`; extension phase in `extension_flow_state`.
