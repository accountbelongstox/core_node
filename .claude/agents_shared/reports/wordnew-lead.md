# wordnew-lead report

## Review ui-wordnew-D7 (done_before_outage_unreviewed)

- Verdict: approved. File: `.claude/agents_shared/reviews/ui-wordnew-D7.json`.
- CKA-12 is confirmed. Its hunks are f4f223414..5bbb23682:
  - `MasterApiClient.ts` +3/-3 (:47, :49, :423);
  - `RequestQueue.ts` +3/-8 (:23-24, :100, and the generator removed).
- The six LF-only lines in `MasterApiClient.ts` (47-49, 365-367) are the same in D1, HEAD and the working tree.
- The import-cycle claim holds: the BaseAPI closure has 17 modules and none is under api-client.
- The grep finds one generator.
- tsc: `bun node_modules/typescript/bin/tsc --noEmit` exits 0 with 0 errors (free RAM 6.49 GB).
- `core/network/api-client/` is released for wordnew-ui-G1.
- MCHR-31-wn had no change and is re-planned:
  - `LIBRARY_COVER_WAITING_STATUSES` exists at `shared/library-cover/LibraryCoverTaskModel.ts:31-35`, but there is no presenter yet;
  - `WfNewAdminLibraries.tsx:59` and `:210` can adopt the set now, and the presenter after ui-pycore-manager adds it.
- Changed files (mine): the verdict file and this report.
- Non-blocking follow-ups for the orchestrator:
  - Generator duplicates in `core/network/ProtocolFetch.ts:140` and in `core/integrations/pycore/{PycoreClient.ts:251,PycoreLaravelRelayTransport.ts:166}` (writer: ui-pycore-manager).
  - `apps/wordnew/services/WordNewRecitationCenter.ts:34-40` (writer: wordnew-ui).
  - `bun run lint` on Windows fails with "command not found: tsc", and the root package.json needs an assigned writer to fix it.
- Blockers: none. Next owner: wordnew-ui (G1, and MCHR-31-wn after the re-plan).

## Review mcp-chrome-D7 (CKA-01 partial, found on disk)

- Verdict: approved, covering only the pre-outage CKA-01 part. File: `.claude/agents_shared/reviews/mcp-chrome-D7.json`.
- `app/native-server/package.json`: git diff 74e7770 is -1 line (`@fastify/cors`). The file stays LF with mode 100755, and it is in HEAD through 5bbb23682. `src/` has no cors reference.
- `bun.lock` and `pnpm-lock.yaml` have 0 `fastify/cors` hits. All 6 bun.lock workspaces equal their package.json files. Both lockfiles are git-ignored.
- Decision on `pnpm-workspace.yaml`: keep the deletion (recommended option). Reasons:
  - the file is absent at 74e7770, and it was deleted on purpose in f853d9489 (the bun migration);
  - the member re-created it only so pnpm could regenerate its lock, whose importers match it exactly;
  - the user's sweep commits added it (b20962b4f) and deleted it again (120296148), so there is no net diff against 74e7770;
  - no restore was needed and no file was written.
- Still open for wordnew-link-G2:
  - the CKA-01 build. The stamp and all dist folders are from 03:13, and the stale native dist still requires `@fastify/cors` and has no K7 guard, so the rebuild is needed before any install prunes the link;
  - MCHR-05/15/32/33/36/37/43/45 (not started).
- Environment note for G2: Windows `tsc --noEmit` in native-server hits TS2688 (node/jest types) through the node_modules links. This predates the change. If the build hits it, use the Debian WSL.
- Changed files (mine): the verdict file and this report section.
- Blockers: none. Next owner: wordnew-link (G2, CKA-01 build onward).

## Review wordnew-ui-G1 (round 1)

- Verdict: approved, with issues []. File: `.claude/agents_shared/reviews/wordnew-ui-G1.json`.
- CKA-12: no change, as required, because ui-wordnew-D7 was approved. api-client has no working-tree diff, and the MasterApiClient LF-only lines [47-49, 365-367] are intact.
- CKA-12-wn: `WordNewRecitationCenter.ts` +2/-13. It now uses the shared `createIdempotencyKey` for batch_id (:148) and sessionId (:49), and the local generator is gone. The flush path sends one request per flush, with the header minted by `MasterApiClient.ts:423` and persisted for replay. The file is still all CRLF.
- MCHR-31-wn-set: `WfNewAdminLibraries.tsx` +2/-2. It uses `LIBRARY_COVER_WAITING_STATUSES.has` (:210), and the precedence and keys are unchanged. The file is still all LF.
- Checks: tsc exited 0 with 0 errors (free RAM 6.16 GB, 28 s). The verify greps return 0 or a single definition. The changes stay in scope, and there were no git writes or Laravel changes.
- Changed files (mine): the verdict file and this report section.
- Open for the orchestrator:
  - confirm the B2 succession of `core/network/api-client/` to wordnew-ui;
  - assign writers for the `ProtocolFetch.ts:140-141` and pycore generator copies, and for the root package.json lint script on Windows.
  - The second half of MCHR-31-wn waits for the ui-pycore-manager shared presenter.
- Blockers: none. Next owner: orchestrator (the confirmations above); wordnew-ui (MCHR-31-wn second half, once the presenter exists).

## Review wordnew-ui-G2 (round 1)

- Verdict: approved, with issues []. File: `.claude/agents_shared/reviews/wordnew-ui-G2.json`. The approval covers only a correct block-and-stop. MCHR-31-wn-presenter is not delivered and stays open.
- Decision (recommended option): I chose approved over changes_requested. The item orders "report blocked and stop" when the gate is closed at the end of G1, the member did exactly that, and a round 2 has nothing to fix while the gate stays closed.
- Gate check (I tried to refute the block and could not):
  - `reviews/` has no pycore-ui* verdict;
  - `shared/library-cover/` has only `LibraryCoverTaskModel.ts` (17:31, clean), and it exports no presenter;
  - a grep of the UI tree for a presenter finds nothing;
  - pycore-lead.md:48 and ui-pycore-manager-D7.json:34 both still say MCHR-31 is only started.
- No copy into wordnew: the `WfNewAdminLibraries.tsx` mtime (20:09:49) is before the G1 verdict, and the file is still +2/-2 against HEAD. Nothing in the wordnew-ui scope or under `shared/` is newer than the G1 verdict. tsc was not re-run because no code changed.
- Changed files (mine): the verdict file and this report section.
- Blockers: pycore-ui MCHR-31, which needs the presenter in `shared/library-cover` and pycore-lead's approval. The member's suggested shape is in the verdict's non_blocking notes.
- Next owner: pycore-ui (through pycore-lead/orchestrator), then wordnew-ui re-runs MCHR-31-wn-presenter.

## Review wordnew-laravel-G1 (round 1)

- Verdict: changes_requested. File: `.claude/agents_shared/reviews/wordnew-laravel-G1.json`.
- Confirmed by re-running the member's verify scripts:
  - srv-07 (no change needed);
  - srv-07b (ensure-only variant seed; operator edits survive; one primary per language);
  - LDRI-32 (one `segmentAudioPath` body);
  - LDRI-28 (`recordStaticPath` on every AppQyV1 static store; no-op without phpredis);
  - MCHR-27 (0 writes on both library list GETs; shape unchanged).
- Round 2:
  - (1) LDRI-22: `batchExpired` keeps processing batches forever, so an abandoned batch leaks its content (up to 32 MB). Expire it once its stored `updated_at` is past retention, and keep the API `purgeExpired(): int`.
  - (2) MCHR-27b, leader-added: `AppQyV1VocabularyRecommendationController::coverImageUrl` should call `versionedCoverUrl`. It is a list GET that still runs one UPDATE per row.
  - (3) Correct the member's CRLF claim in the report and memory. All 13 files are LF (`git ls-files --eol`).
- Decision (recommended option): purge abandoned processing batches instead of resuming them inside purge. Pycore's diff delivery re-sends items that are still missing, and purge stays cheap on the `register()` path.
- Open for a ruling (non-blocking): the srv-07b seed re-inserts a default voice that an operator removed through `replaceForLanguage`. A per-language ensure would respect removals.
- Cross-scope (to pycore-laravel via the orchestrator):
  - the FileSystemManager Windows delete (its owner already has `deleteNative` in the working tree) and rename;
  - MoviePosterStore/WordGeminiImageTaskProcessor index hooks;
  - the stale comments in `AppQyV1CoverGenerationTask`;
  - LDRI-22-timer uses `purgeExpired(): int`.
- Changed files (mine): the verdict file and this report section.
- Next owner: wordnew-laravel (G1 round 2).
