---
name: relay-api-hang-2026-09-30
description: FrankenPHP worker-pool exhaustion on api.si.12gm.com (2026-09-30): what froze it, what guards it now, and the diagnosis toolkit
metadata:
  type: project
---

On 2026-09-30 the 2 vCPU / 3.7 GB laravel-main VM froze. Every FrankenPHP thread was held by a request that ran a whole-table PostgreSQL scan, a cold cache fill, or a long wait, and the unit's hard CPUQuota throttled the box.

Current state (code, 2026-10-02). There is no per-thread lane cache. Dictionary lane counts come from `DictLaneQueueCenter::cachedCount`, which keeps one count per write version and reads the gap partial indexes. Progress totals are planner estimates from `App\Support\TableRowEstimate` (`pg_class.reltuples`, cached 300 s). `LockedCache` never blocks: on a cold key, callers that lose the fill lock get the last good value or a degraded default. Voice subtitle answers 202 and runs in the `octane-timer:background` lane. `PycoreTaskQueue::poll` never sleeps. The OpenRouter catalog caches failed fetches, and request paths read the cache only. `WorkLeaseService::reap()` skips any language that lacks its `_lease_expiry` index. The 175 unit uses the `interactive` resource profile: CPUWeight, no hard CPUQuota, and it removes `set-property` CPUQuota drop-ins.

**Why:** a request worker held by a scan, a fill or a pycore wait is lost capacity on a 2-vCPU box. A few such requests at once take the whole pool.

**How to apply:** for a "PHP hangs" report, check these first:
- `curl localhost:2019/frankenphp/threads` shows the CurrentURI of each thread.
- `pg_stat_activity` shows long sequential scans. Check that the hot-path indexes exist (migration `AppQyV1_2026_10_02_000002`).
- `/sys/fs/cgroup/system.slice/ncore-laravel-frankenphp.service/{cpu.stat,memory.events}` shows CPU throttling and memory events.

`POST localhost:2019/frankenphp/workers/restart` reloads PHP code without a service restart; it waits for in-flight requests.

Related: [[server-layout]], [[host-cpu-freeze-root-causes]]
