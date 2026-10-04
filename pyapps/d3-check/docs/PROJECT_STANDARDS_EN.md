# d3-check Project Standards (English)

**Single source of truth**: Directory layout, D3/D4/shared areas, naming, imports, threading, and reuse all follow this document.

---

## 1. Directory and Document Architecture

### 1.1 Project Root Layout

```
pyapps/d3-check/
├── main.py                    # Entry: GUI / bridge / tray / train
├── train.py, validate.py      # Train/validate entry points
├── config/                    # Shared configuration
├── providor/                  # Constants (app_constants), config entry, i18n
├── share/                     # §1.3: values/ (data) + common/ (shared functions)
│   ├── values/                # Data area
│   └── common/                # Shared function area
├── runtime/                   # Lifecycle, thread registry, events; single external entry
├── timers/                    # Timers, one-shot tasks (do_*)
├── controller/                # Controllers: D3 main, D4, ctl_func, d4func
├── d3utils/                   # D3/ROSBOT/Battle.net logic + shared infrastructure
├── d4utils/                   # D4-specific logic
├── d4_modules/                # D4 models and resources
├── ui/                        # Main window, panels, components, themes
├── scripts/                   # Scripts and tools
├── images/                    # Image assets
├── docs/                      # All documentation
├── utils/, state/             # Deprecated code _obsolete_*
└── .prompts/                  # Prompts and tasks
```

### 1.2 Document Architecture

| Type | Document |
|------|----------|
| Standards | `PROJECT_STANDARDS.md` (this document) |
| Code layers | `CODE_TREE.md` |
| Flow | `FLOW_ARCHITECTURE_DIRECTORY.md`, `ROSBOT_FLOW*.md` |
| Threads and events | `THREAD_BUS_AND_REGISTRY.md` |

All new standards go into this document; older docs are superseded by it.

### 1.3 share/ Partition (Data vs Shared Function Area)

**Principle**: share must separate **data area** from **shared function area**; do not treat the whole as a single “function area” for business logic.

**Forbidden directory names** (gitignore-prone): `data`, `store`, `cache`, `tmp`, `temp`, `log`, `logs`, `build`, `dist`, `out`, `output`, `target`, `node_modules`, `env`, `venv`, `.venv`, `coverage`, `lib`, `var`, `uploads`, `downloads`, and any directory starting with `.`. Use **`share/values/`** for data and **`share/common/`** for shared functions.

| Sub-area | Path | Responsibility | Allowed | Forbidden |
|----------|------|----------------|---------|-----------|
| **Data** | `share/values/` | Shared data and data-access API only | Data types, get_*/set_*, config/credential read-write, event/queue sync | **run_***, **do_\***, business flow, complex algorithms, scheduled tasks |
| **Shared functions** | `share/common/` | Cross-game utilities, base classes | Pure functions, base classes, shared logic not tied to D3-only/D4-only | Dependencies on d3utils/d4utils business, **run_*/do_\***, game-specific constants |

- **Data area**: Anything that needs to read/write shared state, paths, credentials imports from `share.values`; may depend on providor, pycore; **must not** depend on d3utils/d4utils business.
- **Shared function area**: Anything that needs coordinate conversion, template-scale base classes, Battle.net window lookup imports from `share.common`; may depend on share.values, providor, pycore; **must not** depend on d3utils/d4utils flow/Battle.net/ROSBOT.
- **Current mapping** (may stay at share root until migration): values → game_interface_data, project_path, oauth_callback, asia_credentials, template_match_debug; common → scaled_template_matcher_base, coordinate_helper, battlenet_ui_common, battlenet_window_finder.

---

## 2. Code Layers

| Layer | Path | Responsibility |
|-------|------|----------------|
| 1 Entry | `main.py` | Obtain lifecycle from **runtime** only |
| 2 Runtime | `runtime/`, system_initializer, shutdown_manager, event_center, event_signals, task_thread_manager, thread_registry in d3utils | **Callers import runtime only** |
| 3 Controllers | controller/*.py, ctl_func/, d4func/ | Use runtime for lifecycle and threads |
| 4 Business | d3utils/, d4utils/ | Do not own lifecycle entry points |
| 5 Shared | share/values/, share/common/ | See §1.3; no run_*/do_* |
| 6 Timers | timers/ | Scheduled tasks, one-shot do_*, window monitor |
| 7 UI | ui/ | Main window, panels, components, themes |
| 8 Config and constants | config/, providor/ | Unified config, grid, app_constants, i18n |

**Imports**: Lifecycle/threads/events from **runtime** only; one-shot work via `timers.timer_manager.submit_one_shot` + `timers.one_shot_tasks.do_*`.

---

## 3. D3 / D4 / Shared Area

### 3.1 Three Areas

| Area | May depend on | Must not depend on |
|------|----------------|--------------------|
| **D3** | Shared area, D3 modules inside d3utils | d4utils, D4-specific constants |
| **D4** | Shared area, d4utils, shared pieces in d3utils | D3 flow/Battle.net/ROSBOT-specific |
| **Shared** | share, pycore, providor without D3/D4 prefix | d3-only / d4-only business |

### 3.2 Directory Ownership

| Package/dir | Ownership |
|-------------|-----------|
| d3utils/ | D3 + shared infrastructure (including d4_extension_thread) |
| d4utils/ | D4 |
| share/values/, share/common/ | See §1.3 |
| controller/d3_macro_controller.py, ctl_func/ | D3 |
| controller/d4_controller.py, d4func/ | D4 |
| ui/panels/rosbot_extension_panel.py | D3 |
| ui/panels/d4_panel.py | D4 |
| providor/app_constants | Currently single file; optionally split per §3.3 |
| config/, timers/, runtime/ | Shared |

### 3.3 Constant Naming (providor)

**Current**: Single file `app_constants.py` with D3_* / D4_* / no prefix. **Optional** split:

| File | Area | Prefix |
|------|------|--------|
| app_constants_common.py | Common | No D3/D4 |
| app_constants_d3.py | D3 | D3_* |
| app_constants_d4.py | D4 | D4_* |

Business code uses `from providor.app_constants import ...`. New constants: D3-only → D3_*; D4-only → D4_*; both games → no prefix.

### 3.4 Module File Naming

| Area | Rule | Example |
|------|------|---------|
| D3 | d3_ / rosbot_ / battlenet_ | d3_manager.py, rosbot_flow_*.py, battlenet_*.py |
| D4 | d4_ | d4_*.py under d4utils/; d4_controller, d4_panel |
| Shared | No d3/d4 prefix | scaled_template_matcher_base.py, game_interface_data.py, event_center.py |

### 3.5 Import Rules (D3/D4/Shared)

- **D3**: May import shared area and D3 modules inside d3utils; **must not** import d4utils or D4-specific constants (unless explicit bridge).
- **D4**: May import shared area, d4utils, shared pieces in d3utils; **must not** import D3 flow/Battle.net/ROSBOT-specific.
- **Shared**: Import only shared low-level (share, pycore, constants without D3/D4 prefix); **must not** import d3_* / d4_* business.
- **New files**: D3-only → d3utils or ctl_func, d3_* / rosbot_* / battlenet_*; D4-only → d4utils or d4func, d4_*; shared → share or common inside d3utils, no prefix.

---

## 4. Flow Layout (rosbot_flow)

- **d3utils/rosbot_flow/** = flow library: tick-driven + state.
- **rosbot_flow_*.py** = F-block/BN step implementations; **rosbot_flow_state.py** = global flow switch.
- **rosbot_flow_battlenet.py** = BN block executor; public API includes `reset_flow_master_bn_block()`.

Details in `FLOW_ARCHITECTURE_DIRECTORY.md`.

### 4.1 Flow Is Tick-Driven Only; No Standalone Timers

**Rule**: All flow structures (BN block, F block, Extension C block, A block, etc.) **must not use standalone timers** (e.g. `timers.register_task`, dedicated thread with sleep loop); **driven by tick only**.

- **Driver**: 2s process_task() → tick_bn_only_flow() / tick_flow_master() → flow steps. No register_task or dedicated timer thread inside flow.
- **Timeouts**: BN block uses **deadline timestamp** (compared each tick); Extension C block uses **deadline_tick** (tick count). See extension_flow_tick_step.py.
- **No time.sleep inside flow steps**: Steps run in tick thread; must not block tick. If a short sleep for UI stability is needed inside an extension thread step, it must be explicitly documented in code/comments as “non-tick thread, exception for this step only”.

---

## 5. Naming Conventions

### 5.1 Function Prefixes run_ / do_ / step_

| Prefix | Use | Example |
|--------|-----|---------|
| **run_** | Flow block step (called by flow driver) | run_c1_entry, run_f4_close_d3_send_f7 |
| **do_** | One-shot/scheduled task (submit_one_shot, manual trigger) | do_window_monitor_initial_check, do_path_scan, do_login_check |
| **step_** | Sub-step (inside run_/do_) | step_c10_send_m, step_a3_tick_has_direction |

### 5.2 Reset and State

- **reset_*** is only for “return to initial/entry” (e.g. reset_flow_master_bn_block). Use other verbs for state transitions. Name clearly which flow is being reset.

### 5.3 Layer Naming (Provider / Manager / Controller / Handler)

| Role | Meaning | Example |
|------|---------|---------|
| Provider | State/detection, refresh shared state | battlenet_status_provider, d3_status_provider |
| Manager | Process/config/lifecycle | rosbot_manager, shutdown_manager |
| Controller | UI/business controller | controller/*_controller.py |
| Handler | Feature-level (blacksmith, Kanai, event callbacks) | Handlers under ctl_func |

Use or extend Provider for pure detection/state refresh; do not add new Manager for that.

### 5.4 Window and Status Refresh

- Full status refresh: **run_full_status_refresh()**.
- Refresh when flow inactive + callback: **refresh_window_status_if_inactive()** (window_monitor_timer); check_window is deprecated.
- One-shot initial/manual refresh: **do_window_monitor_initial_check()**.

### 5.5 Other Naming and Files

- Public: **reapply_sigint_sigbreak_ignore_for_gui()**; internal: **_reapply_sigint_sigbreak_ignore()**.
- Python files: **snake_case**. Deprecated: prefix **_obsolete_** (utils/, state/). Scripts: scripts/; package name **providor**; **ctl_func** = D3 handlers, **d4func** = D4, **d3u_common** = shared helpers inside d3utils.

---

## 6. Import and Code Guarantees

### 6.1 Imports

- **All imports at top of file**. Exception: optional third-party at module level (e.g. `try: import pythoncom except ImportError: pythoncom = None`). Do not put imports inside functions for convenience.
- Do not add imports inside business logic; new dependencies go at the top.
- **Circular imports**: Resolve by architecture (split modules, dependency injection, shared layer); do not use lazy import to work around.

### 6.2 Code-Level Guarantees and Exceptions

- **No getter-style or runtime-check calls**: Do not use `hasattr`/`callable`/`getattr(..., None)` to decide at runtime whether to call an API (e.g. check for `Exists` then call). Depend on type/API contract and call directly (e.g. control.Exists(), control.GetChildren()); caller ensures correct type.
- **Availability by design**: Guarantee availability of third-party/internal APIs via architecture and types, not runtime checks.
- **Avoid unnecessary catch**: Use try/except only where exceptions cannot be fully avoided by preconditions (process/thread/COM/OS/network, etc.); otherwise use preconditions and direct calls.
- **Exception**: Stdlib/platform differences (e.g. `hasattr(signal, 'SIGBREAK')`), polymorphic data not under this module (e.g. external model output, optional fields in legacy parsed blocks) may keep hasattr/getattr; everything else follows the direct-call rule above.

---

## 7. Threads and Events

- **No cross-thread blocking**: Runtime must not block across threads; communication only via **event center** (THREAD_BUS); read shared state when current state is needed. Main thread may join(timeout) on shutdown.
- **Thread creation**: Only by registry/initializer at startup; do not create business threads at runtime; one-shot work via **timer_manager.submit_one_shot**.
- **Implementation**: Thread classes are native subclasses (run() implements loop), not thin wrapper classes.

See `THREAD_BUS_AND_REGISTRY.md`.

---

## 8. Reuse, Constants, and Config

- **Reuse before adding**: For new behavior, search existing logic (same module, d3utils, timers, controller, pycore) first; prefer extending or parameterizing.
- **No duplicate definitions**: Literal constants in **providor.app_constants**, structured config in **config**; do not add literals in controller/d3utils/d4utils/ui.
- **Direct dependency**: Use pycore, d3utils directly; no providor.common_imports; one-shot via timers.timer_manager.submit_one_shot and **timers.one_shot_tasks.do_***.

---

## 9. Deprecated Code and Scripts

- **_obsolete_*** lives under **utils/** or **state/**; new deprecated code uses prefix **_obsolete_**. Scripts use snake_case under **scripts/** (debug under scripts/debug/ if needed).

---

## 10. Quick Reference

| Need | Location / rule |
|------|------------------|
| Literal constants | providor.app_constants (D3_* / D4_* / no prefix) |
| Skill/macro/template config | config (unified_config, grid_config) |
| Shared data | share/values; data and data access only |
| Shared functions | share/common; no run_/do_ |
| One-shot tasks | timers.one_shot_tasks (do_*) |
| Full status refresh | run_full_status_refresh(); when inactive: refresh_window_status_if_inactive() |
| Lifecycle/threads/events | runtime |
| D3-specific | d3utils(d3_*, rosbot_*, battlenet_*), ctl_func, rosbot_extension_panel; constants D3_* |
| D4-specific | d4utils(d4_*), d4func, d4_controller, d4_panel; constants D4_* |
| Flow steps | run_*; one-shot do_*; sub-steps step_* |
| Reset Flow-master BN block | reset_flow_master_bn_block() |
| **No timers in flow** | Tick-driven only; timeouts via deadline/deadline_tick; no time.sleep in flow steps (§4.1) |
| Code language / i18n | §11: Code in English; user-facing text via i18n; match/config constants unchanged |
| i18n entry | providor.i18n_manager only; do not load reference UI JSON; hardcode detection features |

### D4 Compliance Checklist

- d4utils/: modules **d4_*.py**; class names **D4** + PascalCase; public getters **get_d4_***; log tags match class names.
- Package imports: only from d4utils.d4_* or controller.d4func; D4 must not import d3utils flow/Battle.net/ROSBOT; constants D4_* from app_constants or share.game_interface_data.
- Shared data: get_d4_interface_data(), D4_STANDARD_COORDS, etc. in share (after migration share.values); shared functions in share.common.

---

## 11. Code Language and i18n

- **Code**: Comments, docstrings, log messages, variable/function names **must be in English**.
- **User-facing text**: UI copy, hints, button labels **use i18n**: obtain via **providor i18n** (e.g. `i18n_manager.get_ui_text(...)`); do not hardcode Chinese or other languages in business code.
- **Constants excluded**: Literal constants used for matching, config keys, window title keywords (e.g. in `providor.constants.common`, `providor.constants.d3`) **remain as-is**; do not change for “code in English”; new match constants may still use multi-language literals as needed.
- Consistent with §8: literal constants in providor; user-facing strings in i18n JSON; code only references i18n key or English fallback.
- **Single i18n entry**: `i18n_manager` is defined and initialized only in **providor/i18n_manager.py**; project-wide use `from providor.i18n_manager import i18n_manager`; do not create or hold another instance elsewhere.
- **Reference UI docs not loaded**: UI element JSON under docs (e.g. Battle.net UI snapshots) are for human reference only; **must not** be read at runtime; detection features must be **hardcoded** in code (e.g. `providor.constants.d3`).
