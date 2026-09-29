# FIX 20260817 — Nexus Dash domain binding: site unreachable after HTTP/3 binding, nginx -t fails on `server :;`

Condensed 2026-09-29 (claude-opus-5-5): completed and verified sections removed; root causes, evidence summary and the open item kept.

Symptom: after binding `gm15.com` / `12gm.com` to the Nexus Dash frontend (vite, `127.0.0.1:13054`), `https://12gm.com` would not open while `http://<ip>:13054` answered; the 18:37 install ended with `nginx: [emerg] invalid port in upstream ":"`.

Related: `FIX_20260817_NGINX_PROXY_STALE_MASTER_UDP443.md`, `FIX_20260817_API_DOMAINS_PROXY_PORT9000.md`, `FIX_20260929_2052_GPU_BLACKSCREEN_TAILNET_HTTPS_PERMISSIONS.md` (§5.1).

## Root causes (evidence summary)

1. `service_contract_common.sh` resolved the contract with one `..` too few; every `sc_get` returned empty silently → vhosts rendered `server :;`, vite started on default 5173 (502 storm).
2. Vite `server.allowedHosts` is read once at startup; the binding wrote the hosts file but did not restart the UI service → `Host: 12gm.com` got 403 "Blocked request" until a manual restart (official Vite docs: default allows localhost and all IPs only). HTTP/3 itself worked (165 successful `HTTP/3.0` requests).

## Resolved (verified 2026-09-29 against current code)

- Contract path fixed; consumers use `sc_require` (fails loud on empty) and `pycore_laravel_wordnew_ui/scripts/start.sh` refuses to start vite on an unreadable contract.
- `domain_setup_common.sh::domain_setup_restart_ui_service` restarts the UI after the web access config changes.
- The nginx site re-render item is moot: the host runs the FrankenPHP plane (`PHP_RUNTIME_PLANE=frankenphp`).
- 2026-09-29: `allowedHosts` / CORS also carry this machine's identity (hostname, MagicDNS name, Tailscale IPv4) via `web_access_common.sh::web_access_local_hosts` (Windows `Get-FrankenPhpLocalAccessHosts`).

## Open

- nginx plane only: `nginx_common.sh` QUIC listeners still lack `reuseport` (or `quic_bpf on;`) and a fixed `quic_host_key`, so every reload invalidates QUIC tokens under `quic_retry on` (official ngx_http_v3_module docs). Jank, not an outage.
