---
name: lm-static-checks
description: How to type-check UI changes without builds, and the Edit-tool EOL pitfall on mixed CRLF/LF files in pycore_laravel_wordnew_ui
metadata:
  type: feedback
---

Team rule: no builds/tests unless the user asks; static checks that write nothing are allowed. For TS, use the TypeScript compiler API from `poly_apps/pycore_laravel_wordnew_ui/node_modules/typescript` with the repo tsconfig plus `noEmit: true, incremental: false`, root = the changed files, and print only diagnostics in those files. `apps/laravel-manager` was brought to 0 diagnostics on 2026-09-27 (laravel-manager-11); keep it at zero — any new diagnostic is a regression. Fix root causes (align types with the Laravel controller that produces the data) instead of casts. TS2304 "Cannot find name" on a value is a real runtime ReferenceError (found twice: AppQyV1 helper import, FileTreeParts Loader2) — fix those first.

Pitfall: many UI files are CRLF, some mixed (BaseAPI.ts was 562/609 CRLF). The Edit tool rewrites a mixed file to one EOL style, producing a whole-file diff. Use Python byte-level replacements that keep the file's EOL, or restore per-line EOLs from `git show HEAD:<path>` afterwards; check with `git diff --stat` vs `--ignore-cr-at-eol`.

**Why:** reviewers read the diff; EOL noise hides the real change.
**How to apply:** before editing a UI file, count `\r\n` vs `\n`; prefer scripted edits for CRLF/mixed files. Related: [[lm-i18n-conventions]].
