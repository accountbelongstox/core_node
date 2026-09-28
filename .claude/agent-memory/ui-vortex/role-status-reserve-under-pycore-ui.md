---
name: role-status-reserve-under-pycore-ui
description: ui-vortex is a pre-D22 alias; pycore-ui is now default writer for apps/vortex and flavors/vortex per orchestrator ruling R2
metadata:
  type: project
---

Since the 2026-09-28 team resume, ui-vortex is a pre-D22 alias session. The roster
member `pycore-ui` (catalog: pycore group, owns pycore-manager/laravel-manager/vortex/
pdd-manager UI apps and is default writer of the shared UI layer) is now the **default
writer** for `apps/vortex/` and `flavors/vortex/` in
`poly_apps/pycore_laravel_wordnew_ui/`.

Ruling source: `docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md`, decision R2 (orchestrator
`ca-orchestrator`), explicit mapping: `ui-vortex` → `pycore-ui`. Confirmed live by
ca-orchestrator message on 2026-09-28: "pycore-ui is the default writer for apps/vortex
and flavors/vortex. You stay in reserve and edit only when a task names you as temporary
writer."

**How to apply:**
- Do not edit `apps/vortex/` or `flavors/vortex/` proactively, even for a task that looks
  squarely in the old ui-vortex scope. Wait for the orchestrator (or pycore-ui as group
  leader) to explicitly name `ui-vortex` as temporary writer for a specific task before
  touching files there.
- The reviewer/history for post-D22 Vortex work is under `pycore-ui` (e.g. the review
  for ui-vortex-D7 was written by `pycore-lead`, and pycore-ui-G5 is the live follow-up
  task id for the OKX shape-alignment work, not a new ui-vortex task).
- New reports for Vortex work go to `.claude/agents_shared/reports/pycore-ui.md`, not
  `ui-vortex.md` — `pycore-lead`'s review of ui-vortex-D7 flagged this explicitly.
- The last real ui-vortex work (CKA-10-ui, gating OKX panels behind served okx/* routes)
  is done and approved (commit `5bbb23682`); see [[okx-routes-not-served]] for the
  substance. The open follow-up ("G5": align panel response shapes once pycore serves
  okx/* routes) is parked and owned by pycore-ui, not ui-vortex, until named otherwise.
- If a future session under the ui-vortex name is asked to do Vortex work without an
  explicit temporary-writer assignment, defer to pycore-ui/orchestrator rather than
  editing directly — this mirrors R2 and avoids a two-writer conflict on the same paths.
- This mapping could change again in a later reorg — before relying on it, check whether
  `docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md` (or a newer resume doc) is still the
  latest roster ruling, and whether `config/claude_team_roles.json` still lists pycore-ui
  as owning the vortex app.
