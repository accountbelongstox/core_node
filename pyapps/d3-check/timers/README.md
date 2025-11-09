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

## Architecture

### Static Global Design

All timer components are static global modules. They are initialized on module import and shared across the entire application.

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

### Data Flow

1. **Initialization** (in system_initializer.py):
   ```python
   import timers.timer_manager as timer_manager
   import timers.window_monitor_timer as window_monitor

   # Initialize window monitor and register with timer manager
   window_monitor.initialize_and_register(interval=10.0, enabled=True)

   # Start timer manager
   timer_manager.start()
   ```

2. **Registration** (in controller.run()):
   ```python
   import timers.window_monitor_timer as window_monitor

   ui = Diablo3MacroUI()
   callback = ui.get_status_bar_callback()
   window_monitor.add_callback(callback)
   ```

3. **Periodic Updates** (every 10 seconds):
   ```
   timer_manager triggers
   → window_monitor.check_window()
   → WindowFinder.find_windows()
   → game_interface_data update (fullscreen_size, window_offset)
   → window_monitor._notify_callbacks()
   → status_bar.on_window_status_update(window_info)
   → UI updates (game_status, window_size)
   ```

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

Monitors Diablo III window status and updates game interface data.

**Features:**
- Detects Diablo III window using multiple title variations
- Updates `game_interface_data` with window information
- Provides callbacks for window status changes
- Default interval: 10 seconds

**Usage:**
```python
import timers.window_monitor_timer as window_monitor

# Initialize and register (called by system_initializer)
window_monitor.initialize_and_register(interval=10.0, enabled=True)

# Add callback
window_monitor.add_callback(my_callback)

# Manual check
info = window_monitor.get_current_window_info()
```

## Quick Start

### For Application Developers

The timer system is automatically initialized. You only need to:

1. **Create UI** (in controller):
   ```python
   ui = Diablo3MacroUI()
   ```

2. **Register UI callback** (in controller):
   ```python
   import timers.window_monitor_timer as window_monitor

   callback = ui.get_status_bar_callback()
   window_monitor.add_callback(callback)
   ```

3. **Implement callback in UI** (already done in status_bar.py):
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

window_monitor updates the following in `game_interface_data`:

- `fullscreen_size`: Window dimensions (width, height)
- `window_offset`: Window position (left, top)
- `_window_hwnd`: Window handle (internal use)
- `_window_title`: Window title (internal use)

### Callback Signature

Callbacks registered with `window_monitor.add_callback()` receive:

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
- `add_callback(callback)` - Add window status callback
- `remove_callback(callback)` - Remove callback
- `check_window()` - Manual window check (called by timer)
- `get_current_window_info()` - Immediate window check

#### Constants

- `DEFAULT_INTERVAL = 10.0` - Default monitoring interval (seconds)

## Example: Full Integration

```python
# In system_initializer.py
import timers.timer_manager as timer_manager
import timers.window_monitor_timer as window_monitor

# Initialize window monitor and register
window_monitor.initialize_and_register(interval=10.0, enabled=True)

# Start timer manager
timer_manager.start()

# In controller (d3_macro_controller.py)
import timers.window_monitor_timer as window_monitor

class D3MacroController:
    def run(self):
        # Create UI
        self.ui = Diablo3MacroUI()

        # Register UI callback
        callback = self.ui.get_status_bar_callback()
        window_monitor.add_callback(callback)

        # Run UI
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
- Timer tasks should not perform blocking operations
- For UI updates, use `parent.after(0, update_function, args)` to ensure thread safety
