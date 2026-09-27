---
name: ruling-r2-alias-reserve
description: Orchestrator ruling R2 - ui-codemart is a pre-D22 alias session; codemart-ui is the D22 roster default writer for apps/codemart and flavors/codemart
metadata:
  type: project
---

Per `docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md` ruling R2: for a path covered by both a D22 roster member and a pre-D22 alias session, the roster member is the default writer. Alias sessions write only when a task explicitly names them as temporary writer. The map (from `config/claude_team_roles.json` groups) includes `ui-codemart` → `codemart-ui` (my case), plus `laravel-qyapp`→`wordnew-laravel`, `ui-wordnew`→`wordnew-ui`, `laravel-codemart`→`codemart-laravel`, `mcp-chrome`→`wordnew-link`, `ui-pycore-manager`/`ui-laravel-manager`/`ui-vortex`→`pycore-ui`, `laravel`/`laravel-api`→`pycore-laravel`, `pycore`/`pycore-architect`→`pycore-lead`, `pycore-assist`→`pycore-runtime`.

**Why:** one writer per path; the roster member (`codemart-ui`, run as session `ct-codemart-ui`) holds the post-D22 review history and is named successor in reviews (e.g. `codemart-ui-G1.json`). A parallel alias-session edit on the same files would break that.

**How to apply:** as `ui-codemart` (session `ct-ui-codemart`), stand by in reserve on `apps/codemart/` and `flavors/codemart/` by default. Do not pick up open CodeMart UI backlog items (cmdesign-03 rest, d9-01-ui, cmgap-R1(-ui), CMDES-08, cmcont-11, codemart-G3, zh glossary writer, pycore-laravel referrals — see roster doc §ownership) unless `ct-codemart-lead` or `ca-orchestrator` names `ui-codemart`/`ct-ui-codemart` as temporary writer in a specific task. Confirmed twice on 2026-09-28 (ct-codemart-lead then ca-orchestrator, both independently), so treat as settled unless a later ruling supersedes it.
