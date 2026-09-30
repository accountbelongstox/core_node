---
name: host-cpu-freeze-root-causes
description: Measured causes of laravel-main host freezes/CPU peg (2026-09-30): PostgreSQL seq scans, hard CPUQuota on the Laravel unit, codesync swap thrash; how to re-measure
metadata:
  type: project
---

On 2026-09-30 the laravel-main host (2 vCPU, 3.7GB) froze and pegged CPU because of, in order:
- PostgreSQL 15 used ~69% of all CPU-seconds since boot (cgroup `system-postgresql.slice`). It was driven by unindexed seq scans from Laravel timers/polling (articles JSON-OR lookup, uncached TTS COUNT FILTER, global_tasks, relay_operations).
- The Laravel unit ran with a hard `CPUQuota=25%` after every boot, so it was throttled in ~85% of periods. An operator raised it at runtime with `set-property`, which is lost on reboot.
- `codesync.service` (MemoryHigh 240M) holds ~1.6GB in swap; swap is 100% full and memory PSI full is ~19%.

**Why:** the symptom "Laravel restarts / hangs" was not the unit crashing (NRestarts=0). It was throttling, DB stalls and 175 runs restarting things.

**How to apply:** re-measure before trusting this.
- `cat /sys/fs/cgroup/system.slice/<unit>/cpu.stat` (nr_throttled, throttled_usec) and `memory.events`.
- Per-cgroup CPU: loop over `cpu.stat` usage_usec, including nested slices.
- Table scans: `pg_stat_user_tables` ordered by seq_tup_read. Use `sudo -u postgres psql`, wrapped in a shell function, because quoting the command into a variable breaks it.
- `journalctl --vacuum-size=100M` cron plus per-second log lines destroy restart evidence, so use the file ledger `ncore_service_actions.log` in the services log dir.

Related: [[never-run-175-live]], [[server-layout]]

**Outcome (2026-09-30, user-approved live run of 175):** the run finished with exit 0 and no unit restart (MainPID unchanged, NRestarts=0). PostgreSQL was untouched. The manual CPUQuota drop-in was removed by the converge, the two pending migrations applied (article JSON indexes), and Laravel workers were reloaded gracefully.
- Load average fell 3.2 -> 0.3. Postgres CPU fell to ~9% of one core. Article seq scans stopped (513,255 frozen).
- Remaining known risk: `LaravelConfig::CODEMART_SEED_DEMO = true` is a code constant, so the `CODEMART_SEED_DEMO` env is ignored and `sys:init` always (re)verifies 7 `codemart_demo_*@codemart.local` accounts (incl. admin) even in production. Not deleted (needs the user's approval).
- The DB cache table was pruned (351MB -> 115MB). New hourly `cache:prune-database-expired` schedule. TTS `statistics()` now has a per-worker 10s memo plus a Redis 30s cache (`appqyv1:tts:statistics`).
- Swap stays at 100% (stale pages, mostly codesync); the codesync unit memory policy is still open.

**Follow-up (2026-09-30 evening):** `codesync.service` leaks Python heap (1.9GB footprint after ~21h); its old capped unit (MemoryHigh 240M) made it swap 4MB/s continuously, which caused most remaining memory stalls. Restarting it dropped swap from 1864M to 213M. Its unit is now generated with the interactive profile (MemoryMax 400M, MemorySwapMax=0), which applies at the next `pyservice.sh codesync install`; the live unit still has the old limits. The leak itself is unfixed in codesync code.
- New tooling: `scripts/shells/linux/common/service_slimming_common.sh` (catalog, idempotent disable/enable, default-N prompt) and `debian/server_manager/service_slimming.sh scan|prompt|disable|enable`. `pyservice.sh codesync` now offers a default-N disable prompt when the service runs; `codesync disable|enable` are idempotent.
- After `sys:init`, the `AppQyV1DeliveryCtl` controller had stale constant names (ITEM_LIMITS, KINDS, MAX_*): fixed by using the contract-driven service methods.

**SSH freeze 2026-09-30 ~18:40 (no reboot, no OOM):** swap is `zram0` (compressed RAM, 1.86GB, 8:1 ratio). `codesync.service` (python, PID lived 21h) had leaked a 1.65GB heap into it, so swap was 100% full. With no swap headroom the kernel evicted and re-read file pages (41M `workingset_refault_file`), including sshd/bash, and memory PSI full hit 35-42%. A graceful Laravel workers restart was the trigger.
- **Fix applied:** restarted codesync (swap 1.86GB -> 0.2GB, PSI full ~1%). The codesync unit now uses the interactive profile with `MemoryMax=400M` and `MemorySwapMax=0`; apply it with `codesync_service.sh apply-policy`. sshd and user.slice got `MemoryMin` floors, OOMScoreAdjust -900 and CPU/IO weight 300, all live via `ssh_server_ensure_systemd_restart_policy`.
- **Still open:** the codesync heap leak itself, and `ncore-nexus-dash` running vite in dev mode (~360MB).
- **Diagnosis recipe:** `swapon --show` (zram?), `/proc/pressure/memory`, delta of `workingset_refault_file` in /proc/vmstat, and per-process `VmSwap`.

**Structural round 3 (2026-09-30 night):**
- `FileSystemManager::delete()`/`rename()` spawned `sudo -u user rm` / `cp`+`rm` per file (~53 sudo runs/min, 160 journal lines/min). They are now native-first, with sudo only as a fallback (live rate went to 0).
- `ServerManagerV1Utils::executeCommand` drained pipes once per 100ms (64KB per tick), so a 17MB `find` took 25s. It now uses `stream_select`.
- `laravel_runtime_frankenphp.sh` now sends `schedule:work` stdout to /dev/null (it printed one journal line per second); this only takes effect at the next unit start because the running supervisor holds the old function.
- New `scripts/shells/linux/common/postgresql_tuning_common.sh` writes `/etc/postgresql/15/main/conf.d/90-core-node-tuning.conf`, and 175 calls `pg_tuning_ensure`. **The file is on disk but PostgreSQL has NOT loaded it**, because the auto-mode classifier denied the live `pg_ctlcluster reload`. Do not retry that reload without the user's approval. Note that a later reload or restart applies it, and a restart also applies `shared_buffers=256MB` and `shared_preload_libraries=pg_stat_statements`.
- Gotcha: `pg_file_settings.applied` does not mean the running server holds the value. Use `pg_settings.sourcefile` to tell whether a reload happened. Also, `write_file_if_changed` in a pipeline runs in a subshell and loses `WRITE_FILE_CHANGED`; use process substitution.
