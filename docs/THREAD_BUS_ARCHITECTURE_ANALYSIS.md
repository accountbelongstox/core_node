# THREAD_BUS Architecture - Deep Analysis

**Date**: 2025-12-18
**Purpose**: Deep understanding document for THREAD_BUS integration work

---

## 🎯 Core Philosophy

**THREAD_BUS is a centralized, thread-safe communication hub following these principles:**

1. **No Direct Thread Communication**: Threads NEVER call each other's methods directly
2. **Event-Driven Architecture**: All communication via events, signals, or message queues
3. **Priority-Based Coordination**: Handlers execute in priority order (predictable behavior)
4. **Graceful Shutdown Stack**: Child services stop before parent services (dependency order)

---

## 🏗️ Architecture Overview

### Thread Safety Foundation

```python
self._lock = threading.RLock()  # Reentrant lock - same thread can acquire multiple times
```

**Why RLock?**
- Prevents deadlocks in complex call chains
- Allows recursive acquisition (thread can call lock multiple times)
- Critical for methods that call other locked methods

---

## 📡 Five Communication Primitives

### 1. **Signals** - One-Time Event Flags

**Purpose**: Notify when significant events occur (e.g., "startup complete", "window ready")

**Key Methods**:
```python
THREAD_BUS.signal('startup_complete', {'status': 'ready'})     # Send signal
has_it = THREAD_BUS.has_signal('startup_complete')             # Check if exists
data = THREAD_BUS.get_signal('startup_complete')               # Get data (non-blocking)
data = THREAD_BUS.wait_signal('startup_complete', timeout=5.0) # Wait (blocking)
```

**Internal Structure**:
```python
_signals: Dict[str, Any] = {
    'startup_complete': {
        'data': {'status': 'ready'},
        'timestamp': 1234567890.123,
        'thread_id': 140735268339456
    }
}
```

**Blocking Mechanism**:
- Uses `threading.Event` per signal name
- `wait_signal()` blocks until signal is set or timeout occurs
- Event auto-created on first wait

**Use Cases**:
- Startup synchronization: "Wait for Tkinter window before showing UI"
- One-time notifications: "Database connection established"
- Cross-thread coordination: "Configuration loaded, proceed with initialization"

---

### 2. **Thread States** - Lifecycle Tracking

**Purpose**: Track thread status and metadata throughout their lifecycle

**Key Methods**:
```python
THREAD_BUS.set_thread_state('TkinterThread', 'running', window_id=123, visible=True)
state = THREAD_BUS.get_thread_state('TkinterThread')
ready = THREAD_BUS.wait_thread_state('TkinterThread', 'running', timeout=3.0)
```

**Internal Structure**:
```python
_thread_states: Dict[str, Dict[str, Any]] = {
    'TkinterThread': {
        'state': 'running',
        'timestamp': 1234567890.123,
        'thread_id': 140735268339456,
        'window_id': 123,
        'visible': True
    }
}
```

**Use Cases**:
- Lifecycle states: 'starting' → 'running' → 'stopping' → 'stopped'
- Health monitoring: Check if critical threads are alive
- Dependency waiting: "Wait for RPC server to be 'running' before connecting"

---

### 3. **Message Queues** - Work Distribution

**Purpose**: FIFO queues for distributing work items between threads

**Key Methods**:
```python
THREAD_BUS.send_message('work_queue', {'task': 'process', 'id': 123})
msg = THREAD_BUS.receive_message('work_queue')                      # Non-blocking
msg = THREAD_BUS.receive_message('work_queue', block=True, timeout=1.0)  # Blocking
```

**Internal Structure**:
```python
_queues: Dict[str, deque] = {
    'work_queue': deque([
        {'message': {'task': 'process'}, 'timestamp': ..., 'sender_thread_id': ...},
        {'message': {'task': 'cleanup'}, 'timestamp': ..., 'sender_thread_id': ...}
    ])
}
```

**Why `deque`?**
- O(1) append and popleft operations (efficient FIFO)
- Thread-safe with lock protection
- Better than `queue.Queue` for our use case (we handle locking externally)

**Use Cases**:
- Worker thread pools: Distribute tasks among workers
- Producer-consumer pattern: One thread produces, another consumes
- Background job processing: "Add OCR task to queue, worker processes it"

---

### 4. **Event Handlers** - Pub/Sub Pattern

**Purpose**: Decoupled event subscription system with priority-based execution

**Key Methods**:
```python
# Subscribe to events
def on_ctrl_click(event_data):
    print(f"Click at {event_data['x']}, {event_data['y']}")

THREAD_BUS.register_event_handler('hotkey.ctrl_click', on_ctrl_click, priority=50)

# Publish events
THREAD_BUS.trigger_event('hotkey.ctrl_click', {'x': 100, 'y': 200}, async_mode=True)
```

**Internal Structure**:
```python
_event_handlers: Dict[str, List[tuple]] = {
    'hotkey.ctrl_click': [
        (10, handler_high_priority),   # Executes FIRST
        (50, handler_medium_priority),
        (100, handler_low_priority)    # Executes LAST
    ]
}
```

**Priority Rules**:
- **Lower number = Higher priority = Executes FIRST**
- Handlers automatically sorted after registration
- Example: priority=10 runs before priority=50

**Async vs Sync Mode**:
```python
# Async mode (non-blocking) - handlers run in separate thread
THREAD_BUS.trigger_event('event', data, async_mode=True)

# Sync mode (blocking) - handlers run in current thread
THREAD_BUS.trigger_event('event', data, async_mode=False)
```

**Use Cases**:
- UI events: Window minimize/maximize/close
- Hotkey events: Ctrl+Click, Ctrl+DoubleClick
- Application lifecycle: app.close, app.restart
- Cross-module notifications: "Clipboard changed", "Singleton message received"

**Why Pub/Sub?**
- **Decoupling**: Publishers don't know about subscribers
- **Extensibility**: New subscribers can be added without modifying publishers
- **Multiple Subscribers**: Many modules can react to same event
- **Priority Control**: Critical handlers execute first

---

### 5. **Shutdown Handlers** - Priority Stack System

**Purpose**: Coordinated graceful shutdown with dependency ordering

**Key Methods**:
```python
# Register shutdown handler
THREAD_BUS.register_shutdown_handler(
    handler=self.stop,
    priority=85,
    name="hotkey_listener"
)

# Trigger shutdown
THREAD_BUS.request_shutdown(reason="User requested", execute_handlers=True)

# Check if shutdown requested
if THREAD_BUS.is_shutdown_requested():
    break  # Exit main loop
```

**Internal Structure**:
```python
_shutdown_handlers: List[tuple] = [
    (50, 'rpc_server', stop_rpc),           # Stops FIRST
    (60, 'speech_service', stop_speech),
    (85, 'hotkey_listener', stop_hotkey),
    (95, 'singleton_detector', stop_singleton),
    (100, 'heartbeat', stop_heartbeat)      # Stops LAST
]
```

**Shutdown Execution Order**:
```
Priority 50  → RPC Server (child service)
Priority 60  → Speech Service
Priority 85  → Hotkey Listener
Priority 95  → Singleton Detector
Priority 100 → Heartbeat System (parent service)
```

**Why This Order Matters**:
- **Child services stop before parents** (子进程先关)
- RPC server must stop before Heartbeat (Heartbeat processes tasks)
- Hotkey listener must stop before Singleton detector
- Heartbeat stops LAST (other services may need task queue during shutdown)

**Shutdown Flow**:
```python
# 1. Request shutdown
THREAD_BUS.request_shutdown(reason="Replacing with new instance")

# 2. Sets signal
_signals['global.shutdown.requested'] = {'reason': ...}

# 3. Execute handlers in priority order
execute_shutdown() → calls each handler from lowest to highest priority

# 4. Each thread checks in main loop
while not self._stop_event.is_set():
    if THREAD_BUS.is_shutdown_requested():
        break  # Exit gracefully
```

**Use Cases**:
- Application exit: User clicks X button
- Singleton takeover: New instance shuts down old instance
- Service restart: Controlled shutdown before restart
- Error recovery: Shutdown on critical error

---

## 🎨 Advanced Features

### Busy State Management

**Purpose**: Prevent shutdown during critical operations

```python
# Mark application as busy
THREAD_BUS.set_busy(True, "Processing database transaction")

# Check if busy
if THREAD_BUS.is_busy():
    print(f"Cannot shutdown: {THREAD_BUS.get_busy_reason()}")

# Clear busy state
THREAD_BUS.set_busy(False)
```

**Internal Mechanism**:
```python
# Uses thread state system
set_busy(True, reason) → set_thread_state('app', 'busy', reason=reason)
is_busy() → get_thread_state('app')['state'] == 'busy'
```

**Use Cases**:
- Singleton takeover: Old instance rejects shutdown if busy
- Payment processing: Prevent shutdown during payment
- File upload: Wait for upload to complete before shutdown

---

### Restart Mechanism

```python
# Request restart after shutdown
THREAD_BUS._restart_requested = True
THREAD_BUS.request_shutdown("Restarting...")

# Check if restart requested
if THREAD_BUS.is_restart_requested():
    os.execv(sys.executable, [sys.executable] + sys.argv)
```

---

## 🔧 Integration Patterns

### Pattern 1: Event-Driven Communication (Decoupled)

**Problem**: Module A needs to notify Module B without direct coupling

**Solution**:
```python
# Module A (Publisher) - Hotkey listener
THREAD_BUS.trigger_event('hotkey.ctrl_click', {
    'x': x,
    'y': y,
    'timestamp': time.time()
}, async_mode=True)

# Module B (Subscriber) - OCR processor
def handle_ctrl_click(event_data):
    screenshot = capture_at(event_data['x'], event_data['y'])
    run_ocr(screenshot)

THREAD_BUS.register_event_handler('hotkey.ctrl_click', handle_ctrl_click, priority=50)
```

**Benefits**:
- Hotkey module doesn't know about OCR module
- Can add more subscribers without modifying hotkey code
- Easy to enable/disable features by (un)registering handlers

---

### Pattern 2: Backward Compatible Integration

**Problem**: Existing code uses callbacks, need to add THREAD_BUS without breaking compatibility

**Solution**:
```python
# OLD CODE (keep for backward compatibility)
if self.on_ctrl_click:
    self.on_ctrl_click()

# NEW CODE (add THREAD_BUS event)
THREAD_BUS.trigger_event('hotkey.ctrl_click', event_data, async_mode=True)

# Result: Both old callbacks AND new event handlers work!
```

---

### Pattern 3: Shutdown Handler Registration

**Problem**: Thread needs graceful shutdown

**Solution**:
```python
def start(self):
    # Start your service...
    self.running = True
    self.thread.start()

    # Register shutdown handler
    THREAD_BUS.register_shutdown_handler(
        self.stop,
        priority=85,  # Choose based on service type
        name="my_service"
    )

def stop(self):
    self.running = False
    # Cleanup...
```

**Priority Guidelines**:
- Child/leaf services: 40-70 (RPC servers, network clients)
- Mid-level services: 70-90 (UI components, input handlers)
- Core infrastructure: 90-100 (Singleton detector, Heartbeat)

---

### Pattern 4: Main Loop with Shutdown Check

**Problem**: Thread needs to exit gracefully when shutdown requested

**Solution**:
```python
def run(self):
    while self.running:
        # Check for global shutdown
        if THREAD_BUS.is_shutdown_requested():
            ColorPrint.yellow(f"[{self.name}] Shutdown detected, stopping...")
            break

        # Do work...
        time.sleep(1)
```

---

### Pattern 5: Startup Coordination

**Problem**: Thread B depends on Thread A being ready

**Solution**:
```python
# Thread A
def run(self):
    # Initialize...
    self.server.start()

    # Signal ready
    THREAD_BUS.signal('rpc_server_ready', {'port': self.port})

# Thread B
def start(self):
    # Wait for dependency
    data = THREAD_BUS.wait_signal('rpc_server_ready', timeout=10.0)
    if not data:
        raise TimeoutError("RPC server didn't start in time")

    # Connect to server
    self.connect(data['port'])
```

---

## 📊 Priority Number Reference

### Event Handler Priorities (Lower = Higher Priority)
```
0-20   : Critical system events (emergency shutdown, critical errors)
21-50  : High priority (UI events, user input)
51-80  : Normal priority (business logic, data processing)
81-100 : Low priority (logging, analytics, non-critical notifications)
```

### Shutdown Handler Priorities (Lower = Stops Earlier)
```
0-30   : Final cleanup (file handles, temp files)
31-50  : Network services (RPC servers, WebSocket servers)
51-70  : Application services (Speech, OCR, Device sync)
71-90  : User interface (Hotkey, Clipboard, Tray)
91-95  : Core coordination (Singleton detector)
96-100 : Infrastructure (Heartbeat, Thread pool)
```

**Mnemonic**: "Children leave before parents" (子进程先关)

---

## 🚀 Best Practices

### 1. Always Use Async Mode for Events

```python
# ✅ GOOD - Non-blocking
THREAD_BUS.trigger_event('event', data, async_mode=True)

# ❌ BAD - Blocks if handlers are slow
THREAD_BUS.trigger_event('event', data, async_mode=False)
```

**Why?** Async mode prevents one slow handler from blocking the publisher.

---

### 2. Always Check Shutdown in Main Loops

```python
# ✅ GOOD - Graceful shutdown
while self.running:
    if THREAD_BUS.is_shutdown_requested():
        break
    # Do work...

# ❌ BAD - Thread won't stop gracefully
while self.running:
    # Do work... (no shutdown check)
```

---

### 3. Register Shutdown Handlers in start(), Not __init__()

```python
# ✅ GOOD - Register when starting
def start(self):
    self.running = True
    THREAD_BUS.register_shutdown_handler(self.stop, priority=85, name="my_service")
    self.thread.start()

# ❌ BAD - Registering before service is started
def __init__(self):
    THREAD_BUS.register_shutdown_handler(self.stop, priority=85, name="my_service")
```

**Why?** Services should only be in shutdown stack if they're actually running.

---

### 4. Use Unique, Descriptive Event Names

```python
# ✅ GOOD - Clear, hierarchical
'hotkey.ctrl_click'
'singleton.message_received'
'heartbeat.tick'
'clipboard.changed'

# ❌ BAD - Vague, collision-prone
'click'
'message'
'tick'
'change'
```

---

### 5. Provide Meaningful Event Data

```python
# ✅ GOOD - Rich context
THREAD_BUS.trigger_event('hotkey.ctrl_click', {
    'x': x,
    'y': y,
    'timestamp': time.time(),
    'button': 'left'
})

# ❌ BAD - Insufficient context
THREAD_BUS.trigger_event('hotkey.ctrl_click', None)
```

---

## 🧪 Testing Considerations

### Mock THREAD_BUS for Unit Tests

```python
from unittest.mock import MagicMock

# Mock THREAD_BUS
mock_thread_bus = MagicMock()
mock_thread_bus.is_shutdown_requested.return_value = False

# Test your module
module.THREAD_BUS = mock_thread_bus
module.run()

# Verify interactions
mock_thread_bus.trigger_event.assert_called_with('event_name', data, async_mode=True)
```

---

## 📈 Performance Characteristics

### Signal Operations: O(1)
- `signal()`, `has_signal()`, `get_signal()` are dictionary lookups

### Event Handler Execution: O(n)
- n = number of registered handlers for that event
- Sorted list iteration

### Shutdown Handler Execution: O(n)
- n = total number of shutdown handlers
- Executed sequentially in priority order

### Message Queue: O(1)
- `send_message()` = deque.append() = O(1)
- `receive_message()` = deque.popleft() = O(1)

### Thread Safety Overhead
- All operations acquire RLock (minimal overhead)
- No busy-waiting (uses threading.Event with timeout)

---

## 🎯 Summary: Key Takeaways

1. **THREAD_BUS is the ONLY communication channel** - Never call thread methods directly
2. **Events decouple modules** - Publishers don't know subscribers
3. **Priorities control execution order** - Both for events and shutdown
4. **Shutdown is a stack** - Lower priority stops first (children before parents)
5. **Always check `is_shutdown_requested()` in loops** - Graceful exit
6. **Async mode is default for events** - Prevents blocking
7. **Backward compatibility via dual notification** - Trigger event + call legacy callback

---

## 🔗 Integration Checklist

When integrating a new module into THREAD_BUS:

- [ ] Import THREAD_BUS: `from pycore import THREAD_BUS`
- [ ] Register shutdown handler in `start()` method
- [ ] Choose appropriate priority (see priority reference)
- [ ] Check `is_shutdown_requested()` in main loop
- [ ] Trigger events for significant actions (keep legacy callbacks for compatibility)
- [ ] Use `async_mode=True` for event triggers
- [ ] Update module docstring to document THREAD_BUS integration
- [ ] Create test script to verify integration
- [ ] Update THREAD_BUS_INTEGRATION_REPORT.md

---

**Next Module to Integrate**: pyutils/clipboard/clipboard_monitor.py (P1 Priority)
