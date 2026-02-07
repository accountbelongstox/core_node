# d3-check agent instructions

Instructions for the Agent when working in this sub-app (pyapps/d3-check).

## Reuse and no redundancy

- **Reuse before adding.** Before writing new code, search the codebase for existing logic that can be extended (same module, d3utils, timers, controller, pycore). Prefer extending or parameterizing existing functions/classes over adding new ones. New features: first check for similar flows (e.g. one-shot tasks in `timers.one_shot_tasks`, OCR in `d3utils/ocr_helper`, key send in `d3utils/key_send`, crop in `d3utils/d3u_common/game_window_region`).
- **No redundant definitions.** Do not duplicate stdlib or project-wide APIs: no local redefinitions of the same constant, same helper, or thin wrapper that only forwards. Use `providor.app_constants` for literals; use existing d3utils/pycore helpers; do not add a second constant or function that does the same thing elsewhere.

## Code and dependencies

- Prefer **pycore** libraries. **No secondary encapsulation:** no re-exports or simple wrappers for any libs, constants, or methods. Import directly from `pycore.*`; do not use `providor.common_imports`. Constants: from `providor.app_constants`; not via `providor.providor_index`. **share = shared data only** (game_interface_data, project_path); do not put business logic or one-shot tasks in share. Shared data: from `share.game_interface_data` or `share.project_path`. D3 template matcher: from `d3utils.d3_scaled_template_matcher`. Controller handlers: from `controller.ctl_func.*` directly. Grid config: use `config.grid_config.get_grid_config()`; literals from `app_constants`. One-shot work: `timers.timer_manager.submit_one_shot` and **`timers.one_shot_tasks.do_*`** (SmartEcho: `d3utils.smart_echo.do_smart_echo_pause_after_complete`).
- For typical pycore usage in d3-check, see `.cursor/skills/d3-check/SKILL.md`.

## Configuration and constants

- **D3 and D4 constants and variables** belong in CONFIG, not in feature modules.
- **Literal constants** (paths, resolutions, IDs, keywords, timeouts): add to **`providor.app_constants`** and import where needed.
- **Structured config** (skill/macro/template config, ConfigManager, grid): use the **`config`** package (unified_config, grid_config); literals used there stay in app_constants.
- Do not add new literal constants in controller/d3utils/d4utils/ui/etc.; add them to `providor.app_constants` or the appropriate config module.

## Adding new standards (规范)

When the user asks to **add a 规范** (standard/rule), add it **by priority**:

1. **`.cursor/rules`** — Project- or file-scoped rules (globs/description). Use when the standard is "when editing these files, do X."
2. **`.cursor/skills`** — Reusable skill (SKILL.md with "When to Use" and steps). Use when the standard is a capability + usage context.
3. **`pyapps/d3-check/AGENTS.md`** — Short sub-app instructions. Use when the standard is a simple directory-level guideline.

This requirement applies to the new 规范 too: write it into rules, skills, or AGENTS.md according to the above.

## Runtime and code tree

- **Lifecycle/thread/event:** main, controller, and ui import from **`runtime`** only (get_system_initializer, execute_shutdown, get_thread_registry, event triggers, get_task_manager, is_shutdown_requested). Implementation: d3utils (logic), runtime (thread_registry), **share = shared data only**; see `docs/CODE_TREE.md`.
- **Code tree:** Full module tree and layers are in `docs/CODE_TREE.md`.

## Threads

- **禁止互相卡住.** At runtime no thread may 卡住 on another (no `queue.get()`, `join()`, etc.). All inter-thread communication goes through **event center** (THREAD_BUS; use **runtime** for triggers/handlers). At shutdown the main thread may `join(timeout)` worker threads for cleanup.
- **Init all threads at startup.** All background threads (TaskThreadManager, TimerManager, extension threads Main/Aux/D3/D4, tray, macro threads) are created and started once when UI is ready; no dynamic thread creation during run.
- **Tick-driven; per-thread state.** Execution is driven by global state and tick (timer cycle, task 1s tick, etc.). Each thread manages its own state; state updates via events or fire-and-forget enqueue; read current state from shared state, never 卡住 waiting for another thread.
- **One-shot work** via **timer_manager.submit_one_shot(callback)**; do not create new threads.
- **No simple wrapper of one class by another.** Thread classes must be native: component extends `threading.Thread` with `run()` implementing the loop, or thread run() implements logic directly. See `docs/THREAD_BUS_AND_REGISTRY.md`.

## Summary

| Need | Where |
|------|--------|
| Literal D3/D4/Battle.net constants | `providor.app_constants` |
| Skill/macro/template config | `config` (unified_config, grid_config) |
| Shared data (state, paths) | **share** (game_interface_data, project_path only; no business logic) |
| One-shot tasks (path scan, login check, ROSBOT debug, Battlenet UI, window check) | **timers.one_shot_tasks** (do_*) |
| SmartEcho (F7 + OCR resume) | **d3utils.smart_echo** |
| Lifecycle/thread/event (init, shutdown, event center, task manager, thread registry) | **runtime** (see `docs/CODE_TREE.md`) |
| Code tree and layers | `docs/CODE_TREE.md` |
| Threads: 禁止互相卡住; event center only; init all at startup; tick-driven; per-thread state | `docs/THREAD_BUS_AND_REGISTRY.md` |
| Reuse existing logic before adding; no redundant constants/methods | §Reuse and no redundancy above |
