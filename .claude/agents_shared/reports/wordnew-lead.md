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

## Review wordnew-laravel-G1 (round 2)

- Verdict: approved, with issues []. File: `.claude/agents_shared/reviews/wordnew-laravel-G1.json`.
- The round 2 hunks are in the user's sweep commit `0b6f362e3`, and the working tree is clean for the G1 files.
- LDRI-22: `batchExpired` is now `return $state === null || (int) ($state['updated_at'] ?? 0) < $cutoff;`. The API is unchanged: `public function purgeExpired(): int`. I re-ran `purge_verify.php` natively (`deleteNative` is now in HEAD): it returned 4, then 0. The idle processing batch was removed, and the fresh processing batch was kept.
- MCHR-27b: `coverImageUrl` now returns `versionedCoverUrl($library)`. Both recommendation list GETs make 0 writes, and image_url is identical for 8/8 and 6/6 rows. No path under app/ calls `getCoverData` now. That is safe: both listings are public-only, `seedMissingCovers` covers lazy init, and the claim order is `cover_last_requested_at` ascending.
- Report and memory: the text now says LF (`.gitattributes eol=lf`). No file was converted.
- Checks: php -l passes on 4 files, and `route:list --path=app_qy_v1` shows 329 routes. Live, /api/health, recommendations and libraries all returned 200. Free RAM was 3.68 GB.
- Non-blocking:
  - the member's report and memory still say `deleteNative` and the round 1 changes are uncommitted, and that delete is sudo-rm only;
  - carried from round 1: the srv-07b per-language ensure ruling and LDRI-28 risk (a).
- Cross-scope (to pycore-laravel via the orchestrator):
  - LDRI-22-timer uses `purgeExpired(): int`;
  - the MoviePosterStore/WordGeminiImageTaskProcessor index hooks;
  - the stale `AppQyV1CoverGenerationTask` comments;
  - `rename()` is still sudo-only.
- Changed files (mine): the verdict file and this report section.
- Blockers: none. Next owner: orchestrator (G1 is complete; route the cross-scope items and the srv-07b ruling).

## Review wordnew-native-G1 (round 1)

- Verdict: approved, with issues []. File: `.claude/agents_shared/reviews/wordnew-native-G1.json`. Rewritten after an independent re-review at 21:19; it replaces the 20:52 write.
- WNN-01 (audit) is confirmed. Every file:line spot-check held, and the proposed `.gitignore` negation works in a scratch repo that carries the real rules.
- `app/build.gradle` is +29/-2 against 74e7770 (CRLF, 100755), and it is in HEAD through 2f31f9cd3.
- The build_apk.py halves of WNN-02/03/04 are a verified handoff diff (no B2 writer exists), which is the outcome the task foresaw. I re-ran them:
  - `git apply --check` passes, and the result has sha256 7681c09e and passes py_compile on Windows and Debian;
  - a release build without secrets exits 2 before any command, on both OSes;
  - the throwaway PKCS12/JKS signing flow works;
  - the wrapper repair is byte-identical and idempotent;
  - `--version-info` prints 1.0.0/1000000;
  - a lead Gradle re-run (offline, 4.2 GB free) shows release signing and the version only when all four values and the -P properties are present.
- Decision (recommended option): I chose approved over changes_requested. The remaining points are non-blocking, and none of them breaks a verify step:
  - truncated JKS is accepted;
  - the Windows decrypt-step wording;
  - the shallow `--root` IndexError;
  - the daemon env hardening.
- Interim gap (urgent): until the diff lands, APKs have no versionCode. The orchestrator should assign the B2 writer for `UI/scripts/flavor/build_apk.py` now; my recommendation is wordnew-native, with pycore-ui as the fallback, applying with `git apply`.
- Hygiene: a stray `D:\d\.tmp\...\scratchpad\pc0..pc8.pyc` (20:10, not attributable to this task) comes from an MSYS `/d/` path that native Python resolved to `D:\d\`. I made the same slip and removed only my own two files; deleting the rest needs its owner or the user.
- Changed files (mine): the verdict file and this report section.
- Blockers: none for the member. Next owners:
  - orchestrator: the build_apk.py B2 writer, the root `.gitignore` writer (WNN-03-commit), and the F3/F4 writers;
  - wordnew-native: F1 buildToolsVersion;
  - user: WNN-signing-key and F2.

## Review wordnew-link-G1 (round 1)

- Verdict: approved, with issues []. File: `.claude/agents_shared/reviews/wordnew-link-G1.json`.
- Items MCHR-15, MCHR-05 (with MCHR-44), MCHR-32, MCHR-33, MCHR-36 and MCHR-37 are all confirmed against 74e7770..HEAD. Every G1 file is already in HEAD through the user's sweep commits.
- Re-run checks:
  - PowerShell Parser on start.ps1: 0 errors.
  - py_compile passes.
  - In-process checks confirm owner tracking and `--wake` gating.
  - node smoke test of native-host-common.cjs on Windows and Debian: paths and registry keys match the removed TS table.
  - tsc 7 and vue-tsc 5 errors, both the stale-shared-dist baseline. They ran in Debian WSL with the scratchpad node v22.20.0, at 4.78 GB free.
  - The locale JSON and keys check passes.
  - Line endings are kept.
- Decision (recommended option): I chose approved over changes_requested. None of the non-blocking points breaks a verify step:
  - the utils.ts:246 summary prints the manifest path as the error;
  - English Gemini busy and abandoned errors reach the popup;
  - a rare repoint-during-start race in Bing;
  - the queue-diff GETs keep running during a Bing outage;
  - the kernel32 re-creation nit.
- Changed files (mine): the verdict file and this report section.
- Blockers: none. Next owners:
  - user: MCHR-05-live;
  - orchestrator: the G2 CKA-01 shared dist rebuild;
  - wordnew-link (optional follow-ups): the non-blocking list in the verdict file.

## Review wordnew-laravel-G2 (round 1)

- Verdict: approved, with issues []. File: `.claude/agents_shared/reviews/wordnew-laravel-G2.json`.
- Items: AOQSD-09, MCHR-21, LDRI-29, CKA-26a and CKA-26b are all confirmed. All 33 files are in the user's sweep commit `ab566fdf7`, and no other G2 hunk exists since 74e7770.
- Gate decision (recommended option): I accepted the member's reading that the AOQSD-09 lang temporary-writer gate is cleared. The basis is B13 (merge_meta.json:184, app_qy_v1 lang → laravel-qyapp), superseded by B14 with wordnew-laravel as the successor. The claude lead still has to confirm the hand-back of `lang/{en,zh_CN}/app_qy_v1.php` to pycore-laravel.
- Re-run checks (5.35 GB free RAM):
  - php -l passes on 31 files, and the static AST parse passes on the 2 files with a rule header.
  - The audit scan finds 0 on the G2 paths. At 74e7770, Utils had 80 and the controllers plus middleware had 102.
  - keys_verify and my own param_check pass. param_check covers 203 `__()` calls, and in each one the parameters equal the placeholders in en and zh_CN.
  - http_verify: ALL PASS.
  - resource-index status exits 0 with one marker, and invalid input exits 2.
  - route:list shows 329 routes.
  - Live :9000: health returned 200, and without_audio, cover/tasks and login returned localized 422 responses.
  - All files are LF.
- Non-blocking:
  - the old concatenation key `validation_failed` (9 callers) overlaps with the new `sentence_audio_validation_failed` and `validation_failed_generic`, and zh now uses two terms for it;
  - a second private `validationFailed` wrapper exists (after OrchAudioCtl);
  - the ImageFileProcessor 20 MB limit is repeated;
  - the deferred display texts and the 140-hit remainder in app/Apps/AppQyV1;
  - the duplicated archive code;
  - the stale memory line carried from G1.
- Cross-scope (pycore-laravel via the orchestrator):
  - the missing `lang/zh_CN/validation.php`;
  - the English defaults in `ApiResponse`;
  - the 'already exists' substring match on UnifiedAuthService.
- Changed files (mine): the verdict file and this report section. Scratch scripts are in `scratchpad/wnlead_g2/` (param_check.php, render_ldri29.php).
- Blockers: none. Next owners:
  - orchestrator: confirm the lang hand-back and route the pycore-laravel items;
  - wordnew-lead: schedule the next CKA-26 part, covering the remainder and the validation_failed consolidation.

## Review wordnew-link-G2 (round 1)

- Verdict: approved, with issues []. File: `.claude/agents_shared/reviews/wordnew-link-G2.json`.
- Items: WNL-01, WNL-02, MCHR-43, CKA-01 and MCHR-45 are confirmed. WNL-01 is in the sweep `ab566fdf7`, and the MCHR-43 lines are in the merge `93f8de054`. The working tree equals HEAD (`22ea5b992`) for every G2 path.
- MCHR-43: the non-interactive sub-check stays gated on shell-windows MCHR-02, as the item says. Under `-NonInteractive`, the current helper throws. `shell-windows-G2` is changes_requested.
- Re-run checks:
  - UI tsc (4.49 GB free): 0 errors under apps/wordnew. The only 2 errors are in apps/codemart/cm-locales/zh.ts, from codemart's in-flight work.
  - mcp-chrome in WSL (4.83 GB free): tsc shared, tsc native and vue-tsc extension, 0 errors each.
  - php -l on the cover-task service: OK.
  - Parser on start.ps1: 0 errors. The watch-prompt dry run uses the real helper.
  - Relay contract: 69 policies, none matching the capability_status routes.
  - Line endings unchanged.
- Decisions (recommended options):
  - `apps/mcp-chrome/pnpm-workspace.yaml` stays. The user's merge brought it back, and deleting it needs the user.
  - The Windows/Linux DD_AUTO_CONTINUE watch-mode difference (start.sh forces once; start.ps1 takes default dev after MCHR-02) is kept as the item orders. It is a follow-up question for the orchestrator/shell-windows, not a blocker.
- Forwarded requests:
  - orchestrator: `config/pycore_relay_contract.json`, add exact POST route_policies `ui/capability_status/get_capability_settings` → general_read and `ui/capability_status/post_capability_settings` → general_write.
  - shell-windows: MCHR-02, then wordnew-link re-runs the MCHR-43 non-interactive check.
  - user: MCHR-05-live and the pnpm-workspace.yaml choice.
- Non-blocking:
  - a thrown save clears the reorder;
  - the en 'on port {ports}' wording;
  - the redundant service-prompt guard at start.ps1:242 once MCHR-02 lands.
- Changed files (mine): the verdict file and this report section. Scratch outputs are in `scratchpad/wnlead_g2_link/` and `scratchpad/wl_g2_dry.ps1`.
- Blockers: none. Next owners: orchestrator (the relay policies), shell-windows (MCHR-02), wordnew-link (the MCHR-43 re-check after MCHR-02).
