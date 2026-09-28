# frontend-ui bug audit — 2026-09-27

Role: frontend-ui (prefix FU). This audit only reports: no code, config, i18n, doc or test was changed. The only file written is this one.
Method: static reading, with each finding traced through its real call chain. Two read-only helper scripts (TypeScript transpile in memory, kept in the session scratchpad) checked i18n keys: used-but-undefined keys and en/zh parity for the `cm`, `pc`, `lm` and mcp-chrome `_locales` bundles. `node --check` was run on `apps/mcp-chrome/scripts/dev-watch.mjs` (OK). Nothing was built, run or tested.

Paths are relative to `poly_apps/pycore_laravel_wordnew_ui/` (UI) or `apps/mcp-chrome/` (MC) unless absolute.
Counts: 0 critical, 4 high, 10 medium, 13 low (27 findings). Reviewer duplicates: none. RV-003/004/005/008/009 do not overlap these findings.

**In-flight note:** the user's CodeMart polish session edited `apps/codemart/**` files 02:10–02:42. Every finding in a file modified after 02:10 was re-read at 02:42 and is tagged `[in-flight, last read 02:42]`. Items that disappeared are listed under `## In-flight observations`.

---

## Findings

### FU-001 — The MCP native server on loopback accepts any web origin and has an unauthenticated SHUTDOWN endpoint: any web page can kill the host, and DNS rebinding reaches the MCP browser-control tools.
- severity: high · category: security · confidence: likely (the SHUTDOWN path is confirmed in code; DNS rebinding was not exercised)
- location:
  - MC `app/native-server/src/constant/index.ts:20` (`CORS_ORIGIN: true`);
  - MC `app/native-server/src/server/index.ts:73-75` (`@fastify/cors` with `origin: true`), `:46-50` (`setCanShutdownCallback(() => true)`), `:345-357` (`POST /singleton`), `:188-215` (`POST /mcp` creates a transport for any initialize request);
  - MC `app/native-server/src/server/singleton.ts:392-431` (SHUTDOWN → `process.exit(0)`).
- failure scenario:
  1. The user visits any page while the host runs. The page calls `fetch('http://127.0.0.1:<mcp_chrome port>/singleton', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({protocol:'CHROME_MCP_SINGLETON_V1', type:'SHUTDOWN', pid:1, timestamp:0, appId:'chrome-mcp-native-server'})})`.
  2. The preflight passes: the origin is reflected and the requested headers are allowed by default.
  3. The handler always accepts, answers SHUTDOWN_ACK and exits 300 ms later. Active MCP sessions die. The page can repeat this after every watchdog reconnect.
  4. With DNS rebinding (attacker host → 127.0.0.1), requests become same-origin. No Host or Origin check exists, and `StreamableHTTPServerTransport` is built without `enableDnsRebindingProtection`/`allowedHosts`. The page can then `initialize` and `tools/call` against the user's logged-in browser.
  5. Each foreign `initialize` also adds an entry to `transportsMap` that is never reclaimed.
  - Mitigation note: recent Chrome may prompt for local-network access, which would blunt steps 1–4; the Firefox build has no such guard. Neither was verified.
- evidence: the constants and routes cited above. No auth token, Origin allow-list or Host validation exists anywhere in `server/index.ts`. This is the same defect class as PR-001 (pycore RPC), but a different server.
- suggested fix: restrict CORS to the extension origin, require a per-install token on `/singleton` and `/mcp`, and enable the SDK's DNS-rebinding protection (allowedHosts 127.0.0.1/localhost).

### FU-002 — Every Laravel `BaseAPI` GET is served from a 5-second response cache that also stores failures and is never invalidated, so reloads after a mutation and Retry buttons show stale data app-wide.
- severity: high · category: race/stale-state · confidence: confirmed (the mechanism) / likely (the timing)
- location: `core/integrations/laravel/transport/BaseAPI.ts:283-292`; `core/network/RequestCoordinator.ts:7-27`.
- failure scenario:
  1. `request()` routes every GET through `coordinateRequest(key, …, 5000)`. `recentResponses` keeps any resolved value for 5 s, and `BaseAPI` resolves failures as `{success:false}`, so failures are cached too. `clearCoordinatedRequests` has no caller (grep).
  2. CodeMart: in `CmMilestoneCard`, complete milestone A (→ `onChanged=load` → GET `projects/{id}`). Complete milestone B within 5 s: the reload returns A's cached response and B still shows open. `CmProjectDetailPage.tsx:415,430`. `[in-flight, last read 02:42]`
  3. Other CodeMart paths behave the same:
     - a second task comment within 5 s (`CmTasksPage.tsx:157-161`) → the list misses it `[in-flight, last read 02:42]`;
     - architect accept → `load()` (`CmReviewsPage.tsx:442-446`) `[in-flight, last read 02:42]`;
     - admin approve → `useCmAdminList.reload`.
  4. U3 Data Sync: `DataSyncTab.tsx:347` polls every 2 s. Cancel → `replaceSession(cancelled)`. The next tick returns the cached pre-cancel workspace, so the session flips back to `running` with Pause/Cancel re-enabled for up to ~5 s.
  5. Every "Retry" pressed within 5 s of a network failure (CmErrorState, CmAdminListState, admin detail) returns the cached failure.
  6. The laravel-manager cover-task poll (3 s, `AppQyV1.getLibraryCoverTasks`) is served from cache on every other tick.
- evidence: `BaseAPI.ts:285-291` (`if (config.method === 'GET' && retryCount === 0) return coordinateRequest(…, 5000)`); `RequestCoordinator.ts:19-21` stores every resolved value. `LaravelRequest.ts:75` uses the same coordinator with ttl default 0, which is correct.
- suggested fix: default the BaseAPI coalescing TTL to 0 (in-flight dedupe only), never cache `success:false`, and clear on any non-GET.

### FU-003 — `BaseAPI` retries non-idempotent POST/PUT/PATCH/DELETE up to 3 times after a timeout or network error, so a slow server gets duplicate writes.
- severity: high · category: correctness · confidence: confirmed (code) / likely (runtime)
- location: `core/integrations/laravel/transport/BaseAPI.ts:409-416`, `:577-580`, `:195`; `core/integrations/laravel/transport/ApiContract.ts:67-74` (active modules get no `retry` override); `core/integrations/laravel/LaravelConfig.ts:7` (30 s timeout).
- failure scenario:
  1. A write takes more than 30 s, or the connection drops after the server received it. `AbortError`/`TypeError` → `shouldRetry` → the same body is re-sent up to 3 more times (FormData included).
  2. Affected writes:
     - CodeMart `createProject` (`apps/codemart/api/CmApi.ts:196`), `createMilestone`, `createTask`, `addTaskComment`, `submitTask` (multipart), `analyzeProject`, `requestPhoneVerification` (up to 4 SMS), `requestRole`;
     - admin `approveWithdrawal`/`payWithdrawal`/`processRefund`/`confirmDeposit`/`resolveDispute` (`admin/CmAdminApi.ts`);
     - every laravel-manager module write.
  3. Only the `postIdempotent` calls (fund, deposit, payment, refund request, withdrawal request) are protected. Fixed-endpoint modules (`createFixedLaravelModuleConfig`) set retry 0 and are safe.
- evidence: `if (retryEnabled && retryCount < this.retryConfig.count && this.shouldRetry(error))` applies to every method. `retryConfig` defaults to `{count: 3, delay: 1000}`.
- suggested fix: retry only GET/HEAD, and requests carrying an `Idempotency-Key`.

### FU-004 — The Terminal Control desktop-integration panel (R7) reads the wrong i18n namespace, so every label, capability, button and notice renders as a raw key in en and zh.
- severity: high · category: i18n · confidence: confirmed
- location: `apps/pycore-manager/components/PcTerminalDesktopIntegration.tsx:43`.
- failure scenario:
  1. `useTranslation()` without a namespace resolves the default `translation` namespace. `core/i18n/UiI18n.ts` sets no `defaultNS`.
  2. The `terminal.desktop.*` and `terminal.errors.*` keys live in the `pc` namespace (`pc-locales/PcEnFeatures.ts:156`, registered by `pc-locales/index.ts`).
  3. `translation` holds only the laravel-manager bundle (`apps/laravel-manager/i18n.ts`), which has no `terminal.*` keys.
  4. The panel therefore shows `terminal.desktop.title`, `terminal.desktop.installBridge`, and so on. Capability detail notices (`errorTranslationKey(detail)`) also show raw keys. The U4 R6/R7 requirement ("every code translated") fails.
- evidence: this is the only bare `useTranslation()` in `apps/pycore-manager` (grep). The parent `PcTerminalPage.tsx:413` uses `useTranslation('pc')`.
- suggested fix: `useTranslation('pc')`.

### FU-005 — Data Sync (U3) action errors disappear within 2 s because the workspace poll overwrites the shared `error` state.
- severity: medium · category: state · confidence: confirmed
- location: `apps/laravel-manager/components/views/database-manager/DataSyncTab.tsx:325-333` (poll sets `error`), `:347` (2 s interval), `:647` (single error box). The catch blocks of `start`/`togglePause`/`cancelSelected`/`bindTarget` write the same state.
- failure scenario: Start with an unreachable or same-node new server → `dbSync.directionNone`/`dbSync.sameNode` is shown. The next poll runs `setError(workspace.errors.length > 0 ? … : null)` and clears it. The user sees a flash, or nothing.
- evidence: `loadWorkspace` always calls `setError(...)`, and the start-error branch sets the same state.
- suggested fix: separate `actionError` (cleared by user action) from the workspace/node error.

### FU-006 — Data Sync resolves a typed new-server address by hostname only, ignoring port and scheme, so it targets the wrong node or wrongly reports "same node".
- severity: medium · category: correctness · confidence: confirmed
- location: `apps/laravel-manager/models/DataSyncModel.ts:235-258` (`byHost`).
- failure scenario:
  1. The registry has `http://192.168.1.20:9000`, and the user types a second Laravel instance at `http://192.168.1.20:9100`. `resolveNewServer` returns the registry endpoint.
  2. If that endpoint is the old server, `sameNode` (id equality) blocks the sync.
  3. If it is another registered node, `probeDirection`/`start` sync against that other node's `syncTarget`, and data is written to an unintended server.
- evidence: `new URL(endpoint.baseUrl).hostname.toLowerCase() === host`. `normalizeAdhocAddress` (with port) runs only after `byHost` misses.
- suggested fix: compare normalized `scheme://host:port` (`normalizeAdhocAddress(input)` vs `syncTarget`).

### FU-007 — The Bing worker's private `pullTasksAcrossTypes` drops tasks it already claimed when a later type's pull fails, and it over-claims up to 3× batchSize.
- severity: medium · category: correctness · confidence: likely
- location: MC `app/chrome-extension/entrypoints/background/services/bing-dictionary-worker-service.ts:217-236`.
- failure scenario:
  1. The `dictionary_explanation` pull returns and claims 2 tasks. The `word_translation` pull then fails (network blip or 5xx).
  2. `return resp` discards `merged`: the claimed tasks are neither processed nor released and sit assigned until the server lease reclaims them.
  3. Each type also pulls with the full `limit` (`limit: options.limit`), so up to 3×batchSize tasks are claimed. They are processed one by one on Bing tabs, so the tail can outlive its lease and be re-dispatched to another worker (duplicate work).
- evidence: the shared `task-center/SimpleWorkerRuntimeBase.ts:617-677` already does both correctly: `if (merged.length === 0) return resp; break;` and `remaining = limit - merged.length`. The Bing copy is a stale duplicate. Pulled tasks are leases, as shown by `releaseTasks(...)` in SimpleWorkerRuntimeBase (`:318`, `prefetchChangedHead`).
- suggested fix: reuse the base implementation (or keep merged and `releaseTasks` on the partial failure).

### FU-008 — Pausing while the next clip's URL is being resolved does not stop playback: audio starts under a "paused" UI, and the next press does not pause it.
- severity: medium · category: audio-state · confidence: confirmed (code trace)
- location: `apps/wordnew/services/WordNewBookReaderPlayback.ts:255-259` (after `await resolveAudioUrl` only `playing`/`token` are checked), `:287` (`audio.play()`); `pause()` ~`:95-101`.
- failure scenario:
  1. In the book reader or the orchestrated-audio player, the user presses Pause while `resolveAudioUrl` awaits (`ensureAudio` download, or a wait for Laravel generation).
  2. `pause()` sets `paused=true` and pauses nothing, because no audio element is playing yet. The await resumes, the guard passes, `audio.src` is set and `play()` starts. The UI still shows Paused.
  3. The next press calls `togglePause` → `resume()` (a no-op `play()` plus a flag flip). A third press is needed to actually pause.
- evidence: the guard at `:259` is `if (!this.playing || this.playToken !== token) return;` with no `this.paused` check. The speech path does check `paused` (`playSpeechStep`).
- suggested fix: after the await, if paused, set `src` but skip `play()`. `resume()` already calls `this.audio.play()`.

### FU-009 — An orchestrated-audio segment jump plays a stale segment, or plays audio after the page is left, when its sentence-page fetch resolves late.
- severity: medium · category: audio-state/race · confidence: likely
- location: `apps/wordnew/components/orch-audio/useOrchAudioPlayback.ts:185-194` (`ensureRange(...).then(() => playbackRef.current?.playFrom(verse))`); cleanup `:174`.
- failure scenario:
  1. The user clicks segment 3 (its sentence pages are not loaded, so a fetch is pending), then segment 5 (loaded, plays). Segment 3's fetch resolves → `playFrom(3)` jumps back.
  2. Or the user clicks a segment and presses Back. The effect cleanup `stop()`s the engine, but the pending promise calls `playFrom` on it. `playFrom` restarts a stopped engine, so audio plays with no UI and cannot be stopped until reload.
- evidence: the `.then` has no jump token and no mounted check. `WordNewBookReaderPlayback.playFrom` begins with `this.stop()` and then sets `playing=true`.
- suggested fix: bump a jump sequence (or check mounted) and ignore superseded resolutions.

### FU-010 — CodeMart's AI-analysis panel keeps polling after unmount, and when the analysis finishes it reloads the page it no longer shows.
- severity: medium · category: effect-leak · confidence: confirmed
- location: `apps/codemart/components/workspace/CmProjectAnalysisPanel.tsx:47-70`.
- failure scenario:
  1. The user leaves the project while an analysis is `processing` and a `load()` is in flight. The cleanup clears the current timer.
  2. The in-flight `load()` resolves and re-arms `pollTimer` at `:62`. The timer chain now runs every 4 s for as long as the analysis stays active (minutes).
  3. On completion it calls `projectChangedRef.current()` (`reloadAll`: GET project and bootstrap refresh) for the unmounted page.
  4. A language switch (a new `t` means a new `load`) also starts a second overlapping chain.
- evidence: `pollTimer.current = active ? window.setTimeout(() => { void load(); }, ANALYSIS_POLL_MS) : null;` runs unconditionally after the await.
- suggested fix: a disposed flag, checked before re-arming and before calling `onProjectChanged`.

### FU-011 — The pycore-manager Libraries tab fetches Laravel on every keystroke of the language box with no stale guard, so the wrong language's libraries can remain.
- severity: medium · category: race · confidence: confirmed
- location: `apps/pycore-manager/pages/vocabulary/VocabLibrariesTab.tsx:96-112` (`load` depends on `language`), `:142` (free-text input); the effect `useEffect(() => { void load(); }, [load])`.
- failure scenario:
  1. Typing `english` fires 7 `getVocabLibraries` requests.
  2. Out-of-order responses (e.g. `engl` → empty) overwrite the final result, so the grid shows "No libraries." for `english`.
  3. `pcLibraryCoverTaskModel.track` is fed the stale rows.
- evidence: there is no request id or debounce, and `setLibs(list)` runs unconditionally.
- suggested fix: apply the language on submit or blur, or debounce, and ignore superseded responses.

### FU-012 — Data Sync caches each node's API client with the node's "current" flag frozen, so after the active endpoint changes, requests to the new current node carry no token and their 401s are swallowed.
- severity: medium · category: auth/state · confidence: likely
- location: `apps/laravel-manager/models/DataSyncModel.ts:460-475` (`clients` cache by `endpoint.id`; `authToken: () => this.authHeaderFor(endpoint)` captures the endpoint object; `onUnauthorized: endpoint.current ? undefined : () => undefined`), `:422-426`.
- failure scenario:
  1. Data Sync is opened with A current and B managed, so B's client is created as a peer.
  2. The user switches the header endpoint to B. The `dataSyncModel` singleton keeps the old client.
  3. B is now current, but `authHeaderFor(capturedB)` sees `current=false`. With no peer login it sends no token, gets 401, and swallows it. The workspace reports B as needing a peer login although the user is logged in there.
  4. The stale A client (captured `current=true`) keeps sending the shared token, now issued for B, to A.
- evidence: `endpoint` is the object from the first `client()` call and is never refreshed.
- suggested fix: resolve `current` at request time (`apiManager.getCurrentEndpoint()`), or key the cache by id+current.

### FU-013 — CodeMart paged lists have no stale-response guard, so quick filter or page changes can show the wrong result set.
- severity: medium · category: race · confidence: likely
- location: `apps/codemart/components/workspace/useCmPagedList.ts:41-55`.
- failure scenario: on My Projects, change the status filter twice quickly (A→B), or in Marketplace apply filters and page quickly. If A's response arrives last, the list, `page` and `totalPages` come from A while the controls show B. The Wallet tabs and Notifications now use this hook too, so the race reaches them. `[in-flight, last read 02:42]` for those callers.
- evidence: `load` awaits `fetcher(targetPage)` and sets items, pages and page with no sequence check. `useCmAdminList` in `CmAdminShared.tsx` has one (`requestRef`).
- suggested fix: a request counter ref, as in `useCmAdminList`.

### FU-014 — The admin KYC document viewer can show one document under another's label when the admin switches documents mid-load.
- severity: medium · category: race · confidence: confirmed `[in-flight, last read 02:42]`
- location: `apps/codemart/admin/CmAdminPages.tsx:419-434` (`CmAdminKycDocumentViewer.open`).
- failure scenario:
  1. The admin clicks "ID front", then "ID back" before front loads. Both `kycFile` requests are in flight.
  2. If front resolves last, `objectUrl` becomes the front image while `active='back'` (and the alt text says back). The reviewer approves or rejects KYC looking at the wrong document.
  3. A document toggled off while loading reappears when its request resolves.
- evidence: `open` sets `objectUrl` from whatever response arrives, with no check of the currently requested type.
- suggested fix: remember the requested type (or a sequence number) and ignore mismatched responses, revoking their blob URL.

### FU-015 — One failed CodeMart bootstrap refresh after a mutation replaces the current page with "access check failed", discarding the page state and the success notice.
- severity: low · category: state · confidence: confirmed
- location: `apps/codemart/contexts/CmBootstrapContext.tsx:29-41` (`setBootstrap(null)` on failure); `apps/codemart/components/access/CmCapabilityGate.tsx:23-33`.
- failure scenario: project transition or publish → `reloadAll` → `refresh()` hits a transient network error → `bootstrap=null` → the gate unmounts the page and shows `access.checkFailed`. The same happens after marketplace accept, task changes and wallet changes.
- evidence: the failure branch clears the last good bootstrap, and the gate renders the notice whenever `!bootstrap && error && !loading`.
- suggested fix: keep the previous bootstrap when a refresh fails, and show a non-blocking error.

### FU-016 — The laravel-manager Vocabulary Libraries tab has no stale guard on language switches.
- severity: low · category: race · confidence: likely
- location: `apps/laravel-manager/components/views/VocabularyLearning.tsx:339-363`; effects `:216-226` (the initial mount also loads twice).
- failure scenario: switch the language dropdown A→B while A's request is slow. A's libraries render under B, and `libraryCoverTaskModel.track` is seeded with A's rows.
- evidence: `setLibraries(list)` runs unconditionally.
- suggested fix: a request sequence ref.

### FU-017 — CodeMart admin and public date formatters parse date-only values as UTC, so viewers west of UTC see the previous day.
- severity: low · category: correctness · confidence: likely (depends on the backend date shape)
- location:
  - `apps/codemart/admin/CmAdminShared.tsx:67-70` (`useCmAdminFormat.date`: `new Date(value)`) `[in-flight, last read 02:42]`;
  - `apps/codemart/components/public-home/cmPublicFormat.ts:36-40` (`formatCmDate`).
- failure scenario: `task.due_date = '2026-09-30'` or `…T00:00:00Z` → shows "Sep 29" in UTC−5. Examples: `CmAdminUserDetailPage.tsx:381` `[in-flight, last read 02:42]` and `CmShowcasePage.tsx:156`.
- evidence: `cmWorkspaceFormat.ts` `parseDate` already handles date-only values (`DATE_ONLY_PATTERN` → local midnight). The two copies do not (see FU-026).
- suggested fix: delegate to `cmFormatDate`.

### FU-018 — Terminal viewer-lease error codes have no translation, so the UI shows "unknown error".
- severity: low · category: i18n/contract · confidence: confirmed
- location: `apps/pycore-manager/pages/PcTerminalPage.tsx:77-140` (`ERROR_TRANSLATION_KEYS`).
- failure scenario: pycore raises `terminal_viewer_id_required`, `terminal_viewer_window_limit_exceeded` or `terminal_viewer_limit_exceeded` (`/mnt/dev_nvme0n1p1/programing/core_node/pycore/pyctl/terminal/terminal_screenshot_cache.py:80-88`), for example with too many viewer tabs. `errorTranslationKey` falls back to `terminal.errors.unknown`.
- evidence: a diff of the codes in pycore/pyutils/window and pycore/pyctl against the map found only these three missing.
- suggested fix: add the three codes with en/zh texts.

### FU-019 — wordnew's server dialog switches endpoints without verifying them, pinning dead or mixed-content-blocked endpoints.
- severity: low · category: endpoint · confidence: confirmed
- location: `apps/wordnew/components/WfNewApiServerDialog.tsx:51` → `apps/wordnew/api/WfNewEndpoints.ts:187-192` → `core/integrations/laravel/ApiManager.ts:414-426` (`setEndpoint`: no probe, no mixed-content check).
- failure scenario: on `https://…`, the user picks an `http://` LAN endpoint. The "selected" toast fires, the user pin persists, and requests target the blocked endpoint until `recheckAndFailover` finishes.
- evidence: FIX_20260919 (mixed-content refactor) says `switchEndpoint()` is "the ONLY path UI switchers should use" (`ApiManager.ts:428-440`). pycore-manager uses it; wordnew does not.
- suggested fix: call `apiManager.switchEndpoint` and toast on its result.

### FU-020 — The library-cover model loses already-queued tasks when a later chunk fails, and polls forever for ids the server stops returning.
- severity: low · category: state · confidence: likely
- location: `shared/library-cover/LibraryCoverTaskModel.ts:219-237` (enqueue rollback), `:304-347` (poll).
- failure scenario:
  1. Enqueue more than 200 ids. Chunk 1 succeeds and chunk 2 throws, so every target is restored to its previous state. Chunk-1 tasks exist server-side but no badge shows until a list reload.
  2. A library deleted while active is never returned by the status endpoint, so its entry stays `active`. The 3 s poll never stops while a view subscribes.
- evidence: the catch restores all `targets`; the poll only updates the ids that come back.
- suggested fix: keep the chunk results gathered before the failure; mark missing ids inactive.

### FU-021 — The Bing worker has no in-progress guard on start, so concurrent starts double-register the worker.
- severity: low · category: race · confidence: likely
- location: MC `app/chrome-extension/entrypoints/background/services/bing-dictionary-worker-runtime.ts:251-303`.
- failure scenario: the watchdog `resume()` is awaiting `registerWorker()` when the user presses Start (or the reverse). Both pass `if (this.isRunning)`. Two registrations happen, the first worker id is orphaned (it shows "online" until heartbeat expiry), and `enqueuePending` runs twice.
- evidence: `isRunning = true` is set only at `:303`, after the awaits.
- suggested fix: a `starting` promise that both callers await.

### FU-022 — The CodeMart estimate form clamps its number inputs on every keystroke, so users cannot type values normally.
- severity: low · category: ux-correctness · confidence: confirmed
- location: `apps/codemart/pages/CmEstimatePage.tsx:158,169`.
- failure scenario: clearing the field gives `Number('')=0`, clamped to min (1). Typing "5" then yields "15", clamped to max. Multi-digit entry from an empty field is not possible.
- evidence: `onChange={(event) => updateDraft({ platforms: clamp(Number(event.target.value), …) })}`.
- suggested fix: keep the raw string while editing and clamp on blur or submit.

### FU-023 — The wordnew book reader applies verse loads without a stale guard and is not remounted per book.
- severity: low · category: race · confidence: suspect
- location: `apps/wordnew/pages/WfNewBookReader.tsx:221-240` (`loadVerses` sets verses, page and last page unconditionally); `apps/wordnew/WfNewApp.tsx:577` (no `key={sourceKey}`).
- failure scenario: quick page flips resolve out of order, so the reader shows the earlier page. A `bookReader` change while the tab stays mounted (hash deep link) can apply the previous book's late verse response. The progress is also loaded twice (`:353` and `:378`).
- suggested fix: a sequence ref in `loadVerses`; key the reader by `sourceKey`.

### FU-024 — i18n keys missing: `pc` lacks `common.close`, laravel-manager lacks `common.cancel` / `mediaHub.loginRequired` / `common.login`, and lm zh lacks 17 en keys.
- severity: low · category: i18n · confidence: confirmed
- location and failure:
  - `apps/pycore-manager/PcLayout.tsx:75` and `pages/PcTerminalPage.tsx:2166` (aria-label shows the raw `common.close`; the key is still absent after the 02:39 locale edit).
  - `apps/laravel-manager/components/voice-subtitle/VoiceSubtitleManager.tsx:431` (the button text shows `common.cancel`).
  - `components/views/MediaHub.tsx:62,68` (English `defaultValue` shown in zh).
  - lm zh is missing `nav.tools_dashboard.*` (15), `nav.aiTools` and `server.messages.failed_to_load` → English in the zh UI. `LmTranslations.ts` does not type zh against en, so nothing enforces parity.
- evidence: key-check script over `pcEn` / `TRANSLATIONS.en` / zh. cm en/zh and mcp-chrome `_locales` were clean at 02:42.
- suggested fix: add the keys; type lm zh against en as `cm` and `pc` do.

### FU-025 — UI-visible strings are hardcoded (AGENTS.md i18n rule).
- severity: low · category: rule · confidence: confirmed
- location:
  - `apps/pycore-manager/pages/vocabulary/vocabShared.tsx:25-49` (`VL`, English literals, zh only in comments; used by every Vocabulary tab);
  - `VocabLibrariesTab.tsx:26-33`, `:203-207`, `:216-220` (`L`, `Stat` labels, table headers);
  - `apps/pycore-manager/utils/pcFormat.ts:9-37` (`relativeTime`/`relativeAgo`: `just now`, `Ns ago`, used by the queue views);
  - `apps/laravel-manager/components/vocabulary/tabs/LibrariesTab.tsx:58-85`, `:109-114`, `:219-245` (Filters, Language, the language names, Refresh, Vocabulary Libraries, words, Recommended, Category, "No libraries available for …"; R5.8 requires i18n);
  - `apps/laravel-manager/models/DataSyncModel.ts` (`'LAN address: the old server is not probed…'`, shown as a probe error);
  - `apps/laravel-manager/components/views/VocabularyLearning.tsx:283+` (mock "Daily Vocabulary - Day 1" tasks rendered as real data).
- suggested fix: move them to pc/lm locale keys and remove the mock tasks.

### FU-026 — Shared utilities are duplicated (AGENTS.md reuse rule).
- severity: low · category: rule · confidence: confirmed
- location:
  - `humanBytes` is re-declared in `apps/pycore-manager/pages/PcWordAudioPage.tsx:43` and `PcSubtitleSearchPage.tsx:128` although `utils/pcFormat.ts` exists;
  - `apps/laravel-manager/components/HtmlErrorModal.tsx:15` `formatBytes` duplicates `core/utils/formatBytes.ts`;
  - `apps/wordnew/components/WfNewNotificationBell.tsx:17` `relativeTime` is a verbatim copy of `components/social/socialPresence.ts:10`;
  - CodeMart money/date formatting exists three times: `components/workspace/cmWorkspaceFormat.ts`, `admin/CmAdminShared.tsx useCmAdminFormat`, `components/public-home/cmPublicFormat.ts`. The copies diverge (see FU-017);
  - `apps/codemart/api/CmApi.ts:104` `getPublicHome` plus its own normalizer is dead (no caller), a duplicate of `CmPublicApi.getHome`;
  - the Bing `pullTasksAcrossTypes` duplicates the base-class version (FU-007);
  - `PUTER_SRC` appears in `apps/wordnew/hooks/puterTranslate.ts:10` and `wordNewWordAudioFallback.ts:144`;
  - `DataSyncModel.ts DATA_SYNC_DEFAULT_PORT = 9000` duplicates `config/service_contract.json` `laravel_api_backend: 9000`.
- suggested fix: import the central helpers and delete the copies.

### FU-027 — Every browser tab rebinds pycore's Laravel worker endpoint to its own shared base URL, including the transient mixed-content failover.
- severity: low · category: endpoint · confidence: suspect (the intended semantics need confirming)
- location: `shell/ShellLaravelEndpointBridge.tsx:154-177` (`persistLaravelEndpoint` → `pycoreApiLocal.bindLaravelWorkerEndpoint`), triggered by `setSharedBaseURL` (`BaseAPI.ts:87`).
- failure scenario: on an HTTPS page, `ApiManager.recheckEndpoints` transiently activates a healthy HTTPS endpoint. FIX_20260919 says this must not rewrite the stored pin, yet the bridge persists it into pycore's worker binding. Two browsers with different selections flip pycore's worker endpoint back and forth.
- suggested fix: bind the pycore worker only on explicit user switches (`switchEndpoint`), not on transient activation.

---

## In-flight observations

These were seen during the first pass and were gone at the 02:35/02:42 re-read, after the user's CodeMart polish session edited the files. They are not reported as findings.
- `apps/codemart/pages/CmWalletPage.tsx` used the undefined key `t('funding.available', …)` on the withdrawals tab (seen ~02:05, `:475`). Gone at 02:35: the line was rewritten.
- `CmWalletPage.tsx` had a local `usePagedList` duplicate that dropped load failures silently (seen ~02:05). Gone at 02:35: the page now uses `useCmPagedList`, so FU-013 applies instead.
- `apps/codemart/pages/CmVerificationPage.tsx` rendered its content only when `!loading && bootstrap`. Every `refreshAll()` unmounted the child forms, so the role-request deposit instructions notice was lost (seen ~02:10). Gone at 02:35: the page now gates only on `!bootstrap`.
- `apps/codemart/pages/CmNotificationsPage.tsx` `markRead`/`markAll` ignored failed responses and marked items read locally (seen ~02:12). Gone at 02:35: `response.success` is now checked.

## Cross-scope

- **laravel-backend:**
  - CodeMart write endpoints without an Idempotency-Key (projects, milestones, tasks, comments, submissions, phone-verification SMS, role request) and the admin money transitions (approve/pay withdrawal, process refund, confirm deposit, resolve dispute) receive retried duplicates from FU-003. Confirm that each state transition rejects a replay, and consider server-side dedupe.
  - Confirm the lease timeout for tasks claimed by `/api/worker/tasks/{type}/pull` that are never accepted (FU-007).
- **pycore-runtime:** `terminal_screenshot_cache.py:80-88` raises bare `ValueError` codes that are in no shared contract (FU-018). `bindLaravelWorkerEndpoint` accepts rebinding from any browser client (FU-027). Please confirm the intended owner of the worker endpoint.
- **lead (contracts):** `DATA_SYNC_DEFAULT_PORT` should come from `service_contract.json` (FU-026). The PR-001 and FU-001 security class (localhost/LAN control servers with open CORS and no auth) spans pycore and mcp-chrome and may deserve one cross-end policy.
- **reviewer:** RV-003/004/005/008/009 do not duplicate any FU finding. I did not re-audit those areas.

## Coverage

- **Fully read** (focus list, at read time):
  - codemart:
    - `api/*` (CmApi, CmPublicApi, cmErrors, cmDownload, useCmIdempotencyKey, useCmPublicHome);
    - `admin/*` (CmAdminApi, CmAdminShared, CmAdminPages, CmAdminModerationPages, CmAdminFinancePages, CmAdminUserDetailPage; CmAdminTypes constants), all read before the 02:33 edits; re-read for FU-014/FU-017 at 02:42;
    - pages CmProjectDetailPage, CmProjectsPage, CmMarketplacePage, CmEstimatePage, CmDashboardPage, CmWalletPage (pre-edit), CmTasksPage, CmReviewsPage, CmVerificationPage (pre-edit), CmNotificationsPage (pre-edit), CmLoginPage, CmDownloadPage;
    - `components/workspace/*` (TransitionBar, SubmissionsPanel, SubmissionFiles, ProjectFundPanel, ProjectAttachments, ProjectAnalysisPanel, MilestoneCard, useCmPagedList, StateViews, cmWorkspaceFormat, cmNotificationFormat);
    - `auth/*` (useCmSignOut, cmAuthSession, CmAuthApi, cmPageAccess, CmAccessGate), CmBootstrapContext, CmCapabilityGate, cmAppDownloads, cmPublicFormat; cm-locales via script.
  - core:
    - `transport/BaseAPI.ts`, TransportTypes, LaravelEnvelope, `network/RequestCoordinator.ts`;
    - `i18n/UiI18n.ts`, `shell/shell-i18n.ts`, `shell/ShellLaravelEndpointBridge.tsx`;
    - `pycore-manager/utils/pcFormat.ts`, OrchDeliveryStatus, PcDeliveryOutboxStatus, PcTerminalDesktopIntegration, VocabLibrariesTab, `api/LibraryCoverTaskStore.ts`, PcLaravelEndpointContext, `hooks/useQueueCenterHub.tsx`.
  - laravel-manager: `models/DataSyncModel.ts`, `models/LibraryCoverTaskModel.ts`, LibraryCoverTaskControls, `tabs/LibrariesTab.tsx`, i18n.ts.
  - shared: `library-cover/LibraryCoverTaskModel.ts`.
  - wordnew: `orch-audio/useOrchAudioPlayback.ts`, useOrchAudioSentencePages, WordNewOrchAudioPlayerPage, WordNewOrchAudioRoute; `services/WordNewBookReaderPlayback.ts`; `hooks/useWordNewSentenceAudioCells.ts`.
  - mcp-chrome:
    - `scripts/dev-watch.mjs`, `background/build-reload.ts`, `native-server/src/util/build-watch.ts`, `src/index.ts`, `src/server/singleton.ts`, `src/constant/index.ts`;
    - `background/native-host.ts`, bootstrap.ts, api-health-listener.ts, puter-translate-listener.ts;
    - `services/bing-dictionary-worker-runtime.ts`, `task-center/run-intent.ts`, assist-cover-pipeline.ts, `utils/runtime-message.ts`, `wxt.config.ts`;
    - `_locales` parity via script.
- **Partially read:**
  - UI:
    - `core/integrations/laravel/ApiManager.ts` (preselect/setEndpoint/switchEndpoint);
    - ApiContract, LaravelRequest, WfNewApiTransport, ProtocolFetch, APICache;
    - `PycoreHttp.ts` (SSE lifecycle), LaravelRelayOperationEvents (start/stop);
    - PcTerminalPage (error map, refresh/poll effects, desktop wiring);
    - vocabShared, DataSyncTab (1-560 of 758), VocabularyLearning (100-420);
    - WfNewBookReader (215-420), WfNewApp (570-590), usePriorityBoost, WordNewQueueCenter (head moves), WfNewEndpoints, orchAudioModel, daily-reading overlay (header);
    - CmShowcasePage / CmProfilePage / CmHero (effects only).
  - mcp-chrome:
    - bing-dictionary-worker-service (1-300, 520-660), SimpleWorkerRuntimeBase (600-734), task-center-listener (1-200);
    - `services/ApiManager.ts` (1-140), WorkerApiClient (pull/accept/submit), `native-server/src/server/index.ts` (setup, /mcp, /singleton), `scripts/build.ts`.
- **Read by pattern sweep only** (scope-wide greps: innerHTML/dangerouslySetInnerHTML, EventSource/WebSocket lifecycle, setInterval/clearInterval balance, add/removeEventListener balance, hardcoded URLs, i18n keys):
  - the rest of `apps/codemart/**` (public pages, CmLayout, CmApp, CmAdminLayout, public-home components);
  - the rest of `apps/pycore-manager/**`, `apps/laravel-manager/**`, `apps/wordnew/**`, `core/**`, `shared/**`, `shell/**`.
- **Not read** (focus files remaining):
  - pycore-manager: the audio-orchestration workspace (AudioOrchWorkspace, OrchTaskList, OrchTaskEditor, OrchManifestPanel, OrchRunTiming, OrchSystemPanel, OrchLoginPanel, OrchLearningVideoPanel, OrchBookPicker, OrchSourceDetail); agent-history pages/panels and AgentHistoryRuntimeStore; PcSentenceQueuePanel, PcWordAudioPanel/QueueModal, PcAudioLaneQueueView, PcAudioLaneFullSyncRow, AudioLaneStateStore (see RV-009), PcCapabilityDrawer, PcAiPage, PcAiUsageRecordsPanel, PcLaravelEndpointSwitcher.
  - laravel-manager: DatabaseManager.tsx, ServerManager.tsx, AppQyV1.ts/Types, DatabaseManagerAPI (beyond sync GETs), ApiEndpointSwitcher, TopHeader, LmDashboard, UnifiedAppContext, media/*, LmLoginModal.
  - core: pycore/laravel type/contract files (PycoreApi*, PycoreQueueTypes, PycoreSpeechTypes, PycoreServiceTypes, QueueCenterContract/Types, LaravelTypes, LaravelAPI beyond cover routes, LaravelEndpoints beyond mixed-content), DiffQueueContext.
  - wordnew: WfNewApiHttp, WfNewApiMock, WfNewApiPaths, WfNewAdminApi, WfNewNewAdminLibraries, useWfNewAppState, WfNewHomeContent/HomeTab/HomeLabCard, content list/pager, orch list/transport, locales.
  - shared: notify, prompt-derived, EcdictLookupPanel; scripts/start.ps1.
  - mcp-chrome: every `*-worker-service.ts` other than Bing, TaskCenter.ts, AssistPollingWorkerBase, gemini-image-generate, media-image-search, duoreader importer, semantic-similarity-engine, content-indexer, queue-center-contract.ts, vocabulary-cover-prompt-library, api-paths, task-center-types, message-types, TaskCenterApiClient, StudyGenApiClient, all popup Vue components and composables (i18n key existence checked only), packages/shared (tools.ts, constants.ts), eslint configs, `apps/mcp-chrome/scripts/start.sh|ps1`, service_supervisor.py, build_orchestrator.py.
  - `.wxt/` generated files: excluded.
- **Step 3** (the rest of the scope beyond the focus list): only the pattern sweeps and i18n scripts above. No line-by-line reading.

---

## Addendum (pass 2)

Pass 2, 02:47–02:55, report only. None of the files cited below changed after 02:10 today (checked by mtime at 02:54), so no in-flight tags are needed. Counts: 1 critical, 0 high, 4 medium, 8 low (13 findings, FU-030…FU-042). FU-001…FU-027 are unchanged.

Vortex result (the lead's top priority): no path places or cancels real OKX orders or moves funds. The UI calls pycore only for market data, settings, backfill (`fill_plan`/`fill_backtest`/`cancel_fill`), pre-open lists and credential reveal (`api/VortexPycoreContract.ts:1-24`). "Trading" is a local, simulated, localStorage-only ledger. The pycore transport does not retry POSTs (`core/integrations/pycore/PycoreClient.ts:130-200`, one attempt per request id), so FU-003 does not apply to Vortex. Sandbox and live are separate by construction: the live panel is read-only (`okx/account_overview`).

### FU-030 — A database backup restore that runs longer than 30 s is re-sent up to 3 more times, so overlapping restores hit the same database.
- severity: critical · category: data-integrity · confidence: likely (client behavior confirmed; server-side concurrency not verified)
- location:
  - `apps/laravel-manager/api/modules/DatabaseManagerAPI.ts:381-384` (`restoreBackup` → `this.post(...)`), `:364-370` (`createBackup`);
  - `apps/laravel-manager/api/LaravelManagerApi.ts:83` (`createLaravelModuleConfig`: 30 s timeout, default retry `{count: 3}`);
  - caller `apps/laravel-manager/components/views/DatabaseManager.tsx:974-995` (`handleRestore`), `:957` (`handleCreate`).
- failure scenario:
  1. An admin restores a real backup, which takes minutes. At 30 s BaseAPI aborts (`AbortError`), and `shouldRetry` re-POSTs `backups/{id}/restore` after 1 s, 2 s and 3 s (the FU-003 mechanism).
  2. PHP keeps running the first import after the client abort, so up to 4 imports of the same dump run concurrently against the same database. The result is interleaved or duplicated data, or lock and constraint failures.
  3. After ~2 min the UI reports "Restore failed" while the restores are still running.
  4. `createBackup` behaves the same way: 4 concurrent dumps.
  5. Other laravel-manager writes on the same path: `services/{name}/restart` (`ServerManagerAPI.ts:263`) and the non-idempotent `services/{name}/toggle-autostart` (`:285`, a retried toggle can flip back).
  - Octane `restartCurrent` sets `retry:false` (`:296`) and is safe.
- evidence: `BaseAPI.ts:409-416` retries every method. `DatabaseManagerAPI` is an active module with no retry override.
- suggested fix: `retry:false` plus a long per-call timeout for backup, restore, service control and toggle (better: fix FU-003 globally), and a server-side restore lock (see Cross-scope).

### FU-031 — wordnew's offline write queue replays one user's writes under whoever is logged in when it drains.
- severity: medium · category: data-integrity/privacy · confidence: confirmed (code) / likely (runtime)
- location:
  - `core/network/api-client/MasterApiClient.ts:256-305` (drain), `:330-345` (`send` resolves auth headers at replay), `:365-380` (the persisted entry strips auth and stores no owner);
  - `apps/wordnew/api/WfNewApiTransport.ts:120-141,248-271` (`queueablePostJSON`);
  - logout `apps/wordnew/api/WfNewApiHttp.ts:145-153` (the queue is not cleared).
- failure scenario:
  1. User A studies offline: `groupUpdateProgress`, `recitationLog` (`api/methods/learning.ts:50,59`) and `sentenceWordsPlayed` (`services/WordNewSentenceWordTable.ts:160`) are queued in localStorage `wordnew_api_queue`.
  2. A logs out and user B logs in on the same device.
  3. The endpoint recovers, `drainQueue` replays A's entries with B's bearer token, and A's progress and recitation logs are written into B's account.
- evidence: `enqueueFailedWrite` "Persist headers MINUS the auth header names — the live token is re-resolved at replay time". No logout or login path calls `RequestQueue.clear`, and `clearUserSession` (`hooks/useWfNewAppState.ts`) does not touch it.
- suggested fix: store the owner scope (a token hash or user id) with each entry, and drop or hold entries whose owner differs from the current session; clear the queue on logout.

### FU-032 — wordnew's word-audio wait is answered from a 15-minute local mirror after its second attempt, so it never sees the audio become ready.
- severity: medium · category: stale-cache · confidence: confirmed (code trace; requires IndexedDB)
- location:
  - `apps/wordnew/services/WordNewQueueCenter.ts:202-220` (`pollWordAudio`, 40×1 s);
  - `apps/wordnew/api/WfNewApiHttp.ts:640-647` (`getWordAudio` → `getJSON`);
  - `apps/wordnew/api/WfNewApiTransport.ts` `requestJSON(..., 'resource')` → `runtime-store/WfNewServerMirror.ts:66-80` (`queryServerResource`, refresh `'stale'`), `:34-45` (`ttlFor`: the `/word/{lang}/{word}/audio` path matches `words?` → 15 min);
  - `platform/capabilities/CapResourcePackage.ts:348-368`.
- failure scenario:
  1. The library page queues a word that has no audio (`pages/WfNewLibraryPage.tsx:166-215`). Attempt 0 fetches `/audio`.
  2. Attempt 1 fetches `/audio?passive=1`, gets `pending`, and stores it with a 15-minute TTL.
  3. Attempts 2–39 hit the fresh local record and return `pending` without any network request. Laravel generates the clip meanwhile, but `waitForWordAudio` returns `null` after ~40 s.
  4. The cell stays "queued" and playback `resolveAudioUrl` gets no URL. Retrying within 15 min returns the same cached `pending`.
- evidence: `CapResourcePackage.query` returns `local.payload` whenever `expiresAt > now` and refreshes only when the record is stale.
- suggested fix: poll status endpoints with `cacheMode:'network'` (`authedGetFreshJSON` style), or do not mirror non-ready media states.

### FU-033 — The Vortex simulated account creates money: selling returns the full leveraged position value instead of margin plus P&L, and the sell fee is inverted.
- severity: medium · category: correctness (simulation) · confidence: confirmed
- location: `apps/vortex/VortexApp.tsx:699-812` (`executeSimulatedTrade`), `:814-841` (`handleLiquidateWholePosition`).
- failure scenario:
  1. BUY $1,000 at 5x: cash −1,000, quantity = 1,000/1.001×5/price (`:714`), so the position is worth ~$4,995 notional.
  2. Liquidate at the same price: `rawWorth = quantity × price` (`:817`) returns ~$4,990 to cash, a ~$3,990 profit on an unchanged price.
  3. The SELL ticket computes `proceedsRaw / commissionFactor` with `commissionFactor = 1 − fee` (`:703`, `:776`), so dividing by 0.999 adds the fee instead of deducting it.
  4. P&L, equity and history in the sandbox are meaningless for strategy evaluation. The sim equity is also shown next to the real OKX account in `OkxAccountPanel`.
- evidence: the lines above. Margin (`realCost`) is never tracked per position.
- suggested fix: store the margin per position; on close credit `margin + qty × (exit − entry) − fee`, and multiply by `(1 − fee)` on sells.

### FU-034 — The mcp-chrome image search downloads candidate images with no timeout or size cap, so one slow host stalls the poster/cover worker.
- severity: medium · category: liveness · confidence: confirmed (code) / likely (runtime)
- location: MC `app/chrome-extension/utils/media-image-search.ts:37-66` (`fetch(url, { cache: 'no-store' })`, whole-body `arrayBuffer`, byte-by-byte `String.fromCharCode` concatenation).
- failure scenario:
  1. A Google/Bing result points at a host that accepts the connection and trickles the body (or at a very large file).
  2. `resolvePosterImageFromSearch` never returns. The `media_image` worker's cycle (`cycleInFlight`) or its assist cycle (`assistBusy`) stays busy.
  3. No more `poster`/`library_cover_search` tasks are taken, claimed task leases expire, and the worker still shows online until the service worker restarts.
  4. A multi-MB image is also converted with an O(n) string-concatenation loop in the service worker.
- evidence: no `AbortController` or `Content-Length` check anywhere in the function. The web-search tab path has timeouts; this direct fetch does not.
- suggested fix: `fetchWithTimeout` (`utils/async`) with a byte cap; skip on timeout; `bytesToBase64` from `utils/binary`.

### FU-035 — laravel-manager's DB viewer keeps showing the previous table's rows when the next table's load fails, and it leaves rejections unhandled.
- severity: low · category: state · confidence: confirmed
- location: `apps/laravel-manager/components/views/DatabaseManager.tsx:355-374` (`getStructure`), `:376-393` (`getData`); both are `.then/.finally` with no `.catch`.
- failure scenario: select table A, which loads. Select table B, whose `getData` rejects (timeout or permission). `data` still holds A's rows under B's header, the error is never shown, and the console gets an unhandled rejection.
- suggested fix: reset `data`/`structure` on selection change and add `.catch` to an error state.

### FU-036 — pycore-manager Agent History applies session and prompt loads without a stale guard, so a slower earlier load can overwrite the current one.
- severity: low · category: race · confidence: likely
- location: `apps/pycore-manager/pages/PcAgentHistoryPage.tsx:471-488` (`handleSelect`), `:260-337` (`loadPromptPage`; `loadSessionPage` has the same shape), with live reloads from `:351-383`.
- failure scenario:
  - Click session A, then B, while A's detail is slow. A's detail overwrites B: the selection shows B and the content shows A.
  - A live-reload `loadPromptPage` and a page or search change overlap. The older response sets `prompts`/`promptTotal` last.
- suggested fix: a request sequence ref per loader, checked before each `set*` call.

### FU-037 — The audio-orchestration workspace drops task-list refreshes requested while a load is in flight, so the list can stay stale.
- severity: low · category: stale-state · confidence: confirmed (code) / likely (impact)
- location: `apps/pycore-manager/pages/audio-orchestration/AudioOrchWorkspace.tsx:154-170` (`if (requestsRef.current.tasks) return;`); callers: push `:218-231`, `generate` `:275-283`, `OrchTaskList` `onChanged` after delete or cancel.
- failure scenario: delete a task while the (push- or HTTP-reconnect-triggered) load is in flight. The delete's `loadTasks()` is dropped, and the in-flight response predates the delete. When no task is generating there is no 3 s poll, so the deleted task stays listed until the next push.
- suggested fix: queue one follow-up load when a request arrives mid-flight (the pattern `useQueueCenterHub` uses).

### FU-038 — The Vortex chart can show the previous coin's candles under the newly selected coin.
- severity: low · category: race · confidence: confirmed
- location: `apps/vortex/OkxBacktestPanel.tsx:706-713` (`openChart`); also re-invoked by the bar change at `:716-721`.
- failure scenario: click coin A, then coin B before A's `okx/candles` returns. If A's response arrives last, `selCandles` holds A's candles while `selected=B`.
- suggested fix: ignore responses whose `inst_id` (and bar) is no longer selected.

### FU-039 — The Octane restart reconnect loop never stops on unmount and later reloads whatever page the user is on.
- severity: low · category: effect-leak · confidence: confirmed
- location: `apps/laravel-manager/components/views/ServerManager.tsx:258-321` (`reconnect` re-arms `setTimeout` indefinitely; `window.location.reload()` at `:309`).
- failure scenario: restart Octane and navigate to another laravel-manager view while it is down. The loop keeps probing every second and reloads the SPA when the server returns, discarding the new view's state and forms. If the server never returns, it probes forever.
- suggested fix: a disposed ref or an AbortController tied to component lifetime, plus a maximum wait.

### FU-040 — pycore-manager word-audio players create an unmanaged `Audio` per click: clips overlap and keep playing after unmount.
- severity: low · category: audio-state · confidence: confirmed
- location: `apps/pycore-manager/components/PcWordAudioPanel.tsx:74-81` (`await new Audio(source).play()` per row click); `apps/pycore-manager/pages/PcWordAudioPage.tsx:102-114`.
- failure scenario: clicking several queue rows plays their clips simultaneously. Leaving the page does not stop a playing clip, and the page's `playing` flag cannot be cleared if the element is collected.
- suggested fix: one shared audio element per view, paused on the next play and on unmount (or reuse `playWordClip`).

### FU-041 — A Gemini image generation that times out leaves the tab still generating, and the next generation may take the late image as its own.
- severity: low · category: race · confidence: suspect
- location: MC `app/chrome-extension/entrypoints/background/services/gemini-image-generate.ts:37-58` (after a 110 s timeout it returns null and releases the mutex without cancelling the Gemini job).
- failure scenario: library cover A times out and cover B's generation starts on the same tab. If A's image renders after B's baseline snapshot, B's `status` can resolve to A's image, and library B receives A's cover. This depends on the gemini-image tool's baseline isolation, which was not read.
- suggested fix: cancel or reset the tab job on timeout (a new chat) before releasing the mutex.

### FU-042 — Pass-2 files hardcode UI-visible strings instead of using en/zh locale keys (AGENTS.md i18n rule).
- severity: low · category: rule · confidence: confirmed
- location:
  - vortex: every panel carries its own inline dictionary (`OkxQuantPanel.tsx:34-75`, `OkxAccountPanel.tsx:38-66`, likewise `OkxBacktestPanel.tsx`) instead of locale keys; any language other than `en` falls to zh. `VortexApp.tsx:765,800,840,857` show English-only toasts, and trade times are formatted with a hardcoded `'zh-CN'`.
  - laravel-manager: `DatabaseManager.tsx` (e.g. `:1007-1015`, `:1146-1201`, `:1320-1325`: "Backup deleted", "Delete failed", "Restore backup", "Drop database account…") and `ServerManager.tsx` (`:259` `confirm('Restart Octane server?…')`, `:262-320` progress texts) use English literals. There are 9 and 1 `t(` calls respectively.
  - wordnew: `api/WfNewApiTransport.ts:142` returns the queued-offline message `'Saved offline — will sync when the connection returns.'` to the UI.
  - mcp-chrome background: worker names and action results returned to the popup are English literals (e.g. `puter-translate-listener.ts:35,38`; `SimpleWorkerRuntimeBase.ts:274` `MCP Chrome ${processorKey} Worker`).
- suggested fix: route them through `lm`/`wf`/`pc` locale keys, or `chrome.i18n` for the extension.

### Pass-2 cross-scope
- **pycore-runtime:** `okx/reveal_credentials` (the Vortex "show all" key) returns the full OKX API key over the same pycore RPC surface that PR-001 shows is open to any origin and to the LAN. Anyone who reaches pycore can read the key. Gate or remove the full-key reveal (UI side: `OkxQuantPanel.tsx:136-146`).
- **laravel-backend:**
  - The DB backup restore and create endpoints should refuse to run concurrently (per-connection lock) and be idempotent per request (FU-030).
  - `services/{name}/toggle-autostart` should take an explicit target state instead of toggling.
- **laravel-backend / reviewer:** wordnew's queued writes (`group/update_progress`, `recitation` log, sentence-words-played) carry no client request id, so the server cannot dedupe a replay (FU-031).

### Pass-2 coverage
- **Read line by line:**
  - vortex: `api/*`, `OkxQuantPanel.tsx`, `OkxAccountPanel.tsx` (data flow), `OkxBacktestPanel.tsx:575-730` (loaders, effects, actions), `VortexApp.tsx:395-560` and `690-860` (ledger, tick engine, trade logic);
  - mcp-chrome: `task-center/SimpleWorkerRuntimeBase.ts` (all), `AssistPollingWorkerBase.ts`, `chatgpt-worker-service.ts`, `gemini-worker-service.ts`, `gemini-image-worker-service.ts`, `gemini-image-generate.ts`, `media-image-worker-service.ts`, `utils/media-image-search.ts`, `qwen-tts-worker-service.ts`, `composables/useEndpointSelection.ts` (monitor/lifecycle);
  - core: `pycore/PycoreClient.ts` (request path), `network/api-client/MasterApiClient.ts` (queue);
  - wordnew: `WfNewApiTransport.ts` (all write/read paths), `WfNewApiHttp.ts:1-160` and `640-665`, `runtime-store/WfNewServerMirror.ts`, `CapResourcePackage.query`, `services/WordNewQueueCenter.ts`, `pages/WfNewLibraryPage.tsx:160-230`, `hooks/useWfNewAppState.ts:284-520`;
  - pycore-manager: `AudioOrchWorkspace.tsx:1-300`, `OrchTaskList.tsx:122-330`, `orchShared.ts` (labels), `PcAgentHistoryPage.tsx:260-520`, `PcWordAudioPage.tsx:95-115`, `PcWordAudioPanel.tsx:60-95`;
  - laravel-manager: `DatabaseManager.tsx:320-400`, `940-1210`, `1210-1330`, `DatabaseManagerAPI.ts:360-540`, `LaravelManagerApi.ts:40-120`, `ServerManagerAPI.ts:230-300`, `ServerManager.tsx:250-335`, `ApiEndpointSwitcher.tsx` (switch path).
- **Pattern-scanned only:** mcp-chrome `SimpleWorkerBase.ts`, `useTaskCenter.ts`, `useAiTranslateHub.ts`, `useBingDictionaryClient.ts`, `useBookStudyGenerator.ts`; the pycore-manager queue panels (PcSentenceQueuePanel, PcAudioLaneQueueView, PcWordAudioQueueModal, PcAudioLaneFullSyncRow); `shared/notify/notify.tsx`, `EcdictLookupPanel.tsx`, `prompt-derived/*`; the rest of `ServerManager.tsx` (effects and cert polling only).
- **Still unread** (after passes 1 and 2):
  - mcp-chrome: `word-validity-web-worker-service`, `web-ai-translate-worker-service`, `prompt-translate-web-worker-service`, `puter-translate-worker-service`, `notebooklm-worker-service`, `WorkerServiceProcessorBase`, `ITaskProcessor`, `TaskCenter.ts`, `processors/*`, `task-history-store.ts` (RV-004), `duoreader-importer-*`, `semantic-similarity-engine`, `content-indexer`, `queue-center-contract.ts`, `vocabulary-cover-prompt-library`, `TaskCenterApiClient`, `StudyGenApiClient`, all popup Vue components beyond the i18n check, `packages/shared/src/tools.ts`, `scripts/start.*`, `service_supervisor.py`, `build_orchestrator.py`.
  - wordnew: `WfNewApiMock.ts` (mock), `WfNewApiPaths.ts` (beyond word paths), `WfNewAdminApi.ts`, `WfNewNewAdminLibraries.tsx`, `WfNewHomeContent.tsx`, `WfNewHomeTab.tsx`, `WfNewHomeLabCard.tsx`, `WfNewContentListPage.tsx`, `WfNewPager.tsx`, `WordNewOrchAudioListPage.tsx`, `WordNewOrchAudioTransport.tsx`, the daily-reading player hook (`useDailyReadingPlayer`), the Walkman player, and `locales/*`.
  - pycore-manager: `OrchTaskEditor.tsx`, `OrchManifestPanel.tsx`, `OrchSystemPanel.tsx`, `OrchLoginPanel.tsx`, `OrchLearningVideoPanel.tsx`, `OrchBookPicker.tsx`, `OrchSourceDetail.tsx`, `OrchRunTiming.tsx`, the agent-history sub-panels (ConfigPanel, AiPanel, PromptRewrite, PromptItem, CachePanel, ToolCheckboxes, ToolPanel), `AgentHistoryRuntimeStore.ts`, `AudioLaneStateStore.ts` (RV-009), `PcCapabilityDrawer.tsx`, `PcAiPage.tsx`, `PcAiUsageRecordsPanel.tsx`, `PcLaravelEndpointSwitcher.tsx`, `PcFloatingPanel.tsx`, `PcAppearanceControls.tsx`.
  - laravel-manager: most of `ServerManager.tsx` (nginx, certificates, logs UI), `DatabaseManager.tsx` account and password flows beyond the handlers, `AppQyV1.ts`/`AppQyV1Types.ts`, `TopHeader.tsx`, `LmDashboard.tsx`, `UnifiedAppContext.tsx`, `LmLoginModal.tsx`, `media/*`, `VocabularyCoverManagerMenu.tsx`, `EcdictLookupTab.tsx`.
  - core: the type and contract modules (`Pycore*Types`, `QueueCenterContract/Types`, `LaravelTypes`), `LaravelAPI.ts` beyond the cover routes, `DiffQueueContext`.
