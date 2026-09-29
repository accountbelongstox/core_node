---
name: project-delivery-selected-server
description: 2026-09-30 refactor - UI-selected Laravel server is the single delivery target; failover only inside one server; parked/pinned rows; source_gone outcome; what is deliberately NOT done yet
metadata:
  type: project
---

The Laravel delivery outbox (`pyutils/laravel/delivery_outbox.py`) and `endpoint_manager.py` were reworked so the server the user SELECTED (stored `current`) is the only delivery target.

- Failover (`resolve`, `resolve_for_ui`) only adopts routes whose namespace equals the selected server's; a foreign server that is up is never adopted (it is another database).
- `target_namespaces()` = `[selected]`; `reconcile()` skips non-selected namespaces unless `reason == manual`; `reconcile_reachable` became `reconcile_selected`.
- Drain/ready/has_pending/next_attempt_at are scoped by `deliverable_namespaces(kind)`: selected server only, or every server holding rows for a `DeliveryKind(pinned=True)` kind (audio lane rows); servers whose routes all failed are excluded and a single watcher (`_watch_servers`, 30 s) re-probes them. This ended the head-of-line blocking where 2,616 old rows of an offline server refilled the 25-row window every minute.
- `route_for_namespace` replaced `base_url_for_namespace`: fastest reachable route, re-probe only routes whose last probe is older than 30 s.
- `OUTCOME_SOURCE_GONE`: audio_cache.resource rows whose file vanished are dropped, not dead-lettered. Lane kinds still dead-letter (they need failure history).
- Failure while the server is offline gives the attempt back and counts no metric.

**Why:** the user's log showed article submits timing out against `debian-gpu.ts.net` (a second server, `acef730b...`, same server_id as 127.0.0.1:9000) while the UI had `api.si.12gm.com` (`375427f6...`) selected; 38k rows (18.8k dead letters, mostly "cached audio is missing") had piled up.

**How to apply / open items (need user approval, not done):** the 18,825 existing dead letters and the 2,616 parked `acef730b` article rows are untouched (deleting queue rows is destructive). Orchestration `first_namespace` rows for a non-selected server are parked until it is selected. Laravel-side diff contract unchanged. See [[project-pycore-pitfalls]] for where the sqlite files live.
