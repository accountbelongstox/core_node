---
name: 175-declarative-refactor
description: 2026-09-30 175 chain refactored to converge/probe-first; root causes of "Laravel restarts" and what is still open
metadata:
  type: project
---

On 2026-09-30 the 175 chain (systemd_service_manager converge, frankenphp_domain_common, frankenphp_manager LKG guard, laravel_runtime_frankenphp, 175, 75) was refactored to probe-first / restart-only-when-needed. Record: docs_fix/FIX_20260930_175_RESTART_CPU_ROOT_CAUSE.md. Not committed by me; the box's syncgit auto-commits the working tree.

**Why:** hard CPUQuota=25% throttled the serving plane ~85% of periods after every boot; 175 restarted the unit/workers/PG on every run; 75 could re-point PG15 to a stale v15 copy.

**How to apply:**
- The earlier "never run 175 live" concern is reduced (no blind restarts, PG probe-first) but 175 is still heavy; the pre-run re-check of demo-seed guard still applies.
- Another resumed session of the same task edits the same files; check `git status`/`git log` and the doc before editing.
- Open: Windows parity, DB indexes (peer), stale PG copy, journal noise, memory sizing.

Related: [[never-run-175-live]], [[server-layout]]
