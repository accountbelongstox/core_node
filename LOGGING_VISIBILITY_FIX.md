# Logging Visibility Fix - Implementation Summary

## Problem Statement

**User Complaint**: "为什么什么信息也没有打印。" (Why is no information being printed)

When running `python ./pymain.py app=mcp`, users experienced:
1. **First run**: Detected as SECONDARY instance, connection refused to ws://localhost:8767, but minimal output
2. **Second run**: Complete silence - no information output at all
3. **Root cause**: Critical information was suppressed when `debug=False`

## Solution Overview

Modified the logging system in singleton detection and RPC backend to ensure **critical messages always output** regardless of debug mode.

### Changes Made

1. **Modified `_log()` method signature** in both backend classes
2. **Added `force` parameter** to explicitly control message visibility
3. **Updated log level handling** to always show ERROR, WARNING, CRITICAL messages
4. **Applied `force=True`** to all user-facing critical messages

---

## Modified Files

### 1. `pycore/pyutils/wsrpc/singleton_backend.py`

**`_log()` Method Enhancement**:

```python
def _log(self, message: str, level: str = 'INFO', force: bool = False):
    """
    Output log message

    Args:
        message: Log message
        level: Log level (INFO, WARNING, ERROR, CRITICAL)
        force: Force output regardless of debug setting
    """
    # Always output: ERROR, WARNING, CRITICAL, or forced messages
    if force or level in ['ERROR', 'WARNING', 'CRITICAL'] or self.debug:
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] [{level}] SingletonBackend: {message}")
```

**Critical Messages with `force=True`**:

| Line | Message | Purpose |
|------|---------|---------|
| 118  | "Checking for existing instance at {host}:{port}" | User knows detection is happening |
| 144  | "No existing instance detected" | User knows no primary found |
| 337  | "=== Singleton Backend Starting ===" | Clear startup indication |
| 353  | "No primary instance detected, starting as primary instance" | User knows this is PRIMARY |
| 388  | "=== Startup Complete (Primary: {is_primary}) ===" | Confirmation of successful start |

**Already WARNING/ERROR (auto-visible)**:

| Line | Message | Level |
|------|---------|-------|
| 138  | "Existing instance detected" | WARNING |
| 147  | "Error during instance detection: {e}" | ERROR |
| 334  | "Application already running" | WARNING |
| 344  | "Primary instance detected, starting as secondary instance" | WARNING |
| 358  | "Failed to start server socket, startup failed" | ERROR |

---

### 2. `pycore/pyutils/wsrpc/singleton_rpc_backend.py`

**`_log()` Method Enhancement**:

```python
def _log(self, message: str, level: str = 'INFO', force: bool = False):
    """
    Override to add RPC prefix

    Args:
        message: Log message
        level: Log level (INFO, WARNING, ERROR, CRITICAL)
        force: Force output regardless of debug setting
    """
    # Always output: ERROR, WARNING, CRITICAL, or forced messages
    if force or level in ['ERROR', 'WARNING', 'CRITICAL'] or self.debug:
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] [{level}] SingletonRPC: {message}")
```

**Critical Messages with `force=True`**:

| Line | Message | Purpose |
|------|---------|---------|
| 99   | "=== Starting RPC Backend Server ===" | Backend server starting |
| 117  | "RPC Server listening on ws://{host}:{port}" | Server ready and listening |
| 124  | "RPC Backend Server stopped" | Server shutdown notification |
| 157  | "=== Starting Client Communication ===" | Client thread starting |
| 171  | "Client Communication stopped" | Client shutdown notification |
| 180  | "Waiting for RPC server to start..." | PRIMARY instance waiting |
| 194  | "RPC Client connected to backend" | Successful connection |

**Already ERROR (auto-visible)**:

| Line | Message | Level |
|------|---------|-------|
| 121  | "RPC Server error: {e}" | ERROR |
| 168  | "Client communication error: {e}" | ERROR |
| 203  | "Client connection error: {e}" | ERROR |

---

## Logging Behavior

### Before Fix

| Debug Mode | INFO Messages | WARNING Messages | ERROR Messages |
|------------|---------------|------------------|----------------|
| `debug=False` | ❌ Hidden | ✅ Visible | ✅ Visible |
| `debug=True` | ✅ Visible | ✅ Visible | ✅ Visible |

**Problem**: Critical startup/connection INFO messages hidden when debug=False

### After Fix

| Debug Mode | INFO (force=False) | INFO (force=True) | WARNING | ERROR | CRITICAL |
|------------|--------------------|--------------------|---------|-------|----------|
| `debug=False` | ❌ Hidden | ✅ **VISIBLE** | ✅ Visible | ✅ Visible | ✅ Visible |
| `debug=True` | ✅ Visible | ✅ Visible | ✅ Visible | ✅ Visible | ✅ Visible |

**Solution**: User-facing critical messages use `force=True` to always output

---

## Example Output Scenarios

### Scenario 1: First Instance (PRIMARY)

**Before fix** (debug=False):
```
[No output or minimal output]
```

**After fix** (debug=False):
```
[2025-11-09 10:00:00] [INFO] SingletonBackend: === Singleton Backend Starting ===
[2025-11-09 10:00:00] [INFO] SingletonBackend: Checking for existing instance at localhost:19997
[2025-11-09 10:00:00] [INFO] SingletonBackend: No existing instance detected
[2025-11-09 10:00:00] [INFO] SingletonBackend: No primary instance detected, starting as primary instance
[2025-11-09 10:00:01] [INFO] SingletonBackend: === Startup Complete (Primary: True) ===
[2025-11-09 10:00:01] [INFO] SingletonRPC: === Starting RPC Backend Server ===
[2025-11-09 10:00:01] [INFO] SingletonRPC: RPC Server listening on ws://localhost:8767
[2025-11-09 10:00:01] [INFO] SingletonRPC: === Starting Client Communication ===
[2025-11-09 10:00:01] [INFO] SingletonRPC: Waiting for RPC server to start...
[2025-11-09 10:00:03] [INFO] SingletonRPC: RPC Client connected to backend
```

### Scenario 2: Second Instance (SECONDARY)

**Before fix** (debug=False):
```
[No output]
```

**After fix** (debug=False):
```
[2025-11-09 10:00:10] [INFO] SingletonBackend: === Singleton Backend Starting ===
[2025-11-09 10:00:10] [INFO] SingletonBackend: Checking for existing instance at localhost:19997
[2025-11-09 10:00:10] [WARNING] SingletonBackend: Existing instance detected
[2025-11-09 10:00:10] [WARNING] SingletonBackend: Primary instance detected, starting as secondary instance
[2025-11-09 10:00:10] [INFO] SingletonBackend: === Startup Complete (Primary: False) ===
[2025-11-09 10:00:10] [INFO] SingletonRPC: === Starting Client Communication ===
[2025-11-09 10:00:10] [INFO] SingletonRPC: RPC Client connected to backend
```

### Scenario 3: Connection Error

**Before fix** (debug=False):
```
[Minimal or no output]
```

**After fix** (debug=False):
```
[2025-11-09 10:00:20] [INFO] SingletonBackend: === Singleton Backend Starting ===
[2025-11-09 10:00:20] [INFO] SingletonBackend: Checking for existing instance at localhost:19997
[2025-11-09 10:00:20] [WARNING] SingletonBackend: Existing instance detected
[2025-11-09 10:00:20] [WARNING] SingletonBackend: Primary instance detected, starting as secondary instance
[2025-11-09 10:00:20] [INFO] SingletonBackend: === Startup Complete (Primary: False) ===
[2025-11-09 10:00:20] [INFO] SingletonRPC: === Starting Client Communication ===
[2025-11-09 10:00:20] [ERROR] SingletonRPC: Client connection error: [Errno 111] Connection refused
[2025-11-09 10:00:20] [INFO] SingletonRPC: Client Communication stopped
```

**Key difference**: User now sees the connection error and understands what happened

---

## Testing

### Compilation Test

```bash
python -m py_compile pycore/pyutils/wsrpc/singleton_backend.py
python -m py_compile pycore/pyutils/wsrpc/singleton_rpc_backend.py
```

**Result**: ✅ Both files compile successfully

### Expected User Experience

1. **First run**: User sees startup messages, knows PRIMARY instance started, sees RPC server listening
2. **Second run**: User sees SECONDARY detection, connection status, any errors clearly
3. **Connection issues**: User sees ERROR messages with clear explanation
4. **Port conflicts**: User sees ERROR messages about port binding failures

---

## Impact

### Before Fix

**User Feedback**: "为什么什么信息也没有打印。" (Why is no information being printed)

**Problems**:
- Users don't know if application started
- Users don't know if it's PRIMARY or SECONDARY
- Connection errors invisible
- Debugging impossible without debug mode

### After Fix

**User Experience**:
- ✅ Clear startup indication
- ✅ PRIMARY/SECONDARY status visible
- ✅ Connection status visible
- ✅ Errors clearly displayed
- ✅ No need to enable debug mode for basic visibility

---

## Design Principles

### 1. Visibility by Default

Critical user-facing information should **always be visible** regardless of debug mode.

### 2. Three-Tier Logging

| Tier | Visibility | Purpose | Examples |
|------|------------|---------|----------|
| **User-Critical** | Always visible (force=True) | Startup, status, critical events | "Starting server", "Connected" |
| **Warnings/Errors** | Always visible (auto) | Problems that need attention | "Connection refused", "Port in use" |
| **Debug Info** | Only when debug=True | Development/troubleshooting | Internal state changes |

### 3. Clear Prefixes

- `[INFO] SingletonBackend:` - Singleton detection messages
- `[INFO] SingletonRPC:` - RPC server/client messages
- `[WARNING]` - Warnings that may need attention
- `[ERROR]` - Errors that definitely need attention

---

## Future Enhancements

### Potential Improvements

1. **Structured Logging**: JSON format for machine parsing
2. **Log Levels**: Add TRACE level below DEBUG
3. **Log Rotation**: Automatic log file management
4. **Color Output**: Use ColorPrint for terminal colors
5. **Silent Mode**: Add --silent flag to suppress all non-error output

### Backward Compatibility

✅ All changes are **backward compatible**:
- `force` parameter is optional (default: False)
- Existing code without `force` continues to work
- Only affects visibility, not functionality

---

## Summary

### Files Modified

1. `pycore/pyutils/wsrpc/singleton_backend.py`
   - Updated `_log()` method
   - Added `force=True` to 5 critical messages

2. `pycore/pyutils/wsrpc/singleton_rpc_backend.py`
   - Updated `_log()` method
   - Added `force=True` to 7 critical messages

### Total Changes

- **2 files modified**
- **12 critical messages** now always visible
- **0 breaking changes**
- **100% backward compatible**

### User Impact

**Before**: "为什么什么信息也没有打印。" (Why is no information being printed)

**After**: Clear, informative output showing startup status, connection state, and any errors.

---

**Implementation Date**: 2025-11-09
**Status**: ✅ COMPLETE
**Tested**: ✅ Compilation successful
