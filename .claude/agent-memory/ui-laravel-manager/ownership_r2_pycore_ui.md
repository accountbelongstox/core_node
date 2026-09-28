---
name: ownership_r2_pycore_ui
description: pycore-ui is the D22-roster default writer for apps/laravel-manager; ui-laravel-manager is a reserve/alias session now
metadata:
  type: project
---

As of 2026-09-28 (`docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md`, ruling R2), `ca-orchestrator` made `pycore-ui` the default writer for `apps/laravel-manager` (also `apps/pycore-manager` and `apps/vortex`). `ui-laravel-manager` (this role/session) is now an alias/reserve session for that path: it edits `apps/laravel-manager/` (or any shared file) only when a specific task names `ui-laravel-manager` as temporary writer for that task. Full R2 map: `laravel-qyapp`→`wordnew-laravel`; `ui-wordnew`→`wordnew-ui`; `ui-codemart`→`codemart-ui`; `laravel-codemart`→`codemart-laravel`; `mcp-chrome`→`wordnew-link`; `ui-pycore-manager`/`ui-laravel-manager`/`ui-vortex`→`pycore-ui`; `laravel`/`laravel-api`→`pycore-laravel`; `pycore`/`pycore-architect`→`pycore-lead`; `pycore-assist`→`pycore-runtime`.

R4 (same doc): all backlog carried from the previous run (including any D22 lane items assigned to the old `ui-laravel-manager` role, e.g. `ui-laravel-manager-D7`) stays ON HOLD until the user gives ca-orchestrator a new task. No unrequested tests/builds/probes while on hold.

**Why:** D22 consolidated 16 roster roles into 5 groups; pre-D22 role names became "alias sessions" so there is exactly one writer per path (roster members hold the post-D22 review/report history).

**How to apply:** Before touching any file under `apps/laravel-manager/` or the shared UI layer, re-check with `ca-orchestrator` (or a fresh read of the latest `docs_fix/TASK_*.md`) whether this ruling still holds — these role/ownership rulings are revised between sessions (see [[team_resume_check]]). If it still holds, only act when a task explicitly names `ui-laravel-manager` as temporary writer; otherwise stay in reserve and report readiness instead of self-assigning backlog. See [[backlog_ui_laravel_manager_d7]] for the specific pending lane this superseded.
