# Common Timer Design Specification

**⚠️ CRITICAL: One application/process = ONE timer instance. Never start multiple timers.**

## Core design

Universal timer for all languages using the **interceptor pattern**:
- A single common timer ticks at a 1-second base frequency.
- Each registered event controls its own frequency: on every tick its interceptor checks `(now - last_run) >= interval` and skips if not met.
- One timer instance is shared by all tasks — fixed CPU/memory overhead regardless of task count (~0.1% CPU, ~2MB). N timers = N× waste.

All tasks register with the SAME instance; implement the timer as a singleton / application-scoped service. Register during application boot (not request handling), guard against multiple `start()` calls via `isRunning()`, and `stop()` on shutdown.

## Execution flow

```
Timer tick (every 1s)
  → for each registered event:
      interceptor: (now - last_run) >= interval?
        No  → skip
        Yes → run callback, update last_run + stats
```

## API

```
TimerService:
  register(name, callback, interval)
  unregister(name)
  start() / stop() / tick()
  getStatus() / isRunning()
```

## Task event pattern (recommended)

Define tasks as classes implementing a `TaskInterface` and auto-discover them:

```
TaskInterface: getName() / getInterval() / exec() / isEnabled()

auto_discover():
  scan task directory → instantiate enabled tasks → register with timer
```

Benefits: add a task by creating a file; self-contained and independently testable; no provider changes.

## Intervals & limits

- Use multiples of the 1s base (5s, 10s, 30s, 60s, 300s); `0s` = every tick.
- Keep callbacks fast (< 100ms); max ~20-50 events per timer.

## Error handling

Isolate errors (one failing event must not stop others), track error count per event, continue running, and log diagnostics. Track timer-level stats (running, total_ticks, uptime) and per-event stats (run_count, error_count, last_run, last_duration, last_error).

## Implementation references

- **PHP/Laravel:** `/poly_apps/laravel_main/app/Services/OctaneTimerService.php`
- **Python:** `/pycore/pyutils/timer/timer_service.py`
- **TypeScript:** `/ncore/nutils/timer/TimerService.ts`
- **Rust:** `/rcore/rutils/timer/timer_service.rs`
