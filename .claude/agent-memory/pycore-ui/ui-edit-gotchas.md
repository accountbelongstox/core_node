---
name: ui-edit-gotchas
description: Editing the pycore UI tree on Windows: CRLF worktree files, 6-minute tsc, auto-commit agent, python alias hang
metadata:
  type: feedback
---

UI worktree files are CRLF (git autocrlf=true, index LF). Multi-line `node -e` string replaces fail silently on them; the Edit tool matches but writes LF lines into a CRLF file (mixed EOL).

**Why:** hit this twice in the 2026-10-02 audit; mixed EOL shows `w/mixed` in `git ls-files --eol`.
**How to apply:** use the Edit tool, then normalize new/rewritten files to CRLF (read, replace `\r\n`->`\n`, `\n`->`\r\n`) unless `git ls-files --eol` shows `w/lf` originally. A helper that preserves EOL (`edit(file, [[old,new],...])` reading as LF, writing CRLF back) is worth recreating in the scratchpad.

- Full `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` takes ~6.5 min here; run it in the background once at the end. Baseline errors live only in apps/wordnew (missing cache components), not pycore-manager.
- Running bare `python` in Bash hangs on the Windows Store alias; use `node` for scripting.
- Another agent auto-commits the worktree ("win1.0.0..." commits), so `git status` can look clean for files you just changed.
