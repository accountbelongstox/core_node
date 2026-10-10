---
name: tsc-blind-to-semantic-errors
description: Plain `tsc -p tsconfig.json` in the UI shell hides semantic errors because of syntax errors in node_modules.pre_program_drive*; use a temp config excluding it
metadata:
  type: reference
---

In `poly_apps/pycore_laravel_wordnew_ui`, `tsc --noEmit -p tsconfig.json` reports only `.d.cts` TS1005 syntax errors (from `node_modules.pre_program_drive*`, not excluded) and then skips semantic checks, so type errors and unresolved imports pass silently.

**How to apply:** create a temporary `tsconfig.cmcheck.json` extending `./tsconfig.json` with exclude `["node_modules","node_modules.pre_program_drive*","dist","vite.config.ts","native","artifacts"]`, run tsc with it, delete it. Documented in docs_fix/DESIGN_CODEMART.md section 10. Also: with Laravel DB routes returning 500, verify UI via puppeteer request interception of `/laravel-api/api/*` (fixtures), see scratchpad shots.mjs approach.
