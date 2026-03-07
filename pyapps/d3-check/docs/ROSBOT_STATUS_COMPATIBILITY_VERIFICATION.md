# ROSBOT extended status compatibility verification

**Semantics (after change):**
- **not_found**: No ROSBOT process.
- **running**: Process exists, **zero visible windows** (background only).
- **paused**: Process exists, **at least one visible window** (any window, not only main).

---

## Verification summary

| Location | Usage | Compatible |
|----------|--------|------------|
| **share/game_interface_data.py** | `rosbot_extended_status` values `not_found` \| `running` \| `paused`; `rosbot_window_found = (status == "paused")` | Yes. Comment at 724 and `set_rosbot_extended_status` already match (running = no window, paused = has window). |
| **d3utils/rosbot_flow/flow_master_driver.py** | `_is_f3_only_mode()`: `rosbot_extended_status in ("running", "paused")` → both mean "ROSBOT online". `need_c_branch`: `not in ("running", "paused")` → need C when not online. | Yes. |
| **controller/login_try_screenshot_controller.py** | `g.d3_running and g.rosbot_extended_status in ("running", "paused")` → skip BN check when D3+ROSBOT online. | Yes. |
| **timers/one_shot_tasks.py** | `_send_f7_for_status("running")`: F7 to system; `_send_f7_for_status("paused")`: get_rosbot_window() then F7 to that hwnd. `do_rosbot_test_pause_resume`: wait_for("paused") = wait until any window appears; wait_for("running") = wait until no window. | Yes. When paused we now always have a window (any visible), so get_rosbot_window() returns it. |
| **d3utils/rosbot_manager.py** | `is_rosbot_online()`: `status in ("running", "paused")`. `get_rosbot_detection()`: returns status and window_info. | Yes. |
| **d3utils/rosbot_flow_f2_rosbot_online.py** | `status in ("running", "paused")` = online. | Yes. |
| **ui/components/bottom_bar.py** | `ros_ext == "running"` → "运行中"; `ros_ext == "paused"` → "暂停中" / process:exe title:... | Yes. |
| **d3utils/rosbot_operation.py** | `get_rosbot_window()` for activate/send F7/resume_rosbot. When status is paused we return main window if content-validated, else any visible; resume_rosbot_ui expects main for tab+Start — if only non-main visible, UI ops may fail (same as before when only popup was open). | Yes. No new incompatibility. |
| **d3utils/rosbot_ui_automation.py** | get_rosbot_window() for ControlFromHandle and clicks. Prefers main; when only "any visible" we return that window. | Yes. |

---

## Behaviour change (semantics only)

- **Before**: `paused` = process has **main** window (content-validated). `running` = process has no main window (could have other visible windows, e.g. only popup).
- **After**: `paused` = process has **any** visible window. `running` = process has **no** visible window.

All call sites that only check `in ("running", "paused")` or `== "paused"` / `== "running"` remain correct. The only behavioural change is that when only a non-main window (e.g. popup) is visible, status is now **paused** and `get_rosbot_window()` returns that window; previously it was **running** and `get_rosbot_window()` was None. This is the intended fix.
