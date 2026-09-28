---
name: native-host-stdio-and-shared-dist
description: mcp-chrome native host stdout is the native-messaging channel; chrome-mcp-shared resolves to its built dist
metadata:
  type: project
---

- The native host (`app/native-server`) talks to the extension over framed stdin/stdout. Any module it loads must log to stderr. The ncore logger writes to stdout unless `MCP_MODE=mcp`, so the host sets it in `native-server/src/ncore.ts` (the one loader for ncore's `client_key_auth` and `local_rpc_guard`) before requiring them. See [[mixed-line-endings]] for editing care.
- `chrome-mcp-shared` resolves to `packages/shared/dist` for both the extension and the host; new shared types only type-check after `build:shared` (the build scripts run it first). For a no-write static check, use a scratchpad tsconfig that maps `chrome-mcp-shared` to `packages/shared/src/index.ts` and sets `typeRoots` back to the app's `node_modules/@types` (a custom `baseUrl` also makes bare `wxt` resolve wrongly in `wxt.config.ts`; ignore those lines).
- Plain `tsc --noEmit -p app/chrome-extension` always prints 17 `Cannot find module './*.vue'` lines; they are pre-existing.

**Why:** learned while adding client-key signing over native messaging (2026-09-27).

**How to apply:** check these before adding a host-side dependency or a new shared message type.
