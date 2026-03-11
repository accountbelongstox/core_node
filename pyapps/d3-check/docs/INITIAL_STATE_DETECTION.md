# Initial state detection on app startup

On app startup, the UI (bottom bar) needs one initial state detection so that 战网/ROS/D3/地图/阶段/窗口尺寸 etc. show real values (including 战网 亚服/国服, Battle.net + D3 + ROSBOT). This run is **detection only** and **does not drive** the flow (no `tick_bn_only_flow`, no `tick_flow_master`).

**Reusable entry**: `run_full_status_refresh()` in `d3utils/rosbot_task_processor.py` runs all detection (Battle.net with region Asia/CN + D3 + ROSBOT) and notifies UI. No flow check. Use for: app startup, manual Refresh, or timer when flow inactive.

## Flow

1. **UI ready**  
   Controller calls `get_thread_registry().start_timer_loop_after_ui_ready()` (before `ui.run()`).

2. **Initial check on main thread (so UI updates before first frame)**  
   `ThreadRegistry.start_timer_loop_after_ui_ready()` first runs `do_window_monitor_initial_check()` **synchronously on the main thread**. That way refresh and `notify_state_sync()` run before the main loop; the UI callback schedules `after(0, ...)` and the first frame will process it and show 战网/ROS/D3/地图/阶段/窗口尺寸.

3. **Timer + one-shot**  
   Then it starts the timer loop and submits `timer_manager.submit_one_shot(do_window_monitor_initial_check)` (redundant run shortly after; harmless).

4. **Initial check (no flow check)**  
   `do_window_monitor_initial_check()` (in `timers/one_shot_tasks.py`) calls **`run_full_status_refresh()`** directly (never `check_window()`, so it always runs regardless of `is_flow_active()`):
   - `run_full_status_refresh()` (in `d3utils/rosbot_task_processor.py`): `refresh_battlenet_status()` (战网 + 亚服/国服), `refresh_d3_status()`, `refresh_rosbot_status()`, `notify_state_sync()`.
   - Then `window_monitor.notify_window_callbacks(d3_info)` for D3 window callbacks.

5. **UI update**  
   `notify_state_sync()` pushes current `game_interface_data` to all registered callbacks. The bottom bar is registered via `window_monitor.register_status_ui(panel.get_status_ui_callback())`, so it receives the state and updates 战网/ROS/D3/地图/阶段/窗口尺寸 etc.

## Code locations

| Purpose | File | Symbol |
|--------|------|--------|
| **Reusable full refresh (BN + D3 + ROS, no flow check)** | `d3utils/rosbot_task_processor.py` | `run_full_status_refresh()` |
| Run initial check on main thread, then start timer | `runtime/thread_registry.py` | `start_timer_loop_after_ui_ready()` → `do_window_monitor_initial_check()` then `timer_manager.start()` + `submit_one_shot(...)` |
| One-shot: call run_full_status_refresh + window callbacks | `timers/one_shot_tasks.py` | `do_window_monitor_initial_check()` |
| Timer 10s when inactive | `timers/window_monitor_timer.py` | `check_window()` → `run_full_status_refresh()` + `_notify_callbacks(d3_info)` |
| Notify D3 window callbacks after refresh | `timers/window_monitor_timer.py` | `notify_window_callbacks(d3_info)` |

Ongoing 2s tick (flow drive) is separate: `process_task()` only runs when flow is active and only calls `tick_bn_only_flow()` or `tick_flow_master()`; it is not used for this initial detection.
