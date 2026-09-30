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
