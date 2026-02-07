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

- **Use pycore first.** Before introducing new third-party libs or reimplementing logic, check whether pycore already provides it.
- **Direct imports only (no secondary encapsulation):** Import directly from pycore (e.g. `from pycore.pyfoundations.color_print import ColorPrint`); do not use `providor.common_imports` re-exports.
- **Typical pycore usage in d3-check:**
  - **pycore.pyfoundations:** `ColorPrint`, `ENCYCLOPEDIA`, `thread_bus.THREAD_BUS`, `third_party` (get_third_package_cv2, get_third_package_numpy, get_third_package_PIL_Image, etc.), `event_bus`, `encyclopedia`.
  - **pycore.pyutils:** `common.window_finder.WindowFinder`, `common.browser_window_detector`, `window_ops`, `image_crop.ImageCrop`, `click_handler.ClickHandler`, `image_annotator.ImageAnnotator`, `image_matcher.ImageMatcher`, `ocr_cnocr_engine.CnOCREngine`, `hotkey_listener`, `window_activator.WindowActivator`, `web.http_bridge.HTTPBridgeServer`, `native_ui`, `ultralytics` (trainers, dataset), `window_screenshot.WindowScreenshot`, `dataset_generator.DatasetGenerator`.

### 3. D3 and D4 constants and variables → CONFIG

- **All D3- and D4-specific constants and configurable variables belong in CONFIG**, not scattered in feature modules.
- **Literal constants (paths, resolutions, IDs, keywords, timeouts):** Put in **`providor.app_constants`**.
  - Examples: `STANDARD_RESOLUTION_WIDTH`, `D4_STANDARD_RESOLUTION_WIDTH`, `D3_*`, `D4_*`, `BATTLE_NET_*`, `GRID_ROWS`, `GRID_COLS`, `D4_EVENT_KEYS`, `CMD_*`, `*_TEMPLATE_NAME`, paths under `pyapps/d3-check`.
  - Other modules must **import** from `providor.app_constants` (or from `config` when re-exported there); do not duplicate literals.
- **Structured config (skill config, grid, macro, template config):** Use the **`config`** package.
  - **`config.unified_config`:** SkillConfig, MacroConfigs, TemplateConfig, ConfigManager, get_config_manager, get_skill_config, save_all_configs, etc. Constants used by unified_config that are D3/D4 literals live in `app_constants` and are imported by unified_config.
  - **`config.grid_config`:** Grid dimensions and helpers (get_grid_config, update_grid_config); it reads from app_constants (GRID_ROWS, GRID_COLS, etc.).
- **Do not add new literal constants in feature modules.** Add them to `providor.app_constants` or the appropriate config module, then import where needed.

### 4. Adding new standards

When the user asks to **add a standard/rule**, add it to the appropriate place **by priority**:

1. **`.cursor/rules`** — Project- or file-scoped rules (use `globs` / `description`). Prefer when the standard is "when editing these files or in this context, do X."
2. **`.cursor/skills`** — Reusable skill with "When to Use" and step-by-step instructions (SKILL.md). Prefer when the standard is a capability plus usage context.
3. **`pyapps/d3-check/AGENTS.md`** — Short, always-relevant instructions for this sub-app. Prefer when the standard is a simple, directory-level guideline.

This rule itself must be followed: any new standard you add should be written into rules, skills, or AGENTS.md according to the above priority.

### 5. ttk Notebook Tab (equal height)

All `ttk.Notebook` tabs: selected and unselected must be same height. Ref: `ui/diablo3_macro_ui.py` (`_apply_tab_layout`, `_apply_notebook_theme`, `_force_style_update`, `_apply_tab_style`).

- **Layout:** Remove `Notebook.focus` — use `Notebook.tab` → `Notebook.padding` → `Notebook.label` only. Re-apply this layout wherever notebook style is configured (theme apply, force update, per-tab apply).
- **Padding:** `configure(..., padding=[12,8,12,8])` and `map(..., padding=[('selected',[12,8,12,8]), ('!selected',[12,8,12,8])])` so both states identical.
- **Expand:** `map(..., expand=[('selected',[0,0,0,2]), ('!selected',[0,0,0,0])])`.
- **Notebook:** `tabmargins=[1,3,1,0]`, `takefocus=0`. Theme `clam`; style `Dark.TNotebook`/`Dark.TNotebook.Tab`.

### 6. Threads: no mutual blocking; event center only; init all at startup; tick-driven; per-thread state

- **No cross-thread blocking at runtime:** No thread may block on another (e.g. via `queue.get()`, `join()`) waiting for return or completion during normal operation; that would block the main thread/UI. At shutdown the main thread may `join(timeout)` workers for cleanup; otherwise no cross-thread blocking.
- **Event center is the only channel:** All cross-thread communication goes through the event center (`d3utils.event_center` / pycore `THREAD_BUS`); event_center dispatches to the target thread or main thread (e.g. `root.after(0, ...)`). No direct cross-thread arguments, references, or synchronous waits.
- **Init all threads at startup:** All background threads (TaskThreadManager and its workers, TimerManager, Main/Aux/D3/D4, tray, macro threads, etc.) are created and started once after UI is ready; no dynamic thread creation during run.
- **Tick-driven:** Execution is driven only by global state and tick (e.g. timer_manager period, task thread 1s tick, rosbot_flow_master_enabled); one-off work must be submitted via **timer_manager.submit_one_shot(callback)** to the timer thread; do not spawn new threads for it.
- **Each thread manages its own state:** Each thread/task only maintains its own state (e.g. TaskThread status, D3InterfaceData.rosbot_flow_master_enabled); state updates via events or non-blocking enqueue (fire-and-forget); when "current state" is needed, read from shared state; do not block waiting for another thread to return.
- **Thread classes must be native:** Do not have A's run() only call B.xxx(). Components extend `threading.Thread` and implement the loop/logic in run(), or the thread's run() implements the loop/logic directly; do not simply forward to a single method of another object. See `docs/THREAD_BUS_AND_REGISTRY.md`.

### 7. No secondary encapsulation

- **No secondary encapsulation** of any library, constant, or method; **no trivial wrappers** (re-exports, wrapper functions, wrapper classes).
- **Do not wrap one class with another:** Do not add wrapper classes that only forward one layer (e.g. A holds B and A's methods only call B's single method). Thread classes must be native: either the component extends Thread and run() implements logic, or the thread's run() implements the loop/logic directly; do not simply call another object's single method.
- **Direct use only:** Methods and libraries must be **called and referenced directly**.
- **Imports:** Do not re-export from `providor.common_imports`; import directly from the **pycore** module. Constants from **`providor.app_constants`** directly, not from `providor.providor_index`. Shared data from **`share.game_interface_data`**, **`share.project_path`**, etc., not from the `share` package root. D3 template matching from **`d3utils.d3_scaled_template_matcher`** (no `d3utils.scaled_template_matcher` re-export). Controller functions from **`controller.ctl_func.blacksmith_handler`**, **`controller.ctl_func.kanai_cube_handler`** directly. Grid config via **`config.grid_config.get_grid_config()`**; literals still from `app_constants`.
- **One-shot work:** Use `timers.timer_manager.submit_one_shot(callback)` and **`timers.one_shot_tasks.do_*`** directly (share = shared data only; no business logic there).
- **Do not** add wrapper functions or classes that only forward one layer.

### 8. Prompt persistence

- **Fixed directory:** **`pyapps/d3-check/.prompts/`**
- **Requirement:** Every prompt produced or used in d3-check context must be appended to this fixed directory.
- **Practice:** Use one approach consistently:
  - Append to a single log file in that directory (e.g. `prompt_log.md`), with timestamp/separator for each entry; or
  - Save as a new timestamped file in that directory (e.g. `prompt_YYYYMMdd_HHmmss.md`).
- Do not leave prompts only in chat or temporary buffers; they must be written to the directory above.

### 9. Summary

| Need | Where |
|------|--------|
| Literal D3/D4/Battle.net constants, paths, resolutions, keys | `providor.app_constants` |
| Skill/macro/template config, ConfigManager | `config` (unified_config, grid_config); literals still in app_constants |
| Shared pycore-style imports used by d3-check | Direct `pycore.*` only (no common_imports re-export) |
| New standard/rule | rules → skills → AGENTS.md (by priority above) |
| ROSBOT startup flow | `.cursor/skills/rosbot-startup/SKILL.md` (ensure_battlenet_started_and_login_check, _start_rosbot, run_after_rosbot_start, etc. per that doc) |
| ttk Notebook Tab (equal height) | §4; ref diablo3_macro_ui |
| Lifecycle/threads/events (init, shutdown, event center, task manager, thread registry) | **runtime**; see `docs/CODE_TREE.md` |
| Code tree and layers | `docs/CODE_TREE.md` |
| Threads: no mutual blocking; event center; init all at startup; tick-driven; per-thread state | §5; `docs/THREAD_BUS_AND_REGISTRY.md` |
| No secondary encapsulation; direct call and reference | §7; direct pycore refs, direct timer_manager + timers.one_shot_tasks |
| Reuse existing logic before adding; no redundant constants/methods | §1 |
| Prompt persistence (fixed directory) | §8; fixed dir `pyapps/d3-check/.prompts/`, append each prompt to a file there |

Follow these rules so d3-check stays consistent, favors pycore, and keeps all D3/D4 configuration in CONFIG.

- Use the ask questions tool if you need to clarify requirements with the user.
