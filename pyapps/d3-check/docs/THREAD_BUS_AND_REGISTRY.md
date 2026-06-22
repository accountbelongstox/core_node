# THREAD_BUS and thread registry (d3-check)

## 1. Communication channel

- Inter-thread communication uses a single global channel (event center / THREAD_BUS). No direct reference passing or blocking wait for another thread’s return or completion.
- Extension threads receive commands and report via this channel; main thread schedules UI updates on itself.

## 2. No blocking between threads

- **Normal operation**: No thread may block waiting for another’s return or termination. Shutdown: main thread may join(timeout) workers for cleanup.
- **Commands and state**: Start/stop and state changes are enqueued without blocking (fire-and-forget); worker handles in its own loop. When current status is needed, read from shared state; do not synchronously wait for another thread’s return.

## 3. Thread registry

- A single registry creates and holds all thread instances; no dynamic creation during normal operation. All background threads created and started once when UI is ready.
- No component creates its own worker or holds a direct reference that blocks on another. Each thread manages its own state; changes via events or non-blocking enqueue.
- Threads are native (direct subclass, run() implements the loop), not wrappers that only delegate. One-off work is submitted to an existing timer/worker thread; no new thread for it.

## 4. Summary

| Item | Requirement |
|------|-------------|
| Blocking | Forbidden at runtime; event channel; read shared state; shutdown: main may join(timeout) |
| Creating threads | Only registry/initializer; no dynamic creation |
| One-off work | Submit to existing timer/worker; do not create new thread |
| Communication | Event channel only |
| Implementation | Native: run() implements logic |

Task/flow API: fire-and-forget; when status needed, read from shared snapshot. Internal worker may block on its own queue; callers do not block.

## 5. Config worker and deadlock

- Config is read/written by a single worker thread via queue; callers block until processed.
- **Requirement**: Code that runs on the config worker (e.g. during save or anything called from it) must not perform a config read that blocks on that worker — deadlock. In callbacks invoked synchronously from log/print (on the calling thread), do not read config in the synchronous part; read config only in code that runs on the main thread (e.g. in work scheduled to main after the callback).
- **Requirement**: A config “set” must allow the main thread to resume as soon as in-memory config is updated; main thread must not wait for disk write to finish.

## 6. Related

- Event center, thread registry, macro fallback / game-interface macro threads, system tray, DESIGN.md §4, shutdown.
