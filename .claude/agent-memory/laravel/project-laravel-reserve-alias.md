---
name: project-laravel-reserve-alias
description: Since 2026-09-28 (orchestrator ruling R2/R3) laravel is a reserve alias; pycore-laravel is the default Laravel foundation writer
metadata:
  type: project
---

Orchestrator ruling R2/R3 (docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md, 2026-09-28): when a path is covered both by a D22 roster member (config/claude_team_roles.json groups) and by a pre-D22 alias session, the roster member is the default writer. The ruling maps `laravel` and `laravel-api` -> `pycore-laravel`, `laravel-codemart` -> `codemart-laravel`, and `laravel-qyapp` -> `wordnew-laravel`. PathMapper.php goes to pycore-laravel. R5 assigns the lang files: `lang/*/codemart.php` -> codemart-laravel, `lang/*/app_qy_v1.php` -> wordnew-laravel, every other `lang/` file -> pycore-laravel.

**Why:** one writer per path. The roster members hold the post-D22 history, and reviews name them as successors.

**How to apply:** edit Laravel paths only when a task names laravel as temporary writer. Send foundation follow-ups to pycore-laravel through pycore-lead. The D16 coordinator duties (merge check, temporary-writer records) apply only when a task dispatches them to me. Check the newest docs_fix roster record before acting, because the ruling may change.
