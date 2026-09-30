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
  `PUT /api/app_qy_v1/orch_audio/client_tasks/{clientTaskId}` (upsert; an older
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

See section 7 (filled after implementation).
