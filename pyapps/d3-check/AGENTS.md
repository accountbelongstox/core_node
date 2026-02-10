# d3-check agent instructions

Canonical: **`docs/PROJECT_STANDARDS.md`**. Details: `.cursor/rules/d3-check.mdc`, `.cursor/skills/d3-check/SKILL.md`.

## Reuse and no redundancy

- Reuse before adding (d3utils, timers, controller, pycore). No duplicate constants/helpers/wrappers; literals → `providor.app_constants`.

## Code and dependencies

- pycore direct; no common_imports. Constants from `providor.app_constants`. **share**: data → share/values, functions → share/common; no run_/do_; no gitignore-prone dir names. See §1.3. One-shot: `timers.timer_manager.submit_one_shot` + **`timers.one_shot_tasks.do_*`**.

## Configuration

- Literals → `providor.app_constants`; structured → `config`. No new literals in feature modules.

## New standards

- Add by priority: `.cursor/rules` → `.cursor/skills` → AGENTS.md. No duplicate; canonical = PROJECT_STANDARDS.md.

## Runtime and code tree

- Lifecycle/thread/event: import from **runtime** only. Code tree: `docs/CODE_TREE.md`.

## Threads

- No cross-thread blocking; event center only; init at startup; one-shot via timer_manager; native Thread. See THREAD_BUS_AND_REGISTRY.md.

## Summary

| Need | Where |
|------|--------|
| Constants | `providor.app_constants` |
| Config | `config` |
| Shared data / functions | share/values, share/common (§1.3) |
| One-shot | timers.one_shot_tasks.do_* |
| Lifecycle/threads | runtime; CODE_TREE.md |
| All standards | **docs/PROJECT_STANDARDS.md** |
