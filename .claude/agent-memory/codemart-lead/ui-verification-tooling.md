---
name: ui-verification-tooling
description: How to typecheck and drive the CodeMart UI headlessly on this box (plain tsc is blind, puppeteer is broken, demo data and logins)
metadata:
  type: reference
---

- Plain `tsc -p tsconfig.json` in poly_apps/pycore_laravel_wordnew_ui reports only syntax errors from `node_modules*/**/*.d.cts` and then SKIPS semantic checks, so "no errors" means nothing. Use a scratchpad tsconfig that `extends` the project one, sets `types:["node"]` + `typeRoots` to the project node_modules/@types, `include`s vite/client.d.ts, index.tsx, apps/codemart, shell, core and excludes both node_modules dirs (the stray `node_modules.pre_program_drive.*`). Filter the known noise (`import.meta.glob/hot`, `.webp/.png/generated/?raw` modules). Probe with a deliberate type error to prove it works.
- `puppeteer(-core)` does not load on Node 26 here (yargs ESM require error). Drive headless Chrome over raw CDP (spawn `google-chrome --headless=new --remote-debugging-port`, WebSocket, Fetch domain for request mocks, DOM.setFileInputFiles for uploads). Login via the UI form with `?cm_ui=mobile&lang=zh`; `lang` must be passed on every navigation. Click helpers must retry: lazy screens render late.
- Seed password: `apps/codemart/tests/lib/cmTestEnv.mjs` readSeedPassword(); API helper `tests/lib/cmApiClient.mjs`. Demo users codemart_demo_{client,developer,architect,reviewer,admin,newdev,client2}; newdev has only a pending developer role, so use `developer` for accept/submit flows. A fresh developer: register `cmtest_*` + role deposit + admin confirm (see tests/flows.mjs).
- Incident 2026-10-11: live API login returned 500 because the postgres datadir was chowned debian:debian while the server runs as `postgres` (laravel log in /www/wwwroot/laravel_db/logs: SQLSTATE 42501 could not open file). Someone else fixed ownership; check `stat` of the datadir first when every authenticated call 500s.
- AI analysis is switched off on this server (`analysis_available:false`): analyze/poll/accept/revision flows can only be exercised against a mock (project 2 in proposal_review has `can_accept:true`; accepting it would change demo data).
