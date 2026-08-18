# FIX 20260817 — Nexus Dash domain binding: site unreachable after HTTP/3 binding, nginx -t fails on `server :;`

Symptom: after binding `gm15.com` / `12gm.com` (+ `www.*`, `www.si.*`) to the

Nexus Dash frontend (vite dev server, `127.0.0.1:13054`), `https://12gm.com`

would not open for a long time while `http://<ip>:13054` answered instantly.

The 18:37 install run ended with

`nginx: [emerg] invalid port in upstream ":" in /www/nginxconfig/sites-enabled/12gm.com:3`.

Related docs (same day, same server):

- `FIX_20260817_NGINX_PROXY_STALE_MASTER_UDP443.md` — stale master + hysteria

  UDP/443 conflict earlier that day (resolved by the 17:27 restart).

- `FIX_20260817_API_DOMAINS_PROXY_PORT9000.md` — api.* proxy target contract.

This document is a diagnosis + precise fix list. Root cause 1 is already fixed

on disk; the rendered site files are still broken and must be re-rendered.

## Verified facts (measured on this server)

- HTTP/3 itself works: `/var/log/nginx/12gm.com_access.log` contains 165

  successful `HTTP/3.0` requests (first at 18:17:24, status 200). UDP/443

  reaches nginx through the cloud security group.

- The running nginx master (pid 24139, started 17:27:11) serves the last

  known-good config; `nginx -t` fails on disk config rendered at 18:37:25-26,

  so no reload has applied since.

- All six site files under `/www/nginxconfig/sites-available/` currently

  contain `upstream <name>_backend { server :; }` — empty host and port.

- The user's first requests from 116.68.18.152 at 18:01:26 got

  `403` (124 bytes = vite's "Blocked request. This host is not allowed"

  page). First 200 at 18:17:24, right after the 18:17:06 service restart.

- `journalctl -u ncore-nexus-dash`: vite started with

  `--port 13054 --host 0.0.0.0` at 17:19 / 18:01 / 18:17, but with

  `--port  --strictPort --host`  (empty) at 18:37:47 and fell back to

  default port 5173 `Network: http://0:5173/`); nginx kept proxying to

  13054 -> the 502 `connect() refused` storm in `12gm.com_error.log` at

  18:38. At 18:44:14 vite bound 13054 again.

- `/var/_core_node/global_var/UI_ALLOWED_HOSTS` (mtime 18:16) now lists all

  six hostnames; vite reads it only at startup.

## Root cause chain

### 1. SM problem: one missing `..` emptied the whole service contract

File: `scripts/shells/linux/common/service_contract_common.sh:27`

```bash

# broken version (present during the 18:37 run):

SERVICE_CONTRACT_FILE="$(cd "$SERVICE_CONTRACT_COMMON_DIR/../../.." && pwd)/config/service_contract.json"

```

`common/` is four levels below the repo root

`scripts/shells/linux/common/`); three `..` land in `scripts/`, so the

adapter read the nonexistent `scripts/config/service_contract.json`. Both

extractors (node, then php) fail with stderr silenced, so every `sc_get`

returned an empty string with no error. Reproduced live before the fix:

```

FILE=/www/programing/core_node/scripts/config/service_contract.json

loopback=[]  ui_port=[]

```

One bad line emptied every contract read:

- `scripts/shells/linux/common/domain_setup_common.sh:51-52` —

  `domain_api_backend_url()` / `domain_ui_backend_url()` returned `http://:`

  -> all six vhosts rendered `server :;` -> `nginx -t` fails

  `invalid port in upstream ":"`), reload aborts, nginx keeps the old

  in-memory config.

- `domain_setup_common.sh:40,46` — `DOMAIN_SETUP_GLOBAL_VAR_DIR` /

  `DOMAIN_UI_ALLOWED_HOSTS_FILE` collapsed (install log: `[OK] // written`,

  `UI allowed hosts file: //`).

- `poly_apps/pycore_laravel_wordnew_ui/scripts/start.sh:70-71` —

  `DEV_PORT` / `BIND_HOST` empty -> vite on default 5173 -> 502 storm

  (facts above).

Timing: runs at 17:19/18:01/18:17 got correct values, the 18:37 run got

empty values, and the file was corrected at 18:42:42 (current line:

`"$SERVICE_CONTRACT_COMMON_DIR/../../../.."`). The file is untracked in

git, so who introduced the regression is not recorded.

### 2. Domain blocked by vite `allowedHosts` until a manual restart

- `poly_apps/pycore_laravel_wordnew_ui/vite.config.ts:84,87` —

  `allowedHosts: readExternalAllowedHosts()` is evaluated once at vite

  startup from `/var/_core_node/global_var/UI_ALLOWED_HOSTS`.

- `scripts/shells/linux/common/domain_setup_common.sh:403-404` — the binding

  writes that file but never restarts/reloads `ncore-nexus-dash`.

Sequence: vite started 18:01:03, the allowed-hosts file was written at

18:16, and nothing restarted vite in between -> every request with

`Host: 12gm.com` got 403 (the 18:01:26 log entries) until the 18:17:06

restart. Per the official Vite docs

([server.allowedHosts]([https://vite.dev/config/server-options](https://vite.dev/config/server-options))): the default

allows [localhost](http://localhost) and **all IP addresses**; the dev server speaks plain HTTP

behind nginx, so the Host check applies. Domain blocked, direct

`http://<ip>:13054` allowed — exactly the reported asymmetry. This, not

HTTP/3, is what made the site "not open".

### 3. QUIC template caveats (jank only, not the outage)

Template: `scripts/shells/linux/common/nginx_common.sh:622-634` renders

`listen 443 quic;` (no `reuseport`), `quic_retry on;`, no `quic_host_key`,

with `worker_processes auto` (3 workers here). Per the official

[ngx_http_v3_module]([https://nginx.org/en/docs/http/ngx_http_v3_module.html](https://nginx.org/en/docs/http/ngx_http_v3_module.html))

docs: the official example uses `listen ... quic reuseport;` (without

`reuseportquic_bpf`, packets of one connection can be delivered to

different workers and stall it), and a missing `quic_host_key` means a

random key per reload — "tokens generated with old keys are not accepted",

so every reload forces fresh handshakes under `quic_retry on`. The access

log shows the same client alternating `HTTP/3.0` and `HTTP/2.0`

(18:17-18:18), consistent with this flapping. Contributing sluggishness,

not a blocker.

## Fix list (precise, per file)

1. **Done** — `service_contract_common.sh:27` now uses `../../../..`;

   verified `sc_get ports.nexus_dash_frontend` -> `13054`.

2. **Open** — re-run the domain binding to re-render the six site files;

   they still carry `server :;` and the next nginx reload will fail until

   they are rewritten. Verify afterwards: `nginx -t` and

   `grep -A2 '^upstream' /www/nginxconfig/sites-available/*` (expect

   `127.0.0.1:9000` / `127.0.0.1:13054`).

3. **Open** — `domain_setup_common.sh:403-404`: after writing

   `UI_ALLOWED_HOSTS`, restart (or trigger a config-touch reload of) the

   `ncore-nexus-dash` service so vite picks up new hostnames without manual

   intervention.

4. **Open** — fail loud on empty contract: `sc_get` consumers in

   `domain_setup_common.sh` `domain_*_backend_url`) and `start.sh:70-71`

   should abort with `[FAIL]` when the resolved host/port is empty instead

   of rendering `server :;` or launching vite on a default port.

5. **Open** — `nginx_common.sh:622-634`: add `reuseport` to the quic

   listeners (or `quic_bpf on;` at http level on Linux 5.7+) and a fixed

   `quic_host_key` file to stop per-reload token invalidation.

6. **Note** — laravel_main API `127.0.0.1:9000`, target of `api.si.`*) was

   down during part of the incident window; SPA calls to `api.si.*` then

   hang up to `proxy_read_timeout 60s`, which also reads as "stuck" after

   the page shell loads. Backend is listening again now.