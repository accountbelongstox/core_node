# UI compliance and upgrade audit — 2026-09-30

Scope: `poly_apps/pycore_laravel_wordnew_ui/` — pycore UI apps (pycore-manager, vortex, pdd-manager), wordnew, and the shared layer (core/, shared/, shell/, build config).
Method: static read-only review. Nothing was built, run or changed. Every path is relative to `poly_apps/pycore_laravel_wordnew_ui/` unless absolute.
Prior audit: `docs_fix/bug_audit_20260927/frontend-ui.md` (FU-xxx) covers runtime bugs; this file covers rule compliance and upgrade work. Skip anything already fixed there.

## Rules (from AGENTS.md and development-guides)

| ID | Rule |
|---|---|
| R1 | i18n: no hardcoded user-visible strings; keys exist in every locale |
| R2 | Reuse/centralize: one implementation per concern in core/shared; never copy shared code into an app |
| R3 | Centralized constants: URLs, ports, endpoint paths, routes, timeouts, storage keys, event names live in constants/contract modules; APIs go through core/integrations |
| R4 | Declare variables/constants at file top |
| R5 | English only in code, comments and logs |
| R6 | Code is documentation: no progress summaries, history notes or long doc comments in source |
| R7 | No dead code, commented-out code, unused exports, console.log leftovers, `any`/`@ts-ignore`/`eslint-disable` abuse |
| R8 | Cross-platform build scripts (Windows and Linux) |
| OPT | Optimization/upgrade: file size (>800 lines), re-renders, leaks, deprecated APIs, dependencies |

## Instructions for the fixing AI

- Work one section at a time; each finding ID is independent unless it names another ID.
- Delete or reuse before adding. When a fix says "move to shared", move the one implementation and update every importer; leave no copy behind.
- New user-visible text goes into every locale file of that app (en and zh at minimum).
- Verify each file:line before editing; lines may have shifted.
- Do not create tests or docs unless asked. Mark each finding done in this file (`- status: fixed`) when finished.

---

## Section VX/PD — apps/vortex and apps/pdd-manager

### VX-01 · R7 · high — pdd-manager is dead code
- location: shell/ShellApp.tsx:27, :54; shell/shellTypes.ts:64; apps/pdd-manager/* (~1,790 lines)
- problem: `PddApp` import and `/pdd-manager/*` route are commented out ("Archived"); nothing imports the app, its `/api/pdd/admin` client or `pdd` locales.
- fix: deletion is destructive — get user approval, then delete `apps/pdd-manager` and the commented shell lines. Without approval, only remove the commented-out shell lines and leave the app. Pdd findings below apply only while the app is kept.

### VX-02 · R7 · high — Vortex OKX panels can never render
- location: apps/vortex/api/VortexPycoreContract.ts:22 (`VORTEX_PYCORE_SERVED_HTTP_ROUTES = []`); VortexApp.tsx:30-35, 1885, 2071, 2234
- problem: served-route list is empty and `pycore/callmodule/rpc_routes/route_names.py` has no `okx` routes, so `isVortexPycorePanelServed()` is always false; OkxAccountPanel (263), OkxQuantPanel (330), OkxBacktestPanel (1,263 lines) are unreachable yet bundled.
- fix: lazy-import the panels (`React.lazy`) so they are not in the main bundle; keep the gate. Register the pycore `okx/*` routes when the backend exists.

### VX-03 · OPT · high — Oversized files
- location: apps/vortex/VortexApp.tsx (2,245 lines); apps/vortex/OkxBacktestPanel.tsx (1,263)
- fix: split VortexApp into `useVortexSimulation`, `useVortexLedger` hooks and one component per tab (Market/Compare/Ledger/Settings); move CandleChart, CompareChart, FillDiffChart, Sparkline to `apps/vortex/charts/`.

### VX-04 · R2 · medium — Hand-made toast stacks duplicate shared/notify
- location: VortexApp.tsx:109-113, 200-208; PddUsersPage.tsx:185; PddPaymentSettingsPage.tsx:60; PddMembershipPage.tsx:61-62
- fix: replace with `notify.success/info/warning` from `shared/notify/notify.tsx`; this also removes the uncleared `setTimeout`s (VX-17).

### VX-05 · R2 · medium — Duplicate language/theme switcher
- location: apps/vortex/VortexApp.tsx:833-870
- problem: re-implements `shell/ShellControls.tsx` and `apps/pycore-manager/components/PcAppearanceControls.tsx`.
- fix: move PcAppearanceControls to `shared/ui` (or reuse ShellControls) and render it in Vortex.

### VX-06 · R2 · medium — Duplicate Sparkline and formatters
- location: VortexApp.tsx:136 vs OkxBacktestPanel.tsx:80 (`Sparkline`); `fmtTs` in OkxQuantPanel.tsx:34, OkxBacktestPanel.tsx:427, OkxAccountPanel.tsx:31
- fix: one `Sparkline`; one `fmtTs`/`fmtNum`/`fmtBig` set in `core/utils/` next to `formatBytes.ts` (coordinate with the shared-formatter finding in Section CORE if present).

### VX-07 · R3 · medium — Raw localStorage keys
- location: VortexApp.tsx:218, 242, 246, 254, 274, 341, 348-350, 384, 692-694; OkxBacktestPanel.tsx:414 (`vortex_bookmarks`, `vortex_crypto_cash`, `vortex_crypto_positions`, `vortex_crypto_history`, `vortex_simulated_coins`, `vortex_okx_coins`)
- fix: add a `VortexStorageKeys` object (pattern: `shell/ShellStorageKeys.ts`) and use `core/persistence/StorageManager.get/set`.

### VX-08 · R7 · medium — Unguarded JSON.parse of persisted state
- location: VortexApp.tsx:219, 247, 255 (no try/catch); :279 (`catch (e) {}` swallow)
- fix: `StorageManager.get(key, default)` (parses safely) — done together with VX-07.

### VX-09 · OPT · medium — Full coin list written to localStorage every 4.5 s tick
- location: VortexApp.tsx:384 inside the `setInterval` at :358; :346-352
- problem: ~210 coins with history serialized synchronously inside a state updater.
- fix: persist from an effect, throttled (e.g. 30 s) and on `visibilitychange`/unmount; no side effects in updaters.

### VX-10 · R3 · medium — Literal RPC timeouts and poll intervals
- location: OkxQuantPanel.tsx:57, 71, 87, 102, 119; OkxAccountPanel.tsx:51; OkxBacktestPanel.tsx:502, 503, 520, 532, 600, 605, 609, 614, 620, 630, 724, 773, 774; intervals OkxBacktestPanel.tsx:564 (3000), 587 (1000)
- fix: a `VORTEX_PYCORE_TIMEOUTS` map in the contract module (moved per VX-11).

### VX-11 · R3 · medium — Pycore contract lives in the app
- location: apps/vortex/api/VortexPycoreContract.ts:1-57
- fix: move `okx/*` routes and `okx_market_*` topics into `core/integrations/pycore/PycoreHttpRoutes.ts` / `PycoreEventTopics.ts`; keep `apps/vortex/api` as a thin re-export.

### VX-12 · R1 · medium — Hardcoded user-visible strings
- location: PddApp.tsx:21 (`Loading…`); PddUsersPage.tsx:201, 218, 238, PddPaymentSettingsPage.tsx:87, 100 (fallback `'Error'`); PddAdminAPI.ts:247, 259, 267, 274, 311, 327 (thrown `'Failed to …'` shown via `flash(e.message)`); PddUsersPage.tsx:299 (`placeholder="YYYY-MM-DD"`); `¥` at PddDashboardPage.tsx:33, PddRechargePage.tsx:107, PddUsersPage.tsx:352; `USDT` at VortexApp.tsx:1565
- fix: i18n keys for errors; `Intl.NumberFormat(lang, {style:'currency', currency})` for money; reuse `ShellRouteFallback` instead of `Loading…`.

### VX-13 · R1 · low — Sentence concatenation
- location: PddUsersPage.tsx:129; PddRechargePage.tsx:123 (`{t('common.page')} {page} {t('common.of')} {lastPage}`)
- fix: one interpolated key `t('common.pageOf', { page, lastPage })`.

### VX-14 · R1 · low — Unused pdd locale keys
- location: apps/pdd-manager/pdd-locales/en.ts:13, 17, 18, 28, 32, 50, 112, 114 and zh.ts (`retry`, `cancel`, `close`, `yes`, `actions`, `packageFilter`, `selectAll`, `colSelect`)
- fix: remove (en/zh parity otherwise OK for vortex and pdd).

### VX-15 · R7 · medium — `any` types
- location: OkxBacktestPanel.tsx:380 (`job?: any`), 538 (`(d: any)`); VortexApp.tsx:811 (`tab.id as any`); PddUsersPage.tsx:201, 218, 238; PddPaymentSettingsPage.tsx:86, 99 (`catch (e: any)`)
- fix: typed interfaces; `{ id: VortexTab }[]`; `catch (e: unknown)` + `e instanceof Error`.

### VX-16 · R7 · medium — Fake seed ledger shipped as initial state
- location: VortexApp.tsx:248-251, 256-258
- fix: default positions/history to `[]`; optional explicit "load demo" action.

### VX-17 · OPT · low — Timers not cleared on unmount
- location: VortexApp.tsx:205; OkxQuantPanel.tsx:94, 109; PddUsersPage.tsx:185; PddPaymentSettingsPage.tsx:60; PddMembershipPage.tsx:62
- fix: refs + cleanup, or remove via VX-04.

### VX-18 · R4 · low — Constants declared inside components/effects
- location: PddRechargePage.tsx:28 (`PER_PAGE` inside component; PddUsersPage.tsx:17 has it at top); VortexApp.tsx:283, 309-310 (`categories`, `prefixes`, `suffixes`, `210`, `15`), 236-238, 243 (`4500`, `0.1`, `5`, `100000`); PddDashboardPage.tsx:49, PddMembershipPage.tsx:13 (`7`)
- fix: named top-level constants; one shared `PDD_PAGE_SIZE`.

### VX-19 · bug · low — Recharge pager page size not sent
- location: PddRechargePage.tsx:43; PddAdminAPI.ts:279-286
- fix: send `per_page` or read it from the response like `listUsers`.

### VX-20 · R5/R6 · low — Non-English comments, history notes, commented-out code
- location: OkxBacktestPanel.tsx:3-5, 9; OkxAccountPanel.tsx:2; PddApp.tsx:3; PddAdminAPI.ts:6; VortexApp.tsx:299 (typo "Suppplement"); shell/ShellApp.tsx:27, shellTypes.ts:64
- fix: English only; delete history notes and commented-out code.

### VX-21 · R7 · low — Suppressed hook dependencies
- location: VortexApp.tsx:185; OkxAccountPanel.tsx:66 (`eslint-disable-next-line react-hooks/exhaustive-deps`)
- fix: stable `useCallback`/effect-event pattern with real deps.

### VX-22 · R2 · low — Duplicate pdd form/pager primitives (only if pdd is kept)
- location: PddUsersPage.tsx:150-151 and PddPaymentSettingsPage.tsx:15-16 (`inputCls`/`labelCls`); status chip/pager/refresh markup in PddUsers, PddRecharge, PddDashboard
- fix: shared form and pager primitives in `shared/ui`.

Clean in scope: no `console.*`, `@ts-ignore`, hardcoded URLs or ports.

---

## Section WC — apps/wordnew/components and apps/wordnew/hooks

### WC-01 · R2/R1 · high — Parallel i18n system `studyT`
- location: apps/wordnew/components/study/WfNewStudyLocales.ts:1-184; used by WfNewPracticeTab.tsx:81, WfNewDailyGoalEditor.tsx:21, study/{WfNewStudyStatsBar,WfNewStudySettingsSheet,WfNewGroupStudyPanel,WfNewFlashcard,WfNewArenaStatsPopup,WfNewStudyWordList}.tsx
- problem: own dictionary (en/zh only) and interpolator; `queue.*` keys (82-88, 155-162) duplicate locales/en_b.ts:662, zh_b.ts:661; no ja/ko.
- fix: move all `study.*`/`queue.*` into locales/{en,zh,ja,ko}_*.ts, use `translate` from WfNewLocales.ts, delete WfNewStudyLocales.ts.

### WC-02 · R2 · high — Word-audio playback copied 4 times, overlapping clips
- location: components/WfNewPracticeTab.tsx:141-148; study/WfNewGroupStudyPanel.tsx:81-82, 165-177; study/useWfNewReciteController.ts:45-46, 136; study/WfNewAudioWave.tsx:66-67
- problem: `isAbsoluteUrl` + `new Audio(resolveAudioSync(url) ?? url).play().catch(playPhoneticSpeech)` repeated; PracticeTab/GroupStudy never stop the previous clip or pause on unmount.
- fix: one `playWordAudio` (single shared Audio instance + stop/cleanup) in hooks/wordNewWordAudioFallback.ts (or reuse `speakWordWithAccent`); import everywhere.

### WC-03 · R2/R7 · medium — Puter.js loader duplicated; dead exports
- location: hooks/puterTranslate.ts:10-33 vs hooks/wordNewWordAudioFallback.ts:144-167; unused puterTranslate.ts:72 `isPuterTranslateAvailable`, wordNewWordAudioFallback.ts:173 `puterSpeakWord`
- problem: two load promises can inject the SDK script twice.
- fix: one `puterSdk.ts` loader; delete the unused exports.

### WC-04 · R2 · medium — Admin panels duplicate helpers
- location: admin/WfNewAdminWords.tsx:39-51, 67-69, 139-141, 165-171; admin/WfNewAdminLibraries.tsx:44-58, 118-123, 180-182
- problem: same fallback language list, `WORDNEW_ADMIN_LANGUAGE` read/write, `CHIP_CLS`, debounced search (400 vs `SEARCH_DEBOUNCE_MS`), toast-error wrapper.
- fix: `admin/adminShared.ts` (constants, storage helpers, `useDebouncedValue`) used by both.

### WC-05 · R1 · high — Hardcoded JSX strings
- location: reader/WordNewBookReaderSettingsPanel.tsx:175, 183, 184, 192, 193, 196; WfNewWordDetailModal.tsx:51, 77, 84, 93; WfNewPracticeTab.tsx:336, 341, 550; WfNewBottomDock.tsx:44; WfNewLabsTab.tsx:124; WfNewSocialLive.tsx:241; WfNewHomeTab.tsx:251-254; WfNewHomeDashboard.tsx:129 (`'Commander'`); daily-reading/WordNewDailyReadingSection.tsx:448 (`words ·`)
- fix: locale keys in every wordnew locale, rendered with `trans(...)`.

### WC-06 · R1 · medium — Untranslated aria/title/alt and English fallbacks
- location: social/WfNewSocialNearby.tsx:107, 108; WfNewNavLogo.tsx:50-51; WfNewAvatarCropper.tsx:165; WfNewAvatarView.tsx:35; WordNewAudioVariantPicker.tsx:26 (`?? 'Voice variant'`); daily-reading/dailyReadingApi.ts:18-19 (`'Untitled article'`); admin/WfNewAdminWords.tsx:195, 284 (`'Failed to load …'`, raw `e.message`)
- fix: i18n keys; make `trans` required; map AdminWords errors via `adminErrorText` like Libraries.

### WC-07 · R1/R3 · medium — Mock/demo content in runtime code
- location: hooks/useWfNewContentHandlers.ts:684-690 (`'/forged/'`, `'Custom forged lexeme…'`, `tags: ['Forged']`); WfNewHomeTab.tsx:234-240 (branches on WfNewMockDb ids `'bento-cosmic-1'`… with 4 hardcoded Unsplash URLs)
- fix: empty/i18n placeholders; cover URLs from group data or a constants map.

### WC-08 · R7 · medium — `any` in component/hook contracts
- location: WfNewHomeTab.tsx:77-87; WfNewPracticeTab.tsx:86-97; WfNewHeader.tsx:16, 21, 23, 27; WfNewSearchOverlay.tsx:137; WfNewSocialLive.tsx:207; admin/WfNewAdminQueues.tsx:119, 142, 161, 168, 220; admin/WfNewAdminWords.tsx:139, 193, 279, 332, 351, 372; admin/WfNewAdminLibraries.tsx:143, 180, 189, 228; admin/WfNewAdminTranslate.tsx:132, 168; admin/WfNewAdminOverview.tsx:75; WfNewLanguagePanel.tsx:146; hooks/useWfNewContentHandlers.ts:414, 716, 737; hooks/useWfNewAppState.ts:390, 395; hooks/puterTranslate.ts:18, 24, 57, 73; hooks/wordNewWordAudioFallback.ts:153, 159, 181
- fix: existing types (`WfNewTab`, `PracticeMode`, `Dispatch<SetStateAction<…>>`), `unknown` in catch, typed SSE payload, one `window.puter` declaration.

### WC-09 · R7 · medium — `exhaustive-deps` suppressions hide stale closures
- location: WfNewCards.tsx:37; WfNewHomeContent.tsx:117; WfNewPracticeTab.tsx:166, 174, 205 (omits `startGroupPractice`, `startModePractice`); study/WfNewStudyWordList.tsx:112; study/WfNewGroupStudyPanel.tsx:203, 207, 214; daily-reading/WordNewDailyReadingSection.tsx:174; orch-audio/useOrchAudioPlayback.ts:88; orch-audio/useOrchAudioSentencePages.ts:70; hooks/useWfNewAppState.ts:271, 468; hooks/useWfNewContentHandlers.ts:186, 460, 471, 488, 569
- fix: latest-callback ref pattern (as in useWfNewLoadMoreSentinel) or stable callbacks; remove the disables.

### WC-10 · OPT · medium — Object URL leak
- location: WfNewSocialComposer.tsx:40-44, 65-76
- problem: `URL.createObjectURL` inside the `setImages` updater (runs twice in StrictMode); no unmount revoke.
- fix: create URLs outside the updater; revoke remaining previews in an unmount cleanup.

### WC-11 · OPT · medium — Search stale-response race
- location: hooks/useWfNewContentHandlers.ts:519-538
- problem: cleanup clears only the timer; an in-flight `searchDictionary` can overwrite newer results. Escape regex built twice (527, 530).
- fix: request-id/alive guard; one filter helper.

### WC-12 · OPT · low — Recite timers not cancelled
- location: study/useWfNewReciteController.ts:280, 298 (`setTimeout(onDone, 600)`), 126 (`8000`)
- fix: named constants (`SPEECH_FALLBACK_BEAT_MS`, `PLAY_GUARD_MS`); route through `aliveRef`/clear-on-stop.

### WC-13 · R3 · low — Magic intervals/timeouts
- location: WfNewSocialLive.tsx:200 (20000); hooks/useWfNewAppState.ts:489 (30000); hooks/useWfNewContentHandlers.ts:447 (2500), 535 (400); admin/WfNewAdminWords.tsx:169 (400); study/WfNewAudioWave.tsx:105 (1600)
- fix: named `*_MS` constants in apps/wordnew/constants.

### WC-14 · R3 · low — External SDK/model/embed literals scattered
- location: hooks/puterTranslate.ts:10, 48 (`'gpt-5-nano'`, prompt text); hooks/wordNewWordAudioFallback.ts:144, 183 (voice names); WfNewSocialPlaza.tsx:46, 51, 57, 64 (YouTube/Bilibili/Vimeo embed hosts)
- fix: one constants/integrations module.

### WC-15 · R4 · low — Constants below functions
- location: admin/WfNewAdminWords.tsx:56-69; admin/WfNewAdminLibraries.tsx:58-59; WfNewSocialPlaza.tsx:100; social/socialPresence.ts:25; hooks/wordNewWordAudioFallback.ts:144-145
- fix: move to file top.

### WC-16 · R5 · medium — Chinese in comments
- location: WfNewShelfTab.tsx:70; study/useWfNewReciteController.ts:9; study/WfNewAudioWave.tsx:2; study/WfNewFlashcard.tsx:65; WfNewHomeContent.tsx:13, 58; WfNewPracticeTab.tsx:72, 177, 486; study/WfNewStudyProgress.ts:216-221
- fix: English only.

### WC-17 · R6 · medium — History notes and long header comments
- location: hooks/useWfNewContentHandlers.ts:572-576, 704, 723; hooks/useWfNewAppState.ts:80-82, 517; WfNewHomeDashboard.tsx:4; WfNewNavLogo.tsx:13; WfNewHeader.tsx:44; WfNewCacheManager.tsx:7; study/WfNewStudyWordList.tsx:3, 14; long headers in hooks/useWfNewPracticePager.ts:1-37, study/WfNewGroupStudyPanel.tsx:1-37, WfNewHomeDashboard.tsx, admin/WfNewAdminLibraries.tsx, WfNewStudyWordList.tsx, WfNewAudioWave.tsx
- fix: delete history prose; headers ≤2 lines; design detail goes to apps/wordnew/docs.

### WC-18 · R2 · low — Small repeated helpers
- location: `pct` in study/WfNewStudyStatsBar.tsx:19, study/WfNewArenaStatsPopup.tsx:36, admin/WfNewAdminOverview.tsx:28; runtime keyframe `<style>` injection in WfNewRotatingCover.tsx:49-57, study/WfNewAudioWave.tsx:57-61
- fix: one `pct` in utils; keyframes into a stylesheet under shared/styles.

### WC-19 · R2 · low — Orchestration step types redefined
- location: orch-compose/WordNewOrchComposeEditor.tsx:27 (`STEP_TYPES`); services/orchestration/orchComposeTypes.ts:4 mirrors core/integrations/pycore/PycoreApiOrchestration.ts:87 `OrchPatternStepType`
- fix: export one const array from core and derive the type and list from it.

### WC-20 · R2 · low — Generic hook in app layer
- location: hooks/useWfNewLoadMoreSentinel.ts; inline copy in apps/pycore-manager/pages/vocabulary/VocabLibrariesTab.tsx:37-44
- fix: move to core/ui as `useLoadMoreSentinel`; reuse in pycore-manager.

### WC-21 · R7 · low — Exports used only in their own file
- location: WfNewSocialLive.tsx (`WfNewSocialLiveRoom`, `WfNewGoLiveModal`); WfNewAvatarView.tsx `isImageAvatar`; wordNewWordAudioFallback.ts `speakWordWithAccent`; social/socialPresence.ts `PRESENCE_DOT`; orch-audio/orchAudioModel.ts `normalizeOrchAudioSettings`; daily-reading/DailyReadingAudioRuntime.ts `absoluteDailyReadingAudio`; daily-reading/dailyReadingWordGroupStore.ts (`loadDailyReadingWordGroups`, `roamDailyReadingWordGroup`, `pullDailyReadingWordGroup`); daily-reading/DailyReadingPlaybackModel.ts (`DEFAULT_DAILY_READING_SETTINGS`, `clampDailyReadingRate`, `sanitizeDailyReadingPattern`); queue/QueueDeliveryStatusIcons.tsx `QueueWorkerPresenceIcon`
- fix: drop `export` (unless WC-02 makes `speakWordWithAccent` the shared helper).

### WC-22 · OPT · low — Files near the limit, prop drilling
- location: daily-reading/useDailyReadingPlayer.ts (799), hooks/useWfNewAppState.ts (795), hooks/useWfNewContentHandlers.ts (784), admin/WfNewAdminWords.tsx (727), WfNewPracticeTab.tsx (626, ~40 props at 84-100), WfNewHomeTab.tsx (431, ~25 props at 76-90)
- fix: split state/handlers hooks by domain (search, favorites, library add, dashboard); give tabs context/selector hooks instead of drilled `any` props.

Clean in scope: no console.log, `@ts-ignore`, commented-out blocks, hardcoded API paths or raw localStorage keys (`WordNewStorageKeys` is used).

---

## Section WP — apps/wordnew/pages

### WP-01 · R1 · high — Keys missing from every locale
- location: pages/WfNewLibraryPage.tsx:455, 462, 470
- problem: `content.pause`, `content.play`, `content.stop`, `library.playAll` are undefined in en/zh/ja/ko; raw keys render.
- fix: add to locales/{en,zh,ja,ko}_*.ts.

### WP-02 · R1 · high — ja/ko missing ~95 keys used by pages
- location: locales/ja_a.ts, ja_b.ts, ko_a.ts, ko_b.ts (callers: WfNewAuth, WfNewLanguages, WfNewLearningModel, WfNewReviewSettings, WfNewLibraryPage, WfNewProfile, WfNewSettings, WfNewBookReader)
- problem: missing `auth.*` (8), `cache.*` (3), `lang.*` (9), all `library.*`, `lm.*`, `rev.*`, `profile.logout*/login*/upload*/avatarUpload*`, `profile.sessionActive`, `profile.languagesMovedHint`, `set.appearanceMode/modeDark/modeLight/learningModel/loginForLanguages/selectLanguages`, `reader.resuming`.
- fix: translate into ja/ko; type ja/ko against the en key type so parity is compile-checked (see also Section WS locale findings).

### WP-03 · R1 · medium — Hardcoded user-visible strings
- location: WfNewSocial.tsx:415 (`Center v3`); WfNewAuth.tsx:93, WfNewProfile.tsx:252 (`'Cadet'`); WfNewAuth.tsx:110 (`'Linguistic coordinates locked.'`); WfNewLibraryPage.tsx:263 (`'Failed to load library words.'`); WfNewWalkman.tsx:214, 236, 257, 277, 522; WfNewProfile.tsx:303, 370 (`Lv.`); WfNewSubtitles.tsx:320, 331 (fake `'/word/'`, `'/lookup/'`); WfNewAnalytics.tsx:191, 195, 199 (fake stats `1.8h Max`, `64.2 mins`, `+28%`)
- fix: `trans()` keys; derive Analytics legend from `stats.weeklyActivity`.

### WP-04 · R1 · medium — Theme names and statuses bypass i18n
- location: WfNewSettings.tsx:256 (`lang === 'en' ? theme.nameEn : theme.nameZh`); WfNewOnboarding.tsx:107-108, 115; WfNewAnalytics.tsx:323, 327 (raw `item.status`)
- fix: `theme.name.<id>` and `analytics.status.<status>` keys.

### WP-05 · bug/R2 · high — Walkman repeat chain uses stale closures (infinite repeat, pause ignored)
- location: WfNewWalkman.tsx:56-126, 171
- fix: rebuild on the ref-driven engine of `services/WordNewBookReaderPlayback.ts`, or hold counters/isPlaying in refs.

### WP-06 · R2 · high — Pages drive raw `speechSynthesis` (3 copies)
- location: WfNewWalkman.tsx:56-107, 185-191; WfNewBilingual.tsx:82-110 (also re-implements lang→BCP-47 at 93-100); WfNewSubtitles.tsx:188-206
- fix: `speakBookText`/`cancelBookSpeech` from `services/WordNewBookReaderSpeech.ts` (or `platform/capabilities/CapTextToSpeech.ts`) and `langCodeToBcp47` from `utils/WordNewBookReaderA11y.ts`. Coordinate with WC-02 (one audio/speech entry point).

### WP-07 · bug · medium — Walkman ignores user languages
- location: WfNewWalkman.tsx:16/24 (`lang` unused), 67, 78-80
- problem: always `en-US`/`zh-CN`; regex strips non-Chinese so ja/ko natives hear nothing.
- fix: use `settingNativeLang`/`settingTargetLang` from `wfNewSettings`; remove the Chinese-only strip.

### WP-08 · R2 · medium — Toggle switch implemented 8 times
- location: WfNewSettings.tsx:363-375, 384-396, 405-417; WfNewWalkman.tsx:478-491, 500-512; WfNewReviewSettings.tsx:134-137; WfNewPlaybackSettings.tsx:177-185 (declared inside render → remounts every render); WfNewLearningModel.tsx:63-71
- fix: move `Toggle`, `Row`, `Stepper` from WfNewLearningModel.tsx to `components/settings/` and use everywhere.

### WP-09 · R2 · low — Stepper duplicated
- location: WfNewReviewSettings.tsx:99-101; WfNewPlaybackSettings.tsx:237-239 (good version WfNewLearningModel.tsx:23-49)
- fix: reuse the extracted `Stepper` (WP-08).

### WP-10 · R2/R3 · medium — `reviewAlgorithm` has two conflicting option sets
- location: WfNewSettings.tsx:432-436 (`ebbinghaus|leitner|rapid`) vs WfNewReviewSettings.tsx:77 (`ebbinghaus|sm2|leitner`)
- fix: one `REVIEW_ALGORITHMS` constant in apps/wordnew/constants and one picker.

### WP-11 · R2 · medium — Settings reset copies store defaults; leaks a timer
- location: WfNewSettings.tsx:175-187 (copies `makeDefaults()` from WfNewSettingsStore.ts:133; fake 1200 ms `setTimeout`)
- fix: export `resetPreferences()` from WfNewSettingsStore; no artificial delay.

### WP-12 · R7 · medium — Dead code in WfNewSettings
- location: WfNewSettings.tsx:122-130 (`toggleTargetLang` unused); props at 30-33, 38, 65-68, 72 (`nickname`, `setNickname`, `avatarUrl`, `setAvatarUrl`, `onOpenLanguages`)
- fix: delete; update the caller in WfNewApp.tsx.

### WP-13 · R7 · low — Unused imports
- location: WfNewAnalytics.tsx:4-5; WfNewAuth.tsx:4-5; WfNewBilingual.tsx:4-5; WfNewOnboarding.tsx:2-3; WfNewSettings.tsx:4-6; WfNewSocial.tsx:3-4; WfNewWalkman.tsx:4-5; WfNewPlaybackSettings.tsx:2; WfNewLanguages.tsx:3
- fix: remove (enable `noUnusedLocals` — see Section CORE tsconfig finding if present).

### WP-14 · R2 · medium — Auth copies avatar helper; shows avatar URL as text
- location: WfNewAuth.tsx:78 (`looksLikeImageUrl` duplicates `isImageAvatar` in components/WfNewAvatarView.tsx); 227-229 (`{currentUser.avatar}` as text)
- fix: `<WfNewAvatarView value={currentUser.avatar} />`.

### WP-15 · R2 · low — Inline avatar markup repeated in Social
- location: WfNewSocial.tsx:525-528, 604-607, 718-721, 755-758
- fix: `WfNewAvatarView` with initial fallback.

### WP-16 · R2 · low — Auth→session mapping in the view
- location: WfNewAuth.tsx:64-113 (`AVATAR_POOL`, `pickEmoji`, `toSessionProfile`, hardcoded `'zh'`/`'en'`)
- fix: move to `api/WfNewApiMappers.ts` (or a session service); use store defaults.

### WP-17 · R2 · medium — Scroll-pause re-implemented
- location: WfNewBookReader.tsx:145, 427-438; WfNewLibraryPage.tsx:110, 290-303 (both `2500`); scroll-to-upper-middle BookReader:52-57 vs Library:297
- fix: `hooks/useScrollPause.ts` (`SCROLL_PAUSE_MS`); shared `scrollVerseToUpperMiddle` util.

### WP-18 · R2 · low — Library page has its own pager
- location: WfNewLibraryPage.tsx:550-575
- fix: `components/WfNewPager.tsx`.

### WP-19 · R2 · low — Duplicate time formatter and speed list
- location: WfNewSubtitles.tsx:36-41 (formatter), 33 and WfNewPlaybackSettings.tsx:17 (speeds)
- fix: `formatClockTime` from `utils/WordNewTimeFormat.ts` (add mm:ss option); one `SUBTITLE_SPEEDS` constant.

### WP-20 · R2 · medium — Hardcoded language lists
- location: WfNewSocial.tsx:564; WfNewPlaybackSettings.tsx:18 (`WORD_LANGUAGES`)
- fix: `SUPPORTED_LEARNING_LANGUAGE_CODES` from `core/i18n/supportedLearningLanguages.ts` or `wfNewApi.getSupportedLanguages()`.

### WP-21 · R2 · medium — Presence merge ×3 and redundant polling in Social
- location: WfNewSocial.tsx:128-132, 188-192, 287-291; poll 178-198 and effect 280-295 both call `getPresence`
- fix: `mergePresence(map)` + one presence hook in `components/social/socialPresence.ts`; drop the redundant effect.

### WP-22 · R2 · low — Language seed duplicated in BookReader
- location: WfNewBookReader.tsx:119-124, 368-374
- fix: `seedReaderLangs()` in `utils/WordNewBookReaderLangUtils.ts`.

### WP-23 · R2 · low — Two UIs edit learning languages
- location: WfNewLanguages.tsx (page) vs WfNewSettings.tsx:541-566 (`WfNewLanguagePanel`)
- problem: WfNewLanguages saves only to backend, never updates `settingNativeLang`/`settingTargetLangs`.
- fix: keep `WfNewLanguagePanel` only, or route both through one service that updates both stores.

### WP-24 · R3 · medium — Hardcoded timers/intervals/limits
- location: WfNewSocial.tsx:73 (20), 123 (50), 136 (350), 196 (45000), 376 (30000); WfNewLibraryPage.tsx:141-142; WfNewBilingual.tsx:145, 147, 152, 168, 176 (600); WfNewWalkman.tsx:96, 118, 124; WfNewSubtitles.tsx:145, 180
- fix: named constants in apps/wordnew/constants.

### WP-25 · R3 · low — Realtime event names as literals
- location: WfNewSocial.tsx:305, 335-362
- fix: event-name const map beside `WfNewSocialEvent` in `api/WfNewSocialRealtime.ts`.

### WP-26 · R3 · low — Magic setting values and presets
- location: WfNewBilingual.tsx:128, 138, 159, 163, 199, 205, 233, 262, 272; WfNewSettings.tsx:617-618, 637-638 (`'1en_1zh'`, `'2en_1zh'`, `'target_first'`, `'native_first'`); goal presets WfNewSettings.tsx:213 `[10,20,30,50,100]` vs WfNewOnboarding.tsx:62 `[10,20,50]`; WfNewOnboarding.tsx:24 (default 20)
- fix: `BILINGUAL_RATIOS`, `RECITAL_ORDERS`, `DAILY_GOAL_PRESETS` constants; default from the store.

### WP-27 · R3 · low — Hardcoded language defaults
- location: WfNewLibraryPage.tsx:104, 114, 115; WfNewBilingual.tsx:68; WfNewLanguages.tsx:213-214, 230-231
- fix: defaults from `WfNewSettingsStore` / `WFNEW_BUILTIN_LANGUAGE_CODES`.

### WP-28 · R4 · low — Declarations not at top
- location: WfNewSocial.tsx:44-46 (imports after types); WfNewProfile.tsx:201-206 (`BADGE_ACCENTS`), 219; WfNewAuth.tsx:64 (`AVATAR_POOL` inside component)
- fix: hoist.

### WP-29 · R5 · low — Chinese comment
- location: WfNewAuth.tsx:130 (`即将上线`)

### WP-30 · R6 · low — History notes and long headers
- location: WfNewBookReader.tsx:1-4, 148-154; WfNewSettings.tsx:25, 85-86, 198, 205, 269, 284, 312; WfNewAuth.tsx:507; WfNewSocial.tsx:710; WfNewContentListPage.tsx:1-12, 46-63, 74-85; WfNewAbout.tsx:1-9; WfNewAdminPage.tsx:1-17; WfNewLibraryPage.tsx:1-15
- fix: delete history; one-line headers.

### WP-31 · R7 · low — `any` and eslint-disable
- location: WfNewSocial.tsx:299, 305, 336, 341-343, 347, 354, 362 (`payload: any`); WfNewAuth.tsx:116, WfNewProfile.tsx:146, WfNewLanguages.tsx:79 (`err: any`); WfNewLearningModel.tsx:87-88; WfNewSubtitles.tsx:157, 165
- fix: typed payloads per `WfNewSocialEvent`; `unknown` + one shared `errorMessage(err)` helper; generic `persist<K>`.

### WP-32 · R7 · low — Console leftovers and dead variables
- location: WfNewBookReader.tsx:241; WfNewWalkman.tsx:58 (console); WfNewBookReader.tsx:390-393 (`let` never reassigned, `items` unused)
- fix: remove / app logger; `const`.

### WP-33 · bug · low — Invalid Tailwind classes
- location: `*-indigo-505` WfNewSettings.tsx:244, 520, 530, 602; WfNewAuth.tsx:346, 363, 381, 396, 442; WfNewBilingual.tsx:219, 329, 389, 398; `*-indigo-550` WfNewBilingual.tsx:318, 338, 345, 456; `zinc-850`/`zinc-550` WfNewWalkman.tsx:352, 553; `text-zinc-650` WfNewOnboarding.tsx:195; `w-4 s h-4` WfNewSettings.tsx:454; `id=" walkman-container-module"` WfNewWalkman.tsx:196
- fix: valid shades (500/600/800); fix tokens.

### WP-34 · OPT · medium — Speech not cancelled on unmount; timers overwritten
- location: WfNewSubtitles.tsx (cancel only at 179, 264); WfNewBilingual.tsx:141-176 (nested timeouts overwrite `timerRef`)
- fix: unmount cleanup calling `cancelBookSpeech()`; track timers in a Set (as WfNewLibraryPage.tsx:93).

### WP-35 · OPT · low — Churning callbacks/effects
- location: WfNewLibraryPage.tsx:76-86 (`onMoveToHead` depends on `headStatus` → all rows re-render); WfNewSubtitles.tsx:241-244 and 312-314 (same effect twice); WfNewBookReader.tsx:155-183 (17 ref-sync effects)
- fix: ref/functional state for `headStatus`; delete duplicate effect; a `useLatestRef` hook in hooks/.

### WP-36 · OPT · low — Files near 800 lines
- location: WfNewSocial.tsx (788), WfNewSettings.tsx (783), WfNewProfile.tsx (780)
- fix: Social Partners/Leaderboard tabs → components/social/; Settings → section components; Profile `MEMBER_TIERS`/`computeMemberLevel` → services/WordNewAchievementCenter.ts.

### WP-37 · R7 · low — Simulated forgetting curve in Analytics
- location: WfNewAnalytics.tsx:37-59 (magic 86, 0.88; setter inside another updater)
- fix: drive from real `stats` or remove; set states separately.

Clean in scope: no hardcoded URLs/ports; storage via `StorageManager`/`WordNewStorageKeys`.

---

## Section PP — apps/pycore-manager/pages

All paths below are under `apps/pycore-manager/pages/` unless shown otherwise.

### PP-01 · R1 · high — Whole pages without i18n
- location: PcCodeSyncPage.tsx (no `useTranslation`; e.g. :511, 744, 758, 779-791, 823-843, 988-997, 1043-1052, 1141-1153, 1249-1258, 1323-1350; flash messages 312-420); PcWindowAutomationPage.tsx:17-28, 62-112; PcContentPage.tsx:47-51 (TABS label/hint; :24 comment admits hardcoded English)
- fix: `codeSync.*`, `windowAutomation.*`, `content.tabs.*` keys in pc-locales (en+zh); `labelKey`/`hintKey` in TABS as PcAiPage does.

### PP-02 · R1 · high — Partly localized pages with literals
- location: PcSettingsPage.tsx:249-252, 303, 338, 344, 367, 386, 397, 434, 436, 505, 524, 546, 551, 570; PcRecentTasksPanel.tsx:295, 368; agent-history/PcAgentHistoryRecords.tsx:267 ("English"); PcTerminalPage.tsx:252-275 (`'10M'`, `'1H'` … labels)
- fix: pc-locales keys; duration labels from `common.*` unit keys.

### PP-03 · R1/R3 · medium — "backend (:59000) offline" banner copied 3× with hardcoded port
- location: PcSettingsPage.tsx:338; PcWindowAutomationPage.tsx:73; PcCodeSyncPage.tsx:727
- fix: one shared offline banner (`PcRpcAccessBanner` or `common.pycoreUnreachable`), port from `PYCORE_PORT`.

### PP-04 · R1 · medium — Raw backend/exception text shown (21 sites)
- location: PcVideoExtractPage.tsx:321, 340, 344, 354; PcBooksPage.tsx:487; PcCodeSyncPage.tsx:314-407; PcRecentTasksPanel.tsx:295
- fix: route through `pcErrorCodeMessage`/`pcFailureMessage` (`utils/pcErrorCodes`) like `orchErrorMessage`.

### PP-05 · R2 · high — Add-source modal + path picker duplicated
- location: PcBooksPage.tsx:456-490, 1380-1420; PcVideoExtractPage.tsx:315-345, 1240-1285
- fix: `PcAddSourceModal` + `usePathPicker` in apps/pycore-manager/components/.

### PP-06 · R2/R3 · high — Windows-only `DEFAULT_BASE = 'D:\\.tmp'` duplicated
- location: PcBooksPage.tsx:179; PcVideoExtractPage.tsx:87
- problem: duplicated and breaks Windows+Linux compatibility.
- fix: base dir from backend (`r.base_dir`, already read at PcVideoExtractPage.tsx:213); no drive-letter default.

### PP-07 · R2 · medium — Clipboard copy ×3, timers not cleared, failures swallowed
- location: agent-history/PcAgentHistoryPromptItem.tsx:20-26; agent-history/PcAgentHistoryPromptRewrite.tsx:50-55; vocabulary/VocabTranslateTab.tsx:122-127
- fix: `copyTextToSystemClipboard` (`core/browser/SystemClipboard`) inside one `useCopyFeedback` hook with timer cleanup.

### PP-08 · R2 · medium — Hand-rolled flash notices
- location: PcCodeSyncPage.tsx:222-226; PcCoreBookPage.tsx:137-141 (6000 ms timer never cleared)
- fix: `notify` from `shared/notify/notify.tsx`.

### PP-09 · R2 · low — Download-file helper ×3
- location: PcSubtitleSearchPage.tsx:118-130; audio-orchestration/orchTaskFileCache.ts:105-114; PcRecentTasksPanel.tsx:289-293
- fix: one `downloadFile(urlOrBlob, name)` next to `core/browser/SystemClipboard.ts`.

### PP-10 · R2 · medium — URL `?tab=` + storage tab state ×3
- location: PcAiPage.tsx:68-89; PcContentPage.tsx:64-93; PcVocabularyPage.tsx:35-42
- fix: `usePersistedUrlTab(storageKey, isTab, default)` in apps/pycore-manager/hooks/.

### PP-11 · R2 · medium — Formatters re-implemented
- location: PcVideoExtractPage.tsx:100-119 (`fmtMB`, `fmtDur`, `fmtClock`); audio-orchestration/orchShared.ts:144 (`formatDuration`); PcTerminalPage.tsx:191, 267; vocabulary/vocabShared.tsx:78-80 (`humanBytes` wrapper, imported by OrchFilePlayer.tsx:9, OrchTaskFileItem.tsx:9)
- fix: `core/utils/formatBytes.ts` and `utils/pcFormat.ts` (`humanBytes`, `formatElapsed`, add one `formatClock`); delete the wrapper. Coordinate with VX-06 (one formatter module).

### PP-12 · R2 · medium — Local envelope unwrap `vp()`
- location: vocabulary/vocabShared.tsx:94-99 (`as any`)
- fix: `unwrapLaravelData` from `core/integrations/laravel/transport/LaravelEnvelope.ts`; delete `vp` (also fixes the `vp<any>` sites in PP-22).

### PP-13 · R2 · medium — App-wide UI inside feature folders; two pagers
- location: agent-history/PcPager.tsx (imported by audio-orchestration/OrchTaskList.tsx:16 and others) vs components/PcQueueLogPagination.tsx; vocabulary/vocabShared.tsx (`PresenceBadge`, `VocabBanner`, `humanInt`) imported by PcImageSearchPage.tsx:40, PcTranslatePage.tsx:32, PcWordAudioPage.tsx:30, PcSubtitleSearchPage.tsx, orch files
- fix: move `PcPager` and the generic vocabShared parts to apps/pycore-manager/components/ and utils/; merge PcQueueLogPagination into PcPager.

### PP-14 · R2 · low — Duplicate input class strings
- location: PcBooksPage.tsx:774 = PcVideoExtractPage.tsx:479; PcCodeSyncPage.tsx:483; agent-history/PcAgentHistoryConfigPanel.tsx:138; audio-orchestration/OrchLearningVideoPanel.tsx:47
- fix: one `PC_INPUT_CLASS` or `shared/styles` token.

### PP-15 · R3 · medium — Raw storage key bypasses StorageManager
- location: PcTerminalPage.tsx:205 (`'pc.terminal.scheduleEditor.v1'`), raw `window.localStorage` at 224, 942
- fix: `PYCORE_TERMINAL_SCHEDULE_EDITOR` in `persistence/PycoreManagerStorageKeys.ts`; `StorageManager.get/set`.

### PP-16 · R3/OPT · medium — Orch poll interval ×3; polling duplicates pushes
- location: audio-orchestration/AudioOrchWorkspace.tsx:42, 204; audio-orchestration/useOrchTaskListing.ts:18, 126; audio-orchestration/OrchTaskDetail.tsx:26, 65 (all 3000 ms)
- problem: list and detail poll in parallel although `pycoreEventBus` pushes `audioOrchestrationTasksChanged`.
- fix: one `ORCH_POLL_MS` in orchShared.ts; detail uses listing refresh or `hooks/useTopicDrivenRefresh`.

### PP-17 · R3/R7 · medium — Fake Window Automation page
- location: PcWindowAutomationPage.tsx:24-28 (fake `INFO_ROWS` "DRIVER VERSION v2.19.4-Active"), 32 (`'Discord-Client-Main'`), 42 (simulated 1400 ms run)
- fix: wire to a real pycore endpoint or remove mock rows/delay; removing the page needs user approval.

### PP-18 · R4 · low — Constants mid-file; ref used before declaration
- location: PcTerminalPage.tsx:204-205, 252, 278-282; PcCodeSyncPage.tsx:76 (`CHART_RANGES`); PcQueueCenterPage.tsx:192 uses `mounted` declared at 206
- fix: hoist; declare `mounted` before its effects.

### PP-19 · R5 · low — Chinese in comments
- location: PcAgentHistoryPage.tsx:447; agent-history/PcAgentHistoryToolPanel.tsx:17-18; PcVideoExtractPage.tsx:37; PcQueueCenterPage.tsx:9 (`_prompts/队列中心.txt`)
- fix: English only.

### PP-20 · R6/R7 · medium — LEGACY blocks and commented-out code
- location: PcQueueCenterPage.tsx:169-175, 196-202; PcQueueOverviewPanel.tsx:30-37; PcSentenceQueuePanel.tsx:58-64 (`[gpt-5.3-codex-spark:LEGACY-START]` …); PcBooksPage.tsx:1438
- fix: delete.

### PP-21 · R6 · low — Long doc headers (15-27 lines, partly stale)
- location: PcContentPage.tsx:1-25; PcImageSearchPage.tsx:1-27; PcBooksPage.tsx:1-20; PcSubtitleSearchPage.tsx; PcCoreBookPage.tsx:1-20; PcAiPage.tsx; PcTranslatePage.tsx; PcWordAudioPage.tsx; PcCodeSyncPage.tsx; PcWindowAutomationPage.tsx:1-12
- fix: ≤1 line purpose.

### PP-22 · R7 · medium — `any` and eslint-disable
- location: `catch (e: any)` PcTranslatePage.tsx:129, 145; PcSubtitleSearchPage.tsx:211, 225, 240, 265, 296; PcTaskLogPage.tsx:32; PcWordAudioPage.tsx:78; PcVideoExtractPage.tsx:342, 354; PcImageSearchPage.tsx:179, 196, 222; PcCodeSyncPage flash handlers. `as any` PcSentenceQueuePanel.tsx:43, 100, 119, 120; PcAgentHistoryPage.tsx:696; PcRecentTasksPanel.tsx:206-207; agent-history/PcAgentHistoryConfigPanel.tsx:177-178; PcSettingsPage.tsx:49, 130. `vp<any>` vocabulary/VocabTtsQueueTab.tsx:34, 50; VocabWordsTab.tsx:60, 73, 156; VocabLearningTasksPanel.tsx:34, 149; VocabTranslateTab.tsx:72, 79, 96. exhaustive-deps: PcCoreBookPage.tsx:136; PcVideoExtractPage.tsx:400
- fix: `unknown` + `pcFailureMessage`; add missing fields (`content`, `concurrency`, `last_error`) to apps/pycore-manager/api types; real effect deps.

### PP-23 · R7 · low — Useless wrapper component
- location: PcCoreBookPage.tsx:459 (`ListedIcon`, used once at 443)
- fix: inline `<Plus className="w-4 h-4" />`.

### PP-24 · OPT · high — Oversized single-component files
- location: PcTerminalPage.tsx (2,230; one component 420-2230); PcBooksPage.tsx (1,538); PcCodeSyncPage.tsx (1,372); PcVideoExtractPage.tsx (1,291)
- fix: split like `audio-orchestration/`: Terminal → schedule editor, screenshot viewer, draft store; Books → add modal, analyze table, auto-flow; CodeSync → mesh, filters, drift, chart; state into hooks.

### PP-25 · OPT · medium — Terminal page re-renders every second
- location: PcTerminalPage.tsx:797-800 (`setInterval(() => setNowMs(Date.now()), 1000)`; `nowMs` read only at 1520, 1524, 1657, 2169)
- fix: `<ScheduleCountdown target=… />` child owning its interval.

### PP-26 · OPT · low — Derived lists recomputed each render
- location: PcTerminalPage.tsx; PcBooksPage.tsx:1431 (`selectedLangList()` passed as prop)
- fix: `useMemo` after the PP-24 split.

i18n spot check: all 441 `t()` keys and 480 `L`-map keys in pages/ exist in en and zh (leaf-name match).

---

## Section PM — apps/pycore-manager (api, components, hooks, persistence, utils, pc-locales, top-level Pc*.tsx)

All paths below are under `apps/pycore-manager/` unless shown otherwise. Note: another session was editing PcFloatingLog.tsx, PcLiveContext.tsx, components/PcTagFilteredLog.tsx, pc-locales/PcEnCore.ts, PcZhCore.ts and added components/PcLogLineRow.tsx during the audit; re-check line numbers there.
pc-locales status: en and zh both have 2,362 keys, full parity; every literal `t()`/`pcT()` key exists.

### PM-01 · R1 · high — PcDictionaryPanel uses a literal English label object
- location: components/PcDictionaryPanel.tsx:20-42 (header :10-11 justifies it)
- fix: `dictionary.*` keys in PcEnFeatures/PcZhFeatures; `useTranslation('pc')`; delete the `D` object and the header.

### PM-02 · R1 · medium — English FALLBACKS object
- location: components/PcAiUsageRecordsPanel.tsx:19-43 (20 strings)
- fix: use `pc` keys directly; delete `FALLBACKS`.

### PM-03 · R1 · high — Hardcoded JSX text/titles/aria/placeholders
- location: components/PcTaskSynthInfo.tsx:23, 30, 32, 38, 47, 49; components/PcRecordsPanel.tsx:206, 212, 243, 265, 291, 296; components/PcAssistStrip.tsx:46-47, 50, 66, 97, 123, 128; components/PcTopBar.tsx:46; components/PcWordAudioLog.tsx:72-73; PcHttpDebugger.tsx:104, 142, 158, 213; components/PcTestPopup.tsx:101, 113, 127, 463, 480, 486, 500-504, 676, 686, 699, 711, 724; components/PcAiCapabilityView.tsx:573, 576, 579; components/PcAiCapabilityParts.tsx:157, 203-206; components/PcAiKeysView.tsx:65-69; components/PcPipelineStatusPanels.tsx:35, 236, 273, 381, 447, 510, 528
- fix: `pc` keys via `t()`; reuse `ai.*` keys for key-chip titles.

### PM-04 · R1 · medium — Literals where keys already exist
- location: components/PcPipelineStatusPanels.tsx:218 (use `pipeline.aiVisionFallbackTitle`, used at 231), 229 (use `pipeline.active`, used at 212)

### PM-05 · R1 · medium — Error styling decided by English text
- location: components/PcAssistStrip.tsx:159-161 (`message.startsWith('Run failed')`)
- fix: `{ kind: 'error'|'info', text }` state.

### PM-06 · R1 · medium — Hardcoded error sentences
- location: components/PcAiCapabilityParts.tsx:49-66; hooks/useQueueWorkerEventPage.ts:40, 45; components/PcTagFilteredLog.tsx:66
- fix: `pcT()` keys; `pcFailureMessage`/`pcLaravelErrorMessage` from utils/pcErrorCodes.ts.

### PM-07 · R1 · medium — Test profile labels/hints are literals
- location: components/PcTestEngineProfiles.ts (96 `label:`, 54 `hint:`; e.g. 130-186, 328)
- fix: `testPopup.fields.*` keys translated in the renderer.

### PM-08 · R2 · high — Key-slot chip strip duplicated
- location: components/PcAiCapabilityParts.tsx:174-230 (`KeyRotation`) vs components/PcAiKeysView.tsx:27-80 (`KeySlots`)
- fix: one `KeySlotChips` with an optional `action` slot; delete `KeySlots`.

### PM-09 · R2 · high — Seven runtime stores hand-roll notify/patch/subscribe
- location: api/AgentHistoryRuntimeStore.ts:97-128; api/CodeSyncRuntimeStore.ts:74-113; api/LlmStatusRuntimeStore.ts:33-50; api/PycoreCapabilityStore.ts:60-77; api/PycoreEngineLoadStore.ts:41-53; api/AudioLaneStateStore.ts:46-78; api/AgentHistoryVideoRuntimeStore.ts:26; hooks/TaskCenterState.ts:43-62
- fix: one `createRuntimeStore<T>()` in `core/persistence` next to `PersistedStore.ts` (subscribe, patch, debounced persist, `errorMessage`); migrate all. Also removes PM-13 event-name strings.

### PM-10 · R2 · medium — Second usage-records viewer
- location: components/PcAiUsageRecordsPanel.tsx (4 s poll at 17, 116) vs `shared/ai-usage/AiUsagePanel.tsx` (10 s poll)
- fix: add filters/paging to `AiUsagePanel`; remove or thin-wrap this panel.

### PM-11 · R2 · medium — Formatters duplicate utils/pcFormat.ts
- location: components/PcAiUsageRecordsPanel.tsx:45; components/PcAiHistoryView.tsx:49; PcHttpDebugger.tsx:44; components/PcAiCapabilityParts.tsx:125, 184; components/PcAiKeysView.tsx:36
- fix: `absoluteTime`/`formatElapsed`; add `formatCooldown` to pcFormat. See PP-11/VX-06.

### PM-12 · R2 · low — Pointless alias wrappers
- location: utils/pcFormat.ts:7-9 (`humanBytes`, 18 callers); api/PycoreCache.ts:70-72 (`loadTtlCacheStale`)
- fix: call `core/utils/formatBytes` and `loadTtlCache` directly.

### PM-13 · R2 · medium — Modal/popover behaviour re-implemented
- location: Escape: components/PcFloatingPanel.tsx:20-27, components/PcTestPopup.tsx:322-327, components/PcWordAudioQueueModal.tsx:27-34; outside-click: components/PcLaravelEndpointSwitcher.tsx:64-71, components/PcPycoreTargetSwitcher.tsx:141-149
- fix: `useEscapeKey`, `useOutsideClick` hooks; `PcFloatingPanel` via `shared/ui/Portal` + `OVERLAY_Z` (`shared/styles/overlay.ts`); build both modals on it.

### PM-14 · R2 · medium — Hardcoded language option lists
- location: components/PcTestEngineProfiles.ts:41-55, 138, 141, 186
- fix: derive from `SUPPORTED_LEARNING_LANGUAGES` (`core/i18n/supportedLearningLanguages.ts`).

### PM-15 · R2 · medium — Near-duplicate sync/fill event handlers
- location: PcVideoExtractContext.tsx:384-411 vs 414-440
- fix: one `subscribeStageProgress(topic, onDone, onError)`.

### PM-16 · R2 · low — Duplicated queue types/mapping
- location: api/PcQueueCenterExchange.ts:44-81, 125-150
- fix: `Partial<QueueCenterExchangeResult>`; one `toQueueCounts(stats)`.

### PM-17 · R2 · medium — Inverted layering
- location: components/PcAiUsageRecordsPanel.tsx:6 imports `../pages/agent-history/PcPager`; `shared/prompt-derived/PromptDerivedPanel.tsx:17-20` imports `useAgentHistoryRuntime` from `@/apps/pycore-manager/api`
- fix: PcPager → components/ (see PP-13); agent-history runtime store → `core/integrations/pycore`, or inject it.

### PM-18 · R3 · medium — Store event names as local strings
- location: api/AgentHistoryRuntimeStore.ts:14; api/CodeSyncRuntimeStore.ts:20; api/LlmStatusRuntimeStore.ts:12
- fix: `PYCORE_BROWSER_EVENTS` in `core/integrations/pycore/PycoreNetwork.ts`, or drop via PM-09.

### PM-19 · R3 · medium — Scattered poll intervals/timeouts
- location: PcVideoExtractContext.tsx:238 (2000); components/PcAiUsageRecordsPanel.tsx:17; api/AgentHistoryVideoRuntimeStore.ts:14; api/AudioLaneStateStore.ts:34; hooks/useQueueCenterHub.tsx:375 (20_000); api/AgentHistoryRuntimeStore.ts:103, api/CodeSyncRuntimeStore.ts:94 (250); PcLanguageSync.tsx:88 (400); components/PcTestPopup.tsx:318 (100)
- fix: named entries in `PYCORE_HTTP_DEFAULTS`.

### PM-20 · R3 · medium — Storage keys bypass PycoreManagerStorageKeys
- location: api/PycoreCache.ts:47 (`'pycore_ttl_cache:'`); PcVideoExtractContext.tsx:44 (`'pycore.video-extract'`); api/CodeSyncRuntimeStore.ts:24 (`'pycore.code-sync'`)
- fix: add to `persistence/PycoreManagerStorageKeys.ts`.

### PM-21 · R3 · low — Magic defaults and repeated sample
- location: PcVideoExtractContext.tsx:300, 303 (`['en','zh']`); OCR sample `'Hello OCR 123\n你好世界'` at components/PcTestPopup.tsx:291, 301, 332, 351, 374, 422 and components/PcTestEngineProfiles.ts:177, 181, 185, 408
- fix: `DEFAULT_CORR_LANGUAGES`; export one `DEFAULT_OCR_SAMPLE`.

### PM-22 · R4 · low — Constants/state mid-file
- location: PcVideoExtractContext.tsx:192 (`NOTICE`); api/PycoreCache.ts:47; api/CodeSyncRuntimeStore.ts:36, 54-72
- fix: hoist under imports.

### PM-23 · R5 · medium — Chinese in code
- location: PcVideoExtractContext.tsx:58, 113, 134, 137; components/PcDictionaryPanel.tsx:21-41; pcPages.tsx:41; hooks/useQueueCenterHub.tsx:8; components/PcQueueBumpToasts.tsx:3; components/PcTestEngineProfiles.ts:130, 133, 134, 137, 140
- fix: remove comments; Chinese samples into zh locale or one named sample constant.

### PM-24 · R6 · medium — Long design/history comments
- location: PcVideoExtractContext.tsx (~150 comment lines: 1-27, 49-51, 194-196 stale, 286-294, 341-346); components/PcSentenceAudioPanel.tsx:1-35; pcPages.tsx:20-41, 58-73; api/PcQueueCenterExchange.ts:75-78, 112-114; api/PycoreCache.ts:1-11; hooks/useTopicDrivenRefresh.ts:18 ("FIX V9"); components/PcTestPopupContext.tsx:53
- fix: ≤1 line intent; design notes to apps/pycore-manager/docs/.

### PM-25 · R7 · medium — Dead PcOperationContext
- location: PcOperationContext.tsx; mounted at PcProviders.tsx:16
- fix: delete file and provider.

### PM-26 · R7 · medium — Unused exports/stores
- location: api/LlmStatusRuntimeStore.ts (whole store); api/PycoreCache.ts:27-40 (`loadQueueCache`, `saveQueueCache`, `queueCacheAgeMs`); api/AgentHistoryRuntimeStore.ts:130, 220; components/PcTaskSynthInfo.tsx:61, 76; utils/pcTaskResult.ts:17, 22, 28, 32; utils/pcQueueCenterTypes.ts:26-28
- fix: delete, including the `export *` at api/index.ts:14.

### PM-27 · R7 · medium — Unused state in PcLiveContext
- location: PcLiveContext.tsx (`latestSettings`, `onSystemSettings`, `systemSettingsUpdate` subscription — duplicated by PcLanguageSync.tsx:54-60)
- fix: remove.

### PM-28 · R7 · low — Unused/split imports
- location: PcVideoExtractContext.tsx:39 (`useTopicDrivenRefresh` unused); 32-36 (4 separate imports from the same module)

### PM-29 · R7 · medium — Heavy `any`
- location: PcVideoExtractContext.tsx (17: 204-221, 236, 244, 264, 384, 414, 442-580); api/AgentHistoryRuntimeStore.ts (130, 317, 329 …); components/PcAiCapabilityView.tsx (7); components/PcCapabilityDrawer.tsx (5); hooks/TaskCenterState.ts:67, 71, 188, 215; api/CodeSyncRuntimeStore.ts:131, 175; PcLiveContext.tsx handlers
- fix: `VideoExtractTask`, `PcTaskRecentResponse`, or `unknown` + narrowing.

### PM-30 · R7 · low — exhaustive-deps suppressions
- location: PcLanguageSync.tsx:49, 66; PcVideoExtractContext.tsx:367; components/PcAiKeysView.tsx:154; components/PcAiBalancesView.tsx:123; components/PcAiUsageRecordsPanel.tsx:110; components/PcSentenceAudioPanel.tsx:139; components/PcTagFilteredLog.tsx:37; components/PcAiStudioView.tsx:150; components/PcAiCapabilityView.tsx:321

### PM-31 · OPT · medium — PcLiveContext re-renders all consumers per log line
- location: PcLiveContext.tsx (provider value built each render, bundles `logs`)
- fix: `useMemo` value; log consumers read `pycoreConsoleLogStore` via `useSyncExternalStore`.

### PM-32 · OPT · low — PcVideoExtractContext value not memoized (~25 fields, changes every 2 s)
- location: PcVideoExtractContext.tsx:602-609
- fix: `useMemo`, or split state/actions contexts.

### PM-33 · OPT · low — Near-limit files
- location: components/PcTestPopup.tsx (773); components/PcAiCapabilityView.tsx (764)
- fix: split PcTestPopup (theme, OCR helpers, result renderer) and PcAiCapabilityView (provider card, toolbar).

### PM-34 · OPT · low — Storage migration runs on import
- location: api/CodeSyncRuntimeStore.ts:26-36 (`removeLegacyPollingSession()`)
- fix: delete, or run once from the persistence bootstrap.

---

## Section WS — apps/wordnew non-UI layers (api, services, platform, runtime-store, locales, top-level)

All paths below are under `apps/wordnew/` unless shown otherwise. Items marked **[delete: approval]** remove files and need user approval first (AGENTS.md: no destructive action without approval).

### WS-01 · R7 · high — Captured API dumps committed with no importer [delete: approval]
- location: _niv.json, _nivs.json, _nivch2.json (~6.7 MB each), _nivc.json (130 KB), _ref.json
- problem: raw `{"success":true,"data":…}` Bible responses; nothing in the repo references them.
- fix: `git rm`, or move to a test-fixture location outside the app source.

### WS-02 · R6 · high — Mock data served as real content in production
- location: api/methods/social.ts:24-25, 529-542; api/WfNewApiMappers.ts:260-265
- problem: `getSubtitleCourses`, `getAnalytics`, `getBilingualSentences` return `MOCK_*` from WfNewMockDb.ts (bundles 29 KB mock DB, fake stats).
- fix: return empty/"not available" until endpoints exist; remove WfNewMockDb from the production import graph. Related: WC-07, WP-03 (Analytics).

### WS-03 · R7 · medium — Whole mock implementation is dead [delete: approval]
- location: api/WfNewApiMock.ts (776), api/WfNewApiMockHelpers.ts (419), api/methods/mockSocial.ts (313), api/methods/mockLearning.ts (167), api/methods/mockOrchAudio.ts, `mockOrchClientTaskMethods` in api/methods/orchClientTasks.ts:85, 13 `WORDNEW_MOCK_*` keys in persistence/WordNewStorageKeys.ts:20-32; only reachable via commented lines api/index.ts:20, 23
- fix: delete; if offline mode is needed, select by build flag outside the production barrel.

### WS-04 · R7 · high — ~9.2k lines of unused capability modules [delete: approval]
- location: platform/capabilities/: CapAppState, CapAppStateCore, CapStudySession, CapAudioPlayback, CapAudioRecorder, CapAudioRecorderCore, CapAutoSchema, CapAutoStore, CapAutoWebDb, CapBattery, CapGeolocation, CapGeolocationCore, CapGeolocationGeofencing, CapHaptics, CapKeepAwake, CapMicMonitor, CapNetwork, CapNetworkCore, CapNetworkReachability, CapNotifications, CapNotificationsCore, CapNotificationReminders, CapSpeechRecognition, CapTextToSpeech
- problem: only CapJsonStore, CapBlobStore, Directory, storage helpers, CapResourceAssetCache, CapResourcePackage, capDb, pickPhoto, useSocialAuth are used outside platform/; the rest are reachable only via the index barrel (0 users).
- fix: remove them and their re-exports in index.ts. Note WP-06 suggests `CapTextToSpeech`: if you adopt it there, keep that one module.
- side effect: also removes their hardcoded English strings (CapNotificationsCore.ts:425-450, CapNotificationReminders.ts:69, 227, CapNetworkReachability.ts:175, CapAudioRecorderCore.ts:330, 454, CapTextToSpeech.ts:335, 420) and stray storage keys (WS-20).

### WS-05 · R7 · low — Dead Capacitor web shims [delete: approval]
- location: platform/capacitor-web-shims/toast.ts (console.log :10), dialog.ts, status-bar.ts, keyboard.ts, preferences.ts; aliases in vite.config.ts:137-142
- fix: drop shims and aliases (plus shims for modules removed in WS-04).

### WS-06 · R1 · high — Keys referenced but missing everywhere
- location: pages/WfNewLibraryPage.tsx:455, 462, 470 (see WP-01); components/WfNewSocialVideo.tsx:187 (`social.video.openPlayer`); components/WfNewSocialLive.tsx:247 (`social.live.notFound`); components/WfNewSocialPlaza.tsx:281-282 (`social.compose`)
- fix: add to en, zh, ja, ko.

### WS-07 · R1 · high — ja/ko missing 434 keys (supersedes WP-02 count)
- location: locales/ja.ts, ko.ts (no `ja_c.ts`/`ko_c.ts`); ja_a/ja_b, ko_a/ko_b
- problem: en/zh 1,356 keys; ja/ko 922. Largest gaps: home 117, orchCompose 69, orchAudio 37, apiCenter 34, reader 30, cache 22, ttsPriority 20, lm 20, library 19, lang 15, profile 13, rev 12, auth 9.
- fix: add `ja_c.ts`/`ko_c.ts`; fill all; type ja/ko against the en key type for compile-time parity.

### WS-08 · R1/R6 · medium — Fake profile defaults
- location: WfNewSettingsStore.ts:133-139 (`'WordNew Commander'`, `'commander@wordnew.universe'`, bio), 201 (`streakDays: 8`)
- fix: empty/0 defaults; i18n placeholders.

### WS-09 · R1 · medium — Theme names as en/zh pairs
- location: WfNewThemes.ts:3-4, 19-20, 33-34, 47-48, 61-62 (used by WP-04 sites)
- fix: `theme.<id>.name` keys (do together with WP-04).

### WS-10 · R1 · medium — English fallbacks/errors in the API layer
- location: api/WfNewApiMappers.ts:227, 290, 313, 329, 344 (`'Untitled'`); api/WfNewApiHttp.ts:349 (`'Article'`), 674, 695; api/WfNewApiTransport.ts:170, 190, 273, 324, 364, 385; api/WfNewAdminApi.ts:279; utils/WordNewSentenceAudioPick.ts:19 (`'Primary'`)
- fix: return null/error codes; resolve text with `trans`/`translateActive` at render.

### WS-11 · R1 · low — User agreement outside locales
- location: WfNewUserAgreement.ts:31-230
- fix: move into locale resources or per-language assets loaded by i18n.

### WS-12 · R2 · medium — Own toast store
- location: WfNewNotify.ts:17-83
- fix: `notify` from `@/shared/notify/notify`; delete WfNewNotify (same pattern as VX-04, PP-08).

### WS-13 · R2 · medium — Own i18n engine instead of core i18next
- location: WfNewLocales.ts:15-74 (header cites non-existent WordNewLanguageCenter.ts)
- fix: register wordnew dictionaries as an i18next namespace in `core/i18n/UiI18n.ts`; use `useTranslation`/`i18n.t`. Do WC-01 first (merge `studyT`) so only one migration is needed.

### WS-14 · R2 · medium — Duplicate learning-language catalog (already drifted)
- location: api/WfNewApiDefaults.ts:26-49 (`WFNEW_BUILTIN_LANGUAGES`); WfNewLocales.ts:32-37
- fix: import `SUPPORTED_LEARNING_LANGUAGES` from `core/i18n/supportedLearningLanguages.ts`. Same target as WP-20, WP-27, PM-14.

### WS-15 · R2 · medium — Transport repeats POST/parse/error 4×, inconsistent errors
- location: api/WfNewApiTransport.ts:258-280, 300-340, 347-373, 377-387; api/WfNewAdminApi.ts:251-287
- fix: one `sendJSON(method, path, body, opts)` or reuse `core/integrations/laravel/LaravelRequest.readLaravelResponse`.

### WS-16 · R2 · low — `stripBom` ×2; three URL resolvers
- location: api/WfNewApiTransport.ts:60-62 = api/WfNewAdminApi.ts:260-262; api/WfNewApiMappers.ts:29 (`absUrl`), :273 (`toAbsoluteUrl`, lacks https/file handling), api/WfNewAdminApi.ts:303 (`adminAbsUrl`)
- fix: one `stripBom` in core transport; `absUrl`/`laravelMediaUrl` everywhere; delete `toAbsoluteUrl`.

### WS-17 · R2/R3 · medium — Endpoint paths duplicate core ApiContract
- location: api/WfNewApiPaths.ts:53-58 (auth), 379 (`/api/health`), 386 (`/api/dashboard/auth/debug-status`)
- fix: compose from `LARAVEL_API_ROUTE`/`LARAVEL_API_PREFIX` in `core/integrations/laravel/transport/ApiContract.ts`.

### WS-18 · R3 · medium — Inline static media path
- location: api/WfNewApiHttp.ts:343 (`/static/app_qy_v1/audio/agent_history/${lang}/${id}.mp3`)
- fix: builder in WfNewApiPaths (or core contract).

### WS-19 · R3/R4 · low — Magic group name, timeouts, TTLs
- location: api/WfNewApiHttp.ts:671-674 = 692-695 (`'Default Vocabulary Group'` block duplicated); api/WfNewAdminApi.ts:329 (4000); api/WfNewApiTransport.ts:201 (5000); runtime-store/WfNewServerMirror.ts:10, 37-45; services/WordNewBookReaderWordCards.ts:17-20, 38
- fix: `resolveDefaultGroup()` + named constant; hoist timings to named top-level constants.

### WS-20 · R3/R4 · low — Storage keys outside the registry
- location: runtime-store/WfNewContentCache.ts:173 (`'wfnew_scope_collection_index'`, mid-file); platform/capacitor-web-shims/local-notifications.ts:38; CapHaptics.ts:129; CapGeolocationCore.ts:121; CapNotificationsCore.ts:101; CapNotificationReminders.ts:235
- fix: `persistence/WordNewStorageKeys.ts` (most vanish with WS-04).

### WS-21 · OPT · medium — Server response mirror grows without limit
- location: runtime-store/WfNewServerMirror.ts:6-12, 62-65, 83-93; platform/capabilities/CapResourcePackage.ts:307-327, 384-393
- problem: no eviction, no record/byte cap; `stats()` loads every record.
- fix: max records/bytes with LRU/expiry sweep on `put`; purge other scopes on logout; cheap stats.

### WS-22 · R7 · low — Unused imports in WfNewApiHttp
- location: api/WfNewApiHttp.ts:24-42 (types), 45-47, 54-56, 61, 66 (`normPresence`, `toMessage`, `toNotification`, `toActor`, `toPostImage`, `toPost`, `toComment`, `toLive`, `toLiveMsg`, `toWord`, `toGroup`, `decorate`, `logContentFallback`, `toAbsoluteUrl`, `deleteJSON`, `MOCK_*`)

### WS-23 · R7 · low — Unused exports
- location: api/WfNewApiDefaults.ts:51 (`WFNEW_BUILTIN_LANGUAGE_CODES` — WP-27 suggests it; after WS-14 use the core list instead); api/WfNewApiPaths.ts:379 (`WFNEW_HEALTH_PATH`); services/WordNewAchievementCenter.ts:55-80 (`name`/`description`; UI uses `profile.ach.<id>.*`)

### WS-24 · R7 · medium — Pervasive `any`
- location: api/WfNewApiHttp.ts (56, e.g. 73-85, 671-712); api/methods/social.ts (44); api/WfNewApiMappers.ts (21); api/methods/orchAudio.ts (11); api/WfNewApiTransport.ts:118, 247, 267; services/WordNewEventBus.ts:24-25 (event map `any`)
- fix: raw DTO interfaces per endpoint; real payload types in `WordNewEventMap`.

### WS-25 · R7 · low — console.* leftovers
- location: api/methods/social.ts:397; api/WfNewApiMappers.ts:264; api/WfNewApiHttp.ts:126, 174; api/WfNewSocialRealtime.ts:196, 220, 232; services/WordNewReadingProgressCenter.ts:32; services/WordNewReaderSettingsRoamer.ts:76, 121; services/WordNewQueueCenter.ts:172; services/WordNewRecitationCenter.ts:176; utils/WordNewClientIdentity.ts:62
- fix: remove info logs; warnings via `core/logstore`.

### WS-26 · R6 · low — History notes and long headers
- location: history: api/WfNewApiPaths.ts:34-35; services/WordNewAchievementCenter.ts:1-7; services/WordNewEventBus.ts:1; WordNewProgressCenter.ts:1; WordNewReadingProgressCenter.ts:1; WordNewRecitationCenter.ts:1; WfNewNotify.ts:4-6; api/WfNewApiTransport.ts:1-5; api/WfNewApiMappers.ts:1-3; api/methods/social.ts:1-3; api/types/{user,analytics,social,endpoints,core,media,api}.ts:1-2; locales/en.ts:1-3, ja.ts, ko.ts, zh.ts. Long headers: api/WfNewAdminApi.ts:1-33; api/WfNewApiHttp.ts:1-23 (stale); api/WfNewApiPaths.ts:8-36; api/index.ts:1-16; platform/capabilities/index.ts:1-40; platform/capabilities/CapSocialAuth.ts:1-70; runtime-store/WfNewContentCache.ts:1-38
- fix: delete history; ≤2-line headers.

### WS-27 · R5 · low — Chinese comments
- location: api/WfNewApiPaths.ts:201; services/WordNewProgressCenter.ts:6; services/WordNewRecitationCenter.ts:1; api/types/media.ts:4, 122; WfNewSettingsStore.ts:60, 95-96, 117; platform/capabilities/CapSocialAuth.ts:12, 14, 29

### WS-28 · R3/R6 · low — README lists hardcoded IPs
- location: api/README.md:44-48 (`43.163.112.77:9000`, `100.101.149.39:9000`, `100.106.85.16:9000`)
- fix: replace with a pointer to live discovery (`ApiManager`/tailnet); endpoints must never be static lists.

### WS-29 · OPT · low — Admin status probe timer leaks on failure
- location: api/WfNewAdminApi.ts:328-345
- fix: clear in `finally` or `AbortSignal.timeout(NAMED_MS)`; do not swallow parse errors silently.

### WS-30 · OPT · low — All ~25 pages imported eagerly
- location: WfNewApp.tsx:10-34 (line 10 comment stale)
- fix: `React.lazy` for WfNewAdminPage, WfNewBookReader, WfNewSocial, WfNewAnalytics, OrchAudio.

### WS-31 · bug · low — Invalid Tailwind shades in themes
- location: WfNewThemes.ts:25, 29, 37, 53, 55, 58 (`text-zinc-750`, `border-indigo-250`, `text-emerald-955`, `text-orange-955`, `text-orange-850`, `focus:border-amber-550`)
- fix: valid palette steps (see WP-33).

### WS-32 · OPT · low — Favorites in the synchronous settings blob
- location: WfNewSettingsStore.ts:200, 214-218
- fix: store word IDs only, or move favorites to the IndexedDB content cache.
