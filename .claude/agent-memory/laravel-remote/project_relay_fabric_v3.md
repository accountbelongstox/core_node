---
name: relay-fabric-v3
description: Relay Fabric V3 (hub-native RPC lane for pyservice mode 2): why relay was slow, what shipped on Laravel, what is pending, and the gotchas
metadata:
  type: project
---

Design doc: `docs_fix/DESIGN_20260930_RELAY_FABRIC_V3_HUB_NATIVE_RPC.md`. Wire contract: `config/pycore_relay_fabric_contract.json`; it is deliberately a separate file so the V2 digest does not change.

**Why:** mode 2 relay was slow (p50 8 s, p90 16 s, p99 7 min) because every call, 94% of them polls, ran through the durable V2 queue with 6+ sequential HTTP hops. Measured: server admit 51 ms, claim 18 ms, hub delivery 2 ms, WAN RTT ~130 ms (server in Singapore). The rest sits in device/client sequencing.

**How to apply:**
- Laravel side is live: `RelayFabric*` services and controller, routes `/api/relay/fabric/*`, Redis db 3 connection `relay_fabric`, scoped device publish JWT (enforced by the hub: other topics give 401), and the ledger drain in `RelayMaintenanceService`.
- The ledger migration is NOT applied. It comes with the next 175 / `sys:init`. Until then the drain and stats are table-aware no-ops.
- pycore-lead and pycore-ui were asked to implement their sides against the doc. Check their reports and the Windows end-to-end run before enabling the UI fast lane.
- `RelayOwnerResolver` returns `RelayFleetScope::publicOwner()`, so owner routes are not per-user authenticated (pre-existing, V2 too). Mention it if security comes up.
- Gotchas hit: the device route closure needed `use ($fabricUri)`. Any `routes/RelayRouter/RelayApi.php` edit affects the per-minute scheduler processes immediately, so `php artisan route:list` right after editing. Laravel's phpredis `set()` takes `'EX', ttl, 'NX'`, not an options array.

Related: [[host-cpu-freeze-root-causes]]
