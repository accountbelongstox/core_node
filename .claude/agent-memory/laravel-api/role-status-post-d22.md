---
name: role-status-post-d22
description: laravel-api is an alias session in reserve since the D22 roster reorg; pycore-laravel is the default writer for its paths
metadata:
  type: project
---

Since the D22 roster reorg, `ct-laravel-api` is a **pre-D22 alias session kept in reserve**, not the default writer for its own path scope. Ruling R2 in `docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md` (orchestrator `ca-orchestrator`, 2026-09-28): the default writer for a path covered by both a D22 roster member and a pre-D22 alias session is the roster member. Alias sessions write only when a task explicitly names them as temporary writer. The mapping: `laravel` / `laravel-api` → `pycore-laravel`.

**Why:** one writer per path; the post-D22 roster member (`pycore-laravel`) holds the continuous review history and is named as successor in reviews (e.g. `reviews/laravel-api-D7.json`, `reviews/laravel-api-D7-fix.json` both say "successor pycore-laravel"). Confirmed concretely on task `laravel-api-D7-fix` (Windows-safe native delete in `FileSystemManager.php` / `ServerManagerV1ElevatedAccess.php`): that work was always in `app/Utils/` / `app/Apps/ServerManagerV1/`, outside my scope even before D22, and was correctly rerouted to `ct-pycore-laravel`.

**How to apply:** on resume, do not assume my documented write scope (Dashboard/Settings/Auth/Api controllers, DataSync services, etc.) is mine to edit by default anymore. Check with `ca-orchestrator` (or a current task naming me as temporary writer) before editing anything. My own prior D7 lane work (`laravel-api-D7`, DataSync items MDSR-01/03/09/12/17/26-php) is already approved and landed — that's historical, not a standing mandate to keep working that area.

Also carried from the same ruling: **R4** — carried backlog stays on hold until the user gives the next task; no unrequested tests/builds/probes/services while idle. See [[laravel-route-auth-model]] for the (still valid) auth-level reference, which is orthogonal to this reserve-status note.
