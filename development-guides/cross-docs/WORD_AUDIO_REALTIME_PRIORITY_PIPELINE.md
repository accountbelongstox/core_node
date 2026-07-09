# Word Audio Realtime Priority Pipeline - Shared Contract v1

> **Status:** CANONICAL single source of truth for the realtime word-audio
> feature (visible-page auto-request -> priority escalation -> pycore pull ->
> accent-aware generation with fallback -> write-back -> wordnew retry).
> **Owner:** Laravel owns the priority + accent contract; pycore owns the
> provider/generation chain; wordnew owns the request/retry loop.
> On conflict with `AppQyV1_WORD_MEDIA_PIPELINE.md` / `AppQyV1_TASK_CENTER_PIPELINE.md`
> / `SENTENCE_AUDIO_GENERATION_PIPELINE.md`, this doc wins for the realtime +
> accent behavior those docs defer to it; their routes/columns/payload keys are
> unchanged and remain authoritative for their own scope.
> Language: English (repo rule). Diagrams are ASCII (repo convention - no mermaid).

## 1. Goal (the 5 target behaviors)

When a user opens `http://127.0.0.1:13054/wordnew#/library/{id}?page=1&view=table`:

1. **wordnew keeps requesting** audio for words visible on the page, retrying at
   short intervals until audio is available.
2. **laravel_main raises priority** based on incoming requests (a visible /
   repeatedly-requested word outranks a one-shot page bump).
3. **pycore pulls the highest-priority task first** and reacts to priority
   changes immediately; a task already being processed finishes normally.
4. **Fallback everywhere:** wordnew asks for the preferred accent (US/UK,
   dispatched via laravel settings) but falls back to any existing audio;
   pycore generates per the task's accent requirement but falls back across
   providers when an API / third-party package is unavailable.
5. **No-key providers** (Puter.js-style) may be added as fallback sources.

## 2. End-to-end flow

```
wordnew :13054                      laravel_main :9000                     pycore :59000
#/library/{id}?view=table
  |
  | GET /vocabulary/libraries/{id}/words  (page open)
  |--------------------------------------->|
  |                                        | bumpPageMediaToFront: every page
  |                                        | word missing media -> priority 100
  |                                        | (cap 50/page) on word_audio lane
  |<---------------------------------------|  (words list, audio_url per row)
  |
  | for each visible word with no audio:
  |   GET /word/{lang}/{word}/media?accent=us|uk   (retry loop, short interval)
  |--------------------------------------->|
  |                                        | resolve(): file-first.
  |                                        |  hit  -> audio_url (ready)
  |                                        |  miss -> ensureWordTask:
  |                                        |    existing pending? ESCALATE +5
  |                                        |                 (cap 500) [target #2]
  |                                        |    else create task payload
  |                                        |         {words,language,accent} @100
  |                                        |    return audio_status:'pending'
  |<---------------------------------------|
  |                                        |
  |                                        | GET /api/worker/tasks/pull?wait=0
  |                                        |<-------| TranslationWorkerService
  |                                        |        | poll ~12s + fast-drain.
  |                                        |        | ORDER BY priority DESC
  |                                        |        | -> highest first [target #3]
  |                                        |--------|
  |                                        |        | _process_audio_task:
  |                                        |        |  result_cache hit? -> done
  |                                        |        |  find_pronunciation(w,l,accent)
  |                                        |        |   FreeDict -> Wikimedia ->
  |                                        |        |   Cambridge -> Forvo (2-pass
  |                                        |        |   accent: preferred then any)
  |                                        |        |  else synthesize(text,l,accent)
  |                                        |        |   edge -> streamelements ->
  |                                        |        |   sherpa -> melotts -> gptsovits
  |                                        |        |   -> gtts_web -> azure [target #4]
  |                                        |        |  cache + emit translations[]
  |                                        | POST /api/worker/tasks/result
  |                                        |<-------| {translations:[{word,
  |                                        |        |   audio_base64,mime,engine,
  |                                        |        |   provider,accent,accent_fallback}]}
  |                                        | WordTranslationTaskProcessor ->
  |                                        | AppQyV1WordTranslationWriteback::apply
  |                                        |   -> storeWordAudioBytes -> has_audio=true
  |                                        |        (file on disk, served by URL)
  |                                        |
  | next retry GET /word/.../media?accent= |
  |--------------------------------------->|
  |                                        | resolve(): file-first -> HIT
  |<---------------------------------------|  audio_url (ready) -> FE plays it
  | new Audio(audioUrl).play()
```

## 3. Priority semantics (Laravel owns)

| Event | Priority action | Constant |
|---|---|---|
| Page-open bump (visible missing-media words) | set to FRONT | `TASK_PRIORITY_FRONT = 100` (cap 50/page) |
| First active query on an existing pending task | jump to FRONT | `TASK_PRIORITY_FRONT = 100` |
| REPEAT request on a task already >= FRONT | escalate `+STEP` | `TASK_PRIORITY_REPEAT_STEP = 5`, `TASK_PRIORITY_REPEAT_CAP = 500` |
| Backfill enqueue (non-interactive) | default | `TASK_PRIORITY_DEFAULT = 30` |

- Pull ordering is `ORDER BY priority DESC, created_at ASC` (server-side per
  pull), so a priority bump on a still-PENDING task is seen by the very next
  pull - no stale local queue. This is what makes target #3 ("reacts
  immediately") work for not-yet-claimed tasks.
- `pending_urgent` (the fast-drain signal) = count of PENDING tasks with
  `priority >= 100`. Escalation stays >= 100, so the signal's semantics are
  unchanged.
- Hard cap on `bumpTaskPriority` remains 1000 (unchanged); the 500 escalation
  ceiling stays well under it.
- **In-flight rule:** a task pycore has already claimed and started processing
  is NEVER interrupted by a priority change - it finishes normally. Priority
  only reorders the not-yet-claimed queue. (Target #3 second half.)

Files: `AppQyV1WordMediaService::ensureWordTask` (escalation),
`TaskManagerService::pullAndAssignTasksForWorker` (pull ordering + G8 fix),
`AppQyV1VocabularyLibraryPublicController::bumpPageMediaToFront` (page bump).

## 4. Accent contract (Laravel owns the dispatch, pycore owns the generation)

### 4.1 Wire values
- Accent on the wire / in payloads / in storage metadata: **`"us"` | `"uk"`** only.
- FE settings map: `en-US`, `en-CA` -> `"us"`; `en-GB`, `en-AU` -> `"uk"`.
- Absent / unrecognized -> `null` (no preference; pycore uses its default voice).

### 4.2 Payload
`word_audio` GlobalTask payload (additive over the legacy form):
```jsonc
{ "words": [{"word":"schedule","md5":"..."}], "language":"en",
  "accent": "us",            // optional; omitted when no preference
  "target_language": "zh" }
```
Producers stamp `accent` from the roamed user preference
(`app_settings.voiceAccent`) via the `?accent=` query param on the media
endpoint (target #4 "由 laravel main 调度").

### 4.3 Generation - pycore two-pass + fallback chain
`find_pronunciation(word, lang, accent)` runs TWO passes: pass 1 accepts ONLY
the preferred accent across every source; pass 2 accepts any accent. So a
matching-accent recording from a lower-priority source beats a wrong-accent one
from a higher-priority source. The result carries the ACTUAL accent obtained
(`"us"|"uk"|"unknown"`) so the caller can tag `accent_fallback`.

**pycore server-side chain (each step never-raises):**
1. `result_cache` (`word_audio` namespace, key word+lang+accent) + Laravel
   file-exists short-circuit.
2. Real human audio, preferred accent: Free Dictionary API (pick `phonetics[].audio`
   with `-us.mp3`/`-uk.mp3` suffix) -> Wikimedia Commons (`En-us-/En-uk-<word>.ogg`)
   -> Cambridge (prefer the requested region span) -> Forvo (key-gated).
3. Real human audio, ANY accent from the same providers (tag actual accent).
4. Neural TTS, preferred accent: `edge` with `en-US-AriaNeural` / `en-GB-SoniaNeural`
   (60s cooldown on failure).
5. No-key web TTS: `streamelements` (Joanna=US / Amy=UK, plain GET mp3) ->
   `gtts_web` (Google translate_tts, no accent promise -> `"unknown"`).
6. Offline engines any-accent: `sherpa` -> `melotts` -> `gptsovits` -> `azure`.

`synthesize(text, language, output_path, rate=None, accent=None)` returns
`{success, engine, error, tried, accent}` where `accent` is the accent actually
produced.

### 4.4 Result contract (pycore -> Laravel)
```jsonc
{ "translations": [ { "word": "schedule",
      "audio_base64": "<b64 mp3>", "mime": "audio/mpeg",
      "engine": "edge", "provider": "edge",
      "accent": "uk", "accent_fallback": false } ],
  "provider": "edge", "target_language": "en" }
```
This matches `WordTranslationTaskProcessor` -> `AppQyV1WordTranslationWriteback::apply`,
which reads `audio_base64` per item and stores via
`AppQyV1DictionaryTTSCoordinator::storeWordAudioBytes` (fills `has_audio`,
appends to `tts_files`, idempotent). The `accent`/`provider`/`accent_fallback`
fields are ADDITIVE - Laravel accepts them forward-compatibly.

### 4.5 wordnew browser-side fallback (playWord)
1. Stored backend URL for preferred accent (once accent-keyed storage lands).
2. Stored backend URL any accent (play immediately, keep polling for preferred).
3. While pending: Web Speech `speechSynthesis` with `utterance.lang = voiceAccent`
   (zero-network, correct accent on most OSes) - always-available last resort.
4. OPT-IN external tier (feature-flagged, default OFF): dictionaryapi.dev direct
   fetch (CORS-open, accent-suffixed) and/or Puter.js `txt2speech`.

## 5. No-key provider integration (target #5)

Verified options (researched 2026-07):

| Source | Accent | Key? | Where | Notes |
|---|---|---|---|---|
| Free Dictionary API | US/UK/AU (filename suffix) | No | pycore + browser | Real human audio; CORS-open |
| Wikimedia Commons | US/UK explicit | No | pycore | `En-us-/En-uk-<word>.ogg`; stable |
| Cambridge Dictionary | US/UK (page span) | No | pycore | HTML parse of public page |
| Forvo | multi-lang | Yes (paid) | pycore | Gated behind `FORVO_API_KEY` |
| edge-tts (python) | en-US + en-GB neural | No | pycore | Best server-side quality+accent |
| StreamElements | Polly Joanna/Amy | No | pycore | Plain GET mp3; years-stable |
| gTTS (HTTP) | one en voice | No | pycore | translate_tts endpoint; unofficial |
| Puter.js `txt2speech` | en-US/en-GB (Polly) | No key (browser) | wordnew ONLY | Temp-account credit cliff + sign-in popup at scale -> opt-in, default OFF |
| Puter server-side | - | account token | EXCLUDED | Credit drain + ToS-sensitive for unattended use |

**Puter.js** is browser-only here: `puter.ai.txt2speech(word, {language:"en-GB",
voice:"Amy", engine:"neural"})` returns an `HTMLAudioElement`. Its "User Pays"
model means each end user's own Puter credits fund the calls; temp/guest users
get a small free grant, then see a sign-in/top-up popup. So it is never a
default-on server-side dependency - only an opt-in browser fallback.

The pycore engine chain extension point is the `TTS_ENGINE_PRIORITY` tuple in
`tts_orchestrator.py` (env-overridable); each engine is a guarded module under
`pycore/pyutils/tts/` (add `<new>_engine.py` and append). Real-pronunciation
sources live in `pycore/pyutils/external_apis/word_audio_client.py`.

## 6. wordnew request/retry loop (target #1)

- Reusable poller: `apps/wordnew/hooks/useWordMediaPoller.ts` (extracted from
  `WfNewLibraryPage.requestWordMedia`).
- Open-ended retry: ~4s for the first ~30s, then backoff to ~15-30s; pause when
  `document.hidden` or the row is off-screen; stop on `audio_status:'ready'` or
  unmount; the at-most-once guard is cleared on give-up so re-expand re-requests.
- Auto-request scope: viewport-visible rows with `hasAudio=false`
  (IntersectionObserver), max 5 concurrent pollers, the rest queued.
- `?accent=us|uk` sent from the roamed `voiceAccent` setting; on
  `accent_fallback` the FE plays the fallback URL but keeps polling for the
  preferred accent.
- API shape changes MUST update `WfNewApiTypes.ts` + `WfNewApiHttp.ts` +
  `WfNewApiMock.ts` together (`WORDNEW_API_MOCK_PATTERN.md` rule 4).

## 7. Implementation status (2026-07)

### Done
- **pycore provider layer** (`word_audio_client.py`, `tts_orchestrator.py` +
  `streamelements_engine.py`, `gtts_web_engine.py`, `word_audio_router.py`):
  accent-aware `find_pronunciation(word,lang,accent)` + `synthesize(...,accent)`,
  Wikimedia source, two-pass accent, new no-key engines, cooldown behavior.
- **pycore worker lane** (`translation_worker_service.py::_process_audio_task`):
  handles `words[]`/`content`/`text`, reads `payload.accent`, result_cache
  (`word_audio` namespace), emits the `translations[]` contract with
  `accent`/`accent_fallback`/`provider` per item. **Unblocks the previously-dead
  word_audio pull lane** (was emitting a flat shape the processor dropped).
- **laravel priority**: G8 remote_fast capability filter (fast-lane claims now
  always go through the capability-matched block); G5 repeat-request escalation
  `+5`/cap `500`.
- **laravel accent dispatch**: `?accent=us|uk` on `GET /word/{lang}/{word}/media`
  -> `resolve()` -> `ensureWordMediaTask` -> `ensureWordTask` stamps `accent`
  into the `word_audio` payload.
- **wordnew poller**: `useWordMediaPoller.ts` exists (open-ended retry, pause,
  backoff). *(Wiring into `WfNewLibraryPage` + accent settings roaming + Puter
  opt-in tier are pending - see below.)*

### Pending (follow-up phases)
- **G11 accent-keyed storage** (the large accent piece): `tts_files` entries
  gain `{accent,provider}`; `buildRelativePath` adds an optional accent segment
  for NEW files (legacy formula byte-identical when accent null);
  `resolveAudioUrl(preferredAccent)` returns preferred-accent hit first else any
  with `accent_fallback:true`; C1 response additions `audio_accent`,
  `accent_fallback`, `audio_variants`. Until this lands, audio is stored
  single-accent (any accent) - pycore still GENERATES the preferred accent, but
  the backend does not yet store/serve accents distinctly.
- **G6 push nudge**: on a Laravel->pycore urgent-task event, arm the existing
  fast-drain (cuts idle bump latency ~12s -> ~0.5s). If no broadcast channel
  exists, rely on `pending_urgent` in pull/heartbeat responses (no new infra).
- **G7 heap-fed dispatch**: claim `limit=min(5, free_slots)` so still-pending
  bumps stay server-side where pull ordering honors them; pop highest-priority
  only when a slot frees. In-flight tasks untouched.
- **G9 hot-spot throttling**: keyed (word,lang)->task ownership cache + per-word
  cooldown before re-calling external pronunciation APIs / re-scanning; light
  rate-limit on the public media route. Should land with the FE auto-request.
- **G12 lanes**: thread accent through `tts_queue_poller_service.py` +
  `assist_worker.py` (dict-row TTS lane) and their result_cache keys.
- **G15**: smaller claim batches + re-claim-on-urgent for the dict-row lane.
- **wordnew G3/G4/G10**: wire `useWordMediaPoller` into `WfNewLibraryPage`
  (visible-rows auto-request, IntersectionObserver, concurrency cap 5); roam
  `voiceAccent` via `/user/preferences`; send `?accent`; consume
  `accent_fallback`; browser-side `speechSynthesis` + opt-in Puter/dictionaryapi
  tier.

## 8. Reuse map (do NOT reinvent)

| Need | Reuse |
|---|---|
| Pull ordering / claim | `TaskManagerService::pullAndAssignTasksForWorker` (ORDER BY priority DESC) |
| Task create/bump | `AppQyV1WordMediaService::ensureWordMediaTask` / `ensureWordTask` |
| Write-back | `AppQyV1WordTranslationWriteback::apply` + `WordTranslationTaskProcessor` |
| Audio store | `AppQyV1DictionaryTTSCoordinator::storeWordAudioBytes` / `markWordCompleted` |
| Audio path | `EdgeTTSService::buildRelativePath` |
| pycore pull worker | `TranslationWorkerService` (`_process_audio_task` lane) |
| Real pronunciation | `pyutils/external_apis/word_audio_client.py` (`find_pronunciation`) |
| TTS chain | `pyutils/tts/tts_orchestrator.py` (`synthesize`) + `tts/*_engine.py` |
| Result cache | `pyutils/common/result_cache.py` (`get_bytes`/`set_bytes`) |
| FE poller | `apps/wordnew/hooks/useWordMediaPoller.ts` |
| FE API layer | `apps/wordnew/api/WfNewApi{Types,Http,Mock,Paths}.ts` (change together) |
| FE settings | `WfNewSettingsStore.ts` (`voiceAccent`) + `/user/preferences` roaming |

## Related canonical docs
- `poly_apps/laravel_main/app/Apps/AppQyV1/docs/AppQyV1_WORD_MEDIA_PIPELINE.md`
  (word media resolution, file-first, lanes, source chain - §5 priority points here)
- `poly_apps/laravel_main/app/Apps/AppQyV1/docs/AppQyV1_TASK_CENTER_PIPELINE.md`
  (global_tasks pull/claim/notify - §5 prioritization points here)
- `development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md` (sentence-audio
  engine chain + pycore heap - §5.2 engine extension points used here)
- `poly_apps/pycore_laravel_wordflow_ui/docs/WORDNEW_API_MOCK_PATTERN.md`
  (FE API layer mock/real rules - §6 follows rule 4)
