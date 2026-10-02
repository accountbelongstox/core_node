---
name: project-gitsync-autocommit
description: The user's gitsync auto-commits the whole working tree mid-session (commits named win1.0.0<timestamp> / debian13...), so later edits diff against that commit
metadata:
  type: project
---
The user's gitsync runs periodically and commits everything in the working tree (commit subjects like `win1.0.02026-10-02-12-01-40`, `debian131.0.0<ts>`), sometimes in the middle of a multi-step edit.

**Why:** observed 2026-10-02 — a d3d4tester refactor was committed half-way; a later CRLF normalisation of two new files then showed up as whole-file EOL churn against that commit.

**How to apply:** write new files with their final line endings on the first write (match sibling files: d3d4tester C# is CRLF; Write tool emits LF). Before reporting, compare against `git log -1` — `git status` may show only the tail of your work. Related: [[feedback-line-endings]].
