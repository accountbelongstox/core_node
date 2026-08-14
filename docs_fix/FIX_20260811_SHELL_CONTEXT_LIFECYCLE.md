# Shell Context Lifecycle Fix

## Scope

This change follows `_prompts/队列中心.txt` by keeping the Queue Center UI under
one shell state owner without adding wrappers, polling, or fallback state.

## Cause

- `ShellContext.tsx` mixed a React Provider component with non-component Context
  and Hook exports. Vite Fast Refresh can invalidate that module and propagate a
  partial development reload, leaving a consumer render paired with a different
  Context instance.
- The React root was owned by Qt WebEngine but had no explicit page-exit cleanup,
  so global Queue Center subscriptions could remain mounted while the native host
  removed the page.

## Changes

- Kept the Context and `useShell` Hook in the non-component context module.
- Moved the single `ShellProvider` implementation into a component-only module.
- Preserved one Provider for both the unified shell and standalone builds.
- Added one idempotent `pagehide` handler at the React root that calls
  `root.unmount()` before the external WebEngine page is discarded.
- Routed the THREAD_BUS PySide6 shutdown handler through the existing Qt Signal
  bridge instead of mutating and closing WebEngine widgets from the background
  event-dispatch thread.
- Kept UI shutdown at priority 0 so Qt queues browser teardown before the
  higher-priority RPC, scheduler, and worker handlers run.

## Common Lifecycle Consolidation

- Added `ShellRuntime` as the only owner of `TaskPersistenceProvider`,
  `BrowserRouter`, `ShellProvider`, `AppToaster`, and `GlobalLoginHost`.
- Unified full-shell and standalone lazy-route loading through one translated
  `ShellRouteFallback` and added the root `common.loading` translation.
- Removed the duplicate provider stacks from `ShellApp` and `StandaloneApp`;
  both now supply only their route content to `ShellRuntime`.
- Made `PySide6Framework.quit()` the idempotent cleanup state machine for title
  bar, Ctrl+C, direct framework use, and THREAD_BUS shutdown.
- Removed the Ctrl+C `qt_app.quit()` bypass. Every native exit now performs tick
  timer, tray, window, WebEngine, and Qt application cleanup through `quit()`.

## Static Lifecycle Derivation

1. Unified shell startup creates one React root, then `ShellRuntime` creates one
   router and one shell state owner before any `useShell` consumer mounts.
2. Standalone startup follows the same root and provider order; only its route
   selector differs, so flavor switching cannot create a second shell owner.
3. A lazy route renders the shared fallback inside `ShellProvider`; language
   changes resolve through the central i18n table without route-local strings.
4. Fast Refresh sees component-only `ShellProvider` and `ShellRuntime` modules.
   The Context/Hook module contains no component boundary, so incompatible
   Context changes propagate as a full reload instead of a partial mismatch.
5. Native or tray close requests THREAD_BUS shutdown. The priority-0 handler
   emits the shared Qt close signal; `quit()` runs on the Qt thread and its guard
   permits cleanup exactly once.
6. A synchronous Qt-thread shutdown may re-enter `quit()` through the signal.
   The inner call performs cleanup and sets the guard; the outer call observes
   the guard and returns without closing widgets twice.
7. A background-thread shutdown queues the same signal and never mutates Qt
   widgets directly. The browser `pagehide` handler unmounts the single React
   root, releasing Queue Center subscriptions before WebEngine discards the DOM.
8. Direct framework use without launcher handlers still completes: the first
   `quit()` requests global shutdown, then performs local cleanup when no nested
   handler has already done so.
9. Repeated close, Ctrl+C, or shutdown notifications observe `_quit_started` and
   cannot duplicate tray cleanup, window close, or `QApplication.quit()`.

## Queue Center Base Audit

- Browser delivery receipts, bounded task IDs, Worker presence, timers, and
  subscriptions remain centralized in `QueueDeliveryRuntimeBase`; WordNew only
  supplies resource-key and enqueue-response mapping.
- Persistent Pycore typed pull, accept, result, endpoint ownership, priority,
  segment capacity, and retry circuit behavior remain centralized in
  `BaseLaravelWorkerService`.
- mcp-chrome simple workers and the Bing dictionary worker both inherit
  `LaravelWorkerLifecycleBase` for register, heartbeat, unregister, and shared
  `WorkerApiClient` ownership.
- Laravel enqueue-or-promote behavior remains centralized in
  `QueueCenterService::schedule()` with no controller-side queue query added.
- No parallel Queue Center state model or worker lifecycle base was introduced
  by this change.

## Verification Boundary

No tests, builds, services, or runtime verification commands were run, as
required by the project instructions.
