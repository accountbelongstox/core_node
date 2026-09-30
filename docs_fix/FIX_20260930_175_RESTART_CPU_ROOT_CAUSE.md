# FIX 2026-09-30 — 175: why laravel_main keeps "restarting", and the declarative refactor

Scope: `scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh` and the chain it drives (service manager, FrankenPHP domain/manager libs, runtime launcher, PostgreSQL ensurer). Hot reload (`OCTANE_WATCH`) is out of scope.
Host: laravel-main (`VM-0-2-debian`, 2 vCPU, 3.7 GB RAM). Method: read-only inspection of the live host plus sandbox tests. **175 was never run live and no system state was changed.**

## 1. Evidence (live host, read-only)

| # | Observation | Meaning |
|---|---|---|
| 1 | `ncore-laravel-frankenphp`: `NRestarts=0`, active 20 h | The unit does not crash-loop by itself in the current boot. Restarts come from outside the unit. |
| 2 | Three boots in 3.5 days (09-26 22:27, 09-29 05:33, 09-29 21:05), each ending in a clean SIGTERM | Recovery-by-reboot pattern (cause of the reboots itself is not provable from the surviving journal). |
| 3 | cgroup `cpu.stat`: `nr_throttled 118356` (counter frozen once the quota was raised at 00:58), unit file `CPUQuota=25%` | After every boot the whole serving plane (4 workers + scheduler + timer children) was hard-throttled in ~85 % of 100 ms periods for ~3 h 53 m. The runtime drop-in `50-CPUQuota.conf` (100 %, created 00:58) is a hand hotfix that disappears on reboot. |
| 4 | Laravel log: "Maximum execution time of 1200 seconds exceeded" in bursts of 3-4 at once (09-26 11:13, 09-28 21:32, 09-29 10:50 and 16:53 UTC), each next to PostgreSQL `Connection refused` / `the database system is shutting down` (09-29 10:55, 11:02, 11:09 UTC) | All workers blocked together, then killed at the 1200 s ceiling. DB stalls/restarts hang every worker. |
| 5 | 175 code paths that restart things on every run (section 2) | Self-inflicted restarts of Laravel and of PostgreSQL. |
| 6 | `memory.events high=115756`, swap 100 % used, memory PSI `full avg300=18 %` | Sustained memory pressure on a box shared with PG15, vite dev server, codesync. Contributing factor, not a restart trigger (`oom_kill=0`). |
| 7 | Journal noise: scheduler prints a line per second, `sudo rm ...worker_audio/*.part` about once per second, cron `journalctl --vacuum-size=100M` at 03:00 | Journals of earlier boots hold almost nothing but noise, so restart history is unrecoverable. Restarts now carry an explicit ledger entry (section 3). |

Hypothesis tested and rejected: that Octane's one-shot `set_time_limit()` at worker boot caps the worker lifetime. A throwaway FrankenPHP v1.12.7 instance (scratchpad, loopback) showed the limit is reset per request.

## 2. Root causes in the 175 chain

1. **`register_laravel_service` restarted the unit unconditionally** (`systemctl restart` after every registration) and drift repair (legacy `PHP_BIN` pin) triggered it. Any re-run = full web outage.
2. **`fm_domain_caddy_apply_converged` restarted the unit on any non-200 from the admin `/load`**. A rejected (400) config was answered by a restart that reads the same invalid files, i.e. a crash-loop generator.
3. **`fm_domain_workers_restart` ran on every 175 run**, cycling all Laravel workers whether or not code changed.
4. **Hard `CPUQuota=25%` + `MemoryHigh` on the request-serving unit** (capped resource profile). `systemd_service_manager.sh` already documents why this profile is wrong for interactive backends.
5. **175 always ran `75_install_postgresql.sh`**, whose repair paths stop/restart the cluster. Its data-dir check was version-blind: live PG15 runs from `/www/_debian_12/postgresql/data`, while a stale v15 copy sits at the canonical `/www/wwwroot/postgresql/data`; when 175 ran while PG was down it could re-point PG15 at the stale copy.
6. **`laravel_runtime_frankenphp.sh` booted PHP (`artisan route:clear`) on the supervised start path just to delete a cache file**; with the DB down or memory tight that failure means `exit 1` and, with `Restart=always`, a hammering restart loop. No restart backoff existed.

## 3. Refactor (technique change: imperative "always run / always restart" → declarative reconcile with a disruption budget)

Principle: **probe → plan → smallest action → verify → record**. A running process is restarted only when the process itself must change, and every restart is ledgered with its reason (`ncore_service_actions.log` + journal tag `ncore-service-converge`).

| Component | Change |
|---|---|
| `systemd_service_manager.sh` | `converge_systemd_service` extended: fingerprint of restart-relevant lines (ExecStart/ExecStop/User/WorkingDirectory/Type/Environment); mode `exec` restarts only on fingerprint change, otherwise `daemon-reload` re-applies limits live; deferred env keys (behavior-neutral, e.g. `PHP_BIN`); `reset-failed` before start; optional timeout/exec-stop/profile args; removal of `set-property` drop-ins for keys the declared unit owns (`systemd_property_overrides_clear`); `RestartSteps`/`RestartMaxDelaySec` backoff (systemd ≥ 254). Default mode stays `unit` (mcp-chrome unchanged). |
| `laravel_main_runtime_common.sh` | `register_laravel_service` now converges (no unconditional restart). `laravel_runtime_live_apply` planner: extension-set change → ledgered unit restart; else Caddy `/load`; else staleness-gated workers restart. `pg_app_databases_present` one-query probe. |
| `frankenphp_domain_common.sh` | `/load` outcome classification: 200 → snapshot last-known-good; 4xx → roll files back, **no restart**; no reply → restart only for a unit proven wedged (past 180 s grace and admin + backend dead for 3 probes). Workers restart only if code is newer than the later of unit activation / last graceful workers restart. |
| `frankenphp_manager.sh` | Caddy last-known-good guard: `fm_caddy_config_guard` validates, snapshots, or rolls back (rejected copy quarantined in `storage/frankenphp/lkg/rejected`). |
| `laravel_runtime_frankenphp.sh` | Route cache removed as a file (no PHP boot); config guard before launch. |
| `175_laravel_main_start.sh` | PostgreSQL ensurer is probe-first (skipped when the cluster accepts connections and every app DB exists; `PG_ENSURE_FORCE=yes` overrides). Single declarative unit converge + live apply. Laravel unit uses the **interactive** profile (CPUWeight/IOWeight, MemoryMax = existing RAM policy, no CPUQuota, no MemoryHigh), backoff 10 s → 300 s in 6 steps, stale CPUQuota/MemoryHigh drop-ins removed. |
| `75_install_postgresql.sh` | A cluster holding user databases is never re-pointed implicitly; explicit relocation needs `PG_RECONCILE_DATA_DIR=yes`. |

## 4. Verification (sandbox only; stubs for systemctl/curl/logger, temp unit dirs)

- Converge matrix: fresh → start; identical → nothing; MemoryMax change → live reload, no restart; ExecStart or PORT change → restart with ledger; legacy `PHP_BIN` pin removal → no restart; default `unit` mode unchanged for other callers.
- Simulation against a copy of the live unit: 0 restarts; diff = backoff lines added, `PHP_BIN` pin dropped, `CPUQuota=25%`/`MemoryHigh` replaced by `CPUWeight`/`IOWeight`.
- Property drop-in clearing: pure `CPUQuota` drop-in removed, mixed/other drop-ins kept.
- Caddy guard with the real `frankenphp validate`: valid → snapshot; broken route → rollback + quarantine; no snapshot → verdict `invalid`.
- `/load` planner: 200 / 400 / grace / wedged / still-serving cases; workers gate: fresh / stale / repeat.
- `bash -n` clean on all six edited files.

## 5. Expected effect of the next 175 run on this host

Unit rewritten and applied by daemon-reload with **no restart**; the hand-made 100 % CPUQuota drop-in is removed; PostgreSQL left untouched; workers restarted only if code is newer than their boot. Do not run 175 for a small fix; it remains a heavy provisioning script.

## 6. Load and swap findings (reported by the peer session; DB figures not independently re-measured here)

- CPU since boot: PostgreSQL 15 used 25085 of 36602 CPU-s (69%), `ncore-laravel-frankenphp` 6233, `codesync` 2562. This is the main driver of host freezes and pegged CPU.
- Cause: unindexed sequential scans triggered by Laravel timers/polling (`pg_stat_user_tables`): `app_qy_v1_articles` 512,960 scans / 1.9e9 tuples (OR of 4 JSON predicates in `AppQyV1ArticleModel::findAgentHistoryBySourceRecordId`, ~900 ms each); `app_qy_v1_tts_cache_en` 37,580 scans / 6.9e9 tuples (uncached `AppQyV1DictionaryTTSCoordinator::statistics` COUNT FILTER over 441 MB); `global_tasks` 1.65e9 and `global_relay_operations` 1.15e9 tuples. 11.5k `DatabaseQueryMonitor` warnings per day, average 1.86 s.
- Swap: 100% used; `codesync.service` holds ~1.6 GB in swap (`MemoryHigh 240M`, `memory.events high=2.8M`); memory PSI `full avg300` ~19%; 20M pages swapped in since boot.
- Laravel changes made by the peer (not applied live): migration `AppQyV1_2026_09_30_000002_add_article_identity_lookup_indexes.php` (3 btree expression indexes + GIN on `(metadata->'source_record_ids')::jsonb`; proven on a TEMP copy: BitmapOr, 0.07 ms vs ~900 ms; applied by the next `sys:init`), and `statistics(bool $fresh = false)` with a 10 s per-worker memo (init CLI and SystemInitialization controller pass `true`).
- Update 2026-09-30 14:00 UTC: `orch_audio_tasks`, `orch_audio_segments` and `add_article_identity_lookup_indexes` now show `Ran` in `migrate:status` (batches 25/26); only the Relay V3 ledger migration is pending. The note below was true when written.
- Pending migration `2026_09_27 orch_audio_tasks` was not applied: ~1,662 "Undefined table app_qy_v1_orch_audio_tasks" errors/day and `realtime_outbox_publish_task` failing every second (error_count 337k) until `sys:init` runs.
- Recommended, not done: move the DB-backed cache table (351 MB / 136k rows, ~2.3k slow ops/day) to Redis (available); give `codesync.service` the interactive profile without `MemoryHigh` (shell-linux); journald flood fix plus the daily `vacuum-size=100M` cron; Windows Step175 parity (shell-windows).

## 6a. First live run of the refactored 175 (2026-09-30 ~14:10 UTC, user-approved, `CODEMART_INIT=no`)

Exit 0. `ncore-laravel-frankenphp`: `unit=unchanged restarted=no`, active since 09-29 21:05 CST (no outage); Caddy `/load` applied with zero downtime; workers restarted gracefully once. `sys:init` applied the pending Relay V3 ledger migration (batch 27); no migrations pending. PostgreSQL ensurer was probe-first (pg-tuning only reports that `shared_buffers`/`shared_preload_libraries` await a restart, not performed). Still open: three timer tasks report `running_with_errors` (`relay_maintenance_task`, `global_task_result_writeback_task`, `app_qy_v1_agent_history_audio_writeback_task`), 11,685 failed queue jobs, memory (swap 180 MB used, peak 1.1 GB). The run printed an installation access value; it is deliberately not recorded here.

## 7. Follow-ups (not done here)

- Windows parity (`Step175_LaravelMainStart.ps1`): no systemd, but the same probe-first / no-blind-restart rules apply (shell-windows).
- PostgreSQL 15 consumes most CPU (seq scans on `app_qy_v1_articles`, `tts_cache_en`, `global_tasks`): DB-index work is tracked by the peer session.
- Relocate/remove the stale v15 copy at `/www/wwwroot/postgresql/data` and the broken PG17 cluster by hand.
- Reduce journal noise (per-second scheduler line, `sudo rm` of `.part` files) and the 100 MB vacuum cron so restart history survives.
- Memory pressure (vite dev server, codesync `MemoryHigh 240M` holding ~1.6 GB in swap) needs its own sizing pass.
- Shell owners should review this cross-role edit of the 175 chain (`shell-linux`).
