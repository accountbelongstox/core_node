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
  - tailnet proxy entries `https://<machine>.<tailnet>.ts.net/pycore-api`, from the
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

Implementation (4.3):
- Contract `config/audio_orchestration_contract.json`; pycore
  `pyctl/audio_orchestration/orch_contract.py` (used by `orch_service` create
  defaults, `_normalize_pattern`, `orch_sources.ORCH_DEFAULT_OUTPUT_MODE`);
  TS `core/contracts/AudioOrchestrationContract.ts` (literal value sets, the
  JSON is checked on load) used by the shared planner and pycore-manager
  (`orchSources.ts`, `OrchTaskEditor.tsx` preset "Words, Chinese, English x2").
- Laravel `AppQyV1SentenceWordTableController::resolve`: optional
  `virtual_batch` -> `AppQyV1DailyReadingVirtualProgressService::select(...,
  consume false)`; rows carry `group_read_count`, `virtual_read_count`,
  effective `play_count`; the answer adds `virtual_read_batch`.
- wordnew: `WfNewOrchSourceList` (generic list) + `WordNewOrchSourcePicker`
  (Books / Prompts adapters), `WordNewOrchComposeEditor` (orchestration panel),
  `WordNewOrchWordGroupField` (group + virtual batch, also the detail's quick
  switch), `WordNewOrchResolveProgress`, `WordNewOrchNewWords` (+ `NEW` badge on
  the stage's word cards); `WordNewOrchSources` (books / API prompts, group +
  batch, native-only copies, registry item `orchInputs`); web clip chain
  Laravel -> pycore (object URLs), native device -> pycore -> Laravel.
- Verified: TS type-check clean (except another session's missing `PcTest*`
  files), pycore `py_compile` and defaults probe, `php -l`, planner run with the
  defaults (one segment; words -> zh -> en -> en; a word read 1 + 2 virtual
  times is not new at limit 0). Not run: the UI, the Laravel route on the
  server, pycore after restart.

## 4.4 Fourth round (user, 2026-09-30)

| id | directive |
|---|---|
| B1 | The pycore API chosen in Settings persists: a reload or reopening never reverts it. Default order: the GPU tailnet machine first, then every tailnet machine discovered at run time; reachable entries first. pycore does not run on the Laravel server: never offer `api.si.12gm.com` with port 59000. |
| B2 | Default pattern: words (each word followed by its Chinese meaning - a small per-step option), the Chinese sentence, the English sentence twice. pycore has no meaning reading yet: recorded as pending development. |
| B3 | Orchestration page styling: closed selects show their value; sections such as New Words collapse to an icon and expand to icon + text; number inputs are narrow; the page is redesigned. |
| B4 | A small storage widget on the orchestration page, built from the storage library. |
| B5 | Virtual read, client and Laravel: each orchestration has its own virtual read batch; a task may instead use a batch from history or the real read counts. At most 20 batches per user: unreferenced batches are cleaned first, then the stalest. Backend extended, `sys:init`. |
| B6 | Resource loading shows total progress, per-item progress and the source (Laravel / pycore / device), and the storage widget updates live; the details show when expanded. |
| B7 | Foundation rework with current techniques (official documentation), recorded here. |

Design:
- pycore link (B1): the user's choice is a pinned selection stored with the
  endpoint (`pycoreTarget` stored target + a `pinned` flag in the link state);
  automatic selection runs only when nothing is pinned or the pinned entry is
  down, and it never overwrites the pin (the pin is restored when it is back).
  Candidate order: reachable first (latency), then contract tailnet machines
  (the GPU machine, `service_url_entries`), then discovered tailnet machines,
  then relay (only with an owner relay session), then user entries. A direct
  entry is produced only for a loopback page; a non-tailnet https host is only
  ever the relay entry, labelled as relay.
- Meaning reading (B2): a word step carries `meaning: true`; the planner emits
  after each word a Chinese clip of its short meaning (kind sentence, language
  zh, `meaningOf` = the word), resolved like any sentence clip (device ->
  pycore -> Laravel TTS). The stage shows it as the word card's meaning line.
  pycore ignores the flag until implemented: docs_fix/TODO_20260930_PYCORE_ORCH_WORD_MEANING.md.
- Read-state source (B5): `readState` = `virtual` (the task's own batch,
  named `orch-<task id>`), `history` (an existing batch chosen from the list)
  or `real` (group read counts only). Laravel: `GET learning/virtual-batches`
  (name, languages, words, reads, last_used_at, referenced), `POST
  learning/virtual-batches/{name}/reads` (record reads of played words,
  idempotent by request key), `DELETE learning/virtual-batches/{name}`;
  `last_used_at` column (sys:init); a batch creation prunes to 20 per user -
  unreferenced batches (not named by a client task nor `default`) oldest first,
  then the stalest. The stage records the words it played into the task's
  batch (debounced, per request key).
- Resolution events (B6): the resolver reports per-item state (queued,
  loading with bytes, done with origin, missing); pycore chunks and Laravel
  downloads report byte progress. The detail shows a summary line (total, per
  source) and, expanded, the per-item list; the storage widget subscribes to
  the clip store and updates as clips land.
- UI (B3): theme-aware inputs (`theme.inputClass`), collapsible icon sections
  (`aria-expanded`, icon-only when closed), compact number inputs.

Implementation (4.4):
- B1 root causes: (1) the link re-selected the fastest entry on every start,
  overwriting the user's choice; (2) `listPycoreEndpoints` turned Laravel URLs
  into pycore entries (the contract GPU entry `/laravel-api` became a "relay"
  pycore; host key `cloud` = the Laravel server). Fix: `WordNewPycoreLink` pin
  (`WORDNEW_PYCORE_PINNED`, `choose` / `unpin`), reachable-first ordering, a
  still reachable current entry is kept without a pin; `pycoreTarget`
  `contractMachineEndpoint` maps a contract tailnet URL to that machine's
  `/pycore-api` mount, order this machine -> contract machines (GPU) -> discovered
  tailnet -> host-key loopback -> recent -> relay; native default = first
  non-relay entry; `service_contract.json` pycore host keys lose `cloud`.
  API center: pinned badge, "Use automatic".
- B2: contract `default_pattern[0].meaning = true` + `step_options`; planner
  emits `{kind: sentence, language: zh, text: meaning, meaningOf: word}` after
  each word of a `meaning` step; stage attaches meaning clips to the word card
  (meaning line spans = meaning clips). Verified by a planner + stage run.
  pycore: `TODO_20260930_PYCORE_ORCH_WORD_MEANING.md`.
- B3: `orchFormStyles(theme)` (theme input colours - the closed-select
  invisibility was dark-only text on light cards), `WfNewOrchSection`
  (collapsible icon section), editor rebuilt on them; the other orchestration
  components use light colours with `dark:` variants.
- B4 / B6: `orchClipResolver` per-item `OrchResolveItem` (queued / loading with
  bytes / done with origin / missing; `context.loading`), pycore chunk and
  Laravel download progress, composer publishes items (throttled 150 ms);
  `WordNewOrchResolveProgress` summary + expandable item list;
  `WfNewStorageBadge` (clip store `onChange`, volume free space) opens `#/cache`.
- B5 Laravel: `last_used_at` (table ensure, sys:init), `AppQyV1VirtualReadBatchService`
  (list with references, recordReads + prune to 20, touch, delete),
  `AppQyV1VirtualReadBatchCtl`, routes `learning/virtual-batches[...]`, overlay
  path touches the batch, messages en / zh_CN. Client: `readState`
  (`virtual` = `orch-<task id>` set at creation, `history`, `real`),
  `WordNewOrchReadStateField`, `wordId` in word states, `WordNewOrchVirtualReads`
  (debounced, request-keyed, retried) fed by the detail page as word clips end.
- Verified: TS type-check clean (except another session's `PcTest*`), `php -l`
  on all Laravel files, planner / stage meaning run. Not run: Laravel routes
  and `sys:init` on the server, the Android build.

## 4.5 Resumable orchestration, local-first list (user, 2026-09-30, fifth round)

| id | directive |
|---|---|
| C1 | A task's resource loading survives leaving the page and closing the app: progress is kept in the local task list, idempotently, so switching back continues at once. |
| C2 | Laravel serves only the initial load (sentences, word states); later opens use the local copy. |
| C3 | Clearing local caches in Settings resets the kept progress: the next open reloads the resources. |
| C4 | A local task newer than the remote copy is uploaded. The remote no longer interprets the list: the app plans and resolves. On the web the remote may assist (it holds the progress summary). |

Design:
- Runs are owned by `WordNewOrchComposer` (a service), not by a page: a page
  subscribes to the task's session (`useSyncExternalStore`); leaving the page
  keeps the run going; only an explicit re-resolve, a plan edit or a cache clear
  restarts it. One run per task at a time (idempotent start).
- `WordNewOrchProgressStore` (device, `CapJsonStore` in `Directory.Data`; IndexedDB
  on the web) keeps per task `{planHash, phase, counts, items: {key: state /
  origin}, updatedAt}`, written throttled during a run and at its end. A
  snapshot for another plan hash is ignored (idempotency key = plan hash). On
  open the page shows the snapshot at once and the run continues: the device
  source answers kept clips without network, so only the rest is loaded.
- Inputs local-first: a kept input copy whose source key matches is used
  without contacting Laravel; `force` (re-resolve) reloads from Laravel.
- Cache clear: clearing `orchClips` or `orchInputs` (or a clip root change)
  clears the progress store and drops cached sessions.
- Sync: after a pull, a local task newer than its remote row is marked unsynced
  and pushed. Laravel `orch_client_tasks.progress` (json summary: plan hash,
  phase, counts, updated) - stored, never interpreted; the web restores its
  summary from it when no local snapshot exists.

Implementation (4.5):
- `WordNewOrchComposer` rebuilt as the run owner: `ensure(task, {force})`
  (idempotent per plan hash), `subscribe(taskId)` / `session(taskId)` /
  `subscribeAll`, runs survive page changes; reset on cache clear / root move.
- `WordNewOrchProgressStore` (`wfnew-orch/progress.json`): snapshot per task
  keyed by plan hash (items keep kind / language / text / state / origin; a
  transfer in flight is kept as queued), throttled writes, flush at run end;
  `toItems` seeds a resumed run (`runComposition` `seed`).
- `WordNewOrchSources.load(task, {force})`: native uses the kept input copy
  of the same source key without network; `force` reloads from Laravel.
- Detail page: `useSyncExternalStore` on the composer, no abort on unmount,
  re-resolve = `ensure(..., {force: true})`. List: `TaskProgressBadge` (live
  percent in the background, kept summary otherwise, `paused` for a run the
  app left unfinished).
- Cache registry: `orchProgress` item; clearing `orchInputs` / `orchClips`
  clears progress too (composer resets).
- Sync: newest edit wins both ways; a newer local task is marked unsynced and
  pushed. Laravel `orch_client_tasks.progress` json (migration aligned by
  sys:init; validated, stored, returned); client `OrchComposeTask.progress`
  summary written at run end.
- Verified: TS type-check clean, dev server compiles every changed module,
  `php -l` clean, and a composer run test: an aborted run never reports
  ready; a resumed run shows the kept progress at once, takes kept clips from
  the device and fetches only the rest.

## 4.6 Transfer rate, LAN pycore scan (user, 2026-10-01)

| id | directive |
|---|---|
| D1 | Resource loading shows the live transfer rate. |
| D2 | A LAN scan finds pycore (port 59000) to speed transfers: the phone's address is detected automatically, or a gateway is entered (192.168.1.1 scans 192.168.1.1 - .254); one result is chosen. |
| D3 | The chosen scan result switches the API globally at once but is temporary: the next start uses the persisted choice. |

Design:
- Rate (D1): the resolver counts transferred bytes (pycore chunk bytes as they
  arrive, a Laravel clip's stored size when it lands); the composer keeps a
  sliding window (5 s) and publishes `rate` (bytes/s) and the total; the
  progress panel shows it while loading.
- Temporary target (D3): `pycoreTarget` session override (memory only, never
  stored) that every request reads first; `WordNewPycoreLink.useTemporary` /
  `clearTemporary`; pinning a persisted choice clears it; the API center marks
  the entry "temporary".
- LAN transport: a native shell may use a direct `http://<private IPv4>:59000`
  target; `protocolFetch` sends private-LAN http through the native Cronet
  stack (no WebView mixed-content / CORS); the app permits cleartext (network
  security config) because LAN pycore has no TLS.
- Scan (D2): `PycoreLanScanner` (core) probes `GET /api/status` on every host
  of a /24 with bounded concurrency and short timeouts, streaming results
  (up with latency, refused, no pycore). Address detection: native plugin
  `LanInfo` (Wi-Fi IPv4 address, prefix, gateway via `LinkProperties`); the web
  derives the subnet from a private page host, otherwise the gateway is typed.
- Security (K7, unchanged): pycore admits a non-loopback caller only with a K3
  signature; an unsigned phone gets 401 and the scan reports "refused". Admitting
  LAN phones is pending pycore work: docs_fix/TODO_20261001_PYCORE_LAN_PHONE_ACCESS.md.

Implementation (4.6):
- Rate: `OrchResolvedClip.bytes`, resolver `transferredBytes` (per-item counted
  bytes, `loading(..., unit)`: pycore bytes, Laravel percent), composer
  `session.transfer {bytes, bytesPerSecond}` (5 s window), shown in
  `WordNewOrchResolveProgress` while resolving.
- Temporary target: `pycoreTarget` `setPycoreSessionTarget` / `getPycoreSessionTarget`
  (memory only, read first by `readTarget`), `isPrivateLanHost` + native LAN
  direct rule; `WordNewPycoreLink.useTemporary` / `clearTemporary` (`temporaryUrl`,
  cleared by pinning, kept by automatic selection); API center `temporary`
  badge / flag / `clearTemporary`.
- Transport: `protocolFetch` native path for private-LAN http;
  `ProtocolHttpPlugin` accepts http only for RFC 1918 hosts;
  `res/xml/network_security_config.xml` (cleartext) + manifest
  `networkSecurityConfig`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`.
- Scan: `core/integrations/pycore/PycoreLanScanner.ts` (`lanScanHosts`,
  `scanLanPycore`: 32 parallel, 1.2 s timeout, up / refused / no_route, found
  hosts recorded in the probe table); native `LanInfoPlugin.java` (registered)
  + `CapLanInfo`; UI `WfNewPycoreLanScan` in the pycore tab (detected address
  and gateway, subnet input, progress, results, "Use for this session").
- Verified: type-check clean, dev server compiles every changed module; the
  scanner against this machine: 127.0.0.1 classified up (hostname reported),
  a full /24 (254 hosts) scanned in 9.7 s.

### 4.7 Tailnet pycore mount `/pycore-api` and build-time tailnet list

- Contract `access.tailnet.pycore_path` is `/pycore-api` (FrankenPHP/Caddy on
  every machine reverse-proxies it to loopback :59000; the Linux and Windows
  renderers read the contract). `pycore_legacy_paths` (`/pycore`) maps stored
  tailnet URLs (target, recent, wordnew pin) to the current mount.
- The native bundle had no tailnet list: discovery only asked
  `tailnet_peers.json` on the contract machines (GPU, often offline). The build
  now runs `tailscale status --json` once (`readTailnetPeersSync`, Vite
  define `__TAILNET_PEERS_SEED__`); discovery starts from that list and asks
  every online machine for the live one. Each machine is offered as
  `https://<machine>.<tailnet>.ts.net/pycore-api`, e.g.
  `https://desktop-1l9k06n.thresher-python.ts.net/pycore-api`; phones
  (android / ios) are not offered.

### 4.8 Batch / static clip transfer, APIs in use

Alignment (before): pycore sent each clip as base64 JSON in 1 MB chunks after a
lookup (N+1 requests, +33% bytes); Laravel clip files are static, but a clip
missing its URL in the inputs cost one `sentence/audio` request each (words
none).

- Contract `config/audio_orchestration_contract.json` `transfer`: bundle
  limits (64 items / 8 MB), media type, frame layout, Laravel batch sizes.
- pycore (`orch_service`, `local_audio_orchestration_routes`):
  `POST ui/audio_orch/resource/bundle` - per request item a 4-byte big-endian
  header length, JSON header `{index,key,hit,bytes,sent,meaning}`, then the
  clip bytes; the first hit is always sent, a hit past the budget is
  `sent:false` and asked again. `GET ui/audio_orch/resource/file` - one clip
  raw (ETag, `private, max-age=3600`). Paths always resolved server-side; both
  work over direct / tailnet proxy / relay (binary bodies pass through).
  `resource_lookup` shares `_resource_entries` with the bundle.
- Laravel: `sentence/audio/head` receipts carry `url` for available clips
  (passive batch resolve), so one request answers 400 sentences;
  `word/audio/head` already answers `audio_url` (100 words).
- Client: `PycoreClient.postBinary` / `requestPycoreHttpBinaryPost`,
  `orchResourceBundle` / `orchResourceFile` / `parseOrchResourceBundle`;
  `orchPycoreClipSource` bundles first, a pycore without the route falls back
  to lookup + chunk; wordnew's Laravel source batch-resolves missing URLs and
  downloads the static files.
- APIs in use: sources report `answered(origin, baseUrl)` only after a real
  response (pycore: the target the request went to; Laravel: the API base of a
  batch and the origin of a downloaded clip; inputs: the base they loaded
  from); `session.endpoints` feeds `WordNewOrchApiEndpoints` in the resolve
  progress (live state dot, "not accessed this run" otherwise). A chip opens
  the API center dialog on that service (global switch at once); "Scan LAN"
  opens the pycore tab with the LAN scan.
- Storage badge: labelled word and sentence counts that never truncate (the
  compact `12w · 3s · size` text was cut after the word count on phones).
- Verified: type-check clean; dev server compiles the changed modules; Python
  bundle frames parsed by the TS parser (3 real clips + a miss, UTF-8
  meaning); byte budget defers later hits; PHP lint clean.

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
