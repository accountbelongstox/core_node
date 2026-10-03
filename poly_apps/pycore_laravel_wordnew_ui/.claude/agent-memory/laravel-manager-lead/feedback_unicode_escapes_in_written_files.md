---
name: unicode-escapes-in-written-files
description: Write/heredoc content can turn \uXXXX escapes into literal characters in source files; post-process new .ts/.tsx files
metadata:
  type: feedback
---

When writing TS/TSX source through Write or a bash heredoc, `\uXXXX` escapes in the content sometimes arrive in the file as literal characters (NBSP, BOM, U+2028 inside a regex literal, accented letters).

**Why:** Observed 2026-10-03 while building the converter workbenches; a literal U+2028 in a regex literal is a syntax error and a literal BOM/NBSP is invisible and fragile.

**How to apply:** After creating source files, run a small pass that re-escapes every non-ASCII character to `\uXXXX` (not on locale files that legitimately contain Chinese), then `grep -nP '[^\x00-\x7F]'` to confirm. Also useful for verification of tool UIs without a browser: bundle a workbench test with esbuild (externals react/react-dom/i18next/lucide-react), stub `@/apps/laravel-manager/api`, set jsdom globals via `node --import` BEFORE react-dom loads, and drive inputs with the native value setter plus an `input` event inside `act`.
