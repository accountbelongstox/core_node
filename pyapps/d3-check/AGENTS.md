# d3-check agent instructions

Instructions for the Agent when working in this sub-app (pyapps/d3-check).

## Code and dependencies

- Prefer **pycore** libraries. **No secondary encapsulation:** no re-exports or simple wrappers for any libs, constants, or methods. Import directly from `pycore.*`; do not use `providor.common_imports`. Constants: from `providor.app_constants`; not via `providor.providor_index`. Shared data: from `share.game_interface_data` or `share.project_path`; not `from share import ...`. D3 template matcher: from `d3utils.d3_scaled_template_matcher`; no `d3utils.scaled_template_matcher` re-export. Controller handlers: from `controller.ctl_func.blacksmith_handler` / `controller.ctl_func.kanai_cube_handler` directly. Grid config: use `config.grid_config.get_grid_config()` for current grid; literals from `app_constants`. One-shot work: `timers.timer_manager.submit_one_shot` and `share.threads.do_*` directly.
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

- **Lifecycle/thread/event:** main, controller, and ui import from **`runtime`** only (get_system_initializer, execute_shutdown, get_thread_registry, event triggers, get_task_manager, is_shutdown_requested). Implementation stays in d3utils and share; see `docs/CODE_TREE.md`.
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
| Shared pycore imports | Direct `pycore.*` only (no common_imports) |
| New 规范 (standard/rule) | rules → skills → AGENTS.md (by priority above) |
| Lifecycle/thread/event (init, shutdown, event center, task manager, thread registry) | **runtime** (see `docs/CODE_TREE.md`) |
| Code tree and layers | `docs/CODE_TREE.md` |
| Threads: 禁止互相卡住; event center only; init all at startup; tick-driven; per-thread state | `docs/THREAD_BUS_AND_REGISTRY.md` |
