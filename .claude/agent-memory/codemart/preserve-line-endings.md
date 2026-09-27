---
name: preserve-line-endings
description: Some UI files (e.g. apps/codemart/api/index.ts) are CRLF; scripted edits must keep each file's original line endings
metadata:
  type: feedback
---

Keep every file's original line endings. Python `read_text()`/`write_text()` silently converts CRLF to LF across the whole file. `apps/codemart/api/index.ts` is CRLF, and most other codemart files are LF.

**Why:** the reviewer flagged a whole-file CRLF-to-LF diff on api/index.ts in codemart-5 (2026-09-27).

**How to apply:** use the Edit tool for small changes. In scripts, work on bytes, or open the file with `newline=''`. Before submitting, compare the `grep -c $'\r$'` count of each changed file against `git show HEAD:<file>`.
