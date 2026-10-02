# wordnew Client Orchestration

Scope: the client-side audio orchestration shared by wordnew (Capacitor app and web) and pycore-manager (`shared/orchestration`), wordnew's pycore / Laravel links, clip transfer and storage, task sync, the queue command center and the UI language / theme owner.

Authority: code > config/*_contract.json > this document.

Binding spec: `development-guides/WORDNEW_GUIDE.md` section 1 (clip scheduler HARD RULES R1-R10, change procedure). This document does not restate those rules; a change to them follows the guide's section 1.4. pycore side: `docs_fix/DESIGN_AUDIO_ORCHESTRATION.md`.

Root: `poly_apps/pycore_laravel_wordnew_ui/` (paths below are relative to it).

## 1. Components

| Layer | Files |
|---|---|
| Shared engine `shared/orchestration/` | `orchTypes`, `orchPlanner` (pure TS port of the pycore plan semantics), `orchClipIdentity`, `orchClipScheduler` (the one chain builder, HARD RULES header, `ORCH_CLIP_STAGE_ORDER`), `orchClipResolver` (`resolveOrchClips`, `OrchCursorBook`, `orchRetry`, `orchPool`), `orchClipTable` (`OrchClipTable`), `orchClipBundle` (`resolveByBundles`), `orchComposer` (`runComposition`; phases `inputs`, `plan`, `resolve`, `measure`, `ready`, `failed`), `orchStageLayout`, `OrchStage.tsx`, `useOrchSequencer`, `orchPycoreTask` |
| wordnew services `apps/wordnew/services/orchestration/` | `WordNewOrchClipSources` (`WORDNEW_ORCH_SCHEDULE`), `WordNewOrchComposer` (run owner, R9 recovery), `WordNewOrchClipStore`, `WordNewOrchProgressStore`, `WordNewOrchSources` (inputs), `WordNewOrchTaskStore`, `WordNewOrchPresetStore`, `WordNewOrchVirtualReads` |
| Availability | `apps/wordnew/services/compute/WordNewCompute.ts` (`wordNewChannels`, `wordNewCompute`), `core/integrations/compute/` (`ComputeAvailability`, `createChannelAvailability`) |
| pycore link | `core/integrations/pycore/pycoreTarget.ts`, `PycoreEndpointProbe.ts`, `PycoreLanScanner.ts`, `PycoreApiOrchestrationResources.ts`, `PycoreApiOrchestrationFiles.ts`; `apps/wordnew/integrations/WordNewPycoreLink.ts` |
| Network | `core/network/NativeShell.ts`, `ProtocolFetch.ts`, `TransferLimiter.ts`, `TailnetDiscovery.ts`, `ServiceLink.ts`, `StallGuardedRead.ts` |
| Native (Android) | `native/wordnew/android/app/src/main/java/com/corenode/wordnew/`: `ProtocolHttpPlugin` (Cronet; `bundle` streams frames to disk), `DeviceStoragePlugin`, `LanInfoPlugin` |
| UI | `apps/wordnew/components/orch-compose/`, `components/orch-audio/`, `components/api-center/`, `components/cache/`, `components/transfer/WfNewTransferLimits.tsx`; pycore-manager `pages/audio-orchestration/OrchLiveStagePanel.tsx` |
| Contracts | `config/audio_orchestration_contract.json` (defaults, `transfer`), `config/service_contract.json` (`access.tailnet.pycore_path` `/pycore-api`, `peers_route` `/api/tailnet/peers`), `config/pycore_rpc_contract.json` |
| Laravel | `AppQyV1OrchClientTaskCtl` / service / model (`orch_client_tasks`), `AppQyV1AudioLookupCtl`, `AppQyV1AudioBundleCtl` / `AppQyV1AudioBundleService`, `AppQyV1VirtualReadBatchCtl` / `AppQyV1VirtualReadBatchService`, `AppQyV1SentenceWordTableController` (`virtual_batch`), `App\Support\AudioOrchestrationContract` |

## 2. Plan and composition

- Defaults from the contract (`core/contracts/AudioOrchestrationContract.ts`): output `audio`, segmentation `count` / 1 (one book, chapter or prompt is one segment; `minutes` starts at 10), pattern `words_new` (`meaning: true`), `sentence_zh`, `sentence_en` x2.
- Planner (`orchPlanner`): steps `sentence_en`, `sentence_zh`, `words_new`, `words_all`, `times`; prompt tasks are always one segment. A `meaning` word step emits after each word a zh sentence clip of its short meaning (`meaningOf` = the word); the stage shows it as the word card's meaning line.
- Read state (`readState`): `virtual` (the task's own batch `orch-<task id>`), `history` (an existing batch) or `real` (group read counts only). Effective read count = group read count + virtual read count (Laravel `learning/sentence-words` with `virtual_batch`, overlay by `AppQyV1DailyReadingVirtualProgressService`, never consumed). `wordGroupId` and the batch are part of the plan hash. Played words are recorded into the task's batch (`WordNewOrchVirtualReads`, debounced, request-keyed): `POST learning/virtual-batches/{name}/reads`; `GET learning/virtual-batches`; `DELETE learning/virtual-batches/{name}`; at most 20 batches per user (unreferenced first, then the stalest).
- Sources: `vocab_book` = Laravel media books (optionally one chapter); `prompt_rewrite` = prompt-rewrite results Laravel holds (`/orch_audio/tasks?source=prompt_rewrite`). One list component `WfNewOrchSourceList` renders both tabs through `WordNewOrchSourcePicker` adapters.
- Composition without ffmpeg: `useOrchSequencer` plays a segment's clips on one audio element with a 0.6 s gap and a virtual timeline (same as pycore `segment_timeline`); `OrchStage` renders the pycore video layout in a 16:9 DOM stage (cards, line states, `step` / `smooth`, focus line, progress bar, background colour with dim veil) styled by the pycore preset (`video/presets`, cached by `WordNewOrchPresetStore`, Clean White before first contact).

## 3. Clip identity and transfer

- Identity (`orchClipIdentity`): `contentId = md5(collapse_ws(lower(strip Unicode P/S)))` (pycore `media_content_id`, Laravel `MediaIngestService`); `resourceId = sha256("kind:language:content")` with content = content id (sentence) or trimmed lower-case word. Every store names a clip `orch-clips/<resourceId>.mp3`.
- Bundles: pycore `ui/audio_orch/resource/bundle` and Laravel `POST /api/app_qy_v1/ai_tools/tts/audio/bundle` answer the same frame (`config/audio_orchestration_contract.json` `transfer`; limits 256 items / 8 MB, relay bundles 64). Native: `ProtocolHttp.bundle` parses frames while the response streams and writes each clip into the clip folder (temp file + rename); only frame headers reach JS (`WordNewOrchClipStore.nativeTarget` / `adoptWritten`). `resolveByBundles` keeps several bundles in flight, re-queues deferred hits, and hands a 404 server's items to the per-file path.
- Laravel read-only lookup: `POST /api/app_qy_v1/ai_tools/tts/audio/lookup` (`AppQyV1AudioLookupCtl`, no queue write, no head move) answers clip URLs; the Laravel channel uses it for per-file transfer (web, servers without bundles) and for `holds`. Only `generate:laravel` writes to Laravel's queue: the next `transfer.laravel_head_max_items` (200) missing clips in play order go to `sentence/audio/head` / `word/audio/head`, fire-and-forget.
- `TransferLimiter`: one device-wide limiter with a slot lane per backend (pycore, Laravel); every bulk transfer holds a slot while on the wire; control requests are not limited; limits in `PersistedStore` key `core.transfer.limits` (device-local), defaults `transfer.parallel_defaults` (pycore 3, Laravel 4), clamped 1..`parallel_max` (12); a change applies at once. UI `WfNewTransferBadge` (resolve-progress header) and `WfNewTransferLimitsPanel` (Settings).
- Relay and pycore binary bodies are read with `readBytesWithStallGuard` (no total deadline; fails only after `http_transfer.idle_timeout_seconds` without a byte).

## 4. Channels and schedule

- `wordNewChannels` (`WordNewCompute.ts`, `createChannelAvailability` over `ComputeAvailability`) is the single availability source for the scheduler gates, the composer and the UI: `direct`, `relay` (not direct, Laravel up and paired, or the selected relay target answering), `laravel`; hysteresis up after 500 ms, down after 3 s (`ComputeTypes`). A pairing, unpairing or relay-mode switch publishes a change.
- `WORDNEW_ORCH_SCHEDULE` (`WordNewOrchClipSources`): `buildOrchClipSchedule({device: native only, sink, pycore: orchPycoreDirectChannel, relay: orchPycoreRelayChannel, laravel})`. Native keeps every transferred clip in the device store; the web has no device stage and keeps nothing (Laravel clips per file by URL, pycore clips as page object URLs). Order, gates, generation and recovery: `development-guides/WORDNEW_GUIDE.md` section 1.
- pycore-manager (`OrchLiveStagePanel`): the same scheduler with the pycore channel only (the UI runs on the pycore machine), object URLs.
- Every delivered clip records `via` (`pycore` / `relay` / `laravel`); counts include `generating`. `WordNewOrchChainBadge` shows each stage with its count, dimmed while it cannot run; `WordNewOrchApiEndpoints` shows the APIs that answered this run (a chip opens the API center on that service).

## 5. Runs, progress, recovery

- `WordNewOrchComposer` owns runs (not pages): `ensure(task, {force, resume})` is idempotent per plan hash; pages subscribe with `useSyncExternalStore`; leaving a page keeps the run; forced reloads within 2 s start one run; a cache clear or clip-root change aborts runs and drops sessions.
- Task status `draft | resolving | ready | partial`; a failed run stays `resolving` (shown paused). Recovery triggers, resume semantics, retry / rerun backoff (`orchRetry`, contract `transfer.retry_*`, `transfer.rerun_*`) and the generation watch (`recheckGenerating` every `generation_recheck_seconds` for `generation_watch_minutes`): WORDNEW_GUIDE R9. Opening a task resumes a failed run after 5 s and a run with missing clips after 30 s.
- Progress store (`WordNewOrchProgressStore`, `wfnew-orch/progress.json`): per task keyed by plan hash: the `OrchClipTable` bytes (base64, one byte per plan resource), per-stage cursors (`OrchCursorBook`: endpoint, plan position, time; valid for `transfer.absence_recheck_minutes`), counts, stages; encoded only on write (throttled 2 s). A snapshot of another plan hash is ignored.
- Device id: persistent random id (`wfnew.orch.deviceId`, prefix `d-`); a task whose old fingerprint id differs is adopted when this device holds its progress.
- Inputs (`WordNewOrchSources.load(task, {force})`): Laravel serves only the initial load; native keeps the inputs (`orchInputs`) and reuses a copy of the same source key without network; sentences are kept as soon as fetched (`complete: false`), word-state batches are checkpointed (`<task>.states.json`, at most every 2 s); verse pages load 4 at a time after page 1, word-state batches 3 at a time; progress `session.inputsProgress`; offline uses the kept copy (`fresh: false`).
- Resolve UI (`WordNewOrchResolveProgress`): totals per origin, live transfer rate (5 s window, `session.transfer`), expandable per-item list, input progress.

## 6. Device storage

- `WordNewOrchClipStore` roots: internal app data (`Directory.Data`), a volume's app folder (SD card), `WordNew/` on a volume root (all-files access; index mirrored next to the clips and re-adopted after a reinstall). Changing the root copies all, switches, then deletes (rollback on failure). Index `wfnew-orch/clip_index_v2.json` + append journal `clip_index_v2.log` (one line per clip; compacted after `JOURNAL_COMPACT_RECORDS` 5000); identity, origin, meaning, size, duration; never evicted. One batched `lookup` for the device stage. Clip writes run in parallel (one per key; a second write of the same key joins the first); root moves, adoption and deletes run alone after writes in flight.
- Native plugin `DeviceStorage`: volumes with total / free, directory usage, all-files access, FileProvider open / share; TS `CapDeviceStorage` (web: storage estimate, OPFS usage, persistent grant); `CapDirectory` `null` = absolute path so `CapBlobStore` works on any volume.
- Cache page `#/cache` (Settings "Clear cache"): `WfNewStorageSection`, `WfNewOrchClipLibrary` (words / sentences, search, play, meaning, origin, size, duration, device / pycore / Laravel paths, open / share, delete), `WfNewCacheItemsSection` (registry items `orchClips`, `orchInputs`, `orchProgress`; clearing clips or inputs also clears progress). `WfNewStorageBadge` on the orchestration page (live word / sentence counts, free space).

## 7. pycore link

- `pycoreTarget`: a Capacitor native shell (`isNativeAppShell`) is never a loopback page and never targets `localhost:59000`. Endpoint kinds `direct` (loopback page only, or a private-LAN `http://<ip>:59000` from a native shell), `proxy` (`https://<machine>.<tailnet>.ts.net/pycore-api`), `relay` (any other https entry; offered only with an owner relay session). pycore does not run on the Laravel server: no Laravel origin becomes a pycore entry. Order: this machine, contract tailnet machines (GPU), discovered tailnet machines, host-key loopback, recent, relay; phones are not offered.
- Tailnet discovery (`TailnetDiscovery`): the build seeds the list from `tailscale status --json` (`__TAILNET_PEERS_SEED__`); every known machine is asked for the live list through the UI server `/tailnet_peers.json` and pycore `GET /api/tailnet/peers` (via `/pycore-api`).
- `WordNewPycoreLink`: detection shows which candidates answer and never switches. The selection is the persisted pycore target (shared with pycore-manager in a browser): the first run selects the fastest reachable candidate; later only the user changes it (`choose`, probe-then-select via `switchPycoreTarget`). While the selected pycore is down, `pycoreLink` reconnects to it and requests wait. A session-only entry (`useTemporary` / `clearTemporary`, e.g. a LAN scan result) is used until cleared or the next start. Every user action bumps a generation so an older detection never overrides it.
- Transport: all pycore requests go through `core/integrations/pycore` (`requestPycoreHttp`, `PycoreClient.postBinary`); native requests use `protocolFetch` (Cronet, no `Origin`, so the tailnet mount's CORS gate admits them; private-LAN http allowed; cleartext permitted by `network_security_config.xml`). pycore's K7 gate admits a non-loopback caller only with a K3 signature: an unsigned phone on raw LAN gets 401 (open item).
- LAN scan (`PycoreLanScanner`, UI `WfNewPycoreLanScan`): probes `GET /api/status` on a /24 (32 parallel, 1.2 s timeout; up / refused / no_route); address from native `LanInfo` or the typed gateway; "Use for this session" sets a temporary target.
- API center (Settings, `components/api-center/`): one contract `api/center/WordNewApiServiceTypes.ts` (external store, probed entries, verified selection, user entries, diagnosis) with adapters `WordNewLaravelApiService` and `WordNewPycoreApiService`; the orchestration page opens the same dialog on the pycore tab.

## 8. Tasks

- Device list `wfnew-orch/tasks.json` (`Directory.Data`; the filesystem library's browser backend on the web) is authoritative for editing.
- Laravel `orch_client_tasks` (per user, sanctum): `GET /api/app_qy_v1/orch_audio/client_tasks[?since=]`, `POST .../client_tasks/{clientTaskId}` (upsert; an older `client_updated_at` never overwrites a newer row; answers `{applied, task}`), `DELETE .../client_tasks/{clientTaskId}` (tombstone). Row: `client_task_id`, `name`, `source`, `source_ref`, `config`, `plan_hash`, `status`, counters, `device_id`, `client_updated_at`, `progress` (summary `{plan_hash, phase, done, total}`, stored, never interpreted), `deleted_at`.
- Sync: push on every local change (debounced), pull on page open and login; newest `client_updated_at` wins both ways; tombstones win over older edits; a newer local task is marked unsynced and pushed. The web restores the progress summary from Laravel when no local snapshot exists.

## 9. UI

- `#/orch-audio`: tabs "My compositions" (`WordNewOrchComposeList`, detail `WordNewOrchComposeDetail`, editor `WordNewOrchComposeEditor` with `WordNewOrchReadStateField`, `WordNewOrchNewWords`) and "Delivered" (`?view=delivered`: pycore output delivered to Laravel; `WordNewOrchAudioListPage`, player `#/orch-audio/<task_key>` `WordNewOrchAudioPlayerPage` on the shared `WordNewBookReaderPlayback` engine: modes segments / sentences, repeat off / all / one, speed, prev / next, per-sentence replay and repeats, words read before a sentence (`readWordCardsForSentence`), translation lines, original prompt, segment strip, task words (`playWordClip`) and current-sentence words; highlight from the segment `timeline` (length estimate only without one); sentence pages loaded on demand (`useOrchAudioSentencePages`: prefetch 20 sentences before a page end, segment ranges loaded before a jump, list sentinel `useWfNewLoadMoreSentinel`); sentence rows without audio use the book reader's sentence-audio scheduler (`useWordNewSentenceAudioCells`); settings key `WORDNEW_ORCH_AUDIO_PLAYER`). Home labs card `orch-audio` (`WfNewHomeLabCard`).
- Styling: theme inputs (`orchFormStyles`), collapsible icon sections (`WfNewOrchSection`, `aria-expanded`), compact number inputs. Strings in `locales/en_c.ts` / `zh_c.ts` (`orchCompose.*`) and `en_a.ts` / `zh_a.ts` (`orchAudio.*`); ja / ko fall back to English.

## 10. Queue command center

- `apps/wordnew/services/WordNewQueueCenter.ts` is the one owner of wordnew queue commands (sentence audio, word audio, word translation, word image priority) through `queue/WordNewQueueCommandGateway` (bounded, item-level single-flight; overlapping batches reuse active item promises; capacity rejection before any waiting state; network failures end affected receipts as failed).
- `WordNewQueueRuntime` is state-only: it projects command responses, delivery receipts and worker presence and issues no commands.
- Resource state UI: `WordNewResourceStatusIcon` and one shared delivery icon group (stage, Laravel acknowledgement, worker aggregate). Queue resource and visual-stage types live in the canonical TS Queue Center contract; the word-audio producer batch limit is `config/queue_center_contract.json` `producer_batch_limits`.

## 11. Language and theme owner

- i18next is initialized once in the shared UI core (`core/i18n/UiI18n.ts`). The Shell (`shell/ShellProvider.tsx`) is the only language and theme state owner for laravel-manager, pycore-manager and wordnew, including URL language hydration and live URL changes; codes are normalized against the Shell language catalog. Apps read language and theme from the Shell and keep no second copy.

## 12. Verification

- Scheduler drills: `docs_fix/TEST_20261001_ORCH_CLIP_SCHEDULER_DRILL.md` (bun; S1-S8, 300 randomized rounds, 0 violations; cursor / scale run).
- Switch drills (phone over USB with WebView devtools, or a dev page; prefix `const {wordNewPycoreLink:l}=await import('/apps/wordnew/integrations/WordNewPycoreLink.ts');`, record transitions with `l.subscribe` + `l.getSnapshot()`):

| # | Drill | Expected |
|---|---|---|
| L1 | `await l.ensure(); for (let i=0;i<20;i++){ l.reportFailure(); await new Promise(r=>setTimeout(r,200)); }` | `selectedUrl` never changes; the link reconnects to it |
| L2 | `await l.ensure(); await l.refresh(); await l.refresh();` | state stays `online` |
| L3 | ten rapid `void l.choose(i%2?a:b)` | final `selectedUrl` is the last click |
| L4 | `const p=l.refresh(); await l.choose(B); await p;` | `selectedUrl === B` |
| L5 | `l.useTemporary(LAN); l.clearTemporary();` x10 | ends on the persisted selection, `temporaryUrl === ''` |
| L6 | stop the selected pycore | selection unchanged; requests wait; continue when it answers |

| # | Composer drill | Expected |
|---|---|---|
| C1 | leave and reopen a task 10 times | one run per plan; progress never restarts at 0 |
| C2 | "reload resources" 5 times within 2 s | one forced run; inputs loaded once |
| C3 | airplane mode mid-resolve, then off | run ends `partial`; it resumes by itself and fetches only missing clips |
| C4 / C5 | switch pycore / Laravel endpoint mid-resolve | run continues; one more pass after it ends |
| C6 | edit the plan mid-resolve | old run aborts silently; kept clips are not downloaded twice |
| C7 | clear orchestration clips mid-resolve | runs abort, sessions reset |
| C8 | book task with ~100 missing Laravel clips | parallel downloads up to the Laravel limit |

## 13. Open items

- Queue commands outside `WordNewQueueCenter`: `WordNewOrchClipSources.requestLaravelGeneration` calls `wfNewApi.moveSentenceAudioToHead` / `moveWordAudioToHead` directly (`apps/wordnew/services/orchestration/WordNewOrchClipSources.ts:114`, `:119`).
- `WordNewOrchClipStore.putFromUrl` does not pass the run's `signal` into `blobs.putFromUrl` (`WordNewOrchClipStore.ts:497`), so a native Laravel per-file download cannot be aborted (it finishes and is kept).
- `WordNewOrchClipStore` header comment is out of date: it says the web keeps clips in OPFS (the web schedule has no device stage and keeps nothing, `WordNewOrchClipSources.ts` `WORDNEW_ORCH_SCHEDULE`) and that writes run one at a time (they run in parallel per key, `WordNewOrchClipStore.ts:184`).
- A same-size different clip across a mid-file backend switch is not detected on the chunked fallback (bundle transfers are single requests and unaffected).
- LAN phone access: pycore K7 refuses unsigned LAN callers; pairing the phone to a scoped K3 key or a default-off unsigned LAN read policy for `api/status` and the audio_orch resource routes is pending (`docs_fix/DESIGN_SHELL_HOSTS.md`).
- Delivered-view segments without a ready mp3 fall back to browser speech when reached by auto-advance; segments without `timeline` use the length estimate.
- Switch and composer drills (section 12) have not been run on a device.
- Laravel learning word cards carry `audio_task` (queued / `pycore_unavailable` view of a pending pycore word-audio task, `AppQyV1LearningController.php:304`), but no wordnew reader handles it; only the compute scheduler (`LaravelCompute.classifyLaravelCompute`) and the admin OCR/TTS envelopes interpret a queued `pycore_task` / `pycore_unavailable` answer. A shared handler in the core Laravel layer for the other call sites is not built.
