---
name: server-layout
description: laravel-main server paths, services, log locations and pitfalls (effective config ignores .env, no jq, runs as root)
metadata:
  type: reference
---

laravel-main server facts, verified 2026-09-27. Re-check them before relying on them.

- Service: `ncore-laravel-frankenphp.service` (User=root). It starts `laravel_runtime_frankenphp.sh`, which runs `php artisan schedule:work` and `frankenphp run -c poly_apps/laravel_main/storage/frankenphp/Caddyfile`. There is no queue worker, and queue=sync.
- Logs: `/www/wwwroot/laravel_db/logs/laravel-YYYY-MM-DD.log` (daily, dates in UTC). `storage/logs` and syslog are NOT where Laravel logs go. Timer state lives at `/www/wwwroot/laravel_db/tmp/`.
- Pitfall: `config/app.php`, `logging.php`, `cache.php`, `queue.php` and `session.php` read `app/Constants/LaravelConfig.php` constants. The `.env` keys APP_ENV, APP_DEBUG, LOG_CHANNEL, CACHE_STORE, QUEUE_CONNECTION and SESSION_DRIVER are dead. To see effective values, use `php artisan tinker --execute='echo json_encode(config(...));'`.
- Pitfall: `jq` is not installed. Parse JSON with `php -r` instead.
- PHP: `/usr/local/bin/php` and FrankenPHP share `/etc/php-zts`. The packages come from the pkg.henderkes.com php-zts repo, so extensions install as `php-zts-<ext>`.
- PostgreSQL: the live cluster is 15/main on 5432. The 17/main cluster on 5433 is broken.
- Secret store: `.secret_keys/.secret_ignore/<KEY>`, one file per key. Check existence only with `test -s`, and never read the contents.
- Everything runs as root and the laravel_main tree is mode 777, so read-only artisan runs as root leave no ownership problems.
- Code arrival (user D19): code reaches the server only through CodeSync, never git. HEAD stays at 74e7770 and does not move. Verify arrival by comparing SHA-256 with the orchestrator's list.
- CodeSync daemon: `codesync.service` (User=lighthouse), which runs `pyservice.sh codesync run` → `pycore/pyutils/codesync_boot.py run`. It binds 0.0.0.0:59000 over plain HTTP in role=client.
  - Peers are stored in `/var/_core_node/cache/codesync/code_sync_peers.json`.
  - This host's public IP is 43.163.112.77 (private eth0 10.3.0.2).
  - The unit has MemoryHigh=240M, and the daemon wedges when it goes over. Check `/sys/fs/cgroup/system.slice/codesync.service/memory.*`, and loopback `/code-sync/ping`.
- Pitfall: my Bash can reach public URLs and loopback, so a loopback timeout means the daemon is hung, not the sandbox.

Related: [[cross-machine-messaging]]
