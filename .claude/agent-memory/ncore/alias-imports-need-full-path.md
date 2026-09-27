---
name: alias-imports-need-full-path
description: package.json "#@..." imports do no extension or index.js lookup; extensionless alias requires throw MODULE_NOT_FOUND at runtime
metadata:
  type: project
---

`require('#@ncore/utils/rpc')` fails with MODULE_NOT_FOUND: Node package imports (the `imports` map in the root package.json) resolve exact files only, with no `.js` extension search and no directory `index.js`. Always write the full file path, e.g. `#@ncore/utils/rpc/index.js`, `#@/config/service_contract.js`.

**Why:** in 2026-09 this silently broke `createApp()` on 58000, WebLocalAreaNetwork, VoiceClientAndCaddy and several utils at load; `node --check` does not catch it.

**How to apply:** after adding or moving requires, resolve every alias string from the repo root (`node -e "require.resolve('<alias>')"` run with cwd = repo root; a script in the scratchpad resolves against the wrong package scope). Relative requires need a separate path-exists check.
