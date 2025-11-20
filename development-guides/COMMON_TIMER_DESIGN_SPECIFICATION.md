# Common Timer Design Specification

**Version:** 1.2
**Last Updated:** 2025-11-16
**Status:** Active Standard

**⚠️ CRITICAL: Single Timer Instance Only - Do Not Start Multiple Timers**

## Overview

Universal timer system design for all programming languages using **interceptor pattern**:
- Common timer ticks at base frequency (1 second)
- Each event controls its own execution frequency via interceptor
- Single timer instance shared by all tasks (resource efficient)

## Core Design Principles

### 1. Interceptor Pattern

- **Common Timer**: Ticks at 1-second base frequency
- **Event Interceptor**: Each event checks if interval reached before executing
- **Execution Control**: Events skip when interval not met
- **Dynamic Frequency**: Each event controls its own frequency independently

**Why This Design?**

- ✅ Single timer loop (efficient, predictable)
- ✅ No complex scheduling logic needed
- ✅ Easy to add/remove events at runtime
- ✅ Consistent tick behavior across all events
- ✅ Simple to understand and debug
- ✅ Works identically across all languages

### 2. Single Timer Instance (CRITICAL)

**⚠️ IMPORTANT: DO NOT START MULTIPLE TIMERS**

To conserve system resources, there MUST be only **ONE timer instance** per application/process:

- **Registration Mode**: All tasks register with the SAME timer instance
- **Basic Heartbeat**: One 1-second heartbeat serves all registered events
- **No Duplication**: Never create multiple timer instances or loops
- **Singleton Pattern**: Implement timer as singleton or application-scoped service

**Why Single Timer?**

- ✅ **Resource Efficient**: One timer loop vs. N timer loops
- ✅ **Predictable Load**: Fixed CPU/memory overhead regardless of task count
- ✅ **Synchronized Ticks**: All events share the same time base
- ✅ **Easier Debugging**: Single point of control and monitoring
- ✅ **Scalable**: Can handle 50+ tasks with minimal overhead

**RULE: One application/process = One timer instance**

All tasks MUST register with the SAME timer instance:

```
✓ CORRECT - Single timer, multiple tasks:
  timer.register('task1', callback1, 5)
  timer.register('task2', callback2, 10)
  timer.start()  // ONE timer loop

✗ WRONG - Multiple timers:
  timer1 = create_timer(task1, 5)
  timer2 = create_timer(task2, 10)
  // Result: 2x resource waste!
```

**Resource Cost:**
- Single timer: ~0.1% CPU, ~2MB memory (constant)
- Multiple timers: N × resources (wasteful)

### 3. Execution Flow

```
Timer Tick (every 1 second)
  ↓
For each registered event:
  ↓
  Interceptor checks: (now - last_run) >= interval?
    ├─ No  → Skip (return)
    └─ Yes → Execute callback
              Update last_run
              Update statistics
```

## Architecture Components

### Core Components

1. **TimerService** - Manages state, registry, execution
2. **Event Registry** - Stores: name, callback, interval, last_run, stats
3. **Interceptor Logic** - Checks interval before execution
4. **Statistics** - Tracks ticks, run_count, errors, duration

### API Requirements

```
TimerService:
  - register(name, callback, interval)
  - unregister(name)
  - start()
  - stop()
  - tick()
  - getStatus()
  - isRunning()
```

### Task Event Class Pattern (RECOMMENDED)

Organize tasks as classes/modules with auto-discovery:

**Interface:**
```
TaskInterface:
  - getName()       // Unique identifier
  - getInterval()   // Seconds
  - exec()          // Task logic
  - isEnabled()     // Enable check
```

**Auto-Discovery:**
```
1. Scan task directory for classes implementing TaskInterface
2. Instantiate each enabled task
3. Register with timer service
4. No manual registration needed
```

**Benefits:**
- ✅ Extensible: Add tasks by creating files
- ✅ Organized: Self-contained tasks
- ✅ Testable: Independent unit tests
- ✅ No provider changes needed

**Structure:**
```
timer_tasks/
  ├── task_interface
  ├── heartbeat_task
  ├── file_watcher_task
  └── cleanup_task

timer_provider/
  └── auto_discover_tasks()
```

## Event Intervals

| Interval | Use Case |
|----------|----------|
| 0s | Every tick |
| 1s | High frequency |
| 5s | Moderate |
| 10s | Regular checks |
| 60s | Per minute |
| 300s | 5 minutes |

**Best Practices:**
- Use multiples of base (5s, 10s, 30s)
- Keep callbacks fast (< 100ms)
- Max 20-50 events per timer

## Error Handling

**Requirements:**
1. Isolate errors (one failure doesn't stop others)
2. Track errors per event
3. Continue running after errors
4. Log diagnostics

## Statistics

**Timer Level:**
- running, total_ticks, uptime, start_time

**Event Level:**
- name, interval, run_count, error_count, last_run, last_duration, last_error

## Configuration

```bash
# Environment Variables
TIMER_ENABLED=true
TIMER_BASE_FREQUENCY=1
TIMER_LOG_LEVEL=info
TIMER_MAX_EVENTS=50
```

## Implementation Pattern

**Pseudocode:**
```
// 1. Define interface
interface TaskInterface:
    getName() -> string
    getInterval() -> int
    exec() -> void
    isEnabled() -> bool

// 2. Implement task
class HeartbeatTask implements TaskInterface:
    getName(): return "heartbeat"
    getInterval(): return 1
    exec(): write_file("/tmp/heartbeat.txt", now())
    isEnabled(): return true

// 3. Auto-discover
function auto_discover():
    for file in scan_directory("tasks/"):
        if implements(file, TaskInterface):
            task = instantiate(file)
            if task.isEnabled():
                timer.register(task.getName(), task.exec, task.getInterval())

// 4. Start timer (SINGLE INSTANCE)
timer.start()
```

## Best Practices

1. **Register, Don't Create**
   - ❌ Don't: Create new timer for each task
   - ✓ Do: Register task with existing timer

2. **Bootstrap Phase**
   - ❌ Don't: Register tasks during request handling
   - ✓ Do: Register all tasks during application boot

3. **Singleton Enforcement**
   - ❌ Don't: Allow multiple `start()` calls
   - ✓ Do: Check `isRunning()` before starting

4. **Global Access**
   - ❌ Don't: Pass timer instance around
   - ✓ Do: Use singleton/static access

5. **Cleanup**
   - ❌ Don't: Leave timer running after shutdown
   - ✓ Do: Call `stop()` on application shutdown

## Migration from Multiple Timers

**Before:**
```
timer1 = create_timer(task1, 1s)
timer2 = create_timer(task2, 1s)
timer3 = create_timer(task3, 1s)
```

**After:**
```
timer.register('task1', task1, 5)
timer.register('task2', task2, 10)
timer.register('task3', task3, 30)
timer.start()  // Single instance
```

**Benefits:** 3x resource reduction, centralized management

## Troubleshooting

- **Timer Not Starting**: Check `isRunning()`, verify platform, review logs
- **Events Not Executing**: Verify `getStatus()`, check interval, review errors
- **Performance Issues**: Limit events (max 50), profile callbacks, use async I/O

## Implementation References

Language-specific implementations:

- **PHP/Laravel:** `/poly_apps/laravel_main/app/Services/OctaneTimerService.php`
- **Python:** `/pycore/pyutils/timer/timer_service.py`
- **TypeScript:** `/ncore/nutils/timer/TimerService.ts`
- **Rust:** `/rcore/rutils/timer/timer_service.rs`

## Version History

- **v1.2** (2025-11-16)
  - Added Task Event Class Pattern (auto-discovery)
  - Interface-based task definition
  - Benefits: extensible, organized, testable

- **v1.1** (2025-11-16)
  - Resource conservation emphasis
  - Single timer requirement
  - Language-agnostic specification

- **v1.0** (2025-11-16)
  - Initial specification
  - Interceptor pattern
  - Basic 1-second heartbeat

---

**License:** Follows core_node project license
