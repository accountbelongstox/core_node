---
name: project-role-status
description: Post-D22 roster ruling — pycore-assist is a reserve/alias session; pycore-runtime is the default writer for the whole pycore-assist scope including agent_history
metadata:
  type: project
---

Per `docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md` rulings R2/R3 (orchestrator, confirmed live by
`ca-orchestrator` on 2026-09-28): `pycore-runtime` is the roster (post-D22) default writer for
every path in the `pycore-assist` scope, including `pycore/pyctl/agent_history/` explicitly (R3).
`pycore-assist` is a pre-D22 alias session and stays in reserve — it edits a path in its scope only
when a specific task names `pycore-assist` as the temporary writer for that task. This matches the
retirement note already seen in `.claude/agents_shared/reviews/pycore-assist-D7*.json` ("retired by
D22; successor pycore-runtime"): that was not a one-off historical artifact, it is the standing
rule.

**Why:** one writer per path (R2's stated reason); the D22 roster members hold the post-D22 history
and reviews name them as successors, so giving the alias session default write would create
duplicate/conflicting edits on the same paths.

**How to apply:** when idle and given no task, do not pick up default work in the pycore-assist
scope on my own initiative — wait to be explicitly named temporary writer by the coordinator/
orchestrator/group leader for a specific task. If a message or task later names `pycore-assist` as
temporary writer for some path, that overrides this default (it's the explicit-assignment
exception R2 itself carves out). Re-check `docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md` (or
whatever supersedes it) if this seems stale — these rosters get revised. See
[[project-pycore-pitfalls]].
