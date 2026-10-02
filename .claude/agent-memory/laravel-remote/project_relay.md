---
name: relay
description: The single pycore relay (pyservice mode 2) on Laravel: where it lives, server-side facts and gotchas
metadata:
  type: project
---

One relay, no version or lane. Design: `docs_fix/DESIGN_RELAY.md`; contract: `config/pycore_relay_contract.json` (the only one; digest change = lockstep deploy of pycore, Laravel, UI).

**Why:** every UI call is a hub-native frame (UI → `POST /api/relay/frames` → Mercure request topic → device → device publishes the response straight to the hub). Laravel is control plane only, with no PostgreSQL on the frame path.

**How to apply:**
- Code: `app/Apps/Relay/RelayServices/*` (`RelayFrameService` admission and heartbeat, `RelayStore` = Redis db 3 connection `relay`), `RelayOwnerCtl`/`RelayDeviceCtl`, `routes/RelayRouter/RelayApi.php`, `app/Services/Relay/RelayHub*`; ledger table `global_relay_ledger` via `sys:init`.
- Session fencing: the heartbeat requires `session_id`; `RelayStore::sessionTouch` epochs; an older session gets 409 `relay_session_superseded`.
- `RelayOwnerResolver` returns `RelayFleetScope::publicOwner()`; per-user owner auth (`AuthHelper::requireAuth`) is being restored.
- Gotchas: any `RelayApi.php` edit hits the per-minute scheduler at once, so run `php artisan route:list --path=relay` right after editing; phpredis `set()` takes `'EX', ttl, 'NX'`, not an options array; contract edits need a worker reload (`RelayContract::load()` reloads on file signature).

Related: [[host-cpu-freeze-root-causes]]
