# ui-wordnew report

Earlier history (wordnew-1..5) is in `.claude/agents_shared/reports/wordnew.md`.

## ui-wordnew-D7

Task: `[ui-wordnew] D5/D7/D9 items (batch 1/1)`. B2 assignment: `poly_apps/pycore_laravel_wordnew_ui/core/network/api-client/` only. Reviewers diff against 74e7770.

| Item | Status | Files |
|---|---|---|
| CKA-12 | done, waiting for review | `core/network/api-client/MasterApiClient.ts`, `core/network/api-client/RequestQueue.ts` |
| MCHR-31-wn | deferred (dependency missing) | none changed |

### CKA-12

- `MasterApiClient.withIdempotencyKey` now mints the key with `createIdempotencyKey()` from `core/integrations/laravel/transport/BaseAPI.ts:21-25`. The import sits next to the existing `IDEMPOTENCY_KEY_HEADER` import, and `generateEntryId` is no longer imported.
- `RequestQueue.enqueue` assigns `id: createIdempotencyKey()`. The second generator (`generateEntryId`, crypto.randomUUID with a `Math.random` fallback) is removed. It had no other importer, and the `api-client/index.ts` barrel never exported it.
- Import cycle check: nothing in BaseAPI's import graph (TransportTypes, APICache, HtmlErrorEvents, LaravelEnvelope, logStore, RequestCoordinator, AuthSession, LoginRequestBridge -> AuthRequestCenter, ProtocolFetch) imports `api-client/`, and MasterApiClient already imported BaseAPI.
- Line endings: HEAD's MasterApiClient.ts had six LF-only lines (47-49, 365-367). The edit tool normalized them to CRLF, and I restored them, so the diff has only the three content lines. RequestQueue.ts stays all-CRLF.
- Verification:
  - Free RAM was 3.35 GB, then 4.93 GB (guard: 3 GB), so the whole-UI type-check was allowed.
  - `bun run lint` fails on this Windows host before type-checking anything: `bun: command not found: tsc`. `node_modules/.bin/tsc` is only a POSIX shim. The same command run as `bun node_modules/typescript/bin/tsc --noEmit` exited 0 with 0 `error TS` lines.
  - Grep: `grep -rn "generateEntryId\|randomUUID\|getRandomValues\|Math.random" core/network/api-client/` returns nothing. `createIdempotencyKey` is defined only at `BaseAPI.ts:21` and used at `MasterApiClient.ts:423` and `RequestQueue.ts:100`. `MasterApiClient.ts` has no `generateEntryId` import.
  - `git diff --stat`: MasterApiClient.ts 3+/3-, RequestQueue.ts 3+/8-.

### MCHR-31-wn (deferred)

- Reason: the dependency ui-pycore-manager MCHR-31 has not landed. `shared/library-cover/` holds only `LibraryCoverTaskModel.ts`, which exports no cover presenter and no waiting-status set (rechecked at the end of the task). That path is outside my B2 assignment, and copying the set into wordnew would duplicate shared code. `COVER_WAITING_STATUSES` therefore remains at `apps/wordnew/components/admin/WfNewAdminLibraries.tsx:59`, used at `:210`.
- What the wordnew side needs from the shared presenter, based on `WfNewAdminLibraries.coverBadge` at `:194-214`:
  - the waiting set `pending`, `retry`, `processing` (matched on `LibraryCoverView.coverStatus`);
  - a badge kind with precedence `active` (queued, or processing with an optional handler) > `failed` (`coverStatus === 'failed'` or `phase === 'failed'`, title `taskError || errorMessage`) > `waiting` > none.
  - wordnew keeps its own tone classes and i18n keys (`admin.lib.cover.*`).
- Once MCHR-31 lands, the change here is small: import the set or presenter from `shared/library-cover`, delete line 59, and re-run the tsc check plus `grep -rn COVER_WAITING_STATUSES apps/wordnew` (must be empty).

### Cross-scope notes

- ui-pycore-manager (MCHR-31): see the presenter shape above. `apps/laravel-manager/components/views/task-center/CoverStatusCard.tsx:38-45` (`QUEUE_CHIP_ORDER`) is a stats chip order, not the waiting set. Owner: ui-laravel-manager.
- Shared-layer random-id duplicates outside my assignment (each needs an assigned B2 writer to switch to `createIdempotencyKey`): `core/network/ProtocolFetch.ts:140`, `core/integrations/pycore/PycoreClient.ts:251`, `core/integrations/pycore/PycoreLaravelRelayTransport.ts:162`.
- Follow-up candidates inside wordnew, left untouched because they are not in this batch: `apps/wordnew/services/WordNewRecitationCenter.ts:34-40` (its own idempotency-key generator, a direct duplicate of `createIdempotencyKey`), `WordNewSentenceWordTable.ts:80`, `utils/WordNewClientIdentity.ts:37`, `components/daily-reading/DailyReadingPlaybackModel.ts:81`.
- Orchestrator: the `lint` script cannot resolve `tsc` under bun on Windows. The root `package.json` belongs to the shared layer, so any script change (for example `bun x tsc --noEmit`) needs an assigned writer. No service restart is needed for either item.

### Status / blockers / next owner

- CKA-12: in progress until the reviewer writes `.claude/agents_shared/reviews/<task_id>.json` with `"verdict": "approved"`. Next owner: reviewer.
- MCHR-31-wn: blocked on ui-pycore-manager MCHR-31. Next owner: ui-pycore-manager, then ui-wordnew.
