---
name: crlf-mixed-line-endings
description: Many wordnew/shared UI files are CRLF (some mixed); Python text-mode edits silently convert them to LF and blow up the diff
metadata:
  type: feedback
---

Many files under `poly_apps/pycore_laravel_wordnew_ui` are CRLF (e.g. `apps/wordnew/api/*`, `locales/*_b.ts`, `WfNewLocales.ts`, `core/network/api-client/*`), others LF, and `MasterApiClient.ts` is mixed (a few LF lines).

**Why:** A Python `open(p).read()/write()` edit normalized CRLF to LF and turned a 3-line change into a 1300-line diff (2026-09-27).

**How to apply:** Before scripted edits, check `grep -c $'\r$' file`; edit in binary mode and restore the original EOL per line (or use the Edit tool). Verify with `git diff --stat` that only intended lines changed.
