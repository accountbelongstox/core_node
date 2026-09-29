---
name: ui-tsconfig-nonstrict-narrowing
description: UI tsconfig has no strict mode, so boolean-literal discriminated unions do not narrow; use `'key' in obj` checks
metadata:
  type: feedback
---

`poly_apps/pycore_laravel_wordnew_ui/tsconfig.json` does not enable `strict`, so a union like `{ ok: true; ... } | { ok: false; error: string }` does not narrow on `if (!res.ok)`; `res.error` stays a type error.

**Why:** hit on 2026-09-27 while typing an enrich-batch result in PcSentenceAudioPanel.

**How to apply:** shape results so an `in` check narrows (`if ('error' in res)`), and verify with `node node_modules/typescript/bin/tsc --noEmit -p .` filtered to the files you touched (the project has unrelated diagnostics in other apps). See also [[crlf-files-pitfall]].
