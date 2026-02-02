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

### 1. Prefer pycore

- **Use pycore first.** Before introducing new third-party libs or reimplementing logic, check whether pycore already provides it.
- **Direct imports only (no secondary encapsulation):** Import directly from pycore (e.g. `from pycore.pyfoundations.color_print import ColorPrint`); do not use `providor.common_imports` re-exports.
- **Typical pycore usage in d3-check:**
  - **pycore.pyfoundations:** `ColorPrint`, `ENCYCLOPEDIA`, `thread_bus.THREAD_BUS`, `third_party` (get_third_package_cv2, get_third_package_numpy, get_third_package_PIL_Image, etc.), `event_bus`, `encyclopedia`.
  - **pycore.pyutils:** `common.window_finder.WindowFinder`, `common.browser_window_detector`, `window_ops`, `image_crop.ImageCrop`, `click_handler.ClickHandler`, `image_annotator.ImageAnnotator`, `image_matcher.ImageMatcher`, `ocr_cnocr_engine.CnOCREngine`, `hotkey_listener`, `window_activator.WindowActivator`, `web.http_bridge.HTTPBridgeServer`, `native_ui`, `ultralytics` (trainers, dataset), `window_screenshot.WindowScreenshot`, `dataset_generator.DatasetGenerator`.

### 2. D3 and D4 constants and variables → CONFIG

- **All D3- and D4-specific constants and configurable variables belong in CONFIG**, not scattered in feature modules.
- **Literal constants (paths, resolutions, IDs, keywords, timeouts):** Put in **`providor.app_constants`**.
  - Examples: `STANDARD_RESOLUTION_WIDTH`, `D4_STANDARD_RESOLUTION_WIDTH`, `D3_*`, `D4_*`, `BATTLE_NET_*`, `GRID_ROWS`, `GRID_COLS`, `D4_EVENT_KEYS`, `CMD_*`, `*_TEMPLATE_NAME`, paths under `pyapps/d3-check`.
  - Other modules must **import** from `providor.app_constants` (or from `config` when re-exported there); do not duplicate literals.
- **Structured config (skill config, grid, macro, template config):** Use the **`config`** package.
  - **`config.unified_config`:** SkillConfig, MacroConfigs, TemplateConfig, ConfigManager, get_config_manager, get_skill_config, save_all_configs, etc. Constants used by unified_config that are D3/D4 literals live in `app_constants` and are imported by unified_config.
  - **`config.grid_config`:** Grid dimensions and helpers (get_grid_config, update_grid_config); it reads from app_constants (GRID_ROWS, GRID_COLS, etc.).
- **Do not add new literal constants in feature modules.** Add them to `providor.app_constants` or the appropriate config module, then import where needed.

### 3. Adding new standards (规范)

When the user asks to **add a 规范** (standard/rule), add it to the appropriate place **by priority**:

1. **`.cursor/rules`** — Project- or file-scoped rules (use `globs` / `description`). Prefer when the standard is "when editing these files or in this context, do X."
2. **`.cursor/skills`** — Reusable skill with "When to Use" and step-by-step instructions (SKILL.md). Prefer when the standard is a capability plus usage context.
3. **`pyapps/d3-check/AGENTS.md`** — Short, always-relevant instructions for this sub-app. Prefer when the standard is a simple, directory-level guideline.

This rule itself must be followed: any new 规范 you add should be written into rules, skills, or AGENTS.md according to the above priority.

### 4. ttk Notebook Tab (equal height)

All `ttk.Notebook` tabs: selected and unselected must be same height. Ref: `ui/diablo3_macro_ui.py` (`_apply_tab_layout`, `_apply_notebook_theme`, `_force_style_update`, `_apply_tab_style`).

- **Layout:** Remove `Notebook.focus` — use `Notebook.tab` → `Notebook.padding` → `Notebook.label` only. Re-apply this layout wherever notebook style is configured (theme apply, force update, per-tab apply).
- **Padding:** `configure(..., padding=[12,8,12,8])` and `map(..., padding=[('selected',[12,8,12,8]), ('!selected',[12,8,12,8])])` so both states identical.
- **Expand:** `map(..., expand=[('selected',[0,0,0,2]), ('!selected',[0,0,0,0])])`.
- **Notebook:** `tabmargins=[1,3,1,0]`, `takefocus=0`. Theme `clam`; style `Dark.TNotebook`/`Dark.TNotebook.Tab`.

### 5. Threads: no dynamic creation; native only; no wrapper classes

- **禁止在代码中动态创建线程**（防止卡住）。所有线程随 UI 同步启动；执行仅由**全局状态与 tick**（timer_manager 周期 + 命令队列）驱动。
- 一次性工作（路径扫描、登录检查、刷新状态、战网 UI 分析、窗口监控首次检测）须通过 **timer_manager.submit_one_shot(callback)** 投递到定时器线程执行，不得新建线程。
- **线程类必须实现为原生类**：禁止使用一个类对另一个类做简单封装（如 A 的 run() 仅调用 B.xxx()）。可选两种方式：(1) 需在后台运行的组件**直接继承 threading.Thread**（如 `SystemTray(threading.Thread)`，其 `run()` 内实现托盘循环）；(2) 线程类的 **run() 内直接实现循环/逻辑**，仅将控制器等作为数据或回调使用，不单纯转发到另一对象的一个方法。例如：`MacroLoopThread.run()` 内直接写宏循环；`GameInterfaceMacroThread.run()` 内直接写宏循环；`SystemTray` 自身为 Thread 子类。详见 `docs/THREAD_BUS_AND_REGISTRY.md`。

### 6. No secondary encapsulation (禁止二次封装)

- **任何类库、常量、方法均不允许进行二次封装**；**不允许任何简单封装**（包括转引、包装函数、包装类）。
- **禁止使用一个类对另一个类进行简单封装**：不得新增仅做“转发一层”的包装类（如 A 仅持有 B 且 A 的方法只调 B 的单一方法）。线程类须为原生：要么组件直接继承 Thread 且 run() 内实现逻辑，要么线程类的 run() 内直接实现循环/逻辑，不单纯调用另一对象的单一方法。
- **禁止使用二次封装**：方法、类库一律**直接调用和直接引用**。
- **导入**：不从 `providor.common_imports` 转引；从 **pycore** 对应模块直接引用。常量从 **`providor.app_constants`** 直接引用，不从 `providor.providor_index` 转引常量。共享数据从 **`share.game_interface_data`**、**`share.project_path`** 等子模块直接引用，不从 `share` 包根转引。
- **一次性任务**：直接使用 `timers.timer_manager.submit_one_shot(callback)` 并直接引用 `share.threads` 中的 `do_*` 函数。
- **不要**新增仅做“转发一层”的包装函数或包装类。

### 7. Summary

| Need | Where |
|------|--------|
| Literal D3/D4/Battle.net constants, paths, resolutions, keys | `providor.app_constants` |
| Skill/macro/template config, ConfigManager | `config` (unified_config, grid_config); literals still in app_constants |
| Shared pycore-style imports used by d3-check | Direct `pycore.*` only (no common_imports re-export) |
| New 规范 (standard/rule) | rules → skills → AGENTS.md (by priority above) |
| 启动 ROSBOT 流程要求 | `.cursor/skills/rosbot-startup/SKILL.md`（ensure_battlenet_started_and_login_check、_start_rosbot、run_after_rosbot_start 等须按该文档执行） |
| ttk Notebook Tab (equal height) | §4; ref diablo3_macro_ui |
| 线程：禁止动态创建；随 UI 启动、tick 驱动 | §5; `docs/THREAD_BUS_AND_REGISTRY.md` |
| 禁止二次封装；直接调用、直接引用 | §6；直接 pycore 引用、直接 timer_manager + share.threads |

Follow these rules so d3-check stays consistent, favors pycore, and keeps all D3/D4 configuration in CONFIG.

- Use the ask questions tool if you need to clarify requirements with the user.
