# FIX 2026-09-29 20:52 — Desktop black screen, GPU policy, service-data permissions, tailnet HTTPS binding

Host: `debian-cpu` (Debian 13, kernel 6.12, Intel Alder Lake-P iGPU only, i915; Windows dual-boot).
Status: implemented and verified on this host unless a line says otherwise. Windows changes are parse-checked only (no Windows host was available).

## Task scope (user, 2026-09-29)

1. Find where pyservice and its scripts force the GPU (local models or anything else) and cause a black screen / freeze; fix the scripts; follow the official docs on sharing the GPU that drives the display; run the scripts; fix any other bug found.
2. Refactor every problem found at its root (not only on this host).
3. Port 13054 must be reachable through Tailscale, detected automatically per machine.
4. Every machine with Tailscale connected gets, idempotently and additively to the public domains (`api.si.12gm.com` …): `https://<machine>.<tailnet>.ts.net` → UI (13054) and HTTPS for Laravel main (9000). Final shape: Laravel main at `https://<machine>.<tailnet>.ts.net/laravel-api` through FrankenPHP (no new port). Linux and Windows.
5. Idempotency rule: per-user certificates/trust go to every real user and root, never to service accounts (git, postgres, …).

## 1. Black screen root cause (not the GPU)

Evidence (journal, boot 0, monotonic 2961 s ≈ 01:46:39):
- No i915 GPU hang, no OOM, no hung task. i915 params are defaults (`enable_hangcheck=Y`, heartbeat 2500 ms, rcs0 preempt 7500 ms); no repo script touches i915/xe/GRUB.
- 01:46:34 `9_fix_dns.sh` public-IP probe logged "Stopping all port-80 listeners"; 5 s later `systemd[1]: Stopping user@1000.service` killed the whole GNOME session.
- Cause: `public_ip_probe_unit_for_pid` took the FIRST `*.service` in `/proc/PID/cgroup`. A desktop process has `/user.slice/user-1000.slice/user@1000.service/app.slice/…`, so it resolved to `user@1000.service` and ran `systemctl stop` on it. `port_guard_common.sh` had the same lookup and also `disable`d the unit.

Fix:
- `scripts/shells/linux/common/port_guard_common.sh`: new shared `pg_system_unit_for_pid` — only the cgroup leaf, only under `/system.slice/`; user-session processes resolve to empty (never a unit stop).
- `pg_holder_identify` and `9_fix_dns.sh` (now sources `port_guard_common.sh`) use it; the duplicate `public_ip_probe_unit_for_pid` was removed.
- Verified: gnome-shell → empty; sshd → `ssh.service`; postgres → `postgresql@15-main.service`.

## 2. GPU policy (official guidance)

- Intel/i915 docs: compute longer than ~4 s is preempted and reset by heartbeat/hangcheck so the display keeps working; `i915.enable_hangcheck=0` is only for headless compute cards. This host keeps the defaults; nothing to change.
- Model paths (ollama, TTS, STT, OCR) only detect NVIDIA/CUDA, so on this Intel-only host they run on CPU.
- The one path that forced the display iGPU: `pycore/pyutils/native_ui/step5_main_ui/pyside6/webengine_config.py` (Linux). Now aligned with `resolve_browser_gpu_flags` (`app_resource_limit.sh`): `--enable-zero-copy` / `--enable-native-gpu-memory-buffers` are opt-in via `PYCORE_WEBENGINE_ZEROCOPY=1`; hidden/occluded windows may stop painting (only timer throttling stays disabled).

Detector bugs fixed:
- `pycore/pyfoundations/pybasecommon/compute_caps.py`: env vars alone (`CUDA_HOME`, `CUDA_VISIBLE_DEVICES=-1`, …) no longer report CUDA; new `_cuda_hidden_by_env` (`CUDA_VISIBLE_DEVICES=-1` → no GPU, same rule as `lib_gpu.sh`). File keeps CRLF endings.
- `scripts/shells/linux/common/base_libs/lib_gpu.sh`: `gpu_hardware_present` honors `CUDA_VISIBLE_DEVICES=-1`; lspci check requires "nvidia" on a VGA/3D/Display line. `lib_gpu.ps1` header comment corrected.
- `pycore/pyutils/tts/tts_service_manager.py`: `_gpu_device_or_fallback` returns `""` (engine auto) when VRAM is unreadable (was `"cuda"`, which pinned ChatTTS/Qwen to CUDA on GPU-less hosts); the 1.7B tier pins CUDA only when `gpu_present()`; dead `device_suffix` code removed.

## 3. Service data opened to 777 by the pyservice full-tree repair (security)

- `pyservice_www_permissions.sh` runs `repair_owned_tree_777` over `/www` as root. It turned `/www/wwwroot/postgresql/data` into `debian:debian 777` (PostgreSQL refuses to start on the next restart; reloads already failed with "Config owner … and data owner … do not match") and `acme.sh/home/.acme.sh` (TLS keys, DNSPod credentials) world-readable.
- `scripts/shells/linux/common/fs_perm_helpers.sh`:
  - `repair_owned_tree_777` prunes directories owned by service accounts (1 ≤ uid < `FS_PERM_REGULAR_UID_MIN`, or `FS_PERM_NOBODY_UID`) and never takes over their files; root remnants are still repaired. Constants shared with `active_permission_user_is_regular`.
  - `.acme.sh` added to `FS_PERM_PRIVATE_TREE_NAMES` (owner-only 0700).
- `75_install_postgresql.sh`: adopting an existing data dir now enforces `repair_private_tree … postgres postgres` (0700), not only ownership.
- Host repaired: data and log dirs `postgres 700`, `.acme.sh` 0700; `systemctl reload postgresql@15-main` OK; `acme.sh --list` OK; HTTPS 200.

## 4. Other bugs fixed

| Area | Root cause | Fix |
|---|---|---|
| `ncore-mcp-chrome` crash loop (611+ restarts) | `set_global_var` always wrote via `sudo tee`; the service user has no TTY | `global_var_store.sh`: direct write when writable, sudo only as fallback; root-owned `build_output` returned to `debian` |
| `ncore-laravel-frankenphp` crash loop | unit pinned `PHP_BIN=/usr/local/bin/php-cli`; the shim was later retired | `175_laravel_main_start.sh`: `PHP_BIN` no longer pinned (launcher resolves `php` from PATH each start); old pinned units are re-registered |
| ACME timer | `RandomizedOffsetSec` needs systemd ≥ 258 (host 257) | `systemd_scheduler.sh::create_systemd_timer` gains `FixedRandomDelay`; `frankenphp_acme_sh_install.sh` reuses it (`RandomizedDelaySec=6h` + `FixedRandomDelay=true`); applied, `systemd-analyze verify` clean |
| RTC in local time (dual-boot) | Windows default | Windows `Step2_SetBaseSettings.ps1::Set-RtcUniversalTime` sets `RealTimeIsUniversal=1` and shared var `WINDOWS_RTC_UTC=1`; Linux `desktop_system_policy.sh::ensure_rtc_utc` switches to UTC only after that var (else warns). Not switched on this host yet |

Not fixed (outside the repo): fwupd-triggered i915 TypeC `drm_WARN_ON` (kernel), `dragonfly.service` legacy PIDFile path (package unit).

## 5. Tailnet access (13054 and Laravel main)

### 5.1 Why 13054 answered 403 on Tailscale names
Vite `server.allowedHosts` came only from static contract hosts. `web_access_common.sh::web_access_local_hosts` now adds this machine's identity (hostname, MagicDNS full + short name, Tailscale IPv4) to `allowedHosts` and CORS origins; Windows twin `Get-FrankenPhpLocalAccessHosts`. MagicDNS lookup centralized in `tailscale_common.sh::ts_self_dnsname` (was duplicated 3×).

### 5.2 Official constraints
- `tailscale cert` issues only `<machine>.<tailnet>.ts.net`; subdomains fail with "invalid domain" (tailscale/tailscale#7081, still open).
- MagicDNS subdomain resolution needs the tailnet policy node attribute `dns-subdomain-resolve` (admin console; not scriptable here).
- Caddy `handle_path` strips the prefix; `reverse_proxy header_up X-Forwarded-Prefix` passes it on; Caddy warns about the "subfolder problem".

### 5.3 Final topology (all driven by tailscale detection; rendered only when `tailscale status` succeeds; additive on public servers)

| URL | Upstream | TLS |
|---|---|---|
| `https://<machine>.<tailnet>.ts.net/` | UI 13054 | tailscale cert |
| `https://<machine>.<tailnet>.ts.net/laravel-api/…` | Laravel 9000 (prefix stripped, `X-Forwarded-Prefix`) | tailscale cert |
| requests whose `Referer` is under `/laravel-api` | Laravel 9000 (unstripped) | tailscale cert |
| `https://api.<machine>.<tailnet>.ts.net` (fallback) | Laravel 9000 | mkcert local CA; needs `dns-subdomain-resolve` |
| `https://127.0.0.1` | Laravel 9000 | mkcert local CA |

Contract (`config/service_contract.json`): `access.tailnet = { dns_suffix: "ts.net", api_label: "api", api_path: "/laravel-api" }`; Dev-GPUOne entry → `https://debian-gpu.thresher-python.ts.net/laravel-api`. The interim `ports.tailnet_api_https` (9443) was removed.

Files:
- Linux: `domain_setup_common.sh` (`domain_setup_tailnet_certificates`, `domain_setup_lan_cert_tailnet_api`, `domain_setup_mkcert_trust_all_users`), `frankenphp_domain_common.sh` (UI/api sites, `fm_domain_tailnet_site_ensure` in server mode, stale-route cleanup keeps `local_lan.caddy`), `frankenphp_runtime_common.sh::fm_caddy_path_mount_render`.
- Windows: `FrankenPhpManager.ps1` (`Get-FrankenPhpPathMountHandlers`, `Test-FrankenPhpTailnetConnected`, api cert, `Ensure-FrankenPhpMkcertMachineTrust`), `Step175_LaravelMainStart.ps1` (LAN host OR tailnet member).
- Laravel: `bootstrap/app.php` trusts `HEADER_X_FORWARDED_PREFIX` from the loopback proxy only.
- UI: `BackendApiEndpoint.basePath`; `endpointBaseUrl` used by `buildApiUrl`, `endpointKey` and every endpoint display; `.ts.net` current origin → same host + `/laravel-api`; `WfNewAdminApi.adminBase` honors it; `DataSyncModel.syncTarget` maps path endpoints to `http://<host>:9000` (backend peer rule is path-free; tailnet is WireGuard-encrypted).

Verification (this host, via the tailnet name): UI 200; `/laravel-api/api/health` 200; `/laravel-api` 308 → `/`; debug page, its CSS and `/csrf-token` (Referer) 200 from Laravel; UI `web_access_config.json` still from Vite; CORS preflight 204 with the UI origin; Vite HMR websocket 101; Mercure hub reachable (401 without token); `api.si.12gm.com` 200. TypeScript `tsc --noEmit` clean; PHP lint clean; PowerShell parser 0 errors.

## 6. Idempotency rule added (user, 2026-09-29)

`development-guides/LINUX_SHELL_RULES.md` §3: per-user state goes to every real user and root via `list_real_users_and_root` (`fs_perm_helpers.sh`); service accounts are excluded; each user's files are written as that user and skipped when present; Windows uses `LocalMachine`. Applied: mkcert root CA in `/home/debian/.pki/nssdb` and the Firefox ESR profile; second run imports nothing.

## 7. Open items

- Tailnet admin: add `dns-subdomain-resolve` only if the `api.<machine>` fallback is wanted (not needed for `/laravel-api`).
- Other devices need the mkcert root CA only for the `api.` fallback and `https://127.0.0.1`.
- `175 --domains-only` restarts FrankenPHP on every run (~1–2 min downtime) even when routes are unchanged (pre-existing).
- `debian-gpu` (dual-boot desktop, currently in Windows) must pull this code and rerun 175 / Step175.
- RTC: run Windows Step2, then set `WINDOWS_RTC_UTC=1` on Linux (the var center is not shared on this ext4 host).

## 8. Docs maintenance (2026-09-29, claude-opus-5-5)

- `README.md`: `claude opus 5.5` (`claude-opus-5-5`) added to the authorized-deletion list (user, 2026-09-29).
- Condensed (completed + verified sections removed, open items kept): `FIX_20260817_NEXUS_DASH_HTTP3_DOMAIN_BINDING.md` (only the nginx QUIC `reuseport`/`quic_host_key` item stays open), `FIX_20260919_PYCORE_UI_MIXED_CONTENT_ENDPOINT_REFACTOR.md` (active rules kept), `bug_audit_20260927/infra-shell.md` IS-008 (resolved; row marked in `FIX_20260927_0252_TEAM_BUG_AUDIT.md`).
- Update notes only (sections not verifiable in this session were left intact): `DESIGN_20260921_GPU_CPU_UNIFIED_TOOLCHAIN.md`, `DESIGN_20260928_DD_TAILSCALE_OS_UPGRADE_AI_TOOLS.md`, `A7A7_POST175_FIELD_SCAN_AND_TRANSPORT_RESETS.md`, `REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md`, `REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md`.
