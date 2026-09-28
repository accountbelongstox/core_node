---
name: lm-transport-auth
description: laravel-manager API modules extend LmBaseAPI (401/403 i18n); BaseAPI semantics after the 2026-09-27 fixes (no settled-GET cache, retries only reads/idempotent writes)
metadata:
  type: project
---

All laravel-manager API module classes (`apps/laravel-manager/api/modules/*`) and `api.http` extend `apps/laravel-manager/api/LmBaseAPI.ts`, which maps 401 → `auth.login_hint` and 403 `code: AUTH_FORBIDDEN` (Laravel `dashboard.auth`) → `auth.admin_required`. New LM modules must extend LmBaseAPI, not the core BaseAPI. For writes behind Laravel's `idempotent` middleware (db backup/restore, service restart/autostart) use `LmBaseAPI.requestIdempotent(action, config)`: one Idempotency-Key per user action (BaseAPI `createIdempotencyKey`), kept while the outcome is unknown so a retry replays/joins.

`laravelRealtime.subscribe()` takes symbolic names (`LARAVEL_REALTIME_EVENTS.queueChanged` === 'queueChanged'); wire names are contract-resolved inside LaravelRealtime.ts, so each handler gets a typed payload — no `in` narrowing needed.

Shared `core/integrations/laravel/transport/BaseAPI.ts` (shared layer; edit only with an orchestrator writer assignment):
- GETs coalesce in-flight only (TTL 0); a settled write bumps a read generation and clears the coordinator.
- Transient failures retry only GET/HEAD or requests carrying `Idempotency-Key` (`IDEMPOTENCY_KEY_HEADER`). Long operator writes (backup/restore/import, systemctl) use `retry:false` plus a long per-call timeout via `this.request`.
- `setSharedBaseURL` does not persist to pycore; only `ApiManager.switchEndpoint` does (FU-027).

Laravel operator routes (db-manager, local/ai, config, dictionary writes) are `dashboard.auth` admin; restore/import/credentials are super_admin; the browser never holds the client key (K6). Route table: `.claude/agents_shared/client_key_auth/laravel_route_auth.md`.

**Why:** FU-002/FU-003/FU-030 duplicate writes and stale reads; client-key rollout 2026-09-27.
**How to apply:** when adding LM calls, rely on LmBaseAPI for auth messages; for non-idempotent long writes pass `retry:false` and a timeout. See [[lm-i18n-conventions]].
