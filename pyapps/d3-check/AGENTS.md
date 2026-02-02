# d3-check agent instructions

Instructions for the Agent when working in this sub-app (pyapps/d3-check).

## Code and dependencies

- Prefer **pycore** libraries. **No secondary encapsulation:** no re-exports or simple wrappers for any libs, constants, or methods. Import directly from `pycore.pyfoundations` / `pycore.pyutils` (e.g. `from pycore.pyfoundations.color_print import ColorPrint`); do not use `providor.common_imports`. Constants: import from `providor.app_constants`; do not re-export via `providor.providor_index`. Shared data: import from `share.game_interface_data` or `share.project_path`; do not use `from share import ...`. One-shot work: use `timers.timer_manager.submit_one_shot` and `share.threads.do_*` directly; do not call ThreadRegistry.run_* wrappers.
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

## Threads

- **No dynamic thread creation** (prevents freezing). All threads start together with UI; execution is driven by global state and tick. One-shot work must be submitted via **timer_manager.submit_one_shot(callback)**; do not create new threads.
- **No simple wrapper of one class by another.** Thread classes must be native: either the component extends `threading.Thread` (e.g. `SystemTray(threading.Thread)` with `run()` implementing the tray loop) or the thread class’s `run()` implements the loop/logic directly and does not merely call another object’s single method. See `docs/THREAD_BUS_AND_REGISTRY.md`.

## Summary

| Need | Where |
|------|--------|
| Literal D3/D4/Battle.net constants | `providor.app_constants` |
| Skill/macro/template config | `config` (unified_config, grid_config) |
| Shared pycore imports | Direct `pycore.*` only (no common_imports) |
| New 规范 (standard/rule) | rules → skills → AGENTS.md (by priority above) |
| Threads: no dynamic creation; start with UI, tick-driven | `docs/THREAD_BUS_AND_REGISTRY.md` |
