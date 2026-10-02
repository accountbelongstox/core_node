---
name: 175-declarative-refactor
description: 2026-09-30 175 chain refactored to converge/probe-first; root causes of "Laravel restarts" and what is still open
metadata:
  type: project
---

On 2026-09-30 the 175 chain (systemd_service_manager converge, frankenphp_domain_common, frankenphp_manager LKG guard, laravel_runtime_frankenphp, 175, 75) was refactored to probe-first / restart-only-when-needed. Record: docs_fix/DESIGN_SHELL_HOSTS.md. Not committed by me; the box's syncgit auto-commits the working tree.

**Why:** hard CPUQuota=25% throttled the serving plane ~85% of periods after every boot; 175 restarted the unit/workers/PG on every run; 75 could re-point PG15 to a stale v15 copy.

**How to apply:**
- The earlier "never run 175 live" concern is reduced (no blind restarts, PG probe-first) but 175 is still heavy; the pre-run re-check of demo-seed guard still applies.
- Another resumed session of the same task edits the same files; check `git status`/`git log` and the doc before editing.
- Open: Windows parity, DB indexes (peer), stale PG copy, journal noise, memory sizing.

2026-09-30 later: user allowed 175; it ran 3 times with `CODEMART_INIT=no`, exit 0, no unit restart (refactor validated live). Follow-up fixes are in the doc's section 6b: task status from `last_error`, catalog-driven UNIQUE index realign, race-safe dictionary insert. A direct `migrate --path` is still denied by the classifier; use 175. The user said not to run pycore 59000 on this host (derive its logic from code).

Related: [[never-run-175-live]], [[server-layout]]
