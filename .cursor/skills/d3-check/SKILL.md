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

### 5. Threads: no mutual 卡住; event center only; init all at startup; tick-driven; per-thread state

- **禁止线程互相卡住**：**正常运行时**任意线程不得通过 `queue.get()`、`join()` 等等待另一线程的返回或结束；否则会导致主线程/UI **卡住**。**关闭阶段**主线程可对工作线程 `join(timeout)` 做收尾；除此以外禁止跨线程卡住。
- **事件中心为唯一通道**：线程间通信**一律通过事件中心**（`d3utils.event_center` / pycore `THREAD_BUS`）发事件、收事件；由 event_center 调度到目标线程或主线程（如 `root.after(0, ...)`）。禁止线程间直接传参、互相引用或同步等待。
- **启动时初始化所有线程**：所有后台线程（TaskThreadManager 及其 worker/任务线程、TimerManager、扩展线程 Main/Aux/D3/D4、托盘、宏线程等）在 UI 就绪后**一次性创建并启动**，禁止在运行中动态创建线程。
- **tick 驱动**：执行仅由**全局状态与 tick** 驱动（如 timer_manager 周期、任务线程 1s tick、rosbot_flow_master_enabled 等）；一次性工作须通过 **timer_manager.submit_one_shot(callback)** 投递到定时器线程执行，不新建线程。
- **每线程管理自身状态**：每个线程/任务只维护自己的状态（如 TaskThread 的 status、D3InterfaceData 的 rosbot_flow_master_enabled）；状态更新通过事件或不卡住入队（fire-and-forget）；需要「当前状态」时从**共享状态**读取，禁止卡住等待另一线程返回。
- **线程类必须实现为原生类**：禁止 A 的 run() 仅调用 B.xxx()。组件直接继承 `threading.Thread` 且 `run()` 内实现循环/逻辑，或线程 run() 内直接实现逻辑，不单纯转发到另一对象单方法。详见 `docs/THREAD_BUS_AND_REGISTRY.md`。

### 6. No secondary encapsulation (禁止二次封装)

- **任何类库、常量、方法均不允许进行二次封装**；**不允许任何简单封装**（包括转引、包装函数、包装类）。
- **禁止使用一个类对另一个类进行简单封装**：不得新增仅做“转发一层”的包装类（如 A 仅持有 B 且 A 的方法只调 B 的单一方法）。线程类须为原生：要么组件直接继承 Thread 且 run() 内实现逻辑，要么线程类的 run() 内直接实现循环/逻辑，不单纯调用另一对象的单一方法。
- **禁止使用二次封装**：方法、类库一律**直接调用和直接引用**。
- **导入**：不从 `providor.common_imports` 转引；从 **pycore** 对应模块直接引用。常量从 **`providor.app_constants`** 直接引用，不从 `providor.providor_index` 转引常量。共享数据从 **`share.game_interface_data`**、**`share.project_path`** 等子模块直接引用，不从 `share` 包根转引。D3 模板匹配从 **`d3utils.d3_scaled_template_matcher`** 直接引用（无 `d3utils.scaled_template_matcher` 转引）。控制器函数从 **`controller.ctl_func.blacksmith_handler`**、**`controller.ctl_func.kanai_cube_handler`** 直接引用。网格当前配置用 **`config.grid_config.get_grid_config()`**，字面常量仍从 `app_constants`。
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
| 生命周期/线程/事件（init、shutdown、event center、task manager、thread registry） | **runtime**；见 `docs/CODE_TREE.md` |
| 代码树与分层 | `docs/CODE_TREE.md` |
| 线程：禁止互相卡住；事件中心；启动时全初始化；tick 驱动；每线程管自身状态 | §5; `docs/THREAD_BUS_AND_REGISTRY.md` |
| 禁止二次封装；直接调用、直接引用 | §6；直接 pycore 引用、直接 timer_manager + share.threads |

Follow these rules so d3-check stays consistent, favors pycore, and keeps all D3/D4 configuration in CONFIG.

- Use the ask questions tool if you need to clarify requirements with the user.
