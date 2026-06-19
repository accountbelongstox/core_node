# Sentence-Library Audio Generation Pipeline

Cross-stack design + shared contract for **auxiliary audio generation of the
per-language sentence library**. Spans **pycore** (TTS engines + worker), **laravel_main**
(file-first audio resolution + claim-by-priority), and the **pycore_laravel_wordflow_ui /
wordflow** frontends.

> This document is the single source of truth for the **audio** feature. Front-end and
> back-end must agree on the contract in §4. Keep it in sync as a linked change when code moves.
>
> **Sentence-table model is now per-language v3.1.** Audio is keyed by `(language, content_id)`
> against the per-language `app_qy_v1_sentences_{lang}` tables. The single shared
> `app_qy_v1_sentences` table is **removed (clean cut)** — dropped at the schema level, code
> removed, NOT created at `sys:init`; there is no compatibility layer. All `language` values
> are **codes only** (`en`/`zh`/`ja`...), never full names. The canonical sentence/schema
> contract is [`development-guides/BOOKS_FEATURE_SPECIFICATION.md`](./BOOKS_FEATURE_SPECIFICATION.md)
> (see §3 schema, §6 audio). Where this doc and that one disagree on the schema, **that one wins**.

Related canonical docs:
[`development-guides/BOOKS_FEATURE_SPECIFICATION.md`](./BOOKS_FEATURE_SPECIFICATION.md)
(per-language sentence schema + §6 audio),
[pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md](../pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md)
(media → sentence ingest), and the laravel↔pycore assist lease protocol.

---

## 1. Goal

For every sentence in the per-language sentence library (`app_qy_v1_sentences_{lang}`),
produce a spoken-audio MP3 and let clients fetch it. Generation must degrade gracefully:

1. **edge-tts** when available (online, best quality, already serialized + 403-resilient).
2. Otherwise an **open-source neural TTS** running **locally on GPU, falling back to CPU**.
   - MeloTTS already auto-selects `cuda:0 → cpu` (`MELOTTS_DEVICE=auto`); Sherpa-ONNX
     (Kokoro) is the CPU-only safety net. These are the "chat-tts open-source" tier.
3. If **all local engines fail/unavailable**, generate via a **free cloud TTS API**
   (Azure Speech first; pluggable for Google Cloud TTS / Amazon Polly).

Local-first is automatic: the orchestrator tries engines in priority order and only
reaches the cloud engine when every local engine is unavailable or errors out.

## 2. Audio storage — file is the source of truth (NOT the DB)

Sentence audio lives on disk at a **deterministic, PHP-computed path**. The presence of
the file — not a DB row state — is authoritative. PHP and pycore both resolve the path
purely from `(language, content_id)` and check the filesystem; neither queries a DB to know
whether audio exists.

```
<sentence_sounds_dir>/<language>/<content_id>.mp3
   = PathMapper::getAppQyV1SentenceSoundsDir("{lang}/{content_id}.mp3")
   language    = the lang code == the table suffix of app_qy_v1_sentences_{lang} (e.g. "en")
   content_id  = md5(lowercase(collapse(strip_punctuation(text))))  // unique per per-language table
```

- The **canonical key is `(language, content_id)`** — the same `content_id` that is unique
  within each `app_qy_v1_sentences_{lang}` table (see BOOKS_FEATURE_SPECIFICATION.md §3.1/§6).
  The filename is `{content_id}.mp3` under the per-language `{lang}/` directory.
- Path is **PHP-computed** via `PathMapper::getAppQyV1SentenceSoundsDir("{lang}/{content_id}.mp3")`
  (no ad-hoc concatenation).
- Lookup tolerates multiple extensions in preference order: `.mp3`, `.aac`, `.m4a`, `.wav`.
- The `audio` column on `sentences_{lang}` is a **cache of the relative reference only**
  (`"{lang}/{content_id}.mp3"`); it is reconciled to match the filesystem, never trusted over it.
- **[Superseded]** Earlier this doc keyed audio on `sentence_id` (sha1) against a single
  shared `sentences` table. That table is now **removed (clean cut)** — not created at
  `sys:init`, code dropped (BOOKS_FEATURE_SPECIFICATION.md §3.4). Audio keys on the
  per-language `content_id` (md5). The `sentence_id` column survives on each per-language
  table as a legacy-compat lookup only, but the **filename and primary key are `content_id`**.

## 3. Marking "has audio" on the sentence library

The DB stores only a lightweight **flag** (`has_audio`) + the relative-path **cache**
(`audio`) so list views can show audio state without stat-ing every file and so duplicate
generation is prevented ("数据库中只是标识,防止重复生成"), while the **route that resolves a
single sentence reconciles truth from disk**:

- `app_qy_v1_sentences_{lang}.has_audio` (boolean, default false, index) — *flag only*.
- `app_qy_v1_sentences_{lang}.audio` (nullable) — relative-path cache `"{lang}/{content_id}.mp3"`.
- Resolution route behaviour (`GET …/tts/sentence/audio`, §4.3), per-language:
  - File exists on disk → return its public `/static` URL; set `has_audio=true` +
    `audio="{lang}/{content_id}.mp3"` if the cache was stale.
  - File missing → set `has_audio=false`, `audio=null`; respond `{ exists:false }` so the
    caller knows to (re)queue generation.

## 4. Shared contract (FE ⇄ laravel_main ⇄ pycore)

All routes are unauthenticated localhost worker routes under `…/api/app_qy_v1/…`, mirroring
the existing media/assist endpoints. Base URL resolved by pycore via `LaravelEndpointManager`.

### 4.1 Claim sentences needing audio (pycore → laravel) — **priority ordered, per-language**
`POST /api/app_qy_v1/ai_tools/tts/sentence/claim`
```jsonc
// request
{ "worker_id": "pycore-<host>", "language": "en"|null, "limit": 50 }
// response
{ "success": true, "data": {
    "count": 12, "lock_stale_minutes": 10,
    "tasks": [
      { "task_id": 0, "type": "sentence",
        "content_id": "<md5>", "sentence_id": "<sha1|null>",  // content_id = canonical key
        "content": "<sentence text>", "language": "en",
        "audio_relative_path": "en/<content_id>.mp3",
        "priority": 100 }          // higher = sooner; user requests outrank backfill
    ] } }
```
Selection scans `app_qy_v1_sentences_{lang}` for the requested language(s) (all languages when
`language=null`): `has_audio=false` AND not currently leased, ordered by
`tts_priority DESC, occurrence_count DESC, id ASC`, leased for `lock_stale_minutes`
(`tts_locked_at`/`tts_locked_by`; assist-style 60-min lease honored too).

### 4.2 Report a generated sentence audio (pycore → laravel)
`POST /api/app_qy_v1/ai_tools/tts/sentence/report` (multipart on success)
```
success: { task_id, worker_id, content_id, language, success:"true", provider:"edge|melotts|azure|…", audio:<file mp3> }
failure: { task_id, worker_id, content_id, language, success:"false", provider, error }
```
Server validates MP3 (≥100 bytes, ID3/frame-sync), writes via
`PathMapper::getAppQyV1SentenceSoundsDir("{lang}/{content_id}.mp3")`, then on the
`app_qy_v1_sentences_{lang}` row sets `has_audio=true`, `audio="{lang}/{content_id}.mp3"`,
`tts_status=completed`. Idempotent: file already present → `already_done:true`.

### 4.3 Resolve / play one sentence's audio (FE → laravel) — **file-first, per-language**
`GET /api/app_qy_v1/ai_tools/tts/sentence/audio?hash=<content_id>&language=<lang>`
(or `?text=<sentence>&language=<lang>` to compute `content_id` server-side)
```jsonc
{ "success": true, "exists": true,
  "url": "/static/.../en/<content_id>.mp3", "hash": "<content_id>", "language": "en" }
// or when missing — DB cache reconciled to has_audio=false:
{ "success": true, "exists": false, "queued": true, "hash": "<content_id>" }
```
PHP computes the path from `(language, content_id)` and checks disk directly (no DB read to
decide existence; URL via `AppQyV1SentenceAudioUrl::forRelative("{lang}/{content_id}.mp3")`).
On miss it marks `has_audio=false` on the per-language row and may enqueue (bump priority).

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
| Sentence model + hashes | `LangSentence::for($lang)` over `app_qy_v1_sentences_{lang}` (`content_id` md5 = key, `sentence_id` sha1 legacy, `audio`, `has_audio`) |
| Audio dir resolution | `PathMapper::getAppQyV1SentenceSoundsDir()` |
| Static serving | `/static/{path}` (`StaticFileController`) or nginx |
| Lease/recover | assist 60-min lease + `AppQyV1CoverGenerationTask` maintenance |
| Endpoint resolution | `LaravelEndpointManager` |
