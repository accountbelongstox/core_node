---
name: project-lan-browser-pycore
description: 2026-10-03 LAN browser access to pycore: private-LAN peers are open (no key, no pairing), CORS echo + preflight in the guard; web builds never carry the client key
metadata:
  type: project
---

Decision (user, 2026-10-03): the pairing/token design was dropped. `local_rpc_guard.evaluate_request` admits a non-loopback peer inside contract `client_key_auth.local_rpc.private_lan_networks` (RFC1918, link-local, CGNAT 100.64/10, ULA) without K3 if Host is loopback/private/single-label/LAN-suffixed and any Origin is a loopback/private host; the origin is echoed (never `*`) and `LocalRpcGuardMiddleware` answers the preflight itself (204). Public peers keep K3; a private peer failing the LAN rule may still present K3. `rpcLanBind=true` set on debian; pycore listens 0.0.0.0:59000.

**Why:** the browser must never hold the shared client key (the Vite dev server used to compile it into the bundle); a LAN phone opens the UI at http://LAN-IP:13054 and the UI derives http://LAN-IP:59000 (pageHostBackendUrl).

**How to apply:** vite `compiledClientKey()` now only compiles the key for FRONTEND_BUILD_TARGET=native + CORE_NODE_COMPILE_CLIENT_KEY=1; pycoreLanAuth.ts (UI K3 signing of pycore requests) was deleted. ncore's Node guard (paused) does not implement the LAN rule. See [[project-pycore-pitfalls]].

Update 2026-10-03 (later): a LOOPBACK peer with a private-LAN browser Origin (UI at http://LAN-IP:13054 calling 127.0.0.1:59000) is now allowed and echoed too (`origin_is_private_lan_host`, loopback hostnames still need the dashboard port list). Mesh hostnames (`tailnet_domain_of` from the contract mesh templates) count as LAN hosts; the `ts.net` suffix was removed from the contract. Laravel endpoint candidates are now live-only: `laravel_api_catalog_urls(mesh_domain, mesh_machine_hosts)` lists mesh machines from `tailscale status` and `endpoint_manager._load` drops persisted routes on mesh machines the live mesh no longer lists (explicit user selection is kept). Contract entry `debian_dev_machine_1` is listed only while that machine is a live peer.
