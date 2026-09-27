---
name: crlf-mixed-line-endings
description: Some files under scripts/ (e.g. scripts/git/gitput_unified_modules/*.py) are CRLF; scripted edits must keep line endings
metadata:
  type: feedback
---

Some tracked files in scripts/ are CRLF while most .sh/.ps1 are LF. A Python `open().read()`/`write()` edit silently converts CRLF to LF and turns a 10-line change into a whole-file diff.

**Why:** happened on scripts/git/gitput_unified_modules/encryption.py (171 CRLF lines) during the IS-010 fix; caught only by `git diff --stat`.

**How to apply:** before a scripted edit, check `grep -c $'\r' <file>`; use `open(p, newline='')` and write back with the same ending, or use the Edit tool. After a batch of edits, compare CR counts of `git show HEAD:<f>` vs the working file.
