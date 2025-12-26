# THREAD_BUS Event System - Comprehensive Fix

## Problem Summary

**Issue**: Debug window closes but program enters tray mode with GTK/DBus errors, instead of exiting cleanly.

**Root Cause**: Inconsistent shutdown paths - some use THREAD_BUS event system (`app.close`), others bypass it (`request_close()` directly).

---

## Fixed Locations (4)

### ✅ Fix 1: Main Frontend Ready Handler
**File**: `launch_native_app.py:145`

**Before**:
```python
# Close debug window
thread.request_close()
```

**After**:
```python
# Trigger app.close event for proper shutdown coordination
# This ensures thread.stop() is called (sets _stop_event, prevents tray mode)
THREAD_BUS.trigger_event('app.close', {
    'source': 'frontend_ready',
    'reason': 'Frontend is ready, closing debug window'
}, async_mode=False)
```

**Why**: Main frontend ready path should use event system for consistency.

---

### ✅ Fix 2: Early Frontend Ready
**File**: `launcher_with_startup.py:120`

**Before**:
```python
startup_thread.request_close()
```

**After**:
```python
# Trigger app.close event for proper shutdown coordination
# This ensures thread.stop() is called (sets _stop_event, prevents tray mode)
THREAD_BUS.trigger_event('app.close', {
    'source': 'frontend_ready_early',
    'reason': 'Frontend was already ready before debug window started'
}, async_mode=False)
```

**Why**: Early frontend ready path should use event system for consistency.

---

### ✅ Fix 3: Fallback Frontend Ready Handler
**File**: `launcher_with_startup.py:217`

**Before**:
```python
# Close debug window
startup_thread.request_close()
```

**After**:
```python
# Trigger app.close event for proper shutdown coordination
# This ensures thread.stop() is called (sets _stop_event, prevents tray mode)
THREAD_BUS.trigger_event('app.close', {
    'source': 'frontend_ready_fallback',
    'reason': 'Frontend ready (standalone mode)'
}, async_mode=False)
```

**Why**: Fallback handler should use event system for consistency.

---

### ✅ Fix 4: Finally Block Cleanup
**File**: `launcher_with_startup.py:275`

**Before**:
```python
startup_thread.request_close()
```

**After**:
```python
# Use stop() instead of request_close() to ensure:
# 1. _stop_event is set (prevents entering tray mode after window closes)
# 2. Tray is stopped if running
# 3. Window is closed if still open
# Note: Failsafe cleanup - don't use event system here in case THREAD_BUS is broken
startup_thread.stop()
```

**Why**: Failsafe cleanup should be direct, not event-driven.

---

## Fix Strategy Rationale

### Strategy A: Trigger `app.close` Event (Fixes 1-3)

**Used for**: Frontend ready paths

**Rationale**:
- Maintains THREAD_BUS event-driven architecture consistency
- Same flow as user clicking X button, Ctrl+C, tray exit
- Ensures proper shutdown coordination via `handle_app_close()`

**Flow**:
```
Frontend ready event
  → trigger_event('app.close') ✅
  → handle_app_close()
  → thread.stop() ✅ Sets _stop_event
  → THREAD_BUS.request_shutdown()
  → Clean exit ✅
```

### Strategy B: Direct `stop()` Call (Fix 4)

**Used for**: Finally block cleanup

**Rationale**:
- Failsafe mechanism - works even if THREAD_BUS is broken
- Cleanup/error handling should be direct, not event-driven
- Last resort shutdown path

**Flow**:
```
Finally block
  → thread.stop() ✅ Direct call
  → Sets _stop_event ✅
  → Stops tray ✅
  → Closes window ✅
```

---

## Complete Shutdown Path Map

### ✅ Consistent Paths (All Use THREAD_BUS)

1. **User clicks X button**
   - Source: `startup_window_thread.py:678`
   - Triggers: `app.close` (source: `debug_window_close`)
   - Result: ✅ Clean exit

2. **Ctrl+C pressed**
   - Source: `framework.py:376`
   - Triggers: `app.close` (source: `signal_interrupt`)
   - Result: ✅ Clean exit

3. **Tray menu exit**
   - Source: `launcher_with_startup.py:183`
   - Triggers: `app.close` (source: `tray_menu`)
   - Result: ✅ Clean exit

4. **Frontend ready** ← **FIXED**
   - Source: `launch_native_app.py:146`
   - Triggers: `app.close` (source: `frontend_ready`)
   - Result: ✅ Clean exit (after fix)

5. **Early frontend ready** ← **FIXED**
   - Source: `launcher_with_startup.py:123`
   - Triggers: `app.close` (source: `frontend_ready_early`)
   - Result: ✅ Clean exit (after fix)

6. **Fallback frontend ready** ← **FIXED**
   - Source: `launcher_with_startup.py:224`
   - Triggers: `app.close` (source: `frontend_ready_fallback`)
   - Result: ✅ Clean exit (after fix)

### ✅ Direct Path (Failsafe)

7. **Finally cleanup** ← **FIXED**
   - Source: `launcher_with_startup.py:291`
   - Calls: `thread.stop()` directly
   - Result: ✅ Clean exit (failsafe, after fix)

---

## Event Handler Chain

### `app.close` Event Handlers (2)

**Handler 1**: `launch_native_app.py:234` (priority=90)
```python
def handle_app_close(event_data):
    # Stop startup thread
    if startup_thread_ref and startup_thread_ref.get('thread'):
        thread = startup_thread_ref['thread']
        if thread and thread.is_alive():
            thread.stop()  # ✅ Sets _stop_event, prevents tray mode

    # Trigger THREAD_BUS shutdown
    if not THREAD_BUS.is_shutdown_requested():
        THREAD_BUS.request_shutdown(reason=f"app.close event")
```

**Handler 2**: `system_tray.py:354`
```python
THREAD_BUS.register_event_handler('app.close', lambda e: app.quit())
```

---

## Verification Test

### Test Scenario 1: Frontend Ready
```bash
python3 ./pycore_module_caller.py
# Wait for frontend to become ready
# Observe: Debug window closes → program exits cleanly ✅
# No tray mode, no GTK/DBus errors ✅
```

### Test Scenario 2: User Clicks X Button
```bash
python3 ./pycore_module_caller.py
# Click X button on debug window before frontend ready
# Observe: Debug window closes → program exits cleanly ✅
```

### Test Scenario 3: Ctrl+C
```bash
python3 ./pycore_module_caller.py
# Press Ctrl+C
# Observe: Program catches signal → exits cleanly ✅
```

### Test Scenario 4: Tray Exit
```bash
python3 ./pycore_module_caller.py
# Wait for tray to start (if enabled)
# Right-click tray → Exit
# Observe: Program exits cleanly ✅
```

---

## Impact

### Before Fix:
- ❌ Frontend ready → enters tray mode → GTK/DBus error
- ❌ User confused: "关闭无效" (close doesn't work)
- ❌ Inconsistent architecture: some paths use events, others don't

### After Fix:
- ✅ All shutdown paths consistent (except failsafe finally)
- ✅ Frontend ready → clean exit, no tray mode
- ✅ THREAD_BUS event system properly utilized
- ✅ User expectation met: closing debug window exits program

---

## Related Documentation

1. **DEBUG_WINDOW_CLOSE_FIX.md** - Previous fix for user clicking X button
2. **SINGLETON_SHUTDOWN_FIX.md** - Singleton port registration fix
3. **TRAY_GTK_DBUS_ERROR_ANALYSIS.md** - Comprehensive error analysis
4. **THREAD_BUS_EVENT_FLOW_ANALYSIS.md** - Complete event flow analysis

---

## Architecture Lessons

### Key Principle:
**All shutdown paths should go through THREAD_BUS event system for consistency and coordination.**

### Exception:
**Failsafe cleanup (finally blocks) can bypass event system to ensure cleanup even if event system is broken.**

### Design Pattern:
```
User action / system event
  ↓
THREAD_BUS.trigger_event('app.close')
  ↓
Registered handlers execute
  ↓
Coordinated shutdown
  ↓
Clean exit
```

---

## Modified Files

1. `/www/programing/core_node/pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`
   - Line 145: Changed `request_close()` → trigger `app.close` event

2. `/www/programing/core_node/pycore/pyutils/native_ui/step3_launcher/launcher_with_startup.py`
   - Line 120: Changed `request_close()` → trigger `app.close` event
   - Line 217: Changed `request_close()` → trigger `app.close` event
   - Line 275: Changed `request_close()` → direct `stop()` call

---

## Commit Message

```
Fix: Standardize debug window shutdown paths via THREAD_BUS events

Problem:
- Frontend ready paths bypassed THREAD_BUS event system
- Directly called request_close() which doesn't set _stop_event
- Debug window closed but program entered tray mode with GTK/DBus errors
- User saw "关闭无效" (close doesn't work)

Solution:
- Changed 3 frontend ready paths to trigger app.close event
- Ensures thread.stop() is called (sets _stop_event, prevents tray mode)
- Changed finally cleanup to direct stop() call (failsafe)

Files modified:
- launch_native_app.py:145 - Main frontend ready handler
- launcher_with_startup.py:120 - Early frontend ready
- launcher_with_startup.py:217 - Fallback frontend ready handler
- launcher_with_startup.py:275 - Finally cleanup (direct stop)

Result:
- All shutdown paths consistent (use THREAD_BUS events)
- Debug window closes → clean exit, no tray mode
- No GTK/DBus errors

Related:
- DEBUG_WINDOW_CLOSE_FIX.md (previous X button fix)
- THREAD_BUS_EVENT_FLOW_ANALYSIS.md (complete analysis)
```

---

## Date: 2025-12-18

Fixed by: Claude Code
Reported by: User ("thread bus事件也没有考虑全面啊")
