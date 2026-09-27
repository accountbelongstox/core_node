# ui-vortex report

## ui-vortex-D7

Batch 1/1. Status: implemented and verified. It stays in progress until the reviewer writes `.claude/agents_shared/reviews/ui-vortex-D7.json` with `"verdict": "approved"`. Reviewers diff against 74e7770; the three files below keep CRLF endings.

### CKA-10-ui: align VortexPycoreContract.ts with the served okx/* routes; hide panels whose routes are not served

- Status: done (awaiting review).
- Files:
  - `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/api/VortexPycoreContract.ts`: adds the `VortexPycoreHttpRoute` type, `VORTEX_PYCORE_SERVED_HTTP_ROUTES` (it mirrors the okx/* names in `pycore/callmodule/rpc_routes/route_names.py` and is empty today), `VORTEX_PYCORE_PANEL_ROUTES` (the routes each OKX panel calls: account 1, quant 5, backtest 11) and `isVortexPycorePanelServed(panel)`.
  - `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/api/index.ts`: one export line.
  - `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/VortexApp.tsx`: module constants at the top compute the three panel flags. OkxAccountPanel (ledger tab) and OkxQuantPanel (settings tab) mount only when served. The `okx-backtest` tab is left out of the tab bar and the visible tabs, and `/vortex/okx-backtest` redirects to `/vortex/market` while it is hidden. The simulated market/compare/ledger/settings UI is unchanged. No new user text, so no i18n keys changed.
- Current state (found this session):
  - No okx/* route is served. `route_names.py` has 0 okx entries, and a scan of every `*.py` under `pycore/` and `pyapps/` finds no `okx/...` literal and no `okx_market_*` event topic.
  - `git log --all -S "okx/account_overview"` finds only UI commits (45af71faa, df4568b63, cc4e76065, 7e6f629b3). At cc4e76065 the string exists only in the UI's `VortexPycoreProtocol.ts`, so no okx/* server was ever committed.
  - `pyapps/okx_price_monitor` serves `monitor/*` and `trading/*`, with different names and shapes, on its own server. It is not the okx/* surface.
  - Result: all three OKX panels are hidden, and Vortex opens no pycore connection until pycore serves the routes.
- Decisions (recommended option taken):
  - The served list is static in the binding contract, with no runtime probe. It is deterministic and checkable against `route_names.py` with a diff. The UI has no shared helper for pycore's `routes` listing, and adding one would be a shared-layer (B2) change.
  - The route names and response interfaces are kept as the UI's expected contract. No okx/* route is served, so there is no served shape to align with yet.
  - A panel is shown only when every route it calls is served (`every`), so a partly restored panel never makes a dead call.
- Verification:
  - Free RAM before the type-check: about 6.5 GB (above the 3 GB guard).
  - `bun run lint` fails before type-checking with `bun: command not found: tsc`. The cause is environmental: `node_modules/.bin/tsc` is a POSIX symlink, and Windows bun does not resolve it. The script's own command, `node node_modules/typescript/bin/tsc --noEmit` (TypeScript 5.8.3), runs on the whole UI project and exits 0 with no output.
  - Scratch diff (`<scratchpad>/vortex_route_diff.py`):
    - 15 declared routes; `route_names.py` okx entries `[]`; okx literals in pycore/ and pyapps/ `[]`.
    - 15 unserved routes. The contract's served list `[]` matches route_names.py.
    - No declared route is left without a panel.
    - Panels `account` 1/1, `quant` 5/5 and `backtest` 11/11 unserved, so all three are hidden.
    - Unserved routes without a hidden panel: `[]`.
- Deferrals:
  - Shape alignment waits for pycore to serve the routes. Then ui-vortex adds the served names to `VORTEX_PYCORE_SERVED_HTTP_ROUTES` and checks each panel's response interfaces against the served payloads; the panels reappear with no other change.
- Cross-scope notes:
  - pycore (pycore-assist CKA-10, pycore-runtime CKA-10-routes): see "Current state" above. If the okx/* surface is restored, register the names in `route_names.py` and tell ui-vortex which ones are live.
  - orchestrator (`config/pycore_relay_contract.json`): restored okx/* routes need `route_policies` entries for the relay path. Today only `okx/status` matches (the `/status` suffix rule, general_read).
  - UI build owner (root config, not ui-vortex scope): `bun run lint` cannot find `tsc` on this Windows checkout because the `.bin` shims are POSIX symlinks, probably from a WSL/Linux install. No change was made or requested here; this is recorded for whoever runs the lint on Windows.
- Services: none started, stopped or restarted; no restart is needed. The change takes effect on the next UI build or dev-server reload.

Changed files:
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/api/VortexPycoreContract.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/api/index.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/VortexApp.tsx`

Blockers: none. Next owner: reviewer (ui-vortex-D7); then pycore, if it restores okx/*.
