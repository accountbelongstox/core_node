---
name: team-task-board-fallback
description: When TaskCreate/TaskList tools are missing, list codemart-<n> tasks at the top of my report and send ids to the lead; the board file is lead-only
metadata:
  type: feedback
---

TaskCreate/TaskUpdate may be unavailable in agent-team sessions. Then use ids `codemart-<n>` grouped by theme with finding IDs, put the list at the top of `.claude/agents_shared/reports/codemart.md`, and message the lead the id list. The shared `TASKS.md` board is written only by the orchestrator. Do not edit it. The reviewer writes `.claude/agents_shared/reviews/codemart-<n>.json`.

**Why:** on 2026-09-27 I appended rows to the lead's TASKS.md, and the lead restated that only it writes that file.

**How to apply:** check ToolSearch for task tools first. If they are absent, follow this convention and touch only my own report file in `agents_shared/`.
