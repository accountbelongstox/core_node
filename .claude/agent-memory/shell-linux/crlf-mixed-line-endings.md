---
name: crlf-mixed-line-endings
description: Line endings under scripts/ are mixed (some .py CRLF, .sh must be LF); count CRs with tr, not grep, in Git Bash
metadata:
  type: feedback
---

Some tracked files in scripts/ are CRLF (e.g. scripts/git/gitput_unified_modules/*.py) while `.gitattributes` forces `*.sh` to LF. A Python `open().read()`/`write()` edit silently converts CRLF to LF and turns a 10-line change into a whole-file diff. Working-tree `.sh` copies can also be CRLF although HEAD is LF (seen 2026-09-27 on the claude team launchers); normalizing those to LF is diff-free and required for bash under WSL.

**Why:** IS-010 (encryption.py whole-file diff, caught only by `git diff --stat`); D13 (CRLF .sh working copies). In Git Bash, `grep -c $'\r' file` printed the line count instead of the CR count, so it gave false alarms.

**How to apply:** count CRs with `tr -cd '\r' < file | wc -c` (or `od -c`), never `grep -c $'\r'`. Keep the ending of CRLF files (`open(p, newline='')` or the Edit tool); convert `.sh` to LF. Compare against `git show HEAD:<f>` after batch edits. See [[wsl-verification-recipe]].
