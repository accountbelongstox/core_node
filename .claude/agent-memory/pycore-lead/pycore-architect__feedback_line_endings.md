---
name: feedback-line-endings
description: Reviewer rejects CRLF/LF churn in pycore diffs; many pycore files are CRLF or mixed, so edits must keep per-line endings
metadata:
  type: feedback
---

Keep each file's existing per-line endings in pycore (many files are CRLF, some are mixed CRLF/LF).

**Why:** The reviewer flagged whole-file CRLF->LF conversions in pycore-1/2/3 (e.g. a 2-line edit showing as 411 changed lines) and asked for per-line endings to be restored from HEAD; review then has to fall back to `--ignore-space-at-eol`.

**How to apply:**
- Edit with newline-preserving tools (Python `open(..., newline="")` and replace blocks using the file's own `\r\n`/`\n`), then compare `git diff --numstat` with and without `--ignore-space-at-eol`; they must match.
- If churn slipped in, restore per line from `git show HEAD:<path>` with a difflib opcode walk (equal lines take HEAD's ending, new lines the dominant one).
- Count endings with Python bytes (`count(b"\r\n")`), not `grep -c $'\r$'` in Git Bash, which miscounts.
- Related: [[project-pycore-pitfalls]].
