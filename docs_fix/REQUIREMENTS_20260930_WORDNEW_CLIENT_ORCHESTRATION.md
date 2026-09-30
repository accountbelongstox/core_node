# WordNew Client-Side Audio Orchestration - Requirements and Design

Binding design for the 2026-09-30 wordnew directives. It builds on
`REQUIREMENTS_20260930_ORCH_VIDEO_QUEUE_DELIVERY_REFACTOR.md` (pycore
orchestration, presets, timeline) and reuses its plan semantics; nothing there is
superseded except where section 2 says so.

## 0. Global rules

`AGENTS.md`, `development-guides/PYTHON_PYCORE.md`,
`development-guides/LARAVEL_GUIDE.md`. English code, i18n for every UI string,
no duplicated components (reuse or upgrade), Windows + Linux compatible. Laravel
is edited locally and verified on the server only.

## 1. Directives (user, 2026-09-30)

| id | directive |
|---|---|
| W1 | Give the wordnew UI the same audio orchestration as the pycore-manager page. |
| W2 | wordnew uses the official Capacitor libraries and can use the phone's whole storage; on the web it uses the pycore / Laravel resource URLs directly. |
| W3 | A wordnew pycore API library that reaches an online pycore: the tailnet URL, the `api.si.12gm.com` entry or the LAN. |
| W4 | While orchestrating, a missing resource is read from the pycore cache first, then from Laravel; what is read stays on the phone permanently. |
| W5 | The orchestrated audio is not produced with ffmpeg: the UI composes the dynamic content itself and simulates the video. |
| W6 | The orchestration task list is kept in Laravel and in the app. |
| W7 | Problems found are fixed at the foundation, with a new approach where needed, not patched. |
| W8 | This design lives in `docs_fix`. |

## 2. Findings (measured in the code)

1. Foundation defect (W7): `core/integrations/pycore/pycoreTarget.ts` decides
   "loopback page" from `location.hostname`. Inside the Capacitor app the page is
   `https://localhost`, so the app was treated as the pycore machine: default
   target `http://localhost:59000` (nothing listens on a phone), relay preset
   suppressed, proxy entries allowed only by accident.
2. Tailnet discovery reads `/<tailnet_peers file>` same-origin. The app bundle has
   no such file, so the phone never saw a tailnet machine.
3. pycore's K7 gate (`pyutils/common/local_rpc_guard.py`) admits a non-loopback
   caller only with a K3 client-key signature; a phone never holds a machine key.
   A raw LAN `http://<ip>:59000` is therefore refused by design and is not a
   valid endpoint. The LAN path is the FrankenPHP tailnet mount: when the phone
   and the machine share a LAN, Tailscale routes the tailnet connection directly
   over the LAN.
4. The tailnet mount (`fm_caddy_tailnet_pycore_mount_render`) answers tailnet
   source addresses and rejects a foreign `Origin` (the app's `https://localhost`
   is foreign). Android HTTPS calls already leave through the native Cronet
   transport (`core/network/ProtocolFetch.ts`, used by `MasterApiClient`), which
   sends no `Origin`, so the mount admits them.
5. The relay entry `https://api.si.12gm.com` (`pycore_relay_contract.json`
   `public_urls.laravel_api_origin`) needs an owner relay session; it is a valid
   candidate only while that session exists.
6. pycore had no route that answers "is this word / sentence clip in your cache,
   and give me its bytes": `task_history/cached_audio_resource` needs a local
   path. The wordnew resolver needs a content-addressed lookup.
7. wordnew's existing `orch-audio` pages only play pycore output already
   delivered to Laravel (`/orch_audio/tasks`); it cannot compose.
8. `CapBlobStore` defaults to `Directory.Cache` (the OS may purge it) and
   `CapLargeCache` evicts by budget; neither satisfies "kept permanently".

## 3. Architecture

```
wordnew UI (orchestration page)
  WordNewOrchTaskStore ── device JSON (Directory.Data) ──┐
        │                                                ├─ sync ─ Laravel client_tasks
  orchPlanner (pure TS port of pycore plan semantics)    ┘
        │ items per segment
  WordNewOrchResolver ── device clip store (permanent) ─ hit
        │ miss                                   
        ├─ pycore  ui/audio_orch/resource/lookup + resource/chunk   (WordNewPycoreLink)
        └─ Laravel sentence audio (passive) / sentence-words media (+ head enqueue)
  WordNewOrchSequencer (one <audio>, virtual timeline, gaps)
  WordNewOrchStage (DOM 16:9 stage: scrolling bilingual cards, preset look)
```

### 3.1 pycore endpoint layer (W3, W7)

- `pycoreTarget` gets a page context: `isNativeAppShell()` (Capacitor native).
  A native shell is never a loopback page; its default target is the first
  reachable discovered entry, never `localhost:59000`.
- Candidates, deduplicated by URL:
  - tailnet proxy entries `https://<machine>.<tailnet>.ts.net/pycore`, from the
    live peers document. On the web it is read same-origin; in the native shell
    it is read from every known tailnet origin (the wordnew Laravel endpoints and
    contract URL entries whose host ends in `.ts.net`) - discovered, never static.
  - the relay entry (contract origin) while a relay owner session exists.
  - user-added entries (any https FrankenPHP mount, e.g. a LAN machine name).
- `WordNewPycoreLink` (wordnew library) probes the candidates (`GET /api/status`
  through the shared probe), keeps the fastest `up` entry selected without a page
  reload, re-probes on network change and on failure, and exposes state to the
  UI. All requests go through the shared `requestPycoreHttp` (one transport).

### 3.2 pycore resource routes (W4)

| route | params | answer |
|---|---|---|
| `ui/audio_orch/resource/lookup` | `items[{kind: word\|sentence, language, text}]` (max 500) | `items[{key, hit, bytes, meaning}]` in request order; `key` = pycore `resource_id`; `meaning` = short ECDICT gloss for English words |
| `ui/audio_orch/resource/chunk` | `kind, language, text, offset, length` | same shape as `task/file_chunk` (`content_base64`, `bytes`, `eof`) |

Lookup uses the same central caches as generation
(`word_audio_cache.find_cached_many`, `sentence_cache_hit`); the chunk reader
is shared with `task/file_chunk`. Relay policy `general_read` for both.

### 3.3 Device clip store (W2, W4)

- `WordNewOrchClipStore`: `CapBlobStore` in `Directory.Data` on native (app data
  on internal storage: bounded only by free space, never purged by the OS, never
  evicted by a budget), OPFS on the web with a persistent-storage grant request.
- Key: `sha256(kind:language:normalized text)` (sentences whitespace-collapsed,
  words lower-cased), identical to the pycore resource key semantics.
- Index document `orch/clip_index.json` (Directory.Data): key -> source
  (`pycore` / `laravel`), bytes, meaning, stored_at. Meanings survive offline.
- Native: every resolved clip is stored. Web: Laravel clips play from their URL
  directly; pycore clips (base64 chunks) are kept in OPFS so they are not
  re-transferred.

### 3.4 Resolution order (W4)

Per unique resource of a plan: device store -> pycore lookup (batched 200) and
chunk download -> Laravel (`sentence/audio?passive=1` for sentences;
`learning/sentence-words` media `audio_url` for words, which also returns the
translation and read counts) -> missing. Missing items are enqueued at the head
of the Laravel generation lanes (`sentence/audio/head`, `word/audio/head`) and
retried on the next resolve. Concurrency 4; progress counters `device`, `pycore`,
`laravel`, `missing`.

### 3.5 Planner (W1)

TS port of pycore `build_sentence_items`, `partition_sentences`,
`estimate_sentence_seconds` and `select_words` (`orchPlanner.ts`, pure):
pattern steps `sentence_en`, `sentence_zh`, `words_new`, `words_all`, `times`;
task-local virtual read set for `new_only`; read counts from Laravel
`sentence-words` when logged in, local tokenization otherwise. Prompt/text tasks
are one segment; book tasks default to `minutes` / 10.

### 3.6 Composition without ffmpeg (W5)

- `WordNewOrchSequencer`: plays a segment's clips in order on one audio element
  with a 0.6 s gap, exposing a virtual timeline (`start_ms`, `end_ms` per item,
  identical to pycore `_segment_timeline`), play / pause / seek / rate.
- `WordNewOrchStage`: a 16:9 DOM stage that renders the pycore video layout:
  sentence cards (EN + ZH lines, outlined serif) and word cards (boxed chip +
  meaning), line states `upcoming / active / companion / past`, scroll modes
  `step` / `smooth`, focus line, progress bar, background colour / image with dim
  veil. The look is the pycore preset document (`video/presets`), cached on the
  device; before first contact the Clean White defaults apply. Languages
  `both / en / zh`.

### 3.7 Task manifest in Laravel and the app (W6)

- Device: `orch/tasks.json` (Directory.Data) is authoritative for editing.
- Laravel table `app_qy_v1_orch_client_tasks` (per user): `client_task_id`,
  `name`, `source`, `source_ref`, `config` (pattern, word mode, segmentation,
  languages, preset), `plan_hash`, `status`, counters, `device_id`,
  `client_updated_at`, `deleted_at` (tombstone so other devices learn deletions).
- Routes (sanctum): `GET /api/app_qy_v1/orch_audio/client_tasks`,
  `POST /api/app_qy_v1/orch_audio/client_tasks/{clientTaskId}` (upsert; an older
  `client_updated_at` never overwrites a newer row: the answer carries the stored
  row), `DELETE .../{clientTaskId}` (tombstone).
- Sync: push on every local change (debounced), pull on page open and login;
  merge by `client_updated_at`, newest wins, tombstones win over older edits.

## 4. UI (wordnew orchestration page)

Tabs: "My compositions" (device + Laravel list) and "Delivered" (the existing
pycore output list). Composition editor: source (book from Laravel media books,
or pasted text), pattern steps, word mode, segmentation, languages. Detail:
resolve progress per source, pycore link status, segment list, play in the
stage. Settings panel: pycore link (candidates, probe, select, add entry),
device storage usage.

## 4.1 API center (user, 2026-09-30: "Laravel API and pycore API set separately")

Settings shows one API center with a row per backend service; each opens its
own tab. Every service implements one contract (`api/center/WordNewApiServiceTypes.ts`):
an external store (`subscribe` / `getSnapshot`, consumed with React
`useSyncExternalStore`), entries with probe state and latency, verified
selection, user entries (add / remove), and an end-to-end diagnosis. Adapters:
`WordNewLaravelApiService` (shared Laravel endpoint manager; diagnosis = health
+ `/query_all_groups`) and `WordNewPycoreApiService` (`WordNewPycoreLink`;
diagnosis = status probe + `resource/lookup` of a sample word). One component
set renders any service (`components/api-center/`: `WfNewApiCenterPanel`,
`WfNewApiCenterDialog`, `WfNewApiServiceSection`); the orchestration page opens
the same dialog on the pycore tab. Superseded and removed: `WfNewApiServerPanel`,
`WfNewApiServerDialog` (Laravel only) and `WordNewPycoreLinkPanel` (pycore only,
orchestration page only). Core additions: `rememberPycoreTarget` (record an
entry without selecting it; `setPycoreTarget` builds on it) and
`forgetPycoreTargetRecent`.

## 4.2 Cache page, device storage, one clip identity, one engine (user, 2026-09-30)

Directives: a separate Cache page under Settings (extend libraries and routes,
enhance what exists); the phone's FileProvider permissions and direct use of
the SD card with usage; the device's word / sentence audio listed; paths
convertible between pycore, Laravel and wordnew so the same orchestration code
runs in the pycore UI and on the phone; related problems fixed.

- One clip identity (`shared/orchestration/orchClipIdentity.ts`):
  `contentId` = md5(collapse_ws(lower(strip Unicode P/S))) - pycore
  `media_content_id` = Laravel `MediaIngestService`; `resourceId` =
  sha256("kind:language:content") - pycore `resource_id`. Verified equal to
  pycore on ASCII, CJK and symbol-heavy samples. Sync digests in
  `core/utils/contentHash.ts` (md5 / sha256, verified against Node crypto).
  Every store names a clip `orch-clips/<resourceId>.mp3`.
- Path forms of one clip (`orchClipLocations`): pycore lookup / chunk routes;
  Laravel passive audio route (sentence: `ai_tools/tts/sentence/audio`, word:
  `word/{lang}/{word}/audio`, both from `AppQyV1AiToolsContract`); store path.
  pycore's lookup now also returns `path`, the clip's location relative to the
  WWW base with forward slashes (`core_node_dirs.portable_path`, the inverse of
  `resolve_portable_path`), so it is the same on Windows and Linux.
- One engine in `shared/orchestration/`: types, planner, identity, clip-source
  chain (`orchClipResolver`), pycore clip source, composer (`runComposition`),
  stage layout, sequencer, `OrchStage`, pycore task adapter (`orchPycoreTask`).
  wordnew supplies Laravel inputs, the chain device -> pycore -> Laravel and its
  device store; pycore-manager (`OrchLiveStagePanel` in the task detail) plays a
  pycore task live with the chain pycore only and object URLs - no ffmpeg.
- Device storage: native plugin `DeviceStorage` (`DeviceStoragePlugin.java`):
  volumes (internal, shared, removable SD) with total / free, directory usage,
  all-files access (Android 11+ settings page, older: storage permission),
  FileProvider open / share. Manifest: storage permissions (READ <= 32,
  WRITE <= 29, MANAGE_EXTERNAL_STORAGE), `requestLegacyExternalStorage`;
  FileProvider roots for app files, caches, external app files and `/storage`
  volumes. TS: `CapDeviceStorage` (web: storage estimate, OPFS usage,
  persistent grant). `CapDirectory` (`null` = absolute path) in the Filesystem
  library, so `CapBlobStore` works on any volume through the official plugin.
- Clip store roots (`WordNewOrchClipStore`): internal app data, a volume's app
  folder (SD card, no permission), `WordNew/` on a volume root (all-files access,
  survives reinstall), OPFS on the web. Changing the root moves the clips (copy,
  then delete the old copy). Index v2 holds identity, origin, meaning, size,
  duration; never evicted.
- Cache page (`#/cache`, tab `cache`, Settings "Clear cache" opens it):
  `WfNewStorageSection` (volumes, usage bars, access, clip root),
  `WfNewOrchClipLibrary` (words / sentences, search, play, meaning, origin, size,
  duration, device / pycore / Laravel paths, copy, open / share, delete),
  `WfNewCacheItemsSection` (the former modal `WfNewCacheManager`, now inline;
  registry item `orchClips` added).
- Related fixes: geolocation permissions were missing from the app manifest
  (the plugin declares none); logged-out word states no longer count as a
  Laravel outage.

- Review fixes (independent review, 16 findings, all fixed): DeviceStorage
  registered in `MainActivity` (a concurrent edit had dropped it); `CapBlobStore`
  downloads onto absolute roots stage in the app cache (the legacy
  `downloadFile` needs a Directory and ignores `recursive`) and a failed folder
  listing is never cached as empty; the internal root is `Directory.Data`
  again, volume roots request the Filesystem storage permission (required on
  Android 12 and older even for an SD card's app folder); relocation copies all,
  switches, then deletes (rollback on failure), serialized with writes, and
  drops cached sessions; a public root mirrors its index and is adopted again
  after a reinstall; an aborted or superseded composition run is never cached
  or written back, a failed one is published as `failed` (retry possible); a
  clip that cannot be kept stays unresolved instead of failing the run; card
  spans follow the shown lines (pycore `_geometry`); the sequencer skips a clip
  that fails to load; task-store load is memoized and an edit during a sync
  triggers another sync; stale lookups, segment index and auto-play flags fixed.

## 4.3 One orchestration for pycore and wordnew (user, 2026-09-30, third round)

Directives:
| id | directive |
|---|---|
| A1 | Align pycore's orchestration with wordnew's. No video is generated now; by default nothing is segmented: one article (book / chapter / prompt) is one segment. |
| A2 | Tasks are created in the UI from the API side: books and prompts, in two tabs rendered by one reusable list component; the user picks what to orchestrate. |
| A3 | Loading the missing resources shows its progress. |
| A4 | An orchestration panel creates the task and edits it again; any plan edit reloads the resources. Default pattern: words, then the Chinese sentence, then the English sentence, then the English sentence again. |
| A5 | The panel switches the bound word group and overlays the new words using the API-side virtual read. |
| A6 | Deeply bound to the cache library; the web uses the API-side resources directly. |

Design:
- One contract `config/audio_orchestration_contract.json` holds the defaults
  every end uses: output mode `audio`, segmentation `count` / 1, the default
  pattern `words_new, sentence_zh, sentence_en x2`, the step types and limits.
  pycore (`orch_contract` loader, `orch_service`, `orch_sources`), the shared
  planner and pycore-manager read it; no end keeps its own copy. Existing
  video tasks keep their stored mode.
- Sources (wordnew): `vocab_book` = Laravel media books (optionally one
  chapter); `prompt_rewrite` = the prompt-rewrite results Laravel holds
  (`/orch_audio/tasks?source=prompt_rewrite`, bilingual sentences with audio).
  One generic list component (`WfNewOrchSourceList`: search, pages, selection)
  renders both tabs through two adapters.
- Word group and virtual read: the task config carries `wordGroupId` and
  `virtualBatch` (default `default`). Laravel `learning/sentence-words` accepts
  `virtual_batch`: rows are overlaid (read only, never consumed) with the
  batch's virtual read counts by `AppQyV1DailyReadingVirtualProgressService`, the
  same overlay the daily-reading player uses: effective read count = group
  read count + virtual read count. The planner selects new words by the
  effective count; the panel lists them with both counts and the stage marks
  new-word cards. Both fields are part of the plan hash (an edit re-resolves).
- Progress: the resolve panel shows resolved / total with a bar per origin and
  the current phase, including the input and measuring phases.
- Cache binding: native keeps inputs (sentences, word states) and clips in the
  device stores and lists them in the cache registry (`orchInputs`, `orchClips`);
  the web keeps nothing locally: Laravel URLs are played directly and pycore
  clips live only as object URLs of the page.

## 5. Acceptance criteria

1. In the Capacitor app no request targets `localhost:59000`; tailnet entries
   are discovered from tailnet origins; the fastest reachable pycore is selected
   without reload.
2. A resolved clip is on the device after the app restarts, offline.
3. Resolution order is device -> pycore -> Laravel; counters show the source.
4. A composition plays with scrolling bilingual cards synchronised to the audio,
   styled by the pycore preset, with no ffmpeg anywhere.
5. A task created on one device appears on another after sync; deletions
   propagate.

## 6. Implementation record (2026-09-30)

Foundation (shared UI core):
- `core/network/NativeShell.ts` `isNativeAppShell()` - the one native-shell
  check (also used by `ProtocolFetch`).
- `core/integrations/pycore/pycoreTarget.ts`: a native shell is never a loopback
  page; proxy entries are allowed in it (native HTTP, no Origin); its default
  target is the first online tailnet entry, else the relay entry;
  `setPycoreTarget(url, { reload: false })` switches in place.
- `PycoreTailnetDiscovery.ts`: `addTailnetDiscoveryOrigins()`; a native shell
  reads the peers document from every known tailnet origin and merges them.
- `PycoreApiOrchestrationFiles.orchReadChunkedFile` - the one chunk loop
  (task files and resource clips); `PycoreApiOrchestrationResources.ts`
  (`orchResourceLookup`, `orchResourceChunk`, `orchFetchResource`) in `pycoreApi`.

wordnew:
- `integrations/WordNewPycoreLink.ts` - discovery, probe, fastest selection
  (a browser keeps a reachable current target it shares with pycore-manager).
- (moved to `shared/orchestration/` in 4.2) `services/orchestration/`: `orchComposeTypes`, `orchPlanner` (pure port of
  the pycore plan semantics), `orchStageLayout` (cards, keyframes, line states,
  timeline), `WordNewOrchClipStore` (permanent clip store + index with meanings
  and durations), `WordNewOrchSources` (Laravel sentences / word states, device
  copy), `WordNewOrchResolver`, `WordNewOrchPresetStore` (pycore presets cached;
  Clean White fallback), `WordNewOrchTaskStore` (device list + Laravel sync),
  `WordNewOrchComposer` (inputs -> plan -> resolve -> measure -> timelines).
- `components/orch-compose/`: `WordNewOrchComposeList`, `WordNewOrchComposeEditor`,
  `WordNewOrchComposeDetail`, `WordNewOrchStage`, `useOrchSequencer`,
  `WordNewPycoreLinkPanel`; `WordNewOrchAudioRoute` has the Compose / Delivered
  tabs (`#/orch-audio`, `#/orch-audio?view=delivered`).
- API: `WfNewApiPaths.orchClientTasks|orchClientTask|orchClientTaskDelete`,
  `methods/orchClientTasks.ts` (http + mock), types in `types/orchAudio.ts`.
- Locales `en_c.ts`, `zh_c.ts` (`orchCompose.*`); ja / ko fall back to English.

pycore: `route_names` `UI_AUDIO_ORCH_RESOURCE_LOOKUP|CHUNK`, wired in
`local_audio_orchestration_routes`; `orch_service.resource_lookup` /
`resource_chunk` with one shared chunk reader (`_read_file_chunk`, also used by
`task_file_chunk`); relay policies `general_read`.

Laravel: migration `AppQyV1_2026_09_30_000001_create_app_qy_v1_orch_client_tasks_table`,
`AppQyV1OrchClientTaskModel` / `Service` / `Ctl`, routes in `AppQyV1OrchAudio.php`,
messages in `lang/{en,zh_CN}/audio_orchestration.php`, `AppQyV1ApiInfo`. Upsert
and delete answer `{applied, task}`; `since` compares the server `updated_at`
(`>=`, the merge is idempotent). Runs after `php artisan sys:init` on the server.

Limits: stage backgrounds use the preset colour (image / video backgrounds are
files on the pycore machine). Verification: `tsc --noEmit` of the UI project is
clean; the UI was not built or run, the app not installed on a device.
