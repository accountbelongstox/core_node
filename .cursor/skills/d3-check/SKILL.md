---
name: d3-check
description: When working on pyapps/d3-check (Diablo III/IV macro and automation), prefer pycore libraries and put D3/D4 constants and variables in CONFIG (config package and providor/app_constants).
---

# d3-check Sub-App Skill

Use this skill when editing or adding code under **pyapps/d3-check** (Diablo III/IV macro, Battle.net automation, grid/screenshot, D4 extensions).

## When to Use

- Editing or adding code under `pyapps/d3-check/` (controller, d3utils, d4utils, ui, share, config, providor, etc.).
- Adding or changing Diablo III / Diablo IV / Battle.net related behavior.
- Choosing where to put constants, config, or shared utilities used by d3-check.

## Instructions

### 1. Reuse existing logic; no redundant definitions

- **Reuse before adding.** Before writing new code, search the codebase for existing logic that can be extended: same module, `d3utils` (e.g. ocr_helper, key_send, smart_echo, game_window_region, screenshot_provider), `timers.one_shot_tasks`, controller, pycore. Prefer extending or parameterizing existing functions/classes over adding new ones. Example: new one-off task → add to `timers.one_shot_tasks` or extend a similar `do_*`; new key send → extend `d3utils.key_send`; new crop region → extend `d3utils.d3u_common.game_window_region`.
- **No redundant definitions.** Do not duplicate stdlib or project-wide APIs: no local redefinitions of the same constant, same helper, or thin wrapper that only forwards. Use `providor.app_constants` for literals; use existing d3utils/pycore helpers; do not add a second constant or function that does the same thing in another file.

### 2. Prefer pycore

- Use pycore first; direct imports from `pycore.pyfoundations` / `pycore.pyutils`; no `providor.common_imports`.

### 3. Constants → CONFIG

- Literals → `providor.app_constants`; structured → `config` (unified_config, grid_config). No new literals in feature modules.

### 4. New standards

Add by priority: (1) `.cursor/rules` (2) `.cursor/skills` (3) `AGENTS.md`. No duplicate; canonical = `docs/PROJECT_STANDARDS.md`.

### 5. ttk Notebook Tab (equal height)

Selected/unselected same height. Ref: `ui/diablo3_macro_ui.py` (_apply_tab_layout, _apply_notebook_theme). Layout: Notebook.tab → padding → label only; padding identical for selected/!selected; expand map; tabmargins [1,3,1,0]; theme clam.

### 6. Threads

No cross-thread blocking (no queue.get/join at runtime); event center only; init all at startup; one-shot via timer_manager.submit_one_shot; native Thread (run() implements loop). See `docs/THREAD_BUS_AND_REGISTRY.md`.

### 7. No secondary encapsulation

No re-exports, wrappers, or one-class-forwards-to-another. Direct calls and imports only.
- **Imports:** pycore direct; constants from `providor.app_constants`; shared data from `share.game_interface_data`/`share.project_path` (迁移后 `share.values`); shared functions from `share.common`; D3 matcher from `d3utils.d3_scaled_template_matcher`; controller from `controller.ctl_func.*`; grid from `config.grid_config.get_grid_config()`. See PROJECT_STANDARDS §1.3.
- **One-shot:** `timers.timer_manager.submit_one_shot` + **`timers.one_shot_tasks.do_*`** only.
- **Do not** add wrapper functions or classes that only forward one layer.

### 8. Offset values

Subtract border → compute (content scale) → add border back. Frame fixed; content scales. No raw ratio without subtract/add border.

### 9. Prompt persistence

d3-check prompts → `pyapps/d3-check/.prompts/` (append log or timestamped file).

### 10. Change checklist (every edit)

(1) Redundant → merge. (2) Similar existing code → extend, do not duplicate. (3) Architecture → fit event center, CONFIG, direct imports. Apply to current diff.

### 11. Updating rules/skills

Check existing rules/skills/AGENTS; no conflict or duplicate; merge into one; canonical = PROJECT_STANDARDS.md.

### 12. Summary

| Need | Where |
|------|--------|
| Constants | `providor.app_constants` |
| Config | `config` (unified_config, grid_config) |
| Shared data | share/values (§1.3); 迁移前 share 根 |
| Shared functions | share/common (§1.3) |
| One-shot | timers.one_shot_tasks.do_* |
| Lifecycle/threads/events | runtime; CODE_TREE.md |
| All standards | **docs/PROJECT_STANDARDS.md** |
| Threads | THREAD_BUS_AND_REGISTRY.md |
