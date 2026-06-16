# Sentence-Library Audio Generation Pipeline

Cross-stack design + shared contract for **auxiliary audio generation of the shared
sentence library**. Spans **pycore** (TTS engines + worker), **laravel_main** (file-first
audio resolution + claim-by-priority), and the **pycore_laravel_wordflow_ui / wordflow** frontends.

> This document is the single source of truth for the feature. Front-end and back-end
> must agree on the contract in §4. Keep it in sync as a linked change when code moves.

Related canonical docs: [pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md](../pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md)
(media → sentence ingest), and the laravel↔pycore assist lease protocol.

---

## 1. Goal

For every sentence in the shared sentence library, produce a spoken-audio MP3 and let
clients fetch it. Generation must degrade gracefully:

1. **edge-tts** when available (online, best quality, already serialized + 403-resilient).
2. Otherwise an **open-source neural TTS** running **locally on GPU, falling back to CPU**.
   - MeloTTS already auto-selects `cuda:0 → cpu` (`MELOTTS_DEVICE=auto`); Sherpa-ONNX
     (Kokoro) is the CPU-only safety net. These are the "chat-tts open-source" tier.
3. If **all local engines fail/unavailable**, generate via a **free cloud TTS API**
   (Azure Speech first; pluggable for Google Cloud TTS / Amazon Polly).

Local-first is automatic: the orchestrator tries engines in priority order and only
reaches the cloud engine when every local engine is unavailable or errors out.

## 2. Audio storage — file is the source of truth (NOT the DB)

Sentence audio lives on disk at a **deterministic, hash-derived path**. The presence of
the file — not a DB row state — is authoritative. PHP and pycore both resolve the path
purely from the sentence hash and check the filesystem; neither queries a DB to know
whether audio exists.

```
<sentence_sounds_dir>/<language>/<hash>.mp3
   sentence_sounds_dir = PathMapper::getAppQyV1SentenceSoundsDir()
   language            = sentence.language (e.g. "english")
   hash                = sentence.sentence_id   (sha1(normalize(text)+'|'+language))
```

- The **canonical hash is `sentence_id`** (the existing sha1 the library already keys on
  and the existing `audio` reference already uses `{lang}/{sentence_id}.mp3`). We do NOT
  introduce a new MD5 filename scheme — that would orphan all existing audio. The route
  also accepts the v2 `content_id` (md5, language-agnostic) as an **alternate** lookup key,
  satisfying "request by MD5 or by sentence".
- Lookup tolerates multiple extensions in preference order: `.mp3`, `.aac`, `.m4a`, `.wav`.
- The `audio` column on `sentences` is a **cache of the relative reference only**; it is
  reconciled to match the filesystem, never trusted over it.

## 3. Marking "has audio" on the sentence library

Add a lightweight boolean cache so list views can show audio state without stat-ing every
file, while the **route that resolves a single sentence reconciles truth from disk**:

- `sentences.has_audio` (boolean, default false) — *cache only*.
- Resolution route behaviour (`GET …/sentences/audio`, §4.3):
  - File exists on disk → return its public `/static` URL; set `has_audio=true` +
    `audio=<lang>/<hash>.mp3` if the cache was stale.
  - File missing → set `has_audio=false`, `audio=null`; respond `{ exists:false }` so the
    caller knows to (re)queue generation.

## 4. Shared contract (FE ⇄ laravel_main ⇄ pycore)

All routes are unauthenticated localhost worker routes under `…/api/app_qy_v1/…`, mirroring
the existing media/assist endpoints. Base URL resolved by pycore via `LaravelEndpointManager`.

### 4.1 Claim sentences needing audio (pycore → laravel) — **priority ordered**
`POST /api/app_qy_v1/ai_tools/tts/sentence/claim`
```jsonc
// request
{ "worker_id": "pycore-<host>", "language": "english"|null, "limit": 50 }
// response
{ "success": true, "data": {
    "count": 12, "lock_stale_minutes": 10,
    "tasks": [
      { "task_id": 0, "type": "sentence",
        "sentence_id": "<sha1>", "content_id": "<md5|null>",
        "content": "<sentence text>", "language": "english",
        "audio_relative_path": "english/<sha1>.mp3",
        "priority": 100 }          // higher = sooner; user requests outrank backfill
    ] } }
```
Selection = `has_audio=false` AND not currently leased, ordered by `priority DESC, id ASC`,
leased for `lock_stale_minutes` (assist-style 60-min lease honored too).

### 4.2 Report a generated sentence audio (pycore → laravel)
`POST /api/app_qy_v1/ai_tools/tts/sentence/report` (multipart on success)
```
success: { task_id, worker_id, sentence_id, success:"true", provider:"edge|melotts|azure|…", audio:<file mp3> }
failure: { task_id, worker_id, sentence_id, success:"false", provider, error }
```
Server validates MP3 (≥100 bytes, ID3/frame-sync), writes to the §2 path, sets
`has_audio=true`, `audio=<lang>/<hash>.mp3`. Idempotent: file already present → `already_done:true`.

### 4.3 Resolve / play one sentence's audio (FE → laravel) — **file-first**
`GET /api/app_qy_v1/ai_tools/tts/sentence/audio?hash=<sha1|md5>&language=<lang>`
(or `?text=<sentence>&language=<lang>` to hash server-side)
```jsonc
{ "success": true, "exists": true,
  "url": "/static/.../english/<sha1>.mp3", "hash": "<sha1>", "language": "english" }
// or when missing — DB cache reconciled to has_audio=false:
{ "success": true, "exists": false, "queued": true, "hash": "<sha1>" }
```
PHP resolves the path from the hash and checks disk directly (no DB read to decide
existence). On miss it marks `has_audio=false` and may enqueue (bump priority).

### 4.4 Status (FE → laravel/pycore)
- Engine availability: existing `GET /api/local/tts/status` (pycore) already returns the
  `edge→sherpa→melotts→gptsovits(→azure)` chain + cooldown.
- Sentence-audio queue counts surface in the **Queue Center** "TTS Engines"/new
  "Sentence Audio" strip via a small summary on `…/tts/sentence/claim` (count when `limit=0`).

## 5. pycore: engine selection + single priority queue

### 5.1 Orchestrator (`pycore/pyutils/tts/tts_orchestrator.py`)
Priority extended to `("edge","sherpa","melotts","gptsovits","azure")`. `azure` (cloud) is
**last**, so it is only used when every local engine is unavailable/failed — exactly the
"local OK → local; else API" rule. `synthesize(text, language, output_path, rate)` is
unchanged for callers. GPU→CPU is handled inside MeloTTS (`_device()` auto).

### 5.2 Cloud engine (`pycore/pyutils/tts/azure_engine.py`, new)
Azure Speech (F0 free ≈ 0.5M neural chars/month; throttles with 429, never auto-charges).
Keys via secret manager: `AZURE_SPEECH_KEY` (indexed `_1.._5`) + `AZURE_SPEECH_REGION`.
Writes MP3 directly (no ffmpeg). `available()` = SDK importable AND key+region present.
**Extension point:** add `google_tts_engine.py` / `polly_engine.py` the same way and append
to the priority tuple — the orchestrator needs no other change.

### 5.3 Sentence-audio worker (`pycore/callmodule/services/…`)
Reuses the existing `tts_queue_poller_service` pattern (claim → synth via orchestrator →
report). New/extended for sentences:
- Claims from §4.1 (sentences) **and** keeps the existing word claim.
- **All claimed sentences merge into ONE in-process priority queue** (max-heap on
  `priority`, FIFO tie-break by claim order) before synthesis, so a high-priority user
  request jumps ahead of backfill regardless of which claim batch it arrived in.
- Synthesis is serialized (edge-tts process-wide lock); one item at a time by priority.

## 6. Frontend surfacing

- **Queue Center** (`PcQueueCenterPage.tsx`): add a "Sentence Audio" panel next to TTS
  Engines/Assist — pending/leased counts + a Run-once trigger, polling the §4 summary.
- **Vocabulary** (`VocabularyLearning.tsx`): per-sentence play button calls §4.3; shows
  generating/queued state from `exists/queued`.
- **Wordflow**: `WfMediaDetailPage` / article-processor already model `audio_url`+`status`
  per sentence — wire the play/queue affordance to §4.3, reusing `WfMediaSentence`.

## 7. Reuse map (do NOT reinvent)

| Need | Already exists — reuse |
|---|---|
| Engine priority + fallback | `tts_orchestrator.synthesize()` |
| GPU→CPU local neural | `melotts_engine` (`MELOTTS_DEVICE=auto`), `sherpa_engine` (CPU) |
| edge 403/rate resilience | `edge_tts_client` |
| Claim→synth→report worker | `tts_queue_poller_service` (word path) → extend for sentences |
| Sentence model + hashes | `Sentence` (`sentence_id` sha1, `content_id` md5, `audio`) |
| Audio dir resolution | `PathMapper::getAppQyV1SentenceSoundsDir()` |
| Static serving | `/static/{path}` (`StaticFileController`) or nginx |
| Lease/recover | assist 60-min lease + `AppQyV1CoverGenerationTask` maintenance |
| Endpoint resolution | `LaravelEndpointManager` |
