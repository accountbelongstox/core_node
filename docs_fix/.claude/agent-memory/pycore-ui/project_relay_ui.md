---
name: project-relay-ui
description: Where the single pycore relay lives in the UI, the tsc command, and editing gotchas
metadata:
  type: project
---

Relay UI code: `core/integrations/pycore/{RelayTransport, RelayDelivery, RelayPairing, PycoreRelayWire, PycoreRelayError, PycoreEventClient}.ts`, `core/integrations/laravel/{LaravelRelayAPI, LaravelRelayStream, LaravelRelayRoster, LaravelRelayTelemetry}.ts`, `core/contracts/{RelayContract, RelayCapabilities}.ts` (`RELAY_CONTRACT_DIGEST` = sha256 of the contract with CRLF folded to LF), stats in `apps/pycore-manager/components/PcRelayStats.tsx`.

**Why:** design `docs_fix/DESIGN_RELAY.md`: one relay, one hub connection per UI. A call fails only after `stall_window_seconds` of frame silence; `relay.events.dropped` triggers a reconcile; `isHeadlessRelayDevice` (no `desktop_session` capability) gates the Terminal and Window pages.

**How to apply:**
- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (the default heap OOMs, ~75 s). Unrelated WIP errors from other agents may appear.
- A concurrent `syncgit` merge can leave conflict markers under `core/integrations/pycore`; check for `<<<<<<<` before editing.
- Avoid git write-ish commands (the auto-mode classifier blocks Bash after them); use Edit.
