---
name: team_resume_check
description: on resume (session restart, usage-limit reset), check for a new docs_fix/TASK_*.md orchestrator ruling before acting on any previously-found backlog
metadata:
  type: feedback
---

Before resuming or self-assigning any previously-identified backlog task in this multi-session team, check whether `ca-orchestrator` issued a newer ruling: look for the latest `docs_fix/TASK_YYYYMMDD_*.md` and watch for an incoming cross-session message from `ca-orchestrator` shortly after going active. Role-to-path ownership and even the completion-gate protocol are revised between runs (e.g. the 2026-09-28 `TASK_20260928_TEAM_RESUME_ROSTER.md` R2 ruling demoted `ui-laravel-manager` from default writer of `apps/laravel-manager` to a reserve/alias session behind `pycore-ui`, and R4 put all carried backlog on hold pending the user's next task).

**Why:** In this session, after a usage-limit reset, the resume instruction said "continue the task you were working on." Old evidence (my own prior report, `.claude/agents_shared/d22/items_pycore.json`'s `ui-laravel-manager-D7` entry) looked like a ready, unblocked backlog task, and I started dependency analysis and was about to begin implementing files in `apps/laravel-manager` before an orchestrator message (R2) arrived clarifying that ownership had moved to `pycore-ui` and the backlog was on hold. Acting on stale role-authority assumptions in a fast-moving multi-agent team risks writing files outside current scope.

**How to apply:** On every resume in this repo, before editing anything: (1) run `ListAgents` to confirm session state, (2) grep the newest `docs_fix/TASK_*.md` for rulings that touch this role's ownership or gate, (3) prefer waiting a beat for an orchestrator message over immediately re-launching old backlog. See [[ownership_r2_pycore_ui]].
