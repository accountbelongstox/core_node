---
name: vortex-crlf-files
description: Vortex app sources use CRLF line endings; scripted edits must preserve them
metadata:
  type: project
---

Files under `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/` are CRLF. A Python rewrite with default `open()` silently converts them to LF and turns a small change into a whole-file diff.

**Why:** a 2026-09-27 scripted edit produced a 4800-line diff on VortexApp.tsx until CRLF was restored.
**How to apply:** use the Edit tool (it keeps CRLF), or Python with `newline=''`; check with `file <path>` and `git diff --stat` after any scripted edit. Some shared files (e.g. `shell/shell-i18n.ts`) have mixed CRLF/LF; the Edit tool normalizes them, so patch those at byte level from the original. See [[vortex-i18n-namespace]].
