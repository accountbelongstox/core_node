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

## Session resume (2026-09-28)

Resumed after a claude.ai usage-limit reset with no in-flight task. Verified before going idle:
- `.claude/agents_shared/reviews/ui-wordnew-D7.json` is `"verdict": "approved"` (CKA-12 confirmed). `git status` for `core/network/api-client/` is clean.
- MCHR-31-wn (the item deferred above) is no longer open: `.claude/agents_shared/reports/wordnew-ui.md` (wordnew-ui-G1) shows it adopted `LIBRARY_COVER_WAITING_STATUSES` from `shared/library-cover/LibraryCoverTaskModel.ts` into `apps/wordnew/components/admin/WfNewAdminLibraries.tsx`, and the current file (`:35`, `:210`) confirms it. The remaining half (shared cover presenter) is tracked as MCHR-31-wn-presenter in `wordnew-ui.md`'s G2 section, blocked on pycore-ui MCHR-31 — not this role's open item.
- `git status --short` for `apps/wordnew/`, `flavors/wordnew/` and `native/wordnew/` is clean; nothing to resume or repeat.
- Noted a live duplicate: session `ct-wordnew-ui` (role name `wordnew-ui`) covers the identical write scope and already completed G1/G2, itself reporting idle after the same reset. `.claude/agents_shared/reviews/ui-wordnew-D7.json` notes `"role": "ui-wordnew (now wordnew-ui)"`, i.e. wordnew-ui looks like the intended successor name for this role.
- Notified `ca-orchestrator` and `ct-wordnew-lead` that I'm back, idle, and flagged the ui-wordnew/wordnew-ui duplication so new tasks aren't double-assigned; recommended routing new work to wordnew-ui unless told otherwise.

Blockers: none of my own. Next owner: whichever of ca-orchestrator / ct-wordnew-lead assigns the next task, or confirms which of ui-wordnew / wordnew-ui stays canonical.

### Ruling (wordnew-lead, 2026-09-28)

`ct-wordnew-lead` confirmed: under the D22 map, `wordnew-ui` (session `ct-wordnew-ui`) is the sole writer for `apps/wordnew` and `flavors/wordnew`; `native/wordnew` belongs to `wordnew-native`. This role (`ui-wordnew`) stays idle and writes nothing in those paths unless `ca-orchestrator` assigns a task directly. Acknowledged back to wordnew-lead.

Blockers: none. Next owner: ca-orchestrator (only source of a direct task for this role while the D22 map stands).

### Ruling R2 (ca-orchestrator, docs_fix/DESIGN_CLAUDE_TEAM.md, 2026-09-28)

Confirmed by `ca-orchestrator`: R2 makes the D22 roster member the default writer for any path also covered by a pre-D22 alias session, with the explicit map `ui-wordnew` → `wordnew-ui`. This alias session (`ui-wordnew`) writes `apps/wordnew`/`flavors/wordnew` only when a task explicitly names it as temporary writer; otherwise stays in reserve. Acknowledged back to ca-orchestrator.

Blockers: none. Next owner: ca-orchestrator, only if a task names ui-wordnew directly.
