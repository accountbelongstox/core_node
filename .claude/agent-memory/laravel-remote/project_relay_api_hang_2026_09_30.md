---
name: relay-api-hang-2026-09-30
description: Root cause of the api.si.12gm.com hang (DictLane select * rebuild storm + CPUQuota=25%) and the diagnosis toolkit for FrankenPHP pool exhaustion
metadata:
  type: project
---

Hang on 2026-09-30 was worker-pool exhaustion: all 4 FrankenPHP threads sat in `/api/queue-center/overview` and `dictionary/words?filter=without_audio`, each rebuilding the word_audio lane with `select *` over app_qy_v1_tts_cache_en (240k rows, 436 MB). Cause 1: `DictLaneCatalog::laneRows` passed columns to `cursor()`, which ignores them. Cause 2: `counts()` rebuilt the whole lane on every table-signature change. Cause 3: unit CPUQuota=25% (of ONE core) throttled 85% of cgroup periods.

**Why:** the lane signature includes n_tup_upd, so any audio writeback invalidates it and every thread (per-thread static cache) reloads the lane.

**How to apply:** for a "PHP hangs" report, first run `curl localhost:2019/frankenphp/threads` (CurrentURI per thread), `pg_stat_activity` for long `select *`, and `/sys/fs/cgroup/system.slice/ncore-laravel-frankenphp.service/{cpu.stat,memory.events}`. `POST localhost:2019/frankenphp/workers/restart` reloads PHP code without a service restart (waits for in-flight requests). Live CPU quota change: `systemctl set-property --runtime ncore-laravel-frankenphp.service CPUQuota=100%`.

Related: [[server-layout]]
