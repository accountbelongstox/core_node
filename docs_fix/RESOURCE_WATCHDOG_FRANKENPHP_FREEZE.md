# Resource Watchdog — FrankenPHP Freeze Diagnosis (Requirement + Runbook)

## Requirement (2026-09-25)

The Debian 13 server (2 cores, 3.7 GB RAM, 1.8 GB swap) intermittently freezes
and becomes unresponsive. Suspected cause: services exhausting memory/swap,
especially **multiple frankenphp / php-zts child tasks**. Required:

1. A script that scans the machine for resource-hogging services, with special
   aggregation of frankenphp child tasks.
2. Run one scan immediately, then keep the script running as a **background
   service**.
3. Record key findings to `/logs/debug.log` — **key events only**, the log must
   not grow unbounded.
4. The daemon must **NOT** auto-start after a reboot (current boot only).
5. Next session: query the log and fix the root cause.

## Deliverables

| Item | Location |
| --- | --- |
| Script | `scripts/services/resource_watchdog.sh` |
| Log | `/logs/debug.log` |
| PID file | `/logs/resource_watchdog.pid` |

## Script behavior

- `--scan-once` — full report to stdout; breach summary appended to the log.
- `--daemon` — 30 s loop; appends one compact `[ALERT]` line only when a
  threshold is breached, with a 300 s per-alert-signature cooldown so sustained
  pressure does not spam the log.
- `--stop` — stops the daemon.
- Log cap: when `/logs/debug.log` exceeds 512 KB it is truncated to the last
  256 KB. One line per alert (~300 bytes), so the log stays small.
- Not registered with systemd or cron: started via `setsid nohup`, dies at
  reboot by design.

Thresholds (env-overridable, defaults tuned for 2-core / 4 GB):

| Metric | Default | Env var |
| --- | --- | --- |
| load1 per core | > 1.5 | `WATCHDOG_LOAD_PER_CORE_MAX` |
| MemAvailable | < 10% | `WATCHDOG_MEM_AVAIL_PCT_MIN` |
| Swap used | > 85% | `WATCHDOG_SWAP_USED_PCT_MAX` |
| Single process CPU | > 150% | `WATCHDOG_PROC_CPU_PCT_MAX` |
| frankenphp+php-zts task count | > 30 | `WATCHDOG_FRANKENPHP_COUNT_MAX` |
| frankenphp+php-zts total RSS | > 1024 MB | `WATCHDOG_FRANKENPHP_RSS_MB_MAX` |

## How to restart the daemon (after reboot)

```bash
/www/programing/core_node/scripts/services/resource_watchdog.sh --stop
setsid nohup /www/programing/core_node/scripts/services/resource_watchdog.sh --daemon >/dev/null 2>&1 &
```

## First scan findings (2026-09-25)

- **Swap 99–100% used** (1864/1864 MB), only ~166 MB free RAM, `kswapd0`
  active — memory exhaustion, not CPU, is the primary freeze driver.
- frankenphp tasks: 6 (incl. php-zts `artisan schedule:run` children),
  346 MB RSS — currently below threshold, but worker count should be watched.
- Other large RSS residents: kimi-code ~395 MB, vite node ~372 MB,
  codex ~228 MB, postgres connections ~86 MB each.

## Next session: query + fix playbook

1. Query the log:

   ```bash
   grep ALERT /logs/debug.log | tail -50
   ```

2. Interpret:
   - `SWAP` / `MEM` alerts with rising `frankenphp_rss` → frankenphp workers
     are leaking or over-provisioned.
   - `PROC_CPU` with a `frankenphp`/`php-zts` entry → runaway worker/scheduled
     job.
   - Alerts where `top_mem` shows non-PHP processes (node, codex, postgres)
     → memory contention from other services instead.

3. Candidate fixes (pick per evidence):
   - Restart frankenphp: `scripts/shells/linux/debian/debian_com/laravel_runtime_frankenphp.sh`
     (its launcher; stop/start per that script's interface).
   - Reduce frankenphp worker count in
     `poly_apps/laravel_main/storage/frankenphp/Caddyfile` (worker num).
   - Investigate `artisan schedule:run` overlap — overlapping cron runs pile
     up php-zts children; ensure `withoutOverlapping()` on scheduled jobs.
   - Raise swap or reduce co-resident heavy processes (vite dev server,
     multiple AI CLIs) on this 4 GB box.
