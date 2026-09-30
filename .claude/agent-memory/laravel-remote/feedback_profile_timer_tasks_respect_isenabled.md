---
name: profile-timer-tasks-respect-isenabled
description: When profiling Octane timer tasks, never call exec() on tasks whose isEnabled() is false; disabled maintenance tasks mutate data
metadata:
  type: feedback
---

Do not call `$task->exec()` directly on every `OctaneTimerTaskCatalog::discover()` entry when profiling. Filter on `$t['enabled'] === true` first.

**Why:** on 2026-09-30 I ran the disabled `global_task_maintenance_task` by accident. It released timed-out tasks, expired 507 never-assigned pending tasks to `failed`, and purged old completed rows (50k queries). That matches the retention policy but it was an unrequested data change.

**How to apply:** for cost analysis, read `discover(true)`, keep only ENABLED tasks, and measure with `DB::listen`. For disabled tasks, read the code instead of running it.

Related: [[host-cpu-freeze-root-causes]]
