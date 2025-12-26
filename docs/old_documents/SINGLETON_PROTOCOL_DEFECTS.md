# SingletonDetector Communication Protocol - Defect Analysis

## Error Observed

```
[2025-12-18 15:51:33] [ERROR] SingletonDetector(pycore_callmodule): No valid shutdown response received
[NativeLauncher] Failed to take over from existing instance at port 54000
[Callmodule] Application exited
```

---

## Running Instances

```bash
$ ps aux | grep callmodule
root      1253    Dec09  /usr/local/bin/python /www/programing/core_node/pycore_module_caller.py
root      484058  15:30  python ./pycore_module_caller.py
root      886291  Dec17  python ./pycore_module_caller.py
```

**Issue**: 3 old instances running, preventing new instance from taking over.

---

## Root Cause Analysis

### Problem 1: Missing `on_message` Callback Registration

**File**: `launch_native_app.py:244-251`

```python
detector = SingletonDetector(
    app_id=config.app_id,
    port_start=port_start,
    port_range=port_range,
    timeout=1.0,
    debug=config.debug,
    shutdown_existing=True  # ❌ Missing on_message callback!
)
```

**What's missing**:
```python
# Should include:
on_message=handle_singleton_message,  # ❌ NOT PROVIDED
state_checker=lambda: {"can_shutdown": True}  # ❌ NOT PROVIDED
```

### How SingletonDetector Works

**File**: `singleton_detector.py:515-561`

```python
def _handle_client(self, client_socket, address):
    # ... receive SHUTDOWN message ...

    elif msg_type == MessageType.SHUTDOWN.value:
        # Send SHUTDOWN_ACK response
        response = self._create_message(
            MessageType.SHUTDOWN_ACK,
            accepted=can_shutdown,
            reason="Shutdown accepted"
        )
        client_socket.sendall(response_data + b'\n')

        if can_shutdown:
            # ❌ CRITICAL: Only triggers shutdown if on_message callback exists!
            if self.on_message:
                def trigger_shutdown():
                    time.sleep(0.3)
                    self.on_message({'type': 'SHUTDOWN', 'pid': message.get('pid')})

                threading.Thread(target=trigger_shutdown, daemon=True).start()
            # ❌ If no on_message callback, NOTHING HAPPENS!
```

### Communication Flow

```
NEW INSTANCE                      OLD INSTANCE
     |                                 |
     | --- SHUTDOWN message -->        |
     |                                 | (receives message)
     |                                 | (sends SHUTDOWN_ACK)
     |                                 | ❌ on_message is None
     | <-- SHUTDOWN_ACK (accepted) --- |
     |                                 | ❌ No actual shutdown!
     |                                 | ❌ Process continues running!
     | (waits 1.5s for shutdown)       |
     | (tries to bind port 54000)      |
     | ❌ Port still in use!            |
     | ❌ Failed to take over           |
     | ❌ New instance exits            |
```

---

## Defect Summary

### Defect 1: Protocol Design Flaw

**Issue**: SHUTDOWN_ACK response means "I will shutdown", but actual shutdown depends on optional callback.

**Problem**:
```python
# singleton_detector.py:549-558
if can_shutdown:
    # Sends ACK saying "I accepted shutdown"
    # But actual shutdown only happens if on_message exists!
    if self.on_message:  # ❌ Optional callback
        # Trigger shutdown
    # ❌ If callback missing, ACK sent but nothing happens!
```

**Consequence**: New instance believes old instance will shutdown (because ACK received), but old instance continues running.

### Defect 2: Missing Callback Registration

**Issue**: `launch_native_app.py` creates SingletonDetector without `on_message` callback.

**File**: `launch_native_app.py:244-251`

**Missing**:
```python
def handle_singleton_message(message):
    """Handle singleton protocol messages"""
    if message.get('type') == 'SHUTDOWN':
        ColorPrint.yellow("[Singleton] Received shutdown request from new instance")
        THREAD_BUS.trigger_event('app.close', {
            'source': 'singleton_shutdown',
            'reason': 'New instance requested takeover'
        }, async_mode=False)

detector = SingletonDetector(
    # ... existing params ...
    on_message=handle_singleton_message,  # ❌ MISSING!
    state_checker=lambda: {
        "can_shutdown": not THREAD_BUS.is_shutdown_requested()
    }  # ❌ MISSING!
)
```

### Defect 3: Old Instances Can't Be Replaced

**Issue**: If old instance has no callback, new instance can't take over.

**Current behavior**:
1. New instance sends SHUTDOWN
2. Old instance replies "OK, I'll shutdown"
3. Old instance doesn't shutdown
4. New instance waits → timeout → fails → exits
5. Old instance keeps running

**Expected behavior**: If old instance doesn't respond or doesn't shutdown, new instance should forcefully take over.

---

## Impact Assessment

### Severity: HIGH

**User Impact**:
- New deployments fail to start
- Multiple instances running simultaneously
- Port conflicts prevent service updates
- Manual intervention required (kill processes)

**Operational Impact**:
- Requires manual process cleanup
- Service updates blocked
- Inconsistent application state

---

## Fix Strategy

### Fix 1: Register `on_message` Callback (Critical)

**File**: `launch_native_app.py:244-251`

**Add**:
```python
def handle_singleton_message(message):
    """
    Handle singleton protocol messages

    Called when another instance sends messages (e.g., SHUTDOWN)
    """
    msg_type = message.get('type')

    if msg_type == 'SHUTDOWN':
        pid = message.get('pid', 'unknown')
        ColorPrint.yellow(f"[Singleton] Received shutdown request from new instance (PID {pid})")

        # Trigger app.close event for coordinated shutdown
        THREAD_BUS.trigger_event('app.close', {
            'source': 'singleton_shutdown',
            'reason': 'New instance requested takeover',
            'new_pid': pid
        }, async_mode=False)

def state_checker():
    """
    Check if application can shutdown

    Returns:
        dict: {'can_shutdown': bool, 'message': str (optional)}
    """
    # Check if shutdown already in progress
    if THREAD_BUS.is_shutdown_requested():
        return {
            "can_shutdown": False,
            "message": "Shutdown already in progress"
        }

    # Always allow shutdown for clean takeover
    return {"can_shutdown": True}

detector = SingletonDetector(
    app_id=config.app_id,
    port_start=port_start,
    port_range=port_range,
    timeout=1.0,
    debug=config.debug,
    shutdown_existing=True,
    on_message=handle_singleton_message,  # ✅ Register callback
    state_checker=state_checker  # ✅ Register state checker
)
```

### Fix 2: Forceful Takeover on Timeout (Recommended)

**File**: `singleton_detector.py:360-394`

**Add fallback logic**:
```python
if result['accepted']:
    # Old instance accepted shutdown, wait
    time.sleep(1.5)

    # Try to bind
    for retry in range(max_retries):
        if self._try_bind_port(port):
            return DetectionResult(is_primary=True, ...)

    # ✅ ADD: Forceful takeover if old instance didn't shutdown
    self._log("[FORCE] Old instance didn't release port, attempting forceful takeover...")

    # Send SIGTERM to old instance (if we can get PID)
    old_pid = response.get('pid')
    if old_pid:
        try:
            import os
            import signal
            self._log(f"[FORCE] Sending SIGTERM to PID {old_pid}...")
            os.kill(old_pid, signal.SIGTERM)
            time.sleep(2.0)  # Wait for graceful shutdown

            # Try binding again
            if self._try_bind_port(port):
                self._log("[SUCCESS] Forcefully took over after SIGTERM")
                return DetectionResult(is_primary=True, ...)
        except Exception as e:
            self._log(f"[FORCE] Failed to send SIGTERM: {e}", "ERROR")
```

### Fix 3: Improve Protocol Semantics (Optional)

**Change**: Require immediate action confirmation, not just ACK.

**Current**:
```
NEW → SHUTDOWN → OLD
OLD → SHUTDOWN_ACK (accepted) → NEW
(Old instance may or may not shutdown)
```

**Better**:
```
NEW → SHUTDOWN → OLD
OLD → SHUTDOWN_ACK (accepted) → NEW
OLD → (actually shuts down within 2s)
OLD → (socket closes, port released)
NEW → (detects port released)
NEW → (binds port successfully)
```

**Implementation**: Add heartbeat check after SHUTDOWN_ACK to verify old instance actually stopped.

---

## Recommended Fix Priority

### Priority 1: Fix 1 (Critical - Implement Immediately)
Register `on_message` and `state_checker` callbacks in `launch_native_app.py`.

**Why**: Without this, protocol is broken and new instances can never take over.

### Priority 2: Fix 2 (Recommended - Implement Next)
Add forceful takeover with SIGTERM fallback.

**Why**: Handles cases where old instance is hung or callback fails.

### Priority 3: Manual Cleanup (Immediate - For Current Issue)
Kill old instances manually:
```bash
kill -15 1253 484058 886291
# Wait 5s
kill -9 1253 484058 886291  # Force kill if needed
```

### Priority 4: Fix 3 (Optional - Future Enhancement)
Improve protocol to verify actual shutdown, not just ACK.

---

## Testing Plan

### Test 1: Normal Takeover
1. Start instance A
2. Start instance B (should shutdown A and take over)
3. Verify: A exits gracefully, B becomes PRIMARY

### Test 2: Old Instance Without Callback
1. Start instance A (without callback)
2. Start instance B (with callback and forceful takeover)
3. Verify: B forcefully kills A (SIGTERM) and takes over

### Test 3: Multiple Old Instances
1. Start instances A, B, C
2. Start instance D
3. Verify: D takes over from first found instance

---

## Related Files

1. `/www/programing/core_node/pycore/pyutils/native_ui/step3_launcher/launch_native_app.py` - Fix location
2. `/www/programing/core_node/pycore/pylauncher/singleton_detector.py` - Protocol implementation
3. `/www/programing/core_node/SINGLETON_SHUTDOWN_FIX.md` - Previous singleton fix (port range)

---

## Architecture Lessons

### Design Principle Violated

**Principle**: "Protocol should guarantee behavior, not depend on optional callbacks"

**Current Design** (Bad):
```
SHUTDOWN_ACK response = "I promise to shutdown"
Actual shutdown = depends on optional callback
→ Promise can be broken!
```

**Better Design**:
```
SHUTDOWN_ACK response = "I am shutting down NOW"
Actual shutdown = guaranteed by protocol
Socket closes within 2s = proof of shutdown
```

### Callback Pattern Issue

**Issue**: Critical behavior (shutdown) depends on optional parameter (`on_message`).

**Better**: Make critical callbacks required, or handle missing callback internally:
```python
if self.on_message:
    self.on_message(message)
else:
    # Fallback: Trigger shutdown anyway!
    self._trigger_default_shutdown()
```

---

## Date: 2025-12-18
Reported by: User ("在其中,如果没有回应则强行结束之前的进程")
Analysis by: Claude Code
