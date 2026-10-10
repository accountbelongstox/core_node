---
name: ui-tsc-skips-semantic-errors
description: poly_apps/pycore_laravel_wordnew_ui tsconfig.json check reports only the node_modules .d.cts syntax errors and silently skips ALL type errors; use a scoped tsconfig instead
metadata:
  type: reference
---

Running `node_modules/.bin/tsc --noEmit -p tsconfig.json` in `poly_apps/pycore_laravel_wordnew_ui` (about 90 s) prints only TS1005 syntax errors from `node_modules/@jridgewell/*.d.cts`; when syntax errors exist tsc skips semantic checking, so "no errors outside node_modules" proves nothing (a deliberate `const x: number = 'a'` was not reported).

Working check (about 6 s): a scratch tsconfig that `extends` the project one with absolute paths, `include` only `apps/codemart/**/*` plus `node_modules/vite/client.d.ts`, `exclude` `**/node_modules/**` and `**/node_modules.*/**`, `types: ["node"]`, `noUnusedLocals: true`. The only expected noise is `import.meta.glob` and `*.webp` module errors. Keep the file in the scratchpad (not the project, gitsync auto-commits the tree).

**Why:** the lead's task text says to ignore the .d.cts errors, which hides this; found 2026-10-11 while building the mobile WP-C screens.
**How to apply:** use the scoped config for every UI type check; an i18n key checker (bundle cm-locales with esbuild, regex `t('...')` keys in the touched dirs) is the other cheap guard.
