---
name: alias-sessions-default-writer
description: Launches can start the pre-D22 alias roles (laravel*, ui-*, mcp-chrome, pycore, pycore-architect, pycore-assist) next to the D22 roster; the roster member is the default writer
metadata:
  type: project
---

The 2026-09-28 launch ran 13 pre-D22 alias sessions alongside the 15 local D22 roster members. They overlapped path for path, e.g. `laravel-qyapp` and `wordnew-laravel` on AppQyV1. After the restart, each alias session asked who owns its paths.

Ruling R2 (docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md): the roster member in `config/claude_team_roles.json` groups is the default writer. An alias session writes only when a task names it as temporary writer.

**Why:** one writer per path. Reviews from D22 onward already name the roster members as the successors.

**How to apply:** at startup, if ListAgents shows alias `ct-*` sessions, send R2 once to every alias session and to the group leaders before they ask. Check that the catalog still matches before you reuse the map. Related: [[parallel-user-sessions]].
