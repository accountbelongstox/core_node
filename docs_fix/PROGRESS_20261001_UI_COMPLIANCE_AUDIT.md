# UI compliance audit fix progress — 2026-10-01

Source audit: `docs_fix/UI_COMPLIANCE_AUDIT_20260930.md` (211 findings, sections VX/WC/WP/PP/PM/WS/CORE).
Scope: `poly_apps/pycore_laravel_wordnew_ui/`. Verification: `tsc --noEmit` (package script `lint`) passes clean after every batch, including the final state. Baseline before fixes was also clean.
Marked in the audit file: 30 findings `- status: fixed`, 9 `- status: partial` (with notes inline). No builds or services were run; no files were deleted.

Note: another session was concurrently editing this tree (pycore-manager components restructured, `core/config/NetworkTiming.ts` extended with `WEBSOCKET_TIMINGS`). Several PP/PM locations in the audit no longer exist at the cited paths (e.g. PcAiHistoryView, PcHttpDebugger, PcAiCapabilityParts); those findings were left untouched and need re-verification against the current tree.

## Batch 2 (2026-10-01, later pass)

| ID | What changed |
|---|---|
| WP-33 + WS-31 | All invalid Tailwind shades fixed repo-wide in wordnew (`indigo-505→500`, `indigo-550→600`, `zinc-850/550/650/750→800/500/600/700`, `indigo-250→200`, `emerald-250/955→200/950`, `orange-250/955/850→200/950/800`, `amber-550→500`, `purple-650/750→600/700`); `w-4 s h-4` typo fixed; stray space in `id="walkman-container-module"` removed |
| VX-07 + VX-08 | New `apps/vortex/VortexStorageKeys.ts`; all VortexApp/OkxBacktestPanel raw `localStorage` + unguarded `JSON.parse` replaced by `StorageManager.get/set/remove` (safe parse with defaults); bookmarks now actually persist on toggle |
| VX-16 | Fake seed positions/history removed — ledger defaults to `[]`; initial cash via `INITIAL_CASH` |
| VX-18 (partial) | `DEFAULT_TICK_MS/DEFAULT_FEE_PERCENT/DEFAULT_LEVERAGE/INITIAL_CASH` named at VortexApp top |
| VX-04 + VX-17 (partial) | Vortex toast stack (state, 4 s timer, JSX) deleted → `notify.success/info/warning`; pdd Users/PaymentSettings/Membership flash+timeout banners → `notify` (their uncleared `setTimeout`s gone; OkxQuantPanel timers remain) |
| PP-08 | PcCodeSyncPage and PcCoreBookPage flash banners (with never-cleared 3.5 s/6 s timers) → `notify` |
| WS-12 | `WfNewNotify.ts` is now a thin dedup facade over `shared/notify` (store, `useWfNewToasts`, dismiss/clear deleted); `useWfNewAppState` no longer exposes `toasts`; `WfNewAppChrome` no longer renders `WfNewToast`. **`components/WfNewToast.tsx` is now unreferenced — deletion candidate pending approval** |
| PP-15 | `PYCORE_TERMINAL_SCHEDULE_EDITOR` registered in PycoreManagerStorageKeys; PcTerminalPage raw `window.localStorage` → `StorageManager` |
| PM-20 | `PYCORE_TTL_CACHE_PREFIX` (PycoreCache) and `PYCORE_LEGACY_CODE_SYNC_TASK` (CodeSyncRuntimeStore) registered. `PcVideoExtractContext` `pycore.video-extract` is a task-registry suffix (goes through `core/tasks/taskStorageKeys`), left as-is |
| WP-01 + WS-06 | Added to en/zh/ja/ko: `content.play/pause/stop`, `library.playAll`, `social.video.openPlayer`, `social.live.notFound`, `social.compose` |

## Fixed (batch 1)

| ID | What changed |
|---|---|
| CORE-19 | `AUTH_SESSION_CHANGED_EVENT` exported from `core/auth/AuthRequestCenter.ts`; all 5 literal sites (AuthRequestCenter, laravel-manager UserModel ×2, UnifiedAppContext ×2) use it |
| CORE-16 | `PYCORE_BACKEND_PORT` added to `core/contracts/ServiceContract.ts` (from `service_contract.json ports.pycore_backend`); `PYCORE_HTTP_PORT`/`PYCORE_PORT` deleted; all importers (PycoreNetwork, pycoreEndpoints, pycoreTarget, pycore barrel, PcPycoreTargetSwitcher, PcCodeSyncPage) use the one name |
| CORE-15 | New `core/network/hostDetection.ts` (`normalizeHostname`, `isLoopbackHost`, `isPrivateHost`, fed by `LOCAL_RPC_LOOPBACK_HOSTS`); replaced the three local copies in LaravelEndpoints (×2 + inline regex) and pycoreTarget; `FrontendConfig.getOriginUrl` uses `LOOPBACK_HOST` |
| CORE-20 | New `core/config/NetworkTiming.ts` (`NETWORK_TIMEOUTS`, `UI_DURATIONS`); migrated CloudClipboardAPI 60s, QyAccountAPI 60s, LaravelAPI queue-overview 2s, RequestCoordinator coalesce TTL, LaravelEndpoints health interval/timeout, BaseAPI default 15s, copy-feedback timers (CloudClipboardCopyButton, notify) |
| CORE-14 | New generic `core/events/RingStore.ts` (capacity, throttled emit, onAppend, mutate/commit); migrated all four ring stores: `core/logstore/logStore`, `pycoreHttpLog`, `PycoreConsoleLogStore` (sequencing logic kept, emit/trim machinery replaced), `ProtocolFetch` observations |
| PM-09 | New `core/persistence/RuntimeStore.ts` `createRuntimeStore<T>()` (defaults + restore merge, patch, subscribe, debounced persist, errorMessage); migrated AgentHistoryRuntimeStore, CodeSyncRuntimeStore, LlmStatusRuntimeStore, PycoreCapabilityStore, PycoreEngineLoadStore, AudioLaneStateStore, AgentHistoryVideoRuntimeStore. `hooks/TaskCenterState` already used the shared `TypedEventEmitter` — compliant as-is |
| PM-18 | Dropped via PM-09: window-CustomEvent store buses (`STORE_EVENT` strings) deleted from all migrated stores |
| CORE-13 | New `core/tasks/Poller.ts` (visibility-aware, single-flight, backoff, `wake()`) + `core/tasks/usePolling.ts`; `useTopicDrivenRefresh` promoted to `core/integrations/pycore/usePycoreTopicRefresh.ts` (console.error → logStore; "FIX V9" note removed; old path re-exports). Migrated: CloudClipboardModel, AiUsagePanel, LibraryCoverTaskModel, LaravelRelayRoster, AgentHistoryVideoRuntimeStore, PycoreEngineLoadStore, AudioLaneStateStore, AudioOrchWorkspace, useOrchTaskListing, OrchTaskDetail. Left: `TaskPersistenceProvider` per-session timers (custom stop-on-settled semantics don't fit Poller) and wordnew sites |
| PP-16 | `ORCH_POLL_MS` once in `orchShared.ts` (was 3 copies); OrchTaskDetail now refreshes via `usePycoreTopicRefresh` on `audioOrchestrationTasksChanged` with ORCH_POLL_MS fallback instead of a raw interval |
| CORE-09 | `UI_SUPPORTED_LANGUAGES` (`en`,`zh`) in `core/i18n/UiI18n.ts` drives both i18next `supportedLngs` and `shell/SHELL_LANGUAGES`; full labels kept in `SHELL_LANGUAGE_LABELS` for apps that filter by their own locale sets |
| VX-06 | One `Sparkline` in `apps/vortex/charts/Sparkline.tsx` (was 2); vortex `fmtTs` ×3 / `fmtBig` / `fmtNum` replaced by shared formatters |
| PP-11 | New `core/utils/formatters.ts` (formatBytes re-export, toEpochMs, formatTimestamp, formatNumber, formatBigNumber, formatMegabytes, formatClock, formatDurationHms); PcVideoExtractPage `fmtMB/fmtDur/fmtClock` deleted; orchShared `formatDuration` delegates; `pcFormat.toEpochMs`/`absoluteTime` delegate |
| VX-02 | OkxAccountPanel/OkxQuantPanel/OkxBacktestPanel now `React.lazy` + Suspense in VortexApp — out of the main bundle while `VORTEX_PYCORE_SERVED_HTTP_ROUTES` is empty; the served-route gate is unchanged |
| WS-30 | WfNewApp: `React.lazy` + Suspense for WfNewAdminPage, WfNewBookReader, WfNewSocial, WfNewAnalytics, WordNewOrchAudioRoute |
| CORE-10 | `APICache` rewritten on `StorageManager` (prefix registered as `LaravelStorageKeys.API_CACHE_PREFIX`; new `StorageManager.keysWithPrefix`; console.warn removed); `RequestQueue` load/persist via `StorageManager` (key already registered as `WORDNEW_API_QUEUE`) |
| CORE-11 | `DomainConfig` config fetch via `protocolFetch`; new `fetchAssetUrl` in ProtocolFetch (data:/blob:/file: bypass native transports) used by CapFilesystemCache (4 sites) and CapCamera; dailyReadingApi warm-up via protocolFetch. (PycoreEndpointProbe already used protocolFetch) |
| PM-34 | `removeLegacyPollingSession()` no longer runs on import; runs once when the first CodeSync runtime consumer mounts |

## Partial (7)

- VX-01: commented pdd import/route lines removed from `shell/ShellApp.tsx` and `shell/shellTypes.ts`. Deleting `apps/pdd-manager` (~1,790 lines) is destructive — needs user approval.
- VX-20: Okx panel long headers (with history notes and Chinese tab names) replaced with one-line English headers; pdd commented lines removed (VX-01 part). Remaining listed items (Pdd* comments, VortexApp typo) open.
- CORE-28: dead eslint directive in TaskPersistenceProvider removed; `PycoreHttp.diag` console output routed to `logStore`. The `"lint": "tsc --noEmit"` script was NOT renamed — external tooling may invoke `bun run lint`; renaming is a one-line follow-up once confirmed safe.
- CORE-29: MasterApiClient Chinese comment removed. EcdictLookupPanel labels remain — owned by CORE-07 (shared dictionary namespace with PM-01).
- CORE-30: `logStore` gitignore-history header and `shellTypes` header trimmed to one line. Other long headers (MasterApiClient, notify, TaskPersistenceProvider, overlay, shellChrome, vite.config) open.
- PM-12: `humanBytes` wrapper deleted and all callers (PcSubtitleSearchPage, PcRecentTasksPanel, PcWordAudioPage, PcQwenLive, VocabStatisticsTab, OrchFilePlayer, OrchTaskFileItem, vocabShared) now import `formatBytes` from `core/utils/formatters`. `PycoreCache.loadTtlCacheStale` wrapper remains.
- PM-22: CodeSyncRuntimeStore constants hoisted and `PERSIST_DEBOUNCE_MS` named; PcVideoExtractContext/PycoreCache mid-file constants open.

## Not started (main remaining blocks, in audit's recommended order)

1. CORE-01 (merge HTTP stacks), CORE-12 (one SSE), CORE-02 (one endpoint scheduler) — large architectural merges; also blocked by FU-002/FU-003 policy constraints noted in the audit.
2. CORE-03/04/05 (app registry, layering inversions, glob narrowing), PM-17.
3. i18n consolidation: WC-01 (studyT) → WS-13 (WfNewLocales engine) → WS-07 (434 ja/ko keys) and all remaining R1 findings (WC-05/06, WP-02..04, PP-01..04, PM-01..07, CORE-07/08). New keys must go into every locale file of the app.
4. App migrations to shared pieces: audio/speech (WC-02, WP-05/06), transport (WS-15/16/17), storage keys (WS-20). Toast and the VX/PP storage-key findings were done in batch 2.
5. Dead code needing user approval before deletion: VX-01 (pdd-manager), WS-01 (20 MB JSON dumps), WS-03 (mock API layer), WS-04 (~9.2k lines capability modules), WS-05 (capacitor shims), PM-25/26/27, CORE-06 (lockfiles/package managers), CORE-33/36, plus the now-unreferenced `apps/wordnew/components/WfNewToast.tsx` (WS-12 follow-up).
6. Types/strictness: CORE-25 (enable `noUnusedLocals`/`noUnusedParameters` first), then `any` / `exhaustive-deps` findings in every section.
7. Splits/perf: VX-03, PP-24/25, PM-31/32, WS-21, CORE-24 (manualChunks — coordinate with the other session editing vite.config.ts).
8. Build/scripts: CORE-22, CORE-32..35 (vite.config.ts and build scripts are also being touched by the concurrent session — re-verify before editing).
9. Cosmetic: remaining R4/R5/R6 items, CORE-37/38.

## Follow-up notes for the next session

- Re-verify PP/PM line numbers against the current tree; the concurrent session restructured `apps/pycore-manager/components/` (several audited files no longer exist).
- `TaskCenterState.ts` was judged compliant (uses shared `TypedEventEmitter`); if the team wants one store shape everywhere it can still be moved onto `createRuntimeStore`, but that requires converting its public mutable fields.
- `usePolling`/`Poller` live in `core/tasks/`; remaining raw `setInterval` poll sites (wordnew useWfNewAppState:489, WordNewBookReaderWordCards, WordNewQueueDeliveryRuntime, PcTerminalPage:773, PcAiUsageRecordsPanel) should migrate next.
