# Singleton Busy State Control Example

## Overview

Demonstrates how to prevent singleton shutdown when application is processing critical tasks.

## Architecture

```
New Instance (tries to start)
    |
    v
Sends SHUTDOWN to existing instance
    |
    v
Existing Instance checks THREAD_BUS.is_busy()
    |
    +-- busy=True  --> Reject shutdown --> New instance stops
    |
    +-- busy=False --> Accept shutdown --> New instance starts
```

## Complete Example

### Example 1: RPC Handler Setting Busy State

```python
from pycore.pylauncher import LauncherConfig, ServiceLauncher
from pycore import THREAD_BUS

# 1. Start launcher with singleton detection
config = LauncherConfig(
    app_id="data_processor",
    singleton=True,
    shutdown_existing=True,  # Will try to replace old instance
    services={'rpc_v2': {'port': 58100}}
)

launcher = ServiceLauncher(config)
launcher.start()

# 2. Get RPC instance
rpc = launcher.get_service('rpc_v2')

# 3. Register handler that uses busy state
def process_large_file(params):
    file_path = params.get('file_path')

    # Mark as busy before critical operation
    THREAD_BUS.set_busy(True, f"Processing {file_path}")

    try:
        # Long-running operation
        result = heavy_processing(file_path)
        return {'status': 'completed', 'result': result}

    finally:
        # Clear busy state
        THREAD_BUS.set_busy(False)

rpc.server.route('process_file', process_large_file, sync=True)
```

**Behavior:**
- If new instance starts while `process_large_file` is running:
  - Old instance rejects shutdown
  - New instance stops launching
  - Old instance continues processing

### Example 2: Database Transaction Protection

```python
from pycore import THREAD_BUS
import threading

def database_worker():
    """Worker thread that processes database transactions"""
    while not THREAD_BUS.is_shutdown_requested():
        task = get_next_task()

        if task:
            # Mark busy during transaction
            THREAD_BUS.set_busy(True, f"DB transaction: {task.id}")

            try:
                execute_transaction(task)
            finally:
                THREAD_BUS.set_busy(False)

        time.sleep(0.1)

# Start worker
thread = threading.Thread(target=database_worker, daemon=False)
thread.start()
```

### Example 3: Manual Control in Main Thread

```python
from pycore.pylauncher import LauncherConfig, ServiceLauncher
from pycore import THREAD_BUS
import time

# Start launcher
config = LauncherConfig(
    app_id="my_app",
    singleton=True,
    shutdown_existing=True,
    services={'heartbeat': {}}
)

launcher = ServiceLauncher(config)
launcher.start()

# Simulate critical work
print("Starting critical operation...")
THREAD_BUS.set_busy(True, "Initializing database schema")

time.sleep(10)  # Long operation

THREAD_BUS.set_busy(False)
print("Critical operation completed")

# Now new instances can replace this one
time.sleep(60)
```

## Testing Busy State Protection

### Terminal 1: Start Instance with Busy State

```python
# test_busy.py
from pycore.pylauncher import LauncherConfig, ServiceLauncher
from pycore import THREAD_BUS
import time

config = LauncherConfig(
    app_id="test_app",
    singleton=True,
    services={'heartbeat': {}}
)

launcher = ServiceLauncher(config)
launcher.start()

print("Instance 1 started. Setting busy state in 3 seconds...")
time.sleep(3)

THREAD_BUS.set_busy(True, "Processing critical data")
print("Busy state set. Try to start instance 2 now!")

time.sleep(30)  # Stay busy for 30 seconds

THREAD_BUS.set_busy(False)
print("Busy state cleared")

time.sleep(60)  # Keep running
```

### Terminal 2: Try to Replace Busy Instance

```python
# test_replace.py
from pycore.pylauncher import LauncherConfig, ServiceLauncher

config = LauncherConfig(
    app_id="test_app",
    singleton=True,
    shutdown_existing=True,  # Try to replace
    services={'heartbeat': {}}
)

launcher = ServiceLauncher(config)
result = launcher.start()

if result:
    print("SUCCESS: Replaced old instance")
else:
    print("FAILED: Old instance refused to shutdown (probably busy)")
```

**Expected Output:**

**Terminal 1:**
```
[Singleton] PRIMARY on port 54000
Instance 1 started. Setting busy state in 3 seconds...
Busy state set. Try to start instance 2 now!
[Singleton] Received shutdown request
[Singleton] State checker: can_shutdown=False
[Singleton] Shutdown rejected: Processing critical data
```

**Terminal 2:**
```
[Singleton] Found existing at port 54000
[Singleton] Sending SHUTDOWN...
[Singleton] Shutdown rejected: Processing critical data
[Singleton] Failed to shutdown existing instance
FAILED: Old instance refused to shutdown (probably busy)
```

## Two Singleton Modes

### Mode 1: Replace Existing Instance (shutdown_existing=True)

```python
config = LauncherConfig(
    singleton=True,
    shutdown_existing=True,  # Try to replace
    ...
)
```

**Behavior:**
- Finds existing instance → Sends SHUTDOWN
- If existing NOT busy → Shutdown succeeds → New instance starts
- If existing IS busy → Shutdown rejected → New instance stops

### Mode 2: Exit if Instance Exists (shutdown_existing=False)

```python
config = LauncherConfig(
    singleton=True,
    shutdown_existing=False,  # Don't replace (default)
    ...
)
```

**Behavior:**
- Finds existing instance → Exit immediately
- Busy state not checked (no shutdown attempt)

### Mode 3: Force Launch (force_launch=True)

```python
config = LauncherConfig(
    singleton=True,
    force_launch=True,  # Ignore existing instance
    ...
)
```

**Behavior:**
- Finds existing instance → Continue anyway
- Multiple instances will run (defeats singleton purpose)

## API Summary

### THREAD_BUS Methods

```python
# Set busy state (any thread can call)
THREAD_BUS.set_busy(True, "Processing transaction")
THREAD_BUS.set_busy(False)

# Check busy state
if THREAD_BUS.is_busy():
    print("Cannot shutdown:", THREAD_BUS.get_busy_reason())
```

### LauncherConfig Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `singleton` | False | Enable singleton detection |
| `shutdown_existing` | False | Try to replace existing instance |
| `force_launch` | False | Launch even if instance exists |

### Decision Flow

```
New instance starts with singleton=True
    |
    v
Existing instance found?
    |
    +-- No --> Become PRIMARY
    |
    +-- Yes --> Check shutdown_existing
              |
              +-- True --> Send SHUTDOWN
              |            |
              |            +-- Existing busy?
              |                |
              |                +-- Yes --> Reject --> New stops
              |                |
              |                +-- No --> Accept --> New starts
              |
              +-- False --> Exit (don't start new)
```

## Best Practices

1. **Always clear busy state in finally blocks**
   ```python
   try:
       THREAD_BUS.set_busy(True, "reason")
       # ... operation ...
   finally:
       THREAD_BUS.set_busy(False)
   ```

2. **Provide meaningful reasons**
   ```python
   THREAD_BUS.set_busy(True, f"DB transaction {tx_id}")
   ```

3. **Don't abuse busy state**
   - Only for truly critical operations
   - Clear as soon as possible
   - Don't leave busy state set indefinitely

4. **Test both scenarios**
   - Test shutdown when NOT busy (should succeed)
   - Test shutdown when busy (should reject)

## Troubleshooting

**Problem:** New instance always fails to start

**Solution:** Check if old instance is stuck in busy state
```python
# In old instance, check:
if THREAD_BUS.is_busy():
    print("Still busy:", THREAD_BUS.get_busy_reason())
    THREAD_BUS.set_busy(False)  # Force clear if needed
```

**Problem:** Shutdown never rejected even when busy

**Solution:** Check if state_checker is properly connected
```python
# In launcher code, verify state_checker is passed to SingletonDetector
```

## Summary

- **Total code added:** ~50 lines (3 methods in THREAD_BUS + 7 lines in launcher)
- **Code reused:** thread_state mechanism, singleton_detector.state_checker
- **Zero breaking changes:** All existing code continues to work
- **Any thread can control:** Call `THREAD_BUS.set_busy()` from anywhere
