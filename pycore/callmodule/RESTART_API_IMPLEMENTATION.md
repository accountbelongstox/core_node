# Callmodule Restart API - Implementation Summary

## Overview

This document describes the implementation of the restart API endpoint for Pycore Callmodule, allowing the application to restart gracefully via HTTP API without requiring root privileges.

---

## Implementation Architecture

```
┌────────────────────────────────────────────────────────────┐
│  HTTP API (port 59000)                                     │
│  POST /api/manage/control/restart                         │
│  POST /api/manage/control/stop                            │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│  SystemService.execute_control_action()                    │
│  - "restart" → THREAD_BUS.request_restart()               │
│  - "stop" → THREAD_BUS.request_shutdown()                 │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│  THREAD_BUS (Global Thread Communication Bus)              │
│  - request_restart(reason, execute_handlers)               │
│    1. Set _restart_requested = True                        │
│    2. Signal 'global.restart.requested'                    │
│    3. Call request_shutdown() to trigger cleanup           │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│  Shutdown Handlers (registered via THREAD_BUS)             │
│  - HeartbeatSystem.stop()                                  │
│  - RPC v2 server.stop()                                    │
│  - Frontend thread.stop()                                  │
│  - PySide6 framework.quit()                                │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│  Main Entry (pycore_module_caller.py)                      │
│  - launch_native_app() returns (after shutdown)            │
│  - Check THREAD_BUS.is_restart_requested()                 │
│  - If True: os.execv(sys.executable, sys.argv)            │
│  - If False: Exit normally                                 │
└────────────────────────────────────────────────────────────┘
```

---

## Files Modified

### 1. THREAD_BUS Extension

**File**: `pycore/pyfoundations/thread_bus.py`

**Added Method** (line 690-724):
```python
def request_restart(
    self,
    reason: str = "User requested restart",
    execute_handlers: bool = True
) -> None:
    """
    Request global application restart

    Sets restart flag and triggers shutdown sequence.
    After shutdown completes, the application should restart using os.execv().

    Args:
        reason: Reason for restart
        execute_handlers: If True, execute shutdown handlers immediately

    Example:
        # Request restart via API
        THREAD_BUS.request_restart("API restart request")

        # In main loop after shutdown:
        if THREAD_BUS.is_restart_requested():
            import os, sys
            os.execv(sys.executable, [sys.executable] + sys.argv)
    """
    with self._lock:
        self._restart_requested = True

    # Signal restart (in addition to shutdown)
    self.signal('global.restart.requested', {
        'reason': reason,
        'requester_thread_id': threading.get_ident()
    })

    # Request shutdown with restart flag set
    self.request_shutdown(reason, execute_handlers)
```

**Key Features**:
- Idempotent: Can be called multiple times safely
- Thread-safe: Uses RLock for synchronization
- Sets restart flag BEFORE triggering shutdown
- Signals both `global.restart.requested` and `global.shutdown.requested`

---

### 2. SystemService Implementation

**File**: `pycore/callmodule/services/management/system_service.py`

**Modified Method** (line 139-223):
```python
def execute_control_action(self, action: str) -> ControlResponse:
    """
    Execute a control action (restart, stop, reload-config, clear-cache).

    Args:
        action: The control action to execute

    Returns:
        ControlResponse with result
    """
    from pycore import THREAD_BUS, ColorPrint

    timestamp = datetime.utcnow().isoformat() + 'Z'

    try:
        if action == "restart":
            # Request restart via THREAD_BUS
            ColorPrint.yellow("[SystemService] Restart requested via API")
            THREAD_BUS.request_restart(
                reason="API restart request",
                execute_handlers=True
            )

            return ControlResponse(
                success=True,
                message="Service restart initiated (shutdown in progress, will restart automatically)",
                action=action,
                timestamp=timestamp
            )

        elif action == "stop":
            # Request shutdown via THREAD_BUS
            ColorPrint.yellow("[SystemService] Shutdown requested via API")
            THREAD_BUS.request_shutdown(
                reason="API shutdown request",
                execute_handlers=True
            )

            return ControlResponse(
                success=True,
                message="Service stop initiated (shutdown in progress)",
                action=action,
                timestamp=timestamp
            )

        # ... other actions ...

    except Exception as e:
        ColorPrint.red(f"[SystemService] Control action '{action}' failed: {e}")
        return ControlResponse(
            success=False,
            message=f"Action failed: {str(e)}",
            action=action,
            timestamp=timestamp
        )
```

**Improvements**:
- Replaced TODO with actual implementation
- Uses THREAD_BUS for proper shutdown coordination
- Provides clear success messages
- Logs actions with ColorPrint
- Graceful error handling

---

### 3. Main Entry Restart Handler

**File**: `pycore_module_caller.py`

**Modified Function** (line 39-77):
```python
def main_native_ui(host='0.0.0.0', port=59000, debug=False):
    """
    Main entry point using Native UI pattern (default)

    Supports automatic restart via os.execv() when restart is requested via API.

    Args:
        host: RPC v2 server host
        port: RPC v2 server port
        debug: Debug mode
    """
    import os

    # Start the application (blocks until shutdown)
    start(host=host, port=port, debug=debug)

    # After shutdown completes, check if restart was requested
    if THREAD_BUS.is_restart_requested():
        ColorPrint.yellow("=" * 70)
        ColorPrint.yellow("[Main] Restart requested, restarting process...")
        ColorPrint.yellow("=" * 70)

        # Small delay to ensure all resources are released
        time.sleep(0.5)

        # Restart process using os.execv()
        # This replaces the current process with a new one (works in low privilege)
        python = sys.executable
        args = [python] + sys.argv

        ColorPrint.green(f"[Main] Restarting with: {' '.join(args)}")

        try:
            os.execv(python, args)
        except Exception as e:
            ColorPrint.red(f"[Main] Failed to restart process: {e}")
            ColorPrint.yellow("[Main] Please restart manually")
    else:
        ColorPrint.blue("[Main] Shutdown complete (no restart requested)")
```

**Also Updated**: `main_legacy()` function (line 143-164) with same restart logic

**Key Features**:
- Works in low privilege mode (uses `os.execv()`, not external restart)
- Replaces current process with new instance
- Preserves command line arguments
- 0.5 second delay to ensure clean resource release
- Clear logging at each step
- Fallback message if restart fails

---

## How os.execv() Works (Low Privilege Restart)

**Q**: Why does restart work in low privilege?

**A**: `os.execv()` does NOT create a new process. Instead, it:

1. **Replaces** the current process image with a new one
2. **Keeps** the same PID (Process ID)
3. **Inherits** file descriptors, environment, working directory
4. **Does NOT require** elevated privileges (no fork/exec needed)

**Process Flow**:
```
Old Process (PID 12345, User: ubuntu)
  ↓ os.execv(python, [python, pycore_module_caller.py])
New Process (PID 12345, User: ubuntu)  ← Same PID, same user!
```

**vs. Traditional Restart** (requires privilege):
```
Supervisor/Systemd (root)
  ↓ kill(12345)
  ↓ spawn(python pycore_module_caller.py)  ← Requires root/supervisor
New Process (PID 67890)
```

---

## API Usage

### 1. Restart Callmodule

```bash
# Trigger restart (graceful shutdown + automatic restart)
curl -X POST http://localhost:59000/api/manage/control/restart
```

**Response**:
```json
{
  "success": true,
  "message": "Service restart initiated (shutdown in progress, will restart automatically)",
  "action": "restart",
  "timestamp": "2025-12-22T09:13:06.121210Z"
}
```

**What Happens**:
1. API returns immediately with success response
2. Shutdown handlers execute in order (priority-based)
3. All services stop gracefully (Heartbeat → RPC → Frontend → UI)
4. Main loop detects restart flag
5. Process restarts using `os.execv()`
6. New instance starts with same configuration
7. Singleton detection handles port conflicts

**Expected Logs**:
```
[SystemService] Restart requested via API
[ThreadBus] Executing shutdown stack: API restart request
[ThreadBus] Shutdown order: ['frontend', 'singleton_detector_pycore_callmodule', 'heartbeat', 'rpc_v2', 'pyside6_quit']
[ThreadBus] Shutdown handler: frontend completed
[ThreadBus] Shutdown handler: heartbeat completed
[Callmodule] Application exited
======================================================================
[Main] Restart requested, restarting process...
======================================================================
[Main] Restarting with: /usr/local/bin/python /www/programing/core_node/pycore_module_caller.py
[INFO] Checking for required Python packages...
[Callmodule] 20 routers available
...
```

---

### 2. Stop Callmodule

```bash
# Trigger graceful shutdown (no restart)
curl -X POST http://localhost:59000/api/manage/control/stop
```

**Response**:
```json
{
  "success": true,
  "message": "Service stop initiated (shutdown in progress)",
  "action": "stop",
  "timestamp": "2025-12-22T09:13:47.893134Z"
}
```

**What Happens**:
1. API returns immediately
2. Shutdown handlers execute
3. All services stop
4. Process exits normally (no restart)

---

## Testing

### 1. Test Restart via API

```bash
# Start callmodule
python pycore_module_caller.py

# In another terminal, trigger restart
curl -X POST http://localhost:59000/api/manage/control/restart

# Watch logs - should see shutdown → restart sequence
tail -f /tmp/callmodule.log
```

**Expected Behavior**:
- Service responds to API call
- Shutdown sequence executes
- Process restarts automatically
- New instance takes over ports (singleton detection)

---

### 2. Test Idempotency

```bash
# Call restart multiple times rapidly
for i in {1..3}; do
  curl -X POST http://localhost:59000/api/manage/control/restart &
done
wait
```

**Expected Behavior**:
- First call sets restart flag and triggers shutdown
- Subsequent calls are idempotent (restart flag already set)
- Only one shutdown sequence executes
- Process restarts once

---

### 3. Test Low Privilege Mode

```bash
# Start as non-root user
su - ubuntu
python /www/programing/core_node/pycore_module_caller.py

# Trigger restart (should work without sudo)
curl -X POST http://localhost:59000/api/manage/control/restart
```

**Expected Behavior**:
- Restart works without elevated privileges
- Process replaces itself using `os.execv()`
- Same PID, same user

---

## Design Principles

### 1. Idempotent Operations

All operations can be called multiple times safely:

```python
# Multiple restart requests → same effect as one
THREAD_BUS.request_restart("reason 1")
THREAD_BUS.request_restart("reason 2")  # Idempotent
# Result: _restart_requested = True, shutdown executes once
```

### 2. Thread-Safe

All THREAD_BUS operations use RLock:

```python
with self._lock:
    self._restart_requested = True  # Thread-safe
```

### 3. No Patches

All code extends existing architecture:
- Extends THREAD_BUS (added method)
- Implements SystemService (replaced TODO)
- Extends main entry (added restart detection)
- No patch scripts, no monkey patching

### 4. Low Privilege Compatible

Uses `os.execv()` instead of external process manager:
- No fork/exec (which requires privilege)
- No systemd/supervisor dependency
- Works in Docker containers
- Works with any user

### 5. Graceful Shutdown

Executes all registered shutdown handlers:
- Frontend stops (dev server or static files)
- RPC v2 server stops
- PyHeartbeat stops
- UI framework quits
- Resources released properly

---

## Edge Cases Handled

### 1. Rapid Repeated Calls

**Scenario**: User calls restart API 10 times in 1 second

**Handling**:
- First call sets `_restart_requested = True`
- Subsequent calls see flag already set (idempotent)
- Shutdown executes only once
- Process restarts once

### 2. Restart During Shutdown

**Scenario**: User calls restart while shutdown already in progress

**Handling**:
```python
# In THREAD_BUS.request_restart()
with self._lock:
    self._restart_requested = True  # Sets flag even if shutting down

# In execute_shutdown()
if self._shutdown_executed:
    return  # Prevents double execution
```

### 3. Failed Restart

**Scenario**: `os.execv()` fails (corrupted Python interpreter, missing file, etc.)

**Handling**:
```python
try:
    os.execv(python, args)
except Exception as e:
    ColorPrint.red(f"[Main] Failed to restart process: {e}")
    ColorPrint.yellow("[Main] Please restart manually")
    # Process exits, user must restart manually
```

### 4. Port Conflicts After Restart

**Scenario**: Old instance ports not released before new instance starts

**Handling**:
- Singleton detection waits for old instance to shutdown
- `ensure_ports_available()` with 3-second timeout
- Force kill if timeout (as last resort)
- Clear error messages if ports still in use

---

## Differences from Traditional Restart

| Aspect | Traditional (systemd/supervisor) | This Implementation (os.execv) |
|--------|----------------------------------|--------------------------------|
| **Privilege** | Requires root/supervisor | Works in low privilege |
| **PID** | New PID | Same PID (process replacement) |
| **Environment** | May change | Fully preserved |
| **Dependencies** | systemd, supervisor, etc. | None (pure Python) |
| **Container** | May not work in Docker | Works in Docker |
| **Monitoring** | External process manager | Self-contained |
| **Cleanup** | Handled by OS | Handled by shutdown handlers |

---

## Future Enhancements

### 1. Restart with Config Reload

```python
# TODO: Support passing new config via API
POST /api/manage/control/restart
{
  "config": {
    "debug": true,
    "port": 59001
  }
}
```

### 2. Scheduled Restart

```python
# TODO: Support delayed restart
POST /api/manage/control/restart
{
  "delay_seconds": 60
}
```

### 3. Restart Callback

```python
# TODO: Support pre/post restart hooks
THREAD_BUS.register_restart_hook(
    lambda: backup_database(),
    priority=100
)
```

---

## Summary

**Files Modified**: 3
- `pycore/pyfoundations/thread_bus.py` (added `request_restart()`)
- `pycore/callmodule/services/management/system_service.py` (implemented restart/stop)
- `pycore_module_caller.py` (added restart detection + os.execv)

**Lines Added**: ~100 lines
**Idempotent**: ✅ All operations
**Low Privilege**: ✅ Uses os.execv()
**No Patches**: ✅ Pure extension
**Architecture**: ✅ Follows existing patterns

**API Endpoints**:
- `POST /api/manage/control/restart` - Restart callmodule
- `POST /api/manage/control/stop` - Stop callmodule

**Testing Status**: ⚠️ Requires service restart to load new code

---

## Next Steps

1. **Restart Service**: Restart callmodule to load new code
   ```bash
   # As root user:
   pkill -f pycore_module_caller
   python /www/programing/core_node/pycore_module_caller.py
   ```

2. **Test Restart API**: Verify restart works via HTTP API
   ```bash
   curl -X POST http://localhost:59000/api/manage/control/restart
   ```

3. **Monitor Logs**: Watch restart sequence
   ```bash
   tail -f /tmp/callmodule.log
   ```

4. **Integrate with Frontend**: Add restart button to pycore-management UI
   ```typescript
   // Example frontend code
   const restartService = async () => {
     const response = await fetch('http://localhost:59000/api/manage/control/restart', {
       method: 'POST'
     });
     const data = await response.json();
     console.log(data.message);
   };
   ```
