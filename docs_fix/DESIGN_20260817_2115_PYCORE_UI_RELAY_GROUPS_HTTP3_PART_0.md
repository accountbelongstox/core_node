# DESIGN 20260817 2115 - Pycore UI Relay Groups via Laravel Central Server + HTTP/3 Everywhere - PART 0 (FrankenPHP server plane prerequisite)

Date: 2026-08-17 21:15
Document split 2026-08-17 into four parts (single file became an index):
- **PART 0** (this file) - prerequisite: FrankenPHP server plane (binding)
- **PART 1** - requirements
- **PART 2** - code + official-doc research
- **PART 3** - implementation plan

Mercure pivot (2026-08-17, supersedes every earlier "Reverb stays the v1
transport" wording in this design): the FrankenPHP **built-in Mercure hub
completely replaces Reverb** as the realtime transport. Reverb is **fully
removed** (2026-08-17 decision: code and docs) - no migration window, no
compat-plane legacy: package, config, process, proxies, contract ports and
keys are gone in the same change set.

Status: implementation of this part pending (plane constants,
`28_install_frankenphp.sh`, `common/frankenphp_manager.sh`, dual-end server
manager, `132` plane branch, menu/toolchain flows). Backend relay artifacts
already written pre-pivot are listed with their required sync renames in
PART 3 §3.7.

Reference input:
- `docs_fix/origin/b.txt` (FrankenPHP + Mercure revision)
- `scripts/shells/linux/debian/install_shells/132_laravel_main_start.sh`
- `scripts/shells/linux/debian/install_shells/26_install_nginx.sh`

## Basic norms (binding for this part)

- Build from the underlying architecture, not patches; never thin-compatibility
  layers; follow the latest specifications.
- Merge common libraries and duplicate implementations; consult the official
  documentation before introducing anything new.
- Do not use multiple agents.
- Develop strictly per the specification (this design's four parts).
- Shell scripts: never use exit codes / return-value chaining; trust the
  previous function's execution result; detect binaries directly by probing
  the file system (no stale command-hash probing).

---

## 0.1 Decision summary

- Octane stays the application runtime, but its server switches from Swoole
  to **frankenphp** (`php artisan octane:frankenphp`, official Octane server
  driver) under the default plane. The supervised runtime is a **SINGLE
  `octane:frankenphp` process** - the Caddy inside it terminates 80/443,
  serves the Laravel app, and hosts the built-in **Mercure hub** at
  `/.well-known/mercure`. No realtime sidecar process exists on this plane.
- One shared entry port: 80/443 with TLS, HTTP/1.1 + h2 + h3 on 443, ACME
  certs via DNS-01 (dnspod). No nginx in this plane; certbot is not used.
  There is **no `/app/*` reverse-proxy rule** - no WebSocket upstream exists.
- The nginx + certbot + Octane/Swoole stack remains available as the
  **compat plane** (non-default), selected by one shared constant. No thin
  compatibility layers: each plane renders its own canonical config from the
  SAME contract data (domains, ports, upstreams, hub material).

## 0.2 Official-doc findings (frankenphp.dev, laravel.com/docs/octane, mercure.rocks/spec)

- **Install**: official install script `curl https://frankenphp.dev/install.sh
  | sh`; standalone statically-linked Linux binary with embedded PHP 8.5
  (ZTS) from GitHub releases; deb/rpm packages with a `frankenphp` systemd
  unit and Caddyfile at `/etc/frankenphp/Caddyfile`.
- **Octane frankenphp driver**: `php artisan octane:install --server=frankenphp`
  then `php artisan octane:frankenphp` with `--host --port --admin-port
  --workers --max-requests --caddyfile --https --http-redirect`; `--https`
  enables "HTTPS, HTTP/2, and HTTP/3, and automatically generate and renew
  certificates" (official wording). A custom Caddyfile can be passed.
- **Mercure hub built in** (frankenphp.dev/docs/mercure): disabled by
  default; enabled via the Caddyfile block
  `mercure { publisher_jwt <key> ; subscriber_jwt <key> ; anonymous }`
  ("When publisher_jwt is set, you must set subscriber_jwt too"). Hub
  endpoint: `/.well-known/mercure`. Subscribe: native `EventSource` with
  `?topic=`. Publish: `mercure_publish()` PHP function (full signature
  `mercure_publish(string|array $topics, string $data = '', bool $private =
  false, ?string $id = null, ?string $type = null, ?int $retry = null): string`)
  or authenticated POST to the hub with a publisher JWT. Under Octane the hub
  is configured through `config/octane.php` `'mercure' => [...]` (b.txt's
  claim confirmed; its sample POST URL `http://127.0.0` is wrong - the real
  hub is the local 443 listener). Full protocol research: PART 2 §2.2.
- **Custom Caddy modules**: release binaries ship a fixed module set; adding
  `caddy-dns/dnspod` (ACME DNS-01 provider for DNSPod/Tencent) requires a
  custom build - `xcaddy build --with github.com/dunglas/frankenphp/caddy
  --with github.com/caddy-dns/dnspod ...` (Go toolchain) or the static-builder
  image with `XCADDY_ARGS`. Enablement must be idempotent and
  module-probe driven (`frankenphp list-modules`).
- **Caddy behavior**: HTTP/3 on by default for HTTPS sites; `reverse_proxy`
  upgrades WebSocket connections transparently (kept for reference - this
  design no longer proxies any WebSocket on the default plane).
- **Mercure has NO application presence semantics** (no member roster, no
  join/leave events at the application level): the relay's both-ends-online
  roster/gate stays the heartbeat registry design (PART 3
  RelayMachineRegistry). The spec's subscription API / subscription events
  (connection-level, authorized-only) are recorded as a supplement only
  (PART 2 §2.2) - they observe SSE connections, not machine health.

## 0.3 Shared constants (single source, no duplication)

- New persisted global vars (file-backed global-var store, gvar_common):
  - `WEB_SERVER_PLANE` = `frankenphp` (DEFAULT) | `nginx`
  - `PHP_RUNTIME_PLANE` = `frankenphp` (embedded static PHP 8.5, no apt PHP)
    | `system` (apt PHP 8.5 + Swoole). Derived from WEB_SERVER_PLANE unless
    explicitly overridden; one resolver function, no per-script parsing.
  - Resolver placement (layering rule): gvar_common.sh keeps ONLY the basic
    `web_server_plane()` / `set_web_server_plane()`; the PHP-runtime pair
    `php_runtime_plane()` / `set_php_runtime_plane()` lives in the PHP
    common area (`octane_service_manager.sh`, SYNC with
    ServerManagerV1OctaneServiceManager) because it is PHP-runtime
    concern, not a basic global-var primitive.
- Readers: selector menu, 26, 27, 28, 32, 33, 34, 35, 132, both server
  managers. Writers: the menu + 28 (install-time adoption). Scripts never
  parse each other's state files.
- `config/service_contract.json` gains plane-expressible ports:
  `frankenphp_http: 80`, `frankenphp_https: 443`, `frankenphp_admin: 2019`
  (loopback). `laravel_api_backend: 9000` becomes nginx-plane-only. The
  former `reverb_backend: 8080` is REMOVED (no realtime sidecar port
  exists on any plane).

## 0.4 W1 - `28_install_frankenphp.sh` (new step-granular orchestrator)

- Parallel in shape to 26: every primitive lives in a NEW shared manager
  `common/frankenphp_manager.sh` (mirrors nginx_manager.sh architecture:
  install/upgrade, layout, config, service, repair, state); the numbered
  script only wraps manager steps (conflicts check, port-80/443 ownership
  guard, binary install/upgrade, Caddyfile layout, systemd unit, service,
  state, verify).
- Idempotent install: file-probe the binary first; missing -> official
  install script / pinned GitHub release; present -> version compare,
  in-place upgrade. Re-run is a no-op when nothing changed.
- Idempotent dnspod enable: `frankenphp list-modules` probe for
  `dns.providers.dnspod`; missing -> ensure Go toolchain (existing golang
  step) + xcaddy build with `--with github.com/caddy-dns/dnspod`, cache the
  built binary + version marker; present -> no-op. DNSPod credentials reuse
  the decrypted secrets store 132 already reads (Caddy `acme_dns dnspod
  {token}` -> wildcard certs).
- **Mutual exclusion with 26/27** (implemented 2026-08-17): the companions
  live in the COMMON area - `nginx_plane_disable.sh`,
  `certbot_plane_disable.sh`, `frankenphp_plane_disable.sh` - each performs
  an IDEMPOTENT SERVICE DISABLE + state record ONLY (never uninstalls,
  never removes configs/certificates; re-running the counterpart install
  restores the plane). 28 calls the nginx + certbot companions; 26 and 27
  call the frankenphp companion; all three installs accept `--no-mutex` to
  skip the counterpart disable, and each install adopts its plane constant
  (`set_web_server_plane`). Port ownership is asserted before any service
  start (file-probe the other server's service unit / binary; never kill a
  live plane - switching planes is an explicit menu/132 action).
- Menu integration: app_install_menu + service_manager register the new
  script/service entries alongside the existing nginx ones.

## 0.5 W2 - FrankenPHP Server Manager (dual end, SYNC CONTRACT)

- PHP end (`poly_apps/laravel_main`, alongside the nginx manager):
  `ServerManagerV1FrankenPhpManagerCtl` + a `Caddyfile` builder rendering
  from the SAME contract data as the nginx builder (domains, cert material,
  upstreams, hub JWT material): site blocks for `api.<region>.<domain>`
  (+ apex + UI binding), `php_server` for the Laravel app, the
  `mercure { ... }` block (`publisher_jwt` + `subscriber_jwt` material from
  the secret store; `anonymous` NOT enabled - every subscriber presents a
  short-lived JWT, PART 3 §3.5), and `acme_dns dnspod` for DNS-01. HTTP/3
  needs no stanza (Caddy default).
- Shell end: `common/frankenphp_manager.sh` renders byte-identical semantics
  (site template shared constants), same SYNC CONTRACT header block pattern
  as nginx_manager.sh <-> ServerManagerV1NginxConfigBuilder. Change both
  ends together, always.
- The hub is configured through the custom Caddyfile (`--caddyfile`):
  Mercure JWT material stays `{$ENV}` placeholders in the file - the
  runtime branch injects the values as process env from the secret store
  (never in the file, logs or URLs). `config/octane.php`'s `'mercure'`
  block stays unused - one canonical config source, no dual path.

## 0.6 W3 - `132_laravel_main_start.sh` plane switch

- Read `WEB_SERVER_PLANE`; default `frankenphp`.
- Frankenphp branch: SKIP the nginx ensure / certbot / domain nginx-flow
  entirely (not called, not invoked conditionally - a separate branch, no
  shim). Instead: ensure 28 (or its manager directly), render the Caddyfile
  site for the region domain family via the shell manager, start the
  supervised **single `octane:frankenphp`** process (custom `--caddyfile`,
  `--https`, h3, embedded Mercure hub) through the runtime branch
  `debian_com/laravel_runtime_frankenphp.sh` (env-injects the Mercure keys
  and never starts any realtime sidecar).
- Nginx branch: `debian_com/laravel_runtime_nginx.sh` = the former
  `laravel_run_runtime.sh` (deleted - its content became this branch) with
  the Reverb process REMOVED: system PHP + Swoole Octane on
  `laravel_api_backend` only.
- Switching planes is explicit and logged; both planes never run
  simultaneously (port guard from 0.4).

## 0.7 W4 - Menu default + PHP toolchain scripts

- `selector_common.sh` MENU_CONFIG carries ONE merged, mutually-exclusive
  web-server entry in the ORIGINAL menu style (2026-08-17 revision: the
  former START_NGINX + START_FRANKENPHP toggles merged), read SHARED by
  every script (get_global_var): `[W] Web Server After Installation|
  START_WEB_SERVER|frankenphp nginx|frankenphp|frankenphp|frankenphp|
  frankenphp` - default `frankenphp` for ALL installation modes
  (base/server/full/desktop). 26 starts nginx only when the choice is
  `nginx`; 28 adopts the frankenphp plane; 132's nginx-ensure sets the
  constant to `nginx` before invoking 26.
- `32_ensure_php85_intelligent.sh`: plane-aware - frankenphp plane ensures
  the FrankenPHP binary's embedded PHP 8.5 + a `php`/`php-cli` shim from
  `frankenphp php-cli` (no apt PHP); system plane unchanged.
- `33_install_swoole.sh`: frankenphp plane SKIPS Swoole entirely (Octane
  server is frankenphp; log the skip reason); system plane unchanged.
- `34_configure_php85.sh`: plane-aware config targets - frankenphp plane
  configures the Caddyfile-adjacent PHP ini (PHP_INI_SCAN_DIR / worker env,
  aligned with ServerManagerV1PHPConfigFixer semantics); system plane
  unchanged (/etc/php/8.5).
- `35_install_composer.sh`: installs Composer against the ACTIVE plane's
  PHP CLI (resolver from 0.3; composer itself stays plane-agnostic).
- All four read the shared constants through the single resolver - no local
  plane parsing, no exit-code chaining, binary detection by file probing
  (project shell rules).

## 0.8 Impact on the relay design (PART 1-3)

- H1/H2 (HTTP/3) unchanged in substance and IMPROVED: h3 is Caddy-default on
  443 in the frankenphp plane and stays the nginx stanza in the compat
  plane; the Mercure downstream is SSE (plain HTTPS), so realtime RIDES the
  same h3 listener - the former "wss stays on TCP" exception (RFC 9220)
  disappears on the default plane because there is no WebSocket at all.
- Relay control plane (wake frames + roster announcements): **Mercure topics
  are THE transport** on the default plane - `pycore.machines` roster
  announcements and `pycore.pair.{machineId}` private wake updates,
  published server-side (`mercure_publish()` or hub POST with the publisher
  JWT). Reverb is not used anywhere in the relay.
- Roster / both-ends-online gate: the heartbeat registry (RelayMachineRegistry
  + RelayPairRegistry, PART 3) remains the server-side authority - Mercure
  has no application presence (0.2). Data plane (HTTP store/fetch) is
  plane-invariant.
- **Plane gating**: the relay feature is served on the frankenphp plane
  (default). The nginx compat plane does not serve relay endpoints.
- Execution order (PART 3 §3.8) keeps **Phase 0** (this part) before the
  backend phase; no Reverb-retirement phase exists - Reverb removal is part
  of this same change set (2026-08-17 decision).

## 0.9 Acceptance (Part 0)

- P0-A1 `28` re-run on an installed host: no-op (idempotent, state files
  intact).
- P0-A2 after enable: `frankenphp list-modules` shows `dns.providers.dnspod`;
  a wildcard DNS-01 certificate issues without certbot.
- P0-A3 with plane=frankenphp: `26` and `27` log their skip line and install
  nothing; with plane=nginx: `28` does the same.
- P0-A4 `132` frankenphp branch: `https://api.<region>.<domain>` answers
  over h3, Laravel API works, `/.well-known/mercure` streams SSE to an
  authorized subscriber, and a server-side `mercure_publish()` reaches that
  subscriber. NO Reverb process exists on this plane.
- P0-A5 switching the plane back to nginx via the menu + 132 restores the
  previous stack (sites repaired by the canonical renderers).
- P0-A6 `32-35` re-runs are plane-consistent no-ops; no apt PHP installed
  under the frankenphp plane.

---

End of PART 0. Requirements: PART_1. Research: PART_2. Implementation
plan: PART_3.
