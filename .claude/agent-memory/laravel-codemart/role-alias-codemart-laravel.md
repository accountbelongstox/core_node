---
name: role-alias-codemart-laravel
description: laravel-codemart is a reserve/alias role; codemart-laravel (codemart-lead group) is the default writer for app/Apps/CodeMartV1
metadata:
  type: project
---

There are two role catalogs that both claim `app/Apps/CodeMartV1/`, `routes/CodeMartV1Router/` and the CodeMart migrations:
- `laravel-codemart` (this role) — part of the D16 (2026-09-27) Laravel-family split, coordinated by the `laravel` role/session (`ct-laravel`).
- `codemart-laravel` — part of the pre-existing, separately-rostered `codemart-lead` / `codemart-ui` / `codemart-laravel` product group.

Orchestrator ruling R2 (2026-09-28, `docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md`, team-resume roster doc): for any path covered by both a D22-roster member and a pre-D22 "alias" session, the roster member is the **default writer**; the alias writes only when a task explicitly names it as temporary writer. The map includes `laravel-codemart` → `codemart-laravel` (default writer). Other alias pairs in the same ruling, for context: `laravel-qyapp`→`wordnew-laravel`, `ui-codemart`→`codemart-ui`, `laravel`/`laravel-api`→`pycore-laravel`, `mcp-chrome`→`wordnew-link`.

**Why:** avoids two independent sessions editing the same CodeMartV1 files concurrently; the codemart-lead group's session already held the post-D22 review history (its D7/D7-fix/G1 reviews are filed under role `codemart-laravel`, reports under `reports/codemart-laravel.md`) when this collided during a 2026-09-27→28 usage-limit restart of both role families.

**How to apply:**
- Do NOT proactively edit `app/Apps/CodeMartV1/`, `routes/CodeMartV1Router/`, or CodeMart migrations. Stay in reserve.
- Before editing that scope, confirm a task or `ca-orchestrator`/`ct-laravel` names `laravel-codemart` specifically as the temporary writer for that task.
- If asked to check status of CodeMart backend work, look at `reviews/codemart-laravel-*.json` and `reports/codemart-laravel.md` (the active writer's records), not just files under my own `reports/laravel-codemart.md`.
- This ruling could be revisited by a later orchestrator decision — re-check `docs_fix/` (or ask `ca-orchestrator`) if a new task arrives that asks me to write CodeMartV1 code without explicitly naming me as temporary writer; don't assume the ruling silently reversed.
- See [[laravel-route-auth-model]] and [[verify-in-process-without-writes]] for the technical conventions that still apply whenever I *am* named temporary writer.
