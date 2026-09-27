# wordnew-ui report

## wordnew-ui-G1

Status: done. Waiting for wordnew-lead's verdict at `.claude/agents_shared/reviews/wordnew-ui-G1.json`.
Changed files (working tree against HEAD 8f95a2a24; UI root `poly_apps/pycore_laravel_wordnew_ui`):
- `apps/wordnew/services/WordNewRecitationCenter.ts` (+2/-13)
- `apps/wordnew/components/admin/WfNewAdminLibraries.tsx` (+2/-2)

### CKA-12: done, no change

- `reviews/ui-wordnew-D7.json` is `"verdict": "approved"`, with `issues: []`. As the item says, nothing in `core/network/api-client/` changed.
- I used the B2 temporary writer role for `core/network/api-client/` for reading only. The claude lead still has to confirm the succession (see Cross-scope below).
- Verification:
  - `function createIdempotencyKey` is defined once, at `core/integrations/laravel/transport/BaseAPI.ts:21`. It is used at `MasterApiClient.ts:49,423` and `RequestQueue.ts:23,100`, plus the existing uses in codemart, laravel-manager and now wordnew.
  - `generateEntryId|randomUUID|Math.random` under `core/network/api-client/`: 0 hits. `generateEntryId` in core, apps, shared and src: 0 hits.
  - `git status` and `git diff HEAD` for `core/network/api-client/`: empty, so this item added no hunks. The diff against 74e7770 is still the approved D1 and D7 work: MasterApiClient +/-120, RequestQueue +/-27.
  - Byte scan: `MasterApiClient.ts` has LF-only lines [47, 48, 49, 365, 366, 367], unchanged. `RequestQueue.ts` has 0 LF-only lines.
  - tsc: see the shared run below. It found 0 `error TS` under `core/network/api-client/`.

### CKA-12-wn: done

- `WordNewRecitationCenter.ts`:
  - It now imports `createIdempotencyKey` from `../../../core/integrations/laravel/transport/BaseAPI` (:29), the same import path codemart uses.
  - I removed the local `newBatchId` generator (crypto.randomUUID with a Math.random fallback, old :34-44).
  - `sessionId` (:49) and the per-flush `batch_id` (:148) now call `createIdempotencyKey()`.
  - The values are UUIDs or 32 hex characters. That fits the Laravel `session_id|batch_id max:64` validation in `AppQyV1DailyRecitationController.php:72-73`.
- Static read of the flush path, one key per flush:
  1. `doFlush` makes one `wfNewApi.recitationLog({batch_id: createIdempotencyKey()})` call.
  2. That goes through `authedQueueablePostJSON`, then `queueablePostJSON`, then `WfNewQueuedTransport` (which extends `MasterApiClient`) `.request(..., {queueable: true})`.
  3. `withIdempotencyKey` (`MasterApiClient.ts:417-426`) mints one `Idempotency-Key` header for each request, using the same shared `createIdempotencyKey`.
  4. On a network failure, `enqueueFailedWrite` stores that header and the body, including `batch_id`. A replay therefore resends the same header and the same `batch_id`.
- The other two files did not change, and I recorded why:
  - `WordNewSentenceWordTable.ts:77-85` `clientKey()` is a persistent per-device `client_key` body field, stored under `WORDNEW_SENTENCE_WORD_CLIENT_KEY` and sent on every sentence-words call. It is not an Idempotency-Key.
  - `DailyReadingPlaybackModel.ts:79-85` `createDailyReadingStepId()` builds local playback-step ids, used only in `WordNewDailyReadingPlayerOverlay.tsx:286,300`. They are never sent as a key.
- Verification:
  - grep `randomUUID|Math.random` in `WordNewRecitationCenter.ts`: 0 hits.
  - `createIdempotencyKey` is imported at :29.
  - The file is still all CRLF (250 lines, 0 LF-only).
- Non-blocking note: the `batch_id` in the body and the `Idempotency-Key` header are two separate keys, each minted once per flush. Both stay stable across replay, and the controller dedupes on `batch_id`. Making them one value would need a header parameter on `WfNewApiTransport.queueablePostJSON`. That file is outside this item's file list, so I left it alone (the recommended minimal-scope option).

### MCHR-31-wn-set: done

- `WfNewAdminLibraries.tsx`:
  - It imports `LIBRARY_COVER_WAITING_STATUSES` from `shared/library-cover/LibraryCoverTaskModel` (:35).
  - I deleted the local `COVER_WAITING_STATUSES` array (old :59).
  - `coverBadge` now uses `LIBRARY_COVER_WAITING_STATUSES.has(cover.coverStatus)` (:210).
- The badge precedence (active, then failed, then waiting) and the `admin.lib.cover.*` keys are unchanged.
- The shared set is {pending, retry, processing}, the same as the removed array, so the pending badge still shows for all three statuses.
- I did not touch `apps/wordnew/locales/*_b.ts` or any WNL-01 file.
- Verification:
  - `grep -rnw COVER_WAITING_STATUSES apps/wordnew`: 0 hits.
  - The file is still all LF (417 lines, 0 CRLF), with mode 100755.
- Deferred (second half of MCHR-31-wn): moving the `coverBadge` precedence to a shared presenter. That waits until ui-pycore-manager, the B2 writer of `shared/library-cover/`, adds one.

### Shared verification

- Free RAM was 5.96 GB, above the 3 GB guard.
- `bun node_modules/typescript/bin/tsc --noEmit` in the UI root exited 0 in about 29 s, with 0 `error TS` in total: 0 under `apps/wordnew/` and 0 under `core/network/api-client/`.
- I made no Laravel change, so no worker restart was needed. I added no tests and ran no git write.

### Cross-scope

- For the claude lead: please confirm that wordnew-ui succeeds ui-wordnew as the B2 temporary writer of `core/network/api-client/`. This run needed no write there.
- Still open from the D7 verdict, outside my scope:
  - `core/network/ProtocolFetch.ts:140-141` (writer to be assigned by the orchestrator);
  - `core/integrations/pycore/{PycoreClient.ts:251-252,PycoreLaravelRelayTransport.ts:166-167}` (ui-pycore-manager / pycore-ui);
  - the root `package.json` `lint` script on Windows (B2 writer to be assigned).

Blockers: none. Next owner: wordnew-lead, for the verdict.

## wordnew-ui-G2

Status: blocked (gate not met). Changed files: none, except this report.

### MCHR-31-wn-presenter: blocked

- Gate: pycore-lead must approve pycore-ui MCHR-31, which adds the cover presenter in `shared/library-cover`. The gate was checked after G1 ended (`reviews/wordnew-ui-G1.json` approved at 20:15:50) and it is not met:
  - `reviews/` has no `pycore-ui*` verdict, and `reports/` has no pycore-ui report.
  - `shared/library-cover/` holds only `LibraryCoverTaskModel.ts` (mtime 17:31). That file exports `LIBRARY_COVER_STATUS`, `LIBRARY_COVER_WAITING_STATUSES`, `libraryCoverView` and the task model, but no presenter that returns a kind (active, failed, waiting or none, plus the handler). A grep for `present|coverBadge` under `shared/` finds only an unrelated comment at `shared/notify/notify.tsx:194`.
  - `reports/pycore-lead.md:48` and `reviews/ui-pycore-manager-D7.json:34` both still say MCHR-31 is only started, with no presenter and no adoption.
- Action: none. The item forbids copying the presenter logic into wordnew, so I stopped as instructed. `WfNewAdminLibraries.tsx` is unchanged. `coverBadge` is still at :194-214 with its own precedence (active, then failed at :203, then waiting at :210 through the shared set).
- Verification: none run. There was no code change, so tsc was not needed.
- Carry-over for the unblocked run (from the G1 verdict's non-blocking notes): once the presenter exists, the literal `'failed'` at :203 goes away with the local precedence. The mapping must keep `admin.lib.cover.{queued,processing,processingBy,handler.*,failed,pending}` and the failed title `taskError || errorMessage`.

### Cross-scope

- pycore-ui (through pycore-lead): MCHR-31 needs to add the presenter to `shared/library-cover` and get it approved. Suggested shape: `libraryCoverPresentation(view: LibraryCoverView)`, returning `{ kind: 'active' | 'failed' | 'waiting' | 'none', phase, handler, title }`. That is enough for wordnew to map the result only to its tones and its `admin.lib.cover.*` keys.

Blockers: pycore-ui MCHR-31 (presenter not landed or approved). Next owner: pycore-ui, then pycore-lead for the verdict, then wordnew-ui re-runs MCHR-31-wn-presenter.
