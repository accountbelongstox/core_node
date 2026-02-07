# THREAD_BUS and thread registry (d3-check)

## 1. Thread communication channel

- Inter-thread communication uses a single global channel (queue/signal/event). Threads must not pass parameters by direct reference or block waiting on another thread (no blocking wait for another thread’s return or completion).
- Extension threads receive commands and report completion through this channel; the main thread schedules UI updates on itself, not from other threads.

## 2. No blocking between threads

- **During normal operation**: No thread may block waiting for another thread’s return or termination; otherwise the main thread or UI will block.
- **During shutdown**: The main thread may wait for worker threads to finish (with a timeout) for cleanup; otherwise no cross-thread blocking is allowed.
- **Communication**: Notify via the event channel; the target thread or main thread handles events in its own loop or via registered handlers.
- **Commands and state**: Start/stop and state changes for task threads, timer, extension threads, etc. are enqueued without blocking (fire-and-forget); the worker handles them in its own loop. When current status is needed, read from shared state; do not synchronously wait for a return value from another thread.

## 3. Thread registry

- A single registry is the only place that creates and holds thread instances; no dynamic creation of threads during normal operation.
- All background threads are created and started once when the UI is ready.
- No component creates or holds its own worker thread; no thread holds a direct reference to another or blocks on another.
- Each thread manages its own state; state changes are communicated by events or non-blocking enqueue; no thread blocks waiting for another’s return.
- Long-lived threads (extension threads, tray, macro fallback, game-interface macro, task workers, etc.) are created at startup by the registry/initializer.
- Threads are implemented as native thread classes (direct subclass, run() implements the loop), not as wrappers that only delegate to another object.
- One-off work (path scan, login check, refresh, UI analysis, window check, etc.) is submitted to an existing timer/worker thread; no new thread is created for it.

## 4. Summary

| Item | Requirement |
|------|-------------|
| Blocking between threads | Forbidden during normal run; use event channel; read from shared state; on shutdown, main thread may join with timeout |
| Creating/holding threads | Only the registry/initializer; no dynamic thread creation |
| Startup | All threads initialized once when UI is ready |
| Driving logic | Tick-driven; each thread manages its own state |
| One-off work | Submit to existing timer/worker thread; do not create a new thread |
| Communication | Event channel only (signals, events, non-blocking queue) |
| Thread implementation | Native: direct subclass, run() implements logic |

Task/flow manager: external API is fire-and-forget; when task status is needed, read from shared snapshot; no cross-thread blocking wait. Internal worker may block on its own queue; callers do not block.

## 5. Config and threads

- Config is read/written by a single worker thread via a queue; callers that request read/write block until the worker has processed the request.
- Only the main thread or threads that are not the config worker may call config read/write. Code that runs on the config worker (e.g. during config save or anything called from it) must not perform a config read that blocks on that worker; that causes deadlock.
- Log/print callbacks are run synchronously on the calling thread. When the config worker triggers such a callback (e.g. while saving config), the callback runs on the config worker thread. If the callback body performs a config read that blocks until the worker answers, the worker blocks on itself and deadlocks.
- **Requirement**: In callbacks that are invoked synchronously from log/print (on whatever thread called log/print), do not read config in the synchronous part of the callback. For filtering or behavior that depends on config, read config only in code that runs on the main thread (e.g. in the work scheduled to the main thread after the callback).
- **Requirement**: A config “set” must allow the main thread to resume as soon as in-memory config is updated; the main thread must not wait for disk write to finish.

## 6. Imports

- Imports are at the top of the file. The only allowed exception is a documented lazy import used to break a circular dependency; all other modules keep top-level imports.

## 7. Related files

- Event center
- Thread registry
- Macro fallback and game-interface macro thread classes
- System tray (native thread, no wrapper)
- Design overview §4
- Timer and UI wiring
- Shutdown and extension threads (lazy import for extension getters is documented in §6)
