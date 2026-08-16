# DESIGN 20260816 - Nginx Multi-End Management Architecture (shells / laravel_main / UI)

## Goal

One nginx management truth across three ends, with fine-grained idempotency at
every step (install, PATH/link, upgrade, config, repair, sites, certificates):

1. **Shell end (initial provisioning)** - `dd.sh` chain and
   `132_laravel_main_start.sh` install/upgrade/repair nginx with HTTP/3 + 301 +
   TLS 1.3 early data, and install domains from decrypted DNSPod secrets.
2. **Laravel end (ongoing management)** - `poly_apps/laravel_main`
   ServerManagerV1 exposes the same capabilities over the API
   (`/api/servermanager/v1/nginx/*`, `/api/servermanager/v1/certificates/*`).
3. **UI end (operator surface)** - `pycore_laravel_wordnew_ui`
   `http://127.0.0.1:13054/laravel-manager#/server` talks only to the Laravel
   API. Every UI call maps 1:1 to a route and a controller method.

## Sync contract (two ends, one truth)

Vhost templates (HTTP/3, 301, early data, ACME location), repair semantics,
upgrade policy, and the certificate flow exist in exactly two implementations
that MUST be changed together:

- Shell: `scripts/shells/linux/common/nginx_common.sh` (renderers + repair),
  `scripts/shells/linux/common/nginx_manager.sh` (CLI primitives),
  `scripts/shells/linux/common/domain_setup_common.sh` (secrets/prefix/certs).
- Laravel: `ServerManagerV1NginxConfigBuilder.php` (renderers),
  `ServerManagerV1NginxManagerCtl.php` (lifecycle API),
  `ServerManagerV1CertificateManager.php` (certificate flow).

Each file carries a `SYNC CONTRACT` header naming its counterparts.

## Shell architecture

- `common/nginx_manager.sh` - the complete management CLI. One subcommand per
  idempotent primitive: `ensure-repo`, `install` (in-place upgrade when the
  apt candidate is newer, sites preserved), `migrate-legacy`, `purge-legacy`,
  `replace-foreign`, `source-build`, `repair`, `http3-migrate`, `verify`,
  `status --json`, `layout`, `main-config`, `default-vhost`, `default-page`,
  `symlinks`, `bin-link`/`unify-binaries`, `service start|stop`,
  `store-info`, `site-add`, `site-remove`, `site-list`, `domains-sync`,
  `cert-ensure`, `cert-renew`, `prefix-show`, `prefix-set`.
  Load-time side effect free; directory resolution order is
  `map_web_path` -> global-var store -> `/etc/nginx` defaults, so it is safe
  to source from dd.sh installers and from plain app start scripts.
- `install_shells/26_install_nginx.sh` - the dd.sh step orchestrator. Contains
  no implementation of its own: each `step_run` wraps exactly one
  `nginx_manager.sh` primitive, so a satisfied step never blocks later steps.
  Supported distros: Debian / Ubuntu / Kali (Kali maps to the Debian nginx.org
  repo). Replacement coverage: interactive legacy/distro replacement
  (`migrate-legacy`), distro variant purge (`purge-legacy`: nginx-common,
  nginx-core, nginx-full, nginx-extras, libnginx-mod-*), foreign prefix
  quarantine (`replace-foreign`: /usr/local/nginx, /opt/nginx, openresty - our
  own source build carries a `.core_node_source_build` marker and is kept),
  and path unification (`nginx_unify_binaries`: every known nginx path becomes
  a symlink to one canonical binary, re-checked after the service step).
- `install_shells/27_install_certbot.sh` - certbot tooling via **pipx
  isolation** (PEP 668 / official certbot venv route). The apt certbot ran on
  the system Python and collided with the many `--break-system-packages`
  installers (selenium needs urllib3>=2.5, apt certbot needs urllib3<2); the
  fix is isolation, not version pinning. pipx is referenced by the absolute
  path owned by 17_enable_pipx.sh (`$COMPILE_DIR/pipx_venv/bin/pipx`), every
  legacy channel (apt packages, system-pip packages, snap) is idempotently
  purged, binaries are detected by existence tests, and functions do not
  communicate via exit codes - each step self-detects its prerequisites and
  no-ops when they are unmet, so one step's state never blocks a later
  independent step. Steps: ensure pipx (17) -> preflight
  conflict scan (lists the polluting scripts and any system-pip certbot
  packages) -> purge legacy apt certbot packages -> purge system-pip certbot
  packages -> purge legacy snap certbot -> pipx install (weekly idempotent
  refresh via stamp file) ->
  per-plugin inject (certbot-nginx, certbot-dns-dnspod,
  certbot-dns-cloudflare, certbot-dns-route53) -> /usr/local/bin/certbot link
  -> ServerManager dirs -> SSL config bootstrap -> systemd renewal timer
  (automatic certificate renewal) -> store info -> verify (informational;
  version parse is strict regex, plugins listing must include dns-dnspod).
  `/etc/letsencrypt` (accounts, certificates, renewals) is preserved across
  the migration.

## Permissions policy

Every idempotent-replace write (`write_file_if_changed`, the domain-setup
fallback writer, `domain_state_set`) ends with `chmod 777` on the target,
matching the shared-variable mode-777 policy; on NTFS-mapped data disks the
chmod is a tolerated no-op.
- `install_shells/132_laravel_main_start.sh` - the single canonical
  laravel_main start: toolchain ensure -> SSH ensure (19) -> PostgreSQL ->
  sys:init -> nginx ensure (install / upgrade prompt / repair prompt /
  always-on repair sweep + `http3-migrate`) -> certbot ensure -> DNSPod domain
  install -> optional systemd service -> Octane runtime.
  Modes: `--domains-only` (old 132 scope), `--ssl-only` (old 133 scope),
  `--no-domains`, `--skip-ssh`.
- `poly_apps/laravel_main/scripts/start.sh` - delegates to
  `132_laravel_main_start.sh` (single-level reference, removes the old
  app->installer reverse reference).

## Deleted (no thin wrappers, no duplicate implementations)

- `install_shells/132_prepare_domain_setup.sh` - merged into
  `132_laravel_main_start.sh` (`--domains-only`).
- `install_shells/133_setup_domain_ssl.sh` - merged into
  `132_laravel_main_start.sh` (`--ssl-only`).
- `poly_apps/laravel_main/scripts/upgrade_laravel_13.sh` - canonical copy is
  `debian_com/laravel_upgrade_13.sh` (Windows uses `upgrade_laravel_13.ps1`).
- Local `install_file_if_changed` copies in 26/27 - merged into
  `common_functions.sh::write_file_if_changed`.
- `$HOME/.domain_setup_state` - replaced by the file-backed global-var store
  (`$GLOBAL_VAR_DIR`, keys read via `domain_state_get`), consumed by 134/135
  through `domain_setup_common.sh`.

## Domain install (DNSPod secrets)

`domain_setup_common.sh` reads `.secret_keys/.secret_ignore/{DNSPOD_EMAILS,
DNS_DNSPOD_API_TOKENS, DOMAINS_LISTS}`, asks for the API region prefix
(si/sh/sz/hk/custom) once, persists it in the global-var store
(`DOMAIN_API_REGION_PREFIX`), and on later runs only asks whether to modify
it. For every root domain it installs `api.<region>.<domain>`:

- certificate via `php artisan servermanager:certificate add <domain>
  --prefixes=<region> --provider=dnspod` (idempotent: pre-check, issue,
  post-verify); the certificate wildcards `*.<region>.<domain>` come from
  `ServerManagerV1CertificateManager::SUBDOMAIN_PREFIXES` (now
  `si, sh, sz, hk, local, api`, aligned with the shell region choices);
- nginx site via `nginx_render_proxy_vhost` (301 redirect + HTTP/3 + TLS
  early data + Early-Data replay guard) when the certificate exists, else an
  ACME-capable HTTP bootstrap; content-hash idempotent writes double as site
  repair (drifted files are rewritten to the canonical render).

## HTTP/2 -> HTTP/3 migration

`nginx_manager.sh http3-migrate` rewrites existing HTTPS site files in place,
per directive and only when absent: `listen ... http2` -> `http2 on;`, adds
`listen 443 quic` + `http3 on;` + `quic_retry on;`, `Alt-Svc` advertisement,
and `ssl_early_data on;`. Sites and certificates are preserved; the sweep runs
on every 26/132 pass and no-ops on current files.

## UI / API alignment

UI module `apps/laravel-manager/api/modules/ServerManagerV1.ts` maps 1:1 to
`routes/api.php` (`servermanager/v1`): nginx sites CRUD, enable/disable, test,
reload, repair, status, service, logs, install, backups/restore, main-config,
port-check, metrics, batch, delete-files; certificates list/generate/renew/
ensure/progress/status/install-certbot/detect-certbot. `status --json` on the
shell end mirrors `ServerManagerV1NginxManagerCtl::statusOverview` so both
ends report the same fields (version, http3, quic early data, config_ok).
