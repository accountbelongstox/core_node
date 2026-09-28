---
name: writer-roster-reserve-2026-09-28
description: Since 2026-09-28 laravel-qyapp is a reserve alias, not default writer, for its own scope
metadata:
  type: project
---

Orchestrator ruling R2 (`docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md`, D22 roster resume): for paths covered by both a D22 roster member and a pre-D22 alias session, the roster member is the default writer. Alias sessions write only when a task explicitly names them as temporary writer.

Map relevant to this session:
- `laravel-qyapp` → default writer is now **`wordnew-laravel`** for `app/Apps/AppQyV1/` and the wordnew backend generally.
- Machine/internal routes (worker, internal/pycore, ingest, delivery, queue-center lanes) → default writer is now **`pycore-laravel`**.
- ct-laravel-qyapp (this session) stays in reserve: do not edit AppQyV1 or machine-route files unless a task from `ca-orchestrator` or a group leader explicitly names `laravel-qyapp` as temporary writer for that task.

**Why:** D22 roster members (`wordnew-laravel`, `pycore-laravel`, etc.) hold the post-D22 review history and are recorded as successors; one writer per path avoids concurrent edits to the same files from two sessions with overlapping scope.

**How to apply:** When `ca-orchestrator` or any peer asks this session to do AppQyV1/machine-route work, check whether the task explicitly names `laravel-qyapp` as temporary writer. If not, redirect/defer to `wordnew-laravel` or `pycore-laravel` and report back rather than editing. Re-verify this mapping is still current before acting on it in a future session — it can change again with a later roster ruling. Related: [[laravel-route-auth-model]].
