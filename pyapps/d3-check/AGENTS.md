# d3-check agent instructions
Full detail: `docs/PROJECT_STANDARDS.md`; `.cursor/rules/d3-check.mdc`. Git/code rules: repo-root AGENTS.md.
- Reuse first (d3utils, timers, controller, pycore); no duplicate constants/helpers.
- pycore direct, no common_imports. Literals → `providor.app_constants`; structured → `config`.
- `share`: data → share/values, functions → share/common; no run_/do_ names (§1.3).
- One-shot only via `timers.timer_manager.submit_one_shot` + `timers.one_shot_tasks.do_*`.
- Lifecycle/thread/event: import from `runtime` only; no cross-thread blocking, event center only; native Thread. Code tree: `docs/CODE_TREE.md`.
- Code (comments, docstrings, logs, names): English. User-facing text: i18n via `providor.i18n_manager` only — no hardcoded locale strings; don't load reference UI JSON at runtime. Matching/config literals excepted.
- New standards added by priority: `.cursor/rules` → `.cursor/skills` → AGENTS.md.
