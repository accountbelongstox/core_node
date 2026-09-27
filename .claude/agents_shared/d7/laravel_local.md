# D7: local Laravel on https://127.0.0.1 (laravel coordinator)

Status (2026-09-27 17:11 +10:00): **UP** (relaunched 17:09:19 with a hidden console; health checked 24/24 over 2 min). `https://127.0.0.1` and `http://127.0.0.1:9000` serve `poly_apps/laravel_main` through FrankenPHP 1.12.7 (PHP 8.5.11 ZTS, Caddy 2.11.4) running the Octane worker (4 workers). No application code was edited.

**Blocker (user decision): TLS trust.** The certificate for `127.0.0.1` comes from a new local mkcert CA (`C:\Users\mpc\AppData\Local\mkcert\rootCA.pem`), and that CA is in **no trust store**. My attempt to add it to the Windows LocalMachine Root store was denied by the permission classifier ("Security Weaken"), so it stays for the user to decide. Results:
- Verified with the CA given explicitly: `curl --cacert <rootCA.pem> --ssl-no-revoke` and Python `requests.get(url, verify=<rootCA.pem>)` both return 200. Chain and hostname are verified; schannel needs `--ssl-no-revoke` because mkcert certificates carry no revocation endpoint.
- With default trust (the Windows store, curl's default, and pycore's `requests`/`httpx`, which use **certifi**), `https://127.0.0.1` fails with an untrusted-root error. So a D8 pycore endpoint of `https://127.0.0.1` will fail TLS until the user decides how to trust the CA. `mkcert -install` would also open a modal Windows dialog, and it does not affect certifi anyway.
- The same Laravel instance also listens on plain `http://127.0.0.1:9000`, the backend that the 443 site reverse-proxies to.

## Verification
| Check | Result |
|---|---|
| `GET https://127.0.0.1/api/health` (local CA explicit) | 200 `{"status":"healthy","version":"13.25.0",...}` |
| `GET https://127.0.0.1/api/codemart/v1/public/home` (local CA explicit) | 200 `{"success":true,...}` |
| `GET http://127.0.0.1:9000/api/health` | 200 |
| Default trust over https | fails: untrusted root (see blocker) |
| `php artisan route:list` | 1086 routes, exit 0 |
| `php artisan sys:init --no-interaction` | exit 0; 18 pending migrations applied, incl. AppQyV1 `orch_audio_tasks` / `orch_audio_segments` (D7); `migrate:status --pending` now reports none |
| Worker restart `POST http://localhost:2019/frankenphp/workers/restart` | 200, health 200 afterwards |

## Runtime facts
- Process: `frankenphp.exe` PID **28564**, whose parent is `cmd.exe` PID **10788** (`cmd.exe /c D:\www\frankenphp\d7_frankenphp_foreground.cmd`). It was created with WMI `Win32_Process.Create` (user token, session 1, `Win32_ProcessStartup.ShowWindow=0` so the console is hidden). It is not tied to any Claude session and keeps running until it is stopped or the machine reboots. There is **no service**, so it does not autostart.
- Ports: `:443` https (sites `127.0.0.1`, `localhost`, and the Debian ts.net name, each with an explicit cert), `:9000` http backend with Mercure, `:80` http redirect sites, `127.0.0.1:2019` Caddy admin.
- About 180 MB working set. Free RAM after start was about 7.0 GB.
- Logs: `D:\www\frankenphp\logs\d7_frankenphp_foreground.log` (Caddy/FrankenPHP JSON), `d7_sys_init.log`, `d7_start_foreground.log` (the failed start.ps1 attempt). The invite/access codes in them were redacted.
- Code changes by other workflows are **not** picked up automatically (no watch directive on Windows). After Laravel code changes, restart the workers:
  `curl -X POST http://localhost:2019/frankenphp/workers/restart`

## How to stop / restart
- Graceful stop: `D:\www\frankenphp\bin\frankenphp.exe stop` (Caddy admin API on localhost:2019). If that fails: `Stop-Process -Id 28564`.
- Start again (from an elevated PowerShell, detached, hidden console):
  `Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = 'cmd.exe /c "D:\www\frankenphp\d7_frankenphp_foreground.cmd"'; CurrentDirectory = 'D:\programing\core_node\poly_apps\laravel_main'; ProcessStartupInformation = (New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }) }`
- The launcher sets exactly the `start.ps1` foreground environment (`Set-FrankenPhpForegroundEnvironment`), plus `CORE_NODE_DATA_DIR=D:\www\core_node` (as `Resolve-PgDataDir` sets it) and `CADDY_SERVER_WORKER_DIRECTIVE=num 4` (the Linux `laravel_runtime_frankenphp.sh` default `WORKERS=4`; the empty Windows default would start 32 workers on 16 cores).

## Every action taken (in order)
1. Read-only checks. `ncore-laravel-main` is the **retired** NSSM service: its body only disables and stops itself (`start.ps1:179-191,266-269`), so it was not started and its start type (Disabled) was not changed. `ncore-laravel-frankenphp` is not registered. FrankenPHP was not provisioned on Windows. `storage/frankenphp/Caddyfile` and `routes/*.caddy` were Debian-generated (`/mnt/dev_nvme0n1p1/...`). The existing `127.0.0.1+2.pem` was issued by the Debian mkcert CA, which is not available on Windows. WSL Debian runs no Laravel.
2. Backup: `D:\www\core_node\backups\d7_laravel_local_20260927\` contains the Debian Caddyfile and routes, `certs/local/*` (Debian 127.0.0.1 cert and key, ts.net cert and key), `web_access_config.json`, and `core_node_main_pre_sysinit.dump` (`pg_dump -Fc core_node_main`, exit 0, taken before sys:init). It contains secrets; do not copy it into the repo.
3. FrankenPHP payload: `FrankenPhpManager.ps1` → `Ensure-FrankenPhpDirectories`, `Ensure-FrankenPhpArchive` (downloaded `frankenphp-windows-x86_64.zip` v1.12.7, 59 MB, into `D:\www\cache\core_node\frankenphp\`) and `Install-FrankenPhpArchivePayload` into `D:\www\frankenphp\bin\`. That is Step93 **without** its Machine PATH registration, which was skipped as unnecessary (all calls use absolute paths) and less invasive. Then `Ensure-FrankenPhpPhpConfiguration` (Step96) → `D:\www\frankenphp\php-conf.d\99-core-node.ini`.
4. **Configuration added:** `D:\www\frankenphp\php-conf.d\50-d7-local-extensions.ini`. It sets `extension_dir = D:\www\frankenphp\bin\ext`, `date.timezone = UTC`, and the dev PHP's extension set (bz2 curl exif fileinfo gd intl mbstring mysqli openssl pdo_mysql pdo_pgsql pdo_sqlite sqlite3 zip). Without it the embedded PHP loads **no** php.ini and no extensions (`extension_dir` defaults to `C:\php\ext`), so Laravel cannot reach PostgreSQL.
5. mkcert: `Ensure-FrankenPhpMkcert` downloaded mkcert v1.4.4 to `D:\www\frankenphp\bin\mkcert.exe`. `mkcert 127.0.0.1 localhost ::1` ran in `D:\www\core_node\certs\local`. That created a new CA in `C:\Users\mpc\AppData\Local\mkcert` and **overwrote** `127.0.0.1+2.pem` / `-key.pem`; the Debian-issued originals are in the backup. `mkcert -install` was not run (modal dialog). The trust-store import was **denied** (see the blocker).
6. Routes and Caddyfile: `Ensure-FrankenPhpLanLocalRoute`, `Ensure-FrankenPhpDomainRoutes`, `Ensure-FrankenPhpCaddyfile` regenerated `storage/frankenphp/{Caddyfile,routes/*.caddy}` with Windows paths. This also rewrote `D:\www\core_node\global_var\web_access_config.json` from the contract (original in the backup).
7. **Generated-file fixes** (not code; lost on the next generator run):
   - The generator writes each site's closing brace on the handler's line (`\t}}`), so Caddy fails with "unexpected EOF". I split `}}` in the 3 route files.
   - I added `skip_install_trust` to the Caddyfile global block, so Caddy's internal `localhost` CA can never try to install itself into a trust store.
   - `frankenphp validate` → "Valid configuration".
8. `start.ps1 --no-service` launched detached at 17:01. It **failed** at "Runtime configuration store initialization failed: Secure runtime value generation failed: app-key". Nothing had started, and the runtime store already holds all keys.
9. I ran the remaining `start.ps1` steps by hand, in its order, with `CORE_NODE_DATA_DIR=D:\www\core_node`:
   - `config:clear` → 0;
   - `route:clear` → 0;
   - `route:list` → 0;
   - `sys:init --no-interaction` → 0.
   - Skipped: `fix_php_ini_deps.php`, because the dev `php -m` shows no duplicate-load warnings and another workflow is editing that file. Also skipped: the 650 MB `pg_win_export.sql` refresh, because it feeds the Linux cross-env restore; the targeted `pg_dump` in step 2 replaced it as the safety copy.
   - PostgreSQL :5432 was already up.
10. Wrote the launcher `D:\www\frankenphp\d7_frankenphp_foreground.cmd` and started it via WMI at 17:05:17, after checking that free RAM was 7.4 GB and ports 80/443/9000/2019 were free. The first instance (PID 20624 under cmd 27572) had a **visible** console window on the desktop. It received a Ctrl+C at about 17:06:27: the log ends in `^C`, and the cause is unknown (most likely the window was interrupted or closed on the desktop).
11. Relaunched at 17:09:19 with the console hidden (PID 28564 under cmd 10788; free RAM was 5.9 GB). https health, CodeMart home and :9000 health all return 200, and 24 of 24 checks passed over 2 minutes.

## Defects found (routed to the owners; nothing edited here)
- **laravel (my scope; the fix waits until this no-code-edit task ends):** `poly_apps/laravel_main/scripts/start.ps1:340-363` `New-SecureRuntimeValue` (the app-key line is :351) passes `php -r 'echo "base64:"...'`. Windows PowerShell 5.1 (the only PowerShell on this machine; there is no pwsh) drops the inner double quotes, so PHP hits a parse error and `start.ps1` exits on **every** run, even when APP_KEY exists. The same pattern appears in the other `php -r` helpers with inner quotes. The file also has another writer's uncommitted change right now.
- **shell-windows:**
  - (a) `FrankenPhpManager.ps1:788,799,919,922`: `$apiHandlers}`/`$uiHandlers}` put the site's closing brace on the handler's line. Every Windows-generated route file is invalid, so Step175 can never start the service.
  - (b) `Ensure-FrankenPhpPhpConfiguration` (Step96) enables no extensions and sets no `extension_dir` for the embedded PHP.
  - (c) The Caddyfile has no `skip_install_trust`.
  - (d) Step175/`-CertificatesOnly` begin with Posh-ACME LE_PROD orders for the production domains, even on a LAN desktop.
- **shell-windows + shell-linux (design):** on a LAN host the domain routes (12gm.com, gm15.com) have no `tls` line, so Caddy keeps making ACME tls-alpn attempts that land on the production IP 43.163.112.77. They fail harmlessly (a separate ACME account) but fill the log. The Linux dual-boot generator does the same.
- **Dual-boot note:** `D:\www\core_node\certs\local\127.0.0.1+2*.pem` and `storage/frankenphp/*` are shared with the Debian boot. The Windows versions are there now; Debian's generators rewrite them on their next start, and the Debian originals are in the backup.

## For the D7 e2e (pycore lane) and the orchestrator
- Laravel is up. Use the TLS blocker section above to choose how pycore reaches it. The pycore endpoint selection and its restore record belong to the pycore lane (D8).
- Octane does not hot-reload: after Laravel code lands, run the worker restart above before the e2e round.
- laravel-remote: nothing in this task changed server code. The server twin needs no verification for it.
