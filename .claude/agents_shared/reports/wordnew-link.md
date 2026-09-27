# wordnew-link report

## wordnew-link-G1 (D22, 2026-09-27)

Items MCHR-15, MCHR-05 (with MCHR-44), MCHR-32, MCHR-33, MCHR-36 and MCHR-37 are implemented and statically verified. MCHR-05-live is deferred to the user. Status: ready for the wordnew-lead verdict (`.claude/agents_shared/reviews/wordnew-link-G1.json`).

Note: the user's sweep commits `4ddb4be8e` and `2f31f9cd3` ("win0.0.1") picked up the first half of these edits. The rest is still in the working tree. Review against 74e7770. I ran no git write command.

Environment: free RAM was 5.4-6.0 GB. Windows node cannot run tsc or vue-tsc because every `node_modules` entry is a Linux (bun) symlink (`EPERM stat ...\node_modules\vue-tsc`). Both checks ran in Debian WSL instead, with a portable Linux node v22.20.0 in the session scratchpad (`/mnt/d/.../app/*`, `tsc --noEmit -p tsconfig.json` and `vue-tsc --noEmit -p tsconfig.json`).

Baseline before any TS change:
- native-server: 7 errors.
- chrome-extension: 5 errors.
- All 12 come from the stale `packages/shared/dist` (`ClientKeySign*`, `SIGN_CLIENT_REQUEST*`, `EXTENSION_ID`, `FIREFOX_EXTENSION_ID`).

Final run (r3), after all items: the same 7 and 5 errors, and no new error.

### MCHR-15: `--wake` only when the extension is disconnected

- Status: done.
- File: `apps/mcp-chrome/scripts/service_supervisor.py` (`main()`).
- Change: `--wake` calls `extension_is_connected()` first. When the extension is connected it only logs. `wake_extension(force=True)` runs only in the `else` branch.
- Verification:
  - `python -m py_compile` passes.
  - An in-process stub run (connected=True gives 0 wake calls; connected=False gives `[True]`) prints `connected True rc 0 wake calls []` and `connected False rc 0 wake calls [True]`.

### MCHR-05 (with MCHR-44): the `-ServiceRun` host owns the supervisor

- Status: done (static). The live second-run and uninstall check (MCHR-05-live) is deferred to the user.
- Files: `apps/mcp-chrome/scripts/service_supervisor.py`, `apps/mcp-chrome/scripts/start.ps1`.
- Supervisor changes:
  - New `--parent-pid` option.
  - `attach_owner_process()` holds a SYNCHRONIZE handle on Windows (`WaitForSingleObject(handle, 0)`, so a reused PID cannot fool it) and uses `os.kill(pid, 0)` on POSIX.
  - `supervise()` stops with "Owner process N exited" once the owner is gone, checked every 2 s.
  - An owned supervisor that finds the singleton taken waits while its owner lives, instead of exiting. Otherwise the restart loop would respawn it, and re-request recovery, every 5 s.
  - The kernel32 setup is now one `windows_kernel32()` helper, shared by the mutex and the owner handle.
- `start.ps1 -ServiceRun` changes:
  - It appends `--parent-pid $PID` to the supervisor arguments, as dev-watch already did.
  - It starts both processes with `Start-Process -PassThru` and polls every `$ServiceRestartSeconds`, restarting whichever process has exited. That covers a crashed supervisor and a stopped watcher.
- Result: Stop-UserLogonTask ends only the PowerShell host, and the supervisor (within 2 s) and dev-watch (within 3 s, with `taskkill /T` on its watchers) follow it. This covers converge and `-UninstallService`, and matches start.sh:123-130.
- Verification:
  - The PowerShell Parser reports `ParseErrors: 0`.
  - `py_compile` passes.
  - In-process owner check on Windows: attach True, alive while running True, alive after exit False, dead PID attach False.
  - The same check in Debian WSL (POSIX branch) gives the same results.
- Deferred and noted:
  - A supervisor started before this change has no `--parent-pid` and survives one more uninstall. A logoff or reboot clears it. The new owned supervisor simply waits for it.
  - The interactive dev path (start.ps1:486) still starts a detached supervisor. That is out of the item's scope.

### MCHR-32: dead keys, one native-host registration, no update-port

- Status: done.
- Files:
  - `apps/mcp-chrome/app/chrome-extension/utils/storage-keys.ts`
  - `apps/mcp-chrome/scripts/native-host-common.cjs`
  - `apps/mcp-chrome/scripts/register-local-dev.cjs`
  - `apps/mcp-chrome/app/native-server/src/scripts/browser-config.ts`
  - `apps/mcp-chrome/app/native-server/src/scripts/utils.ts`
  - `apps/mcp-chrome/app/native-server/src/cli.ts`
- Storage keys: `SEMANTIC_ENGINE_STATE`, `USER_PREFERENCES` and `VECTOR_INDEX` are removed. A grep, including dynamic `STORAGE_KEYS[...]` access, found no user.
- Registration, choice "register:dev uses scripts/native-host-common.cjs" (the recommended direction). Reason: the `.cjs` runs without a build, and the start scripts and kimi launchers already call `register-local-dev.cjs`.
  - `native-host-common.cjs` now holds the only per-browser table: Chrome, Chromium and Firefox, with the user and system manifest segments, the registry paths and the detection data. It also holds the shared helpers (`getSystemManifestPath`, `getWindowsSystemRegistryKey`, `createManifestContent`, `buildWindowsRegistryAddCommand`, `writeNodePath`) and the single user-level `registerUserHost()`.
  - `browser-config.ts` loads that file at run time. The path is `path.resolve(__dirname, '../../../../scripts/native-host-common.cjs')`, which is the same depth from `src/` and `dist/`. It keeps its exported API.
  - In `utils.ts`, `tryRegisterUserLevelHost` (register:dev, CLI `register`, postinstall) calls `registerUserHost`. `getMainPath`, `writeNodePath`, `createManifestContent` and the registry command delegate to the shared file.
  - `register-local-dev.cjs` keeps only its main flow: the extension ID from the built manifest, the dist checks and the summary.
- CLI: the `update-port` command, which wrote `config/service_contract.json`, is removed with its unused `fs` and `path` imports.
- Verification:
  - tsc (native-server): 7 errors, all baseline.
  - vue-tsc: 5 errors, all baseline.
  - `grep -rln "userManifestSegments|windowsPath:"` finds only `scripts/native-host-common.cjs`.
  - A grep for `writeFile.*service_contract` and `update-port` finds nothing.
  - A node smoke test gives the correct paths and registry keys for all three browsers. The Chrome manifest keeps allowed_origins, and Firefox gets allowed_extensions. Both require paths resolve.
- Behavior note: a failed HKCU registry write is now a warning in register:dev too, as it already was in register-local-dev. It no longer fails the browser.
- Cross-scope note (no action): `build_orchestrator.py:98-102`, `service_supervisor.py:manifest_candidates` and the extension hint in `native-host.ts:132-137` keep Chrome-only path lookups (Python, or display text). They are not per-browser tables.
- Left out of scope: the chmod helpers (`setExecutionPermissions` in register-local-dev and `ensureExecutionPermissions` in utils) are still two.

### MCHR-33: endpoint labels through i18n

- Status: done.
- Files:
  - `apps/mcp-chrome/app/chrome-extension/config/api-endpoints.ts`
  - `apps/mcp-chrome/app/chrome-extension/entrypoints/popup/components/ApiSettings.vue`
  - `apps/mcp-chrome/app/chrome-extension/entrypoints/popup/components/EndpointDropdown.vue`
  - `apps/mcp-chrome/app/chrome-extension/_locales/{de,en,ja,ko,zh_CN,zh_TW}/messages.json`
- Changes:
  - `ApiEndpoint` gets `labelKey?`. `description` becomes optional and is kept for the stored label of a user-added endpoint.
  - Built-in endpoints carry the keys `apiEndpointProduction`, `apiEndpointLocalhost`, `apiEndpointLoopback`, `apiEndpointLanBackup`, `apiEndpointLanPrimary`, `apiEndpointRemoteLaravel`, `apiEndpointTailnetNuul` and `apiEndpointTailnetApi`.
  - The single resolver `getEndpointLabel()` in api-endpoints.ts renders ApiSettings.vue:85 and :210-212 and EndpointDropdown.vue:64.
- Verification:
  - vue-tsc shows only the 5 baseline errors.
  - All six locale files parse as JSON, and each has the 8 keys (+24 lines).
  - Line endings are kept, including the mixed en and zh_CN files.
  - "Production Cloud Server" now appears only as the en message value. No `.ts` or `.vue` file contains it.

### MCHR-36: Bing runtime on SimpleWorkerRuntimeBase

- Status: done.
- Files:
  - `.../background/services/bing-dictionary-worker-runtime.ts`
  - `.../background/services/task-center/SimpleWorkerRuntimeBase.ts`
  - Adjacent, required by the new base class:
    - `.../background/services/bing-dictionary-worker-service.ts`: its private `pullTasksAcrossTypes`, `noteFastSignals` and `scheduleFastRepoll` clashed with the base's protected members.
    - `.../background/services/task-center/SimpleWorkerBase.ts`: the four fast-lane hooks moved up to the base.
- Base changes (`SimpleWorkerRuntimeBase`):
  - It is generic over the config (`SimpleWorkerRuntimeBase<TConfig>`, with `SimpleWorkerSettings<TConfig>`).
  - It adds `normalizeConfig()`, `completeRegistration()` and `prepareActivation()`, used by start and by the registration retry.
  - It adds the `registrationMetadata`, `rotatesPullTaskTypes` and `restartHeartbeat()` hooks.
  - It now owns `applyHeadSignal`, `updateQueueProgress`, `noteFastSignals` and `scheduleFastRepoll`, moved from SimpleWorkerBase without change. SimpleWorkerBase subclasses keep their behavior.
- Bing runtime:
  - It extends `SimpleWorkerRuntimeBase<WorkerConfig>`. Its own `taskPolling`, `heartbeatPolling`, `fastRepollTimeout`, `wakeUnsubscribe`, `registerWorker`, `heartbeatOnce`, `startPolling` and `subscribeRealtimeWake` are gone.
  - start: `super.start()` handles register, retry and activation. `prepareActivation` enqueues pending words and reveals the pool on a user Start, keeping the old order (register, then enqueue and tabs, then the loops).
  - stop: `super.stop()` plus the Bing teardown.
  - repoint: `super.repoint()` with a `repointing` flag, so the run intent, watchdog, tabs and stats survive and nothing is surfaced.
  - updateConfig: an endpoint change calls `this.repoint()`. The heartbeat is re-armed with `restartHeartbeat()`, and pollWait is read live by the base loop.
  - Registration: processor `bing_dictionary`, lanes remote_client, remote_translation and remote_fast, capability translate, metadata `tabCount`. The worker_id now persists per session through the base.
- Bing service:
  - `cycle()` has a `cycleInFlight` guard and uses base `pullTasksAcrossTypes`, `takePrefetchedHeadTasks` and `noteFastSignals`.
  - `processTask` is renamed `executeTask`.
  - A Stop or repoint ends the batch after the current task, and the claimed tasks not yet started are released through `releaseTasks`.
  - `prefetchChangedHead` skips during an outage or cooldown.
  - The pull order stays a priority: dictionary types before word_translation (`rotatesPullTaskTypes=false`).
- K6: every Laravel call still goes through `WorkerApiClient`, which signs through the native host. No key handling changed.
- Verification:
  - vue-tsc r2 showed 3 new errors (Required<TConfig> indexed access). They were fixed with `SimpleWorkerSettings`, and r3 shows the 5 baseline errors only.
  - A grep for `heartbeatPolling`, `taskPolling`, `IntervalController`, `fastRepollTimeout`, `wakeUnsubscribe` and `queueCenterWakeService` in both Bing files finds 0 hits.
  - The base paths in use are `super.start`, `super.stop`, `super.repoint`, `super.prefetchChangedHead`, `restartHeartbeat`, `pullTasksAcrossTypes`, `takePrefetchedHeadTasks` and `noteFastSignals`.
- Behavior notes for the reviewer:
  - Bing now also runs the base queue-diff poll: one GET per task type per `poll_interval_ms`, which is 3 types at 1 s. The Laravel diff route is generic per queue.
  - A tab-pool open failure on Start is now a warning instead of a start failure.
  - A transient registration failure retries instead of throwing.

### MCHR-37: the Gemini tool uses the shared generation mutex

- Status: done.
- Files:
  - `.../background/tools/browser/gemini-image.ts`
  - `.../background/services/gemini-image-generate.ts`
  - Adjacent: `.../background/gemini-image-listener.ts` (the popup path, 2 lines).
- Mutex: the single `generationMutex` now lives on `GeminiImageTool`, the tab owner. `generateViaGemini` uses `geminiImageTool.runExclusive()`, which also avoids an import cycle between the two files. That leaves one `new AsyncMutex()` for Gemini.
- Tool:
  - `execute()` start calls `startExclusive()`. It acquires the mutex with a bounded wait of 20 s, so the call answers inside the default 30 s bridge timeout. If the tab stays busy it returns "tab busy".
  - After a successful start, the job keeps the mutex as a lease until status reports done or failed, or until its deadline plus 5 s.
  - An uncollected job is settled through `cancel()` (tab reset) before the release. That is the cancel path.
  - `execute()` status calls `statusExclusive()`. It polls inside the job's own lease, or under the mutex with a bounded wait, answering "generating" while the tab is busy.
  - `status()` now treats a failed job as final, so an image that renders late is never taken as its result.
  - The popup listener uses the same `startExclusive` and `statusExclusive`.
- Verification:
  - vue-tsc shows the 5 baseline errors only.
  - The grep finds `new AsyncMutex` for Gemini only at gemini-image.ts:113. `runExclusive` is used by generateViaGemini.

### Files changed by me in G1

- `apps/mcp-chrome/scripts/{service_supervisor.py,start.ps1,native-host-common.cjs,register-local-dev.cjs}`
- `apps/mcp-chrome/app/native-server/src/{cli.ts,scripts/browser-config.ts,scripts/utils.ts}`
- `apps/mcp-chrome/app/chrome-extension/utils/storage-keys.ts`
- `apps/mcp-chrome/app/chrome-extension/config/api-endpoints.ts`
- `apps/mcp-chrome/app/chrome-extension/entrypoints/popup/components/{ApiSettings.vue,EndpointDropdown.vue}`
- `apps/mcp-chrome/app/chrome-extension/_locales/{de,en,ja,ko,zh_CN,zh_TW}/messages.json`
- `apps/mcp-chrome/app/chrome-extension/entrypoints/background/services/{bing-dictionary-worker-runtime.ts,bing-dictionary-worker-service.ts,gemini-image-generate.ts}`
- `apps/mcp-chrome/app/chrome-extension/entrypoints/background/services/task-center/{SimpleWorkerRuntimeBase.ts,SimpleWorkerBase.ts}`
- `apps/mcp-chrome/app/chrome-extension/entrypoints/background/{tools/browser/gemini-image.ts,gemini-image-listener.ts}`
- `.claude/agent-memory/wordnew-link/{type-check-on-windows.md,MEMORY.md}`
- this report

Line endings match 74e7770 in every file. The stripped AI rules header in `start.ps1` was not re-added.

### Status

- Blockers: none.
- Next owner: wordnew-lead, for the verdict.
- Open items:
  - MCHR-05-live (user).
  - The CKA-01 rebuild (G2). The running native host and extension use the old dist until `build:shared`, then native, then extension.

## wordnew-link-G2 (D22, 2026-09-27)

Items WNL-01, WNL-02, MCHR-43, CKA-01 and MCHR-45 are done. MCHR-43's non-interactive check stays gated on shell-windows MCHR-02, as the item says. Status: ready for the wordnew-lead verdict (`.claude/agents_shared/reviews/wordnew-link-G2.json`).

Note: the user's sweep commit `93f8de054` (21:48) already contains my WNL-01 and MCHR-43 edits. Review against 74e7770. I ran no git write command.

Environment:
- Free RAM: 1.39 GB at the start, so I edited first. Then 6.58 GB for the UI tsc, 4.04 GB for the build, and 3.00 GB for the mcp-chrome type checks (after I dropped the WSL page cache; a 1.4 GB user `git` process was running).
- The mcp-chrome build and type checks ran in Debian WSL, with a Linux bun 1.4.2 (matching Windows `bun --version`) and node v22.20.0 in the session scratchpad. Windows cannot use `node_modules`, because every entry there is a Linux symlink (see agent memory `type-check-on-windows`). No global install was made.
- The WSL clock runs about 7 minutes ahead of Windows. All times below are Windows times.

### WNL-01: the wordnew pycore glue and the TTS priority panel (K7a)

- Status: done.
- Files. wordnew-lead assigned these paths to me for this run.
  - `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/integrations/pycore.ts`: it now re-exports `classifyPycoreAccess` and `type PycoreAccess` from `core/integrations/pycore` (+2 lines).
  - `.../apps/wordnew/components/settings/WordNewTtsEnginePriorityPanel.tsx`:
    - `DEFAULT_TTS_PRIORITY`, the drifted copy without parler, is removed. The initial draft is `[]`, and the order comes only from pycore.
    - A failed load or save sets `access = classifyPycoreAccess(error)` (:75, :113). The banner shows one localized hint per kind through the typed map `ACCESS_HINT_KEYS: Record<PycoreAccess['kind'], string>` (:18-25). A new kind added to the shared union becomes a compile error until it is mapped.
    - While `access` is set, no order is shown (the draft is cleared) and Save is disabled (:201, `access !== null || draft.length === 0`). Reload retries.
    - A save that pycore answers with `success: false` keeps the order and shows `ttsPriority.saveFailed`. Only a thrown request error is classified.
    - An empty `tts.priority` falls back to `Object.keys(tts.available)`, which lists the engines pycore reports in pycore's order (:71). pycore cannot actually return an empty tts priority: `capability_service.py:_merge_order` (:86-103) returns the known order `default_tts_engine_priority()` when both the live and saved lists are empty. So no pycore request is needed.
    - The `(r as any)` casts are gone, because `PcCapabilitySettings` already types `success` and `error`.
  - `.../apps/wordnew/locales/{en_b,zh_b}.ts`: 5 new keys in each. They are `ttsPriority.relayOnly`, `originNotAllowed` ({origin}, {ports}), `hostForbidden` ({code}), `originForbidden` ({origin}, {code}) and `clientKeyRejected` ({code}). The `unreachable` kind reuses the existing `ttsPriority.unreachable`. ja and ko fall back to English through `translate()`.
- Choice (recommended option): host_forbidden and origin_forbidden get separate hints, as in pycore-manager and vortex, instead of one shared text.
- Choice (recommended option): a thrown save error also clears the order and disables Save, because "pycore cannot be used" then holds. The user's reorder is lost, and Reload fetches it again.
- Verification:
  - `bun node_modules/typescript/bin/tsc --noEmit` in the UI root: exit 0, 0 `error TS` (778 s, free RAM 6.58 GB).
  - A grep for `DEFAULT_TTS_PRIORITY|capabilities/settings|:59000` in apps/wordnew finds 0 hits.
  - All 19 `ttsPriority.*` keys the panel uses exist once in en_b.ts and once in zh_b.ts.
  - The panel's only pycore import is `@/apps/wordnew/integrations/pycore` (:11-13).
- Line endings: all four files are CRLF on both sides (`git ls-files --eol`: i/crlf w/crlf). The Edit tool briefly wrote the panel with the wrong ending, and I restored CRLF.

### WNL-02: linkage audit (read-only)

| # | Linkage point | Evidence | Status |
|---|---|---|---|
| 1 | Every wordnew pycore call goes through `apps/wordnew/integrations/pycore.ts` and PycoreApiLocal | A grep for `integrations/pycore`, `requestPycore`, `pycoreMasterClient`, `59000` and `PYCORE_PORT` over `apps/wordnew` and `flavors/wordnew` finds only the adapter (`integrations/pycore.ts:10-11`) and the panel import (`WordNewTtsEnginePriorityPanel.tsx:11-13`). The panel calls `pycoreApi.getCapabilitySettings` (:57) and `saveCapabilitySettings` (:99), which go to `core/integrations/pycore/PycoreApiLocal.ts:502-514` and then `PycoreHttp.ts:301 requestPycoreHttp`, on routes `PycoreHttpRoutes.ts:179-180`. All other wordnew data (orch audio, daily reading) comes from Laravel. | ok |
| 2 | `config/pycore_relay_contract.json` route_policies cover the routes wordnew calls | wordnew calls `ui/capability_status/get_capability_settings` and `ui/capability_status/post_capability_settings` (POST, `PycoreHttpRoutes.ts:179-180`). No exact, prefix or suffix policy matches them among the 69 `route_policies`, so both fall to `route_policy_matching.default_profile` = `general_action` (contract :289, :341): permission `relay.route.control`, retry `at_most_once_action`. The same resolution is in `RelayContract.php:242-300` and `relay_contract.py:560-607`. A relay page therefore works only with a token that can `relay.route.control` or `relay.*` (`RelayAuthorizationService.php:21-24`). A read-scoped relay token gets `route_permission_denied`, and the read is never retried. | request sent to orchestrator (via wordnew-lead): add exact POST policies `ui/capability_status/get_capability_settings` → `general_read` and `ui/capability_status/post_capability_settings` → `general_write`. pycore-manager's capability drawer calls the same two routes. |
| 3 | pycore → Laravel orch_audio ingest → the wordnew listing (`apps/wordnew/components/orch-audio`) fits the D7 pass criteria (§8.2 step 5a) | **pycore:** `orch_delivery.py:281-325` posts `{machine_id, tasks:[ingest]}` to `/api/app_qy_v1/orch_audio/ingest/tasks` (:41), signed by `laravel_client`. It then uploads only the `segments_missing` mp3s through offset-v1 `ingest/segment-audio` (:42). Only tasks in done or failed are delivered (:39). **Laravel:** the route is `client.key` (`AppQyV1OrchAudio.php:12-18`). `AppQyV1OrchAudioService::ingestTasks` (:97-112) takes sorted `pg_advisory_xact_lock`s per task_key (:266-277), then does `updateOrCreate(['task_key'])` only when `meta_hash` changed (:292, :333). A repeat upload is `unchanged`, so each task exists exactly once (task_key = sha256(machine_id, task_id)[:40], model :62-65). Segments are addressed by sha256, and an already stored segment returns `alreadyStoredReceipt` (:146-153). **wordnew:** `GET app_qy_v1/orch_audio/tasks` (sanctum, :20-24) → `api/methods/orchAudio.ts:139` → `WordNewOrchAudioListPage.tsx:77`. The source ids `vocab_book` and `prompt_rewrite` match pycore `orch_sources.py:22-24` and `orchAudioModel.ts:52-53`. | ok (static). The run-time proof belongs to the D7 long run. Non-blocking: the source ids are literals on both ends, and a `queue_center`/`service` contract entry would centralize them (orchestrator, optional). Ingest trusts the body `machine_id` (`AppQyV1OrchAudioCtl.php:44, :68`), not the signer, which is acceptable under the one shared K2 key. |
| 4 | The extension's Laravel worker calls (bing dictionary, cover tasks) sign through the native host | Bing: `bing-dictionary-worker-service.ts:692,748` `new WorkerApiClient`. Cover tasks: `gemini-image-worker-service.ts` (library_cover) and `media-image-worker-service.ts` (library_cover_search, poster) run on `SimpleWorkerRuntimeBase`/`AssistPollingWorkerBase` with `WorkerApiClient` (`SimpleWorkerRuntimeBase.ts:28`). `WorkerApiClient` extends `BaseApiClient`, which calls `laravelFetch` (`BaseApiClient.ts:86`). `LaravelTransport.ts:95-128` sends only method, path+query and body digest to `requestClientKeySignature`. That is the native host's `SIGN_CLIENT_REQUEST` (`native-host.ts:436-437`), and the key never enters the extension. The only unsigned Laravel fetches are the public health and up probes (`api-health-listener.ts:26`, `ApiManager.ts:204`) and the Mercure subscribe with its own JWT (`QueueCenterWakeService.ts:115`). The bootstrap overview before that subscribe is signed (:102). | ok. Before CKA-01 the running host (dist 03:13) had no `sign_client_request` handler, so signing was off at run time. After the CKA-01 rebuild, `app/native-server/dist/native-messaging-host.js` contains it. The host process that is already running picks it up on its next start. |

Gaps and requests (through wordnew-lead):
- orchestrator (contracts): point 2, the relay route policies for the two capability-settings routes.
- None for pycore-lead, ncore or wordnew-laravel.

### MCHR-43: watch-mode prompt parity in start.ps1

- Status: done. The non-interactive part of the verify is gated on shell-windows MCHR-02, which has no verdict yet.
- Files:
  - `apps/mcp-chrome/scripts/start.ps1` :257-262 (+6 lines).
  - `apps/mcp-chrome/app/chrome-extension/_locales/{de,en,ja,ko,zh_CN,zh_TW}/messages.json`: `startWatchPrompt` loses its trailing `[Y/n]` (`[J/n]` in de), 1 line each, because the shared helper prints ` [Y/n] ` itself. The key was unused before this change (grep).
- Logic, in order:
  1. `MCP_CHROME_WATCH_MODE` pre-answers.
  2. An installed or converging service forces `once`.
  3. Otherwise `Read-YesNoDefaultYes (Get-LocalizedMessage -Key "startWatchPrompt")` from `NssmServiceManager.ps1` (already dot-sourced at :175-179) decides: No gives `once`, the default gives `dev`.
  - There is no local prompt copy and no caller-side non-interactive guard. MCHR-02 centralizes that in the helper.
- Verification:
  - PowerShell Parser: `ParseErrors: 0`.
  - Stub dry run of the block (scratchpad `watch_dry.ps1`, which runs start.ps1 lines 253-269 with stubbed helpers):

    | env | service | answer | prompts | mode |
    |---|---|---|---|---|
    | 'once' | none | - | 0 | once |
    | 'no' | none | - | 0 | once |
    | 'dev' | none | - | 0 | dev |
    | '' | none | Yes | 1 | dev |
    | '' | none | No | 1 | once |
    | '' | install | - | 0 | once |

  - Current shared helper, before MCHR-02:
    - With DD_AUTO_CONTINUE=1 and stdin redirected (no -NonInteractive), `Read-YesNoDefaultYes` returns True (the default) without blocking.
    - Under `powershell -NonInteractive` it throws "Read and Prompt functionality is not available", so the after-MCHR-02 check must be re-run then.
- Line endings: start.ps1 stays LF (i/lf w/lf, as at 74e7770). The locales keep CRLF, and en and zh_CN keep their mixed endings (`git ls-files --eol` unchanged). All 6 locales parse and keep 724 keys.
- Behavior note: start.sh:227-229 forces `once` for DD_AUTO_CONTINUE, while start.ps1 now takes the prompt default `dev`, as the item orders. An unattended Windows run without `MCP_CHROME_WATCH_MODE` still parks in foreground dev-watch, as it did before this change. If Linux parity is wanted, that is a follow-up for wordnew-lead and shell-windows.

### CKA-01: @fastify/cors removal carry-over and the ordered build

- Status: done.
- The verdict on `pnpm-workspace.yaml`: `mcp-chrome-D7.json` says to keep the deletion, and nobody asked for a restore, so I restored nothing.
  - New fact for wordnew-lead: the file is tracked again. The user's Debian merge `36b72cd55` (parent `937239e18`, based on `b20962b4f`, where the temporary file existed) brought it back at 21:31, and the sweep `93f8de054` committed it.
  - I did not delete it, because it now comes from the user's own merge and deleting it is not asked. Bun ignores it and the build is unaffected.
  - Decision needed from wordnew-lead or the user: delete it again to match 74e7770, or keep it.
- Build: one run of `bun run build` in Debian WSL (scratchpad `build_mcp.sh`), which runs build:shared, then build:native, then build:extension.
  - `BUILD_RC=0`.
  - shared: tsup CJS/ESM plus DTS, exit 0.
  - native: `tsc` compile, `[OK] Build completed`, exit 0.
  - extension: WXT 0.20.26, `Built extension in 10.4 s`, exit 0.
- Evidence:
  - `build_output/build_extension/build-stamp.json` changed from `1790442813787` (03:13) to `{"buildId":"1790510594872"}` (21:53).
  - `packages/shared/dist/index.js` is dated 21:50, and `app/native-server/dist/{index,cli}.js` 21:53.
  - The built en locale has `startWatchPrompt` = "Enable development watch mode?".
  - `app/native-server/dist` has 0 `fastify/cors` hits. It now contains `local_rpc_guard` (`dist/constant/index.js`) and `sign_client_request` (`dist/native-messaging-host.js`).
- verify grep: `fastify/cors` in `app/native-server/package.json`, `pnpm-lock.yaml`, `bun.lock` and `app/native-server/src` finds 0 hits.
- Side effect: the native build script created `/var/_core_node/mcp_chrome/logs` inside the Debian WSL root fs, which is its normal behavior. `git status -- apps/mcp-chrome` is clean after the build, because every build output is ignored.
- Runtime note: the native host that is already running (run_host.bat) still has the old code loaded. Chrome starts the new dist on the next native connect, and the extension reloads itself from the new build stamp. I did not restart any service.

### MCHR-45: final mcp-chrome verify

- Status: done.
- Scope: `apps/mcp-chrome/{app/chrome-extension,app/native-server,packages/shared}` and `poly_apps/laravel_main/app/Apps/AppQyV1/Services/AppQyV1LibraryCoverTaskService.php` (read-only).
- Checks, run after the CKA-01 build in Debian WSL (scratchpad `typecheck_mcp.sh`, node v22.20.0). Free RAM was 3.00 GB (Windows) before the start, with 5.0 GB free inside WSL.
  - `tsc --noEmit -p tsconfig.json` (packages/shared): `SHARED_TSC_RC=0`, 0 errors.
  - `tsc --noEmit -p tsconfig.json` (app/native-server): `NATIVE_TSC_RC=0`, 0 errors.
  - `vue-tsc --noEmit -p tsconfig.json` (app/chrome-extension): `EXTENSION_VUE_TSC_RC=0`, 0 errors.
  - The G1 baseline of 7 native and 5 extension errors, all from the stale `packages/shared/dist`, is gone after the rebuild.
  - `php -l` (Windows PHP 8.5.2 CLI) reports "No syntax errors detected" for `app/Apps/AppQyV1/Services/AppQyV1LibraryCoverTaskService.php`, and for the related `app/Services/TaskProcessors/LibraryCoverTaskProcessor.php` and `app/Services/TimerTasks/AppQyV1LibraryCoverFallbackTask.php`.
- Path note: the item names `app/Apps/AppQyV1/AppQyV1Services/...`, but the file lives under `app/Apps/AppQyV1/Services/`.

### Files changed by me in G2

- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/integrations/pycore.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/components/settings/WordNewTtsEnginePriorityPanel.tsx`
- `poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/locales/{en_b,zh_b}.ts`
- `apps/mcp-chrome/scripts/start.ps1`
- `apps/mcp-chrome/app/chrome-extension/_locales/{de,en,ja,ko,zh_CN,zh_TW}/messages.json` (1 line each)
- Build outputs, all git-ignored: `apps/mcp-chrome/packages/shared/dist`, `app/native-server/dist`, `build_output/build_extension`.
- `.claude/agent-memory/wordnew-link/type-check-on-windows.md` (the WSL build recipe and the eol check)
- this report

No `config/*_contract.json`, test, fenced or development-guides file was touched. No AI rules header was re-added.

### Status

- Blockers: none.
- Next owner: wordnew-lead, for the verdict and to decide the re-appeared `pnpm-workspace.yaml`.
- Cross-scope:
  - orchestrator: the relay route policies (WNL-02 point 2).
  - shell-windows: MCHR-02, which unlocks the MCHR-43 non-interactive verify.
  - user: MCHR-05-live, still open from G1.
