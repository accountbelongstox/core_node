# wordnew report — client key auth and audit fixes (2026-09-27)

No TaskCreate/TaskUpdate tool is available in this session, so task ids follow the team convention `wordnew-<n>` (mirrored by the orchestrator on TASKS.md).

## Tasks

| Task | Findings | Status |
|---|---|---|
| wordnew-1 | FU-031 (offline queue owner scope, logout clear, replay idempotency key) | approved (after one fix: duplicate header constant replaced by BaseAPI.IDEMPOTENCY_KEY_HEADER) |
| wordnew-2 | FU-008, FU-009, FU-023 (playback / reader races) | approved |
| wordnew-3 | FU-019, FU-032, FU-042 (wordnew part) | approved |
| wordnew-4 | adapt to laravel's route table | approved |
| wordnew-5 | pre-existing wordnew compile errors: undeclared names in platform capabilities (ReferenceError at runtime), WfNewBookReader PlayBar props, WfNewBottomDock tab type | approved |

## Findings

- FU-008 fixed. `WordNewBookReaderPlayback`: after `resolveAudioUrl` a paused engine arms the clip (`src` set, handlers wired) but does not play it; a step that returns at a pause with nothing waiting is parked and `resume()` re-runs it. `resume()` plays the audio element only when it holds the current step's clip (`clipArmed`), so it never replays a stale ended clip.
- FU-009 fixed. `useOrchAudioPlayback`: a jump sequence ref is bumped by every playback command (segment/sentence play, play/pause, stop, next/prev, mode change) and by the engine effect cleanup; a segment jump whose page fetch resolves later, or after unmount/detail change, is dropped. The jump also plays only on the engine instance it started with.
- FU-023 fixed. `WfNewBookReader.loadVerses` applies only the newest load (sequence ref; stale loads return `[]` and do not touch `loadingVerses`); the book effect invalidates in-flight loads, loads progress once (shared promise, a progress failure no longer forces the flat layout) and checks `cancelled` after it. `WfNewApp` keys the reader by `sourceKey`.
- FU-019 fixed. `wfNewEndpoints.setEndpoint` (blind pin) is replaced by `switchEndpoint`, which calls `apiManager.switchEndpoint` (probe first, mixed-content aware, pins only a reachable endpoint). The dialog disables the Use buttons while a switch runs and toasts success or the probe error (`api.toastSwitched`, `api.toastSwitchFailed`; the unused `api.toastSelected` is removed, en/zh/ja/ko).
- FU-032 fixed. `getWordAudio` reads through the new `getFreshJSON` (public GET with `cacheMode: 'network'`), so the word-audio wait never answers from the 15-minute local mirror and the non-passive first request always reaches Laravel (its enqueue side effect).
- FU-042 (wordnew part) fixed. `WfNewQueuedTransport.queuedMessage()` returns `translateActive('api.queuedOffline')` (en/zh/ja/ko). `translateActive` in `WfNewLocales.ts` resolves the shell language from `<html lang>`, which `ShellProvider` keeps in sync.
- Route table (wordnew-4). wordnew end-user calls stay Sanctum or public: `app_qy_v1/*` auth, user, words, orch_audio (Sanctum), `word/audio/head`, `tts/sentence/audio/head`, media and vocabulary reads (public). `/api/user/change-password` becomes `dashboard.auth:user`, which accepts the wordnew Sanctum Bearer. wordnew never signs and never holds the client key. The super-admin gateway (`WfNewAdminApi`) now meets `dashboard.auth` admin (dictionary word writes/batch), `client.key_or_dashboard` (cover tasks, translation enqueue-pending) and `dashboard.auth:user` (tts generate): the new `adminErrorText` maps 401 → `admin.needLogin`, 403 → `admin.needAdmin`, else the backend message or `admin.requestFailed`, replacing 10 duplicated handlers that hardcoded `'Request failed'` in 5 admin components. The stale "public" auth notes in `WfNewAdminApi`/`WfNewAdminPaths` were corrected.
- FU-031 fixed (wordnew-1).
  - Owner scope = `scopeFor(authToken)` from `WfNewServerMirror` (`user-<stableHash(token)>` or `public`), the same scope the local resource mirror already uses. The wordnew `userId` setting was not used: it can desync from the shared AuthSession token when another app changes the login, and the token is the credential the replay actually sends.
  - `MasterApiClient`: `resolveQueueOwner()` hook; entries store `owner`; the drain replays only the live owner's entries (FIFO per owner) and holds the rest until they age out (24 h); `send()` refuses delivery with `QueueOwnerChangedError` when the live owner changed after the write started (first send: rejected, not queued; drain: paused, entry kept); `clearQueue()`.
  - wordnew `logout()` clears the queue before the server revoke. Session expiry (401) and a login change from another app hold the entries instead.
  - Known trade-off (reviewer, non-blocking): with a token-hash owner, a user who logs in again after the session expired cannot replay writes queued under the old token; they are pruned after 24 h. No stable user id travels with the shared AuthSession token (it stores the token only), and wordnew's `userId` setting can belong to a different login than the token, so it is not safe as the owner. A stable owner would need the shared AuthSession to store the user id with the token (shared-layer change, not requested).
  - `RequestQueue`: `owner: string | null` on every entry; the dedupe key is endpoint + method + body + owner; `generateEntryId` exported (reused for the idempotency key).
  - **Rule for entries stored before this change (no `owner` field): dropped on load.** `isValidEntry` requires `owner` to be a string or null, so the load prune removes them and re-persists the queue. They cannot be attributed to a session, so they are never replayed.
  - Replay dedupe: every queueable write carries `Idempotency-Key` (the shared `IDEMPOTENCY_KEY_HEADER` from `core/integrations/laravel/transport/BaseAPI.ts`, no copy; server side `CodeMartV1Constants::IDEMPOTENCY_HEADER`) from its first send; the persisted entry keeps it for replays. `laravel` implemented the server side: the three routes run a given (user, method, path, key) once; a repeat returns the stored response with `Idempotent-Replayed: true`, or 409 `IDEMPOTENCY_IN_PROGRESS` while the first run is still going. Client compatibility, checked without code change: the key is created at the first send (earlier than "first enqueue", so a lost first response is also covered) and persisted for every replay; a replayed 2xx removes the entry; a 409 in-progress answer drops the entry, which leaves the outcome to the first run that already reached the server. Laravel CORS allows all headers.

- wordnew-5 (orchestrator-assigned, from the tsc run; 22 errors under apps/wordnew → 0).
  - Undeclared names now import the existing definitions (no copies): `CapGeolocationGeofencing` ← `DEG2RAD`, `EARTH_RADIUS_M` (now exported from `CapGeolocationCore`); `CapNetworkReachability` ← `connectionGlyph`, `describeConnectionType` (`CapNetworkCore`); `CapAutoStore` ← `applyQuery` (`CapDatabase`); `CapDatabaseBackends` ← type `CapDbBackendKind` (`CapDatabase`, type-only, no runtime cycle).
  - `WfNewBookReader` now passes every `WordNewBookReaderPlayBar` prop. Before, the prev/next sentence and page buttons called undefined handlers. Prev/next sentence → `playback.stepSentence(±1)` (buttons enabled only while playing); prev/next page loads page ±1 of the current chapter and keeps playing from its first sentence if it was playing; `canPrevPage/canNextPage` from page/lastPage; `progressText` = `reader.progress` (pos/total · pct of the loaded page); `todayCount` = new local-day counter `wordNewReadingProgressCenter.readToday()/markReadToday()` (storage key `WORDNEW_READING_TODAY`), bumped on each sentence the engine starts (`onProgress`). New keys `reader.prevSentence`, `reader.nextSentence`, `reader.progress`, `reader.todayRead` (en/zh/ja/ko; the last three were missing everywhere, so the PlayBar showed raw keys).
  - The two identical private `localDateKey` copies (`WfNewStudyProgress`, `WordNewRecitationCenter`) moved to one export in `utils/WordNewTimeFormat.ts`, reused by the new counter.
  - `WfNewBottomDock` props take `WordNewTab` (the chrome passes every tab; type-only).

## Changed files

- `poly_apps/pycore_laravel_wordnew_ui/core/network/api-client/MasterApiClient.ts`, `RequestQueue.ts` (B2 temporary writer; `index.ts` unchanged)
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/WfNewApp.tsx`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/WfNewLocales.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/api/WfNewApiHttp.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/api/WfNewApiTransport.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/api/WfNewEndpoints.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/components/WfNewApiServerDialog.tsx`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/components/orch-audio/useOrchAudioPlayback.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/locales/{en,zh,ja,ko}_b.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/pages/WfNewBookReader.tsx`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/runtime-store/WfNewServerMirror.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/services/WordNewBookReaderPlayback.ts`
- wordnew-5: `apps/wordnew/platform/capabilities/{CapGeolocationCore,CapGeolocationGeofencing,CapNetworkReachability,CapAutoStore,CapDatabaseBackends}.ts`, `apps/wordnew/pages/WfNewBookReader.tsx`, `apps/wordnew/services/{WordNewReadingProgressCenter,WordNewRecitationCenter}.ts`, `apps/wordnew/components/study/WfNewStudyProgress.ts`, `apps/wordnew/utils/WordNewTimeFormat.ts`, `apps/wordnew/persistence/WordNewStorageKeys.ts`, `apps/wordnew/components/WfNewBottomDock.tsx`, `apps/wordnew/locales/{en_b,zh_b,ja_a,ko_a}.ts`
- wordnew-4: `apps/wordnew/api/{WfNewAdminApi,WfNewApiPaths,index}.ts`, `apps/wordnew/components/admin/{WfNewAdminLibraries,WfNewAdminOverview,WfNewAdminQueues,WfNewAdminTranslate,WfNewAdminWords}.tsx`, `apps/wordnew/locales/{en,zh,ja,ko}_a.ts`

## Static checks

`node_modules/.bin/tsc --noEmit -p tsconfig.json` (tsconfig has `noEmit`, no incremental output). Errors under `apps/wordnew` and `core/network/api-client`: 0 (was 22 pre-existing under apps/wordnew; wordnew-5 fixed them). The remaining project errors belong to other apps. Line endings of every changed file match HEAD (CRLF/LF/mixed preserved).

## Blockers

- none. Server-side dedupe of `Idempotency-Key` is done by laravel.

## Next owner

none — all wordnew tasks (1–5) approved; the laravel server dedupe is in place.
