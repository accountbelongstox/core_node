# laravel-remote report

- Session: ct-laravel-remote on the laravel-main server (checkout `/www/programing/core_node`).
- Date: 2026-09-27.
- Messaging: the cross-machine round trip with `ca-orchestrator` is confirmed.
- Changed files: none. Server-only changes: none. Every task below was read-only: no writes, restarts, migrations or cache commands.
- Rule noted to the orchestrator: running `sys:init` or migrate on this server needs the user's explicit request, relayed by the orchestrator.
- Status: laravel-remote-1 and laravel-remote-2 are done (the orchestrator recorded both in requirements §10.4).
- D17 (user) supersedes the earlier "175 will not run". 175 becomes an idempotent ENSURE script with `--list-steps`, `--check` and `--step <name> [--show]`, built from the fixes in srv-04/05/06/07.
- My next job, once those lanes are approved and synced: test 175 on this server in this order:
  1. `--list-steps`;
  2. `--check`;
  3. `--step <name>` one at a time;
  4. the full run.
- I stop and report at the first step that would stop the web plane or a live database.
- Before the first step that writes, and before the full run, I will confirm D17 with the user in this session.
- Laravel reads only the config files, not `.env`. The codemart admin password comes from `service_contract.json#codemart_admin_password`.
- Sync check (2026-09-27): not synced yet. HEAD is still 74e7770bd, and there is no D17 section in the server agent file.
- Idle until then, with no writes. The session will be restarted by the new launcher once D13 is approved.

## Task #2: smoke test (2026-09-28, read-only). Verdict: ready_with_issues

- Host VM-0-2-debian. laravel/framework ^13.0, running Laravel 13.25.0 on PHP 8.5.10 ZTS. HEAD is 74e7770bd.
- The agent file has no D17/D19 section yet, so nothing has arrived through CodeSync.
- The CodeSync ping still times out.
- There are 3 `ca-orchestrator` sessions: [a0b003] offline, [f2f514] idle, [13ea0a] idle. Replies go to the sender's bridge ID.
- Closed by the orchestrator:
  - Parity: `composer.json` matches dev. The guide, `laravel-remote.md` and `routes/api.php` differ, as expected while CodeSync is wedged.
  - Orchestrator address from now on: `bridge:session_018sW7vKGr8jJwnLBR8xKGhN`.
  - The CodeSync wedge and the laravel-remote-5 bootstrap are on hold until the user gives a task that includes them (R4).
  - No changes now.

## laravel-remote-4: can this server receive CodeSync pushes? (D19, read-only)

No. Code reaches the server only through CodeSync (D19). Arrival is checked by comparing per-file SHA-256, not HEAD.

- **Daemon:** `codesync.service` is enabled and active. It runs `pyservice.sh codesync run` → pid 878 `codesync_boot.py run`, with `role=client, light=False`. The runtime peer set is v73: dev 10.58.197.54, and this host is 43.163.112.77.
- **Bind:** 0.0.0.0:59000, plain HTTP. The server code has no loopback/rpcLanBind option. This host is 43.163.112.77, the doc's CLIENT URL.
- **Exposure:** iptables INPUT is ACCEPT. There is no TLS proxy route, and Tailscale is stopped (NeedsLogin). DEV reaches the daemon over plain HTTP on the public IP (one inbound connection from 116.68.18.40).
- **Wedged:**
  - The cgroup is over `memory.high` (240M): 537 MB swapped, 10.4M high events, PSI full about 65%.
  - Loopback ping/status/peers time out.
  - The accept queue is at 4 of 5.
  - Nothing has arrived since the 2026-09-27 01:21 git merge.
- **`CORE_NODE_CLIENT_KEY_1`:** absent. Current auth is the hardcoded `WORKSPACE_SHARED_SECRET` in `workspace_auth.py`.
- **Missing:**
  - A restart of `codesync.service` (user approval), plus a pycore fix for the memory leak.
  - A permitted transport: an SSH tunnel to loopback, a TLS route, or Tailscale. Public 59000 should then be closed.
  - The new bind code, delivered by a bootstrap push and then a second restart.
  - `CORE_NODE_CLIENT_KEY_1`, from the user.

Follow-up plan from the orchestrator (§10.5). Every live step needs the user's direct consent in this session.
1. Restart codesync.
2. One-time bootstrap of the new CodeSync and client-key auth code over SSH, plus `CORE_NODE_CLIENT_KEY_1`.
3. Restart again.
4. DEV pushes over an SSH tunnel, and the daemon binds to loopback.
5. Close public 59000.

pycore investigates the memory growth first. laravel-remote-5 will carry the exact steps.

My notes on that plan: the bootstrap writes `pycore/` files, which are outside my scope and need a named writer or an explicit grant. The SSH copy is an exception to D19 and needs the user's approval.

## laravel-remote-1: server inventory (D9/D7)

1. Checkout:
   - HEAD `74e7770bda27`. `git status --short | wc -l` = 5 (claude launcher scripts, git_grant.json, .claude/agent-memory, agents_shared/reports).
   - `poly_apps/laravel_main` has no server-only modifications.
2. Laravel:
   - Laravel 13.25.0 on PHP 8.5.10 ZTS.
   - migrate:status: 156 Ran, 2 Pending (`AppQyV1_2026_09_27_000001` orch_audio_tasks, `_000002` orch_audio_segments). No codemart, dingduoduo or client_key migration is pending.
   - 15 rows in the migrations table have no file on disk (old AppQyV1).
   - codemart routes: 112 (50 GET|HEAD, 57 POST, 5 PUT). Total routes: 1085.
   - bootstrap/cache holds only packages.php and services.php.
3. Runtime:
   - `ncore-laravel-frankenphp.service` is enabled and active. It runs 175_laravel_main_service_frankenphp.sh, which starts laravel_runtime_frankenphp.sh, which starts `schedule:work` and `frankenphp run`.
   - frankenphp listens on :80, :443, :9000 and 127.0.0.1:2019.
   - There are no queue workers, Horizon or supervisor. queue=sync.
   - The only scheduler is `schedule:work` inside that service.
   - PostgreSQL: 15/main on 5432 is online. 17/main on 5433 is down.
4. Redis:
   - Debian redis-server 8.0.2 is installed, but the service is disabled and inactive. Config: 127.0.0.1:6379, no password.
   - phpredis is not loaded in the CLI or FrankenPHP.
   - cache, queue and session come from `LaravelConfig` constants, not `.env`. Effective values: database / sync / database. Redis client phpredis, db0, cache db1, resource_index db2.
5. Secret store: `CORE_NODE_CLIENT_KEY_1` no; `DINGDUODUO_SUPER_CODE_SIGNING_KEY_1` no.
7. HTTP:
   - `/api/health` 200. `/api/codemart/v1/public/estimate-options` 200.
   - `/api/codemart/v1/public/home` 500: `codemart_v1_escrows` has no `released_amount`/`refunded_amount` columns. Now laravel-T11.
6. 175 comparison. It was checked by a workflow of 4 readers and 4 verifiers, and I spot-checked the key lines. Verdict: **do not run 175 on this server as-is.**
   - **Web outage.**
     - The chain: `redis_endpoint_common.sh:342` writes START_REDIS=true before the start. phpredis then becomes desired, so `laravel_main_runtime_common.sh:197-201` runs `93 --mode=apt`.
     - `fm_unlink_frankenphp_runtime` (`frankenphp_runtime_common.sh:494-498`, called from `frankenphp_install_modes.sh:454`) then runs `systemctl disable --now ncore-laravel-frankenphp`. The unit's ExecStart matches `frankenphp` and does not match `octane|artisan`.
     - The unit stays down until the full restart at `175:756/771`.
     - Every return between 175:350 and 748 leaves it stopped and disabled: 352, 367, 401, 409, 417, and 714-717, which always fires with `--domains-only`/`--ssl-only`.
   - **PostgreSQL, on every run.**
     - The `75` drift check (`:500-507`) never converges, so `configure_postgresql` runs every time.
     - `pg_service stop` at `:212` stops the live 15/main, which then starts again. There is no initdb or drop, and 17/main fails again.
     - It runs ALTER USER postgres with the password on the argv, a reload, and CPUQuota=50% on `postgresql@15-main`.
   - **Redis.** It enables and starts `redis-server`. On success it runs CONFIG SET and edits `redis.conf` (appendonly yes, maxmemory at 10% of RAM, noeviction, listpack).
   - **9_fix_dns probe.** It stops every unit on :80, binds a temporary python server, then restarts the units. It is repeated on every run.
   - **mkcert as root** would create a new CA in the trust store and re-issue the local certificate.
   - **Caddyfile** goes from 777 to 600. `pg_sync_adapter` chmods `/www/core_node` to 1777.
   - **sys:init.**
     - It runs migrate (2 CREATE-only migrations) and adds the missing CodeMart columns, which fixes public/home.
     - It **seeds CodeMart demo data in production**, including `codemart_demo_admin` (rolelevel 10) with the repo demo password. `CodeMartV1Initializer.php:536-553` has no environment check, and `CODEMART_SEED_DEMO` is absent from `.env`.
     - It prints an existing admin invite code.
     - It resets the TTS engine priority order.
   - **Already satisfied:** web_access_config, Dragonfly, 73, ensure_php_redis, L13, the runtime store, `.env`, route/config clear, PHP, composer, sshd, unzip, createdb, 7z, dictionaries, node, chown, queue, scheduler, nginx/certbot planes, acme issuance.
   - **Recommendations:**
     - laravel-codemart: make the demo seeder opt-in.
     - T11 on this server: after the user's approval, run only `php artisan sys:init`, and only with the demo-seed guard in place.
     - shell-linux: add unlink discriminator items (1)-(8) to srv-04. The full list is in the orchestrator message.

Correction: the effective env is production with debug off (`config/app.php:41,54` read `LaravelConfig.php:8-9`). The `.env` values `APP_ENV=local` and `APP_DEBUG=true` are dead keys.

## laravel-remote-2: server diagnostics (D7/D9)

1. Logging:
   - `config/logging.php:32` always uses stack → daily (`:72,:88`). The log path is `:17`: `/www/wwwroot/laravel_db/logs/laravel-YYYY-MM-DD.log`. `.env` `LOG_CHANNEL=syslog` is never read.
   - The 500 is logged there as production.ERROR.
   - Extra: `mcpv1:placeholder-cleanup` fails daily because `placeholder_images` is missing. There are 610 DatabaseQueryMonitor warnings today.
2. Scheduler overlap:
   - `OctaneTimerService::writeHeartbeatSnapshot()` (`:143`) has had no caller since 45901d3f6. Every per-minute `schedule:run` therefore reads a stale `last_run` and runs all tasks in its first tick (`:308/:328`). Audio writeback alone took about 101s.
   - The `withoutOverlapping(1)` mutex (`bootstrap/app.php:77`, database cache, `cache_locks`) expires after 60s.
   - `EXECUTION_BACKGROUND` is never honored.
   - Fix (laravel): call the snapshot write at the end of `tick()`, move slow tasks off the inline tick, and raise the mutex expiry.
3. PG17:
   - The data dir and its whole tree are 777 postgres, with ctime 2026-09-18 16:48:35 (during an install run).
   - Likely cause: a 777 walk over /www/wwwroot (`fs_perm_helpers.sh` `repair_owned_tree_777`, via `permissions_fixer_lib.sh:124-130` or `webpath_permissions.sh:163-202`), then `75_install_postgresql.sh:219` chowned the tree back to postgres.
   - The data dir's `PG_VERSION` is 15, so chmod alone will not start PG17.
   - Latent hazard: `pyservice_www_permissions.sh:95-101` runs a full /www 777 walk whenever the stamp is missing, which would reach the live PG15 data dir.
4. The two orch_audio migrations only create new tables. Both tables are absent, so `SafeMigrationHelper.php:1334-1335` takes the create branch. Safe at deploy.
5. phpredis:
   - FrankenPHP 1.12.7 is a dynamic build linking `/lib/libphp-zts-85.so`, from the pkg.henderkes.com php-zts repo. It uses `/etc/php-zts` and `/usr/lib/php-zts/modules`.
   - Official path: `apt install php-zts-redis` (candidate 6.3.0+php85-8), then restart the service. That is shell's step, with the user's approval.
