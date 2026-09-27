---
name: crlf-files-pitfall
description: Many UI files (pycore-manager pages, core/integrations/pycore) are CRLF or mixed; Python text-mode rewrites silently convert them to LF
metadata:
  type: feedback
---

Many files under `poly_apps/pycore_laravel_wordnew_ui/` (most pycore-manager pages/components, `core/integrations/pycore/PycoreClient.ts`) use CRLF, some mixed CRLF/LF. A Python `open(p).read()/write()` rewrite normalizes them to LF and the whole file shows as changed in `git diff`.

**Why:** happened on 2026-09-27 (14 files turned into whole-file diffs; reviewer would see noise).

**How to apply:** prefer the Edit tool, or open files with `newline=''` in Python. After scripted edits, compare `git diff | grep -c '^[-+]'` with `git diff --ignore-space-at-eol` per file; if they differ, restore endings from `git show HEAD:<file>` line by line.
