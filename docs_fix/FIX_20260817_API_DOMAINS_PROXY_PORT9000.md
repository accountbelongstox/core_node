# FIX 20260817 — api.* domains must reverse-proxy to 127.0.0.1:9000 on plain HTTP

Requirement (from 132_laravel_main_[start.sh](http://start.sh) domain scope): every `api.*` domain

(e.g. `api.si.12gm.com`, `api.si.gm15.com`) must be a reverse proxy to the

Laravel backend at `http://127.0.0.1:9000`, and plain HTTP access must actually

reach it — `http://api.si.12gm.com/` has to return the backend response, not a

redirect, not the bootstrap stub.

This document is a scan + precise fix list only. No fix has been applied.

Related runtime blocker (stale master / UDP-443 conflict) is tracked in

`FIX_20260817_NGINX_PROXY_STALE_MASTER_UDP443.md`.

## Scan results (verified on this server)

What is already correct:

- The 443 server blocks on disk proxy to 9000: all four site files have

  `upstream <host>_backend { server 127.0.0.1:9000; }` and

  `proxy_pass http://<host>_backend;` (e.g.

  `/www/nginxconfig/sites-available/api.si.12gm.com:2-3,38,53`).

- The shell install chain already targets 9000:

  `132_laravel_main_start.sh:52` `PORT=9000`) -> `:745`

  `domain_setup_install_all "http://127.0.0.1:$PORT"`) ->

  `domain_setup_common.sh:291/328/338/346` (backend default

  `http://127.0.0.1:9000`). No code anywhere proxies TO port 80.

What violates the requirement:

- On port 80, every proxy vhost (api.* included) is a bare

  `return 301 https://...` — plain HTTP never reaches 9000. With 443 blocked

  by the cloud security group (and the stale master not listening on 443 at

  all, see the related doc), `http://api.si.12gm.com/` is a dead end.

## Fix list (precise, per file)

### 1. Shell renderer: port-80 block of proxy vhosts is 301-only

- `scripts/shells/linux/common/nginx_common.sh:830-835`

  `nginx_render_proxy_vhost`): the `:80` server block unconditionally returns

  301 to https for every proxy vhost.

- Fix: for `api.*` vhosts the `:80` server block must proxy directly to the

  upstream (same `location /` + `location /ws` proxy body as the 443 block),

  keeping the ACME `/.well-known/acme-challenge/` location on :80 for renewals.

  Apex domains keep the 301. Suggested shape: a new

  `nginx_render_api_proxy_vhost` (or a 4th `http_mode=proxy` parameter) so the

  api/apex difference is explicit.

### 2. Shell callers must route api.* to the new renderer

- `scripts/shells/linux/common/domain_setup_common.sh:326-330`

  `domain_setup_ensure_api_site`) — must request http-mode=proxy.

- `scripts/shells/linux/common/domain_setup_common.sh:333-340`

  `domain_setup_ensure_apex_site`) — unchanged (apex keeps 301).

- Other callers of the same renderer that need the same api/apex branch:

  `scripts/shells/linux/common/nginx_manager.sh:723` and

  `scripts/shells/linux/debian/server_manager/nginx_manager.sh:427`.

  Prefer one shared `is_api_fqdn` helper over three copies of a prefix check.

### 3. Laravel end of the template (sync contract)

- `poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1NginxConfigBuilder.php`

  — the builder's own header (lines 13-24) declares a SYNC CONTRACT with the

  shell end; the same change must land here:

  - `buildProxy()` :161-168 — with certs present it emits

    `renderHttpRedirectServer()` for :80; for `api.*` it must emit a

    direct-proxy :80 block instead.

  - `renderHttpRedirectServer()` :62-77 — the 301 source.

  - `build()` dispatcher :265-269 `case 'proxy'`) — needs an api-aware branch

    or a `http_mode` config flag passed by callers.

### 4. Legacy duplicate generator with a wrong default port

- `poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1DomainManager.php:886`

  — `$proxyPort = $config['proxy_port'] ?? 8000;` (wrong: 8000, not 9000) in a

  second, divergent config generator (its :80 block proxies directly, unlike

  the Builder). Callers: `:134`, `:295`, `:1243`, `:1811`.

- Per repo rules (remove duplicate implementations, centralize), route these

  callers through `ServerManagerV1NginxConfigBuilder`; until then any UI/API

  save of an api site can render a vhost pointing at dead port 8000.

### 5. Runtime prerequisite (cross-reference)

- None of the above takes effect until the running master is healed: see

  `FIX_20260817_NGINX_PROXY_STALE_MASTER_UDP443.md` (hysteria owns UDP/443,

  every reload aborts, master serves the 01:27 stub world).

- Note: once api.* proxies on :80, `http://api.si.12gm.com/` works through the

  security group's open port 80 even while 443 stays blocked — this matches the

  "direct URL access" expectation.

## Verification (after fixes + nginx restart)

```

curl -i [http://api.si.12gm.com/](http://api.si.12gm.com/)        # expect the Laravel backend response (via 127.0.0.1:9000), NOT 301, NOT "ok"

curl -i [http://api.si.gm15.com/](http://api.si.gm15.com/)        # same

curl -i [http://12gm.com/](http://12gm.com/)               # apex: still 301 -> https (unchanged)