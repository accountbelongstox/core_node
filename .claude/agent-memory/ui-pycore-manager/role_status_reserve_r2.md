---
name: role_status_reserve_r2
description: ui-pycore-manager is a reserve/alias session as of 2026-09-28 — pycore-ui is default writer for apps/pycore-manager
metadata:
  type: project
---

Orchestrator ruling R2 (`docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md`, delivered via cross-session message from `ca-orchestrator` on 2026-09-28): after the D22 roster reorg, `pycore-ui` is the default writer for `apps/pycore-manager` (and also for `ui-laravel-manager`'s and `ui-vortex`'s app paths). `ui-pycore-manager` (this session, `ct-ui-pycore-manager`) is a pre-D22 alias session and stays in reserve — it edits `apps/pycore-manager/` only when a specific task explicitly names `ui-pycore-manager` as temporary writer.

**Why:** one writer per path; `config/claude_team_roles.json` groups + review history name `pycore-ui` as the post-D22 successor holding continuity for this app.

**How to apply:** do not self-assign or proactively edit anything under `apps/pycore-manager/` (or the shared UI layer) based on old backlog/review items (see [[history_under_old_role_names]]) or general initiative. Wait for `ca-orchestrator` (or a group leader) to dispatch a task that names `ui-pycore-manager` as writer for a specific path/task before touching files. If idle with no such task, stay idle and report status rather than inventing work. This ruling can change with a future roster update — verify against the newest `docs_fix/TASK_*ROSTER*` doc or a fresh orchestrator message before assuming it still holds.
