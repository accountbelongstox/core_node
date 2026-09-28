---
name: project-roster-r2
description: Orchestrator ruling R2 (2026-09-28): pycore-lead is the default writer for the pycore coordinator paths; ct-pycore edits only when named temporary writer
metadata:
  type: project
---

Ruling R2 (2026-09-28, `docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md`):
- On a path shared by a D22 roster member and a pre-D22 alias session, the roster member is the default writer.
- `pycore` and `pycore-architect` map to `pycore-lead`. `pycore-assist` maps to `pycore-runtime`. R3 makes `pycore-runtime` the writer of `pycore/pyctl/agent_history/`.

**Why:** one writer per path. The roster members hold the post-D22 review history.

**How to apply:**
- As ct-pycore, stay in reserve: edit entry points, launcher or foundations only when a task explicitly names pycore as temporary writer.
- Route requests for those paths to `pycore-lead`, and pycore-assist-area work to `pycore-runtime`.
- Re-check the roster record before relying on this, since rulings change per run.
- Related: [[project-pycore-pitfalls]].
