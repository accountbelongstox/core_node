---
name: team-task-board-fallback
description: When TaskCreate/TaskList tools are missing, track tasks as <role>-<n> rows in the shared TASKS.md and report file
metadata:
  type: feedback
---

TaskCreate/TaskUpdate may be unavailable in agent-team sessions. Then use ids `codemart-<n>`, add rows to the current `.claude/agents_shared/<effort>/TASKS.md`, keep `.claude/agents_shared/reports/codemart.md` current, and the reviewer writes `.claude/agents_shared/reviews/codemart-<n>.json`.

**Why:** the orchestrator's TASKS.md (2026-09-27) set this convention because the build lacked task tools.

**How to apply:** check ToolSearch for task tools first; if absent, follow the board file's convention instead of inventing another.
