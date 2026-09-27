---
name: okx-routes-not-served
description: pycore never served the Vortex okx/* routes; pyapps/okx_price_monitor serves monitor/* and trading/* instead; the panels are gated by the served list in the contract
metadata:
  type: project
---

The okx/* HTTP routes and okx_market_* topics that the Vortex OKX panels call have never been committed to pycore/ or pyapps/. `git log -S` finds them only in UI files. `pyapps/okx_price_monitor` is a different surface: it serves `monitor/*` and `trading/*` on its own server, with different shapes. Do not treat it as the okx/* server.

**Why:** found during CKA-10-ui (2026-09-27). The UI now hides each OKX panel until every route it calls is listed in `VORTEX_PYCORE_SERVED_HTTP_ROUTES` (in `apps/vortex/api/VortexPycoreContract.ts`).

**How to apply:** when pycore registers okx/* names in `pycore/callmodule/rpc_routes/route_names.py`, add them to the served list and check the panel response interfaces against the real payloads. Relay access also needs `route_policies` entries in `config/pycore_relay_contract.json`, which only the orchestrator can change.
