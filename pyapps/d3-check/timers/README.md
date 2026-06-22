# Timer System

Centralized timer management system for periodic task execution.

## Overview

The timer system provides a flexible way to register and execute periodic tasks at specified intervals.

**All components are static global modules** - import directly without instantiation:

```python
import timers.timer_manager as timer_manager
import timers.window_monitor_timer as window_monitor
```

Components:
- **timer_manager**: Static global module for timer tasks
- **window_monitor**: Static global module for Diablo III window monitoring
- Thread-safe operation with automatic error recovery

## Thread Registry and THREAD_BUS

- **Thread lifecycle**: All thread instances are created and held only in **ThreadRegistry** (`share/thread_registry.py`). **No dynamic thread creation**—all threads start together with UI; execution is driven by global state and tick. The main thread references threads only via `get_thread_registry()` (e.g. `create_extension_threads`, `run_path_scan`, `start_timer_loop_after_ui_ready`). No component uses `self.xxx_thread` to own a thread.
- **One-shot work**: Path scan, login check, refresh status, Battle.net UI analyze, and window monitor initial check are submitted to the **timer thread** via `timer_manager.submit_one_shot(callback)`; no new thread is ever created for these. See `docs/THREAD_BUS_AND_REGISTRY.md`.
- **Communication**: All inter-thread communication goes through **pycore THREAD_BUS** / **event_center** (signals, events, queues). Threads do not reference each other. See `d3utils/event_center.py` and pycore `pyfoundations/thread_bus.py`.

## Architecture

### Static Global Design

All timer components are static global modules. They are initialized on module import and shared across the entire application. The timer loop is started via **ThreadRegistry** after UI is ready; one-shot work (path scan, login check, refresh, Battle.net UI analyze, initial window check) is submitted via **timer_manager.submit_one_shot()**—no new threads are created.

```
┌─────────────────────────────────────────────────────────────┐
│                     system_initializer                       │
│  - Imports static global modules                            │
│  - Registers UI callback to window_monitor                  │
│  - Acts as mediator between UI and timer system             │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             ▼                                ▼
    ┌────────────────┐              ┌─────────────────┐
    │ timer_manager  │              │       UI        │
    │ (static)       │              │  - status_bar   │
    │ - Task queue   │              │  - Provides     │
    │ - Triggers     │              │    callback     │
    └────────┬───────┘              └─────────────────┘
             │
             ▼
    ┌────────────────────┐
    │  window_monitor    │
    │  (static)          │
    │  - check_window()  │
    │  - _callbacks[]    │───────────────┐
    └──────┬─────────────┘               │
           │                             │
           ▼                             ▼
    ┌───────────────────┐      ┌──────────────────────┐
    │ game_interface_   │      │ UI callback          │
    │ data              │      │ on_window_status_    │
    │ - Shared data     │◄─────│ update()             │
    └───────────────────┘      └──────────────────────┘
```

### Timer and UI as sibling modules

**Timer** (`timers/`) and **UI** (`ui/`) are peer submodules. Neither imports the other. The **main thread (controller)** imports both and wires them:

- Controller imports `timers.window_monitor_timer` and creates UI (which creates ROSBOT panel).
- Controller registers status UI: `window_monitor.register_status_ui(panel.get_status_ui_callback())`.
- Controller injects refresh fn: `panel.set_refresh_status_fn(window_monitor.check_window)` so the panel’s “refresh-status” button can trigger the same check without importing the timer.
- Controller starts the timer loop and first check only after UI is ready: `get_system_initializer().start_timer_loop_after_ui_ready()` (called before `ui.run()`).

All imports are at the top of each file; no inline imports. No cross-import between timer and UI.

### Data Flow

1. **Initialization** (in system_initializer.py, main thread):
   ```python
   import timers.timer_manager as timer_manager
   import timers.window_monitor_timer as window_monitor

   # Register window monitor and log_monitor with timer manager (do NOT start loop yet)
   window_monitor.initialize_and_register(interval=10.0, enabled=True)
   # timer_manager.start() is NOT called here; see start_timer_loop_after_ui_ready()
   ```

2. **Registration and timer start** (in controller.run(), main thread):
   ```python
   import timers.window_monitor_timer as window_monitor

   self.ui = Diablo3MacroUI()
   panel = self.ui.rosbot_extension_panel

   # Wire timer and UI from controller (no cross-import)
   window_monitor.register_status_ui(panel.get_status_ui_callback())
   panel.set_refresh_status_fn(window_monitor.check_window)

   window_monitor.add_callback(self.ui.get_window_status_callback())  # D3 window info

   get_system_initializer().start_timer_loop_after_ui_ready()  # start loop + one check
   self.ui.run()
   ```

3. **Periodic Updates** (every 10 seconds):
   ```
   timer_manager triggers
   → window_monitor.check_window()
   → d3_status_provider.refresh_d3_status()   (D3 window + dynamic state + geometry)
   → battlenet_status_provider.refresh_battlenet_status()   (Battle.net window + dynamic state)
   → game_interface_data updated (d3_running, battlenet_window_found, d3_*/battlenet_* dynamic flags)
   → game_interface_data._notify_callbacks(state)   (status UI registered via register_status_ui)
   → window_monitor._notify_callbacks(d3_window_info)   (D3 window info callbacks)
   → UI updates (Battle.net/D3 status with priority: disconnected > on_login_screen > in_game/normal)
   ```
   D3 and Battle.net status are provided by separate modules (`d3_status_provider`, `battlenet_status_provider`); shared refresh flow is in `d3utils/status_provider_common.py`. See DESIGN.md §3.12.

## Key Principles

### 1. Static Global Modules

All timer components are static global modules:

```python
# Import static global modules
import timers.timer_manager as timer_manager
import timers.window_monitor_timer as window_monitor

# Use directly (no instantiation)
timer_manager.start()
window_monitor.add_callback(my_callback)
```

### 2. No Dynamic Instances

**Wrong way** (old approach):
```python
from timers import get_timer_manager, get_window_monitor
timer_mgr = get_timer_manager()  # ❌ No longer exists
window_mon = get_window_monitor()  # ❌ No longer exists
```

**Right way** (static global):
```python
import timers.timer_manager as timer_manager
import timers.window_monitor_timer as window_monitor
# All references point to same static global instance
```

### 3. Shared Data Center

All components read/write to `game_interface_data` (singleton):

```python
from d3utils.share.game_interface_data import get_game_interface_data

shared_data = get_game_interface_data()

# Timer updates data
shared_data.fullscreen_size = (width, height)
shared_data.window_offset = (left, top)

# UI reads data (optional, but can also receive via callback parameter)
window_size = shared_data.fullscreen_size
```

## Status providers (D3 / Battle.net)

Window monitor does **not** use a single generic "window status" module. Each tick it calls:

- **d3_status_provider.refresh_d3_status()** – D3 window find, dynamic state (on_login_screen, disconnected, in_game), geometry → game_interface_data.
- **battlenet_status_provider.refresh_battlenet_status()** – Battle.net window find, dynamic state (on_login_screen, disconnected, normal_available) → game_interface_data.

Shared refresh flow (set running → apply geometry → detect dynamic triple → set dynamic) lives in **d3utils/status_provider_common.py**; each provider supplies its own find/detect/geometry logic. See **DESIGN.md §3.12**.

## Components

### timer_manager (Static Global Module)

Manages multiple timer tasks with different intervals.

**Features:**
- Register/unregister tasks dynamically
- Enable/disable individual tasks
- Automatic error recovery (disables task after 5 consecutive errors)
- Thread-safe operation

**Usage:**
```python
import timers.timer_manager as timer_manager

# Register task
timer_manager.register_task(
    name="my_task",
    interval=5.0,
    callback=my_function,
    enabled=True
)

# Control
timer_manager.start()
timer_manager.enable_task("my_task")
timer_manager.disable_task("my_task")
timer_manager.stop()
```

### window_monitor (Static Global Module)

Calls D3 and Battle.net status providers each tick; updates game interface data and notifies callbacks.

**Features:**
- Each tick: calls `d3_status_provider.refresh_d3_status()` then `battlenet_status_provider.refresh_battlenet_status()` (no generic "window status" layer).
- Updates `game_interface_data` (d3_running, battlenet_window_found, and dynamic state: on_login_screen, disconnected, in_game/normal_available).
- Status UI: `register_status_ui(callback)` registers callback on `game_interface_data`; when providers update state, callback(state) is invoked. D3/Battle.net state is independent of rosbot.
- D3 window info callbacks: `add_callback(callback)` receives D3 window dict or None each tick.
- Default interval: 10 seconds.

**Usage:**
```python
# In controller (timer and UI are sibling modules; controller wires them)
import timers.window_monitor_timer as window_monitor

# Initialize and register (called by system_initializer; does NOT start loop)
window_monitor.initialize_and_register(interval=10.0, enabled=True)

# Register status UI from controller (callback = panel.get_status_ui_callback())
window_monitor.register_status_ui(my_state_callback)

# Inject refresh fn into panel so refresh-status button can call check_window without importing timer
panel.set_refresh_status_fn(window_monitor.check_window)

# Add D3 window info callback (receives D3 window dict or None)
window_monitor.add_callback(my_window_callback)

# Manual check (D3 window only)
info = window_monitor.get_current_window_info()
```

## Quick Start

### For Application Developers

Timer and UI are sibling modules; only the controller imports and wires them.

1. **Create UI** (in controller):
   ```python
   self.ui = Diablo3MacroUI()
   panel = self.ui.rosbot_extension_panel
   ```

2. **Register status UI and refresh fn** (in controller):
   ```python
   import timers.window_monitor_timer as window_monitor

   window_monitor.register_status_ui(panel.get_status_ui_callback())
   panel.set_refresh_status_fn(window_monitor.check_window)
   window_monitor.add_callback(self.ui.get_window_status_callback())
   ```

3. **Start timer loop after UI ready** (in controller, before mainloop):
   ```python
   get_system_initializer().start_timer_loop_after_ui_ready()
   self.ui.run()
   ```

4. **Implement callback in UI** (already done in status_bar.py and rosbot_extension_panel):
   ```python
   def on_window_status_update(self, window_info):
       if window_info:
           width = window_info.get('width', 0)
           height = window_info.get('height', 0)
           # Update UI
       else:
           # Window not found
   ```

That's it! The timer system will handle the rest.

### Adding Custom Timer Tasks

You can register custom timer tasks:

```python
import timers.timer_manager as timer_manager

# Define your task function
def my_periodic_task():
    print("Executing periodic task...")
    # Your code here

# Register the task
timer_manager.register_task(
    name="my_task",
    interval=5.0,  # Execute every 5 seconds
    callback=my_periodic_task,
    enabled=True
)

# Disable task temporarily
timer_manager.disable_task("my_task")

# Re-enable task
timer_manager.enable_task("my_task")

# Unregister task
timer_manager.unregister_task("my_task")
```

## Window Monitor Details

### Data Updates

window_monitor (via d3_status_provider and battlenet_status_provider) updates the following in `game_interface_data`:

- **D3**: `d3_running`, `fullscreen_size`, `window_offset`, `_window_hwnd`, `_window_title`; dynamic: `d3_on_login_screen`, `d3_disconnected`, `d3_in_game`.
  - **d3_disconnected**: SIFT match of template `d3_disconnected` (image `images/d3_disconnected.png`, constant `config.constants.D3_DISCONNECTED_TEMPLATE_NAME`) inside the D3 window via `get_scaled_template_matcher().match_template_auto_scale(window_image, template_name)` (D3 matcher uses its built-in D3_STANDARD_* to derive scale from window size); when found, state is set to disconnected for status UI.
- **Battle.net**: `battlenet_window_found`; dynamic: `battlenet_on_login_screen`, `battlenet_disconnected`, `battlenet_normal_available`.

Display priority for both: disconnected > on_login_screen > in_game / normal_available. See DESIGN.md §3.12.

### Callback Signatures

**Status UI** (registered with `window_monitor.register_status_ui(callback)`): receives full `state` dict (battlenet_window_found, d3_running, rosbot_running, map_type, game_stage, d3_on_login_screen, d3_disconnected, d3_in_game, battlenet_on_login_screen, battlenet_disconnected, battlenet_normal_available).

**D3 window info** (registered with `window_monitor.add_callback(callback)`): receives D3 window dict or None:

```python
def callback(window_info: Optional[Dict]):
    """
    window_info contains:
    - hwnd: Window handle
    - title: Window title
    - class_name: Window class name
    - rect: (left, top, right, bottom)
    - width: Window width
    - height: Window height

    window_info is None if window not found
    """
    pass
```

## API Reference

### timer_manager (Static Global Module)

#### Functions

- `register_task(name, interval, callback, enabled=True)` - Register a timer task
- `unregister_task(name)` - Unregister a timer task
- `enable_task(name)` - Enable a task
- `disable_task(name)` - Disable a task
- `start()` - Start the timer manager
- `stop()` - Stop the timer manager
- `is_running()` - Check if running
- `get_task_status(name)` - Get task status
- `get_all_tasks_status()` - Get all tasks status

### window_monitor (Static Global Module)

#### Functions

- `initialize_and_register(interval, enabled)` - Initialize and register with timer_manager
- `register_status_ui(callback)` - Register callback on game_interface_data; callback(state) when D3/Battle.net state updates (state includes dynamic flags; independent of rosbot)
- `add_callback(callback)` - Add D3 window info callback (callback receives D3 window dict or None each tick)
- `remove_callback(callback)` - Remove D3 window info callback
- `check_window()` - Called by timer; calls refresh_d3_status(), refresh_battlenet_status(), then _notify_callbacks(d3_info)
- `get_current_window_info()` - Immediate D3 window check (uses d3_status_provider.get_current_d3_window())

#### Constants

- `DEFAULT_INTERVAL = 10.0` - Default monitoring interval (seconds)

## Example: Full Integration

```python
# In system_initializer.py (all imports at top)
import timers.timer_manager as timer_manager
import timers.window_monitor_timer as window_monitor
import threading

# Initialize: register tasks only (do NOT start timer loop)
window_monitor.initialize_and_register(interval=10.0, enabled=True)

def start_timer_loop_after_ui_ready(self):
    if not timer_manager.is_running():
        timer_manager.start()
    threading.Thread(target=window_monitor.check_window, daemon=True).start()

# In controller (d3_macro_controller.py, all imports at top)
import timers.window_monitor_timer as window_monitor

class D3MacroController:
    def run(self):
        self.ui = Diablo3MacroUI()
        panel = self.ui.rosbot_extension_panel

        # Wire timer and UI from controller (timer and UI are sibling modules)
        window_monitor.register_status_ui(panel.get_status_ui_callback())
        panel.set_refresh_status_fn(window_monitor.check_window)
        window_monitor.add_callback(self.ui.get_window_status_callback())

        get_system_initializer().start_timer_loop_after_ui_ready()
        self.ui.run()

# In UI (diablo3_macro_ui.py)
class Diablo3MacroUI:
    def get_status_bar_callback(self):
        """Provide callback for window monitoring"""
        return self.status_bar.on_window_status_update

# In status_bar.py
class StatusBar:
    def on_window_status_update(self, window_info):
        """Callback invoked by window_monitor"""
        if window_info:
            # Update UI to show game running
            width = window_info.get('width', 0)
            height = window_info.get('height', 0)
            self.parent.after(0, self._update_game_status, True)
            self.parent.after(0, self._update_window_size, f"{width}x{height}")
        else:
            # Update UI to show game not running
            self.parent.after(0, self._update_game_status, False)
            self.parent.after(0, self._update_window_size, "0x0")
```

## Important Notes

- **Static Global**: All timer components are static global modules
- **No Instantiation**: Import and use directly, no need to create instances
- **Thread Safety**: All operations are thread-safe
- **Error Recovery**: Tasks with 5 consecutive errors are automatically disabled
- **UI Updates**: For UI updates from callbacks, use `parent.after(0, update_function, args)` to ensure thread safety
- **Shared Data**: All components use `game_interface_data` as shared data center

## Shutdown

The timer system is automatically shut down:

```python
import timers.timer_manager as timer_manager

# Shutdown (stops all timers)
timer_manager.stop()
```

Or use the shutdown manager:

```python
from d3utils.shutdown_manager import execute_shutdown

# This will stop timer_manager automatically
execute_shutdown()
```

## Notes

- The timer system uses a single background thread for all tasks
- Tasks are checked every 100ms for execution
- Tasks with 5 consecutive errors are automatically disabled
- All operations are thread-safe
- Timer tasks should not perform operations that block (get stuck)
- For UI updates, use `parent.after(0, update_function, args)` to ensure thread safety
