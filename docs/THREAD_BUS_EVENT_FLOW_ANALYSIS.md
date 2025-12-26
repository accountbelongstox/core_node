# THREAD_BUS Event Flow - Complete Analysis

## All `app.close` Event Handlers (2)

### Handler 1: `launch_native_app.py:234`
```python
def handle_app_close(event_data):
    source = event_data.get('source', 'unknown')
    # CRITICAL FIX: Call thread.stop() to prevent tray mode
    if startup_thread_ref and startup_thread_ref.get('thread'):
        thread = startup_thread_ref['thread']
        if thread and thread.is_alive():
            thread.stop()  # ✅ Sets _stop_event

    # Trigger THREAD_BUS shutdown
    if not THREAD_BUS.is_shutdown_requested():
        THREAD_BUS.request_shutdown(reason=f"app.close event (source: {source})")

THREAD_BUS.register_event_handler('app.close', handle_app_close, priority=90)
```

### Handler 2: `system_tray.py:354`
```python
THREAD_BUS.register_event_handler('app.close', lambda e: app.quit())
```

---

## All `app.close` Event Triggers (6)

### ✅ Trigger 1: User Clicks Debug Window X Button
**File**: `startup_window_thread.py:678`
```python
def _on_user_close(self):
    """Handle user attempting to close window"""
    # Trigger global app.close event
    THREAD_BUS.trigger_event('app.close', {
        'source': 'debug_window_close',
        'window': 'TkinterStartupThread'
    }, async_mode=False)

    # Close this window
    self._close_window()
```

**Flow**:
```
User clicks X
  → trigger_event('app.close') ✅
  → handle_app_close()
  → thread.stop() ✅
  → THREAD_BUS.request_shutdown()
```

**Result**: ✅ Clean exit (already fixed in launch_native_app.py:220)

---

### ✅ Trigger 2: User Presses Ctrl+C
**File**: `framework.py:372-381`
```python
def signal_handler(signum, frame):
    """Handle Ctrl+C - trigger app.close event and quit Qt"""
    ColorPrint.yellow("\n[PySide6Framework] Ctrl+C received, closing application...")
    # Trigger app.close event for cleanup
    THREAD_BUS.trigger_event('app.close', {
        'source': 'signal_interrupt',
        'signal': signum
    }, async_mode=False)
    # Quit Qt application
    self.qt_app.quit()
```

**Flow**:
```
Ctrl+C
  → signal_handler()
  → trigger_event('app.close') ✅
  → handle_app_close()
  → thread.stop() ✅
  → THREAD_BUS.request_shutdown()
  → qt_app.quit()
```

**Result**: ✅ Clean exit (user confirmed: "Shutdown already requested")

---

### ✅ Trigger 3-5: Tray Menu Exit
**Files**:
- `launcher_with_startup.py:183`
- `system_tray.py:400`
- `system_tray.py:504`

```python
# launcher_with_startup.py:176-183
def handle_tray_exit(event_data):
    """Handle ui.tray.exit signal - trigger app.close event"""
    THREAD_BUS.trigger_event('app.close', {'source': 'tray_menu'})
```

**Flow**:
```
Tray menu Exit
  → trigger_event('app.close') ✅
  → handle_app_close()
  → thread.stop() ✅
  → THREAD_BUS.request_shutdown()
```

**Result**: ✅ Clean exit (uses THREAD_BUS event system)

---

### ❌ NO TRIGGER: Frontend Ready Auto-Close (BYPASSES THREAD_BUS!)

**File**: `launch_native_app.py:116-145` (Phase 4.55)

```python
def handle_frontend_ready_early(event_data):
    """Handle frontend.ready event - auto-close debug window"""
    startup_thread_ref['frontend_ready'] = True
    thread = startup_thread_ref['thread']

    ColorPrint.green("[DebugLog] Frontend is ready, closing debug window...")
    thread.log("Frontend ready, closing debug window...", "success")
    time.sleep(1.0)

    ColorPrint.unregister_callback(thread._colorprint_callback)

    # ❌ PROBLEM: Directly calls request_close(), bypassing app.close event!
    thread.request_close()

THREAD_BUS.register_event_handler('frontend.ready', handle_frontend_ready_early, priority=100)
```

**Flow**:
```
Frontend ready
  → handle_frontend_ready_early()
  → thread.request_close() ❌ BYPASS THREAD_BUS
  → Sets _close_requested but NOT _stop_event ❌
  → Debug window closes
  → Check: if enable_tray and not _stop_event.is_set()
  → ✅ enable_tray=True, ❌ _stop_event NOT set
  → Enters _run_tray_mode() ❌
  → GTK/DBus error ❌
```

**Result**: ❌ Enters tray mode with GTK/DBus errors

---

### ❌ Fallback Handler (Deprecated): launcher_with_startup.py:217

**File**: `launcher_with_startup.py:200-217`

```python
# NOTE: This is only registered if startup_thread_ref is None (standalone usage)
if startup_thread_ref is None:
    def handle_frontend_ready(event_data):
        """Handle frontend.ready event - fallback for standalone usage"""
        startup_thread.log("Frontend ready, closing debug window...", "success")
        time.sleep(1.0)
        ColorPrint.unregister_callback(startup_thread._colorprint_callback)

        # ❌ PROBLEM: Directly calls request_close()
        startup_thread.request_close()

    THREAD_BUS.register_event_handler('frontend.ready', handle_frontend_ready, priority=100)
```

**When Triggered**: Only in standalone usage (rare)

**Flow**: Same as above - bypasses app.close event

---

### ❌ Early Frontend Ready: launcher_with_startup.py:120

**File**: `launcher_with_startup.py:108-123`

```python
if startup_thread_ref.get('frontend_ready', False):
    # Frontend was already ready before debug window started
    def delayed_close():
        time.sleep(min_display_time)
        startup_thread.log("Frontend ready, closing debug window...", "success")
        time.sleep(1.0)

        # ❌ PROBLEM: Directly calls request_close()
        startup_thread.request_close()

    close_thread = threading.Thread(target=delayed_close, daemon=True)
    close_thread.start()
```

**When Triggered**: Frontend becomes ready before debug window finishes initializing

**Flow**: Same as above - bypasses app.close event

---

### ❌ Finally Block Cleanup: launcher_with_startup.py:275

**File**: `launcher_with_startup.py:271-276`

```python
finally:
    # Cleanup: Unregister ColorPrint callback and close log window
    ColorPrint.print_info("\nCleaning up...")
    ColorPrint.unregister_callback(startup_thread._colorprint_callback)

    # ❌ PROBLEM: Directly calls request_close()
    startup_thread.request_close()
```

**When Triggered**: Application exits (normal or error)

**Flow**: Same as above - bypasses app.close event

---

## Problem Summary

### Issue: Inconsistent Event Flow

**Good paths (use THREAD_BUS)**:
1. User clicks X button → trigger `app.close` → `thread.stop()` ✅
2. Ctrl+C → trigger `app.close` → `thread.stop()` ✅
3. Tray menu exit → trigger `app.close` → `thread.stop()` ✅

**Bad paths (bypass THREAD_BUS)**:
1. Frontend ready → `request_close()` directly ❌
2. Early frontend ready → `request_close()` directly ❌
3. Fallback handler → `request_close()` directly ❌
4. Finally cleanup → `request_close()` directly ❌

### Why This Is Wrong

**THREAD_BUS design principle**: All shutdown paths should go through `app.close` event

**Current implementation violates this**: Frontend ready paths bypass the event system

### Consequence

```python
# startup_window_thread.py:159-177
self.root.mainloop()  # Window closes

# Check if should enter tray mode
if self.enable_tray and not self._stop_event.is_set():
    # _stop_event NOT set because request_close() was called ❌
    self._run_tray_mode()  # Enters tray mode ❌
    # GTK/DBus error occurs ❌
```

---

## Fix Strategy

### Option 1: Change `request_close()` → Trigger `app.close` Event (RECOMMENDED)

**Why**: Maintains consistency with THREAD_BUS event architecture

**Change**: All 4 bad paths should trigger `app.close` event instead of calling `request_close()` directly

**Example**:
```python
# Before
thread.request_close()

# After
THREAD_BUS.trigger_event('app.close', {
    'source': 'frontend_ready',
    'reason': 'Frontend is ready, closing debug window'
}, async_mode=False)
```

**Effect**:
```
Frontend ready
  → trigger_event('app.close') ✅
  → handle_app_close()
  → thread.stop() ✅ Sets _stop_event
  → THREAD_BUS.request_shutdown()
  → Clean exit, no tray mode
```

### Option 2: Change `request_close()` → `stop()` (SIMPLER)

**Why**: Minimal code change, sets `_stop_event` directly

**Change**: All 4 bad paths call `thread.stop()` instead of `request_close()`

**Example**:
```python
# Before
thread.request_close()

# After
thread.stop()  # Sets _stop_event, stops tray, closes window
```

**Effect**: Same as Option 1, but bypasses event system

**Trade-off**: Simpler but less consistent with THREAD_BUS architecture

---

## Recommendation

**Use Option 1** for frontend ready paths (lines 145, 120, 217):
- Trigger `app.close` event
- Maintains THREAD_BUS event-driven architecture
- Consistent with X button, Ctrl+C, tray exit flows

**Use Option 2** for finally block (line 275):
- Direct `thread.stop()` call
- Cleanup/error handling should be direct, not event-driven
- Failsafe - works even if THREAD_BUS is broken

---

## Implementation Locations

### Priority 1: Main Frontend Ready Handler
**File**: `launch_native_app.py:145`
- Change `thread.request_close()` → trigger `app.close` event

### Priority 2: Early Frontend Ready
**File**: `launcher_with_startup.py:120`
- Change `startup_thread.request_close()` → trigger `app.close` event

### Priority 3: Fallback Frontend Ready (Deprecated)
**File**: `launcher_with_startup.py:217`
- Change `startup_thread.request_close()` → trigger `app.close` event
- Consider removing this deprecated handler

### Priority 4: Finally Block Cleanup
**File**: `launcher_with_startup.py:275`
- Change `startup_thread.request_close()` → `startup_thread.stop()`
- Failsafe cleanup, not event-driven

---

## Related Files

1. **launch_native_app.py** - Main launcher, `app.close` handler
2. **launcher_with_startup.py** - Debug window lifecycle management
3. **startup_window_thread.py** - TkinterStartupThread implementation
4. **framework.py** - PySide6 signal handlers (Ctrl+C)
5. **system_tray.py** - PySide6 tray implementation

---

## Root Cause

**Design inconsistency**: Some paths use THREAD_BUS event system (`app.close`), others bypass it (`request_close()` directly).

**Solution**: Standardize all shutdown paths to use `app.close` event for consistency and proper cleanup coordination.
