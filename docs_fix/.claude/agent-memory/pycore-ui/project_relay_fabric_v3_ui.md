---
name: project-relay-fabric-v3-ui
description: Where the Relay Fabric V3 fast lane lives in the UI and gotchas hit while building it (2026-09-30)
metadata:
  type: project
---

Fast lane UI code: `core/integrations/pycore/LaravelFabricTransport.ts` (transport), `PycoreLaravelRelayTransport.ts` (`deliverLaned` router + read coalescing), `core/contracts/RelayFabricContract.ts` (adapter, digest = sha256 of file text with CRLF folded to LF), `core/integrations/laravel/LaravelFabricTelemetry.ts`, stats tab in `apps/pycore-manager/PcHttpDebugger.tsx`.

**Why:** design `docs_fix/DESIGN_20260930_RELAY_FABRIC_V3_HUB_NATIVE_RPC.md`; there was no pre-existing `PycoreTransport` interface (created `PycoreTransportTypes.ts`).

**How to apply:**
- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (default heap OOMs, ~75 s). Unrelated WIP errors from other agents may appear.
- A concurrent `syncgit` merge left conflict markers in `PycoreLaravelRelayTransport.ts` mid-task (upstream converted CRLF->LF and dropped `bridgeRelayDeviceEvent`); re-check for `<<<<<<<` before editing files under `core/integrations/pycore`.
- The auto-mode classifier blocked Bash after I overwrote a conflicted file with `git show > file`; avoid git write-ish commands, use Edit.
