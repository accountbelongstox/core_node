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
