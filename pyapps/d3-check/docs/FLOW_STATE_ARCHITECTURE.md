# Flow State Architecture

This project organizes tick-driven flows and state under a single set of rules, for all timer-driven, multi-step, multi-branch flows (e.g. ROSBOT flow master, BN-only, future extensions).

---

## 1. Three Principles

| Principle | Meaning |
|-----------|---------|
| **Flow library defines and holds state** | Flow switches, current step, branch state, etc. are defined and stored only in the flow library; UI, timer, and other modules read/write via the flow library API. No parallel source of truth. |
| **Other libraries have no flow state switches** | Modules called by the flow (detection, refresh, one step of a sub-flow) do not hold or read "is this flow enabled"; they only expose "run once / one step and return result" (bool or explicit type). |
| **Tick only drives the flow library** | Timer/task thread calls only the flow’s tick entry; the flow decides internally whether to run this tick, which step to run, and which other libraries to call. |

---

## 2. Approach 3: Flow library as sole caller of third-party libs

**Approach 3** (current): The tick entry does **not** call third-party libraries (e.g. refresh, notify). Only the **flow library** calls third-party libraries.

- **Tick entry** (`process_task`): Reads flow state, applies 2s gate, re-reads flow state; then calls each enabled flow: `tick_bn_only_flow()` when bn_only, `tick_flow_master(...)` when flow_master. **Both can run in the same tick** when both switches are on (BN-only first, then flow-master). No refresh/notify in the tick entry itself.
- **Flow library** (e.g. `flow_bn_only`, `flow_master_driver`): Performs refresh/notify (calls providers), re-reads flow state (abort if user turned off), then runs its steps and calls further third-party libs; updates its own state from return values.

So: **Timer → flow tick entry → flow library → third-party libs**. Third-party libs are never invoked from the tick entry.

---

## 3. Roles

| Role | Responsibility | State | Driven by |
|------|----------------|-------|-----------|
| **Flow library** | Defines and holds flow state; decides whom to call this tick; updates state and step from callee return values; exposes get/set API to UI and timer. | **Sole owner** of flow switches and step state. | **Only by tick** (timer calls flow tick entry). |
| **Third-party / other libs** | Run concrete actions (detection, refresh, one sub-step); do not hold flow switches; return explicit results. | **No** flow-level state. | **Only called by the flow library**. |
| **Tick scheduler** | Calls the flow library tick entry at a fixed interval; does **not** call other libs’ business APIs. | Scheduler state only (e.g. task enabled); flow state decides real work. | Timer / TaskThreadManager. |
| **UI** | After user action, talks only to the flow library (set/clear switches, read state for display); sets task enabled/disabled from flow state. | Does not hold flow state; only reads/writes flow library. | User events. |

---

## 4. State ownership

- **Flow switches** (e.g. “flow master”, “BN-only”): Defined and stored only in the flow library; may be mirrored to `game_interface_data` for UI/callbacks; **single write path** (only the flow library writes).
- **Step / node** (current phase, sub-flow node, wait count): Held by the flow library or its state module; updated inside the flow from other libs’ return values.
- **Detection / display data** (e.g. window found, state enum): May be written by other libs into shared structures for UI; this is **not** a flow switch and does not affect “is this flow running”; the flow decides whom to call from its own switches and step only.

---

## 5. Call graph (Approach 3)

```
Timer / TaskThread
    → calls only process_task() (tick entry)
            ↓
process_task: read flow_state, 2s gate, re-read flow_state
            ↓
    if not active: return
    if bn_only:  tick_bn_only_flow()
    if flow_master: tick_flow_master(tick_count, start_rosbot_task)
    # When both true, both run in same tick (BN-only first).
            ↓
Flow library (e.g. tick_bn_only_flow / tick_flow_master):
    → calls third-party libs (refresh_battlenet_status, refresh_d3_status, notify_state_sync, …)
    → re-reads flow state (abort if user turned off)
    → runs steps, calls more third-party libs, updates state from return values
```

- **Tick entry** does not call refresh/notify or any other third-party business APIs.
- **Other libs** do not read or write flow switches; they are only called by the flow library.
- **Flow library** is the only place that, from “flow switch + current step”, decides “call whom, with what args”, and updates step/state from return values.

---

## 6. Return value contract

Interfaces called by the flow should return **explicit results** so the flow can update state and step:

| Return type | Example use |
|-------------|-------------|
| `bool` | Success/failure, condition met |
| `Literal["a","b","c"]` | Branch id (e.g. "b1"/"c1") |
| `Tuple[bool, str]` | (done, result_code) |
| `"idle"|"running"|"success"|"fallthrough"` | State machine step result |

The flow library updates step and decides next call inside the flow; callees do not branch on global flow switches.

---

## 7. Adding or extending a flow

- **State**: Define new switch and step in the flow library (or its state module); expose only via get/set/is_active API.
- **Tick**: Timer calls only the flow tick entry; entry reads its state and returns if inactive.
- **Other libs**: New detection/step modules only “run and return result”; they do not read or write flow switches.
- **UI**: Only calls flow library set/get; sets task enabled from flow state and updates buttons/labels.

---

## 8. Mapping to this codebase

| Concept | Implementation |
|---------|----------------|
| Flow state | `d3utils/rosbot_flow_state.py` (flow_master, bn_only); step state in `rosbot_flow_battlenet`, `extension_flow_state`, etc. |
| Tick entry | `rosbot_task_processor.process_task()`; called every 1s when rosbot_task ENABLED. Calls `tick_bn_only_flow()` when bn_only, `tick_flow_master()` when flow_master; **both can run in same tick** when both on. |
| Flow libraries | `d3utils/rosbot_flow/flow_bn_only.py` (tick_bn_only_flow), `d3utils/rosbot_flow/flow_master_driver.py` (tick_flow_master). They call refresh/notify and all other third-party libs. |
| Third-party libs | `battlenet_status_provider`, `d3_status_provider`, `rosbot_status_provider`, `tick_battlenet_ready_flow`, `run_f0_prejudge_entry`, `extension_flow_tick_step`, etc.; no flow switches, only return results. |
| When no flow active | `window_monitor_timer.refresh_window_status_if_inactive()` runs when `not is_flow_active()` and `not _inactive_refresh_done`. It calls `rosbot_task_processor.run_full_status_refresh()` at most once (startup one-shot sets the flag); scope is BN-only when only Ensure Battle.net is on, else BN+D3+ROSBOT. |

For “Ensure Battle.net only” and tick details, see `ENSURE_BATTLENET_ONLY_TICK_FLOW.md`.
