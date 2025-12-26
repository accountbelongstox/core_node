# THREAD_BUS - Advanced Practical Patterns

**Based on Real-World Usage Analysis**
**Date**: 2025-12-18

---

## 📘 Introduction

This document analyzes **real-world THREAD_BUS usage patterns** from the codebase to extract practical insights, common patterns, and best practices actually used in production code.

---

## 🎯 Pattern 1: Lambda Event Handlers (UI Actions)

### Real-World Example: System Tray Menu Actions

**Location**: `step5_main_ui/pyside6/system_tray.py:353-400`

```python
# Register handlers using lambdas for simple actions
THREAD_BUS.register_event_handler('window.show', lambda e: window.show())
THREAD_BUS.register_event_handler('app.close', lambda e: app.quit())

# Trigger events from menu callbacks
TrayMenuItem(
    text="Show Window",
    callback=lambda: THREAD_BUS.trigger_event('window.show')
)

TrayMenuItem(
    text="Exit",
    callback=lambda: THREAD_BUS.trigger_event('app.close', {'source': 'tray_menu'})
)
```

**Pattern Analysis**:
- **Lambda handlers**: Simple one-liners use `lambda e: action()`
- **No event data needed**: Many UI actions don't need the event data parameter
- **Source tracking**: Include `{'source': 'tray_menu'}` to track event origin
- **Separation of concerns**: Menu items trigger events, handlers execute actions

**When to Use**:
- ✅ Simple UI actions (show/hide/minimize/maximize)
- ✅ Direct method calls without additional logic
- ✅ Tray menu items, toolbar buttons, keyboard shortcuts

**When NOT to Use**:
- ❌ Complex logic requiring error handling
- ❌ Actions that need access to event data
- ❌ Logic that should be tested separately

---

## 🎯 Pattern 2: Dual Handler Registration (High + Low Priority)

### Real-World Example: Frontend Ready Handling

**Location**: `step3_launcher/launch_native_app.py:150 + 675`

```python
# HIGH PRIORITY handler (priority=100) - executes LAST
def handle_frontend_ready_early(event_data):
    """Early handler for logging/monitoring"""
    ColorPrint.green(f"[Launcher] Frontend ready: {event_data}")

THREAD_BUS.register_event_handler('frontend.ready', handle_frontend_ready_early, priority=100)

# Later in code, trigger the event
if frontend_started:
    THREAD_BUS.trigger_event('frontend.ready', {
        'url': frontend_url,
        'port': frontend_port,
        'framework': 'vite'
    })
```

**Pattern Analysis**:
- **Multiple handlers for same event**: Different parts of code can react independently
- **Priority control**: Log/monitor early (low number), cleanup late (high number)
- **Decoupled responsibilities**: Each handler focuses on one aspect

**Priority Strategy**:
```
Priority 10-20: Critical actions (stop services, save state)
Priority 50:    Normal actions (UI updates, data processing)
Priority 100:   Logging, monitoring, analytics
```

---

## 🎯 Pattern 3: Synchronous Wait for Startup Coordination

### Real-World Example: Waiting for Tkinter Startup

**Location**: `step3_launcher/launcher_with_startup.py:252`

```python
# Thread A: TkinterStartup signals when ready
class TkinterStartupThread:
    def run(self):
        # Initialize Tkinter...
        self.window = tk.Tk()
        self.window.protocol("WM_DELETE_WINDOW", self.on_close)

        # Signal ready
        THREAD_BUS.signal('TkinterStartup_ready', {
            'window_id': id(self.window),
            'geometry': self.window.geometry()
        })

        # Run mainloop...
        self.window.mainloop()

# Thread B: Main launcher waits for Tkinter
def launch_with_startup():
    # Start Tkinter thread
    tk_thread = TkinterStartupThread()
    tk_thread.start()

    # WAIT for Tkinter to be ready (BLOCKING with timeout)
    if not THREAD_BUS.wait_signal('TkinterStartup_ready', timeout=5.0):
        ColorPrint.red("[ERROR] Tkinter failed to start in 5 seconds!")
        return False

    # Safe to proceed - Tkinter is ready
    startup_data = THREAD_BUS.get_signal('TkinterStartup_ready')
    window_id = startup_data.get('window_id')
    print(f"Tkinter ready with window ID: {window_id}")
```

**Pattern Analysis**:
- **Blocking coordination**: Use `wait_signal()` for strict dependencies
- **Timeout protection**: Always provide timeout to prevent deadlocks
- **Data passing**: Signal includes initialization data (window ID, geometry, etc.)
- **Error handling**: Check return value - `None` means timeout

**When to Use wait_signal():**
- ✅ Startup dependencies (must wait for initialization)
- ✅ Resource availability (wait for database connection)
- ✅ Sequential operations (step 1 must complete before step 2)

**When NOT to Use wait_signal():**
- ❌ Non-critical events (use event handlers instead)
- ❌ High-frequency events (will cause performance issues)
- ❌ Events that may never occur (use timeout + fallback)

---

## 🎯 Pattern 4: Graceful Shutdown Waiting

### Real-World Example: Waiting for Window Closure

**Location**: `step3_launcher/launcher_with_startup.py:311`

```python
def shutdown_tkinter_window():
    # Request window to close
    THREAD_BUS.trigger_event('window.close', {'reason': 'app_shutdown'})

    # WAIT for confirmation that window actually closed
    if THREAD_BUS.wait_signal('TkinterStartup_stopped', timeout=3.0):
        ColorPrint.green("[Launcher] Tkinter window closed gracefully")
        return True
    else:
        ColorPrint.yellow("[Launcher] Tkinter window didn't close in time, forcing...")
        return False
```

**Pattern Analysis**:
- **Request + Confirmation pattern**: Trigger action, then wait for confirmation
- **Timeout for force-quit**: If graceful fails, proceed with forceful cleanup
- **Signal names reflect lifecycle**: `_ready`, `_closed`, `_stopped`

**Lifecycle Signal Naming Convention**:
```
module_name_ready    # Module initialized and operational
module_name_closing  # Module received close request
module_name_closed   # Module UI closed (but may still be cleaning up)
module_name_stopped  # Module fully stopped (all cleanup complete)
```

---

## 🎯 Pattern 5: Event Handler with Closure (State Capture)

### Real-World Example: Dynamic Handler Registration

**Location**: `step3_launcher/launch_native_app.py:442`

```python
# Register multiple handlers dynamically with captured state
tray_menu_items = [
    {'text': 'Action 1', 'callback': action1_func},
    {'text': 'Action 2', 'callback': action2_func},
    {'text': 'Action 3', 'callback': action3_func},
]

for item in tray_menu_items:
    action_signal = item['action_signal']
    callback = item['callback']

    # CLOSURE captures 'callback' variable for this iteration
    THREAD_BUS.register_event_handler(
        action_signal,
        lambda event_data, cb=callback: cb(),  # cb= captures current callback
        priority=50
    )
```

**Why `cb=callback` is Critical**:
```python
# ❌ WRONG - all lambdas reference same 'callback' variable
for item in items:
    callback = item['callback']
    THREAD_BUS.register_event_handler(signal, lambda e: callback())
    # All handlers will call the LAST callback!

# ✅ CORRECT - each lambda captures its own callback
for item in items:
    callback = item['callback']
    THREAD_BUS.register_event_handler(signal, lambda e, cb=callback: cb())
    # Each handler calls its own callback
```

**Python Closure Gotcha**:
- Lambdas in loops share the same variable scope
- Use default parameter (`cb=callback`) to capture current value
- This is a common Python pitfall, not specific to THREAD_BUS

---

## 🎯 Pattern 6: Startup Handler Registration (Early vs Late)

### Real-World Example: Package Loading Coordination

**Location**: `step5_main_ui/pyside6/framework.py:212`

```python
def start_ui_framework(config):
    # Define handler BEFORE creating windows
    def handle_packages_loaded(event_data):
        """Called when third-party packages finish loading"""
        ColorPrint.green("[Framework] Packages loaded, continuing startup...")
        # Now safe to use packages that depend on third-party libs
        initialize_ocr_module()
        initialize_speech_module()

    # Register handler EARLY (before window creation)
    THREAD_BUS.register_event_handler(
        'system.third_party_packages_loaded',
        handle_packages_loaded,
        priority=50
    )

    # Now create UI (which may trigger the event)
    main_window = MainWindow(config)
    main_window.show()
```

**Timing Consideration**:
```
Registration BEFORE event trigger: ✅ Handler executes
Registration AFTER event trigger:  ❌ Handler misses event
```

**Best Practice**:
- **Register handlers as early as possible** in module initialization
- **Trigger events as late as possible** when action completes
- **Use signals for already-occurred events** (can check later with `has_signal()`)

---

## 🎯 Pattern 7: Async Event Triggers (Non-Blocking)

### Real-World Example: Heartbeat Tick Events

**Location**: `pyheartbeat/heartbeat.py:226`

```python
def run(self):
    """Main heartbeat loop"""
    while not self._stop_event.is_set():
        tick_start = time.time()
        self._total_ticks += 1

        try:
            # Execute callbacks...
            self._execute_callbacks()

            # Trigger tick event (ASYNC to avoid blocking heartbeat)
            THREAD_BUS.trigger_event('heartbeat.tick', {
                'tick_number': self._total_ticks,
                'timestamp': time.time(),
                'uptime': time.time() - self._start_time
            }, async_mode=True)  # ← CRITICAL: async=True

        except Exception as e:
            ColorPrint.red(f"[Heartbeat] Tick error: {e}")

        # Sleep until next tick
        elapsed = time.time() - tick_start
        sleep_time = max(0, 1.0 - elapsed)
        time.sleep(sleep_time)
```

**Why async_mode=True?**
- ❌ **Sync mode**: If a handler takes 5 seconds, heartbeat waits 5 seconds
- ✅ **Async mode**: Handlers run in separate thread, heartbeat continues immediately

**When to Use Async Mode**:
- ✅ High-frequency events (heartbeat ticks, clipboard polling)
- ✅ Performance-critical paths (startup sequence, UI updates)
- ✅ When handler duration is unpredictable (network calls, file I/O)

**When to Use Sync Mode**:
- ✅ When you need guaranteed execution order
- ✅ When handler result affects control flow
- ✅ When debugging (easier to trace synchronous execution)

---

## 🎯 Pattern 8: Shutdown Handler Priority Strategy

### Real-World Example: Coordinated Shutdown Stack

**From Our Integrations:**

```python
# Priority 0: Final UI cleanup (stops FIRST in logical order, but priority=0)
THREAD_BUS.register_shutdown_handler(
    framework.quit,  # Close PySide6 application
    priority=0,
    name="pyside6_quit"
)

# Priority 80: User input monitors
THREAD_BUS.register_shutdown_handler(
    clipboard_monitor.stop,
    priority=80,
    name="clipboard_monitor"
)

# Priority 85: Hotkey listener
THREAD_BUS.register_shutdown_handler(
    hotkey_listener.stop,
    priority=85,
    name="hotkey_listener"
)

# Priority 95: Singleton coordination
THREAD_BUS.register_shutdown_handler(
    singleton_detector.stop,
    priority=95,
    name="singleton_detector"
)

# Priority 100: Core infrastructure (stops LAST)
THREAD_BUS.register_shutdown_handler(
    heartbeat_system.stop,
    priority=100,
    name="heartbeat"
)
```

**Execution Order**:
```
0  → PySide6 UI       (UI closes first)
80 → Clipboard        (Stop monitoring user input)
85 → Hotkey           (Stop listening to keyboard/mouse)
95 → Singleton        (Allow new instances to take over)
100→ Heartbeat        (Stop last - others may need task queue)
```

**Priority Design Principles**:
1. **Leaf services stop before root services** (子进程先关)
2. **User-facing components stop early** (no new user input)
3. **Coordination mechanisms stop late** (others may need them)
4. **Infrastructure stops last** (task queues, thread pools)

---

## 🎯 Pattern 9: Conditional Shutdown Handler Registration

### Real-World Example: Service-Specific Handlers

**Location**: `step3_launcher/launch_native_app.py:166`

```python
def start_rpc_service(config):
    if not config.enable_rpc:
        return None

    # Start RPC server
    rpc_server = FastAPIServer(port=config.rpc_port)
    rpc_server.start()

    # Only register handler if service actually started
    if rpc_server.is_running():
        THREAD_BUS.register_shutdown_handler(
            rpc_server.stop,
            priority=50,
            name="rpc_server"
        )
        ColorPrint.green("[RPC] Server started and registered for shutdown")

    return rpc_server
```

**Why Conditional Registration?**
- Only running services should be in shutdown stack
- Prevents calling `stop()` on services that never started
- Avoids "already stopped" warnings in logs

**Best Practice**:
```python
def start_service():
    service = MyService()
    service.start()

    # Register AFTER confirming service started successfully
    if service.is_running():
        THREAD_BUS.register_shutdown_handler(service.stop, priority=60, name="my_service")
```

---

## 🎯 Pattern 10: Event Data as Communication Protocol

### Real-World Example: Window Close Sources

**Location**: `step5_main_ui/pyside6/main_window.py:519`

```python
# Window close button clicked
def closeEvent(self, event):
    if not self._close_requested:
        self._close_requested = True
        THREAD_BUS.trigger_event('app.close', {
            'source': 'window_close_button',  # ← Identifies origin
            'window': self
        }, async_mode=True)
        event.ignore()

# Tray menu "Exit" clicked
def on_tray_exit():
    THREAD_BUS.trigger_event('app.close', {
        'source': 'tray_menu',  # ← Different source
        'reason': 'user_request'
    })

# System shutdown signal
def on_system_shutdown():
    THREAD_BUS.trigger_event('app.close', {
        'source': 'system_shutdown',  # ← System-initiated
        'reason': 'os_shutdown'
    })
```

**Handler Can Distinguish Sources:**

```python
def handle_app_close(event_data):
    source = event_data.get('source', 'unknown')

    if source == 'window_close_button':
        # Ask user for confirmation
        if not confirm_close_dialog():
            return  # Cancel close

    elif source == 'tray_menu':
        # Tray exit - no confirmation needed
        pass

    elif source == 'system_shutdown':
        # System shutdown - save urgently and exit fast
        quick_save_critical_data()

    # Proceed with shutdown
    THREAD_BUS.request_shutdown(reason=f"App close from {source}")
```

**Event Data as Protocol**:
- **Standard fields**: `source`, `timestamp`, `reason`
- **Type-specific fields**: Varies by event type
- **Documentation**: Document expected fields in module docstring

---

## 🎯 Pattern 11: Deprecated API Migration

### Real-World Example: Gradual THREAD_BUS Adoption

**Location**: `step6_tray/tray_thread.py:92-104`

```python
class TrayThread:
    def stop(self):
        """
        Stop tray thread

        DEPRECATED: Direct method call
        RECOMMENDED: Use THREAD_BUS.trigger_event('tray.request_stop', {})
        """
        ColorPrint.yellow("[DEPRECATED] Direct tray.stop() call. Use THREAD_BUS event instead.")

        # Trigger event for new code
        THREAD_BUS.trigger_event('tray.request_stop', {'source': 'deprecated_api'})

        # Still execute stop for backward compatibility
        self._stop_internal()

    def _stop_internal(self):
        """Internal stop implementation"""
        self.running = False
        # Actual cleanup...
```

**Migration Strategy**:
1. **Phase 1**: Add THREAD_BUS events alongside old API
2. **Phase 2**: Mark old API as deprecated with warnings
3. **Phase 3**: Log usage of old API for monitoring
4. **Phase 4**: Remove old API after migration complete

**Deprecation Best Practices**:
- Keep old API working (don't break existing code)
- Log deprecation warnings to console
- Provide clear migration path in docstring
- Include timeline for removal

---

## 🎯 Pattern 12: Error Handling in Handlers

### Real-World Example: Robust Handler Implementation

**Best Practice Code**:

```python
def handle_frontend_ready(event_data):
    """
    Handle frontend ready event

    THREAD_BUS will catch exceptions, but we should handle expected errors gracefully
    """
    try:
        # Extract data with defaults
        frontend_url = event_data.get('url', 'http://localhost:3000')
        framework = event_data.get('framework', 'unknown')

        # Validate required data
        if not frontend_url:
            ColorPrint.yellow("[Handler] Frontend ready but no URL provided!")
            return

        # Perform action
        ColorPrint.green(f"[Handler] Frontend ready: {frontend_url} ({framework})")
        open_browser(frontend_url)

    except KeyError as e:
        ColorPrint.red(f"[Handler] Missing required field: {e}")
    except Exception as e:
        ColorPrint.red(f"[Handler] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
```

**Error Handling Principles**:
1. **THREAD_BUS catches exceptions**: Prevents one handler from crashing others
2. **Still handle expected errors**: Don't rely on THREAD_BUS exception catch
3. **Log failures clearly**: Include handler name and event name
4. **Fail gracefully**: Return early rather than crashing

---

## 🧪 Testing Patterns

### Pattern 13: Mock THREAD_BUS for Unit Tests

```python
import unittest
from unittest.mock import MagicMock, patch

class TestClipboardMonitor(unittest.TestCase):
    def setUp(self):
        # Mock THREAD_BUS
        self.mock_thread_bus = MagicMock()
        self.mock_thread_bus.is_shutdown_requested.return_value = False

    @patch('pycore.pyutils.clipboard.clipboard_monitor.THREAD_BUS')
    def test_clipboard_change_triggers_event(self, mock_bus):
        """Test that clipboard changes trigger THREAD_BUS events"""
        mock_bus.is_shutdown_requested.return_value = False

        monitor = ClipboardMonitor(client_id="test")
        monitor.start()

        # Simulate clipboard change
        with patch('pyperclip.paste', return_value="New content"):
            time.sleep(1.5)  # Wait for poll cycle

        # Verify event was triggered
        mock_bus.trigger_event.assert_called_with(
            'clipboard.changed',
            {
                'content': 'New content',
                'content_type': 'text',
                'client_id': 'test',
                'timestamp': unittest.mock.ANY
            },
            async_mode=True
        )
```

---

## 📊 Performance Considerations

### Event Handler Performance

**From Real Code Analysis:**

```python
# ✅ FAST: Simple lambda handlers (native_ui/system_tray.py)
THREAD_BUS.register_event_handler('window.show', lambda e: window.show())
# Overhead: ~0.1ms per event

# ✅ FAST: Direct function calls (heartbeat.py)
THREAD_BUS.trigger_event('heartbeat.tick', data, async_mode=True)
# Overhead: ~0.2ms (async thread creation)

# ⚠️  SLOW: Complex handlers with I/O
def slow_handler(event_data):
    save_to_database(event_data)  # Network I/O
    send_analytics(event_data)     # HTTP request
# Solution: Use async_mode=True to avoid blocking
```

**Performance Tips**:
1. **Use async_mode=True for I/O operations**
2. **Keep handlers lightweight** (< 10ms execution time)
3. **Offload heavy work to background threads**
4. **Limit number of handlers per event** (< 10 handlers)

---

## 🎯 Common Mistakes and Solutions

### Mistake 1: Forgetting async_mode in High-Frequency Events

```python
# ❌ BAD: Blocks heartbeat loop
THREAD_BUS.trigger_event('heartbeat.tick', data)

# ✅ GOOD: Non-blocking
THREAD_BUS.trigger_event('heartbeat.tick', data, async_mode=True)
```

### Mistake 2: Lambda Closure in Loops

```python
# ❌ BAD: All handlers call last callback
for item in items:
    cb = item['callback']
    THREAD_BUS.register_event_handler(signal, lambda e: cb())

# ✅ GOOD: Each handler captures its own callback
for item in items:
    cb = item['callback']
    THREAD_BUS.register_event_handler(signal, lambda e, callback=cb: callback())
```

### Mistake 3: Not Checking wait_signal() Return Value

```python
# ❌ BAD: Assumes signal always arrives
THREAD_BUS.wait_signal('module_ready', timeout=5.0)
data = THREAD_BUS.get_signal('module_ready')  # May be None!

# ✅ GOOD: Check return value
data = THREAD_BUS.wait_signal('module_ready', timeout=5.0)
if data is None:
    ColorPrint.red("[ERROR] Module failed to start!")
    return False
```

### Mistake 4: Registering Shutdown Handler in __init__()

```python
# ❌ BAD: Service not yet running
class MyService:
    def __init__(self):
        THREAD_BUS.register_shutdown_handler(self.stop, priority=50, name="my_service")
        # Service hasn't started yet!

# ✅ GOOD: Register when actually starting
class MyService:
    def start(self):
        self.running = True
        self.thread.start()
        THREAD_BUS.register_shutdown_handler(self.stop, priority=50, name="my_service")
```

---

## 📚 Summary: Key Takeaways

1. **Lambda handlers are fine** for simple UI actions
2. **Use async_mode=True** for high-frequency or I/O-heavy events
3. **wait_signal() is for dependencies**, event handlers are for notifications
4. **Register shutdown handlers in start()**, not `__init__()`
5. **Always check wait_signal() return value** (None = timeout)
6. **Use event data to communicate context** (source, reason, etc.)
7. **Priority numbers control execution order** (lower = earlier/higher priority)
8. **Test with mocked THREAD_BUS** for unit tests
9. **Gracefully handle deprecated APIs** during migration
10. **Keep handlers lightweight** and error-resistant

---

**Next**: Continue with device_sync modules integration (P2 priority)
