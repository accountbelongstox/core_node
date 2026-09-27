---
name: parallel-user-sessions
description: The user runs other Claude sessions (core-node-*) in the same repo alongside the team, and a CodeHeaderCleaner tool that strips AI header blocks; check both before blaming a role for a change
metadata:
  type: project
---

The user runs independent Claude sessions named `core-node-<xx>` in the same checkout while the team works. It also runs its own `scripts/pytools/ai_prompt_upload_head/CodeHeaderCleaner.py`, which strips the leading AI rules header blocks from thousands of files. It takes a backup commit first, e.g. `f4f223414` "CodeHeaderCleanerBak" (2026-09-27).

**Why:** 2026-09-27. A reviewer flagged unreviewed Dual Boot/Disk Repair script edits that no role had made; session core-node-e9 owned them. The user also asked who deleted files that pycore had deleted (AT-037). The deletions showed up in the user's cleaner backup commit, not in a role commit.

**How to apply:** When an unexplained change appears:
- run ListAgents, look at the peer sessions, and ask them with one short SendMessage;
- compare file mtimes with the role reports (`.claude/agents_shared/reports/`);
- fence confirmed peer-owned files on the task board (ext-N rows), and ask peers to announce whole-file rewrites under `scripts/`.

Reviewers ignore header-block removals (rule in reviewer.md). Related: [[remote-role-messaging]].
